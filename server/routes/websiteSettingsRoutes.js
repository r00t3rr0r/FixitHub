const express = require('express');
const router = express.Router();
const { requireAdmin } = require('./middleware/auth');
const WebsiteSettingsService = require('../services/websiteSettingsService');

// Description: Get website settings
// Endpoint: GET /api/website-settings
// Request: {}
// Response: { settings: WebsiteSettings }
router.get('/', requireAdmin, async (req, res) => {
  try {
    console.log('GET /api/website-settings - Fetching website settings');
    const settings = await WebsiteSettingsService.getSettings();
    res.json({ settings });
  } catch (error) {
    console.error('Error fetching website settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update website settings (bulk update)
// Endpoint: PUT /api/website-settings
// Request: { updates: Partial<WebsiteSettings> }
// Response: { settings: WebsiteSettings }
router.put('/', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings - Updating website settings');
    const settings = await WebsiteSettingsService.updateSettings(req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating website settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update general settings
// Endpoint: PUT /api/website-settings/general
// Request: { projectTitle, subdomain, customDomain, defaultLanguage, supportedLanguages }
// Response: { settings: WebsiteSettings }
router.put('/general', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/general - Updating general settings');
    const settings = await WebsiteSettingsService.updateGeneralSettings(req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating general settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update SEO settings
// Endpoint: PUT /api/website-settings/seo
// Request: { title, description, keywords, favicon, enableIndexing, ogImage, twitterCard }
// Response: { settings: WebsiteSettings }
router.put('/seo', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/seo - Updating SEO settings');
    const settings = await WebsiteSettingsService.updateSEOSettings(req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating SEO settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update page layout
// Endpoint: PUT /api/website-settings/page-layout
// Request: { preset, maxWidth, sidebar, contentPadding }
// Response: { settings: WebsiteSettings }
router.put('/page-layout', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/page-layout - Updating page layout');
    const settings = await WebsiteSettingsService.updatePageLayout(req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating page layout:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update header configuration
// Endpoint: PUT /api/website-settings/header
// Request: { logo, logoHeight, height, background, position, transparent, showSearch, showLanguageSelector, showThemeToggle }
// Response: { settings: WebsiteSettings }
router.put('/header', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/header - Updating header');
    const settings = await WebsiteSettingsService.updateHeader(req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating header:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update footer configuration
// Endpoint: PUT /api/website-settings/footer
// Request: { background, textColor, showSocialIcons, socialLinks, columns, copyright, showNewsletter }
// Response: { settings: WebsiteSettings }
router.put('/footer', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/footer - Updating footer');
    const settings = await WebsiteSettingsService.updateFooter(req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating footer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update navigation menu
// Endpoint: PUT /api/website-settings/navigation
// Request: { items, mobileBreakpoint, showMegaMenu }
// Response: { settings: WebsiteSettings }
router.put('/navigation', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/navigation - Updating navigation');
    const settings = await WebsiteSettingsService.updateNavigation(req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating navigation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update color scheme
// Endpoint: PUT /api/website-settings/color-scheme
// Request: { primary, secondary, accent, background, text, success, warning, error, info }
// Response: { settings: WebsiteSettings }
router.put('/color-scheme', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/color-scheme - Updating color scheme');
    const settings = await WebsiteSettingsService.updateColorScheme(req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating color scheme:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update dark mode settings
// Endpoint: PUT /api/website-settings/dark-mode
// Request: { enabled, defaultMode, colorScheme }
// Response: { settings: WebsiteSettings }
router.put('/dark-mode', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/dark-mode - Updating dark mode');
    const settings = await WebsiteSettingsService.updateDarkMode(req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating dark mode:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update typography
// Endpoint: PUT /api/website-settings/typography
// Request: { fontFamily, baseFontSize, lineHeight, h1, h2, h3, h4, h5, h6 }
// Response: { settings: WebsiteSettings }
router.put('/typography', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/typography - Updating typography');
    const settings = await WebsiteSettingsService.updateTypography(req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating typography:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update spacing
// Endpoint: PUT /api/website-settings/spacing
// Request: { xs, sm, md, lg, xl, xxl }
// Response: { settings: WebsiteSettings }
router.put('/spacing', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/spacing - Updating spacing');
    const settings = await WebsiteSettingsService.updateSpacing(req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating spacing:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update border radius
// Endpoint: PUT /api/website-settings/border-radius
// Request: { sm, md, lg, xl }
// Response: { settings: WebsiteSettings }
router.put('/border-radius', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/border-radius - Updating border radius');
    const settings = await WebsiteSettingsService.updateBorderRadius(req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating border radius:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update shadows
// Endpoint: PUT /api/website-settings/shadows
// Request: { sm, md, lg, xl }
// Response: { settings: WebsiteSettings }
router.put('/shadows', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/shadows - Updating shadows');
    const settings = await WebsiteSettingsService.updateShadows(req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating shadows:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update background
// Endpoint: PUT /api/website-settings/background
// Request: { type, value, image, pattern }
// Response: { settings: WebsiteSettings }
router.put('/background', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/background - Updating background');
    const settings = await WebsiteSettingsService.updateBackground(req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating background:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update content modules
// Endpoint: PUT /api/website-settings/content-modules
// Request: { textBlocks, buttons, images, forms }
// Response: { settings: WebsiteSettings }
router.put('/content-modules', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/content-modules - Updating content modules');
    const settings = await WebsiteSettingsService.updateContentModules(req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating content modules:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update breakpoints
// Endpoint: PUT /api/website-settings/breakpoints
// Request: { mobile, tablet, desktop, wide }
// Response: { settings: WebsiteSettings }
router.put('/breakpoints', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/breakpoints - Updating breakpoints');
    const settings = await WebsiteSettingsService.updateBreakpoints(req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating breakpoints:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update responsive settings
// Endpoint: PUT /api/website-settings/responsive
// Request: { hideOnMobile, hideOnTablet, hideOnDesktop, mobileTypography, mobileSpacing }
// Response: { settings: WebsiteSettings }
router.put('/responsive', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/responsive - Updating responsive settings');
    const settings = await WebsiteSettingsService.updateResponsiveSettings(req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating responsive settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update animations
// Endpoint: PUT /api/website-settings/animations
// Request: { enableScrollAnimations, enableHoverEffects, enableTransitions, enableParallax, transitionDuration, scrollAnimationType }
// Response: { settings: WebsiteSettings }
router.put('/animations', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/animations - Updating animations');
    const settings = await WebsiteSettingsService.updateAnimations(req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating animations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update custom CSS
// Endpoint: PUT /api/website-settings/custom-css
// Request: { css: string }
// Response: { settings: WebsiteSettings }
router.put('/custom-css', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/custom-css - Updating custom CSS');
    const settings = await WebsiteSettingsService.updateCustomCSS(req.body.css);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating custom CSS:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update custom JavaScript
// Endpoint: PUT /api/website-settings/custom-js
// Request: { js: string }
// Response: { settings: WebsiteSettings }
router.put('/custom-js', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/custom-js - Updating custom JavaScript');
    const settings = await WebsiteSettingsService.updateCustomJS(req.body.js);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating custom JavaScript:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update integrations
// Endpoint: PUT /api/website-settings/integrations
// Request: { googleAnalytics, googleTagManager, facebookPixel, chatWidget, cookieBanner }
// Response: { settings: WebsiteSettings }
router.put('/integrations', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/integrations - Updating integrations');
    const settings = await WebsiteSettingsService.updateIntegrations(req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating integrations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Publish website
// Endpoint: POST /api/website-settings/publish
// Request: {}
// Response: { settings: WebsiteSettings }
router.post('/publish', requireAdmin, async (req, res) => {
  try {
    console.log('POST /api/website-settings/publish - Publishing website by user:', req.user._id);
    const settings = await WebsiteSettingsService.publishWebsite(req.user._id);
    res.json({ settings, message: 'Website published successfully' });
  } catch (error) {
    console.error('Error publishing website:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Create backup
// Endpoint: POST /api/website-settings/backup
// Request: {}
// Response: { success: boolean, backup: object, timestamp: Date }
router.post('/backup', requireAdmin, async (req, res) => {
  try {
    console.log('POST /api/website-settings/backup - Creating backup');
    const result = await WebsiteSettingsService.createBackup();
    res.json(result);
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Export settings
// Endpoint: GET /api/website-settings/export
// Request: { format?: 'json' | 'html' | 'zip' }
// Response: { data: object, mimeType: string }
router.get('/export', requireAdmin, async (req, res) => {
  try {
    const format = req.query.format || 'json';
    console.log('GET /api/website-settings/export - Exporting as', format);
    const result = await WebsiteSettingsService.exportSettings(format);
    res.json(result);
  } catch (error) {
    console.error('Error exporting settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update page hierarchy
// Endpoint: PUT /api/website-settings/pages
// Request: { pages: Array<Page> }
// Response: { settings: WebsiteSettings }
router.put('/pages', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/pages - Updating pages');
    const settings = await WebsiteSettingsService.updatePages(req.body.pages);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating pages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Add new page
// Endpoint: POST /api/website-settings/pages
// Request: { title, slug, parentId, showInNavigation, metaTitle, metaDescription }
// Response: { settings: WebsiteSettings }
router.post('/pages', requireAdmin, async (req, res) => {
  try {
    console.log('POST /api/website-settings/pages - Adding new page');
    const settings = await WebsiteSettingsService.addPage(req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Error adding page:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Update specific page
// Endpoint: PUT /api/website-settings/pages/:pageId
// Request: { title, slug, parentId, showInNavigation, metaTitle, metaDescription, isPublished }
// Response: { settings: WebsiteSettings }
router.put('/pages/:pageId', requireAdmin, async (req, res) => {
  try {
    console.log('PUT /api/website-settings/pages/:pageId - Updating page:', req.params.pageId);
    const settings = await WebsiteSettingsService.updatePage(req.params.pageId, req.body);
    res.json({ settings });
  } catch (error) {
    console.error('Error updating page:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Delete page
// Endpoint: DELETE /api/website-settings/pages/:pageId
// Request: {}
// Response: { settings: WebsiteSettings }
router.delete('/pages/:pageId', requireAdmin, async (req, res) => {
  try {
    console.log('DELETE /api/website-settings/pages/:pageId - Deleting page:', req.params.pageId);
    const settings = await WebsiteSettingsService.deletePage(req.params.pageId);
    res.json({ settings });
  } catch (error) {
    console.error('Error deleting page:', error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Reorder pages
// Endpoint: POST /api/website-settings/pages/reorder
// Request: { pageIds: Array<string> }
// Response: { settings: WebsiteSettings }
router.post('/pages/reorder', requireAdmin, async (req, res) => {
  try {
    console.log('POST /api/website-settings/pages/reorder - Reordering pages');
    const settings = await WebsiteSettingsService.reorderPages(req.body.pageIds);
    res.json({ settings });
  } catch (error) {
    console.error('Error reordering pages:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
