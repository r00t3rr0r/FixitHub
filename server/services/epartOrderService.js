const { Supplier, EPartOrder } = require('../models/EPartOrder');
const Inventory = require('../models/Inventory');
const NeedList = require('../models/NeedList');
const Order = require('../models/Order');
const NotificationService = require('./notificationService');

class EPartOrderService {
  static getSafeVersionForAllocation(part, requestedQuantity = 1) {
    if (!part || !Array.isArray(part.versions) || part.versions.length === 0) {
      return null;
    }

    const normalizedRequested = Math.max(1, Number(requestedQuantity) || 1);
    const versions = part.versions.filter((version) => Number(version.quantity || 0) > 0);
    if (versions.length === 0) {
      return null;
    }

    const fittingVersion = versions.find((version) => Number(version.quantity || 0) >= normalizedRequested);
    if (fittingVersion) {
      return fittingVersion;
    }

    return versions.sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))[0];
  }

  static async autoAssignConvertedNeedListOrderItems(epartOrder, userId) {
    const needList = await NeedList.findOne({ convertedToOrder: epartOrder._id });
    if (!needList) {
      return;
    }

    const linkedOrders = await Order.find({
      'ePartNeedListEntries.needListId': needList._id,
    }).setOptions({ skipAutoPopulate: true });

    if (!linkedOrders.length) {
      return;
    }

    for (const linkedOrder of linkedOrders) {
      let orderChanged = false;
      let autoAssignedLines = 0;

      for (const entry of [...linkedOrder.ePartNeedListEntries]) {
        const matchesNeedList = String(entry.needListId || '') === String(needList._id);
        const pendingQuantity = Math.max(0, Number(entry.quantity) || 0);
        if (!matchesNeedList || pendingQuantity === 0) {
          continue;
        }

        const part = await Inventory.findById(entry.partId);
        if (!part) {
          continue;
        }

        const chosenVersion = this.getSafeVersionForAllocation(part, pendingQuantity);
        if (!chosenVersion) {
          continue;
        }

        const assignableQuantity = Math.min(
          pendingQuantity,
          Math.max(0, Number(chosenVersion.quantity) || 0)
        );

        if (assignableQuantity <= 0) {
          continue;
        }

        chosenVersion.quantity -= assignableQuantity;
        await part.save();

        const existingEPart = linkedOrder.eParts.find(
          (ep) => String(ep.partId) === String(entry.partId)
            && String(ep.versionId) === String(chosenVersion._id)
        );

        if (existingEPart) {
          existingEPart.quantity += assignableQuantity;
          existingEPart.status = 'allocated';
          existingEPart.assignedAt = new Date();
          existingEPart.assignedBy = userId;
        } else {
          linkedOrder.eParts.push({
            partId: entry.partId,
            versionId: String(chosenVersion._id),
            quantity: assignableQuantity,
            status: 'allocated',
            assignedAt: new Date(),
            assignedBy: userId,
          });
        }

        if (assignableQuantity >= pendingQuantity) {
          linkedOrder.ePartNeedListEntries.pull(entry._id);
        } else {
          entry.quantity = pendingQuantity - assignableQuantity;
          entry.needListStatus = 'ordered';
        }

        linkedOrder.timeline.push({
          status: 'EPart Assigned',
          description: `${part.itemName} x${assignableQuantity} automatically assigned from received need list \"${needList.name}\"`,
          completedAt: new Date(),
          staffId: userId || 'system',
          staffName: 'System',
        });

        autoAssignedLines += 1;
        orderChanged = true;
      }

      if (orderChanged) {
        await linkedOrder.save({ validateModifiedOnly: true });

        const assignedStaffIds = Array.isArray(linkedOrder.assignedStaff)
          ? [...new Set(
            linkedOrder.assignedStaff
              .map((assignment) => String(assignment?.staffId || ''))
              .filter((staffId) => staffId)
          )]
          : [];

        await Promise.all(
          assignedStaffIds.map(async (staffId) => {
            try {
              await NotificationService.createNotification({
                userId: staffId,
                title: 'Ersatzteil fuer Reparatur verfuegbar',
                message: `Fuer Auftrag ${linkedOrder.orderNumber || linkedOrder._id} wurde ein angefordertes Ersatzteil empfangen und der Reparatur zugewiesen.`,
                type: 'assignment',
                orderId: linkedOrder._id,
                actionUrl: `/admin/orders/${linkedOrder._id}`,
              }, { sendEmail: false });
            } catch (notificationError) {
              console.error('EPartOrderService: Failed to notify assigned staff:', notificationError.message || notificationError);
            }
          })
        );

        if (autoAssignedLines > 0) {
          linkedOrder.timeline.push({
            status: 'Staff Notified',
            description: `Assigned staff notified that ${autoAssignedLines} replacement part position(s) are now available for repair`,
            completedAt: new Date(),
            staffId: userId || 'system',
            staffName: 'System',
          });
          await linkedOrder.save({ validateModifiedOnly: true });
        }
      }
    }
  }

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

  // ============ SUPPLIER OPERATIONS ============

  /**
   * Get all suppliers with optional filtering
   */
  static async getSuppliers(filters = {}) {
    const query = {};

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
        { contactPerson: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const suppliers = await Supplier.find(query).sort({ name: 1 });
    return suppliers;
  }

  /**
   * Get supplier by ID
   */
  static async getSupplierById(supplierId) {
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }
    return supplier;
  }

  /**
   * Create new supplier
   */
  static async createSupplier(supplierData) {
    const supplier = new Supplier(supplierData);
    await supplier.save();
    return supplier;
  }

  /**
   * Update supplier
   */
  static async updateSupplier(supplierId, updateData) {
    const supplier = await Supplier.findByIdAndUpdate(
      supplierId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!supplier) {
      throw new Error('Supplier not found');
    }

    return supplier;
  }

  /**
   * Delete (deactivate) supplier
   */
  static async deleteSupplier(supplierId) {
    const supplier = await Supplier.findByIdAndUpdate(
      supplierId,
      { isActive: false },
      { new: true }
    );

    if (!supplier) {
      throw new Error('Supplier not found');
    }

    return { message: 'Supplier deactivated successfully' };
  }

  // ============ ORDER OPERATIONS ============

  /**
   * Get all epart orders with filtering and pagination
   */
  static async getEPartOrders(filters = {}) {
    const query = {};
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const skip = (page - 1) * limit;

    // Status filter
    if (filters.status) {
      query.status = filters.status;
    }

    // Supplier filter
    if (filters.supplierId) {
      query.supplierId = filters.supplierId;
    }

    // Payment status filter
    if (filters.paymentStatus) {
      query.paymentStatus = filters.paymentStatus;
    }

    // Search filter (order number or notes)
    if (filters.search) {
      query.$or = [
        { orderNumber: { $regex: filters.search, $options: 'i' } },
        { notes: { $regex: filters.search, $options: 'i' } },
        { trackingNumber: { $regex: filters.search, $options: 'i' } }
      ];
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      query.orderDate = {};
      if (filters.startDate) {
        query.orderDate.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.orderDate.$lte = new Date(filters.endDate);
      }
    }

    const total = await EPartOrder.countDocuments(query);
    const orders = await EPartOrder.find(query)
      .populate('supplierId', 'name email contactPerson')
      .populate('createdBy', 'firstName lastName email')
      .populate('receivedBy', 'firstName lastName email')
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(limit);

    return {
      orders,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    };
  }

  /**
   * Get order by ID
   */
  static async getEPartOrderById(orderId) {
    const order = await EPartOrder.findById(orderId)
      .populate('supplierId')
      .populate('createdBy', 'firstName lastName email')
      .populate('receivedBy', 'firstName lastName email')
      .populate('items.partId');

    if (!order) {
      throw new Error('Order not found');
    }

    return order;
  }

  /**
   * Create new epart order
   */
  static async createEPartOrder(orderData, userId) {
    const preparedItems = [];

    for (const item of orderData.items) {
      // Get part details from inventory
      const part = await Inventory.findById(item.partId);
      if (!part) {
        throw new Error(`Part not found: ${item.partId}`);
      }

      preparedItems.push({
        partId: item.partId,
        partName: part.name,
        sku: part.sku,
        quantity: item.quantity,
        unitPrice: Math.max(0, Number(item.unitPrice) || 0),
        additionalCost: Math.max(0, Number(item.additionalCost) || 0),
        priceType: item.priceType === 'gross' ? 'gross' : 'net',
        receivedQuantity: 0,
        status: 'pending'
      });
    }

    const allocation = this.allocateShippingProportionally(
      preparedItems,
      orderData.shippingCost || 0
    );

    const tax = Math.max(0, Number(orderData.tax) || 0);
    const totalCost = this.roundTo(allocation.subtotal + tax + allocation.shippingCost, 4);

    const order = new EPartOrder({
      supplierId: orderData.supplierId,
      items: allocation.items,
      status: orderData.status || 'draft',
      orderDate: orderData.orderDate || new Date(),
      expectedDeliveryDate: orderData.expectedDeliveryDate,
      subtotal: allocation.subtotal,
      tax: tax,
      shippingCost: allocation.shippingCost,
      totalCost: totalCost,
      paymentMethod: orderData.paymentMethod || 'account',
      notes: orderData.notes,
      createdBy: userId,
      timeline: [{
        status: 'created',
        description: 'Order created',
        completedAt: new Date(),
        userId: userId
      }]
    });

    await order.save();
    return await this.getEPartOrderById(order._id);
  }

  /**
   * Update epart order
   */
  static async updateEPartOrder(orderId, updateData, userId) {
    const order = await EPartOrder.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    // Update fields
    if (updateData.status) {
      order.status = updateData.status;
      order.timeline.push({
        status: updateData.status,
        description: `Order status changed to ${updateData.status}`,
        completedAt: new Date(),
        userId: userId,
        notes: updateData.statusNotes
      });

      // If status is received, mark actualDeliveryDate
      if (updateData.status === 'received') {
        order.actualDeliveryDate = new Date();
        order.receivedBy = userId;
      }
    }

    if (updateData.trackingNumber) {
      order.trackingNumber = updateData.trackingNumber;
    }

    if (updateData.paymentStatus) {
      order.paymentStatus = updateData.paymentStatus;
      order.timeline.push({
        status: 'payment_updated',
        description: `Payment status changed to ${updateData.paymentStatus}`,
        completedAt: new Date(),
        userId: userId
      });
    }

    if (updateData.expectedDeliveryDate) {
      order.expectedDeliveryDate = updateData.expectedDeliveryDate;
    }

    if (updateData.notes !== undefined) {
      order.notes = updateData.notes;
    }

    if (updateData.tax !== undefined) {
      order.tax = updateData.tax;
      order.totalCost = this.roundTo(order.subtotal + order.tax + order.shippingCost, 4);
    }

    if (updateData.shippingCost !== undefined) {
      const allocation = this.allocateShippingProportionally(
        order.items.map((item) => ({
          ...item.toObject(),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          additionalCost: item.additionalCost || 0,
        })),
        updateData.shippingCost
      );

      order.items.forEach((item, index) => {
        const allocated = allocation.items[index];
        item.shippingShare = allocated.shippingShare;
        item.adjustedLineTotal = allocated.adjustedLineTotal;
        item.adjustedUnitPrice = allocated.adjustedUnitPrice;
        item.totalPrice = allocated.totalPrice;
      });

      order.shippingCost = allocation.shippingCost;
      order.subtotal = allocation.subtotal;
      order.totalCost = this.roundTo(order.subtotal + order.tax + order.shippingCost, 4);
    }

    await order.save();

    if (updateData.status === 'received') {
      await this.autoAssignConvertedNeedListOrderItems(order, userId);
    }

    return await this.getEPartOrderById(orderId);
  }

  /**
   * Receive order items (full or partial)
   */
  static async receiveOrderItems(orderId, itemsToReceive, userId) {
    const order = await EPartOrder.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === 'cancelled') {
      throw new Error('Cannot receive items for a cancelled order');
    }

    let allItemsReceived = true;

    for (const receivedItem of itemsToReceive) {
      const orderItem = order.items.id(receivedItem.itemId);
      if (!orderItem) {
        throw new Error(`Item not found: ${receivedItem.itemId}`);
      }

      // Update received quantity
      orderItem.receivedQuantity += receivedItem.quantity;

      // Update item status
      if (orderItem.receivedQuantity >= orderItem.quantity) {
        orderItem.status = 'received';
      } else if (orderItem.receivedQuantity > 0) {
        orderItem.status = 'partial';
        allItemsReceived = false;
      } else {
        allItemsReceived = false;
      }

      // Add received quantity to the most appropriate inventory version.
      const inventoryPart = await Inventory.findById(orderItem.partId);
      if (inventoryPart) {
        const targetVersion = this.getSafeVersionForAllocation(inventoryPart, receivedItem.quantity)
          || inventoryPart.versions[0];

        if (targetVersion) {
          targetVersion.quantity = Math.max(0, Number(targetVersion.quantity) || 0) + receivedItem.quantity;
          await inventoryPart.save();
        }
      }

      // Add timeline entry
      order.timeline.push({
        status: 'items_received',
        description: `Received ${receivedItem.quantity} units of ${orderItem.partName}`,
        completedAt: new Date(),
        userId: userId
      });
    }

    // Update order status based on items
    if (allItemsReceived) {
      order.status = 'received';
      order.actualDeliveryDate = new Date();
      order.receivedBy = userId;
    } else {
      order.status = 'partial';
    }

    await order.save();

    if (allItemsReceived) {
      await this.autoAssignConvertedNeedListOrderItems(order, userId);
    }

    return await this.getEPartOrderById(orderId);
  }

  /**
   * Cancel epart order
   */
  static async cancelEPartOrder(orderId, reason, userId) {
    const order = await EPartOrder.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === 'received') {
      throw new Error('Cannot cancel a received order');
    }

    order.status = 'cancelled';
    order.timeline.push({
      status: 'cancelled',
      description: 'Order cancelled',
      completedAt: new Date(),
      userId: userId,
      notes: reason
    });

    // Mark all items as cancelled
    order.items.forEach(item => {
      if (item.status !== 'received') {
        item.status = 'cancelled';
      }
    });

    await order.save();
    return await this.getEPartOrderById(orderId);
  }

  /**
   * Upload invoice file for order
   */
  static async uploadInvoice(orderId, fileInfo, userId) {
    const order = await EPartOrder.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    order.invoiceFile = {
      filename: fileInfo.filename,
      originalName: fileInfo.originalName,
      mimetype: fileInfo.mimetype,
      size: fileInfo.size,
      uploadedAt: new Date(),
      uploadedBy: userId
    };

    order.timeline.push({
      status: 'invoice_uploaded',
      description: `Invoice file "${fileInfo.originalName}" uploaded`,
      completedAt: new Date(),
      userId: userId
    });

    await order.save();
    return await this.getEPartOrderById(orderId);
  }

  /**
   * Request return or exchange for broken parts
   */
  static async requestReturnExchange(orderId, returnData, userId) {
    const order = await EPartOrder.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === 'cancelled') {
      throw new Error('Cannot request return/exchange for a cancelled order');
    }

    // Validate affected items exist in the order
    for (const affectedItem of returnData.affectedItems) {
      const orderItem = order.items.id(affectedItem.itemId);
      if (!orderItem) {
        throw new Error(`Item not found in order: ${affectedItem.itemId}`);
      }
      if (affectedItem.quantity > orderItem.receivedQuantity) {
        throw new Error(`Cannot return/exchange more than received quantity for item ${orderItem.partName}`);
      }
    }

    order.returnExchange = {
      status: 'requested',
      type: returnData.type,
      reason: returnData.reason,
      description: returnData.description,
      requestedAt: new Date(),
      requestedBy: userId,
      affectedItems: returnData.affectedItems
    };

    order.timeline.push({
      status: 'return_exchange_requested',
      description: `${returnData.type === 'return' ? 'Return' : 'Exchange'} requested: ${returnData.reason}`,
      completedAt: new Date(),
      userId: userId,
      notes: returnData.description
    });

    await order.save();
    return await this.getEPartOrderById(orderId);
  }

  /**
   * Update return/exchange status
   */
  static async updateReturnExchange(orderId, status, notes, userId) {
    const order = await EPartOrder.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (!order.returnExchange || order.returnExchange.status === 'none') {
      throw new Error('No return/exchange request found for this order');
    }

    order.returnExchange.status = status;

    if (status === 'completed' || status === 'rejected') {
      order.returnExchange.resolvedAt = new Date();
      order.returnExchange.resolvedBy = userId;
    }

    if (notes) {
      order.returnExchange.notes = notes;
    }

    // If completed and it was a return, adjust inventory
    if (status === 'completed' && order.returnExchange.type === 'return') {
      for (const affectedItem of order.returnExchange.affectedItems) {
        const orderItem = order.items.id(affectedItem.itemId);
        if (orderItem) {
          // Decrease inventory stock
          await Inventory.findByIdAndUpdate(orderItem.partId, {
            $inc: { quantityInStock: -affectedItem.quantity }
          });
        }
      }
    }

    order.timeline.push({
      status: `return_exchange_${status}`,
      description: `Return/Exchange ${status}`,
      completedAt: new Date(),
      userId: userId,
      notes: notes
    });

    await order.save();
    return await this.getEPartOrderById(orderId);
  }

  /**
   * Get order statistics
   */
  static async getOrderStatistics(filters = {}) {
    const query = {};

    // Date range filter
    if (filters.startDate || filters.endDate) {
      query.orderDate = {};
      if (filters.startDate) {
        query.orderDate.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.orderDate.$lte = new Date(filters.endDate);
      }
    }

    // Total orders
    const totalOrders = await EPartOrder.countDocuments(query);

    // Total spent
    const totalSpentResult = await EPartOrder.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$totalCost' } } }
    ]);
    const totalSpent = totalSpentResult.length > 0 ? totalSpentResult[0].total : 0;

    // Orders by status
    const ordersByStatusResult = await EPartOrder.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const ordersByStatus = {};
    ordersByStatusResult.forEach(item => {
      ordersByStatus[item._id] = item.count;
    });

    // Top suppliers
    const topSuppliersResult = await EPartOrder.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$supplierId',
          orderCount: { $sum: 1 },
          totalSpent: { $sum: '$totalCost' }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'suppliers',
          localField: '_id',
          foreignField: '_id',
          as: 'supplier'
        }
      },
      { $unwind: '$supplier' },
      {
        $project: {
          supplierId: '$_id',
          supplierName: '$supplier.name',
          orderCount: 1,
          totalSpent: 1
        }
      }
    ]);

    return {
      totalOrders,
      totalSpent,
      ordersByStatus,
      topSuppliers: topSuppliersResult
    };
  }
}

module.exports = EPartOrderService;
