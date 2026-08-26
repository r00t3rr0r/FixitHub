const Booking = require('../models/Booking');
const RepairRequest = require('../models/RepairRequest');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Order = require('../models/Order');
const Task = require('../models/Task');
const { WorkSession } = require('../models/TimeEntry');
const mongoose = require('mongoose');

/**
 * AdminDashboardService
 * Provides comprehensive data for the Admin Dashboard
 */
class AdminDashboardService {
  /**
   * Get recent bookings with customer details
   * @param {number} limit - Number of bookings to fetch
   * @returns {Promise<Array>} Recent bookings
   */
  static async getRecentBookings(limit = 10) {
    try {
      console.log(`AdminDashboardService: Fetching ${limit} recent bookings`);

      const bookings = await Booking.find({})
        .populate('customerId', 'firstName lastName email phone avatar')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const bookingIds = bookings.map((booking) => booking._id);
      const orderAssignmentsByBooking = bookingIds.length
        ? await Order.aggregate([
            { $match: { bookingId: { $in: bookingIds } } },
            {
              $project: {
                bookingId: 1,
                hasAssignedStaff: {
                  $gt: [{ $size: { $ifNull: ['$assignedStaff', []] } }, 0]
                }
              }
            },
            {
              $group: {
                _id: '$bookingId',
                hasAssignedStaff: { $max: '$hasAssignedStaff' },
                totalOrders: { $sum: 1 },
                assignedOrders: {
                  $sum: {
                    $cond: ['$hasAssignedStaff', 1, 0]
                  }
                }
              }
            }
          ])
        : [];

      const assignmentLookup = new Map(
        orderAssignmentsByBooking.map((entry) => [String(entry._id), entry])
      );

      const formattedBookings = bookings.map(booking => ({
        ...(assignmentLookup.has(String(booking._id))
          ? {
              hasAssignedStaff: Boolean(assignmentLookup.get(String(booking._id)).hasAssignedStaff),
              assignedOrdersCount: Number(assignmentLookup.get(String(booking._id)).assignedOrders || 0),
              totalOrdersCount: Number(assignmentLookup.get(String(booking._id)).totalOrders || 0)
            }
          : {
              hasAssignedStaff: false,
              assignedOrdersCount: 0,
              totalOrdersCount: 0
            }),
        _id: booking._id,
        bookingNumber: booking.bookingNumber,
        customer: booking.customerId ? {
          id: booking.customerId._id,
          name: `${booking.customerId.firstName || ''} ${booking.customerId.lastName || ''}`.trim(),
          email: booking.customerId.email,
          phone: booking.customerId.phone,
          avatar: booking.customerId.avatar
        } : null,
        status: booking.status,
        billingStatus: booking.billingStatus,
        paymentStatus: booking.paymentStatus,
        totalCost: booking.totalCost,
        itemsCount: booking.items?.length || 0,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt
      }));

      console.log(`AdminDashboardService: Retrieved ${formattedBookings.length} recent bookings`);
      return formattedBookings;
    } catch (error) {
      console.error('AdminDashboardService: Error fetching recent bookings:', error);
      throw error;
    }
  }

  /**
   * Get active repair requests with current status
   * @param {number} limit - Number of requests to fetch
   * @returns {Promise<Array>} Active repair requests
   */
  static async getActiveRepairRequests(limit = 10) {
    try {
      console.log(`AdminDashboardService: Fetching ${limit} active repair requests`);

      const requests = await RepairRequest.find({
        status: { $in: ['pending', 'reviewing', 'approved'] }
      })
        .populate('customerId', 'firstName lastName email phone avatar')
        .populate('assignedStaffId', 'name email')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const formattedRequests = requests.map(request => ({
        _id: request._id,
        requestNumber: request.requestNumber,
        customer: {
          id: request.customerId?._id,
          name: request.customerName,
          email: request.customerEmail,
          phone: request.customerPhone,
          avatar: request.customerId?.avatar
        },
        device: {
          type: request.deviceType,
          brand: request.deviceBrand,
          model: request.deviceModel
        },
        issueDescription: request.issueDescription,
        status: request.status,
        assignedStaff: request.assignedStaffId ? {
          id: request.assignedStaffId._id,
          name: request.assignedStaffName
        } : null,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt
      }));

      console.log(`AdminDashboardService: Retrieved ${formattedRequests.length} active repair requests`);
      return formattedRequests;
    } catch (error) {
      console.error('AdminDashboardService: Error fetching repair requests:', error);
      throw error;
    }
  }

