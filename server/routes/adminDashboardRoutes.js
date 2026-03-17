const express = require('express');
const AdminDashboardService = require('../services/adminDashboardService');
const { requireUser, requireRole } = require('./middleware/auth');
const InspectionCommunication = require('../models/InspectionCommunication');
const RepairRequestCommunication = require('../models/RepairRequestCommunication');

const router = express.Router();

// Middleware to check if user is admin
const requireAdmin = [requireUser, requireRole(['admin'])];

/**
 * GET /api/admin/dashboard/bookings
 * Get recent bookings with customer details
 */
router.get('/bookings', requireAdmin, async (req, res) => {
  console.log('AdminDashboard: Get recent bookings request from:', req.user.email);

  try {
    const limit = parseInt(req.query.limit) || 10;

    if (limit < 1 || limit > 100) {
      console.log('AdminDashboard: Invalid limit parameter:', limit);
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 100'
      });
    }

    const bookings = await AdminDashboardService.getRecentBookings(limit);

    console.log(`AdminDashboard: Returning ${bookings.length} recent bookings`);

    return res.status(200).json({
      success: true,
      data: bookings,
      count: bookings.length
    });
  } catch (error) {
    console.error('AdminDashboard: Error getting recent bookings:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch recent bookings'
    });
  }
});

/**
 * GET /api/admin/dashboard/repair-requests
 * Get active repair requests with status
 */
router.get('/repair-requests', requireAdmin, async (req, res) => {
  console.log('AdminDashboard: Get repair requests request from:', req.user.email);

  try {
    const limit = parseInt(req.query.limit) || 10;

    if (limit < 1 || limit > 100) {
      console.log('AdminDashboard: Invalid limit parameter:', limit);
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 100'
      });
    }

    const requests = await AdminDashboardService.getActiveRepairRequests(limit);

    console.log(`AdminDashboard: Returning ${requests.length} repair requests`);

    return res.status(200).json({
      success: true,
      data: requests,
      count: requests.length
    });
  } catch (error) {
    console.error('AdminDashboard: Error getting repair requests:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch repair requests'
    });
  }
});

/**
 * GET /api/admin/dashboard/notifications
 * Get recent notifications with urgency highlighting
 */
router.get('/notifications', requireAdmin, async (req, res) => {
  console.log('AdminDashboard: Get notifications request from:', req.user.email);

  try {
    const limit = parseInt(req.query.limit) || 20;
    const userId = req.query.userId || req.user._id; // Allow fetching for specific user or current admin

    if (limit < 1 || limit > 100) {
      console.log('AdminDashboard: Invalid limit parameter:', limit);
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 100'
      });
    }

    const notificationsData = await AdminDashboardService.getRecentNotifications(userId, limit);

    console.log(`AdminDashboard: Returning ${notificationsData.notifications.length} notifications`);

    return res.status(200).json({
      success: true,
      data: notificationsData.notifications,
      unreadCount: notificationsData.unreadCount,
      urgentCount: notificationsData.urgentCount,
      totalCount: notificationsData.totalCount
    });
  } catch (error) {
    console.error('AdminDashboard: Error getting notifications:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch notifications'
    });
  }
});

/**
 * GET /api/admin/dashboard/activities
 * Get recent system-wide activities
 */
router.get('/activities', requireAdmin, async (req, res) => {
  console.log('AdminDashboard: Get activities request from:', req.user.email);

  try {
    const limit = parseInt(req.query.limit) || 20;

    if (limit < 1 || limit > 100) {
      console.log('AdminDashboard: Invalid limit parameter:', limit);
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 100'
      });
    }

    const activities = await AdminDashboardService.getRecentActivities(limit);

    console.log(`AdminDashboard: Returning ${activities.length} activities`);

    return res.status(200).json({
      success: true,
      data: activities,
      count: activities.length
    });
  } catch (error) {
    console.error('AdminDashboard: Error getting activities:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch activities'
    });
  }
});

/**
 * GET /api/admin/dashboard/staff-status
 * Get staff availability and assigned tasks
 */
router.get('/staff-status', requireAdmin, async (req, res) => {
  console.log('AdminDashboard: Get staff status request from:', req.user.email);

  try {
    const staffStatus = await AdminDashboardService.getStaffStatus();

    console.log(`AdminDashboard: Returning status for ${staffStatus.length} staff members`);

    return res.status(200).json({
      success: true,
      data: staffStatus,
      count: staffStatus.length
    });
  } catch (error) {
    console.error('AdminDashboard: Error getting staff status:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch staff status'
    });
  }
});

/**
 * GET /api/admin/dashboard/assigned-orders
 * Get orders with time tracking metrics
 */
router.get('/assigned-orders', requireAdmin, async (req, res) => {
  console.log('AdminDashboard: Get assigned orders request from:', req.user.email);

  try {
    const limit = parseInt(req.query.limit) || 20;

    if (limit < 1 || limit > 100) {
      console.log('AdminDashboard: Invalid limit parameter:', limit);
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 100'
      });
    }

    const orders = await AdminDashboardService.getAssignedOrders(limit);

    console.log(`AdminDashboard: Returning ${orders.length} assigned orders`);

    return res.status(200).json({
      success: true,
      data: orders,
      count: orders.length
    });
  } catch (error) {
    console.error('AdminDashboard: Error getting assigned orders:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch assigned orders'
    });
  }
});

