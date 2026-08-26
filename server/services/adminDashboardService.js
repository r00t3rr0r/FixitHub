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

      const query = userId ? { userId } : {};

      const notifications = await Notification.find(query)
        .select('_id userId title message type isRead orderId actionUrl metadata createdAt readAt')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const orderIds = [...new Set(
        notifications
          .map((notification) => notification.orderId)
          .filter(Boolean)
          .map((id) => String(id))
      )];

      const orderMap = new Map(
        orderIds.length
          ? (await Order.find({ _id: { $in: orderIds } })
              .select('_id orderNumber deviceBrand deviceModel status')
              .lean()).map((order) => [String(order._id), order])
          : []
      );

      const unreadCount = await Notification.countDocuments({
        ...(userId ? { userId } : {}),
        isRead: false
      });

      const urgentCount = notifications.filter(n =>
        n.type === 'urgent' ||
        n.title?.toLowerCase().includes('urgent') ||
        n.message?.toLowerCase().includes('urgent')
      ).length;

      const formattedNotifications = notifications.map(notification => {
        const relatedOrder = orderMap.get(String(notification.orderId));

        return {
          _id: notification._id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          isRead: notification.isRead,
          isUrgent: notification.type === 'urgent' ||
                    notification.title?.toLowerCase().includes('urgent') ||
                    notification.message?.toLowerCase().includes('urgent'),
          orderId: relatedOrder?._id || notification.orderId,
          orderNumber: relatedOrder?.orderNumber,
          actionUrl: notification.actionUrl,
          metadata: notification.metadata || {},
          createdAt: notification.createdAt,
          readAt: notification.readAt
        };
      });

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

      const activityLimit = Math.ceil(limit / 3);
      const [recentOrders, recentBookings, recentRequests] = await Promise.all([
        Order.find({})
          .select('_id orderNumber customerId deviceBrand deviceModel status totalCost updatedAt createdAt')
          .sort({ createdAt: -1 })
          .limit(activityLimit)
          .lean(),
        Booking.find({})
          .select('_id bookingNumber customerId totalCost items status createdAt')
          .sort({ createdAt: -1 })
          .limit(activityLimit)
          .lean(),
        RepairRequest.find({})
          .select('_id requestNumber customerId customerName customerEmail deviceBrand deviceModel status updatedAt createdAt')
          .sort({ createdAt: -1 })
          .limit(activityLimit)
          .lean()
      ]);

      const customerIds = [...new Set([
        ...recentOrders.map((order) => order.customerId).filter(Boolean).map((id) => String(id)),
        ...recentBookings.map((booking) => booking.customerId).filter(Boolean).map((id) => String(id)),
        ...recentRequests.map((request) => request.customerId).filter(Boolean).map((id) => String(id))
      ])];

      const customerMap = new Map(
        customerIds.length
          ? (await User.find({ _id: { $in: customerIds } })
              .select('_id firstName lastName email')
              .lean()).map((user) => [String(user._id), user])
          : []
      );

      const activities = [];

      recentOrders.forEach(order => {
        const customer = customerMap.get(String(order.customerId));
        activities.push({
          id: order._id,
          type: 'order',
          action: order.status === 'pending' ? 'created' : 'updated',
          description: `Order ${order.orderNumber || order._id.toString().slice(-8).toUpperCase()} ${order.status === 'pending' ? 'created' : 'updated'}`,
          details: `${order.deviceBrand} ${order.deviceModel} - Status: ${order.status}`,
          user: customer ? {
            name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
            email: customer.email
          } : null,
          timestamp: order.updatedAt || order.createdAt,
          status: order.status
        });
      });

      recentBookings.forEach(booking => {
        const customer = customerMap.get(String(booking.customerId));
        activities.push({
          id: booking._id,
          type: 'booking',
          action: 'created',
          description: `Booking ${booking.bookingNumber} created`,
          details: `Total: $${Number(booking.totalCost || 0).toFixed(2)} - ${booking.items?.length || 0} items`,
          user: customer ? {
            name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
            email: customer.email
          } : null,
          timestamp: booking.createdAt,
          status: booking.status
        });
      });

      recentRequests.forEach(request => {
        const customer = customerMap.get(String(request.customerId));
        activities.push({
          id: request._id,
          type: 'repair_request',
          action: request.status === 'pending' ? 'submitted' : 'updated',
          description: `Repair request ${request.requestNumber} ${request.status === 'pending' ? 'submitted' : 'updated'}`,
          details: `${request.deviceBrand} ${request.deviceModel} - Status: ${request.status}`,
          user: customer ? {
            name: request.customerName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
            email: request.customerEmail || customer.email
          } : null,
          timestamp: request.updatedAt || request.createdAt,
          status: request.status
        });
      });

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
        .select('_id orderNumber customerId deviceType deviceBrand deviceModel status priority progress assignedStaff estimatedCompletion createdAt totalCost')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      if (!orders.length) {
        return [];
      }

      const customerIds = [...new Set(
        orders
          .map((order) => order.customerId)
          .filter(Boolean)
          .map((id) => String(id))
      )];
      const staffIds = [...new Set(
        orders
          .flatMap((order) => Array.isArray(order.assignedStaff) ? order.assignedStaff : [])
          .map((staff) => staff?.staffId)
          .filter(Boolean)
          .map((id) => String(id))
      )];

      const [customers, staffMembers, durationRows] = await Promise.all([
        customerIds.length ? User.find({ _id: { $in: customerIds } }).select('_id firstName lastName email phone').lean() : [],
        staffIds.length ? User.find({ _id: { $in: staffIds } }).select('_id name email').lean() : [],
        WorkSession.aggregate([
          {
            $match: {
              status: 'completed',
              'ordersWorked.orderId': { $in: orders.map((order) => order._id) }
            }
          },
          { $unwind: '$ordersWorked' },
          {
            $match: {
              'ordersWorked.orderId': { $in: orders.map((order) => order._id) }
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
        ])
      ]);

      const customerMap = new Map(customers.map((customer) => [String(customer._id), customer]));
      const staffMap = new Map(staffMembers.map((member) => [String(member._id), member]));
      const durationLookup = new Map();
      durationRows.forEach((row) => {
        const orderId = String(row._id.orderId);
        const staffId = String(row._id.staffId);
        durationLookup.set(`${orderId}:${staffId}`, row.totalMinutes || 0);
      });

      const ordersWithMetrics = orders.map((order) => {
        const customer = customerMap.get(String(order.customerId));
        const staffMetrics = (order.assignedStaff || []).map((staff) => {
          const staffId = staff.staffId ? String(staff.staffId) : '';
          const staffMember = staffMap.get(staffId);
          const totalMinutes = durationLookup.get(`${String(order._id)}:${staffId}`) || 0;
          const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

          return {
            staffId,
            staffName: staffMember?.name || staffMember?.email || 'Unknown staff',
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
          customer: customer ? {
            name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
            email: customer.email,
            phone: customer.phone
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
