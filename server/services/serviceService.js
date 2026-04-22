const Service = require('../models/Service.js');

class ServiceService {
  static async list(filters = {}, pagination = {}, sorting = {}) {
    try {
      console.log('ServiceService: Listing services with filters:', filters, 'pagination:', pagination, 'sorting:', sorting);

      const query = { isActive: true };

      // Add category filter if provided
      if (filters.category) {
        query.category = filters.category;
      }

      // Add device type filter if provided
      if (filters.deviceType) {
        query.deviceTypes = { $in: [filters.deviceType] };
      }

      // Filter by precise manufacturer (case-insensitive exact match)
      if (filters.manufacturerPrecise) {
        query.manufacturerPrecise = new RegExp(
          `^${String(filters.manufacturerPrecise).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          'i'
        );
      }

      // Filter by precise model. When set, return services that match this model
      // OR generic services with no model assigned (so a generic "Diagnose" still shows up).
      if (filters.modelPrecise) {
        const escaped = String(filters.modelPrecise).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
          { modelPrecise: new RegExp(`^${escaped}$`, 'i') },
          { modelPrecise: { $in: ['', null] } }
        ];
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
        Service.find(query).sort(sortObj).skip(skip).limit(limit),
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
