const express = require('express');
const NotificationService = require('../services/notificationService');
const { requireUser } = require('./middleware/auth');

const router = express.Router();

// Get notifications for current user
router.get('/', requireUser, async (req, res) => {
  console.log('Get notifications request from user:', req.user.email);

  try {
    const filters = {
      limit: req.query.limit,
      unreadOnly: req.query.unreadOnly
    };

    const result = await NotificationService.getUserNotifications(req.user._id, filters);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting notifications:', error);
    return res.status(500).json({ error: error.message || 'Failed to get notifications' });
  }
});

// Mark notification as read
router.put('/:id/read', requireUser, async (req, res) => {
  console.log('Mark notification as read request:', req.params.id);

  try {
    const notification = await NotificationService.markAsRead(req.params.id, req.user._id);
    return res.status(200).json({ success: true, notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    if (error.message === 'Notification not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put('/read-all', requireUser, async (req, res) => {
  console.log('Mark all notifications as read request from user:', req.user.email);

  try {
    const result = await NotificationService.markAllAsRead(req.user._id);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({ error: error.message || 'Failed to mark all notifications as read' });
  }
});

// Delete a single notification
router.delete('/:id', requireUser, async (req, res) => {
  console.log('Delete notification request:', req.params.id);

  try {
    const Notification = require('../models/Notification');
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete notification' });
  }
});

// Delete all notifications for the current user
router.delete('/', requireUser, async (req, res) => {
  console.log('Delete all notifications request from user:', req.user.email);

  try {
    const Notification = require('../models/Notification');
    const result = await Notification.deleteMany({ userId: req.user._id });
    return res.status(200).json({ success: true, count: result.deletedCount });
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete all notifications' });
  }
});

module.exports = router;