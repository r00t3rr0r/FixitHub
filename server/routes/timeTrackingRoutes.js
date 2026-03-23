const express = require('express');
const router = express.Router();
const TimeTrackingService = require('../services/timeTrackingService');
const { auth, requireAdmin } = require('./middleware/auth');

/**
 * Time Tracking Routes
 * Handles clock in/out, break management, and automatic order tracking
 */

// Description: Clock in a staff member
// Endpoint: POST /api/time-tracking/clock-in
// Request: {}
// Response: { success: boolean, message: string, session: { sessionId, clockInTime, status } }
router.post('/clock-in', auth, async (req, res) => {
  try {
    console.log(`POST /api/time-tracking/clock-in - User: ${req.user.email}`);

    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await TimeTrackingService.clockIn(
      req.user._id,
      ipAddress,
      userAgent
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('Clock in error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Clock out a staff member
// Endpoint: POST /api/time-tracking/clock-out
// Request: {}
// Response: { success: boolean, message: string, session: { sessionId, clockInTime, clockOutTime, totalDuration, workDuration, breakDuration, ordersWorked, tasksWorked } }
router.post('/clock-out', auth, async (req, res) => {
  try {
    console.log(`POST /api/time-tracking/clock-out - User: ${req.user.email}`);

    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await TimeTrackingService.clockOut(
      req.user._id,
      ipAddress,
      userAgent
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('Clock out error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Start a break period
// Endpoint: POST /api/time-tracking/break-start
// Request: { reason?: string }
// Response: { success: boolean, message: string, breakStartTime: Date }
router.post('/break-start', auth, async (req, res) => {
  try {
    console.log(`POST /api/time-tracking/break-start - User: ${req.user.email}`);

    const { reason } = req.body;

    const result = await TimeTrackingService.startBreak(req.user._id, reason);

    res.status(200).json(result);
  } catch (error) {
    console.error('Start break error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Description: End a break period
// Endpoint: POST /api/time-tracking/break-end
// Request: {}
// Response: { success: boolean, message: string, breakEndTime: Date }
router.post('/break-end', auth, async (req, res) => {
  try {
    console.log(`POST /api/time-tracking/break-end - User: ${req.user.email}`);

    const result = await TimeTrackingService.endBreak(req.user._id);

    res.status(200).json(result);
  } catch (error) {
    console.error('End break error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Start tracking work on an order (automatic)
// Endpoint: POST /api/time-tracking/order-start
// Request: { orderId: string }
// Response: { success: boolean, message: string, orderId: string, orderNumber: string, startTime: Date }
router.post('/order-start', auth, async (req, res) => {
  try {
    console.log(`POST /api/time-tracking/order-start - User: ${req.user.email}`);

    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
    }

    const result = await TimeTrackingService.startOrderTracking(
      req.user._id,
      orderId
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('Start order tracking error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Description: End tracking work on an order (automatic)
// Endpoint: POST /api/time-tracking/order-end
// Request: { orderId: string }
// Response: { success: boolean, message: string, endTime: Date }
router.post('/order-end', auth, async (req, res) => {
  try {
    console.log(`POST /api/time-tracking/order-end - User: ${req.user.email}`);

    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
    }

    const result = await TimeTrackingService.endOrderTracking(
      req.user._id,
      orderId
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('End order tracking error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Get current status of logged-in staff member
// Endpoint: GET /api/time-tracking/status
// Request: {}
// Response: { success: boolean, status: string, sessionId: string, lastClockIn: Date, lastClockOut: Date, currentOrder: object, lastActivity: Date, activeSession: object }
router.get('/status', auth, async (req, res) => {
  try {
    console.log(`GET /api/time-tracking/status - User: ${req.user.email}`);

    const result = await TimeTrackingService.getCurrentStatus(req.user._id);

    res.status(200).json(result);
  } catch (error) {
    console.error('Get current status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Get time entries for logged-in staff member
// Endpoint: GET /api/time-tracking/entries
// Request: { startDate?: string, endDate?: string, type?: string, orderId?: string, page?: number, limit?: number }
// Response: { success: boolean, entries: Array, pagination: object }
router.get('/entries', auth, async (req, res) => {
  try {
    console.log(`GET /api/time-tracking/entries - User: ${req.user.email}`);

    const result = await TimeTrackingService.getTimeEntries(
      req.user._id,
      req.query
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('Get time entries error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Get work sessions for logged-in staff member
// Endpoint: GET /api/time-tracking/sessions
// Request: { startDate?: string, endDate?: string, status?: string, page?: number, limit?: number }
// Response: { success: boolean, sessions: Array, pagination: object }
router.get('/sessions', auth, async (req, res) => {
  try {
    console.log(`GET /api/time-tracking/sessions - User: ${req.user.email}`);

    const result = await TimeTrackingService.getWorkSessions(
      req.user._id,
      req.query
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('Get work sessions error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Get time tracking summary for logged-in staff member
// Endpoint: GET /api/time-tracking/summary
// Request: { date?: string }
// Response: { success: boolean, summary: { currentStatus, lastClockIn, lastClockOut, hoursToday, hoursThisWeek, hoursThisMonth, totalHoursWorked, averageHoursPerDay } }
router.get('/summary', auth, async (req, res) => {
  try {
    console.log(`GET /api/time-tracking/summary - User: ${req.user.email}`);

    const result = await TimeTrackingService.getTimeTrackingSummary(req.user._id, req.query);

    res.status(200).json(result);
  } catch (error) {
    console.error('Get time tracking summary error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Get all staff members with their current status (admin only)
// Endpoint: GET /api/time-tracking/admin/all-staff-status
// Request: {}
// Response: { success: boolean, staff: Array<{ _id, name, email, avatar, currentStatus, lastActivity, currentOrder, hoursThisWeek, hoursThisMonth }> }
router.get('/admin/all-staff-status', ...requireAdmin, async (req, res) => {
  try {
    console.log(`GET /api/time-tracking/admin/all-staff-status - Admin: ${req.user.email}`);

    const result = await TimeTrackingService.getAllStaffStatus();

    res.status(200).json(result);
  } catch (error) {
    console.error('Get all staff status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Get time tracking summary for any staff member (admin only)
// Endpoint: GET /api/time-tracking/admin/staff/:staffId/summary
// Request: { date?: string }
// Response: { success: boolean, summary: object }
router.get('/admin/staff/:staffId/summary', ...requireAdmin, async (req, res) => {
  try {
    console.log(`GET /api/time-tracking/admin/staff/${req.params.staffId}/summary - Admin: ${req.user.email}`);

    const result = await TimeTrackingService.getTimeTrackingSummary(req.params.staffId, req.query);

    res.status(200).json(result);
  } catch (error) {
    console.error('Get staff time tracking summary error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Get time entries for any staff member (admin only)
// Endpoint: GET /api/time-tracking/admin/staff/:staffId/entries
// Request: { startDate?: string, endDate?: string, type?: string, orderId?: string, page?: number, limit?: number }
// Response: { success: boolean, entries: Array, pagination: object }
router.get('/admin/staff/:staffId/entries', ...requireAdmin, async (req, res) => {
  try {
    console.log(`GET /api/time-tracking/admin/staff/${req.params.staffId}/entries - Admin: ${req.user.email}`);

    const result = await TimeTrackingService.getTimeEntries(
      req.params.staffId,
      req.query
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('Get staff time entries error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Get work sessions for any staff member (admin only)
// Endpoint: GET /api/time-tracking/admin/staff/:staffId/sessions
// Request: { startDate?: string, endDate?: string, status?: string, page?: number, limit?: number }
// Response: { success: boolean, sessions: Array, pagination: object }
router.get('/admin/staff/:staffId/sessions', ...requireAdmin, async (req, res) => {
  try {
    console.log(`GET /api/time-tracking/admin/staff/${req.params.staffId}/sessions - Admin: ${req.user.email}`);

    const result = await TimeTrackingService.getWorkSessions(
      req.params.staffId,
      req.query
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('Get staff work sessions error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
