// Pruefung der Nachbesserungen: stornierter Auftrag mit laufender Inspektion -> Daten nur lesend,
// keine Erfassung; Inspektionsseite gesperrt; Zahlungswort; offener Auftrag weiterhin mit Aktion.
const { makeFlow } = require('./flowlib');
const mongoose = require('/home/adar/Projects/FixitHub/server/node_modules/mongoose');
(async () => {
  const f = makeFlow('check_orch_cancelled'); await f.start();
  try {
    const c = await mongoose.createConnection('mongodb://127.0.0.1:27099/e2e_after').asPromise();
    const insp = await c.collection('deviceinspections').find({ status: 'in-progress' }).toArray();
    let cancelled = null; let open = null;
    for (const i of insp) {
      const o = await c.collection('orders').findOne({ _id: i.orderId });
      if (o && o.status === 'cancelled' && !cancelled) cancelled = o;
      if (o && !['cancelled', 'completed'].includes(o.status) && !open) open = o;
    }
    await c.close();
    f.note(`   Testdaten: stornierter Auftrag ${cancelled?.orderNumber}, offener Auftrag ${open?.orderNumber} (beide mit laufender Inspektion)`);
    const a = await f.session('admin');
    let posts = 0;
    a.on('request', (r) => { if (r.method() !== 'GET' && /device-inspections/.test(r.url())) posts += 1; });
    await f.goto(a, `/orders/${cancelled._id}`, 4000);
    const card = a.locator('#order-device-inspection');
    await card.scrollIntoViewIfNeeded();
    const cardText = (await card.innerText()).replace(/\s+/g, ' ');
    f.check(/Erfasste Inspektionsdaten \(nur lesen\)/.test(cardText) && /Auftrag storniert – Inspektion gesperrt/.test(cardText), 'Storniert: Karte zeigt erfasste Daten nur lesend mit Begruendung', cardText.slice(0, 160));
    f.check(!/Fortfahren|fortfahren/.test(cardText), 'Storniert: kein "Fortfahren"-Hinweis/Knopf auf der Karte');
    await f.shot(a, 'storniert_karte_nur_lesen', true);
    const header = (await a.locator('main').innerText()).replace(/\s+/g, ' ');
    f.check(!/Zahlung\s*Offen\s*Gesamt/.test(header) && !/Storniert – keine Zahlung offen Gesamt \(brutto\) [\d.,]+ € · Zahlungsstand/.test(header), 'Zahlungswort widerspricht nicht den angezeigten Zahlen', (header.match(/Zahlung .{0,120}/) || [''])[0]);
    await f.goto(a, `/inspection/${cancelled._id}`, 4000);
    const page = (await a.locator('main').innerText().catch(() => a.locator('body').innerText())).replace(/\s+/g, ' ');
    f.check(/Auftrag storniert – Inspektion gesperrt/.test(page), 'Inspektionsseite: Hinweis "Auftrag storniert – Inspektion gesperrt"');
    f.check(await a.getByRole('button', { name: /Speichern & Weiter/ }).count() === 0, 'Inspektionsseite: kein "Speichern & Weiter" bei storniertem Auftrag');
    f.check(posts === 0, 'keine schreibende Inspektionsanfrage (kein init/save) beim Oeffnen', posts);
    f.check(await a.getByRole('button', { name: /Prüfbericht erstellen/ }).count() === 0, 'Inspektionsseite: kein "Prüfbericht erstellen" in der Kopfzeile bei storniertem Auftrag');
    const badge = await a.evaluate(() => { const el = Array.from(document.querySelectorAll('span,div')).find((n) => n.textContent.trim() === 'In Bearbeitung' && n.className && /text-white/.test(n.className)); return el ? getComputedStyle(el).color : null; });
    f.check(!!badge, 'Status-Badge im dunklen Kopf hell (lesbar)', badge);
    await f.shot(a, 'storniert_inspektionsseite', true);
    await f.goto(a, `/orders/${open._id}`, 4000);
    const openCard = (await a.locator('#order-device-inspection').innerText()).replace(/\s+/g, ' ');
    f.check(/fortfahren|fortsetzen/i.test(openCard) && !/nur lesen/.test(openCard), 'offener Auftrag: Inspektion kann fortgesetzt werden', openCard.slice(0, 120));
  } catch (e) { f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n')[0]}`); }
  await f.finish();
})();
