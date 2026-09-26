/**
 * P1-SHIPPING-B - Regressionstest Wiederherstellung und Nebenlaeufigkeit der DHL-Label.
 *
 * Deckt die Befunde der P0-Pruefung ab (REVIEW: shipping):
 *  [R1]  Altbestand + DHL-Zeitueberschreitung + Admin-Abgleich 'created': der Download der
 *        Auslieferung darf NIE das alte EINSENDE-PDF ausliefern (andere Richtung).
 *  [R2]  DHL-Retoure am Auftrag: zwei gleichzeitige Klicks -> genau EIN bezahltes Label.
 *  [R3]  Einsendung am Auftrag nach Zeitueberschreitung: Abgleich-Endpunkt, Anzeige in
 *        getOrderShipmentState, Aktion gesperrt.
 *  [R4]  Verwaiste Sperre ohne Abgleich-Marker (Altbestand, Prozessabbruch): nach Ablauf der
 *        Frist als "Abgleich erforderlich" gemeldet; eine laufende Anfrage darf NICHT
 *        abgeglichen werden.
 *  [R5]  LABEL_PERSIST_FAILED setzt den Abgleich-Marker.
 *  [R6]  Eignung (Status) wird in der atomaren Reservierung erneut geprueft (TOCTOU).
 *  [R7]  GET /:id/shipments: Besitzpruefung zuerst, einheitliche Antwort fuer Kunden (403).
 *  [R8]  shippingCost bleibt erhalten, negative Werte werden abgelehnt.
 *  [R9]  Gast-Sendungsverfolgung zeigt die Einsendelabel-Kopie nicht als Auslieferung.
 *  [R10] DHL-Produkte: alte Codes werden serverseitig normalisiert.
 *  [R11] Tracking-Aktualisierung/Webhook verfolgen keine Einsendelabel-Kopie als Auslieferung.
 *  [R12] Die Sperr-Startzeit (strict:false) stoert kein spaeteres save().
 *
 * ALLE DHL-Aufrufe sind GEMOCKT (axios.post wird ersetzt, jeder unerwartete externe Aufruf
 * wirft). Das ist Mock-Evidenz, KEINE Sandbox-Evidenz.
 *
 * Aufruf (benoetigt eine WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_shipping_recovery node test-shipping-label-recovery.js
 */
const path = require('path');
const fs = require('fs');
const http = require('http');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const axios = require(require.resolve('axios', { paths: [SERVER_DIR] }));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_shipping_recovery';

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
process.env.JWT_SECRET = 'test-only-shipping-recovery-secret';
process.env.BOOKING_DHL_LABEL_MODE = 'live';
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
// DHL-Mock
// ---------------------------------------------------------------------------
const shippingCalls = [];
const returnsCalls = [];
let shippingMode = 'ok';
let returnsMode = 'ok';
let shipmentCounter = 0;

const timeoutError = () => {
  const error = new Error('timeout of 30000ms exceeded');
  error.code = 'ECONNABORTED';
  return error;
};

