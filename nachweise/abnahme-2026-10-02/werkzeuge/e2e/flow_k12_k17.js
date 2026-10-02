// K12: "Details ansehen" fuehrt mit EINEM Klick zum richtigen Geraet; Rueckkehr behaelt Suche/Filter.
//      Zahlungsuebersicht oben sichtbar; 390 px ohne horizontalen Seitenscroll.
// K17: Lieferant bei 778x718 anlegen (alle Felder + Speichern erreichbar), Liste zeigt ihn, Reload bestaetigt Speicherung.
const fs = require('fs');
const path = require('path');
const { makeFlow, apiLogin, api } = require('./flowlib');
const sc = JSON.parse(fs.readFileSync(path.join(__dirname, 'scenario.e2e_after.json'), 'utf8'));
const stamp = Date.now().toString().slice(-6);

(async () => {
  const f = makeFlow('k12_k17'); await f.start();
  try {
    // ---------- K12 Kunde ----------
    const cust = await f.session('customer');
    await f.goto(cust, '/bookings', 3000);
    const details = cust.getByRole('button', { name: /Details ansehen/ }).or(cust.getByRole('link', { name: /Details ansehen/ }));
    const custApiK12 = await apiLogin('customer');
    // Gleiche Seite wie die Oberflaeche (Standard 20 Buchungen je Seite, erste Seite) - die Test-DB waechst mit jedem Lauf.
    const bl = await api(custApiK12, 'GET', '/api/bookings?limit=20&skip=0');
    const bookingsList = bl.data?.bookings || bl.data?.data || [];
    const deviceTotal = bookingsList.reduce((n, b) => n + Math.max((b.items || []).length, (b.orderIds || b.orders || []).length), 0);
    f.check(await details.count() >= 2 && await details.count() === deviceTotal, 'Buchungsliste: je Geraet genau ein sichtbares "Details ansehen" (Anzahl = Geraete der Buchungen auf Seite 1 laut API)', `${await details.count()} Schaltflaechen / ${deviceTotal} Geraete (${bookingsList.length} Buchungen)`);
    await cust.getByPlaceholder('Buchung, Auftrag oder Gerät suchen …').fill('iPad');
    await cust.waitForTimeout(1500);
    await f.shot(cust, 'buchungen_suche_ipad');
    const ipadDetails = cust.getByRole('button', { name: /Details ansehen/ }).or(cust.getByRole('link', { name: /Details ansehen/ }));
    const ipadCount = await ipadDetails.count();
    f.note(`   nach Suche "iPad": ${ipadCount} Detail-Schaltflaechen`);
    // Klick auf das Detail des iPad (Geraet 2)
    const ipadRow = cust.getByText('Apple iPad Pro 9.7').first();
    f.check(await ipadRow.count() > 0, 'iPad-Zeile sichtbar');
    const clicksBefore = Date.now();
    await ipadDetails.last().click();
    await cust.waitForURL(/\/orders\//, { timeout: 15000 });
    await cust.waitForTimeout(2500);
    f.check(cust.url().includes(sc.orders[1].id), 'EIN Klick fuehrt zur Reparatur des iPad (richtige Auftrags-ID)', cust.url());
    f.check(await cust.getByText('Apple iPad Pro 9.7').count() > 0 && await cust.getByText(sc.orders[1].orderNumber).count() > 0, 'Detailkopf zeigt Geraet + Auftragsnummer');
    f.check(await cust.getByText(/Auf einen Blick/i).count() > 0, 'Zusammenfassung "Auf einen Blick" oben sichtbar');
    for (const [label, re] of [['Gesamt / Dieses Gerät (brutto)', /^(Gesamt|Dieses Gerät) \(brutto\)$/], ['Bezahlt', /^Bezahlt( \(ganze Buchung\))?$/], ['Offen', /^Offen( \(ganze Buchung\))?$/]]) {
      f.check(await cust.getByText(re).first().isVisible(), `Zahlungsuebersicht: "${label}" ohne Aufklappen sichtbar`);
    }
    f.check(await cust.getByText(/\(ganze Buchung\)$/).count() >= 2, 'Mehrgeraete-Buchung: Bezug "ganze Buchung" steht direkt an Bezahlt und Offen/Ueberzahlt');
    const nextStep = await cust.getByText(/Nächster Schritt/i).count();
    f.check(nextStep > 0, 'Ein hervorgehobener "Nächster Schritt" ist vorhanden');
    await f.shot(cust, 'detail_ipad_glance');
    await cust.goBack(); await cust.waitForTimeout(2500);
    const searchVal = await cust.getByPlaceholder('Buchung, Auftrag oder Gerät suchen …').inputValue().catch(() => '');
    f.check(searchVal === 'iPad', 'Zurueck zur Liste: Suchbegriff bleibt erhalten', searchVal);
    f.note(`   Klickpfad nachher: Buchungen -> "Details ansehen" (1 Klick); Dauer bis Detail ${Date.now() - clicksBefore} ms (inkl. Laden)`);

    // 390 px: kein horizontaler Seitenscroll, Hauptaktion ohne Scrollen? (messen)
    const mob = await f.session('customer', [390, 844]);
    await f.goto(mob, `/orders/${sc.orders[1].id}`, 3500);
    const m = await mob.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    f.check(m.sw <= m.iw + 1, '390 px Auftragsdetail: kein horizontaler Seitenscroll', `${m.sw}/${m.iw}`);
    await f.shot(mob, 'detail_390', false);
    await f.goto(mob, '/bookings', 3000);
    const mb = await mob.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    f.check(mb.sw <= mb.iw + 1, '390 px Buchungsliste: kein horizontaler Seitenscroll', `${mb.sw}/${mb.iw}`);
    await f.shot(mob, 'buchungen_390', false);

    // ---------- K17 Lieferant bei 778x718 ----------
    const adm = await f.session('admin', [778, 718]);
    await f.goto(adm, '/admin/epart-orders', 3000);
    await adm.getByRole('tab', { name: /Lieferanten/ }).click();
    await adm.waitForTimeout(1200);
    await adm.getByRole('button', { name: /Lieferant (hinzufügen|anlegen)|Neuer Lieferant/ }).first().click();
    await adm.waitForTimeout(1000);
    const dlg = adm.getByRole('dialog');
    f.check(await dlg.count() === 1, 'Dialog "Lieferant" geoeffnet');
    const geo = await dlg.evaluate((d) => { const r = d.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: innerHeight }; });
    f.check(geo.top >= 0 && geo.bottom <= geo.vh + 1, 'Dialog passt in den 718 px hohen Viewport', JSON.stringify(geo));
    await f.shot(adm, 'lieferant_dialog_778x718');
    const name = `E2E Lieferant ${stamp}`;
    const fields = await dlg.locator('input:visible, textarea:visible').evaluateAll((els) => els.map((e) => e.getAttribute('id') || e.getAttribute('name') || e.getAttribute('placeholder')));
    f.note(`   Felder: ${fields.join(', ')}`);
    const fillId = async (id, val) => { const l = dlg.locator(`#${id}`); if (await l.count()) { await l.scrollIntoViewIfNeeded(); await l.fill(val); return true; } return false; };
    f.check(await fillId('epo-supplier-name', name), 'Feld Name ausfuellbar');
    await fillId('epo-supplier-email', `lieferant${stamp}@e2e.invalid`);
    await fillId('epo-supplier-contactPerson', 'Frau Test');
    await fillId('epo-supplier-phone', '+49 30 4444444');
    await fillId('epo-supplier-street', 'Teilestraße 5');
    await fillId('epo-supplier-zipCode', '10117');
    await fillId('epo-supplier-city', 'Berlin');
    f.check(await fillId('epo-supplier-leadTime', '3'), 'letztes Feld (Lieferzeit) per Scroll im Dialog erreichbar');
    const save = dlg.getByRole('button', { name: 'Lieferant speichern' });
    await save.scrollIntoViewIfNeeded();
    const sb = await save.boundingBox();
    f.check(!!sb && sb.y >= 0 && sb.y + sb.height <= 718, 'Speichern-Schaltflaeche im Viewport erreichbar', JSON.stringify(sb));
    await f.shot(adm, 'lieferant_dialog_unten');
    await save.click();
    await adm.waitForTimeout(2500);
    f.check(await adm.getByText(name).count() > 0, 'neuer Lieferant erscheint in der Liste');
    await adm.reload({ waitUntil: 'domcontentloaded' }); await adm.waitForTimeout(3000);
    await adm.getByRole('tab', { name: /Lieferanten/ }).click().catch(() => {});
    await adm.waitForTimeout(1500);
    f.check(await adm.getByText(name).count() > 0, 'nach Reload weiterhin vorhanden (persistiert)');
    await f.shot(adm, 'lieferant_nach_reload');
    // Doppelter Lieferant wird abgelehnt (409), Eingaben bleiben erhalten
    const a = await apiLogin('admin');
    const dup = await api(a, 'POST', '/api/epart-orders/suppliers', { name, email: `lieferant${stamp}@e2e.invalid` });
    f.check(dup.status === 409, 'gleicher Name + E-Mail: 409 statt Duplikat', `${dup.status} ${dup.data?.error || dup.data?.message || ''}`);
    // 200 % Zoom-Aequivalent: 683x359 CSS-Pixel
    const zoom = await f.session('admin', [683, 384]);
    await f.goto(zoom, '/admin/epart-orders', 3000);
    await zoom.getByRole('tab', { name: /Lieferanten/ }).click();
    await zoom.getByRole('button', { name: /Lieferant (hinzufügen|anlegen)|Neuer Lieferant/ }).first().click();
    await zoom.waitForTimeout(1000);
    const zsave = zoom.getByRole('dialog').getByRole('button', { name: 'Lieferant speichern' });
    await zsave.scrollIntoViewIfNeeded();
    const zb = await zsave.boundingBox();
    f.check(!!zb && zb.y + zb.height <= 384, '200 % Zoom (683x384): Speichern per Scroll erreichbar', JSON.stringify(zb));
    await f.shot(zoom, 'lieferant_200prozent');
  } catch (e) {
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n')[0]}`);
  }
  await f.finish();
})();
