/**
 * Regressionstest (Track order-residual): Restfehler an Auftrag, Altauftrag-Bearbeitung
 * und Reklamation.
 *
 * Abgesichert:
 *   A. Altauftrag, dessen gespeicherter Wert nicht zu den Positionen passt: der ECHTE
 *      Client (client/src/api/orderServices.ts, per TypeScript transpiliert) bekommt die
 *      409 ORDER_VALUE_NOT_RECONCILED MIT code und details, und die ausdrueckliche
 *      Bestaetigung (confirmRepricing) kommt ueber die echte Route bis in den Service -
 *      fuer Hinzufuegen, Aendern und Entfernen. Der Bestaetigungstext stimmt auch bei
 *      einer NEGATIVEN Differenz (Neuberechnung ERHOEHT den Wert).
 *   B. Reklamation "Angebot ablehnen" ist idempotent: Wiederholung und zwei parallele
 *      Anfragen erzeugen genau EINE Pauschalen-Position und genau EINE Rechnung; auch
 *      Annehmen und Ablehnen gleichzeitig ergeben einen einzigen, konsistenten Ausgang.
 *   C. Pauschale durch Personal: null / '' gelten als "nicht angegeben" (gespeicherte
 *      bzw. Standardpauschale, keine 0,00-€-Rechnung), negative Werte werden abgelehnt.
 *   D. Unerwartete Fehler der Reklamationsrouten erreichen die Oberflaeche deutsch (kein
 *      'E11000 duplicate key ...').
 *   E. Mitarbeiterzuweisung an eine Zusatzleistung schreibt konfliktsicher: entfernt ein
 *      paralleler Vorgang eine andere Zusatzleistung, landet die Zuweisung trotzdem an
 *      der richtigen Position (kein Schreiben ueber einen veralteten Array-Index).
 *   F. Auftragsdetail (OrderService.getById) laedt das Base64-Versandlabel nicht mehr
 *      standardmaessig; hasShippingLabel stimmt trotzdem, der Download bekommt es.
 *   G. Buchungsliste: kann der Zahlungsstand nicht berechnet werden, liefert der Server
 *      paymentBalance = null ("unbekannt") statt eines erfundenen 0,00-€-Saldos.
 *   H. Buchungsrechnung: faellt das Kundenprofil aus, gilt fuer das Zahlungsziel
 *      dieselbe Normalisierung (1-14 Tage) wie bei jedem anderen Rechnungsweg.
 *   I. GET /api/bookings/:id/invoices liefert je Beleg balance/paymentState; der Client
 *      (orders.ts getCustomerInvoicesForOrder) laedt dann NICHT zusaetzlich
 *      /api/invoices?limit=500.
 *   J. orders.ts reconcileOrderInboundShipment behaelt den Fehlercode und akzeptiert keine
 *      Abgleich-Adresse mit '..'-Segment; Rueckerstattungen einer Buchungsrechnung werden
 *      nicht jedem Auftrag der Buchung als eigener Betrag zugerechnet.
 *   K. Zusatzleistungen (client/src/api/adminOrders.ts, echter Client ueber die echte Route):
 *      409 ORDER_VALUE_NOT_RECONCILED kommt mit code/details an, die Bestaetigung
 *      (confirmRepricing + repricingBasis) erreicht den Service - Hinzufuegen, Aendern, Entfernen.
 *   L. Shop-Produkte (client/src/api/orders.ts): dasselbe fuer Hinzufuegen, Menge, Entfernen;
 *      die bestaetigte Neuberechnung steht in der Auftragshistorie.
 *   M. Geraetewechsel (adminOrders.ts changeDeviceAndRecalculateServices): dasselbe.
 *   N. Die Bestaetigung ist an die GEZEIGTE Abweichung gebunden: aendert sich der Auftrag
 *      zwischen 409 und Bestaetigung, kommt eine frische 409 (confirmationOutdated), nichts
 *      wird gespeichert; mit der neuen Abweichung bestaetigt klappt es.
 *   O. Reklamation ablehnen: scheitert die Pauschalenrechnung, erstellt eine Wiederholung sie
 *      kontrolliert nach - genau EINE Rechnung, auch bei parallelen Wiederholungen.
 *   P. Kundentexte der Reklamation: 'eröffnet' und '39,00 €' (deutsches Zahlenformat).
 *   Q. Buchungsrechnung: faellt auch das Standardprofil aus, wird die Rechnung trotzdem
 *      erstellt (Standardfrist), statt mit einem unbehandelten Fehler abzubrechen.
 *   R. POST /api/orders/:id/shipping/create-label akzeptiert das in der DHL-Integration
 *      konfigurierte Produkt (und prueft nur das Feld, das der Service verwendet).
 *   S. GET /api/orders/:id fuer KUNDEN: keine internen Abgleich-/Label-Verlaufseintraege,
 *      kein interner Abgleich-Statustext; Admin sieht alles.
 *   T. PUT /api/admin/orders/:id/addons/:addonId/assign antwortet deutsch (400/404).
 *
 * MOCKS: Benachrichtigungen, E-Mails, DHL und das Modul 'qrcode' (fehlt in
 * server/node_modules, nur fuer PDFs) sind gemockt - keine echte Kunden-E-Mail, kein
 * Label, kein PayPal/DHL/SMTP. Datei-Logs (server/logs) werden umgeleitet, damit der
 * Test keine Dateien im Repository hinterlaesst. JWT_SECRET nur fuer diesen Prozess.
 *
 * Aufruf (nur WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/order_residual node test-order-residual.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const Module = require('module');

const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, 'server');
const CLIENT_DIR = path.join(ROOT, 'client');
const API_DIR = process.env.FE_API_DIR ? path.resolve(process.env.FE_API_DIR) : path.join(CLIENT_DIR, 'src/api');
const LOG_DIR = path.join(SERVER_DIR, 'logs');

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_order_residual';

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

// ---- Keine Dateien im Repository: Logger-Schreibzugriffe auf server/logs umleiten ----
const LOG_REDIRECT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'order-residual-logs-'));
let redirectedLogWrites = 0;
const redirectLogPath = (target) => {
  const text = typeof target === 'string' ? target : '';
  if (text && path.resolve(text).startsWith(LOG_DIR + path.sep)) {
    redirectedLogWrites += 1;
    return path.join(LOG_REDIRECT_DIR, path.basename(text));
  }
  return target;
};
['appendFileSync', 'writeFileSync'].forEach((name) => {
  const original = fs[name];
  fs[name] = function redirected(target, ...rest) { return original.call(this, redirectLogPath(target), ...rest); };
});
['appendFile', 'writeFile'].forEach((name) => {
  const original = fs.promises[name];
  fs.promises[name] = function redirected(target, ...rest) { return original.call(this, redirectLogPath(target), ...rest); };
});

const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));
const ts = require(path.join(CLIENT_DIR, 'node_modules/typescript'));

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
const money = (value) => Number(Number(value || 0).toFixed(2));
const section = async (title, fn) => {
  console.log(`\n${title}`);
  try {
    await fn();
  } catch (error) {
    fail += 1;
    console.log(`  FAIL Abschnitt brach ab :: ${error && error.stack ? error.stack.split('\n').slice(0, 3).join(' | ') : error}`);
  }
};

// MOCK 'qrcode' (nur fuer PDF-Erzeugung benoetigt, fehlt in server/node_modules).
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, parent, ...rest) {
  if (request === 'qrcode') return 'qrcode-test-stub';
  return originalResolve.call(this, request, parent, ...rest);
};
require.cache['qrcode-test-stub'] = {
  id: 'qrcode-test-stub', filename: 'qrcode-test-stub', loaded: true,
  exports: { toDataURL: async () => 'data:image/png;base64,', toBuffer: async () => Buffer.from('') },
};

// --- Client-Module laden (TypeScript -> CommonJS), './api' = Test-Adapter ----------
// Fehlerform wie ApiError in client/src/api/api.ts (message, status, data, response).
const createApiStub = (state) => {
  const request = async (method, url, body, config = {}) => {
    state.requests.push(`${method} ${url}`);
    const response = await fetch(`${state.baseUrl}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.token}` },
      body: body !== undefined ? JSON.stringify(body) : (config.data !== undefined ? JSON.stringify(config.data) : undefined),
    });
    let data = {};
    try { data = await response.json(); } catch (error) { data = {}; }
    if (response.status >= 400) {
      const error = new Error(data?.error || data?.message || `Anfrage fehlgeschlagen (HTTP ${response.status})`);
      error.name = 'ApiError';
      error.status = response.status;
      error.data = data;
      error.response = { status: response.status, data };
      throw error;
    }
    return { status: response.status, data };
  };
  return {
    get: (url, config) => request('GET', url, undefined, config),
    post: (url, body, config) => request('POST', url, body === undefined ? {} : body, config),
    put: (url, body, config) => request('PUT', url, body === undefined ? {} : body, config),
    delete: (url, config) => request('DELETE', url, undefined, config),
  };
};

const loadClientModule = (fileName, apiStub, cache) => {
  if (cache[fileName]) return cache[fileName];
  const fullPath = path.isAbsolute(fileName) ? fileName : path.join(API_DIR, fileName);
  const source = fs.readFileSync(fullPath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: fullPath,
  });
  const moduleExports = {};
  const localRequire = (request) => {
    if (request === './api') return { __esModule: true, default: apiStub };
    if (request.startsWith('./')) return loadClientModule(`${request.slice(2)}.ts`, apiStub, cache);
    if (request.startsWith('@/')) return loadClientModule(path.join(CLIENT_DIR, 'src', `${request.slice(2)}.ts`), apiStub, cache);
    throw new Error(`Unerwarteter Import im Client-Modul: ${request}`);
  };
  cache[fileName] = moduleExports;
  // eslint-disable-next-line no-new-func
  new Function('exports', 'require', 'module', outputText)(moduleExports, localRequire, { exports: moduleExports });
  return moduleExports;
};

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }
  console.log(`Client-API aus: ${API_DIR}`);

  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  fs.readdirSync(path.join(SERVER_DIR, 'models')).filter((file) => file.endsWith('.js')).forEach((file) => {
    try { require(path.join(SERVER_DIR, 'models', file)); } catch (error) { /* optionale Abhaengigkeiten */ }
  });

  // ---- MOCKS: keine echten E-Mails / Benachrichtigungen / DHL-Labels ----
  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.sendOrderConfirmationEmail = async () => ({ success: true, mocked: true });
  EmailService.sendTriggerEmail = async () => ({ success: true, mocked: true });
  EmailService.sendEmail = async () => ({ success: true, mocked: true });
  EmailService.sendInvoiceEmail = async () => ({ success: true, mocked: true });
  EmailService.buildSystemUrl = async (p) => `http://test.invalid${p}`;
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  const notifications = [];
  NotificationService.createNotification = async (data) => {
    notifications.push(data);
    return { _id: new mongoose.Types.ObjectId(), ...data };
  };
  const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));
  DHLService.createShipment = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };
  const InspectionCommunicationService = require(path.join(SERVER_DIR, 'services/inspectionCommunicationService'));
  InspectionCommunicationService.updateRepairOfferStatus = async () => null;

  const OrderService = require(path.join(SERVER_DIR, 'services/orderService'));
  const FinancialService = require(path.join(SERVER_DIR, 'services/financialService'));
  const PaymentService = require(path.join(SERVER_DIR, 'services/paymentService'));
  const BookingService = require(path.join(SERVER_DIR, 'services/bookingService'));

  const app = express();
  app.use(express.json());
  app.use('/api/orders', require(path.join(SERVER_DIR, 'routes/orderRoutes')));
  app.use('/api/order-services', require(path.join(SERVER_DIR, 'routes/orderServiceRoutes')));
  app.use('/api/complaints', require(path.join(SERVER_DIR, 'routes/complaintRoutes')));
  app.use('/api/bookings', require(path.join(SERVER_DIR, 'routes/bookingRoutes')));
  app.use('/api/invoices', require(path.join(SERVER_DIR, 'routes/invoiceRoutes')));
  app.use('/api/admin/orders', require(path.join(SERVER_DIR, 'routes/adminOrderRoutes')));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const state = { baseUrl: `http://127.0.0.1:${server.address().port}`, token: '', requests: [] };
  const apiStub = createApiStub(state);
  const cache = {};
  const orderServicesApi = loadClientModule('orderServices.ts', apiStub, cache);
  const ordersApi = loadClientModule('orders.ts', apiStub, cache);
  const adminOrdersApi = loadClientModule('adminOrders.ts', apiStub, cache);

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Service = mongoose.model('Service');
  const Invoice = mongoose.model('Invoice');
  const Complaint = mongoose.model('Complaint');
  const Booking = mongoose.model('Booking');
  const OrderRevision = mongoose.model('OrderRevision');

  const readStored = async (id) =>
    mongoose.connection.db.collection('orders').findOne({ _id: new mongoose.Types.ObjectId(String(id)) });
  const readComplaint = async (id) =>
    mongoose.connection.db.collection('complaints').findOne({ _id: new mongoose.Types.ObjectId(String(id)) });

  const haendler = await User.create({ name: 'Haendler OR', email: 'or-haendler@test.invalid', role: 'customer', discount: 10 });
  const privat = await User.create({ name: 'Privat OR', email: 'or-privat@test.invalid', role: 'customer' });
  const staff = await User.create({ name: 'Sophie OR', email: 'or-staff@test.invalid', role: 'staff' });
  const staff2 = await User.create({ name: 'Tom OR', email: 'or-staff2@test.invalid', role: 'staff' });
  const admin = await User.create({ name: 'Admin OR', email: 'or-admin@test.invalid', role: 'admin' });
  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const actAs = (user) => { state.token = tokenFor(user); };
  const call = async (method, url, user, body) => {
    const response = await fetch(`${state.baseUrl}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(user)}` },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await response.json(); } catch (error) { json = null; }
    return { status: response.status, body: json };
  };

  const base = { category: 'display', deviceTypes: ['Smartphone'], manufacturerPrecise: 'Apple', modelPrecise: 'iPhone 15' };
  const display = await Service.create({ ...base, name: 'Displaytausch', price: 100, estimatedTime: '60' });
  const akku = await Service.create({ ...base, name: 'Akkutausch', price: 50, estimatedTime: '30' });
  const kamera = await Service.create({ ...base, name: 'Kameratausch', price: 70, estimatedTime: '45' });

  let legacySeq = 0;
  const insertLegacyOrder = async ({ customer, lines, totalCost, discount = 0, extra = {} }) => {
    legacySeq += 1;
    const inserted = await mongoose.connection.db.collection('orders').insertOne({
      orderNumber: `ORD-LEGACY-OR-${legacySeq}`,
      customerId: customer._id,
      deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
      services: lines.map((line) => ({
        _id: new mongoose.Types.ObjectId(), serviceId: line.service._id, name: line.service.name, price: line.price, estimatedTime: 30, notes: '',
      })),
      addOns: [], shopProducts: [],
      totalCost, discount, status: 'pending', createdAt: new Date('2025-05-01'),
      ...extra,
    });
    return String(inserted.insertedId);
  };
  const newDealerOrder = async () => OrderService.create({
    customerId: haendler._id, deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
    errorDescription: 'Test', services: [String(display._id)],
  });

  try {
    // =================================================================================
    await section('[A] Altauftrag: 409 mit code/details im Client, Bestaetigung ueber die echte Route', async () => {
      actAs(staff);
      check(typeof orderServicesApi.describeRepricingConsequence === 'function',
        'orderServices.ts exportiert describeRepricingConsequence', typeof orderServicesApi.describeRepricingConsequence);
      const describe = typeof orderServicesApi.describeRepricingConsequence === 'function'
        ? orderServicesApi.describeRepricingConsequence
        : () => '';

      // A1: NEGATIVE Differenz (gespeichert 80,00 < Positionen 100,00) - hinzufuegen
      const lowId = await insertLegacyOrder({ customer: privat, lines: [{ service: display, price: 100 }], totalCost: 80 });
      let lowError = null;
      try {
        await orderServicesApi.addRepairServiceFromForm(lowId, {
          serviceId: String(akku._id), isManual: false, price: 50, estimatedTime: 30, notes: '', reason: 'Zusatzschaden',
        });
      } catch (error) { lowError = error; }
      check(lowError && lowError.code === 'ORDER_VALUE_NOT_RECONCILED', 'Client-Fehler traegt code ORDER_VALUE_NOT_RECONCILED', lowError && `${lowError.code} / ${lowError.message}`);
      check(lowError && lowError.details && money(lowError.details.storedTotal) === 80 && money(lowError.details.difference) === -20,
        'Client-Fehler traegt details (gespeichert 80,00, Differenz -20,00)', lowError && JSON.stringify(lowError.details));
      check(lowError && /80,00/.test(lowError.message) && /bestätigen/.test(lowError.message), 'deutsche Servermeldung bleibt erhalten', lowError && lowError.message);
      const lowText = describe(lowError && lowError.details);
      check(/steigt/.test(lowText) && !/nicht übernommen/.test(lowText), 'Bestaetigungstext bei negativer Differenz: Wert steigt (nicht "nicht übernommen")', lowText);
      let stored = await readStored(lowId);
      check(stored.services.length === 1 && money(stored.totalCost) === 80, 'ohne Bestaetigung nichts gespeichert', `${stored.services.length} / ${stored.totalCost}`);

      let confirmed = null;
      try {
        confirmed = await orderServicesApi.addRepairServiceFromForm(lowId, {
          serviceId: String(akku._id), isManual: false, price: 50, estimatedTime: 30, notes: '', reason: 'Zusatzschaden', confirmRepricing: true,
        });
      } catch (error) { confirmed = { error }; }
      check(confirmed && !confirmed.error, 'Hinzufuegen MIT Bestaetigung ueber Client+Route erfolgreich', confirmed && confirmed.error ? `${confirmed.error.code} ${confirmed.error.message}` : 'ok');
      stored = await readStored(lowId);
      check(stored.services.length === 2 && money(stored.totalCost) === 150, 'nach Bestaetigung: 2 Positionen, Auftragswert 150,00', `${stored.services.length} / ${stored.totalCost}`);
      const lowRev = await OrderRevision.findOne({ orderId: lowId }).sort({ revisionNumber: -1 }).lean();
      check(lowRev && /Neuberechnung trotz Abweichung bestätigt/.test(lowRev.notes || '') && /Zusatzschaden/.test(lowRev.notes || ''),
        'Historie: Bestaetigung und Grund festgehalten', lowRev && lowRev.notes);

      // A2: POSITIVE Differenz (Sophies beschaedigter Auftrag: 150 Positionen, 10 Rabatt, 150 gespeichert) - aendern
      const damagedId = await insertLegacyOrder({
        customer: haendler, lines: [{ service: display, price: 100 }, { service: akku, price: 50 }], totalCost: 150, discount: 10,
      });
      const akkuLineId = String((await readStored(damagedId)).services[1]._id);
      let damagedError = null;
      try {
        await orderServicesApi.updateRepairServiceFromForm(damagedId, akkuLineId, {
          serviceId: String(akku._id), isManual: false, price: 60, estimatedTime: 30, notes: '', reason: 'Preis korrigiert',
        }, { isManualLine: false });
      } catch (error) { damagedError = error; }
      check(damagedError && damagedError.code === 'ORDER_VALUE_NOT_RECONCILED' && money(damagedError.details && damagedError.details.difference) === 10,
        'Aendern: 409 mit code und Differenz +10,00', damagedError && `${damagedError.code} ${JSON.stringify(damagedError.details)}`);
      const damagedText = describe(damagedError && damagedError.details);
      check(/sinkt/.test(damagedText), 'Bestaetigungstext bei positiver Differenz: Wert sinkt', damagedText);
      let updated = null;
      try {
        updated = await orderServicesApi.updateRepairServiceFromForm(damagedId, akkuLineId, {
          serviceId: String(akku._id), isManual: false, price: 60, estimatedTime: 30, notes: '', reason: 'Preis korrigiert', confirmRepricing: true,
        }, { isManualLine: false });
      } catch (error) { updated = { error }; }
      check(updated && !updated.error, 'Aendern MIT Bestaetigung erfolgreich', updated && updated.error ? `${updated.error.code} ${updated.error.message}` : 'ok');
      stored = await readStored(damagedId);
      check(money(stored.services[1].price) === 60 && money(stored.totalCost) === 150 && money(stored.discount) === 10,
        'nach Bestaetigung: Position 60,00, Auftragswert 160,00 - 10,00 = 150,00', `${stored.services[1].price} / ${stored.totalCost} / ${stored.discount}`);

      // A3: Entfernen
      const removeId = await insertLegacyOrder({
        customer: privat, lines: [{ service: display, price: 100 }, { service: kamera, price: 70 }], totalCost: 139,
      });
      const kameraLineId = String((await readStored(removeId)).services[1]._id);
      let removeError = null;
      try {
        await orderServicesApi.removeServiceFromOrder(removeId, kameraLineId, { reason: 'Kunde lehnt ab' });
      } catch (error) { removeError = error; }
      check(removeError && removeError.code === 'ORDER_VALUE_NOT_RECONCILED', 'Entfernen: 409 mit code', removeError && `${removeError.code} ${removeError.message}`);
      let removed = null;
      try {
        removed = await orderServicesApi.removeServiceFromOrder(removeId, kameraLineId, { reason: 'Kunde lehnt ab', confirmRepricing: true });
      } catch (error) { removed = { error }; }
      check(removed && !removed.error, 'Entfernen MIT Bestaetigung erfolgreich', removed && removed.error ? `${removed.error.code} ${removed.error.message}` : 'ok');
      stored = await readStored(removeId);
      check(stored.services.length === 1 && money(stored.totalCost) === 100, 'nach Bestaetigung: 1 Position, 100,00', `${stored.services.length} / ${stored.totalCost}`);

      // A4: rohe HTTP-Aufrufe (Vertrag der Route)
      const rawId = await insertLegacyOrder({ customer: privat, lines: [{ service: display, price: 100 }], totalCost: 80 });
      const raw409 = await call('POST', `/api/order-services/${rawId}`, staff, { serviceId: String(akku._id) });
      check(raw409.status === 409 && raw409.body?.code === 'ORDER_VALUE_NOT_RECONCILED' && raw409.body?.details && money(raw409.body.details.expectedTotal) === 100,
        'HTTP 409 enthaelt details (expectedTotal 100,00)', `${raw409.status} ${JSON.stringify(raw409.body)}`);
      const raw201 = await call('POST', `/api/order-services/${rawId}`, staff, { serviceId: String(akku._id), confirmRepricing: true });
      check(raw201.status === 201, 'HTTP POST mit confirmRepricing: 201', `${raw201.status} ${raw201.body?.error || ''}`);
      const rawLine = String((await readStored(rawId)).services[1]._id);
      await mongoose.connection.db.collection('orders').updateOne({ _id: new mongoose.Types.ObjectId(rawId) }, { $set: { totalCost: 120 } });
      const rawDelete = await call('DELETE', `/api/order-services/${rawId}/${rawLine}?confirmRepricing=true`, staff);
      check(rawDelete.status === 200, 'HTTP DELETE ?confirmRepricing=true: 200', `${rawDelete.status} ${rawDelete.body?.error || ''}`);
      const rawCustomer = await call('POST', `/api/order-services/${rawId}`, privat, { serviceId: String(akku._id), confirmRepricing: true });
      check(rawCustomer.status === 403, 'Kunde darf nicht bestaetigen (403)', rawCustomer.status);
    });

    // =================================================================================
    const makeComplaint = async ({ customer = haendler, withFollowUp = false, serviceFee, offerAmount = 80 } = {}) => {
      const original = await newDealerOrder();
      await Order.updateOne({ _id: original._id }, { $set: { status: 'completed' } });
      let followUpId;
      if (withFollowUp) {
        const followUp = await Order.create({
          customerId: customer._id, deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
          services: [{ serviceId: display._id, name: 'Displaytausch', price: 100, estimatedTime: 60 }],
          totalCost: 90, discount: 10, isComplaintFollowup: true, parentOrderId: original._id, status: 'pending',
        });
        followUpId = followUp._id;
      }
      const complaint = await Complaint.create({
        customerId: customer._id, orderId: original._id, ...(followUpId ? { newOrderId: followUpId } : {}),
        subject: 'Display flackert', description: 'Flackern', category: 'quality', status: 'denied',
        ...(serviceFee !== undefined ? { serviceFee } : {}),
        repairOffer: { amount: offerAmount, description: 'Neues Display', status: 'pending', createdAt: new Date() },
      });
      return { complaint, original };
    };
    const feeInvoicesFor = async (complaintId) => {
      const stored = await readComplaint(complaintId);
      const followUps = await Order.find({ sourceComplaintId: complaintId }).select('_id').lean();
      const ids = [...new Set([...followUps.map((o) => String(o._id)), stored?.newOrderId ? String(stored.newOrderId) : ''].filter(Boolean))];
      const invoices = await Invoice.find({ orderId: { $in: ids }, isCreditNote: { $ne: true } }).lean();
      return { stored, followUpIds: ids, invoices };
    };

    await section('[B] Reklamation ablehnen: Wiederholung und parallele Anfragen', async () => {
      // B1: ohne Reklamationsauftrag, zwei parallele Anfragen (Doppelklick)
      const { complaint: c1 } = await makeComplaint();
      const [r1, r2] = await Promise.all([
        call('POST', `/api/complaints/${c1._id}/reject-offer`, haendler, {}),
        call('POST', `/api/complaints/${c1._id}/reject-offer`, haendler, {}),
      ]);
      check([r1, r2].some((r) => r.status === 200), 'mindestens eine Anfrage erfolgreich', `${r1.status} / ${r2.status}`);
      check([r1, r2].every((r) => r.status === 200 || r.status === 409), 'die andere: 200 (bereits erledigt) oder 409', `${r1.status} ${r1.body?.error || ''} / ${r2.status} ${r2.body?.error || ''}`);
      check([r1, r2].every((r) => !/E11000|duplicate key/i.test(r.body?.error || '')), 'keine rohe Mongo-Meldung', `${r1.body?.error || '-'} / ${r2.body?.error || '-'}`);
      let fee = await feeInvoicesFor(c1._id);
      check(fee.followUpIds.length === 1, 'genau EIN Reklamationsauftrag angelegt', fee.followUpIds.join(','));
      check(fee.invoices.length === 1 && money(fee.invoices[0].total) === 39, 'genau EINE Pauschalenrechnung ueber 39,00', fee.invoices.map((i) => `${i.invoiceNumber}=${i.total}`).join(', '));
      const followUp1 = fee.followUpIds[0] ? await readStored(fee.followUpIds[0]) : null;
      const feeLines = (followUp1?.addOns || []).filter((a) => /Servicepauschale/.test(a.name));
      check(feeLines.length === 1 && money(followUp1.totalCost) === 39, 'genau EINE Pauschalen-Position, Auftragswert 39,00', `${feeLines.length} / ${followUp1 && followUp1.totalCost}`);
      check(fee.stored.status === 'awaiting_payment' && fee.stored.repairOffer?.status === 'rejected', 'Reklamation: awaiting_payment / Angebot abgelehnt', `${fee.stored.status} / ${fee.stored.repairOffer?.status}`);
      check((fee.stored.complaintLogs || []).filter((l) => l.action === 'offer_rejected').length === 1, 'genau EIN Protokolleintrag offer_rejected', (fee.stored.complaintLogs || []).map((l) => l.action).join(','));
      check(money(fee.stored.extraCosts) === 39, 'Mehrkosten nur einmal gebucht (39,00)', fee.stored.extraCosts);

      // B2: Wiederholung nach Abschluss
      const replay = await call('POST', `/api/complaints/${c1._id}/reject-offer`, haendler, {});
      check(replay.status === 200 && replay.body?.alreadyProcessed === true, 'Wiederholung: 200 mit alreadyProcessed', `${replay.status} ${replay.body?.error || ''} ${replay.body?.alreadyProcessed}`);
      check(replay.body?.invoice && String(replay.body.invoice._id) === String(fee.invoices[0]?._id), 'Wiederholung liefert die BESTEHENDE Rechnung', replay.body?.invoice && replay.body.invoice.invoiceNumber);
      fee = await feeInvoicesFor(c1._id);
      check(fee.invoices.length === 1, 'nach Wiederholung weiterhin genau EINE Rechnung', fee.invoices.length);

      // B3: mit bestehendem Reklamationsauftrag, drei parallele Anfragen
      const { complaint: c2 } = await makeComplaint({ withFollowUp: true });
      const results = await Promise.all([1, 2, 3].map(() => call('POST', `/api/complaints/${c2._id}/reject-offer`, haendler, {})));
      check(results.filter((r) => r.status === 200 && !r.body?.alreadyProcessed).length === 1, 'genau EINE Anfrage verarbeitet die Ablehnung', results.map((r) => `${r.status}${r.body?.alreadyProcessed ? '(replay)' : ''}`).join(' '));
      const fee2 = await feeInvoicesFor(c2._id);
      check(fee2.invoices.length === 1, 'parallel mit Reklamationsauftrag: genau EINE Rechnung', fee2.invoices.map((i) => i.invoiceNumber).join(', '));

      // B4: Annehmen und Ablehnen gleichzeitig
      const { complaint: c3 } = await makeComplaint({ withFollowUp: true });
      const [acc, rej] = await Promise.all([
        call('POST', `/api/complaints/${c3._id}/accept-offer`, haendler, {}),
        call('POST', `/api/complaints/${c3._id}/reject-offer`, haendler, {}),
      ]);
      const okCount = [acc, rej].filter((r) => r.status === 200).length;
      check(okCount === 1, 'Annehmen + Ablehnen parallel: genau eine Entscheidung gilt', `accept ${acc.status} ${acc.body?.error || ''} / reject ${rej.status} ${rej.body?.error || ''}`);
      const fee3 = await feeInvoicesFor(c3._id);
      const followUp3 = await readStored(fee3.followUpIds[0]);
      const consistent = fee3.stored.status === 'new_repair'
        ? fee3.invoices.length === 0 && money(followUp3.totalCost) === 80 && fee3.stored.repairOffer?.status === 'accepted'
        : fee3.stored.status === 'awaiting_payment' && fee3.invoices.length === 1 && money(followUp3.totalCost) === 39 && fee3.stored.repairOffer?.status === 'rejected';
      check(consistent, 'Ergebnis konsistent (Status, Angebot, Auftragswert, Rechnungen)', `${fee3.stored.status} / ${fee3.stored.repairOffer?.status} / ${followUp3.totalCost} / ${fee3.invoices.length} Rechnung(en)`);
    });

    // =================================================================================
    await section('[C] Pauschale durch Personal: null/\'\' = nicht angegeben, negativ abgelehnt', async () => {
      const { complaint: cNull } = await makeComplaint({ withFollowUp: true, serviceFee: 25 });
      const rNull = await call('POST', `/api/complaints/${cNull._id}/reject-offer`, staff, { serviceFee: null });
      check(rNull.status === 200 && money(rNull.body?.invoice?.total) === 25, 'serviceFee null -> gespeicherte Pauschale 25,00', `${rNull.status} ${rNull.body?.error || ''} ${rNull.body?.invoice?.total}`);

      const { complaint: cEmpty } = await makeComplaint({ withFollowUp: true });
      const rEmpty = await call('POST', `/api/complaints/${cEmpty._id}/reject-offer`, staff, { serviceFee: '' });
      check(rEmpty.status === 200 && money(rEmpty.body?.invoice?.total) === 39, "serviceFee '' -> Standardpauschale 39,00", `${rEmpty.status} ${rEmpty.body?.error || ''} ${rEmpty.body?.invoice?.total}`);

      const { complaint: cNeg } = await makeComplaint({ withFollowUp: true });
      const rNeg = await call('POST', `/api/complaints/${cNeg._id}/reject-offer`, staff, { serviceFee: -5 });
      check(rNeg.status === 400 && /pauschale/i.test(rNeg.body?.error || '') && rNeg.body?.code === 'INVALID_SERVICE_FEE', 'negative Pauschale: 400 mit deutscher Meldung', `${rNeg.status} ${rNeg.body?.error || ''}`);
      const negStored = await readComplaint(cNeg._id);
      const negInvoices = await Invoice.countDocuments({ orderId: negStored.newOrderId });
      check(negStored.status === 'denied' && negInvoices === 0, 'nichts geaendert (Status denied, keine Rechnung)', `${negStored.status} / ${negInvoices}`);

      const { complaint: cStaff } = await makeComplaint({ withFollowUp: true });
      const rStaff = await call('POST', `/api/complaints/${cStaff._id}/reject-offer`, staff, { serviceFee: 45 });
      check(rStaff.status === 200 && money(rStaff.body?.invoice?.total) === 45, 'Personal setzt 45,00 ausdruecklich', `${rStaff.status} ${rStaff.body?.invoice?.total}`);

      const { complaint: cCustomer } = await makeComplaint({ withFollowUp: true });
      const rCustomer = await call('POST', `/api/complaints/${cCustomer._id}/reject-offer`, haendler, { serviceFee: 0 });
      check(rCustomer.status === 200 && money(rCustomer.body?.invoice?.total) === 39, 'Kunde kann die Pauschale nicht setzen (39,00)', `${rCustomer.status} ${rCustomer.body?.invoice?.total}`);
    });

    // =================================================================================
    await section('[D] Unerwartete Fehler der Reklamationsrouten: deutsch', async () => {
      const { complaint } = await makeComplaint({ withFollowUp: true });
      const originalFindById = Complaint.findById;
      Complaint.findById = function failing() {
        throw new Error('E11000 duplicate key error collection: test.orders index: orderNumber_1 dup key');
      };
      let getRes;
      let rejectRes;
      let myRes;
      try {
        getRes = await call('GET', `/api/complaints/${complaint._id}`, haendler);
        rejectRes = await call('POST', `/api/complaints/${complaint._id}/reject-offer`, haendler, {});
      } finally {
        Complaint.findById = originalFindById;
      }
      const originalFind = Complaint.find;
      Complaint.find = function failing() { throw new Error('connection pool was cleared'); };
      try {
        myRes = await call('GET', '/api/complaints/my', haendler);
      } finally {
        Complaint.find = originalFind;
      }
      [['GET /:id', getRes], ['POST /:id/reject-offer', rejectRes], ['GET /my', myRes]].forEach(([label, res]) => {
        const message = res?.body?.error || '';
        check(res && res.status >= 400 && !/E11000|duplicate key|connection pool/i.test(message) && /Reklamation|Reparaturangebot/.test(message),
          `${label}: deutsche Meldung statt Rohfehler`, `${res && res.status} ${message}`);
      });
      const notFound = await call('GET', `/api/complaints/${new mongoose.Types.ObjectId()}`, admin);
      check(notFound.status === 404 && /Reklamation/.test(notFound.body?.error || ''), 'unbekannte Reklamation: 404 deutsch', `${notFound.status} ${notFound.body?.error}`);
    });

    // =================================================================================
    await section('[E] Mitarbeiterzuweisung an Zusatzleistung bei parallelem Entfernen', async () => {
      const order = await newDealerOrder();
      const orderId = String(order._id);
      await OrderService.addAddonToOrder(orderId, { name: 'Expressbearbeitung', price: 30 }, staff._id);
      await OrderService.addAddonToOrder(orderId, { name: 'Datensicherung', price: 20 }, staff._id);
      const before = await readStored(orderId);
      const addonA = before.addOns.find((a) => a.name === 'Expressbearbeitung');
      const addonB = before.addOns.find((a) => a.name === 'Datensicherung');

      const originalSave = Order.prototype.save;
      let injected = false;
      let inside = false;
      Order.prototype.save = async function hookedSave(...args) {
        if (!injected && !inside && String(this._id) === orderId) {
          injected = true;
          inside = true;
          try {
            // Ein anderer Vorgang entfernt ZWISCHEN Laden und Speichern die erste Zusatzleistung.
            await OrderService.removeAddonFromOrder(orderId, String(addonA._id), staff2._id);
          } finally {
            inside = false;
          }
        }
        return originalSave.apply(this, args);
      };
      let assignError = null;
      try {
        await OrderService.assignStaffToAddon(orderId, String(addonB._id), String(staff2._id), staff._id);
      } catch (error) {
        assignError = error;
      } finally {
        Order.prototype.save = originalSave;
      }
      check(injected, 'paralleles Entfernen wurde zwischen Laden und Speichern ausgefuehrt', injected);
      check(!assignError, 'Zuweisung erfolgreich', assignError && assignError.message);
      const after = await readStored(orderId);
      const names = (after.addOns || []).map((a) => a.name || '(ohne Name)');
      check(after.addOns.length === 1 && after.addOns[0].name === 'Datensicherung', 'nur noch "Datensicherung", keine Geisterposition', names.join(', '));
      // Konfliktsicherheit: der wiederholte Durchlauf trifft die richtige Zusatzleistung (per
      // _id auf dem frischen Stand) - sichtbar am Verlaufseintrag, und genau EIN Eintrag.
      const assignEntries = (after.timeline || []).filter((entry) => entry.status === 'Add-on Staff Assigned');
      check(assignEntries.length === 1 && /Tom OR/.test(assignEntries[0].description || '') && /Datensicherung/.test(assignEntries[0].description || ''),
        'Verlauf: genau EINE Zuweisung, an "Datensicherung"', assignEntries.map((entry) => entry.description).join(' | '));
      // Dauerhafte Speicherung der Zuweisung an der Zusatzleistung (addOnServiceSchema.assignedStaff
      // in server/models/Order.js; frueher verwarf der strikte Schema-Modus das Feld still).
      const assigned = (after.addOns[0]?.assignedStaff || []).map((s) => String(s.staffId));
      check(assigned.includes(String(staff2._id)), 'Mitarbeiter an der RICHTIGEN Zusatzleistung gespeichert', JSON.stringify(after.addOns.map((a) => [a.name, (a.assignedStaff || []).length])));
      // 100 + 20 = 120 -> 10 % -> 108
      check(money(after.totalCost) === 108, 'Auftragswert nach Entfernen 108,00', after.totalCost);
    });

    // =================================================================================
    await section('[F] Auftragsdetail ohne Base64-Versandlabel', async () => {
      const order = await newDealerOrder();
      await Order.updateOne({ _id: order._id }, { $set: { shippingLabelUrl: 'data:application/pdf;base64,QUFBQUFBQUFBQUFB', trackingNumber: 'OUT-OR-1' } });
      const detail = await OrderService.getById(String(order._id));
      check(detail.shippingLabelUrl === undefined, 'getById (Standard) projiziert shippingLabelUrl nicht', String(detail.shippingLabelUrl).slice(0, 30));
      check(detail.hasShippingLabel === true, 'hasShippingLabel weiterhin true', detail.hasShippingLabel);
      const withLabel = await OrderService.getById(String(order._id), { includeLabelData: true });
      check(/^data:application\/pdf;base64,/.test(withLabel.shippingLabelUrl || ''), 'includeLabelData liefert das Label', (withLabel.shippingLabelUrl || '').slice(0, 30));
      const noLabel = await OrderService.getById(String((await newDealerOrder())._id));
      check(noLabel.hasShippingLabel === false, 'ohne Label: hasShippingLabel false', noLabel.hasShippingLabel);
    });

    // =================================================================================
    const makeBooking = async (customer, price = 50) => {
      const bookedOrder = await Order.create({
        customerId: customer._id, deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone', errorDescription: 'Display',
        services: [{ serviceId: display._id, name: 'Displaytausch', price, estimatedTime: 30 }],
        totalCost: price, discount: 0, status: 'completed',
      });
      const booking = await Booking.create({
        customerId: customer._id, orderIds: [bookedOrder._id],
        items: [{ type: 'repair', orderId: bookedOrder._id, orderNumber: bookedOrder.orderNumber, cost: price, device: 'Apple iPhone 15' }],
        totalCost: price, status: 'processing',
      });
      await Order.updateOne({ _id: bookedOrder._id }, { $set: { bookingId: booking._id } });
      return { booking, order: bookedOrder };
    };

    await section('[G] Buchungsliste: Zahlungsstand unbekannt -> null statt 0,00', async () => {
      const bookingCustomer = await User.create({ name: 'Buchung OR', email: 'or-booking@test.invalid', role: 'customer' });
      const { booking } = await makeBooking(bookingCustomer, 50);
      const originalBulk = PaymentService.getBookingBalancesBulk;
      PaymentService.getBookingBalancesBulk = async () => { throw new Error('Simulierter Ausfall der Saldenberechnung'); };
      let adminList;
      let customerList;
      try {
        adminList = await BookingService.getAllBookings({});
        customerList = await BookingService.getByCustomer(String(bookingCustomer._id), {});
      } finally {
        PaymentService.getBookingBalancesBulk = originalBulk;
      }
      const pick = (result) => {
        const list = Array.isArray(result) ? result : (result?.bookings || []);
        return list.find((entry) => String(entry._id) === String(booking._id));
      };
      const adminEntry = pick(adminList);
      const customerEntry = pick(customerList);
      check(adminEntry && adminEntry.paymentBalance === null, 'Adminliste: paymentBalance null bei Ausfall', adminEntry && JSON.stringify(adminEntry.paymentBalance));
      check(customerEntry && customerEntry.paymentBalance === null, 'Kundenliste: paymentBalance null bei Ausfall', customerEntry && JSON.stringify(customerEntry.paymentBalance));
      const okList = await BookingService.getAllBookings({});
      const okEntry = pick(okList);
      check(okEntry && okEntry.paymentBalance && money(okEntry.paymentBalance.open) === 50, 'ohne Ausfall: Saldo vorhanden (offen 50,00)', okEntry && JSON.stringify(okEntry.paymentBalance));
    });

    // =================================================================================
    await section('[H] Buchungsrechnung: Zahlungsziel bei Profilausfall normalisiert', async () => {
      const configCollection = mongoose.model('SystemConfiguration').collection.name;
      await mongoose.connection.db.collection(configCollection).deleteMany({});
      await mongoose.connection.db.collection(configCollection).insertOne({ financialSettings: { defaults: { paymentDueDays: 30 } } });
      const settings = await FinancialService.getFinancialSettings();
      check(Number(settings.defaults.paymentDueDays) === 30, 'Einstellung: Standardfrist 30 Tage gespeichert', settings.defaults.paymentDueDays);

      const normalCustomer = await User.create({ name: 'Frist OR', email: 'or-frist@test.invalid', role: 'customer' });
      const { booking: normalBooking } = await makeBooking(normalCustomer, 40);
      const normalInvoice = await BookingService.createInvoice(String(normalBooking._id), {});

      const fallbackCustomer = await User.create({ name: 'Frist2 OR', email: 'or-frist2@test.invalid', role: 'customer' });
      const { booking: fallbackBooking } = await makeBooking(fallbackCustomer, 40);
      const originalResolveProfile = FinancialService.resolveFinancialProfile;
      FinancialService.resolveFinancialProfile = async function failingProfile(args = {}) {
        if (args && args.customerId) throw new Error('Simulierter Profilfehler');
        return originalResolveProfile.call(this, args);
      };
      let fallbackInvoice;
      try {
        fallbackInvoice = await BookingService.createInvoice(String(fallbackBooking._id), {});
      } finally {
        FinancialService.resolveFinancialProfile = originalResolveProfile;
      }
      check(normalInvoice.paymentDueDays === 14, 'normaler Weg: 30 Tage -> normalisiert 14', normalInvoice.paymentDueDays);
      check(fallbackInvoice && fallbackInvoice.paymentDueDays === normalInvoice.paymentDueDays,
        'Ausfallweg: dieselbe Frist wie der normale Weg (nicht roh 30, nicht fest 14 ohne Normalisierung)', fallbackInvoice && `${fallbackInvoice.paymentDueDays} / ${fallbackInvoice.paymentTerms}`);
      await mongoose.connection.db.collection(configCollection).deleteMany({});
    });

    // =================================================================================
    await section('[I] Buchungsbelege mit Zahlungsstand, kein Nachladen von /api/invoices?limit=500', async () => {
      const invoiceCustomer = await User.create({ name: 'Beleg OR', email: 'or-beleg@test.invalid', role: 'customer' });
      const { booking, order } = await makeBooking(invoiceCustomer, 60);
      await BookingService.createInvoice(String(booking._id), {});
      const serviceList = await BookingService.getBookingInvoices(String(booking._id));
      check(serviceList.length === 1 && serviceList[0].balance && money(serviceList[0].balance.open) === 60 && serviceList[0].paymentState === 'open',
        'getBookingInvoices: balance (offen 60,00) und paymentState', serviceList[0] && JSON.stringify({ balance: serviceList[0].balance, paymentState: serviceList[0].paymentState }));
      actAs(invoiceCustomer);
      state.requests = [];
      const invoices = await ordersApi.getCustomerInvoicesForOrder(String(order._id), String(booking._id));
      check(invoices.length === 1 && invoices[0].balance && money(invoices[0].balance.open) === 60, 'Client: Beleg mit Saldo', invoices[0] && JSON.stringify(invoices[0].balance));
      check(!state.requests.some((entry) => /\/api\/invoices\?limit=500/.test(entry)), 'Client: kein zusaetzliches /api/invoices?limit=500', state.requests.join(' | '));
    });

    // =================================================================================
    await section('[J] orders.ts: Abgleich-Fehlercode, Adresspruefung, Rueckerstattung je Auftrag', async () => {
      const captured = [];
      const failingStub = {
        get: async () => ({ data: {} }), put: async () => ({ data: {} }), delete: async () => ({ data: {} }),
        post: async (url) => {
          captured.push(url);
          const error = new Error('Für die Einsendung dieses Auftrags ist kein Abgleich offen.');
          error.status = 409;
          error.response = { status: 409, data: { error: 'Für die Einsendung dieses Auftrags ist kein Abgleich offen.', code: 'NO_RECONCILIATION_PENDING' } };
          throw error;
        },
      };
      const isolatedOrders = loadClientModule('orders.ts', failingStub, {});
      const orderId = String(new mongoose.Types.ObjectId());
      let reconcileError = null;
      try {
        await isolatedOrders.reconcileOrderInboundShipment(orderId, { resolution: 'not-created' }, `/api/orders/${orderId}/../../admin/users`);
      } catch (error) { reconcileError = error; }
      check(reconcileError && reconcileError.code === 'NO_RECONCILIATION_PENDING', 'Fehlercode bleibt erhalten', reconcileError && `${reconcileError.code} ${reconcileError.message}`);
      check(captured[0] === `/api/orders/${orderId}/return-label/reconcile`, "Adresse mit '..' wird nicht verwendet", captured[0]);

      check(typeof ordersApi.splitRefundPendingByScope === 'function', 'orders.ts exportiert splitRefundPendingByScope', typeof ordersApi.splitRefundPendingByScope);
      if (typeof ordersApi.splitRefundPendingByScope === 'function') {
        const otherOrder = String(new mongoose.Types.ObjectId());
        const balance = (refundPending) => ({ open: 0, received: 100, refundPending, overpaid: refundPending });
        const split = ordersApi.splitRefundPendingByScope([
          { _id: 'a', invoiceNumber: 'INV-2026-0001', orderId, repairOrderIds: [orderId, otherOrder], balance: balance(15), paymentState: 'overpaid' },
          { _id: 'b', invoiceNumber: 'INV-2026-0002', orderId, repairOrderIds: [orderId], balance: balance(5), paymentState: 'overpaid' },
          { _id: 'c', invoiceNumber: 'INV-2026-0003', orderId: otherOrder, balance: balance(7), paymentState: 'overpaid' },
        ], orderId);
        check(money(split.orderAmount) === 5, 'eigener Betrag des Auftrags: nur Einzelrechnung (5,00)', JSON.stringify(split));
        check(split.bookingLevel.length === 1 && split.bookingLevel[0].invoiceNumber === 'INV-2026-0001' && money(split.bookingLevel[0].amount) === 15,
          'Buchungsrechnung separat ausgewiesen (INV-2026-0001, 15,00)', JSON.stringify(split.bookingLevel));
      }
    });

    // =================================================================================
    // Hilfen fuer K-N: nicht aufgehender Altauftrag, Bestaetigung wie in der Oberflaeche
    // (details der 409 zurueckschicken).
    const setStoredTotal = async (id, totalCost) =>
      mongoose.connection.db.collection('orders').updateOne({ _id: new mongoose.Types.ObjectId(String(id)) }, { $set: { totalCost } });
    const confirmationFrom = (error) => {
      const details = error && error.details;
      return details
        ? { confirmRepricing: true, repricingBasis: { storedTotal: details.storedTotal, expectedTotal: details.expectedTotal } }
        : { confirmRepricing: true };
    };
    const expectReconcileError = async (label, fn) => {
      let caught = null;
      try { await fn(); } catch (error) { caught = error; }
      check(caught && caught.code === 'ORDER_VALUE_NOT_RECONCILED' && caught.details && Number.isFinite(Number(caught.details.storedTotal)),
        `${label}: Client-Fehler mit code ORDER_VALUE_NOT_RECONCILED und details`, caught ? `${caught.code} ${JSON.stringify(caught.details)} ${caught.message}` : 'kein Fehler');
      return caught;
    };
    const expectSuccess = async (label, fn) => {
      let result = null;
      try { result = await fn(); } catch (error) { result = { error }; }
      check(result && !result.error, `${label}: MIT Bestaetigung erfolgreich`, result && result.error ? `${result.error.code} ${result.error.message}` : 'ok');
      return result;
    };

    await section('[K] Zusatzleistungen: 409 mit code/details im Client, Bestaetigung ueber die echte Route', async () => {
      actAs(staff);
      const orderId = await insertLegacyOrder({ customer: privat, lines: [{ service: display, price: 100 }], totalCost: 80 });
      const addError = await expectReconcileError('Hinzufuegen', () => adminOrdersApi.addAddonToOrder(orderId, { name: 'Expressbearbeitung', price: 30 }));
      let stored = await readStored(orderId);
      check((stored.addOns || []).length === 0 && money(stored.totalCost) === 80, 'ohne Bestaetigung nichts gespeichert', `${(stored.addOns || []).length} / ${stored.totalCost}`);
      await expectSuccess('Hinzufuegen', () => adminOrdersApi.addAddonToOrder(orderId, { name: 'Expressbearbeitung', price: 30 }, confirmationFrom(addError)));
      stored = await readStored(orderId);
      check(stored.addOns.length === 1 && money(stored.totalCost) === 130, 'Zusatzleistung gespeichert, Auftragswert 100 + 30 = 130,00', `${stored.addOns.length} / ${stored.totalCost}`);
      const addonId = String(stored.addOns[0]._id);

      await setStoredTotal(orderId, 200);
      const updError = await expectReconcileError('Aendern', () => adminOrdersApi.updateOrderAddon(orderId, addonId, { price: 40 }));
      await expectSuccess('Aendern', () => adminOrdersApi.updateOrderAddon(orderId, addonId, { price: 40 }, confirmationFrom(updError)));
      stored = await readStored(orderId);
      check(money(stored.addOns[0].price) === 40 && money(stored.totalCost) === 140, 'Preis 40,00, Auftragswert 140,00', `${stored.addOns[0].price} / ${stored.totalCost}`);

      await setStoredTotal(orderId, 10);
      const delError = await expectReconcileError('Entfernen', () => adminOrdersApi.removeAddonFromOrder(orderId, addonId));
      check(delError && money(delError.details && delError.details.difference) === -130, 'Entfernen: negative Differenz -130,00 in details', delError && JSON.stringify(delError.details));
      await expectSuccess('Entfernen', () => adminOrdersApi.removeAddonFromOrder(orderId, addonId, confirmationFrom(delError)));
      stored = await readStored(orderId);
      check(stored.addOns.length === 0 && money(stored.totalCost) === 100, 'entfernt, Auftragswert 100,00', `${stored.addOns.length} / ${stored.totalCost}`);
    });

    // =================================================================================
    await section('[L] Shop-Produkte: 409 mit code/details im Client, Bestaetigung, Historie', async () => {
      actAs(staff);
      const Product = mongoose.model('Product');
      const product = await Product.create({
        name: 'Panzerglas OR', description: 'Schutzglas', price: 20, images: ['panzerglas.png'],
        category: 'Screen Protectors', brand: 'Test', stockCount: 10, sku: `OR-PG-${Date.now()}`,
      });
      const orderId = await insertLegacyOrder({ customer: privat, lines: [{ service: display, price: 100 }], totalCost: 80 });
      const addError = await expectReconcileError('Hinzufuegen', () => ordersApi.addShopProductToOrder(orderId, String(product._id), 1));
      let stored = await readStored(orderId);
      check((stored.shopProducts || []).length === 0 && money(stored.totalCost) === 80, 'ohne Bestaetigung nichts gespeichert', `${(stored.shopProducts || []).length} / ${stored.totalCost}`);
      await expectSuccess('Hinzufuegen', () => ordersApi.addShopProductToOrder(orderId, String(product._id), 1, confirmationFrom(addError)));
      stored = await readStored(orderId);
      check(stored.shopProducts.length === 1 && money(stored.totalCost) === 120, 'Produkt gespeichert, Auftragswert 120,00', `${stored.shopProducts.length} / ${stored.totalCost}`);
      const itemId = String(stored.shopProducts[0]._id);
      const addRev = await OrderRevision.findOne({ orderId }).sort({ revisionNumber: -1 }).lean();
      check(addRev && /Neuberechnung trotz Abweichung bestätigt/.test(addRev.notes || ''), 'Historie: bestaetigte Neuberechnung festgehalten', addRev && addRev.notes);

      await setStoredTotal(orderId, 150);
      const qtyError = await expectReconcileError('Menge', () => ordersApi.updateShopProductQuantity(orderId, itemId, 2));
      await expectSuccess('Menge', () => ordersApi.updateShopProductQuantity(orderId, itemId, 2, confirmationFrom(qtyError)));
      stored = await readStored(orderId);
      check(stored.shopProducts[0].quantity === 2 && money(stored.totalCost) === 140, 'Menge 2, Auftragswert 140,00', `${stored.shopProducts[0].quantity} / ${stored.totalCost}`);

      await setStoredTotal(orderId, 99);
      const delError = await expectReconcileError('Entfernen', () => ordersApi.removeShopProductFromOrder(orderId, itemId));
      await expectSuccess('Entfernen', () => ordersApi.removeShopProductFromOrder(orderId, itemId, confirmationFrom(delError)));
      stored = await readStored(orderId);
      check(stored.shopProducts.length === 0 && money(stored.totalCost) === 100, 'entfernt, Auftragswert 100,00', `${stored.shopProducts.length} / ${stored.totalCost}`);
    });

    // =================================================================================
    await section('[M] Geraetewechsel: 409 mit code/details im Client, Bestaetigung', async () => {
      actAs(staff);
      const display14 = await Service.create({ ...base, name: 'Displaytausch 14 OR', price: 90, estimatedTime: '60', modelPrecise: 'iPhone 14' });
      const orderId = await insertLegacyOrder({ customer: privat, lines: [{ service: display, price: 100 }], totalCost: 80 });
      const lineId = String((await readStored(orderId)).services[0]._id);
      const options = { serviceReplacements: [{ oldOrderServiceId: lineId, newServiceId: String(display14._id) }] };
      const changeError = await expectReconcileError('Geraetewechsel', () =>
        adminOrdersApi.changeDeviceAndRecalculateServices(orderId, 'Apple', 'iPhone 14', 'Smartphone', options));
      let stored = await readStored(orderId);
      check(stored.deviceModel === 'iPhone 15' && money(stored.totalCost) === 80, 'ohne Bestaetigung nichts gespeichert', `${stored.deviceModel} / ${stored.totalCost}`);
      await expectSuccess('Geraetewechsel', () =>
        adminOrdersApi.changeDeviceAndRecalculateServices(orderId, 'Apple', 'iPhone 14', 'Smartphone', { ...options, ...confirmationFrom(changeError) }));
      stored = await readStored(orderId);
      check(stored.deviceModel === 'iPhone 14' && money(stored.totalCost) === 90, 'Geraet iPhone 14, Auftragswert 90,00', `${stored.deviceModel} / ${stored.totalCost}`);
    });

    // =================================================================================
    await section('[N] Bestaetigung an die gezeigte Abweichung gebunden', async () => {
      const orderId = await insertLegacyOrder({ customer: privat, lines: [{ service: display, price: 100 }], totalCost: 80 });
      const first = await call('POST', `/api/admin/orders/${orderId}/addons`, staff, { name: 'Datensicherung', price: 25 });
      check(first.status === 409 && first.body?.code === 'ORDER_VALUE_NOT_RECONCILED' && money(first.body?.details?.storedTotal) === 80,
        'erste Anfrage: 409 mit gespeichertem Wert 80,00', `${first.status} ${JSON.stringify(first.body?.details)}`);
      // Ein anderer Vorgang aendert den gespeicherten Wert, BEVOR der Nutzer bestaetigt.
      await setStoredTotal(orderId, 60);
      const stale = await call('POST', `/api/admin/orders/${orderId}/addons`, staff, {
        name: 'Datensicherung', price: 25, confirmRepricing: true,
        repricingBasis: { storedTotal: first.body?.details?.storedTotal, expectedTotal: first.body?.details?.expectedTotal },
      });
      check(stale.status === 409 && stale.body?.code === 'ORDER_VALUE_NOT_RECONCILED' && stale.body?.details?.confirmationOutdated === true,
        'veraltete Bestaetigung: frische 409 mit confirmationOutdated', `${stale.status} ${stale.body?.error || ''} ${JSON.stringify(stale.body?.details)}`);
      check(stale.body && money(stale.body.details?.storedTotal) === 60 && /geändert/.test(stale.body.error || ''),
        'frische 409 zeigt die NEUE Abweichung (60,00) mit deutscher Meldung', stale.body && `${stale.body.error}`);
      let stored = await readStored(orderId);
      check((stored.addOns || []).length === 0 && money(stored.totalCost) === 60, 'veraltete Bestaetigung: nichts gespeichert', `${(stored.addOns || []).length} / ${stored.totalCost}`);
      const fresh = await call('POST', `/api/admin/orders/${orderId}/addons`, staff, {
        name: 'Datensicherung', price: 25, confirmRepricing: true,
        repricingBasis: { storedTotal: stale.body?.details?.storedTotal, expectedTotal: stale.body?.details?.expectedTotal },
      });
      check(fresh.status === 200, 'Bestaetigung der NEUEN Abweichung: 200', `${fresh.status} ${fresh.body?.error || ''}`);
      stored = await readStored(orderId);
      check(stored.addOns.length === 1 && money(stored.totalCost) === 125, 'gespeichert, Auftragswert 125,00', `${stored.addOns.length} / ${stored.totalCost}`);

      // Geraetewechsel und Shop-Produkt nutzen dieselbe Pruefung (Service-Ebene).
      const legacyId = await insertLegacyOrder({ customer: privat, lines: [{ service: display, price: 100 }], totalCost: 80 });
      let conditionError = null;
      try {
        OrderService.getPricingConditionsForEdit(await Order.findById(legacyId), { confirmRepricing: true, repricingBasis: { storedTotal: 70, expectedTotal: 100 } });
      } catch (error) { conditionError = error; }
      check(conditionError && conditionError.code === 'ORDER_VALUE_NOT_RECONCILED' && conditionError.details?.confirmationOutdated === true,
        'getPricingConditionsForEdit: abweichende Grundlage -> 409 confirmationOutdated', conditionError && `${conditionError.code} ${JSON.stringify(conditionError.details)}`);
      let okCondition = null;
      try {
        okCondition = OrderService.getPricingConditionsForEdit(await Order.findById(legacyId), { confirmRepricing: true, repricingBasis: { storedTotal: 80, expectedTotal: 100 } });
      } catch (error) { okCondition = { error }; }
      check(okCondition && !okCondition.error && okCondition.repricingConfirmed === true, 'passende Grundlage: Bestaetigung gilt', okCondition && okCondition.error ? okCondition.error.message : 'ok');
      let brokenBasis = null;
      try {
        OrderService.getPricingConditionsForEdit(await Order.findById(legacyId), { confirmRepricing: true, repricingBasis: { storedTotal: 'abc' } });
      } catch (error) { brokenBasis = error; }
      check(brokenBasis && brokenBasis.code === 'ORDER_VALUE_NOT_RECONCILED', 'unlesbare Grundlage gilt nicht als Bestaetigung', brokenBasis && brokenBasis.code);
    });

    // =================================================================================
    await section('[O] Reklamation ablehnen: fehlgeschlagene Pauschalenrechnung wird kontrolliert nachgeholt', async () => {
      const originalCreateInvoice = FinancialService.createInvoice;
      const failOnce = async () => {
        FinancialService.createInvoice = async function failing() {
          FinancialService.createInvoice = originalCreateInvoice;
          throw new Error('Simulierter Ausfall der Rechnungserstellung');
        };
      };
      try {
        const { complaint } = await makeComplaint({ withFollowUp: true });
        await failOnce();
        const first = await call('POST', `/api/complaints/${complaint._id}/reject-offer`, haendler, {});
        check(first.status === 200 && first.body?.invoice === null && (first.body?.warnings || []).length > 0,
          'erster Lauf: Ablehnung gespeichert, Rechnung fehlgeschlagen (Warnung)', `${first.status} ${JSON.stringify(first.body?.warnings)}`);
        let fee = await feeInvoicesFor(complaint._id);
        check(fee.invoices.length === 0, 'nach dem Ausfall: noch keine Rechnung', fee.invoices.length);

        const replay = await call('POST', `/api/complaints/${complaint._id}/reject-offer`, haendler, {});
        check(replay.status === 200 && replay.body?.alreadyProcessed === true && replay.body?.invoice && money(replay.body.invoice.total) === 39,
          'Wiederholung erstellt die fehlende Rechnung (39,00)', `${replay.status} ${replay.body?.invoice?.invoiceNumber || 'keine'} ${JSON.stringify(replay.body?.warnings)}`);
        fee = await feeInvoicesFor(complaint._id);
        check(fee.invoices.length === 1 && money(fee.invoices[0].total) === 39 && money(fee.invoices[0].discount || 0) === 0,
          'genau EINE Pauschalenrechnung 39,00 ohne Rabatt', fee.invoices.map((i) => `${i.invoiceNumber}=${i.total}`).join(', '));
        const again = await call('POST', `/api/complaints/${complaint._id}/reject-offer`, haendler, {});
        fee = await feeInvoicesFor(complaint._id);
        check(again.status === 200 && fee.invoices.length === 1 && String(again.body?.invoice?._id) === String(fee.invoices[0]._id),
          'weitere Wiederholung: dieselbe Rechnung, keine zweite', `${again.status} ${fee.invoices.length}`);
        check(money(fee.stored.extraCosts) === 39, 'Mehrkosten weiterhin nur einmal (39,00)', fee.stored.extraCosts);
        check((fee.stored.complaintLogs || []).some((l) => l.action === 'fee_invoice_created'), 'Protokoll: nachgeholte Rechnung festgehalten', (fee.stored.complaintLogs || []).map((l) => l.action).join(','));

        // parallele Wiederholungen nach einem Ausfall
        const { complaint: c2 } = await makeComplaint({ withFollowUp: true });
        await failOnce();
        await call('POST', `/api/complaints/${c2._id}/reject-offer`, haendler, {});
        const parallel = await Promise.all([1, 2, 3].map(() => call('POST', `/api/complaints/${c2._id}/reject-offer`, haendler, {})));
        const fee2 = await feeInvoicesFor(c2._id);
        check(parallel.every((r) => r.status === 200), 'parallele Wiederholungen: alle 200', parallel.map((r) => `${r.status} ${r.body?.error || ''}`).join(' | '));
        check(fee2.invoices.length === 1, 'parallele Wiederholungen: genau EINE Rechnung', fee2.invoices.map((i) => i.invoiceNumber).join(', '));

        // scheitert auch der Nachholversuch: Warnung, keine Rechnung, spaeter erneut moeglich
        const { complaint: c3 } = await makeComplaint({ withFollowUp: true });
        await failOnce();
        await call('POST', `/api/complaints/${c3._id}/reject-offer`, haendler, {});
        await failOnce();
        const failedRetry = await call('POST', `/api/complaints/${c3._id}/reject-offer`, haendler, {});
        check(failedRetry.status === 200 && failedRetry.body?.invoice === null && (failedRetry.body?.warnings || []).some((w) => /Rechnung/.test(w)),
          'gescheiterter Nachholversuch: Warnung statt Rechnung', `${failedRetry.status} ${JSON.stringify(failedRetry.body?.warnings)}`);
        const laterRetry = await call('POST', `/api/complaints/${c3._id}/reject-offer`, haendler, {});
        check(laterRetry.status === 200 && laterRetry.body?.invoice && money(laterRetry.body.invoice.total) === 39,
          'naechste Wiederholung holt die Rechnung nach', `${laterRetry.status} ${laterRetry.body?.invoice?.invoiceNumber || 'keine'}`);
      } finally {
        FinancialService.createInvoice = originalCreateInvoice;
      }
    });

    // =================================================================================
    await section('[P] Kundentexte der Reklamation deutsch formatiert', async () => {
      notifications.length = 0;
      const { complaint: rejected } = await makeComplaint({ withFollowUp: true });
      await call('POST', `/api/complaints/${rejected._id}/reject-offer`, haendler, {});
      const { complaint: accepted } = await makeComplaint({ withFollowUp: true });
      await call('POST', `/api/complaints/${accepted._id}/accept-offer`, haendler, {});
      const texts = notifications.map((n) => n.message || '');
      const rejectText = texts.find((t) => /Rechnungsbetrag/.test(t)) || '';
      const acceptText = texts.find((t) => /Reparaturauftrag/.test(t)) || '';
      check(/Rechnungsbetrag: 39,00 €/.test(rejectText) && !/39\.00|EUR/.test(rejectText), "Ablehnung: 'Rechnungsbetrag: 39,00 €'", rejectText);
      check(/eröffnet/.test(acceptText) && !/eroeffnet/.test(acceptText), "Annahme: 'eröffnet' mit Umlaut", acceptText);
    });

    // =================================================================================
    await section('[Q] Buchungsrechnung: auch das Standardprofil faellt aus', async () => {
      const qCustomer = await User.create({ name: 'Frist3 OR', email: 'or-frist3@test.invalid', role: 'customer' });
      const { booking } = await makeBooking(qCustomer, 40);
      const originalResolveProfile = FinancialService.resolveFinancialProfile;
      FinancialService.resolveFinancialProfile = async function alwaysFailing() {
        throw new Error('Simulierter Ausfall der Finanzeinstellungen');
      };
      let invoice = null;
      let invoiceError = null;
      try {
        invoice = await BookingService.createInvoice(String(booking._id), {});
      } catch (error) {
        invoiceError = error;
      } finally {
        FinancialService.resolveFinancialProfile = originalResolveProfile;
      }
      check(!invoiceError && invoice, 'Rechnung trotz doppeltem Profilausfall erstellt', invoiceError ? invoiceError.message : invoice && invoice.invoiceNumber);
      check(invoice && invoice.paymentDueDays >= 1 && invoice.paymentDueDays <= 14 && /Tage/.test(invoice.paymentTerms || '') && invoice.dueDate,
        'Zahlungsziel normalisiert (1-14 Tage) mit deutschem Text und Datum', invoice && `${invoice.paymentDueDays} / ${invoice.paymentTerms} / ${invoice.dueDate}`);
    });

    // =================================================================================
    await section('[R] Versandlabel-Route akzeptiert das konfigurierte DHL-Produkt', async () => {
      const configCollection = mongoose.model('SystemConfiguration').collection.name;
      await mongoose.connection.db.collection(configCollection).deleteMany({});
      await mongoose.model('SystemConfiguration').create({
        integrations: [{
          name: 'DHL Paket', type: 'shipping', provider: 'DHL', apiKey: 'mock-key', isActive: true,
          credentials: { clientId: 'mock', clientSecret: 'mock', apiEndpoint: 'https://api-sandbox.dhl.com' },
          metadata: { environment: 'sandbox' },
          settings: { accountNumber: '33333333330102', product: 'V62WP' },
        }],
      });
      const order = await newDealerOrder();
      const originalCreateShipment = DHLService.createShipment;
      const captured = [];
      DHLService.createShipment = async (orderId, shipmentData) => {
        captured.push(shipmentData);
        return { success: true, direction: 'outbound', trackingNumber: 'MOCK-OR-1', mocked: true };
      };
      try {
        const configured = await call('POST', `/api/orders/${order._id}/shipping/create-label`, staff, { shipmentData: { product: 'v62wp' } });
        check(configured.status === 200 && captured.length === 1 && captured[0].product === 'V62WP',
          'konfiguriertes Produkt V62WP: an den Service weitergegeben (kein 400)', `${configured.status} ${configured.body?.code || ''} ${JSON.stringify(captured[0] || null)}`);
        const both = await call('POST', `/api/orders/${order._id}/shipping/create-label`, staff, { shipmentData: { product: 'V01PAK', serviceType: 'standard' } });
        check(both.status === 200 && captured.length === 2 && captured[1].product === 'V01PAK',
          'product gewinnt, serviceType wird dann nicht separat geprueft', `${both.status} ${both.body?.code || ''}`);
        const unknown = await call('POST', `/api/orders/${order._id}/shipping/create-label`, staff, { shipmentData: { product: 'CUSTOM' } });
        check(unknown.status === 400 && unknown.body?.code === 'DHL_PRODUCT_NOT_OFFERED' && captured.length === 2,
          'unbekanntes Produkt weiterhin 400 vor dem Service', `${unknown.status} ${unknown.body?.code || ''} ${captured.length}`);
      } finally {
        DHLService.createShipment = originalCreateShipment;
        await mongoose.connection.db.collection(configCollection).deleteMany({});
      }
    });

    // =================================================================================
    await section('[S] Auftragsdetail fuer Kunden ohne interne Abgleich-Eintraege', async () => {
      const order = await OrderService.create({
        customerId: privat._id, deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
        errorDescription: 'Test', services: [String(display._id)],
      });
      await Order.updateOne({ _id: order._id }, {
        $set: {
          shippingStatusDescription: 'Ergebnis der DHL-Labelerstellung unklar – Abgleich erforderlich',
          returnShipmentStatusDescription: 'Einsendelabel bei DHL erstellt, aber nicht vollständig gespeichert – Abgleich erforderlich',
        },
        $push: {
          timeline: {
            $each: [
              { status: 'Repair in Progress', description: 'Reparatur läuft', completedAt: new Date(), staffId: 'system', staffName: 'System' },
              { status: 'Shipping Label Reconciliation Required', description: 'Bitte im DHL-Portal pruefen (Referenz ORD-X-1)', completedAt: new Date(), staffId: 'system', staffName: 'System' },
              { status: 'Inbound Label Orphaned', description: 'Ueberzaehliges Label 00340434161234567890', completedAt: new Date(), staffId: 'system', staffName: 'System' },
              { status: 'Shipping Label Reconciled', description: 'Abgleich: Label uebernommen', completedAt: new Date(), staffId: 'system', staffName: 'System' },
              { status: 'Legacy Inbound Label Moved', description: 'Altlabel verschoben', completedAt: new Date(), staffId: 'system', staffName: 'System' },
            ],
          },
        },
      });
      const customerView = await call('GET', `/api/orders/${order._id}`, privat);
      const adminView = await call('GET', `/api/orders/${order._id}`, admin);
      const statuses = (res) => (res.body?.order?.timeline || []).map((entry) => entry.status);
      const internal = /Reconcil|Orphaned|Legacy Inbound Label Moved/;
      check(customerView.status === 200 && statuses(customerView).length > 0 && !statuses(customerView).some((s) => internal.test(s)),
        'Kunde: keine Abgleich-/Orphan-Eintraege im Verlauf', `${customerView.status} ${statuses(customerView).join(', ')}`);
      const customerText = JSON.stringify(customerView.body?.order || {});
      check(!/Abgleich erforderlich|00340434161234567890|ORD-X-1/.test(customerText),
        'Kunde: kein interner Abgleich-Text, keine DHL-Referenz', `${customerView.body?.order?.shippingStatusDescription} / ${customerView.body?.order?.returnShipmentStatusDescription}`);
      check(adminView.status === 200 && statuses(adminView).filter((s) => internal.test(s)).length === 4
        && /Abgleich erforderlich/.test(adminView.body?.order?.shippingStatusDescription || ''),
        'Admin: alle Eintraege und der interne Status sichtbar', `${adminView.status} ${statuses(adminView).filter((s) => internal.test(s)).length}`);
    });

    // =================================================================================
    await section('[T] Mitarbeiterzuweisung an Zusatzleistung: deutsche Antworten', async () => {
      const order = await newDealerOrder();
      await OrderService.addAddonToOrder(String(order._id), { name: 'Expressbearbeitung', price: 30 }, staff._id);
      const addonId = String((await readStored(order._id)).addOns[0]._id);
      const missing = await call('PUT', `/api/admin/orders/${order._id}/addons/${addonId}/assign`, admin, {});
      const unknownAddon = await call('PUT', `/api/admin/orders/${order._id}/addons/${new mongoose.Types.ObjectId()}/assign`, admin, { staffId: String(staff2._id) });
      const badStaff = await call('PUT', `/api/admin/orders/${order._id}/addons/${addonId}/assign`, admin, { staffId: String(privat._id) });
      const ok = await call('PUT', `/api/admin/orders/${order._id}/addons/${addonId}/assign`, admin, { staffId: String(staff2._id) });
      const german = (res) => /[äöüÄÖÜß]|Bitte|nicht|wurde/.test(res.body?.error || res.body?.message || '') && !/required|not found|invalid role|successfully/i.test(res.body?.error || res.body?.message || '');
      check(missing.status === 400 && german(missing), 'ohne Mitarbeiter: 400 deutsch', `${missing.status} ${missing.body?.error}`);
      check(unknownAddon.status === 404 && german(unknownAddon), 'unbekannte Zusatzleistung: 404 deutsch', `${unknownAddon.status} ${unknownAddon.body?.error}`);
      check(badStaff.status === 400 && german(badStaff), 'kein Mitarbeiterkonto: 400 deutsch', `${badStaff.status} ${badStaff.body?.error}`);
      check(ok.status === 200 && german(ok), 'Zuweisung: 200 mit deutscher Meldung', `${ok.status} ${ok.body?.message}`);
    });
  } finally {
    server.close();
  }

  console.log(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  // Andere Prozesse duerfen server/logs parallel beschreiben - geprueft wird nur, dass
  // DIESER Prozess nichts dorthin schreibt (alle Schreibzugriffe umgeleitet).
  console.log(`  server/logs: ${redirectedLogWrites} Schreibzugriff(e) dieses Tests umgeleitet nach ${LOG_REDIRECT_DIR}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('ERROR:', error.message);
  console.error(error.stack);
  process.exit(2);
});