/**
 * GET /api/admin/dashboard/system-overview
 * Get system health and performance metrics
 */
router.get('/system-overview', requireAdmin, async (req, res) => {
  console.log('AdminDashboard: Get system overview request from:', req.user.email);

  try {
    const overview = await AdminDashboardService.getSystemOverview();

    console.log('AdminDashboard: System overview retrieved successfully');

    return res.status(200).json({
      success: true,
      data: overview
    });
  } catch (error) {
    console.error('AdminDashboard: Error getting system overview:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch system overview'
    });
  }
});

/**
 * GET /api/admin/dashboard/summary
 * Get complete dashboard summary (all data in one call)
 * Useful for initial dashboard load
 */
router.get('/summary', requireAdmin, async (req, res) => {
  console.log('AdminDashboard: Get complete summary request from:', req.user.email);

  try {
    // Fetch all dashboard data in parallel for better performance
    const [
      bookings,
      repairRequests,
      notifications,
      activities,
      staffStatus,
      assignedOrders,
      systemOverview
    ] = await Promise.all([
      AdminDashboardService.getRecentBookings(5),
      AdminDashboardService.getActiveRepairRequests(5),
      AdminDashboardService.getRecentNotifications(req.user._id, 10),
      AdminDashboardService.getRecentActivities(10),
      AdminDashboardService.getStaffStatus(),
      AdminDashboardService.getAssignedOrders(10),
      AdminDashboardService.getSystemOverview()
    ]);

    console.log('AdminDashboard: Complete summary retrieved successfully');

    return res.status(200).json({
      success: true,
      data: {
        bookings: {
          data: bookings,
          count: bookings.length
        },
        repairRequests: {
          data: repairRequests,
          count: repairRequests.length
        },
        notifications: {
          data: notifications.notifications,
          unreadCount: notifications.unreadCount,
          urgentCount: notifications.urgentCount,
          totalCount: notifications.totalCount
        },
        activities: {
          data: activities,
          count: activities.length
        },
        staffStatus: {
          data: staffStatus,
          count: staffStatus.length
        },
        assignedOrders: {
          data: assignedOrders,
          count: assignedOrders.length
        },
        systemOverview
      }
    });
  } catch (error) {
    console.error('AdminDashboard: Error getting dashboard summary:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch dashboard summary'
    });
  }
});

/**
 * GET /api/admin/dashboard/customer-messages
 * Get recent unread customer messages from inspection + repair request communications
 */
router.get('/customer-messages', requireAdmin, async (req, res) => {
  console.log('AdminDashboard: Get customer messages request from:', req.user.email);

  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const adminUserId = req.user._id;

    // Fetch from both communication collections in parallel
    const [inspectionComms, repairRequestComms] = await Promise.all([
      InspectionCommunication.find({ 'messages.0': { $exists: true } })
        .populate({ path: 'orderId', select: 'orderNumber status' })
        .select('orderId messages lastMessageAt')
        .sort({ lastMessageAt: -1 })
        .limit(100)
        .lean(),
      RepairRequestCommunication.find({ 'messages.0': { $exists: true } })
        .populate({ path: 'repairRequestId', select: 'requestNumber status deviceType' })
        .select('repairRequestId messages lastMessageAt')
        .sort({ lastMessageAt: -1 })
        .limit(100)
        .lean(),
    ]);

    const messages = [];

    // Extract unread customer messages from inspection communications
    for (const comm of inspectionComms) {
      for (const msg of comm.messages) {
        if (msg.senderType !== 'customer') continue;
        const alreadyRead = Array.isArray(msg.readBy) &&
          msg.readBy.some((r) => r.userId && r.userId.toString() === adminUserId.toString());
        if (!alreadyRead) {
          messages.push({
            _id: msg._id,
            source: 'inspection',
            sourceId: comm.orderId?._id || null,
            orderNumber: comm.orderId?.orderNumber || null,
            orderStatus: comm.orderId?.status || null,
            senderName: msg.senderName || 'Kunde',
            content: msg.content,
            createdAt: msg.createdAt,
            navigateTo: comm.orderId?._id ? `/inspection/${comm.orderId._id}` : '/admin/orders',
          });
        }
      }
    }

    // Extract unread customer messages from repair request communications
    for (const comm of repairRequestComms) {
      for (const msg of comm.messages) {
        if (msg.senderType !== 'customer') continue;
        const alreadyRead = Array.isArray(msg.readBy) &&
          msg.readBy.some((r) => r.userId && r.userId.toString() === adminUserId.toString());
        if (!alreadyRead) {
          messages.push({
            _id: msg._id,
            source: 'repair_request',
            sourceId: comm.repairRequestId?._id || null,
            requestNumber: comm.repairRequestId?.requestNumber || null,
            deviceType: comm.repairRequestId?.deviceType || null,
            senderName: msg.senderName || 'Kunde',
            content: msg.content,
            createdAt: msg.createdAt,
            navigateTo: '/admin/repair-requests',
          });
        }
      }
    }

    // Sort by newest first and limit
    messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const limited = messages.slice(0, limit);

    return res.status(200).json({
      success: true,
      messages: limited,
      totalUnread: messages.length,
    });
  } catch (error) {
    console.error('AdminDashboard: Error getting customer messages:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch customer messages',
    });
  }
});

module.exports = router;
