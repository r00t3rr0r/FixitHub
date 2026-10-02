// FIN-13 (Runde 3) Anzeige: gespeicherter Steuersatz 0 bleibt 0 % auf der Auftragsseite (Kunde + Admin),
// fehlender Satz (ORD-K03-*, kein taxRate-Feld) -> "19 %, Standardsatz" mit unveraenderten Betraegen,
// normaler 19-%-Auftrag -> "19 %" ohne "Standardsatz". Dazu die Buchungsuebersicht (Admin, Buchungen).
// Vorbereitung per API/DB (protokolliert als "Testdaten"), geprueft wird die UI.
const fs = require('fs'); const path = require('path');
const { makeFlow, apiLogin, api } = require('./flowlib');
const mongoose = require('/home/adar/Projects/FixitHub/server/node_modules/mongoose');

const DB = 'mongodb://127.0.0.1:27099/e2e_after';
const NETGUARD = path.join(__dirname, 'netguard_after.log');
const RUN = `FIN13-${Date.now().toString(36).toUpperCase()}`;
const ngSize = () => (fs.existsSync(NETGUARD) ? fs.statSync(NETGUARD).size : 0);
const db = async (fn) => { const c = await mongoose.createConnection(DB).asPromise(); try { return await fn(c); } finally { await c.close(); } };
const oid = (s) => new mongoose.Types.ObjectId(String(s));
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const eur = (s) => (s == null ? NaN : Number(String(s).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')));
const fmt = (n) => `${Number(n).toFixed(2).replace('.', ',')} €`;
const AMT = '(-?[\\d.]+,\\d{2}) €';
const pick = (txt, label) => { const m = txt.match(new RegExp(`${label}\\s*${AMT}`)); return m ? eur(m[1]) : NaN; };
const rateLabel = (txt, prefix) => { const m = txt.match(new RegExp(`${prefix} \\(([^)]*)\\)`)); return m ? m[1] : null; };

// Liest eine Preisbox (Text) in {gross, net, tax, rate}
function parseBox(txt, kind) {
  if (kind === 'admin-grid') {
    return { gross: pick(txt, 'Gesamt \\(brutto\\) – dieser Auftrag'), net: pick(txt, 'Netto'), tax: pick(txt, 'MwSt\\. \\([^)]*\\)'), rate: rateLabel(txt, 'MwSt\\.') };
  }
  return { gross: pick(txt, 'Gesamtbetrag \\(Brutto\\)'), net: pick(txt, 'davon Netto'), tax: pick(txt, 'davon MwSt\\. \\([^)]*\\)'), rate: rateLabel(txt, 'davon MwSt\\.') };
}
const boxStr = (b) => `brutto ${b.gross} / netto ${b.net} / MwSt ${b.tax} (${b.rate})`;
const near = (a, b) => Math.abs(a - b) <= 0.005;

async function customerBoxes(f, page, orderId, tag) {
  await f.goto(page, `/orders/${orderId}`, 4500);
  const out = {};
  const glance = squash(await page.locator('.customer-money-grid').first().innerText().catch(() => ''));
  out.glanceGross = pick(glance, 'Gesamt \\(brutto\\)');
  const priceCard = page.locator('#order-customer-price');
  await priceCard.scrollIntoViewIfNeeded();
  const toggle = priceCard.locator('button.customer-section-toggle');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') { await toggle.click(); await page.waitForTimeout(700); }
  out.summary = parseBox(squash(await priceCard.innerText()), 'customer');
  await f.shot(page, `${tag}_kunde_preisaufstellung`);
  await priceCard.getByRole('button', { name: /Leistungen im Detail ansehen/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.waitFor({ timeout: 10000 });
  await page.waitForTimeout(800);
  const pb = dlg.locator('.repair-info-subsection-pricing');
  await pb.scrollIntoViewIfNeeded().catch(() => {});
  out.popup = parseBox(squash(await pb.innerText().catch(() => '')), 'customer');
  await f.shot(page, `${tag}_kunde_leistungen_popup`);
  out.dialogText = squash(await dlg.innerText());
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  out.pageText = squash(await page.locator('body').innerText());
  return out;
}
async function adminBoxes(f, page, orderId, tag) {
  await f.goto(page, `/orders/${orderId}`, 4500);
  const out = {};
  out.headerText = squash(await page.locator('body').innerText());
  out.headerGross = pick(out.headerText, 'Gesamt \\(brutto\\)');
  const pb = page.locator('.repair-info-subsection-pricing').first();
  await pb.waitFor({ timeout: 15000 });
  await pb.scrollIntoViewIfNeeded();
  out.overview = parseBox(squash(await pb.innerText()), 'customer');
  await f.shot(page, `${tag}_admin_uebersicht_preisuebersicht`);
  out.overviewText = squash(await page.locator('body').innerText());
  await page.getByRole('tab', { name: /Rechnungen/ }).click();
  await page.waitForTimeout(2500);
  const grid = page.locator('dl.admin-od-money-grid').first();
  await grid.waitFor({ timeout: 15000 });
  out.grid = parseBox(squash(await grid.innerText()), 'admin-grid');
  await f.shot(page, `${tag}_admin_rechnungen_zahlungsstand`);
  out.financeText = squash(await page.locator('body').innerText());
  return out;
}
const mwstMentions = (txt) => (txt.match(/MwSt\.? \([^)]*\)/g) || []).filter((v, i, a) => a.indexOf(v) === i);

(async () => {
  const f = makeFlow('r3_fin13_display'); await f.start();
  const ng0 = ngSize();
  let c; let a;
  try {
    // ---- Vorbereitung: frische Buchung des Kunden partner (Warenkorb + Checkout per API) -------------------
    const cust = await apiLogin('customer');
    const svc = await db(async (cn) => cn.collection('services').findOne({ name: 'Diagnose E2E', isActive: true }));
    const marker = `E2E ${RUN} Steuersatz 0`;
    let r = await api(cust, 'POST', '/api/cart/add-repair-order', { deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 15', services: [String(svc._id)], addOns: [], totalCost: 49.9, errorDescription: marker, waterDamage: 'no', previousRepairAttempts: 'no', itemCondition: 'original', noLock: true });
    f.note(`Testdaten: Warenkorb (Kunde partner@e2e.invalid, API) Reparatur "${marker}" -> ${r.status}`);
    r = await api(cust, 'POST', '/api/checkout/complete', { paymentMethod: 'paypal', checkoutAttemptId: `e2e-${RUN}` });
    const bookingId = String(r.data?.bookingId || r.data?.booking?._id || '');
    const bookingNumber = r.data?.bookingNumber || r.data?.booking?.bookingNumber;
    f.note(`Testdaten: Checkout (API, PayPal ausstehend, keine Zahlung) -> ${r.status} ${bookingNumber || ''}`);
    if (!bookingId) throw new Error(`Checkout lieferte keine Buchung (${r.status})`);
    const orders = await db(async (cn) => cn.collection('orders').find({ bookingId: oid(bookingId) }).toArray());
    f.check(orders.length === 1 && orders[0].errorDescription === marker, 'Testbuchung enthält genau den eigenen Auftrag', `${bookingNumber} orders=${orders.length}`);
    const order = orders[0];
    const orderId = String(order._id);
    const before = { taxRate: order.taxRate, totalCost: order.totalCost, netAmount: order.netAmount, taxAmount: order.taxAmount };
    const bookingBefore = await db(async (cn) => cn.collection('bookings').findOne({ _id: oid(bookingId) }, { projection: { subtotal: 1, discount: 1, tax: 1, totalCost: 1 } }));
    await db(async (cn) => cn.collection('orders').updateOne({ _id: oid(orderId) }, { $set: { taxRate: 0 } }));
    f.note(`Testdaten: Auftrag ${order.orderNumber} (${orderId}) taxRate ${before.taxRate} -> 0 direkt in e2e_after gesetzt (totalCost ${before.totalCost} unverändert; Buchung ${bookingNumber} tax=${bookingBefore?.tax} total=${bookingBefore?.totalCost} unverändert)`);
    const G = Number(before.totalCost);

    // ---- A) 0 % als Kunde ------------------------------------------------------------------------------
    c = await f.session('customer');
    const cz = await customerBoxes(f, c, orderId, 'A0');
    f.note(`   Kunde 0 %: Kopf brutto ${cz.glanceGross} | Preisaufstellung ${boxStr(cz.summary)} | Popup ${boxStr(cz.popup)}`);
    f.check(near(cz.glanceGross, G), 'Kunde 0 %: "Auf einen Blick" Gesamt (brutto) = Auftragswert', fmt(cz.glanceGross));
    for (const [name, b] of [['Preisaufstellung', cz.summary], ['Leistungen im Detail (Preisübersicht)', cz.popup]]) {
      f.check(b.rate === '0 %' && near(b.tax, 0), `Kunde 0 % – ${name}: "davon MwSt. (0 %)" mit 0,00 €`, boxStr(b));
      f.check(near(b.net, b.gross) && near(b.gross, G), `Kunde 0 % – ${name}: Netto = Brutto = ${fmt(G)}`, boxStr(b));
    }
    const czAll = `${cz.pageText} ${cz.dialogText}`;
    f.check(!/Standardsatz/.test(czAll) && mwstMentions(czAll).every((m) => /\(0 %\)/.test(m)), 'Kunde 0 %: auf der ganzen Seite nur "MwSt. (0 %)", kein 19 %/Standardsatz', mwstMentions(czAll).join(' | '));

    // ---- B) 0 % als Admin ------------------------------------------------------------------------------
    a = await f.session('admin');
    const az = await adminBoxes(f, a, orderId, 'B0');
    f.note(`   Admin 0 %: Kopf brutto ${az.headerGross} | Übersicht ${boxStr(az.overview)} | Zahlungsstand ${boxStr(az.grid)}`);
    f.check(near(az.headerGross, G), 'Admin 0 %: Kopf Gesamt (brutto) = Auftragswert', fmt(az.headerGross));
    f.check(az.overview.rate === '0 %' && near(az.overview.tax, 0) && near(az.overview.net, az.overview.gross) && near(az.overview.gross, G), 'Admin 0 % – Übersicht/Preisübersicht: MwSt. (0 %) 0,00 €, Netto = Brutto', boxStr(az.overview));
    f.check(az.grid.rate === '0 %' && near(az.grid.tax, 0) && near(az.grid.net, az.grid.gross) && near(az.grid.gross, G), 'Admin 0 % – Rechnungen & Zahlungen/Zahlungsstand: MwSt. (0 %) 0,00 €, Netto = Brutto', boxStr(az.grid));
    const azAll = `${az.overviewText} ${az.financeText}`;
    f.check(!/Standardsatz/.test(azAll) && mwstMentions(azAll).every((m) => /\(0 %\)/.test(m)), 'Admin 0 %: auf allen geöffneten Tabs nur "MwSt. (0 %)", kein 19 %/Standardsatz', mwstMentions(azAll).join(' | '));

    // ---- C) Buchungsübersicht (Admin -> Buchungen -> Dialog "Finanzen") --------------------------------
    const readBookingSummary = async (tag) => {
      await f.goto(a, `/admin/bookings?openBookingId=${bookingId}`, 5000);
      const dlg = a.getByRole('dialog').first();
      await dlg.waitFor({ timeout: 15000 });
      const fin = dlg.locator('h3', { hasText: /^Finanzen$/ }).first().locator('xpath=../..');
      await fin.scrollIntoViewIfNeeded().catch(() => {});
      await a.waitForTimeout(600);
      await f.shot(a, `${tag}_admin_buchung_finanzen`);
      return squash(await fin.innerText().catch(() => ''));
    };
    const bs1 = await readBookingSummary('C1');
    const b1 = await db(async (cn) => cn.collection('bookings').findOne({ _id: oid(bookingId) }, { projection: { tax: 1, totalCost: 1, subtotal: 1 } }));
    f.note(`   Buchungsübersicht VOR Abgleich (Buchung tax=${b1?.tax}): ${bs1.slice(0, 260)}`);
    // Abgleich ueber die echte Admin-Route (dieselbe Ableitung wie nach jeder Auftragsaenderung)
    const adm = await apiLogin('admin');
    const sync = await api(adm, 'POST', `/api/admin/financial/bookings/${bookingId}/sync`, { type: 'booking' });
    const b2 = await db(async (cn) => cn.collection('bookings').findOne({ _id: oid(bookingId) }, { projection: { tax: 1, totalCost: 1, subtotal: 1 } }));
    f.note(`Testdaten: Finanzabgleich der Buchung per Admin-API POST /api/admin/financial/bookings/:id/sync -> ${sync.status}; Buchung tax ${b1?.tax} -> ${b2?.tax}, totalCost ${b1?.totalCost} -> ${b2?.totalCost}`);
    f.check(sync.status === 200 && near(Number(b2?.tax), 0) && near(Number(b2?.totalCost), G), 'Buchungsabgleich übernimmt den gespeicherten Auftragssatz 0 % (Buchung MwSt. 0, Gesamt unverändert)', `tax=${b2?.tax} total=${b2?.totalCost}`);
    const bs2 = await readBookingSummary('C2');
    f.note(`   Buchungsübersicht NACH Abgleich: ${bs2.slice(0, 260)}`);
    const bsGross = pick(bs2, 'Gesamtbetrag \\(Brutto\\)');
    const bsTax = pick(bs2, 'davon MwSt\\. \\(im Gesamtbetrag enthalten\\)');
    f.check(near(bsGross, G) && (Number.isNaN(bsTax) || near(bsTax, 0)) && !/MwSt\. \(19/.test(bs2), 'Buchungsübersicht nach Abgleich: Gesamt = Auftragswert, keine MwSt. > 0', `brutto ${bsGross} MwSt ${Number.isNaN(bsTax) ? '(Zeile ausgeblendet, da 0)' : bsTax}`);

    // ---- D) ORD-K03-* (kein taxRate-Feld) als Admin -> "19 %, Standardsatz" ------------------------------
    const k03 = await db(async (cn) => cn.collection('orders').findOne({ orderNumber: 'ORD-K03-001' }, { projection: { taxRate: 1, totalCost: 1, dealerDiscountAmount: 1, customerId: 1 } }));
    f.check(k03 && !('taxRate' in k03), 'ORD-K03-001 hat kein taxRate-Feld (Altdaten)', k03 ? ('taxRate' in k03 ? k03.taxRate : 'kein Feld') : 'fehlt');
    const gK = Math.round((Number(k03.totalCost) - Number(k03.dealerDiscountAmount || 0)) * 100) / 100;
    const nK = Math.round((gK / 1.19) * 100) / 100; const tK = Math.round((gK - nK) * 100) / 100;
    const ak = await adminBoxes(f, a, String(k03._id), 'D19std');
    f.note(`   Admin ORD-K03-001: Übersicht ${boxStr(ak.overview)} | Zahlungsstand ${boxStr(ak.grid)} | erwartet ${fmt(gK)} / ${fmt(nK)} / ${fmt(tK)}`);
    for (const [name, b] of [['Übersicht/Preisübersicht', ak.overview], ['Zahlungsstand', ak.grid]]) {
      f.check(b.rate === '19 %, Standardsatz', `ORD-K03-001 – ${name}: Kennzeichnung "19 %, Standardsatz"`, b.rate);
      f.check(near(b.gross, gK) && near(b.net, nK) && near(b.tax, tK), `ORD-K03-001 – ${name}: Beträge unverändert (${fmt(gK)} = ${fmt(nK)} + ${fmt(tK)})`, boxStr(b));
    }
    const akAll = `${ak.overviewText} ${ak.financeText}`;
    f.check(mwstMentions(akAll).every((m) => /19 %, Standardsatz/.test(m)), 'ORD-K03-001: alle MwSt.-Angaben der Seite einheitlich "19 %, Standardsatz"', mwstMentions(akAll).join(' | '));

    // ---- E) normaler 19-%-Auftrag (gespeichert 19) -> "19 %" ohne Standardsatz ---------------------------
    const n19 = await db(async (cn) => cn.collection('orders').findOne({ taxRate: 19, customerId: order.customerId, status: { $ne: 'cancelled' }, _id: { $ne: oid(orderId) } }, { sort: { _id: -1 }, projection: { orderNumber: 1, totalCost: 1, dealerDiscountAmount: 1 } }));
    const g19 = Math.round((Number(n19.totalCost) - Number(n19.dealerDiscountAmount || 0)) * 100) / 100;
    const net19 = Math.round((g19 / 1.19) * 100) / 100; const tax19 = Math.round((g19 - net19) * 100) / 100;
    f.note(`   normaler Auftrag: ${n19.orderNumber} (taxRate 19 gespeichert), erwartet ${fmt(g19)} = ${fmt(net19)} + ${fmt(tax19)}`);
    const a19 = await adminBoxes(f, a, String(n19._id), 'E19');
    const c19 = await customerBoxes(f, c, String(n19._id), 'E19');
    f.note(`   ${n19.orderNumber}: Admin Übersicht ${boxStr(a19.overview)} | Admin Zahlungsstand ${boxStr(a19.grid)} | Kunde ${boxStr(c19.summary)} | Kunde Popup ${boxStr(c19.popup)}`);
    for (const [name, b] of [['Admin Übersicht', a19.overview], ['Admin Zahlungsstand', a19.grid], ['Kunde Preisaufstellung', c19.summary], ['Kunde Leistungen-Popup', c19.popup]]) {
      f.check(b.rate === '19 %' && near(b.gross, g19) && near(b.net, net19) && near(b.tax, tax19), `${n19.orderNumber} – ${name}: "19 %" ohne Standardsatz, Beträge ${fmt(g19)} = ${fmt(net19)} + ${fmt(tax19)}`, boxStr(b));
    }
    const all19 = `${a19.overviewText} ${a19.financeText} ${c19.pageText} ${c19.dialogText}`;
    f.check(!/Standardsatz/.test(all19), `${n19.orderNumber}: nirgends "Standardsatz"`, mwstMentions(all19).join(' | '));
  } catch (e) {
    if (a) await f.shot(a, 'DEBUG_admin', true).catch(() => {});
    if (c) await f.shot(c, 'DEBUG_kunde', true).catch(() => {});
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 3).join(' | ')}`);
  }
  f.check(ngSize() === ng0, 'netguard_after.log unverändert', `${ng0} -> ${ngSize()} B`);
  await f.finish();
})();
