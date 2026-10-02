/**
 * Regressionstest (01.10.2026) EIN Geldformat (CUSTUX-12 / FIN-12 / FIN-4), ohne Datenbank
 * und ohne Netzwerk.
 *
 *  [1] client/src/lib/utils.ts formatMoney / formatEUR (mit dem TypeScript-Compiler des
 *      Clients transpiliert): "47,40 €", Waehrung aus den Daten, ungueltiger Code -> EUR.
 *  [2] server/utils/money.js describeGross / formatEuroDe: MwSt.-Hinweis, Reverse Charge,
 *      unbekannte Steuer nie als "0,00 € MwSt.".
 *  [3] Uebersetzungen: en/de "Total for all orders" ohne festes "$"/"€" (Betrag kommt
 *      formatiert), Profil "Auftragswert gesamt", "Rechnung aus Auftraegen erstellen".
 *  [4] Quelltext-Scan der vom Track umgestellten Dateien: kein "$"-Betrag, kein CHF/USD,
 *      kein "x.toFixed(2) €".
 *
 * Aufruf: node test-fin-money-format.js
 */
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

const CLIENT = path.join(__dirname, 'client');
const ts = require(path.join(CLIENT, 'node_modules/typescript'));

let pass = 0;
let fail = 0;
const check = (condition, message, actual) => {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${message} :: ${actual}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${message} :: ${actual}`);
  }
};
// Intl liefert ein geschuetztes Leerzeichen (U+00A0) vor dem Euro-Zeichen.
const plain = (text) => String(text).replace(/ /g, ' ');

const loadTs = (relative) => {
  const file = path.join(CLIENT, relative);
  const source = fs.readFileSync(file, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', output)(mod, mod.exports, createRequire(file));
  return mod.exports;
};

console.log('\n[1] Client formatMoney / formatEUR');
const { formatMoney, formatEUR } = loadTs('src/lib/utils.ts');
check(plain(formatMoney(47.4)) === '47,40 €', 'formatMoney(47.4) = "47,40 €"', plain(formatMoney(47.4)));
check(plain(formatMoney(1234.5)) === '1.234,50 €', 'Tausenderpunkt', plain(formatMoney(1234.5)));
check(plain(formatMoney(47.4, 'EUR', 'en-GB')) === '€47.40', 'anderes Format nur ausdruecklich (en-GB)', plain(formatMoney(47.4, 'EUR', 'en-GB')));
check(plain(formatMoney(1, 'XX!')) === '1,00 €', 'ungueltiger Waehrungscode -> EUR', plain(formatMoney(1, 'XX!')));
check(plain(formatMoney('abc')) === '0,00 €' && plain(formatMoney(null)) === '0,00 €', 'nicht lesbar -> 0,00 €', `${plain(formatMoney('abc'))} ${plain(formatMoney(null))}`);
check(plain(formatMoney(10, 'CHF')) !== plain(formatMoney(10)) && /CHF/.test(plain(formatMoney(10, 'CHF'))), 'Waehrung kommt aus den Daten (CHF-Datensatz bleibt CHF)', plain(formatMoney(10, 'CHF')));
check(plain(formatEUR(47.4)) === '47,40 €' && plain(formatEUR({ $numberDecimal: '7.57' })) === '7,57 €', 'formatEUR bleibt kompatibel (auch Decimal128)', `${plain(formatEUR(47.4))} ${plain(formatEUR({ $numberDecimal: '7.57' }))}`);

console.log('\n[2] Server money.js');
const money = require(path.join(__dirname, 'server/utils/money'));
check(money.formatEuroDe(37.4) === '37,40 €', 'formatEuroDe(37.4) = "37,40 €" (normales Leerzeichen)', money.formatEuroDe(37.4));
check(money.describeGross({ gross: 47.4, tax: 7.57, taxRate: 19 }) === '47,40 € (inkl. 7,57 € MwSt. 19 %)', 'describeGross mit MwSt.', money.describeGross({ gross: 47.4, tax: 7.57, taxRate: 19 }));
check(money.describeGross({ gross: 47.4, isReverseCharge: true, tax: 0 }) === '47,40 € (Reverse Charge – ohne MwSt.)', 'Reverse Charge ausdruecklich benannt', money.describeGross({ gross: 47.4, isReverseCharge: true, tax: 0 }));
check(money.describeGross({ gross: 47.4 }) === '47,40 €' && money.describeGross({ gross: 47.4, tax: 0 }) === '47,40 €', 'unbekannte Steuer: nur Brutto, nie "0,00 € MwSt."', money.describeGross({ gross: 47.4, tax: 0 }));
check(money.describeGross({ gross: 47.4, tax: 7.57, discount: 2.5 }) === '47,40 € (nach 2,50 € Rabatt, inkl. 7,57 € MwSt.)', 'mit Rabatt', money.describeGross({ gross: 47.4, tax: 7.57, discount: 2.5 }));
check(Number.isNaN(Number(money.describeGross({ gross: 47.4, tax: 7.57, taxRate: 19 }))), 'zusammengesetzter Text wird von localizeTemplateDisplayVariables nicht umformatiert (keine reine Zahl)', 'NaN');

console.log('\n[3] Uebersetzungen');
const de = JSON.parse(fs.readFileSync(path.join(CLIENT, 'src/locales/de/translation.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(CLIENT, 'src/locales/en/translation.json'), 'utf8'));
const interpolate = (template, vars) => String(template).replace(/\{\{(\w+)\}\}/g, (_m, key) => vars[key]);
const total = plain(formatEUR(47.4));
const enTotal = interpolate(en.newOrder.reviewStep.totalForAll, { total });
const deTotal = interpolate(de.newOrder.reviewStep.totalForAll, { total });
check(enTotal === 'Total for all orders: 47,40 €' && !enTotal.includes('$'), 'en: kein "$" mehr (frueher "$47.40")', enTotal);
check(deTotal === 'Gesamt für alle Aufträge: 47,40 €' && (deTotal.match(/€/g) || []).length === 1, 'de: genau ein "€"', deTotal);
const enQty = interpolate(en.newOrder.detailsStep.quantityTotalCost, { total });
check(!enQty.includes('$') && enQty.endsWith('47,40 €'), 'en quantityTotalCost ohne "$"', enQty);
check(de.profilePage.totalSpent === 'Auftragswert gesamt', 'Profil: "Auftragswert gesamt" statt "Gesamt Spent"', de.profilePage.totalSpent);
check(de.financialManagement.generateFromRepairs === 'Rechnung aus Aufträgen erstellen', 'Button "Rechnung aus Aufträgen erstellen"', de.financialManagement.generateFromRepairs);
check(de.financialManagement.settingsSaved === 'Finanzeinstellungen gespeichert', 'Erfolgsmeldung Finanzeinstellungen (frueher "Zahlung erfolgreich aktualisiert")', de.financialManagement.settingsSaved);
const enText = JSON.stringify(en);
check(!/\$\{\{|\$\d/.test(enText), 'en: kein "$"-Betrag in den Uebersetzungen', (enText.match(/\$\{\{|\$\d/g) || []).join(','));

console.log('\n[4] Quelltext-Scan der umgestellten Dateien');
const FILES = [
  'src/pages/admin/UserManagement.tsx', 'src/pages/Profile.tsx', 'src/pages/NewOrder.tsx', 'src/pages/staff/Performance.tsx',
  'src/pages/admin/ServiceManagement.tsx', 'src/pages/admin/PartsManagement.tsx', 'src/pages/OrderTracking.tsx',
  'src/pages/admin/AdminDashboard.tsx', 'src/pages/admin/FinancialManagement.tsx', 'src/pages/admin/Analytics.tsx',
  'src/pages/WebShop.tsx', 'src/pages/admin/AddOnServiceManagement.tsx', 'src/pages/admin/WebShopManagement.tsx',
  'src/components/admin/UserDetailsDialog.tsx', 'src/components/admin/ShopProductSelectionDialog.tsx',
  'src/components/cart/RepairOrderDetailsDialog.tsx', 'src/components/repair/RepairMainInterface.tsx',
  'src/components/admin/ServiceCSVPreviewTable.tsx', 'src/components/admin/ProductCSVPreviewTable.tsx',
  'src/components/admin/PartsCSVPreviewTable.tsx', 'src/components/admin/AddOnCSVPreviewTable.tsx',
  'src/components/admin/TrackingPanel.tsx', 'src/pages/GuestOrderTracking.tsx', 'src/pages/GuestBookingTracking.tsx',
];
const patterns = [
  // "$" direkt vor einem Geldausdruck: Template "`$${price}`" oder JSX-Text "${price}" / ">${price}".
  { name: '"$"-Betrag (Template)', regex: /\$\$\{[^}\n]*(price|Price|total|Total|amount|Amount|cost|Cost|Spent|Value|revenue|Revenue)/ },
  { name: '"$"-Betrag (JSX)', regex: /(^\s*|>\s*)\$\{[^}\n]*(price|Price|total|Total|amount|Amount|cost|Cost|Spent|Value|revenue|Revenue)/m },
  { name: "currency 'CHF'/'USD'", regex: /currency:\s*['"](CHF|USD)['"]/ },
  { name: "'de-CH'/'en-US' Waehrungsformat", regex: /NumberFormat\(\s*['"](de-CH|en-US)['"]/ },
  { name: 'x.toFixed(2) €', regex: /toFixed\(2\)\}?\s*€/ },
  { name: 'DollarSign-Icon', regex: /<DollarSign\b/ },
  { name: '"€" vor Betrag', regex: /€\{[^}\n]*toFixed/ },
  { name: 'Waehrungsformat nach Sprache', regex: /NumberFormat\(\s*locale\s*,\s*\{\s*style:\s*['"]currency/ },
];
FILES.forEach((relative) => {
  const source = fs.readFileSync(path.join(CLIENT, relative), 'utf8');
  // HTML-Vorlagen in Template-Strings (${...} ohne Geldbezug) sind erlaubt; geprueft werden nur Geldmuster.
  const hits = patterns.filter((pattern) => pattern.regex.test(source)).map((pattern) => pattern.name);
  check(hits.length === 0, relative, hits.join(', ') || 'sauber');
});

console.log(`\nErgebnis: ${pass} PASS, ${fail} FAIL`);
process.exitCode = fail === 0 ? 0 : 1;
