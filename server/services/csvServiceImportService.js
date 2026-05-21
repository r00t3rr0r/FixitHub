const Service = require('../models/Service');
const { DeviceModel, DeviceBrand, DeviceType } = require('../models/Device');

/**
 * Mapping from normalized CSV header (lowercase, spaces -> _) to Service model field.
 * Supports the German "repair_services.csv" export and the legacy English sample.
 */
const CSV_COLUMN_MAP = {
  // Name
  'service_name': 'name',
  'name': 'name',
  'bezeichnung': 'name',
  'artikelname': 'name',
  // Service / category details
  'service': 'service',
  'service_precise': 'service',
  // Category / Service type
  'category': 'category',
  'kategorie': 'category',
  // Device type
  'devicetype': 'deviceType',
  'device_type': 'deviceType',
  'gerätetyp': 'deviceType',
  'geraetetyp': 'deviceType',
  // Price
  'preis': 'price',
  'price': 'price',
  'std._vk_brutto_kategorie': 'priceGrossCategory',
  'std_vk_brutto_kategorie': 'priceGrossCategory',
  'std._vk_brutto_jtl': 'priceGrossJtl',
  'std_vk_brutto_jtl': 'priceGrossJtl',
  'std._vk_brutto': 'priceGross',
  'std_vk_brutto': 'priceGross',
  'price_gross': 'priceGross',
  'std._vk_netto_kategorie': 'priceNetCategory',
  'std_vk_netto_kategorie': 'priceNetCategory',
  'std._vk_netto_jtl': 'priceNetJtl',
  'std_vk_netto_jtl': 'priceNetJtl',
  'std._vk_netto': 'priceNet',
  'std_vk_netto': 'priceNet',
  'price_net': 'priceNet',
  // Purchase / cost
  'ek_netto': 'purchasePrice',
  'ek_netto_(für_gld)': 'purchasePrice',
  'ek_netto_(fur_gld)': 'purchasePrice',
  'ek_netto_fur_gld': 'purchasePrice',
  'purchase_price': 'purchasePrice',
  'uvp': 'msrp',
  'steuerklasse': 'taxClass',
  '_quelle': 'source',
  // Description
  'kurzbeschreibung': 'shortDescription',
  'beschreibung': 'description',
  'description': 'description',
  'druck_kurzbeschreibung': 'printShortDescription',
  'druck_beschreibung': 'printDescription',
  'anmerkung': 'note',
  // Search / SEO
  'suchbegriffe': 'searchKeywords',
  'seo_name_(suchmaschinenname)': 'seoName',
  'seo_name': 'seoName',
  'seo_titel-tag': 'seoTitleTag',
  'seo_titel_tag': 'seoTitleTag',
  'seo_meta-keywords': 'seoMetaKeywords',
  'seo_meta_keywords': 'seoMetaKeywords',
  'seo_meta-description': 'seoMetaDescription',
  'seo_meta_description': 'seoMetaDescription',
  'artikelnummer': 'articleNumber',
  'artikel_nr': 'articleNumber',
  'artnr': 'articleNumber',
  'article_number': 'articleNumber',
  'sku': 'articleNumber',
  'keywords': 'searchKeywords',
  'seo_namen_(suchmaschienename)': 'seoName',
  'seo_namen_(suchmaschienenname)': 'seoName',
  'seo_name_(suchmaschienenname)': 'seoName',
  'seo_name_(search_engine_name)': 'seoName',
  'seo_namen': 'seoName',
  'seo_titel': 'seoTitleTag',
  'meta_keywords': 'seoMetaKeywords',
  'meta_description': 'seoMetaDescription',
  'druckkurzbeschreibung': 'printShortDescription',
  'druckbeschreibung': 'printDescription',
  'amerkung': 'note',
  // Time
  'dauer': 'estimatedTime',
  'estimated_time': 'estimatedTime',
  'estimatedtime': 'estimatedTime',
  // Difficulty / warranty (legacy English sample)
  'schwierigkeit': 'difficulty',
  'difficulty': 'difficulty',
  'garantie': 'warrantyPeriod',
  'warranty_period': 'warrantyPeriod',
  'warrantyperiod': 'warrantyPeriod',
  // Device types
  'gerätetypen': 'deviceTypes',
  'geraetetypen': 'deviceTypes',
  'devicetypes': 'deviceTypes',
  'device_types': 'deviceTypes',
  // Manufacturer / model
  'hersteller': 'manufacturer',
  'manufacturer': 'manufacturer',
  'hersteller_precise': 'manufacturerPrecise',
  'manufacturer_precise': 'manufacturerPrecise',
  'gerätemodell': 'model',
  'geraetemodell': 'model',
  'modell': 'model',
  'model': 'model',
  'gerätemodell_precise': 'modelPrecise',
  'geraetemodell_precise': 'modelPrecise',
  'model_precise': 'modelPrecise',
  // Color
  'farbe': 'color',
  'color': 'color',
  // Status
  'is_active': 'isActive',
  'isactive': 'isActive',
  'aktiv': 'isActive',
};

