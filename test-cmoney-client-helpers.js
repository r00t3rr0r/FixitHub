/**
 * Regressionstest (02.10.2026) Fix-Welle cMoney: gemeinsame Geld-/Dezimal-/Blob-Wege im Client,
 * ohne Datenbank und ohne Netzwerk (Client-TypeScript wird mit dem Compiler des Clients
 * transpiliert, HTTP-Antworten liefert ein lokaler axios-Adapter).
 *
 *  [1] lib/parseDecimalInput: "49.90" und "49,90" => 49,9; "1.234,50" => 1234,5 (PAR-2/PAR-7).
 *  [2] RepairRequestsManagement (Kostenvoranschlag) und FinancialManagement (Ueberzahlung)
 *      nutzen die gemeinsame Regel statt eigener Komma/Punkt-Parser (PAR-2/PAR-7).
 *  [3] Finanz-CSV-Export und Lieferantenrechnung: Blob-Antwort kommt als Blob an, obwohl die
 *      Instanz einen JSON-Transform mit data.trim() hat (PAR-1/RES-4). Mit dem alten
 *      responseType-only-Aufruf scheitert der Export mit "data.trim is not a function".
 *  [4] repairRequestFormat.formatMoney ist der gemeinsame Formatierer (ungueltiger
 *      Waehrungscode -> EUR statt RangeError) (PAR-5 Client).
 *  [5] Startseiten-Shop und Reklamationen: Betrag immer de-DE "49,90 €", nie nach Sprache
 *      bzw. "12.50 EUR" (PAR-6 a/b).
 *  [6] Kein import nach dem Komponentenende (RES-2).
 *
 * Aufruf: node test-cmoney-client-helpers.js
 */
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

// Schutzregel aller Tests (aus test-percent-rounding-consistency.js). Dieser Test nutzt keine
// Datenbank; ist dennoch eine URI gesetzt, darf sie nie die Entwicklungsdatenbank sein.
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
if (process.env.TEST_MONGODB_URI && isUnsafeTestUri(process.env.TEST_MONGODB_URI)) {
  throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
}

const CLIENT = path.join(__dirname, 'client');
const ts = require(path.join(CLIENT, 'node_modules/typescript'));
const axios = require(path.join(CLIENT, 'node_modules/axios')).default || require(path.join(CLIENT, 'node_modules/axios'));

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
const plain = (text) => String(text).replace(/ /g, ' ');
const read = (relative) => fs.readFileSync(path.join(CLIENT, relative), 'utf8');

// Transpiliert eine Client-Datei; '@/x' -> src/x.ts(x), relative Importe ueber stubs oder rekursiv.
const loadTs = (relative, stubs = {}) => {
  const file = path.join(CLIENT, relative);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const nodeRequire = createRequire(file);
  const localRequire = (spec) => {
    if (Object.prototype.hasOwnProperty.call(stubs, spec)) return stubs[spec];
    if (spec.startsWith('@/')) {
      const base = `src/${spec.slice(2)}`;
      const ext = fs.existsSync(path.join(CLIENT, `${base}.ts`)) ? '.ts' : '.tsx';
      return loadTs(`${base}${ext}`, stubs);
    }
    if (spec.startsWith('./')) {
      const base = path.join(path.dirname(relative), spec);
      if (fs.existsSync(path.join(CLIENT, `${base}.ts`))) return loadTs(`${base}.ts`, stubs);
    }
    return nodeRequire(spec);
  };
  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', output)(mod, mod.exports, localRequire);
  return mod.exports;
};

