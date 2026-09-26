/**
 * Regressionstest T20 - Mahnwesen (Track "documents").
 *
 * Beide Einstiege - der vom Bearbeiter gestartete Mahnlauf (Finanz-Routen) und der
 * automatische Cron (FinancialService.runDunningJob) - muessen ueber DIESELBE,
 * idempotente Logik laufen:
 *
 *   1. "Auf Rechnung": Standardfrist 7 Tage, Kundenfrist wird uebernommen; das
 *      urspruengliche Faelligkeitsdatum bleibt bei allen Mahnschritten eingefroren.
 *   2. Mahnliste: nur ueberfaellige Belege mit echter offener Forderung (mit
 *      Faelligkeit, Tagen, offenem Betrag, Stufe, naechstem Termin); bezahlte,
 *      stornierte, nur-ueberzahlte Belege und Gutschriften erscheinen NICHT.
 *   3. Mahnlauf ueber die Route: jede faellige Rechnung genau EINE Stufe weiter, genau
 *      EINE Mail mit der Vorlage der Stufe; naechster Termin = heute + 7; Protokoll mit
 *      Datum, Stufe, Empfaenger, Vorlage, Ergebnis. Cron am selben Tag: nichts passiert.
 *   4. Gleichzeitige Laeufe (Cron + manuell + Einzelschritt): eine Mail, eine Stufe.
 *   5. E-Mail-Fehler: sichtbar, Stufe NICHT erreicht, kontrolliert wiederholbar.
 *   6. Stufen Zahlungserinnerung -> Mahnung ("1. Mahnung") -> Letzte Mahnung; danach
 *      keine automatische Weiterfuehrung; Inkasso nur manuell, danach Stillstand.
 *   7. Teilzahlung: gemahnt wird nur der echte Rest; nach voller Zahlung keine Mahnung.
 *   8. Gespeicherter Mahnlauf (Run-Builder) wird ueber dieselbe Logik ausgefuehrt.
 *
 * Kein Netz: der E-Mail-Versand (sendTemplateEmail) ist ein Stub.
 *
 * Aufruf (benoetigt eine WEGWERF-Datenbank, niemals die Entwicklungs-DB):
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27099/t_dunning node test-dunning-run.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Module = require('module');

const SERVER_DIR = path.join(__dirname, 'server');
const mongoose = require(path.join(SERVER_DIR, 'node_modules/mongoose'));
const express = require(path.join(SERVER_DIR, 'node_modules/express'));
const jwt = require(path.join(SERVER_DIR, 'node_modules/jsonwebtoken'));

const URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27099/t_dunning_run';

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

const QR_STUB = path.join(SERVER_DIR, 'node_modules', '__qrcode_test_stub__.js');
require.cache[QR_STUB] = { id: QR_STUB, filename: QR_STUB, loaded: true, exports: { toBuffer: async () => Buffer.alloc(0) } };
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolveWithQrStub(request, ...rest) {
  if (request === 'qrcode') return QR_STUB;
  return originalResolve.call(this, request, ...rest);
};

const DAY = 24 * 60 * 60 * 1000;
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const startOfDay = (value) => { const d = new Date(value); d.setHours(0, 0, 0, 0); return d; };
const sameDay = (a, b) => a && b && startOfDay(a).getTime() === startOfDay(b).getTime();

async function main() {
  if (isUnsafeTestUri(URI)) {
    throw new Error('Dieser Test darf nicht gegen die Entwicklungsdatenbank laufen.');
  }
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.EMAIL_TEST_TRANSPORT = 'stream';

  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  const MODELS_DIR = path.join(SERVER_DIR, 'models');
  fs.readdirSync(MODELS_DIR).filter((file) => file.endsWith('.js')).forEach((file) => {
    try { require(path.join(MODELS_DIR, file)); } catch (error) { /* optional */ }
  });
  const User = mongoose.model('User');
  const Order = mongoose.model('Order');
  const Invoice = mongoose.model('Invoice');
  const Payment = mongoose.model('Payment');
  const PaymentAllocation = mongoose.model('PaymentAllocation');
  const DunningRun = mongoose.model('DunningRun');
  await Promise.all([Payment.init(), PaymentAllocation.init(), Invoice.init()]);

  const EmailService = require(path.join(SERVER_DIR, 'services/emailService'));
  EmailService.logger = { info() {}, warn() {}, error() {}, debug() {} };
  EmailService.deliveryTracker = { recordDelivery() {} };
  const mails = [];
  let mailMode = 'ok';
  let mailDelayMs = 0;
  // Wird WAEHREND des Versands ausgefuehrt (z.B. Zahlungseingang) - einmalig.
  let mailHook = null;
  EmailService.sendTemplateEmail = async (templateName, to, variables) => {
    if (mailDelayMs) await new Promise((resolve) => setTimeout(resolve, mailDelayMs));
    if (mailHook) { const hook = mailHook; mailHook = null; await hook(); }
    if (mailMode === 'fail') return { success: false, error: 'SMTP nicht erreichbar (Test)' };
    mails.push({ templateName, to, variables });
    return { success: true, messageId: `m${mails.length}` };
  };
  EmailService.buildSystemUrl = async (p) => `https://test.invalid${p}`;
  const NotificationService = require(path.join(SERVER_DIR, 'services/notificationService'));
  NotificationService.createNotification = async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data });

  const FinancialService = require(path.join(SERVER_DIR, 'services/financialService'));
  const financialRoutes = require(path.join(SERVER_DIR, 'routes/financialRoutes'));
  const app = express();
  app.use(express.json());
  app.use('/api/admin/financial', financialRoutes);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  const call = async (method, url, { user = null, body = null } = {}) => {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await response.json(); } catch (error) { json = null; }
    return { status: response.status, body: json };
  };

  const admin = await User.create({ name: 'Admin Mahnung', email: 'admin-mahn@test.invalid', role: 'admin' });
  const customer = await User.create({ name: 'Otto Schuldner', email: 'otto@test.invalid', role: 'customer', customerNumber: 'K-30001' });
  const customer10 = await User.create({ name: 'Zehn Tage', email: 'zehn@test.invalid', role: 'customer', paymentDueDays: 10 });

  let seq = 0;
  // Eine ausgestellte Rechnung, deren Faelligkeit `overdueDays` Tage zurueckliegt.
  const makeOverdue = async (gross, overdueDays, extra = {}) => {
    seq += 1;
    const created = new Date(Date.now() - (overdueDays + 7) * DAY);
    const invoice = await Invoice.create({
      customerId: customer._id, customerName: customer.name, customerEmail: customer.email,
      items: [{ serviceName: `Reparatur ${seq}`, description: 'Reparatur', quantity: 1, unitPrice: gross, total: gross, type: 'service' }],
      dueDate: new Date(Date.now() - overdueDays * DAY), status: 'sent', createdAt: created,
      ...extra,
    });
    return invoice;
  };
  const listIds = async () => {
    const res = await call('GET', '/api/admin/financial/invoices/overdue', { user: admin });
    return { res, ids: (res.body?.invoices || []).map((entry) => String(entry._id)) };
  };

  await runSection('1 Auf Rechnung: Frist 7 Tage bzw. Kundenfrist, Faelligkeit eingefroren', async () => {
    const order = await Order.create({
      customerId: customer._id, orderNumber: 'ORD-2026-7001', deviceBrand: 'Apple', deviceModel: 'iPhone', deviceType: 'Smartphone',
      errorDescription: 'x', services: [{ isManual: true, name: 'Akku', price: 50, quantity: 1, estimatedTime: 0 }], totalCost: 50, discount: 0, status: 'completed',
    });
    const inv = await FinancialService.createInvoiceFromOrder(order._id);
    check(inv.paymentDueDays === 7 && Math.round((new Date(inv.dueDate) - new Date(inv.createdAt)) / DAY) === 7, 'Standard: 7 Tage', `${inv.paymentDueDays} / ${inv.paymentTerms}`);
    const order10 = await Order.create({
      customerId: customer10._id, orderNumber: 'ORD-2026-7002', deviceBrand: 'Apple', deviceModel: 'iPhone', deviceType: 'Smartphone',
      errorDescription: 'x', services: [{ isManual: true, name: 'Akku', price: 50, quantity: 1, estimatedTime: 0 }], totalCost: 50, discount: 0, status: 'completed',
    });
    const inv10 = await FinancialService.createInvoiceFromOrder(order10._id);
    check(inv10.paymentDueDays === 10, 'Kundenfrist 10 Tage uebernommen', `${inv10.paymentDueDays} / ${inv10.paymentTerms}`);
  });

  let a = null; // unbezahlt, 20 Tage ueberfaellig -> faellig fuer Stufe 1
  let b = null; // teilbezahlt, 20 Tage ueberfaellig
  await runSection('2 Mahnliste: nur echte offene Forderungen', async () => {
    a = await makeOverdue(100, 20);
    b = await makeOverdue(200, 20);
    await FinancialService.addInvoicePayment(b._id, { amount: 50, paymentMethod: 'sepa', paymentDate: new Date(), note: 'Teil' });
    const paid = await makeOverdue(80, 20);
    await FinancialService.addInvoicePayment(paid._id, { amount: 80, paymentMethod: 'sepa', paymentDate: new Date(), note: 'voll' });
    const cancelled = await makeOverdue(60, 20);
    await FinancialService.cancelInvoice(cancelled._id, { reason: 'Test', actorName: 'T' });
    const credited = await makeOverdue(40, 20);
    await FinancialService.createCreditNote(credited._id, { items: [{ serviceName: 'K', description: 'K', quantity: 1, unitPrice: 40, total: 40, type: 'fee' }], correctionType: 'price_adjustment', reason: 'voll gutgeschrieben' });
    const overpaid = await makeOverdue(30, 20);
    await FinancialService.addInvoicePayment(overpaid._id, { amount: 30, paymentMethod: 'sepa', paymentDate: new Date(), note: 'voll' });
    await FinancialService.createCreditNote(overpaid._id, { items: [{ serviceName: 'K', description: 'K', quantity: 1, unitPrice: 10, total: 10, type: 'fee' }], correctionType: 'price_adjustment', reason: 'Minderung' });
    const notDue = await makeOverdue(70, -3);

    const { res, ids } = await listIds();
    check(res.status === 200, 'Mahnliste 200', res.status);
    check(ids.includes(String(a._id)) && ids.includes(String(b._id)), 'offene und teilbezahlte Rechnung in der Liste', ids.length);
    const excluded = { paid, cancelled, credited, overpaid, notDue };
    const leaked = Object.entries(excluded).filter(([, doc]) => ids.includes(String(doc._id))).map(([k]) => k);
    check(leaked.length === 0, 'bezahlt/storniert/gutgeschrieben/nur ueberzahlt/nicht faellig NICHT in der Liste', leaked.join(',') || 'keine');
    const notes = await Invoice.find({ isCreditNote: true }).select('_id').lean();
    check(!notes.some((n) => ids.includes(String(n._id))), 'keine Gutschrift in der Mahnliste', notes.length);
    const entryB = (res.body?.invoices || []).find((entry) => String(entry._id) === String(b._id));
    const d = entryB?.dunning || {};
    check(round2(d.openAmount) === 150 && d.daysOverdue === 20 && sameDay(d.originalDueDate, b.dueDate), 'Eintrag: offener Rest 150, 20 Tage, urspruengliche Faelligkeit', JSON.stringify({ o: d.openAmount, t: d.daysOverdue }));
    check(d.currentStage === 'none' && d.eligible === true && d.nextEligibleDate, 'Eintrag: Stufe, naechster Termin, faellig', `${d.currentStage} / ${d.eligible} / ${d.nextEligibleDate}`);
  });

  await runSection('3 Mahnlauf ueber die Route: eine Stufe, eine Mail, Protokoll; Cron am selben Tag: nichts', async () => {
    mails.length = 0;
    const res = await call('POST', '/api/admin/financial/dunning/run', { user: admin });
    check(res.status === 200, 'Mahnlauf 200', `${res.status} ${res.body?.error || ''}`);
    const mailsA = mails.filter((m) => m.variables?.invoiceNumber === a.invoiceNumber);
    check(mailsA.length === 1 && mailsA[0].templateName === 'Zahlungserinnerung', 'A: genau eine Zahlungserinnerung', mailsA.map((m) => m.templateName).join(','));
    const storedA = await Invoice.findById(a._id).lean();
    check(storedA.dunningStage === 'payment_reminder' && storedA.dunningLevel === 1, 'A: Stufe 1 (Zahlungserinnerung)', `${storedA.dunningStage}/${storedA.dunningLevel}`);
    check(new Date(storedA.dueDate).getTime() === new Date(a.dueDate).getTime(), 'A: Faelligkeitsdatum unveraendert', storedA.dueDate.toISOString());
    const expectedNext = new Date(startOfDay(new Date()).getTime() + 7 * DAY);
    check(sameDay(storedA.nextDunningDueDate, expectedNext), 'A: naechster Termin heute + 7', storedA.nextDunningDueDate);
    const h = (storedA.dunningHistory || [])[0] || {};
    check(h.result === 'sent' && h.recipient === customer.email && h.templateName === 'Zahlungserinnerung' && h.stage === 'payment_reminder' && sameDay(h.executedAt, new Date()) && round2(h.amountOpen) === 100,
      'A: Protokoll (Datum, Stufe, Empfaenger, Vorlage, Ergebnis, Betrag)', JSON.stringify({ r: h.result, t: h.templateName, a: h.amountOpen }));
    const mailB = mails.find((m) => m.variables?.invoiceNumber === b.invoiceNumber);
    check(mailB && /150,00/.test(String(mailB.variables?.amountOpen)), 'B: gemahnt wird nur der Rest (150,00)', mailB ? mailB.variables.amountOpen : 'keine Mail');

    mails.length = 0;
    const cron = await FinancialService.runDunningJob();
    const storedA2 = await Invoice.findById(a._id).lean();
    check(mails.length === 0 && storedA2.dunningLevel === 1, 'Cron am selben Tag: keine Mail, keine weitere Stufe', `${mails.length} / ${storedA2.dunningLevel}`);
    check(cron && Array.isArray(cron.actions) && cron.actions.length === 0, 'Cron meldet keine Aktion', cron?.actions?.length);
  });

  await runSection('4 Gleichzeitige Ausloeser: eine Mail, eine Stufe', async () => {
    const c = await makeOverdue(120, 30);
    mails.length = 0;
    mailDelayMs = 60;
    const results = await Promise.all([
      FinancialService.runDunningJob(),
      call('POST', '/api/admin/financial/dunning/run', { user: admin }),
      FinancialService.processDunningStep(c._id, { source: 'manual', actorName: 'Admin' }),
      FinancialService.runDunningJob(),
    ]);
    mailDelayMs = 0;
    const mailsC = mails.filter((m) => m.variables?.invoiceNumber === c.invoiceNumber);
    const stored = await Invoice.findById(c._id).lean();
    check(mailsC.length === 1, 'genau eine Mail', mailsC.length);
    check(stored.dunningLevel === 1 && (stored.dunningHistory || []).filter((e) => e.result === 'sent').length === 1, 'genau eine Stufe', `${stored.dunningLevel} / ${(stored.dunningHistory || []).length}`);
    check(!stored.dunningLock || !stored.dunningLock.token, 'Sperre wieder freigegeben', JSON.stringify(stored.dunningLock || null));
    check(results.length === 4, 'alle Ausloeser beendet', results.length);
  });

  await runSection('5 E-Mail-Fehler: sichtbar, keine Stufe, kontrolliert wiederholbar', async () => {
    const e = await makeOverdue(90, 15);
    mailMode = 'fail';
    const failed = await FinancialService.processDunningStep(e._id, { source: 'manual', actorName: 'Admin' });
    mailMode = 'ok';
    let stored = await Invoice.findById(e._id).lean();
    check(failed && failed.outcome === 'failed' && /nicht versendet|fehlgeschlagen/i.test(failed.message || ''), 'Ergebnis: fehlgeschlagen (deutsch)', failed ? `${failed.outcome} ${failed.message}` : '-');
    check(stored.dunningLevel === 0 && (stored.dunningStage || 'none') === 'none', 'Stufe NICHT erreicht', `${stored.dunningLevel}/${stored.dunningStage}`);
    check(stored.dunningLastFailure && /SMTP/.test(stored.dunningLastFailure.error || ''), 'Fehler sichtbar am Beleg', stored.dunningLastFailure?.error);
    check((stored.dunningHistory || []).some((h) => h.result === 'failed' && h.stage === 'payment_reminder'), 'Fehlversuch protokolliert (nicht als erreicht)', (stored.dunningHistory || []).map((h) => h.result).join(','));
    const { res } = await listIds();
    const entry = (res.body?.invoices || []).find((i) => String(i._id) === String(e._id));
    check(entry && entry.dunning?.lastFailure && entry.dunning?.eligible === true, 'Mahnliste zeigt Fehler, Beleg bleibt faellig', entry ? JSON.stringify(entry.dunning?.lastFailure) : 'fehlt');

    mails.length = 0;
    const retry = await call('POST', `/api/admin/financial/dunning/invoices/${e._id}/step`, { user: admin, body: { customMessage: 'Bitte beachten Sie die Frist.' } });
    stored = await Invoice.findById(e._id).lean();
    check(retry.status === 200 && retry.body?.result?.outcome === 'sent' && stored.dunningLevel === 1 && !stored.dunningLastFailure?.error, 'Wiederholung: versendet, Stufe erreicht, Fehler geloescht', `${retry.status} ${retry.body?.result?.outcome} ${stored.dunningLevel}`);
    check(mails.length === 1 && mails[0].variables?.customMessage === 'Bitte beachten Sie die Frist.', 'persoenliche Nachricht in der Mahnmail', mails[0]?.variables?.customMessage);
    const again = await call('POST', `/api/admin/financial/dunning/invoices/${e._id}/step`, { user: admin, body: {} });
    check(again.status === 409 && /erst ab|nicht faellig|noch nicht/i.test(again.body?.error || ''), 'Einzelschritt vor dem naechsten Termin abgelehnt (409, deutsch)', `${again.status} ${again.body?.error}`);
  });

  await runSection('6 Stufenfolge, Ende der Automatik, Inkasso nur manuell', async () => {
    const f = await makeOverdue(75, 40);
    const advanceClock = async () => Invoice.updateOne({ _id: f._id }, { $set: { nextDunningDueDate: new Date(Date.now() - DAY) } });
    const templates = [];
    for (let i = 0; i < 4; i += 1) {
      mails.length = 0;
      await FinancialService.runDunningJob();
      templates.push(mails.filter((m) => m.variables?.invoiceNumber === f.invoiceNumber).map((m) => m.templateName).join('+') || '-');
      await advanceClock();
    }
    const stored = await Invoice.findById(f._id).lean();
    check(templates.join(' > ') === 'Zahlungserinnerung > Mahnung > Letzte Mahnung > -', 'Vorlagen je Stufe, danach keine automatische Mail', templates.join(' > '));
    check(stored.dunningStage === 'final_notice' && stored.dunningLevel === 3, 'Automatik endet bei "Letzte Mahnung"', stored.dunningStage);
    const { res } = await listIds();
    const entry = (res.body?.invoices || []).find((i) => String(i._id) === String(f._id));
    check(entry && entry.dunning?.eligible === false && /Inkasso/.test(entry.dunning?.reason || ''), 'Liste: nicht mehr automatisch faellig, Hinweis Inkasso', entry?.dunning?.reason);

    const early = await makeOverdue(20, 40);
    const tooEarly = await call('POST', `/api/admin/financial/dunning/invoices/${early._id}/collection`, { user: admin });
    check(tooEarly.status === 409, 'Inkasso vor der letzten Mahnung abgelehnt', `${tooEarly.status} ${tooEarly.body?.error}`);
    mails.length = 0;
    const coll = await call('POST', `/api/admin/financial/dunning/invoices/${f._id}/collection`, { user: admin });
    const afterColl = await Invoice.findById(f._id).lean();
    check(coll.status === 200 && afterColl.dunningStage === 'collection' && mails.length === 1 && mails[0].templateName === 'Inkasso', 'Inkasso manuell: Stufe + Mitteilung', `${coll.status} ${afterColl.dunningStage} ${mails.map((m) => m.templateName)}`);
    await advanceClock();
    mails.length = 0;
    await FinancialService.runDunningJob();
    const final = await Invoice.findById(f._id).lean();
    const mailsF = mails.filter((m) => m.variables?.invoiceNumber === f.invoiceNumber);
    check(mailsF.length === 0 && final.dunningStage === 'collection', 'nach Inkasso: keine automatische Aktion', `${mailsF.length} ${final.dunningStage}`);
  });

  await runSection('7 Volle Zahlung beendet das Mahnverfahren', async () => {
    await Invoice.updateOne({ _id: b._id }, { $set: { nextDunningDueDate: new Date(Date.now() - DAY) } });
    await FinancialService.addInvoicePayment(b._id, { amount: 150, paymentMethod: 'sepa', paymentDate: new Date(), note: 'Rest' });
    mails.length = 0;
    await FinancialService.runDunningJob();
    const { ids } = await listIds();
    check(!mails.some((m) => m.variables?.invoiceNumber === b.invoiceNumber) && !ids.includes(String(b._id)), 'bezahlt: keine Mahnung, nicht in der Liste', `${mails.length} / ${ids.includes(String(b._id))}`);
  });

  await runSection('8 Gespeicherter Mahnlauf wird ueber dieselbe Logik ausgefuehrt', async () => {
    const g = await makeOverdue(55, 25);
    const h = await makeOverdue(65, 2); // ueberfaellig, aber noch nicht erinnerungsfaellig (7 Tage Karenz)
    const created = await call('POST', '/api/admin/financial/dunning/runs', { user: admin, body: { name: 'Testlauf', invoiceIds: [String(g._id), String(h._id)], status: 'draft' } });
    const runId = created.body?.run?._id;
    mails.length = 0;
    const exec = await call('POST', `/api/admin/financial/dunning/runs/${runId}/execute`, { user: admin });
    const run = await DunningRun.findById(runId).lean();
    const itemG = (run?.items || []).find((i) => String(i.invoiceId) === String(g._id));
    const itemH = (run?.items || []).find((i) => String(i.invoiceId) === String(h._id));
    check(exec.status === 200 && itemG?.status === 'sent' && itemH?.status === 'skipped', 'faelliger Fall versendet, nicht faelliger uebersprungen', `${exec.status} ${itemG?.status} ${itemH?.status} ${exec.body?.error || ''}`);
    check(mails.length === 1 && mails[0].variables?.invoiceNumber === g.invoiceNumber, 'genau eine Mail', mails.length);
    mails.length = 0;
    const again = await call('POST', `/api/admin/financial/dunning/runs/${runId}/execute`, { user: admin });
    check(again.status === 200 && mails.length === 0, 'erneutes Ausfuehren: keine zweite Mail', `${again.status} ${mails.length}`);
    const storedG = await Invoice.findById(g._id).lean();
    check(String((storedG.dunningHistory || [])[0]?.dunningRunId) === String(runId) && storedG.dunningHistory[0].source === 'manual', 'Protokoll verweist auf den Lauf', storedG.dunningHistory?.[0]?.source);
  });

  await runSection('9 Zahlung/Storno waehrend des Mahnversands (Wettlauf)', async () => {
    // a) Vollzahlung waehrend die Mail rausgeht: Status bleibt bezahlt, keine Stufe.
    const full = await makeOverdue(80, 20);
    mails.length = 0;
    mailHook = () => FinancialService.addInvoicePayment(full._id, { amount: 80, paymentMethod: 'sepa', paymentDate: new Date(), note: 'Eingang waehrend Versand' });
    const r1 = await FinancialService.processDunningStep(full._id, { source: 'manual' });
    const s1 = await Invoice.findById(full._id).lean();
    check(s1.status === 'paid', 'Vollzahlung waehrend des Versands: Status bleibt "bezahlt" (nicht zurueck auf ueberfaellig)', s1.status);
    check(Number(s1.dunningLevel || 0) === 0 && (s1.dunningStage || 'none') === 'none' && !s1.dunningLock, 'Mahnstufe nicht erhoeht, Sperre frei', `${s1.dunningLevel} / ${s1.dunningStage} / ${JSON.stringify(s1.dunningLock || null)}`);
    const h1 = (s1.dunningHistory || [])[0];
    check(mails.length === 1 && (s1.dunningHistory || []).length === 1 && h1.result === 'sent' && /nicht übernommen/.test(h1.note || ''), 'Versand trotzdem protokolliert (mit Hinweis)', `${mails.length} / ${(s1.dunningHistory || []).length} / ${h1?.note || '-'}`);
    check(r1.outcome === 'sent' && /nicht erhöht/.test(r1.message), 'Ergebnis meldet: versendet, Stufe nicht erhoeht (deutsch)', r1.message);

    // b) Teilzahlung waehrend des Versands: Stufe gilt (noch offen), Status bleibt teilbezahlt.
    const part = await makeOverdue(80, 20);
    mailHook = () => FinancialService.addInvoicePayment(part._id, { amount: 30, paymentMethod: 'sepa', paymentDate: new Date(), note: 'Teilzahlung waehrend Versand' });
    await FinancialService.processDunningStep(part._id, { source: 'manual' });
    const s2 = await Invoice.findById(part._id).lean();
    check(s2.status === 'partially_paid' && Number(s2.dunningLevel) === 1, 'Teilzahlung waehrend des Versands: Stufe 1, Status bleibt "teilbezahlt"', `${s2.status} / ${s2.dunningLevel}`);

    // c) Storno waehrend des Versands wird abgewiesen (Mahnsperre), danach moeglich.
    const cx = await makeOverdue(90, 20);
    let cancelDuringSend = null;
    mailHook = async () => {
      try { await FinancialService.cancelInvoice(cx._id, { reason: 'Parallel', actorName: 'Admin' }); } catch (error) { cancelDuringSend = error; }
    };
    await FinancialService.processDunningStep(cx._id, { source: 'manual' });
    const s3 = await Invoice.findById(cx._id).lean();
    check(cancelDuringSend && cancelDuringSend.code === 'DUNNING_IN_PROGRESS' && Number(s3.dunningLevel) === 1 && !s3.cancellation,
      'Storno waehrend des Versands: 409 DUNNING_IN_PROGRESS, Mahnschritt vollstaendig protokolliert', `${cancelDuringSend?.code} / ${s3.dunningLevel}`);
    const afterwards = await FinancialService.cancelInvoice(cx._id, { reason: 'Nach der Mahnung', actorName: 'Admin' });
    check(afterwards.invoice?.status === 'cancelled', 'danach: Storno moeglich', afterwards.invoice?.status);

    // d) Laufendes Storno (processing) ist nicht mahnbar.
    const px = await makeOverdue(70, 20);
    await Invoice.collection.updateOne({ _id: px._id }, { $set: { cancellation: { kind: 'storno', state: 'processing', reason: 'x', requestedAt: new Date(), creditNoteId: new mongoose.Types.ObjectId() } } });
    mails.length = 0;
    const r4 = await FinancialService.processDunningStep(px._id, { source: 'manual' });
    check(r4.outcome === 'skipped' && /Storno/.test(r4.message) && mails.length === 0, 'Storno in Bearbeitung: keine Mahnung', `${r4.outcome} ${r4.message}`);
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
