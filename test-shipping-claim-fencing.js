/**
 * SHIPPING-RESIDUAL - Regressionstest: Label-Reservierungen (Fencing), Frist, Abgleich,
 * Produktcodes und Datenschutz der Versandansichten.
 *
 * Deckt die Befunde der Pruefung "REVIEW: shipping-b" ab:
 *  [F1]  DHL-Retoure am Auftrag: eine Anfrage, deren Frist abgelaufen ist und deren
 *        Reservierung inzwischen von einer anderen Anfrage uebernommen wurde, darf DHL nicht
 *        mehr aufrufen und nichts mehr ueberschreiben, freigeben oder markieren.
 *  [F1e] Die Frist (5 Minuten) wird vor dem DHL-Aufruf durchgesetzt; der Token-Abruf der
 *        Retoure hat ein Timeout.
 *  [F2]  Auslieferung: der Erfolgs-Schreibzugriff ist an die eigene Reservierung gebunden.
 *  [F3]  Abgleich (Auslieferung und Einsendung) loest keine NEUERE Reservierung.
 *  [F4]  Parcel-DE-Einsendelabel: abgeglichene Sendungsnummer ohne PDF = "Label existiert".
 *  [F5]  Einsende-Abgleich 'created' lehnt Buchungs- und fremde Sendungsnummern ab.
 *  [F6]  Verlaufstext je Ursache (kein "nicht eindeutig geantwortet" bei Speicherfehler).
 *  [F7]  Gast-Sendungsverfolgung: Fail-closed blendet ALLE Felder der Auslieferung aus.
 *  [F8]  Kunden sehen keine internen Abgleich-Details (GET /:id und /:id/shipments).
 *  [F9]  Unbekannte DHL-Produktcodes -> 400 vor jedem DHL-Aufruf; alte Kurzcodes bleiben.
 *  [F10] Abgleich 'created' mit derselben Sendungsnummer gleichzeitig an mehreren Auftraegen:
 *        genau einer uebernimmt sie (Sperre je Sendungsnummer statt Lesen-dann-Schreiben).
 *  [F10b] Kein Unique-Index auf Sendungsnummern; Altbestand mit Doppeln bleibt speicherbar;
 *        verwaiste Sperren werden uebernommen, frische fremde -> 409 TRACKING_NUMBER_BUSY.
 *  [F10c] Altes Rueckweg-Label der Buchung wird als solches gemeldet (nicht "Einsendung").
 *  [F11] Harte Gesamtfrist fuer den bezahlten Parcel-DE-Aufruf: eine tropfende Antwort (lokaler
 *        Server auf 127.0.0.1, echter axios-Transport) wird abgebrochen und gilt als unklar.
 *
 * ALLE DHL-Aufrufe sind GEMOCKT (axios.post/get werden ersetzt, jeder unerwartete externe
 * Aufruf wirft). Das ist Mock-Evidenz, KEINE Sandbox-Evidenz.
 *
 * Aufruf (benoetigt eine WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_shipping_fencing node test-shipping-claim-fencing.js
 */
