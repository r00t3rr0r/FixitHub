const express = require('express');
const ProfitabilityService = require('../services/profitabilityService');
const { requireUser, requireRole } = require('./middleware/auth');

const router = express.Router();
const requireAdmin = [requireUser, requireRole(['admin'])];

router.get('/profitability', requireAdmin, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 200;
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    const projectedWorkdays = req.query.projectedWorkdays || null;
    const report = await ProfitabilityService.getProfitabilityReport({
      limit,
      startDate,
      endDate,
      projectedWorkdays,
    });

    return res.status(200).json({
      success: true,
      ...report,
    });
  } catch (error) {
    console.error('Admin analytics profitability error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode ? error.message : 'Die Auswertung konnte nicht geladen werden.',
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
      error: 'Die Auswertungs-Einstellungen konnten nicht geladen werden.',
    });
  }
});

router.put('/profitability/settings', requireAdmin, async (req, res) => {
  try {
    // Die Antwort enthaelt die nach dem Speichern NEU GELESENEN Werte (nicht das Echo
    // der Anfrage) - so sieht die Oberflaeche genau das, was gespeichert ist.
    const settings = await ProfitabilityService.updateSettings(req.body || {});
    return res.status(200).json({
      success: true,
      settings,
      message: 'Gespeichert – Auswertung wird mit den neuen Werten berechnet.',
    });
  } catch (error) {
    console.error('Admin analytics settings update error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code,
      problems: error.problems,
      error: error.statusCode ? error.message : 'Die Einstellungen konnten nicht gespeichert werden.',
    });
  }
});

module.exports = router;
