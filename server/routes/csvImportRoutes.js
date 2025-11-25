const express = require('express');
const { requireAdmin } = require('./middleware/auth');
const CSVImportService = require('../services/csvImportService');

const router = express.Router();

// Description: Validate CSV column mapping and preview data
// Endpoint: POST /api/csv-import/validate
// Request: { csvData: Array<Record<string, string>>, columnMapping: Record<string, string>, options?: { skipDuplicates?: boolean } }
// Response: { success: boolean, data: Array<User>, summary: { totalRows: number, validRows: number, duplicateRows: number, skippedRows: number }, duplicates?: Array, validationErrors?: Array }
router.post('/validate', requireAdmin, async (req, res) => {
  try {
    const { csvData, columnMapping, options } = req.body;

    if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid CSV data. Expected non-empty array of records.'
      });
    }

    if (!columnMapping || typeof columnMapping !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid column mapping. Expected object mapping CSV columns to user fields.'
      });
    }

    console.log(`CSV Import: Processing ${csvData.length} records for validation`);

    const result = await CSVImportService.processCSVImport(csvData, columnMapping, options);

    res.status(200).json(result);
  } catch (error) {
    console.error(`CSV Import validation error: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error validating CSV data'
    });
  }
});

// Description: Import validated users into the database
// Endpoint: POST /api/csv-import/import
// Request: { users: Array<{ email: string, name: string, phone?: string, role?: string, isActive?: boolean, password: string }> }
// Response: { success: boolean, imported: number, failed: number, results: { successful: Array, failed: Array } }
router.post('/import', requireAdmin, async (req, res) => {
  try {
    const { users } = req.body;

    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid users data. Expected non-empty array.'
      });
    }

    console.log(`CSV Import: Starting import of ${users.length} users`);

    const result = await CSVImportService.importUsers(users);

    res.status(200).json(result);
  } catch (error) {
    console.error(`CSV Import import error: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error importing users'
    });
  }
});

module.exports = router;
