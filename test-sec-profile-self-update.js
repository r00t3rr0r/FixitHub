/**
 * Regressionstest (02.10.2026, Track admin): PUT /api/users/me darf nur Selbstbedienungs-Felder aendern.
 * Vorher: der komplette Request-Body ging an User.findOneAndUpdate - jeder eingeloggte Kunde konnte sich
 * mit { role: 'admin' } selbst zum Admin machen (sofort wirksam, die Rolle wird je Anfrage aus der DB gelesen)
 * und status, email, discount, customerNumber, internalKey usw. setzen.
 * Echte Routen (userRoutes + adminRoutes) + echte DB. Aufruf (nur Wegwerf-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_r3_admin_profile node test-sec-profile-self-update.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_sec_profile_self_update';

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
  const app = express();
  app.use(express.json());
  app.use('/api/users', require(path.join(SERVER_DIR, 'routes/userRoutes')));
  app.use('/api/admin', require(path.join(SERVER_DIR, 'routes/adminRoutes')));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const User = mongoose.model('User');
  const tokenFor = (u) => jwt.sign({ sub: String(u._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, user, body) => {
    const r = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    let json = null; try { json = await r.json(); } catch (e) { json = null; }
    return { status: r.status, body: json };
  };

  try {
    const customer = await User.create({ name: 'Kunde Profil', firstName: 'Kunde', lastName: 'Profil', email: 'profil-kunde@test.invalid', role: 'customer', status: 'active', customerNumber: 'K-1000' });
    const staff = await User.create({ name: 'Mitarbeiter', email: 'profil-staff@test.invalid', role: 'staff', status: 'active' });
    const admin = await User.create({ name: 'Admin', email: 'profil-admin@test.invalid', role: 'admin', status: 'active' });

    console.log('\n[1] Vorher: Kunde hat keinen Admin-Zugriff');
    let r = await call('GET', '/api/admin/users', customer);
    check(r.status === 403, 'Kunde GET /api/admin/users', r.status);

    console.log('\n[2] Kunde versucht ueber PUT /api/users/me geschuetzte Felder zu setzen');
    r = await call('PUT', '/api/users/me', customer, {
      firstName: 'Neu',
      phone: '+49 30 000000',
      invoiceAddress: { street: 'Teststr. 1', city: 'Berlin', zipCode: '10115', country: 'DE' },
      preferences: { notifications: { email: false } },
      role: 'admin',
      status: 'blocked',
      isActive: false,
      email: 'umgeleitet@test.invalid',
      customerNumber: 'K-9999',
      internalKey: 'X',
      discount: 90,
      totalSpent: 1,
      passwordResetToken: 'abc',
      $set: { role: 'admin' }
    });
    check(r.status === 200, 'Antwort 200', r.status);
    const after = await User.findById(customer._id).lean();
    check(after.role === 'customer', 'Rolle bleibt customer', after.role);
    check(after.status === 'active' && after.isActive !== false, 'status/isActive unveraendert', `${after.status}/${after.isActive}`);
    check(after.email === 'profil-kunde@test.invalid', 'E-Mail unveraendert', after.email === 'profil-kunde@test.invalid');
    check(after.customerNumber === 'K-1000', 'Kundennummer unveraendert', after.customerNumber);
    check(!after.internalKey, 'internalKey nicht gesetzt', after.internalKey || '-');
    check(Number(after.discount || 0) !== 90, 'Rabatt nicht selbst setzbar', after.discount);
    check(Number(after.totalSpent || 0) !== 1, 'totalSpent nicht selbst setzbar', after.totalSpent);
    check(!after.passwordResetToken, 'passwordResetToken nicht selbst setzbar', after.passwordResetToken || '-');
    check(after.firstName === 'Neu' && after.phone === '+49 30 000000', 'erlaubte Felder gespeichert (Vorname, Telefon)', `${after.firstName}/${after.phone}`);
    check(after.invoiceAddress && after.invoiceAddress.city === 'Berlin', 'Rechnungsadresse gespeichert', after.invoiceAddress && after.invoiceAddress.city);
    check(after.preferences && after.preferences.notifications && after.preferences.notifications.email === false, 'Benachrichtigungs-Einstellung gespeichert', after.preferences && after.preferences.notifications && after.preferences.notifications.email);
    check(r.body && r.body.user && r.body.user.password === undefined, 'Antwort ohne Passwort-Hash', r.body && r.body.user ? Object.prototype.hasOwnProperty.call(r.body.user, 'password') : 'kein user');

    console.log('\n[3] Nachher: Kunde weiterhin ohne Admin-Zugriff');
    r = await call('GET', '/api/admin/users', customer);
    check(r.status === 403, 'Kunde GET /api/admin/users nach Versuch', r.status);

    console.log('\n[4] Mitarbeiter kann sich ebenfalls nicht hochstufen');
    r = await call('PUT', '/api/users/me', staff, { role: 'admin', firstName: 'Staff2' });
    const staffAfter = await User.findById(staff._id).lean();
    check(r.status === 200 && staffAfter.role === 'staff' && staffAfter.firstName === 'Staff2', 'Mitarbeiter-Rolle bleibt staff, Vorname gespeichert', `${r.status} ${staffAfter.role}`);

    console.log('\n[5] Anonym abgewiesen, Admin-Pfad fuer Rollenaenderung unveraendert');
    r = await call('PUT', '/api/users/me', null, { role: 'admin' });
    check(r.status === 401, 'anonym PUT /api/users/me', r.status);
    r = await call('PUT', `/api/admin/users/${customer._id}`, admin, { role: 'staff' });
    const promoted = await User.findById(customer._id).lean();
    check(r.status === 200 && promoted.role === 'staff', 'Admin kann Rolle ueber /api/admin/users/:id aendern', `${r.status} ${promoted.role}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  console.log(`\nErgebnis: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}

main().catch(async (error) => {
  console.error('Testabbruch:', error && error.message);
  try { await mongoose.disconnect(); } catch (e) { /* egal */ }
  process.exit(1);
});
