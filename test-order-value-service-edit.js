/**
 * T02 - Regressionstest: Auftragswert beim Hinzufuegen / Aendern / Loeschen von Services.
 *
 * Geschaeftsregel (brutto-first):
 *   Kunde mit 10 % Haendlerrabatt, Standardservice 100,00 EUR brutto
 *     -> Rabatt 10,00, Auftragswert 90,00 (netto 75,63 + MwSt 14,37)
 *   Weiterer Standardservice 50,00 EUR
 *     -> Positionen 150,00, Rabatt 15,00, Auftragswert 135,00
 *   Preisaenderung und Loeschen folgen derselben Regel.
 *
 * Abgesicherte Invarianten:
 *   1. Der Kundengruppen-/Haendlerrabatt ueberlebt jede Positionsbearbeitung.
 *   2. netAmount + taxAmount === totalCost (der Rabatt wird GENAU EINMAL abgezogen).
 *   3. Produkte, Zusatzleistungen und Mengen bleiben im Auftragswert enthalten.
 *   4. Die Konditionen sind ZEITGEBUNDEN: eine spaetere Aenderung der Kundengruppe
 *      schreibt den Preis einer alten Buchung nicht um.
 *   5. Katalogpreisaenderungen aendern gespeicherte Positionspreise nicht.
 *   6. Jede Aenderung landet mit Verursacher, Zeitpunkt, vorher/nachher und Grund
 *      in der Auftragshistorie.
 *   7. Rechnungsbrutto === order.totalCost (Zusammenspiel mit T23) - fuer JEDEN
 *      Schreiber des Auftragswerts (Anlage, Checkout-Anlage, Service hinzufuegen /
 *      aendern / loeschen, manuelle Position, Zusatzleistung, Altauftrag).
 *   8. POST /api/orders (OrderService.create ohne interne Option) ignoriert vom Client
 *      gelieferte Summen/Rabatte/Positionspreise und rechnet selbst (Manipulationsschutz).
 *   9. Der Checkout reicht seine vertrauenswuerdige Preisbildung nur ueber die
 *      INTERNE Option von OrderService.create durch, nie ueber den Request-Body.
 *  10. Manuelle Reparaturposition: freier Name, Standardpreis brutto, keine erfundene
 *      Katalog-ID, Kundenkonditionen greifen automatisch.
 *
 * Aufruf (benoetigt eine WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t02 node test-order-value-service-edit.js
 */
const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(__dirname, 'server/node_modules/mongoose'));

