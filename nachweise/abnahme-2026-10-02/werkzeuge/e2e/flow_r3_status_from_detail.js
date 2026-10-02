// Runde 3 (Track workflow, Punkt c): Der Inline-Statusumschalter in /admin/orders ist entfallen.
// Prueft im echten Browser (Admin, 1366x768), dass das Personal dieselbe Aufgabe leicht erledigt:
//  1) Liste ohne horizontales Scrollen; "Auftrag öffnen" je Zeile sichtbar (1 Klick ins Detail).
//  2) Detail: Status-Menue im Kopf im ersten Sichtbereich; Statuswechsel "In Bearbeitung" gespeichert,
//     Eintrag im "Verlauf" (UI) mit Akteur; Klicks Liste -> Status geaendert werden gezaehlt.
//  3) Stornieren ueber dasselbe Menue: Dialog, ohne Grund gesperrt, mit Grund gespeichert, Grund im Verlauf.
//  4) Zurueck zur Liste: Suche bleibt erhalten, Zeile zeigt den neuen Status.
// Testdaten: eigener frischer Auftrag per Warenkorb + Checkout-API des Testkunden (PayPal ausstehend, keine Zahlung).
// API/DB nur fuer Vorbereitung und Nachpruefung - die geprueften Schritte laufen in der echten Oberflaeche.
const fs = require('fs'); const path = require('path');
const { makeFlow, apiLogin, api } = require('./flowlib');
const mongoose = require('/home/adar/Projects/FixitHub/server/node_modules/mongoose');
const DB = 'mongodb://127.0.0.1:27099/e2e_after';
const NETGUARD = path.join(__dirname, 'netguard_after.log');
const RUN = String(Date.now()).slice(-7);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let conn;
const db = async () => { if (!conn) conn = await mongoose.createConnection(DB).asPromise(); return conn; };
const oid = (v) => new mongoose.Types.ObjectId(String(v));

