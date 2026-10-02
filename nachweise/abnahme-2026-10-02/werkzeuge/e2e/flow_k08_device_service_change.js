// K08 (Teil Geraet/Leistungen): Geraetewechsel (DeviceChangeDialog) und Leistungen hinzufuegen/aendern/entfernen
// ueber die Admin-Oberflaeche eines FRISCHEN eigenen Auftrags; neu berechneter Preis wird angezeigt und gespeichert;
// Tab "Verlauf" zeigt Akteur, Zeit, alt -> neu und Grund; Typfilter; Reload behaelt alles. Kundensicht: neues
// Geraet/neue Leistung, Kunden-Verlauf nur Positivliste (keine internen Details/Notizen). Auftrag == Buchung (DB).
//
// Testdaten (nur Vorbereitung/Nachpruefung, NICHT die geprueften Schritte):
//  - Katalog: Marke "K08 Testmarke", Modell "K08 Testphone", Services "K08 Diagnose" (59,80) und "K08 Akkutausch"
//    (89,80) - idempotent per Name angelegt (nur eigene Datensaetze, keine fremden veraendert).
//  - Auftrag: Kunde partner@e2e.invalid (5 % Rabatt) legt ueber Warenkorb + Checkout-API einen iPhone-15-Auftrag
//    mit "Diagnose E2E" (49,90 -> 47,40) an; Fehlerbeschreibung traegt eine eindeutige E2E-Markierung.
//  - interne Notiz (Admin-API) als Gegenprobe, dass der Kunde sie nicht sieht.
// Preise sind so gewaehlt, dass 5 % immer genau auf Cent aufgehen (keine Rundungsmehrdeutigkeit).
const fs = require('fs'); const path = require('path');
const { makeFlow, apiLogin, api, dumpControls, S } = require('./flowlib');
const SERVER = '/home/adar/Projects/FixitHub/server';
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const DB = 'mongodb://127.0.0.1:27099/e2e_after';
const MAILBOX = path.join(S, 'mailbox');
const NETGUARD = path.join(__dirname, 'netguard_after.log');
const RUN = Date.now().toString(36).toUpperCase();
const MARK = `E2E-K08DSC-${RUN}`;
const BRAND = 'K08 Testmarke';
const MODEL = 'K08 Testphone';
const SVC_DIAG = { name: 'K08 Diagnose', price: 59.8, category: 'diagnostic' };
const SVC_AKKU = { name: 'K08 Akkutausch', price: 89.8, category: 'battery' };
const AKKU_NEW_PRICE = 79.6;
const REASON_DEVICE = `Eingangsprüfung: anderes Modell als gebucht (${MARK})`;
const REASON_ADD = `Akku bei Diagnose aufgebläht (${MARK})`;
const REASON_EDIT = `Kulanzpreis nach Rücksprache (${MARK})`;
const REASON_REMOVE = `Diagnose entfällt, Akkutausch reicht (${MARK})`;
const INTERNAL_NOTE = `INTERN nur Team: Kunde wirkte unzufrieden (${MARK})`;

