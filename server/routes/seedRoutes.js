const express = require('express');
const SeedService = require('../services/seedService.js');
const { requireUser, requireRole } = require('./middleware/auth.js');

const router = express.Router();

// Seed admin user (can be called without authentication for deployment setup)
router.post('/admin', async (req, res) => {
  try {
    console.log('Seed admin user request received');
    const adminUser = await SeedService.seedAdminUser();
    res.status(200).json({
      success: true,
      message: 'Admin user seeded successfully',
      data: { userId: adminUser._id, email: adminUser.email }
    });
  } catch (error) {
    console.error('Error seeding admin user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed admin user',
      error: error.message
    });
  }
});

// Seed test users (can be called without authentication for deployment setup)
router.post('/test-users', async (req, res) => {
  try {
    console.log('Seed test users request received');
    const testUsers = await SeedService.seedTestUsers();
    res.status(200).json({
      success: true,
      message: 'Test users seeded successfully',
      data: testUsers.map(user => ({ userId: user._id, email: user.email, role: user.role }))
    });
  } catch (error) {
    console.error('Error seeding test users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed test users',
      error: error.message
    });
  }
});

// Verify test user credentials
router.get('/verify-test-users', async (req, res) => {
  try {
    console.log('Verify test users request received');
    const results = await SeedService.verifyTestUsers();
    res.status(200).json({
      success: true,
      message: 'Test user verification completed',
      data: results
    });
  } catch (error) {
    console.error('Error verifying test users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify test users',
      error: error.message
    });
  }
});

// Seed services (requires admin role)
router.post('/services', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('Seed services request received');
    const services = await SeedService.seedServices();
    res.status(200).json({
      success: true,
      message: 'Services seeded successfully',
      data: { count: services.length }
    });
  } catch (error) {
    console.error('Error seeding services:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed services',
      error: error.message
    });
  }
});

// Seed add-on services (requires admin role)
router.post('/addons', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('Seed add-on services request received');
    const addOns = await SeedService.seedAddOnServices();
    res.status(200).json({
      success: true,
      message: 'Add-on services seeded successfully',
      data: { count: addOns.length }
    });
  } catch (error) {
    console.error('Error seeding add-on services:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed add-on services',
      error: error.message
    });
  }
});

// Seed inventory (requires admin role)
router.post('/inventory', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('Seed inventory request received');
    const inventory = await SeedService.seedInventory();
    res.status(200).json({
      success: true,
      message: 'Inventory seeded successfully',
      data: { count: inventory.length }
    });
  } catch (error) {
    console.error('Error seeding inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed inventory',
      error: error.message
    });
  }
});

// Seed devices (requires admin role)
router.post('/devices', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('Seed devices request received');
    const devices = await SeedService.seedDevices();
    res.status(200).json({
      success: true,
      message: 'Devices seeded successfully',
      data: { count: devices.length }
    });
  } catch (error) {
    console.error('Error seeding devices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed devices',
      error: error.message
    });
  }
});

// Seed products (requires admin role)
router.post('/products', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('Seed products request received');
    const products = await SeedService.seedProducts();
    res.status(200).json({
      success: true,
      message: 'Products seeded successfully',
      data: { count: products.length }
    });
  } catch (error) {
    console.error('Error seeding products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed products',
      error: error.message
    });
  }
});

// Seed blog data (requires admin role)
router.post('/blog', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('Seed blog data request received');
    const blogData = await SeedService.seedBlogData();
    res.status(200).json({
      success: true,
      message: 'Blog data seeded successfully',
      data: { count: blogData.length }
    });
  } catch (error) {
    console.error('Error seeding blog data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed blog data',
      error: error.message
    });
  }
});

// Seed FAQs (requires admin role)
router.post('/faqs', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('Seed FAQs request received');
    const faqs = await SeedService.seedFAQs();
    res.status(200).json({
      success: true,
      message: 'FAQs seeded successfully',
      data: { count: faqs.length }
    });
  } catch (error) {
    console.error('Error seeding FAQs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed FAQs',
      error: error.message
    });
  }
});

