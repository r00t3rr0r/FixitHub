/**
 * Regressionstest: Das Admin-Seeding darf ein bestehendes Admin-Passwort NIE veraendern.
 *
 * Hintergrund:
 *   server.js ruft bei jedem Start SeedService.seedAll() auf, und die oeffentlichen Routen
 *   POST /api/seed/admin und /api/seed/all rufen dasselbe ohne Anmeldung auf. seedAdminUser()
 *   hat fuer einen bestehenden admin@example.com das Passwort jedes Mal auf einen im Quelltext
 *   fest hinterlegten Wert zurueckgesetzt. Folge: Das Admin-Passwort war fuer jeden mit
 *   Quelltextzugriff bekannt, und jede Passwortaenderung wurde beim naechsten Neustart
 *   stillschweigend rueckgaengig gemacht.
 *
 * Invarianten, die dieser Test absichert:
 *   - Ein bestehender Admin behaelt nach seedAll()/seedAdminUser() (je zweimal) exakt denselben Hash.
 *   - Es gibt kein fest verdrahtetes Passwort: neue Admins bekommen SEED_ADMIN_PASSWORD oder ein
 *     Zufallspasswort, das nur beim Anlegen einmal im Log erscheint und nie im Rueckgabewert.
 *
 * Aufruf (benoetigt eine WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_seed_admin node test-seed-admin-password.js
 */
const path = require('path');
const fs = require('fs');
const mongoose = require(path.join(__dirname, 'server/node_modules/mongoose'));

const MODELS_DIR = path.join(__dirname, 'server/models');
const SERVICES_DIR = path.join(__dirname, 'server/services');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_seed_admin';
const SEED_EMAIL = 'admin@example.com';
// Der bis zu diesem Fix fest verdrahtete Wert - darf nirgends mehr gelten.
const OLD_HARDCODED_PASSWORD = 'admin123';

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

