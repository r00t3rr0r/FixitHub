const AddOnService = require('../models/AddOnService');

/**
 * CSV Add-On Service Import Service
 * Handles validation, column mapping, data preparation, and import of add-on services from CSV files
 */
class CSVAddOnImportService {
  /**
   * Validate column mapping and CSV data structure
   * @param {Array<Object>} csvData - Parsed CSV data
   * @param {Object} columnMapping - Mapping of CSV columns to add-on service fields
   * @returns {Object} Validation result with errors and warnings
   */
  static async validateColumnMapping(csvData, columnMapping) {
    console.log('Validating column mapping for CSV add-on service import');

    const errors = [];
    const warnings = [];

    // Required fields for AddOnService model
    const requiredFields = ['name', 'category', 'price'];

    // Check if required fields are mapped
    for (const field of requiredFields) {
      if (!columnMapping[field] || columnMapping[field] === '') {
        errors.push(`Required field "${field}" is not mapped`);
      }
    }

    // Check if mapped columns exist in CSV data
    if (csvData.length > 0) {
      const csvColumns = Object.keys(csvData[0]);
      for (const [field, column] of Object.entries(columnMapping)) {
        if (column && !csvColumns.includes(column)) {
          errors.push(`Mapped column "${column}" for field "${field}" does not exist in CSV`);
        }
      }
    }

    // Warn about unmapped optional fields
    const optionalFields = ['description', 'estimatedTime', 'bundleDiscount', 'popularity', 'deviceTypes', 'brands'];
    for (const field of optionalFields) {
      if (!columnMapping[field] || columnMapping[field] === '') {
        warnings.push(`Optional field "${field}" is not mapped`);
      }
    }

    console.log(`Column mapping validation complete: ${errors.length} errors, ${warnings.length} warnings`);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate individual add-on service data
   * @param {Object} addOnData - Add-on service data object
   * @param {number} rowIndex - Row index for error reporting
   * @returns {Object} Validation result with errors
   */
  static async validateAddOnData(addOnData, rowIndex) {
    const errors = [];

    // Validate name
    if (!addOnData.name || addOnData.name.trim() === '') {
      errors.push(`Row ${rowIndex + 1}: Service name is required`);
    } else if (addOnData.name.length < 3) {
      errors.push(`Row ${rowIndex + 1}: Service name must be at least 3 characters`);
    }

    // Validate category
    const validCategories = ['Protection', 'Service', 'Warranty', 'Accessory', 'Data'];
    if (!addOnData.category || addOnData.category.trim() === '') {
      errors.push(`Row ${rowIndex + 1}: Category is required`);
    } else if (!validCategories.includes(addOnData.category)) {
      errors.push(`Row ${rowIndex + 1}: Invalid category "${addOnData.category}". Valid values: ${validCategories.join(', ')}`);
    }

    // Validate price
    if (addOnData.price === undefined || addOnData.price === null) {
      errors.push(`Row ${rowIndex + 1}: Price is required`);
    } else {
      const price = parseFloat(addOnData.price);
      if (isNaN(price) || price < 0) {
        errors.push(`Row ${rowIndex + 1}: Price must be a positive number`);
      }
    }

    // Validate bundleDiscount if provided
    if (addOnData.bundleDiscount !== undefined && addOnData.bundleDiscount !== null && addOnData.bundleDiscount !== '') {
      const discount = parseFloat(addOnData.bundleDiscount);
      if (isNaN(discount) || discount < 0 || discount > 100) {
        errors.push(`Row ${rowIndex + 1}: Bundle discount must be a number between 0 and 100`);
      }
    }

    // Validate popularity if provided
    if (addOnData.popularity !== undefined && addOnData.popularity !== null && addOnData.popularity !== '') {
      const popularity = parseFloat(addOnData.popularity);
      if (isNaN(popularity) || popularity < 0 || popularity > 100) {
        errors.push(`Row ${rowIndex + 1}: Popularity must be a number between 0 and 100`);
      }
    }

    return { errors };
  }

  /**
   * Check for duplicate add-on services
   * @param {Array<Object>} addOnsData - Array of add-on service data objects
   * @returns {Object} Duplicate detection result
   */
  static async checkDuplicates(addOnsData) {
    console.log(`Checking for duplicates in ${addOnsData.length} add-on services`);

    const duplicates = [];
    const existingAddOns = await AddOnService.find({}, 'name category').lean();

    // Create a map of existing add-ons for quick lookup
    const existingMap = new Map();
    existingAddOns.forEach(addOn => {
      const key = `${addOn.name.toLowerCase()}_${addOn.category}`;
      existingMap.set(key, addOn);
    });

    // Check each add-on against existing ones
    addOnsData.forEach((addOnData, index) => {
      const key = `${addOnData.name.toLowerCase()}_${addOnData.category}`;
      if (existingMap.has(key)) {
        duplicates.push({
          rowIndex: index + 1,
          serviceName: addOnData.name,
          category: addOnData.category,
          existingId: existingMap.get(key)._id
        });
      }
    });

    console.log(`Found ${duplicates.length} duplicate add-on services`);

    return {
      hasDuplicates: duplicates.length > 0,
      duplicates,
      duplicateCount: duplicates.length
    };
  }

  /**
   * Clean and prepare add-on service data for import
   * @param {Object} rawData - Raw add-on service data from CSV
   * @param {Object} columnMapping - Column mapping
   * @returns {Object} Cleaned add-on service data
   */
  static cleanAddOnData(rawData, columnMapping) {
    const cleanedData = {};

    // Map and clean each field
    for (const [field, column] of Object.entries(columnMapping)) {
      if (column && rawData[column] !== undefined && rawData[column] !== null) {
        let value = rawData[column];

        // Trim strings
        if (typeof value === 'string') {
          value = value.trim();
        }

        // Convert empty strings to null
        if (value === '') {
          value = null;
        }

        // Field-specific cleaning
        switch (field) {
          case 'price':
            // Remove currency symbols and convert to number
            if (value !== null) {
              value = parseFloat(String(value).replace(/[$,€£]/g, ''));
            }
            break;

          case 'bundleDiscount':
          case 'popularity':
            // Convert to number
            if (value !== null) {
              value = parseFloat(String(value).replace(/[^0-9.]/g, ''));
            }
            break;

          case 'deviceTypes':
            // Parse array from comma-separated string
            if (value !== null && typeof value === 'string') {
              value = value.split(',').map(v => v.trim()).filter(v => v !== '');
            }
            break;

          case 'brands':
            // Parse array from comma-separated string
            if (value !== null && typeof value === 'string') {
              value = value.split(',').map(v => v.trim()).filter(v => v !== '');
            }
            break;

          case 'isActive':
            // Convert to boolean
            if (value !== null) {
              if (typeof value === 'string') {
                value = ['true', 'yes', '1', 'active'].includes(value.toLowerCase());
              } else {
                value = Boolean(value);
              }
            }
            break;
        }

        if (value !== null) {
          cleanedData[field] = value;
        }
      }
    }

    // Build compatibility array from deviceTypes and brands
    if (cleanedData.deviceTypes && Array.isArray(cleanedData.deviceTypes) && cleanedData.deviceTypes.length > 0) {
      const brands = cleanedData.brands || [];
      cleanedData.compatibility = cleanedData.deviceTypes.map(deviceType => ({
        deviceType,
        brands: Array.isArray(brands) ? brands : []
      }));

      // Remove temporary fields
      delete cleanedData.deviceTypes;
      delete cleanedData.brands;
    } else {
      cleanedData.compatibility = [];
    }

    // Set defaults for missing optional fields
    if (cleanedData.isActive === undefined) {
      cleanedData.isActive = true;
    }

    if (cleanedData.bundleDiscount === undefined) {
      cleanedData.bundleDiscount = 0;
    }

    if (cleanedData.popularity === undefined) {
      cleanedData.popularity = 0;
    }

    if (!cleanedData.estimatedTime) {
      cleanedData.estimatedTime = '30 minutes';
    }

    return cleanedData;
  }

  /**
   * Process and validate CSV data
   * @param {Array<Object>} csvData - Parsed CSV data
   * @param {Object} columnMapping - Column mapping
   * @returns {Object} Processing result with validated data and errors
   */
  static async processCSVImport(csvData, columnMapping) {
    console.log(`Processing CSV import with ${csvData.length} rows`);

    const validatedData = [];
    const errors = [];
    const warnings = [];

    // Validate column mapping first
    const mappingValidation = await this.validateColumnMapping(csvData, columnMapping);
    if (!mappingValidation.valid) {
      console.error('Column mapping validation failed:', mappingValidation.errors);
      return {
        success: false,
        errors: mappingValidation.errors,
        warnings: mappingValidation.warnings
      };
    }

    warnings.push(...mappingValidation.warnings);

    // Process each row
    for (let i = 0; i < csvData.length; i++) {
      const rawData = csvData[i];

      // Skip empty rows
      if (Object.values(rawData).every(val => !val || val === '')) {
        warnings.push(`Row ${i + 1}: Empty row skipped`);
        continue;
      }

      // Clean data
      const cleanedData = this.cleanAddOnData(rawData, columnMapping);

      // Validate data
      const validation = await this.validateAddOnData(cleanedData, i);
      if (validation.errors.length > 0) {
        errors.push(...validation.errors);
      } else {
        validatedData.push({
          rowIndex: i + 1,
          data: cleanedData
        });
      }
    }

    // Check for duplicates
    const duplicateCheck = await this.checkDuplicates(validatedData.map(v => v.data));
    if (duplicateCheck.hasDuplicates) {
      duplicateCheck.duplicates.forEach(dup => {
        warnings.push(`Row ${dup.rowIndex}: Add-on service "${dup.serviceName}" (${dup.category}) already exists in database`);
      });
    }

    console.log(`CSV processing complete: ${validatedData.length} valid rows, ${errors.length} errors, ${warnings.length} warnings`);

    return {
      success: errors.length === 0,
      validatedData,
      errors,
      warnings,
      duplicateCheck,
      stats: {
        totalRows: csvData.length,
        validRows: validatedData.length,
        errorRows: errors.length,
        duplicateRows: duplicateCheck.duplicateCount
      }
    };
  }

  /**
   * Import add-on services from validated data with batch processing for large files
   * @param {Array<Object>} validatedData - Validated add-on service data
   * @param {Object} options - Import options
   * @returns {Object} Import result
   */
  static async importAddOns(validatedData, options = {}) {
    console.log(`Starting import of ${validatedData.length} add-on services`);

    const {
      skipDuplicates = true,
      batchSize = 100,
      updateExisting = false
    } = options;

    const imported = [];
    const skipped = [];
    const failed = [];

    // Process in batches for large files
    for (let i = 0; i < validatedData.length; i += batchSize) {
      const batch = validatedData.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(validatedData.length / batchSize)}`);

      for (const item of batch) {
        try {
          const addOnData = item.data;

          // Check if add-on service exists
          const existing = await AddOnService.findOne({
            name: addOnData.name,
            category: addOnData.category
          });

          if (existing) {
            if (updateExisting) {
              // Update existing add-on service
              Object.assign(existing, addOnData);
              await existing.save();
              imported.push({
                rowIndex: item.rowIndex,
                serviceName: addOnData.name,
                action: 'updated',
                id: existing._id
              });
              console.log(`Updated add-on service: ${addOnData.name} (${addOnData.category})`);
            } else if (skipDuplicates) {
              skipped.push({
                rowIndex: item.rowIndex,
                serviceName: addOnData.name,
                reason: 'duplicate'
              });
              console.log(`Skipped duplicate add-on service: ${addOnData.name} (${addOnData.category})`);
            }
          } else {
            // Create new add-on service
            const newAddOn = new AddOnService(addOnData);
            await newAddOn.save();
            imported.push({
              rowIndex: item.rowIndex,
              serviceName: addOnData.name,
              action: 'created',
              id: newAddOn._id
            });
            console.log(`Created add-on service: ${addOnData.name} (${addOnData.category})`);
          }
        } catch (error) {
          console.error(`Error importing add-on service at row ${item.rowIndex}:`, error);
          failed.push({
            rowIndex: item.rowIndex,
            serviceName: item.data.name,
            error: error.message
          });
        }
      }
    }

    console.log(`Import complete: ${imported.length} imported, ${skipped.length} skipped, ${failed.length} failed`);

    return {
      success: failed.length === 0,
      imported,
      skipped,
      failed,
      stats: {
        totalProcessed: validatedData.length,
        importedCount: imported.length,
        skippedCount: skipped.length,
        failedCount: failed.length
      }
    };
  }
}

module.exports = CSVAddOnImportService;
