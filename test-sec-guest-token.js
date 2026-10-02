/**
 * Regressionstest (Track sec, 02.10.2026): Gast-Links / Gast-Token und Missbrauchsschutz.
 * Echte Express-Routen (Gast-Tracking, Gast-Reparaturanfrage, Checkout, Login), echte
 * Wegwerf-DB, echte Token-Erzeugung der Modelle.
 *
 * Abgesichert:
 *   [A] Token eines ANDEREN Datensatzes -> 403/404, nie fremde Daten (Buchungs-Thread, Gast-
 *       Reparaturanfrage-Thread/-Nachricht).
 *   [B] Fehlender / kurzer / fehlgeformter / falscher Token: 400/404. Frueher:
 *       ?token[$ne]=x bzw. ?token[$regex]=... wurde als MongoDB-Operator ausgefuehrt,
 *       ?token=a&token=b als $in; token=' ' traf (nach trim) Buchungen OHNE Token
 *       (Standardwert '') -> Thread eines Kundenkontos mit dessen E-Mail lesbar.
 *   [C] Altbestand: Token aus 2024 (unveraendertes Format) funktioniert weiter; Bericht des
 *       Skripts server/scripts/guestTokenPolicy.js: 0 Links wuerden ungueltig.
 *   [D] Sperre im Einzelfall (Skript --rotate): Vorschau aendert nichts, --confirm -> alter
 *       Link 404, neuer Link 200. Keine Ablaufzeit (Richtlinie).
 *   [E] Rate-Limits: Fehlversuche -> 429 (auch fuer den danach richtigen Token), ein
 *       gefaelschter X-Forwarded-For hebt die Sperre NICHT auf (ohne Proxy und hinter nginx);
 *       erfolgreiche Aktualisierungen zaehlen nicht; Schreib-, Anlege- (IP und Ziel-E-Mail),
 *       Buchungsnummer-, Mail-erneut-senden- und Login-Limit greifen; andere Clients bleiben
 *       unberuehrt.
 *   [F] Gast-Antworten: nur Kundensicht - keine internen Notizen, keine Token/Sperr-/Idempotenz-
 *       felder, keine Daten anderer Datensaetze; Reparaturanfrage = Positivliste.
 *   [G] trust proxy: Standard 'loopback' - direkte Verbindung kann req.ip nicht faelschen,
 *       hinter lokalem nginx zaehlt die von nginx angehaengte Adresse.
 *
 * MOCKS: E-Mail, Benachrichtigungen, DHL. Keine Dateien im Repository, keine externen Hosts.
 * Aufruf (nur WEGWERF-Datenbank):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_guest_token node test-sec-guest-token.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, 'server');
const LOG_DIR = path.join(SERVER_DIR, 'logs');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_guest_token';

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

// Datei-Logs der Services in ein temporaeres Verzeichnis umleiten (nichts im Repository).
const LOG_REDIRECT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-guest-logs-'));
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

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.BOOKING_DHL_LABEL_MODE = 'dummy';
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

const out = (...args) => process.stdout.write(`${args.join(' ')}\n`);
if (!process.env.DEBUG_TEST) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}

let pass = 0;
let fail = 0;
const check = (condition, message, actual) => {
  if (condition) { pass += 1; out(`  PASS ${message} :: ${actual}`); } else { fail += 1; out(`  FAIL ${message} :: ${actual}`); }
};
const section = async (title, fn) => {
  out(`\n${title}`);
  try { await fn(); } catch (error) {
    fail += 1;
    out(`  FAIL Abschnitt brach ab :: ${error && error.stack ? error.stack.split('\n').slice(0, 3).join(' | ') : error}`);
  }
};
const MARK = 'INTERN-GUEST';

async function main() {
  if (isUnsafeTestUri(URI)) throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  fs.readdirSync(path.join(SERVER_DIR, 'models')).filter((f) => f.endsWith('.js')).forEach((f) => {
    try { require(path.join(SERVER_DIR, 'models', f)); } catch (error) { /* optional */ }
  });

  const mails = [];
  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  ['sendOrderConfirmationEmail', 'sendTemplateEmail', 'sendEmail', 'sendInvoiceEmail']
    .forEach((name) => { EmailService[name] = async () => ({ success: true, mocked: true }); });
  EmailService.sendTriggerEmail = async (trigger, to) => { mails.push({ trigger, to }); return { success: true, mocked: true }; };
  EmailService.buildSystemUrl = async (p) => `http://test.invalid${p}`;
  EmailService.resolveDeviceModelImageUrl = async () => '';
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });
  const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));
  DHLService.createShipment = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };
  DHLService.getTrackingInfo = async (trackingNumber) => ({ trackingNumber, status: 'in-transit', statusDescription: 'Unterwegs', events: [] });

  const { resolveTrustProxySetting, getClientIp } = require(path.join(SERVER_DIR, 'routes/middleware/rateLimit'));
  const mount = (app) => {
    app.use(express.json({ limit: '5mb' }));
    app.use('/api/track-order', require(path.join(SERVER_DIR, 'routes/orderTrackingRoutes')));
    app.use('/api/repair-requests', require(path.join(SERVER_DIR, 'routes/repairRequestRoutes')));
    app.use('/api/checkout', require(path.join(SERVER_DIR, 'routes/checkoutRoutes')));
    app.use('/api/auth', require(path.join(SERVER_DIR, 'routes/authRoutes')));
    return app;
  };
  // Direkter Client ohne Proxy (X-Forwarded-For darf nichts bewirken) ...
  const appDirect = mount(express());
  appDirect.set('trust proxy', false);
  // ... und Betrieb wie in scripts/setup-production*.sh: nginx auf demselben Host haengt die
  // echte Client-Adresse an X-Forwarded-For an (Standard 'loopback' wie in server.js).
  const appProxy = mount(express());
  appProxy.set('trust proxy', resolveTrustProxySetting(undefined));
  const listen = (app) => new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const serverDirect = await listen(appDirect);
  const serverProxy = await listen(appProxy);
  const urlDirect = `http://127.0.0.1:${serverDirect.address().port}`;
  const urlProxy = `http://127.0.0.1:${serverProxy.address().port}`;

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Booking = mongoose.model('Booking');
  const RepairRequest = mongoose.model('RepairRequest');
  const { db } = mongoose.connection;

  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '30m' });
  // via: { ip } = Client hinter nginx (appProxy), { spoof } = vom Client gesetzter Header.
  const call = async (method, url, { body, user, ip, spoof, direct = false } = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (user) headers.Authorization = `Bearer ${tokenFor(user)}`;
    if (direct) {
      if (spoof) headers['X-Forwarded-For'] = spoof;
    } else {
      headers['X-Forwarded-For'] = spoof ? `${spoof}, ${ip}` : ip;
    }
    const response = await fetch(`${direct ? urlDirect : urlProxy}${url}`, {
      method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const raw = await response.text();
    let json = null;
    try { json = JSON.parse(raw); } catch (error) { json = null; }
    return { status: response.status, body: json, raw };
  };
  const q = (params) => Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const randomIp = (() => { let n = 0; return () => { n += 1; return `203.0.113.${n % 250 + 1}`; }; })();

  // ------------------------------------------------------------------ Testdaten
  const staff = await User.create({ name: 'Sophie Team', firstName: 'Sophie', lastName: 'Team', email: 'gt-staff@test.invalid', role: 'staff', isActive: true });
  const member = await User.create({ name: 'Konto Kundin', firstName: 'Konto', lastName: 'Kundin', email: 'gt-konto@test.invalid', role: 'customer', isActive: true });

  const svc = [{ serviceId: new mongoose.Types.ObjectId(), name: 'Displaytausch', price: 49.9, quantity: 1, estimatedTime: 30 }];
  const guestInfo = (email, first) => ({ email, firstName: first, lastName: 'Gast', isGuest: true, phone: '0301234' });
  const makeGuestBooking = async (email, first, orderNumber, bookingNumber) => {
    const order = await Order.create({ orderNumber, deviceBrand: 'Apple', deviceModel: 'iPhone 13', deviceType: 'Smartphone',
      errorDescription: 'Display', services: svc, totalCost: 49.9, status: 'pending', guestInfo: guestInfo(email, first) });
    const booking = await Booking.create({ bookingNumber, orderIds: [order._id], guestInfo: guestInfo(email, first),
      items: [{ type: 'repair', orderId: order._id, orderNumber, device: 'Apple iPhone 13', cost: 49.9 }], totalCost: 49.9,
      checkoutAttemptId: `co_attempt_${first}` });
    await Order.updateOne({ _id: order._id }, { $set: { bookingId: booking._id } });
    return { order: await Order.findById(order._id).lean(), booking: await Booking.findById(booking._id).lean() };
  };
  const A = await makeGuestBooking('gast-a@test.invalid', 'Anna', 'ORD-GT-A1', 'BKG-GT-0001');
  const B = await makeGuestBooking('gast-b@test.invalid', 'Bernd', 'ORD-GT-B1', 'BKG-GT-0002');
  const D = await makeGuestBooking('num-victim@test.invalid', 'Dora', 'ORD-GT-D1', 'BKG-GT-0004');
  // Interne Felder an A (Notiz, Teile, Sperre) - duerfen Gaeste nie sehen.
  await db.collection('orders').updateOne({ _id: A.order._id }, { $set: {
    staffNotes: [{ note: `${MARK}-ORDERNOTE`, type: 'internal', staffName: 'Sophie Team', createdAt: new Date() }],
    eParts: [{ partId: new mongoose.Types.ObjectId(), quantity: 1, status: 'reserved' }],
    shippingLabelCreationStartedAt: new Date(), editRevision: 3,
  } });
  await db.collection('bookings').updateOne({ _id: A.booking._id }, { $set: { shippingLabelCreationStartedAt: new Date(), returnLabelCreationStartedAt: new Date() } });
  // Kundenkonto-Buchung (guestTrackingToken = Standardwert '') mit privatem Thread.
  const orderC = await Order.create({ customerId: member._id, orderNumber: 'ORD-GT-C1', deviceBrand: 'Samsung', deviceModel: 'S21', deviceType: 'Smartphone',
    errorDescription: 'Akku', services: svc, totalCost: 49.9, status: 'pending' });
  const bookingC = await Booking.create({ bookingNumber: 'BKG-GT-0003', customerId: member._id, orderIds: [orderC._id],
    items: [{ type: 'repair', orderId: orderC._id, orderNumber: 'ORD-GT-C1', device: 'Samsung S21', cost: 49.9 }], totalCost: 49.9 });
  await Order.updateOne({ _id: orderC._id }, { $set: { bookingId: bookingC._id } });
  await db.collection('inspectioncommunications').insertOne({ orderId: orderC._id, status: 'active', messages: [
    { _id: new mongoose.Types.ObjectId(), senderType: 'staff', senderName: 'Team', messageType: 'text', content: 'C-PRIVAT Ihr Akku ist bestellt', createdAt: new Date(), readBy: [] },
  ], pendingFeedbackCount: 0, pendingActionsCount: 0, createdAt: new Date(), updatedAt: new Date() });
  // Thread an A1 (Gast darf ihn lesen) und an B1 (fremd).
  await db.collection('inspectioncommunications').insertMany([A.order, B.order].map((o) => ({ orderId: o._id, status: 'active', messages: [
    { _id: new mongoose.Types.ObjectId(), senderType: 'staff', senderName: 'Team', messageType: 'text', content: `Hallo ${o.orderNumber}`, createdAt: new Date(), readBy: [] },
  ], pendingFeedbackCount: 0, pendingActionsCount: 0, createdAt: new Date(), updatedAt: new Date() })));
  // Altbestand aus 2024: Token im unveraenderten Format, ohne neuere Felder.
  const legacyToken = crypto.randomBytes(32).toString('hex');
  const legacyInsert = await db.collection('orders').insertOne({ orderNumber: 'ORD-2024-007', deviceBrand: 'Apple', deviceModel: 'iPhone 8', deviceType: 'Smartphone',
    errorDescription: 'Akku', status: 'completed', totalCost: 39, services: [], timeline: [], guestTrackingToken: legacyToken,
    guestInfo: { email: 'Alt.Gast@Test.invalid', firstName: 'Alt', lastName: 'Gast', isGuest: true },
    createdAt: new Date('2024-03-01T10:00:00Z'), updatedAt: new Date('2024-03-02T10:00:00Z') });

  const FUNC_IP = '198.51.100.10';
  // Gast-Reparaturanfragen ueber die echte Route.
  const newGuestRR = async (email, ip, extra = {}) => call('POST', '/api/repair-requests/guest', { ip, body: {
    guestInfo: { firstName: 'Gisela', lastName: 'Gast', email, phone: '0123' }, deviceSource: 'manual', deviceType: 'Smartphone',
    deviceBrand: 'Fairphone', deviceModel: 'Fairphone 5', issueDescription: 'Display flackert seit gestern.', ...extra,
  } });
  const rrA = await newGuestRR('rr-a@test.invalid', FUNC_IP);
  const rrB = await newGuestRR('rr-b@test.invalid', FUNC_IP);
  const rrADoc = await RepairRequest.findOne({ requestNumber: rrA.body?.requestNumber }).lean();
  const rrBDoc = await RepairRequest.findOne({ requestNumber: rrB.body?.requestNumber }).lean();
  await call('POST', `/api/repair-requests/${rrADoc?._id}/admin-notes`, { ip: FUNC_IP, user: staff, body: { note: `${MARK}-RRNOTE nur Team` } });

  try {
    await section('[Setup] Token-Erzeugung der Modelle/Services', async () => {
      check(/^[0-9a-f]{64}$/.test(A.order.guestTrackingToken) && /^[0-9a-f]{64}$/.test(A.booking.guestTrackingToken),
        'Gast-Auftrag und Gast-Buchung: 64 Hex (crypto.randomBytes(32))', `${A.order.guestTrackingToken.length} ${A.booking.guestTrackingToken.length}`);
      check(rrA.status === 201 && /^[0-9a-f]{64}$/.test(rrA.body?.guestTrackingToken || '') && rrADoc?.guestTrackingToken === rrA.body.guestTrackingToken,
        'Gast-Reparaturanfrage: 201, Token 64 Hex', rrA.status);
      check(bookingC.guestTrackingToken === '', 'Kundenkonto-Buchung hat keinen Gast-Token (Standardwert leer)', JSON.stringify(bookingC.guestTrackingToken));
      const adminNote = await RepairRequest.findById(rrADoc._id).select('adminNotes').lean();
      check(JSON.stringify(adminNote.adminNotes || []).includes(`${MARK}-RRNOTE`), 'interne Notiz an der Anfrage gespeichert (Personal-Route)', (adminNote.adminNotes || []).length);
    });

    // =====================================================================================
    await section('[F] Gast-Antworten: nur Kundensicht, nichts Fremdes', async () => {
      const ord = await call('GET', `/api/track-order?${q({ token: A.order.guestTrackingToken, email: 'gast-a@test.invalid' })}`, { ip: FUNC_IP });
      const o = ord.body?.order || {};
      check(ord.status === 200 && o.orderNumber === 'ORD-GT-A1', 'eigener Auftrags-Link -> 200', ord.status);
      const hiddenOrder = ['staffNotes', 'eParts', 'workflows', 'assignedStaff', 'editRevision', 'guestTrackingToken', 'shippingLabelCreationStartedAt', 'returnLabelCreationStartedAt', 'unlockCode', 'unlockPattern'];
      check(hiddenOrder.every((k) => o[k] === undefined), 'Auftrag ohne interne Felder/Token/Sperren', hiddenOrder.filter((k) => o[k] !== undefined).join(',') || 'keine');
      check(!ord.raw.includes(MARK) && !ord.raw.includes('ORD-GT-B1') && !ord.raw.includes('gast-b@') && !ord.raw.includes(A.order.guestTrackingToken),
        'Antwort enthaelt weder interne Notiz noch Fremddaten noch den Token', ord.raw.length);

      const bk = await call('GET', `/api/track-order/booking?${q({ token: A.booking.guestTrackingToken, email: 'GAST-A@test.invalid' })}`, { ip: FUNC_IP });
      const b = bk.body?.booking || {};
      check(bk.status === 200 && b.bookingNumber === 'BKG-GT-0001', 'eigener Buchungs-Link -> 200 (E-Mail ohne Gross-/Kleinschreibung)', bk.status);
      const hiddenBooking = ['guestTrackingToken', 'checkoutAttemptId', 'shippingLabelCreationInProgress', 'shippingLabelCreationStartedAt', 'returnLabelCreationStartedAt'];
      check(hiddenBooking.every((k) => b[k] === undefined), 'Buchung ohne Token/Idempotenzschluessel/Sperren', hiddenBooking.filter((k) => b[k] !== undefined).join(',') || 'keine');
      const orderNumbers = (bk.body?.orders || []).map((x) => x.orderNumber);
      check(orderNumbers.join(',') === 'ORD-GT-A1' && (bk.body?.orders || []).every((x) => x.staffNotes === undefined && x.guestTrackingToken === undefined),
        'nur Auftraege dieser Buchung, ohne interne Felder', orderNumbers.join(','));
      check(!bk.raw.includes(MARK) && !bk.raw.includes('co_attempt_') && !bk.raw.includes(A.booking.guestTrackingToken) && !bk.raw.includes(A.order.guestTrackingToken),
        'Buchungsantwort ohne interne Notiz, Idempotenzschluessel und Token', bk.raw.length);

      const byNum = await call('GET', `/api/track-order/by-number?${q({ bookingNumber: 'BKG-GT-0001', email: 'gast-a@test.invalid' })}`, { ip: FUNC_IP });
      check(byNum.status === 200 && byNum.body?.booking?.guestTrackingToken === undefined && !byNum.raw.includes(A.booking.guestTrackingToken),
        'Buchungsnummer + E-Mail -> 200, liefert den Link-Token NICHT mit', byNum.status);

      const rr = await call('GET', `/api/repair-requests/guest/track?${q({ token: rrA.body.guestTrackingToken, email: 'rr-a@test.invalid' })}`, { ip: FUNC_IP });
      const allowed = new Set(['_id', 'requestNumber', 'customerName', 'customerEmail', 'customerPhone', 'isGuest', 'deviceType', 'deviceBrand', 'deviceModel',
        'deviceLabel', 'deviceModelId', 'deviceSource', 'reportedDevice', 'issueDescription', 'issueOccurredDate', 'repairAttempts', 'modelNumber', 'waterDamage',
        'previousRepairDetails', 'itemCondition', 'images', 'status', 'statusLabel', 'quote', 'responseRequired', 'convertedToOrderId', 'convertedAt',
        'convertedOrder', 'createdAt', 'updatedAt', 'reviewDeadline', 'communicationSummary']);
      const keys = Object.keys(rr.body?.request || {});
      check(rr.status === 200 && keys.length > 0 && keys.every((k) => allowed.has(k)), 'Gast-Reparaturanfrage: nur Felder der Positivliste', keys.filter((k) => !allowed.has(k)).join(',') || `${keys.length} Felder`);
      check(!rr.raw.includes(MARK) && !rr.raw.includes(rrA.body.guestTrackingToken) && !rr.raw.includes('rr-b@'), 'ohne interne Notiz, Token und Fremddaten', rr.raw.length);
    });

    // =====================================================================================
    await section('[A] Token eines anderen Datensatzes', async () => {
      const foreignThread = await call('GET', `/api/track-order/booking/${B.order._id}/communication?${q({ token: A.booking.guestTrackingToken, email: 'gast-a@test.invalid' })}`, { ip: FUNC_IP });
      check(foreignThread.status === 404 && !foreignThread.raw.includes('ORD-GT-B1'), 'Buchungs-Token A + Auftrag B -> 404 ohne Daten', foreignThread.status);
      const ownThread = await call('GET', `/api/track-order/booking/${A.order._id}/communication?${q({ token: A.booking.guestTrackingToken, email: 'gast-a@test.invalid' })}`, { ip: FUNC_IP });
      check(ownThread.status === 200 && ownThread.raw.includes('Hallo ORD-GT-A1'), 'eigener Thread -> 200', ownThread.status);
      const foreignMsg = await call('POST', `/api/track-order/booking/${B.order._id}/communication/message`, { ip: FUNC_IP, body: { token: A.booking.guestTrackingToken, email: 'gast-a@test.invalid', content: 'fremd' } });
      check(foreignMsg.status === 404, 'Nachricht in fremden Buchungs-Thread -> 404', foreignMsg.status);
      const rrForeign = await call('GET', `/api/repair-requests/guest/${rrBDoc._id}/communication?${q({ token: rrA.body.guestTrackingToken, email: 'rr-a@test.invalid' })}`, { ip: FUNC_IP });
      const rrForeignMsg = await call('POST', `/api/repair-requests/guest/${rrBDoc._id}/message`, { ip: FUNC_IP, body: { token: rrA.body.guestTrackingToken, email: 'rr-a@test.invalid', content: 'fremd' } });
      check(rrForeign.status === 403 && rrForeignMsg.status === 403, 'Anfrage-Token A auf Anfrage B lesen/schreiben -> 403', `${rrForeign.status} ${rrForeignMsg.status}`);
      const orderTokenAsBooking = await call('GET', `/api/track-order/booking?${q({ token: A.order.guestTrackingToken, email: 'gast-a@test.invalid' })}`, { ip: FUNC_IP });
      check(orderTokenAsBooking.status === 404, 'Auftrags-Token ist kein Buchungs-Token -> 404', orderTokenAsBooking.status);
    });

    // =====================================================================================
    await section('[B] fehlender / kurzer / fehlgeformter / falscher Token', async () => {
      const email = 'gast-a@test.invalid';
      const missing = await call('GET', `/api/track-order?${q({ email })}`, { ip: FUNC_IP });
      const short = await call('GET', `/api/track-order?${q({ token: 'abc', email })}`, { ip: FUNC_IP });
      const wrong = await call('GET', `/api/track-order?${q({ token: crypto.randomBytes(32).toString('hex'), email })}`, { ip: FUNC_IP });
      const wrongEmail = await call('GET', `/api/track-order?${q({ token: A.order.guestTrackingToken, email: 'gast-b@test.invalid' })}`, { ip: FUNC_IP });
      check(missing.status === 400 && short.status === 404 && wrong.status === 404 && wrongEmail.status === 403,
        'fehlend 400, kurz 404, falsch 404, falsche E-Mail 403', `${missing.status} ${short.status} ${wrong.status} ${wrongEmail.status}`);
      const ne = await call('GET', `/api/track-order?token[$ne]=x&email=${encodeURIComponent(email)}`, { ip: FUNC_IP });
      const regex = await call('GET', `/api/track-order/booking?token[$regex]=^&email=${encodeURIComponent(email)}`, { ip: FUNC_IP });
      const arr = await call('GET', `/api/track-order?token=${crypto.randomBytes(32).toString('hex')}&token=${A.order.guestTrackingToken}&email=${encodeURIComponent(email)}`, { ip: FUNC_IP });
      check(ne.status === 404 && regex.status === 404 && arr.status === 404 && !ne.raw.includes('ORD-GT') && !regex.raw.includes('BKG-GT') && !arr.raw.includes('ORD-GT'),
        'Operator-Injection ($ne, $regex) und Token-Array -> 404 ohne Daten (frueher als Abfrageoperator ausgefuehrt)', `${ne.status} ${regex.status} ${arr.status}`);
      const emptyToken = await call('GET', `/api/track-order/booking/${orderC._id}/communication?token=%20&email=${encodeURIComponent('gt-konto@test.invalid')}`, { ip: FUNC_IP });
      check(emptyToken.status === 404 && !emptyToken.raw.includes('C-PRIVAT'),
        "token=' ' + E-Mail eines Kundenkontos -> 404 (frueher Treffer auf Buchung ohne Token, Thread lesbar)", emptyToken.status);
      const rrObj = await call('GET', `/api/repair-requests/guest/track?token[$ne]=x&email=rr-a%40test.invalid`, { ip: FUNC_IP });
      const rrShort = await call('GET', `/api/repair-requests/guest/track?${q({ token: '   ', email: 'rr-a@test.invalid' })}`, { ip: FUNC_IP });
      check([400, 404].includes(rrObj.status) && rrShort.status === 404 && !rrObj.raw.includes('RR-'), 'Gast-Anfrage: Objekt-Token 400/404, Leerzeichen-Token 404', `${rrObj.status} ${rrShort.status}`);
      const numObj = await call('GET', `/api/track-order/by-number?bookingNumber[$ne]=x&email=${encodeURIComponent(email)}`, { ip: FUNC_IP });
      check(numObj.status === 400 && !numObj.raw.includes('BKG-GT'), 'Buchungsnummer als Objekt -> 400', numObj.status);
    });

    // =====================================================================================
    await section('[C] Altbestand und Bericht', async () => {
      const legacy = await call('GET', `/api/track-order?${q({ token: legacyToken, email: 'alt.gast@test.invalid' })}`, { ip: FUNC_IP });
      check(legacy.status === 200 && legacy.body?.order?.orderNumber === 'ORD-2024-007', 'Link aus 2024 (unveraendertes Format) -> 200, keine Ablaufzeit', legacy.status);
      const legacyPadded = await call('GET', `/api/track-order?${q({ token: ` ${legacyToken} `, email: 'alt.gast@test.invalid' })}`, { ip: FUNC_IP });
      check(legacyPadded.status === 200, 'Leerzeichen um den Token (kopierter Link) -> weiterhin 200', legacyPadded.status);
      const reportRaw = execFileSync(process.execPath, [path.join(SERVER_DIR, 'scripts/guestTokenPolicy.js')], { env: { ...process.env, DATABASE_URL: URI }, encoding: 'utf8' });
      const report = JSON.parse(reportRaw);
      const cols = report.collections || {};
      check(['orders', 'bookings', 'repairrequests'].every((c) => cols[c] && cols[c].wouldStopWorking === 0 && cols[c].duplicateTokens === 0),
        'Bericht (nur lesend): 0 Links wuerden ungueltig, keine doppelten Tokens', JSON.stringify(Object.fromEntries(Object.entries(cols).map(([k, v]) => [k, `${v.recordsWithToken}/${v.wouldStopWorking}`]))));
      check(!reportRaw.includes(legacyToken) && !reportRaw.includes(A.order.guestTrackingToken), 'Bericht gibt keine Tokens aus', reportRaw.length);
    });

    // =====================================================================================
    await section('[D] Sperre im Einzelfall (Skript --rotate)', async () => {
      const script = path.join(SERVER_DIR, 'scripts/guestTokenPolicy.js');
      const env = { ...process.env, DATABASE_URL: URI };
      const preview = execFileSync(process.execPath, [script, '--rotate', 'ORD-2024-007'], { env, encoding: 'utf8' });
      const afterPreview = await db.collection('orders').findOne({ _id: legacyInsert.insertedId });
      check(afterPreview.guestTrackingToken === legacyToken && /Vorschau/.test(preview), 'Vorschau aendert nichts', /Vorschau/.test(preview));
      const confirmed = execFileSync(process.execPath, [script, '--rotate', 'ORD-2024-007', '--confirm'], { env, encoding: 'utf8' });
      const newToken = (confirmed.match(/token=([0-9a-f]{64})/) || [])[1];
      const oldLink = await call('GET', `/api/track-order?${q({ token: legacyToken, email: 'alt.gast@test.invalid' })}`, { ip: '198.51.100.11' });
      const newLink = newToken ? await call('GET', `/api/track-order?${q({ token: newToken, email: 'alt.gast@test.invalid' })}`, { ip: '198.51.100.11' }) : { status: 0 };
      check(Boolean(newToken) && newToken !== legacyToken && oldLink.status === 404 && newLink.status === 200,
        '--confirm: alter Link 404, neuer Link 200 (keine Mail)', `${oldLink.status} ${newLink.status}`);
      check(mails.every((m) => m.to !== 'alt.gast@test.invalid'), 'keine E-Mail an den Gast', mails.length);
    });

    // =====================================================================================
    await section('[E1] Fehlversuche -> 429, gefaelschter X-Forwarded-For hilft nicht', async () => {
      const ip = '198.51.100.20';
      const statuses = [];
      for (let i = 0; i < 30; i += 1) {
        // Der Client setzt bei jedem Versuch einen anderen X-Forwarded-For; nginx haengt die echte Adresse an.
        const res = await call('GET', `/api/track-order?${q({ token: crypto.randomBytes(32).toString('hex'), email: 'gast-a@test.invalid' })}`, { ip, spoof: randomIp() });
        statuses.push(res.status);
      }
      check(statuses.every((s) => s === 404), '30 falsche Tokens -> 404', [...new Set(statuses)].join(','));
      const blocked = await call('GET', `/api/track-order?${q({ token: A.order.guestTrackingToken, email: 'gast-a@test.invalid' })}`, { ip, spoof: randomIp() });
      check(blocked.status === 429 && blocked.body?.code === 'RATE_LIMITED' && /Zu viele/.test(blocked.body?.error || '') && !blocked.raw.includes('ORD-GT-A1'),
        '31. Versuch (auch mit RICHTIGEM Token, neuem X-Forwarded-For) -> 429 deutsch, ohne Daten', blocked.status);
      const blockedRR = await call('GET', `/api/repair-requests/guest/track?${q({ token: rrA.body.guestTrackingToken, email: 'rr-a@test.invalid' })}`, { ip, spoof: randomIp() });
      check(blockedRR.status === 429, 'Sperre gilt fuer alle Gast-Zugaenge dieses Clients (auch Reparaturanfrage)', blockedRR.status);
      const other = await call('GET', `/api/track-order?${q({ token: A.order.guestTrackingToken, email: 'gast-a@test.invalid' })}`, { ip: '198.51.100.21' });
      check(other.status === 200, 'anderer Client (andere echte Adresse) -> 200', other.status);

      // Ohne Proxy: X-Forwarded-For wird ignoriert (frueher: erster Eintrag = neuer Zaehler je Anfrage).
      const directStatuses = [];
      for (let i = 0; i < 30; i += 1) {
        const res = await call('GET', `/api/track-order?${q({ token: crypto.randomBytes(32).toString('hex'), email: 'gast-a@test.invalid' })}`, { direct: true, spoof: randomIp() });
        directStatuses.push(res.status);
      }
      const directBlocked = await call('GET', `/api/track-order?${q({ token: A.order.guestTrackingToken, email: 'gast-a@test.invalid' })}`, { direct: true, spoof: randomIp() });
      check(directStatuses.every((s) => s === 404) && directBlocked.status === 429, 'direkter Client mit wechselndem X-Forwarded-For -> nach 30 Fehlversuchen 429', `${[...new Set(directStatuses)].join(',')} -> ${directBlocked.status}`);
    });

    // =====================================================================================
    await section('[E2] Normale Nutzung: Aktualisierung zaehlt nicht als Fehlversuch', async () => {
      const ip = '198.51.100.30';
      const statuses = [];
      for (let i = 0; i < 40; i += 1) {
        const res = await call('GET', `/api/repair-requests/guest/${rrADoc._id}/communication?${q({ token: rrA.body.guestTrackingToken, email: 'rr-a@test.invalid' })}`, { ip });
        statuses.push(res.status);
      }
      check(statuses.every((s) => s === 200), '40 Aktualisierungen (Gastseite alle 10 s, ~7 min) -> alle 200', [...new Set(statuses)].join(','));
    });

    // =====================================================================================
    await section('[E3] Schreib-Limit (Nachrichten-Spam)', async () => {
      const ip = '198.51.100.40';
      const statuses = [];
      for (let i = 0; i < 30; i += 1) {
        const res = await call('POST', `/api/repair-requests/guest/${rrADoc._id}/message`, { ip, spoof: randomIp(), body: { token: rrA.body.guestTrackingToken, email: 'rr-a@test.invalid', content: `Nachricht ${i}` } });
        statuses.push(res.status);
      }
      const blocked = await call('POST', `/api/repair-requests/guest/${rrADoc._id}/message`, { ip, spoof: randomIp(), body: { token: rrA.body.guestTrackingToken, email: 'rr-a@test.invalid', content: 'Nummer 31' } });
      const other = await call('POST', `/api/repair-requests/guest/${rrADoc._id}/message`, { ip: '198.51.100.41', body: { token: rrA.body.guestTrackingToken, email: 'rr-a@test.invalid', content: 'anderer Client' } });
      check(statuses.every((s) => s === 201) && blocked.status === 429 && other.status === 201, '30 Nachrichten 201, 31. -> 429, anderer Client 201', `${[...new Set(statuses)].join(',')} ${blocked.status} ${other.status}`);
      const thread = await db.collection('repairrequestcommunications').findOne({ repairRequestId: rrADoc._id });
      check(!(thread?.messages || []).some((m) => m.content === 'Nummer 31'), 'gesperrte Nachricht wurde nicht gespeichert', (thread?.messages || []).length);
    });

    // =====================================================================================
    await section('[E4] Anlege-Limits (E-Mail-Bombing, Speicher)', async () => {
      const victim = 'opfer@test.invalid';
      const before = mails.filter((m) => m.to === victim).length;
      const statuses = [];
      for (let i = 0; i < 6; i += 1) {
        statuses.push((await newGuestRR(victim, `198.51.100.${50 + i}`)).status);
      }
      await new Promise((r) => setTimeout(r, 50));
      const sent = mails.filter((m) => m.to === victim).length - before;
      check(statuses.slice(0, 5).every((s) => s === 201) && statuses[5] === 429, 'gleiche Ziel-E-Mail von 6 verschiedenen Adressen: 5x 201, 6. -> 429', statuses.join(','));
      check(sent <= 5, 'hoechstens 5 Mails an die Zieladresse je Stunde', sent);
      const ipStatuses = [];
      for (let i = 0; i < 21; i += 1) {
        ipStatuses.push((await newGuestRR(`ip-${i}@test.invalid`, '198.51.100.60', { }) ).status);
      }
      check(ipStatuses.slice(0, 20).every((s) => s === 201) && ipStatuses[20] === 429, 'eine Adresse: 20 Anfragen 201, 21. -> 429', `${[...new Set(ipStatuses.slice(0, 20))].join(',')} ${ipStatuses[20]}`);
      const otherClient = await newGuestRR('anders@test.invalid', '198.51.100.61');
      check(otherClient.status === 201, 'anderer Client darf weiter anlegen', otherClient.status);
    });

    // =====================================================================================
    await section('[E5] Buchungsnummer + E-Mail: verteiltes Durchprobieren', async () => {
      const statuses = [];
      for (let i = 0; i < 10; i += 1) {
        statuses.push((await call('GET', `/api/track-order/by-number?${q({ bookingNumber: `BKG-GT-9${String(i).padStart(3, '0')}`, email: 'num-victim@test.invalid' })}`, { ip: `198.51.100.${70 + i}` })).status);
      }
      const correctButBlocked = await call('GET', `/api/track-order/by-number?${q({ bookingNumber: 'BKG-GT-0004', email: 'num-victim@test.invalid' })}`, { ip: '198.51.100.80' });
      check(statuses.every((s) => s === 404) && correctButBlocked.status === 429, '10 falsche Nummern fuer eine Adresse (10 IPs) -> danach 429, auch von neuer IP', `${[...new Set(statuses)].join(',')} ${correctButBlocked.status}`);
      const tokenStillWorks = await call('GET', `/api/track-order/booking?${q({ token: D.booking.guestTrackingToken, email: 'num-victim@test.invalid' })}`, { ip: '198.51.100.81' });
      check(tokenStillWorks.status === 200, 'Token-Link derselben Adresse bleibt nutzbar (keine Aussperrung des Kunden)', tokenStillWorks.status);
    });

    // =====================================================================================
    // Fix-Welle 02.10.: Befunde des unabhaengigen Pruefers (verify_guest/repro.js R1b, R2, R3, R4).
    const histogram = (results) => JSON.stringify(results.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {}));

    await section('[E7] Paralleler Schwall: laufende Anfragen zaehlen mit (R1b)', async () => {
      await makeGuestBooking('burst-victim@test.invalid', 'Emil', 'ORD-GT-E1', 'BKG-GT-0061');
      // 100 gleichzeitige Nummern fuer EINE E-Mail von EINER IP, die richtige an Position 61.
      // Frueher: Pruefung vor der Anfrage, Zaehlung erst bei 'finish' -> {200:1, 404:99}.
      const guesses = Array.from({ length: 100 }, (_, i) => (i === 60 ? 'BKG-GT-0061' : `BKG-GT-8${String(i).padStart(3, '0')}`));
      const results = await Promise.all(guesses.map((bookingNumber) => call('GET',
        `/api/track-order/by-number?${q({ bookingNumber, email: 'burst-victim@test.invalid' })}`, { ip: '192.0.2.10' })));
      const handled = results.filter((r) => r.status !== 429).length;
      check(handled <= 10 && results.filter((r) => r.status === 429).every((r) => r.body?.code === 'RATE_LIMITED' && !r.raw.includes('ORD-GT-E1')),
        '100 parallele Buchungsnummern fuer eine E-Mail: hoechstens 10 bearbeitet, Rest 429 ohne Daten', histogram(results));
      const after = await call('GET', `/api/track-order/by-number?${q({ bookingNumber: 'BKG-GT-0061', email: 'burst-victim@test.invalid' })}`, { ip: '192.0.2.11' });
      check(after.status === 429 && !after.raw.includes('ORD-GT-E1'), 'danach auch die richtige Nummer von neuer IP -> 429', after.status);
      // IP-Zaehler der Fehlversuche (30 / 15 min): 100 gleichzeitige falsche Tokens einer IP.
      const tokenBurst = await Promise.all(Array.from({ length: 100 }, (_, i) => call('GET',
        `/api/track-order/booking?${q({ token: crypto.randomBytes(32).toString('hex'), email: `burst-${i}@test.invalid` })}`, { ip: '192.0.2.12' })));
      check(tokenBurst.filter((r) => r.status !== 429).length <= 30, '100 parallele falsche Tokens einer IP: hoechstens 30 bearbeitet', histogram(tokenBurst));
      const ownLinkElsewhere = await call('GET', `/api/track-order/booking?${q({ token: A.booking.guestTrackingToken, email: 'gast-a@test.invalid' })}`, { ip: '192.0.2.13' });
      check(ownLinkElsewhere.status === 200, 'anderer Client mit eigenem Link unberuehrt', ownLinkElsewhere.status);
    });

    await section('[E8] /by-number: Parameter token=x schaltet das E-Mail-Limit nicht ab (R2)', async () => {
      await makeGuestBooking('token-bypass@test.invalid', 'Fritz', 'ORD-GT-F1', 'BKG-GT-0071');
      const statuses = [];
      for (let i = 0; i < 10; i += 1) {
        statuses.push((await call('GET', `/api/track-order/by-number?${q({ bookingNumber: `BKG-GT-7${String(i).padStart(3, '0')}`, email: 'token-bypass@test.invalid', token: i % 2 ? 'x' : crypto.randomBytes(32).toString('hex') })}`,
          { ip: `192.0.2.${20 + i}` })).status);
      }
      const correct = await call('GET', `/api/track-order/by-number?${q({ bookingNumber: 'BKG-GT-0071', email: 'token-bypass@test.invalid', token: 'x' })}`, { ip: '192.0.2.40' });
      check(statuses.every((s) => s === 404) && correct.status === 429 && !correct.raw.includes('ORD-GT-F1'),
        '10 falsche Nummern mit &token=... (10 IPs) -> richtige Nummer danach 429 ohne Daten (frueher 200)', `${statuses.join(',')} -> ${correct.status}`);
    });

    const Payment = mongoose.model('Payment');
    const Product = mongoose.model('Product');
    const product = await Product.create({ name: 'Panzerglas GT', description: 'Schutzglas', price: 9.9, images: ['gt.jpg'], category: 'Screen Protectors', brand: 'Test', stockCount: 50 });
    const shopCart = { items: [{ productId: String(product._id), quantity: 1 }], repairOrders: [] };
    const payingGuest = (email, first) => ({ email, firstName: first, lastName: 'Zahl', phone: '0301234',
      billingAddress: { street: 'Zahlweg 5', city: 'Berlin', zipCode: '10117', country: 'DE' } });
    // Zustand wie nach POST /paypal/guest/capture-order (Zahlung erfasst, noch ohne Buchung).
    const capturedGuestPayment = (captureId, email) => Payment.create({ isGuest: true, guestEmail: email, guestName: 'Gast Zahl',
      amount: 9.9, currency: 'EUR', paymentMethod: 'paypal', status: 'completed', transactionId: `PPORDER-${captureId}`,
      metadata: { gatewayProvider: 'paypal', paypalOrderId: `PPORDER-${captureId}`, providerReference: captureId, providerDetails: { captureId } } });
    const guestComplete = (ip, body) => call('POST', '/api/checkout/guest-complete', { ip, body });
    const paidBody = (email, first, captureId, attempt) => ({ guestInfo: payingGuest(email, first), cartData: shopCart, paymentMethod: 'paypal',
      paymentData: { paypalOrderId: `PPORDER-${captureId}`, paypalCaptureId: captureId }, checkoutAttemptId: attempt });

    await section('[E9] Zahlender Gast nach PayPal-Erfassung nie gesperrt (R3)', async () => {
      const victim = 'zahlende-kundin@test.invalid';
      const payment = await capturedGuestPayment('CAP-VICTIM-0001', victim);
      // R3: 5 billige ungueltige Abschluesse mit der E-Mail des Opfers von 5 IPs.
      const attack = [];
      for (let i = 0; i < 5; i += 1) attack.push((await guestComplete(`192.0.2.${50 + i}`, { guestInfo: { email: victim } })).status);
      const rrAfterAttack = await newGuestRR(victim, '192.0.2.55');
      check(attack.every((s) => s === 400) && rrAfterAttack.status === 201,
        '5x 400 Dritter zaehlen nicht: Gast-Reparaturanfrage des Opfers danach 201 (frueher 429)', `${attack.join(',')} -> ${rrAfterAttack.status}`);
      // E-Mail-Bombing-Schutz bleibt: 5 ERFOLGREICHE Anlagen je Stunde, die 6. -> 429.
      const bombing = [];
      for (let i = 0; i < 5; i += 1) bombing.push((await newGuestRR(victim, `192.0.2.${56 + i}`)).status);
      check(bombing.slice(0, 4).every((s) => s === 201) && bombing[4] === 429, 'Anti-E-Mail-Bombing: nach 5 erfolgreichen Anlagen -> 429', bombing.join(','));
      // Ohne echte erfasste Zahlung keine Ausnahme ...
      const fake = await guestComplete('192.0.2.61', paidBody(victim, 'Paula', 'CAP-FAKE-0001', 'co_paid_fake_0001'));
      check(fake.status === 429, 'erfundene paypalCaptureId -> weiterhin 429', fake.status);
      // ... mit erfasster Zahlung derselben E-Mail immer.
      const paid = await guestComplete('192.0.2.62', paidBody(victim, 'Paula', 'CAP-VICTIM-0001', 'co_paid_victim_0001'));
      const linked = await Payment.findById(payment._id).lean();
      check(paid.status === 200 && Boolean(paid.body?.bookingId) && String(linked?.bookingId) === String(paid.body?.bookingId),
        'erfasste PayPal-Zahlung: Abschluss 200, Zahlung der Buchung zugeordnet (frueher 429, Zahlung ohne Buchung)', `${paid.status} ${paid.body?.error || ''} ${linked?.bookingId}`);
      const replay = await guestComplete('192.0.2.63', paidBody(victim, 'Paula', 'CAP-VICTIM-0001', 'co_paid_victim_0001'));
      check(replay.status === 200 && replay.body?.alreadyCompleted === true && replay.body?.bookingId === paid.body?.bookingId,
        'Wiederholung (gleicher checkoutAttemptId) -> 200 dieselbe Buchung', `${replay.status} ${replay.body?.bookingId}`);
      const reuse = await guestComplete('192.0.2.64', paidBody(victim, 'Paula', 'CAP-VICTIM-0001', 'co_paid_victim_0002'));
      check(reuse.status === 429, 'bereits zugeordnete Zahlung mit neuem Versuch -> keine Ausnahme mehr (429)', reuse.status);
      const otherEmail = await capturedGuestPayment('CAP-OTHER-0001', 'jemand-anders@test.invalid');
      const foreignCapture = await guestComplete('192.0.2.65', paidBody(victim, 'Paula', 'CAP-OTHER-0001', 'co_paid_victim_0003'));
      check(foreignCapture.status === 429 && !(await Payment.findById(otherEmail._id).lean()).bookingId,
        'Zahlung einer ANDEREN E-Mail -> keine Ausnahme', foreignCapture.status);

      // Gemeinsame IP (z. B. Mobilfunk-NAT), deren IP-Zaehler andere ausgeschoepft haben.
      const shared = [];
      for (let i = 0; i < 21; i += 1) shared.push((await guestComplete('192.0.2.66', { guestInfo: { email: `nat-${i}@test.invalid` } })).status);
      await capturedGuestPayment('CAP-PAID-0002', 'zweite-kundin@test.invalid');
      const paidShared = await guestComplete('192.0.2.66', paidBody('zweite-kundin@test.invalid', 'Zora', 'CAP-PAID-0002', 'co_paid_second_0001'));
      check(shared.slice(0, 20).every((s) => s === 400) && shared[20] === 429 && paidShared.status === 200,
        'IP-Limit erschoepft (20x 400, dann 429) - zahlender Gast derselben IP -> 200', `${shared[20]} ${paidShared.status} ${paidShared.body?.error || ''}`);
    });

    await section('[E10] Ungueltige Anfragen sperren nicht alle Gaeste (R4)', async () => {
      const results = [];
      for (let ipIndex = 0; ipIndex < 11; ipIndex += 1) {
        for (let i = 0; i < 20; i += 1) {
          results.push(await guestComplete(`192.0.2.${100 + ipIndex}`, { guestInfo: { email: `flood-${ipIndex}-${i}@test.invalid` } }));
        }
      }
      check(results.every((r) => r.status === 400), '220 ungueltige Abschluesse von 11 IPs -> alle 400, kein 429 (frueher 25x 429)', histogram(results));
      const unrelatedRR = await newGuestRR('unbeteiligt@test.invalid', '192.0.2.120');
      const unrelatedCheckout = await guestComplete('192.0.2.121', { guestInfo: payingGuest('unbeteiligt2@test.invalid', 'Udo'), cartData: shopCart, paymentMethod: 'card', paymentData: {}, checkoutAttemptId: 'co_unrelated_0001' });
      await capturedGuestPayment('CAP-PAID-0003', 'dritte-kundin@test.invalid');
      const paidAfterFlood = await guestComplete('192.0.2.122', paidBody('dritte-kundin@test.invalid', 'Dana', 'CAP-PAID-0003', 'co_paid_third_0001'));
      check(unrelatedRR.status === 201 && unrelatedCheckout.status === 200 && paidAfterFlood.status === 200,
        'danach: unbeteiligte Gast-Anfrage 201, Gast-Checkout 200, zahlender Gast 200', `${unrelatedRR.status} ${unrelatedCheckout.status} ${paidAfterFlood.status}`);
    });

    // =====================================================================================
    await section('[E11] POST-Routen: ?email=<zufall> in der URL verteilt die Fehlversuche nicht', async () => {
      // Die Schreibrouten pruefen die E-Mail aus dem Body; frueher zaehlte der Limiter query.email ?? body.email.
      const statuses = [];
      for (let i = 0; i < 10; i += 1) {
        statuses.push((await call('POST', `/api/track-order/booking/${new mongoose.Types.ObjectId()}/communication/message?${q({ email: `wegwerf-${i}@test.invalid` })}`, {
          ip: `198.51.100.${150 + i}`,
          body: { bookingNumber: `BKG-GT-8${String(i).padStart(3, '0')}`, email: 'body-victim@test.invalid', content: 'Hallo' },
        })).status);
      }
      const eleventh = await call('POST', `/api/track-order/booking/${new mongoose.Types.ObjectId()}/communication/message?${q({ email: 'wegwerf-x@test.invalid' })}`, {
        ip: '198.51.100.170',
        body: { bookingNumber: 'BKG-GT-8999', email: 'body-victim@test.invalid', content: 'Hallo' },
      });
      check(statuses.every((s) => [400, 403, 404].includes(s)) && eleventh.status === 429,
        '10 Fehlversuche fuer dieselbe Body-Adresse mit wechselnder Query-Adresse (10 IPs) -> 11. Versuch 429', `${[...new Set(statuses)].join(',')} -> ${eleventh.status}`);
    });

    await section('[E12] Abgebrochene Anfrage: gezaehlt wird der Status, den der Handler sendet', async () => {
      const { createRateLimitMiddleware } = require(path.join(SERVER_DIR, 'routes/middleware/rateLimit'));
      const EventEmitter = require('events');
      const limiter = createRateLimitMiddleware({
        key: `test-abort-${Date.now()}`, windowMs: 60 * 1000, maxRequests: 2, keyGenerator: () => 'opfer@test.invalid',
        countWhen: (status) => status >= 200 && status < 300,
      });
      const fakeRes = () => {
        const res = new EventEmitter();
        res.statusCode = 200; // Express-Standard, solange der Handler nichts gesetzt hat
        res.writableEnded = false;
        res.end = function end() { this.writableEnded = true; this.emit('finish'); return this; };
        res.set = () => res;
        res.status = (code) => { res.statusCode = code; return res; };
        res.json = (body) => { res.body = body; return res.end(); };
        return res;
      };
      // 5 billige Anfragen, Client bricht vor der Antwort ab, der Handler antwortet danach mit 400.
      for (let i = 0; i < 5; i += 1) {
        const res = fakeRes();
        limiter({ method: 'POST', body: {} }, res, () => {});
        res.emit('close');
        res.statusCode = 400;
        res.end();
      }
      let passed = false;
      const probe = fakeRes();
      limiter({ method: 'POST', body: {} }, probe, () => { passed = true; });
      check(passed, 'abgebrochene 400er zaehlen nicht als erfolgreiche Anlage (Opfer nicht ausgesperrt)', passed ? 'durchgelassen' : `${probe.statusCode}`);
      probe.statusCode = 201; probe.end();
      // Erfolge zaehlen weiterhin: 1 (probe) + 1 => danach gesperrt.
      const second = fakeRes();
      limiter({ method: 'POST', body: {} }, second, () => {});
      second.statusCode = 201; second.end();
      let blocked = true;
      const third = fakeRes();
      limiter({ method: 'POST', body: {} }, third, () => { blocked = false; });
      check(blocked && third.statusCode === 429, 'zwei echte Anlagen -> dritte Anfrage 429', `${third.statusCode}`);
    });

    await section('[E6] Mail erneut senden + Login-Limit', async () => {
      const resend = [];
      for (let i = 0; i < 6; i += 1) {
        resend.push((await call('POST', '/api/checkout/resend-verification-email', { ip: '198.51.100.95', spoof: randomIp(), body: { email: 'irgendwer@test.invalid' } })).status);
      }
      check(resend.slice(0, 5).every((s) => s !== 429) && resend[5] === 429, 'resend-verification-email: 6. Anfrage -> 429', resend.join(','));

      const login = [];
      for (let i = 0; i < 9; i += 1) {
        login.push((await call('POST', '/api/auth/login', { direct: true, spoof: randomIp(), body: { email: 'gt-staff@test.invalid', password: `falsch-${i}` } })).status);
      }
      check(login.slice(0, 8).every((s) => s === 400) && login[8] === 429, 'Login direkt mit wechselndem X-Forwarded-For: 8x 400, 9. -> 429 (frueher umgehbar)', login.join(','));
      const proxied = await call('POST', '/api/auth/login', { ip: '198.51.100.90', body: { email: 'gt-staff@test.invalid', password: 'falsch' } });
      check(proxied.status === 400, 'Login-Limit hinter nginx je echter Client-Adresse (anderer Client nicht gesperrt)', proxied.status);
    });

    // =====================================================================================
    await section('[G] trust proxy / Client-IP', async () => {
      check(resolveTrustProxySetting(undefined) === 'loopback' && resolveTrustProxySetting('false') === false && resolveTrustProxySetting('10.0.0.0/8') === '10.0.0.0/8',
        "Standard 'loopback', TRUST_PROXY ueberschreibbar", `${resolveTrustProxySetting(undefined)} ${resolveTrustProxySetting('false')}`);
      const fakeReq = (remoteAddress, xff) => {
        const req = Object.create(appProxy.request);
        req.app = appProxy;
        req.headers = xff ? { 'x-forwarded-for': xff } : {};
        req.socket = { remoteAddress };
        req.connection = req.socket;
        return req;
      };
      check(getClientIp(fakeReq('203.0.113.99', '1.2.3.4')) === '203.0.113.99', 'Internet-Client direkt am Node-Port: X-Forwarded-For ignoriert', getClientIp(fakeReq('203.0.113.99', '1.2.3.4')));
      check(getClientIp(fakeReq('127.0.0.1', '1.2.3.4, 198.51.100.7')) === '198.51.100.7', 'ueber lokalen nginx: von nginx angehaengte Adresse, nicht der gefaelschte erste Eintrag', getClientIp(fakeReq('127.0.0.1', '1.2.3.4, 198.51.100.7')));
    });
  } finally {
    serverDirect.close();
    serverProxy.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    try { fs.rmSync(LOG_REDIRECT_DIR, { recursive: true, force: true }); } catch (error) { /* ignore */ }
  }

  out(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch((error) => {
  out(`ABBRUCH: ${error && error.stack ? error.stack : error}`);
  process.exitCode = 1;
});
