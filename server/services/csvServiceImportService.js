
const Service = require('../models/Service');
const DeviceModel = require('../models/Device').DeviceModel;

// Mapping von CSV-Headern (deutsch/englisch) auf Service-Modellfelder
const CSV_COLUMN_MAP = {
  'service_name': 'name',
  'name': 'name',
  'bezeichnung': 'name',
  'category': 'category',
  'kategorie': 'category',
  'preis': 'price',
  'price': 'price',
  'beschreibung': 'description',
  'description': 'description',
  'dauer': 'estimatedTime',
  'estimated_time': 'estimatedTime',
  'schwierigkeit': 'difficulty',
  'difficulty': 'difficulty',
  'garantie': 'warrantyPeriod',
  'warranty_period': 'warrantyPeriod',
  'gerätetypen': 'deviceTypes',
  'devicetypes': 'deviceTypes',
  'hersteller': 'manufacturer',
  'manufacturer': 'manufacturer',
  'hersteller_precise': 'manufacturerPrecise',
  'gerätemodell_precise': 'modelPrecise',
  'modell': 'model',
  'model': 'model',
  'is_active': 'isActive',
  'aktiv': 'isActive',
  'price_net': 'priceNet',
  'price_gross': 'priceGross'
};

// Hilfsfunktion: Header normalisieren (trim, lowercase, Leerzeichen zu _)
function normalizeHeader(header) {
  return String(header).trim().toLowerCase().replace(/\s+/g, '_');
}

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
    const requiredFields = ['name', 'price'];

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
  static async validateServiceData(serviceData, rowIndex, columnMapping = {}) {
    const errors = [];

    // Validate name (immer required)
    if (!serviceData.name || serviceData.name.trim() === '') {
      errors.push(`Row ${rowIndex + 1}: Service name is required`);
    } else if (serviceData.name.length < 3) {
      errors.push(`Row ${rowIndex + 1}: Service name must be at least 3 characters`);
    }

    // Validate price (immer required)
    if (serviceData.price === undefined || serviceData.price === null) {
      errors.push(`Row ${rowIndex + 1}: Price is required`);
    } else {
      const price = parseFloat(serviceData.price);
      if (isNaN(price) || price < 0) {
        errors.push(`Row ${rowIndex + 1}: Price must be a positive number`);
      }
    }

    // Optionale Felder nur validieren, wenn sie gemappt wurden
    // category
    if (columnMapping.category) {
      const validCategories = ['Screen Repair', 'Battery Replacement', 'Water Damage', 'Software', 'Hardware', 'Other'];
      if (serviceData.category && !validCategories.includes(serviceData.category)) {
        errors.push(`Row ${rowIndex + 1}: Invalid category "${serviceData.category}". Valid values: ${validCategories.join(', ')}`);
      }
    }

    // estimatedTime
    if (columnMapping.estimatedTime) {
      if (serviceData.estimatedTime !== undefined && serviceData.estimatedTime !== null && serviceData.estimatedTime !== '') {
        const time = parseInt(serviceData.estimatedTime);
        if (isNaN(time) || time < 0) {
          errors.push(`Row ${rowIndex + 1}: Estimated time must be a positive number (in minutes)`);
        }
      }
    }

    // difficulty
    if (columnMapping.difficulty) {
      if (serviceData.difficulty) {
        const validDifficulties = ['Easy', 'Medium', 'Hard'];
        if (!validDifficulties.includes(serviceData.difficulty)) {
          errors.push(`Row ${rowIndex + 1}: Invalid difficulty "${serviceData.difficulty}". Valid values: ${validDifficulties.join(', ')}`);
        }
      }
    }

    // warrantyPeriod
    if (columnMapping.warrantyPeriod) {
      if (serviceData.warrantyPeriod !== undefined && serviceData.warrantyPeriod !== null && serviceData.warrantyPeriod !== '') {
        const warranty = parseInt(serviceData.warrantyPeriod);
        if (isNaN(warranty) || warranty < 0) {
          errors.push(`Row ${rowIndex + 1}: Warranty period must be a positive number (in days)`);
        }
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




  static cleanServiceData(rawData, columnMapping, csvHeaderMap = null) {
    // Wenn csvHeaderMap übergeben wird, werden die Felder anhand der normalisierten Header gemappt
    const cleanedData = {};
    if (csvHeaderMap) {
      // Mapping nach deutschem/englischem CSV-Header (Objektzugriff, nicht Array!)
      for (const [csvColNorm, idx] of Object.entries(csvHeaderMap)) {
        const modelField = CSV_COLUMN_MAP[csvColNorm];
        if (modelField) {
          // Hole Wert aus rawData per Original-Header (nicht Index)
          // Finde das Original-Headerfeld, das zu diesem Normalisierten passt
          const originalHeader = Object.keys(rawData).find(
            key => normalizeHeader(key) === csvColNorm
          );
          let value = originalHeader ? rawData[originalHeader] : undefined;
          if (typeof value === 'string') value = value.trim();
          if (value === '') value = null;
          cleanedData[modelField] = value;
        }
      }
      // Preislogik: Netto/Brutto
      cleanedData.price = parseFloat(cleanedData.priceNet || cleanedData.priceGross || cleanedData.price) || 0;
      // category = Service_precise
      if (cleanedData.category) cleanedData.category = cleanedData.category.trim();
      // Standardwerte
      cleanedData.isActive = true;
      cleanedData.deviceTypes = [];
      cleanedData.estimatedTime = 60;
      cleanedData.warrantyPeriod = 90;
      return cleanedData;
    }
    // Fallback: altes Mapping (optional, falls benötigt)
    return cleanedData;
  }

  /**
   * Process and validate CSV data
   * @param {Array<Object>} csvData - Parsed CSV data
   * @param {Object} columnMapping - Column mapping
   * @returns {Object} Processing result with validated data and errors
   */
  static async processCSVImport(csvRows, columnMapping = null) {
    // csvRows: Array of Objekten (von csv-parser)
    if (!csvRows.length) return { success: false, errors: ['CSV ist leer'], warnings: [] };
    // Header normalisieren und Map bauen
    const header = Object.keys(csvRows[0]).map(normalizeHeader);
    const csvHeaderMap = {};
    Object.keys(csvRows[0]).forEach((col, i) => {
      csvHeaderMap[normalizeHeader(col)] = i;
    });

    const validatedData = [];
    const errors = [];
    const warnings = [];

    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];
      // Leere Zeilen überspringen
      if (!row || Object.values(row).every(val => !val || val === '')) {
        warnings.push(`Zeile ${i+1}: Leerzeile übersprungen`);
        continue;
      }
      // Daten bereinigen
      const cleanedData = this.cleanServiceData(row, columnMapping, csvHeaderMap);
      // Validierung
      const validation = await this.validateServiceData(cleanedData, i, columnMapping || {});
      if (validation.errors.length > 0) {
        errors.push(...validation.errors);
      } else {
        validatedData.push({ rowIndex: i + 1, data: cleanedData });
      }
    }

    // Doppelte prüfen
    const duplicateCheck = await this.checkDuplicates(validatedData.map(v => v.data));
    if (duplicateCheck.hasDuplicates) {
      duplicateCheck.duplicates.forEach(dup => {
        warnings.push(`Row ${dup.rowIndex}: Service "${dup.serviceName}" (${dup.category}) already exists in database`);
      });
    }

    // Fehlerdetails extrahieren (erste 5 Fehler mit Zeilennummer und Feld)
    let errorDetails = [];
    if (errors.length > 0) {
      errorDetails = errors.slice(0, 5).map(msg => {
        // Versuche Zeilennummer und Feld aus der Fehlermeldung zu extrahieren
        const match = msg.match(/Row (\d+): ([^:]+):? (.*)/);
        if (match) {
          return {
            row: parseInt(match[1], 10),
            field: match[2],
            message: match[3] || msg
          };
        }
        return { row: null, field: null, message: msg };
      });
    }

    return {
      success: errors.length === 0,
      validatedData,
      errors,
      errorDetails,
      warnings,
      duplicateCheck,
      stats: {
        totalRows: csvRows.length,
        validRows: validatedData.length,
        errorRows: errors.length,
        duplicateRows: duplicateCheck.duplicateCount
      }
    };
  }
}

module.exports = CSVServiceImportService;
