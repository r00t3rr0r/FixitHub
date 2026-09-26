/**
 * P0-SHIPPING - Regressionstest Versandrichtung (T11, T12, T13, T14, T24).
 *
 * Zwei physische Richtungen, die NIE verwechselt werden duerfen:
 *   1. Einsendung    - Kunde -> McRepair  (Kunde schickt das Geraet ein)
 *   2. Auslieferung  - McRepair -> Kunde  (reparierte Geraet geht an den Kunden zurueck)
 *
 * Befund vor dem Fix (Stand 6943b03):
 *  - "Rücksendung starten" im Auftrag rief die DHL-RETOURE-API auf: dort ist der KUNDE der
 *    Absender und McRepair (receiverId) der Empfaenger - physisch eine Einsendung, in der
 *    Oberflaeche aber als "Versand an den Kunden" beschriftet.
 *  - Das automatische Einsendelabel der Buchung wurde zusaetzlich in die Versandfelder des
 *    ersten Auftrags geschrieben; ein spaeteres "An Kunden versenden" lieferte dann das
 *    EINSENDElabel als "bereits vorhanden" zurueck.
 *  - Packstation: DHL verlangt beim Locker `name` (nicht `name1`) und `lockerID` als Zahl.
 *  - Zeitueberschreitung bei DHL: Sperre wurde geloest und "erneut versuchen" angeboten -
 *    ein zweiter Klick konnte ein zweites, bezahltes Label erzeugen.
 *
 * ALLE DHL-Aufrufe sind hier GEMOCKT (axios.post wird ersetzt, jeder unerwartete externe
 * Aufruf wirft). Das ist Mock-Evidenz, KEINE Sandbox-Evidenz. Das "Label-PDF" ist ein vom
 * Mock erzeugtes Pseudo-PDF, das die gesendeten Parteien enthaelt.
 *
 * Aufruf (benoetigt eine WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_shipping node test-shipping-outbound-direction.js
 */
const path = require('path');
const fs = require('fs');
const http = require('http');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
// Exakt dieselbe Modulinstanz wie in server/services (require('axios') -> axios.cjs).
const axios = require(require.resolve('axios', { paths: [SERVER_DIR] }));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_shipping_direction';

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
// Nur fuer diesen Testprozess - kein Wert aus einer .env.
process.env.JWT_SECRET = 'test-only-shipping-secret';
process.env.BOOKING_DHL_LABEL_MODE = 'live';
// Kein echter E-Mail-Versand: nodemailer-Stream-Transport (EmailService-Testschalter).
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

// ---------------------------------------------------------------------------
// DHL-Mock
// ---------------------------------------------------------------------------
const shippingCalls = [];
const returnsCalls = [];
let shippingMode = 'ok';
let shipmentCounter = 0;

const mockPdf = (body) => {
  const shipment = body?.shipments?.[0] || {};
  const text = [
    '%PDF-1.4',
    '% MOCK-DHL-LABEL (kein echtes Label)',
    `ABSENDER: ${JSON.stringify(shipment.shipper || {})}`,
    `EMPFAENGER: ${JSON.stringify(shipment.consignee || {})}`,
    '%%EOF',
  ].join('\n');
  return Buffer.from(text, 'utf8').toString('base64');
};

