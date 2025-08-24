const Service = require('../models/Service.js');

class ServiceService {
  static async list(filters = {}) {
    try {
      console.log('ServiceService: Listing services with filters:', filters);
      
      const query = { isActive: true };
      
      // Add category filter if provided
      if (filters.category) {
        query.category = filters.category;
      }
      
      // Add device type filter if provided
      if (filters.deviceType) {
        query.deviceTypes = { $in: [filters.deviceType] };
      }
      
      const services = await Service.find(query).sort({ popularity: -1, name: 1 });
      console.log(`ServiceService: Found ${services.length} services`);
      
      return services;
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
}

module.exports = ServiceService;