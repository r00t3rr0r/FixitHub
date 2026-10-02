/**
 * Regressionstest (Track workflow, Welle 2, 01.10.2026): Reparatur-Workflow, Template-Workflow,
 * Storno und Eingangspruefung schreiben den Auftragsverlauf und halten den Auftragsstatus ehrlich;
 * Kundenbenachrichtigungen aus dem Workflow werden wirklich erstellt - und enthalten nie Internes.
 *
 * Echte Express-Routen + echte DB (Wegwerf-mongod) + Rollen (Kunde, fremder Kunde, Staff, Admin, Gast).
 *   [A] HIST-11: Freigabe/Pause/Fortsetzen/Zwischenfall/Abschluss des Reparatur-Workflows synchronisieren
 *       den Auftragsstatus (in-progress/paused/ready-for-pickup, nie 'completed') und schreiben je EINEN
 *       Verlaufseintrag; paralleler Doppel-Abschluss -> ein Eintrag; fremde Pause wird nicht aufgehoben;
 *       Wiederaufnahme mit Grund, abgelehnt sobald ein Versandlabel existiert; Rollen 403.
 *   [B] NOTIF-5/NOTIF-6/COMMS-16: "Kunde benachrichtigen" AN -> In-App + E-Mail an den Kunden des
 *       Auftrags mit Kundentext, nie internalNotes/Grund/Notizen; AUS -> nichts; Pause sendet nichts;
 *       Gastauftrag -> E-Mail an guestInfo.email (ohne Adresse ehrlich "skipped"); Fehler -> 200 + getrennt
 *       gemeldet + Wiederholen genau einmal (auch parallel); Abschluss ohne Nachricht -> nachtraeglich informieren;
 *       keine rohen fetch-POSTs mehr im Techniker-Client.
 *   [C] HIST-12/HIST-17/HIST-2: Template-Workflow - Uebergangstabelle (abgeschlossen -> 409, Auftrag
 *       bleibt fertig), "Reparatur abgeschlossen" statt "Abholung", genau eine Kundennachricht,
 *       deutsche Eintraege; Schritt erneut oeffnen mit Grund, abgelehnt mit Versandlabel.
 *   [D] HIST-14: Storno nur mit Grund; laufende Workflows angehalten; Rechnungen/Zahlungen unberuehrt;
 *       kein Erstattungsversprechen.
 *   [E] HIST-10/HIST-5c/NOTIF-7: Eingangspruefung Start/Abschluss/Kostenvoranschlag im Verlauf (je
 *       einmal), Start-Fehler wird gemeldet und selbstheilend nachgeholt; interne Notiz/Grund nie beim Kunden.
 *   [F] HIST-13: Kunde reicht Entsperrdaten nach -> Auftrag wird mit Verlaufseintrag fortgesetzt.
 *
 * MOCKS: keine. E-Mails gehen an den Stream-Transport (EMAIL_TEST_TRANSPORT=stream) und werden mitgelesen;
 * DHL wird nicht aufgerufen (nur der lokale Versandstand). Datei-Logs werden aus dem Repository umgeleitet.
 * Aufruf (nur WEGWERF-Datenbank):
 *   EMAIL_TEST_TRANSPORT=stream TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_workflow_sync node test-workflow-order-sync.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const Module = require('module');

const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, 'server');
const LOG_DIR = path.join(SERVER_DIR, 'logs');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_workflow_sync';
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
const LOG_REDIRECT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-test-logs-'));
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
    console.log(`  FAIL Abschnitt brach ab :: ${error && error.stack ? error.stack.split('\n').slice(0, 5).join(' | ') : error}`);
  }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ENGLISH = /\b(completed in workflow|skipped in workflow|status changed from|Navigated back|Reason:|Not provided)\b/i;
const isGerman = (text) => typeof text === 'string' && text.length > 0 && !/\b(not found|already|failed|is not|Invalid)\b/i.test(text);

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
  await mongoose.model('Notification').createIndexes();
  await mongoose.model('NotificationDedupeClaim').createIndexes();

  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.buildSystemUrl = async (p) => `http://test.invalid${p}`;
  EmailService.retryHandler.baseDelay = 1;
  EmailService.retryHandler.maxBackoffDelay = 5;
  const captured = [];
  const realGetTransporter = EmailService.getTransporter.bind(EmailService);
  EmailService.getTransporter = async () => {
    const transporter = await realGetTransporter();
    if (!transporter.__captureWrapped) {
      const original = transporter.sendMail.bind(transporter);
      transporter.sendMail = async (options) => { captured.push(options); return original(options); };
      transporter.__captureWrapped = true;
    }
    return transporter;
  };
  const mailText = (mail) => `${mail.subject || ''}\n${mail.text || ''}\n${mail.html || ''}`;
  const mailsTo = (email) => captured.filter((mail) => String(mail.to).toLowerCase() === email.toLowerCase());

  const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));
  DHLService.getTrackingInfo = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };
  DHLService.createShipment = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };

  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  const OrderService = require(path.join(SERVER_DIR, 'services/orderService'));
  const RepairWorkflowService = require(path.join(SERVER_DIR, 'services/repairWorkflowService'));

  const app = express();
  app.use(express.json());
  app.use('/api/repair-workflows', require(path.join(SERVER_DIR, 'routes/repairWorkflowRoutes')));
  app.use('/api/admin/orders', require(path.join(SERVER_DIR, 'routes/adminOrderRoutes')));
  app.use('/api/orders', require(path.join(SERVER_DIR, 'routes/orderRoutes')));
  app.use('/api/device-inspections', require(path.join(SERVER_DIR, 'routes/deviceInspectionRoutes')));
  app.use('/api/inspection-communication', require(path.join(SERVER_DIR, 'routes/inspectionCommunicationRoutes')));
  app.use('/api/complaints', require(path.join(SERVER_DIR, 'routes/complaintRoutes')));
  const CommunicationInboxService = require(path.join(SERVER_DIR, 'services/communicationInboxService'));
  let cacheInvalidations = 0;
  const realInvalidate = CommunicationInboxService.invalidateSummaryCache.bind(CommunicationInboxService);
  CommunicationInboxService.invalidateSummaryCache = (...args) => { cacheInvalidations += 1; return realInvalidate(...args); };
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const RepairWorkflow = mongoose.model('RepairWorkflow');
  const Notification = mongoose.model('Notification');
  const Invoice = mongoose.model('Invoice');
  const Payment = mongoose.model('Payment');
  const DeviceInspection = mongoose.model('DeviceInspection');

  const customer = await User.create({ name: 'Klara Kunde', firstName: 'Klara', lastName: 'Kunde', email: 'wf-kunde@test.invalid', role: 'customer' });
  const stranger = await User.create({ name: 'Fremd Kunde', email: 'wf-fremd@test.invalid', role: 'customer' });
  const staff = await User.create({ name: 'Sophie Technik', firstName: 'Sophie', lastName: 'Technik', email: 'wf-staff@test.invalid', role: 'staff', isActive: true });
  const staff2 = await User.create({ name: 'Tom Technik', email: 'wf-staff2@test.invalid', role: 'staff', isActive: true });
  const admin = await User.create({ name: 'Anna Admin', email: 'wf-admin@test.invalid', role: 'admin', isActive: true });

  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, user, body) => {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await response.json(); } catch (error) { json = null; }
    return { status: response.status, body: json };
  };

  let counter = 0;
  const newOrder = async (extra = {}) => {
    counter += 1;
    return Order.create({
      customerId: customer._id,
      orderNumber: `ORD-WF-${String(counter).padStart(3, '0')}`,
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 15',
      deviceType: 'Smartphone',
      errorDescription: 'Display defekt',
      totalCost: 49.9,
      status: 'diagnostic-assessment',
      ...extra,
    });
  };
  const stored = async (id) => Order.findById(id).setOptions({ skipAutoPopulate: true }).lean();
  const entriesOf = async (id, key) => ((await stored(id)).timeline || []).filter((item) => item.status === key);
  const customerNotifications = async (filter = {}) => Notification.find({ userId: customer._id, ...filter }).sort({ createdAt: 1, _id: 1 }).lean();
  const anyText = (docs) => JSON.stringify(docs);

  const initAndApprove = async (order, body = { notifyCustomer: false }) => {
    await call('POST', `/api/repair-workflows/${order._id}/init`, staff, {});
    return call('POST', `/api/repair-workflows/${order._id}/approve`, staff, body);
  };

  try {
    // ------------------------------------------------------------------ [A]
    await section('[A] Reparatur-Workflow synchronisiert Auftragsstatus und Verlauf (HIST-11)', async () => {
      const order = await newOrder({ paymentStatus: 'pending' });
      const id = String(order._id);
      const invoicesBefore = await Invoice.countDocuments({});
      const paymentsBefore = await Payment.countDocuments({});

      const approve = await initAndApprove(order);
      check(approve.status === 200 && approve.body?.orderStatus === 'in-progress' && (await stored(id)).status === 'in-progress',
        'Freigabe: Auftrag Diagnosebewertung -> in Bearbeitung', `${approve.status} ${approve.body?.orderStatus}`);
      const started = await entriesOf(id, 'Repair Workflow Started');
      check(started.length === 1 && started[0].type === 'workflow' && started[0].refs?.repairWorkflowId && started[0].staffName === 'Sophie Technik',
        'Verlauf: "Reparatur gestartet" mit Bezug und echtem Akteur', `${started.length} ${started[0]?.staffName}`);
      const statusEntry = (await entriesOf(id, 'Order Status Updated')).pop();
      check(statusEntry?.source === 'Reparatur-Workflow' && statusEntry?.changes?.[0]?.from === 'diagnostic-assessment' && statusEntry?.changes?.[0]?.to === 'in-progress',
        'Statuseintrag: Quelle Reparatur-Workflow, ehrliches von/nach', `${statusEntry?.source} ${statusEntry?.changes?.[0]?.from}->${statusEntry?.changes?.[0]?.to}`);

      const pause = await call('POST', `/api/repair-workflows/${id}/pause`, staff, { pauseReason: 'INTERN-PAUSE-1 Teil holen' });
      check(pause.status === 200 && (await stored(id)).status === 'paused', 'Pause: Auftrag pausiert', `${pause.status} ${(await stored(id)).status}`);
      await sleep(5);
      const resume = await call('POST', `/api/repair-workflows/${id}/resume`, staff2, {});
      check(resume.status === 200 && (await stored(id)).status === 'in-progress', 'Fortsetzen: Auftrag wieder in Bearbeitung', `${resume.status} ${(await stored(id)).status}`);
      const incident = await call('POST', `/api/repair-workflows/${id}/incidents`, staff, { incidentType: 'needs_time', reason: 'INTERN-ZWISCHENFALL', additionalData: { timeHours: 2 } });
      check(incident.status === 200 && (await stored(id)).status === 'paused', 'Zwischenfall: Auftrag pausiert mit Grund', `${incident.status} ${(await stored(id)).status}`);
      const incidentEntry = (await entriesOf(id, 'Repair Workflow Incident'))[0];
      check(incidentEntry?.reason === 'INTERN-ZWISCHENFALL' && incidentEntry?.visibility === 'staff', 'Zwischenfall-Eintrag: Grund nur intern', `${incidentEntry?.reason} ${incidentEntry?.visibility}`);
      await sleep(5);
      await call('POST', `/api/repair-workflows/${id}/resume`, staff, {});
      const noIncidentReason = await call('POST', `/api/repair-workflows/${id}/incidents`, staff, { incidentType: 'needs_time', reason: '  ' });
      check(noIncidentReason.status === 400 && isGerman(noIncidentReason.body?.message), 'Zwischenfall ohne Beschreibung -> 400 deutsch', `${noIncidentReason.status} ${noIncidentReason.body?.message}`);

      const complete = await call('POST', `/api/repair-workflows/${id}/complete`, staff, {});
      const afterComplete = await stored(id);
      check(complete.status === 200 && afterComplete.status === 'ready-for-pickup' && complete.body?.orderStatus === 'ready-for-pickup',
        'Abschluss: Auftrag "Reparatur abgeschlossen" (ready-for-pickup), nicht completed', `${complete.status} ${afterComplete.status}`);
      check(Boolean(afterComplete.actualCompletion) && afterComplete.paymentStatus === 'pending', 'Fertigstellungszeit gesetzt, Zahlungsstatus unveraendert', `${afterComplete.actualCompletion} ${afterComplete.paymentStatus}`);
      check(await Invoice.countDocuments({}) === invoicesBefore && await Payment.countDocuments({}) === paymentsBefore, 'keine Rechnung/Zahlung angelegt oder geaendert', `${invoicesBefore}/${paymentsBefore}`);
      const counts = {};
      afterComplete.timeline.forEach((item) => { counts[item.status] = (counts[item.status] || 0) + 1; });
      check(counts['Repair Workflow Started'] === 1 && counts['Repair Workflow Paused'] === 1 && counts['Repair Workflow Resumed'] === 2
        && counts['Repair Workflow Incident'] === 1 && counts['Repair Workflow Completed'] === 1,
      'je Zustandswechsel genau ein Verlaufseintrag', JSON.stringify(counts));

      const shipments = await call('GET', `/api/orders/${id}/shipments`, staff);
      check(shipments.status === 200 && shipments.body?.shipments?.outboundAction?.allowed === true, 'Auslieferung jetzt moeglich (keine manuelle Statusaenderung noetig)',
        `${shipments.status} ${shipments.body?.shipments?.outboundAction?.code}`);

      const staffHistory = await call('GET', `/api/orders/${id}/history?limit=300`, admin);
      const historyEntries = staffHistory.body?.entries || staffHistory.body?.history || [];
      const completedRows = historyEntries.filter((item) => item.key === 'Repair Workflow Completed');
      const manualPauseRows = historyEntries.filter((item) => item.key === 'Repair Workflow Paused' && /INTERN-PAUSE-1/.test(item.reason || ''));
      check(staffHistory.status === 200 && completedRows.length === 1 && manualPauseRows.length === 1, 'GET /history (Personal): keine Doppeleintraege aus der Leseprojektion',
        `${staffHistory.status} completed=${completedRows.length} pause=${manualPauseRows.length}`);
      const customerHistory = await call('GET', `/api/orders/${id}/history`, customer);
      const customerJson = JSON.stringify(customerHistory.body || {});
      check(customerHistory.status === 200 && /Reparatur abgeschlossen/.test(customerJson) && !/INTERN-|Sophie|Tom Technik/.test(customerJson),
        'Kundensicht: "Reparatur abgeschlossen", keine Gruende/Namen', `${customerHistory.status} ${customerJson.slice(0, 120)}`);
      const strangerHistory = await call('GET', `/api/orders/${id}/history`, stranger);
      check(strangerHistory.status === 403, 'fremder Kunde: 403', strangerHistory.status);

      // Rollen
      const customerReopen = await call('POST', `/api/repair-workflows/${id}/reopen`, customer, { reason: 'x' });
      const customerSync = await call('POST', `/api/repair-workflows/${id}/sync-order`, customer, {});
      const customerNotify = await call('POST', `/api/repair-workflows/${id}/notify-customer`, customer, { target: 'completion' });
      check(customerReopen.status === 403 && customerSync.status === 403 && customerNotify.status === 403, 'Kunde: reopen/sync/notify 403',
        `${customerReopen.status} ${customerSync.status} ${customerNotify.status}`);

      // Wiederaufnahme
      const noReason = await call('POST', `/api/repair-workflows/${id}/reopen`, staff, {});
      check(noReason.status === 400 && isGerman(noReason.body?.message), 'Wiederaufnahme ohne Grund -> 400 deutsch', `${noReason.status} ${noReason.body?.message}`);
      const pausedBefore = (await RepairWorkflow.findOne({ orderId: id }).lean()).timerData.totalPausedMs;
      await sleep(20);
      const reopen = await call('POST', `/api/repair-workflows/${id}/reopen`, staff, { reason: 'Akku erneut prüfen' });
      const reopenedWf = await RepairWorkflow.findOne({ orderId: id }).lean();
      check(reopen.status === 200 && reopenedWf.status === 'in-progress' && (await stored(id)).status === 'in-progress',
        'Wiederaufnahme: Workflow und Auftrag wieder in Bearbeitung (ohne Schein-Pause)', `${reopen.status} ${reopenedWf.status} ${(await stored(id)).status}`);
      check(reopenedWf.timerData.totalPausedMs > pausedBefore && !reopenedWf.timerData.completedAt && reopenedWf.reopenHistory?.length === 1,
        'Zeit zwischen Abschluss und Wiederaufnahme zaehlt als Pause, nicht als Arbeit', `${pausedBefore} -> ${reopenedWf.timerData.totalPausedMs}`);
      const reopenEntry = (await entriesOf(id, 'Repair Workflow Reopened'))[0];
      check(reopenEntry?.reason === 'Akku erneut prüfen', 'Verlauf: Wiederaufnahme mit Grund', reopenEntry?.reason);
      const entriesBeforeSync = (await stored(id)).timeline.length;
      const sync = await call('POST', `/api/repair-workflows/${id}/sync-order`, staff, {});
      check(sync.status === 200 && (await stored(id)).timeline.length === entriesBeforeSync && (sync.body?.warnings || []).length === 0,
        'erneuter Abgleich ist idempotent', `${sync.status} ${entriesBeforeSync} -> ${(await stored(id)).timeline.length}`);

      await call('POST', `/api/repair-workflows/${id}/complete`, staff, {});
      await Order.collection.updateOne({ _id: order._id }, { $set: { shippingLabelUrl: 'data:application/pdf;base64,JVBERg==', trackingNumber: '00340434161094015999' } });
      const blocked = await call('POST', `/api/repair-workflows/${id}/reopen`, staff, { reason: 'zu spät' });
      check(blocked.status === 409 && /Versand/.test(blocked.body?.message || '') && (await stored(id)).status === 'ready-for-pickup',
        'Wiederaufnahme mit Versandlabel -> 409, Auftrag bleibt fertig', `${blocked.status} ${blocked.body?.message}`);
    });

    await section('[A2] Paralleler Doppel-Abschluss und fremde Pause', async () => {
      const order = await newOrder();
      const id = String(order._id);
      await initAndApprove(order);
      const [c1, c2] = await Promise.all([
        call('POST', `/api/repair-workflows/${id}/complete`, staff, {}),
        call('POST', `/api/repair-workflows/${id}/complete`, staff2, {}),
      ]);
      const statuses = [c1.status, c2.status].sort().join(',');
      const completedEntries = await entriesOf(id, 'Repair Workflow Completed');
      const statusToReady = (await entriesOf(id, 'Order Status Updated')).filter((item) => item.changes?.[0]?.to === 'ready-for-pickup');
      check(statuses === '200,409' && completedEntries.length === 1 && statusToReady.length === 1, 'parallel abschliessen: genau ein Abschluss- und ein Statuseintrag',
        `${statuses} ${completedEntries.length} ${statusToReady.length}`);

      // Fremde Pause ("Rückmeldung des Kunden erwartet") wird durch "Fortsetzen" nicht aufgehoben.
      const order2 = await newOrder({ status: 'in-progress', unlockCode: '1234' });
      const id2 = String(order2._id);
      await initAndApprove(order2);
      const request = await call('POST', `/api/admin/orders/${id2}/request-unlock-update`, staff, {});
      check(request.status === 200 && (await stored(id2)).status === 'paused', 'Entsperrdaten angefordert: Auftrag pausiert', `${request.status} ${(await stored(id2)).status}`);
      await call('POST', `/api/repair-workflows/${id2}/pause`, staff, { pauseReason: 'Warten' });
      await sleep(5);
      await call('POST', `/api/repair-workflows/${id2}/resume`, staff, {});
      check((await stored(id2)).status === 'paused', 'Workflow fortgesetzt, fremde Pause bleibt bestehen', (await stored(id2)).status);

      // [F] HIST-13: der Kunde reicht neue Entsperrdaten nach -> Fortsetzung mit Eintrag
      const unlock = await call('POST', `/api/inspection-communication/${id2}/update-unlock-info`, customer, { unlockCode: '5678' });
      const resumedEntries = await entriesOf(id2, 'Order Resumed');
      check(unlock.status === 200 && (await stored(id2)).status === 'in-progress' && resumedEntries.length === 1 && resumedEntries[0].source === 'Kunde',
        '[F] Entsperrdaten nachgereicht: Auftrag fortgesetzt, Eintrag "Order Resumed" vom Kunden', `${unlock.status} ${(await stored(id2)).status} ${resumedEntries.length}`);
      const strangerUnlock = await call('POST', `/api/inspection-communication/${id2}/update-unlock-info`, stranger, { unlockCode: '0000' });
      check(strangerUnlock.status === 403, '[F] fremder Kunde: 403', strangerUnlock.status);
    });

    // ------------------------------------------------------------------ [B]
    await section('[B] "Kunde benachrichtigen": wirklich gesendet, nie Internes (NOTIF-5/COMMS-16)', async () => {
      const order = await newOrder();
      const id = String(order._id);
      const before = (await customerNotifications()).length;
      const mailsBefore = mailsTo(customer.email).length;
      const approve = await initAndApprove(order, { notifyCustomer: true, internalNotes: 'INTERN-XYZ Kunde wirkt ungeduldig' });
      await sleep(50);
      const created = (await customerNotifications()).slice(before);
      const newMails = mailsTo(customer.email).slice(mailsBefore);
      check(approve.status === 200 && approve.body?.customerNotification?.status === 'sent', 'AN: Ergebnis "sent" getrennt vom Speichererfolg gemeldet',
        `${approve.status} ${approve.body?.customerNotification?.status}`);
      check(created.length === 1 && created[0].title === 'Reparatur begonnen' && String(created[0].orderId) === id, 'AN: genau eine In-App-Benachrichtigung fuer den Kunden des Auftrags',
        `${created.length} ${created[0]?.title}`);
      check(newMails.length >= 1, 'AN: E-Mail an den Kunden versendet (Stream-Transport)', newMails.length);
      check(!/INTERN-XYZ/.test(anyText(created)) && !newMails.some((mail) => /INTERN-XYZ/.test(mailText(mail))),
        'interne Notizen erreichen weder Benachrichtigung noch E-Mail', 'kein INTERN-XYZ');
      const wf = await RepairWorkflow.findOne({ orderId: id }).lean();
      check(wf.approvalData?.customerNotification?.status === 'sent', 'Ergebnis am Workflow gespeichert', wf.approvalData?.customerNotification?.status);

      const quietOrder = await newOrder();
      const quietBefore = (await customerNotifications()).length;
      const quietMails = mailsTo(customer.email).length;
      const quiet = await initAndApprove(quietOrder, { notifyCustomer: false, internalNotes: 'INTERN-STILL' });
      await sleep(30);
      check(quiet.status === 200 && (await customerNotifications()).length === quietBefore && mailsTo(customer.email).length === quietMails,
        'AUS: keine Benachrichtigung, keine E-Mail', `${(await customerNotifications()).length - quietBefore} ${mailsTo(customer.email).length - quietMails}`);

      // Zwischenfall "Rückfrage" mit Kundentext
      const beforeIncident = (await customerNotifications()).length;
      const incident = await call('POST', `/api/repair-workflows/${id}/incidents`, staff, {
        incidentType: 'customer_info',
        reason: 'INTERN-GRUND PIN fehlt',
        additionalData: { notes: 'INTERN-NOTIZ', notifyCustomer: true },
        customerMessage: 'Bitte nennen Sie uns die PIN Ihres Geräts.',
      });
      await sleep(30);
      const incidentNotes = (await customerNotifications()).slice(beforeIncident);
      check(incident.status === 200 && incidentNotes.length === 1 && incidentNotes[0].message === 'Bitte nennen Sie uns die PIN Ihres Geräts.'
        && incidentNotes[0].title === 'Rückfrage zu Ihrer Reparatur',
      'Zwischenfall AN: Kundentext gesendet, deutscher Titel', `${incident.status} ${incidentNotes.length} ${incidentNotes[0]?.title}`);
      check(!/INTERN-/.test(anyText(incidentNotes)) && !mailsTo(customer.email).some((mail) => /INTERN-/.test(mailText(mail))),
        'Zwischenfall: Grund/Notizen bleiben intern', 'kein INTERN-');
      const wfIncident = (await RepairWorkflow.findOne({ orderId: id }).lean()).incidents[0];
      check(Boolean(wfIncident.emailSentAt) && wfIncident.customerNotification?.status === 'sent' && !('customerMessage' in (wfIncident.additionalData || {})),
        'emailSentAt gesetzt, Kundentext nicht in den internen Zusatzdaten', `${wfIncident.emailSentAt} ${wfIncident.customerNotification?.status}`);
      const awaiting = await call('GET', `/api/repair-workflows/admin/awaiting-customer-feedback?orderIds=${id}`, staff);
      check((awaiting.body?.orders || []).some((entry) => entry.orderId === id), '"Warten auf Kundenrückmeldung" erscheint', awaiting.body?.count);

      // Pause sendet nie etwas (Pausengrund ist intern)
      await sleep(5);
      await call('POST', `/api/repair-workflows/${id}/resume`, staff, {});
      const beforePause = (await customerNotifications()).length;
      const mailsBeforePause = mailsTo(customer.email).length;
      await call('POST', `/api/repair-workflows/${id}/pause`, staff, { pauseReason: 'INTERN-PAUSE-2' });
      await sleep(30);
      check((await customerNotifications()).length === beforePause && mailsTo(customer.email).length === mailsBeforePause, 'Pause: keine Nachricht an den Kunden', 'unveraendert');
      await call('POST', `/api/repair-workflows/${id}/resume`, staff, {});

      // Abschluss mit Benachrichtigung: neutral, kein "abgeholt"
      const beforeComplete = (await customerNotifications()).length;
      const complete = await call('POST', `/api/repair-workflows/${id}/complete`, staff, { notifyCustomer: true });
      await sleep(30);
      const completeNotes = (await customerNotifications()).slice(beforeComplete);
      check(complete.status === 200 && complete.body?.customerNotification?.status === 'sent' && completeNotes.length === 1
        && /abgeschlossen/.test(completeNotes[0].message) && !/abgeholt|Abholung bereit|bereit zur Abholung/i.test(completeNotes[0].message),
      'Abschluss AN: "Reparatur abgeschlossen", kein "abgeholt"', completeNotes[0]?.message);
      const retryDuplicate = await call('POST', `/api/repair-workflows/${id}/notify-customer`, staff, { target: 'completion' });
      check(retryDuplicate.status === 200 && retryDuplicate.body?.customerNotification?.status === 'duplicate', 'bereits gesendet: Wiederholen sendet nichts', retryDuplicate.body?.customerNotification?.status);

      // Gastauftrag: E-Mail an die Gast-Adresse (wie die Gast-Nachrichten-Mail), keine In-App-Zeile
      const guestOrder = await newOrder({ customerId: undefined, guestTrackingToken: 'gast-token-wf-1', guestInfo: { firstName: 'Gabi', lastName: 'Gast', email: 'wf-gast@test.invalid' } });
      const guestMailsBefore = mailsTo('wf-gast@test.invalid').length;
      const guestNotesBefore = await Notification.countDocuments({ orderId: guestOrder._id });
      const guest = await initAndApprove(guestOrder, { notifyCustomer: true, internalNotes: 'INTERN-GAST-NOTIZ', customerMessage: 'Ihre Reparatur hat begonnen (Gast).' });
      await sleep(30);
      const guestMails = mailsTo('wf-gast@test.invalid').slice(guestMailsBefore);
      check(guest.status === 200 && guest.body?.customerNotification?.status === 'sent' && guest.body?.customerNotification?.inApp === false
        && guest.body?.customerNotification?.email === 'sent',
      'Gastauftrag AN: E-Mail an den Gast gesendet (inApp false, email sent)', `${guest.status} ${JSON.stringify(guest.body?.customerNotification)}`);
      check(guestMails.length === 1 && /Ihre Reparatur hat begonnen \(Gast\)/.test(mailText(guestMails[0])) && /gast-token-wf-1/.test(mailText(guestMails[0]))
        && !/INTERN-GAST-NOTIZ/.test(mailText(guestMails[0])),
      'Gast-E-Mail: Kundentext + Gast-Tracking-Link, keine interne Notiz', `${guestMails.length}`);
      check(await Notification.countDocuments({ orderId: guestOrder._id }) === guestNotesBefore, 'Gastauftrag: keine In-App-Zeile (kein Konto)', 'unveraendert');
      const guestStored = await RepairWorkflow.findOne({ orderId: guestOrder._id }).lean();
      check(guestStored.approvalData?.customerNotification?.status === 'sent', 'Gast-Ergebnis am Workflow gespeichert', guestStored.approvalData?.customerNotification?.status);
      const guestRetry = await call('POST', `/api/repair-workflows/${guestOrder._id}/notify-customer`, staff, { target: 'approval' });
      check(guestRetry.body?.customerNotification?.status === 'duplicate' && mailsTo('wf-gast@test.invalid').length === guestMailsBefore + 1,
        'Gast: Wiederholen nach Erfolg sendet keine zweite E-Mail', guestRetry.body?.customerNotification?.status);
      const noMailGuest = await newOrder({ customerId: undefined, guestInfo: { firstName: 'Ohne', lastName: 'Adresse' } });
      const noMail = await initAndApprove(noMailGuest, { notifyCustomer: true });
      check(noMail.status === 200 && noMail.body?.customerNotification?.status === 'skipped' && noMail.body?.customerNotification?.reason === 'no_contact'
        && (noMail.body?.warnings || []).some((w) => /keine E-Mail-Adresse/.test(w)),
      'Gastauftrag ohne E-Mail-Adresse: ehrlich "nicht benachrichtigt" mit Hinweis', `${noMail.body?.customerNotification?.status} ${noMail.body?.warnings}`);

      // Fehler beim Senden -> 200, getrennt gemeldet, Wiederholen genau einmal
      const failOrder = await newOrder();
      const realCreate = NotificationService.createNotification;
      NotificationService.createNotification = async () => { throw new Error('Benachrichtigungsdienst nicht erreichbar'); };
      let failed;
      try {
        failed = await initAndApprove(failOrder, { notifyCustomer: true });
      } finally {
        NotificationService.createNotification = realCreate;
      }
      const failedWf = await RepairWorkflow.findOne({ orderId: failOrder._id }).lean();
      check(failed.status === 200 && failed.body?.success === true && failed.body?.customerNotification?.status === 'failed'
        && (failed.body?.warnings || []).length > 0 && failedWf.status === 'in-progress',
      'Fehler: Workflow gestartet (200), Benachrichtigung als fehlgeschlagen gemeldet', `${failed.status} ${failed.body?.customerNotification?.status}`);
      const beforeRetry = (await customerNotifications({ orderId: failOrder._id })).length;
      const retry = await call('POST', `/api/repair-workflows/${failOrder._id}/notify-customer`, staff, { target: 'approval' });
      const retryAgain = await call('POST', `/api/repair-workflows/${failOrder._id}/notify-customer`, staff, { target: 'approval' });
      const afterRetry = (await customerNotifications({ orderId: failOrder._id })).length;
      check(retry.body?.customerNotification?.status === 'sent' && retryAgain.body?.customerNotification?.status === 'duplicate' && afterRetry - beforeRetry === 1,
        'Wiederholen: genau einmal gesendet', `${retry.body?.customerNotification?.status} ${retryAgain.body?.customerNotification?.status} ${afterRetry - beforeRetry}`);
      // Paralleles Wiederholen (Doppelklick / zwei Mitarbeiter) -> genau eine Benachrichtigung + E-Mail
      const failOrder2 = await newOrder();
      NotificationService.createNotification = async () => { throw new Error('Benachrichtigungsdienst nicht erreichbar'); };
      try {
        await initAndApprove(failOrder2, { notifyCustomer: true });
      } finally {
        NotificationService.createNotification = realCreate;
      }
      const parallelMailsBefore = mailsTo(customer.email).length;
      const parallel = await Promise.all([1, 2, 3].map(() => call('POST', `/api/repair-workflows/${failOrder2._id}/notify-customer`, staff, { target: 'approval' })));
      await sleep(50);
      const parallelStatuses = parallel.map((r) => r.body?.customerNotification?.status).sort();
      const parallelNotes = await customerNotifications({ orderId: failOrder2._id });
      check(parallelNotes.length === 1 && parallelStatuses.filter((x) => x === 'sent').length === 1 && parallelStatuses.filter((x) => x === 'duplicate').length === 2
        && mailsTo(customer.email).length - parallelMailsBefore === 1,
      'paralleles Wiederholen: genau eine Benachrichtigung und eine E-Mail', `${parallelStatuses} notes=${parallelNotes.length} mails=${mailsTo(customer.email).length - parallelMailsBefore}`);
      const parallelStored = await RepairWorkflow.findOne({ orderId: failOrder2._id }).lean();
      check(parallelStored.approvalData?.customerNotification?.status === 'sent', 'gespeichertes Ergebnis bleibt "sent" (nicht von "duplicate" ueberschrieben)', parallelStored.approvalData?.customerNotification?.status);

      // Abschluss durch den Techniker ohne Benachrichtigung -> im Auftrag nachtraeglich informieren
      const laterOrder = await newOrder();
      await initAndApprove(laterOrder);
      const techComplete = await call('POST', `/api/repair-workflows/${laterOrder._id}/complete`, staff, { notifyCustomer: false });
      const laterBefore = (await customerNotifications({ orderId: laterOrder._id })).length;
      check(techComplete.status === 200 && laterBefore === 0, 'Techniker-Abschluss ohne Benachrichtigung: nichts gesendet', `${techComplete.status} ${laterBefore}`);
      const later = await call('POST', `/api/repair-workflows/${laterOrder._id}/notify-customer`, staff, { target: 'completion', customerMessage: 'Ihr Gerät ist fertig repariert.' });
      const laterNotes = await customerNotifications({ orderId: laterOrder._id });
      check(later.status === 200 && later.body?.customerNotification?.status === 'sent' && laterNotes.length === 1 && laterNotes[0].message === 'Ihr Gerät ist fertig repariert.'
        && (await RepairWorkflow.findOne({ orderId: laterOrder._id }).lean()).completionNotification?.status === 'sent',
      'nachtraeglich "Kunde über Abschluss informieren": genau eine Nachricht mit dem eingegebenen Text', `${later.status} ${later.body?.customerNotification?.status} ${laterNotes.length}`);

      const badTarget = await call('POST', `/api/repair-workflows/${failOrder._id}/notify-customer`, staff, { target: 'egal' });
      check(badTarget.status === 400 && isGerman(badTarget.body?.message), 'unbekanntes Ziel -> 400 deutsch', `${badTarget.status} ${badTarget.body?.message}`);

      // NOTIF-6: keine rohen fetch-POSTs mehr (fehlender CSRF-Header -> 403 im echten Betrieb)
      const clientFiles = [
        'client/src/components/repair/CorrectionModal.tsx',
        'client/src/components/repair/RepairMainInterface.tsx',
        'client/src/components/repair/IncidentReportingModal.tsx',
        'client/src/components/repair/DataOverviewScreen.tsx',
        'client/src/pages/repair/RepairWorkflowPage.tsx',
      ];
      const offenders = clientFiles.filter((file) => {
        const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
        return /fetch\([^)]*\)/.test(text) && /method:\s*['"](POST|PUT|PATCH|DELETE)['"]/.test(text);
      });
      check(offenders.length === 0, 'NOTIF-6: kein rohes fetch mit POST/PUT/PATCH/DELETE im Techniker-Client', offenders.join(', ') || 'keine');
    });

    // ------------------------------------------------------------------ [C]
    await section('[C] Template-Workflow: Uebergaenge, "Reparatur abgeschlossen", Schritt erneut oeffnen (HIST-12/17/2)', async () => {
      const order = await newOrder({ status: 'in-progress', returnTrackingNumber: '00340434161094000001' });
      const id = String(order._id);
      await Order.updateOne({ _id: id }, {
        $push: {
          workflows: {
            workflowTemplateId: new mongoose.Types.ObjectId(), workflowName: 'Displaytausch', status: 'in-progress',
            steps: [{ stepId: 's1', stepName: 'Display einbauen', status: 'in-progress', startedAt: new Date() }],
          },
        },
      });
      const wf = (await stored(id)).workflows[0];
      const stepId = String(wf.steps[0]._id);
      const before = (await customerNotifications({ orderId: order._id })).length;
      const done = await call('POST', `/api/admin/orders/${id}/workflows/${wf._id}/steps/${stepId}/complete`, staff, {});
      await sleep(30);
      const after = await stored(id);
      check(done.status === 200 && after.status === 'ready-for-pickup' && after.workflows[0].status === 'completed', 'letzter Schritt: Auftrag ready-for-pickup', `${done.status} ${after.status}`);
      const ready = (await entriesOf(id, 'Order Ready'))[0];
      check(ready && !/Abholung/.test(ready.description) && /Reparatur abgeschlossen/.test(ready.description) && ready.type === 'status',
        'Verlauf: "Reparatur abgeschlossen" statt "bereit zur Abholung"', ready?.description);
      const stepEntry = (await entriesOf(id, 'Workflow Step Completed'))[0];
      check(stepEntry && stepEntry.type === 'workflow' && !ENGLISH.test(stepEntry.description) && /Schritt „Display einbauen“/.test(stepEntry.description),
        'Schritt-Eintrag deutsch mit Typ', stepEntry?.description);
      const notes = (await customerNotifications({ orderId: order._id })).slice(before);
      check(notes.length === 1 && /abgeschlossen/.test(notes[0].message) && !/abgeholt/i.test(notes[0].message),
        'genau eine Kundennachricht, neutral (Versandauftrag wird nicht "abgeholt")', `${notes.length} ${notes[0]?.message}`);

      const regress = await call('PUT', `/api/admin/orders/${id}/workflows/${wf._id}/status`, staff, { status: 'on-hold', pauseReason: 'versehentlich' });
      check(regress.status === 409 && isGerman(regress.body?.error) && (await stored(id)).status === 'ready-for-pickup',
        'abgeschlossener Workflow -> pausieren 409, Auftrag bleibt fertig', `${regress.status} ${regress.body?.error}`);
      const forceComplete = await call('PUT', `/api/admin/orders/${id}/workflows/${wf._id}/status`, staff, { status: 'in-progress' });
      check(forceComplete.status === 409 && (await stored(id)).workflows[0].status === 'completed', 'abgeschlossen -> in Bearbeitung ueber Status: 409', forceComplete.status);
      const bogus = await call('PUT', `/api/admin/orders/${id}/workflows/${wf._id}/status`, staff, { status: 'bogus' });
      check(bogus.status === 400 && isGerman(bogus.body?.error), 'unbekannter Workflow-Status -> 400 deutsch', `${bogus.status} ${bogus.body?.error}`);

      const reopenNoReason = await call('POST', `/api/admin/orders/${id}/workflows/${wf._id}/steps/${stepId}/goto`, staff, {});
      check(reopenNoReason.status === 400 && /Grund/.test(reopenNoReason.body?.error || '') && (await stored(id)).status === 'ready-for-pickup'
        && (await stored(id)).workflows[0].status === 'completed',
      'fertige Reparatur: Schritt erneut oeffnen ohne Grund -> 400, nichts geaendert', `${reopenNoReason.status} ${reopenNoReason.body?.error}`);
      check(!/erneut öffnen/.test(regress.body?.error || ''), '409-Meldung verweist auf keine nicht vorhandene Aktion', regress.body?.error);
      const reopen = await call('POST', `/api/admin/orders/${id}/workflows/${wf._id}/steps/${stepId}/goto`, staff, { reason: 'Displayfehler nach Test' });
      const reopened = await stored(id);
      const reopenEntry = (await entriesOf(id, 'Workflow Step Reopened'))[0];
      check(reopen.status === 200 && reopened.status === 'in-progress' && reopened.workflows[0].status === 'in-progress' && reopenEntry?.reason === 'Displayfehler nach Test',
        'Schritt erneut oeffnen: Workflow und Auftrag in Bearbeitung, Eintrag mit Grund', `${reopen.status} ${reopened.status} ${reopenEntry?.reason}`);
      const reopenAgain = await call('POST', `/api/admin/orders/${id}/workflows/${wf._id}/steps/${stepId}/goto`, staff, { reason: 'doppelt' });
      check(reopenAgain.status === 409 && (await entriesOf(id, 'Workflow Step Reopened')).length === 1, 'zweites Oeffnen des offenen Schritts -> 409, kein zweiter Eintrag', reopenAgain.status);

      await call('POST', `/api/admin/orders/${id}/workflows/${wf._id}/steps/${stepId}/complete`, staff, {});
      await Order.collection.updateOne({ _id: order._id }, { $set: { shippingLabelUrl: 'data:application/pdf;base64,JVBERg==', trackingNumber: '00340434161094015111' } });
      const blocked = await call('POST', `/api/admin/orders/${id}/workflows/${wf._id}/steps/${stepId}/goto`, staff, { reason: 'zu spät' });
      check(blocked.status === 409 && /Versand/.test(blocked.body?.error || '') && (await stored(id)).status === 'ready-for-pickup',
        'mit Versandlabel: erneut oeffnen 409, Auftrag bleibt fertig', `${blocked.status} ${blocked.body?.error}`);

      // Pausieren: der Kunde erfaehrt den internen Grund nicht (K04)
      const order2 = await newOrder({ status: 'in-progress' });
      await Order.updateOne({ _id: order2._id }, {
        $push: { workflows: { workflowTemplateId: new mongoose.Types.ObjectId(), workflowName: 'Akkutausch', status: 'in-progress', steps: [{ stepId: 'a', stepName: 'Akku', status: 'in-progress', startedAt: new Date() }] } },
      });
      const wf2 = (await stored(order2._id)).workflows[0];
      const beforePause = (await customerNotifications({ orderId: order2._id })).length;
      await call('PUT', `/api/admin/orders/${order2._id}/workflows/${wf2._id}/status`, staff, { status: 'on-hold', pauseReason: 'INTERN-WF-GRUND' });
      await sleep(20);
      const pauseNotes = (await customerNotifications({ orderId: order2._id })).slice(beforePause);
      check(pauseNotes.length === 1 && !/INTERN-WF-GRUND/.test(anyText(pauseNotes)), 'Workflow-Pause: Kunde erhaelt Status ohne internen Grund', pauseNotes[0]?.message);
    });

    // ------------------------------------------------------------------ [D]
    await section('[D] Storno: Grund Pflicht, Arbeit angehalten, keine Rechnungs-/Zahlungsaenderung (HIST-14)', async () => {
      const order = await newOrder({ status: 'in-progress', paymentStatus: 'paid' });
      const id = String(order._id);
      await initAndApprove(order);
      await Order.updateOne({ _id: id }, {
        $push: { workflows: { workflowTemplateId: new mongoose.Types.ObjectId(), workflowName: 'Reinigung', status: 'in-progress', steps: [{ stepId: 'r', stepName: 'Reinigen', status: 'in-progress', startedAt: new Date() }] } },
      });
      const invoicesBefore = await Invoice.countDocuments({});
      const paymentsBefore = await Payment.countDocuments({});

      const noReason = await call('PUT', `/api/admin/orders/${id}/status`, admin, { status: 'cancelled' });
      check(noReason.status === 400 && /Grund/.test(noReason.body?.error || '') && (await stored(id)).status === 'in-progress',
        'Storno ohne Grund -> 400 deutsch, Auftrag unveraendert', `${noReason.status} ${noReason.body?.error}`);
      const noReasonOrderRoute = await call('PUT', `/api/orders/${id}/status`, staff, { status: 'cancelled' });
      check(noReasonOrderRoute.status === 400, 'auch ueber PUT /api/orders/:id/status -> 400', noReasonOrderRoute.status);

      const beforeNotes = (await customerNotifications({ orderId: order._id })).length;
      const cancel = await call('PUT', `/api/admin/orders/${id}/status`, admin, { status: 'cancelled', reason: 'INTERN-STORNO Kunde zieht zurück' });
      await sleep(30);
      const afterCancel = await stored(id);
      const wf = await RepairWorkflow.findOne({ orderId: id }).lean();
      check(cancel.status === 200 && afterCancel.status === 'cancelled' && /nicht verändert/.test(cancel.body?.message || ''),
        'Storno mit Grund: 200, Hinweis "Rechnungen und Zahlungen nicht verändert"', `${cancel.status} ${cancel.body?.message}`);
      check(wf.status === 'paused' && wf.timerData.currentPauseReason === 'Auftrag storniert' && cancel.body?.cancelEffects?.repairWorkflowPaused === true,
        'laufende Reparatur pausiert (Zeiterfassung stoppt)', `${wf.status} ${wf.timerData.currentPauseReason}`);
      check(afterCancel.workflows[0].status === 'on-hold' && (cancel.body?.cancelEffects?.templateWorkflowsPaused || []).length === 1,
        'laufender Template-Workflow angehalten (nicht abgeschlossen/geloescht)', afterCancel.workflows[0].status);
      check(afterCancel.paymentStatus === 'paid' && await Invoice.countDocuments({}) === invoicesBefore && await Payment.countDocuments({}) === paymentsBefore,
        'Zahlungsstatus/Rechnungen/Zahlungen unberuehrt (keine automatische Erstattung)', afterCancel.paymentStatus);
      const cancelNotes = (await customerNotifications({ orderId: order._id })).slice(beforeNotes);
      check(cancelNotes.length === 1 && /storniert/.test(cancelNotes[0].message) && !/automatisch|INTERN-STORNO/.test(cancelNotes[0].message),
        'Kundennachricht: storniert, kein Erstattungsversprechen, kein interner Grund', cancelNotes[0]?.message);
      const cancelEntry = (await entriesOf(id, 'Order Status Updated')).pop();
      check(cancelEntry?.reason === 'INTERN-STORNO Kunde zieht zurück' && cancelEntry?.changes?.[0]?.to === 'cancelled', 'Verlauf: Storno mit Grund', cancelEntry?.reason);
      const inactive = await RepairWorkflowService.getInactiveWorkflows(-1000);
      check(!inactive.some((item) => String(item.orderId?._id || item.orderId) === id), 'stornierter Auftrag nicht als liegengebliebene Arbeit gemeldet', inactive.length);
      const resumeCancelled = await call('POST', `/api/repair-workflows/${id}/resume`, staff, {});
      const wfAfterResume = await RepairWorkflow.findOne({ orderId: id }).lean();
      check(resumeCancelled.status === 409 && resumeCancelled.body?.code === 'REPAIR_ORDER_CLOSED' && /storniert/.test(resumeCancelled.body?.message || '')
        && wfAfterResume.status === 'paused' && (await stored(id)).status === 'cancelled',
      'Fortsetzen der Reparatur auf storniertem Auftrag -> 409, Zeiterfassung bleibt angehalten', `${resumeCancelled.status} ${resumeCancelled.body?.message} ${wfAfterResume.status}`);
      const notesBeforeComplete = (await customerNotifications({ orderId: order._id })).length;
      const mailsBeforeComplete = mailsTo(customer.email).length;
      const completeCancelled = await call('POST', `/api/repair-workflows/${id}/complete`, staff, { notifyCustomer: true });
      const incidentCancelled = await call('POST', `/api/repair-workflows/${id}/incidents`, staff, { incidentType: 'needs_time', reason: 'x', notifyCustomer: true });
      await sleep(30);
      check(completeCancelled.status === 409 && incidentCancelled.status === 409
        && (await customerNotifications({ orderId: order._id })).length === notesBeforeComplete && mailsTo(customer.email).length === mailsBeforeComplete
        && (await RepairWorkflow.findOne({ orderId: id }).lean()).status === 'paused',
      'Abschluss/Zwischenfall auf storniertem Auftrag -> 409, keine "Reparatur abgeschlossen"-Nachricht', `${completeCancelled.status} ${incidentCancelled.status}`);
      const notifyCancelled = await call('POST', `/api/repair-workflows/${id}/notify-customer`, staff, { target: 'approval' });
      check(notifyCancelled.body?.customerNotification?.reason === 'order_cancelled' && (await customerNotifications({ orderId: order._id })).length === notesBeforeComplete,
        'Benachrichtigung auf storniertem Auftrag wird nicht gesendet', notifyCancelled.body?.customerNotification?.reason);
      const wfResume = await call('PUT', `/api/admin/orders/${id}/workflows/${afterCancel.workflows[0]._id}/status`, staff, { status: 'in-progress' });
      check(wfResume.status === 409, 'Template-Workflow auf storniertem Auftrag fortsetzen -> 409', wfResume.status);

      const bookingSource = fs.readFileSync(path.join(SERVER_DIR, 'services/bookingService.js'), 'utf8');
      check(!/automatisch veranlasst/.test(bookingSource), 'Buchungs-Storno-Mail verspricht keine automatische Erstattung', 'Quelltext geprueft');
    });

    // ------------------------------------------------------------------ [E]
    await section('[E] Eingangspruefung im Verlauf, Startfehler nicht verschluckt, interne Notiz bleibt intern (HIST-10/5c, NOTIF-7)', async () => {
      const order = await newOrder({ status: 'pending' });
      const id = String(order._id);
      const customerInit = await call('POST', '/api/device-inspections/init', customer, { orderId: id });
      check(customerInit.status === 403, 'Kunde darf keine Pruefung starten', customerInit.status);
      const init = await call('POST', '/api/device-inspections/init', staff, { orderId: id });
      check(init.status === 200 && (init.body?.warnings || []).length === 0 && (await stored(id)).status === 'diagnostic-assessment',
        'Start: Auftrag Diagnosebewertung, keine Warnung', `${init.status} ${(await stored(id)).status}`);
      await call('POST', '/api/device-inspections/init', staff, { orderId: id });
      const startEntries = await entriesOf(id, 'Inspection Started');
      check(startEntries.length === 1 && startEntries[0].refs?.inspectionId && startEntries[0].source === 'Eingangsprüfung',
        'genau ein Eintrag "Eingangsprüfung gestartet" mit Bezug', startEntries.length);

      // Selbstheilung nach einem Fehler beim Statuswechsel
      const order2 = await newOrder({ status: 'pending' });
      const realUpdateStatus = OrderService.updateStatus;
      OrderService.updateStatus = async () => { throw new Error('DB kurz weg'); };
      let failedInit;
      try {
        failedInit = await call('POST', '/api/device-inspections/init', staff, { orderId: String(order2._id) });
      } finally {
        OrderService.updateStatus = realUpdateStatus;
      }
      check(failedInit.status === 200 && (failedInit.body?.warnings || []).some((w) => /Auftragsstatus/.test(w)) && (await stored(order2._id)).status === 'pending',
        'Statusfehler beim Start wird gemeldet (nicht verschluckt)', `${failedInit.status} ${failedInit.body?.warnings}`);
      const healed = await call('POST', '/api/device-inspections/init', staff, { orderId: String(order2._id) });
      check(healed.status === 200 && (healed.body?.warnings || []).length === 0 && (await stored(order2._id)).status === 'diagnostic-assessment'
        && (await entriesOf(order2._id, 'Inspection Started')).length === 1,
      'erneuter Start holt Status und Eintrag genau einmal nach', `${(await stored(order2._id)).status}`);

      // Abschluss parallel doppelt -> ein Eintrag; geaenderter Kostenvoranschlag -> eigener Eintrag
      const offer = { cost: 69.9, costSpecified: true, timeframe: '2 Tage', description: 'Display' };
      const [d1, d2] = await Promise.all([
        call('PUT', `/api/device-inspections/${id}/complete`, staff, { repairOffer: offer }),
        call('PUT', `/api/device-inspections/${id}/complete`, staff2, { repairOffer: offer }),
      ]);
      const completedEntries = await entriesOf(id, 'Inspection Completed');
      check(d1.status === 200 && d2.status === 200 && completedEntries.length === 1 && /69,90 €/.test(completedEntries[0].description),
        'Abschluss parallel: genau ein Eintrag mit Kostenvoranschlag 69,90 €', `${completedEntries.length} ${completedEntries[0]?.description}`);
      await call('PUT', `/api/device-inspections/${id}/complete`, staff, { repairOffer: offer });
      check((await entriesOf(id, 'Repair Quote Updated')).length === 0, 'gleicher Preis erneut: kein Eintrag', 0);
      await call('PUT', `/api/device-inspections/${id}/complete`, staff, { repairOffer: { ...offer, cost: 79.9 } });
      const quote = await entriesOf(id, 'Repair Quote Updated');
      check(quote.length === 1 && /69,90 € → 79,90 €/.test(quote[0].description) && quote[0].type === 'quote', 'geaenderter Kostenvoranschlag: ein Eintrag', quote[0]?.description);
      const staffHistory = await call('GET', `/api/orders/${id}/history?limit=300`, admin);
      const rows = (staffHistory.body?.entries || []).filter((item) => item.key === 'Inspection Completed');
      check(rows.length === 1 && rows[0].link?.label === 'Prüfbericht öffnen', 'GET /history: ein Abschluss-Eintrag mit Link zum Prüfbericht', rows.length);

      // NOTIF-7: nur der Kundentext erreicht den Kunden
      const order3 = await newOrder({ status: 'pending' });
      const id3 = String(order3._id);
      await call('POST', '/api/device-inspections/init', staff, { orderId: id3 });
      const before = (await customerNotifications({ orderId: order3._id })).length;
      const mailsBefore = mailsTo(customer.email).length;
      const inform = await call('PUT', `/api/device-inspections/${id3}/complete`, staff, {
        customerInformation: { shouldInform: true, reason: 'INTERN-REASON', note: 'INTERN-123 Powerchip prüfen', customerMessage: 'Bitte geben Sie uns Rückmeldung zum Akku.' },
      });
      await sleep(80);
      const informNotes = (await customerNotifications({ orderId: order3._id })).slice(before);
      const defectNote = informNotes.find((item) => item.title === 'Information zu einem Defekt an Ihrem Gerät');
      check(inform.status === 200 && inform.body?.customerNotification?.status === 'sent' && defectNote?.message === 'Bitte geben Sie uns Rückmeldung zum Akku.',
        'Kundentext gesendet', `${inform.body?.customerNotification?.status} ${defectNote?.message}`);
      check(!/INTERN-/.test(anyText(informNotes)) && !mailsTo(customer.email).slice(mailsBefore).some((mail) => /INTERN-/.test(mailText(mail))),
        'interne Notiz und interner Grund erreichen den Kunden nie (auch nicht in metadata)', 'kein INTERN-');
      const insp = await DeviceInspection.findOne({ orderId: id3 }).lean();
      check(insp.customerInformation?.note === 'INTERN-123 Powerchip prüfen', 'interne Notiz bleibt fuers Team gespeichert', insp.customerInformation?.note);
    });
    // ------------------------------------------------------------------ [G]
    await section('[G] Postfach-Zaehler: Reklamationskommentar leert den Zaehler-Cache sofort (Comms-Restpunkt)', async () => {
      const Complaint = mongoose.model('Complaint');
      const order = await newOrder({ status: 'completed' });
      const complaint = await Complaint.create({
        orderId: order._id, customerId: customer._id, subject: 'Display flackert', description: 'Nach der Reparatur', category: 'quality',
      });
      const before = cacheInvalidations;
      const bad = await call('POST', `/api/complaints/${complaint._id}/comments`, customer, {});
      check(bad.status === 400 && cacheInvalidations === before, 'abgelehnter Kommentar: kein Cache-Leeren', `${bad.status} ${cacheInvalidations - before}`);
      const ok = await call('POST', `/api/complaints/${complaint._id}/comments`, customer, { comment: 'Es flackert wieder.' });
      await sleep(20);
      check(ok.status === 200 && cacheInvalidations > before, 'erfolgreicher Kommentar: Cache geleert', `${ok.status} ${cacheInvalidations - before}`);
      const foreign = await call('POST', `/api/complaints/${complaint._id}/comments`, stranger, { comment: 'fremd' });
      check(foreign.status === 403, 'fremder Kunde: 403', foreign.status);
    });
  } finally {
    server.close();
    await mongoose.connection.dropDatabase().catch(() => undefined);
    await mongoose.disconnect();
    try { fs.rmSync(LOG_REDIRECT_DIR, { recursive: true, force: true }); } catch (error) { /* egal */ }
  }

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('Testlauf abgebrochen:', error);
  process.exit(1);
});