const cents = (v) => Math.round(Number(v) * 100);
// Auftragswert brutto nach 5 % Kundenrabatt (Listenpreise so gewaehlt, dass der Rabatt exakt ist)
const expectedGross = (...prices) => { const sum = prices.reduce((a, p) => a + cents(p), 0); return (sum - (sum * 5) / 100) / 100; };
const eur = (v) => `${Number(v).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || '').replace(/ /g, ' ').replace(/\s+/g, ' ');

async function withDb(fn) {
  const c = await mongoose.createConnection(DB).asPromise();
  try { return await fn(c.db); } finally { await c.close(); }
}
async function seedCatalog() {
  await mongoose.connect(DB);
  try {
    require(path.join(SERVER, 'models/Device.js'));
    require(path.join(SERVER, 'models/Service.js'));
    const DeviceBrand = mongoose.model('DeviceBrand'); const DeviceModel = mongoose.model('DeviceModel'); const Service = mongoose.model('Service');
    const brand = (await DeviceBrand.findOne({ name: BRAND })) || (await DeviceBrand.create({ name: BRAND, isActive: true }));
    const model = (await DeviceModel.findOne({ name: MODEL, brandId: brand._id })) || (await DeviceModel.create({ name: MODEL, brandId: brand._id, deviceType: 'smartphone', isActive: true }));
    const ids = {};
    for (const s of [SVC_DIAG, SVC_AKKU]) {
      const fields = { price: s.price, category: s.category, deviceType: 'Smartphone', manufacturer: BRAND, model: MODEL, isActive: true, estimatedTime: '45', description: `${s.name} (E2E-Testkatalog K08)` };
      let doc = await Service.findOne({ name: s.name });
      if (doc) { Object.assign(doc, fields); await doc.save(); } else doc = await Service.create({ name: s.name, ...fields });
      ids[s.name] = String(doc._id);
    }
    const diagE2E = await Service.findOne({ name: 'Diagnose E2E' }).lean();
    return { brandId: String(brand._id), modelId: String(model._id), ids, diagE2EId: diagE2E ? String(diagE2E._id) : null };
  } finally { await mongoose.disconnect(); }
}
async function dhlMode() {
  return withDb(async (db) => {
    const doc = await db.collection('systemconfigurations').findOne({});
    const dhl = (doc?.integrations || []).find((i) => i.provider === 'DHL' && i.type === 'shipping' && i.isActive !== false && !/returns/i.test(i.name || ''));
    return String(dhl?.settings?.bookingLabelMode || 'dummy').toLowerCase();
  });
}
async function orderState(id) {
  return withDb(async (db) => {
    const o = await db.collection('orders').findOne({ _id: new mongoose.Types.ObjectId(id) });
    const b = o?.bookingId ? await db.collection('bookings').findOne({ _id: o.bookingId }) : null;
    const siblings = b ? await db.collection('orders').countDocuments({ bookingId: b._id }) : 0;
    const svcIds = (o?.services || []).map((s) => s.serviceId).filter(Boolean);
    const svcDocs = svcIds.length ? await db.collection('services').find({ _id: { $in: svcIds } }).toArray() : [];
    const nameOf = (sid) => (svcDocs.find((d) => String(d._id) === String(sid)) || {}).name;
    return {
      order: o, booking: b, siblings,
      services: (o?.services || []).map((s) => ({ id: String(s._id), name: s.name || nameOf(s.serviceId) || '?', price: s.price })),
      timeline: o?.timeline || [],
    };
  });
}
const listMail = () => { try { return fs.readdirSync(MAILBOX).filter((f) => f.endsWith('.eml')); } catch (e) { return []; } };
const netguardSize = () => { try { return fs.statSync(NETGUARD).size; } catch (e) { return 0; } };

async function readGrossTotal(page) {
  const box = page.locator('.repair-info-subsection-pricing').first();
  await box.waitFor({ state: 'visible', timeout: 15000 });
  const txt = norm(await box.innerText());
  const m = txt.match(/Gesamtbetrag \(Brutto\)\s*([\d.]+,\d{2})\s*€/);
  return { text: txt, gross: m ? `${m[1]} €` : null };
}
async function servicesSectionText(page) {
  return norm(await page.locator('.repair-info-subsection-services').first().innerText());
}
async function waitForGross(page, expected, timeout = 15000) {
  const end = Date.now() + timeout; let last = null;
  while (Date.now() < end) {
    last = await readGrossTotal(page).catch(() => null);
    if (last && last.gross === eur(expected)) return last;
    await page.waitForTimeout(500);
  }
  return last;
}
function serviceRow(page, name) {
  return page.locator('.repair-info-subsection-services .service-list-item').filter({ has: page.locator('h4', { hasText: name }) }).first();
}

(async () => {
  const f = makeFlow('k08_device_service_change'); await f.start();
  let a; let c;
  const ng0 = netguardSize();
  const mail0 = new Set(listMail());
  try {
    // ---------------- Vorbereitung (API/DB) ----------------
    const cat = await seedCatalog();
    f.note(`Testdaten: Katalog (DB, idempotent) Marke "${BRAND}", Modell "${MODEL}" (smartphone), Services ${SVC_DIAG.name} ${eur(SVC_DIAG.price)} / ${SVC_AKKU.name} ${eur(SVC_AKKU.price)}`);
    if (!cat.diagE2EId) throw new Error('Service "Diagnose E2E" fehlt in e2e_after');
    for (let i = 0; i < 40; i += 1) { const m = await dhlMode(); if (m !== 'live') break; if (i === 0) f.note('   (DHL-Modus ist gerade "live" durch einen parallelen Ablauf - warte, damit kein externer Versuch entsteht)'); await sleep(3000); }
    const mode = await dhlMode();
    if (mode === 'live') throw new Error('DHL-Buchungslabel-Modus bleibt "live" - Checkout abgebrochen (kein externer Versuch)');
    f.note(`Testdaten: DHL-Buchungslabel-Modus vor dem Checkout = ${mode} (Dummy/Test, kein echtes Label)`);
    const cust = await apiLogin('customer');
    const cart0 = await api(cust, 'GET', '/api/cart');
    const cartItems = (cart0.data?.cart?.items || []).length + (cart0.data?.cart?.repairOrders || []).length;
    if (cartItems > 0) throw new Error(`Warenkorb von partner@e2e.invalid ist nicht leer (${cartItems}) - paralleler Ablauf, Abbruch statt fremde Positionen mitzubestellen`);
    const add = await api(cust, 'POST', '/api/cart/add-repair-order', { deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 15', services: [cat.diagE2EId], addOns: [], totalCost: 49.9, errorDescription: `Gerät startet nicht (${MARK})`, waterDamage: 'no', previousRepairAttempts: 'no', itemCondition: 'original', noLock: true });
    if (add.status >= 300) throw new Error(`Warenkorb: ${add.status} ${JSON.stringify(add.data).slice(0, 200)}`);
    const co = await api(cust, 'POST', '/api/checkout/complete', { paymentMethod: 'paypal' });
    if (co.status >= 300) throw new Error(`Checkout: ${co.status} ${JSON.stringify(co.data).slice(0, 200)}`);
    const orderIds = (co.data?.orderIds || []).map(String);
    if (orderIds.length !== 1) throw new Error(`Checkout erzeugte ${orderIds.length} Auftraege (erwartet 1)`);
    const ID = orderIds[0];
    let st = await orderState(ID);
    f.note(`Testdaten: Checkout-API (paypal ausstehend, keine Zahlung) -> Buchung ${co.data?.bookingNumber} / Auftrag ${st.order?.orderNumber} (${ID}), Markierung ${MARK}`);
    if (!String(st.order?.errorDescription || st.order?.issueDescription || JSON.stringify(st.order)).includes(MARK)) throw new Error('frischer Auftrag traegt die E2E-Markierung nicht');
    f.check(Math.abs(Number(st.order.totalCost) - 47.4) < 0.005 && st.siblings === 1, 'Ausgangslage: frischer Einzelauftrag 49,90 € - 5 % = 47,40 €', `${st.order.totalCost} / Auftraege in Buchung: ${st.siblings}`);
    const adm = await apiLogin('admin');
    const noteRes = await api(adm, 'POST', `/api/admin/orders/${ID}/notes`, { note: INTERNAL_NOTE, type: 'internal' });
    f.note(`Testdaten: interne Notiz per Admin-API angelegt (${noteRes.status})`);

    // ---------------- 1) Admin: Geraet aendern (DeviceChangeDialog) ----------------
    a = await f.session('admin');
    await f.goto(a, `/orders/${ID}`, 4000);
    await a.locator('#order-device-info').first().waitFor({ timeout: 20000 });
    const before = await readGrossTotal(a);
    f.check(before.gross === eur(47.4), 'Admin-Detail zeigt Ausgangspreis', before.gross);
    await f.shot(a, 'admin_detail_vorher', true);
    await a.locator('#order-device-info').getByRole('button', { name: 'Bearbeiten' }).click();
    const dd = a.getByRole('dialog').filter({ hasText: 'Gerät ändern' }).first();
    await dd.waitFor({ timeout: 10000 });
    f.check(norm(await dd.innerText()).includes('Apple iPhone 15'), 'Dialog "Gerät ändern" zeigt aktuelles Gerät Apple iPhone 15');
    await dd.locator('#device-search').click();
    await dd.locator('#device-search').pressSequentially('K08 Test', { delay: 40 });
    const resultBtn = dd.locator('button.order-device-change-result-item', { hasText: MODEL }).first();
    await resultBtn.waitFor({ timeout: 10000 });
    await resultBtn.click();
    const replBtn = dd.locator('button.order-device-change-option-item', { hasText: SVC_DIAG.name }).first();
    await replBtn.waitFor({ timeout: 10000 });
    await replBtn.click();
    await dd.getByRole('button', { name: 'Zuordnung hinzufügen / aktualisieren' }).click();
    await a.waitForTimeout(400);
    f.check(/1\/1 Zuordnungen vollständig/.test(norm(await dd.innerText())), 'Service-Zuordnung Diagnose E2E -> K08 Diagnose vollstaendig (1/1)');
    await dd.locator('#device-change-reason').fill(REASON_DEVICE);
    await f.shot(a, 'geraetewechsel_auswahl');
    await dd.getByRole('button', { name: 'Gegenrechnung und Servicepreise berechnen' }).click();
    await dd.getByRole('button', { name: 'Weiter zur Bestätigung' }).waitFor({ timeout: 20000 });
    const review = norm(await dd.innerText());
    f.check(new RegExp(`Auftragswert bisher \\(brutto\\):\\s*${eur(47.4).replace(/[.€]/g, '\\$&')}`).test(review)
      && new RegExp(`Auftragswert neu \\(brutto, nach Kundenrabatt\\):\\s*${eur(expectedGross(SVC_DIAG.price)).replace(/[.€]/g, '\\$&')}`).test(review),
      'Pruefschritt zeigt neu berechneten Auftragswert 47,40 € -> 56,81 €', review.match(/Auftragswert bisher[^D]*/)?.[0]?.slice(0, 160));
    await f.shot(a, 'geraetewechsel_pruefen');
    await dd.getByRole('button', { name: 'Weiter zur Bestätigung' }).click();
    await dd.getByRole('button', { name: 'Geräteänderung bestätigen' }).click();
    await dd.waitFor({ state: 'hidden', timeout: 20000 });
    const g1 = await waitForGross(a, expectedGross(SVC_DIAG.price));
    const devTxt = norm(await a.locator('#order-device-info').innerText());
    f.check(devTxt.includes(`${BRAND} ${MODEL}`), 'Geraetekarte zeigt neues Geraet', devTxt.slice(0, 120));
    f.check(g1?.gross === eur(expectedGross(SVC_DIAG.price)), 'Preisuebersicht zeigt neu berechneten Gesamtbetrag nach Geraetewechsel', g1?.gross);
    st = await orderState(ID);
    f.check(st.order.deviceBrand === BRAND && st.order.deviceModel === MODEL && st.services.length === 1 && st.services[0].name === SVC_DIAG.name
      && Math.abs(st.order.totalCost - expectedGross(SVC_DIAG.price)) < 0.005,
      'DB: Geraet, Position und Auftragswert gespeichert', `${st.order.deviceBrand} ${st.order.deviceModel} | ${st.services.map((s) => `${s.name}=${s.price}`).join(',')} | ${st.order.totalCost}`);
    await f.shot(a, 'nach_geraetewechsel', true);

    // ---------------- 2) Leistung hinzufuegen ----------------
    await a.locator('.repair-info-subsection-services').getByRole('button', { name: 'Dienst hinzufügen' }).click();
    const sd = a.getByRole('dialog').filter({ has: a.locator('#service-search') }).first();
    await sd.waitFor({ timeout: 10000 });
    await sd.locator('#service-search').click();
    await sd.locator('#service-search').pressSequentially('Akku', { delay: 40 });
    const sugg = sd.locator('button', { hasText: SVC_AKKU.name }).first();
    await sugg.waitFor({ timeout: 10000 });
    await sugg.click();
    await a.waitForTimeout(300);
    f.check(Number(await sd.locator('#price').inputValue()) === SVC_AKKU.price, 'Katalogpreis wird uebernommen (89,80)', await sd.locator('#price').inputValue());
    await sd.locator('#reason').fill(REASON_ADD);
    await f.shot(a, 'leistung_hinzufuegen_dialog');
    await sd.getByRole('button', { name: 'Reparaturservice hinzufügen' }).click();
    await sd.waitFor({ state: 'hidden', timeout: 20000 });
    const g2 = await waitForGross(a, expectedGross(SVC_DIAG.price, SVC_AKKU.price));
    f.check(g2?.gross === eur(expectedGross(SVC_DIAG.price, SVC_AKKU.price)) && (await servicesSectionText(a)).includes(SVC_AKKU.name),
      'Leistung hinzugefuegt: Liste + neuer Gesamtbetrag angezeigt', g2?.gross);

    // ---------------- 3) Leistung aendern (Preis) ----------------
    await serviceRow(a, SVC_AKKU.name).locator('.service-actions button').first().click();
    const ed = a.getByRole('dialog').filter({ has: a.locator('#price') }).first();
    await ed.waitFor({ timeout: 10000 });
    await ed.locator('#price').fill(String(AKKU_NEW_PRICE));
    await ed.locator('#reason').fill(REASON_EDIT);
    await f.shot(a, 'leistung_aendern_dialog');
    await ed.getByRole('button', { name: 'Service aktualisieren' }).click();
    await ed.waitFor({ state: 'hidden', timeout: 20000 });
    const g3 = await waitForGross(a, expectedGross(SVC_DIAG.price, AKKU_NEW_PRICE));
    f.check(g3?.gross === eur(expectedGross(SVC_DIAG.price, AKKU_NEW_PRICE)), 'Preis geaendert: neuer Gesamtbetrag angezeigt', g3?.gross);

    // ---------------- 4) Leistung entfernen ----------------
    await serviceRow(a, SVC_DIAG.name).getByTitle('Reparaturposition entfernen').click();
    const rd = a.getByRole('dialog').filter({ hasText: 'Reparaturposition entfernen?' }).first();
    await rd.waitFor({ timeout: 10000 });
    await rd.locator('#delete-service-reason').fill(REASON_REMOVE);
    await f.shot(a, 'leistung_entfernen_dialog');
    await rd.getByRole('button', { name: 'Position entfernen' }).click();
    await rd.waitFor({ state: 'hidden', timeout: 20000 });
    const g4 = await waitForGross(a, expectedGross(AKKU_NEW_PRICE));
    const svcTxt4 = await servicesSectionText(a);
    f.check(g4?.gross === eur(expectedGross(AKKU_NEW_PRICE)) && !svcTxt4.includes(SVC_DIAG.name) && svcTxt4.includes(SVC_AKKU.name),
      'Leistung entfernt: Liste + neuer Gesamtbetrag angezeigt', `${g4?.gross} | ${svcTxt4.slice(0, 160)}`);
    await f.shot(a, 'nach_leistungsaenderungen', true);

    // ---------------- 5) Reload: alles gespeichert ----------------
    await a.reload({ waitUntil: 'domcontentloaded' }); await a.waitForTimeout(4000);
    const g5 = await waitForGross(a, expectedGross(AKKU_NEW_PRICE));
    const svcTxt5 = await servicesSectionText(a);
    const devTxt5 = norm(await a.locator('#order-device-info').innerText());
    f.check(devTxt5.includes(`${BRAND} ${MODEL}`) && g5?.gross === eur(expectedGross(AKKU_NEW_PRICE)) && svcTxt5.includes(SVC_AKKU.name) && svcTxt5.includes(eur(AKKU_NEW_PRICE)) && !svcTxt5.includes(SVC_DIAG.name),
      'nach Reload: Geraet, Leistung (79,60 €) und Gesamtbetrag (75,62 €) unveraendert', `${g5?.gross} | ${svcTxt5.slice(0, 140)}`);
    st = await orderState(ID);
    const expTotal = expectedGross(AKKU_NEW_PRICE);
    f.check(st.services.length === 1 && st.services[0].name === SVC_AKKU.name && Math.abs(st.services[0].price - AKKU_NEW_PRICE) < 0.005 && Math.abs(st.order.totalCost - expTotal) < 0.005,
      'DB: genau eine Position K08 Akkutausch 79,60, Auftragswert 75,62', `${st.services.map((s) => `${s.name}=${s.price}`).join(',')} | ${st.order.totalCost}`);
    f.check(st.booking && Math.abs(Number(st.booking.totalCost) - Number(st.order.totalCost)) < 0.005
      && Math.abs(Number(st.booking.subtotal) - AKKU_NEW_PRICE) < 0.005 && Math.abs(Number(st.booking.discount) - (AKKU_NEW_PRICE - expTotal)) < 0.005,
      'DB: Buchungssumme = Auftragssumme (Zwischensumme 79,60 / Rabatt 3,98 / gesamt 75,62)', `booking total=${st.booking?.totalCost} subtotal=${st.booking?.subtotal} discount=${st.booking?.discount} | order=${st.order.totalCost}`);

    // ---------------- 6) Verlauf-Tab: Akteur, Zeit, alt -> neu, Grund; Filter; Reload ----------------
    await a.getByRole('tab', { name: /Verlauf/ }).click();
    await a.locator('.admin-od-history-list').waitFor({ timeout: 20000 });
    await a.waitForTimeout(800);
    await f.shot(a, 'verlauf_alle', true);
    const items = a.locator('.admin-od-history-item');
    const entryText = async (re) => { const n = await items.count(); for (let i = 0; i < n; i += 1) { const t = norm(await items.nth(i).innerText()); if (re.test(t)) return t; } return null; };
    const dateRe = /\d{2}\.\d{2}\.\d{4},? \d{2}:\d{2}/;
    const eDev = await entryText(new RegExp(`Gerät korrigiert.*Modell: iPhone 15 → ${MODEL}`));
    const admName = (eDev || '').match(/ von (.+?)(?:$| Änderungsbeleg| Rechnung| Zahlung)/)?.[1];
    f.check(!!eDev && dateRe.test(eDev) && /von \S+/.test(eDev) && eDev.includes(`Grund: ${REASON_DEVICE}`) && eDev.includes(`Marke: Apple → ${BRAND}`)
      && /Reparaturservice: Diagnose E2E \(49,90 €\) → K08 Diagnose \(59,80 €\)/.test(eDev) && /Auftragswert: 47,40 € → 56,81 €/.test(eDev),
      'Verlauf "Gerät korrigiert": Zeit, Akteur, Marke/Modell/Service alt -> neu, Auftragswert, Grund', (eDev || '').slice(0, 400));
    const eConf = await entryText(/Gerätewechsel bestätigt/);
    f.check(!!eConf && dateRe.test(eConf) && /von \S+/.test(eConf), 'Verlauf "Gerätewechsel bestätigt" mit Zeit und Akteur', (eConf || '').slice(0, 200));
    const eAdd = await entryText(new RegExp(`Grund: ${REASON_ADD.replace(/[()]/g, '\\$&')}`));
    f.check(!!eAdd && dateRe.test(eAdd) && /von \S+/.test(eAdd) && /Auftragswert: 56,81 € → 142,12 €/.test(eAdd) && eAdd.includes(SVC_AKKU.name),
      'Verlauf Leistung hinzugefuegt: Zeit, Akteur, Auftragswert alt -> neu, Grund', (eAdd || '').slice(0, 300));
    const eEdit = await entryText(new RegExp(`Grund: ${REASON_EDIT.replace(/[()]/g, '\\$&')}`));
    f.check(!!eEdit && dateRe.test(eEdit) && /von \S+/.test(eEdit) && /89,80 € → 79,60 €/.test(eEdit) && /Auftragswert: 142,12 € → 132,43 €/.test(eEdit),
      'Verlauf Preis geaendert: Preis 89,80 -> 79,60, Auftragswert, Grund', (eEdit || '').slice(0, 300));
    const eRem = await entryText(new RegExp(`Grund: ${REASON_REMOVE.replace(/[()]/g, '\\$&')}`));
    f.check(!!eRem && dateRe.test(eRem) && /von \S+/.test(eRem) && /Auftragswert: 132,43 € → 75,62 €/.test(eRem) && eRem.includes(SVC_DIAG.name),
      'Verlauf Leistung entfernt: Zeit, Akteur, Auftragswert alt -> neu, Grund', (eRem || '').slice(0, 300));
    f.note(`   Akteur laut Verlauf: ${admName || '?'}`);
    const allCount = await items.count();
    const hasOrderReceivedAll = !!(await entryText(/Auftrag (erhalten|eingegangen)|Buchung|Einsendelabel/));
    // Filter "Gerät & Leistungen"
    const chipDev = a.getByRole('group', { name: 'Verlauf filtern' }).getByRole('button', { name: /^Gerät & Leistungen/ });
    await chipDev.click(); await a.waitForTimeout(1500);
    await a.locator('.admin-od-history-list').waitFor({ timeout: 15000 });
    await f.shot(a, 'verlauf_filter_geraet_leistungen', true);
    const devItems = await items.allInnerTexts();
    const devTypes = await a.locator('.admin-od-history-item .admin-od-history-type').allInnerTexts();
    f.check((await chipDev.getAttribute('aria-pressed')) === 'true' && devItems.length >= 4 && devItems.length < allCount
      && devTypes.every((t) => /^(Gerät|Leistungen|Ersatzteile)$/.test(t.trim()))
      && devItems.some((t) => /Gerät korrigiert/.test(t)) && devItems.some((t) => t.includes(REASON_ADD)) && devItems.some((t) => t.includes(REASON_REMOVE)),
      'Filter "Gerät & Leistungen": nur Geraet/Leistungen, Geraetewechsel + hinzugefuegt + entfernt enthalten', `${devItems.length}/${allCount} Typen: ${[...new Set(devTypes)].join(',')}`);
    // Filter "Preise & Rabatte" (reine Preisaenderung einer Position)
    const chipPrice = a.getByRole('group', { name: 'Verlauf filtern' }).getByRole('button', { name: /^Preise & Rabatte/ });
    await chipPrice.click(); await a.waitForTimeout(1500);
    await f.shot(a, 'verlauf_filter_preise', true);
    const priceItems = await items.allInnerTexts();
    const priceTypes = await a.locator('.admin-od-history-item .admin-od-history-type').allInnerTexts();
    f.check(priceItems.length >= 1 && priceTypes.every((t) => t.trim() === 'Preise') && priceItems.some((t) => t.includes(REASON_EDIT)) && !priceItems.some((t) => /Gerät korrigiert/.test(t)),
      'Filter "Preise & Rabatte": nur Preis-Eintraege, Preisaenderung enthalten, kein Geraetewechsel', `${priceItems.length} Typen: ${[...new Set(priceTypes)].join(',')}`);
    // zurueck auf "Alle"
    await a.getByRole('group', { name: 'Verlauf filtern' }).getByRole('button', { name: /^Alle/ }).click(); await a.waitForTimeout(1500);
    f.check((await items.count()) === allCount, '"Alle" zeigt wieder saemtliche Eintraege', `${await items.count()}/${allCount}`);
    // Reload auf dem Verlauf-Tab (?bereich=verlauf)
    f.check(/bereich=verlauf/.test(a.url()), 'Verlauf-Tab steht in der URL', a.url().replace(/^https?:\/\/[^/]+/, ''));
    await a.reload({ waitUntil: 'domcontentloaded' }); await a.waitForTimeout(4000);
    await a.locator('.admin-od-history-list').waitFor({ timeout: 20000 });
    const afterReload = await items.allInnerTexts();
    f.check(afterReload.length === allCount && afterReload.some((t) => t.includes(REASON_DEVICE)) && afterReload.some((t) => t.includes(REASON_EDIT)) && afterReload.some((t) => t.includes(REASON_REMOVE)),
      'nach Reload: Verlauf-Tab offen, alle Eintraege inkl. Gruende vorhanden', `${afterReload.length}/${allCount}`);
    await f.shot(a, 'verlauf_nach_reload', true);
    f.note(`   (Gegenprobe Filter: ohne Filter ${allCount} Eintraege, davon Auftrag/Buchung/Label sichtbar: ${hasOrderReceivedAll})`);

    // ---------------- 7) Kundensicht ----------------
    c = await f.session('customer');
    await f.goto(c, `/orders/${ID}`, 4500);
    const custTxt = norm(await c.locator('main').first().innerText().catch(() => c.locator('body').innerText()));
    await f.shot(c, 'kunde_auftrag', true);
    f.check(custTxt.includes(MODEL) && custTxt.includes(BRAND), 'Kunde sieht neues Geraet', custTxt.match(new RegExp(`.{0,40}${MODEL}.{0,20}`))?.[0]);
    f.check(custTxt.includes(eur(expTotal)), 'Kunde sieht neuen Betrag 75,62 € (Auf einen Blick)');
    // Leistungen: Kunde oeffnet "Geplante Leistungen ansehen"
    await c.getByRole('button', { name: 'Geplante Leistungen ansehen' }).click();
    const sp = c.getByRole('dialog').last();
    await sp.waitFor({ timeout: 10000 });
    await c.waitForTimeout(800);
    const spTxt = norm(await sp.innerText());
    await f.shot(c, 'kunde_geplante_leistungen');
    f.check(spTxt.includes(SVC_AKKU.name) && !spTxt.includes(SVC_DIAG.name) && !spTxt.includes('Diagnose E2E'),
      'Kunde: "Geplante Leistungen" zeigt neue Leistung K08 Akkutausch, entfernte/alte nicht', spTxt.slice(0, 220));
    await c.keyboard.press('Escape'); await c.waitForTimeout(600);
    // Preisaufstellung aufklappen
    const priceToggle = c.getByRole('button', { name: /Preisaufstellung/ }).first();
    await priceToggle.click(); await c.waitForTimeout(1200);
    const priceCard = c.locator('.order-section-card', { has: c.getByText('Preisaufstellung', { exact: true }) }).first();
    const pcTxt = norm(await priceCard.innerText().catch(() => ''));
    await f.shot(c, 'kunde_preisaufstellung', true);
    f.check(pcTxt.includes(eur(AKKU_NEW_PRICE)) && pcTxt.includes(eur(expTotal)) && !pcTxt.includes(SVC_DIAG.name),
      'Kunde: Preisaufstellung 79,60 € Listenpreis -> 75,62 € gesamt, ohne entfernte Leistung', pcTxt.slice(0, 260));
    const pageLeaks = ['INTERN nur Team', REASON_DEVICE, REASON_ADD, REASON_EDIT, REASON_REMOVE].filter((s) => custTxt.includes(s));
    f.check(pageLeaks.length === 0, 'Kundenseite zeigt keine interne Notiz und keine internen Aenderungsgruende', pageLeaks.join(' | ') || 'keine');
    // Kunden-Verlauf aufklappen
    const histCard = c.locator('#order-customer-history');
    await histCard.scrollIntoViewIfNeeded();
    await histCard.getByRole('button').first().click();
    await c.waitForTimeout(2500);
    const histTxt = norm(await histCard.innerText());
    await f.shot(c, 'kunde_verlauf', true);
    const titles = (await histCard.locator('.customer-history-list li strong').allInnerTexts()).map((t) => t.trim());
    const ALLOWED = /^(Auftrag erhalten|Auftrag eingegangen|Buchung eingegangen|Status geändert|Versandlabel erstellt|DHL-Einsendelabel erstellt|DHL-Einsendelabel vorbereitet|Versandlabel an Kunden erstellt|Versandstatus.*|Sendung.*|Reparatur abgeschlossen|Abholung bestätigt)$/;
    f.check(titles.length > 0 && titles.every((t) => ALLOWED.test(t)), 'Kunden-Verlauf: nur Eintraege der Positivliste', titles.join(' | '));
    const leaks = [REASON_DEVICE, REASON_ADD, REASON_EDIT, REASON_REMOVE, 'INTERN nur Team', 'Gerät korrigiert', 'Gerätewechsel', 'Leistungen geändert', 'Auftragswert', 'Modellwechsel', 'Preis geändert', admName].filter(Boolean).filter((s) => histTxt.includes(s));
    f.check(leaks.length === 0, 'Kunden-Verlauf ohne interne Details (Gruende, Notiz, Akteur, alt->neu, Geraetekorrektur)', leaks.join(' | ') || 'keine');
    // API-Gegenprobe (Nachpruefung): Kundenprojektion ohne actor/reason/changes
    const ch = await api(cust, 'GET', `/api/orders/${ID}/history?limit=100`);
    const ents = ch.data?.entries || ch.data?.data?.entries || [];
    const raw = JSON.stringify(ch.data);
    f.check(ch.status === 200 && ents.length > 0 && !raw.includes(MARK) && !/"reason"\s*:\s*"[^"]/.test(raw) && !ents.some((e) => (e.changes || []).length) && !ents.some((e) => e.actor && e.actor.name && e.actor.name !== 'System'),
      'API-Gegenprobe Kunden-Verlauf: keine Gruende/Aenderungen/Akteure/Markierung', `${ch.status} ${ents.length} Eintraege`);
    const other = await apiLogin('other');
    const foreign = await api(other, 'GET', `/api/orders/${ID}/history`);
    f.check([403, 404].includes(foreign.status), 'fremder Kunde: kein Zugriff auf den Verlauf', foreign.status);

    // ---------------- 8) Seiteneffekte ----------------
    const newMail = listMail().filter((m) => !mail0.has(m));
    f.check(newMail.every((m) => /@e2e\.invalid\.eml$|@example\.com\.eml$/.test(m)), 'neue E-Mails nur an Testadressen', `${newMail.length}: ${newMail.map((m) => m.replace(/^\d+-\d+-/, '')).join(', ') || 'keine'}`);
  } catch (e) {
    if (a) await f.shot(a, 'DEBUG_abbruch_admin', true).catch(() => {});
    if (c) await f.shot(c, 'DEBUG_abbruch_kunde', true).catch(() => {});
    if (a) f.note(`   Kontrollen: ${(await dumpControls(a).catch(() => [])).slice(0, 60).join(' || ')}`);
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 4).join(' | ')}`);
  }
  const ng1 = netguardSize();
  f.check(ng1 === ng0, 'netguard_after.log unveraendert (kein externer Verbindungsversuch)', `${ng0} -> ${ng1} Bytes`);
  await f.finish();
})();
