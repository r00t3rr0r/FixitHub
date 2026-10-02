/**
 * Regressionstest (Track history, 01.10.2026): Auftragsverlauf - ein Vertrag, ehrliche Meilensteine,
 * vollstaendige und idempotente Eintraege, getrennte Sicht fuer Personal / Kunde / Gast.
 *
 * Echte Express-Routen + echte DB (Wegwerf-mongod) + Rollen (Kunde, fremder Kunde, Personal, Admin, Gast).
 *   [A] Statusmenue: deutscher Eintrag mit from/to, Akteur, Grund; gleicher Status -> kein 2. Eintrag und
 *       keine 2. Benachrichtigung; unbekannter Status -> 400 deutsch, Auftrag unveraendert; Storno -> Fortschritt 0;
 *       interne Notiz geht nicht in die Kundenbenachrichtigung (HIST-2/6/7).
 *   [B] GET /progress-timeline: nie erreichte Stufen 'skipped' statt "abgeschlossen", echte ISO-Zeit,
 *       Kunde ohne Mitarbeiternamen, fremder Kunde 403 (HIST-1).
 *   [C] Positionen (POST/PUT /api/order-services): Eintrag im selben Speichervorgang mit Akteur, from/to,
 *       Grund; Revision per refs.revisionId verknuepft; GET /history zeigt sie nicht doppelt (HIST-3/5a).
 *   [D] Shop-Produkte hinzufuegen/Menge/entfernen -> je ein Eintrag mit Name, Menge, Wert, Akteur (HIST-4).
 *   [E] Zusatzleistung: Finanzabgleich schlaegt fehl -> 200 MIT warnings; reiner Wiederholungs-Tick ohne
 *       Aenderung -> kein Eintrag (HIST-5b/6).
 *   [F] Personalzuweisung: echter Akteur, alt/neu; Wiederholung -> kein Eintrag (HIST-8/6).
 *   [G] Geraetewechsel: Typ/Marke/Modell + Grund + Quelle strukturiert, Beschreibungsanfang fuer den
 *       Pruefbericht unveraendert, reportedDevice bleibt; identische Wiederholung -> 409 ohne Eintrag;
 *       Bestaetigung mit Akteur genau einmal; Alt-Route PUT /:id/device nutzt denselben Pfad (HIST-9).
 *   [H] Abholung bestaetigen: parallel doppelt -> genau ein Eintrag, actualCompletion gesetzt (HIST-13).
 *   [I] Entsperrdaten: Pause mit Verlauf-Markierung + 'Unlock Incorrect'; Fortsetzung ueber den Helfer (HIST-13).
 *   [J] Template-Workflow: gleicher Status doppelt -> ein Eintrag; parallel zweimal Schritt abschliessen ->
 *       genau ein Eintrag, eine 409 (HIST-6).
 *   [K] Sichtbarkeit: interne Alteintraege (Pausengrund, DHL-Abgleich, Mitarbeitername) nie fuer Kunde/Gast;
 *       Personal sieht sie (HIST-15).
 *   [L] GET /history: Rechnung/Zahlung zusammengefuehrt mit Link, Typfilter, Rollen (HIST-CONTRACT).
 *   [M] Nachbesserung nach Review: PARALLELE Doppelklicks (Status, Zuweisung, Workflow-Pause,
 *       Positionspreis) -> genau ein Eintrag / eine Benachrichtigung, ehrliches "von"; Wiederholung mit
 *       Grund ohne Leer-Eintrag; personalbezogene Auftragsfelder (Abholung, Entsperrpruefung,
 *       Zusatzleistungs-Zuweisung) weder fuer Kunde noch Gast; Entsperr-Anforderung bei bereits
 *       pausiertem Auftrag; Meilensteine ohne erfundene Stufe (HIST-6/3/15/13/1).
 *
 * MOCKS: Benachrichtigungen, E-Mails, DHL - keine echte Nachricht, kein Label. Datei-Logs werden umgeleitet.
 * Aufruf (nur WEGWERF-Datenbank):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_history_contract node test-history-contract.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const Module = require('module');

const ROOT = __dirname;
const SERVER_DIR = path.join(ROOT, 'server');
const LOG_DIR = path.join(SERVER_DIR, 'logs');
const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_history_contract';

// Sicherheitsnetz: dropDatabase() nur gegen eine ausdruecklich angegebene Wegwerf-Datenbank.
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
const LOG_REDIRECT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'history-contract-logs-'));
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

// 'qrcode' fehlt lokal (nur PDF-Erzeugung)
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
const isGerman = (text) => /[äöüÄÖÜß]|Auftrag|Bitte|nicht|wurde|Unbekannt|Zugriff/.test(String(text || ''))
  && !/denied|not found|required|failed|successfully|Cast to|validation/i.test(String(text || ''));
const ENGLISH = /initiated|Status changed|Order placed|Assigned to|completed in workflow|Reason:/;

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

  // ---- MOCKS: keine echten E-Mails / Benachrichtigungen / DHL ----
  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  ['sendOrderConfirmationEmail', 'sendTriggerEmail', 'sendTemplateEmail', 'sendEmail', 'sendInvoiceEmail'].forEach((name) => {
    EmailService[name] = async () => ({ success: true, mocked: true });
  });
  EmailService.buildSystemUrl = async (p) => `http://test.invalid${p}`;
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  const notifications = [];
  NotificationService.createNotification = async (data) => {
    notifications.push(data);
    return { _id: new mongoose.Types.ObjectId(), ...data };
  };
  const DHLService = require(path.join(SERVER_DIR, 'services/dhlService'));
  DHLService.createShipment = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };
  DHLService.getTrackingInfo = async () => { throw new Error('DHL darf in diesem Test nicht aufgerufen werden'); };

  const OrderService = require(path.join(SERVER_DIR, 'services/orderService'));
  const FinancialService = require(path.join(SERVER_DIR, 'services/financialService'));
  const OrderHistory = require(path.join(SERVER_DIR, 'utils/orderHistory'));
  const DeviceInspectionService = require(path.join(SERVER_DIR, 'services/deviceInspectionService'));

  const app = express();
  app.use(express.json());
  app.use('/api/orders', require(path.join(SERVER_DIR, 'routes/orderRoutes')));
  app.use('/api/admin/orders', require(path.join(SERVER_DIR, 'routes/adminOrderRoutes')));
  app.use('/api/order-services', require(path.join(SERVER_DIR, 'routes/orderServiceRoutes')));
  app.use('/api/track-order', require(path.join(SERVER_DIR, 'routes/orderTrackingRoutes')));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Service = mongoose.model('Service');
  const Product = mongoose.model('Product');
  const readStored = async (id) => mongoose.connection.db.collection('orders').findOne({ _id: new mongoose.Types.ObjectId(String(id)) });
  const entriesOf = async (id, key) => ((await readStored(id))?.timeline || []).filter((e) => !key || e.status === key);

  const owner = await User.create({ name: 'Kunde Eigentuemer', email: 'hist-owner@test.invalid', role: 'customer' });
  const stranger = await User.create({ name: 'Kunde Fremd', email: 'hist-stranger@test.invalid', role: 'customer' });
  const staff = await User.create({ name: 'Sophie Technik', email: 'hist-staff@test.invalid', role: 'staff' });
  const staff2 = await User.create({ name: 'Tom Technik', email: 'hist-staff2@test.invalid', role: 'staff' });
  const admin = await User.create({ name: 'Admin Verlauf', email: 'hist-admin@test.invalid', role: 'admin' });
  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, user, body) => {
    const headers = { 'Content-Type': 'application/json' };
    if (user) headers.Authorization = `Bearer ${tokenFor(user)}`;
    const response = await fetch(`${baseUrl}${url}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    let json = null;
    try { json = await response.json(); } catch (error) { json = null; }
    return { status: response.status, body: json };
  };

  const display = await Service.create({
    category: 'display', deviceTypes: ['Smartphone'], manufacturerPrecise: 'Apple', modelPrecise: 'iPhone 15',
    name: 'Displaytausch iPhone 15', price: 100, estimatedTime: '60',
  });
  const ipadDisplay = await Service.create({
    category: 'display', deviceTypes: ['Tablet'], manufacturerPrecise: 'Apple', modelPrecise: 'iPad Pro',
    name: 'Displaytausch iPad Pro', price: 180, estimatedTime: '90',
  });
  const newOrder = async (customer = owner) => OrderService.create({
    customerId: customer._id, deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone',
    errorDescription: 'Display defekt', services: [String(display._id)],
  });

  try {
    // =================================================================================
    await section('[A] Statusmenue: deutscher Eintrag, Idempotenz, Validierung, kein interner Text an Kunden', async () => {
      const order = await newOrder();
      const id = String(order._id);
      const before = (await entriesOf(id)).length;
      notifications.length = 0;

      const first = await call('PUT', `/api/admin/orders/${id}/status`, admin, { status: 'diagnostic-assessment', note: 'INTERN: Kunde schwierig' });
      const after1 = await entriesOf(id);
      const entry = after1[after1.length - 1];
      const autoAssigned = after1.filter((e) => e.status === 'Staff Assigned');
      check(first.status === 200 && after1.length === before + 2 && after1.filter((e) => e.status === 'Order Status Updated').length === 1,
        'PUT status: genau ein Statuseintrag (+ ein Eintrag fuer die implizite Zuweisung)', `${first.status} ${before}->${after1.length}`);
      check(autoAssigned.length === 1 && autoAssigned[0].source === 'automatisch bei Bearbeitung' && autoAssigned[0].staffName === 'Admin Verlauf',
        'implizite Personalzuweisung wird protokolliert (HIST-8, frueher ohne Eintrag)', JSON.stringify(autoAssigned.map((e) => [e.source, e.staffName])));
      check(entry.status === 'Order Status Updated' && entry.type === 'status' && /Status geändert: Ausstehend → Diagnosebewertung/.test(entry.description),
        'Eintrag deutsch mit stabilem Schluessel', `${entry.status} | ${entry.description}`);
      check(entry.changes?.[0]?.from === 'pending' && entry.changes?.[0]?.to === 'diagnostic-assessment' && entry.staffName === 'Admin Verlauf'
        && entry.reason === 'INTERN: Kunde schwierig' && entry.source === 'Statusmenü',
        'from/to, echter Akteur, Grund und Quelle gespeichert', JSON.stringify({ c: entry.changes, n: entry.staffName, r: entry.reason }));
      const customerMessages = notifications.filter((n) => String(n.userId) === String(owner._id)).map((n) => n.message || '');
      check(customerMessages.length === 1 && !customerMessages.some((m) => /INTERN|Kunde schwierig/.test(m)) && !customerMessages.some((m) => ENGLISH.test(m)),
        'Kundenbenachrichtigung: genau eine, ohne interne Notiz, ohne Englisch', JSON.stringify(customerMessages));

      const again = await call('PUT', `/api/admin/orders/${id}/status`, admin, { status: 'diagnostic-assessment' });
      const after2 = await entriesOf(id);
      check(again.status === 200 && again.body?.unchanged === true && after2.length === after1.length,
        'gleicher Status erneut: 200 unchanged, kein zweiter Eintrag', `${again.status} ${again.body?.unchanged} ${after1.length}->${after2.length}`);
      check(notifications.filter((n) => String(n.userId) === String(owner._id)).length === 1, 'keine zweite Benachrichtigung', notifications.length);

      const invalid = await call('PUT', `/api/admin/orders/${id}/status`, admin, { status: 'diagnosed' });
      const storedAfterInvalid = await readStored(id);
      check(invalid.status === 400 && isGerman(invalid.body?.error) && storedAfterInvalid.status === 'diagnostic-assessment',
        'unbekannter Status (frueher 500 englisch): 400 deutsch, Auftrag unveraendert', `${invalid.status} ${invalid.body?.error} ${storedAfterInvalid.status}`);
      const invalid2 = await call('PUT', `/api/orders/${id}/status`, staff, { status: 'on-hold' });
      check(invalid2.status === 400 && isGerman(invalid2.body?.error), 'zweite Statusroute validiert ebenfalls', `${invalid2.status} ${invalid2.body?.error}`);
      const customerTry = await call('PUT', `/api/admin/orders/${id}/status`, owner, { status: 'completed' });
      check(customerTry.status === 403, 'Kunde darf Status nicht aendern', customerTry.status);

      await Order.updateOne({ _id: id }, { $set: { progress: 60 } });
      const cancel = await call('PUT', `/api/admin/orders/${id}/status`, admin, { status: 'cancelled', reason: 'Kunde zieht zurück' });
      const cancelled = await readStored(id);
      const cancelEntry = cancelled.timeline[cancelled.timeline.length - 1];
      check(cancel.status === 200 && cancelled.progress === 0 && cancelEntry.reason === 'Kunde zieht zurück',
        'Storno: Fortschritt 0 (frueher blieb 60), Grund im Eintrag', `${cancelled.progress} ${cancelEntry.reason}`);
    });

    // =================================================================================
    await section('[B] Ehrliche Meilensteine (GET /api/orders/:id/progress-timeline)', async () => {
      const order = await newOrder();
      const id = String(order._id);
      await call('PUT', `/api/admin/orders/${id}/status`, admin, { status: 'diagnostic-assessment' });
      await call('PUT', `/api/admin/orders/${id}/status`, admin, { status: 'completed' });
      const stored = await readStored(id);
      const diagEntry = stored.timeline.find((e) => e.changes?.[0]?.to === 'diagnostic-assessment');

      const res = await call('GET', `/api/orders/${id}/progress-timeline`, admin);
      const byId = Object.fromEntries((res.body?.stages || []).map((s) => [s.id, s]));
      check(res.status === 200 && byId.repair?.state === 'skipped' && byId['quality-check']?.state === 'skipped'
        && byId.repair?.status !== 'completed' && byId.repair?.note === 'Übersprungen – nicht erfasst',
        'nie erreichte Stufen: skipped "Übersprungen – nicht erfasst" (frueher "Abgeschlossen")', JSON.stringify([byId.repair, byId['quality-check']].map((s) => s && [s.state, s.status, s.note])));
      check(byId.diagnostic?.state === 'reached' && byId.diagnostic?.reachedAt === new Date(diagEntry.completedAt).toISOString()
        && /^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/.test(byId.diagnostic?.date || '') && byId.diagnostic?.actorName === 'Admin Verlauf',
        'erreichte Stufe: echter Zeitpunkt (ISO + de-DE) und Akteur', `${byId.diagnostic?.reachedAt} ${byId.diagnostic?.date} ${byId.diagnostic?.actorName}`);
      check(byId.pickup?.state === 'reached' && byId.pickup?.label === 'Reparatur abgeschlossen', 'Reparatur abgeschlossen erreicht', JSON.stringify(byId.pickup));

      const own = await call('GET', `/api/orders/${id}/progress-timeline`, owner);
      check(own.status === 200 && !JSON.stringify(own.body).includes('Admin Verlauf') && (own.body?.stages || []).every((s) => s.actorName === undefined),
        'Kunde: Meilensteine ohne Mitarbeiternamen', own.status);
      const foreign = await call('GET', `/api/orders/${id}/progress-timeline`, stranger);
      check(foreign.status === 403, 'fremder Kunde: 403', foreign.status);

      const fresh = await newOrder();
      const freshRes = await call('GET', `/api/orders/${fresh._id}/progress-timeline`, admin);
      const freshStages = freshRes.body?.stages || [];
      check(freshStages[0]?.state === 'current' && freshStages.slice(1).every((s) => s.state === 'pending'),
        'neuer Auftrag: nur "Auftrag erhalten" aktuell, Rest offen', JSON.stringify(freshStages.map((s) => s.state)));
    });

    // =================================================================================
    await section('[C] Positionen: Eintrag atomar mit Akteur/Grund, Revision verknuepft, kein Duplikat', async () => {
      const order = await newOrder();
      const id = String(order._id);
      const add = await call('POST', `/api/order-services/${id}`, staff, { isManual: true, name: 'Reinigung', price: 10, reason: 'Kunde wünscht' });
      const lineId = String((add.body?.order?.services || []).find((s) => s.name === 'Reinigung')?._id || '');
      const upd = await call('PUT', `/api/order-services/${id}/${lineId}`, staff, { price: 15, reason: 'Preis korrigiert' });
      const entries = await entriesOf(id, 'Order Services Changed');
      check(add.status === 201 && upd.status === 200 && entries.length === 2, 'zwei Verlaufseintraege fuer zwei Positionsaenderungen', `${add.status} ${upd.status} ${entries.length}`);
      const priceEntry = entries[1] || {};
      const priceChange = (priceEntry.changes || []).find((c) => c.field === 'services.price');
      check(priceEntry.staffName === 'Sophie Technik' && priceChange?.from === 10 && priceChange?.to === 15 && priceEntry.reason === 'Preis korrigiert'
        && priceEntry.type === 'pricing', 'Preisaenderung: Akteur, 10 -> 15, Grund, Art "pricing"', JSON.stringify({ n: priceEntry.staffName, priceChange, r: priceEntry.reason, t: priceEntry.type }));
      check(entries[0].reason === 'Kunde wünscht' && (entries[0].changes || []).some((c) => c.field === 'totalCost'), 'Hinzufuegen: Grund und Auftragswert alt/neu', JSON.stringify(entries[0].changes));
      const revisions = await mongoose.connection.db.collection('orderrevisions').find({ orderId: order._id }).toArray();
      const linked = entries.every((e) => revisions.some((r) => String(r._id) === String(e.refs?.revisionId)));
      check(linked, 'refs.revisionId zeigt auf die OrderRevision', JSON.stringify(entries.map((e) => e.refs)));

      const history = await call('GET', `/api/orders/${id}/history`, admin);
      const linkedIds = entries.map((e) => String(e.refs?.revisionId));
      const historyEntries = history.body?.entries || [];
      const timelineViews = historyEntries.filter((e) => e.key === 'Order Services Changed');
      const duplicateRevisions = historyEntries.filter((e) => e.origin === 'revision' && linkedIds.includes(String(e.refs?.revisionId)));
      const unlinkedRevisions = historyEntries.filter((e) => e.origin === 'revision');
      check(history.status === 200 && timelineViews.length === 2 && duplicateRevisions.length === 0,
        'GET /history: genau 2 Eintraege fuer die 2 Aenderungen (verknuepfte Revisionen nicht doppelt)',
        JSON.stringify(historyEntries.map((e) => [e.origin, e.title])));
      check(unlinkedRevisions.length === 1 && /Auftragswert bei Anlage/.test(unlinkedRevisions[0].description),
        'nicht verknuepfte Alt-Revision (Anlage) erscheint einmal als Änderungsbeleg', unlinkedRevisions.map((e) => e.description).join(' | '));
      const priceView = (history.body?.entries || []).find((e) => e.type === 'pricing' && e.key === 'Order Services Changed');
      check(priceView && priceView.link?.kind === 'revision' && /Änderungsbeleg #\d+/.test(priceView.link?.label || '')
        && priceView.changes.some((c) => c.fromText === '10,00 €' && c.toText === '15,00 €'),
        'Ansicht: Link "Änderungsbeleg #n" und formatierte Betraege', JSON.stringify(priceView && { link: priceView.link, ch: priceView.changes }));
    });

    // =================================================================================
    await section('[D] Shop-Produkte: hinzufuegen / Menge / entfernen werden protokolliert', async () => {
      const order = await newOrder();
      const id = String(order._id);
      const product = await Product.create({ name: 'Panzerglas', brand: 'Testmarke', category: 'Screen Protectors', description: 'Schutzglas', price: 9.9, stock: 50 });
      const add = await call('POST', `/api/admin/orders/${id}/shop-products`, staff, { productId: String(product._id), quantity: 1 });
      const itemId = String((await readStored(id)).shopProducts?.[0]?._id || '');
      const qty = await call('PUT', `/api/admin/orders/${id}/shop-products/${itemId}`, staff, { quantity: 3 });
      const del = await call('DELETE', `/api/admin/orders/${id}/shop-products/${itemId}`, staff2);
      const entries = await entriesOf(id, 'Order Products Changed');
      check(add.status === 200 && qty.status === 200 && del.status === 200 && entries.length === 3, '3 Eintraege fuer 3 Produktaenderungen', `${add.status} ${qty.status} ${del.status} ${entries.length}`);
      const qtyChange = (entries[1]?.changes || []).find((c) => c.field === 'shopProducts.quantity');
      check(/Panzerglas/.test(entries[0]?.description) && qtyChange?.from === 1 && qtyChange?.to === 3 && entries[1]?.staffName === 'Sophie Technik',
        'Name, Menge 1 -> 3, Akteur', JSON.stringify({ d: entries[0]?.description, qtyChange, n: entries[1]?.staffName }));
      check(/Panzerglas/.test(entries[2]?.description) && entries[2]?.staffName === 'Tom Technik' && (entries[2]?.changes || []).some((c) => c.field === 'totalCost'),
        'Entfernen nennt das Produkt (frueher ohne Namen) und den Akteur', entries[2]?.description);
    });

    // =================================================================================
    await section('[E] Zusatzleistung: Finanzabgleich-Fehler sichtbar, Leer-Tick ohne Eintrag', async () => {
      const order = await newOrder();
      const id = String(order._id);
      const added = await call('POST', `/api/admin/orders/${id}/addons`, staff, { name: 'Express', price: 20 });
      const addonId = String((await readStored(id)).addOns?.[0]?._id || '');
      check(added.status === 200 && Array.isArray(added.body?.warnings), 'Hinzufuegen: warnings-Feld vorhanden', JSON.stringify(added.body?.warnings));
      const original = FinancialService.syncOrderAndBookingValue;
      FinancialService.syncOrderAndBookingValue = async () => { throw new Error('Testfehler Finanzabgleich'); };
      let res;
      try {
        res = await call('PUT', `/api/admin/orders/${id}/addons/${addonId}`, staff, { price: 25 });
      } finally {
        FinancialService.syncOrderAndBookingValue = original;
      }
      check(res.status === 200 && (res.body?.warnings || []).some((w) => /Abgleich/.test(w)),
        'Preisaenderung trotz Abgleichfehler gespeichert, Fehler als deutsche Warnung (frueher nur console.warn)', `${res.status} ${JSON.stringify(res.body?.warnings)}`);
      const before = (await entriesOf(id, 'Add-on Service Updated')).length;
      const tick = await call('PUT', `/api/admin/orders/${id}/addons/${addonId}`, staff, { price: 25, status: 'pending' });
      const afterTick = (await entriesOf(id, 'Add-on Service Updated')).length;
      check(tick.status === 200 && afterTick === before, 'Wiederholung ohne Aenderung: kein neuer Eintrag', `${before}->${afterTick}`);
    });

    // =================================================================================
    await section('[F] Personalzuweisung: Akteur, alt/neu, keine Wiederholung', async () => {
      const order = await newOrder();
      const id = String(order._id);
      const res = await call('PUT', `/api/admin/orders/${id}/assign`, admin, { staffIds: [String(staff2._id)] });
      const entries = await entriesOf(id, 'Staff Assigned');
      const last = entries[entries.length - 1] || {};
      check(res.status === 200 && last.staffName === 'Admin Verlauf' && last.staffId === String(admin._id)
        && JSON.stringify(last.changes?.[0]?.to) === JSON.stringify(['Tom Technik']),
        'Eintrag mit echtem Akteur (frueher "System") und neuer Zuweisung', JSON.stringify({ n: last.staffName, c: last.changes }));
      const again = await call('PUT', `/api/admin/orders/${id}/assign`, admin, { staffIds: [String(staff2._id)] });
      const entriesAgain = await entriesOf(id, 'Staff Assigned');
      check(again.status === 200 && entriesAgain.length === entries.length, 'gleiche Zuweisung erneut: kein Eintrag', `${entries.length}->${entriesAgain.length}`);
    });

    // =================================================================================
    await section('[G] Geraetewechsel: strukturierte Aenderung, Grund, Quelle, Idempotenz, Bestaetigung', async () => {
      const order = await newOrder();
      const id = String(order._id);
      const lineId = String((await readStored(id)).services[0]._id);
      const body = {
        deviceBrand: 'Apple', deviceModel: 'iPad Pro', deviceType: 'Tablet', reason: 'Kunde hat iPad eingeschickt',
        source: 'Inspektion Schritt 1', serviceReplacements: [{ oldOrderServiceId: lineId, newServiceId: String(ipadDisplay._id) }],
      };
      const res = await call('POST', `/api/admin/orders/${id}/change-device`, staff, body);
      const entries = await entriesOf(id, 'Device Changed');
      const entry = entries[entries.length - 1] || {};
      const fields = (entry.changes || []).map((c) => c.field);
      check(res.status === 200 && entries.length === 1 && fields.includes('deviceType') && fields.includes('deviceModel') && fields.includes('services'),
        'Aenderungen: Geraetetyp, Modell, Service-Tausch', `${res.status} ${res.body?.error || ''} ${fields.join(',')}`);
      check(entry.reason === 'Kunde hat iPad eingeschickt' && entry.source === 'Inspektion Schritt 1' && entry.staffName === 'Sophie Technik',
        'Grund, Quelle und Akteur im Eintrag (frueher nur in der unsichtbaren Revision)', JSON.stringify({ r: entry.reason, s: entry.source }));
      check(/^Modellwechsel: Apple iPhone 15 -> Apple iPad Pro\./.test(entry.description || ''), 'Beschreibungsanfang fuer den Pruefbericht unveraendert', entry.description);
      const stored = await readStored(id);
      check(stored.reportedDevice?.model === 'iPhone 15', 'reportedDevice bleibt das gebuchte Geraet', JSON.stringify(stored.reportedDevice));
      const reported = await DeviceInspectionService._resolveReportedDevice
        ? await DeviceInspectionService._resolveReportedDevice(await Order.findById(id).setOptions({ skipAutoPopulate: true }))
        : null;
      if (reported) {
        check(/iPhone 15/.test(JSON.stringify(reported)), 'Pruefbericht ermittelt weiterhin das gebuchte Modell', JSON.stringify(reported).slice(0, 160));
      }

      const repeat = await call('POST', `/api/admin/orders/${id}/change-device`, staff, { ...body, serviceReplacements: [] });
      const afterRepeat = await entriesOf(id, 'Device Changed');
      check(repeat.status === 409 && isGerman(repeat.body?.error) && afterRepeat.length === 1,
        'identische Wiederholung: 409 deutsch, kein Eintrag "X -> X"', `${repeat.status} ${repeat.body?.error} ${afterRepeat.length}`);

      const confirmNotifBefore = notifications.filter((n) => n.title === 'Gerätewechsel bestätigt').length;
      const c1 = await call('POST', `/api/admin/orders/${id}/confirm-device-change`, admin, { confirmed: true });
      const c2 = await call('POST', `/api/admin/orders/${id}/confirm-device-change`, admin, { confirmed: true });
      const confirmations = await entriesOf(id, 'Device Change Confirmed');
      check(c1.status === 200 && c2.status === 200 && confirmations.length === 1 && confirmations[0].staffName === 'Admin Verlauf',
        'Bestaetigung: genau ein Eintrag mit Akteur', `${c1.status} ${c2.status} ${confirmations.length}`);
      const confirmNotifAfter = notifications.filter((n) => n.title === 'Gerätewechsel bestätigt').length;
      check(confirmNotifAfter - confirmNotifBefore === 1, 'zweite Bestaetigung: keine zweite Kundenbenachrichtigung', `${confirmNotifBefore}->${confirmNotifAfter}`);

      const legacy = await newOrder();
      const legacyRes = await call('PUT', `/api/admin/orders/${legacy._id}/device`, staff, { deviceBrand: 'Apple', deviceModel: 'iPad Pro', deviceType: 'Tablet' });
      const legacyStored = await readStored(legacy._id);
      check(legacyRes.status === 400 && legacyStored.deviceModel === 'iPhone 15' && isGerman(legacyRes.body?.error),
        'Alt-Route PUT /:id/device nutzt den Geraetewechsel (unpassender Service -> 400 deutsch, nichts geaendert)', `${legacyRes.status} ${legacyRes.body?.error}`);
    });

    // =================================================================================
    await section('[H] Abholung bestaetigen: parallel doppelt -> ein Eintrag', async () => {
      const order = await newOrder();
      const id = String(order._id);
      await call('PUT', `/api/admin/orders/${id}/status`, admin, { status: 'ready-for-pickup' });
      const [r1, r2] = await Promise.all([
        call('POST', `/api/admin/orders/${id}/confirm-pickup`, staff),
        call('POST', `/api/admin/orders/${id}/confirm-pickup`, staff2),
      ]);
      const stored = await readStored(id);
      const entries = stored.timeline.filter((e) => e.status === 'Pickup Confirmed');
      check(r1.status === 200 && r2.status === 200 && entries.length === 1 && stored.status === 'completed' && stored.actualCompletion,
        'genau ein "Pickup Confirmed", Status abgeschlossen, actualCompletion gesetzt', `${r1.status} ${r2.status} ${entries.length} ${stored.status}`);
      check([r1.body?.alreadyConfirmed, r2.body?.alreadyConfirmed].filter(Boolean).length === 1, 'zweiter Klick: alreadyConfirmed', JSON.stringify([r1.body?.alreadyConfirmed, r2.body?.alreadyConfirmed]));
      const milestones = await call('GET', `/api/orders/${id}/progress-timeline`, owner);
      const ret = (milestones.body?.stages || []).find((s) => s.id === 'return');
      check(ret?.state === 'reached' && ret?.detail === 'Abgeholt' && ret?.reachedAt, 'Meilenstein Rückgabe: Abgeholt mit Zeitpunkt', JSON.stringify(ret));
    });

    // =================================================================================
    await section('[I] Entsperrdaten: Pause mit Verlauf, Fortsetzung ueber Markierung', async () => {
      const order = await newOrder();
      const id = String(order._id);
      await Order.updateOne({ _id: id }, { $set: { unlockCode: '1234' } });
      await call('PUT', `/api/admin/orders/${id}/status`, admin, { status: 'diagnostic-assessment' });
      const res = await call('POST', `/api/admin/orders/${id}/request-unlock-update`, staff, { notes: 'Code falsch' });
      const stored = await readStored(id);
      const pause = stored.timeline.filter((e) => e.status === 'Order Paused For Customer');
      const incorrect = stored.timeline.filter((e) => e.status === 'Unlock Incorrect');
      check(res.status === 200 && stored.status === 'paused' && pause.length === 1 && incorrect.length === 1 && incorrect[0].reason === 'Code falsch',
        'Pause mit Eintrag (frueher keiner) und "Unlock Incorrect" mit Notiz', `${res.status} ${res.body?.error || ''} ${stored.status} ${pause.length} ${incorrect.length}`);
      const doc = await Order.findById(id).setOptions({ skipAutoPopulate: true });
      const resumed = OrderHistory.resumeIfPausedForCustomer(doc, { id: String(owner._id), name: 'Kunde Eigentuemer' });
      await doc.save();
      const afterResume = await readStored(id);
      const resumeEntry = afterResume.timeline.find((e) => e.status === 'Order Resumed');
      check(resumed && afterResume.status === 'diagnostic-assessment' && resumeEntry?.source === 'Kunde',
        'Helfer setzt auf den Status vor der Pause fort (Eintrag Quelle "Kunde")', `${resumed} ${afterResume.status}`);
      const docAgain = await Order.findById(id).setOptions({ skipAutoPopulate: true });
      check(OrderHistory.resumeIfPausedForCustomer(docAgain, { id: String(owner._id), name: 'K' }) === false, 'zweiter Aufruf: keine Wirkung', 'false');
    });

    // =================================================================================
    await section('[J] Template-Workflow: doppelte Pause und paralleler Schrittabschluss', async () => {
      const order = await newOrder();
      const id = String(order._id);
      await Order.updateOne({ _id: id }, {
        $set: { status: 'in-progress' },
        $push: {
          workflows: {
            workflowTemplateId: new mongoose.Types.ObjectId(), workflowName: 'Displaytausch-Ablauf', status: 'in-progress',
            steps: [
              { stepId: 's1', stepName: 'Zerlegen', status: 'in-progress', startedAt: new Date() },
              { stepId: 's2', stepName: 'Einbauen', status: 'pending' },
            ],
          },
        },
      });
      const wf = (await readStored(id)).workflows[0];
      const p1 = await call('PUT', `/api/admin/orders/${id}/workflows/${wf._id}/status`, staff, { status: 'on-hold', pauseReason: 'Teil fehlt' });
      const p2 = await call('PUT', `/api/admin/orders/${id}/workflows/${wf._id}/status`, staff, { status: 'on-hold', pauseReason: 'Teil fehlt' });
      const pauses = await entriesOf(id, 'Workflow Paused');
      check(p1.status === 200 && p2.status === 200 && pauses.length === 1, 'zweimal pausieren: ein "Workflow Paused"', `${p1.status} ${p2.status} ${pauses.length}`);
      const orderStatusEntry = (await entriesOf(id, 'Order Status Updated')).pop();
      check(orderStatusEntry?.changes?.[0]?.to === 'paused' && orderStatusEntry?.reason === 'Teil fehlt' && !ENGLISH.test(orderStatusEntry?.description || ''),
        'Statuswechsel durch Workflow: strukturiert und deutsch', orderStatusEntry?.description);
      await call('PUT', `/api/admin/orders/${id}/workflows/${wf._id}/status`, staff, { status: 'in-progress' });

      const stepId = String(wf.steps[0]._id);
      const [c1, c2] = await Promise.all([
        call('POST', `/api/admin/orders/${id}/workflows/${wf._id}/steps/${stepId}/complete`, staff, {}),
        call('POST', `/api/admin/orders/${id}/workflows/${wf._id}/steps/${stepId}/complete`, staff2, {}),
      ]);
      const completions = await entriesOf(id, 'Workflow Step Completed');
      const statuses = [c1.status, c2.status].sort();
      check(completions.length === 1 && statuses[0] === 200 && statuses[1] === 409,
        'paralleler Doppelklick: genau ein Eintrag, eine 409 (deutsch)', `${statuses.join(',')} ${completions.length} ${[c1, c2].map((r) => r.body?.error || '').join('|')}`);
    });

    // =================================================================================
    await section('[K] Sichtbarkeit: interne Eintraege nie fuer Kunde/Gast', async () => {
      const order = await newOrder();
      const id = String(order._id);
      const guestToken = crypto.randomBytes(16).toString('hex');
      await Order.updateOne({ _id: id }, {
        $set: { guestTrackingToken: guestToken, 'guestInfo.email': 'gast@test.invalid', 'guestInfo.isGuest': true },
        $push: {
          timeline: {
            $each: [
              { status: 'Workflow Paused', description: 'Workflow "X" status changed from in-progress to on-hold - Reason: INTERN-Grund', completedAt: new Date(), staffId: String(staff._id), staffName: 'Sophie Technik' },
              { status: 'Shipping Label Orphaned', description: 'DHL-Portal: Label 123 stornieren', completedAt: new Date(), staffId: 'system', staffName: 'DHL Parcel Integration' },
              { status: 'Inbound Label Created', description: 'Einsendelabel 0034 erstellt', completedAt: new Date(), staffId: String(staff._id), staffName: 'Sophie Technik' },
            ],
          },
        },
      });
      await call('PUT', `/api/admin/orders/${id}/status`, admin, { status: 'in-progress', note: 'INTERN-Notiz' });

      const ownerView = await call('GET', `/api/orders/${id}`, owner);
      const ownerText = JSON.stringify(ownerView.body?.order?.timeline || []);
      check(ownerView.status === 200 && !/INTERN|Orphaned|DHL-Portal|Sophie Technik|Admin Verlauf|staffName|reason/.test(ownerText),
        'Kunde GET /api/orders/:id: keine internen Eintraege, keine Namen/Gruende', ownerText.slice(0, 300));
      check(/DHL-Einsendelabel erstellt/.test(ownerText) && /Neuer Status: Reparatur in Bearbeitung/.test(ownerText) && /Auftrag erhalten/.test(ownerText),
        'Kunde: freigegebene Eintraege mit deutschem Titel', ownerText.slice(0, 300));

      const guest = await call('GET', `/api/track-order?token=${guestToken}&email=gast@test.invalid`, null);
      const guestText = JSON.stringify(guest.body?.order?.timeline || []);
      check(guest.status === 200 && !/INTERN|Orphaned|DHL-Portal|Sophie Technik|Admin Verlauf|staffName/.test(guestText) && /Auftrag erhalten/.test(guestText),
        'Gast GET /api/track-order: nur Positivliste (frueher kompletter Verlauf)', guestText.slice(0, 300));
      check(guest.body?.order?.workflows === undefined && guest.body?.order?.assignedStaff === undefined
        && Array.isArray(guest.body?.order?.milestones?.stages) && !JSON.stringify(guest.body?.order?.milestones).includes('actorName'),
        'Gast: keine workflows/assignedStaff, Meilensteine ohne Namen', Object.keys(guest.body?.order || {}).length);
      const wrongGuest = await call('GET', `/api/track-order?token=${guestToken}&email=anders@test.invalid`, null);
      check(wrongGuest.status === 403, 'Gast mit falscher E-Mail: 403', wrongGuest.status);

      const adminView = await call('GET', `/api/admin/orders/${id}`, admin);
      const adminText = JSON.stringify(adminView.body?.order?.timeline || adminView.body?.timeline || []);
      check(/INTERN-Grund/.test(adminText) && /Shipping Label Orphaned/.test(adminText), 'Admin sieht die internen Eintraege', adminView.status);
    });

    // =================================================================================
    await section('[L] GET /api/orders/:id/history: Zusammenfuehrung, Filter, Rollen', async () => {
      const order = await newOrder();
      const id = String(order._id);
      await call('PUT', `/api/admin/orders/${id}/status`, admin, { status: 'in-progress', reason: 'INTERN-Grund-L' });
      const invoiceId = new mongoose.Types.ObjectId();
      await mongoose.connection.db.collection('invoices').insertOne({
        _id: invoiceId, invoiceNumber: 'INV-2026-TEST1', orderId: order._id, customerId: owner._id, total: 100, status: 'sent',
        createdAt: new Date(), auditTrail: [{ at: new Date(), action: 'sent', actorName: 'Admin Verlauf', detail: '' }],
      });
      await mongoose.connection.db.collection('payments').insertOne({
        orderId: order._id, invoiceId, customerId: owner._id, amount: 47.4, currency: 'EUR', status: 'completed',
        paymentMethod: 'paypal', paymentDate: new Date(), createdAt: new Date(), source: 'manual', recordedBy: admin._id,
      });

      const full = await call('GET', `/api/orders/${id}/history`, admin);
      const entries = full.body?.entries || [];
      const invoiceEntry = entries.find((e) => e.type === 'invoice' && e.origin === 'invoice' && /INV-2026-TEST1 erstellt/.test(e.description));
      const paymentEntry = entries.find((e) => e.type === 'payment');
      check(full.status === 200 && invoiceEntry && invoiceEntry.link?.kind === 'invoice' && invoiceEntry.link?.apiUrl === `/api/invoices/${invoiceId}/pdf`,
        'Rechnung im Verlauf mit Link "Rechnung öffnen"', JSON.stringify(invoiceEntry && invoiceEntry.link));
      check(paymentEntry && /47,40 €/.test(paymentEntry.description) && /PayPal/.test(paymentEntry.description) && paymentEntry.actor?.name === 'Admin Verlauf'
        && !/gesamte Buchung/.test(paymentEntry.description),
        'Zahlung im Verlauf (de-DE Betrag, Methode, erfasst von)', paymentEntry && paymentEntry.description);
      const statusEntry = entries.find((e) => e.key === 'Order Status Updated');
      check(statusEntry && statusEntry.reason === 'INTERN-Grund-L' && statusEntry.actor?.name === 'Admin Verlauf' && statusEntry.title === 'Status geändert',
        'Personal: Grund, Akteur, deutscher Titel', JSON.stringify(statusEntry && { r: statusEntry.reason, t: statusEntry.title }));
      check(Array.isArray(full.body?.groups) && full.body.groups.some((g) => g.id === 'finance' && g.count >= 2) && full.body?.milestones?.stages?.length === 6,
        'Filtergruppen mit Zaehlern und Meilensteine in der Antwort', JSON.stringify((full.body?.groups || []).map((g) => [g.id, g.count])));
      const sorted = entries.every((e, i) => i === 0 || !e.at || !entries[i - 1].at || new Date(entries[i - 1].at) >= new Date(e.at));
      check(sorted, 'neueste zuerst', entries.length);

      const filtered = await call('GET', `/api/orders/${id}/history?types=payment,invoice`, admin);
      check(filtered.status === 200 && (filtered.body?.entries || []).length >= 2 && filtered.body.entries.every((e) => ['payment', 'invoice'].includes(e.type)),
        'Typfilter liefert nur Zahlung & Rechnung', (filtered.body?.entries || []).map((e) => e.type).join(','));
      const badType = await call('GET', `/api/orders/${id}/history?types=foo`, admin);
      check(badType.status === 400 && isGerman(badType.body?.error), 'unbekannte Eintragsart: 400 deutsch', `${badType.status} ${badType.body?.error}`);
      const paged = await call('GET', `/api/orders/${id}/history?limit=1`, admin);
      const page2 = paged.body?.nextCursor ? await call('GET', `/api/orders/${id}/history?limit=1&before=${encodeURIComponent(paged.body.nextCursor)}`, admin) : null;
      check(paged.body?.entries?.length === 1 && page2 && page2.body?.entries?.length === 1 && page2.body.entries[0].id !== paged.body.entries[0].id,
        'Seitenweise laden ueber nextCursor', `${paged.body?.nextCursor}`);

      const ownerHistory = await call('GET', `/api/orders/${id}/history`, owner);
      const ownerText = JSON.stringify(ownerHistory.body || {});
      check(ownerHistory.status === 200 && !/INTERN-Grund-L|Admin Verlauf|INV-2026|47,40|actor|reason/.test(ownerText)
        && (ownerHistory.body?.entries || []).every((e) => e.changes === undefined && e.refs === undefined),
        'Eigentuemer: nur freigegebene Eintraege ohne Akteur/Grund/Finanzdetails', ownerText.slice(0, 200));
      const foreign = await call('GET', `/api/orders/${id}/history`, stranger);
      const unknown = await call('GET', `/api/orders/${new mongoose.Types.ObjectId()}/history`, stranger);
      check(foreign.status === 403 && unknown.status === 403 && !JSON.stringify(foreign.body).includes(order.orderNumber),
        'fremder Kunde / unbekannte ID: 403 ohne Daten', `${foreign.status} ${unknown.status}`);
      const staffUnknown = await call('GET', `/api/orders/${new mongoose.Types.ObjectId()}/history`, staff);
      check(staffUnknown.status === 404, 'Personal: unbekannte ID 404', staffUnknown.status);
      const noAuth = await call('GET', `/api/orders/${id}/history`, null);
      check(noAuth.status === 401 || noAuth.status === 403, 'ohne Anmeldung abgewiesen', noAuth.status);
    });

    // =================================================================================
    await section('[M1] Parallel gleicher Status -> ein Eintrag, eine Benachrichtigung', async () => {
      const order = await newOrder();
      const id = String(order._id);
      notifications.length = 0;
      const results = await Promise.all([admin, staff, staff2].map((user) => call('PUT', `/api/admin/orders/${id}/status`, user, { status: 'quality-check' })));
      const entries = await entriesOf(id, 'Order Status Updated');
      const customerNotes = notifications.filter((n) => String(n.userId) === String(owner._id));
      check(results.every((r) => r.status === 200) && entries.length === 1 && results.filter((r) => r.body?.unchanged === true).length === 2,
        'drei parallele Klicks: genau ein Statuseintrag, zwei "unchanged"', `${results.map((r) => r.status).join(',')} ${entries.length}`);
      check(customerNotes.length === 1, 'genau eine Kundenbenachrichtigung (frueher je Klick eine)', customerNotes.length);

      const order2 = await newOrder();
      const id2 = String(order2._id);
      const [a, b] = await Promise.all([
        call('PUT', `/api/admin/orders/${id2}/status`, admin, { status: 'in-progress' }),
        call('PUT', `/api/admin/orders/${id2}/status`, staff, { status: 'cancelled', reason: 'Kunde storniert' }),
      ]);
      const stored2 = await readStored(id2);
      const chain = stored2.timeline.filter((e) => e.status === 'Order Status Updated').map((e) => e.changes?.[0] || {});
      check(a.status === 200 && b.status === 200 && chain.length === 2 && chain[0].from === 'pending' && chain[1].from === chain[0].to
        && stored2.status === chain[1].to,
        'parallel verschiedene Ziele: zweiter Eintrag nennt das echte "von" (frueher zweimal "pending")', JSON.stringify(chain.map((c) => `${c.from}->${c.to}`)));
    });

    // =================================================================================
    await section('[M2] Parallel gleiche Zuweisung / Workflow-Pause -> ein Eintrag', async () => {
      const order = await newOrder();
      const id = String(order._id);
      notifications.length = 0;
      const assigns = await Promise.all([admin, staff, admin, staff, admin, staff].map((user) => call('PUT', `/api/admin/orders/${id}/assign`, user, { staffIds: [String(staff2._id)] })));
      const assigned = await entriesOf(id, 'Staff Assigned');
      check(assigns.every((r) => r.status === 200) && assigned.length === 1 && assigns.filter((r) => r.body?.unchanged === true).length === 5,
        'sechs parallele Zuweisungen: ein "Staff Assigned", fuenf "unchanged"', `${assigns.map((r) => r.status).join(',')} ${assigned.length}`);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const assignmentNotes = notifications.filter((n) => String(n.userId) === String(staff2._id));
      check(assignmentNotes.length <= 1, 'keine doppelte Zuweisungsbenachrichtigung', assignmentNotes.length);

      await Order.updateOne({ _id: id }, {
        $set: { status: 'in-progress' },
        $push: {
          workflows: {
            workflowTemplateId: new mongoose.Types.ObjectId(), workflowName: 'Parallel-Ablauf', status: 'in-progress',
            steps: [{ stepId: 's1', stepName: 'Zerlegen', status: 'in-progress', startedAt: new Date() }],
          },
        },
      });
      const wf = (await readStored(id)).workflows[0];
      notifications.length = 0;
      const pauses = await Promise.all([staff, staff2, admin].map((user) => call('PUT', `/api/admin/orders/${id}/workflows/${wf._id}/status`, user, { status: 'on-hold', pauseReason: 'Teil fehlt' })));
      const pausedEntries = await entriesOf(id, 'Workflow Paused');
      const statusEntries = (await entriesOf(id, 'Order Status Updated')).filter((e) => e.changes?.[0]?.to === 'paused');
      const stored = await readStored(id);
      check(pauses.every((r) => r.status === 200) && pausedEntries.length === 1 && statusEntries.length === 1 && stored.workflows[0].pauseHistory.length === 1,
        'drei parallele Pausen: ein "Workflow Paused", ein Statuswechsel, eine Pause in der Historie', `${pauses.map((r) => r.status).join(',')} ${pausedEntries.length} ${statusEntries.length} ${stored.workflows[0].pauseHistory.length}`);
      check(notifications.filter((n) => String(n.userId) === String(owner._id)).length === 1, 'eine Kundenbenachrichtigung', notifications.length);
    });

    // =================================================================================
    await section('[M3] Positionspreis: Wiederholung und paralleler Doppelklick mit Grund -> kein Leer-Eintrag', async () => {
      const order = await newOrder();
      const id = String(order._id);
      const add = await call('POST', `/api/order-services/${id}`, staff, { isManual: true, name: 'Reinigung', price: 10 });
      const lineId = String((add.body?.order?.services || []).find((s) => s.name === 'Reinigung')?._id || '');
      await call('PUT', `/api/order-services/${id}/${lineId}`, staff, { price: 15, reason: 'Preis korrigiert' });
      const base = (await entriesOf(id, 'Order Services Changed')).length;
      const revisionsBase = await mongoose.connection.db.collection('orderrevisions').countDocuments({ orderId: order._id });
      const resubmit = await call('PUT', `/api/order-services/${id}/${lineId}`, staff, { price: 15, reason: 'Preis korrigiert' });
      const afterResubmit = await entriesOf(id, 'Order Services Changed');
      check(resubmit.status === 200 && afterResubmit.length === base, 'erneut gesendet (gleicher Preis, mit Grund): kein Eintrag mit 0 Aenderungen', `${base}->${afterResubmit.length}`);
      const [p1, p2] = await Promise.all([
        call('PUT', `/api/order-services/${id}/${lineId}`, staff, { price: 20, reason: 'doppelt' }),
        call('PUT', `/api/order-services/${id}/${lineId}`, staff2, { price: 20, reason: 'doppelt' }),
      ]);
      const afterParallel = await entriesOf(id, 'Order Services Changed');
      const added = afterParallel.slice(base);
      check(p1.status === 200 && p2.status === 200 && added.length === 1 && (added[0].changes || []).some((c) => c.field === 'services.price' && c.from === 15 && c.to === 20),
        'paralleler Doppelklick: genau ein Eintrag 15 -> 20', JSON.stringify(added.map((e) => [e.staffName, (e.changes || []).length])));
      const revisions = await mongoose.connection.db.collection('orderrevisions').countDocuments({ orderId: order._id });
      check(revisions - revisionsBase === 1, 'genau ein Aenderungsbeleg fuer die eine echte Aenderung', `${revisionsBase}->${revisions}`);
      const stored = await readStored(id);
      check(Number(stored.totalCost) === 120, 'Auftragswert 120,00 (100 + 20)', stored.totalCost);
    });

    // =================================================================================
    await section('[M4] Personalfelder am Auftrag: weder Kunde noch Gast sehen Namen oder interne Notiz', async () => {
      const order = await newOrder();
      const id = String(order._id);
      const guestToken = crypto.randomBytes(16).toString('hex');
      await mongoose.connection.db.collection('orders').updateOne({ _id: order._id }, {
        $set: {
          unlockCode: '1234', guestTrackingToken: guestToken, 'guestInfo.email': 'gast-m4@test.invalid', 'guestInfo.isGuest': true,
          addOns: [{ _id: new mongoose.Types.ObjectId(), name: 'Express', price: 0, status: 'pending', assignedStaff: { staffId: staff._id, name: 'Sophie Technik' } }],
          ePartNeedListEntries: [{ _id: new mongoose.Types.ObjectId(), partId: new mongoose.Types.ObjectId(), quantity: 1, needListName: 'Bedarf Sophie Technik', requestedBy: staff._id, notes: 'INTERN-Bedarf' }],
        },
      });
      const unlock = await call('POST', `/api/admin/orders/${id}/request-unlock-update`, staff, { notes: 'INTERN-Unlock-Notiz' });
      const pickup = await call('POST', `/api/admin/orders/${id}/confirm-pickup`, staff2);
      check(unlock.status === 200 && pickup.status === 200, 'Vorbereitung: Entsperrpruefung und Abholung durch Personal', `${unlock.status} ${pickup.status} ${unlock.body?.error || ''}`);

      const ownerView = await call('GET', `/api/orders/${id}`, owner);
      const o = ownerView.body?.order || {};
      const ownerText = JSON.stringify(o);
      check(ownerView.status === 200 && !/INTERN-Unlock-Notiz|Tom Technik/.test(ownerText)
        && o.pickupConfirmation?.confirmedAt && o.pickupConfirmation.confirmedByName === undefined && o.pickupConfirmation.confirmedBy === undefined
        && o.unlockConfirmation?.confirmationStatus === 'incorrect' && o.unlockConfirmation.notes === undefined && o.unlockConfirmation.confirmedByName === undefined
        && (o.addOns || []).every((a) => a.assignedStaff === undefined),
        'Kunde GET /:id: Abholzeit und Pruefergebnis ja, Namen/interne Notiz/Zuweisung nein (frueher sichtbar)',
        JSON.stringify({ p: o.pickupConfirmation, u: o.unlockConfirmation }));

      const guest = await call('GET', `/api/track-order?token=${guestToken}&email=gast-m4@test.invalid`, null);
      const g = guest.body?.order || {};
      const guestText = JSON.stringify(guest.body || {});
      check(guest.status === 200 && !/INTERN-Unlock-Notiz|Tom Technik|Sophie Technik/.test(guestText)
        && g.pickupConfirmation?.confirmedAt && g.pickupConfirmation.confirmedByName === undefined
        && ['ePartNeedListEntries', 'pricingConditions', 'revisionCount', 'editRevision', 'unlockConfirmation', 'staffNotes'].every((k) => !(k in g)),
        'Gast /api/track-order: keine Mitarbeiternamen, keine internen Felder (frueher confirmedByName, addOns.assignedStaff, Bedarfsliste)',
        Object.keys(g).filter((k) => /ePart|pricing|revision|unlock|staff/i.test(k)).join(','));
    });

    // =================================================================================
    await section('[M5] Entsperr-Anforderung bei bereits pausiertem Auftrag', async () => {
      const order = await newOrder();
      const id = String(order._id);
      await Order.updateOne({ _id: id }, { $set: { unlockCode: '1234' } });
      await call('PUT', `/api/admin/orders/${id}/status`, admin, { status: 'in-progress' });
      await call('PUT', `/api/admin/orders/${id}/status`, admin, { status: 'paused', reason: 'Teile fehlen' });
      const res = await call('POST', `/api/admin/orders/${id}/request-unlock-update`, staff, { notes: 'Code falsch' });
      const stored = await readStored(id);
      const requested = stored.timeline.filter((e) => e.status === 'Unlock Update Requested');
      check(res.status === 200 && stored.status === 'paused' && requested.length === 1 && requested[0].visibility === 'staff'
        && /bereits pausiert/.test(requested[0].description),
        'Verlauf zeigt die Anforderung (nur Team), Status bleibt pausiert (frueher keine Spur)', `${res.status} ${stored.status} ${requested.length}`);
      const doc = await Order.findById(id).setOptions({ skipAutoPopulate: true });
      check(OrderHistory.resumeIfPausedForCustomer(doc, { id: String(owner._id), name: 'K' }) === false,
        'keine automatische Fortsetzung: die andere Pause ("Teile fehlen") bleibt bestehen', doc.status);
      const ownerHistory = await call('GET', `/api/orders/${id}/history`, owner);
      check(!JSON.stringify(ownerHistory.body || {}).includes('Neue Entsperrdaten angefordert'), 'Kunde sieht den Team-Eintrag nicht', ownerHistory.status);
    });

    // =================================================================================
    await section('[M6] Meilensteine: keine erfundene Reparaturstufe, Versandlabel als Rueckgabe-Ereignis', async () => {
      const order = await newOrder();
      const id = String(order._id);
      await call('PUT', `/api/admin/orders/${id}/status`, admin, { status: 'paused', reason: 'Rückfrage' });
      const paused = await call('GET', `/api/orders/${id}/progress-timeline`, admin);
      const byId = Object.fromEntries((paused.body?.stages || []).map((s) => [s.id, s]));
      check(byId['order-received']?.state === 'current' && byId['order-received']?.detail === 'Pausiert'
        && byId.repair?.state === 'pending' && byId.diagnostic?.state === 'pending',
        'pausiert ohne Stufenereignis: aktuell "Auftrag erhalten · Pausiert" (frueher Reparatur aktuell, Eingangspruefung uebersprungen)',
        JSON.stringify(Object.values(byId).map((s) => `${s.id}:${s.state}`)));

      const shipped = await newOrder();
      const sid = String(shipped._id);
      await call('PUT', `/api/admin/orders/${sid}/status`, admin, { status: 'ready-for-pickup' });
      await Order.updateOne({ _id: sid }, { $push: { timeline: { status: 'Shipping Label Created', description: 'Versandlabel erstellt', completedAt: new Date(), staffId: String(staff._id), staffName: 'Sophie Technik' } } });
      await call('PUT', `/api/admin/orders/${sid}/status`, admin, { status: 'completed' });
      const done = await call('GET', `/api/orders/${sid}/progress-timeline`, owner);
      const ret = (done.body?.stages || []).find((s) => s.id === 'return');
      check(ret?.state === 'reached' && ret?.detail === 'Versandlabel erstellt' && ret?.reachedAt && ret.actorName === undefined,
        'abgeschlossen + Versandlabel: Rückgabe erreicht mit Zeitpunkt (frueher "Übersprungen")', JSON.stringify(ret));
    });
  } finally {
    server.close();
  }

  console.log(`\n==== ${pass} bestanden, ${fail} fehlgeschlagen ====`);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('ERROR:', error.message);
  console.error(error.stack);
  process.exit(2);
});