// Fuehrt fn aus und sammelt dabei alle Konsolenausgaben des Seed-Codes (statt sie auszugeben).
async function captureLogs(fn) {
  const lines = [];
  const original = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  const sink = (...args) => lines.push(args.map((a) => (typeof a === 'string' ? a : String(a))).join(' '));
  console.log = sink;
  console.warn = sink;
  console.error = sink;
  console.info = sink;
  try {
    const result = await fn();
    return { result, logs: lines.join('\n') };
  } finally {
    Object.assign(console, original);
  }
}

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }

  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  // Alle Modelle registrieren, damit seedAll() (Blog, FAQ, SEO, Workflows ...) durchlaeuft.
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
  const SeedService = require(path.join(SERVICES_DIR, 'seedService'));
  const { generatePasswordHash, validatePassword } = require(path.join(__dirname, 'server/utils/password'));
  const savedEnvPassword = process.env.SEED_ADMIN_PASSWORD;
  delete process.env.SEED_ADMIN_PASSWORD;

  console.log('\n[Fall 1] Bestehender Admin mit eigenem Passwort - seedAll() und seedAdminUser() je zweimal');
  const ownPassword = 'Eigenes-Admin-Passwort-9!';
  const ownHash = await generatePasswordHash(ownPassword);
  await User.create({ email: SEED_EMAIL, password: ownHash, name: 'Admin User', role: 'admin', isActive: true });

  const { logs: logs1 } = await captureLogs(async () => {
    await SeedService.seedAll();
    await SeedService.seedAll();
    await SeedService.seedAdminUser();
    await SeedService.seedAdminUser();
  });
  const after1 = await User.findOne({ email: SEED_EMAIL }).lean();
  check(after1.password === ownHash, 'Passwort-Hash unveraendert', after1.password === ownHash ? 'identisch' : 'GEAENDERT');
  const ownStillValid = await validatePassword(ownPassword, after1.password);
  check(ownStillValid, 'Eigenes Passwort gilt weiterhin', ownStillValid);
  const oldValid1 = await validatePassword(OLD_HARDCODED_PASSWORD, after1.password);
  check(!oldValid1, 'Frueheres Standardpasswort gilt NICHT', oldValid1 ? 'gilt' : 'gilt nicht');
  const adminCount1 = await User.countDocuments({ role: 'admin' });
  check(adminCount1 === 1, 'Kein zusaetzlicher Admin angelegt', adminCount1);
  const passwordLogged1 = /generated initial password/i.test(logs1);
  check(!passwordLogged1, 'Kein Passwort im Log bei bestehendem Admin', passwordLogged1 ? 'geloggt' : 'nicht geloggt');

  console.log('\n[Fall 2] Anderer Admin existiert (andere E-Mail) - admin@example.com wird NICHT angelegt');
  await mongoose.connection.dropDatabase();
  const otherHash = await generatePasswordHash('Anderer-Admin-7?');
  await User.create({ email: 'chef@test.invalid', password: otherHash, name: 'Chef', role: 'admin', isActive: true });
  await captureLogs(async () => {
    await SeedService.seedAll();
    await SeedService.seedAdminUser();
  });
  const seededAnyway = await User.exists({ email: SEED_EMAIL });
  check(!seededAnyway, 'admin@example.com nicht angelegt', seededAnyway ? 'vorhanden' : 'nicht vorhanden');
  const other = await User.findOne({ email: 'chef@test.invalid' }).lean();
  check(other.password === otherHash, 'Hash des anderen Admins unveraendert', other.password === otherHash ? 'identisch' : 'GEAENDERT');

  console.log('\n[Fall 3] Leere DB ohne SEED_ADMIN_PASSWORD - Zufallspasswort, nur einmal geloggt');
  await mongoose.connection.dropDatabase();
  const { result: first, logs: firstLogs } = await captureLogs(() => SeedService.seedAll());
  const created = await User.findOne({ email: SEED_EMAIL }).lean();
  check(Boolean(created) && created.role === 'admin', 'Admin angelegt', created && created.role);
  const logged = (firstLogs.match(/generated initial password for admin@example\.com: (\S+)/) || [])[1];
  const loggedTimes = (firstLogs.match(/generated initial password/gi) || []).length;
  check(Boolean(logged) && loggedTimes === 1, 'Initialpasswort beim Anlegen genau einmal geloggt', `${loggedTimes}x`);
  const loggedMatches = Boolean(logged) && (await validatePassword(logged, created.password));
  check(loggedMatches, 'Geloggtes Passwort passt zum Hash', loggedMatches);
  const oldValid3 = await validatePassword(OLD_HARDCODED_PASSWORD, created.password);
  check(!oldValid3, 'Frueheres Standardpasswort gilt NICHT', oldValid3 ? 'gilt' : 'gilt nicht');
  const firstJson = JSON.stringify(first);
  const secretInResult = (Boolean(logged) && firstJson.includes(logged)) || firstJson.includes(created.password);
  check(
    !secretInResult,
    'Weder Passwort noch Hash im Rueckgabewert (oeffentliche Route /api/seed/all)',
    secretInResult ? 'enthalten' : 'nicht enthalten'
  );

  const { logs: laterLogs } = await captureLogs(async () => {
    await SeedService.seedAll();
    await SeedService.seedAdminUser();
  });
  const createdAfter = await User.findOne({ email: SEED_EMAIL }).lean();
  check(createdAfter.password === created.password, 'Hash nach weiteren Starts unveraendert', createdAfter.password === created.password ? 'identisch' : 'GEAENDERT');
  const loggedAgain = (Boolean(logged) && laterLogs.includes(logged)) || /generated initial password/i.test(laterLogs);
  check(!loggedAgain, 'Passwort bei spaeteren Starts nicht erneut geloggt', loggedAgain ? 'erneut geloggt' : 'nicht geloggt');

  // Zweite leere DB: ein fest verdrahtetes Passwort waere in beiden Laeufen identisch.
  await mongoose.connection.dropDatabase();
  const { logs: secondLogs } = await captureLogs(() => SeedService.seedAdminUser());
  const logged2 = (secondLogs.match(/generated initial password for admin@example\.com: (\S+)/) || [])[1];
  check(Boolean(logged2) && logged2 !== logged, 'Zufallspasswort unterscheidet sich je Datenbank', Boolean(logged2) && logged2 !== logged);

  console.log('\n[Fall 4] Leere DB mit SEED_ADMIN_PASSWORD - Wert wird verwendet, aber nie geloggt');
  await mongoose.connection.dropDatabase();
  const envPassword = `Env-${Date.now()}-Pw!`;
  process.env.SEED_ADMIN_PASSWORD = envPassword;
  const { result: envResult, logs: envLogs } = await captureLogs(() => SeedService.seedAdminUser());
  delete process.env.SEED_ADMIN_PASSWORD;
  const envAdmin = await User.findOne({ email: SEED_EMAIL }).lean();
  const envApplied = await validatePassword(envPassword, envAdmin.password);
  check(envApplied, 'SEED_ADMIN_PASSWORD gesetzt', envApplied);
  const envLogged = envLogs.includes(envPassword);
  check(!envLogged, 'SEED_ADMIN_PASSWORD nicht im Log', envLogged ? 'geloggt' : 'nicht geloggt');
  const envInResult = JSON.stringify(envResult).includes(envPassword);
  check(!envInResult, 'SEED_ADMIN_PASSWORD nicht im Rueckgabewert', envInResult ? 'enthalten' : 'nicht enthalten');

  console.log('\n[Fall 6] Produktion, leere DB ohne SEED_ADMIN_PASSWORD - kein Admin, kein Passwort im Log, Start laeuft weiter');
  await mongoose.connection.dropDatabase();
  const savedNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  let prodError = null;
  const { result: prodResult, logs: prodLogs } = await captureLogs(() => SeedService.seedAll().catch((error) => { prodError = error; return null; }));
  const prodAdmins = await User.countDocuments({ $or: [{ role: 'admin' }, { email: SEED_EMAIL }] });
  check(!prodError && prodResult, 'seedAll laeuft in Produktion ohne Admin-Passwort durch (kein Startabbruch)', prodError ? prodError.message : 'ok');
  check(prodAdmins === 0, 'kein Admin angelegt (weder Standard- noch Zufallspasswort)', prodAdmins);
  check(!/generated initial password/i.test(prodLogs), 'kein Passwort im Serverprotokoll', /generated initial password/i.test(prodLogs) ? 'geloggt' : 'nicht geloggt');
  check(/SEED_ADMIN_PASSWORD is not set/.test(prodLogs), 'deutlicher Hinweis im Protokoll, was zu tun ist', /SEED_ADMIN_PASSWORD is not set/.test(prodLogs));
  const prodEnvPassword = `Prod-${Date.now()}-Pw!`;
  process.env.SEED_ADMIN_PASSWORD = prodEnvPassword;
  await captureLogs(() => SeedService.seedAdminUser());
  delete process.env.SEED_ADMIN_PASSWORD;
  const prodAdmin = await User.findOne({ email: SEED_EMAIL }).lean();
  check(Boolean(prodAdmin) && await validatePassword(prodEnvPassword, prodAdmin.password), 'Produktion mit SEED_ADMIN_PASSWORD: Admin mit genau diesem Passwort', Boolean(prodAdmin));
  await captureLogs(() => SeedService.seedAll());
  const prodAdminAfterRestart = await User.findOne({ email: SEED_EMAIL }).lean();
  check(prodAdminAfterRestart && prodAdminAfterRestart.password === prodAdmin.password, 'erneuter Start (seedAll) laesst den Hash unveraendert', prodAdminAfterRestart && prodAdminAfterRestart.password === prodAdmin.password);
  if (savedNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = savedNodeEnv;

  console.log('\n[Fall 5] Quelltext: kein Passwort-Literal im Seed-Code');
  const source = fs.readFileSync(path.join(SERVICES_DIR, 'seedService.js'), 'utf8');
  const literalHash = source.match(/generatePasswordHash\(\s*['"`][^'"`]*['"`]\s*\)/);
  check(!literalHash, 'Kein generatePasswordHash(\'<Literal>\')', literalHash ? literalHash[0] : 'keins');
  const oldInSource = source.includes(OLD_HARDCODED_PASSWORD);
  check(!oldInSource, 'Frueheres Standardpasswort nicht im Quelltext', oldInSource ? 'enthalten' : 'nicht enthalten');

  if (savedEnvPassword !== undefined) process.env.SEED_ADMIN_PASSWORD = savedEnvPassword;

  console.log(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('ERROR:', error.message);
  process.exit(2);
});
