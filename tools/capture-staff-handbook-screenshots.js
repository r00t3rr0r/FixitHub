const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const OUTPUT_DIR = path.resolve(process.cwd(), 'screenshots/staff');
const OUTPUT_ORDER_DIR = path.join(OUTPUT_DIR, 'order-details');

const PAGE_ROUTES = [
  { route: '/staff', file: '01-dashboard.png', waitMs: 2200 },
  { route: '/staff/orders', file: '02-orders.png', waitMs: 2400 },
  { route: '/staff/repair-requests', file: '03-repair-requests.png', waitMs: 2400 },
  { route: '/staff/bookings', file: '04-bookings.png', waitMs: 2400 },
  { route: '/staff/time-tracking', file: '05-time-tracking.png', waitMs: 2200 },
  { route: '/staff/schedule', file: '06-schedule.png', waitMs: 1800 },
  { route: '/staff/knowledge-base', file: '07-knowledge-base.png', waitMs: 2200 },
  { route: '/staff/chat', file: '08-team-chat.png', waitMs: 2200 },
  { route: '/staff/performance', file: '09-performance.png', waitMs: 1800 },
  { route: '/messages', file: '10-messages.png', waitMs: 2000 },
  { route: '/notifications', file: '11-notifications.png', waitMs: 2000 },
  { route: '/profile', file: '12-profile.png', waitMs: 2200 },
];

async function loginAsStaff(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.fill('#email', 'staff@example.com');
  await page.fill('#password', 'password123');

  await Promise.all([
    page.getByRole('button', { name: /sign in/i }).click(),
    page.waitForURL(/\/staff|\/$/, { timeout: 30000 }),
  ]);

  if (!page.url().includes('/staff')) {
    await page.goto(`${BASE_URL}/staff`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }
}

async function waitForPage(page, waitMs = 1800) {
  await page.waitForTimeout(waitMs);
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
  await page.waitForTimeout(250);
}

async function capturePage(page, route, outputPath, waitMs) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitForPage(page, waitMs);
  await page.screenshot({ path: outputPath, fullPage: false });
}

async function findFirstOrderPath(page) {
  const routeCandidates = ['/staff/orders', '/staff', '/staff/bookings'];

  for (const route of routeCandidates) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2200);

    const directLink = page.locator('a[href*="/orders/"]').first();
    if (await directLink.count()) {
      const href = await directLink.getAttribute('href');
      if (href) return href;
    }

    const viewButton = page.getByRole('button', { name: /view order|details|anzeigen/i }).first();
    if (await viewButton.count()) {
      await viewButton.click({ timeout: 5000 }).catch(() => null);
      await page.waitForTimeout(2500);
      const currentPath = new URL(page.url()).pathname;
      if (currentPath.includes('/orders/')) {
        return currentPath;
      }
    }
  }

  throw new Error('Kein Auftrag aus der Staff-Ansicht auffindbar');
}

async function scrollToSelector(page, selector) {
  const locator = page.locator(selector).first();
  if (!(await locator.count())) {
    return false;
  }
  await locator.scrollIntoViewIfNeeded().catch(() => null);
  await page.waitForTimeout(700);
  return true;
}

async function clickButtonByName(page, patterns) {
  for (const pattern of patterns) {
    const button = page.getByRole('button', { name: pattern }).first();
    if (await button.count()) {
      await button.scrollIntoViewIfNeeded().catch(() => null);
      await button.click({ timeout: 5000 }).catch(() => null);
      await page.waitForTimeout(1100);
      return true;
    }
  }
  return false;
}

async function dismissOverlay(page) {
  await page.keyboard.press('Escape').catch(() => null);
  await page.waitForTimeout(400);
  // Some dialogs are nested; press a second time to be safe.
  await page.keyboard.press('Escape').catch(() => null);
  await page.waitForTimeout(300);
}

async function shot(page, dir, file, targets) {
  await page.screenshot({ path: path.join(dir, file), fullPage: false });
  targets.push(file);
  console.log(`OK  ${file}`);
}

// Capture a section by scrolling its anchor element into view.
async function captureSection(page, selector, file, targets) {
  const found = await scrollToSelector(page, selector);
  if (!found) {
    console.log(`SKIP ${file} (selector not found: ${selector})`);
    return;
  }
  await shot(page, OUTPUT_ORDER_DIR, file, targets);
}

// Open a dialog via a trigger button, screenshot it, then close it.
async function captureDialog(page, { anchor, buttons, file, targets, preWaitMs = 1200 }) {
  if (anchor) {
    await scrollToSelector(page, anchor);
  }
  const opened = await clickButtonByName(page, buttons);
  if (!opened) {
    console.log(`SKIP ${file} (trigger button not found)`);
    return;
  }
  await page.waitForTimeout(preWaitMs);
  await shot(page, OUTPUT_ORDER_DIR, file, targets);
  await dismissOverlay(page);
}

