const { DeviceBrand, DeviceModel, DeviceType } = require('../models/Device');

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

class DeviceService {
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

      const model = await DeviceModel.findOne({ _id: modelId, isActive: true });

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

      return await model.save();
    } catch (error) {
      console.error('DeviceService: Error updating model:', error);
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
          let imageUrl = null;
          if (model.images && Array.isArray(model.images) && model.images.length > 0) {
            imageUrl = model.images[0].url || model.images[0].base64 || null;
          } else if (model.image) {
            imageUrl = model.image;
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
}

module.exports = DeviceService;
