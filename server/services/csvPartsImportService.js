const Inventory = require('../models/Inventory');

class CSVPartsImportService {
  /**
   * Validates that all required fields are present in the column mapping
   */
  static validateColumnMapping(columnMapping) {
    console.log('CSVPartsImportService: Validating column mapping');
    // itemName is no longer required as it's auto-generated from manufacturer + model + category
    const requiredFields = ['category', 'manufacturer', 'model'];
    const mappedFields = Object.keys(columnMapping).filter(key => columnMapping[key]);

    const missingFields = [];
    for (const field of requiredFields) {
      if (!mappedFields.includes(field)) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      throw new Error(`Missing required field mappings: ${missingFields.join(', ')}`);
    }

    console.log('CSVPartsImportService: Column mapping validation passed');
    return true;
  }

  /**
   * Validates individual part data
   */
  static validatePartData(part) {
    const errors = [];

    // Item Name validation - only check if auto-generation failed
    if (!part.itemName || part.itemName.trim() === '') {
      errors.push('Item name could not be generated (manufacturer, model, or category missing)');
    }

    // Category validation - accept any non-empty category value
    if (!part.category || part.category.trim() === '') {
      errors.push('Category is required');
    }

    // Manufacturer validation
    if (!part.manufacturer || part.manufacturer.trim() === '') {
      errors.push('Manufacturer is required');
    }

    // Model validation
    if (!part.model || part.model.trim() === '') {
      errors.push('Model is required');
    }

    // Date validation
    if (part.date !== undefined && part.date !== '' && part.date !== null) {
      const date = new Date(part.date);
      if (isNaN(date.getTime())) {
        errors.push(`Invalid date: ${part.date}. Must be a valid date format (YYYY-MM-DD)`);
      }
    }

    // Version data validation
    if (part.versionType) {
      const validVersionTypes = ['original', 'cheap', 'efficient'];
      if (!validVersionTypes.includes(part.versionType.toLowerCase())) {
        errors.push(`Invalid version type: ${part.versionType}. Must be: original, cheap, or efficient`);
      }
    }

    // Quantity validation
    if (part.quantity !== undefined && part.quantity !== '') {
      const qty = parseFloat(part.quantity);
      if (isNaN(qty) || qty < 0) {
        errors.push(`Invalid quantity: ${part.quantity}. Must be a positive number`);
      }
    }

    // Price validation
    if (part.unitCost !== undefined && part.unitCost !== '') {
      const cost = parseFloat(part.unitCost);
      if (isNaN(cost) || cost < 0) {
        errors.push(`Invalid unit cost: ${part.unitCost}. Must be a positive number`);
      }
    }

    if (part.sellingPrice !== undefined && part.sellingPrice !== '') {
      const price = parseFloat(part.sellingPrice);
      if (isNaN(price) || price < 0) {
        errors.push(`Invalid selling price: ${part.sellingPrice}. Must be a positive number`);
      }
    }

    // Min stock level validation
    if (part.minStockLevel !== undefined && part.minStockLevel !== '') {
      const minStock = parseInt(part.minStockLevel);
      if (isNaN(minStock) || minStock < 0) {
        errors.push(`Invalid min stock level: ${part.minStockLevel}. Must be a positive integer`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Checks for duplicate parts in the data and database
   */
  static async checkDuplicates(parts) {
    console.log('CSVPartsImportService: Checking for duplicates');
    const duplicates = [];
    const nameMap = new Map();

    // Check for duplicates within the CSV data (by itemName + model)
    for (const part of parts) {
      const key = `${part.itemName.toLowerCase()}-${part.model.toLowerCase()}`;
      if (nameMap.has(key)) {
        duplicates.push({
          itemName: part.itemName,
          model: part.model,
          type: 'duplicate_in_csv',
          message: `Duplicate part found in CSV: ${part.itemName} (${part.model})`
        });
      } else {
        nameMap.set(key, true);
      }
    }

    // Check for duplicates in the database
    const itemNames = parts.map(p => p.itemName);
    const models = parts.map(p => p.model);

    const existingParts = await Inventory.find({
      isActive: true,
      itemName: { $in: itemNames },
      model: { $in: models }
    }, { itemName: 1, model: 1 });

    const existingMap = new Set(
      existingParts.map(p => `${p.itemName.toLowerCase()}-${p.model.toLowerCase()}`)
    );

    for (const part of parts) {
      const key = `${part.itemName.toLowerCase()}-${part.model.toLowerCase()}`;
      if (existingMap.has(key)) {
        duplicates.push({
          itemName: part.itemName,
          model: part.model,
          type: 'duplicate_in_database',
          message: `Part already exists in database: ${part.itemName} (${part.model})`
        });
      }
    }

    console.log(`CSVPartsImportService: Found ${duplicates.length} duplicates`);
    return duplicates;
  }

  /**
   * Cleans and standardizes part data
   */
  static cleanPartData(rawData, columnMapping) {
    console.log('CSVPartsImportService: Starting data cleaning and standardization');
    console.log(`CSVPartsImportService: Processing ${rawData.length} rows`);

    const cleanedData = [];

    for (const row of rawData) {
      // Extract basic fields
      const category = (row[columnMapping.category] || '').trim();
      const manufacturer = (row[columnMapping.manufacturer] || '').trim();
      const model = (row[columnMapping.model] || '').trim();

      // Skip empty rows
      if (!category && !manufacturer && !model) {
        continue;
      }

      // Auto-generate itemName from Manufacturer + Model + Category
      const itemName = manufacturer && model && category
        ? `${manufacturer} ${model} ${category}`
        : (row[columnMapping.itemName] || '').trim();

      const cleanedPart = {
        itemName,
        itemDescription: columnMapping.itemDescription ? (row[columnMapping.itemDescription] || '').trim() : '',
        category,
        manufacturer,
        model,
        date: null,
        compatibleDevices: [],
        specifications: {},
        versions: []
      };

      // Parse date field
      if (columnMapping.date && row[columnMapping.date]) {
        const dateValue = row[columnMapping.date].trim();
        if (dateValue) {
          const parsedDate = new Date(dateValue);
          if (!isNaN(parsedDate.getTime())) {
            cleanedPart.date = parsedDate;
          }
        }
      }

      // Parse compatible devices (comma-separated)
      if (columnMapping.compatibleDevices && row[columnMapping.compatibleDevices]) {
        cleanedPart.compatibleDevices = row[columnMapping.compatibleDevices]
          .split(',')
          .map(d => d.trim())
          .filter(d => d);
      }

      // Build version data
      const version = {
        versionType: 'original',
        versionId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        quantity: 0,
        minStockLevel: 5,
        reorderLevel: 10,
        unitCost: 0,
        sellingPrice: 0,
        storageLocation: '',
        supplierInfo: {
          name: manufacturer,
          contactPerson: '',
          email: '',
          phone: '',
          address: ''
        },
        leadTime: 7,
        status: 'active',
        notes: ''
      };

      // Version type
      if (columnMapping.versionType && row[columnMapping.versionType]) {
        const versionType = row[columnMapping.versionType].trim().toLowerCase();
        if (['original', 'cheap', 'efficient'].includes(versionType)) {
          version.versionType = versionType;
        }
      }

      // Quantity
      if (columnMapping.quantity && row[columnMapping.quantity]) {
        const qty = parseFloat(row[columnMapping.quantity]);
        if (!isNaN(qty) && qty >= 0) {
          version.quantity = Math.floor(qty);
        }
      }

      // Min stock level
      if (columnMapping.minStockLevel && row[columnMapping.minStockLevel]) {
        const minStock = parseInt(row[columnMapping.minStockLevel]);
        if (!isNaN(minStock) && minStock >= 0) {
          version.minStockLevel = minStock;
        }
      }

      // Unit cost
      if (columnMapping.unitCost && row[columnMapping.unitCost]) {
        const cost = parseFloat(row[columnMapping.unitCost]);
        if (!isNaN(cost) && cost >= 0) {
          version.unitCost = cost;
        }
      }

      // Selling price
      if (columnMapping.sellingPrice && row[columnMapping.sellingPrice]) {
        const price = parseFloat(row[columnMapping.sellingPrice]);
        if (!isNaN(price) && price >= 0) {
          version.sellingPrice = price;
        }
      }

      // Storage location
      if (columnMapping.storageLocation && row[columnMapping.storageLocation]) {
        version.storageLocation = row[columnMapping.storageLocation].trim();
      } else {
        version.storageLocation = 'Default Storage';
      }

      // Notes
      if (columnMapping.notes && row[columnMapping.notes]) {
        version.notes = row[columnMapping.notes].trim();
      }

      // Supplier info
      if (columnMapping.supplierName && row[columnMapping.supplierName]) {
        version.supplierInfo.name = row[columnMapping.supplierName].trim();
      }
      if (columnMapping.supplierEmail && row[columnMapping.supplierEmail]) {
        version.supplierInfo.email = row[columnMapping.supplierEmail].trim();
      }
      if (columnMapping.supplierPhone && row[columnMapping.supplierPhone]) {
        version.supplierInfo.phone = row[columnMapping.supplierPhone].trim();
      }

      cleanedPart.versions.push(version);
      cleanedData.push(cleanedPart);
    }

    console.log(`CSVPartsImportService: Cleaned ${cleanedData.length} parts`);
    return cleanedData;
  }

  /**
   * Process CSV import - validate and prepare data
   */
  static async processCSVImport(csvData, columnMapping, options = {}) {
    console.log('CSVPartsImportService: Starting CSV import processing');
    console.log(`CSVPartsImportService: Options:`, options);

    try {
      // Validate column mapping
      this.validateColumnMapping(columnMapping);

      // Clean the data
      const cleanedParts = this.cleanPartData(csvData, columnMapping);
      console.log(`CSVPartsImportService: Cleaned ${cleanedParts.length} parts from ${csvData.length} rows`);

      // Validate each part
      const validatedParts = [];
      const validationErrors = [];

      for (const part of cleanedParts) {
        const validation = this.validatePartData(part);
        if (validation.isValid) {
          validatedParts.push(part);
        } else {
          validationErrors.push({
            itemName: part.itemName || 'Unknown',
            manufacturer: part.manufacturer || 'Unknown',
            model: part.model || 'Unknown',
            errors: validation.errors
          });
        }
      }

      console.log(`CSVPartsImportService: ${validatedParts.length} valid parts, ${validationErrors.length} with errors`);

      // Check for duplicates
      const duplicates = await this.checkDuplicates(validatedParts);

      // Filter out duplicates if skipDuplicates is enabled
      let finalParts = validatedParts;
      let skippedCount = 0;

      if (options.skipDuplicates && duplicates.length > 0) {
        const duplicateKeys = new Set(
          duplicates.map(d => `${d.itemName.toLowerCase()}-${d.model.toLowerCase()}`)
        );
        finalParts = validatedParts.filter(part => {
          const key = `${part.itemName.toLowerCase()}-${part.model.toLowerCase()}`;
          return !duplicateKeys.has(key);
        });
        skippedCount = validatedParts.length - finalParts.length;
        console.log(`CSVPartsImportService: Skipped ${skippedCount} duplicate parts`);
      }

      const result = {
        success: finalParts.length > 0 && (options.skipDuplicates || duplicates.length === 0),
        data: finalParts,
        summary: {
          totalRows: csvData.length,
          validRows: validatedParts.length,
          duplicateRows: duplicates.length,
          skippedRows: skippedCount,
          errorRows: validationErrors.length
        }
      };

      if (duplicates.length > 0 && !options.skipDuplicates) {
        result.duplicates = duplicates;
      }

      if (validationErrors.length > 0) {
        result.validationErrors = validationErrors;
      }

      console.log('CSVPartsImportService: Processing complete');
      return result;
    } catch (error) {
      console.error('CSVPartsImportService: Error processing CSV import:', error);
      throw error;
    }
  }

  /**
   * Import parts into the database
   */
  static async importParts(parts) {
    console.log(`CSVPartsImportService: Starting import of ${parts.length} parts`);

    const results = {
      successful: [],
      failed: []
    };

    for (const partData of parts) {
      try {
        // Create the inventory item
        const inventory = new Inventory(partData);
        const savedInventory = await inventory.save();

        results.successful.push({
          itemName: partData.itemName,
          manufacturer: partData.manufacturer,
          model: partData.model,
          sku: savedInventory.sku
        });

        console.log(`CSVPartsImportService: Successfully imported part: ${partData.itemName}`);
      } catch (error) {
        console.error(`CSVPartsImportService: Failed to import part: ${partData.itemName}`, error);
        results.failed.push({
          itemName: partData.itemName,
          manufacturer: partData.manufacturer,
          model: partData.model,
          error: error.message
        });
      }
    }

    console.log(`CSVPartsImportService: Import complete - ${results.successful.length} successful, ${results.failed.length} failed`);

    return {
      imported: results.successful.length,
      failed: results.failed.length,
      results
    };
  }
}

module.exports = CSVPartsImportService;
