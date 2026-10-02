/**
 * Regressionstest (Track notify): Benachrichtigungen, Reklamationslabel, interne Kommentare,
 * Eingangspruefung und E-Mail-Versandprotokoll - echte Express-Routen, echte Wegwerf-DB,
 * Rollen Kunde / fremder Kunde / Personal / Admin.
 *
 *   [A] NOTIF-1  Reklamation genehmigen: kein base64-PDF in Benachrichtigung, Protokoll, API;
 *                autorisierter Download GET /api/complaints/:id/shipping-label (Eigentuemer,
 *                Personal, Admin 200 PDF; fremder Kunde 403); genau EINE Kunden-E-Mail.
 *   [B] NOTIF-1  Alte Benachrichtigung mit base64 -> beim Lesen bereinigt (kurzer Text +
 *                Dokumentreferenz), DB unveraendert; Skript Dry-Run schreibt nichts, --confirm
 *                bereinigt, zweiter Lauf findet nichts (idempotent).
 *   [C] COMMS-8  Interne Kommentare nie in Kunden-APIs (GET /my, GET /:id, POST /comments,
 *                GET /booking/:bookingId); /booking prueft den Eigentuemer (fremd -> 403).
 *   [D] NOTIF-11/12  Personal-Kommentar -> genau eine Benachrichtigung und eine E-Mail;
 *                Kundenkommentar ohne Zuweisung -> aktive Admins benachrichtigt (Link auf die
 *                Reklamation); Angebot nach Ablehnung -> nur EINE Kundenbenachrichtigung/E-Mail.
 *   [E] NOTIF-13/10  Zaehler aus der DB (130 Eintraege), Kategorien, Limit-Obergrenze,
 *                "alle gelesen" -> 0; Linkabbildung tote/Listen-Ziele -> Datensatz.
 *   [F] NOTIF-16 E-Mail-Fehler wird zurueckgegeben und an der Benachrichtigung gespeichert;
 *                dedupeKey verhindert Doppelte (auch gleichzeitig).
 *   [G] NOTIF-15 SMTP-Ergebnis: alle Empfaenger abgelehnt -> 'failed'; Timeout nach DATA ->
 *                KEINE Wiederholung; Verbindungsfehler -> Wiederholung mit gleicher Message-ID.
 *   [H] NOTIF-3/4/7/8 Eingangspruefung: deutscher Kundentext beim Start, Test-Auffaelligkeiten
 *                als gueltige Benachrichtigung (einmal), Kundeninformation zu Defekt nur mit
 *                Kundentext (interne Notiz nie), einmalig; E-Mail-Betreff "Eingangsprüfung".
 *
 * MOCKS: nur DHL (createShipment/getDHLConfig) - kein echtes Label. E-Mails laufen ueber den
 * Stream-Transport (EMAIL_TEST_TRANSPORT=stream), nichts verlaesst den Rechner. Datei-Logs
 * (server/logs) werden umgeleitet.
 *
 * Aufruf (nur WEGWERF-Datenbank):
 *   EMAIL_TEST_TRANSPORT=stream TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_notify_notifications node test-notify-notifications-http.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const Module = require('module');

const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, 'server');
const LOG_DIR = path.join(SERVER_DIR, 'logs');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_notify_notifications';
process.env.EMAIL_TEST_TRANSPORT = 'stream';

function isUnsafeTestUri(uri) {
  const text = String(uri || '');
  const match = text.match(/^mongodb:\/\/(?:[^@/]*@)?(\[[^\]]+\]|[^:/,?]+)(?::(\d+))?\/([^/?]+)/i);
  if (!match) return true; // mongodb+srv, mehrere Hosts oder unlesbar
  const host = match[1].replace(/^\[|\]$/g, '').toLowerCase();
  const port = match[2];
  const dbName = match[3].toLowerCase();
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) return true;
  if (!port || port === '27017') return true;
  let devDbName = 'fixithub';
  try {
    const envText = require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8');
    const devUrl = (envText.match(/^DATABASE_URL=(.*)$/m) || [])[1] || '';
    const devMatch = devUrl.match(/\/([^/?\s]+)(?:\?|\s*$)/);
    if (devMatch) devDbName = devMatch[1].toLowerCase();
  } catch (error) {
    /* ohne .env gilt der Standardname */
  }
  return dbName === devDbName || dbName === 'fixithub';
}

// ---- Keine Dateien im Repository: Schreibzugriffe auf server/logs umleiten ----
const LOG_REDIRECT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'notify-test-logs-'));
const redirectLogPath = (target) => {
  const text = typeof target === 'string' ? target : '';
  if (text && path.resolve(text).startsWith(LOG_DIR + path.sep)) {
    return path.join(LOG_REDIRECT_DIR, path.basename(text));
  }
  return target;
};
['appendFileSync', 'writeFileSync', 'mkdirSync'].forEach((name) => {
  const original = fs[name];
  fs[name] = function redirected(target, ...rest) { return original.call(this, redirectLogPath(target), ...rest); };
});
['appendFile', 'writeFile'].forEach((name) => {
  const original = fs.promises[name];
  fs.promises[name] = function redirected(target, ...rest) { return original.call(this, redirectLogPath(target), ...rest); };
});
const originalAppendFile = fs.appendFile;
fs.appendFile = function redirected(target, ...rest) { return originalAppendFile.call(this, redirectLogPath(target), ...rest); };

// 'qrcode' fehlt lokal (nur PDF-Erzeugung).
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, parent, ...rest) {
  if (request === 'qrcode') return 'qrcode-test-stub';
  return originalResolve.call(this, request, parent, ...rest);
};
require.cache['qrcode-test-stub'] = {
  id: 'qrcode-test-stub', filename: 'qrcode-test-stub', loaded: true,
  exports: { toDataURL: async () => 'data:image/png;base64,', toBuffer: async () => Buffer.from('') },
};

const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

