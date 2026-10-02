// K16: Einstellungen werden gespeichert und ueberleben einen Reload; Speichern eines Bereichs ueberschreibt keinen
// anderen (bereichsweises Zusammenfuehren); deutsche Dezimaleingabe "95,5" wird korrekt als 95,5 gespeichert.
const { makeFlow } = require('./flowlib');

async function openAnalyticsSettings(f, a) {
  await f.goto(a, '/admin/analytics', 3500);
  await a.getByRole('button', { name: 'Einstellungen' }).click();
  await a.waitForTimeout(1500);
  return a.getByRole('dialog');
}
async function openFinanceSettings(f, a) {
  await f.goto(a, '/admin/financial', 3500);
  await a.getByRole('tab', { name: /Einstellungen/ }).click();
  await a.waitForTimeout(2500);
}

(async () => {
  const f = makeFlow('k16_settings'); await f.start();
  let a;
  try {
    a = await f.session('admin');
    // 1) Analyse-Einstellung mit deutscher Dezimalzahl
    let d = await openAnalyticsSettings(f, a);
    const rate0 = await d.locator('#labor-rate').inputValue();
    await d.locator('#labor-rate').fill('95,5');
    await f.shot(a, 'analyse_einstellung_geaendert');
    await d.getByRole('button', { name: 'Einstellungen speichern' }).click();
    await a.waitForTimeout(2500);
    const toast = await a.locator('[role="status"], [data-sonner-toast], li[role="status"]').allTextContents().catch(() => []);
    f.note(`   Rueckmeldung: ${toast.join(' | ').slice(0, 200)}`);
    d = await openAnalyticsSettings(f, a);
    const rate1 = await d.locator('#labor-rate').inputValue();
    f.check(/^95[,.]5$/.test(rate1), 'Analyse: Stundensatz 95,5 nach Reload erhalten (nicht 955 / 95)', `${rate0} -> ${rate1}`);
    await a.keyboard.press('Escape');

    // 2) Finanzeinstellung aendern
    await openFinanceSettings(f, a);
    const due0 = await a.locator('#fin-due-days').inputValue();
    await a.locator('#fin-due-days').fill('21');
    await a.getByRole('button', { name: 'Finanzeinstellungen speichern' }).click();
    await a.waitForTimeout(2500);
    await f.shot(a, 'finanz_einstellung_gespeichert', true);
    await openFinanceSettings(f, a);
    const due1 = await a.locator('#fin-due-days').inputValue();
    f.check(due1 === '21', 'Finanzen: Zahlungsziel 21 Tage nach Reload erhalten', `${due0} -> ${due1}`);
    const helpTxt = await a.locator('main').innerText();
    f.check(/Vorbelegung|ohne Wirkung|wirkt|gilt für/i.test(helpTxt), 'Finanzeinstellungen erklaeren Wirkung/Geltung (Hilfetext)');
    f.check(/keine Umrechnung/i.test(helpTxt), 'Standardwaehrung: Hinweis "keine Umrechnung"');

    // 3) Gegenprobe: Speichern der Finanzen hat die Analyse-Einstellung NICHT ueberschrieben
    d = await openAnalyticsSettings(f, a);
    const rate2 = await d.locator('#labor-rate').inputValue();
    f.check(/^95[,.]5$/.test(rate2), 'Analyse-Wert nach Speichern der Finanzeinstellungen unveraendert (kein Ueberschreiben)', rate2);
    await f.shot(a, 'analyse_nach_finanzspeichern');
    // Aufraeumen: Ausgangswerte wiederherstellen
    await d.locator('#labor-rate').fill(rate0.replace('.', ','));
    await d.getByRole('button', { name: 'Einstellungen speichern' }).click(); await a.waitForTimeout(2000);
    await openFinanceSettings(f, a);
    await a.locator('#fin-due-days').fill(due0);
    await a.getByRole('button', { name: 'Finanzeinstellungen speichern' }).click(); await a.waitForTimeout(2000);
    f.note(`   Ausgangswerte wiederhergestellt (${rate0} / ${due0})`);
  } catch (e) {
    if (a) await f.shot(a, 'DEBUG_abbruch', true).catch(() => {});
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 4).join(' | ')}`);
  }
  await f.finish();
})();
