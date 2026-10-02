// Runde 3 – Profil / Checkout-Adressen / Neuer Auftrag Schritt 3 (echter Browser, Kunde partner@e2e.invalid + Gast)
//  C) Checkout-Dialog: Rechnungs- und Lieferadresse speichern (KEINE Bestellung), Reload -> Werte bleiben;
//     "Lieferadresse wie Rechnung" darf beim Speichern der Rechnungsadresse nicht verloren gehen.
//  A) Profil: Vorname, Telefon, Rechnungsadresse, eine Benachrichtigungseinstellung aendern -> Speichern -> Erfolg,
//     Reload -> Werte bleiben, nichts anderes aendert sich (u. a. "Lieferadresse wie Rechnung"); danach ueber dieselbe
//     Seite die Originalwerte wiederherstellen.
//  B) API (nur Nachpruefung): PUT /api/users/me mit role:'admin' aendert die Rolle NICHT.
//  D) /new-order Schritt 3 "Kundeninformationen" als Gast und als Kunde: keine Demo-Admin-Daten, Kunde sieht sich selbst.
// Jeder Teil startet vom Ausgangsprofil (zwischendurch per API PUT /api/users/me zurueckgeschrieben, protokolliert).
// Personenbezogene Werte werden nicht ausgegeben (nur Gleichheit/Flags); alle Daten sind Testdaten (e2e.invalid).
const fs = require('fs'); const path = require('path');
const { makeFlow, apiLogin, api } = require('./flowlib');
const mongoose = require('/home/adar/Projects/FixitHub/server/node_modules/mongoose');

const DB = 'mongodb://127.0.0.1:27099/e2e_after';
const NETGUARD = path.join(__dirname, 'netguard_after.log');
const RUN = `R3P-${Date.now().toString(36).toUpperCase()}`;
const ngSize = () => (fs.existsSync(NETGUARD) ? fs.statSync(NETGUARD).size : 0);
const db = async (fn) => { const c = await mongoose.createConnection(DB).asPromise(); try { return await fn(c); } finally { await c.close(); } };
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const canon = (v) => JSON.stringify(v, (k, val) => (val && typeof val === 'object' && !Array.isArray(val) ? Object.keys(val).sort().reduce((o, key) => { o[key] = val[key]; return o; }, {}) : val));
const PROJ = { firstName: 1, lastName: 1, email: 1, phone: 1, role: 1, invoiceAddress: 1, paymentAddress: 1, preferences: 1 };
const readUser = () => db(async (c) => c.collection('users').findOne({ email: 'partner@e2e.invalid' }, { projection: PROJ }));
const addrOf = (a) => ({ street: a?.street || '', city: a?.city || '', state: a?.state || '', zipCode: a?.zipCode || '', country: a?.country || '' });
const payOf = (a) => ({ ...addrOf(a), sameAsInvoice: a?.sameAsInvoice !== false, deliveryType: a?.deliveryType || '', packstationNumber: a?.packstationNumber || '', postNumber: a?.postNumber || '' });
const payFlags = (a) => `wieRechnung=${a?.sameAsInvoice !== false} Zustellart=${a?.deliveryType || '-'} eigeneStrasse=${a?.street ? 'gesetzt' : 'leer'}`;

async function waitToast(page, re, timeout = 10000) {
  const loc = page.locator('[role="status"], li[data-state], [data-sonner-toast], .toast, [role="alert"]').filter({ hasText: re });
  try { await loc.first().waitFor({ timeout }); return squash(await loc.first().innerText()); } catch (e) { return ''; }
}

