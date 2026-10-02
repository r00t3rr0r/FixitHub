// LOST-1: Eingeloggter Kunde kann eine vom Team angeforderte Aktion wieder als erledigt melden
// (CommunicationPanel "Als erledigt markieren"). Vorbereitung: Admin legt per Admin-API (gleicher Endpunkt wie
// "Aktion anfordern" im Panel) Aktionen an. Gepruefte Schritte laufen ueber die echte Oberflaeche:
//  A) Kunde im Auftrag (/orders/:id)  B) Kunde im Postfach (/messages)  C) Admin sieht "Erledigt"
//  D) Reparaturanfrage-Variante im Postfach.
const { makeFlow, apiLogin, api } = require('./flowlib');

const mongoose = require('/home/adar/Projects/FixitHub/server/node_modules/mongoose');
// Datensaetze werden zur Laufzeit gewaehlt (die Test-DB wird neu aufgebaut): juengster offener Auftrag und
// juengste offene Reparaturanfrage des Partnerkunden; fehlt eine Anfrage, wird sie ueber die Kunden-API angelegt.
let ORDER_ID; let ORDER_NO; let RR_ID; let RR_NO;
async function pickRecords(custApi, note) {
  const c = await mongoose.createConnection('mongodb://127.0.0.1:27099/e2e_after').asPromise();
  const partner = await c.collection('users').findOne({ email: 'partner@e2e.invalid' });
  const order = await c.collection('orders').find({ customerId: partner._id, status: { $in: ['pending', 'diagnostic-assessment', 'in-progress'] }, orderNumber: /^ORD-2026-/ }).sort({ _id: -1 }).limit(1).next();
  let rr = await c.collection('repairrequests').find({ $or: [{ customerId: partner._id }, { userId: partner._id }], status: { $in: ['pending', 'in_review', 'reviewing'] } }).sort({ _id: -1 }).limit(1).next();
  if (!rr) {
    const created = await api(custApi, 'POST', '/api/repair-requests', { deviceType: 'Smartphone', brand: 'Apple', model: 'iPhone 15', problemDescription: 'E2E LOST1 Display flackert', contactPreference: 'email' });
    note('   Testdaten: Reparaturanfrage ueber die Kunden-API angelegt -> ' + created.status);
    rr = await c.collection('repairrequests').find({ $or: [{ customerId: partner._id }, { userId: partner._id }] }).sort({ _id: -1 }).limit(1).next();
  }
  await c.close();
  ORDER_ID = String(order._id); ORDER_NO = order.orderNumber; RR_ID = String(rr._id); RR_NO = rr.requestNumber || String(rr._id);
  note('   Testdaten: Auftrag ' + ORDER_NO + ', Reparaturanfrage ' + RR_NO);
}
const stamp = Date.now().toString().slice(-6);
const DESC_A = `E2E-LOST1-A ${stamp}: Bitte bestaetigen Sie den Teileaustausch (Display).`;
const DESC_B = `E2E-LOST1-B ${stamp}: Bitte bestaetigen Sie die Zusatzkosten von 19,90 €.`;
const DESC_R = `E2E-LOST1-R ${stamp}: Bitte geben Sie die Reparatur frei.`;

const msgsOf = (res) => res.data?.communication?.messages || res.data?.messages || [];
const findQa = (res, desc) => msgsOf(res).find((m) => m.messageType === 'quick_action' && (m.quickAction?.description || '') === desc);
const card = (page, desc) => page.locator('div.border-l-4', { hasText: desc }).last();