const MODELS_DIR = path.join(__dirname, 'server/models');
const SERVICES_DIR = path.join(__dirname, 'server/services');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t02_order_value';

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

  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  fs.readdirSync(MODELS_DIR)
    .filter((file) => file.endsWith('.js'))
    .forEach((file) => {
      try {
        require(path.join(MODELS_DIR, file));
      } catch (error) {
        /* Modelle mit optionalen Abhaengigkeiten ueberspringen */
      }
    });

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Service = mongoose.model('Service');
  const OrderRevision = mongoose.model('OrderRevision');
  const OrderService = require(path.join(SERVICES_DIR, 'orderService'));
  const OrderServiceManagementService = require(path.join(SERVICES_DIR, 'orderServiceManagementService'));
  const FinancialService = require(path.join(SERVICES_DIR, 'financialService'));
  const NotificationService = require(path.join(SERVICES_DIR, 'notificationService'));
  const AddOnService = mongoose.model('AddOnService');

  // Benachrichtigungen werden abgefangen (MOCK): es darf keine echte Kunden-E-Mail
  // rausgehen. Festgehalten wird nur, DASS und WAS versendet worden waere.
  const sentNotifications = [];
  NotificationService.createNotification = async (data) => {
    sentNotifications.push(data);
    return { _id: new mongoose.Types.ObjectId(), ...data };
  };

  const invoiceMatchesOrder = async (label, orderIdToInvoice) => {
    await Order.updateOne({ _id: orderIdToInvoice }, { $set: { status: 'completed' } });
    const inv = await FinancialService.generateFromRepairOrders([String(orderIdToInvoice)], {});
    const raw = await readStored(orderIdToInvoice);
    check(
      money(inv.total) === money(raw.totalCost),
      `${label}: Rechnungsbrutto === Auftragswert`,
      `${inv.total} === ${raw.totalCost}`,
    );
    return inv;
  };

  // Rohdaten aus der Datenbank lesen - ohne Hooks, ohne populate, ohne Service-Schicht.
  const readStored = async (orderId) =>
    mongoose.connection.db.collection('orders').findOne({ _id: new mongoose.Types.ObjectId(String(orderId)) });

  const haendler = await User.create({
    name: 'Testkunde Haendler',
    email: 't02-haendler@test.invalid',
    role: 'customer',
    customerNumber: 'K-T02',
    discount: 10,
  });

  const staff = await User.create({
    name: 'Sophie Mitarbeiterin',
    email: 't02-staff@test.invalid',
    role: 'staff',
  });

  const displayService = await Service.create({
    name: 'Displaytausch',
    description: 'Displaytausch',
    category: 'display',
    price: 100,
    estimatedTime: '60',
    manufacturerPrecise: 'Apple',
    modelPrecise: 'iPhone 15',
    deviceTypes: ['Smartphone'],
  });

  const akkuService = await Service.create({
    name: 'Akkutausch',
    description: 'Akkutausch',
    category: 'battery',
    price: 50,
    estimatedTime: '30',
    manufacturerPrecise: 'Apple',
    modelPrecise: 'iPhone 15',
    deviceTypes: ['Smartphone'],
  });

  // Katalogservice OHNE gepflegte Zeitangabe - im Bestand vorhanden.
  const diagnoseService = await Service.create({
    name: 'Diagnose',
    description: 'Diagnose',
    category: 'diagnostic',
    price: 20,
    estimatedTime: '',
    manufacturerPrecise: 'Apple',
    modelPrecise: 'iPhone 15',
    deviceTypes: ['Smartphone'],
  });

  // Auftrag genau so, wie ihn der Checkout anlegt: Liste 100,00, Gruppenrabatt 10 %,
  // totalCost ist BRUTTO NACH Rabatt, discount ist der bereits verrechnete Rabatt.
  const order = await OrderService.create({
    customerId: haendler._id,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 15',
    deviceType: 'Smartphone',
    errorDescription: 'Display gebrochen',
    services: [{ serviceId: displayService._id, price: 100, estimatedTime: 60 }],
    totalCost: 90,
    discount: 10,
    status: 'pending',
  });
  const orderId = String(order._id);

  console.log('\n[1] Ausgangslage: 100,00 Liste - 10 % = 90,00');
  let stored = await readStored(orderId);
  check(money(stored.totalCost) === 90, 'gespeicherter Auftragswert = 90,00', stored.totalCost);
  check(money(stored.discount) === 10, 'gespeicherter Rabatt = 10,00', stored.discount);
  check(money(stored.netAmount) === 75.63, 'gespeichertes Netto = 75,63', stored.netAmount);
  check(money(stored.taxAmount) === 14.37, 'gespeicherte MwSt = 14,37', stored.taxAmount);
  check(
    money(stored.netAmount + stored.taxAmount) === money(stored.totalCost),
    'Netto + MwSt === Auftragswert',
    `${stored.netAmount} + ${stored.taxAmount} = ${money(stored.netAmount + stored.taxAmount)}`,
  );
  check(
    money(stored.pricingConditions?.groupDiscountPercent) === 10,
    'Konditionen-Snapshot: 10 % festgehalten',
    JSON.stringify(stored.pricingConditions || null),
  );
  check(
    Boolean(stored.pricingConditions?.appliedAt),
    'Konditionen-Snapshot: Zeitpunkt festgehalten',
    stored.pricingConditions?.appliedAt,
  );

  console.log('\n[2] Service hinzufuegen (50,00 Liste) -> 150,00 - 15,00 = 135,00');
  await OrderServiceManagementService.addServiceToOrder(orderId, String(akkuService._id), {
    price: 50,
    estimatedTime: 30,
    actorId: staff._id,
    reason: 'Akku bei der Diagnose als defekt erkannt',
  });
  stored = await readStored(orderId);
  const positions2 = money((stored.services || []).reduce((sum, s) => sum + Number(s.price || 0), 0));
  check(positions2 === 150, 'Positionen (Listenpreise) = 150,00', positions2);
  check(money(stored.discount) === 15, 'Rabatt neu berechnet = 15,00', stored.discount);
  check(money(stored.totalCost) === 135, 'Auftragswert = 135,00', stored.totalCost);
  check(money(stored.netAmount) === 113.45, 'Netto = 113,45', stored.netAmount);
  check(money(stored.taxAmount) === 21.55, 'MwSt = 21,55', stored.taxAmount);
  check(
    money(stored.netAmount + stored.taxAmount) === money(stored.totalCost),
    'Netto + MwSt === Auftragswert',
    `${money(stored.netAmount + stored.taxAmount)} === ${stored.totalCost}`,
  );

  console.log('\n[2b] Lese-API liefert dieselben Werte');
  const readBack = await OrderServiceManagementService.getOrderServicesWithPricing(orderId);
  check(money(readBack.pricing.positionsGross) === 150, 'API Zwischensumme = 150,00', readBack.pricing.positionsGross);
  check(money(readBack.pricing.discount) === 15, 'API Rabatt = 15,00', readBack.pricing.discount);
  check(money(readBack.pricing.grossTotal) === 135, 'API Brutto = 135,00', readBack.pricing.grossTotal);
  check(money(readBack.pricing.netTotal) === 113.45, 'API Netto = 113,45', readBack.pricing.netTotal);
  check(readBack.pricing.positionsReconcile === true, 'API Positionen stimmen mit Gesamt ueberein', readBack.pricing.positionsReconcile);
  check(readBack.services.length === 2, 'API liefert 2 Positionen', readBack.services.length);

  console.log('\n[3] Preisaenderung: Display 100,00 -> 120,00 -> 170,00 - 17,00 = 153,00');
  const displayLine = (await Order.findById(orderId)).services.find(
    (s) => String(s.serviceId?._id || s.serviceId) === String(displayService._id),
  );
  await OrderServiceManagementService.updateOrderService(orderId, String(displayLine._id), {
    price: 120,
    actorId: staff._id,
    reason: 'Aufpreis Originaldisplay',
  });
  stored = await readStored(orderId);
  check(money(stored.discount) === 17, 'Rabatt = 17,00', stored.discount);
  check(money(stored.totalCost) === 153, 'Auftragswert = 153,00', stored.totalCost);
  check(
    money(stored.netAmount + stored.taxAmount) === 153,
    'Netto + MwSt === 153,00',
    money(stored.netAmount + stored.taxAmount),
  );

  console.log('\n[4] Service loeschen (Akku) -> 120,00 - 12,00 = 108,00');
  const akkuLine = (await Order.findById(orderId)).services.find(
    (s) => String(s.serviceId?._id || s.serviceId) === String(akkuService._id),
  );
  await OrderServiceManagementService.removeServiceFromOrder(orderId, String(akkuLine._id), {
    actorId: staff._id,
    reason: 'Kunde moechte den Akku doch behalten',
  });
  stored = await readStored(orderId);
  check(stored.services.length === 1, 'nur noch 1 Position', stored.services.length);
  check(money(stored.discount) === 12, 'Rabatt = 12,00', stored.discount);
  check(money(stored.totalCost) === 108, 'Auftragswert = 108,00', stored.totalCost);

  console.log('\n[5] Zusatzleistungen und Produkte bleiben im Auftragswert');
  const orderDoc = await Order.findById(orderId);
  orderDoc.addOns.push({ name: 'Expressbearbeitung', price: 30 });
  orderDoc.shopProducts.push({
    productId: new mongoose.Types.ObjectId(),
    quantity: 2,
    priceAtOrder: 10,
  });
  await orderDoc.save();
  // Zusatz/Produkt wurden hier bewusst OHNE Neuberechnung direkt gespeichert (wie es
  // fruehere Schreiber getan haben): gespeicherter Wert 108,00 passt nicht mehr zu den
  // Positionen 170,00 - 12,00. Eine stille Neuberechnung ist nicht erlaubt (Track
  // order-value-b, MAJOR 2): erst nach ausdruecklicher Bestaetigung.
  let notReconciledError = null;
  try {
    await OrderServiceManagementService.addServiceToOrder(orderId, String(diagnoseService._id), {
      actorId: staff._id,
      reason: 'Diagnose berechnet',
    });
  } catch (error) {
    notReconciledError = error;
  }
  check(
    notReconciledError && notReconciledError.statusCode === 409 && notReconciledError.code === 'ORDER_VALUE_NOT_RECONCILED',
    'nicht aufgehender Auftrag wird ohne Bestaetigung nicht neu berechnet (409, deutsch)',
    notReconciledError ? notReconciledError.message : 'kein Fehler',
  );
  // Positionen jetzt: 120 Service + 30 Zusatz + 2 x 10 Produkt = 170,00 -> Rabatt 17,00 -> 153,00
  await OrderServiceManagementService.addServiceToOrder(orderId, String(diagnoseService._id), {
    actorId: staff._id,
    reason: 'Diagnose berechnet',
    confirmRepricing: true,
  });
  stored = await readStored(orderId);
  const positions5 = money(
    (stored.services || []).reduce((sum, s) => sum + Number(s.price || 0), 0) +
      (stored.addOns || []).reduce((sum, a) => sum + Number(a.price || 0), 0) +
      (stored.shopProducts || []).reduce((sum, p) => sum + Number(p.priceAtOrder || 0) * Number(p.quantity || 0), 0),
  );
  check(positions5 === 190, 'Positionen inkl. Zusatz + Produkte = 190,00', positions5);
  check(money(stored.discount) === 19, 'Rabatt = 19,00', stored.discount);
  check(money(stored.totalCost) === 171, 'Auftragswert = 171,00', stored.totalCost);
  check((stored.shopProducts || []).length === 1, 'Produkt ueberlebt die Bearbeitung', (stored.shopProducts || []).length);
  check((stored.addOns || []).length === 1, 'Zusatzleistung ueberlebt die Bearbeitung', (stored.addOns || []).length);
  check(
    (stored.services || []).every((s) => Number(s.estimatedTime) >= 0),
    'Katalogservice ohne gepflegte Zeit laesst sich hinzufuegen',
    JSON.stringify((stored.services || []).map((s) => s.estimatedTime)),
  );

  console.log('\n[6] Historie: wer, wann, vorher/nachher, Grund');
  const revisions = await OrderRevision.find({ orderId }).sort({ revisionNumber: 1 }).lean();
  const editRevisions = revisions.filter((rev) => rev.triggerReason !== 'initial_creation');
  check(editRevisions.length >= 4, 'mindestens 4 Aenderungssaetze historisiert', editRevisions.length);
  check(
    editRevisions.every((rev) => String(rev.changedBy) === String(staff._id)),
    'Verursacher festgehalten',
    editRevisions.map((rev) => String(rev.changedBy)).join(','),
  );
  check(
    editRevisions.every((rev) => rev.changedByName && rev.changedByName !== 'System'),
    'Name des Verursachers festgehalten',
    editRevisions.map((rev) => rev.changedByName).join(' | '),
  );
  check(
    editRevisions.some((rev) => /Akku bei der Diagnose/.test(rev.notes || '')),
    'Grund der Aenderung festgehalten',
    editRevisions.map((rev) => rev.notes).join(' | '),
  );
  const addRevision = editRevisions.find((rev) => money(rev.newGrossAmount) === 135);
  check(
    addRevision && money(addRevision.previousGrossAmount) === 90,
    'vorher 90,00 -> nachher 135,00 historisiert',
    addRevision ? `${addRevision.previousGrossAmount} -> ${addRevision.newGrossAmount}` : 'kein Satz',
  );

  console.log('\n[7] Konditionen sind zeitgebunden');
  await User.updateOne({ _id: haendler._id }, { $set: { discount: 30 } });
  await OrderServiceManagementService.updateOrderService(orderId, String(displayLine._id), {
    price: 120,
    actorId: staff._id,
    reason: 'Erneut gespeichert nach Gruppenwechsel',
  });
  stored = await readStored(orderId);
  check(money(stored.discount) === 19, 'alter Auftrag behaelt 10 % (Rabatt 19,00)', stored.discount);
  check(money(stored.totalCost) === 171, 'alter Auftrag behaelt 171,00', stored.totalCost);

  console.log('\n[8] Katalogpreisaenderung aendert gespeicherte Positionen nicht');
  await Service.updateOne({ _id: akkuService._id }, { $set: { price: 999 } });
  await Service.updateOne({ _id: displayService._id }, { $set: { price: 999 } });
  stored = await readStored(orderId);
  const displayStored = (stored.services || []).find(
    (s) => String(s.serviceId) === String(displayService._id),
  );
  check(money(displayStored?.price) === 120, 'Positionspreis bleibt 120,00', displayStored?.price);
  check(money(stored.totalCost) === 171, 'Auftragswert bleibt 171,00', stored.totalCost);

  console.log('\n[9] Rechnungsbrutto === Auftragswert (Zusammenspiel mit T23)');
  await Order.updateOne({ _id: orderId }, { $set: { status: 'completed' } });
  const invoice = await FinancialService.generateFromRepairOrders([orderId], {});
  stored = await readStored(orderId);
  check(
    money(invoice.total) === money(stored.totalCost),
    'Rechnungsbrutto === Auftragswert',
    `${invoice.total} === ${stored.totalCost}`,
  );

  console.log('\n[10] Benachrichtigung an den Kunden wird wirklich ausgeloest (Mock)');
  check(sentNotifications.length >= 4, 'Benachrichtigungen fuer die Bearbeitungen erzeugt', sentNotifications.length);
  check(
    sentNotifications.every((n) => String(n.userId) === String(haendler._id)),
    'Empfaenger ist der Kunde des Auftrags',
    sentNotifications.map((n) => String(n.userId)).join(','),
  );
  check(
    sentNotifications.some((n) => /hinzugefügt/.test(n.message || '')),
    'deutscher Text mit Umlaut',
    sentNotifications.map((n) => n.message).join(' | '),
  );

  await AddOnService.create({
    name: 'Expressbearbeitung',
    description: 'Bearbeitung innerhalb von 24 Stunden',
    price: 30,
    estimatedTime: '0',
    category: 'service',
  });

  // [7] hat den Kunden auf 30 % gesetzt - fuer die folgenden NEUEN Auftraege gilt
  // wieder die aktuelle Kondition von 10 %.
  await User.updateOne({ _id: haendler._id }, { $set: { discount: 10 } });
  // [8] hat die Katalogpreise auf 999 gesetzt - fuer NEUE Auftraege wieder Listenpreise.
  await Service.updateOne({ _id: displayService._id }, { $set: { price: 100 } });
  await Service.updateOne({ _id: akkuService._id }, { $set: { price: 50 } });

  console.log('\n[11] POST /api/orders-Pfad: manipulierte Summen werden ignoriert');
  // Genau das, was ein Client an POST /api/orders schicken koennte.
  const tampered = await OrderService.create({
    customerId: haendler._id,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 15',
    deviceType: 'Smartphone',
    errorDescription: 'Manipulationsversuch',
    services: [{ serviceId: displayService._id, price: 1, estimatedTime: 60 }],
    addOns: [{ name: 'Expressbearbeitung', price: 0.01 }],
    totalCost: 1,
    discount: 0,
    dealerDiscountPercent: 50,
    netAmount: 0.5,
    paymentStatus: 'paid',
    pricingConditions: { groupDiscountPercent: 99, appliedAt: new Date('2020-01-01') },
    trustedPricing: { totalCost: 1, discount: 0 },
  });
  stored = await readStored(tampered._id);
  // Positionen: Display 100 (Katalog) + Express 30 (Katalog) = 130 -> 10 % = 13 -> 117
  check(money(stored.services[0].price) === 100, 'Positionspreis aus dem Katalog (nicht 1,00)', stored.services[0].price);
  check(money(stored.addOns[0].price) === 30, 'Zusatzleistung aus dem Katalog (nicht 0,01)', stored.addOns[0].price);
  check(money(stored.discount) === 13, 'Rabatt serverseitig = 13,00', stored.discount);
  check(money(stored.totalCost) === 117, 'Auftragswert serverseitig = 117,00 (nicht 1,00)', stored.totalCost);
  check(money(stored.netAmount + stored.taxAmount) === 117, 'Netto + MwSt === 117,00', money(stored.netAmount + stored.taxAmount));
  check(!stored.dealerDiscountPercent, 'Client-Haendlerrabatt ignoriert', stored.dealerDiscountPercent);
  check(stored.paymentStatus === 'pending', 'Client kann sich nicht selbst "bezahlt" setzen', stored.paymentStatus);
  check(money(stored.pricingConditions?.groupDiscountPercent) === 10, 'Konditionen aus dem Kundenstamm (nicht 99 %)', stored.pricingConditions?.groupDiscountPercent);
  await invoiceMatchesOrder('[11] POST /api/orders', tampered._id);

  let manualByClientError = '';
  try {
    await OrderService.create({
      customerId: haendler._id,
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 15',
      deviceType: 'Smartphone',
      services: [{ isManual: true, name: 'Gratisreparatur', price: 0, estimatedTime: 0 }],
      totalCost: 0,
    });
  } catch (error) {
    manualByClientError = error.message;
  }
  check(/manuell/i.test(manualByClientError), 'Client darf keine manuelle Position mit eigenem Preis anlegen', manualByClientError || 'kein Fehler');

  console.log('\n[12] Checkout-Pfad: vertrauenswuerdige Preisbildung nur ueber die interne Option');
  // Checkout: Liste 100, Aktionscode 5,00 fest + 10 % auf 95,00 = 9,50 -> Rabatt 14,50 -> 85,50
  const checkoutOrder = await OrderService.create(
    {
      customerId: haendler._id,
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 15',
      deviceType: 'Smartphone',
      errorDescription: 'Checkout',
      services: [{ serviceId: displayService._id, price: 100, estimatedTime: 60 }],
      totalCost: 85.5,
      discount: 14.5,
      appliedPromoCode: 'SOMMER5',
      status: 'pending',
    },
    { trustedPricing: { totalCost: 85.5, discount: 14.5, promoDiscountAmount: 5, groupDiscountPercent: 10 } },
  );
  stored = await readStored(checkoutOrder._id);
  check(money(stored.totalCost) === 85.5, 'Checkout-Wert unveraendert uebernommen = 85,50', stored.totalCost);
  check(money(stored.discount) === 14.5, 'Checkout-Rabatt unveraendert = 14,50', stored.discount);
  check(money(stored.pricingConditions?.promoDiscountAmount) === 5, 'Aktionsrabatt als fester Betrag festgehalten', stored.pricingConditions?.promoDiscountAmount);
  check(money(stored.pricingConditions?.groupDiscountPercent) === 10, 'Gruppenrabatt 10 % festgehalten', stored.pricingConditions?.groupDiscountPercent);
  await OrderServiceManagementService.addServiceToOrder(String(checkoutOrder._id), String(akkuService._id), {
    price: 50,
    estimatedTime: 30,
    actorId: staff._id,
    reason: 'Akku zusaetzlich',
  });
  stored = await readStored(checkoutOrder._id);
  // 150 -> Aktion 5,00 bleibt fest, 10 % auf 145,00 = 14,50 -> Rabatt 19,50 -> 130,50
  check(money(stored.discount) === 19.5, 'Aktion fest + Prozent neu = 19,50', stored.discount);
  check(money(stored.totalCost) === 130.5, 'Auftragswert = 130,50', stored.totalCost);
  await invoiceMatchesOrder('[12] Checkout + Bearbeitung', checkoutOrder._id);

  console.log('\n[13] Manuelle Reparaturposition');
  const manualOrder = await OrderService.create({
    customerId: haendler._id,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 15',
    deviceType: 'Smartphone',
    errorDescription: 'Platine',
    services: [String(displayService._id)],
  });
  const manualOrderId = String(manualOrder._id);
  let manualNoNameError = '';
  try {
    await OrderServiceManagementService.addServiceToOrder(manualOrderId, null, {
      isManual: true,
      name: '   ',
      price: 100,
      actorId: staff._id,
    });
  } catch (error) {
    manualNoNameError = error.message;
  }
  check(/Namen/.test(manualNoNameError), 'manuelle Position ohne Namen wird abgelehnt (deutsch)', manualNoNameError || 'kein Fehler');
  await OrderServiceManagementService.addServiceToOrder(manualOrderId, null, {
    isManual: true,
    name: 'Platinenreparatur',
    description: 'Mikrolöten am Ladechip',
    price: 100,
    actorId: staff._id,
    reason: 'Zusatzarbeit nach Diagnose',
  });
  stored = await readStored(manualOrderId);
  const manualLine = (stored.services || []).find((s) => s.isManual === true);
  check(Boolean(manualLine), 'manuelle Position gespeichert', JSON.stringify(manualLine || null));
  check(manualLine && !manualLine.serviceId, 'keine erfundene Katalog-ID', manualLine && manualLine.serviceId);
  check(manualLine && manualLine.name === 'Platinenreparatur', 'Name gespeichert', manualLine && manualLine.name);
  check(manualLine && manualLine.description === 'Mikrolöten am Ladechip', 'Beschreibung gespeichert', manualLine && manualLine.description);
  check(manualLine && money(manualLine.price) === 100, 'Standardpreis brutto 100,00 gespeichert', manualLine && manualLine.price);
  // 100 Katalog + 100 manuell = 200 -> 10 % = 20 -> 180 (netto 151,26 + MwSt 28,74)
  check(money(stored.discount) === 20, 'Haendlerrabatt greift auch auf manuelle Position = 20,00', stored.discount);
  check(money(stored.totalCost) === 180, 'Auftragswert = 180,00', stored.totalCost);
  check(money(stored.netAmount) === 151.26, 'Netto = 151,26', stored.netAmount);
  check(money(stored.taxAmount) === 28.74, 'MwSt = 28,74', stored.taxAmount);
  const catalogLine = (stored.services || []).find((s) => !s.isManual);
  check(catalogLine && catalogLine.name === 'Displaytausch', 'Katalogposition traegt Namens-Snapshot', catalogLine && catalogLine.name);
  const manualRead = await OrderServiceManagementService.getOrderServicesWithPricing(manualOrderId);
  check(
    manualRead.services.some((s) => s.isManual && s.name === 'Platinenreparatur'),
    'Lese-API liefert die manuelle Position',
    manualRead.services.map((s) => s.name).join(','),
  );
  check(money(manualRead.pricing.groupDiscountPercent) === 10, 'Lese-API liefert Rabatt in Prozent', manualRead.pricing.groupDiscountPercent);
  await OrderServiceManagementService.updateOrderService(manualOrderId, String(manualLine._id), {
    price: 150,
    name: 'Platinenreparatur (aufwendig)',
    actorId: staff._id,
    reason: 'Mehraufwand',
  });
  stored = await readStored(manualOrderId);
  check(money(stored.totalCost) === 225, 'manuelle Position 150,00 -> 250 - 25 = 225,00', stored.totalCost);
  check(
    (stored.services || []).some((s) => s.isManual && s.name === 'Platinenreparatur (aufwendig)'),
    'Name der manuellen Position aenderbar',
    (stored.services || []).map((s) => s.name).join(','),
  );
  const manualInvoice = await invoiceMatchesOrder('[13] manuelle Position', manualOrderId);
  const manualItem = (manualInvoice.items || []).find((i) => money(i.total) === 150);
  // Nur INFO: der Positionsname auf der Rechnung haengt an financialService
  // (buildInvoiceItemsFromOrder, anderer Track) - siehe crossTrackNeeds.
  console.log(`  INFO Rechnungsposition der manuellen Zeile :: ${manualItem ? manualItem.serviceName : 'nicht gefunden'}`);

  console.log('\n[14] Zusatzleistung hinzufuegen haelt den Haendlerrabatt');
  const addonOrder = await OrderService.create({
    customerId: haendler._id,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 15',
    deviceType: 'Smartphone',
    services: [String(displayService._id)],
  });
  await OrderService.addAddonToOrder(String(addonOrder._id), { name: 'Expressbearbeitung', price: 30 }, staff._id);
  stored = await readStored(addonOrder._id);
  // 100 + 30 = 130 -> 13 -> 117
  check(money(stored.discount) === 13, 'Rabatt nach Zusatzleistung = 13,00', stored.discount);
  check(money(stored.totalCost) === 117, 'Auftragswert nach Zusatzleistung = 117,00', stored.totalCost);
  await invoiceMatchesOrder('[14] Zusatzleistung', addonOrder._id);

  console.log('\n[15] Altauftrag ohne Konditionen-Snapshot');
  // Direkt in die Collection geschrieben - so liegen Bestandsauftraege vor.
  const legacyInsert = await mongoose.connection.db.collection('orders').insertOne({
    orderNumber: 'ORD-LEGACY-001',
    customerId: haendler._id,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 15',
    deviceType: 'Smartphone',
    services: [{ _id: new mongoose.Types.ObjectId(), serviceId: displayService._id, price: 100, estimatedTime: 60, notes: '' }],
    addOns: [],
    shopProducts: [],
    totalCost: 85,
    discount: 15,
    status: 'pending',
    createdAt: new Date('2025-03-01'),
  });
  // Kunde hat heute 30 % - der Altauftrag lief mit 15 %.
  await User.updateOne({ _id: haendler._id }, { $set: { discount: 30 } });
  await OrderServiceManagementService.addServiceToOrder(String(legacyInsert.insertedId), String(akkuService._id), {
    price: 50,
    estimatedTime: 30,
    actorId: staff._id,
    reason: 'Altauftrag erweitert',
  });
  stored = await readStored(legacyInsert.insertedId);
  // 150 -> 15 % (aus dem Auftrag selbst abgeleitet, NICHT die heutigen 30 %) = 22,50 -> 127,50
  check(money(stored.discount) === 22.5, 'Altauftrag: Rabatt aus eigenen Werten = 22,50', stored.discount);
  check(money(stored.totalCost) === 127.5, 'Altauftrag: Auftragswert = 127,50', stored.totalCost);
  check(stored.pricingConditions?.source === 'legacy', 'Altauftrag: Herkunft "legacy" festgehalten', stored.pricingConditions?.source);
  await invoiceMatchesOrder('[15] Altauftrag', legacyInsert.insertedId);

  const legacyPromo = await mongoose.connection.db.collection('orders').insertOne({
    orderNumber: 'ORD-LEGACY-002',
    customerId: haendler._id,
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 15',
    deviceType: 'Smartphone',
    services: [{ _id: new mongoose.Types.ObjectId(), serviceId: displayService._id, price: 100, estimatedTime: 60, notes: '' }],
    addOns: [],
    shopProducts: [],
    totalCost: 90,
    discount: 10,
    appliedPromoCode: 'ALT10',
    status: 'pending',
    createdAt: new Date('2025-03-01'),
  });
  await OrderServiceManagementService.addServiceToOrder(String(legacyPromo.insertedId), String(akkuService._id), {
    price: 50,
    actorId: staff._id,
  });
  stored = await readStored(legacyPromo.insertedId);
  // Rabatt mit Aktionscode laesst sich nicht aufteilen -> bleibt fester Betrag 10,00 -> 140,00
  check(money(stored.discount) === 10, 'Altauftrag mit Aktionscode: Rabatt bleibt fest 10,00', stored.discount);
  check(money(stored.totalCost) === 140, 'Altauftrag mit Aktionscode: 140,00', stored.totalCost);

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