axios.post = async (url, body) => {
  const target = String(url);
  if (target.includes('/auth/ropc/v1/token')) {
    return { status: 200, data: { access_token: 'mock-token', token_type: 'Bearer', expires_in: 3600 } };
  }
  if (target.includes('/parcel/de/shipping/v2/orders')) {
    shippingCalls.push({ url: target, body });
    if (shippingMode === 'timeout') {
      const error = new Error('timeout of 30000ms exceeded');
      error.code = 'ECONNABORTED';
      throw error;
    }
    if (shippingMode === 'provider-error') {
      const error = new Error('Request failed with status code 400');
      error.response = {
        status: 400,
        data: {
          title: 'Bad Request',
          status: 400,
          detail: 'Invalid shipment',
          items: [{ sstatus: { statusCode: 400 }, validationMessages: [{ property: 'shipper.billingNumber', validationMessage: 'Invalid billing number' }] }],
        },
      };
      throw error;
    }
    shipmentCounter += 1;
    const shipmentNo = `0034043416109400${String(shipmentCounter).padStart(4, '0')}`;
    return {
      status: 200,
      data: {
        status: { title: 'OK', statusCode: 200 },
        items: [{ shipmentNo, sstatus: { title: 'OK', statusCode: 200 }, label: { b64: mockPdf(body), fileFormat: 'PDF' } }],
      },
    };
  }
  if (target.includes('/parcel/de/shipping/returns/v1/orders')) {
    returnsCalls.push({ url: target, body });
    return { status: 201, data: { shipmentNo: `RET${returnsCalls.length}`, label: { b64: Buffer.from('%PDF-1.4 retoure').toString('base64') } } };
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
const lastShipment = () => shippingCalls[shippingCalls.length - 1]?.body?.shipments?.[0] || {};

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
  const BookingService = require(path.join(SERVER_DIR, 'services/bookingService'));
  const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));
  // Keine E-Mails (auch keine Log-Eintraege) aus der Auftragsanlage im Test.
  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.sendOrderConfirmationEmail = async () => ({ success: true, mocked: true });
  EmailService.buildSystemUrl = async (urlPath) => `https://test.invalid${urlPath}`;

  await SystemConfiguration.create({
    integrations: [{
      name: 'DHL Paket',
      type: 'shipping',
      provider: 'DHL',
      apiKey: 'mock-key',
      isActive: true,
      credentials: {
        clientId: 'mock-client', clientSecret: 'mock-secret', username: 'mock-user', password: 'mock-pass',
        apiEndpoint: 'https://api-sandbox.dhl.com', accountId: '33333333330102',
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
        bookingLabelMode: 'live',
      },
    }],
  });

  const admin = await User.create({ name: 'Admin Test', email: 'admin@test.invalid', role: 'admin' });
  const staff = await User.create({ name: 'Staff Test', email: 'staff@test.invalid', role: 'staff' });
  // Rechnungsadresse != Lieferadresse: die LIEFERADRESSE muss gewinnen.
  const anna = await User.create({
    name: 'Anna Kundin', firstName: 'Anna', lastName: 'Kundin', email: 'anna@test.invalid', role: 'customer',
    invoiceAddress: { street: 'Rechnungsallee 1', city: 'München', zipCode: '80331', country: 'DE' },
    paymentAddress: { street: 'Lieferweg 7', city: 'Hamburg', zipCode: '20095', country: 'DE', sameAsInvoice: false, deliveryType: 'address' },
  });
  const paula = await User.create({
    name: 'Paula Packstation', email: 'paula@test.invalid', role: 'customer',
    invoiceAddress: { street: 'Rechnungsallee 9', city: 'Köln', zipCode: '50667', country: 'DE' },
    paymentAddress: { sameAsInvoice: false, deliveryType: 'packstation', packstationNumber: '118', postNumber: '12345678', city: 'Berlin', zipCode: '10117', country: 'DE' },
  });
  const noAddress = await User.create({ name: 'Ohne Adresse', email: 'ohne@test.invalid', role: 'customer' });

  const token = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  const adminToken = token(admin);
  const staffToken = token(staff);
  const customerToken = token(anna);

  let seq = 0;
  const makeOrder = (fields) => {
    seq += 1;
    return Order.create({
      orderNumber: `ORD-T13-${String(seq).padStart(3, '0')}`,
      deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
      errorDescription: 'Display', totalCost: 100, status: 'ready-for-pickup',
      ...fields,
    });
  };

  // Router in einer Mini-App (dieselben Router wie server.js unter /api/orders bzw. /api/bookings).
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/orders', require(path.join(SERVER_DIR, 'routes/orderRoutes')));
  app.use('/api/bookings', require(path.join(SERVER_DIR, 'routes/bookingRoutes')));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  // -------------------------------------------------------------------------
  console.log('\n[T13-1] Auslieferung Standardadresse: Absender = Shop, Empfaenger = LIEFERadresse');
  const oNormal = await makeOrder({
    customerId: anna._id,
    shippingAddress: { street: 'Lieferweg 7', city: 'Hamburg', zipCode: '20095', country: 'DE', deliveryType: 'address' },
  });
  let res = await request('POST', `/api/orders/${oNormal._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  let shipment = lastShipment();
  check(res.status === 200 && res.data?.success === true, 'Staff kann Auslieferungslabel erstellen', `${res.status} ${show(res.data?.error || res.data?.trackingNumber)}`);
  check(shipment.shipper?.name1 === 'McRepair.de GmbH' && shipment.shipper?.addressStreet === 'Werkstattstraße'
    && shipment.shipper?.addressHouse === '5' && shipment.shipper?.postalCode === '10115', 'Absender ist der Shop', show(shipment.shipper));
  check(shipment.consignee?.name1 === 'Anna Kundin' && shipment.consignee?.addressStreet === 'Lieferweg'
    && shipment.consignee?.addressHouse === '7' && shipment.consignee?.city === 'Hamburg', 'Empfaenger ist die Lieferadresse (nicht München)', show(shipment.consignee));
  check(typeof shipment.refNo === 'string' && shipment.refNo.length >= 8 && shipment.refNo.length <= 35,
    'refNo (8-35 Zeichen) fuer den Abgleich im DHL-Portal gesetzt', show(shipment.refNo));

  console.log('\n[T13-1b] Manipulierter Absender im Request wird ignoriert');
  const oTamper = await makeOrder({
    customerId: anna._id,
    shippingAddress: { street: 'Lieferweg 7', city: 'Hamburg', zipCode: '20095', country: 'DE' },
  });
  res = await request('POST', `/api/orders/${oTamper._id}/shipping/create-label`, {
    token: staffToken,
    body: { shipmentData: { shipperName: 'Anna Kundin', shipperStreet: 'Lieferweg 7', shipperCity: 'Hamburg', shipperPostalCode: '20095' } },
  });
  shipment = lastShipment();
  check(res.status === 200 && shipment.shipper?.name1 === 'McRepair.de GmbH' && shipment.shipper?.city === 'Berlin',
    'Absender bleibt der Shop, auch wenn der Client einen anderen schickt', show(shipment.shipper));

  console.log('\n[T13-1c] Ohne Adress-Snapshot am Auftrag: Lieferadresse aus dem Kundenprofil, nicht Rechnungsadresse');
  const oNoSnap = await makeOrder({ customerId: anna._id });
  res = await request('POST', `/api/orders/${oNoSnap._id}/shipping/create-label`, { token: adminToken, body: OUTBOUND_BODY });
  shipment = lastShipment();
  check(res.status === 200 && shipment.consignee?.city === 'Hamburg' && shipment.consignee?.addressStreet === 'Lieferweg',
    'Empfaenger = Profil-Lieferadresse Hamburg', `${res.status} ${show(shipment.consignee)}`);

  console.log('\n[T13-2] Packstation: name, Postnummer, Packstationsnummer (Zahl), PLZ, Ort');
  const oPack = await makeOrder({
    customerId: paula._id,
    shippingAddress: { street: '', city: 'Berlin', zipCode: '10117', country: 'DE', deliveryType: 'packstation', packstationNumber: '118', postNumber: '12345678' },
  });
  res = await request('POST', `/api/orders/${oPack._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  shipment = lastShipment();
  check(res.status === 200, 'Packstation-Label wird erstellt', `${res.status} ${show(res.data?.error)}`);
  check(shipment.consignee?.name === 'Paula Packstation' && shipment.consignee?.name1 === undefined,
    'Locker-Empfaenger nutzt `name` (DHL-Schema Locker), nicht `name1`', show(shipment.consignee));
  check(shipment.consignee?.lockerID === 118 && shipment.consignee?.postNumber === '12345678'
    && shipment.consignee?.postalCode === '10117' && shipment.consignee?.city === 'Berlin' && !shipment.consignee?.addressStreet,
    'lockerID als Zahl 118, Postnummer, PLZ, Ort, keine Strasse', show(shipment.consignee));

  console.log('\n[T13-3] Gastauftrag: Lieferadresse des Gastes');
  const oGuest = await makeOrder({
    guestInfo: {
      isGuest: true, firstName: 'Gerd', lastName: 'Gast', email: 'gast@test.invalid',
      billingAddress: { street: 'Rechnungsgasse 3', city: 'Dresden', zipCode: '01067', country: 'DE' },
      shippingAddress: { street: 'Gastweg 12a', city: 'Leipzig', zipCode: '04109', country: 'DE' },
    },
  });
  res = await request('POST', `/api/orders/${oGuest._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  shipment = lastShipment();
  check(res.status === 200 && shipment.consignee?.name1 === 'Gerd Gast' && shipment.consignee?.city === 'Leipzig'
    && shipment.consignee?.addressHouse === '12a', 'Gast: Empfaenger = Gast-Lieferadresse Leipzig', `${res.status} ${show(res.data?.error || shipment.consignee)}`);

  console.log('\n[T13-4] Fehlende Adresse: ausdruecklicher deutscher Fehler, kein DHL-Aufruf');
  const oMissing = await makeOrder({ customerId: noAddress._id });
  let callsBefore = shippingCalls.length;
  res = await request('POST', `/api/orders/${oMissing._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  check(res.status === 422 && /Lieferadresse/.test(String(res.data?.error)) && shippingCalls.length === callsBefore,
    'HTTP 422 mit deutscher Meldung zur Lieferadresse', `${res.status} ${show(res.data?.error)}`);

  console.log('\n[T13-5] PDF-Download des Auslieferungslabels');
  res = await request('GET', `/api/orders/${oNormal._id}/shipping-label`, { token: staffToken });
  const pdfText = Buffer.isBuffer(res.data) ? res.data.toString('utf8') : String(res.data);
  check(res.status === 200 && String(res.headers['content-type']).includes('application/pdf') && pdfText.startsWith('%PDF'),
    'PDF wird ausgeliefert', `${res.status} ${res.headers['content-type']}`);
  check(/ABSENDER: .*McRepair\.de GmbH/.test(pdfText) && /EMPFAENGER: .*Anna Kundin/.test(pdfText),
    '(Mock-)Label: Absender Shop, Empfaenger Kunde', pdfText.split('\n').slice(2, 4).join(' | '));

  console.log('\n[T13-6] Provider-Fehler: deutsche Meldung, Sperre frei, Wiederholung erzeugt genau EIN Label');
  const oErr = await makeOrder({ customerId: anna._id, shippingAddress: { street: 'Lieferweg 7', city: 'Hamburg', zipCode: '20095', country: 'DE' } });
  shippingMode = 'provider-error';
  res = await request('POST', `/api/orders/${oErr._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  let reloaded = await Order.findById(oErr._id).lean();
  check(res.status === 422 && /DHL/.test(String(res.data?.error)) && !/Bad Request|Invalid/.test(String(res.data?.error)),
    'DHL-400 -> deutsche Meldung ohne englischen Rohtext', `${res.status} ${show(res.data?.error)}`);
  check(!reloaded.shippingLabelCreationInProgress && !reloaded.trackingNumber, 'keine Sendung gespeichert, Sperre geloest', show({ lock: reloaded.shippingLabelCreationInProgress, tn: reloaded.trackingNumber }));
  shippingMode = 'ok';
  callsBefore = shippingCalls.length;
  res = await request('POST', `/api/orders/${oErr._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  check(res.status === 200 && shippingCalls.length === callsBefore + 1, 'Wiederholung nach eindeutigem Fehler: genau ein neues Label', `${res.status} calls+${shippingCalls.length - callsBefore}`);

  console.log('\n[T13-7] Zeitueberschreitung: KEIN blindes Wiederholen, Abgleichzustand');
  const oTimeout = await makeOrder({ customerId: anna._id, shippingAddress: { street: 'Lieferweg 7', city: 'Hamburg', zipCode: '20095', country: 'DE' } });
  shippingMode = 'timeout';
  res = await request('POST', `/api/orders/${oTimeout._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  check(res.status === 409 && res.data?.code === 'DHL_RESULT_UNKNOWN' && res.data?.retryable === false,
    'Timeout -> 409 DHL_RESULT_UNKNOWN, nicht wiederholbar', `${res.status} ${res.data?.code} retryable=${res.data?.retryable}`);
  shippingMode = 'ok';
  callsBefore = shippingCalls.length;
  res = await request('POST', `/api/orders/${oTimeout._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  check(res.status === 409 && shippingCalls.length === callsBefore,
    'Zweiter Klick nach Timeout ruft DHL NICHT erneut auf', `${res.status} ${res.data?.code} calls+${shippingCalls.length - callsBefore}`);
  res = await request('GET', `/api/orders/${oTimeout._id}`, { token: staffToken });
  check(res.data?.order?.shipments?.outbound?.reconciliationRequired === true,
    'Detailansicht meldet Abgleich erforderlich', show(res.data?.order?.shipments?.outbound));
  res = await request('POST', `/api/orders/${oTimeout._id}/shipping/reconcile`, { token: staffToken, body: { resolution: 'not-created' } });
  check(res.status === 403, 'Abgleich aufloesen ist Admin-Recht', res.status);
  res = await request('POST', `/api/orders/${oTimeout._id}/shipping/reconcile`, { token: adminToken, body: { resolution: 'not-created' } });
  check(res.status === 200, 'Admin bestaetigt "bei DHL nicht angelegt"', `${res.status} ${show(res.data?.error)}`);
  res = await request('POST', `/api/orders/${oTimeout._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  check(res.status === 200, 'Danach kann das Label regulaer erstellt werden', `${res.status} ${show(res.data?.error)}`);

  console.log('\n[T13-8] Doppelklick: zwei gleichzeitige Anfragen -> genau ein DHL-Aufruf');
  const oDouble = await makeOrder({ customerId: anna._id, shippingAddress: { street: 'Lieferweg 7', city: 'Hamburg', zipCode: '20095', country: 'DE' } });
  callsBefore = shippingCalls.length;
  const [r1, r2] = await Promise.all([
    request('POST', `/api/orders/${oDouble._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY }),
    request('POST', `/api/orders/${oDouble._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY }),
  ]);
  check(shippingCalls.length === callsBefore + 1, 'genau ein DHL-Aufruf', `calls+${shippingCalls.length - callsBefore} (${r1.status}/${r2.status})`);
  res = await request('POST', `/api/orders/${oDouble._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  check(res.status === 200 && res.data?.alreadyExists === true && shippingCalls.length === callsBefore + 1,
    'erneuter Klick liefert das vorhandene Label, kein neues', `${res.status} alreadyExists=${res.data?.alreadyExists}`);

  console.log('\n[T24] Status- und Zahlungsbedingung serverseitig (identisch zur Oberflaeche)');
  const oEarly = await makeOrder({ customerId: anna._id, status: 'in-progress', shippingAddress: { street: 'Lieferweg 7', city: 'Hamburg', zipCode: '20095', country: 'DE' } });
  callsBefore = shippingCalls.length;
  res = await request('POST', `/api/orders/${oEarly._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  check(res.status === 422 && res.data?.code === 'OUTBOUND_STATUS_NOT_READY' && shippingCalls.length === callsBefore,
    'Auftrag "in Bearbeitung" -> abgelehnt, kein DHL-Aufruf', `${res.status} ${res.data?.code} ${show(res.data?.error)}`);
  const detailEarly = await request('GET', `/api/orders/${oEarly._id}`, { token: staffToken });
  check(detailEarly.data?.order?.shipments?.outboundAction?.allowed === false
    && detailEarly.data?.order?.shipments?.outboundAction?.code === 'OUTBOUND_STATUS_NOT_READY',
    'Detailansicht liefert dieselbe Entscheidung', show(detailEarly.data?.order?.shipments?.outboundAction));
  const oPayGate = await makeOrder({ customerId: anna._id, requiresPaymentBeforeCompletion: true, paymentStatus: 'pending', shippingAddress: { street: 'Lieferweg 7', city: 'Hamburg', zipCode: '20095', country: 'DE' } });
  res = await request('POST', `/api/orders/${oPayGate._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  check(res.status === 422 && res.data?.code === 'PAYMENT_REQUIRED_BEFORE_SHIPPING',
    'Auftrag mit Zahlungspflicht vor Versand (bestehende Regel) -> abgelehnt', `${res.status} ${res.data?.code}`);
  res = await request('POST', `/api/orders/${oNoSnap._id}/shipping/create-label`, { token: customerToken, body: OUTBOUND_BODY });
  check(res.status === 403, 'Kunde darf kein Label erstellen', res.status);
  const detailReady = await request('GET', `/api/orders/${oTamper._id}`, { token: staffToken });
  check(detailReady.data?.order?.shipments?.outbound?.hasLabel === true && detailReady.data?.order?.hasShippingLabel === true
    && !String(detailReady.data?.order?.shippingLabelUrl || '').startsWith('data:'),
    'Projektion: hasLabel stimmt, kein Base64-PDF im Detail-Payload', show({ out: detailReady.data?.order?.shipments?.outbound, url: String(detailReady.data?.order?.shippingLabelUrl || '').slice(0, 20) }));

  console.log('\n[T12/T14] Buchung mit zwei Geraeten: Einsendelabel darf Auslieferung nicht blockieren');
  const b1 = await makeOrder({ customerId: anna._id, shippingAddress: { street: 'Lieferweg 7', city: 'Hamburg', zipCode: '20095', country: 'DE' } });
  const b2 = await makeOrder({ customerId: anna._id, status: 'in-progress', shippingAddress: { street: 'Lieferweg 7', city: 'Hamburg', zipCode: '20095', country: 'DE' } });
  let booking = await Booking.create({
    customerId: anna._id, orderIds: [b1._id, b2._id], repairOrderIds: [b1._id, b2._id], totalCost: 200,
    items: [],
  });
  // Wie BookingService.createBooking: die Auftraege werden mit der Buchung verknuepft.
  await Order.updateMany({ _id: { $in: [b1._id, b2._id] } }, { $set: { bookingId: booking._id } });
  // Genau wie beim Anlegen der Buchung: automatisches Einsendelabel (Kunde -> McRepair).
  await BookingService.createShippingLabelForBooking(booking, { preferredOrderId: b1._id });
  const inboundShipment = lastShipment();
  booking = await Booking.findById(booking._id).setOptions({ skipAutoPopulate: true }).lean();
  check(inboundShipment.shipper?.name1 === 'Anna Kundin' && inboundShipment.consignee?.name1 === 'McRepair.de GmbH',
    'Einsendelabel: Absender Kunde, Empfaenger Shop', `${inboundShipment.shipper?.name1} -> ${inboundShipment.consignee?.name1}`);
  let b1Doc = await Order.findById(b1._id).lean();
  check(!b1Doc.trackingNumber && !b1Doc.shippingLabelUrl && b1Doc.shippingStatus !== 'label-created',
    'Einsendelabel der Buchung landet NICHT im Auslieferungsfeld des Auftrags', show({ tn: b1Doc.trackingNumber, st: b1Doc.shippingStatus }));
  callsBefore = shippingCalls.length;
  res = await request('POST', `/api/orders/${b1._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  shipment = lastShipment();
  check(res.status === 200 && res.data?.alreadyExists !== true && shippingCalls.length === callsBefore + 1
    && res.data?.trackingNumber !== booking.trackingNumber,
    'Auslieferung fuer Geraet 1 erzeugt ein NEUES Label (nicht das Einsendelabel)', `${res.status} tn=${res.data?.trackingNumber} inbound=${booking.trackingNumber}`);
  check(shipment.shipper?.name1 === 'McRepair.de GmbH' && shipment.consignee?.name1 === 'Anna Kundin', 'Auslieferung: Shop -> Kunde', `${shipment.shipper?.name1} -> ${shipment.consignee?.name1}`);
  const bookingAfter = await Booking.findById(booking._id).setOptions({ skipAutoPopulate: true }).lean();
  check(bookingAfter.trackingNumber === booking.trackingNumber, 'Einsende-Sendungsnummer der Buchung unveraendert', `${bookingAfter.trackingNumber}`);
  const b2Doc = await Order.findById(b2._id).lean();
  check(!b2Doc.trackingNumber && b2Doc.shippingStatus === 'pending' && b2Doc.status === 'in-progress',
    'Geraet 2 bleibt unberuehrt (nicht versendet, nicht abgeschlossen)', show({ tn: b2Doc.trackingNumber, st: b2Doc.shippingStatus, status: b2Doc.status }));
  b1Doc = await Order.findById(b1._id).lean();
  check(b1Doc.status === 'ready-for-pickup' && b1Doc.shippingStatus === 'label-created',
    'Label erstellt heisst NICHT versendet/abgeschlossen', show({ status: b1Doc.status, shippingStatus: b1Doc.shippingStatus }));
  res = await request('GET', `/api/orders/${b1._id}`, { token: staffToken });
  check(res.data?.order?.shipments?.inbound?.trackingNumber === booking.trackingNumber
    && res.data?.order?.shipments?.outbound?.trackingNumber === b1Doc.trackingNumber,
    'Detail: Einsendung und Auslieferung getrennt sichtbar', show({ inbound: res.data?.order?.shipments?.inbound?.trackingNumber, outbound: res.data?.order?.shipments?.outbound?.trackingNumber }));

  console.log('\n[T14] Sammel-Auslieferung ueber die Buchung wird mit deutscher Erklaerung abgelehnt');
  callsBefore = shippingCalls.length;
  res = await request('POST', `/api/bookings/${booking._id}/shipping/create-label`, { token: staffToken, body: { shipmentData: { labelDirection: 'outbound', shipperFromConfiguration: true } } });
  check(res.status === 422 && res.data?.code === 'BOOKING_OUTBOUND_NOT_SUPPORTED' && /Auftrag/.test(String(res.data?.error)) && shippingCalls.length === callsBefore,
    'Buchungs-Auslieferung abgelehnt, kein DHL-Aufruf', `${res.status} ${res.data?.code} ${show(res.data?.error)}`);

  console.log('\n[Altbestand] Einsendelabel der Buchung steht (vor dem Fix gespeichert) im Auslieferungsfeld');
  const legacyOrder = await makeOrder({ customerId: anna._id, shippingAddress: { street: 'Lieferweg 7', city: 'Hamburg', zipCode: '20095', country: 'DE' } });
  const legacyBooking = await Booking.create({
    customerId: anna._id, orderIds: [legacyOrder._id], repairOrderIds: [legacyOrder._id], totalCost: 100, items: [],
    trackingNumber: 'LEGACYINBOUND0001', shippingStatus: 'delivered', shippingLabelUrl: `data:application/pdf;base64,${Buffer.from('%PDF-1.4 alt').toString('base64')}`,
    timeline: [{ status: 'Shipping Label Created', description: 'DHL-Versandlabel für die Buchung erstellt (Hinweg: Kunde an McRepair). Sendungsnummer: LEGACYINBOUND0001', completedAt: new Date(), staffId: 'system', staffName: 'x' }],
  });
  await Order.updateOne({ _id: legacyOrder._id }, {
    $set: {
      bookingId: legacyBooking._id, trackingNumber: 'LEGACYINBOUND0001', shippingStatus: 'delivered',
      shippingLabelUrl: `data:application/pdf;base64,${Buffer.from('%PDF-1.4 alt').toString('base64')}`,
      trackingEvents: [{ timestamp: new Date(), status: 'delivered', description: 'Zugestellt bei McRepair' }],
    },
  });
  res = await request('GET', `/api/orders/${legacyOrder._id}`, { token: staffToken });
  check(res.data?.order?.shipments?.legacy?.inboundInOutboundSlot === true
    && res.data?.order?.shipments?.outbound?.hasLabel === false
    && res.data?.order?.shipments?.outboundAction?.allowed === true
    && res.data?.order?.shipments?.inbound?.trackingNumber === 'LEGACYINBOUND0001',
    'Lesepfad erkennt Altbestand: keine Auslieferung, Aktion frei, Einsendung sichtbar', show(res.data?.order?.shipments && { legacy: res.data.order.shipments.legacy, out: res.data.order.shipments.outbound.hasLabel, action: res.data.order.shipments.outboundAction.code }));
  callsBefore = shippingCalls.length;
  res = await request('POST', `/api/orders/${legacyOrder._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  const legacyAfter = await Order.findById(legacyOrder._id).lean();
  check(res.status === 200 && res.data?.alreadyExists !== true && shippingCalls.length === callsBefore + 1
    && legacyAfter.trackingNumber !== 'LEGACYINBOUND0001' && legacyAfter.shippingStatus === 'label-created'
    && legacyAfter.trackingEvents.length === 1,
    'Auslieferung ersetzt die Alt-Kopie, Tracking-Ereignisse der Einsendung werden nicht als Auslieferung weitergefuehrt',
    `${res.status} tn=${legacyAfter.trackingNumber} events=${legacyAfter.trackingEvents.length}`);
  check(legacyAfter.timeline.some((entry) => entry.status === 'Legacy Inbound Label Moved' && entry.description.includes('LEGACYINBOUND0001')),
    'Alt-Sendungsnummer im Verlauf dokumentiert', 'Legacy Inbound Label Moved');
  const legacyBookingAfter = await Booking.findById(legacyBooking._id).setOptions({ skipAutoPopulate: true }).lean();
  check(legacyBookingAfter.trackingNumber === 'LEGACYINBOUND0001', 'Original-Einsendelabel an der Buchung unveraendert', legacyBookingAfter.trackingNumber);

  console.log('\n[T13-7b] Abgleich "bei DHL angelegt": Sendungsnummer uebernehmen, kein zweites Label');
  const oRecon = await makeOrder({ customerId: anna._id, shippingAddress: { street: 'Lieferweg 7', city: 'Hamburg', zipCode: '20095', country: 'DE' } });
  shippingMode = 'timeout';
  await request('POST', `/api/orders/${oRecon._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  shippingMode = 'ok';
  res = await request('POST', `/api/orders/${oRecon._id}/shipping/reconcile`, { token: adminToken, body: { resolution: 'created', trackingNumber: '00340434161094999999' } });
  const reconDoc = await Order.findById(oRecon._id).lean();
  check(res.status === 200 && reconDoc.trackingNumber === '00340434161094999999' && reconDoc.shippingLabelCreationInProgress === false,
    'Sendungsnummer uebernommen, Sperre geloest', `${res.status} ${reconDoc.trackingNumber}`);
  callsBefore = shippingCalls.length;
  res = await request('POST', `/api/orders/${oRecon._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  check(res.status === 409 && res.data?.code === 'EXISTING_SHIPMENT_LABEL_MISSING' && shippingCalls.length === callsBefore,
    'Kein neues Label - Hinweis PDF im DHL-Portal abrufen', `${res.status} ${res.data?.code}`);

  console.log('\n[Buchung] Doppelklick auf das Einsendelabel -> genau ein DHL-Aufruf; Timeout -> kein Folgeversuch');
  const d1 = await makeOrder({ customerId: anna._id, status: 'pending' });
  const bookingDouble = await Booking.create({ customerId: anna._id, orderIds: [d1._id], repairOrderIds: [d1._id], totalCost: 100, items: [] });
  callsBefore = shippingCalls.length;
  const doubleResults = await Promise.allSettled([
    BookingService.createShippingLabelForBooking(await Booking.findById(bookingDouble._id), {}),
    BookingService.createShippingLabelForBooking(await Booking.findById(bookingDouble._id), {}),
  ]);
  check(shippingCalls.length === callsBefore + 1, 'genau ein DHL-Aufruf fuer das Einsendelabel', `calls+${shippingCalls.length - callsBefore} ${doubleResults.map((r) => r.status).join('/')}`);
  const t1 = await makeOrder({ customerId: anna._id, status: 'pending' });
  const t2 = await makeOrder({ customerId: anna._id, status: 'pending' });
  const bookingTimeout = await Booking.create({ customerId: anna._id, orderIds: [t1._id, t2._id], repairOrderIds: [t1._id, t2._id], totalCost: 100, items: [] });
  shippingMode = 'timeout';
  callsBefore = shippingCalls.length;
  const timeoutResult = await BookingService.createShippingLabelForBooking(await Booking.findById(bookingTimeout._id), {}).catch((error) => error);
  shippingMode = 'ok';
  const bookingTimeoutDoc = await Booking.findById(bookingTimeout._id).setOptions({ skipAutoPopulate: true }).lean();
  check(shippingCalls.length === callsBefore + 1 && timeoutResult?.code === 'DHL_RESULT_UNKNOWN' && bookingTimeoutDoc.shippingLabelCreationInProgress === true,
    'Timeout: kein zweiter Versuch mit dem naechsten Auftrag, Sperre bleibt fuer den Abgleich', `calls+${shippingCalls.length - callsBefore} ${timeoutResult?.code} lock=${bookingTimeoutDoc.shippingLabelCreationInProgress}`);
  res = await request('POST', `/api/bookings/${bookingTimeout._id}/shipping/create-label`, { token: staffToken, body: { shipmentData: { labelDirection: 'inbound', receiverFromConfiguration: true } } });
  check(res.status === 409 && shippingCalls.length === callsBefore + 1, 'Erneuter Klick waehrend offenem Abgleich: kein DHL-Aufruf', `${res.status} ${res.data?.code}`);
  res = await request('POST', `/api/bookings/${bookingTimeout._id}/shipping/reconcile`, { token: staffToken, body: { resolution: 'not-created' } });
  check(res.status === 403, 'Buchungs-Abgleich ist Admin-Recht', res.status);
  res = await request('POST', `/api/bookings/${bookingTimeout._id}/shipping/reconcile`, { token: adminToken, body: { resolution: 'not-created' } });
  const afterReconcile = await BookingService.createShippingLabelForBooking(await Booking.findById(bookingTimeout._id), {}).catch((error) => error);
  check(res.status === 200 && afterReconcile?.trackingNumber && shippingCalls.length === callsBefore + 2,
    'Nach Admin-Abgleich genau ein neues Einsendelabel', `${res.status} tn=${afterReconcile?.trackingNumber} calls+${shippingCalls.length - callsBefore}`);

  console.log('\n[Altaufrufer] Reklamations-Einsendelabel (Kunde als Absender) belegt nicht den Auslieferungsplatz');
  const oComplaint = await makeOrder({ customerId: anna._id, status: 'pending' });
  const complaintResult = await DHLService.createShipment(oComplaint._id, {
    receiverName: 'McRepair.de GmbH', receiverAddress: 'Werkstattstraße', receiverNumber: '5', receiverCity: 'Berlin', receiverPostalCode: '10115', receiverCountry: 'DE',
    shipperName: 'Anna Kundin', shipperStreet: 'Lieferweg 7', shipperCity: 'Hamburg', shipperPostalCode: '20095', shipperCountry: 'DE',
    weight: 1,
  });
  shipment = lastShipment();
  const oComplaintDoc = await Order.findById(oComplaint._id).lean();
  check(shipment.shipper?.name1 === 'Anna Kundin' && /^data:application\/pdf;base64,/.test(complaintResult?.labelUrl || ''),
    'Reklamationslabel wird weiterhin als Einsendung erzeugt', `${shipment.shipper?.name1} -> ${shipment.consignee?.name1}`);
  check(!oComplaintDoc.trackingNumber && oComplaintDoc.returnTrackingNumber === complaintResult.trackingNumber,
    'gespeichert im Einsendeplatz (return*), nicht im Auslieferungsplatz', show({ outbound: oComplaintDoc.trackingNumber, inbound: oComplaintDoc.returnTrackingNumber }));
  callsBefore = shippingCalls.length;
  const complaintAgain = await DHLService.createShipment(oComplaint._id, {
    receiverName: 'McRepair.de GmbH', receiverAddress: 'Werkstattstraße', receiverNumber: '5', receiverCity: 'Berlin', receiverPostalCode: '10115',
    shipperName: 'Anna Kundin', shipperStreet: 'Lieferweg 7', shipperCity: 'Hamburg', shipperPostalCode: '20095',
  });
  check(complaintAgain.alreadyExists === true && shippingCalls.length === callsBefore, 'erneute Genehmigung erzeugt kein zweites Label', `alreadyExists=${complaintAgain.alreadyExists}`);

  console.log('\n[Richtung Retoure] DHL-Retoure am Auftrag ist eine EINSENDUNG (Kunde = Absender)');
  const oRet = await makeOrder({ customerId: anna._id, status: 'pending', shippingAddress: { street: 'Lieferweg 7', city: 'Hamburg', zipCode: '20095', country: 'DE' } });
  res = await request('POST', `/api/orders/${oRet._id}/return-label`, { token: staffToken, body: {} });
  const retBody = returnsCalls[returnsCalls.length - 1]?.body || {};
  check(res.status === 200 && retBody.shipper?.name1 === 'Anna Kundin' && Boolean(retBody.receiverId),
    'Retoure: Absender Kunde, Empfaenger = receiverId (McRepair)', `${res.status} ${show(retBody.shipper?.name1)} -> receiverId`);
  res = await request('GET', `/api/orders/${oRet._id}`, { token: staffToken });
  check(res.data?.order?.shipments?.inbound?.hasLabel === true && res.data?.order?.shipments?.outbound?.hasLabel === false,
    'Detail: Retoure erscheint als Einsendung, Auslieferung weiterhin offen', show(res.data?.order?.shipments && { in: res.data.order.shipments.inbound, out: res.data.order.shipments.outbound?.hasLabel }));

  console.log('\n[Versandstand-Endpunkt] Admin/Staff erhalten die Entscheidung, Kunden nur den Stand');
  res = await request('GET', `/api/orders/${oNoSnap._id}/shipments`, { token: staffToken });
  check(res.status === 200 && typeof res.data?.shipments?.outboundAction?.allowed === 'boolean' && res.data?.shipments?.outbound?.hasLabel === true,
    'Staff: GET /shipments liefert Auslieferung + Aktion', `${res.status} ${show(res.data?.shipments?.outboundAction)}`);
  const annaOrder = await makeOrder({ customerId: anna._id });
  res = await request('GET', `/api/orders/${annaOrder._id}/shipments`, { token: customerToken });
  check(res.status === 200 && res.data?.shipments?.outboundAction?.allowed === false && res.data?.shipments?.outboundAction?.code === 'NOT_PERMITTED',
    'Kunde: Stand sichtbar, keine Aktionsfreigabe', `${res.status} ${res.data?.shipments?.outboundAction?.code}`);
  res = await request('GET', `/api/orders/${oPack._id}/shipments`, { token: customerToken });
  check(res.status === 403, 'Kunde sieht fremde Auftraege nicht', res.status);

  console.log('\n[(d) POST /api/orders] Kunde kann Status, Versandfelder und Auftragswert nicht setzen');
  const Service = mongoose.model('Service');
  const svc = await Service.create({ name: 'Display-Tausch', description: 'Display', category: 'diagnostic', price: 100 });
  res = await request('POST', '/api/orders', {
    token: customerToken,
    body: {
      deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone', errorDescription: 'Display',
      services: [String(svc._id)],
      totalCost: 1, discount: 99, status: 'completed', paymentStatus: 'paid',
      trackingNumber: 'FAKE00000001', shippingStatus: 'delivered',
      shippingLabelUrl: 'data:application/pdf;base64,AAAA', requiresPaymentBeforeCompletion: false,
    },
  });
  const created = res.data?.orderId ? await Order.findById(res.data.orderId).lean() : null;
  check(res.status === 201 && created && created.status === 'pending' && !created.trackingNumber && created.shippingStatus === 'pending' && !created.shippingLabelUrl,
    'Status/Versandfelder aus dem Request werden ignoriert', `${res.status} ${show(created && { status: created.status, tn: created.trackingNumber, ship: created.shippingStatus })} ${show(res.data?.error)}`);
  check(created && Number(created.totalCost) === 100 && created.paymentStatus !== 'paid',
    'Auftragswert kommt aus dem Katalog (100,00), nicht vom Client (1,00)', show(created && { totalCost: created.totalCost, discount: created.discount, paymentStatus: created.paymentStatus }));

  console.log(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);

  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('ERROR:', error && error.stack ? error.stack : error);
  try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
  process.exit(2);
});
