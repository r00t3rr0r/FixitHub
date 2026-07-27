// Load environment variables from the root directory
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Add startup logging
console.log('=== McRepair.de Server Starting ===');
console.log('Environment variables check:');
console.log('- PORT:', process.env.PORT || 3000);
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Missing');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Missing');
console.log('- REFRESH_TOKEN_SECRET:', process.env.REFRESH_TOKEN_SECRET ? 'Set' : 'Missing');

console.log('Loading mongoose...');
const mongoose = require("mongoose");
console.log('Loading express...');
const express = require("express");
console.log('Loading cookie parser...');
const cookieParser = require('cookie-parser');

console.log('Loading basic routes...');
const basicRoutes = require("./routes/index");
console.log('Loading auth routes...');
const authRoutes = require("./routes/authRoutes");
console.log('Loading user routes...');
const userRoutes = require("./routes/userRoutes");
console.log('Loading service routes...');
const serviceRoutes = require("./routes/serviceRoutes");
console.log('Loading addon service routes...');
const addOnServiceRoutes = require("./routes/addOnServiceRoutes");
console.log('Loading service category routes...');
const serviceCategoryRoutes = require("./routes/serviceCategoryRoutes");
console.log('Loading admin routes...');
const adminRoutes = require("./routes/adminRoutes");
console.log('Loading order routes...');
const orderRoutes = require("./routes/orderRoutes");
console.log('Loading admin order routes...');
const adminOrderRoutes = require("./routes/adminOrderRoutes");
console.log('Loading message routes...');
const messageRoutes = require("./routes/messageRoutes");
console.log('Loading seed routes...');
const seedRoutes = require("./routes/seedRoutes");
console.log('Loading inventory routes...');
const inventoryRoutes = require("./routes/inventoryRoutes");
console.log('Loading blog routes...');
const blogRoutes = require("./routes/blogRoutes");
console.log('Loading FAQ routes...');
const faqRoutes = require("./routes/faqRoutes");
console.log('Loading workflow routes...');
const workflowRoutes = require("./routes/workflowRoutes");
console.log('Loading device routes...');
const deviceRoutes = require("./routes/deviceRoutes");
console.log('Loading notification routes...');
const notificationRoutes = require("./routes/notificationRoutes");
console.log('Loading team chat routes...');
const teamChatRoutes = require("./routes/teamChatRoutes");
console.log('Loading performance routes...');
const performanceRoutes = require("./routes/performanceRoutes");
console.log('Loading schedule routes...');
const scheduleRoutes = require("./routes/scheduleRoutes");
console.log('Loading product routes...');
const productRoutes = require("./routes/productRoutes");
console.log('Loading SEO routes...');
const seoRoutes = require("./routes/seoRoutes");
console.log('Loading cart routes...');
const cartRoutes = require("./routes/cartRoutes");
console.log('Loading homepage routes...');
const homepageRoutes = require("./routes/homepageRoutes");
console.log('Loading diagnostic routes...');
const diagnosticRoutes = require("./routes/diagnosticRoutes");
console.log('Loading staff management routes...');
const staffManagementRoutes = require("./routes/staffManagementRoutes");
console.log('Loading system config routes...');
const systemConfigRoutes = require("./routes/systemConfigRoutes");
console.log('Loading financial routes...');
const financialRoutes = require("./routes/financialRoutes");
console.log('Loading database routes...');
const databaseRoutes = require("./routes/databaseRoutes");
console.log('Loading security routes...');
const securityRoutes = require("./routes/securityRoutes");
console.log('Loading epart order routes...');
const epartOrderRoutes = require("./routes/epartOrderRoutes");
console.log('Loading need list routes...');
const needListRoutes = require("./routes/needListRoutes");
console.log('Loading device inspection routes...');
const deviceInspectionRoutes = require("./routes/deviceInspectionRoutes");
console.log('Loading inspection communication routes...');
const inspectionCommunicationRoutes = require("./routes/inspectionCommunicationRoutes");
console.log('Loading repair request communication routes...');
const repairRequestCommunicationRoutes = require("./routes/repairRequestCommunicationRoutes");
console.log('Loading language routes...');
const languageRoutes = require("./routes/languageRoutes");
console.log('Loading checkout routes...');
const checkoutRoutes = require("./routes/checkoutRoutes");
console.log('Loading order tracking routes...');
const orderTrackingRoutes = require("./routes/orderTrackingRoutes");
console.log('Loading order service routes...');
const orderServiceRoutes = require("./routes/orderServiceRoutes");
console.log('Loading booking routes...');
const bookingRoutes = require("./routes/bookingRoutes");
console.log('Loading complaint routes...');
const complaintRoutes = require("./routes/complaintRoutes");
console.log('Loading reminder routes...');
const reminderRoutes = require("./routes/reminderRoutes");
console.log('Loading invoice routes...');
const invoiceRoutes = require("./routes/invoiceRoutes");
console.log('Loading website settings routes...');
const websiteSettingsRoutes = require("./routes/websiteSettingsRoutes");
console.log('Loading page content routes...');
const pageContentRoutes = require("./routes/pageContentRoutes");
console.log('Loading page template routes...');
const pageTemplateRoutes = require("./routes/pageTemplateRoutes");
console.log('Loading CSV import routes...');
const csvImportRoutes = require("./routes/csvImportRoutes");
console.log('Loading CSV service import routes...');
const csvServiceImportRoutes = require("./routes/csvServiceImportRoutes");
console.log('Loading CSV add-on import routes...');
const csvAddOnImportRoutes = require("./routes/csvAddOnImportRoutes");
console.log('Loading CSV parts import routes...');
const csvPartsImportRoutes = require("./routes/csvPartsImportRoutes");
console.log('Loading CSV product import routes...');
const csvProductImportRoutes = require("./routes/csvProductImportRoutes");
console.log('Loading repair request routes...');
const repairRequestRoutes = require("./routes/repairRequestRoutes");
console.log('Loading repair workflow routes...');
const repairWorkflowRoutes = require("./routes/repairWorkflowRoutes");
console.log('Loading time tracking routes...');
const timeTrackingRoutes = require("./routes/timeTrackingRoutes");
console.log('Loading admin dashboard routes...');
const adminDashboardRoutes = require("./routes/adminDashboardRoutes");
console.log('Loading admin analytics routes...');
const adminAnalyticsRoutes = require("./routes/adminAnalyticsRoutes");
console.log('Loading customer group routes...');
const customerGroupRoutes = require("./routes/customerGroupRoutes");
console.log('Loading contact routes...');
const contactRoutes = require("./routes/contactRoutes");
console.log('Loading admin contact routes...');
const adminContactRoutes = require("./routes/adminContactRoutes");
console.log('Loading admin live tracking routes...');
const adminLiveTrackingRoutes = require("./routes/adminLiveTrackingRoutes");
console.log('Loading marketing promo routes...');
const marketingPromoRoutes = require('./routes/marketingPromoRoutes');

