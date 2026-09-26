/**
 * Regressionstest Track "documents" - Restbefunde aus der Pruefung (P0B_REVIEWS.md,
 * "REVIEW: payments-b") und die Altdaten-Skripte:
 *
 *   R19 Ungeklaerte PayPal-Erstattung: die 409-Meldung empfiehlt NICHT mehr, die
 *       Rueckzahlung als manuelle Erstattung zu erfassen (Doppelzaehlung, sobald der
 *       Anbieter-Vorgang doch noch abschliesst); eine manuelle Erstattung wird waehrend
 *       eines ungeklaerten Anbieter-Vorgangs abgelehnt; die Meldung verweist auf den Abgleich.
 *   R20 Eine ANDERE, neue Erstattung fuehrt den alten, ungeklaerten Vorgang NICHT erneut
 *       aus (kein Geldfluss als Nebenwirkung): der Stand wird nur beim Anbieter ABGEFRAGT.
 *   R21 Die Zahlungsliste liefert je Erstattungseintrag das Server-Flag `unresolved`
 *       (auch fuer Altbestand: ausstehend, Anbieter, ohne Referenz).
 *   R23 POST /api/invoices/:id/pay antwortet deutsch.
 *   R24 createInvoice mit orderId und fremden Positionen ohne Rabatt: KEIN Auftragsrabatt;
 *       mit den Auftragspositionen: der festgehaltene Auftragsrabatt genau einmal.
 *   L18 Bericht doppelter Rabatt (server/scripts/reportDoubleDiscountInvoices.js):
 *       findet Sophies Fall, zeigt Vorher/Vorschlag, listet unklare Faelle, schreibt NICHTS.
 *   L17 repairGrossNetInvoiceTotals.js veraendert ausgestellte Belege nicht.
 *
 * PayPal ist auf Service-Ebene gestubbt (PaypalService.refundCapture/getOrder zaehlen
 * Aufrufe) - es gibt KEINEN Netzwerkzugriff.
 *
 * Aufruf (benoetigt eine WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_doc_residual node test-documents-residual.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Module = require('module');
const { execFileSync } = require('child_process');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_documents_residual';

// Sicherheitsnetz: Dieser Test ruft dropDatabase() auf. Er darf ausschliesslich gegen eine
// ausdruecklich angegebene Wegwerf-Datenbank laufen - nie gegen die Entwicklungsdatenbank.
// Erlaubt ist nur: lokaler Host, AUSDRUECKLICH angegebener Port ungleich 27017, und ein
// Datenbankname, der nicht der Name der Entwicklungsdatenbank aus .env ist.
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

const QR_STUB = path.join(SERVER_DIR, 'node_modules', '__qrcode_test_stub__.js');
require.cache[QR_STUB] = { id: QR_STUB, filename: QR_STUB, loaded: true, exports: { toBuffer: async () => Buffer.alloc(0) } };
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolveWithQrStub(request, ...rest) {
  if (request === 'qrcode') return QR_STUB;
  return originalResolve.call(this, request, ...rest);
};

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const MANUAL_ADVICE = /manuelle Erstattung erfasst|als manuelle Erstattung/i;

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.EMAIL_TEST_TRANSPORT = 'stream';

  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  const MODELS_DIR = path.join(SERVER_DIR, 'models');
  fs.readdirSync(MODELS_DIR).filter((file) => file.endsWith('.js')).forEach((file) => {
    try { require(path.join(MODELS_DIR, file)); } catch (error) { /* optional */ }
  });
  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Invoice = mongoose.model('Invoice');
  const Payment = mongoose.model('Payment');
  const PaymentAllocation = mongoose.model('PaymentAllocation');
  await Promise.all([Payment.init(), PaymentAllocation.init(), Invoice.init()]);

  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.logger = { info() {}, warn() {}, error() {}, debug() {} };
  EmailService.deliveryTracker = { recordDelivery() {} };
  EmailService.sendTemplateEmail = async () => ({ success: true, messageId: 'm' });
  EmailService.buildSystemUrl = async (p) => `https://test.invalid${p}`;
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });

  // PayPal auf Service-Ebene: jede ausgefuehrte Erstattung und jede Abfrage wird gezaehlt.
  const PaypalService = require(path.join(SERVER_DIR, 'services/paypalService'));
  const paypal = { refundCalls: [], orderQueries: [], orders: new Map(), mode: 'COMPLETED' };
  PaypalService.getActiveGateway = async () => ({ configuration: {} });
  PaypalService.getAccessToken = async () => ({ accessToken: 't', baseUrl: 'https://paypal.invalid' });
  PaypalService.refundCapture = async (captureId, amount, { requestId } = {}) => {
    paypal.refundCalls.push({ captureId, amount, requestId });
    if (paypal.mode === 'TIMEOUT') {
      const error = new Error('Zeitueberschreitung (Test)');
      error.refundOutcome = 'indeterminate';
      throw error;
    }
    return { id: `RF-${paypal.refundCalls.length}`, status: 'COMPLETED', amount: { value: Number(amount).toFixed(2) } };
  };
  PaypalService.getOrder = async (orderId) => {
    paypal.orderQueries.push(orderId);
    return paypal.orders.get(orderId) || null;
  };

  const FinancialService = require(path.join(SERVER_DIR, 'services/financialService'));
  const invoiceRoutes = require(path.join(SERVER_DIR, 'routes/invoiceRoutes'));
  const financialRoutes = require(path.join(SERVER_DIR, 'routes/financialRoutes'));
  const app = express();
  app.use(express.json());
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/admin/financial', financialRoutes);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, { user = null, body = null } = {}) => {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await response.json(); } catch (error) { json = null; }
    return { status: response.status, body: json };
  };

  const admin = await User.create({ name: 'Admin Rest', email: 'admin-rest@test.invalid', role: 'admin' });
  const customer = await User.create({ name: 'Rita Rest', email: 'rita@test.invalid', role: 'customer', discount: 15 });
  const stranger = await User.create({ name: 'Fremd', email: 'fremd-rest@test.invalid', role: 'customer' });

  const paypalPayment = async (amount, captureId, orderId) => Payment.create({
    customerId: customer._id, amount, paymentMethod: 'paypal', status: 'completed', source: 'checkout',
    processedAt: new Date(), metadata: { paypalOrderId: orderId, providerReference: captureId, providerDetails: { captureId } },
  });

  await runSection('R19/R20 Ungeklaerte PayPal-Erstattung: keine Wiederholung als Nebenwirkung, keine manuelle Doppelbuchung', async () => {
    const payment = await paypalPayment(100, 'CAP-R20', 'ORDER-R20');
    paypal.mode = 'TIMEOUT';
    const first = await FinancialService.processRefund(String(payment._id), 20, 'Teilerstattung A', { mode: 'gateway', idempotencyKey: 'dlg-a' });
    check(first.status === 'pending' && first.indeterminate === true, 'Zeitueberschreitung: ausstehend, ungeklaert', `${first.status} ${first.indeterminate}`);
    paypal.mode = 'COMPLETED';
    const callsBefore = paypal.refundCalls.length;

    // Andere Erstattung (neuer Dialog): der alte Vorgang darf NICHT erneut ausgefuehrt werden.
    let blocked = null;
    try {
      await FinancialService.processRefund(String(payment._id), 15, 'Andere Erstattung', { mode: 'gateway', idempotencyKey: 'dlg-b' });
    } catch (error) { blocked = error; }
    check(paypal.refundCalls.length === callsBefore, 'kein PayPal-Erstattungsaufruf (weder alt noch neu)', paypal.refundCalls.length - callsBefore);
    check(paypal.orderQueries.includes('ORDER-R20'), 'Stand wird beim Anbieter nur abgefragt', JSON.stringify(paypal.orderQueries));
    check(blocked && blocked.statusCode === 409 && blocked.code === 'REFUND_UNRESOLVED', 'neue Erstattung: 409 REFUND_UNRESOLVED', blocked ? `${blocked.code}` : 'nicht abgelehnt');
    check(blocked && !MANUAL_ADVICE.test(blocked.message) && /Abgleich/.test(blocked.message), 'Meldung empfiehlt Abgleich, NICHT manuelle Erstattung', blocked ? blocked.message : '-');

    let manualBlocked = null;
    try {
      await FinancialService.processRefund(String(payment._id), 20, 'Rueckzahlung per Ueberweisung', { mode: 'manual' });
    } catch (error) { manualBlocked = error; }
    const stored = await Payment.findById(payment._id).lean();
    check(manualBlocked && manualBlocked.statusCode === 409 && !stored.refundAmount, 'manuelle Erstattung waehrend ungeklaertem Anbieter-Vorgang abgelehnt', manualBlocked ? `${manualBlocked.code} ${stored.refundAmount || 0}` : 'gebucht!');

    // Anbieter-Stand zeigt die Erstattung (Webhook fehlte): Abfrage klaert sie OHNE Ausfuehrung.
    paypal.orders.set('ORDER-R20', { id: 'ORDER-R20', purchase_units: [{ payments: { refunds: [{ id: 'RF-PAYPAL-1', status: 'COMPLETED', amount: { value: '20.00', currency_code: 'EUR' }, note_to_payer: 'Teilerstattung A', create_time: new Date().toISOString() }] } }] });
    let recheck = null;
    try {
      await FinancialService.processRefund(String(payment._id), 15, 'Andere Erstattung', { mode: 'gateway', idempotencyKey: 'dlg-b' });
    } catch (error) { recheck = error; }
    const settled = await Payment.findById(payment._id).lean();
    check(paypal.refundCalls.length === callsBefore, 'Klaerung ohne erneute Ausfuehrung', paypal.refundCalls.length - callsBefore);
    check(round2(settled.refundAmount) === 20 && settled.refunds[0].status === 'completed' && settled.refunds[0].reference === 'RF-PAYPAL-1', 'alter Vorgang per Abfrage geklaert (20, Referenz)', `${settled.refundAmount} ${settled.refunds[0].reference}`);
    check(recheck && recheck.code === 'REFUND_SETTLED_RECHECK', 'neue Erstattung angehalten, damit der Bearbeiter den Stand prueft', recheck ? recheck.code : 'nicht angehalten');
    const next = await FinancialService.processRefund(String(payment._id), 15, 'Andere Erstattung', { mode: 'gateway', idempotencyKey: 'dlg-b' });
    const after = await Payment.findById(payment._id).lean();
    check(next.status === 'completed' && round2(after.refundAmount) === 35 && paypal.refundCalls.length === callsBefore + 1, 'danach: bewusste neue Erstattung 15 (einmal ausgefuehrt)', `${next.status} ${after.refundAmount}`);

    // Wiederholung DESSELBEN Vorgangs (gleicher Dialog) darf mit seiner Request-ID nachfragen.
    const p2 = await paypalPayment(50, 'CAP-R20B', 'ORDER-R20B');
    paypal.mode = 'TIMEOUT';
    await FinancialService.processRefund(String(p2._id), 10, 'Gleicher Dialog', { mode: 'gateway', idempotencyKey: 'dlg-same' });
    paypal.mode = 'COMPLETED';
    const replay = await FinancialService.processRefund(String(p2._id), 10, 'Gleicher Dialog', { mode: 'gateway', idempotencyKey: 'dlg-same' });
    const calls = paypal.refundCalls.filter((c) => c.captureId === 'CAP-R20B');
    check(replay.duplicate === true && calls.length === 2 && calls[0].requestId === calls[1].requestId, 'gleicher Dialog: dieselbe Request-ID (PayPal-idempotent)', calls.map((c) => c.requestId.slice(-8)).join(','));
  });

  await runSection('R21 Server-Flag unresolved in der Zahlungsliste', async () => {
    const legacy = await Payment.create({
      customerId: customer._id, amount: 40, paymentMethod: 'paypal', status: 'completed', source: 'checkout', processedAt: new Date(),
      refunds: [{ amount: 10, status: 'pending', mode: 'gateway', provider: 'paypal', reference: '' }],
    });
    const res = await call('GET', '/api/admin/financial/payments?limit=100', { user: admin });
    const entry = (res.body?.payments || []).find((p) => String(p._id) === String(legacy._id));
    check(entry && entry.refunds && entry.refunds[0].unresolved === true, 'Altbestand ohne Merker: unresolved=true', entry ? JSON.stringify(entry.refunds[0].unresolved) : 'fehlt');
  });

  await runSection('R23 POST /api/invoices/:id/pay antwortet deutsch', async () => {
    const invoice = await Invoice.create({
      customerId: customer._id, customerName: customer.name, customerEmail: customer.email,
      items: [{ description: 'Pos', quantity: 1, unitPrice: 30, total: 30, type: 'fee' }], dueDate: new Date(Date.now() + 7 * 86400000), status: 'sent',
    });
    const missing = await call('POST', `/api/invoices/${new mongoose.Types.ObjectId()}/pay`, { user: customer, body: { amount: 10, gatewayProvider: 'bank_transfer', gatewayId: 'x' } });
    const foreign = await call('POST', `/api/invoices/${invoice._id}/pay`, { user: stranger, body: { amount: 10, gatewayProvider: 'bank_transfer', gatewayId: 'x' } });
    const gateway = await call('POST', `/api/invoices/${invoice._id}/pay`, { user: customer, body: { amount: 10, gatewayProvider: 'bank_transfer', gatewayId: 'gibt-es-nicht' } });
    const redirect = await call('POST', `/api/invoices/${invoice._id}/pay`, { user: customer, body: { amount: 10, gatewayProvider: 'paypal', gatewayId: 'x' } });
    const english = /not found|permission|not available|require redirect|Invalid|exceeds|Missing/i;
    [['404', missing], ['403', foreign], ['Zahlungsart', gateway], ['Weiterleitung', redirect]].forEach(([label, r]) => {
      check(r.body && r.body.error && !english.test(r.body.error), `deutsche Meldung (${label})`, `${r.status} ${r.body?.error}`);
    });
    check(missing.status === 404 && foreign.status === 403, 'Statuscodes unveraendert (404/403)', `${missing.status}/${foreign.status}`);
  });

  await runSection('R24 createInvoice mit orderId: Auftragsrabatt nur fuer die Auftragspositionen', async () => {
    const order = await Order.create({
      customerId: customer._id, orderNumber: 'ORD-2026-8801', deviceBrand: 'Apple', deviceModel: 'iPhone', deviceType: 'Smartphone', errorDescription: 'x',
      services: [{ isManual: true, name: 'Display', price: 49.9, quantity: 1, estimatedTime: 0 }], totalCost: 42.42, discount: 7.48, status: 'completed',
    });
    const fee = await FinancialService.createInvoice({
      customerId: customer._id, orderId: order._id,
      items: [{ description: 'Bearbeitungsgebühr', quantity: 1, unitPrice: 10, total: 10, type: 'fee' }],
    });
    check(round2(fee.discount) === 0 && round2(fee.total) === 10, 'Gebuehrenrechnung zum Auftrag: kein Auftragsrabatt', `${fee.discount} / ${fee.total}`);
    await Invoice.updateOne({ _id: fee._id }, { $set: { status: 'cancelled' } });
    const own = await FinancialService.createInvoice({
      customerId: customer._id, orderId: order._id,
      items: [{ serviceName: 'Display', description: 'Display', quantity: 1, unitPrice: 49.9, total: 49.9, type: 'service' }],
    });
    check(round2(own.discount) === 7.48 && round2(own.total) === 42.42, 'Auftragspositionen: festgehaltener Rabatt genau einmal (42,42)', `${own.discount} / ${own.total}`);
  });

  await runSection('L18 Bericht doppelter Kundengruppenrabatt (nur lesend)', async () => {
    const orderS = await Order.create({
      customerId: customer._id, orderNumber: 'ORD-2026-004', deviceBrand: 'Apple', deviceModel: 'iPhone', deviceType: 'Smartphone', errorDescription: 'x',
      services: [{ isManual: true, name: 'Display', price: 49.9, quantity: 1, estimatedTime: 0 }], totalCost: 42.42, discount: 7.48, status: 'completed',
    });
    // Sophies INV-2026-0007 (22.09.): Rabatt 13,84, Brutto 36,06 statt 7,48 / 42,42.
    await Invoice.collection.insertOne({
      invoiceNumber: 'INV-2026-0007', customerId: customer._id, customerName: customer.name, customerEmail: customer.email,
      orderId: orderS._id, items: [{ serviceName: 'Display', description: 'Display', quantity: 1, unitPrice: 49.9, total: 49.9 }],
      discount: 13.84, total: 36.06, subtotal: 30.3, tax: 5.76, taxRate: 19, status: 'sent', isCreditNote: false,
      dueDate: new Date('2026-09-29'), createdAt: new Date('2026-09-22T10:00:00Z'), updatedAt: new Date('2026-09-22T10:00:00Z'),
    });
    const orderOk = await Order.create({
      customerId: customer._id, orderNumber: 'ORD-2026-005', deviceBrand: 'Apple', deviceModel: 'iPad', deviceType: 'Tablet', errorDescription: 'x',
      services: [{ isManual: true, name: 'Akku', price: 60, quantity: 1, estimatedTime: 0 }], totalCost: 51, discount: 9, status: 'completed',
    });
    await Invoice.collection.insertOne({
      invoiceNumber: 'INV-2026-0008', customerId: customer._id, customerName: customer.name, customerEmail: customer.email,
      orderId: orderOk._id, items: [{ serviceName: 'Akku', quantity: 1, unitPrice: 60, total: 60 }], discount: 9, total: 51, subtotal: 42.86, tax: 8.14, taxRate: 19,
      status: 'paid', isCreditNote: false, dueDate: new Date('2026-09-29'), createdAt: new Date('2026-09-22T11:00:00Z'), updatedAt: new Date('2026-09-22T11:00:00Z'),
    });
    // Unklar: Rechnung ueber ZWEI Auftraege, von denen einer fehlt.
    await Invoice.collection.insertOne({
      invoiceNumber: 'INV-2026-0009', customerId: customer._id, customerName: customer.name, customerEmail: customer.email,
      repairOrderIds: [orderOk._id, new mongoose.Types.ObjectId()], items: [], discount: 20, total: 80, subtotal: 67.23, tax: 12.77, taxRate: 19,
      status: 'sent', isCreditNote: false, dueDate: new Date('2026-09-30'), createdAt: new Date('2026-09-23T11:00:00Z'), updatedAt: new Date('2026-09-23T11:00:00Z'),
    });

    const hashCollections = async () => {
      const parts = [];
      for (const name of ['invoices', 'orders', 'payments', 'paymentallocations']) {
        const docs = await mongoose.connection.db.collection(name).find({}).sort({ _id: 1 }).toArray();
        parts.push(JSON.stringify(docs));
      }
      return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
    };
    const before = await hashCollections();
    const script = path.join(SERVER_DIR, 'scripts/reportDoubleDiscountInvoices.js');
    let output = '';
    let exitCode = 0;
    try {
      output = execFileSync(process.execPath, [script, '--from', '2026-09-22'], { env: { ...process.env, DATABASE_URL: URI, NODE_OPTIONS: process.env.NODE_OPTIONS || '' }, encoding: 'utf8' });
    } catch (error) { output = String(error.stdout || '') + String(error.stderr || ''); exitCode = error.status; }
    const after = await hashCollections();
    check(exitCode === 0, 'Skript laeuft ohne Fehler', exitCode);
    check(before === after, 'Datenbank unveraendert (nur lesend)', `${before.slice(0, 10)} / ${after.slice(0, 10)}`);
    check(/INV-2026-0007/.test(output) && /13,84/.test(output) && /7,48/.test(output) && /36,06/.test(output) && /42,42/.test(output), 'Sophies Fall mit Vorher/Vorschlag (13,84/36,06 -> 7,48/42,42)', (output.match(/INV-2026-0007[^\n]*/) || ['-'])[0]);
    check(/Storno/.test(output), 'Vorschlag: Storno + neue Rechnung, keine stille Korrektur', /Storno/.test(output) ? 'ja' : 'nein');
    check(!/INV-2026-0008/.test(output.split(/UNKLAR/i)[0] || output), 'korrekte Rechnung nicht als Treffer', 'geprueft');
    check(/UNKLAR[\s\S]*INV-2026-0009/i.test(output), 'unklarer Fall separat gelistet', (output.match(/INV-2026-0009[^\n]*/) || ['-'])[0]);
    let refused = '';
    try {
      execFileSync(process.execPath, [script, '--apply'], { env: { ...process.env, DATABASE_URL: URI }, encoding: 'utf8' });
    } catch (error) { refused = String(error.stdout || '') + String(error.stderr || ''); }
    check(/nur lesend|schreibt nicht|kein Schreib/i.test(refused) && (await hashCollections()) === before, '--apply wird verweigert', refused.split('\n')[0]);
  });

  await runSection('L17 repairGrossNetInvoiceTotals.js aendert keine ausgestellten Belege', async () => {
    const issued = await Invoice.collection.insertOne({
      invoiceNumber: 'INV-2025-0100', customerId: customer._id, customerName: 'Alt', customerEmail: 'alt@test.invalid',
      items: [{ description: 'Alt', quantity: 1, unitPrice: 119, total: 119 }], discount: 0, subtotal: 119, tax: 22.61, total: 141.61, taxRate: 19,
      status: 'sent', isCreditNote: false, dueDate: new Date('2025-01-10'), createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01'),
    });
    const draft = await Invoice.collection.insertOne({
      invoiceNumber: 'INV-2025-0101', customerId: customer._id, customerName: 'Alt', customerEmail: 'alt@test.invalid',
      items: [{ description: 'Alt', quantity: 1, unitPrice: 119, total: 119 }], discount: 0, subtotal: 119, tax: 22.61, total: 141.61, taxRate: 19,
      status: 'draft', isCreditNote: false, dueDate: new Date('2025-01-10'), createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01'),
    });
    const script = path.join(SERVER_DIR, 'scripts/repairGrossNetInvoiceTotals.js');
    const run = (args) => {
      try {
        return execFileSync(process.execPath, [script, ...args], { env: { ...process.env, DATABASE_URL: URI, MONGODB_URI: URI }, encoding: 'utf8' });
      } catch (error) { return String(error.stdout || '') + String(error.stderr || ''); }
    };
    const dry = run([]);
    const afterDry = await Invoice.collection.findOne({ _id: issued.insertedId });
    check(round2(afterDry.total) === 141.61, 'Trockenlauf aendert nichts', afterDry.total);
    run(['--apply']);
    run(['--confirm']);
    const afterApply = await Invoice.collection.findOne({ _id: issued.insertedId });
    check(round2(afterApply.total) === 141.61 && round2(afterApply.tax) === 22.61, 'ausgestellte Rechnung bleibt unveraendert (auch mit --apply)', `${afterApply.total} / ${afterApply.tax}`);
    check(/INV-2025-0100/.test(dry) && /Storno|ausgestellt|nicht ge(ä|ae)ndert/i.test(dry), 'Skript meldet den ausgestellten Beleg als Pruefbedarf', (dry.match(/INV-2025-0100[^\n]*/) || ['-'])[0]);
    const draftAfter = await Invoice.collection.findOne({ _id: draft.insertedId });
    check(draftAfter, 'Entwurf vorhanden (darf korrigiert werden)', draftAfter ? draftAfter.total : '-');
  });

  // ---------------------------------------------------------------------------------
  // documents-b: Kundensicht ohne Interna, deutsche Meldungen, begrenzte PDF-Archive.
  // ---------------------------------------------------------------------------------
  const staffUser = await User.create({ name: 'Mitarbeiter Rest', email: 'staff-rest@test.invalid', role: 'staff' });
  // Die Altdaten-Abschnitte oben legen Belege mit festen Nummern (INV-2026-0007 ...) direkt an;
  // der Zaehler wird darueber gesetzt, damit neue Belege nicht mit ihnen kollidieren.
  await mongoose.model('DocumentSequence').updateOne(
    { documentType: 'invoice', year: new Date().getFullYear() },
    { $max: { sequence: 900 } },
    { upsert: true }
  );
  let docbSeq = 0;
  const makeCustomerInvoice = async (gross = 60) => {
    docbSeq += 1;
    const order = await Order.create({
      customerId: customer._id, orderNumber: `ORD-2026-6${String(docbSeq).padStart(3, '0')}`,
      deviceBrand: 'Samsung', deviceModel: 'Galaxy S22', deviceType: 'Smartphone', errorDescription: 'Display',
      services: [{ isManual: true, name: 'Displaytausch', description: 'Original', price: gross, quantity: 1, estimatedTime: 0 }],
      totalCost: gross, discount: 0, status: 'completed',
    });
    const invoice = await FinancialService.createInvoiceFromOrder(order._id);
    return { order, invoice };
  };
  const INTERNAL_MARKERS = ['auditTrail', 'dunningLock', 'allocationLock', 'dunningLastFailure', 'documentArchive', 'documentHistory', 'actorName', 'actorId', 'emailError', 'GEHEIM-TOKEN', 'SMTP 550 relay denied', 'Interne Sachbearbeiterin', 'allocatedAtCancellation', 'previousStatus'];
  const leaks = (value) => { const text = JSON.stringify(value || {}); return INTERNAL_MARKERS.filter((marker) => text.includes(marker)); };
  const seedInternals = (invoiceId) => Invoice.collection.updateOne({ _id: invoiceId }, {
    $set: {
      dunningLock: { token: 'GEHEIM-TOKEN-1', at: new Date(Date.now() - 60 * 60 * 1000) },
      allocationLock: { token: 'GEHEIM-TOKEN-2', at: new Date(Date.now() - 60 * 60 * 1000) },
      dunningLastFailure: { at: new Date(), stage: 'payment_reminder', error: 'SMTP 550 relay denied' },
      dunningHistory: [{ stage: 'payment_reminder', executedAt: new Date(), result: 'failed', emailError: 'SMTP 550 relay denied', recipient: 'rita@test.invalid', source: 'manual' }],
    },
    $push: { auditTrail: { at: new Date(), action: 'email_failed', actorName: 'Interne Sachbearbeiterin', detail: 'SMTP 550 relay denied' } },
  });

  await runSection('D1 Kundenendpunkte liefern keine internen Felder', async () => {
    const { order, invoice } = await makeCustomerInvoice(60);
    await FinancialService.cancelInvoice(invoice._id, { reason: 'Kundenwunsch', actorName: 'Interne Sachbearbeiterin', actorId: admin._id });
    await seedInternals(invoice._id);
    const { invoice: open } = await makeCustomerInvoice(40);
    await seedInternals(open._id);

    const list = await call('GET', '/api/invoices?limit=200', { user: customer });
    const listEntry = (list.body?.invoices || []).find((entry) => String(entry._id) === String(invoice._id));
    check(list.status === 200 && listEntry && leaks(list.body.invoices).length === 0, 'GET /api/invoices: keine Interna', listEntry ? (leaks(list.body.invoices).join(',') || 'sauber') : `${list.status} nicht gefunden`);
    check(listEntry && listEntry.status === 'cancelled' && listEntry.invoiceNumber === invoice.invoiceNumber && listEntry.cancellation?.kind === 'storno'
      && /^INV-CN-/.test(listEntry.cancellation?.creditNoteNumber || '') && listEntry.cancellation?.reason === 'Kundenwunsch' && round2(listEntry.total) === 60 && listEntry.balance,
    'Liste: Kundenfelder vollstaendig (Status, Nummer, Betrag, Storno-Hinweis, Saldo)', listEntry ? JSON.stringify({ s: listEntry.status, c: listEntry.cancellation }) : '-');

    const detail = await call('GET', `/api/invoices/${invoice._id}`, { user: customer });
    const d = detail.body?.invoice;
    check(detail.status === 200 && d && leaks(d).length === 0, 'GET /api/invoices/:id: keine Interna', d ? (leaks(d).join(',') || 'sauber') : detail.status);
    check(d && Array.isArray(d.items) && d.items.length > 0 && Array.isArray(d.relatedCreditNotes) && d.relatedCreditNotes.length === 1 && Array.isArray(d.paymentHistory) && d.balance,
      'Detail: Positionen, Gutschriften, Zahlungshistorie, Saldo vorhanden', d ? `${(d.items || []).length} / ${(d.relatedCreditNotes || []).length}` : '-');

    const forOrder = await call('GET', `/api/invoices/for-order/${order._id}`, { user: customer });
    check(forOrder.status === 200 && (forOrder.body?.invoices || []).length >= 1 && leaks(forOrder.body.invoices).length === 0, 'GET /api/invoices/for-order/:id (Kunde): keine Interna', leaks(forOrder.body?.invoices).join(',') || forOrder.status);

    const viewed = await call('PUT', `/api/invoices/${open._id}/view`, { user: customer });
    check(viewed.status === 200 && viewed.body?.invoice?.status === 'viewed' && leaks(viewed.body.invoice).length === 0, 'PUT /api/invoices/:id/view: keine Interna', `${viewed.status} ${leaks(viewed.body?.invoice).join(',') || 'sauber'}`);

    const staffDetail = await call('GET', `/api/invoices/${invoice._id}`, { user: staffUser });
    check(staffDetail.status === 200 && Array.isArray(staffDetail.body?.invoice?.auditTrail) && staffDetail.body.invoice.auditTrail.length > 0, 'Mitarbeiter: Detail weiterhin vollstaendig (Revisionsspur)', staffDetail.status);
  });

  await runSection('D2 Weiterleitungs-Zahlung: deutsche Meldungen', async () => {
    const { invoice } = await makeCustomerInvoice(25);
    const init = await call('POST', `/api/invoices/${invoice._id}/payments/initialize`, { user: customer, body: { amount: 25, gatewayId: 'x', gatewayProvider: 'bank_transfer' } });
    check(init.status === 400 && !/Only Stripe|redirect/i.test(init.body?.error || '') && /[äöüÄÖÜß]|Zahlungsart/.test(init.body?.error || '') && init.body?.code === 'UNSUPPORTED_REDIRECT_PROVIDER',
      'initialize mit Ueberweisung: 400, deutsch, Code', `${init.status} ${init.body?.code} ${init.body?.error}`);
    const confirm = await call('POST', `/api/invoices/${invoice._id}/payments/confirm`, { user: customer, body: { gatewayProvider: 'bank_transfer', providerReference: 'x' } });
    check(confirm.status === 400 && !/Only Stripe|redirect tokens/i.test(confirm.body?.error || '') && confirm.body?.code === 'UNSUPPORTED_REDIRECT_PROVIDER',
      'confirm mit Ueberweisung: 400, deutsch, Code', `${confirm.status} ${confirm.body?.code} ${confirm.body?.error}`);
  });

  await runSection('D3 PDF-Archiv waechst nicht unbegrenzt, ausgestellte Fassung bleibt erhalten', async () => {
    const BSON = mongoose.mongo.BSON;
    const docSize = async (id) => BSON.calculateObjectSize(await Invoice.collection.findOne({ _id: id }));
    const shaOf = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
    const binToBuf = (raw) => (raw && raw._bsontype === 'Binary' ? Buffer.from(raw.read(0, raw.length())) : Buffer.from(raw || []));
    const { invoice } = await makeCustomerInvoice(70);
    const issued = await FinancialService.ensureInvoiceDocument(invoice._id, { reason: 'Test' });
    const issuedSha = shaOf(issued.buffer);
    const sizeAfterIssue = await docSize(invoice._id);
    const REGENERATIONS = 24; // > Obergrenze der Historie im Beleg (20)
    for (let i = 1; i <= REGENERATIONS; i += 1) {
      // Betragsrelevante Aenderung wie im Altweg syncOrderAndBookingValue (direkt, ohne Hooks).
      await Invoice.collection.updateOne({ _id: invoice._id }, { $set: { 'items.0.description': `Fassung ${i}` } });
      await FinancialService.ensureInvoiceDocument(invoice._id, { reason: `Neu ${i}` });
    }
    const sizeAfter = await docSize(invoice._id);
    check(sizeAfter < sizeAfterIssue + REGENERATIONS * 2048 && sizeAfter < 64 * 1024, `nach ${REGENERATIONS} Neufassungen: Rechnungsdokument waechst nicht um die PDF-Bytes`, `${sizeAfterIssue} -> ${sizeAfter} Bytes (PDF ~${issued.buffer.length} Bytes)`);
    const raw = await Invoice.collection.findOne({ _id: invoice._id });
    const inlineBytes = (raw.documentHistory || []).filter((entry) => entry.data).length + (raw.documentArchive?.data ? 1 : 0);
    check(inlineBytes === 0, 'keine PDF-Bytes mehr im Rechnungsdokument (weder aktuell noch Historie)', inlineBytes);
    check((raw.documentHistory || []).length === 20 && (raw.documentHistory || [])[0]?.version === 1 && (raw.documentHistory || [])[19]?.version === REGENERATIONS && (raw.documentHistory || [])[0]?.sha256 === issuedSha,
      'Historie im Beleg begrenzt, ausgestellte Fassung 1 (Hash) bleibt vermerkt', `${(raw.documentHistory || []).length} Eintraege, erste Fassung ${(raw.documentHistory || [])[0]?.version}`);
    const Archive = mongoose.models.InvoiceDocumentArchive;
    const versions = Archive ? await Archive.find({ invoiceId: invoice._id }).sort({ version: 1 }).lean() : [];
    const v1 = versions.find((entry) => entry.version === 1);
    const v1Bytes = v1 ? binToBuf(v1.data) : null;
    check(v1Bytes && shaOf(v1Bytes) === issuedSha && v1.sha256 === issuedSha, 'Bytes der ausgestellten Fassung 1 unveraendert abrufbar (sha256)', v1 ? v1.sha256.slice(0, 12) : 'keine Archivsammlung');
    check(versions.length === REGENERATIONS + 1 && new Set(versions.map((entry) => entry.version)).size === REGENERATIONS + 1, 'jede Fassung liegt genau einmal in der Archivsammlung', versions.length);
    const current = await call('GET', `/api/invoices/${invoice._id}/pdf`, { user: customer });
    check(current.status === 200 || current.status === undefined, 'aktuelle Fassung abrufbar', current.status);
    const again = await FinancialService.ensureInvoiceDocument(invoice._id, { reason: 'Abruf' });
    check(again.created === false && again.version === REGENERATIONS + 1 && shaOf(again.buffer) === raw.documentArchive.sha256, 'erneuter Abruf: dieselbe (letzte) Fassung, keine neue', `${again.created} v${again.version}`);

    // Altbestand: PDF-Bytes noch inline (aktuelle Fassung + Historie).
    const { invoice: legacy } = await makeCustomerInvoice(35);
    const legacyDoc = await Invoice.findById(legacy._id);
    const InvoicePdfService = require(path.join(SERVER_DIR, 'services/invoicePdfService'));
    const fp = InvoicePdfService.buildDocumentFingerprint(legacyDoc);
    const legacyV1 = Buffer.from('%PDF-1.4 Altfassung 1 (inline)');
    const legacyV2 = Buffer.from('%PDF-1.4 Altfassung 2 (inline)');
    // Ein echter Altbeleg hat keine Eintraege in der Archivsammlung (die Anlage oben hat
    // bereits nach neuem Schema archiviert - das wird fuer den Altbestand entfernt).
    if (Archive) await Archive.deleteMany({ invoiceId: legacy._id });
    await Invoice.collection.updateOne({ _id: legacy._id }, { $set: {
      documentArchive: { data: legacyV2, sha256: shaOf(legacyV2), size: legacyV2.length, fingerprint: fp, generatedAt: new Date(), version: 2 },
      documentHistory: [{ data: legacyV1, sha256: shaOf(legacyV1), fingerprint: 'alt', generatedAt: new Date(), supersededAt: new Date(), version: 1 }],
    } });
    const legacyRead = await FinancialService.ensureInvoiceDocument(legacy._id, { reason: 'Abruf' });
    check(legacyRead.created === false && legacyRead.buffer.equals(legacyV2), 'Altbestand mit Inline-Bytes wird unveraendert ausgeliefert', legacyRead.buffer.toString().slice(0, 30));
    await Invoice.collection.updateOne({ _id: legacy._id }, { $set: { 'items.0.description': 'Geaendert' } });
    const regenerated = await FinancialService.ensureInvoiceDocument(legacy._id, { reason: 'Neu' });
    const legacyRaw = await Invoice.collection.findOne({ _id: legacy._id });
    const legacyVersions = Archive ? await Archive.find({ invoiceId: legacy._id }).sort({ version: 1 }).lean() : [];
    const bytesOf = (entry) => (entry ? binToBuf(entry.data) : Buffer.alloc(0));
    check(regenerated.created === true && regenerated.version === 3 && !legacyRaw.documentArchive?.data && !(legacyRaw.documentHistory || []).some((entry) => entry.data),
      'Neufassung eines Altbelegs: Inline-Bytes ausgelagert', `v${regenerated.version}`);
    check(legacyVersions.length === 3 && bytesOf(legacyVersions[0]).equals(legacyV1) && bytesOf(legacyVersions[1]).equals(legacyV2),
      'Altfassungen 1 und 2 byte-genau in der Archivsammlung erhalten', legacyVersions.map((entry) => `v${entry.version}`).join(','));
  });

  out(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (error) => {
  out('ERROR:', error.stack || error.message);
  try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
  process.exit(2);
});
