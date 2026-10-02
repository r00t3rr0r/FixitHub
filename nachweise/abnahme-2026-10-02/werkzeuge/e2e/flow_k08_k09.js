// K08/K09: Statuswechsel mit Akteur/Zeit im "Verlauf"; Arbeitsablauf zuweisen; Pausieren mit Grund; Stornieren NUR
// mit Grund (OrderCancelDialog); nach Storno lehnt der SERVER weitere Workflow-/Statusschritte ab; Verlauf-Filter.
const fs = require('fs'); const path = require('path');
const { makeFlow, apiLogin, api, dumpControls } = require('./flowlib');
const mongoose = require('/home/adar/Projects/FixitHub/server/node_modules/mongoose');
// juengster offener Auftrag (z. B. aus dem Checkout-Ablauf K10) - jeder Lauf nutzt einen frischen Auftrag
let ID = fs.readFileSync(path.join(__dirname, 'order3.id'), 'utf8').trim();
async function pickFreshOrder() {
  const c = await mongoose.createConnection('mongodb://127.0.0.1:27099/e2e_after').asPromise();
  const o = await c.collection('orders').find({ status: 'pending' }).sort({ _id: -1 }).limit(1).next();
  await c.close();
  if (o) ID = String(o._id);
}

async function pickStatus(a, label) {
  await a.getByRole('button', { name: /^(Ausstehend|In Bearbeitung|Pausiert|Qualitätskontrolle|Reparatur abgeschlossen|Abgeschlossen|Storniert)$/ }).first().click();
  await a.waitForTimeout(600);
  await a.getByRole('menuitem', { name: new RegExp('^\\s*' + label + '\\s*$') }).first().click();
  await a.waitForTimeout(1200);
}
async function timelineCount(id) {
  const c = await mongoose.createConnection('mongodb://127.0.0.1:27099/e2e_after').asPromise();
  const o = await c.collection('orders').findOne({ _id: new mongoose.Types.ObjectId(id) });
  await c.close();
  return { n: (o.timeline || []).length, status: o.status, last: (o.timeline || []).slice(-1)[0] };
}

