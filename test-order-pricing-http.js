/**
 * T02/T03 HTTP-Regressionstest: Auftragswert ueber die ECHTEN Express-Router.
 *
 * Gleicher Weg wie der Browser: POST /api/orders (Kunde) und
 * GET/POST/PUT/DELETE /api/order-services (Kunde lesend, Personal schreibend),
 * mit echter JWT-Pruefung durch die Auth-Middleware.
 *
 * Abgesichert:
 *   1. POST /api/orders: vom Client gelieferte Summen, Rabatte, Positionspreise,
 *      Haendlerrabatt und Zahlstatus werden ignoriert; der Server rechnet.
 *   2. Ein Kunde darf keine Positionen am Auftrag aendern (403).
 *   3. Personal: Katalogservice, manuelle Position, Preisaenderung, Loeschen -
 *      Haendlerrabatt bleibt, Werte in der DB und in der Lese-API stimmen.
 *   4. Validierungsfehler kommen als 400 mit deutscher Meldung, nichts wird gespeichert.
 *   5. Rechnungsbrutto === Auftragswert.
 *   6. Scheitert der Finanzabgleich nach dem Speichern, meldet die Antwort das als
 *      deutsche Warnung (keine stille Erfolgsmeldung); der wiederholte Abgleich
 *      bringt die Rechnung auf Stand, ohne doppelte Finanzbelege.
 *
 * E-Mail und Benachrichtigungen sind GEMOCKT (keine echte Kunden-E-Mail).
 * JWT_SECRET wird nur fuer diesen Prozess mit einem Zufallswert gesetzt.
 *
 * Aufruf (benoetigt eine WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t02http node test-order-pricing-http.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t02_order_pricing_http';

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

const money = (value) => Number(Number(value || 0).toFixed(2));

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

  // MOCKS: keine echten E-Mails / Benachrichtigungen.
  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.sendOrderConfirmationEmail = async () => ({ success: true, mocked: true });
  EmailService.buildSystemUrl = async (p) => `http://test.invalid${p}`;
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  const sentNotifications = [];
  NotificationService.createNotification = async (data) => {
    sentNotifications.push(data);
    return { _id: new mongoose.Types.ObjectId(), ...data };
  };

  const orderRoutes = require(path.join(SERVER_DIR, 'routes/orderRoutes'));
  const orderServiceRoutes = require(path.join(SERVER_DIR, 'routes/orderServiceRoutes'));
  const FinancialService = require(path.join(SERVER_DIR, 'services/financialService'));

  const app = express();
  app.use(express.json());
  app.use('/api/orders', orderRoutes);
  app.use('/api/order-services', orderServiceRoutes);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Service = mongoose.model('Service');
  const AddOnService = mongoose.model('AddOnService');

  const readStored = async (id) =>
    mongoose.connection.db.collection('orders').findOne({ _id: new mongoose.Types.ObjectId(String(id)) });

  const customer = await User.create({ name: 'Haendler HTTP', email: 'http-haendler@test.invalid', role: 'customer', discount: 10 });
  const staff = await User.create({ name: 'Sophie HTTP', email: 'http-staff@test.invalid', role: 'staff' });
  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });

  const call = async (method, url, user, body) => {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFor(user)}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try {
      json = await response.json();
    } catch (error) {
      json = null;
    }
    return { status: response.status, body: json };
  };

  const base = { category: 'display', deviceTypes: ['Smartphone'], manufacturerPrecise: 'Apple', modelPrecise: 'iPhone 15' };
  const display = await Service.create({ ...base, name: 'Displaytausch', price: 100, estimatedTime: '60' });
  const akku = await Service.create({ ...base, name: 'Akkutausch', price: 50, estimatedTime: '30' });
  const pixel = await Service.create({ ...base, name: 'Displaytausch Pixel 8', price: 90, manufacturerPrecise: 'Google', modelPrecise: 'Pixel 8' });
  await AddOnService.create({ name: 'Expressbearbeitung', description: 'Express', price: 30, estimatedTime: '0', category: 'service' });

  try {
    console.log('\n[1] POST /api/orders mit manipulierten Summen (Kunde)');
    const created = await call('POST', '/api/orders', customer, {
      deviceType: 'Smartphone',
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 15',
      services: [String(display._id)],
      addOns: [{ name: 'Expressbearbeitung', description: 'Express', price: 0.01, status: 'pending' }],
      totalCost: 1,
      discount: 50,
      dealerDiscountPercent: 90,
      paymentStatus: 'paid',
      pricingConditions: { groupDiscountPercent: 99 },
    });
    check(created.status === 201, 'HTTP 201', created.status);
    const orderId = created.body && created.body.orderId;
    let stored = await readStored(orderId);
    // 100 + 30 = 130 -> 10 % = 13 -> 117
    check(money(stored.totalCost) === 117, 'DB: Auftragswert serverseitig 117,00', stored.totalCost);
    check(money(stored.discount) === 13, 'DB: Rabatt serverseitig 13,00', stored.discount);
    check(money(stored.addOns[0].price) === 30, 'DB: Zusatzleistung zum Katalogpreis', stored.addOns[0].price);
    check(stored.paymentStatus === 'pending', 'DB: Zahlstatus nicht vom Client setzbar', stored.paymentStatus);
    check(!stored.dealerDiscountPercent, 'DB: Client-Haendlerrabatt ignoriert', stored.dealerDiscountPercent);

    console.log('\n[2] Kunde darf keine Positionen aendern');
    const forbidden = await call('POST', `/api/order-services/${orderId}`, customer, { serviceId: String(akku._id) });
    check(forbidden.status === 403, 'HTTP 403', forbidden.status);

    console.log('\n[3] Personal fuegt Katalogservice hinzu');
    const added = await call('POST', `/api/order-services/${orderId}`, staff, { serviceId: String(akku._id), reason: 'Akku defekt' });
    check(added.status === 201, 'HTTP 201', added.status);
    stored = await readStored(orderId);
    // 180 -> 18 -> 162
    check(money(stored.totalCost) === 162, 'DB: 180 - 18 = 162,00', stored.totalCost);
    check(added.body && money(added.body.pricing?.grossTotal) === 162, 'Antwort enthaelt Brutto 162,00', added.body && added.body.pricing?.grossTotal);

    console.log('\n[4] Validierungsfehler: 400, deutsch, nichts gespeichert');
    const noName = await call('POST', `/api/order-services/${orderId}`, staff, { isManual: true, name: '', price: 10 });
    check(noName.status === 400, 'manuelle Position ohne Namen: HTTP 400', noName.status);
    check(/Namen/.test(noName.body?.error || ''), 'deutsche Meldung', noName.body?.error);
    const wrongModel = await call('POST', `/api/order-services/${orderId}`, staff, { serviceId: String(pixel._id) });
    check(wrongModel.status === 400, 'Service fuer anderes Modell: HTTP 400', wrongModel.status);
    check(/passt nicht/.test(wrongModel.body?.error || ''), 'deutsche Meldung', wrongModel.body?.error);
    const dup = await call('POST', `/api/order-services/${orderId}`, staff, { serviceId: String(akku._id) });
    check(dup.status === 409, 'doppelter Service: HTTP 409', dup.status);
    stored = await readStored(orderId);
    check(stored.services.length === 2, 'weiterhin 2 Positionen', stored.services.length);
    const missing = await call('POST', `/api/order-services/${new mongoose.Types.ObjectId()}`, staff, { serviceId: String(akku._id) });
    check(missing.status === 404, 'unbekannter Auftrag: HTTP 404', missing.status);
    check(/Auftrag/.test(missing.body?.error || ''), 'deutsche Meldung', missing.body?.error);

    console.log('\n[5] Personal fuegt manuelle Position hinzu (Standardpreis brutto 100,00)');
    const manual = await call('POST', `/api/order-services/${orderId}`, staff, {
      isManual: true,
      name: 'Platinenreparatur',
      description: 'Mikrolöten',
      price: 100,
      reason: 'Zusatzarbeit',
    });
    check(manual.status === 201, 'HTTP 201', manual.status);
    stored = await readStored(orderId);
    const manualLine = stored.services.find((s) => s.isManual);
    check(manualLine && manualLine.name === 'Platinenreparatur' && !manualLine.serviceId, 'DB: Name, keine Katalog-ID', manualLine && `${manualLine.name} / ${manualLine.serviceId}`);
    // 280 -> 28 -> 252
    check(money(stored.totalCost) === 252, 'DB: 280 - 28 = 252,00', stored.totalCost);

    console.log('\n[6] Lese-API (Kunde, eigener Auftrag)');
    const read = await call('GET', `/api/order-services/${orderId}`, customer);
    check(read.status === 200, 'HTTP 200', read.status);
    check(money(read.body?.pricing?.positionsGross) === 280, 'Zwischensumme 280,00', read.body?.pricing?.positionsGross);
    check(money(read.body?.pricing?.discount) === 28, 'Rabatt 28,00', read.body?.pricing?.discount);
    check(money(read.body?.pricing?.groupDiscountPercent) === 10, 'Rabatt 10 %', read.body?.pricing?.groupDiscountPercent);
    check(money(read.body?.pricing?.grossTotal) === 252, 'Brutto 252,00', read.body?.pricing?.grossTotal);
    check(read.body?.pricing?.positionsReconcile === true, 'Positionen stimmen mit Gesamt', read.body?.pricing?.positionsReconcile);
    check((read.body?.services || []).some((s) => s.isManual && s.name === 'Platinenreparatur'), 'manuelle Position sichtbar', (read.body?.services || []).length);

    console.log('\n[7] Preisaenderung und Loeschen');
    const upd = await call('PUT', `/api/order-services/${orderId}/${manualLine._id}`, staff, { price: 150, reason: 'Mehraufwand' });
    check(upd.status === 200, 'PUT HTTP 200', upd.status);
    stored = await readStored(orderId);
    // 330 -> 33 -> 297
    check(money(stored.totalCost) === 297, 'DB: 330 - 33 = 297,00', stored.totalCost);
    const akkuLine = stored.services.find((s) => String(s.serviceId) === String(akku._id));
    const del = await call('DELETE', `/api/order-services/${orderId}/${akkuLine._id}`, staff, { reason: 'Kunde verzichtet' });
    check(del.status === 200, 'DELETE HTTP 200', del.status);
    stored = await readStored(orderId);
    // 280 -> 28 -> 252
    check(money(stored.totalCost) === 252, 'DB: 280 - 28 = 252,00', stored.totalCost);

    console.log('\n[8] Rechnungsbrutto === Auftragswert');
    await Order.updateOne({ _id: orderId }, { $set: { status: 'completed' } });
    const invoice = await FinancialService.generateFromRepairOrders([String(orderId)], {});
    stored = await readStored(orderId);
    check(money(invoice.total) === money(stored.totalCost), 'Rechnungsbrutto === Auftragswert', `${invoice.total} === ${stored.totalCost}`);
    check(sentNotifications.length >= 4, 'Benachrichtigungen ausgeloest (Mock)', sentNotifications.length);

    console.log('\n[9] Fehler im Finanzabgleich wird sichtbar gemeldet, Wiederholung ohne Duplikate');
    const Invoice = mongoose.model('Invoice');
    const realSync = FinancialService.syncOrderAndBookingValue;
    // MOCK: der Abgleich scheitert genau einmal.
    FinancialService.syncOrderAndBookingValue = async () => { throw new Error('Simulierter DB-Ausfall'); };
    const akkuAgain = await call('POST', `/api/order-services/${orderId}`, staff, { serviceId: String(akku._id), reason: 'Akku doch' });
    FinancialService.syncOrderAndBookingValue = realSync;
    check(akkuAgain.status === 201, 'Position gespeichert (HTTP 201)', akkuAgain.status);
    check(
      Array.isArray(akkuAgain.body?.warnings) && akkuAgain.body.warnings.some((w) => /Abgleich/.test(w)),
      'Warnung zum Finanzabgleich in der Antwort (deutsch)',
      JSON.stringify(akkuAgain.body?.warnings),
    );
    stored = await readStored(orderId);
    // 330 -> 33 -> 297
    check(money(stored.totalCost) === 297, 'DB: Auftragswert 297,00 gespeichert', stored.totalCost);
    let invoiceNow = await Invoice.findById(invoice._id).lean();
    check(money(invoiceNow.total) === 252, 'Rechnung noch auf altem Stand (Abgleich fehlte) = 252,00', invoiceNow.total);
    // Reparaturpfad: Abgleich erneut ausfuehren - zweimal, um Duplikate auszuschliessen.
    await FinancialService.syncOrderAndBookingValue(String(orderId), 'order');
    await FinancialService.syncOrderAndBookingValue(String(orderId), 'order');
    invoiceNow = await Invoice.findById(invoice._id).lean();
    check(money(invoiceNow.total) === 297, 'nach Wiederholung: Rechnungsbrutto === Auftragswert 297,00', invoiceNow.total);
    const invoiceCount = await Invoice.countDocuments({ $or: [{ orderId }, { repairOrderIds: orderId }] });
    check(invoiceCount === 1, 'keine doppelten Finanzbelege', invoiceCount);
  } finally {
    server.close();
  }

  console.log(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('ERROR:', error.message);
  console.error(error.stack);
  process.exit(2);
});
