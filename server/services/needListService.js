const NeedList = require('../models/NeedList');
const Inventory = require('../models/Inventory');
const { EPartOrder } = require('../models/EPartOrder');

class NeedListService {
  /**
   * Delete all need lists
   */
  static async deleteAllNeedLists() {
    try {
      const result = await NeedList.deleteMany({});
      return { success: true, deletedCount: result.deletedCount };
    } catch (error) {
      console.error('NeedListService: Error deleting all need lists:', error);
      throw error;
    }
  }
  /**
   * Get all need lists with optional filtering
   */
  static async getNeedLists(filters = {}) {
    console.log('NeedListService.getNeedLists: Fetching need lists with filters:', filters);

    const query = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.priority) {
      query.priority = filters.priority;
    }

    if (filters.createdBy) {
      query.createdBy = filters.createdBy;
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
        { tags: { $in: [new RegExp(filters.search, 'i')] } }
      ];
    }

    const needLists = await NeedList.find(query)
      .populate('createdBy', 'firstName lastName email')
      .populate('items.part', 'partNumber name currentStock')
      .populate('convertedToOrder', 'orderNumber status')
      .sort({ createdAt: -1 });

    console.log(`NeedListService.getNeedLists: Found ${needLists.length} need lists`);
    return needLists;
  }

  /**
   * Get a single need list by ID
   */
  static async getNeedListById(id) {
    console.log('NeedListService.getNeedListById: Fetching need list:', id);

    const needList = await NeedList.findById(id)
      .populate('createdBy', 'firstName lastName email')
      .populate('items.part', 'partNumber name currentStock supplier')
      .populate('convertedToOrder', 'orderNumber status supplier');

    if (!needList) {
      throw new Error('Need list not found');
    }

    return needList;
  }

  /**
   * Create a new need list
   */
  static async createNeedList(data, userId) {
    console.log('NeedListService.createNeedList: Creating need list for user:', userId);

    // Validate and enrich items with current stock information
    const enrichedItems = [];
    for (const item of data.items || []) {
      const part = await Inventory.findById(item.part);
      if (!part) {
        throw new Error(`Part not found: ${item.part}`);
      }
      enrichedItems.push({
        part: item.part,
        partNumber: part.sku || part.partNumber || 'N/A',
        partName: part.itemName || part.name || 'Unknown',
        quantity: item.quantity,
        currentStock: part.currentStock || (part.versions && part.versions.length > 0 ? part.versions[0].quantity : 0),
        notes: item.notes || '',
        supplier: item.supplier || null
      });
    }

    const needList = new NeedList({
      name: data.name,
      description: data.description || '',
      items: enrichedItems,
      status: data.status || 'draft',
      priority: data.priority || 'medium',
      tags: data.tags || [],
      createdBy: userId
    });

    await needList.save();

    console.log('NeedListService.createNeedList: Need list created:', needList._id);

    // Populate before returning
    return await this.getNeedListById(needList._id);
  }

  /**
   * Update an existing need list
   */
  static async updateNeedList(id, data, userId) {
    console.log('NeedListService.updateNeedList: Updating need list:', id);

    const needList = await NeedList.findById(id);
    if (!needList) {
      throw new Error('Need list not found');
    }

    // Check if user has permission to update
    if (needList.createdBy.toString() !== userId.toString()) {
      // Additional check could be added here for admin users
      console.log('NeedListService.updateNeedList: User does not own this need list');
    }

    // Update basic fields
    if (data.name) needList.name = data.name;
    if (data.description !== undefined) needList.description = data.description;
    if (data.status) needList.status = data.status;
    if (data.priority) needList.priority = data.priority;
    if (data.tags) needList.tags = data.tags;

    // Update items if provided
    if (data.items) {
      const enrichedItems = [];
      for (const item of data.items) {
        const part = await Inventory.findById(item.part);
        if (!part) {
          throw new Error(`Part not found: ${item.part}`);
        }
        enrichedItems.push({
          part: item.part,
          partNumber: part.sku || part.partNumber || 'N/A',
          partName: part.itemName || part.name || 'Unknown',
          quantity: item.quantity,
          currentStock: part.currentStock || (part.versions && part.versions.length > 0 ? part.versions[0].quantity : 0),
          notes: item.notes || '',
          supplier: item.supplier || null
        });
      }
      needList.items = enrichedItems;
    }

    await needList.save();

    console.log('NeedListService.updateNeedList: Need list updated successfully');

    return await this.getNeedListById(id);
  }

  /**
   * Delete a need list
   */
  static async deleteNeedList(id, userId) {
    console.log('NeedListService.deleteNeedList: Deleting need list:', id);

    const needList = await NeedList.findById(id);
    if (!needList) {
      throw new Error('Need list not found');
    }

    // Check if user has permission to delete
    if (needList.createdBy.toString() !== userId.toString()) {
      console.log('NeedListService.deleteNeedList: User does not own this need list');
    }

    // Don't allow deletion if already converted to order
    if (needList.convertedToOrder) {
      throw new Error('Cannot delete a need list that has been converted to an order');
    }

    await NeedList.findByIdAndDelete(id);

    console.log('NeedListService.deleteNeedList: Need list deleted successfully');

    return { message: 'Need list deleted successfully' };
  }

  /**
   * Add item to need list
   */
  static async addItemToNeedList(id, itemData, userId) {
    console.log('NeedListService.addItemToNeedList: Adding item to need list:', id);

    const needList = await NeedList.findById(id);
    if (!needList) {
      throw new Error('Need list not found');
    }

    const part = await Inventory.findById(itemData.part);
    if (!part) {
      throw new Error(`Part not found: ${itemData.part}`);
    }

    // Check if item already exists in the list
    const existingItemIndex = needList.items.findIndex(
      item => item.part.toString() === itemData.part.toString()
    );

    if (existingItemIndex !== -1) {
      // Update quantity if item already exists
      needList.items[existingItemIndex].quantity += itemData.quantity;
      needList.items[existingItemIndex].notes = itemData.notes || needList.items[existingItemIndex].notes;
      if (itemData.supplier) {
        needList.items[existingItemIndex].supplier = itemData.supplier;
      }
    } else {
      // Add new item
      needList.items.push({
        part: itemData.part,
        partNumber: part.sku || part.partNumber || 'N/A',
        partName: part.itemName || part.name || 'Unknown',
        quantity: itemData.quantity,
        currentStock: part.currentStock || (part.versions && part.versions.length > 0 ? part.versions[0].quantity : 0),
        notes: itemData.notes || '',
        supplier: itemData.supplier || null
      });
    }

    await needList.save();

    console.log('NeedListService.addItemToNeedList: Item added successfully');

    return await this.getNeedListById(id);
  }

  /**
   * Remove item from need list
   */
  static async removeItemFromNeedList(id, itemId, userId) {
    console.log('NeedListService.removeItemFromNeedList: Removing item from need list:', id);

    const needList = await NeedList.findById(id);
    if (!needList) {
      throw new Error('Need list not found');
    }

    needList.items = needList.items.filter(item => item._id.toString() !== itemId.toString());

    await needList.save();

    console.log('NeedListService.removeItemFromNeedList: Item removed successfully');

    return await this.getNeedListById(id);
  }

  /**
   * Convert need list to EPart order
   */
  static async convertToOrder(id, orderData, userId) {
    console.log('NeedListService.convertToOrder: Converting need list to order:', id);

    const needList = await NeedList.findById(id).populate('items.part');
    if (!needList) {
      throw new Error('Need list not found');
    }

    if (needList.convertedToOrder) {
      throw new Error('Need list has already been converted to an order');
    }

    if (needList.items.length === 0) {
      throw new Error('Cannot convert an empty need list to an order');
    }

    // Validate supplier is provided
    if (!orderData.supplier) {
      throw new Error('Supplier is required to create an order');
    }

    // Create order items from need list items
    const orderItems = [];
    for (const item of needList.items) {
      const part = item.part;

      // Get price from the first version if available
      let unitPrice = 0;
      if (part.versions && part.versions.length > 0) {
        unitPrice = part.versions[0].unitCost || 0;
      }

      const totalPrice = item.quantity * unitPrice;

      orderItems.push({
        partId: item.part._id,
        partName: item.partName,
        sku: item.partNumber,
        quantity: item.quantity,
        unitPrice: unitPrice,
        totalPrice: totalPrice,
        status: 'pending'
      });
    }

    if (orderItems.length === 0) {
      throw new Error('No items to add to the order');
    }

    const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = 0; // Can be calculated based on business rules
    const shippingCost = 0; // Can be set based on supplier or order size
    const totalCost = subtotal + tax + shippingCost;

    const order = new EPartOrder({
      supplierId: orderData.supplier,
      items: orderItems,
      subtotal: subtotal,
      tax: tax,
      shippingCost: shippingCost,
      totalCost: totalCost,
      status: 'pending',
      notes: orderData.notes || `Created from Need List: ${needList.name}`,
      createdBy: userId
    });

    await order.save();

    // Update need list with order reference
    needList.convertedToOrder = order._id;
    needList.status = 'ordered';
    await needList.save();

    console.log('NeedListService.convertToOrder: Order created successfully:', order.orderNumber);

    return {
      order,
      needList: await this.getNeedListById(id)
    };
  }

  /**
   * Get statistics for need lists
   */
  static async getNeedListStatistics(userId = null) {
    console.log('NeedListService.getNeedListStatistics: Calculating statistics');

    const query = userId ? { createdBy: userId } : {};

    const [total, byStatus, byPriority] = await Promise.all([
      NeedList.countDocuments(query),
      NeedList.aggregate([
        { $match: query },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      NeedList.aggregate([
        { $match: query },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ])
    ]);

    const stats = {
      total,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byPriority: byPriority.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    };

    console.log('NeedListService.getNeedListStatistics: Statistics calculated:', stats);

    return stats;
  }
}

module.exports = NeedListService;
