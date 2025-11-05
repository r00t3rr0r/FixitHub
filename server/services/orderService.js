const Order = require('../models/Order');
const User = require('../models/User');

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
}

module.exports = OrderService;