// Runde 3 – Admin "E-Mail-Verwaltung" (/admin/email): Statistik, Empfänger-Verlauf und Protokoll laden ohne Fehler,
// obwohl server/logs nicht mehr versioniert ist (Dateien liegen weiter auf der Platte). Nur Lesen, keine Test-Mail,
// kein Löschen. Inhalte (Empfänger/Betreff) werden nicht ausgegeben – nur Status, Anzahl, Abgleich mit der API.
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { makeFlow, apiLogin, api } = require('./flowlib');

const REPO = '/home/adar/Projects/FixitHub';
const NETGUARD = path.join(__dirname, 'netguard_after.log');
const ngSize = () => (fs.existsSync(NETGUARD) ? fs.statSync(NETGUARD).size : 0);
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();

(async () => {
  const f = makeFlow('r3_email_admin'); await f.start();
  const ng0 = ngSize();
  let a;
  try {
    // Ausgangslage auf der Platte (nur Pfad/Groesse/Versionierungsstatus)
    const logFile = path.join(REPO, 'server/logs/email-delivery-log.json');
    const tracked = execFileSync('git', ['-C', REPO, 'ls-files', 'server/logs'], { encoding: 'utf8' }).split('\n').filter(Boolean).length;
    const ignored = (() => { try { execFileSync('git', ['-C', REPO, 'check-ignore', '-q', 'server/logs/email-delivery-log.json']); return true; } catch (e) { return false; } })();
    f.note(`   server/logs/email-delivery-log.json vorhanden=${fs.existsSync(logFile)} Größe=${fs.existsSync(logFile) ? fs.statSync(logFile).size : 0} B; versionierte Dateien unter server/logs=${tracked}; von .gitignore erfasst=${ignored}`);
    f.check(fs.existsSync(logFile) && tracked === 0 && ignored, 'server/logs: Datei auf der Platte, nicht mehr versioniert, durch .gitignore erfasst', `tracked=${tracked}`);

    const adm = await apiLogin('admin');
    const apiStats = await api(adm, 'GET', '/api/system-config/email/delivery-stats');
    const apiAdv = await api(adm, 'GET', '/api/system-config/email/advanced-log?filter=all&smtpStatus=all&page=1&limit=20&smtpLimit=50');
    const apiHist = await api(adm, 'GET', `/api/system-config/email/delivery-history/${encodeURIComponent('partner@e2e.invalid')}?limit=20`);
    const st = apiStats.data?.stats || apiStats.data || {};
    f.note(`   API (Nachprüfung): delivery-stats ${apiStats.status} total=${st.totalRecords} sent=${st.sent} failed=${st.failed}; advanced-log ${apiAdv.status} Einträge=${(apiAdv.data?.deliveryLogs || []).length} SMTP=${(apiAdv.data?.smtpConnectionLog || []).length}; delivery-history(Test-Adresse) ${apiHist.status} Einträge=${(apiHist.data?.history || []).length}`);

    a = await f.session('admin');
    const responses = [];
    a.on('response', (r) => { const u = r.url(); if (u.includes('/api/system-config')) responses.push(`${r.status()} ${new URL(u).pathname.replace(/delivery-history\/[^/?]+/, 'delivery-history/<adresse>')}`); });
    const consoleErrors = [];
    a.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(squash(m.text()).slice(0, 160)); });
    const failedReq = [];
    a.on('requestfailed', (r) => { const u = new URL(r.url()); failedReq.push({ host: u.hostname, path: u.pathname.slice(0, 60), local: ['127.0.0.1', 'localhost'].includes(u.hostname) }); });
    await f.goto(a, '/admin/email', 5000);
    const body0 = squash(await a.locator('body').innerText());
    const ERR = /konnte nicht geladen|Failed to load|Fehler beim Laden|failedToLoad/i;
    const destructive = await a.locator('li[data-state="open"].destructive, li[data-state="open"][class*="destructive"], [role="alert"]').count();
    f.check(!ERR.test(body0) && destructive === 0, 'Seite lädt ohne Fehlermeldung/Fehler-Toast', `${destructive} Fehler-Toasts${ERR.test(body0) ? ', Fehlertext' : ''}`);
    await f.shot(a, 'email_statistik', true);
    // Statistik-Karten
    const statsCard = a.locator('[role="tabpanel"][data-state="active"]');
    const statTxt = squash(await statsCard.innerText());
    const nums = (statTxt.match(/\d+(?:[.,]\d+)?/g) || []).slice(0, 4);
    f.note(`   Statistik-Tab: ${statTxt.replace(/\d{3,}/g, '#').slice(0, 160)}`);
    f.check(apiStats.status === 200 && statTxt.includes(String(st.totalRecords || 0)) && statTxt.includes(String(st.sent || 0)) && statTxt.includes(String(st.failed || 0)), 'Statistik zeigt dieselben Zahlen wie die API (gesamt/gesendet/fehlgeschlagen)', nums.join('/'));
    // Verlauf
    await a.getByRole('tab', { name: /Verlauf|History/i }).click(); await a.waitForTimeout(800);
    await a.locator('[role="tabpanel"][data-state="active"] input[type="email"]').fill('partner@e2e.invalid');
    await a.locator('[role="tabpanel"][data-state="active"] button').first().click();
    await a.waitForTimeout(2500);
    const histPanel = a.locator('[role="tabpanel"][data-state="active"]');
    const histTxt = squash(await histPanel.innerText());
    const histItems = await histPanel.locator('div.border.rounded-lg.p-3').count();
    await f.shot(a, 'email_verlauf_testadresse', true);
    const expHist = (apiHist.data?.history || []).length;
    f.check(apiHist.status === 200 && (expHist === 0 ? /Keine|keine|No /.test(histTxt) : histItems === expHist), 'Empfänger-Verlauf (Test-Adresse) lädt und entspricht der API', `UI=${histItems} API=${expHist}`);
    // Protokoll
    await a.getByRole('tab', { name: /Protokoll|Log/i }).click(); await a.waitForTimeout(2500);
    const logPanel = a.locator('[role="tabpanel"][data-state="active"]');
    const logTxt = squash(await logPanel.innerText());
    await f.shot(a, 'email_protokoll', true);
    const expLogs = (apiAdv.data?.deliveryLogs || []).length;
    f.note(`   Protokoll-Tab: ${logTxt.replace(/\S+@\S+/g, '<adresse>').replace(/\d{3,}/g, '#').slice(0, 220)}`);
    f.check(apiAdv.status === 200 && !/konnte nicht geladen|failedToLoad|Fehler beim Laden/i.test(logTxt), 'Protokoll (advanced-log) lädt ohne Fehler', `${apiAdv.status} Einträge=${expLogs}`);
    const zugestellt = (`${body0} ${histTxt} ${logTxt}`.match(/zugestellt/gi) || []).length;
    f.check(zugestellt === 0, 'Statusbegriffe: nirgends "zugestellt" (nur angenommen/gesendet/fehlgeschlagen)', zugestellt);
    const bad = responses.filter((r) => !/^2\d\d /.test(r));
    f.note(`   Anfragen der Seite: ${[...new Set(responses)].join(' | ')}`);
    f.check(responses.length >= 3 && bad.length === 0, 'Alle /api/system-config-Anfragen der Seite mit 2xx beantwortet', bad.join(' | ') || `${responses.length} Anfragen`);
    const localFailed = failedReq.filter((r) => r.local);
    f.note(`   abgebrochene Anfragen: lokal=${localFailed.length} extern (vom Test-Harness blockiert)=${failedReq.length - localFailed.length}${failedReq.length ? ` [${[...new Set(failedReq.map((r) => r.host))].join(', ')}]` : ''}`);
    const realConsole = consoleErrors.filter((m) => !(/net::ERR_FAILED/.test(m) && localFailed.length === 0 && failedReq.length > 0));
    f.check(realConsole.length === 0 && localFailed.length === 0, 'keine Konsolenfehler der App (nur vom Harness blockierte externe Ressourcen)', realConsole.slice(0, 3).join(' | ') || `${consoleErrors.length} ERR_FAILED durch blockierte externe Hosts`);
  } catch (e) {
    if (a) await f.shot(a, 'DEBUG_admin', true).catch(() => {});
    f.check(false, `Ablauf abgebrochen: ${String(e.message).split('\n').slice(0, 3).join(' | ')}`);
  }
  f.check(ngSize() === ng0, 'netguard_after.log unverändert', `${ng0} -> ${ngSize()} B`);
  await f.finish();
})();
