const Order = require('../models/Order');
const User = require('../models/User');
const Inventory = require('../models/Inventory');
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

      const order = new Order(orderData);
      const savedOrder = await order.save();
      
      console.log('OrderService: Order created successfully with ID:', savedOrder._id);
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
      console.log('OrderService: Orders data:', JSON.stringify(orders, null, 2));
      return orders;
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
      
      return {
        orders,
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
      return order;
    } catch (error) {
      console.error('OrderService: Error getting order by ID:', error);
      throw error;
    }
  }

  // Update order status
  static async updateStatus(orderId, status, note = null, staffId = null) {
    console.log('OrderService: Updating order status:', orderId, 'to', status);
    
    try {
      const order = await Order.findById(orderId);
      
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
      const order = await Order.findById(orderId);
      
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
      const order = await Order.findById(orderId);
      
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
      const order = await Order.findById(orderId);
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
      const order = await Order.findById(orderId);
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
      const order = await Order.findById(orderId);
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
      const order = await Order.findById(orderId);
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

      const updatedOrder = await order.save();

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
      const order = await Order.findById(orderId);
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
      const order = await Order.findById(orderId);
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
      const order = await Order.findById(orderId);
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
      const order = await Order.findById(orderId);
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
      const order = await Order.findById(orderId);
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
      const order = await Order.findById(orderId);
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
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Find workflows matching device type and services
      const workflows = await WorkflowTemplate.find({
        isActive: true,
        deviceTypes: { $in: [order.deviceType] },
        serviceTypes: { $in: order.services }
      }).sort({ createdAt: -1 });

      console.log('OrderService: Found', workflows.length, 'suggested workflows');
      return workflows;
    } catch (error) {
      console.error('OrderService: Error getting suggested workflows:', error);
      throw error;
    }
  }
}

module.exports = OrderService;