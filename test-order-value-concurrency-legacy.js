/**
 * Regressionstest (Track order-value-b): Auftragswert bei PARALLELEN Bearbeitungen,
 * Altauftraege mit nicht aufgehenden Summen und die restlichen Schreiber des
 * Auftragswerts (Reparaturanfrage, Reklamation, Geraetewechsel).
 *
 * Abgesicherte Invarianten:
 *   1. Parallele Bearbeitungen desselben Auftrags (Doppelklick, Wiederholung, zwei
 *      Mitarbeitende) lassen den Auftrag KONSISTENT: gespeicherte Positionen und
 *      gespeicherter Auftragswert/Rabatt stammen aus demselben Stand
 *      (Auftragswert === Preisregel(Positionen, Kondition)); ein doppelt
 *      hinzugefuegter Katalogservice wird genau einmal gespeichert.
 *   2. Altauftrag, dessen gespeicherter Auftragswert nicht zu den Positionen passt
 *      (z. B. Reklamationsgebuehr direkt auf totalCost), wird NICHT still neu
 *      berechnet: deutsche 409-Meldung, nichts gespeichert. Erst nach ausdruecklicher
 *      Bestaetigung (confirmRepricing) wird neu berechnet und das in der Historie
 *      festgehalten. Gilt fuer Services, Zusatzleistungen und Produkte.
 *   3. Altauftrag mit altem Haendlerrabatt (dealerDiscountPercent/-Amount) verliert
 *      den Rabatt bei der ersten Bearbeitung nicht.
 *   4. POST /api/orders-Pfad: keine englischen Meldungen mehr.
 *   5. Kunden-Detailantwort: keine internen Konditionsdaten, kein Base64-Label.
 *   6. Geraetewechsel ueber HTTP: Grund landet in der Historie, Warnungen kommen zurueck.
 *   7. Reparaturanfrage -> Auftrag: Auftragswert nach der Preisregel (Kundenrabatt),
 *      nicht der vom Client/Kostenvoranschlag gelieferte Betrag.
 *   8. Reklamation: angenommenes Angebot und Servicepauschale sind POSITIONEN und
 *      ueberleben eine spaetere Bearbeitung; Ablehnung ohne Reklamationsauftrag
 *      laeuft nicht in die Doppelrechnungssperre des Originalauftrags; die
 *      Pauschale ist nicht vom Kunden setzbar; das Reklamationslabel wird
 *      ausdruecklich als Einsendung (inbound) angefordert (DHL gemockt).
 *
 * MOCKS: Benachrichtigungen, E-Mails und DHL sind gemockt - keine echte Kunden-E-Mail,
 * kein echtes Label. JWT_SECRET wird nur fuer diesen Prozess zufaellig gesetzt.
 *
 * Aufruf (benoetigt eine WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/ovb node test-order-value-concurrency-legacy.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_order_value_concurrency';

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

  fs.readdirSync(path.join(SERVER_DIR, 'models'))
    .filter((file) => file.endsWith('.js'))
    .forEach((file) => {
      try {
        require(path.join(SERVER_DIR, 'models', file));
      } catch (error) {
        /* Modelle mit optionalen Abhaengigkeiten ueberspringen */
      }
    });

  // ---- MOCKS: keine echten E-Mails / Benachrichtigungen / DHL-Labels ----
  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.sendOrderConfirmationEmail = async () => ({ success: true, mocked: true });
  EmailService.sendTriggerEmail = async () => ({ success: true, mocked: true });
  EmailService.sendEmail = async () => ({ success: true, mocked: true });
  EmailService.buildSystemUrl = async (p) => `http://test.invalid${p}`;
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });
  const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));
  const capturedShipments = [];
  DHLService.getDHLConfig = async () => ({ settings: { shipperStreet: 'Teststr. 1', shipperCity: 'Berlin', shipperPostalCode: '10115' } });
  DHLService.getParcelDEConfig = () => ({ accountNumber: 'MOCK', profile: 'MOCK', product: 'V01PAK' });
  DHLService.createShipment = async (orderId, data, options) => {
    capturedShipments.push({ orderId: String(orderId), data, options });
    return { labelUrl: 'data:application/pdf;base64,JVBERi0xLjQKJU1PQ0s=', trackingNumber: 'MOCK-TRACK-1' };
  };
  const InspectionCommunicationService = require(path.join(SERVER_DIR, 'services/inspectionCommunicationService'));
  InspectionCommunicationService.updateRepairOfferStatus = async () => null;

  const OrderService = require(path.join(SERVER_DIR, 'services/orderService'));
  const OrderServiceManagementService = require(path.join(SERVER_DIR, 'services/orderServiceManagementService'));
  const FinancialService = require(path.join(SERVER_DIR, 'services/financialService'));
  const CalculationHelper = require(path.join(SERVER_DIR, 'services/calculationHelper'));
  const RepairRequestService = require(path.join(SERVER_DIR, 'services/repairRequestService'));

  const app = express();
  app.use(express.json());
  app.use('/api/orders', require(path.join(SERVER_DIR, 'routes/orderRoutes')));
  app.use('/api/order-services', require(path.join(SERVER_DIR, 'routes/orderServiceRoutes')));
  app.use('/api/admin/orders', require(path.join(SERVER_DIR, 'routes/adminOrderRoutes')));
  app.use('/api/complaints', require(path.join(SERVER_DIR, 'routes/complaintRoutes')));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Service = mongoose.model('Service');
  const Product = mongoose.model('Product');
  const Invoice = mongoose.model('Invoice');
  const Complaint = mongoose.model('Complaint');
  const OrderRevision = mongoose.model('OrderRevision');
  const RepairRequest = mongoose.model('RepairRequest');

  const readStored = async (id) =>
    mongoose.connection.db.collection('orders').findOne({ _id: new mongoose.Types.ObjectId(String(id)) });

  const positionsOf = (stored) => money(
    (stored.services || []).reduce((sum, s) => sum + (typeof s === 'object' ? Number(s.price || 0) : 0), 0)
    + (stored.addOns || []).reduce((sum, a) => sum + Number(a.price || 0), 0)
    + (stored.shopProducts || []).reduce((sum, p) => sum + Number(p.priceAtOrder || 0) * Number(p.quantity || 0), 0),
  );

  // Invariante 1: gespeicherter Wert === Preisregel(gespeicherte Positionen, Snapshot)
  const checkRuleInvariant = (label, stored) => {
    const expected = CalculationHelper.calculateOrderPricing({
      positionsGross: positionsOf(stored),
      groupDiscountPercent: stored.pricingConditions?.groupDiscountPercent,
      promoDiscountAmount: stored.pricingConditions?.promoDiscountAmount,
    });
    check(
      money(stored.totalCost) === money(expected.totalCost) && money(stored.discount) === money(expected.discount),
      `${label}: Auftragswert/Rabatt === Preisregel(Positionen)`,
      `gespeichert ${stored.totalCost}/${stored.discount}, Regel ${expected.totalCost}/${expected.discount} (Positionen ${positionsOf(stored)})`,
    );
    check(
      Math.abs(positionsOf(stored) - Number(stored.discount || 0) - Number(stored.totalCost || 0)) <= 0.02,
      `${label}: Positionen - Rabatt === Auftragswert (Rechnung = Auftrag)`,
      `${positionsOf(stored)} - ${stored.discount} vs ${stored.totalCost}`,
    );
  };

  const haendler = await User.create({ name: 'Haendler OVB', email: 'ovb-haendler@test.invalid', role: 'customer', discount: 10 });
  const privat = await User.create({ name: 'Privat OVB', email: 'ovb-privat@test.invalid', role: 'customer' });
  const staff = await User.create({ name: 'Sophie OVB', email: 'ovb-staff@test.invalid', role: 'staff' });
  const admin = await User.create({ name: 'Admin OVB', email: 'ovb-admin@test.invalid', role: 'admin' });
  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, user, body) => {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(user)}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await response.json(); } catch (error) { json = null; }
    return { status: response.status, body: json };
  };

  const base = { category: 'display', deviceTypes: ['Smartphone'], manufacturerPrecise: 'Apple', modelPrecise: 'iPhone 15' };
  const display = await Service.create({ ...base, name: 'Displaytausch', price: 100, estimatedTime: '60' });
  const akku = await Service.create({ ...base, name: 'Akkutausch', price: 50, estimatedTime: '30' });
  const kamera = await Service.create({ ...base, name: 'Kameratausch', price: 70, estimatedTime: '45' });
  const displayPro = await Service.create({ ...base, name: 'Displaytausch Pro', price: 150, modelPrecise: 'iPhone 15 Pro' });
  const huelle = await Product.create({
    name: 'Schutzhülle', description: 'Hülle', price: 20, category: 'Cases', brand: 'Apple', stock: 100, stockCount: 100,
  });

  const newDealerOrder = async (extra = {}) => OrderService.create({
    customerId: haendler._id,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 15',
    deviceType: 'Smartphone',
    errorDescription: 'Test',
    services: [String(display._id)],
    ...extra,
  });

  try {
    console.log('\n[1] 5 parallele manuelle Positionen (je 50,00) auf 10 %-Auftrag 100,00');
    const raceOrder = await newDealerOrder();
    const raceId = String(raceOrder._id);
    const raceResults = await Promise.allSettled(
      [1, 2, 3, 4, 5].map((n) => OrderServiceManagementService.addServiceToOrder(raceId, null, {
        isManual: true, name: `Zusatzarbeit ${n}`, price: 50, actorId: staff._id, reason: `parallel ${n}`,
      })),
    );
    const raceOk = raceResults.filter((r) => r.status === 'fulfilled').length;
    const raceRejected = raceResults.filter((r) => r.status === 'rejected');
    let stored = await readStored(raceId);
    check(stored.services.length === 1 + raceOk, 'gespeicherte Zeilen = 1 + erfolgreiche Aufrufe', `${stored.services.length} Zeilen, ${raceOk} erfolgreich`);
    check(
      raceRejected.every((r) => r.reason?.statusCode === 409 && /gleichzeitig/.test(r.reason?.message || '')),
      'abgelehnte Aufrufe (falls vorhanden) mit deutscher 409-Meldung',
      raceRejected.map((r) => `${r.reason?.statusCode} ${r.reason?.message}`).join(' | ') || 'keiner abgelehnt',
    );
    check(raceOk >= 4, 'mindestens 4 von 5 parallelen Aufrufen gespeichert (Wiederholung greift)', raceOk);
    checkRuleInvariant('[1]', stored);

    console.log('\n[2] Derselbe Katalogservice zweimal parallel (Doppelklick)');
    const dupOrder = await newDealerOrder();
    const dupResults = await Promise.allSettled([
      OrderServiceManagementService.addServiceToOrder(String(dupOrder._id), String(akku._id), { actorId: staff._id }),
      OrderServiceManagementService.addServiceToOrder(String(dupOrder._id), String(akku._id), { actorId: staff._id }),
    ]);
    stored = await readStored(dupOrder._id);
    const akkuLines = stored.services.filter((s) => String(s.serviceId) === String(akku._id)).length;
    check(akkuLines === 1, 'Akkutausch genau einmal gespeichert', akkuLines);
    check(
      dupResults.filter((r) => r.status === 'rejected').every((r) => r.reason?.statusCode === 409),
      'zweiter Aufruf: 409',
      dupResults.map((r) => r.status === 'fulfilled' ? 'ok' : `${r.reason?.statusCode} ${r.reason?.message}`).join(' | '),
    );
    // 150 -> 15 -> 135
    check(money(stored.totalCost) === 135, 'Auftragswert 135,00 (nicht 185/135 gemischt)', stored.totalCost);
    checkRuleInvariant('[2]', stored);

    console.log('\n[3] Gemischte parallele Schreiber: Service + Zusatzleistung + Produkt + Preisaenderung');
    const mixOrder = await newDealerOrder();
    const mixId = String(mixOrder._id);
    const displayLineId = String((await readStored(mixId)).services[0]._id);
    const mixResults = await Promise.allSettled([
      OrderServiceManagementService.addServiceToOrder(mixId, String(kamera._id), { actorId: staff._id }),
      OrderService.addAddonToOrder(mixId, { name: 'Expressbearbeitung', price: 30 }, staff._id),
      OrderService.addShopProduct(mixId, String(huelle._id), 2, staff._id),
      OrderServiceManagementService.updateOrderService(mixId, displayLineId, { price: 120, actorId: staff._id }),
    ]);
    stored = await readStored(mixId);
    check(
      mixResults.every((r) => r.status === 'fulfilled' || r.reason?.statusCode === 409),
      'alle Aufrufe gespeichert oder sauber mit 409 abgelehnt',
      mixResults.map((r) => r.status === 'fulfilled' ? 'ok' : `${r.reason?.statusCode} ${r.reason?.message}`).join(' | '),
    );
    checkRuleInvariant('[3]', stored);
    await Order.updateOne({ _id: mixId }, { $set: { status: 'completed' } });
    const mixInvoice = await FinancialService.generateFromRepairOrders([mixId], {});
    check(money(mixInvoice.total) === money(stored.totalCost), '[3] Rechnungsbrutto === Auftragswert', `${mixInvoice.total} === ${stored.totalCost}`);

    console.log('\n[4] Altauftrag: Auftragswert UEBER den Positionen, Rabatt 0 (Reklamationsgebuehr)');
    const legacyFee = await mongoose.connection.db.collection('orders').insertOne({
      orderNumber: 'ORD-LEGACY-FEE',
      customerId: privat._id,
      deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
      services: [{ _id: new mongoose.Types.ObjectId(), serviceId: display._id, price: 100, estimatedTime: 60, notes: '' }],
      addOns: [], shopProducts: [],
      totalCost: 139, discount: 0, status: 'pending', createdAt: new Date('2025-05-01'),
    });
    const legacyFeeId = String(legacyFee.insertedId);
    const legacyLineId = String((await readStored(legacyFeeId)).services[0]._id);
    let refused = null;
    try {
      await OrderServiceManagementService.updateOrderService(legacyFeeId, legacyLineId, { price: 110, actorId: staff._id });
    } catch (error) { refused = error; }
    check(refused && refused.statusCode === 409 && refused.code === 'ORDER_VALUE_NOT_RECONCILED', 'Preisaenderung: 409 ORDER_VALUE_NOT_RECONCILED', refused && `${refused.statusCode} ${refused.code}`);
    check(refused && /139,00/.test(refused.message) && /bestätigen/.test(refused.message), 'deutsche Meldung nennt Betrag und Bestätigung', refused && refused.message);
    stored = await readStored(legacyFeeId);
    check(money(stored.totalCost) === 139 && money(stored.services[0].price) === 100, 'nichts gespeichert (139,00 / Position 100,00)', `${stored.totalCost} / ${stored.services[0].price}`);
    let addonRefused = null;
    try { await OrderService.addAddonToOrder(legacyFeeId, { name: 'Express', price: 30 }, staff._id); } catch (error) { addonRefused = error; }
    check(addonRefused && addonRefused.statusCode === 409, 'Zusatzleistung auf Altauftrag: ebenfalls 409', addonRefused && `${addonRefused.statusCode} ${addonRefused.message}`);
    let productRefused = null;
    try { await OrderService.addShopProduct(legacyFeeId, String(huelle._id), 1, staff._id); } catch (error) { productRefused = error; }
    check(productRefused && productRefused.statusCode === 409, 'Produkt auf Altauftrag: ebenfalls 409', productRefused && `${productRefused.statusCode} ${productRefused.message}`);
    stored = await readStored(legacyFeeId);
    check(money(stored.totalCost) === 139 && (stored.addOns || []).length === 0 && (stored.shopProducts || []).length === 0, 'Altauftrag unveraendert', `${stored.totalCost}`);
    const addonHttp = await call('POST', `/api/admin/orders/${legacyFeeId}/addons`, staff, { name: 'Express', price: 30 });
    check(addonHttp.status === 409 && /bestätigen/.test(addonHttp.body?.error || ''), 'HTTP Zusatzleistung: 409 mit deutscher Meldung', `${addonHttp.status} ${addonHttp.body?.error}`);
    check(addonHttp.body?.code === 'ORDER_VALUE_NOT_RECONCILED', 'HTTP liefert code', addonHttp.body?.code);
    await OrderServiceManagementService.updateOrderService(legacyFeeId, legacyLineId, {
      price: 110, actorId: staff._id, reason: 'Gebühr geprüft', confirmRepricing: true,
    });
    stored = await readStored(legacyFeeId);
    check(money(stored.totalCost) === 110, 'nach Bestätigung neu berechnet = 110,00', stored.totalCost);
    const confirmRev = await OrderRevision.findOne({ orderId: legacyFeeId }).sort({ revisionNumber: -1 }).lean();
    check(confirmRev && /bestätigt/.test(confirmRev.notes || '') && /139,00/.test(confirmRev.notes || ''), 'Historie: Bestätigung und alter Wert festgehalten', confirmRev && confirmRev.notes);

    console.log('\n[5] Altauftrag: Auftragswert UNTER den Positionen ohne gespeicherten Rabatt');
    const legacyLow = await mongoose.connection.db.collection('orders').insertOne({
      orderNumber: 'ORD-LEGACY-LOW', customerId: privat._id,
      deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
      services: [{ _id: new mongoose.Types.ObjectId(), serviceId: display._id, price: 100, estimatedTime: 60, notes: '' }],
      addOns: [], shopProducts: [], totalCost: 80, discount: 0, status: 'pending', createdAt: new Date('2025-05-01'),
    });
    let lowRefused = null;
    try {
      await OrderServiceManagementService.addServiceToOrder(String(legacyLow.insertedId), String(akku._id), { actorId: staff._id });
    } catch (error) { lowRefused = error; }
    check(lowRefused && lowRefused.statusCode === 409, 'negativer Unterschied: ebenfalls 409 (kein stiller Verlust/Gewinn)', lowRefused && lowRefused.message);
    const lowHttp = await call('POST', `/api/order-services/${legacyLow.insertedId}`, staff, { serviceId: String(akku._id) });
    check(lowHttp.status === 409 && lowHttp.body?.code === 'ORDER_VALUE_NOT_RECONCILED', 'HTTP /api/order-services: 409 mit code', `${lowHttp.status} ${lowHttp.body?.code}`);
    check(/bestätigen/.test(lowHttp.body?.error || ''), 'HTTP /api/order-services: deutsche Meldung', lowHttp.body?.error);
    stored = await readStored(legacyLow.insertedId);
    check(stored.services.length === 1 && money(stored.totalCost) === 80, 'nichts gespeichert', `${stored.services.length} / ${stored.totalCost}`);

    console.log('\n[6] Altauftrag mit altem Haendlerrabatt (dealerDiscountPercent 10, discount 0)');
    const legacyDealer = await mongoose.connection.db.collection('orders').insertOne({
      orderNumber: 'ORD-LEGACY-DEALER', customerId: haendler._id,
      deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
      services: [{ _id: new mongoose.Types.ObjectId(), serviceId: display._id, price: 100, estimatedTime: 60, notes: '' }],
      addOns: [], shopProducts: [], totalCost: 100, discount: 0, dealerDiscountPercent: 10, dealerDiscountAmount: 10,
      status: 'pending', createdAt: new Date('2025-05-01'),
    });
    const beforeDealer = OrderService.buildOrderPricingSummary(await readStored(legacyDealer.insertedId));
    check(money(beforeDealer.grossTotal) === 90, 'vorher: Auftragswert 90,00', beforeDealer.grossTotal);
    await OrderServiceManagementService.addServiceToOrder(String(legacyDealer.insertedId), null, {
      isManual: true, name: 'Kleinteil', price: 0.01, actorId: staff._id,
    });
    stored = await readStored(legacyDealer.insertedId);
    const afterDealer = OrderService.buildOrderPricingSummary(stored);
    // 100,01 -> 10 % = 10,00 -> 90,01
    check(money(afterDealer.grossTotal) === 90.01, 'nachher: Haendlerrabatt bleibt (90,01 statt 100,01)', afterDealer.grossTotal);
    check(money(stored.pricingConditions?.groupDiscountPercent) === 10, 'Kondition 10 % aus eigenen Werten', stored.pricingConditions?.groupDiscountPercent);
    check(!stored.dealerDiscountPercent && !stored.dealerDiscountAmount, 'kein zweiter Abzug ueber dealerDiscount*', `${stored.dealerDiscountPercent}/${stored.dealerDiscountAmount}`);

    console.log('\n[7] POST /api/orders-Pfad: deutsche Meldungen');
    let missingCustomer = '';
    try {
      await OrderService.create({ customerId: new mongoose.Types.ObjectId(), deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone', services: [String(display._id)] });
    } catch (error) { missingCustomer = error.message; }
    check(/Kunde/.test(missingCustomer) && !/not found/i.test(missingCustomer), 'unbekannter Kunde: deutsche Meldung', missingCustomer);
    let missingTrustedService = '';
    try {
      await OrderService.create(
        { customerId: haendler._id, deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone', services: [String(new mongoose.Types.ObjectId())] },
        { trustedPricing: { totalCost: 1, discount: 0 } },
      );
    } catch (error) { missingTrustedService = error.message; }
    check(/Reparaturservice/.test(missingTrustedService) && !/not found/i.test(missingTrustedService), 'unbekannter Service (interner Pfad): deutsche Meldung', missingTrustedService);

    console.log('\n[8] Detailantwort: keine internen Konditionsdaten, kein Base64-Label');
    const labelOrder = await newDealerOrder();
    await Order.updateOne({ _id: labelOrder._id }, { $set: { shippingLabelUrl: 'data:application/pdf;base64,QUFBQUFBQUFBQUFB', trackingNumber: 'OUT-1' } });
    const customerView = await call('GET', `/api/orders/${labelOrder._id}`, haendler);
    check(customerView.status === 200, 'Kunde GET /api/orders/:id: HTTP 200', customerView.status);
    const pc = customerView.body?.order?.pricingConditions;
    check(!pc || (pc.customerGroupId === undefined && pc.customerGroupName === undefined && pc.source === undefined), 'Kunde: keine internen Konditionsfelder', JSON.stringify(pc));
    check(money(customerView.body?.order?.pricing?.groupDiscountPercent) === 10, 'Kunde: Rabatt in Prozent weiterhin in pricing', customerView.body?.order?.pricing?.groupDiscountPercent);
    const adminView = await call('GET', `/api/admin/orders/${labelOrder._id}`, staff);
    check(adminView.status === 200, 'Personal GET /api/admin/orders/:id: HTTP 200', adminView.status);
    check(!/base64/.test(JSON.stringify(adminView.body || {})), 'Admin-Detail: kein Base64-Label in der Antwort', (JSON.stringify(adminView.body || {}).match(/base64[^"]{0,20}/) || ['-'])[0]);
    check(adminView.body?.order?.hasShippingLabel === true, 'Admin-Detail: hasShippingLabel = true', adminView.body?.order?.hasShippingLabel);
    const withLabel = await OrderService.getById(String(labelOrder._id), { includeLabelData: true });
    check(/^data:application\/pdf;base64,/.test(withLabel.shippingLabelUrl || ''), 'includeLabelData liefert das Label fuer den Download', (withLabel.shippingLabelUrl || '').slice(0, 30));
    const download = await fetch(`${baseUrl}/api/orders/${labelOrder._id}/shipping-label`, { headers: { Authorization: `Bearer ${tokenFor(haendler)}` } });
    check(download.status === 200 && /pdf/.test(download.headers.get('content-type') || ''), 'Label-Download GET /api/orders/:id/shipping-label funktioniert weiterhin', `${download.status} ${download.headers.get('content-type')}`);
    const staffDetail = await OrderService.getById(String(labelOrder._id), { audience: 'staff' });
    check(staffDetail.pricingConditions && staffDetail.pricingConditions.source === 'customer', 'Personal-Ansicht behaelt die Herkunft', staffDetail.pricingConditions && staffDetail.pricingConditions.source);

    console.log('\n[9] Geraetewechsel ueber HTTP: Grund + Warnungen');
    const devOrder = await newDealerOrder();
    const devLine = String((await readStored(devOrder._id)).services[0]._id);
    const devRes = await call('POST', `/api/admin/orders/${devOrder._id}/change-device`, staff, {
      deviceBrand: 'Apple', deviceModel: 'iPhone 15 Pro', deviceType: 'Smartphone',
      serviceReplacements: [{ oldOrderServiceId: devLine, newServiceId: String(displayPro._id) }],
      reason: 'Kunde hat ein Pro-Modell eingeschickt',
    });
    check(devRes.status === 200, 'HTTP 200', `${devRes.status} ${devRes.body?.error || ''}`);
    check(Array.isArray(devRes.body?.warnings), 'Antwort enthaelt warnings[]', JSON.stringify(devRes.body?.warnings));
    check(!/successfully/i.test(devRes.body?.message || ''), 'Antwortmeldung deutsch', devRes.body?.message);
    stored = await readStored(devOrder._id);
    // 150 -> 15 -> 135
    check(money(stored.totalCost) === 135, 'Auftragswert 135,00', stored.totalCost);
    const devRev = await OrderRevision.findOne({ orderId: devOrder._id, triggerReason: 'device_change' }).lean();
    check(devRev && /Pro-Modell eingeschickt/.test(devRev.notes || ''), 'Grund in der Historie', devRev && devRev.notes);
    const devErr = await call('POST', `/api/admin/orders/${new mongoose.Types.ObjectId()}/change-device`, staff, { deviceBrand: 'Apple', deviceModel: 'X', deviceType: 'Smartphone' });
    check(devErr.status === 404 && /Auftrag/.test(devErr.body?.error || ''), 'unbekannter Auftrag: 404 deutsch', `${devErr.status} ${devErr.body?.error}`);

    console.log('\n[10] Reparaturanfrage -> Auftrag nach der Preisregel');
    const request = await RepairRequest.create({
      requestNumber: 'RR-OVB-1', customerId: haendler._id, customerName: 'Haendler OVB', customerEmail: 'ovb-haendler@test.invalid', customerPhone: '0301234567',
      deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 15', issueDescription: 'Display', estimatedCost: 80,
    }).catch((error) => { console.log('  INFO RepairRequest-Anlage:', error.message); return null; });
    if (request) {
      const { order: rrOrder } = await RepairRequestService.convertToOrder(String(request._id), { services: [String(display._id)], totalCost: 1 }, staff._id, 'Sophie OVB');
      stored = await readStored(rrOrder._id);
      check(money(stored.totalCost) === 90 && money(stored.discount) === 10, 'Auftragswert 90,00 / Rabatt 10,00 (nicht 1,00 oder 80,00)', `${stored.totalCost} / ${stored.discount}`);
      check(money(stored.pricingConditions?.groupDiscountPercent) === 10, 'Konditionen-Snapshot 10 %', stored.pricingConditions?.groupDiscountPercent);
    } else {
      check(false, 'Reparaturanfrage konnte angelegt werden', 'Modellvalidierung');
    }

    console.log('\n[11] Reklamation abgelehnt OHNE Reklamationsauftrag, Original bereits berechnet');
    const original = await newDealerOrder();
    await Order.updateOne({ _id: original._id }, { $set: { status: 'completed' } });
    const originalInvoice = await FinancialService.createInvoiceFromOrder(String(original._id));
    const complaintA = await Complaint.create({
      customerId: haendler._id, orderId: original._id, subject: 'Display flackert', description: 'Flackern', category: 'quality',
      status: 'denied', repairOffer: { amount: 80, description: 'Neues Display', status: 'pending', createdAt: new Date() },
    });
    const rejectA = await call('POST', `/api/complaints/${complaintA._id}/reject-offer`, haendler, { serviceFee: 0.01 });
    check(rejectA.status === 200, 'HTTP 200 (kein stiller Abbruch an der Doppelrechnungssperre)', `${rejectA.status} ${rejectA.body?.error || ''}`);
    check(rejectA.body?.invoice && money(rejectA.body.invoice.total) === 39, 'Rechnung ueber die Servicepauschale 39,00 (Kundenwert 0,01 ignoriert)', rejectA.body?.invoice && rejectA.body.invoice.total);
    const originalAfter = await readStored(original._id);
    check(money(originalAfter.totalCost) === 90 && (originalAfter.addOns || []).length === 0, 'Originalauftrag unveraendert (90,00, keine Pauschale)', `${originalAfter.totalCost}`);
    const originalInvoiceAfter = await Invoice.findById(originalInvoice._id).lean();
    check(money(originalInvoiceAfter.total) === money(originalInvoice.total), 'Originalrechnung unveraendert', `${originalInvoiceAfter.total}`);
    const complaintAAfter = await Complaint.findById(complaintA._id).setOptions({ skipAutoPopulate: true }).lean();
    if (complaintAAfter.newOrderId && complaintAAfter.newOrderId._id) complaintAAfter.newOrderId = complaintAAfter.newOrderId._id;
    check(Boolean(complaintAAfter.newOrderId), 'Reklamationsauftrag wurde angelegt und verknuepft', complaintAAfter.newOrderId);
    check(complaintAAfter.status === 'awaiting_payment' && money(complaintAAfter.serviceFee) === 39, 'Reklamation wartet auf Zahlung, Pauschale 39,00', `${complaintAAfter.status} / ${complaintAAfter.serviceFee}`);
    if (complaintAAfter.newOrderId) {
      const followUp = await readStored(complaintAAfter.newOrderId);
      check((followUp.addOns || []).some((a) => /Servicepauschale/.test(a.name) && money(a.price) === 39), 'Pauschale ist eine Position (Zusatzleistung)', JSON.stringify((followUp.addOns || []).map((a) => [a.name, a.price])));
      check(money(followUp.totalCost) === 39 && money(followUp.discount) === 0, 'Wert des Reklamationsauftrags = 39,00', `${followUp.totalCost}/${followUp.discount}`);
      checkRuleInvariant('[11] Reklamationsauftrag', followUp);
      const invoiceOrderId = rejectA.body?.invoice?.orderId?._id || rejectA.body?.invoice?.orderId || '';
      check(String(invoiceOrderId) === String(complaintAAfter.newOrderId), 'Rechnung gehoert zum Reklamationsauftrag', String(invoiceOrderId));
    }

    console.log('\n[12] Reklamationsauftrag: angenommenes Angebot ist eine Position und ueberlebt eine Bearbeitung');
    const original2 = await newDealerOrder();
    const followUp2 = await Order.create({
      customerId: haendler._id, deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
      services: [{ serviceId: display._id, name: 'Displaytausch', price: 100, estimatedTime: 60 }],
      totalCost: 90, discount: 10, isComplaintFollowup: true, parentOrderId: original2._id, status: 'pending',
    });
    const complaintB = await Complaint.create({
      customerId: haendler._id, orderId: original2._id, newOrderId: followUp2._id, subject: 'Akku', description: 'Akku schwach',
      category: 'quality', status: 'denied', repairOffer: { amount: 80, description: 'Neuer Akku inkl. Einbau', status: 'pending', createdAt: new Date() },
    });
    const acceptB = await call('POST', `/api/complaints/${complaintB._id}/accept-offer`, haendler);
    check(acceptB.status === 200, 'Angebot angenommen: HTTP 200', `${acceptB.status} ${acceptB.body?.error || ''}`);
    stored = await readStored(followUp2._id);
    check(money(stored.totalCost) === 80 && money(stored.discount) === 0, 'Wert = Angebot 80,00', `${stored.totalCost}/${stored.discount}`);
    check(stored.services.length === 1 && stored.services[0].isManual && money(stored.services[0].price) === 80, 'Angebot als (manuelle) Position', JSON.stringify(stored.services.map((s) => [s.name, s.price])));
    checkRuleInvariant('[12] nach Annahme', stored);
    const acceptRev = await OrderRevision.findOne({ orderId: followUp2._id }).sort({ revisionNumber: -1 }).lean();
    check(acceptRev && /Reparaturangebot angenommen/.test(acceptRev.notes || '') && /Displaytausch/.test(acceptRev.notes || ''), 'Historie: Annahme und ersetzte Positionen festgehalten', acceptRev && acceptRev.notes);
    await OrderService.addAddonToOrder(String(followUp2._id), { name: 'Expressbearbeitung', price: 30 }, staff._id);
    stored = await readStored(followUp2._id);
    check(money(stored.totalCost) === 110, 'spaetere Bearbeitung: 80,00 + 30,00 = 110,00 (Angebot bleibt)', stored.totalCost);

    console.log('\n[13] Reklamationslabel wird ausdruecklich als Einsendung angefordert (DHL gemockt)');
    const original3 = await newDealerOrder();
    const complaintC = await Complaint.create({
      customerId: haendler._id, orderId: original3._id, subject: 'Kamera', description: 'Kamera unscharf', category: 'quality', status: 'pending_approval',
    });
    const approveC = await call('PATCH', `/api/complaints/${complaintC._id}/approve`, admin);
    check(approveC.status === 200, 'Freigabe: HTTP 200 (Mock-Label)', `${approveC.status} ${approveC.body?.error || ''}`);
    const labelCall = capturedShipments[capturedShipments.length - 1];
    check(labelCall && labelCall.data && labelCall.data.labelDirection === 'inbound', 'createShipment mit labelDirection inbound', labelCall && JSON.stringify(labelCall.data && labelCall.data.labelDirection));
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
