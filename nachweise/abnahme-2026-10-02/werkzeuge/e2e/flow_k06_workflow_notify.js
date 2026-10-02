// K06: Reparatur-Workflow "Kunde informieren" AN/AUS - echter Browser.
// Der Schalter sitzt NICHT in einer Vorlage, sondern je Aktion im Dialog "Reparatur-Workflow"
// (RepairWorkflowProcessDialog): Freigabe "Bestätigen & Starten", "Zwischenfall melden", "Reparatur abschließen".
// Ablauf (UI = Admin bzw. Kunde im Browser; API/DB nur fuer Testdaten und Nachpruefung):
//  A) Auftrag A: Workflow zuweisen, "Kunde informieren" AN, eigene Kundennachricht + interne Notiz -> Starten
//     => genau 1 In-App-Benachrichtigung + genau 1 E-Mail an partner@e2e.invalid, interne Notiz nicht enthalten.
//  B) Auftrag B: gleicher Schritt mit Schalter AUS => nichts beim Kunden (keine Benachrichtigung, keine Mail),
//     Team sieht den Verlaufseintrag.
//  C) Auftrag A: Zwischenfall AN (=> 1 + 1), Fortsetzen, gleicher Zwischenfall AUS (=> 0 + 0).
//  D) Reload: Freigabe-Daten / Zwischenfall-Historie zeigen den gespeicherten Schalterzustand; Verlauf (Team).
//  E) Kunde: /notifications (Suche) + Glocke zeigen genau die zwei AN-Nachrichten, nichts fuer die AUS-Schritte.
const fs = require('fs'); const path = require('path');
const { makeFlow, apiLogin, api, S } = require('./flowlib');
const mongoose = require('/home/adar/Projects/FixitHub/server/node_modules/mongoose');
const DB = 'mongodb://127.0.0.1:27099/e2e_after';
const MAILBOX = path.join(S, 'mailbox');
const NETGUARD = path.join(__dirname, 'netguard_after.log');
const RUN = String(Date.now()).slice(-7);
const MARK = { start: `K06START${RUN}`, inc: `K06INFO${RUN}`, internA: `K06INTERNSTART${RUN}`, internInc: `K06INTERNINC${RUN}`, internOff: `K06INTERNOFF${RUN}`, desc: `E2E-K06-${RUN}` };

let conn;
const db = async () => { if (!conn) conn = await mongoose.createConnection(DB).asPromise(); return conn; };
const oid = (v) => new mongoose.Types.ObjectId(String(v));