(async () => {
  const f = makeFlow('r3_profile_neworder'); await f.start();
  const ng0 = ngSize();
  let c; let g; let orig = null; let cartAdded = false; let cust = null;
  const NEW = { firstName: 'Paulina', phone: '+49 30 2222222', street: 'Prüfweg 7' };
  const restoreProfile = async (why) => {
    const back = await api(cust, 'PUT', '/api/users/me', { firstName: orig.firstName, phone: orig.phone || '', invoiceAddress: orig.invoiceAddress, paymentAddress: orig.paymentAddress, preferences: orig.preferences });
    const u = await readUser();
    const ok = u.firstName === orig.firstName && (u.phone || '') === (orig.phone || '') && canon(addrOf(u.invoiceAddress)) === canon(addrOf(orig.invoiceAddress)) && canon(payOf(u.paymentAddress)) === canon(payOf(orig.paymentAddress)) && canon(u.preferences?.notifications) === canon(orig.preferences?.notifications) && u.role === orig.role;
    f.note(`Testdaten: Ausgangsprofil per API PUT /api/users/me zurückgeschrieben (${why}) -> ${back.status}, identisch=${ok}`);
    return ok;
  };
  try {
    orig = await readUser();
    cust = await apiLogin('customer');
    f.note(`Testdaten: Ausgangsprofil partner@e2e.invalid im Speicher gesichert (Rolle ${orig.role}; Lieferadresse: ${payFlags(orig.paymentAddress)})`);
    c = await f.session('customer');

    // ================= C) Checkout-Dialog: Adressen speichern ======================================
    const svc = await db(async (cn) => cn.collection('services').findOne({ name: 'Diagnose E2E', isActive: true }));
    const bookingCount = () => db(async (cn) => cn.collection('bookings').countDocuments({ customerId: orig._id }));
    const bookings0 = await bookingCount();
    const add = await api(cust, 'POST', '/api/cart/add-repair-order', { deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 15', services: [String(svc._id)], addOns: [], totalCost: 49.9, errorDescription: `E2E ${RUN} Adresstest (keine Bestellung)`, waterDamage: 'no', previousRepairAttempts: 'no', itemCondition: 'original', noLock: true });
    cartAdded = add.status === 200;
    f.note(`Testdaten: Warenkorb-Position per API (nur damit der Checkout-Dialog geöffnet werden kann, es wird NICHT bestellt) -> ${add.status}`);
    const openCheckout = async () => {
      await f.goto(c, '/cart', 3500);
      await c.getByRole('button', { name: /Zur Kasse/ }).first().click();
      await c.getByRole('button', { name: /Rechnungsadresse bearbeiten/ }).waitFor({ timeout: 20000 });
      await c.waitForTimeout(800);
      return c.getByRole('dialog').first();
    };
    let dlg = await openCheckout();
    const lieferBefore = squash(await dlg.innerText()).match(/Lieferadresse (?:Bearbeiten )?(.{0,40})/)?.[1] || '';
    const shownSame = /Gleich wie Rechnungsadresse/.test(lieferBefore);
    f.note(`   Checkout geöffnet; Lieferadresse-Zusammenfassung: ${shownSame ? '"Gleich wie Rechnungsadresse"' : 'eigene Adresse (Rechnungsanschrift kopiert)'}; Profil: ${payFlags(orig.paymentAddress)}`);
    f.check(orig.paymentAddress?.sameAsInvoice === false || shownSame, 'Checkout zeigt bei "Lieferadresse wie Rechnung" auch "Gleich wie Rechnungsadresse"', shownSame ? 'Gleich wie Rechnungsadresse' : 'eigene Adresse angezeigt');
    await f.shot(c, 'C_checkout_vorher');
    await c.getByRole('button', { name: /Rechnungsadresse bearbeiten/ }).click();
    await c.fill('#checkout-billing-street', NEW.street);
    await f.shot(c, 'C_checkout_rechnungsadresse_editor');
    await c.getByRole('button', { name: /^Adresse speichern$/ }).click();
    const t3 = await waitToast(c, /Ihre Angaben wurden gespeichert|fehlgeschlagen/);
    f.check(/Ihre Angaben wurden gespeichert/.test(t3), 'Checkout: Rechnungsadresse gespeichert (Erfolgsmeldung)', t3.slice(0, 80));
    let u = await readUser();
    f.check(u.invoiceAddress?.street === NEW.street && u.invoiceAddress?.city === orig.invoiceAddress?.city && u.invoiceAddress?.zipCode === orig.invoiceAddress?.zipCode, 'DB: Rechnungsadresse aus dem Checkout gespeichert (Straße neu, PLZ/Ort unverändert)');
    const pab = u.paymentAddress || {};
    f.note(`   DB nach "Adresse speichern" im Checkout: ${payFlags(pab)}; eigene Lieferstraße = ALTE Rechnungsstraße: ${pab.street === orig.invoiceAddress?.street}`);
    f.check(orig.paymentAddress?.sameAsInvoice === false || (pab.sameAsInvoice !== false && pab.street !== orig.invoiceAddress?.street),
      'Checkout-Rechnungsadresse: "Lieferadresse wie Rechnung" bleibt erhalten (keine alte Rechnungsanschrift als eigene Lieferadresse eingefroren)', payFlags(pab));
    const checkoutTxt2 = squash(await dlg.innerText());
    f.check(orig.paymentAddress?.sameAsInvoice === false || /Gleich wie Rechnungsadresse/.test(checkoutTxt2) || checkoutTxt2.includes(NEW.street), 'Checkout-Ansicht nach dem Speichern: Lieferung folgt der neuen Rechnungsadresse');
    // Lieferadresse separat speichern
    const lief = dlg.locator('p', { hasText: /^Lieferadresse$/ }).locator('xpath=../..');
    await lief.getByRole('button', { name: /Bearbeiten/ }).click();
    await c.getByRole('button', { name: /^Lieferadresse$/ }).click();
    await c.fill('#shipping-street-draft', 'Lieferweg 3');
    await c.fill('#shipping-city-draft', 'Hamburg');
    await c.fill('#shipping-zip-draft', '20095');
    await f.shot(c, 'C_checkout_lieferadresse_editor');
    await c.getByRole('button', { name: /Lieferadresse speichern/ }).click();
    const t4 = await waitToast(c, /Lieferadresse wurde gespeichert|fehlgeschlagen/);
    f.check(/Lieferadresse wurde gespeichert/.test(t4), 'Checkout: Lieferadresse gespeichert (Erfolgsmeldung)', t4.slice(0, 80));
    u = await readUser();
    const p2 = payOf(u.paymentAddress);
    f.check(p2.sameAsInvoice === false && p2.deliveryType === 'address' && p2.street === 'Lieferweg 3' && p2.zipCode === '20095' && p2.city === 'Hamburg' && u.invoiceAddress?.street === NEW.street,
      'DB: Lieferadresse gespeichert (eigene Adresse), Rechnungsadresse bleibt');
    await c.keyboard.press('Escape'); await c.waitForTimeout(600);
    await c.reload({ waitUntil: 'domcontentloaded' }); await c.waitForTimeout(1500);
    dlg = await openCheckout();
    const dTxt = squash(await dlg.innerText());
    f.check(dTxt.includes(NEW.street) && dTxt.includes('Lieferweg 3') && dTxt.includes('20095 Hamburg'), 'Nach Reload: Checkout zeigt gespeicherte Rechnungs- und Lieferadresse');
    await f.shot(c, 'C_checkout_nach_reload');
    await c.keyboard.press('Escape'); await c.waitForTimeout(500);
    await f.goto(c, '/profile', 3500);
    await c.waitForFunction(() => (document.querySelector('#firstName')?.value || '').length > 0, null, { timeout: 15000 });
    await c.waitForTimeout(600);
    const profStreet = await c.inputValue('#invoiceStreet');
    const profPay = (await c.locator('#paymentStreet').count()) ? await c.inputValue('#paymentStreet') : '(Feld nicht sichtbar)';
    f.check(profStreet === NEW.street && profPay === 'Lieferweg 3', 'Profilseite zeigt die im Checkout gespeicherten Adressen', `${profStreet === NEW.street}/${profPay === 'Lieferweg 3'}`);
    await f.shot(c, 'C_profil_nach_checkout_adressen', true);
    const bookings1 = await bookingCount();
    f.check(bookings1 === bookings0, 'Adresstest im Checkout hat KEINE Buchung/Bestellung erzeugt', `${bookings0} -> ${bookings1}`);
  } catch (e) {
    if (c) await f.shot(c, 'DEBUG_checkout', true).catch(() => {});
    f.check(false, `Checkout-Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 3).join(' | ')}`);
  }
  try {
    if (cartAdded) {
      const clr = await api(cust, 'DELETE', '/api/cart/clear');
      const cart = await db(async (cn) => cn.collection('carts').findOne({ userId: orig._id }));
      f.note(`Testdaten: Warenkorb per API DELETE /api/cart/clear geleert -> ${clr.status}`);
      f.check(!cart || ((cart.items || []).length === 0 && (cart.repairOrders || []).length === 0), 'Aufräumen: Warenkorb wieder leer (keine Bestellung ausgelöst)');
    }
    if (orig) await restoreProfile('nach Checkout-Test');
  } catch (e) { f.check(false, `Aufräumen (Checkout) fehlgeschlagen: ${String(e.message).slice(0, 160)}`); }

  // ================= C2) Packstation bleibt beim Speichern der Rechnungsadresse erhalten ===========
  try {
    const PS = { sameAsInvoice: false, deliveryType: 'packstation', packstationNumber: '123', postNumber: '12345678', zipCode: '20095', city: 'Hamburg', country: 'DE', street: '', state: '' };
    const prep = await api(cust, 'PUT', '/api/users/me', { paymentAddress: PS });
    f.note(`Testdaten: Lieferadresse des Kunden per API auf eine Test-Packstation gesetzt -> ${prep.status}`);
    const svc = await db(async (cn) => cn.collection('services').findOne({ name: 'Diagnose E2E', isActive: true }));
    const add = await api(cust, 'POST', '/api/cart/add-repair-order', { deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 15', services: [String(svc._id)], addOns: [], totalCost: 49.9, errorDescription: `E2E ${RUN} Packstation-Adresstest (keine Bestellung)`, waterDamage: 'no', previousRepairAttempts: 'no', itemCondition: 'original', noLock: true });
    f.note(`Testdaten: Warenkorb-Position per API (keine Bestellung) -> ${add.status}`);
    await f.goto(c, '/cart', 3500);
    await c.getByRole('button', { name: /Zur Kasse/ }).first().click();
    await c.getByRole('button', { name: /Rechnungsadresse bearbeiten/ }).waitFor({ timeout: 20000 });
    await c.waitForTimeout(800);
    const dlg = c.getByRole('dialog').first();
    f.check(/DHL Packstation 123/.test(squash(await dlg.innerText())), 'Checkout zeigt die Packstation als Lieferadresse');
    await c.getByRole('button', { name: /Rechnungsadresse bearbeiten/ }).click();
    await c.fill('#checkout-billing-street', NEW.street);
    await c.getByRole('button', { name: /^Adresse speichern$/ }).click();
    const t = await waitToast(c, /Ihre Angaben wurden gespeichert|fehlgeschlagen/);
    await f.shot(c, 'C2_checkout_packstation_nach_rechnungsadresse');
    const u = await readUser();
    const pa = u.paymentAddress || {};
    f.check(/Ihre Angaben wurden gespeichert/.test(t) && u.invoiceAddress?.street === NEW.street, 'Packstation-Kunde: Rechnungsadresse im Checkout gespeichert');
    f.check(pa.sameAsInvoice === false && pa.deliveryType === 'packstation' && pa.packstationNumber === '123' && pa.postNumber === '12345678' && pa.zipCode === '20095',
      'Packstation bleibt nach dem Speichern der Rechnungsadresse vollständig erhalten', payFlags(pa));
    await c.keyboard.press('Escape'); await c.waitForTimeout(500);
    const clr = await api(cust, 'DELETE', '/api/cart/clear');
    f.note(`Testdaten: Warenkorb per API geleert -> ${clr.status}`);
  } catch (e) {
    if (c) await f.shot(c, 'DEBUG_packstation', true).catch(() => {});
    f.check(false, `Packstation-Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 3).join(' | ')}`);
    await api(cust, 'DELETE', '/api/cart/clear').catch(() => {});
  }
  try { if (orig) await restoreProfile('nach Packstation-Test'); } catch (e) { f.check(false, `Aufräumen (Packstation) fehlgeschlagen: ${String(e.message).slice(0, 160)}`); }

  // ================= A) Profil ====================================================================
  try {
    await f.goto(c, '/profile', 3500);
    await c.waitForFunction(() => (document.querySelector('#firstName')?.value || '').length > 0, null, { timeout: 15000 });
    await c.waitForTimeout(600);
    f.check(await c.inputValue('#firstName') === orig.firstName && await c.inputValue('#phone') === (orig.phone || '') && await c.inputValue('#invoiceStreet') === (orig.invoiceAddress?.street || ''),
      'Profil lädt die gespeicherten Werte (Vorname, Telefon, Rechnungsstraße)');
    const separateForm = await c.locator('#paymentStreet').count();
    f.check(orig.paymentAddress?.sameAsInvoice === false || separateForm === 0, 'Profil: "Lieferadresse wie Rechnung" wird als solche angezeigt (kein leeres eigenes Lieferadress-Formular)', separateForm ? 'leeres Lieferadress-Formular sichtbar' : 'wie Rechnung');
    const pushMsg = c.locator('#type-push-message');
    const pushBefore = await pushMsg.getAttribute('aria-checked');
    f.check(pushBefore === 'true', 'Benachrichtigung "Nachrichten" (In-App) ist anfangs aktiv', pushBefore);
    await c.fill('#firstName', NEW.firstName);
    await c.fill('#phone', NEW.phone);
    await c.fill('#invoiceStreet', NEW.street);
    await pushMsg.scrollIntoViewIfNeeded(); await pushMsg.click();
    f.check(await pushMsg.getAttribute('aria-checked') === 'false', 'Checkbox "Nachrichten" (In-App) im Formular abgewählt');
    await f.shot(c, 'A_profil_geaendert_vor_speichern', true);
    await c.getByRole('button', { name: /Änderungen speichern/ }).click();
    const t1 = await waitToast(c, /Profil erfolgreich aktualisiert|Fehler/);
    f.check(/Profil erfolgreich aktualisiert/.test(t1), 'Speichern meldet Erfolg ("Profil erfolgreich aktualisiert")', t1.slice(0, 80));
    await f.shot(c, 'A_profil_gespeichert');
    let u = await readUser();
    f.check(u.firstName === NEW.firstName && u.phone === NEW.phone && u.invoiceAddress?.street === NEW.street, 'DB: Vorname, Telefon und Rechnungsstraße gespeichert');
    f.check(u.preferences?.notifications?.channelsByType?.message?.push === false, 'DB: Benachrichtigung "Nachrichten" In-App = aus');
    f.check(u.lastName === orig.lastName && u.email === orig.email && u.role === orig.role, 'DB: Nachname, E-Mail, Rolle unverändert');
    f.note(`   DB Lieferadresse nach Profil-Speichern: ${payFlags(u.paymentAddress)} (vorher ${payFlags(orig.paymentAddress)})`);
    f.check((u.paymentAddress?.sameAsInvoice !== false) === (orig.paymentAddress?.sameAsInvoice !== false), 'DB: "Lieferadresse wie Rechnung" durch das Speichern NICHT verändert', `${orig.paymentAddress?.sameAsInvoice !== false} -> ${u.paymentAddress?.sameAsInvoice !== false}`);
    const prefsKeep = ['emailEvents', 'pushEvents', 'email', 'push', 'sms', 'mode'].every((k) => canon(u.preferences?.notifications?.[k]) === canon(orig.preferences?.notifications?.[k]));
    const otherTypes = Object.keys(orig.preferences?.notifications?.channelsByType || {}).filter((k) => k !== 'message').every((k) => canon(u.preferences.notifications.channelsByType[k]) === canon(orig.preferences.notifications.channelsByType[k]));
    f.check(prefsKeep && otherTypes, 'DB: übrige Benachrichtigungseinstellungen unverändert (keine Nebenwirkung)');
    await c.reload({ waitUntil: 'domcontentloaded' });
    await c.waitForFunction(() => (document.querySelector('#firstName')?.value || '').length > 0, null, { timeout: 15000 });
    await c.waitForTimeout(800);
    f.check(await c.inputValue('#firstName') === NEW.firstName && await c.inputValue('#phone') === NEW.phone && await c.inputValue('#invoiceStreet') === NEW.street
      && await c.locator('#type-push-message').getAttribute('aria-checked') === 'false', 'Nach Reload: geänderte Werte und Benachrichtigungseinstellung bleiben erhalten');
    await f.shot(c, 'A_profil_nach_reload', true);
    // Wiederherstellen ueber dieselbe Seite
    await c.fill('#firstName', orig.firstName);
    await c.fill('#phone', orig.phone || '');
    await c.fill('#invoiceStreet', orig.invoiceAddress?.street || '');
    await c.locator('#type-push-message').click();
    await c.getByRole('button', { name: /Änderungen speichern/ }).click();
    const t2 = await waitToast(c, /Profil erfolgreich aktualisiert|Fehler/);
    f.check(/Profil erfolgreich aktualisiert/.test(t2), 'Wiederherstellung über das Profil gespeichert', t2.slice(0, 80));
    u = await readUser();
    const sameAll = u.firstName === orig.firstName && (u.phone || '') === (orig.phone || '') && canon(addrOf(u.invoiceAddress)) === canon(addrOf(orig.invoiceAddress))
      && canon(payOf(u.paymentAddress)) === canon(payOf(orig.paymentAddress)) && canon(u.preferences?.notifications) === canon(orig.preferences?.notifications);
    f.check(sameAll, 'DB: Originalwerte (Vorname, Telefon, Rechnungs-/Lieferadresse, Benachrichtigungen) über die Profilseite vollständig wiederhergestellt', payFlags(u.paymentAddress));
  } catch (e) {
    if (c) await f.shot(c, 'DEBUG_profil', true).catch(() => {});
    f.check(false, `Profil-Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 3).join(' | ')}`);
  }

  // ================= B) Rolle nicht selbst änderbar ===============================================
  try {
    const r = await api(cust, 'PUT', '/api/users/me', { role: 'admin' });
    const u = await readUser();
    const me = await api(cust, 'GET', '/api/auth/me');
    const meRole = me.data?.user?.role || me.data?.role;
    f.note(`   API PUT /api/users/me {role:'admin'} (Kunde) -> ${r.status}, Antwort-Rolle=${r.data?.user?.role ?? '-'}, Passwortfeld in Antwort=${!!(r.data?.user && 'password' in r.data.user)}`);
    f.check([200, 403].includes(r.status) && u.role === 'customer' && meRole === 'customer' && (r.data?.user?.role ?? 'customer') === 'customer', 'PUT /api/users/me mit role:"admin" ändert die Rolle NICHT (DB + /api/auth/me = customer)', `${r.status} db=${u.role} me=${meRole}`);
    f.check(!(r.data?.user && 'password' in r.data.user), 'Antwort enthält kein Passwortfeld');
    if (u.role !== 'customer') {
      await db(async (cn) => cn.collection('users').updateOne({ email: 'partner@e2e.invalid' }, { $set: { role: orig.role } }));
      f.note('Testdaten: Rolle sofort per DB auf den Originalwert zurückgesetzt (Fehlerfall)');
    }
  } catch (e) { f.check(false, `Rollen-Prüfung abgebrochen: ${String(e.message).slice(0, 160)}`); }

  // Ausgangszustand sicherstellen
  try { if (orig) f.check(await restoreProfile('Abschluss'), 'Aufräumen: Kundenprofil entspricht wieder dem Ausgangszustand'); } catch (e) { f.check(false, `Aufräumen fehlgeschlagen: ${String(e.message).slice(0, 160)}`); }

  // ================= D) /new-order Schritt 3 =========================================================
  const step3 = async (page, tag) => {
    await f.goto(page, '/new-order', 3500);
    await page.fill('#deviceSearch', 'iPhone 15');
    const hit = page.locator('button', { hasText: /iPhone 15/ }).first();
    await hit.waitFor({ timeout: 15000 });
    await hit.click();
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: /Weiter zu Diensten/ }).click();
    await page.waitForTimeout(2000);
    const box = page.locator('h3', { hasText: /^Diagnose E2E$/ }).first().locator('xpath=preceding-sibling::button[@role="checkbox"]');
    await box.waitFor({ timeout: 15000 });
    await box.click();
    await page.getByRole('button', { name: /Weiter \(1 Dienste?\)/ }).click();
    await page.waitForTimeout(1800);
    const block = page.locator('h4', { hasText: /^Kundeninformationen$/ }).first().locator('xpath=..');
    await block.waitFor({ timeout: 10000 });
    await block.scrollIntoViewIfNeeded();
    await f.shot(page, `D_${tag}_schritt3_kundeninformationen`);
    return { block: squash(await block.innerText()), body: squash(await page.locator('body').innerText()) };
  };
  const DEMO = /Admin User|admin@example\.com|\+1 \(555\) 000-0000/;
  try {
    g = await f.session('guest');
    const gs = await step3(g, 'gast');
    f.note(`   Gast Schritt 3 Kundeninformationen: "${gs.block.slice(0, 80)}"`);
    f.check(/Schritt 3 von 5|3\/5/.test(gs.body), 'Gast: Schritt 3 erreicht');
    f.check(!DEMO.test(gs.body), 'Gast: keine Demo-Admin-Daten (Admin User / admin@example.com / +1 (555) 000-0000) auf der Seite');
    f.check(/^Kundeninformationen\s*—\s*—$/.test(gs.block), 'Gast: Kundeninformationen neutral ("—"), keine fremden Daten', gs.block.slice(0, 60));
  } catch (e) {
    if (g) await f.shot(g, 'DEBUG_gast', true).catch(() => {});
    f.check(false, `Gast-Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 3).join(' | ')}`);
  }
  try {
    if (!c) c = await f.session('customer');
    const cs = await step3(c, 'kunde');
    const u = await readUser();
    const fullName = squash(`${u.firstName || ''} ${u.lastName || ''}`);
    f.check(/Schritt 3 von 5|3\/5/.test(cs.body), 'Kunde: Schritt 3 erreicht');
    f.check(!DEMO.test(cs.body), 'Kunde: keine Demo-Admin-Daten auf der Seite');
    f.check(cs.block.includes(fullName) && cs.block.includes(u.email), 'Kunde: Kundeninformationen zeigen eigenen Namen und eigene E-Mail', `Name=${cs.block.includes(fullName)} E-Mail=${cs.block.includes(u.email)}`);
  } catch (e) {
    if (c) await f.shot(c, 'DEBUG_kunde_neworder', true).catch(() => {});
    f.check(false, `Kunden-Ablauf (new-order) abgebrochen: ${String(e.message).split('\n').slice(0, 3).join(' | ')}`);
  }
  f.check(ngSize() === ng0, 'netguard_after.log unverändert', `${ng0} -> ${ngSize()} B`);
  await f.finish();
})();
