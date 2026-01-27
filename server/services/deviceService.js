const { DeviceBrand, DeviceModel } = require('../models/Device');

class DeviceService {
  // Get all brands
  static async getBrands() {
    try {
      console.log('DeviceService: Getting all brands');

      const brands = await DeviceBrand.find({ isActive: true })
        .sort({ name: 1 })
        .lean(); // Add .lean() to get plain JavaScript objects instead of Mongoose documents

      console.log('DeviceService: Raw brands from database:', brands);

      // Get model count for each brand
      for (let brand of brands) {
        const modelCount = await DeviceModel.countDocuments({
          brandId: brand._id,
          isActive: true
        });
        brand.modelCount = modelCount; // Now this will work because brands are plain objects
      }

      console.log(`DeviceService: Found ${brands.length} brands`);
      console.log('DeviceService: Brands with model counts:', brands);
      return brands;
    } catch (error) {
      console.error('DeviceService: Error getting brands:', error);
      throw error;
    }
  }

  // Get brand by ID
  static async getBrandById(brandId) {
    try {
      console.log('DeviceService: Getting brand by ID:', brandId);
      
      const brand = await DeviceBrand.findOne({ _id: brandId, isActive: true });
      
      if (!brand) {
        throw new Error('Brand not found');
      }

      console.log('DeviceService: Brand found:', brand.name);
      return brand;
    } catch (error) {
      console.error('DeviceService: Error getting brand by ID:', error);
      throw error;
    }
  }

  // Get models by brand
  static async getModelsByBrand(brandId) {
    try {
      console.log('DeviceService: Getting models for brand:', brandId);
      
      const models = await DeviceModel.find({ 
        brandId, 
        isActive: true 
      })
        .populate('brandId', 'name logo')
        .sort({ name: 1 });

      console.log(`DeviceService: Found ${models.length} models for brand`);
      return models;
    } catch (error) {
      console.error('DeviceService: Error getting models by brand:', error);
      throw error;
    }
  }

  // Get model by ID
  static async getModelById(modelId) {
    try {
      console.log('DeviceService: Getting model by ID:', modelId);
      
      const model = await DeviceModel.findOne({ _id: modelId, isActive: true })
        .populate('brandId', 'name logo');
      
      if (!model) {
        throw new Error('Model not found');
      }

      console.log('DeviceService: Model found:', model.name);
      return model;
    } catch (error) {
      console.error('DeviceService: Error getting model by ID:', error);
      throw error;
    }
  }