console.log('Loading database config...');
const { connectDB } = require("./config/database");
console.log('Loading SeedService...');
const SeedService = require("./services/seedService");
console.log('Loading cors...');
const cors = require("cors");
const { requireCsrfProtection } = require('./routes/middleware/csrf');
const { applySecurityHeaders } = require('./routes/middleware/securityHeaders');

if (!process.env.DATABASE_URL) {
  console.error("Error: DATABASE_URL variables in .env missing.");
  process.exit(-1);
}

if (!process.env.JWT_SECRET) {
  console.error("Error: JWT_SECRET variable in .env missing.");
  process.exit(-1);
}

if (!process.env.REFRESH_TOKEN_SECRET) {
  console.error("Error: REFRESH_TOKEN_SECRET variable in .env missing.");
  process.exit(-1);
}

console.log('Creating Express app...');
const app = express();
const port = process.env.PORT || 3000;
const parsedRequestLimitMb = Number.parseInt(process.env.MAX_REQUEST_SIZE_MB || '', 10);
const requestLimitMb = Number.isFinite(parsedRequestLimitMb) && parsedRequestLimitMb > 0 ? parsedRequestLimitMb : 50;
const requestLimit = `${requestLimitMb}mb`;

const allowedOrigins = String(process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.set('trust proxy', 1);
app.disable('x-powered-by');

// Pretty-print JSON responses
app.enable('json spaces');
// We want to be consistent with URL paths, so we enable strict routing
app.enable('strict routing');

console.log('Setting up middleware...');
app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('CORS origin denied'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
}));
// Increase payload size limits to handle large file uploads and data payloads
app.use(cookieParser());
app.use(applySecurityHeaders);
app.use(express.json({ limit: requestLimit }));
app.use(express.urlencoded({ extended: true, limit: requestLimit }));
app.use(requireCsrfProtection);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve public assets (including brand logos)
app.use('/assets', express.static(path.join(__dirname, '../public/assets')));

