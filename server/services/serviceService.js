const Service = require('../models/Service.js');
const { DeviceType } = require('../models/Device.js');

class ServiceService {
  static deviceTypeCache = {
    expiresAt: 0,
    value: null,
  };

  static async getCachedDeviceTypes() {
    const now = Date.now();
    if (ServiceService.deviceTypeCache.value && ServiceService.deviceTypeCache.expiresAt > now) {
      return ServiceService.deviceTypeCache.value;
    }

    const allDT = await DeviceType.find({ isActive: true }).lean();
    ServiceService.deviceTypeCache = {
      value: allDT,
      expiresAt: now + 5 * 60 * 1000,
    };
    return allDT;
  }

  static escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Exakter, gross/klein-unabhaengiger Vergleich; Mehrfach-Leerzeichen zaehlen als eins.
  static exactTextRegex(value) {
    const escaped = ServiceService.escapeRegex(String(value || '').trim()).replace(/\s+/g, '\\s+');
    return new RegExp(`^\\s*${escaped}\\s*$`, 'i');
  }

  static normalizeText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  // Alle Schreibweisen eines Geraetetyps: DeviceType-Schluessel ("smartphone"),
  // Anzeigename ("Smartphone") und Kleinschreibung, inkl. wearable <-> smartwatch.
  static async buildDeviceTypeVariants(deviceType) {
    const rawType = String(deviceType || '').trim();
    if (!rawType) return [];
    const lowerType = rawType.toLowerCase();
    const typeVariants = new Set([rawType, lowerType]);

    try {
      const allDT = await ServiceService.getCachedDeviceTypes();
      for (const dt of allDT) {
        const key = String(dt._id || '').trim();
        const name = String(dt.name || '').trim();
        if (key.toLowerCase() === lowerType || name.toLowerCase() === lowerType) {
          typeVariants.add(key);
          typeVariants.add(name);
          typeVariants.add(key.toLowerCase());
          typeVariants.add(name.toLowerCase());
        }
      }

      // Cross-compatibility: wearable ↔ smartwatch family.
      const wearableSlugs = new Set(['wearable', 'wearables', 'smartwatch', 'smartwatches']);
      const hasWearableRelated = [...typeVariants].some((v) => wearableSlugs.has(v.toLowerCase()));
      if (hasWearableRelated) {
        wearableSlugs.forEach((slug) => typeVariants.add(slug));
        for (const dt of allDT) {
          const keyLower = String(dt._id || '').toLowerCase();
          const nameLower = String(dt.name || '').toLowerCase();
          if (wearableSlugs.has(keyLower) || wearableSlugs.has(nameLower)) {
            typeVariants.add(String(dt._id).trim());
            typeVariants.add(String(dt.name || '').trim());
            typeVariants.add(keyLower);
            typeVariants.add(nameLower);
          }
        }
      }
    } catch (_) {
      // Non-fatal: if the DeviceType lookup fails, fall through with the raw values.
    }

    return [...typeVariants].filter(Boolean);
  }

  // Modellbedingung (gleich fuer Katalogliste und Geraete-Abgleich):
  //  - modelPrecise passt, ODER
  //  - modelPrecise leer und das ALTE Textfeld `model` passt, ODER
  //  - beide leer (modellunabhaengiger Service, z.B. "Diagnose").
  // Frueher galt "modelPrecise leer" allein schon als "alle Modelle" - ein Altdaten-
  // Service mit model = "iPhone 14" tauchte dadurch beim iPhone 15 auf.
  static buildModelCondition(deviceModel) {
    const modelRegex = ServiceService.exactTextRegex(deviceModel);
    return {
      $or: [
        { modelPrecise: modelRegex },
        { modelPrecise: { $in: ['', null] }, model: modelRegex },
        { modelPrecise: { $in: ['', null] }, model: { $in: ['', null] } },
      ],
    };
  }

  static buildManufacturerCondition(deviceBrand) {
    const manufacturerRegex = ServiceService.exactTextRegex(deviceBrand);
    return {
      $or: [
        { manufacturerPrecise: manufacturerRegex },
        { manufacturerPrecise: { $in: ['', null] }, manufacturer: manufacturerRegex },
      ],
    };
  }

  /**
   * Alle AKTIVEN Services, die zum tatsaechlichen Geraet passen - vollstaendig, ohne
   * Seitenbegrenzung. Grundlage fuer die Serviceauswahl im Geraetewechsel und am
   * Auftrag. Services ohne gepflegten Geraetetyp gelten als typunabhaengig.
   */
  static async findServicesForDevice({ deviceType, deviceBrand, deviceModel } = {}) {
    const andConditions = [];
    const typeVariants = await ServiceService.buildDeviceTypeVariants(deviceType);
    if (typeVariants.length > 0) {
      andConditions.push({
        $or: [
          { deviceTypes: { $in: typeVariants } },
          { deviceType: { $in: typeVariants } },
          {
            $and: [
              { $or: [{ deviceTypes: { $exists: false } }, { deviceTypes: { $size: 0 } }] },
              { deviceType: { $in: ['', null] } },
            ],
          },
        ],
      });
    }
    if (String(deviceBrand || '').trim()) {
      andConditions.push(ServiceService.buildManufacturerCondition(deviceBrand));
    }
    if (String(deviceModel || '').trim()) {
      andConditions.push(ServiceService.buildModelCondition(deviceModel));
    }

    const query = { isActive: true };
    if (andConditions.length > 0) {
      query.$and = andConditions;
    }
    return Service.find(query).sort({ name: 1 });
  }

