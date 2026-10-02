/**
 * Regressionstest (Track comms): zentrales Postfach und Auftrags-Thread (K01-K04).
 *
 * Abgesichert (echte Express-Routen, echte DB-Lese-/Schreibzugriffe, echte JWT-Rollen):
 *   [A] COMMS-1   GET /api/inspection-communication lieferte 500 'User is not defined' (fehlender
 *                 require) -> /messages zeigte "Kein Feedback vorhanden". Jetzt 200 + Inbox listet
 *                 den Auftrag mit Vorschau.
 *   [B] COMMS-5 / ADMUX-11  Auftrags-Thread ohne Besitz-/Rollenpruefung: fremder Kunde las/schrieb
 *                 fremde Threads, Kunden konnten "Staff-Rueckfragen" anlegen, Personal antwortete im
 *                 Namen des Kunden, Doppel-Antworten ueberschrieben die Antwort.
 *   [C] COMMS-9   Interne Notiz: nur Personal, Speicher Order.staffNotes(type internal), keine
 *                 Auto-Zuweisung, keine Kundenbenachrichtigung, nie in Kunden-API/Inbox.
 *   [D] COMMS-11  Doppelklick/Retry: dieselbe clientMessageId -> genau 1 Nachricht, 1 Benachrichtigung;
 *                 parallele erste Nachrichten -> genau 1 Thread-Dokument.
 *   [E] COMMS-10  Lese-Regel: pro Benutzer ungelesen, teamweit "Antwort ausstehend"; Staff->Staff
 *                 zaehlt nicht; Gastnachrichten zaehlen; unread-counts nutzt dieselbe Regel.
 *   [F] COMMS-3   Serverseitige Paginierung ueber alle Quellen (keine 50/100-Grenze), Serversuche,
 *                 Dashboard-Zaehler == Postfach-Zaehler, Dashboard-Links auf das Gespraech.
 *   [G] COMMS-4 / COMMS-12  Quellenfilter; Reklamationen und Alt-Nachrichten der Reparaturanfrage im
 *                 Postfach; interne Reklamationskommentare nie fuer Kunden; Kontaktanfragen nur Admin.
 *   [H] COMMS-2   Eine fehlerhafte Quelle -> 200 mit sourceErrors (nicht "keine Nachrichten").
 *   [I] COMMS-14  Suchbegriffe mit Regex-Sonderzeichen -> 200 statt 500.
 *   [J] COMMS-13  inspectionId wird serverseitig abgeleitet (orderId als inspectionId wird verworfen).
 *   [K] COMMS-15  Benachrichtigungen: ohne Zuweisung an alle aktiven Admins (deutsch, Link auf das
 *                 Gespraech); Team-Nachricht erreicht den Kunden (frueher userId '[object Object]');
 *                 Gast-Nachricht und Gast-Antwort informieren das Team.
 *   [L] Client-API messages.ts: Inbox-Fehler werden geworfen (nicht als leere Liste verschluckt).
 *   [M] Review-Nachbesserungen: Reklamations-/Alt-Nachrichten nie dauerhaft "ungelesen";
 *                 abgeschlossene Auftraege/Reklamationen ohne "Antwort ausstehend"; von Personal
 *                 erledigte Aktionen zaehlen nicht als Kunden-Aktivitaet; clientMessageId-Dedupe pro
 *                 Absender+Typ (Rueckfrage wird nicht still verworfen); Gast-Antwort atomar und nur
 *                 mit angebotenen Optionen; Zaehler-Cache wird bei Schreiben/Lesen sofort geleert.
 *
 * MOCKS: NotificationService.createNotification und alle E-Mail-Funktionen zeichnen nur auf - keine
 * echte E-Mail, keine echte Benachrichtigung. Datei-Logs (server/logs) werden umgeleitet.
 *
 * Aufruf (nur WEGWERF-Datenbank):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_comms_central node test-comms-central.js
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

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_comms_central';

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
const LOG_REDIRECT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'comms-central-logs-'));
const redirectLogPath = (target) => {
  const text = typeof target === 'string' ? target : '';
  if (text && path.resolve(text).startsWith(LOG_DIR + path.sep)) {
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
const section = async (title, fn) => {
  console.log(`\n${title}`);
  try {
    await fn();
  } catch (error) {
    fail += 1;
    console.log(`  FAIL Abschnitt brach ab :: ${error && error.stack ? error.stack.split('\n').slice(0, 4).join(' | ') : error}`);
  }
};
const isGerman = (text) => /[äöüÄÖÜß]|Zugriff|Auftrag|Bitte|nicht|wurde|Nachricht|Rückfrage/.test(String(text || ''))
  && !/denied|not found|required|failed|successfully|Cast to|is not defined/i.test(String(text || ''));

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
  await mongoose.model('InspectionCommunication').syncIndexes();

  // ---- MOCKS ----
  const notifications = [];
  const emails = [];
  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  ['sendOrderConfirmationEmail', 'sendTriggerEmail', 'sendTemplateEmail', 'sendEmail', 'sendInvoiceEmail'].forEach((name) => {
    EmailService[name] = async (...args) => { emails.push({ name, args }); return { success: true, mocked: true }; };
  });
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data, options = {}) => {
    notifications.push({ ...data, userId: String(data.userId), options });
    return { _id: new mongoose.Types.ObjectId(), ...data };
  };
  const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));
  DHLService.createShipment = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };

  const app = express();
  app.use(express.json());
  app.use('/api/inspection-communication', require(path.join(SERVER_DIR, 'routes/inspectionCommunicationRoutes')));
  app.use('/api/communications', require(path.join(SERVER_DIR, 'routes/communicationInboxRoutes')));
  app.use('/api/admin/dashboard', require(path.join(SERVER_DIR, 'routes/adminDashboardRoutes')));
  app.use('/api/track-order', require(path.join(SERVER_DIR, 'routes/orderTrackingRoutes')));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const db = mongoose.connection.db;
  const oid = (value) => new mongoose.Types.ObjectId(String(value));
  const User = mongoose.model('User');
  const Complaint = mongoose.model('Complaint');

  const customerA = await User.create({ name: 'Kunde Anna', email: 'comms-a@test.invalid', role: 'customer' });
  const customerB = await User.create({ name: 'Kunde Bernd', email: 'comms-b@test.invalid', role: 'customer' });
  const staff = await User.create({ name: 'Sophie Team', email: 'comms-staff@test.invalid', role: 'staff' });
  const staff2 = await User.create({ name: 'Tom Team', email: 'comms-staff2@test.invalid', role: 'staff' });
  const admin = await User.create({ name: 'Admin Eins', email: 'comms-admin@test.invalid', role: 'admin' });
  const admin2 = await User.create({ name: 'Admin Zwei', email: 'comms-admin2@test.invalid', role: 'admin' });
  const inactiveAdmin = await User.create({ name: 'Admin Alt', email: 'comms-admin-old@test.invalid', role: 'admin', isActive: false });

  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, user, body) => {
    const headers = { 'Content-Type': 'application/json' };
    if (user) headers.Authorization = `Bearer ${tokenFor(user)}`;
    const response = await fetch(`${baseUrl}${url}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    let json = null;
    try { json = await response.json(); } catch (error) { json = null; }
    return { status: response.status, body: json };
  };

  let orderSeq = 0;
  const newOrder = async (customer, extra = {}) => {
    orderSeq += 1;
    const doc = {
      orderNumber: `ORD-T-${String(orderSeq).padStart(3, '0')}`,
      customerId: customer ? customer._id : null,
      deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
      errorDescription: 'Test', status: 'pending', assignedStaff: [], staffNotes: [],
      createdAt: new Date(), updatedAt: new Date(),
      ...extra,
    };
    const result = await db.collection('orders').insertOne(doc);
    return { ...doc, _id: result.insertedId };
  };
  const threadDocs = async (orderId) => db.collection('inspectioncommunications').find({ orderId: oid(orderId) }).toArray();
  const allMessages = async (orderId) => (await threadDocs(orderId)).flatMap((doc) => doc.messages || []);
  const inbox = async (user, query = '') => call('GET', `/api/communications/inbox${query ? `?${query}` : ''}`, user);
  const itemFor = (body, key) => (body?.items || []).find((item) => item.key === key);

  try {
    // ==============================================================================
    const orderA = await newOrder(customerA);
    const orderB = await newOrder(customerB);
    const orderAId = String(orderA._id);
    const orderBId = String(orderB._id);

    await section('[A] COMMS-1: Listen-Endpunkt und Postfach liefern den Thread (kein 500)', async () => {
      const sent = await call('POST', `/api/inspection-communication/${orderAId}/message`, staff, { content: 'Ihr Gerät ist angekommen.' });
      check(sent.status === 201, 'Team-Nachricht an Kunde A gespeichert (201)', sent.status);
      const legacyList = await call('GET', '/api/inspection-communication', customerA);
      check(legacyList.status === 200 && legacyList.body.communications.length === 1, 'GET /api/inspection-communication (Kunde) 200 mit 1 Thread', `${legacyList.status} ${legacyList.body?.error || legacyList.body?.communications?.length}`);
      const adminList = await call('GET', '/api/inspection-communication', admin);
      check(adminList.status === 200, 'GET /api/inspection-communication (Admin) 200', `${adminList.status} ${adminList.body?.error || ''}`);
      const box = await inbox(customerA);
      const item = itemFor(box.body, `order:${orderAId}`);
      check(box.status === 200 && item && /angekommen/.test(item.lastMessage?.preview || ''), 'Inbox Kunde A: Auftrag mit Vorschau', `${box.status} ${item?.title} ${item?.lastMessage?.preview}`);
      check(item?.threadUrl === `/messages?thread=order:${orderAId}` && item?.link === `/orders/${orderAId}`, 'Inbox-Eintrag: threadUrl und Link zum Auftrag', `${item?.threadUrl} ${item?.link}`);
      check(item?.customer === null, 'Kunde sieht keinen Kundenblock (nur Personal)', JSON.stringify(item?.customer));
    });

    // ==============================================================================
    await section('[B] COMMS-5 / ADMUX-11: Besitz- und Rollenpruefung am Auftrags-Thread', async () => {
      await call('POST', `/api/inspection-communication/${orderBId}/message`, staff, { content: 'Nachricht nur für Bernd' });
      const before = (await allMessages(orderBId)).length;

      const foreignGet = await call('GET', `/api/inspection-communication/${orderBId}`, customerA);
      check(foreignGet.status === 403 && isGerman(foreignGet.body?.error), 'fremder Kunde GET -> 403 deutsch', `${foreignGet.status} ${foreignGet.body?.error}`);
      check(!JSON.stringify(foreignGet.body || {}).includes('Bernd'), 'fremder Kunde: kein fremder Inhalt in der Antwort', JSON.stringify(foreignGet.body).slice(0, 120));
      const foreignPost = await call('POST', `/api/inspection-communication/${orderBId}/message`, customerA, { content: 'Einbruch' });
      check(foreignPost.status === 403, 'fremder Kunde POST message -> 403', foreignPost.status);
      check((await allMessages(orderBId)).length === before, 'DB unveraendert nach fremdem POST', before);
      const unknown = await call('GET', `/api/inspection-communication/${new mongoose.Types.ObjectId()}`, customerA);
      const invalid = await call('GET', '/api/inspection-communication/kein-objectid', customerA);
      check(unknown.status === 403 && invalid.status === 403, 'unbekannte/ungueltige ID fuer Kunden ebenfalls 403', `${unknown.status}/${invalid.status}`);
      const foreignMarkRead = await call('PUT', `/api/inspection-communication/${orderBId}/mark-read`, customerA);
      check(foreignMarkRead.status === 403, 'fremder Kunde mark-read -> 403', foreignMarkRead.status);

      const custFeedbackReq = await call('POST', `/api/inspection-communication/${orderAId}/feedback-request`, customerA, {
        question: 'Fake?', options: [{ label: 'Ja', value: 'ja' }, { label: 'Nein', value: 'nein' }],
      });
      check(custFeedbackReq.status === 403, 'Kunde (Eigentuemer) darf keine Rueckfrage anlegen -> 403', custFeedbackReq.status);
      const custQuick = await call('POST', `/api/inspection-communication/${orderAId}/quick-action`, customerA, { actionType: 'additional_costs', description: 'x' });
      check(custQuick.status === 403, 'Kunde darf keine Aktion anlegen -> 403', custQuick.status);

      const counts = await call('POST', '/api/inspection-communication/unread-counts', customerA, { orderIds: [orderBId, orderAId] });
      check(counts.status === 200 && !counts.body.unreadCounts[orderBId], 'unread-counts: fremder Auftrag wird fuer Kunde A ignoriert', JSON.stringify(counts.body?.unreadCounts));
      check(counts.body.unreadCounts[orderAId]?.unread === 1, 'unread-counts: eigener Auftrag zaehlt die Team-Nachricht', JSON.stringify(counts.body?.unreadCounts?.[orderAId]));

      const ownerGet = await call('GET', `/api/inspection-communication/${orderAId}`, customerA);
      check(ownerGet.status === 200 && ownerGet.body.communication?.messages?.length >= 1, 'Eigentuemer GET -> 200', ownerGet.status);
      const staffGet = await call('GET', `/api/inspection-communication/${orderBId}`, staff2);
      check(staffGet.status === 200, 'Personal GET fremder Auftrag -> 200', staffGet.status);

      // Strukturierte Rueckfrage: nur der Kunde antwortet, genau einmal.
      const fr = await call('POST', `/api/inspection-communication/${orderAId}/feedback-request`, staff, {
        question: 'Dürfen wir das Display tauschen?', options: [{ label: 'Ja', value: 'ja' }, { label: 'Nein', value: 'nein' }],
      });
      check(fr.status === 201, 'Personal legt Rueckfrage an (201)', fr.status);
      const frMessage = fr.body.communication.messages.find((m) => m.messageType === 'feedback_request');
      const staffAnswer = await call('POST', `/api/inspection-communication/${orderAId}/feedback-response`, admin, { messageId: frMessage._id, response: { label: 'Ja', value: 'ja' } });
      check(staffAnswer.status === 403 && isGerman(staffAnswer.body?.error), 'Personal darf nicht im Namen des Kunden antworten -> 403', `${staffAnswer.status} ${staffAnswer.body?.error}`);
      const foreignAnswer = await call('POST', `/api/inspection-communication/${orderAId}/feedback-response`, customerB, { messageId: frMessage._id, response: { label: 'Ja', value: 'ja' } });
      check(foreignAnswer.status === 403, 'fremder Kunde antwortet -> 403', foreignAnswer.status);
      const first = await call('POST', `/api/inspection-communication/${orderAId}/feedback-response`, customerA, { messageId: frMessage._id, response: { label: 'Ja', value: 'ja' } });
      check(first.status === 200, 'Eigentuemer antwortet -> 200', first.status);
      const pendingAfterFirst = (await threadDocs(orderAId))[0].pendingFeedbackCount;
      const second = await call('POST', `/api/inspection-communication/${orderAId}/feedback-response`, customerA, { messageId: frMessage._id, response: { label: 'Nein', value: 'nein' } });
      const storedFr = (await allMessages(orderAId)).find((m) => String(m._id) === String(frMessage._id));
      check(second.status === 409 && isGerman(second.body?.error), 'zweite Antwort -> 409 deutsch', `${second.status} ${second.body?.error}`);
      check(storedFr.feedbackRequest.response.value === 'ja' && (await threadDocs(orderAId))[0].pendingFeedbackCount === pendingAfterFirst && pendingAfterFirst === 0,
        'erste Antwort bleibt, pendingFeedbackCount nicht doppelt gesenkt', `${storedFr.feedbackRequest.response.value} ${pendingAfterFirst}`);
    });

    // ==============================================================================
    await section('[C] COMMS-9: interne Notiz nur fuer das Team', async () => {
      const notifBefore = notifications.length;
      const emailsBefore = emails.length;
      const assignedBefore = JSON.stringify((await db.collection('orders').findOne({ _id: orderA._id })).assignedStaff || []);
      const custTry = await call('POST', `/api/inspection-communication/${orderAId}/internal-note`, customerA, { note: 'Kunde will intern schreiben' });
      check(custTry.status === 403, 'Kunde darf keine interne Notiz speichern -> 403', custTry.status);
      const clientId = `note-${crypto.randomUUID()}`;
      const saved = await call('POST', `/api/inspection-communication/${orderAId}/internal-note`, staff, { note: 'INTERN: Kunde schwierig, Kulanz prüfen', clientMessageId: clientId });
      check(saved.status === 201 && saved.body.internalNote?.visibility === 'internal', 'Personal speichert interne Notiz (201)', `${saved.status} ${saved.body?.error || ''}`);
      const repeat = await call('POST', `/api/inspection-communication/${orderAId}/internal-note`, staff, { note: 'INTERN: Kunde schwierig, Kulanz prüfen', clientMessageId: clientId });
      const storedOrder = await db.collection('orders').findOne({ _id: orderA._id });
      const internal = (storedOrder.staffNotes || []).filter((note) => note.type === 'internal');
      check(repeat.status === 200 && repeat.body.created === false && internal.length === 1, 'Wiederholung derselben Notiz: 200, genau 1 Eintrag in Order.staffNotes', `${repeat.status} ${internal.length}`);
      check(JSON.stringify(storedOrder.assignedStaff || []) === assignedBefore, 'keine automatische Mitarbeiterzuweisung', JSON.stringify(storedOrder.assignedStaff));
      check(notifications.length === notifBefore && emails.length === emailsBefore, 'keine Benachrichtigung / keine E-Mail', `${notifications.length - notifBefore}/${emails.length - emailsBefore}`);
      check((await allMessages(orderAId)).every((m) => !/INTERN/.test(m.content)), 'Notiz steht NICHT im Kunden-Thread', 'ok');

      const custGet = await call('GET', `/api/inspection-communication/${orderAId}`, customerA);
      check(custGet.status === 200 && !('internalNotes' in custGet.body) && !JSON.stringify(custGet.body).includes('Kulanz'), 'Kunden-GET enthaelt keine interne Notiz', Object.keys(custGet.body).join(','));
      const custInbox = await inbox(customerA);
      check(!JSON.stringify(custInbox.body).includes('Kulanz') && !('internalNotesCount' in (itemFor(custInbox.body, `order:${orderAId}`) || {})), 'Kunden-Inbox enthaelt keine interne Notiz', 'ok');
      const staffGet = await call('GET', `/api/inspection-communication/${orderAId}`, staff2);
      check((staffGet.body.internalNotes || []).some((n) => /Kulanz/.test(n.note) && n.staffName === 'Sophie Team'), 'Personal-GET enthaelt die interne Notiz', JSON.stringify(staffGet.body.internalNotes).slice(0, 120));
      const staffInbox = await inbox(admin);
      check(itemFor(staffInbox.body, `order:${orderAId}`)?.internalNotesCount === 1, 'Personal-Inbox zeigt Anzahl interner Notizen', itemFor(staffInbox.body, `order:${orderAId}`)?.internalNotesCount);
    });

    // ==============================================================================
    await section('[D] COMMS-11: Doppelklick / Retry / parallele erste Nachricht', async () => {
      const order = await newOrder(customerA);
      const id = String(order._id);
      await call('POST', `/api/inspection-communication/${id}/message`, staff, { content: 'Start' });
      const notifBefore = notifications.length;
      const clientMessageId = `msg-${crypto.randomUUID()}`;
      const results = await Promise.all([1, 2, 3, 4].map(() => call('POST', `/api/inspection-communication/${id}/message`, customerA, { content: 'Bitte zurückrufen', clientMessageId })));
      const msgs = (await allMessages(id)).filter((m) => m.content === 'Bitte zurückrufen');
      check(msgs.length === 1, '4 parallele POST mit gleicher clientMessageId -> genau 1 Nachricht', `${msgs.length} (${results.map((r) => r.status).join(',')})`);
      check(results.filter((r) => r.status === 201).length === 1 && results.filter((r) => r.status === 200).length === 3, 'genau eine 201, Wiederholungen 200', results.map((r) => r.status).join(','));
      check(notifications.length - notifBefore === 2, 'genau eine Benachrichtigungsrunde (2 aktive Admins, nicht 4x)', notifications.length - notifBefore);

      const fresh = await newOrder(customerA);
      const freshId = String(fresh._id);
      await Promise.all([1, 2, 3, 4, 5].map((n) => call('POST', `/api/inspection-communication/${freshId}/message`, staff, { content: `Erste ${n}`, clientMessageId: `first-${n}-${crypto.randomUUID()}` })));
      const docs = await threadDocs(freshId);
      check(docs.length === 1 && docs[0].messages.length === 5, '5 parallele erste Nachrichten -> 1 Thread-Dokument mit 5 Nachrichten', `${docs.length} docs, ${docs[0]?.messages?.length} msgs`);
    });

    // ==============================================================================
    await section('[E] COMMS-10: Lese-Regel pro Benutzer, "Antwort ausstehend" teamweit', async () => {
      const order = await newOrder(customerB);
      const id = String(order._id);
      const key = `order:${id}`;
      await call('POST', `/api/inspection-communication/${id}/message`, customerB, { content: 'Wann ist mein Gerät fertig?' });
      let a1 = itemFor((await inbox(admin)).body, key);
      let a2 = itemFor((await inbox(admin2)).body, key);
      check(a1?.unreadCount === 1 && a2?.unreadCount === 1 && a1.awaitingReply === true, 'Kundennachricht: Admin1=1, Admin2=1 ungelesen, Antwort ausstehend', `${a1?.unreadCount}/${a2?.unreadCount}/${a1?.awaitingReply}`);
      const read = await call('PUT', `/api/communications/order/${id}/read`, admin);
      check(read.status === 200, 'Admin1 markiert gelesen (PUT /api/communications/order/:id/read)', read.status);
      a1 = itemFor((await inbox(admin)).body, key);
      a2 = itemFor((await inbox(admin2)).body, key);
      check(a1?.unreadCount === 0 && a2?.unreadCount === 1 && a1.awaitingReply === true, 'nach Lesen: Admin1=0, Admin2 weiter 1, Antwort weiter ausstehend', `${a1?.unreadCount}/${a2?.unreadCount}/${a1?.awaitingReply}`);
      await call('POST', `/api/inspection-communication/${id}/internal-note`, staff, { note: 'nur intern' });
      a1 = itemFor((await inbox(admin)).body, key);
      check(a1?.awaitingReply === true, 'interne Notiz beendet "Antwort ausstehend" NICHT', a1?.awaitingReply);
      await call('POST', `/api/inspection-communication/${id}/message`, staff, { content: 'Morgen ist es fertig.' });
      a1 = itemFor((await inbox(admin)).body, key);
      check(a1?.awaitingReply === false, 'Team-Antwort beendet "Antwort ausstehend"', a1?.awaitingReply);
      const s2 = itemFor((await inbox(staff2)).body, key);
      check(s2?.unreadCount === 1, 'Staff2: Nachricht von Sophie (Staff) zaehlt NICHT, nur die Kundennachricht', s2?.unreadCount);
      const staffCounts = await call('POST', '/api/inspection-communication/unread-counts', staff2, { orderIds: [id] });
      check(staffCounts.body.unreadCounts[id]?.unread === 1 && staffCounts.body.unreadCounts[id]?.senderType === 'customer', 'unread-counts (Badges) nutzt dieselbe Regel', JSON.stringify(staffCounts.body.unreadCounts[id]));
      let cust = itemFor((await inbox(customerB)).body, key);
      check(cust?.unreadCount === 1, 'Kunde: Team-Antwort ungelesen (eigene Nachricht zaehlt nicht)', cust?.unreadCount);
      await call('PUT', `/api/communications/order/${id}/read`, customerB);
      cust = itemFor((await inbox(customerB)).body, key);
      check(cust?.unreadCount === 0, 'Kunde liest -> 0', cust?.unreadCount);
      const foreignRead = await call('PUT', `/api/communications/order/${id}/read`, customerA);
      check(foreignRead.status === 403, 'fremder Kunde PUT read -> 403', foreignRead.status);
      const unread = await inbox(admin2, 'filter=unread');
      check((unread.body.items || []).every((item) => item.unreadCount > 0) && itemFor(unread.body, key), 'Filter "Ungelesen" liefert nur ungelesene Gespraeche', unread.body.items?.length);
    });

    // ==============================================================================
    await section('[K] COMMS-15: Benachrichtigungen', async () => {
      const order = await newOrder(customerA);
      const id = String(order._id);
      notifications.length = 0;
      await call('POST', `/api/inspection-communication/${id}/message`, customerA, { content: 'Hallo Team' });
      const recipients = notifications.map((n) => n.userId).sort();
      check(recipients.length === 2 && recipients.includes(String(admin._id)) && recipients.includes(String(admin2._id)) && !recipients.includes(String(inactiveAdmin._id)),
        'ohne Zuweisung: alle AKTIVEN Admins benachrichtigt', recipients.join(','));
      check(notifications.every((n) => n.title === 'Neue Kundennachricht' && n.actionUrl === `/messages?thread=order:${id}`), 'deutscher Titel und Link auf das Gespraech', `${notifications[0]?.title} ${notifications[0]?.actionUrl}`);

      const assigned = await newOrder(customerA, { assignedStaff: [{ staffId: staff._id, assignedAt: new Date() }] });
      notifications.length = 0;
      await call('POST', `/api/inspection-communication/${assigned._id}/message`, customerA, { content: 'An Sophie' });
      check(notifications.length === 1 && notifications[0].userId === String(staff._id), 'mit Zuweisung: nur der zugewiesene Mitarbeiter', notifications.map((n) => n.userId).join(','));

      notifications.length = 0;
      await call('POST', `/api/inspection-communication/${id}/message`, staff, { content: 'Antwort vom Team' });
      check(notifications.length === 1 && notifications[0].userId === String(customerA._id) && notifications[0].options.forceEmail === true && notifications[0].actionUrl === `/orders/${id}`,
        'Team-Nachricht erreicht den Kunden (echte userId, E-Mail erzwungen, Link Auftrag)', `${notifications[0]?.userId} ${notifications[0]?.options?.forceEmail}`);

      // Gast-Auftrag ueber Tracking-Link
      const guestOrder = await newOrder(null, { guestInfo: { email: 'gast@test.invalid', firstName: 'Gerd', lastName: 'Gast', isGuest: true } });
      const bookingToken = crypto.randomBytes(16).toString('hex');
      await db.collection('bookings').insertOne({ bookingNumber: 'BKG-T-0001', guestTrackingToken: bookingToken, guestInfo: { email: 'gast@test.invalid' }, orderIds: [guestOrder._id] });
      await db.collection('orders').updateOne({ _id: guestOrder._id }, { $set: { bookingId: (await db.collection('bookings').findOne({ bookingNumber: 'BKG-T-0001' }))._id } });
      const gid = String(guestOrder._id);
      await call('POST', `/api/inspection-communication/${gid}/message`, staff, { content: 'Hallo Gast' });
      notifications.length = 0;
      const guestClientId = `guest-${crypto.randomUUID()}`;
      const g1 = await call('POST', `/api/track-order/booking/${gid}/communication/message`, null, { token: bookingToken, email: 'gast@test.invalid', content: 'Danke, Gast hier', clientMessageId: guestClientId });
      const g2 = await call('POST', `/api/track-order/booking/${gid}/communication/message`, null, { token: bookingToken, email: 'gast@test.invalid', content: 'Danke, Gast hier', clientMessageId: guestClientId });
      const guestMsgs = (await allMessages(gid)).filter((m) => m.content === 'Danke, Gast hier');
      check(g1.status === 201 && g2.status === 200 && guestMsgs.length === 1 && guestMsgs[0].senderRole === 'guest', 'Gastnachricht: gespeichert, Wiederholung idempotent', `${g1.status}/${g2.status} ${guestMsgs.length}`);
      check(notifications.length === 2 && notifications.every((n) => n.title === 'Neue Kundennachricht'), 'Gastnachricht benachrichtigt das Team (alle aktiven Admins)', notifications.length);
      const wrongGuest = await call('POST', `/api/track-order/booking/${orderAId}/communication/message`, null, { token: bookingToken, email: 'gast@test.invalid', content: 'fremd' });
      check(wrongGuest.status >= 400 && wrongGuest.status < 500, 'Gast-Token gilt nicht fuer fremden Auftrag', wrongGuest.status);
      const gItem = itemFor((await inbox(admin)).body, `order:${gid}`);
      check(gItem?.awaitingReply === true && gItem?.unreadCount === 1 && gItem?.customer?.isGuest === true, 'Gastnachricht im Postfach: ungelesen + Antwort ausstehend + Gast', `${gItem?.unreadCount}/${gItem?.awaitingReply}/${gItem?.customer?.isGuest}`);

      const gfr = await call('POST', `/api/inspection-communication/${gid}/feedback-request`, staff, { question: 'Akku tauschen?', options: [{ label: 'Ja', value: 'ja' }, { label: 'Nein', value: 'nein' }] });
      const gfrMsg = gfr.body.communication.messages.find((m) => m.messageType === 'feedback_request');
      notifications.length = 0;
      const gAnswer = await call('POST', `/api/track-order/booking/${gid}/communication/feedback-response`, null, { token: bookingToken, email: 'gast@test.invalid', messageId: gfrMsg._id, response: { label: 'Ja', value: 'ja' } });
      check(gAnswer.status === 200 && notifications.length === 2 && notifications[0].title === 'Kunde hat eine Rückfrage beantwortet', 'Gast-Antwort auf Rueckfrage informiert das Team', `${gAnswer.status} ${notifications.length} ${notifications[0]?.title}`);
    });

    // ==============================================================================
    await section('[J] COMMS-13: inspectionId wird serverseitig geprueft', async () => {
      const order = await newOrder(customerA);
      const id = String(order._id);
      await call('POST', `/api/inspection-communication/${id}/feedback-request`, staff, {
        inspectionId: id, question: 'Frage ohne Inspektion?', options: [{ label: 'Ja', value: 'ja' }, { label: 'Nein', value: 'nein' }],
      });
      let doc = (await threadDocs(id))[0];
      check(!doc.inspectionId, 'orderId als inspectionId wird verworfen (keine Inspektion -> null)', String(doc.inspectionId));
      const order2 = await newOrder(customerA);
      const id2 = String(order2._id);
      const inspection = await db.collection('deviceinspections').insertOne({ orderId: order2._id, createdAt: new Date() });
      await call('POST', `/api/inspection-communication/${id2}/quick-action`, staff, { inspectionId: id2, actionType: 'additional_costs', description: 'Mehrkosten 20 €' });
      doc = (await threadDocs(id2))[0];
      check(String(doc.inspectionId) === String(inspection.insertedId), 'falsche ID -> echte DeviceInspection des Auftrags gespeichert', `${doc.inspectionId}`);
      const foreignInspection = await db.collection('deviceinspections').insertOne({ orderId: orderB._id, createdAt: new Date() });
      const order3 = await newOrder(customerA);
      await call('POST', `/api/inspection-communication/${order3._id}/feedback-request`, staff, {
        inspectionId: String(foreignInspection.insertedId), question: 'Fremde Inspektion?', options: [{ label: 'Ja', value: 'ja' }, { label: 'Nein', value: 'nein' }],
      });
      doc = (await threadDocs(order3._id))[0];
      check(!doc.inspectionId, 'Inspektion eines ANDEREN Auftrags wird nicht uebernommen', String(doc.inspectionId));
    });

    // ==============================================================================
    await section('[F] COMMS-3: serverseitige Paginierung, Suche, Dashboard-Zaehler', async () => {
      const bulkCustomer = await User.create({ name: 'Viel Schreiber', email: 'comms-bulk@test.invalid', role: 'customer' });
      const base = Date.now() - 100 * 24 * 3600 * 1000;
      for (let i = 0; i < 60; i += 1) {
        const order = await newOrder(bulkCustomer, { orderNumber: `ORD-P-${String(i).padStart(3, '0')}` });
        await db.collection('inspectioncommunications').insertOne({
          orderId: order._id, status: 'active', pendingFeedbackCount: 0, pendingActionsCount: 0,
          lastMessageAt: new Date(base + i * 60000), createdAt: new Date(base), updatedAt: new Date(base),
          messages: [{ _id: new mongoose.Types.ObjectId(), senderId: bulkCustomer._id, senderType: 'customer', senderName: 'Viel Schreiber', messageType: 'text', content: `Bulk ${i}`, readBy: [], createdAt: new Date(base + i * 60000) }],
        });
      }
      const all = await inbox(bulkCustomer, 'limit=25');
      check(all.status === 200 && all.body.totalCount === 60 && all.body.totalPages === 3 && all.body.items.length === 25, 'Kunde mit 60 Threads: totalCount 60, 3 Seiten', `${all.body.totalCount}/${all.body.totalPages}/${all.body.items?.length}`);
      const page3 = await inbox(bulkCustomer, 'limit=25&page=3');
      check(page3.body.items.length === 10 && page3.body.items.some((item) => item.reference.orderNumber === 'ORD-P-000'), 'Seite 3 enthaelt den aeltesten Thread ORD-P-000', page3.body.items.map((item) => item.reference.orderNumber).slice(-2).join(','));
      const capped = await inbox(bulkCustomer, 'limit=500');
      check(capped.body.limit === 50 && capped.body.items.length === 50 && capped.body.hasMore === true, 'limit wird auf 50 begrenzt, hasMore zeigt weitere Seiten', `${capped.body.limit}/${capped.body.hasMore}`);
      const search = await inbox(admin, 'q=ORD-P-005');
      check(search.body.totalCount === 1 && search.body.items[0].reference.orderNumber === 'ORD-P-005', 'Serversuche nach Auftragsnummer', `${search.body.totalCount} ${search.body.items?.[0]?.reference?.orderNumber}`);
      const byCustomer = await inbox(admin, 'q=Viel%20Schreiber&limit=50');
      check(byCustomer.body.totalCount === 60, 'Serversuche nach Kundenname (Personal)', byCustomer.body.totalCount);
      const byBooking = await inbox(admin, 'q=BKG-T-0001');
      check(byBooking.body.totalCount === 1 && byBooking.body.items[0].reference.bookingNumber === 'BKG-T-0001', 'Serversuche nach Buchungsnummer', byBooking.body.totalCount);

      const summary = await call('GET', '/api/communications/summary', admin);
      const adminInbox = await inbox(admin);
      check(summary.status === 200 && summary.body.unread === adminInbox.body.counts.unread && summary.body.awaitingReply === adminInbox.body.counts.awaitingReply,
        'Zusammenfassung == Postfach-Zaehler', `${summary.body.unread}/${adminInbox.body.counts.unread} ${summary.body.awaitingReply}/${adminInbox.body.counts.awaitingReply}`);
      check(summary.body.unread >= 61, 'alle 60+ ungelesenen Threads gezaehlt (keine 100er-Grenze pro Quelle noetig)', summary.body.unread);
      const dashboard = await call('GET', '/api/admin/dashboard/customer-messages?limit=5', admin);
      check(dashboard.status === 200 && dashboard.body.totalUnread === summary.body.unread && dashboard.body.awaitingReply === summary.body.awaitingReply,
        'Dashboard-Zaehler == Postfach-Zaehler', `${dashboard.body.totalUnread}/${dashboard.body.awaitingReply}`);
      check(dashboard.body.messages.length === 5 && dashboard.body.messages.every((m) => /^\/messages\?thread=(order|repair_request|complaint|contact):[a-f0-9]{24}$/.test(m.navigateTo)),
        'Dashboard-Eintraege oeffnen das Gespraech im Postfach', dashboard.body.messages[0]?.navigateTo);
      const staffDashboard = await call('GET', '/api/admin/dashboard/customer-messages', staff);
      check(staffDashboard.status === 403, 'Dashboard-Endpunkt bleibt Admin-only', staffDashboard.status);
      const staffSummary = await call('GET', '/api/communications/summary', staff);
      check(staffSummary.status === 200 && typeof staffSummary.body.unread === 'number', 'Zusammenfassung auch fuer Personal (Seitenleiste)', staffSummary.body.unread);
    });

    // ==============================================================================
    let complaintId;
    let rrId;
    await section('[G] COMMS-4 / COMMS-12: alle Quellen, Filter, Sichtbarkeit', async () => {
      // Reparaturanfrage mit neuem Thread + Alt-Nachricht
      const rr = await db.collection('repairrequests').insertOne({
        requestNumber: 'RR-T-0001', customerId: customerA._id, customerName: 'Kunde Anna', customerEmail: 'comms-a@test.invalid',
        deviceType: 'Smartphone', deviceBrand: 'Samsung', deviceModel: 'S24', status: 'pending', adminNotes: [{ staffId: staff._id, staffName: 'Sophie', note: 'RR-INTERN', createdAt: new Date() }],
        messages: [{ _id: new mongoose.Types.ObjectId(), senderId: staff._id, senderName: 'Sophie Alt', senderRole: 'staff', message: 'Alte Nachricht aus dem Dialog', sentAt: new Date('2026-09-01T10:00:00Z'), isRead: false }],
        createdAt: new Date(), updatedAt: new Date(),
      });
      rrId = String(rr.insertedId);
      await db.collection('repairrequestcommunications').insertOne({
        repairRequestId: rr.insertedId, status: 'active', lastMessageAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
        messages: [{ _id: new mongoose.Types.ObjectId(), senderId: { name: 'Kunde Anna' }, senderUserId: customerA._id, senderType: 'customer', senderName: 'Kunde Anna', messageType: 'text', content: 'Was kostet das?', readBy: [], createdAt: new Date() }],
      });
      // Reklamation mit interner und oeffentlicher Antwort
      const complaint = await Complaint.create({
        complaintNumber: 'CMP-T-0001', customerId: customerA._id, orderId: orderA._id, subject: 'Display flackert', description: 'x', category: 'quality',
        comments: [
          { userId: customerA._id, userName: 'Kunde Anna', userRole: 'customer', comment: 'Das Display flackert wieder', createdAt: new Date(Date.now() - 2000) },
          { userId: staff._id, userName: 'Sophie Team', userRole: 'staff', comment: 'GEHEIM: Sturzschaden vermutet', isInternal: true, createdAt: new Date(Date.now() - 1000) },
        ],
      });
      complaintId = String(complaint._id);
      // Kontaktanfrage (nur Admin)
      await db.collection('contactmessages').insertOne({ name: 'Interessent', email: 'kontakt@test.invalid', subject: 'repair', message: 'Reparieren Sie auch Tablets?', status: 'new', replies: [], isSpam: false, createdAt: new Date(), updatedAt: new Date() });

      const custAll = await inbox(customerA, 'limit=50');
      const sources = new Set((custAll.body.items || []).map((item) => item.sourceType));
      check(sources.has('order') && sources.has('repair_request') && sources.has('complaint') && !sources.has('contact'), 'Kunde A: Auftraege, Reparaturanfrage, Reklamation - keine Kontaktanfragen', [...sources].join(','));
      check(!(custAll.body.availableSources || []).some((s) => s.source === 'contact'), 'Kunde: Quelle Kontaktanfragen nicht verfuegbar', JSON.stringify(custAll.body.availableSources));
      check(!JSON.stringify(custAll.body).includes('GEHEIM') && !JSON.stringify(custAll.body).includes('RR-INTERN'), 'Kunde: kein interner Reklamations-/Anfragetext in der Inbox', 'ok');
      check((custAll.body.items || []).every((item) => item.key !== `order:${orderBId}`), 'Kunde A sieht keine Threads von Kunde B', 'ok');
      const custComplaint = itemFor(custAll.body, `complaint:${complaintId}`);
      check(custComplaint?.link === `/my-complaints/${complaintId}` && /flackert/.test(custComplaint?.lastMessage?.preview || ''), 'Reklamation: Link und Vorschau (oeffentlicher Kommentar)', `${custComplaint?.link} ${custComplaint?.lastMessage?.preview}`);
      const onlyComplaints = await inbox(customerA, 'source=complaint');
      check(onlyComplaints.body.items.length === 1 && onlyComplaints.body.items[0].sourceType === 'complaint', 'Filter source=complaint', onlyComplaints.body.items.map((i) => i.sourceType).join(','));
      // K03-CHIPS: availableSources bleibt bei aktivem Quellenfilter vollstaendig (Chips wechseln direkt)
      const filteredSources = (onlyComplaints.body.availableSources || []).map((s) => s.source).join(',');
      check(filteredSources === (custAll.body.availableSources || []).map((s) => s.source).join(',') && filteredSources === 'order,repair_request,complaint',
        'K03-CHIPS: availableSources bei source=complaint unveraendert (alle sichtbaren Quellen)', filteredSources);
      const custRr = itemFor(custAll.body, `repair_request:${rrId}`);
      check(custRr?.link === `/my-repair-requests?requestId=${rrId}` && custRr?.legacyMessageCount === 1, 'Reparaturanfrage: Kundenlink mit requestId, Alt-Nachricht gezaehlt', `${custRr?.link} ${custRr?.legacyMessageCount}`);

      const custThread = await call('GET', `/api/communications/thread/complaint/${complaintId}`, customerA);
      check(custThread.status === 200 && custThread.body.thread.messages.length === 1 && !JSON.stringify(custThread.body).includes('GEHEIM'), 'Kunden-Thread Reklamation ohne internen Kommentar', custThread.body?.thread?.messages?.length);
      const staffThread = await call('GET', `/api/communications/thread/complaint/${complaintId}`, staff);
      check(staffThread.body.thread.messages.some((m) => m.isInternal && /GEHEIM/.test(m.content)), 'Personal-Thread Reklamation mit internem Kommentar (markiert)', staffThread.body.thread.messages.length);
      const foreignThread = await call('GET', `/api/communications/thread/complaint/${complaintId}`, customerB);
      check(foreignThread.status === 403, 'fremder Kunde Reklamations-Thread -> 403', foreignThread.status);
      const legacy = await call('GET', `/api/communications/thread/repair_request/${rrId}`, customerA);
      const legacyMsg = legacy.body?.thread?.messages?.[0];
      check(legacy.status === 200 && legacyMsg?.senderName === 'Sophie Alt' && new Date(legacyMsg.createdAt).toISOString() === '2026-09-01T10:00:00.000Z' && legacyMsg.legacy === true,
        'Alt-Nachricht RepairRequest.messages mit Autor und Originalzeit lesbar', `${legacyMsg?.senderName} ${legacyMsg?.createdAt}`);

      const staffAll = await inbox(staff, 'limit=50');
      check(!(staffAll.body.items || []).some((item) => item.sourceType === 'contact'), 'Mitarbeiter (nicht Admin): keine Kontaktanfragen', 'ok');
      const staffComplaint = itemFor(staffAll.body, `complaint:${complaintId}`);
      check(staffComplaint?.lastMessage?.kind === 'internal' && staffComplaint?.awaitingReply === true && staffComplaint?.link === null,
        'Personal: Vorschau "intern", Antwort ausstehend (interne Notiz zaehlt nicht), kein Admin-Link fuer Staff', `${staffComplaint?.lastMessage?.kind}/${staffComplaint?.awaitingReply}/${staffComplaint?.link}`);
      const adminContacts = await inbox(admin, 'source=contact');
      check(adminContacts.body.items.length === 1 && adminContacts.body.items[0].unreadCount === 1 && adminContacts.body.items[0].canReply === false && adminContacts.body.items[0].link === '/admin/contact-requests',
        'Admin: Kontaktanfrage nur lesend mit Link', `${adminContacts.body.items.length} ${adminContacts.body.items[0]?.link}`);
      // K03-SUBJECT: Betreff als deutsches Label (Titel + Vorschau), unbekannter Wert bleibt roh
      const contactItem = adminContacts.body.items[0];
      check(contactItem?.title === 'Kontaktanfrage · Reparatur' && /^\[Reparatur\] /.test(contactItem?.lastMessage?.preview || ''),
        'K03-SUBJECT: Titel/Vorschau mit deutschem Betreff', `${contactItem?.title} | ${contactItem?.lastMessage?.preview}`);
      check((adminContacts.body.availableSources || []).map((s) => s.source).join(',') === 'order,repair_request,complaint,contact',
        'K03-CHIPS: Admin bei source=contact sieht alle Quellen-Chips', (adminContacts.body.availableSources || []).map((s) => s.source).join(','));
      const legacyContact = await db.collection('contactmessages').insertOne({ messageNumber: 'CM-T-ALT', name: 'Alt', email: 'alt@test.invalid', subject: 'altwert', message: 'Alter Betreff', status: 'read', replies: [], isSpam: false, createdAt: new Date(), updatedAt: new Date() });
      const legacyContactItem = itemFor((await inbox(admin, 'source=contact')).body, `contact:${legacyContact.insertedId}`);
      check(legacyContactItem?.title === 'Kontaktanfrage · altwert' && /^\[altwert\] /.test(legacyContactItem?.lastMessage?.preview || ''),
        'K03-SUBJECT: unbekannter Betreff bleibt unveraendert', `${legacyContactItem?.title} | ${legacyContactItem?.lastMessage?.preview}`);
      await db.collection('contactmessages').deleteOne({ _id: legacyContact.insertedId });
      const adminRr = itemFor((await inbox(admin, 'source=repair_request')).body, `repair_request:${rrId}`);
      check(adminRr?.link === `/admin/repair-requests?requestId=${rrId}` && adminRr?.unreadCount === 1, 'Admin: Reparaturanfrage mit Deep-Link requestId und ungelesen', `${adminRr?.link} ${adminRr?.unreadCount}`);
    });

    // ==============================================================================
    await section('[H] COMMS-2: fehlerhafte Quelle wird gemeldet, nicht als leer', async () => {
      const originalFind = Complaint.find;
      Complaint.find = () => { throw new Error('Simulierter DB-Fehler'); };
      try {
        const res = await inbox(customerA, 'limit=50');
        check(res.status === 200 && res.body.partial === true && res.body.sourceErrors.length === 1 && res.body.sourceErrors[0].source === 'complaint' && isGerman(res.body.sourceErrors[0].message),
          'Inbox: 200 + sourceErrors[complaint] deutsch', JSON.stringify(res.body.sourceErrors));
        check(res.body.items.some((item) => item.sourceType === 'order'), 'andere Quellen werden weiter angezeigt', res.body.items.length);
        const sum = await call('GET', '/api/communications/summary', customerA);
        check(sum.status === 200 && sum.body.partial === true && sum.body.sourceErrors[0]?.source === 'complaint', 'Zusammenfassung meldet den Quellenfehler ebenfalls', JSON.stringify(sum.body.sourceErrors));
      } finally {
        Complaint.find = originalFind;
      }
    });

    // ==============================================================================
    await section('[I] COMMS-14: Regex-Sonderzeichen in der Suche', async () => {
      for (const q of ['(', '[', '*', 'ORD-(P']) {
        const res = await inbox(admin, `q=${encodeURIComponent(q)}`);
        check(res.status === 200 && res.body.partial === false, `Inbox q=${q} -> 200 ohne Quellenfehler`, `${res.status} ${JSON.stringify(res.body?.sourceErrors)}`);
      }
      const legacyList = await call('GET', `/api/inspection-communication?search=${encodeURIComponent('(')}`, admin);
      check(legacyList.status === 200, 'GET /api/inspection-communication?search=( -> 200', legacyList.status);
    });

    // ==============================================================================
    await section('[L] Client-API messages.ts: Fehler werden nicht verschluckt', async () => {
      const calls = [];
      const apiStub = {
        get: async (url, config) => { calls.push({ url, config }); if (url.includes('fail')) throw Object.assign(new Error('x'), { response: { data: { error: 'Nachrichten konnten nicht geladen werden.' } } }); return { data: { success: true, items: [], counts: {} } }; },
        put: async (url) => { calls.push({ url }); return { data: { success: true } }; },
        post: async () => ({ data: {} }),
      };
      const source = fs.readFileSync(path.join(CLIENT_DIR, 'src/api/messages.ts'), 'utf8');
      const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
      const mod = { exports: {} };
      // eslint-disable-next-line no-new-func
      new Function('exports', 'require', 'module', outputText)(mod.exports, (request) => {
        if (request === './api') return { __esModule: true, default: apiStub };
        throw new Error(`Unerwarteter Import: ${request}`);
      }, mod);
      const api = mod.exports;
      check(typeof api.getInbox === 'function' && typeof api.getCommunicationSummary === 'function' && typeof api.markConversationRead === 'function', 'messages.ts exportiert getInbox/getCommunicationSummary/markConversationRead', Object.keys(api).filter((k) => /Inbox|Summary|Conversation/.test(k)).join(','));
      await api.getInbox({ source: 'complaint', filter: 'unread', q: 'ORD', page: 2, limit: 25 });
      check(calls[0].url === '/api/communications/inbox' && calls[0].config.params.source === 'complaint' && calls[0].config.params.page === 2, 'getInbox sendet Filter als Query-Parameter', JSON.stringify(calls[0]));
      let thrown = null;
      apiStub.get = async () => { throw Object.assign(new Error('x'), { response: { data: { error: 'Nachrichten konnten nicht geladen werden.' } } }); };
      try { await api.getInbox({}); } catch (error) { thrown = error; }
      check(thrown && /konnten nicht geladen/.test(thrown.message), 'getInbox wirft bei Fehler (kein stilles leeres Ergebnis)', thrown?.message);
      await api.markConversationRead('order', orderAId);
      check(calls.some((c) => c.url === `/api/communications/order/${orderAId}/read`), 'markConversationRead ruft PUT /api/communications/:type/:id/read', 'ok');
    });

    // ==============================================================================
    await section('[M] Review-Nachbesserungen: Lesestatus-lose Quellen, abgeschlossene Datensaetze, Dedupe, Gast-Antwort, Zaehler-Cache', async () => {
      // --- Reklamation / Alt-Nachrichten: nie dauerhaft "ungelesen" ---
      await db.collection('complaints').updateOne({ _id: oid(complaintId) }, { $push: { comments: {
        _id: new mongoose.Types.ObjectId(), userId: staff._id, userName: 'Sophie Team', userRole: 'staff', comment: 'Wir prüfen das.', isInternal: false, createdAt: new Date(Date.now() - 500),
      } } });
      const custComplaint = itemFor((await inbox(customerA, 'source=complaint')).body, `complaint:${complaintId}`);
      const adminComplaint = itemFor((await inbox(admin, 'source=complaint')).body, `complaint:${complaintId}`);
      check(custComplaint?.unreadCount === 0 && adminComplaint?.unreadCount === 0, 'Reklamationskommentare zaehlen fuer Kunde und Personal nie als ungelesen', `${custComplaint?.unreadCount}/${adminComplaint?.unreadCount}`);
      const legacyOnly = await db.collection('repairrequests').insertOne({
        requestNumber: 'RR-T-0002', customerId: customerB._id, customerName: 'Kunde Bernd', customerEmail: 'comms-b@test.invalid', deviceType: 'Tablet', status: 'pending',
        messages: [{ _id: new mongoose.Types.ObjectId(), senderId: customerB._id, senderName: 'Kunde Bernd', senderRole: 'customer', message: 'Alte Kundenfrage', sentAt: new Date('2026-09-02T10:00:00Z'), isRead: true }],
        createdAt: new Date(), updatedAt: new Date(),
      });
      const legacyKey = `repair_request:${legacyOnly.insertedId}`;
      const legacyItem = itemFor((await inbox(admin, 'source=repair_request')).body, legacyKey);
      check(legacyItem?.unreadCount === 0 && legacyItem?.awaitingReply === true, 'Alt-Nachricht (RepairRequest.messages): 0 ungelesen, aber Antwort ausstehend', `${legacyItem?.unreadCount}/${legacyItem?.awaitingReply}`);
      const marked = await call('PUT', `/api/communications/repair_request/${legacyOnly.insertedId}/read`, admin);
      const legacyAfter = itemFor((await inbox(admin, 'source=repair_request')).body, legacyKey);
      check(marked.status === 200 && legacyAfter?.unreadCount === 0, 'nach Lesen weiterhin 0', `${marked.status} ${legacyAfter?.unreadCount}`);
      const adminBox = await inbox(admin, 'limit=1');
      check(adminBox.body.counts.bySource.complaint.unread === 0, 'Zaehler: Reklamationen tragen 0 zu "ungelesen" bei (Dashboard kann 0 erreichen)', JSON.stringify(adminBox.body.counts.bySource.complaint));

      // --- Abgeschlossene Reklamationen / Auftraege: keine "Antwort ausstehend" ---
      const closed = await db.collection('complaints').insertOne({
        complaintNumber: 'CMP-T-0002', customerId: customerA._id, subject: 'Erledigt', description: 'x', category: 'quality', status: 'closed',
        comments: [
          { _id: new mongoose.Types.ObjectId(), userId: staff._id, userName: 'Sophie Team', userRole: 'staff', comment: 'Erledigt.', isInternal: false, createdAt: new Date(Date.now() - 5000) },
          { _id: new mongoose.Types.ObjectId(), userId: customerA._id, userName: 'Kunde Anna', userRole: 'customer', comment: 'Danke!', isInternal: false, createdAt: new Date(Date.now() - 4000) },
        ],
        createdAt: new Date(), updatedAt: new Date(),
      });
      const closedItem = itemFor((await inbox(staff, 'source=complaint')).body, `complaint:${closed.insertedId}`);
      check(closedItem && closedItem.awaitingReply === false, 'geschlossene Reklamation mit letztem "Danke!": keine Antwort ausstehend', closedItem?.awaitingReply);
      const reopened = await db.collection('complaints').insertOne({
        complaintNumber: 'CMP-T-0003', customerId: customerA._id, subject: 'Geloest, aber neue Frage', description: 'x', category: 'quality', status: 'resolved', resolvedAt: new Date(Date.now() - 60000),
        comments: [{ _id: new mongoose.Types.ObjectId(), userId: customerA._id, userName: 'Kunde Anna', userRole: 'customer', comment: 'Es flackert schon wieder', isInternal: false, createdAt: new Date() }],
        createdAt: new Date(), updatedAt: new Date(),
      });
      const reopenedItem = itemFor((await inbox(staff, 'source=complaint')).body, `complaint:${reopened.insertedId}`);
      check(reopenedItem?.awaitingReply === true, 'Kundenkommentar NACH resolvedAt bleibt "Antwort ausstehend"', reopenedItem?.awaitingReply);

      const doneOrder = await newOrder(customerA, { status: 'completed' });
      await call('POST', `/api/inspection-communication/${doneOrder._id}/message`, customerA, { content: 'Danke für die Reparatur!' });
      const cancelledOrder = await newOrder(customerA, { status: 'cancelled' });
      await call('POST', `/api/inspection-communication/${cancelledOrder._id}/message`, customerA, { content: 'Ok, storniert.' });
      const lateOrder = await newOrder(customerA, { status: 'completed', actualCompletion: new Date(Date.now() - 3600000) });
      await call('POST', `/api/inspection-communication/${lateOrder._id}/message`, customerA, { content: 'Gerät geht wieder nicht' });
      const ordersBox = (await inbox(staff, 'source=order&limit=50')).body;
      const doneItem = itemFor(ordersBox, `order:${doneOrder._id}`);
      const cancelledItem = itemFor(ordersBox, `order:${cancelledOrder._id}`);
      const lateItem = itemFor(ordersBox, `order:${lateOrder._id}`);
      check(doneItem?.awaitingReply === false && cancelledItem?.awaitingReply === false, 'abgeschlossener/stornierter Auftrag: keine Antwort ausstehend', `${doneItem?.awaitingReply}/${cancelledItem?.awaitingReply}`);
      check(doneItem?.unreadCount === 1, 'ungelesen bleibt davon unberuehrt (pro Benutzer)', doneItem?.unreadCount);
      check(lateItem?.awaitingReply === true, 'Kundennachricht NACH Abschluss (actualCompletion) bleibt "Antwort ausstehend"', lateItem?.awaitingReply);

      // --- Von Personal erledigte Aktion ist keine Kunden-Aktivitaet ---
      const actionOrder = await newOrder(customerA);
      const actionId = String(actionOrder._id);
      const qa = await call('POST', `/api/inspection-communication/${actionId}/quick-action`, staff, { actionType: 'additional_costs', description: 'Mehrkosten 10 €' });
      const qaMsg = qa.body.communication.messages.find((m) => m.messageType === 'quick_action');
      const staffDone = await call('PUT', `/api/inspection-communication/${actionId}/quick-action/${qaMsg._id}/complete`, staff2);
      const staffDoneItem = itemFor((await inbox(admin, 'source=order&limit=50')).body, `order:${actionId}`);
      const storedQa = (await allMessages(actionId)).find((m) => String(m._id) === String(qaMsg._id));
      check(staffDone.status === 200 && storedQa.quickAction.completedByRole === 'staff' && staffDoneItem?.awaitingReply === false,
        'Mitarbeiter erledigt Aktion: completedByRole=staff, keine Antwort ausstehend', `${staffDone.status} ${storedQa.quickAction.completedByRole} ${staffDoneItem?.awaitingReply}`);
      const qa2 = await call('POST', `/api/inspection-communication/${actionId}/quick-action`, staff, { actionType: 'customer_defect_info', description: 'Bitte Defekt beschreiben' });
      const qa2Msg = qa2.body.communication.messages.filter((m) => m.messageType === 'quick_action').pop();
      await call('PUT', `/api/inspection-communication/${actionId}/quick-action/${qa2Msg._id}/complete`, customerA);
      const custDoneItem = itemFor((await inbox(admin, 'source=order&limit=50')).body, `order:${actionId}`);
      check(custDoneItem?.awaitingReply === true, 'Kunde erledigt Aktion: Antwort ausstehend', custDoneItem?.awaitingReply);

      // --- clientMessageId: pro Absender UND Nachrichtentyp ---
      const dedupeOrder = await newOrder(customerA);
      const dId = String(dedupeOrder._id);
      const sharedId = `draft-same-${crypto.randomUUID()}`;
      const m1 = await call('POST', `/api/inspection-communication/${dId}/message`, staff, { content: 'Erst eine Nachricht', clientMessageId: sharedId });
      const q1 = await call('POST', `/api/inspection-communication/${dId}/feedback-request`, staff, { question: 'Dann eine Frage?', options: [{ label: 'Ja', value: 'ja' }, { label: 'Nein', value: 'nein' }], clientMessageId: sharedId });
      const q2 = await call('POST', `/api/inspection-communication/${dId}/feedback-request`, staff, { question: 'Dann eine Frage?', options: [{ label: 'Ja', value: 'ja' }, { label: 'Nein', value: 'nein' }], clientMessageId: sharedId });
      const storedQuestions = (await allMessages(dId)).filter((m) => m.messageType === 'feedback_request');
      check(m1.status === 201 && q1.status === 201 && q1.body.created === true && storedQuestions.length === 1, 'gleiche Entwurfs-ID: Rueckfrage nach Nachricht wird gespeichert (nicht still verworfen)', `${m1.status}/${q1.status} ${storedQuestions.length}`);
      check(q2.status === 200 && q2.body.created === false && storedQuestions.length === 1, 'Wiederholung der Rueckfrage: 200 created=false, weiter genau 1', `${q2.status} ${q2.body?.created}`);
      const pendingCount = (await threadDocs(dId))[0].pendingFeedbackCount;
      check(pendingCount === 1, 'pendingFeedbackCount nur einmal erhoeht', pendingCount);

      // --- Gast-Antwort auf Rueckfrage: atomar, nur angebotene Optionen ---
      const guestOrder = await newOrder(null, { guestInfo: { email: 'gast2@test.invalid', firstName: 'Gina', lastName: 'Gast', isGuest: true } });
      const guestToken = crypto.randomBytes(16).toString('hex');
      const guestBooking = await db.collection('bookings').insertOne({ bookingNumber: 'BKG-T-0002', guestTrackingToken: guestToken, guestInfo: { email: 'gast2@test.invalid' }, orderIds: [guestOrder._id] });
      await db.collection('orders').updateOne({ _id: guestOrder._id }, { $set: { bookingId: guestBooking.insertedId } });
      const gId = String(guestOrder._id);
      const gq = await call('POST', `/api/inspection-communication/${gId}/feedback-request`, staff, { question: 'Rückseite tauschen?', options: [{ label: 'Ja', value: 'ja' }, { label: 'Nein', value: 'nein' }] });
      const gqMsg = gq.body.communication.messages.find((m) => m.messageType === 'feedback_request');
      const bad = await call('POST', `/api/track-order/booking/${gId}/communication/feedback-response`, null, { token: guestToken, email: 'gast2@test.invalid', messageId: gqMsg._id, response: { label: 'Vielleicht', value: 'vielleicht' } });
      check(bad.status === 400, 'Gast: nicht angebotene Antwort -> 400', `${bad.status} ${bad.body?.error}`);
      notifications.length = 0;
      const parallel = await Promise.all([
        call('POST', `/api/track-order/booking/${gId}/communication/feedback-response`, null, { token: guestToken, email: 'gast2@test.invalid', messageId: gqMsg._id, response: { label: 'Ja', value: 'ja' } }),
        call('POST', `/api/track-order/booking/${gId}/communication/feedback-response`, null, { token: guestToken, email: 'gast2@test.invalid', messageId: gqMsg._id, response: { label: 'Nein', value: 'nein' } }),
      ]);
      const statuses = parallel.map((r) => r.status).sort();
      const storedGq = (await allMessages(gId)).find((m) => String(m._id) === String(gqMsg._id));
      check(statuses[0] === 200 && statuses[1] === 409, 'Gast: zwei parallele Antworten -> 200 + 409', statuses.join(','));
      check(notifications.length === 2 && (await threadDocs(gId))[0].pendingFeedbackCount === 0 && storedGq.metadata?.guestResponderEmail === 'gast2@test.invalid',
        'genau eine Team-Benachrichtigungsrunde, Zaehler 0, Gast-E-Mail vermerkt', `${notifications.length} ${(await threadDocs(gId))[0].pendingFeedbackCount} ${storedGq.metadata?.guestResponderEmail}`);
      const gqa = await call('POST', `/api/inspection-communication/${gId}/quick-action`, staff, { actionType: 'customer_defect_info', description: 'Bitte Fotos senden' });
      const gqaMsg = gqa.body.communication.messages.find((m) => m.messageType === 'quick_action');
      const gDone = await call('PUT', `/api/track-order/booking/${gId}/communication/quick-action/${gqaMsg._id}/complete`, null, { token: guestToken, email: 'gast2@test.invalid' });
      const gDoneAgain = await call('PUT', `/api/track-order/booking/${gId}/communication/quick-action/${gqaMsg._id}/complete`, null, { token: guestToken, email: 'gast2@test.invalid' });
      const storedGqa = (await allMessages(gId)).find((m) => String(m._id) === String(gqaMsg._id));
      check(gDone.status === 200 && gDoneAgain.status === 409 && storedGqa.quickAction.completedByRole === 'guest', 'Gast erledigt Aktion ueber den Service (Rolle guest), zweites Mal 409', `${gDone.status}/${gDoneAgain.status} ${storedGqa.quickAction.completedByRole}`);

      // --- Zaehler-Cache: Schreiben und Lesen wirken sofort ---
      const before = await call('GET', '/api/communications/summary', admin2);
      const cacheOrder = await newOrder(customerB);
      await call('POST', `/api/inspection-communication/${cacheOrder._id}/message`, customerB, { content: 'Neue Frage zum Cache' });
      const afterWrite = await call('GET', '/api/communications/summary', admin2);
      check(afterWrite.body.unread === before.body.unread + 1, 'neue Kundennachricht: Zusammenfassung sofort +1 (Cache geleert)', `${before.body.unread} -> ${afterWrite.body.unread}`);
      await call('PUT', `/api/communications/order/${cacheOrder._id}/read`, admin2);
      const afterRead = await call('GET', '/api/communications/summary', admin2);
      const dash = await call('GET', '/api/admin/dashboard/customer-messages', admin2);
      check(afterRead.body.unread === before.body.unread && dash.body.totalUnread === afterRead.body.unread, 'nach Lesen: Zusammenfassung und Dashboard sofort wieder -1', `${afterRead.body.unread}/${dash.body.totalUnread}`);
      const freshInbox = await inbox(admin2, 'limit=1');
      check(freshInbox.body.counts.unread === afterRead.body.unread, 'Zusammenfassung == frisch berechnetes Postfach', `${afterRead.body.unread}/${freshInbox.body.counts.unread}`);
    });
  } finally {
    server.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    fs.rmSync(LOG_REDIRECT_DIR, { recursive: true, force: true });
  }

  console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
