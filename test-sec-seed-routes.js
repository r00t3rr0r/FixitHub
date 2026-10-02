/**
 * Regressionstest (02.10.2026): Oeffentliche Seed-Routen duerfen ein bestehendes Admin-Konto nicht anfassen.
 * Vorher: anonymes POST /api/seed/admin setzte das Admin-Passwort auf den Standardwert aus dem Quelltext zurueck.
 * Jetzt: /api/seed/admin und /api/seed/all sind nur ohne vorhandenen Admin oeffentlich (Erstinstallation),
 * danach nur fuer Admins. Echte Route + echte DB. Aufruf (nur Wegwerf-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_sec_seed node test-sec-seed-routes.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
// Seit der Admin-Korrektur: ohne SEED_ADMIN_PASSWORD wuerde ein Zufallspasswort einmalig geloggt -
// im Test ein zufaelliger Wert, damit kein Passwort in Testprotokollen landet.
process.env.SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(12).toString('hex');
const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_sec_seed_routes';

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

let pass = 0;
let fail = 0;
const check = (c, m, a) => { if (c) { pass += 1; console.log(`  PASS ${m} :: ${a}`); } else { fail += 1; console.log(`  FAIL ${m} :: ${a}`); } };

async function main() {
  if (isUnsafeTestUri(URI)) throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  fs.readdirSync(path.join(SERVER_DIR, 'models')).filter((f) => f.endsWith('.js')).forEach((f) => { try { require(path.join(SERVER_DIR, 'models', f)); } catch (e) { /* optional */ } });
  const SeedService = require(path.join(SERVER_DIR, 'services/seedService.js'));
  SeedService.seedAll = async () => ({ mocked: true }); // Bootstrap-Inhalt ist nicht Gegenstand dieses Tests
  const app = express();
  app.use(express.json());
  app.use('/api/seed', require(path.join(SERVER_DIR, 'routes/seedRoutes')));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const User = mongoose.model('User');
  const tokenFor = (u) => jwt.sign({ sub: String(u._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, user) => {
    const r = await fetch(`${baseUrl}${url}`, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}) } });
    let json = null; try { json = await r.json(); } catch (e) { json = null; }
    return { status: r.status, body: json };
  };

  console.log('\n[1] Erstinstallation ohne Admin: Bootstrap oeffentlich');
  let r = await call('POST', '/api/seed/admin', null);
  const created = await User.findOne({ role: 'admin' }).select('+password').lean();
  check(r.status === 200 && !!created, 'ohne vorhandenen Admin legt POST /api/seed/admin den Admin an', r.status);

  console.log('\n[2] Admin vorhanden: anonyme/Kunden-Aufrufe aendern nichts');
  await User.updateOne({ _id: created._id }, { $set: { password: '$2b$10$EIGENESPASSWORTHASHDESADMINSXXXXXXXXXXXXXXXXXXXXXXXXXX' } });
  const hashBefore = (await User.findById(created._id).select('+password').lean()).password;
  const customer = await User.create({ name: 'Kunde', email: 'seed-kunde@test.invalid', role: 'customer' });
  for (const route of ['/api/seed/admin', '/api/seed/all']) {
    r = await call('POST', route, null);
    check(r.status === 401, `anonym ${route}: 401`, r.status);
    r = await call('POST', route, customer);
    check(r.status === 403, `Kunde ${route}: 403`, r.status);
  }
  const hashAfter = (await User.findById(created._id).select('+password').lean()).password;
  check(hashAfter === hashBefore, 'Passwort des bestehenden Admins unveraendert', hashAfter === hashBefore);
  r = await call('POST', '/api/seed/all', { _id: created._id });
  check(r.status === 200, 'Admin darf den Bootstrap weiterhin ausloesen', r.status);

  console.log(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERROR:', e.stack || e.message); process.exit(2); });