async function createOwnOrder(f, cust) {
  const c = await db();
  const svc = await c.collection('services').findOne({ name: 'Diagnose E2E', isActive: true });
  if (!svc) throw new Error('Testservice "Diagnose E2E" fehlt');
  for (let i = 0; i < 10; i += 1) {
    const cart = await api(cust, 'GET', '/api/cart');
    const data = cart.data?.cart || cart.data?.data || cart.data || {};
    const n = (data.items || []).length + (data.repairOrders || []).length;
    if (n === 0) break;
    if (i === 9) throw new Error(`Warenkorb des Testkunden ist nicht leer (${n}) - anderer Ablauf aktiv?`);
    await sleep(3000);
  }
  const desc = `E2E-R3-STATUS-${RUN}: Akku entlädt sich schnell`;
  const add = await api(cust, 'POST', '/api/cart/add-repair-order', { deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 15', services: [String(svc._id)], addOns: [], totalCost: 49.9, errorDescription: desc, waterDamage: 'no', previousRepairAttempts: 'no', itemCondition: 'original', noLock: true });
  if (![200, 201].includes(add.status)) throw new Error(`Warenkorb: ${add.status}`);
  const co = await api(cust, 'POST', '/api/checkout/complete', { paymentMethod: 'paypal', checkoutAttemptId: `e2e-r3-status-${RUN}` });
  if (![200, 201].includes(co.status)) throw new Error(`Checkout: ${co.status}`);
  const order = await c.collection('orders').findOne({ errorDescription: desc });
  if (!order) throw new Error('Auftrag nicht gefunden');
  const inBooking = await c.collection('orders').countDocuments({ bookingId: order.bookingId });
  f.check(inBooking === 1, 'Testbuchung enthaelt genau den eigenen Auftrag', `${order.orderNumber} (Buchung mit ${inBooking} Auftrag)`);
  f.note(`   Testdaten: Auftrag ${order.orderNumber} (${order._id}) per Warenkorb + Checkout-API, Status ${order.status}`);
  return order;
}
async function stateOf(id) {
  const c = await db();
  const o = await c.collection('orders').findOne({ _id: oid(id) });
  return { status: o.status, n: (o.timeline || []).length, last: (o.timeline || []).slice(-1)[0] || null };
}

(async () => {
  const f = makeFlow('r3_status_from_detail'); await f.start();
  let a;
  const ngBefore = fs.existsSync(NETGUARD) ? fs.statSync(NETGUARD).size : 0;
  let clicks = 0;
  const click = async (locator, label) => { await locator.click(); clicks += 1; f.note(`   [Klick ${clicks}] ${label}`); };
  try {
    const cust = await apiLogin('customer');
    const order = await createOwnOrder(f, cust);
    const id = String(order._id);
    const t0 = await stateOf(id);

    // ---- 1) Liste ---------------------------------------------------------------------------------
    a = await f.session('admin', [1366, 768]);
    await f.goto(a, '/admin/orders', 3500);
    const search = a.getByRole('textbox', { name: 'Reparaturaufträge durchsuchen' });
    await search.fill(order.orderNumber);
    await a.waitForTimeout(2500);
    const row = a.locator('tr', { hasText: order.orderNumber }).first();
    await row.waitFor({ timeout: 15000 });
    const overflow = await a.evaluate(() => {
      const els = [document.documentElement, ...Array.from(document.querySelectorAll('main, main *'))];
      const scrollers = els.filter((el) => el.scrollWidth > el.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(el).overflowX));
      return { doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, scrollers: scrollers.length };
    });
    f.check(overflow.doc <= 0 && overflow.scrollers === 0, 'Liste 1366x768: kein horizontales Scrollen (Seite und Tabelle)', JSON.stringify(overflow));
    const openLink = row.getByRole('link', { name: 'Auftrag öffnen' });
    const box = await openLink.boundingBox();
    f.check(box && box.x + box.width <= 1366 && box.y + box.height <= 768, '"Auftrag öffnen" in der Zeile sichtbar (ohne Scrollen)', box ? `x=${Math.round(box.x)} y=${Math.round(box.y)}` : 'kein Link');
    const rowText = (await row.innerText()).replace(/\s+/g, ' ');
    f.check(/Ausstehend/.test(rowText), 'Zeile zeigt den Reparaturstatus als Badge (kein Umschalter mehr)', rowText.slice(0, 160));
    f.check(await row.getByRole('combobox').count() === 0, 'kein Inline-Statusumschalter in der Zeile', await row.getByRole('combobox').count());
    await f.shot(a, 'liste_gesucht');

    // ---- 2) Detail + Statuswechsel ------------------------------------------------------------------
    await click(openLink, 'Liste: "Auftrag öffnen"');
    await a.waitForURL((u) => String(u).includes(`/orders/${id}`), { timeout: 15000 });
    await a.waitForTimeout(3500);
    const statusBtn = a.getByRole('button', { name: /^(Ausstehend|In Bearbeitung|Pausiert|Qualitätskontrolle|Reparatur abgeschlossen|Abgeschlossen|Storniert)$/ }).first();
    await statusBtn.waitFor({ timeout: 15000 });
    const sb = await statusBtn.boundingBox();
    f.check(sb && sb.y + sb.height <= 768 && sb.x + sb.width <= 1366, 'Detail: Status-Menue im Kopf im ersten Sichtbereich', sb ? `x=${Math.round(sb.x)} y=${Math.round(sb.y)} "${(await statusBtn.innerText()).trim()}"` : 'nicht gefunden');
    const back = a.getByRole('link', { name: /Zurück zu den Reparaturaufträgen/ }).or(a.getByRole('button', { name: /Zurück zu den Reparaturaufträgen/ })).first();
    f.check(await back.count() > 0, 'Detail: Rueckweg "Zurück zu den Reparaturaufträgen" sichtbar', await back.count());
    await f.shot(a, 'detail_kopf');

    await click(statusBtn, 'Detail: Status-Menue öffnen');
    await a.waitForTimeout(600);
    await f.shot(a, 'status_menue');
    await click(a.getByRole('menuitem', { name: /^\s*In Bearbeitung\s*$/ }).first(), 'Menue: "In Bearbeitung"');
    await a.waitForTimeout(1200);
    const confirmDlg = a.getByRole('alertdialog').or(a.getByRole('dialog'));
    if (await confirmDlg.count()) {
      f.note(`   Rueckfrage-Dialog: ${(await confirmDlg.first().innerText()).replace(/\s+/g, ' ').slice(0, 160)}`);
      await click(confirmDlg.first().getByRole('button', { name: /Bestätigen|Speichern|Ändern|Übernehmen/ }).last(), 'Dialog bestätigen');
    }
    let t1 = await stateOf(id);
    for (let i = 0; i < 10 && t1.status !== 'in-progress'; i += 1) { await sleep(500); t1 = await stateOf(id); }
    f.check(t1.status === 'in-progress' && t1.n > t0.n, 'Statuswechsel gespeichert + Verlaufseintrag (DB)', `${t0.status}->${t1.status} timeline ${t0.n}->${t1.n}`);
    const clicksStatus = clicks;
    f.check(clicksStatus <= 3, `Klicks Liste -> Status geändert: ${clicksStatus} (Auftrag öffnen, Menü, Status)`, clicksStatus);
    await a.waitForTimeout(1500);
    const headerNow = (await a.getByRole('button', { name: /^In Bearbeitung$/ }).count()) > 0;
    f.check(headerNow, 'Kopf zeigt sofort den neuen Status "In Bearbeitung"', headerNow);
    await f.shot(a, 'nach_statuswechsel');

    await a.getByRole('tab', { name: 'Verlauf' }).click(); await a.waitForTimeout(2500);
    const verlauf1 = (await a.locator('main').innerText()).replace(/\s+/g, ' ');
    f.check(/Ausstehend\s*→\s*(Reparatur )?[Ii]n Bearbeitung/.test(verlauf1), 'Verlauf (UI) zeigt den Wechsel Ausstehend → In Bearbeitung', (verlauf1.match(/.{0,40}Ausstehend\s*→.{0,80}/) || [''])[0]);
    f.check(/Admin/i.test(verlauf1), 'Verlauf (UI) nennt den Akteur', (t1.last?.staffName || ''));
    await f.shot(a, 'verlauf_statuswechsel', true);

    // ---- 3) Stornieren mit Pflichtgrund -------------------------------------------------------------
    const statusBtn2 = a.getByRole('button', { name: /^In Bearbeitung$/ }).first();
    await statusBtn2.click(); await a.waitForTimeout(600);
    await a.getByRole('menuitem', { name: /^\s*Storniert\s*$/ }).first().click(); await a.waitForTimeout(1000);
    const cd = a.getByRole('dialog').first();
    f.check(await cd.count() > 0 && /Auftrag stornieren\?/.test(await cd.innerText()), 'Storno oeffnet den Dialog "Auftrag stornieren?"', await cd.count());
    const submit = cd.getByRole('button', { name: 'Auftrag stornieren' });
    f.check(await submit.isDisabled(), 'ohne Grund: "Auftrag stornieren" gesperrt', await submit.isDisabled());
    const dlgText = (await cd.innerText()).replace(/\s+/g, ' ');
    f.check(/Intern – nur für das Team/.test(dlgText) && /weder storniert noch erstattet/.test(dlgText), 'Dialog: Grund als intern gekennzeichnet, kein Erstattungsversprechen', dlgText.slice(0, 200));
    await f.shot(a, 'storno_dialog_leer');
    const reason = `Kunde hat telefonisch abgesagt (E2E ${RUN})`;
    await cd.locator('textarea').first().fill(reason);
    f.check(!(await submit.isDisabled()), 'mit Grund: "Auftrag stornieren" aktiv', !(await submit.isDisabled()));
    await submit.click(); await a.waitForTimeout(2500);
    let t2 = await stateOf(id);
    for (let i = 0; i < 10 && t2.status !== 'cancelled'; i += 1) { await sleep(500); t2 = await stateOf(id); }
    f.check(t2.status === 'cancelled' && JSON.stringify(t2.last || {}).includes(RUN), 'Storno gespeichert, Grund im Verlaufseintrag (DB)', `${t2.status}`);
    await a.getByRole('tab', { name: 'Verlauf' }).click().catch(() => {}); await a.waitForTimeout(2500);
    const verlauf2 = (await a.locator('main').innerText()).replace(/\s+/g, ' ');
    f.check(verlauf2.includes(reason), 'Verlauf (UI) zeigt den Storno-Grund', (verlauf2.match(/.{0,60}telefonisch abgesagt.{0,40}/) || [''])[0]);
    await f.shot(a, 'verlauf_storno', true);
    const adm = await apiLogin('admin');
    const srv = await api(adm, 'PUT', `/api/orders/${id}/status`, { status: 'in-progress' });
    f.check(srv.status === 409, 'Server: Statuswechsel nach Storno abgelehnt (409)', `${srv.status} ${srv.data?.code || ''}`);

    // ---- 4) Zurueck zur Liste ----------------------------------------------------------------------
    await a.getByRole('link', { name: /Zurück zu den Reparaturaufträgen/ }).or(a.getByRole('button', { name: /Zurück zu den Reparaturaufträgen/ })).first().click();
    await a.waitForURL((u) => String(u).includes('/admin/orders'), { timeout: 15000 });
    await a.waitForTimeout(3000);
    const searchValue = await a.getByRole('textbox', { name: 'Reparaturaufträge durchsuchen' }).inputValue();
    f.check(searchValue === order.orderNumber, 'Zurueck zur Liste: Suche bleibt erhalten', searchValue);
    const row2 = (await a.locator('tr', { hasText: order.orderNumber }).first().innerText()).replace(/\s+/g, ' ');
    f.check(/Storniert/.test(row2), 'Liste zeigt den neuen Status "Storniert"', row2.slice(0, 120));
    await f.shot(a, 'liste_zurueck');

    const ngAfter = fs.existsSync(NETGUARD) ? fs.statSync(NETGUARD).size : 0;
    f.check(ngAfter === ngBefore, 'netguard_after.log unveraendert (kein externer Aufruf)', `${ngBefore} -> ${ngAfter} Bytes`);
    f.note(`   ERGEBNIS Klickzahl: Liste (Suche getippt) -> Status geaendert = ${clicksStatus} Klicks; Storno = +3 Klicks (Menue, "Storniert", "Auftrag stornieren") + Grund tippen.`);
  } catch (e) {
    if (a) await f.shot(a, 'DEBUG_abbruch', true).catch(() => {});
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 4).join(' | ')}`);
  }
  if (conn) await conn.close().catch(() => {});
  await f.finish();
})();
