const Order = require('../models/Order');
const User = require('../models/User');
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const Service = require('../models/Service');
const { WorkflowTemplate, AddOnWorkflow } = require('../models/Workflow');

class OrderService {
  // Create a new order
  static async create(orderData) {
    console.log('OrderService: Creating new order with data:', orderData);

    try {
      // Validate customer exists
      const customer = await User.findById(orderData.customerId);
      if (!customer) {
        throw new Error('Customer not found');
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

      // Convert to plain objects and ensure totalCost is a number
      const plainOrders = orders.map(order => {
        const plain = order.toObject ? order.toObject() : order;
        if (plain.totalCost !== undefined && typeof plain.totalCost === 'object') {
          plain.totalCost = Number(plain.totalCost);
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
        query['assignedStaff.staffId'] = filters.assignedStaff;
      }

      if (filters.search) {
        query.$or = [
          { orderNumber: { $regex: filters.search, $options: 'i' } },
          { deviceBrand: { $regex: filters.search, $options: 'i' } },
          { deviceModel: { $regex: filters.search, $options: 'i' } }
        ];
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

      // Convert to plain objects and ensure totalCost is a number
      const plainOrders = orders.map(order => {
        const plain = order.toObject ? order.toObject() : order;
        if (plain.totalCost !== undefined && typeof plain.totalCost === 'object') {
          plain.totalCost = Number(plain.totalCost);
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

      // Convert to plain object and ensure totalCost is a number
      const plain = order.toObject ? order.toObject() : order;
      if (plain.totalCost !== undefined && typeof plain.totalCost === 'object') {
        plain.totalCost = Number(plain.totalCost);
      }

      return plain;
    } catch (error) {
      console.error('OrderService: Error getting order by ID:', error);
      throw error;
    }
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

      // Add timeline entry
      let staffName = 'System';
      if (staffId) {
        const staff = await User.findById(staffId);
        staffName = staff ? staff.name : 'Staff Member';
      }

      order.timeline.push({
        status: status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' '),
        description: note || `Status changed from ${oldStatus} to ${status}`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName
      });

      const updatedOrder = await order.save();
      
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
        avatar: staff.avatar || ''
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
  static async assignWorkflowToOrder(orderId, workflowTemplateId, staffId) {
    console.log('OrderService: Assigning workflow to order:', { orderId, workflowTemplateId, staffId });

    try {
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
      if (!order) {
        throw new Error('Order not found');
      }

      const workflowTemplate = await WorkflowTemplate.findById(workflowTemplateId);
      if (!workflowTemplate) {
        throw new Error('Workflow template not found');
      }

      // Check if workflow is already assigned
      const existingWorkflow = order.workflows.find(
        w => w.workflowTemplateId.toString() === workflowTemplateId
      );
      if (existingWorkflow) {
        throw new Error('This workflow is already assigned to this order');
      }

      // Create workflow execution steps from template
      const workflowSteps = workflowTemplate.steps.map(step => ({
        stepId: step._id.toString(),
        stepName: step.name,
        status: 'pending',
        formData: {},
        checklistData: new Map(),
        photos: []
      }));

      // Add workflow to order
      order.workflows.push({
        workflowTemplateId,
        workflowName: workflowTemplate.name,
        steps: workflowSteps,
        currentStepIndex: 0,
        status: 'not-started',
        estimatedCompletionTime: workflowTemplate.estimatedTotalTime
      });

      // Add timeline entry
      const staff = await User.findById(staffId);
      order.timeline.push({
        status: 'Workflow Assigned',
        description: `Workflow "${workflowTemplate.name}" assigned to order`,
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

      workflow.status = 'in-progress';
      workflow.startedAt = new Date();

      // Set first step to in-progress
      if (workflow.steps.length > 0) {
        workflow.steps[0].status = 'in-progress';
        workflow.steps[0].startedAt = new Date();
        workflow.steps[0].assignedStaffId = staffId;
      }

      // Add timeline entry
      const staff = await User.findById(staffId);
      order.timeline.push({
        status: 'Workflow Started',
        description: `Workflow "${workflow.workflowName}" started by ${staff ? staff.name : 'Staff'}`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Staff Member'
      });

      const updatedOrder = await order.save();

      console.log('OrderService: Workflow started successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error starting workflow:', error);
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

      // Update step data
      step.status = 'completed';
      step.completedAt = new Date();
      if (stepData.formData) step.formData = stepData.formData;
      if (stepData.checklistData) step.checklistData = stepData.checklistData;
      if (stepData.notes) step.notes = stepData.notes;
      if (stepData.photos) step.photos = stepData.photos;

      // Move to next step
      const currentIndex = workflow.steps.findIndex(s => s._id.toString() === stepId);
      const nextIndex = currentIndex + 1;

      if (nextIndex < workflow.steps.length) {
        workflow.currentStepIndex = nextIndex;
        workflow.steps[nextIndex].status = 'in-progress';
        workflow.steps[nextIndex].startedAt = new Date();
        workflow.steps[nextIndex].assignedStaffId = staffId;
      } else {
        // All steps completed
        workflow.status = 'completed';
        workflow.completedAt = new Date();
      }

      // Add timeline entry
      const staff = await User.findById(staffId);
      order.timeline.push({
        status: 'Workflow Step Completed',
        description: `Step "${step.stepName}" completed in workflow "${workflow.workflowName}"`,
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

      // Update step status
      step.status = 'skipped';
      step.completedAt = new Date();
      step.notes = reason || 'Step skipped';

      // Move to next step
      const currentIndex = workflow.steps.findIndex(s => s._id.toString() === stepId);
      const nextIndex = currentIndex + 1;

      if (nextIndex < workflow.steps.length) {
        workflow.currentStepIndex = nextIndex;
        workflow.steps[nextIndex].status = 'in-progress';
        workflow.steps[nextIndex].startedAt = new Date();
        workflow.steps[nextIndex].assignedStaffId = staffId;
      } else {
        // All steps completed or skipped
        workflow.status = 'completed';
        workflow.completedAt = new Date();
      }

      // Add timeline entry
      const staff = await User.findById(staffId);
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

      console.log('OrderService: Workflow step skipped successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error skipping workflow step:', error);
      throw error;
    }
  }

  // Pause/Resume workflow
  static async updateWorkflowStatus(orderId, workflowId, status, staffId) {
    console.log('OrderService: Updating workflow status:', { orderId, workflowId, status, staffId });

    try {
      // Fetch order without auto-population to avoid validation issues when saving
      // The skipAutoPopulate option prevents the pre-find hook from populating references
      const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });

      if (!order) {
        throw new Error('Order not found');
      }

      const workflow = order.workflows.id(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found in order');
      }

      const validStatuses = ['not-started', 'in-progress', 'on-hold', 'completed'];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid workflow status');
      }

      const oldStatus = workflow.status;
      workflow.status = status;

      // Add timeline entry
      const staff = await User.findById(staffId);
      order.timeline.push({
        status: 'Workflow Status Updated',
        description: `Workflow "${workflow.workflowName}" status changed from ${oldStatus} to ${status}`,
        completedAt: new Date(),
        staffId: staffId || 'system',
        staffName: staff ? staff.name : 'Staff Member'
      });

      const updatedOrder = await order.save();

      console.log('OrderService: Workflow status updated successfully');
      return updatedOrder;
    } catch (error) {
      console.error('OrderService: Error updating workflow status:', error);
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

      // Reset the target step to in-progress
      step.status = 'in-progress';
      step.startedAt = new Date();
      step.assignedStaffId = staffId;
      step.completedAt = undefined;

      // Reset all steps after the target step to pending
      for (let i = stepIndex + 1; i < workflow.steps.length; i++) {
        workflow.steps[i].status = 'pending';
        workflow.steps[i].startedAt = undefined;
        workflow.steps[i].completedAt = undefined;
        workflow.steps[i].assignedStaffId = undefined;
      }

      // Update workflow
      workflow.currentStepIndex = stepIndex;
      workflow.status = 'in-progress';
      workflow.completedAt = undefined;

      // Add timeline entry
      const staff = await User.findById(staffId);
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
        .populate('workflows.steps.assignedStaffId', 'name avatar');

      if (!order) {
        throw new Error('Order not found');
      }

      console.log('OrderService: Found', order.workflows.length, 'workflows for order');
      return order.workflows;
    } catch (error) {
      console.error('OrderService: Error getting order workflows:', error);
      throw error;
    }
  }

  // Get suggested workflows for order based on device type and services
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

      // Find workflows matching device type and service categories
      const workflows = await WorkflowTemplate.find({
        isActive: true,
        deviceTypes: { $in: [order.deviceType] },
        serviceTypes: { $in: serviceCategories }
      }).sort({ createdAt: -1 });

      console.log('OrderService: Found', workflows.length, 'suggested workflows');
      console.log('OrderService: Suggested workflows:', workflows.map(w => ({
        id: w._id,
        name: w.name,
        deviceTypes: w.deviceTypes,
        serviceTypes: w.serviceTypes,
        stepsCount: w.steps?.length || 0
      })));

      return workflows;
    } catch (error) {
      console.error('OrderService: Error getting suggested workflows:', error);
      throw error;
    }
  }

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
          status: timelineMap['Diagnostic Assessment'] ? 'completed' : (order.status !== 'pending' ? 'completed' : 'pending'),
          date: timelineMap['Diagnostic Assessment'] ? formatDate(timelineMap['Diagnostic Assessment'].completedAt) : null
        },
        {
          id: 'repair',
          label: 'Repair in Progress',
          status: order.status === 'in-progress' ? 'in-progress' : (order.status === 'in-progress' || order.status === 'quality-check' || order.status === 'completed' || order.status === 'ready-for-pickup' ? 'completed' : 'pending'),
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
      if (order.status === 'in-progress') {
        currentStage = 'repair';
      } else if (order.status === 'quality-check') {
        currentStage = 'quality-check';
      } else if (order.status === 'completed' || order.status === 'ready-for-pickup') {
        currentStage = 'pickup';
      } else if (order.status !== 'pending') {
        currentStage = 'diagnostic';
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
}

module.exports = OrderService;