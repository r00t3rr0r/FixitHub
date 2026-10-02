// K06 (Runde 3) Nachholpfad in der UI: Reparatur-Workflow als Techniker (staff) mit "Kunde informieren" AUS
// abschliessen -> nichts beim Kunden; danach "Kunde über Abschluss informieren" (Abschlusskarte im Dialog
// "Reparatur-Workflow") -> genau EINE In-App-Benachrichtigung + genau EINE E-Mail (scratchpad/mailbox) an den
// Kunden; Doppelklick / erneuter Versuch sendet nicht doppelt.
// Testdaten per API (protokolliert): frischer Auftrag des Kunden partner@e2e.invalid (Warenkorb + Checkout,
// PayPal ausstehend, keine Zahlung), Zuweisung an staff@e2e.invalid, Eingangsprüfung angelegt.
const fs = require('fs'); const path = require('path');
const { makeFlow, apiLogin, api, S } = require('./flowlib');
const mongoose = require('/home/adar/Projects/FixitHub/server/node_modules/mongoose');

const DB = 'mongodb://127.0.0.1:27099/e2e_after';
const MAILBOX = path.join(S, 'mailbox');
const NETGUARD = path.join(__dirname, 'netguard_after.log');
const RUN = `K06R-${Date.now().toString(36).toUpperCase()}`;
const ngSize = () => (fs.existsSync(NETGUARD) ? fs.statSync(NETGUARD).size : 0);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let conn;
const db = async () => { if (!conn) conn = await mongoose.createConnection(DB).asPromise(); return conn; };
const oid = (v) => new mongoose.Types.ObjectId(String(v));
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();