let pass = 0;
let fail = 0;
const check = (condition, message, actual) => {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${message} :: ${actual}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${message} :: ${actual}`);
  }
};
const section = async (title, fn) => {
  console.log(`\n${title}`);
  try {
    await fn();
  } catch (error) {
    fail += 1;
    console.log(`  FAIL Abschnitt brach ab :: ${error && error.stack ? error.stack.split('\n').slice(0, 4).join(' | ') : error}`);
  }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Minimales gueltiges PDF als base64 (beginnt mit %PDF).
const PDF_BASE64 = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n').toString('base64');
const PDF_DATA_URI = `data:application/pdf;base64,${PDF_BASE64}`;

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  fs.readdirSync(path.join(SERVER_DIR, 'models')).filter((file) => file.endsWith('.js')).forEach((file) => {
    try { require(path.join(SERVER_DIR, 'models', file)); } catch (error) { /* optionale Abhaengigkeiten */ }
  });
  const Notification = mongoose.model('Notification');
  await Notification.createIndexes();
  await mongoose.model('NotificationDedupeClaim').createIndexes();

  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.buildSystemUrl = async (p) => `http://test.invalid${p}`;
  EmailService.retryHandler.baseDelay = 1;
  EmailService.retryHandler.maxBackoffDelay = 5;
  const captured = [];
  const realGetTransporter = EmailService.getTransporter.bind(EmailService);
  let transporterOverride = null;
  EmailService.getTransporter = async () => {
    if (transporterOverride) return transporterOverride;
    const transporter = await realGetTransporter();
    if (!transporter.__captureWrapped) {
      const original = transporter.sendMail.bind(transporter);
      transporter.sendMail = async (options) => { captured.push(options); return original(options); };
      transporter.__captureWrapped = true;
    }
    return transporter;
  };
  const mailsTo = (email) => captured.filter((mail) => String(mail.to).toLowerCase() === email.toLowerCase());

  // DHL: kein echter Aufruf. Wie der echte Dienst wird das Einsendelabel auch am
  // Reklamationsauftrag (returnLabelUrl) gespeichert.
  const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));
  DHLService.getDHLConfig = async () => ({ settings: { shipperStreet: 'Teststr. 1', shipperCity: 'Berlin', shipperPostalCode: '10115', shipperCompany: 'McRepair Test' } });
  DHLService.getParcelDEConfig = () => ({ accountNumber: 'TEST', profile: 'STANDARD', product: 'V01PAK' });
  DHLService.createShipment = async (orderId) => {
    await mongoose.connection.db.collection('orders').updateOne(
      { _id: new mongoose.Types.ObjectId(String(orderId)) },
      { $set: { returnLabelUrl: PDF_DATA_URI, returnTrackingNumber: '00340434161094015902' } }
    );
    return { labelUrl: PDF_DATA_URI, trackingNumber: '00340434161094015902' };
  };
  DHLService.getTrackingInfo = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };

  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  const OrderService = require(path.join(SERVER_DIR, 'services/orderService'));
  const { runCleanup } = require(path.join(SERVER_DIR, 'scripts/cleanupNotificationLabelData'));

  const app = express();
  app.use(express.json());
  app.use('/api/complaints', require(path.join(SERVER_DIR, 'routes/complaintRoutes')));
  app.use('/api/notifications', require(path.join(SERVER_DIR, 'routes/notificationRoutes')));
  app.use('/api/device-inspections', require(path.join(SERVER_DIR, 'routes/deviceInspectionRoutes')));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const Service = mongoose.model('Service');
  const Complaint = mongoose.model('Complaint');

  const owner = await User.create({ name: 'Kunde Eigen', firstName: 'Klara', lastName: 'Kunde', email: 'notify-owner@test.invalid', role: 'customer' });
  const stranger = await User.create({ name: 'Kunde Fremd', email: 'notify-stranger@test.invalid', role: 'customer' });
  const staff = await User.create({ name: 'Tina Technik', firstName: 'Tina', lastName: 'Technik', email: 'notify-staff@test.invalid', role: 'staff' });
  const admin = await User.create({ name: 'Anna Admin', firstName: 'Anna', lastName: 'Admin', email: 'notify-admin@test.invalid', role: 'admin', isActive: true });

  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, user, body) => {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(user)}` },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const contentType = response.headers.get('content-type') || '';
    let json = null;
    let buffer = null;
    if (contentType.includes('application/json')) {
      try { json = await response.json(); } catch (error) { json = null; }
    } else {
      buffer = Buffer.from(await response.arrayBuffer());
    }
    return { status: response.status, body: json, buffer, contentType, raw: json ? JSON.stringify(json) : (buffer ? buffer.toString('latin1').slice(0, 20) : '') };
  };

  const display = await Service.create({
    category: 'display', deviceTypes: ['Smartphone'], manufacturerPrecise: 'Apple', modelPrecise: 'iPhone 15',
    name: 'Displaytausch', price: 100, estimatedTime: '60',
  });
  const newOrder = async (customer = owner) => OrderService.create({
    customerId: customer._id, deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
    errorDescription: 'Test', services: [String(display._id)],
  });
  const newComplaint = async (order, extra = {}) => Complaint.create({
    orderId: order._id, customerId: order.customerId?._id || order.customerId, subject: 'Display flackert', description: 'Seit der Reparatur flackert das Display.',
    category: 'quality', workflowType: 'order-complaint', status: 'pending_approval', complaintReason: 'Display flackert', ...extra,
  });

  try {
    // =================================================================================
    await section('[A] Reklamation genehmigen: Label nur per autorisiertem Download, keine PDF-Daten in Texten', async () => {
      const order = await newOrder(owner);
      const complaint = await newComplaint(order);
      const mailsBefore = mailsTo(owner.email).length;

      const approve = await call('PATCH', `/api/complaints/${complaint._id}/approve`, admin);
      check(approve.status === 200 && approve.body?.success, 'Admin genehmigt: 200', `${approve.status} ${approve.body?.error || ''}`);
      check(!approve.raw.includes('base64'), 'Genehmigungsantwort enthaelt keine PDF-Daten', `${approve.raw.length} Zeichen`);
      check(approve.body?.complaint?.hasShippingLabel === true && approve.body?.complaint?.shippingTrackingNumber === '00340434161094015902',
        'Antwort: hasShippingLabel + Sendungsnummer statt Daten', `${approve.body?.complaint?.hasShippingLabel} ${approve.body?.complaint?.shippingTrackingNumber}`);
      check(approve.body?.customerNotification?.inApp === 'created' && approve.body?.customerNotification?.email === 'sent',
        'Antwort meldet Benachrichtigungsergebnis getrennt (In-App erstellt, E-Mail vom Mailserver angenommen)', JSON.stringify(approve.body?.customerNotification));

      const stored = await Notification.find({ userId: owner._id, 'metadata.complaintId': String(complaint._id) }).lean();
      check(stored.length === 1, 'genau EINE Kundenbenachrichtigung in der DB', stored.length);
      const n = stored[0] || {};
      check(!/base64/.test(n.message || '') && String(n.message || '').length < 300 && /genehmigt/.test(n.message || '') && /Versandlabel/.test(n.message || ''),
        'Benachrichtigungstext kurz, deutsch, ohne PDF-Daten', `${String(n.message || '').length} Zeichen: ${n.message}`);
      check(!JSON.stringify(n.metadata || {}).includes('data:'), 'Metadaten ohne Data-URI', Object.keys(n.metadata || {}).join(','));
      check(n.metadata?.document?.kind === 'complaint_shipping_label' && n.metadata?.document?.downloadPath === `/api/complaints/${complaint._id}/shipping-label`,
        'strukturierte Dokumentreferenz gespeichert', JSON.stringify(n.metadata?.document));
      check(n.actionUrl === `/my-complaints/${complaint._id}`, 'Ziel ist die Reklamation selbst (nicht die Liste)', n.actionUrl);
      check(n.dedupeKey === `complaint:${complaint._id}:admin_approved`, 'dedupeKey gesetzt', n.dedupeKey);

      const rawComplaint = await mongoose.connection.db.collection('complaints').findOne({ _id: complaint._id });
      const approvedLog = (rawComplaint.complaintLogs || []).find((entry) => entry.action === 'admin_approved');
      check(approvedLog && !JSON.stringify(approvedLog.metadata).includes('data:') && approvedLog.metadata.shippingLabelStored === true,
        'Protokolleintrag ohne PDF (shippingLabelStored)', JSON.stringify(approvedLog?.metadata || {}).slice(0, 120));
      check(/^data:application\/pdf/.test(rawComplaint.shippingLabelUrl || ''), 'PDF bleibt am Datensatz (Download-Quelle)', String(rawComplaint.shippingLabelUrl || '').slice(0, 30));

      const ownerMails = mailsTo(owner.email).slice(mailsBefore);
      check(ownerMails.length === 1, 'genau EINE Kunden-E-Mail (keine zusaetzliche allgemeine Benachrichtigungs-E-Mail)', ownerMails.map((m) => m.subject).join(' | '));
      check(ownerMails[0] && (ownerMails[0].attachments || []).some((a) => /\.pdf$/.test(a.filename)), 'E-Mail traegt das Label als PDF-Anhang', (ownerMails[0]?.attachments || []).map((a) => a.filename).join(','));

      const list = await call('GET', '/api/notifications?limit=20', owner);
      check(list.status === 200 && !list.raw.includes('base64'), 'GET /api/notifications (Kunde) ohne base64', list.raw.length);
      const listed = (list.body?.notifications || []).find((item) => String(item.metadata?.complaintId) === String(complaint._id));
      const download = (listed?.actions || []).find((a) => a.kind === 'download');
      const open = (listed?.actions || []).find((a) => a.kind === 'open');
      check(download?.url === `/api/complaints/${complaint._id}/shipping-label` && download?.label === 'Versandlabel herunterladen',
        'Aktion "Versandlabel herunterladen" mit API-Pfad', JSON.stringify(download));
      check(open?.url === `/my-complaints/${complaint._id}` && listed?.category === 'complaint', 'Aktion "Reklamation öffnen" + Kategorie Reklamation', `${JSON.stringify(open)} ${listed?.category}`);

      const ownerDl = await call('GET', `/api/complaints/${complaint._id}/shipping-label`, owner);
      check(ownerDl.status === 200 && ownerDl.contentType.includes('application/pdf') && ownerDl.buffer?.toString('latin1').startsWith('%PDF'),
        'Eigentuemer: 200 PDF', `${ownerDl.status} ${ownerDl.contentType} ${ownerDl.raw}`);
      const strangerDl = await call('GET', `/api/complaints/${complaint._id}/shipping-label`, stranger);
      check(strangerDl.status === 403 && !strangerDl.buffer, 'fremder Kunde: 403', `${strangerDl.status} ${strangerDl.body?.error}`);
      const strangerUnknown = await call('GET', `/api/complaints/${new mongoose.Types.ObjectId()}/shipping-label`, stranger);
      const strangerInvalid = await call('GET', '/api/complaints/kein-id/shipping-label', stranger);
      check(strangerUnknown.status === 403 && strangerInvalid.status === 403, 'fremder Kunde: unbekannte/ungueltige ID ebenfalls 403', `${strangerUnknown.status} ${strangerInvalid.status}`);
      const staffDl = await call('GET', `/api/complaints/${complaint._id}/shipping-label`, staff);
      const adminDl = await call('GET', `/api/complaints/${complaint._id}/shipping-label`, admin);
      check(staffDl.status === 200 && adminDl.status === 200, 'Personal und Admin: 200', `${staffDl.status} ${adminDl.status}`);

      const noLabel = await newComplaint(await newOrder(owner));
      const noLabelDl = await call('GET', `/api/complaints/${noLabel._id}/shipping-label`, owner);
      check(noLabelDl.status === 404 && /kein Versandlabel/.test(noLabelDl.body?.error || ''), 'ohne Label: 404 deutsch', `${noLabelDl.status} ${noLabelDl.body?.error}`);

      const my = await call('GET', '/api/complaints/my', owner);
      const mine = (my.body?.complaints || []).find((c) => String(c._id) === String(complaint._id));
      check(my.status === 200 && !my.raw.includes('base64') && mine?.hasShippingLabel === true && mine?.shippingLabelUrl === undefined,
        'GET /my: hasShippingLabel, keine PDF-Daten', `${my.status} ${mine?.hasShippingLabel}`);
      const adminList = await call('GET', '/api/complaints', admin);
      check(adminList.status === 200 && !adminList.raw.includes('base64'), 'Admin-Liste ohne PDF-Daten', adminList.raw.length);

      const again = await call('PATCH', `/api/complaints/${complaint._id}/approve`, admin);
      const afterAgain = await Notification.countDocuments({ userId: owner._id, 'metadata.complaintId': String(complaint._id) });
      check(again.status === 409 && afterAgain === 1, 'erneute Genehmigung: 409, weiterhin eine Benachrichtigung', `${again.status} ${afterAgain}`);
    });

    // =================================================================================
    await section('[B] Altdaten: Lese-Bereinigung und Bereinigungsskript (Dry-Run, --confirm, idempotent)', async () => {
      const legacyComplaintId = new mongoose.Types.ObjectId();
      const legacy = await Notification.create({
        userId: owner._id,
        title: 'Reklamation genehmigt',
        message: `Deine Reklamation wurde genehmigt. Versandlabel: ${PDF_DATA_URI}. Reklamationsauftrag: ORD-ALT-1`,
        type: 'order_update',
        actionUrl: '/my-complaints',
        metadata: { event: 'admin_approved', complaintId: String(legacyComplaintId), complaintNumber: 'RALT1', shippingLabelUrl: PDF_DATA_URI, complaintOrderNumber: 'ORD-ALT-1' },
      });
      await mongoose.connection.db.collection('complaints').insertOne({
        _id: legacyComplaintId, complaintNumber: 'RALT1', customerId: owner._id, subject: 'Alt', description: 'Alt', category: 'quality',
        status: 'approved', shippingLabelUrl: PDF_DATA_URI, comments: [],
        complaintLogs: [{ action: 'admin_approved', metadata: { shippingLabelUrl: PDF_DATA_URI, trackingNumber: 'ALT-TRACK' }, createdAt: new Date() }],
      });

      const list = await call('GET', '/api/notifications?limit=50', owner);
      const item = (list.body?.notifications || []).find((n) => String(n._id) === String(legacy._id));
      check(item && !JSON.stringify(item).includes('base64') && /RALT1 wurde genehmigt/.test(item.message) && item.message.length < 300,
        'Altbenachrichtigung beim Lesen bereinigt (kurzer Text)', item?.message);
      check(item?.metadata?.document?.downloadPath === `/api/complaints/${legacyComplaintId}/shipping-label` && item?.actionUrl === `/my-complaints/${legacyComplaintId}`,
        'Altbenachrichtigung: Dokumentreferenz + Ziel auf die Reklamation', `${item?.metadata?.document?.downloadPath} ${item?.actionUrl}`);
      const stillRaw = await mongoose.connection.db.collection('notifications').findOne({ _id: legacy._id });
      check(/base64/.test(stillRaw.message), 'Lesen schreibt die Altdaten NICHT still um', String(stillRaw.message).length);

      const legacyComplaintView = await call('GET', `/api/complaints/${legacyComplaintId}`, owner);
      check(legacyComplaintView.status === 200 && !legacyComplaintView.raw.includes('base64') && legacyComplaintView.body?.complaint?.shippingTrackingNumber === 'ALT-TRACK',
        'Alt-Reklamation: Protokoll ohne PDF in der Antwort', `${legacyComplaintView.status} ${legacyComplaintView.body?.complaint?.shippingTrackingNumber}`);

      const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notify-cleanup-'));
      const quiet = () => {};
      const dry = await runCleanup({ confirm: false, backupDir, log: quiet });
      const afterDry = await mongoose.connection.db.collection('notifications').findOne({ _id: legacy._id });
      check(dry.notificationsMatched >= 1 && dry.complaintsMatched >= 1 && /base64/.test(afterDry.message) && !dry.backupFile,
        'Dry-Run: meldet Treffer, schreibt nichts', JSON.stringify({ n: dry.notificationsMatched, c: dry.complaintsMatched }));
      const confirmed = await runCleanup({ confirm: true, backupDir, log: quiet });
      const afterConfirm = await mongoose.connection.db.collection('notifications').findOne({ _id: legacy._id });
      const complaintAfter = await mongoose.connection.db.collection('complaints').findOne({ _id: legacyComplaintId });
      check(confirmed.notificationsUpdated >= 1 && !/base64/.test(afterConfirm.message) && afterConfirm.metadata.shippingLabelUrl === undefined
        && afterConfirm.metadata.document?.kind === 'complaint_shipping_label',
        '--confirm: Benachrichtigung bereinigt + Dokumentreferenz', afterConfirm.message);
      check(!JSON.stringify(complaintAfter.complaintLogs).includes('data:') && complaintAfter.complaintLogs[0].metadata.shippingLabelStored === true
        && /^data:/.test(complaintAfter.shippingLabelUrl), '--confirm: Protokoll bereinigt, PDF am Datensatz bleibt', JSON.stringify(complaintAfter.complaintLogs[0].metadata));
      check(confirmed.backupFile && fs.existsSync(confirmed.backupFile) && JSON.parse(fs.readFileSync(confirmed.backupFile, 'utf8')).notifications.length >= 1,
        'Sicherungsdatei mit Originaldokumenten geschrieben (ausserhalb des Repos)', confirmed.backupFile);
      const second = await runCleanup({ confirm: true, backupDir, log: quiet });
      check(second.notificationsMatched === 0 && second.complaintsMatched === 0, 'zweiter Lauf: nichts mehr zu tun (idempotent)', JSON.stringify({ n: second.notificationsMatched, c: second.complaintsMatched }));
      fs.rmSync(backupDir, { recursive: true, force: true });
    });

    // =================================================================================
    await section('[C] COMMS-8: interne Kommentare nie in Kunden-APIs, /booking mit Eigentuemerpruefung', async () => {
      const order = await newOrder(owner);
      const bookingId = new mongoose.Types.ObjectId();
      await mongoose.connection.db.collection('bookings').insertOne({ _id: bookingId, bookingNumber: 'BKG-NOTIFY-1', customerId: owner._id, status: 'confirmed' });
      const complaint = await newComplaint(order, { bookingId, status: 'approved' });

      const internal = await call('POST', `/api/complaints/${complaint._id}/comments`, staff, { comment: 'INTERN-XYZ Kunde hat Gerät fallen lassen', isInternal: true });
      check(internal.status === 200 && (internal.body?.complaint?.comments || []).some((c) => c.isInternal), 'Personal speichert interne Notiz (Antwort an Personal enthaelt sie)', internal.status);
      const internalNotifs = await Notification.countDocuments({ userId: owner._id, 'metadata.complaintId': String(complaint._id) });
      check(internalNotifs === 0, 'interne Notiz benachrichtigt den Kunden nicht', internalNotifs);
      const forged = await call('POST', `/api/complaints/${complaint._id}/comments`, owner, { comment: 'Kunde versucht intern', isInternal: true });
      const forgedStored = (await mongoose.connection.db.collection('complaints').findOne({ _id: complaint._id })).comments.find((c) => c.comment === 'Kunde versucht intern');
      check(forged.status === 200 && forgedStored && forgedStored.isInternal === false, 'Kunde kann keine interne Notiz anlegen', JSON.stringify(forgedStored?.isInternal));
      check(!forged.raw.includes('INTERN-XYZ'), 'POST /comments-Antwort an den Kunden ohne interne Notiz', forged.raw.length);

      const my = await call('GET', '/api/complaints/my', owner);
      const byId = await call('GET', `/api/complaints/${complaint._id}`, owner);
      const booking = await call('GET', `/api/complaints/booking/${bookingId}`, owner);
      check(my.status === 200 && !my.raw.includes('INTERN-XYZ'), 'GET /my ohne interne Notiz', my.status);
      check(byId.status === 200 && !byId.raw.includes('INTERN-XYZ') && (byId.body?.complaint?.comments || []).every((c) => !c.isInternal), 'GET /:id ohne interne Notiz', byId.status);
      check(booking.status === 200 && (booking.body?.complaints || []).length === 1 && !booking.raw.includes('INTERN-XYZ'), 'GET /booking/:id (Eigentuemer) ohne interne Notiz', `${booking.status} ${(booking.body?.complaints || []).length}`);

      const foreignBooking = await call('GET', `/api/complaints/booking/${bookingId}`, stranger);
      check(foreignBooking.status === 403 && !foreignBooking.raw.includes('Display flackert'), 'fremder Kunde GET /booking/:id: 403 ohne Daten', `${foreignBooking.status} ${foreignBooking.body?.error}`);
      const foreignUnknown = await call('GET', `/api/complaints/booking/${new mongoose.Types.ObjectId()}`, stranger);
      const foreignInvalid = await call('GET', '/api/complaints/booking/kein-id', stranger);
      check(foreignUnknown.status === 403 && foreignInvalid.status === 403, 'unbekannte/ungueltige Buchung fuer Kunden: 403', `${foreignUnknown.status} ${foreignInvalid.status}`);
      const foreignById = await call('GET', `/api/complaints/${complaint._id}`, stranger);
      check(foreignById.status === 403, 'fremder Kunde GET /:id: 403', foreignById.status);

      const staffView = await call('GET', `/api/complaints/${complaint._id}`, staff);
      const adminBooking = await call('GET', `/api/complaints/booking/${bookingId}`, admin);
      check(staffView.status === 200 && staffView.raw.includes('INTERN-XYZ'), 'Personal sieht die interne Notiz', staffView.status);
      check(adminBooking.status === 200 && adminBooking.raw.includes('INTERN-XYZ'), 'Admin sieht sie auch ueber /booking', adminBooking.status);
    });

    // =================================================================================
    await section('[D] Reklamationsnachrichten: je Ereignis eine Benachrichtigung/E-Mail, Kundennachricht erreicht das Team', async () => {
      const order = await newOrder(owner);
      const complaint = await newComplaint(order, { status: 'approved' });

      const before = mailsTo(owner.email).length;
      const staffMsg = await call('POST', `/api/complaints/${complaint._id}/comments`, staff, { comment: 'Wir haben Ihr Gerät erhalten.', isInternal: false });
      const notifs = await Notification.find({ userId: owner._id, 'metadata.complaintId': String(complaint._id) }).lean();
      const mails = mailsTo(owner.email).slice(before);
      check(staffMsg.status === 200 && notifs.length === 1 && notifs[0].actionUrl === `/my-complaints/${complaint._id}`, 'Personalnachricht: eine Kundenbenachrichtigung mit Link auf die Reklamation', `${notifs.length} ${notifs[0]?.actionUrl}`);
      check(mails.length === 1, 'Personalnachricht: genau EINE E-Mail (vorher zwei)', mails.map((m) => m.subject).join(' | '));
      check(staffMsg.body?.customerNotification?.email === 'sent', 'Antwort meldet das E-Mail-Ergebnis', JSON.stringify(staffMsg.body?.customerNotification));

      const customerMsg = await call('POST', `/api/complaints/${complaint._id}/comments`, owner, { comment: 'Wann bekomme ich es zurück?' });
      const adminNotif = await Notification.findOne({ userId: admin._id, 'metadata.complaintId': String(complaint._id), 'metadata.event': 'customer_comment' }).lean();
      check(customerMsg.status === 200 && adminNotif && adminNotif.actionUrl === `/admin/complaints?complaintId=${complaint._id}`,
        'Kundennachricht ohne Zuweisung: aktiver Admin benachrichtigt (Link auf Reklamation)', adminNotif?.actionUrl);
      const adminMails = mailsTo(admin.email).length;
      check(adminMails === 0, 'Team-Benachrichtigung ohne Kunden-E-Mail-Vorlage an Admin', adminMails);

      // Angebot nach Ablehnung (Admin bestaetigt): Verlauf + Benachrichtigung nur EINMAL.
      const denyOrder = await newOrder(owner);
      const denyComplaint = await newComplaint(denyOrder, { status: 'pending_approval' });
      const beforeDeny = mailsTo(owner.email).length;
      const deny = await call('PATCH', `/api/complaints/${denyComplaint._id}/deny`, admin, { technician_reason: 'Sturzschaden', offer_amount: 49.9, offer_description: 'Displaytausch' });
      const denyNotifs = await Notification.find({ userId: owner._id, 'metadata.complaintId': String(denyComplaint._id) }).lean();
      const denyMails = mailsTo(owner.email).slice(beforeDeny);
      // Der Verlaufseintrag muss WIRKLICH im Nachrichtenverlauf des Auftrags landen (frueher
      // CastError durch .toString() auf der auto-populierten orderId -> Angebot fehlte im Verlauf).
      const thread = await mongoose.model('InspectionCommunication').findOne({ orderId: denyOrder._id }).lean();
      const offerMessages = (thread?.messages || []).filter((m) => m.messageType === 'repair_offer' && m.metadata?.complaintId === String(denyComplaint._id));
      check(deny.status === 200 && offerMessages.length === 1 && /49,90/.test(offerMessages[0].content || ''),
        'Angebot: Eintrag im Nachrichtenverlauf des Auftrags (kein CastError mehr)', `${deny.status} ${offerMessages.length} ${offerMessages[0]?.content || ''}`);
      check(deny.status === 200 && denyNotifs.length === 1 && /abgelehnt/.test(denyNotifs[0].message || ''), 'Angebot: genau EINE Kundenbenachrichtigung (Verlauf benachrichtigt nicht zusaetzlich)', `${deny.status} ${denyNotifs.map((n) => `${n.title}: ${n.message}`).join(' | ')}`);
      check(denyMails.length === 1, 'Angebot: genau EINE E-Mail (Verlauf + Reklamation zusammen)', denyMails.map((m) => m.subject).join(' | '));
      check(deny.body?.customerNotification?.inApp === 'created' && deny.body?.customerNotification?.email === 'sent', 'Angebot: Antwort meldet das Benachrichtigungsergebnis', JSON.stringify(deny.body?.customerNotification));
    });

    // =================================================================================
    await section('[E] Zaehler/Kategorien aus der DB, Limit, alle gelesen, Linkabbildung', async () => {
      const counter = await User.create({ name: 'Zaehl Kunde', email: 'notify-counter@test.invalid', role: 'customer' });
      const docs = [];
      for (let i = 0; i < 130; i += 1) {
        const isInvoice = i < 10;
        const isComplaint = i >= 10 && i < 15;
        docs.push({
          userId: counter._id,
          title: isInvoice ? 'Neue Rechnung' : `Update ${i}`,
          message: `Nachricht ${i}`,
          type: isInvoice ? 'system' : (i % 2 ? 'message' : 'order_update'),
          isRead: i >= 40,
          metadata: isInvoice ? { isInvoice: true, invoiceId: `inv${i}` } : (isComplaint ? { complaintId: String(new mongoose.Types.ObjectId()) } : {}),
          createdAt: new Date(Date.now() - i * 60000),
        });
      }
      await Notification.insertMany(docs);
      const first = await call('GET', '/api/notifications?limit=100', counter);
      check(first.status === 200 && first.body?.totalCount === 130 && first.body?.unreadCount === 40 && first.body?.notifications?.length === 100,
        'Zaehler aus der DB (nicht aus den geladenen 100)', `${first.body?.totalCount} ${first.body?.unreadCount} ${first.body?.notifications?.length}`);
      const counts = first.body?.countsByCategory || {};
      check(counts.payment === 10 && counts.complaint === 5 && (counts.payment + counts.complaint + counts.message + counts.order) === 130,
        'Kategorien: Rechnungen unter Zahlungen, Reklamationen eigene Kategorie', JSON.stringify(counts));
      check(first.body?.hasMore === true, 'hasMore bei weiteren Eintraegen', first.body?.hasMore);
      const big = await call('GET', '/api/notifications?limit=5000', counter);
      check(big.body?.notifications?.length === 130 && big.body?.limit === 200, 'Limit nach oben begrenzt (200)', `${big.body?.notifications?.length} ${big.body?.limit}`);
      const readAll = await call('PUT', '/api/notifications/read-all', counter);
      const afterRead = await call('GET', '/api/notifications?limit=1', counter);
      check(readAll.status === 200 && afterRead.body?.unreadCount === 0, 'alle gelesen -> unreadCount 0', afterRead.body?.unreadCount);

      const orderId = new mongoose.Types.ObjectId();
      const complaintId = new mongoose.Types.ObjectId();
      await Notification.insertMany([
        { userId: counter._id, title: 'Rechnung', message: 'x', type: 'system', actionUrl: '/customer/invoices', metadata: { isInvoice: true, invoiceId: 'INV1' } },
        { userId: counter._id, title: 'Teil', message: 'x', type: 'system', actionUrl: `/admin/orders/${orderId}` },
        { userId: counter._id, title: 'Rekla', message: 'x', type: 'message', actionUrl: '/my-complaints', metadata: { complaintId: String(complaintId) } },
        { userId: admin._id, title: 'Rekla Admin', message: 'x', type: 'message', actionUrl: '/my-complaints', metadata: { complaintId: String(complaintId) } },
      ]);
      const mapped = await call('GET', '/api/notifications?limit=5', counter);
      const byTitle = (title, list) => (list || []).find((n) => n.title === title);
      check(byTitle('Rechnung', mapped.body?.notifications)?.actionUrl === '/invoices?invoiceId=INV1', 'tote Route /customer/invoices -> /invoices?invoiceId=', byTitle('Rechnung', mapped.body?.notifications)?.actionUrl);
      check(byTitle('Teil', mapped.body?.notifications)?.actionUrl === `/orders/${orderId}`, 'tote Route /admin/orders/:id -> /orders/:id', byTitle('Teil', mapped.body?.notifications)?.actionUrl);
      check(byTitle('Rekla', mapped.body?.notifications)?.actionUrl === `/my-complaints/${complaintId}`, 'Liste /my-complaints -> Reklamation (Kunde)', byTitle('Rekla', mapped.body?.notifications)?.actionUrl);
      const adminMapped = await call('GET', '/api/notifications?limit=50', admin);
      check(byTitle('Rekla Admin', adminMapped.body?.notifications)?.actionUrl === `/admin/complaints?complaintId=${complaintId}`, 'gleiche Altdaten fuer Admin -> Admin-Reklamationsseite', byTitle('Rekla Admin', adminMapped.body?.notifications)?.actionUrl);
      const foreignRead = await call('PUT', `/api/notifications/${(await Notification.findOne({ userId: counter._id }))._id}/read`, stranger);
      check(foreignRead.status === 404, 'fremde Benachrichtigung als gelesen markieren: 404', foreignRead.status);

      // Verschachtelte Data-URIs in Metadaten werden beim Lesen ebenfalls entfernt (DB unveraendert).
      const nested = await Notification.create({ userId: counter._id, title: 'Verschachtelt', message: 'x', type: 'system', metadata: { extra: { file: PDF_DATA_URI, keep: 'ja', list: [PDF_DATA_URI, 'b'] } } });
      const nestedRead = await call('GET', '/api/notifications?limit=50', counter);
      const nestedItem = byTitle('Verschachtelt', nestedRead.body?.notifications);
      const nestedStored = await Notification.findById(nested._id).lean();
      check(nestedItem && !JSON.stringify(nestedItem).includes('base64') && nestedItem.metadata?.extra?.keep === 'ja' && nestedItem.metadata?.extra?.list?.length === 1
        && nestedStored.metadata.extra.file === PDF_DATA_URI,
        'verschachtelte Data-URI beim Lesen entfernt, DB unveraendert', JSON.stringify(nestedItem?.metadata));
    });

    // =================================================================================
    await section('[F] E-Mail-Ergebnis zurueckgeben/speichern, dedupeKey', async () => {
      const originalSendTemplate = EmailService.sendTemplateEmail;
      EmailService.sendTemplateEmail = async () => ({ success: false, error: 'Vorlage deaktiviert (Test)' });
      let result;
      try {
        result = await NotificationService.createNotification({ userId: owner._id, title: 'Test', message: 'Bitte prüfen', type: 'message' }, { returnResult: true });
      } finally {
        EmailService.sendTemplateEmail = originalSendTemplate;
      }
      const storedFailed = await Notification.findById(result?.notification?._id).lean();
      check(result?.emailDelivery?.status === 'failed' && /deaktiviert/.test(result?.emailDelivery?.error || ''), 'Ergebnis meldet E-Mail-Fehler (statt still zu schlucken)', JSON.stringify(result?.emailDelivery));
      check(storedFailed?.metadata?.emailDelivery?.status === 'failed', 'E-Mail-Fehler an der Benachrichtigung gespeichert', JSON.stringify(storedFailed?.metadata?.emailDelivery));
      const legacyReturn = await NotificationService.createNotification({ userId: staff._id, title: 'Kompat', message: 'x', type: 'system' });
      check(legacyReturn && legacyReturn._id && legacyReturn.title === 'Kompat', 'ohne returnResult: Rueckgabe wie bisher (Dokument)', typeof legacyReturn);

      const key = `test:${new mongoose.Types.ObjectId()}:event`;
      const [one, two] = await Promise.all([
        NotificationService.createNotification({ userId: owner._id, title: 'Einmal', message: 'x', type: 'order_update', dedupeKey: key }, { returnResult: true, sendEmail: false }),
        NotificationService.createNotification({ userId: owner._id, title: 'Einmal', message: 'x', type: 'order_update', dedupeKey: key }, { returnResult: true, sendEmail: false }),
      ]);
      const three = await NotificationService.createNotification({ userId: owner._id, title: 'Einmal', message: 'x', type: 'order_update', dedupeKey: key }, { returnResult: true, sendEmail: false });
      const countKey = await Notification.countDocuments({ userId: owner._id, dedupeKey: key });
      check(countKey === 1 && [one, two].filter((r) => r.deduplicated).length === 1 && three.deduplicated === true, 'gleichzeitig + wiederholt: genau EINE Benachrichtigung', `${countKey} ${one.deduplicated} ${two.deduplicated} ${three.deduplicated}`);
      const otherUser = await NotificationService.createNotification({ userId: stranger._id, title: 'Einmal', message: 'x', type: 'order_update', dedupeKey: key }, { returnResult: true, sendEmail: false });
      check(otherUser.deduplicated === false, 'gleicher Schluessel, anderer Empfaenger: eigene Benachrichtigung', otherUser.deduplicated);
      const withoutKey = await Notification.insertMany([{ userId: owner._id, title: 'a', message: 'a', type: 'system' }, { userId: owner._id, title: 'b', message: 'b', type: 'system' }]);
      check(withoutKey.length === 2, 'Benachrichtigungen ohne Schluessel unbeschraenkt (partieller Index)', withoutKey.length);

      // In-App beim Empfaenger abgeschaltet (nur E-Mail): der Schluessel muss trotzdem greifen,
      // sonst ginge jede Wiederholung erneut per E-Mail hinaus.
      const pushOff = await User.create({ name: 'Ohne InApp', email: 'notify-pushoff@test.invalid', role: 'customer', preferences: { notifications: { push: false } } });
      const pushKey = `test:${new mongoose.Types.ObjectId()}:email_only`;
      const pushMailsBefore = mailsTo(pushOff.email).length;
      const emailOnly = () => NotificationService.createNotification({ userId: pushOff._id, title: 'Nur E-Mail', message: 'Einmalige Information', type: 'message', dedupeKey: pushKey }, { returnResult: true, forceEmail: true });
      const [p1, p2] = await Promise.all([emailOnly(), emailOnly()]);
      const p3 = await emailOnly();
      const pushMails = mailsTo(pushOff.email).length - pushMailsBefore;
      const pushRows = await Notification.countDocuments({ userId: pushOff._id });
      check(pushMails === 1 && pushRows === 0 && [p1, p2].filter((r) => r.deduplicated).length === 1 && p3.deduplicated === true,
        'In-App aus: gleicher Schluessel (gleichzeitig + wiederholt) -> genau EINE E-Mail, keine In-App-Zeile', `mails=${pushMails} rows=${pushRows} ${p1.deduplicated} ${p2.deduplicated} ${p3.deduplicated}`);
      const otherKey = await NotificationService.createNotification({ userId: pushOff._id, title: 'Nur E-Mail', message: 'Andere Information', type: 'message', dedupeKey: `${pushKey}:2` }, { returnResult: true, forceEmail: true });
      check(otherKey.deduplicated === false && otherKey.emailDelivery?.status === 'sent', 'In-App aus: anderer Schluessel wird gesendet', JSON.stringify(otherKey.emailDelivery));
    });

    // =================================================================================
    await section('[G] SMTP-Ergebnis und Wiederholungen', async () => {
      const calls = [];
      const makeTransporter = (behaviour) => ({ sendMail: async (options) => { calls.push(options); return behaviour(calls.length, options); } });
      const send = () => EmailService.sendTemplateEmail('Allgemeine Systemnachricht', 'smtp-test@test.invalid', {
        companyName: 'McRepair.de', customerName: 'Test', notificationTitle: 'T', notificationPreview: 'P', notificationTopic: 'X',
        notificationBody: 'B', notificationDate: '01.10.2026', effectiveDate: '01.10.2026', ctaLabel: 'Ö', ctaUrl: 'http://test.invalid/x',
        supportEmail: 'support@test.invalid', supportPhone: '0',
      }, { logContext: { trigger: 'system_notification', entityType: 'order', entityId: 'abc', reference: 'Auftrag ORD-T' } });
      const lastRecord = () => EmailService.deliveryTracker.deliveryLog[EmailService.deliveryTracker.deliveryLog.length - 1];

      try {
        transporterOverride = makeTransporter(() => ({ messageId: '<x@test>', accepted: [], rejected: ['smtp-test@test.invalid'] }));
        const rejected = await send();
        check(rejected.success === false && lastRecord().status === 'failed' && (lastRecord().metadata.rejectedRecipients || []).includes('smtp-test@test.invalid'),
          'alle Empfaenger abgelehnt -> fehlgeschlagen (nicht "gesendet")', `${rejected.success} ${lastRecord().status} ${rejected.error}`);

        calls.length = 0;
        transporterOverride = makeTransporter(() => { const error = new Error('Timeout'); error.code = 'ETIMEDOUT'; error.command = 'DATA'; throw error; });
        const timeout = await send();
        check(timeout.success === false && calls.length === 1, 'Timeout nach DATA: KEINE Wiederholung (keine Doppel-E-Mail)', calls.length);
        check(lastRecord().attempts === 1, 'Protokoll zaehlt den EINEN echten Versuch (nicht 3)', lastRecord().attempts);

        calls.length = 0;
        transporterOverride = makeTransporter((n) => {
          if (n === 1) { const error = new Error('connect ECONNREFUSED'); error.code = 'ECONNREFUSED'; error.command = 'CONN'; throw error; }
          return { messageId: calls[n - 1].messageId, accepted: ['smtp-test@test.invalid'], rejected: [] };
        });
        const retried = await send();
        check(retried.success === true && calls.length === 2 && calls[0].messageId && calls[0].messageId === calls[1].messageId,
          'Verbindungsfehler: Wiederholung mit derselben Message-ID', `${calls.length} ${calls[0]?.messageId} ${calls[1]?.messageId}`);
        check(lastRecord().status === 'sent' && lastRecord().metadata.logContext?.reference === 'Auftrag ORD-T', 'Protokoll: angenommen + Bezug', JSON.stringify(lastRecord().metadata.logContext));

        // Echte nodemailer-Formen: jeder Socket-Fehler traegt command 'CONN', auch nach DATA.
        // Leerlauf-Timeout / Abbruch / Reset nach Uebergabe => KEINE Wiederholung (sonst Doppel-E-Mail).
        const nodemailerError = (message, code, extra = {}) => Object.assign(new Error(message), { code, command: 'CONN' }, extra);
        for (const [label, make] of [
          ['Leerlauf-Timeout (ETIMEDOUT "Timeout")', () => nodemailerError('Timeout', 'ETIMEDOUT')],
          ['Verbindung unerwartet geschlossen (ECONNECTION)', () => nodemailerError('Connection closed unexpectedly', 'ECONNECTION')],
          ['Socket-Reset beim Lesen (ESOCKET, syscall read)', () => nodemailerError('read ECONNRESET', 'ESOCKET', { syscall: 'read' })],
        ]) {
          calls.length = 0;
          transporterOverride = makeTransporter(() => { throw make(); });
          const result = await send();
          check(result.success === false && calls.length === 1, `${label}: keine Wiederholung`, calls.length);
        }
        // Verbindungsphase (vor jeder Uebergabe) => Wiederholung erlaubt.
        for (const [label, make] of [
          ['Verbindungsaufbau abgelehnt (ESOCKET, syscall connect)', () => nodemailerError('connect ECONNREFUSED 127.0.0.1:25', 'ESOCKET', { syscall: 'connect' })],
          ['Verbindungs-Timeout (ETIMEDOUT "Connection timeout")', () => nodemailerError('Connection timeout', 'ETIMEDOUT')],
          ['DNS-Fehler (EDNS)', () => nodemailerError('getaddrinfo ENOTFOUND smtp.invalid', 'EDNS')],
        ]) {
          calls.length = 0;
          transporterOverride = makeTransporter((n) => {
            if (n === 1) throw make();
            return { messageId: calls[n - 1].messageId, accepted: ['smtp-test@test.invalid'], rejected: [] };
          });
          const result = await send();
          check(result.success === true && calls.length === 2, `${label}: eine Wiederholung, dann angenommen`, calls.length);
        }
      } finally {
        transporterOverride = null;
      }
    });

    // =================================================================================
    await section('[H] Eingangspruefung: Kundentexte, Test-Auffaelligkeiten, Defekt-Information, E-Mail-Betreff', async () => {
      const order = await newOrder(owner);
      const orderId = String(order._id);
      // customerId wie der echte Client (die Route faellt sonst auf den auto-populierten Kunden zurueck).
      const init = await call('POST', '/api/device-inspections/init', staff, { orderId, customerId: String(owner._id) });
      check(init.status === 200, 'Personal startet die Eingangspruefung', `${init.status} ${init.body?.error || ''}`);
      const forbidden = await call('POST', '/api/device-inspections/init', owner, { orderId });
      check(forbidden.status === 403, 'Kunde darf keine Pruefung starten', forbidden.status);
      const startNotif = await Notification.findOne({ userId: owner._id, orderId: order._id, type: 'order_update', 'metadata.orderStatusEvent': 'diagnostic-assessment' }).lean()
        || await Notification.findOne({ userId: owner._id, orderId: order._id, message: /Eingangsprüfung/ }).lean();
      check(startNotif && /Eingangsprüfung/.test(startNotif.message) && !/initiated|Device inspection/i.test(startNotif.message),
        'Start: deutscher Kundentext ohne englische Technik-Notiz', startNotif?.message);

      const tests = { charging: { status: 'OK' }, power: { status: 'OK' }, wifi: { status: 'Not OK', notes: 'WLAN findet keine Netze' }, frontCamera: { status: 'OK' }, mainCamera: { status: 'OK' } };
      const t1 = await call('PUT', `/api/device-inspections/${orderId}/device-tests`, staff, tests);
      const t2 = await call('PUT', `/api/device-inspections/${orderId}/device-tests`, staff, tests);
      const failedNotifs = await Notification.find({ userId: owner._id, title: 'Auffälligkeiten beim Gerätetest' }).lean();
      check(t1.status === 200 && t2.status === 200 && failedNotifs.length === 1 && String(failedNotifs[0].orderId) === orderId && failedNotifs[0].type === 'order_update',
        'Test-Auffaelligkeit: gueltige Benachrichtigung (einmal, mit Auftrag)', `${failedNotifs.length} ${failedNotifs[0]?.type} ${failedNotifs[0]?.actionUrl}`);

      const mailsBefore = mailsTo(owner.email).length;
      const complete = await call('PUT', `/api/device-inspections/${orderId}/complete`, staff, {
        customerInformation: { shouldInform: true, reason: 'Akku', note: 'INTERN-123 Verdacht auf Powerchip', customerMessage: 'Bitte geben Sie uns Rückmeldung zum Akku.' },
      });
      await sleep(1500);
      const defect = await Notification.find({ userId: owner._id, 'metadata.event': 'customer_defect_info' }).lean();
      check(complete.status === 200 && defect.length === 1 && defect[0].title === 'Information zu einem Defekt an Ihrem Gerät'
        && /Rückmeldung zum Akku/.test(defect[0].message) && !/INTERN-123|Kunde ueber/.test(`${defect[0].title} ${defect[0].message}`),
        'Defekt-Information: Kundentext, nie die interne Notiz', `${defect.length} ${defect[0]?.title} :: ${defect[0]?.message}`);
      const inspectionMails = mailsTo(owner.email).slice(mailsBefore);
      const inspectionMail = inspectionMails.find((m) => /Eingangsprüfung/.test(m.subject || ''));
      check(Boolean(inspectionMail) && !inspectionMails.some((m) => /^Diagnose abgeschlossen/.test(m.subject || '')),
        'E-Mail nach Abschluss: Betreff "Eingangsprüfung", nicht "Diagnose abgeschlossen"', inspectionMails.map((m) => m.subject).join(' | '));
      check(!inspectionMails.some((m) => /INTERN-123/.test(`${m.subject} ${m.html} ${m.text}`)), 'keine E-Mail enthaelt die interne Notiz', inspectionMails.length);

      const again = await call('PUT', `/api/device-inspections/${orderId}/complete`, staff, {
        customerInformation: { shouldInform: true, note: 'x', customerMessage: 'Bitte geben Sie uns Rückmeldung zum Akku.' },
      });
      await sleep(800);
      const defectAgain = await Notification.countDocuments({ userId: owner._id, 'metadata.event': 'customer_defect_info' });
      const secondInspectionMails = mailsTo(owner.email).slice(mailsBefore).filter((m) => /Eingangsprüfung/.test(m.subject || '')).length;
      check(again.status === 200 && defectAgain === 1 && secondInspectionMails === 1, 'erneuter Abschluss: keine zweite Defekt-Information, keine zweite Abschluss-E-Mail', `${defectAgain} ${secondInspectionMails}`);
      check(complete.body?.customerNotification?.status === 'sent' && again.body?.customerNotification?.status === 'duplicate',
        'Abschluss meldet die Kundeninformation getrennt (gesendet / bereits gesendet)', `${JSON.stringify(complete.body?.customerNotification)} ${JSON.stringify(again.body?.customerNotification)}`);
      check(Boolean(again.body?.inspection?.customerInformation?.sentAt), 'Zeitpunkt der Kundeninformation bleibt nach erneutem Abschluss erhalten', again.body?.inspection?.customerInformation?.sentAt);

      // K04: die interne Notiz erreicht den Kunden auch nicht ueber GET /api/device-inspections/:orderId.
      const customerView = await call('GET', `/api/device-inspections/${orderId}`, owner);
      const staffView = await call('GET', `/api/device-inspections/${orderId}`, staff);
      const strangerView = await call('GET', `/api/device-inspections/${orderId}`, stranger);
      check(customerView.status === 200 && !/INTERN-123|Verdacht auf Powerchip/.test(customerView.raw) && customerView.body?.inspection?.customerInformation && !('note' in customerView.body.inspection.customerInformation) && !('mailTemplate' in customerView.body.inspection.customerInformation) && customerView.body?.inspection?.customerInformation?.customerMessage === 'Bitte geben Sie uns Rückmeldung zum Akku.',
        'Kunde liest die Inspektion ohne interne Notiz (nur Kundentext)', `${customerView.status} ${JSON.stringify(customerView.body?.inspection?.customerInformation)}`);
      check(staffView.status === 200 && staffView.body?.inspection?.customerInformation?.note === 'x', 'Personal sieht die interne Notiz weiterhin', staffView.body?.inspection?.customerInformation?.note);
      check(strangerView.status === 403, 'fremder Kunde: 403', strangerView.status);

      // Kunde mit abgeschalteter In-App-Benachrichtigung: erneutes Abschliessen sendet KEINE zweite E-Mail.
      const pushOffCustomer = await User.create({ name: 'Ohne InApp Kunde', email: 'notify-pushoff-insp@test.invalid', role: 'customer', preferences: { notifications: { push: false } } });
      const order3 = await newOrder(pushOffCustomer);
      await call('POST', '/api/device-inspections/init', staff, { orderId: String(order3._id), customerId: String(pushOffCustomer._id) });
      const defectText = 'Bitte prüfen Sie Ihre Rückmeldung zum Display (Kunde ohne In-App).';
      const pushOffBefore = mailsTo(pushOffCustomer.email).length;
      const c1 = await call('PUT', `/api/device-inspections/${order3._id}/complete`, staff, { customerInformation: { shouldInform: true, note: 'INTERN-PO', customerMessage: defectText } });
      const c2 = await call('PUT', `/api/device-inspections/${order3._id}/complete`, staff, { customerInformation: { shouldInform: true, note: 'INTERN-PO', customerMessage: defectText } });
      await sleep(800);
      const pushOffDefectMails = mailsTo(pushOffCustomer.email).slice(pushOffBefore).filter((m) => String(m.html || m.text || '').includes('Rückmeldung zum Display'));
      check(c1.body?.customerNotification?.status === 'sent' && c2.body?.customerNotification?.status === 'duplicate' && pushOffDefectMails.length === 1,
        'In-App aus: Defekt-Information genau EINMAL per E-Mail, auch bei erneutem Abschluss', `${c1.body?.customerNotification?.status} ${c2.body?.customerNotification?.status} mails=${pushOffDefectMails.length}`);

      const order2 = await newOrder(owner);
      await call('POST', '/api/device-inspections/init', staff, { orderId: String(order2._id), customerId: String(owner._id) });
      const noInform = await call('PUT', `/api/device-inspections/${order2._id}/complete`, staff, {
        customerInformation: { shouldInform: false, note: 'INTERN-456', customerMessage: 'Sollte nicht gesendet werden' },
      });
      const legacyNoMessage = await call('PUT', `/api/device-inspections/${order2._id}/complete`, staff, {
        customerInformation: { shouldInform: true, note: 'INTERN-789 nur Notiz' },
      });
      await sleep(500);
      const defect2 = await Notification.countDocuments({ userId: owner._id, orderId: order2._id, 'metadata.event': 'customer_defect_info' });
      check(noInform.status === 200 && legacyNoMessage.status === 200 && defect2 === 0, 'ohne Haken bzw. ohne Kundentext: keine Kundeninformation (Notiz nie)', defect2);
    });
    // =================================================================================
    await section('[I] Oberflaeche (Quelltext): keine Platzhalter-/Rohschluessel, keine Data-URI-Links, keine toten Ziele', async () => {
      const CLIENT_SRC = path.join(ROOT, 'client/src');
      const files = ['pages/Notifications.tsx', 'components/NotificationBell.tsx', 'pages/CustomerComplaints.tsx', 'pages/admin/ComplaintsManagement.tsx', 'pages/admin/EmailAdministration.tsx'];
      const sources = Object.fromEntries(files.map((file) => [file, fs.readFileSync(path.join(CLIENT_SRC, file), 'utf8')]));
      const de = JSON.parse(fs.readFileSync(path.join(CLIENT_SRC, 'locales/de/translation.json'), 'utf8'));
      const resolve = (key) => key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), de);
      const missing = [];
      const placeholder = [];
      Object.entries(sources).forEach(([file, source]) => {
        const keys = [...source.matchAll(/\bt\('((?:notificationsPage|notifications|emailAdmin)\.[A-Za-z.]+)'/g)].map((m) => m[1]);
        keys.forEach((key) => {
          const value = resolve(key) ?? resolve(`${key}_other`);
          if (typeof value !== 'string') missing.push(`${file}:${key}`);
          else if (/(Placeholder|Subtitle|\bDesc\b|^Filter [A-ZÄÖÜ]|Caught Up|Will Appear|Nein |Csv |Smtp |Fehler beim To)/.test(value)) placeholder.push(`${key}=${value}`);
        });
      });
      check(missing.length === 0, 'jeder verwendete Schluessel existiert in de (auch Plural)', missing.join(', ') || 'ok');
      check(placeholder.length === 0, 'keine automatisch erzeugten Platzhaltertexte', placeholder.join(' | ') || 'ok');
      const all = Object.values(sources).join('\n');
      check(!/href=\{[^}]*shippingLabelUrl/.test(all) && !/\{selectedComplaint\.shippingLabelUrl\}/.test(all), 'kein Label als data:-Link oder Linktext', 'ok');
      check(!/customer\/invoices/.test(all) && !/m ago|h ago|d ago/.test(all), 'keine tote Rechnungsroute, keine englischen Zeitangaben', 'ok');
      check(/Nachricht an Kunden senden/.test(sources['pages/admin/ComplaintsManagement.tsx']) && /Interne Notiz speichern/.test(sources['pages/admin/ComplaintsManagement.tsx'])
        && /Entwurf verwerfen/.test(sources['pages/admin/ComplaintsManagement.tsx']), 'Reklamations-Composer: zwei getrennte Aktionen + "Entwurf verwerfen"', 'ok');
      check(/complaintId/.test(sources['pages/admin/ComplaintsManagement.tsx']) && /URLSearchParams\(location\.search\)/.test(sources['pages/admin/ComplaintsManagement.tsx']),
        'Admin-Reklamationen lesen ?complaintId (Direktlink)', 'ok');
      // NOTIF-7: das Inspektionsformular schickt die interne Notiz nicht mehr selbst an den Kunden.
      const inspectionForm = fs.readFileSync(path.join(CLIENT_SRC, 'components/inspection/DeviceInspectionForm.tsx'), 'utf8');
      check(!/createQuickAction\s*\(/.test(inspectionForm) && /customerMessage/.test(inspectionForm) && !/Mail-Vorlage/.test(inspectionForm)
        && /Nachricht an Kunden/.test(inspectionForm) && /Intern – nur für das Team/.test(inspectionForm),
        'Inspektion: kein eigener Kunden-Quick-Action-Aufruf, getrennte Felder "Nachricht an Kunden" / "Intern – nur für das Team"', 'ok');
    });

  } finally {
    server.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    fs.rmSync(LOG_REDIRECT_DIR, { recursive: true, force: true });
  }

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Testlauf abgebrochen:', error);
  process.exit(1);
});
