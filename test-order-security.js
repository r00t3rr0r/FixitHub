/**
 * Regressionstest (Track order-security): Zugriffsschutz und ehrliche Antworten am Auftrag.
 *
 * Abgesichert:
 *   A. GET /api/orders/:id/revisions (Auftragshistorie) war nur durch requireUser geschuetzt:
 *      jeder angemeldete Kunde konnte die Historie JEDES Auftrags lesen (Bruttobetraege,
 *      Mitarbeiternamen, interne Notizen). Jetzt: fremder Kunde -> 403 deutsch (auch fuer
 *      unbekannte/ungueltige IDs - keine Existenzpruefung ueber 403/404), Eigentuemer ->
 *      gefilterte Historie (Betraege und Positionen, KEINE Mitarbeiternamen/-IDs, KEINE
 *      internen Notizen), Personal/Admin -> vollstaendige Historie.
 *      Zusaetzlich: jede weitere Route unter /api/orders/:id, die nur requireUser traegt,
 *      weist einen fremden Kunden ab.
 *   B. PUT /api/admin/orders/:id/addons/:addonId/assign meldete 200 "zugewiesen", die Zuweisung
 *      wurde aber nie gespeichert (addOnServiceSchema ohne assignedStaff). Jetzt wird sie an der
 *      richtigen Zusatzleistung gespeichert (erneutes Lesen aus der DB), doppelte Zuweisung
 *      bleibt ein Eintrag; Kunden sehen die Zuweisung in GET /api/orders/:id nicht.
 *   C. Reklamation ablehnen - Nachholen der Pauschalenrechnung: bisher nur durch eine
 *      2-Minuten-Zeitsperre serialisiert. Dauert FinancialService.createInvoice laenger als die
 *      Sperre, konnte eine zweite Wiederholung eine ZWEITE Rechnung erstellen. Der Test
 *      simuliert eine langsame Rechnungserstellung, waehrend der die Sperre ablaeuft, und
 *      startet dann eine zweite Wiederholung: es darf genau EINE Rechnung entstehen.
 *      Ausserdem: wiederholt scheiternde Nachholversuche fuellen das Protokoll nicht
 *      unbegrenzt; ein abgebrochener Versuch (Prozessabbruch) erzeugt nie eine Doppelrechnung.
 *      (Der haengende Stub wird erst ersetzt, nachdem der Lauf ihn nachweislich erreicht hat -
 *      unter CPU-Last war die fruehere Wartezeit von 50 x 20 ms zu kurz.)
 *   D. Loeschbestaetigung einer Reparaturposition (OrderDetails.tsx) uebergibt die gezeigte
 *      Abweichung (repricingBasis) statt eines nackten confirmRepricing-Booleans
 *      (Quelltextpruefung der Komponente + Verhaltensprobe des echten Clients).
 *
 * MOCKS: Benachrichtigungen, E-Mails, DHL und 'qrcode' sind gemockt - keine echte E-Mail,
 * kein Label, kein PayPal/DHL/SMTP. Datei-Logs (server/logs) werden umgeleitet, damit der
 * Test keine Dateien im Repository hinterlaesst. JWT_SECRET nur fuer diesen Prozess.
 *
 * Aufruf (nur WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/order_security node test-order-security.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const Module = require('module');

const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, 'server');
const CLIENT_DIR = path.join(ROOT, 'client');
const API_DIR = path.join(CLIENT_DIR, 'src/api');
const LOG_DIR = path.join(SERVER_DIR, 'logs');

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_order_security';

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
const LOG_REDIRECT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'order-security-logs-'));
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
const isGerman = (text) => /[äöüÄÖÜß]|Zugriff|Auftrag|Bitte|nicht|wurde/.test(String(text || ''))
  && !/denied|not found|required|failed|successfully|Cast to/i.test(String(text || ''));

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

// Echter Client (TypeScript -> CommonJS); './api' zeichnet die Anfrage nur auf.
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
  EmailService.sendTemplateEmail = async () => ({ success: true, mocked: true });
  EmailService.sendEmail = async () => ({ success: true, mocked: true });
  EmailService.sendInvoiceEmail = async () => ({ success: true, mocked: true });
  EmailService.buildSystemUrl = async (p) => `http://test.invalid${p}`;
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });
  const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));
  DHLService.createShipment = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };
  DHLService.getTrackingInfo = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };
  const InspectionCommunicationService = require(path.join(SERVER_DIR, 'services/inspectionCommunicationService'));
  InspectionCommunicationService.updateRepairOfferStatus = async () => null;

  const OrderService = require(path.join(SERVER_DIR, 'services/orderService'));
  const OrderRevisionService = require(path.join(SERVER_DIR, 'services/orderRevisionService'));
  const FinancialService = require(path.join(SERVER_DIR, 'services/financialService'));

  const app = express();
  app.use(express.json());
  app.use('/api/orders', require(path.join(SERVER_DIR, 'routes/orderRoutes')));
  app.use('/api/complaints', require(path.join(SERVER_DIR, 'routes/complaintRoutes')));
  app.use('/api/admin/orders', require(path.join(SERVER_DIR, 'routes/adminOrderRoutes')));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Service = mongoose.model('Service');
  const Invoice = mongoose.model('Invoice');
  const Complaint = mongoose.model('Complaint');

  const readStored = async (id) =>
    mongoose.connection.db.collection('orders').findOne({ _id: new mongoose.Types.ObjectId(String(id)) });
  const readComplaint = async (id) =>
    mongoose.connection.db.collection('complaints').findOne({ _id: new mongoose.Types.ObjectId(String(id)) });

  const owner = await User.create({ name: 'Kunde Eigentuemer', email: 'sec-owner@test.invalid', role: 'customer' });
  const stranger = await User.create({ name: 'Kunde Fremd', email: 'sec-stranger@test.invalid', role: 'customer' });
  const staff = await User.create({ name: 'Sophie SEC', email: 'sec-staff@test.invalid', role: 'staff' });
  const staff2 = await User.create({ name: 'Tom SEC', email: 'sec-staff2@test.invalid', role: 'staff' });
  const admin = await User.create({ name: 'Admin SEC', email: 'sec-admin@test.invalid', role: 'admin' });
  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, user, body) => {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(user)}` },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await response.json(); } catch (error) { json = null; }
    return { status: response.status, body: json };
  };

  const display = await Service.create({
    category: 'display', deviceTypes: ['Smartphone'], manufacturerPrecise: 'Apple', modelPrecise: 'iPhone 15',
    name: 'Displaytausch', price: 100, estimatedTime: '60',
  });
  const newOrder = async (customer = owner) => OrderService.create({
    customerId: customer._id, deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
    errorDescription: 'Test', services: [String(display._id)],
  });

  try {
    // =================================================================================
    await section('[A] Auftragshistorie (GET /api/orders/:id/revisions): Besitzpruefung und Filter', async () => {
      const order = await newOrder(owner);
      const orderId = String(order._id);
      await OrderRevisionService.recordRevision(
        { ...order.toObject(), totalCost: 120 },
        {
          triggerReason: 'addon_added', previousGrossAmount: 100, changedBy: staff._id, changedByName: 'Sophie SEC',
          notes: 'INTERN: Neuberechnung trotz Abweichung bestätigt, Kunde schwierig',
        }
      );
      // OrderService.create legt bereits die Revision 'initial_creation' an.
      const stored = await mongoose.connection.db.collection('orderrevisions').find({ orderId: order._id }).toArray();
      check(stored.length === 2 && stored.some((r) => r.changedByName === 'Sophie SEC' && /INTERN/.test(r.notes)),
        'Vorbedingung: Revision mit Mitarbeitername und Notiz', stored.map((r) => r.triggerReason).join(','));
      const pick = (list) => (list || []).find((r) => r.triggerReason === 'addon_added');

      const foreign = await call('GET', `/api/orders/${orderId}/revisions`, stranger);
      check(foreign.status === 403 && isGerman(foreign.body?.error), 'fremder Kunde: 403 deutsch', `${foreign.status} ${foreign.body?.error}`);
      check(!Array.isArray(foreign.body?.revisions) && !JSON.stringify(foreign.body || {}).includes('Sophie SEC'),
        'fremder Kunde: keine Historie, kein Mitarbeitername in der Antwort', JSON.stringify(foreign.body).slice(0, 200));

      const unknown = await call('GET', `/api/orders/${new mongoose.Types.ObjectId()}/revisions`, stranger);
      const invalid = await call('GET', '/api/orders/kein-objectid/revisions', stranger);
      check(unknown.status === 403 && invalid.status === 403 && isGerman(invalid.body?.error),
        'Kunde: unbekannte und ungueltige ID -> ebenfalls 403 (keine Existenzpruefung)', `${unknown.status} ${invalid.status} ${invalid.body?.error}`);

      const own = await call('GET', `/api/orders/${orderId}/revisions`, owner);
      const ownRevisions = own.body?.revisions || [];
      check(own.status === 200 && ownRevisions.length === 2 && money(pick(ownRevisions)?.newGrossAmount) === 120 && money(pick(ownRevisions)?.previousGrossAmount) === 100,
        'Eigentuemer: 200 mit Betraegen seiner Historie', `${own.status} ${JSON.stringify(ownRevisions.map((r) => [r.previousGrossAmount, r.newGrossAmount]))}`);
      const ownText = JSON.stringify(own.body || {});
      check(!ownText.includes('Sophie SEC') && !ownText.includes(String(staff._id)) && !ownText.includes('INTERN')
        && ownRevisions.every((r) => r.changedByName === undefined && r.changedBy === undefined && r.notes === undefined),
        'Eigentuemer: KEINE Mitarbeiternamen/-IDs und KEINE internen Notizen', Object.keys(pick(ownRevisions) || {}).join(','));

      const staffView = await call('GET', `/api/orders/${orderId}/revisions`, staff);
      const adminView = await call('GET', `/api/orders/${orderId}/revisions`, admin);
      check(staffView.status === 200 && pick(staffView.body?.revisions)?.changedByName === 'Sophie SEC' && /INTERN/.test(pick(staffView.body?.revisions)?.notes || '')
        && String(pick(staffView.body?.revisions)?.changedBy) === String(staff._id),
        'Personal: vollstaendige Historie', `${staffView.status} ${pick(staffView.body?.revisions)?.changedByName}`);
      check(adminView.status === 200 && pick(adminView.body?.revisions)?.changedByName === 'Sophie SEC',
        'Admin: vollstaendige Historie', `${adminView.status}`);
      const staffInvalid = await call('GET', '/api/orders/kein-objectid/revisions', staff);
      const staffUnknown = await call('GET', `/api/orders/${new mongoose.Types.ObjectId()}/revisions`, staff);
      check(staffInvalid.status === 404 && staffUnknown.status === 404 && isGerman(staffUnknown.body?.error),
        'Personal: ungueltige/unbekannte ID -> 404 deutsch (kein 500 mit Cast-Fehler)', `${staffInvalid.status} ${staffUnknown.status} ${staffUnknown.body?.error}`);

      // Sweep: jede GET-Route unter /api/orders/:id, die nur requireUser traegt, weist einen
      // fremden Kunden ab und gibt keine Auftragsdaten heraus.
      const routes = ['', '/progress-timeline', '/shipments', '/shipping-label', '/return-label', '/tracking', '/revisions'];
      const results = [];
      for (const suffix of routes) {
        const res = await call('GET', `/api/orders/${orderId}${suffix}`, stranger);
        results.push(`${suffix || '/'}=${res.status}`);
        check(res.status === 403 && !JSON.stringify(res.body || {}).includes(order.orderNumber),
          `fremder Kunde GET /api/orders/:id${suffix}: 403 ohne Auftragsdaten`, `${res.status} ${res.body?.error}`);
      }
      const complaintForeign = await call('POST', `/api/orders/${orderId}/complaint`, stranger, { reason: 'x', description: 'y' });
      check(complaintForeign.status === 403, 'fremder Kunde POST /api/orders/:id/complaint: 403', complaintForeign.status);
    });

    // =================================================================================
    await section('[B] Mitarbeiterzuweisung an Zusatzleistung wird gespeichert', async () => {
      const order = await newOrder(owner);
      const orderId = String(order._id);
      await OrderService.addAddonToOrder(orderId, { name: 'Expressbearbeitung', price: 30 }, staff._id);
      await OrderService.addAddonToOrder(orderId, { name: 'Datensicherung', price: 20 }, staff._id);
      const before = await readStored(orderId);
      const addonB = before.addOns.find((a) => a.name === 'Datensicherung');

      const res = await call('PUT', `/api/admin/orders/${orderId}/addons/${addonB._id}/assign`, admin, { staffId: String(staff2._id) });
      const after = await readStored(orderId);
      const stored = after.addOns.find((a) => String(a._id) === String(addonB._id));
      const other = after.addOns.find((a) => a.name === 'Expressbearbeitung');
      const assignedIds = (stored?.assignedStaff || []).map((s) => String(s.staffId));
      check(res.status === 200 && assignedIds.length === 1 && assignedIds[0] === String(staff2._id),
        'nach 200: Mitarbeiter in der DB an der richtigen Zusatzleistung gespeichert', `${res.status} ${res.body?.message || res.body?.error} :: ${JSON.stringify(stored?.assignedStaff ?? null)}`);
      check(stored?.assignedStaff?.[0]?.name === 'Tom SEC' && stored?.assignedStaff?.[0]?.assignedAt,
        'Name und Zeitpunkt der Zuweisung gespeichert', JSON.stringify(stored?.assignedStaff?.[0] ?? null));
      check(!(other?.assignedStaff || []).length, 'andere Zusatzleistung unveraendert', JSON.stringify(other?.assignedStaff ?? null));
      const responseAddon = (res.body?.order?.addOns || []).find((a) => String(a._id) === String(addonB._id));
      check((responseAddon?.assignedStaff || []).some((s) => String(s.staffId?._id || s.staffId) === String(staff2._id)),
        'Antwort enthaelt die gespeicherte Zuweisung', JSON.stringify(responseAddon?.assignedStaff ?? null));

      const again = await call('PUT', `/api/admin/orders/${orderId}/addons/${addonB._id}/assign`, staff, { staffId: String(staff2._id) });
      const afterAgain = await readStored(orderId);
      const againStored = afterAgain.addOns.find((a) => String(a._id) === String(addonB._id));
      check(again.status === 200 && (againStored?.assignedStaff || []).length === 1, 'doppelte Zuweisung: weiterhin genau EIN Eintrag', `${again.status} ${(againStored?.assignedStaff || []).length}`);
      check(money(afterAgain.totalCost) === money(before.totalCost), 'Zuweisung aendert den Auftragswert nicht', `${before.totalCost} -> ${afterAgain.totalCost}`);

      const adminDetail = await call('GET', `/api/admin/orders/${orderId}`, admin);
      const adminAddon = (adminDetail.body?.order?.addOns || []).find((a) => String(a._id) === String(addonB._id));
      check((adminAddon?.assignedStaff || []).length === 1, 'Admin-Detail zeigt die Zuweisung', JSON.stringify(adminAddon?.assignedStaff ?? null));
      const customerDetail = await call('GET', `/api/orders/${orderId}`, owner);
      const customerAddon = (customerDetail.body?.order?.addOns || []).find((a) => String(a._id) === String(addonB._id));
      check(customerDetail.status === 200 && customerAddon && customerAddon.assignedStaff === undefined,
        'Kunde: Zusatzleistung ohne interne Mitarbeiterzuweisung', `${customerDetail.status} ${JSON.stringify(customerAddon?.assignedStaff ?? '(nicht enthalten)')}`);
    });

    // =================================================================================
    const makeRejectedWithoutInvoice = async () => {
      const original = await newOrder(owner);
      await Order.updateOne({ _id: original._id }, { $set: { status: 'completed' } });
      const followUp = await Order.create({
        customerId: owner._id, deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
        services: [{ serviceId: display._id, name: 'Displaytausch', price: 100, estimatedTime: 60 }],
        totalCost: 100, discount: 0, isComplaintFollowup: true, parentOrderId: original._id, status: 'pending',
      });
      const complaint = await Complaint.create({
        customerId: owner._id, orderId: original._id, newOrderId: followUp._id,
        subject: 'Display flackert', description: 'Flackern', category: 'quality', status: 'denied',
        repairOffer: { amount: 80, description: 'Neues Display', status: 'pending', createdAt: new Date() },
      });
      // Erster Lauf: Rechnungserstellung faellt aus -> Ablehnung gespeichert, keine Rechnung.
      const originalCreateInvoice = FinancialService.createInvoice;
      FinancialService.createInvoice = async () => {
        FinancialService.createInvoice = originalCreateInvoice;
        throw new Error('Simulierter Ausfall der Rechnungserstellung');
      };
      const first = await call('POST', `/api/complaints/${complaint._id}/reject-offer`, owner, {});
      FinancialService.createInvoice = originalCreateInvoice;
      return { complaint, followUpId: followUp._id, first };
    };
    const feeInvoices = async (followUpId) => Invoice.find({ orderId: followUpId, isCreditNote: { $ne: true } }).lean();
    const retryLogEntries = (stored) => (stored?.complaintLogs || []).filter((entry) => /^fee_invoice_retry/.test(entry.action || ''));

    await section('[C] Reklamation: Nachholen der Pauschalenrechnung ist gegen langsame Rechnungserstellung abgesichert', async () => {
      const originalCreateInvoice = FinancialService.createInvoice;
      try {
        const { complaint, followUpId, first } = await makeRejectedWithoutInvoice();
        check(first.status === 200 && first.body?.invoice === null, 'Vorbedingung: Ablehnung ohne Rechnung', `${first.status}`);

        // Wiederholung A: createInvoice ist LANGSAM. Waehrend A laeuft, "vergehen" 10 Minuten
        // (Zeitstempel der Beanspruchung zurueckgesetzt - laenger als jede Zeitsperre), dann
        // kommt Wiederholung B. B darf KEINE zweite Rechnung erstellen.
        let secondReplay = null;
        let slowCalls = 0;
        FinancialService.createInvoice = async function slowCreateInvoice(...args) {
          slowCalls += 1;
          if (slowCalls === 1) {
            await mongoose.connection.db.collection('complaints').updateOne(
              { _id: complaint._id },
              { $set: { 'complaintLogs.$[entry].createdAt': new Date(Date.now() - 10 * 60 * 1000) } },
              { arrayFilters: [{ 'entry.action': { $regex: '^fee_invoice_retry' } }] }
            );
            secondReplay = await call('POST', `/api/complaints/${complaint._id}/reject-offer`, owner, {});
          }
          return originalCreateInvoice.apply(this, args);
        };
        const replayA = await call('POST', `/api/complaints/${complaint._id}/reject-offer`, owner, {});
        FinancialService.createInvoice = originalCreateInvoice;
        const invoices = await feeInvoices(followUpId);
        check(invoices.length === 1, 'langsame Rechnungserstellung + zweite Wiederholung: genau EINE Rechnung',
          invoices.map((i) => `${i.invoiceNumber}=${i.total}`).join(', ') || '(keine)');
        check(replayA.status === 200 && replayA.body?.invoice && money(replayA.body.invoice.total) === 39,
          'Wiederholung A erstellt die Rechnung (39,00)', `${replayA.status} ${replayA.body?.invoice?.invoiceNumber || 'keine'}`);
        check(secondReplay && secondReplay.status === 200 && !secondReplay.body?.invoice
          && (secondReplay.body?.warnings || []).some((w) => /gerade erstellt/.test(w)),
          'Wiederholung B waehrenddessen: 200 mit Hinweis "wird gerade erstellt", keine Rechnung', `${secondReplay?.status} ${JSON.stringify(secondReplay?.body?.warnings)}`);
        const later = await call('POST', `/api/complaints/${complaint._id}/reject-offer`, owner, {});
        check(later.status === 200 && String(later.body?.invoice?._id) === String(invoices[0]?._id) && (await feeInvoices(followUpId)).length === 1,
          'spaetere Wiederholung: dieselbe Rechnung', `${later.status} ${later.body?.invoice?.invoiceNumber}`);
        const stored = await readComplaint(complaint._id);
        check((stored.complaintLogs || []).filter((e) => e.action === 'fee_invoice_created').length === 1,
          'Protokoll: genau EIN Eintrag "Rechnung nachgeholt"', (stored.complaintLogs || []).map((e) => e.action).join(','));

        // Wiederholt scheiternde Nachholversuche: Protokoll waechst nicht unbegrenzt, danach
        // ist ein weiterer Versuch moeglich.
        const { complaint: c2, followUpId: f2 } = await makeRejectedWithoutInvoice();
        FinancialService.createInvoice = async () => { throw new Error('Simulierter Dauerausfall'); };
        const failing = [];
        for (let i = 0; i < 3; i += 1) {
          failing.push(await call('POST', `/api/complaints/${c2._id}/reject-offer`, owner, {}));
        }
        FinancialService.createInvoice = originalCreateInvoice;
        check(failing.every((r) => r.status === 200 && r.body?.invoice === null && (r.body?.warnings || []).some((w) => /weiterhin nicht erstellt/.test(w))),
          'drei gescheiterte Nachholversuche: jeweils 200 mit Warnung', failing.map((r) => r.status).join(','));
        const storedFailing = await readComplaint(c2._id);
        const failEntries = retryLogEntries(storedFailing);
        check(failEntries.length <= 1, 'Protokoll: gescheiterte Versuche zusammengefasst (hoechstens EIN Eintrag)',
          failEntries.map((e) => `${e.action}:${JSON.stringify(e.metadata)}`).join(' | '));
        const recovered = await call('POST', `/api/complaints/${c2._id}/reject-offer`, owner, {});
        check(recovered.status === 200 && recovered.body?.invoice && (await feeInvoices(f2)).length === 1,
          'nach den Ausfaellen: naechste Wiederholung erstellt genau EINE Rechnung', `${recovered.status} ${recovered.body?.invoice?.invoiceNumber || 'keine'}`);

        // Abgebrochener Versuch (Prozessabbruch mitten in createInvoice): die Beanspruchung
        // bleibt stehen. Auch nach langer Zeit erstellt eine Wiederholung KEINE Rechnung auf
        // Verdacht (sie koennte noch laufen); legt das Personal die Rechnung manuell an, wird
        // genau diese geliefert.
        const { complaint: c3, followUpId: f3 } = await makeRejectedWithoutInvoice();
        // Deterministisch: der haengende Stub meldet, dass der Lauf ihn ERREICHT hat; erst dann
        // wird das Original wiederhergestellt. Frueher wartete der Test nur auf den
        // Beanspruchungs-Eintrag (max. 50 x 20 ms) - unter CPU-Last erreichte der Lauf
        // createInvoice erst NACH dem Wiederherstellen und erstellte wirklich eine Rechnung.
        let markStubReached;
        const stubReached = new Promise((resolve) => { markStubReached = resolve; });
        FinancialService.createInvoice = async () => {
          markStubReached(true);
          return new Promise(() => {}); // haengt fuer immer
        };
        const hanging = call('POST', `/api/complaints/${c3._id}/reject-offer`, owner, {}).catch(() => null);
        const reached = await Promise.race([
          stubReached,
          new Promise((resolve) => setTimeout(() => resolve(false), 30000)),
        ]);
        FinancialService.createInvoice = originalCreateInvoice;
        check(reached === true && retryLogEntries(await readComplaint(c3._id)).length === 1,
          'Vorbedingung: haengender Lauf hat die Beanspruchung gesetzt und steckt in createInvoice', `erreicht=${reached}`);
        await mongoose.connection.db.collection('complaints').updateOne(
          { _id: c3._id },
          { $set: { 'complaintLogs.$[entry].createdAt': new Date(Date.now() - 60 * 60 * 1000) } },
          { arrayFilters: [{ 'entry.action': { $regex: '^fee_invoice_retry' } }] }
        );
        const whileStuck = await call('POST', `/api/complaints/${c3._id}/reject-offer`, owner, {});
        check(whileStuck.status === 200 && !whileStuck.body?.invoice && (await feeInvoices(f3)).length === 0
          && (whileStuck.body?.warnings || []).some((w) => /Finanzverwaltung|gerade erstellt/.test(w)),
          'haengender Versuch (auch nach 60 Min.): keine Rechnung auf Verdacht, deutscher Hinweis', `${whileStuck.status} ${JSON.stringify(whileStuck.body?.warnings)}`);
        const manual = await originalCreateInvoice.call(FinancialService, {
          orderId: f3, customerId: owner._id, discount: 0,
          items: [{ serviceName: 'Servicepauschale', description: 'manuell', quantity: 1, unitPrice: 39, total: 39, type: 'fee' }],
        });
        const afterManual = await call('POST', `/api/complaints/${c3._id}/reject-offer`, owner, {});
        check(afterManual.status === 200 && String(afterManual.body?.invoice?._id) === String(manual._id) && (await feeInvoices(f3)).length === 1,
          'nach manueller Rechnung: genau diese wird geliefert, keine zweite', `${afterManual.status} ${afterManual.body?.invoice?.invoiceNumber}`);
        void hanging;
      } finally {
        FinancialService.createInvoice = originalCreateInvoice;
      }
    });

    // =================================================================================
    await section('[D] Loeschbestaetigung einer Reparaturposition an die gezeigte Abweichung gebunden', async () => {
      // Quelltextpruefung (kein Client-Build erlaubt): OrderDetails.tsx uebergibt beim
      // Bestaetigen die Abweichung aus dem 409-Dialog (buildRepricingConfirmation) und
      // keinen nackten confirmRepricing-Boolean mehr.
      const source = fs.readFileSync(path.join(CLIENT_DIR, 'src/pages/OrderDetails.tsx'), 'utf8');
      const handler = (source.match(/const handleDeleteRepairService = async[\s\S]*?\n  }\n/) || [''])[0];
      const confirmFn = (source.match(/const confirmDeleteRepairService = async[\s\S]*?\n  }\n/) || [''])[0];
      check(/buildRepricingConfirmation\(/.test(confirmFn) && /deleteServiceRepricing\??\.details/.test(confirmFn),
        'confirmDeleteRepairService bildet die Bestaetigung aus der gezeigten Abweichung', confirmFn ? 'gefunden' : 'nicht gefunden');
      check(handler && !/confirmRepricing:\s*options\.confirmRepricing\s*===\s*true\s*\n/.test(handler) && /repricingBasis/.test(handler),
        'handleDeleteRepairService reicht repricingBasis an removeServiceFromOrder weiter', handler ? 'gefunden' : 'nicht gefunden');

      // Verhaltensprobe des echten Clients (client/src/api/orderServices.ts, anderer Track):
      // kommt die Grundlage beim Server an? Wenn ja, ist die Bindung scharf pruefbar.
      const requests = [];
      const apiStub = { delete: async (url, config) => { requests.push({ url, data: config?.data }); return { data: { success: true } }; } };
      const orderServicesApi = loadClientModule('orderServices.ts', apiStub, {});
      await orderServicesApi.removeServiceFromOrder('o1', 's1', {
        reason: 'Test', confirmRepricing: true, repricingBasis: { storedTotal: 80, expectedTotal: 100 },
      });
      const sent = requests[0]?.data || {};
      if (sent.repricingBasis) {
        check(money(sent.repricingBasis.storedTotal) === 80 && money(sent.repricingBasis.expectedTotal) === 100,
          'Client sendet repricingBasis beim Entfernen', JSON.stringify(sent));
      } else {
        console.log(`  OFFEN (cross-track client/src/api/orderServices.ts + server/routes/orderServiceRoutes.js + server/services/orderServiceManagementService.js): removeServiceFromOrder verwirft repricingBasis :: ${JSON.stringify(sent)}`);
      }
    });
  } finally {
    server.close();
  }

  console.log(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log(`  server/logs: ${redirectedLogWrites} Schreibzugriff(e) dieses Tests umgeleitet nach ${LOG_REDIRECT_DIR}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('ERROR:', error.message);
  console.error(error.stack);
  process.exit(2);
});
