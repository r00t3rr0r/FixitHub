/**
 * Regressionstest (Track sec, Wave 3): Verteilung des Warenkorb-Rabatts auf mehrere Geraete
 * einer Buchung (echter Warenkorb + echter Checkout + echte Buchungs-/Rechnungsrouten).
 *
 * Ausgangsfall (E2E des Orchestrators): 5-%-Partner bucht iPhone 15 Diagnose 49,90 + iPad
 * Displaytausch 129,90. Warenkorb-Rabatt 8,99 (5 % von 179,80); Auftraege 2,49 / 6,50 ->
 * 47,41 und 123,40 (Summe 170,81 = Buchungsbetrag).
 *
 * Geprueft werden - OHNE die Rundungs-/Verteilungsregel zu aendern - die Invarianten:
 *   I1 Buchungsbetrag == Warenkorb-Gesamt (Kundenansicht vor dem Checkout)
 *   I2 Summe der Auftragsbetraege == Buchungsbetrag; Summe der Auftragsrabatte == Warenkorb-Rabatt
 *   I3 je Auftrag: Positionen - Rabatt == gespeicherter Gesamtbetrag (brutto)
 *   I4 je Auftrag: Netto + MwSt. == Brutto
 *   I5 Rechnung je Auftrag bzw. je Buchung (echte Staff-Route) == gespeicherte Betraege,
 *      Rabatt genau einmal (Rechnungsrabatt == Auftragsrabatt, Positionen brutto ungekuerzt)
 *   I6 Vorschau der Buchungsrechnung (Kundin) == Buchungsbetrag
 *   I7 Ein-Geraet-Buchung: 5 % von 49,90 -> 2,50 -> 47,40 (CalculationHelper.percentOf)
 *   I8 Der Warenkorb-Betrag eines Geraets ist KEINE Rabattgrundlage, die der Kunde setzen
 *      kann: ein manipulierter totalCost im Warenkorb aendert weder den Rabatt noch die
 *      Auftragsbetraege (Katalogpreis zaehlt).
 *   I9 Doppelte Leistungs-IDs (x2, x20) zaehlen einmal - in Warenkorb, Rabattbasis und
 *      Auftrag gleich; nie ein Auftrag mit 0,00 € (Review Wave 3, P3/P5).
 *   I10 Zusatzleistungen: Preis aus dem Katalog (AddOnService), nicht vom Client (0, 0,01,
 *      negativ); unbekannte Zusatzleistung / Leistung -> 400, Warenkorb unveraendert;
 *      Bestandswarenkorb mit Client-Zusatzleistungspreis wird beim Lesen auf den
 *      Katalogpreis gebracht (Review Wave 3, P1/P2/P6).
 * Faelle: 5 % und 15 %, 2 und 3 Geraete, Halbcent-Anteile.
 *
 * MOCKS: E-Mail und Benachrichtigungen zeichnen nur auf; DHL im Dummy-Modus (kein externer
 * Aufruf); keine echten Zahlungen. Datei-Logs werden umgeleitet.
 *
 * Aufruf (nur WEGWERF-Datenbank):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_sec_alloc node test-sec-booking-discount-allocation.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, 'server');
const LOG_DIR = path.join(SERVER_DIR, 'logs');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_sec_alloc';

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

// ---- Keine Dateien im Repository: Logger-Schreibzugriffe auf server/logs umleiten ----
const LOG_REDIRECT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-alloc-logs-'));
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
process.env.EMAIL_TEST_TRANSPORT = 'stream';

const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

let pass = 0;
let fail = 0;
const check = (condition, message, actual) => {
  if (condition) { pass += 1; console.log(`  PASS ${message} :: ${actual}`); }
  else { fail += 1; console.log(`  FAIL ${message} :: ${actual}`); }
};
const r2 = (value) => Math.round(Number(value || 0) * 100) / 100;
const eq = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;
const fmt = (value) => Number(value || 0).toFixed(2);

async function main() {
  if (isUnsafeTestUri(URI)) throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  fs.readdirSync(path.join(SERVER_DIR, 'models')).filter((f) => f.endsWith('.js')).forEach((f) => {
    try { require(path.join(SERVER_DIR, 'models', f)); } catch (error) { /* optional */ }
  });
  await mongoose.model('Booking').syncIndexes();

  // ---- MOCKS ----
  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  ['sendOrderConfirmationEmail', 'sendTriggerEmail', 'sendTemplateEmail', 'sendEmail', 'sendInvoiceEmail']
    .forEach((name) => { EmailService[name] = async () => ({ success: true, mocked: true }); });
  EmailService.buildSystemUrl = async (p) => `http://test.invalid${p}`;
  EmailService.resolveDeviceModelImageUrl = async () => '';
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });
  const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));
  DHLService.createShipment = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };

  const User = mongoose.model('User');
  const Service = mongoose.model('Service');
  const Order = mongoose.model('Order');
  const Booking = mongoose.model('Booking');
  const CustomerGroup = mongoose.model('CustomerGroup');

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/cart', require(path.join(SERVER_DIR, 'routes/cartRoutes')));
  app.use('/api/checkout', require(path.join(SERVER_DIR, 'routes/checkoutRoutes')));
  app.use('/api/bookings', require(path.join(SERVER_DIR, 'routes/bookingRoutes')));
  app.use('/api/orders', require(path.join(SERVER_DIR, 'routes/orderRoutes')));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '30m' });
  const call = async (method, url, user, body) => {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await response.json(); } catch (error) { json = null; }
    return { status: response.status, body: json };
  };

  const staff = await User.create({ name: 'Staff Alloc', email: 'alloc-staff@test.invalid', role: 'staff', isActive: true });
  const groups = {};
  for (const percent of [5, 15]) {
    groups[percent] = await CustomerGroup.create({ key: `alloc-${percent}`, name: `Partner ${percent} %`, financeProfile: { discountPercent: percent } });
  }
  let customerSeq = 0;
  const makeCustomer = async (percent) => {
    customerSeq += 1;
    return User.create({
      name: `Partner ${customerSeq}`, firstName: 'Partner', lastName: String(customerSeq),
      email: `alloc-partner-${customerSeq}@test.invalid`, role: 'customer', isActive: true,
      primaryCustomerGroupId: percent ? groups[percent]._id : undefined,
      invoiceAddress: { street: 'Partnerweg 5', city: 'Berlin', zipCode: '10115', country: 'DE' },
    });
  };

  const svc = async (name, model, deviceType, price) => Service.create({
    category: 'display', deviceTypes: [deviceType], manufacturerPrecise: 'Apple', modelPrecise: model,
    name, price, estimatedTime: '60',
  });
  const diag = await svc('Diagnose', 'iPhone 15', 'Smartphone', 49.9);
  const ipad = await svc('Displaytausch', 'iPad Air', 'Tablet', 129.9);
  const akku = await svc('Akkutausch', 'iPhone 14', 'Smartphone', 79.9);
  const cheap = await svc('Kameraglas', 'iPhone 13', 'Smartphone', 19.9);
  const AddOnService = mongoose.model('AddOnService');
  await AddOnService.create({ name: 'Expressbearbeitung', description: 'Bevorzugte Bearbeitung', price: 20, estimatedTime: '0', category: 'service', isActive: true });
  await AddOnService.create({ name: 'Displayschutzfolie', description: 'Folie', price: 9.99, estimatedTime: '5', category: 'zubehoer', isActive: true });
  await AddOnService.create({ name: 'Altes Extra', description: 'deaktiviert', price: 5, estimatedTime: '5', category: 'service', isActive: false });

  const device = (service, model, deviceType, overrideTotal) => ({
    deviceType, deviceBrand: 'Apple', deviceModel: model, services: [String(service._id)], serviceNames: [service.name],
    totalCost: overrideTotal !== undefined ? overrideTotal : service.price, errorDescription: 'Test',
  });

  // Ein kompletter Durchlauf: Warenkorb per Route fuellen, Kundensicht lesen, Checkout.
  let attempt = 0;
  const book = async (customer, devices, { rawLegacyCart = false } = {}) => {
    if (rawLegacyCart) {
      // Bestandswarenkorb (vor dem Fix gespeichert): direkt in die Collection, ohne pre-save.
      await mongoose.connection.db.collection('carts').insertOne({
        userId: customer._id, items: [], isActive: true, discount: 0,
        repairOrders: devices.map((d) => ({ ...d, _id: new mongoose.Types.ObjectId(), services: d.services.map((id) => new mongoose.Types.ObjectId(id)), addOns: d.addOns || [], addedAt: new Date() })),
        subtotal: devices.reduce((sum, d) => sum + d.totalCost, 0), total: devices.reduce((sum, d) => sum + d.totalCost, 0),
        createdAt: new Date(), updatedAt: new Date(),
      });
    }
    for (const d of (rawLegacyCart ? [] : devices)) {
      const added = await call('POST', '/api/cart/add-repair-order', customer, d);
      if (added.status !== 200) throw new Error(`Warenkorb: ${added.status} ${JSON.stringify(added.body)}`);
    }
    const cartView = await call('GET', '/api/cart', customer);
    attempt += 1;
    const done = await call('POST', '/api/checkout/complete', customer, {
      paymentMethod: 'card', paymentData: {}, checkoutAttemptId: `co_sec_alloc_${attempt}_${Date.now()}`,
    });
    if (done.status !== 200 || !done.body?.bookingId) throw new Error(`Checkout: ${done.status} ${JSON.stringify(done.body)?.slice(0, 300)}`);
    const booking = await Booking.findById(done.body.bookingId).setOptions({ skipAutoPopulate: true }).lean();
    const orders = await Order.find({ _id: { $in: booking.orderIds } }).sort({ createdAt: 1, _id: 1 }).lean();
    return { cart: cartView.body?.cart || cartView.body, booking, orders };
  };

  const lineSum = (order) => r2((order.services || []).reduce((s, l) => s + Number(l.price || 0), 0)
    + (order.addOns || []).reduce((s, l) => s + Number(l.price || 0), 0));

  const verifyInvariants = (label, { cart, booking, orders }, expected = {}) => {
    const cartTotal = Number(cart?.total);
    const cartDiscount = Number(cart?.discount);
    check(eq(booking.totalCost, cartTotal), `${label} I1 Buchungsbetrag == Warenkorb-Gesamt`, `${fmt(booking.totalCost)} vs ${fmt(cartTotal)}`);
    const orderSum = r2(orders.reduce((s, o) => s + Number(o.totalCost || 0), 0));
    const discountSum = r2(orders.reduce((s, o) => s + Number(o.discount || 0), 0));
    check(eq(orderSum, booking.totalCost), `${label} I2 Summe Auftraege == Buchungsbetrag`, `${orders.map((o) => fmt(o.totalCost)).join(' + ')} = ${fmt(orderSum)} vs ${fmt(booking.totalCost)}`);
    check(eq(discountSum, cartDiscount) && eq(booking.discount, cartDiscount), `${label} I2 Summe Auftragsrabatte == Warenkorb-Rabatt == Buchungsrabatt`,
      `${orders.map((o) => fmt(o.discount)).join(' + ')} = ${fmt(discountSum)} vs Warenkorb ${fmt(cartDiscount)} / Buchung ${fmt(booking.discount)}`);
    orders.forEach((o, i) => {
      check(eq(lineSum(o) - Number(o.discount || 0), o.totalCost), `${label} I3 Auftrag ${i + 1}: Positionen - Rabatt == Gesamt`,
        `${fmt(lineSum(o))} - ${fmt(o.discount)} = ${fmt(o.totalCost)}`);
      check(eq(Number(o.netAmount) + Number(o.taxAmount), o.totalCost) && Number(o.netAmount) > 0,
        `${label} I4 Auftrag ${i + 1}: Netto + MwSt. == Brutto`, `${fmt(o.netAmount)} + ${fmt(o.taxAmount)} = ${fmt(o.totalCost)}`);
    });
    if (expected.discounts) {
      check(orders.map((o) => fmt(o.discount)).join('|') === expected.discounts.map(fmt).join('|'),
        `${label} Verteilung wie dokumentiert`, `${orders.map((o) => fmt(o.discount)).join(' / ')} (erwartet ${expected.discounts.map(fmt).join(' / ')})`);
    }
    if (expected.cartDiscount !== undefined) {
      check(eq(cartDiscount, expected.cartDiscount), `${label} Warenkorb-Rabatt (percentOf)`, `${fmt(cartDiscount)} (erwartet ${fmt(expected.cartDiscount)})`);
    }
  };

  // Rechnungen sind erst fuer abgeschlossene Auftraege moeglich: nur der Status wird gesetzt
  // (keine Betraege), danach wird ueber die echte Staff-Route fakturiert.
  const completeOrders = async (orders) => Order.updateMany({ _id: { $in: orders.map((o) => o._id) } }, { $set: { status: 'completed' } });

  const verifyOrderInvoices = async (label, { booking, orders }) => {
    await completeOrders(orders);
    for (let i = 0; i < orders.length; i += 1) {
      const o = orders[i];
      const res = await call('POST', `/api/bookings/${booking._id}/invoice`, staff, { invoiceMode: 'order', orderId: String(o._id), sendImmediately: false });
      const inv = res.body?.invoice;
      const itemsGross = r2((inv?.items || []).reduce((s, it) => s + Number(it.total || 0), 0));
      check(res.status === 201 && eq(inv?.total, o.totalCost) && eq(inv?.discount, o.discount) && eq(itemsGross - Number(inv?.discount || 0), inv?.total),
        `${label} I5 Rechnung Auftrag ${i + 1} == gespeicherter Betrag, Rabatt einmal`,
        `${res.status} Rechnung ${fmt(inv?.total)} (Positionen ${fmt(itemsGross)} - Rabatt ${fmt(inv?.discount)}) vs Auftrag ${fmt(o.totalCost)} ${res.body?.error || ''}`);
      check(inv && eq(Number(inv.subtotal ?? inv.netAmount) + Number(inv.tax ?? inv.taxAmount), inv.total),
        `${label} I5 Rechnung Auftrag ${i + 1}: Netto + MwSt. == Brutto`, `${fmt(inv?.subtotal ?? inv?.netAmount)} + ${fmt(inv?.tax ?? inv?.taxAmount)} = ${fmt(inv?.total)}`);
      const after = await Order.findById(o._id).lean();
      check(eq(after.totalCost, o.totalCost) && eq(after.discount, o.discount), `${label} Auftrag ${i + 1} durch Rechnung unveraendert`, `${fmt(after.totalCost)} / ${fmt(after.discount)}`);
    }
  };

  const verifyBookingInvoice = async (label, { booking, orders }, owner) => {
    await completeOrders(orders);
    const preview = await call('GET', `/api/bookings/${booking._id}/invoice/preview?invoiceMode=booking`, owner);
    const pv = preview.body?.invoicePreview;
    check(preview.status === 200 && eq(pv?.total ?? pv?.totalAmount, booking.totalCost),
      `${label} I6 Vorschau Buchungsrechnung (Kundin) == Buchungsbetrag`, `${preview.status} ${fmt(pv?.total ?? pv?.totalAmount)} vs ${fmt(booking.totalCost)} ${preview.body?.error || ''}`);
    const res = await call('POST', `/api/bookings/${booking._id}/invoice`, staff, { invoiceMode: 'booking', sendImmediately: false });
    const inv = res.body?.invoice;
    const itemsGross = r2((inv?.items || []).reduce((s, it) => s + Number(it.total || 0), 0));
    const orderDiscounts = r2(orders.reduce((s, o) => s + Number(o.discount || 0), 0));
    check(res.status === 201 && eq(inv?.total, booking.totalCost) && eq(inv?.discount, orderDiscounts) && eq(itemsGross - Number(inv?.discount || 0), inv?.total),
      `${label} I5 Buchungsrechnung == Buchungsbetrag, Rabatt einmal`,
      `${res.status} ${fmt(inv?.total)} (Positionen ${fmt(itemsGross)} - Rabatt ${fmt(inv?.discount)}) vs ${fmt(booking.totalCost)} ${res.body?.error || ''}`);
    check(inv && eq(Number(inv.subtotal ?? inv.netAmount) + Number(inv.tax ?? inv.taxAmount), inv.total),
      `${label} I5 Buchungsrechnung: Netto + MwSt. == Brutto`, `${fmt(inv?.subtotal ?? inv?.netAmount)} + ${fmt(inv?.tax ?? inv?.taxAmount)} = ${fmt(inv?.total)}`);
  };

  try {
    console.log('\n[1] 5 %: iPhone Diagnose 49,90 + iPad Displaytausch 129,90 (Orchestrator-E2E)');
    const c1 = await makeCustomer(5);
    const b1 = await book(c1, [device(diag, 'iPhone 15', 'Smartphone'), device(ipad, 'iPad Air', 'Tablet')]);
    verifyInvariants('[1]', b1, { cartDiscount: 8.99, discounts: [2.49, 6.5] });
    check(b1.orders.map((o) => fmt(o.totalCost)).join('|') === '47.41|123.40', '[1] Auftraege 47,41 / 123,40 (dokumentierter Stand)', b1.orders.map((o) => fmt(o.totalCost)).join(' / '));
    await verifyOrderInvoices('[1]', b1);

    console.log('\n[2] 5 %, gleiche Geraete, Rechnung je Buchung');
    const c2 = await makeCustomer(5);
    const b2 = await book(c2, [device(diag, 'iPhone 15', 'Smartphone'), device(ipad, 'iPad Air', 'Tablet')]);
    verifyInvariants('[2]', b2, { cartDiscount: 8.99 });
    await verifyBookingInvoice('[2]', b2, c2);

    console.log('\n[3] 15 %: 49,90 + 129,90 (Halbcent-Anteile 7,485 / 19,485)');
    const c3 = await makeCustomer(15);
    const b3 = await book(c3, [device(diag, 'iPhone 15', 'Smartphone'), device(ipad, 'iPad Air', 'Tablet')]);
    verifyInvariants('[3]', b3, { cartDiscount: 26.97, discounts: [7.48, 19.49] });
    await verifyOrderInvoices('[3]', b3);

    console.log('\n[4] 5 %, 3 Geraete je 49,90 (Rabatt percentOf(149,70) = 7,48; Anteile je 2,4933 -> 2,49; Rest 0,01 an das erste der gleich grossen)');
    const c4 = await makeCustomer(5);
    const b4 = await book(c4, [device(diag, 'iPhone 15', 'Smartphone'), device(diag, 'iPhone 15', 'Smartphone'), device(diag, 'iPhone 15', 'Smartphone')]);
    verifyInvariants('[4]', b4, { cartDiscount: 7.48, discounts: [2.5, 2.49, 2.49] });
    await verifyBookingInvoice('[4]', b4, c4);

    console.log('\n[5] 15 %, 3 Geraete 19,90 + 79,90 + 129,90');
    const c5 = await makeCustomer(15);
    const b5 = await book(c5, [device(cheap, 'iPhone 13', 'Smartphone'), device(akku, 'iPhone 14', 'Smartphone'), device(ipad, 'iPad Air', 'Tablet')]);
    verifyInvariants('[5]', b5, { cartDiscount: 34.45 });
    await verifyOrderInvoices('[5]', b5);

    console.log('\n[6] 5 %, ein Geraet: 49,90 -> 2,50 -> 47,40 (Einzel-Regel percentOf)');
    const c6 = await makeCustomer(5);
    const b6 = await book(c6, [device(diag, 'iPhone 15', 'Smartphone')]);
    verifyInvariants('[6]', b6, { cartDiscount: 2.5, discounts: [2.5] });
    check(fmt(b6.orders[0].totalCost) === '47.40' && fmt(b6.orders[0].netAmount) === '39.83' && fmt(b6.orders[0].taxAmount) === '7.57',
      '[6] I7 47,40 / netto 39,83 / MwSt. 7,57', `${fmt(b6.orders[0].totalCost)} / ${fmt(b6.orders[0].netAmount)} / ${fmt(b6.orders[0].taxAmount)}`);
    await verifyBookingInvoice('[6]', b6, c6);

    console.log('\n[7] 15 %, manipulierter Warenkorb-Betrag (totalCost 100000 statt 49,90): Katalogpreis zaehlt');
    const c7 = await makeCustomer(15);
    const b7 = await book(c7, [device(diag, 'iPhone 15', 'Smartphone', 100000), device(ipad, 'iPad Air', 'Tablet')]);
    const b7Total = r2(b7.orders.reduce((s, o) => s + Number(o.totalCost || 0), 0));
    check(eq(b7Total, 152.83) && eq(b7.booking.totalCost, 152.83) && eq(b7.booking.discount, 26.97),
      '[7] I8 Rabatt aus dem Katalogpreis (26,97), Buchung 152,83 - kein Gratisauftrag', `Auftraege ${b7.orders.map((o) => fmt(o.totalCost)).join(' + ')} = ${fmt(b7Total)}, Buchung ${fmt(b7.booking.totalCost)}, Rabatt ${fmt(b7.booking.discount)}`);
    check(b7.orders.every((o) => Number(o.totalCost) > 0), '[7] I8 kein Auftrag mit 0,00 €', b7.orders.map((o) => fmt(o.totalCost)).join(' / '));

    console.log('\n[8] 15 %, Warenkorb-Betrag zu niedrig (1,00 statt 129,90): Katalogpreis zaehlt');
    const c8 = await makeCustomer(15);
    const b8 = await book(c8, [device(diag, 'iPhone 15', 'Smartphone'), device(ipad, 'iPad Air', 'Tablet', 1)]);
    verifyInvariants('[8]', b8, { cartDiscount: 26.97 });

    console.log('\n[9] 15 %, Bestandswarenkorb mit manipuliertem Betrag (ohne pre-save gespeichert)');
    const c9 = await makeCustomer(15);
    const b9 = await book(c9, [device(diag, 'iPhone 15', 'Smartphone', 100000), device(ipad, 'iPad Air', 'Tablet')], { rawLegacyCart: true });
    verifyInvariants('[9]', b9, { cartDiscount: 26.97, discounts: [7.48, 19.49] });

    console.log('\n[10] 5 %, Geraet mit Katalog-Zusatzleistung (49,90 + 20,00) + 129,90');
    const c10 = await makeCustomer(5);
    const b10 = await book(c10, [{ ...device(diag, 'iPhone 15', 'Smartphone', 69.9), addOns: [{ name: 'Expressbearbeitung', price: 20 }] }, device(ipad, 'iPad Air', 'Tablet')]);
    verifyInvariants('[10]', b10, { cartDiscount: 9.99 });
    await verifyOrderInvoices('[10]', b10);

    const noZeroOrder = (label, b) => check(b.orders.length > 0 && b.orders.every((o) => Number(o.totalCost) > 0), `${label} kein Auftrag mit 0,00 €`, b.orders.map((o) => fmt(o.totalCost)).join(' / '));
    const serviceLines = (b) => b.orders.map((o) => (o.services || []).length).join('|');

    console.log('\n[11] 5 %, doppelte Leistungs-ID (iPad x2) + Diagnose: zaehlt einmal');
    const c11 = await makeCustomer(5);
    const b11 = await book(c11, [device(diag, 'iPhone 15', 'Smartphone'), { ...device(ipad, 'iPad Air', 'Tablet'), services: [String(ipad._id), String(ipad._id)] }]);
    verifyInvariants('[11]', b11, { cartDiscount: 8.99, discounts: [2.49, 6.5] });
    check(eq(b11.cart?.subtotal, 179.8) && serviceLines(b11) === '1|1', '[11] I9 Warenkorb 179,80, je Auftrag eine Leistungsposition', `Warenkorb ${fmt(b11.cart?.subtotal)}, Positionen ${serviceLines(b11)}`);
    noZeroOrder('[11]', b11);

    console.log('\n[12] 15 %, 20x dieselbe Leistungs-ID (iPad) + Diagnose: kein Gratisauftrag');
    const c12 = await makeCustomer(15);
    const b12 = await book(c12, [{ ...device(ipad, 'iPad Air', 'Tablet'), services: Array.from({ length: 20 }, () => String(ipad._id)) }, device(diag, 'iPhone 15', 'Smartphone')]);
    verifyInvariants('[12]', b12, { cartDiscount: 26.97, discounts: [19.49, 7.48] });
    check(eq(b12.booking.totalCost, 152.83), '[12] I9 Buchung 152,83 (nicht 2250,71)', fmt(b12.booking.totalCost));
    noZeroOrder('[12]', b12);

    console.log('\n[13] 15 %, Zusatzleistung mit Client-Preis -40 / 0 / 0,01: Katalogpreis 20,00');
    for (const [idx, clientPrice] of [[1, -40], [2, 0], [3, 0.01]]) {
      const c13 = await makeCustomer(15);
      const b13 = await book(c13, [{ ...device(diag, 'iPhone 15', 'Smartphone', 1), addOns: [{ name: 'Expressbearbeitung', price: clientPrice }] }, device(ipad, 'iPad Air', 'Tablet')]);
      verifyInvariants(`[13.${idx}]`, b13, { cartDiscount: 29.97 });
      const addOn = (b13.orders[0].addOns || [])[0];
      check(b13.orders.length === 2 && addOn && eq(addOn.price, 20) && eq(lineSum(b13.orders[0]), 69.9), `[13.${idx}] I10 Zusatzleistung im Auftrag zum Katalogpreis 20,00 (Client ${clientPrice})`, `${b13.orders.length} Auftraege, Zusatz ${fmt(addOn?.price)}, Positionen ${fmt(lineSum(b13.orders[0]))}`);
      noZeroOrder(`[13.${idx}]`, b13);
    }

    console.log('\n[14] Unbekannte / deaktivierte Zusatzleistung, unbekannte / ungueltige Leistung: 400, Warenkorb unveraendert');
    const c14 = await makeCustomer(5);
    const firstAdd = await call('POST', '/api/cart/add-repair-order', c14, device(diag, 'iPhone 15', 'Smartphone'));
    check(firstAdd.status === 200, '[14] gueltiges Geraet angelegt', firstAdd.status);
    const rejects = [
      ['unbekannte Zusatzleistung', { ...device(diag, 'iPhone 15', 'Smartphone'), addOns: [{ name: 'Gratis-Extra', price: -100 }] }],
      ['deaktivierte Zusatzleistung', { ...device(diag, 'iPhone 15', 'Smartphone'), addOns: [{ name: 'Altes Extra', price: 5 }] }],
      ['unbekannte Leistungs-ID', { ...device(diag, 'iPhone 15', 'Smartphone'), services: [String(new mongoose.Types.ObjectId())] }],
      ['ungueltige Leistungs-ID', { ...device(diag, 'iPhone 15', 'Smartphone'), services: ['kein-objectid'] }],
    ];
    for (const [label, payload] of rejects) {
      const res = await call('POST', '/api/cart/add-repair-order', c14, payload);
      check(res.status === 400 && /verfügbar|ungültig/.test(String(res.body?.error || '')), `[14] ${label}: 400 mit deutscher Meldung`, `${res.status} ${res.body?.error || ''}`);
    }
    const cart14 = await call('GET', '/api/cart', c14);
    const cart14Body = cart14.body?.cart || cart14.body;
    check((cart14Body?.repairOrders || []).length === 1 && eq(cart14Body?.subtotal, 49.9), '[14] Warenkorb unveraendert (1 Geraet, 49,90)', `${(cart14Body?.repairOrders || []).length} / ${fmt(cart14Body?.subtotal)}`);

    console.log('\n[15] 15 %, Bestandswarenkorb (ohne pre-save): 20x Leistungs-ID + Zusatzleistung mit Client-Preis -40');
    const c15 = await makeCustomer(15);
    const b15 = await book(c15, [
      { ...device(diag, 'iPhone 15', 'Smartphone', 9999), services: Array.from({ length: 20 }, () => String(diag._id)), addOns: [{ name: 'Expressbearbeitung', price: -40 }] },
      device(ipad, 'iPad Air', 'Tablet'),
    ], { rawLegacyCart: true });
    verifyInvariants('[15]', b15, { cartDiscount: 29.97 });
    check(eq((b15.orders[0].addOns || [])[0]?.price, 20) && serviceLines(b15) === '1|1', '[15] I10 Bestandswarenkorb: Zusatzleistung 20,00, eine Leistungsposition', `${fmt((b15.orders[0].addOns || [])[0]?.price)} / ${serviceLines(b15)}`);
    noZeroOrder('[15]', b15);

    console.log('\n[16] Bestandswarenkorb mit entfernter Leistung: Checkout 400, nichts angelegt');
    const c16 = await makeCustomer(5);
    const gone = await svc('Entfernt', 'iPhone 12', 'Smartphone', 59.9);
    await mongoose.connection.db.collection('carts').insertOne({
      userId: c16._id, items: [], isActive: true, discount: 0,
      repairOrders: [{ _id: new mongoose.Types.ObjectId(), deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 12', services: [gone._id], addOns: [], totalCost: 59.9, addedAt: new Date() },
        { _id: new mongoose.Types.ObjectId(), deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 15', services: [diag._id], addOns: [], totalCost: 49.9, addedAt: new Date() }],
      subtotal: 109.8, total: 109.8, createdAt: new Date(), updatedAt: new Date(),
    });
    await Service.deleteOne({ _id: gone._id });
    const ordersBefore16 = await Order.countDocuments({ customerId: c16._id });
    const done16 = await call('POST', '/api/checkout/complete', c16, { paymentMethod: 'card', paymentData: {}, checkoutAttemptId: `co_sec_alloc_16_${Date.now()}` });
    const ordersAfter16 = await Order.countDocuments({ customerId: c16._id });
    const bookings16 = await Booking.countDocuments({ customerId: c16._id });
    check(done16.status === 400 && /verfügbar/.test(String(done16.body?.error || '')) && ordersAfter16 === ordersBefore16 && bookings16 === 0,
      '[16] 400, kein Auftrag und keine Buchung (frueher: Geraet still verworfen)', `${done16.status} ${done16.body?.error || ''} Auftraege ${ordersBefore16}->${ordersAfter16} Buchungen ${bookings16}`);

    console.log('\n[17] Gast-Checkout (Warenkorb komplett vom Client): doppelte IDs + Zusatzleistung -40 -> Katalog');
    const guestInfo = { email: 'alloc-gast@test.invalid', firstName: 'Gerd', lastName: 'Gast', phone: '0301234',
      billingAddress: { street: 'Gastweg 3', city: 'Berlin', zipCode: '10117', country: 'DE' } };
    const guestCart = { repairOrders: [
      { deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 15', services: Array.from({ length: 20 }, () => String(diag._id)), addOns: [{ name: 'Expressbearbeitung', price: -40 }], totalCost: 1, errorDescription: 'Test' },
      { deviceType: 'Tablet', deviceBrand: 'Apple', deviceModel: 'iPad Air', services: [String(ipad._id), String(ipad._id)], addOns: [], totalCost: 1, errorDescription: 'Test' },
    ] };
    const g17 = await call('POST', '/api/checkout/guest-complete', null, { guestInfo, cartData: guestCart, paymentMethod: 'card', paymentData: {}, checkoutAttemptId: `co_sec_alloc_17_${Date.now()}` });
    const gBooking = g17.body?.bookingId ? await Booking.findById(g17.body.bookingId).setOptions({ skipAutoPopulate: true }).lean() : null;
    const gOrders = gBooking ? await Order.find({ _id: { $in: gBooking.orderIds } }).sort({ createdAt: 1, _id: 1 }).lean() : [];
    const gSum = r2(gOrders.reduce((s, o) => s + Number(o.totalCost || 0), 0));
    check(g17.status === 200 && gBooking && eq(gBooking.totalCost, 199.8) && eq(gSum, 199.8) && gOrders.map((o) => fmt(o.totalCost)).join('|') === '69.90|129.90',
      '[17] Gast: Buchung 199,80 == Auftragssumme (69,90 + 129,90), Katalogpreise', `${g17.status} Buchung ${fmt(gBooking?.totalCost)} Auftraege ${gOrders.map((o) => fmt(o.totalCost)).join(' + ')} ${g17.body?.error || ''}`);
    check(gOrders.length === 2 && serviceLines({ orders: gOrders }) === '1|1' && eq((gOrders[0].addOns || [])[0]?.price, 20),
      '[17] Gast: je eine Leistungsposition, Zusatzleistung 20,00', `${serviceLines({ orders: gOrders })} / ${fmt((gOrders[0]?.addOns || [])[0]?.price)}`);
    const g17bad = await call('POST', '/api/checkout/guest-complete', null, { guestInfo: { ...guestInfo, email: 'alloc-gast2@test.invalid' },
      cartData: { repairOrders: [{ ...guestCart.repairOrders[0], addOns: [{ name: 'Gratis-Extra', price: -60 }] }] }, paymentMethod: 'card', paymentData: {} });
    const g17badBookings = await Booking.countDocuments({ 'guestInfo.email': 'alloc-gast2@test.invalid' });
    check(g17bad.status === 400 && g17badBookings === 0, '[17] Gast: unbekannte Zusatzleistung -> 400, keine Buchung', `${g17bad.status} ${g17bad.body?.error || ''} Buchungen ${g17badBookings}`);

    console.log('\n[18] Auftrag 2 von 2 scheitert bei der Anlage: keine Teil-Buchung mit abweichendem Betrag');
    const OrderService = require(path.join(SERVER_DIR, 'services/orderService'));
    const c18 = await makeCustomer(5);
    for (const d of [device(diag, 'iPhone 15', 'Smartphone'), device(ipad, 'iPad Air', 'Tablet')]) {
      const added = await call('POST', '/api/cart/add-repair-order', c18, d);
      if (added.status !== 200) throw new Error(`Warenkorb [18]: ${added.status}`);
    }
    const originalCreate = OrderService.create;
    let createCalls = 0;
    OrderService.create = async function failingSecond(...args) {
      createCalls += 1;
      if (createCalls === 2) throw new Error('Simulierter Validierungsfehler (Test)');
      return originalCreate.apply(this, args);
    };
    let done18;
    try {
      done18 = await call('POST', '/api/checkout/complete', c18, { paymentMethod: 'card', paymentData: {}, checkoutAttemptId: `co_sec_alloc_18_${Date.now()}` });
    } finally {
      OrderService.create = originalCreate;
    }
    const orders18 = await Order.countDocuments({ customerId: c18._id });
    const bookings18 = await Booking.countDocuments({ customerId: c18._id });
    const cart18 = await call('GET', '/api/cart', c18);
    check(done18.status === 500 && orders18 === 0 && bookings18 === 0 && ((cart18.body?.cart || cart18.body)?.repairOrders || []).length === 2,
      '[18] 500, angelegter Auftrag verworfen, keine Buchung, Warenkorb bleibt', `${done18.status} ${done18.body?.error || ''} Auftraege ${orders18} Buchungen ${bookings18}`);
    const retry18 = await call('POST', '/api/checkout/complete', c18, { paymentMethod: 'card', paymentData: {}, checkoutAttemptId: `co_sec_alloc_18b_${Date.now()}` });
    const booking18 = retry18.body?.bookingId ? await Booking.findById(retry18.body.bookingId).setOptions({ skipAutoPopulate: true }).lean() : null;
    const orders18b = booking18 ? await Order.find({ _id: { $in: booking18.orderIds } }).lean() : [];
    check(retry18.status === 200 && orders18b.length === 2 && eq(booking18.totalCost, r2(orders18b.reduce((s, o) => s + Number(o.totalCost || 0), 0))) && eq(booking18.totalCost, 170.81),
      '[18] Erneuter Versuch: vollstaendige Buchung 170,81 == Auftragssumme', `${retry18.status} ${fmt(booking18?.totalCost)} / ${orders18b.length} Auftraege`);
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
