/**
 * Regressionstest (01.10.2026) fuer zwei kleine Client-Helfer (ohne Datenbank, ohne Netzwerk):
 *   - client/src/lib/parseDecimalInput.ts (SP-9: "0,02" darf nicht 2 werden, "12.50" nicht 50)
 *   - client/src/lib/dialogOverflow.ts   (ADMUX-1/2: "overflow-hidden" am DialogContent wird
 *     zu vertikalem Scrollen, damit Fusszeile/Speichern erreichbar bleiben)
 * Die TypeScript-Dateien werden mit dem TypeScript-Compiler des Clients transpiliert.
 *
 * Aufruf: node test-parts-ui-helpers.js
 */
const path = require('path');
const fs = require('fs');

const CLIENT = path.join(__dirname, 'client');
const ts = require(path.join(CLIENT, 'node_modules/typescript'));

const load = (relative) => {
  const source = fs.readFileSync(path.join(CLIENT, relative), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', output)(mod, mod.exports);
  return mod.exports;
};

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

const { parseDecimalInput, formatDecimalInput } = load('src/lib/parseDecimalInput.ts');
const { normalizeDialogOverflow } = load('src/lib/dialogOverflow.ts');

console.log('\n[1] parseDecimalInput');
[
  ['0,02', 0.02], ['0.02', 0.02], ['12.50', 12.5], ['12,50', 12.5], ['6.90', 6.9], ['0.015', 0.015],
  [' 7 ', 7], [',5', 0.5], ['', null], ['   ', null], ['abc', null], ['1,2,3', null], ['12.', 12],
  // Review 01.10.: eindeutige Tausendergruppierung mit beiden Trennern statt Abbruch beim Praefix "1.234"
  ['1.234,50', 1234.5], ['1.234,5', 1234.5], ['1,234.50', 1234.5], ['12.345.678,9', 12345678.9],
  ['1.234', 1.234], ['1.2.3', null], ['1.23,4', null], ['1.234,', 1234],
].forEach(([input, expected]) => {
  const actual = parseDecimalInput(input);
  check(actual === expected, `"${input}" -> ${expected}`, actual);
});
check(formatDecimalInput(12.5) === '12,5' && formatDecimalInput(0.02) === '0,02' && formatDecimalInput(null) === '', 'formatDecimalInput deutsch', `${formatDecimalInput(12.5)} ${formatDecimalInput(0.02)}`);

console.log('\n[2] normalizeDialogOverflow');
check(normalizeDialogOverflow('max-h-[85vh] overflow-hidden p-0') === 'max-h-[85vh] overflow-x-hidden overflow-y-auto p-0', 'overflow-hidden -> x-hidden + y-auto', normalizeDialogOverflow('max-h-[85vh] overflow-hidden p-0'));
check(normalizeDialogOverflow('overflow-y-hidden') === 'overflow-y-auto', 'overflow-y-hidden -> overflow-y-auto', normalizeDialogOverflow('overflow-y-hidden'));
check(normalizeDialogOverflow('sm:overflow-hidden') === 'sm:overflow-hidden', 'praefixierte Klasse bleibt', normalizeDialogOverflow('sm:overflow-hidden'));
check(normalizeDialogOverflow('overflow-clip p-0') === 'overflow-clip p-0', 'overflow-clip (bewusstes Clippen) bleibt', normalizeDialogOverflow('overflow-clip p-0'));
check(normalizeDialogOverflow(undefined) === undefined, 'undefined bleibt undefined', String(normalizeDialogOverflow(undefined)));

console.log(`\nErgebnis: ${pass} PASS, ${fail} FAIL`);
process.exitCode = fail === 0 ? 0 : 1;