async function captureOrderDetails(page, orderPath) {
  const targets = [];
  const orderUrl = `${BASE_URL}${orderPath}`;

  await page.goto(orderUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitForPage(page, 2800);

  // --- Section overviews (scroll through the whole order workspace) ---
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(400);
  await shot(page, OUTPUT_ORDER_DIR, 'order-detail-overview.png', targets);

  await captureSection(page, '#order-device-info', 'order-detail-device-section.png', targets);
  await captureSection(page, '#order-device-inspection', 'order-detail-inspection-section.png', targets);
  await captureSection(page, '#order-eparts', 'order-detail-eparts-section.png', targets);
  await captureSection(page, '#order-progress', 'order-detail-progress-section.png', targets);
  await captureSection(page, '#order-workflows', 'order-detail-workflows-section.png', targets);
  await captureSection(page, '#order-repair-info', 'order-detail-repair-services.png', targets);
  await captureSection(page, '#order-quick-actions', 'order-detail-quick-actions.png', targets);
  await captureSection(page, '#order-staff', 'order-detail-staff-section.png', targets);

  // --- Header status dropdown ---
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(500);
  if (await clickButtonByName(page, [/In Progress|Pending|In Bearbeitung|Ausstehend|Quality Check|Ready for Pickup|Completed|Paused|Cancelled/i])) {
    await page.waitForTimeout(600);
    await shot(page, OUTPUT_ORDER_DIR, 'order-detail-status-dropdown.png', targets);
    await dismissOverlay(page);
  } else {
    console.log('SKIP order-detail-status-dropdown.png (status button not found)');
  }

  // --- Dialogs ---
  await captureDialog(page, {
    anchor: '#order-device-info',
    buttons: [/^Edit$/i, /Bearbeiten/i],
    file: 'order-detail-device-change-dialog.png',
    targets,
  });

  await captureDialog(page, {
    anchor: '#order-device-inspection',
    buttons: [/Start Device Inspection/i, /Continue Inspection/i, /Inspektion/i],
    file: 'order-detail-inspection-dialog.png',
    targets,
    preWaitMs: 1600,
  });

  await captureDialog(page, {
    anchor: '#order-eparts',
    buttons: [/Add EPart/i],
    file: 'order-detail-epart-dialog.png',
    targets,
  });

  await captureDialog(page, {
    anchor: '#order-workflows',
    buttons: [/Assign Workflow/i],
    file: 'order-detail-workflow-assign-dialog.png',
    targets,
  });

  await captureDialog(page, {
    anchor: '#order-repair-info',
    buttons: [/Add Service/i],
    file: 'order-detail-service-dialog.png',
    targets,
  });

  await captureDialog(page, {
    anchor: '#order-repair-info',
    buttons: [/Add Add-On/i],
    file: 'order-detail-addon-dialog.png',
    targets,
  });

  await captureDialog(page, {
    anchor: '#order-repair-info',
    buttons: [/Produkt hinzufügen/i, /Produkt hinzufuegen/i],
    file: 'order-detail-shop-product-dialog.png',
    targets,
  });

  await captureDialog(page, {
    anchor: '#order-quick-actions-communication',
    buttons: [/Rückmeldung/i, /Rueckmeldung/i],
    file: 'order-detail-communication-feedback-dialog.png',
    targets,
  });

  await captureDialog(page, {
    anchor: '#order-quick-actions-communication',
    buttons: [/^Aktion$/i],
    file: 'order-detail-communication-action-dialog.png',
    targets,
  });

  await captureDialog(page, {
    anchor: '#order-staff',
    buttons: [/Assign Staff/i],
    file: 'order-detail-staff-dialog.png',
    targets,
  });

  return targets;
}

async function capture() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_ORDER_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  const results = [];

  try {
    await loginAsStaff(page);

    for (const item of PAGE_ROUTES) {
      try {
        const outputPath = path.join(OUTPUT_DIR, item.file);
        await capturePage(page, item.route, outputPath, item.waitMs);
        results.push({ type: 'page', ...item, ok: true });
        console.log(`OK  ${item.file} <- ${item.route}`);
      } catch (error) {
        results.push({ type: 'page', ...item, ok: false, error: error.message });
        console.log(`ERR ${item.file} <- ${item.route} :: ${error.message}`);
      }
    }

    try {
      const orderPath = process.env.ORDER_PATH || await findFirstOrderPath(page);
      const orderFiles = await captureOrderDetails(page, orderPath);
      orderFiles.forEach((file) => {
        results.push({ type: 'order-details', file, route: orderPath, ok: true });
        console.log(`OK  ${file} <- ${orderPath}`);
      });
    } catch (error) {
      results.push({ type: 'order-details', ok: false, error: error.message });
      console.log(`ERR order-details :: ${error.message}`);
    }
  } finally {
    await browser.close();
  }

  const reportPath = path.join(OUTPUT_DIR, '_capture-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');

  const success = results.filter((entry) => entry.ok).length;
  const failed = results.length - success;
  console.log(`\nStaff handbook screenshots captured. Success: ${success}, Failed: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

capture().catch((error) => {
  console.error('Fatal staff screenshot error:', error);
  process.exit(1);
});