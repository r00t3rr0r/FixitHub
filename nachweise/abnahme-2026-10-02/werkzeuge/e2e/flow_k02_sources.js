// K02: Reklamations- und Reparaturanfrage-Gespraeche (Mitglied + Gast) sind im zentralen Postfach ueber den
// Quellenfilter erreichbar, Antworten gehen an den richtigen Datensatz, Kunde/Gast sieht sie. Echte Oberflaeche.
const { makeFlow, apiLogin, api } = require('./flowlib');
const stamp = Date.now().toString().slice(-6);

async function openSource(f, adm, sourceLabel, rowRegex) {
  await f.goto(adm, '/messages', 3000);
  await adm.getByRole('button', { name: sourceLabel, exact: true }).click();
  await adm.waitForTimeout(2000);
  const row = adm.getByRole('button', { name: rowRegex }).first();
  return row;
}
async function staffReply(adm, text) {
  const box = adm.locator('textarea:visible[placeholder="Nachricht an den Kunden …"]').first();
  await box.waitFor({ state: 'visible', timeout: 20000 });
  await box.fill(text);
  await adm.getByRole('button', { name: /Nachricht an Kunden senden/ }).first().click();
  await adm.waitForTimeout(2500);
}

(async () => {
  const f = makeFlow('k02_sources'); await f.start();
  try {
    const adm = await f.session('admin');
    const cust = await f.session('customer');
    const custApi = await apiLogin('customer');

    // ---- A) Reklamation ----
    const CUST_C = `E2E-Reklamation ${stamp}: Display flackert wieder.`;
    const STAFF_C = `E2E-Antwort Reklamation ${stamp}: Bitte senden Sie das Gerät ein.`;
    await f.goto(cust, '/my-complaints', 3000);
    await cust.getByText(/Reklamation f(ue|ü)r Auftrag/).first().click();
    await cust.waitForTimeout(1500);
    await cust.getByPlaceholder('Nachricht schreiben…').fill(CUST_C);
    await cust.getByRole('button', { name: 'Senden', exact: true }).click();
    await cust.waitForTimeout(2000);
    f.check(await cust.getByText(CUST_C).count() > 0, 'Reklamation: Kundennachricht im Reklamationsdialog sichtbar');
    await f.shot(cust, 'kunde_reklamation_nachricht');

    let row = await openSource(f, adm, 'Reklamationen', /^Reklamation\s*Reklamation /);
    f.check(await row.count() > 0, 'Admin: Filter "Reklamationen" zeigt das Reklamationsgespraech');
    await row.click();
    try { await adm.getByRole('button', { name: /Nachricht an Kunden senden/ }).first().waitFor({ timeout: 20000 }); }
    catch (e) { await f.shot(adm, 'DEBUG_reklamation_nicht_geoeffnet'); f.note('   URL ' + adm.url()); throw e; }
    f.check(await adm.locator('textarea:visible').count() > 0 && await adm.getByText(CUST_C).count() >= 1, 'Admin: Reklamationsgespraech geoeffnet, Nachricht lesbar', await adm.getByText(CUST_C).count());
    await f.shot(adm, 'admin_reklamation_im_postfach');
    await staffReply(adm, STAFF_C);
    f.check(await adm.getByText(STAFF_C).count() > 0, 'Admin: Antwort an Kunden im Reklamationsgespraech');
    // Gegenprobe Datenbankziel: Antwort steht an der Reklamation (nicht in einem anderen Speicher)
    const myC = await api(custApi, 'GET', '/api/complaints/my');
    const list = myC.data?.complaints || myC.data?.data || myC.data || [];
    const cmt = JSON.stringify(list);
    f.check(cmt.includes(STAFF_C), 'Antwort ist an der Reklamation gespeichert (GET /api/complaints/my)');
    await f.goto(cust, '/my-complaints', 3000);
    await cust.getByText(/Reklamation f(ue|ü)r Auftrag/).first().click();
    await cust.waitForTimeout(1500);
    f.check(await cust.getByText(STAFF_C).count() > 0, 'Kunde sieht die Antwort im Reklamationsdialog');

    // ---- B) Reparaturanfrage eines Mitglieds ----
    const created = await api(custApi, 'POST', '/api/repair-requests', {
      deviceSource: 'manual', deviceType: 'Smartphone', deviceBrand: 'Fairphone', deviceModel: 'Fairphone 4',
      issueDescription: `E2E Anfrage ${stamp}: Kamera unscharf`,
    });
    f.check(created.status === 201, 'Mitglied: Reparaturanfrage (manuelles Geraet) angelegt', `${created.status} ${created.data?.error || ''}`);
    const rr = created.data?.request || {};
    const CUST_R = `E2E-Frage Anfrage ${stamp}: Wie lange dauert das?`;
    const STAFF_R = `E2E-Antwort Anfrage ${stamp}: Etwa drei Werktage.`;
    await f.goto(cust, `/my-repair-requests?requestId=${rr._id || rr.id}`, 3000);
    await f.shot(cust, 'kunde_reparaturanfrage', true);
    const rrBox = cust.locator('textarea').first();
    if (await rrBox.count()) {
      await rrBox.fill(CUST_R);
      const sendBtn = cust.getByRole('button', { name: /senden/i }).first();
      await sendBtn.click(); await cust.waitForTimeout(2000);
      f.check(await cust.getByText(CUST_R).count() > 0, 'Mitglied: Nachricht zur Reparaturanfrage gesendet');
    } else f.check(false, 'Mitglied: Nachrichtenfeld in "Meine Reparaturanfragen" gefunden');
    row = await openSource(f, adm, 'Reparaturanfragen', new RegExp(rr.requestNumber || 'Reparaturanfrage'));
    f.check(await row.count() > 0, `Admin: Filter "Reparaturanfragen" zeigt ${rr.requestNumber}`);
    await row.click();
    await adm.getByRole('button', { name: /Nachricht an Kunden senden/ }).first().waitFor({ timeout: 20000 });
    f.check(await adm.getByText(CUST_R).count() >= 1, 'Admin: Anfrage-Nachricht im geoeffneten Gespraech lesbar');
    await staffReply(adm, STAFF_R);
    f.check(await adm.getByText(STAFF_R).count() > 0, 'Admin: Antwort zur Reparaturanfrage gesendet');
    await f.shot(adm, 'admin_reparaturanfrage_im_postfach');
    await f.goto(cust, `/my-repair-requests?requestId=${rr._id || rr.id}`, 3000);
    f.check(await cust.getByText(STAFF_R).count() > 0, 'Mitglied sieht die Antwort in "Meine Reparaturanfragen"');

    // ---- C) Gast-Reparaturanfrage ----
    const g = await api(null, 'POST', '/api/repair-requests/guest', {
      guestInfo: { firstName: 'Gerd', lastName: 'Gast', email: `gast${stamp}@e2e.invalid`, phone: '+49 30 3333333' },
      deviceSource: 'manual', deviceType: 'Tablet', deviceBrand: 'Lenovo', deviceModel: 'Tab P11', issueDescription: `E2E Gast ${stamp}: Ladebuchse lose`,
    });
    f.check(g.status === 201 && g.data?.guestTrackingToken, 'Gast: Anfrage angelegt, Tracking-Token erhalten', g.status);
    const guest = await f.session('guest');
    await f.goto(guest, `/guest-repair-tracking?token=${encodeURIComponent(g.data.guestTrackingToken)}&email=${encodeURIComponent(`gast${stamp}@e2e.invalid`)}`, 3500);
    await f.shot(guest, 'gast_tracking', true);
    const GUEST_T = `E2E-Gast ${stamp}: Gibt es einen Kostenvoranschlag?`;
    const gBox = guest.locator('textarea').first();
    if (await gBox.count()) {
      await gBox.fill(GUEST_T);
      await guest.getByRole('button', { name: /senden/i }).first().click(); await guest.waitForTimeout(2000);
      f.check(await guest.getByText(GUEST_T).count() > 0, 'Gast: Nachricht auf der Tracking-Seite gesendet');
    } else f.check(false, 'Gast: Nachrichtenfeld auf der Tracking-Seite gefunden');
    row = await openSource(f, adm, 'Reparaturanfragen', new RegExp(g.data.requestNumber));
    f.check(await row.count() > 0, `Admin: Gast-Anfrage ${g.data.requestNumber} im Postfach`);
    await row.click();
    await adm.getByRole('button', { name: /Nachricht an Kunden senden/ }).first().waitFor({ timeout: 20000 });
    f.check(await adm.getByText(GUEST_T).count() >= 1, 'Admin: Gast-Nachricht im geoeffneten Gespraech lesbar');
    const STAFF_G = `E2E-Antwort Gast ${stamp}: Wir melden uns mit einem Angebot.`;
    await staffReply(adm, STAFF_G);
    await guest.reload({ waitUntil: 'domcontentloaded' }); await guest.waitForTimeout(3000);
    f.check(await guest.getByText(STAFF_G).count() > 0, 'Gast sieht die Antwort auf der Tracking-Seite');
    // Gast-Token gilt nur fuer die eigene Anfrage
    const other = await api(null, 'GET', `/api/repair-requests/guest/${rr._id || rr.id}/communication?token=${encodeURIComponent(g.data.guestTrackingToken)}&email=${encodeURIComponent(`gast${stamp}@e2e.invalid`)}`);
    f.check(other.status === 403 || other.status === 404, 'Gast-Token oeffnet KEINE fremde Anfrage', other.status);
  } catch (e) {
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n')[0]}`);
  }
  await f.finish();
})();
