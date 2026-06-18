const Order = require('../models/Order');
const User = require('../models/User');
const Inventory = require('../models/Inventory');
const NeedList = require('../models/NeedList');
const Product = require('../models/Product');
const Service = require('../models/Service');
const { WorkflowTemplate, AddOnWorkflow } = require('../models/Workflow');
const NotificationService = require('./notificationService');

const toIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};

const getUniqueStaffIds = (staffIds = []) => {
  if (!Array.isArray(staffIds)) return [];

  const seen = new Set();
  const uniqueIds = [];

  for (const rawId of staffIds) {
    const normalized = toIdString(rawId).trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    uniqueIds.push(normalized);
  }

  return uniqueIds;
};

const buildWorkflowStepAssignments = (staffMembers = []) => (
  staffMembers.map((staff) => ({
    staffId: staff._id,
    name: staff.name,
    avatar: staff.avatar || '',
    assignedAt: new Date(),
  }))
);

const applyWorkflowStepAssignment = (step, staffMembers = [], preferredStaffId = null) => {
  step.assignedStaff = buildWorkflowStepAssignments(staffMembers);

  if (!Array.isArray(step.assignedStaff) || step.assignedStaff.length === 0) {
    step.assignedStaffId = undefined;
    return;
  }

  const preferredId = toIdString(preferredStaffId);
  const primaryAssignment = preferredId
    ? step.assignedStaff.find((assignment) => toIdString(assignment.staffId) === preferredId)
    : null;

  step.assignedStaffId = (primaryAssignment || step.assignedStaff[0]).staffId;
};

const ensureOrderStaffAssignments = (order, staffMembers = []) => {
  if (!Array.isArray(order.assignedStaff)) {
    order.assignedStaff = [];
  }

  for (const staff of staffMembers) {
    const exists = order.assignedStaff.some(
      (assignment) => toIdString(assignment.staffId) === toIdString(staff._id)
    );

    if (!exists) {
      order.assignedStaff.push({
        staffId: staff._id,
        name: staff.name,
        avatar: staff.avatar || '',
        assignedAt: new Date(),
      });
    }
  }
};

class OrderService {
  static getStatusLabel(status) {
    const normalized = String(status || '').toLowerCase();
    const labels = {
      pending: 'Ausstehend',
      'diagnostic-assessment': 'Diagnosebewertung',
      diagnosed: 'Diagnose abgeschlossen',
      'awaiting-parts': 'Wartet auf Teile',
      'in-progress': 'Reparatur in Bearbeitung',
      paused: 'Pausiert',
      'on-hold': 'Angehalten',
      'quality-check': 'Qualitaetskontrolle',
      'ready-for-pickup': 'Abholbereit',
      completed: 'Abgeschlossen',
      cancelled: 'Storniert'
    };

    return labels[normalized] || status;
  }

  static async notifyCustomerOrderUpdate(order, message, statusOverride = null) {
    try {
      const customerId = toIdString(order?.customerId);
      if (!customerId) return;

      await NotificationService.createOrderUpdateNotification(
        order._id,
        customerId,
        statusOverride || order.status,
        message
      );
    } catch (notificationError) {
      console.error('OrderService: Failed to notify customer about order update:', notificationError.message || notificationError);
    }
  }

  // Create a new order
  static async create(orderData) {
    console.log('OrderService: Creating new order with data:', orderData);

    try {
      // Validate customer exists (skip for guest orders)
      if (orderData.customerId) {
        const customer = await User.findById(orderData.customerId);
        if (!customer) {
          throw new Error('Customer not found');
        }
      }

      // Transform services array if it contains just IDs
      if (orderData.services && Array.isArray(orderData.services)) {
        console.log('OrderService: Processing services array:', orderData.services);

        // Check if services are just IDs (strings) or already full objects
        const processedServices = await Promise.all(
          orderData.services.map(async (service) => {
            // If it's already an object with serviceId, price, and estimatedTime, use as-is
            if (typeof service === 'object' && service.serviceId && service.price !== undefined && service.estimatedTime !== undefined) {
              console.log('OrderService: Service already in correct format:', service);
              return service;
            }

            // If it's a string (ID), fetch the service and create proper object
            if (typeof service === 'string') {
              console.log('OrderService: Converting service ID to object:', service);
              const serviceObj = await Service.findById(service);
              if (!serviceObj) {
                throw new Error(`Service not found: ${service}`);
              }
              return {
                serviceId: serviceObj._id,
                price: serviceObj.price,
                estimatedTime: serviceObj.estimatedTime || 60, // Default to 60 minutes if not set
                notes: ''
              };
            }

            return service;
          })
        );

        orderData.services = processedServices;
        console.log('OrderService: Transformed services:', orderData.services);
      }

      const order = new Order(orderData);
      const savedOrder = await order.save();

      console.log('OrderService: Order created successfully with ID:', savedOrder._id);
      console.log('OrderService: Order unlock data - Pattern:', savedOrder.unlockPattern, 'Code:', savedOrder.unlockCode, 'NoLock:', savedOrder.noLock);

      return savedOrder;
    } catch (error) {
      console.error('OrderService: Error creating order:', error);
      throw error;
    }
  }

  // Get orders for a specific customer
  static async getByCustomer(customerId, filters = {}) {
    console.log('OrderService: Getting orders for customer:', customerId);

    try {
      const query = { customerId };

      // Apply filters
      if (filters.status) {
        query.status = filters.status;
      }

      const orders = await Order.find(query)
        .sort({ createdAt: -1 });

      console.log('OrderService: Found', orders.length, 'orders for customer');

      // Convert to plain objects and ensure numeric fields are numbers
      const plainOrders = orders.map(order => {
        const plain = order.toObject ? order.toObject() : order;
        
        // Convert numeric fields from Decimal128 to Number
        if (plain.totalCost !== undefined && typeof plain.totalCost === 'object') {
          plain.totalCost = Number(plain.totalCost);
        }
        if (plain.progress !== undefined && typeof plain.progress === 'object') {
          plain.progress = Number(plain.progress);
        }

        // Transform services array from objects to service names
        if (plain.services && Array.isArray(plain.services)) {
          plain.services = plain.services.map(service => {
            // Handle populated service objects
            if (typeof service === 'object' && service !== null) {
              if (service.serviceId && typeof service.serviceId === 'object') {
                return service.serviceId.name || 'Unknown Service';
              }
              return service.name || 'Unknown Service';
            }
            return String(service);
          });
        }

        return plain;
      });

      console.log('OrderService: Orders data:', JSON.stringify(plainOrders, null, 2));
      return plainOrders;
    } catch (error) {
      console.error('OrderService: Error getting customer orders:', error);
      throw error;
    }
  }