(async () => {
  const f = makeFlow('lost1_quick_action'); await f.start();
  try {
    const adminApi = await apiLogin('admin');
    const custApi = await apiLogin('customer');
    await pickRecords(custApi, f.note);

    // --- Vorbereitung (API, protokolliert) ---
    const a = await api(adminApi, 'POST', `/api/inspection-communication/${ORDER_ID}/quick-action`, { actionType: 'part_replacement', description: DESC_A, clientMessageId: `e2e-lost1-a-${stamp}` });
    f.note(`   [setup] Admin-API POST /api/inspection-communication/${ORDER_NO}/quick-action part_replacement -> ${a.status}`);
    const b = await api(adminApi, 'POST', `/api/inspection-communication/${ORDER_ID}/quick-action`, { actionType: 'additional_costs', description: DESC_B, clientMessageId: `e2e-lost1-b-${stamp}` });
    f.note(`   [setup] Admin-API POST /api/inspection-communication/${ORDER_NO}/quick-action additional_costs -> ${b.status}`);
    const r = await api(adminApi, 'POST', `/api/repair-request-communication/${RR_ID}/quick-action`, { actionType: 'approval_required', description: DESC_R });
    f.note(`   [setup] Admin-API POST /api/repair-request-communication/${RR_NO}/quick-action approval_required -> ${r.status}`);
    f.check(a.status === 201 && b.status === 201 && r.status === 201, 'Vorbereitung: drei offene Aktionen angelegt', `${a.status}/${b.status}/${r.status}`);

    // --- A) Kunde im Auftrag ---
    const cust = await f.session('customer');
    await f.goto(cust, `/orders/${ORDER_ID}`, 3500);
    const cardA = card(cust, DESC_A);
    await cardA.scrollIntoViewIfNeeded().catch(() => {});
    f.check(await cardA.count() > 0, 'Kunde (Auftrag): Aktion A sichtbar');
    f.check(await cust.getByText(/Rückfragen? beantworten/).count() > 0, 'Kunde (Auftrag): Hinweis "Rückfrage beantworten" vor dem Erledigen');
    const btnA = cardA.getByRole('button', { name: 'Als erledigt markieren' });
    f.check(await btnA.count() === 1, 'Kunde (Auftrag): Knopf "Als erledigt markieren" in Aktion A vorhanden');
    await f.shot(cust, 'kunde_auftrag_aktion_offen');
    await btnA.click();
    await cust.waitForTimeout(2500);
    f.check((await cardA.getByText('Erledigt', { exact: true }).count()) > 0, 'Kunde (Auftrag): Aktion A als "Erledigt" markiert');
    f.check(await cardA.getByRole('button', { name: 'Als erledigt markieren' }).count() === 0, 'Kunde (Auftrag): Knopf nach dem Erledigen verschwunden');
    f.check(await cust.getByText('Als erledigt gemeldet').count() > 0, 'Kunde (Auftrag): Erfolgsmeldung sichtbar');
    await f.shot(cust, 'kunde_auftrag_aktion_erledigt');
    let thread = await api(custApi, 'GET', `/api/inspection-communication/${ORDER_ID}`);
    const qaA = findQa(thread, DESC_A);
    f.check(qaA?.quickAction?.status === 'completed', 'DB/API: Aktion A completed', qaA?.quickAction?.status);
    f.note(`   API: completedByRole=${qaA?.quickAction?.completedByRole || '-'} completedAt=${qaA?.quickAction?.completedAt || '-'}`);
    await cust.reload({ waitUntil: 'domcontentloaded' }); await cust.waitForTimeout(3500);
    const cardA2 = card(cust, DESC_A);
    f.check((await cardA2.getByText('Erledigt', { exact: true }).count()) > 0, 'Kunde (Auftrag): nach Neuladen weiterhin "Erledigt"');
    f.check(await cardA2.getByRole('button', { name: 'Als erledigt markieren' }).count() === 0, 'Kunde (Auftrag): nach Neuladen kein Erledigen-Knopf');
    // Aktion B ist noch offen -> Hinweis bleibt (1 Rueckfrage)
    f.check(await cust.getByText('Rückfrage beantworten', { exact: true }).count() > 0, 'Kunde (Auftrag): Hinweis zaehlt nur noch die offene Aktion B ("Rückfrage beantworten")');
    await f.shot(cust, 'kunde_auftrag_nach_reload');

    // --- B) Kunde im Postfach ---
    await f.goto(cust, '/messages', 3500);
    const row = cust.getByRole('button', { name: new RegExp(`Auftrag ${ORDER_NO}`) }).first();
    f.check(await row.count() > 0, `Kunde (Postfach): Gespraech ${ORDER_NO} gelistet`);
    await row.click(); await cust.waitForTimeout(3000);
    const cardB = card(cust, DESC_B);
    await cardB.scrollIntoViewIfNeeded().catch(() => {});
    const btnB = cardB.getByRole('button', { name: 'Als erledigt markieren' });
    f.check(await btnB.count() === 1, 'Kunde (Postfach): Knopf "Als erledigt markieren" in Aktion B');
    f.check((await card(cust, DESC_A).getByText('Erledigt', { exact: true }).count()) > 0, 'Kunde (Postfach): Aktion A dort ebenfalls "Erledigt"');
    await f.shot(cust, 'kunde_postfach_aktion_offen');
    await btnB.click(); await cust.waitForTimeout(2500);
    f.check((await cardB.getByText('Erledigt', { exact: true }).count()) > 0, 'Kunde (Postfach): Aktion B als "Erledigt" markiert');
    await f.shot(cust, 'kunde_postfach_aktion_erledigt');
    await cust.reload({ waitUntil: 'domcontentloaded' }); await cust.waitForTimeout(3000);
    const row2 = cust.getByRole('button', { name: new RegExp(`Auftrag ${ORDER_NO}`) }).first();
    if (await row2.count()) { await row2.click(); await cust.waitForTimeout(3000); }
    f.check((await card(cust, DESC_B).getByText('Erledigt', { exact: true }).count()) > 0, 'Kunde (Postfach): nach Neuladen Aktion B weiterhin "Erledigt"');
    thread = await api(custApi, 'GET', `/api/inspection-communication/${ORDER_ID}`);
    f.check(findQa(thread, DESC_B)?.quickAction?.status === 'completed', 'DB/API: Aktion B completed');
    const stillPending = msgsOf(thread).filter((m) => m.quickAction?.status === 'pending').length;
    f.note(`   offene Aktionen im Auftrag laut API: ${stillPending}`);
    await f.goto(cust, `/orders/${ORDER_ID}`, 3500);
    f.check(stillPending > 0 || await cust.getByText(/Rückfragen? beantworten/).count() === 0, 'Kunde (Auftrag): "Rückfrage beantworten" verschwunden, wenn nichts mehr offen');
    await f.shot(cust, 'kunde_auftrag_ohne_offene_aktion');

    // --- C) Admin sieht die Erledigung ---
    const adm = await f.session('admin');
    await f.goto(adm, `/orders/${ORDER_ID}?bereich=kommunikation`, 4000);
    const admA = card(adm, DESC_A); const admB = card(adm, DESC_B);
    await admA.scrollIntoViewIfNeeded().catch(() => {});
    f.check((await admA.getByText('Erledigt', { exact: true }).count()) > 0 && (await admB.getByText('Erledigt', { exact: true }).count()) > 0, 'Admin (Auftrag, Kommunikation): beide Aktionen "Erledigt"');
    f.check(await admA.getByText('Wartet auf den Kunden.').count() === 0 && await admB.getByText('Wartet auf den Kunden.').count() === 0, 'Admin: kein "Wartet auf den Kunden." mehr');
    f.check(await admA.getByRole('button', { name: 'Als erledigt markieren' }).count() === 0, 'Admin: kein Kunden-Erledigen-Knopf (nur Kunde)');
    await f.shot(adm, 'admin_auftrag_kommunikation_erledigt');

    // --- D) Reparaturanfrage-Variante (Postfach des Kunden) ---
    await f.goto(cust, '/messages', 3500);
    const rrRow = cust.getByRole('button', { name: new RegExp(`Reparaturanfrage ${RR_NO}`) }).first();
    if (await rrRow.count() === 0) {
      f.check(false, `Kunde (Postfach): Reparaturanfrage ${RR_NO} gelistet`);
    } else {
      await rrRow.click(); await cust.waitForTimeout(3000);
      const cardR = card(cust, DESC_R);
      await cardR.scrollIntoViewIfNeeded().catch(() => {});
      const btnR = cardR.getByRole('button', { name: 'Als erledigt markieren' });
      f.check(await btnR.count() === 1, 'Kunde (Postfach, Reparaturanfrage): Knopf "Als erledigt markieren"');
      await f.shot(cust, 'kunde_rr_aktion_offen');
      await btnR.click(); await cust.waitForTimeout(2500);
      f.check((await cardR.getByText('Erledigt', { exact: true }).count()) > 0, 'Kunde (Reparaturanfrage): Aktion als "Erledigt" markiert');
      await f.shot(cust, 'kunde_rr_aktion_erledigt');
      await cust.reload({ waitUntil: 'domcontentloaded' }); await cust.waitForTimeout(3000);
      const rrRow2 = cust.getByRole('button', { name: new RegExp(`Reparaturanfrage ${RR_NO}`) }).first();
      if (await rrRow2.count()) { await rrRow2.click(); await cust.waitForTimeout(3000); }
      f.check((await card(cust, DESC_R).getByText('Erledigt', { exact: true }).count()) > 0, 'Kunde (Reparaturanfrage): nach Neuladen weiterhin "Erledigt"');
      const rrThread = await api(custApi, 'GET', `/api/repair-request-communication/${RR_ID}`);
      f.check(findQa(rrThread, DESC_R)?.quickAction?.status === 'completed', 'DB/API: Reparaturanfrage-Aktion completed');
      // Admin sieht es im Postfach
      await f.goto(adm, '/messages', 3500);
      await adm.getByPlaceholder(/Auftrags-, Buchungs-/).fill(RR_NO).catch(() => {});
      await adm.waitForTimeout(2500);
      const admRr = adm.getByRole('button', { name: new RegExp(`Reparaturanfrage ${RR_NO}`) }).first();
      if (await admRr.count()) {
        await admRr.click(); await adm.waitForTimeout(3000);
        f.check((await card(adm, DESC_R).getByText('Erledigt', { exact: true }).count()) > 0, 'Admin (Postfach, Reparaturanfrage): Aktion "Erledigt"');
        await f.shot(adm, 'admin_rr_erledigt');
      } else f.check(false, 'Admin (Postfach): Reparaturanfrage per Suche gefunden');
    }

    // Fremder Kunde darf die Aktion nicht abschliessen (Server-Gegenprobe)
    const other = await apiLogin('other');
    const foreign = await api(other, 'PUT', `/api/inspection-communication/${ORDER_ID}/quick-action/${qaA?._id}/complete`, {});
    f.check(foreign.status === 403 || foreign.status === 404, 'fremder Kunde: kein Abschluss fremder Aktionen', foreign.status);
  } catch (e) {
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n')[0]}`);
  }
  await f.finish();
})();
