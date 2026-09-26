/**
 * Regressionstest "invoice-integrity" (letzte Welle).
 *
 *   A. Unique-Index auf Invoice.activeBillingKeys (partiell): baut auch bei Altbestand mit
 *      doppelten aktiven Rechnungen je Auftrag/Buchung und bei leeren Arrays.
 *   B. Doppelklick "Rechnung erstellen": N parallele createInvoiceFromOrder /
 *      generateFromRepairOrders / createInvoice fuer DENSELBEN Auftrag -> genau EINE
 *      aktive Rechnung; Verlierer bekommen die deutsche 409 mit der Nummer des Gewinners.
 *   C. Dasselbe fuer DIESELBE Buchung (zwei Auftraege, gemischte Wege).
 *   D. Admin-Route POST /api/admin/financial/orders/:orderId/invoice parallel.
 *   E. Storno -> Neuausstellung bleibt moeglich (auch parallel: genau eine neue Rechnung);
 *      verbrauchte Nummern der Verlierer werden nie wiederverwendet.
 *   F. Vollgutschrift -> Neuausstellung; verworfener Gutschrift-Entwurf oeffnet das
 *      Original nur wieder, wenn keine neue Rechnung aktiv ist.
 *   G. Kundenendpunkte /pay, /payments/confirm (alle Antwortzweige) ohne Interna;
 *      PUT /:id/view fuer einen Entwurf/Freigabebeleg -> 404.
 *   H. Mahnschritt: Lesefehler nach dem Versand fuehrt nicht zu einem zweiten Schreiben;
 *      unklarer Stand haelt die Sperre (kein automatischer Neuversand); richtige Notiz.
 *   I. Inkasso: Zahlung waehrend des Versands -> Stufe wird nicht auf einen bezahlten Beleg gesetzt.
 *   J. Storno-Fortsetzung uebernimmt keinen noch laufenden Storno (zweiter Klick).
 *
 * Kein Netz: E-Mail, Benachrichtigungen, Stripe (axios) und 'qrcode' sind Stubs.
 *
 * Aufruf (benoetigt eine WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_integrity node test-invoice-integrity.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Module = require('module');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));
// Dieselbe Modulinstanz wie in den Routen (require('axios') aus server/).
const axios = require(require.resolve('axios', { paths: [SERVER_DIR] }));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_invoice_integrity';

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
const DAY = 24 * 60 * 60 * 1000;

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.EMAIL_TEST_TRANSPORT = 'stream';
  delete process.env.GOOGLE_REVIEW_URL;

  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  const MODELS_DIR = path.join(SERVER_DIR, 'models');
  fs.readdirSync(MODELS_DIR).filter((file) => file.endsWith('.js')).forEach((file) => {
    try { require(path.join(MODELS_DIR, file)); } catch (error) { /* optional */ }
  });
  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Booking = mongoose.model('Booking');
  const Invoice = mongoose.model('Invoice');
  const Payment = mongoose.model('Payment');
  const PaymentAllocation = mongoose.model('PaymentAllocation');
  await Promise.all([Payment.init(), PaymentAllocation.init(), Invoice.init()]);

  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.logger = { info() {}, warn() {}, error() {}, debug() {} };
  EmailService.deliveryTracker = { recordDelivery() {} };
  const mails = [];
  let mailHook = null;
  EmailService.sendTemplateEmail = async (templateName, to, variables) => {
    if (mailHook) { const hook = mailHook; mailHook = null; await hook(); }
    mails.push({ templateName, to, variables });
    return { success: true, messageId: `m${mails.length}` };
  };
  EmailService.buildSystemUrl = async (p) => `https://test.invalid${p}`;
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });
  NotificationService.createPaymentNotification = async () => null;

  // Stripe-Abfrage der Weiterleitungs-Bestaetigung: Stub (kein Netz).
  const stripeSessions = new Map();
  axios.get = async (url) => {
    const id = String(url).split('/').pop();
    if (!stripeSessions.has(id)) throw new Error(`Unerwarteter HTTP-Aufruf im Test: ${url}`);
    return { data: stripeSessions.get(id) };
  };
  axios.post = async (url) => { throw new Error(`Unerwarteter HTTP-Aufruf im Test: ${url}`); };

  const FinancialService = require(path.join(SERVER_DIR, 'services/financialService'));
  FinancialService.getPaymentGateways = async () => ([
    { _id: 'gateway1', name: 'Stripe', provider: 'stripe', isActive: true, configuration: { mode: 'test', test_secret_key: 'sk_test_stub', currency: 'EUR' } },
    { _id: 'gateway3', name: 'Überweisung', provider: 'bank_transfer', isActive: true, configuration: { currency: 'EUR' } },
  ]);
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
  const tryCall = async (fn) => { try { return { value: await fn() }; } catch (error) { return { error }; } };
  const settle = (promises) => Promise.all(promises.map((p) => p.then((value) => ({ value }), (error) => ({ error }))));

  const admin = await User.create({ name: 'Admin Integritaet', email: 'admin-int@test.invalid', role: 'admin' });
  const customer = await User.create({ name: 'Ina Integer', email: 'ina@test.invalid', role: 'customer', customerNumber: 'K-40001' });

  let orderSeq = 0;
  const makeOrder = async (gross = 50, extra = {}) => {
    orderSeq += 1;
    return Order.create({
      customerId: customer._id, orderNumber: `ORD-2026-7${String(orderSeq).padStart(3, '0')}`,
      deviceBrand: 'Apple', deviceModel: 'iPhone 12', deviceType: 'Smartphone', errorDescription: 'Display',
      services: [{ isManual: true, name: 'Displaytausch', description: 'Original', price: gross, quantity: 1, estimatedTime: 0 }],
      totalCost: gross, discount: 0, status: 'completed', ...extra,
    });
  };
  const makeBookingWithOrders = async (grossA = 40, grossB = 60) => {
    const a = await makeOrder(grossA);
    const b = await makeOrder(grossB);
    const booking = await Booking.create({
      customerId: customer._id, orderIds: [a._id, b._id],
      items: [
        { type: 'repair', orderId: a._id, orderNumber: a.orderNumber, cost: grossA },
        { type: 'repair', orderId: b._id, orderNumber: b.orderNumber, cost: grossB },
      ],
      totalCost: grossA + grossB, status: 'processing',
    });
    await Order.updateMany({ _id: { $in: [a._id, b._id] } }, { $set: { bookingId: booking._id } });
    return { a: await Order.findById(a._id), b: await Order.findById(b._id), booking };
  };
  const ACTIVE = { isCreditNote: { $ne: true }, status: { $nin: ['cancelled', 'credited'] } };
  const activeForOrder = (orderId) => Invoice.find({ ...ACTIVE, $or: [{ orderId }, { repairOrderIds: orderId }] }).lean();
  const activeForBooking = (bookingId) => Invoice.find({ ...ACTIVE, bookingId }).lean();
  const manualItems = (gross) => [{ serviceName: 'Displaytausch', description: 'Displaytausch', quantity: 1, unitPrice: gross, total: gross, type: 'service' }];
  const seqOf = (number) => Number(String(number || '').split('-').pop());
  const germanConflict = (error, winnerNumber) => error && error.statusCode === 409
    && ['ORDER_ALREADY_INVOICED', 'INVOICE_ALREADY_EXISTS'].includes(error.code)
    && /besteht bereits die Rechnung/.test(error.message || '')
    && (!winnerNumber || String(error.message).includes(winnerNumber))
    && !/E11000|duplicate key/i.test(error.message || '');

  await runSection('A Index activeBillingKeys: partiell, unique, baut trotz Altbestand', async () => {
    const legacyOrderId = new mongoose.Types.ObjectId();
    const legacyBookingId = new mongoose.Types.ObjectId();
    // Altbestand: zwei AKTIVE Rechnungen fuer denselben Auftrag bzw. dieselbe Buchung (ohne
    // Schluessel) und ein Dokument mit leerem Array - darf den Indexbau nicht scheitern lassen.
    await Invoice.collection.insertMany([
      { invoiceNumber: 'LEGACY-1', orderId: legacyOrderId, bookingId: legacyBookingId, status: 'sent', total: 10, items: [] },
      { invoiceNumber: 'LEGACY-2', orderId: legacyOrderId, bookingId: legacyBookingId, status: 'paid', total: 10, items: [] },
      { invoiceNumber: 'LEGACY-3', status: 'sent', total: 5, items: [], activeBillingKeys: [] },
      { invoiceNumber: 'LEGACY-4', status: 'sent', total: 5, items: [], activeBillingKeys: [] },
    ]);
    const existing = await Invoice.collection.indexes();
    const named = existing.find((idx) => idx.key && idx.key.activeBillingKeys === 1);
    if (named) await Invoice.collection.dropIndex(named.name);
    const built = await tryCall(() => Invoice.createIndexes());
    const indexes = await Invoice.collection.indexes();
    const idx = indexes.find((entry) => entry.key && entry.key.activeBillingKeys === 1);
    check(!built.error && idx && idx.unique === true && idx.partialFilterExpression,
      'Index vorhanden, unique und partiell - Bau mit Altbestand fehlerfrei',
      built.error ? built.error.message : JSON.stringify(idx || null));
    await Invoice.collection.deleteMany({ invoiceNumber: { $in: ['LEGACY-1', 'LEGACY-2', 'LEGACY-3', 'LEGACY-4'] } });
  });

  await runSection('B Doppelklick: N parallele Rechnungen fuer DENSELBEN Auftrag -> genau eine', async () => {
    const o1 = await makeOrder(49.9);
    const r1 = await settle(Array.from({ length: 6 }, () => FinancialService.createInvoiceFromOrder(o1._id)));
    const act1 = await activeForOrder(o1._id);
    const winner1 = r1.find((r) => r.value)?.value;
    check(act1.length === 1 && r1.filter((r) => r.value).length === 1, '6x createInvoiceFromOrder parallel: genau eine aktive Rechnung', `aktiv=${act1.length} erfolgreich=${r1.filter((r) => r.value).length}`);
    check(r1.filter((r) => r.error).every((r) => germanConflict(r.error, winner1?.invoiceNumber)),
      'Verlierer: deutsche 409 mit der Nummer der bestehenden Rechnung', r1.filter((r) => r.error).map((r) => `${r.error.code}:${r.error.message.slice(0, 60)}`).join(' | ') || 'keine Verlierer');

    const o2 = await makeOrder(30);
    const r2 = await settle(Array.from({ length: 6 }, () => FinancialService.generateFromRepairOrders([o2._id])));
    const act2 = await activeForOrder(o2._id);
    check(act2.length === 1, '6x generateFromRepairOrders parallel: genau eine aktive Rechnung', `aktiv=${act2.length} erfolgreich=${r2.filter((r) => r.value).length}`);
    check(r2.filter((r) => r.error).every((r) => germanConflict(r.error)), 'Verlierer (Sammelrechnung): deutsche 409', r2.filter((r) => r.error).map((r) => r.error.code).join(','));

    const o3 = await makeOrder(20);
    const r3 = await settle(Array.from({ length: 6 }, () => FinancialService.createInvoice({ customerId: customer._id, orderId: o3._id, items: manualItems(20) })));
    const act3 = await activeForOrder(o3._id);
    check(act3.length === 1, '6x createInvoice (orderId) parallel: genau eine aktive Rechnung', `aktiv=${act3.length} erfolgreich=${r3.filter((r) => r.value).length}`);
    check(r3.filter((r) => r.error).every((r) => germanConflict(r.error)), 'Verlierer (manuelle Rechnung): deutsche 409', r3.filter((r) => r.error).map((r) => r.error.code).join(','));

    const o4 = await makeOrder(25);
    const r4 = await settle([
      FinancialService.createInvoiceFromOrder(o4._id),
      FinancialService.generateFromRepairOrders([o4._id]),
      FinancialService.createInvoice({ customerId: customer._id, orderId: o4._id, items: manualItems(25) }),
      FinancialService.createInvoiceFromOrder(o4._id),
      FinancialService.generateFromRepairOrders([o4._id]),
    ]);
    const act4 = await activeForOrder(o4._id);
    check(act4.length === 1, 'gemischte Wege parallel fuer denselben Auftrag: genau eine aktive Rechnung', `aktiv=${act4.length} erfolgreich=${r4.filter((r) => r.value).length}`);

    const seqCheck = await tryCall(() => FinancialService.createInvoiceFromOrder(o1._id));
    check(germanConflict(seqCheck.error, winner1?.invoiceNumber), 'nacheinander: weiterhin deutsche 409', seqCheck.error ? seqCheck.error.code : 'NICHT abgelehnt');
  });

  await runSection('C Doppelklick: N parallele Rechnungen fuer DIESELBE Buchung -> genau eine', async () => {
    const { a, b, booking } = await makeBookingWithOrders(40, 60);
    const results = await settle([
      FinancialService.createInvoiceFromOrder(a._id),
      FinancialService.createInvoiceFromOrder(b._id),
      FinancialService.createInvoiceFromOrder(a._id),
      FinancialService.createInvoiceFromOrder(b._id),
      FinancialService.generateFromRepairOrders([a._id, b._id]),
      FinancialService.generateFromRepairOrders([a._id, b._id]),
      FinancialService.createInvoice({ customerId: customer._id, bookingId: booking._id, items: manualItems(100) }),
      FinancialService.createInvoice({ customerId: customer._id, bookingId: booking._id, items: manualItems(100) }),
    ]);
    const active = await activeForBooking(booking._id);
    check(active.length === 1 && results.filter((r) => r.value).length === 1, '8 parallele Wege fuer eine Buchung: genau eine aktive Rechnung', `aktiv=${active.length} erfolgreich=${results.filter((r) => r.value).length}`);
    check(results.filter((r) => r.error).every((r) => germanConflict(r.error)), 'Verlierer: deutsche 409', results.filter((r) => r.error).map((r) => r.error.code).join(','));
  });

  await runSection('D Admin-Route: Doppelklick auf "Rechnung erstellen"', async () => {
    const order = await makeOrder(42.42);
    const responses = await Promise.all(Array.from({ length: 5 }, () => call('POST', `/api/admin/financial/orders/${order._id}/invoice`, { user: admin, body: {} })));
    const created = responses.filter((r) => r.status === 201);
    const conflicts = responses.filter((r) => r.status === 409);
    const active = await activeForOrder(order._id);
    check(created.length === 1 && conflicts.length === 4 && active.length === 1, '5 parallele POST: einmal 201, viermal 409, eine aktive Rechnung', `${responses.map((r) => r.status).join(',')} aktiv=${active.length}`);
    const winnerNumber = created[0]?.body?.invoice?.invoiceNumber;
    check(conflicts.every((r) => /besteht bereits die Rechnung/.test(r.body?.error || '') && String(r.body?.error || '').includes(winnerNumber || '#')),
      '409-Antworten: deutsch, nennen die bestehende Rechnung', conflicts.map((r) => r.body?.error).slice(0, 1).join(''));
  });

  await runSection('E Storno -> Neuausstellung (auch parallel) und Nummernkreis', async () => {
    const order = await makeOrder(80);
    const first = await FinancialService.createInvoiceFromOrder(order._id);
    const cancel = await FinancialService.cancelInvoice(first._id, { reason: 'Falscher Betrag', actorName: 'Admin' });
    const cancelledDoc = await Invoice.findById(first._id).lean();
    const creditDoc = await Invoice.findById(cancel.creditNote?._id).lean();
    check(cancelledDoc.status === 'cancelled' && !(cancelledDoc.activeBillingKeys || []).length && creditDoc && !(creditDoc.activeBillingKeys || []).length,
      'stornierte Rechnung und Storno-Gutschrift tragen keinen aktiven Schluessel', JSON.stringify({ o: cancelledDoc.activeBillingKeys || null, c: creditDoc?.activeBillingKeys || null }));
    const reissues = await settle(Array.from({ length: 6 }, () => FinancialService.createInvoiceFromOrder(order._id)));
    const active = await activeForOrder(order._id);
    check(active.length === 1 && reissues.filter((r) => r.value).length === 1, 'nach Storno: 6 parallele Neuausstellungen -> genau eine neue Rechnung', `aktiv=${active.length}`);
    const reissued = active[0];
    check(reissued && reissued.invoiceNumber !== first.invoiceNumber && round2(reissued.total) === 80, 'neue Rechnung: eigene Nummer, Betrag 80', reissued ? `${reissued.invoiceNumber} ${reissued.total}` : '-');
    check(reissued && Array.isArray(reissued.activeBillingKeys) && reissued.activeBillingKeys.includes(`order:${order._id}`), 'neue Rechnung beansprucht den Auftrag', JSON.stringify(reissued?.activeBillingKeys || null));

    // Nummernkreis: keine Nummer doppelt, eine spaetere Nummer liegt hinter allen bisherigen.
    const all = await Invoice.find({ isCreditNote: { $ne: true }, invoiceNumber: /^INV-\d{4}-/ }).select('invoiceNumber').lean();
    const numbers = all.map((i) => i.invoiceNumber);
    const next = await FinancialService.createInvoice({ customerId: customer._id, items: manualItems(5) });
    check(new Set(numbers).size === numbers.length && seqOf(next.invoiceNumber) > Math.max(...numbers.map(seqOf)),
      'Nummern eindeutig; verbrauchte Nummern der Verlierer werden nicht wiederverwendet', `${numbers.length} Nummern, naechste ${next.invoiceNumber}`);

    // Auch ein zweiter Korrekturzyklus funktioniert.
    await FinancialService.cancelInvoice(reissued._id, { reason: 'Nochmals', actorName: 'Admin' });
    const third = await tryCall(() => FinancialService.generateFromRepairOrders([order._id]));
    check(third.value && third.value.invoiceNumber, 'zweites Storno -> Sammelrechnung moeglich', third.value ? third.value.invoiceNumber : `${third.error?.code} ${third.error?.message}`);
  });

  await runSection('F Vollgutschrift, verworfener Gutschrift-Entwurf', async () => {
    const order = await makeOrder(70);
    const inv = await FinancialService.createInvoiceFromOrder(order._id);
    const note = await FinancialService.createCreditNote(inv._id, { reason: 'Kulanz voll' });
    const credited = await Invoice.findById(inv._id).lean();
    check(credited.status === 'credited' && !(credited.activeBillingKeys || []).length, 'vollstaendig gutgeschrieben: Schluessel freigegeben', `${credited.status} ${JSON.stringify(credited.activeBillingKeys || null)}`);
    // Ohne neue Rechnung: Verwerfen des Gutschrift-Entwurfs oeffnet das Original wieder MIT Schluessel.
    await FinancialService.discardDraftInvoice(note._id, { reason: 'Irrtum' });
    const reopened = await Invoice.findById(inv._id).lean();
    check(reopened.status !== 'credited' && (reopened.activeBillingKeys || []).includes(`order:${order._id}`), 'wieder geoeffnet: Schluessel wiederhergestellt', `${reopened.status} ${JSON.stringify(reopened.activeBillingKeys || null)}`);
    const dup = await tryCall(() => FinancialService.createInvoiceFromOrder(order._id));
    check(germanConflict(dup.error, inv.invoiceNumber), 'wieder geoeffnet: zweite Rechnung abgelehnt', dup.error ? dup.error.code : 'NICHT abgelehnt');

    // Mit neuer Rechnung: Verwerfen des Gutschrift-Entwurfs wird abgelehnt (das Original
    // muesste wieder aufleben -> zwei aktive Rechnungen).
    const note2 = await FinancialService.createCreditNote(inv._id, { reason: 'Kulanz voll 2' });
    const reissue = await FinancialService.createInvoiceFromOrder(order._id);
    const refused = await tryCall(() => FinancialService.discardDraftInvoice(note2._id, { reason: 'Irrtum 2' }));
    const active = await activeForOrder(order._id);
    const original = await Invoice.findById(inv._id).lean();
    const note2Stored = await Invoice.findById(note2._id).lean();
    check(refused.error && refused.error.statusCode === 409 && refused.error.code === 'CREDIT_NOTE_DISCARD_BLOCKED' && String(refused.error.message).includes(reissue.invoiceNumber),
      'neue Rechnung aktiv: Verwerfen des Gutschrift-Entwurfs abgelehnt (deutsch, nennt die neue Rechnung)', refused.error ? `${refused.error.code} ${refused.error.message}` : 'NICHT abgelehnt');
    check(active.length === 1 && String(active[0]._id) === String(reissue._id) && original.status === 'credited' && note2Stored.status === 'draft',
      'genau eine aktive Rechnung, Original bleibt gutgeschrieben, Entwurf bleibt', `aktiv=${active.length} original=${original.status} entwurf=${note2Stored.status}`);

    // Wettlauf (neue Rechnung entsteht zwischen Pruefung und Wiedereroeffnen): der Index
    // verhindert die zweite aktive Rechnung, das Original bleibt gutgeschrieben.
    const originalFindOne = Invoice.findOne;
    let skipCheck = true;
    Invoice.findOne = function findOneRace(filter, ...rest) {
      if (skipCheck && filter && filter.activeBillingKeys) { skipCheck = false; return originalFindOne.call(this, { _id: null }, ...rest); }
      return originalFindOne.call(this, filter, ...rest);
    };
    const raced = await tryCall(() => FinancialService.discardDraftInvoice(note2._id, { reason: 'Irrtum 3' }));
    Invoice.findOne = originalFindOne;
    const activeAfterRace = await activeForOrder(order._id);
    const originalAfterRace = await Invoice.findById(inv._id).lean();
    check(!raced.error && activeAfterRace.length === 1 && originalAfterRace.status === 'credited'
      && (originalAfterRace.auditTrail || []).some((e) => e.action === 'reopen_blocked'),
    'Wettlauf: genau eine aktive Rechnung, Original bleibt gutgeschrieben, Revisionsspur vermerkt es', raced.error ? raced.error.message : `aktiv=${activeAfterRace.length} ${originalAfterRace.status}`);
  });

  const INTERNAL_MARKERS = ['auditTrail', 'dunningLock', 'allocationLock', 'dunningLastFailure', 'documentArchive', 'GEHEIM-TOKEN', 'SMTP 550', 'Interne Sachbearbeiterin', 'activeBillingKeys'];
  const leaks = (value) => { const text = JSON.stringify(value || {}); return INTERNAL_MARKERS.filter((marker) => text.includes(marker)); };
  const seedInternals = (invoiceId) => Invoice.collection.updateOne({ _id: invoiceId }, {
    $set: {
      dunningLock: { token: 'GEHEIM-TOKEN-1', at: new Date(Date.now() - 60 * 60 * 1000) },
      allocationLock: { token: 'GEHEIM-TOKEN-2', at: new Date(Date.now() - 60 * 60 * 1000) },
      dunningLastFailure: { at: new Date(), stage: 'payment_reminder', error: 'SMTP 550 relay denied' },
    },
    $push: { auditTrail: { at: new Date(), action: 'email_failed', actorName: 'Interne Sachbearbeiterin', detail: 'SMTP 550 relay denied' } },
  });

  await runSection('G Kundenendpunkte /pay, /payments/confirm, /view ohne Interna', async () => {
    const order = await makeOrder(60);
    const inv = await FinancialService.createInvoiceFromOrder(order._id);
    await seedInternals(inv._id);
    const payBody = { amount: 10, gatewayId: 'gateway3', gatewayProvider: 'bank_transfer', paymentData: { accountHolder: 'Ina Integer', iban: 'DE02120300000000202051' } };
    const pay = await call('POST', `/api/invoices/${inv._id}/pay`, { user: customer, body: payBody });
    check(pay.status === 202 && pay.body?.invoice && leaks(pay.body).length === 0, 'POST /pay (202, neu vorgemerkt): keine Interna', `${pay.status} ${leaks(pay.body).join(',') || 'sauber'} ${pay.body?.error || ''}`);
    check(pay.body?.invoice?.invoiceNumber === inv.invoiceNumber && pay.body?.invoice?.balance && Array.isArray(pay.body?.invoice?.items), 'POST /pay: Kundenfelder bleiben (Nummer, Saldo, Positionen)', pay.body?.invoice?.invoiceNumber);
    const payAgain = await call('POST', `/api/invoices/${inv._id}/pay`, { user: customer, body: payBody });
    check(payAgain.status === 202 && payAgain.body?.alreadyRecorded === true && leaks(payAgain.body).length === 0, 'POST /pay (202, bereits vorgemerkt): keine Interna', `${payAgain.status} ${leaks(payAgain.body).join(',') || 'sauber'}`);

    await Payment.create({ invoiceId: inv._id, customerId: customer._id, amount: 5, paymentMethod: 'stripe', status: 'completed', source: 'gateway', processedAt: new Date(), metadata: { providerReference: 'cs_existing' } });
    const existing = await call('POST', `/api/invoices/${inv._id}/payments/confirm`, { user: customer, body: { gatewayProvider: 'stripe', gatewayId: 'gateway1', providerReference: 'cs_existing' } });
    check(existing.status === 200 && existing.body?.alreadyRecorded === true && leaks(existing.body).length === 0, 'POST /payments/confirm (bereits erfasst, 200): keine Interna', `${existing.status} ${leaks(existing.body).join(',') || 'sauber'} ${existing.body?.error || ''}`);

    stripeSessions.set('cs_new', { id: 'cs_new', metadata: { invoiceId: String(inv._id) }, payment_status: 'paid', amount_total: 1000, currency: 'eur' });
    const confirmed = await call('POST', `/api/invoices/${inv._id}/payments/confirm`, { user: customer, body: { gatewayProvider: 'stripe', gatewayId: 'gateway1', providerReference: 'cs_new' } });
    check(confirmed.status === 201 && leaks(confirmed.body).length === 0 && confirmed.body?.invoice?.balance, 'POST /payments/confirm (neu erfasst, 201): keine Interna', `${confirmed.status} ${leaks(confirmed.body).join(',') || 'sauber'} ${confirmed.body?.error || ''}`);

    // Zweig result.duplicate (paralleler Rueckruf): addInvoicePayment meldet ein Duplikat.
    stripeSessions.set('cs_dup', { id: 'cs_dup', metadata: { invoiceId: String(inv._id) }, payment_status: 'paid', amount_total: 500, currency: 'eur' });
    const originalAdd = FinancialService.addInvoicePayment;
    FinancialService.addInvoicePayment = async (invoiceId) => ({ payment: { _id: 'p-dup' }, invoice: await Invoice.findById(invoiceId), duplicate: true });
    const duplicate = await call('POST', `/api/invoices/${inv._id}/payments/confirm`, { user: customer, body: { gatewayProvider: 'stripe', gatewayId: 'gateway1', providerReference: 'cs_dup' } });
    FinancialService.addInvoicePayment = originalAdd;
    check(duplicate.status === 200 && duplicate.body?.alreadyRecorded === true && leaks(duplicate.body).length === 0, 'POST /payments/confirm (Duplikat, 200): keine Interna', `${duplicate.status} ${leaks(duplicate.body).join(',') || 'sauber'} ${duplicate.body?.error || ''}`);

    // Entwurf/Freigabe: PUT /view wie GET /:id -> 404, keine Interna, kein Statuswechsel.
    const pending = await Invoice.create({
      customerId: customer._id, customerName: customer.name, customerEmail: customer.email,
      items: manualItems(99), status: 'pending_approval', dueDate: new Date(Date.now() + 14 * DAY), notes: 'Interne Notiz: Kunde zahlt schlecht',
    });
    const view = await call('PUT', `/api/invoices/${pending._id}/view`, { user: customer });
    const detail = await call('GET', `/api/invoices/${pending._id}`, { user: customer });
    const stored = await Invoice.findById(pending._id).lean();
    check(view.status === 404 && detail.status === 404 && !JSON.stringify(view.body || {}).includes('Interne Notiz') && stored.status === 'pending_approval',
      'PUT /view fuer Freigabebeleg: 404 wie GET, keine Notizen, Status unveraendert', `${view.status}/${detail.status} ${stored.status}`);
    check(/nicht gefunden/.test(view.body?.error || '') && view.body?.code === 'INVOICE_NOT_FOUND', 'PUT /view: deutsche Meldung und Code', `${view.body?.code} ${view.body?.error}`);
    const openView = await call('PUT', `/api/invoices/${inv._id}/view`, { user: customer });
    check(openView.status === 200 && leaks(openView.body).length === 0, 'PUT /view fuer ausgestellte Rechnung weiterhin 200 ohne Interna', `${openView.status} ${leaks(openView.body).join(',') || 'sauber'}`);
  });

  let seq = 0;
  const makeOverdue = async (gross, overdueDays, extra = {}) => {
    seq += 1;
    const created = new Date(Date.now() - (overdueDays + 7) * DAY);
    return Invoice.create({
      customerId: customer._id, customerName: customer.name, customerEmail: customer.email,
      items: [{ serviceName: `Mahnfall ${seq}`, description: 'Reparatur', quantity: 1, unitPrice: gross, total: gross, type: 'service' }],
      dueDate: new Date(Date.now() - overdueDays * DAY), status: 'sent', createdAt: created, ...extra,
    });
  };
  const originalFindById = Invoice.findById;
  let failReads = 0;
  Invoice.findById = function findByIdWithFault(...args) {
    if (failReads > 0) { failReads -= 1; throw new Error('Simulierter Lesefehler (Test)'); }
    return originalFindById.apply(this, args);
  };

  await runSection('H Mahnschritt: Lesefehler nach dem Versand, verlorene Sperre', async () => {
    // a) Lesefehler nach erfolgreichem Versand: kein zweites Schreiben derselben Stufe.
    const a = await makeOverdue(80, 20);
    mails.length = 0;
    mailHook = async () => { failReads = 1; };
    const r1 = await FinancialService.processDunningStep(a._id, { source: 'manual' });
    failReads = 0;
    const r2 = await FinancialService.processDunningStep(a._id, { source: 'manual' });
    await FinancialService.runDunningJob();
    const sa = await Invoice.findById(a._id).lean();
    const mailsA = mails.filter((m) => m.variables?.invoiceNumber === a.invoiceNumber);
    check(mailsA.length === 1, 'Lesefehler nach Versand: genau EIN Schreiben (kein Doppelversand)', `${mailsA.length} Mails, r1=${r1.outcome}/${r1.stage} r2=${r2.outcome}`);
    check(sa.dunningStage === 'payment_reminder' && Number(sa.dunningLevel) === 1 && !sa.dunningLock, 'versendete Stufe ist vermerkt, Sperre frei', `${sa.dunningStage}/${sa.dunningLevel} ${JSON.stringify(sa.dunningLock || null)}`);
    check(!(sa.dunningHistory || []).some((h) => /bezahlt oder storniert/.test(h.note || '')), 'keine falsche Notiz "bezahlt oder storniert"', (sa.dunningHistory || []).map((h) => h.note || h.result).join(' | '));

    // b) Lesefehler UND Zahlung waehrend des Versands, Stand danach nicht ermittelbar: Sperre bleibt,
    //    kein automatischer Neuversand, Hinweis fuer den Bearbeiter.
    const b = await makeOverdue(50, 20);
    mails.length = 0;
    mailHook = async () => {
      await FinancialService.addInvoicePayment(b._id, { amount: 50, paymentMethod: 'sepa', paymentDate: new Date(), note: 'Eingang waehrend Versand' });
      failReads = 2;
    };
    const rb = await FinancialService.processDunningStep(b._id, { source: 'manual' });
    failReads = 0;
    const sb = await Invoice.findById(b._id).lean();
    check(Number(sb.dunningLevel || 0) === 0 && sb.dunningLock?.token, 'Stand unklar: Stufe nicht gesetzt, Sperre bleibt (blockiert automatischen Neuversand)', `${sb.dunningLevel} ${sb.dunningLock ? 'Sperre' : 'frei'}`);
    const hb = (sb.dunningHistory || []).slice(-1)[0];
    check(hb && hb.result === 'sent' && /nicht ermittelt/.test(hb.note || '') && /prüfen/.test(rb.message || '') && rb.requiresReview === true,
      'Versand protokolliert, Hinweis "nicht ermittelt", Bearbeiter soll pruefen', `${hb?.note || '-'} / ${rb.message}`);
    // Sperre bleibt auch fuer den Lauf bestehen (Beleg ist inzwischen bezahlt -> ohnehin nicht mahnbar).
    const c = await makeOverdue(45, 20);
    mails.length = 0;
    mailHook = async () => { failReads = 1; await Invoice.collection.updateOne({ _id: c._id }, { $set: { status: 'paid' } }); failReads = 2; };
    await FinancialService.processDunningStep(c._id, { source: 'manual' });
    failReads = 0;
    await Invoice.collection.updateOne({ _id: c._id }, { $set: { status: 'overdue' } }); // z.B. Zahlung wieder storniert
    mails.length = 0;
    await FinancialService.runDunningJob();
    check(mails.filter((m) => m.variables?.invoiceNumber === c.invoiceNumber).length === 0, 'automatischer Lauf versendet bei unklarem Stand nicht erneut', mails.length);
    const listed = (await FinancialService.getOverdueInvoices()).find((e) => String(e._id) === String(c._id));
    check(listed && listed.dunning?.eligible === false && /bearbeitet|nicht abgeschlossen/.test(listed.dunning?.reason || ''), 'Mahnliste: Fall nicht automatisch faellig (Sperre)', listed ? listed.dunning?.reason : 'nicht gelistet');

    // c) Sperre waehrend des Versands verloren (als verwaist uebernommen): richtige Notiz.
    const d = await makeOverdue(60, 20);
    mails.length = 0;
    mailHook = async () => { await Invoice.collection.updateOne({ _id: d._id }, { $set: { dunningLock: { token: 'fremd', at: new Date() } } }); };
    const rd = await FinancialService.processDunningStep(d._id, { source: 'manual' });
    const sd = await Invoice.findById(d._id).lean();
    const hd = (sd.dunningHistory || []).slice(-1)[0];
    check(hd && hd.result === 'sent' && /sperre/i.test(hd.note || '') && !/bezahlt oder storniert/.test(hd.note || ''), 'Sperre verloren: Notiz nennt den echten Grund', hd?.note || '-');
    check(sd.dunningLock?.token === 'fremd' && /nicht erhöht/.test(rd.message || ''), 'fremde Sperre bleibt unangetastet; Meldung deutsch', `${sd.dunningLock?.token} / ${rd.message}`);

    // d) Bezahlt waehrend des Versands (ohne Lesefehler): Notiz "bezahlt".
    const e = await makeOverdue(30, 20);
    mailHook = () => FinancialService.addInvoicePayment(e._id, { amount: 30, paymentMethod: 'sepa', paymentDate: new Date(), note: 'Zahlung' });
    const re = await FinancialService.processDunningStep(e._id, { source: 'manual' });
    const se = await Invoice.findById(e._id).lean();
    const he = (se.dunningHistory || []).slice(-1)[0];
    check(se.status === 'paid' && !se.dunningLock && /bezahlt/.test(he?.note || '') && /nicht übernommen/.test(he?.note || '') && /nicht erhöht/.test(re.message),
      'bezahlt waehrend des Versands: Notiz "bezahlt", Sperre frei', `${se.status} ${he?.note}`);
  });

  await runSection('I Inkasso: Zahlung waehrend der Mitteilung', async () => {
    const f = await makeOverdue(90, 60, { dunningLevel: 3, dunningStage: 'final_notice', nextDunningDueDate: new Date(Date.now() - DAY) });
    mails.length = 0;
    mailHook = () => FinancialService.addInvoicePayment(f._id, { amount: 90, paymentMethod: 'sepa', paymentDate: new Date(), note: 'Eingang waehrend Inkasso-Mitteilung' });
    const res = await call('POST', `/api/admin/financial/dunning/invoices/${f._id}/collection`, { user: admin });
    const sf = await Invoice.findById(f._id).lean();
    check(sf.status === 'paid' && sf.dunningStage !== 'collection' && Number(sf.dunningLevel || 0) < 4 && !sf.dunningLock, 'bezahlt waehrend der Mitteilung: keine Inkasso-Stufe auf bezahltem Beleg, Sperre frei', `${sf.status} / ${sf.dunningStage} / ${sf.dunningLock ? 'Sperre' : 'frei'}`);
    const hf = (sf.dunningHistory || []).slice(-1)[0];
    check(hf && hf.stage === 'collection' && hf.result === 'sent' && /nicht übernommen/.test(hf.note || ''), 'Mitteilung protokolliert (mit Hinweis)', hf ? `${hf.stage} ${hf.note}` : '-');
    check(res.status === 409 && /bezahlt/.test(res.body?.error || '') && res.body?.code === 'COLLECTION_NOT_APPLIED', 'Route: 409 mit deutscher Begruendung', `${res.status} ${res.body?.code} ${res.body?.error}`);

    // Normalfall unveraendert.
    const g = await makeOverdue(40, 60, { dunningLevel: 3, dunningStage: 'final_notice', nextDunningDueDate: new Date(Date.now() - DAY) });
    const ok = await call('POST', `/api/admin/financial/dunning/invoices/${g._id}/collection`, { user: admin });
    const sg = await Invoice.findById(g._id).lean();
    check(ok.status === 200 && sg.dunningStage === 'collection' && !sg.dunningLock, 'Normalfall: Inkasso-Stufe gesetzt', `${ok.status} ${sg.dunningStage}`);
  });

  Invoice.findById = originalFindById;

  await runSection('J Storno-Fortsetzung uebernimmt keinen laufenden Storno', async () => {
    const order = await makeOrder(65);
    const inv = await FinancialService.createInvoiceFromOrder(order._id);
    const sent = [];
    const originalSend = FinancialService.sendInvoice;
    FinancialService.sendInvoice = async (id, to) => { sent.push({ id: String(id), to }); return { success: true }; };
    let releaseGate;
    const gate = new Promise((resolve) => { releaseGate = resolve; });
    let reached;
    const reachedGate = new Promise((resolve) => { reached = resolve; });
    const originalCreateNote = FinancialService.createCreditNote;
    FinancialService.createCreditNote = async (...args) => {
      const note = await originalCreateNote.apply(FinancialService, args);
      reached();
      await gate;
      return note;
    };
    const first = FinancialService.cancelInvoice(inv._id, { reason: 'Erster Klick', actorName: 'Admin', sendEmail: true }).then((value) => ({ value }), (error) => ({ error }));
    await reachedGate;
    FinancialService.createCreditNote = originalCreateNote;
    const second = await tryCall(() => FinancialService.cancelInvoice(inv._id, { reason: 'Zweiter Klick', actorName: 'Admin', sendEmail: true }));
    releaseGate();
    const firstResult = await first;
    FinancialService.sendInvoice = originalSend;
    const stored = await Invoice.findById(inv._id).lean();
    check(second.error && second.error.code === 'CANCELLATION_IN_PROGRESS' && second.error.statusCode === 409, 'zweiter Klick waehrend des Stornos: 409 "wird gerade ausgefuehrt"', second.error ? second.error.code : `kein Fehler (alreadyCancelled=${second.value?.alreadyCancelled})`);
    check(firstResult.value && firstResult.value.alreadyCancelled === false && firstResult.value.emailSent === true && sent.length === 1, 'erster Aufruf schliesst selbst ab, E-Mail genau einmal versendet', firstResult.value ? `${firstResult.value.alreadyCancelled} ${firstResult.value.emailSent} ${sent.length}` : firstResult.error?.message);
    check(stored.status === 'cancelled' && !(stored.auditTrail || []).some((e) => e.action === 'cancellation_resumed'), 'kein irrefuehrender Eintrag "cancellation_resumed"', (stored.auditTrail || []).map((e) => e.action).join(','));

    // Echter Absturz nach dem Speichern der Gutschrift: nach der Karenz wird fortgesetzt,
    // der Revisionseintrag entsteht erst mit dem Abschluss.
    const inv2 = await FinancialService.createInvoiceFromOrder((await makeOrder(33))._id);
    const originalUpdateOne = Invoice.updateOne;
    Invoice.updateOne = function crash(filter, update, ...rest) {
      if (filter && filter['cancellation.state'] === 'processing' && update?.$set?.status === 'cancelled') return Promise.reject(new Error('Simulierter Absturz'));
      return originalUpdateOne.call(this, filter, update, ...rest);
    };
    await tryCall(() => FinancialService.cancelInvoice(inv2._id, { reason: 'Absturz', actorName: 'Admin' }));
    Invoice.updateOne = originalUpdateOne;
    const tooEarly = await tryCall(() => FinancialService.cancelInvoice(inv2._id, { reason: 'sofort', actorName: 'Admin' }));
    check(tooEarly.error && tooEarly.error.code === 'CANCELLATION_IN_PROGRESS', 'direkt danach (innerhalb der Karenz): 409 statt Uebernahme', tooEarly.error ? tooEarly.error.code : 'uebernommen');
    await Invoice.collection.updateOne({ _id: inv2._id }, { $set: { 'cancellation.requestedAt': new Date(Date.now() - 5 * 60 * 1000) } });
    const resumed = await tryCall(() => FinancialService.cancelInvoice(inv2._id, { reason: 'spaeter', actorName: 'Admin' }));
    const s2 = await Invoice.findById(inv2._id).lean();
    const resumedEntries = (s2.auditTrail || []).filter((e) => e.action === 'cancellation_resumed');
    check(!resumed.error && s2.status === 'cancelled' && resumedEntries.length === 1, 'nach der Karenz: fortgesetzt, genau ein Revisionseintrag', resumed.error ? resumed.error.code : `${s2.status} ${resumedEntries.length}`);

    // Fortsetzung, die scheitert (Beleg inzwischen voll gutgeschrieben): kein "fortgesetzt"-Eintrag.
    const inv3 = await FinancialService.createInvoiceFromOrder((await makeOrder(30))._id);
    await FinancialService.createCreditNote(inv3._id, {
      items: [{ serviceName: 'Kulanz', description: 'Kulanz voll', quantity: 1, unitPrice: 30, total: 30, type: 'fee' }],
      reason: 'Kulanz voll', correctionType: 'price_adjustment',
    });
    await Invoice.collection.updateOne({ _id: inv3._id }, { $set: { cancellation: { kind: 'storno', state: 'processing', reason: 'haengt', requestedAt: new Date(Date.now() - 10 * 60 * 1000), previousStatus: 'sent', creditNoteId: new mongoose.Types.ObjectId(), allocatedAtCancellation: 0 } } });
    const failed = await tryCall(() => FinancialService.cancelInvoice(inv3._id, { reason: 'x', actorName: 'Admin' }));
    const s3 = await Invoice.findById(inv3._id).lean();
    check(failed.error && failed.error.code === 'INVOICE_ALREADY_CREDITED' && !(s3.auditTrail || []).some((e) => e.action === 'cancellation_resumed'),
      'gescheiterte Fortsetzung: kein Eintrag "cancellation_resumed"', failed.error ? `${failed.error.code} ${(s3.auditTrail || []).map((e) => e.action).join(',')}` : 'kein Fehler');
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