function normalizeHeader(header) {
  return String(header || '').trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Parse a numeric value that may be in German format ("1.234,56") or English ("1,234.56" / "1234.56").
 * Returns NaN if not parseable.
 */
function parseLocalizedNumber(value) {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') return value;
  let str = String(value).trim();
  if (!str) return NaN;
  // Strip currency / spaces
  str = str.replace(/[€$£\s]/g, '');
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  if (hasComma && hasDot) {
    // Assume German: "1.234,56" -> "1234.56"
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // English: "1,234.56" -> "1234.56"
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    // German decimal "99,90"
    str = str.replace(/\./g, '').replace(',', '.');
  }
  const n = parseFloat(str);
  return isNaN(n) ? NaN : n;
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined || value === '') return true;
  const s = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'ja', 'aktiv', 'active'].includes(s);
}

/**
 * Heuristic device-type fallback when no DeviceModel match is found.
 */
function inferDeviceTypeFromModel(modelName, manufacturerName) {
  const m = `${manufacturerName || ''} ${modelName || ''}`.toLowerCase();
  if (!m.trim()) return '';
  if (m.includes('ipad') || m.includes('tab ') || m.includes('tablet')) return 'Tablet';
  if (m.includes('macbook') || m.includes('laptop') || m.includes('notebook') || m.includes('book')) return 'Laptop';
  if (m.includes('watch')) return 'Smartwatch';
  if (m.includes('airpod') || m.includes('buds') || m.includes('headphone')) return 'Kopfhörer';
  if (m.includes('iphone') || m.includes('galaxy') || m.includes('pixel') || m.includes('xperia') || m.includes('redmi') || m.includes('phone')) return 'Smartphone';
  return '';
}

/**
 * In-memory device caches built once per import call.
 */
class DeviceLookup {
  constructor() {
    this.brandsByName = new Map();
    this.modelsByKey = new Map(); // key: `${brandName}|${modelName}` lowercased
    this.modelsByName = new Map(); // key: modelName lowercased -> array of {brand, deviceType}
    this.deviceTypesByName = new Map(); // name lower -> _id (display name)
    this.ready = false;
  }

  async load() {
    if (this.ready) return;
    const [brands, models, types] = await Promise.all([
      DeviceBrand.find({}, 'name').lean(),
      DeviceModel.find({}, 'name brandId deviceType').lean(),
      DeviceType.find({}, '_id name').lean(),
    ]);
    brands.forEach(b => this.brandsByName.set(String(b.name).toLowerCase(), b));
    const brandIdToName = new Map(brands.map(b => [String(b._id), b.name]));
    models.forEach(m => {
      const brandName = brandIdToName.get(String(m.brandId)) || '';
      const key = `${brandName.toLowerCase()}|${String(m.name).toLowerCase()}`;
      this.modelsByKey.set(key, { ...m, brandName });
      const arr = this.modelsByName.get(String(m.name).toLowerCase()) || [];
      arr.push({ ...m, brandName });
      this.modelsByName.set(String(m.name).toLowerCase(), arr);
    });
    types.forEach(t => this.deviceTypesByName.set(String(t._id).toLowerCase(), t.name));
    this.ready = true;
  }

  /**
   * Resolve a human-readable deviceType.name for a given (brand, model) pair.
   * Returns '' if unknown.
   */
  resolveDeviceTypeName(manufacturer, modelName) {
    if (!modelName) return '';
    const brandLower = String(manufacturer || '').toLowerCase();
    const key = `${brandLower}|${String(modelName).toLowerCase()}`;
    let m = this.modelsByKey.get(key);
    if (!m) {
      const list = this.modelsByName.get(String(modelName).toLowerCase()) || [];
      m = list[0];
    }
    if (!m || !m.deviceType) return '';
    return this.deviceTypesByName.get(String(m.deviceType).toLowerCase()) || m.deviceType;
  }
}

