/**
 * Regressionstest (Abschluss 02.10.2026): keine rohen Übersetzungsschlüssel und keine kaputten deutschen Texte
 * auf den Seiten, die die Mitarbeiter-Checkliste benutzt.
 *
 * Vorher (aus HEAD): Mitarbeiter-Seitenleiste zeigte „staff.menu.repairRequests“, das Mitarbeiter-Dashboard
 * „staffDashboard.newBadge“ u. a. sowie Texte wie „Just Neinw“, „Nein Offen Aufträge“, „Stempeled In“; der
 * Modellwähler (mobil) „home.deviceSelection.noModelsFound“; die Kunden-Inspektionskarte
 * „deviceInspection.inspectionWillBeCompletedShortly“; Profil „Member Since Label“, „State“, „Notification“;
 * Admin-Seitenleiste „Customer Groups“.
 *
 *   [A] Jeder statische t('…')-Schlüssel ohne Standardtext in den geprüften Dateien existiert in de
 *       (Pluralformen _one/_other zählen) – sonst zeigt i18next den Schlüssel selbst an (en ist nur Rückfall).
 *   [B] Die deutschen Werte dieser Schlüssel enthalten keine bekannten Fehlübersetzungs-Muster.
 *   [C] Interpolationen ({{count}}, {{total}} …) der neuen Schlüssel passen zu den Aufrufen.
 *   [D] Beide Sprachdateien bleiben gültiges JSON (keine neuen doppelten Schlüssel).
 *
 * Reiner Dateitest: keine Datenbank, kein Netzwerk.
 *   node test-i18n-staff-checklist-keys.js
 */
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'client', 'src');

// Pflicht-Guard aller Repo-Tests (dieser Test verbindet sich mit keiner Datenbank).
function isUnsafeTestUri(uri) {
  const text = String(uri || '');
  const match = text.match(/^mongodb:\/\/(?:[^@/]*@)?(\[[^\]]+\]|[^:/,?]+)(?::(\d+))?\/([^/?]+)/i);
  if (!match) return true;
  const host = match[1].replace(/^\[|\]$/g, '').toLowerCase();
  const port = match[2];
  const dbName = match[3].toLowerCase();
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) return true;
  if (!port || port === '27017') return true;
  return dbName === 'fixithub';
}
if (process.env.TEST_MONGODB_URI && isUnsafeTestUri(process.env.TEST_MONGODB_URI)) {
  /* kein DB-Zugriff in diesem Test – Hinweis genügt */
}

const out = (...args) => process.stdout.write(`${args.join(' ')}\n`);
let pass = 0;
let fail = 0;
const check = (condition, message, actual) => {
  if (condition) { pass += 1; out(`  PASS ${message} :: ${actual}`); } else { fail += 1; out(`  FAIL ${message} :: ${actual}`); }
};

const FILES = [
  'components/StaffSidebar.tsx',
  'components/AdminSidebar.tsx',
  'pages/staff/StaffDashboard.tsx',
  'components/inspection/InspectionResultsDisplay.tsx',
  'components/home/RepairOrderConfigurator.tsx',
  'pages/Profile.tsx',
];
const GARBAGE = /Neint|Neinw|\bNein [A-Z]|Aktualisierend|Stempeled| Desc\b|Badge Label|Since Label| Alert\b|\bThis \w|\bOr\b|Reparaturs\b|\bFirst\b|Unavailable|Unassigned|\bWorked\b|Load Fehler|Customer Groups|^State$|^Notification$/;

const duplicateKeys = (file) => {
  const dups = [];
  const text = fs.readFileSync(file, 'utf8');
  const hook = (pairs) => { const seen = new Set(); pairs.forEach(([k]) => { if (seen.has(k)) dups.push(k); seen.add(k); }); };
  // Kleiner rekursiver Parser: JSON.parse verwirft doppelte Schlüssel stillschweigend.
  const walk = (src) => {
    let i = 0;
    const ws = () => { while (/\s/.test(src[i])) i += 1; };
    const str = () => { const start = i; i += 1; while (src[i] !== '"') { if (src[i] === '\\') i += 1; i += 1; } i += 1; return JSON.parse(src.slice(start, i)); };
    const val = () => {
      ws();
      if (src[i] === '{') {
        i += 1; const pairs = []; ws();
        if (src[i] === '}') { i += 1; return; }
        for (;;) { ws(); const k = str(); ws(); i += 1; val(); pairs.push([k]); ws(); if (src[i] === ',') { i += 1; continue; } i += 1; break; }
        hook(pairs); return;
      }
      if (src[i] === '[') { i += 1; ws(); if (src[i] === ']') { i += 1; return; } for (;;) { val(); ws(); if (src[i] === ',') { i += 1; continue; } i += 1; break; } return; }
      if (src[i] === '"') { str(); return; }
      while (i < src.length && !/[,}\]\s]/.test(src[i])) i += 1;
    };
    val();
  };
  walk(text);
  return dups;
};

