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

      const addOnServices = await AddOnService.find(query).sort({ popularity: -1, name: 1 });
      console.log(`AddOnServiceService: Found ${addOnServices.length} add-on services`);

      return addOnServices;
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
}

module.exports = AddOnServiceService;