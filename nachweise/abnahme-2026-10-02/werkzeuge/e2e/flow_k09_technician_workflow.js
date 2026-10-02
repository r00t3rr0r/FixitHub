// K09: Techniker-Workflow im Browser (Rolle "staff" = Techniker; die App kennt nur customer/staff/admin).
//  A) Eigener frischer Auftrag: Techniker oeffnet ihn ueber "Meine Aufträge", startet die Geraeteinspektion,
//     Schritt 1 + 2 mit "Speichern & Weiter" (Reload: "Inspektion fortsetzen"), weist den Reparatur-Workflow zu,
//     "Bestätigen & Starten", pausiert mit Grund (ohne Grund gesperrt), Reload, "Fortsetzen", "Reparatur
//     abschließen" -> Auftrag "Reparatur abgeschlossen" (ready-for-pickup, NICHT completed/versendet),
//     Verlaufseintraege; Kunde sieht im Browser nur den freigegebenen Status (kein Pausengrund/Technikername).
//  B) Zweiter frischer Auftrag: Reparatur laeuft, Auftrag wird storniert -> "Reparatur abschließen" und
//     "Fortsetzen" im Techniker-Dialog werden vom Server abgelehnt, die UI zeigt eine klare deutsche Meldung.
// Testdaten: eigener Testkunde k09-kunde@e2e.invalid (E2E-Marker), Warenkorb+Checkout ueber die echte API.
// DHL: Buchungslabel-Modus der Testumgebung (dummy) - kein echtes/kostenpflichtiges Label, keine externe Verbindung.
const fs = require('fs'); const path = require('path');
const { makeFlow, apiLogin, api, dumpControls, BASE, API, S } = require('./flowlib');
const SERVER = '/home/adar/Projects/FixitHub/server';
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const { generatePasswordHash } = require(path.join(SERVER, 'utils/password.js'));

const DB = 'mongodb://127.0.0.1:27099/e2e_after';
const CUST_EMAIL = 'k09-kunde@e2e.invalid';
const CUST_STATE = path.join(__dirname, 'state_k09kunde.json');
const MAILBOX = path.join(S, 'mailbox');
const MARK = 'E2E-K09';
const PAUSE_REASON = `${MARK} Warten auf Ersatzteil (Display)`;
const INTERNAL_NOTE = `${MARK} interne Startnotiz Werkbank 3`;
const MODEL_NOTE = `${MARK} Modell geprueft, Gehaeuse ok`;
const SERIAL = `${MARK}-SN-4711`;
const PW = fs.readFileSync(path.join(__dirname, '.pw'), 'utf8').trim();
if (!/^mongodb:\/\/127\.0\.0\.1:27099\/e2e_after$/.test(DB)) throw new Error('nur Wegwerf-DB');

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const db = () => mongoose.connection.db;
const orderDoc = (id) => db().collection('orders').findOne({ _id: oid(id) });
const workflowDoc = (id) => db().collection('repairworkflows').findOne({ orderId: oid(id) });
const inspectionDoc = (id) => db().collection('deviceinspections').findOne({ orderId: oid(id) });
const mailNames = () => new Set(fs.existsSync(MAILBOX) ? fs.readdirSync(MAILBOX).filter((n) => n.endsWith('.eml')) : []);
const decodeQP = (s) => Buffer.from(s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8');
const newMails = (before) => [...mailNames()].filter((n) => !before.has(n)).map((n) => {
  const raw = fs.readFileSync(path.join(MAILBOX, n), 'utf8');
  return { name: n, to: (raw.match(/^To: (.*)$/m) || [])[1] || '', text: decodeQP(raw) };
});

async function ensureCustomer() {
  const users = db().collection('users');
  const existing = await users.findOne({ email: CUST_EMAIL });
  if (existing) return existing;
  require(path.join(SERVER, 'models/User.js'));
  const User = mongoose.model('User');
  const addr = { street: 'Teststraße 9', city: 'Berlin', zipCode: '10117', country: 'DE' };
  const u = await User.create({
    email: CUST_EMAIL, password: await generatePasswordHash(PW), isActive: true, emailVerified: true,
    name: 'Klara Testkundin', firstName: 'Klara', lastName: 'Testkundin', role: 'customer', phone: '+49 30 9090909',
    invoiceAddress: addr, shippingAddress: addr, comment: `${MARK} Testdaten (flow_k09_technician_workflow)`,
  });
  return u.toObject();
}

function stateAuth(file) {
  const st = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cookies = (st.cookies || []).filter((c) => ['127.0.0.1', 'localhost'].includes(c.domain)).map((c) => `${c.name}=${c.value}`).join('; ');
  return { token: null, cookies };
}

// Kunden-Sitzung: gespeicherte Sitzung wiederverwenden (Login-Rate-Limit schonen), sonst einmal ueber die Login-Seite.
async function customerSession(f) {
  if (fs.existsSync(CUST_STATE)) {
    try { return await f.session('k09kunde'); } catch (e) { /* Sitzung abgelaufen -> neu anmelden */ }
  }
  const page = await f.session('guest');
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 120000 });
  await page.fill('input[type="email"]', CUST_EMAIL);
  await page.fill('#password', PW);
  await page.press('#password', 'Enter');
  await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  if (page.url().includes('/login')) throw new Error('Login Testkunde fehlgeschlagen');
  fs.writeFileSync(CUST_STATE, JSON.stringify(await page.context().storageState()));
  return page;
}

