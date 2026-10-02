// K14: Zahlungsverwaltung zeigt zu jeder Zahlung Buchung/Auftrag/Rechnung mit Link; Vorauszahlung ohne Rechnung ist als
// solche erkennbar; Kunde sieht dieselbe Zahlung im Auftrag ("Bezahlt" / "Offen" der Buchung).
const { makeFlow, apiLogin, api } = require('./flowlib');
const mongoose = require('/home/adar/Projects/FixitHub/server/node_modules/mongoose');

(async () => {
  const f = makeFlow('k14'); await f.start();
  let adm;
  try {
    const conn = await mongoose.createConnection('mongodb://127.0.0.1:27099/e2e_after').asPromise();
    const booking = await conn.collection('bookings').findOne({ bookingNumber: 'BKG-2026-0001' });
    const order = await conn.collection('orders').findOne({ bookingId: booking._id, deviceModel: 'iPad Pro 9.7' });
    await conn.close();
    const a = await apiLogin('admin');
    const ref = `E2E-UEB-${Date.now().toString().slice(-6)}`;
    const pay = await api(a, 'POST', `/api/bookings/${booking._id}/payments`, { amount: 50, paymentMethod: 'bank_transfer', paymentReference: ref, note: 'E2E Teilzahlung' });
    f.check(pay.status === 200 || pay.status === 201, 'Teilzahlung 50,00 € per Ueberweisung gebucht (Admin-API wie im Zahlungsdialog)', `${pay.status} ${pay.data?.error || ''}`);

    adm = await f.session('admin');
    await f.goto(adm, '/admin/financial', 3500);
    await adm.getByRole('tab', { name: 'Zahlungen' }).click();
    await adm.waitForTimeout(2500);
    const search = adm.getByPlaceholder(/such|Suche/i).first();
    if (await search.count()) { await search.fill(ref); await adm.waitForTimeout(2000); }
    await f.shot(adm, 'k14_zahlungen_liste', true);
    const txt = (await adm.locator('main').innerText()).replace(/\s+/g, ' ');
    f.check(txt.includes(ref), 'Suche nach Verwendungszweck findet die Zahlung, Verwendungszweck steht in der Zeile', ref);
    const ov = await adm.evaluate(() => Array.from(document.querySelectorAll('main *')).filter((el) => /(auto|scroll)/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 300).map((el) => el.clientWidth + '/' + el.scrollWidth));
    f.note('   horizontale Innen-Scrollbereiche Zahlungstabelle: ' + JSON.stringify(ov));
    f.check(/BKG-2026-0001/.test(txt), 'Zahlung zeigt die Buchungsnummer BKG-2026-0001');
    f.check(/Vorauszahlung|noch keiner Rechnung|nicht zugeordnet/i.test(txt), 'ohne Rechnung als Vorauszahlung / nicht zugeordnet erkennbar (nicht als Ueberzahlung)');
    const link = adm.getByRole('link', { name: /BKG-2026-0001/ }).or(adm.getByRole('button', { name: /BKG-2026-0001/ })).first();
    if (await link.count()) {
      await link.click(); await adm.waitForTimeout(2500);
      f.check(/bookings|orders/.test(adm.url()), 'Link oeffnet die Buchung/den Auftrag', adm.url());
      await f.shot(adm, 'k14_link_ziel');
    } else f.check(false, 'Buchungsnummer ist verlinkt');

    // Kundensicht: dieselbe Zahlung im Auftrag
    const cust = await f.session('customer');
    await f.goto(cust, `/orders/${order._id}`, 3500);
    const ct = (await cust.locator('main').innerText().catch(() => cust.locator('body').innerText())).replace(/\s+/g, ' ');
    const num = (re) => { const m = ct.match(re); return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : NaN; };
    const paid = num(/Bezahlt \(ganze Buchung\)\s*([\d.]+,\d{2})\s?€/);
    const open = num(/Offen \(ganze Buchung\)\s*([\d.]+,\d{2})\s?€/);
    const over = num(/Überzahlt · Erstattung (?:offen|läuft) \(ganze Buchung\)\s*([\d.]+,\d{2})\s?€/);
    f.check(paid >= 50, 'Kunde: "Bezahlt (ganze Buchung)" enthaelt die neue Zahlung', paid);
    const balanced = Number.isFinite(open) ? Math.abs(paid + open - 170.81) < 0.01 : Math.abs(paid - over - 170.81) < 0.01;
    f.check(balanced, 'Kunde: Bezahlt + Offen (bzw. Bezahlt − Überzahlt) = Buchungssumme 170,81 €', Number.isFinite(open) ? `${paid} + ${open}` : `${paid} − ${over} (Überzahlt)`);
    await f.shot(cust, 'k14_kunde_zahlungsstand');
  } catch (e) {
    if (adm) await f.shot(adm, 'DEBUG_admin', true).catch(() => {});
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 4).join(' | ')}`);
  }
  await f.finish();
})();
