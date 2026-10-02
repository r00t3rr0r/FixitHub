// cUi Fixwave-Check (nur lesend, keine Speicheraktionen):
//  K09-CANCELLED: storniertes Auftrag (Workflow pausiert) -> Hinweis im Reparatur-Workflow-Dialog, Schrittaktionen gesperrt;
//                 Gegenprobe: offener Auftrag -> kein Hinweis.
//  K09-CSS:       Statusbadge im Auftragskopf ohne text-transform: capitalize (deutscher Text unveraendert).
//  K06-TEMPLATE:  /admin/workflow -> Visual Builder -> "Add Step": Benachrichtigungs-Block deutsch + "Vorbelegung – derzeit ohne Wirkung",
//                 Automation-Tab mit Hinweis und Aktion "Benachrichtigung senden (derzeit ohne Wirkung)". Dialog wird ohne Speichern geschlossen.
const { makeFlow } = require('./flowlib');
const mongoose = require('/home/adar/Projects/FixitHub/server/node_modules/mongoose');

const DB = 'mongodb://127.0.0.1:27099/e2e_after';

(async () => {
  const f = makeFlow('fixwave_cUi'); await f.start();
  try {
    await mongoose.connect(DB);
    const db = mongoose.connection.db;
    const wfs = await db.collection('repairworkflows').find({}).project({ orderId: 1, status: 1 }).toArray();
    const orders = await db.collection('orders').find({ _id: { $in: wfs.map((w) => w.orderId) } }).project({ status: 1, orderNumber: 1 }).toArray();
    const wfOf = (o) => wfs.find((w) => String(w.orderId) === String(o._id));
    const cancelled = orders.reverse().find((o) => o.status === 'cancelled' && wfOf(o)?.status === 'paused');
    const open = orders.find((o) => o.status === 'in-progress' && wfOf(o)?.status === 'in-progress');
    const ready = orders.find((o) => o.status === 'ready-for-pickup');
    f.note(`   Testdaten: storniert ${cancelled?.orderNumber}, offen ${open?.orderNumber}, bereit ${ready?.orderNumber}`);
    const wfBefore = await db.collection('repairworkflows').findOne({ orderId: cancelled._id });

    const a = await f.session('admin');
    const rw = () => a.getByRole('dialog').filter({ has: a.getByRole('heading', { name: 'Reparatur-Workflow' }) }).last();

    // K09-CANCELLED
    await f.goto(a, `/orders/${cancelled._id}`, 5000);
    const openBtn = a.locator('#order-workflows').getByRole('button', { name: 'Öffnen' }).first();
    await openBtn.waitFor({ timeout: 20000 });
    await openBtn.click();
    await rw().waitFor({ timeout: 15000 });
    await a.waitForTimeout(800);
    const notice = rw().getByTestId('repair-workflow-cancelled-notice');
    const noticeText = (await notice.count()) ? (await notice.innerText()).trim() : '';
    f.check(noticeText === 'Auftrag storniert – Arbeitsschritte sind gesperrt. Zum Fortsetzen muss ein Admin die Stornierung aufheben.', 'Storniert: Hinweis im Dialog sichtbar', noticeText || '(fehlt)');
    const resume = rw().getByRole('button', { name: 'Fortsetzen', exact: true });
    const complete = rw().getByRole('button', { name: /Reparatur abschließen/ });
    const incident = rw().getByRole('button', { name: /Zwischenfall melden/ });
    const pause = rw().getByRole('button', { name: /Workflow pausieren/ });
    const st = async (loc) => ((await loc.count()) ? (await loc.first().isDisabled() ? 'disabled' : 'ENABLED') : 'absent');
    const states = { resume: await st(resume), complete: await st(complete), incident: await st(incident), pause: await st(pause) };
    f.check(Object.values(states).every((s) => s !== 'ENABLED') && states.resume === 'disabled' && states.complete === 'disabled', 'Storniert: Fortsetzen / Reparatur abschließen / Zwischenfall / Pausieren gesperrt', JSON.stringify(states));
    await f.shot(a, 'K09_cancelled_dialog');
    // Klick auf gesperrten Button darf nichts ausloesen
    await resume.first().click({ force: true, timeout: 3000 }).catch(() => {});
    await a.waitForTimeout(1200);
    const wfAfter = await db.collection('repairworkflows').findOne({ orderId: cancelled._id });
    f.check(wfAfter.status === wfBefore.status && String(wfAfter.updatedAt) === String(wfBefore.updatedAt), 'Storniert: Workflow unveraendert (keine Anfrage)', `${wfBefore.status} -> ${wfAfter.status}`);
    await a.keyboard.press('Escape').catch(() => {});
    await a.waitForTimeout(600);

    // Gegenprobe offener Auftrag
    await f.goto(a, `/orders/${open._id}`, 5000);
    const openBtn2 = a.locator('#order-workflows').getByRole('button', { name: 'Öffnen' }).first();
    await openBtn2.waitFor({ timeout: 20000 });
    await openBtn2.click();
    await rw().waitFor({ timeout: 15000 });
    await a.waitForTimeout(800);
    f.check((await rw().getByTestId('repair-workflow-cancelled-notice').count()) === 0, 'Offener Auftrag: kein Storno-Hinweis');
    const st2 = { complete: await st(rw().getByRole('button', { name: /Reparatur abschließen/ })), incident: await st(rw().getByRole('button', { name: /Zwischenfall melden/ })) };
    f.check(st2.complete === 'ENABLED' && st2.incident === 'ENABLED', 'Offener Auftrag: Schrittaktionen weiterhin bedienbar', JSON.stringify(st2));
    await a.keyboard.press('Escape').catch(() => {});
    await a.waitForTimeout(600);

    // K09-CSS (Kundenansicht: Badge sitzt im Kundenkopf). Eigener Kontext mit der gespeicherten Sitzung des
    // K09-Testkunden (Datei wird nur gelesen, nie geloescht; kein Login).
    {
      const { chromium } = require('/home/adar/Projects/FixitHub/node_modules/playwright');
      const br = await chromium.launch({ headless: true, executablePath: '/home/adar/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell' });
      const ctx = await br.newContext({ viewport: { width: 1366, height: 768 }, locale: 'de-DE', storageState: require('path').join(__dirname, 'state_k09kunde.json') });
      await ctx.route('**/*', (route) => { const u = new URL(route.request().url()); return ['127.0.0.1', 'localhost'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol) ? route.continue() : route.abort(); });
      const c = await ctx.newPage();
      await c.goto(`${require('./flowlib').BASE}/orders/${ready._id}`, { waitUntil: 'domcontentloaded' });
      await c.waitForTimeout(6000);
      f.check(!c.url().includes('/login'), 'K09-Testkunde: gespeicherte Sitzung gueltig', c.url().replace(/^https?:\/\/[^/]+/, ''));
      const badge = c.locator('.order-header-meta-block .order-status-badge').first();
      await badge.waitFor({ timeout: 15000 });
      const css = await badge.evaluate((el) => ({ tt: getComputedStyle(el).textTransform, text: el.innerText.trim() }));
      f.check(css.tt === 'none', 'Statusbadge: text-transform none', css.tt);
      f.check(!/ An Sie | Wird | Versand An/.test(css.text) && /\s[a-zäöü]/.test(css.text), 'Statusbadge zeigt deutschen Text unveraendert (kleingeschriebene Woerter bleiben klein)', css.text);
      const pay = await c.evaluate(() => Array.from(document.querySelectorAll('.payment-status-badge')).map((el) => getComputedStyle(el).textTransform));
      f.note(`   .payment-status-badge im DOM: ${pay.length} (${pay.join(',') || '-'})`);
      await f.shot(c, 'K09_css_status_badge');
      await ctx.close(); await br.close();
    }

    // K06-TEMPLATE
    await f.goto(a, '/admin/workflow', 5000);
    const vb = a.locator('button[title="Visual Builder"]').first();
    await vb.waitFor({ timeout: 20000 });
    await vb.click();
    await a.getByRole('button', { name: 'Add Step' }).first().waitFor({ timeout: 15000 });
    await a.getByRole('button', { name: 'Add Step' }).first().click();
    const sd = a.getByRole('dialog').filter({ has: a.getByRole('heading', { name: /Create New Step|Edit Step/ }) }).last();
    await sd.waitFor({ timeout: 15000 });
    const sdText = (await sd.innerText()).replace(/\s+/g, ' ');
    f.check(/Benachrichtigungen \(Vorlage\)/.test(sdText) && /Bei Start benachrichtigen/.test(sdText) && /Bei Abschluss benachrichtigen/.test(sdText) && /Bei Verzögerung benachrichtigen/.test(sdText), 'K06: Benachrichtigungs-Schalter deutsch beschriftet');
    f.check(!/Notify on (Start|Complete|Delay)|Notification Settings/.test(sdText), 'K06: keine englischen Notify-Beschriftungen mehr');
    const note1 = sd.getByTestId('step-notification-settings-note');
    f.check((await note1.count()) === 1 && /Vorbelegung – derzeit ohne Wirkung\. Ob der Kunde informiert wird, entscheidet der Schalter „Kunde informieren“ im jeweiligen Arbeitsschritt\./.test(await note1.innerText()), 'K06: Hinweis "Vorbelegung – derzeit ohne Wirkung" am Benachrichtigungsblock');
    await note1.scrollIntoViewIfNeeded().catch(() => {});
    await f.shot(a, 'K06_step_notification_note');
    await sd.getByRole('tab', { name: 'Automation' }).click();
    await a.waitForTimeout(600);
    const note2 = sd.getByTestId('step-automation-rules-note');
    f.check((await note2.count()) === 1 && /derzeit ohne Wirkung/.test(await note2.innerText()), 'K06: Automation-Tab mit Hinweis "derzeit ohne Wirkung"', (await note2.count()) ? (await note2.innerText()).slice(0, 120) : '(fehlt)');
    await f.shot(a, 'K06_automation_note');
    await a.keyboard.press('Escape').catch(() => {});
  } catch (e) {
    f.check(false, 'Ablauf ohne Ausnahme', String(e && e.message).slice(0, 300));
  } finally {
    await mongoose.disconnect().catch(() => {});
    await f.finish();
  }
})();
