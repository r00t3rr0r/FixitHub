const { DeviceBrand, DeviceModel, DeviceType } = require('../models/Device');
const Service = require('../models/Service');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const slugifyDeviceType = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const toDisplayName = (key = '') =>
  String(key)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const slugForFilesystem = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';

async function downloadAndSaveModelImage(imageUrl, imageB64, brandName, modelName) {
  const brandSlug = slugForFilesystem(brandName);
  const modelSlug = slugForFilesystem(modelName);
  const dir = path.join(__dirname, '../uploads/device-images', brandSlug);
  const filePath = path.join(dir, `${modelSlug}.jpg`);
  const relativePath = `/uploads/device-images/${brandSlug}/${modelSlug}.jpg`;

  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (_) {
    // ignore mkdirSync errors
  }

  if (imageUrl) {
    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
      fs.writeFileSync(filePath, Buffer.from(response.data));
      return relativePath;
    } catch (_) {
      // fall through to b64
    }
  }

  if (imageB64) {
    try {
      fs.writeFileSync(filePath, Buffer.from(imageB64, 'base64'));
      return relativePath;
    } catch (_) {
      // fall through
    }
  }

  return null;
}

const parseListValue = (value) => {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)));
  }

  if (typeof value === 'string') {
    return Array.from(
      new Set(
        value
          .split(/[,;\n|]/)
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
  }

  return [];
};

const parseModelNumbersValue = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)));
  }

  const input = String(value).trim();
  if (!input) {
    return [];
  }

  const splitByPrimaryDelimiters = input
    .split(/[;\n|]/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (splitByPrimaryDelimiters.length > 1) {
    return Array.from(new Set(splitByPrimaryDelimiters));
  }

  // Keep Apple-style identifiers intact (e.g. iPhone11,8 / iPhone15,2 / iPad13,4).
  if (/^[a-z][a-z0-9]*\d+,\d+$/i.test(input)) {
    return [input];
  }

  const commaParts = input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  // In mixed lists like "A2890, A2650, iphone15,2" a plain comma split breaks
  // Apple internal identifiers; merge "<prefix+digits>,<digits>" back together.
  const mergedCommaParts = [];
  for (let i = 0; i < commaParts.length; i += 1) {
    const current = commaParts[i];
    const next = commaParts[i + 1];
    if (/^[a-z][a-z0-9]*\d+$/i.test(current) && /^\d+$/.test(next || '')) {
      mergedCommaParts.push(`${current},${next}`);
      i += 1;
      continue;
    }
    mergedCommaParts.push(current);
  }

  const shouldSplitByComma =
    mergedCommaParts.length > 1 &&
    mergedCommaParts.every((part) => /^[a-z0-9._\-+/,]+$/i.test(part) && /\d/.test(part));

  if (shouldSplitByComma) {
    return Array.from(new Set(mergedCommaParts));
  }

  return [input];
};

const toComparable = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');

const toNonEmptyString = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  const normalized = String(value).trim();
  return normalized;
};

const splitCommaList = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

class DeviceService {
  static formatMobileApiRequestError(error) {
    const responseData = error?.response?.data;
    const statusCode = Number(error?.response?.status || 0) || null;
    const errorCode = String(error?.code || '').trim() || null;

    let message = '';
    if (typeof responseData?.error === 'string' && responseData.error.trim()) {
      message = responseData.error.trim();
    } else if (typeof responseData?.message === 'string' && responseData.message.trim()) {
      message = responseData.message.trim();
    } else if (typeof responseData === 'string' && responseData.trim()) {
      message = responseData.trim();
    } else {
      message = String(error?.message || 'Unknown MobileAPI request error').trim();
    }

    return {
      statusCode,
      errorCode,
      message,
    };
  }

