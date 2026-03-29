const express = require('express');
const ProfitabilityService = require('../services/profitabilityService');
const { requireUser, requireRole } = require('./middleware/auth');

const router = express.Router();
const requireAdmin = [requireUser, requireRole(['admin'])];

router.get('/profitability', requireAdmin, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 200;
    const report = await ProfitabilityService.getProfitabilityReport({ limit });

    return res.status(200).json({
      success: true,
      ...report,
    });
  } catch (error) {
    console.error('Admin analytics profitability error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch profitability report',
    });
  }
});

router.get('/profitability/settings', requireAdmin, async (_req, res) => {
  try {
    const settings = await ProfitabilityService.getSettings();
    return res.status(200).json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Admin analytics settings error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch profitability settings',
    });
  }
});

router.put('/profitability/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await ProfitabilityService.updateSettings(req.body || {});
    return res.status(200).json({
      success: true,
      settings,
      message: 'Profitability settings updated successfully',
    });
  } catch (error) {
    console.error('Admin analytics settings update error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update profitability settings',
    });
  }
});

module.exports = router;
