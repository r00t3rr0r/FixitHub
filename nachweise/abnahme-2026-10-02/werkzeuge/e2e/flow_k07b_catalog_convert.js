// K07 (Mitglied + Katalog): Fragebogen Geraetetyp -> Marke -> Katalogmodell -> Anfrage; Admin sendet Kostenvoranschlag;
// Kunde nimmt in "Meine Reparaturanfragen" an; Admin wandelt in einen Auftrag um -> derselbe Geraetedatensatz (Katalog-ID)
// im Auftrag, Erstangabe bleibt erhalten, kein DHL-Label ohne ausdrueckliche Wahl.
const path = require('path');
const { makeFlow, apiLogin, api } = require('./flowlib');
const mongoose = require('/home/adar/Projects/FixitHub/server/node_modules/mongoose');
const stamp = Date.now().toString().slice(-6);

(async () => {
  const f = makeFlow('k07b_catalog_convert'); await f.start();
  let cust; let adm;
  try {
    cust = await f.session('customer');
    await f.goto(cust, '/repair-request', 3500);
    await cust.getByRole('button', { name: /^Smartphone/ }).first().click(); await cust.waitForTimeout(1200);
    f.check(await cust.getByRole('button', { name: /Mein Gerät ist nicht aufgeführt/ }).count() > 0, 'Option "Mein Gerät ist nicht aufgeführt" sichtbar (neben dem Katalog)');
    const selects = cust.locator('select');
    await selects.nth(0).selectOption({ label: 'Apple' }); await cust.waitForTimeout(1500);
    const n = await selects.count();
    const modelSel = cust.locator('select').filter({ has: cust.locator('option', { hasText: 'iPhone 15' }) }).first();
    if (await modelSel.count()) await modelSel.selectOption({ label: 'iPhone 15' });
    else await cust.getByRole('option', { name: /iPhone 15/ }).first().click();
    await cust.waitForTimeout(1000);
    f.note(`   Auswahlfelder: ${n}`);
    await f.shot(cust, 'fragebogen_katalog_gewaehlt');
    const desc = `E2E Katalog ${stamp}: Face ID funktioniert seit dem Sturz nicht mehr.`;
    await cust.locator('textarea').first().fill(desc);
    await cust.getByRole('button', { name: 'Reparaturanfrage absenden' }).click();
    await cust.waitForTimeout(4000);
    await f.shot(cust, 'anfrage_abgesendet', true);
    const a = await apiLogin('admin');
    const pageText = await cust.locator('body').innerText();
    const rrNo = (pageText.match(/RR-\d+-\d+/) || [])[0];
    const list = await api(a, 'GET', `/api/repair-requests?search=${encodeURIComponent(rrNo || '')}`);
    const rr = (list.data.requests || [])[0];
    f.check(!!rr, 'Anfrage im Admin gefunden', rr?.requestNumber);
    f.check(rr?.deviceSource === 'catalog' && !!rr?.deviceModelId, 'gespeichert als Katalog-Geraet mit Modell-ID (keine Freitext-Kopie)', `${rr?.deviceSource} ${rr?.deviceModelId}`);
    f.check(/iPhone 15/.test(JSON.stringify(rr?.reportedDevice || {})), 'Erstangabe (reportedDevice) gespeichert', JSON.stringify(rr?.reportedDevice || {}).slice(0, 120));

    // Admin: Kostenvoranschlag senden (UI)
    adm = await f.session('admin');
    await f.goto(adm, '/admin/repair-requests', 3000);
    await adm.getByLabel('Reparaturanfragen durchsuchen').fill(rr.requestNumber);
    await adm.waitForTimeout(1800);
    await adm.getByRole('button', { name: 'Öffnen' }).first().click(); await adm.waitForTimeout(2500);
    await adm.getByPlaceholder('z. B. 89,00').fill('0,00');
    await adm.getByPlaceholder(/z\. B\. Displaytausch/).fill('Kostenlose Kulanzprüfung der Face-ID-Einheit');
    await adm.getByRole('button', { name: 'Kostenvoranschlag an Kunden senden' }).click(); await adm.waitForTimeout(1200);
    const conf = adm.getByRole('alertdialog');
    if (await conf.count()) await conf.getByRole('button', { name: /senden|Bestätigen|Ja/i }).last().click();
    await adm.waitForTimeout(3000);
    await f.shot(adm, 'admin_0euro_angebot_gesendet');
    const afterSend = (await api(a, 'GET', `/api/repair-requests?search=${encodeURIComponent(rr.requestNumber)}`)).data.requests[0];
    f.check(afterSend?.quote && afterSend.quote.amount === 0 && !!afterSend.quote.publishedAt, '0,00 € ist ein gueltiger, veroeffentlichter Kostenvoranschlag', JSON.stringify(afterSend?.quote || {}).slice(0, 160));

    // Kunde: Benachrichtigung + Annahme in "Meine Reparaturanfragen"
    const custApi = await apiLogin('customer');
    const notes = await api(custApi, 'GET', '/api/notifications?limit=10');
    const nlist = notes.data.notifications || notes.data.data || [];
    const qn = nlist.find((n) => /Kostenvoranschlag/.test(`${n.title} ${n.message}`));
    f.check(!!qn, 'Kunde hat eine In-App-Benachrichtigung zum Kostenvoranschlag', qn ? `${qn.title} -> ${qn.actionUrl || qn.link || qn.data?.action?.url || ''}` : 'keine');
    await f.goto(cust, `/my-repair-requests?requestId=${rr._id}`, 3500);
    await f.shot(cust, 'kunde_angebot_sichtbar', true);
    const acc = cust.getByRole('button', { name: /annehmen/i }).first();
    f.check(await acc.count() > 0, 'Kunde: "Annehmen" im Anfragedetail');
    await acc.click(); await cust.waitForTimeout(1200);
    const c2 = cust.getByRole('alertdialog');
    if (await c2.count()) await c2.getByRole('button', { name: /annehmen|Bestätigen|Ja/i }).last().click();
    await cust.waitForTimeout(2500);
    f.check(await cust.getByText(/angenommen/i).count() > 0, 'Kunde sieht "angenommen"');

    // Admin: in Auftrag umwandeln (UI)
    await adm.reload({ waitUntil: 'domcontentloaded' }); await adm.waitForTimeout(3500);
    f.note(`   URL nach Reload: ${adm.url()} / Dialog offen: ${await adm.getByRole('dialog').count()}`);
    if (!(await adm.getByRole('dialog').count())) {
      await adm.getByLabel('Reparaturanfragen durchsuchen').fill(rr.requestNumber); await adm.waitForTimeout(1800);
      await adm.getByRole('button', { name: 'Öffnen' }).first().click(); await adm.waitForTimeout(2500);
    }
    await adm.getByRole('dialog').getByRole('button', { name: 'In Auftrag umwandeln' }).first().click(); await adm.waitForTimeout(2000);
    await f.shot(adm, 'admin_umwandeln_dialog', true);
    const dlg = adm.getByRole('dialog').last();
    const dlgText = await dlg.innerText().catch(() => '');
    f.note(`   Umwandeln-Dialog: ${dlgText.replace(/\s+/g, ' ').slice(0, 500)}`);
    const svcChoice = dlg.getByRole('checkbox').first();
    if (await svcChoice.count()) await svcChoice.click().catch(() => {});
    else await dlg.getByText('Diagnose E2E', { exact: true }).first().click();
    await adm.waitForTimeout(1000);
    const dlgAfter = (await dlg.innerText()).replace(/\s+/g, ' ');
    f.note(`   nach Leistungswahl: ${dlgAfter.slice(dlgAfter.indexOf('Ausgewählte'), dlgAfter.indexOf('Ausgewählte') + 300)}`);
    f.check(/Kostenvoranschlag/.test(dlgAfter) && /(Abweichung|Differenz|weicht)/i.test(dlgAfter), 'Dialog zeigt die Abweichung zum angenommenen Kostenvoranschlag', '');
    await f.shot(adm, 'admin_umwandeln_mit_leistung', true);
    const convBtn0 = dlg.getByRole('button', { name: /umwandeln|Auftrag (erstellen|anlegen)/i }).last();
    f.check(await convBtn0.isDisabled(), 'Umwandeln gesperrt, bis die Abweichung bestaetigt ist');
    await dlg.getByText(/Mir ist bewusst/).first().click();
    await adm.waitForTimeout(500);
    const conv = dlg.getByRole('button', { name: /umwandeln|Auftrag (erstellen|anlegen)/i }).last();
    await conv.click(); await adm.waitForTimeout(1200);
    const c3 = adm.getByRole('alertdialog');
    if (await c3.count()) { await f.shot(adm, 'admin_umwandeln_bestaetigen'); await c3.getByRole('button', { name: /umwandeln|Bestätigen|Ja|fortfahren/i }).last().click(); }
    await adm.waitForTimeout(4000);
    await f.shot(adm, 'admin_umgewandelt', true);
    const conn = await mongoose.createConnection('mongodb://127.0.0.1:27099/e2e_after').asPromise();
    const rrDoc = await conn.collection('repairrequests').findOne({ _id: new mongoose.Types.ObjectId(String(rr._id)) });
    const order = rrDoc?.convertedToOrderId ? await conn.collection('orders').findOne({ _id: rrDoc.convertedToOrderId }) : null;
    await conn.close();
    f.check(rrDoc?.status === 'converted' && !!order, 'Anfrage umgewandelt, Auftrag existiert', `${rrDoc?.status} ${order?.orderNumber}`);
    f.check(order && /iPhone 15/.test(order.deviceModel || '') && /Apple/i.test(order.deviceBrand || ''), 'Auftrag uebernimmt dasselbe Geraet', `${order?.deviceBrand} ${order?.deviceModel}`);
    f.check(order && (String(order.deviceModelId || order.catalogModelId || '') === String(rr.deviceModelId) || /iPhone 15/.test(JSON.stringify(order.reportedDevice || order.originalDevice || {}))), 'Katalog-ID / Erstangabe im Auftrag erhalten', JSON.stringify({ id: order?.deviceModelId, rep: order?.reportedDevice || order?.originalDevice }).slice(0, 200));
    f.check(order && !order.returnTrackingNumber && !order.trackingNumber, 'Umwandlung erzeugt KEIN DHL-Label ohne ausdrueckliche Wahl', `${order?.trackingNumber || '-'} / ${order?.returnTrackingNumber || '-'}`);
  } catch (e) {
    if (adm) await f.shot(adm, 'DEBUG_admin', true).catch(() => {});
    if (cust) await f.shot(cust, 'DEBUG_kunde', true).catch(() => {});
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 6).join(' | ')}`);
  }
  await f.finish();
})();
