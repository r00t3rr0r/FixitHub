// Zusatzablaeufe:
//  K03  Zentrales Postfach: mehr als 50 Gespraeche -> "Weitere laden" + Suche findet auch das aelteste.
//  K05  Reklamation: Versandlabel ueber die autorisierte Schaltflaeche herunterladen (PDF), Fremdkunde 403;
//       alte base64-Benachrichtigung zeigt keine Zeichenkette.
//  K12  Tastatur: Tab bis "Details ansehen", sichtbarer Fokus, Enter oeffnet das Geraet.
//  K13  Sprache Englisch: Betraege bleiben in Euro (keine $/CHF).
const fs = require('fs'); const path = require('path');
const { makeFlow, apiLogin, api } = require('./flowlib');
const mongoose = require('/home/adar/Projects/FixitHub/server/node_modules/mongoose');

(async () => {
  const f = makeFlow('extra'); await f.start();
  let adm; let cust;
  try {
    // ---------- K03 ----------
    adm = await f.session('admin');
    await f.goto(adm, '/messages', 3500);
    const rowsBefore = await adm.getByRole('button', { name: /^Auftrag\s*Auftrag ORD-/ }).count();
    const more = adm.getByRole('button', { name: /Weitere laden/ });
    f.check(await more.count() > 0, `"Weitere laden" vorhanden (erste Seite ${rowsBefore} Gespraeche)`);
    let clicks = 0;
    while (await more.count() && clicks < 5) { await more.first().click(); await adm.waitForTimeout(1800); clicks += 1; }
    const rowsAfter = await adm.getByRole('button', { name: /^Auftrag\s*Auftrag ORD-/ }).count();
    f.check(rowsAfter > 50, `nach "Weitere laden" mehr als 50 Gespraeche sichtbar (${rowsAfter})`);
    f.check(await adm.getByText('ORD-K03-001').count() > 0, 'aeltestes Gespraech ORD-K03-001 per Nachladen erreichbar');
    await f.goto(adm, '/messages', 3000);
    await adm.getByPlaceholder(/Auftrags-, Buchungs-/).fill('ORD-K03-001');
    await adm.waitForTimeout(2000);
    f.check(await adm.getByRole('button', { name: /Auftrag ORD-K03-001/ }).count() === 1, 'Suche findet das aelteste Gespraech direkt (serverseitig)');
    await f.shot(adm, 'k03_suche_aeltestes');

    // ---------- K05 ----------
    const conn = await mongoose.createConnection('mongodb://127.0.0.1:27099/e2e_after').asPromise();
    const partner = await conn.collection('users').findOne({ email: 'partner@e2e.invalid' });
    const complaint = await conn.collection('complaints').find({ customerId: partner._id }).sort({ _id: 1 }).limit(1).next();
    const pdf = `data:application/pdf;base64,${Buffer.from('%PDF-1.4\n% Testlabel Reklamation (E2E, kein echtes DHL-Label)\n').toString('base64')}`;
    await conn.collection('complaints').updateOne({ _id: complaint._id }, { $set: { status: 'approved', shippingLabelUrl: pdf, trackingNumber: 'DHL-DUMMY-REK-0001' } });
    await conn.close();
    f.note('   Testdaten: Reklamation auf "genehmigt" mit Test-PDF gesetzt (die echte Genehmigung wuerde ein DHL-Label anfordern - im Test gesperrt)');
    cust = await f.session('customer');
    await f.goto(cust, '/my-complaints', 3000);
    await cust.getByText(/Reklamation f(ue|ü)r Auftrag/).first().click();
    await cust.waitForTimeout(2000);
    const dl = cust.getByRole('button', { name: /Versandlabel herunterladen/ });
    f.check(await dl.count() > 0, 'Reklamation: Schaltflaeche "Versandlabel herunterladen" sichtbar');
    await f.shot(cust, 'k05_reklamation_label');
    const [download] = await Promise.all([cust.waitForEvent('download', { timeout: 15000 }), dl.first().click()]);
    const file = path.join(f.out, download.suggestedFilename());
    await download.saveAs(file);
    f.check(fs.readFileSync(file).slice(0, 5).toString() === '%PDF-', 'Download liefert das PDF ueber die autorisierte Route', download.suggestedFilename());
    const other = await apiLogin('other');
    const foreign = await api(other, 'GET', `/api/complaints/${complaint._id}/shipping-label`);
    f.check([403, 404].includes(foreign.status), 'fremder Kunde erhaelt das Label nicht', foreign.status);
    const anon = await api(null, 'GET', `/api/complaints/${complaint._id}/shipping-label`);
    f.check(anon.status === 401, 'ohne Anmeldung: 401', anon.status);
    await f.goto(cust, '/notifications', 3000);
    const notifText = await cust.locator('main').innerText().catch(() => cust.locator('body').innerText());
    f.check(!/base64,[A-Za-z0-9+/]{100,}/.test(notifText), 'alte Benachrichtigung mit eingebettetem PDF zeigt keine base64-Zeichenkette');
    f.check(!/notificationsPage\.|Subtitle|Suchen Placeholder|Filter Alle/.test(notifText), 'keine Uebersetzungsschluessel/Platzhalter auf der Benachrichtigungsseite');
    await f.shot(cust, 'k05_benachrichtigungen', true);

    // ---------- K12 Tastatur ----------
    await f.goto(cust, '/bookings', 3000);
    await cust.getByPlaceholder('Buchung, Auftrag oder Gerät suchen …').focus();
    let reached = false; let focusInfo = null;
    for (let i = 0; i < 25 && !reached; i += 1) {
      await cust.keyboard.press('Tab');
      focusInfo = await cust.evaluate(() => { const el = document.activeElement; const cs = el ? getComputedStyle(el) : null; return el ? { text: (el.textContent || '').trim().slice(0, 40), outline: cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px', ring: /rgb/.test(cs.boxShadow || '') } : null; });
      reached = /Details ansehen/.test(focusInfo?.text || '');
    }
    f.check(reached, 'Tab erreicht "Details ansehen"', JSON.stringify(focusInfo));
    f.check(!!focusInfo && (focusInfo.outline || focusInfo.ring), 'Fokus ist sichtbar (Outline/Ring)', JSON.stringify(focusInfo));
    await f.shot(cust, 'k12_tastaturfokus');
    await cust.keyboard.press('Enter');
    await cust.waitForURL(/\/orders\//, { timeout: 10000 }).catch(() => {});
    f.check(/\/orders\//.test(cust.url()), 'Enter oeffnet die Geraetedetails', cust.url());

    // ---------- K13 Sprache ----------
    await f.goto(cust, '/bookings', 3000);
    await cust.getByRole('button', { name: 'Sprache' }).click(); await cust.waitForTimeout(600);
    const en = cust.getByRole('menuitem', { name: /English|Englisch/i }).or(cust.getByRole('button', { name: /English|Englisch/i })).or(cust.getByText(/^English$/));
    if (await en.count()) { await en.first().click(); await cust.waitForTimeout(2000); }
    const enText = await cust.locator('body').innerText();
    f.check(/€/.test(enText) && !/\$\s?\d|CHF\s?\d|\d\s?CHF/.test(enText), 'Englische Oberflaeche: Betraege weiter in € (kein $/CHF)', (enText.match(/[\d.,]+\s?€/) || [''])[0]);
    await f.shot(cust, 'k13_englisch_euro');
    // zurueck auf Deutsch
    await cust.getByRole('button', { name: /Sprache|Language/ }).click().catch(() => {}); await cust.waitForTimeout(500);
    await cust.getByRole('menuitem', { name: /Deutsch|German/i }).or(cust.getByText(/^Deutsch$/)).first().click().catch(() => {});
  } catch (e) {
    if (adm) await f.shot(adm, 'DEBUG_admin', true).catch(() => {});
    if (cust) await f.shot(cust, 'DEBUG_kunde', true).catch(() => {});
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 4).join(' | ')}`);
  }
  await f.finish();
})();
