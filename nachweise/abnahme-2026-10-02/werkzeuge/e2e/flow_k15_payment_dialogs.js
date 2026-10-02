// K15: Zahlungsaufforderung und "Rechnung aus Auftraegen erstellen" im echten Browser als Admin.
//  - Eigene, frische Buchungen (A, B) fuer partner@e2e.invalid ueber Warenkorb + Checkout-API (Testdaten).
//  - Zahlungsaufforderung aus der Finanzverwaltung (Karte "Zahlungsaufforderung senden", Buchungsziel):
//    Bestaetigungsdialog (Empfaenger, Betrag, Bezug, bisherige Aufforderungen) -> genau EINE Mail.
//    Verlauf im Dialog, nach Reload unveraendert. Zweiter Versuch innerhalb 24 h -> "Zuletzt am …",
//    "Trotzdem erneut senden" nur als ausdrueckliche Wahl. Doppelklick (zwei Klicks im selben Takt) auf
//    "Trotzdem erneut senden" -> genau EINE weitere Mail.
//  - Verlauf auch im Zahlungen-Dialog der Buchungszeile (/admin/bookings).
//  - "Rechnung aus Auftraegen erstellen": Vorschau/Umfang, nicht abgeschlossene Auftraege nur mit
//    Bestaetigung, Doppelklick -> genau EINE Rechnung + EINE Rechnungsmail; zweiter Lauf -> "Bereits
//    berechnet", keine zweite Rechnung (DB: invoices / activeBillingKeys / repairOrderIds).
//  - Zahlungsaufforderung aus der Rechnungszeile: Dialog mit Rechnungsbezug und Verlauf; 24-h-Regel.
// API/DB nur fuer Vorbereitung und Nachpruefung (als "Testdaten:" bzw. "Nachpruefung" protokolliert).
const fs = require('fs');
const path = require('path');
const { makeFlow, apiLogin, api, S } = require('./flowlib');
const mongoose = require('/home/adar/Projects/FixitHub/server/node_modules/mongoose');

