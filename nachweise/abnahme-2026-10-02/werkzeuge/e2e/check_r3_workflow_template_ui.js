// Runde 3 (Track workflow, Punkt a): Workflow-Vorlage -> Visual Builder -> Schritt bearbeiten.
// Erwartet: Benachrichtigungs-Schalter (Vorlage) und "Pflichtschritt"/"Freigabe"/"Formular" gesperrt mit Erklaerung;
// Reiter "Automation": "Regel hinzufügen" gesperrt, Hinweis "Benachrichtigung senden verschickt nichts".
// Nur Ansicht - es wird nichts gespeichert (Dialog wird mit Escape geschlossen).
const { makeFlow, dumpControls } = require('./flowlib');

(async () => {
  const f = makeFlow('r3_workflow_template_ui'); await f.start();
  let a;
  try {
    a = await f.session('admin', [1366, 768]);
    await f.goto(a, '/admin/workflow', 4000);
    const vb = a.locator('button[title="Visual Builder"]').first();
    f.check(await vb.count() > 0, 'Workflow-Vorlagen: Knopf "Visual Builder" vorhanden', await vb.count());
    await vb.click(); await a.waitForTimeout(2500);
    const builder = a.getByRole('dialog').last();
    // Runde 3 (spaeter): Schrittkarten zeigen statt "Required/Approval/Form Required" einen gedaempften
    // deutschen Hinweis "… (ohne Wirkung)" (die Flags werden nicht ausgewertet).
    const builderTxt = (await builder.innerText()).replace(/\s+/g, ' ');
    const mutedBadges = await builder.locator('div.inline-flex, span.inline-flex').filter({ hasText: /^(Pflicht|Freigabe|Formular)[^]*\(ohne Wirkung\)$/ }).allInnerTexts();
    f.note(`   Visual Builder: ${mutedBadges.length} Hinweis-Badges: ${[...new Set(mutedBadges.map((t) => t.trim()))].join(' | ')}`);
    f.check(mutedBadges.length > 0 && mutedBadges.every((t) => /^(Pflicht|Freigabe|Formular)( · (Freigabe|Formular))* \(ohne Wirkung\)$/.test(t.trim())), 'Schrittkarten: gedämpfter deutscher Hinweis "… (ohne Wirkung)" für Pflicht/Freigabe/Formular', mutedBadges.length);
    f.check(!/\bRequired\b|\bApproval\b|Form Required/.test(builderTxt), 'Schrittkarten: keine englischen Badges "Required" / "Approval" / "Form Required" mehr', (builderTxt.match(/.{0,20}(Required|Approval).{0,20}/) || [''])[0]);
    const mutedClass = await builder.locator('div.inline-flex, span.inline-flex').filter({ hasText: /^(Pflicht|Freigabe|Formular)[^]*\(ohne Wirkung\)$/ }).first().getAttribute('class').catch(() => '');
    f.check(/text-muted-foreground/.test(mutedClass || '') && !/destructive|bg-red/.test(mutedClass || ''), 'Hinweis-Badge ist gedämpft (nicht rot/destruktiv)', (mutedClass || '').slice(0, 80));
    await f.shot(a, 'visual_builder_schrittkarten');
    const editBtn = builder.locator('button:has(svg[class*="pen"]), button:has(svg[class*="edit"])').first();
    f.check(await editBtn.count() > 0, 'Visual Builder: Schritt-Bearbeiten-Knopf vorhanden', await editBtn.count());
    await editBtn.click(); await a.waitForTimeout(1500);
    const dlg = a.getByRole('dialog').last();
    const note = dlg.locator('[data-testid="step-notification-settings-note"]');
    await note.scrollIntoViewIfNeeded().catch(() => {});
    const noteText = (await note.innerText().catch(() => '')).replace(/\s+/g, ' ');
    f.check(/nicht ausgewertet/.test(noteText) && /Kunde informieren/.test(noteText) && /Benachrichtigung erneut senden/.test(noteText), 'Hinweis: nicht ausgewertet + wo der wirksame Schalter ist', noteText.slice(0, 220));
    for (const id of ['notify-start', 'notify-complete', 'notify-delay', 'is-required', 'requires-approval', 'requires-form']) {
      // eslint-disable-next-line no-await-in-loop
      const dis = await dlg.locator(`#${id}`).isDisabled();
      f.check(dis, `Schalter #${id} gesperrt`, dis);
    }
    f.check(!(await dlg.locator('#can-skip').isDisabled()), '"Überspringen erlaubt" bleibt bedienbar (wirkt in der Ausführung)', 'aktiv');
    const before = await dlg.locator('#notify-complete').getAttribute('data-state');
    await dlg.locator('#notify-complete').click({ force: true }).catch(() => {});
    await a.waitForTimeout(300);
    const after = await dlg.locator('#notify-complete').getAttribute('data-state');
    f.check(before === after, 'Klick auf gesperrten Schalter aendert nichts', `${before} -> ${after}`);
    await f.shot(a, 'schritt_basic_gesperrt');
    await dlg.getByRole('tab', { name: 'Automation' }).click(); await a.waitForTimeout(800);
    const addRule = dlg.getByRole('button', { name: /Regel hinzufügen/ });
    f.check(await addRule.isDisabled(), '"Regel hinzufügen" gesperrt', await addRule.isDisabled());
    const autoNote = (await dlg.locator('[data-testid="step-automation-rules-note"]').innerText()).replace(/\s+/g, ' ');
    f.check(/verschickt nichts/.test(autoNote) && /Kunde informieren/.test(autoNote), 'Automation-Hinweis: "Benachrichtigung senden" verschickt nichts, Verweis auf "Kunde informieren"', autoNote.slice(0, 200));
    await f.shot(a, 'schritt_automation_gesperrt');
    f.note(`   Kontrollen im Dialog: ${(await dumpControls(a)).filter((l) => /Regel|Speichern|Save|Abbrechen|Cancel/i.test(l)).slice(0, 10).join(' || ')}`);
    await a.keyboard.press('Escape'); await a.waitForTimeout(500);
    // Ansicht (Auge) derselben Vorlagenliste: dieselben Flags duerfen dort nicht als rotes "Required" erscheinen.
    await a.keyboard.press('Escape'); await a.waitForTimeout(500);
    await f.goto(a, '/admin/workflow', 3000);
    const eye = a.locator('button:has(svg.lucide-eye)').first();
    if (await eye.count()) {
      await eye.click(); await a.waitForTimeout(1200);
      const view = a.getByRole('dialog').last();
      const viewTxt = (await view.innerText()).replace(/\s+/g, ' ');
      await f.shot(a, 'vorlage_ansicht_schritte');
      f.note(`   Ansicht-Dialog: englische Badges=${(viewTxt.match(/\bRequired\b|\bApproval\b|Form Required/g) || []).length}, Hinweis "(ohne Wirkung)"=${(viewTxt.match(/\(ohne Wirkung\)/g) || []).length}`);
      f.check(!/\bRequired\b|\bApproval\b|Form Required/.test(viewTxt), 'Vorlagen-Ansicht (Auge): keine englischen/roten "Required"-Badges', (viewTxt.match(/.{0,30}Required.{0,10}/) || [''])[0]);
      const viewBadges = await view.locator('div.inline-flex, span.inline-flex').filter({ hasText: /^(Pflicht|Freigabe|Formular)[^]*\(ohne Wirkung\)$/ }).evaluateAll((els) => els.map((e) => e.className));
      f.check(viewBadges.length > 0 && viewBadges.every((c) => /text-muted-foreground/.test(c) && !/destructive|bg-red/.test(c)), 'Vorlagen-Ansicht: derselbe gedämpfte Hinweis "… (ohne Wirkung)" wie im Visual Builder', viewBadges.length);
      await a.keyboard.press('Escape'); await a.waitForTimeout(400);
    } else f.note('   (kein Ansicht-Knopf gefunden)');
  } catch (e) {
    if (a) await f.shot(a, 'DEBUG_abbruch', true).catch(() => {});
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 4).join(' | ')}`);
  }
  await f.finish();
})();
