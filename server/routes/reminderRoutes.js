const express = require('express');
const router = express.Router();
const { requireUser, requireAdmin } = require('./middleware/auth');
const ReminderService = require('../services/reminderService');

// Description: Get all reminders for a booking
// Endpoint: GET /api/reminders/booking/:bookingId
// Request: {}
// Response: { success: boolean, reminders: Reminder[] }
router.get('/booking/:bookingId', requireUser, async (req, res) => {
  try {
    console.log('ReminderRoutes: Getting reminders for booking:', req.params.bookingId);

    const reminders = await ReminderService.getByBooking(req.params.bookingId);

    console.log('ReminderRoutes: Retrieved', reminders.length, 'reminders');

    res.json({
      success: true,
      reminders: reminders
    });
  } catch (error) {
    console.error('ReminderRoutes: Error getting reminders:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Get all reminders (admin only)
// Endpoint: GET /api/reminders
// Request: { status?: string, type?: string, dateFrom?: string, dateTo?: string, limit?: number, skip?: number }
// Response: { success: boolean, reminders: Reminder[] }
router.get('/', requireAdmin, async (req, res) => {
  try {
    console.log('ReminderRoutes: Getting all reminders');

    const { status, type, dateFrom, dateTo, limit = 50, skip = 0 } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (type) filters.type = type;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    filters.limit = parseInt(limit);
    filters.skip = parseInt(skip);

    const reminders = await ReminderService.getAll(filters);

    console.log('ReminderRoutes: Retrieved', reminders.length, 'reminders');

    res.json({
      success: true,
      reminders: reminders
    });
  } catch (error) {
    console.error('ReminderRoutes: Error getting reminders:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Get a specific reminder by ID
// Endpoint: GET /api/reminders/:id
// Request: {}
// Response: { success: boolean, reminder: Reminder }
router.get('/:id', requireUser, async (req, res) => {
  try {
    console.log('ReminderRoutes: Getting reminder:', req.params.id);

    const reminder = await ReminderService.getById(req.params.id);

    if (!reminder) {
      console.log('ReminderRoutes: Reminder not found');
      return res.status(404).json({
        success: false,
        error: 'Reminder not found'
      });
    }

    console.log('ReminderRoutes: Reminder retrieved successfully');

    res.json({
      success: true,
      reminder: reminder
    });
  } catch (error) {
    console.error('ReminderRoutes: Error getting reminder:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Create a new reminder
// Endpoint: POST /api/reminders
// Request: { bookingId: string, orderId?: string, customerId: string, type: string, title: string, message: string, scheduledDate: string, notificationMethod?: string[], priority?: string, recurring?: object }
// Response: { success: boolean, reminder: Reminder }
router.post('/', requireUser, async (req, res) => {
  try {
    console.log('ReminderRoutes: Creating new reminder');

    const {
      bookingId,
      orderId,
      customerId,
      type,
      title,
      message,
      scheduledDate,
      notificationMethod,
      priority,
      recurring
    } = req.body;

    if (!bookingId || !customerId || !type || !title || !message || !scheduledDate) {
      console.log('ReminderRoutes: Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'bookingId, customerId, type, title, message, and scheduledDate are required'
      });
    }

    const reminderData = {
      bookingId,
      orderId,
      customerId,
      type,
      title,
      message,
      scheduledDate: new Date(scheduledDate),
      notificationMethod: notificationMethod || ['email', 'in-app'],
      priority: priority || 'medium',
      createdBy: req.user._id,
      recurring: recurring || { enabled: false }
    };

    const reminder = await ReminderService.create(reminderData);

    console.log('ReminderRoutes: Reminder created successfully:', reminder._id);

    res.status(201).json({
      success: true,
      reminder: reminder
    });
  } catch (error) {
    console.error('ReminderRoutes: Error creating reminder:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Update reminder
// Endpoint: PUT /api/reminders/:id
// Request: { title?: string, message?: string, scheduledDate?: string, notificationMethod?: string[], priority?: string, recurring?: object }
// Response: { success: boolean, reminder: Reminder }
router.put('/:id', requireUser, async (req, res) => {
  try {
    console.log('ReminderRoutes: Updating reminder:', req.params.id);

    const updateData = {};
    const { title, message, scheduledDate, notificationMethod, priority, recurring } = req.body;

    if (title) updateData.title = title;
    if (message) updateData.message = message;
    if (scheduledDate) updateData.scheduledDate = new Date(scheduledDate);
    if (notificationMethod) updateData.notificationMethod = notificationMethod;
    if (priority) updateData.priority = priority;
    if (recurring) updateData.recurring = recurring;

    const reminder = await ReminderService.update(req.params.id, updateData);

    console.log('ReminderRoutes: Reminder updated successfully');

    res.json({
      success: true,
      reminder: reminder
    });
  } catch (error) {
    console.error('ReminderRoutes: Error updating reminder:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Update reminder status
// Endpoint: PUT /api/reminders/:id/status
// Request: { status: string }
// Response: { success: boolean, reminder: Reminder }
router.put('/:id/status', requireAdmin, async (req, res) => {
  try {
    console.log('ReminderRoutes: Updating reminder status:', req.params.id);

    const { status } = req.body;

    if (!status) {
      console.log('ReminderRoutes: Missing status');
      return res.status(400).json({
        success: false,
        error: 'status is required'
      });
    }

    const validStatuses = ['scheduled', 'sent', 'delivered', 'failed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      console.log('ReminderRoutes: Invalid status:', status);
      return res.status(400).json({
        success: false,
        error: `status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const reminder = await ReminderService.updateStatus(req.params.id, status);

    console.log('ReminderRoutes: Reminder status updated successfully');

    res.json({
      success: true,
      reminder: reminder
    });
  } catch (error) {
    console.error('ReminderRoutes: Error updating reminder status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Cancel reminder
// Endpoint: PUT /api/reminders/:id/cancel
// Request: {}
// Response: { success: boolean, reminder: Reminder }
router.put('/:id/cancel', requireUser, async (req, res) => {
  try {
    console.log('ReminderRoutes: Cancelling reminder:', req.params.id);

    const reminder = await ReminderService.cancel(req.params.id);

    console.log('ReminderRoutes: Reminder cancelled successfully');

    res.json({
      success: true,
      reminder: reminder
    });
  } catch (error) {
    console.error('ReminderRoutes: Error cancelling reminder:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Delete reminder
// Endpoint: DELETE /api/reminders/:id
// Request: {}
// Response: { success: boolean }
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    console.log('ReminderRoutes: Deleting reminder:', req.params.id);

    await ReminderService.delete(req.params.id);

    console.log('ReminderRoutes: Reminder deleted successfully');

    res.json({
      success: true
    });
  } catch (error) {
    console.error('ReminderRoutes: Error deleting reminder:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