  /**
   * Serverseitige Pruefung derselben Regel wie findServicesForDevice fuer EINEN
   * Service (z.B. beim Hinzufuegen oder Tauschen einer Position).
   * @returns {Promise<{ ok: boolean, reason?: 'inactive'|'type'|'brand'|'model' }>}
   */
  static async checkServiceForDevice(service, { deviceType, deviceBrand, deviceModel } = {}) {
    if (!service || service.isActive === false) {
      return { ok: false, reason: 'inactive' };
    }

    const declaredTypes = [
      ...(Array.isArray(service.deviceTypes) ? service.deviceTypes : []),
      service.deviceType,
    ]
      .filter(Boolean)
      .map((entry) => String(entry).trim().toLowerCase());
    if (declaredTypes.length > 0 && String(deviceType || '').trim()) {
      const variants = (await ServiceService.buildDeviceTypeVariants(deviceType)).map((v) => v.toLowerCase());
      if (!declaredTypes.some((entry) => variants.includes(entry))) {
        return { ok: false, reason: 'type' };
      }
    }

    if (String(deviceBrand || '').trim()) {
      const serviceBrand = ServiceService.normalizeText(service.manufacturerPrecise)
        || ServiceService.normalizeText(service.manufacturer);
      if (serviceBrand !== ServiceService.normalizeText(deviceBrand)) {
        return { ok: false, reason: 'brand' };
      }
    }

    if (String(deviceModel || '').trim()) {
      const serviceModel = ServiceService.normalizeText(service.modelPrecise)
        || ServiceService.normalizeText(service.model);
      if (serviceModel && serviceModel !== ServiceService.normalizeText(deviceModel)) {
        return { ok: false, reason: 'model' };
      }
    }

    return { ok: true };
  }

  // Deutsche Meldung fuer eine abgelehnte Serviceauswahl (checkServiceForDevice).
  static describeDeviceMismatch(service, match, deviceLabel) {
    const name = service?.name || 'Reparaturservice';
    if (match?.reason === 'inactive') {
      return `Der Service „${name}“ ist nicht mehr aktiv und kann nicht verwendet werden.`;
    }
    const detail = { type: 'anderer Gerätetyp', brand: 'anderer Hersteller', model: 'anderes Modell' }[match?.reason];
    return `Der Service „${name}“ passt nicht zu ${deviceLabel}${detail ? ` (${detail})` : ''}.`;
  }

