const express = require('express');
const router = express.Router();
const { requireUser, requireRole } = require('./middleware/auth');
const SEOService = require('../services/seoService');
const DeviceService = require('../services/deviceService');
const ServiceService = require('../services/serviceService');
const AddOnServiceService = require('../services/addOnServiceService');
const FAQService = require('../services/faqService');

// Slugify: "iPhone 14 Pro Max" → "iphone-14-pro-max"
function toSlug(str) {
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

// Simple in-process cache (invalidated after 10 minutes)
let catalogCache = null;
let catalogCacheAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

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

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC SEO REPAIR CATALOG ENDPOINTS (no auth required)
// ─────────────────────────────────────────────────────────────────────────────

// Build and cache the full catalog: deviceTypes → manufacturers → models
async function buildCatalog() {
  if (catalogCache && Date.now() - catalogCacheAt < CACHE_TTL_MS) {
    return catalogCache;
  }

  const deviceTypes = await DeviceService.getDeviceTypes();
  const catalog = [];

  for (const dt of deviceTypes) {
    const manufacturers = await DeviceService.getManufacturersByDeviceType(dt.name);
    const dtEntry = {
      name: dt.name,
      slug: toSlug(dt.name),
      manufacturers: [],
    };

    for (const mfr of manufacturers) {
      const models = await DeviceService.getModelsByTypeAndManufacturer(dt.name, String(mfr._id));
      dtEntry.manufacturers.push({
        name: mfr.name,
        slug: toSlug(mfr.name),
        models: models.map((m) => ({
          name: m.name,
          slug: toSlug(m.name),
          image: m.image || '',
        })),
      });
    }

    catalog.push(dtEntry);
  }

  catalogCache = catalog;
  catalogCacheAt = Date.now();
  return catalog;
}

// GET /api/seo/repair-catalog
// Returns full device-type → manufacturer → model hierarchy (public, cached)
router.get('/repair-catalog', async (req, res) => {
  try {
    const catalog = await buildCatalog();
    res.json({ success: true, catalog });
  } catch (error) {
    console.error('SEORoutes: Error building repair catalog:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/seo/repair-catalog/:deviceTypeSlug/services
// Returns repair services + add-ons for a device type (optionally filtered by
// manufacturer and model slugs via query params ?manufacturer=apple&model=iphone-14)
router.get('/repair-catalog/:deviceTypeSlug/services', async (req, res) => {
  try {
    const { deviceTypeSlug } = req.params;
    const { manufacturer: manufacturerSlug, model: modelSlug } = req.query;

    const catalog = await buildCatalog();
    const dtEntry = catalog.find((d) => d.slug === deviceTypeSlug);
    if (!dtEntry) {
      return res.status(404).json({ success: false, error: 'Device type not found' });
    }

    // Build filter params for ServiceService
    const filters = { deviceType: dtEntry.name, limit: 500 };

    if (manufacturerSlug) {
      const mfrEntry = dtEntry.manufacturers.find((m) => m.slug === manufacturerSlug);
      if (mfrEntry) filters.manufacturerPrecise = mfrEntry.name;
    }
    if (modelSlug && filters.manufacturerPrecise) {
      const mfrEntry = dtEntry.manufacturers.find((m) => m.slug === manufacturerSlug);
      const modelEntry = mfrEntry && mfrEntry.models.find((m) => m.slug === modelSlug);
      if (modelEntry) filters.modelPrecise = modelEntry.name;
    }

    const serviceResult = await ServiceService.list(filters, { page: 1, limit: 500 }, {});
    const addOnResult = await AddOnServiceService.list({ deviceType: dtEntry.name, limit: 200 });

    res.json({
      success: true,
      deviceType: dtEntry.name,
      services: serviceResult.services.map((s) => ({
        _id: s._id,
        name: s.name,
        description: s.shortDescription || s.description || '',
        price: s.price,
        estimatedTime: s.estimatedTime || '',
        category: s.category || '',
        seoName: s.seoName || s.name,
      })),
      addOns: addOnResult.addOnServices.map((a) => ({
        _id: a._id,
        name: a.name,
        description: a.shortDescription || a.description || '',
        price: a.price,
      })),
    });
  } catch (error) {
    console.error('SEORoutes: Error fetching repair-catalog services:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/seo/metadata  (public – already used elsewhere, keep untouched)
router.get('/metadata', async (req, res) => {
  try {
    const { pageType, pageId } = req.query;
    if (!pageType) {
      return res.status(400).json({ success: false, error: 'pageType required' });
    }
    const settings = await SEOService.getSEOSettings(pageType, pageId || '');
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/seo/faq-data
// Public endpoint – returns all active FAQs grouped by category for JSON-LD
// pre-rendering, sitemap enrichment, and external SEO tooling.
// Cached for 10 minutes to reduce DB load.
let faqSeoCache = null;
let faqSeoCacheAt = 0;

router.get('/faq-data', async (req, res) => {
  try {
    if (faqSeoCache && Date.now() - faqSeoCacheAt < CACHE_TTL_MS) {
      return res.json({ success: true, ...faqSeoCache });
    }

    const result = await FAQService.getFAQs({ isActive: true, limit: 500 });

    const faqJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': 'https://www.mcrepair.de/faq#faqpage',
      url: 'https://www.mcrepair.de/faq',
      name: 'Häufig gestellte Fragen | McRepair.de',
      mainEntity: result.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    };

    const payload = {
      groupedFAQs: result.groupedFAQs,
      totalFAQs: result.totalFAQs,
      jsonLd: faqJsonLd,
    };

    faqSeoCache = payload;
    faqSeoCacheAt = Date.now();

    res.json({ success: true, ...payload });
  } catch (error) {
    console.error('SEORoutes: Error building FAQ SEO data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;