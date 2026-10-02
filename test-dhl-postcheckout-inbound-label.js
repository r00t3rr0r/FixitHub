/**
 * Regressionstest DHL / Schritte nach dem Checkout (Track "dhl", 01.10.2026).
 *
 * Echte Express-Routen (/api/checkout, /api/bookings, /api/orders) + echte Wegwerf-DB +
 * Rollen (Kundin Anna, fremder Kunde Bernd, Kundin Carla ohne Hausnummer, Staff, Admin, Gast).
 *
 *  [C1]  Checkout (Konto): deutsche Meldung, bookingNumber, kein Base64 in der Antwort,
 *        Booking.paymentMethod gespeichert (DHL-1, DHL-11, DHL-12)
 *  [C2]  GET /api/bookings/:id/inbound-label: Einsendestatus ready, Re-Download ohne DHL-Aufruf,
 *        einheitlicher Dateiname (DHL-1, DHL-8)
 *  [C3]  Besitzpruefung aller Buchungs-Unterrouten (DHL-7 / CUSTUX-13)
 *  [C4]  Idempotenz: Wiederholung mit demselben checkoutAttemptId -> dieselbe Buchung (DHL-14)
 *  [C5]  Hausnummer fehlt -> 400 vor dem Anlegen; leerer Warenkorb deutsch (DHL-6, DHL-11)
 *  [C6]  Automatisches Label fehlgeschlagen -> Verlauf + Admin-Hinweis + state 'error';
 *        Inhaber erstellt genau EIN Label (parallel), handelnde Person im Verlauf (DHL-6, HIST-16)
 *  [C7]  Buchungssperre im Auftrags-Lesemodell (creating/review, Abgleich-URL nur fuers Team) (DHL-4)
 *  [C8]  Buchungs-Retoure: kein zweites Label, parallele Klicks, Zeitueberschreitung (DHL-3)
 *  [C9]  Dummy-Modus: Testlabel erkennbar, Kundentext ohne "Dummy", atomar (DHL-5, DHL-6)
 *  [C10] Gast-Checkout: genau EINE Bestaetigungsmail mit absolutem Link, Idempotenz,
 *        Hausnummer (FIN-14 / DHL-13 / DHL-14)
 *  [C11] HIST-16: Versandlabel/Buchungsstatus mit handelnder Person; ungueltiger Status -> 400
 *
 * ALLE DHL-Aufrufe sind GEMOCKT (axios.post ersetzt; jeder unerwartete externe Aufruf wirft).
 * Mock-Evidenz, KEINE Sandbox-Evidenz. Es werden keine E-Mails versendet (sendTriggerEmail
 * wird mitgeschnitten).
 *
 * Aufruf (nur gegen eine WEGWERF-Datenbank):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_dhl_postcheckout node test-dhl-postcheckout-inbound-label.js
 */
const path = require('path');
const fs = require('fs');
const http = require('http');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const axios = require(require.resolve('axios', { paths: [SERVER_DIR] }));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_dhl_postcheckout';

// Sicherheitsnetz (aus test-percent-rounding-consistency.js): dieser Test ruft dropDatabase()
// auf und darf nur gegen eine ausdruecklich angegebene Wegwerf-Datenbank laufen.
function isUnsafeTestUri(uri) {
  const text = String(uri || '');
  const match = text.match(/^mongodb:\/\/(?:[^@/]*@)?(\[[^\]]+\]|[^:/,?]+)(?::(\d+))?\/([^/?]+)/i);
  if (!match) return true;
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

