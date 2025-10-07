const express = require('express');
const router = express.Router();
const { requireUser, requireRole } = require('./middleware/auth');
const HomepageService = require('../services/homepageService');

// Get homepage sections (public endpoint for homepage display)
router.get('/sections', async (req, res) => {
  try {
    console.log('HomepageRoutes: Getting homepage sections (public)');
    const result = await HomepageService.getHomepageSections();

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('HomepageRoutes: Error getting homepage sections:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Admin routes - Get homepage sections for management
router.get('/admin/sections', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    console.log('HomepageRoutes: Getting homepage sections for admin');
    const result = await HomepageService.getHomepageSections();

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('HomepageRoutes: Error getting homepage sections:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get content block templates (admin only)
router.get('/content-blocks', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    console.log('HomepageRoutes: Getting content block templates');
    const result = await HomepageService.getContentBlockTemplates();

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('HomepageRoutes: Error getting content block templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get layout templates (admin only)
router.get('/templates', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    console.log('HomepageRoutes: Getting layout templates');
    const result = await HomepageService.getLayoutTemplates();

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('HomepageRoutes: Error getting layout templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Save homepage sections (admin only)
router.put('/sections', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('HomepageRoutes: Saving homepage sections');
    const { sections } = req.body;

    if (!sections || !Array.isArray(sections)) {
      return res.status(400).json({
        success: false,
        error: 'Sections array is required'
      });
    }

    const result = await HomepageService.saveHomepageSections(sections, req.user._id);

    res.json(result);
  } catch (error) {
    console.error('HomepageRoutes: Error saving homepage sections:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get A/B tests (admin only)
router.get('/ab-tests', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('HomepageRoutes: Getting A/B tests');
    const result = await HomepageService.getABTests();

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('HomepageRoutes: Error getting A/B tests:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create A/B test (admin only)
router.post('/ab-tests', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('HomepageRoutes: Creating A/B test');
    const result = await HomepageService.createABTest(req.body, req.user._id);

    res.status(201).json(result);
  } catch (error) {
    console.error('HomepageRoutes: Error creating A/B test:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Create layout template (admin only)
router.post('/templates', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('HomepageRoutes: Creating layout template');
    const result = await HomepageService.createLayoutTemplate(req.body, req.user._id);

    res.status(201).json(result);
  } catch (error) {
    console.error('HomepageRoutes: Error creating layout template:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update layout template (admin only)
router.put('/templates/:id', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('HomepageRoutes: Updating layout template:', req.params.id);
    const result = await HomepageService.updateLayoutTemplate(req.params.id, req.body);

    res.json(result);
  } catch (error) {
    console.error('HomepageRoutes: Error updating layout template:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Delete layout template (admin only)
router.delete('/templates/:id', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('HomepageRoutes: Deleting layout template:', req.params.id);
    const result = await HomepageService.deleteLayoutTemplate(req.params.id);

    res.json(result);
  } catch (error) {
    console.error('HomepageRoutes: Error deleting layout template:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Set default template (admin only)
router.post('/templates/:id/set-default', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('HomepageRoutes: Setting default template:', req.params.id);
    const result = await HomepageService.setDefaultTemplate(req.params.id);

    res.json(result);
  } catch (error) {
    console.error('HomepageRoutes: Error setting default template:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;