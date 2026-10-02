/**
 * Regressionstest (01.10.2026, Track "adminlists", Review-Fix): Admin-Liste "Reparaturaufträge"
 * GET /api/admin/orders filtert serverseitig ueber ALLE Auftraege.
 *
 * Vorher filterte /admin/orders Suche, Status, Prioritaet und die klickbaren Kennzahlen nur ueber
 * die 100 zuletzt geladenen Auftraege (die Kennzahlen waren aber global): ein aelterer ORD-…
 * ergab "Keine Aufträge für diese Filter gefunden", der Dashboard-Link
 * /admin/orders?prio=high-urgent zeigte nur eine Teilmenge.
 *
 * Laeuft ueber den ECHTEN Express-Router /api/admin/orders mit echter JWT-Pruefung und echter DB.
 * Abgesichert:
 *   - Suche findet einen Auftrag ausserhalb der neuesten 100 (Auftragsnummer).
 *   - Suche nach Kundenname / Kunden-E-Mail (registriert) und nach Gast-E-Mail / Gastname.
 *   - Suche wird woertlich behandelt (Regex-Sonderzeichen -> kein 500, kein "alles passt").
 *   - priority=high-urgent liefert Hoch UND Dringend; totalOrders == stats.highOrUrgent.
 *   - stats.total = Anzahl aller Auftraege.
 *   - ids=… (Filter "Warten auf Kundenrückmeldung") liefert genau diese Auftraege; leere Liste -> 0;
 *     ungueltige IDs werden ignoriert.
 *   - Rollen: Staff 200, Kunde 403, ohne Anmeldung 401.
 *
 * Aufruf (nur Wegwerf-Datenbank):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_adminlists_orders node test-adminlists-orders-filters.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_adminlists_orders';

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
  if (condition) { pass += 1; out(`  PASS ${message} :: ${actual}`); } else { fail += 1; out(`  FAIL ${message} :: ${actual}`); }
};
const runSection = async (title, fn) => {
  out(`\n[${title}]`);
  try { await fn(); } catch (error) { fail += 1; out(`  FAIL Abschnitt abgebrochen :: ${error.stack || error.message}`); }
};

async function main() {
  if (isUnsafeTestUri(URI)) throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');

  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  const MODELS_DIR = path.join(SERVER_DIR, 'models');
  fs.readdirSync(MODELS_DIR).filter((file) => file.endsWith('.js')).forEach((file) => {
    try { require(path.join(MODELS_DIR, file)); } catch (error) { /* optionale Abhaengigkeiten */ }
  });

  // MOCKS: niemals echte Mails / Benachrichtigungen
  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.sendTemplateEmail = async () => ({ success: true });
  EmailService.sendTriggerEmail = async () => ({ success: true });
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });

  const adminOrderRoutes = require(path.join(SERVER_DIR, 'routes/adminOrderRoutes'));
  const app = express();
  app.use(express.json());
  app.use('/api/admin/orders', adminOrderRoutes);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');

  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (url, user) => {
    const response = await fetch(`${baseUrl}${url}`, { headers: user ? { Authorization: `Bearer ${tokenFor(user)}` } : {} });
    let body = null;
    try { body = await response.json(); } catch (error) { body = null; }
    return { status: response.status, body };
  };

  const admin = await User.create({ name: 'Admin Liste', email: 'alo-admin@test.invalid', role: 'admin' });
  const staff = await User.create({ name: 'Stefan Staff', email: 'alo-staff@test.invalid', role: 'staff' });
  const customer = await User.create({ name: 'Hannelore Kundig', email: 'hannelore.kundig@test.invalid', role: 'customer' });

  // 120 Auftraege, der aelteste zuerst. Die neuesten 100 enthalten den aeltesten NICHT.
  const base = Date.now() - 200 * 60 * 1000;
  const docs = [];
  for (let i = 0; i < 120; i += 1) {
    docs.push({
      orderNumber: `ORD-ALO-${String(i).padStart(4, '0')}`,
      customerId: customer._id,
      deviceBrand: 'Apple',
      deviceModel: `iPhone ${i}`,
      deviceType: 'Smartphone',
      errorDescription: 'Display defekt',
      services: [],
      totalCost: 49.9,
      status: i % 3 === 0 ? 'completed' : 'in-progress',
      priority: i === 1 ? 'urgent' : (i === 2 || i === 110 ? 'high' : 'normal'),
      createdAt: new Date(base + i * 60 * 1000),
      updatedAt: new Date(base + i * 60 * 1000),
    });
  }
  // Gastauftrag (kein customerId) mit Gastangaben.
  docs.push({
    orderNumber: 'ORD-ALO-GAST',
    customerId: null,
    guestInfo: { isGuest: true, email: 'gastkunde.wagner@test.invalid', firstName: 'Gisela', lastName: 'Wagner' },
    deviceBrand: 'Samsung',
    deviceModel: 'Galaxy A5',
    deviceType: 'Smartphone',
    errorDescription: 'Akku',
    services: [],
    totalCost: 29.9,
    status: 'pending',
    priority: 'normal',
    createdAt: new Date(base - 60 * 1000),
    updatedAt: new Date(base - 60 * 1000),
  });
  await Order.collection.insertMany(docs);
  const all = await Order.find({}).select('_id orderNumber').lean();
  const idOf = (number) => String(all.find((order) => order.orderNumber === number)._id);

  await runSection('Suche ueber alle Auftraege', async () => {
    let res = await call('/api/admin/orders?page=1&limit=100', admin);
    check(res.status === 200 && res.body.totalOrders === 121, 'Admin: totalOrders = 121', `${res.status} ${res.body && res.body.totalOrders}`);
    const newest = (res.body.orders || []).map((order) => order.orderNumber);
    check(!newest.includes('ORD-ALO-0000'), 'Voraussetzung: ORD-ALO-0000 liegt ausserhalb der neuesten 100', newest.length);

    res = await call('/api/admin/orders?page=1&limit=25&search=ORD-ALO-0000', admin);
    check(res.status === 200 && res.body.totalOrders === 1 && res.body.orders[0].orderNumber === 'ORD-ALO-0000', 'Suche nach aelterer Auftragsnummer findet sie', `${res.body && res.body.totalOrders} ${res.body && res.body.orders && res.body.orders[0] && res.body.orders[0].orderNumber}`);

    res = await call(`/api/admin/orders?page=1&limit=25&search=${encodeURIComponent('Hannelore')}`, admin);
    check(res.status === 200 && res.body.totalOrders === 120, 'Suche nach Kundenname (registriert)', res.body && res.body.totalOrders);
    res = await call(`/api/admin/orders?page=1&limit=25&search=${encodeURIComponent('kundig@test')}`, admin);
    check(res.status === 200 && res.body.totalOrders === 120, 'Suche nach Kunden-E-Mail', res.body && res.body.totalOrders);
    res = await call(`/api/admin/orders?page=1&limit=25&search=${encodeURIComponent('gastkunde.wagner')}`, admin);
    check(res.status === 200 && res.body.totalOrders === 1 && res.body.orders[0].orderNumber === 'ORD-ALO-GAST', 'Suche nach Gast-E-Mail', res.body && res.body.totalOrders);
    res = await call(`/api/admin/orders?page=1&limit=25&search=${encodeURIComponent('Gisela')}`, admin);
    check(res.status === 200 && res.body.totalOrders === 1, 'Suche nach Gastname', res.body && res.body.totalOrders);

    res = await call(`/api/admin/orders?page=1&limit=25&search=${encodeURIComponent('(.*')}`, admin);
    check(res.status === 200 && res.body.totalOrders === 0, 'Regex-Sonderzeichen werden woertlich gesucht (kein 500, keine Allesmenge)', `${res.status} ${res.body && res.body.totalOrders}`);
  });

  await runSection('Prioritaet Hoch und Dringend, Kennzahlen', async () => {
    const res = await call('/api/admin/orders?page=1&limit=25&priority=high-urgent', admin);
    const numbers = (res.body.orders || []).map((order) => order.orderNumber).sort();
    check(res.status === 200 && res.body.totalOrders === 3, 'priority=high-urgent -> 3 Treffer (inkl. aelterer)', `${res.status} ${res.body && res.body.totalOrders}`);
    check(numbers.join(',') === 'ORD-ALO-0001,ORD-ALO-0002,ORD-ALO-0110', 'Hoch UND Dringend enthalten', numbers.join(','));
    check(res.body.stats && res.body.stats.highOrUrgent === res.body.totalOrders, 'stats.highOrUrgent == Treffer des Filters', res.body.stats && res.body.stats.highOrUrgent);
    check(res.body.stats && res.body.stats.total === 121, 'stats.total = alle Auftraege', res.body.stats && res.body.stats.total);
    const completed = await call('/api/admin/orders?page=1&limit=25&status=completed', admin);
    check(completed.body.totalOrders === completed.body.stats.completed, 'Status-Filter "Abgeschlossen": Treffer == Kennzahl', `${completed.body.totalOrders}/${completed.body.stats.completed}`);
    const urgentOnly = await call('/api/admin/orders?page=1&limit=25&priority=urgent', admin);
    check(urgentOnly.body.totalOrders === 1, 'priority=urgent unveraendert nur Dringend', urgentOnly.body.totalOrders);
  });

  await runSection('ids-Filter (Warten auf Kundenrueckmeldung)', async () => {
    const wanted = [idOf('ORD-ALO-0000'), idOf('ORD-ALO-0119')];
    let res = await call(`/api/admin/orders?page=1&limit=25&ids=${wanted.join(',')},kein-objectid`, admin);
    const got = (res.body.orders || []).map((order) => String(order._id)).sort();
    check(res.status === 200 && res.body.totalOrders === 2 && got.join(',') === [...wanted].sort().join(','), 'ids liefert genau diese Auftraege (ungueltige ID ignoriert)', `${res.status} ${res.body && res.body.totalOrders}`);
    res = await call('/api/admin/orders?page=1&limit=25&ids=', admin);
    check(res.status === 200 && res.body.totalOrders === 0, 'leere ids -> keine Treffer', `${res.status} ${res.body && res.body.totalOrders}`);
    res = await call(`/api/admin/orders?page=1&limit=25&ids=${wanted.join(',')}&search=ORD-ALO-0119`, admin);
    check(res.body.totalOrders === 1, 'ids kombiniert mit Suche', res.body.totalOrders);
  });

  await runSection('Rollen', async () => {
    let res = await call('/api/admin/orders?page=1&limit=25&priority=high-urgent', staff);
    check(res.status === 200 && res.body.totalOrders === 3, 'Staff 200 mit gleichem Ergebnis', `${res.status} ${res.body && res.body.totalOrders}`);
    res = await call('/api/admin/orders?page=1&limit=25', customer);
    check(res.status === 403, 'Kunde -> 403', res.status);
    res = await call('/api/admin/orders?page=1&limit=25');
    check(res.status === 401, 'ohne Anmeldung -> 401', res.status);
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
