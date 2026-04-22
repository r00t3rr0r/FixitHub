const express = require('express');
const router = express.Router();
const { requireAdmin } = require('./middleware/auth');
const CSVDeviceImportService = require('../services/csvDeviceImportService');

// Validate device CSV import
router.post('/validate', requireAdmin, async (req, res) => {
  try {
    const { csvData, columnMapping, options } = req.body;
    if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid CSV data.' });
    }
    const result = await CSVDeviceImportService.validateDeviceCSVImport(csvData, columnMapping, options);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Validation failed.' });
  }
});

// Import validated device models
router.post('/import', requireAdmin, async (req, res) => {
  try {
    const { devices } = req.body;
    if (!devices || !Array.isArray(devices) || devices.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid devices data.' });
    }
    const result = await CSVDeviceImportService.importDevices(devices);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Import failed.' });
  }
});

module.exports = router;
