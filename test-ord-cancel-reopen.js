/**
 * Regressionstest (02.10.2026): Ein stornierter Auftrag wird nicht ueber das Statusmenue fortgesetzt.
 *
 * Gefunden im Browser-Abnahmelauf: Nach "Auftrag stornieren" (mit Grund) setzte ein einfaches
 * PUT /api/orders/:id/status {status:'in-progress'} den Auftrag ohne Grund und ohne Spur wieder in
 * Bearbeitung (200). Jetzt: Storno ist nur ueber "Stornierung aufheben" (reopen, nur Admin,
 * Grund Pflicht, Ziel immer "pending") umkehrbar; angehaltene Workflows bleiben angehalten.
 *
 * Echte Express-Routen /api/admin/orders und /api/orders, echte DB, Rollen Kunde/Staff/Admin.
 * Aufruf (nur WEGWERF-Datenbank):
 *   EMAIL_TEST_TRANSPORT=stream TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_ord_reopen node test-ord-cancel-reopen.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const Module = require('module');

const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, 'server');
const CLIENT_DIR = path.join(ROOT, 'client');
const LOG_DIR = path.join(SERVER_DIR, 'logs');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_ord_cancel_reopen';
process.env.EMAIL_TEST_TRANSPORT = 'stream';

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

// ---- Keine Dateien im Repository: Schreibzugriffe auf server/logs umleiten ----
const LOG_REDIRECT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ord-w3c-logs-'));
const redirectLogPath = (target) => {
  const text = typeof target === 'string' ? target : '';
  if (text && path.resolve(text).startsWith(LOG_DIR + path.sep)) {
    return path.join(LOG_REDIRECT_DIR, path.basename(text));
  }
  return target;
};
['appendFileSync', 'writeFileSync', 'mkdirSync'].forEach((name) => {
  const original = fs[name];
  fs[name] = function redirected(target, ...rest) { return original.call(this, redirectLogPath(target), ...rest); };
});
['appendFile', 'writeFile'].forEach((name) => {
  const original = fs.promises[name];
  fs.promises[name] = function redirected(target, ...rest) { return original.call(this, redirectLogPath(target), ...rest); };
});
const originalAppendFile = fs.appendFile;
fs.appendFile = function redirected(target, ...rest) { return originalAppendFile.call(this, redirectLogPath(target), ...rest); };

// 'qrcode' fehlt lokal (nur PDF-Erzeugung).
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
const ts = require(path.join(CLIENT_DIR, 'node_modules/typescript'));

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
const section = async (title, fn) => {
  out(`\n${title}`);
  try { await fn(); } catch (error) {
    fail += 1;
    out(`  FAIL Abschnitt brach ab :: ${error && error.stack ? error.stack.split('\n').slice(0, 5).join(' | ') : error}`);
  }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Client-Modul (TypeScript) mit dem Compiler des Clients laden - ohne Netzwerk, ohne Browser.
const loadClientTs = (relative) => {
  const file = path.join(CLIENT_DIR, relative);
  const source = fs.readFileSync(file, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', output)(mod, mod.exports, Module.createRequire(file));
  return mod.exports;
};


async function main() {
  if (isUnsafeTestUri(URI)) throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  fs.readdirSync(path.join(SERVER_DIR, 'models')).filter((f) => f.endsWith('.js')).forEach((f) => { try { require(path.join(SERVER_DIR, 'models', f)); } catch (e) { /* optional */ } });
  await mongoose.model('Notification').createIndexes();
  await mongoose.model('NotificationDedupeClaim').createIndexes();
  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.buildSystemUrl = async (p) => `http://test.invalid${p}`;
  const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));
  DHLService.createShipment = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };

  const app = express();
  app.use(express.json());
  app.use('/api/admin/orders', require(path.join(SERVER_DIR, 'routes/adminOrderRoutes')));
  app.use('/api/orders', require(path.join(SERVER_DIR, 'routes/orderRoutes')));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const User = mongoose.model('User'); const Order = mongoose.model('Order');
  const customer = await User.create({ name: 'Rita Reopen', email: 'reopen-kunde@test.invalid', role: 'customer' });
  const staff = await User.create({ name: 'Stefan Staff', email: 'reopen-staff@test.invalid', role: 'staff', isActive: true });
  const admin = await User.create({ name: 'Anna Admin', email: 'reopen-admin@test.invalid', role: 'admin', isActive: true });
  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, user, body) => {
    const r = await fetch(`${baseUrl}${url}`, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let json = null; try { json = await r.json(); } catch (e) { json = null; }
    return { status: r.status, body: json };
  };
  const stored = async (id) => Order.findById(id).setOptions({ skipAutoPopulate: true }).lean();
  const order = await Order.create({
    customerId: customer._id, orderNumber: 'ORD-REOPEN-001', deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
    errorDescription: 'Display', totalCost: 49.9, status: 'in-progress',
    workflows: [{ workflowTemplateId: new mongoose.Types.ObjectId(), workflowName: 'Standard Repair Process', status: 'in-progress', steps: [] }],
  });
  const id = String(order._id);

  out('\n[1] Storno ueber den Dialog-Weg (Grund Pflicht)');
  let r = await call('PUT', `/api/admin/orders/${id}/status`, staff, { status: 'cancelled' });
  check(r.status === 400, 'Storno ohne Grund abgelehnt', `${r.status} ${r.body?.error}`);
  r = await call('PUT', `/api/admin/orders/${id}/status`, staff, { status: 'cancelled', note: 'Kunde hat abgesagt' });
  check(r.status === 200 && (await stored(id)).status === 'cancelled', 'Storno mit Grund gespeichert', r.status);
  const afterCancel = await stored(id);
  check((afterCancel.workflows || []).every((w) => w.status !== 'in-progress'), 'laufender Workflow wurde angehalten', JSON.stringify((afterCancel.workflows || []).map((w) => w.status)));
  const timelineBefore = (afterCancel.timeline || []).length;

  out('\n[2] Kein Fortsetzen ueber das Statusmenue');
  for (const [route, who] of [['/api/admin/orders', staff], ['/api/admin/orders', admin], ['/api/orders', staff], ['/api/orders', admin]]) {
    r = await call('PUT', `${route}/${id}/status`, who, { status: 'in-progress' });
    check(r.status === 409 && r.body?.code === 'ORDER_CANCELLED', `${route} (${who.role}): in-progress nach Storno -> 409 ORDER_CANCELLED`, `${r.status} ${r.body?.code}`);
  }
  r = await call('PUT', `/api/admin/orders/${id}/status`, admin, { status: 'completed' });
  check(r.status === 409, 'auch "Abgeschlossen" nach Storno -> 409', r.status);
  const still = await stored(id);
  check(still.status === 'cancelled' && (still.timeline || []).length === timelineBefore, 'Auftrag bleibt storniert, kein Verlaufseintrag', `${still.status} ${(still.timeline || []).length}`);

  out('\n[3] Stornierung aufheben: nur Admin, Grund Pflicht, Ziel "pending"');
  r = await call('PUT', `/api/admin/orders/${id}/status`, staff, { status: 'pending', reopen: true, note: 'versehentlich' });
  check(r.status === 403 && r.body?.code === 'REOPEN_ADMIN_ONLY', 'Staff darf nicht wieder oeffnen (403)', `${r.status} ${r.body?.code}`);
  r = await call('PUT', `/api/admin/orders/${id}/status`, customer, { status: 'pending', reopen: true, note: 'x' });
  check(r.status === 403, 'Kunde: 403', r.status);
  r = await call('PUT', `/api/admin/orders/${id}/status`, admin, { status: 'pending', reopen: true });
  check(r.status === 400 && r.body?.code === 'REOPEN_REASON_REQUIRED', 'Admin ohne Grund -> 400', `${r.status} ${r.body?.code}`);
  r = await call('PUT', `/api/admin/orders/${id}/status`, admin, { status: 'in-progress', reopen: true, note: 'weiter' });
  check(r.status === 400 && r.body?.code === 'REOPEN_TARGET_INVALID', 'Admin direkt nach "In Bearbeitung" -> 400', `${r.status} ${r.body?.code}`);
  r = await call('PUT', `/api/admin/orders/${id}/status`, admin, { status: 'pending', reopen: true, note: 'Storno versehentlich ausgeloest' });
  const reopened = await stored(id);
  check(r.status === 200 && reopened.status === 'pending', 'Admin mit Grund: wieder "Ausstehend"', `${r.status} ${reopened.status}`);
  const last = (reopened.timeline || []).slice(-1)[0] || {};
  check(last.status === 'Order Reopened' && /versehentlich/.test(last.reason || '') && /Admin/.test(last.staffName || ''), 'Verlauf: "Stornierung aufgehoben" mit Grund und Akteur', JSON.stringify({ k: last.status, r: last.reason, a: last.staffName }));
  check((reopened.workflows || []).every((w) => w.status !== 'in-progress'), 'angehaltene Workflows bleiben angehalten', JSON.stringify((reopened.workflows || []).map((w) => w.status)));
  r = await call('GET', `/api/orders/${id}/history`, customer);
  const custHist = JSON.stringify(r.body || {});
  check(r.status === 200 && !custHist.includes('versehentlich') && !custHist.includes('Kunde hat abgesagt'), 'Kundenverlauf zeigt keine internen Gruende', r.status);
  r = await call('PUT', `/api/admin/orders/${id}/status`, staff, { status: 'in-progress' });
  check(r.status === 200, 'nach dem Aufheben normaler Statuswechsel wieder moeglich', r.status);

  out(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((error) => { out('ERROR:', error.stack || error.message); process.exit(2); });
