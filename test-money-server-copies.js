/**
 * Regressionstest (02.10.2026) PAR-5: die Server-Geldformatierer sind keine eigenen Kopien mehr,
 * sondern nutzen server/utils/money.js formatEuroDe (de-DE, Tausenderpunkt, "47,40 €").
 * Ohne Datenbank und ohne Netzwerk (es wird nur require() ausgefuehrt, keine Verbindung).
 *
 *  - OrderHistory.formatEuroDe, NotificationService.formatEuroDe, RepairRequestService.formatEuro
 *    liefern fuer 47.4 und 1234.5 exakt dasselbe wie money.formatEuroDe.
 *  - OrderHistory.formatEuroDe behaelt '–' fuer nicht lesbare Betraege.
 *  - complaintRoutes.js hat keine eigene formatEuroDe-Kopie mehr (frueher ohne Tausenderpunkt:
 *    "1234,50 €"), sondern bindet money.js ein.
 *
 * Aufruf: node test-money-server-copies.js
 */
const path = require('path');
const fs = require('fs');

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

const money = require(path.join(__dirname, 'server/utils/money'));
const OrderHistory = require(path.join(__dirname, 'server/utils/orderHistory'));
const NotificationService = require(path.join(__dirname, 'server/services/notificationService'));
const RepairRequestService = require(path.join(__dirname, 'server/services/repairRequestService'));

console.log('\n[1] Referenz money.formatEuroDe');
check(money.formatEuroDe(47.4) === '47,40 €', 'money.formatEuroDe(47.4)', money.formatEuroDe(47.4));
check(money.formatEuroDe(1234.5) === '1.234,50 €', 'money.formatEuroDe(1234.5) mit Tausenderpunkt', money.formatEuroDe(1234.5));

console.log('\n[2] Servermodule nutzen denselben Formatter');
const copies = {
  'OrderHistory.formatEuroDe': OrderHistory.formatEuroDe,
  'NotificationService.formatEuroDe': (v) => NotificationService.formatEuroDe(v),
  'RepairRequestService.formatEuro': RepairRequestService.formatEuro,
};
Object.entries(copies).forEach(([name, fn]) => {
  check(typeof fn === 'function', `${name} vorhanden`, typeof fn);
  if (typeof fn !== 'function') return;
  [47.4, 1234.5, 0, 1000000].forEach((value) => {
    check(fn(value) === money.formatEuroDe(value), `${name}(${value}) = money.formatEuroDe`, fn(value));
  });
});
check(OrderHistory.formatEuroDe('abc') === '–' && OrderHistory.formatEuroDe(undefined) === '–', 'OrderHistory: nicht lesbarer Betrag -> "–"', `${OrderHistory.formatEuroDe('abc')} ${OrderHistory.formatEuroDe(undefined)}`);

console.log('\n[3] complaintRoutes.js ohne eigene Kopie');
const complaintSource = fs.readFileSync(path.join(__dirname, 'server/routes/complaintRoutes.js'), 'utf8');
check(!/function\s+formatEuroDe\s*\(/.test(complaintSource) && !/const\s+formatEuroDe\s*=/.test(complaintSource), 'keine lokale formatEuroDe-Definition', 'ok');
check(/const\s*\{\s*formatEuroDe\s*\}\s*=\s*require\('\.\.\/utils\/money'\)/.test(complaintSource), 'formatEuroDe aus server/utils/money.js', 'ok');

console.log(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail > 0 ? 1 : 0);
