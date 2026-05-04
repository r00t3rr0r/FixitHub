
const { DeviceModel, DeviceBrand } = require('../models/Device');

const parseListValue = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const pickField = (row, keys = []) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) {
      return row[key];
    }
  }
  return undefined;
};

class CSVDeviceImportService {
  static async validateDeviceCSVImport(csvData, columnMapping, options = {}) {
    // Map CSV columns to device model fields
    const mapped = csvData.map(row => {
      const mappedRow = {};
      for (const [field, col] of Object.entries(columnMapping)) {
        mappedRow[field] = row[col];
      }
      return mappedRow;
    });
    // Basic validation: name, manufacturer, deviceType required (brandId optional, derived from manufacturer if missing)
    const validationErrors = [];
    const validatedRecords = [];
    const duplicates = [];
    const seen = new Set();
    mapped.forEach((row, idx) => {
      const errors = [];
      if (!row.name) errors.push('Name fehlt');
      if (!row.manufacturer) errors.push('Hersteller fehlt');
      if (!row.deviceType) errors.push('Gerätetyp fehlt');
      // Duplicate check (name+manufacturer+deviceType)
      const key = `${row.name}|${row.manufacturer}|${row.deviceType}`;
      if (seen.has(key)) {
        duplicates.push({ name: row.name, type: 'duplicate-in-file', message: 'Doppelter Eintrag in Datei' });
        return;
      }
      seen.add(key);
      if (errors.length > 0) {
        validationErrors.push({ index: idx, name: row.name, errors, data: row });
      } else {
        validatedRecords.push(row);
      }
    });
    // Optionally skip duplicates
    let filteredRecords = validatedRecords;
    if (options.skipDuplicates) {
      // Check DB for existing models
      // (async check not possible here, so only in Import)
    }
    return {
      success: validationErrors.length === 0,
      data: mapped,
      summary: {
        totalRows: mapped.length,
        validRows: validatedRecords.length,
        duplicateRows: duplicates.length,
        skippedRows: 0,
        invalidRows: validationErrors.length
      },
      duplicates,
      validationErrors,
      validatedRecords
    };
  }

  static async importDevices(devices) {
    const results = { successful: [], failed: [] };
    let imported = 0;
    for (const device of devices) {
      try {
        let brandId = device.brandId;
        // Falls keine brandId vorhanden ist, aus manufacturer ableiten
        if (!brandId && device.manufacturer) {
          brandId = device.manufacturer;
        }
        if (!brandId) {
          results.failed.push({ name: device.name, error: 'Hersteller/Brand fehlt' });
          continue;
        }
        // Wenn brandId kein gültiger ObjectId-String ist, versuche Brand zu finden oder anzulegen
        if (typeof brandId === 'string' && !/^[a-f\d]{24}$/i.test(brandId)) {
          let brandDoc = await DeviceBrand.findOne({ name: brandId.trim() });
          if (!brandDoc) {
            brandDoc = new DeviceBrand({ name: brandId.trim() });
            await brandDoc.save();
          }
          brandId = brandDoc._id;
        }
        // Check for existing model (name+brandId+deviceType)
        const exists = await DeviceModel.findOne({
          name: device.name,
          brandId: brandId,
          deviceType: device.deviceType
        });
        if (exists) {
          results.failed.push({ name: device.name, error: 'Bereits vorhanden' });
          continue;
        }
        // Create new device model
        const modelNumbers = parseListValue(pickField(device, ['modelNumbers', 'modellnummern']));
        const synonyms = parseListValue(pickField(device, ['synonyms', 'synonyme']));

        const newModel = new DeviceModel({
          name: device.name,
          brandId: brandId,
          deviceType: device.deviceType,
          image: device.image,
          series: pickField(device, ['series', 'serie']) || undefined,
          year: pickField(device, ['year', 'jahr']) || undefined,
          slug: pickField(device, ['slug']) || undefined,
          modelNumbers,
          synonyms,
          commonProblems: parseListValue(device.commonProblems),
          specifications: device.specifications,
          other: {
            releaseDate: pickField(device, ['releaseDate', 'other.releaseDate']),
            price: pickField(device, ['price', 'other.price']),
            colors: parseListValue(pickField(device, ['colors', 'other.colors']))
          }
        });
        await newModel.save();
        imported++;
        results.successful.push({ name: device.name, message: 'Device imported' });
      } catch (error) {
        results.failed.push({ name: device.name, error: error.message });
      }
    }
    return {
      success: results.failed.length === 0,
      imported,
      failed: results.failed.length,
      results
    };
  }
}

module.exports = CSVDeviceImportService;