// Serve robots.txt from frontend public folder for crawlers hitting backend directly
app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/robots.txt'));
});

const sanitizeHeadersForLogs = (headers = {}) => {
  const sanitized = { ...headers };

  if (sanitized.authorization) {
    sanitized.authorization = '[REDACTED]';
  }
  if (sanitized.cookie) {
    sanitized.cookie = '[REDACTED]';
  }
  if (sanitized['x-csrf-token']) {
    sanitized['x-csrf-token'] = '[REDACTED]';
  }

  return sanitized;
};

// Add request logging middleware with payload size monitoring
app.use((req, res, next) => {
  // Get the content-length header to track request payload size
  const contentLength = req.headers['content-length'];
  if (contentLength) {
    const sizeInMB = (parseInt(contentLength) / (1024 * 1024)).toFixed(2);
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Payload: ${sizeInMB}MB`);
  } else {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  }
  console.log('Request headers:', sanitizeHeadersForLogs(req.headers));
  if (req.body && Object.keys(req.body).length > 0) {
    const bodySize = JSON.stringify(req.body).length;
    const bodyMB = (bodySize / (1024 * 1024)).toFixed(2);
    console.log(`Request body size: ${bodyMB}MB`);
  }
  next();
});

// Database connection and auto-seeding
const initializeDatabase = async () => {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Database connected successfully');

    // Single-command auto-seeding: system config + notification templates,
    // admin user, languages, homepage template, workflows, blog, FAQs, SEO.
    console.log('Running SeedService.seedAll()...');
    try {
      const results = await SeedService.seedAll();
      Object.entries(results).forEach(([key, value]) => {
        const msg = value && value.message ? value.message : 'ok';
        console.log(`  - ${key}: ${msg}`);
      });
    } catch (error) {
      console.error('Error during seedAll:', error.message);
    }

    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('Initializing database...');
initializeDatabase();

app.on("error", (error) => {
  console.error(`Server error: ${error.message}`);
  console.error(error.stack);
});

console.log('Setting up routes...');
// Basic Routes
app.use(basicRoutes);
// Authentication Routes
app.use('/api/auth', authRoutes);
// User Routes
app.use('/api/users', userRoutes);
// Service Routes
app.use('/api/services', serviceRoutes);
// Add-on Service Routes
app.use('/api/addons', addOnServiceRoutes);
// Service Category Routes
app.use('/api/service-categories', serviceCategoryRoutes);
// Admin Routes
app.use('/api/admin', adminRoutes);
// Order Routes
app.use('/api/orders', orderRoutes);
// Admin Order Routes
app.use('/api/admin/orders', adminOrderRoutes);
// Message Routes
app.use('/api/messages', messageRoutes);
// Inventory Routes
app.use('/api/inventory', inventoryRoutes);
// Blog Routes
app.use('/api/blog-posts', blogRoutes);
// FAQ Routes
app.use('/api/faqs', faqRoutes);
// Workflow Routes
app.use('/api/workflows', workflowRoutes);
// Device Routes
app.use('/api/devices', deviceRoutes);
// Notification Routes
app.use('/api/notifications', notificationRoutes);
// Team Chat Routes
app.use('/api/team-chat', teamChatRoutes);
// Performance Routes
app.use('/api/performance', performanceRoutes);
// Schedule Routes
app.use('/api/schedule', scheduleRoutes);
// Product Routes
app.use('/api/products', productRoutes);
// SEO Routes
app.use('/api/seo', seoRoutes);
// Cart Routes
app.use('/api/cart', cartRoutes);
// Homepage Routes (Public and Admin)
app.use('/api/homepage', homepageRoutes);
app.use('/api/admin/homepage', homepageRoutes);
// Diagnostic Routes
app.use('/api/admin/diagnostics', diagnosticRoutes);
// Staff Management Routes
app.use('/api/admin/staff-management', staffManagementRoutes);
// System Configuration Routes
app.use('/api/system-config', systemConfigRoutes);
// Financial Management Routes
app.use('/api/admin/financial', financialRoutes);
// Customer Group Management Routes
app.use('/api/admin/customer-groups', customerGroupRoutes);
// Contact Routes (Public - no authentication required)
app.use('/api/contact', contactRoutes);
// Admin Contact Routes (Admin only)
app.use('/api/admin/contact-messages', adminContactRoutes);
// Database Management Routes
app.use('/api/database', databaseRoutes);
// Security Routes
app.use('/api/security', securityRoutes);
// EPart Order Routes
app.use('/api/epart-orders', epartOrderRoutes);
// Need List Routes
app.use('/api/need-lists', needListRoutes);
// Device Inspection Routes
app.use('/api/device-inspections', deviceInspectionRoutes);
// Inspection Communication Routes
app.use('/api/inspection-communication', inspectionCommunicationRoutes);
// Repair Request Communication Routes
app.use('/api/repair-request-communication', repairRequestCommunicationRoutes);
// Language Routes
app.use('/api/languages', languageRoutes);
// Checkout Routes
app.use('/api/checkout', checkoutRoutes);
// Order Tracking Routes (Public - no authentication required)
app.use('/api/track-order', orderTrackingRoutes);
// Booking Routes
app.use('/api/bookings', bookingRoutes);
// Complaint Routes
app.use('/api/complaints', complaintRoutes);
// Reminder Routes
app.use('/api/reminders', reminderRoutes);
// Invoice Routes
app.use('/api/invoices', invoiceRoutes);
// Order Service Routes
app.use('/api/order-services', orderServiceRoutes);
// Website Settings Routes
app.use('/api/website-settings', websiteSettingsRoutes);
// Page Content Routes (Visual Builder)
app.use('/api/page-content', pageContentRoutes);
// Page Template Routes
app.use('/api/page-templates', pageTemplateRoutes);
// CSV Import Routes
app.use('/api/csv-import', csvImportRoutes);
// CSV Service Import Routes
app.use('/api/csv-service-import', csvServiceImportRoutes);
// CSV Add-On Import Routes
app.use('/api/csv-addon-import', csvAddOnImportRoutes);
// CSV Parts Import Routes
app.use('/api/csv-parts-import', csvPartsImportRoutes);
// CSV Product Import Routes
app.use('/api/csv-product-import', csvProductImportRoutes);
// Repair Request Routes
app.use('/api/repair-requests', repairRequestRoutes);
// Repair Workflow Routes
app.use('/api/repair-workflows', repairWorkflowRoutes);
// Time Tracking Routes
app.use('/api/time-tracking', timeTrackingRoutes);
// Admin Dashboard Routes
app.use('/api/admin/dashboard', adminDashboardRoutes);
// Admin Analytics Routes
app.use('/api/admin/analytics', adminAnalyticsRoutes);
// Seed Routes
app.use('/api/seed', seedRoutes);

// Tracking Routes
const trackingRoutes = require('./routes/tracking');
app.use('/api', trackingRoutes);
// Admin Live Tracking Routes
app.use('/api/admin/live-tracking', adminLiveTrackingRoutes);
// Marketing/Promo Admin Routes
app.use('/api/admin/marketing-promo', marketingPromoRoutes);

// Public ADCELL config endpoint (no auth – read-only, used by frontend tracking scripts)
const MarketingPromoService = require('./services/marketingPromoService');
app.get('/api/adcell-config', async (_req, res) => {
  try {
    const config = await MarketingPromoService.getAdcellConfig();
    // Cache for 5 min to reduce DB load
    res.set('Cache-Control', 'public, max-age=300');
    return res.status(200).json({ success: true, config });
  } catch (error) {
    return res.status(500).json({ success: false, config: { enabled: false } });
  }
});

// Public ADCELL exclusion check endpoint (checks if current user is in excluded group)
app.get('/api/adcell-is-excluded', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(200).json({ success: true, isExcluded: false });
    }
    
    const isExcluded = await MarketingPromoService.isCustomerInExcludedAdcellGroup(req.user._id);
    return res.status(200).json({ success: true, isExcluded });
  } catch (error) {
    console.error('Server ADCELL exclusion check error:', error);
    return res.status(200).json({ success: true, isExcluded: false });
  }
});
// Proxy Routes (mobileapi.dev)
const proxyRoutes = require('./routes/proxyRoutes');
app.use('/api/proxy', proxyRoutes);
// DHL Routes (Location Finder proxy)
const dhlRoutes = require('./routes/dhlRoutes');
app.use('/api/dhl', dhlRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC XML SITEMAP  –  /sitemap.xml
// Dynamically generated from device types / manufacturers / models.
// ─────────────────────────────────────────────────────────────────────────────
const DeviceService = require('./services/deviceService');

function toSitemapSlug(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

let sitemapCache = null;
let sitemapCacheAt = 0;
const SITEMAP_CACHE_TTL = 15 * 60 * 1000; // 15 min

app.get('/sitemap.xml', async (req, res) => {
  try {
    const configuredBaseUrl = (
      process.env.PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      process.env.CLIENT_URL ||
      ''
    ).replace(/\/$/, '');
    const configuredIsLocal = /localhost|127\.0\.0\.1/i.test(configuredBaseUrl);
    const BASE_URL =
      !configuredBaseUrl || (process.env.NODE_ENV === 'production' && configuredIsLocal)
        ? 'https://www.mcrepair.de'
        : configuredBaseUrl;

    // Serve from cache when fresh
    if (sitemapCache && Date.now() - sitemapCacheAt < SITEMAP_CACHE_TTL) {
      res.header('Content-Type', 'application/xml; charset=utf-8');
      return res.send(sitemapCache);
    }

    const today = new Date().toISOString().slice(0, 10);

    // Static high-priority pages
    const staticUrls = [
      { loc: `${BASE_URL}/`, priority: '1.0', changefreq: 'daily' },
      { loc: `${BASE_URL}/new-order`, priority: '0.9', changefreq: 'weekly' },
      { loc: `${BASE_URL}/shop`, priority: '0.8', changefreq: 'daily' },
      { loc: `${BASE_URL}/vorabdiagnose`, priority: '0.7', changefreq: 'monthly' },
      { loc: `${BASE_URL}/annahmestellen`, priority: '0.7', changefreq: 'monthly' },
      { loc: `${BASE_URL}/faq`, priority: '0.7', changefreq: 'monthly' },
      { loc: `${BASE_URL}/blog`, priority: '0.6', changefreq: 'weekly' },
      { loc: `${BASE_URL}/ueber-uns`, priority: '0.5', changefreq: 'monthly' },
      { loc: `${BASE_URL}/contact`, priority: '0.5', changefreq: 'monthly' },
      { loc: `${BASE_URL}/partner-werden`, priority: '0.5', changefreq: 'monthly' },
    ];

    // Repair catalog pages: /reparatur/:deviceType  /reparatur/:dt/:mfr  /reparatur/:dt/:mfr/:model
    const deviceTypes = await DeviceService.getDeviceTypes();
    const catalogUrls = [];

    for (const dt of deviceTypes) {
      const dtSlug = toSitemapSlug(dt.name);
      catalogUrls.push({
        loc: `${BASE_URL}/reparatur/${dtSlug}`,
        priority: '0.9',
        changefreq: 'weekly',
      });

      let manufacturers = [];
      try {
        manufacturers = await DeviceService.getManufacturersByDeviceType(dt.name);
      } catch (_) { /* skip */ }

      for (const mfr of manufacturers) {
        const mfrSlug = toSitemapSlug(mfr.name);
        catalogUrls.push({
          loc: `${BASE_URL}/reparatur/${dtSlug}/${mfrSlug}`,
          priority: '0.85',
          changefreq: 'weekly',
        });

        let models = [];
        try {
          models = await DeviceService.getModelsByTypeAndManufacturer(dt.name, String(mfr._id));
        } catch (_) { /* skip */ }

        for (const model of models) {
          const modelSlug = toSitemapSlug(model.name);
          catalogUrls.push({
            loc: `${BASE_URL}/reparatur/${dtSlug}/${mfrSlug}/${modelSlug}`,
            priority: '0.8',
            changefreq: 'weekly',
          });
        }
      }
    }

    // Shop product pages: /shop/product/:id
    let productUrls = [];
    try {
      const Product = require('./models/Product');
      const products = await Product.find({ isActive: true })
        .select('_id updatedAt')
        .lean();
      productUrls = products.map((p) => ({
        loc: `${BASE_URL}/shop/product/${p._id}`,
        priority: '0.75',
        changefreq: 'weekly',
        lastmod: p.updatedAt ? p.updatedAt.toISOString().slice(0, 10) : today,
      }));
    } catch (_) { /* skip if products collection unavailable */ }

    // Blog post pages: /blog/:slug
    let blogUrls = [];
    try {
      const BlogPost = require('./models/BlogPost');
      const blogPosts = await BlogPost.find({ status: 'published' })
        .select('slug _id updatedAt publishedAt')
        .lean();
      blogUrls = blogPosts.map((p) => ({
        loc: `${BASE_URL}/blog/${p.slug || p._id}`,
        priority: '0.65',
        changefreq: 'monthly',
        lastmod: (p.updatedAt || p.publishedAt)
          ? new Date(p.updatedAt || p.publishedAt).toISOString().slice(0, 10)
          : today,
      }));
    } catch (_) { /* skip if blog collection unavailable */ }

    const allUrls = [...staticUrls, ...catalogUrls, ...productUrls, ...blogUrls];
    const urlEntries = allUrls
      .map(
        ({ loc, priority, changefreq, lastmod }) =>
          `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod || today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
      )
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>`;

    sitemapCache = xml;
    sitemapCacheAt = Date.now();

    res.header('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  } catch (error) {
    console.error('sitemap.xml generation error:', error);
    res.status(500).send('<?xml version="1.0"?><error>Sitemap generation failed</error>');
  }
});

console.log('Routes configured successfully');

// If no routes handled the request, it's a 404
app.use((req, res, next) => {
  console.log(`404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).send("Page not found.");
});