async function createOrderViaCheckout(f, auth, label) {
  const before = await db().collection('orders').find({}).sort({ _id: -1 }).limit(1).next();
  const svc = await db().collection('services').findOne({ name: 'Diagnose E2E' });
  await api(auth, 'DELETE', '/api/cart/clear');
  const add = await api(auth, 'POST', '/api/cart/add-repair-order', {
    deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 15', services: [String(svc._id)], addOns: [], totalCost: 49.9,
    errorDescription: `${MARK} ${label}: Display flackert`, waterDamage: 'no', previousRepairAttempts: 'no', itemCondition: 'original', noLock: true,
  });
  if (add.status >= 300) throw new Error(`Warenkorb ${add.status} ${JSON.stringify(add.data).slice(0, 200)}`);
  const co = await api(auth, 'POST', '/api/checkout/complete', {});
  if (co.status >= 300) throw new Error(`Checkout ${co.status} ${JSON.stringify(co.data).slice(0, 200)}`);
  const cust = await db().collection('users').findOne({ email: CUST_EMAIL });
  const o = await db().collection('orders').find({ customerId: cust._id, ...(before ? { _id: { $gt: before._id } } : {}) }).sort({ _id: -1 }).limit(1).next();
  if (!o) throw new Error('Auftrag nach Checkout nicht gefunden');
  f.note(`   Testdaten: ${label} = ${o.orderNumber} (${o._id}) ueber Warenkorb + Checkout-API als ${CUST_EMAIL}, Status ${o.status}`);
  return o;
}

async function installToastRecorder(page) {
  await page.addInitScript(() => {
    window.__toasts = [];
    // Radix-Toast: <li data-state data-swipe-direction> in der Region "Notifications" (role=status nur am Ansager)
    const grab = () => document.querySelectorAll('[role="region"] ol > li, li[data-swipe-direction]').forEach((el) => {
      const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
      if (t && !window.__toasts.includes(t)) window.__toasts.push(t);
    });
    const start = () => new MutationObserver(grab).observe(document.body, { childList: true, subtree: true, characterData: true });
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  });
}
const toasts = (page) => page.evaluate(() => (window.__toasts || []).slice());
const clearToasts = (page) => page.evaluate(() => { window.__toasts = []; });
async function waitToast(page, re, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const t = await toasts(page);
    const hit = t.find((x) => re.test(x));
    if (hit) return hit;
    await page.waitForTimeout(250);
  }
  return null;
}
// Liegt die sichtbare Meldung OBEN (nicht unter Dialog/Overlay)? Prueft den Mittelpunkt und die Textzeile per elementFromPoint.
async function toastOnTop(page, text) {
  return page.evaluate((needle) => {
    const li = Array.from(document.querySelectorAll('[role="region"] ol > li, li[data-swipe-direction]')).find((el) => (el.innerText || '').includes(needle));
    if (!li) return { found: false };
    const r = li.getBoundingClientRect();
    const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 24, r.top + r.height / 2], [r.right - 40, r.top + r.height / 2]];
    const hits = pts.map(([x, y]) => { const el = document.elementFromPoint(x, y); return !!el && li.contains(el); });
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { found: true, onTop: hits.every(Boolean), hits, topEl: top ? `${top.tagName.toLowerCase()}.${String(top.className).slice(0, 60)}` : null };
  }, text);
}
async function waitFor(fn, ms = 10000, step = 300) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) { last = await fn(); if (last) return last; await new Promise((r) => setTimeout(r, step)); }
  return last;
}
const rwDialog = (page) => page.getByRole('dialog').filter({ hasText: 'Reparatur-Workflow' }).filter({ has: page.getByRole('heading', { name: 'Reparatur-Workflow' }) }).last();

