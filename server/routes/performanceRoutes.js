const express = require('express');
const PerformanceService = require('../services/performanceService');
const { requireUser } = require('./middleware/auth');

const router = express.Router();

// Middleware to check if user is staff or admin
const requireStaffOrAdmin = (req, res, next) => {
  if (!req.user || !['staff', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Staff or admin role required.' });
  }
  next();
};

// Get performance metrics for current user (staff only)
router.get('/my-performance', requireUser, requireStaffOrAdmin, async (req, res) => {
  console.log('Get my performance request from user:', req.user.email);

  try {
    const { period } = req.query;
    const performance = await PerformanceService.getStaffPerformance(req.user._id, period);
    return res.status(200).json({ performance });
  } catch (error) {
    console.error('Error getting staff performance:', error);
    return res.status(500).json({ error: error.message || 'Failed to get performance data' });
  }
});

// Get performance metrics for specific staff (admin only)
router.get('/staff/:staffId', requireUser, async (req, res) => {
  console.log('Get staff performance request for:', req.params.staffId);

  try {
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.staffId) {
      return res.status(403).json({ error: 'Access denied. Can only view own performance or admin access required.' });
    }

    const { period } = req.query;
    const performance = await PerformanceService.getStaffPerformance(req.params.staffId, period);
    return res.status(200).json({ performance });
  } catch (error) {
    console.error('Error getting staff performance:', error);
    return res.status(500).json({ error: error.message || 'Failed to get performance data' });
  }
});

// Get team performance overview (admin only)
router.get('/team', requireUser, async (req, res) => {
  console.log('Get team performance request from user:', req.user.email);

  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const { period } = req.query;
    const teamPerformance = await PerformanceService.getTeamPerformance(period);
    return res.status(200).json({ teamPerformance });
  } catch (error) {
    console.error('Error getting team performance:', error);
    return res.status(500).json({ error: error.message || 'Failed to get team performance data' });
  }
});

// Update performance goals (staff can update own, admin can update any)
router.put('/goals/:staffId', requireUser, requireStaffOrAdmin, async (req, res) => {
  console.log('Update performance goals request for staff:', req.params.staffId);

  try {
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.staffId) {
      return res.status(403).json({ error: 'Access denied. Can only update own goals or admin access required.' });
    }

    const { period, goals } = req.body;

    if (!period || !goals) {
      return res.status(400).json({ error: 'Period and goals are required' });
    }

    const updatedMetric = await PerformanceService.updatePerformanceGoals(
      req.params.staffId,
      period,
      goals
    );

    return res.status(200).json({
      success: true,
      message: 'Performance goals updated successfully',
      metric: updatedMetric
    });
  } catch (error) {
    console.error('Error updating performance goals:', error);
    return res.status(500).json({ error: error.message || 'Failed to update performance goals' });
  }
});

module.exports = router;