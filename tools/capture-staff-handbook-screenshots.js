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

async function scrollToText(page, text) {
  const locator = page.locator(`text=${text}`).first();
  if (!(await locator.count())) {
    throw new Error(`Text nicht gefunden: ${text}`);
  }
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
}

async function clickButtonByName(page, patterns) {
  for (const pattern of patterns) {
    const button = page.getByRole('button', { name: pattern }).first();
    if (await button.count()) {
      await button.click({ timeout: 5000 }).catch(() => null);
      await page.waitForTimeout(900);
      return true;
    }
  }
  return false;
}

async function dismissOverlay(page) {
  await page.keyboard.press('Escape').catch(() => null);
  await page.waitForTimeout(300);
}

async function captureOrderDetails(page, orderPath) {
  const targets = [];
  const orderUrl = `${BASE_URL}${orderPath}`;

  await page.goto(orderUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitForPage(page, 2600);

  await page.screenshot({ path: path.join(OUTPUT_ORDER_DIR, 'order-detail-overview.png'), fullPage: false });
  targets.push('order-detail-overview.png');

  await scrollToText(page, 'Device Information');
  await page.screenshot({ path: path.join(OUTPUT_ORDER_DIR, 'order-detail-device-section.png'), fullPage: false });
  targets.push('order-detail-device-section.png');

  await scrollToText(page, 'Device Inspection');
  await page.screenshot({ path: path.join(OUTPUT_ORDER_DIR, 'order-detail-inspection-section.png'), fullPage: false });
  targets.push('order-detail-inspection-section.png');

  await scrollToText(page, 'Repair Services');
  await page.screenshot({ path: path.join(OUTPUT_ORDER_DIR, 'order-detail-repair-services.png'), fullPage: false });
  targets.push('order-detail-repair-services.png');

  await scrollToText(page, 'Repair Services');
  if (await clickButtonByName(page, [/Add Add-On/i])) {
    await page.screenshot({ path: path.join(OUTPUT_ORDER_DIR, 'order-detail-addon-dialog.png'), fullPage: false });
    targets.push('order-detail-addon-dialog.png');
    await dismissOverlay(page);
  }

  await scrollToText(page, 'Shop-Produkte');
  if (await clickButtonByName(page, [/Produkt hinzufuegen/i, /Produkt hinzufügen/i])) {
    await page.screenshot({ path: path.join(OUTPUT_ORDER_DIR, 'order-detail-shop-product-dialog.png'), fullPage: false });
    targets.push('order-detail-shop-product-dialog.png');
    await dismissOverlay(page);
  }

  await scrollToText(page, 'Repair Services');
  if (await clickButtonByName(page, [/Add EPart/i])) {
    await page.screenshot({ path: path.join(OUTPUT_ORDER_DIR, 'order-detail-epart-dialog.png'), fullPage: false });
    targets.push('order-detail-epart-dialog.png');
    await dismissOverlay(page);
  }

  await scrollToText(page, 'Workflow');
  if (await clickButtonByName(page, [/Assign Workflow/i])) {
    await page.screenshot({ path: path.join(OUTPUT_ORDER_DIR, 'order-detail-workflow-assign-dialog.png'), fullPage: false });
    targets.push('order-detail-workflow-assign-dialog.png');
    await dismissOverlay(page);
  }

  await scrollToText(page, 'Assigned Staff');
  if (await clickButtonByName(page, [/Assign Staff/i])) {
    await page.screenshot({ path: path.join(OUTPUT_ORDER_DIR, 'order-detail-staff-dialog.png'), fullPage: false });
    targets.push('order-detail-staff-dialog.png');
    await dismissOverlay(page);
  }

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
      const orderPath = await findFirstOrderPath(page);
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