const express = require('express');
const ScheduleService = require('../services/scheduleService');
const { requireUser } = require('./middleware/auth');

const router = express.Router();

// Middleware to check if user is staff or admin
const requireStaffOrAdmin = (req, res, next) => {
  if (!req.user || !['staff', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Staff or admin role required.' });
  }
  next();
};

// Get schedule for current user
router.get('/my-schedule', requireUser, requireStaffOrAdmin, async (req, res) => {
  console.log('Get my schedule request from user:', req.user.email);

  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status
    };

    const events = await ScheduleService.getStaffSchedule(req.user._id, filters);
    return res.status(200).json({ events });
  } catch (error) {
    console.error('Error getting staff schedule:', error);
    return res.status(500).json({ error: error.message || 'Failed to get schedule' });
  }
});

// Get schedule for specific staff (admin only)
router.get('/staff/:staffId', requireUser, async (req, res) => {
  console.log('Get staff schedule request for:', req.params.staffId);

  try {
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.staffId) {
      return res.status(403).json({ error: 'Access denied. Can only view own schedule or admin access required.' });
    }

    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status
    };

    const events = await ScheduleService.getStaffSchedule(req.params.staffId, filters);
    return res.status(200).json({ events });
  } catch (error) {
    console.error('Error getting staff schedule:', error);
    return res.status(500).json({ error: error.message || 'Failed to get schedule' });
  }
});

// Get team schedule (admin only)
router.get('/team', requireUser, async (req, res) => {
  console.log('Get team schedule request from user:', req.user.email);

  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const events = await ScheduleService.getTeamSchedule(filters);
    return res.status(200).json({ events });
  } catch (error) {
    console.error('Error getting team schedule:', error);
    return res.status(500).json({ error: error.message || 'Failed to get team schedule' });
  }
});

// Create schedule event
router.post('/events', requireUser, requireStaffOrAdmin, async (req, res) => {
  console.log('Create schedule event request from user:', req.user.email);

  try {
    const event = await ScheduleService.createScheduleEvent(req.body, req.user._id);
    return res.status(201).json({ success: true, event });
  } catch (error) {
    console.error('Error creating schedule event:', error);
    return res.status(400).json({ error: error.message || 'Failed to create schedule event' });
  }
});

// Update schedule event
router.put('/events/:id', requireUser, requireStaffOrAdmin, async (req, res) => {
  console.log('Update schedule event request:', req.params.id);

  try {
    const event = await ScheduleService.updateScheduleEvent(req.params.id, req.body, req.user._id);
    return res.status(200).json({ success: true, event });
  } catch (error) {
    console.error('Error updating schedule event:', error);
    if (error.message === 'Schedule event not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Permission denied' || error.message === 'Schedule conflict detected') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Failed to update schedule event' });
  }
});

// Delete schedule event
router.delete('/events/:id', requireUser, requireStaffOrAdmin, async (req, res) => {
  console.log('Delete schedule event request:', req.params.id);

  try {
    const result = await ScheduleService.deleteScheduleEvent(req.params.id, req.user._id);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error deleting schedule event:', error);
    if (error.message === 'Schedule event not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Permission denied') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Failed to delete schedule event' });
  }
});

module.exports = router;