function decodeEml(raw) {
  const s = raw.replace(/=\r?\n/g, '').replace(/\r?\n[ \t]+/g, ' ');
  return Buffer.from(s.replace(/=([0-9A-F]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8');
}
const mailSnapshot = () => new Set(fs.readdirSync(MAILBOX));
const newMailsFor = (snap, orderNumber) => fs.readdirSync(MAILBOX).filter((n) => !snap.has(n) && /partner@e2e\.invalid/.test(n))
  .map((n) => ({ name: n, text: decodeEml(fs.readFileSync(path.join(MAILBOX, n), 'utf8')) }))
  .filter((m) => m.text.includes(orderNumber));
async function notifsFor(partnerId, orderId, since) {
  return (await db()).collection('notifications').find({ userId: oid(partnerId), createdAt: { $gte: since }, $or: [{ orderId: oid(orderId) }, { 'metadata.orderId': String(orderId) }] }).toArray();
}
const workflowOf = async (orderId) => (await db()).collection('repairworkflows').findOne({ orderId: oid(orderId) });
async function waitFor(fn, ms = 15000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await fn(); if (v) return v; await wait(400); } return null; }
const rwDialog = (page) => page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Reparatur-Workflow' }) }).last();

(async () => {
  const f = makeFlow('r3_k06_retry'); await f.start();
  const ng0 = ngSize();
  let t;
  try {
    // ---- Testdaten ------------------------------------------------------------------------------------
    const c = await db();
    const partner = await c.collection('users').findOne({ email: 'partner@e2e.invalid' });
    const staff = await c.collection('users').findOne({ email: 'staff@e2e.invalid' });
    const svc = await c.collection('services').findOne({ name: 'Diagnose E2E', isActive: true });
    const cust = await apiLogin('customer');
    const cart = await api(cust, 'GET', '/api/cart');
    const ci = cart.data?.cart || {};
    if ((ci.items || []).length || (ci.repairOrders || []).length) throw new Error('Warenkorb von partner@e2e.invalid ist nicht leer - Abbruch');
    const marker = `E2E ${RUN} Abschluss nachträglich informieren`;
    let r = await api(cust, 'POST', '/api/cart/add-repair-order', { deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 15', services: [String(svc._id)], addOns: [], totalCost: 49.9, errorDescription: marker, waterDamage: 'no', previousRepairAttempts: 'no', itemCondition: 'original', noLock: true });
    const ck = await api(cust, 'POST', '/api/checkout/complete', { paymentMethod: 'paypal', checkoutAttemptId: `e2e-${RUN}` });
    f.note(`Testdaten: Warenkorb + Checkout per API (partner@e2e.invalid, PayPal ausstehend, keine Zahlung) -> ${r.status}/${ck.status} ${ck.data?.bookingNumber || ''}`);
    const order = await c.collection('orders').findOne({ customerId: partner._id, errorDescription: marker });
    if (!order) throw new Error('Testauftrag nicht gefunden');
    const O = { id: String(order._id), nr: order.orderNumber };
    const adm = await apiLogin('admin');
    r = await api(adm, 'PUT', `/api/admin/orders/${O.id}/assign`, { staffIds: [String(staff._id)] });
    f.note(`Testdaten: Admin weist ${O.nr} dem Techniker staff@e2e.invalid zu (API) -> ${r.status}`);
    r = await api(adm, 'POST', '/api/device-inspections/init', { orderId: O.id });
    f.note(`Testdaten: Eingangsprüfung angelegt (API, Voraussetzung "Arbeitsablauf zuweisen") ${O.nr} -> ${r.status}`);
    await wait(3500); // Bestell-/Eingangsmails der Vorbereitung abklingen lassen
    const snap0 = mailSnapshot(); const tStart = new Date(Date.now() - 1000);

    // ---- UI: Techniker startet und schliesst ab, "Kunde informieren" AUS -------------------------------
    t = await f.session('staff');
    await f.goto(t, `/orders/${O.id}`, 4500);
    await t.getByRole('button', { name: 'Arbeitsablauf zuweisen' }).first().click();
    const assign = t.getByRole('dialog').filter({ hasText: 'Workflow zuweisen' }).last();
    await assign.waitFor({ timeout: 15000 });
    const rwCardBtn = assign.getByText('Reparatur-Ausführungs-Workflow für diese Inspektion').locator('xpath=ancestor::div[.//button][1]').getByRole('button').first();
    await rwCardBtn.waitFor({ timeout: 15000 });
    await rwCardBtn.click();
    const rw = rwDialog(t);
    await rw.waitFor({ timeout: 15000 });
    await rw.locator('#approve-internal-notes').waitFor({ timeout: 15000 });
    const swStart = rw.getByRole('switch', { name: 'Kunde informieren' });
    if (await swStart.getAttribute('aria-checked') === 'true') await swStart.click();
    f.check(await swStart.getAttribute('aria-checked') === 'false', 'Start: "Kunde informieren" AUS', await swStart.getAttribute('aria-checked'));
    await rw.getByRole('button', { name: /Bestätigen & Starten/ }).click();
    let wf = await waitFor(async () => { const w = await workflowOf(O.id); return w && w.status === 'in-progress' ? w : null; });
    f.check(!!wf, 'Workflow läuft (Bestätigen & Starten als Techniker)', wf?.status);
    await rw.getByRole('button', { name: /Reparatur abschließen/ }).waitFor({ timeout: 15000 });
    await rw.getByRole('button', { name: /Reparatur abschließen/ }).click();
    const cd = t.getByRole('alertdialog').filter({ hasText: 'Reparatur abschließen?' });
    await cd.waitFor({ timeout: 10000 });
    const swDone = cd.getByRole('switch').first();
    const defaultOn = await swDone.getAttribute('aria-checked');
    if (defaultOn === 'true') await swDone.click();
    f.check(await swDone.getAttribute('aria-checked') === 'false', 'Abschluss: "Kunde informieren" ausgeschaltet (Standard war AN)', `${defaultOn} -> ${await swDone.getAttribute('aria-checked')}`);
    await f.shot(t, 'abschluss_kunde_informieren_aus');
    await cd.getByRole('button', { name: /Ja, abschließen/ }).click();
    wf = await waitFor(async () => { const w = await workflowOf(O.id); return w && w.status === 'completed' ? w : null; });
    f.check(!!wf, 'Workflow abgeschlossen', wf?.status);
    await rw.getByText('Reparatur erfolgreich abgeschlossen').waitFor({ timeout: 10000 }).catch(() => {});
    await t.waitForTimeout(5000); // Zeitfenster fuer eine (falsche) Benachrichtigung
    const off = { mails: newMailsFor(snap0, O.nr), notifs: await notifsFor(partner._id, O.id, tStart) };
    f.note(`   nach Abschluss (AUS): completionNotification=${JSON.stringify(wf?.completionNotification ? { status: wf.completionNotification.status, reason: wf.completionNotification.reason } : null)}`);
    f.check(off.mails.length === 0 && off.notifs.length === 0, 'Abschluss mit "Kunde informieren" AUS: keine E-Mail, keine In-App-Benachrichtigung an den Kunden', `${off.mails.length}/${off.notifs.length}`);
    const later = rw.getByRole('button', { name: /Kunde über Abschluss informieren/ });
    const doneCardTxt = squash(await rw.innerText());
    f.check(await later.count() === 1, 'Abschlusskarte bietet "Kunde über Abschluss informieren" an', (doneCardTxt.match(/Kunde benachrichtigt: [^.]{0,60}/) || [''])[0]);
    await rw.locator('#rw-complete-later-message').scrollIntoViewIfNeeded().catch(() => {});
    await f.shot(t, 'abschlusskarte_nachtraeglich_informieren');

    // ---- Nachholen: Doppelklick -> genau 1 + 1 -----------------------------------------------------------
    const posts = [];
    t.on('request', (q) => { if (q.method() === 'POST' && /\/notify-customer$/.test(new URL(q.url()).pathname)) posts.push(q.url()); });
    const snap1 = mailSnapshot(); const t1 = new Date(Date.now() - 1000);
    await later.dblclick();
    await t.waitForTimeout(400);
    if (await later.count()) await later.click({ timeout: 1500 }).catch(() => {}); // dritter, schneller Klick falls noch sichtbar
    await waitFor(async () => newMailsFor(snap1, O.nr).length > 0, 12000);
    await t.waitForTimeout(3000); // eventuelle Doppelzustellung abwarten
    const sent = { mails: newMailsFor(snap1, O.nr), notifs: await notifsFor(partner._id, O.id, t1) };
    wf = await workflowOf(O.id);
    f.note(`   UI-POSTs an /notify-customer: ${posts.length}; completionNotification=${wf?.completionNotification?.status}; Benachrichtigungen=${sent.notifs.map((n) => n.title).join('|')}`);
    f.check(sent.notifs.length === 1, 'Nachholen: genau EINE In-App-Benachrichtigung an den Kunden', `${sent.notifs.length} ${sent.notifs.map((n) => n.title).join('|')}`);
    f.check(sent.mails.length === 1, 'Nachholen: genau EINE E-Mail an partner@e2e.invalid (Test-Postfach)', sent.mails.map((m) => m.name).join(', ') || 'keine');
    f.check(posts.length <= 1 || (sent.mails.length === 1 && sent.notifs.length === 1), 'Doppelklick: höchstens eine wirksame Sendung (Button gesperrt bzw. Server dedupliziert)', `POSTs=${posts.length}`);
    f.check(wf?.completionNotification?.status === 'sent', 'Workflow vermerkt die Abschluss-Benachrichtigung als gesendet', wf?.completionNotification?.status);
    const toastTxt = squash(await t.locator('[role="region"] ol > li, li[data-swipe-direction]').allInnerTexts().then((a) => a.join(' | ')).catch(() => ''));
    f.note(`   Meldungen: ${toastTxt.slice(0, 200)}`);
    await t.waitForTimeout(800);
    f.check(await rw.getByRole('button', { name: /Kunde über Abschluss informieren|Benachrichtigung erneut senden/ }).count() === 0, 'nach dem Senden wird die Aktion nicht mehr angeboten', squash((await rw.innerText()).match(/Kunde benachrichtigt: [^\n]{0,80}/)?.[0] || ''));
    await f.shot(t, 'nach_nachtraeglicher_benachrichtigung');

    // ---- Reload + erneuter Versuch (API, Nachpruefung) -> keine zweite Sendung ---------------------------
    await t.keyboard.press('Escape').catch(() => {});
    await t.reload({ waitUntil: 'domcontentloaded' }); await t.waitForTimeout(4500);
    const openBtn = t.locator('#order-workflows').getByRole('button', { name: 'Öffnen' }).first();
    if (await openBtn.count()) {
      await openBtn.click();
      const rw2 = rwDialog(t); await rw2.waitFor({ timeout: 15000 });
      await t.waitForTimeout(1200);
      f.check(await rw2.getByRole('button', { name: /Kunde über Abschluss informieren|Benachrichtigung erneut senden/ }).count() === 0, 'nach Reload: kein erneutes Angebot "Kunde über Abschluss informieren"');
      await f.shot(t, 'nach_reload_abschlusskarte');
      await t.keyboard.press('Escape').catch(() => {});
    } else f.note('   (Workflow-Karte "Öffnen" nach Reload nicht gefunden)');
    const snap2 = mailSnapshot(); const t2 = new Date(Date.now() - 1000);
    const stAuth = await apiLogin('staff');
    const again = await api(stAuth, 'POST', `/api/repair-workflows/${O.id}/notify-customer`, { target: 'completion' });
    await t.waitForTimeout(4000);
    const dup = { mails: newMailsFor(snap2, O.nr), notifs: await notifsFor(partner._id, O.id, t2) };
    f.note(`   API-Wiederholung (Nachprüfung) -> ${again.status} status=${again.data?.customerNotification?.status} "${String(again.data?.message || '').slice(0, 90)}"`);
    f.check(dup.mails.length === 0 && dup.notifs.length === 0 && again.data?.customerNotification?.status !== 'sent', 'erneuter Versuch nach erfolgreichem Senden: keine zweite E-Mail/Benachrichtigung', `${again.data?.customerNotification?.status} ${dup.mails.length}/${dup.notifs.length}`);
    const total = { mails: newMailsFor(snap0, O.nr), notifs: await notifsFor(partner._id, O.id, tStart) };
    f.check(total.mails.length === 1 && total.notifs.length === 1, 'Gesamt seit Workflow-Start: genau 1 E-Mail + 1 In-App-Benachrichtigung für diesen Auftrag', `${total.mails.length}/${total.notifs.length}`);
    if (total.mails.length === 1) f.note(`   E-Mail: ${total.mails[0].name}; enthält Auftragsnummer=${total.mails[0].text.includes(O.nr)}, Titel "Reparatur abgeschlossen"=${/Reparatur abgeschlossen/.test(total.mails[0].text)}`);
  } catch (e) {
    if (t) await f.shot(t, 'DEBUG_staff', true).catch(() => {});
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 3).join(' | ')}`);
  }
  f.check(ngSize() === ng0, 'netguard_after.log unverändert', `${ng0} -> ${ngSize()} B`);
  if (conn) await conn.close();
  await f.finish();
})();