class CSVServiceImportService {
  /**
   * Validate column mapping (used when admin manually maps columns).
   */
  static async validateColumnMapping(csvData, columnMapping) {
    const errors = [];
    const warnings = [];
    const requiredFields = ['name', 'price'];
    for (const field of requiredFields) {
      const mapped = columnMapping[field];
      const hasPriceAlt =
        field === 'price' &&
        (columnMapping.priceGross || columnMapping.priceNet);
      if ((!mapped || mapped === '') && !hasPriceAlt) {
        errors.push(`Required field "${field}" is not mapped`);
      }
    }
    if (csvData.length > 0) {
      const csvColumns = Object.keys(csvData[0]);
      for (const [field, column] of Object.entries(columnMapping)) {
        if (column && !csvColumns.includes(column)) {
          errors.push(`Mapped column "${column}" for field "${field}" does not exist in CSV`);
        }
      }
    }
    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate a single cleaned service row.
   */
  static validateServiceData(serviceData, rowIndex) {
    const errors = [];
    if (!serviceData.name || String(serviceData.name).trim() === '') {
      errors.push(`Row ${rowIndex + 1}: Service name is required`);
    } else if (String(serviceData.name).trim().length < 2) {
      errors.push(`Row ${rowIndex + 1}: Service name must be at least 2 characters`);
    }
    if (serviceData.price === undefined || serviceData.price === null || isNaN(serviceData.price)) {
      errors.push(`Row ${rowIndex + 1}: Price is required and must be a number`);
    } else if (Number(serviceData.price) < 0) {
      errors.push(`Row ${rowIndex + 1}: Price must be >= 0`);
    }
    if (!serviceData.category || String(serviceData.category).trim() === '') {
      errors.push(`Row ${rowIndex + 1}: Category/Service type is required`);
    }
    return { errors };
  }

  /**
   * Find duplicate services in the database based on (name + manufacturerPrecise + modelPrecise + color).
   * This matches the granularity at which our German CSV defines a service.
   */
  static async checkDuplicates(servicesData) {
    if (!servicesData.length) {
      return { hasDuplicates: false, duplicates: [], duplicateCount: 0 };
    }
    const existing = await Service.find(
      {},
      'name category manufacturerPrecise modelPrecise color'
    ).lean();
    const keyOf = (s) =>
      [
        String(s.name || '').toLowerCase().trim(),
        String(s.category || '').toLowerCase().trim(),
        String(s.manufacturerPrecise || '').toLowerCase().trim(),
        String(s.modelPrecise || '').toLowerCase().trim(),
        String(s.color || '').toLowerCase().trim(),
      ].join('|');
    const existingMap = new Map();
    existing.forEach(s => existingMap.set(keyOf(s), s));
    const duplicates = [];
    servicesData.forEach((s, i) => {
      const hit = existingMap.get(keyOf(s));
      if (hit) {
        duplicates.push({
          rowIndex: i + 1,
          serviceName: s.name,
          category: s.category,
          existingId: hit._id,
        });
      }
    });
    return {
      hasDuplicates: duplicates.length > 0,
      duplicates,
      duplicateCount: duplicates.length,
    };
  }

  /**
   * Build a cleaned service object from one CSV row.
   * Mapping precedence: explicit columnMapping (UI) > automatic CSV_COLUMN_MAP by header name.
   */
  static cleanServiceData(rawRow, columnMapping, deviceLookup) {
    const cleaned = {};

    // Helper: read raw value for a logical field, applying explicit mapping if present.
    const readField = (logicalField) => {
      if (columnMapping && columnMapping[logicalField]) {
        const col = columnMapping[logicalField];
        if (Object.prototype.hasOwnProperty.call(rawRow, col)) {
          return rawRow[col];
        }
      }
      // Fall back to automatic mapping by header normalization
      for (const [origHeader, val] of Object.entries(rawRow)) {
        const target = CSV_COLUMN_MAP[normalizeHeader(origHeader)];
        if (target === logicalField) return val;
      }
      return undefined;
    };

    const trim = (v) => (typeof v === 'string' ? v.trim() : v);

    cleaned.name = trim(readField('name')) || '';
    cleaned.articleNumber = trim(readField('articleNumber')) || '';
    cleaned.service = trim(readField('service')) || '';
    cleaned.category = trim(readField('category')) || '';
    cleaned.deviceType = trim(readField('deviceType')) || '';
    cleaned.shortDescription = trim(readField('shortDescription')) || '';
    cleaned.description = trim(readField('description')) || '';
    cleaned.printShortDescription = trim(readField('printShortDescription')) || '';
    cleaned.printDescription = trim(readField('printDescription')) || '';
    cleaned.note = trim(readField('note')) || '';
    cleaned.searchKeywords = trim(readField('searchKeywords')) || '';
    cleaned.seoName = trim(readField('seoName')) || '';
    cleaned.seoTitleTag = trim(readField('seoTitleTag')) || '';
    cleaned.seoMetaKeywords = trim(readField('seoMetaKeywords')) || '';
    cleaned.seoMetaDescription = trim(readField('seoMetaDescription')) || '';
    cleaned.estimatedTime = trim(readField('estimatedTime')) || '';
    cleaned.manufacturer = trim(readField('manufacturer')) || '';
    cleaned.manufacturerPrecise = trim(readField('manufacturerPrecise')) || '';
    cleaned.model = trim(readField('model')) || '';
    cleaned.modelPrecise = trim(readField('modelPrecise')) || '';
    cleaned.color = trim(readField('color')) || '';
    cleaned.taxClass = trim(readField('taxClass')) || '';
    cleaned.source = trim(readField('source')) || '';

    // Prices: support gross / net / generic price
    const grossCategory = parseLocalizedNumber(readField('priceGrossCategory'));
    const grossJtl = parseLocalizedNumber(readField('priceGrossJtl'));
    const gross = parseLocalizedNumber(readField('priceGross'));
    const netCategory = parseLocalizedNumber(readField('priceNetCategory'));
    const netJtl = parseLocalizedNumber(readField('priceNetJtl'));
    const net = parseLocalizedNumber(readField('priceNet'));
    const generic = parseLocalizedNumber(readField('price'));
    const purchase = parseLocalizedNumber(readField('purchasePrice'));
    const msrp = parseLocalizedNumber(readField('msrp'));

    let price = !isNaN(gross) ? gross : (!isNaN(generic) ? generic : (!isNaN(net) ? net : NaN));
    if (price === 0 && !isNaN(net) && net > 0) price = net; // gross may be 0 in source
    cleaned.price = isNaN(price) ? NaN : price;
    cleaned.priceGrossCategory = isNaN(grossCategory) ? 0 : grossCategory;
    cleaned.priceGrossJtl = isNaN(grossJtl) ? 0 : grossJtl;
    cleaned.priceNet = isNaN(net) ? 0 : net;
    cleaned.priceNetCategory = isNaN(netCategory) ? 0 : netCategory;
    cleaned.priceNetJtl = isNaN(netJtl) ? 0 : netJtl;
    cleaned.purchasePrice = isNaN(purchase) ? 0 : purchase;
    cleaned.msrp = isNaN(msrp) ? 0 : msrp;

    // isActive
    const activeRaw = readField('isActive');
    cleaned.isActive = activeRaw === undefined ? true : parseBoolean(activeRaw);

    // deviceTypes: from explicit column (comma-separated) or derived from manufacturer+model
    const dtRaw = readField('deviceTypes');
    if (dtRaw && String(dtRaw).trim() !== '') {
      cleaned.deviceTypes = String(dtRaw)
        .split(/[,;|]/)
        .map(s => s.trim())
        .filter(Boolean);
    } else {
      const manufacturerForLookup = cleaned.manufacturerPrecise || cleaned.manufacturer;
      const modelForLookup = cleaned.modelPrecise || cleaned.model;
      let dt = '';
      if (deviceLookup) {
        dt = deviceLookup.resolveDeviceTypeName(manufacturerForLookup, modelForLookup);
      }
      if (!dt) dt = inferDeviceTypeFromModel(modelForLookup, manufacturerForLookup);
      cleaned.deviceTypes = dt ? [dt] : [];
    }

    if (!cleaned.deviceType && cleaned.deviceTypes.length > 0) {
      cleaned.deviceType = cleaned.deviceTypes[0];
    }

    // Description fallback so the model never sees an empty required field.
    if (!cleaned.description) {
      cleaned.description = cleaned.shortDescription || cleaned.name;
    }
    if (!cleaned.shortDescription) {
      cleaned.shortDescription = cleaned.description || cleaned.name;
    }

    return cleaned;
  }

  /**
   * Process the parsed CSV: clean each row, validate, and detect duplicates.
   */
  static async processCSVImport(csvRows, columnMapping = null) {
    if (!csvRows || !csvRows.length) {
      return {
        success: false,
        validatedData: [],
        errors: ['CSV is empty'],
        errorDetails: [],
        warnings: [],
        duplicateCheck: { hasDuplicates: false, duplicates: [], duplicateCount: 0 },
        stats: { totalRows: 0, validRows: 0, errorRows: 0, duplicateRows: 0 },
      };
    }

    const deviceLookup = new DeviceLookup();
    await deviceLookup.load();

    const validatedData = [];
    const errors = [];
    const warnings = [];
    const errorRows = [];

    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];
      if (!row || Object.values(row).every(v => v === undefined || v === null || String(v).trim() === '')) {
        warnings.push(`Row ${i + 1}: empty row skipped`);
        continue;
      }
      const cleaned = this.cleanServiceData(row, columnMapping || {}, deviceLookup);
      const v = this.validateServiceData(cleaned, i);
      if (v.errors.length) {
        errors.push(...v.errors);
        errorRows.push({ rowIndex: i + 1, data: cleaned, errors: v.errors });
      } else {
        validatedData.push({ rowIndex: i + 1, data: cleaned });
      }
    }

