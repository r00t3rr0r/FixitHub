// K07: Gast-Reparaturanfrage -> Kostenvoranschlag als Entwurf (keine Mail) -> "an Kunden senden" (genau EINE Mail
// im Test-Postfach mit Betrag, Beschreibung und Gast-Link) -> erneutes Speichern sendet nicht doppelt -> Gast oeffnet
// den Link aus der Mail, sieht den Kostenvoranschlag und nimmt ihn strukturiert an -> Admin sieht "angenommen".
const fs = require('fs'); const path = require('path');
const { makeFlow, apiLogin, api, S } = require('./flowlib');
const MAILBOX = path.join(S, 'mailbox');
const stamp = Date.now().toString().slice(-6);
const EMAIL = `angebot${stamp}@e2e.invalid`;

function decodeEml(raw) {
  // minimaler MIME-Leser: alle Teile, quoted-printable / base64 dekodiert
  const parts = raw.split(/\r?\n--[^\r\n]+/);
  let text = '';
  for (const p of parts) {
    const [head, ...bodyArr] = p.split(/\r?\n\r?\n/);
    let body = bodyArr.join('\n\n');
    if (/content-transfer-encoding:\s*base64/i.test(head)) body = Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
    else if (/content-transfer-encoding:\s*quoted-printable/i.test(head)) body = Buffer.from(body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8');
    text += `\n${head}\n${body}`;
  }
  return text;
}
const mailsTo = (addr) => (fs.existsSync(MAILBOX) ? fs.readdirSync(MAILBOX) : []).filter((n) => n.includes(addr.replace(/[^a-z0-9@._-]/gi, '_'))).sort()
  .map((n) => ({ name: n, text: decodeEml(fs.readFileSync(path.join(MAILBOX, n), 'utf8')) }));

(async () => {
  const f = makeFlow('k07_guest_quote'); await f.start();
  let adm;
  try {
    const g = await api(null, 'POST', '/api/repair-requests/guest', {
      guestInfo: { firstName: 'Greta', lastName: 'Gast', email: EMAIL, phone: '+49 30 6666666' },
      deviceSource: 'manual', deviceType: 'Smartphone', deviceBrand: 'Nothing', deviceModel: 'Phone (2)', issueDescription: `E2E Angebot ${stamp}: Display gesprungen`,
    });
    f.check(g.status === 201, 'Gast-Anfrage mit manuellem Geraet angelegt', `${g.status} ${g.data?.requestNumber}`);
    const rrNo = g.data.requestNumber;
    await new Promise((r) => setTimeout(r, 4000)); // Bestaetigungsmail wird nach der Antwort asynchron versendet
    const mails0 = mailsTo(EMAIL);
    f.note(`   Mails an Gast nach Anlage: ${mails0.length} (${mails0.map((m) => (m.text.match(/^Subject: (.*)$/mi) || [])[1]).join(' | ')})`);

    adm = await f.session('admin');
    await f.goto(adm, '/admin/repair-requests', 3000);
    await adm.getByLabel('Reparaturanfragen durchsuchen').fill(rrNo);
    await adm.waitForTimeout(2000);
    await adm.getByRole('button', { name: 'Öffnen' }).first().click();
    await adm.waitForTimeout(2500);
    f.check(await adm.getByText(rrNo).count() > 0, `Details von ${rrNo} geoeffnet`);
    f.check(await adm.getByText(/Nothing/).count() > 0 && await adm.getByText(/Phone \(2\)/).count() > 0, 'manuell angegebenes Geraet (Erstangabe) sichtbar');
    await adm.getByPlaceholder('z. B. 89,00').fill('89,00');
    await adm.getByPlaceholder(/z\. B\. Displaytausch/).fill('Displaytausch inkl. Ersatzteil, 12 Monate Garantie');
    await adm.getByRole('button', { name: 'Entwurf speichern' }).click();
    await adm.waitForTimeout(2500);
    await f.shot(adm, 'admin_angebot_entwurf');
    const afterDraft = mailsTo(EMAIL).length;
    f.check(afterDraft === mails0.length, 'Entwurf speichern sendet KEINE Mail', `${mails0.length} -> ${afterDraft}`);
    const guestView0 = await api(null, 'GET', `/api/repair-requests/guest/track?token=${encodeURIComponent(g.data.guestTrackingToken)}&email=${encodeURIComponent(EMAIL)}`);
    const gv = JSON.stringify(guestView0.data);
    f.check(!gv.includes('Displaytausch inkl. Ersatzteil') && !/"amount":89\b|"estimatedCost":89\b/.test(gv), 'Entwurf (Betrag + Beschreibung) ist fuer den Gast noch NICHT sichtbar');

    await adm.getByRole('button', { name: 'Kostenvoranschlag an Kunden senden' }).click();
    await adm.waitForTimeout(1200);
    const confirm = adm.getByRole('alertdialog').or(adm.getByRole('dialog').filter({ hasText: /senden\?|Bestätig/i }));
    if (await confirm.count()) {
      await f.shot(adm, 'admin_angebot_bestaetigen');
      await confirm.getByRole('button', { name: /senden|Bestätigen|Ja/i }).last().click();
    }
    await adm.waitForTimeout(3500);
    await f.shot(adm, 'admin_angebot_gesendet');
    await new Promise((r) => setTimeout(r, 2500));
    let mails = mailsTo(EMAIL);
    const quoteMails = mails.slice(mails0.length);
    f.check(quoteMails.length === 1, 'Senden erzeugt genau EINE Mail an die Gast-Adresse', quoteMails.length);
    const m = quoteMails[0]?.text || '';
    const subject = (m.match(/^Subject: (.*)$/mi) || [])[1] || '';
    f.check(/89,00\s?€|89,00&nbsp;€|89,00 EUR/.test(m), 'Mail enthaelt den Betrag 89,00 €', subject);
    f.check(/Displaytausch inkl\. Ersatzteil/.test(m), 'Mail enthaelt die Beschreibung');
    const link = (m.match(/https?:\/\/[^\s"'<>]+guest-repair-tracking[^\s"'<>]*/) || m.match(/(\/guest-repair-tracking[^\s"'<>]*)/) || [])[0];
    f.check(!!link, 'Mail enthaelt einen Gast-Link zur Anfrage', link ? link.slice(0, 120) : '');
    // erneutes Speichern / Senden-Doppelklick -> keine zweite Mail
    await adm.getByRole('button', { name: 'Entwurf speichern' }).click().catch(() => {});
    await adm.waitForTimeout(2000);
    mails = mailsTo(EMAIL);
    f.check(mails.length - mails0.length === 1, 'erneutes Speichern sendet nicht doppelt', mails.length - mails0.length);

    // Gast oeffnet den Link aus der Mail
    const guest = await f.session('guest');
    const rel = link.replace(/^https?:\/\/[^/]+/, '').replace(/&amp;/g, '&');
    await f.goto(guest, rel, 4000);
    await f.shot(guest, 'gast_link_aus_mail', true);
    f.check(await guest.getByText(/89,00/).count() > 0, 'Gast sieht den Kostenvoranschlag ueber den Mail-Link');
    const accept = guest.getByRole('button', { name: /annehmen|Annehmen|akzeptieren/ }).first();
    f.check(await accept.count() > 0, 'strukturierte Antwort "Annehmen" angeboten');
    await accept.click(); await guest.waitForTimeout(1500);
    const conf2 = guest.getByRole('alertdialog').or(guest.getByRole('dialog'));
    if (await conf2.count()) await conf2.getByRole('button', { name: /annehmen|Bestätigen|Ja/i }).last().click().catch(() => {});
    await guest.waitForTimeout(3000);
    await f.shot(guest, 'gast_angenommen', true);
    f.check(await guest.getByText(/angenommen/i).count() > 0, 'Gast sieht "angenommen"');
    // Admin-Sicht
    const a = await apiLogin('admin');
    const list = await api(a, 'GET', `/api/repair-requests?search=${encodeURIComponent(rrNo)}`);
    const req = (list.data.requests || [])[0] || {};
    f.check(req.status === 'approved' && (req.quote?.status === 'accepted' || /accept/.test(JSON.stringify(req.quote || {}))), 'Admin: Status "Kostenvoranschlag angenommen" (approved, quote accepted)', `${req.status} ${JSON.stringify(req.quote || {}).slice(0, 160)}`);
    // Gast-Token oeffnet keine fremde Anfrage, fremde E-Mail wird abgelehnt
    const wrong = await api(null, 'GET', `/api/repair-requests/guest/track?token=${encodeURIComponent(g.data.guestTrackingToken)}&email=${encodeURIComponent('falsch@e2e.invalid')}`);
    f.check([403, 404].includes(wrong.status), 'Token mit falscher E-Mail: kein Zugriff', wrong.status);
  } catch (e) {
    if (adm) await f.shot(adm, 'DEBUG_abbruch', true).catch(() => {});
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 2).join(' | ')}`);
  }
  await f.finish();
})();