  // Get device types with counts
  static async getDeviceTypes() {
    try {
      console.log('DeviceService: Getting device types');
      
      const deviceTypes = await DeviceModel.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$deviceType',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const formattedTypes = deviceTypes.map(type => ({
        _id: type._id,
        name: type._id.charAt(0).toUpperCase() + type._id.slice(1).replace('-', ' '),
        count: type.count
      }));

      console.log(`DeviceService: Found ${formattedTypes.length} device types`);
      return formattedTypes;
    } catch (error) {
      console.error('DeviceService: Error getting device types:', error);
      throw error;
    }
  }

  // Get manufacturers by device type
  static async getManufacturersByDeviceType(deviceType) {
    try {
      console.log('DeviceService: Getting manufacturers for device type:', deviceType);
      
      const manufacturers = await DeviceModel.aggregate([
        { 
          $match: { 
            deviceType, 
            isActive: true 
          } 
        },
        {
          $lookup: {
            from: 'devicebrands',
            localField: 'brandId',
            foreignField: '_id',
            as: 'brand'
          }
        },
        { $unwind: '$brand' },
        {
          $group: {
            _id: '$brand._id',
            name: { $first: '$brand.name' },
            deviceType: { $first: '$deviceType' },
            count: { $sum: 1 }
          }
        },
        { $sort: { name: 1 } }
      ]);

      console.log(`DeviceService: Found ${manufacturers.length} manufacturers for device type`);
      return manufacturers;
    } catch (error) {
      console.error('DeviceService: Error getting manufacturers by device type:', error);
      throw error;
    }
  }

  // Get models by type and manufacturer
  static async getModelsByTypeAndManufacturer(deviceType, manufacturerId) {
    try {
      console.log('DeviceService: Getting models for type and manufacturer:', deviceType, manufacturerId);
      
      const models = await DeviceModel.find({
        deviceType,
        brandId: manufacturerId,
        isActive: true
      })
        .populate('brandId', 'name logo')
        .sort({ name: 1 });

      const formattedModels = models.map(model => ({
        _id: model._id,
        name: model.name,
        manufacturer: model.brandId.name,
        brandId: model.brandId._id,  // Include brandId for edit functionality
        deviceType: model.deviceType,
        image: model.image || '',
        // Legacy specifications field (backward compatibility)
        specifications: model.specifications || {},
        // Comprehensive specification sections
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
        other: model.other || { models: [], sarValues: {}, colors: [] },
        count: 1 // This could be enhanced to show actual usage count
      }));

      console.log(`DeviceService: Found ${formattedModels.length} models`);
      return formattedModels;
    } catch (error) {
      console.error('DeviceService: Error getting models by type and manufacturer:', error);
      throw error;
    }
  }

  // Create brand (admin only)
  static async createBrand(brandData) {
    try {
      console.log('DeviceService: Creating brand:', brandData.name);
      console.log('DeviceService: Brand data received:', brandData);

      const brand = new DeviceBrand(brandData);
      const savedBrand = await brand.save();

      console.log('DeviceService: Brand created successfully:', savedBrand);
      return savedBrand;
    } catch (error) {
      console.error('DeviceService: Error creating brand:', error);
      throw error;
    }
  }

  // Create model (admin only)
  static async createModel(modelData) {
    try {
      console.log('DeviceService: Creating model:', modelData.name);

      const model = new DeviceModel(modelData);
      const savedModel = await model.save();

      console.log('DeviceService: Model created successfully');
      return savedModel;
    } catch (error) {
      console.error('DeviceService: Error creating model:', error);
      throw error;
    }
  }

  // Update model (admin only)
  static async updateModel(modelId, updateData) {
    try {
      console.log('DeviceService: Updating model:', modelId);
      console.log('DeviceService: Update data:', updateData);

      // Validate required fields if they are being updated
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

      // Helper function to deeply merge objects
      const deepMerge = (target, source) => {
        for (const key in source) {
          if (source.hasOwnProperty(key)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
              // For nested objects, merge recursively
              if (!target[key] || typeof target[key] !== 'object') {
                target[key] = {};
              }
              deepMerge(target[key], source[key]);
            } else {
              // For primitive values and arrays, directly assign
              target[key] = source[key];
            }
          }
        }
      };

      // Update fields with deep merge for nested objects
      Object.keys(updateData).forEach(key => {
        if (updateData[key] && typeof updateData[key] === 'object' && !Array.isArray(updateData[key]) &&
            ['network', 'physical', 'display', 'platform', 'memory', 'rearCamera', 'frontCamera',
             'audio', 'connectivity', 'features', 'battery', 'other'].includes(key)) {
          // Deep merge for specification categories
          if (!model[key]) {
            model[key] = {};
          }
          deepMerge(model[key], updateData[key]);
        } else {
          // Direct assignment for simple fields and arrays
          model[key] = updateData[key];
        }
      });

      const updatedModel = await model.save();

      console.log('DeviceService: Model updated successfully');
      return updatedModel;
    } catch (error) {
      console.error('DeviceService: Error updating model:', error);
      throw error;
    }
  }

  // Update brand (admin only)
  static async updateBrand(brandId, updateData) {
    try {
      console.log('DeviceService: Updating brand:', brandId);
      console.log('DeviceService: Update data:', updateData);

      const brand = await DeviceBrand.findOne({ _id: brandId, isActive: true });

      if (!brand) {
        throw new Error('Brand not found');
      }

      // Update fields
      Object.keys(updateData).forEach(key => {
        brand[key] = updateData[key];
      });

      const updatedBrand = await brand.save();

      console.log('DeviceService: Brand updated successfully');
      return updatedBrand;
    } catch (error) {
      console.error('DeviceService: Error updating brand:', error);
      throw error;
    }
  }

  // Search devices by query string (searches across type, manufacturer, and model)
  static async searchDevices(searchQuery) {
    try {
      if (!searchQuery || searchQuery.trim() === '') {
        console.log('DeviceService: Empty search query, returning empty results');
        return [];
      }

      const query = searchQuery.toLowerCase().trim();
      console.log('DeviceService: Searching devices with query:', query);

      // Search across device models and their brands
      const results = await DeviceModel.find(
        {
          isActive: true,
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { deviceType: { $regex: query, $options: 'i' } }
          ]
        }
      )
        .limit(20)
        .populate('brandId', 'name logo')
        .sort({ name: 1 })
        .lean();

      // Also search by brand name
      const brandMatches = await DeviceBrand.find(
        { name: { $regex: query, $options: 'i' }, isActive: true }
      )
        .lean();

      let brandModelResults = [];
      if (brandMatches.length > 0) {
        const brandIds = brandMatches.map(b => b._id);
        brandModelResults = await DeviceModel.find(
          { brandId: { $in: brandIds }, isActive: true }
        )
          .limit(20)
          .populate('brandId', 'name logo')
          .sort({ name: 1 })
          .lean();
      }

      // Combine and deduplicate results
      const allResults = [...results, ...brandModelResults];
      const uniqueResults = Array.from(
        new Map(allResults.map(r => [r._id.toString(), r])).values()
      );

      // Format results for frontend consumption
      const formattedResults = uniqueResults
        .filter(model => {
          // Ensure we have required fields
          if (!model.name || !model.deviceType) {
            console.log('DeviceService: Filtering out incomplete model:', {
              _id: model._id,
              name: model.name,
              deviceType: model.deviceType,
              brandId: model.brandId
            });
            return false;
          }
          return true;
        })
        .map(model => ({
          _id: model._id,
          name: model.name || 'Unknown Device',
          deviceType: model.deviceType || 'unknown',
          manufacturer: (model.brandId && model.brandId.name) || 'Unknown',
          manufacturerId: (model.brandId && model.brandId._id) || null,
          displayName: `${model.deviceType || 'unknown'} • ${(model.brandId && model.brandId.name) || 'Unknown'} • ${model.name || 'Unknown Device'}`
        }));

      console.log(`DeviceService: Found ${formattedResults.length} matching devices after filtering`);
      if (formattedResults.length > 0) {
        console.log('DeviceService: First result sample:', formattedResults[0]);
      }
      return formattedResults;
    } catch (error) {
      console.error('DeviceService: Error searching devices:', error);
      throw error;
    }
  }
}

module.exports = DeviceService;