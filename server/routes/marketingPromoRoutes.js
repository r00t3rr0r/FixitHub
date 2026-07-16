const express = require('express');

const { requireUser, requireRole } = require('./middleware/auth');
const MarketingPromoService = require('../services/marketingPromoService');

const router = express.Router();
const requireAdmin = [requireUser, requireRole(['admin'])];

router.get('/overview', requireAdmin, async (req, res) => {
  try {
    const data = await MarketingPromoService.getOverview(req.query || {});
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    console.error('MarketingPromoRoutes overview error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to load overview' });
  }
});

router.get('/reports', requireAdmin, async (req, res) => {
  try {
    const data = await MarketingPromoService.getReports(req.query || {});
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    console.error('MarketingPromoRoutes reports error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to load reports' });
  }
});

router.get('/audit-log', requireAdmin, async (req, res) => {
  try {
    const data = await MarketingPromoService.listAuditLogs(req.query || {});
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    console.error('MarketingPromoRoutes audit-log error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to load audit logs' });
  }
});

router.get('/settings', requireAdmin, async (_req, res) => {
  try {
    const settings = await MarketingPromoService.getSettings();
    return res.status(200).json({ success: true, settings });
  } catch (error) {
    console.error('MarketingPromoRoutes get settings error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to load settings' });
  }
});

router.put('/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await MarketingPromoService.updateSettings(req.body || {}, { user: req.user, req });
    return res.status(200).json({ success: true, settings, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('MarketingPromoRoutes update settings error:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to update settings' });
  }
});

// ADCELL Tracking Config
router.get('/adcell-config', requireAdmin, async (_req, res) => {
  try {
    const config = await MarketingPromoService.getAdcellConfig();
    return res.status(200).json({ success: true, config });
  } catch (error) {
    console.error('MarketingPromoRoutes get adcell config error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to load ADCELL config' });
  }
});

router.put('/adcell-config', requireAdmin, async (req, res) => {
  try {
    const config = await MarketingPromoService.updateAdcellConfig(req.body || {}, { user: req.user, req });
    return res.status(200).json({ success: true, config, message: 'ADCELL Konfiguration gespeichert.' });
  } catch (error) {
    console.error('MarketingPromoRoutes update adcell config error:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to update ADCELL config' });
  }
});

router.get('/newsletters', requireAdmin, async (req, res) => {
  try {
    const data = await MarketingPromoService.listNewsletters(req.query || {});
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    console.error('MarketingPromoRoutes list newsletters error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to load newsletters' });
  }
});

router.post('/newsletters', requireAdmin, async (req, res) => {
  try {
    const newsletter = await MarketingPromoService.createNewsletter(req.body || {}, { user: req.user, req });
    return res.status(201).json({ success: true, newsletter, message: 'Newsletter created successfully' });
  } catch (error) {
    console.error('MarketingPromoRoutes create newsletter error:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to create newsletter' });
  }
});

router.put('/newsletters/:id', requireAdmin, async (req, res) => {
  try {
    const newsletter = await MarketingPromoService.updateNewsletter(req.params.id, req.body || {}, { user: req.user, req });
    return res.status(200).json({ success: true, newsletter, message: 'Newsletter updated successfully' });
  } catch (error) {
    console.error('MarketingPromoRoutes update newsletter error:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to update newsletter' });
  }
});

router.post('/newsletters/:id/duplicate', requireAdmin, async (req, res) => {
  try {
    const newsletter = await MarketingPromoService.duplicateNewsletter(req.params.id, { user: req.user, req });
    return res.status(201).json({ success: true, newsletter, message: 'Newsletter duplicated successfully' });
  } catch (error) {
    console.error('MarketingPromoRoutes duplicate newsletter error:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to duplicate newsletter' });
  }
});

router.post('/newsletters/:id/archive', requireAdmin, async (req, res) => {
  try {
    const newsletter = await MarketingPromoService.archiveNewsletter(req.params.id, { user: req.user, req });
    return res.status(200).json({ success: true, newsletter, message: 'Newsletter archived successfully' });
  } catch (error) {
    console.error('MarketingPromoRoutes archive newsletter error:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to archive newsletter' });
  }
});

router.post('/newsletters/:id/test-send', requireAdmin, async (req, res) => {
  try {
    const result = await MarketingPromoService.sendNewsletterTest(req.params.id, req.body?.testEmail, { user: req.user, req });
    return res.status(200).json({ success: true, result, message: 'Test send completed' });
  } catch (error) {
    console.error('MarketingPromoRoutes newsletter test-send error:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to test-send newsletter' });
  }
});

