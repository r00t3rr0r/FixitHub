const express = require('express');
const SeedService = require('../services/seedService.js');

const router = express.Router();

// POST /api/seed/admin - Seed admin user
router.post('/admin', async (req, res) => {
  try {
    console.log('POST /api/seed/admin - Starting admin user seeding');
    
    const result = await SeedService.seedAdmin();
    
    console.log('POST /api/seed/admin - Admin seeding completed successfully');
    res.json(result);
  } catch (error) {
    console.error('POST /api/seed/admin - Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/seed/services - Seed repair services
router.post('/services', async (req, res) => {
  try {
    console.log('POST /api/seed/services - Starting services seeding');
    
    const result = await SeedService.seedServices();
    
    console.log('POST /api/seed/services - Services seeding completed successfully');
    res.json(result);
  } catch (error) {
    console.error('POST /api/seed/services - Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;