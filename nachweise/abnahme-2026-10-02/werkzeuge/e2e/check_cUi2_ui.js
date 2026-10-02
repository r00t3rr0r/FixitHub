// cUi2: Toast-Position vs. Dialog-Fussleiste, storniertes Auftrags-Header (Inspektion + Zahlung), Notizen-Marker.
// Nur lesend: es wird nichts bestaetigt/gespeichert (Storno-Dialog wird mit Escape geschlossen).
const path = require('path');
const fs = require('fs');
const { makeFlow, S } = require('./flowlib');

const CANCELLED = '6abf12f2d6f617ff2aa229b5'; // ORD-2026-083 (storniert, Inspektion in Arbeit)
const OPEN_INSP = '6abf112cd6f617ff2aa10041'; // ORD-2026-077 (in Bearbeitung, Inspektion in Arbeit)
const OPEN_NEW = '6abf1023d6f617ff2a9fa616'; // ORD-2026-067 (ausstehend, keine Inspektion)

(async () => {
  const f = makeFlow(process.env.OLD_TOAST ? 'fixwave_cUi2_oldtoast' : 'fixwave_cUi2');
  await f.start();
  try {
    for (const vp of [[1366, 768], [375, 740]]) {
      const page = await f.session('admin', vp);
      const tag = `${vp[0]}`;
      f.note(`-- Toast vs. Dialog (${tag})`);
      await f.goto(page, `/orders/${OPEN_NEW}`, 4000);
      // Leerer Viewport darf oben rechts nichts abfangen
      const emptyHit = await page.evaluate(() => {
        const el = document.elementFromPoint(window.innerWidth - 30, 20);
        return el ? (el.closest('ol[class*="z-[12200]"]') ? 'toast-viewport' : el.tagName) : 'none';
      });
      f.check(emptyHit !== 'toast-viewport', `leerer Toast-Viewport faengt oben rechts keine Klicks ab (${tag})`, emptyHit);
      // Storno-Dialog oeffnen (nur oeffnen, nicht bestaetigen)
      const statusBtn = page.locator('.admin-od-status-item button', { hasText: 'Ausstehend' }).first();
      let opened = false;
      if (await statusBtn.count()) {
        await statusBtn.click();
        await page.waitForTimeout(400);
        const item = page.getByRole('menuitem', { name: /Storniert/ });
        if (await item.count()) { await item.first().click(); opened = true; }
      }
      await page.waitForTimeout(800);
      const dlg = page.locator('[role="dialog"]').last();
      f.check(opened && await dlg.isVisible().catch(() => false), `Storno-Dialog offen (${tag})`);
      // Grund eintippen, damit der Bestaetigungs-Button aktiv ist (deaktivierte Buttons haben pointer-events:none);
      // es wird NICHT bestaetigt.
      await dlg.locator('textarea').first().fill('Pruefung Toast-Position (wird nicht gesendet)').catch(() => {});
      // Toast ueber das App-eigene Modul ausloesen (gleiche Modulinstanz via Vite)
      if (process.env.OLD_TOAST) await page.evaluate(() => { window.__oldToast = true; });
      await page.evaluate(async () => {
        if (window.__oldToast) {
          // Gegenprobe: alte Viewport-Klassen (unten rechts) - der Check muss dann fehlschlagen.
          const ol = document.querySelector('ol[class*="z-[12200]"]');
          if (ol) ol.className = 'fixed top-0 z-[12200] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]';
        }
        const mod = await import('/src/hooks/useToast.ts');
        mod.toast({ title: 'Prüfmeldung', description: 'Diese Meldung darf die Dialog-Buttons nicht verdecken.', variant: 'destructive' });
      });
      await page.waitForTimeout(900);
      const res = await page.evaluate(() => {
        const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).pop();
        const btns = dialog ? Array.from(dialog.querySelectorAll('button')).filter((b) => /Abbrechen|Stornieren|Bestätigen|storn/i.test(b.textContent || '')) : [];
        const toastEl = document.querySelector('li[data-state="open"]');
        const out = { buttons: [], toast: null };
        for (const b of btns) {
          const r = b.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          out.buttons.push({ text: (b.textContent || '').trim(), ok: !!hit && (hit === b || b.contains(hit)) });
        }
        if (toastEl) {
          const r = toastEl.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          const ov = document.querySelector('[data-state="open"].fixed.inset-0');
          out.toast = {
            top: Math.round(r.top), right: Math.round(window.innerWidth - r.right), bottom: Math.round(r.bottom),
            onTop: !!hit && toastEl.contains(hit),
            bg: getComputedStyle(toastEl).backgroundColor,
            zToast: getComputedStyle(toastEl.closest('ol')).zIndex, zOverlay: ov ? getComputedStyle(ov).zIndex : null,
          };
        }
        return out;
      });
      f.check(res.buttons.length >= 2, `Dialog-Fussleisten-Buttons gefunden (${tag})`, res.buttons.map((b) => b.text).join(' | '));
      for (const b of res.buttons) f.check(b.ok, `Button "${b.text}" bei sichtbarem Toast nicht verdeckt (${tag})`);
      f.check(res.toast && res.toast.onTop, `Toast liegt sichtbar ueber dem Overlay (${tag})`, JSON.stringify(res.toast));
      f.check(res.toast && res.toast.top < 40, `Toast oben (${tag})`, res.toast && res.toast.top);
      f.check(res.toast && !/rgba\(0, 0, 0, 0\)|transparent/.test(res.toast.bg), `Toast hat deckenden Hintergrund (${tag})`, res.toast && res.toast.bg);
      await f.shot(page, `toast_over_dialog_${tag}`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await page.context().close();
    }

    {
      // Hoher Dialog mit Fussleiste unten rechts (Reparatur-Workflow, nur ansehen - nichts klicken ausser Oeffnen)
      const wp = await f.session('admin', [1366, 768]);
      f.note('-- Toast vs. hoher Workflow-Dialog (1366x768)');
      await f.goto(wp, `/orders/${OPEN_INSP}`, 4500);
      await wp.locator('#order-workflows').getByRole('button', { name: 'Öffnen' }).first().click();
      const rw = wp.getByRole('dialog').last();
      await rw.getByRole('button', { name: /Reparatur abschließen/ }).waitFor({ timeout: 15000 });
      await wp.waitForTimeout(800);
      if (process.env.OLD_TOAST) await wp.evaluate(() => { window.__oldToast = true; });
      await wp.evaluate(async () => {
        if (window.__oldToast) {
          const ol = document.querySelector('ol[class*="z-[12200]"]');
          if (ol) ol.className = 'fixed top-0 z-[12200] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]';
        }
        const mod = await import('/src/hooks/useToast.ts');
        mod.toast({ title: 'Prüfmeldung', description: 'Diese Meldung darf die Dialog-Buttons nicht verdecken.', variant: 'destructive' });
      });
      await wp.waitForTimeout(900);
      const wr = await wp.evaluate(() => {
        const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).pop();
        // Kopfzeilen-X (absolut oben rechts) ausgenommen: dort darf der Toast kurz liegen (eigener Schliessen-Button, Escape).
        const btns = Array.from(dialog.querySelectorAll('button')).filter((b) => /Reparatur abschließen|Workflow pausieren|Fortsetzen|Schließen/.test(b.textContent || '') && b.offsetParent && !/absolute/.test(b.className));
        const dr = dialog.getBoundingClientRect();
        // Typischer Platz des primaeren Fussleisten-Buttons (rechtsbuendige DialogFooter): unten rechts im Dialog.
        const fx = dr.right - 60; const fy = Math.min(dr.bottom, window.innerHeight) - 40;
        const fhit = document.elementFromPoint(fx, fy);
        window.__footerCorner = { x: Math.round(fx), y: Math.round(fy), toast: !!(fhit && fhit.closest('li[data-state]')) };
        return btns.map((b) => {
          const r = b.getBoundingClientRect();
          const inView = r.bottom <= window.innerHeight && r.top >= 0;
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { text: (b.textContent || '').trim().slice(0, 40), inView, ok: !!hit && (hit === b || b.contains(hit)), hitToast: !!(hit && hit.closest('li[data-state]')) };
        }).filter((x) => x.inView);
      });
      const corner = await wp.evaluate(() => window.__footerCorner);
      f.check(corner && !corner.toast, 'Workflow-Dialog: Fussleisten-Bereich unten rechts nicht vom Toast verdeckt', JSON.stringify(corner));
      const hdrX = await wp.evaluate(() => { const d = Array.from(document.querySelectorAll('[role="dialog"]')).pop(); const x = d && Array.from(d.querySelectorAll('button')).find((b) => /absolute/.test(b.className)); if (!x) return null; const r = x.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return h && h.closest('li[data-state]') ? 'vom Toast ueberlagert' : 'frei'; });
      f.note(`   Beobachtung: Kopfzeilen-X des Dialogs bei sichtbarem Toast: ${hdrX}`);
      f.check(wr.length > 0, 'Workflow-Dialog: sichtbare Aktions-Buttons gefunden', wr.map((b) => b.text).join(' | '));
      for (const b of wr) f.check(b.ok && !b.hitToast, `Workflow-Dialog: "${b.text}" bei sichtbarem Toast nicht verdeckt`, b.hitToast ? 'vom Toast verdeckt' : '');
      await f.shot(wp, 'toast_over_workflow_dialog');
      await wp.context().close();
    }

    const page = await f.session('admin', [1366, 900]);
    f.note('-- Stornierter Auftrag: Header');
    await f.goto(page, `/orders/${CANCELLED}`, 5000);
    const hdr = await page.evaluate(() => {
      const primary = document.querySelector('.admin-od-action-primary');
      const status = Array.from(document.querySelectorAll('.admin-od-status-item')).find((el) => /Zahlung/.test(el.textContent || ''));
      const pill = status ? status.querySelector('.admin-od-pill') : null;
      const open = status ? (status.textContent || '').match(/Offen\s*([\d.,]+\s*€)/) : null;
      return {
        primaryText: primary ? primary.textContent.trim() : null, primaryDisabled: primary ? primary.disabled : null, primaryTitle: primary ? primary.title : null,
        pill: pill ? pill.textContent.trim() : null, openShown: open ? open[1].replace(/\s/g, ' ') : null,
        anyFortsetzen: Array.from(document.querySelectorAll('.admin-od-actions button')).some((b) => /Inspektion (fortsetzen|starten)/.test(b.textContent || '')),
      };
    });
    f.check(!hdr.anyFortsetzen, 'storniert: keine Hauptaktion "Inspektion fortsetzen/starten"', JSON.stringify(hdr));
    f.check(hdr.primaryDisabled === true && /storniert/i.test(hdr.primaryText || ''), 'storniert: Hauptaktion zeigt gesperrten Stornostatus', hdr.primaryText);
    const openZero = hdr.openShown && /^0,00/.test(hdr.openShown);
    f.check(openZero ? hdr.pill !== 'Offen' : true, 'storniert: Zahlungs-Badge behauptet bei 0,00 € offen kein "Offen"', `${hdr.pill} / Offen ${hdr.openShown}`);
    await f.shot(page, 'cancelled_header');

    f.note('-- Offener Auftrag mit Inspektion in Arbeit');
    await f.goto(page, `/orders/${OPEN_INSP}`, 5000);
    const p2 = await page.locator('.admin-od-action-primary').first();
    f.check(/Inspektion fortsetzen/.test(await p2.textContent()) && !(await p2.isDisabled()), 'offen: "Inspektion fortsetzen" angeboten', await p2.textContent());
    const pill2 = await page.evaluate(() => { const s = Array.from(document.querySelectorAll('.admin-od-status-item')).find((el) => /Zahlung/.test(el.textContent || '')); return s ? s.textContent.replace(/\s+/g, ' ').trim() : null; });
    f.note(`   Zahlungskarte offen: ${pill2}`);
    await f.shot(page, 'open_header');

    f.note('-- Inspektion Schritt 1: Notizen-Marker');
    await p2.click();
    await page.waitForTimeout(2500);
    // Schritt 1 ggf. aufklappen
    let marker = page.locator('#model-notes-visibility');
    if (!(await marker.count())) {
      const step1 = page.locator('[role="dialog"]').getByText(/Modell|Schritt 1/).first();
      if (await step1.count()) { await step1.click().catch(() => {}); await page.waitForTimeout(800); }
      marker = page.locator('#model-notes-visibility');
    }
    const mtxt = (await marker.count()) ? await marker.first().textContent() : null;
    f.check(mtxt && /Für Kunden sichtbar/.test(mtxt) && /Diagnose ansehen/.test(mtxt), 'Notizen-Feld Schritt 1 zeigt Kundensichtbarkeits-Marker', mtxt);
    const hasIcon = (await marker.count()) ? await marker.first().locator('svg').count() : 0;
    f.check(hasIcon > 0, 'Marker mit Symbol (nicht nur Farbe)');
    const described = await page.locator('#model-notes').getAttribute('aria-describedby').catch(() => null);
    f.check(described === 'model-notes-visibility', 'Textarea per aria-describedby mit Marker verknuepft', described);
    if (await marker.count()) await marker.first().scrollIntoViewIfNeeded().catch(() => {});
    await f.shot(page, 'inspection_notes_marker');
    await page.keyboard.press('Escape');
  } catch (e) {
    f.check(false, 'Ablauf ohne Ausnahme', String(e && e.stack || e).slice(0, 400));
  }
  await f.finish();
})();
