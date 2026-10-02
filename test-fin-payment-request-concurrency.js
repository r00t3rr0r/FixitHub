/**
 * Regressionstest (02.10.2026, K15 / FIN-11 / FIN-10): Nebenlaeufigkeit und Wiederholungen bei
 *   - "Zahlungsaufforderung" (POST /api/admin/financial/bookings/:id/payment-request,
 *     POST /api/admin/financial/payment-requests/:id/resend) und
 *   - "Rechnungen aus Auftraegen erstellen" (POST /api/admin/financial/invoices/from-repairs).
 *
 * Laeuft ueber die ECHTEN Express-Router (echte JWT-Pruefung, echte Rollen) gegen eine echte
 * Wegwerf-Datenbank. E-Mails laufen durch den ECHTEN EmailService mit Stream-Transport
 * (EMAIL_TEST_TRANSPORT=stream): nichts verlaesst den Rechner, gezaehlt wird jede Mail, die der
 * Transport tatsaechlich annimmt. PayPal/Netzwerk (axios) und In-App-Benachrichtigungen sind
 * Zaehl-Stubs - eine Zahlungsaufforderung darf keines davon ausloesen.
 *
 * Abgesichert:
 *   - N parallele Aufforderungen (Buchung) -> genau EIN Protokolleintrag und EINE Mail, die
 *     uebrigen 409 PAYMENT_REQUEST_RECENT (deutsch); keine Benachrichtigung, kein Provider-
 *     Aufruf, Rechnungsstatus/Mahnstufe unveraendert.
 *   - Wiederholung nach Erfolg innerhalb 24 h -> 409 "Zuletzt am …", keine Mail, kein Eintrag.
 *   - Doppelklick auf "trotzdem senden" (force, parallel) -> eine Mail.
 *   - SMTP-Fehler -> Eintrag 'failed', zaehlt nicht fuer die Sperrfrist, kein Anspruch bleibt
 *     haengen; die Wiederholung (auch parallel) sendet genau einmal.
 *   - Wiederversand (resend) parallel -> eine Mail; danach 429 PAYMENT_REQUEST_COOLDOWN.
 *   - Verwaister Anspruch (Prozessabbruch, > 45 Min. Anspruchsdauer) sperrt nicht; laufender
 *     (auch 6 bzw. 44 Min. alt, langsamer SMTP-Versand) sperrt.
 *   - Buchung || Rechnung derselben Buchung parallel (resend/force/ohne force mit Latenz) ->
 *     EIN gemeinsamer Anspruch, genau EINE Mail.
 *   - Anspruch wird zwischen E11000 und Uebernahme freigegeben -> kein falsches "belegt".
 *   - Rollen: Kunde / fremder Kunde / Mitarbeiter -> 403, ohne Anmeldung -> 401.
 *   - "Rechnungen aus Auftraegen": parallele Laeufe + Wiederholung -> genau EINE Rechnung je
 *     Auftrag (Invoice.activeBillingKeys), "sofort senden" des Clients -> genau EINE Mail.
 *
 * Gegen die alte Logik (Lesen-dann-Anlegen, 02.10.2026) gemessen: 37 PASS / 8 FAIL - force x5
 * parallel -> 5 Mails, resend x8 parallel -> 8 Mails; in 20 Runden mit je 8 parallelen
 * Erstanfragen hatten 9-11 Runden Doppel-/Dreifachversand (32-33 Mails statt 20). Nach dem
 * atomaren Anspruch (paymentrequestclaims): 0 Doppelversand, 45 PASS / 0 FAIL.
 * K15-Nachtrag (Anspruch je Rechnung statt je Buchung, 5-Min.-Anspruchsdauer, falsches "belegt"
 * nach Freigabe): alte Fassung 87 PASS / 26 FAIL (Buchung||Rechnung 2 Mails, 6 Min. alter
 * Anspruch uebernommen); mit gemeinsamem Buchungs-Anspruch + 45 Min. Anspruchsdauer 0 FAIL.
 *
 * Aufruf (nur Wegwerf-Datenbank):
 *   EMAIL_TEST_TRANSPORT=stream TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_k15_payment_request \
 *     node test-fin-payment-request-concurrency.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const SERVER_DIR = path.join(__dirname, 'server');
const LOG_DIR = path.join(SERVER_DIR, 'logs');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));
const axios = require(require.resolve('axios', { paths: [path.join(SERVER_DIR, 'routes')] }));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_k15_payment_request';
process.env.EMAIL_TEST_TRANSPORT = 'stream';

// Sicherheitsnetz: Dieser Test ruft dropDatabase() auf. Er darf ausschliesslich gegen eine
// ausdruecklich angegebene Wegwerf-Datenbank laufen - nie gegen die Entwicklungsdatenbank.
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
const LOG_REDIRECT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'k15-test-logs-'));
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

const out = (...args) => process.stdout.write(`${args.join(' ')}\n`);
if (!process.env.DEBUG_TEST) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}

let pass = 0;
let fail = 0;
const check = (condition, message, actual) => {
  if (condition) {
    pass += 1;
    out(`  PASS ${message} :: ${actual}`);
  } else {
    fail += 1;
    out(`  FAIL ${message} :: ${actual}`);
  }
};
const runSection = async (title, fn) => {
  out(`\n[${title}]`);
  try {
    await fn();
  } catch (error) {
    fail += 1;
    out(`  FAIL Abschnitt abgebrochen :: ${error.stack || error.message}`);
  }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const looksGerman = (text) => /[äöüß]|Bitte|nicht|bereits|Auftrag|Rechnung|Buchung|gesendet/i.test(String(text || ''))
  && !/Cast to|validation failed|duplicate key|E11000/i.test(String(text || ''));
const countBy = (list, fn) => list.reduce((acc, item) => { const key = fn(item); acc[key] = (acc[key] || 0) + 1; return acc; }, {});
const PARALLEL = 8;

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  const gitStatusBefore = require('child_process').execSync('git status --porcelain --untracked-files=all -- server/logs server/uploads uploads logs', { cwd: __dirname }).toString();

  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  const MODELS_DIR = path.join(SERVER_DIR, 'models');
  fs.readdirSync(MODELS_DIR).filter((file) => file.endsWith('.js')).forEach((file) => {
    try { require(path.join(MODELS_DIR, file)); } catch (error) { /* optionale Abhaengigkeiten */ }
  });

  // --- E-Mail: echter EmailService, Stream-Transport, Annahme wird mitgezaehlt ----------
  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.buildSystemUrl = async (p) => `http://test.invalid${p}`;
  EmailService.retryHandler.baseDelay = 1;
  EmailService.retryHandler.maxBackoffDelay = 5;
  EmailService.logger = { info() {}, warn() {}, error() {}, debug() {}, logSMTPConfig() {} };
  EmailService.deliveryTracker = { recordDelivery() {}, deliveryLog: [] };
  const accepted = []; // vom (Stream-)Transport angenommene Mails
  let transportMode = 'ok'; // 'ok' | 'fail'
  let transportDelayMs = 60; // realistische SMTP-Latenz, macht das Zeitfenster sichtbar
  const realGetTransporter = EmailService.getTransporter.bind(EmailService);
  EmailService.getTransporter = async () => {
    const transporter = await realGetTransporter();
    if (!transporter.__k15Wrapped) {
      const original = transporter.sendMail.bind(transporter);
      transporter.sendMail = async (options) => {
        await sleep(transportDelayMs);
        if (transportMode === 'fail') throw new Error('SMTP nicht erreichbar (Test)');
        const info = await original(options);
        accepted.push({ to: String(options.to || ''), subject: String(options.subject || ''), hasPdf: (options.attachments || []).length > 0 });
        return info;
      };
      transporter.__k15Wrapped = true;
    }
    return transporter;
  };

  // --- Zaehl-Stubs: In-App-Benachrichtigung und Netzwerk/PayPal ---------------------------
  const notifications = [];
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => {
    notifications.push(data);
    return { _id: new mongoose.Types.ObjectId(), ...data };
  };
  const providerCalls = [];
  axios.get = async (url) => { providerCalls.push(`GET ${url}`); throw new Error(`Test: unerwarteter Netzwerkaufruf ${url}`); };
  axios.post = async (url) => { providerCalls.push(`POST ${url}`); throw new Error(`Test: unerwarteter Netzwerkaufruf ${url}`); };

  const FinancialService = require(path.join(SERVER_DIR, 'services/financialService'));
  FinancialService.getPaymentGateways = async () => [];

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/admin/financial', require(path.join(SERVER_DIR, 'routes/financialRoutes')));
  app.use('/api/bookings', require(path.join(SERVER_DIR, 'routes/bookingRoutes')));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Booking = mongoose.model('Booking');
  const Service = mongoose.model('Service');
  const Invoice = mongoose.model('Invoice');
  const Payment = mongoose.model('Payment');
  const PaymentAllocation = mongoose.model('PaymentAllocation');
  const PaymentRequest = mongoose.model('PaymentRequest');
  const Notification = mongoose.model('Notification');
  await Promise.all([Payment.init(), PaymentAllocation.init(), Invoice.init(), PaymentRequest.init()]);
  // Standardvorlagen einmal anlegen (sonst legen parallele Erstaufrufe mehrere Konfigurationen an).
  await require(path.join(SERVER_DIR, 'services/systemConfigService')).getSystemConfiguration();
  const claims = () => mongoose.connection.db.collection('paymentrequestclaims');

  const admin = await User.create({ name: 'Admin K15', firstName: 'Anna', lastName: 'Admin', email: 'k15-admin@test.invalid', role: 'admin' });
  const staff = await User.create({ name: 'Staff K15', email: 'k15-staff@test.invalid', role: 'staff' });
  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, user, body) => {
    const headers = { 'Content-Type': 'application/json' };
    if (user) headers.Authorization = `Bearer ${tokenFor(user)}`;
    const response = await fetch(`${baseUrl}${url}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    let json = null;
    try { json = await response.json(); } catch (error) { json = null; }
    return { status: response.status, body: json };
  };

  const service = await Service.create({ name: 'Displaytausch', description: 'Display', category: 'screen', price: 49.9 });
  let seq = 0;
  const makeCustomer = async () => {
    seq += 1;
    return User.create({ name: `Kundin ${seq}`, firstName: `Kundin${seq}`, lastName: 'Muster', email: `k15-kunde${seq}@test.invalid`, role: 'customer', customerNumber: `K-K15-${seq}` });
  };
  const makeOrder = async (customer, { status = 'completed' } = {}) => {
    seq += 1;
    return Order.create({
      customerId: customer._id,
      orderNumber: `ORD-K15-${String(seq).padStart(3, '0')}`,
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 15',
      deviceType: 'Smartphone',
      errorDescription: 'Display defekt',
      services: [{ serviceId: service._id, name: 'Displaytausch', price: 49.9, quantity: 1, estimatedTime: 30 }],
      totalCost: 47.4,
      discount: 2.5,
      status,
    });
  };
  const makeBooking = async (customer, count = 1) => {
    const orders = [];
    for (let i = 0; i < count; i += 1) orders.push(await makeOrder(customer));
    const total = Math.round(orders.length * 47.4 * 100) / 100;
    const booking = await Booking.create({
      customerId: customer._id,
      orderIds: orders.map((order) => order._id),
      items: orders.map((order) => ({ type: 'repair', orderId: order._id, orderNumber: order.orderNumber, cost: order.totalCost })),
      subtotal: Math.round(orders.length * 49.9 * 100) / 100,
      discount: Math.round(orders.length * 2.5 * 100) / 100,
      tax: Math.round((total - total / 1.19) * 100) / 100,
      totalCost: total,
      status: 'processing',
    });
    await Order.updateMany({ _id: { $in: orders.map((order) => order._id) } }, { $set: { bookingId: booking._id } });
    return { booking: await Booking.findById(booking._id).setOptions({ skipAutoPopulate: true }), orders };
  };
  const pay = (booking, order, amount) => Payment.create({
    bookingId: booking._id,
    orderId: order._id,
    customerId: booking.customerId,
    amount,
    paymentMethod: 'paypal',
    status: 'completed',
    source: 'checkout',
    paymentDate: new Date(),
    processedAt: new Date(),
    metadata: { paypalOrderId: `PP-${crypto.randomBytes(4).toString('hex')}`, providerReference: `CAP-${crypto.randomBytes(4).toString('hex')}` },
  });
  // Buchung mit ausgestellter Rechnung (47,40 €) und 10 € Anzahlung -> 37,40 € offen.
  const openBookingWithInvoice = async (customer) => {
    const T = await makeBooking(customer);
    const created = await call('POST', `/api/bookings/${T.booking._id}/invoice`, staff, { sendImmediately: false });
    if (created.status !== 201) throw new Error(`Rechnung fuer Testbuchung nicht erstellt: ${created.status} ${created.body?.error}`);
    await pay(T.booking, T.orders[0], 10);
    const invoice = await Invoice.findOne({ bookingId: T.booking._id });
    await FinancialService.finalizeInvoiceCreation(invoice).catch(() => null);
    return { ...T, invoice: await Invoice.findById(invoice._id).lean() };
  };
  const requestMailsTo = (email) => accepted.filter((mail) => mail.to.toLowerCase() === email.toLowerCase() && /Zahlungsaufforderung/i.test(mail.subject));
  const requestUrl = (identifier) => `/api/admin/financial/bookings/${encodeURIComponent(identifier)}/payment-request`;
  const parallel = (n, fn) => Promise.all(Array.from({ length: n }, (_, index) => fn(index)));

  // ------------------------------------------------------------------------------------
  await runSection(`Zahlungsaufforderung: ${PARALLEL} parallele Anfragen (Buchung)`, async () => {
    const owner = await makeCustomer();
    const T = await openBookingWithInvoice(owner);
    const notificationsBefore = notifications.length;
    const notificationDocsBefore = await Notification.countDocuments({});
    const providerBefore = providerCalls.length;
    transportDelayMs = 60;

    const results = await parallel(PARALLEL, () => call('POST', requestUrl(T.booking.bookingNumber), admin, {}));
    const statuses = countBy(results, (r) => `${r.status}${r.body?.code ? ` ${r.body.code}` : ''}${r.body?.status ? ` ${r.body.status}` : ''}`);
    const okCount = results.filter((r) => r.status === 200 && r.body?.status === 'accepted_by_provider').length;
    const records = await PaymentRequest.find({ bookingId: T.booking._id }).lean();
    const mails = requestMailsTo(owner.email);
    out(`  INFO Antworten: ${JSON.stringify(statuses)} | PaymentRequest-Dokumente: ${records.length} (${JSON.stringify(countBy(records, (r) => r.status))}) | Mails: ${mails.length}`);
    check(okCount === 1, 'genau EINE Anfrage meldet "uebergeben"', okCount);
    check(records.length === 1 && records[0].status === 'accepted_by_provider', 'genau EIN Protokolleintrag', records.length);
    check(mails.length === 1, 'genau EINE Mail an den Kunden', mails.length);
    const refused = results.filter((r) => r.status === 409);
    check(refused.length === PARALLEL - 1 && refused.every((r) => r.body?.code === 'PAYMENT_REQUEST_RECENT' && looksGerman(r.body?.error)),
      'uebrige Anfragen -> 409 PAYMENT_REQUEST_RECENT, deutsch', JSON.stringify(countBy(refused, (r) => r.body?.code)));
    check(refused.every((r) => r.body?.recentRequest && typeof r.body.recentRequest.requestedAt === 'string'),
      'Ablehnung nennt die laufende/letzte Aufforderung (recentRequest)', refused.map((r) => Boolean(r.body?.recentRequest)).join(','));
    check(notifications.length === notificationsBefore && await Notification.countDocuments({}) === notificationDocsBefore,
      'keine In-App-Benachrichtigung', notifications.length - notificationsBefore);
    check(providerCalls.length === providerBefore, 'kein PayPal-/Provider-Aufruf', providerCalls.slice(providerBefore).join(' ') || 0);
    const invoiceAfter = await Invoice.findById(T.invoice._id).lean();
    check(invoiceAfter.status === T.invoice.status && Number(invoiceAfter.dunningLevel || 0) === Number(T.invoice.dunningLevel || 0),
      'Rechnungsstatus und Mahnstufe unveraendert', `${T.invoice.status}/${T.invoice.dunningLevel || 0} -> ${invoiceAfter.status}/${invoiceAfter.dunningLevel || 0}`);
    check(await claims().countDocuments({}) === 0, 'kein Anspruch bleibt haengen', await claims().countDocuments({}));

    // Wiederholung nach Erfolg innerhalb von 24 h
    const mailsBefore = accepted.length;
    const retry = await call('POST', requestUrl(T.booking.bookingNumber), admin, {});
    check(retry.status === 409 && retry.body?.code === 'PAYMENT_REQUEST_RECENT' && /Zuletzt am/.test(retry.body?.error || '')
      && retry.body?.recentRequest?.recipientEmail === owner.email,
    'Wiederholung nach Erfolg -> 409 "Zuletzt am … gesendet" (bestehende Meldung)', `${retry.status} ${retry.body?.error}`);
    check(accepted.length === mailsBefore && await PaymentRequest.countDocuments({ bookingId: T.booking._id }) === 1,
      'keine Mail, kein neuer Eintrag', accepted.length - mailsBefore);

    // Doppelklick auf "trotzdem senden" (force) - die Absicht ist EIN weiterer Versand.
    transportDelayMs = 400;
    const forced = await parallel(5, () => call('POST', requestUrl(T.booking.bookingNumber), admin, { force: true }));
    transportDelayMs = 60;
    const forcedOk = forced.filter((r) => r.status === 200 && r.body?.status === 'accepted_by_provider').length;
    out(`  INFO force parallel: ${JSON.stringify(countBy(forced, (r) => `${r.status} ${r.body?.code || r.body?.status || ''}`))}`);
    check(forcedOk === 1 && requestMailsTo(owner.email).length === 2, 'force x5 parallel -> genau EIN weiterer Versand', `${forcedOk} ok, Mails gesamt ${requestMailsTo(owner.email).length}`);
    check(forced.filter((r) => r.status !== 200).every((r) => r.status === 409 && looksGerman(r.body?.error)), 'parallele force-Klicks -> 409 deutsch', forced.map((r) => r.status).join(','));
    check(await PaymentRequest.countDocuments({ bookingId: T.booking._id, status: 'accepted_by_provider' }) === 2, '2 Protokolleintraege (Erstversand + bestaetigter Wiederversand)', await PaymentRequest.countDocuments({ bookingId: T.booking._id }));
  });

  // ------------------------------------------------------------------------------------
  await runSection('Zahlungsaufforderung: SMTP-Fehler, Wiederholung, Wiederversand (Rechnung)', async () => {
    const owner = await makeCustomer();
    const T = await openBookingWithInvoice(owner);
    const invoiceNumber = T.invoice.invoiceNumber;

    transportMode = 'fail';
    const failed = await call('POST', requestUrl(invoiceNumber), admin, {});
    transportMode = 'ok';
    check(failed.status === 200 && failed.body?.success === false && failed.body?.status === 'failed' && looksGerman(failed.body?.message),
      'SMTP-Fehler -> success:false, status failed, deutsche Meldung', `${failed.status} ${failed.body?.status} ${failed.body?.message}`);
    const failedRecord = await PaymentRequest.findOne({ invoiceId: T.invoice._id }).lean();
    check(failedRecord?.status === 'failed' && failedRecord?.targetType === 'invoice', 'Fehlversuch protokolliert (status failed)', failedRecord?.status);
    check(requestMailsTo(owner.email).length === 0, 'keine Mail angenommen', requestMailsTo(owner.email).length);
    check(await claims().countDocuments({}) === 0, 'kein Anspruch bleibt nach dem Fehler haengen', await claims().countDocuments({}));

    // Legitime Wiederholung (parallel, z. B. zwei Tabs) -> genau EIN Versand, nicht 24 h gesperrt
    const retries = await parallel(PARALLEL, () => call('POST', requestUrl(invoiceNumber), admin, {}));
    const retryOk = retries.filter((r) => r.status === 200 && r.body?.status === 'accepted_by_provider').length;
    out(`  INFO Wiederholung parallel: ${JSON.stringify(countBy(retries, (r) => `${r.status} ${r.body?.code || r.body?.status || ''}`))}`);
    check(retryOk === 1, 'Wiederholung nach Fehler nicht gesperrt, genau EIN Versand', retryOk);
    check(requestMailsTo(owner.email).length === 1, 'genau EINE Mail', requestMailsTo(owner.email).length);
    check(await PaymentRequest.countDocuments({ invoiceId: T.invoice._id, status: 'accepted_by_provider' }) === 1
      && await PaymentRequest.countDocuments({ invoiceId: T.invoice._id, status: 'failed' }) === 1,
    'Verlauf: 1 failed + 1 uebergeben', JSON.stringify(countBy(await PaymentRequest.find({ invoiceId: T.invoice._id }).lean(), (r) => r.status)));

    // Wiederversand des fehlgeschlagenen Eintrags, parallel: Sperrfrist greift (bereits versendet)
    const resendFailed = await parallel(5, () => call('POST', `/api/admin/financial/payment-requests/${failedRecord._id}/resend`, admin, {}));
    check(resendFailed.every((r) => r.status === 429 && r.body?.code === 'PAYMENT_REQUEST_COOLDOWN' && looksGerman(r.body?.error)),
      'Wiederversand innerhalb 24 h nach Erfolg -> 429 PAYMENT_REQUEST_COOLDOWN (bestehende Meldung)', resendFailed.map((r) => `${r.status} ${r.body?.code}`).join(','));
    check(requestMailsTo(owner.email).length === 1, 'keine weitere Mail', requestMailsTo(owner.email).length);
  });

  // ------------------------------------------------------------------------------------
  await runSection('Wiederversand (resend) parallel nach Fehlversuch', async () => {
    const owner = await makeCustomer();
    const T = await openBookingWithInvoice(owner);
    transportMode = 'fail';
    const failed = await call('POST', requestUrl(T.booking.bookingNumber), admin, {});
    transportMode = 'ok';
    check(failed.body?.status === 'failed', 'Ausgangslage: Fehlversuch', failed.body?.status);
    const failedId = failed.body?.requestId;
    const resends = await parallel(PARALLEL, () => call('POST', `/api/admin/financial/payment-requests/${failedId}/resend`, admin, {}));
    const ok = resends.filter((r) => r.status === 200 && r.body?.status === 'accepted_by_provider').length;
    out(`  INFO resend parallel: ${JSON.stringify(countBy(resends, (r) => `${r.status} ${r.body?.code || r.body?.status || ''}`))}`);
    check(ok === 1 && requestMailsTo(owner.email).length === 1, `resend x${PARALLEL} parallel -> genau EIN Versand`, `${ok} ok, Mails ${requestMailsTo(owner.email).length}`);
    check(resends.filter((r) => r.status !== 200).every((r) => [409, 429].includes(r.status) && looksGerman(r.body?.error)), 'uebrige -> 409/429 deutsch', resends.map((r) => r.status).join(','));
    const resent = await PaymentRequest.findOne({ bookingId: T.booking._id, status: 'accepted_by_provider' }).lean();
    check(resent && String(resent.resendOfId) === String(failedId), 'neuer Eintrag verweist auf das Original (resendOfId)', resent && String(resent.resendOfId));
    const forcedResend = await call('POST', `/api/admin/financial/payment-requests/${failedId}/resend`, admin, { force: true });
    check(forcedResend.status === 200 && forcedResend.body?.status === 'accepted_by_provider', 'resend mit force -> gesendet (bewusste Ausnahme)', `${forcedResend.status} ${forcedResend.body?.status}`);
  });

  // ------------------------------------------------------------------------------------
  await runSection('Verwaister und laufender Anspruch', async () => {
    const owner = await makeCustomer();
    const T = await openBookingWithInvoice(owner);
    const key = `booking:${T.booking._id}`;
    // Laufender Versand in einem anderen Prozess (Anspruch 10 s alt)
    await claims().insertOne({ _id: key, claimedAt: new Date(Date.now() - 10 * 1000) });
    const busy = await call('POST', requestUrl(T.booking.bookingNumber), admin, {});
    check(busy.status === 409 && busy.body?.code === 'PAYMENT_REQUEST_RECENT' && /Wird gerade gesendet/.test(busy.body?.error || ''),
      'laufender Versand -> 409 "Wird gerade gesendet"', `${busy.status} ${busy.body?.error}`);
    const busyForced = await call('POST', requestUrl(T.booking.bookingNumber), admin, { force: true });
    check(busyForced.status === 409 && busyForced.body?.code === 'PAYMENT_REQUEST_IN_PROGRESS' && looksGerman(busyForced.body?.error),
      'laufender Versand + force -> 409 PAYMENT_REQUEST_IN_PROGRESS (kein Doppelversand)', `${busyForced.status} ${busyForced.body?.code}`);
    check(requestMailsTo(owner.email).length === 0, 'keine Mail', requestMailsTo(owner.email).length);
    // K15-Nachtrag: Ein Versand kann laenger als 5 Minuten dauern (nodemailer-Standard-Timeouts
    // + Wiederholungen in der Verbindungsphase). Ein 6 Minuten alter Anspruch gehoert deshalb
    // noch zu einem laufenden Versand und darf NICHT uebernommen werden (vorher: Doppelversand).
    await claims().updateOne({ _id: key }, { $set: { claimedAt: new Date(Date.now() - 6 * 60 * 1000) } });
    const stillRunning = await call('POST', requestUrl(T.booking.bookingNumber), admin, { force: true });
    check(stillRunning.status === 409 && stillRunning.body?.code === 'PAYMENT_REQUEST_IN_PROGRESS',
      'Anspruch 6 Min. alt (Versand kann noch laufen) -> 409, kein Doppelversand', `${stillRunning.status} ${stillRunning.body?.code || stillRunning.body?.status}`);
    check(requestMailsTo(owner.email).length === 0, 'keine Mail', requestMailsTo(owner.email).length);
    // 44 Min. alt: liegt noch innerhalb der Anspruchsdauer (45 Min.) -> weiterhin gesperrt
    await claims().updateOne({ _id: key }, { $set: { claimedAt: new Date(Date.now() - 44 * 60 * 1000) } });
    const stillRunning44 = await call('POST', requestUrl(T.booking.bookingNumber), admin, { force: true });
    check(stillRunning44.status === 409 && stillRunning44.body?.code === 'PAYMENT_REQUEST_IN_PROGRESS',
      'Anspruch 44 Min. alt -> weiterhin 409, kein Doppelversand', `${stillRunning44.status} ${stillRunning44.body?.code || stillRunning44.body?.status}`);
    // Prozessabbruch: Anspruch aelter als die Anspruchsdauer (45 Min.) wird uebernommen
    await claims().updateOne({ _id: key }, { $set: { claimedAt: new Date(Date.now() - 46 * 60 * 1000) } });
    const later = await call('POST', requestUrl(T.booking.bookingNumber), admin, {});
    check(later.status === 200 && later.body?.status === 'accepted_by_provider', 'verwaister Anspruch (> 45 Min.) sperrt nicht', `${later.status} ${later.body?.status}`);
    check(await claims().countDocuments({}) === 0, 'Anspruch danach freigegeben', await claims().countDocuments({}));
  });

  // ------------------------------------------------------------------------------------
  // K15-Nachtrag: Die 24-h-Regel behandelt Buchung und Rechnung derselben Buchung als EIN Ziel
  // (jede Aufforderung speichert bookingId UND invoiceId). Der Anspruch muss dasselbe Ziel
  // abdecken, sonst senden "Buchung" und "Rechnung" (zwei Einstiege im Dialog) parallel doppelt.
  const crossScopeRound = async (label, round, fire) => {
    const owner = await makeCustomer();
    const T = await openBookingWithInvoice(owner);
    const results = await fire(T);
    const mails = requestMailsTo(owner.email);
    const sent = await PaymentRequest.countDocuments({ bookingId: T.booking._id, status: 'accepted_by_provider' });
    out(`  INFO ${label} Runde ${round}: ${results.map((r) => `${r.status} ${r.body?.code || r.body?.status || ''}`).join(' | ')} | Mails ${mails.length}`);
    check(mails.length === 1 && sent === 1, `${label} Runde ${round}: genau EINE Mail / EIN Versand`, `${mails.length} Mails, ${sent} uebergeben`);
    check(results.filter((r) => !(r.status === 200 && r.body?.status === 'accepted_by_provider'))
      .every((r) => [409, 429].includes(r.status) && looksGerman(r.body?.error)), `${label} Runde ${round}: Gegenseite 409/429 deutsch`, results.map((r) => r.status).join(','));
    check(await claims().countDocuments({}) === 0, `${label} Runde ${round}: kein Anspruch bleibt haengen`, await claims().countDocuments({}));
  };

  await runSection('Buchung || Rechnung derselben Buchung parallel (gemeinsamer Anspruch)', async () => {
    // (1) Wiederversand eines fehlgeschlagenen Buchungs-Eintrags || Aufforderung per Rechnungsnummer
    transportDelayMs = 200;
    for (let round = 0; round < 5; round += 1) {
      await crossScopeRound('resend(BKG) || request(INV)', round, async (T) => {
        transportMode = 'fail';
        const failed = await call('POST', requestUrl(T.booking.bookingNumber), admin, {});
        transportMode = 'ok';
        if (failed.body?.status !== 'failed') throw new Error(`Ausgangslage Fehlversuch fehlt: ${failed.status} ${failed.body?.status}`);
        return Promise.all([
          call('POST', `/api/admin/financial/payment-requests/${failed.body.requestId}/resend`, admin, {}),
          call('POST', requestUrl(T.invoice.invoiceNumber), admin, {}),
        ]);
      });
    }
    // (2) "trotzdem senden" in zwei Tabs: einmal per Buchungs-, einmal per Rechnungsnummer
    for (let round = 0; round < 5; round += 1) {
      await crossScopeRound('force(BKG) || force(INV)', round, (T) => Promise.all([
        call('POST', requestUrl(T.booking.bookingNumber), admin, { force: true }),
        call('POST', requestUrl(T.invoice.invoiceNumber), admin, { force: true }),
      ]));
    }
    // (3) ohne force, mit Latenz beim Aufbau des Links (produktiv: Lesen der SystemConfig)
    transportDelayMs = 60;
    const plainBuildSystemUrl = EmailService.buildSystemUrl;
    EmailService.buildSystemUrl = async (p) => { await sleep(30); return `http://test.invalid${p}`; };
    try {
      for (let round = 0; round < 10; round += 1) {
        await crossScopeRound('BKG || INV (Latenz)', round, (T) => Promise.all([
          call('POST', requestUrl(T.booking.bookingNumber), admin, {}),
          call('POST', requestUrl(T.invoice.invoiceNumber), admin, {}),
        ]));
      }
    } finally {
      EmailService.buildSystemUrl = plainBuildSystemUrl;
    }
  });

  // ------------------------------------------------------------------------------------
  // K15-Nachtrag: Der Halter gibt seinen Anspruch genau zwischen dem fehlgeschlagenen Einfuegen
  // (E11000) und der Uebernahme frei. Dann laeuft nichts mehr - die Anfrage darf nicht als
  // "wird gerade gesendet" abgelehnt werden, sondern muss den freien Anspruch nehmen.
  await runSection('Anspruch wird waehrend des Einfuegens freigegeben', async () => {
    const claimCollection = mongoose.connection.collection('paymentrequestclaims');
    const realInsertOne = claimCollection.insertOne;
    const releaseRace = async (body) => {
      const owner = await makeCustomer();
      const T = await openBookingWithInvoice(owner);
      const key = `booking:${T.booking._id}`;
      // Laufender Versand (anderer Prozess) haelt den Anspruch ...
      await claims().insertOne({ _id: key, claimedAt: new Date() });
      let raced = 0;
      claimCollection.insertOne = async function racedInsert(doc, ...rest) {
        if (doc?._id !== key || raced) return realInsertOne.call(this, doc, ...rest);
        raced += 1;
        try {
          return await realInsertOne.call(this, doc, ...rest); // echtes E11000 der Datenbank
        } finally {
          await claims().deleteOne({ _id: key }); // ... und gibt ihn genau jetzt frei
        }
      };
      let response;
      try {
        response = await call('POST', requestUrl(T.booking.bookingNumber), admin, body);
      } finally {
        claimCollection.insertOne = realInsertOne;
      }
      return { owner, T, response, raced };
    };

    const plain = await releaseRace({});
    check(plain.raced === 1, 'Zeitfenster getroffen (E11000, dann Freigabe)', plain.raced);
    check(plain.response.status === 200 && plain.response.body?.status === 'accepted_by_provider',
      'frei gewordener Anspruch -> gesendet statt 409 "Wird gerade gesendet"', `${plain.response.status} ${plain.response.body?.code || plain.response.body?.status}`);
    check(requestMailsTo(plain.owner.email).length === 1, 'genau EINE Mail', requestMailsTo(plain.owner.email).length);

    const forced = await releaseRace({ force: true });
    check(forced.response.status === 200 && forced.response.body?.status === 'accepted_by_provider',
      'force: frei gewordener Anspruch -> gesendet statt 409 PAYMENT_REQUEST_IN_PROGRESS', `${forced.response.status} ${forced.response.body?.code || forced.response.body?.status}`);
    check(requestMailsTo(forced.owner.email).length === 1, 'force: genau EINE Mail', requestMailsTo(forced.owner.email).length);
    check(await claims().countDocuments({}) === 0, 'kein Anspruch bleibt haengen', await claims().countDocuments({}));
  });

  // ------------------------------------------------------------------------------------
  // Browser-Ablauf K15: Buchungs-Aufforderung VOR der Rechnung (ohne invoiceId), danach ueber die
  // Rechnung erneut -> frueher sofort eine zweite Mail, weil die Rechnungs-Pruefung nur invoiceId las.
  await runSection('24-h-Sperre: Buchungs-Aufforderung vor der Rechnung zaehlt auch fuer die Rechnung', async () => {
    const cust = await makeCustomer();
    const T = await makeBooking(cust);
    const first = await call('POST', requestUrl(T.booking.bookingNumber), admin, {});
    check(first.status === 200 && first.body?.status === 'accepted_by_provider', 'Buchungs-Aufforderung ohne Rechnung gesendet', `${first.status} ${first.body?.status || first.body?.error}`);
    const stored = await PaymentRequest.findOne({ bookingId: T.booking._id }).lean();
    check(stored && !stored.invoiceId, 'gespeichert ohne invoiceId (Rechnung gab es noch nicht)', String(stored?.invoiceId || '-'));
    const created = await call('POST', `/api/bookings/${T.booking._id}/invoice`, staff, { sendImmediately: false });
    const invoice = await Invoice.findOne({ bookingId: T.booking._id }).lean();
    check(created.status === 201 && invoice?.invoiceNumber, 'Rechnung danach erstellt', `${created.status} ${invoice?.invoiceNumber}`);
    const mailsBefore = requestMailsTo(cust.email).length;
    const viaInvoice = await call('POST', requestUrl(invoice.invoiceNumber), admin, {});
    check(viaInvoice.status === 409 && viaInvoice.body?.code === 'PAYMENT_REQUEST_RECENT' && /Zuletzt am/.test(viaInvoice.body?.error || ''),
      'ueber die Rechnung innerhalb von 24 h -> 409 "Zuletzt am …" (Bestaetigung noetig)', `${viaInvoice.status} ${viaInvoice.body?.code} ${viaInvoice.body?.error}`);
    check(requestMailsTo(cust.email).length === mailsBefore, 'keine zweite Mail an den Kunden', requestMailsTo(cust.email).length - mailsBefore);
    // Wiederversand einer (fehlgeschlagenen) Rechnungs-Aufforderung derselben Buchung: gleiche Regel (429).
    const failedInvoiceRequest = await PaymentRequest.create({
      bookingId: T.booking._id, bookingNumber: T.booking.bookingNumber, targetType: 'invoice', invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber, channel: 'email', recipientEmail: cust.email, status: 'failed', requestedAt: new Date(), amount: 47.4,
    });
    const resend = await call('POST', `/api/admin/financial/payment-requests/${failedInvoiceRequest._id}/resend`, admin, {});
    check(resend.status === 429 && resend.body?.code === 'PAYMENT_REQUEST_COOLDOWN', 'Wiederversand ueber die Rechnung -> 429 Sperrfrist (Buchungs-Aufforderung zaehlt)', `${resend.status} ${resend.body?.code}`);
    check(requestMailsTo(cust.email).length === mailsBefore, 'auch beim Wiederversand keine zweite Mail', requestMailsTo(cust.email).length - mailsBefore);
    // Ausdrueckliche Bestaetigung bleibt moeglich (andere Rechnungen derselben Buchung sperren sich
    // nicht gegenseitig - Regel im Code, hier nicht eigens mit zweiter Rechnung geprueft).
    const forced = await call('POST', requestUrl(invoice.invoiceNumber), admin, { force: true });
    check(forced.status === 200 && requestMailsTo(cust.email).length === mailsBefore + 1, 'ausdrueckliche Bestaetigung (force) sendet genau eine Mail', `${forced.status} ${requestMailsTo(cust.email).length - mailsBefore}`);
    check(await claims().countDocuments({}) === 0, 'kein Anspruch bleibt haengen', await claims().countDocuments({}));
  });

  // ------------------------------------------------------------------------------------
  await runSection('Rollen unveraendert', async () => {
    const owner = await makeCustomer();
    const stranger = await makeCustomer();
    const T = await openBookingWithInvoice(owner);
    const asOwner = await call('POST', requestUrl(T.booking.bookingNumber), owner, {});
    const asStranger = await call('POST', requestUrl(T.booking.bookingNumber), stranger, {});
    const asStaff = await call('POST', requestUrl(T.booking.bookingNumber), staff, {});
    const anonymous = await call('POST', requestUrl(T.booking.bookingNumber), null, {});
    check(asOwner.status === 403 && asStranger.status === 403 && asStaff.status === 403 && anonymous.status === 401,
      'Kunde/fremder Kunde/Mitarbeiter 403, ohne Anmeldung 401', `${asOwner.status}/${asStranger.status}/${asStaff.status}/${anonymous.status}`);
    const listStranger = await call('GET', `/api/admin/financial/bookings/${encodeURIComponent(T.booking.bookingNumber)}/payment-requests`, stranger);
    check(listStranger.status === 403, 'Verlauf fuer Kunden 403', listStranger.status);
    check(requestMailsTo(owner.email).length === 0 && await PaymentRequest.countDocuments({ bookingId: T.booking._id }) === 0, 'nichts gesendet, nichts protokolliert', 0);
    const history = await call('GET', `/api/admin/financial/bookings/${encodeURIComponent(T.booking.bookingNumber)}/payment-requests`, admin);
    check(history.status === 200 && Array.isArray(history.body?.requests), 'Verlauf fuer Admin weiterhin abrufbar', history.status);
  });

  // ------------------------------------------------------------------------------------
  await runSection('"Rechnungen aus Auftraegen erstellen": parallel + Wiederholung', async () => {
    const cust = await makeCustomer();
    const single = await makeOrder(cust);
    const createAndSend = async (refs) => {
      // Wie der Client: erst erstellen, nur bei Erfolg "sofort per E-Mail senden".
      const created = await call('POST', '/api/admin/financial/invoices/from-repairs', admin, { repairOrderIds: refs, options: {} });
      if (created.status === 201) {
        const sent = await call('POST', `/api/admin/financial/invoices/${created.body.invoice._id}/send`, admin, { email: created.body.invoice.customerEmail });
        return { created, sent };
      }
      return { created };
    };
    const mailsBefore = accepted.filter((mail) => mail.to === cust.email).length;
    const runs = await parallel(PARALLEL, () => createAndSend([single.orderNumber]));
    const createdOk = runs.filter((r) => r.created.status === 201);
    out(`  INFO parallel: ${JSON.stringify(countBy(runs, (r) => `${r.created.status} ${r.created.body?.code || ''}`))}`);
    const invoicesForOrder = await Invoice.countDocuments({ isCreditNote: { $ne: true }, $or: [{ orderId: single._id }, { repairOrderIds: single._id }] });
    check(createdOk.length === 1 && invoicesForOrder === 1, `${PARALLEL} parallele Laeufe -> genau EINE Rechnung fuer den Auftrag`, `${createdOk.length} erstellt, ${invoicesForOrder} in DB`);
    check(runs.filter((r) => r.created.status !== 201).every((r) => r.created.status === 409 && looksGerman(r.created.body?.error)),
      'uebrige -> 409 deutsch (bereits berechnet)', JSON.stringify(countBy(runs.filter((r) => r.created.status !== 201), (r) => r.created.body?.code)));
    const invoiceMails = accepted.filter((mail) => mail.to === cust.email).length - mailsBefore;
    check(createdOk[0]?.sent?.status === 200 && invoiceMails === 1, '"sofort senden" -> genau EINE Rechnungs-Mail', `${createdOk[0]?.sent?.status} ${invoiceMails}`);

    const retry = await createAndSend([String(single._id)]);
    check(retry.created.status === 409 && retry.created.body?.existingInvoice?.invoiceNumber === createdOk[0]?.created.body?.invoice?.invoiceNumber,
      'Wiederholung (auch per ID) -> 409 mit bestehender Rechnung', `${retry.created.status} ${retry.created.body?.existingInvoice?.invoiceNumber}`);
    check(await Invoice.countDocuments({ isCreditNote: { $ne: true }, $or: [{ orderId: single._id }, { repairOrderIds: single._id }] }) === 1, 'weiterhin EINE Rechnung', 1);

    // Ueberlappende Auswahl derselben Buchung parallel: [A,B] (Gesamtrechnung) gegen [B] und [A]
    const B = await makeBooking(cust, 2);
    const [oA, oB] = B.orders;
    const overlap = await Promise.all([
      createAndSend([oA.orderNumber, oB.orderNumber]),
      createAndSend([oB.orderNumber]),
      createAndSend([oA.orderNumber]),
      createAndSend([oA.orderNumber, oB.orderNumber]),
    ]);
    out(`  INFO ueberlappend: ${overlap.map((r) => `${r.created.status} ${r.created.body?.code || ''}`).join(' | ')}`);
    const perOrder = async (order) => Invoice.countDocuments({ isCreditNote: { $ne: true }, status: { $nin: ['cancelled', 'credited'] }, $or: [{ orderId: order._id }, { repairOrderIds: order._id }] });
    const countA = await perOrder(oA);
    const countB = await perOrder(oB);
    check(countA === 1 && countB === 1, 'ueberlappende parallele Auswahl -> jeder Auftrag auf genau EINER Rechnung', `A=${countA} B=${countB}`);
    check(overlap.every((r) => [201, 409].includes(r.created.status)), 'nur 201/409, kein 500', overlap.map((r) => r.created.status).join(','));
  });

  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  const gitStatusAfter = require('child_process').execSync('git status --porcelain --untracked-files=all -- server/logs server/uploads uploads logs', { cwd: __dirname }).toString();
  check(gitStatusAfter === gitStatusBefore, 'keine Dateien im Repository hinterlassen (logs/uploads)', gitStatusAfter === gitStatusBefore ? 'unveraendert' : 'geaendert');
  try { fs.rmSync(LOG_REDIRECT_DIR, { recursive: true, force: true }); } catch (error) { /* ignore */ }
  out(`\nErgebnis: ${pass} PASS, ${fail} FAIL`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch(async (error) => {
  out(`ABBRUCH: ${error.stack || error.message}`);
  try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
  process.exit(1);
});
