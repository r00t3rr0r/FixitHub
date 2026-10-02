/**
 * Regressionstest (01.10.2026) Zahlungen, Rechnungen, Buchungssummen (Track "fin").
 *
 * Laeuft ueber die ECHTEN Express-Router mit echter JWT-Pruefung und echter Datenbank:
 *   /api/admin/financial, /api/bookings, /api/invoices.
 *
 * Abgesichert (Befund-IDs aus finance.md / customer-ux.md):
 *   FIN-2  Buchungssummen aus den Auftraegen: manuelle Buchung ohne Checkout-Snapshot
 *          bekommt MwSt. (nicht 0), Auftragsaenderung zieht subtotal/discount/tax mit;
 *          Datenskript recomputeBookingTotals: Dry-Run aendert nichts, --confirm nur bei
 *          gleichem Gesamtbetrag, idempotent, Sicherung geschrieben.
 *   FIN-3  POST /api/bookings/:id/invoice: genau EINE Rechnungs-Mail (mit PDF, BKG-Nummer,
 *          kein Objekt-Dump), ohne "sofort senden" keine Mail, Doppelklick -> 1 Rechnung +
 *          409, nach Storno wieder moeglich, SMTP-Fehler -> 201 + Warnung.
 *   FIN-4  MwSt. in Rechnungs-Mail ("47,40 € (inkl. 7,57 € MwSt. 19 %)"), Buchungs-Mail
 *          ("nach 2,50 € Rabatt"), Zahlungsaufforderung "37,40 €", Zahlungseingang-
 *          Benachrichtigung mit Rechnungsnummer und Restbetrag im deutschen Format.
 *   FIN-6  Finanzbericht: Zeitraum wird beachtet, Teilerstattung abgezogen, keine Mock-
 *          Felder (netProfit/totalExpenses), Zaehler serverseitig.
 *   FIN-9  Zahlungsliste: Buchungs-/Auftrags-/Rechnungsnummer, Zuordnungen, Vorauszahlung
 *          vs. Ueberzahlung, Suche nach BKG/INV/Kunde; Kunde 403.
 *   FIN-10/FIN-13  "Rechnung aus Auftraegen": ORD-Nummern statt IDs, Vorschau ohne
 *          Speichern, deutsche 400, nicht abgeschlossene Auftraege nur mit Bestaetigung,
 *          409 bei bereits berechnet, Reverse-Charge-Profil wird nicht von der Oberflaeche
 *          ueberschrieben (nur mit overrideTax).
 *   FIN-11 Zahlungsaufforderung: 24-h-Sperre (409 PAYMENT_REQUEST_RECENT), force sendet
 *          erneut, kein offener Betrag -> kein Versand.
 *   CUSTUX-7 GET /api/bookings/:id/payments fuer den Inhaber: Kundenprojektion ohne interne
 *          Felder; fremder Kunde / unbekannte / ungueltige ID -> 403; Team unveraendert.
 *   Review-Nachbesserung: Reverse-Charge-/steuerfreie Kunden behalten MwSt. 0 in Buchung,
 *          Sync und Datenskript; Buchungsrechnung folgt dem Steuerprofil (FIN-13 Buchungsweg);
 *          Teilrechnung im Buchungsweg sperrt "Rechnung aus Auftraegen" fuer die uebrigen
 *          Auftraege nicht; laufende (pending) Zahlungsaufforderung sperrt einen zweiten
 *          Versand; Dashboard-Zaehler "Zahlungen in Pruefung" serverseitig.
 *
 * Keine echten E-Mails, kein PayPal, keine externen Hosts (EmailService, Benachrichtigungen
 * und axios gemockt).
 *
 * Aufruf (nur Wegwerf-Datenbank):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_fin_payments node test-fin-payments-invoices-http.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));
// Dieselbe axios-Instanz wie die Router (Paket-Exports -> dist/node/axios.cjs).
const axios = require(require.resolve('axios', { paths: [path.join(SERVER_DIR, 'routes')] }));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_fin_payments';

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
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const looksGerman = (text) => /[äöüß]|Bitte|nicht|bereits|Auftrag|Rechnung|Buchung/i.test(String(text || ''))
  && !/Cast to|validation failed|already exists/i.test(String(text || ''));
// Sucht verbotene (interne) Schluessel in einer Antwort, rekursiv.
const findKeys = (value, pattern, found = []) => {
  if (Array.isArray(value)) value.forEach((entry) => findKeys(entry, pattern, found));
  else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, entry]) => {
      if (pattern.test(key)) found.push(key);
      findKeys(entry, pattern, found);
    });
  }
  return found;
};

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }

  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');

  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  const MODELS_DIR = path.join(SERVER_DIR, 'models');
  fs.readdirSync(MODELS_DIR)
    .filter((file) => file.endsWith('.js'))
    .forEach((file) => {
      try {
        require(path.join(MODELS_DIR, file));
      } catch (error) {
        /* Modelle mit optionalen Abhaengigkeiten ueberspringen */
      }
    });

  // --- MOCKS: niemals echte Mails / Benachrichtigungen / Netzwerk ---------------------
  const sentEmails = [];
  let emailMode = 'success';
  const emailStub = async (name, to, variables, options = {}) => {
    sentEmails.push({ name, to, variables, options });
    if (emailMode === 'fail') return { success: false, error: 'SMTP nicht erreichbar (Test)' };
    return { success: true, messageId: `test-${sentEmails.length}` };
  };
  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.sendTemplateEmail = (name, to, variables, options) => emailStub(name, to, variables, options);
  EmailService.sendTriggerEmail = (trigger, to, variables, options) => emailStub(`trigger:${trigger}`, to, variables, options);
  EmailService.buildSystemUrl = async (p) => `https://test.invalid${p}`;
  const notifications = [];
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => {
    notifications.push(data);
    return { _id: new mongoose.Types.ObjectId(), ...data };
  };
  const axiosCalls = [];
  let paypalOrder = null;
  axios.get = async (url) => {
    axiosCalls.push(`GET ${url}`);
    if (/\/v2\/checkout\/orders\//.test(url) && paypalOrder) return { data: paypalOrder };
    throw new Error(`Test: unerwarteter Netzwerkaufruf ${url}`);
  };
  axios.post = async (url) => {
    axiosCalls.push(`POST ${url}`);
    if (/oauth2\/token/.test(url)) return { data: { access_token: 'test-token' } };
    throw new Error(`Test: unerwarteter Netzwerkaufruf ${url}`);
  };

  const FinancialService = require(path.join(SERVER_DIR, 'services/financialService'));
  const BookingService = require(path.join(SERVER_DIR, 'services/bookingService'));
  const PAYPAL_GATEWAY = {
    _id: 'gw-paypal-test',
    provider: 'paypal',
    name: 'PayPal',
    isActive: true,
    configuration: { environment: 'sandbox', sandbox_client_id: 'id', sandbox_client_secret: 'secret', api_base_url_sandbox: 'https://paypal.test.invalid', currency: 'EUR' },
  };
  FinancialService.getPaymentGateways = async () => [PAYPAL_GATEWAY];

  const financialRoutes = require(path.join(SERVER_DIR, 'routes/financialRoutes'));
  const bookingRoutes = require(path.join(SERVER_DIR, 'routes/bookingRoutes'));
  const invoiceRoutes = require(path.join(SERVER_DIR, 'routes/invoiceRoutes'));
  const { planBookingTotalCorrections, applyBookingTotalCorrections } = require(path.join(SERVER_DIR, 'scripts/recomputeBookingTotals'));

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/admin/financial', financialRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/invoices', invoiceRoutes);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Booking = mongoose.model('Booking');
  const Service = mongoose.model('Service');
  const Invoice = mongoose.model('Invoice');
  const Payment = mongoose.model('Payment');
  const PaymentAllocation = mongoose.model('PaymentAllocation');
  const PaymentRequest = mongoose.model('PaymentRequest');
  const CustomerGroup = mongoose.model('CustomerGroup');
  await Promise.all([Payment.init(), PaymentAllocation.init(), Invoice.init()]);

  const admin = await User.create({ name: 'Admin Fin', email: 'finp-admin@test.invalid', role: 'admin' });
  const staff = await User.create({ name: 'Staff Fin', email: 'finp-staff@test.invalid', role: 'staff' });
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
  const makeCustomer = async (extra = {}) => {
    seq += 1;
    return User.create({ name: `Kundin ${seq} Muster`, firstName: `Kundin${seq}`, lastName: 'Muster', email: `finp-kunde${seq}@test.invalid`, role: 'customer', customerNumber: `K-FINP-${seq}`, ...extra });
  };
  const makeOrder = async (customer, { listPrice = 49.9, discount = 2.5, status = 'completed' } = {}) => {
    seq += 1;
    return Order.create({
      customerId: customer._id,
      orderNumber: `ORD-FINP-${String(seq).padStart(3, '0')}`,
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 15',
      deviceType: 'Smartphone',
      errorDescription: 'Display defekt',
      services: [{ serviceId: service._id, name: 'Displaytausch', price: listPrice, quantity: 1, estimatedTime: 30 }],
      totalCost: Math.round((listPrice - discount) * 100) / 100,
      discount,
      status,
    });
  };
  const makeBooking = async (customer, orderSpecs = [{}], bookingExtra = {}) => {
    const orders = [];
    for (const spec of orderSpecs) orders.push(await makeOrder(customer, spec));
    const r2 = (value) => Math.round(value * 100) / 100;
    const total = r2(orders.reduce((sum, order) => sum + order.totalCost, 0));
    // Wie ein Checkout-Snapshot: Listen-Brutto, Rabatt, enthaltene MwSt., Gesamt.
    const booking = await Booking.create({
      customerId: customer._id,
      orderIds: orders.map((order) => order._id),
      items: orders.map((order) => ({ type: 'repair', orderId: order._id, orderNumber: order.orderNumber, cost: order.totalCost })),
      subtotal: r2(orders.reduce((sum, order) => sum + order.services[0].price, 0)),
      discount: r2(orders.reduce((sum, order) => sum + Number(order.discount || 0), 0)),
      tax: r2(total - total / 1.19),
      totalCost: total,
      status: 'processing',
      ...bookingExtra,
    });
    await Order.updateMany({ _id: { $in: orders.map((order) => order._id) } }, { $set: { bookingId: booking._id } });
    return { booking: await Booking.findById(booking._id).setOptions({ skipAutoPopulate: true }), orders };
  };
  const pay = (booking, order, amount, extra = {}) => Payment.create({
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
    notes: 'interne Notiz – nur Team',
    ...extra,
  });
  const mailsNamed = (name) => sentEmails.filter((mail) => mail.name === name);

  const owner = await makeCustomer();
  const other = await makeCustomer();

  // ------------------------------------------------------------------------------------
  await runSection('FIN-9 Zahlungsliste mit Bezuegen, Vorauszahlung vs. Ueberzahlung, Suche', async () => {
    const P = await makeBooking(owner);
    const prepayment = await pay(P.booking, P.orders[0], 10);
    let list = await call('GET', '/api/admin/financial/payments', admin);
    let row = (list.body?.payments || []).find((entry) => String(entry._id) === String(prepayment._id));
    check(list.status === 200 && row, 'Admin GET /payments -> 200 mit Zahlung', list.status);
    check(row && row.bookingNumber === P.booking.bookingNumber && /^BKG-/.test(row.bookingNumber), 'Buchungsnummer aufgeloest', row && row.bookingNumber);
    check(row && row.orderNumber === P.orders[0].orderNumber, 'Auftragsnummer aufgeloest', row && row.orderNumber);
    check(row && row.unallocatedKind === 'prepayment' && near(row.unallocatedAmount, 10), 'vor der Rechnung: Vorauszahlung 10 € (kein Ueberzahlungsalarm)', row && `${row.unallocatedKind} ${row.unallocatedAmount}`);

    const created = await call('POST', `/api/bookings/${P.booking._id}/invoice`, staff, { sendImmediately: false });
    check(created.status === 201 && /^INV-/.test(created.body?.invoice?.invoiceNumber || ''), 'Buchungsrechnung erstellt', `${created.status} ${created.body?.invoice?.invoiceNumber}`);
    list = await call('GET', '/api/admin/financial/payments', admin);
    row = (list.body?.payments || []).find((entry) => String(entry._id) === String(prepayment._id));
    check(row && row.allocations?.length === 1 && row.allocations[0].invoiceNumber === created.body?.invoice?.invoiceNumber && near(row.allocations[0].allocatedAmount, 10), 'nach der Rechnung: Zuordnung 10 € -> INV', row && JSON.stringify(row.allocations));
    check(row && near(row.unallocatedAmount, 0) && !row.unallocatedKind, 'nichts mehr unzugeordnet', row && `${row.unallocatedAmount} ${row.unallocatedKind}`);
    check(row && row.invoiceNumber === created.body?.invoice?.invoiceNumber, 'Rechnungsnummer an der Zahlung', row && row.invoiceNumber);

    const O = await makeBooking(owner);
    await call('POST', `/api/bookings/${O.booking._id}/invoice`, staff, { sendImmediately: false });
    const over = await pay(O.booking, O.orders[0], 60);
    await FinancialService.finalizeInvoiceCreation(await Invoice.findOne({ bookingId: O.booking._id })).catch(() => null);
    list = await call('GET', '/api/admin/financial/payments', admin);
    row = (list.body?.payments || []).find((entry) => String(entry._id) === String(over._id));
    const overAllocated = row ? (row.allocations || []).reduce((s, a) => s + a.allocatedAmount, 0) : 0;
    check(row && (near(row.unallocatedAmount, 12.6) || near(row.unallocatedAmount, 60 - overAllocated)) && (row.unallocatedAmount <= 0.009 || row.unallocatedKind === 'overpayment'), 'mehr bezahlt als berechnet: Ueberzahlung (nicht Vorauszahlung)', row && `${row.unallocatedKind} ${row.unallocatedAmount} alloc ${overAllocated}`);

    const byBooking = await call('GET', `/api/admin/financial/payments?search=${encodeURIComponent(P.booking.bookingNumber)}`, admin);
    check(byBooking.status === 200 && (byBooking.body?.payments || []).some((entry) => String(entry._id) === String(prepayment._id)) && byBooking.body.payments.every((entry) => String(entry.bookingId) === String(P.booking._id)), 'Suche nach BKG-Nummer findet genau diese Buchung', (byBooking.body?.payments || []).length);
    const byInvoice = await call('GET', `/api/admin/financial/payments?search=${encodeURIComponent(created.body?.invoice?.invoiceNumber)}`, admin);
    check((byInvoice.body?.payments || []).some((entry) => String(entry._id) === String(prepayment._id)), 'Suche nach INV-Nummer (ueber Zuordnung) findet die Zahlung', (byInvoice.body?.payments || []).length);
    const byName = await call('GET', `/api/admin/financial/payments?search=${encodeURIComponent(owner.email)}`, admin);
    check((byName.body?.payments || []).length >= 2, 'Suche nach Kunden-E-Mail', (byName.body?.payments || []).length);
    const none = await call('GET', '/api/admin/financial/payments?search=BKG-0000-NICHTDA', admin);
    check(none.status === 200 && (none.body?.payments || []).length === 0 && none.body?.totalCount === 0, 'Suche ohne Treffer -> leere Liste', none.body?.totalCount);
    const asCustomer = await call('GET', '/api/admin/financial/payments', owner);
    check(asCustomer.status === 403, 'Kunde -> 403', asCustomer.status);
    const asStaff = await call('GET', '/api/admin/financial/payments', staff);
    check(asStaff.status === 403, 'Mitarbeiter -> 403 (Finanzen nur Admin)', asStaff.status);
  });

  // ------------------------------------------------------------------------------------
  await runSection('FIN-3/FIN-4 Buchungsrechnung: genau eine Mail, MwSt., Doppelklick, Storno, SMTP-Fehler', async () => {
    const Q = await makeBooking(owner);
    const before = mailsNamed('trigger:invoice_created').length;
    const res = await call('POST', `/api/bookings/${Q.booking._id}/invoice`, staff, { sendImmediately: true });
    await sleep(200);
    const mails = mailsNamed('trigger:invoice_created').slice(before);
    check(res.status === 201 && res.body?.sent === true && !res.body?.warning, 'POST sendImmediately -> 201, sent', `${res.status} ${res.body?.sent} ${res.body?.warning}`);
    check(mails.length === 1, 'genau EINE Rechnungs-Mail (frueher 2)', mails.length);
    const mail = mails[0] || { variables: {}, options: {} };
    check((mail.options?.attachments || []).some((a) => /\.pdf$/.test(a.filename) && a.content && a.content.length > 100), 'Mail hat PDF-Anhang', (mail.options?.attachments || []).map((a) => a.filename).join(','));
    check(mail.variables.orderNumber === Q.booking.bookingNumber, 'Bezug = BKG-Nummer (kein Objekt-Dump)', mail.variables.orderNumber);
    check(!JSON.stringify(mail.variables).includes('ObjectId'), 'kein "ObjectId(" in den Mail-Variablen', JSON.stringify(mail.variables).includes('ObjectId'));
    check(mail.variables.invoiceAmount === '47,40 € (inkl. 7,57 € MwSt. 19 %)', 'FIN-4 Rechnungsbetrag mit MwSt.', mail.variables.invoiceAmount);
    check(mail.variables.invoiceNetAmount === '39,83 €' && mail.variables.invoiceTaxAmount === '7,57 €', 'Netto/MwSt.-Variablen', `${mail.variables.invoiceNetAmount} / ${mail.variables.invoiceTaxAmount}`);

    const again = await call('POST', `/api/bookings/${Q.booking._id}/invoice`, staff, { sendImmediately: false });
    check(again.status === 409 && looksGerman(again.body?.error), 'zweite Rechnung -> 409 deutsch', `${again.status} ${again.body?.error}`);

    const noSend = await makeBooking(owner);
    const beforeNoSend = sentEmails.length;
    const r0 = await call('POST', `/api/bookings/${noSend.booking._id}/invoice`, staff, { sendImmediately: false });
    await sleep(200);
    check(r0.status === 201 && sentEmails.length === beforeNoSend && r0.body?.sent === false, 'ohne "sofort senden": 201, keine Mail', `${r0.status} mails+${sentEmails.length - beforeNoSend}`);

    const R = await makeBooking(owner);
    const [p1, p2] = await Promise.all([
      call('POST', `/api/bookings/${R.booking._id}/invoice`, staff, { sendImmediately: false }),
      call('POST', `/api/bookings/${R.booking._id}/invoice`, staff, { sendImmediately: false }),
    ]);
    const statuses = [p1.status, p2.status].sort();
    const countR = await Invoice.countDocuments({ bookingId: R.booking._id, isCreditNote: { $ne: true } });
    check(statuses[0] === 201 && statuses[1] === 409 && countR === 1, 'Doppelklick: 1x 201 + 1x 409, genau 1 Rechnung', `${statuses.join('/')} count=${countR}`);

    const invoiceR = await Invoice.findOne({ bookingId: R.booking._id, isCreditNote: { $ne: true } });
    const cancel = await call('POST', `/api/admin/financial/invoices/${invoiceR._id}/cancel`, admin, { reason: 'Test' });
    check(cancel.status === 200, 'Storno ueber /api/admin/financial/invoices/:id/cancel', `${cancel.status} ${cancel.body?.error || ''}`);
    const afterStorno = await call('POST', `/api/bookings/${R.booking._id}/invoice`, staff, { sendImmediately: false });
    check(afterStorno.status === 201, 'nach Storno: neue Buchungsrechnung moeglich (frueher englische 409 wegen INV-CN)', `${afterStorno.status} ${afterStorno.body?.error || ''}`);

    const S = await makeBooking(owner);
    emailMode = 'fail';
    const failed = await call('POST', `/api/bookings/${S.booking._id}/invoice`, staff, { sendImmediately: true });
    emailMode = 'success';
    check(failed.status === 201 && failed.body?.sent === false && /nicht versendet/.test(failed.body?.warning || ''), 'SMTP-Fehler: 201 + Warnung "erstellt, aber nicht versendet"', `${failed.status} ${failed.body?.warning}`);
    check(await Invoice.countDocuments({ bookingId: S.booking._id }) === 1, 'Rechnung bleibt trotz Versandfehler bestehen', 1);

    const asCustomer = await call('POST', `/api/bookings/${S.booking._id}/invoice`, owner, {});
    check(asCustomer.status === 403, 'Kunde darf keine Rechnung erstellen -> 403', asCustomer.status);
  });

  // ------------------------------------------------------------------------------------
  await runSection('FIN-10/FIN-13 Rechnung aus Auftraegen (ORD-Nummern, Vorschau, Steuerprofil)', async () => {
    const cust = await makeCustomer();
    const order5 = await makeOrder(cust, { listPrice: 49.9, discount: 2.5 });
    const invoiceCountBefore = await Invoice.countDocuments({});
    const preview = await call('POST', '/api/admin/financial/invoices/from-repairs', admin, { repairOrderIds: [order5.orderNumber], options: { dryRun: true } });
    const pv = preview.body?.preview || {};
    check(preview.status === 200 && near(pv.subtotal, 39.83) && near(pv.tax, 7.57) && near(pv.total, 47.4) && pv.canCreate === true, 'Vorschau mit ORD-Nummer: 39,83 / 7,57 / 47,40', `${preview.status} ${pv.subtotal}/${pv.tax}/${pv.total} ${preview.body?.error || ''}`);
    check(pv.customer?.email === cust.email && pv.orders?.[0]?.orderNumber === order5.orderNumber, 'Vorschau nennt Kunde und Auftrag', `${pv.customer?.email} ${pv.orders?.[0]?.orderNumber}`);
    check(await Invoice.countDocuments({}) === invoiceCountBefore, 'Vorschau speichert nichts', await Invoice.countDocuments({}));

    const unknown = await call('POST', '/api/admin/financial/invoices/from-repairs', admin, { repairOrderIds: ['ORD-GIBT-ES-NICHT'] });
    check(unknown.status === 400 && /wurde nicht gefunden/.test(unknown.body?.error || '') && !/Cast/.test(unknown.body?.error || ''), 'unbekannte Nummer -> 400 deutsch (kein CastError)', `${unknown.status} ${unknown.body?.error}`);
    const empty = await call('POST', '/api/admin/financial/invoices/from-repairs', admin, { repairOrderIds: [] });
    check(empty.status === 400 && looksGerman(empty.body?.error), 'leere Auswahl -> 400 deutsch', `${empty.status} ${empty.body?.error}`);

    const created = await call('POST', '/api/admin/financial/invoices/from-repairs', admin, { repairOrderIds: [order5.orderNumber], options: {} });
    check(created.status === 201 && near(created.body?.invoice?.total, 47.4) && near(created.body?.invoice?.tax, 7.57), 'Rechnung erstellt 47,40 (MwSt. 7,57)', `${created.status} ${created.body?.invoice?.total}`);
    const dup = await call('POST', '/api/admin/financial/invoices/from-repairs', admin, { repairOrderIds: [String(order5._id)], options: {} });
    check(dup.status === 409 && dup.body?.existingInvoice, 'nochmal (auch per ID) -> 409 mit bestehender Rechnung', `${dup.status} ${dup.body?.error}`);
    const pvDup = await call('POST', '/api/admin/financial/invoices/from-repairs', admin, { repairOrderIds: [order5.orderNumber], options: { dryRun: true } });
    check(pvDup.status === 200 && pvDup.body?.preview?.canCreate === false && pvDup.body?.preview?.orders?.[0]?.alreadyInvoicedBy?.invoiceNumber === created.body?.invoice?.invoiceNumber, 'Vorschau zeigt "bereits berechnet"', JSON.stringify(pvDup.body?.preview?.orders?.[0]?.alreadyInvoicedBy));

    const pending = await makeOrder(cust, { listPrice: 49.9, discount: 7.48, status: 'in-progress' });
    const blocked = await call('POST', '/api/admin/financial/invoices/from-repairs', admin, { repairOrderIds: [pending.orderNumber], options: {} });
    check(blocked.status === 409 && blocked.body?.code === 'ORDERS_NOT_COMPLETED' && looksGerman(blocked.body?.error), 'nicht abgeschlossen ohne Bestaetigung -> 409', `${blocked.status} ${blocked.body?.code}`);
    const confirmed = await call('POST', '/api/admin/financial/invoices/from-repairs', admin, { repairOrderIds: [pending.orderNumber], options: { confirmIncompleteOrders: true } });
    check(confirmed.status === 201 && near(confirmed.body?.invoice?.total, 42.42) && near(confirmed.body?.invoice?.subtotal, 35.65) && near(confirmed.body?.invoice?.tax, 6.77), 'mit Bestaetigung: 15 % -> 42,42 / 35,65 / 6,77', `${confirmed.status} ${confirmed.body?.invoice?.total}/${confirmed.body?.invoice?.subtotal}`);

    const rcGroup = await CustomerGroup.create({ key: 'finp-rc', name: 'Reverse Charge', financeProfile: { taxMode: 'reverse_charge' } });
    const rcCust = await makeCustomer({ primaryCustomerGroupId: rcGroup._id });
    const rcOrder = await makeOrder(rcCust, { listPrice: 49.9, discount: 2.5 });
    // So sendete die alte Oberflaeche immer: isReverseCharge false + 19 %.
    const rcPreview = await call('POST', '/api/admin/financial/invoices/from-repairs', admin, { repairOrderIds: [rcOrder.orderNumber], options: { dryRun: true, isReverseCharge: false, taxRate: 19 } });
    check(rcPreview.status === 200 && rcPreview.body?.preview?.isReverseCharge === true && near(rcPreview.body?.preview?.tax, 0), 'Reverse-Charge-Profil wird ohne overrideTax NICHT ueberschrieben (MwSt. 0)', `${rcPreview.body?.preview?.isReverseCharge} ${rcPreview.body?.preview?.tax}`);
    const rcOverride = await call('POST', '/api/admin/financial/invoices/from-repairs', admin, { repairOrderIds: [rcOrder.orderNumber], options: { dryRun: true, overrideTax: true, isReverseCharge: false, taxRate: 19 } });
    check(rcOverride.body?.preview?.isReverseCharge === false && near(rcOverride.body?.preview?.tax, 7.57) && rcOverride.body?.preview?.profileTax?.isReverseCharge === true, 'nur mit ausdruecklicher Abweichung 19 %; Profil wird weiter angezeigt', `${rcOverride.body?.preview?.isReverseCharge} ${rcOverride.body?.preview?.tax}`);
    const rcCreate = await call('POST', '/api/admin/financial/invoices/from-repairs', admin, { repairOrderIds: [rcOrder.orderNumber], options: { isReverseCharge: false, taxRate: 19 } });
    check(rcCreate.status === 201 && rcCreate.body?.invoice?.isReverseCharge === true && near(rcCreate.body?.invoice?.tax, 0), 'erstellte Rechnung: Reverse Charge, MwSt. 0', `${rcCreate.status} ${rcCreate.body?.invoice?.isReverseCharge} ${rcCreate.body?.invoice?.tax}`);
    const rcOrderAfter = await Order.findById(rcOrder._id).lean();
    check(rcOrderAfter.taxRate === rcOrder.taxRate, 'Steuer-Snapshot des Auftrags unveraendert', `${rcOrder.taxRate} -> ${rcOrderAfter.taxRate}`);

    const asCustomer = await call('POST', '/api/admin/financial/invoices/from-repairs', cust, { repairOrderIds: [order5.orderNumber], options: { dryRun: true } });
    check(asCustomer.status === 403, 'Kunde -> 403', asCustomer.status);
  });

  // ------------------------------------------------------------------------------------
  let requestBooking = null;
  await runSection('FIN-11/FIN-4 Zahlungsaufforderung mit Sperrfrist', async () => {
    const T = await makeBooking(owner);
    requestBooking = T;
    await call('POST', `/api/bookings/${T.booking._id}/invoice`, staff, { sendImmediately: false });
    await pay(T.booking, T.orders[0], 10);
    const invoice = await Invoice.findOne({ bookingId: T.booking._id });
    await FinancialService.finalizeInvoiceCreation(invoice).catch(() => null);
    const before = sentEmails.length;
    const first = await call('POST', `/api/admin/financial/bookings/${encodeURIComponent(T.booking.bookingNumber)}/payment-request`, admin, {});
    check(first.status === 200 && first.body?.status === 'accepted_by_provider', 'erste Aufforderung -> uebergeben', `${first.status} ${first.body?.status} ${first.body?.error || ''}`);
    const mail = sentEmails.slice(before)[0] || { variables: {} };
    check(mail.variables.openAmount === '37,40 €' && /37,40 €/.test(mail.variables.notificationBody || '') && /INV-/.test(mail.variables.notificationBody || ''), 'Mail: "37,40 €" (nicht "EUR 37.40") mit Rechnungsnummer', mail.variables.openAmount);
    check(await PaymentRequest.countDocuments({ bookingId: T.booking._id }) === 1, '1 Protokolleintrag', 1);

    const beforeSecond = sentEmails.length;
    const second = await call('POST', `/api/admin/financial/bookings/${encodeURIComponent(T.booking.bookingNumber)}/payment-request`, admin, {});
    check(second.status === 409 && second.body?.code === 'PAYMENT_REQUEST_RECENT' && second.body?.recentRequest?.recipientEmail === owner.email, 'innerhalb 24 h -> 409 PAYMENT_REQUEST_RECENT mit Empfaenger', `${second.status} ${second.body?.code} ${second.body?.recentRequest?.recipientEmail}`);
    check(looksGerman(second.body?.error) && /Zuletzt am/.test(second.body?.error || ''), 'Meldung deutsch "Zuletzt am …"', second.body?.error);
    check(sentEmails.length === beforeSecond && await PaymentRequest.countDocuments({ bookingId: T.booking._id }) === 1, 'keine Mail, kein neuer Eintrag', sentEmails.length - beforeSecond);

    const forced = await call('POST', `/api/admin/financial/bookings/${encodeURIComponent(T.booking.bookingNumber)}/payment-request`, admin, { force: true, amount: 20 });
    check(forced.status === 200 && forced.body?.status === 'accepted_by_provider' && await PaymentRequest.countDocuments({ bookingId: T.booking._id }) === 2, 'force: true -> erneut gesendet (2 Eintraege)', `${forced.status} ${forced.body?.status}`);

    const paid = await makeBooking(owner);
    await call('POST', `/api/bookings/${paid.booking._id}/invoice`, staff, { sendImmediately: false });
    await pay(paid.booking, paid.orders[0], 47.4);
    await FinancialService.finalizeInvoiceCreation(await Invoice.findOne({ bookingId: paid.booking._id })).catch(() => null);
    const noOpen = await call('POST', `/api/admin/financial/bookings/${encodeURIComponent(paid.booking.bookingNumber)}/payment-request`, admin, {});
    check(noOpen.body?.status === 'no_open_balance' && await PaymentRequest.countDocuments({ bookingId: paid.booking._id }) === 0, 'kein offener Betrag -> kein Versand, kein Eintrag', noOpen.body?.status);
    const asCustomer = await call('POST', `/api/admin/financial/bookings/${encodeURIComponent(T.booking.bookingNumber)}/payment-request`, owner, {});
    check(asCustomer.status === 403, 'Kunde -> 403', asCustomer.status);
  });

  // ------------------------------------------------------------------------------------
  await runSection('CUSTUX-7 Kundenprojektion der Buchungszahlungen', async () => {
    const T = requestBooking;
    const own = await call('GET', `/api/bookings/${T.booking._id}/payments`, owner);
    const s = own.body?.summary || {};
    check(own.status === 200 && near(s.referenceTotal, 47.4) && near(s.receivedTotal, 10) && near(s.openOrderBalance, 37.4), 'Inhaber: Gesamt 47,40 / Bezahlt 10 / Offen 37,40', `${own.status} ${s.referenceTotal}/${s.receivedTotal}/${s.openOrderBalance}`);
    check(own.body?.appliesToWholeBooking === true && own.body?.orderCount === 1 && own.body?.currency === 'EUR', 'Hinweis "gilt fuer die gesamte Buchung", Anzahl Geraete, EUR', `${own.body?.appliesToWholeBooking} ${own.body?.orderCount}`);
    check((own.body?.payments || []).length === 1 && near(own.body.payments[0].amount, 10) && own.body.payments[0].allocations?.[0]?.invoiceNumber?.startsWith('INV-'), 'Zahlungsbewegung mit Rechnungsbezug', JSON.stringify(own.body?.payments?.[0]?.allocations));
    const forbidden = findKeys(own.body, /^(metadata|notes|createdBy|recordedBy|gatewayResponse|paypal.*|idempotencyKey|transactionId|refunds|customerId|internal.*)$/i);
    check(forbidden.length === 0, 'keine internen Felder (metadata, notes, PayPal-IDs, …)', forbidden.join(',') || 'keine');
    check(!JSON.stringify(own.body).includes('interne Notiz'), 'interne Notiz nicht im Text', JSON.stringify(own.body).includes('interne Notiz'));

    const foreign = await call('GET', `/api/bookings/${T.booking._id}/payments`, other);
    check(foreign.status === 403, 'fremder Kunde -> 403', foreign.status);
    const unknown = await call('GET', `/api/bookings/${new mongoose.Types.ObjectId()}/payments`, owner);
    check(unknown.status === 403, 'unbekannte ID fuer Kunden -> 403 (nicht unterscheidbar)', unknown.status);
    const invalid = await call('GET', `/api/bookings/${encodeURIComponent(T.booking.bookingNumber)}/payments`, owner);
    check(invalid.status === 403, 'Buchungsnummer statt ID fuer Kunden -> 403', invalid.status);
    const noAuth = await call('GET', `/api/bookings/${T.booking._id}/payments`, null);
    check(noAuth.status === 401, 'ohne Anmeldung -> 401', noAuth.status);
    const asStaff = await call('GET', `/api/bookings/${T.booking._id}/payments`, staff);
    check(asStaff.status === 200 && Array.isArray(asStaff.body?.payments) && asStaff.body?.booking && asStaff.body?.summary && asStaff.body.payments[0]?.metadata, 'Team: vollstaendige Uebersicht unveraendert (inkl. interner Felder)', `${asStaff.status} ${Boolean(asStaff.body?.payments?.[0]?.metadata)}`);

    const U = await makeBooking(owner);
    await call('POST', `/api/bookings/${U.booking._id}/invoice`, staff, { sendImmediately: false });
    await pay(U.booking, U.orders[0], 50);
    await FinancialService.finalizeInvoiceCreation(await Invoice.findOne({ bookingId: U.booking._id })).catch(() => null);
    const overpaid = await call('GET', `/api/bookings/${U.booking._id}/payments`, owner);
    check(near(overpaid.body?.summary?.overpaidTotal, 2.6) && near(overpaid.body?.summary?.openOrderBalance, 0), 'ueberzahlt 50 auf 47,40 -> Erstattung offen 2,60', `${overpaid.body?.summary?.overpaidTotal}`);
  });

  // ------------------------------------------------------------------------------------
  await runSection('FIN-4 Zahlungseingang-Benachrichtigung (Rechnungsnummer, Restbetrag, de-Format)', async () => {
    const V = await makeBooking(owner);
    const created = await call('POST', `/api/bookings/${V.booking._id}/invoice`, staff, { sendImmediately: false });
    const invoiceId = created.body?.invoice?._id;
    paypalOrder = {
      id: 'PPORDER-1',
      status: 'COMPLETED',
      purchase_units: [{ custom_id: String(invoiceId), amount: { value: '47.40' }, payments: { captures: [{ id: 'CAPTURE-1', amount: { value: '47.40' } }] } }],
      payer: { payer_id: 'PAYER' },
    };
    const before = notifications.length;
    const confirm = await call('POST', `/api/invoices/${invoiceId}/payments/confirm`, owner, { gatewayProvider: 'paypal', gatewayId: PAYPAL_GATEWAY._id, providerReference: 'PPORDER-1' });
    check([200, 201].includes(confirm.status) && confirm.body?.success === true, 'Zahlung bestaetigt (PayPal gemockt)', `${confirm.status} ${confirm.body?.error || ''}`);
    const note = notifications.slice(before).find((entry) => entry.type === 'payment');
    check(note && note.title === 'Zahlung eingegangen', 'Titel "Zahlung eingegangen"', note && note.title);
    check(note && note.message.includes('47,40 €') && note.message.includes(created.body?.invoice?.invoiceNumber) && note.message.includes('Offener Restbetrag: 0,00 €'), 'Text mit 47,40 €, Rechnungsnummer und Restbetrag', note && note.message);
    check(note && !/47\.40 EUR/.test(note.message) && note.actionUrl === `/invoices?invoiceId=${invoiceId}`, 'kein "47.40 EUR", Link zur Rechnung', note && note.actionUrl);
    check(axiosCalls.every((entry) => /paypal\.test\.invalid/.test(entry)), 'nur gemockte PayPal-Aufrufe', axiosCalls.length);
  });

  // ------------------------------------------------------------------------------------
  await runSection('FIN-6 Finanzbericht: Zeitraum, Erstattungen, keine Mock-Felder', async () => {
    const W = await makeBooking(owner);
    const inMarch = new Date(2020, 2, 5, 12);
    await pay(W.booking, W.orders[0], 47.4, { paymentDate: inMarch, createdAt: inMarch });
    await pay(W.booking, W.orders[0], 42.42, { paymentDate: new Date(2020, 1, 10, 12), createdAt: new Date(2020, 1, 10, 12) });
    await pay(W.booking, W.orders[0], 10, { paymentDate: new Date(2020, 2, 8, 12), refundAmount: 4, refunds: [{ amount: 4, status: 'completed', createdAt: new Date(2020, 2, 10, 12), completedAt: new Date(2020, 2, 10, 12) }] });
    const res = await call('GET', '/api/admin/financial/reports?dateFrom=2020-03-01&dateTo=2020-03-31T23:59:59', admin);
    const r = res.body?.report || {};
    check(res.status === 200 && near(r.collectedGross, 53.4) && near(r.totalRevenue, 53.4), 'Maerz 2020: Zahlungseingang 47,40 + (10 - 4) = 53,40 (Februar zaehlt nicht)', `${res.status} ${r.collectedGross}`);
    check(near(r.refundAmount, 4), 'Erstattungen im Zeitraum 4,00', r.refundAmount);
    check(!('netProfit' in r) && !('totalExpenses' in r) && !('grossMargin' in r), 'keine Mock-Felder (Nettogewinn/Ausgaben/Marge)', Object.keys(r).join(','));
    check(/01\.03\.2020/.test(r.period || '') && /31\.03\.2020/.test(r.period || ''), 'Zeitraum deutsch formatiert', r.period);
    check(typeof r.openInvoiceCount === 'number' && typeof r.overdueInvoiceCount === 'number' && typeof r.openReceivablesGross === 'number' && r.openInvoiceCount >= 1, 'offene/ueberfaellige Rechnungen serverseitig gezaehlt', `${r.openInvoiceCount}/${r.overdueInvoiceCount}/${r.openReceivablesGross}`);
    const month = await call('GET', '/api/admin/financial/reports?period=month', admin);
    const now = new Date();
    const expectedFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    check(month.body?.report?.periodKey === 'month' && month.body?.report?.dateFrom === expectedFrom, 'period=month beginnt am 1. des Monats (frueher ignoriert)', `${month.body?.report?.periodKey} ${month.body?.report?.dateFrom}`);
    const bad = await call('GET', '/api/admin/financial/reports?dateFrom=kein-datum', admin);
    check(bad.status === 400 && looksGerman(bad.body?.error), 'ungueltiger Zeitraum -> 400 deutsch', `${bad.status} ${bad.body?.error}`);
    const asCustomer = await call('GET', '/api/admin/financial/reports', owner);
    check(asCustomer.status === 403, 'Kunde -> 403', asCustomer.status);
  });

  // ------------------------------------------------------------------------------------
  await runSection('FIN-2/FIN-4 Buchungssummen aus Auftraegen + Buchungs-Mail', async () => {
    const cust = await makeCustomer();
    const manualOrder = await makeOrder(cust, { listPrice: 119, discount: 0 });
    const beforeMail = sentEmails.length;
    const manual = await BookingService.create({ customerId: cust._id, orderIds: [manualOrder._id], createShippingLabel: false });
    check(near(manual.tax, 19) && near(manual.subtotal, 119) && near(manual.totalCost, 119) && near(manual.discount, 0), 'manuelle Buchung ohne Checkout: MwSt. 19,00 aus 119 (frueher 0)', `${manual.subtotal}/${manual.discount}/${manual.tax}/${manual.totalCost}`);

    const checkoutOrder = await makeOrder(cust, { listPrice: 49.9, discount: 2.5 });
    const checkout = await BookingService.create({ customerId: cust._id, orderIds: [checkoutOrder._id], createShippingLabel: false, checkoutPricing: { subtotal: 49.9, totalDiscount: 2.5, tax: 7.57, total: 47.4 } });
    check(near(checkout.subtotal, 49.9) && near(checkout.discount, 2.5) && near(checkout.tax, 7.57) && near(checkout.totalCost, 47.4), 'Checkout-Snapshot bleibt massgeblich', `${checkout.subtotal}/${checkout.discount}/${checkout.tax}/${checkout.totalCost}`);
    await sleep(400);
    const bookingMails = sentEmails.slice(beforeMail).filter((mail) => mail.name === 'trigger:booking_created');
    const checkoutMail = bookingMails.find((mail) => mail.variables.bookingNumber === checkout.bookingNumber);
    check(checkoutMail && checkoutMail.variables.totalAmount === '47,40 € (nach 2,50 € Rabatt, inkl. 7,57 € MwSt.)', 'Buchungs-Mail mit Rabatt und MwSt.', checkoutMail && checkoutMail.variables.totalAmount);
    const manualMail = bookingMails.find((mail) => mail.variables.bookingNumber === manual.bookingNumber);
    check(manualMail && !/0,00 € MwSt/.test(manualMail.variables.totalAmount) && /119,00 €/.test(manualMail.variables.totalAmount), 'manuelle Buchung: nie "0,00 € MwSt."', manualMail && manualMail.variables.totalAmount);

    // Auftragsaenderung: +30 € Service -> Sync zieht ALLE Geldfelder nach.
    await Order.updateOne({ _id: checkoutOrder._id }, { $push: { services: { serviceId: service._id, name: 'Akku', price: 30, quantity: 1, estimatedTime: 20 } }, $set: { totalCost: 77.4, bookingId: checkout._id } });
    await FinancialService.syncOrderAndBookingValue(String(checkout._id), 'booking');
    const synced = await Booking.findById(checkout._id).setOptions({ skipAutoPopulate: true }).lean();
    check(near(synced.totalCost, 77.4) && near(synced.subtotal, 79.9) && near(synced.discount, 2.5) && near(synced.tax, 12.36), 'nach Aenderung: 79,90 - 2,50 = 77,40, MwSt. 12,36', `${synced.subtotal}/${synced.discount}/${synced.tax}/${synced.totalCost}`);
    check(near(synced.subtotal - synced.discount, synced.totalCost), 'Invariante subtotal - discount = totalCost', synced.subtotal - synced.discount);

    // Datenskript (Altbestand): veralteter Snapshot vs. abweichender Gesamtbetrag.
    const legacyCust = await makeCustomer();
    const stale = await makeBooking(legacyCust, [{ listPrice: 49.9, discount: 2.5 }], { subtotal: 47.4, discount: 0, tax: 0 });
    const mismatch = await makeBooking(legacyCust, [{ listPrice: 100, discount: 0 }]);
    await Booking.updateOne({ _id: mismatch.booking._id }, { $set: { totalCost: 90, subtotal: 100, discount: 10, tax: 0 } });
    const plan = await planBookingTotalCorrections();
    const staleEntry = plan.fixable.find((entry) => entry._id === String(stale.booking._id));
    const mismatchEntry = plan.reviewOnly.find((entry) => entry._id === String(mismatch.booking._id));
    check(staleEntry && near(staleEntry.next.subtotal, 49.9) && near(staleEntry.next.discount, 2.5) && near(staleEntry.next.tax, 7.57), 'Skript: veralteter Snapshot korrigierbar (49,90 / 2,50 / 7,57)', staleEntry && JSON.stringify(staleEntry.next));
    check(Boolean(mismatchEntry) && !plan.fixable.some((entry) => entry._id === String(mismatch.booking._id)), 'Skript: abweichender Gesamtbetrag nur gemeldet', mismatchEntry && mismatchEntry.reason);
    const untouched = await Booking.findById(stale.booking._id).setOptions({ skipAutoPopulate: true }).lean();
    check(near(untouched.tax, 0), 'Dry-Run (Planung) schreibt nichts', untouched.tax);
    const backupFile = path.join(os.tmpdir(), `fin-test-backup-${process.pid}.json`);
    const applied = await applyBookingTotalCorrections({ fixable: [staleEntry] }, { backupFile });
    const fixed = await Booking.findById(stale.booking._id).setOptions({ skipAutoPopulate: true }).lean();
    const mismatchAfter = await Booking.findById(mismatch.booking._id).setOptions({ skipAutoPopulate: true }).lean();
    check(applied.written === 1 && near(fixed.tax, 7.57) && near(fixed.subtotal, 49.9) && near(fixed.totalCost, 47.4), '--confirm: Snapshot korrigiert, Gesamtbetrag unveraendert', `${applied.written} ${fixed.subtotal}/${fixed.tax}/${fixed.totalCost}`);
    check(near(mismatchAfter.totalCost, 90) && near(mismatchAfter.discount, 10), 'abweichende Buchung unveraendert', `${mismatchAfter.totalCost}/${mismatchAfter.discount}`);
    const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    check(backup.length === 1 && near(backup[0].old.tax, 0), 'Sicherung der alten Werte geschrieben', JSON.stringify(backup[0]?.old));
    fs.unlinkSync(backupFile);
    const replan = await planBookingTotalCorrections();
    check(!replan.fixable.some((entry) => entry._id === String(stale.booking._id)), 'idempotent: zweiter Lauf findet nichts mehr', replan.fixable.length);
  });

  // ------------------------------------------------------------------------------------
  // Nachbesserung nach dem Review: steuerbefreite Kunden, Buchungsrechnung nach Profil,
  // Teilrechnungen, Sperrfrist bei laufender Aufforderung, Dashboard-Zaehler.
  await runSection('Review: Reverse Charge / steuerfrei in Buchungssummen, Skript und Buchungsrechnung', async () => {
    const rcGroup = await CustomerGroup.create({ key: 'finp-rc-review', name: 'RC Review', financeProfile: { taxMode: 'reverse_charge' } });
    const tfGroup = await CustomerGroup.create({ key: 'finp-tf-review', name: 'Steuerfrei Review', financeProfile: { taxMode: 'tax_free' } });
    const rcCust = await makeCustomer({ primaryCustomerGroupId: rcGroup._id });
    const tfCust = await makeCustomer({ primaryCustomerGroupId: tfGroup._id });

    // Checkout-Snapshot eines Reverse-Charge-Kunden: MwSt. 0.
    const rc = await makeBooking(rcCust, [{ listPrice: 49.9, discount: 2.5 }], { tax: 0 });
    const plan = await planBookingTotalCorrections();
    check(!plan.fixable.some((entry) => entry._id === String(rc.booking._id)), 'Skript: Reverse-Charge-Buchung mit MwSt. 0 ist NICHT korrigierbar', plan.fixable.filter((e) => e._id === String(rc.booking._id)).length);

    await Order.updateOne({ _id: rc.orders[0]._id }, { $push: { services: { serviceId: service._id, name: 'Akku', price: 30, quantity: 1, estimatedTime: 20 } }, $set: { totalCost: 77.4 } });
    await FinancialService.syncOrderAndBookingValue(String(rc.booking._id), 'booking');
    const rcSynced = await Booking.findById(rc.booking._id).setOptions({ skipAutoPopulate: true }).lean();
    check(near(rcSynced.totalCost, 77.4) && near(rcSynced.subtotal, 79.9) && near(rcSynced.tax, 0), 'Auftragsaenderung: Reverse Charge bleibt MwSt. 0 (Summen nachgezogen)', `${rcSynced.subtotal}/${rcSynced.discount}/${rcSynced.tax}/${rcSynced.totalCost}`);

    // Manuelle Buchung (ohne Checkout-Snapshot) eines steuerfreien Kunden: MwSt. 0.
    const tfOrder = await makeOrder(tfCust, { listPrice: 49.9, discount: 2.5 });
    const tfBooking = await BookingService.create({ customerId: tfCust._id, orderIds: [tfOrder._id], createShippingLabel: false });
    check(near(tfBooking.tax, 0) && near(tfBooking.totalCost, 47.4), 'manuelle Buchung steuerfrei: MwSt. 0, Gesamt 47,40', `${tfBooking.tax}/${tfBooking.totalCost}`);

    // Checkout-Buchung (checkoutAttemptId) eines Standardkunden mit MwSt. 0: nur melden.
    const defCust = await makeCustomer();
    const co = await makeBooking(defCust, [{ listPrice: 49.9, discount: 2.5 }], { tax: 0, checkoutAttemptId: `co-${crypto.randomBytes(4).toString('hex')}` });
    const plan2 = await planBookingTotalCorrections();
    const coReview = plan2.reviewOnly.find((entry) => entry._id === String(co.booking._id));
    check(coReview && !plan2.fixable.some((entry) => entry._id === String(co.booking._id)) && /Checkout/.test(coReview.reason), 'Skript: Checkout-Buchung MwSt. 0 -> > 0 nur gemeldet', coReview && coReview.reason);

    // Buchungsweg "Rechnung erstellen": Profil statt fester 19 %.
    const rcInvBooking = await makeBooking(rcCust, [{ listPrice: 49.9, discount: 2.5 }], { tax: 0 });
    const rcInv = await call('POST', `/api/bookings/${rcInvBooking.booking._id}/invoice`, staff, { sendImmediately: false });
    const rcI = rcInv.body?.invoice || {};
    check(rcInv.status === 201 && rcI.isReverseCharge === true && near(rcI.tax, 0) && near(rcI.total, 47.4) && /Reverse Charge/.test(rcI.reverseChargeNotice || ''), 'Buchungsrechnung Reverse Charge: MwSt. 0, Hinweis, 47,40', `${rcInv.status} ${rcI.isReverseCharge} ${rcI.tax} ${rcI.total}`);
    const tfInvBooking = await makeBooking(tfCust, [{ listPrice: 49.9, discount: 2.5 }], { tax: 0 });
    const tfInv = await call('POST', `/api/bookings/${tfInvBooking.booking._id}/invoice`, staff, { sendImmediately: false });
    const tfI = tfInv.body?.invoice || {};
    check(tfInv.status === 201 && tfI.isReverseCharge === false && near(tfI.tax, 0) && near(tfI.taxRate, 0) && near(tfI.total, 47.4), 'Buchungsrechnung steuerfrei: MwSt. 0 (kein Reverse Charge)', `${tfInv.status} ${tfI.isReverseCharge} ${tfI.taxRate} ${tfI.tax}`);
    const defInvBooking = await makeBooking(defCust, [{ listPrice: 49.9, discount: 2.5 }]);
    const defInv = await call('POST', `/api/bookings/${defInvBooking.booking._id}/invoice`, staff, { sendImmediately: false });
    check(defInv.status === 201 && defInv.body?.invoice?.isReverseCharge === false && near(defInv.body?.invoice?.tax, 7.57), 'Standardkunde unveraendert: 47,40 inkl. 7,57 MwSt.', `${defInv.body?.invoice?.tax}`);
    const rcOrderAfter = await Order.findById(rcInvBooking.orders[0]._id).lean();
    check(rcOrderAfter.taxRate === rcInvBooking.orders[0].taxRate, 'Steuer-Snapshot des Auftrags unveraendert', rcOrderAfter.taxRate);
  });

  await runSection('Review: Teilrechnung im Buchungsweg, Rest ueber "Rechnung aus Auftraegen"', async () => {
    const cust = await makeCustomer();
    const two = await makeBooking(cust, [{ listPrice: 49.9, discount: 0 }, { listPrice: 49.9, discount: 0 }]);
    const [oA, oB] = two.orders;
    const partA = await call('POST', `/api/bookings/${two.booking._id}/invoice`, staff, { sendImmediately: false, invoiceMode: 'order', orderId: String(oA._id) });
    check(partA.status === 201, 'Teilrechnung Auftrag A (Buchungsweg)', `${partA.status} ${partA.body?.error || ''}`);
    const pvB = await call('POST', '/api/admin/financial/invoices/from-repairs', admin, { repairOrderIds: [oB.orderNumber], options: { dryRun: true } });
    check(pvB.status === 200 && pvB.body?.preview?.canCreate === true && (pvB.body?.preview?.blockers || []).length === 0, 'Vorschau Auftrag B: keine falsche Buchungs-Sperre', `${pvB.status} ${JSON.stringify(pvB.body?.preview?.blockers)}`);
    const pvAB = await call('POST', '/api/admin/financial/invoices/from-repairs', admin, { repairOrderIds: [oA.orderNumber, oB.orderNumber], options: { dryRun: true } });
    check(pvAB.body?.preview?.canCreate === false, 'Vorschau A+B: A bereits berechnet -> gesperrt', JSON.stringify(pvAB.body?.preview?.blockers));
    const createB = await call('POST', '/api/admin/financial/invoices/from-repairs', admin, { repairOrderIds: [oB.orderNumber], options: {} });
    check(createB.status === 201 && near(createB.body?.invoice?.total, 49.9), 'Rechnung fuer Auftrag B erstellt', `${createB.status} ${createB.body?.error || ''}`);
    const invB = await Invoice.findById(createB.body?.invoice?._id).lean();
    check(invB && !(invB.activeBillingKeys || []).includes(`booking:${two.booking._id}`) && (invB.activeBillingKeys || []).includes(`order:${oB._id}`), 'Teilauswahl beansprucht nur den Auftrag, nicht die Buchung', JSON.stringify(invB && invB.activeBillingKeys));
    const againB = await call('POST', '/api/admin/financial/invoices/from-repairs', admin, { repairOrderIds: [oB.orderNumber], options: {} });
    check(againB.status === 409, 'Auftrag B nochmal -> 409', againB.status);

    // Gesamtrechnung einer Buchung sperrt weiterhin jede Teilauswahl.
    const whole = await makeBooking(cust, [{ listPrice: 49.9, discount: 0 }, { listPrice: 49.9, discount: 0 }]);
    const wholeInv = await call('POST', `/api/bookings/${whole.booking._id}/invoice`, staff, { sendImmediately: false });
    check(wholeInv.status === 201, 'Gesamtrechnung der Buchung', wholeInv.status);
    const pvWhole = await call('POST', '/api/admin/financial/invoices/from-repairs', admin, { repairOrderIds: [whole.orders[1].orderNumber], options: { dryRun: true } });
    check(pvWhole.body?.preview?.canCreate === false, 'nach Gesamtrechnung: Teilauswahl gesperrt', JSON.stringify(pvWhole.body?.preview?.blockers));
  });

  await runSection('Review: Sperrfrist auch bei laufender Aufforderung; Dashboard-Zaehler', async () => {
    const cust = await makeCustomer();
    const R = await makeBooking(cust);
    await call('POST', `/api/bookings/${R.booking._id}/invoice`, staff, { sendImmediately: false });
    await PaymentRequest.create({ bookingId: R.booking._id, amount: 47.4, recipientEmail: cust.email, status: 'pending', requestedAt: new Date() });
    const beforeMails = sentEmails.length;
    const res = await call('POST', `/api/admin/financial/bookings/${encodeURIComponent(R.booking.bookingNumber)}/payment-request`, admin, {});
    check(res.status === 409 && res.body?.code === 'PAYMENT_REQUEST_RECENT' && /Wird gerade gesendet/.test(res.body?.error || ''), 'laufende Aufforderung (pending) -> 409, keine zweite Mail', `${res.status} ${res.body?.error}`);
    check(sentEmails.length === beforeMails, 'keine Mail versendet', sentEmails.length - beforeMails);
    await PaymentRequest.collection.updateMany({ bookingId: R.booking._id, status: 'pending' }, { $set: { requestedAt: new Date(Date.now() - 10 * 60 * 1000) } });
    const later = await call('POST', `/api/admin/financial/bookings/${encodeURIComponent(R.booking.bookingNumber)}/payment-request`, admin, {});
    check(later.status === 200 && later.body?.status === 'accepted_by_provider', 'verwaiste pending-Aufforderung (> 5 Min.) sperrt nicht', `${later.status} ${later.body?.status}`);

    const baseline = (await call('GET', '/api/admin/financial/reports?period=month', admin)).body?.report?.paymentsInReviewCount;
    const D = await makeBooking(cust);
    await pay(D.booking, D.orders[0], 5, { status: 'pending' });
    await pay(D.booking, D.orders[0], 6, { status: 'disputed' });
    await pay(D.booking, D.orders[0], 7, { status: 'processing' });
    const stale = await pay(D.booking, D.orders[0], 8, { status: 'processing' });
    await Payment.collection.updateOne({ _id: stale._id }, { $set: { updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } });
    const after = (await call('GET', '/api/admin/financial/reports?period=month', admin)).body?.report?.paymentsInReviewCount;
    check(typeof baseline === 'number' && after - baseline === 3, 'Zahlungen in Pruefung serverseitig: pending + disputed + frische processing (abgebrochener Checkout zaehlt nicht)', `${baseline} -> ${after}`);
  });

  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  out(`\nErgebnis: ${pass} PASS, ${fail} FAIL`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch(async (error) => {
  out(`ABBRUCH: ${error.stack || error.message}`);
  try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
  process.exit(1);
});