function decodeEml(raw) {
  // quoted-printable (Body) + Header-Faltung grob aufloesen - nur fuer die Textsuche.
  const s = raw.replace(/=\r?\n/g, '').replace(/\r?\n[ \t]+/g, ' ');
  return Buffer.from(s.replace(/=([0-9A-F]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8');
}
function subjectOf(raw) {
  const head = raw.split(/\r?\n\r?\n/)[0].replace(/\r?\n[ \t]+/g, ' ');
  const line = (head.match(/^Subject: (.*)$/m) || ['', ''])[1];
  return line.replace(/=\?UTF-8\?([QB])\?([^?]*)\?=\s*/gi, (m, enc, txt) => (enc.toUpperCase() === 'B'
    ? Buffer.from(txt, 'base64').toString('utf8')
    : Buffer.from(txt.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (x, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8')));
}
const mailSnapshot = () => new Set(fs.readdirSync(MAILBOX));
function newCustomerMails(snapshot) {
  return fs.readdirSync(MAILBOX).filter((n) => !snapshot.has(n) && /partner@e2e\.invalid/.test(n))
    .map((n) => { const raw = fs.readFileSync(path.join(MAILBOX, n), 'utf8'); return { name: n, text: decodeEml(raw), subject: subjectOf(raw) }; });
}
async function notifsFor(partnerId, orderId, since) {
  const c = await db();
  return c.collection('notifications').find({
    userId: oid(partnerId), createdAt: { $gte: since },
    $or: [{ orderId: oid(orderId) }, { 'metadata.orderId': String(orderId) }],
  }).toArray();
}
async function workflowOf(orderId) { return (await db()).collection('repairworkflows').findOne({ orderId: oid(orderId) }); }
async function orderDoc(orderId) { return (await db()).collection('orders').findOne({ _id: oid(orderId) }); }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollMails(snapshot, pred, ms = 8000) {
  const end = Date.now() + ms; let list = [];
  while (Date.now() < end) { list = newCustomerMails(snapshot).filter(pred); if (list.length) break; await wait(500); }
  await wait(1500); // eventuelle Doppelzustellung abwarten
  return newCustomerMails(snapshot).filter(pred);
}

async function prepareOrders(f) {
  const c = await db();
  const partner = await c.collection('users').findOne({ email: 'partner@e2e.invalid' });
  const svcDiag = await c.collection('services').findOne({ name: 'Diagnose E2E' });
  const svcDisp = await c.collection('services').findOne({ name: 'Displaytausch E2E' });
  if (!partner || !svcDiag || !svcDisp) throw new Error('Grunddaten (partner / Diagnose E2E / Displaytausch E2E) fehlen');
  // DHL muss im Testmodus sein (Checkout erzeugt ein Einsendelabel) - nie den Modus fremder Abläufe ändern.
  for (let i = 0; i < 30; i += 1) {
    const cfg = await c.collection('systemconfigurations').findOne({});
    const dhl = (cfg?.integrations || []).find((x) => x.provider === 'DHL' && x.type === 'shipping' && x.isActive !== false && !/returns/i.test(x.name || ''));
    if (!dhl || String(dhl.settings?.bookingLabelMode || 'dummy') === 'dummy') break;
    if (i === 29) throw new Error('DHL-Buchungslabel-Modus ist nicht "dummy" - Abbruch, um keinen externen Aufruf auszulösen');
    await wait(2000);
  }
  const cust = await apiLogin('customer');
  const cart = await api(cust, 'GET', '/api/cart');
  const ci = cart.data?.cart || {};
  if ((ci.items || []).length || (ci.repairOrders || []).length) throw new Error('Warenkorb von partner@e2e.invalid ist nicht leer (paralleler Ablauf?) - Abbruch');
  const r1 = await api(cust, 'POST', '/api/cart/add-repair-order', { deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 15', services: [String(svcDiag._id)], addOns: [], totalCost: 49.9, errorDescription: `${MARK.desc} A: Gerät startet nicht`, waterDamage: 'no', previousRepairAttempts: 'no', itemCondition: 'original', noLock: true });
  const r2 = await api(cust, 'POST', '/api/cart/add-repair-order', { deviceType: 'Tablet', deviceBrand: 'Apple', deviceModel: 'iPad Pro 9.7', services: [String(svcDisp._id)], addOns: [], totalCost: 129.9, errorDescription: `${MARK.desc} B: Display gebrochen`, waterDamage: 'no', previousRepairAttempts: 'no', itemCondition: 'original', noLock: true });
  const ck = await api(cust, 'POST', '/api/checkout/complete', { paymentMethod: 'paypal' });
  f.note(`Testdaten: Warenkorb+Checkout per API als partner@e2e.invalid (2 Geräte, PayPal ausstehend, keine Zahlung) -> ${r1.status}/${r2.status}/${ck.status} ${ck.data?.booking?.bookingNumber || ck.data?.bookingNumber || ''}`);
  if (ck.status >= 300) throw new Error(`Checkout fehlgeschlagen: ${ck.status} ${JSON.stringify(ck.data).slice(0, 200)}`);
  const orders = await c.collection('orders').find({ customerId: partner._id, errorDescription: { $regex: MARK.desc } }).sort({ _id: 1 }).toArray();
  const A = orders.find((o) => / A: /.test(o.errorDescription)); const B = orders.find((o) => / B: /.test(o.errorDescription));
  if (!A || !B) throw new Error('eigene Testaufträge nicht gefunden');
  const adm = await apiLogin('admin');
  for (const o of [A, B]) {
    const ir = await api(adm, 'POST', '/api/device-inspections/init', { orderId: String(o._id) });
    f.note(`Testdaten: Eingangsprüfung per API angelegt (Voraussetzung für die Karte "Reparatur-Workflow") ${o.orderNumber} -> ${ir.status}`);
    if (ir.status !== 200) throw new Error(`Inspektion konnte nicht angelegt werden: ${ir.status}`);
  }
  return { partnerId: String(partner._id), A: { id: String(A._id), nr: A.orderNumber }, B: { id: String(B._id), nr: B.orderNumber } };
}

async function openAssignAndStart(f, a, order) {
  await f.goto(a, `/orders/${order.id}`, 4000);
  await a.getByRole('button', { name: 'Arbeitsablauf zuweisen' }).click();
  const wd = a.getByRole('dialog', { name: 'Workflow zuweisen' });
  await wd.waitFor({ timeout: 15000 });
  await wd.getByText('Reparatur-Ausführungs-Workflow für diese Inspektion').waitFor({ timeout: 15000 });
  await wd.locator('xpath=.//*[normalize-space(text())="Reparatur-Workflow"]/ancestor::div[.//button][1]//button').first().click();
  const rw = a.getByRole('dialog', { name: 'Reparatur-Workflow' });
  await rw.waitFor({ timeout: 15000 });
  await rw.getByText('Wartet auf Freigabe').first().waitFor({ timeout: 10000 });
  return rw;
}

(async () => {
  const f = makeFlow('k06_workflow_notify'); await f.start();
  let a; let cust;
  const ngBefore = fs.existsSync(NETGUARD) ? fs.statSync(NETGUARD).size : 0;
  try {
    const T = await prepareOrders(f);
    f.note(`   Auftrag A ${T.A.nr} (${T.A.id}), Auftrag B ${T.B.nr} (${T.B.id}), Lauf ${RUN}`);
    await wait(3000); // Nebenwirkungen der Testdaten (Bestell-/Eingangsmails) vor dem Messbeginn abklingen lassen
    a = await f.session('admin');

    // ── A) Freigabe mit "Kunde informieren" AN ──────────────────────────────────────────────
    let rw = await openAssignAndStart(f, a, T.A);
    const sw = rw.getByRole('switch', { name: 'Kunde informieren' });
    f.check(await sw.getAttribute('aria-checked') === 'false', 'Freigabe: "Kunde informieren" ist standardmäßig AUS', await sw.getAttribute('aria-checked'));
    await sw.click();
    f.check(await sw.getAttribute('aria-checked') === 'true', 'Freigabe: Schalter per Klick EINGESCHALTET', await sw.getAttribute('aria-checked'));
    await rw.locator('#approve-internal-notes').fill(`Nur Team: Display-Kleber prüfen ${MARK.internA}`);
    const msgA = rw.locator('#approve-customer-message');
    f.check(await msgA.isVisible(), 'mit Schalter AN erscheint das Feld "Nachricht an Kunden"');
    await msgA.fill(`Guten Tag, wir haben mit der Reparatur Ihres Geräts zu Auftrag ${T.A.nr} begonnen. Referenz ${MARK.start}`);
    await f.shot(a, 'A_freigabe_schalter_an');
    let snap = mailSnapshot(); let t0 = new Date(Date.now() - 1000);
    await rw.getByRole('button', { name: /Bestätigen & Starten/ }).click();
    await a.getByText('Kunde wurde benachrichtigt').first().waitFor({ timeout: 20000 }).catch(() => {});
    await a.waitForTimeout(1500);
    await f.shot(a, 'A_gestartet_kunde_benachrichtigt');
    const uiA = await a.locator('body').innerText();
    f.check(/Kunde wurde benachrichtigt/.test(uiA), 'UI meldet getrennt: "Kunde wurde benachrichtigt"', (uiA.match(/Kunde wurde benachrichtigt[^\n]*\n?[^\n]*/) || [''])[0].replace(/\s+/g, ' '));
    let wf = await workflowOf(T.A.id);
    f.check(wf?.status === 'in-progress' && wf?.approvalData?.notifyCustomer === true, 'gespeichert: Workflow läuft, approvalData.notifyCustomer = true', `${wf?.status} ${wf?.approvalData?.notifyCustomer}`);
    let mails = await pollMails(snap, (m) => m.text.includes(MARK.start));
    let notifs = await notifsFor(T.partnerId, T.A.id, t0);
    f.check(notifs.length === 1 && notifs[0].title === 'Reparatur begonnen' && String(notifs[0].message).includes(MARK.start), 'AN: genau EINE In-App-Benachrichtigung für Auftrag A', `${notifs.length} ${notifs.map((n) => n.title).join('|')}`);
    f.check(mails.length === 1, 'AN: genau EINE E-Mail an partner@e2e.invalid mit der Kundennachricht', mails.map((m) => m.name).join(', ') || 'keine');
    f.check(mails.length === 1 && !mails[0].text.includes(MARK.internA) && notifs.every((n) => !String(n.message).includes(MARK.internA)), 'interne Notiz steht weder in der E-Mail noch in der Benachrichtigung');
    f.check(mails.length === 1 && /Benachrichtigung/.test(mails[0].subject) && /Titel\s+Reparatur begonnen/.test(mails[0].text) && mails[0].text.includes(T.A.nr), 'E-Mail deutsch: Betreff + Titel "Reparatur begonnen" + Auftragsnummer im Text', mails[0]?.subject || '');
    await a.keyboard.press('Escape'); await a.waitForTimeout(800);

    // ── B) gleicher Schritt mit Schalter AUS (Auftrag B) ─────────────────────────────────────
    rw = await openAssignAndStart(f, a, T.B);
    const swB = rw.getByRole('switch', { name: 'Kunde informieren' });
    if (await swB.getAttribute('aria-checked') === 'true') await swB.click(); // sicher AUS
    f.check(await swB.getAttribute('aria-checked') === 'false', 'Freigabe B: "Kunde informieren" AUS', await swB.getAttribute('aria-checked'));
    f.check(await rw.locator('#approve-customer-message').count() === 0, 'mit Schalter AUS gibt es kein Feld "Nachricht an Kunden"');
    await rw.locator('#approve-internal-notes').fill(`Nur Team: ohne Kundeninfo ${MARK.internOff}`);
    await f.shot(a, 'B_freigabe_schalter_aus');
    snap = mailSnapshot(); t0 = new Date(Date.now() - 1000);
    await rw.getByRole('button', { name: /Bestätigen & Starten/ }).click();
    await a.getByText('Gespeichert').first().waitFor({ timeout: 20000 }).catch(() => {});
    await a.waitForTimeout(6000); // Zeitfenster fuer evtl. (falsche) Benachrichtigung/Mail
    await f.shot(a, 'B_gestartet_ohne_kundeninfo');
    wf = await workflowOf(T.B.id);
    f.check(wf?.status === 'in-progress' && wf?.approvalData?.notifyCustomer === false && !wf?.approvalData?.customerNotification, 'gespeichert: Workflow B läuft, notifyCustomer = false, keine Benachrichtigung', `${wf?.status} ${wf?.approvalData?.notifyCustomer}`);
    f.check(!/Kunde wurde benachrichtigt/.test(await a.locator('body').innerText()), 'UI meldet bei AUS keine Kundenbenachrichtigung');
    notifs = await notifsFor(T.partnerId, T.B.id, t0);
    mails = newCustomerMails(snap).filter((m) => m.text.includes(T.B.nr) || m.text.includes(MARK.internOff));
    f.check(notifs.length === 0, 'AUS: KEINE In-App-Benachrichtigung für Auftrag B', notifs.map((n) => n.title).join('|') || '0');
    f.check(mails.length === 0, 'AUS: KEINE E-Mail zu Auftrag B an den Kunden', mails.map((m) => m.name).join(', ') || '0');
    let ob = await orderDoc(T.B.id);
    const startEntryB = (ob.timeline || []).filter((e) => e.source === 'Reparatur-Workflow' && /Reparatur gestartet/.test(e.description || e.status || ''));
    f.check(startEntryB.length === 1, 'Team-Verlauf von B hat den Eintrag "Reparatur gestartet"', startEntryB.length);
    await a.keyboard.press('Escape'); await a.waitForTimeout(800);

    // ── C) Zwischenfall AN, Fortsetzen, gleicher Zwischenfall AUS (Auftrag A) ─────────────────
    await f.goto(a, `/orders/${T.A.id}`, 4000);
    await a.locator('div.cursor-pointer', { hasText: 'Reparatur-Workflow' }).first().click();
    rw = a.getByRole('dialog', { name: 'Reparatur-Workflow' });
    await rw.waitFor({ timeout: 15000 });
    const reportIncident = async (notify, reason, message) => {
      await rw.getByRole('button', { name: /Zwischenfall melden/ }).first().click();
      const idlg = a.getByRole('dialog', { name: 'Zwischenfall melden' });
      await idlg.waitFor({ timeout: 10000 });
      await idlg.getByRole('combobox').click();
      await a.getByRole('option', { name: 'Mehr Zeit erforderlich' }).click();
      await idlg.getByPlaceholder('Was ist passiert?').fill(reason);
      const isw = idlg.getByRole('switch', { name: 'Kunde über den Zwischenfall informieren' });
      if ((await isw.getAttribute('aria-checked') === 'true') !== notify) await isw.click();
      const state = await isw.getAttribute('aria-checked');
      if (notify) await idlg.locator('#incident-customer-message').fill(message);
      await f.shot(a, notify ? 'C_zwischenfall_schalter_an' : 'C_zwischenfall_schalter_aus');
      await idlg.getByRole('button', { name: 'Zwischenfall melden', exact: true }).click();
      await idlg.waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});
      await a.waitForTimeout(1500);
      return state;
    };
    snap = mailSnapshot(); t0 = new Date(Date.now() - 1000);
    let st = await reportIncident(true, `Ersatzteil verspätet ${MARK.internInc}`, `Guten Tag, die Reparatur zu Auftrag ${T.A.nr} dauert etwas länger. Referenz ${MARK.inc}`);
    f.check(st === 'true', 'Zwischenfall 1: Schalter "Kunde informieren" AN', st);
    await f.shot(a, 'C_zwischenfall_an_gemeldet');
    mails = await pollMails(snap, (m) => m.text.includes(MARK.inc));
    notifs = await notifsFor(T.partnerId, T.A.id, t0);
    f.check(notifs.length === 1 && notifs[0].title === 'Information zu Ihrer Reparatur' && String(notifs[0].message).includes(MARK.inc), 'Zwischenfall AN: genau EINE In-App-Benachrichtigung', `${notifs.length} ${notifs.map((n) => n.title).join('|')}`);
    f.check(mails.length === 1 && !mails[0].text.includes(MARK.internInc), 'Zwischenfall AN: genau EINE E-Mail, ohne interne Kurzbeschreibung', mails.map((m) => m.name).join(', ') || 'keine');
    // Fortsetzen (gleiche Ausgangslage wie beim ersten Zwischenfall)
    await rw.getByRole('button', { name: 'Fortsetzen' }).first().click();
    await a.waitForTimeout(2500);
    wf = await workflowOf(T.A.id);
    f.check(wf?.status === 'in-progress', 'Workflow per "Fortsetzen" wieder in Bearbeitung', wf?.status);
    snap = mailSnapshot(); t0 = new Date(Date.now() - 1000);
    st = await reportIncident(false, `Ersatzteil erneut verspätet ${MARK.internOff}`);
    f.check(st === 'false', 'Zwischenfall 2: Schalter "Kunde informieren" AUS', st);
    await a.waitForTimeout(6000);
    await f.shot(a, 'C_zwischenfall_aus_gemeldet');
    wf = await workflowOf(T.A.id);
    const inc = wf?.incidents || [];
    f.check(inc.length === 2 && inc[1].reason.includes(MARK.internOff) && !inc[1].customerNotification && !inc[1].emailSentAt, 'Zwischenfall 2 gespeichert ohne Kundenbenachrichtigung', `${inc.length} ${JSON.stringify(inc[1]?.customerNotification || null)}`);
    notifs = await notifsFor(T.partnerId, T.A.id, t0);
    mails = newCustomerMails(snap).filter((m) => m.text.includes(T.A.nr) || m.text.includes(MARK.internOff));
    f.check(notifs.length === 0, 'Zwischenfall AUS: KEINE In-App-Benachrichtigung', notifs.map((n) => n.title).join('|') || '0');
    f.check(mails.length === 0, 'Zwischenfall AUS: KEINE E-Mail an den Kunden', mails.map((m) => m.name).join(', ') || '0');

    // ── D) Reload: gespeicherter Schalterzustand + Team-Verlauf ──────────────────────────────
    await a.reload({ waitUntil: 'domcontentloaded' }); await a.waitForTimeout(4000);
    await a.locator('div.cursor-pointer', { hasText: 'Reparatur-Workflow' }).first().click();
    rw = a.getByRole('dialog', { name: 'Reparatur-Workflow' });
    await rw.waitFor({ timeout: 15000 });
    await rw.getByRole('tab', { name: /^Details/ }).click(); await a.waitForTimeout(800);
    let txt = (await rw.innerText()).replace(/\s+/g, ' ');
    f.check(/Kunde benachrichtigt Ja, am \d{2}\.\d{2}\.\d{4}/.test(txt), 'nach Reload (A): Freigabe-Daten "Kunde benachrichtigt: Ja, am …"', (txt.match(/Kunde benachrichtigt [^·]{0,40}/) || [''])[0]);
    await f.shot(a, 'D_reload_A_freigabedaten');
    await rw.getByRole('tab', { name: /^Zwischenfälle/ }).click(); await a.waitForTimeout(800);
    const cards = rw.locator('div.rounded-lg.border-red-200');
    const cardTexts = (await cards.allInnerTexts()).map((s) => s.replace(/\s+/g, ' '));
    const onCard = cardTexts.find((s) => s.includes(MARK.internInc)) || '';
    const offCard = cardTexts.find((s) => s.includes(MARK.internOff)) || '';
    f.check(/Kunde benachrichtigt: Ja, am \d{2}\.\d{2}\.\d{4}/.test(onCard), 'nach Reload: Zwischenfall 1 "Kunde benachrichtigt: Ja, am …"', (onCard.match(/Kunde benachrichtigt: [^G]{0,30}/) || [''])[0]);
    f.check(/Kunde benachrichtigt: Nein\b/.test(offCard), 'nach Reload: Zwischenfall 2 "Kunde benachrichtigt: Nein" (Team sieht den Eintrag)', (offCard.match(/Kunde benachrichtigt: [^G]{0,30}/) || [''])[0]);
    await f.shot(a, 'D_reload_A_zwischenfaelle');
    await a.keyboard.press('Escape'); await a.waitForTimeout(800);
    await a.getByRole('tab', { name: 'Verlauf' }).click(); await a.waitForTimeout(3000);
    txt = await a.locator('main').innerText();
    f.check(/Reparatur gestartet/.test(txt) && (txt.match(/Zwischenfall gemeldet/g) || []).length >= 2, 'Team-Verlauf A: "Reparatur gestartet" + 2x "Zwischenfall gemeldet"', `${(txt.match(/Zwischenfall gemeldet/g) || []).length}x`);
    await f.shot(a, 'D_verlauf_A_team', true);
    await f.goto(a, `/orders/${T.B.id}`, 4000);
    await a.locator('div.cursor-pointer', { hasText: 'Reparatur-Workflow' }).first().click();
    rw = a.getByRole('dialog', { name: 'Reparatur-Workflow' });
    await rw.waitFor({ timeout: 15000 });
    await rw.getByRole('tab', { name: /^Details/ }).click(); await a.waitForTimeout(800);
    txt = (await rw.innerText()).replace(/\s+/g, ' ');
    f.check(/Kunde benachrichtigt Nein \(nicht gewählt\)/.test(txt), 'nach Reload (B): Freigabe-Daten "Kunde benachrichtigt: Nein (nicht gewählt)"', (txt.match(/Kunde benachrichtigt [^·]{0,30}/) || [''])[0]);
    await f.shot(a, 'D_reload_B_freigabedaten');
    await a.keyboard.press('Escape'); await a.waitForTimeout(800);
    await a.getByRole('tab', { name: 'Verlauf' }).click(); await a.waitForTimeout(3000);
    txt = await a.locator('main').innerText();
    f.check(/Reparatur gestartet/.test(txt), 'Team-Verlauf B zeigt "Reparatur gestartet" (Schritt AUS ist für das Team dokumentiert)');
    await f.shot(a, 'D_verlauf_B_team', true);

    // ── E) Kunde im Browser ──────────────────────────────────────────────────────────────────
    cust = await f.session('customer');
    await f.goto(cust, '/notifications', 4000);
    const search = cust.locator('input[type="search"]');
    await search.fill(`K06`); await cust.waitForTimeout(800);
    const runItems = cust.locator('article.notification-item').filter({ hasText: RUN });
    const titles = await runItems.locator('.notification-title').allInnerTexts();
    f.check(titles.length === 2 && titles.includes('Reparatur begonnen') && titles.includes('Information zu Ihrer Reparatur'), 'Kunde /notifications: genau die zwei AN-Nachrichten dieses Laufs', titles.join(' | '));
    const custText = await cust.locator('main').innerText().catch(async () => cust.locator('body').innerText());
    f.check(!custText.includes(MARK.internA) && !custText.includes(MARK.internInc) && !custText.includes(MARK.internOff), 'Kunde sieht keine internen Notizen/Kurzbeschreibungen');
    await f.shot(cust, 'E_kunde_benachrichtigungen_suche', true);
    await search.fill(T.B.nr); await cust.waitForTimeout(800);
    const bTitles = await cust.locator('article.notification-item .notification-title').allInnerTexts();
    f.check(!bTitles.some((t) => /Reparatur begonnen|Information zu Ihrer Reparatur/.test(t)), 'Kunde: zu Auftrag B keine Workflow-Benachrichtigung', bTitles.join(' | ') || 'keine Treffer');
    await f.shot(cust, 'E_kunde_suche_auftrag_B');
    // Glocke (neueste ungelesene) - auf derselben Kundenseite (Startseite zeigt das Cookie-Banner, das hier nicht bedient wird)
    await search.fill(''); await cust.waitForTimeout(500);
    await cust.getByRole('button', { name: /^Benachrichtigungen \(/ }).first().click();
    await cust.waitForTimeout(1500);
    const bell = await cust.getByRole('menu').innerText().catch(async () => cust.locator('[role="menu"], [data-radix-popper-content-wrapper]').first().innerText().catch(() => ''));
    f.check(bell.includes(MARK.inc) && bell.includes(MARK.start), 'Kunde: Glocke zeigt beide AN-Nachrichten dieses Laufs (Start + Zwischenfall)', bell.replace(/\s+/g, ' ').slice(0, 200));
    f.check(!bell.includes(MARK.internOff) && !bell.includes(MARK.internInc), 'Kunde: Glocke zeigt keine internen Texte');
    await f.shot(cust, 'E_kunde_glocke');
    await cust.keyboard.press('Escape');
    // Endkontrolle (DB): ueber den ganzen Lauf genau 2 Workflow-Benachrichtigungen fuer A, 0 fuer B
    const allA = (await notifsFor(T.partnerId, T.A.id, new Date(0))).filter((n) => /repairwf:/.test(n.dedupeKey || ''));
    const allB = (await notifsFor(T.partnerId, T.B.id, new Date(0))).filter((n) => /repairwf:/.test(n.dedupeKey || ''));
    f.check(allA.length === 2 && allB.length === 0, 'Endstand: Workflow-Benachrichtigungen A = 2 (Start + Zwischenfall 1), B = 0', `${allA.length}/${allB.length}`);
  } catch (e) {
    if (a) await f.shot(a, 'DEBUG_abbruch_admin', true).catch(() => {});
    if (cust) await f.shot(cust, 'DEBUG_abbruch_kunde', true).catch(() => {});
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 4).join(' | ')}`);
  }
  const ngAfter = fs.existsSync(NETGUARD) ? fs.statSync(NETGUARD).size : 0;
  f.check(ngAfter === ngBefore, 'netguard_after.log unverändert (kein externer Aufruf)', `${ngBefore} -> ${ngAfter} Bytes`);
  if (conn) await conn.close().catch(() => {});
  await f.finish();
})();