  /**
   * Get recent notifications with urgency highlighting
   * @param {string} userId - User ID (optional, for admin-specific notifications)
   * @param {number} limit - Number of notifications to fetch
   * @returns {Promise<Object>} Notifications with counts
   */
  static async getRecentNotifications(userId = null, limit = 20) {
    try {
      console.log(`AdminDashboardService: Fetching ${limit} recent notifications`);

      // Build query - if userId provided, get user-specific, otherwise get system-wide
      const query = userId ? { userId } : {};

      const notifications = await Notification.find(query)
        .populate('orderId', 'orderNumber deviceBrand deviceModel status')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const unreadCount = await Notification.countDocuments({
        ...(userId ? { userId } : {}),
        isRead: false
      });

      const urgentCount = notifications.filter(n =>
        n.type === 'urgent' ||
        n.title?.toLowerCase().includes('urgent') ||
        n.message?.toLowerCase().includes('urgent')
      ).length;

      const formattedNotifications = notifications.map(notification => ({
        _id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        isRead: notification.isRead,
        isUrgent: notification.type === 'urgent' ||
                  notification.title?.toLowerCase().includes('urgent') ||
                  notification.message?.toLowerCase().includes('urgent'),
        orderId: notification.orderId?._id,
        orderNumber: notification.orderId?.orderNumber,
        actionUrl: notification.actionUrl,
        metadata: notification.metadata || {},
        createdAt: notification.createdAt,
        readAt: notification.readAt
      }));

      console.log(`AdminDashboardService: Retrieved ${formattedNotifications.length} notifications (${unreadCount} unread, ${urgentCount} urgent)`);

      return {
        notifications: formattedNotifications,
        unreadCount,
        urgentCount,
        totalCount: formattedNotifications.length
      };
    } catch (error) {
      console.error('AdminDashboardService: Error fetching notifications:', error);
      throw error;
    }
  }

