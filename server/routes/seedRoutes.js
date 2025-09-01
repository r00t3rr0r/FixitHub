const express = require('express');
const router = express.Router();
const SeedService = require('../services/seedService');

// Seed admin user
router.post('/admin', async (req, res) => {
  try {
    console.log('SeedRoutes: Seeding admin user');
    const result = await SeedService.seedAdmin();
    res.json(result);
  } catch (error) {
    console.error('SeedRoutes: Error seeding admin:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Seed services
router.post('/services', async (req, res) => {
  try {
    console.log('SeedRoutes: Seeding services');
    const result = await SeedService.seedServices();
    res.json(result);
  } catch (error) {
    console.error('SeedRoutes: Error seeding services:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Seed add-on services
router.post('/addons', async (req, res) => {
  try {
    console.log('SeedRoutes: Seeding add-on services');
    const result = await SeedService.seedAddOnServices();
    res.json(result);
  } catch (error) {
    console.error('SeedRoutes: Error seeding add-on services:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Seed inventory
router.post('/inventory', async (req, res) => {
  try {
    console.log('SeedRoutes: Seeding inventory');
    const result = await SeedService.seedInventory();
    res.json(result);
  } catch (error) {
    console.error('SeedRoutes: Error seeding inventory:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Seed devices
router.post('/devices', async (req, res) => {
  try {
    console.log('SeedRoutes: Seeding devices');
    const result = await SeedService.seedDevices();
    res.json(result);
  } catch (error) {
    console.error('SeedRoutes: Error seeding devices:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Seed products
router.post('/products', async (req, res) => {
  try {
    console.log('SeedRoutes: Seeding products');
    const result = await SeedService.seedProducts();
    res.json(result);
  } catch (error) {
    console.error('SeedRoutes: Error seeding products:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Seed blog data
router.post('/blog', async (req, res) => {
  try {
    console.log('SeedRoutes: Seeding blog data');
    const result = await SeedService.seedBlogData();
    res.json(result);
  } catch (error) {
    console.error('SeedRoutes: Error seeding blog data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Seed FAQ data
router.post('/faq', async (req, res) => {
  try {
    console.log('SeedRoutes: Seeding FAQ data');
    const result = await SeedService.seedFAQData();
    res.json(result);
  } catch (error) {
    console.error('SeedRoutes: Error seeding FAQ data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Seed all data
router.post('/all', async (req, res) => {
  try {
    console.log('SeedRoutes: Seeding all data');
    
    const results = [];
    
    // Seed in order of dependencies
    results.push(await SeedService.seedAdmin());
    results.push(await SeedService.seedServices());
    results.push(await SeedService.seedAddOnServices());
    results.push(await SeedService.seedInventory());
    results.push(await SeedService.seedDevices());
    results.push(await SeedService.seedProducts());
    results.push(await SeedService.seedBlogData());
    results.push(await SeedService.seedFAQData());
    
    res.json({
      success: true,
      message: 'All data seeded successfully',
      results
    });
  } catch (error) {
    console.error('SeedRoutes: Error seeding all data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;