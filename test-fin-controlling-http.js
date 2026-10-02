/**
 * Regressionstest (01.10.2026) Controlling / Analysen (Track "fin").
 *
 * Laeuft ueber die ECHTEN Express-Router mit echter JWT-Pruefung und echter Datenbank:
 *   /api/admin/analytics (Auswertung + Einstellungen), /api/system-config.
 *
 * Abgesichert (Befund-IDs aus finance.md / parts-settings.md):
 *   FIN-1  Auftragswert netto ist NETTO (47,40 brutto -> 39,83; 15 %: 42,42 -> 35,65;
 *          manuelle Buchung ohne Steuer-Snapshot 119 -> 100,00; Reverse Charge netto = brutto).
 *          Frueher lieferte getBookingNetRevenue das Brutto als "Netto".
 *   FIN-7  drei getrennte Kennzahlen (Auftragswert / Fakturiert / Zahlungseingang);
 *          stornierte Buchung sichtbar, aber in keiner Summe; Rechnung + Storno ergibt
 *          fakturiert 0 und die Gutschrift ist nie "Rechnung Nr."; eine auf zwei Rechnungen
 *          verteilte Zahlung zaehlt einmal; Teilerstattung wird abgezogen.
 *   FIN-8/SET-2  Einstellungen accounting.* und otherCosts.paymentFeeFixedAmount werden
 *          gespeichert und NEU GELESEN zurueckgegeben (frueher still verworfen).
 *   SP-9   "0,02" als Text wird 0,02 (nicht 0 / 2); 2 (= 200 %) wird mit deutscher 400
 *          abgelehnt, der gespeicherte Wert bleibt.
 *   SET-1/SET-2  Netto der Auswertung nutzt den Steuersatz der Finanzeinstellungen;
 *          ein Speichern der Finanzeinstellungen setzt die Analyse-Einstellungen nicht zurueck.
 *   Review: stornierte Altrechnung ohne Gutschrift (vor dem Storno-Ablauf) zaehlt nicht als
 *          fakturiert (Zeile und Zeitraum).
 *   Rollen: Kunde 403, Mitarbeiter 403, ohne Anmeldung 401.
 *
 * Keine E-Mails, keine externen Hosts (E-Mail/Benachrichtigungen gemockt).
 *
 * Aufruf (nur Wegwerf-Datenbank):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_fin_controlling node test-fin-controlling-http.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_fin_controlling';

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
const looksGerman = (text) => /[äöüß]|Bitte|erlaubt|nicht|Einstellungen/i.test(String(text || ''))
  && !/validation failed|Cast to|Path `/i.test(String(text || ''));

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

  // MOCKS: niemals echte E-Mails / Benachrichtigungen.
  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.sendTemplateEmail = async () => ({ success: true, messageId: 'test' });
  EmailService.sendTriggerEmail = async () => ({ success: true, messageId: 'test' });
  EmailService.buildSystemUrl = async (p) => `https://test.invalid${p}`;
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });

  const adminAnalyticsRoutes = require(path.join(SERVER_DIR, 'routes/adminAnalyticsRoutes'));
  const systemConfigRoutes = require(path.join(SERVER_DIR, 'routes/systemConfigRoutes'));
  const BookingService = require(path.join(SERVER_DIR, 'services/bookingService'));
  const FinancialService = require(path.join(SERVER_DIR, 'services/financialService'));

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/admin/analytics', adminAnalyticsRoutes);
  app.use('/api/system-config', systemConfigRoutes);
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
  const CustomerGroup = mongoose.model('CustomerGroup');
  await Promise.all([Payment.init(), PaymentAllocation.init(), Invoice.init()]);

  const admin = await User.create({ name: 'Admin Fin', email: 'fin-admin@test.invalid', role: 'admin' });
  const staff = await User.create({ name: 'Staff Fin', email: 'fin-staff@test.invalid', role: 'staff' });
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
    return User.create({ name: `Kunde ${seq}`, email: `fin-kunde${seq}@test.invalid`, role: 'customer', customerNumber: `K-FIN-${seq}`, ...extra });
  };
  const makeOrder = async (customer, { listPrice, discount = 0, status = 'completed' }) => {
    seq += 1;
    return Order.create({
      customerId: customer._id,
      orderNumber: `ORD-FIN-${String(seq).padStart(3, '0')}`,
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
  const makeBooking = async (customer, orderSpecs, bookingExtra = {}) => {
    const orders = [];
    for (const spec of orderSpecs) orders.push(await makeOrder(customer, spec));
    const total = Math.round(orders.reduce((sum, order) => sum + order.totalCost, 0) * 100) / 100;
    const booking = await Booking.create({
      customerId: customer._id,
      orderIds: orders.map((order) => order._id),
      items: orders.map((order) => ({ type: 'repair', orderId: order._id, orderNumber: order.orderNumber, cost: order.totalCost })),
      totalCost: total,
      status: 'processing',
      ...bookingExtra,
    });
    await Order.updateMany({ _id: { $in: orders.map((order) => order._id) } }, { $set: { bookingId: booking._id } });
    return { booking, orders };
  };

  // --- Fixtures ---------------------------------------------------------------------
  // A: 5 %-Kunde, Checkout-Snapshot (subtotal = BRUTTO vor Rabatt 49,90!), Rechnung, Zahlung.
  const custA = await makeCustomer();
  const A = await makeBooking(custA, [{ listPrice: 49.9, discount: 2.5 }], { subtotal: 49.9, discount: 2.5, tax: 7.57 });
  const invA = await BookingService.createInvoice(String(A.booking._id), {});
  await Payment.create({ bookingId: A.booking._id, orderId: A.orders[0]._id, customerId: custA._id, amount: 47.4, paymentMethod: 'paypal', status: 'completed', source: 'checkout', paymentDate: new Date(), processedAt: new Date() });

  // B: 15 %-Kunde, Rechnung und vollstaendiges Storno (Gutschrift INV-CN-...).
  const custB = await makeCustomer();
  const B = await makeBooking(custB, [{ listPrice: 49.9, discount: 7.48 }], { subtotal: 49.9, discount: 7.48, tax: 6.77 });
  const invB = await BookingService.createInvoice(String(B.booking._id), {});
  const storno = await FinancialService.cancelInvoice(String(invB._id), { reason: 'Test-Storno' });

  // C: manuelle Buchung OHNE Steuer-Snapshot (tax 0), 119 € brutto; Zahlung 10 €, davon 4 € erstattet.
  const custC = await makeCustomer();
  const C = await makeBooking(custC, [{ listPrice: 119 }], { subtotal: 119, discount: 0, tax: 0 });
  await Payment.create({ bookingId: C.booking._id, orderId: C.orders[0]._id, customerId: custC._id, amount: 10, refundAmount: 4, refunds: [{ amount: 4, status: 'completed', reason: 'Test' }], paymentMethod: 'bank_transfer', status: 'completed', source: 'manual', paymentDate: new Date(), processedAt: new Date() });

  // D: Kundengruppe Reverse Charge.
  const rcGroup = await CustomerGroup.create({ key: 'fin-rc-test', name: 'Reverse Charge Test', financeProfile: { taxMode: 'reverse_charge' } });
  const custD = await makeCustomer({ primaryCustomerGroupId: rcGroup._id });
  const D = await makeBooking(custD, [{ listPrice: 49.9, discount: 2.5 }]);

  // E: stornierte Buchung (stornierter Auftrag) - sichtbar, aber in keiner Summe.
  const custE = await makeCustomer();
  const E = await makeBooking(custE, [{ listPrice: 100, status: 'cancelled' }], { status: 'cancelled' });

  // F: zwei Auftraege a 50 €, EINE Vorauszahlung 100 €, danach zwei Teilrechnungen.
  const custF = await makeCustomer();
  const F = await makeBooking(custF, [{ listPrice: 50 }, { listPrice: 50 }]);
  await Payment.create({ bookingId: F.booking._id, orderId: F.orders[0]._id, customerId: custF._id, amount: 100, paymentMethod: 'paypal', status: 'completed', source: 'checkout', paymentDate: new Date(), processedAt: new Date() });
  await BookingService.createInvoice(String(F.booking._id), { invoiceMode: 'order', orderId: String(F.orders[0]._id) });
  await BookingService.createInvoice(String(F.booking._id), { invoiceMode: 'order', orderId: String(F.orders[1]._id) });

  let report = null;
  const rowOf = (booking) => (report?.rows || []).find((row) => String(row.id) === String(booking._id));

  await runSection('Rollen', async () => {
    const guest = await call('GET', '/api/admin/analytics/profitability', null);
    check(guest.status === 401, 'ohne Anmeldung -> 401', guest.status);
    const customer = await call('GET', '/api/admin/analytics/profitability', custA);
    check(customer.status === 403, 'Kunde -> 403', customer.status);
    const staffRes = await call('GET', '/api/admin/analytics/profitability/settings', staff);
    check(staffRes.status === 403, 'Mitarbeiter -> 403 (nur Admin)', staffRes.status);
    const staffPut = await call('PUT', '/api/admin/analytics/profitability/settings', staff, { labor: { defaultHourlyRate: 1 } });
    check(staffPut.status === 403, 'Mitarbeiter darf Einstellungen nicht speichern -> 403', staffPut.status);
  });

  await runSection('FIN-1 Auftragswert netto (statt Brutto)', async () => {
    const res = await call('GET', '/api/admin/analytics/profitability?limit=200', admin);
    check(res.status === 200, 'GET /profitability -> 200', res.status);
    report = res.body;
    const a = rowOf(A.booking);
    check(a && near(a.orderValueGross, 47.4) && near(a.orderValueNet, 39.83), '5 %: brutto 47,40 / netto 39,83', a && `${a.orderValueGross}/${a.orderValueNet}`);
    check(a && near(a.netAmount, 39.83) && near(a.netRevenue, 39.83), '5 %: netAmount/netRevenue = 39,83 (frueher 47,40)', a && `${a.netAmount}/${a.netRevenue}`);
    const b = rowOf(B.booking);
    check(b && near(b.orderValueGross, 42.42) && near(b.orderValueNet, 35.65), '15 %: brutto 42,42 / netto 35,65', b && `${b.orderValueGross}/${b.orderValueNet}`);
    const c = rowOf(C.booking);
    check(c && near(c.orderValueNet, 100), 'manuelle Buchung (tax 0 gespeichert): 119 -> netto 100,00', c && c.orderValueNet);
    const d = rowOf(D.booking);
    check(d && d.taxExempt === true && near(d.orderValueNet, 47.4), 'Reverse Charge: netto = brutto 47,40', d && `${d.taxExempt} ${d.orderValueNet}`);
    const orderRowA = a?.orders?.[0];
    check(orderRowA && near(orderRowA.orderValueNet, 39.83) && near(orderRowA.netAmount, 39.83), 'Auftragszeile netto 39,83', orderRowA && orderRowA.netAmount);
    check(near(report?.calculationMeta?.vatRate, 0.19) && report?.calculationMeta?.vatRateSource === 'financialSettings.defaults.taxRate', 'MwSt.-Satz aus den Finanzeinstellungen', `${report?.calculationMeta?.vatRate} ${report?.calculationMeta?.vatRateSource}`);
  });

  await runSection('FIN-7 drei Kennzahlen, Storno, Gutschrift, Split-Zahlung', async () => {
    const a = rowOf(A.booking);
    check(a && near(a.invoicedNet, 39.83) && near(a.invoicedGross, 47.4) && a.invoiceNumber === invA.invoiceNumber, 'A fakturiert netto 39,83 / brutto 47,40 mit Rechnungsnummer', a && `${a.invoicedNet}/${a.invoicedGross} ${a.invoiceNumber}`);
    check(a && near(a.collectedGross, 47.4), 'A Zahlungseingang 47,40', a && a.collectedGross);
    const b = rowOf(B.booking);
    check(Boolean(storno?.creditNote?.invoiceNumber), 'Storno erzeugt Gutschrift', storno?.creditNote?.invoiceNumber);
    check(b && near(b.invoicedNet, 0) && near(b.invoicedGross, 0), 'B Rechnung + Storno -> fakturiert 0', b && `${b.invoicedNet}/${b.invoicedGross}`);
    check(b && b.invoiceNumber !== storno?.creditNote?.invoiceNumber && !String(b.invoiceNumber).includes('CN'), 'Gutschrift ist nie "Rechnung Nr."', b && b.invoiceNumber);
    check(b && b.hasInvoice === false && b.invoiceDate === null, 'ohne aktive Rechnung kein Rechnungsdatum (kein Buchungsdatum als Ersatz)', b && `${b.hasInvoice} ${b.invoiceDate}`);
    const c = rowOf(C.booking);
    check(c && near(c.collectedGross, 6), 'C Teilerstattung abgezogen: 10 - 4 = 6', c && c.collectedGross);
    const f = rowOf(F.booking);
    check(f && near(f.collectedGross, 100), 'F 100 € auf zwei Rechnungen verteilt -> einmal 100', f && f.collectedGross);
    check(f && near(f.invoicedGross, 100) && near(f.invoicedNet, 84.04), 'F zwei Teilrechnungen: brutto 100 / netto 84,04', f && `${f.invoicedGross}/${f.invoicedNet}`);
    const allocations = await PaymentAllocation.find({ invoiceId: { $in: (await Invoice.find({ bookingId: F.booking._id }).select('_id').lean()).map((i) => i._id) } }).lean();
    check(allocations.length === 2 && near(allocations.reduce((s, x) => s + x.allocatedAmount, 0), 100), 'F Zahlung real auf 2 Rechnungen zugeordnet', allocations.map((x) => x.allocatedAmount).join('+'));
    const e = rowOf(E.booking);
    check(e && e.excludedFromTotals === true, 'E stornierte Buchung bleibt sichtbar, markiert', e && e.excludedFromTotals);
    check(report?.summary?.excludedBookings === 1, 'summary.excludedBookings = 1', report?.summary?.excludedBookings);
    const fig = report?.periodFigures || {};
    check(near(fig.orderValueGross, 356.22) && near(fig.orderValueNet, 306.92), 'Zeitraum Auftragswert brutto 356,22 / netto 306,92 = 39,83 + 35,65 + 100 + 47,40 + 2 x 42,02 (je Auftrag gerundet, ohne E)', `${fig.orderValueGross}/${fig.orderValueNet}`);
    check(near(fig.invoicedGross, 147.4) && near(fig.invoicedNet, 123.87), 'Zeitraum fakturiert brutto 147,40 / netto 123,87 (B storniert)', `${fig.invoicedGross}/${fig.invoicedNet}`);
    check(fig.creditNoteCount === 1 && fig.invoiceCount === 4, 'Belegzaehler: 4 Rechnungen, 1 Gutschrift', `${fig.invoiceCount}/${fig.creditNoteCount}`);
    check(near(fig.collectedGross, 153.4) && fig.paymentCount === 3, 'Zeitraum Zahlungseingang 153,40 (47,40 + 6 + 100) aus 3 Zahlungen', `${fig.collectedGross}/${fig.paymentCount}`);
    check(typeof report?.calculationMeta?.figures?.invoicedNet === 'string' && /Gutschrift/.test(report.calculationMeta.figures.invoicedNet), 'Kennzahl-Definitionen werden mitgeliefert (deutsch)', report?.calculationMeta?.figures?.invoicedNet?.slice(0, 40));
    check(a && a.isEstimate === true, 'Kosten/DB als Schaetzung gekennzeichnet', a && a.isEstimate);
    // Zeitraumfilter: Rechnungen/Zahlungen von morgen an -> 0.
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const future = await call('GET', `/api/admin/analytics/profitability?startDate=${tomorrow}`, admin);
    check(future.status === 200 && near(future.body?.periodFigures?.invoicedGross, 0) && near(future.body?.periodFigures?.collectedGross, 0), 'Zeitraum ab morgen: fakturiert 0 / Zahlungseingang 0', future.body?.periodFigures && `${future.body.periodFigures.invoicedGross}/${future.body.periodFigures.collectedGross}`);
  });

  await runSection('FIN-8/SET-2/SP-9 Einstellungen speichern und neu lesen', async () => {
    const put = await call('PUT', '/api/admin/analytics/profitability/settings', admin, {
      accounting: { targetGrossMarginRate: 0.25, defaultProjectionWorkdays: 20, vatRate: 0.07 },
      otherCosts: { paymentFeeFixedAmount: 0.35, packagingRate: '0,02' },
      labor: { defaultHourlyRate: 110 },
    });
    check(put.status === 200, 'PUT Einstellungen -> 200', `${put.status} ${put.body?.error || ''}`);
    check(put.body?.settings?.otherCosts?.packagingRate === 0.02, 'Antwort: "0,02" -> 0,02 (nicht 0 oder 2)', put.body?.settings?.otherCosts?.packagingRate);
    const get = await call('GET', '/api/admin/analytics/profitability/settings', admin);
    const s = get.body?.settings || {};
    check(s.accounting?.targetGrossMarginRate === 0.25, 'neu gelesen: Ziel-Deckungsbeitrag 0,25', s.accounting?.targetGrossMarginRate);
    check(s.accounting?.defaultProjectionWorkdays === 20, 'neu gelesen: Prognose-Arbeitstage 20', s.accounting?.defaultProjectionWorkdays);
    check(s.otherCosts?.paymentFeeFixedAmount === 0.35, 'neu gelesen: feste Zahlungsgebuehr 0,35', s.otherCosts?.paymentFeeFixedAmount);
    check(s.otherCosts?.packagingRate === 0.02 && s.labor?.defaultHourlyRate === 110, 'neu gelesen: Verpackungsquote 0,02 / Stundensatz 110', `${s.otherCosts?.packagingRate} ${s.labor?.defaultHourlyRate}`);
    check(near(s.accounting?.vatRate, 0.19), 'MwSt. nicht separat speicherbar - kommt aus Finanzeinstellungen (0,19)', s.accounting?.vatRate);
    const raw = await mongoose.connection.db.collection('systemconfigurations').findOne({});
    check(raw?.profitabilitySettings?.accounting?.defaultProjectionWorkdays === 20 && raw?.profitabilitySettings?.otherCosts?.paymentFeeFixedAmount === 0.35, 'Rohdokument in MongoDB enthaelt accounting + paymentFeeFixedAmount', JSON.stringify(raw?.profitabilitySettings?.accounting));
    const rep = await call('GET', '/api/admin/analytics/profitability', admin);
    check(rep.body?.calculationMeta?.projectionWorkdays === 20, 'Auswertung nutzt Prognose-Arbeitstage 20', rep.body?.calculationMeta?.projectionWorkdays);

    const bad = await call('PUT', '/api/admin/analytics/profitability/settings', admin, { otherCosts: { packagingRate: 2 } });
    check(bad.status === 400 && looksGerman(bad.body?.error) && /Verpackungsquote/.test(bad.body?.error || ''), 'Verpackungsquote 2 (200 %) -> 400 deutsch mit Feldname', `${bad.status} ${bad.body?.error}`);
    const bad2 = await call('PUT', '/api/admin/analytics/profitability/settings', admin, { labor: { defaultHourlyRate: 'abc' } });
    check(bad2.status === 400 && looksGerman(bad2.body?.error), 'Stundensatz "abc" -> 400 deutsch', `${bad2.status} ${bad2.body?.error}`);
    const after = await call('GET', '/api/admin/analytics/profitability/settings', admin);
    check(after.body?.settings?.otherCosts?.packagingRate === 0.02 && after.body?.settings?.labor?.defaultHourlyRate === 110, 'nach Ablehnung: gespeicherte Werte unveraendert', `${after.body?.settings?.otherCosts?.packagingRate} ${after.body?.settings?.labor?.defaultHourlyRate}`);
  });

  await runSection('SET-1/SET-2 Steuersatz der Finanzeinstellungen wirkt auf Netto; kein Zuruecksetzen', async () => {
    const put = await call('PUT', '/api/system-config', admin, { financialSettings: { defaults: { taxRate: 7, currency: 'EUR' } } });
    check(put.status === 200, 'PUT /api/system-config {financialSettings} -> 200', `${put.status} ${put.body?.error || ''}`);
    const settings = await call('GET', '/api/admin/analytics/profitability/settings', admin);
    check(near(settings.body?.settings?.accounting?.vatRate, 0.07), 'Analyse-MwSt. folgt den Finanzeinstellungen: 0,07', settings.body?.settings?.accounting?.vatRate);
    check(settings.body?.settings?.labor?.defaultHourlyRate === 110 && settings.body?.settings?.accounting?.defaultProjectionWorkdays === 20, 'Analyse-Einstellungen nach Finanz-Speichern unveraendert', `${settings.body?.settings?.labor?.defaultHourlyRate} ${settings.body?.settings?.accounting?.defaultProjectionWorkdays}`);
    const rep = await call('GET', '/api/admin/analytics/profitability', admin);
    report = rep.body;
    const c = rowOf(C.booking);
    check(c && near(c.orderValueNet, 111.21), 'manuelle Buchung mit 7 %: 119 / 1,07 = 111,21', c && c.orderValueNet);
    await call('PUT', '/api/system-config', admin, { financialSettings: { defaults: { taxRate: 19 } } });
  });

  await runSection('Review: stornierte Altrechnung ohne Gutschrift zaehlt nicht als fakturiert', async () => {
    const before = (await call('GET', '/api/admin/analytics/profitability?limit=200', admin)).body?.periodFigures || {};
    const custG = await makeCustomer();
    const G = await makeBooking(custG, [{ listPrice: 49.9, discount: 2.5 }], { subtotal: 49.9, discount: 2.5, tax: 7.57 });
    const invG = await BookingService.createInvoice(String(G.booking._id), {});
    // Altbestand vor dem Storno-Ablauf: Status 'cancelled', keine cancellation.kind, keine Gutschrift.
    await Invoice.collection.updateOne({ _id: invG._id }, { $set: { status: 'cancelled' }, $unset: { cancellation: '', activeBillingKeys: '' } });
    const res = await call('GET', '/api/admin/analytics/profitability?limit=200', admin);
    report = res.body;
    const g = rowOf(G.booking);
    check(g && near(g.invoicedGross, 0) && near(g.invoicedNet, 0), 'Zeile: Alt-Storno ohne Gutschrift -> fakturiert 0 (frueher 47,40)', g && `${g.invoicedGross}/${g.invoicedNet}`);
    const fig = report?.periodFigures || {};
    check(near(fig.invoicedGross, before.invoicedGross) && fig.invoiceCount === before.invoiceCount, 'Zeitraum fakturiert unveraendert durch Alt-Storno', `${before.invoicedGross} -> ${fig.invoicedGross} / ${before.invoiceCount} -> ${fig.invoiceCount}`);
    const b = rowOf(B.booking);
    check(b && near(b.invoicedGross, 0), 'Storno mit Gutschrift (B) weiterhin 0', b && b.invoicedGross);
    const a = rowOf(A.booking);
    check(a && near(a.invoicedGross, 47.4), 'aktive Rechnung (A) weiterhin 47,40', a && a.invoicedGross);
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
