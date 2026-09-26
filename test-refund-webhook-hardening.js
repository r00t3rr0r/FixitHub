/**
 * Regressionstest Track "payments-b": Erstattungen, PayPal-Webhook, "Bezahlt"-Setzen,
 * Zuordnungsrennen und die Kunden-Zahlwege der Rechnung.
 *
 * Abgesichert (jeweils am gespeicherten Zustand, nicht nur am Rueckgabewert):
 *   1. PaypalService.refundCapture unterscheidet eine ENDGUELTIGE Ablehnung (4xx mit
 *      Antwort) von einem UNKLAREN Ergebnis (Zeitueberschreitung, keine Antwort, 5xx).
 *      Die Meldung ist deutsch und enthaelt keinen rohen PayPal-Code.
 *   2. Unklares Ergebnis: der Eintrag bleibt 'ausstehend/abzugleichen' (nie 'failed'),
 *      es wird KEINE zweite PayPal-Erstattung mit neuer Request-ID ausgeloest; die
 *      Wiederholung nutzt dieselbe PayPal-Request-Id und gleicht genau einmal ab.
 *   3. Endgueltig abgelehnt: eine kontrollierte Wiederholung unter demselben
 *      Schluessel ist moeglich (neue Request-ID), eine erfolgreiche nicht doppelt.
 *   4. "Bezahlt" setzen funktioniert nach Erstattung der Restzahlung erneut; ein
 *      Doppelklick hat genau eine Wirkung.
 *   5. Zwei verschiedene Zahlungen, gleichzeitig auf dieselbe Rechnung: keine
 *      Ueberzuordnung.
 *   6. LIVE-Webhook-Route POST /api/checkout/paypal/webhook (echter Express-Router):
 *      PAYMENT.CAPTURE.REFUNDED einer Teilerstattung ueberschreibt weder Status noch
 *      Capture-Referenz, eine Wiederholung ist wirkungslos, eine ausstehende
 *      App-Erstattung wird abgeschlossen, ein spaetes COMPLETED hebt eine Erstattung
 *      nicht auf.
 *   7. POST /api/invoices/:id/pay: dieselbe Ankuendigung zweimal = eine Vormerkung.
 *   8. POST /api/invoices/:id/payments/confirm: eine PayPal-Order/Stripe-Session einer
 *      ANDEREN Rechnung oder eine bereits anderweitig gebuchte Capture wird abgelehnt.
 *
 * Externe Anbieter sind GEMOCKT: axios wird fuer PayPal/Stripe durch einen Stub
 * ersetzt (Token, Signaturpruefung, Refund, Order, Session). Kein echtes Geld, keine
 * echte E-Mail. Das ist Mock-Evidenz, keine Sandbox-Evidenz.
 *
 * Aufruf (benoetigt eine WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_refund_hardening node test-refund-webhook-hardening.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));
// Dieselbe axios-Instanz wie in den Services (Aufloesung ueber das 'exports'-Feld),
// sonst griffe der Stub nicht und es gingen echte Anfragen hinaus.
const axios = require(require.resolve('axios', { paths: [path.join(SERVER_DIR, 'services')] }));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_refund_webhook_hardening';

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

const out = (...args) => process.stdout.write(`${args.join(' ')}\n`);
if (!process.env.DEBUG_TEST) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}

let pass = 0;
let fail = 0;
const check = (condition, message, actual) => {
  if (condition) {
    pass += 1;
    out(`  PASS ${message} :: ${actual}`);
  } else {
    fail += 1;
    out(`  FAIL ${message} :: ${actual}`);
  }
};
const runSection = async (title, fn) => {
  out(`\n[${title}]`);
  try {
    await fn();
  } catch (error) {
    fail += 1;
    out(`  FAIL Abschnitt abgebrochen :: ${error.stack || error.message}`);
  }
};
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const RAW_CODE = /\b[A-Z]{3,}(?:_[A-Z]+)+\b/;

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');

  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  const MODELS_DIR = path.join(SERVER_DIR, 'models');
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
  const Order = mongoose.model('Order');
  const Booking = mongoose.model('Booking');
  const Service = mongoose.model('Service');
  const Invoice = mongoose.model('Invoice');
  const Payment = mongoose.model('Payment');
  const PaymentAllocation = mongoose.model('PaymentAllocation');
  await Promise.all([Payment.init(), PaymentAllocation.init(), Invoice.init()]);

  // invoicePdfService braucht 'qrcode' (lokal nicht installiert) - fuer diese Routen
  // irrelevant, deshalb als leeres Modul vorbelegt.
  const pdfPath = require.resolve(path.join(SERVER_DIR, 'services/invoicePdfService'));
  require.cache[pdfPath] = { id: pdfPath, filename: pdfPath, loaded: true, exports: {} };

  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.sendTemplateEmail = async () => ({ success: true, mocked: true });
  EmailService.sendTriggerEmail = async () => ({ success: true, mocked: true });
  EmailService.buildSystemUrl = async (p) => `https://test.invalid${p}`;
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });
  NotificationService.createPaymentNotification = async () => ({ mocked: true });

  const FinancialService = require(path.join(SERVER_DIR, 'services/financialService'));
  const PaymentService = require(path.join(SERVER_DIR, 'services/paymentService'));
  const PaypalService = require(path.join(SERVER_DIR, 'services/paypalService'));

  // --- Zahlungsanbieter-Konfiguration und HTTP-Stub (kein Netz) -----------------------
  const gateways = [
    {
      _id: 'gw-paypal', provider: 'paypal', isActive: true, name: 'PayPal',
      configuration: { environment: 'sandbox', sandbox_client_id: 'test-id', sandbox_client_secret: 'test-secret', webhook_id: 'WH-TEST', default_currency: 'EUR' },
    },
    { _id: 'gw-bank', provider: 'bank_transfer', isActive: true, name: 'Überweisung', configuration: {} },
    { _id: 'gw-stripe', provider: 'stripe', isActive: true, name: 'Stripe', configuration: { mode: 'test', test_secret_key: 'sk_test_x' } },
  ];
  FinancialService.getPaymentGateways = async () => gateways;

  // PayPal-Seite der Erstattung, inkl. Idempotenz ueber PayPal-Request-Id.
  const paypal = {
    mode: 'COMPLETED',
    calls: [],
    executedByRequestId: new Map(), // requestId -> refund (tatsaechlich ausgefuehrt)
    executedTotal: 0,
    orders: new Map(),
    stripeSessions: new Map(),
  };
  const httpError = (status, data) => {
    const error = new Error(`Request failed with status code ${status}`);
    error.response = { status, data };
    return error;
  };
  const refundHandler = async (url, body, config) => {
    const captureId = decodeURIComponent(url.split('/captures/')[1].split('/')[0]);
    const requestId = config?.headers?.['PayPal-Request-Id'] || '';
    const amount = Number(body?.amount?.value || 0);
    paypal.calls.push({ captureId, amount, requestId, mode: paypal.mode });
    if (paypal.mode === 'OUTAGE') {
      // Netzstoerung: PayPal ist gar nicht erreichbar, auch nicht fuer eine Wiederholung.
      const error = new Error('connect ETIMEDOUT');
      error.code = 'ETIMEDOUT';
      throw error;
    }
    if (requestId && paypal.executedByRequestId.has(requestId)) {
      return { data: paypal.executedByRequestId.get(requestId) };
    }
    const execute = (status) => {
      const refund = { id: `RF-${paypal.executedByRequestId.size + 1}-${captureId}`, status, amount: { value: amount.toFixed(2), currency_code: 'EUR' } };
      if (requestId) paypal.executedByRequestId.set(requestId, refund);
      if (status === 'COMPLETED' || status === 'PENDING') paypal.executedTotal = round2(paypal.executedTotal + amount);
      return refund;
    };
    switch (paypal.mode) {
      case 'TIMEOUT_EXECUTED': {
        execute('COMPLETED');
        const error = new Error('timeout of 20000ms exceeded');
        error.code = 'ECONNABORTED';
        throw error;
      }
      case 'TIMEOUT_NOT_EXECUTED': {
        const error = new Error('timeout of 20000ms exceeded');
        error.code = 'ECONNABORTED';
        throw error;
      }
      case 'HTTP503':
        throw httpError(503, { name: 'SERVICE_UNAVAILABLE' });
      case 'REJECT_422':
        throw httpError(422, { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'REFUND_AMOUNT_EXCEEDED' }] });
      case 'PENDING':
        return { data: execute('PENDING') };
      default:
        return { data: execute('COMPLETED') };
    }
  };
  axios.post = async (url, body, config) => {
    if (/\/v1\/oauth2\/token$/.test(url)) return { data: { access_token: 'test-token' } };
    if (/\/v1\/notifications\/verify-webhook-signature$/.test(url)) return { data: { verification_status: 'SUCCESS' } };
    if (/\/v2\/payments\/captures\/[^/]+\/refund$/.test(url)) return refundHandler(url, body, config);
    if (/\/v2\/checkout\/orders\/[^/]+\/capture$/.test(url)) {
      const id = url.split('/orders/')[1].split('/')[0];
      return { data: paypal.orders.get(id) };
    }
    throw new Error(`Unerwarteter HTTP-POST im Test: ${url}`);
  };
  axios.get = async (url) => {
    if (/\/v2\/checkout\/orders\//.test(url)) {
      const id = decodeURIComponent(url.split('/orders/')[1].split(/[/?]/)[0]);
      if (!paypal.orders.has(id)) throw httpError(404, { name: 'RESOURCE_NOT_FOUND' });
      return { data: paypal.orders.get(id) };
    }
    if (/api\.stripe\.com\/v1\/checkout\/sessions\//.test(url)) {
      const id = url.split('/sessions/')[1];
      if (!paypal.stripeSessions.has(id)) throw httpError(404, {});
      return { data: paypal.stripeSessions.get(id) };
    }
    throw new Error(`Unerwarteter HTTP-GET im Test: ${url}`);
  };

  if (axios.defaults) {
    axios.defaults.adapter = async (config) => { throw new Error(`Echter HTTP-Aufruf im Test blockiert: ${config.url}`); };
  }

  // --- Echte Express-Router ------------------------------------------------------------
  const checkoutRoutes = require(path.join(SERVER_DIR, 'routes/checkoutRoutes'));
  const invoiceRoutes = require(path.join(SERVER_DIR, 'routes/invoiceRoutes'));
  const financialRoutes = require(path.join(SERVER_DIR, 'routes/financialRoutes'));
  const app = express();
  app.use(express.json());
  app.use('/api/checkout', checkoutRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/admin/financial', financialRoutes);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, { user = null, body = null, headers = {} } = {}) => {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try {
      json = await response.json();
    } catch (error) {
      json = null;
    }
    return { status: response.status, body: json };
  };
  const webhookHeaders = {
    'paypal-transmission-id': 'tx-1',
    'paypal-transmission-time': new Date().toISOString(),
    'paypal-transmission-sig': 'sig',
    'paypal-cert-url': 'https://api.sandbox.paypal.com/cert',
    'paypal-auth-algo': 'SHA256withRSA',
  };
  const sendWebhook = (eventType, resource) => call('POST', '/api/checkout/paypal/webhook', {
    body: { id: `WH-${crypto.randomBytes(4).toString('hex')}`, event_type: eventType, resource },
    headers: webhookHeaders,
  });

  // --- Stammdaten ------------------------------------------------------------------------
  const service = await Service.create({ name: 'Displaytausch', description: 'Display', category: 'screen', price: 50 });
  let seq = 0;
  const makeCustomer = async (extra = {}) => {
    seq += 1;
    return User.create({ name: `Kunde ${seq}`, email: `kunde-b${seq}@test.invalid`, role: 'customer', ...extra });
  };
  const makeOrder = async (customer, price, extra = {}) => {
    seq += 1;
    return Order.create({
      customerId: customer._id,
      orderNumber: `ORD-PB-${String(seq).padStart(3, '0')}`,
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 15',
      deviceType: 'Smartphone',
      errorDescription: 'Display defekt',
      services: [{ serviceId: service._id, name: 'Displaytausch', price, quantity: 1, estimatedTime: 30 }],
      totalCost: price,
      discount: 0,
      status: 'completed',
      ...extra,
    });
  };
  const makeBooking = async (customer, prices) => {
    const orders = [];
    for (const price of prices) orders.push(await makeOrder(customer, price));
    const booking = await Booking.create({
      customerId: customer._id,
      orderIds: orders.map((order) => order._id),
      items: orders.map((order) => ({ type: 'repair', orderId: order._id, orderNumber: order.orderNumber, cost: order.totalCost })),
      totalCost: round2(prices.reduce((sum, price) => sum + price, 0)),
      status: 'processing',
    });
    await Order.updateMany({ _id: { $in: orders.map((order) => order._id) } }, { $set: { bookingId: booking._id } });
    return { booking, orders };
  };
  const paypalPayment = async (booking, order, amount, captureId, extra = {}) => Payment.create({
    bookingId: booking?._id,
    orderId: order?._id,
    customerId: booking?.customerId,
    amount,
    paymentMethod: 'paypal',
    status: 'completed',
    source: 'checkout',
    processedAt: new Date(),
    transactionId: `PPORDER-${captureId}`,
    metadata: { paypalOrderId: `PPORDER-${captureId}`, providerReference: captureId, providerDetails: { captureId } },
    ...extra,
  });

  // =====================================================================================
  await runSection('1 refundCapture: endgueltig abgelehnt vs. unklar, deutsche Meldung', async () => {
    const results = {};
    for (const mode of ['TIMEOUT_NOT_EXECUTED', 'HTTP503', 'REJECT_422']) {
      paypal.mode = mode;
      try {
        await PaypalService.refundCapture('CAP-CLASSIFY', 5, { requestId: `classify-${mode}` });
        results[mode] = { thrown: false };
      } catch (error) {
        results[mode] = { thrown: true, outcome: error.refundOutcome, message: error.message, providerCode: error.providerCode };
      }
    }
    check(results.TIMEOUT_NOT_EXECUTED.outcome === 'indeterminate', 'Zeitueberschreitung = unklar (Geld evtl. bewegt)', JSON.stringify(results.TIMEOUT_NOT_EXECUTED));
    check(results.HTTP503.outcome === 'indeterminate', 'HTTP 503 = unklar', JSON.stringify(results.HTTP503));
    check(results.REJECT_422.outcome === 'rejected', 'HTTP 422 mit Antwort = endgueltig abgelehnt', JSON.stringify(results.REJECT_422));
    check(results.REJECT_422.message && !RAW_CODE.test(results.REJECT_422.message) && /PayPal|Betrag/.test(results.REJECT_422.message),
      'Meldung deutsch, kein roher PayPal-Code im Satz', results.REJECT_422.message);
    check(results.REJECT_422.providerCode === 'REFUND_AMOUNT_EXCEEDED', 'Roher Code nur als providerCode', results.REJECT_422.providerCode);
  });

  // =====================================================================================
  await runSection('2 Unklares PayPal-Ergebnis: ausstehend, keine zweite Erstattung, Abgleich mit derselben Request-ID', async () => {
    const customer = await makeCustomer();
    const { booking, orders } = await makeBooking(customer, [40]);
    const payment = await paypalPayment(booking, orders[0], 100, 'CAP-UNCLEAR');
    paypal.calls.length = 0;
    paypal.executedTotal = 0;

    paypal.mode = 'TIMEOUT_EXECUTED'; // PayPal hat erstattet, unsere Antwort ging verloren
    let first = null;
    let firstError = null;
    try {
      first = await FinancialService.processRefund(String(payment._id), 20, 'Teilerstattung', { mode: 'gateway', idempotencyKey: 'dlg-unclear-1' });
    } catch (error) {
      firstError = error;
    }
    let stored = await Payment.findById(payment._id).lean();
    const entry = (stored.refunds || [])[0];
    check(!firstError, 'Zeitueberschreitung wird NICHT als Fehler "nichts erstattet" gemeldet', firstError ? firstError.message : 'kein Fehler');
    check(first && first.status === 'pending' && first.indeterminate === true, 'Antwort: ausstehend, Ergebnis unklar', first ? `${first.status} / ${first.indeterminate}` : 'keine Antwort');
    check(entry && entry.status === 'pending', 'Eintrag bleibt ausstehend (nicht failed)', entry ? entry.status : 'kein Eintrag');
    check(!stored.refundAmount, 'Noch nichts als erstattet gezaehlt', stored.refundAmount);

    // Neuer Dialog (anderer Schluessel), andere Summe, PayPal weiter nicht erreichbar:
    // darf KEINE zweite PayPal-Erstattung mit neuer Request-ID ausloesen, solange die
    // erste ungeklaert ist (der Abgleich der ersten mit IHRER Request-ID scheitert).
    paypal.mode = 'OUTAGE';
    const callsBefore = paypal.calls.length;
    let blocked = null;
    try {
      await FinancialService.processRefund(String(payment._id), 15, 'Andere Erstattung', { mode: 'gateway', idempotencyKey: 'dlg-unclear-2' });
    } catch (error) {
      blocked = error;
    }
    const newRequestIds = paypal.calls.slice(callsBefore).map((c) => c.requestId).filter((id) => id !== paypal.calls[0].requestId);
    check(blocked && blocked.statusCode === 409 && !RAW_CODE.test(blocked.message), 'Neue Erstattung abgelehnt, solange eine ungeklaert ist (409, deutsch)', blocked ? `${blocked.statusCode} ${blocked.message}` : 'nicht abgelehnt');
    check(newRequestIds.length === 0, 'Keine PayPal-Erstattung mit neuer Request-ID', JSON.stringify(newRequestIds));
    check(paypal.executedTotal === 20, 'Bei PayPal genau 20 erstattet (nicht doppelt)', paypal.executedTotal);

    // PayPal wieder erreichbar, Bearbeiter oeffnet einen NEUEN Dialog (anderer Schluessel).
    // Die fruehere, ungeklaerte Erstattung wird NICHT als Nebenwirkung dieser neuen Anfrage
    // erneut ausgefuehrt: hatte sie PayPal nie erreicht, wuerde sonst jetzt Geld fliessen,
    // das in DIESEM Dialog niemand angefordert hat. Die neue Erstattung wird angehalten, bis
    // der fruehere Vorgang ausdruecklich geklaert ist - ohne jeden PayPal-Aufruf.
    paypal.mode = 'COMPLETED';
    const callsBeforeRecheck = paypal.calls.length;
    let recheck = null;
    try {
      await FinancialService.processRefund(String(payment._id), 20, 'Teilerstattung nochmal', { mode: 'gateway', idempotencyKey: 'dlg-unclear-2b' });
    } catch (error) {
      recheck = error;
    }
    stored = await Payment.findById(payment._id).lean();
    check(recheck && recheck.statusCode === 409 && recheck.code === 'REFUND_UNRESOLVED' && !RAW_CODE.test(recheck.message),
      'Neue Erstattung angehalten, solange die fruehere ungeklaert ist (409, deutsch)', recheck ? `${recheck.code} ${recheck.message}` : 'nicht angehalten');
    check(paypal.calls.length === callsBeforeRecheck, 'Kein PayPal-Aufruf als Nebenwirkung einer anderen Anfrage', `${paypal.calls.length - callsBeforeRecheck} Aufrufe`);
    check(!stored.refundAmount && paypal.executedTotal === 20, 'Nichts doppelt: gebucht 0, bei PayPal weiterhin genau 20', `${stored.refundAmount} / ${paypal.executedTotal}`);

    // Wiederholung im URSPRUENGLICHEN Dialog (gleicher Schluessel = gleiche Absicht, gleiche
    // PayPal-Request-Id): PayPal antwortet idempotent mit der bereits ausgefuehrten Erstattung.
    // Es fliesst kein zweites Mal Geld, der Vorgang wird abgeschlossen.
    const callsBeforeRetry = paypal.calls.length;
    const retry = await FinancialService.processRefund(String(payment._id), 20, 'Teilerstattung', { mode: 'gateway', idempotencyKey: 'dlg-unclear-1' });
    stored = await Payment.findById(payment._id).lean();
    const retryCall = paypal.calls[paypal.calls.length - 1];
    check(retry.status === 'completed' && paypal.calls.length === callsBeforeRetry + 1 && retryCall.requestId === paypal.calls[0].requestId,
      'Wiederholung im selben Dialog: genau ein Abgleich mit DERSELBEN PayPal-Request-Id', `${retry.status} / ${paypal.calls.length - callsBeforeRetry} Aufruf(e) / ${retryCall.requestId === paypal.calls[0].requestId}`);
    check(stored.refundAmount === 20 && paypal.executedTotal === 20, 'Abgeglichen: 20 erstattet, genau einmal, bei PayPal genau 20', `${stored.refundAmount} / ${paypal.executedTotal}`);
    check(stored.status === 'completed', 'Rest bleibt gueltig (Teilerstattung)', stored.status);

    // Danach ist eine NEUE, andere Erstattung wieder moeglich (keine Dauerblockade).
    const next = await FinancialService.processRefund(String(payment._id), 15, 'Andere Erstattung', { mode: 'gateway', idempotencyKey: 'dlg-unclear-2' });
    stored = await Payment.findById(payment._id).lean();
    check(next.status === 'completed' && stored.refundAmount === 35 && paypal.executedTotal === 35, 'Nach Abgleich: weitere Erstattung 15 moeglich (20 + 15)', `${next.status} / ${stored.refundAmount} / ${paypal.executedTotal}`);

    // Manueller Abgleich (Admin hat im PayPal-Konto geprueft).
    const payment3 = await paypalPayment(booking, orders[0], 60, 'CAP-UNCLEAR-3');
    paypal.mode = 'TIMEOUT_NOT_EXECUTED';
    await FinancialService.processRefund(String(payment3._id), 12, 'unklar', { mode: 'gateway', idempotencyKey: 'dlg-unclear-4' });
    let stored3 = await Payment.findById(payment3._id).lean();
    await FinancialService.resolveUnresolvedRefund(String(payment3._id), String(stored3.refunds[0]._id), { resolution: 'not-executed', actorName: 'Test' });
    stored3 = await Payment.findById(payment3._id).lean();
    check(stored3.refunds[0].status === 'failed' && !stored3.refundAmount, 'Abgleich "nicht ausgefuehrt": failed, nichts gebucht', `${stored3.refunds[0].status} / ${stored3.refundAmount}`);
    await FinancialService.processRefund(String(payment3._id), 12, 'unklar2', { mode: 'gateway', idempotencyKey: 'dlg-unclear-5' });
    stored3 = await Payment.findById(payment3._id).lean();
    const pendingEntry = stored3.refunds.find((r) => r.status === 'pending');
    await FinancialService.resolveUnresolvedRefund(String(payment3._id), String(pendingEntry._id), { resolution: 'executed', providerRefundId: 'MANUALREF123', actorName: 'Test' });
    await FinancialService.applyGatewayRefundUpdate({ provider: 'paypal', captureId: 'CAP-UNCLEAR-3', refundId: 'MANUALREF123', amount: 12, status: 'COMPLETED' });
    stored3 = await Payment.findById(payment3._id).lean();
    check(stored3.refundAmount === 12, 'Abgleich "ausgefuehrt" + spaeterer Webhook: genau 12 gebucht', stored3.refundAmount);

    // Unklarer Eintrag wird auch durch den Webhook abgeschlossen (ohne Request-ID).
    const payment2 = await paypalPayment(booking, orders[0], 60, 'CAP-UNCLEAR-2');
    paypal.mode = 'HTTP503';
    const pending2 = await FinancialService.processRefund(String(payment2._id), 10, 'unklar', { mode: 'gateway', idempotencyKey: 'dlg-unclear-3' }).catch((error) => ({ error }));
    check(pending2 && pending2.status === 'pending', 'HTTP 503 -> ausstehend', pending2.error ? pending2.error.message : pending2.status);
    await FinancialService.applyGatewayRefundUpdate({ provider: 'paypal', captureId: 'CAP-UNCLEAR-2', refundId: 'RF-WH-9', amount: 10, status: 'COMPLETED' });
    const stored2 = await Payment.findById(payment2._id).lean();
    check(stored2.refundAmount === 10 && stored2.refunds.length === 1 && stored2.refunds[0].status === 'completed', 'Webhook schliesst den unklaren Eintrag ab (kein zweiter Eintrag)', `${stored2.refundAmount} / ${stored2.refunds.length}`);
  });

  // =====================================================================================
  await runSection('3 Endgueltig abgelehnt: kontrollierte Wiederholung unter demselben Schluessel', async () => {
    const customer = await makeCustomer();
    const { booking, orders } = await makeBooking(customer, [30]);
    const payment = await paypalPayment(booking, orders[0], 50, 'CAP-RETRY');
    paypal.calls.length = 0;

    paypal.mode = 'REJECT_422';
    let rejected = null;
    try {
      await FinancialService.processRefund(String(payment._id), 20, 'Kulanz', { mode: 'gateway', idempotencyKey: 'dlg-retry-1' });
    } catch (error) {
      rejected = error;
    }
    let stored = await Payment.findById(payment._id).lean();
    check(rejected && rejected.code === 'GATEWAY_REFUND_FAILED' && !RAW_CODE.test(rejected.message), 'Ablehnung gemeldet, deutsch, ohne rohen Code', rejected ? rejected.message : 'kein Fehler');
    check(stored.refunds.length === 1 && stored.refunds[0].status === 'failed' && !stored.refundAmount, 'Eintrag failed, nichts gezaehlt', `${stored.refunds.map((r) => r.status)} / ${stored.refundAmount}`);

    paypal.mode = 'COMPLETED';
    let retry = null;
    let retryError = null;
    try {
      retry = await FinancialService.processRefund(String(payment._id), 20, 'Kulanz', { mode: 'gateway', idempotencyKey: 'dlg-retry-1' });
    } catch (error) {
      retryError = error;
    }
    stored = await Payment.findById(payment._id).lean();
    check(!retryError && retry && retry.status === 'completed', 'Wiederholung mit demselben Schluessel moeglich', retryError ? `${retryError.code} ${retryError.message}` : retry.status);
    check(stored.refundAmount === 20, '20 erstattet', stored.refundAmount);
    check(paypal.calls.length === 2 && paypal.calls[0].requestId !== paypal.calls[1].requestId, 'Neue PayPal-Request-Id fuer den neuen Versuch', JSON.stringify(paypal.calls.map((c) => c.requestId)));

    const third = await FinancialService.processRefund(String(payment._id), 20, 'Kulanz', { mode: 'gateway', idempotencyKey: 'dlg-retry-1' });
    stored = await Payment.findById(payment._id).lean();
    check(third.duplicate === true && stored.refundAmount === 20 && paypal.calls.length === 2, 'Erfolgreiche Erstattung wird nicht wiederholt', `${third.duplicate} / ${stored.refundAmount} / ${paypal.calls.length}`);

    // Parallel: zwei gleichzeitige Wiederholungen eines abgelehnten Vorgangs -> eine Wirkung.
    const payment2 = await paypalPayment(booking, orders[0], 50, 'CAP-RETRY-2');
    paypal.mode = 'REJECT_422';
    await FinancialService.processRefund(String(payment2._id), 10, 'x', { mode: 'gateway', idempotencyKey: 'dlg-retry-2' }).catch(() => {});
    paypal.mode = 'COMPLETED';
    await Promise.all([
      FinancialService.processRefund(String(payment2._id), 10, 'x', { mode: 'gateway', idempotencyKey: 'dlg-retry-2' }).catch(() => null),
      FinancialService.processRefund(String(payment2._id), 10, 'x', { mode: 'gateway', idempotencyKey: 'dlg-retry-2' }).catch(() => null),
    ]);
    const stored2 = await Payment.findById(payment2._id).lean();
    check(stored2.refundAmount === 10 && stored2.refunds.filter((r) => r.status !== 'failed').length === 1, 'Parallele Wiederholung: genau eine Erstattung', `${stored2.refundAmount} / ${stored2.refunds.map((r) => r.status)}`);
  });

  // =====================================================================================
  await runSection('4 "Bezahlt" nach Erstattung der Restzahlung erneut moeglich, Doppelklick = eine Wirkung', async () => {
    const customer = await makeCustomer();
    const { booking, orders } = await makeBooking(customer, [150]);
    await paypalPayment(booking, orders[0], 100, 'CAP-MARK');
    const invoice = await FinancialService.generateFromRepairOrders([String(orders[0]._id)], {});
    const paidAt = new Date().toISOString();
    await Promise.all([
      FinancialService.changeInvoiceStatus(String(invoice._id), 'paid', { paymentMethod: 'cash', paidAt }).catch(() => null),
      FinancialService.changeInvoiceStatus(String(invoice._id), 'paid', { paymentMethod: 'cash', paidAt }).catch(() => null),
    ]);
    let cash = await Payment.find({ bookingId: booking._id, paymentMethod: 'cash' }).lean();
    check(cash.length === 1 && cash[0].amount === 50, 'Doppelklick: genau eine Restzahlung 50', cash.map((p) => p.amount).join(','));

    await FinancialService.processRefund(String(cash[0]._id), 50, 'versehentlich erfasst', { mode: 'manual' });
    const reopened = await PaymentService.computeInvoiceBalance(invoice._id);
    check(reopened.open === 50, 'Nach Erstattung wieder 50 offen', reopened.open);
    const statusAfterRefund = (await Invoice.findById(invoice._id).lean()).status;

    let again = null;
    let againError = null;
    try {
      again = await FinancialService.changeInvoiceStatus(String(invoice._id), 'paid', { paymentMethod: 'cash', paidAt: new Date().toISOString() });
    } catch (error) {
      againError = error;
    }
    const balance = await PaymentService.computeInvoiceBalance(invoice._id);
    cash = await Payment.find({ bookingId: booking._id, paymentMethod: 'cash' }).lean();
    check(!againError && again && again.status === 'paid', `Erneut "bezahlt" (vorher ${statusAfterRefund}) funktioniert`, againError ? `${againError.code} ${againError.message}` : again.status);
    check(balance.open === 0 && balance.allocated === 150, 'Beleg: 150 gueltig zugeordnet, offen 0', JSON.stringify({ a: balance.allocated, o: balance.open }));
    check(cash.length === 2 && cash.filter((p) => p.status === 'completed' && !p.refundAmount).length === 1, 'Genau eine neue gueltige Restzahlung', cash.map((p) => `${p.amount}/${p.status}/${p.refundAmount || 0}`).join(','));
  });

  // =====================================================================================
  await runSection('5 Zwei verschiedene Zahlungen gleichzeitig auf dieselbe Rechnung: keine Ueberzuordnung', async () => {
    const customer = await makeCustomer();
    const order = await makeOrder(customer, 100);
    const invoice = await FinancialService.createInvoiceFromOrder(String(order._id));
    const results = await Promise.all([1, 2, 3, 4].map((n) => FinancialService.addInvoicePayment(String(invoice._id), {
      amount: 100,
      paymentMethod: n % 2 ? 'cash' : 'bank_transfer',
      paymentReference: `Parallel ${n}`,
    }).then((r) => ({ ok: true, r })).catch((error) => ({ ok: false, error }))));
    const succeeded = results.filter((r) => r.ok && !r.r.duplicate).length;
    const allocations = await PaymentAllocation.find({ invoiceId: invoice._id }).lean();
    const allocated = round2(allocations.reduce((s, a) => s + a.allocatedAmount, 0));
    const completed = await Payment.countDocuments({ invoiceId: invoice._id, status: 'completed' });
    const balance = await PaymentService.computeInvoiceBalance(invoice._id);
    check(succeeded === 1, 'Genau eine Zahlung angenommen', succeeded);
    check(allocated === 100, 'Zugeordnet genau 100 (nicht mehr)', allocated);
    check(completed === 1 && balance.overpaid === 0, 'Keine zusaetzliche gezaehlte Zahlung, keine Ueberzahlung', `${completed} / ${balance.overpaid}`);
    const rejected = results.filter((r) => !r.ok).map((r) => r.error.message);
    check(rejected.every((m) => !RAW_CODE.test(m)), 'Ablehnungen deutsch', rejected.join(' | '));

    // Nacheinander zwei Teilzahlungen funktionieren weiterhin.
    const order2 = await makeOrder(customer, 80);
    const invoice2 = await FinancialService.createInvoiceFromOrder(String(order2._id));
    await FinancialService.addInvoicePayment(String(invoice2._id), { amount: 30, paymentMethod: 'cash' });
    await FinancialService.addInvoicePayment(String(invoice2._id), { amount: 50, paymentMethod: 'bank_transfer' });
    const b2 = await PaymentService.computeInvoiceBalance(invoice2._id);
    check(b2.open === 0 && b2.allocated === 80, 'Zwei Teilzahlungen nacheinander: bezahlt', JSON.stringify({ a: b2.allocated, o: b2.open }));
  });

  // =====================================================================================
  await runSection('6 LIVE-Webhook-Route: Refund-Ereignisse idempotent und kumulativ', async () => {
    const customer = await makeCustomer();
    const { booking, orders } = await makeBooking(customer, [100]);
    const payment = await paypalPayment(booking, orders[0], 100, 'CAP-WH');
    const refundResource = (id, value, status = 'COMPLETED') => ({
      id,
      status,
      amount: { value: value.toFixed(2), currency_code: 'EUR' },
      supplementary_data: { related_ids: { order_id: 'PPORDER-CAP-WH' } },
      links: [
        { rel: 'self', href: `https://api.sandbox.paypal.com/v2/payments/refunds/${id}` },
        { rel: 'up', href: 'https://api.sandbox.paypal.com/v2/payments/captures/CAP-WH' },
      ],
    });

    const r1 = await sendWebhook('PAYMENT.CAPTURE.REFUNDED', refundResource('RF-DASH-1', 40));
    let stored = await Payment.findById(payment._id).lean();
    check(r1.status === 200, 'Webhook angenommen', r1.status);
    check(stored.status === 'completed' && stored.refundAmount === 40, 'Teilerstattung 40: Status bleibt completed, 60 zaehlen weiter', `${stored.status} / ${stored.refundAmount}`);
    check(stored.metadata?.providerReference === 'CAP-WH', 'Capture-Referenz nicht durch Refund-ID ueberschrieben', stored.metadata?.providerReference);

    await sendWebhook('PAYMENT.CAPTURE.REFUNDED', refundResource('RF-DASH-1', 40));
    stored = await Payment.findById(payment._id).lean();
    check(stored.refundAmount === 40 && (stored.refunds || []).length === 1, 'Wiederholter Webhook: keine zweite Buchung', `${stored.refundAmount} / ${(stored.refunds || []).length}`);

    // Ausstehende App-Erstattung wird durch den Webhook abgeschlossen.
    paypal.mode = 'PENDING';
    const pending = await FinancialService.processRefund(String(payment._id), 25, 'App-Erstattung', { mode: 'gateway', idempotencyKey: 'dlg-wh-1' });
    stored = await Payment.findById(payment._id).lean();
    check(pending.status === 'pending' && stored.refundAmount === 40, 'PENDING zaehlt noch nicht', `${pending.status} / ${stored.refundAmount}`);
    await sendWebhook('PAYMENT.CAPTURE.REFUNDED', refundResource(pending.gatewayReference, 25));
    await sendWebhook('PAYMENT.CAPTURE.REFUNDED', refundResource(pending.gatewayReference, 25));
    stored = await Payment.findById(payment._id).lean();
    check(stored.refundAmount === 65 && stored.refunds.filter((r) => r.status === 'completed').length === 2, 'Webhook schliesst die ausstehende Erstattung genau einmal ab (40 + 25)', `${stored.refundAmount} / ${stored.refunds.map((r) => r.status)}`);

    // Vollstaendige Rueckbuchung, danach ein verspaetetes CAPTURE.COMPLETED.
    await sendWebhook('PAYMENT.CAPTURE.REVERSED', { ...refundResource('RF-REV-1', 35), status: undefined });
    stored = await Payment.findById(payment._id).lean();
    check(stored.refundAmount === 100 && stored.status === 'refunded', 'Rueckbuchung 35: voll erstattet', `${stored.refundAmount} / ${stored.status}`);
    await sendWebhook('PAYMENT.CAPTURE.COMPLETED', {
      id: 'CAP-WH', status: 'COMPLETED', amount: { value: '100.00', currency_code: 'EUR' },
      supplementary_data: { related_ids: { order_id: 'PPORDER-CAP-WH' } },
    });
    stored = await Payment.findById(payment._id).lean();
    check(stored.status === 'refunded' && stored.refundAmount === 100 && stored.amount === 100, 'Spaetes COMPLETED hebt die Erstattung nicht auf', `${stored.status} / ${stored.refundAmount} / ${stored.amount}`);

    const unknown = await sendWebhook('PAYMENT.CAPTURE.REFUNDED', { ...refundResource('RF-UNKNOWN', 5), links: [{ rel: 'up', href: 'https://x/v2/payments/captures/CAP-UNBEKANNT' }], supplementary_data: {} });
    check(unknown.status === 200 && unknown.body?.paymentUpdated === false, 'Unbekannte Capture: quittiert, nichts veraendert', `${unknown.status} / ${unknown.body?.paymentUpdated}`);
  });

  // =====================================================================================
  const customerHttp = await makeCustomer();
  await runSection('7 POST /api/invoices/:id/pay: dieselbe Ankuendigung zweimal = eine Vormerkung', async () => {
    const order = await makeOrder(customerHttp, 70);
    const invoice = await FinancialService.createInvoiceFromOrder(String(order._id));
    const body = { amount: 70, gatewayId: 'gw-bank', gatewayProvider: 'bank_transfer', paymentData: { accountHolder: 'Kunde', iban: 'DE02120300000000202051' } };
    const [a, b] = await Promise.all([
      call('POST', `/api/invoices/${invoice._id}/pay`, { user: customerHttp, body }),
      call('POST', `/api/invoices/${invoice._id}/pay`, { user: customerHttp, body }),
    ]);
    const c = await call('POST', `/api/invoices/${invoice._id}/pay`, { user: customerHttp, body });
    const pending = await Payment.countDocuments({ invoiceId: invoice._id, status: 'pending' });
    check([a.status, b.status, c.status].every((s) => s === 202), 'Alle Antworten 202 (vorgemerkt)', [a.status, b.status, c.status].join(','));
    check(pending === 1, 'Genau EINE Vormerkung gespeichert', pending);
    const balance = await PaymentService.computeInvoiceBalance(invoice._id);
    check(balance.open === 70, 'Vormerkung zaehlt nicht als Zahlung', balance.open);
  });

  // =====================================================================================
  await runSection('8 POST /api/invoices/:id/payments/confirm: Referenz muss zu DIESER Rechnung gehoeren', async () => {
    const orderA = await makeOrder(customerHttp, 30);
    const orderB = await makeOrder(customerHttp, 30);
    const invoiceA = await FinancialService.createInvoiceFromOrder(String(orderA._id));
    const invoiceB = await FinancialService.createInvoiceFromOrder(String(orderB._id));
    const ppOrder = (id, invoiceId, captureId) => ({
      id,
      status: 'COMPLETED',
      purchase_units: [{
        reference_id: String(invoiceId),
        custom_id: String(invoiceId),
        amount: { value: '30.00', currency_code: 'EUR' },
        payments: { captures: [{ id: captureId, status: 'COMPLETED', amount: { value: '30.00', currency_code: 'EUR' } }] },
      }],
    });
    paypal.orders.set('PPO-B', ppOrder('PPO-B', invoiceB._id, 'CAP-PPO-B'));

    const wrong = await call('POST', `/api/invoices/${invoiceA._id}/payments/confirm`, { user: customerHttp, body: { gatewayProvider: 'paypal', gatewayId: 'gw-paypal', providerReference: 'PPO-B' } });
    const onA = await Payment.countDocuments({ invoiceId: invoiceA._id });
    check(wrong.status >= 400 && wrong.status < 500 && onA === 0, 'PayPal-Order einer anderen Rechnung abgelehnt, nichts gebucht', `${wrong.status} ${wrong.body?.error}`);
    check(wrong.body?.error && !RAW_CODE.test(wrong.body.error) && !/[A-Za-z]+ [A-Za-z]+ is /.test(wrong.body.error), 'Meldung deutsch', wrong.body?.error);

    const right = await call('POST', `/api/invoices/${invoiceB._id}/payments/confirm`, { user: customerHttp, body: { gatewayProvider: 'paypal', gatewayId: 'gw-paypal', providerReference: 'PPO-B' } });
    const balanceB = await PaymentService.computeInvoiceBalance(invoiceB._id);
    check(right.status === 201 && balanceB.open === 0, 'Richtige Rechnung: gebucht, bezahlt', `${right.status} / ${balanceB.open}`);

    // Capture bereits anderweitig gebucht (z.B. als Vorauszahlung im Checkout).
    const orderC = await makeOrder(customerHttp, 30);
    const invoiceC = await FinancialService.createInvoiceFromOrder(String(orderC._id));
    paypal.orders.set('PPO-C', ppOrder('PPO-C', invoiceC._id, 'CAP-PPO-C'));
    await Payment.create({
      customerId: customerHttp._id, amount: 30, paymentMethod: 'paypal', status: 'completed', source: 'checkout',
      metadata: { providerReference: 'CAP-PPO-C', providerDetails: { captureId: 'CAP-PPO-C' } },
    });
    const replay = await call('POST', `/api/invoices/${invoiceC._id}/payments/confirm`, { user: customerHttp, body: { gatewayProvider: 'paypal', gatewayId: 'gw-paypal', providerReference: 'PPO-C' } });
    const onC = await Payment.countDocuments({ invoiceId: invoiceC._id });
    check(replay.status === 409 && onC === 0, 'Bereits gebuchte Capture wird nicht ein zweites Mal gebucht', `${replay.status} ${replay.body?.error}`);

    // Stripe-Session einer anderen Rechnung.
    paypal.stripeSessions.set('cs_test_B', { id: 'cs_test_B', payment_status: 'paid', amount_total: 3000, currency: 'eur', client_reference_id: String(invoiceB._id), metadata: { invoiceId: String(invoiceB._id) } });
    const stripeWrong = await call('POST', `/api/invoices/${invoiceA._id}/payments/confirm`, { user: customerHttp, body: { gatewayProvider: 'stripe', gatewayId: 'gw-stripe', providerReference: 'cs_test_B' } });
    const onA2 = await Payment.countDocuments({ invoiceId: invoiceA._id });
    check(stripeWrong.status >= 400 && stripeWrong.status < 500 && onA2 === 0, 'Stripe-Session einer anderen Rechnung abgelehnt', `${stripeWrong.status} ${stripeWrong.body?.error}`);
  });

  // =====================================================================================
  await runSection('9 Admin-Route POST /api/admin/financial/payments/:id/refund + Abgleich (HTTP)', async () => {
    const admin = await User.create({ name: 'Admin HTTP', email: 'admin-pb@test.invalid', role: 'admin' });
    const customer = await makeCustomer();
    const { booking, orders } = await makeBooking(customer, [40]);
    const payment = await paypalPayment(booking, orders[0], 100, 'CAP-HTTP');
    paypal.mode = 'TIMEOUT_NOT_EXECUTED';
    const first = await call('POST', `/api/admin/financial/payments/${payment._id}/refund`, {
      user: admin, body: { amount: 30, reason: 'Kulanz', mode: 'gateway', gatewayProvider: 'paypal', idempotencyKey: 'http-dlg-1' },
    });
    check(first.status === 201 && first.body?.refund?.indeterminate === true && first.body?.refund?.status === 'pending', 'HTTP: unklar -> 201, ausstehend, indeterminate', `${first.status} / ${JSON.stringify(first.body?.refund)}`);
    check(/nicht eindeutig/.test(first.body?.message || '') && !RAW_CODE.test(first.body?.message || ''), 'HTTP: deutsche Meldung "nicht eindeutig"', first.body?.message);
    const again = await call('POST', `/api/admin/financial/payments/${payment._id}/refund`, {
      user: admin, body: { amount: 30, reason: 'Kulanz', mode: 'gateway', gatewayProvider: 'paypal', idempotencyKey: 'http-dlg-2' },
    });
    check(again.status === 409 && again.body?.code === 'REFUND_UNRESOLVED', 'HTTP: zweite Erstattung waehrend ungeklaert -> 409', `${again.status} ${again.body?.code}`);
    const stored = await Payment.findById(payment._id).lean();
    const rec = await call('POST', `/api/admin/financial/payments/${payment._id}/refunds/${stored.refunds[0]._id}/reconcile`, {
      user: admin, body: { resolution: 'executed', providerRefundId: 'PPREFUND0001' },
    });
    const after = await Payment.findById(payment._id).lean();
    check(rec.status === 200 && after.refundAmount === 30 && after.refunds[0].status === 'completed', 'HTTP-Abgleich "ausgefuehrt": 30 gebucht', `${rec.status} / ${after.refundAmount}`);
    const rejected = await call('POST', `/api/admin/financial/payments/${payment._id}/refunds/${stored.refunds[0]._id}/reconcile`, {
      user: admin, body: { resolution: 'not-executed' },
    });
    check(rejected.status === 409, 'HTTP: bereits abgeglichener Vorgang -> 409', rejected.status);

    const customerOnly = await call('POST', `/api/admin/financial/payments/${payment._id}/refund`, {
      user: customer, body: { amount: 1, reason: 'x', mode: 'manual' },
    });
    check(customerOnly.status === 403, 'Kunde darf nicht erstatten (403)', customerOnly.status);
  });

  out(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);

  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (error) => {
  out('ERROR:', error.stack || error.message);
  try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
  process.exit(2);
});
