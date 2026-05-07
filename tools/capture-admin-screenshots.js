const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const OUTPUT_DIR = path.resolve(process.cwd(), 'screenshots/admin');

const ROUTES = [
  { route: '/admin', file: '01-dashboard.png' },
  { route: '/messages', file: '02-messages.png' },
  { route: '/notifications', file: '03-notifications.png' },
  { route: '/profile', file: '04-profile.png' },

  { route: '/admin/users', file: '10-users.png' },
  { route: '/admin/customer-groups', file: '11-customer-groups.png' },
  { route: '/admin/staff', file: '12-staff-management.png' },

  { route: '/admin/bookings', file: '20-bookings.png' },
  { route: '/admin/services', file: '21-services.png' },
  { route: '/admin/addons', file: '22-addons.png' },
  { route: '/admin/service-categories', file: '23-service-categories.png' },
  { route: '/admin/devices', file: '24-devices.png' },
  { route: '/admin/parts', file: '25-parts.png' },
  { route: '/admin/epart-orders', file: '26-epart-orders.png' },
  { route: '/admin/workflow', file: '27-workflow.png' },
  { route: '/admin/analytics', file: '28-analytics.png' },
  { route: '/admin/repair-requests', file: '29-repair-requests.png' },
  { route: '/admin/financial', file: '30-financial.png' },
  { route: '/admin/complaints', file: '31-complaints.png' },

  { route: '/admin/shop', file: '40-shop.png' },
  { route: '/admin/blog', file: '41-blog.png' },
  { route: '/admin/faq', file: '42-faq.png' },
  { route: '/admin/homepage', file: '43-homepage.png' },
  { route: '/admin/website-builder', file: '44-website-builder.png' },
  { route: '/admin/visual-builder/demo-page', file: '45-visual-builder.png' },
  { route: '/admin/seo', file: '46-seo.png' },

  { route: '/admin/marketing-promo', file: '50-marketing-overview.png' },
  { route: '/admin/marketing-promo/newsletters', file: '51-marketing-newsletters.png' },
  { route: '/admin/marketing-promo/promo-codes', file: '52-marketing-promo-codes.png' },
  { route: '/admin/marketing-promo/segments', file: '53-marketing-segments.png' },
  { route: '/admin/marketing-promo/reports', file: '54-marketing-reports.png' },
  { route: '/admin/marketing-promo/settings', file: '55-marketing-settings.png' },

  { route: '/admin/system', file: '60-system-configuration.png' },
  { route: '/admin/email', file: '61-email-administration.png' },
  { route: '/admin/live-tracking', file: '62-live-tracking.png' },
  { route: '/admin/database', file: '63-database-management.png' },
  { route: '/admin/security', file: '64-security-settings.png' },
];

async function loginAsAdmin(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', 'admin@example.com');
  await page.fill('#password', 'admin123');

  await Promise.all([
    page.getByRole('button', { name: /sign in/i }).click(),
    page.waitForURL(/\/admin|\/$/, { timeout: 30000 }),
  ]);

  if (!page.url().includes('/admin')) {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
  }
}

async function capture() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const results = [];

  try {
    await loginAsAdmin(page);

    for (const item of ROUTES) {
      const targetUrl = `${BASE_URL}${item.route}`;
      const targetPath = path.join(OUTPUT_DIR, item.file);

      try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(2200);
        await page.screenshot({ path: targetPath, fullPage: false });
        results.push({ ...item, ok: true });
        console.log(`OK  ${item.file}  <- ${item.route}`);
      } catch (err) {
        results.push({ ...item, ok: false, error: err.message });
        console.log(`ERR ${item.file}  <- ${item.route} :: ${err.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;
  console.log(`\nFinished. Success: ${ok}, Failed: ${fail}`);

  if (fail > 0) {
    process.exitCode = 1;
  }
}

capture().catch((err) => {
  console.error('Fatal screenshot error:', err);
  process.exit(1);
});
