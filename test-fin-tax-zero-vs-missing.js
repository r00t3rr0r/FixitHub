/**
 * Regressionstest FIN-13 (technischer Teil, 02.10.2026): gespeicherter Steuersatz 0
 * gegenueber FEHLENDEM Steuersatz.
 *
 * Vorher:
 *   - Order pre('save'): `this.taxRate || 19` machte aus einem ausdruecklich gespeicherten
 *     Satz 0 beim Speichern 19 (MwSt. 7,97 auf 49,90).
 *   - OrderService.buildOrderPricingSummary: Number(null) = 0 -> 0 %, undefined -> 19 %;
 *     fehlende und echte Null-Steuer waren nicht unterscheidbar.
 * Jetzt (CalculationHelper.resolveTaxRate):
 *   - gespeicherter Satz (auch 0) bleibt erhalten, ueberall wo er gelesen/neu gerechnet
 *     wird (Modell-Hook, Preisaufstellung Kunde + Personal, Positionsaenderung,
 *     Buchungssummen/Sync); taxRateSource 'stored'.
 *   - null / fehlend = "nicht gespeichert": konfigurierter Standardsatz aus den
 *     Finanzeinstellungen, taxRateSource 'default', das Feld wird nicht still befuellt.
 *   - Unveraendert: neue Auftraege bekommen weiterhin 19 % (auch wenn der Client 0 schickt),
 *     Standardfaelle 49,90 -> 41,93 + 7,97 und 47,40 -> 39,83 + 7,57, Bestandsrechnungen
 *     behalten beim erneuten Speichern ihre Betraege (Invoice.js bewusst unveraendert).
 *
 * Echte Express-Router (/api/orders, /api/admin/orders, /api/order-services) mit echter
 * JWT-Pruefung, echte Datenbank. E-Mail/Benachrichtigungen gemockt, keine externen Hosts.
 *
 * Aufruf (nur Wegwerf-Datenbank):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_fin13_tax node test-fin-tax-zero-vs-missing.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_fin13_tax';

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
  EmailService.sendTemplateEmail = async () => ({ success: true, mocked: true });
  EmailService.sendTriggerEmail = async () => ({ success: true, mocked: true });
  EmailService.sendOrderConfirmationEmail = async () => ({ success: true, mocked: true });
  EmailService.buildSystemUrl = async (p) => `http://test.invalid${p}`;
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });

  const orderRoutes = require(path.join(SERVER_DIR, 'routes/orderRoutes'));
  const adminOrderRoutes = require(path.join(SERVER_DIR, 'routes/adminOrderRoutes'));
  const orderServiceRoutes = require(path.join(SERVER_DIR, 'routes/orderServiceRoutes'));
  const FinancialService = require(path.join(SERVER_DIR, 'services/financialService'));
  const BookingService = require(path.join(SERVER_DIR, 'services/bookingService'));

  const app = express();
  app.use(express.json());
  app.use('/api/orders', orderRoutes);
  app.use('/api/admin/orders', adminOrderRoutes);
  app.use('/api/order-services', orderServiceRoutes);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Booking = mongoose.model('Booking');
  const Service = mongoose.model('Service');
  const Invoice = mongoose.model('Invoice');
  const SystemConfiguration = mongoose.model('SystemConfiguration');
  const ordersColl = mongoose.connection.db.collection('orders');
  const readStored = (id) => ordersColl.findOne({ _id: new mongoose.Types.ObjectId(String(id)) });

  const customer = await User.create({ name: 'Kundin Steuer', email: 'fin13-kunde@test.invalid', role: 'customer' });
  const staff = await User.create({ name: 'Staff Steuer', email: 'fin13-staff@test.invalid', role: 'staff' });
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
  const customerPricing = async (id) => (await call('GET', `/api/orders/${id}`, customer)).body?.order?.pricing;
  const staffPricing = async (id) => (await call('GET', `/api/admin/orders/${id}`, staff)).body?.order?.pricing;
  const fmt = (p) => (p ? `${p.taxRate} % (${p.taxRateSource}) brutto ${p.grossTotal} netto ${p.netTotal} MwSt ${p.taxAmount}` : 'keine pricing');

  const base = { category: 'display', deviceTypes: ['Smartphone'], manufacturerPrecise: 'Apple', modelPrecise: 'iPhone 15' };
  const display = await Service.create({ ...base, name: 'Displaytausch', price: 49.9, estimatedTime: '60' });
  const akku = await Service.create({ ...base, name: 'Akkutausch', price: 50, estimatedTime: '30' });

  let seq = 0;
  const makeOrder = async ({ listPrice = 49.9, discount = 0, extra = {} } = {}) => {
    seq += 1;
    return Order.create({
      customerId: customer._id,
      orderNumber: `ORD-FIN13-${String(seq).padStart(3, '0')}`,
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 15',
      deviceType: 'Smartphone',
      errorDescription: 'Display defekt',
      services: [{ serviceId: display._id, name: 'Displaytausch', price: listPrice, quantity: 1, estimatedTime: 30 }],
      totalCost: Math.round((listPrice - discount) * 100) / 100,
      discount,
      status: 'pending',
      ...extra,
    });
  };

  try {
    await runSection('1 Standardfall unveraendert (neue Auftraege 19 %)', async () => {
      const o = await makeOrder();
      const s = await readStored(o._id);
      check(s.taxRate === 19 && near(s.netAmount, 41.93) && near(s.taxAmount, 7.97), 'DB: 49,90 -> 19 %, 41,93 + 7,97', `${s.taxRate} ${s.netAmount} ${s.taxAmount}`);
      const c = await customerPricing(o._id);
      check(c && c.taxRate === 19 && c.taxRateSource === 'stored' && near(c.netTotal, 41.93) && near(c.taxAmount, 7.97), 'Kunde: 19 % gespeichert, 41,93 + 7,97', fmt(c));
      const p = await makeOrder({ discount: 2.5 });
      const sp = await staffPricing(p._id);
      check(sp && near(sp.grossTotal, 47.4) && near(sp.netTotal, 39.83) && near(sp.taxAmount, 7.57) && sp.taxRateSource === 'stored', 'Personal: 5 %-Fall 47,40 -> 39,83 + 7,57', fmt(sp));

      // Auftragsanlage ueber POST /api/orders: der Client darf den Satz nicht setzen.
      const created = await call('POST', '/api/orders', customer, {
        deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 15',
        services: [String(display._id)], addOns: [], taxRate: 0,
      });
      const sc = created.body?.orderId ? await readStored(created.body.orderId) : null;
      check(created.status === 201 && sc && sc.taxRate === 19 && near(sc.taxAmount, 7.97), 'POST /api/orders mit taxRate 0 vom Client: weiterhin 19 % gespeichert (Anlageverhalten unveraendert)', `${created.status} ${sc && sc.taxRate} ${sc && sc.taxAmount}`);
    });

    let zeroOrder = null;
    await runSection('2 Gespeicherter Satz 0 bleibt 0 (Speichern, Neuberechnung, Anzeige)', async () => {
      zeroOrder = await makeOrder({ extra: { taxRate: 0 } });
      let s = await readStored(zeroOrder._id);
      check(s.taxRate === 0 && near(s.taxAmount, 0) && near(s.netAmount, 49.9), 'DB nach Anlage: 0 %, MwSt. 0,00, Netto 49,90 (vorher 19 % / 7,97)', `${s.taxRate} ${s.taxAmount} ${s.netAmount}`);

      const doc = await Order.findById(zeroOrder._id);
      doc.notes = 'erneut gespeichert';
      await doc.save();
      s = await readStored(zeroOrder._id);
      check(s.taxRate === 0 && near(s.taxAmount, 0), 'DB nach erneutem Speichern: weiterhin 0 %', `${s.taxRate} ${s.taxAmount}`);

      const added = await call('POST', `/api/order-services/${zeroOrder._id}`, staff, { serviceId: String(akku._id), reason: 'Akku defekt' });
      s = await readStored(zeroOrder._id);
      check(added.status === 201 && near(s.totalCost, 99.9) && s.taxRate === 0 && near(s.taxAmount, 0) && near(s.netAmount, 99.9), 'Positionsaenderung (Neuberechnung 99,90): 0 % bleibt, MwSt. 0,00', `${added.status} ${s.totalCost} ${s.taxRate} ${s.taxAmount}`);
      check(added.body?.pricing?.taxRate === 0 && added.body?.pricing?.taxRateSource === 'stored' && near(added.body?.pricing?.taxAmount, 0), 'Antwort der Positionsaenderung: 0 % gespeichert', fmt(added.body?.pricing));

      const c = await customerPricing(zeroOrder._id);
      check(c && c.taxRate === 0 && c.taxRateSource === 'stored' && near(c.taxAmount, 0) && near(c.netTotal, c.grossTotal), 'GET /api/orders/:id (Kunde): 0 %, MwSt. 0,00, Netto = Brutto', fmt(c));
      const st = await staffPricing(zeroOrder._id);
      check(st && st.taxRate === 0 && st.taxRateSource === 'stored' && near(st.taxAmount, 0), 'GET /api/admin/orders/:id (Personal): 0 %', fmt(st));
      const os = await call('GET', `/api/order-services/${zeroOrder._id}`, customer);
      check(os.status === 200 && os.body?.pricing?.taxRate === 0 && os.body?.pricing?.taxRateSource === 'stored', 'GET /api/order-services/:id: 0 %', fmt(os.body?.pricing));
    });

    let nullOrder = null;
    let missingOrder = null;
    await runSection('3 Fehlender Satz (null / nicht vorhanden) = Standardsatz, gekennzeichnet', async () => {
      nullOrder = await makeOrder();
      await ordersColl.updateOne({ _id: nullOrder._id }, { $set: { taxRate: null } });
      const c = await customerPricing(nullOrder._id);
      check(c && c.taxRate === 19 && c.taxRateSource === 'default' && near(c.netTotal, 41.93) && near(c.taxAmount, 7.97), 'null: Kunde sieht Standardsatz 19 % (default), nicht 0 %', fmt(c));
      const st = await staffPricing(nullOrder._id);
      check(st && st.taxRate === 19 && st.taxRateSource === 'default', 'null: Personal sieht Standardsatz (default)', fmt(st));

      const doc = await Order.findById(nullOrder._id);
      doc.notes = 'gespeichert ohne Satz';
      await doc.save();
      const s = await readStored(nullOrder._id);
      check(s.taxRate === null && near(s.taxAmount, 7.97) && near(s.netAmount, 41.93), 'null + Speichern: gerechnet mit Standardsatz, Feld NICHT still befuellt', `${s.taxRate} ${s.netAmount} ${s.taxAmount}`);

      missingOrder = await makeOrder();
      await ordersColl.updateOne({ _id: missingOrder._id }, { $unset: { taxRate: '' } });
      const m = await customerPricing(missingOrder._id);
      check(m && m.taxRate === 19 && m.taxRateSource === 'default' && near(m.taxAmount, 7.97), 'Feld fehlt: Standardsatz 19 % (default)', fmt(m));

      // Konfigurierter Standardsatz (Finanzeinstellungen) gilt NUR fuer Auftraege ohne Satz.
      await SystemConfiguration.collection.insertOne({ financialSettings: { defaults: { taxRate: 7 } } });
      const m7 = await customerPricing(missingOrder._id);
      check(m7 && m7.taxRate === 7 && m7.taxRateSource === 'default' && near(m7.netTotal, 46.64) && near(m7.taxAmount, 3.26), 'Feld fehlt + Einstellung 7 %: Standardsatz aus den Einstellungen (46,64 + 3,26)', fmt(m7));
      const stored19 = await customerPricing((await Order.findOne({ orderNumber: 'ORD-FIN13-001' }))._id);
      check(stored19 && stored19.taxRate === 19 && stored19.taxRateSource === 'stored', 'gespeicherte 19 % bleiben trotz Einstellung 7 %', fmt(stored19));
      const z = await customerPricing(zeroOrder._id);
      check(z && z.taxRate === 0 && z.taxRateSource === 'stored', 'gespeicherte 0 % bleiben trotz Einstellung 7 %', fmt(z));
      await SystemConfiguration.collection.deleteMany({});
    });

    await runSection('4 Buchungssummen konsistent mit den Auftraegen', async () => {
      const a = await makeOrder({ extra: { taxRate: 0 } }); // 49,90, MwSt. 0
      const b = await makeOrder({ discount: 2.5 }); // 47,40, MwSt. 7,57
      const plain = await Order.find({ _id: { $in: [a._id, b._id] } }).lean();
      const totals = BookingService.computeBookingTotalsFromOrders(plain);
      check(near(totals.totalCost, 97.3) && near(totals.tax, 7.57), 'computeBookingTotalsFromOrders: 97,30 brutto, MwSt. 0 + 7,57 = 7,57', JSON.stringify(totals));

      const booking = await Booking.create({
        customerId: customer._id,
        orderIds: [a._id, b._id],
        items: [a, b].map((o) => ({ type: 'repair', orderId: o._id, orderNumber: o.orderNumber, cost: o.totalCost })),
        subtotal: 99.8, discount: 2.5, tax: 15.54, totalCost: 97.3, status: 'processing',
      });
      await Order.updateMany({ _id: { $in: [a._id, b._id] } }, { $set: { bookingId: booking._id } });
      await FinancialService.syncOrderAndBookingValue(String(a._id), 'order');
      const synced = await Booking.findById(booking._id).lean();
      check(near(synced.totalCost, 97.3) && near(synced.tax, 7.57), 'Sync der Buchung: MwSt. 7,57 (gespeicherte 0 % nicht zu 19 % gemacht)', `${synced.totalCost} ${synced.tax}`);

      const nullPlain = await Order.find({ _id: { $in: [nullOrder._id] } }).lean();
      const nullTotals = BookingService.computeBookingTotalsFromOrders(nullPlain);
      check(near(nullTotals.tax, 7.97), 'Auftrag ohne Satz in Buchungssumme: Standardsatz (7,97), nicht 0', JSON.stringify(nullTotals));
      const nullTotals7 = BookingService.computeBookingTotalsFromOrders(nullPlain, { defaultTaxRate: 7 });
      check(near(nullTotals7.tax, 3.26), 'Buchungssumme mit konfiguriertem Standardsatz 7 %: 3,26', JSON.stringify(nullTotals7));
      const pricing = BookingService.resolveBookingPricing({ orderGrossTotal: 97.3, bookingData: {}, orders: plain });
      check(near(pricing.tax, 7.57) && near(pricing.totalCost, 97.3), 'resolveBookingPricing (ohne Checkout-Snapshot): MwSt. 7,57', JSON.stringify(pricing));
    });

    await runSection('5 Bestandsrechnungen: erneutes Speichern aendert keine Betraege (Invoice.js unveraendert)', async () => {
      const inv = await Invoice.create({
        customerId: customer._id, customerName: customer.name, customerEmail: customer.email,
        items: [{ serviceName: 'Displaytausch', description: 'Reparatur', quantity: 1, unitPrice: 47.4, total: 47.4, type: 'service' }],
        dueDate: new Date(Date.now() + 14 * 86400000), status: 'sent', taxRate: 19,
      });
      check(near(inv.total, 47.4) && near(inv.subtotal, 39.83) && near(inv.tax, 7.57), 'neue Rechnung 19 %: 47,40 = 39,83 + 7,57', `${inv.total} ${inv.subtotal} ${inv.tax}`);
      // Altbestand: kein Satz gespeichert, Betraege aus einer frueheren Rechenweise.
      await Invoice.collection.updateOne({ _id: inv._id }, { $set: { taxRate: null, subtotal: 40, tax: 7.4 } });
      const legacy = await Invoice.findById(inv._id);
      legacy.status = 'viewed';
      legacy.notes = 'erneut gespeichert';
      await legacy.save();
      const after = await Invoice.collection.findOne({ _id: inv._id });
      check(after.taxRate === null && near(after.total, 47.4) && near(after.subtotal, 40) && near(after.tax, 7.4), 'Altrechnung ohne Satz + Statuswechsel: Betraege unveraendert', `${after.taxRate} ${after.total} ${after.subtotal} ${after.tax}`);

      const zeroInv = await Invoice.create({
        customerId: customer._id, customerName: customer.name, customerEmail: customer.email,
        items: [{ serviceName: 'Displaytausch', description: 'Reparatur', quantity: 1, unitPrice: 49.9, total: 49.9, type: 'service' }],
        dueDate: new Date(Date.now() + 14 * 86400000), status: 'sent', taxRate: 0,
      });
      const zeroDoc = await Invoice.findById(zeroInv._id);
      zeroDoc.status = 'viewed';
      await zeroDoc.save();
      const zeroAfter = await Invoice.collection.findOne({ _id: zeroInv._id });
      check(zeroAfter.taxRate === 0 && near(zeroAfter.tax, 0) && near(zeroAfter.total, 49.9) && near(zeroAfter.subtotal, 49.9), 'Rechnung mit gespeicherten 0 %: bleibt 0 % / 49,90', `${zeroAfter.taxRate} ${zeroAfter.total} ${zeroAfter.tax}`);
    });
  } finally {
    server.close();
  }

  out(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  out('ERROR:', error.message);
  out(error.stack);
  process.exit(2);
});
