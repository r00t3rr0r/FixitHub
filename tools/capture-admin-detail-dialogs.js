const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const OUTPUT_DIR = path.resolve(process.cwd(), 'screenshots/admin/dialogs');

const DIALOG_ROUTES = [
  { route: '/admin/users', file: '10-users-detail.png', menu: true },
  { route: '/admin/bookings', file: '20-bookings-detail.png', menu: true },
  { route: '/admin/services', file: '21-services-detail.png', menu: true },
  { route: '/admin/addons', file: '22-addons-detail.png', menu: true },
  { route: '/admin/devices', file: '24-devices-detail.png', menu: true },
  { route: '/admin/parts', file: '25-parts-detail.png', menu: true },
  { route: '/admin/epart-orders', file: '26-epart-orders-detail.png', menu: true },
  { route: '/admin/workflow', file: '27-workflow-detail.png', menu: true },
  { route: '/admin/repair-requests', file: '29-repair-requests-detail.png', menu: true },
  { route: '/admin/financial', file: '30-financial-detail.png', menu: true },
  { route: '/admin/complaints', file: '31-complaints-detail.png', menu: true },
  { route: '/admin/shop', file: '40-shop-detail.png', menu: true },
  { route: '/admin/blog', file: '41-blog-detail.png', menu: true },
  { route: '/admin/faq', file: '42-faq-detail.png', menu: true },
  { route: '/admin/marketing-promo/newsletters', file: '51-marketing-newsletters-detail.png', menu: true },
  { route: '/admin/marketing-promo/promo-codes', file: '52-marketing-promo-codes-detail.png', menu: true },
  { route: '/admin/system', file: '60-system-configuration-detail.png', menu: false },
  { route: '/admin/email', file: '61-email-administration-detail.png', menu: false },
  { route: '/admin/security', file: '64-security-settings-detail.png', menu: false }
];

const ROUTE_ACTIONS = {
  '/admin/bookings': async (page) => {
    if (await clickFirstExisting(page, ['button:has-text("Details anzeigen")'])) return true;
    if (await clickFirstExisting(page, ['tbody tr'])) {
      await page.waitForTimeout(800);
      return true;
    }
    if (await clickFirstExisting(page, ['button:has-text("Aktionen")', 'button:has(svg.lucide-more-vertical)'])) {
      return clickFirstExisting(page, ['[role="menuitem"]:has-text("Details anzeigen")']);
    }
    return false;
  },
  '/admin/repair-requests': async (page) => {
    if (await clickFirstExisting(page, ['button.actions-button'])) {
      if (await clickFirstExisting(page, ['[role="menuitem"]:has-text("Details anzeigen")'])) return true;
    }
    if (await clickFirstExisting(page, ['tbody tr'])) {
      await page.waitForTimeout(800);
      return true;
    }
    return false;
  },
  '/admin/financial': async (page) => {
    if (await clickFirstExisting(page, ['button:has-text("Details")'])) return true;
    if (await clickFirstExisting(page, ['button[value="providers"]', '[role="tab"][value="providers"]', 'button:has-text("Provider")'])) {
      await page.waitForTimeout(500);
      if (await clickFirstExisting(page, ['button:has-text("Konfigurieren")'])) return true;
    }
    return clickFirstExisting(page, ['button:has-text("Konfigurieren")']);
  },
  '/admin/system': async (page) => {
    if (await clickFirstExisting(page, ['button:has-text("Vorlage anlegen")', 'button:has-text("Template")'])) return true;
    return clickFirstExisting(page, ['button:has(svg.lucide-edit)']);
  },
  '/admin/email': async (page) => {
    if (await clickFirstExisting(page, ['button:has-text("Details")'])) return true;
    if (await clickFirstExisting(page, ['button:has-text("Test")', 'button:has-text("E-Mail")'])) return true;
    return clickFirstExisting(page, ['button:has(svg.lucide-send)', 'button:has(svg.lucide-test-tube)']);
  },
  '/admin/security': async (page) => {
    return clickFirstExisting(page, ['button:has(svg.lucide-ban)', 'button:has-text("Block")']);
  }
};

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

async function createFailedLoginAttempt(page) {
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', 'admin@example.com');
  await page.fill('#password', 'invalid-password');
  await page.getByRole('button', { name: /sign in/i }).click().catch(() => null);
  await page.waitForTimeout(900);
}

async function clickFirstExisting(page, locators) {
  for (const locator of locators) {
    const el = page.locator(locator).first();
    if (await el.count()) {
      await el.click({ timeout: 3000 }).catch(() => null);
      await page.waitForTimeout(700);
      return true;
    }
  }
  return false;
}