// Error handling middleware with specific handling for payload too large errors
app.use((err, req, res, next) => {
  console.error(`Unhandled application error: ${err.message}`);
  console.error('Full error stack trace:', err.stack);

  // Handle specific error types
  if (err.code === 'ENTITY_TOO_LARGE' || err.message.includes('entity too large')) {
    console.error('Payload size exceeded - Request entity too large');
    console.error(`Content-Length: ${req.headers['content-length']} bytes`);
    return res.status(413).json({
      error: `Request entity too large. Maximum payload size is ${requestLimitMb}MB.`,
      details: err.message
    });
  }

  if (err.code === 'PayloadTooLargeError' || err.type === 'entity.too.large') {
    console.error('Payload size error detected during body parsing');
    return res.status(413).json({
      error: `Request payload exceeds maximum size limit of ${requestLimitMb}MB.`,
      details: err.message
    });
  }

  if (err.message === 'CORS origin denied') {
    return res.status(403).json({ error: 'Origin is not allowed by CORS policy.' });
  }

  // Default error response
  res.status(500).json({ error: "There was an error serving your request." });
});

console.log(`Attempting to start server on port ${port}...`);
const server = app.listen(port, () => {
  console.log(`✅ Server running successfully at http://localhost:${port}`);
  console.log('=== McRepair.de Server Ready ===');
});

server.on('error', (error) => {
  console.error('Failed to start server:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});