  static async fetchMobileApiCandidates(modelName, apiKey) {
    const response = await axios.get('https://api.mobileapi.dev/devices/search/', {
      params: {
        name: modelName,
        page: 1,
        key: apiKey,
      },
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    if (response?.data?.error) {
      const apiError = new Error(String(response.data.error));
      apiError.response = {
        status: Number(response?.status || 0) || null,
        data: response.data,
      };
      throw apiError;
    }

    return Array.isArray(response?.data?.devices) ? response.data.devices : [];
  }

  // Get all brands
  static async getBrands() {
    try {
      console.log('DeviceService: Getting all brands');

      const brands = await DeviceBrand.find({ isActive: true })
        .sort({ name: 1 })
        .lean();

      for (const brand of brands) {
        const modelCount = await DeviceModel.countDocuments({
          brandId: brand._id,
          isActive: true,
        });
        brand.modelCount = modelCount;
      }

      return brands;
    } catch (error) {
      console.error('DeviceService: Error getting brands:', error);
      throw error;
    }
  }

  // Get brand by ID
  static async getBrandById(brandId) {
    try {
      const brand = await DeviceBrand.findOne({ _id: brandId, isActive: true });

      if (!brand) {
        throw new Error('Brand not found');
      }

      return brand;
    } catch (error) {
      console.error('DeviceService: Error getting brand by ID:', error);
      throw error;
    }
  }

  // Get models by brand
  static async getModelsByBrand(brandId) {
    try {
      const models = await DeviceModel.find({
        brandId,
        isActive: true,
      })
        .populate('brandId', 'name logo')
        .sort({ name: 1 });

      return models;
    } catch (error) {
      console.error('DeviceService: Error getting models by brand:', error);
      throw error;
    }
  }

  // Get model by ID
  static async getModelById(modelId) {
    try {
      const model = await DeviceModel.findOne({ _id: modelId, isActive: true }).populate('brandId', 'name logo');

      if (!model) {
        throw new Error('Model not found');
      }

      return model;
    } catch (error) {
      console.error('DeviceService: Error getting model by ID:', error);
      throw error;
    }
  }

  // Get device types with counts (saved types + discovered types from models)
  static async getDeviceTypes() {
    try {
      const [deviceTypeCounts, savedTypes] = await Promise.all([
        DeviceModel.aggregate([
          { $match: { isActive: true } },
          {
            $group: {
              _id: '$deviceType',
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        DeviceType.find({ isActive: true }).lean(),
      ]);

      const countByType = new Map(
        deviceTypeCounts.map((type) => [String(type._id), Number(type.count || 0)])
      );

      const mergedTypes = new Map();

      for (const type of savedTypes) {
        const id = String(type._id);
        mergedTypes.set(id, {
          _id: id,
          name: type.name || toDisplayName(id),
          count: countByType.get(id) || 0,
        });
      }

      for (const type of deviceTypeCounts) {
        const id = String(type._id);
        if (!mergedTypes.has(id)) {
          mergedTypes.set(id, {
            _id: id,
            name: toDisplayName(id),
            count: Number(type.count || 0),
          });
        }
      }

      return Array.from(mergedTypes.values()).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('DeviceService: Error getting device types:', error);
      throw error;
    }
  }

  // Create device type/category (admin only)
  static async createDeviceType(typeData) {
    try {
      const typeName = String(typeData?.name || '').trim();
      const typeKey = slugifyDeviceType(typeData?.key || typeName);

      if (!typeName) {
        throw new Error('Device type name is required');
      }
      if (!typeKey) {
        throw new Error('A valid device type key is required');
      }

      const [existingType, existingModelType] = await Promise.all([
        DeviceType.findOne({ _id: typeKey, isActive: true }).lean(),
        DeviceModel.findOne({ deviceType: typeKey, isActive: true }).select('_id').lean(),
      ]);

      if (existingType || existingModelType) {
        throw new Error('Device type already exists');
      }

      const createdType = await DeviceType.create({
        _id: typeKey,
        name: typeName,
      });

      return {
        _id: createdType._id,
        name: createdType.name,
        count: 0,
      };
    } catch (error) {
      console.error('DeviceService: Error creating device type:', error);
      throw error;
    }
  }

  // Update device type/category (admin only)
  static async updateDeviceType(typeId, typeData) {
    try {
      const currentTypeId = slugifyDeviceType(typeId);
      const nextName = String(typeData?.name || '').trim();
      const nextTypeId = slugifyDeviceType(typeData?.key || nextName || currentTypeId);

      if (!currentTypeId) {
        throw new Error('Current device type is required');
      }
      if (!nextName) {
        throw new Error('Device type name is required');
      }
      if (!nextTypeId) {
        throw new Error('A valid device type key is required');
      }

      if (nextTypeId !== currentTypeId) {
        const [existingType, existingModelType] = await Promise.all([
          DeviceType.findOne({ _id: nextTypeId, isActive: true }).lean(),
          DeviceModel.findOne({ deviceType: nextTypeId, isActive: true }).select('_id').lean(),
        ]);

        if (existingType || existingModelType) {
          throw new Error('Target device type key already exists');
        }
      }

      const [savedType, modelCount] = await Promise.all([
        DeviceType.findOne({ _id: currentTypeId, isActive: true }),
        DeviceModel.countDocuments({ deviceType: currentTypeId, isActive: true }),
      ]);

      if (!savedType && modelCount === 0) {
        throw new Error('Device type not found');
      }

      if (nextTypeId !== currentTypeId) {
        await DeviceModel.updateMany(
          { deviceType: currentTypeId },
          { $set: { deviceType: nextTypeId } }
        );
      }

      if (savedType) {
        if (nextTypeId !== currentTypeId) {
          await DeviceType.deleteOne({ _id: currentTypeId });
          await DeviceType.create({ _id: nextTypeId, name: nextName, isActive: true });
        } else {
          savedType.name = nextName;
          await savedType.save();
        }
      } else {
        await DeviceType.create({ _id: nextTypeId, name: nextName, isActive: true });
      }

      const updatedCount = await DeviceModel.countDocuments({ deviceType: nextTypeId, isActive: true });

      return {
        _id: nextTypeId,
        name: nextName,
        count: updatedCount,
      };
    } catch (error) {
      console.error('DeviceService: Error updating device type:', error);
      throw error;
    }
  }

  // Delete device type/category (admin only)
  static async deleteDeviceType(typeId) {
    try {
      const normalizedTypeId = slugifyDeviceType(typeId);

      if (!normalizedTypeId) {
        throw new Error('Device type is required');
      }

      const [savedType, modelCount] = await Promise.all([
        DeviceType.findOne({ _id: normalizedTypeId, isActive: true }),
        DeviceModel.countDocuments({ deviceType: normalizedTypeId, isActive: true }),
      ]);

      if (!savedType && modelCount === 0) {
        throw new Error('Device type not found');
      }

      if (modelCount > 0) {
        throw new Error('Cannot delete device type while models still use this category');
      }

      if (savedType) {
        await DeviceType.deleteOne({ _id: normalizedTypeId });
      }

      return {
        _id: normalizedTypeId,
        deleted: true,
      };
    } catch (error) {
      console.error('DeviceService: Error deleting device type:', error);
      throw error;
    }
  }

  // Get manufacturers by device type
  static async getManufacturersByDeviceType(deviceType) {
    try {
      const manufacturers = await DeviceModel.aggregate([
        {
          $match: {
            deviceType,
            isActive: true,
          },
        },
        {
          $lookup: {
            from: 'devicebrands',
            localField: 'brandId',
            foreignField: '_id',
            as: 'brand',
          },
        },
        { $unwind: '$brand' },
        {
          $group: {
            _id: '$brand._id',
            name: { $first: '$brand.name' },
            logo: { $first: '$brand.logo' },
            deviceType: { $first: '$deviceType' },
            count: { $sum: 1 },
          },
        },
        { $sort: { name: 1 } },
      ]);

      return manufacturers;
    } catch (error) {
      console.error('DeviceService: Error getting manufacturers by device type:', error);
      throw error;
    }
  }

  // Get models by type and manufacturer
  static async getModelsByTypeAndManufacturer(deviceType, manufacturerId) {
    try {
      const models = await DeviceModel.find({
        deviceType,
        brandId: manufacturerId,
        isActive: true,
      })
        .populate('brandId', 'name logo')
        .sort({ name: 1 });

      return models.map((model) => {
        // Spezielle Behandlung für model_numbers
        let other = model.other || { models: [], sarValues: {}, colors: [] };
        // Modellnummern: Priorität modelNumbers (Top-Level), dann other.modelNumbers, dann other.models
        let modelNumbers = [];
        if (Array.isArray(model.modelNumbers) && model.modelNumbers.length > 0) {
          modelNumbers = model.modelNumbers;
        } else if (Array.isArray(other.modelNumbers) && other.modelNumbers.length > 0) {
          modelNumbers = other.modelNumbers;
        } else if (Array.isArray(other.models) && other.models.length > 0) {
          modelNumbers = other.models;
        }
        // description als plain string aus Map holen
        let specifications = {};
        if (model.specifications && typeof model.specifications.get === 'function') {
          specifications = Object.fromEntries(model.specifications.entries());
        } else {
          specifications = model.specifications || {};
        }
        return {
          _id: model._id,
          name: model.name,
          manufacturer: model.brandId.name,
          brandId: model.brandId._id,
          deviceType: model.deviceType,
          image: model.image || '',
          series: model.series || '',
          year: model.year || '',
          slug: model.slug || '',
          synonyms: model.synonyms || [],
          commonProblems: model.commonProblems || [],
          specifications,
          images: model.images || [],
          network: model.network || {},
          physical: model.physical || {},
          display: model.display || {},
          platform: model.platform || {},
          memory: model.memory || { internal: [], cardSlot: '' },
          rearCamera: model.rearCamera || {},
          frontCamera: model.frontCamera || {},
          audio: model.audio || {},
          connectivity: model.connectivity || {},
          features: model.features || { sensors: '', special: [] },
          battery: model.battery || {},
          other,
          modelNumbers,
          count: 1,
        };
      });
    } catch (error) {
      console.error('DeviceService: Error getting models by type and manufacturer:', error);
      throw error;
    }
  }

  // Create brand (admin only)
  static async createBrand(brandData) {
    try {
      const brand = new DeviceBrand(brandData);
      return await brand.save();
    } catch (error) {
      console.error('DeviceService: Error creating brand:', error);
      throw error;
    }
  }

  // Create model (admin only)
  static async createModel(modelData) {
    try {
      // Modellnummern aus modelData oder modelData.other übernehmen
      let modelNumbers = [];
      if (Array.isArray(modelData.modelNumbers) && modelData.modelNumbers.length > 0) {
        modelNumbers = modelData.modelNumbers;
      } else if (modelData.other && Array.isArray(modelData.other.modelNumbers) && modelData.other.modelNumbers.length > 0) {
        modelNumbers = modelData.other.modelNumbers;
      } else if (modelData.other && typeof modelData.other.modelNumbers === 'string') {
        modelNumbers = modelData.other.modelNumbers.split(',').map(s => s.trim()).filter(Boolean);
      } else if (modelData.other && Array.isArray(modelData.other.models) && modelData.other.models.length > 0) {
        modelNumbers = modelData.other.models;
      }
      if (modelNumbers.length > 0) {
        modelData.modelNumbers = modelNumbers;
      }
      const model = new DeviceModel(modelData);
      return await model.save();
    } catch (error) {
      console.error('DeviceService: Error creating model:', error);
      throw error;
    }
  }

  // Update model (admin only)
  static async updateModel(modelId, updateData) {
    try {
      if (updateData.brandId !== undefined && (!updateData.brandId || updateData.brandId === '')) {
        throw new Error('Brand ID is required and cannot be empty');
      }

      if (updateData.deviceType !== undefined && (!updateData.deviceType || updateData.deviceType === '')) {
        throw new Error('Device type is required and cannot be empty');
      }

      if (updateData.name !== undefined && (!updateData.name || updateData.name.trim() === '')) {
        throw new Error('Model name is required and cannot be empty');
      }

      const model = await DeviceModel.findOne({ _id: modelId, isActive: true }).populate('brandId', 'name');

      if (!model) {
        throw new Error('Model not found');
      }

      const deepMerge = (target, source) => {
        for (const key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
              if (!target[key] || typeof target[key] !== 'object') {
                target[key] = {};
              }
              deepMerge(target[key], source[key]);
            } else {
              target[key] = source[key];
            }
          }
        }
      };

      // Modellnummern aus updateData oder updateData.other übernehmen
      let modelNumbers = [];
      if (Array.isArray(updateData.modelNumbers) && updateData.modelNumbers.length > 0) {
        modelNumbers = updateData.modelNumbers;
      } else if (updateData.other && Array.isArray(updateData.other.modelNumbers) && updateData.other.modelNumbers.length > 0) {
        modelNumbers = updateData.other.modelNumbers;
      } else if (updateData.other && typeof updateData.other.modelNumbers === 'string') {
        modelNumbers = updateData.other.modelNumbers.split(',').map(s => s.trim()).filter(Boolean);
      } else if (updateData.other && Array.isArray(updateData.other.models) && updateData.other.models.length > 0) {
        modelNumbers = updateData.other.models;
      }
      if (modelNumbers.length > 0) {
        updateData.modelNumbers = modelNumbers;
      }

      const previousModelName = String(model.name || '').trim();
      const previousBrandName = String(model.brandId?.name || '').trim();
      const previousDeviceType = String(model.deviceType || '').trim();

      Object.keys(updateData).forEach((key) => {
        if (
          updateData[key] &&
          typeof updateData[key] === 'object' &&
          !Array.isArray(updateData[key]) &&
          [
            'network',
            'physical',
            'display',
            'platform',
            'memory',
            'rearCamera',
            'frontCamera',
            'audio',
            'connectivity',
            'features',
            'battery',
            'other',
          ].includes(key)
        ) {
          if (!model[key]) {
            model[key] = {};
          }
          deepMerge(model[key], updateData[key]);
        } else {
          model[key] = updateData[key];
        }
      });

      const savedModel = await model.save();
      await savedModel.populate('brandId', 'name');

      const nextModelName = String(savedModel.name || '').trim();
      const nextBrandName = String(savedModel.brandId?.name || '').trim();
      const nextDeviceType = String(savedModel.deviceType || '').trim();

      const cascadeResult = await DeviceService.cascadeServiceModelInfoUpdate({
        previousModelName,
        nextModelName,
        previousBrandName,
        nextBrandName,
        previousDeviceType,
        nextDeviceType,
      });

      if (Number(cascadeResult.modifiedCount || 0) > 0) {
        console.log(
          `DeviceService: Cascaded service links for model "${previousModelName}" ` +
          `(modified: ${cascadeResult.modifiedCount || 0})`
        );
      }

      return savedModel;
    } catch (error) {
      console.error('DeviceService: Error updating model:', error);
      throw error;
    }
  }

  static buildExactRegex(value = '') {
    const escaped = String(value || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped ? new RegExp(`^${escaped}$`, 'i') : null;
  }

  static async cascadeServiceModelInfoUpdate({
    previousModelName,
    nextModelName,
    previousBrandName,
    nextBrandName,
    previousDeviceType,
    nextDeviceType,
  }) {
    const modelRegex = DeviceService.buildExactRegex(previousModelName);
    if (!modelRegex) {
      return { matchedCount: 0, modifiedCount: 0 };
    }

    const brandRegex = DeviceService.buildExactRegex(previousBrandName);
    const serviceFilter = {
      isActive: true,
      $or: [{ modelPrecise: modelRegex }, { model: modelRegex }],
    };

    if (brandRegex) {
      serviceFilter.$and = [{ $or: [{ manufacturerPrecise: brandRegex }, { manufacturer: brandRegex }] }];
    }

    const update = {
      $set: {},
      $addToSet: {},
      $pull: {},
    };

    if (nextModelName && String(nextModelName).trim() !== String(previousModelName || '').trim()) {
      update.$set.model = String(nextModelName).trim();
      update.$set.modelPrecise = String(nextModelName).trim();
    }

    if (nextBrandName && String(nextBrandName).trim() !== String(previousBrandName || '').trim()) {
      update.$set.manufacturer = String(nextBrandName).trim();
      update.$set.manufacturerPrecise = String(nextBrandName).trim();
    }

    if (nextDeviceType && String(nextDeviceType).trim() !== String(previousDeviceType || '').trim()) {
      update.$set.deviceType = String(nextDeviceType).trim();
      update.$addToSet.deviceTypes = String(nextDeviceType).trim();
      update.$addToSet.supportedDeviceTypes = String(nextDeviceType).trim();
      if (previousDeviceType) {
        update.$pull.deviceTypes = String(previousDeviceType).trim();
        update.$pull.supportedDeviceTypes = String(previousDeviceType).trim();
      }
    }

    if (Object.keys(update.$set).length === 0) {
      return { matchedCount: 0, modifiedCount: 0 };
    }

    const hasPull = Object.keys(update.$pull).length > 0;
    const hasAddToSet = Object.keys(update.$addToSet).length > 0;

    // MongoDB does not allow $addToSet and $pull on the same path in one operation.
    // Apply $set + $addToSet first, then $pull in a separate operation.
    const firstOp = { $set: update.$set };
    if (hasAddToSet) {
      firstOp.$addToSet = update.$addToSet;
    }

    const result = await Service.updateMany(serviceFilter, firstOp);

    if (hasPull) {
      await Service.updateMany(serviceFilter, { $pull: update.$pull });
    }

    return {
      matchedCount: Number(result?.matchedCount || 0),
      modifiedCount: Number(result?.modifiedCount || 0),
    };
  }

  static resolveDeviceTypeKey(rawType, availableTypes = []) {
    const normalizedRaw = String(rawType || '').trim().toLowerCase();
    if (!normalizedRaw) {
      return '';
    }

    const aliasMap = {
      phone: 'smartphone',
      smartphone: 'smartphone',
      mobile: 'smartphone',
      cell: 'smartphone',
      cell_phone: 'smartphone',
      tablet: 'tablet',
      laptop: 'laptop',
      notebook: 'notebook',
      wearable: 'wearable',
      smartwatch: 'smartwatch',
      watch: 'smartwatch',
      game_console: 'game-console',
      console: 'game-console',
      earbuds: 'earbuds',
      headphones: 'headphones',
    };

    const aliasedRaw = aliasMap[normalizedRaw] || normalizedRaw;

    const direct = availableTypes.find((type) => String(type._id || '').toLowerCase() === aliasedRaw);
    if (direct) {
      return String(direct._id);
    }

    const byName = availableTypes.find((type) => {
      const typeName = String(type.name || '').trim().toLowerCase();
      return typeName === normalizedRaw || typeName === aliasedRaw;
    });
    if (byName) {
      return String(byName._id);
    }

    const slugged = slugifyDeviceType(aliasedRaw);
    const bySlug = availableTypes.find((type) => String(type._id || '') === slugged);
    if (bySlug) {
      return String(bySlug._id);
    }

    return slugged || aliasedRaw;
  }

  static pickBestMobileApiDevice(candidates = [], currentName = '', currentBrand = '') {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return null;
    }

    const targetName = toComparable(currentName);
    const targetBrand = toComparable(currentBrand);

    const scored = candidates.map((candidate) => {
      const certainty = Number.parseFloat(String(candidate.match_certainty || '0').replace('%', '')) || 0;
      const candidateName = toComparable(candidate.name || '');
      const candidateBrand = toComparable(candidate.manufacturer_name || '');

      const exactNameBonus = candidateName && candidateName === targetName ? 30 : 0;
      const brandBonus = targetBrand && candidateBrand === targetBrand ? 20 : 0;
      const startsWithBonus = candidateName.startsWith(targetName) || targetName.startsWith(candidateName) ? 5 : 0;

      return {
        candidate,
        score: certainty + exactNameBonus + brandBonus + startsWithBonus,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.candidate || null;
  }

  static async buildMobileApiModelUpdate(model, mobileApiDevice, resolvedBrandId, resolvedDeviceType) {
    const modelPlain = typeof model.toObject === 'function' ? model.toObject() : model;

    const nextModelNumbers = parseModelNumbersValue(mobileApiDevice.model_numbers);
    const nextColors = parseListValue(mobileApiDevice.colors);
    const commonProblems = splitCommaList(mobileApiDevice.common_problems);

    const brandName =
      (typeof modelPlain.brandId === 'object' && modelPlain.brandId?.name)
        ? String(modelPlain.brandId.name)
        : '';
    const modelName = toNonEmptyString(modelPlain.name) || toNonEmptyString(mobileApiDevice.name) || 'device';
    const imageB64 = toNonEmptyString(mobileApiDevice.image_b64);
    const imageUrl = toNonEmptyString(mobileApiDevice.image_url);

    let imageFromApi = toNonEmptyString(modelPlain.image);
    if (imageB64 || imageUrl) {
      const downloaded = await downloadAndSaveModelImage(imageUrl, imageB64, brandName, modelName);
      if (downloaded) {
        imageFromApi = downloaded;
      }
    }

    const memoryInternalFromApi = [
      ...splitCommaList(mobileApiDevice.memory_internal).map((item) => {
        const parts = item.split('/').map((part) => part.trim()).filter(Boolean);
        if (parts.length >= 2) {
          return { ram: parts[0], storage: parts.slice(1).join('/') };
        }
        return { ram: '', storage: parts[0] || '' };
      }),
      ...splitCommaList(mobileApiDevice.storage).map((storage) => ({ storage })),
    ].filter((entry) => entry.ram || entry.storage);

    const updateData = {
      mobileApiUpdatedAt: new Date(),
      mobileApiMatchId: Number(mobileApiDevice.id) || undefined,
      mobileApiLastStatus: 'updated',
      name: toNonEmptyString(modelPlain.name),
      brandId: resolvedBrandId || modelPlain.brandId,
      deviceType: resolvedDeviceType || modelPlain.deviceType,
      image: imageFromApi,
      images: imageFromApi
        ? [{
          url: imageFromApi,
          caption: toNonEmptyString(mobileApiDevice.image_url) || '',
        }]
        : modelPlain.images || [],
      modelNumbers: nextModelNumbers.length > 0 ? nextModelNumbers : modelPlain.modelNumbers || [],
      commonProblems: commonProblems.length > 0 ? commonProblems : modelPlain.commonProblems || [],
      specifications: {
        ...(modelPlain.specifications || {}),
        ...(toNonEmptyString(mobileApiDevice.description)
          ? { description: toNonEmptyString(mobileApiDevice.description) }
          : {}),
      },
      network: {
        ...(modelPlain.network || {}),
        technology2G: toNonEmptyString(mobileApiDevice.technology_2g) || toNonEmptyString((modelPlain.network || {}).technology2G),
        bands2G: toNonEmptyString(mobileApiDevice.bands_2g) || toNonEmptyString((modelPlain.network || {}).bands2G),
        technology3G: toNonEmptyString(mobileApiDevice.technology_3g) || toNonEmptyString((modelPlain.network || {}).technology3G),
        bands3G: toNonEmptyString(mobileApiDevice.bands_3g) || toNonEmptyString((modelPlain.network || {}).bands3G),
        technology4G: toNonEmptyString(mobileApiDevice.technology_4g) || toNonEmptyString((modelPlain.network || {}).technology4G),
        bands4G: toNonEmptyString(mobileApiDevice.bands_4g) || toNonEmptyString((modelPlain.network || {}).bands4G),
        technology5G: toNonEmptyString(mobileApiDevice.technology_5g) || toNonEmptyString((modelPlain.network || {}).technology5G),
        bands5G: toNonEmptyString(mobileApiDevice.bands_5g) || toNonEmptyString((modelPlain.network || {}).bands5G),
        speed: toNonEmptyString(mobileApiDevice.network_speed) || toNonEmptyString((modelPlain.network || {}).speed),
      },
      physical: {
        ...(modelPlain.physical || {}),
        dimensions: toNonEmptyString(mobileApiDevice.thickness) || toNonEmptyString((modelPlain.physical || {}).dimensions),
        weight: toNonEmptyString(mobileApiDevice.weight) || toNonEmptyString((modelPlain.physical || {}).weight),
        build: toNonEmptyString(mobileApiDevice.body_material) || toNonEmptyString((modelPlain.physical || {}).build),
        simType: toNonEmptyString(mobileApiDevice.sim_type) || toNonEmptyString((modelPlain.physical || {}).simType),
        simCount: toNonEmptyString(mobileApiDevice.sim_count) || toNonEmptyString((modelPlain.physical || {}).simCount),
      },
      display: {
        ...(modelPlain.display || {}),
        type: toNonEmptyString(mobileApiDevice.display_type) || toNonEmptyString((modelPlain.display || {}).type),
        size: toNonEmptyString(mobileApiDevice.screen_size) || toNonEmptyString((modelPlain.display || {}).size),
        resolution: toNonEmptyString(mobileApiDevice.screen_resolution) || toNonEmptyString((modelPlain.display || {}).resolution),
        protection: toNonEmptyString(mobileApiDevice.display_protection) || toNonEmptyString((modelPlain.display || {}).protection),
        features: toNonEmptyString(mobileApiDevice.display_features) || toNonEmptyString((modelPlain.display || {}).features),
      },
      platform: {
        ...(modelPlain.platform || {}),
        os: toNonEmptyString(mobileApiDevice.os) || toNonEmptyString((modelPlain.platform || {}).os),
        chipset: toNonEmptyString(mobileApiDevice.hardware) || toNonEmptyString((modelPlain.platform || {}).chipset),
        cpu: toNonEmptyString(mobileApiDevice.cpu) || toNonEmptyString((modelPlain.platform || {}).cpu),
        gpu: toNonEmptyString(mobileApiDevice.gpu) || toNonEmptyString((modelPlain.platform || {}).gpu),
      },
      memory: {
        ...(modelPlain.memory || {}),
        internal: memoryInternalFromApi.length > 0 ? memoryInternalFromApi : (modelPlain.memory || {}).internal || [],
        cardSlot: toNonEmptyString(mobileApiDevice.memory_card_slot) || toNonEmptyString((modelPlain.memory || {}).cardSlot),
      },
      rearCamera: {
        ...(modelPlain.rearCamera || {}),
        modules: toNonEmptyString(mobileApiDevice.main_camera) || toNonEmptyString((modelPlain.rearCamera || {}).modules),
        features: toNonEmptyString(mobileApiDevice.main_camera_features) || toNonEmptyString((modelPlain.rearCamera || {}).features),
        video: toNonEmptyString(mobileApiDevice.main_camera_video) || toNonEmptyString((modelPlain.rearCamera || {}).video),
      },
      frontCamera: {
        ...(modelPlain.frontCamera || {}),
        modules: toNonEmptyString(mobileApiDevice.selfie_camera) || toNonEmptyString((modelPlain.frontCamera || {}).modules),
        features: toNonEmptyString(mobileApiDevice.selfie_camera_features) || toNonEmptyString((modelPlain.frontCamera || {}).features),
        video: toNonEmptyString(mobileApiDevice.selfie_camera_video) || toNonEmptyString((modelPlain.frontCamera || {}).video),
      },
      audio: {
        ...(modelPlain.audio || {}),
        loudspeaker: toNonEmptyString(mobileApiDevice.loudspeaker) || toNonEmptyString((modelPlain.audio || {}).loudspeaker),
        jack3_5mm: toNonEmptyString(mobileApiDevice.jack) || toNonEmptyString((modelPlain.audio || {}).jack3_5mm),
      },
      connectivity: {
        ...(modelPlain.connectivity || {}),
        wlan: toNonEmptyString(mobileApiDevice.wlan) || toNonEmptyString((modelPlain.connectivity || {}).wlan),
        bluetooth: toNonEmptyString(mobileApiDevice.bluetooth) || toNonEmptyString((modelPlain.connectivity || {}).bluetooth),
        positioning: toNonEmptyString(mobileApiDevice.gps) || toNonEmptyString((modelPlain.connectivity || {}).positioning),
        nfc: toNonEmptyString(mobileApiDevice.nfc) || toNonEmptyString((modelPlain.connectivity || {}).nfc),
        radio: toNonEmptyString(mobileApiDevice.radio) || toNonEmptyString((modelPlain.connectivity || {}).radio),
        usb: toNonEmptyString(mobileApiDevice.usb) || toNonEmptyString((modelPlain.connectivity || {}).usb),
        infrared: toNonEmptyString(mobileApiDevice.infrared) || toNonEmptyString((modelPlain.connectivity || {}).infrared),
        other: toNonEmptyString(mobileApiDevice.connectivity_other) || toNonEmptyString((modelPlain.connectivity || {}).other),
      },
      features: {
        ...(modelPlain.features || {}),
        sensors: toNonEmptyString(mobileApiDevice.sensors) || toNonEmptyString((modelPlain.features || {}).sensors),
        special: splitCommaList(mobileApiDevice.special_features).length > 0
          ? splitCommaList(mobileApiDevice.special_features)
          : (modelPlain.features || {}).special || [],
      },
      battery: {
        ...(modelPlain.battery || {}),
        type: toNonEmptyString(mobileApiDevice.battery_type) || toNonEmptyString((modelPlain.battery || {}).type),
        charging: toNonEmptyString(mobileApiDevice.charging) || toNonEmptyString((modelPlain.battery || {}).charging),
        standbyTime: toNonEmptyString(mobileApiDevice.stand_by) || toNonEmptyString((modelPlain.battery || {}).standbyTime),
        talkTime: toNonEmptyString(mobileApiDevice.talk_time) || toNonEmptyString((modelPlain.battery || {}).talkTime),
        musicPlay: toNonEmptyString(mobileApiDevice.music_play) || toNonEmptyString((modelPlain.battery || {}).musicPlay),
      },
      other: {
        ...(modelPlain.other || {}),
        models: splitCommaList(mobileApiDevice.model_names).length > 0
          ? splitCommaList(mobileApiDevice.model_names)
          : (modelPlain.other || {}).models || [],
        sarValues: {
          ...((modelPlain.other || {}).sarValues || {}),
          head: toNonEmptyString(mobileApiDevice.sar_head) || toNonEmptyString(((modelPlain.other || {}).sarValues || {}).head),
          body: toNonEmptyString(mobileApiDevice.sar_body) || toNonEmptyString(((modelPlain.other || {}).sarValues || {}).body),
        },
        price: toNonEmptyString(mobileApiDevice.price) || toNonEmptyString((modelPlain.other || {}).price),
        releaseDate: toNonEmptyString(mobileApiDevice.release_date) || toNonEmptyString((modelPlain.other || {}).releaseDate),
        colors: nextColors.length > 0 ? nextColors : (modelPlain.other || {}).colors || [],
      },
    };

    if (!updateData.mobileApiMatchId) {
      delete updateData.mobileApiMatchId;
    }

    return updateData;
  }

  static async updateModelInformationFromMobileApi(options = {}, callbacks = {}) {
    try {
      const { onProgress, awaitDecision } = callbacks;
      const requestsPerSecond = Math.min(20, Math.max(1, Number(options.requestsPerSecond) || 2));
      const limit = Math.max(0, Number(options.limit) || 0);
      const onlyNotUpdated = Boolean(options.onlyNotUpdated);
      const selectedDeviceTypes = Array.isArray(options.deviceTypes) ? options.deviceTypes.filter(Boolean) : [];
      const selectedBrandIds = Array.isArray(options.brandIds) ? options.brandIds.filter(Boolean) : [];
      const selectedModelIds = Array.isArray(options.modelIds) ? options.modelIds.filter(Boolean) : [];

      const query = { isActive: true };
      if (selectedDeviceTypes.length > 0) {
        query.deviceType = { $in: selectedDeviceTypes };
      }
      if (selectedBrandIds.length > 0) {
        query.brandId = { $in: selectedBrandIds };
      }
      if (selectedModelIds.length > 0) {
        query._id = { $in: selectedModelIds };
      }
      if (onlyNotUpdated) {
        query.$or = [
          { mobileApiLastStatus: { $exists: false } },
          { mobileApiLastStatus: { $ne: 'updated' } },
        ];
      }

      let modelQuery = DeviceModel.find(query)
        .populate('brandId', 'name')
        .sort({ updatedAt: 1, name: 1 });

      if (limit > 0) {
        modelQuery = modelQuery.limit(limit);
      }

      const models = await modelQuery;
      const availableTypes = await DeviceType.find({ isActive: true }).lean();
      const apiKey = String(process.env.MOBILEAPI_KEY || '').trim();
      if (!apiKey) {
        throw new Error('MOBILEAPI_KEY is not configured. Please set it in your server environment.');
      }

      // Fast fail if the external API is unreachable or key is invalid.
      try {
        await DeviceService.fetchMobileApiCandidates('iphone', apiKey);
      } catch (connectionError) {
        const formattedConnectionError = DeviceService.formatMobileApiRequestError(connectionError);
        const statusText = formattedConnectionError.statusCode ? ` (HTTP ${formattedConnectionError.statusCode})` : '';
        throw new Error(`MobileAPI connection failed${statusText}: ${formattedConnectionError.message}`);
      }

      const delayMs = Math.ceil(1000 / requestsPerSecond);

      const results = [];
      let updated = 0;
      let noMatch = 0;
      let failed = 0;
      let servicesModified = 0;

      for (let index = 0; index < models.length; index += 1) {
        const model = models[index];
        const modelName = String(model.name || '').trim();
        const currentBrandName = String(model?.brandId?.name || '').trim();

        if (onProgress) {
          onProgress('progress', {
            current: index + 1,
            total: models.length,
            modelName,
            brandName: currentBrandName,
          });
        }

        if (!modelName) {
          failed += 1;
          const resultEntry = { modelId: String(model._id), modelName: '(leer)', status: 'failed', reason: 'Model name missing' };
          results.push(resultEntry);
          if (onProgress) onProgress('modelResult', resultEntry);
          continue;
        }

        try {
          const candidates = await DeviceService.fetchMobileApiCandidates(modelName, apiKey);
          const bestMatch = DeviceService.pickBestMobileApiDevice(candidates, modelName, currentBrandName);

          if (!bestMatch) {
            noMatch += 1;
            await DeviceModel.updateOne(
              { _id: model._id },
              { $set: { mobileApiLastStatus: 'no_match', mobileApiUpdatedAt: new Date() } }
            );
            const resultEntry = { modelId: String(model._id), modelName, status: 'no_match' };
            results.push(resultEntry);
            if (onProgress) onProgress('modelResult', resultEntry);
          } else {
            const certainty = Number.parseFloat(String(bestMatch.match_certainty || '0').replace('%', '')) || 0;
            const apiMatchName = String(bestMatch.name || '').trim();
            const isAmbiguous = certainty < 60;

            if (isAmbiguous && awaitDecision) {
              const decision = await awaitDecision({
                modelId: String(model._id),
                modelName,
                brandName: currentBrandName,
                apiMatchName,
                apiMatchId: String(bestMatch.id || ''),
                certainty,
                candidatesCount: Array.isArray(candidates) ? candidates.length : 0,
              });

              if (decision === 'skip') {
                noMatch += 1;
                await DeviceModel.updateOne(
                  { _id: model._id },
                  { $set: { mobileApiLastStatus: 'skipped', mobileApiUpdatedAt: new Date() } }
                );
                const resultEntry = { modelId: String(model._id), modelName, status: 'skipped', reason: 'Vom Benutzer übersprungen (unsicherer Treffer)' };
                results.push(resultEntry);
                if (onProgress) onProgress('modelResult', resultEntry);
                continue;
              }
            }

            const resolvedType = DeviceService.resolveDeviceTypeKey(bestMatch.device_type, availableTypes) || model.deviceType;

            let resolvedBrandId = model.brandId?._id || model.brandId;
            const targetBrandName = String(bestMatch.manufacturer_name || '').trim();
            if (targetBrandName && (!currentBrandName || toComparable(targetBrandName) !== toComparable(currentBrandName))) {
              const matchedBrand = await DeviceBrand.findOne({
                name: { $regex: `^${targetBrandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
                isActive: true,
              })
                .select('_id name')
                .lean();

              if (matchedBrand?._id) {
                resolvedBrandId = matchedBrand._id;
              }
            }

            const updateData = await DeviceService.buildMobileApiModelUpdate(model, bestMatch, resolvedBrandId, resolvedType);

            const previousModelName = String(model.name || '').trim();
            const previousBrandName = currentBrandName;
            const previousDeviceType = String(model.deviceType || '').trim();

            const updatedModel = await DeviceModel.findByIdAndUpdate(
              model._id,
              { $set: updateData },
              { new: true, runValidators: true }
            ).populate('brandId', 'name');

            const nextModelName = String(updatedModel?.name || '').trim();
            const nextBrandName = String(updatedModel?.brandId?.name || previousBrandName || '').trim();
            const nextDeviceType = String(updatedModel?.deviceType || previousDeviceType || '').trim();

            const cascadeResult = await DeviceService.cascadeServiceModelInfoUpdate({
              previousModelName,
              nextModelName,
              previousBrandName,
              nextBrandName,
              previousDeviceType,
              nextDeviceType,
            });

            servicesModified += Number(cascadeResult.modifiedCount || 0);
            updated += 1;

            const resultEntry = {
              modelId: String(model._id),
              modelName,
              status: 'updated',
              matchedMobileApiId: Number(bestMatch.id) || null,
              apiMatchName: String(bestMatch.name || '').trim(),
              certainty: Number.parseFloat(String(bestMatch.match_certainty || '0').replace('%', '')) || 0,
              servicesUpdated: Number(cascadeResult.modifiedCount || 0),
            };
            results.push(resultEntry);
            if (onProgress) onProgress('modelResult', resultEntry);
          }
        } catch (error) {
          const requestError = DeviceService.formatMobileApiRequestError(error);
          failed += 1;
          await DeviceModel.updateOne(
            { _id: model._id },
            { $set: { mobileApiLastStatus: 'failed', mobileApiUpdatedAt: new Date() } }
          );
          const resultEntry = {
            modelId: String(model._id),
            modelName,
            status: 'failed',
            reason: requestError.message,
            statusCode: requestError.statusCode,
            errorCode: requestError.errorCode,
          };
          results.push(resultEntry);
          if (onProgress) onProgress('modelResult', resultEntry);
        }

        if (index < models.length - 1 && delayMs > 0) {
          await wait(delayMs);
        }
      }

      const summary = {
        total: models.length,
        updated,
        noMatch,
        failed,
        servicesModified,
        requestsPerSecond,
        errors: results.filter((item) => item.status === 'failed'),
        results,
      };

      if (onProgress) onProgress('summary', summary);

      return summary;
    } catch (error) {
      console.error('DeviceService: Error updating model information from mobile API:', error);
      throw error;
    }
  }

  static async backfillServiceLinksForModels(options = {}) {
    try {
      const limit = Math.max(0, Number(options.limit) || 0);
      const selectedDeviceTypes = Array.isArray(options.deviceTypes) ? options.deviceTypes.filter(Boolean) : [];
      const selectedBrandIds = Array.isArray(options.brandIds) ? options.brandIds.filter(Boolean) : [];
      const selectedModelIds = Array.isArray(options.modelIds) ? options.modelIds.filter(Boolean) : [];

      const query = { isActive: true };
      if (selectedDeviceTypes.length > 0) {
        query.deviceType = { $in: selectedDeviceTypes };
      }
      if (selectedBrandIds.length > 0) {
        query.brandId = { $in: selectedBrandIds };
      }
      if (selectedModelIds.length > 0) {
        query._id = { $in: selectedModelIds };
      }

      let modelQuery = DeviceModel.find(query)
        .populate('brandId', 'name')
        .sort({ updatedAt: -1, name: 1 });

      if (limit > 0) {
        modelQuery = modelQuery.limit(limit);
      }

      const models = await modelQuery;
      const results = [];
      let modelsProcessed = 0;
      let modelsSkipped = 0;
      let servicesMatched = 0;
      let servicesModified = 0;

      for (const model of models) {
        const modelName = String(model?.name || '').trim();
        const brandName = String(model?.brandId?.name || '').trim();
        const modelDeviceType = String(model?.deviceType || '').trim();

        if (!modelName || !brandName || !modelDeviceType) {
          modelsSkipped += 1;
          results.push({
            modelId: String(model?._id || ''),
            modelName: modelName || '(leer)',
            status: 'skipped',
            reason: 'Missing model, brand or device type',
          });
          continue;
        }

        const normalizedType = modelDeviceType.toLowerCase();
        const compatibleTypes = [modelDeviceType];
        if (normalizedType === 'wearable' && !compatibleTypes.includes('smartwatch')) {
          compatibleTypes.push('smartwatch');
        }
        if (normalizedType === 'smartwatch' && !compatibleTypes.includes('wearable')) {
          compatibleTypes.push('wearable');
        }

        const modelRegex = DeviceService.buildExactRegex(modelName);
        const brandRegex = DeviceService.buildExactRegex(brandName);
        const serviceFilter = {
          isActive: true,
          $or: [{ modelPrecise: modelRegex }, { model: modelRegex }],
          $and: [{ $or: [{ manufacturerPrecise: brandRegex }, { manufacturer: brandRegex }] }],
        };

        const update = {
          $set: {
            model: modelName,
            modelPrecise: modelName,
            manufacturer: brandName,
            manufacturerPrecise: brandName,
            deviceType: modelDeviceType,
          },
          $addToSet: {
            deviceTypes: { $each: compatibleTypes },
            supportedDeviceTypes: { $each: compatibleTypes },
          },
        };

        const result = await Service.updateMany(serviceFilter, update);

        const matchedCount = Number(result?.matchedCount || 0);
        const modifiedCount = Number(result?.modifiedCount || 0);

        servicesMatched += matchedCount;
        servicesModified += modifiedCount;
        modelsProcessed += 1;

        results.push({
          modelId: String(model._id),
          modelName,
          brandName,
          deviceType: modelDeviceType,
          compatibleTypes,
          matchedCount,
          modifiedCount,
          status: modifiedCount > 0 ? 'updated' : 'no_changes',
        });
      }

      return {
        totalModels: models.length,
        modelsProcessed,
        modelsSkipped,
        servicesMatched,
        servicesModified,
        results,
      };
    } catch (error) {
      console.error('DeviceService: Error during service-link backfill:', error);
      throw error;
    }
  }

  // Update brand (admin only)
  static async updateBrand(brandId, updateData) {
    try {
      const brand = await DeviceBrand.findOne({ _id: brandId, isActive: true });

      if (!brand) {
        throw new Error('Brand not found');
      }

      Object.keys(updateData).forEach((key) => {
        brand[key] = updateData[key];
      });

      return await brand.save();
    } catch (error) {
      console.error('DeviceService: Error updating brand:', error);
      throw error;
    }
  }

  // Search devices by query string
  static async searchDevices(searchQuery) {
    try {
      if (!searchQuery || searchQuery.trim() === '') {
        return [];
      }

      const query = searchQuery.toLowerCase().trim();

      const results = await DeviceModel.find({
        isActive: true,
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { deviceType: { $regex: query, $options: 'i' } },
          { modelNumbers: { $regex: query, $options: 'i' } },
          { 'other.modelNumbers': { $regex: query, $options: 'i' } },
          { 'other.models': { $regex: query, $options: 'i' } },
        ],
      })
        .limit(20)
        .populate('brandId', 'name logo')
        .sort({ name: 1 })
        .lean();

      const brandMatches = await DeviceBrand.find({
        name: { $regex: query, $options: 'i' },
        isActive: true,
      }).lean();

      let brandModelResults = [];
      if (brandMatches.length > 0) {
        const brandIds = brandMatches.map((b) => b._id);
        brandModelResults = await DeviceModel.find({ brandId: { $in: brandIds }, isActive: true })
          .limit(20)
          .populate('brandId', 'name logo')
          .sort({ name: 1 })
          .lean();
      }

      const allResults = [...results, ...brandModelResults];
      const uniqueResults = Array.from(new Map(allResults.map((r) => [r._id.toString(), r])).values());

      return uniqueResults
        .filter((model) => model.name && model.deviceType)
        .map((model) => {
          let imageUrl = model.image || null;
          if (!imageUrl && model.images && Array.isArray(model.images) && model.images.length > 0) {
            imageUrl = model.images[0].url || model.images[0].base64 || null;
          }

          return {
            _id: model._id,
            name: model.name || 'Unknown Device',
            deviceType: model.deviceType || 'unknown',
            manufacturer: (model.brandId && model.brandId.name) || 'Unknown',
            manufacturerId: (model.brandId && model.brandId._id) || null,
            image: imageUrl,
            displayName: `${model.deviceType || 'unknown'} • ${(model.brandId && model.brandId.name) || 'Unknown'} • ${model.name || 'Unknown Device'}`,
          };
        });
    } catch (error) {
      console.error('DeviceService: Error searching devices:', error);
      throw error;
    }
  }

  // Hard delete ALL brands AND their associated device models (used by admin bulk-delete UI).
  // Cascades to DeviceModel because models reference brandId.
  static async deleteAllBrands() {
    try {
      console.log('DeviceService: Hard deleting ALL brands and associated models');
      const modelsResult = await DeviceModel.deleteMany({});
      const brandsResult = await DeviceBrand.deleteMany({});
      console.log(`DeviceService: Deleted ${brandsResult.deletedCount} brands and ${modelsResult.deletedCount} models`);
      return {
        deletedCount: brandsResult.deletedCount || 0,
        deletedModels: modelsResult.deletedCount || 0,
      };
    } catch (error) {
      console.error('DeviceService: Error deleting all brands:', error);
      throw error;
    }
  }
}

module.exports = DeviceService;
