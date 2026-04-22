const AddOnService = require('../models/AddOnService.js');

class AddOnServiceService {
  static async list(filters = {}) {
    try {
      console.log('AddOnServiceService: Listing add-on services with filters:', filters);

      const query = { isActive: true };

      // Add category filter if provided
      if (filters.category) {
        query.category = filters.category;
      }

      // Add device type filter if provided
      if (filters.deviceType) {
        query['compatibility.deviceType'] = filters.deviceType;
      }

      // Extract pagination parameters with defaults
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 10;
      const skip = (page - 1) * limit;

      // Extract sorting parameters with defaults
      const sortBy = filters.sortBy || 'createdAt';
      const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
      const sortObj = { [sortBy]: sortOrder };

      console.log(`AddOnServiceService: Pagination - page: ${page}, limit: ${limit}, skip: ${skip}`);
      console.log(`AddOnServiceService: Sorting - sortBy: ${sortBy}, sortOrder: ${sortOrder}`);

      // Get total count for pagination
      const total = await AddOnService.countDocuments(query);
      console.log(`AddOnServiceService: Total matching documents: ${total}`);

      // Fetch paginated and sorted results
      const addOnServices = await AddOnService.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limit);

      console.log(`AddOnServiceService: Returning ${addOnServices.length} add-on services`);

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        addOnServices,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage,
          hasPrevPage
        }
      };
    } catch (err) {
      console.error('AddOnServiceService: Error listing add-on services:', err);
      throw new Error(`Database error while listing add-on services: ${err.message}`);
    }
  }

  static async get(id) {
    try {
      console.log('AddOnServiceService: Getting add-on service with ID:', id);

      const addOnService = await AddOnService.findOne({ _id: id, isActive: true });

      if (!addOnService) {
        console.log('AddOnServiceService: Add-on service not found');
        return null;
      }

      console.log('AddOnServiceService: Add-on service found:', addOnService.name);
      return addOnService;
    } catch (err) {
      console.error('AddOnServiceService: Error getting add-on service:', err);
      throw new Error(`Database error while getting add-on service: ${err.message}`);
    }
  }

  static async create(addOnServiceData) {
    try {
      console.log('AddOnServiceService: Creating add-on service:', addOnServiceData.name);

      const addOnService = new AddOnService(addOnServiceData);
      await addOnService.save();

      console.log('AddOnServiceService: Add-on service created successfully with ID:', addOnService._id);
      return addOnService;
    } catch (err) {
      console.error('AddOnServiceService: Error creating add-on service:', err);
      throw new Error(`Database error while creating add-on service: ${err.message}`);
    }
  }

  static async update(id, updateData) {
    try {
      console.log('AddOnServiceService: Updating add-on service with ID:', id);

      const addOnService = await AddOnService.findOneAndUpdate(
        { _id: id, isActive: true },
        updateData,
        { new: true, runValidators: true }
      );

      if (!addOnService) {
        console.log('AddOnServiceService: Add-on service not found for update');
        return null;
      }

      console.log('AddOnServiceService: Add-on service updated successfully');
      return addOnService;
    } catch (err) {
      console.error('AddOnServiceService: Error updating add-on service:', err);
      throw new Error(`Database error while updating add-on service: ${err.message}`);
    }
  }

  static async delete(id) {
    try {
      console.log('AddOnServiceService: Soft deleting add-on service with ID:', id);

      const addOnService = await AddOnService.findOneAndUpdate(
        { _id: id },
        { isActive: false },
        { new: true }
      );

      if (!addOnService) {
        console.log('AddOnServiceService: Add-on service not found for deletion');
        return false;
      }

      console.log('AddOnServiceService: Add-on service soft deleted successfully');
      return true;
    } catch (err) {
      console.error('AddOnServiceService: Error deleting add-on service:', err);
      throw new Error(`Database error while deleting add-on service: ${err.message}`);
    }
  }

  static async deleteAll() {
    try {
      console.log('AddOnServiceService: Hard deleting ALL add-on services');
      const result = await AddOnService.deleteMany({});
      console.log(`AddOnServiceService: Deleted ${result.deletedCount} add-on services`);
      return result.deletedCount || 0;
    } catch (err) {
      console.error('AddOnServiceService: Error deleting all add-on services:', err);
      throw new Error(`Database error while deleting all add-on services: ${err.message}`);
    }
  }
}

module.exports = AddOnServiceService;