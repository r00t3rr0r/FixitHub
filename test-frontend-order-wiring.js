/**
 * Frontend-Verdrahtung (P1 frontend): die ECHTEN Client-API-Module
 * (client/src/api/orderServices.ts und client/src/api/orders.ts, per TypeScript
 * transpiliert) gegen die ECHTEN Express-Router - derselbe Weg wie im Browser,
 * nur ohne React-Oberflaeche.
 *
 * Abgesichert:
 *   1. Auswaehlbare Services fuer einen Auftrag kommen serverseitig nach dem
 *      tatsaechlichen Geraet gefiltert und VOLLSTAENDIG (nicht die erste Seite des
 *      Gesamtkatalogs mit fremden Modellen).
 *   2. Eine manuelle Reparaturposition aus dem Dialog (serviceId '', isManual,
 *      Name, Beschreibung, Grund) wird gespeichert; der Haendlerrabatt bleibt.
 *   3. Bearbeiten einer manuellen Position uebernimmt Name/Beschreibung/Grund.
 *   4. Entfernen sendet den Grund - er steht in der Auftragshistorie.
 *   5. Warnungen der Aenderungsantwort werden ausgelesen.
 *   6. Zahlungsstand einer Rechnung kommt aus dem Server-Saldo: Teilzahlung
 *      ("Teilbezahlt · offen") und Ueberzahlung ("Ueberzahlt · Erstattung offen")
 *      - nicht aus "Gesamt - bezahlt".
 *   7. Belege ohne Saldo (Buchungsendpunkt) werden aus /api/invoices ergaenzt; ein
 *      unbekannter Beleg bleibt ohne Saldo (keine erfundene 0).
 *
 * ALTES VERHALTEN nachstellen (Fehlschlag-Nachweis): FE_API_DIR auf ein Verzeichnis
 * mit den alten Dateien orderServices.ts/orders.ts setzen. Fehlen dort die neuen
 * Funktionen, bildet der Test exakt das alte Verhalten von OrderDetails/
 * CustomerInvoices nach (Stand HEAD 6943b03): getServices() -> GET /api/services,
 * handleAddRepairService sendet nur serviceId/price/estimatedTime/notes,
 * removeServiceFromOrder ohne Grund, offener Betrag = max(0, total - paidAmount).
 *
 * MOCKS: E-Mail/Benachrichtigungen (keine Kunden-E-Mail) und das Modul 'qrcode'
 * (fehlt in server/node_modules; wird nur fuer PDFs gebraucht, die hier nicht
 * erzeugt werden). Kein PayPal/DHL. JWT_SECRET nur fuer diesen Prozess zufaellig.
 *
 * Aufruf (nur WEGWERF-Datenbank):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/fe_wiring node test-frontend-order-wiring.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Module = require('module');

const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, 'server');
const CLIENT_DIR = path.join(ROOT, 'client');
const API_DIR = process.env.FE_API_DIR ? path.resolve(process.env.FE_API_DIR) : path.join(CLIENT_DIR, 'src/api');

const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));
const ts = require(path.join(CLIENT_DIR, 'node_modules/typescript'));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/fe_order_wiring';

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

// MOCK 'qrcode' (nur fuer PDF-Erzeugung in invoicePdfService benoetigt).
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
const createApiStub = (state) => {
  const request = async (method, url, body, config = {}) => {
    const response = await fetch(`${state.baseUrl}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.token}` },
      body: body !== undefined ? JSON.stringify(body) : (config.data !== undefined ? JSON.stringify(config.data) : undefined),
    });
    let data = {};
    try { data = await response.json(); } catch (error) { data = {}; }
    // Gleiche Form wie ApiError in client/src/api/api.ts
    if (response.status >= 400) {
      const error = new Error(data?.error || data?.message || `Anfrage fehlgeschlagen (HTTP ${response.status})`);
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
  const fullPath = path.join(API_DIR, fileName);
  const source = fs.readFileSync(fullPath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: fullPath,
  });
  const moduleExports = {};
  const localRequire = (request) => {
    if (request === './api') return { __esModule: true, default: apiStub };
    if (request.startsWith('./')) return loadClientModule(`${request.slice(2)}.ts`, apiStub, cache);
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

  const MODELS_DIR = path.join(SERVER_DIR, 'models');
  fs.readdirSync(MODELS_DIR).filter((file) => file.endsWith('.js')).forEach((file) => {
    try { require(path.join(MODELS_DIR, file)); } catch (error) { /* optionale Abhaengigkeiten */ }
  });

  // MOCKS: keine echten E-Mails / Benachrichtigungen.
  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.sendOrderConfirmationEmail = async () => ({ success: true, mocked: true });
  EmailService.buildSystemUrl = async (p) => `http://test.invalid${p}`;
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });

  const app = express();
  app.use(express.json());
  app.use('/api/orders', require(path.join(SERVER_DIR, 'routes/orderRoutes')));
  app.use('/api/order-services', require(path.join(SERVER_DIR, 'routes/orderServiceRoutes')));
  app.use('/api/services', require(path.join(SERVER_DIR, 'routes/serviceRoutes')));
  app.use('/api/invoices', require(path.join(SERVER_DIR, 'routes/invoiceRoutes')));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const state = { baseUrl: `http://127.0.0.1:${server.address().port}`, token: '' };
  const apiStub = createApiStub(state);
  const cache = {};
  const orderServicesApi = loadClientModule('orderServices.ts', apiStub, cache);
  const ordersApi = loadClientModule('orders.ts', apiStub, cache);

  const User = mongoose.model('User');
  const Service = mongoose.model('Service');
  const OrderService = require(path.join(SERVER_DIR, 'services/orderService'));
  const FinancialService = require(path.join(SERVER_DIR, 'services/financialService'));
  const readStored = async (id) =>
    mongoose.connection.db.collection('orders').findOne({ _id: new mongoose.Types.ObjectId(String(id)) });
  const readRevisions = async (id) =>
    mongoose.connection.db.collection('orderrevisions').find({ orderId: new mongoose.Types.ObjectId(String(id)) }).sort({ revisionNumber: 1 }).toArray();

  const customer = await User.create({ name: 'Haendler FE', email: 'fe-haendler@test.invalid', role: 'customer', discount: 10 });
  const staff = await User.create({ name: 'Sophie FE', email: 'fe-staff@test.invalid', role: 'staff' });
  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const actAs = (user) => { state.token = tokenFor(user); };

  // 12 passende iPhone-15-Services (mehr als eine Seite) + fremde Modelle, alphabetisch VOR den iPhone-Services.
  const base = { category: 'display', deviceTypes: ['Smartphone'], manufacturerPrecise: 'Apple', modelPrecise: 'iPhone 15' };
  const iphoneServices = [];
  for (let index = 1; index <= 12; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    iphoneServices.push(await Service.create({ ...base, name: `Reparatur iPhone 15 Nr. ${String(index).padStart(2, '0')}`, price: 10 * index, estimatedTime: '30' }));
  }
  for (let index = 1; index <= 3; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Service.create({ ...base, name: `Akkutausch Pixel 8 Nr. ${index}`, price: 90, manufacturerPrecise: 'Google', modelPrecise: 'Pixel 8' });
  }

  try {
    // Auftrag ueber den normalen Weg anlegen: 100,00 Listenpreis, 10 % Haendlerrabatt -> 90,00.
    const display = iphoneServices[9]; // 100,00
    const created = await OrderService.create({
      customerId: String(customer._id),
      deviceType: 'Smartphone',
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 15',
      services: [String(display._id)],
    });
    const orderId = String(created._id);
    let stored = await readStored(orderId);
    check(money(stored.totalCost) === 90, 'Ausgangslage: Auftrag 100,00 - 10 % = 90,00', stored.totalCost);

    actAs(staff);

    console.log('\n[1] Auswaehlbare Services fuer den Auftrag (Staff)');
    let available;
    if (typeof orderServicesApi.getAvailableServicesForOrder === 'function') {
      available = (await orderServicesApi.getAvailableServicesForOrder(orderId)).services;
    } else {
      // ALT (HEAD): OrderDetails rief getServices() -> GET /api/services ohne Parameter.
      available = (await apiStub.get('/api/services')).data.services || [];
    }
    const names = available.map((service) => service.name);
    check(names.every((name) => /iPhone 15/.test(name)), 'nur Services fuer das Geraet des Auftrags (iPhone 15)', names.filter((name) => !/iPhone 15/.test(name)).join(', ') || 'keine fremden');
    check(available.length === 12, 'alle 12 passenden Services, nicht nur die erste Seite', available.length);

    console.log('\n[2] Manuelle Position aus dem Dialog (Standardpreis brutto 50,00)');
    // Genau das Objekt, das RepairServiceDialog an onSave uebergibt.
    const manualForm = {
      serviceId: '', isManual: true, name: 'Platinenreparatur', description: 'Mikrolöten am Ladechip',
      price: 50, estimatedTime: 0, notes: '', reason: 'Zusatzschaden bei Diagnose',
    };
    let addResponse = null;
    let addError = null;
    try {
      if (typeof orderServicesApi.addRepairServiceFromForm === 'function') {
        addResponse = await orderServicesApi.addRepairServiceFromForm(orderId, manualForm);
      } else {
        // ALT (HEAD OrderDetails.handleAddRepairService): nur diese vier Felder.
        addResponse = await orderServicesApi.addServiceToOrder(orderId, manualForm.serviceId, {
          price: manualForm.price, estimatedTime: manualForm.estimatedTime, notes: manualForm.notes,
        });
      }
    } catch (error) {
      addError = error;
    }
    check(!addError, 'Speichern erfolgreich (kein Fehler)', addError ? addError.message : 'ok');
    stored = await readStored(orderId);
    const manualLine = (stored.services || []).find((line) => line.isManual);
    check(manualLine && manualLine.name === 'Platinenreparatur' && !manualLine.serviceId, 'DB: manuelle Position ohne Katalog-ID', manualLine ? manualLine.name : 'fehlt');
    check(manualLine && manualLine.description === 'Mikrolöten am Ladechip', 'DB: Beschreibung gespeichert', manualLine && manualLine.description);
    // 150 -> 15 -> 135
    check(money(stored.totalCost) === 135 && money(stored.discount) === 15, 'DB: 150,00 - 15,00 = 135,00 (Rabatt bleibt)', `${stored.totalCost} / ${stored.discount}`);
    check(addResponse && money(addResponse.pricing?.grossTotal) === 135, 'Antwort: pricing.grossTotal 135,00', addResponse && addResponse.pricing?.grossTotal);
    let revisions = await readRevisions(orderId);
    check(revisions.some((revision) => /Zusatzschaden bei Diagnose/.test(String(revision.notes || ''))), 'Historie enthaelt den Grund', revisions.map((r) => r.notes).join(' | ').slice(0, 160));

    console.log('\n[3] Manuelle Position bearbeiten (Name, Beschreibung, Grund)');
    if (manualLine) {
      const editForm = { ...manualForm, serviceId: '', name: 'Platinenreparatur (Ladechip)', description: 'Ladechip getauscht', price: 60, reason: 'Mehraufwand' };
      if (typeof orderServicesApi.updateRepairServiceFromForm === 'function') {
        await orderServicesApi.updateRepairServiceFromForm(orderId, String(manualLine._id), editForm, { isManualLine: true });
      } else {
        // ALT (HEAD OrderDetails.handleEditRepairService): nur price/estimatedTime/notes.
        await orderServicesApi.updateOrderService(orderId, String(manualLine._id), {
          price: editForm.price, estimatedTime: editForm.estimatedTime, notes: editForm.notes,
        });
      }
      stored = await readStored(orderId);
      const edited = stored.services.find((line) => String(line._id) === String(manualLine._id));
      check(edited && edited.name === 'Platinenreparatur (Ladechip)', 'DB: neuer Name', edited && edited.name);
      check(edited && edited.description === 'Ladechip getauscht', 'DB: neue Beschreibung', edited && edited.description);
      // 160 -> 16 -> 144
      check(money(stored.totalCost) === 144, 'DB: 160,00 - 16,00 = 144,00', stored.totalCost);
      revisions = await readRevisions(orderId);
      check(revisions.some((revision) => /Mehraufwand/.test(String(revision.notes || ''))), 'Historie enthaelt den Grund der Aenderung', revisions.length);
    } else {
      check(false, 'Bearbeiten nicht moeglich - manuelle Position fehlt', 'uebersprungen');
    }

    console.log('\n[4] Position entfernen mit Grund');
    // Eine zweite Position sicherstellen (ein Auftrag braucht mindestens eine Position).
    await orderServicesApi.addServiceToOrder(orderId, String(iphoneServices[1]._id), { price: 20, estimatedTime: 30, notes: '' });
    stored = await readStored(orderId);
    const toRemove = stored.services.find((line) => String(line.serviceId) === String(iphoneServices[1]._id));
    await orderServicesApi.removeServiceFromOrder(orderId, String(toRemove._id), { reason: 'Kunde lehnt ab' });
    stored = await readStored(orderId);
    check(!stored.services.some((line) => String(line._id) === String(toRemove._id)), 'DB: Position entfernt', stored.services.length);
    revisions = await readRevisions(orderId);
    const lastRevision = revisions[revisions.length - 1];
    check(/Kunde lehnt ab/.test(String(lastRevision?.notes || '')), 'Historie: Grund des Entfernens gespeichert', String(lastRevision?.notes || '').slice(0, 160));

    console.log('\n[5] Warnungen der Aenderungsantwort');
    if (typeof orderServicesApi.getOrderServiceWarnings === 'function') {
      const realSync = FinancialService.syncOrderAndBookingValue;
      FinancialService.syncOrderAndBookingValue = async () => { throw new Error('Simulierter Ausfall'); };
      let warnResponse;
      try {
        warnResponse = await orderServicesApi.addRepairServiceFromForm(orderId, {
          serviceId: String(iphoneServices[0]._id), isManual: false, price: 10, estimatedTime: 30, notes: '', reason: 'Test',
        });
      } finally {
        FinancialService.syncOrderAndBookingValue = realSync;
      }
      const warnings = orderServicesApi.getOrderServiceWarnings(warnResponse);
      check(warnings.length > 0 && warnings.every((w) => /[a-zäöüß]/.test(w)), 'Warnung zum Finanzabgleich wird ausgelesen (deutsch)', JSON.stringify(warnings));
      check(orderServicesApi.getOrderServiceWarnings({ warnings: ['', '  '] }).length === 0, 'leere Warnungen werden ignoriert', 0);
    } else {
      check(false, 'Warnungen werden ausgelesen', 'ALT: keine Auswertung - Antwort wurde verworfen');
    }

    console.log('\n[6] Zahlungsstand der Rechnung aus dem Server-Saldo');
    const summarize = typeof ordersApi.summarizeInvoicePayment === 'function'
      ? ordersApi.summarizeInvoicePayment
      // ALT (HEAD OrderDetails/CustomerInvoices): offen = max(0, total - paidAmount)
      : (invoice) => {
        const open = Math.max(0, Number(invoice.total || 0) - Number(invoice.paidAmount || invoice.amountPaid || 0));
        return { known: true, open, refundPending: 0, label: `Offen ${open.toFixed(2)}`, tone: 'open' };
      };
    await mongoose.model('Order').updateOne({ _id: orderId }, { $set: { status: 'completed' } });
    stored = await readStored(orderId);
    const invoice = await FinancialService.createInvoiceFromOrder(orderId, {});
    await mongoose.model('Invoice').updateOne({ _id: invoice._id }, { $set: { status: 'sent' } });
    check(money(invoice.total) === money(stored.totalCost), 'Rechnungsbrutto === Auftragswert', `${invoice.total} === ${stored.totalCost}`);
    await FinancialService.addInvoicePayment(String(invoice._id), { amount: 50, paymentMethod: 'bank_transfer' });

    actAs(customer);
    let listed = (await apiStub.get('/api/invoices')).data.invoices.find((entry) => String(entry._id) === String(invoice._id));
    let payment = summarize(listed);
    const expectedOpen = money(invoice.total - 50);
    check(payment.known && money(payment.open) === expectedOpen, `Teilzahlung: offen ${expectedOpen} laut Server`, payment.open);
    check(/Teilbezahlt/.test(payment.label), 'Label "Teilbezahlt · offen …"', payment.label);

    // Ueberzahlung: Kunde zahlt 20,00 mehr als offen.
    await FinancialService.addInvoicePayment(String(invoice._id), { amount: expectedOpen + 20, paymentMethod: 'bank_transfer', allowOverpayment: true });
    listed = (await apiStub.get('/api/invoices')).data.invoices.find((entry) => String(entry._id) === String(invoice._id));
    payment = summarize(listed);
    check(money(listed?.balance?.refundPending) === 20, 'Server: Erstattung offen 20,00', listed?.balance?.refundPending);
    check(money(payment.refundPending) === 20 && /Überzahlt · Erstattung offen/.test(payment.label), 'Anzeige: "Überzahlt · Erstattung offen 20,00 €"', payment.label);
    check(money(payment.open) === 0, 'Anzeige: offen 0,00', payment.open);

    console.log('\n[7] Belege ohne Saldo werden ergaenzt, unbekannte bleiben ohne');
    if (typeof ordersApi.attachInvoiceBalances === 'function') {
      const unknownId = String(new mongoose.Types.ObjectId());
      const enriched = await ordersApi.attachInvoiceBalances([
        { _id: String(invoice._id), invoiceNumber: invoice.invoiceNumber, total: invoice.total },
        { _id: unknownId, invoiceNumber: 'X', total: 10 },
      ]);
      check(money(enriched[0].balance?.refundPending) === 20, 'Beleg aus Buchungsliste bekommt Server-Saldo', enriched[0].balance?.refundPending);
      check(enriched[1].balance === undefined && summarize(enriched[1]).known === false, 'unbekannter Beleg: kein Saldo, keine erfundene 0', summarize(enriched[1]).known);
    } else {
      check(false, 'Belege ohne Saldo werden ergaenzt', 'ALT: Anzeige rechnete total - paidAmount');
    }
  } finally {
    server.close();
  }

  console.log(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch(async (error) => {
  console.error('Testlauf abgebrochen:', error);
  try { await mongoose.disconnect(); } catch (disconnectError) { /* ignore */ }
  process.exitCode = 1;
});