async function openLikelyDialog(page, useMenu) {
  const routePath = new URL(page.url()).pathname;
  if (ROUTE_ACTIONS[routePath]) {
    const handled = await ROUTE_ACTIONS[routePath](page);
    if (handled) {
      await page.waitForTimeout(550);
      return true;
    }
  }

  const directButtons = [
    'button:has-text("Details")',
    'button:has-text("Detail")',
    'button:has-text("Anzeigen")',
    'button:has-text("View")',
    'button:has-text("Bearbeiten")',
    'button:has-text("Edit")',
    'button:has-text("Neu")',
    'button:has-text("New")',
    'button:has-text("Erstellen")',
    'button:has-text("Create")',
    'button:has-text("Hinzufuegen")',
    'button:has-text("Add")',
    'button:has-text("Konfigurieren")',
    'button:has-text("Settings")',
    '[aria-label*="Detail"]',
    '[aria-label*="Details"]',
    '[aria-label*="Edit"]',
    '[aria-label*="Bearbeiten"]',
    '[aria-label*="Add"]',
    '[aria-label*="Create"]',
    '[title*="Detail"]',
    '[title*="Details"]',
    '[title*="Edit"]',
    '[title*="Bearbeiten"]',
    'a:has-text("Details")',
    'a:has-text("Anzeigen")',
    'a:has-text("Bearbeiten")',
    'a:has-text("Edit")'
  ];

  if (await clickFirstExisting(page, directButtons)) {
    return true;
  }

  if (!useMenu) {
    return false;
  }

  const menuButtons = [
    'button[aria-haspopup="menu"]',
    'button:has-text("Aktionen")',
    'button:has-text("Actions")',
    '[aria-label*="Actions"]',
    '[aria-label*="Aktionen"]',
    '[aria-label*="Mehr"]'
  ];

  const openedMenu = await clickFirstExisting(page, menuButtons);
  if (!openedMenu) {
    return false;
  }

  const menuItems = [
    '[role="menuitem"]:has-text("Details")',
    '[role="menuitem"]:has-text("Detail")',
    '[role="menuitem"]:has-text("Anzeigen")',
    '[role="menuitem"]:has-text("View")',
    '[role="menuitem"]:has-text("Bearbeiten")',
    '[role="menuitem"]:has-text("Edit")',
    '[role="menuitem"]:has-text("Open")'
  ];

  return clickFirstExisting(page, menuItems);
}

async function waitForDialog(page) {
  const selectors = [
    '[role="dialog"]',
    '[data-state="open"]',
    '.modal',
    '.dialog-content',
    '.fixed.inset-0'
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count()) {
      await page.waitForTimeout(500);
      return true;
    }
  }

  return false;
}

async function isLikelyDetailPageNavigation(page, route) {
  const currentPath = new URL(page.url()).pathname;
  if (currentPath !== route) {
    return true;
  }

  const headingHints = [
    'h1:has-text("Detail")',
    'h2:has-text("Detail")',
    'h1:has-text("Bearbeiten")',
    'h2:has-text("Bearbeiten")',
    'h1:has-text("Edit")',
    'h2:has-text("Edit")',
    'h1:has-text("Neu")',
    'h2:has-text("Neu")'
  ];

  for (const selector of headingHints) {
    const locator = page.locator(selector).first();
    if (await locator.count()) {
      return true;
    }
  }

  return false;
}

async function captureDialogs() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  const results = [];

  try {
    await createFailedLoginAttempt(page);
    await loginAsAdmin(page);

    for (const item of DIALOG_ROUTES) {
      const target = `${BASE_URL}${item.route}`;
      const outputPath = path.join(OUTPUT_DIR, item.file);

      try {
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(1700);

        const opened = await openLikelyDialog(page, item.menu);
        if (!opened) {
          throw new Error('Kein Detail- oder Bearbeitungsdialog ausloesbar');
        }

        const hasDialog = await waitForDialog(page);
        if (!hasDialog) {
          const isDetailPage = await isLikelyDetailPageNavigation(page, item.route);
          if (!isDetailPage) {
            throw new Error('Dialog oder Detailseite wurde nicht erkannt');
          }
        }

        await page.screenshot({ path: outputPath, fullPage: false });
        results.push({ ...item, ok: true });
        console.log(`OK  ${item.file} <- ${item.route}`);

        await page.keyboard.press('Escape').catch(() => null);
        await page.waitForTimeout(350);
      } catch (error) {
        results.push({ ...item, ok: false, error: error.message });
        console.log(`ERR ${item.file} <- ${item.route} :: ${error.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  const success = results.filter((r) => r.ok).length;
  const failed = results.length - success;
  console.log(`\nDetaildialoge erfasst. Success: ${success}, Failed: ${failed}`);

  if (failed > 0) {
    fs.writeFileSync(
      path.join(OUTPUT_DIR, '_capture-report.json'),
      JSON.stringify(results, null, 2),
      'utf8'
    );
    process.exitCode = 1;
  }
}

captureDialogs().catch((err) => {
  console.error('Fatal detail screenshot error:', err);
  process.exit(1);
});