// Gemeinsame Helfer fuer die echten Browser-Ablaeufe (Playwright, nur lokal, externe Requests blockiert).
const fs = require('fs');
const path = require('path');
const { chromium } = require('/home/adar/Projects/FixitHub/node_modules/playwright');

const DIR = __dirname;
const S = path.resolve(DIR, '..');
const BASE = process.env.E2E_BASE || 'http://127.0.0.1:5199';
const API = process.env.E2E_API || 'http://127.0.0.1:5099';
const PW = fs.readFileSync(path.join(DIR, '.pw'), 'utf8').trim();
const ADMIN_PW = fs.readFileSync(path.join(DIR, '.adminpw'), 'utf8').trim();
const CREDS = {
  customer: ['partner@e2e.invalid', PW], other: ['fremd@e2e.invalid', PW],
  staff: ['staff@e2e.invalid', PW], admin: ['admin@example.com', ADMIN_PW], kasse: ['kasse@e2e.invalid', PW],
};
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(BASE) || !/^http:\/\/127\.0\.0\.1:\d+$/.test(API)) throw new Error('nur lokal');

function makeFlow(name) {
  const out = path.join(S, 'flows', name);
  fs.mkdirSync(out, { recursive: true });
  const log = [];
  let pass = 0; let fail = 0; let shotNo = 0;
  const note = (s) => { console.log(s); log.push(s); };
  const check = (cond, msg, actual = '') => { if (cond) { pass += 1; note(`  PASS ${msg} ${actual !== '' ? `:: ${actual}` : ''}`); } else { fail += 1; note(`  FAIL ${msg} ${actual !== '' ? `:: ${actual}` : ''}`); } return !!cond; };
  let browser;
  const contexts = [];
  return {
    out, note, check,
    async start() { browser = await chromium.launch({ headless: true, executablePath: '/home/adar/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell' }); },
    async session(role, viewport = [1366, 768]) {
      const statePathEarly = path.join(DIR, `state_${role}.json`);
      const ctx = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, locale: 'de-DE', acceptDownloads: true,
        ...(role && role !== 'guest' && fs.existsSync(statePathEarly) ? { storageState: statePathEarly } : {}) });
      contexts.push(ctx);
      await ctx.route('**/*', (route) => {
        const u = new URL(route.request().url());
        if (['127.0.0.1', 'localhost'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol)) return route.continue();
        return route.abort();
      });
      const statePath = path.join(DIR, `state_${role}.json`);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => note(`   [pageerror ${role}] ${String(e.message).slice(0, 200)}`));
      if (role && role !== 'guest' && fs.existsSync(statePath)) {
        // gespeicherte Sitzung pruefen (Login-Rate-Limit schonen): App muss eingeloggt sein
        await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForTimeout(2500);
        if (!page.url().includes('/login')) return page;
        fs.unlinkSync(statePath);
      }
      if (role && role !== 'guest') {
        await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('input[type="email"]', { timeout: 120000 });
        await page.fill('input[type="email"]', CREDS[role][0]);
        await page.fill('#password', CREDS[role][1]);
        await page.press('#password', 'Enter');
        await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(1500);
        fs.writeFileSync(statePath, JSON.stringify(await ctx.storageState()));
      }
      return page;
    },
    async shot(page, label, fullPage = false) {
      shotNo += 1;
      const file = path.join(out, `${String(shotNo).padStart(2, '0')}_${label}.png`);
      if (fullPage) {
        // Die App scrollt in eigenen Containern (Admin-Shell). Fuer den Nachweis werden diese Container
        // kurz aufgeklappt, damit der Ganzseiten-Screenshot den vollstaendigen Inhalt zeigt; danach
        // werden die urspruenglichen Inline-Stile wiederhergestellt.
        await page.evaluate(() => {
          const changed = [];
          const isDialogOpen = !!document.querySelector('[role="dialog"], [role="alertdialog"]');
          if (!isDialogOpen) {
            for (const el of Array.from(document.querySelectorAll('body *'))) {
              const cs = getComputedStyle(el);
              if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 200) {
                let node = el;
                while (node && node !== document.documentElement) {
                  if (!node.hasAttribute('data-e2e-shot')) {
                    changed.push(node);
                    node.setAttribute('data-e2e-shot', node.getAttribute('style') || '');
                    node.style.overflow = 'visible';
                    node.style.height = 'auto';
                    node.style.maxHeight = 'none';
                  }
                  node = node.parentElement;
                }
              }
            }
          }
          window.__e2eShotChanged = changed.length;
        }).catch(() => {});
      }
      await page.screenshot({ path: file, fullPage });
      if (fullPage) {
        await page.evaluate(() => {
          for (const node of Array.from(document.querySelectorAll('[data-e2e-shot]'))) {
            const prev = node.getAttribute('data-e2e-shot');
            if (prev) node.setAttribute('style', prev); else node.removeAttribute('style');
            node.removeAttribute('data-e2e-shot');
          }
        }).catch(() => {});
      }
      note(`   [shot] ${path.basename(file)}`);
      return file;
    },
    async goto(page, p, settle = 2000) { await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(settle); },
    async finish() {
      for (const c of contexts) await c.close().catch(() => {});
      if (browser) await browser.close();
      note(`==== ${name}: ${pass} bestanden, ${fail} fehlgeschlagen ====`);
      fs.writeFileSync(path.join(out, 'result.log'), log.join('\n'));
      process.exitCode = fail === 0 ? 0 : 1;
    },
  };
}

// API-Helfer (gleiche Cookies/CSRF-Logik wie die App) - nur fuer Vorbereitung/Nachpruefung, nicht fuer die geprueften Schritte.
async function apiLogin(role) {
  const statePath = path.join(DIR, `state_${role}.json`);
  if (fs.existsSync(statePath)) {
    const st = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const cookies = (st.cookies || []).filter((c) => ['127.0.0.1', 'localhost'].includes(c.domain)).map((c) => `${c.name}=${c.value}`).join('; ');
    const probe = await fetch(`${API}/api/auth/me`, { headers: { Cookie: cookies } });
    if (probe.status === 200) return { token: null, cookies };
  }
  const [email, password] = CREDS[role];
  const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const body = await res.json().catch(() => ({}));
  const cookies = (res.headers.getSetCookie ? res.headers.getSetCookie() : []).map((c) => c.split(';')[0]).join('; ');
  return { token: body.accessToken || body.token, cookies };
}
async function api(auth, method, url, body) {
  const headers = { ...(body ? { 'Content-Type': 'application/json' } : {}) };
  if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
  if (auth?.cookies) { headers.Cookie = auth.cookies; const c = (auth.cookies.match(/(?:^|; )csrf_token=([^;]+)/) || [])[1]; if (c) headers['X-CSRF-Token'] = decodeURIComponent(c); }
  const res = await fetch(`${API}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
async function dumpControls(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('button, a[href], input, textarea, select, [role=tab], [role=button]'))
    .filter((el) => el.offsetParent !== null)
    .map((el) => `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[${el.getAttribute('role')}]` : ''} "${(el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 70)}"${el.getAttribute('href') ? ` -> ${el.getAttribute('href')}` : ''}`)
    .slice(0, 160));
}
module.exports = { makeFlow, apiLogin, api, dumpControls, BASE, API, S };
