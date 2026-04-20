const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { requireAdmin } = require('./middleware/auth');
const CSVServiceImportService = require('../services/csvServiceImportService');

// Configure multer for CSV file upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
});

/**
 * Parse CSV buffer to JSON, auto-detects delimiter (comma or semicolon)
 * @param {Buffer} buffer - CSV file buffer
 * @returns {Promise<Array>} Parsed CSV data
 */
const parseCSV = (buffer) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const text = buffer.toString();
    // Auto-detect delimiter: count commas and semicolons in header
    const firstLine = text.split(/\r?\n/)[0] || '';
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';
    const stream = Readable.from(text);

    stream
      .pipe(csv({ separator: delimiter }))
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

// Description: Validate CSV file and return preview data
// Endpoint: POST /api/csv-service-import/validate
// Request: FormData with 'file' (CSV file) and 'columnMapping' (JSON string)
// Response: { success: boolean, validatedData: Array, errors: Array, warnings: Array, duplicateCheck: Object, stats: Object }
router.post('/validate', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    console.log('CSV service import validation started');

    if (!req.file) {
      console.error('No CSV file uploaded');
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2);
    console.log(`CSV service import: File received (${req.file.size} bytes / ${fileSizeMB} MB)`);

    // Parse column mapping from request
    let columnMapping = {};
    if (req.body.columnMapping) {
      try {
        columnMapping = JSON.parse(req.body.columnMapping);
      } catch (error) {
        console.error('Error parsing column mapping:', error);
        return res.status(400).json({ error: 'Invalid column mapping format' });
      }
    }

    console.log('Parsing CSV file...');
    const csvData = await parseCSV(req.file.buffer);
    console.log(`Parsed ${csvData.length} rows from CSV`);

    if (csvData.length === 0) {
      console.error('CSV file is empty');
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    // If no column mapping provided, return CSV columns for mapping
    if (Object.keys(columnMapping).length === 0) {
      const columns = Object.keys(csvData[0]);
      console.log(`No column mapping provided, returning ${columns.length} columns`);
      return res.status(200).json({
        success: true,
        needsMapping: true,
        columns,
        previewData: csvData.slice(0, 5), // First 5 rows for preview
        totalRows: csvData.length
      });
    }

    // Process and validate CSV data
    console.log('Processing CSV data with column mapping...');
    const result = await CSVServiceImportService.processCSVImport(csvData, columnMapping);

    console.log(`Validation complete: ${result.success ? 'Success' : 'Failed'}`);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error validating CSV import:', error);
    res.status(500).json({ error: error.message || 'Failed to validate CSV file' });
  }
});

// Description: Import services from validated CSV data
// Endpoint: POST /api/csv-service-import/import
// Request: { validatedData: Array, options: { skipDuplicates: boolean, updateExisting: boolean } }
// Response: { success: boolean, imported: Array, skipped: Array, failed: Array, stats: Object }
router.post('/import', requireAdmin, async (req, res) => {
  try {
    console.log('CSV service import started');

    const { validatedData, options } = req.body;

    if (!validatedData || !Array.isArray(validatedData)) {
      console.error('Invalid validated data');
      return res.status(400).json({ error: 'Invalid validated data' });
    }

    if (validatedData.length === 0) {
      console.error('No data to import');
      return res.status(400).json({ error: 'No data to import' });
    }

    console.log(`Starting import of ${validatedData.length} services`);
    const result = await CSVServiceImportService.importServices(validatedData, options || {});

    console.log(`Import complete: ${result.stats.importedCount} imported, ${result.stats.skippedCount} skipped, ${result.stats.failedCount} failed`);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error importing services from CSV:', error);
    res.status(500).json({ error: error.message || 'Failed to import services' });
  }
});

module.exports = router;
