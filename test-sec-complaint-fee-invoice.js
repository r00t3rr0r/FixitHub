/**
 * Regressionstest (Track sec, Wave 3): Rechnung ueber die Servicepauschale einer abgelehnten
 * Reklamation (POST /api/complaints/:id/reject-offer) - Berechtigung, Zustaende, Ausfall,
 * Wiederholung und Nebenlaeufigkeit (echte Express-Route, echte DB, echte JWT-Rollen).
 *
 * Abgesichert:
 *   [A] Unzulaessige Zustaende (nicht 'denied', Angebot bereits angenommen, ...): 409 deutsch,
 *       KEINE Rechnung, Status/Protokoll unveraendert.
 *   [B] Nicht der Eigentuemer (anderer Kunde) bzw. nicht angemeldet: 403 / 401, keine
 *       Rechnung, keine Statusaenderung - auch im Nachhol-Pfad (Ablehnung ohne Rechnung).
 *   [C] Der Kunde kann den Betrag nicht setzen (serviceFee im Body wird ignoriert: hinterlegte
 *       bzw. Standardpauschale); Personal darf ausdruecklich uebersteuern, ungueltige Werte
 *       -> 400 ohne Zustandsaenderung.
 *   [D] Wiederholung nach erfolgter Ablehnung: 200 alreadyProcessed, dieselbe Rechnung.
 *   [E] Ausfall der Rechnungserstellung: 200 mit Warnung, keine Rechnung; die naechste
 *       Wiederholung holt GENAU EINE Rechnung nach.
 *   [F] N parallele Ablehnungen (Kunde, gemischt mit fremdem Kunden und Personal): genau EINE
 *       Rechnung, genau EIN Protokolleintrag 'offer_rejected', Pauschale genau einmal am
 *       Reklamationsauftrag.
 *   [G] N parallele Nachholversuche nach einem Ausfall (langsame Rechnungserstellung): genau
 *       EINE Rechnung, genau EIN 'fee_invoice_created'.
 *   [H] Parallel Annahme und Ablehnung: genau EINE Entscheidung; Rechnung nur bei Ablehnung.
 *
 * MOCKS: Benachrichtigungen, E-Mails, DHL und 'qrcode' sind gemockt. Datei-Logs werden
 * umgeleitet. JWT_SECRET nur fuer diesen Prozess.
 *
 * Aufruf (nur WEGWERF-Datenbank):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_sec_fee node test-sec-complaint-fee-invoice.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const Module = require('module');

const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, 'server');
const LOG_DIR = path.join(SERVER_DIR, 'logs');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_sec_fee';

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

const LOG_REDIRECT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-fee-logs-'));
const redirectLogPath = (target) => {
  const text = typeof target === 'string' ? target : '';
  if (text && path.resolve(text).startsWith(LOG_DIR + path.sep)) return path.join(LOG_REDIRECT_DIR, path.basename(text));
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

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, parent, ...rest) {
  if (request === 'qrcode') return 'qrcode-test-stub';
  return originalResolve.call(this, request, parent, ...rest);
};
require.cache['qrcode-test-stub'] = {
  id: 'qrcode-test-stub', filename: 'qrcode-test-stub', loaded: true,
  exports: { toDataURL: async () => 'data:image/png;base64,', toBuffer: async () => Buffer.from('') },
};

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

let pass = 0;
let fail = 0;
const check = (condition, message, actual) => {
  if (condition) { pass += 1; console.log(`  PASS ${message} :: ${actual}`); }
  else { fail += 1; console.log(`  FAIL ${message} :: ${actual}`); }
};
const money = (value) => Number(Number(value || 0).toFixed(2));
const isGerman = (text) => /[äöüÄÖÜß]|Zugriff|Reklamation|Bitte|nicht/.test(String(text || ''))
  && !/denied|not found|required|failed|successfully|Cast to/i.test(String(text || ''));
const section = async (title, fn) => {
  console.log(`\n${title}`);
  try { await fn(); } catch (error) {
    fail += 1;
    console.log(`  FAIL Abschnitt brach ab :: ${error && error.stack ? error.stack.split('\n').slice(0, 3).join(' | ') : error}`);
  }
};

async function main() {
  if (isUnsafeTestUri(URI)) throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  fs.readdirSync(path.join(SERVER_DIR, 'models')).filter((f) => f.endsWith('.js')).forEach((f) => {
    try { require(path.join(SERVER_DIR, 'models', f)); } catch (error) { /* optional */ }
  });

  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  ['sendOrderConfirmationEmail', 'sendTriggerEmail', 'sendTemplateEmail', 'sendEmail', 'sendInvoiceEmail']
    .forEach((name) => { EmailService[name] = async () => ({ success: true, mocked: true }); });
  EmailService.buildSystemUrl = async (p) => `http://test.invalid${p}`;
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });
  const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));
  DHLService.createShipment = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };
  const InspectionCommunicationService = require(path.join(SERVER_DIR, 'services/inspectionCommunicationService'));
  InspectionCommunicationService.updateRepairOfferStatus = async () => null;
  const OrderService = require(path.join(SERVER_DIR, 'services/orderService'));
  const FinancialService = require(path.join(SERVER_DIR, 'services/financialService'));
  const originalCreateInvoice = FinancialService.createInvoice;

  const app = express();
  app.use(express.json());
  app.use('/api/complaints', require(path.join(SERVER_DIR, 'routes/complaintRoutes')));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Service = mongoose.model('Service');
  const Invoice = mongoose.model('Invoice');
  const Complaint = mongoose.model('Complaint');

  const owner = await User.create({ name: 'Kundin Eigen', email: 'fee-owner@test.invalid', role: 'customer' });
  const stranger = await User.create({ name: 'Kunde Fremd', email: 'fee-stranger@test.invalid', role: 'customer' });
  const staff = await User.create({ name: 'Sophie Fee', email: 'fee-staff@test.invalid', role: 'staff' });
  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, user, body) => {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await response.json(); } catch (error) { json = null; }
    return { status: response.status, body: json };
  };
  const reject = (complaint, user, body = {}) => call('POST', `/api/complaints/${complaint._id}/reject-offer`, user, body);

  const display = await Service.create({
    category: 'display', deviceTypes: ['Smartphone'], manufacturerPrecise: 'Apple', modelPrecise: 'iPhone 15',
    name: 'Displaytausch', price: 100, estimatedTime: '60',
  });

  // Reklamation im Zustand 'denied' mit offenem Reparaturangebot (wie nach PATCH /:id/deny).
  const makeComplaint = async ({ status = 'denied', offerStatus = 'pending', serviceFee = 0, customer = owner } = {}) => {
    const original = await OrderService.create({
      customerId: customer._id, deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
      errorDescription: 'Test', services: [String(display._id)],
    });
    await Order.updateOne({ _id: original._id }, { $set: { status: 'completed' } });
    const followUp = await Order.create({
      customerId: customer._id, deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
      services: [{ serviceId: display._id, name: 'Displaytausch', price: 100, estimatedTime: 60 }],
      totalCost: 100, discount: 0, isComplaintFollowup: true, parentOrderId: original._id, status: 'pending',
    });
    const complaint = await Complaint.create({
      customerId: customer._id, orderId: original._id, newOrderId: followUp._id,
      subject: 'Display flackert', description: 'Flackern', category: 'quality', status, serviceFee,
      repairOffer: { amount: 80, description: 'Neues Display', status: offerStatus, createdAt: new Date() },
    });
    return { complaint, followUpId: followUp._id, originalId: original._id };
  };
  const invoicesFor = async (orderId) => Invoice.find({
    $or: [{ orderId }, { repairOrderIds: orderId }], isCreditNote: { $ne: true },
  }).lean();
  const allInvoiceCount = async () => Invoice.countDocuments({});
  const readComplaint = async (id) => mongoose.connection.db.collection('complaints').findOne({ _id: new mongoose.Types.ObjectId(String(id)) });
  const logCount = (stored, action) => (stored?.complaintLogs || []).filter((e) => e.action === action).length;

  try {
    // =================================================================================
    await section('[A] Unzulaessige Zustaende: keine Rechnung, keine Zustandsaenderung', async () => {
      const states = [
        ['open', 'pending'], ['in-progress', 'pending'], ['pending_approval', 'pending'], ['approved', 'pending'],
        ['acknowledged', 'pending'], ['rejected', 'none'], ['resolved', 'pending'], ['closed', 'pending'],
        ['new_repair', 'accepted'], ['awaiting_payment', 'accepted'], ['pending-customer', 'pending'],
      ];
      for (const [status, offerStatus] of states) {
        const before = await allInvoiceCount();
        const { complaint, followUpId } = await makeComplaint({ status, offerStatus });
        const res = await reject(complaint, owner, {});
        const stored = await readComplaint(complaint._id);
        const followUp = await Order.findById(followUpId).lean();
        check(res.status === 409 && isGerman(res.body?.error) && (await allInvoiceCount()) === before
          && stored.status === status && stored.repairOffer?.status === offerStatus && logCount(stored, 'offer_rejected') === 0
          && money(followUp.totalCost) === 100,
          `Status '${status}' (Angebot ${offerStatus}): 409 deutsch, keine Rechnung, nichts geaendert`,
          `${res.status} ${res.body?.error} :: Status ${stored.status}/${stored.repairOffer?.status}, Rechnungen +${(await allInvoiceCount()) - before}`);
      }
      const missing = await call('POST', `/api/complaints/${new mongoose.Types.ObjectId()}/reject-offer`, owner, {});
      check(missing.status === 404 && isGerman(missing.body?.error), 'unbekannte Reklamation: 404 deutsch', `${missing.status} ${missing.body?.error}`);
    });

    // =================================================================================
    await section('[B] Nicht der Eigentuemer / nicht angemeldet', async () => {
      const before = await allInvoiceCount();
      const { complaint, followUpId } = await makeComplaint();
      const foreign = await reject(complaint, stranger, { serviceFee: 1 });
      const anonymous = await call('POST', `/api/complaints/${complaint._id}/reject-offer`, null, {});
      const stored = await readComplaint(complaint._id);
      check(foreign.status === 403 && isGerman(foreign.body?.error), 'anderer Kunde: 403 deutsch', `${foreign.status} ${foreign.body?.error}`);
      check(anonymous.status === 401, 'ohne Anmeldung: 401', anonymous.status);
      check(stored.status === 'denied' && stored.repairOffer?.status === 'pending' && (await invoicesFor(followUpId)).length === 0 && (await allInvoiceCount()) === before,
        'danach: weiterhin denied/pending, keine Rechnung', `${stored.status}/${stored.repairOffer?.status}`);

      // Nachhol-Pfad: Ablehnung ohne Rechnung (Ausfall), dann versucht ein FREMDER Kunde nachzuholen.
      FinancialService.createInvoice = async () => { throw new Error('Simulierter Ausfall'); };
      const first = await reject(complaint, owner, {});
      FinancialService.createInvoice = originalCreateInvoice;
      check(first.status === 200 && first.body?.invoice === null, 'Vorbedingung: Ablehnung gespeichert, Rechnung ausgefallen', first.status);
      const foreignRetry = await reject(complaint, stranger, {});
      const afterForeign = await readComplaint(complaint._id);
      check(foreignRetry.status === 403 && (await invoicesFor(followUpId)).length === 0
        && !(afterForeign.complaintLogs || []).some((e) => /^fee_invoice_retry/.test(e.action || '')),
        'fremder Kunde im Nachhol-Pfad: 403, keine Rechnung, keine Beanspruchung', `${foreignRetry.status}`);
      const otherCustomersComplaint = await makeComplaint({ customer: stranger });
      const crossed = await reject(otherCustomersComplaint.complaint, owner, {});
      check(crossed.status === 403 && (await invoicesFor(otherCustomersComplaint.followUpId)).length === 0,
        'Kundin auf Reklamation eines anderen Kunden: 403, keine Rechnung', crossed.status);
    });

    // =================================================================================
    await section('[C] Betrag: Kunde kann ihn nicht setzen, Personal darf uebersteuern', async () => {
      const a = await makeComplaint();
      const resA = await reject(a.complaint, owner, { serviceFee: 0.01 });
      check(resA.status === 200 && money(resA.body?.invoice?.total) === 39 && money((await readComplaint(a.complaint._id)).serviceFee) === 39,
        'Kunde sendet serviceFee 0,01 -> Standardpauschale 39,00', `${resA.status} ${resA.body?.invoice?.total}`);
      const b = await makeComplaint({ serviceFee: 25 });
      const resB = await reject(b.complaint, owner, { serviceFee: 0 });
      check(resB.status === 200 && money(resB.body?.invoice?.total) === 25, 'Kunde sendet 0 -> hinterlegte Pauschale 25,00', `${resB.status} ${resB.body?.invoice?.total}`);
      const c = await makeComplaint();
      const resC = await reject(c.complaint, owner, { serviceFee: '9999' });
      check(resC.status === 200 && money(resC.body?.invoice?.total) === 39, 'Kunde sendet 9999 -> 39,00', `${resC.status} ${resC.body?.invoice?.total}`);
      const d = await makeComplaint();
      const resD = await reject(d.complaint, staff, { serviceFee: '15,50' });
      check(resD.status === 200 && money(resD.body?.invoice?.total) === 15.5, 'Personal uebersteuert ausdruecklich: 15,50', `${resD.status} ${resD.body?.invoice?.total}`);
      const e = await makeComplaint();
      const resE = await reject(e.complaint, staff, { serviceFee: -5 });
      const storedE = await readComplaint(e.complaint._id);
      check(resE.status === 400 && isGerman(resE.body?.error) && storedE.status === 'denied' && (await invoicesFor(e.followUpId)).length === 0,
        'Personal mit -5: 400 deutsch, weiterhin denied, keine Rechnung', `${resE.status} ${resE.body?.error} ${storedE.status}`);
      const followUpA = await Order.findById(a.followUpId).lean();
      check(money(followUpA.totalCost) === 39 && (followUpA.addOns || []).length === 1 && (followUpA.services || []).length === 0,
        'Reklamationsauftrag traegt genau die Pauschale als einzige Position', `${followUpA.totalCost} ${(followUpA.addOns || []).map((x) => `${x.name}=${x.price}`).join(',')}`);
      // HIST-3 (02.10.2026): die Umpreisung steht im Verlauf des Reklamationsauftrags (nicht nur in der OrderRevision).
      const priceEntries = (followUpA.timeline || []).filter((entry) => entry.status === 'Order Price Changed' && entry.source === 'Reklamation');
      const change = (priceEntries[0]?.changes || [])[0] || {};
      check(priceEntries.length === 1 && money(change.from) === 100 && money(change.to) === 39 && priceEntries[0].type === 'pricing',
        'Verlauf: genau EIN Eintrag "Reklamationsauftrag neu bepreist" 100,00 -> 39,00', `${priceEntries.length} ${change.from}->${change.to} ${priceEntries[0]?.description || ''}`);
    });

    // =================================================================================
    await section('[D] Wiederholung nach erfolgter Ablehnung: dieselbe Rechnung', async () => {
      const { complaint, followUpId } = await makeComplaint();
      const first = await reject(complaint, owner, {});
      const again = await reject(complaint, owner, { serviceFee: 1 });
      const staffAgain = await reject(complaint, staff, { serviceFee: 99 });
      const invoices = await invoicesFor(followUpId);
      check(first.status === 200 && again.status === 200 && again.body?.alreadyProcessed === true
        && String(again.body?.invoice?._id) === String(first.body?.invoice?._id) && staffAgain.status === 200
        && String(staffAgain.body?.invoice?._id) === String(first.body?.invoice?._id) && invoices.length === 1 && money(invoices[0].total) === 39,
        'zweiter Aufruf (Kunde und Personal mit anderem Betrag): 200 alreadyProcessed, dieselbe Rechnung 39,00',
        `${first.status}/${again.status}/${staffAgain.status} ${invoices.map((i) => `${i.invoiceNumber}=${i.total}`).join(',')}`);
      check(logCount(await readComplaint(complaint._id), 'offer_rejected') === 1, 'genau EIN Protokolleintrag offer_rejected', '1');
    });

    // =================================================================================
    await section('[E] Ausfall der Rechnungserstellung und Nachholen', async () => {
      const { complaint, followUpId } = await makeComplaint();
      FinancialService.createInvoice = async () => { throw new Error('Simulierter Ausfall'); };
      const first = await reject(complaint, owner, {});
      const failedRetry = await reject(complaint, owner, {});
      FinancialService.createInvoice = originalCreateInvoice;
      const stored = await readComplaint(complaint._id);
      check(first.status === 200 && first.body?.invoice === null && (first.body?.warnings || []).length === 1 && isGerman(first.body.warnings[0])
        && stored.status === 'awaiting_payment' && stored.repairOffer?.status === 'rejected' && (await invoicesFor(followUpId)).length === 0,
        'Ausfall: 200 mit deutscher Warnung, Ablehnung gespeichert, keine Rechnung', `${first.status} ${JSON.stringify(first.body?.warnings)}`);
      check(failedRetry.status === 200 && failedRetry.body?.invoice === null && (await invoicesFor(followUpId)).length === 0,
        'Nachholversuch waehrend des Ausfalls: keine Rechnung', `${failedRetry.status} ${JSON.stringify(failedRetry.body?.warnings)}`);
      const recovered = await reject(complaint, owner, { serviceFee: 0.01 });
      const again = await reject(complaint, owner, {});
      const invoices = await invoicesFor(followUpId);
      check(recovered.status === 200 && money(recovered.body?.invoice?.total) === 39 && invoices.length === 1
        && String(again.body?.invoice?._id) === String(invoices[0]._id),
        'nach dem Ausfall: genau EINE Rechnung 39,00 (Kundenbetrag ignoriert), danach dieselbe', `${recovered.status} ${invoices.map((i) => `${i.invoiceNumber}=${i.total}`).join(',')}`);
      const afterAll = await readComplaint(complaint._id);
      check(logCount(afterAll, 'fee_invoice_created') === 1 && logCount(afterAll, 'offer_rejected') === 1
        && !(afterAll.complaintLogs || []).some((e) => e.action === 'fee_invoice_retry' && e.metadata?.finished !== true),
        'Protokoll: je EIN offer_rejected / fee_invoice_created, keine offene Beanspruchung', (afterAll.complaintLogs || []).map((e) => e.action).join(','));
    });

    // =================================================================================
    await section('[F] N parallele Ablehnungen (Kunde, fremder Kunde, Personal)', async () => {
      for (const round of [1, 2, 3]) {
        const { complaint, followUpId } = await makeComplaint({ serviceFee: 30 });
        const calls = [];
        for (let i = 0; i < 6; i += 1) calls.push(reject(complaint, owner, { serviceFee: 0.01 }));
        for (let i = 0; i < 3; i += 1) calls.push(reject(complaint, stranger, {}));
        if (round === 3) calls.push(reject(complaint, staff, { serviceFee: 12 }));
        const results = await Promise.all(calls);
        const ownerResults = results.slice(0, 6);
        const strangerResults = results.slice(6, 9);
        const invoices = await invoicesFor(followUpId);
        const stored = await readComplaint(complaint._id);
        const followUp = await Order.findById(followUpId).lean();
        const loggedFee = (stored.complaintLogs || []).find((e) => e.action === 'offer_rejected')?.metadata?.serviceFee;
        check(invoices.length === 1, `Runde ${round}: genau EINE Rechnung`, invoices.map((i) => `${i.invoiceNumber}=${i.total}`).join(',') || '(keine)');
        check(strangerResults.every((r) => r.status === 403), `Runde ${round}: fremder Kunde immer 403`, strangerResults.map((r) => r.status).join(','));
        check(ownerResults.every((r) => r.status === 200 || r.status === 409) && results.some((r) => r.status === 200 && r.body?.invoice && !r.body?.alreadyProcessed),
          `Runde ${round}: Kunde 200/409, genau eine Entscheidung mit Rechnung`, results.map((r) => `${r.status}${r.body?.alreadyProcessed ? '*' : ''}`).join(','));
        check(logCount(stored, 'offer_rejected') === 1 && (followUp.addOns || []).length === 1 && money(followUp.totalCost) === money(loggedFee)
          && money(invoices[0]?.total) === money(loggedFee) && [30, 12].includes(money(loggedFee)),
          `Runde ${round}: EIN offer_rejected, Pauschale einmal, Rechnung == protokollierte Pauschale (nie Kundenbetrag)`,
          `Pauschale ${loggedFee}, Auftrag ${followUp.totalCost}, Positionen ${(followUp.addOns || []).length}`);
      }
    });

    // =================================================================================
    await section('[G] N parallele Nachholversuche nach einem Ausfall (langsame Rechnungserstellung)', async () => {
      for (const round of [1, 2]) {
        const { complaint, followUpId } = await makeComplaint();
        FinancialService.createInvoice = async () => { throw new Error('Simulierter Ausfall'); };
        await reject(complaint, owner, {});
        let createCalls = 0;
        FinancialService.createInvoice = async function slow(...args) {
          createCalls += 1;
          await new Promise((resolve) => setTimeout(resolve, 80));
          return originalCreateInvoice.apply(this, args);
        };
        const results = await Promise.all([
          ...Array.from({ length: 6 }, () => reject(complaint, owner, { serviceFee: 0.01 })),
          ...Array.from({ length: 2 }, () => reject(complaint, staff, {})),
          ...Array.from({ length: 2 }, () => reject(complaint, stranger, {})),
        ]);
        FinancialService.createInvoice = originalCreateInvoice;
        const invoices = await invoicesFor(followUpId);
        const stored = await readComplaint(complaint._id);
        check(invoices.length === 1 && money(invoices[0].total) === 39 && createCalls === 1,
          `Runde ${round}: genau EINE nachgeholte Rechnung 39,00, createInvoice genau einmal`, `${invoices.length} Rechnung(en), ${createCalls} Aufruf(e)`);
        check(results.slice(0, 8).every((r) => r.status === 200) && results.slice(8).every((r) => r.status === 403),
          `Runde ${round}: Berechtigte 200, fremder Kunde 403`, results.map((r) => r.status).join(','));
        check(logCount(stored, 'fee_invoice_created') === 1
          && !(stored.complaintLogs || []).some((e) => e.action === 'fee_invoice_retry' && e.metadata?.finished !== true),
          `Runde ${round}: EIN fee_invoice_created, keine offene Beanspruchung`, (stored.complaintLogs || []).map((e) => e.action).join(','));
      }
    });

    // =================================================================================
    await section('[H] Parallel Annahme und Ablehnung: genau eine Entscheidung', async () => {
      for (const round of [1, 2, 3]) {
        const { complaint, followUpId } = await makeComplaint();
        const results = await Promise.all([
          call('POST', `/api/complaints/${complaint._id}/accept-offer`, owner, {}),
          reject(complaint, owner, {}),
          call('POST', `/api/complaints/${complaint._id}/accept-offer`, owner, {}),
          reject(complaint, owner, {}),
        ]);
        const stored = await readComplaint(complaint._id);
        const invoices = await invoicesFor(followUpId);
        const feeInvoices = invoices.filter((inv) => (inv.items || []).some((it) => it.type === 'fee'));
        const decided = stored.repairOffer?.status;
        check((decided === 'rejected' && stored.status === 'awaiting_payment' && feeInvoices.length === 1)
          || (decided === 'accepted' && stored.status === 'new_repair' && feeInvoices.length === 0),
          `Runde ${round}: eine Entscheidung (${decided}), Pauschalenrechnung nur bei Ablehnung`,
          `${results.map((r) => r.status).join(',')} :: ${stored.status}/${decided}, Pauschalenrechnungen ${feeInvoices.length}`);
        check(logCount(stored, 'offer_rejected') + logCount(stored, 'offer_accepted') <= 1 && results.every((r) => [200, 409].includes(r.status)),
          `Runde ${round}: hoechstens ein Entscheidungseintrag, nur 200/409`, (stored.complaintLogs || []).map((e) => e.action).join(','));
      }
    });
  } finally {
    FinancialService.createInvoice = originalCreateInvoice;
    server.close();
  }

  console.log(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error('ERROR:', error.message);
  console.error(error.stack);
  console.log(`\n==== ${pass} bestanden, ${fail + 1} fehlgeschlagen ====`);
  try { await mongoose.disconnect(); } catch (e) { /* egal */ }
  process.exit(2);
});
