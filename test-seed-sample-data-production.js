/**
 * Regressionstest (Abschluss 02.10.2026): `server/scripts/seed-sample-data.js` verweigert mit NODE_ENV=production
 * und meldet das auch als Fehler (Exit-Code != 0).
 *
 * Vorher: die Sperre setzte process.exitCode = 1, der Aufrufer beendete danach aber mit process.exit(0) und
 * schrieb „Script completed successfully“ – ein Deploy-/Betriebsskript hätte die Verweigerung als Erfolg gesehen.
 *
 *   [A] NODE_ENV=production + --confirm -> Exit 1, Sperrmeldung, keine Erfolgsmeldung, keine Demo-Konten in der DB.
 *   [B] Gegenprobe ohne Produktion und ohne --confirm (Trockenlauf) -> Exit 0, keine Verbindung, keine Konten.
 *
 * Das Skript läuft als Kindprozess in einem leeren temporären Arbeitsverzeichnis (keine echte .env wird geladen);
 * DATABASE_URL zeigt auf die WEGWERF-Datenbank – selbst wenn die Sperre versagte, entstünde nichts außerhalb.
 * Aufruf:
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27199/t_close_seedsample node test-seed-sample-data-production.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, 'server');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27199/t_close_seedsample';

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
let pass = 0;
let fail = 0;
const check = (condition, message, actual) => {
  if (condition) { pass += 1; out(`  PASS ${message} :: ${actual}`); } else { fail += 1; out(`  FAIL ${message} :: ${actual}`); }
};

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }
  const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-sample-cwd-'));
  const script = path.join(SERVER_DIR, 'scripts', 'seed-sample-data.js');
  // Nur notwendige Variablen weitergeben (keine Secrets/.env des Aufrufers).
  const baseEnv = {
    PATH: process.env.PATH,
    HOME: cwd,
    NODE_OPTIONS: process.env.NODE_OPTIONS || '',
    NETGUARD_LOG: process.env.NETGUARD_LOG || '',
    NETGUARD_BLOCK_PORTS: process.env.NETGUARD_BLOCK_PORTS || '27017',
    DATABASE_URL: URI,
  };
  const run = (env, args) => spawnSync(process.execPath, [script, ...args], { cwd, env: { ...baseEnv, ...env }, encoding: 'utf8', timeout: 60000 });
  const userCount = async () => mongoose.connection.db.collection('users').countDocuments({});

  try {
    out('\n[A] Produktion -> Verweigerung mit Exit-Code 1');
    const prod = run({ NODE_ENV: 'production' }, ['--confirm']);
    const text = `${prod.stdout || ''}\n${prod.stderr || ''}`;
    check(prod.status === 1, 'Exit-Code 1 (vorher 0)', prod.status);
    check(/laeuft nicht mit NODE_ENV=production/.test(text), 'Sperrmeldung ausgegeben', /laeuft nicht/.test(text));
    check(!/completed successfully/.test(text), 'keine Erfolgsmeldung', !/completed successfully/.test(text));
    check(await userCount() === 0, 'keine Demo-Konten angelegt', await userCount());

    out('\n[B] Gegenprobe: Trockenlauf ausserhalb der Produktion');
    const dry = run({ NODE_ENV: 'development' }, []);
    const dryText = `${dry.stdout || ''}\n${dry.stderr || ''}`;
    check(dry.status === 0 && /DRY RUN MODE/.test(dryText), 'Trockenlauf -> Exit 0 mit Hinweis', `${dry.status} ${/DRY RUN MODE/.test(dryText)}`);
    check(await userCount() === 0, 'Trockenlauf legt nichts an', await userCount());
  } finally {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect();
    fs.rmSync(cwd, { recursive: true, force: true });
  }

  out(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((error) => {
  out(`FATAL ${error && error.stack ? error.stack : error}`);
  process.exit(1);
});
