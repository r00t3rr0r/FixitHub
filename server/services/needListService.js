const NeedList = require('../models/NeedList');
const Inventory = require('../models/Inventory');
const { EPartOrder } = require('../models/EPartOrder');
const Order = require('../models/Order');

class NeedListService {
  static roundTo(value, decimals = 4) {
    const factor = 10 ** decimals;
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }

  static allocateShippingProportionally(items, shippingTotal) {
    const normalizedItems = items.map((item) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
      const additionalCost = Math.max(0, Number(item.additionalCost) || 0);
      const lineTotal = this.roundTo(quantity * unitPrice, 4);

      return {
        ...item,
        quantity,
        unitPrice,
        additionalCost,
        lineTotal,
      };
    });

    const orderSubtotal = this.roundTo(
      normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0),
      4
    );
    const roundedShippingTotal = this.roundTo(Math.max(0, Number(shippingTotal) || 0), 2);

    const shares = normalizedItems.map(() => 0);
    if (orderSubtotal > 0 && roundedShippingTotal > 0) {
      let allocatedShipping = 0;

      normalizedItems.forEach((item, index) => {
        const rawShare = (item.lineTotal / orderSubtotal) * roundedShippingTotal;
        const roundedShare = this.roundTo(rawShare, 2);
        shares[index] = roundedShare;
        allocatedShipping += roundedShare;
      });

      const roundingDelta = this.roundTo(roundedShippingTotal - allocatedShipping, 2);
      if (roundingDelta !== 0 && normalizedItems.length > 0) {
        const targetIndex = normalizedItems.reduce((bestIndex, item, index, arr) => {
          if (item.lineTotal > arr[bestIndex].lineTotal) {
            return index;
          }
          return bestIndex;
        }, 0);
        shares[targetIndex] = this.roundTo(shares[targetIndex] + roundingDelta, 2);
      }
    }

    const pricedItems = normalizedItems.map((item, index) => {
      const shippingShare = Math.max(0, this.roundTo(shares[index], 2));
      const adjustedLineTotal = this.roundTo(item.lineTotal + shippingShare, 4);
      const adjustedUnitPrice = this.roundTo(adjustedLineTotal / item.quantity, 4);
      const totalPrice = this.roundTo(item.lineTotal + item.additionalCost + shippingShare, 4);

      return {
        ...item,
        shippingShare,
        adjustedLineTotal,
        adjustedUnitPrice,
        totalPrice,
      };
    });

    const subtotal = this.roundTo(
      pricedItems.reduce((sum, item) => sum + item.lineTotal + item.additionalCost, 0),
      4
    );
    const distributedShippingCost = this.roundTo(
      pricedItems.reduce((sum, item) => sum + item.shippingShare, 0),
      2
    );

    return {
      items: pricedItems,
      subtotal,
      shippingCost: distributedShippingCost,
    };
  }

  static allocateShippingBySupplier(items, supplierShippingTotals = {}) {
    const normalizedItems = items.map((item) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
      const additionalCost = Math.max(0, Number(item.additionalCost) || 0);
      const lineTotal = this.roundTo(quantity * unitPrice, 4);

      return {
        ...item,
        quantity,
        unitPrice,
        additionalCost,
        lineTotal,
      };
    });

    const shippingShares = normalizedItems.map(() => 0);
    const itemsBySupplier = new Map();

    normalizedItems.forEach((item, index) => {
      const supplierKey = String(item.supplier || '');
      if (!itemsBySupplier.has(supplierKey)) {
        itemsBySupplier.set(supplierKey, []);
      }
      itemsBySupplier.get(supplierKey).push(index);
    });

    itemsBySupplier.forEach((indexes, supplierKey) => {
      const supplierShippingTotal = this.roundTo(
        Math.max(0, Number(supplierShippingTotals[supplierKey]) || 0),
        2
      );

      if (supplierShippingTotal <= 0 || indexes.length === 0) {
        return;
      }

      const supplierItems = indexes.map((itemIndex) => normalizedItems[itemIndex]);
      const supplierAllocation = this.allocateShippingProportionally(supplierItems, supplierShippingTotal);

      supplierAllocation.items.forEach((allocatedItem, idx) => {
        const originalIndex = indexes[idx];
        shippingShares[originalIndex] = Math.max(0, this.roundTo(allocatedItem.shippingShare, 2));
      });
    });

    const pricedItems = normalizedItems.map((item, index) => {
      const shippingShare = Math.max(0, this.roundTo(shippingShares[index], 2));
      const adjustedLineTotal = this.roundTo(item.lineTotal + shippingShare, 4);
      const adjustedUnitPrice = this.roundTo(adjustedLineTotal / item.quantity, 4);
      const totalPrice = this.roundTo(item.lineTotal + item.additionalCost + shippingShare, 4);

      return {
        ...item,
        shippingShare,
        adjustedLineTotal,
        adjustedUnitPrice,
        totalPrice,
      };
    });

    const subtotal = this.roundTo(
      pricedItems.reduce((sum, item) => sum + item.lineTotal + item.additionalCost, 0),
      4
    );
    const distributedShippingCost = this.roundTo(
      pricedItems.reduce((sum, item) => sum + item.shippingShare, 0),
      2
    );

    return {
      items: pricedItems,
      subtotal,
      shippingCost: distributedShippingCost,
    };
  }

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
        unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : 0,
        priceType: item.priceType === 'gross' ? 'gross' : 'net',
        shippingCost: Math.max(0, Number(item.shippingCost) || 0),
        additionalCost: Math.max(0, Number(item.additionalCost) || 0),
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
          unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : 0,
          priceType: item.priceType === 'gross' ? 'gross' : 'net',
          shippingCost: Math.max(0, Number(item.shippingCost) || 0),
          additionalCost: Math.max(0, Number(item.additionalCost) || 0),
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
      if (typeof itemData.unitPrice === 'number') {
        needList.items[existingItemIndex].unitPrice = itemData.unitPrice;
      }
      if (itemData.priceType === 'gross' || itemData.priceType === 'net') {
        needList.items[existingItemIndex].priceType = itemData.priceType;
      }
      if (itemData.shippingCost !== undefined) {
        needList.items[existingItemIndex].shippingCost = Math.max(0, Number(itemData.shippingCost) || 0);
      }
      if (itemData.additionalCost !== undefined) {
        needList.items[existingItemIndex].additionalCost = Math.max(0, Number(itemData.additionalCost) || 0);
      }
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
        unitPrice: typeof itemData.unitPrice === 'number' ? itemData.unitPrice : 0,
        priceType: itemData.priceType === 'gross' ? 'gross' : 'net',
        shippingCost: Math.max(0, Number(itemData.shippingCost) || 0),
        additionalCost: Math.max(0, Number(itemData.additionalCost) || 0),
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

    const itemConfigurations = Array.isArray(orderData.itemConfigurations)
      ? orderData.itemConfigurations
      : [];
    const supplierShippingCosts = Array.isArray(orderData.supplierShippingCosts)
      ? orderData.supplierShippingCosts
      : [];
    const itemConfigMap = new Map(
      itemConfigurations.map((cfg) => [String(cfg.needListItemId), cfg])
    );
    const supplierShippingMap = supplierShippingCosts.reduce((acc, config) => {
      const supplierId = String(config.supplierId || '');
      if (!supplierId) {
        return acc;
      }
      acc[supplierId] = Math.max(0, Number(config.shippingCost) || 0);
      return acc;
    }, {});

    // Create order items from need list items
    const orderItems = [];
    let requestedShippingTotal = 0;

    for (const item of needList.items) {
      const part = item.part;
      const itemConfig = itemConfigMap.get(String(item._id));

      const itemSupplier = itemConfig?.supplier || item.supplier || orderData.supplier;
      if (!itemSupplier) {
        throw new Error(`Supplier is required for item ${item.partNumber || item.partName}`);
      }

      const priceType = itemConfig?.priceType || item.priceType || 'net';
      const configuredPrice = Number(itemConfig?.price);

      // Prefer manually set need-list price, then fallback to inventory cost.
      let unitPrice = Number.isFinite(configuredPrice)
        ? configuredPrice
        : (typeof item.unitPrice === 'number' ? item.unitPrice : 0);
      if (unitPrice === 0 && part.versions && part.versions.length > 0) {
        unitPrice = part.versions[0].unitCost || 0;
      }

      const shippingCost = Math.max(0, Number(itemConfig?.shippingCost) || Number(item.shippingCost) || 0);
      const additionalCost = Math.max(0, Number(itemConfig?.additionalCost) || Number(item.additionalCost) || 0);

      requestedShippingTotal += shippingCost;


      orderItems.push({
        partId: item.part._id,
        partName: item.partName,
        sku: item.partNumber,
        quantity: item.quantity,
        unitPrice: unitPrice,
        priceType,
        additionalCost,
        supplier: itemSupplier,
        status: 'pending'
      });
    }

    if (orderItems.length === 0) {
      throw new Error('No items to add to the order');
    }

    const useSupplierShipping = Object.keys(supplierShippingMap).length > 0;
    const allocation = useSupplierShipping
      ? this.allocateShippingBySupplier(orderItems, supplierShippingMap)
      : this.allocateShippingProportionally(orderItems, requestedShippingTotal);

    const tax = 0; // Can be calculated based on business rules
    const shippingCost = allocation.shippingCost;
    const totalCost = this.roundTo(allocation.subtotal + tax + shippingCost, 4);

    const primarySupplierId = orderData.supplier || String(orderItems[0].supplier);

    const order = new EPartOrder({
      supplierId: primarySupplierId,
      items: allocation.items,
      subtotal: allocation.subtotal,
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

    await Order.updateMany(
      { 'ePartNeedListEntries.needListId': needList._id },
      {
        $set: {
          'ePartNeedListEntries.$[entry].needListStatus': 'ordered',
        },
      },
      {
        arrayFilters: [{ 'entry.needListId': needList._id }],
      }
    );

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