(async () => {
  const f = makeFlow('k08_k09'); await f.start();
  let a;
  try {
    await pickFreshOrder();
    f.note(`   Auftrag fuer diesen Lauf: ${ID}`);
    a = await f.session('admin');
    await f.goto(a, `/orders/${ID}`, 3500);
    const t0 = await timelineCount(ID);
    // 1) Statuswechsel Ausstehend -> In Bearbeitung
    await pickStatus(a, 'In Bearbeitung');
    const dlg1 = a.getByRole('dialog').or(a.getByRole('alertdialog'));
    if (await dlg1.count()) { f.note(`   Status-Dialog: ${(await dlg1.first().innerText()).replace(/\s+/g, ' ').slice(0, 200)}`); await dlg1.first().getByRole('button', { name: /Bestätigen|Speichern|Ändern|Übernehmen/ }).last().click().catch(() => {}); await a.waitForTimeout(1500); }
    let t1 = await timelineCount(ID);
    f.check(t1.status === 'in-progress' && t1.n > t0.n, 'Statuswechsel gespeichert + Verlaufseintrag', `${t0.status}->${t1.status} timeline ${t0.n}->${t1.n}`);
    f.check(t1.last && /Admin/.test(t1.last.staffName || '') && t1.last.completedAt, 'Eintrag mit Akteur und echter Zeit', `${t1.last?.staffName} ${t1.last?.completedAt}`);

    // 2) Arbeitsablauf zuweisen
    await a.getByRole('button', { name: 'Arbeitsablauf zuweisen' }).click(); await a.waitForTimeout(1500);
    const wd = a.getByRole('dialog').last();
    f.note(`   Workflow-Dialog: ${(await wd.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)}`);
    await wd.getByText('Standard Repair Process').first().click().catch(() => {});
    await a.waitForTimeout(500);
    await wd.getByRole('button', { name: /zuweisen|Zuweisen|Starten|Übernehmen/ }).last().click().catch((e) => f.note('   (Zuweisen-Button nicht gefunden: ' + e.message.split('\n')[0] + ')'));
    await a.waitForTimeout(2500);
    await f.shot(a, 'workflow_zugewiesen', true);
    f.note(`   Kontrollen nach Zuweisung: ${(await dumpControls(a)).filter((l) => /Workflow|Arbeitsablauf|Schritt|Pause|Fortsetzen|Starten|Abschließen/i.test(l)).slice(0, 15).join(' || ')}`);

    // 3) Pausieren mit Grund
    await pickStatus(a, 'Pausiert');
    const pd = a.getByRole('dialog').or(a.getByRole('alertdialog'));
    if (await pd.count()) {
      const ta = pd.first().locator('textarea, input[type="text"]').first();
      if (await ta.count()) await ta.fill('Warten auf Ersatzteil (E2E)');
      await pd.first().getByRole('button', { name: /Pausieren|Bestätigen|Speichern/ }).last().click().catch(() => {});
      await a.waitForTimeout(1500);
    }
    const t2 = await timelineCount(ID);
    f.check(t2.status === 'paused', 'Pausieren gespeichert', t2.status);
    f.note(`   letzter Eintrag: ${JSON.stringify(t2.last).slice(0, 300)}`);

    // 4) Stornieren: ohne Grund gesperrt, mit Grund gespeichert
    await pickStatus(a, 'Storniert');
    const cd = a.getByRole('dialog').or(a.getByRole('alertdialog')).first();
    f.check(await cd.count() > 0, 'Storno oeffnet den Dialog (OrderCancelDialog)');
    await f.shot(a, 'storno_dialog');
    const submit = cd.getByRole('button', { name: /stornieren/i }).last();
    f.check(await submit.isDisabled(), 'Stornieren ohne Grund gesperrt');
    await cd.locator('textarea').first().fill('Kunde hat die Reparatur telefonisch abgesagt (E2E).');
    await submit.click(); await a.waitForTimeout(2500);
    const t3 = await timelineCount(ID);
    f.check(t3.status === 'cancelled', 'Auftrag storniert', t3.status);
    f.check(/abgesagt/.test(JSON.stringify(t3.last)), 'Storno-Grund im Verlauf gespeichert', JSON.stringify(t3.last).slice(0, 200));
    await f.shot(a, 'nach_storno', true);

    // 5) Server-Gegenprobe: nach Storno keine Workflow-/Statusfortsetzung
    const adm = await apiLogin('admin');
    const r1 = await api(adm, 'PUT', `/api/orders/${ID}/status`, { status: 'in-progress' });
    f.check(r1.status === 409 && r1.data?.code === 'ORDER_CANCELLED', 'Statusmenue-Weg nach Storno vom Server abgelehnt (409)', `${r1.status} ${r1.data?.code}`);
    await a.getByRole('button', { name: /^Storniert$/ }).first().click(); await a.waitForTimeout(600);
    const menuTxt = (await a.getByRole('menu').innerText().catch(() => '')).replace(/\s+/g, ' ');
    f.check(/Stornierung aufheben/.test(menuTxt) && !/In Bearbeitung/.test(menuTxt), 'UI: stornierter Auftrag bietet nur "Stornierung aufheben" an', menuTxt.slice(0, 160));
    await a.keyboard.press('Escape');
    const c = await mongoose.createConnection('mongodb://127.0.0.1:27099/e2e_after').asPromise();
    const wf = await c.collection('repairworkflows').findOne({ orderId: new mongoose.Types.ObjectId(ID) });
    const inv = await c.collection('invoices').countDocuments({ orderId: new mongoose.Types.ObjectId(ID) });
    await c.close();
    if (wf) {
      const r2 = await api(adm, 'POST', `/api/repair-workflows/${wf._id}/resume`, {});
      f.check([400, 409].includes(r2.status), 'Workflow fortsetzen nach Storno vom Server abgelehnt', `${r2.status} ${JSON.stringify(r2.data).slice(0, 160)}`);
    } else f.note('   (kein RepairWorkflow-Dokument fuer den Auftrag - Template-Workflow-Pfad)');
    f.check(inv === 0, 'Storno erzeugt keine Rechnung/Stornorechnung automatisch', inv);

    // 6) Verlauf-Tab mit Filter
    await a.getByRole('tab', { name: 'Verlauf' }).click(); await a.waitForTimeout(2500);
    await f.shot(a, 'verlauf_alle', true);
    const chips = await a.getByRole('button').allTextContents();
    f.note(`   Verlauf-Filter: ${chips.filter((t) => /^(Alle|Status|Workflow|Gerät|Leistungen|Preis|Personal|Prüfung|Kommunikation|Zahlung|Rechnung|Versand|Notiz)/.test(t.trim())).join(' | ')}`);
    const statusChip = a.getByRole('button', { name: /^Status/ }).first();
    if (await statusChip.count()) {
      await statusChip.click(); await a.waitForTimeout(1200);
      await f.shot(a, 'verlauf_filter_status', true);
      const txt = await a.locator('main').innerText();
      f.check(/Storniert|storniert/.test(txt) && /abgesagt/.test(txt), 'Filter "Status" zeigt Statuswechsel inkl. Storno-Grund');
    } else f.check(false, 'Filter-Chip "Status" im Verlauf vorhanden');
  } catch (e) {
    if (a) await f.shot(a, 'DEBUG_abbruch', true).catch(() => {});
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 4).join(' | ')}`);
  }
  await f.finish();
})();
