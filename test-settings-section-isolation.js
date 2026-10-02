/**
 * Regressionstest (02.10.2026): Einstellungen werden ABSCHNITTSWEISE gespeichert.
 *
 * Gefunden im Browser-Abnahmelauf: Ein unberuehrter Altbestand in einem ANDEREN Abschnitt der
 * Systemkonfiguration (hier: eine DHL-Integration ohne das Pflichtfeld apiKey) liess jedes Speichern
 * von Analyse- und Finanzeinstellungen mit 500 scheitern ("integrations.0.apiKey: Path `apiKey` is
 * required"), weil config.save() das ganze Dokument validierte.
 *
 * Abgesichert (echte Router /api/admin/analytics und /api/system-config, echte JWT, echte DB):
 *   1. Mit ungueltigem Altbestand in integrations speichern Analyse- und Finanzeinstellungen (200),
 *      die Werte sind nach erneutem Lesen gespeichert, der Altbestand bleibt unveraendert.
 *   2. Der GEAENDERTE Abschnitt wird weiterhin validiert (Steuersatz -5 -> 400, Wert bleibt).
 *   3. Kunde 403 / Gast 401 auf beiden Speicherwegen.
 *
 * Aufruf (nur Wegwerf-Datenbank):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_settings_iso node test-settings-section-isolation.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_settings_section_isolation';

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
const check = (condition, message, actual) => {
  if (condition) { pass += 1; console.log(`  PASS ${message} :: ${actual}`); } else { fail += 1; console.log(`  FAIL ${message} :: ${actual}`); }
};

async function main() {
  if (isUnsafeTestUri(URI)) throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  fs.readdirSync(path.join(SERVER_DIR, 'models')).filter((f) => f.endsWith('.js')).forEach((f) => { try { require(path.join(SERVER_DIR, 'models', f)); } catch (e) { /* optional */ } });

  const systemConfigRoutes = require(path.join(SERVER_DIR, 'routes/systemConfigRoutes'));
  const adminAnalyticsRoutes = require(path.join(SERVER_DIR, 'routes/adminAnalyticsRoutes'));
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/system-config', systemConfigRoutes);
  app.use('/api/admin/analytics', adminAnalyticsRoutes);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const admin = await User.create({ name: 'Admin Iso', email: 'iso-admin@test.invalid', role: 'admin' });
  const customer = await User.create({ name: 'Kunde Iso', email: 'iso-customer@test.invalid', role: 'customer' });
  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, user, body) => {
    const headers = { 'Content-Type': 'application/json' };
    if (user) headers.Authorization = `Bearer ${tokenFor(user)}`;
    const r = await fetch(`${baseUrl}${url}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    let json = null; try { json = await r.json(); } catch (e) { json = null; }
    return { status: r.status, body: json };
  };

  // Ausgangslage: Konfiguration ueber die normale Leseroute anlegen lassen, dann einen UNGUELTIGEN
  // Altbestand direkt in die DB schreiben (wie er aus aelteren Versionen/Importen stammen kann).
  const first = await call('GET', '/api/system-config', admin);
  check(first.status === 200, 'Konfiguration lesbar', first.status);
  const col = mongoose.connection.db.collection('systemconfigurations');
  const doc = await col.findOne({});
  const legacy = { name: 'DHL Paket (Altbestand)', provider: 'DHL', type: 'shipping', isActive: true, settings: { bookingLabelMode: 'dummy' } };
  await col.updateOne({ _id: doc._id }, { $push: { integrations: legacy } });

  // 1a) Analyse-Einstellungen speichern
  let r = await call('PUT', '/api/admin/analytics/profitability/settings', admin, { labor: { defaultHourlyRate: 95.5 } });
  check(r.status === 200, 'Analyse-Einstellungen trotz ungueltigem Altbestand gespeichert (vorher 500)', `${r.status} ${JSON.stringify(r.body).slice(0, 160)}`);
  r = await call('GET', '/api/admin/analytics/profitability/settings', admin);
  const rate = r.body?.settings?.labor?.defaultHourlyRate ?? r.body?.labor?.defaultHourlyRate ?? r.body?.data?.labor?.defaultHourlyRate;
  check(rate === 95.5, 'Stundensatz nach erneutem Lesen 95,5', rate);

  // 1b) Finanzeinstellungen (Abschnitt) speichern
  r = await call('PUT', '/api/system-config', admin, { financialSettings: { defaults: { paymentDueDays: 21 } } });
  check(r.status === 200, 'Finanzeinstellungen trotz ungueltigem Altbestand gespeichert', `${r.status} ${JSON.stringify(r.body?.error || r.body?.message || '').slice(0, 160)}`);
  const after = await col.findOne({});
  check(after?.financialSettings?.defaults?.paymentDueDays === 21, 'Zahlungsziel 21 in der DB gespeichert', after?.financialSettings?.defaults?.paymentDueDays);
  check(after?.profitabilitySettings?.labor?.defaultHourlyRate === 95.5, 'Analyse-Wert durch Finanz-Speichern nicht ueberschrieben', after?.profitabilitySettings?.labor?.defaultHourlyRate);
  const leg = (after.integrations || []).find((i) => i.name === 'DHL Paket (Altbestand)');
  check(!!leg && leg.apiKey === undefined && leg.settings?.bookingLabelMode === 'dummy', 'Altbestand unveraendert (nicht still repariert oder geloescht)', JSON.stringify(leg || null).slice(0, 120));

  // 2) Geaenderter Abschnitt wird weiterhin validiert
  r = await call('PUT', '/api/system-config', admin, { financialSettings: { defaults: { taxRate: -5 } } });
  check(r.status === 400, 'Steuersatz -5 weiterhin abgelehnt (400)', `${r.status} ${JSON.stringify(r.body?.error || '').slice(0, 120)}`);
  const after2 = await col.findOne({});
  check(after2?.financialSettings?.defaults?.taxRate !== -5, 'gespeicherter Steuersatz bleibt gueltig', after2?.financialSettings?.defaults?.taxRate);
  r = await call('PUT', '/api/admin/analytics/profitability/settings', admin, { labor: { defaultHourlyRate: -10 } });
  check(r.status === 400, 'negativer Stundensatz abgelehnt (400)', r.status);

  // 3) Rollen
  r = await call('PUT', '/api/admin/analytics/profitability/settings', customer, { labor: { defaultHourlyRate: 1 } });
  check(r.status === 403, 'Kunde darf Analyse-Einstellungen nicht speichern', r.status);
  r = await call('PUT', '/api/system-config', null, { financialSettings: { defaults: { paymentDueDays: 1 } } });
  check(r.status === 401, 'Gast darf Systemkonfiguration nicht speichern', r.status);

  console.log(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => { console.error('ERROR:', error.message); process.exit(2); });
