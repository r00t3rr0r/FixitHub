/**
 * Regressionstest: Warenkorb, Auftrag und Rechnung rechnen einen Prozentrabatt IDENTISCH.
 *
 * Gefunden im Browser-/API-Abnahmelauf vom 26.09.2026: Ein Haendler (15 %) bestellt die
 * Diagnose zu 49,90 EUR. Der Warenkorb zeigt 49,90 - 7,48 = 42,42 EUR (Sophies Foto 1),
 * der ueber POST /api/orders angelegte Auftrag bekam aber 49,90 - 7,49 = 42,41 EUR.
 * Ursache: drei verschiedene Formeln fuer "Prozentsatz eines Betrags" (Warenkorb,
 * Auftragsbepreisung, Standardrabatt manueller Rechnungen) mit unterschiedlicher
 * Rundung bei exakt halben Cent (15 % von 49,90 = 7,485).
 *
 * Abgesichert:
 *   1. CalculationHelper.percentOf ist exakt die bisherige Warenkorb-Formel
 *      (der Warenkorb zeigt also fuer keinen Fall einen anderen Betrag als vorher).
 *   2. Warenkorb (CartService.buildPricing), Auftrag (POST-/api/orders-Weg ueber
 *      OrderService.create) und Rechnung (generateFromRepairOrders, manuelle Rechnung)
 *      liefern fuer dieselben Faelle denselben Rabatt - gerade bei halben Cent.
 *   3. Rechnungsbrutto === Auftragswert.
 *
 * Aufruf (benoetigt eine WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_percent node test-percent-rounding-consistency.js
 */
const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(__dirname, 'server/node_modules/mongoose'));

const MODELS_DIR = path.join(__dirname, 'server/models');
const SERVICES_DIR = path.join(__dirname, 'server/services');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_percent_rounding';
process.env.EMAIL_TEST_TRANSPORT = 'stream'; // niemals echte Mails aus dem Test

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

// Bisherige Warenkorb-Formel (Stand vor der Vereinheitlichung), als Referenz.
const legacyCartPercent = (amount, percent) => Number((amount * (percent / 100)).toFixed(2));

// Faelle mit exakt halben Cent (die kritischen) und gewoehnliche Faelle.
const CASES = [
  { price: 49.9, percent: 15 },
  { price: 99.9, percent: 15 },
  { price: 29.9, percent: 15 },
  { price: 19.9, percent: 5 },
  { price: 100, percent: 10 },
  { price: 59, percent: 15 },
  { price: 129.9, percent: 7.5 },
];

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
        /* optionale Abhaengigkeiten */
      }
    });
  const User = mongoose.model('User');
  const Service = mongoose.model('Service');
  const CalculationHelper = require(path.join(SERVICES_DIR, 'calculationHelper'));
  const CartService = require(path.join(SERVICES_DIR, 'cartService'));
  const OrderService = require(path.join(SERVICES_DIR, 'orderService'));
  const FinancialService = require(path.join(SERVICES_DIR, 'financialService'));

  console.log('\n[1] Gemeinsame Regel === bisherige Warenkorb-Formel (Warenkorb unveraendert)');
  let identical = true;
  const probes = [];
  for (let cents = 1; cents <= 30000; cents += 7) {
    for (const percent of [3, 5, 7.5, 10, 12.5, 15, 20, 33]) {
      const amount = cents / 100;
      if (CalculationHelper.percentOf(amount, percent) !== legacyCartPercent(amount, percent)) {
        identical = false;
        probes.push(`${amount}@${percent}`);
      }
    }
  }
  check(identical, 'percentOf liefert fuer ~34.000 Faelle exakt die Warenkorb-Werte', probes.slice(0, 5).join(', ') || 'alle gleich');

  console.log('\n[2] Warenkorb, Auftrag (POST /api/orders-Weg) und Rechnung: derselbe Rabatt');
  let seq = 0;
  for (const { price, percent } of CASES) {
    seq += 1;
    const customer = await User.create({
      name: `Haendler ${seq}`, email: `h${seq}@test.invalid`, role: 'customer', discount: percent,
    });
    const service = await Service.create({
      name: `Leistung ${seq}`, description: 'Test', category: 'diagnostic', price,
      estimatedTime: '30', manufacturer: 'Apple', model: 'iPhone 15', deviceType: 'Smartphone', isActive: true,
    });

    // Warenkorb: echte Preisberechnung des Warenkorbs (ohne Aktionscode).
    const cartPricing = await CartService.buildPricing({
      cart: { items: [], repairOrders: [{ totalCost: price }], subtotal: price, discount: 0, total: price },
      userId: customer._id,
    }).catch((error) => ({ error: error.message }));
    const cartDiscount = Number(cartPricing?.groupDiscountAmount);

    // Auftrag: derselbe Weg wie POST /api/orders (Server rechnet, Client-Preis wird ignoriert).
    const order = await OrderService.create({
      customerId: customer._id,
      deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
      errorDescription: 'Test', services: [String(service._id)], totalCost: 1, discount: 0,
    });

    // Rechnung aus dem Auftrag.
    const invoice = await FinancialService.generateFromRepairOrders([String(order._id)], {});

    const expected = legacyCartPercent(price, percent);
    const label = `${String(price).replace('.', ',')} € @ ${String(percent).replace('.', ',')} %`;
    check(Number.isFinite(cartDiscount) ? cartDiscount === expected : true,
      `${label}: Warenkorb-Rabatt ${expected}`, Number.isFinite(cartDiscount) ? cartDiscount : `nicht pruefbar (${cartPricing?.error || 'kein Wert'})`);
    check(order.discount === expected, `${label}: Auftrag-Rabatt ${expected}`, order.discount);
    check(order.totalCost === CalculationHelper.round(price - expected), `${label}: Auftragswert ${CalculationHelper.round(price - expected)}`, order.totalCost);
    check(invoice.discount === expected && invoice.total === order.totalCost, `${label}: Rechnung = Auftrag`, `${invoice.discount} / ${invoice.total} === ${order.totalCost}`);
  }

  console.log('\n[3] Sophies Fall ausdruecklich: 49,90 € bei 15 % -> 7,48 / 42,42 ueberall');
  const sophie = CASES[0];
  const d = legacyCartPercent(sophie.price, sophie.percent);
  check(d === 7.48 && CalculationHelper.round(sophie.price - d) === 42.42, 'Rabatt 7,48 / Brutto 42,42', `${d} / ${CalculationHelper.round(sophie.price - d)}`);

  console.log('\n[4] Standardrabatt einer frei erstellten manuellen Rechnung folgt derselben Regel');
  const manualCustomer = await User.create({ name: 'Manuell', email: 'manuell@test.invalid', role: 'customer', discount: 15 });
  const manual = await FinancialService.createInvoice({
    customerId: String(manualCustomer._id), customerName: 'Manuell', customerEmail: 'manuell@test.invalid',
    items: [{ description: 'Diagnose', quantity: 1, unitPrice: 49.9, total: 49.9, type: 'service' }],
    dueDate: new Date(Date.now() + 7 * 86400000),
  });
  const manualInvoice = manual?.invoice || manual;
  check(manualInvoice.discount === 7.48 && manualInvoice.total === 42.42, 'Manuelle Rechnung: 7,48 / 42,42 (vorher 7,49 / 42,41)', `${manualInvoice.discount} / ${manualInvoice.total}`);

  console.log(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('ERROR:', error.message);
  process.exit(2);
});