    const duplicateCheck = await this.checkDuplicates(validatedData.map(v => v.data));
    if (duplicateCheck.hasDuplicates) {
      duplicateCheck.duplicates.forEach(d => {
        warnings.push(`Row ${d.rowIndex}: Service "${d.serviceName}" already exists`);
      });
    }

    const errorDetails = errors.slice(0, 20).map(msg => {
      const m = msg.match(/Row (\d+):\s*(.*)/);
      return m
        ? { row: parseInt(m[1], 10), field: null, message: m[2] }
        : { row: null, field: null, message: msg };
    });

    return {
      success: errors.length === 0,
      validatedData,
      errorRows,
      errors,
      errorDetails,
      warnings,
      duplicateCheck,
      stats: {
        totalRows: csvRows.length,
        validRows: validatedData.length,
        errorRows: errorRows.length,
        duplicateRows: duplicateCheck.duplicateCount,
      },
    };
  }

  /**
   * Persist validated rows to MongoDB.
   * options.skipDuplicates  - skip rows whose (name+manufacturerPrecise+modelPrecise+color) already exists.
   * options.updateExisting  - update those existing rows instead of creating duplicates.
   */
  static async importServices(validatedData, options = {}) {
    const skipDuplicates = options.skipDuplicates !== false;
    const updateExisting = !!options.updateExisting;

    const imported = [];
    const skipped = [];
    const failed = [];

    // Build lookup of existing services keyed the same way as checkDuplicates.
    const existing = await Service.find(
      {},
      'name category manufacturerPrecise modelPrecise color'
    ).lean();
    const keyOf = (s) =>
      [
        String(s.name || '').toLowerCase().trim(),
        String(s.category || '').toLowerCase().trim(),
        String(s.manufacturerPrecise || '').toLowerCase().trim(),
        String(s.modelPrecise || '').toLowerCase().trim(),
        String(s.color || '').toLowerCase().trim(),
      ].join('|');
    const existingMap = new Map();
    existing.forEach(s => existingMap.set(keyOf(s), s));

    for (const entry of validatedData) {
      const data = entry.data || entry;
      const rowIndex = entry.rowIndex || 0;
      try {
        const k = keyOf(data);
        const existingDoc = existingMap.get(k);

        if (existingDoc) {
          if (updateExisting) {
            const updated = await Service.findByIdAndUpdate(
              existingDoc._id,
              { ...data, updatedAt: new Date() },
              { new: true, runValidators: true }
            );
            imported.push({
              rowIndex,
              serviceName: updated.name,
              action: 'updated',
              id: String(updated._id),
            });
          } else if (skipDuplicates) {
            skipped.push({
              rowIndex,
              serviceName: data.name,
              reason: 'Duplicate (already exists)',
            });
          } else {
            // Neither update nor skip -> create anyway
            const created = await Service.create(data);
            imported.push({
              rowIndex,
              serviceName: created.name,
              action: 'created',
              id: String(created._id),
            });
          }
        } else {
          const created = await Service.create(data);
          imported.push({
            rowIndex,
            serviceName: created.name,
            action: 'created',
            id: String(created._id),
          });
          existingMap.set(k, { _id: created._id, ...data });
        }
      } catch (err) {
        failed.push({
          rowIndex,
          serviceName: (data && data.name) || `Row ${rowIndex}`,
          error: err.message,
        });
      }
    }

    return {
      success: failed.length === 0,
      imported,
      skipped,
      failed,
      stats: {
        totalProcessed: validatedData.length,
        importedCount: imported.length,
        skippedCount: skipped.length,
        failedCount: failed.length,
      },
    };
  }
}

module.exports = CSVServiceImportService;
