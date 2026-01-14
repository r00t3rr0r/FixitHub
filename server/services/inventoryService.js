const Inventory = require('../models/Inventory');

class InventoryService {
  // Create new inventory item
  static async create(itemData) {
    console.log('InventoryService: Creating new inventory item:', itemData.itemName);

    try {
      // Ensure at least one version is provided
      if (!itemData.versions || itemData.versions.length === 0) {
        throw new Error('At least one version is required');
      }

      // Generate version IDs if not provided
      itemData.versions.forEach((version, index) => {
        if (!version.versionId) {
          version.versionId = `${itemData.sku || 'TEMP'}-V${index + 1}`;
        }
      });

      const inventory = new Inventory(itemData);
      const savedInventory = await inventory.save();

      console.log('InventoryService: Inventory item created successfully with ID:', savedInventory._id);
      return savedInventory;
    } catch (error) {
      console.error('InventoryService: Error creating inventory item:', error);
      throw error;
    }
  }

  // Get all inventory items with filtering and pagination
  static async getAll(filters = {}) {
    console.log('InventoryService: Getting inventory items with filters:', filters);

    try {
      const query = { isActive: true };

      // Apply filters
      if (filters.search) {
        query.$or = [
          { itemName: { $regex: filters.search, $options: 'i' } },
          { sku: { $regex: filters.search, $options: 'i' } },
          { brand: { $regex: filters.search, $options: 'i' } },
          { manufacturer: { $regex: filters.search, $options: 'i' } }
        ];
      }

      if (filters.category && filters.category !== 'all') {
        query.category = filters.category;
      }

      if (filters.brand && filters.brand !== 'all') {
        query.brand = filters.brand;
      }

      if (filters.lowStock === 'true') {
        query['versions.lowStockAlert'] = true;
      }

      // Pagination
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 20;
      const skip = (page - 1) * limit;

      // Sorting
      const sortBy = filters.sortBy || 'lastUpdated';
      const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder;

      console.log('InventoryService: Sorting by', sortBy, 'in', sortOrder === 1 ? 'ascending' : 'descending', 'order');

      const items = await Inventory.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);

      const totalItems = await Inventory.countDocuments(query);
      const totalPages = Math.ceil(totalItems / limit);

      // Calculate total inventory value and low stock count
      const allItems = await Inventory.find({ isActive: true });
      let totalValue = 0;
      let lowStockCount = 0;

      allItems.forEach(item => {
        item.versions.forEach(version => {
          totalValue += version.quantity * version.unitCost;
          if (version.lowStockAlert) {
            lowStockCount++;
          }
        });
      });

      console.log('InventoryService: Found', items.length, 'items out of', totalItems, 'total');

      return {
        items,
        totalPages,
        currentPage: page,
        totalItems,
        totalValue,
        lowStockCount
      };
    } catch (error) {
      console.error('InventoryService: Error getting inventory items:', error);
      throw error;
    }
  }

  // Get inventory item by ID
  static async getById(itemId) {
    console.log('InventoryService: Getting inventory item by ID:', itemId);

    try {
      const item = await Inventory.findById(itemId);

      if (!item) {
        throw new Error('Inventory item not found');
      }

      console.log('InventoryService: Inventory item found:', item.itemName);
      return item;
    } catch (error) {
      console.error('InventoryService: Error getting inventory item by ID:', error);
      throw error;
    }
  }

  // Update inventory item quantity
  static async updateQuantity(itemId, versionId, quantity, operation, reason = '') {
    console.log('InventoryService: Updating quantity for item:', itemId, 'version:', versionId);

    try {
      const item = await Inventory.findById(itemId);

      if (!item) {
        throw new Error('Inventory item not found');
      }

      const version = item.versions.id(versionId);
      if (!version) {
        throw new Error('Version not found');
      }

      const oldQuantity = version.quantity;
      let newQuantity;

      switch (operation) {
        case 'add':
          newQuantity = oldQuantity + quantity;
          break;
        case 'subtract':
          newQuantity = Math.max(0, oldQuantity - quantity);
          break;
        case 'set':
          newQuantity = quantity;
          break;
        default:
          throw new Error('Invalid operation. Use add, subtract, or set');
      }

      version.quantity = newQuantity;
      version.lowStockAlert = newQuantity <= version.minStockLevel;

      // Update status based on quantity
      if (newQuantity === 0) {
        version.status = 'out-of-stock';
      } else if (version.status === 'out-of-stock' && newQuantity > 0) {
        version.status = 'active';
      }

      const updatedItem = await item.save();

      console.log('InventoryService: Quantity updated from', oldQuantity, 'to', newQuantity);
      return updatedItem;
    } catch (error) {
      console.error('InventoryService: Error updating quantity:', error);
      throw error;
    }
  }

  // Get low stock items
  static async getLowStockItems() {
    console.log('InventoryService: Getting low stock items');

    try {
      const items = await Inventory.find({
        isActive: true,
        'versions.lowStockAlert': true
      });

      const lowStockItems = [];

      items.forEach(item => {
        item.versions.forEach(version => {
          if (version.lowStockAlert) {
            lowStockItems.push({
              _id: item._id,
              itemName: item.itemName,
              sku: item.sku,
              category: item.category,
              brand: item.brand,
              version: {
                versionType: version.versionType,
                versionId: version.versionId,
                quantity: version.quantity,
                minStockLevel: version.minStockLevel,
                storageLocation: version.storageLocation
              }
            });
          }
        });
      });

      console.log('InventoryService: Found', lowStockItems.length, 'low stock items');
      return lowStockItems;
    } catch (error) {
      console.error('InventoryService: Error getting low stock items:', error);
      throw error;
    }
  }

  // Update inventory item
  static async update(itemId, updateData) {
    console.log('InventoryService: Updating inventory item:', itemId);

    try {
      const updatedItem = await Inventory.findByIdAndUpdate(
        itemId,
        { ...updateData, lastUpdated: new Date() },
        { new: true, runValidators: true }
      );

      if (!updatedItem) {
        throw new Error('Inventory item not found');
      }

      console.log('InventoryService: Inventory item updated successfully');
      return updatedItem;
    } catch (error) {
      console.error('InventoryService: Error updating inventory item:', error);
      throw error;
    }
  }

  // Delete inventory item (soft delete)
  static async delete(itemId) {
    console.log('InventoryService: Deleting inventory item:', itemId);

    try {
      const deletedItem = await Inventory.findByIdAndUpdate(
        itemId,
        { isActive: false, lastUpdated: new Date() },
        { new: true }
      );

      if (!deletedItem) {
        throw new Error('Inventory item not found');
      }

      console.log('InventoryService: Inventory item deleted successfully');
      return deletedItem;
    } catch (error) {
      console.error('InventoryService: Error deleting inventory item:', error);
      throw error;
    }
  }
}

module.exports = InventoryService;