async function openOrderAsTechnician(f, t, order) {
  await f.goto(t, '/staff/orders', 3000);
  await t.getByPlaceholder('Aufträge suchen …').fill(order.orderNumber);
  await t.waitForTimeout(2500);
  const row = t.getByRole('row').filter({ hasText: order.orderNumber }).first();
  await row.waitFor({ timeout: 15000 });
  await row.click();
  await t.waitForURL((u) => String(u).includes(`/orders/${order._id}`), { timeout: 20000 });
  await t.waitForTimeout(3500);
}

(async () => {
  const f = makeFlow('k09_technician_workflow'); await f.start();
  let t; let c;
  const mailsAtStart = mailNames();
  try {
    await mongoose.connect(DB);
    const cust = await ensureCustomer();
    f.note(`   Testdaten: Testkunde ${CUST_EMAIL} (Marker ${MARK}) in e2e_after vorhanden/angelegt (Passwort-Hash aus Test-Passwortdatei)`);
    const staffUser = await db().collection('users').findOne({ email: 'staff@e2e.invalid' });
    f.check(staffUser && staffUser.role === 'staff', 'Technikerrolle der App: Testbenutzer staff@e2e.invalid hat Rolle "staff" (User.role kennt nur customer/staff/admin)', staffUser?.role);

    c = await customerSession(f);
    const custAuth = stateAuth(CUST_STATE);
    const orderA = await createOrderViaCheckout(f, custAuth, 'Auftrag A (Reparatur)');
    const orderB = await createOrderViaCheckout(f, custAuth, 'Auftrag B (Storno)');
    const adm = await apiLogin('admin');
    for (const o of [orderA, orderB]) {
      const r = await api(adm, 'PUT', `/api/admin/orders/${o._id}/assign`, { staffIds: [String(staffUser._id)] });
      f.note(`   Testdaten: Admin weist ${o.orderNumber} dem Techniker zu (API) -> ${r.status}`);
    }

    // ---------------- A) Techniker im Browser ----------------
    t = await f.session('staff');
    await installToastRecorder(t);
    await openOrderAsTechnician(f, t, orderA);
    f.check(t.url().includes(`/orders/${orderA._id}`), 'Techniker oeffnet den eigenen Auftrag ueber "Meine Aufträge" (Suche + Klick)', t.url().replace(BASE, ''));
    await f.shot(t, 'A_auftrag_techniker');
    const navTxt = await t.locator('nav.staff-sidebar').innerText().catch(() => '');
    f.check(navTxt.length > 0 && !/staff\.menu\./.test(navTxt) && /Dashboard/.test(navTxt), 'Techniker-Navigation zeigt deutsche Bezeichnungen (kein roher Schluessel "staff.menu.dashboard")', navTxt.replace(/\s+/g, ' ').slice(0, 120));

    // Inspektion starten -> Schritt 1 + 2 mit "Speichern & Weiter"
    await t.getByRole('button', { name: 'Inspektion starten' }).first().click();
    const insp = t.getByRole('dialog').filter({ hasText: 'Geräteinspektion' }).last();
    await insp.waitFor({ timeout: 15000 });
    await insp.locator('#model-notes').waitFor({ timeout: 20000 });
    await insp.locator('#model-notes').fill(MODEL_NOTE);
    await f.shot(t, 'A_inspektion_schritt1');
    await clearToasts(t);
    await insp.getByRole('button', { name: 'Speichern & Weiter' }).first().click();
    const toast1 = await waitToast(t, /Modellprüfung gespeichert|gespeichert/i);
    await insp.locator('#serial').waitFor({ timeout: 15000 });
    f.check(!!toast1 && await insp.locator('#serial').isVisible(), 'Schritt 1 "Speichern & Weiter": gespeichert, Schritt 2 (Geräteidentifikation) geoeffnet', toast1 || '-');
    await insp.locator('#serial').fill(SERIAL);
    await clearToasts(t);
    await insp.getByRole('button', { name: 'Speichern & Weiter' }).first().click();
    const toast2 = await waitToast(t, /Identifikation gespeichert/i);
    await t.waitForTimeout(1500);
    await f.shot(t, 'A_inspektion_nach_schritt2');
    const inspA = await waitFor(async () => { const d = await inspectionDoc(orderA._id); return d && (d.completedSteps || []).length >= 2 ? d : null; }, 8000);
    const steps = (inspA?.completedSteps || []).map((s) => (typeof s === 'object' ? s.step ?? s.stepNumber ?? JSON.stringify(s).slice(0, 30) : s));
    f.check(!!toast2 && !!inspA && JSON.stringify(inspA).includes(MODEL_NOTE) && JSON.stringify(inspA).includes(SERIAL),
      'Schritt 2 "Speichern & Weiter": Meldung "Identifikation gespeichert"; DB enthaelt Schritt-1-Notiz und Seriennummer', `steps=${JSON.stringify(steps)} currentStep=${inspA?.currentStep} toast2=${toast2 || '-'}`);
    let oA = await orderDoc(orderA._id);
    f.check(oA.status === 'diagnostic-assessment', 'Auftrag nach Inspektionsstart: "Diagnosebewertung" (diagnostic-assessment)', oA.status);
    await t.keyboard.press('Escape'); await t.waitForTimeout(800);
    await t.reload({ waitUntil: 'domcontentloaded' }); await t.waitForTimeout(4000);
    f.check(await t.getByRole('button', { name: 'Inspektion fortsetzen' }).count() > 0, 'nach Reload: Hauptaktion "Inspektion fortsetzen" (Inspektionsstand bleibt erhalten)');

    // Reparatur-Workflow zuweisen + starten
    await t.getByRole('button', { name: 'Arbeitsablauf zuweisen' }).first().click();
    const assign = t.getByRole('dialog').filter({ hasText: 'Workflow zuweisen' }).last();
    await assign.waitFor({ timeout: 10000 });
    const rwCardBtn = assign.getByText('Reparatur-Ausführungs-Workflow für diese Inspektion').locator('xpath=ancestor::div[.//button][1]').getByRole('button').first();
    await rwCardBtn.waitFor({ timeout: 10000 });
    await f.shot(t, 'A_workflow_zuweisen_dialog');
    await rwCardBtn.click();
    const rw = rwDialog(t);
    await rw.waitFor({ timeout: 15000 });
    await rw.locator('#approve-internal-notes').waitFor({ timeout: 10000 });
    let wfA = await workflowDoc(orderA._id);
    f.check(wfA && wfA.status === 'pending-confirmation', 'Reparatur-Workflow angelegt (Bestaetigung ausstehend)', wfA?.status);
    await rw.locator('#approve-internal-notes').fill(INTERNAL_NOTE);
    const kundeInfo = rw.getByRole('switch', { name: 'Kunde informieren' });
    f.note(`   Start-Schalter "Kunde informieren": ${await kundeInfo.getAttribute('aria-checked').catch(() => '?')} (bleibt aus)`);
    await f.shot(t, 'A_workflow_bestaetigen');
    await clearToasts(t);
    await rw.getByRole('button', { name: /Bestätigen & Starten/ }).click();
    const toastStart = await waitToast(t, /gestartet/i);
    wfA = await waitFor(async () => { const w = await workflowDoc(orderA._id); return w && w.status === 'in-progress' ? w : null; });
    oA = await orderDoc(orderA._id);
    f.check(wfA?.status === 'in-progress' && oA.status === 'in-progress', '"Bestätigen & Starten": Workflow laeuft, Auftrag "Reparatur in Bearbeitung"', `wf=${wfA?.status} order=${oA.status} toast=${toastStart || '-'}`);
    await rw.getByRole('button', { name: /Workflow pausieren/ }).waitFor({ timeout: 10000 });
    await f.shot(t, 'A_workflow_laeuft');

    // Pausieren mit Grund
    const mailsBeforePause = mailNames();
    await rw.getByRole('button', { name: /Workflow pausieren/ }).click();
    const pd = t.getByRole('dialog').filter({ hasText: 'Pausengrund' }).last();
    await pd.waitFor({ timeout: 10000 });
    const pauseBtn = pd.getByRole('button', { name: 'Pausieren', exact: true });
    f.check(await pauseBtn.isDisabled(), 'Pausieren ohne Grund gesperrt');
    await pd.locator('#pause-reason-dialog').fill(PAUSE_REASON);
    await f.shot(t, 'A_pause_dialog');
    await clearToasts(t);
    await pauseBtn.click();
    const toastPause = await waitToast(t, /pausiert/i);
    wfA = await waitFor(async () => { const w = await workflowDoc(orderA._id); return w && w.status === 'paused' ? w : null; });
    oA = await orderDoc(orderA._id);
    f.check(wfA?.status === 'paused' && wfA?.timerData?.currentPauseReason === PAUSE_REASON && oA.status === 'paused',
      'Pause gespeichert: Workflow pausiert mit Grund, Auftrag "Pausiert"', `wf=${wfA?.status} grund=${wfA?.timerData?.currentPauseReason} order=${oA.status} toast=${toastPause || '-'}`);
    await t.waitForTimeout(1500);
    const pauseMailsToCustomer = newMails(mailsBeforePause).filter((m) => m.to.includes(CUST_EMAIL));
    f.check(pauseMailsToCustomer.length === 0, 'Pausieren sendet dem Kunden keine E-Mail (Pausengrund ist intern)', pauseMailsToCustomer.map((m) => m.name).join(',') || 'keine');

    // Reload -> Workflow wieder oeffnen -> Fortsetzen
    await t.reload({ waitUntil: 'domcontentloaded' }); await t.waitForTimeout(4500);
    const openBtn = t.locator('#order-workflows').getByRole('button', { name: 'Öffnen' }).first();
    await openBtn.waitFor({ timeout: 15000 });
    f.check(/Pausiert/.test(await t.locator('#order-workflows').innerText()), 'nach Reload: Workflow-Karte zeigt "Pausiert"');
    await openBtn.click();
    await rw.waitFor({ timeout: 15000 });
    await rw.getByText('Workflow ist pausiert').waitFor({ timeout: 10000 });
    await f.shot(t, 'A_nach_reload_pausiert');
    await clearToasts(t);
    await rw.getByRole('button', { name: 'Fortsetzen', exact: true }).click();
    const toastResume = await waitToast(t, /fortgesetzt/i);
    wfA = await waitFor(async () => { const w = await workflowDoc(orderA._id); return w && w.status === 'in-progress' ? w : null; });
    oA = await orderDoc(orderA._id);
    const ph = wfA?.timerData?.pauseHistory || [];
    f.check(wfA?.status === 'in-progress' && oA.status === 'in-progress' && ph.length === 1 && ph[0].reason === PAUSE_REASON,
      '"Fortsetzen": Workflow + Auftrag wieder in Bearbeitung, Pause mit Grund im Pausenverlauf', `wf=${wfA?.status} order=${oA.status} pausen=${ph.length} toast=${toastResume || '-'}`);

    // Reparatur abschliessen (Kunde informieren = Standard AN)
    await rw.getByRole('button', { name: /Reparatur abschließen/ }).click();
    const cd = t.getByRole('alertdialog').filter({ hasText: 'Reparatur abschließen?' });
    await cd.waitFor({ timeout: 10000 });
    const cdText = (await cd.innerText()).replace(/\s+/g, ' ');
    f.check(/Reparatur abgeschlossen/.test(cdText) && /Rechnungen und Zahlungen werden nicht verändert/.test(cdText), 'Abschluss-Bestaetigung nennt Zielstatus und dass Rechnungen/Zahlungen unveraendert bleiben', cdText.slice(0, 180));
    const notifyOn = await cd.getByRole('switch').first().getAttribute('aria-checked');
    await f.shot(t, 'A_abschluss_bestaetigen');
    const mailsBeforeComplete = mailNames();
    await clearToasts(t);
    await cd.getByRole('button', { name: /Ja, abschließen/ }).click();
    const toastDone = await waitToast(t, /abgeschlossen/i);
    wfA = await waitFor(async () => { const w = await workflowDoc(orderA._id); return w && w.status === 'completed' ? w : null; });
    oA = await orderDoc(orderA._id);
    f.check(wfA?.status === 'completed', 'Workflow abgeschlossen (Zeiterfassung beendet)', `${wfA?.status} totalWorkMs=${wfA?.timerData?.totalWorkMs}`);
    f.check(oA.status === 'ready-for-pickup' && !oA.returnTrackingNumber && !(oA.pickupConfirmation && oA.pickupConfirmation.confirmedAt),
      'Auftrag "Reparatur abgeschlossen" (ready-for-pickup) - NICHT automatisch abgeschlossen/versendet', `status=${oA.status} returnTracking=${oA.returnTrackingNumber || '-'} toast=${toastDone || '-'}`);
    await rw.getByText('Reparatur erfolgreich abgeschlossen').waitFor({ timeout: 10000 }).catch(() => {});
    const outcome = (await rw.locator('[role="status"]').filter({ hasText: 'Gespeichert:' }).first().innerText().catch(() => '')).replace(/\s+/g, ' ');
    f.check(/Gespeichert: Die Reparatur wurde abgeschlossen/.test(outcome) && /Auftragsstatus: Reparatur abgeschlossen/.test(outcome) && (notifyOn !== 'true' || /benachrichtigt/.test(outcome)),
      'Dialog meldet getrennt: gespeichert / Auftragsstatus "Reparatur abgeschlossen" / Kundenbenachrichtigung', outcome.slice(0, 220));
    f.note(`   Toasts beim Abschluss: ${(await toasts(t)).join(' || ')}`);
    await f.shot(t, 'A_workflow_abgeschlossen');
    await t.waitForTimeout(2500);
    const doneMails = newMails(mailsBeforeComplete).filter((m) => m.to.includes(CUST_EMAIL));
    f.note(`   Abschluss: Schalter "Kunde informieren" = ${notifyOn}; neue E-Mails an Testkunden: ${doneMails.map((m) => m.name).join(',') || 'keine'}`);
    if (notifyOn === 'true') {
      f.check(doneMails.length === 1 && doneMails[0].text.includes(orderA.orderNumber) && !doneMails[0].text.includes(PAUSE_REASON) && !doneMails[0].text.includes(INTERNAL_NOTE),
        '"Kunde informieren" AN: genau eine Abschluss-E-Mail an den Testkunden, ohne Pausengrund/interne Notiz', doneMails.length);
    }

    // Reload: Status + Verlauf beim Techniker
    await t.keyboard.press('Escape').catch(() => {});
    await t.reload({ waitUntil: 'domcontentloaded' }); await t.waitForTimeout(4500);
    const headTxt = (await t.locator('main').innerText()).replace(/\s+/g, ' ');
    f.check(/Reparatur abgeschlossen/.test(headTxt), 'nach Reload: Auftragsdetail (Techniker) zeigt "Reparatur abgeschlossen"');
    await t.getByRole('tab', { name: /Verlauf/ }).first().click(); await t.waitForTimeout(3000);
    const histTxt = (await t.locator('main').innerText()).replace(/\s+/g, ' ');
    await f.shot(t, 'A_verlauf_techniker', true);
    const want = ['Reparatur gestartet', 'Reparatur pausiert', 'Reparatur fortgesetzt', 'Reparatur abgeschlossen'];
    const missing = want.filter((w) => !histTxt.includes(w));
    f.check(missing.length === 0 && histTxt.includes(PAUSE_REASON), 'Verlauf (Techniker): gestartet / pausiert (mit Grund) / fortgesetzt / abgeschlossen', missing.length ? `fehlt: ${missing.join(', ')}` : 'alle vorhanden');
    const staffAuth = await apiLogin('staff');
    const hist = await api(staffAuth, 'GET', `/api/orders/${orderA._id}/history?limit=100`);
    const titles = (hist.data?.entries || []).map((e) => e.title);
    f.note(`   Verlauf-API (Personal): ${titles.join(' | ').slice(0, 400)}`);

    // Kunde im Browser
    await installToastRecorder(c);
    await f.goto(c, `/orders/${orderA._id}`, 4500);
    const custTxt = (await c.locator('body').innerText()).replace(/\s+/g, ' ');
    f.check(/Reparatur abgeschlossen/.test(custTxt), 'Kunde sieht im Browser den Status "Reparatur abgeschlossen"');
    await c.locator('#order-customer-history button.customer-section-toggle').click();
    await c.waitForTimeout(2500);
    const custHist = (await c.locator('#order-customer-history').innerText()).replace(/\s+/g, ' ');
    await f.shot(c, 'A_kunde_verlauf', true);
    f.check(/Reparatur abgeschlossen/.test(custHist), 'Kunden-Verlauf enthaelt "Reparatur abgeschlossen"', custHist.slice(0, 300));
    const leaks = [PAUSE_REASON, INTERNAL_NOTE, 'Stefan Staff', MODEL_NOTE].filter((s) => custTxt.includes(s) || custHist.includes(s));
    f.check(leaks.length === 0, 'Kunde sieht keine internen Angaben (Pausengrund, interne Notiz, Technikername, Inspektionsnotiz)', leaks.join(', ') || 'keine');

    // ---------------- B) Stornierter Auftrag ----------------
    const sA = await apiLogin('staff');
    const i1 = await api(sA, 'POST', '/api/device-inspections/init', { orderId: String(orderB._id), customerId: String(cust._id) });
    const inspB = await inspectionDoc(orderB._id);
    const w1 = await api(sA, 'POST', `/api/repair-workflows/${orderB._id}/init`, { customerId: String(cust._id), inspectionId: inspB ? String(inspB._id) : undefined });
    const w2 = await api(sA, 'POST', `/api/repair-workflows/${orderB._id}/approve`, { internalNotes: `${MARK} Vorbereitung`, notifyCustomer: false });
    f.note(`   Testdaten: ${orderB.orderNumber} Inspektion + Reparatur-Workflow per API vorbereitet und gestartet (${i1.status}/${w1.status}/${w2.status})`);
    await openOrderAsTechnician(f, t, orderB);
    await t.locator('#order-workflows').getByRole('button', { name: 'Öffnen' }).first().click();
    await rw.waitFor({ timeout: 15000 });
    await rw.getByRole('button', { name: /Reparatur abschließen/ }).waitFor({ timeout: 10000 });
    await f.shot(t, 'B_workflow_laeuft_vor_storno');
    const cancel = await api(adm, 'PUT', `/api/orders/${orderB._id}/status`, { status: 'cancelled', reason: `${MARK} Kunde hat telefonisch abgesagt` });
    let oB = await orderDoc(orderB._id);
    f.note(`   Testdaten: Admin storniert ${orderB.orderNumber} per API (Techniker-Dialog ist noch offen) -> ${cancel.status}, Status ${oB.status}`);
    await clearToasts(t);
    await rw.getByRole('button', { name: /Reparatur abschließen/ }).click();
    const cdB = t.getByRole('alertdialog').filter({ hasText: 'Reparatur abschließen?' });
    await cdB.waitFor({ timeout: 10000 });
    await cdB.getByRole('switch').first().click(); // Kunde informieren aus (bei Storno ohnehin kein Versand)
    await cdB.getByRole('button', { name: /Ja, abschließen/ }).click();
    const errDone = await waitToast(t, /Nicht gespeichert/i);
    const visDone = await toastOnTop(t, 'Nicht gespeichert');
    await f.shot(t, 'B_abschluss_abgelehnt');
    let wfB = await workflowDoc(orderB._id);
    oB = await orderDoc(orderB._id);
    f.check(!!errDone && /storniert/i.test(errDone) && /abgeschlossen/i.test(errDone), 'Storniert: "Reparatur abschließen" -> UI zeigt deutsche Ablehnung des Servers', errDone || (await toasts(t)).join(' || '));
    f.check(visDone.found && visDone.onTop, 'Ablehnungsmeldung liegt sichtbar UEBER dem offenen Dialog (nicht vom Overlay verdeckt)', JSON.stringify(visDone));
    f.check(wfB.status !== 'completed' && oB.status === 'cancelled', 'Server: Workflow NICHT abgeschlossen, Auftrag bleibt storniert', `wf=${wfB.status} order=${oB.status}`);
    await t.keyboard.press('Escape').catch(() => {});
    await t.reload({ waitUntil: 'domcontentloaded' }); await t.waitForTimeout(4500);
    const bodyB = (await t.locator('main').innerText()).replace(/\s+/g, ' ');
    f.note(`   Auftrag B nach Reload (Auszug): ${bodyB.slice(0, 260)}`);
    const openB = t.locator('#order-workflows').getByRole('button', { name: 'Öffnen' }).first();
    if (await openB.count()) {
      await openB.click();
      await rw.waitFor({ timeout: 15000 });
      const resumeBtn = rw.getByRole('button', { name: 'Fortsetzen', exact: true });
      if (await resumeBtn.count() && await resumeBtn.first().isDisabled()) {
        // Seit der Abschlussrunde sperrt der Dialog die Schritte am stornierten Auftrag vorab (mit Hinweis);
        // die Serversperre bleibt die eigentliche Absicherung und wird direkt geprueft.
        const rwTxt = (await rw.innerText()).replace(/\s+/g, ' ');
        const completeBtn = rw.getByRole('button', { name: /Reparatur abschließen/ }).first();
        f.check(/Auftrag storniert – Arbeitsschritte sind gesperrt/.test(rwTxt), 'Storniert: Dialog nennt die Sperre ("Auftrag storniert – Arbeitsschritte sind gesperrt")', rwTxt.slice(0, 200));
        f.check(await completeBtn.isDisabled(), 'Storniert: "Fortsetzen" und "Reparatur abschließen" sind gesperrt');
        await f.shot(t, 'B_schritte_gesperrt');
        const staffApi = await apiLogin('staff');
        const resumeApi = await api(staffApi, 'POST', `/api/repair-workflows/${orderB._id}/resume`, {});
        f.note('   Pruefung: Fortsetzen direkt per API (die Oberflaeche bietet es nicht mehr an)');
        wfB = await workflowDoc(orderB._id);
        f.check(resumeApi.status === 409 && /storniert/i.test(JSON.stringify(resumeApi.data)), 'Server lehnt "Fortsetzen" am stornierten Auftrag ab (409, deutsch)', `${resumeApi.status} ${resumeApi.data?.error || resumeApi.data?.message || ''}`);
        f.check(wfB.status === 'paused' && wfB.timerData?.currentPauseReason === 'Auftrag storniert', 'Server: Workflow bleibt durch Storno pausiert (Zeiterfassung laeuft nicht wieder an)', `${wfB.status} / ${wfB.timerData?.currentPauseReason}`);
      } else if (await resumeBtn.count()) {
        await clearToasts(t);
        await resumeBtn.click();
        const errResume = await waitToast(t, /Nicht gespeichert/i);
        const visResume = await toastOnTop(t, 'Nicht gespeichert');
        await f.shot(t, 'B_fortsetzen_abgelehnt');
        wfB = await workflowDoc(orderB._id);
        f.check(!!errResume && /storniert/i.test(errResume) && /fortgesetzt/i.test(errResume), 'Storniert: "Fortsetzen" -> UI zeigt deutsche Ablehnung des Servers', errResume || (await toasts(t)).join(' || '));
        f.check(visResume.found && visResume.onTop, 'Ablehnungsmeldung "Fortsetzen" liegt sichtbar UEBER dem Workflow-Dialog', JSON.stringify(visResume));
        f.check(wfB.status === 'paused' && wfB.timerData?.currentPauseReason === 'Auftrag storniert', 'Server: Workflow bleibt durch Storno pausiert (Zeiterfassung laeuft nicht wieder an)', `${wfB.status} / ${wfB.timerData?.currentPauseReason}`);
      } else {
        const rwTxt = (await rw.innerText()).replace(/\s+/g, ' ');
        f.check(/storniert/i.test(rwTxt), 'Storniert: Dialog bietet kein "Fortsetzen" an und nennt den Storno', rwTxt.slice(0, 200));
      }
    } else {
      f.check(/storniert/i.test(bodyB), 'Storniert: Workflow-Aktion nicht angeboten, Seite nennt den Storno', bodyB.slice(0, 200));
    }
    const invB = await db().collection('invoices').countDocuments({ orderId: oid(orderB._id) });
    f.check(invB === 0, 'Storno + abgelehnte Workflow-Schritte erzeugen keine Rechnung', invB);

    // Gesamt-Mailpruefung (nur neue Dateien dieses Laufs)
    const all = newMails(mailsAtStart);
    const leaked = all.filter((m) => m.text.includes(PAUSE_REASON) || m.text.includes(INTERNAL_NOTE));
    f.check(leaked.length === 0, 'keine neue E-Mail enthaelt Pausengrund oder interne Notiz', `${all.length} neue Mails, davon an Testkunden ${all.filter((m) => m.to.includes(CUST_EMAIL)).length}`);
    const foreign = all.filter((m) => !/@e2e\.invalid|@example\.com/i.test(m.to));
    f.check(foreign.length === 0, 'neue E-Mails gehen nur an Testadressen', foreign.map((m) => m.to).join(',') || 'nur Testadressen');
  } catch (e) {
    if (t) { await f.shot(t, 'DEBUG_abbruch_techniker', true).catch(() => {}); f.note(`   Kontrollen: ${(await dumpControls(t).catch(() => [])).slice(0, 60).join(' || ')}`); }
    if (t) f.note(`   Toasts: ${(await toasts(t).catch(() => [])).join(' || ')}`);
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 4).join(' | ')}`);
  }
  await mongoose.disconnect().catch(() => {});
  await f.finish();
})();
