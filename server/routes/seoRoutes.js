const express = require('express');
const router = express.Router();
const { requireUser, requireRole } = require('./middleware/auth');
const SEOService = require('../services/seoService');

// Get SEO settings by page type and ID
router.get('/settings', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    console.log('SEORoutes: Getting SEO settings:', req.query);
    const { pageType, pageId = '' } = req.query;
    
    if (!pageType) {
      return res.status(400).json({
        success: false,
        error: 'Page type is required'
      });
    }
    
    const settings = await SEOService.getSEOSettings(pageType, pageId);
    
    res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('SEORoutes: Error getting SEO settings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all SEO settings with filtering
router.get('/all', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('SEORoutes: Getting all SEO settings:', req.query);
    const result = await SEOService.getAllSEOSettings(req.query);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('SEORoutes: Error getting all SEO settings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create or update SEO settings
router.post('/settings', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    console.log('SEORoutes: Upserting SEO settings:', req.body);
    const { pageType, pageId = '', ...seoData } = req.body;
    
    if (!pageType) {
      return res.status(400).json({
        success: false,
        error: 'Page type is required'
      });
    }
    
    const settings = await SEOService.upsertSEOSettings(pageType, pageId, seoData, req.user._id);
    
    res.json({
      success: true,
      message: 'SEO settings saved successfully',
      settings
    });
  } catch (error) {
    console.error('SEORoutes: Error upserting SEO settings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete SEO settings
router.delete('/settings/:id', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('SEORoutes: Deleting SEO settings:', req.params.id);
    const result = await SEOService.deleteSEOSettings(req.params.id);
    
    res.json(result);
  } catch (error) {
    console.error('SEORoutes: Error deleting SEO settings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get sitemap data
router.get('/sitemap', async (req, res) => {
  try {
    console.log('SEORoutes: Getting sitemap data');
    const sitemapData = await SEOService.generateSitemapData();
    
    res.json({
      success: true,
      sitemap: sitemapData
    });
  } catch (error) {
    console.error('SEORoutes: Error getting sitemap data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get SEO analytics
router.get('/analytics', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    console.log('SEORoutes: Getting SEO analytics');
    const analytics = await SEOService.getSEOAnalytics();
    
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('SEORoutes: Error getting SEO analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;