const path = require('path');
const fs = require('fs');
const http = require('http');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const axios = require(require.resolve('axios', { paths: [SERVER_DIR] }));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_shipping_fencing';

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
process.env.JWT_SECRET = 'test-only-shipping-fencing-secret';
process.env.EMAIL_TEST_TRANSPORT = 'stream';

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
const show = (value) => {
  try { return JSON.stringify(value); } catch (e) { return String(value); }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// DHL-Mock mit steuerbaren "Toren": eine Anfrage bleibt haengen, bis der Test sie freigibt.
// ---------------------------------------------------------------------------
const shippingCalls = [];
const returnsCalls = [];
const tokenTimeouts = [];
const gates = { token: [], returns: [], shipping: [] };
const gateNext = (kind) => {
  const gate = {};
  gate.opened = new Promise((resolve) => { gate.release = resolve; });
  gate.reached = new Promise((resolve) => { gate.markReached = resolve; });
  gates[kind].push(gate);
  return gate;
};
const passGate = async (kind) => {
  const gate = gates[kind].shift();
  if (!gate) return 'ok';
  gate.markReached();
  return gate.opened;
};
let shippingMode = 'ok';
let shipmentCounter = 0;
let returnsCounter = 0;

const timeoutError = () => {
  const error = new Error('timeout of 30000ms exceeded');
  error.code = 'ECONNABORTED';
  return error;
};
const providerError = () => {
  const error = new Error('Request failed with status code 400');
  error.response = { status: 400, data: { title: 'Bad Request', status: 400, detail: 'Invalid' } };
  return error;
};

// Echter axios.post NUR fuer den lokalen Tropf-Server ([F11], 127.0.0.1) - so wirken die echten
// Transport-Optionen (timeout, signal) der Anfrage.
const realAxiosPost = axios.post.bind(axios);
let trickleUrl = '';

axios.post = async (url, body, config = {}) => {
  const target = String(url);
  if (trickleUrl && target.includes('/parcel/de/shipping/v2/orders') && shippingMode === 'trickle') {
    shippingCalls.push({ url: target, body });
    return realAxiosPost(trickleUrl, body, config);
  }
  if (target.includes('/auth/ropc/v1/token')) {
    tokenTimeouts.push(config && config.timeout);
    const outcome = await passGate('token');
    if (outcome === 'timeout') throw timeoutError();
    return { status: 200, data: { access_token: 'mock-token', token_type: 'Bearer', expires_in: 3600 } };
  }
  if (target.includes('/parcel/de/shipping/v2/orders')) {
    shippingCalls.push({ url: target, body });
    const outcome = await passGate('shipping');
    const mode = outcome !== 'ok' ? outcome : shippingMode;
    if (mode === 'timeout') throw timeoutError();
    if (mode === 'provider-error') throw providerError();
    shipmentCounter += 1;
    const shipmentNo = `0034043416200000${String(shipmentCounter).padStart(4, '0')}`;
    const pdf = Buffer.from(`%PDF-1.4 AUSLIEFERUNG ${shipmentNo}`, 'utf8').toString('base64');
    return {
      status: 200,
      data: { status: { title: 'OK', statusCode: 200 }, items: [{ shipmentNo, sstatus: { statusCode: 200 }, ...(mode === 'no-pdf' ? {} : { label: { b64: pdf, fileFormat: 'PDF' } }) }] },
    };
  }
  if (target.includes('/parcel/de/shipping/returns/v1/orders')) {
    returnsCalls.push({ url: target, body });
    const outcome = await passGate('returns');
    if (outcome === 'timeout') throw timeoutError();
    if (outcome === 'provider-error') throw providerError();
    returnsCounter += 1;
    const shipmentNo = `RETFENCE${String(returnsCounter).padStart(6, '0')}`;
    return { status: 201, data: { shipmentNo, label: { b64: Buffer.from(`%PDF-1.4 RETOURE ${shipmentNo}`).toString('base64') } } };
  }
  throw new Error(`Unerwarteter externer Aufruf im Test blockiert: ${target}`);
};
axios.get = async (url) => {
  throw new Error(`Unerwarteter externer GET im Test blockiert: ${url}`);
};

// ---------------------------------------------------------------------------
// HTTP-Hilfen
// ---------------------------------------------------------------------------
let baseUrl = '';
const request = (method, urlPath, { token, body } = {}) => new Promise((resolve, reject) => {
  const payload = body ? JSON.stringify(body) : null;
  const req = http.request(`${baseUrl}${urlPath}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
    },
  }, (res) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => {
      const raw = Buffer.concat(chunks);
      const type = String(res.headers['content-type'] || '');
      let data = raw;
      if (type.includes('application/json')) {
        try { data = JSON.parse(raw.toString('utf8')); } catch (e) { data = raw.toString('utf8'); }
      }
      resolve({ status: res.statusCode, headers: res.headers, data });
    });
  });
  req.on('error', reject);
  if (payload) req.write(payload);
  req.end();
});

const OUTBOUND_BODY = { shipmentData: { labelDirection: 'outbound' } };
const ADDRESS = { street: 'Lieferweg 7', city: 'Hamburg', zipCode: '20095', country: 'DE' };
const INTERNAL_KEYS = ['reconcileUrl', 'reconciliationReason', 'lockStale', 'lockStartedAt', 'reference'];

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }

  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  fs.readdirSync(path.join(SERVER_DIR, 'models'))
    .filter((file) => file.endsWith('.js'))
    .forEach((file) => {
      try { require(path.join(SERVER_DIR, 'models', file)); } catch (error) { /* optional */ }
    });

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Booking = mongoose.model('Booking');
  const SystemConfiguration = mongoose.model('SystemConfiguration');
  const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));
  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.sendOrderConfirmationEmail = async () => ({ success: true, mocked: true });
  EmailService.buildSystemUrl = async (urlPath) => `https://test.invalid${urlPath}`;
  const ORIGINAL_LEASE = DHLService.LABEL_LOCK_LEASE_MS;

  await SystemConfiguration.create({
    integrations: [{
      name: 'DHL Paket',
      type: 'shipping',
      provider: 'DHL',
      apiKey: 'mock-key',
      isActive: true,
      credentials: {
        clientId: 'mock-client', clientSecret: 'mock-secret', username: 'mock-user', password: 'mock-pass',
        apiEndpoint: 'https://api-sandbox.dhl.com', accountId: '33333333330102', receiverId: 'deu',
      },
      metadata: { environment: 'sandbox' },
      settings: {
        accountNumber: '33333333330102',
        product: 'V01PAK',
        shipperCompany: 'McRepair.de GmbH',
        shipperStreet: 'Werkstattstraße 5',
        shipperPostalCode: '10115',
        shipperCity: 'Berlin',
        shipperCountry: 'DE',
        shipperEmail: 'werkstatt@test.invalid',
        receiverId: 'deu',
      },
    }],
  });

  const admin = await User.create({ name: 'Admin Test', email: 'admin@test.invalid', role: 'admin' });
  const admin2 = await User.create({ name: 'Admin Zwei', email: 'admin2@test.invalid', role: 'admin' });
  const staff = await User.create({ name: 'Staff Test', email: 'staff@test.invalid', role: 'staff' });
  const anna = await User.create({
    name: 'Anna Kundin', firstName: 'Anna', lastName: 'Kundin', email: 'anna@test.invalid', role: 'customer',
    invoiceAddress: { street: 'Rechnungsallee 1', city: 'München', zipCode: '80331', country: 'DE' },
  });

  const token = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  const adminToken = token(admin);
  const admin2Token = token(admin2);
  const staffToken = token(staff);
  const annaToken = token(anna);

  let seq = 0;
  const makeOrder = (fields) => {
    seq += 1;
    return Order.create({
      orderNumber: `ORD-FEN-${String(seq).padStart(3, '0')}`,
      deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
      errorDescription: 'Display', totalCost: 100, status: 'ready-for-pickup',
      customerId: anna._id, shippingAddress: ADDRESS,
      ...fields,
    });
  };
  const raw = (id) => Order.collection.findOne({ _id: id });
  // Frist kuenstlich ablaufen lassen, Admin gleicht ab ("nicht angelegt"), Frist wieder normal.
  const expireLeaseAndReconcile = async (orderId, reconcilePath) => {
    DHLService.LABEL_LOCK_LEASE_MS = 20;
    await sleep(60);
    const reconciled = await request('POST', `/api/orders/${orderId}/${reconcilePath}`, { token: adminToken, body: { resolution: 'not-created' } });
    DHLService.LABEL_LOCK_LEASE_MS = ORIGINAL_LEASE;
    return reconciled;
  };

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/orders', require(path.join(SERVER_DIR, 'routes/orderRoutes')));
  app.use('/api/track-order', require(path.join(SERVER_DIR, 'routes/orderTrackingRoutes')));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  let res;
  let callsBefore;

  try {
    // -----------------------------------------------------------------------
    console.log('\n[F1] Retoure: abgelaufene Anfrage (Token haengt) wird uebernommen -> kein zweites Label');
    const f1 = await makeOrder({});
    const f1Gate = gateNext('token');
    callsBefore = returnsCalls.length;
    const f1A = request('POST', `/api/orders/${f1._id}/return-label`, { token: staffToken, body: {} });
    await f1Gate.reached;
    const f1Claim = await raw(f1._id);
    check(f1Claim.returnShipmentStatus === 'pending' && f1Claim.returnLabelCreationStartedAt instanceof Date,
      'Anfrage A hat den Einsendeplatz reserviert', `${f1Claim.returnShipmentStatus} ${f1Claim.returnLabelCreationStartedAt}`);
    res = await expireLeaseAndReconcile(f1._id, 'return-label/reconcile');
    check(res.status === 200, 'Nach Ablauf der Frist gleicht ein Admin "nicht angelegt" ab', `${res.status} ${show(res.data?.error || '')}`);
    const f1B = await request('POST', `/api/orders/${f1._id}/return-label`, { token: adminToken, body: {} });
    check(f1B.status === 200 && /^RETFENCE/.test(f1B.data?.returnTrackingNumber || ''), 'Anfrage B erstellt das Einsendelabel', `${f1B.status} ${f1B.data?.returnTrackingNumber || show(f1B.data?.error)}`);
    f1Gate.release('ok');
    const f1AResult = await f1A;
    const f1Doc = await raw(f1._id);
    check(returnsCalls.length === callsBefore + 1, 'Die abgelaufene Anfrage A ruft DHL NICHT mehr auf (genau ein bezahltes Label)', `calls+${returnsCalls.length - callsBefore}`);
    check(f1AResult.status === 409 && f1AResult.data?.code === 'LABEL_CLAIM_LOST',
      'A endet mit 409 LABEL_CLAIM_LOST (deutsche Meldung)', `${f1AResult.status} ${f1AResult.data?.code} ${show(f1AResult.data?.error)}`);
    check(f1Doc.returnTrackingNumber === f1B.data?.returnTrackingNumber && f1Doc.returnShipmentStatus === 'label-created',
      'Label von B bleibt unveraendert am Auftrag', `${f1Doc.returnTrackingNumber} ${f1Doc.returnShipmentStatus}`);

    console.log('\n[F1b] Retoure: DHL-Antwort kommt nach Uebernahme -> nichts ueberschreiben, Sendungsnummer protokollieren');
    const f1b = await makeOrder({});
    const f1bGate = gateNext('returns');
    const f1bA = request('POST', `/api/orders/${f1b._id}/return-label`, { token: staffToken, body: {} });
    await f1bGate.reached;
    res = await expireLeaseAndReconcile(f1b._id, 'return-label/reconcile');
    const f1bB = await request('POST', `/api/orders/${f1b._id}/return-label`, { token: adminToken, body: {} });
    f1bGate.release('ok');
    const f1bAResult = await f1bA;
    const f1bDoc = await raw(f1b._id);
    const f1bOrphan = (f1bDoc.timeline || []).find((entry) => entry.status === 'Inbound Label Orphaned');
    check(f1bB.status === 200 && f1bDoc.returnTrackingNumber === f1bB.data?.returnTrackingNumber,
      'Label von B wird durch die verspaetete Antwort von A NICHT ueberschrieben', `${f1bB.status} stored=${f1bDoc.returnTrackingNumber} B=${f1bB.data?.returnTrackingNumber}`);
    check(f1bAResult.status === 500 && f1bAResult.data?.code === 'LABEL_PERSIST_FAILED' && /Sendungsnummer RETFENCE/.test(String(f1bAResult.data?.error || '')),
      'A meldet LABEL_PERSIST_FAILED mit seiner Sendungsnummer', `${f1bAResult.status} ${f1bAResult.data?.code} ${show(f1bAResult.data?.error)}`);
    const f1bANumber = String(f1bAResult.data?.error || '').match(/RETFENCE\d+/)?.[0] || '---';
    check(Boolean(f1bOrphan) && f1bOrphan.description.includes(f1bANumber) && f1bANumber !== f1bB.data?.returnTrackingNumber,
      'Sendungsnummer von A steht als "nicht uebernommen" im Verlauf', show(f1bOrphan && f1bOrphan.description));
    const f1bState = await DHLService.getOrderShipmentState(f1b._id);
    check(f1bState.shipments.inbound.reconciliationRequired === false, 'Der Verlaufseintrag markiert keine neue Reservierung als abgleichbar', `recon=${f1bState.shipments.inbound.reconciliationRequired}`);

    console.log('\n[F1c] Retoure: eindeutiger Fehler nach Uebernahme gibt die NEUE Reservierung nicht frei');
    const f1c = await makeOrder({});
    const f1cGate = gateNext('returns');
    const f1cA = request('POST', `/api/orders/${f1c._id}/return-label`, { token: staffToken, body: {} });
    await f1cGate.reached;
    await expireLeaseAndReconcile(f1c._id, 'return-label/reconcile');
    const f1cBGate = gateNext('token');
    const f1cB = request('POST', `/api/orders/${f1c._id}/return-label`, { token: adminToken, body: {} });
    await f1cBGate.reached;
    const f1cBClaim = await raw(f1c._id);
    f1cGate.release('provider-error');
    const f1cAResult = await f1cA;
    const f1cAfterA = await raw(f1c._id);
    check(f1cAResult.status === 422 && f1cAfterA.returnShipmentStatus === 'pending'
      && String(f1cAfterA.returnLabelCreationStartedAt) === String(f1cBClaim.returnLabelCreationStartedAt),
      'DHL-400 von A loest die laufende Reservierung von B NICHT', `${f1cAResult.status} status=${f1cAfterA.returnShipmentStatus} startedAt gleich=${String(f1cAfterA.returnLabelCreationStartedAt) === String(f1cBClaim.returnLabelCreationStartedAt)}`);
    f1cBGate.release('ok');
    const f1cBResult = await f1cB;
    check(f1cBResult.status === 200, 'B schliesst danach normal ab', `${f1cBResult.status} ${show(f1cBResult.data?.error || f1cBResult.data?.returnTrackingNumber)}`);

    console.log('\n[F1d] Retoure: unklare Antwort nach Uebernahme markiert die NEUE Reservierung nicht');
    const f1d = await makeOrder({});
    const f1dGate = gateNext('returns');
    const f1dA = request('POST', `/api/orders/${f1d._id}/return-label`, { token: staffToken, body: {} });
    await f1dGate.reached;
    await expireLeaseAndReconcile(f1d._id, 'return-label/reconcile');
    const f1dBGate = gateNext('token');
    const f1dB = request('POST', `/api/orders/${f1d._id}/return-label`, { token: adminToken, body: {} });
    await f1dBGate.reached;
    f1dGate.release('timeout');
    await f1dA;
    const f1dState = await DHLService.getOrderShipmentState(f1d._id);
    check(f1dState.shipments.inbound.inProgress === true && f1dState.shipments.inbound.reconciliationRequired === false,
      'Laufende Reservierung von B bleibt "in Arbeit" (kein Abgleich waehrend B laeuft)', show({ inProgress: f1dState.shipments.inbound.inProgress, recon: f1dState.shipments.inbound.reconciliationRequired }));
    f1dBGate.release('ok');
    await f1dB;

    console.log('\n[F1e] Frist wird vor dem DHL-Aufruf durchgesetzt; Token-Abruf der Retoure hat ein Timeout');
    const f1e = await makeOrder({});
    callsBefore = returnsCalls.length;
    const tokenIndex = tokenTimeouts.length;
    DHLService.LABEL_LOCK_LEASE_MS = 1000;
    res = await request('POST', `/api/orders/${f1e._id}/return-label`, { token: staffToken, body: {} });
    DHLService.LABEL_LOCK_LEASE_MS = ORIGINAL_LEASE;
    const f1eDoc = await raw(f1e._id);
    check(res.status === 409 && res.data?.code === 'LABEL_CLAIM_EXPIRED' && returnsCalls.length === callsBefore,
      'Restfrist reicht nicht fuer die DHL-Anfrage -> 409, kein DHL-Aufruf', `${res.status} ${res.data?.code} calls+${returnsCalls.length - callsBefore} ${show(res.data?.error)}`);
    check(f1eDoc.returnShipmentStatus === '' && !f1eDoc.returnLabelCreationStartedAt, 'Eigene Reservierung wieder freigegeben', `status="${f1eDoc.returnShipmentStatus}"`);
    const retoureTokenTimeouts = tokenTimeouts.slice(tokenIndex);
    check(retoureTokenTimeouts.length > 0 && retoureTokenTimeouts.every((value) => Number(value) > 0 && Number(value) <= 15000),
      'Token-Abruf mit Timeout <= 15 s', show(retoureTokenTimeouts));

    // -----------------------------------------------------------------------
    console.log('\n[F2] Auslieferung: DHL-Antwort nach Uebernahme ueberschreibt die neue Sendung nicht');
    const f2 = await makeOrder({});
    const f2Gate = gateNext('shipping');
    const f2A = request('POST', `/api/orders/${f2._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
    await f2Gate.reached;
    res = await expireLeaseAndReconcile(f2._id, 'shipping/reconcile');
    const f2B = await request('POST', `/api/orders/${f2._id}/shipping/create-label`, { token: adminToken, body: OUTBOUND_BODY });
    f2Gate.release('ok');
    const f2AResult = await f2A;
    const f2Doc = await raw(f2._id);
    check(f2B.status === 200 && f2Doc.trackingNumber === f2B.data?.trackingNumber && f2Doc.shippingLabelCreationInProgress === false,
      'Sendung von B bleibt am Auftrag', `${f2B.status} stored=${f2Doc.trackingNumber} B=${f2B.data?.trackingNumber}`);
    check(f2AResult.status === 500 && f2AResult.data?.code === 'LABEL_PERSIST_FAILED'
      && (f2Doc.timeline || []).some((entry) => entry.status === 'Shipping Label Orphaned' && entry.description.includes(String(f2AResult.data?.error || '').match(/\d{20}/)?.[0] || '---')),
      'A: LABEL_PERSIST_FAILED, Sendungsnummer von A im Verlauf', `${f2AResult.status} ${f2AResult.data?.code}`);

    console.log('\n[F2b] Parcel DE (Auslieferung/Einsendung): Frist wird vor dem DHL-Aufruf durchgesetzt');
    // Auslieferung: Token-Abruf haengt, Frist laeuft ab, Admin gleicht ab, B erstellt -> A ruft DHL nicht mehr auf.
    DHLService.tokenCache.clear();
    const f2b = await makeOrder({});
    const f2bGate = gateNext('token');
    callsBefore = shippingCalls.length;
    const f2bA = request('POST', `/api/orders/${f2b._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
    await f2bGate.reached;
    await expireLeaseAndReconcile(f2b._id, 'shipping/reconcile');
    const f2bB = await request('POST', `/api/orders/${f2b._id}/shipping/create-label`, { token: adminToken, body: OUTBOUND_BODY });
    f2bGate.release('ok');
    const f2bAResult = await f2bA;
    const f2bDoc = await raw(f2b._id);
    check(f2bB.status === 200 && shippingCalls.length === callsBefore + 1 && f2bAResult.status === 409 && f2bAResult.data?.code === 'LABEL_CLAIM_LOST'
      && f2bDoc.trackingNumber === f2bB.data?.trackingNumber,
      'Auslieferung: abgelaufene Anfrage A ruft DHL nicht mehr auf, Sendung von B bleibt', `B=${f2bB.status} A=${f2bAResult.status} ${f2bAResult.data?.code} calls+${shippingCalls.length - callsBefore}`);
    // Restfrist zu kurz fuer Token + DHL-Timeout -> 409, kein Aufruf, eigene Sperre frei.
    const f2bShort = await makeOrder({});
    callsBefore = shippingCalls.length;
    DHLService.LABEL_LOCK_LEASE_MS = 1000;
    res = await request('POST', `/api/orders/${f2bShort._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
    DHLService.LABEL_LOCK_LEASE_MS = ORIGINAL_LEASE;
    const f2bShortDoc = await raw(f2bShort._id);
    check(res.status === 409 && res.data?.code === 'LABEL_CLAIM_EXPIRED' && shippingCalls.length === callsBefore
      && f2bShortDoc.shippingLabelCreationInProgress === false && !f2bShortDoc.shippingLabelCreationStartedAt,
      'Auslieferung: Restfrist zu kurz -> 409 LABEL_CLAIM_EXPIRED, kein DHL-Aufruf, Sperre frei', `${res.status} ${res.data?.code} calls+${shippingCalls.length - callsBefore} lock=${f2bShortDoc.shippingLabelCreationInProgress}`);
    const f2bIn = await makeOrder({});
    callsBefore = shippingCalls.length;
    DHLService.LABEL_LOCK_LEASE_MS = 1000;
    const f2bInError = await DHLService.createShipment(f2bIn._id, { labelDirection: 'inbound', receiverFromConfiguration: true, shipperName: 'Anna Kundin' }, { direction: 'inbound' }).catch((error) => error);
    DHLService.LABEL_LOCK_LEASE_MS = ORIGINAL_LEASE;
    const f2bInDoc = await raw(f2bIn._id);
    check(f2bInError?.status === 409 && f2bInError?.code === 'LABEL_CLAIM_EXPIRED' && shippingCalls.length === callsBefore
      && !f2bInDoc.returnShipmentStatus && !f2bInDoc.returnLabelCreationStartedAt,
      'Einsendelabel (Parcel DE): Restfrist zu kurz -> 409, kein DHL-Aufruf, Reservierung frei', `${f2bInError?.status} ${f2bInError?.code} calls+${shippingCalls.length - callsBefore} status="${f2bInDoc.returnShipmentStatus}"`);

    // -----------------------------------------------------------------------
    console.log('\n[F3] Abgleich loest keine NEUERE Reservierung (Auslieferung)');
    const f3 = await makeOrder({});
    await Order.collection.updateOne({ _id: f3._id }, { $set: { shippingLabelCreationInProgress: true, shippingLabelCreationStartedAt: new Date(Date.now() - 60 * 60 * 1000) } });
    const originalState = DHLService.getOrderShipmentState;
    let injected = false;
    let freshStart = null;
    DHLService.getOrderShipmentState = async function patchedState(orderId, ...rest) {
      const state = await originalState.call(this, orderId, ...rest);
      if (!injected && String(orderId) === String(f3._id)) {
        injected = true;
        // Zwischen Lesen und Schreiben: Admin A hat abgeglichen, eine neue Anfrage hat reserviert.
        freshStart = new Date();
        await Order.collection.updateOne({ _id: f3._id }, { $set: { shippingLabelCreationInProgress: true, shippingLabelCreationStartedAt: freshStart } });
      }
      return state;
    };
    res = await request('POST', `/api/orders/${f3._id}/shipping/reconcile`, { token: admin2Token, body: { resolution: 'not-created' } });
    DHLService.getOrderShipmentState = originalState;
    const f3Doc = await raw(f3._id);
    check(res.status === 409 && res.data?.code === 'NO_RECONCILIATION_PENDING' && f3Doc.shippingLabelCreationInProgress === true
      && String(f3Doc.shippingLabelCreationStartedAt) === String(freshStart),
      'Veralteter Abgleich trifft die neue Reservierung nicht (409, Sperre bleibt)', `${res.status} ${res.data?.code} lock=${f3Doc.shippingLabelCreationInProgress}`);

    console.log('\n[F3b] Abgleich loest keine NEUERE Reservierung (Einsendung)');
    const f3b = await makeOrder({});
    await Order.collection.updateOne({ _id: f3b._id }, { $set: { returnShipmentStatus: 'pending', returnLabelCreationStartedAt: new Date(Date.now() - 60 * 60 * 1000) } });
    injected = false;
    DHLService.getOrderShipmentState = async function patchedState(orderId, ...rest) {
      const state = await originalState.call(this, orderId, ...rest);
      if (!injected && String(orderId) === String(f3b._id)) {
        injected = true;
        freshStart = new Date();
        await Order.collection.updateOne({ _id: f3b._id }, { $set: { returnShipmentStatus: 'pending', returnLabelCreationStartedAt: freshStart } });
      }
      return state;
    };
    res = await request('POST', `/api/orders/${f3b._id}/return-label/reconcile`, { token: admin2Token, body: { resolution: 'created', trackingNumber: 'RETPORTAL7777' } });
    DHLService.getOrderShipmentState = originalState;
    const f3bDoc = await raw(f3b._id);
    check(res.status === 409 && f3bDoc.returnShipmentStatus === 'pending' && !f3bDoc.returnTrackingNumber,
      'Veralteter Einsende-Abgleich trifft die neue Reservierung nicht', `${res.status} ${res.data?.code} status=${f3bDoc.returnShipmentStatus} tn=${f3bDoc.returnTrackingNumber}`);

    console.log('\n[F3c] Altbestand ohne Startzeit bleibt abgleichbar');
    const f3c = await makeOrder({});
    await Order.collection.updateOne({ _id: f3c._id }, { $set: { returnShipmentStatus: 'pending' } });
    res = await request('POST', `/api/orders/${f3c._id}/return-label/reconcile`, { token: adminToken, body: { resolution: 'not-created' } });
    check(res.status === 200 && res.data?.shipments?.inboundAction?.allowed === true, 'Reservierung ohne Startzeit -> Abgleich 200', `${res.status} ${show(res.data?.error || res.data?.shipments?.inboundAction?.code)}`);

    // -----------------------------------------------------------------------
    console.log('\n[F4] Parcel-DE-Einsendelabel: abgeglichene Sendungsnummer ohne PDF = Label existiert');
    const f4 = await makeOrder({});
    await Order.collection.updateOne({ _id: f4._id }, { $set: { returnShipmentStatus: 'label-created', returnTrackingNumber: 'RETPORTAL4444', returnShipmentId: 'RETPORTAL4444', returnLabelUrl: '' } });
    callsBefore = shippingCalls.length;
    const f4Error = await DHLService.createShipment(f4._id, { labelDirection: 'inbound', receiverFromConfiguration: true, shipperName: 'Anna Kundin' }, { direction: 'inbound' }).catch((error) => error);
    check(f4Error?.code === 'EXISTING_SHIPMENT_LABEL_MISSING' && f4Error?.status === 409 && /RETPORTAL4444/.test(f4Error?.message) && shippingCalls.length === callsBefore,
      '409 EXISTING_SHIPMENT_LABEL_MISSING mit Portal-Hinweis, kein DHL-Aufruf', `${f4Error?.code} ${f4Error?.status} ${String(f4Error?.message || '').slice(0, 90)}`);

    // -----------------------------------------------------------------------
    console.log('\n[F5] Einsende-Abgleich "created": Buchungs- und fremde Sendungsnummern werden abgelehnt');
    const f5 = await makeOrder({});
    await Booking.create({
      customerId: anna._id, orderIds: [f5._id], repairOrderIds: [f5._id], totalCost: 100, items: [],
      trackingNumber: 'BOOKINGIN0001', returnTrackingNumber: 'BOOKINGRET001',
    });
    await makeOrder({ trackingNumber: 'OTHEROUT00001', returnTrackingNumber: 'OTHERRET00001' });
    await Order.collection.updateOne({ _id: f5._id }, { $set: { returnShipmentStatus: 'pending' } });
    const rejected = [];
    for (const candidate of ['BOOKINGIN0001', 'BOOKINGRET001', 'OTHEROUT00001', 'OTHERRET00001']) {
      res = await request('POST', `/api/orders/${f5._id}/return-label/reconcile`, { token: adminToken, body: { resolution: 'created', trackingNumber: candidate } });
      rejected.push([candidate, res.status, res.data?.code]);
    }
    check(rejected.every(([, status]) => status === 422), 'Alle vier fremden Nummern -> 422', show(rejected));
    const f5Doc = await raw(f5._id);
    check(f5Doc.returnShipmentStatus === 'pending' && !f5Doc.returnTrackingNumber, 'Einsendung bleibt im Abgleich, nichts uebernommen', `${f5Doc.returnShipmentStatus} ${f5Doc.returnTrackingNumber}`);
    res = await request('POST', `/api/orders/${f5._id}/return-label/reconcile`, { token: adminToken, body: { resolution: 'created', trackingNumber: 'RETPORTAL5555' } });
    check(res.status === 200 && res.data?.shipments?.inbound?.trackingNumber !== undefined, 'Eindeutige neue Nummer -> 200', `${res.status} ${show(res.data?.error || '')}`);
    const f5out = await makeOrder({});
    await Order.collection.updateOne({ _id: f5out._id }, { $set: { shippingLabelCreationInProgress: true } });
    res = await request('POST', `/api/orders/${f5out._id}/shipping/reconcile`, { token: adminToken, body: { resolution: 'created', trackingNumber: 'OTHEROUT00001' } });
    check(res.status === 422, 'Auslieferungs-Abgleich mit der Nummer eines anderen Auftrags -> 422', `${res.status} ${res.data?.code}`);

    // -----------------------------------------------------------------------
    console.log('\n[F6] Verlaufstexte je Ursache');
    const f6 = await makeOrder({});
    const originalUpdateOne = Order.updateOne;
    let failNext = true;
    Order.updateOne = function patchedUpdateOne(filter, update, ...rest) {
      if (failNext && String(filter?._id) === String(f6._id) && String(update?.$set?.shippingLabelUrl || '').startsWith('data:')) {
        failNext = false;
        return Promise.reject(new Error('simulierter Datenbankfehler'));
      }
      return originalUpdateOne.call(this, filter, update, ...rest);
    };
    res = await request('POST', `/api/orders/${f6._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
    Order.updateOne = originalUpdateOne;
    const f6Marker = ((await raw(f6._id)).timeline || []).filter((entry) => entry.status === 'Shipping Label Reconciliation Required').pop();
    check(res.data?.code === 'LABEL_PERSIST_FAILED' && f6Marker && /wurde bei DHL erstellt/.test(f6Marker.description) && !/nicht eindeutig/.test(f6Marker.description),
      'Speicherfehler: "bei DHL erstellt ... nicht gespeichert", kein "nicht eindeutig geantwortet"', show(f6Marker && f6Marker.description));
    const f6b = await makeOrder({});
    shippingMode = 'no-pdf';
    res = await request('POST', `/api/orders/${f6b._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
    shippingMode = 'ok';
    const f6bMarker = ((await raw(f6b._id)).timeline || []).filter((entry) => entry.status === 'Shipping Label Reconciliation Required').pop();
    check(f6bMarker && /kein PDF/.test(f6bMarker.description) && !/nicht eindeutig/.test(f6bMarker.description),
      'Fehlendes PDF: eigener Text', show(f6bMarker && f6bMarker.description));
    const f6c = await makeOrder({});
    shippingMode = 'timeout';
    res = await request('POST', `/api/orders/${f6c._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
    shippingMode = 'ok';
    const f6cMarker = ((await raw(f6c._id)).timeline || []).filter((entry) => entry.status === 'Shipping Label Reconciliation Required').pop();
    check(f6cMarker && /nicht rechtzeitig/.test(f6cMarker.description), 'Zeitueberschreitung: "nicht rechtzeitig"', show(f6cMarker && f6cMarker.description));
    const f6d = await makeOrder({});
    failNext = true;
    Order.updateOne = function patchedUpdateOne(filter, update, ...rest) {
      if (failNext && String(filter?._id) === String(f6d._id) && update?.$set?.returnShipmentStatus === 'label-created') {
        failNext = false;
        return Promise.reject(new Error('simulierter Datenbankfehler'));
      }
      return originalUpdateOne.call(this, filter, update, ...rest);
    };
    res = await request('POST', `/api/orders/${f6d._id}/return-label`, { token: staffToken, body: {} });
    Order.updateOne = originalUpdateOne;
    const f6dMarker = ((await raw(f6d._id)).timeline || []).filter((entry) => entry.status === 'Inbound Label Reconciliation Required').pop();
    check(res.data?.code === 'LABEL_PERSIST_FAILED' && f6dMarker && /wurde bei DHL erstellt/.test(f6dMarker.description) && !/nicht eindeutig/.test(f6dMarker.description),
      'Retoure-Speicherfehler: korrekter Text', show(f6dMarker && f6dMarker.description));

    // -----------------------------------------------------------------------
    console.log('\n[F7] Gast-Sendungsverfolgung: Fail-closed blendet alle Auslieferungsfelder aus');
    await makeOrder({
      customerId: null,
      guestTrackingToken: 'guest-token-fence',
      guestInfo: { isGuest: true, firstName: 'Gerd', lastName: 'Gast', email: 'gast@test.invalid' },
      trackingNumber: 'LEGACYIN00007777', shippingStatus: 'delivered', shippingStatusDescription: 'Zugestellt',
      actualDelivery: new Date(), estimatedDelivery: new Date(),
      trackingEvents: [{ timestamp: new Date(), status: 'delivered', description: 'Zugestellt' }],
    });
    DHLService.getOrderShipmentState = async () => { throw new Error('simulierter Fehler beim Versandstand'); };
    res = await request('GET', '/api/track-order?token=guest-token-fence&email=gast@test.invalid');
    DHLService.getOrderShipmentState = originalState;
    const guestOrder = res.data?.order || {};
    check(res.status === 200 && !guestOrder.trackingNumber && guestOrder.shippingStatus !== 'delivered' && !guestOrder.actualDelivery
      && !guestOrder.estimatedDelivery && !guestOrder.shippingStatusDescription && (guestOrder.trackingEvents || []).length === 0,
      'Keine Sendungsnummer, kein "zugestellt", keine Zustelldaten', show({ status: res.status, tn: guestOrder.trackingNumber, st: guestOrder.shippingStatus, actual: guestOrder.actualDelivery, est: guestOrder.estimatedDelivery, desc: guestOrder.shippingStatusDescription }));

    // -----------------------------------------------------------------------
    console.log('\n[F8] Kunden sehen keine internen Abgleich-Details');
    const f8 = await makeOrder({});
    await Order.collection.updateOne({ _id: f8._id }, { $set: { returnShipmentStatus: 'pending', shippingLabelCreationInProgress: true } });
    const leaked = (shipments) => ['outbound', 'inbound'].flatMap((direction) => INTERNAL_KEYS
      .filter((key) => shipments?.[direction] && Object.prototype.hasOwnProperty.call(shipments[direction], key))
      .map((key) => `${direction}.${key}`));
    res = await request('GET', `/api/orders/${f8._id}`, { token: annaToken });
    const detailLeaks = leaked(res.data?.order?.shipments);
    check(res.status === 200 && res.data?.order?.shipments && detailLeaks.length === 0, 'GET /:id (Kunde): keine internen Felder', `${res.status} ${show(detailLeaks)}`);
    res = await request('GET', `/api/orders/${f8._id}/shipments`, { token: annaToken });
    const shipmentsLeaks = leaked(res.data?.shipments);
    check(res.status === 200 && shipmentsLeaks.length === 0, 'GET /:id/shipments (Kunde): keine internen Felder', `${res.status} ${show(shipmentsLeaks)}`);
    res = await request('GET', `/api/orders/${f8._id}/shipments`, { token: staffToken });
    check(res.status === 200 && res.data?.shipments?.inbound?.reconcileUrl && res.data?.shipments?.outbound?.reference,
      'Mitarbeiter sehen die Abgleich-Details weiterhin', show({ url: res.data?.shipments?.inbound?.reconcileUrl, ref: res.data?.shipments?.outbound?.reference }));

    // -----------------------------------------------------------------------
    console.log('\n[F9] DHL-Produktcodes: unbekannt -> 400 vor jedem DHL-Aufruf, alte Kurzcodes normalisiert');
    const f9 = await makeOrder({});
    callsBefore = shippingCalls.length;
    res = await request('POST', `/api/orders/${f9._id}/shipping/create-label`, { token: staffToken, body: { shipmentData: { product: 'CUSTOM' } } });
    const f9Doc = await raw(f9._id);
    check(res.status === 400 && res.data?.code === 'DHL_PRODUCT_NOT_OFFERED' && /nicht angeboten/.test(String(res.data?.error || '')) && shippingCalls.length === callsBefore
      && f9Doc.shippingLabelCreationInProgress !== true,
      'Auslieferung mit "CUSTOM" -> 400 DHL_PRODUCT_NOT_OFFERED, kein DHL-Aufruf, keine Sperre', `${res.status} ${res.data?.code} ${show(res.data?.error)} calls+${shippingCalls.length - callsBefore}`);
    res = await request('POST', `/api/orders/${f9._id}/shipping/create-label`, { token: staffToken, body: { shipmentData: { serviceType: 'p' } } });
    const lastProduct = shippingCalls[shippingCalls.length - 1]?.body?.shipments?.[0]?.product;
    check(res.status === 200 && lastProduct === 'V01PAK', 'Alter Kurzcode "p" -> V01PAK an DHL', `${res.status} ${lastProduct}`);
    const f9in = await makeOrder({});
    callsBefore = shippingCalls.length;
    const f9Error = await DHLService.createShipment(f9in._id, { labelDirection: 'inbound', receiverFromConfiguration: true, shipperName: 'Anna Kundin', product: 'V62WP' }, { direction: 'inbound' }).catch((error) => error);
    const f9inDoc = await raw(f9in._id);
    check(f9Error?.status === 400 && f9Error?.code === 'DHL_PRODUCT_NOT_OFFERED' && shippingCalls.length === callsBefore && !f9inDoc.returnShipmentStatus,
      'Einsendelabel mit nicht angebotenem Code -> 400, kein DHL-Aufruf, keine Reservierung', `${f9Error?.status} ${f9Error?.code} calls+${shippingCalls.length - callsBefore}`);
    const resolved = [['P', 'V01PAK'], ['n', 'V53WPAK'], [' v54epak ', 'V54EPAK'], ['', 'V01PAK']]
      .map(([input, expected]) => [input, expected, DHLService.resolveShippingProduct({ product: input }, 'V01PAK')]);
    check(resolved.every(([, expected, actual]) => expected === actual), 'Kurzcodes/Kleinschreibung/leer korrekt', show(resolved));
    check(DHLService.resolveShippingProduct({ product: 'v62wp' }, 'V62WP') === 'V62WP', 'Das konfigurierte Produkt der Integration bleibt zulaessig', 'V62WP');

    // -----------------------------------------------------------------------
    console.log('\n[F10] Abgleich "created": dieselbe Sendungsnummer gleichzeitig an zwei/drei Auftraegen -> genau einer');
    const RACE = 'RACE0000000001';
    const raceA = await makeOrder({});
    const raceB = await makeOrder({});
    const raceC = await makeOrder({});
    await Order.collection.updateOne({ _id: raceA._id }, { $set: { shippingLabelCreationInProgress: true } });
    await Order.collection.updateOne({ _id: raceB._id }, { $set: { returnShipmentStatus: 'pending' } });
    await Order.collection.updateOne({ _id: raceC._id }, { $set: { shippingLabelCreationInProgress: true } });
    // Deterministische Verschraenkung: der Schreibzugriff mit der Sendungsnummer wartet, bis ein
    // zweiter Abgleich ihn ebenfalls erreicht hat (hoechstens 600 ms). Ohne Sperre lesen alle drei
    // Abgleiche "Nummer frei" und schreiben danach alle.
    const updateOneBeforeRace = Order.updateOne;
    let raceArrivals = 0;
    let releaseRace;
    const raceBarrier = new Promise((resolve) => { releaseRace = resolve; });
    Order.updateOne = function raceUpdateOne(filter, update, ...rest) {
      const set = (update && update.$set) || {};
      if (set.trackingNumber === RACE || set.returnTrackingNumber === RACE) {
        raceArrivals += 1;
        if (raceArrivals >= 2) releaseRace();
        return Promise.race([raceBarrier, sleep(600)]).then(() => updateOneBeforeRace.call(this, filter, update, ...rest));
      }
      return updateOneBeforeRace.call(this, filter, update, ...rest);
    };
    let raceResults;
    try {
      raceResults = await Promise.all([
        request('POST', `/api/orders/${raceA._id}/shipping/reconcile`, { token: adminToken, body: { resolution: 'created', trackingNumber: RACE } }),
        request('POST', `/api/orders/${raceB._id}/return-label/reconcile`, { token: admin2Token, body: { resolution: 'created', trackingNumber: RACE } }),
        request('POST', `/api/orders/${raceC._id}/shipping/reconcile`, { token: admin2Token, body: { resolution: 'created', trackingNumber: RACE } }),
      ]);
    } finally {
      Order.updateOne = updateOneBeforeRace;
    }
    const raceHolders = await Order.collection.countDocuments({ $or: [{ trackingNumber: RACE }, { returnTrackingNumber: RACE }] });
    const raceSummary = raceResults.map((r) => `${r.status}:${r.data?.code || 'OK'}`);
    check(raceResults.filter((r) => r.status === 200).length === 1 && raceHolders === 1,
      'Genau ein Abgleich uebernimmt die Nummer, sie steht an genau einem Auftrag', `${show(raceSummary)} holders=${raceHolders}`);
    check(raceResults.filter((r) => r.status === 422 && r.data?.code === 'TRACKING_NUMBER_ALREADY_USED' && /bereits dem Auftrag ORD-FEN-/.test(String(r.data?.error || ''))).length === 2,
      'Die beiden anderen: 422 TRACKING_NUMBER_ALREADY_USED mit dem Auftrag, der die Nummer haelt', show(raceResults.map((r) => r.data?.error || 'OK')));
    const raceLosers = await Order.collection.find({ _id: { $in: [raceA._id, raceB._id, raceC._id] } }).toArray();
    check(raceLosers.filter((doc) => doc.shippingLabelCreationInProgress === true || doc.returnShipmentStatus === 'pending').length === 2,
      'Die unterlegenen Auftraege bleiben im Abgleich', show(raceLosers.map((doc) => [doc.orderNumber, doc.shippingLabelCreationInProgress, doc.returnShipmentStatus])));

    console.log('\n[F10b] Altbestand mit doppelten Sendungsnummern bleibt unberuehrt; Sperren raeumen sich auf');
    const legacyDupA = await makeOrder({});
    const legacyDupB = await makeOrder({});
    await Order.collection.updateMany({ _id: { $in: [legacyDupA._id, legacyDupB._id] } }, { $set: { trackingNumber: 'LEGACYDUP0001' } });
    const uniqueOnTracking = (indexes) => indexes.filter((index) => index.unique
      && Object.keys(index.key || {}).some((key) => /trackingNumber/i.test(key)));
    const orderUnique = uniqueOnTracking(await Order.collection.indexes());
    const bookingUnique = uniqueOnTracking(await Booking.collection.indexes());
    check(orderUnique.length === 0 && bookingUnique.length === 0, 'Kein Unique-Index auf Sendungsnummern von Auftraegen/Buchungen', show([orderUnique, bookingUnique]));
    const legacyDoc = await Order.findById(legacyDupA._id);
    legacyDoc.shippingStatusDescription = 'Altbestand geprüft';
    const legacySave = await legacyDoc.save().then(() => 'ok').catch((error) => error.message);
    check(legacySave === 'ok', 'Auftrag mit doppelter Alt-Sendungsnummer laesst sich weiter speichern', legacySave);
    const legacyTarget = await makeOrder({});
    await Order.collection.updateOne({ _id: legacyTarget._id }, { $set: { shippingLabelCreationInProgress: true } });
    res = await request('POST', `/api/orders/${legacyTarget._id}/shipping/reconcile`, { token: adminToken, body: { resolution: 'created', trackingNumber: 'LEGACYDUP0001' } });
    check(res.status === 422 && res.data?.code === 'TRACKING_NUMBER_ALREADY_USED', 'Doppelte Alt-Nummer wird nicht ein drittes Mal vergeben', `${res.status} ${res.data?.code}`);
    // Eine verwaiste Sperre (Prozessabbruch) wird nach Ablauf uebernommen ...
    const lockCollection = mongoose.connection.db.collection('dhltrackingnumberlocks');
    await lockCollection.insertOne({ _id: 'STALELOCK0001', orderId: raceA._id, lockedAt: new Date(Date.now() - 10 * 60 * 1000) });
    res = await request('POST', `/api/orders/${legacyTarget._id}/shipping/reconcile`, { token: adminToken, body: { resolution: 'created', trackingNumber: 'STALELOCK0001' } });
    check(res.status === 200 && (await raw(legacyTarget._id)).trackingNumber === 'STALELOCK0001', 'Verwaiste Sperre wird uebernommen -> 200', `${res.status} ${res.data?.code || ''}`);
    // ... eine frische, fremde Sperre nicht (kurze Wartezeit fuer den Test).
    const busyTarget = await makeOrder({});
    await Order.collection.updateOne({ _id: busyTarget._id }, { $set: { shippingLabelCreationInProgress: true } });
    await lockCollection.insertOne({ _id: 'BUSYLOCK00001', orderId: raceA._id, lockedAt: new Date() });
    const originalLockWait = DHLService.TRACKING_NUMBER_LOCK_WAIT_MS;
    DHLService.TRACKING_NUMBER_LOCK_WAIT_MS = 300;
    res = await request('POST', `/api/orders/${busyTarget._id}/shipping/reconcile`, { token: adminToken, body: { resolution: 'created', trackingNumber: 'BUSYLOCK00001' } });
    DHLService.TRACKING_NUMBER_LOCK_WAIT_MS = originalLockWait;
    const busyDoc = await raw(busyTarget._id);
    check(res.status === 409 && res.data?.code === 'TRACKING_NUMBER_BUSY' && /gerade/.test(String(res.data?.error || '')) && busyDoc.shippingLabelCreationInProgress === true && !busyDoc.trackingNumber,
      'Frische fremde Sperre -> 409 TRACKING_NUMBER_BUSY (deutsch), nichts uebernommen', `${res.status} ${res.data?.code} ${show(res.data?.error)}`);
    await lockCollection.deleteOne({ _id: 'BUSYLOCK00001' });
    const leftoverLocks = await lockCollection.countDocuments({});
    check(leftoverLocks === 0, 'Nach allen Abgleichen bleibt keine Sperre zurueck', leftoverLocks);

    console.log('\n[F10c] Altes RUECKWEG-Label der Buchung: klare Meldung statt "gehoert zur Einsendung"');
    const outBookingOrder = await makeOrder({});
    await Booking.create({
      customerId: anna._id, orderIds: [outBookingOrder._id], repairOrderIds: [outBookingOrder._id], totalCost: 100, items: [],
      trackingNumber: 'BOOKOUTLBL001',
      timeline: [{ status: 'Shipping Label Created', description: 'DHL-Versandlabel für den Rückweg (McRepair an Kunde) erstellt', completedAt: new Date() }],
    });
    await Order.collection.updateOne({ _id: outBookingOrder._id }, { $set: { shippingLabelCreationInProgress: true } });
    res = await request('POST', `/api/orders/${outBookingOrder._id}/shipping/reconcile`, { token: adminToken, body: { resolution: 'created', trackingNumber: 'BOOKOUTLBL001' } });
    check(res.status === 422 && res.data?.code === 'TRACKING_NUMBER_ALREADY_USED' && /Rückweg-Label/.test(String(res.data?.error || '')) && !/gehört zur Einsendung/.test(String(res.data?.error || '')),
      'Rueckweg-Label der Buchung -> 422 mit "Rückweg-Label der Buchung"', `${res.status} ${res.data?.code} ${show(res.data?.error)}`);
    res = await request('POST', `/api/orders/${f5out._id}/shipping/reconcile`, { token: adminToken, body: { resolution: 'created', trackingNumber: 'BOOKINGIN0001' } });
    check(res.status === 422 && res.data?.code === 'TRACKING_NUMBER_ALREADY_USED' && /Einsendelabel/.test(String(res.data?.error || '')),
      'Einsendelabel einer fremden Buchung -> 422 "Einsendelabel der Buchung"', `${res.status} ${res.data?.code} ${show(res.data?.error)}`);

    // -----------------------------------------------------------------------
    console.log('\n[F11] Harte Gesamtfrist fuer den bezahlten DHL-Aufruf (tropfende Antwort)');
    let trickleClosedEarly = false;
    const trickleServer = http.createServer((req, response) => {
      req.resume();
      req.on('end', () => {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        const body = JSON.stringify({ items: [{ shipmentNo: '00340434169999999999', label: { b64: Buffer.from('%PDF-1.4 TROPFEN').toString('base64'), fileFormat: 'PDF' } }] });
        let sent = 0;
        // Alle 200 ms ein Byte: der Leerlauf-Timeout von axios greift so NIE, die Antwort dauert ~6 s.
        const timer = setInterval(() => {
          if (sent < 30) { response.write(' '); sent += 1; } else { clearInterval(timer); response.end(body); }
        }, 200);
        response.on('close', () => { if (sent < 30) trickleClosedEarly = true; clearInterval(timer); });
      });
    });
    await new Promise((resolve) => trickleServer.listen(0, '127.0.0.1', resolve));
    trickleUrl = `http://127.0.0.1:${trickleServer.address().port}/parcel/de/shipping/v2/orders`;
    const f11 = await makeOrder({});
    const originalRequestTimeout = DHLService.LABEL_REQUEST_TIMEOUT_MS;
    DHLService.LABEL_REQUEST_TIMEOUT_MS = 1500;
    shippingMode = 'trickle';
    callsBefore = shippingCalls.length;
    const f11Started = Date.now();
    try {
      res = await request('POST', `/api/orders/${f11._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
    } finally {
      shippingMode = 'ok';
      trickleUrl = '';
      DHLService.LABEL_REQUEST_TIMEOUT_MS = originalRequestTimeout;
    }
    const f11Elapsed = Date.now() - f11Started;
    await sleep(100);
    trickleServer.close();
    const f11Doc = await raw(f11._id);
    check(res.status === 409 && res.data?.code === 'DHL_RESULT_UNKNOWN' && f11Elapsed < 4000 && shippingCalls.length === callsBefore + 1,
      'Tropfende DHL-Antwort wird nach der Gesamtfrist abgebrochen -> 409 DHL_RESULT_UNKNOWN', `${res.status} ${res.data?.code} ${f11Elapsed} ms`);
    check(f11Doc.shippingLabelCreationInProgress === true && !f11Doc.trackingNumber
      && (f11Doc.timeline || []).some((entry) => entry.status === 'Shipping Label Reconciliation Required'),
      'Abbruch gilt als unklar: Reservierung bleibt, Abgleich-Marker gesetzt, nichts gespeichert', `lock=${f11Doc.shippingLabelCreationInProgress} tn=${f11Doc.trackingNumber || ''}`);
    check(trickleClosedEarly, 'Die Verbindung zu DHL wird beim Abbruch tatsaechlich geschlossen', trickleClosedEarly);
  } finally {
    DHLService.LABEL_LOCK_LEASE_MS = ORIGINAL_LEASE;
    Object.values(gates).forEach((queue) => queue.splice(0).forEach((gate) => gate.release('ok')));
  }

  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error('Testlauf abgebrochen:', error);
  try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
  process.exit(2);
});