axios.post = async (url, body) => {
  const target = String(url);
  if (target.includes('/auth/ropc/v1/token')) {
    return { status: 200, data: { access_token: 'mock-token', token_type: 'Bearer', expires_in: 3600 } };
  }
  if (target.includes('/parcel/de/shipping/v2/orders')) {
    shippingCalls.push({ url: target, body });
    await sleep(40);
    if (shippingMode === 'timeout') throw timeoutError();
    if (shippingMode === 'provider-error') {
      const error = new Error('Request failed with status code 400');
      error.response = { status: 400, data: { title: 'Bad Request', status: 400, detail: 'Invalid shipment' } };
      throw error;
    }
    shipmentCounter += 1;
    const shipmentNo = `0034043416109500${String(shipmentCounter).padStart(4, '0')}`;
    const pdf = Buffer.from(`%PDF-1.4 NEUE-AUSLIEFERUNG ${shipmentNo}`, 'utf8').toString('base64');
    return {
      status: 200,
      data: { status: { title: 'OK', statusCode: 200 }, items: [{ shipmentNo, sstatus: { statusCode: 200 }, label: { b64: pdf, fileFormat: 'PDF' } }] },
    };
  }
  if (target.includes('/parcel/de/shipping/returns/v1/orders')) {
    returnsCalls.push({ url: target, body });
    // Verzoegerung, damit sich zwei parallele Anfragen sicher ueberlappen.
    await sleep(60);
    if (returnsMode === 'timeout') throw timeoutError();
    if (returnsMode === 'provider-error') {
      const error = new Error('Request failed with status code 400');
      error.response = { status: 400, data: { detail: 'Invalid shipper' } };
      throw error;
    }
    return { status: 201, data: { shipmentNo: `RETMOCK${String(returnsCalls.length).padStart(6, '0')}`, label: { b64: Buffer.from('%PDF-1.4 retoure').toString('base64') } } };
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
const bodyText = (res) => (Buffer.isBuffer(res.data) ? res.data.toString('utf8') : (typeof res.data === 'string' ? res.data : show(res.data)));

const OUTBOUND_BODY = { shipmentData: { labelDirection: 'outbound' } };
const LEGACY_PDF = `data:application/pdf;base64,${Buffer.from('%PDF-1.4 ALT-EINSENDUNG', 'utf8').toString('base64')}`;
const ADDRESS = { street: 'Lieferweg 7', city: 'Hamburg', zipCode: '20095', country: 'DE' };

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
  const anna = await User.create({
    name: 'Anna Kundin', firstName: 'Anna', lastName: 'Kundin', email: 'anna@test.invalid', role: 'customer',
    invoiceAddress: { street: 'Rechnungsallee 1', city: 'München', zipCode: '80331', country: 'DE' },
  });
  const bernd = await User.create({ name: 'Bernd Fremd', email: 'bernd@test.invalid', role: 'customer' });

  const token = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  const adminToken = token(admin);
  const staffToken = token(staff);
  const annaToken = token(anna);
  const berndToken = token(bernd);

  let seq = 0;
  const makeOrder = (fields) => {
    seq += 1;
    return Order.create({
      orderNumber: `ORD-P1B-${String(seq).padStart(3, '0')}`,
      deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
      errorDescription: 'Display', totalCost: 100, status: 'ready-for-pickup',
      customerId: anna._id, shippingAddress: ADDRESS,
      ...fields,
    });
  };
  // Altbestand: Einsendelabel der Buchung als KOPIE im Auslieferungsfeld des Auftrags.
  const makeLegacyOrder = async (tracking, fields = {}) => {
    const order = await makeOrder(fields);
    const booking = await Booking.create({
      customerId: anna._id, orderIds: [order._id], repairOrderIds: [order._id], totalCost: 100, items: [],
      trackingNumber: tracking, shippingLabelUrl: LEGACY_PDF,
      timeline: [{ status: 'Shipping Label Created', description: 'DHL-Einsendelabel (Hinweg, inbound) erstellt', completedAt: new Date() }],
    });
    await Order.updateOne({ _id: order._id }, {
      $set: {
        bookingId: booking._id, trackingNumber: tracking, shippingLabelUrl: LEGACY_PDF, shippingStatus: 'delivered',
        actualDelivery: new Date(), trackingEvents: [{ timestamp: new Date(), status: 'delivered', description: 'Einsendung zugestellt' }],
      },
    });
    return { order, booking };
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

  // -------------------------------------------------------------------------
  console.log('\n[R1] Altbestand + Zeitueberschreitung + Abgleich "created": nie das Einsende-PDF als Auslieferung');
  const { order: legacyA, booking: legacyABooking } = await makeLegacyOrder('LEGACYIN00000001');
  res = await request('GET', `/api/orders/${legacyA._id}/shipping-label`, { token: staffToken });
  check(!bodyText(res).includes('ALT-EINSENDUNG') && res.status === 404,
    'Vor jeder Auslieferung: Download liefert das Einsende-PDF NICHT als Versandlabel', `${res.status} ${bodyText(res).slice(0, 60)}`);
  shippingMode = 'timeout';
  res = await request('POST', `/api/orders/${legacyA._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  shippingMode = 'ok';
  check(res.status === 409 && res.data?.code === 'DHL_RESULT_UNKNOWN', 'Zeitueberschreitung -> 409 DHL_RESULT_UNKNOWN', `${res.status} ${res.data?.code}`);
  res = await request('POST', `/api/orders/${legacyA._id}/shipping/reconcile`, { token: adminToken, body: { resolution: 'created', trackingNumber: '00340434161094777777' } });
  check(res.status === 200 && res.data?.shipments?.outbound?.trackingNumber === '00340434161094777777' && res.data?.shipments?.outbound?.hasLabel === false,
    'Abgleich uebernimmt Sendungsnummer, kein PDF vorhanden (hasLabel=false)', `${res.status} ${show(res.data?.shipments?.outbound && { tn: res.data.shipments.outbound.trackingNumber, hasLabel: res.data.shipments.outbound.hasLabel }) || show(res.data?.error)}`);
  res = await request('GET', `/api/orders/${legacyA._id}/shipping-label`, { token: staffToken });
  check(!bodyText(res).includes('ALT-EINSENDUNG') && res.status === 404,
    'Nach dem Abgleich: Download liefert NICHT das alte Einsende-PDF', `${res.status} ${bodyText(res).slice(0, 80)}`);
  const legacyADoc = await Order.findById(legacyA._id).lean();
  check(!legacyADoc.shippingLabelUrl && (legacyADoc.trackingEvents || []).every((event) => event.status !== 'delivered') && !legacyADoc.actualDelivery,
    'Auslieferungsfeld traegt keine Reste der Einsendung (PDF, Zustellung, Ereignisse)', show({ pdf: String(legacyADoc.shippingLabelUrl || '').slice(0, 25), events: (legacyADoc.trackingEvents || []).map((e) => e.status), delivered: legacyADoc.actualDelivery }));
  const legacyABookingDoc = await Booking.findById(legacyABooking._id).setOptions({ skipAutoPopulate: true }).lean();
  check(legacyABookingDoc.trackingNumber === 'LEGACYIN00000001' && legacyABookingDoc.shippingLabelUrl === LEGACY_PDF,
    'Original-Einsendelabel an der Buchung unveraendert', legacyABookingDoc.trackingNumber);

  console.log('\n[R1b] Abgleich mit der Einsende-Sendungsnummer wird abgelehnt');
  const { order: legacyB } = await makeLegacyOrder('LEGACYIN00000002');
  shippingMode = 'timeout';
  await request('POST', `/api/orders/${legacyB._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  shippingMode = 'ok';
  res = await request('POST', `/api/orders/${legacyB._id}/shipping/reconcile`, { token: adminToken, body: { resolution: 'created', trackingNumber: 'LEGACYIN00000002' } });
  check(res.status === 422, 'Einsende-Sendungsnummer als Auslieferung -> 422', `${res.status} ${show(res.data?.error)}`);

  console.log('\n[R1c] Altbestand + eindeutiger DHL-Fehler: Sperre frei, Buchung unveraendert, genau ein neues Label');
  const { order: legacyC, booking: legacyCBooking } = await makeLegacyOrder('LEGACYIN00000003');
  shippingMode = 'provider-error';
  res = await request('POST', `/api/orders/${legacyC._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  shippingMode = 'ok';
  let stateC = await DHLService.getOrderShipmentState(legacyC._id);
  check(res.status === 422 && stateC.shipments.outboundAction.allowed === true && stateC.shipments.outbound.hasLabel === false,
    'Nach DHL-400: Aktion wieder frei, keine Auslieferung gemeldet', `${res.status} ${stateC.shipments.outboundAction.code}`);
  callsBefore = shippingCalls.length;
  res = await request('POST', `/api/orders/${legacyC._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  const legacyCBookingDoc = await Booking.findById(legacyCBooking._id).setOptions({ skipAutoPopulate: true }).lean();
  check(res.status === 200 && shippingCalls.length === callsBefore + 1 && legacyCBookingDoc.trackingNumber === 'LEGACYIN00000003',
    'Wiederholung erzeugt genau ein Label, Buchung behaelt ihr Einsendelabel', `${res.status} calls+${shippingCalls.length - callsBefore}`);
  res = await request('GET', `/api/orders/${legacyC._id}/shipping-label`, { token: staffToken });
  check(res.status === 200 && bodyText(res).includes('NEUE-AUSLIEFERUNG'), 'Download liefert jetzt die neue Auslieferung', `${res.status} ${bodyText(res).slice(0, 50)}`);

  // -------------------------------------------------------------------------
  console.log('\n[R2] DHL-Retoure am Auftrag: zwei gleichzeitige Klicks -> genau ein DHL-Aufruf');
  const retA = await makeOrder({ shippingAddress: { ...ADDRESS, street: 'Lieferweg 7' } });
  callsBefore = returnsCalls.length;
  const [p1, p2] = await Promise.all([
    request('POST', `/api/orders/${retA._id}/return-label`, { token: staffToken, body: {} }),
    request('POST', `/api/orders/${retA._id}/return-label`, { token: adminToken, body: {} }),
  ]);
  check(returnsCalls.length === callsBefore + 1, 'genau ein DHL-Retoure-Aufruf', `calls+${returnsCalls.length - callsBefore} (${p1.status}/${p2.status})`);
  check([p1.status, p2.status].includes(200) && [p1.status, p2.status].every((status) => status === 200 || status === 409),
    'eine Anfrage erfolgreich, die andere 409 oder vorhandenes Label', `${p1.status} ${show(p1.data?.error || p1.data?.returnTrackingNumber)} / ${p2.status} ${show(p2.data?.error || p2.data?.returnTrackingNumber)}`);
  const retADoc = await Order.findById(retA._id).lean();
  check(retADoc.returnShipmentStatus === 'label-created' && /^RETMOCK/.test(retADoc.returnTrackingNumber), 'Einsendelabel am Auftrag gespeichert', `${retADoc.returnShipmentStatus} ${retADoc.returnTrackingNumber}`);

  console.log('\n[R2b] DHL-Retoure: eindeutiger Fehler loest die Reservierung');
  const retErr = await makeOrder({});
  returnsMode = 'provider-error';
  res = await request('POST', `/api/orders/${retErr._id}/return-label`, { token: staffToken, body: {} });
  returnsMode = 'ok';
  const retErrDoc = await Order.findById(retErr._id).lean();
  check(res.status >= 400 && retErrDoc.returnShipmentStatus === '' && !retErrDoc.returnTrackingNumber, 'Reservierung nach DHL-400 geloest', `${res.status} status="${retErrDoc.returnShipmentStatus}"`);

  // -------------------------------------------------------------------------
  console.log('\n[R3] Einsendung (Retoure) nach Zeitueberschreitung: Abgleich statt Sackgasse');
  const retT = await makeOrder({});
  returnsMode = 'timeout';
  res = await request('POST', `/api/orders/${retT._id}/return-label`, { token: staffToken, body: {} });
  returnsMode = 'ok';
  check(res.status === 409 && res.data?.code === 'DHL_RESULT_UNKNOWN', 'Zeitueberschreitung -> 409 DHL_RESULT_UNKNOWN', `${res.status} ${res.data?.code} ${show(res.data?.error)}`);
  res = await request('GET', `/api/orders/${retT._id}/shipments`, { token: staffToken });
  check(res.data?.shipments?.inbound?.reconciliationRequired === true && res.data?.shipments?.inboundAction?.allowed === false
    && res.data?.shipments?.inboundAction?.code === 'LABEL_RECONCILIATION_REQUIRED',
    'Versandstand meldet Abgleich der Einsendung, Aktion gesperrt', show({ recon: res.data?.shipments?.inbound?.reconciliationRequired, action: res.data?.shipments?.inboundAction }));
  callsBefore = returnsCalls.length;
  res = await request('POST', `/api/orders/${retT._id}/return-label`, { token: staffToken, body: {} });
  check(res.status === 409 && returnsCalls.length === callsBefore, 'Zweiter Klick ruft DHL NICHT erneut auf', `${res.status} calls+${returnsCalls.length - callsBefore}`);
  res = await request('POST', `/api/orders/${retT._id}/return-label/reconcile`, { token: staffToken, body: { resolution: 'created', trackingNumber: 'RETPORTAL0001' } });
  check(res.status === 403, 'Abgleich der Einsendung ist Admin-Recht', res.status);
  res = await request('POST', `/api/orders/${retT._id}/return-label/reconcile`, { token: adminToken, body: { resolution: 'created', trackingNumber: 'RETPORTAL0001' } });
  check(res.status === 200 && res.data?.shipments?.inbound?.trackingNumber === 'RETPORTAL0001' && res.data?.shipments?.inboundAction?.code === 'INBOUND_LABEL_EXISTS',
    'Admin uebernimmt die Sendungsnummer; neue Einsendung gesperrt', `${res.status} ${show(res.data?.shipments?.inbound?.trackingNumber || res.data?.error)} ${res.data?.shipments?.inboundAction?.code}`);
  callsBefore = returnsCalls.length;
  res = await request('POST', `/api/orders/${retT._id}/return-label`, { token: staffToken, body: {} });
  check(res.status === 409 && returnsCalls.length === callsBefore, 'Nach Abgleich "created": kein zweites bezahltes Label', `${res.status} calls+${returnsCalls.length - callsBefore} ${show(res.data?.error)}`);

  console.log('\n[R3b] Einsendung: Abgleich "not-created" gibt die Aktion frei');
  const retN = await makeOrder({});
  returnsMode = 'timeout';
  await request('POST', `/api/orders/${retN._id}/return-label`, { token: staffToken, body: {} });
  returnsMode = 'ok';
  res = await request('POST', `/api/orders/${retN._id}/return-label/reconcile`, { token: adminToken, body: { resolution: 'not-created' } });
  check(res.status === 200 && res.data?.shipments?.inboundAction?.allowed === true, 'Abgleich "nicht angelegt" -> Aktion frei', `${res.status} ${show(res.data?.shipments?.inboundAction || res.data?.error)}`);
  callsBefore = returnsCalls.length;
  res = await request('POST', `/api/orders/${retN._id}/return-label`, { token: staffToken, body: {} });
  check(res.status === 200 && returnsCalls.length === callsBefore + 1, 'Danach genau ein neues Einsendelabel', `${res.status} calls+${returnsCalls.length - callsBefore}`);

  console.log('\n[R3c] Einsendung ueber Parcel DE (Reklamationspfad) nach Zeitueberschreitung: gleicher Abgleich');
  const cmpT = await makeOrder({});
  shippingMode = 'timeout';
  const cmpError = await DHLService.createShipment(cmpT._id, { labelDirection: 'inbound', receiverFromConfiguration: true, shipperName: 'Anna Kundin' }, { direction: 'inbound' }).catch((error) => error);
  shippingMode = 'ok';
  let cmpState = await DHLService.getOrderShipmentState(cmpT._id);
  check(cmpError?.code === 'DHL_RESULT_UNKNOWN' && cmpState.shipments.inbound.reconciliationRequired === true && cmpState.shipments.inboundAction.allowed === false,
    'Reklamations-Einsendung: Abgleich gemeldet, Aktion gesperrt', show({ code: cmpError?.code, recon: cmpState.shipments.inbound.reconciliationRequired, action: cmpState.shipments.inboundAction.code }));
  res = await request('POST', `/api/orders/${cmpT._id}/return-label/reconcile`, { token: adminToken, body: { resolution: 'not-created' } });
  cmpState = await DHLService.getOrderShipmentState(cmpT._id);
  check(res.status === 200 && cmpState.shipments.inbound.reconciliationRequired === false && cmpState.shipments.inboundAction.allowed === true,
    'Abgleich loest die Einsende-Reservierung', `${res.status} ${cmpState.shipments.inboundAction.code}`);

  // -------------------------------------------------------------------------
  console.log('\n[R4] Verwaiste Sperre ohne Marker (Altbestand) -> Abgleich erforderlich');
  const stale = await makeOrder({});
  await Order.collection.updateOne({ _id: stale._id }, { $set: { shippingLabelCreationInProgress: true } });
  let staleState = await DHLService.getOrderShipmentState(stale._id);
  check(staleState.shipments.outbound.reconciliationRequired === true && staleState.shipments.outbound.lockStale === true
    && staleState.shipments.outboundAction.code === 'LABEL_RECONCILIATION_REQUIRED',
    'Sperre ohne Startzeit/Marker -> reconciliationRequired + lockStale', show({ out: { inProgress: staleState.shipments.outbound.inProgress, recon: staleState.shipments.outbound.reconciliationRequired, stale: staleState.shipments.outbound.lockStale }, action: staleState.shipments.outboundAction.code }));
  res = await request('POST', `/api/orders/${stale._id}/shipping/reconcile`, { token: adminToken, body: { resolution: 'not-created' } });
  check(res.status === 200 && res.data?.shipments?.outboundAction?.allowed === true, 'Admin kann die verwaiste Sperre abgleichen', `${res.status} ${show(res.data?.shipments?.outboundAction?.code || res.data?.error)}`);

  console.log('\n[R4b] Frische Sperre (Anfrage laeuft) -> KEIN Abgleich moeglich');
  const fresh = await makeOrder({});
  await Order.collection.updateOne({ _id: fresh._id }, { $set: { shippingLabelCreationInProgress: true, shippingLabelCreationStartedAt: new Date() } });
  const freshState = await DHLService.getOrderShipmentState(fresh._id);
  check(freshState.shipments.outbound.inProgress === true && freshState.shipments.outbound.reconciliationRequired === false,
    'Frische Sperre -> inProgress, kein Abgleich angezeigt', show({ inProgress: freshState.shipments.outbound.inProgress, recon: freshState.shipments.outbound.reconciliationRequired }));
  res = await request('POST', `/api/orders/${fresh._id}/shipping/reconcile`, { token: adminToken, body: { resolution: 'not-created' } });
  const freshDoc = await Order.findById(fresh._id).lean();
  check(res.status === 409 && freshDoc.shippingLabelCreationInProgress === true, 'Abgleich einer laufenden Anfrage -> 409, Sperre bleibt', `${res.status} ${res.data?.code} lock=${freshDoc.shippingLabelCreationInProgress}`);

  console.log('\n[R4c] Sperre aelter als die Frist -> Abgleich erforderlich');
  const old = await makeOrder({});
  await Order.collection.updateOne({ _id: old._id }, { $set: { shippingLabelCreationInProgress: true, shippingLabelCreationStartedAt: new Date(Date.now() - 60 * 60 * 1000) } });
  const oldState = await DHLService.getOrderShipmentState(old._id);
  check(oldState.shipments.outbound.reconciliationRequired === true && oldState.shipments.outbound.lockStale === true,
    'Sperre seit 60 Minuten -> Abgleich erforderlich', show({ recon: oldState.shipments.outbound.reconciliationRequired, stale: oldState.shipments.outbound.lockStale }));

  console.log('\n[R4d] Verwaiste Einsende-Reservierung (Altbestand) -> Abgleich erforderlich');
  const staleIn = await makeOrder({});
  await Order.collection.updateOne({ _id: staleIn._id }, { $set: { returnShipmentStatus: 'pending' } });
  const staleInState = await DHLService.getOrderShipmentState(staleIn._id);
  check(staleInState.shipments.inbound.reconciliationRequired === true && staleInState.shipments.inbound.lockStale === true
    && staleInState.shipments.inboundAction.allowed === false,
    'return* "pending" ohne Startzeit -> Abgleich der Einsendung', show({ recon: staleInState.shipments.inbound.reconciliationRequired, action: staleInState.shipments.inboundAction.code }));

  // -------------------------------------------------------------------------
  console.log('\n[R5] LABEL_PERSIST_FAILED -> Abgleich-Marker mit Sendungsnummer');
  const persist = await makeOrder({});
  const originalUpdateOne = Order.updateOne;
  let persistFailInjected = false;
  Order.updateOne = function patchedUpdateOne(filter, update, ...rest) {
    if (!persistFailInjected && String(filter?._id) === String(persist._id) && String(update?.$set?.shippingLabelUrl || '').startsWith('data:')) {
      persistFailInjected = true;
      return Promise.reject(new Error('simulierter Datenbankfehler'));
    }
    return originalUpdateOne.call(this, filter, update, ...rest);
  };
  res = await request('POST', `/api/orders/${persist._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  Order.updateOne = originalUpdateOne;
  const persistState = await DHLService.getOrderShipmentState(persist._id);
  const persistDoc = await Order.findById(persist._id).lean();
  check(res.status === 500 && res.data?.code === 'LABEL_PERSIST_FAILED' && persistState.shipments.outbound.reconciliationRequired === true
    && persistDoc.timeline.some((entry) => entry.status === 'Shipping Label Reconciliation Required' && /0034043416109500/.test(entry.description)),
    'Speicherfehler nach DHL-Erfolg -> sofort Abgleich erforderlich, Sendungsnummer im Verlauf', `${res.status} ${res.data?.code} recon=${persistState.shipments.outbound.reconciliationRequired}`);

  // -------------------------------------------------------------------------
  console.log('\n[R6] Eignung wird in der atomaren Reservierung erneut geprueft');
  const toctou = await makeOrder({});
  const originalState = DHLService.getOrderShipmentState;
  let toctouInjected = false;
  DHLService.getOrderShipmentState = async function patchedState(orderId, ...rest) {
    const state = await originalState.call(this, orderId, ...rest);
    if (!toctouInjected && String(orderId) === String(toctou._id)) {
      toctouInjected = true;
      // Gleichzeitige Aenderung durch einen anderen Mitarbeiter nach der Eignungspruefung.
      await Order.collection.updateOne({ _id: toctou._id }, { $set: { status: 'in-progress' } });
    }
    return state;
  };
  callsBefore = shippingCalls.length;
  res = await request('POST', `/api/orders/${toctou._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  DHLService.getOrderShipmentState = originalState;
  const toctouDoc = await Order.findById(toctou._id).lean();
  check(res.status >= 400 && res.status < 500 && shippingCalls.length === callsBefore && toctouDoc.shippingLabelCreationInProgress !== true,
    'Status zwischen Pruefung und Reservierung geaendert -> kein DHL-Aufruf, keine Sperre', `${res.status} ${res.data?.code} calls+${shippingCalls.length - callsBefore}`);

  // -------------------------------------------------------------------------
  console.log('\n[R7] GET /:id/shipments: einheitliche Antwort fuer fremde und fehlende Auftraege');
  const own = await makeOrder({});
  const foreign = await request('GET', `/api/orders/${own._id}/shipments`, { token: berndToken });
  const missing = await request('GET', `/api/orders/${new mongoose.Types.ObjectId()}/shipments`, { token: berndToken });
  const invalid = await request('GET', '/api/orders/keine-id/shipments', { token: berndToken });
  check(foreign.status === missing.status && foreign.status === invalid.status && show(foreign.data) === show(missing.data),
    'fremd / fehlend / ungueltig -> identische Antwort', `${foreign.status} ${show(foreign.data)} | ${missing.status} ${show(missing.data)} | ${invalid.status}`);
  res = await request('GET', `/api/orders/${own._id}/shipments`, { token: annaToken });
  check(res.status === 200 && res.data?.shipments?.outboundAction?.allowed === false, 'Eigentuemerin sieht den Versandstand ohne Aktionen', `${res.status}`);

  // -------------------------------------------------------------------------
  console.log('\n[R8] Versandkosten: gespeicherter Wert bleibt, negative Werte abgelehnt');
  const cost = await makeOrder({ shippingCost: 7.49 });
  callsBefore = shippingCalls.length;
  res = await request('POST', `/api/orders/${cost._id}/shipping/create-label`, { token: staffToken, body: { shipmentData: { shippingCost: -5 } } });
  check(res.status === 422 && shippingCalls.length === callsBefore, 'negative Versandkosten -> 422, kein DHL-Aufruf', `${res.status} ${show(res.data?.error)}`);
  res = await request('POST', `/api/orders/${cost._id}/shipping/create-label`, { token: staffToken, body: OUTBOUND_BODY });
  const costDoc = await Order.findById(cost._id).lean();
  check(res.status === 200 && costDoc.shippingCost === 7.49, 'ohne Angabe bleibt shippingCost 7,49', `${res.status} ${costDoc.shippingCost}`);

  // -------------------------------------------------------------------------
  console.log('\n[R9] Gast-Sendungsverfolgung: Einsendelabel-Kopie ist keine Auslieferung');
  const { order: guestLegacy, booking: guestBooking } = await makeLegacyOrder('LEGACYIN00000009', {
    customerId: null,
    guestTrackingToken: 'guest-token-p1b',
    guestInfo: { isGuest: true, firstName: 'Gerd', lastName: 'Gast', email: 'gast@test.invalid' },
  });
  await Booking.updateOne({ _id: guestBooking._id }, { $set: { guestTrackingToken: 'guest-booking-token-p1b', guestInfo: { email: 'gast@test.invalid', firstName: 'Gerd', lastName: 'Gast' } } });
  res = await request('GET', '/api/track-order?token=guest-token-p1b&email=gast@test.invalid');
  check(res.status === 200 && res.data?.order?.trackingNumber !== 'LEGACYIN00000009' && !String(res.data?.order?.shippingLabelUrl || '').includes(LEGACY_PDF.slice(30, 60))
    && res.data?.order?.shipments?.inbound?.trackingNumber === 'LEGACYIN00000009',
    'Gastauftrag: Versand-Sendungsnummer leer, Einsendung separat', show({ status: res.status, tn: res.data?.order?.trackingNumber, pdf: String(res.data?.order?.shippingLabelUrl || '').slice(0, 30), inbound: res.data?.order?.shipments?.inbound?.trackingNumber, err: res.data?.error }));
  res = await request('GET', '/api/track-order/booking?token=guest-booking-token-p1b&email=gast@test.invalid');
  const guestOrderView = (res.data?.orders || []).find((entry) => String(entry._id) === String(guestLegacy._id)) || {};
  check(res.status === 200 && Boolean(guestOrderView._id) && guestOrderView.trackingNumber !== 'LEGACYIN00000009' && guestOrderView.shippingStatus !== 'delivered'
    && guestOrderView.shipments?.inbound?.trackingNumber === 'LEGACYIN00000009' && guestOrderView.shipments?.outbound?.trackingNumber === '',
    'Gastbuchung: Auftrag zeigt keine Einsendung als zugestellte Auslieferung', show({ status: res.status, found: Boolean(guestOrderView._id), tn: guestOrderView.trackingNumber, st: guestOrderView.shippingStatus, shipments: guestOrderView.shipments && { in: guestOrderView.shipments.inbound?.trackingNumber, out: guestOrderView.shipments.outbound?.trackingNumber }, err: res.data?.error }));

  // -------------------------------------------------------------------------
  console.log('\n[R10] DHL-Produkte: alte Codes serverseitig normalisiert, unbekannte abgelehnt');
  // Alte Kurzcodes (P/N/Y), Kleinschreibung und Leerzeichen werden normalisiert; ohne Angabe
  // gilt das konfigurierte Produkt. So bleibt auch ein aelteres Client-Bundle (sendete 'P')
  // kompatibel.
  const products = [
    ['P', 'V01PAK'], ['p', 'V01PAK'], [' v53wpak ', 'V53WPAK'], ['Y', 'V54EPAK'], ['', 'V01PAK'],
  ].map(([input, expected]) => [input, expected, DHLService.resolveShippingProduct({ product: input }, 'V01PAK')]);
  check(products.every(([, expected, actual]) => expected === actual), 'Kurzcodes, Kleinschreibung und leere Angabe normalisiert', show(products));
  // Ein nicht angebotener Code wird NICHT still durch ein anderes Produkt ersetzt (der Kunde
  // bekaeme ein Produkt, das niemand gewaehlt hat), sondern VOR jedem DHL-Aufruf mit 400 und
  // deutscher Meldung abgelehnt.
  const rejected = ['V62WP', 'UNSINN'].map((input) => {
    try {
      return [input, 'kein Fehler', DHLService.resolveShippingProduct({ product: input }, 'V01PAK')];
    } catch (error) {
      return [input, error.code, error.status, /wird nicht angeboten/.test(error.message)];
    }
  });
  check(rejected.every(([, code, status, german]) => code === 'DHL_PRODUCT_NOT_OFFERED' && status === 400 && german === true),
    'Nicht angebotene Codes mit 400 DHL_PRODUCT_NOT_OFFERED und deutscher Meldung abgelehnt', show(rejected));
  // Das in der Integration konfigurierte Produkt bleibt zulaessig, auch wenn es nicht in der
  // Standardliste steht.
  check(DHLService.resolveShippingProduct({ product: 'V62WP' }, 'V62WP') === 'V62WP',
    'Konfiguriertes Produkt bleibt zulaessig', DHLService.resolveShippingProduct({ product: 'V62WP' }, 'V62WP'));

  // -------------------------------------------------------------------------
  console.log('\n[R11] Tracking-Aktualisierung/Webhook: Einsendelabel-Kopie wird nicht als Auslieferung verfolgt');
  const { order: legacyTrack } = await makeLegacyOrder('LEGACYIN00000011');
  const trackError = await DHLService.updateOrderTracking(legacyTrack._id).catch((error) => error);
  const legacyTrackDoc = await Order.findById(legacyTrack._id).lean();
  check(trackError?.code === 'LEGACY_INBOUND_TRACKING' && !legacyTrackDoc.timeline.some((entry) => /^Versandstatus/.test(entry.status)),
    'updateOrderTracking verweigert die Einsende-Sendungsnummer (kein DHL-Abruf)', `${trackError?.code} ${String(trackError?.message || '').slice(0, 80)}`);
  const webhookResult = await DHLService.handleWebhook({ trackingNumber: 'LEGACYIN00000011' }).catch((error) => error);
  check(webhookResult?.success === false && !(webhookResult instanceof Error), 'Webhook fuer die Einsende-Kopie wird ignoriert statt zu scheitern', show(webhookResult?.message || String(webhookResult)));

  console.log('\n[R12] Sperr-Startzeit (nicht im Schema deklariert) stoert ein spaeteres save() nicht');
  const saveProbe = await makeOrder({});
  await Order.collection.updateOne({ _id: saveProbe._id }, { $set: { shippingLabelCreationInProgress: true, shippingLabelCreationStartedAt: new Date() } });
  const saveDoc = await Order.findById(saveProbe._id);
  saveDoc.customerNotes = 'geaendert';
  const saveError = await saveDoc.save().then(() => null).catch((error) => error);
  const saveRaw = await Order.collection.findOne({ _id: saveProbe._id });
  check(!saveError && saveRaw.shippingLabelCreationStartedAt instanceof Date && saveRaw.customerNotes === 'geaendert',
    'save() funktioniert, Startzeit bleibt erhalten', show({ err: saveError && saveError.message, startedAt: saveRaw.shippingLabelCreationStartedAt }));

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