function main() {
  const deFile = path.join(SRC, 'locales/de/translation.json');
  const enFile = path.join(SRC, 'locales/en/translation.json');

  out('\n[D] Sprachdateien gültig, keine neuen doppelten Schlüssel');
  let de; let en;
  try { de = JSON.parse(fs.readFileSync(deFile, 'utf8')); en = JSON.parse(fs.readFileSync(enFile, 'utf8')); check(true, 'de/en parsen', 'ok'); } catch (error) { check(false, 'de/en parsen', error.message); return; }
  const deDups = duplicateKeys(deFile); const enDups = duplicateKeys(enFile);
  // Bekannt und beabsichtigt (Bestand): 'batteryDisposal' doppelt.
  check(deDups.every((k) => k === 'batteryDisposal') && enDups.every((k) => k === 'batteryDisposal'), 'nur der bekannte Doppelschlüssel', `${deDups.join(',')} | ${enDups.join(',')}`);

  const get = (obj, key) => key.split('.').reduce((acc, part) => (acc && typeof acc === 'object' && part in acc ? acc[part] : undefined), obj);
  const lookup = (obj, key) => {
    const direct = get(obj, key);
    if (typeof direct === 'string') return [direct];
    const forms = [get(obj, `${key}_one`), get(obj, `${key}_other`)].filter((v) => typeof v === 'string');
    return forms.length ? forms : null;
  };

  const call = /\bt\(\s*(['"])([A-Za-z0-9_.-]+)\1\s*(,\s*(['"`]|\{[^}]*defaultValue))?/g;
  const missing = []; const garbage = []; let total = 0;
  FILES.forEach((rel) => {
    const src = fs.readFileSync(path.join(SRC, rel), 'utf8');
    let m;
    while ((m = call.exec(src))) {
      const key = m[2]; const hasDefault = Boolean(m[3]);
      total += 1;
      const values = lookup(de, key);
      if (!values) { if (!hasDefault) missing.push(`${rel}:${key}`); continue; }
      values.forEach((v) => { if (GARBAGE.test(v)) garbage.push(`${key}="${v}"`); });
    }
  });
  out('\n[A] Schlüssel vorhanden');
  check(total > 150, 'Aufrufe gefunden', total);
  check(missing.length === 0, 'kein t()-Schlüssel ohne deutschen Text', missing.join(' ') || 0);
  out('\n[B] keine Fehlübersetzungs-Muster');
  check(garbage.length === 0, 'deutsche Werte ohne bekannte Fehlmuster', garbage.join(' | ') || 0);

  out('\n[C] Interpolation passt');
  const expectations = [
    ['staffDashboard.minutesAgo', ['count']], ['staffDashboard.hoursAgo', ['count']], ['staffDashboard.daysAgo', ['count']],
    ['staffDashboard.dashboardUpdatedDesc', ['orders', 'repairs', 'unassigned']], ['staffDashboard.newBadge', ['count']],
    ['staffDashboard.unreadTeamChat', ['count', 'rooms']], ['staffDashboard.newCommHints', ['count']], ['staffDashboard.openBadge', ['count']],
    ['staffDashboard.overdueBadge', ['count']], ['staffDashboard.dueSoonBadge', ['count']], ['staffDashboard.changedBadge', ['count']],
    ['staffDashboard.absentBadge', ['count']], ['staffDashboard.ofOrders', ['total']],
  ];
  const bad = [];
  expectations.forEach(([key, vars]) => {
    [['de', de], ['en', en]].forEach(([lang, obj]) => {
      const values = lookup(obj, key);
      if (!values) { bad.push(`${lang}:${key} fehlt`); return; }
      values.forEach((v) => vars.forEach((name) => { if (!v.includes(`{{${name}}}`)) bad.push(`${lang}:${key} ohne {{${name}}}`); }));
    });
  });
  check(bad.length === 0, 'Platzhalter in de und en vorhanden', bad.join(' | ') || 0);
  const shown = {
    'staff.menu.repairRequests': get(de, 'staff.menu.repairRequests'),
    'home.deviceSelection.noModelsFound': get(de, 'home.deviceSelection.noModelsFound'),
    'deviceInspection.inspectionWillBeCompletedShortly': get(de, 'deviceInspection.inspectionWillBeCompletedShortly'),
    'profilePage.state': get(de, 'profilePage.state'),
  };
  check(shown['staff.menu.repairRequests'] === 'Reparaturanfragen' && typeof shown['home.deviceSelection.noModelsFound'] === 'string'
    && typeof shown['deviceInspection.inspectionWillBeCompletedShortly'] === 'string' && shown['profilePage.state'] === 'Bundesland',
  'sichtbare Beispieltexte deutsch', JSON.stringify(shown));
}

try { main(); } catch (error) { fail += 1; out(`FATAL ${error && error.stack ? error.stack : error}`); }
out(`\nErgebnis: ${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail > 0 ? 1 : 0);