process.env.JWT_SECRET = 'test-only-dhl-postcheckout-secret';
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
  if (target.includes('/auth/ropc/v1/token') || target.includes('/oauth') || target.includes('/token')) {
    return { status: 200, data: { access_token: 'mock-token', token_type: 'Bearer', expires_in: 3600 } };
  }
  if (target.includes('/parcel/de/shipping/v2/orders')) {
    shippingCalls.push({ url: target, body });
    await sleep(60);
    if (shippingMode === 'timeout') throw timeoutError();
    if (shippingMode === 'provider-error') {
      const error = new Error('Request failed with status code 400');
      error.response = { status: 400, data: { title: 'Bad Request', status: 400, detail: 'Invalid shipment' } };
      throw error;
    }
    shipmentCounter += 1;
    const shipmentNo = `0034043416109600${String(shipmentCounter).padStart(4, '0')}`;
    const pdf = Buffer.from(`%PDF-1.4 MOCK-LABEL ${shipmentNo}`, 'utf8').toString('base64');
    return {
      status: 200,
      data: { status: { title: 'OK', statusCode: 200 }, items: [{ shipmentNo, sstatus: { statusCode: 200 }, label: { b64: pdf, fileFormat: 'PDF' } }] },
    };
  }
  if (target.includes('/parcel/de/shipping/returns/v1/orders')) {
    returnsCalls.push({ url: target, body });
    await sleep(60);
    if (returnsMode === 'timeout') throw timeoutError();
    return { status: 201, data: { shipmentNo: `RETDHL${String(returnsCalls.length).padStart(6, '0')}`, label: { b64: Buffer.from('%PDF-1.4 retoure').toString('base64') } } };
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
      resolve({ status: res.statusCode, headers: res.headers, data, rawText: raw.toString('utf8') });
    });
  });
  req.on('error', reject);
  if (payload) req.write(payload);
  req.end();
});

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
  const Cart = mongoose.model('Cart');
  const Service = mongoose.model('Service');
  const Notification = mongoose.model('Notification');
  const SystemConfiguration = mongoose.model('SystemConfiguration');
  await Booking.syncIndexes();

  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  const sentMails = [];
  EmailService.sendTriggerEmail = async (trigger, to, data) => {
    sentMails.push({ trigger, to, data });
    return { success: true, mocked: true };
  };
  EmailService.sendOrderConfirmationEmail = async () => ({ success: true, mocked: true });
  EmailService.buildSystemUrl = async (urlPath) => `https://test.invalid${urlPath}`;
  EmailService.resolveDeviceModelImageUrl = async () => '';
  const BookingService = require(path.join(SERVER_DIR, 'services/bookingService'));

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

  const admin = await User.create({ name: 'Admin Test', email: 'admin@test.invalid', role: 'admin', isActive: true });
  const staff = await User.create({ name: 'Staff Test', email: 'staff@test.invalid', role: 'staff', isActive: true });
  const anna = await User.create({
    name: 'Anna Kundin', firstName: 'Anna', lastName: 'Kundin', email: 'anna@test.invalid', role: 'customer', isActive: true,
    invoiceAddress: { street: 'Rechnungsallee 1', city: 'München', zipCode: '80331', country: 'DE' },
  });
  const bernd = await User.create({
    name: 'Bernd Fremd', firstName: 'Bernd', lastName: 'Fremd', email: 'bernd@test.invalid', role: 'customer', isActive: true,
    invoiceAddress: { street: 'Fremdweg 9', city: 'Köln', zipCode: '50667', country: 'DE' },
  });
  const carla = await User.create({
    name: 'Carla Ohnenummer', firstName: 'Carla', lastName: 'Ohnenummer', email: 'carla@test.invalid', role: 'customer', isActive: true,
    invoiceAddress: { street: 'Musterstraße', city: 'Hamburg', zipCode: '20095', country: 'DE' },
  });
  const token = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  const adminToken = token(admin);
  const staffToken = token(staff);
  const annaToken = token(anna);
  const berndToken = token(bernd);
  const carlaToken = token(carla);

  const serviceBase = { category: 'display', deviceTypes: ['Smartphone'], manufacturerPrecise: 'Apple', modelPrecise: 'iPhone 15' };
  const display = await Service.create({ ...serviceBase, name: 'Displaytausch', price: 49.9, estimatedTime: '60' });

  const fillCart = async (user, deviceCount = 1) => {
    await Cart.deleteMany({ userId: user._id });
    await Cart.create({
      userId: user._id,
      items: [],
      repairOrders: Array.from({ length: deviceCount }, (_, index) => ({
        deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: index === 0 ? 'iPhone 15' : 'iPhone 14',
        services: [display._id], serviceNames: ['Displaytausch'], totalCost: 49.9,
      })),
    });
  };

  let seq = 0;
  const makeOrder = (fields = {}) => {
    seq += 1;
    return Order.create({
      orderNumber: `ORD-DHLT-${String(seq).padStart(3, '0')}`,
      deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
      errorDescription: 'Display', totalCost: 49.9, status: 'pending',
      customerId: anna._id, shippingAddress: { street: 'Rechnungsallee 1', city: 'München', zipCode: '80331', country: 'DE' },
      ...fields,
    });
  };
  const makeBooking = async ({ createShippingLabel = false, orders = 1 } = {}) => {
    const created = [];
    for (let i = 0; i < orders; i += 1) created.push(await makeOrder());
    const booking = await BookingService.create({
      customerId: anna._id, orderIds: created.map((o) => o._id), status: 'pending',
      paymentStatus: 'pending', billingStatus: 'unpaid', createShippingLabel,
    });
    return { booking, orders: created };
  };

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/checkout', require(path.join(SERVER_DIR, 'routes/checkoutRoutes')));
  app.use('/api/bookings', require(path.join(SERVER_DIR, 'routes/bookingRoutes')));
  app.use('/api/orders', require(path.join(SERVER_DIR, 'routes/orderRoutes')));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  let res;
  let callsBefore;

  try {
    // -----------------------------------------------------------------------
    console.log('\n[C1] Checkout als Kundin (2 Geräte, Karte): deutsche Meldung, kein Base64, paymentMethod');
    await fillCart(anna, 2);
    callsBefore = shippingCalls.length;
    const attemptId = 'co_test_attempt_000001';
    res = await request('POST', '/api/checkout/complete', { token: annaToken, body: { paymentMethod: 'card', paymentData: { lastFour: '4242' }, checkoutAttemptId: attemptId } });
    const bookingId = res.data?.bookingId;
    check(res.status === 200 && Boolean(bookingId), 'Checkout 200 mit bookingId', `${res.status} ${show(res.data?.error)}`);
    check(/Buchung/.test(res.data?.message || '') && !/Successfully/i.test(res.data?.message || ''), 'Erfolgsmeldung deutsch', res.data?.message);
    check(/^BKG-/.test(res.data?.bookingNumber || ''), 'bookingNumber auf oberster Ebene', res.data?.bookingNumber);
    check(!res.rawText.includes('base64') && res.data?.booking?.shippingLabelUrl === undefined && res.data?.booking?.hasShippingLabel === true,
      'Antwort ohne Base64-Label, hasShippingLabel=true', `${res.rawText.length} Bytes, hasShippingLabel=${res.data?.booking?.hasShippingLabel}`);
    check(shippingCalls.length === callsBefore + 1, 'Genau EIN DHL-Aufruf fuer 2 Geraete (ein Paket je Buchung)', `+${shippingCalls.length - callsBefore}`);
    const c1Booking = await Booking.findById(bookingId).setOptions({ skipAutoPopulate: true }).lean();
    check(c1Booking?.paymentMethod === 'card', 'Booking.paymentMethod gespeichert (DHL-12)', c1Booking?.paymentMethod);
    check(c1Booking?.checkoutAttemptId === attemptId, 'checkoutAttemptId an der Buchung', c1Booking?.checkoutAttemptId);

    // -----------------------------------------------------------------------
    console.log('\n[C2] Einsendestatus fuer /order-success (Inhaberin)');
    res = await request('GET', `/api/bookings/${bookingId}/inbound-label`, { token: annaToken });
    const firstTracking = res.data?.inbound?.trackingNumber;
    check(res.status === 200 && res.data?.inbound?.state === 'ready' && res.data?.inbound?.canCreate === false,
      'state ready', `${res.status} ${res.data?.inbound?.state}`);
    check(res.data?.booking?.bookingNumber === c1Booking.bookingNumber && res.data?.orders?.length === 2 && res.data?.booking?.deviceCount === 2,
      'Buchungsnummer + 2 Auftraege', show({ bn: res.data?.booking?.bookingNumber, orders: res.data?.orders?.length }));
    check(res.data?.inbound?.downloadUrl === `/api/bookings/${bookingId}/shipping-label` && /^DHL-Einsendelabel_BKG-/.test(res.data?.inbound?.filename || ''),
      'downloadUrl + Dateiname DHL-Einsendelabel_<BKG>.pdf', `${res.data?.inbound?.downloadUrl} ${res.data?.inbound?.filename}`);
    check(!res.rawText.includes('base64') && !('lastError' in (res.data?.inbound || {})) && !('reconcileUrl' in (res.data?.inbound || {})),
      'kein Base64, keine internen Felder fuer Kunden', Object.keys(res.data?.inbound || {}).join(','));
    check(res.data?.booking?.paymentMethod === 'card' && res.data?.booking?.currency === 'EUR', 'Zahlungsart + Waehrung aus den Daten', show(res.data?.booking));
    callsBefore = shippingCalls.length;
    res = await request('GET', `/api/bookings/${bookingId}/inbound-label`, { token: annaToken });
    check(res.data?.inbound?.trackingNumber === firstTracking && shippingCalls.length === callsBefore, 'Zweiter Abruf: gleiche Sendungsnummer, kein DHL-Aufruf', firstTracking);
    res = await request('GET', `/api/bookings/${bookingId}/shipping-label`, { token: annaToken });
    check(res.status === 200 && res.rawText.startsWith('%PDF') && /DHL-Einsendelabel_BKG-/.test(String(res.headers['content-disposition'])),
      'PDF-Download mit einheitlichem Dateinamen', `${res.status} ${res.headers['content-disposition']}`);
    const c1OrderId = res.status === 200 ? (await Order.findOne({ bookingId }).lean())._id : null;
    res = await request('GET', `/api/orders/${c1OrderId}/inbound-label`, { token: annaToken });
    check(res.status === 200 && res.data?.scope === 'booking' && res.data?.inbound?.state === 'ready', 'Auftragssicht liefert denselben Einsendestatus', `${res.status} ${res.data?.scope} ${res.data?.inbound?.state}`);
    // HIST-LABEL (Fix-Welle srvA): das Live-Einsendelabel der Buchung steht im Verlauf JEDES Auftrags.
    for (const c1Order of await Order.find({ bookingId }).select('_id orderNumber').lean()) {
      res = await request('GET', `/api/orders/${c1Order._id}/history`, { token: annaToken });
      const labelEntries = (res.data?.entries || []).filter((entry) => entry.title === 'DHL-Einsendelabel erstellt');
      check(res.status === 200 && labelEntries.length === 1 && !res.rawText.includes(firstTracking),
        `${c1Order.orderNumber}: Kundenverlauf zeigt "DHL-Einsendelabel erstellt" genau einmal (ohne Sendungsnummer)`, (res.data?.entries || []).map((entry) => entry.title).join(' | '));
    }
    res = await request('GET', `/api/orders/${c1OrderId}/inbound-label`, { token: berndToken });
    check(res.status === 403, 'Fremder Kunde: Auftrags-Einsendestatus 403', res.status);

    // -----------------------------------------------------------------------
    console.log('\n[C3] Besitzpruefung der Buchungs-Unterrouten (fremder Kunde Bernd)');
    for (const sub of ['summary', 'orders', 'invoice/preview', 'inbound-label', 'shipping-label', 'return-label']) {
      res = await request('GET', `/api/bookings/${bookingId}/${sub}`, { token: berndToken });
      check(res.status === 403 && !res.rawText.includes('anna@test.invalid'), `Bernd GET /${sub} -> 403`, `${res.status}`);
    }
    res = await request('POST', `/api/bookings/${bookingId}/inbound-label`, { token: berndToken, body: {} });
    check(res.status === 403, 'Bernd POST /inbound-label -> 403', res.status);
    res = await request('GET', `/api/bookings/${new mongoose.Types.ObjectId()}/summary`, { token: berndToken });
    check(res.status === 403, 'Unbekannte Buchungs-ID fuer Kunden ebenfalls 403 (keine Existenz-Auskunft)', res.status);
    res = await request('GET', `/api/bookings/${bookingId}/summary`, { token: annaToken });
    check(res.status === 200 && res.data?.summary?.customer?.email === 'anna@test.invalid', 'Inhaberin: /summary 200', res.status);
    res = await request('GET', `/api/bookings/${bookingId}/orders`, { token: annaToken });
    check(res.status === 200 && res.data?.count === 2, 'Inhaberin: /orders 200', `${res.status} ${res.data?.count}`);
    res = await request('GET', `/api/bookings/${bookingId}/orders`, { token: staffToken });
    check(res.status === 200, 'Staff: /orders 200', res.status);
    res = await request('GET', `/api/bookings/${bookingId}/inbound-label`, { token: staffToken });
    check(res.status === 200 && 'lastError' in (res.data?.inbound || {}), 'Staff: Einsendestatus mit Teamfeldern', Object.keys(res.data?.inbound || {}).join(','));

    // -----------------------------------------------------------------------
    console.log('\n[C4] Wiederholung mit demselben checkoutAttemptId (Antwort verloren)');
    const bookingCountBefore = await Booking.countDocuments();
    const orderCountBefore = await Order.countDocuments();
    callsBefore = shippingCalls.length;
    res = await request('POST', '/api/checkout/complete', { token: annaToken, body: { paymentMethod: 'card', paymentData: {}, checkoutAttemptId: attemptId } });
    check(res.status === 200 && res.data?.alreadyCompleted === true && res.data?.bookingId === bookingId, 'Gleiche Buchung zurueck', `${res.status} ${res.data?.bookingId}`);
    check(await Booking.countDocuments() === bookingCountBefore && await Order.countDocuments() === orderCountBefore && shippingCalls.length === callsBefore,
      'Keine neue Buchung, kein neuer Auftrag, kein DHL-Aufruf', `bookings ${await Booking.countDocuments()} orders ${await Order.countDocuments()}`);

    // -----------------------------------------------------------------------
    console.log('\n[C5] Hausnummer fehlt / leerer Warenkorb');
    res = await request('POST', '/api/checkout/complete', { token: annaToken, body: { paymentMethod: 'card', paymentData: {} } });
    check(res.status === 400 && res.data?.code === 'CART_EMPTY' && /Warenkorb/.test(res.data?.error || ''), 'Leerer Warenkorb: deutsch + Code', `${res.status} ${res.data?.error}`);
    await fillCart(carla, 1);
    const ordersBeforeCarla = await Order.countDocuments();
    res = await request('POST', '/api/checkout/complete', { token: carlaToken, body: { paymentMethod: 'card', paymentData: {} } });
    check(res.status === 400 && res.data?.code === 'HOUSE_NUMBER_REQUIRED' && res.data?.missingFields?.houseNumber === true && /Hausnummer/.test(res.data?.error || ''),
      'Ohne Hausnummer -> 400 houseNumber', `${res.status} ${res.data?.error}`);
    check(await Order.countDocuments() === ordersBeforeCarla, 'Kein Auftrag angelegt', await Order.countDocuments());

    // -----------------------------------------------------------------------
    console.log('\n[C6] Automatisches Label scheitert -> sichtbar; Inhaberin erstellt genau EIN Label');
    shippingMode = 'provider-error';
    const { booking: failedBooking } = await makeBooking({ createShippingLabel: true, orders: 2 });
    shippingMode = 'ok';
    await sleep(50);
    const failedDoc = await Booking.findById(failedBooking._id).setOptions({ skipAutoPopulate: true }).lean();
    check(!failedDoc.trackingNumber && failedDoc.shippingLabelCreationInProgress !== true, 'Buchung ohne Label, keine Sperre', show({ tn: failedDoc.trackingNumber, lock: failedDoc.shippingLabelCreationInProgress }));
    check((failedDoc.timeline || []).some((e) => e.status === 'Shipping Label Failed'), 'Verlauf: Shipping Label Failed', (failedDoc.timeline || []).map((e) => e.status).join(','));
    const adminNotes = await Notification.find({ userId: admin._id, title: 'Einsendelabel fehlt' }).lean();
    check(adminNotes.length === 1 && String(adminNotes[0].actionUrl || '').includes(String(failedBooking._id)), 'Admin-Hinweis mit Link zur Buchung', adminNotes.length);
    res = await request('GET', `/api/bookings/${failedBooking._id}/inbound-label`, { token: annaToken });
    check(res.data?.inbound?.state === 'error' && res.data?.inbound?.canCreate === true && !('lastError' in res.data.inbound),
      'Kundin: state error, canCreate, kein interner Grund', show(res.data?.inbound && { s: res.data.inbound.state, c: res.data.inbound.canCreate }));
    res = await request('GET', `/api/bookings/${failedBooking._id}/inbound-label`, { token: staffToken });
    check(/konnte/.test(res.data?.inbound?.lastError || ''), 'Team sieht den Grund', res.data?.inbound?.lastError);
    callsBefore = shippingCalls.length;
    const [own1, own2] = await Promise.all([
      request('POST', `/api/bookings/${failedBooking._id}/inbound-label`, { token: annaToken, body: { receiverAddress: 'Manipuliert 1' } }),
      request('POST', `/api/bookings/${failedBooking._id}/inbound-label`, { token: annaToken, body: {} }),
    ]);
    const ownStatuses = [own1.status, own2.status].sort();
    check(shippingCalls.length === callsBefore + 1, 'Zwei parallele Klicks -> genau EIN DHL-Aufruf', `+${shippingCalls.length - callsBefore}`);
    check(ownStatuses.includes(200) && ownStatuses.every((s) => s === 200 || s === 409), 'Ein 200, der andere 200/409', show(ownStatuses));
    const okResponse = own1.status === 200 && own1.data?.created ? own1 : own2;
    check(okResponse.data?.inbound?.state === 'ready' && okResponse.data?.created === true, 'Antwort enthaelt den neuen Einsendestatus', okResponse.data?.inbound?.state);
    const shipperName = String(shippingCalls[shippingCalls.length - 1]?.body?.shipments?.[0]?.consignee?.name1 || '');
    check(!/Manipuliert/.test(show(shippingCalls[shippingCalls.length - 1]?.body)) && /McRepair/i.test(shipperName), 'Request-Body ignoriert, Empfaenger aus der Konfiguration', shipperName);
    callsBefore = shippingCalls.length;
    res = await request('POST', `/api/bookings/${failedBooking._id}/inbound-label`, { token: annaToken, body: {} });
    check(res.status === 200 && res.data?.alreadyExists === true && shippingCalls.length === callsBefore, 'Dritter Klick: vorhandenes Label, kein DHL-Aufruf', `${res.status} +${shippingCalls.length - callsBefore}`);
    const createdDoc = await Booking.findById(failedBooking._id).setOptions({ skipAutoPopulate: true }).lean();
    const createdEntry = (createdDoc.timeline || []).find((e) => e.status === 'Shipping Label Created');
    check(createdEntry?.staffName === 'Anna Kundin' && createdEntry?.staffId === String(anna._id), 'HIST-16: Verlauf nennt die ausloesende Kundin', show(createdEntry && { n: createdEntry.staffName, id: createdEntry.staffId }));

    // -----------------------------------------------------------------------
    console.log('\n[C7] Buchungssperre im Auftrags-Lesemodell (DHL-4)');
    const { booking: lockedBooking, orders: [lockedOrder] } = await makeBooking({ createShippingLabel: false });
    await Booking.updateOne({ _id: lockedBooking._id }, { $set: { shippingLabelCreationInProgress: true, updatedAt: new Date() } });
    res = await request('GET', `/api/orders/${lockedOrder._id}/shipments`, { token: staffToken });
    check(res.data?.shipments?.inbound?.inProgress === true && res.data?.shipments?.inboundAction?.allowed === false && res.data?.shipments?.inboundAction?.code === 'LABEL_CREATION_IN_PROGRESS',
      'Laufende Erstellung: inProgress, Aktion gesperrt', show(res.data?.shipments?.inboundAction));
    res = await request('GET', `/api/bookings/${lockedBooking._id}/inbound-label`, { token: annaToken });
    check(res.data?.inbound?.state === 'creating', 'Einsendestatus creating', res.data?.inbound?.state);
    res = await request('POST', `/api/bookings/${lockedBooking._id}/inbound-label`, { token: annaToken, body: {} });
    check(res.status === 409 && res.data?.code === 'LABEL_CREATION_IN_PROGRESS', 'Erstellen waehrend der Sperre -> 409', `${res.status} ${res.data?.code}`);
    await Booking.updateOne({ _id: lockedBooking._id }, { $push: { timeline: { status: 'Shipping Label Reconciliation Required', description: 'Test: unklare DHL-Antwort', completedAt: new Date() } } });
    res = await request('GET', `/api/orders/${lockedOrder._id}/shipments`, { token: staffToken });
    check(res.data?.shipments?.inbound?.reconciliationRequired === true && res.data?.shipments?.inbound?.reconcileUrl === `/api/bookings/${lockedBooking._id}/shipping/reconcile`,
      'Marker: Abgleich erforderlich mit Buchungs-Abgleich-URL', res.data?.shipments?.inbound?.reconcileUrl);
    res = await request('GET', `/api/orders/${lockedOrder._id}/shipments`, { token: annaToken });
    check(res.status === 200 && !('reconcileUrl' in (res.data?.shipments?.inbound || {})) && !('lockScope' in (res.data?.shipments?.inbound || {})),
      'Kundensicht ohne Abgleich-URL/Sperrdetails', Object.keys(res.data?.shipments?.inbound || {}).join(','));
    res = await request('GET', `/api/bookings/${lockedBooking._id}/inbound-label`, { token: annaToken });
    check(res.data?.inbound?.state === 'review' && /geprüft/.test(res.data?.inbound?.message || ''), 'Einsendestatus review', res.data?.inbound?.state);
    res = await request('POST', `/api/bookings/${lockedBooking._id}/shipping/reconcile`, { token: adminToken, body: { resolution: 'not-created' } });
    res = await request('GET', `/api/bookings/${lockedBooking._id}/inbound-label`, { token: annaToken });
    check(res.data?.inbound?.state === 'none' && res.data?.inbound?.canCreate === true, 'Nach Abgleich "nicht angelegt": none + canCreate', show(res.data?.inbound && { s: res.data.inbound.state, c: res.data.inbound.canCreate }));

    // -----------------------------------------------------------------------
    console.log('\n[C8] Buchungs-Retoure (DHL-3)');
    callsBefore = returnsCalls.length;
    res = await request('POST', `/api/bookings/${bookingId}/return-label`, { token: staffToken, body: {} });
    check(res.status === 409 && res.data?.code === 'INBOUND_LABEL_EXISTS' && returnsCalls.length === callsBefore, 'Buchung mit Einsendelabel: 409, kein DHL-Aufruf', `${res.status} ${res.data?.code}`);
    const { booking: retBooking } = await makeBooking({ createShippingLabel: false });
    callsBefore = returnsCalls.length;
    const [r1, r2] = await Promise.all([
      request('POST', `/api/bookings/${retBooking._id}/return-label`, { token: staffToken, body: {} }),
      request('POST', `/api/bookings/${retBooking._id}/return-label`, { token: adminToken, body: {} }),
    ]);
    check(returnsCalls.length === callsBefore + 1, 'Zwei parallele Retoure-Klicks -> genau EIN DHL-Aufruf', `+${returnsCalls.length - callsBefore}`);
    check([r1.status, r2.status].sort().join(',') === '200,409', 'Ein 200 und ein 409', `${r1.status},${r2.status}`);
    const retDoc = await Booking.findById(retBooking._id).setOptions({ skipAutoPopulate: true }).lean();
    check(retDoc.shippingLabelCreationInProgress === false && /^RETDHL/.test(retDoc.returnTrackingNumber || ''), 'Retoure gespeichert, Sperre frei', show({ lock: retDoc.shippingLabelCreationInProgress, tn: retDoc.returnTrackingNumber }));
    res = await request('POST', `/api/bookings/${retBooking._id}/shipping/create-label`, { token: staffToken, body: { shipmentData: { labelDirection: 'inbound' } } });
    check(res.status === 409 && res.data?.code === 'INBOUND_LABEL_EXISTS', 'Danach kein zusaetzliches Parcel-DE-Label', `${res.status} ${res.data?.code}`);
    res = await request('GET', `/api/bookings/${retBooking._id}/return-label`, { token: annaToken });
    check(res.status === 200 && /DHL-Einsendelabel_/.test(String(res.headers['content-disposition'])), 'Retoure-Download als DHL-Einsendelabel_', res.headers['content-disposition']);
    const { booking: toBooking } = await makeBooking({ createShippingLabel: false });
    returnsMode = 'timeout';
    res = await request('POST', `/api/bookings/${toBooking._id}/return-label`, { token: staffToken, body: {} });
    returnsMode = 'ok';
    check(res.status === 409 && res.data?.code === 'DHL_RESULT_UNKNOWN', 'Zeitueberschreitung -> 409 DHL_RESULT_UNKNOWN', `${res.status} ${res.data?.code}`);
    const toDoc = await Booking.findById(toBooking._id).setOptions({ skipAutoPopulate: true }).lean();
    check(toDoc.shippingLabelCreationInProgress === true && (toDoc.timeline || []).some((e) => e.status === 'Shipping Label Reconciliation Required'), 'Sperre bleibt + Abgleich-Vermerk', String(toDoc.shippingLabelCreationInProgress));
    callsBefore = returnsCalls.length;
    res = await request('POST', `/api/bookings/${toBooking._id}/return-label`, { token: staffToken, body: {} });
    check(res.status === 409 && returnsCalls.length === callsBefore, 'Erneuter Klick -> 409 ohne DHL-Aufruf', `${res.status} +${returnsCalls.length - callsBefore}`);
    res = await request('POST', `/api/bookings/${toBooking._id}/shipping/reconcile`, { token: adminToken, body: { resolution: 'not-created' } });
    check(res.status === 200, 'Admin-Abgleich "nicht angelegt" loest die Sperre', res.status);

    // -----------------------------------------------------------------------
    console.log('\n[C9] Dummy-Modus (DHL-5)');
    process.env.BOOKING_DHL_LABEL_MODE = 'dummy';
    const { booking: dummyBooking, orders: [dummyOrder] } = await makeBooking({ createShippingLabel: true });
    res = await request('GET', `/api/bookings/${dummyBooking._id}/inbound-label`, { token: annaToken });
    check(res.data?.inbound?.state === 'ready' && res.data?.inbound?.placeholder === true && /^DHL-Testlabel_/.test(res.data?.inbound?.filename || ''),
      'Testlabel erkennbar (placeholder, DHL-Testlabel_)', show(res.data?.inbound && { p: res.data.inbound.placeholder, f: res.data.inbound.filename }));
    res = await request('GET', `/api/orders/${dummyOrder._id}/shipments`, { token: annaToken });
    const dummyText = show(res.data?.shipments?.inbound?.statusDescription) + show(res.data?.shipments?.inboundLabels);
    check(res.status === 200 && !/Dummy/.test(dummyText) && /Testmodus/.test(dummyText) && res.data?.shipments?.inbound?.placeholder === true,
      'Kundensicht: kein "Dummy", sondern Testmodus', res.data?.shipments?.inbound?.statusDescription);
    const { booking: dummyEmpty } = await makeBooking({ createShippingLabel: false });
    const [d1, d2] = await Promise.all([
      request('POST', `/api/bookings/${dummyEmpty._id}/inbound-label`, { token: annaToken, body: {} }),
      request('POST', `/api/bookings/${dummyEmpty._id}/inbound-label`, { token: staffToken, body: {} }),
    ]);
    const dummyDoc = await Booking.findById(dummyEmpty._id).setOptions({ skipAutoPopulate: true }).lean();
    const prepared = (dummyDoc.timeline || []).filter((e) => e.status === 'Shipping Label Prepared');
    check(prepared.length === 1 && /^DHL-DUMMY-/.test(dummyDoc.trackingNumber || ''), 'Parallel: genau EIN Testlabel', `${d1.status}/${d2.status} prepared=${prepared.length}`);
    process.env.BOOKING_DHL_LABEL_MODE = 'live';

    // -----------------------------------------------------------------------
    console.log('\n[C10] Gast-Checkout: eine Bestaetigungsmail, Idempotenz, Hausnummer');
    const guestCart = {
      items: [],
      repairOrders: [{ deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 15', services: [String(display._id)], totalCost: 49.9 }],
    };
    const guestInfo = {
      email: 'gast@test.invalid', firstName: 'Gerd', lastName: 'Gast', phone: '0301234',
      billingAddress: { street: 'Gastweg 3', city: 'Berlin', zipCode: '10117', country: 'DE' },
    };
    const mailsBefore = sentMails.length;
    callsBefore = shippingCalls.length;
    res = await request('POST', '/api/checkout/guest-complete', { body: { guestInfo, cartData: guestCart, paymentMethod: 'card', paymentData: {}, checkoutAttemptId: 'co_guest_attempt_0001' } });
    const guestBookingId = res.data?.bookingId;
    check(res.status === 200 && Boolean(guestBookingId) && /angelegt/.test(res.data?.message || ''), 'Gast-Checkout 200, deutsche Meldung', `${res.status} ${res.data?.message || res.data?.error}`);
    check(!res.rawText.includes('base64') && Boolean(res.data?.bookingTrackingToken), 'Antwort ohne Base64, mit Tracking-Token', res.rawText.length);
    check(shippingCalls.length === callsBefore + 1, 'Ein Einsendelabel fuer den Gast', `+${shippingCalls.length - callsBefore}`);
    await sleep(300);
    const guestMails = sentMails.slice(mailsBefore).filter((m) => m.trigger === 'guest_booking_created');
    check(guestMails.length === 1, 'Genau EINE guest_booking_created-Mail (FIN-14/DHL-13)', guestMails.length);
    check(/^https:\/\//.test(guestMails[0]?.data?.bookingUrl || '') && /^https:\/\//.test(guestMails[0]?.data?.trackingUrl || ''), 'Absolute Links in der Mail', guestMails[0]?.data?.bookingUrl);
    const guestBookingDoc = await Booking.findById(guestBookingId).setOptions({ skipAutoPopulate: true }).lean();
    check(guestBookingDoc?.paymentMethod === 'card', 'Gast: paymentMethod gespeichert', guestBookingDoc?.paymentMethod);
    callsBefore = shippingCalls.length;
    const guestBookingsBefore = await Booking.countDocuments();
    res = await request('POST', '/api/checkout/guest-complete', { body: { guestInfo, cartData: guestCart, paymentMethod: 'card', paymentData: {}, checkoutAttemptId: 'co_guest_attempt_0001' } });
    await sleep(200);
    check(res.status === 200 && res.data?.bookingId === guestBookingId && res.data?.alreadyCompleted === true && await Booking.countDocuments() === guestBookingsBefore && shippingCalls.length === callsBefore,
      'Gast-Wiederholung: gleiche Buchung, kein zweites Label', `${res.status} ${res.data?.bookingId}`);
    check(sentMails.slice(mailsBefore).filter((m) => m.trigger === 'guest_booking_created').length === 1, 'Auch nach Wiederholung nur eine Mail', sentMails.length - mailsBefore);
    res = await request('POST', '/api/checkout/guest-complete', { body: { guestInfo: { ...guestInfo, email: 'fremd@test.invalid' }, cartData: guestCart, paymentMethod: 'card', paymentData: {}, checkoutAttemptId: 'co_guest_attempt_0001' } });
    check(res.status === 200 && res.data?.bookingId && res.data.bookingId !== guestBookingId && !res.data?.alreadyCompleted,
      'Fremde E-Mail mit gleichem Schluessel bekommt die Gast-Buchung NICHT, sondern eine eigene', `${res.status} ${res.data?.bookingId}`);
    const foreignGuestBooking = res.data?.bookingId ? await Booking.findById(res.data.bookingId).setOptions({ skipAutoPopulate: true }).lean() : null;
    check(foreignGuestBooking && !foreignGuestBooking.checkoutAttemptId && (foreignGuestBooking.orderIds || []).length === 1,
      'Keine Auftraege ohne Buchung (Buchung ohne Schluessel angelegt)', show(foreignGuestBooking && { key: foreignGuestBooking.checkoutAttemptId, orders: foreignGuestBooking.orderIds.length }));
    res = await request('POST', '/api/checkout/guest-complete', { body: { guestInfo: { ...guestInfo, email: 'gast2@test.invalid', billingAddress: { street: 'Ohnenummerweg', city: 'Berlin', zipCode: '10117', country: 'DE' } }, cartData: guestCart, paymentMethod: 'card', paymentData: {} } });
    check(res.status === 400 && res.data?.missingFields?.houseNumber === true, 'Gast ohne Hausnummer -> 400', `${res.status} ${res.data?.error}`);

    // -----------------------------------------------------------------------
    console.log('\n[C11] HIST-16 Versandlabel/Buchungsstatus + Statusvalidierung');
    const outOrder = await makeOrder({ status: 'ready-for-pickup' });
    res = await request('POST', `/api/orders/${outOrder._id}/shipping/create-label`, { token: staffToken, body: { shipmentData: { labelDirection: 'outbound' } } });
    const outDoc = await Order.findById(outOrder._id).lean();
    const outEntry = (outDoc.timeline || []).find((e) => e.status === 'Shipping Label Created');
    check(res.status === 200 && outEntry?.staffName === 'Staff Test' && outEntry?.staffId === String(staff._id), 'Versandlabel: Verlauf nennt Staff Test', `${res.status} ${outEntry?.staffName}`);
    res = await request('GET', `/api/orders/${outOrder._id}/shipping-label`, { token: annaToken });
    check(res.status === 200 && /DHL-Versandlabel_ORD-/.test(String(res.headers['content-disposition'])), 'Auslieferung als DHL-Versandlabel_<ORD>.pdf', res.headers['content-disposition']);
    res = await request('PUT', `/api/bookings/${bookingId}/status`, { token: staffToken, body: { status: 'processing' } });
    const statusDoc = await Booking.findById(bookingId).setOptions({ skipAutoPopulate: true }).lean();
    const statusEntry = [...(statusDoc.timeline || [])].reverse().find((e) => e.status === 'processing');
    check(res.status === 200 && statusEntry?.staffName === 'Staff Test', 'Buchungsstatus: Verlauf nennt Staff Test', statusEntry?.staffName);
    res = await request('PUT', `/api/bookings/${bookingId}/status`, { token: staffToken, body: { status: 'kaputt' } });
    check(res.status === 400 && /Ausstehend/.test(res.data?.error || ''), 'Ungueltiger Status -> 400 mit deutscher Liste (vorher ReferenceError/500)', `${res.status} ${res.data?.error}`);

    // -----------------------------------------------------------------------
    console.log('\n[C12] Review-Nachbesserungen (K04 Wiederholung, parallele Wiederholung, PayPal, Verlauf, Abgleich)');
    const Payment = mongoose.model('Payment');
    const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));

    // R1: Wiederholung liefert keine internen Notizen / Teamfelder (K04)
    await fillCart(anna, 1);
    const keyR1 = 'co_review_attempt_r1_0001';
    res = await request('POST', '/api/checkout/complete', { token: annaToken, body: { paymentMethod: 'card', paymentData: {}, checkoutAttemptId: keyR1 } });
    const r1BookingId = res.data?.bookingId;
    check(res.status === 200 && !('timeline' in (res.data?.booking || {})) && !('guestInfo' in (res.data?.booking || {})),
      'Checkout-Antwort: Buchung als Positivliste (kein Verlauf)', Object.keys(res.data?.booking || {}).join(','));
    const r1Order = await Order.findOne({ bookingId: r1BookingId });
    await Order.updateOne({ _id: r1Order._id }, { $push: { staffNotes: { staffId: staff._id, staffName: 'Staff Test', note: 'INTERN-GEHEIM Kundin zahlt schlecht', type: 'internal' } } });
    res = await request('POST', '/api/checkout/complete', { token: annaToken, body: { paymentMethod: 'card', paymentData: {}, checkoutAttemptId: keyR1 } });
    const replayOrderKeys = Object.keys(res.data?.orders?.[0] || {});
    check(res.status === 200 && res.data?.alreadyCompleted === true && res.data?.bookingId === r1BookingId, 'Wiederholung: gleiche Buchung', `${res.status} ${res.data?.bookingId}`);
    check(!res.rawText.includes('INTERN-GEHEIM') && !['staffNotes', 'eParts', 'workflows', 'guestTrackingToken', 'timeline', 'ePartNeedListEntries'].some((key) => replayOrderKeys.includes(key)),
      'Wiederholung ohne interne Notizen/Teamfelder (K04)', replayOrderKeys.join(','));
    check(res.data?.orders?.[0]?.orderNumber === r1Order.orderNumber && res.data?.booking?.hasShippingLabel === true,
      'Wiederholung: Auftragsnummer + hasShippingLabel weiterhin vorhanden', show({ on: res.data?.orders?.[0]?.orderNumber, l: res.data?.booking?.hasShippingLabel }));

    // R3: parallele Wiederholung mit demselben Schluessel -> keine Auftraege ohne Buchung
    for (const delay of [0, 15, 40]) {
      await fillCart(anna, 1);
      const keyR3 = `co_review_parallel_${delay}_0001`;
      const ordersBefore = await Order.countDocuments({ customerId: anna._id });
      // [C11] legt bewusst einen Einzelauftrag ohne Buchung an -> nur die Differenz zaehlt.
      const unbookedFilter = { customerId: anna._id, $or: [{ bookingId: null }, { bookingId: { $exists: false } }] };
      const orphansBefore = await Order.countDocuments(unbookedFilter);
      const bookingsBefore = await Booking.countDocuments({ customerId: anna._id });
      const first = request('POST', '/api/checkout/complete', { token: annaToken, body: { paymentMethod: 'card', paymentData: {}, checkoutAttemptId: keyR3 } });
      await sleep(delay);
      const second = request('POST', '/api/checkout/complete', { token: annaToken, body: { paymentMethod: 'card', paymentData: {}, checkoutAttemptId: keyR3 } });
      const [p1, p2] = await Promise.all([first, second]);
      const orphanCount = (await Order.countDocuments(unbookedFilter)) - orphansBefore;
      check(p1.status === 200 && p2.status === 200 && p1.data?.bookingId && p1.data.bookingId === p2.data?.bookingId,
        `Parallel (${delay} ms): beide 200 mit derselben Buchung`, `${p1.status}/${p2.status} ${p1.data?.bookingId}/${p2.data?.bookingId} ${p1.data?.error || p2.data?.error || ''}`);
      check(await Order.countDocuments({ customerId: anna._id }) === ordersBefore + 1 && await Booking.countDocuments({ customerId: anna._id }) === bookingsBefore + 1 && orphanCount === 0,
        `Parallel (${delay} ms): genau 1 Auftrag, 1 Buchung, 0 Auftraege ohne Buchung`, show({ orders: (await Order.countDocuments({ customerId: anna._id })) - ordersBefore, orphanCount }));
    }

    // Anspruch wird bei einem Validierungsfehler freigegeben (gleicher Versuch darf erneut senden)
    await fillCart(carla, 1);
    const keyCarla = 'co_review_carla_retry_01';
    res = await request('POST', '/api/checkout/complete', { token: carlaToken, body: { paymentMethod: 'card', paymentData: {}, checkoutAttemptId: keyCarla } });
    check(res.status === 400 && res.data?.code === 'HOUSE_NUMBER_REQUIRED', 'Carla mit Schluessel: 400 Hausnummer', res.status);
    await User.updateOne({ _id: carla._id }, { $set: { 'invoiceAddress.street': 'Musterstraße 7' } });
    const retryStarted = Date.now();
    res = await request('POST', '/api/checkout/complete', { token: carlaToken, body: { paymentMethod: 'card', paymentData: {}, checkoutAttemptId: keyCarla } });
    check(res.status === 200 && res.data?.bookingId && !res.data?.alreadyCompleted && Date.now() - retryStarted < 10000,
      'Nach Korrektur: derselbe Schluessel legt sofort an (Anspruch war freigegeben)', `${res.status} ${Date.now() - retryStarted} ms ${res.data?.error || ''}`);

    // PayPal: Wiederholung mit NEUER Erfassung haengt die Zahlung an die vorhandene Buchung
    const secondCapture = await Payment.create({
      customerId: anna._id, amount: 49.9, currency: 'EUR', paymentMethod: 'paypal', status: 'completed',
      transactionId: 'CAPTURE-REVIEW-2', metadata: { paypalOrderId: 'PPO-REVIEW-2', providerReference: 'CAPTURE-REVIEW-2' },
    });
    res = await request('POST', '/api/checkout/complete', {
      token: annaToken,
      body: { paymentMethod: 'paypal', paymentData: { paypalOrderId: 'PPO-REVIEW-2', paypalCaptureId: 'CAPTURE-REVIEW-2' }, checkoutAttemptId: keyR1 },
    });
    const linkedCapture = await Payment.findById(secondCapture._id).lean();
    check(res.status === 200 && res.data?.alreadyCompleted === true && String(linkedCapture?.bookingId || '') === String(r1BookingId),
      'PayPal-Wiederholung: zweite Erfassung an der vorhandenen Buchung', `${res.status} ${linkedCapture?.bookingId}`);
    const foreignCapture = await Payment.create({
      customerId: anna._id, amount: 10, currency: 'EUR', paymentMethod: 'paypal', status: 'completed',
      transactionId: 'CAPTURE-REVIEW-3', bookingId: failedBooking._id,
    });
    res = await request('POST', '/api/checkout/complete', {
      token: annaToken,
      body: { paymentMethod: 'paypal', paymentData: { paypalCaptureId: 'CAPTURE-REVIEW-3' }, checkoutAttemptId: keyR1 },
    });
    const foreignAfter = await Payment.findById(foreignCapture._id).lean();
    check(String(foreignAfter?.bookingId) === String(failedBooking._id), 'Fremd zugeordnete Zahlung wird nicht umgehaengt', String(foreignAfter?.bookingId));

    // R2: der technische Labelfehler erreicht die Kundin nicht ueber GET /api/bookings/:id
    res = await request('GET', `/api/bookings/${failedBooking._id}`, { token: annaToken });
    const ownerTimeline = res.data?.booking?.timeline || [];
    check(res.status === 200 && ownerTimeline.length > 0 && !ownerTimeline.some((e) => e.status === 'Shipping Label Failed')
      && !/Invalid shipment|abgelehnt|konnte beim Checkout/.test(show(ownerTimeline)) && !ownerTimeline.some((e) => 'staffId' in e || 'staffName' in e),
      'Kundin: Verlauf ohne internen Labelfehler und ohne Akteursfelder', ownerTimeline.map((e) => `${e.status}:${e.title}`).join(' | '));
    check(ownerTimeline.some((e) => e.status === 'Booking Created') && ownerTimeline.some((e) => /Einsendelabel/.test(e.description || '')),
      'Kundin: Buchung erstellt + Einsendelabel erstellt bleiben sichtbar', ownerTimeline.map((e) => e.description).join(' | '));
    res = await request('GET', `/api/bookings/${failedBooking._id}`, { token: staffToken });
    check((res.data?.booking?.timeline || []).some((e) => e.status === 'Shipping Label Failed' && /konnte/.test(e.description || '')),
      'Team: Verlauf weiterhin mit Grund', (res.data?.booking?.timeline || []).length);

    // Admin-Hinweis dedupliziert + Fehlercode statt Textsuche (Shop-Hausnummer fehlt -> keine Kundenadress-Meldung)
    shippingMode = 'provider-error';
    const { booking: dedupeBooking } = await makeBooking({ createShippingLabel: true });
    res = await request('POST', `/api/bookings/${dedupeBooking._id}/inbound-label`, { token: annaToken, body: {} });
    shippingMode = 'ok';
    const dedupeNotes = await Notification.find({ userId: admin._id, actionUrl: { $regex: String(dedupeBooking._id) } }).lean();
    check(res.status >= 400 && dedupeNotes.length === 1, 'Wiederholter Fehlversuch: weiterhin genau EIN Admin-Hinweis je Buchung/Tag', `${res.status} notes=${dedupeNotes.length}`);
    await SystemConfiguration.updateOne({ 'integrations.provider': 'DHL' }, { $set: { 'integrations.$.settings.shipperStreet': 'Werkstattstraße' } });
    const { booking: shopBooking } = await makeBooking({ createShippingLabel: false });
    callsBefore = shippingCalls.length;
    res = await request('POST', `/api/bookings/${shopBooking._id}/inbound-label`, { token: annaToken, body: {} });
    await SystemConfiguration.updateOne({ 'integrations.provider': 'DHL' }, { $set: { 'integrations.$.settings.shipperStreet': 'Werkstattstraße 5' } });
    check(res.status === 503 && res.data?.code === 'INBOUND_LABEL_UNAVAILABLE' && !/Rechnungsadresse/.test(res.data?.error || '') && shippingCalls.length === callsBefore,
      'Shop-Hausnummer fehlt: neutrale 503 statt "Rechnungsadresse pruefen", kein DHL-Aufruf', `${res.status} ${res.data?.code} ${res.data?.error}`);

    // Abgleich einer Buchungs-Retoure schreibt in return*, nie in den Parcel-Platz
    const { booking: retRecon } = await makeBooking({ createShippingLabel: false });
    returnsMode = 'timeout';
    res = await request('POST', `/api/bookings/${retRecon._id}/return-label`, { token: staffToken, body: {} });
    returnsMode = 'ok';
    res = await request('POST', `/api/bookings/${retRecon._id}/shipping/reconcile`, { token: adminToken, body: { resolution: 'created', trackingNumber: 'RETDHL777777' } });
    const retReconDoc = await Booking.findById(retRecon._id).setOptions({ skipAutoPopulate: true }).lean();
    check(res.status === 200 && retReconDoc.returnTrackingNumber === 'RETDHL777777' && !retReconDoc.trackingNumber && retReconDoc.shippingLabelCreationInProgress === false,
      'Retoure-Abgleich "angelegt": returnTrackingNumber gesetzt, Parcel-Platz leer', show({ s: res.status, rt: retReconDoc.returnTrackingNumber, tn: retReconDoc.trackingNumber }));

    // HIST-16: eine Regel fuer Akteursfelder (OrderHistory.labelActorFields), Kunde als Quelle 'Kunde'
    const customerActor = DHLService.timelineActor({ _id: anna._id, name: 'Anna Kundin', role: 'customer' });
    const staffActor = DHLService.timelineActor({ _id: staff._id, name: 'Staff Test', role: 'staff' });
    const systemActor = DHLService.timelineActor(null, 'DHL Returns Integration');
    check(customerActor.source === 'Kunde' && customerActor.staffName === 'Anna Kundin' && staffActor.source === 'DHL' && staffActor.staffId === String(staff._id)
      && systemActor.staffId === 'system' && systemActor.staffName === 'DHL Returns Integration' && DHLService.timelineActor({}, 'System').staffName === 'System',
      'timelineActor delegiert an labelActorFields (Kunde/Staff/System)', show({ customerActor, staffActor, systemActor }));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect();
  }

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error('Testabbruch:', error);
  try { await mongoose.disconnect(); } catch (e) { /* ignorieren */ }
  process.exit(1);
});