// Seed homepage template (requires admin role)
router.post('/homepage', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('Seed homepage template request received');
    const homepage = await SeedService.seedHomepageTemplate();
    res.status(200).json({
      success: true,
      message: 'Homepage template seeded successfully',
      data: { count: homepage.length }
    });
  } catch (error) {
    console.error('Error seeding homepage template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed homepage template',
      error: error.message
    });
  }
});

// Seed financial data (requires admin role)
router.post('/financial', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('Seed financial data request received');
    const financial = await SeedService.seedFinancialData();
    res.status(200).json({
      success: true,
      message: 'Financial data seeded successfully',
      data: { count: financial.length }
    });
  } catch (error) {
    console.error('Error seeding financial data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed financial data',
      error: error.message
    });
  }
});

// —GERMAN_SEEDING_ROUTE_1 (file `server/routes/seedRoutes.js`) —
// Description: Seed German language services, products, FAQs, blog posts, and homepage content
// Endpoint: POST /api/seed/german
// Request: {}
// Response: { success: boolean, message: string, data: { germanServices, germanAddOnServices, germanInventory, germanDevices, germanProducts, germanBlogData, germanFAQs, germanHomepageTemplate } }
router.post('/german', async (req, res) => {
  try {
    console.log('Seed German data request received');
    const results = await SeedService.seedGermanData();
    res.status(200).json({
      success: true,
      message: 'German data seeded successfully',
      data: {
        germanServices: results.germanServices,
        germanAddOnServices: results.germanAddOnServices,
        germanInventory: results.germanInventory,
        germanDevices: results.germanDevices,
        germanProducts: results.germanProducts,
        germanBlogData: results.germanBlogData,
        germanFAQs: results.germanFAQs,
        germanHomepageTemplate: results.germanHomepageTemplate
      }
    });
  } catch (error) {
    console.error('Error seeding German data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed German data',
      error: error.message
    });
  }
});
// —END_OF_GERMAN_SEEDING_ROUTE_1—

// Seed all data (can be called without authentication for deployment setup)
router.post('/all', async (req, res) => {
  try {
    console.log('Seed all data request received');
    const results = await SeedService.seedAll();
    
    // Count total items seeded
    let totalCount = 0;
    Object.keys(results).forEach(key => {
      if (Array.isArray(results[key])) {
        totalCount += results[key].length;
      } else if (results[key] && typeof results[key] === 'object') {
        totalCount += 1;
      }
    });

    res.status(200).json({
      success: true,
      message: 'All data seeded successfully',
      data: {
        totalItems: totalCount,
        breakdown: {
          adminUser: results.adminUser ? 1 : 0,
          testUsers: Array.isArray(results.testUsers) ? results.testUsers.length : 0,
          services: Array.isArray(results.services) ? results.services.length : 0,
          addOnServices: Array.isArray(results.addOnServices) ? results.addOnServices.length : 0,
          inventory: Array.isArray(results.inventory) ? results.inventory.length : 0,
          devices: Array.isArray(results.devices) ? results.devices.length : 0,
          products: Array.isArray(results.products) ? results.products.length : 0,
          blogData: Array.isArray(results.blogData) ? results.blogData.length : 0,
          faqs: Array.isArray(results.faqs) ? results.faqs.length : 0,
          homepageTemplate: Array.isArray(results.homepageTemplate) ? results.homepageTemplate.length : 0,
          financialData: Array.isArray(results.financialData) ? results.financialData.length : 0
        }
      }
    });
  } catch (error) {
    console.error('Error seeding all data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed all data',
      error: error.message
    });
  }
});

// Database health check
router.get('/health', async (req, res) => {
  try {
    console.log('Database health check request received');
    const mongoose = require('mongoose');
    
    const dbState = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    const health = {
      database: {
        status: states[dbState] || 'unknown',
        state: dbState
      },
      timestamp: new Date().toISOString()
    };

    if (dbState === 1) {
      // If connected, get some basic stats
      const User = require('../models/User');
      const userCount = await User.countDocuments();
      health.stats = {
        totalUsers: userCount
      };
    }

    res.status(200).json({
      success: true,
      message: 'Database health check completed',
      data: health
    });
  } catch (error) {
    console.error('Error checking database health:', error);
    res.status(500).json({
      success: false,
      message: 'Database health check failed',
      error: error.message
    });
  }
});

module.exports = router;