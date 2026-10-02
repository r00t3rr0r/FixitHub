/**
 * Regressionstest (Track "ord", Welle 3, 02.10.2026): Storno stoppt jeden Workflow, Bereit-Text nach
 * Rueckgabeweg, Dashboard-Zaehler = Listen-Gesamtzahl, DHL-Dummy-Banner aus der Konfiguration.
 *
 * Echte Express-Routen + echte DB (Wegwerf-mongod) + Rollen (Kunde, fremder Kunde, Staff, Admin).
 *   [A] Storno nur mit Grund (400 deutsch), mit Grund 200; Kunde/fremder Kunde 403.
 *   [B] Reparatur-Workflow auf storniertem Auftrag: anlegen/freigeben/fortsetzen/abschliessen/
 *       Zwischenfall -> 409 deutsch, DB unveraendert, keine Kundennachricht; Kunde 403.
 *   [C] Template-Workflow auf storniertem Auftrag: zuweisen/starten/Schritt abschliessen/
 *       ueberspringen/Personal zuweisen/fortsetzen -> 409 WORKFLOW_ORDER_CLOSED, Auftrag bleibt
 *       storniert, keine "Reparatur abgeschlossen"-Nachricht.
 *   [D] Bereit-Text: Versandauftrag (Einsendelabel) -> "Rückversand", Abholauftrag -> "Abholung",
 *       nie beides vermischt, keine Zahlungsaussage; Statuslabel neutral "Reparatur abgeschlossen";
 *       Kunde erhaelt den Versandstand, aus dem die Oberflaeche den Weg bestimmt.
 *   [E] Dashboard-KPIs (Prioritaetsauftraege > 10, offene Buchungen > 5, ausstehende Anfragen,
 *       Warten auf Kundenrueckmeldung) == Gesamtzahl der gefilterten Zielliste; Staff/Kunde 403.
 *   [F] DHL-Modus-Banner: labelMode folgt der Systemkonfiguration (nicht den Tabellenzeilen).
 *
 * MOCKS: keine Fachlogik. E-Mails -> Stream-Transport (mitgelesen); DHL wird nicht aufgerufen.
 * Aufruf (nur WEGWERF-Datenbank):
 *   EMAIL_TEST_TRANSPORT=stream TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_ord_main node test-ord-cancel-ready-dashboard.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const Module = require('module');

const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, 'server');
const LOG_DIR = path.join(SERVER_DIR, 'logs');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_ord_main';
process.env.EMAIL_TEST_TRANSPORT = 'stream';

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

// ---- Keine Dateien im Repository: Schreibzugriffe auf server/logs umleiten ----
const LOG_REDIRECT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ord-test-logs-'));
const redirectLogPath = (target) => {
  const text = typeof target === 'string' ? target : '';
  if (text && path.resolve(text).startsWith(LOG_DIR + path.sep)) {
    return path.join(LOG_REDIRECT_DIR, path.basename(text));
  }
  return target;
};
['appendFileSync', 'writeFileSync', 'mkdirSync'].forEach((name) => {
  const original = fs[name];
  fs[name] = function redirected(target, ...rest) { return original.call(this, redirectLogPath(target), ...rest); };
});
['appendFile', 'writeFile'].forEach((name) => {
  const original = fs.promises[name];
  fs.promises[name] = function redirected(target, ...rest) { return original.call(this, redirectLogPath(target), ...rest); };
});
const originalAppendFile = fs.appendFile;
fs.appendFile = function redirected(target, ...rest) { return originalAppendFile.call(this, redirectLogPath(target), ...rest); };

// 'qrcode' fehlt lokal (nur PDF-Erzeugung).
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, parent, ...rest) {
  if (request === 'qrcode') return 'qrcode-test-stub';
  return originalResolve.call(this, request, parent, ...rest);
};
require.cache['qrcode-test-stub'] = {
  id: 'qrcode-test-stub', filename: 'qrcode-test-stub', loaded: true,
  exports: { toDataURL: async () => 'data:image/png;base64,', toBuffer: async () => Buffer.from('') },
};

const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

const out = (...args) => process.stdout.write(`${args.join(' ')}\n`);
if (!process.env.DEBUG_TEST) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}

let pass = 0;
let fail = 0;
const check = (condition, message, actual) => {
  if (condition) { pass += 1; out(`  PASS ${message} :: ${actual}`); } else { fail += 1; out(`  FAIL ${message} :: ${actual}`); }
};
const section = async (title, fn) => {
  out(`\n${title}`);
  try { await fn(); } catch (error) {
    fail += 1;
    out(`  FAIL Abschnitt brach ab :: ${error && error.stack ? error.stack.split('\n').slice(0, 5).join(' | ') : error}`);
  }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isGerman = (text) => typeof text === 'string' && text.length > 0 && !/\b(not found|already|failed|is not|Invalid|Order|Workflow has)\b/.test(text);

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
  await mongoose.model('Notification').createIndexes();
  await mongoose.model('NotificationDedupeClaim').createIndexes();

  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.buildSystemUrl = async (p) => `http://test.invalid${p}`;
  EmailService.retryHandler.baseDelay = 1;
  EmailService.retryHandler.maxBackoffDelay = 5;

  const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));
  DHLService.getTrackingInfo = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };
  DHLService.createShipment = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };

  const app = express();
  app.use(express.json());
  app.use('/api/repair-workflows', require(path.join(SERVER_DIR, 'routes/repairWorkflowRoutes')));
  app.use('/api/admin/orders', require(path.join(SERVER_DIR, 'routes/adminOrderRoutes')));
  app.use('/api/orders', require(path.join(SERVER_DIR, 'routes/orderRoutes')));
  app.use('/api/admin/dashboard', require(path.join(SERVER_DIR, 'routes/adminDashboardRoutes')));
  app.use('/api/bookings', require(path.join(SERVER_DIR, 'routes/bookingRoutes')));
  app.use('/api/repair-requests', require(path.join(SERVER_DIR, 'routes/repairRequestRoutes')));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  // Nach dem Laden aller Module: der Modus kommt in [F] ausschliesslich aus der Konfiguration.
  delete process.env.BOOKING_DHL_LABEL_MODE;

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Booking = mongoose.model('Booking');
  const RepairWorkflow = mongoose.model('RepairWorkflow');
  const RepairRequest = mongoose.model('RepairRequest');
  const Notification = mongoose.model('Notification');
  const InspectionCommunication = mongoose.model('InspectionCommunication');
  const SystemConfiguration = mongoose.model('SystemConfiguration');
  const { WorkflowTemplate } = require(path.join(SERVER_DIR, 'models/Workflow'));

  const customer = await User.create({ name: 'Klara Kunde', firstName: 'Klara', lastName: 'Kunde', email: 'ord-kunde@test.invalid', role: 'customer' });
  const stranger = await User.create({ name: 'Fremd Kunde', email: 'ord-fremd@test.invalid', role: 'customer' });
  const staff = await User.create({ name: 'Sophie Technik', email: 'ord-staff@test.invalid', role: 'staff', isActive: true });
  const admin = await User.create({ name: 'Anna Admin', email: 'ord-admin@test.invalid', role: 'admin', isActive: true });

  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, user, body) => {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await response.json(); } catch (error) { json = null; }
    return { status: response.status, body: json };
  };

  let counter = 0;
  const newOrder = async (extra = {}) => {
    counter += 1;
    return Order.create({
      customerId: customer._id,
      orderNumber: `ORD-ORD-${String(counter).padStart(3, '0')}`,
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 15',
      deviceType: 'Smartphone',
      errorDescription: 'Display defekt',
      totalCost: 49.9,
      status: 'in-progress',
      ...extra,
    });
  };
  const stored = async (id) => Order.findById(id).setOptions({ skipAutoPopulate: true }).lean();
  const notesFor = async (orderId) => Notification.find({ userId: customer._id, orderId }).lean();
  const withTemplateWorkflow = async (order, workflowStatus = 'in-progress') => {
    await Order.updateOne({ _id: order._id }, {
      $push: {
        workflows: {
          workflowTemplateId: new mongoose.Types.ObjectId(), workflowName: 'Displaytausch', status: workflowStatus,
          steps: [
            { stepId: 's1', stepName: 'Display einbauen', status: workflowStatus === 'in-progress' ? 'in-progress' : 'pending' },
            { stepId: 's2', stepName: 'Test', status: 'pending' },
          ],
        },
      },
    });
    const wf = (await stored(order._id)).workflows[0];
    return { wfId: String(wf._id), step1: String(wf.steps[0]._id), step2: String(wf.steps[1]._id) };
  };
  const cancel = (id) => call('PUT', `/api/admin/orders/${id}/status`, admin, { status: 'cancelled', reason: 'INTERN Kunde zieht zurück' });

  try {
    // ------------------------------------------------------------------ [A]
    await section('[A] Storno: Grund Pflicht, Rollen', async () => {
      const order = await newOrder();
      const id = String(order._id);
      const noReason = await call('PUT', `/api/admin/orders/${id}/status`, staff, { status: 'cancelled' });
      check(noReason.status === 400 && noReason.body?.error === 'Bitte einen Grund für die Stornierung angeben.' && (await stored(id)).status === 'in-progress',
        'Staff ohne Grund -> 400 mit deutscher Servermeldung, Auftrag unveraendert', `${noReason.status} ${noReason.body?.error}`);
      const asCustomer = await call('PUT', `/api/admin/orders/${id}/status`, customer, { status: 'cancelled', note: 'x' });
      const asStranger = await call('PUT', `/api/orders/${id}/status`, stranger, { status: 'cancelled', reason: 'x' });
      check(asCustomer.status === 403 && asStranger.status === 403 && (await stored(id)).status === 'in-progress',
        'Kunde / fremder Kunde -> 403, Auftrag unveraendert', `${asCustomer.status} ${asStranger.status}`);
      // Der Client (OrderCancelDialog -> updateOrderStatus) sendet den Grund als `note`.
      const withNote = await call('PUT', `/api/admin/orders/${id}/status`, staff, { status: 'cancelled', note: 'Kunde storniert telefonisch' });
      check(withNote.status === 200 && (await stored(id)).status === 'cancelled', 'Staff mit Grund (note wie OrderCancelDialog) -> 200 storniert', withNote.status);
    });

    // ------------------------------------------------------------------ [B]
    await section('[B] Reparatur-Workflow auf storniertem Auftrag -> 409', async () => {
      // B1: kein neuer Workflow
      const fresh = await newOrder({ status: 'diagnostic-assessment' });
      await cancel(fresh._id);
      const init = await call('POST', `/api/repair-workflows/${fresh._id}/init`, staff, {});
      check(init.status === 409 && init.body?.code === 'REPAIR_ORDER_CLOSED' && isGerman(init.body?.message) && !(await RepairWorkflow.exists({ orderId: fresh._id })),
        'anlegen -> 409 REPAIR_ORDER_CLOSED, kein Workflow gespeichert', `${init.status} ${init.body?.message}`);

      // B2: Freigabe eines vorher angelegten Workflows
      const pendingOrder = await newOrder({ status: 'diagnostic-assessment' });
      await call('POST', `/api/repair-workflows/${pendingOrder._id}/init`, staff, {});
      await cancel(pendingOrder._id);
      const approve = await call('POST', `/api/repair-workflows/${pendingOrder._id}/approve`, staff, { notifyCustomer: true });
      const wfPending = await RepairWorkflow.findOne({ orderId: pendingOrder._id }).lean();
      check(approve.status === 409 && wfPending.status === 'pending-confirmation' && (await stored(pendingOrder._id)).status === 'cancelled',
        'freigeben -> 409, Workflow wartet weiter, Auftrag bleibt storniert', `${approve.status} ${wfPending.status}`);

      // B3: laufende Reparatur -> Storno pausiert, danach nichts mehr
      const running = await newOrder({ status: 'diagnostic-assessment' });
      await call('POST', `/api/repair-workflows/${running._id}/init`, staff, {});
      await call('POST', `/api/repair-workflows/${running._id}/approve`, staff, { notifyCustomer: false });
      const notesBefore = (await notesFor(running._id)).length;
      await cancel(running._id);
      await sleep(30);
      const notesAfterCancel = (await notesFor(running._id)).length;
      const resume = await call('POST', `/api/repair-workflows/${running._id}/resume`, staff, {});
      const complete = await call('POST', `/api/repair-workflows/${running._id}/complete`, staff, { notifyCustomer: true });
      const incident = await call('POST', `/api/repair-workflows/${running._id}/incidents`, staff, { incidentType: 'needs_time', reason: 'x', notifyCustomer: true });
      await sleep(30);
      const wf = await RepairWorkflow.findOne({ orderId: running._id }).lean();
      check([resume.status, complete.status, incident.status].every((status) => status === 409)
        && [resume, complete, incident].every((res) => res.body?.code === 'REPAIR_ORDER_CLOSED' && isGerman(res.body?.message)),
      'fortsetzen / abschliessen / Zwischenfall -> 409 deutsch', `${resume.status} ${complete.status} ${incident.status} ${complete.body?.message}`);
      check(wf.status === 'paused' && (await stored(running._id)).status === 'cancelled' && (await notesFor(running._id)).length === notesAfterCancel,
        'DB: Workflow bleibt pausiert, Auftrag storniert, keine weitere Kundennachricht', `${wf.status} ${notesBefore}->${notesAfterCancel}->${(await notesFor(running._id)).length}`);
      const asCustomer = await call('POST', `/api/repair-workflows/${running._id}/resume`, customer, {});
      check(asCustomer.status === 403, 'Kunde -> 403 auf Reparatur-Workflow-Routen', asCustomer.status);
    });

    // ------------------------------------------------------------------ [C]
    await section('[C] Template-Workflow auf storniertem Auftrag -> 409', async () => {
      const order = await newOrder();
      const id = String(order._id);
      const { wfId, step1, step2 } = await withTemplateWorkflow(order, 'in-progress');
      const cancelRes = await cancel(id);
      await sleep(30);
      const afterCancel = await stored(id);
      check(cancelRes.status === 200 && afterCancel.status === 'cancelled' && afterCancel.workflows[0].status === 'on-hold', 'Storno haelt den Template-Workflow an',
        `${cancelRes.status} ${cancelRes.body?.error || ''} ${afterCancel.status} ${afterCancel.workflows[0].status}`);
      const notesBefore = (await notesFor(order._id)).length;

      const completeStep = await call('POST', `/api/admin/orders/${id}/workflows/${wfId}/steps/${step1}/complete`, staff, {});
      const skipStep = await call('POST', `/api/admin/orders/${id}/workflows/${wfId}/steps/${step2}/skip`, staff, { reason: 'x' });
      const assignStep = await call('PUT', `/api/admin/orders/${id}/workflows/${wfId}/steps/${step1}/assign`, staff, { staffIds: [String(staff._id)] });
      const resume = await call('PUT', `/api/admin/orders/${id}/workflows/${wfId}/status`, staff, { status: 'in-progress' });
      const all = { completeStep, skipStep, assignStep, resume };
      check(Object.values(all).every((res) => res.status === 409 && res.body?.code === 'WORKFLOW_ORDER_CLOSED' && isGerman(res.body?.error)),
        'Schritt abschliessen / ueberspringen / zuweisen / fortsetzen -> 409 WORKFLOW_ORDER_CLOSED deutsch',
        Object.entries(all).map(([key, res]) => `${key}=${res.status}:${res.body?.code}`).join(' '));
      const after = await stored(id);
      check(after.status === 'cancelled' && after.workflows[0].status === 'on-hold'
        && after.workflows[0].steps.every((step) => step.status !== 'completed' && step.status !== 'skipped')
        && (await notesFor(order._id)).length === notesBefore,
      'DB: Auftrag storniert, kein Schritt erledigt, keine "Reparatur abgeschlossen"-Nachricht', `${after.status} ${after.workflows[0].steps.map((s) => s.status).join(',')}`);

      // Zuweisen und Starten eines neuen Workflows
      const template = await WorkflowTemplate.create({
        name: 'Akkutausch', description: 'Test', category: 'repair', isActive: true, createdBy: admin._id,
        deviceTypes: ['Smartphone'], serviceTypes: ['Akkutausch'],
        steps: [{ name: 'Akku einbauen', description: 'x', order: 1, estimatedTime: 10, category: 'repair' }],
      }).catch((error) => ({ error }));
      if (template && template._id) {
        const assign = await call('POST', `/api/admin/orders/${id}/workflows`, staff, { workflowTemplateId: String(template._id) });
        check(assign.status === 409 && assign.body?.code === 'WORKFLOW_ORDER_CLOSED' && (await stored(id)).workflows.length === 1,
          'Workflow zuweisen -> 409, kein zweiter Workflow', `${assign.status} ${assign.body?.code}`);
      } else {
        check(false, 'Workflow-Vorlage anlegen (Testdaten)', template?.error?.message);
      }
      await Order.updateOne({ _id: id }, { $push: { workflows: { workflowTemplateId: new mongoose.Types.ObjectId(), workflowName: 'Neu', status: 'not-started', steps: [{ stepId: 'n1', stepName: 'Neu', status: 'pending' }] } } });
      const newWf = (await stored(id)).workflows[1];
      const start = await call('POST', `/api/admin/orders/${id}/workflows/${newWf._id}/start`, staff, {});
      check(start.status === 409 && start.body?.code === 'WORKFLOW_ORDER_CLOSED' && (await stored(id)).workflows[1].status === 'not-started' && (await stored(id)).status === 'cancelled',
        'Workflow starten -> 409 (vorher 400 trotz 409-Fehler), Auftrag bleibt storniert', `${start.status} ${start.body?.error}`);

      // Gegenprobe: offener Auftrag -> Schritt abschliessen funktioniert weiter
      const open = await newOrder();
      const openWf = await withTemplateWorkflow(open, 'in-progress');
      const ok = await call('POST', `/api/admin/orders/${open._id}/workflows/${openWf.wfId}/steps/${openWf.step1}/complete`, staff, {});
      check(ok.status === 200, 'Gegenprobe: offener Auftrag -> Schritt abschliessen 200', ok.status);
    });

    // ------------------------------------------------------------------ [D]
    await section('[D] Bereit-Text nach Rueckgabeweg (Versand / Abholung)', async () => {
      const completeRepair = async (order) => {
        await call('POST', `/api/repair-workflows/${order._id}/init`, staff, {});
        await call('POST', `/api/repair-workflows/${order._id}/approve`, staff, { notifyCustomer: false });
        const before = (await notesFor(order._id)).length;
        const res = await call('POST', `/api/repair-workflows/${order._id}/complete`, staff, { notifyCustomer: true });
        await sleep(30);
        return { res, notes: (await notesFor(order._id)).slice(before) };
      };
      // Versandauftrag: Geraet kam per DHL-Einsendelabel
      const shipping = await newOrder({ status: 'diagnostic-assessment', returnTrackingNumber: '00340434161094000011' });
      const s = await completeRepair(shipping);
      const shipText = s.notes[0]?.message || '';
      check(s.res.status === 200 && (await stored(shipping._id)).status === 'ready-for-pickup' && s.notes.length === 1
        && /Rückversand an Sie vor/.test(shipText) && !/Abholung|abholbereit/i.test(shipText),
      'Versandauftrag: "Rückversand wird vorbereitet", kein "Abholung"', shipText);
      check(!/bezahlt|Zahlung|zugestellt|versendet/i.test(shipText), 'keine Zahlungs-/Zustellaussage bei nur fertiger Reparatur', shipText);

      // Abholauftrag: vor Ort angenommen, kein Label
      const pickup = await newOrder({ status: 'diagnostic-assessment' });
      const p = await completeRepair(pickup);
      const pickText = p.notes[0]?.message || '';
      check(p.notes.length === 1 && /zur Abholung bei uns bereit/.test(pickText) && !/Rückversand|Versand/.test(pickText),
        'Abholauftrag: Abholtext, kein Versandtext', pickText);

      // Template-Workflow-Abschluss eines Versandauftrags
      const tplShip = await newOrder({ returnTrackingNumber: '00340434161094000012' });
      const tw = await withTemplateWorkflow(tplShip, 'in-progress');
      await Order.updateOne({ _id: tplShip._id, 'workflows._id': tw.wfId }, { $pull: { 'workflows.$.steps': { _id: new mongoose.Types.ObjectId(tw.step2) } } });
      const beforeTpl = (await notesFor(tplShip._id)).length;
      const done = await call('POST', `/api/admin/orders/${tplShip._id}/workflows/${tw.wfId}/steps/${tw.step1}/complete`, staff, {});
      await sleep(30);
      const tplNotes = (await notesFor(tplShip._id)).slice(beforeTpl);
      check(done.status === 200 && (await stored(tplShip._id)).status === 'ready-for-pickup' && tplNotes.length === 1
        && /Rückversand/.test(tplNotes[0].message) && !/Abholung/.test(tplNotes[0].message),
      'Template-Workflow fertig (Versandauftrag): Rueckversand-Text', `${done.status} ${tplNotes[0]?.message}`);

      // Neutrales Statuslabel (Statusmeldungen/Listen)
      check(DHLService.orderStatusLabel('ready-for-pickup') === 'Reparatur abgeschlossen', 'DHLService-Statuslabel neutral "Reparatur abgeschlossen"', DHLService.orderStatusLabel('ready-for-pickup'));

      // Kunde erhaelt den Versandstand, aus dem die Oberflaeche den Rueckgabeweg bestimmt.
      const custShip = await call('GET', `/api/orders/${shipping._id}`, customer);
      const custPick = await call('GET', `/api/orders/${pickup._id}`, customer);
      const shipOrder = custShip.body?.order || custShip.body;
      const pickOrder = custPick.body?.order || custPick.body;
      check(custShip.status === 200 && shipOrder?.shipments?.inbound?.trackingNumber === '00340434161094000011'
        && custPick.status === 200 && !pickOrder?.shipments?.inbound?.trackingNumber && !pickOrder?.shipments?.outbound?.trackingNumber,
      'GET /api/orders/:id (Kunde): Versandstand Einsendung vorhanden bzw. leer', `${custShip.status} ${shipOrder?.shipments?.inbound?.trackingNumber} | ${custPick.status}`);
      const strangerRead = await call('GET', `/api/orders/${shipping._id}`, stranger);
      check(strangerRead.status === 403, 'fremder Kunde -> 403', strangerRead.status);

      const ReturnMethod = require(path.join(SERVER_DIR, 'utils/returnMethod'));
      const shipState = await DHLService.getOrderShipmentState(shipping._id);
      const pickState = await DHLService.getOrderShipmentState(pickup._id);
      check(ReturnMethod.resolveReturnMethod(shipState.shipments) === 'shipping' && ReturnMethod.resolveReturnMethod(pickState.shipments) === 'pickup'
        && ReturnMethod.resolveReturnMethod(null) === 'unknown',
      'Regel: Einsendelabel -> shipping, nichts -> pickup, ohne Versandstand -> unknown', 'ok');
      await Order.updateOne({ _id: shipping._id }, { $set: { trackingNumber: '00340434161094000099', shippingStatus: 'in-transit' } });
      const outState = await DHLService.getOrderShipmentState(shipping._id);
      const view = ReturnMethod.describeReadyState('ready-for-pickup', outState.shipments);
      check(view.phase === 'outbound' && view.label === 'Unterwegs zu Ihnen', 'mit Versandlabel an Kunden: Versandstatus statt "wird vorbereitet"', view.label);
    });

    // ------------------------------------------------------------------ [E]
    await section('[E] Dashboard-Zaehler == Gesamtzahl der gefilterten Liste', async () => {
      // 12 Prioritaetsauftraege (mehr als die 10 zugewiesenen der alten Zaehlung), nur 3 zugewiesen.
      for (let i = 0; i < 12; i += 1) {
        await newOrder({
          priority: i % 2 ? 'high' : 'urgent',
          status: 'pending',
          assignedStaff: i < 3 ? [{ staffId: staff._id, name: staff.name, assignedAt: new Date() }] : [],
        });
      }
      for (let i = 0; i < 4; i += 1) await newOrder({ priority: 'normal', status: 'pending' });
      // 7 offene Buchungen (mehr als die 5 neuesten der alten Zaehlung) + 2 andere
      for (let i = 0; i < 9; i += 1) {
        const order = await newOrder({ status: 'pending' });
        await Booking.create({
          customerId: customer._id,
          orderIds: [order._id],
          items: [{ type: 'repair', orderId: order._id, orderNumber: order.orderNumber, device: 'Apple iPhone 15', cost: 49.9 }],
          totalCost: 49.9,
          status: i < 7 ? 'pending' : 'processing',
        });
      }
      // Reparaturanfragen: 3 ausstehend, 2 in Pruefung
      for (let i = 0; i < 5; i += 1) {
        await RepairRequest.create({
          requestNumber: `RR-ORD-${String(i + 1).padStart(3, '0')}`,
          customerId: customer._id, customerName: 'Klara Kunde', customerEmail: 'ord-kunde@test.invalid', customerPhone: '0123',
          deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 13', issueDescription: 'Akku schwach',
          status: i < 3 ? 'pending' : 'reviewing',
        });
      }
      // Warten auf Kundenrueckmeldung: 2 Auftraege mit offener Rueckfrage, 1 beantwortet
      const waiting = [await newOrder(), await newOrder(), await newOrder()];
      for (const [index, order] of waiting.entries()) {
        await InspectionCommunication.create({
          orderId: order._id,
          status: 'active',
          messages: [{
            senderId: staff._id, senderType: 'staff', senderName: staff.name, content: 'Bitte bestätigen',
            messageType: 'feedback_request',
            feedbackRequest: { type: 'confirmation', question: 'Einverstanden?', status: index < 2 ? 'pending' : 'responded' },
          }],
        });
      }

      const summary = await call('GET', '/api/admin/dashboard/summary', admin);
      const kpis = summary.body?.data?.kpis || {};
      const prioList = await call('GET', '/api/admin/orders?priority=high-urgent&limit=5', admin);
      const bookingList = await call('GET', '/api/bookings?status=pending&limit=5', admin);
      const rrList = await call('GET', '/api/repair-requests?status=pending&limit=5', admin);
      const awaitingList = await call('GET', '/api/repair-workflows/admin/awaiting-customer-feedback', admin);
      const prioTotal = Number(prioList.body?.totalOrders ?? prioList.body?.data?.totalOrders);
      check(summary.status === 200 && kpis.priorityOrders?.count === 12 && kpis.priorityOrders.count === prioTotal
        && kpis.priorityOrders.link === '/admin/orders?prio=high-urgent',
      'Prioritaetsauftraege: 12 == Liste priority=high-urgent (alte Zaehlung: max. 10 zugewiesene)', `${kpis.priorityOrders?.count} vs ${prioTotal}`);
      const legacyAssignedCount = (summary.body?.data?.assignedOrders?.data || []).filter((o) => ['high', 'urgent'].includes(o.priority)).length;
      check(legacyAssignedCount < 12, 'Nachweis: die alte Quelle (10 zugewiesene Auftraege) haette weniger gezaehlt', legacyAssignedCount);
      check(kpis.pendingBookings?.count === 7 && kpis.pendingBookings.count === bookingList.body?.total && kpis.pendingBookings.link === '/admin/bookings?status=pending',
        'Offene Buchungen: 7 == Liste status=pending (alte Zaehlung: aus 5 neuesten)', `${kpis.pendingBookings?.count} vs ${bookingList.body?.total}`);
      check(kpis.pendingRepairRequests?.count === 3 && kpis.pendingRepairRequests.count === rrList.body?.pagination?.total
        && kpis.pendingRepairRequests.link === '/admin/repair-requests?status=pending',
      'Ausstehende Reparaturanfragen: 3 == Liste status=pending', `${kpis.pendingRepairRequests?.count} vs ${rrList.body?.pagination?.total}`);
      check(kpis.awaitingCustomer?.count === 2 && kpis.awaitingCustomer.count === awaitingList.body?.count
        && kpis.awaitingCustomer.link === '/admin/orders?rueckmeldung=offen',
      'Warten auf Kundenrueckmeldung: 2 == Liste rueckmeldung=offen', `${kpis.awaitingCustomer?.count} vs ${awaitingList.body?.count}`);
      const awaitingIds = (awaitingList.body?.orders || []).map((entry) => String(entry.orderId)).join(',');
      const awaitingOrders = await call('GET', `/api/admin/orders?ids=${awaitingIds}&limit=5`, admin);
      check(Number(awaitingOrders.body?.totalOrders) === kpis.awaitingCustomer?.count, 'Auftragsliste mit diesen IDs liefert dieselbe Gesamtzahl', awaitingOrders.body?.totalOrders);

      const asStaff = await call('GET', '/api/admin/dashboard/summary', staff);
      const asCustomer = await call('GET', '/api/admin/dashboard/summary', customer);
      check(asStaff.status === 403 && asCustomer.status === 403, 'Dashboard-Zusammenfassung: Staff/Kunde -> 403', `${asStaff.status} ${asCustomer.status}`);
    });

    // ------------------------------------------------------------------ [F]
    await section('[F] DHL-Modus aus der Systemkonfiguration (nicht aus Tabellenzeilen)', async () => {
      await SystemConfiguration.deleteMany({});
      // Eine Buchung mit Dummy-Label auf der Seite, Konfiguration LIVE -> kein Dummy-Modus.
      const order = await newOrder({ status: 'pending' });
      await Booking.create({
        customerId: customer._id, orderIds: [order._id],
        items: [{ type: 'repair', orderId: order._id, orderNumber: order.orderNumber, device: 'Apple iPhone 15', cost: 49.9 }],
        totalCost: 49.9, status: 'processing', trackingNumber: 'DHL-DUMMY-BKGORD-1', shippingStatus: 'label-created',
      });
      await SystemConfiguration.collection.insertOne({
        integrations: [{ name: 'DHL Versand', type: 'shipping', provider: 'DHL', isActive: true, settings: { bookingLabelMode: 'live' } }],
      });
      let res = await call('GET', '/api/bookings?limit=50', admin);
      const hasDummyRow = (res.body?.bookings || []).some((booking) => String(booking.trackingNumber || '').startsWith('DHL-DUMMY-') || booking.inboundLabelPlaceholder);
      check(res.status === 200 && res.body?.labelMode === 'live' && hasDummyRow, 'Konfiguration live + Dummy-Zeile auf der Seite -> labelMode live (kein Banner)', `${res.body?.labelMode} dummyRow=${hasDummyRow}`);

      await SystemConfiguration.collection.updateOne({}, { $set: { 'integrations.0.settings.bookingLabelMode': 'dummy' } });
      await Booking.updateMany({}, { $set: { trackingNumber: '' } });
      res = await call('GET', '/api/bookings?limit=50', staff);
      check(res.status === 200 && res.body?.labelMode === 'dummy', 'Konfiguration dummy, keine Dummy-Zeile -> labelMode dummy (Banner)', res.body?.labelMode);

      res = await call('GET', '/api/bookings?limit=50', customer);
      check(res.status === 200 && res.body?.labelMode === undefined, 'Kunde erhaelt keinen labelMode', `${res.status} ${res.body?.labelMode}`);
      const BookingService = require(path.join(SERVER_DIR, 'services/bookingService'));
      check(await BookingService.getBookingShippingLabelMode() === 'dummy', 'Banner und Label-Erstellung lesen dieselbe Funktion (getBookingShippingLabelMode)', 'dummy');
    });
  } finally {
    server.close();
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect();
    fs.rmSync(LOG_REDIRECT_DIR, { recursive: true, force: true });
  }

  out(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((error) => {
  out(`FEHLER: ${error && error.stack ? error.stack : error}`);
  process.exit(1);
});