  /**
   * Get recent system-wide activities
   * @param {number} limit - Number of activities to fetch
   * @returns {Promise<Array>} Recent activities
   */
  static async getRecentActivities(limit = 20) {
    try {
      console.log(`AdminDashboardService: Fetching ${limit} recent activities`);

      // Get recent orders
      const recentOrders = await Order.find({})
        .populate('customerId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(Math.ceil(limit / 3))
        .lean();

      // Get recent bookings
      const recentBookings = await Booking.find({})
        .populate('customerId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(Math.ceil(limit / 3))
        .lean();

      // Get recent repair requests
      const recentRequests = await RepairRequest.find({})
        .populate('customerId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(Math.ceil(limit / 3))
        .lean();

      // Combine and format activities
      const activities = [];

      recentOrders.forEach(order => {
        activities.push({
          id: order._id,
          type: 'order',
          action: order.status === 'pending' ? 'created' : 'updated',
          description: `Order ${order.orderNumber || order._id.toString().slice(-8).toUpperCase()} ${order.status === 'pending' ? 'created' : 'updated'}`,
          details: `${order.deviceBrand} ${order.deviceModel} - Status: ${order.status}`,
          user: order.customerId ? {
            name: `${order.customerId.firstName || ''} ${order.customerId.lastName || ''}`.trim(),
            email: order.customerId.email
          } : null,
          timestamp: order.updatedAt || order.createdAt,
          status: order.status
        });
      });

      recentBookings.forEach(booking => {
        activities.push({
          id: booking._id,
          type: 'booking',
          action: 'created',
          description: `Booking ${booking.bookingNumber} created`,
          details: `Total: $${booking.totalCost.toFixed(2)} - ${booking.items?.length || 0} items`,
          user: booking.customerId ? {
            name: `${booking.customerId.firstName || ''} ${booking.customerId.lastName || ''}`.trim(),
            email: booking.customerId.email
          } : null,
          timestamp: booking.createdAt,
          status: booking.status
        });
      });

      recentRequests.forEach(request => {
        activities.push({
          id: request._id,
          type: 'repair_request',
          action: request.status === 'pending' ? 'submitted' : 'updated',
          description: `Repair request ${request.requestNumber} ${request.status === 'pending' ? 'submitted' : 'updated'}`,
          details: `${request.deviceBrand} ${request.deviceModel} - Status: ${request.status}`,
          user: request.customerId ? {
            name: request.customerName,
            email: request.customerEmail
          } : null,
          timestamp: request.updatedAt || request.createdAt,
          status: request.status
        });
      });

      // Sort by timestamp and limit
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const limitedActivities = activities.slice(0, limit);

      console.log(`AdminDashboardService: Retrieved ${limitedActivities.length} recent activities`);
      return limitedActivities;
    } catch (error) {
      console.error('AdminDashboardService: Error fetching recent activities:', error);
      throw error;
    }
  }

  /**
   * Get staff member status with availability and assigned tasks
   * @returns {Promise<Array>} Staff status information
   */
  static async getStaffStatus() {
    try {
      console.log('AdminDashboardService: Fetching staff status');

      const staff = await User.find({
        role: { $in: ['staff', 'admin'] },
        isActive: true
      })
        .select('name email avatar currentStatus lastActivity currentOrderNumber hoursThisWeek hoursThisMonth specializations')
        .sort({ name: 1 })
        .lean();

      if (!staff.length) {
        return [];
      }

      const staffIds = staff.map(member => member._id);

      const [orderCounts, taskCounts] = await Promise.all([
        Order.aggregate([
          {
            $match: {
              'assignedStaff.staffId': { $in: staffIds },
              status: { $in: ['pending', 'in-progress', 'quality-check', 'awaiting_parts'] }
            }
          },
          { $unwind: '$assignedStaff' },
          {
            $match: {
              'assignedStaff.staffId': { $in: staffIds }
            }
          },
          {
            $group: {
              _id: '$assignedStaff.staffId',
              assignedOrders: { $sum: 1 }
            }
          }
        ]),
        Task.aggregate([
          {
            $match: {
              assignedTo: { $in: staffIds },
              status: { $in: ['pending', 'in_progress'] }
            }
          },
          {
            $group: {
              _id: '$assignedTo',
              assignedTasks: { $sum: 1 }
            }
          }
        ])
      ]);

      const orderCountMap = new Map(orderCounts.map(entry => [String(entry._id), entry.assignedOrders]));
      const taskCountMap = new Map(taskCounts.map(entry => [String(entry._id), entry.assignedTasks]));

      const staffStatusData = staff.map((member) => {
        const assignedOrders = Number(orderCountMap.get(String(member._id)) || 0);
        const assignedTasks = Number(taskCountMap.get(String(member._id)) || 0);

        const capacity = 10;
        const currentLoad = assignedOrders + assignedTasks;
        const utilizationRate = Math.min((currentLoad / capacity) * 100, 100);

        let availability = 'available';
        if (member.currentStatus === 'offline' || !member.currentStatus) {
          availability = 'offline';
        } else if (member.currentStatus === 'on_break') {
          availability = 'on_break';
        } else if (utilizationRate >= 90) {
          availability = 'fully_booked';
        } else if (utilizationRate >= 70) {
          availability = 'limited';
        }

        return {
          _id: member._id,
          name: member.name || member.email,
          email: member.email,
          avatar: member.avatar,
          currentStatus: member.currentStatus || 'offline',
          availability,
          lastActivity: member.lastActivity,
          currentOrder: member.currentOrderNumber || null,
          assignedOrders,
          assignedTasks,
          totalAssignments: currentLoad,
          capacity,
          utilizationRate: Math.round(utilizationRate),
          hoursThisWeek: member.hoursThisWeek || 0,
          hoursThisMonth: member.hoursThisMonth || 0,
          specializations: member.specializations || []
        };
      });

      console.log(`AdminDashboardService: Retrieved status for ${staffStatusData.length} staff members`);
      return staffStatusData;
    } catch (error) {
      console.error('AdminDashboardService: Error fetching staff status:', error);
      throw error;
    }
  }

  /**
   * Get assigned orders with time tracking data
   * @param {number} limit - Number of orders to fetch
   * @returns {Promise<Array>} Orders with time metrics
   */
  static async getAssignedOrders(limit = 20) {
    try {
      console.log(`AdminDashboardService: Fetching ${limit} assigned orders with time metrics`);

      const orders = await Order.find({
        'assignedStaff.0': { $exists: true },
        status: { $in: ['pending', 'in-progress', 'quality-check', 'awaiting_parts'] }
      })
        .populate('customerId', 'firstName lastName email phone')
        .populate('assignedStaff.staffId', 'name email')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      if (!orders.length) {
        return [];
      }

      const orderIds = orders.map(order => order._id);
      const durationRows = await WorkSession.aggregate([
        {
          $match: {
            status: 'completed',
            'ordersWorked.orderId': { $in: orderIds }
          }
        },
        { $unwind: '$ordersWorked' },
        {
          $match: {
            'ordersWorked.orderId': { $in: orderIds }
          }
        },
        {
          $group: {
            _id: {
              orderId: '$ordersWorked.orderId',
              staffId: '$staffId'
            },
            totalMinutes: { $sum: { $ifNull: ['$ordersWorked.duration', 0] } }
          }
        }
      ]);

      const durationLookup = new Map();
      durationRows.forEach(row => {
        const orderId = String(row._id.orderId);
        const staffId = String(row._id.staffId);
        durationLookup.set(`${orderId}:${staffId}`, row.totalMinutes || 0);
      });

      const ordersWithMetrics = orders.map((order) => {
        const staffMetrics = (order.assignedStaff || []).map((staff) => {
          const staffId = staff.staffId && staff.staffId._id ? staff.staffId._id.toString() : String(staff.staffId || '');
          const totalMinutes = durationLookup.get(`${order._id.toString()}:${staffId}`) || 0;
          const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

          return {
            staffId,
            staffName: staff.staffId?.name || staff.staffId?.email || 'Unknown staff',
            assignedAt: staff.assignedAt,
            timeSpent: totalHours,
            timeSpentMinutes: totalMinutes
          };
        });

        const totalTimeSpent = staffMetrics.reduce((sum, metric) => sum + metric.timeSpent, 0);
        const estimatedTime = order.estimatedCompletionTime || 0;
        const timeEfficiency = estimatedTime > 0
          ? Math.round((estimatedTime / totalTimeSpent) * 100)
          : 0;

        return {
          _id: order._id,
          orderNumber: order.orderNumber,
          customer: order.customerId ? {
            name: `${order.customerId.firstName || ''} ${order.customerId.lastName || ''}`.trim(),
            email: order.customerId.email,
            phone: order.customerId.phone
          } : null,
          device: {
            type: order.deviceType,
            brand: order.deviceBrand,
            model: order.deviceModel
          },
          status: order.status,
          priority: order.priority || 'normal',
          progress: order.progress || 0,
          assignedStaff: staffMetrics,
          totalTimeSpent,
          estimatedTime,
          timeEfficiency: isFinite(timeEfficiency) ? timeEfficiency : 0,
          createdAt: order.createdAt,
          estimatedCompletion: order.estimatedCompletion,
          totalCost: order.totalCost
        };
      });

      console.log(`AdminDashboardService: Retrieved ${ordersWithMetrics.length} assigned orders with metrics`);
      return ordersWithMetrics;
    } catch (error) {
      console.error('AdminDashboardService: Error fetching assigned orders:', error);
      throw error;
    }
  }

  /**
   * Get system overview with health and performance metrics
   * @returns {Promise<Object>} System metrics
   */
  static async getSystemOverview() {
    try {
      console.log('AdminDashboardService: Fetching system overview');

      // Get counts
      const [
        totalOrders,
        activeOrders,
        totalBookings,
        activeBookings,
        totalUsers,
        activeStaff,
        pendingRepairRequests,
        unreadNotifications
      ] = await Promise.all([
        Order.countDocuments({}),
        Order.countDocuments({ status: { $in: ['pending', 'in-progress', 'quality-check', 'awaiting_parts'] } }),
        Booking.countDocuments({}),
        Booking.countDocuments({ status: { $in: ['pending', 'processing'] } }),
        User.countDocuments({ role: 'customer' }),
        User.countDocuments({ role: { $in: ['staff', 'admin'] }, isActive: true }),
        RepairRequest.countDocuments({ status: 'pending' }),
        Notification.countDocuments({ isRead: false })
      ]);

      // Calculate today's stats
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [todayOrders, todayBookings, todayRepairRequests] = await Promise.all([
        Order.countDocuments({ createdAt: { $gte: startOfDay } }),
        Booking.countDocuments({ createdAt: { $gte: startOfDay } }),
        RepairRequest.countDocuments({ createdAt: { $gte: startOfDay } })
      ]);

      // Calculate this week's stats
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const [weekOrders, weekRevenue] = await Promise.all([
        Order.countDocuments({ createdAt: { $gte: startOfWeek } }),
        Order.aggregate([
          { $match: { createdAt: { $gte: startOfWeek }, status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$totalCost' } } }
        ])
      ]);

      const totalWeekRevenue = weekRevenue.length > 0 ? weekRevenue[0].total : 0;

      // Calculate average completion time (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const completedOrders = await Order.find({
        status: 'completed',
        completedAt: { $exists: true },
        createdAt: { $gte: thirtyDaysAgo }
      }).select('createdAt completedAt').lean();

      let avgCompletionTime = 0;
      if (completedOrders.length > 0) {
        const totalTime = completedOrders.reduce((sum, order) => {
          const completionTime = (new Date(order.completedAt) - new Date(order.createdAt)) / (1000 * 60 * 60 * 24);
          return sum + completionTime;
        }, 0);
        avgCompletionTime = Math.round((totalTime / completedOrders.length) * 10) / 10;
      }

      // System health indicators
      const systemHealth = {
        status: 'healthy',
        dbConnection: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        activeConnections: mongoose.connection.readyState === 1 ? 'active' : 'inactive',
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 // MB
      };

      const overview = {
        counts: {
          totalOrders,
          activeOrders,
          totalBookings,
          activeBookings,
          totalUsers,
          activeStaff,
          pendingRepairRequests,
          unreadNotifications
        },
        today: {
          orders: todayOrders,
          bookings: todayBookings,
          repairRequests: todayRepairRequests
        },
        thisWeek: {
          orders: weekOrders,
          revenue: Math.round(totalWeekRevenue * 100) / 100
        },
        performance: {
          avgCompletionTime,
          completedOrdersLast30Days: completedOrders.length,
          orderCompletionRate: totalOrders > 0
            ? Math.round((completedOrders.length / totalOrders) * 100)
            : 0
        },
        systemHealth
      };

      console.log('AdminDashboardService: System overview retrieved successfully');
      return overview;
    } catch (error) {
      console.error('AdminDashboardService: Error fetching system overview:', error);
      throw error;
    }
  }
}

module.exports = AdminDashboardService;
