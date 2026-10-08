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
      let savedInventory;
      try {
        savedInventory = await inventory.save();
      } catch (error) {
        // Two creates at the same moment can compute the same SKU; retry once with a fresh one
        if (error && error.code === 11000 && error.keyPattern && error.keyPattern.sku && !itemData.sku) {
          inventory.sku = undefined;
          savedInventory = await inventory.save();
        } else {
          throw error;
        }
      }

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
        // Escape the input: characters like "(" would otherwise make the regex invalid (500)
        const search = String(filters.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
          { itemName: { $regex: search, $options: 'i' } },
          { sku: { $regex: search, $options: 'i' } },
          { model: { $regex: search, $options: 'i' } },
          { manufacturer: { $regex: search, $options: 'i' } }
        ];
      }

      if (typeof filters.category === 'string' && filters.category && filters.category !== 'all') {
        query.category = filters.category;
      }

      if (typeof filters.model === 'string' && filters.model && filters.model !== 'all') {
        query.model = filters.model;
      }

      if (filters.lowStock === 'true') {
        query['versions.lowStockAlert'] = true;
      }

      // Pagination
      const page = Math.max(1, parseInt(filters.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 20));
      const skip = (page - 1) * limit;

      // Sorting: column keys of the parts table -> stored fields (unknown keys keep the default order)
      const sortFields = {
        lastUpdated: 'lastUpdated',
        partNumber: 'sku',
        itemName: 'itemName',
        category: 'category',
        model: 'model',
        location: 'versions.0.storageLocation'
      };
      const sortBy = Object.prototype.hasOwnProperty.call(sortFields, filters.sortBy) ? sortFields[filters.sortBy] : 'lastUpdated';
      const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
      const sortOptions = { [sortBy]: sortOrder, _id: sortOrder };

      console.log('InventoryService: Sorting by', sortBy, 'in', sortOrder === 1 ? 'ascending' : 'descending', 'order');

      const [items, totalItems, statsRows] = await Promise.all([
        Inventory.find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        Inventory.countDocuments(query),
        Inventory.aggregate([
          { $match: { isActive: true } },
          { $unwind: { path: '$versions', preserveNullAndEmptyArrays: false } },
          {
            $group: {
              _id: null,
              totalValue: {
                $sum: {
                  $multiply: [
                    { $ifNull: ['$versions.quantity', 0] },
                    { $ifNull: ['$versions.unitCost', 0] }
                  ]
                }
              },
              lowStockCount: {
                $sum: {
                  $cond: [{ $eq: ['$versions.lowStockAlert', true] }, 1, 0]
                }
              }
            }
          }
        ])
      ]);
      const totalPages = Math.ceil(totalItems / limit);
      const stats = statsRows[0] || { totalValue: 0, lowStockCount: 0 };
      const totalValue = Number(stats.totalValue) || 0;
      const lowStockCount = Number(stats.lowStockCount) || 0;

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
      // Versions added in the edit dialog have no versionId yet (required by the schema)
      if (Array.isArray(updateData.versions) && updateData.versions.some((version) => version && !version.versionId)) {
        const existingItem = await Inventory.findById(itemId).select('sku').lean();
        if (!existingItem) {
          throw new Error('Inventory item not found');
        }
        const prefix = existingItem.sku || 'TEMP';
        const usedIds = new Set(updateData.versions.map((version) => version && version.versionId).filter(Boolean));
        let next = 1;
        updateData.versions.forEach((version) => {
          if (version && !version.versionId) {
            while (usedIds.has(`${prefix}-V${next}`)) {
              next += 1;
            }
            version.versionId = `${prefix}-V${next}`;
            usedIds.add(version.versionId);
          }
        });
      }

      // findByIdAndUpdate skips the pre('save') hook that keeps the low-stock flag in sync
      if (Array.isArray(updateData.versions)) {
        updateData.versions.forEach((version) => {
          if (version) {
            version.lowStockAlert = Number(version.quantity ?? 0) <= Number(version.minStockLevel ?? 5);
          }
        });
      }

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

  // Hard delete ALL inventory items (used by admin bulk-delete UI)
  static async deleteAll() {
    console.log('InventoryService: Hard deleting ALL inventory items');
    try {
      const result = await Inventory.deleteMany({});
      console.log(`InventoryService: Deleted ${result.deletedCount} inventory items`);
      return result.deletedCount || 0;
    } catch (error) {
      console.error('InventoryService: Error deleting all inventory items:', error);
      throw error;
    }
  }
}

module.exports = InventoryService;