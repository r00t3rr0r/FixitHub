// K17: Ersatzteilbestellung + Sendungsnummer bleiben gespeichert; Wareneingang teilweise und Rest;
//      Mehrbuchung wird mit klarer deutscher Meldung blockiert; Bestellnummer EPO-NNNNNN eindeutig.
//      Teil A bei 1366x768, Teil B (Kernschritte) bei 778x718 (kein horizontaler Seitenscroll,
//      Dialoge bedienbar, Speichern erreichbar).
// Alle geprueften Schritte laufen ueber die UI (Klicks/Tastatur). API/DB nur fuer Testdaten und Nachpruefung.
const fs = require('fs'); const path = require('path');
const { makeFlow, apiLogin, api, S } = require('./flowlib');
const mongoose = require('/home/adar/Projects/FixitHub/server/node_modules/mongoose');

const stamp = Date.now().toString().slice(-6);
const PART_NAME = `E2E K17 Display ${stamp}`;
const PART_SKU = `E2E-K17-${stamp}`;
const SUPPLIER_NAME = `E2E K17 Lieferant ${stamp}`;
const SUPPLIER_EMAIL = `k17-${stamp}@e2e.invalid`;
const NOTE_A = `E2E K17 Bestellung A ${stamp}`;
const NOTE_B = `E2E K17 Bestellung B ${stamp}`;
const TRACK_A = `00340434K17A${stamp}`;
const TRACK_B = `00340434K17B${stamp}`;
const NETGUARD = path.join(__dirname, 'netguard_after.log');
const MAILBOX = path.join(S, 'mailbox');

let conn;
const db = () => conn.db;
const orderByNote = (note) => db().collection('epartorders').findOne({ notes: note });
const partStock = async (partId) => {
  const p = await db().collection('inventories').findOne({ _id: partId });
  return (p?.versions || []).reduce((n, v) => n + (Number(v.quantity) || 0), 0);
};
const hScroll = (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth, iw: window.innerWidth }));
const inViewport = async (locator, vh) => {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  return { ok: !!b && b.y >= 0 && b.y + b.height <= vh + 1, box: b ? { y: Math.round(b.y), h: Math.round(b.height) } : null };
};
const dialogGeo = (dlg) => dlg.evaluate((d) => { const r = d.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), vh: innerHeight, vw: innerWidth }; });

async function pickOption(page, triggerLocator, optionName) {
  await triggerLocator.click();
  const opt = page.getByRole('option', { name: optionName });
  await opt.first().waitFor({ state: 'visible', timeout: 10000 });
  await opt.first().click();
  await page.waitForTimeout(300);
}

// Bestellung im Dialog "Bestellung anlegen" ausfuellen (Lieferant ist bereits gewaehlt oder wird gewaehlt)
async function fillOrderLine(page, dlg, { qty, price }) {
  await pickOption(page, dlg.getByLabel('Ersatzteil (Position 1)'), new RegExp(PART_NAME));
  const q = dlg.getByLabel('Menge', { exact: true });
  await q.click(); await q.press('Control+a'); await q.type(String(qty));
  const p = dlg.getByLabel('Einzelpreis (€)');
  await p.click(); await p.press('Control+a'); await p.type(price);
  await p.press('Tab');
}

