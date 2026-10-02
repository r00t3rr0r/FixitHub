/**
 * Regressionstest: Laufzeit-Logdateien duerfen fehlen (server/logs ist nicht mehr versioniert).
 *
 * Hintergrund (02.10.2026): server/logs/* (EmailDelivery-/EmailRetry-/EmailService-*.log,
 * email-delivery-log.json, smtp-connection-log.json) wurden aus dem Git-Index entfernt und
 * in .gitignore aufgenommen. Nach einem git pull fehlen diese Dateien bzw. das ganze
 * Verzeichnis. Der Server muss sie dann selbst wieder anlegen; email-delivery-log.json ist
 * Laufzeitzustand der Admin-Seite "E-Mail-Verwaltung" (Statistik, Verlauf, Protokoll).
 *
 * Abgesichert:
 *   1. Logger legt ein fehlendes (verschachteltes) Verzeichnis beim Start an und schreibt.
 *   2. Logger legt das Verzeichnis neu an, wenn es ZUR LAUFZEIT geloescht wurde (vorher:
 *      "Failed to write log file", Zeilen gingen verloren).
 *   3. EmailDeliveryTracker toleriert fehlende, leere, kaputte und Nicht-Array-JSON-Dateien,
 *      legt sie beim ersten Schreiben neu an; Statistik/Verlauf funktionieren.
 *   4. EmailDeliveryTracker/EmailRetryHandler schreiben ihre Tageslogs in das uebergebene
 *      Verzeichnis (logsDir) - nicht nach server/logs.
 *
 * Arbeitet AUSSCHLIESSLICH in einem frisch angelegten Temp-Verzeichnis; keine Datenbank,
 * kein Netzwerk, kein Zugriff auf server/logs.
 *   node test-logs-bootstrap.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

const REAL_LOGS = path.join(__dirname, 'server', 'logs');
const Logger = require(path.join(__dirname, 'server/utils/logger'));
const { EmailDeliveryTracker, EmailRetryHandler } = require(path.join(__dirname, 'server/utils/emailLogger'));

let pass = 0;
let fail = 0;
const check = (condition, message, actual = '') => {
  if (condition) pass += 1; else fail += 1;
  console.log(`  ${condition ? 'PASS' : 'FAIL'} ${message}${actual !== '' ? ` :: ${actual}` : ''}`);
};

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'logs-bootstrap-'));
if (path.resolve(ROOT).startsWith(path.resolve(REAL_LOGS))) {
  console.error('Abbruch: Temp-Verzeichnis liegt in server/logs');
  process.exit(2);
}
const today = () => new Date().toISOString().split('T')[0];
const quiet = { enableConsole: false };

async function main() {
  console.log('1. Logger: fehlendes Verzeichnis beim Start');
  const dir1 = path.join(ROOT, 'a', 'b', 'logs');
  const logger = new Logger('BootstrapTest', { ...quiet, logDir: dir1 });
  check(fs.existsSync(dir1), 'verschachteltes Verzeichnis angelegt');
  logger.info('erste Zeile');
  const file1 = path.join(dir1, `BootstrapTest-${today()}.log`);
  check(fs.existsSync(file1) && fs.readFileSync(file1, 'utf8').trim().split('\n').length === 1, 'Tageslog angelegt, 1 Zeile');

  console.log('2. Logger: Verzeichnis zur Laufzeit geloescht');
  fs.rmSync(dir1, { recursive: true, force: true });
  const origError = console.error;
  let writeErrors = 0;
  console.error = (...args) => { if (String(args[0]).includes('Failed to write log file')) writeErrors += 1; else origError(...args); };
  try {
    logger.warn('zweite Zeile');
  } finally {
    console.error = origError;
  }
  check(writeErrors === 0, 'kein "Failed to write log file"', writeErrors);
  check(fs.existsSync(file1) && fs.readFileSync(file1, 'utf8').trim().split('\n').length === 1, 'Verzeichnis + Datei neu angelegt, Zeile geschrieben');

  console.log('3. EmailDeliveryTracker: fehlend/leer/kaputt/kein Array');
  const cases = { missing: null, empty: '', corrupt: '{"id":"x", kaputt', nonarray: '{"a":1}' };
  for (const [name, content] of Object.entries(cases)) {
    const dir = path.join(ROOT, `tracker-${name}`, 'logs');
    if (content !== null) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'email-delivery-log.json'), content);
      fs.writeFileSync(path.join(dir, 'smtp-connection-log.json'), content);
    }
    const origLog = console.log;
    const origErr = console.error;
    console.log = () => {};
    console.error = () => {};
    let tracker;
    try {
      tracker = new EmailDeliveryTracker({ logsDir: dir });
    } finally {
      console.log = origLog;
      console.error = origErr;
    }
    tracker.logger.enableConsole = false;
    check(fs.existsSync(dir), `[${name}] Verzeichnis vorhanden`);
    check(Array.isArray(tracker.deliveryLog) && tracker.deliveryLog.length === 0, `[${name}] Zustellprotokoll leer`, tracker.deliveryLog.length);
    check(Array.isArray(tracker.smtpConnectionLog) && tracker.smtpConnectionLog.length === 0, `[${name}] SMTP-Protokoll leer`, tracker.smtpConnectionLog.length);
    check(tracker.logger.logDir === dir, `[${name}] Tracker-Logger schreibt in logsDir`, tracker.logger.logDir === dir);

    tracker.recordDelivery({ to: 'bootstrap@logs.invalid', templateName: 'T', subject: 'S', messageId: '<m@logs.invalid>', status: 'sent', attempts: 1, duration: 5 });
    tracker.recordSMTPConnection({ source: 'test', host: 'localhost', port: 1025, status: 'verified' });
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'email-delivery-log.json'), 'utf8'));
    check(Array.isArray(saved) && saved.length === 1 && saved[0].status === 'sent', `[${name}] email-delivery-log.json gueltig neu geschrieben`, Array.isArray(saved) ? saved.length : typeof saved);
    const smtpSaved = JSON.parse(fs.readFileSync(path.join(dir, 'smtp-connection-log.json'), 'utf8'));
    check(Array.isArray(smtpSaved) && smtpSaved.length === 1, `[${name}] smtp-connection-log.json gueltig neu geschrieben`);
    check(fs.existsSync(path.join(dir, `EmailDelivery-${today()}.log`)), `[${name}] EmailDelivery-Tageslog im logsDir`);
    const stats = tracker.getStatistics();
    check(stats.totalRecords === 1 && stats.sent === 1 && stats.failureRate === 0, `[${name}] getStatistics`, JSON.stringify(stats));
    check(tracker.getDeliveryHistory('bootstrap@logs.invalid').length === 1, `[${name}] getDeliveryHistory`);
    check(tracker.getSMTPStatistics().verified === 1, `[${name}] getSMTPStatistics`);
    const reloaded = new EmailDeliveryTracker({ logsDir: dir });
    check(reloaded.deliveryLog.length === 1, `[${name}] Neustart liest Datei wieder ein`, reloaded.deliveryLog.length);

    // Verzeichnis zur Laufzeit geloescht -> naechster Eintrag legt alles neu an
    fs.rmSync(dir, { recursive: true, force: true });
    reloaded.logger.enableConsole = false;
    reloaded.recordDelivery({ to: 'bootstrap@logs.invalid', templateName: 'T', status: 'sent', attempts: 1, duration: 1 });
    const again = JSON.parse(fs.readFileSync(path.join(dir, 'email-delivery-log.json'), 'utf8'));
    check(again.length === 2, `[${name}] nach Laufzeit-Loeschung neu angelegt (Speicherstand erhalten)`, again.length);
  }

  console.log('4. EmailRetryHandler schreibt in logsDir');
  const dir4 = path.join(ROOT, 'retry', 'logs');
  const retry = new EmailRetryHandler({ logsDir: dir4, baseDelay: 1 });
  retry.logger.enableConsole = false;
  check(retry.logger.logDir === dir4, 'Retry-Logger nutzt logsDir');
  const res = await retry.executeWithRetry(async () => ({ messageId: '<r@logs.invalid>' }), 'bootstrapSend', { to: 'bootstrap@logs.invalid' });
  check(res.success === true && fs.existsSync(path.join(dir4, `EmailRetry-${today()}.log`)), 'EmailRetry-Tageslog im logsDir angelegt');

  console.log('5. Standardpfad unveraendert (ohne Option)');
  // Nur Pfadberechnung pruefen, ohne zu schreiben: Logger mit enableFileLogging=false.
  const defaultLogger = new Logger('DefaultPathProbe', { enableFileLogging: false, enableConsole: false });
  check(defaultLogger.logDir === REAL_LOGS, 'Standard-Logverzeichnis ist weiterhin server/logs');
}

main()
  .catch((error) => {
    fail += 1;
    console.log(`  FAIL unerwarteter Fehler :: ${error && error.message}`);
  })
  .finally(() => {
    fs.rmSync(ROOT, { recursive: true, force: true });
    console.log(`\nErgebnis: ${pass} PASS, ${fail} FAIL`);
    process.exit(fail ? 1 : 0);
  });