(async () => {
  console.log('\n[1] Gemeinsame Dezimalregel');
  const { parseDecimalInput } = loadTs('src/lib/parseDecimalInput.ts');
  check(parseDecimalInput('49.90') === 49.9, '"49.90" => 49,9', parseDecimalInput('49.90'));
  check(parseDecimalInput('49,90') === 49.9, '"49,90" => 49,9', parseDecimalInput('49,90'));
  check(parseDecimalInput('1.234,50') === 1234.5, '"1.234,50" => 1234,5', parseDecimalInput('1.234,50'));

  console.log('\n[2] Keine eigenen Komma/Punkt-Parser fuer Geldbetraege');
  const rrm = read('src/pages/admin/RepairRequestsManagement.tsx');
  const parseAmountBody = (rrm.match(/const parseAmount = \(\)[\s\S]*?\n {2}\}/) || [''])[0];
  check(/parseDecimalInput\(quoteAmount\)/.test(parseAmountBody) && !/replace\(/.test(parseAmountBody),
    'Kostenvoranschlag: parseAmount nutzt parseDecimalInput (frueher "49.90" -> 4990 €)', parseAmountBody.replace(/\s+/g, ' ').slice(0, 120));
  const fin = read('src/pages/admin/FinancialManagement.tsx');
  check(!/parseFloat\(\s*overpaymentAmount/.test(fin) && /parseDecimalInput\(overpaymentAmount\)/.test(fin),
    'Ueberzahlung: parseDecimalInput statt parseFloat(x.replace(",", ".")) (frueher "1.234,50" -> 1,234)', 'geprueft');

  console.log('\n[3] Blob-Downloads ueber die gemeinsame Konfiguration');
  const CSV = 'Rechnungsnummer;Datum;Betrag\nRE-1;02.10.2026;49,90\n';
  const requests = [];
  // Nachbildung der Instanz aus api.ts: akzeptiert jeden Status, JSON-Transform ruft data.trim() auf.
  const fakeApi = axios.create({
    validateStatus: () => true,
    transformResponse: [(data) => {
      if (!data || data.trim() === '') return {};
      return JSON.parse(data);
    }],
    adapter: async (config) => {
      requests.push(config);
      const data = config.responseType === 'blob' ? new Blob([CSV], { type: 'text/csv' }) : JSON.stringify({ items: [] });
      return { data, status: 200, statusText: 'OK', headers: {}, config, request: {} };
    },
  });
  const stubs = { './api': { __esModule: true, default: fakeApi } };
  const financial = loadTs('src/api/financial.ts', stubs);
  for (const [name, call] of [
    ['exportPayments', () => financial.exportPayments({}, 'csv')],
    ['exportInvoicesData', () => financial.exportInvoicesData({}, 'csv')],
    ['exportInvoicesData ZM', () => financial.exportInvoicesData({ isReverseCharge: true }, 'csv')],
  ]) {
    try {
      const res = await call();
      const text = res.data instanceof Blob ? await res.data.text() : `kein Blob: ${typeof res.data}`;
      check(text.startsWith('Rechnungsnummer;'), `${name}(csv) liefert die CSV-Datei als Blob`, JSON.stringify(text.slice(0, 24)));
    } catch (error) {
      check(false, `${name}(csv) liefert die CSV-Datei als Blob`, error.message);
    }
  }
  try {
    const res = await financial.exportPayments({}, 'json');
    check(res.data && Array.isArray(res.data.items), 'exportPayments(json) bleibt JSON', JSON.stringify(res.data));
  } catch (error) {
    check(false, 'exportPayments(json) bleibt JSON', error.message);
  }
  const epart = loadTs('src/api/epartOrders.ts', stubs);
  try {
    const blob = await epart.downloadInvoice('abc');
    check(blob instanceof Blob, 'Lieferantenrechnung: downloadInvoice liefert Blob', blob && blob.constructor && blob.constructor.name);
  } catch (error) {
    check(false, 'Lieferantenrechnung: downloadInvoice liefert Blob', error.message);
  }
  for (const relative of ['src/api/users.ts', 'src/api/epartOrders.ts', 'src/api/financial.ts']) {
    const source = read(relative);
    check(/invoicePdfRequestConfig\(\)/.test(source) && !/transformResponse:\s*\[/.test(source),
      `${relative}: gemeinsame invoicePdfRequestConfig() statt eigener Blob-Kopie`, 'geprueft');
  }

  console.log('\n[4] Ein Geldformatierer fuer Reparaturanfragen');
  const rrFormat = loadTs('src/components/repair-request/repairRequestFormat.ts');
  const utils = loadTs('src/lib/utils.ts');
  let invalidCode;
  try { invalidCode = plain(rrFormat.formatMoney(1, 'XX!')); } catch (error) { invalidCode = `Fehler: ${error.message}`; }
  check(invalidCode === '1,00 €', 'ungueltiger Waehrungscode -> EUR (frueher RangeError)', invalidCode);
  check(plain(rrFormat.formatMoney(89)) === '89,00 €' && plain(rrFormat.formatMoney(1234.5)) === plain(utils.formatMoney(1234.5)),
    'formatMoney = lib/utils formatMoney', `${plain(rrFormat.formatMoney(89))} / ${plain(rrFormat.formatMoney(1234.5))}`);

  console.log('\n[5] Betraege immer de-DE');
  const shop = read('src/components/home/ShopSectionSimple.tsx');
  check(!/en-GB/.test(shop) && !/i18n\.language/.test(shop) && /formatEUR\(price\)/.test(shop),
    'Startseiten-Shop: formatEUR (frueher "€49.90" in der englischen Oberflaeche)', plain(utils.formatEUR(49.9)));
  const complaints = read('src/pages/admin/ComplaintsManagement.tsx');
  check(!/toFixed\(2\)\}?\s*EUR/.test(complaints) && (complaints.match(/formatEUR\(/g) || []).length >= 3,
    'Reklamationen: formatEUR statt "12.50 EUR"', plain(utils.formatEUR(12.5)));

  console.log('\n[6] Importe stehen im Importblock');
  for (const relative of ['src/components/admin/UserDetailsDialog.tsx', 'src/pages/admin/PartsManagement.tsx', 'src/pages/admin/ServiceManagement.tsx']) {
    const source = read(relative);
    const lines = source.split('\n');
    const firstCode = lines.findIndex((line) => /^(export |const |function |interface |type |let )/.test(line));
    const lateImport = lines.findIndex((line, index) => index > firstCode && /^import\s/.test(line));
    check(firstCode > 0 && lateImport === -1 && source.endsWith('\n') && /import \{ formatEUR \} from ['"]@\/lib\/utils['"]/.test(source),
      `${relative}: formatEUR-Import oben, Datei endet mit Zeilenumbruch`, lateImport === -1 ? 'sauber' : `Zeile ${lateImport + 1}`);
  }

  console.log(`\nErgebnis: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
