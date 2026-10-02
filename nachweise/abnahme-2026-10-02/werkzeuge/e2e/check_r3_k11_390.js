// K11 (Runde 3, Nachweis 390 px): Versandkarten (Admin, Tab "Versand") ohne horizontales Scrollen;
// Kundenansicht desselben Auftrags ohne Absender/Empfaenger-Block.
// Auftrag: der von flow_k11_admin_label_download.js zuletzt angelegte Auftrag (Argument 1 = orderId).
const fs = require('fs'); const path = require('path');
const { makeFlow } = require('./flowlib');

const ORDER_ID = process.argv[2];
const NETGUARD = path.join(__dirname, 'netguard_after.log');
const ngSize = () => (fs.existsSync(NETGUARD) ? fs.statSync(NETGUARD).size : 0);

async function overflowReport(page, rootSel) {
  return page.evaluate((sel) => {
    const vw = window.innerWidth;
    const doc = document.documentElement;
    const root = sel ? document.querySelector(sel) : document.body;
    const offenders = [];
    if (root) {
      for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
        if (!(el instanceof HTMLElement) || el.offsetParent === null) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const cs = getComputedStyle(el);
        const ownScroll = /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
        if (r.right > vw + 1 || r.left < -1 || ownScroll) {
          offenders.push(`${el.tagName.toLowerCase()}.${String(el.className || '').split(' ').slice(0, 2).join('.')} r=${Math.round(r.left)}..${Math.round(r.right)} sw=${el.scrollWidth}/cw=${el.clientWidth}${ownScroll ? ' (eigener x-Scroll)' : ''}`);
        }
      }
    }
    // auch die Scroll-Container der App-Shell (scrollen intern) pruefen
    const shellX = Array.from(document.querySelectorAll('body *')).filter((el) => {
      const cs = getComputedStyle(el);
      return el.clientWidth > 200 && /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
    }).map((el) => `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ').slice(0, 2).join('.')} sw=${el.scrollWidth}/cw=${el.clientWidth}`);
    return { vw, docSW: doc.scrollWidth, docCW: doc.clientWidth, bodySW: document.body.scrollWidth, offenders: offenders.slice(0, 15), shellX: shellX.slice(0, 10) };
  }, rootSel);
}

