const Service = require('../models/Service');
const DeviceModel = require('../models/Device').DeviceModel;

/**
 * CSV Service Import Service
 * Handles validation, column mapping, data preparation, and import of services from CSV files
 */
class CSVServiceImportService {
  /**
   * Validate column mapping and CSV data structure
   * @param {Array<Object>} csvData - Parsed CSV data
   * @param {Object} columnMapping - Mapping of CSV columns to service fields
   * @returns {Object} Validation result with errors and warnings
   */
  static async validateColumnMapping(csvData, columnMapping) {
    console.log('Validating column mapping for CSV service import');

    const errors = [];
    const warnings = [];

    // Required fields for Service model
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
    const optionalFields = ['description', 'deviceTypes', 'estimatedTime', 'difficulty', 'warrantyPeriod'];
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
   * Validate individual service data
   * @param {Object} serviceData - Service data object
   * @param {number} rowIndex - Row index for error reporting
   * @returns {Object} Validation result with errors
   */
  static async validateServiceData(serviceData, rowIndex) {
    const errors = [];

    // Validate name
    if (!serviceData.name || serviceData.name.trim() === '') {
      errors.push(`Row ${rowIndex + 1}: Service name is required`);
    } else if (serviceData.name.length < 3) {
      errors.push(`Row ${rowIndex + 1}: Service name must be at least 3 characters`);
    }

    // Validate category
    const validCategories = ['Screen Repair', 'Battery Replacement', 'Water Damage', 'Software', 'Hardware', 'Other'];
    if (!serviceData.category || serviceData.category.trim() === '') {
      errors.push(`Row ${rowIndex + 1}: Category is required`);
    } else if (!validCategories.includes(serviceData.category)) {
      errors.push(`Row ${rowIndex + 1}: Invalid category "${serviceData.category}". Valid values: ${validCategories.join(', ')}`);
    }

    // Validate price
    if (serviceData.price === undefined || serviceData.price === null) {
      errors.push(`Row ${rowIndex + 1}: Price is required`);
    } else {
      const price = parseFloat(serviceData.price);
      if (isNaN(price) || price < 0) {
        errors.push(`Row ${rowIndex + 1}: Price must be a positive number`);
      }
    }

    // Validate estimatedTime if provided
    if (serviceData.estimatedTime !== undefined && serviceData.estimatedTime !== null && serviceData.estimatedTime !== '') {
      const time = parseInt(serviceData.estimatedTime);
      if (isNaN(time) || time < 0) {
        errors.push(`Row ${rowIndex + 1}: Estimated time must be a positive number (in minutes)`);
      }
    }

    // Validate difficulty if provided
    if (serviceData.difficulty) {
      const validDifficulties = ['Easy', 'Medium', 'Hard'];
      if (!validDifficulties.includes(serviceData.difficulty)) {
        errors.push(`Row ${rowIndex + 1}: Invalid difficulty "${serviceData.difficulty}". Valid values: ${validDifficulties.join(', ')}`);
      }
    }

    // Validate warrantyPeriod if provided
    if (serviceData.warrantyPeriod !== undefined && serviceData.warrantyPeriod !== null && serviceData.warrantyPeriod !== '') {
      const warranty = parseInt(serviceData.warrantyPeriod);
      if (isNaN(warranty) || warranty < 0) {
        errors.push(`Row ${rowIndex + 1}: Warranty period must be a positive number (in days)`);
      }
    }

    return { errors };
  }

  /**
   * Check for duplicate services
   * @param {Array<Object>} servicesData - Array of service data objects
   * @returns {Object} Duplicate detection result
   */
  static async checkDuplicates(servicesData) {
    console.log(`Checking for duplicates in ${servicesData.length} services`);

    const duplicates = [];
    const existingServices = await Service.find({}, 'name category').lean();

    // Create a map of existing services for quick lookup
    const existingMap = new Map();
    existingServices.forEach(service => {
      const key = `${service.name.toLowerCase()}_${service.category}`;
      existingMap.set(key, service);
    });

    // Check each service against existing ones
    servicesData.forEach((serviceData, index) => {
      const key = `${serviceData.name.toLowerCase()}_${serviceData.category}`;
      if (existingMap.has(key)) {
        duplicates.push({
          rowIndex: index + 1,
          serviceName: serviceData.name,
          category: serviceData.category,
          existingId: existingMap.get(key)._id
        });
      }
    });

    console.log(`Found ${duplicates.length} duplicate services`);

    return {
      hasDuplicates: duplicates.length > 0,
      duplicates,
      duplicateCount: duplicates.length
    };
  }

  /**
   * Clean and prepare service data for import
   * @param {Object} rawData - Raw service data from CSV
   * @param {Object} columnMapping - Column mapping
   * @returns {Object} Cleaned service data
   */
  static cleanServiceData(rawData, columnMapping) {
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

          case 'estimatedTime':
            // Convert to minutes
            if (value !== null) {
              // Handle formats like "2 hours", "30 minutes", "1.5 hours"
              const str = String(value).toLowerCase();
              if (str.includes('hour')) {
                const hours = parseFloat(str.replace(/[^0-9.]/g, ''));
                value = hours * 60;
              } else {
                value = parseInt(String(value).replace(/[^0-9]/g, ''));
              }
            }
            break;

          case 'warrantyPeriod':
            // Convert to days
            if (value !== null) {
              value = parseInt(String(value).replace(/[^0-9]/g, ''));
            }
            break;

          case 'deviceTypes':
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

    // Set defaults for missing optional fields
    if (!cleanedData.isActive) {
      cleanedData.isActive = true;
    }

    if (!cleanedData.difficulty) {
      cleanedData.difficulty = 'Medium';
    }

    if (!cleanedData.deviceTypes) {
      cleanedData.deviceTypes = [];
    }

    if (!cleanedData.estimatedTime) {
      cleanedData.estimatedTime = 60; // Default 1 hour
    }

    if (!cleanedData.warrantyPeriod) {
      cleanedData.warrantyPeriod = 90; // Default 90 days
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
      const cleanedData = this.cleanServiceData(rawData, columnMapping);

      // Validate data
      const validation = await this.validateServiceData(cleanedData, i);
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
        warnings.push(`Row ${dup.rowIndex}: Service "${dup.serviceName}" (${dup.category}) already exists in database`);
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
   * Import services from validated data with batch processing
   * @param {Array<Object>} validatedData - Validated service data
   * @param {Object} options - Import options
   * @returns {Object} Import result
   */
  static async importServices(validatedData, options = {}) {
    console.log(`Starting import of ${validatedData.length} services`);

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
          const serviceData = item.data;

          // Check if service exists
          const existing = await Service.findOne({
            name: serviceData.name,
            category: serviceData.category
          });

          if (existing) {
            if (updateExisting) {
              // Update existing service
              Object.assign(existing, serviceData);
              await existing.save();
              imported.push({
                rowIndex: item.rowIndex,
                serviceName: serviceData.name,
                action: 'updated',
                id: existing._id
              });
              console.log(`Updated service: ${serviceData.name} (${serviceData.category})`);
            } else if (skipDuplicates) {
              skipped.push({
                rowIndex: item.rowIndex,
                serviceName: serviceData.name,
                reason: 'duplicate'
              });
              console.log(`Skipped duplicate service: ${serviceData.name} (${serviceData.category})`);
            }
          } else {
            // Create new service
            const newService = new Service(serviceData);
            await newService.save();
            imported.push({
              rowIndex: item.rowIndex,
              serviceName: serviceData.name,
              action: 'created',
              id: newService._id
            });
            console.log(`Created service: ${serviceData.name} (${serviceData.category})`);
          }
        } catch (error) {
          console.error(`Error importing service at row ${item.rowIndex}:`, error);
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

module.exports = CSVServiceImportService;
