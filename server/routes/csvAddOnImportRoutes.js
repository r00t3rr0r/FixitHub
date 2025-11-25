const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { requireAdmin } = require('./middleware/auth');
const CSVAddOnImportService = require('../services/csvAddOnImportService');

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, '../uploads/csv'),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads/csv');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created CSV uploads directory:', uploadsDir);
}

/**
 * Parse CSV file
 * @param {string} filePath - Path to CSV file
 * @returns {Promise<Array>} Parsed CSV data
 */
const parseCSVFile = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

// Description: Validate CSV file for add-on service import
// Endpoint: POST /api/csv-addon-import/validate
// Request: FormData with 'file' and optional 'columnMapping' (JSON string)
// Response: ValidationResult with success, errors, warnings, validatedData, duplicateCheck, and stats
router.post('/validate', requireAdmin, upload.single('file'), async (req, res) => {
  console.log('POST /api/csv-addon-import/validate - Validating CSV file for add-on service import');

  try {
    if (!req.file) {
      console.error('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`Processing CSV file: ${req.file.originalname} (${req.file.size} bytes)`);

    // Parse CSV file
    const csvData = await parseCSVFile(req.file.path);
    console.log(`Parsed ${csvData.length} rows from CSV`);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    console.log('Temporary CSV file deleted');

    if (csvData.length === 0) {
      console.error('CSV file is empty');
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    // Get column mapping if provided
    const columnMapping = req.body.columnMapping ? JSON.parse(req.body.columnMapping) : null;

    if (!columnMapping) {
      // First pass: return columns for mapping
      const columns = Object.keys(csvData[0]);
      console.log(`Returning ${columns.length} columns for mapping:`, columns);
      return res.json({
        success: true,
        needsMapping: true,
        columns,
        previewData: csvData.slice(0, 5),
        totalRows: csvData.length,
      });
    }

    // Second pass: validate with column mapping
    console.log('Validating CSV data with column mapping:', columnMapping);
    const result = await CSVAddOnImportService.processCSVImport(csvData, columnMapping);

    console.log(`Validation complete: ${result.success ? 'success' : 'failed'} - ${result.validatedData?.length || 0} valid rows, ${result.errors?.length || 0} errors`);

    res.json(result);
  } catch (error) {
    console.error('Error validating CSV add-on import:', error);

    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log('Cleaned up temporary file after error');
    }

    res.status(500).json({ error: error.message || 'Failed to validate CSV file' });
  }
});

// Description: Import add-on services from validated CSV data
// Endpoint: POST /api/csv-addon-import/import
// Request: { validatedData: ValidatedRow[], options: { skipDuplicates?: boolean, updateExisting?: boolean } }
// Response: ImportResult with success, imported, skipped, failed, and stats
router.post('/import', requireAdmin, async (req, res) => {
  console.log('POST /api/csv-addon-import/import - Starting add-on service import');

  try {
    const { validatedData, options = {} } = req.body;

    if (!validatedData || !Array.isArray(validatedData)) {
      console.error('Invalid validated data');
      return res.status(400).json({ error: 'Invalid validated data' });
    }

    console.log(`Importing ${validatedData.length} add-on services with options:`, options);

    const result = await CSVAddOnImportService.importAddOns(validatedData, {
      skipDuplicates: options.skipDuplicates !== false,
      updateExisting: options.updateExisting === true,
      batchSize: 100, // Process in batches for large files
    });

    console.log(`Import complete: ${result.stats.importedCount} imported, ${result.stats.skippedCount} skipped, ${result.stats.failedCount} failed`);

    res.json(result);
  } catch (error) {
    console.error('Error importing add-on services from CSV:', error);
    res.status(500).json({ error: error.message || 'Failed to import add-on services' });
  }
});

module.exports = router;
