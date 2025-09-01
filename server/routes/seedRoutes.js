const express = require('express');
const SeedService = require('../services/seedService');

const router = express.Router();

// Seed admin user
router.post('/admin', async (req, res) => {
  console.log('Seed: Admin user seeding request received');

  try {
    const result = await SeedService.seedAdmin();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Seed: Error seeding admin user:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to seed admin user'
    });
  }
});

// Seed services
router.post('/services', async (req, res) => {
  console.log('Seed: Services seeding request received');

  try {
    const result = await SeedService.seedServices();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Seed: Error seeding services:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to seed services'
    });
  }
});

// Seed add-on services
router.post('/addons', async (req, res) => {
  console.log('Seed: Add-on services seeding request received');

  try {
    const result = await SeedService.seedAddOnServices();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Seed: Error seeding add-on services:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to seed add-on services'
    });
  }
});

// Seed inventory
router.post('/inventory', async (req, res) => {
  console.log('Seed: Inventory seeding request received');

  try {
    const result = await SeedService.seedInventory();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Seed: Error seeding inventory:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to seed inventory'
    });
  }
});

// Seed devices
router.post('/devices', async (req, res) => {
  console.log('Seed: Devices seeding request received');

  try {
    const result = await SeedService.seedDevices();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Seed: Error seeding devices:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to seed devices'
    });
  }
});

// Seed blog data
router.post('/blog', async (req, res) => {
  console.log('Seed: Blog data seeding request received');

  try {
    const result = await SeedService.seedBlogData();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Seed: Error seeding blog data:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to seed blog data'
    });
  }
});

// Seed FAQ data
router.post('/faq', async (req, res) => {
  console.log('Seed: FAQ data seeding request received');

  try {
    const result = await SeedService.seedFAQData();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Seed: Error seeding FAQ data:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to seed FAQ data'
    });
  }
});

// Seed all data
router.post('/all', async (req, res) => {
  console.log('Seed: All data seeding request received');

  try {
    const results = [];

    // Seed admin
    const adminResult = await SeedService.seedAdmin();
    results.push({ type: 'admin', ...adminResult });

    // Seed devices
    const devicesResult = await SeedService.seedDevices();
    results.push({ type: 'devices', ...devicesResult });

    // Seed services
    const servicesResult = await SeedService.seedServices();
    results.push({ type: 'services', ...servicesResult });

    // Seed add-on services
    const addOnsResult = await SeedService.seedAddOnServices();
    results.push({ type: 'addons', ...addOnsResult });

    // Seed inventory
    const inventoryResult = await SeedService.seedInventory();
    results.push({ type: 'inventory', ...inventoryResult });

    // Seed blog data
    const blogResult = await SeedService.seedBlogData();
    results.push({ type: 'blog', ...blogResult });

    // Seed FAQ data
    const faqResult = await SeedService.seedFAQData();
    results.push({ type: 'faq', ...faqResult });

    return res.status(200).json({
      success: true,
      message: 'All data seeded successfully',
      results
    });
  } catch (error) {
    console.error('Seed: Error seeding all data:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to seed all data'
    });
  }
});

module.exports = router;