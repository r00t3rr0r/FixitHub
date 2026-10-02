/**
 * Regressionstest (Track rr): Reparaturanfrage – Gerät (Katalog/manuell), Zugriff (Kunde/Gast/
 * Personal), Kostenvoranschlag mit Veröffentlichungsgrenze, Kundenantwort (einmal), Nachrichten
 * (Benachrichtigung, Idempotenz, ungelesen/Antwort ausstehend) und atomare Umwandlung.
 *
 * Echte Express-Routen (/api/repair-requests, /api/repair-request-communication,
 * /api/track-order) + echte Wegwerf-DB. E-Mails, Benachrichtigungs-Mails und DHL sind gemockt
 * (Aufzeichnung statt Versand). server/logs wird umgeleitet (keine Dateien im Repository).
 *
 * Aufruf (nur WEGWERF-Datenbank):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_rr_flow node test-repair-request-flow.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const Module = require('module');

const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, 'server');
const LOG_DIR = path.join(SERVER_DIR, 'logs');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_rr_flow';

// Sicherheitsnetz: dropDatabase() nur gegen eine ausdrücklich angegebene Wegwerf-Datenbank.
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
const LOG_REDIRECT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-flow-logs-'));
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

// MOCK 'qrcode' (nur für PDF-Erzeugung, fehlt evtl. lokal)
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

let pass = 0;
let fail = 0;
const check = (condition, message, actual) => {
  if (condition) { pass += 1; console.log(`  PASS ${message} :: ${actual}`); } else { fail += 1; console.log(`  FAIL ${message} :: ${actual}`); }
};
const section = async (title, fn) => {
  console.log(`\n${title}`);
  try { await fn(); } catch (error) {
    fail += 1;
    console.log(`  FAIL Abschnitt brach ab :: ${error && error.stack ? error.stack.split('\n').slice(0, 4).join(' | ') : error}`);
  }
};
const isGerman = (text) => /[äöüÄÖÜß„]|Zugriff|[Aa]nfrage|Bitte|nicht|wurde|Gerät|Kostenvoranschlag|Kunden|Reparatur/.test(String(text || ''))
  && !/denied|not found|required|failed|successfully|Cast to|validation/i.test(String(text || ''));
const tick = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  if (isUnsafeTestUri(URI)) throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  fs.readdirSync(path.join(SERVER_DIR, 'models')).filter((f) => f.endsWith('.js')).forEach((file) => {
    try { require(path.join(SERVER_DIR, 'models', file)); } catch (error) { /* optionale Abhängigkeiten */ }
  });

  // ---- MOCKS: Aufzeichnung statt Versand ----
  const mails = [];
  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.sendTriggerEmail = async (trigger, to, vars) => { mails.push({ trigger, to, vars }); return { success: true, mocked: true }; };
  EmailService.sendTemplateEmail = async () => ({ success: true, mocked: true });
  EmailService.sendEmail = async () => ({ success: true, mocked: true });
  EmailService.sendOrderConfirmationEmail = async () => ({ success: true, mocked: true });
  EmailService.buildSystemUrl = async (p) => `http://test.invalid${p}`;
  const notifications = [];
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  const Notification = mongoose.model('Notification');
  NotificationService.createNotification = async (data, options = {}) => {
    const saved = await Notification.create(data); // echte DB-Schreibung
    notifications.push({ data, options, _id: saved._id });
    return saved;
  };
  const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));
  DHLService.createShipment = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };
  const BookingService = require(path.join(SERVER_DIR, 'services/bookingService'));
  let labelCalls = 0;
  BookingService.createShippingLabelForBooking = async () => { labelCalls += 1; return null; };

  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use('/api/repair-requests', require(path.join(SERVER_DIR, 'routes/repairRequestRoutes')));
  app.use('/api/repair-request-communication', require(path.join(SERVER_DIR, 'routes/repairRequestCommunicationRoutes')));
  let trackingMounted = true;
  try { app.use('/api/track-order', require(path.join(SERVER_DIR, 'routes/orderTrackingRoutes'))); } catch (error) { trackingMounted = false; }
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const RepairRequest = mongoose.model('RepairRequest');
  const RRComm = mongoose.model('RepairRequestCommunication');
  const Order = mongoose.model('Order');
  const Booking = mongoose.model('Booking');
  const Service = mongoose.model('Service');
  const { DeviceModel, DeviceBrand, DeviceType } = require(path.join(SERVER_DIR, 'models/Device'));

  const owner = await User.create({ firstName: 'Klara', lastName: 'Kunde', email: 'rr-owner@test.invalid', role: 'customer' });
  const stranger = await User.create({ firstName: 'Fritz', lastName: 'Fremd', email: 'rr-stranger@test.invalid', role: 'customer' });
  const staff = await User.create({ firstName: 'Sophie', lastName: 'Team', email: 'rr-staff@test.invalid', role: 'staff' });
  const admin = await User.create({ firstName: 'Anna', lastName: 'Admin', email: 'rr-admin@test.invalid', role: 'admin' });
  const admin2 = await User.create({ firstName: 'Bernd', lastName: 'Admin', email: 'rr-admin2@test.invalid', role: 'admin' });
  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, user, body) => {
    const headers = { 'Content-Type': 'application/json' };
    if (user) headers.Authorization = `Bearer ${tokenFor(user)}`;
    const response = await fetch(`${baseUrl}${url}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    let json = null;
    try { json = await response.json(); } catch (error) { json = null; }
    return { status: response.status, body: json };
  };

  await DeviceType.create({ _id: 'smartphone', name: 'Smartphone' });
  const apple = await DeviceBrand.create({ name: 'Apple' });
  const fairphone = await DeviceBrand.create({ name: 'Fairphone' });
  const iphone15 = await DeviceModel.create({ name: 'iPhone 15', brandId: apple._id, deviceType: 'smartphone' });
  const fp5 = await DeviceModel.create({ name: 'Fairphone 5', brandId: fairphone._id, deviceType: 'smartphone' });
  const retired = await DeviceModel.create({ name: 'iPhone 6', brandId: apple._id, deviceType: 'smartphone', isActive: false });
  const display = await Service.create({
    category: 'display', deviceTypes: ['Smartphone'], manufacturerPrecise: 'Apple', modelPrecise: 'iPhone 15',
    name: 'Displaytausch', price: 199, estimatedTime: '60',
  });
  const fpService = await Service.create({
    category: 'battery', deviceTypes: ['Smartphone'], manufacturerPrecise: 'Fairphone', modelPrecise: 'Fairphone 5',
    name: 'Akkutausch', price: 79, estimatedTime: '30',
  });

  const issue = 'Das Display flackert seit gestern und reagiert nicht mehr zuverlässig.';
  const guestInfo = (email) => ({ firstName: 'Gisela', lastName: 'Gast Müller', email, phone: '0123' });
  const newGuest = async (email, extra = {}) => {
    const res = await call('POST', '/api/repair-requests/guest', null, {
      guestInfo: guestInfo(email), deviceSource: 'manual', deviceType: 'Smartphone', deviceBrand: 'Fairphone', deviceModel: 'Fairphone 5', issueDescription: issue, ...extra,
    });
    const doc = await RepairRequest.findOne({ requestNumber: res.body?.requestNumber }).lean();
    return { res, doc, token: res.body?.guestTrackingToken, email };
  };
  const newMember = async (user = owner, extra = {}) => {
    const res = await call('POST', '/api/repair-requests', user, {
      deviceSource: 'manual', deviceModelId: '', deviceType: 'Smartphone', deviceBrand: 'Fairphone', deviceModel: '5', issueDescription: issue, ...extra,
    });
    return { res, doc: res.body?.request?._id ? await RepairRequest.findById(res.body.request._id).lean() : null };
  };

  try {
    // ===============================================================================
    await section('[RR-1/RR-3/RR-19] Anlegen: manuell, Katalog, ungültige ID, Fotogröße', async () => {
      const manual = await newMember(owner);
      check(manual.res.status === 201 && manual.doc && !manual.doc.deviceModelId && manual.doc.deviceSource === 'manual'
        && manual.doc.reportedDevice?.source === 'manual' && manual.doc.deviceBrand === 'Fairphone' && manual.doc.deviceModel === '5',
        'Mitglied manuell mit deviceModelId "" -> 201, ohne Katalog-ID, source manual, Angabe exakt', `${manual.res.status} ${manual.res.body?.message || ''} ${manual.doc?.deviceSource}`);
      check(manual.res.body?.request && manual.res.body.request.adminNotes === undefined, 'Antwort ist Kundensicht (keine adminNotes)', Object.keys(manual.res.body?.request || {}).length);

      const catalog = await newMember(owner, { deviceSource: 'catalog', deviceModelId: String(iphone15._id), deviceBrand: 'Samsung', deviceModel: 'Galaxy Tab' });
      check(catalog.res.status === 201 && catalog.doc?.deviceBrand === 'Apple' && catalog.doc?.deviceModel === 'iPhone 15'
        && String(catalog.doc?.deviceModelId) === String(iphone15._id) && catalog.doc?.deviceType === 'Smartphone' && catalog.doc?.deviceSource === 'catalog',
        'Katalog-ID + widersprüchlicher Text -> Katalognamen gespeichert', `${catalog.res.status} ${catalog.doc?.deviceBrand} ${catalog.doc?.deviceModel}`);

      const before = await RepairRequest.countDocuments();
      const unknown = await newMember(owner, { deviceSource: 'catalog', deviceModelId: String(new mongoose.Types.ObjectId()) });
      const inactive = await newMember(owner, { deviceModelId: String(retired._id) });
      const guestUnknown = await call('POST', '/api/repair-requests/guest', null, {
        guestInfo: guestInfo('g-unknown@test.invalid'), deviceModelId: String(new mongoose.Types.ObjectId()), deviceBrand: 'X', deviceModel: 'Y', issueDescription: issue,
      });
      check(unknown.res.status === 400 && inactive.res.status === 400 && guestUnknown.status === 400 && isGerman(unknown.res.body?.message)
        && (await RepairRequest.countDocuments()) === before,
        'unbekannte/inaktive Katalog-ID (Mitglied+Gast) -> 400 deutsch, kein Dokument', `${unknown.res.status} ${inactive.res.status} ${guestUnknown.status} ${unknown.res.body?.message}`);

      const incomplete = await newMember(owner, { deviceBrand: '', deviceModel: '' });
      check(incomplete.res.status === 400 && isGerman(incomplete.res.body?.message), 'manuell ohne Marke/Modell -> 400 deutsch', `${incomplete.res.status} ${incomplete.res.body?.message}`);

      const guest = await newGuest('g-manual@test.invalid');
      check(guest.res.status === 201 && guest.doc?.deviceBrand === 'Fairphone' && guest.doc?.deviceModel === 'Fairphone 5'
        && guest.doc?.guestFirstName === 'Gisela' && guest.doc?.guestLastName === 'Gast Müller',
        'Gast manuell -> 201, Marke/Modell exakt, Vor-/Nachname getrennt gespeichert', `${guest.res.status} ${guest.doc?.guestLastName}`);

      const bigImage = `data:image/jpeg;base64,${'A'.repeat(3 * 1024 * 1024)}`; // ~2,25 MB dekodiert
      const tooBig = await newMember(owner, { images: [bigImage, bigImage, bigImage, bigImage] });
      check(tooBig.res.status === 413 && /8 MB/.test(tooBig.res.body?.message || '') && (await RepairRequest.countDocuments()) === before + 1,
        'Fotos zusammen > 8 MB -> 413 deutsch, kein Dokument', `${tooBig.res.status} ${tooBig.res.body?.message}`);
    });

    // ===============================================================================
    await section('[RR-8/RR-15/COMMS-8] Kundensicht ohne interne Daten; Gast-Anfrage per ID für Personal', async () => {
      const guest = await newGuest('g-view@test.invalid');
      await call('POST', `/api/repair-requests/${guest.doc._id}/admin-notes`, staff, { note: 'INTERN: Kunde schwierig' });
      await call('PUT', `/api/repair-requests/${guest.doc._id}/assign`, staff, { staffId: String(staff._id) });
      const tracked = await call('GET', `/api/repair-requests/guest/track?token=${guest.token}&email=${encodeURIComponent(guest.email)}`);
      const text = JSON.stringify(tracked.body || {});
      check(tracked.status === 200 && !text.includes('INTERN') && !text.includes('adminNotes') && !text.includes('rr-staff@test.invalid')
        && !text.includes('guestTrackingToken') && !text.includes('"priority"'),
        'Gast-Tracking: keine internen Notizen, keine Mitarbeiter-E-Mail, kein Token, keine Priorität', `${tracked.status} ${text.length}`);

      const staffView = await call('GET', `/api/repair-requests/${guest.doc._id}`, staff);
      check(staffView.status === 200 && (staffView.body?.request?.adminNotes || []).some((n) => /INTERN/.test(n.note)),
        'Personal GET /:id auf Gast-Anfrage -> 200 (kein 500) inkl. interner Notizen', `${staffView.status}`);

      const member = await newMember(owner);
      await call('POST', `/api/repair-requests/${member.doc._id}/admin-notes`, admin, { note: 'INTERN: nur Team' });
      const own = await call('GET', `/api/repair-requests/${member.doc._id}`, owner);
      const foreign = await call('GET', `/api/repair-requests/${member.doc._id}`, stranger);
      const invalidCustomer = await call('GET', '/api/repair-requests/kein-objectid', stranger);
      const invalidStaff = await call('GET', '/api/repair-requests/kein-objectid', staff);
      check(own.status === 200 && !JSON.stringify(own.body).includes('INTERN') && own.body?.request?.adminNotes === undefined,
        'Eigentümer GET /:id -> 200 ohne adminNotes', `${own.status}`);
      check(foreign.status === 403 && isGerman(foreign.body?.message) && !JSON.stringify(foreign.body).includes(member.doc.requestNumber),
        'fremder Kunde GET /:id -> 403 deutsch ohne Daten', `${foreign.status} ${foreign.body?.message}`);
      check(invalidCustomer.status === 403 && invalidStaff.status === 404, 'ungültige ID: Kunde 403, Personal 404', `${invalidCustomer.status} ${invalidStaff.status}`);
    });

    // ===============================================================================
    await section('[RR-7/COMMS-7] Gast-Token ist an genau eine Anfrage gebunden', async () => {
      const a = await newGuest('g-a@test.invalid');
      const b = await newGuest('g-b@test.invalid');
      await call('POST', `/api/repair-request-communication/${b.doc._id}/message`, staff, { content: 'Angebot nur für Gast B' });
      const readB = await call('GET', `/api/repair-requests/guest/${b.doc._id}/communication?token=${a.token}&email=${encodeURIComponent(a.email)}`);
      const writeB = await call('POST', `/api/repair-requests/guest/${b.doc._id}/message`, null, { token: a.token, email: a.email, content: 'Fremd' });
      const threadB = await RRComm.findOne({ repairRequestId: b.doc._id }).lean();
      check(readB.status === 403 && !JSON.stringify(readB.body).includes('Gast B'), 'Token A liest Thread B -> 403', `${readB.status}`);
      check(writeB.status === 403 && threadB.messages.length === 1, 'Token A schreibt in Thread B -> 403, Thread B unverändert', `${writeB.status} ${threadB.messages.length}`);
      const own = await call('GET', `/api/repair-requests/guest/${a.doc._id}/communication?token=${a.token}&email=${encodeURIComponent(a.email)}`);
      check(own.status === 200, 'eigener Thread -> 200', own.status);
    });

    // ===============================================================================
    await section('[RR-9/COMMS-6] Kommunikations-Routen: Besitz- und Rollenprüfung', async () => {
      const member = await newMember(owner);
      const id = String(member.doc._id);
      await call('POST', `/api/repair-request-communication/${id}/message`, staff, { content: 'Hallo vom Team' });
      const results = [];
      for (const [method, suffix, body] of [
        ['GET', '', undefined], ['POST', '/message', { content: 'x' }], ['GET', '/unread-count', undefined],
        ['PUT', '/mark-read', {}], ['GET', '/pending-feedback', undefined],
      ]) {
        const res = await call(method, `/api/repair-request-communication/${id}${suffix}`, stranger, body);
        results.push(`${method} ${suffix || '/'}=${res.status}`);
        check(res.status === 403 && !JSON.stringify(res.body || {}).includes('Hallo vom Team'), `fremder Kunde ${method} ${suffix || '/'} -> 403`, res.status);
      }
      const fbByCustomer = await call('POST', `/api/repair-request-communication/${id}/feedback-request`, owner, { question: 'Q?', options: [{ label: 'Ja', value: 'yes' }] });
      const qaByCustomer = await call('POST', `/api/repair-request-communication/${id}/quick-action`, owner, { actionType: 'status_update' });
      const legacy = await call('POST', `/api/repair-requests/${id}/messages`, stranger, { message: 'legacy' });
      check(fbByCustomer.status === 403 && qaByCustomer.status === 403, 'Kunde legt Rückfrage/Aktion an -> 403', `${fbByCustomer.status} ${qaByCustomer.status}`);
      check(legacy.status === 403, 'fremder Kunde Legacy POST /:id/messages -> 403', legacy.status);
      const ownRead = await call('GET', `/api/repair-request-communication/${id}`, owner);
      const staffRead = await call('GET', `/api/repair-request-communication/${id}`, staff);
      check(ownRead.status === 200 && ownRead.body?.internalNotes === undefined, 'Eigentümer liest Thread -> 200, ohne internalNotes', ownRead.status);
      check(staffRead.status === 200 && Array.isArray(staffRead.body?.internalNotes), 'Personal liest Thread -> 200 mit internalNotes (separat)', staffRead.status);

      const fb = await call('POST', `/api/repair-request-communication/${id}/feedback-request`, staff, { question: 'Dürfen wir das Gehäuse öffnen?', options: [{ label: 'Ja', value: 'yes' }, { label: 'Nein', value: 'no' }] });
      const msg = fb.body?.communication?.messages?.find((m) => m.messageType === 'feedback_request');
      const byStaff = await call('POST', `/api/repair-request-communication/${id}/feedback-response`, staff, { messageId: msg?._id, response: { label: 'Ja', value: 'yes' } });
      const byStranger = await call('POST', `/api/repair-request-communication/${id}/feedback-response`, stranger, { messageId: msg?._id, response: { label: 'Nein', value: 'no' } });
      const first = await call('POST', `/api/repair-request-communication/${id}/feedback-response`, owner, { messageId: msg?._id, response: { label: 'Ja', value: 'yes' } });
      const second = await call('POST', `/api/repair-request-communication/${id}/feedback-response`, owner, { messageId: msg?._id, response: { label: 'Nein', value: 'no' } });
      const stored = (await RRComm.findOne({ repairRequestId: id }).lean()).messages.find((m) => String(m._id) === String(msg?._id));
      check(byStaff.status === 403 && byStranger.status === 403, 'Personal/fremder Kunde beantworten Rückfrage -> 403', `${byStaff.status} ${byStranger.status}`);
      check(first.status === 200 && second.status === 409 && isGerman(second.body?.error) && stored.feedbackRequest.response.value === 'yes',
        'Eigentümer antwortet einmal; zweite Antwort -> 409, erste bleibt', `${first.status} ${second.status} ${stored.feedbackRequest.response.value}`);
      const staffNote = notifications.find((n) => String(n.data.metadata?.repairRequestId) === id && n.data.metadata?.messageType === 'feedback_response');
      check(staffNote && isGerman(staffNote.data.title) && /\/admin\/repair-requests\?requestId=/.test(staffNote.data.actionUrl),
        'Antwort benachrichtigt Admins (unzugewiesen) deutsch mit Deep-Link', staffNote?.data.title);
    });

    // ===============================================================================
    await section('[RR-5/NOTIF-14] Kostenvoranschlag: Entwurf sendet nichts, Senden genau einmal, 0 € gültig', async () => {
      const guest = await newGuest('g-quote@test.invalid');
      const id = String(guest.doc._id);
      const mailsBefore = mails.length;
      const draft = await call('PUT', `/api/repair-requests/${id}/quote`, staff, { amount: 0, description: 'Kostenlose Reinigung' });
      const thread0 = await RRComm.findOne({ repairRequestId: id }).lean();
      const tracked0 = await call('GET', `/api/repair-requests/guest/track?token=${guest.token}&email=${encodeURIComponent(guest.email)}`);
      check(draft.status === 200 && mails.length === mailsBefore && !thread0 && tracked0.body?.request?.quote === null,
        'Entwurf (0 €): keine Mail, keine Thread-Nachricht, Gast sieht keinen Kostenvoranschlag', `${draft.status} mails+${mails.length - mailsBefore} quote=${JSON.stringify(tracked0.body?.request?.quote)}`);
      const stored0 = await RepairRequest.findById(id).lean();
      check(stored0.quote?.status === 'draft' && stored0.quote?.amount === 0 && (stored0.adminNotes || []).some((n) => /Entwurf gespeichert: 0,00 €/.test(n.note)),
        'DB: quote draft 0 €, deutsche Notiz ohne $', stored0.adminNotes?.map((n) => n.note).join(' | '));

      const send1 = await call('POST', `/api/repair-requests/${id}/quote/send`, staff, {});
      const send2 = await call('POST', `/api/repair-requests/${id}/quote/send`, staff, {});
      const quoteMails = mails.slice(mailsBefore).filter((m) => m.to === guest.email && /Kostenvoranschlag/.test(m.vars?.notificationTitle || ''));
      const thread1 = await RRComm.findOne({ repairRequestId: id }).lean();
      const fbMsgs = (thread1?.messages || []).filter((m) => m.messageType === 'feedback_request');
      check(send1.status === 200 && send1.body?.alreadySent === false && send1.body?.email?.status === 'accepted', 'Senden -> 200, E-Mail vom Mailserver angenommen', `${send1.status} ${JSON.stringify(send1.body?.email)}`);
      check(send2.status === 200 && send2.body?.alreadySent === true, 'zweites Senden (Doppelklick) -> alreadySent, nichts erneut', `${send2.status} ${send2.body?.alreadySent}`);
      check(quoteMails.length === 1 && /0,00 €/.test(quoteMails[0].vars.notificationBody) && /\/guest-repair-tracking\?token=/.test(quoteMails[0].vars.ctaUrl),
        'genau 1 Mail an den Gast mit "0,00 €" und Tracking-/Antwort-Link', `${quoteMails.length} ${quoteMails[0]?.vars?.ctaUrl}`);
      check(fbMsgs.length === 1 && fbMsgs[0].feedbackRequest.metadata?.kind === 'quote', 'genau 1 Rückfrage (Kostenvoranschlag) im Thread', fbMsgs.length);
      const tracked1 = await call('GET', `/api/repair-requests/guest/track?token=${guest.token}&email=${encodeURIComponent(guest.email)}`);
      check(tracked1.body?.request?.quote?.status === 'sent' && tracked1.body?.request?.quote?.amount === 0 && tracked1.body?.request?.responseRequired === true,
        'Gast sieht veröffentlichten Kostenvoranschlag 0 € + "Antwort erforderlich"', JSON.stringify(tracked1.body?.request?.quote));

      const member = await newMember(owner);
      const mid = String(member.doc._id);
      const nBefore = notifications.length;
      const mBefore = mails.length;
      const sendMember = await call('POST', `/api/repair-requests/${mid}/quote/send`, admin, { amount: '89,00', description: 'Displaytausch' });
      const memberNotes = notifications.slice(nBefore).filter((n) => String(n.data.userId) === String(owner._id));
      const memberMails = mails.slice(mBefore).filter((m) => m.to === owner.email);
      check(sendMember.status === 200 && memberNotes.length === 1 && memberNotes[0].data.actionUrl === `/my-repair-requests?requestId=${mid}` && memberNotes[0].options.sendEmail === false,
        'Mitglied: 1 In-App-Hinweis mit Deep-Link (ohne generische Zusatz-Mail)', `${memberNotes.length} ${memberNotes[0]?.data.actionUrl}`);
      check(memberMails.length === 1 && /89,00 €/.test(memberMails[0].vars.notificationBody) && memberMails[0].vars.ctaUrl === `/my-repair-requests?requestId=${mid}`,
        'Mitglied: genau 1 Kostenvoranschlags-Mail mit 89,00 € und Deep-Link', `${memberMails.length}`);

      // Änderung nach dem Senden: zurück auf Entwurf, alte Rückfrage verfällt
      const changed = await call('PUT', `/api/repair-requests/${mid}/quote`, admin, { amount: 99, description: 'Displaytausch + Akku' });
      const t = await RRComm.findOne({ repairRequestId: mid }).lean();
      const oldMsg = t.messages.find((m) => m.messageType === 'feedback_request');
      check(changed.status === 200 && changed.body?.request?.quote?.status === 'draft' && oldMsg.feedbackRequest.status === 'expired',
        'Änderung nach Senden -> Entwurf, alte Rückfrage "expired"', `${changed.body?.request?.quote?.status} ${oldMsg.feedbackRequest.status}`);
      const ownView = await call('GET', `/api/repair-requests/${mid}`, owner);
      check(ownView.body?.request?.quote === null, 'Kunde sieht Entwurf NICHT', JSON.stringify(ownView.body?.request?.quote));
      const resend = await call('POST', `/api/repair-requests/${mid}/quote/send`, admin, {});
      check(resend.status === 200 && resend.body?.request?.quote?.version === 2, 'neue Version wird gesendet (Version 2)', resend.body?.request?.quote?.version);
    });

    // ===============================================================================
    await section('[RR-6/RR-9] Antwort auf den Kostenvoranschlag: Gast strukturiert, genau einmal', async () => {
      const guest = await newGuest('g-answer@test.invalid');
      const other = await newGuest('g-answer-other@test.invalid');
      const id = String(guest.doc._id);
      await call('POST', `/api/repair-requests/${id}/quote/send`, staff, { amount: 49.9, description: 'Akkutausch' });
      const msgId = (await RepairRequest.findById(id).lean()).quote.feedbackMessageId;
      const foreign = await call('POST', `/api/repair-requests/guest/${id}/feedback-response`, null, { token: other.token, email: other.email, messageId: String(msgId), response: { value: 'quote_accept' } });
      const ok = await call('POST', `/api/repair-requests/guest/${id}/feedback-response`, null, { token: guest.token, email: guest.email, messageId: String(msgId), response: { value: 'quote_accept' } });
      const again = await call('POST', `/api/repair-requests/guest/${id}/feedback-response`, null, { token: guest.token, email: guest.email, messageId: String(msgId), response: { value: 'quote_decline' } });
      const againQuote = await call('POST', `/api/repair-requests/guest/${id}/quote/respond`, null, { token: guest.token, email: guest.email, decision: 'decline', quoteVersion: 1 });
      const stored = await RepairRequest.findById(id).lean();
      check(foreign.status === 403, 'Token einer anderen Anfrage -> 403', foreign.status);
      check(ok.status === 200 && stored.quote.status === 'accepted' && stored.status === 'approved' && stored.quote.responseChannel === 'guest'
        && ok.body?.request?.statusLabel === 'Kostenvoranschlag angenommen',
        'Gast nimmt an -> quote accepted, Status approved ("Kostenvoranschlag angenommen")', `${ok.status} ${stored.quote.status} ${stored.status}`);
      check(again.status === 409 && againQuote.status === 409 && isGerman(again.body?.message), 'zweite Antwort (beide Wege) -> 409', `${again.status} ${againQuote.status}`);
      const staffNote = notifications.find((n) => n.data.metadata?.messageType === 'quote_response' && String(n.data.metadata?.repairRequestId) === id);
      check(staffNote && /Kostenvoranschlag angenommen/.test(staffNote.data.title), 'Team wird über die Annahme benachrichtigt', staffNote?.data.title);

      // freie Rückfrage an einen Gast: strukturierte Antwort über den Tracking-Link
      const q = await newGuest('g-question@test.invalid');
      const fbRes = await call('POST', `/api/repair-request-communication/${q.doc._id}/feedback-request`, staff, { question: 'Ist das Gerät entsperrt?', options: [{ label: 'Ja', value: 'yes' }, { label: 'Nein', value: 'no' }] });
      const qMsg = fbRes.body?.communication?.messages?.find((m) => m.messageType === 'feedback_request');
      const guestMail = mails.find((m) => m.to === 'g-question@test.invalid' && /\/guest-repair-tracking\?token=/.test(m.vars?.ctaUrl || ''));
      const gAnswer = await call('POST', `/api/repair-requests/guest/${q.doc._id}/feedback-response`, null, { token: q.token, email: q.email, messageId: qMsg?._id, response: { value: 'no' } });
      const qStored = (await RRComm.findOne({ repairRequestId: q.doc._id }).lean()).messages.find((m) => String(m._id) === String(qMsg?._id));
      check(guestMail && gAnswer.status === 200 && qStored.feedbackRequest.response.value === 'no' && qStored.feedbackRequest.responseChannel === 'guest',
        'Gast beantwortet freie Rückfrage strukturiert (E-Mail mit Antwort-Link, Antwort gespeichert)', `${Boolean(guestMail)} ${gAnswer.status} ${qStored?.feedbackRequest?.response?.value}`);
      const invalidOption = await call('POST', `/api/repair-requests/guest/${q.doc._id}/feedback-response`, null, { token: q.token, email: q.email, messageId: qMsg?._id, response: { value: 'yes' } });
      check(invalidOption.status === 409, 'zweite Gast-Antwort -> 409', invalidOption.status);

      const member = await newMember(owner);
      const mid = String(member.doc._id);
      await call('POST', `/api/repair-requests/${mid}/quote/send`, staff, { amount: 120 });
      const staffAnswer = await call('POST', `/api/repair-requests/${mid}/quote/respond`, staff, { decision: 'accept', quoteVersion: 1 });
      const strangerAnswer = await call('POST', `/api/repair-requests/${mid}/quote/respond`, stranger, { decision: 'accept', quoteVersion: 1 });
      const decline = await call('POST', `/api/repair-requests/${mid}/quote/respond`, owner, { decision: 'decline', quoteVersion: 1, amount: 120 });
      const declineAgain = await call('POST', `/api/repair-requests/${mid}/quote/respond`, owner, { decision: 'accept', quoteVersion: 1 });
      const ms = await RepairRequest.findById(mid).lean();
      const msg = (await RRComm.findOne({ repairRequestId: mid }).lean()).messages.find((m) => m.messageType === 'feedback_request');
      check(staffAnswer.status === 403 && strangerAnswer.status === 403, 'Personal/fremder Kunde beantworten Kostenvoranschlag -> 403', `${staffAnswer.status} ${strangerAnswer.status}`);
      check(decline.status === 200 && ms.quote.status === 'declined' && ms.status === 'reviewing' && msg.feedbackRequest.status === 'responded' && declineAgain.status === 409,
        'Mitglied lehnt ab -> declined, Anfrage bleibt "In Prüfung", Rückfrage beantwortet, zweite Antwort 409', `${decline.status} ${ms.quote.status} ${ms.status} ${declineAgain.status}`);

      // Altbestand: estimatedCost > 0 ohne quote gilt als veröffentlicht
      const legacy = await RepairRequest.create({
        customerId: owner._id, customerName: 'Klara Kunde', customerEmail: owner.email, customerPhone: '1',
        deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 15', issueDescription: issue, estimatedCost: 75, status: 'reviewing',
      });
      const legacyView = await call('GET', `/api/repair-requests/${legacy._id}`, owner);
      check(legacyView.body?.request?.quote?.status === 'sent' && legacyView.body?.request?.quote?.amount === 75 && legacyView.body?.request?.quote?.legacy === true,
        'Altbestand estimatedCost 75 ohne quote: Kunde sieht ihn weiterhin (legacy)', JSON.stringify(legacyView.body?.request?.quote));
      const legacyAccept = await call('POST', `/api/repair-requests/${legacy._id}/quote/respond`, owner, { decision: 'accept', quoteVersion: legacyView.body?.request?.quote?.version, amount: 75 });
      const legacyStored = await RepairRequest.findById(legacy._id).lean();
      check(legacyAccept.status === 200 && legacyStored.quote.status === 'accepted' && legacyStored.status === 'approved', 'Altbestand kann angenommen werden', `${legacyAccept.status} ${legacyStored.quote?.status}`);
    });

    // ===============================================================================
    await section('[REVIEW RR-6/RR-9] Antwort ist an die gesehene Version gebunden; Thread und Kostenvoranschlag widersprechen sich nie', async () => {
      const feedbackMsgs = async (rrId) => ((await RRComm.findOne({ repairRequestId: rrId }).lean())?.messages || [])
        .filter((m) => m.messageType === 'feedback_request' && m.feedbackRequest?.metadata?.kind === 'quote');

      // 1) Mitglied sieht v1 (89 €), Team sendet v2 (150 €): Annahme mit v1 -> 409, nichts angenommen
      const member = await newMember(owner);
      const mid = String(member.doc._id);
      await call('POST', `/api/repair-requests/${mid}/quote/send`, staff, { amount: 89 });
      const seen = (await call('GET', `/api/repair-requests/${mid}`, owner)).body?.request?.quote;
      await call('POST', `/api/repair-requests/${mid}/quote/send`, staff, { amount: 150 });
      const stale = await call('POST', `/api/repair-requests/${mid}/quote/respond`, owner, { decision: 'accept', quoteVersion: seen?.version, amount: seen?.amount });
      const afterStale = await RepairRequest.findById(mid).lean();
      check(seen?.version === 1 && seen?.amount === 89 && stale.status === 409 && stale.body?.code === 'QUOTE_CHANGED' && isGerman(stale.body?.message)
        && afterStale.quote.status === 'sent' && afterStale.quote.version === 2 && afterStale.quote.amount === 150 && afterStale.status !== 'approved',
        'v1 (89 €) gesehen, v2 (150 €) gesendet: Annahme mit v1 -> 409 QUOTE_CHANGED, v2 bleibt offen', `${stale.status} ${stale.body?.code} ${afterStale.quote.status} v${afterStale.quote.version} ${afterStale.status}`);
      const missing = await call('POST', `/api/repair-requests/${mid}/quote/respond`, owner, { decision: 'accept' });
      const wrongAmount = await call('POST', `/api/repair-requests/${mid}/quote/respond`, owner, { decision: 'accept', quoteVersion: 2, amount: 89 });
      check(missing.status === 409 && missing.body?.code === 'QUOTE_CHANGED' && wrongAmount.status === 409 && (await RepairRequest.findById(mid).lean()).quote.status === 'sent',
        'ohne quoteVersion bzw. mit falschem Betrag -> 409, nichts angenommen', `${missing.status} ${wrongAmount.status}`);
      const fresh = await call('POST', `/api/repair-requests/${mid}/quote/respond`, owner, { decision: 'accept', quoteVersion: 2, amount: 150 });
      const accepted = await RepairRequest.findById(mid).lean();
      const msgs = await feedbackMsgs(mid);
      const v1Msg = msgs.find((m) => m.feedbackRequest.metadata.quoteVersion === 1);
      const v2Msg = msgs.find((m) => m.feedbackRequest.metadata.quoteVersion === 2);
      const decisionNote = (accepted.adminNotes || []).find((n) => /Kostenvoranschlag angenommen: 150,00 € \(Version 2\)/.test(n.note));
      check(fresh.status === 200 && accepted.quote.status === 'accepted' && accepted.status === 'approved' && fresh.body?.request?.statusLabel === 'Kostenvoranschlag angenommen',
        'Annahme mit aktueller Version (v2, 150 €) -> 200, Status "Kostenvoranschlag angenommen"', `${fresh.status} ${accepted.quote.status}`);
      check(v1Msg?.feedbackRequest.status === 'expired' && v2Msg?.feedbackRequest.status === 'responded' && v2Msg.feedbackRequest.response?.value === 'quote_accept'
        && String(v2Msg.feedbackRequest.respondedById) === String(owner._id),
        'Thread: alte Rückfrage (v1) verfallen, aktuelle (v2) als "angenommen" beantwortet', `${v1Msg?.feedbackRequest.status} ${v2Msg?.feedbackRequest.status} ${v2Msg?.feedbackRequest.response?.value}`);
      check(decisionNote && decisionNote.actorType === 'customer' && !decisionNote.staffId && /Kunde/.test(decisionNote.staffName),
        'Verlauf (intern): Notiz "Kostenvoranschlag angenommen: 150,00 € (Version 2)" mit Akteur Kunde', decisionNote?.note);
      const ownerView = await call('GET', `/api/repair-requests/${mid}`, owner);
      check(ownerView.body?.request?.adminNotes === undefined && !JSON.stringify(ownerView.body).includes('Version 2) –'),
        'Kundensicht enthält die interne Verlaufsnotiz nicht', 'ok');
      // Dokument-Speicherung (Validierung aller adminNotes) funktioniert weiterhin mit Kunden-Verlaufseintrag
      const legacyMsg = await call('POST', `/api/repair-requests/${mid}/messages`, staff, { message: 'Altbestand-Notiz' });
      check(legacyMsg.status === 201, 'save() mit Kunden-Verlaufseintrag (ohne staffId) validiert weiterhin', `${legacyMsg.status} ${legacyMsg.body?.message}`);

      // 2) Gast: gleiche Bindung über den Gast-Link
      const guest = await newGuest('g-stale@test.invalid');
      const gid = String(guest.doc._id);
      await call('POST', `/api/repair-requests/${gid}/quote/send`, staff, { amount: 40 });
      await call('POST', `/api/repair-requests/${gid}/quote/send`, staff, { amount: 60 });
      const gStale = await call('POST', `/api/repair-requests/guest/${gid}/quote/respond`, null, { token: guest.token, email: guest.email, decision: 'accept', quoteVersion: 1, amount: 40 });
      const gOk = await call('POST', `/api/repair-requests/guest/${gid}/quote/respond`, null, { token: guest.token, email: guest.email, decision: 'decline', quoteVersion: 2, amount: 60 });
      const gStored = await RepairRequest.findById(gid).lean();
      const gNote = (gStored.adminNotes || []).find((n) => /Kostenvoranschlag abgelehnt: 60,00 €/.test(n.note));
      check(gStale.status === 409 && gStale.body?.code === 'QUOTE_CHANGED' && gOk.status === 200 && gStored.quote.status === 'declined' && gStored.status === 'reviewing'
        && gNote?.actorType === 'guest',
        'Gast: veraltete Version -> 409; aktuelle Version ablehnen -> declined, "In Prüfung", Verlaufsnotiz (Gast)', `${gStale.status} ${gOk.status} ${gStored.quote.status}`);

      // 3) Rückfrage-Antwort scheitert (Anfrage abgelehnt): Rückfrage NICHT als beantwortet gespeichert
      const r1 = await newMember(owner);
      const r1id = String(r1.doc._id);
      await call('POST', `/api/repair-requests/${r1id}/quote/send`, staff, { amount: 70 });
      await RepairRequest.updateOne({ _id: r1id }, { $set: { status: 'rejected' } }); // Ablehnung ohne Aufräumen (Wettlauf)
      const r1Msg = (await feedbackMsgs(r1id))[0];
      const r1Answer = await call('POST', `/api/repair-request-communication/${r1id}/feedback-response`, owner, { messageId: String(r1Msg._id), response: { value: 'quote_accept' } });
      const r1After = (await feedbackMsgs(r1id))[0];
      const r1Doc = await RepairRequest.findById(r1id).lean();
      check(r1Answer.status === 409 && r1After.feedbackRequest.status === 'expired' && !r1After.feedbackRequest.response?.value && r1Doc.quote.status === 'sent',
        'Antwort über Rückfrage bei abgelehnter Anfrage -> 409, Rückfrage verfallen (nicht "beantwortet"), quote unverändert', `${r1Answer.status} ${r1After.feedbackRequest.status} ${r1After.feedbackRequest.response?.value}`);

      // 4) Wettlauf: Kostenvoranschlag gerade auf Entwurf zurückgesetzt, Rückfrage noch offen
      const r2 = await newMember(owner);
      const r2id = String(r2.doc._id);
      await call('POST', `/api/repair-requests/${r2id}/quote/send`, staff, { amount: 55 });
      await RepairRequest.updateOne({ _id: r2id }, { $set: { 'quote.status': 'draft' } });
      const r2Msg = (await feedbackMsgs(r2id))[0];
      const r2Answer = await call('POST', `/api/repair-request-communication/${r2id}/feedback-response`, owner, { messageId: String(r2Msg._id), response: { value: 'quote_decline' } });
      const r2After = (await feedbackMsgs(r2id))[0];
      check(r2Answer.status === 409 && r2After.feedbackRequest.status === 'expired' && (await RepairRequest.findById(r2id).lean()).quote.status === 'draft',
        'Rückfrage-Antwort während Entwurf -> 409, Rückfrage verfallen, Entwurf unverändert', `${r2Answer.status} ${r2After.feedbackRequest.status}`);

      // 5) Karte (annehmen) parallel zur Rückfrage (ablehnen): Thread zeigt die tatsächliche Entscheidung
      const r3 = await newMember(owner);
      const r3id = String(r3.doc._id);
      await call('POST', `/api/repair-requests/${r3id}/quote/send`, staff, { amount: 99 });
      const r3Msg = (await feedbackMsgs(r3id))[0];
      const [cardRes, threadRes] = await Promise.all([
        call('POST', `/api/repair-requests/${r3id}/quote/respond`, owner, { decision: 'accept', quoteVersion: 1, amount: 99 }),
        call('POST', `/api/repair-request-communication/${r3id}/feedback-response`, owner, { messageId: String(r3Msg._id), response: { value: 'quote_decline' } }),
      ]);
      const r3Doc = await RepairRequest.findById(r3id).lean();
      const r3After = (await feedbackMsgs(r3id))[0];
      const expectedValue = r3Doc.quote.status === 'accepted' ? 'quote_accept' : 'quote_decline';
      const r3Thread = await RRComm.findOne({ repairRequestId: r3id }).lean();
      check([cardRes.status, threadRes.status].sort().join(',') === '200,409' && r3After.feedbackRequest.status === 'responded'
        && r3After.feedbackRequest.response?.value === expectedValue && r3Thread.pendingFeedbackCount === 0,
        'parallel Karte + Rückfrage: 200/409, Thread-Antwort = gespeicherte Entscheidung, keine offene Rückfrage', `${cardRes.status}/${threadRes.status} quote=${r3Doc.quote.status} thread=${r3After.feedbackRequest.response?.value} pending=${r3Thread.pendingFeedbackCount}`);

      // 6) Ablehnung bzw. Umwandlung lassen die offene Kostenvoranschlags-Rückfrage verfallen
      const r4 = await newMember(owner);
      const r4id = String(r4.doc._id);
      await call('POST', `/api/repair-requests/${r4id}/quote/send`, staff, { amount: 30 });
      await call('PUT', `/api/repair-requests/${r4id}/status`, staff, { status: 'rejected' });
      const r4After = (await feedbackMsgs(r4id))[0];
      const r4View = await call('GET', `/api/repair-requests/${r4id}`, owner);
      check(r4After.feedbackRequest.status === 'expired' && r4View.body?.request?.responseRequired === false,
        'Status "Abgelehnt": Rückfrage verfallen, keine "Antwort erforderlich"', `${r4After.feedbackRequest.status} ${r4View.body?.request?.responseRequired}`);
      const r5 = await newMember(owner, { deviceBrand: 'Fairphone', deviceModel: 'Fairphone 5' });
      const r5id = String(r5.doc._id);
      await call('POST', `/api/repair-requests/${r5id}/quote/send`, staff, { amount: 79 });
      const conv = await call('POST', `/api/repair-requests/${r5id}/convert`, staff, { services: [String(fpService._id)] });
      const r5After = (await feedbackMsgs(r5id))[0];
      check(conv.status === 201 && r5After.feedbackRequest.status === 'expired', 'Umwandlung: offene Kostenvoranschlags-Rückfrage verfallen', `${conv.status} ${r5After.feedbackRequest.status}`);

      // 7) "Kostenvoranschlag angenommen" ist kein manueller Status; Altbestand "approved" ohne Annahme ehrlich benannt
      const r6 = await newMember(owner);
      const r6id = String(r6.doc._id);
      const m0 = mails.length;
      const manualApproved = await call('PUT', `/api/repair-requests/${r6id}/status`, staff, { status: 'approved' });
      await tick(60);
      const r6Doc = await RepairRequest.findById(r6id).lean();
      check(manualApproved.status === 400 && manualApproved.body?.code === 'STATUS_APPROVED_MANUAL' && isGerman(manualApproved.body?.message)
        && r6Doc.status === 'pending' && mails.slice(m0).filter((m) => m.to === owner.email).length === 0,
        'PUT status approved durch Personal -> 400 deutsch, Status unverändert, keine "freigegeben"-Mail', `${manualApproved.status} ${r6Doc.status}`);
      await RepairRequest.updateOne({ _id: r6id }, { $set: { status: 'approved' } }); // Altbestand
      const r6View = await call('GET', `/api/repair-requests/${r6id}`, owner);
      const r6Staff = await call('GET', `/api/repair-requests/${r6id}`, staff);
      check(r6View.body?.request?.statusLabel === 'Freigegeben' && r6Staff.body?.request?.statusLabel === 'Freigegeben',
        'Altbestand "approved" ohne angenommenen Kostenvoranschlag heisst "Freigegeben" (nicht "Kostenvoranschlag angenommen")', `${r6View.body?.request?.statusLabel}`);

      // 8) Client: Karte sendet die gesehene Version mit; Badge nur, wenn eine Antwort möglich ist
      const card = fs.readFileSync(path.join(ROOT, 'client/src/components/repair-request/QuoteResponseCard.tsx'), 'utf8');
      const apiMember = fs.readFileSync(path.join(ROOT, 'client/src/api/repairRequests.ts'), 'utf8');
      const apiGuest = fs.readFileSync(path.join(ROOT, 'client/src/api/guestRepairRequest.ts'), 'utf8');
      check(/quoteVersion: quote\.version/.test(card) && /\{open && canRespond && \(\s*<span/.test(card)
        && /quoteVersion: seen\.quoteVersion/.test(apiMember) && /quoteVersion: seen\.quoteVersion/.test(apiGuest),
        'Client: Karte/API senden quoteVersion; "Antwort erforderlich" nur bei open && canRespond', 'ok');
    });

    // ===============================================================================
    await section('[RR-11/NOTIF-11] Status: "converted" nicht manuell; gleiche Änderung mailt nur einmal', async () => {
      const member = await newMember(owner);
      const id = String(member.doc._id);
      const conv = await call('PUT', `/api/repair-requests/${id}/status`, staff, { status: 'converted' });
      check(conv.status === 400 && isGerman(conv.body?.message), 'PUT status converted -> 400 deutsch', `${conv.status} ${conv.body?.message}`);
      const m0 = mails.length;
      await call('PUT', `/api/repair-requests/${id}/status`, staff, { status: 'reviewing' });
      await call('PUT', `/api/repair-requests/${id}/status`, staff, { status: 'reviewing' });
      await tick(80);
      const statusMails = mails.slice(m0).filter((m) => m.to === owner.email);
      check(statusMails.length === 1 && statusMails[0].trigger === 'repair_request_processing' && /\/my-repair-requests\?requestId=/.test(statusMails[0].vars.requestUrl),
        'zweimal derselbe Status -> genau 1 Mail mit gültigem Link', `${statusMails.length} ${statusMails[0]?.vars?.requestUrl}`);
      const notes = (await RepairRequest.findById(id).lean()).adminNotes.filter((n) => /Status geändert/.test(n.note));
      check(notes.length === 1 && /In Prüfung/.test(notes[0].note), 'genau 1 deutsche Statusnotiz', notes.map((n) => n.note).join('|'));
      const m1 = mails.length;
      await call('PUT', `/api/repair-requests/${id}/status`, staff, { status: 'rejected' });
      await tick(80);
      const rejectMail = mails.slice(m1).find((m) => m.to === owner.email);
      check(rejectMail && /abgelehnt/.test(rejectMail.vars.notificationTitle || ''), 'Ablehnung: Mail sagt "abgelehnt" (nicht "in Bearbeitung")', rejectMail?.vars?.notificationTitle);
    });

    // ===============================================================================
    await section('[RR-4/RR-12] Gerät zuordnen: Kundenangabe bleibt, eine Notiz, 409 nach Umwandlung', async () => {
      const member = await newMember(owner, { deviceBrand: 'Fairphone', deviceModel: 'Fairphone 5 (2023)' });
      const id = String(member.doc._id);
      const byCustomer = await call('PUT', `/api/repair-requests/${id}/device`, owner, { deviceModelId: String(fp5._id) });
      const match1 = await call('PUT', `/api/repair-requests/${id}/device`, staff, { deviceModelId: String(fp5._id) });
      const match2 = await call('PUT', `/api/repair-requests/${id}/device`, staff, { deviceModelId: String(fp5._id) });
      const stored = await RepairRequest.findById(id).lean();
      const notes = stored.adminNotes.filter((n) => /Gerät zugeordnet/.test(n.note));
      check(byCustomer.status === 403, 'Kunde PUT /:id/device -> 403', byCustomer.status);
      check(match1.status === 200 && match1.body?.changed === true && stored.deviceModel === 'Fairphone 5' && stored.deviceSource === 'catalog'
        && stored.reportedDevice.model === 'Fairphone 5 (2023)' && stored.reportedDevice.source === 'manual',
        'Personal ordnet zu: aktuelles Gerät = Katalog, reportedDevice = manuelle Kundenangabe', `${stored.deviceModel} / ${stored.reportedDevice.model}`);
      check(match2.body?.changed === false && notes.length === 1 && notes[0].staffName === 'Sophie Team', 'Wiederholung ohne neue Notiz; genau 1 Notiz mit Akteur', `${notes.length}`);

      const conv = await call('POST', `/api/repair-requests/${id}/convert`, staff, { services: [String(fpService._id)] });
      const order = await Order.findById(conv.body?.order?._id).lean();
      check(conv.status === 201 && order.deviceModel === 'Fairphone 5' && order.reportedDevice?.model === 'Fairphone 5 (2023)'
        && String(order.customerId?._id || order.customerId) === String(owner._id) && /Aus Reparaturanfrage/.test(order.customerNotes),
        'Umwandlung: Auftrag mit zugeordnetem Gerät, reportedDevice = Kundenangabe, deutsche Notiz', `${conv.status} ${order?.deviceModel} / ${order?.reportedDevice?.model}`);
      const after = await call('PUT', `/api/repair-requests/${id}/device`, staff, { deviceModelId: String(iphone15._id) });
      check(after.status === 409 && isGerman(after.body?.message), 'nach Umwandlung -> 409 "im Auftrag korrigieren"', `${after.status} ${after.body?.message}`);
      const own = await call('GET', `/api/repair-requests/${id}`, owner);
      check(own.body?.request?.convertedOrder?.path === `/orders/${order._id}` && own.body?.request?.convertedOrder?.orderNumber === order.orderNumber,
        'Mitglied sieht Link zum Auftrag', JSON.stringify(own.body?.request?.convertedOrder));
    });

    // ===============================================================================
    await section('[RR-10/RR-11/RR-20] Umwandlung: atomar, Gast bleibt Gast, kein Label ohne Wahl', async () => {
      const guest = await newGuest('g-convert@test.invalid', { deviceSource: 'catalog', deviceModelId: String(iphone15._id) });
      const id = String(guest.doc._id);
      const ordersBefore = await Order.countDocuments();
      const bookingsBefore = await Booking.countDocuments();
      const labelsBefore = labelCalls;
      const mBefore = mails.length;
      const [r1, r2] = await Promise.all([
        call('POST', `/api/repair-requests/${id}/convert`, staff, { services: [String(display._id)] }),
        call('POST', `/api/repair-requests/${id}/convert`, admin, { services: [String(display._id)] }),
      ]);
      const statuses = [r1.status, r2.status].sort();
      check(statuses[0] === 201 && statuses[1] === 409, 'zwei parallele Umwandlungen -> 201 + 409', statuses.join(','));
      check((await Order.countDocuments()) === ordersBefore + 1 && (await Booking.countDocuments()) === bookingsBefore + 1,
        'genau 1 Auftrag und 1 Buchung', `${(await Order.countDocuments()) - ordersBefore} ${(await Booking.countDocuments()) - bookingsBefore}`);
      const okRes = r1.status === 201 ? r1 : r2;
      const order = await Order.findById(okRes.body.order._id).lean();
      const booking = await Booking.findById(order.bookingId).lean();
      check(!order.customerId && order.guestInfo?.isGuest === true && order.guestInfo.email === 'g-convert@test.invalid'
        && order.guestInfo.firstName === 'Gisela' && order.guestInfo.lastName === 'Gast Müller' && Boolean(order.guestTrackingToken),
        'Gast-Auftrag: guestInfo (Gast bleibt Gast), Tracking-Token', JSON.stringify(order.guestInfo).slice(0, 120));
      check(booking && booking.guestInfo?.isGuest === true && Boolean(booking.guestTrackingToken), 'Gast-Buchung mit Tracking-Token', Boolean(booking?.guestTrackingToken));
      check(labelCalls === labelsBefore, 'ohne ausdrückliche Wahl: 0 DHL-Labelaufrufe', labelCalls - labelsBefore);
      await tick(100);
      const guestBookingMails = mails.slice(mBefore).filter((m) => m.trigger === 'guest_booking_created' && m.to === 'g-convert@test.invalid');
      check(guestBookingMails.length === 1, 'genau 1 Gast-Buchungsmail', guestBookingMails.length);
      const tracked = await call('GET', `/api/repair-requests/guest/track?token=${guest.token}&email=${encodeURIComponent(guest.email)}`);
      check(tracked.body?.request?.status === 'converted' && /^\/track-order\/booking\?token=/.test(tracked.body?.request?.convertedOrder?.path || '')
        && tracked.body?.request?.convertedOrder?.orderNumber === order.orderNumber,
        'Gast sieht "Auftrag verfolgen"-Link auf die Buchung', tracked.body?.request?.convertedOrder?.path);
      if (trackingMounted) {
        const bookingTrack = await call('GET', `/api/track-order/booking?token=${booking.guestTrackingToken}&email=${encodeURIComponent('g-convert@test.invalid')}`);
        check(bookingTrack.status === 200, 'Gast-Buchungstracking mit diesem Token -> 200', bookingTrack.status);
      }

      const member = await newMember(owner);
      const labelled = await call('POST', `/api/repair-requests/${member.doc._id}/convert`, staff, { services: [String(fpService._id)], shippingMode: 'inbound_label' });
      check(labelled.status === 201 && labelCalls === labelsBefore + 1, 'mit Wahl "eingesendet": genau 1 Labelaufruf', `${labelled.status} ${labelCalls - labelsBefore}`);
      const empty = await newMember(owner);
      const noServices = await call('POST', `/api/repair-requests/${empty.doc._id}/convert`, staff, { services: [] });
      check(noServices.status === 400 && isGerman(noServices.body?.message), 'ohne Leistung -> 400 deutsch', noServices.status);
      const del = await call('DELETE', `/api/repair-requests/${id}`, staff);
      check(del.status === 409, 'umgewandelte Anfrage löschen -> 409', del.status);
    });

    // ===============================================================================
    await section('[COMMS-10/11/15, NOTIF-12] Nachrichten: Empfänger, Idempotenz, ungelesen, Antwort ausstehend', async () => {
      const member = await newMember(owner);
      const id = String(member.doc._id);
      const n0 = notifications.length;
      const send = await call('POST', `/api/repair-request-communication/${id}/message`, owner, { content: 'Wann ist mein Gerät fertig?', clientMessageId: 'cm-1' });
      const dup = await call('POST', `/api/repair-request-communication/${id}/message`, owner, { content: 'Wann ist mein Gerät fertig?', clientMessageId: 'cm-1' });
      const thread = await RRComm.findOne({ repairRequestId: id }).lean();
      const adminNotes = notifications.slice(n0).filter((n) => n.data.metadata?.messageType === 'text' && String(n.data.metadata?.repairRequestId) === id);
      check(send.status === 201 && dup.status === 200 && dup.body?.duplicate === true && thread.messages.length === 1,
        'gleiche clientMessageId zweimal -> 1 Nachricht', `${send.status} ${dup.status} ${thread.messages.length}`);
      check(adminNotes.length === 2 && adminNotes.every((n) => isGerman(n.data.title) && /^\/admin\/repair-requests\?requestId=/.test(n.data.actionUrl)),
        'unzugewiesen: beide aktiven Admins benachrichtigt (deutsch, Deep-Link), keine Doppelbenachrichtigung', adminNotes.map((n) => n.data.title).join(' | '));

      const parallel = await Promise.all([1, 2, 3].map(() => call('POST', `/api/repair-request-communication/${id}/message`, owner, { content: 'Doppelt?', clientMessageId: 'cm-par' })));
      const t2 = await RRComm.findOne({ repairRequestId: id }).lean();
      check(t2.messages.filter((m) => m.clientMessageId === 'cm-par').length === 1 && (await RRComm.countDocuments({ repairRequestId: id })) === 1,
        '3 parallele gleiche Sendungen -> 1 Nachricht, 1 Thread', parallel.map((p) => p.status).join(','));

      const unread = async (user) => (await call('GET', `/api/repair-request-communication/${id}/unread-count`, user)).body;
      let a1 = await unread(admin); let a2 = await unread(admin2); let c = await unread(owner);
      check(a1.unreadCount === 2 && a2.unreadCount === 2 && a1.awaitingReply === true && c.unreadCount === 0,
        'Kunde schreibt: Admin1/Admin2 je 2 ungelesen, Antwort ausstehend; Kunde zählt eigene nicht', `${a1.unreadCount} ${a2.unreadCount} ${a1.awaitingReply} ${c.unreadCount}`);
      await call('PUT', `/api/repair-request-communication/${id}/mark-read`, admin, {});
      a1 = await unread(admin); a2 = await unread(admin2);
      check(a1.unreadCount === 0 && a2.unreadCount === 2 && a1.awaitingReply === true, 'Admin1 liest: nur Admin1 = 0, Antwort weiter ausstehend', `${a1.unreadCount} ${a2.unreadCount} ${a1.awaitingReply}`);
      await call('POST', `/api/repair-request-communication/${id}/message`, staff, { content: 'Morgen ist es fertig.' });
      a2 = await unread(admin2); c = await unread(owner);
      check(a2.awaitingReply === false && a2.unreadCount === 2 && c.unreadCount === 1, 'Team antwortet: nicht mehr ausstehend; Staff-Nachricht zählt nicht für Admin2; Kunde 1 ungelesen', `${a2.awaitingReply} ${a2.unreadCount} ${c.unreadCount}`);
      await call('PUT', `/api/repair-request-communication/${id}/mark-read`, owner, {});
      c = await unread(owner);
      check(c.unreadCount === 0, 'Kunde liest -> 0', c.unreadCount);

      const list = await call('GET', `/api/repair-requests?search=${encodeURIComponent(member.doc.requestNumber)}`, admin2);
      const item = (list.body?.requests || [])[0];
      check(item && item.communicationSummary?.unreadCount === 2 && item.communicationSummary?.awaitingReply === false, 'Admin-Liste liefert Zusammenfassung je Anfrage (kein N+1)', JSON.stringify(item?.communicationSummary));

      // Gast: Team-Nachricht -> Mail an Gast mit Tracking-Link; Gast-Nachricht -> Admins
      const guest = await newGuest('g-msg@test.invalid');
      const m0 = mails.length;
      await call('POST', `/api/repair-request-communication/${guest.doc._id}/message`, staff, { content: 'Bitte senden Sie uns ein Foto.' });
      const guestMail = mails.slice(m0).find((m) => m.to === 'g-msg@test.invalid');
      check(guestMail && guestMail.trigger === 'system_notification' && /\/guest-repair-tracking\?token=/.test(guestMail.vars.ctaUrl),
        'Team-Nachricht an Gast -> E-Mail mit Tracking-/Antwort-Link', guestMail?.vars?.ctaUrl);
      const n1 = notifications.length;
      const gsend = await call('POST', `/api/repair-requests/guest/${guest.doc._id}/message`, null, { token: guest.token, email: guest.email, content: 'Foto folgt.' });
      const gNotes = notifications.slice(n1).filter((n) => String(n.data.metadata?.repairRequestId) === String(guest.doc._id));
      check(gsend.status === 201 && gNotes.length === 2, 'Gast-Nachricht -> Admins benachrichtigt', `${gsend.status} ${gNotes.length}`);

      // zugewiesen: nur der zugewiesene Mitarbeiter
      await call('PUT', `/api/repair-requests/${id}/assign`, admin, { staffId: String(staff._id) });
      const n2 = notifications.length;
      await call('POST', `/api/repair-request-communication/${id}/message`, owner, { content: 'Danke!' });
      const assignedNotes = notifications.slice(n2).filter((n) => String(n.data.metadata?.repairRequestId) === id);
      check(assignedNotes.length === 1 && String(assignedNotes[0].data.userId) === String(staff._id) && /^\/staff\/repair-requests\?requestId=/.test(assignedNotes[0].data.actionUrl),
        'zugewiesen: nur Mitarbeiter, Staff-Deep-Link', assignedNotes.map((n) => n.data.actionUrl).join(','));
    });

    // ===============================================================================
    await section('[RR-14/COMMS-14] Liste: Serverseitige Seiten, Projektion, Sonderzeichen in der Suche', async () => {
      for (let i = 0; i < 25; i += 1) {
        await RepairRequest.create({
          customerId: stranger._id, customerName: 'Seiten Test', customerEmail: stranger.email, customerPhone: '1',
          deviceType: 'Tablet', deviceBrand: 'Pagination', deviceModel: `Tab ${i}`, issueDescription: issue,
        });
      }
      const p1 = await call('GET', '/api/repair-requests?search=Pagination&page=1&limit=20', staff);
      const p2 = await call('GET', '/api/repair-requests?search=Pagination&page=2&limit=20', staff);
      check(p1.status === 200 && p1.body.requests.length === 20 && p2.body.requests.length === 5 && p2.body.pagination.total === 25,
        'Seite 2 liefert die restlichen 5', `${p1.body?.requests?.length} ${p2.body?.requests?.length} ${p2.body?.pagination?.total}`);
      const item = p1.body.requests[0];
      check(item.deviceType === 'Tablet' && 'estimatedCost' in item && 'deviceSource' in item && 'effectiveQuote' in item && 'isGuest' in item,
        'Listeneintrag enthält Typ, Kosten, Quelle, Kostenvoranschlag, Gast-Kennzeichen', Object.keys(item).slice(0, 30).join(','));
      const special = await call('GET', `/api/repair-requests?search=${encodeURIComponent('(')}`, staff);
      const special2 = await call('GET', `/api/repair-request-communication?search=${encodeURIComponent('[')}`, staff);
      check(special.status === 200 && special2.status === 200, 'Suche "(" / "[" -> 200 statt 500', `${special.status} ${special2.status}`);
      const customerList = await call('GET', '/api/repair-request-communication', owner);
      check(customerList.status === 200 && (customerList.body.communications || []).every((c) => c.customer === null), 'Kunde: Kommunikationsliste nur eigene, ohne Kundendaten', customerList.body?.totalCount);
      const mine = await call('GET', '/api/repair-requests/my-requests', owner);
      check(mine.status === 200 && mine.body.requests.every((r) => r.adminNotes === undefined && r.priority === undefined), 'my-requests: Kundensicht ohne adminNotes/Priorität', mine.body?.requests?.length);
    });
    // ===============================================================================
    await section('[RR-2/RR-17/RR-11] Client-Quelltext: Gerätevertrag, kein Altspeicher, kein manuelles "Umgewandelt"', async () => {
      const read = (rel) => fs.readFileSync(path.join(ROOT, 'client/src', rel), 'utf8');
      const questionnaire = read('pages/RepairRequestQuestionnaire.tsx');
      const admin = read('pages/admin/RepairRequestsManagement.tsx');
      check(!/split\(\s*["'] ["']\s*\)\[0\]/.test(questionnaire) && /deviceSource/.test(questionnaire) && /Mein Gerät ist nicht aufgeführt/.test(questionnaire + read('components/repair-request/CatalogDevicePicker.tsx')),
        'Fragebogen: keine Markenschätzung aus dem Freitext, sendet deviceSource, "Mein Gerät ist nicht aufgeführt" vorhanden', 'ok');
      check(!/Gerät aus Datenbank wählen/.test(questionnaire), 'Fragebogen: kein Katalog-Modal mehr', 'ok');
      check(!/addRepairRequestMessage/.test(admin), 'Admin: "Nachricht senden" schreibt nicht mehr in RepairRequest.messages', 'ok');
      check(/\{isConverted && <option value="converted">/.test(admin) && !/<SelectItem value="converted">Umgewandelt<\/SelectItem>/.test(admin),
        'Admin: "Umgewandelt" nicht manuell wählbar', 'ok');
      check(!/min-width:\s*1420px/.test(admin) && /Öffnen/.test(admin) && /Kostenvoranschlag an Kunden senden/.test(admin) && /Interne Notiz speichern/.test(admin),
        'Admin: sichtbare Aktionen "Öffnen", "Kostenvoranschlag an Kunden senden", "Interne Notiz speichern"', 'ok');
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