(async () => {
  const f = makeFlow('r3_k11_390'); await f.start();
  const ng0 = ngSize();
  let a; let c;
  try {
    if (!ORDER_ID) throw new Error('orderId als Argument fehlt');
    f.note(`   Testdaten: Auftrag ${ORDER_ID} (angelegt von flow_k11_admin_label_download.js, Kunde partner@e2e.invalid)`);
    // ---- Admin, 390 x 844 ---------------------------------------------------------------------------------
    a = await f.session('admin', [390, 844]);
    await f.goto(a, `/orders/${ORDER_ID}`, 4000);
    const tab = a.getByRole('tab', { name: /^Versand/ });
    await tab.first().scrollIntoViewIfNeeded().catch(() => {});
    await tab.first().click();
    await a.waitForTimeout(2500);
    const inCard = a.locator('section[aria-labelledby="admin-od-inbound-title"]');
    const outCard = a.locator('section[aria-labelledby="admin-od-outbound-title"]');
    await inCard.waitFor({ timeout: 15000 });
    await inCard.scrollIntoViewIfNeeded();
    await f.shot(a, 'admin_390_versand_einsendung');
    await outCard.scrollIntoViewIfNeeded();
    await f.shot(a, 'admin_390_versand_auslieferung');
    await f.shot(a, 'admin_390_versand_ganzseite', true);
    await inCard.screenshot({ path: path.join(f.out, 'card_einsendung_390.png') });
    await outCard.screenshot({ path: path.join(f.out, 'card_auslieferung_390.png') });
    f.note('   [shot] card_einsendung_390.png, card_auslieferung_390.png (Elementaufnahmen)');
    const rep = await overflowReport(a, '#admin-od-shipping');
    f.note(`   Admin 390: viewport=${rep.vw} doc sw/cw=${rep.docSW}/${rep.docCW} body sw=${rep.bodySW}`);
    rep.offenders.forEach((o) => f.note(`     ueberstehend: ${o}`));
    rep.shellX.forEach((o) => f.note(`     Shell-Container mit x-Scroll: ${o}`));
    f.check(rep.docSW <= rep.docCW + 1 && rep.bodySW <= rep.vw + 1, 'Admin 390 px: Seite ohne horizontales Scrollen (document/body)', `${rep.docSW}/${rep.docCW}`);
    f.check(rep.offenders.length === 0, 'Admin 390 px: kein Element der Versandkarten ragt über den Viewport / scrollt horizontal', rep.offenders.length);
    f.check(rep.shellX.length === 0, 'Admin 390 px: kein Shell-Scrollcontainer mit horizontalem Überlauf', rep.shellX.length);
    const cardW = await Promise.all([inCard, outCard].map((l) => l.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, right: Math.round(el.getBoundingClientRect().right) }))));
    f.check(cardW.every((w) => w.sw <= w.cw + 1 && w.right <= 391), 'Admin 390 px: beide Karten scrollWidth <= clientWidth und innerhalb 390 px', JSON.stringify(cardW));
    const parties = await a.locator('#admin-od-shipping [data-party]').evaluateAll((els) => els.map((e) => e.getAttribute('data-party')));
    f.check(parties.length === 4, 'Admin 390 px: beide Karten zeigen Absender + Empfänger', parties.join(','));
    // ---- Kunde (Inhaber), 390 x 844 -----------------------------------------------------------------------
    c = await f.session('customer', [390, 844]);
    await f.goto(c, `/orders/${ORDER_ID}`, 4000);
    const shipCard = c.locator('#order-customer-shipping');
    const hasShipCard = (await shipCard.count()) > 0;
    if (hasShipCard) {
      await shipCard.scrollIntoViewIfNeeded();
      // Abschnitt aufklappen, falls zugeklappt
      const toggle = shipCard.locator('button[aria-expanded="false"]').first();
      if (await toggle.count()) { await toggle.click().catch(() => {}); await c.waitForTimeout(800); }
      await f.shot(c, 'kunde_390_versand');
    }
    await f.shot(c, 'kunde_390_ganzseite', true);
    const custTxt = (await c.locator('body').innerText()).replace(/\s+/g, ' ');
    const dp = await c.locator('[data-party], .admin-od-party, .admin-od-parties').count();
    const words = (custTxt.match(/Absender|Empfänger|Quelle: (Rechnungsadresse|Lieferadresse|DHL-Integration)/g) || []);
    f.note(`   Kunde 390: Versandkarte vorhanden=${hasShipCard}; Treffer Absender/Empfänger/Quelle=${words.length}${words.length ? ` (${[...new Set(words)].join(', ')})` : ''}`);
    f.check(hasShipCard, 'Kunde: Versandkarte des Auftrags wird angezeigt');
    f.check(dp === 0 && words.length === 0, 'Kunde: kein Absender/Empfänger-Block (keine data-party-Elemente, keine Team-Quellenangaben)', `${dp}/${words.length}`);
    f.check(/DHL-DUMMY-/.test(custTxt) || /Sendungsnummer|Versand/.test(custTxt), 'Kunde: Versandstand selbst bleibt sichtbar');
    const crep = await overflowReport(c, null);
    f.note(`   Kunde 390: doc sw/cw=${crep.docSW}/${crep.docCW}`);
    crep.offenders.slice(0, 5).forEach((o) => f.note(`     ueberstehend (Kunde): ${o}`));
    f.check(crep.docSW <= crep.docCW + 1, 'Kunde 390 px: Seite ohne horizontales Scrollen', `${crep.docSW}/${crep.docCW}`);
  } catch (e) {
    if (a) await f.shot(a, 'DEBUG_admin', true).catch(() => {});
    if (c) await f.shot(c, 'DEBUG_kunde', true).catch(() => {});
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 3).join(' | ')}`);
  }
  f.check(ngSize() === ng0, 'netguard_after.log unverändert', `${ng0} -> ${ngSize()} B`);
  await f.finish();
})();
