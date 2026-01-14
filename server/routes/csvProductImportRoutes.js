const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { auth, requireRole, requireAdmin, requireStaff } = require('./middleware/auth');
const CSVProductImportService = require('../services/csvProductImportService');

// Configure multer for file upload
const upload = multer({
  dest: 'server/uploads/csv/',
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Description: Validate CSV file and preview data with column mapping
// Endpoint: POST /api/csv-product-import/validate
// Request: { file: File (multipart), columnMapping: Object }
// Response: { valid: boolean, validatedProducts: Array, errors: Array, warnings: Array, duplicates: Array, totalRows: number, validRows: number }
router.post('/validate', auth, requireRole(['admin', 'staff']), upload.single('file'), async (req, res) => {
  let filePath = null;

  try {
    console.log('CSV product validation request received');

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    filePath = req.file.path;
    const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2);
    console.log(`CSV file uploaded: ${filePath} (${req.file.size} bytes / ${fileSizeMB} MB)`);

    // Parse column mapping from request body
    let columnMapping = {};
    if (req.body.columnMapping) {
      try {
        columnMapping = JSON.parse(req.body.columnMapping);
        console.log('Column mapping received:', columnMapping);
      } catch (error) {
        console.error('Error parsing column mapping:', error);
        return res.status(400).json({ error: 'Invalid column mapping format' });
      }
    }

    // Parse CSV file
    const csvData = [];
    const readStream = fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        csvData.push(row);
      })
      .on('end', async () => {
        try {
          console.log(`CSV parsing complete: ${csvData.length} rows`);

          // If no column mapping provided, return CSV headers for mapping
          if (Object.keys(columnMapping).length === 0) {
            const headers = csvData.length > 0 ? Object.keys(csvData[0]) : [];
            console.log('No column mapping provided, returning headers:', headers);

            // Clean up uploaded file
            fs.unlinkSync(filePath);

            return res.json({
              headers,
              sampleData: csvData.slice(0, 5), // Return first 5 rows as sample
              totalRows: csvData.length
            });
          }

          // Validate CSV data with column mapping
          const validationResult = await CSVProductImportService.processCSVImport(csvData, columnMapping);

          // Clean up uploaded file
          fs.unlinkSync(filePath);

          console.log('Validation complete, sending response');
          res.json(validationResult);
        } catch (error) {
          console.error('Error during CSV validation:', error);

          // Clean up uploaded file
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }

          res.status(500).json({ error: error.message });
        }
      })
      .on('error', (error) => {
        console.error('Error reading CSV file:', error);

        // Clean up uploaded file
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        res.status(500).json({ error: 'Error reading CSV file' });
      });
  } catch (error) {
    console.error('Error in CSV validation endpoint:', error);

    // Clean up uploaded file
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(500).json({ error: error.message });
  }
});

// Description: Import validated products from CSV
// Endpoint: POST /api/csv-product-import/import
// Request: { validatedProducts: Array, options: { updateExisting: boolean, skipDuplicates: boolean } }
// Response: { successful: Array, failed: Array, updated: Array, skipped: Array }
router.post('/import', auth, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    console.log('CSV product import request received');

    const { validatedProducts, options } = req.body;

    if (!validatedProducts || !Array.isArray(validatedProducts)) {
      return res.status(400).json({ error: 'Invalid validated products data' });
    }

    console.log(`Starting import of ${validatedProducts.length} products`);

    // Import products
    const results = await CSVProductImportService.importProducts(validatedProducts, options);

    console.log('Import complete, sending results');
    res.json(results);
  } catch (error) {
    console.error('Error during CSV import:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
