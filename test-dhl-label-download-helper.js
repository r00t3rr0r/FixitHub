/**
 * Regressionstest DHL-2: Label-Downloads im Client.
 *
 * Frueher scheiterte JEDER Klick auf "Einsendelabel herunterladen" (Kunde und Team): die vier
 * Download-Helfer setzten `transformResponse: undefined` + `validateStatus: s === 200`; axios
 * faellt bei undefined auf den JSON-Transform der Instanz zurueck (data.trim() auf einem Blob ->
 * TypeError) und der Interceptor warf "Cannot read properties of undefined (reading 'url')".
 *
 * Dieser Test baut den ECHTEN Client-Code (client/src/api/labelPdf.ts inkl. api.ts und der echten
 * axios-Version aus client/node_modules) mit esbuild in ein temporaeres Verzeichnis AUSSERHALB des
 * Repos und ruft ihn gegen einen lokalen HTTP-Server (127.0.0.1) auf:
 *  [D1] 200 + PDF            -> Blob mit %PDF
 *  [D2] 404 + JSON-Fehler    -> deutsche Servermeldung, kein TypeError
 *  [D3] 403                  -> deutsche Berechtigungsmeldung, KEIN Logout/Redirect
 *  [D4] 200 + Nicht-PDF      -> deutsche Meldung "kein gültiges PDF"
 *  [D5] Gast: data:-URL      -> Blob; ungueltige data:-URL -> deutsche Meldung
 *  [D6] Altes Muster (transformResponse: undefined) schlaegt mit derselben axios-Version fehl
 *       (belegt die Ursache) und kommt in client/src/api nicht mehr vor (statische Pruefung)
 *  [D7] Exportierte Helfer der API-Module existieren (bookings.ts / orders.ts)
 *
 * Aufruf: node test-dhl-label-download-helper.js   (keine Datenbank, nur 127.0.0.1)
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');

const CLIENT_DIR = path.join(__dirname, 'client');

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

const PDF = Buffer.from('%PDF-1.4 TEST-EINSENDELABEL', 'utf8');

async function main() {
  const server = http.createServer((req, res) => {
    if (req.url === '/api/bookings/ok/shipping-label') {
      res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="DHL-Einsendelabel_BKG-1.pdf"' });
      return res.end(PDF);
    }
    if (req.url === '/api/bookings/missing/shipping-label') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Für diese Buchung ist kein Einsendelabel hinterlegt.' }));
    }
    if (req.url === '/api/bookings/foreign/shipping-label') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Zugriff verweigert.' }));
    }
    if (req.url === '/api/bookings/notpdf/shipping-label') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true }));
    }
    res.writeHead(500);
    return res.end('unexpected');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  // Minimale Browser-Umgebung fuer api.ts (localStorage, document.cookie, window).
  const events = [];
  global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  global.document = { cookie: '' };
  global.window = {
    location: { href: 'http://app.test/orders/1' },
    dispatchEvent: (event) => { events.push(event?.type || String(event)); return true; },
  };
  global.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };
  global.__LABEL_TEST_BASE_URL__ = baseUrl;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dhl-label-helper-'));
  try {
    const esbuild = require(path.join(CLIENT_DIR, 'node_modules/esbuild'));
    // Browser-nahe Transportschicht: wie der XHR-Adapter liefert sie bei responseType 'blob'
    // einen Blob (in Node liefert der http-Adapter sonst einen String/Buffer, und der Fehler
    // aus dem Browser - data.trim() auf einem Blob - waere nicht nachstellbar). Statusauswertung
    // ueber config.validateStatus wie bei axios' settle().
    fs.writeFileSync(path.join(tmpDir, 'setup.js'), [
      "import axios from 'axios';",
      "axios.defaults.baseURL = globalThis.__LABEL_TEST_BASE_URL__;",
      "axios.defaults.adapter = async (config) => {",
      "  const url = (config.baseURL || '') + config.url;",
      "  const r = await fetch(url, { method: String(config.method || 'get').toUpperCase() });",
      "  const data = config.responseType === 'blob' ? await r.blob() : await r.text();",
      "  const response = { data, status: r.status, statusText: r.statusText, headers: Object.fromEntries(r.headers), config, request: {} };",
      "  if (!config.validateStatus || config.validateStatus(r.status)) return response;",
      "  throw new axios.AxiosError('Request failed with status code ' + r.status, 'ERR_BAD_RESPONSE', config, {}, response);",
      "};",
    ].join('\n'));
    fs.writeFileSync(path.join(tmpDir, 'entry.js'), [
      "import './setup.js';",
      "export * from '@/api/labelPdf';",
      "export { default as api } from '@/api/api';",
      "import * as bookingsApi from '@/api/bookings';",
      "import * as ordersApi from '@/api/orders';",
      "export const bookingExports = Object.keys(bookingsApi);",
      "export const orderExports = Object.keys(ordersApi);",
    ].join('\n'));
    esbuild.buildSync({
      entryPoints: [path.join(tmpDir, 'entry.js')],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: path.join(tmpDir, 'bundle.cjs'),
      alias: { '@': path.join(CLIENT_DIR, 'src') },
      nodePaths: [path.join(CLIENT_DIR, 'node_modules')],
      define: { 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_API_DEBUG': '"false"', 'import.meta.env': '{}' },
      logLevel: 'error',
    });
    const helper = require(path.join(tmpDir, 'bundle.cjs'));

    console.log('\n[D1] 200 + PDF');
    const blob = await helper.fetchLabelPdf('/api/bookings/ok/shipping-label', 'inbound');
    const head = Buffer.from(await blob.arrayBuffer()).toString('utf8', 0, 5);
    check(blob instanceof Blob && head === '%PDF-' && blob.type === 'application/pdf', 'Blob mit PDF-Signatur', `${head} ${blob.type}`);

    console.log('\n[D2] 404 + JSON-Fehler');
    let error = null;
    try { await helper.fetchLabelPdf('/api/bookings/missing/shipping-label', 'inbound'); } catch (e) { error = e; }
    check(error && error.name === 'LabelPdfError' && error.status === 404 && error.message === 'Für diese Buchung ist kein Einsendelabel hinterlegt.',
      'Deutsche Servermeldung statt TypeError', `${error?.name} ${error?.status} ${error?.message}`);

    console.log('\n[D3] 403 ohne Logout');
    error = null;
    try { await helper.fetchLabelPdf('/api/bookings/foreign/shipping-label', 'inbound'); } catch (e) { error = e; }
    check(error && error.status === 403 && error.message === 'Sie haben keine Berechtigung für dieses Label.', 'Deutsche 403-Meldung', error?.message);
    check(global.window.location.href === 'http://app.test/orders/1' && !events.includes('auth-logout'), 'Kein Redirect auf /login, kein auth-logout', `${global.window.location.href} ${events.join(',')}`);

    console.log('\n[D4] 200 ohne PDF');
    error = null;
    try { await helper.fetchLabelPdf('/api/bookings/notpdf/shipping-label', 'inbound'); } catch (e) { error = e; }
    check(error && /kein gültiges PDF/.test(error.message), 'JSON statt PDF wird erkannt', error?.message);

    console.log('\n[D5] Gast: data:-URL');
    const dataBlob = await helper.dataUrlToPdfBlob(`data:application/pdf;base64,${PDF.toString('base64')}`);
    check(Buffer.from(await dataBlob.arrayBuffer()).toString('utf8', 0, 4) === '%PDF', 'data:-URL -> PDF-Blob', dataBlob.size);
    error = null;
    try { await helper.dataUrlToPdfBlob('https://example.invalid/label.pdf'); } catch (e) { error = e; }
    check(error && /kein Einsendelabel/.test(error.message), 'Ungueltige data:-URL -> deutsche Meldung', error?.message);
    check(helper.labelFilename('inbound', 'BKG-2026-0001') === 'DHL-Einsendelabel_BKG-2026-0001.pdf'
      && helper.labelFilename('outbound', 'ORD-1') === 'DHL-Versandlabel_ORD-1.pdf'
      && helper.labelFilename('inbound', 'BKG-1', true) === 'DHL-Testlabel_BKG-1.pdf', 'Einheitliche Dateinamen', helper.labelFilename('inbound', 'BKG-2026-0001'));

    console.log('\n[D6] Ursache belegt + statische Pruefung');
    error = null;
    try {
      await helper.api.get('/api/bookings/ok/shipping-label', { responseType: 'blob', transformResponse: undefined, validateStatus: (s) => s === 200 });
    } catch (e) { error = e; }
    check(error instanceof TypeError, 'Altes Muster scheitert mit derselben axios-Version (TypeError)', `${error?.name}: ${String(error?.message).slice(0, 60)}`);
    const offenders = fs.readdirSync(path.join(CLIENT_DIR, 'src/api'))
      .filter((file) => file.endsWith('.ts'))
      .filter((file) => fs.readFileSync(path.join(CLIENT_DIR, 'src/api', file), 'utf8')
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .some((line) => /transformResponse:\s*undefined/.test(line)));
    check(offenders.length === 0, 'Kein "transformResponse: undefined" mehr in client/src/api', offenders.join(',') || 'keine');

    console.log('\n[D7] Exportierte Helfer fuer Welle 2');
    const wantedBooking = ['getBookingInboundLabel', 'createBookingInboundLabel', 'downloadInboundLabel', 'printInboundLabel', 'downloadBookingShippingLabel', 'downloadBookingReturnLabel'];
    const wantedOrder = ['getOrderInboundLabel', 'downloadOrderShippingLabel', 'printOrderShippingLabel', 'downloadOrderReturnLabel'];
    check(wantedBooking.every((name) => helper.bookingExports.includes(name)), 'bookings.ts exportiert die Einsendelabel-Helfer', wantedBooking.filter((n) => !helper.bookingExports.includes(n)).join(',') || 'alle');
    check(wantedOrder.every((name) => helper.orderExports.includes(name)), 'orders.ts exportiert die Label-Helfer', wantedOrder.filter((n) => !helper.orderExports.includes(n)).join(',') || 'alle');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Testabbruch:', error);
  process.exit(1);
});
