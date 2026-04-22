
const { DeviceModel, DeviceBrand } = require('../models/Device');

class CSVDeviceImportService {
  static async validateDeviceCSVImport(csvData, columnMapping, options = {}) {
    // Map CSV columns to device model fields
    const mapped = csvData.map(row => {
      const mappedRow = {};
      for (const [field, col] of Object.entries(columnMapping)) {
        mappedRow[field] = row[col];
      }
      // Always set deviceType from injected value if present
      if (row.deviceType) {
        mappedRow.deviceType = row.deviceType;
      }
      return mappedRow;
    });
    // Basic validation: name, brandId, deviceType required
    const validationErrors = [];
    const validatedRecords = [];
    const duplicates = [];
    const seen = new Set();
    mapped.forEach((row, idx) => {
      const errors = [];
      if (!row.name) errors.push('Name fehlt');
      if (!row.brandId) errors.push('Brand fehlt');
      if (!row.deviceType) errors.push('Gerätetyp fehlt');
      // Duplicate check (name+brandId+deviceType)
      const key = `${row.name}|${row.brandId}|${row.deviceType}`;
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
        const newModel = new DeviceModel({
          name: device.name,
          brandId: brandId,
          deviceType: device.deviceType,
          image: device.image,
          commonProblems: device.commonProblems ? device.commonProblems.split(/[,;\n]/).map(s => s.trim()).filter(Boolean) : [],
          specifications: device.specifications,
          other: {
            releaseDate: device.releaseDate,
            price: device.price,
            colors: device.colors ? device.colors.split(/[,;\n]/).map(s => s.trim()).filter(Boolean) : []
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
