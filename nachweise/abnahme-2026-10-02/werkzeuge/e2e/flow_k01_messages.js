// K01/K03: Kunde schreibt im Auftrag -> Admin findet das Gespraech im zentralen Postfach (Suche, Ungelesen,
// Antwort ausstehend) -> antwortet "An Kunden" + speichert eine interne Notiz -> Kunde sieht die Antwort
// (Postfach + Auftrag), aber NICHT die interne Notiz. Alles ueber die echte Oberflaeche.
const fs = require('fs');
const path = require('path');
const { makeFlow, apiLogin, api } = require('./flowlib');
const sc = JSON.parse(fs.readFileSync(path.join(__dirname, 'scenario.e2e_after.json'), 'utf8'));
const order = sc.orders[1]; // iPad, ORD-2026-002
const stamp = Date.now().toString().slice(-6);
const CUSTOMER_TEXT = `E2E-Kundenfrage ${stamp}: Ist das Display schon bestellt?`;
const STAFF_TEXT = `E2E-Antwort ${stamp}: Ja, das Display ist bestellt.`;
const INTERNAL_TEXT = `E2E-Intern ${stamp}: Lieferant B, nicht an Kunden.`;

(async () => {
  const f = makeFlow('k01_messages'); await f.start();
  try {
    // 1) Kunde schreibt im Auftrag
    const cust = await f.session('customer');
    await f.goto(cust, `/orders/${order.id}`, 3000);
    await cust.getByPlaceholder('Ihre Nachricht an das Reparaturteam …').fill(CUSTOMER_TEXT);
    await f.shot(cust, 'kunde_schreibt_im_auftrag');
    await cust.getByRole('button', { name: 'Nachricht senden' }).click();
    await cust.waitForTimeout(2000);
    f.check(await cust.getByText(CUSTOMER_TEXT).count() > 0, 'Kundennachricht erscheint sofort im Auftragsverlauf');
    // Doppelklick-Schutz: genau eine Nachricht in der DB
    const adminApi = await apiLogin('admin');
    let thread = await api(adminApi, 'GET', `/api/inspection-communication/${order.id}`);
    const msgs = (thread.data?.messages || thread.data?.communication?.messages || thread.data?.data?.messages || []);
    f.check(msgs.filter((m) => m.content === CUSTOMER_TEXT).length === 1, 'genau EINE gespeicherte Nachricht (kein Duplikat)', msgs.filter((m) => m.content === CUSTOMER_TEXT).length);

    // 2) Admin: zentrales Postfach, Ungelesen + Antwort ausstehend, Suche nach Auftragsnummer
    const adm = await f.session('admin');
    await f.goto(adm, '/messages', 3000);
    const unreadBtn = adm.getByRole('button', { name: /^Ungelesen \(\d+\)$/ });
    const unreadLabel = await unreadBtn.textContent();
    f.check(/Ungelesen \([1-9]\d*\)/.test(unreadLabel || ''), 'Admin: Ungelesen-Zaehler > 0 nach Kundennachricht', unreadLabel);
    await adm.getByPlaceholder(/Auftrags-, Buchungs-/).fill(order.orderNumber);
    await adm.waitForTimeout(2000);
    const row = adm.getByRole('button', { name: new RegExp(`Auftrag ${order.orderNumber}`) }).first();
    f.check(await row.count() > 0, `Suche nach ${order.orderNumber} findet das Gespraech`);
    await f.shot(adm, 'admin_postfach_suche');
    await row.click();
    await adm.waitForTimeout(2500);
    f.check(await adm.getByText(CUSTOMER_TEXT).count() > 0, 'Gespraech oeffnet mit einem Klick und zeigt die Kundennachricht');
    await f.shot(adm, 'admin_gespraech_offen');

    // 3) Admin antwortet "An Kunden"
    const controls = await adm.evaluate(() => Array.from(document.querySelectorAll('button')).map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim()).filter(Boolean));
    f.note(`   Admin-Composer-Buttons: ${controls.filter((t) => /Kunden|Intern|Notiz|senden|Rückfrage|Aktion|Entwurf/i.test(t)).join(' | ')}`);
    const composer = adm.getByPlaceholder('Nachricht an den Kunden …');
    await composer.fill(STAFF_TEXT);
    await f.shot(adm, 'admin_antwort_an_kunden');
    await adm.getByRole('button', { name: /Nachricht an Kunden senden/ }).first().click();
    await adm.waitForTimeout(2500);
    f.check(await adm.getByText(STAFF_TEXT).count() > 0, 'Admin-Antwort erscheint im Gespraech');

    // 4) Admin speichert eine interne Notiz (Modus wechseln)
    const internalToggle = adm.getByRole('radio', { name: /Interne Notiz/ }).first();
    if (await internalToggle.count()) {
      await internalToggle.click();
      await adm.waitForTimeout(500);
      const noteBox = adm.getByPlaceholder('Notiz für das Team …');
      if (await noteBox.count()) {
        await noteBox.fill(INTERNAL_TEXT);
        await f.shot(adm, 'admin_interne_notiz');
        await adm.getByRole('button', { name: /Interne Notiz speichern/ }).first().click();
        await adm.waitForTimeout(2000);
        f.check(await adm.getByText(INTERNAL_TEXT).count() > 0, 'interne Notiz fuer das Team sichtbar (Badge Intern)');
      } else f.check(false, 'Feld fuer interne Notiz gefunden');
    } else f.check(false, 'Umschalter "Interne Notiz" im Composer vorhanden');
    const awaiting = await adm.getByRole('button', { name: /^Antwort ausstehend \(\d+\)$/ }).textContent();
    f.note(`   Antwort ausstehend nach Antwort: ${awaiting}`);

    // 5) Kunde: Postfach + Auftrag zeigen die Antwort, NICHT die interne Notiz
    await f.goto(cust, '/messages', 3000);
    await f.shot(cust, 'kunde_postfach_liste');
    const custRow = cust.getByRole('button', { name: new RegExp(`Auftrag ${order.orderNumber}`) }).first();
    f.check(await custRow.count() > 0, 'Kunde: Gespraech im zentralen Postfach sichtbar (vorher "Kein Feedback vorhanden")');
    await custRow.click();
    await cust.waitForTimeout(2500);
    f.check(await cust.getByText(STAFF_TEXT).count() > 0, 'Kunde sieht die Antwort im Postfach');
    f.check(await cust.getByText(INTERNAL_TEXT).count() === 0, 'Kunde sieht die interne Notiz NICHT (UI)');
    await f.shot(cust, 'kunde_postfach_antwort');
    await f.goto(cust, `/orders/${order.id}`, 3000);
    f.check(await cust.getByText(STAFF_TEXT).count() > 0, 'derselbe Verlauf im Auftrag');
    f.check(await cust.getByText(INTERNAL_TEXT).count() === 0, 'interne Notiz auch im Auftrag unsichtbar');
    // API-Gegenprobe (Kunden-Token): keine interne Notiz in der Antwort
    const custApi = await apiLogin('customer');
    const raw = JSON.stringify((await api(custApi, 'GET', `/api/inspection-communication/${order.id}`)).data);
    f.check(!raw.includes(INTERNAL_TEXT), 'Kunden-API liefert die interne Notiz nicht');
    const inbox = JSON.stringify((await api(custApi, 'GET', '/api/communications/inbox?limit=50')).data);
    f.check(!inbox.includes(INTERNAL_TEXT), 'Kunden-Postfach-API liefert die interne Notiz nicht');
    // Fremder Kunde: kein Zugriff
    const other = await apiLogin('other');
    const foreign = await api(other, 'GET', `/api/inspection-communication/${order.id}`);
    f.check(foreign.status === 403, 'fremder Kunde: 403 auf das Gespraech', foreign.status);
    // Dashboard-Zaehler (Admin) kommt aus derselben Regel
    const summary = await api(adminApi, 'GET', '/api/communications/summary');
    f.note(`   Admin-Summary: ${JSON.stringify(summary.data).slice(0, 300)}`);
  } catch (e) {
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n')[0]}`);
  }
  await f.finish();
})();
