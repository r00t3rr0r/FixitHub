/**
 * Regressionstest (Track sec, Wave 3, K04): Kunden sehen nie Datensaetze anderer Kunden und
 * nie interne Notizen - ueber JEDEN kundenseitigen Lesepfad (echte Express-Routen, echte DB,
 * echte JWT-Rollen: Kundin A, Kunde B, Personal).
 *
 * Abgesichert:
 *   [A] Kunde B liest NICHTS von Kundin A: Inspektion, Auftrag (Detail, Verlauf, Meilensteine,
 *       Historie/Revisionen, Sendungen, Tracking), Kommunikations-Thread (+ offene
 *       Rueckfragen/Aktionen), Rechnung (Detail, PDF, Belege zum Auftrag), Ein-/Ausgangs-
 *       label (Auftrag und Buchung), Reklamation (+ Label, Buchungsliste), Pruefbericht/PDF,
 *       Buchung (Detail, Zusammenfassung, Auftraege, Rechnungen, Vorschau, Zahlungen,
 *       Tracking), Reparaturanfrage (+ Thread). Antwort 401/403/404, nie A's Daten.
 *       Listen (GET /api/orders, /api/bookings, /api/invoices, /api/complaints/my,
 *       /api/repair-requests/my-requests, Thread-Postfach) enthalten A's Datensaetze nicht.
 *   [B] Kundin A erhaelt auf ALLEN diesen Pfaden keine internen Notizen: Order.staffNotes
 *       (intern, ueber POST /api/admin/orders/:id/notes), interne Thread-Notiz
 *       (POST /api/inspection-communication/:orderId/internal-note), Inspektions-Interna
 *       (interne Notiz, Teamfelder, Aktionsprotokoll, Techniker/Supervisor, Bericht-Pfad),
 *       interne Reklamationskommentare (isInternal), RepairRequest.adminNotes,
 *       interne Zahlungs-Metadaten.
 *   [C] Personal behaelt die Vollansicht (Marker sind dort sichtbar - Beweis, dass die Daten
 *       wirklich gespeichert sind und nur fuer Kunden gefiltert werden).
 *   [D] Kundenansicht der Inspektion ist eine Positivliste (keine unbekannten Felder).
 *   [E] Pruefbericht-PDF-Dateien unter /uploads/reports (Kundendaten + interne Notiz) waren
 *       ohne Anmeldung abrufbar; jetzt nur Personal (server.js -> uploadsAccess.serveUploads,
 *       Pfad wird wie von express.static dekodiert/normalisiert: auch //, %72, %2f, ./ und
 *       ../ fuehren nicht am Personal-Check vorbei).
 *
 * MOCKS: E-Mail, Benachrichtigungen, DHL, 'qrcode'. Datei-Logs werden umgeleitet. Der Test
 * erzeugt keine Dateien im Repository (Pruefbericht wird NICHT erzeugt; der Staff-Bericht wird
 * nur ueber die Rolle geprueft).
 *
 * Aufruf (nur WEGWERF-Datenbank):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_sec_iso node test-sec-customer-isolation.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const http = require('http');
const Module = require('module');

const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, 'server');
const LOG_DIR = path.join(SERVER_DIR, 'logs');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_sec_iso';

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

const LOG_REDIRECT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-iso-logs-'));
const redirectLogPath = (target) => {
  const text = typeof target === 'string' ? target : '';
  if (text && path.resolve(text).startsWith(LOG_DIR + path.sep)) return path.join(LOG_REDIRECT_DIR, path.basename(text));
  return target;
};
['appendFileSync', 'writeFileSync'].forEach((name) => {
  const original = fs[name];
  fs[name] = function redirected(target, ...rest) { return original.call(this, redirectLogPath(target), ...rest); };
});
['appendFile', 'writeFile'].forEach((name) => {
  const original = fs.promises[name];
  fs.promises[name] = function redirected(target, ...rest) { return original.call(this, redirectLogPath(target), ...rest); };
});

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, parent, ...rest) {
  if (request === 'qrcode') return 'qrcode-test-stub';
  return originalResolve.call(this, request, parent, ...rest);
};
require.cache['qrcode-test-stub'] = {
  id: 'qrcode-test-stub', filename: 'qrcode-test-stub', loaded: true,
  exports: { toDataURL: async () => 'data:image/png;base64,', toBuffer: async () => Buffer.from('') },
};

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.BOOKING_DHL_LABEL_MODE = 'dummy';
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

let pass = 0;
let fail = 0;
const check = (condition, message, actual) => {
  if (condition) { pass += 1; console.log(`  PASS ${message} :: ${actual}`); }
  else { fail += 1; console.log(`  FAIL ${message} :: ${actual}`); }
};
const section = async (title, fn) => {
  console.log(`\n${title}`);
  try { await fn(); } catch (error) {
    fail += 1;
    console.log(`  FAIL Abschnitt brach ab :: ${error && error.stack ? error.stack.split('\n').slice(0, 3).join(' | ') : error}`);
  }
};
const MARK = 'INTERN-SEC';
const pdfData = (text) => `data:application/pdf;base64,${Buffer.from(`%PDF-1.4 ${text}`).toString('base64')}`;

async function main() {
  if (isUnsafeTestUri(URI)) throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  fs.readdirSync(path.join(SERVER_DIR, 'models')).filter((f) => f.endsWith('.js')).forEach((f) => {
    try { require(path.join(SERVER_DIR, 'models', f)); } catch (error) { /* optional */ }
  });

  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  ['sendOrderConfirmationEmail', 'sendTriggerEmail', 'sendTemplateEmail', 'sendEmail', 'sendInvoiceEmail']
    .forEach((name) => { EmailService[name] = async () => ({ success: true, mocked: true }); });
  EmailService.buildSystemUrl = async (p) => `http://test.invalid${p}`;
  EmailService.resolveDeviceModelImageUrl = async () => '';
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });
  const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));
  DHLService.createShipment = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };
  // Tracking ohne externen Aufruf: feste Antwort (enthaelt keine Kundendaten).
  DHLService.getTrackingInfo = async (trackingNumber) => ({ trackingNumber, status: 'in-transit', statusDescription: 'Unterwegs', events: [] });
  const DeviceInspectionService = require(path.join(SERVER_DIR, 'services/deviceInspectionService'));
  let reportCalls = 0;
  // Kein PDF im Repository: der Bericht wird nur auf die Rolle geprueft.
  DeviceInspectionService.generateInspectionReport = async (orderId) => {
    reportCalls += 1;
    return { _id: new mongoose.Types.ObjectId(), orderId, reportUrl: `/uploads/reports/inspection-test-${MARK}.pdf` };
  };
  const OrderService = require(path.join(SERVER_DIR, 'services/orderService'));
  const BookingService = require(path.join(SERVER_DIR, 'services/bookingService'));
  const FinancialService = require(path.join(SERVER_DIR, 'services/financialService'));

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/orders', require(path.join(SERVER_DIR, 'routes/orderRoutes')));
  app.use('/api/admin/orders', require(path.join(SERVER_DIR, 'routes/adminOrderRoutes')));
  app.use('/api/bookings', require(path.join(SERVER_DIR, 'routes/bookingRoutes')));
  app.use('/api/invoices', require(path.join(SERVER_DIR, 'routes/invoiceRoutes')));
  app.use('/api/device-inspections', require(path.join(SERVER_DIR, 'routes/deviceInspectionRoutes')));
  app.use('/api/inspection-communication', require(path.join(SERVER_DIR, 'routes/inspectionCommunicationRoutes')));
  app.use('/api/complaints', require(path.join(SERVER_DIR, 'routes/complaintRoutes')));
  app.use('/api/repair-requests', require(path.join(SERVER_DIR, 'routes/repairRequestRoutes')));
  app.use('/api/repair-request-communication', require(path.join(SERVER_DIR, 'routes/repairRequestCommunicationRoutes')));
  // Datei-Auslieferung wie in server/server.js (gleiche Middleware, gleiche Reihenfolge), aber
  // aus einem temporaeren Verzeichnis - der Test legt keine Datei im Repository an.
  const UPLOADS_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-iso-uploads-'));
  fs.mkdirSync(path.join(UPLOADS_TMP, 'reports'));
  fs.writeFileSync(path.join(UPLOADS_TMP, 'reports', 'inspection-test.pdf'), `%PDF-1.4 Bericht Anna Eigen iso-anna@test.invalid ${MARK}-REPORTFILE`);
  fs.writeFileSync(path.join(UPLOADS_TMP, 'public-test.txt'), 'oeffentliche Datei');
  // Weitere interne Ordner (02.10.2026): Lieferantenrechnungen, Team-Chat, Alt-Nachrichten, CSV-Importe.
  for (const dir of ['invoices', 'chat', 'messages', 'csv']) {
    fs.mkdirSync(path.join(UPLOADS_TMP, dir));
    fs.writeFileSync(path.join(UPLOADS_TMP, dir, 'intern.txt'), `${MARK}-${dir.toUpperCase()}-INTERN`);
  }
  fs.mkdirSync(path.join(UPLOADS_TMP, 'device-images'));
  fs.writeFileSync(path.join(UPLOADS_TMP, 'device-images', 'katalog.txt'), 'oeffentliches Katalogbild');
  app.use('/uploads', ...require(path.join(SERVER_DIR, 'routes/middleware/uploadsAccess')).serveUploads(UPLOADS_TMP));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Service = mongoose.model('Service');
  const Complaint = mongoose.model('Complaint');
  const DeviceInspection = mongoose.model('DeviceInspection');
  const Payment = mongoose.model('Payment');
  const RepairRequest = mongoose.model('RepairRequest');

  const custA = await User.create({ name: 'Anna Eigen', firstName: 'Anna', lastName: 'Eigen', email: 'iso-anna@test.invalid', phone: '0301111', role: 'customer', isActive: true,
    invoiceAddress: { street: 'Annaweg 1', city: 'Berlin', zipCode: '10115', country: 'DE' } });
  const custB = await User.create({ name: 'Bernd Fremd', firstName: 'Bernd', lastName: 'Fremd', email: 'iso-bernd@test.invalid', phone: '0302222', role: 'customer', isActive: true,
    invoiceAddress: { street: 'Berndweg 2', city: 'Köln', zipCode: '50667', country: 'DE' } });
  const staff = await User.create({ name: 'Sophie Team', firstName: 'Sophie', lastName: 'Team', email: 'iso-staff@test.invalid', role: 'staff', isActive: true });
  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '30m' });
  const call = async (method, url, user, body) => {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const raw = Buffer.from(await response.arrayBuffer()).toString('utf8');
    let json = null;
    try { json = JSON.parse(raw); } catch (error) { json = null; }
    return { status: response.status, body: json, raw, type: response.headers.get('content-type') || '' };
  };

  // ------------------------------------------------------------------ Daten von Kundin A
  const display = await Service.create({ category: 'display', deviceTypes: ['Smartphone'], manufacturerPrecise: 'Apple', modelPrecise: 'iPhone 15', name: 'Displaytausch', price: 100, estimatedTime: '60' });
  const orderA = await OrderService.create({ customerId: custA._id, deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone', errorDescription: 'Display', services: [String(display._id)] });
  const bookingA = await BookingService.create({ customerId: custA._id, orderIds: [orderA._id], status: 'pending', paymentStatus: 'pending', billingStatus: 'unpaid', createShippingLabel: false });
  await Order.updateOne({ _id: orderA._id }, {
    $set: {
      bookingId: bookingA._id, status: 'completed',
      shippingLabelUrl: pdfData('AUSGANG-A'), trackingNumber: '00340434161096001111', shippingStatus: 'label-created',
      returnLabelUrl: pdfData('EINGANG-A'), returnTrackingNumber: '00340434161096002222',
    },
    $push: { timeline: { status: 'Interner Vermerk', description: `${MARK}-TIMELINE Kundin zahlt schlecht`, staffName: 'Sophie Team', completedAt: new Date() } },
  });
  await mongoose.connection.db.collection('bookings').updateOne({ _id: bookingA._id }, {
    $set: { shippingLabelUrl: pdfData('BUCHUNG-EINGANG-A'), trackingNumber: '00340434161096003333', returnLabelUrl: pdfData('BUCHUNG-RETOURE-A') },
  });
  const orderNumberA = (await Order.findById(orderA._id).lean()).orderNumber;
  const bookingNumberA = (await mongoose.connection.db.collection('bookings').findOne({ _id: bookingA._id })).bookingNumber;

  // Interne Notizen ueber die ECHTEN Personal-Routen
  const staffNote = await call('POST', `/api/admin/orders/${orderA._id}/notes`, staff, { note: `${MARK}-ORDERNOTE Kunde schwierig`, type: 'internal' });
  const customerMsg = await call('POST', `/api/inspection-communication/${orderA._id}/message`, custA, { content: 'Hallo, wie ist der Stand?' });
  const staffMsg = await call('POST', `/api/inspection-communication/${orderA._id}/message`, staff, { content: 'Wir melden uns morgen.' });
  const threadNote = await call('POST', `/api/inspection-communication/${orderA._id}/internal-note`, staff, { content: `${MARK}-THREADNOTE nur Team`, note: `${MARK}-THREADNOTE nur Team` });

  const inspection = await DeviceInspection.create({
    orderId: orderA._id, customerId: custA._id, technicianId: staff._id, status: 'completed', completedAt: new Date(),
    modelVerification: { reportedModel: 'iPhone 15', actualModel: 'iPhone 15', verified: true, verificationStatus: 'correct', supervisorId: staff._id, supervisorNotified: true },
    identification: { deviceType: 'Smartphone', imei: '356789012345678', identified: true },
    externalInspection: { display: { status: 'light-wear', notes: 'Kratzer oben' }, frame: { status: 'OK' }, backCover: { status: 'OK' }, buttons: { status: 'working' }, visibleDamages: { hasDamage: true, description: 'Kratzer' } },
    deviceTest: { charging: { status: 'OK' }, power: { status: 'OK' }, wifi: { status: 'OK' }, frontCamera: { status: 'OK' }, mainCamera: { status: 'Not OK', notes: 'unscharf' } },
    hasFailedTests: true, failedTestDetails: [{ testName: 'mainCamera', reason: 'unscharf' }],
    repairOffer: { cost: 0, costSpecified: false, timeframe: '2 Tage', description: 'Kamera tauschen' },
    isRepairable: true, completionAction: 'inform-customer',
    customerInformation: { shouldInform: true, reason: 'Kamera defekt', note: `${MARK}-INSPNOTE Kunde wirkt unzuverlaessig`, suggestedStatus: 'awaiting-customer', mailTemplate: `${MARK}-MAILTEMPLATE`, generatedAt: new Date(), customerMessage: 'Die Kamera ist defekt.' },
    reportGenerated: true, reportUrl: `/uploads/reports/inspection-${MARK}.pdf`, reportGeneratedAt: new Date(),
    actionLogs: [{ action: `${MARK}-ACTIONLOG Supervisor informiert`, technicianId: staff._id, technicianName: 'Sophie Team', resultStatus: 'info', details: { internal: `${MARK}-DETAILS` } }],
  });

  const invoiceA = await FinancialService.createInvoice({
    orderId: orderA._id, customerId: custA._id, discount: 0,
    items: [{ serviceName: 'Displaytausch', description: 'Display', quantity: 1, unitPrice: 100, total: 100, type: 'service' }],
  });
  await Payment.create({
    customerId: custA._id, bookingId: bookingA._id, invoiceId: invoiceA._id, amount: 40, currency: 'EUR', paymentMethod: 'bank_transfer', status: 'completed',
    transactionId: 'TX-ISO-A-1', metadata: { internalNote: `${MARK}-PAYMENT Rueckfrage Bank`, recordedBy: 'Sophie Team' },
  });

  const complaintA = await Complaint.create({
    customerId: custA._id, orderId: orderA._id, bookingId: bookingA._id, subject: 'Display flackert', description: 'Flackern', category: 'quality', status: 'approved',
    shippingLabelUrl: pdfData('REKLAMATION-A'),
  });
  const internalComment = await call('POST', `/api/complaints/${complaintA._id}/comments`, staff, { comment: `${MARK}-COMPLAINT intern pruefen`, isInternal: true });
  const publicComment = await call('POST', `/api/complaints/${complaintA._id}/comments`, staff, { comment: 'Wir pruefen Ihre Reklamation.', isInternal: false });

  const rrCreate = await call('POST', '/api/repair-requests', custA, {
    deviceSource: 'manual', deviceModelId: '', deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 12', issueDescription: 'Akku schwach',
  });
  const rrId = rrCreate.body?.request?._id || rrCreate.body?.request?.id;
  const rrNote = rrId ? await call('POST', `/api/repair-requests/${rrId}/admin-notes`, staff, { note: `${MARK}-RRNOTE Kunde will feilschen` }) : { status: 0 };
  const rrMsg = rrId ? await call('POST', `/api/repair-request-communication/${rrId}/message`, custA, { content: 'Wann bekomme ich das Angebot?' }) : { status: 0 };

  // Kunde B hat eigene Daten (damit Listen nicht trivial leer sind)
  const orderB = await OrderService.create({ customerId: custB._id, deviceBrand: 'Apple', deviceModel: 'iPhone 14', deviceType: 'Smartphone', errorDescription: 'Akku', services: [String(display._id)] });

  const idA = {
    order: String(orderA._id), booking: String(bookingA._id), invoice: String(invoiceA._id), complaint: String(complaintA._id), rr: String(rrId || ''),
  };
  const secretsOfA = [orderNumberA, bookingNumberA, 'iso-anna@test.invalid', 'Annaweg', invoiceA.invoiceNumber, 'TX-ISO-A-1', '356789012345678', MARK];

  try {
    await section('[0] Vorbedingungen: interne Notizen wurden ueber die echten Personal-Routen gespeichert', async () => {
      const stored = await Order.findById(orderA._id).lean();
      check([200, 201].includes(staffNote.status) && (stored.staffNotes || []).some((n) => n.type === 'internal' && n.note.includes(MARK)),
        'Order.staffNotes (intern) gespeichert', `${staffNote.status} ${(stored.staffNotes || []).length}`);
      check([200, 201].includes(customerMsg.status) && [200, 201].includes(staffMsg.status), 'Thread: Kunden- und Teamnachricht gespeichert', `${customerMsg.status}/${staffMsg.status}`);
      check([200, 201].includes(threadNote.status), 'interne Thread-Notiz gespeichert', `${threadNote.status} ${threadNote.body?.error || ''}`);
      const storedComplaint = await Complaint.findById(complaintA._id).lean();
      check([200, 201].includes(internalComment.status) && [200, 201].includes(publicComment.status)
        && (storedComplaint.comments || []).some((c) => c.isInternal && c.comment.includes(MARK)), 'interner Reklamationskommentar gespeichert', `${internalComment.status}/${publicComment.status}`);
      const storedRr = rrId ? await RepairRequest.findById(rrId).lean() : null;
      check(rrCreate.status === 201 && [200, 201].includes(rrNote.status) && (storedRr?.adminNotes || []).some((n) => n.note.includes(MARK)),
        'RepairRequest.adminNotes gespeichert', `${rrCreate.status} ${rrNote.status} ${rrCreate.body?.message || rrCreate.body?.error || ''}`);
      check([200, 201].includes(rrMsg.status), 'Nachricht zur Reparaturanfrage gespeichert', rrMsg.status);
      check(Boolean(inspection._id) && Boolean(invoiceA.invoiceNumber), 'Inspektion und Rechnung angelegt', invoiceA.invoiceNumber);
    });

    const personalRoutes = [
      ['Inspektion', `/api/device-inspections/${idA.order}`],
      ['Pruefbericht/PDF', `/api/device-inspections/${idA.order}/report`],
      ['Auftrag', `/api/orders/${idA.order}`],
      ['Auftragsverlauf', `/api/orders/${idA.order}/history`],
      ['Meilensteine', `/api/orders/${idA.order}/progress-timeline`],
      ['Auftragshistorie (Revisionen)', `/api/orders/${idA.order}/revisions`],
      ['Sendungen', `/api/orders/${idA.order}/shipments`],
      ['Einsendelabel (Auftrag)', `/api/orders/${idA.order}/inbound-label`],
      ['Versandlabel an Kunden (Auftrag)', `/api/orders/${idA.order}/shipping-label`],
      ['Retourenlabel (Auftrag)', `/api/orders/${idA.order}/return-label`],
      ['Tracking (Auftrag)', `/api/orders/${idA.order}/tracking`],
      ['Thread', `/api/inspection-communication/${idA.order}`],
      ['Thread offene Rueckfragen', `/api/inspection-communication/${idA.order}/pending-feedback`],
      ['Thread offene Aktionen', `/api/inspection-communication/${idA.order}/pending-actions`],
      ['Rechnung', `/api/invoices/${idA.invoice}`],
      ['Rechnungs-PDF', `/api/invoices/${idA.invoice}/pdf`],
      ['Belege zum Auftrag', `/api/invoices/for-order/${idA.order}`],
      ['Buchung', `/api/bookings/${idA.booking}`],
      ['Buchung Zusammenfassung', `/api/bookings/${idA.booking}/summary`],
      ['Buchung Auftraege', `/api/bookings/${idA.booking}/orders`],
      ['Buchung Rechnungen', `/api/bookings/${idA.booking}/invoices`],
      ['Buchung Rechnungsvorschau', `/api/bookings/${idA.booking}/invoice/preview`],
      ['Buchung Zahlungen', `/api/bookings/${idA.booking}/payments`],
      ['Buchung Einsendelabel', `/api/bookings/${idA.booking}/inbound-label`],
      ['Buchung Versandlabel', `/api/bookings/${idA.booking}/shipping-label`],
      ['Buchung Retourenlabel', `/api/bookings/${idA.booking}/return-label`],
      ['Buchung Tracking', `/api/bookings/${idA.booking}/shipping-tracking`],
      ['Buchung Retouren-Tracking', `/api/bookings/${idA.booking}/return-tracking`],
      ['Reklamation', `/api/complaints/${idA.complaint}`],
      ['Reklamationslabel', `/api/complaints/${idA.complaint}/shipping-label`],
      ['Reklamationen der Buchung', `/api/complaints/booking/${idA.booking}`],
      ['Reparaturanfrage', `/api/repair-requests/${idA.rr}`],
      ['Thread der Reparaturanfrage', `/api/repair-request-communication/${idA.rr}`],
      ['Reparaturanfrage offene Rueckfragen', `/api/repair-request-communication/${idA.rr}/pending-feedback`],
      ['Reparaturanfrage offene Aktionen', `/api/repair-request-communication/${idA.rr}/pending-actions`],
      ['Reparaturanfrage ungelesen', `/api/repair-request-communication/${idA.rr}/unread-count`],
    ];

    await section('[A] Kunde B liest keine Daten von Kundin A', async () => {
      for (const [label, url] of personalRoutes) {
        const res = await call('GET', url, custB);
        const leaked = secretsOfA.filter((secret) => secret && res.raw.includes(secret));
        check([401, 403, 404].includes(res.status) && leaked.length === 0 && !/application\/pdf/.test(res.type),
          `B -> ${label}: ${res.status} ohne Daten von A`, `${res.status} ${res.body?.error || res.body?.message || ''}${leaked.length ? ` LEAK ${leaked.join(',')}` : ''}`);
      }
      const anonymous = await call('GET', `/api/device-inspections/${idA.order}`, null);
      check(anonymous.status === 401, 'ohne Anmeldung -> Inspektion: 401', anonymous.status);
      const lists = [
        ['Auftragsliste', '/api/orders'], ['Buchungsliste', '/api/bookings'], ['Rechnungsliste', '/api/invoices'],
        ['Reklamationen', '/api/complaints/my'], ['Reparaturanfragen', '/api/repair-requests/my-requests'],
        ['Thread-Postfach', '/api/inspection-communication'], ['Postfach Reparaturanfragen', '/api/repair-request-communication'],
      ];
      for (const [label, url] of lists) {
        const res = await call('GET', url, custB);
        const leaked = [idA.order, idA.booking, idA.invoice, idA.complaint, idA.rr, ...secretsOfA].filter((secret) => secret && res.raw.includes(secret));
        check(res.status === 200 && leaked.length === 0, `B -> ${label}: 200 ohne Datensaetze von A`, `${res.status}${leaked.length ? ` LEAK ${leaked.join(',')}` : ''}`);
      }
      const ownB = await call('GET', '/api/orders', custB);
      check((ownB.body?.orders || []).some((o) => String(o._id) === String(orderB._id)), 'B sieht seinen eigenen Auftrag (Liste nicht trivial leer)', (ownB.body?.orders || []).length);
    });

    await section('[B] Kundin A: eigene Daten ja, interne Notizen nie', async () => {
      const expectOk = new Set(['Inspektion', 'Auftrag', 'Auftragsverlauf', 'Meilensteine', 'Auftragshistorie (Revisionen)', 'Thread', 'Rechnung',
        'Rechnungs-PDF', 'Belege zum Auftrag', 'Buchung', 'Buchung Zahlungen', 'Reklamation', 'Reklamationslabel', 'Reparaturanfrage', 'Thread der Reparaturanfrage']);
      for (const [label, url] of personalRoutes) {
        const res = await call('GET', url, custA);
        const internal = res.raw.includes(MARK);
        const ok = expectOk.has(label) ? res.status === 200 : (label === 'Pruefbericht/PDF' ? res.status === 403 : res.status < 500);
        check(ok && !internal, `A -> ${label}: ${res.status}, keine internen Notizen`, `${res.status} ${res.body?.error || ''}${internal ? ' LEAK INTERN' : ''}`);
      }
      const lists = [['Auftragsliste', '/api/orders'], ['Buchungsliste', '/api/bookings'], ['Rechnungsliste', '/api/invoices'], ['Reklamationen', '/api/complaints/my'],
        ['Reparaturanfragen', '/api/repair-requests/my-requests'], ['Thread-Postfach', '/api/inspection-communication'], ['Postfach Reparaturanfragen', '/api/repair-request-communication']];
      for (const [label, url] of lists) {
        const res = await call('GET', url, custA);
        check(res.status === 200 && !res.raw.includes(MARK), `A -> ${label}: 200, keine internen Notizen`, `${res.status}${res.raw.includes(MARK) ? ' LEAK INTERN' : ''}`);
      }
      const complaint = await call('GET', `/api/complaints/${idA.complaint}`, custA);
      check((complaint.body?.complaint?.comments || []).some((c) => /Wir pruefen/.test(c.comment)), 'A sieht den oeffentlichen Reklamationskommentar', (complaint.body?.complaint?.comments || []).length);
      const thread = await call('GET', `/api/inspection-communication/${idA.order}`, custA);
      check(/Wir melden uns morgen/.test(thread.raw), 'A sieht die Teamnachricht im Thread', thread.status);
    });

    await section('[C] Personal behaelt die Vollansicht', async () => {
      const insp = await call('GET', `/api/device-inspections/${idA.order}`, staff);
      check(insp.status === 200 && insp.body?.inspection?.customerInformation?.note?.includes(MARK) && (insp.body?.inspection?.actionLogs || []).length === 1
        && insp.body?.inspection?.reportUrl && String(insp.body?.inspection?.technicianId?._id || insp.body?.inspection?.technicianId) === String(staff._id),
        'Personal: Inspektion mit interner Notiz, Aktionsprotokoll, Bericht-Pfad, Techniker', insp.status);
      const report = await call('GET', `/api/device-inspections/${idA.order}/report`, staff);
      check(report.status === 200 && reportCalls === 1, 'Personal: Pruefbericht erlaubt (Kunden nie)', `${report.status} Aufrufe ${reportCalls}`);
      const staffThread = await call('GET', `/api/inspection-communication/${idA.order}`, staff);
      check(staffThread.status === 200 && staffThread.raw.includes(`${MARK}-ORDERNOTE`), 'Personal: interne Auftragsnotiz (Order.staffNotes) im Team-Thread sichtbar', staffThread.status);
      const complaint = await call('GET', `/api/complaints/${idA.complaint}`, staff);
      check(complaint.status === 200 && complaint.raw.includes(`${MARK}-COMPLAINT`), 'Personal: interner Reklamationskommentar sichtbar', complaint.status);
      const rr = await call('GET', `/api/repair-requests/${idA.rr}`, staff);
      check(rr.status === 200 && rr.raw.includes(`${MARK}-RRNOTE`), 'Personal: adminNotes der Reparaturanfrage sichtbar', rr.status);
      const thread = await call('GET', `/api/inspection-communication/${idA.order}`, staff);
      check(thread.status === 200 && thread.raw.includes(`${MARK}-THREADNOTE`), 'Personal: interne Thread-Notiz sichtbar', thread.status);
    });

    await section('[D] Kundenansicht der Inspektion: Positivliste', async () => {
      const res = await call('GET', `/api/device-inspections/${idA.order}`, custA);
      const view = res.body?.inspection || {};
      const allowedTop = new Set(['_id', 'orderId', 'status', 'currentStep', 'completedSteps', 'hasFailedTests', 'customerNotificationCreated', 'approvalStatus',
        'reportGenerated', 'reportGeneratedAt', 'startedAt', 'completedAt', 'createdAt', 'updatedAt', 'repairOfferKnownCost', 'modelVerification',
        'identification', 'accessories', 'externalInspection', 'deviceTest', 'appleSpecific', 'failedTestDetails', 'repairOffer', 'customerInformation']);
      const unknown = Object.keys(view).filter((key) => !allowedTop.has(key));
      check(res.status === 200 && unknown.length === 0, 'nur Felder der Positivliste', `${Object.keys(view).join(',')}${unknown.length ? ` UNBEKANNT ${unknown.join(',')}` : ''}`);
      check(['actionLogs', 'technicianId', 'customerId', 'reportUrl', 'isRepairable', 'completionAction'].every((key) => view[key] === undefined)
        && view.modelVerification && view.modelVerification.supervisorId === undefined && view.modelVerification.supervisorNotified === undefined,
        'keine Teamfelder (Aktionsprotokoll, Techniker, Supervisor, Bericht-Pfad, Altfelder)', JSON.stringify(view.modelVerification));
      check(JSON.stringify(Object.keys(view.customerInformation || {}).sort()) === JSON.stringify(['customerMessage', 'reason', 'shouldInform']),
        'Kundeninformation nur Grund, Kundentext, Anzeigeflag', JSON.stringify(view.customerInformation));
      check(view.repairOfferKnownCost === null && view.repairOffer && view.repairOffer.cost === undefined && view.repairOffer.timeframe === '2 Tage',
        'Reparaturangebot: unbekannter Altpreis 0 nicht als Preis, Zeitrahmen sichtbar', JSON.stringify({ k: view.repairOfferKnownCost, o: view.repairOffer }));
      check(view.externalInspection?.display?.status === 'light-wear' && view.deviceTest?.mainCamera?.status === 'Not OK'
        && view.identification?.imei === '356789012345678' && (view.failedTestDetails || [])[0]?.testName === 'mainCamera' && view.hasFailedTests === true,
        'dokumentierter Geraetezustand bleibt fuer die Kundin sichtbar', JSON.stringify(view.deviceTest?.mainCamera));
      const guestOrder = await Order.create({ deviceBrand: 'Apple', deviceModel: 'iPhone 13', deviceType: 'Smartphone', totalCost: 10, status: 'pending', guestInfo: { email: 'gast@test.invalid', firstName: 'G', lastName: 'Ast', isGuest: true } });
      await DeviceInspection.create({ orderId: guestOrder._id, technicianId: staff._id, status: 'completed', customerInformation: { note: `${MARK}-GUEST` } });
      const guestView = await call('GET', `/api/device-inspections/${guestOrder._id}`, custA);
      check(guestView.status === 403 && !guestView.raw.includes(MARK), 'Gastauftrag: Kunden erhalten die Inspektion nicht (403)', guestView.status);
    });

    await section('[E] Pruefbericht-Datei (/uploads/reports) nur fuer Personal', async () => {
      const source = fs.readFileSync(path.join(SERVER_DIR, 'server.js'), 'utf8');
      const guardedAt = source.search(/app\.use\('\/uploads',\s*\.\.\.require\('\.\/routes\/middleware\/uploadsAccess'\)\.serveUploads\(/);
      const unguardedStatic = /app\.use\('\/uploads',\s*express\.static\(/.test(source);
      check(guardedAt > 0 && !unguardedStatic, 'server.js: /uploads nur ueber serveUploads (Zugriffspruefung + express.static), keine ungeschuetzte Auslieferung', `serveUploads@${guardedAt} ungeschuetzt=${unguardedStatic}`);
      // Roh-HTTP statt fetch: fetch/URL normalisiert ./ und ../ und wuerde die Umwege verbergen.
      const rawGet = (rawPath, user) => new Promise((resolve) => {
        const req = http.request({ host: '127.0.0.1', port: server.address().port, path: rawPath, method: 'GET',
          headers: user ? { Authorization: `Bearer ${tokenFor(user)}` } : {} }, (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => resolve({ status: res.statusCode, raw: Buffer.concat(chunks).toString('utf8') }));
        });
        req.on('error', (error) => resolve({ status: 0, raw: String(error.message) }));
        req.end();
      });
      const reportPaths = [
        '/uploads/reports/inspection-test.pdf',
        '/uploads//reports/inspection-test.pdf',
        '/uploads/%72eports/inspection-test.pdf',
        '/uploads/reports%2finspection-test.pdf',
        '/uploads/reports%2Finspection-test.pdf',
        '/uploads/./reports/inspection-test.pdf',
        '/uploads/%2e/reports/inspection-test.pdf',
        '/uploads/x/../reports/inspection-test.pdf',
        '/uploads/x/%2e%2e/reports/inspection-test.pdf',
        '/uploads/reports/../reports/inspection-test.pdf',
        '/uploads/REPORTS/inspection-test.pdf',
        '/uploads/reports/%69nspection-test.pdf',
      ];
      for (const rawPath of reportPaths) {
        const anonymous = await rawGet(rawPath, null);
        const asA = await rawGet(rawPath, custA);
        const asB = await rawGet(rawPath, custB);
        check(anonymous.status === 401 && !anonymous.raw.includes(MARK), `ohne Anmeldung ${rawPath}: 401, kein Bericht`, anonymous.status);
        check(asA.status === 403 && asB.status === 403 && !asA.raw.includes(MARK) && !asB.raw.includes(MARK), `Kundin A / Kunde B ${rawPath}: 403, kein Bericht`, `${asA.status}/${asB.status}`);
      }
      const asStaff = await rawGet('/uploads/reports/inspection-test.pdf', staff);
      check(asStaff.status === 200 && asStaff.raw.includes(`${MARK}-REPORTFILE`), 'Personal: Bericht wird ausgeliefert', asStaff.status);
      const staffViaDoubleSlash = await rawGet('/uploads//reports/inspection-test.pdf', staff);
      check(staffViaDoubleSlash.status === 200 && staffViaDoubleSlash.raw.includes(`${MARK}-REPORTFILE`), 'Personal: auch ueber nicht-kanonischen Pfad (gleiche Datei, gleiche Regel)', staffViaDoubleSlash.status);
      const listing = await rawGet('/uploads/reports/', null);
      check(listing.status === 401, 'Ordner /uploads/reports/ ohne Anmeldung: 401', listing.status);
      const badEncoding = await rawGet('/uploads/%E0%A4%A', null);
      check(badEncoding.status === 400 && !badEncoding.raw.includes(MARK), 'nicht dekodierbarer Pfad: 400', badEncoding.status);
      const publicFile = await rawGet('/uploads/public-test.txt', null);
      check(publicFile.status === 200 && publicFile.raw.includes('oeffentliche Datei'), 'andere Uploads unveraendert (keine Anmeldung verlangt)', publicFile.status);
      for (const dir of ['invoices', 'chat', 'messages', 'csv']) {
        const anon = await rawGet(`/uploads/${dir}/intern.txt`, null);
        const cust = await rawGet(`/uploads/${dir}/intern.txt`, custA);
        const trick = await rawGet(`/uploads/x/../${dir}/intern.txt`, null);
        const asStaffDir = await rawGet(`/uploads/${dir}/intern.txt`, staff);
        check(anon.status === 401 && trick.status === 401 && !anon.raw.includes(MARK) && !trick.raw.includes(MARK), `/uploads/${dir}: ohne Anmeldung 401 (auch ueber Umweg)`, `${anon.status}/${trick.status}`);
        check(cust.status === 403 && !cust.raw.includes(MARK), `/uploads/${dir}: Kunde 403`, cust.status);
        check(asStaffDir.status === 200 && asStaffDir.raw.includes(`${MARK}-${dir.toUpperCase()}-INTERN`), `/uploads/${dir}: Personal 200`, asStaffDir.status);
      }
      const catalogImage = await rawGet('/uploads/device-images/katalog.txt', null);
      check(catalogImage.status === 200, '/uploads/device-images bleibt oeffentlich (Katalogbilder)', catalogImage.status);
      const otherUpload = await rawGet('/uploads/does-not-exist.png', null);
      check(otherUpload.status === 404, 'unbekannte Datei ausserhalb von reports: 404 (unveraendert)', otherUpload.status);
      fs.rmSync(UPLOADS_TMP, { recursive: true, force: true });
    });
  } finally {
    server.close();
  }

  console.log(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('ERROR:', error.message);
  console.error(error.stack);
  console.log(`\n==== ${pass} bestanden, ${fail + 1} fehlgeschlagen ====`);
  try { await mongoose.disconnect(); } catch (e) { /* egal */ }
  process.exit(2);
});