  // Get all orders (admin view)
  static async getAll(filters = {}) {
    console.log('OrderService: Getting all orders with filters:', filters);

    try {
      const query = {};
      const andFilters = [];

      // Apply filters
      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.priority) {
        query.priority = filters.priority;
      }

      if (filters.deviceType) {
        query.deviceType = filters.deviceType;
      }

      if (filters.assignedStaff) {
        andFilters.push({
          $or: [
            { 'assignedStaff.staffId': filters.assignedStaff },
            { 'workflows.assignedStaffId': filters.assignedStaff },
            { 'workflows.assignedStaff.staffId': filters.assignedStaff },
            { 'workflows.steps.assignedStaffId': filters.assignedStaff },
            { 'workflows.steps.assignedStaff.staffId': filters.assignedStaff },
          ],
        });
      }

      if (filters.search) {
        andFilters.push({
          $or: [
          { orderNumber: { $regex: filters.search, $options: 'i' } },
          { deviceBrand: { $regex: filters.search, $options: 'i' } },
          { deviceModel: { $regex: filters.search, $options: 'i' } }
          ],
        });
      }

      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) {
          query.createdAt.$gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
          query.createdAt.$lte = new Date(filters.dateTo);
        }
      }

      if (andFilters.length > 0) {
        query.$and = andFilters;
      }

      // Pagination
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 10;
      const skip = (page - 1) * limit;

      const orders = await Order.find(query)
        .populate('customerId', 'name email phone avatar role isActive createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalOrders = await Order.countDocuments(query);
      const totalPages = Math.ceil(totalOrders / limit);

      // Get stats
      const stats = await this.getOrderStats();

      console.log('OrderService: Found', orders.length, 'orders out of', totalOrders, 'total');

      // Convert to plain objects and ensure numeric fields are numbers
      const plainOrders = orders.map(order => {
        const plain = order.toObject ? order.toObject() : order;
        
        // Convert numeric fields from Decimal128 to Number
        if (plain.totalCost !== undefined && typeof plain.totalCost === 'object') {
          plain.totalCost = Number(plain.totalCost);
        }
        if (plain.progress !== undefined && typeof plain.progress === 'object') {
          plain.progress = Number(plain.progress);
        }

        // Transform services array from objects to service names
        if (plain.services && Array.isArray(plain.services)) {
          plain.services = plain.services.map(service => {
            // Handle populated service objects
            if (typeof service === 'object' && service !== null) {
              if (service.serviceId && typeof service.serviceId === 'object') {
                return service.serviceId.name || 'Unknown Service';
              }
              return service.name || 'Unknown Service';
            }
            return String(service);
          });
        }

        return plain;
      });

      return {
        orders: plainOrders,
        totalPages,
        currentPage: page,
        totalOrders,
        stats
      };
    } catch (error) {
      console.error('OrderService: Error getting all orders:', error);
      throw error;
    }
  }

  // Get order by ID
  static async getById(orderId) {
    console.log('OrderService: Getting order by ID:', orderId);

    try {
      const order = await Order.findById(orderId)
        .populate('customerId', 'name email phone avatar role isActive createdAt');

      if (!order) {
        throw new Error('Order not found');
      }

      console.log('OrderService: Order found:', order.orderNumber);

      // Convert to plain object and ensure numeric fields are numbers
      const plain = order.toObject ? order.toObject() : order;
      
      // Convert numeric fields from Decimal128 to Number
      if (plain.totalCost !== undefined && typeof plain.totalCost === 'object') {
        plain.totalCost = Number(plain.totalCost);
      }
      if (plain.progress !== undefined && typeof plain.progress === 'object') {
        plain.progress = Number(plain.progress);
      }

      return plain;
    } catch (error) {
      console.error('OrderService: Error getting order by ID:', error);
      throw error;
    }
  }

  // Auto-assign a staff member to the order if not already assigned
  static async _autoAssignStaff(order, staffId) {
    if (!staffId || staffId === 'system') return;

    const alreadyAssigned = order.assignedStaff.some(
      s => s.staffId && s.staffId.toString() === staffId.toString()
    );
    if (alreadyAssigned) return;

    const staff = await User.findById(staffId);
    if (!staff || !['staff', 'admin'].includes(staff.role)) return;

    order.assignedStaff.push({
      staffId: staff._id,
      name: staff.name,
      avatar: staff.avatar || '',
      assignedAt: new Date()
    });
  }

  // Update order status
  static async updateStatus(orderId, status, note = null, staffId = null) {
    console.log('OrderService: Updating order status:', orderId, 'to', status);

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });

      if (!order) {
        throw new Error('Order not found');
      }

      const oldStatus = order.status;
      const previousProgress = Number(order.progress || 0);
      order.status = status;
      
      // Update progress based on status
      const progressMap = {
        'pending': 0,
        'in-progress': 50,
        'quality-check': 75,
        'ready-for-pickup': 90,
        'completed': 100,
        'cancelled': 0
      };
      
      order.progress = progressMap[status] || order.progress;

      if (status === 'completed') {
        order.actualCompletion = new Date();
      }

      await OrderService._autoAssignStaff(order, staffId);

      // Add timeline entry
      let staffName = 'System';
      if (staffId) {
        const staff = await User.findById(staffId);
        staffName = staff ? staff.name : 'Staff Member';
      }

      if (!Array.isArray(order.timeline)) {
        order.timeline = [];
      }

      order.timeline.push({
        status: status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' '),
        description: note || `Status changed from ${oldStatus} to ${status}`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName
      });

      const updatedOrder = await order.save();

      if (oldStatus !== status || previousProgress !== Number(updatedOrder.progress || 0)) {
        const statusLabel = this.getStatusLabel(status);
        const updateMessage = note
          ? `Ihr Auftrag ${updatedOrder.orderNumber} wurde aktualisiert: ${statusLabel}. Hinweis: ${note}`
          : `Ihr Auftrag ${updatedOrder.orderNumber} wurde aktualisiert: ${statusLabel}. Aktueller Fortschritt: ${updatedOrder.progress || 0}%.`;

        await this.notifyCustomerOrderUpdate(updatedOrder, updateMessage, status);
      }
      
      console.log('OrderService: Order status updated successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error updating order status:', error);
      throw error;
    }
  }

  // Assign staff to order
  static async assignStaff(orderId, staffIds) {
    console.log('OrderService: Assigning staff to order:', orderId, 'staff:', staffIds);

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });

      if (!order) {
        throw new Error('Order not found');
      }

      // Get staff details
      const staffMembers = await User.find({ 
        _id: { $in: staffIds },
        role: { $in: ['staff', 'admin'] }
      });

      if (staffMembers.length !== staffIds.length) {
        throw new Error('One or more staff members not found');
      }

      // Update assigned staff
      order.assignedStaff = staffMembers.map(staff => ({
        staffId: staff._id,
        name: staff.name,
        avatar: staff.avatar || '',
        assignedAt: new Date()
      }));

      // Add timeline entry
      order.timeline.push({
        status: 'Staff Assigned',
        description: `Assigned to: ${staffMembers.map(s => s.name).join(', ')}`,
        completedAt: new Date(),
        staffId: 'system',
        staffName: 'System'
      });

      const updatedOrder = await order.save();
      
      console.log('OrderService: Staff assigned successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error assigning staff:', error);
      throw error;
    }
  }

  // Add staff note
  static async addNote(orderId, note, type, staffId) {
    console.log('OrderService: Adding note to order:', orderId);

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });

      if (!order) {
        throw new Error('Order not found');
      }

      const staff = await User.findById(staffId);
      if (!staff) {
        throw new Error('Staff member not found');
      }

      await OrderService._autoAssignStaff(order, staffId);

      const newNote = {
        staffId,
        staffName: staff.name,
        note,
        type,
        createdAt: new Date()
      };

      order.staffNotes.push(newNote);
      await order.save();
      
      console.log('OrderService: Note added successfully');
      return newNote;
    } catch (error) {
      console.error('OrderService: Error adding note:', error);
      throw error;
    }
  }

  // Get order statistics
  static async getOrderStats() {
    try {
      const stats = await Order.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalRevenue: { $sum: '$totalCost' }
          }
        }
      ]);

      const result = {
        pending: 0,
        inProgress: 0,
        qualityCheck: 0,
        completed: 0,
        totalRevenue: 0,
        averageCompletionTime: '2.5 days' // This would need more complex calculation
      };

      stats.forEach(stat => {
        switch (stat._id) {
          case 'pending':
            result.pending = stat.count;
            break;
          case 'in-progress':
            result.inProgress = stat.count;
            break;
          case 'quality-check':
            result.qualityCheck = stat.count;
            break;
          case 'completed':
            result.completed = stat.count;
            result.totalRevenue += stat.totalRevenue;
            break;
        }
      });

      return result;
    } catch (error) {
      console.error('OrderService: Error getting order stats:', error);
      throw error;
    }
  }

  // Assign EPart to order
  static async assignEPart(orderId, partId, versionId, quantity, staffId) {
    console.log('OrderService: Assigning EPart to order:', { orderId, partId, versionId, quantity, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const part = await Inventory.findById(partId);
      if (!part) {
        throw new Error('Part not found');
      }

      // Find the specific version
      const version = part.versions.id(versionId);
      if (!version) {
        throw new Error('Part version not found');
      }

      // Check if enough stock is available
      if (version.quantity < quantity) {
        throw new Error(`Insufficient stock. Available: ${version.quantity}, Requested: ${quantity}`);
      }

      // Check if this part version is already assigned to the order
      const existingEPart = order.eParts.find(
        ep => ep.partId.toString() === partId && ep.versionId === versionId
      );

      if (existingEPart) {
        throw new Error('This part version is already assigned to this order');
      }

      // Reduce inventory stock
      version.quantity -= quantity;
      await part.save();

      // Add EPart to order
      order.eParts.push({
        partId,
        versionId,
        quantity,
        status: 'allocated',
        assignedAt: new Date(),
        assignedBy: staffId
      });

      // Add timeline entry
      const staff = await User.findById(staffId);
      await OrderService._autoAssignStaff(order, staffId);
      order.timeline.push({
        status: 'EPart Assigned',
        description: `${part.itemName} (${version.versionType}) x${quantity} assigned to order`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Staff Member'
      });

      const updatedOrder = await order.save();

      console.log('OrderService: EPart assigned successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error assigning EPart:', error);
      throw error;
    }
  }

  // Remove EPart from order
  static async removeEPart(orderId, ePartId, staffId) {
    console.log('OrderService: Removing EPart from order:', { orderId, ePartId, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const ePart = order.eParts.id(ePartId);
      if (!ePart) {
        throw new Error('EPart not found in order');
      }

      // Restore inventory stock
      const part = await Inventory.findById(ePart.partId);
      if (part) {
        const version = part.versions.id(ePart.versionId);
        if (version) {
          version.quantity += ePart.quantity;
          await part.save();
        }
      }

      // Get part info for timeline before removing
      const partName = part ? part.itemName : 'Unknown Part';
      const versionType = part && part.versions.id(ePart.versionId)
        ? part.versions.id(ePart.versionId).versionType
        : 'Unknown';

      // Remove EPart from order
      order.eParts.pull(ePartId);

      // Add timeline entry
      const staff = await User.findById(staffId);
      await OrderService._autoAssignStaff(order, staffId);
      order.timeline.push({
        status: 'EPart Removed',
        description: `${partName} (${versionType}) x${ePart.quantity} removed from order`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Staff Member'
      });

      const updatedOrder = await order.save();

      console.log('OrderService: EPart removed successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error removing EPart:', error);
      throw error;
    }
  }

  // Update EPart status (pending -> allocated -> used)
  static async updateEPartStatus(orderId, ePartId, status, staffId) {
    console.log('OrderService: Updating EPart status:', { orderId, ePartId, status, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const ePart = order.eParts.id(ePartId);
      if (!ePart) {
        throw new Error('EPart not found in order');
      }

      const oldStatus = ePart.status;
      ePart.status = status;

      // Add timeline entry
      const staff = await User.findById(staffId);
      const part = await Inventory.findById(ePart.partId);
      const partName = part ? part.itemName : 'Unknown Part';

      await OrderService._autoAssignStaff(order, staffId);
      order.timeline.push({
        status: 'EPart Status Updated',
        description: `${partName} status changed from ${oldStatus} to ${status}`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Staff Member'
      });

      const updatedOrder = await order.save();

      console.log('OrderService: EPart status updated successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error updating EPart status:', error);
      throw error;
    }
  }

  // Record missing EPart that was added to a need list
  static async recordEPartNeedListEntry(orderId, entryData, staffId) {
    console.log('OrderService: Recording EPart need list entry:', { orderId, entryData, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const part = await Inventory.findById(entryData.partId);
      if (!part) {
        throw new Error('Part not found');
      }

      let needList = null;
      if (entryData.needListId) {
        needList = await NeedList.findById(entryData.needListId);
        if (!needList) {
          throw new Error('Need list not found');
        }
      }

      const resolvedNeedListName = needList?.name || entryData.needListName || '';
      if (!resolvedNeedListName.trim()) {
        throw new Error('Need list name is required');
      }

      order.ePartNeedListEntries.push({
        partId: entryData.partId,
        quantity: entryData.quantity,
        needListId: needList?._id || null,
        needListName: resolvedNeedListName,
        needListStatus: needList?.status || entryData.needListStatus || 'draft',
        targetType: entryData.targetType || 'existing',
        notes: entryData.notes || '',
        requestedAt: new Date(),
        requestedBy: staffId,
      });

      const staff = await User.findById(staffId);
      await OrderService._autoAssignStaff(order, staffId);
      order.timeline.push({
        status: 'EPart Need List Added',
        description: `${part.itemName} x${entryData.quantity} added to need list "${resolvedNeedListName}"`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Staff Member'
      });

      const updatedOrder = await order.save();

      console.log('OrderService: EPart need list entry recorded successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error recording EPart need list entry:', error);
      throw error;
    }
  }

  // Add add-on service to order
  static async addAddonToOrder(orderId, addonData, staffId) {
    console.log('OrderService: Adding add-on to order:', { orderId, addonData, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      // Create new add-on with the provided data
      const newAddon = {
        name: addonData.name,
        description: addonData.description || '',
        price: addonData.price,
        status: addonData.status || 'pending',
        estimatedTime: addonData.estimatedTime || '',
        progress: 0
      };

      order.addOns.push(newAddon);

      // Update total cost
      order.totalCost += addonData.price;

      // Add timeline entry
      const staff = await User.findById(staffId);
      await OrderService._autoAssignStaff(order, staffId);
      order.timeline.push({
        status: 'Add-on Service Added',
        description: `${addonData.name} added to order (+$${addonData.price})`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Staff Member'
      });

      // Use validateModifiedOnly to avoid validating unmodified services array
      // This prevents validation errors on existing incomplete service objects
      const updatedOrder = await order.save({ validateModifiedOnly: true });

      console.log('OrderService: Add-on added successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error adding add-on:', error);
      throw error;
    }
  }

  // Update add-on service in order
  static async updateOrderAddon(orderId, addonId, updateData, staffId) {
    console.log('OrderService: Updating add-on in order:', { orderId, addonId, updateData, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const addon = order.addOns.id(addonId);
      if (!addon) {
        throw new Error('Add-on not found in order');
      }

      // Store old price for total cost adjustment
      const oldPrice = addon.price;

      // Update add-on fields
      if (updateData.name !== undefined) addon.name = updateData.name;
      if (updateData.description !== undefined) addon.description = updateData.description;
      if (updateData.price !== undefined) addon.price = updateData.price;
      if (updateData.status !== undefined) addon.status = updateData.status;
      if (updateData.estimatedTime !== undefined) addon.estimatedTime = updateData.estimatedTime;
      if (updateData.progress !== undefined) addon.progress = updateData.progress;

      // Update total cost if price changed
      if (updateData.price !== undefined && updateData.price !== oldPrice) {
        order.totalCost = order.totalCost - oldPrice + updateData.price;
      }

      // Add timeline entry
      const staff = await User.findById(staffId);
      await OrderService._autoAssignStaff(order, staffId);
      order.timeline.push({
        status: 'Add-on Service Updated',
        description: `${addon.name} updated`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Staff Member'
      });

      const updatedOrder = await order.save();

      console.log('OrderService: Add-on updated successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error updating add-on:', error);
      throw error;
    }
  }

  // Remove add-on service from order
  static async removeAddonFromOrder(orderId, addonId, staffId) {
    console.log('OrderService: Removing add-on from order:', { orderId, addonId, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const addon = order.addOns.id(addonId);
      if (!addon) {
        throw new Error('Add-on not found in order');
      }

      // Store add-on details before removing
      const addonName = addon.name;
      const addonPrice = addon.price;

      // Remove add-on from order
      order.addOns.pull(addonId);

      // Update total cost
      order.totalCost -= addonPrice;

      // Add timeline entry
      const staff = await User.findById(staffId);
      await OrderService._autoAssignStaff(order, staffId);
      order.timeline.push({
        status: 'Add-on Service Removed',
        description: `${addonName} removed from order (-$${addonPrice})`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Staff Member'
      });

      const updatedOrder = await order.save();

      console.log('OrderService: Add-on removed successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error removing add-on:', error);
      throw error;
    }
  }

  // Assign staff to add-on service
  static async assignStaffToAddon(orderId, addonId, staffId, assigningStaffId) {
    console.log('OrderService: Assigning staff to add-on:', { orderId, addonId, staffId, assigningStaffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const addon = order.addOns.id(addonId);
      if (!addon) {
        throw new Error('Add-on not found in order');
      }

      // Get staff details
      const staff = await User.findById(staffId);
      if (!staff || !['staff', 'admin'].includes(staff.role)) {
        throw new Error('Staff member not found or invalid role');
      }

      // Add assignedStaff field to add-on if it doesn't exist
      if (!addon.assignedStaff) {
        addon.assignedStaff = [];
      }

      // Check if staff is already assigned
      const isAlreadyAssigned = addon.assignedStaff.some(
        s => s.staffId.toString() === staffId
      );

      if (!isAlreadyAssigned) {
        addon.assignedStaff.push({
          staffId: staff._id,
          name: staff.name,
          avatar: staff.avatar || ''
        });
      }

      // Add timeline entry
      const assigningStaff = await User.findById(assigningStaffId);
      order.timeline.push({
        status: 'Add-on Staff Assigned',
        description: `${staff.name} assigned to ${addon.name}`,
        completedAt: new Date(),
        staffId: assigningStaffId || 'system',
        staffName: assigningStaff ? assigningStaff.name : 'System'
      });

      const updatedOrder = await order.save();

      console.log('OrderService: Staff assigned to add-on successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error assigning staff to add-on:', error);
      throw error;
    }
  }

  // Assign workflow to order
  static async assignWorkflowToOrder(orderId, workflowTemplateId, staffId, assignedWorkflowStaffId = null) {
    console.log('OrderService: Assigning workflow to order:', { orderId, workflowTemplateId, staffId, assignedWorkflowStaffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }
      console.log('OrderService: Order found:', { orderId, orderNumber: order.orderNumber });

      const workflowTemplate = await WorkflowTemplate.findById(workflowTemplateId);
      if (!workflowTemplate) {
        console.error('OrderService: Workflow template not found:', workflowTemplateId);
        throw new Error('Workflow template not found');
      }
      console.log('OrderService: Workflow template found:', { templateId: workflowTemplate._id, name: workflowTemplate.name });

      let workflowAssignedStaffMembers = [];
      if (assignedWorkflowStaffId) {
        const assignedStaff = await User.findById(assignedWorkflowStaffId);
        if (!assignedStaff || !['staff', 'admin'].includes(assignedStaff.role)) {
          console.error('OrderService: Invalid assigned staff:', { assignedWorkflowStaffId, found: !!assignedStaff, role: assignedStaff?.role });
          throw new Error('Assigned workflow staff member not found or invalid role');
        }
        workflowAssignedStaffMembers = [assignedStaff];
        console.log('OrderService: Assigned staff validated:', { staffId: assignedStaff._id, name: assignedStaff.name, role: assignedStaff.role });
      }

      // Check if workflow is already assigned
      const existingWorkflow = order.workflows.find(
        w => w.workflowTemplateId.toString() === workflowTemplateId
      );
      if (existingWorkflow) {
        console.warn('OrderService: Workflow already assigned to order (idempotent return):', {
          workflowTemplateId,
          existingWorkflowId: existingWorkflow._id,
        });

        // Keep assignment API idempotent: if the template is already attached,
        // return the current order instead of failing with 400.
        order._workflowAlreadyAssigned = true;
        return order;
      }
      console.log('OrderService: Workflow not yet assigned, proceeding...');

      // Create workflow execution steps from template
      const workflowSteps = workflowTemplate.steps.map(step => ({
        stepId: step._id.toString(),
        stepName: step.name,
        status: 'pending',
        formData: {},
        checklistData: {},
        photos: []
      }));

      // Add workflow to order
      order.workflows.push({
        workflowTemplateId,
        workflowName: workflowTemplate.name,
        assignedStaffId: workflowAssignedStaffMembers[0]?._id,
        assignedStaff: buildWorkflowStepAssignments(workflowAssignedStaffMembers),
        steps: workflowSteps,
        currentStepIndex: 0,
        status: 'not-started',
        estimatedCompletionTime: workflowTemplate.estimatedTotalTime
      });

      ensureOrderStaffAssignments(order, workflowAssignedStaffMembers);

      // Add timeline entry
      const staff = await User.findById(staffId);
      order.timeline.push({
        status: 'Workflow Assigned',
        description: workflowAssignedStaffMembers.length > 0
          ? `Workflow "${workflowTemplate.name}" assigned to order and ${workflowAssignedStaffMembers[0].name}`
          : `Workflow "${workflowTemplate.name}" assigned to order`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'System'
      });

      const updatedOrder = await order.save();

      console.log('OrderService: Workflow assigned successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error assigning workflow:', error);
      throw error;
    }
  }

  // Start workflow execution
  static async startWorkflow(orderId, workflowId, staffId) {
    console.log('OrderService: Starting workflow:', { orderId, workflowId, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const workflow = order.workflows.id(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found in order');
      }

      if (workflow.status !== 'not-started') {
        throw new Error('Workflow has already been started');
      }

      // Get staff details for assignment
      const staff = await User.findById(staffId);
      if (!staff) {
        throw new Error('Staff member not found');
      }

      console.log('OrderService: Updating order status to in-progress and assigning staff');

      // Update order status to 'in-progress' if it's not already
      const previousStatus = order.status;
      if (order.status !== 'in-progress') {
        order.status = 'in-progress';
        console.log(`OrderService: Order status changed from "${previousStatus}" to "in-progress"`);
      }

      // Assign staff member to order if not already assigned
      const staffAssignmentExists = order.assignedStaff.some(
        s => s.staffId.toString() === staffId.toString()
      );

      if (!staffAssignmentExists) {
        console.log('OrderService: Assigning staff to order:', staff.name);
        order.assignedStaff.push({
          staffId: staffId,
          name: staff.name,
          avatar: staff.avatar || ''
        });
      } else {
        console.log('OrderService: Staff already assigned to order');
      }

      // Update workflow status
      workflow.status = 'in-progress';
      workflow.startedAt = new Date();

      // Set first step to in-progress
      if (workflow.steps.length > 0) {
        workflow.steps[0].status = 'in-progress';
        workflow.steps[0].startedAt = new Date();
        applyWorkflowStepAssignment(workflow.steps[0], [staff], staffId);
      }

      // Add timeline entries
      // First entry for order status change
      if (previousStatus !== 'in-progress') {
        order.timeline.push({
          status: 'Repair in Progress',
          description: `Order status updated to "Repair in Progress" and assigned to ${staff.name} upon workflow initiation`,
          completedAt: new Date(),
          staffId: staffId,
          staffName: staff.name
        });
        console.log('OrderService: Added timeline entry for order status change');
      }

      // Second entry for workflow start
      order.timeline.push({
        status: 'Workflow Started',
        description: `Workflow "${workflow.workflowName}" started by ${staff.name}`,
        completedAt: new Date(),
        staffId: staffId,
        staffName: staff.name
      });
      console.log('OrderService: Added timeline entry for workflow start');

      const updatedOrder = await order.save();

      if (previousStatus !== 'in-progress') {
        await this.notifyCustomerOrderUpdate(
          updatedOrder,
          `Ihr Auftrag ${updatedOrder.orderNumber} ist jetzt in Bearbeitung. Wir haben mit der Reparatur begonnen. Aktueller Fortschritt: ${updatedOrder.progress || 0}%.`,
          'in-progress'
        );
      }

      console.log('OrderService: Workflow started successfully with order status updated and staff assigned');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error starting workflow:', error);
      console.error('OrderService: Error details:', error.message, error.stack);
      throw error;
    }
  }

  // Assign one or multiple staff members to a workflow step
  static async assignWorkflowStepStaff(orderId, workflowId, stepId, staffIds, assigningStaffId) {
    console.log('OrderService: Assigning staff to workflow step:', {
      orderId,
      workflowId,
      stepId,
      staffIds,
      assigningStaffId,
    });

    try {
      const uniqueStaffIds = getUniqueStaffIds(staffIds);
      if (uniqueStaffIds.length === 0) {
        throw new Error('At least one valid staff ID is required');
      }

      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const workflow = order.workflows.id(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found in order');
      }

      const step = workflow.steps.id(stepId);
      if (!step) {
        throw new Error('Step not found in workflow');
      }

      const staffMembers = await User.find({
        _id: { $in: uniqueStaffIds },
        role: { $in: ['staff', 'admin'] },
      });

      if (staffMembers.length !== uniqueStaffIds.length) {
        throw new Error('One or more staff members not found');
      }

      applyWorkflowStepAssignment(step, staffMembers, step.assignedStaffId || assigningStaffId);
      ensureOrderStaffAssignments(order, staffMembers);

      const stepIndex = workflow.steps.findIndex((stepItem) => toIdString(stepItem._id) === toIdString(step._id));
      const isCurrentStep = Number(workflow.currentStepIndex) === stepIndex;

      // Assigning an active task should make the current pending step actionable immediately.
      if (isCurrentStep && workflow.status === 'in-progress' && step.status === 'pending') {
        step.status = 'in-progress';
        if (!step.startedAt) {
          step.startedAt = new Date();
        }
      }

      const assigningStaff = assigningStaffId ? await User.findById(assigningStaffId) : null;
      order.timeline.push({
        status: 'Workflow Task Assigned',
        description: `Step "${step.stepName}" in workflow "${workflow.workflowName}" assigned to: ${staffMembers.map((staff) => staff.name).join(', ')}`,
        completedAt: new Date(),
        staffId: assigningStaffId || 'system',
        staffName: assigningStaff ? assigningStaff.name : 'System',
      });

      const updatedOrder = await order.save();

      console.log('OrderService: Workflow step staff assigned successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error assigning workflow step staff:', error);
      throw error;
    }
  }

  // Complete workflow step
  static async completeWorkflowStep(orderId, workflowId, stepId, stepData, staffId) {
    console.log('OrderService: Completing workflow step:', { orderId, workflowId, stepId, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const workflow = order.workflows.id(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found in order');
      }

      const step = workflow.steps.id(stepId);
      if (!step) {
        throw new Error('Step not found in workflow');
      }

      if (step.status === 'completed') {
        throw new Error('Step has already been completed');
      }

      const previousProgress = Number(order.progress || 0);

      // Update step data
      const completedAt = new Date();
      step.status = 'completed';
      step.completedAt = completedAt;

      if (!step.startedAt) {
        const startedFromPayload = stepData?.timing?.startedAt ? new Date(stepData.timing.startedAt) : null;
        if (startedFromPayload && Number.isFinite(startedFromPayload.getTime())) {
          step.startedAt = startedFromPayload;
        } else {
          step.startedAt = completedAt;
        }
      }

      const estimatedDurationMinutes = Number(step.estimatedTime || 0);
      const payloadElapsedMinutes = Number(stepData?.timing?.elapsedMinutes);
      let actualDurationMinutes = 0;
      let effectivePausedMinutes = Number(step.totalPausedMinutes || 0);

      if (step.currentPauseStartedAt) {
        const pauseStartTs = new Date(step.currentPauseStartedAt).getTime();
        const completedAtTs = completedAt.getTime();
        if (Number.isFinite(pauseStartTs) && completedAtTs > pauseStartTs) {
          const openPauseDuration = Math.round((completedAtTs - pauseStartTs) / (1000 * 60));
          effectivePausedMinutes += openPauseDuration;

          if (!Array.isArray(step.pauseHistory)) {
            step.pauseHistory = [];
          }

          const openPauseEntry = [...step.pauseHistory].reverse().find((entry) => !entry.resumedAt);
          if (openPauseEntry) {
            openPauseEntry.resumedAt = completedAt;
            openPauseEntry.durationMinutes = openPauseDuration;
          }

          step.currentPauseStartedAt = undefined;
        }
      }

      step.totalPausedMinutes = Math.max(0, Math.round(effectivePausedMinutes));

      if (Number.isFinite(payloadElapsedMinutes) && payloadElapsedMinutes >= 0) {
        actualDurationMinutes = Math.round(payloadElapsedMinutes);
      } else if (step.startedAt) {
        const startedAtTs = new Date(step.startedAt).getTime();
        const completedAtTs = completedAt.getTime();
        if (Number.isFinite(startedAtTs) && completedAtTs > startedAtTs) {
          const rawDuration = Math.round((completedAtTs - startedAtTs) / (1000 * 60));
          actualDurationMinutes = Math.max(0, rawDuration - step.totalPausedMinutes);
        }
      }

      step.actualDurationMinutes = Math.max(0, actualDurationMinutes);
      step.estimatedDurationMinutes = Math.max(0, Math.round(estimatedDurationMinutes));
      step.durationDeltaMinutes = step.actualDurationMinutes - step.estimatedDurationMinutes;

      if (stepData.formData) step.formData = stepData.formData;
      if (stepData.checklistData) step.checklistData = stepData.checklistData;
      if (stepData.notes) step.notes = stepData.notes;
      if (stepData.photos) step.photos = stepData.photos;

      // Move to next step
      const currentIndex = workflow.steps.findIndex(s => s._id.toString() === stepId);
      const nextIndex = currentIndex + 1;

      // Fetch staff once for use in both timeline entries and step assignment
      const staff = await User.findById(staffId);
      const previousOrderStatus = order.status;

      if (nextIndex < workflow.steps.length) {
        workflow.currentStepIndex = nextIndex;
        workflow.steps[nextIndex].status = 'in-progress';
        workflow.steps[nextIndex].startedAt = new Date();
        if (staff) {
          applyWorkflowStepAssignment(workflow.steps[nextIndex], [staff], staffId);
        }
      } else {
        // All steps in this workflow completed
        const workflowCompletedAt = new Date();
        workflow.status = 'completed';
        workflow.completedAt = workflowCompletedAt;

        // Add workflow completion timeline entry
        order.timeline.push({
          status: 'Workflow Completed',
          description: `Workflow "${workflow.workflowName}" wurde vollständig abgeschlossen (${workflow.steps.length} Schritte)`,
          completedAt: workflowCompletedAt,
          staffId: staffId || 'system',
          staffName: staff ? staff.name : 'Staff Member',
        });

        // If every workflow on this order is now done, advance the order status
        const allWorkflowsDone = order.workflows.every(wf =>
          wf._id.toString() === workflowId.toString() ? true : wf.status === 'completed'
        );
        if (allWorkflowsDone && ['in-progress', 'quality-check', 'diagnostic-assessment'].includes(order.status)) {
          order.status = 'ready-for-pickup';
          order.actualCompletion = workflowCompletedAt;
          order.timeline.push({
            status: 'Order Ready',
            description: `Auftrag ${order.orderNumber} ist abgeschlossen und bereit zur Abholung`,
            completedAt: workflowCompletedAt,
            staffId: staffId || 'system',
            staffName: staff ? staff.name : 'Staff Member',
          });
        }
      }

      // Add step completion timeline entry
      const timingSummary = step.estimatedDurationMinutes > 0
        ? ` (actual ${step.actualDurationMinutes} min vs estimated ${step.estimatedDurationMinutes} min)`
        : ` (actual ${step.actualDurationMinutes} min)`;
      await OrderService._autoAssignStaff(order, staffId);
      order.timeline.push({
        status: 'Workflow Step Completed',
        description: `Step "${step.stepName}" completed in workflow "${workflow.workflowName}"${timingSummary}`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Staff Member',
        photos: stepData.photos || []
      });

      // Update order progress based on workflow completion
      const totalSteps = workflow.steps.length;
      const completedSteps = workflow.steps.filter(s => s.status === 'completed').length;
      const workflowProgress = Math.round((completedSteps / totalSteps) * 100);

      // Calculate overall order progress (weighted average of all workflows)
      if (order.workflows.length > 0) {
        const totalProgress = order.workflows.reduce((sum, wf) => {
          const wfCompletedSteps = wf.steps.filter(s => s.status === 'completed').length;
          return sum + (wfCompletedSteps / wf.steps.length) * 100;
        }, 0);
        order.progress = Math.round(totalProgress / order.workflows.length);
      }

      const updatedOrder = await order.save();

      if (Number(updatedOrder.progress || 0) !== previousProgress) {
        const progressDelta = Number(updatedOrder.progress || 0) - previousProgress;
        await this.notifyCustomerOrderUpdate(
          updatedOrder,
          `Ihr Auftrag ${updatedOrder.orderNumber} hat einen neuen Reparaturfortschritt erreicht: ${updatedOrder.progress || 0}% (${progressDelta >= 0 ? '+' : ''}${progressDelta}%). Letzter Schritt: ${step.stepName}.`
        );
      }

      // Notify customer if order became ready for pickup
      if (previousOrderStatus !== updatedOrder.status && updatedOrder.status === 'ready-for-pickup') {
        await this.notifyCustomerOrderUpdate(
          updatedOrder,
          `Gute Nachrichten! Ihr Auftrag ${updatedOrder.orderNumber} ist fertig und kann abgeholt werden. Alle Reparaturschritte wurden erfolgreich abgeschlossen.`,
          'ready-for-pickup'
        );
      }

      console.log('OrderService: Workflow step completed successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error completing workflow step:', error);
      throw error;
    }
  }

  // Skip workflow step
  static async skipWorkflowStep(orderId, workflowId, stepId, reason, staffId) {
    console.log('OrderService: Skipping workflow step:', { orderId, workflowId, stepId, reason, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const workflow = order.workflows.id(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found in order');
      }

      const step = workflow.steps.id(stepId);
      if (!step) {
        throw new Error('Step not found in workflow');
      }

      if (step.status === 'completed' || step.status === 'skipped') {
        throw new Error('Step has already been completed or skipped');
      }

      const previousProgress = Number(order.progress || 0);

      // Update step status
      const skippedAt = new Date();
      step.status = 'skipped';
      step.completedAt = skippedAt;

      if (step.startedAt) {
        const startedAtTs = new Date(step.startedAt).getTime();
        const skippedAtTs = skippedAt.getTime();
        if (Number.isFinite(startedAtTs) && skippedAtTs > startedAtTs) {
          const rawDurationMinutes = Math.round((skippedAtTs - startedAtTs) / (1000 * 60));
          const pausedMinutes = Number(step.totalPausedMinutes || 0);
          step.actualDurationMinutes = Math.max(0, rawDurationMinutes - pausedMinutes);
        }
      }

      if (step.currentPauseStartedAt) {
        const pauseStartTs = new Date(step.currentPauseStartedAt).getTime();
        const skippedAtTs = skippedAt.getTime();
        if (Number.isFinite(pauseStartTs) && skippedAtTs > pauseStartTs) {
          const openPauseDuration = Math.round((skippedAtTs - pauseStartTs) / (1000 * 60));
          step.totalPausedMinutes = Number(step.totalPausedMinutes || 0) + openPauseDuration;

          if (!Array.isArray(step.pauseHistory)) {
            step.pauseHistory = [];
          }

          const openPauseEntry = [...step.pauseHistory].reverse().find((entry) => !entry.resumedAt);
          if (openPauseEntry) {
            openPauseEntry.resumedAt = skippedAt;
            openPauseEntry.durationMinutes = openPauseDuration;
          }
        }
        step.currentPauseStartedAt = undefined;
      }

      step.estimatedDurationMinutes = Number(step.estimatedTime || 0);
      step.durationDeltaMinutes = (step.actualDurationMinutes || 0) - (step.estimatedDurationMinutes || 0);
      step.notes = reason || 'Step skipped';

      // Move to next step
      const currentIndex = workflow.steps.findIndex(s => s._id.toString() === stepId);
      const nextIndex = currentIndex + 1;

      if (nextIndex < workflow.steps.length) {
        workflow.currentStepIndex = nextIndex;
        workflow.steps[nextIndex].status = 'in-progress';
        workflow.steps[nextIndex].startedAt = new Date();
        if (staffId) {
          const staff = await User.findById(staffId);
          if (staff) {
            applyWorkflowStepAssignment(workflow.steps[nextIndex], [staff], staffId);
          }
        }
      } else {
        // All steps completed or skipped
        workflow.status = 'completed';
        workflow.completedAt = new Date();
      }

      // Add timeline entry
      const staff = await User.findById(staffId);
      await OrderService._autoAssignStaff(order, staffId);
      order.timeline.push({
        status: 'Workflow Step Skipped',
        description: `Step "${step.stepName}" skipped in workflow "${workflow.workflowName}". Reason: ${reason || 'Not provided'}`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Staff Member'
      });

      // Update order progress
      const totalSteps = workflow.steps.length;
      const completedOrSkippedSteps = workflow.steps.filter(s => s.status === 'completed' || s.status === 'skipped').length;

      if (order.workflows.length > 0) {
        const totalProgress = order.workflows.reduce((sum, wf) => {
          const wfCompletedSteps = wf.steps.filter(s => s.status === 'completed' || s.status === 'skipped').length;
          return sum + (wfCompletedSteps / wf.steps.length) * 100;
        }, 0);
        order.progress = Math.round(totalProgress / order.workflows.length);
      }

      const updatedOrder = await order.save();

      if (Number(updatedOrder.progress || 0) !== previousProgress) {
        const progressDelta = Number(updatedOrder.progress || 0) - previousProgress;
        await this.notifyCustomerOrderUpdate(
          updatedOrder,
          `Ihr Auftrag ${updatedOrder.orderNumber} wurde im Reparaturprozess aktualisiert: ${updatedOrder.progress || 0}% (${progressDelta >= 0 ? '+' : ''}${progressDelta}%). Ein Schritt wurde uebersprungen.`
        );
      }

      console.log('OrderService: Workflow step skipped successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error skipping workflow step:', error);
      throw error;
    }
  }

  // Pause/Resume workflow
  static async updateWorkflowStatus(orderId, workflowId, status, staffId, pauseReason = null) {
    console.log('OrderService: Updating workflow status:', { orderId, workflowId, status, staffId, pauseReason });

    try {
      // Fetch order without auto-population to avoid validation issues when saving
      // The skipAutoPopulate option prevents the pre-find hook from populating references
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });

      if (!order) {
        console.error('OrderService: Order not found:', orderId);
        throw new Error('Order not found');
      }

      const workflow = order.workflows.id(workflowId);
      if (!workflow) {
        console.error('OrderService: Workflow not found in order:', workflowId);
        throw new Error('Workflow not found in order');
      }

      const validStatuses = ['not-started', 'in-progress', 'on-hold', 'completed'];
      if (!validStatuses.includes(status)) {
        console.error('OrderService: Invalid workflow status:', status);
        throw new Error('Invalid workflow status');
      }

      const oldStatus = workflow.status;
      const oldOrderStatus = order.status;
      workflow.status = status;

      const hasActiveWorkflow = () => order.workflows.some((workflowItem) => {
        if (!workflowItem || String(workflowItem._id) === String(workflowId)) {
          return false;
        }

        return workflowItem.status === 'in-progress';
      });

      console.log('OrderService: Workflow status updating from', oldStatus, 'to', status);

      // If pausing workflow (status = 'on-hold'), handle pause reason and keep the order in the repair stage.
      if (status === 'on-hold' && oldStatus !== 'on-hold') {
        console.log('OrderService: Pausing workflow with reason:', pauseReason);
        const pauseStartedAt = new Date();

        // Record pause reason and timestamp
        if (pauseReason) {
          workflow.pauseReason = pauseReason;
          console.log('OrderService: Pause reason recorded:', pauseReason);
        }

        workflow.pausedAt = pauseStartedAt;
        console.log('OrderService: Pause timestamp recorded');

        const activeStepIndex = Number(workflow.currentStepIndex || 0);
        const activeStep = workflow.steps[activeStepIndex] || workflow.steps.find((stepItem) => stepItem.status === 'in-progress');

        if (activeStep && activeStep.status === 'in-progress') {
          if (!activeStep.currentPauseStartedAt) {
            activeStep.currentPauseStartedAt = pauseStartedAt;
          }

          if (!Array.isArray(activeStep.pauseHistory)) {
            activeStep.pauseHistory = [];
          }

          activeStep.pauseHistory.push({
            pausedAt: pauseStartedAt,
            reason: pauseReason || 'Kein Grund angegeben',
            stepId: activeStep.stepId,
            stepName: activeStep.stepName,
            stepIndex: activeStepIndex,
          });

          if (!Array.isArray(workflow.pauseHistory)) {
            workflow.pauseHistory = [];
          }

          workflow.pauseHistory.push({
            pausedAt: pauseStartedAt,
            reason: pauseReason || 'Kein Grund angegeben',
            stepId: activeStep.stepId,
            stepName: activeStep.stepName,
            stepIndex: activeStepIndex,
          });
        }

        const nextOrderStatus = hasActiveWorkflow() ? 'in-progress' : 'paused';
        order.status = nextOrderStatus;
        console.log('OrderService: Order status changed from', oldOrderStatus, 'to', nextOrderStatus);
      }

      // If resuming workflow (status = 'in-progress'), clear pause reason and return the order to repair mode.
      if (status === 'in-progress' && oldStatus === 'on-hold') {
        console.log('OrderService: Resuming workflow, clearing pause reason');
        const resumedAt = new Date();

        if (workflow.pausedAt) {
          const pausedAtTs = new Date(workflow.pausedAt).getTime();
          const resumedAtTs = resumedAt.getTime();
          if (Number.isFinite(pausedAtTs) && resumedAtTs > pausedAtTs) {
            const workflowPauseDuration = Math.round((resumedAtTs - pausedAtTs) / (1000 * 60));
            workflow.totalPausedMinutes = Number(workflow.totalPausedMinutes || 0) + workflowPauseDuration;

            if (!Array.isArray(workflow.pauseHistory)) {
              workflow.pauseHistory = [];
            }

            const openWorkflowPause = [...workflow.pauseHistory].reverse().find((entry) => !entry.resumedAt);
            if (openWorkflowPause) {
              openWorkflowPause.resumedAt = resumedAt;
              openWorkflowPause.durationMinutes = workflowPauseDuration;
            }
          }
        }

        const activeStepIndex = Number(workflow.currentStepIndex || 0);
        const activeStep = workflow.steps[activeStepIndex] || workflow.steps.find((stepItem) => stepItem.status === 'in-progress');

        if (activeStep && activeStep.currentPauseStartedAt) {
          const stepPausedAtTs = new Date(activeStep.currentPauseStartedAt).getTime();
          const resumedAtTs = resumedAt.getTime();
          if (Number.isFinite(stepPausedAtTs) && resumedAtTs > stepPausedAtTs) {
            const stepPauseDuration = Math.round((resumedAtTs - stepPausedAtTs) / (1000 * 60));
            activeStep.totalPausedMinutes = Number(activeStep.totalPausedMinutes || 0) + stepPauseDuration;

            if (!Array.isArray(activeStep.pauseHistory)) {
              activeStep.pauseHistory = [];
            }

            const openStepPause = [...activeStep.pauseHistory].reverse().find((entry) => !entry.resumedAt);
            if (openStepPause) {
              openStepPause.resumedAt = resumedAt;
              openStepPause.durationMinutes = stepPauseDuration;
            }
          }

          activeStep.currentPauseStartedAt = undefined;
        }

        workflow.pauseReason = '';
        workflow.pausedAt = null;
        if (order.status === 'paused' || order.status === 'pending') {
          order.status = 'in-progress';
        }
        console.log('OrderService: Pause reason and timestamp cleared');
      }

      // Get staff details for timeline entry
      const staff = await User.findById(staffId);
      const staffName = staff ? staff.name : 'Staff Member';

      await OrderService._autoAssignStaff(order, staffId);

      // Add timeline entry for workflow status change
      let timelineDescription = `Workflow "${workflow.workflowName}" status changed from ${oldStatus} to ${status}`;
      if (status === 'on-hold' && pauseReason) {
        timelineDescription += ` - Reason: ${pauseReason}`;
      }

      order.timeline.push({
        status: status === 'on-hold' ? 'Workflow Paused' : (status === 'in-progress' ? 'Workflow Resumed' : 'Workflow Status Updated'),
        description: timelineDescription,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staffName
      });
      console.log('OrderService: Timeline entry added for workflow status change');

      // If order status changed (pausing), add separate timeline entry
      if (oldOrderStatus !== order.status) {
        order.timeline.push({
          status: 'Order Status Updated',
          description: `Order status changed from ${oldOrderStatus} to ${order.status} due to workflow status update`,
          completedAt: new Date(),
          staffId: staffId || 'system',
          staffName: staffName
        });
        console.log('OrderService: Timeline entry added for order status change');
      }

      const updatedOrder = await order.save();

      if (oldOrderStatus !== updatedOrder.status) {
        const oldStatusLabel = this.getStatusLabel(oldOrderStatus);
        const newStatusLabel = this.getStatusLabel(updatedOrder.status);
        const pauseHint = status === 'on-hold' && pauseReason ? ` Grund: ${pauseReason}` : '';

        await this.notifyCustomerOrderUpdate(
          updatedOrder,
          `Ihr Auftrag ${updatedOrder.orderNumber} hat den Status gewechselt: ${oldStatusLabel} -> ${newStatusLabel}.${pauseHint} Aktueller Fortschritt: ${updatedOrder.progress || 0}%.`,
          updatedOrder.status
        );
      }

      console.log('OrderService: Workflow status updated successfully:', {
        workflowStatus: status,
        orderStatus: updatedOrder.status,
        pauseReason: pauseReason || 'N/A'
      });
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error updating workflow status:', error);
      console.error('OrderService: Error details:', {
        message: error.message,
        stack: error.stack,
        orderId,
        workflowId,
        status,
        staffId,
        pauseReason
      });
      throw error;
    }
  }

  // Navigate to previous step
  static async goBackToStep(orderId, workflowId, stepId, staffId) {
    console.log('OrderService: Going back to workflow step:', { orderId, workflowId, stepId, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const workflow = order.workflows.id(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found in order');
      }

      const stepIndex = workflow.steps.findIndex(s => s._id.toString() === stepId);
      if (stepIndex === -1) {
        throw new Error('Step not found in workflow');
      }

      const step = workflow.steps[stepIndex];

      // Can only go back to completed or skipped steps
      if (step.status !== 'completed' && step.status !== 'skipped') {
        throw new Error('Can only navigate back to completed or skipped steps');
      }

      const previousProgress = Number(order.progress || 0);

      // Reset the target step to in-progress
      step.status = 'in-progress';
      step.startedAt = new Date();
      if (staffId) {
        const stepStaff = await User.findById(staffId);
        if (stepStaff) {
          applyWorkflowStepAssignment(step, [stepStaff], staffId);
        }
      }
      step.completedAt = undefined;

      // Reset all steps after the target step to pending
      for (let i = stepIndex + 1; i < workflow.steps.length; i++) {
        workflow.steps[i].status = 'pending';
        workflow.steps[i].startedAt = undefined;
        workflow.steps[i].completedAt = undefined;
        workflow.steps[i].assignedStaffId = undefined;
        workflow.steps[i].assignedStaff = [];
      }

      // Update workflow
      workflow.currentStepIndex = stepIndex;
      workflow.status = 'in-progress';
      workflow.completedAt = undefined;

      // Add timeline entry
      const staff = await User.findById(staffId);
      await OrderService._autoAssignStaff(order, staffId);
      order.timeline.push({
        status: 'Workflow Navigation',
        description: `Navigated back to step "${step.stepName}" in workflow "${workflow.workflowName}"`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Staff Member'
      });

      // Update order progress
      if (order.workflows.length > 0) {
        const totalProgress = order.workflows.reduce((sum, wf) => {
          const wfCompletedSteps = wf.steps.filter(s => s.status === 'completed' || s.status === 'skipped').length;
          return sum + (wfCompletedSteps / wf.steps.length) * 100;
        }, 0);
        order.progress = Math.round(totalProgress / order.workflows.length);
      }

      const updatedOrder = await order.save();

      if (Number(updatedOrder.progress || 0) !== previousProgress) {
        const progressDelta = Number(updatedOrder.progress || 0) - previousProgress;
        await this.notifyCustomerOrderUpdate(
          updatedOrder,
          `Ihr Auftrag ${updatedOrder.orderNumber} wurde im Reparaturprozess zurueckgesetzt. Neuer Fortschritt: ${updatedOrder.progress || 0}% (${progressDelta >= 0 ? '+' : ''}${progressDelta}%).`
        );
      }

      console.log('OrderService: Successfully navigated back to step');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error navigating back to step:', error);
      throw error;
    }
  }

  // Get workflow for order
  static async getOrderWorkflows(orderId) {
    console.log('OrderService: Getting workflows for order:', orderId);

    try {
      const order = await Order.findById(orderId)
        .populate('workflows.workflowTemplateId')
        .populate('workflows.assignedStaffId', 'name avatar')
        .populate('workflows.assignedStaff.staffId', 'name avatar')
        .populate('workflows.steps.assignedStaffId', 'name avatar')
        .populate('workflows.steps.assignedStaff.staffId', 'name avatar');

      if (!order) {
        throw new Error('Order not found');
      }

      // Enrich workflow steps with form fields and checklist items from template
      const enrichedWorkflows = order.workflows.map((workflow) => {
        const workflowObj = workflow.toObject();

        if (workflowObj.workflowTemplateId && workflowObj.workflowTemplateId.steps) {
          // Create a map of template steps by stepId for quick lookup
          const templateStepsMap = {};
          workflowObj.workflowTemplateId.steps.forEach((step) => {
            templateStepsMap[step._id.toString()] = step;
          });

          // Enrich execution steps with template data
          workflowObj.steps = workflowObj.steps.map((execStep) => {
            const templateStep = templateStepsMap[execStep.stepId?.toString()];
            if (templateStep) {
              return {
                ...execStep,
                name: templateStep.name || execStep.stepName,
                description: templateStep.description,
                checklistItems: templateStep.checklistItems || [],
                formFields: templateStep.formFields || [],
                requiresFormCompletion: templateStep.requiresFormCompletion,
                canSkip: templateStep.canSkip,
                estimatedTime: templateStep.estimatedTime,
              };
            }
            return execStep;
          });
        }

        return workflowObj;
      });

      console.log('OrderService: Found', order.workflows.length, 'workflows for order');
      console.log('OrderService: Enriched workflows with form fields and checklist items');
      return enrichedWorkflows;
    } catch (error) {
      console.error('OrderService: Error getting order workflows:', error);
      throw error;
    }
  }

  // —SUGGESTED_WORKFLOWS_FIX (file `server/services/orderService.js`) —
  // Description: Get suggested workflows for order based on device type and services, including general workflows available for all devices/services
  // Enhancement: Now returns both specific device/service type matches and general workflows with empty arrays
  // This allows German workflows (like general repair process, quality check, etc.) to be suggested for all orders
  static async getSuggestedWorkflows(orderId) {
    console.log('OrderService: Getting suggested workflows for order:', orderId);

    try {
      const order = await Order.findById(orderId).populate('services.serviceId');
      if (!order) {
        throw new Error('Order not found');
      }

      console.log('OrderService: Order details for workflow matching:', {
        orderId,
        deviceType: order.deviceType,
        serviceCount: order.services?.length || 0,
        services: order.services?.map(s => ({
          serviceId: s.serviceId?._id,
          serviceName: s.serviceId?.name,
          serviceCategory: s.serviceId?.category
        }))
      });

      // Extract service categories from the order services
      const serviceCategories = [];
      if (order.services && order.services.length > 0) {
        order.services.forEach(orderService => {
          if (orderService.serviceId && orderService.serviceId.category) {
            if (!serviceCategories.includes(orderService.serviceId.category)) {
              serviceCategories.push(orderService.serviceId.category);
            }
          }
        });
      }

      console.log('OrderService: Extracted service categories:', serviceCategories);
      console.log('OrderService: Looking for workflows with deviceTypes:', order.deviceType, 'and serviceTypes:', serviceCategories);
      console.log('OrderService: Also including general workflows available for all devices/services');

      // Find workflows matching device type and service categories, OR workflows available for all (empty arrays)
      // This includes:
      // 1. Specific device/service type matches (e.g., "Screen Replacement" for "Display" service on "Smartphone")
      // 2. General workflows with empty deviceTypes (available for all devices)
      // 3. General workflows with empty serviceTypes (available for all services)
      const workflows = await WorkflowTemplate.find({
        isActive: true,
        $or: [
          // Specific device type and service type match
          {
            deviceTypes: { $in: [order.deviceType] },
            serviceTypes: { $in: serviceCategories }
          },
          // General workflows available for all devices
          {
            deviceTypes: { $size: 0 }
          },
          // General workflows available for all services
          {
            serviceTypes: { $size: 0 }
          }
        ]
      }).sort({ createdAt: -1 });

      const assignedTemplateIds = (order.workflows || [])
        .map((assignedWorkflow) => toIdString(assignedWorkflow.workflowTemplateId))
        .filter(Boolean);

      const alwaysVisibleWorkflowNameMarkers = [
        'standard repair process neu',
        'reparatur-workflow',
      ];

      const suggestedWorkflows = workflows.filter(
        (workflow) => {
          const workflowName = String(workflow?.name || '').trim().toLowerCase();
          const shouldAlwaysBeVisible = alwaysVisibleWorkflowNameMarkers.some((marker) =>
            workflowName.includes(marker)
          );

          if (shouldAlwaysBeVisible) {
            return true;
          }

          return !assignedTemplateIds.includes(toIdString(workflow._id));
        }
      );

      console.log('OrderService: Found', suggestedWorkflows.length, 'suggested workflows');
      console.log('OrderService: Suggested workflows:', suggestedWorkflows.map(w => ({
        id: w._id,
        name: w.name,
        deviceTypes: w.deviceTypes,
        serviceTypes: w.serviceTypes,
        stepsCount: w.steps?.length || 0
      })));

      return suggestedWorkflows;
    } catch (error) {
      console.error('OrderService: Error getting suggested workflows:', error);
      throw error;
    }
  }
  // —END_OF_SUGGESTED_WORKFLOWS_FIX—

  // Description: Get order progress timeline with milestone data
  // Returns structured stages with completion status and dates
  static async getProgressTimeline(orderId) {
    console.log('OrderService: Getting progress timeline for order:', orderId);

    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Map timeline entries by status
      const timelineMap = {};
      if (order.timeline && order.timeline.length > 0) {
        order.timeline.forEach(entry => {
          timelineMap[entry.status] = entry;
        });
      }

      // Helper function to format date
      const formatDate = (date) => {
        if (!date) return null;
        return new Date(date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      };

      // Define timeline stages
      const stages = [
        {
          id: 'order-received',
          label: 'Order Received',
          status: 'completed', // Always completed when order exists
          date: formatDate(order.createdAt)
        },
        {
          id: 'diagnostic',
          label: 'Diagnostic Assessment',
          status: timelineMap['Diagnostic Assessment']
            ? 'completed'
            : order.status === 'diagnostic-assessment'
              ? 'in-progress'
              : (order.status !== 'pending' ? 'completed' : 'pending'),
          date: timelineMap['Diagnostic Assessment'] ? formatDate(timelineMap['Diagnostic Assessment'].completedAt) : null
        },
        {
          id: 'repair',
          label: 'Repair in Progress',
          status: (order.status === 'in-progress' || order.status === 'paused')
            ? 'in-progress'
            : (order.status === 'quality-check' || order.status === 'completed' || order.status === 'ready-for-pickup'
              ? 'completed'
              : 'pending'),
          date: timelineMap['Repair in Progress'] ? formatDate(timelineMap['Repair in Progress'].completedAt) : null
        },
        {
          id: 'quality-check',
          label: 'Quality Check',
          status: order.status === 'quality-check' ? 'in-progress' : (order.status === 'completed' || order.status === 'ready-for-pickup' ? 'completed' : 'pending'),
          date: timelineMap['Quality Check'] ? formatDate(timelineMap['Quality Check'].completedAt) : null
        },
        {
          id: 'pickup',
          label: order.status === 'ready-for-pickup' ? 'Ready for Pickup' : 'Completed',
          status: order.status === 'completed' || order.status === 'ready-for-pickup' ? 'completed' : 'pending',
          date: order.actualCompletion ? formatDate(order.actualCompletion) : null
        }
      ];

      // Determine current stage based on order status
      let currentStage = 'order-received';
      if (order.status === 'diagnostic-assessment') {
        currentStage = 'diagnostic';
      } else if (order.status === 'in-progress' || order.status === 'paused') {
        currentStage = 'repair';
      } else if (order.status === 'quality-check') {
        currentStage = 'quality-check';
      } else if (order.status === 'completed' || order.status === 'ready-for-pickup') {
        currentStage = 'pickup';
      }

      console.log('OrderService: Progress timeline calculated for order:', orderId, 'Current stage:', currentStage);

      return {
        stages,
        currentStage,
        orderStatus: order.status,
        progress: order.progress
      };
    } catch (error) {
      console.error('OrderService: Error getting progress timeline:', error);
      throw error;
    }
  }

  // Confirm/verify unlock code or pattern
  static async confirmUnlock(orderId, userId, userName, confirmationStatus, notes = '') {
    console.log('OrderService: Confirming unlock for order:', orderId, 'by user:', userName);

    try {
      // Validate order exists
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      // Validate user has unlock information
      if (!order.unlockPattern.length && !order.unlockCode && !order.noLock) {
        throw new Error('No unlock information to confirm for this order');
      }

      // Validate confirmation status
      if (!['verified', 'incorrect', 'unable-to-verify'].includes(confirmationStatus)) {
        throw new Error('Invalid confirmation status. Must be verified, incorrect, or unable-to-verify');
      }

      // Update order with confirmation
      order.unlockConfirmation = {
        confirmedBy: userId,
        confirmedByName: userName,
        confirmationStatus: confirmationStatus,
        notes: notes,
        confirmedAt: new Date()
      };

      const updatedOrder = await order.save();
      console.log('OrderService: Unlock confirmation recorded for order:', orderId);

      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error confirming unlock:', error);
      throw error;
    }
  }

  // Update device information for order
  static async updateDevice(orderId, deviceData, userId, userName) {
    console.log('OrderService: Updating device information for order:', orderId, 'Device:', deviceData);

    try {
      // Validate order exists
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      // Store old device information for timeline
      const oldDeviceBrand = order.deviceBrand;
      const oldDeviceModel = order.deviceModel;
      const oldDeviceType = order.deviceType;

      // Update device information
      if (deviceData.deviceBrand) {
        order.deviceBrand = deviceData.deviceBrand;
      }
      if (deviceData.deviceModel) {
        order.deviceModel = deviceData.deviceModel;
      }
      if (deviceData.deviceType) {
        order.deviceType = deviceData.deviceType;
      }

      // Add timeline entry for device change
      order.timeline.push({
        status: 'Device Changed',
        description: `Device changed from ${oldDeviceBrand} ${oldDeviceModel} to ${deviceData.deviceBrand} ${deviceData.deviceModel}`,
        completedAt: new Date(),
        staffId: userId,
        staffName: userName
      });

      const updatedOrder = await order.save();
      console.log('OrderService: Device information updated for order:', orderId);

      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error updating device information:', error);
      throw error;
    }
  }

  // Add shop product to order
  static async addShopProduct(orderId, productId, quantity, userId) {
    console.log('OrderService: Adding shop product to order:', orderId, 'Product:', productId, 'Quantity:', quantity);

    try {
      // Validate order exists
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      // Validate product exists and has stock
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      if (product.stock < quantity) {
        throw new Error(`Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`);
      }

      // Check if product already exists in order
      const existingProductIndex = order.shopProducts.findIndex(
        p => p.productId && p.productId.toString() === productId.toString()
      );

      if (existingProductIndex !== -1) {
        // Update quantity
        order.shopProducts[existingProductIndex].quantity += quantity;
        console.log('OrderService: Updated quantity for existing product in order');
      } else {
        // Add new product
        order.shopProducts.push({
          productId: productId,
          quantity: quantity,
          priceAtOrder: product.price,
          addedBy: userId,
          addedAt: new Date()
        });
        console.log('OrderService: Added new product to order');
      }

      // Recalculate total cost
      await this.recalculateOrderTotal(order);

      const updatedOrder = await order.save();
      console.log('OrderService: Shop product added successfully to order:', orderId);

      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error adding shop product to order:', error);
      throw error;
    }
  }

  // Remove shop product from order
  static async removeShopProduct(orderId, productItemId, userId) {
    console.log('OrderService: Removing shop product from order:', orderId, 'Product item:', productItemId);

    try {
      // Validate order exists
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      // Find and remove the product
      const productIndex = order.shopProducts.findIndex(
        p => p._id && p._id.toString() === productItemId.toString()
      );

      if (productIndex === -1) {
        throw new Error('Product not found in order');
      }

      order.shopProducts.splice(productIndex, 1);
      console.log('OrderService: Shop product removed from order');

      // Recalculate total cost
      await this.recalculateOrderTotal(order);

      const updatedOrder = await order.save();
      console.log('OrderService: Shop product removed successfully from order:', orderId);

      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error removing shop product from order:', error);
      throw error;
    }
  }

  // Update shop product quantity in order
  static async updateShopProductQuantity(orderId, productItemId, quantity, userId) {
    console.log('OrderService: Updating shop product quantity in order:', orderId, 'Product item:', productItemId, 'New quantity:', quantity);

    try {
      // Validate order exists
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      // Find the product
      const productItem = order.shopProducts.find(
        p => p._id && p._id.toString() === productItemId.toString()
      );

      if (!productItem) {
        throw new Error('Product not found in order');
      }

      // Validate product stock
      const product = await Product.findById(productItem.productId);
      if (!product) {
        throw new Error('Product not found in database');
      }

      if (product.stock < quantity) {
        throw new Error(`Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`);
      }

      // Update quantity
      productItem.quantity = quantity;
      console.log('OrderService: Shop product quantity updated');

      // Recalculate total cost
      await this.recalculateOrderTotal(order);

      const updatedOrder = await order.save();
      console.log('OrderService: Shop product quantity updated successfully in order:', orderId);

      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error updating shop product quantity:', error);
      throw error;
    }
  }

  // Helper method to recalculate order total
  static async recalculateOrderTotal(order) {
    console.log('OrderService: Recalculating order total for order:', order._id);

    let total = 0;

    // Add services cost
    if (order.services && order.services.length > 0) {
      order.services.forEach(service => {
        const price = Number(service.price) || 0;
        total += price;
      });
    }

    // Add add-ons cost
    if (order.addOns && order.addOns.length > 0) {
      order.addOns.forEach(addon => {
        const price = Number(addon.price) || 0;
        total += price;
      });
    }

    // Add shop products cost
    if (order.shopProducts && order.shopProducts.length > 0) {
      order.shopProducts.forEach(product => {
        const price = Number(product.priceAtOrder) || 0;
        const quantity = Number(product.quantity) || 0;
        total += price * quantity;
      });
    }

    order.totalCost = total;
    console.log('OrderService: Total cost recalculated:', total);
  }

  // Remove workflow from order
  static async removeWorkflowFromOrder(orderId, workflowId, staffId) {
    console.log('OrderService: Removing workflow from order:', { orderId, workflowId, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      // Find the workflow to remove
      const workflowIndex = order.workflows.findIndex(
        w => w._id.toString() === workflowId
      );

      if (workflowIndex === -1) {
        throw new Error('Workflow not found in order');
      }

      const removedWorkflow = order.workflows[workflowIndex];
      console.log('OrderService: Found workflow to remove:', removedWorkflow.workflowName);

      // Remove workflow from array
      order.workflows.splice(workflowIndex, 1);

      // Add timeline entry
      const staff = await User.findById(staffId);
      await OrderService._autoAssignStaff(order, staffId);
      order.timeline.push({
        status: 'Workflow Removed',
        description: `Workflow "${removedWorkflow.workflowName}" removed from order`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'System'
      });

      const updatedOrder = await order.save();
      console.log('OrderService: Workflow removed successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error removing workflow:', error);
      throw error;
    }
  }
}

module.exports = OrderService;