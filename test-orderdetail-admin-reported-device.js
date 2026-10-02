/**
 * Regressionstest (Track orderdetail / Stufe admin, 01.10.2026): Personal-Auftragsdetail.
 *
 * Echte Express-Routen + echte DB (Wegwerf-mongod) + Rollen (Kunde, fremder Kunde, Personal, Admin).
 *   [A] HIST-9 "Vom Kunden gemeldet": GET /api/admin/orders/:id liefert fuer Personal/Admin das
 *       urspruenglich gebuchte Geraet (Order.reportedDevice) neben dem korrigierten Geraet. Vorher fehlte
 *       das Feld in der Detailantwort, die Geraetekarte konnte die Kundenangabe nicht zeigen.
 *   [B] Die Kunden-Detailantwort (GET /api/orders/:id) bleibt unveraendert ohne reportedDevice; Kunden und
 *       fremde Kunden erreichen die Personalroute nicht (403).
 *   [C] Der Geraetewechsel-Dialog sendet jetzt Herkunft + Grund (Body wie im Client:
 *       { ..., source: 'Gerätekarte', reason }); der Verlauf (GET /api/orders/:id/history, Personal) zeigt
 *       den Eintrag mit Quelle und Grund, der Kundenverlauf nicht.
 *
 * MOCKS: Benachrichtigungen, E-Mails, DHL - keine echte Nachricht, kein Label. Datei-Logs werden umgeleitet.
 * Aufruf (nur WEGWERF-Datenbank):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_orderdetail_admin node test-orderdetail-admin-reported-device.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const Module = require('module');

const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, 'server');
const LOG_DIR = path.join(SERVER_DIR, 'logs');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_orderdetail_admin';

// Sicherheitsnetz: dropDatabase() nur gegen eine ausdruecklich angegebene Wegwerf-Datenbank.
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
const LOG_REDIRECT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'orderdetail-admin-logs-'));
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

// 'qrcode' fehlt lokal (nur PDF-Erzeugung)
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, parent, ...rest) {
  if (request === 'qrcode') return 'qrcode-test-stub';
  return originalResolve.call(this, request, parent, ...rest);
};
require.cache['qrcode-test-stub'] = {
  id: 'qrcode-test-stub', filename: 'qrcode-test-stub', loaded: true,
  exports: { toDataURL: async () => 'data:image/png;base64,', toBuffer: async () => Buffer.from('') },
};

const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

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
const section = async (title, fn) => {
  console.log(`\n${title}`);
  try {
    await fn();
  } catch (error) {
    fail += 1;
    console.log(`  FAIL Abschnitt brach ab :: ${error && error.stack ? error.stack.split('\n').slice(0, 4).join(' | ') : error}`);
  }
};

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  fs.readdirSync(path.join(SERVER_DIR, 'models')).filter((file) => file.endsWith('.js')).forEach((file) => {
    try { require(path.join(SERVER_DIR, 'models', file)); } catch (error) { /* optionale Abhaengigkeiten */ }
  });

  // ---- MOCKS: keine echten E-Mails / Benachrichtigungen / DHL ----
  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  ['sendOrderConfirmationEmail', 'sendTriggerEmail', 'sendTemplateEmail', 'sendEmail', 'sendInvoiceEmail'].forEach((name) => {
    EmailService[name] = async () => ({ success: true, mocked: true });
  });
  EmailService.buildSystemUrl = async (p) => `http://test.invalid${p}`;
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });
  const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));
  DHLService.createShipment = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };
  DHLService.getTrackingInfo = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };

  const OrderService = require(path.join(SERVER_DIR, 'services/orderService'));

  const app = express();
  app.use(express.json());
  app.use('/api/orders', require(path.join(SERVER_DIR, 'routes/orderRoutes')));
  app.use('/api/admin/orders', require(path.join(SERVER_DIR, 'routes/adminOrderRoutes')));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const Service = mongoose.model('Service');
  const readStored = async (id) => mongoose.connection.db.collection('orders').findOne({ _id: new mongoose.Types.ObjectId(String(id)) });

  const owner = await User.create({ name: 'Kunde Eigentuemer', email: 'od-owner@test.invalid', role: 'customer' });
  const stranger = await User.create({ name: 'Kunde Fremd', email: 'od-stranger@test.invalid', role: 'customer' });
  const staff = await User.create({ name: 'Sophie Technik', email: 'od-staff@test.invalid', role: 'staff' });
  const admin = await User.create({ name: 'Admin Detail', email: 'od-admin@test.invalid', role: 'admin' });
  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, user, body) => {
    const headers = { 'Content-Type': 'application/json' };
    if (user) headers.Authorization = `Bearer ${tokenFor(user)}`;
    const response = await fetch(`${baseUrl}${url}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    let json = null;
    try { json = await response.json(); } catch (error) { json = null; }
    return { status: response.status, body: json };
  };

  const display = await Service.create({
    category: 'display', deviceTypes: ['Smartphone'], manufacturerPrecise: 'Apple', modelPrecise: 'iPhone 15',
    name: 'Displaytausch iPhone 15', price: 100, estimatedTime: '60',
  });
  const display15Pro = await Service.create({
    category: 'display', deviceTypes: ['Smartphone'], manufacturerPrecise: 'Apple', modelPrecise: 'iPhone 15 Pro',
    name: 'Displaytausch iPhone 15 Pro', price: 140, estimatedTime: '60',
  });

  const order = await OrderService.create({
    customerId: owner._id, deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
    errorDescription: 'Display defekt', services: [String(display._id)],
  });
  const id = String(order._id);
  const lineId = String((await readStored(id)).services[0]._id);

  try {
    await section('[C] Geraetewechsel mit Herkunft + Grund (Body wie der Dialog ihn sendet)', async () => {
      const res = await call('POST', `/api/admin/orders/${id}/change-device`, staff, {
        deviceBrand: 'Apple', deviceModel: 'iPhone 15 Pro', deviceType: 'Smartphone',
        serviceReplacements: [{ oldOrderServiceId: lineId, newServiceId: String(display15Pro._id) }],
        source: 'Gerätekarte', reason: 'Bei der Eingangsprüfung festgestellt: Pro-Modell',
      });
      check(res.status === 200, 'POST change-device (Personal) gespeichert', `${res.status} ${res.body?.error || ''}`);
      const stored = await readStored(id);
      check(stored.deviceModel === 'iPhone 15 Pro' && stored.reportedDevice?.model === 'iPhone 15',
        'gespeichert: aktuelles Geraet korrigiert, reportedDevice = gebuchtes Geraet', `${stored.deviceModel} / ${JSON.stringify(stored.reportedDevice)}`);

      const staffHistory = await call('GET', `/api/orders/${id}/history?types=device`, staff);
      const entry = (staffHistory.body?.entries || []).find((e) => e.type === 'device');
      check(staffHistory.status === 200 && entry && entry.source === 'Gerätekarte' && entry.reason === 'Bei der Eingangsprüfung festgestellt: Pro-Modell',
        'Verlauf (Personal, Filter Geraet): Eintrag mit Quelle und Grund', JSON.stringify(entry ? { s: entry.source, r: entry.reason, t: entry.title } : staffHistory.body).slice(0, 200));
      const ownerHistory = await call('GET', `/api/orders/${id}/history`, owner);
      check(ownerHistory.status === 200 && !JSON.stringify(ownerHistory.body || {}).includes('Pro-Modell'),
        'Kundenverlauf zeigt den internen Grund nicht', ownerHistory.status);
      const strangerHistory = await call('GET', `/api/orders/${id}/history`, stranger);
      check(strangerHistory.status === 403, 'fremder Kunde: Verlauf 403', strangerHistory.status);
    });

    await section('[A] Personal-Detailantwort enthaelt das gemeldete Geraet (HIST-9)', async () => {
      for (const [label, user] of [['Admin', admin], ['Personal', staff]]) {
        const res = await call('GET', `/api/admin/orders/${id}`, user);
        const reported = res.body?.order?.reportedDevice;
        check(res.status === 200 && reported?.brand === 'Apple' && reported?.model === 'iPhone 15' && res.body?.order?.deviceModel === 'iPhone 15 Pro',
          `${label}: reportedDevice (gebucht) neben dem korrigierten Geraet`, `${res.status} ${JSON.stringify(reported)} / ${res.body?.order?.deviceModel}`);
      }
      // Auftrag ohne Korrektur: reportedDevice ist die Buchung selbst (gleich dem aktuellen Geraet) -
      // die Oberflaeche zeigt dann keinen Zusatz.
      const plain = await OrderService.create({
        customerId: owner._id, deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
        errorDescription: 'Akku', services: [String(display._id)],
      });
      const res = await call('GET', `/api/admin/orders/${plain._id}`, admin);
      const reported = res.body?.order?.reportedDevice;
      check(res.status === 200 && (!reported || reported.model === res.body?.order?.deviceModel),
        'ohne Korrektur: reportedDevice fehlt oder entspricht dem aktuellen Geraet', JSON.stringify(reported || null));
    });

    await section('[B] Kundensicht und Rollen unveraendert', async () => {
      const ownerRes = await call('GET', `/api/orders/${id}`, owner);
      const ownerOrder = ownerRes.body?.order || ownerRes.body;
      check(ownerRes.status === 200 && ownerOrder && ownerOrder.reportedDevice === undefined,
        'Kunde: GET /api/orders/:id ohne reportedDevice (Projektion unveraendert)', `${ownerRes.status} ${JSON.stringify(ownerOrder?.reportedDevice)}`);
      const ownerAdmin = await call('GET', `/api/admin/orders/${id}`, owner);
      check(ownerAdmin.status === 403, 'Kunde: Personalroute 403', ownerAdmin.status);
      const strangerAdmin = await call('GET', `/api/admin/orders/${id}`, stranger);
      check(strangerAdmin.status === 403, 'fremder Kunde: Personalroute 403', strangerAdmin.status);
      const anonymous = await call('GET', `/api/admin/orders/${id}`, null);
      check(anonymous.status === 401 || anonymous.status === 403, 'ohne Anmeldung: 401/403', anonymous.status);
      const strangerCustomer = await call('GET', `/api/orders/${id}`, stranger);
      check([403, 404].includes(strangerCustomer.status), 'fremder Kunde: Kundenroute 403/404', strangerCustomer.status);
    });
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
