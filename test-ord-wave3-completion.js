/**
 * Regressionstest (Track "ord", Welle 3 – Nachbesserung nach Review, 02.10.2026).
 *
 * Echte Express-Routen + echte DB (Wegwerf-mongod) + Rollen (Kunde, fremder Kunde, Staff, Admin).
 *   [G] Buchungs-Storno (Aktionsmenü "Buchung stornieren" = DELETE, Statusauswahl "Storniert" = PUT):
 *       Grund Pflicht (400 deutsch), offene Aufträge -> 409 BOOKING_HAS_OPEN_ORDERS mit Auftragsnummern,
 *       Buchung unverändert, keine E-Mail; Staff-DELETE / Kunde -> 403. Nach "Auftrag stornieren"
 *       (Payload wie OrderCancelDialog) -> Buchung storniert, Grund nur im internen Verlauf (nicht in
 *       der Kundensicht), genau eine Storno-E-Mail ohne den Grund; Wiederholung -> keine zweite E-Mail.
 *   [H] Abschlussmeldung aus der echten Oberfläche: der Dialog (RepairWorkflowProcessDialog) zeigt den
 *       Text nach Rückgabeweg (lib/returnMethod = Server-Regel) und schickt einen unveränderten
 *       Vorschlag NICHT mit -> der Server wählt den Versand-/Abholtext; ein geänderter Text wird
 *       wörtlich übernommen; die nachträgliche Benachrichtigung (Retry) ebenso.
 *   [I] Storno zwischen Lesen und Speichern eines Template-Schritts -> 409 WORKFLOW_ORDER_CLOSED,
 *       nichts gespeichert (saveIfStepOpen prüft den Auftragsstatus in der Schreibbedingung).
 *   [J] Dashboard-Kacheln Reklamationen / EPart / Finanzen: Serverzahl == Gesamtzahl der Liste mit
 *       genau dem Filter des Links (mehr Datensätze als die alte 20er-/50er-Teilliste); Rollen.
 *
 * MOCKS: keine Fachlogik. E-Mails -> Stream-Transport; sendTriggerEmail wird nur mitgezählt.
 * DHL wird nicht aufgerufen.
 * Aufruf (nur WEGWERF-Datenbank):
 *   EMAIL_TEST_TRANSPORT=stream TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_ord_w3c node test-ord-wave3-completion.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const Module = require('module');

const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, 'server');
const CLIENT_DIR = path.join(ROOT, 'client');
const LOG_DIR = path.join(SERVER_DIR, 'logs');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_ord_w3c';
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
const LOG_REDIRECT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ord-w3c-logs-'));
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
const ts = require(path.join(CLIENT_DIR, 'node_modules/typescript'));

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

// Client-Modul (TypeScript) mit dem Compiler des Clients laden - ohne Netzwerk, ohne Browser.
const loadClientTs = (relative) => {
  const file = path.join(CLIENT_DIR, relative);
  const source = fs.readFileSync(file, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', output)(mod, mod.exports, Module.createRequire(file));
  return mod.exports;
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
  await mongoose.model('Notification').createIndexes();
  await mongoose.model('NotificationDedupeClaim').createIndexes();

  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.buildSystemUrl = async (p) => `http://test.invalid${p}`;
  EmailService.retryHandler.baseDelay = 1;
  EmailService.retryHandler.maxBackoffDelay = 5;
  // Nur mitzaehlen (Trigger, Empfaenger, Daten); der Versand selbst laeuft ueber den Stream-Transport.
  const sentTriggers = [];
  const originalSendTrigger = EmailService.sendTriggerEmail.bind(EmailService);
  EmailService.sendTriggerEmail = async (trigger, to, data, ...rest) => {
    sentTriggers.push({ trigger, to, data });
    return originalSendTrigger(trigger, to, data, ...rest);
  };

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
  app.use('/api/complaints', require(path.join(SERVER_DIR, 'routes/complaintRoutes')));
  app.use('/api/epart-orders', require(path.join(SERVER_DIR, 'routes/epartOrderRoutes')));
  app.use('/api/admin/financial', require(path.join(SERVER_DIR, 'routes/financialRoutes')));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Booking = mongoose.model('Booking');
  const Notification = mongoose.model('Notification');
  const Complaint = mongoose.model('Complaint');
  const { EPartOrder } = require(path.join(SERVER_DIR, 'models/EPartOrder'));
  const Invoice = mongoose.model('Invoice');
  const Payment = mongoose.model('Payment');
  const PaymentAllocation = mongoose.model('PaymentAllocation');
  const OrderService = require(path.join(SERVER_DIR, 'services/orderService'));
  const ServerReturnMethod = require(path.join(SERVER_DIR, 'utils/returnMethod'));

  const customer = await User.create({ name: 'Klara Kunde', firstName: 'Klara', lastName: 'Kunde', email: 'w3c-kunde@test.invalid', role: 'customer' });
  const stranger = await User.create({ name: 'Fremd Kunde', email: 'w3c-fremd@test.invalid', role: 'customer' });
  const staff = await User.create({ name: 'Sophie Technik', email: 'w3c-staff@test.invalid', role: 'staff', isActive: true });
  const admin = await User.create({ name: 'Anna Admin', email: 'w3c-admin@test.invalid', role: 'admin', isActive: true });

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
      orderNumber: `ORD-W3C-${String(counter).padStart(3, '0')}`,
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
  const storedBooking = async (id) => Booking.findById(id).lean();
  const notesFor = async (orderId) => Notification.find({ userId: customer._id, orderId }).sort({ createdAt: 1 }).lean();
  const newBookingWithOrders = async (orderCount, orderExtra = {}) => {
    const orders = [];
    for (let i = 0; i < orderCount; i += 1) orders.push(await newOrder({ status: 'pending', ...orderExtra }));
    const booking = await Booking.create({
      customerId: customer._id,
      orderIds: orders.map((order) => order._id),
      items: orders.map((order) => ({ type: 'repair', orderId: order._id, orderNumber: order.orderNumber, device: 'Apple iPhone 15', cost: 49.9 })),
      totalCost: 49.9 * orderCount,
      status: 'pending',
    });
    await Order.updateMany({ _id: { $in: orders.map((order) => order._id) } }, { $set: { bookingId: booking._id } });
    return { booking, orders };
  };

  try {
    // ------------------------------------------------------------------ [G]
    await section('[G] Buchungs-Storno: Grund Pflicht, offene Auftraege blockieren, Rollen', async () => {
      const { booking, orders } = await newBookingWithOrders(2);
      const id = String(booking._id);
      const mailsFor = () => sentTriggers.filter((entry) => entry.trigger === 'booking_cancelled' && entry.to === 'w3c-kunde@test.invalid');

      const noReason = await call('DELETE', `/api/bookings/${id}`, admin);
      check(noReason.status === 400 && noReason.body?.code === 'CANCEL_REASON_REQUIRED' && noReason.body?.error === 'Bitte einen Grund für die Stornierung angeben.'
        && (await storedBooking(id)).status === 'pending',
      'DELETE ohne Grund -> 400 deutsch, Buchung unveraendert', `${noReason.status} ${noReason.body?.error}`);

      const statusNoReason = await call('PUT', `/api/bookings/${id}/status`, staff, { status: 'cancelled' });
      check(statusNoReason.status === 400 && statusNoReason.body?.code === 'CANCEL_REASON_REQUIRED' && (await storedBooking(id)).status === 'pending',
        'Statusauswahl "Storniert" ohne Grund (Staff) -> 400, Buchung unveraendert', `${statusNoReason.status} ${statusNoReason.body?.error}`);

      const blocked = await call('DELETE', `/api/bookings/${id}`, admin, { reason: 'INTERN-GRUND-XYZ Kunde zieht zurück' });
      const blockedNumbers = (blocked.body?.openOrders || []).map((entry) => entry.orderNumber).sort().join(',');
      check(blocked.status === 409 && blocked.body?.code === 'BOOKING_HAS_OPEN_ORDERS'
        && orders.every((order) => String(blocked.body?.error || '').includes(order.orderNumber))
        && blockedNumbers === orders.map((order) => order.orderNumber).sort().join(','),
      'offene Auftraege -> 409 mit beiden Auftragsnummern (deutsch)', `${blocked.status} ${blocked.body?.error}`);
      const statusBlocked = await call('PUT', `/api/bookings/${id}/status`, staff, { status: 'cancelled', description: 'INTERN-GRUND-XYZ' });
      await sleep(50);
      check(statusBlocked.status === 409 && (await storedBooking(id)).status === 'pending' && mailsFor().length === 0
        && (await Order.countDocuments({ _id: { $in: orders.map((o) => o._id) }, status: 'cancelled' })) === 0,
      'Statusauswahl "Storniert" mit Grund, Auftraege offen -> 409; Buchung + Auftraege unveraendert, keine E-Mail', `${statusBlocked.status} mails=${mailsFor().length}`);

      const asStaffDelete = await call('DELETE', `/api/bookings/${id}`, staff, { reason: 'x' });
      const asCustomerDelete = await call('DELETE', `/api/bookings/${id}`, customer, { reason: 'x' });
      const asCustomerStatus = await call('PUT', `/api/bookings/${id}/status`, customer, { status: 'cancelled', description: 'x' });
      const asStrangerStatus = await call('PUT', `/api/bookings/${id}/status`, stranger, { status: 'cancelled', description: 'x' });
      check([asStaffDelete.status, asCustomerDelete.status, asCustomerStatus.status, asStrangerStatus.status].every((s) => s === 403)
        && (await storedBooking(id)).status === 'pending',
      'Staff-DELETE (nur Admin) / Kunde / fremder Kunde -> 403, Buchung unveraendert',
      `${asStaffDelete.status} ${asCustomerDelete.status} ${asCustomerStatus.status} ${asStrangerStatus.status}`);

      // "Auftrag stornieren" in der Buchungsansicht = OrderCancelDialog -> PUT /api/admin/orders/:id/status { status, note }
      for (const order of orders) {
        const res = await call('PUT', `/api/admin/orders/${order._id}/status`, staff, { status: 'cancelled', note: 'Buchung wird storniert' });
        check(res.status === 200 && (await stored(order._id)).status === 'cancelled', `Auftrag ${order.orderNumber} mit Grund storniert`, res.status);
      }

      const ok = await call('PUT', `/api/bookings/${id}/status`, staff, { status: 'cancelled', description: 'INTERN-GRUND-XYZ Kunde zieht zurück' });
      await sleep(80);
      const after = await storedBooking(id);
      const lastEntry = after.timeline[after.timeline.length - 1];
      check(ok.status === 200 && after.status === 'cancelled' && /INTERN-GRUND-XYZ/.test(lastEntry?.description || '') && String(lastEntry?.staffName || '').includes('Sophie'),
        'alle Auftraege storniert -> Buchung storniert, Grund + Person im internen Verlauf', `${ok.status} ${after.status} ${lastEntry?.description}`);
      const mails = mailsFor();
      check(mails.length === 1 && !JSON.stringify(mails[0].data).includes('INTERN-GRUND-XYZ'),
        'genau eine Storno-E-Mail an den Kunden, ohne den internen Grund', `${mails.length} ${mails[0]?.data?.cancellationReason}`);
      check(sentTriggers.filter((entry) => entry.trigger === 'booking_status_updated' && JSON.stringify(entry.data).includes('INTERN-GRUND-XYZ')).length === 0,
        'kein Status-Mail-Weg mit dem Grund (Statusauswahl nutzt dieselbe Storno-Regel)', 'ok');

      const customerView = await call('GET', `/api/bookings/${id}`, customer);
      const customerJson = JSON.stringify(customerView.body || {});
      check(customerView.status === 200 && !customerJson.includes('INTERN-GRUND-XYZ') && customerJson.includes('Storniert'),
        'Kundensicht der Buchung: storniert, interner Grund nicht enthalten', customerView.status);

      const again = await call('DELETE', `/api/bookings/${id}`, admin, { reason: 'nochmal' });
      await sleep(50);
      check(again.status === 200 && mailsFor().length === 1 && (await storedBooking(id)).timeline.length === after.timeline.length,
        'erneuter Storno -> 200 unveraendert, keine zweite E-Mail, kein zweiter Verlaufseintrag', `${again.status} mails=${mailsFor().length}`);

      // Buchung ohne offene Auftraege (Auftrag abgeschlossen) direkt per Admin-DELETE mit Grund.
      const { booking: doneBooking } = await newBookingWithOrders(1, { status: 'completed' });
      const direct = await call('DELETE', `/api/bookings/${doneBooking._id}`, admin, { reason: 'Doppelte Buchung' });
      check(direct.status === 200 && (await storedBooking(doneBooking._id)).status === 'cancelled', 'ohne offene Auftraege: Admin-DELETE mit Grund -> 200 storniert', direct.status);
      const missing = await call('DELETE', `/api/bookings/${new mongoose.Types.ObjectId()}`, admin, { reason: 'x' });
      check(missing.status === 404 && missing.body?.error === 'Buchung wurde nicht gefunden.', 'unbekannte Buchung -> 404 deutsch', `${missing.status} ${missing.body?.error}`);
    });

    // ------------------------------------------------------------------ [H]
    await section('[H] Abschlussmeldung aus der Oberflaeche: Text nach Rueckgabeweg', async () => {
      const ClientReturnMethod = loadClientTs('src/lib/returnMethod.ts');
      const subject = 'Ihres Geräts (Apple iPhone 15) zu Auftrag ORD-X';
      ['shipping', 'pickup', 'unknown'].forEach((method) => {
        check(ClientReturnMethod.readyCustomerMessage(method, subject) === ServerReturnMethod.readyCustomerMessage(method, subject),
          `Dialog-Vorschlag (lib/returnMethod) == Servertext fuer ${method}`, ClientReturnMethod.readyCustomerMessage(method, subject).slice(0, 70));
      });

      // Versandauftrag: der Dialog bekommt den Versandstand aus GET /api/orders/:id (shipments).
      const shipping = await newOrder({ status: 'diagnostic-assessment', returnTrackingNumber: '00340434161094000021' });
      await call('POST', `/api/repair-workflows/${shipping._id}/init`, staff, {});
      await call('POST', `/api/repair-workflows/${shipping._id}/approve`, staff, { notifyCustomer: false });
      const orderRead = await call('GET', `/api/orders/${shipping._id}`, staff);
      const shipments = (orderRead.body?.order || orderRead.body)?.shipments;
      const clientMethod = ClientReturnMethod.resolveReturnMethod(shipments);
      check(orderRead.status === 200 && clientMethod === 'shipping', 'Dialog bestimmt aus dem Versandstand: Versand', `${orderRead.status} ${clientMethod}`);

      // Unveraenderter Vorschlag -> der Dialog schickt KEINEN Text (customerMessage undefined faellt im JSON weg).
      const dialogPayload = JSON.parse(JSON.stringify({ notifyCustomer: true, customerMessage: undefined }));
      const before = (await notesFor(shipping._id)).length;
      const res = await call('POST', `/api/repair-workflows/${shipping._id}/complete`, staff, dialogPayload);
      await sleep(30);
      const notes = (await notesFor(shipping._id)).slice(before);
      const expected = ClientReturnMethod.readyCustomerMessage(clientMethod, 'Ihres Geräts (Apple iPhone 15) zu Auftrag ORD-W3C-' + String(counter).padStart(3, '0'));
      check(res.status === 200 && notes.length === 1 && notes[0].message === expected && !/Abholung/.test(notes[0].message),
        'Abschluss mit Dialog-Payload: Kunde erhaelt genau den angezeigten Versandtext', notes[0]?.message);

      // Von Hand geaenderter Text wird woertlich uebernommen.
      const pickup = await newOrder({ status: 'diagnostic-assessment' });
      await call('POST', `/api/repair-workflows/${pickup._id}/init`, staff, {});
      await call('POST', `/api/repair-workflows/${pickup._id}/approve`, staff, { notifyCustomer: false });
      const edited = 'Ihr Gerät ist fertig. Bitte rufen Sie uns vor der Abholung kurz an.';
      const resEdited = await call('POST', `/api/repair-workflows/${pickup._id}/complete`, staff, { notifyCustomer: true, customerMessage: edited });
      await sleep(30);
      const pickNotes = await notesFor(pickup._id);
      check(resEdited.status === 200 && pickNotes.length === 1 && pickNotes[0].message === edited, 'geaenderter Text -> woertlich', pickNotes[0]?.message);

      // Techniker schliesst ohne Benachrichtigung ab; spaeter "Kunde ueber Abschluss informieren" (unveraendert).
      const later = await newOrder({ status: 'diagnostic-assessment', returnTrackingNumber: '00340434161094000022' });
      await call('POST', `/api/repair-workflows/${later._id}/init`, staff, {});
      await call('POST', `/api/repair-workflows/${later._id}/approve`, staff, { notifyCustomer: false });
      await call('POST', `/api/repair-workflows/${later._id}/complete`, staff, { notifyCustomer: false });
      const retry = await call('POST', `/api/repair-workflows/${later._id}/notify-customer`, staff, JSON.parse(JSON.stringify({ target: 'completion', customerMessage: undefined })));
      await sleep(30);
      const laterNotes = await notesFor(later._id);
      check(retry.status === 200 && laterNotes.length === 1 && /Rückversand an Sie vor/.test(laterNotes[0].message) && !/Abholung/.test(laterNotes[0].message),
        'nachtraegliche Benachrichtigung (unveraendert) -> Versandtext', `${retry.status} ${laterNotes[0]?.message}`);
      const strangerRetry = await call('POST', `/api/repair-workflows/${later._id}/notify-customer`, customer, { target: 'completion' });
      check(strangerRetry.status === 403, 'Kunde darf keine Benachrichtigung ausloesen -> 403', strangerRetry.status);

      // Verdrahtung im Client (Quelltext): Versandstand wird uebergeben, unveraenderter Vorschlag nicht gesendet.
      const dialogSrc = fs.readFileSync(path.join(CLIENT_DIR, 'src/components/admin/RepairWorkflowProcessDialog.tsx'), 'utf8');
      const detailSrc = fs.readFileSync(path.join(CLIENT_DIR, 'src/pages/OrderDetails.tsx'), 'utf8');
      check(/shipments=\{orderShipments\}/.test(detailSrc)
        && /customerMessage: completeMessageEdited \? completeCustomerMessage\.trim\(\) : undefined/.test(dialogSrc)
        && /handleRetryNotification\(\{ target: "completion" \}, completeMessageEdited \? completeCustomerMessage\.trim\(\) : undefined\)/.test(dialogSrc)
        && /defaultRepairCustomerMessage\("complete", order, undefined, completeReturnMethod\)/.test(dialogSrc),
      'Client: OrderDetails gibt shipments weiter; Abschluss und Retry senden nur geaenderte Texte', 'ok');
    });

    // ------------------------------------------------------------------ [I]
    await section('[I] Storno zwischen Lesen und Speichern eines Template-Schritts', async () => {
      const prepare = async () => {
        const order = await newOrder();
        await Order.updateOne({ _id: order._id }, {
          $push: {
            workflows: {
              workflowTemplateId: new mongoose.Types.ObjectId(), workflowName: 'Displaytausch', status: 'in-progress',
              steps: [{ stepId: 's1', stepName: 'Display einbauen', status: 'in-progress' }],
            },
          },
        });
        const doc = await Order.findById(order._id).setOptions({ skipAutoPopulate: true });
        const wf = doc.workflows[0];
        wf.steps[0].status = 'completed';
        doc.status = 'ready-for-pickup';
        return { order, doc, wfId: String(wf._id), stepId: String(wf.steps[0]._id) };
      };
      const raced = await prepare();
      await Order.updateOne({ _id: raced.order._id }, { $set: { status: 'cancelled' } }); // paralleler Storno
      let error = null;
      try { await OrderService.saveIfStepOpen(raced.doc, raced.wfId, raced.stepId); } catch (e) { error = e; }
      const afterRace = await stored(raced.order._id);
      check(error && error.statusCode === 409 && error.code === 'WORKFLOW_ORDER_CLOSED' && /storniert/.test(error.message)
        && afterRace.status === 'cancelled' && afterRace.workflows[0].steps[0].status === 'in-progress',
      'Storno dazwischen -> 409 WORKFLOW_ORDER_CLOSED, Schritt offen, Auftrag bleibt storniert', `${error?.statusCode} ${error?.code} ${afterRace.status}`);

      const open = await prepare();
      const saved = await OrderService.saveIfStepOpen(open.doc, open.wfId, open.stepId);
      const afterOpen = await stored(open.order._id);
      check(saved && afterOpen.workflows[0].steps[0].status === 'completed' && afterOpen.status === 'ready-for-pickup',
        'Kontrolle: offener Auftrag -> Schritt gespeichert', afterOpen.status);

      const twice = await prepare();
      await Order.updateOne({ _id: twice.order._id, 'workflows._id': twice.wfId }, { $set: { 'workflows.$.steps.0.status': 'completed' } });
      let doneError = null;
      try { await OrderService.saveIfStepOpen(twice.doc, twice.wfId, twice.stepId); } catch (e) { doneError = e; }
      check(doneError && doneError.code === 'WORKFLOW_STEP_ALREADY_DONE', 'Schritt parallel erledigt -> weiterhin WORKFLOW_STEP_ALREADY_DONE', doneError?.code);
    });

    // ------------------------------------------------------------------ [J]
    await section('[J] Dashboard-Kacheln Reklamationen / EPart / Finanzen == gefilterte Liste', async () => {
      // Reklamationen: 23 offen (mehr als die alte 20er-Teilliste), 2 Freigaben (1 dringend),
      // 3 offen + hoch, 1 dringend aber geschlossen, 2 erledigt.
      const complaintBase = { customerId: customer._id, subject: 'Display flackert', description: 'Nach Reparatur', category: 'quality' };
      for (let i = 0; i < 23; i += 1) await Complaint.create({ ...complaintBase, status: 'open', priority: 'medium' });
      await Complaint.create({ ...complaintBase, status: 'pending_approval', priority: 'urgent' });
      await Complaint.create({ ...complaintBase, status: 'pending_approval', priority: 'low' });
      for (let i = 0; i < 3; i += 1) await Complaint.create({ ...complaintBase, status: 'in-progress', priority: 'high' });
      await Complaint.create({ ...complaintBase, status: 'closed', priority: 'urgent' });
      await Complaint.create({ ...complaintBase, status: 'resolved', priority: 'medium' });
      await Complaint.create({ ...complaintBase, status: 'rejected', priority: 'medium' });

      // EPart: 21 offen + Entwurf/bestellt/versendet/teilweise/erhalten/storniert; 2 verspaetet.
      const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const epartRows = [];
      const epart = (status, expectedDeliveryDate) => {
        epartRows.push({
          orderNumber: `EPO-W3C-${String(epartRows.length + 1).padStart(4, '0')}`, status, supplierId: new mongoose.Types.ObjectId(),
          items: [], subtotal: 10, totalCost: 10, createdBy: admin._id, orderDate: new Date(), expectedDeliveryDate,
        });
      };
      for (let i = 0; i < 21; i += 1) epart('pending', future);
      epart('draft', future); epart('confirmed', future);
      epart('shipped', past); epart('shipped', future); epart('partial', past);
      epart('received', past); epart('cancelled', past);
      await EPartOrder.collection.insertMany(epartRows);

      // Finanzen: offene / ueberfaellige Forderungen (Regel: Forderungsstatus + offener Betrag).
      const day = 24 * 60 * 60 * 1000;
      const inv = (n, extra) => ({
        invoiceNumber: `INV-W3C-${n}`, customerId: customer._id, customerName: 'Klara Kunde', customerEmail: 'w3c-kunde@test.invalid',
        subtotal: 84.03, total: 100, paidAmount: 0, isCreditNote: false, createdAt: new Date(), dueDate: new Date(Date.now() + 10 * day), ...extra,
      });
      const invoiceRows = [
        inv(1, { status: 'sent' }), inv(2, { status: 'sent' }), inv(3, { status: 'viewed' }),
        inv(4, { status: 'sent', dueDate: new Date(Date.now() - 3 * day) }), inv(5, { status: 'partially_paid', dueDate: new Date(Date.now() - 3 * day) }),
        inv(6, { status: 'overdue' }),
        inv(7, { status: 'paid' }), inv(8, { status: 'draft' }), inv(9, { status: 'sent', isCreditNote: true }),
        inv(10, { status: 'sent' }), // voll zugeordnet -> kein offener Betrag
      ];
      const inserted = await Invoice.collection.insertMany(invoiceRows);
      const paidInvoiceId = inserted.insertedIds[9];
      const now = Date.now();
      const payments = await Payment.collection.insertMany([
        { amount: 100, status: 'completed', paymentMethod: 'bank_transfer', transactionId: `TX-${crypto.randomUUID()}`, createdAt: new Date(now), updatedAt: new Date(now), invoiceId: paidInvoiceId },
        { amount: 20, status: 'pending', paymentMethod: 'bank_transfer', transactionId: `TX-${crypto.randomUUID()}`, createdAt: new Date(now), updatedAt: new Date(now) },
        { amount: 20, status: 'pending', paymentMethod: 'bank_transfer', transactionId: `TX-${crypto.randomUUID()}`, createdAt: new Date(now), updatedAt: new Date(now) },
        { amount: 20, status: 'disputed', paymentMethod: 'paypal', transactionId: `TX-${crypto.randomUUID()}`, createdAt: new Date(now), updatedAt: new Date(now) },
        { amount: 20, status: 'processing', paymentMethod: 'paypal', transactionId: `TX-${crypto.randomUUID()}`, createdAt: new Date(now), updatedAt: new Date(now) },
        { amount: 20, status: 'processing', paymentMethod: 'paypal', transactionId: `TX-${crypto.randomUUID()}`, createdAt: new Date(now - 3 * day), updatedAt: new Date(now - 3 * day) },
      ]);
      await PaymentAllocation.collection.insertOne({ paymentId: payments.insertedIds[0], invoiceId: paidInvoiceId, allocatedAmount: 100, createdAt: new Date(now) });

      const summary = await call('GET', '/api/admin/dashboard/summary', admin);
      const kpis = summary.body?.data?.kpis || {};
      const total = async (url, pick) => { const res = await call('GET', url, admin); return { status: res.status, value: pick(res.body || {}) }; };

      const cOpen = await total('/api/complaints?status=offen&limit=5', (b) => b.total);
      const cApproval = await total('/api/complaints?status=pending_approval&limit=5', (b) => b.total);
      const cUrgent = await total('/api/complaints?status=offen&priority=high-urgent&limit=5', (b) => b.total);
      check(summary.status === 200 && kpis.complaintsOpen?.count === 28 && kpis.complaintsOpen.count === cOpen.value && kpis.complaintsOpen.link === '/admin/complaints?status=offen',
        'Reklamationen offen: 28 == Liste status=offen (alte Zaehlung: max. 20)', `${kpis.complaintsOpen?.count} vs ${cOpen.value}`);
      check(kpis.complaintsApproval?.count === 2 && kpis.complaintsApproval.count === cApproval.value && kpis.complaintsApproval.link === '/admin/complaints?status=pending_approval',
        'Reklamationen Freigaben: 2 == Liste status=pending_approval', `${kpis.complaintsApproval?.count} vs ${cApproval.value}`);
      check(kpis.complaintsUrgent?.count === 4 && kpis.complaintsUrgent.count === cUrgent.value && kpis.complaintsUrgent.link === '/admin/complaints?status=offen&priority=high-urgent',
        'Reklamationen dringend (offen + hoch/dringend): 4 == Liste, geschlossene nicht', `${kpis.complaintsUrgent?.count} vs ${cUrgent.value}`);

      const eActive = await total('/api/epart-orders?status=aktiv&limit=5', (b) => b.pagination?.total);
      const ePending = await total('/api/epart-orders?status=ausstehend&limit=5', (b) => b.pagination?.total);
      const eDelayed = await total('/api/epart-orders?status=verzoegert&limit=5', (b) => b.pagination?.total);
      check(kpis.epartActive?.count === 26 && kpis.epartActive.count === eActive.value && kpis.epartActive.link === '/admin/epart-orders?status=aktiv',
        'EPart aktiv: 26 == Liste status=aktiv (alte Zaehlung: max. 20)', `${kpis.epartActive?.count} vs ${eActive.value}`);
      check(kpis.epartPending?.count === 23 && kpis.epartPending.count === ePending.value && kpis.epartPending.link === '/admin/epart-orders?status=ausstehend',
        'EPart ausstehend: 23 == Liste status=ausstehend', `${kpis.epartPending?.count} vs ${ePending.value}`);
      check(kpis.epartDelayed?.count === 2 && kpis.epartDelayed.count === eDelayed.value && kpis.epartDelayed.link === '/admin/epart-orders?status=verzoegert',
        'EPart verzoegert: 2 == Liste status=verzoegert (erhalten/storniert nicht)', `${kpis.epartDelayed?.count} vs ${eDelayed.value}`);

      const fOpen = await total('/api/admin/financial/invoices?receivable=offen&limit=5', (b) => b.total);
      const fOverdue = await total('/api/admin/financial/invoices?receivable=ueberfaellig&limit=5', (b) => b.total);
      const fReview = await total('/api/admin/financial/payments?review=pruefung&limit=5', (b) => b.totalCount);
      check(kpis.openInvoices?.count === 6 && kpis.openInvoices.count === fOpen.value && kpis.openInvoices.link === '/admin/financial?tab=invoices&forderung=offen',
        'offene Rechnungen: 6 == Belegliste receivable=offen (bezahlt/Entwurf/Gutschrift/voll zugeordnet nicht)', `${kpis.openInvoices?.count} vs ${fOpen.value}`);
      check(kpis.overdueInvoices?.count === 3 && kpis.overdueInvoices.count === fOverdue.value && kpis.overdueInvoices.link === '/admin/financial?tab=invoices&forderung=ueberfaellig',
        'ueberfaellige Rechnungen: 3 == Belegliste receivable=ueberfaellig', `${kpis.overdueInvoices?.count} vs ${fOverdue.value}`);
      check(kpis.paymentsInReview?.count === 4 && kpis.paymentsInReview.count === fReview.value && kpis.paymentsInReview.link === '/admin/financial?tab=payments&zahlungen=pruefung',
        'Zahlungen in Pruefung: 4 == Zahlungsliste review=pruefung (alter processing-Eintrag nicht)', `${kpis.paymentsInReview?.count} vs ${fReview.value}`);
      const report = await call('GET', '/api/admin/financial/reports?period=month', admin);
      const r = report.body?.report || report.body?.data || {};
      check(report.status !== 200 || (r.openInvoiceCount === 6 && r.overdueInvoiceCount === 3 && r.paymentsInReviewCount === 4),
        'Finanzbericht nutzt dieselbe Regel (gleiche Zahlen)', `${report.status} ${r.openInvoiceCount}/${r.overdueInvoiceCount}/${r.paymentsInReviewCount}`);

      // Unveraendertes Verhalten ohne Gruppenfilter; Operator-Objekte aus der Query werden nicht durchgereicht.
      const plain = await total('/api/complaints?status=open&limit=5', (b) => b.total);
      const injected = await total('/api/complaints?status[$ne]=x&limit=5', (b) => b.total);
      check(plain.value === 23 && injected.status === 200 && injected.value === 31, 'Einzelstatus wie bisher; status[$ne] wirkt nicht als Operator', `${plain.value} ${injected.status} ${injected.value}`);

      const staffComplaints = await call('GET', '/api/complaints?status=offen', staff);
      const customerEpart = await call('GET', '/api/epart-orders?status=aktiv', customer);
      const staffInvoices = await call('GET', '/api/admin/financial/invoices?receivable=offen', staff);
      const customerPayments = await call('GET', '/api/admin/financial/payments?review=pruefung', customer);
      check([staffComplaints.status, customerEpart.status, staffInvoices.status, customerPayments.status].every((s) => s === 403),
        'Rollen: Reklamationsliste (Admin), EPart (Staff/Admin), Finanzlisten (Admin) -> 403 fuer andere',
        `${staffComplaints.status} ${customerEpart.status} ${staffInvoices.status} ${customerPayments.status}`);
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