router.post('/newsletters/:id/schedule', requireAdmin, async (req, res) => {
  try {
    const newsletter = await MarketingPromoService.scheduleNewsletter(req.params.id, req.body?.scheduledAt, { user: req.user, req });
    return res.status(200).json({ success: true, newsletter, message: 'Newsletter scheduled successfully' });
  } catch (error) {
    console.error('MarketingPromoRoutes newsletter schedule error:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to schedule newsletter' });
  }
});

router.post('/newsletters/:id/send', requireAdmin, async (req, res) => {
  try {
    const data = await MarketingPromoService.sendNewsletterNow(req.params.id, { user: req.user, req });
    return res.status(200).json({ success: true, ...data, message: 'Newsletter send completed' });
  } catch (error) {
    console.error('MarketingPromoRoutes newsletter send error:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to send newsletter' });
  }
});

router.get('/newsletters/:id/deliveries', requireAdmin, async (req, res) => {
  try {
    const data = await MarketingPromoService.listNewsletterDeliveries(req.params.id, req.query || {});
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    console.error('MarketingPromoRoutes newsletter deliveries error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to load newsletter deliveries' });
  }
});

router.get('/promo-codes', requireAdmin, async (req, res) => {
  try {
    const data = await MarketingPromoService.listPromoCodes(req.query || {});
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    console.error('MarketingPromoRoutes promo-codes list error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to load promo codes' });
  }
});

router.post('/promo-codes', requireAdmin, async (req, res) => {
  try {
    const promoCode = await MarketingPromoService.createPromoCode(req.body || {}, { user: req.user, req });
    return res.status(201).json({ success: true, promoCode, message: 'Promo code created successfully' });
  } catch (error) {
    console.error('MarketingPromoRoutes promo-codes create error:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to create promo code' });
  }
});

router.put('/promo-codes/:id', requireAdmin, async (req, res) => {
  try {
    const promoCode = await MarketingPromoService.updatePromoCode(req.params.id, req.body || {}, { user: req.user, req });
    return res.status(200).json({ success: true, promoCode, message: 'Promo code updated successfully' });
  } catch (error) {
    console.error('MarketingPromoRoutes promo-codes update error:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to update promo code' });
  }
});

router.post('/promo-codes/:id/toggle-active', requireAdmin, async (req, res) => {
  try {
    const promoCode = await MarketingPromoService.setPromoCodeActiveState(req.params.id, !!req.body?.enabled, { user: req.user, req });
    return res.status(200).json({ success: true, promoCode, message: 'Promo code status updated' });
  } catch (error) {
    console.error('MarketingPromoRoutes promo-codes toggle error:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to change promo code status' });
  }
});

router.post('/promo-codes/:id/archive', requireAdmin, async (req, res) => {
  try {
    const promoCode = await MarketingPromoService.archivePromoCode(req.params.id, { user: req.user, req });
    return res.status(200).json({ success: true, promoCode, message: 'Promo code archived successfully' });
  } catch (error) {
    console.error('MarketingPromoRoutes promo-codes archive error:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to archive promo code' });
  }
});

router.get('/promo-codes/:id/redemptions', requireAdmin, async (req, res) => {
  try {
    const data = await MarketingPromoService.listPromoRedemptions(req.params.id, req.query || {});
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    console.error('MarketingPromoRoutes promo-codes redemptions error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to load redemptions' });
  }
});

router.get('/segments', requireAdmin, async (req, res) => {
  try {
    const data = await MarketingPromoService.listSegments(req.query || {});
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    console.error('MarketingPromoRoutes segments list error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to load segments' });
  }
});

router.post('/segments', requireAdmin, async (req, res) => {
  try {
    const segment = await MarketingPromoService.createSegment(req.body || {}, { user: req.user, req });
    return res.status(201).json({ success: true, segment, message: 'Segment created successfully' });
  } catch (error) {
    console.error('MarketingPromoRoutes segments create error:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to create segment' });
  }
});

router.put('/segments/:id', requireAdmin, async (req, res) => {
  try {
    const segment = await MarketingPromoService.updateSegment(req.params.id, req.body || {}, { user: req.user, req });
    return res.status(200).json({ success: true, segment, message: 'Segment updated successfully' });
  } catch (error) {
    console.error('MarketingPromoRoutes segments update error:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to update segment' });
  }
});

router.get('/segments/:id/preview', requireAdmin, async (req, res) => {
  try {
    const preview = await MarketingPromoService.previewSegment(req.params.id);
    return res.status(200).json({ success: true, preview });
  } catch (error) {
    console.error('MarketingPromoRoutes segments preview error:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to preview segment' });
  }
});

module.exports = router;