(async () => {
  const f = makeFlow('k17_epart_order_tracking'); await f.start();
  const ngBefore = fs.existsSync(NETGUARD) ? fs.statSync(NETGUARD).size : 0;
  const mailsBefore = new Set(fs.existsSync(MAILBOX) ? fs.readdirSync(MAILBOX) : []);
  let a; let a2; let m;
  try {
    conn = await mongoose.createConnection('mongodb://127.0.0.1:27099/e2e_after').asPromise();
    const adm = await apiLogin('admin');

    // ---------- Testdaten: eigenes Lagerteil (kein UI-Schritt dieses Kriteriums) ----------
    const inv = await api(adm, 'POST', '/api/inventory', {
      itemName: PART_NAME, category: 'Display', manufacturer: 'E2E', brand: 'E2E', model: 'K17', sku: PART_SKU,
      itemDescription: 'E2E-Testteil K17 (Testdaten)',
      versions: [{ versionType: 'original', versionId: `${PART_SKU}-V1`, quantity: 0, minStockLevel: 0, reorderLevel: 0, unitCost: 12.5, sellingPrice: 30, storageLocation: 'E2E-Regal K17' }],
    });
    if (inv.status !== 201) throw new Error(`Testteil konnte nicht angelegt werden: ${inv.status} ${JSON.stringify(inv.data).slice(0, 200)}`);
    const partId = new mongoose.Types.ObjectId(String(inv.data.item._id));
    f.note(`Testdaten: Lagerteil "${PART_NAME}" (SKU ${PART_SKU}, Bestand 0) per POST /api/inventory angelegt (id ${partId})`);
    const stock0 = await partStock(partId);

    // ================= Teil A: 1366x768 =================
    f.note('--- Teil A: Desktop 1366x768 ---');
    a = await f.session('admin');
    await f.goto(a, '/admin/epart-orders?tab=orders', 3000);
    await a.getByRole('heading', { name: 'Ersatzteilbestellungen' }).waitFor({ timeout: 20000 });
    await a.getByRole('button', { name: 'Bestellung anlegen' }).click();
    let dlg = a.getByRole('dialog', { name: 'Bestellung anlegen' });
    await dlg.waitFor({ timeout: 10000 });
    f.check(await dlg.count() === 1, 'Dialog "Bestellung anlegen" geoeffnet');

    // Lieferant ueber die UI aus dem Bestelldialog heraus anlegen
    await dlg.getByRole('button', { name: 'Neuen Lieferanten anlegen' }).click();
    const sdlg = a.getByRole('dialog', { name: 'Lieferant anlegen' });
    await sdlg.waitFor({ timeout: 10000 });
    f.check(/zurück zur Bestellung/.test(await sdlg.innerText()), 'Lieferanten-Dialog erklaert die Rueckkehr zur Bestellung');
    await sdlg.locator('#epo-supplier-name').fill(SUPPLIER_NAME);
    await sdlg.locator('#epo-supplier-email').fill(SUPPLIER_EMAIL);
    await sdlg.locator('#epo-supplier-contactPerson').fill('Herr K17 Test');
    await sdlg.locator('#epo-supplier-phone').fill('+49 30 1717171');
    await sdlg.locator('#epo-supplier-city').fill('Berlin');
    await f.shot(a, 'A_lieferant_dialog');
    await sdlg.getByRole('button', { name: 'Lieferant speichern' }).click();
    await a.getByText(`Lieferant „${SUPPLIER_NAME}“ angelegt und ausgewählt`).first().waitFor({ timeout: 15000 });
    dlg = a.getByRole('dialog', { name: 'Bestellung anlegen' });
    await dlg.waitFor({ timeout: 10000 });
    const supTrig = await dlg.locator('#epo-new-supplier').innerText();
    f.check(supTrig.includes(SUPPLIER_NAME), 'nach dem Speichern zurueck im Bestelldialog, neuer Lieferant ist ausgewaehlt', supTrig.trim());
    const supDb = await db().collection('suppliers').findOne({ name: SUPPLIER_NAME });
    f.check(!!supDb && supDb.email === SUPPLIER_EMAIL && supDb.isActive !== false, 'DB: Lieferant gespeichert (Name, E-Mail, aktiv)', supDb ? `${supDb.name} / ${supDb.email}` : 'fehlt');

    // Position, Status, Versand, Notiz
    await fillOrderLine(a, dlg, { qty: 5, price: '12,50' });
    await pickOption(a, dlg.locator('#epo-new-status'), /^Bestellt$/);
    await dlg.locator('#epo-new-shipping').fill('4,90');
    await dlg.locator('#epo-new-notes').fill(NOTE_A);
    const preview = (await dlg.locator('dl').last().innerText()).replace(/\s+/g, ' ');
    f.check(/62,50\s*€/.test(preview) && /4,90\s*€/.test(preview) && /67,40\s*€/.test(preview), 'Vorschau: Positionen 62,50 €, Versand 4,90 €, Gesamt (brutto) 67,40 €', preview);
    await f.shot(a, 'A_bestellung_ausgefuellt');
    await dlg.getByRole('button', { name: 'Bestellung anlegen' }).click();
    const toastA = a.getByText(/^Bestellung EPO-\d+ angelegt$/).first();
    await toastA.waitFor({ timeout: 15000 });
    const toastTxtA = (await toastA.innerText()).trim();
    const numA = (toastTxtA.match(/EPO-\d+/) || [])[0];
    f.check(/^EPO-\d{6}$/.test(numA || ''), 'Meldung nennt die Bestellnummer im Format EPO-NNNNNN', toastTxtA);
    await a.waitForTimeout(1200);
    f.check(await a.getByRole('dialog', { name: 'Bestellung anlegen' }).count() === 0, 'Dialog nach dem Speichern geschlossen');
    const rowA = a.getByRole('row').filter({ hasText: numA });
    f.check(await rowA.count() === 1 && /Bestellt/.test(await rowA.innerText()) && (await rowA.innerText()).includes(SUPPLIER_NAME), 'Liste zeigt die neue Bestellung (Nummer, Lieferant, Status "Bestellt")', (await rowA.innerText().catch(() => '')).replace(/\s+/g, ' '));
    await f.shot(a, 'A_liste_nach_anlegen');
    let oA = await orderByNote(NOTE_A);
    f.check(!!oA && oA.orderNumber === numA && oA.status === 'confirmed' && String(oA.supplierId) === String(supDb?._id)
      && oA.items.length === 1 && oA.items[0].quantity === 5 && Number(oA.items[0].unitPrice) === 12.5 && String(oA.items[0].partId) === String(partId)
      && Math.abs(Number(oA.totalCost) - 67.4) < 0.005,
    'DB: Bestellung A gespeichert (Nummer, Lieferant, Teil, 5 × 12,50, Status confirmed, Gesamt 67,40)', oA ? `${oA.orderNumber} ${oA.status} qty=${oA.items[0]?.quantity} total=${oA.totalCost}` : 'fehlt');

    // Sendungsnummer erfassen + speichern
    await a.getByRole('button', { name: `Details zu ${numA} ansehen` }).click();
    let ddlg = a.getByRole('dialog', { name: `Bestellung ${numA}` });
    await ddlg.waitFor({ timeout: 10000 });
    f.check(/Sendungsnr\.: nicht erfasst/.test(await ddlg.innerText()), 'Detaildialog: Sendungsnummer zunaechst "nicht erfasst"');
    await ddlg.locator('#epo-detail-tracking').fill(TRACK_A);
    f.check(await ddlg.getByText('Ungespeicherte Änderungen').count() === 1, 'Hinweis "Ungespeicherte Änderungen" vor dem Speichern');
    await ddlg.getByRole('button', { name: 'Änderungen speichern' }).click();
    await ddlg.getByText(/Gespeichert um \d{2}:\d{2}/).waitFor({ timeout: 15000 });
    f.check((await ddlg.innerText()).includes(`Sendungsnr.: ${TRACK_A}`), 'nach dem Speichern: Kopf zeigt die Sendungsnummer, "Gespeichert um …"');
    await f.shot(a, 'A_sendungsnummer_gespeichert');
    await a.keyboard.press('Escape');
    await a.waitForTimeout(800);

    // Reload: Bestellung + Sendungsnummer bleiben erhalten
    await a.evaluate(() => { try { sessionStorage.clear(); localStorage.removeItem('epo-draft'); } catch (e) { /* ignore */ } });
    await a.reload({ waitUntil: 'domcontentloaded' });
    await a.getByRole('button', { name: `Details zu ${numA} ansehen` }).waitFor({ timeout: 20000 });
    const rowAr = a.getByRole('row').filter({ hasText: numA });
    f.check((await rowAr.innerText()).includes(TRACK_A), 'nach Reload: Listenzeile zeigt Bestellung mit Sendungsnummer', (await rowAr.innerText()).replace(/\s+/g, ' '));
    await a.locator('#epo-search').fill(TRACK_A);
    await a.waitForTimeout(1500);
    const searchRows = await a.getByRole('row').filter({ hasText: /EPO-\d{6}/ }).allInnerTexts();
    f.check(searchRows.length === 1 && searchRows[0].includes(numA), 'Suche nach der Sendungsnummer findet genau diese Bestellung (Server-Suche)', `${searchRows.length} Treffer`);
    await f.shot(a, 'A_nach_reload_suche_sendungsnr');
    await a.getByRole('button', { name: `Details zu ${numA} ansehen` }).click();
    ddlg = a.getByRole('dialog', { name: `Bestellung ${numA}` });
    await ddlg.waitFor({ timeout: 10000 });
    f.check(await ddlg.locator('#epo-detail-tracking').inputValue() === TRACK_A, 'nach Reload: Feld Sendungsnummer enthaelt den gespeicherten Wert', await ddlg.locator('#epo-detail-tracking').inputValue());
    oA = await orderByNote(NOTE_A);
    const trackEntry = (oA.timeline || []).find((t) => t.status === 'tracking_updated');
    f.check(oA.trackingNumber === TRACK_A && trackEntry && trackEntry.description.includes(TRACK_A) && trackEntry.userId, 'DB: trackingNumber gespeichert + Verlaufseintrag "Sendungsnummer erfasst" mit Benutzer', `${oA.trackingNumber} / ${trackEntry?.description}`);

    // Wareneingang teilweise (2 von 5)
    await ddlg.getByRole('button', { name: 'Wareneingang buchen' }).click();
    let rdlg = a.getByRole('dialog', { name: `Wareneingang buchen – ${numA}` });
    await rdlg.waitFor({ timeout: 10000 });
    const rIn = rdlg.getByLabel(`Erhaltene Menge für ${PART_NAME}`);
    f.check(await rIn.inputValue() === '5' && /Offen: 5 von 5/.test(await rdlg.innerText()), 'Wareneingang-Dialog: offene Menge 5 vorbelegt');
    await rIn.fill('2');
    const rSave = rdlg.getByRole('button', { name: /Wareneingang speichern/ });
    f.check((await rSave.innerText()).includes('(2 Stück)'), 'Schaltflaeche nennt die Buchungsmenge "(2 Stück)"', (await rSave.innerText()).trim());
    await f.shot(a, 'A_wareneingang_teil_2');
    await rSave.click();
    await a.getByText('Wareneingang gebucht – Bestellung teilweise erhalten').first().waitFor({ timeout: 15000 });
    await a.waitForTimeout(800);
    f.check(/Teilweise erhalten/.test(await ddlg.innerText()), 'Detaildialog: Status "Teilweise erhalten"');
    oA = await orderByNote(NOTE_A);
    let stock = await partStock(partId);
    f.check(oA.status === 'partial' && oA.items[0].receivedQuantity === 2 && oA.items[0].status === 'partial' && stock === stock0 + 2, 'DB: receivedQuantity 2, Status partial, Lagerbestand +2', `${oA.status} rq=${oA.items[0].receivedQuantity} lager=${stock}`);
    await f.shot(a, 'A_teilweise_erhalten');

    // Mehrbuchung im Dialog: 4 bei 3 offen -> deutsche Feldmeldung, Speichern gesperrt, Enter bucht nicht
    await ddlg.getByRole('button', { name: 'Wareneingang buchen' }).click();
    rdlg = a.getByRole('dialog', { name: `Wareneingang buchen – ${numA}` });
    await rdlg.waitFor({ timeout: 10000 });
    f.check(await rdlg.getByLabel(`Erhaltene Menge für ${PART_NAME}`).inputValue() === '3', 'Rest 3 vorbelegt');
    await rdlg.getByLabel(`Erhaltene Menge für ${PART_NAME}`).fill('4');
    const overMsg = rdlg.getByText('Höchstens 3 Stück offen.');
    f.check(await overMsg.isVisible(), 'Mehrbuchung (4 bei 3 offen): klare deutsche Meldung "Höchstens 3 Stück offen."');
    f.check(await rdlg.getByRole('button', { name: /Wareneingang speichern/ }).isDisabled(), 'Mehrbuchung: "Wareneingang speichern" gesperrt');
    await rdlg.getByLabel(`Erhaltene Menge für ${PART_NAME}`).press('Enter');
    await a.waitForTimeout(1500);
    await f.shot(a, 'A_mehrbuchung_blockiert');
    oA = await orderByNote(NOTE_A);
    f.check(oA.items[0].receivedQuantity === 2 && await partStock(partId) === stock0 + 2, 'Mehrbuchung (auch per Enter) bucht nichts: DB bleibt bei 2 / Lager +2', `rq=${oA.items[0].receivedQuantity}`);

    // Server-Schutz ueber die UI: veralteter Dialog (Tab A) vs. paralleler Wareneingang (Tab B)
    await rdlg.getByLabel(`Erhaltene Menge für ${PART_NAME}`).fill('3');
    f.check(await rdlg.getByRole('button', { name: /Wareneingang speichern \(3 Stück\)/ }).isEnabled(), 'Tab A: 3 Stueck eingetragen, Speichern freigegeben (noch nicht geklickt)');
    a2 = await f.session('admin');
    await f.goto(a2, '/admin/epart-orders?tab=orders', 2500);
    await a2.getByRole('button', { name: `Details zu ${numA} ansehen` }).click();
    const d2 = a2.getByRole('dialog', { name: `Bestellung ${numA}` });
    await d2.waitFor({ timeout: 10000 });
    await d2.getByRole('button', { name: 'Wareneingang buchen' }).click();
    const r2 = a2.getByRole('dialog', { name: `Wareneingang buchen – ${numA}` });
    await r2.waitFor({ timeout: 10000 });
    await r2.getByLabel(`Erhaltene Menge für ${PART_NAME}`).fill('1');
    await r2.getByRole('button', { name: /Wareneingang speichern \(1 Stück\)/ }).click();
    await a2.getByText('Wareneingang gebucht – Bestellung teilweise erhalten').first().waitFor({ timeout: 15000 });
    f.note('   Tab B (zweite Admin-Sitzung, UI) hat parallel 1 Stueck gebucht');
    await f.shot(a2, 'A_tabB_parallel_1_stueck');
    await rdlg.getByRole('button', { name: /Wareneingang speichern \(3 Stück\)/ }).click();
    const srvMsg = a.getByText(`Für „${PART_NAME}“ sind nur noch 2 Stück offen.`);
    await srvMsg.first().waitFor({ timeout: 15000 }).catch(() => {});
    f.check(await srvMsg.count() > 0 && await srvMsg.first().isVisible() && await a.getByText('Wareneingang konnte nicht gebucht werden').count() > 0, 'veralteter Dialog: Server blockiert Mehrbuchung mit deutscher Meldung "… sind nur noch 2 Stück offen." (Toast)');
    const layer = await srvMsg.first().evaluate((el) => {
      const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { onTop: !!top && (el.contains(top) || top.contains(el)), topTag: top ? `${top.tagName.toLowerCase()}.${String(top.className).slice(0, 40)}` : null };
    });
    f.note(`   Beobachtung: Fehler-Toast liegt ${layer.onTop ? 'ueber' : 'UNTER'} der Dialog-Abdunklung (oberstes Element an der Toast-Position: ${layer.topTag})`);
    await a.waitForTimeout(1200);
    f.check(await rdlg.getByText('Höchstens 2 Stück offen.').isVisible(), 'Dialog laedt den aktuellen Stand nach: Feldmeldung "Höchstens 2 Stück offen."');
    await f.shot(a, 'A_server_blockiert_mehrbuchung');
    oA = await orderByNote(NOTE_A);
    stock = await partStock(partId);
    f.check(oA.items[0].receivedQuantity === 3 && stock === stock0 + 3, 'DB: nur 2 (Tab A) + 1 (Tab B) = 3 gebucht, keine Mehrbuchung, Lager +3', `rq=${oA.items[0].receivedQuantity} lager=${stock}`);

    // Restmenge (2) buchen -> vollstaendig erhalten
    await rdlg.getByLabel(`Erhaltene Menge für ${PART_NAME}`).fill('2');
    await rdlg.getByRole('button', { name: /Wareneingang speichern \(2 Stück\)/ }).click();
    await a.getByText('Wareneingang gebucht – Bestellung vollständig erhalten').first().waitFor({ timeout: 15000 });
    await a.waitForTimeout(800);
    f.check(/Erhalten/.test(await ddlg.locator('[role="tabpanel"]').first().innerText()) && await ddlg.getByRole('button', { name: 'Wareneingang buchen' }).isDisabled()
      && await ddlg.getByText('Alle Positionen sind erhalten.').count() === 1, 'Restmenge gebucht: Status "Erhalten", "Wareneingang buchen" gesperrt mit Hinweis');
    oA = await orderByNote(NOTE_A);
    stock = await partStock(partId);
    f.check(oA.status === 'received' && oA.items[0].receivedQuantity === 5 && oA.items[0].status === 'received' && !!oA.receivedBy && stock === stock0 + 5, 'DB: Status received, 5/5 erhalten, receivedBy gesetzt, Lager +5', `${oA.status} rq=${oA.items[0].receivedQuantity} lager=${stock}`);
    await f.shot(a, 'A_vollstaendig_erhalten');
    // API-Gegenprobe (kein UI-Schritt): weitere Buchung nach "Erhalten" vom Server abgelehnt
    const extra = await api(adm, 'POST', `/api/epart-orders/${oA._id}/receive`, { items: [{ itemId: String(oA.items[0]._id), quantity: 1 }] });
    f.check(extra.status === 400 && /nur für Bestellungen mit Status/.test(extra.data?.error || ''), 'API-Gegenprobe: Buchung nach "Erhalten" -> 400 mit deutscher Meldung', `${extra.status} ${extra.data?.error || ''}`);
    f.check((await orderByNote(NOTE_A)).items[0].receivedQuantity === 5 && await partStock(partId) === stock0 + 5, 'nach abgelehnter Gegenprobe unveraendert 5 / Lager +5');

    // Reload: Positionen + Verlauf
    await a.reload({ waitUntil: 'domcontentloaded' });
    await a.getByRole('button', { name: `Details zu ${numA} ansehen` }).waitFor({ timeout: 20000 });
    await a.getByRole('button', { name: `Details zu ${numA} ansehen` }).click();
    ddlg = a.getByRole('dialog', { name: `Bestellung ${numA}` });
    await ddlg.waitFor({ timeout: 10000 });
    await ddlg.getByRole('tab', { name: /Positionen/ }).click();
    const itemRow = ddlg.getByRole('row').filter({ hasText: PART_NAME });
    const cells = (await itemRow.locator('td').allInnerTexts()).map((t) => t.trim());
    f.check(cells[2] === '5' && cells[3] === '5' && cells[4] === '0' && cells[10] === 'Erhalten', 'nach Reload: Positionen Bestellt 5 / Erhalten 5 / Offen 0 / Status Erhalten', cells.join(' | '));
    await f.shot(a, 'A_positionen_nach_reload');
    await ddlg.getByRole('tab', { name: 'Verlauf' }).click();
    await a.waitForTimeout(500);
    f.check(await ddlg.getByRole('tab', { name: 'Verlauf' }).getAttribute('aria-selected') === 'true', 'Tab "Verlauf" ist aktiv (aria-selected)');
    const tl =(await ddlg.locator('[role="tabpanel"]').filter({ hasText: /Wareneingang/ }).first().innerText()).replace(/\s+/g, ' ');
    const receipts = (tl.match(/Wareneingang gebucht:/g) || []).length;
    f.check(receipts === 3 && tl.includes(`Sendungsnummer erfasst: ${TRACK_A}`), 'Verlauf: 3 Wareneingaenge (2 + 1 + 2) und "Sendungsnummer erfasst" sichtbar', `${receipts} Wareneingaenge`);
    await f.shot(a, 'A_verlauf_nach_reload');
    await a.keyboard.press('Escape');

    // ================= Teil B: 778x718 =================
    f.note('--- Teil B: 778x718 ---');
    m = await f.session('admin', [778, 718]);
    await f.goto(m, '/admin/epart-orders?tab=orders', 3000);
    await m.getByRole('button', { name: 'Bestellung anlegen' }).waitFor({ timeout: 20000 });
    let hs = await hScroll(m);
    f.check(hs.sw <= hs.iw + 1 && hs.bw <= hs.iw + 1, '778x718 Bestellliste: kein horizontaler Seitenscroll', `${hs.sw}/${hs.bw}/${hs.iw}`);
    await f.shot(m, 'B_liste_778');
    await m.getByRole('button', { name: 'Bestellung anlegen' }).click();
    let bdlg = m.getByRole('dialog', { name: 'Bestellung anlegen' });
    await bdlg.waitFor({ timeout: 10000 });
    let geo = await dialogGeo(bdlg);
    f.check(geo.top >= 0 && geo.bottom <= geo.vh + 1 && geo.left >= 0 && geo.right <= geo.vw + 1, '778x718: Dialog "Bestellung anlegen" passt in den Viewport', JSON.stringify(geo));
    await pickOption(m, bdlg.locator('#epo-new-supplier'), new RegExp(`${SUPPLIER_NAME} – ${SUPPLIER_EMAIL.replace(/[.]/g, '\\.')}`));
    await fillOrderLine(m, bdlg, { qty: 3, price: '9,99' });
    await pickOption(m, bdlg.locator('#epo-new-status'), /^Bestellt$/);
    await bdlg.locator('#epo-new-notes').fill(NOTE_B);
    const createBtn = bdlg.getByRole('button', { name: 'Bestellung anlegen' });
    const cb = await inViewport(createBtn, 718);
    f.check(cb.ok, '778x718: "Bestellung anlegen" (Speichern) im Viewport erreichbar', JSON.stringify(cb.box));
    hs = await hScroll(m);
    f.check(hs.sw <= hs.iw + 1, '778x718: mit offenem Dialog kein horizontaler Seitenscroll', `${hs.sw}/${hs.iw}`);
    await f.shot(m, 'B_bestellung_dialog_778');
    await createBtn.click();
    const toastB = m.getByText(/^Bestellung EPO-\d+ angelegt$/).first();
    await toastB.waitFor({ timeout: 15000 });
    const numB = ((await toastB.innerText()).match(/EPO-\d+/) || [])[0];
    f.check(/^EPO-\d{6}$/.test(numB || '') && numB !== numA && Number(numB.slice(4)) > Number(numA.slice(4)), 'Bestellung B: Nummer EPO-NNNNNN, verschieden von A und fortlaufend hoeher', `${numA} -> ${numB}`);
    let oB = await orderByNote(NOTE_B);
    f.check(!!oB && oB.orderNumber === numB && oB.status === 'confirmed' && oB.items[0].quantity === 3 && Number(oB.items[0].unitPrice) === 9.99 && String(oB.supplierId) === String(supDb?._id), 'DB: Bestellung B gespeichert (3 × 9,99, confirmed, gleicher Lieferant)', oB ? `${oB.orderNumber} ${oB.status}` : 'fehlt');
    await m.waitForTimeout(800);

    // Sendungsnummer bei 778x718
    await m.getByRole('button', { name: `Details zu ${numB} ansehen` }).click();
    let mdlg = m.getByRole('dialog', { name: `Bestellung ${numB}` });
    await mdlg.waitFor({ timeout: 10000 });
    geo = await dialogGeo(mdlg);
    f.check(geo.top >= 0 && geo.bottom <= geo.vh + 1 && geo.right <= geo.vw + 1, '778x718: Detaildialog passt in den Viewport', JSON.stringify(geo));
    await mdlg.locator('#epo-detail-tracking').scrollIntoViewIfNeeded();
    await mdlg.locator('#epo-detail-tracking').fill(TRACK_B);
    const saveB = mdlg.getByRole('button', { name: 'Änderungen speichern' });
    const sbB = await inViewport(saveB, 718);
    f.check(sbB.ok, '778x718: "Änderungen speichern" im Viewport erreichbar', JSON.stringify(sbB.box));
    await f.shot(m, 'B_detail_sendungsnr_778');
    await saveB.click();
    await mdlg.getByText(/Gespeichert um \d{2}:\d{2}/).waitFor({ timeout: 15000 });
    hs = await hScroll(m);
    f.check(hs.sw <= hs.iw + 1, '778x718: Detaildialog ohne horizontalen Seitenscroll', `${hs.sw}/${hs.iw}`);
    await m.keyboard.press('Escape');
    await m.reload({ waitUntil: 'domcontentloaded' });
    await m.getByRole('button', { name: `Details zu ${numB} ansehen` }).waitFor({ timeout: 20000 });
    f.check((await m.getByRole('row').filter({ hasText: numB }).innerText()).includes(TRACK_B), '778x718 nach Reload: Zeile enthaelt die Sendungsnummer');
    await m.getByRole('button', { name: `Details zu ${numB} ansehen` }).click();
    mdlg = m.getByRole('dialog', { name: `Bestellung ${numB}` });
    await mdlg.waitFor({ timeout: 10000 });
    f.check(await mdlg.locator('#epo-detail-tracking').inputValue() === TRACK_B, '778x718 nach Reload: Sendungsnummer im Feld erhalten');
    oB = await orderByNote(NOTE_B);
    f.check(oB.trackingNumber === TRACK_B, 'DB: Sendungsnummer B gespeichert', oB.trackingNumber);

    // Wareneingang bei 778x718: 1 teilweise, Mehrbuchung 5 blockiert, Rest 2
    const recvBtnB = mdlg.getByRole('button', { name: 'Wareneingang buchen' });
    await recvBtnB.scrollIntoViewIfNeeded();
    await recvBtnB.click();
    let mr = m.getByRole('dialog', { name: `Wareneingang buchen – ${numB}` });
    await mr.waitFor({ timeout: 10000 });
    geo = await dialogGeo(mr);
    f.check(geo.top >= 0 && geo.bottom <= geo.vh + 1 && geo.right <= geo.vw + 1, '778x718: Wareneingang-Dialog passt in den Viewport', JSON.stringify(geo));
    await mr.getByLabel(`Erhaltene Menge für ${PART_NAME}`).fill('1');
    const mrSave = mr.getByRole('button', { name: /Wareneingang speichern \(1 Stück\)/ });
    const mrb = await inViewport(mrSave, 718);
    f.check(mrb.ok, '778x718: "Wareneingang speichern" im Viewport erreichbar', JSON.stringify(mrb.box));
    await mrSave.click();
    await m.getByText('Wareneingang gebucht – Bestellung teilweise erhalten').first().waitFor({ timeout: 15000 });
    await m.waitForTimeout(800);
    oB = await orderByNote(NOTE_B);
    f.check(oB.status === 'partial' && oB.items[0].receivedQuantity === 1, 'DB: Bestellung B teilweise erhalten (1/3)', `${oB.status} rq=${oB.items[0].receivedQuantity}`);
    await recvBtnB.click();
    mr = m.getByRole('dialog', { name: `Wareneingang buchen – ${numB}` });
    await mr.waitFor({ timeout: 10000 });
    await mr.getByLabel(`Erhaltene Menge für ${PART_NAME}`).fill('5');
    f.check(await mr.getByText('Höchstens 2 Stück offen.').isVisible() && await mr.getByRole('button', { name: /Wareneingang speichern/ }).isDisabled(), '778x718: Mehrbuchung (5 bei 2 offen) mit Meldung "Höchstens 2 Stück offen." blockiert');
    await f.shot(m, 'B_mehrbuchung_778');
    await mr.getByLabel(`Erhaltene Menge für ${PART_NAME}`).fill('2');
    await mr.getByRole('button', { name: /Wareneingang speichern \(2 Stück\)/ }).click();
    await m.getByText('Wareneingang gebucht – Bestellung vollständig erhalten').first().waitFor({ timeout: 15000 });
    await m.waitForTimeout(800);
    oB = await orderByNote(NOTE_B);
    stock = await partStock(partId);
    f.check(oB.status === 'received' && oB.items[0].receivedQuantity === 3 && stock === stock0 + 8, 'DB: Bestellung B vollstaendig erhalten (3/3), Lager gesamt +8 (5 + 3)', `${oB.status} rq=${oB.items[0].receivedQuantity} lager=${stock}`);
    await f.shot(m, 'B_erhalten_778');

    // ---------- Eindeutigkeit der Bestellnummer ----------
    const dupA = await db().collection('epartorders').countDocuments({ orderNumber: numA });
    const dupB = await db().collection('epartorders').countDocuments({ orderNumber: numB });
    const idx = (await db().collection('epartorders').indexes()).find((i) => i.key && i.key.orderNumber === 1);
    f.check(dupA === 1 && dupB === 1 && idx && idx.unique === true, 'DB: jede Bestellnummer genau einmal vorhanden, Unique-Index auf orderNumber', `${numA}:${dupA} ${numB}:${dupB} unique=${idx?.unique}`);
    // API-Gegenprobe (kein UI-Schritt): 4 gleichzeitige Anlagen -> 4 verschiedene Nummern (atomarer Zaehler)
    const par = await Promise.all([1, 2, 3, 4].map((i) => api(adm, 'POST', '/api/epart-orders', {
      supplierId: String(supDb._id), status: 'draft', items: [{ partId: String(partId), quantity: 1, unitPrice: 1 }], notes: `E2E K17 parallel ${stamp} #${i}`,
    })));
    const parNums = par.map((r) => r.data?.order?.orderNumber);
    const allNums = await db().collection('epartorders').find({ orderNumber: { $regex: '^EPO-' } }, { projection: { orderNumber: 1 } }).toArray();
    const distinct = new Set(allNums.map((o) => o.orderNumber));
    f.check(par.every((r) => r.status === 201 || r.status === 200) && parNums.every((n) => /^EPO-\d{6}$/.test(n || '')) && new Set(parNums).size === 4 && distinct.size === allNums.length,
      'API-Gegenprobe: 4 parallele Anlagen -> 4 verschiedene EPO-NNNNNN, keine Dublette in der DB', `${par.map((r) => r.status).join(',')} -> ${parNums.join(', ')} (DB ${allNums.length} Nummern, ${distinct.size} verschieden)`);
    f.note(`Testdaten: 4 Entwurfsbestellungen "E2E K17 parallel ${stamp} #1-4" per API (nur Nummern-Gegenprobe)`);
  } catch (e) {
    for (const p of [a, a2, m]) if (p) await f.shot(p, 'DEBUG_abbruch', true).catch(() => {});
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 4).join(' | ')}`);
  }
  try {
    const newMails = (fs.existsSync(MAILBOX) ? fs.readdirSync(MAILBOX) : []).filter((x) => !mailsBefore.has(x));
    const toSupplier = newMails.filter((x) => fs.readFileSync(path.join(MAILBOX, x), 'utf8').includes(SUPPLIER_EMAIL));
    f.note(`   neue .eml im Testpostfach waehrend des Laufs: ${newMails.length} (an den Testlieferanten: ${toSupplier.length})`);
  } catch (e) { /* ignore */ }
  const ngAfter = fs.existsSync(NETGUARD) ? fs.statSync(NETGUARD).size : 0;
  f.note(`   netguard_after.log: ${ngBefore} -> ${ngAfter} Bytes`);
  if (conn) await conn.close().catch(() => {});
  await f.finish();
})();