const DB_URI = 'mongodb://127.0.0.1:27099/e2e_after';
const MAILBOX = path.join(S, 'mailbox');
const NETGUARD = path.join(S, 'e2e', 'netguard_after.log');
const CUSTOMER_EMAIL = 'partner@e2e.invalid';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
const eur = (n) => `${Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- Postfach (.eml) ----------
const netguardLines = () => (fs.existsSync(NETGUARD) ? fs.readFileSync(NETGUARD, 'utf8').split('\n').filter(Boolean).length : 0);
const mailSnapshot = () => new Set(fs.readdirSync(MAILBOX).filter((x) => x.endsWith('.eml')));
function decodeQP(input) {
  const s = String(input).replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === '=' && /^[0-9A-F]{2}$/i.test(s.substr(i + 1, 2))) { bytes.push(parseInt(s.substr(i + 1, 2), 16)); i += 2; } else bytes.push(...Buffer.from(s[i], 'utf8'));
  }
  return Buffer.from(bytes).toString('utf8');
}
const decodeWords = (h) => String(h).replace(/=\?([^?]+)\?([QB])\?([^?]*)\?=/gi, (m, cs, enc, txt) => (enc.toUpperCase() === 'B' ? Buffer.from(txt, 'base64').toString('utf8') : decodeQP(txt.replace(/_/g, ' '))));
function readMail(file) {
  const raw = fs.readFileSync(path.join(MAILBOX, file), 'utf8');
  const head = raw.split(/\r?\n\r?\n/)[0].replace(/\r?\n[ \t]+/g, ' ');
  const hdr = (name) => { const m = head.match(new RegExp(`^${name}:\\s*(.*)$`, 'mi')); return m ? decodeWords(m[1].trim()) : ''; };
  let text = '';
  for (const part of raw.split(/\r?\n--[^\r\n]+\r?\n/)) {
    const idx = part.search(/\r?\n\r?\n/);
    if (idx < 0) continue;
    const ph = part.slice(0, idx); const pb = part.slice(idx).trim();
    if (!/Content-Type:\s*text\//i.test(ph)) continue;
    if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(ph)) text += `${decodeQP(pb)}\n`;
    else if (/Content-Transfer-Encoding:\s*base64/i.test(ph)) text += `${Buffer.from(pb.replace(/\s+/g, ''), 'base64').toString('utf8')}\n`;
    else text += `${pb}\n`;
  }
  const to = hdr('To');
  return { file, to, recipients: to.match(/[^\s<>,"]+@[^\s<>,"]+/g) || [], subject: hdr('Subject'), text: `${hdr('Subject')}\n${text}`, hasPdf: /application\/pdf/i.test(raw) };
}
const newMails = (before) => [...mailSnapshot()].filter((x) => !before.has(x)).sort().map(readMail);
async function settleMails(before, match, { min = 0, timeoutMs = 25000, settleMs = 3500 } = {}) {
  const t0 = Date.now();
  while (newMails(before).filter(match).length < min && Date.now() - t0 < timeoutMs) await sleep(500);
  await sleep(settleMs); // Nachlauf: verspaetete Doppel-Mails wuerden hier noch auftauchen
  return newMails(before).filter(match);
}
const onlyTestRecipients = (mails) => mails.every((m) => m.recipients.length > 0 && m.recipients.every((r) => /@e2e\.invalid$/i.test(r)));

// ---------- Testdaten ----------
async function createOwnBooking(f, db, cust, tag, label) {
  const svc = await db.collection('services').findOne({ name: 'Diagnose E2E', isActive: true });
  if (!svc) throw new Error('Testservice "Diagnose E2E" fehlt');
  // Warenkorb muss leer sein, sonst landete ein fremder Eintrag in der eigenen Buchung.
  for (let i = 0; i < 10; i += 1) {
    const cart = await api(cust, 'GET', '/api/cart');
    const c = cart.data?.cart || cart.data?.data || cart.data || {};
    const n = (c.items || []).length + (c.repairOrders || []).length;
    if (n === 0) break;
    if (i === 9) throw new Error(`Warenkorb von ${CUSTOMER_EMAIL} ist nicht leer (${n}) - anderer Ablauf aktiv?`);
    await sleep(3000);
  }
  const desc = `${tag} ${label}: Akku entlädt sich schnell`;
  const add = await api(cust, 'POST', '/api/cart/add-repair-order', { deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 15', services: [String(svc._id)], addOns: [], totalCost: 49.9, errorDescription: desc, waterDamage: 'no', previousRepairAttempts: 'no', itemCondition: 'original', noLock: true });
  if (![200, 201].includes(add.status)) throw new Error(`Warenkorb ${label}: ${add.status} ${JSON.stringify(add.data).slice(0, 200)}`);
  const co = await api(cust, 'POST', '/api/checkout/complete', { paymentMethod: 'paypal' });
  if (![200, 201].includes(co.status)) throw new Error(`Checkout ${label}: ${co.status} ${JSON.stringify(co.data).slice(0, 200)}`);
  const order = await db.collection('orders').findOne({ errorDescription: desc });
  if (!order?.bookingId) throw new Error(`Auftrag ${label} nicht gefunden`);
  const booking = await db.collection('bookings').findOne({ _id: order.bookingId });
  const inBooking = await db.collection('orders').countDocuments({ bookingId: booking._id });
  if (inBooking !== 1) throw new Error(`Buchung ${booking.bookingNumber} enthaelt ${inBooking} Auftraege statt 1`);
  f.note(`Testdaten: Buchung ${label} ${booking.bookingNumber} / Auftrag ${order.orderNumber} (iPhone 15, Diagnose E2E, Status ${order.status}, ${eur(order.totalCost)}) fuer ${CUSTOMER_EMAIL} per Warenkorb + Checkout-API (PayPal ausstehend, keine Zahlung)`);
  return { bookingId: String(booking._id), bookingNumber: booking.bookingNumber, orderId: String(order._id), orderNumber: order.orderNumber, total: Number(order.totalCost) };
}
const findSummary = (d) => d?.summary || d?.overview?.summary || d?.data?.summary || d?.data?.overview?.summary || null;

// ---------- UI-Helfer ----------
async function installRecorders(page, reqLog, respLog) {
  await page.addInitScript(() => {
    window.__toasts = [];
    const scan = () => document.querySelectorAll('li[role="status"], [role="status"]').forEach((el) => {
      const t = (el.innerText || '').trim();
      if (t && !window.__toasts.includes(t)) window.__toasts.push(t);
    });
    document.addEventListener('DOMContentLoaded', () => new MutationObserver(scan).observe(document.body, { childList: true, subtree: true, characterData: true }));
  });
  const watched = (u) => /\/payment-request(s)?(\/|$)|\/invoices\/from-repairs|\/invoices\/[^/]+\/send/.test(new URL(u).pathname);
  page.on('request', (r) => { if (r.method() === 'POST' && watched(r.url())) reqLog.push({ path: new URL(r.url()).pathname, body: r.postData() || '', at: Date.now() }); });
  page.on('response', async (r) => {
    if (r.request().method() !== 'POST' || !watched(r.url())) return;
    let body = ''; try { body = await r.text(); } catch (e) { /* ignore */ }
    respLog.push({ path: new URL(r.url()).pathname, status: r.status(), body, reqBody: r.request().postData() || '' });
  });
}
const toasts = (page) => page.evaluate(() => (window.__toasts || []).slice());
async function waitResponses(respLog, pred, count, timeoutMs = 60000) {
  const t0 = Date.now();
  while (respLog.filter(pred).length < count && Date.now() - t0 < timeoutMs) await sleep(300);
  return respLog.filter(pred);
}
const isPR = (e) => /\/payment-request$/.test(e.path);
// reqLog-Eintraege tragen den Request-Body in .body, respLog-Eintraege in .reqBody (.body = Antwort).
const isCreate = (e) => /\/invoices\/from-repairs$/.test(e.path) && !/"dryRun":true/.test(e.reqBody !== undefined ? e.reqBody : e.body);

async function paymentCardText(page) {
  return page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div')).filter((d) => d.innerText && d.innerText.includes('Gesendete Zahlungsaufforderungen') && d.innerText.includes('prüfen und senden'));
    els.sort((a, b) => a.innerText.length - b.innerText.length);
    return els[0] ? els[0].innerText : '';
  });
}
// Innerste Karte, die Titel "Zahlungsaufforderung senden" UND die Pruef-Schaltflaeche enthaelt
// (die Karte "Überzahlung" nutzt dasselbe Suchfeld).
const paymentCard = (page) => page.locator('div')
  .filter({ has: page.getByText('Zahlungsaufforderung senden', { exact: true }) })
  .filter({ has: page.getByRole('button', { name: /Zahlungsaufforderung prüfen und senden/ }) })
  .last();
async function selectBookingInPaymentCard(page, bookingNumber) {
  const input = paymentCard(page).getByPlaceholder(/Buchung, Rechnungsnr\./);
  await input.click();
  await input.fill(bookingNumber);
  const suggestion = paymentCard(page).locator('div.absolute.z-50 button', { hasText: bookingNumber }).first();
  await suggestion.waitFor({ state: 'visible', timeout: 20000 });
  await suggestion.click();
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    const t = norm(await paymentCardText(page));
    if (/Offen: [\d.,]+ €|Keine Restforderung/.test(t) && !/Prüfe Restforderung/.test(t) && /Übergeben|noch keine Zahlungsaufforderung/i.test(t)) break;
    await sleep(400);
  }
}
async function openPaymentRequestDialog(page) {
  await page.getByRole('button', { name: /Zahlungsaufforderung prüfen und senden/ }).click();
  const dialog = page.getByRole('dialog', { name: /Zahlungsaufforderung per E-Mail/ });
  await dialog.waitFor({ state: 'visible', timeout: 10000 });
  const t0 = Date.now();
  while (/Wird geladen/.test(await dialog.innerText()) && Date.now() - t0 < 15000) await sleep(300);
  return dialog;
}

(async () => {
  const f = makeFlow('k15_payment_dialogs');
  await f.start();
  const ngBefore = netguardLines();
  const reqLog = []; const respLog = [];
  let adm; let db;
  try {
    db = await mongoose.createConnection(DB_URI).asPromise();
    const prCol = db.collection('paymentrequests');
    const claimCol = db.collection('paymentrequestclaims');
    const tag = `E2E-K15-${Date.now().toString().slice(-7)}`;
    const cust = await apiLogin('customer');
    const admApi = await apiLogin('admin');

    // ===== 1. Testdaten: eigene Buchungen A (Zahlungsaufforderung + Rechnung) und B (nur Vorschau-Umfang)
    f.note('--- 1. Testdaten ---');
    const A = await createOwnBooking(f, db, cust, tag, 'A');
    const B = await createOwnBooking(f, db, cust, tag, 'B');
    const ov = await api(admApi, 'GET', `/api/bookings/${A.bookingId}/payments`);
    const openA = Number(findSummary(ov.data)?.openOrderBalance);
    f.note(`Testdaten: offener Betrag Buchung ${A.bookingNumber} laut Server (GET /api/bookings/:id/payments) = ${openA}`);
    f.check(Number.isFinite(openA) && openA > 0, 'Vorbedingung: eigene Buchung A hat einen offenen Betrag', eur(openA));
    await sleep(4000); // Checkout-Mails (Bestaetigung) abklingen lassen, bevor gezaehlt wird

    adm = await f.session('admin', [1440, 900]);
    await installRecorders(adm, reqLog, respLog);

    // ===== 2. Zahlungsaufforderung: Bestaetigungsdialog + Versand
    f.note('--- 2. Zahlungsaufforderung (Buchung) ---');
    await f.goto(adm, '/admin/financial', 3500);
    await adm.getByRole('tab', { name: 'Zahlungen' }).click();
    await adm.waitForTimeout(2000);
    await selectBookingInPaymentCard(adm, A.bookingNumber);
    let card = norm(await paymentCardText(adm));
    f.check(card.includes(`Offen: ${eur(openA)}`) && card.includes(CUSTOMER_EMAIL), 'Karte "Zahlungsaufforderung senden": Buchung gewaehlt, offener Betrag und Kunden-E-Mail sichtbar', card.slice(0, 260));
    let dialog = await openPaymentRequestDialog(adm);
    let dt = norm(await dialog.innerText());
    await f.shot(adm, 'zahlungsaufforderung_bestaetigung_erstversand');
    f.check(new RegExp(`Empfänger.*<${esc(CUSTOMER_EMAIL)}>`).test(dt), 'Bestaetigung zeigt den Empfaenger (Testkunde)', (dt.match(/Empfänger.{0,60}/) || [''])[0]);
    f.check(dt.includes(`Bezug Buchung ${A.bookingNumber}`), 'Bestaetigung zeigt den Bezug (eigene Buchung)', (dt.match(/Bezug.{0,40}/) || [''])[0]);
    f.check(dt.includes(`Offener Betrag ${eur(openA)}`), 'Bestaetigung zeigt den offenen Betrag laut Server', (dt.match(/Offener Betrag.{0,20}/) || [''])[0]);
    f.check(/Bisherige Aufforderungen\s*Noch keine Zahlungsaufforderung gesendet/.test(dt), 'Bestaetigung zeigt die bisherigen Aufforderungen (noch keine)');
    f.check(!/Trotzdem erneut senden/.test(dt) && /Jetzt per E-Mail senden/.test(dt), 'Erstversand: normale Senden-Schaltflaeche, keine "Trotzdem"-Option');

    let before = mailSnapshot();
    const r1p = adm.waitForResponse((r) => r.request().method() === 'POST' && /\/payment-request$/.test(new URL(r.url()).pathname), { timeout: 60000 });
    await dialog.getByRole('button', { name: 'Jetzt per E-Mail senden' }).click();
    const r1 = await r1p;
    const r1body = await r1.json().catch(() => ({}));
    f.check(r1.status() === 200 && r1body.success === true && r1body.status === 'accepted_by_provider', 'Versand: Server meldet "vom Mailserver angenommen"', `${r1.status()} ${r1body.status || r1body.code || ''}`);
    let mails = await settleMails(before, (m) => m.text.includes(A.bookingNumber) && /Zahlungsaufforderung/.test(m.text), { min: 1 });
    f.check(mails.length === 1, 'genau EINE neue Zahlungsaufforderungs-Mail fuer die eigene Buchung im Postfach', mails.map((m) => `${m.file} -> ${m.to}`).join(' | '));
    f.check(mails.length === 1 && mails[0].recipients.length === 1 && mails[0].recipients[0] === CUSTOMER_EMAIL, 'Mail ist an den Testkunden adressiert (nur Testadresse)', mails.map((m) => m.to).join(','));
    f.check(mails.length === 1 && mails[0].text.includes(eur(openA).replace(' €', '')), 'Mailtext nennt den angeforderten Betrag', eur(openA));
    const otherNew = newMails(before).filter((m) => m.text.includes(A.bookingNumber) && !/Zahlungsaufforderung/.test(m.text));
    f.note(`   weitere neue Mails zur Buchung ${A.bookingNumber} in diesem Zeitfenster: ${otherNew.length}; alle neuen Mails im Postfach (auch anderer Ablaeufe): ${newMails(before).length}`);
    let tl = (await toasts(adm)).map(norm);
    f.check(tl.some((t) => /übergeben/.test(t) && t.includes(CUSTOMER_EMAIL) && /Zustellung wird dadurch nicht garantiert|nicht garantiert/.test(t)), 'Rueckmeldung: "per E-Mail an … übergeben" (keine Zustellbehauptung)', tl.slice(-2).join(' || ').slice(0, 300));
    let prDocs = await prCol.find({ bookingId: new mongoose.Types.ObjectId(A.bookingId) }).toArray();
    f.check(prDocs.length === 1 && prDocs[0].status === 'accepted_by_provider' && prDocs[0].recipientEmail === CUSTOMER_EMAIL, 'Nachpruefung DB: genau 1 Zahlungsaufforderung (angenommen) fuer Buchung A', prDocs.map((d) => `${d.status}/${d.recipientEmail}/${d.amount}`).join(','));
    f.check(!(await claimCol.findOne({ _id: `booking:${A.bookingId}` })), 'Nachpruefung DB: atomarer Anspruch (paymentrequestclaims) nach dem Versand freigegeben');
    await adm.waitForTimeout(1500);
    card = norm(await paymentCardText(adm));
    f.check(/Gesendete Zahlungsaufforderungen.*Übergeben/.test(card) && card.includes(`An: ${CUSTOMER_EMAIL}`) && card.includes(eur(openA)), 'Verlauf in der Karte zeigt die gesendete Aufforderung (Betrag, Empfaenger, Übergeben)', card.slice(card.indexOf('Gesendete'), card.indexOf('Gesendete') + 220));
    await f.shot(adm, 'zahlungsaufforderung_gesendet_verlauf', true);

    // Reload: Verlauf kommt vom Server
    await adm.reload({ waitUntil: 'domcontentloaded' });
    await adm.waitForTimeout(3500);
    await adm.getByRole('tab', { name: 'Zahlungen' }).click();
    await adm.waitForTimeout(1500);
    await selectBookingInPaymentCard(adm, A.bookingNumber);
    dialog = await openPaymentRequestDialog(adm);
    dt = norm(await dialog.innerText());
    const histRe = new RegExp(`\\d{1,2}\\.\\d{1,2}\\.\\d{4}[^·]*· ${esc(eur(openA))} · an ${esc(CUSTOMER_EMAIL)}\\s*Übergeben`);
    f.check(histRe.test(dt), 'nach Reload: Dialog "Bisherige Aufforderungen" zeigt die Aufforderung (Datum, Betrag, Empfaenger, Übergeben)', (dt.match(/Bisherige Aufforderungen.{0,120}/) || [''])[0]);
    await f.shot(adm, 'nach_reload_dialog_mit_verlauf');

    // ===== 3. Zweiter Versuch innerhalb 24 h
    f.note('--- 3. Zweite Aufforderung innerhalb 24 h ---');
    before = mailSnapshot();
    const r2p = adm.waitForResponse((r) => r.request().method() === 'POST' && /\/payment-request$/.test(new URL(r.url()).pathname), { timeout: 60000 });
    await dialog.getByRole('button', { name: 'Jetzt per E-Mail senden' }).click();
    const r2 = await r2p;
    const r2body = await r2.json().catch(() => ({}));
    let r2req = {}; try { r2req = JSON.parse(r2.request().postData() || '{}'); } catch (e) { /* ignore */ }
    f.check(r2.status() === 409 && r2body.code === 'PAYMENT_REQUEST_RECENT', 'zweiter Versuch: Server lehnt mit Sperrfrist ab (409 PAYMENT_REQUEST_RECENT)', `${r2.status()} ${r2body.code || ''}`);
    f.check(r2req.force !== true, 'zweiter Versuch wurde OHNE force gesendet (keine stille Erzwingung)', JSON.stringify(r2req).slice(0, 120));
    await dialog.getByRole('alert').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    dt = norm(await dialog.innerText());
    const alertText = norm(await dialog.getByRole('alert').innerText().catch(() => ''));
    f.check(/^Zuletzt am \d{1,2}\.\d{1,2}\.\d{4}, \d{2}:\d{2}/.test(alertText) && alertText.includes(CUSTOMER_EMAIL) && /trotzdem erneut senden\?/.test(alertText), 'Dialog zeigt deutschen Sperrfrist-Hinweis "Zuletzt am … an … gesendet – trotzdem erneut senden?"', alertText);
    f.check(/Trotzdem erneut senden/.test(dt) && !/Jetzt per E-Mail senden/.test(dt) && /Abbrechen/.test(dt), '"Trotzdem erneut senden" nur als ausdrueckliche Wahl (neben "Abbrechen"), normale Senden-Schaltflaeche ersetzt');
    mails = await settleMails(before, (m) => m.text.includes(A.bookingNumber) && /Zahlungsaufforderung/.test(m.text));
    f.check(mails.length === 0, 'Sperrfrist: KEINE weitere Mail', mails.length);
    prDocs = await prCol.find({ bookingId: new mongoose.Types.ObjectId(A.bookingId) }).toArray();
    f.check(prDocs.length === 1, 'Nachpruefung DB: weiterhin genau 1 Aufforderung (abgelehnter Versuch legt nichts an)', prDocs.length);
    await f.shot(adm, 'sperrfrist_zuletzt_am_trotzdem_senden');

    // Doppelklick auf "Trotzdem erneut senden": zwei Klicks im selben JS-Takt (schneller als jeder Mensch,
    // die Schaltflaeche ist beim zweiten Klick noch nicht deaktiviert) -> genau EINE weitere Mail.
    before = mailSnapshot();
    const prBefore = reqLog.filter(isPR).length;
    const dispatched = await adm.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('[role="dialog"] button')).find((b) => /Trotzdem erneut senden/.test(b.textContent || ''));
      if (!btn) return 'fehlt';
      btn.click(); const disabledAfterFirst = btn.disabled; btn.click();
      return `geklickt (nach 1. Klick disabled=${disabledAfterFirst})`;
    });
    await sleep(800);
    const forceReqs = reqLog.filter(isPR).slice(prBefore);
    const forceResps = await waitResponses(respLog, isPR, prBefore + forceReqs.length);
    const lastResps = forceResps.slice(prBefore);
    f.note(`   Doppelklick "Trotzdem erneut senden": ${dispatched}; ${forceReqs.length} POST(s) an den Server, Antworten: ${lastResps.map((r) => `${r.status} ${(() => { try { const j = JSON.parse(r.body); return j.code || j.status; } catch (e) { return ''; } })()}`).join(', ')}`);
    f.check(forceReqs.length >= 1 && forceReqs.every((r) => /"force":true/.test(r.body)), 'Erzwingen erst nach ausdruecklichem Klick, Anfrage traegt force=true', forceReqs.map((r) => r.body.slice(0, 60)).join(' | '));
    mails = await settleMails(before, (m) => m.text.includes(A.bookingNumber) && /Zahlungsaufforderung/.test(m.text), { min: 1 });
    f.check(mails.length === 1, 'Doppelklick auf "Trotzdem erneut senden": genau EINE weitere Mail', mails.map((m) => `${m.file} -> ${m.to}`).join(' | '));
    f.check(onlyTestRecipients(mails) && mails.every((m) => m.recipients[0] === CUSTOMER_EMAIL), 'weitere Mail nur an den Testkunden', mails.map((m) => m.to).join(','));
    prDocs = await prCol.find({ bookingId: new mongoose.Types.ObjectId(A.bookingId) }).sort({ requestedAt: 1 }).toArray();
    f.check(prDocs.filter((d) => d.status === 'accepted_by_provider').length === 2 && prDocs.length === 2, 'Nachpruefung DB: genau 2 angenommene Aufforderungen fuer Buchung A (kein Doppelversand)', prDocs.map((d) => d.status).join(','));
    f.check(!(await claimCol.findOne({ _id: `booking:${A.bookingId}` })), 'Nachpruefung DB: Anspruch nach Doppelklick freigegeben (kein verwaister Eintrag)');
    tl = (await toasts(adm)).map(norm);
    f.note(`   Rueckmeldungen nach Doppelklick: ${tl.slice(-3).join(' || ').slice(0, 400)}`);
    await adm.waitForTimeout(1500);
    await f.shot(adm, 'nach_doppelklick_trotzdem_senden', true);
    card = norm(await paymentCardText(adm));
    f.check((card.match(/Übergeben/g) || []).length === 2, 'Verlauf in der Karte zeigt jetzt 2 Aufforderungen', (card.match(/Übergeben/g) || []).length);

    // Verlauf im Zahlungen-Dialog der Buchungszeile (frische Seite)
    f.note('--- Verlauf in der Buchungszeile (/admin/bookings → Zahlungen) ---');
    await f.goto(adm, '/admin/bookings', 4000);
    const bsearch = adm.getByPlaceholder(/Buchungs-ID, Auftragsnummer, Kundenname/);
    await bsearch.fill(A.bookingNumber);
    await adm.waitForTimeout(3000);
    const row = adm.locator('tr', { hasText: A.bookingNumber }).first();
    await row.waitFor({ state: 'visible', timeout: 20000 });
    await row.getByRole('button', { name: 'Weitere Aktionen' }).click();
    await adm.getByRole('menuitem', { name: 'Zahlungen', exact: true }).click();
    const payDlg = adm.getByRole('dialog', { name: new RegExp(`Zahlungen – Buchung ${esc(A.bookingNumber)}`) });
    await payDlg.waitFor({ state: 'visible', timeout: 15000 });
    const t0 = Date.now();
    while (!/Vom Mailserver angenommen|noch keine Zahlungsaufforderung|nicht verfügbar|konnten nicht geladen/.test(await payDlg.innerText()) && Date.now() - t0 < 15000) await sleep(400);
    const pdt = norm(await payDlg.innerText());
    const pdtHist = pdt.slice(pdt.indexOf('Zahlungsaufforderungen'));
    f.check((pdtHist.match(/Vom Mailserver angenommen/g) || []).length === 2 && pdtHist.includes(`<${CUSTOMER_EMAIL}>`), 'Buchungszeile → Zahlungen: Verlauf zeigt beide Aufforderungen (angenommen, an Testkunden)', pdtHist.slice(0, 260));
    await payDlg.getByText('Zahlungsaufforderungen', { exact: true }).scrollIntoViewIfNeeded().catch(() => {});
    await f.shot(adm, 'buchungszeile_zahlungen_verlauf');
    await payDlg.getByRole('button', { name: 'Schließen' }).last().click();
    await adm.waitForTimeout(800);

    // ===== 4. Rechnung aus Auftraegen erstellen
    f.note('--- 4. Rechnung aus Aufträgen erstellen ---');
    const invFilter = (oid) => ({ isCreditNote: { $ne: true }, status: { $nin: ['cancelled', 'credited'] }, $or: [{ orderId: new mongoose.Types.ObjectId(oid) }, { repairOrderIds: new mongoose.Types.ObjectId(oid) }] });
    const invCol = db.collection('invoices');
    f.check((await invCol.countDocuments(invFilter(A.orderId))) === 0, 'Vorbedingung DB: fuer Auftrag A existiert noch keine Rechnung');
    await f.goto(adm, '/admin/financial', 3500);
    await adm.getByRole('tab', { name: /^Rechnungen/ }).first().click();
    await adm.waitForTimeout(2000);
    await adm.getByRole('button', { name: 'Rechnung aus Aufträgen erstellen' }).filter({ visible: true }).first().click();
    let inv = adm.getByRole('dialog', { name: /Rechnung aus Aufträgen erstellen/ });
    await inv.waitFor({ state: 'visible', timeout: 10000 });
    const addOrder = async (dlg, orderNumber) => {
      const input = dlg.getByPlaceholder(/Auftrag suchen/);
      await input.click(); await input.fill(orderNumber);
      const s = adm.locator('div.absolute.z-50 button', { hasText: orderNumber }).first();
      await s.waitFor({ state: 'visible', timeout: 20000 });
      await s.click();
    };
    const waitPreview = async (dlg, ready) => {
      const s0 = Date.now();
      while (Date.now() - s0 < 20000) {
        const t = norm(await dlg.innerText());
        if (!/Vorschau wird geladen/.test(t) && ready(t)) return t;
        await sleep(400);
      }
      return norm(await dlg.innerText());
    };
    const createBtn = (dlg) => dlg.getByRole('button', { name: 'Rechnung erstellen', exact: true });
    const confirmIncomplete = (dlg) => dlg.locator('label', { hasText: 'Noch nicht abgeschlossen' }).getByRole('checkbox');
    await addOrder(inv, A.orderNumber);
    const rowRe = (o) => new RegExp(`${esc(o)} (Nicht abgeschlossen|Abgeschlossen)`);
    let it = await waitPreview(inv, (t) => rowRe(A.orderNumber).test(t) && /Gesamt/.test(t));
    f.check(it.includes(`${A.orderNumber} Nicht abgeschlossen (pending)`), 'Vorschau zeigt den Umfang: eigener Auftrag A, Status "Nicht abgeschlossen (pending)"', (it.match(new RegExp(`${esc(A.orderNumber)}.{0,60}`)) || [''])[0]);
    f.check(it.includes(CUSTOMER_EMAIL) && it.includes(`Gesamt (brutto) ${eur(A.total)}`), 'Vorschau zeigt Kunde und Gesamt (brutto) = Auftragswert', (it.match(/Gesamt \(brutto\).{0,15}/) || [''])[0]);
    f.check(await createBtn(inv).isDisabled(), 'nicht abgeschlossener Auftrag: "Rechnung erstellen" ohne Bestaetigung gesperrt');
    f.check(/Rechnung sofort per E-Mail an partner@e2e\.invalid senden \(eine E-Mail mit PDF\)/.test(it), 'Versandoption nennt den Empfaenger und "eine E-Mail"');
    await f.shot(adm, 'rechnung_aus_auftraegen_vorschau_unbestaetigt');
    await confirmIncomplete(inv).click();
    await adm.waitForTimeout(500);
    f.check(await createBtn(inv).isEnabled(), 'nach ausdruecklicher Bestaetigung "Trotzdem berechnen" ist "Rechnung erstellen" freigegeben');
    await f.shot(adm, 'rechnung_aus_auftraegen_bestaetigt');

    before = mailSnapshot();
    const createBefore = reqLog.filter(isCreate).length;
    const sendBefore = reqLog.filter((e) => /\/send$/.test(e.path)).length;
    const dispatchedInv = await adm.evaluate(() => {
      const dlg = Array.from(document.querySelectorAll('[role="dialog"]')).find((d) => /Rechnung aus Aufträgen erstellen/.test(d.textContent || ''));
      const btn = dlg && Array.from(dlg.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Rechnung erstellen');
      if (!btn) return 'fehlt';
      btn.click(); const disabledAfterFirst = btn.disabled; btn.click();
      return `geklickt (nach 1. Klick disabled=${disabledAfterFirst})`;
    });
    await sleep(800);
    const createReqs = reqLog.filter(isCreate).slice(createBefore);
    const createResps = (await waitResponses(respLog, isCreate, createBefore + createReqs.length)).slice(createBefore);
    await inv.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    f.note(`   Doppelklick "Rechnung erstellen": ${dispatchedInv}; ${createReqs.length} Erstell-POST(s), Antworten: ${createResps.map((r) => { try { const j = JSON.parse(r.body); return `${r.status} ${j.code || ''} ${j.error || j.invoice?.invoiceNumber || ''}`; } catch (e) { return String(r.status); } }).join(' | ')}`);
    let invDocs = await invCol.find(invFilter(A.orderId)).toArray();
    const invNo = invDocs[0]?.invoiceNumber || '';
    f.check(invDocs.length === 1, 'Nachpruefung DB: genau EINE aktive Rechnung fuer Auftrag A', invDocs.map((d) => d.invoiceNumber).join(','));
    f.check(invDocs.length === 1 && (invDocs[0].activeBillingKeys || []).some((k) => String(k).includes(A.orderId)) && (invDocs[0].repairOrderIds || []).map(String).includes(A.orderId), 'Nachpruefung DB: Rechnung belegt den Auftrag atomar (activeBillingKeys + repairOrderIds)', JSON.stringify(invDocs[0]?.activeBillingKeys || []));
    f.check((await invCol.countDocuments(invFilter(B.orderId))) === 0, 'Nachpruefung DB: Auftrag B wurde NICHT berechnet (nur der eigene ausgewaehlte Auftrag)');
    f.check(invDocs.length === 1 && Math.abs(Number(invDocs[0].total) - A.total) < 0.005, 'Rechnungsbetrag (brutto) = Auftragswert', `${invDocs[0]?.total} / ${A.total}`);
    const invMails = await settleMails(before, (m) => invNo && m.text.includes(invNo), { min: 1 });
    f.check(invMails.length === 1, 'genau EINE Rechnungsmail (sofort per E-Mail, Standard) fuer die neue Rechnung', invMails.map((m) => `${m.file} -> ${m.to}${m.hasPdf ? ' [PDF]' : ''}`).join(' | '));
    f.check(invMails.length === 1 && invMails[0].recipients[0] === CUSTOMER_EMAIL && invMails[0].hasPdf, 'Rechnungsmail an den Testkunden mit PDF-Anhang', invMails.map((m) => m.to).join(','));
    f.note(`   Versand-POSTs /invoices/:id/send: ${reqLog.filter((e) => /\/send$/.test(e.path)).length - sendBefore}`);
    tl = (await toasts(adm)).map(norm);
    f.check(tl.some((t) => t.includes(`Rechnung ${invNo} wurde erstellt und per E-Mail an ${CUSTOMER_EMAIL} übergeben`)), 'Rueckmeldung: "Rechnung … wurde erstellt und per E-Mail an … übergeben."', tl.slice(-3).join(' || ').slice(0, 300));
    const dupToast = tl.find((t) => /Rechnung nicht erstellt/.test(t));
    if (createReqs.length > 1) f.check(!!dupToast && /bereits/.test(dupToast) && !/error|failed|E11000/i.test(dupToast), 'zweiter Klick erreichte den Server: klare deutsche Meldung statt zweiter Rechnung', dupToast || '(keine)');
    await f.shot(adm, 'rechnung_erstellt', true);

    // Zweiter Lauf: A (bereits berechnet) + B (offen)
    await adm.getByRole('button', { name: 'Rechnung aus Aufträgen erstellen' }).filter({ visible: true }).first().click();
    inv = adm.getByRole('dialog', { name: /Rechnung aus Aufträgen erstellen/ });
    await inv.waitFor({ state: 'visible', timeout: 10000 });
    await addOrder(inv, A.orderNumber);
    await addOrder(inv, B.orderNumber);
    it = await waitPreview(inv, (t) => rowRe(A.orderNumber).test(t) && rowRe(B.orderNumber).test(t) && /Gesamt/.test(t));
    f.check(it.includes(`Bereits berechnet: ${invNo}`), `zweiter Lauf: Auftrag A als "Bereits berechnet: ${invNo}" ausgewiesen`, (it.match(new RegExp(`${esc(A.orderNumber)}.{0,80}`)) || [''])[0]);
    f.check(it.includes(`Auftrag ${A.orderNumber} ist bereits berechnet (Rechnung ${invNo}).`) && /Bitte den betroffenen Auftrag entfernen/.test(it), 'zweiter Lauf: klare deutsche Meldung "… ist bereits berechnet (Rechnung …)" mit Handlungshinweis');
    if (await confirmIncomplete(inv).count()) await confirmIncomplete(inv).click();
    await adm.waitForTimeout(500);
    f.check(await createBtn(inv).isDisabled(), 'zweiter Lauf mit bereits berechnetem Auftrag: "Rechnung erstellen" bleibt gesperrt (auch nach Bestaetigung)');
    await f.shot(adm, 'zweiter_lauf_bereits_berechnet');
    await inv.getByRole('button', { name: `Auftrag ${A.orderNumber} entfernen` }).click();
    it = await waitPreview(inv, (t) => !rowRe(A.orderNumber).test(t) && rowRe(B.orderNumber).test(t) && /Gesamt/.test(t));
    if (await confirmIncomplete(inv).count()) await confirmIncomplete(inv).click();
    await adm.waitForTimeout(500);
    f.check(!it.includes('bereits berechnet') && await createBtn(inv).isEnabled(), 'nach Entfernen des berechneten Auftrags waere nur Auftrag B berechenbar (Sperre gilt genau dem berechneten Auftrag)');
    f.note('   (Abweichung zur Formulierung "überspringen": bereits berechnete Aufträge werden nicht automatisch ausgelassen, sondern blockieren, bis sie entfernt sind.)');
    await f.shot(adm, 'zweiter_lauf_nur_b_moeglich');
    await inv.getByRole('button', { name: /Abbrechen/ }).click();
    await adm.waitForTimeout(800);
    f.check((await invCol.countDocuments(invFilter(B.orderId))) === 0, 'Abbrechen: fuer Auftrag B wurde keine Rechnung erstellt');
    // Serverschutz unabhaengig von der gesperrten Schaltflaeche (Nachpruefung per API)
    const again = await api(admApi, 'POST', '/api/admin/financial/invoices/from-repairs', { repairOrderIds: [A.orderNumber], options: { confirmIncompleteOrders: true } });
    f.check(again.status === 409 && again.data?.code === 'ORDER_ALREADY_INVOICED' && /bereits die Rechnung/.test(again.data?.error || ''), 'Nachpruefung API: erneutes Erstellen fuer Auftrag A -> 409 mit deutscher Meldung', `${again.status} ${again.data?.code} ${String(again.data?.error || '').slice(0, 120)}`);
    invDocs = await invCol.find(invFilter(A.orderId)).toArray();
    f.check(invDocs.length === 1, 'Nachpruefung DB: weiterhin genau EINE Rechnung fuer Auftrag A', invDocs.length);

    // ===== 5. Zahlungsaufforderung aus der Rechnungszeile
    f.note('--- 5. Zahlungsaufforderung aus der Rechnungszeile ---');
    await f.goto(adm, '/admin/financial', 3500);
    await adm.getByRole('tab', { name: /^Rechnungen/ }).first().click();
    await adm.waitForTimeout(2500);
    const invRow = adm.locator('tr', { hasText: invNo }).first();
    await invRow.waitFor({ state: 'visible', timeout: 20000 });
    await invRow.getByRole('button', { name: 'Aktionen' }).click();
    await adm.getByRole('menuitem', { name: /Zahlungsaufforderung senden/ }).click();
    dialog = adm.getByRole('dialog', { name: /Zahlungsaufforderung per E-Mail/ });
    await dialog.waitFor({ state: 'visible', timeout: 10000 });
    const s5 = Date.now();
    while (/Wird geladen/.test(await dialog.innerText()) && Date.now() - s5 < 15000) await sleep(300);
    dt = norm(await dialog.innerText());
    f.check(dt.includes(`Bezug Rechnung ${invNo}`) && dt.includes(`<${CUSTOMER_EMAIL}>`) && dt.includes(`Offener Betrag ${eur(A.total)}`), 'Rechnungszeile → Bestaetigung zeigt Rechnungsbezug, Empfaenger und offenen Betrag', (dt.match(/Empfänger.{0,140}/) || [''])[0]);
    f.check((dt.match(new RegExp(`an ${esc(CUSTOMER_EMAIL)}\\s*Übergeben`, 'g')) || []).length === 2, 'Rechnungszeile → Bestaetigung listet die beiden bisherigen Aufforderungen der Buchung');
    await f.shot(adm, 'rechnungszeile_bestaetigung');
    before = mailSnapshot();
    const r5p = adm.waitForResponse((r) => r.request().method() === 'POST' && /\/payment-request$/.test(new URL(r.url()).pathname), { timeout: 60000 });
    await dialog.getByRole('button', { name: 'Jetzt per E-Mail senden' }).click();
    const r5 = await r5p;
    const r5body = await r5.json().catch(() => ({}));
    mails = await settleMails(before, (m) => (m.text.includes(invNo) || m.text.includes(A.bookingNumber)) && /Zahlungsaufforderung/.test(m.text));
    f.note(`   Rechnungs-Aufforderung (ohne force): ${r5.status()} ${r5body.code || r5body.status || ''}; neue Aufforderungs-Mails: ${mails.length} ${mails.map((m) => m.to).join(',')}`);
    f.check(r5.status() === 409 && r5body.code === 'PAYMENT_REQUEST_RECENT' && mails.length === 0, '24-h-Regel gilt fuer dieselbe Buchung auch beim Weg ueber ihre Rechnung (Aufforderung fuer die Buchung vor wenigen Minuten)', `${r5.status()} ${r5body.code || r5body.status || ''}, Mails ${mails.length}`);
    await f.shot(adm, 'rechnungszeile_nach_senden');
    if (await dialog.isVisible().catch(() => false)) await dialog.getByRole('button', { name: 'Abbrechen' }).click().catch(() => {});

    const allPr = await prCol.find({ bookingId: new mongoose.Types.ObjectId(A.bookingId) }).toArray();
    f.note(`   Nachpruefung DB Ende: Zahlungsaufforderungen Buchung ${A.bookingNumber}: ${allPr.map((d) => `${d.targetType}/${d.status}/${d.invoiceNumber || '-'}`).join(', ')}`);
  } catch (e) {
    if (adm) await f.shot(adm, 'DEBUG_abbruch', true).catch(() => {});
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 4).join(' | ')}`);
  }
  if (db) await db.close().catch(() => {});
  const ngAfter = netguardLines();
  f.check(ngAfter === ngBefore, 'netguard_after.log unveraendert (keine externe Verbindung des Testservers)', `${ngBefore} -> ${ngAfter}`);
  await f.finish();
})();
