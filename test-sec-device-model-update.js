/**
 * Regressionstest (02.10.2026): PUT /api/devices/models/:id war ohne jede Anmeldung nutzbar - jeder konnte
 * Katalogmodelle umbenennen, einer anderen Marke/Geraeteart zuordnen oder deaktivieren.
 * Jetzt: Admin darf alles; ohne Admin-Rechte (oeffentlicher Konfigurator, der Bild/Spezifikationen aus
 * der Mobile-API ergaenzt) werden NUR leere Anreicherungsfelder befuellt, alles andere wird ignoriert.
 *
 * Echte Route /api/devices, echte JWT, echte DB. Aufruf (nur Wegwerf-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_sec_devmodel node test-sec-device-model-update.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_sec_device_model_update';

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
  app.use('/api/devices', require(path.join(SERVER_DIR, 'routes/deviceRoutes')));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const User = mongoose.model('User'); const DeviceModel = mongoose.model('DeviceModel'); const DeviceBrand = mongoose.model('DeviceBrand'); const DeviceType = mongoose.model('DeviceType');
  const admin = await User.create({ name: 'Admin', email: 'dm-admin@test.invalid', role: 'admin', isActive: true });
  const customer = await User.create({ name: 'Kunde', email: 'dm-kunde@test.invalid', role: 'customer' });
  const tokenFor = (u) => jwt.sign({ sub: String(u._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, user, body) => {
    const r = await fetch(`${baseUrl}${url}`, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let json = null; try { json = await r.json(); } catch (e) { json = null; }
    return { status: r.status, body: json };
  };
  await DeviceType.create({ _id: 'smartphone', name: 'Smartphone' });
  const apple = await DeviceBrand.create({ name: 'Apple' });
  const other = await DeviceBrand.create({ name: 'Fremdmarke' });
  const m = await DeviceModel.create({ name: 'iPhone 15', brandId: apple._id, deviceType: 'smartphone', image: '' });
  const id = String(m._id);
  const stored = () => DeviceModel.findById(id).lean();

  console.log('\n[1] Ohne Anmeldung: Stammdaten bleiben, leere Anreicherung wird ergaenzt');
  let r = await call('PUT', `/api/devices/models/${id}`, null, { name: 'GEHACKT', brandId: String(other._id), deviceType: 'tablet', isActive: false, slug: 'x', image: 'https://img.example/iphone15.png', battery: { type: 'Li-Ion 3349 mAh' } });
  let s = await stored();
  check(r.status === 200, 'Anfrage beantwortet (Konfigurator bricht nicht ab)', r.status);
  check(s.name === 'iPhone 15' && String(s.brandId) === String(apple._id) && s.deviceType === 'smartphone' && s.isActive !== false, 'Name/Marke/Typ/Aktiv unveraendert', `${s.name} ${s.deviceType} ${s.isActive}`);
  check(s.image === 'https://img.example/iphone15.png' && s.battery?.type === 'Li-Ion 3349 mAh', 'leeres Bild + Akku-Daten ergaenzt', `${s.image} ${s.battery?.type}`);
  check(Array.isArray(r.body?.ignoredFields) && r.body.ignoredFields.includes('name') && r.body.ignoredFields.includes('brandId'), 'ignorierte Felder werden gemeldet', JSON.stringify(r.body?.ignoredFields));

  console.log('\n[2] Bereits befuellte Felder werden ohne Admin nicht ueberschrieben');
  r = await call('PUT', `/api/devices/models/${id}`, customer, { image: 'https://boese.example/x.png', battery: { type: 'falsch' } });
  s = await stored();
  check(s.image === 'https://img.example/iphone15.png' && s.battery?.type === 'Li-Ion 3349 mAh', 'Kunde ueberschreibt Bild/Akku nicht', `${s.image} ${s.battery?.type}`);

  console.log('\n[3] Admin darf Stammdaten aendern');
  r = await call('PUT', `/api/devices/models/${id}`, admin, { name: 'iPhone 15 (A3090)', image: 'https://img.example/neu.png' });
  s = await stored();
  check(r.status === 200 && s.name === 'iPhone 15 (A3090)' && s.image === 'https://img.example/neu.png', 'Admin: Name und Bild geaendert', `${r.status} ${s.name}`);
  r = await call('PUT', `/api/devices/models/000000000000000000000000`, null, { image: 'x' });
  check(r.status === 404, 'unbekanntes Modell ohne Anmeldung: 404', r.status);

  console.log(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERROR:', e.stack || e.message); process.exit(2); });
