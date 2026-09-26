/**
 * T23 - Regressionstest: Kundengruppenrabatt darf nur EINMAL angewandt werden.
 *
 * Hintergrund (Sophies Abnahmetest vom 24.09.2026, Auftrag ORD-2026-004):
 *   Warenkorb/Auftrag:  Liste 49,90 - Rabatt 7,48 = 42,42 EUR  (Haendler 15 %)
 *   Rechnung zeigte:    Rabatt 13,84 -> Brutto 36,06 / Netto 30,30 / MwSt 5,76
 *
 * Ursache: order.discount ist bereits der ausgerechnete Kundengruppenrabatt. Beim
 * Erzeugen der Rechnung wurde der Gruppenrabatt ein ZWEITES Mal prozentual auf das
 * schon geminderte Brutto gerechnet (7,48 + 15 % von 42,42 = 7,48 + 6,36 = 13,84).
 *
 * Invariante, die dieser Test absichert:
 *   Ohne ausdruecklichen Zusatzrabatt gilt  Rechnungsbrutto === Summe der Auftragswerte.
 *
 * Aufruf (benoetigt eine WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t23 node test-discount-double-application.js
 */
const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(__dirname, 'server/node_modules/mongoose'));

const MODELS_DIR = path.join(__dirname, 'server/models');
const SERVICES_DIR = path.join(__dirname, 'server/services');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t23_discount';

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

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }

  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  // Alle Modelle registrieren, damit die populate-Ketten des Service aufloesen.
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
  const FinancialService = require(path.join(SERVICES_DIR, 'financialService'));

  // Haendler mit 15 % Rabatt - genau die Konstellation aus dem Abnahmetest.
  const customer = await User.create({
    name: 'Testkunde Haendler',
    email: 'haendler@test.invalid',
    role: 'customer',
    customerNumber: 'K-T23',
    discount: 15,
  });

  const service = await Service.create({
    name: 'Diagnose',
    description: 'Diagnose',
    category: 'diagnostic',
    price: 49.9,
  });

  const makeOrder = async (orderNumber) =>
    Order.create({
      customerId: customer._id,
      orderNumber,
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 15',
      deviceType: 'Smartphone',
      errorDescription: 'Diagnose',
      services: [{ serviceId: service._id, name: 'Diagnose', price: 49.9, quantity: 1, estimatedTime: 30 }],
      // totalCost ist BRUTTO NACH Rabatt, discount ist der bereits verrechnete Rabatt.
      totalCost: 42.42,
      discount: 7.48,
      status: 'completed',
    });

  console.log('\n[Pfad 1] generateFromRepairOrders ohne manuellen Rabatt');
  const order1 = await makeOrder('ORD-T23-001');
  const invoice1 = await FinancialService.generateFromRepairOrders([String(order1._id)], {});
  check(invoice1.discount === 7.48, 'Rabatt = 7,48 (nicht 13,84)', invoice1.discount);
  check(invoice1.total === 42.42, 'Brutto = 42,42 (nicht 36,06)', invoice1.total);
  check(invoice1.subtotal === 35.65, 'Netto = 35,65 (nicht 30,30)', invoice1.subtotal);
  check(invoice1.tax === 6.77, 'MwSt = 6,77 (nicht 5,76)', invoice1.tax);
  check(invoice1.total === order1.totalCost, 'Rechnungsbrutto === Auftragswert', `${invoice1.total} === ${order1.totalCost}`);

  console.log('\n[Pfad 2] createInvoiceFromOrder');
  const order2 = await makeOrder('ORD-T23-002');
  const invoice2 = await FinancialService.createInvoiceFromOrder(String(order2._id));
  check(invoice2.discount === 7.48, 'Rabatt = 7,48', invoice2.discount);
  check(invoice2.total === 42.42, 'Brutto = 42,42 === Auftragswert', invoice2.total);

  console.log('\n[Pfad 3] Ausdruecklicher Zusatzrabatt addiert sich, ersetzt nicht');
  const order3 = await makeOrder('ORD-T23-003');
  const invoice3 = await FinancialService.generateFromRepairOrders([String(order3._id)], { discount: 5 });
  check(invoice3.discount === 12.48, 'Rabatt = 7,48 + 5,00 = 12,48', invoice3.discount);
  check(invoice3.total === 37.42, 'Brutto = 49,90 - 12,48 = 37,42', invoice3.total);

  console.log('\n[Pfad 4] Mehrere Auftraege - Summe bleibt erhalten');
  const order4 = await makeOrder('ORD-T23-004');
  const order5 = await makeOrder('ORD-T23-005');
  const invoice4 = await FinancialService.generateFromRepairOrders(
    [String(order4._id), String(order5._id)],
    {},
  );
  check(invoice4.discount === 14.96, 'Rabatt = 2 x 7,48 = 14,96', invoice4.discount);
  check(invoice4.total === 84.84, 'Brutto = 2 x 42,42 = 84,84', invoice4.total);
  check(
    invoice4.total === Number((order4.totalCost + order5.totalCost).toFixed(2)),
    'Rechnungsbrutto === Summe der Auftragswerte',
    invoice4.total,
  );

  console.log('\n[Pfad 5] Kunde ohne Gruppenrabatt bleibt unveraendert');
  const plainCustomer = await User.create({
    name: 'Testkunde Privat',
    email: 'privat@test.invalid',
    role: 'customer',
    customerNumber: 'K-T23-P',
  });
  const order6 = await Order.create({
    customerId: plainCustomer._id,
    orderNumber: 'ORD-T23-006',
    deviceBrand: 'Apple',
    deviceModel: 'iPhone 15',
    deviceType: 'Smartphone',
    errorDescription: 'Diagnose',
    services: [{ serviceId: service._id, name: 'Diagnose', price: 49.9, quantity: 1, estimatedTime: 30 }],
    totalCost: 49.9,
    discount: 0,
    status: 'completed',
  });
  const invoice5 = await FinancialService.generateFromRepairOrders([String(order6._id)], {});
  check(invoice5.discount === 0, 'Kein Rabatt', invoice5.discount);
  check(invoice5.total === 49.9, 'Brutto = 49,90 === Auftragswert', invoice5.total);

  console.log(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('ERROR:', error.message);
  process.exit(2);
});
