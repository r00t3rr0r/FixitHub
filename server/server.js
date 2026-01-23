// Load environment variables from the root directory
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Add startup logging
console.log('=== FixitHub Server Starting ===');
console.log('Environment variables check:');
console.log('- PORT:', process.env.PORT || 3000);
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Missing');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Missing');
console.log('- REFRESH_TOKEN_SECRET:', process.env.REFRESH_TOKEN_SECRET ? 'Set' : 'Missing');

console.log('Loading mongoose...');
const mongoose = require("mongoose");
console.log('Loading express...');
const express = require("express");
console.log('Loading session...');
const session = require("express-session");
console.log('Loading MongoStore...');
const MongoStore = require('connect-mongo');

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
console.log('Loading language routes...');
const languageRoutes = require("./routes/languageRoutes");
console.log('Loading checkout routes...');
const checkoutRoutes = require("./routes/checkoutRoutes");
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

console.log('Loading database config...');
const { connectDB } = require("./config/database");
console.log('Loading SeedService...');
const SeedService = require("./services/seedService");
console.log('Loading cors...');
const cors = require("cors");

if (!process.env.DATABASE_URL) {
  console.error("Error: DATABASE_URL variables in .env missing.");
  process.exit(-1);
}

console.log('Creating Express app...');
const app = express();
const port = process.env.PORT || 3000;

// Pretty-print JSON responses
app.enable('json spaces');
// We want to be consistent with URL paths, so we enable strict routing
app.enable('strict routing');

console.log('Setting up middleware...');
app.use(cors({}));
// Increase payload size limits to handle large file uploads and data payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
  console.log('Request headers:', req.headers);
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

    // Auto-seed system configuration if it doesn't exist
    console.log('Checking if system configuration exists...');
    try {
      const configSeedResult = await SeedService.seedSystemConfiguration();
      console.log('System configuration seeding result:', configSeedResult.message);
    } catch (error) {
      console.error('Error seeding system configuration:', error.message);
    }

    // Auto-seed service categories if they don't exist
    console.log('Checking if service categories exist...');
    try {
      const categoriesSeedResult = await SeedService.seedServiceCategories();
      console.log('Service categories seeding result:', categoriesSeedResult.message);
    } catch (error) {
      console.error('Error seeding service categories:', error.message);
    }

    // Auto-seed admin user if it doesn't exist
    console.log('Checking if admin user exists...');
    try {
      const seedResult = await SeedService.seedAdmin();
      console.log('Admin seeding result:', seedResult.message);
    } catch (error) {
      console.error('Error seeding admin user:', error.message);
    }

    // Auto-seed devices if they don't exist
    console.log('Checking if devices exist...');
    try {
      const devicesSeedResult = await SeedService.seedDevices();
      console.log('Devices seeding result:', devicesSeedResult.message);
    } catch (error) {
      console.error('Error seeding devices:', error.message);
    }

    // Auto-seed services if they don't exist
    console.log('Checking if services exist...');
    try {
      const servicesSeedResult = await SeedService.seedServices();
      console.log('Services seeding result:', servicesSeedResult.message);
    } catch (error) {
      console.error('Error seeding services:', error.message);
    }

    // Auto-seed add-on services if they don't exist
    console.log('Checking if add-on services exist...');
    try {
      const addOnsSeedResult = await SeedService.seedAddOnServices();
      console.log('Add-on services seeding result:', addOnsSeedResult.message);
    } catch (error) {
      console.error('Error seeding add-on services:', error.message);
    }

    // Auto-seed inventory if it doesn't exist
    console.log('Checking if inventory exists...');
    try {
      const inventorySeedResult = await SeedService.seedInventory();
      console.log('Inventory seeding result:', inventorySeedResult.message);
    } catch (error) {
      console.error('Error seeding inventory:', error.message);
    }

    // Auto-seed products if they don't exist
    console.log('Checking if products exist...');
    try {
      const productsSeedResult = await SeedService.seedProducts();
      console.log('Products seeding result:', productsSeedResult.message);
    } catch (error) {
      console.error('Error seeding products:', error.message);
    }

    // Auto-seed blog data if it doesn't exist
    console.log('Checking if blog data exists...');
    try {
      const blogSeedResult = await SeedService.seedBlogData();
      console.log('Blog seeding result:', blogSeedResult.message);
    } catch (error) {
      console.error('Error seeding blog data:', error.message);
    }

    // Auto-seed FAQ data if it doesn't exist
    console.log('Checking if FAQ data exists...');
    try {
      const faqSeedResult = await SeedService.seedFAQData();
      console.log('FAQ seeding result:', faqSeedResult.message);
    } catch (error) {
      console.error('Error seeding FAQ data:', error.message);
    }

    // Auto-seed languages if they don't exist
    console.log('Checking if languages exist...');
    try {
      const languageSeedResult = await SeedService.seedLanguages();
      console.log('Language seeding result:', languageSeedResult.message);
    } catch (error) {
      console.error('Error seeding languages:', error.message);
    }

    // Auto-seed homepage template if it doesn't exist
    console.log('Checking if homepage template exists...');
    try {
      const homepageSeedResult = await SeedService.seedHomepageTemplate();
      console.log('Homepage template seeding result:', homepageSeedResult.message);
    } catch (error) {
      console.error('Error seeding homepage template:', error.message);
    }

    // Auto-seed financial data if it doesn't exist
    console.log('Checking if financial data exists...');
    try {
      const financialSeedResult = await SeedService.seedFinancialData();
      console.log('Financial data seeding result:', financialSeedResult.message);
    } catch (error) {
      console.error('Error seeding financial data:', error.message);
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
// Language Routes
app.use('/api/languages', languageRoutes);
// Checkout Routes
app.use('/api/checkout', checkoutRoutes);
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
// Seed Routes
app.use('/api/seed', seedRoutes);

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
      error: 'Request entity too large. Maximum payload size is 50MB.',
      details: err.message
    });
  }

  if (err.code === 'PayloadTooLargeError' || err.type === 'entity.too.large') {
    console.error('Payload size error detected during body parsing');
    return res.status(413).json({
      error: 'Request payload exceeds maximum size limit of 50MB.',
      details: err.message
    });
  }

  // Default error response
  res.status(500).json({ error: "There was an error serving your request." });
});

console.log(`Attempting to start server on port ${port}...`);
app.listen(port, (error) => {
  if (error) {
    console.error('Failed to start server:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
  console.log(`✅ Server running successfully at http://localhost:${port}`);
  console.log('=== FixitHub Server Ready ===');
});