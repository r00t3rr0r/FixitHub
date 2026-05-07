const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const OUTPUT_DIR = path.resolve(process.cwd(), 'screenshots/admin/dialogs');

async function loginAsAdmin(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', 'admin@example.com');
  await page.fill('#password', 'admin123');
  await Promise.all([
    page.getByRole('button', { name: /sign in/i }).click(),
    page.waitForURL(/\/admin|\/$/, { timeout: 30000 })
  ]);
  if (!page.url().includes('/admin')) {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
  }
}

async function createFailedAttempt(page) {
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', 'admin@example.com');
  await page.fill('#password', 'wrong-pass');
  await page.getByRole('button', { name: /sign in/i }).click().catch(() => null);
  await page.waitForTimeout(900);
}

async function clickIfExists(page, selector) {
  const el = page.locator(selector).first();
  if (await el.count()) {
    await el.click().catch(() => null);
    await page.waitForTimeout(700);
    return true;
  }
  return false;
}

async function captureRepairRequests(page) {
  await page.goto(`${BASE_URL}/admin/repair-requests`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  if (await clickIfExists(page, 'button.actions-button')) {
    await clickIfExists(page, '[role="menuitem"]:has-text("Details anzeigen")');
  } else {
    await clickIfExists(page, 'tbody tr');
  }

  await page.screenshot({ path: path.join(OUTPUT_DIR, '29-repair-requests-detail.png'), fullPage: false });
}

async function captureSystem(page) {
  await page.goto(`${BASE_URL}/admin/system`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  await clickIfExists(page, 'button:has-text("Vorlage anlegen")');
  await clickIfExists(page, 'button:has-text("Template")');
  await clickIfExists(page, 'button:has(svg.lucide-edit)');

  await page.screenshot({ path: path.join(OUTPUT_DIR, '60-system-configuration-detail.png'), fullPage: false });
}

async function captureEmail(page) {
  await page.goto(`${BASE_URL}/admin/email`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  await clickIfExists(page, 'button:has-text("Details")');
  await clickIfExists(page, 'button:has-text("Test")');
  await clickIfExists(page, 'button:has(svg.lucide-send)');
  await clickIfExists(page, 'button:has(svg.lucide-test-tube)');

  await page.screenshot({ path: path.join(OUTPUT_DIR, '61-email-administration-detail.png'), fullPage: false });
}

async function captureSecurity(page) {
  await page.goto(`${BASE_URL}/admin/security`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1700);

  await clickIfExists(page, 'button:has(svg.lucide-ban)');
  await clickIfExists(page, 'button:has-text("Block")');

  await page.screenshot({ path: path.join(OUTPUT_DIR, '64-security-settings-detail.png'), fullPage: false });
}

async function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    await createFailedAttempt(page);
    await loginAsAdmin(page);

    await captureRepairRequests(page);
    await captureSystem(page);
    await captureEmail(page);
    await captureSecurity(page);

    console.log('Fallback-Captures erfolgreich erstellt.');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Fehler bei Fallback-Capture:', err.message);
  process.exit(1);
});