const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const CSVPartsImportService = require('../services/csvPartsImportService');
const { requireUser } = require('./middleware/auth');

const router = express.Router();

// Middleware to check if user is admin or staff
const requireAdminOrStaff = (req, res, next) => {
  if (!req.user || !['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Admin or staff role required.' });
  }
  next();
};

// Configure multer for CSV file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Description: Validate CSV data and preview parts import results
// Endpoint: POST /api/csv-parts-import/validate
// Request: { csvData: Array<Record<string, string>>, columnMapping: Record<string, string>, options?: { skipDuplicates?: boolean, updateExisting?: boolean } }
// Response: { success: boolean, data: Array<Part>, summary: { totalRows: number, validRows: number, duplicateRows: number, skippedRows: number, errorRows: number }, duplicates?: Array, validationErrors?: Array }
router.post('/validate', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('CSV Parts Import: Validation request received from user:', req.user.email);

  try {
    const { csvData, columnMapping, options } = req.body;

    if (!csvData || !Array.isArray(csvData)) {
      return res.status(400).json({ error: 'CSV data is required and must be an array' });
    }

    if (!columnMapping || typeof columnMapping !== 'object') {
      return res.status(400).json({ error: 'Column mapping is required' });
    }

    console.log(`CSV Parts Import: Processing ${csvData.length} rows`);

    const result = await CSVPartsImportService.processCSVImport(csvData, columnMapping, options);

    console.log('CSV Parts Import: Validation complete');
    return res.status(200).json(result);
  } catch (error) {
    console.error('CSV Parts Import: Validation error:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to validate CSV data'
    });
  }
});

// Description: Import validated parts into the database
// Endpoint: POST /api/csv-parts-import/import
// Request: { parts: Array<Part> }
// Response: { success: boolean, imported: number, failed: number, results: { successful: Array, failed: Array } }
router.post('/import', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('CSV Parts Import: Import request received from user:', req.user.email);

  try {
    const { parts } = req.body;

    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ error: 'Parts array is required and cannot be empty' });
    }

    console.log(`CSV Parts Import: Importing ${parts.length} parts`);

    const result = await CSVPartsImportService.importParts(parts);

    console.log('CSV Parts Import: Import complete');
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('CSV Parts Import: Import error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to import parts'
    });
  }
});

// Description: Upload and parse CSV file for parts import
// Endpoint: POST /api/csv-parts-import/upload
// Request: multipart/form-data with 'file' field
// Response: { success: boolean, data: Array<Record<string, string>>, columns: string[], rowCount: number }
router.post('/upload', requireUser, requireAdminOrStaff, upload.single('file'), async (req, res) => {
  console.log('CSV Parts Import: File upload request received from user:', req.user.email);

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`CSV Parts Import: Processing file: ${req.file.originalname} (${req.file.size} bytes)`);

    const results = [];
    const stream = Readable.from(req.file.buffer);

    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        const columns = results.length > 0 ? Object.keys(results[0]) : [];

        console.log(`CSV Parts Import: Parsed ${results.length} rows with ${columns.length} columns`);

        return res.status(200).json({
          success: true,
          data: results,
          columns,
          rowCount: results.length
        });
      })
      .on('error', (error) => {
        console.error('CSV Parts Import: Error parsing CSV file:', error);
        return res.status(400).json({
          success: false,
          error: 'Failed to parse CSV file: ' + error.message
        });
      });
  } catch (error) {
    console.error('CSV Parts Import: Upload error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file'
    });
  }
});

module.exports = router;
