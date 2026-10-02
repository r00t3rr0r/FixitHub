// cMoney: Startseiten-Preise in der englischen Oberflaeche ("49,90 €"), Finanz-CSV-Export als echte Datei.
// Nur lesend: Export-Downloads (GET) - nichts wird gespeichert/versendet.
const fs = require('fs');
const { makeFlow } = require('./flowlib');

(async () => {
  const f = makeFlow('fixwave_cMoney');
  await f.start();
  try {
    f.note('-- Startseite, englische Oberflaeche (Gast)');
    const guest = await f.session('guest');
    await guest.addInitScript(() => { try { localStorage.setItem('i18nextLng', 'en'); } catch (e) { /* */ } });
    // Die Test-DB hat keine Shop-Produkte: die Produktliste wird NUR im Browser durch ein
    // Testprodukt ersetzt (keine DB-Schreibung); geprueft wird die Client-Formatierung.
    await guest.route(/\/api\/products(\?|$)/, (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, products: [
        { _id: 'e2e0000000000000000000a1', name: 'E2E Testhülle', description: 'Testprodukt', price: 49.9, originalPrice: 1234.5, isActive: true, inStock: true, stockCount: 5, category: 'accessories', images: [] },
      ], totalPages: 1, currentPage: 1, totalProducts: 1, limit: 8 }),
    }));
    await f.goto(guest, '/', 5000);
    const lang = await guest.evaluate(() => localStorage.getItem('i18nextLng'));
    await guest.locator('.shop-price').first().scrollIntoViewIfNeeded().catch(() => {});
    await guest.waitForTimeout(1500);
    const prices = (await guest.locator('.shop-price, .shop-price-old').allInnerTexts()).map((s) => s.replace(/ /g, ' ').trim());
    f.note(`   Sprache=${lang}; Preise=${JSON.stringify(prices.slice(0, 8))}`);
    const navText = (await guest.locator('body').innerText()).slice(0, 4000);
    f.check(lang === 'en' && /\b(Repair|Shop|Contact|Login|Sign in|Services)\b/.test(navText), 'englische Oberflaeche aktiv', lang);
    f.check(prices.length > 0, 'Startseite zeigt Shop-Preise', prices.length);
    f.check(prices.includes('49,90 €') && prices.includes('1.234,50 €'), 'Preis 49,9 => "49,90 €", 1234,5 => "1.234,50 €"', prices.join(' | '));
    f.check(prices.length > 0 && prices.every((p) => /^\d{1,3}(\.\d{3})*,\d{2} €$/.test(p)), 'alle Preise de-DE "49,90 €" (kein "€49.90")', prices.slice(0, 4).join(' | '));
    if (await guest.locator('.shop-price').count()) await f.shot(guest, 'home_en_prices');

    f.note('-- Finanzverwaltung: CSV-Export (Admin)');
    const page = await f.session('admin');
    await f.goto(page, '/admin/financial', 5000);
    await page.locator('[role="tab"][data-state][id$="-settings"], button[role="tab"]').filter({ hasText: /Einstellungen|Settings/ }).first().click();
    await page.waitForTimeout(1500);
    const cases = [
      ['Rechnungen CSV', page.locator('button', { hasText: /^CSV$/ }).nth(0)],
      ['Zahlungen CSV', page.locator('button', { hasText: /^CSV$/ }).nth(1)],
      ['ZM CSV', page.locator('button', { hasText: /^ZM CSV$/ }).first()],
    ];
    for (const [label, button] of cases) {
      await button.scrollIntoViewIfNeeded().catch(() => {});
      let dl = null;
      try {
        [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), button.click()]);
      } catch (error) {
        const toast = await page.locator('[role="status"], li[data-state="open"]').allInnerTexts().catch(() => []);
        f.check(false, `${label}: Download startet`, `${error.message.split('\n')[0]} / Toast: ${toast.join(' | ').slice(0, 160)}`);
        continue;
      }
      const file = await dl.path();
      const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
      const firstLine = text.split(/\r?\n/)[0];
      f.check(/\.csv$/.test(dl.suggestedFilename()), `${label}: Dateiname .csv`, dl.suggestedFilename());
      f.check(firstLine.length > 0 && !/^\[object|^\{|^</.test(text) && /[;,]/.test(firstLine), `${label}: Datei beginnt mit CSV-Kopfzeile`, JSON.stringify(firstLine.slice(0, 90)));
      await page.waitForTimeout(800);
    }
    await f.shot(page, 'financial_export');
  } catch (error) {
    f.check(false, 'Ablauf ohne Ausnahme', error.message);
  }
  await f.finish();
})();