  static async list(filters = {}, pagination = {}, sorting = {}) {
    try {
      console.log('ServiceService: Listing services with filters:', filters, 'pagination:', pagination, 'sorting:', sorting);

      const query = { isActive: true };
      const andConditions = [];

      // Add category filter if provided
      if (filters.category) {
        query.category = filters.category;
      }

      // Add device type filter if provided.
      // Build a comprehensive set of string variants (key + display name + lowercase) so
      // that services are found regardless of whether they store the DeviceType slug key
      // ("wearable") or the display name ("Wearables") – both forms exist in practice.
      if (filters.deviceType) {
        const rawType = String(filters.deviceType).trim();
        const lowerType = rawType.toLowerCase();

        const typeVariants = new Set([rawType, lowerType]);

        try {
          const allDT = await ServiceService.getCachedDeviceTypes();
          for (const dt of allDT) {
            const key = String(dt._id || '').trim();
            const name = String(dt.name || '').trim();
            const keyLower = key.toLowerCase();
            const nameLower = name.toLowerCase();
            // Match if either the key or the display name corresponds to the filter value.
            if (keyLower === lowerType || nameLower === lowerType) {
              typeVariants.add(key);
              typeVariants.add(name);
              typeVariants.add(keyLower);
              typeVariants.add(nameLower);
            }
          }

          // Cross-compatibility: wearable ↔ smartwatch family.
          const wearableSlugs = new Set(['wearable', 'wearables', 'smartwatch', 'smartwatches']);
          const hasWearableRelated = [...typeVariants].some((v) => wearableSlugs.has(v.toLowerCase()));
          if (hasWearableRelated) {
            for (const dt of allDT) {
              const keyLower = String(dt._id || '').toLowerCase();
              const nameLower = String(dt.name || '').toLowerCase();
              if (wearableSlugs.has(keyLower) || wearableSlugs.has(nameLower)) {
                typeVariants.add(String(dt._id).trim());
                typeVariants.add(String(dt.name || '').trim());
                typeVariants.add(keyLower);
                typeVariants.add(nameLower);
              }
            }
          }
        } catch (_) {
          // Non-fatal: if the DeviceType lookup fails, fall through with the raw values.
        }

        const compatibleTypes = [...typeVariants].filter(Boolean);

        andConditions.push({
          $or: [
            { deviceTypes: { $in: compatibleTypes } },
            { deviceType: { $in: compatibleTypes } },
          ],
        });
      }

      // Filter by precise manufacturer (case-insensitive exact match).
      // Also includes legacy services that only have `manufacturer` set (manufacturerPrecise is empty)
      // so that services created before the manufacturerPrecise field was introduced still appear.
      if (filters.manufacturerPrecise) {
        const escapedMfr = String(filters.manufacturerPrecise).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const manufacturerRegex = new RegExp(`^${escapedMfr}$`, 'i');
        andConditions.push({
          $or: [
            { manufacturerPrecise: manufacturerRegex },
            { manufacturerPrecise: { $in: ['', null] }, manufacturer: manufacturerRegex },
          ],
        });
      }

      // Filter by precise model. When set, return services that match this model
      // (modelPrecise, or the legacy `model` text when modelPrecise is empty) OR generic
      // services with no model at all (so a generic "Diagnose" still shows up).
      if (filters.modelPrecise) {
        andConditions.push(ServiceService.buildModelCondition(filters.modelPrecise));
      }

      if (andConditions.length > 0) {
        query.$and = andConditions;
      }

      // Pagination setup
      const page = parseInt(pagination.page) || 1;
      const limit = parseInt(pagination.limit) || 10;
      const skip = (page - 1) * limit;

      // Sorting setup
      const sortBy = sorting.sortBy || 'popularity';
      const sortOrder = sorting.sortOrder === 'asc' ? 1 : -1;
      const sortObj = {};

      // Map frontend column names to database field names
      const sortFieldMap = {
        'name': 'name',
        'category': 'category',
        'manufacturer': 'manufacturer',
        'model': 'model',
        'price': 'price',
        'estimatedTime': 'estimatedTime',
        'popularity': 'popularity'
      };

      const dbSortField = sortFieldMap[sortBy] || 'popularity';
      sortObj[dbSortField] = sortOrder;

      // Add secondary sort by name for consistency
      if (dbSortField !== 'name') {
        sortObj['name'] = 1;
      }

      console.log(`ServiceService: Querying with sort:`, sortObj, `skip: ${skip}, limit: ${limit}`);

      // Execute query with pagination and sorting
      const [services, total] = await Promise.all([
        Service.find(query).sort(sortObj).skip(skip).limit(limit).lean(),
        Service.countDocuments(query)
      ]);

      const totalPages = Math.ceil(total / limit);

      console.log(`ServiceService: Found ${services.length} services out of ${total} total (page ${page}/${totalPages})`);

      return {
        services,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };
    } catch (err) {
      console.error('ServiceService: Error listing services:', err);
      throw new Error(`Database error while listing services: ${err.message}`);
    }
  }

  static async get(id) {
    try {
      console.log('ServiceService: Getting service with ID:', id);

      const service = await Service.findOne({ _id: id, isActive: true });

      if (!service) {
        console.log('ServiceService: Service not found');
        return null;
      }

      console.log('ServiceService: Service found:', service.name);
      return service;
    } catch (err) {
      console.error('ServiceService: Error getting service:', err);
      throw new Error(`Database error while getting service: ${err.message}`);
    }
  }

  static async create(serviceData) {
    try {
      console.log('ServiceService: Creating service:', serviceData.name);

      const service = new Service(serviceData);
      await service.save();

      console.log('ServiceService: Service created successfully with ID:', service._id);
      return service;
    } catch (err) {
      console.error('ServiceService: Error creating service:', err);
      throw new Error(`Database error while creating service: ${err.message}`);
    }
  }

  static async update(id, updateData) {
    try {
      console.log('ServiceService: Updating service with ID:', id);

      const service = await Service.findOneAndUpdate(
        { _id: id, isActive: true },
        updateData,
        { new: true, runValidators: true }
      );

      if (!service) {
        console.log('ServiceService: Service not found for update');
        return null;
      }

      console.log('ServiceService: Service updated successfully');
      return service;
    } catch (err) {
      console.error('ServiceService: Error updating service:', err);
      throw new Error(`Database error while updating service: ${err.message}`);
    }
  }

  static async delete(id) {
    try {
      console.log('ServiceService: Soft deleting service with ID:', id);

      const service = await Service.findOneAndUpdate(
        { _id: id },
        { isActive: false },
        { new: true }
      );

      if (!service) {
        console.log('ServiceService: Service not found for deletion');
        return false;
      }

      console.log('ServiceService: Service soft deleted successfully');
      return true;
    } catch (err) {
      console.error('ServiceService: Error deleting service:', err);
      throw new Error(`Database error while deleting service: ${err.message}`);
    }
  }

  static async deleteAll() {
    try {
      console.log('ServiceService: Hard deleting ALL services');
      const result = await Service.deleteMany({});
      console.log(`ServiceService: Deleted ${result.deletedCount} services`);
      return result.deletedCount || 0;
    } catch (err) {
      console.error('ServiceService: Error deleting all services:', err);
      throw new Error(`Database error while deleting all services: ${err.message}`);
    }
  }
}

module.exports = ServiceService;
