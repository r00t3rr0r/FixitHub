/**
 * Regressionstest T09 - Rechnungsstorno (Track "documents").
 *
 *   1. Storno einer UNBEZAHLTEN ausgestellten Rechnung ueber die echte Admin-Route:
 *      Grund Pflicht, Storno-Gutschrift INV-CN-JJJJ-NNNN mit Bezug, Originalbeleg und
 *      archiviertes PDF bleiben unveraendert, Revisionsspur, Forderung 0, keine Mahnung.
 *   2. Kein doppeltes Storno: Wiederholung und 6 parallele Aufrufe -> genau EINE
 *      Storno-Gutschrift.
 *   3. Entwurf: "Storno" wird abgelehnt, "Entwurf verwerfen" ist ein eigener Weg
 *      (keine Gutschrift, Nummer bleibt belegt); ausgestellte Belege lassen sich nicht verwerfen.
 *   4. Bezahlte Rechnung: Storno nur mit ausdruecklicher Bestaetigung; die Zahlung bleibt
 *      erhalten und steht als "Erstattung offen" - es wird NICHT automatisch erstattet.
 *   5. Teilweise gutgeschriebene Rechnung: Storno nur ueber den Rest (keine Doppelminderung).
 *   6. Alter Weg PATCH /status 'cancelled' laeuft ueber dasselbe Storno (kein reiner
 *      Statuswechsel mehr), ohne Grund -> 400.
 *   7. Nach dem Storno darf der Auftrag neu berechnet werden; der Kunde sieht Storno-Gutschrift
 *      und Original; Mitarbeiter duerfen nicht stornieren.
 *
 * Kein Netz: E-Mail-Transport/Logger sind Stubs, 'qrcode' ist ein Stub.
 *
 * Aufruf (benoetigt eine WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_storno node test-invoice-storno.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Module = require('module');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_invoice_storno';

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
const sha = (buf) => (buf ? crypto.createHash('sha256').update(buf).digest('hex') : '');

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
  const Invoice = mongoose.model('Invoice');
  const Payment = mongoose.model('Payment');
  const PaymentAllocation = mongoose.model('PaymentAllocation');
  await Promise.all([Payment.init(), PaymentAllocation.init(), Invoice.init()]);

  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.logger = { info() {}, warn() {}, error() {}, debug() {} };
  EmailService.deliveryTracker = { recordDelivery() {} };
  const mails = [];
  EmailService.sendTemplateEmail = async (templateName, to) => { mails.push({ templateName, to }); return { success: true, messageId: `m${mails.length}` }; };
  EmailService.buildSystemUrl = async (p) => `https://test.invalid${p}`;
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });

  const FinancialService = require(path.join(SERVER_DIR, 'services/financialService'));
  const PaymentService = require(path.join(SERVER_DIR, 'services/paymentService'));
  const invoiceRoutes = require(path.join(SERVER_DIR, 'routes/invoiceRoutes'));
  const financialRoutes = require(path.join(SERVER_DIR, 'routes/financialRoutes'));
  const app = express();
  app.use(express.json());
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/admin/financial', financialRoutes);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, { user = null, body = null, raw = false } = {}) => {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (raw && response.status === 200) return { status: 200, buffer: Buffer.from(await response.arrayBuffer()) };
    let json = null;
    try { json = await response.json(); } catch (error) { json = null; }
    return { status: response.status, body: json };
  };

  const admin = await User.create({ name: 'Admin Storno', email: 'admin-storno@test.invalid', role: 'admin' });
  const staff = await User.create({ name: 'Mitarbeiter Storno', email: 'staff-storno@test.invalid', role: 'staff' });
  const customer = await User.create({ name: 'Paula Beispiel', email: 'paula@test.invalid', role: 'customer', customerNumber: 'K-20001' });

  let orderSeq = 0;
  const makeOrderInvoice = async (gross = 100, discount = 0) => {
    orderSeq += 1;
    const order = await Order.create({
      customerId: customer._id, orderNumber: `ORD-2026-9${String(orderSeq).padStart(3, '0')}`,
      deviceBrand: 'Apple', deviceModel: 'iPhone 13', deviceType: 'Smartphone', errorDescription: 'Display',
      services: [{ isManual: true, name: 'Displaytausch', description: 'Original', price: round2(gross + discount), quantity: 1, estimatedTime: 0 }],
      totalCost: gross, discount, status: 'completed',
    });
    const invoice = await FinancialService.createInvoiceFromOrder(order._id);
    return { order, invoice };
  };
  const stornoNotesOf = (invoiceId) => Invoice.find({ creditNoteOf: invoiceId, isCreditNote: true, correctionType: 'full_cancellation' }).lean();

  await runSection('1 Storno einer unbezahlten Rechnung (Admin-Route)', async () => {
    const { invoice } = await makeOrderInvoice(84.92, 14.98);
    const before = await call('GET', `/api/invoices/${invoice._id}/pdf`, { user: admin, raw: true });
    const pdfBefore = sha(before.buffer);

    const noReason = await call('POST', `/api/admin/financial/invoices/${invoice._id}/cancel`, { user: admin, body: {} });
    check(noReason.status === 400 && /Grund/.test(noReason.body?.error || ''), 'ohne Grund: 400, deutsche Meldung', `${noReason.status} ${noReason.body?.error}`);
    const byStaff = await call('POST', `/api/admin/financial/invoices/${invoice._id}/cancel`, { user: staff, body: { reason: 'x' } });
    check(byStaff.status === 403, 'Mitarbeiter darf nicht stornieren (403)', byStaff.status);

    const res = await call('POST', `/api/admin/financial/invoices/${invoice._id}/cancel`, { user: admin, body: { reason: 'Falscher Kunde berechnet' } });
    check(res.status === 200 && res.body?.success === true, 'Storno erfolgreich (200)', `${res.status} ${res.body?.error || ''}`);
    const note = res.body?.creditNote || {};
    check(/^INV-CN-\d{4}-\d{4}$/.test(note.invoiceNumber || ''), 'Storno-Gutschrift mit eigener Nummer INV-CN-JJJJ-NNNN', note.invoiceNumber);
    const storedNote = note._id ? await Invoice.findById(note._id).lean() : null;
    check(storedNote && storedNote.correctionType === 'full_cancellation' && String(storedNote.creditNoteOf) === String(invoice._id)
      && storedNote.creditNoteOfNumber === invoice.invoiceNumber, 'Gutschrift referenziert die Ursprungsrechnung', storedNote ? `${storedNote.correctionType} / ${storedNote.creditNoteOfNumber}` : '-');
    check(storedNote && round2(storedNote.total) === -84.92, 'Gutschriftsbetrag = -Rechnungsbrutto (Rabatt nur einmal)', storedNote ? storedNote.total : '-');
    check(storedNote && !['draft', 'pending_approval'].includes(storedNote.status), 'Storno-Gutschrift ist ausgestellt (kein Entwurf)', storedNote ? storedNote.status : '-');
    check(storedNote && /Falscher Kunde berechnet/.test(storedNote.notes || ''), 'Grund steht auf der Gutschrift', storedNote ? storedNote.notes : '-');

    const original = await Invoice.findById(invoice._id).lean();
    check(original.status === 'cancelled' && original.cancellation?.state === 'completed' && original.cancellation?.kind === 'storno', 'Original: Status storniert, Storno abgeschlossen', `${original.status} / ${original.cancellation?.state}`);
    check(original.cancellation?.reason === 'Falscher Kunde berechnet' && original.cancellation?.actorName === 'Admin Storno'
      && String(original.cancellation?.creditNoteId) === String(storedNote?._id), 'Storno-Datensatz: Grund, Bearbeiter, Gutschrift', JSON.stringify({ r: original.cancellation?.reason, a: original.cancellation?.actorName }));
    check((original.auditTrail || []).some((entry) => entry.action === 'cancelled' && /Falscher Kunde/.test(entry.detail || '')), 'Revisionsspur enthaelt das Storno', (original.auditTrail || []).map((e) => e.action).join(','));
    check(round2(original.total) === 84.92 && round2(original.discount) === 14.98 && original.invoiceNumber === invoice.invoiceNumber, 'Originalbetraege und Nummer unveraendert', `${original.total} / ${original.discount}`);

    const after = await call('GET', `/api/invoices/${invoice._id}/pdf`, { user: admin, raw: true });
    check(after.status === 200 && sha(after.buffer) === pdfBefore, 'Archiviertes Original-PDF unveraendert', sha(after.buffer).slice(0, 12));

    const balance = await PaymentService.computeInvoiceBalance(invoice._id);
    check(balance && balance.receivable === 0 && balance.open === 0, 'Forderung nach Storno 0, nichts offen', balance ? `${balance.receivable} / ${balance.open}` : '-');
    const overdue = await FinancialService.getOverdueInvoices();
    check(!overdue.some((entry) => String(entry._id) === String(invoice._id)), 'Stornierte Rechnung nicht in der Mahnliste', overdue.length);
    const noteDoc = await Invoice.findById(storedNote._id).select('+documentArchive.data').lean();
    check(Boolean(noteDoc?.documentArchive?.sha256), 'Storno-Gutschrift als PDF archiviert', noteDoc?.documentArchive?.sha256 ? 'ja' : 'nein');
  });

  await runSection('2 Kein doppeltes Storno (Wiederholung, Parallelitaet)', async () => {
    const { invoice } = await makeOrderInvoice(50);
    const first = await call('POST', `/api/admin/financial/invoices/${invoice._id}/cancel`, { user: admin, body: { reason: 'Doppelt erfasst' } });
    const second = await call('POST', `/api/admin/financial/invoices/${invoice._id}/cancel`, { user: admin, body: { reason: 'Doppelt erfasst' } });
    const notes = await stornoNotesOf(invoice._id);
    check(first.status === 200 && second.status === 200 && second.body?.alreadyCancelled === true, 'Wiederholung: 200, bereits storniert gemeldet', `${second.status} ${second.body?.alreadyCancelled}`);
    check(notes.length === 1, 'genau eine Storno-Gutschrift', notes.length);

    const { invoice: parallel } = await makeOrderInvoice(60);
    const results = await Promise.all(Array.from({ length: 6 }, () => FinancialService.cancelInvoice(parallel._id, { reason: 'Parallel', actorName: 'Test' }).then((r) => r, (e) => e)));
    const parallelNotes = await stornoNotesOf(parallel._id);
    const errors = results.filter((r) => r instanceof Error);
    check(parallelNotes.length === 1, '6 parallele Stornos: genau eine Gutschrift', parallelNotes.length);
    check(errors.every((e) => e.statusCode === 409 && !/[A-Z][a-z]+ [a-z]+ [a-z]+ing/.test(e.message)), 'Verlierer: 409 (in Bearbeitung) oder "bereits storniert"', errors.map((e) => e.code).join(',') || 'keine Fehler');
    const credited = await PaymentService.computeInvoiceBalance(parallel._id);
    check(credited && credited.credited === 60 && credited.receivable === 0, 'Forderung genau einmal gemindert', credited ? `${credited.credited}` : '-');
  });

  await runSection('3 Entwurf verwerfen ist ein eigener Weg', async () => {
    const draft = await Invoice.create({
      customerId: customer._id, customerName: customer.name, customerEmail: customer.email,
      items: [{ description: 'Entwurf', quantity: 1, unitPrice: 30, total: 30, type: 'fee' }],
      dueDate: new Date(Date.now() + 7 * 86400000), status: 'draft',
    });
    const cancelDraft = await call('POST', `/api/admin/financial/invoices/${draft._id}/cancel`, { user: admin, body: { reason: 'weg' } });
    check(cancelDraft.status === 409 && /Entwurf/.test(cancelDraft.body?.error || ''), 'Storno eines Entwurfs abgelehnt (409, deutsch)', `${cancelDraft.status} ${cancelDraft.body?.error}`);
    const discard = await call('POST', `/api/admin/financial/invoices/${draft._id}/discard`, { user: admin, body: { reason: 'Testentwurf' } });
    const stored = await Invoice.findById(draft._id).lean();
    check(discard.status === 200 && stored.status === 'cancelled' && stored.cancellation?.kind === 'draft_discarded', 'Entwurf verworfen (kein Loeschen, Nummer bleibt belegt)', `${discard.status} ${stored.status} ${stored.cancellation?.kind} ${stored.invoiceNumber}`);
    const drafts = await Invoice.countDocuments({ creditNoteOf: draft._id });
    check(drafts === 0, 'Verwerfen erzeugt keine Gutschrift', drafts);
    const customerPdf = await call('GET', `/api/invoices/${draft._id}/pdf`, { user: customer });
    const customerList = await call('GET', '/api/invoices?limit=200', { user: customer });
    check(customerPdf.status === 404 && !(customerList.body?.invoices || []).some((entry) => String(entry._id) === String(draft._id)), 'verworfener Entwurf fuer Kunden unsichtbar (Liste, PDF)', customerPdf.status);
    const archivedDraft = await Invoice.findById(draft._id).select('+documentArchive.data').lean();
    check(!archivedDraft.documentArchive?.sha256, 'verworfener Entwurf wird nicht archiviert', archivedDraft.documentArchive?.sha256 ? 'archiviert!' : 'nein');
    const { invoice } = await makeOrderInvoice(40);
    const discardIssued = await call('POST', `/api/admin/financial/invoices/${invoice._id}/discard`, { user: admin, body: { reason: 'x' } });
    check(discardIssued.status === 409 && /storn/i.test(discardIssued.body?.error || ''), 'Ausgestellte Rechnung kann nicht verworfen werden (409)', `${discardIssued.status} ${discardIssued.body?.error}`);
  });

  await runSection('4 Bezahlte Rechnung: Zahlung bleibt, keine automatische Erstattung', async () => {
    const { invoice } = await makeOrderInvoice(100);
    await FinancialService.addInvoicePayment(invoice._id, { amount: 100, paymentMethod: 'sepa', paymentDate: new Date(), note: 'Eingang' });
    const noConfirm = await call('POST', `/api/admin/financial/invoices/${invoice._id}/cancel`, { user: admin, body: { reason: 'Kulanz komplett' } });
    check(noConfirm.status === 409 && noConfirm.body?.code === 'CANCELLATION_REQUIRES_CONFIRMATION' && /100,00/.test(noConfirm.body?.error || ''), 'ohne Bestaetigung: 409 mit gebuchtem Betrag', `${noConfirm.status} ${noConfirm.body?.error}`);
    const notesBefore = await stornoNotesOf(invoice._id);
    check(notesBefore.length === 0, 'abgelehnter Versuch hinterlaesst keine Gutschrift', notesBefore.length);

    const res = await call('POST', `/api/admin/financial/invoices/${invoice._id}/cancel`, { user: admin, body: { reason: 'Kulanz komplett', confirmPaidCancellation: true } });
    check(res.status === 200, 'mit Bestaetigung storniert', `${res.status} ${res.body?.error || ''}`);
    const payments = await Payment.find({ invoiceId: invoice._id }).lean();
    const allocations = await PaymentAllocation.find({ invoiceId: invoice._id }).lean();
    check(payments.length === 1 && payments[0].status === 'completed' && !payments[0].refundAmount && !(payments[0].refunds || []).length, 'Zahlung unveraendert, keine Erstattung ausgeloest', payments.map((p) => `${p.status}/${p.refundAmount || 0}`).join(','));
    check(allocations.length === 1 && round2(allocations[0].allocatedAmount) === 100, 'Zuordnung bleibt erhalten', allocations.map((a) => a.allocatedAmount).join(','));
    const balance = await PaymentService.computeInvoiceBalance(invoice._id);
    check(balance && balance.receivable === 0 && balance.refundPending === 100 && balance.paymentState === 'overpaid', 'Guthaben/Erstattung offen: 100', balance ? `${balance.paymentState} / ${balance.refundPending}` : '-');
    const stored = await Invoice.findById(invoice._id).lean();
    check(round2(stored.cancellation?.allocatedAtCancellation) === 100, 'Storno vermerkt das bereits gebuchte Geld', stored.cancellation?.allocatedAtCancellation);
  });

  await runSection('5 Teilweise gutgeschrieben: Storno nur ueber den Rest', async () => {
    const { invoice } = await makeOrderInvoice(100);
    await FinancialService.createCreditNote(invoice._id, {
      items: [{ serviceName: 'Kulanz', description: 'Kulanz', quantity: 1, unitPrice: 20, total: 20, type: 'fee' }],
      reason: 'Kulanz', correctionType: 'price_adjustment',
    });
    const res = await call('POST', `/api/admin/financial/invoices/${invoice._id}/cancel`, { user: admin, body: { reason: 'Rest stornieren' } });
    const note = res.body?.creditNote ? await Invoice.findById(res.body.creditNote._id).lean() : null;
    check(res.status === 200 && note && round2(note.total) === -80, 'Storno-Gutschrift ueber den Restbetrag 80', note ? note.total : `${res.status} ${res.body?.error}`);
    const balance = await PaymentService.computeInvoiceBalance(invoice._id);
    check(balance && balance.credited === 100 && balance.receivable === 0, 'insgesamt genau 100 gutgeschrieben', balance ? balance.credited : '-');
  });

  await runSection('6 Alter Weg PATCH /status cancelled = Storno', async () => {
    const { invoice } = await makeOrderInvoice(70);
    const noNote = await call('PATCH', `/api/admin/financial/invoices/${invoice._id}/status`, { user: admin, body: { status: 'cancelled' } });
    check(noNote.status === 400 && /Grund/.test(noNote.body?.error || ''), 'ohne Grund 400', `${noNote.status} ${noNote.body?.error}`);
    const stillOpen = await Invoice.findById(invoice._id).lean();
    check(stillOpen.status !== 'cancelled', 'Status nicht einfach umgeschaltet', stillOpen.status);
    const res = await call('PATCH', `/api/admin/financial/invoices/${invoice._id}/status`, { user: admin, body: { status: 'cancelled', notes: 'Auftrag storniert' } });
    const notes = await stornoNotesOf(invoice._id);
    check(res.status === 200 && res.body?.invoice?.status === 'cancelled' && notes.length === 1, 'Statuswechsel erzeugt die Storno-Gutschrift', `${res.status} / ${notes.length}`);
  });

  await runSection('7 Neuberechnung, Kundensicht', async () => {
    const { order, invoice } = await makeOrderInvoice(90);
    await FinancialService.cancelInvoice(invoice._id, { reason: 'Falscher Betrag', actorName: 'Admin' });
    let reissued = null;
    let error = null;
    try { reissued = await FinancialService.createInvoiceFromOrder(order._id); } catch (e) { error = e; }
    check(reissued && reissued.invoiceNumber !== invoice.invoiceNumber, 'Auftrag nach Storno neu berechenbar', reissued ? reissued.invoiceNumber : (error && error.code));
    const list = await call('GET', '/api/invoices?limit=200', { user: customer });
    const mine = (list.body?.invoices || []);
    const note = mine.find((entry) => entry.isCreditNote && String(entry.creditNoteOf) === String(invoice._id));
    const orig = mine.find((entry) => String(entry._id) === String(invoice._id));
    check(Boolean(note) && orig && orig.status === 'cancelled', 'Kunde sieht Storno-Gutschrift und storniertes Original', `${Boolean(note)} / ${orig?.status}`);
    const detail = await call('GET', `/api/invoices/${invoice._id}`, { user: customer });
    check((detail.body?.invoice?.relatedCreditNotes || []).some((entry) => entry.correctionType === 'full_cancellation'), 'Detail verweist auf die Storno-Gutschrift', (detail.body?.invoice?.relatedCreditNotes || []).length);
  });

  const Booking = mongoose.model('Booking');
  const makeBookingOrder = async (gross = 80) => {
    orderSeq += 1;
    const order = await Order.create({
      customerId: customer._id, orderNumber: `ORD-2026-8${String(orderSeq).padStart(3, '0')}`,
      deviceBrand: 'Apple', deviceModel: 'iPhone 14', deviceType: 'Smartphone', errorDescription: 'Akku',
      services: [{ isManual: true, name: 'Akkutausch', description: 'Original', price: gross, quantity: 1, estimatedTime: 0 }],
      totalCost: gross, discount: 0, status: 'completed',
    });
    const booking = await Booking.create({
      customerId: customer._id, orderIds: [order._id],
      items: [{ type: 'repair', orderId: order._id, orderNumber: order.orderNumber, cost: gross }],
      totalCost: gross, status: 'processing',
    });
    await Order.updateOne({ _id: order._id }, { $set: { bookingId: booking._id } });
    return { order: await Order.findById(order._id), booking };
  };
  const tryCall = async (fn) => { try { return { value: await fn() }; } catch (error) { return { error }; } };

  await runSection('8 Storno + Neuausstellung fuer einen Auftrag MIT Buchung (MAJOR 1)', async () => {
    const { order, booking } = await makeBookingOrder(80);
    const first = await FinancialService.createInvoiceFromOrder(order._id);
    const dup = await tryCall(() => FinancialService.createInvoiceFromOrder(order._id));
    check(dup.error && dup.error.statusCode === 409, 'solange die erste Rechnung gilt: zweite Rechnung abgelehnt (409)', dup.error ? `${dup.error.code} ${dup.error.message}` : 'NICHT abgelehnt');
    await FinancialService.cancelInvoice(first._id, { reason: 'Falscher Betrag', actorName: 'Admin' });

    const reissue = await call('POST', `/api/admin/financial/orders/${order._id}/invoice`, { user: admin, body: {} });
    const reissued = reissue.body?.invoice || reissue.body?.data || null;
    check(reissue.status >= 200 && reissue.status < 300 && reissued && reissued.invoiceNumber && reissued.invoiceNumber !== first.invoiceNumber,
      'nach Storno: Neuausstellung ueber die Admin-Route (Auftrag mit Buchung)', `${reissue.status} ${reissued?.invoiceNumber || reissue.body?.error}`);
    check(reissued && round2(reissued.total) === 80 && String(reissued.bookingId) === String(booking._id), 'neue Rechnung: Betrag und Buchungsbezug', reissued ? `${reissued.total} / ${reissued.bookingId}` : '-');
    const again = await tryCall(() => FinancialService.createInvoiceFromOrder(order._id));
    check(again.error && again.error.statusCode === 409 && !/INV-CN-/.test(again.error.message), 'zweite Neuausstellung waehrend die erste gilt: 409 (nennt keine Gutschrift als Rechnung)', again.error ? `${again.error.code} ${again.error.message}` : 'NICHT abgelehnt');
    const viaRepair = await tryCall(() => FinancialService.generateFromRepairOrders([order._id]));
    check(viaRepair.error && viaRepair.error.statusCode === 409, 'Sammelrechnung ueber dieselbe Leistung: 409', viaRepair.error ? viaRepair.error.code : 'NICHT abgelehnt');
    const viaManual = await tryCall(() => FinancialService.createInvoice({ customerId: customer._id, bookingId: booking._id, items: [{ description: 'Zusatz', quantity: 1, unitPrice: 5, total: 5, type: 'fee' }] }));
    check(viaManual.error && viaManual.error.statusCode === 409, 'manuelle Rechnung zur Buchung mit aktiver Rechnung: 409', viaManual.error ? viaManual.error.code : 'NICHT abgelehnt');

    // Zweiter Korrekturzyklus: auch die Sammel- und die manuelle Rechnung sind nach einem Storno moeglich.
    const reissuedId = reissued?._id;
    if (reissuedId) await FinancialService.cancelInvoice(reissuedId, { reason: 'Nochmals korrigiert', actorName: 'Admin' });
    const viaRepair2 = await tryCall(() => FinancialService.generateFromRepairOrders([order._id]));
    check(viaRepair2.value && viaRepair2.value.invoiceNumber, 'nach zweitem Storno: Sammelrechnung zur Buchung moeglich', viaRepair2.value ? viaRepair2.value.invoiceNumber : `${viaRepair2.error?.code} ${viaRepair2.error?.message}`);
    if (viaRepair2.value) await FinancialService.cancelInvoice(viaRepair2.value._id, { reason: 'Test manuell', actorName: 'Admin' });
    const viaManual2 = await tryCall(() => FinancialService.createInvoice({ customerId: customer._id, bookingId: booking._id, items: [{ description: 'Pauschale', quantity: 1, unitPrice: 80, total: 80, type: 'fee' }] }));
    check(viaManual2.value && viaManual2.value.invoiceNumber, 'nach Storno: manuelle Rechnung zur Buchung moeglich', viaManual2.value ? viaManual2.value.invoiceNumber : `${viaManual2.error?.code} ${viaManual2.error?.message}`);
    const active = await Invoice.countDocuments({ bookingId: booking._id, isCreditNote: { $ne: true }, status: { $nin: ['cancelled', 'credited'] } });
    check(active === 1, 'je Buchung genau eine aktive Rechnung', active);
  });

  // Simulierter Absturz: das Abschluss-Update des Stornos (status -> cancelled) wirft.
  const originalUpdateOne = Invoice.updateOne.bind(Invoice);
  const crashOnCompletion = () => {
    Invoice.updateOne = function patched(filter, update, ...rest) {
      if (filter && filter['cancellation.state'] === 'processing' && update?.$set?.status === 'cancelled') {
        return Promise.reject(new Error('Simulierter Absturz nach dem Speichern der Gutschrift'));
      }
      return originalUpdateOne(filter, update, ...rest);
    };
  };
  const restoreUpdateOne = () => { Invoice.updateOne = originalUpdateOne; };

  await runSection('9 Storno nach Absturz fortsetzen (MAJOR 2)', async () => {
    // a) Gutschrift gespeichert, Abschluss fehlt; Wiederholung nach 10 Minuten.
    const { invoice } = await makeOrderInvoice(100);
    crashOnCompletion();
    const crashed = await tryCall(() => FinancialService.cancelInvoice(invoice._id, { reason: 'Absturztest', actorName: 'Admin' }));
    restoreUpdateOne();
    const mid = await Invoice.findById(invoice._id).lean();
    const midNotes = await stornoNotesOf(invoice._id);
    check(crashed.error && mid.cancellation?.state === 'processing' && midNotes.length === 1, 'Ausgangslage: Gutschrift gespeichert, Storno haengt in "processing"', `${mid.status} / ${mid.cancellation?.state} / ${midNotes.length}`);
    await Invoice.collection.updateOne({ _id: invoice._id }, { $set: { 'cancellation.requestedAt': new Date(Date.now() - 10 * 60 * 1000) } });
    const resumed = await tryCall(() => FinancialService.cancelInvoice(invoice._id, { reason: 'Wiederholung', actorName: 'Admin' }));
    const after = await Invoice.findById(invoice._id).lean();
    const notes = await stornoNotesOf(invoice._id);
    check(!resumed.error && after.status === 'cancelled' && after.cancellation?.state === 'completed', 'Wiederholung schliesst das Storno ab', resumed.error ? `${resumed.error.code} ${resumed.error.message}` : `${after.status} / ${after.cancellation?.state}`);
    check(notes.length === 1 && String(notes[0]._id) === String(mid.cancellation?.creditNoteId) && round2(notes[0].total) === -100, 'genau EINE Storno-Gutschrift (die vorab vergebene), Betrag -100', notes.map((n) => `${n.invoiceNumber}:${n.total}`).join(','));
    check(after.cancellation?.creditNoteNumber === notes[0]?.invoiceNumber && after.cancellation?.reason === 'Absturztest', 'Storno-Datensatz: Gutschriftnummer, urspruenglicher Grund', `${after.cancellation?.creditNoteNumber} / ${after.cancellation?.reason}`);
    const bal = await PaymentService.computeInvoiceBalance(invoice._id);
    check(bal && bal.credited === 100 && bal.receivable === 0, 'genau einmal gemindert (100), Forderung 0', bal ? `${bal.credited} / ${bal.receivable}` : '-');
    const again = await tryCall(() => FinancialService.cancelInvoice(invoice._id, { reason: 'x' }));
    check(again.value?.alreadyCancelled === true, 'dritter Aufruf: bereits storniert', again.value ? again.value.alreadyCancelled : again.error?.code);

    // b) Sofortige Wiederholung (Gutschrift existiert bereits): innerhalb der Karenz koennte der
    //    erste Vorgang noch laufen (zweiter Klick) -> 409 statt Uebernahme; danach wird
    //    abgeschlossen, ohne zweite Gutschrift.
    const { invoice: inv2 } = await makeOrderInvoice(55);
    crashOnCompletion();
    await tryCall(() => FinancialService.cancelInvoice(inv2._id, { reason: 'Absturz sofort', actorName: 'Admin' }));
    restoreUpdateOne();
    const immediate = await tryCall(() => FinancialService.cancelInvoice(inv2._id, { reason: 'sofort erneut', actorName: 'Admin' }));
    check(immediate.error && immediate.error.code === 'CANCELLATION_IN_PROGRESS', 'sofortige Wiederholung (Karenz): 409 "wird gerade ausgefuehrt", keine Uebernahme', immediate.error ? immediate.error.code : 'uebernommen');
    await Invoice.collection.updateOne({ _id: inv2._id }, { $set: { 'cancellation.requestedAt': new Date(Date.now() - 60 * 1000) } });
    const afterGrace = await tryCall(() => FinancialService.cancelInvoice(inv2._id, { reason: 'nach Karenz', actorName: 'Admin' }));
    const after2 = await Invoice.findById(inv2._id).lean();
    const notes2 = await stornoNotesOf(inv2._id);
    check(!afterGrace.error && after2.status === 'cancelled' && notes2.length === 1, 'Wiederholung nach der Karenz: abgeschlossen, eine Gutschrift', afterGrace.error ? `${afterGrace.error.code} ${afterGrace.error.message}` : `${after2.status} / ${notes2.length}`);

    // c) Absturz nach der Reservierung, VOR dem Speichern der Gutschrift.
    const { invoice: inv3 } = await makeOrderInvoice(45);
    const presetId = new mongoose.Types.ObjectId();
    await Invoice.collection.updateOne({ _id: inv3._id }, { $set: { cancellation: { kind: 'storno', state: 'processing', reason: 'Vor Gutschrift abgestuerzt', requestedAt: new Date(Date.now() - 10 * 60 * 1000), previousStatus: 'sent', creditNoteId: presetId, allocatedAtCancellation: 0 } } });
    const resumed3 = await tryCall(() => FinancialService.cancelInvoice(inv3._id, { reason: 'Wiederholung', actorName: 'Admin' }));
    const notes3 = await stornoNotesOf(inv3._id);
    const after3 = await Invoice.findById(inv3._id).lean();
    check(!resumed3.error && notes3.length === 1 && String(notes3[0]._id) === String(presetId) && after3.status === 'cancelled', 'Fortsetzung legt die Gutschrift mit der vorab vergebenen ID an', resumed3.error ? `${resumed3.error.code} ${resumed3.error.message}` : `${notes3.length} / ${after3.status}`);

    // d) Nach einer Teilgutschrift: Absturz nach der Storno-Gutschrift, Rest korrekt.
    const { invoice: inv4 } = await makeOrderInvoice(100);
    await FinancialService.createCreditNote(inv4._id, {
      items: [{ serviceName: 'Kulanz', description: 'Kulanz', quantity: 1, unitPrice: 20, total: 20, type: 'fee' }],
      reason: 'Kulanz', correctionType: 'price_adjustment',
    });
    crashOnCompletion();
    await tryCall(() => FinancialService.cancelInvoice(inv4._id, { reason: 'Rest', actorName: 'Admin' }));
    restoreUpdateOne();
    await Invoice.collection.updateOne({ _id: inv4._id }, { $set: { 'cancellation.requestedAt': new Date(Date.now() - 10 * 60 * 1000) } });
    const resumed4 = await tryCall(() => FinancialService.cancelInvoice(inv4._id, { reason: 'Rest', actorName: 'Admin' }));
    const notes4 = await stornoNotesOf(inv4._id);
    const bal4 = await PaymentService.computeInvoiceBalance(inv4._id);
    check(!resumed4.error && notes4.length === 1 && round2(notes4[0].total) === -80 && bal4.credited === 100 && bal4.receivable === 0,
      'Teilgutschrift + Absturz: genau eine Storno-Gutschrift ueber 80, insgesamt 100', resumed4.error ? `${resumed4.error.code} ${resumed4.error.message}` : `${notes4.map((n) => n.total).join(',')} / ${bal4.credited}`);

    // e) Haengende Reservierung ohne Gutschrift, Beleg inzwischen voll gutgeschrieben:
    //    kein ewiges "processing" - Reservierung wird freigegeben, echter Grund gemeldet.
    const { invoice: inv5 } = await makeOrderInvoice(30);
    await FinancialService.createCreditNote(inv5._id, {
      items: [{ serviceName: 'Kulanz', description: 'Kulanz voll', quantity: 1, unitPrice: 30, total: 30, type: 'fee' }],
      reason: 'Kulanz voll', correctionType: 'price_adjustment',
    });
    await Invoice.collection.updateOne({ _id: inv5._id }, { $set: { cancellation: { kind: 'storno', state: 'processing', reason: 'haengt', requestedAt: new Date(Date.now() - 10 * 60 * 1000), previousStatus: 'sent', creditNoteId: new mongoose.Types.ObjectId(), allocatedAtCancellation: 0 } } });
    const resumed5 = await tryCall(() => FinancialService.cancelInvoice(inv5._id, { reason: 'x', actorName: 'Admin' }));
    const after5 = await Invoice.findById(inv5._id).lean();
    const notes5 = await stornoNotesOf(inv5._id);
    check(resumed5.error && resumed5.error.code === 'INVOICE_ALREADY_CREDITED' && !after5.cancellation && notes5.length === 0,
      'haengende Reservierung, Beleg voll gutgeschrieben: freigegeben, echter Grund, keine Storno-Gutschrift', resumed5.error ? `${resumed5.error.code} / ${JSON.stringify(after5.cancellation || null)}` : 'kein Fehler');
  });

  await runSection('10 Reservierung: echter Grund statt irrefuehrendem 409', async () => {
    // Zwischen Lesen und Reservieren aendert sich der Status (z.B. Zahlungseingang).
    const hookOnClaim = (hook) => {
      let fired = false;
      Invoice.updateOne = async function patched(filter, update, ...rest) {
        if (!fired && filter && filter['cancellation.state'] && filter['cancellation.state'].$exists === false && update?.$set?.cancellation) {
          fired = true;
          await hook(filter);
        }
        return originalUpdateOne(filter, update, ...rest);
      };
    };
    const { invoice } = await makeOrderInvoice(66);
    hookOnClaim(() => Invoice.collection.updateOne({ _id: invoice._id }, { $set: { status: 'viewed' } }));
    const res = await tryCall(() => FinancialService.cancelInvoice(invoice._id, { reason: 'Status geaendert', actorName: 'Admin' }));
    restoreUpdateOne();
    const stored = await Invoice.findById(invoice._id).lean();
    check(!res.error && stored.status === 'cancelled', 'Statuswechsel sent->viewed waehrend des Stornos: Storno trotzdem ausgefuehrt', res.error ? `${res.error.code} ${res.error.message}` : stored.status);

    // Geld geht zwischen Lesen und Reservieren ein: nach der Reservierung neu pruefen.
    const { invoice: paidMid } = await makeOrderInvoice(77);
    hookOnClaim(async () => {
      restoreUpdateOne();
      await FinancialService.addInvoicePayment(paidMid._id, { amount: 30, paymentMethod: 'sepa', paymentDate: new Date(), note: 'Eingang waehrenddessen' });
      hookOnClaim(async () => {});
    });
    const res2 = await tryCall(() => FinancialService.cancelInvoice(paidMid._id, { reason: 'Geld kam dazwischen', actorName: 'Admin' }));
    restoreUpdateOne();
    const stored2 = await Invoice.findById(paidMid._id).lean();
    const notes2 = await stornoNotesOf(paidMid._id);
    check(res2.error && res2.error.code === 'CANCELLATION_REQUIRES_CONFIRMATION' && /30,00/.test(res2.error.message), 'Zahlung waehrend des Stornos: Bestaetigung verlangt (mit Betrag)', res2.error ? `${res2.error.code} ${res2.error.message}` : 'kein Fehler');
    check(!stored2.cancellation && stored2.status !== 'cancelled' && notes2.length === 0, 'keine Reservierung, keine Gutschrift hinterlassen', `${JSON.stringify(stored2.cancellation || null)} / ${stored2.status} / ${notes2.length}`);

    // Beleg wurde inzwischen vollstaendig gutgeschrieben.
    const { invoice: credited } = await makeOrderInvoice(20);
    hookOnClaim(() => Invoice.collection.updateOne({ _id: credited._id }, { $set: { status: 'credited' } }));
    const res3 = await tryCall(() => FinancialService.cancelInvoice(credited._id, { reason: 'x', actorName: 'Admin' }));
    restoreUpdateOne();
    check(res3.error && res3.error.code === 'INVOICE_ALREADY_CREDITED' && /gutgeschrieben/.test(res3.error.message), 'inzwischen gutgeschrieben: echter Grund (deutsch)', res3.error ? `${res3.error.code} ${res3.error.message}` : 'kein Fehler');

    // Ein Mahnschritt laeuft gerade (frische Sperre): kein Storno parallel zum Mahnversand.
    const { invoice: dunned } = await makeOrderInvoice(33);
    await Invoice.collection.updateOne({ _id: dunned._id }, { $set: { dunningLock: { token: 'fremd', at: new Date() } } });
    const res4 = await tryCall(() => FinancialService.cancelInvoice(dunned._id, { reason: 'x', actorName: 'Admin' }));
    const stored4 = await Invoice.findById(dunned._id).lean();
    check(res4.error && res4.error.statusCode === 409 && res4.error.code === 'DUNNING_IN_PROGRESS' && /Mahn/.test(res4.error.message) && !stored4.cancellation,
      'laufender Mahnschritt: 409 DUNNING_IN_PROGRESS, keine Reservierung', res4.error ? `${res4.error.code} ${res4.error.message}` : 'kein Fehler');
    await Invoice.collection.updateOne({ _id: dunned._id }, { $set: { 'dunningLock.at': new Date(Date.now() - 60 * 60 * 1000) } });
    const res5 = await tryCall(() => FinancialService.cancelInvoice(dunned._id, { reason: 'verwaiste Sperre', actorName: 'Admin' }));
    check(!res5.error, 'verwaiste Mahnsperre blockiert das Storno nicht', res5.error ? `${res5.error.code} ${res5.error.message}` : 'ok');
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
