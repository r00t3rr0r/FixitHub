const express = require('express');
const SeedService = require('../services/seedService.js');
const { requireUser, requireRole } = require('./middleware/auth.js');

const router = express.Router();

/**
 * Seed routes — bootstrap and refresh seed data.
 *
 * Public (no auth) endpoints are limited to bootstrap operations
 * required for first-time deployment:
 *   POST /admin            – create the default admin user
 *   POST /all              – run the full seedAll() bootstrap
 *
 * Admin-only endpoints expose the individual seed groups for
 * targeted refresh:
 *   POST /system           – system configuration
 *   POST /notification-templates – e-mail / notification templates
 *   POST /workflows
 *   POST /blog
 *   POST /faqs
 *   POST /seo
 *   POST /homepage
 *   POST /languages
 *
 * GET  /health             – database / seed health check
 */

// ---------------------------------------------------------------------------
// Bootstrap (public)
// ---------------------------------------------------------------------------

router.post('/admin', async (req, res) => {
  try {
    const result = await SeedService.seedAdminUser();
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.user
        ? { userId: result.user._id, email: result.user.email }
        : undefined
    });
  } catch (error) {
    console.error('Error seeding admin user:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to seed admin user',
      error: error.message
    });
  }
});

router.post('/all', async (req, res) => {
  try {
    const results = await SeedService.seedAll();
    return res.status(200).json({
      success: true,
      message: 'Bootstrap seeding complete',
      data: results
    });
  } catch (error) {
    console.error('Error during bootstrap seeding:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to run bootstrap seeding',
      error: error.message
    });
  }
});

// ---------------------------------------------------------------------------
// Targeted refresh (admin only)
// ---------------------------------------------------------------------------

const adminOnly = [requireUser, requireRole(['admin'])];

const seedHandler = (label, fn) => async (req, res) => {
  try {
    const result = await fn(req);
    return res.status(200).json({ success: true, message: result.message, data: result });
  } catch (error) {
    console.error(`Error seeding ${label}:`, error);
    return res.status(500).json({
      success: false,
      message: `Failed to seed ${label}`,
      error: error.message
    });
  }
};

router.post('/system', adminOnly, seedHandler('system configuration', () => SeedService.seedSystemConfiguration()));

router.post(
  '/notification-templates',
  adminOnly,
  seedHandler('notification templates', (req) =>
    SeedService.seedNotificationTemplates({ force: req.query.force === 'true' || req.body?.force === true })
  )
);

router.post('/workflows', adminOnly, seedHandler('workflows', () => SeedService.seedWorkflows()));
router.post('/blog',      adminOnly, seedHandler('blog data',  () => SeedService.seedBlogData()));
router.post('/faqs',      adminOnly, seedHandler('FAQs',       () => SeedService.seedFAQs()));
router.post('/seo',       adminOnly, seedHandler('SEO settings',() => SeedService.seedSEOSettings()));
router.post('/homepage',  adminOnly, seedHandler('homepage template', () => SeedService.seedHomepageTemplate()));
router.post('/languages', adminOnly, seedHandler('languages',   () => SeedService.seedLanguages()));

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

router.get('/health', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const dbState = mongoose.connection.readyState;
    const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

    const health = {
      database: { status: states[dbState] || 'unknown', state: dbState },
      timestamp: new Date().toISOString()
    };

    if (dbState === 1) {
      const User = require('../models/User');
      health.stats = { totalUsers: await User.countDocuments() };
    }

    return res.status(200).json({ success: true, message: 'Database health check completed', data: health });
  } catch (error) {
    console.error('Error checking database health:', error);
    return res.status(500).json({
      success: false,
      message: 'Database health check failed',
      error: error.message
    });
  }
});

module.exports = router;
