const express = require('express');
const SecurityService = require('../services/securityService');
const { requireUser, requireRole } = require('./middleware/auth');

const router = express.Router();

// Get security settings (admin only)
router.get('/settings', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('SecurityRoutes: Get security settings request');

  try {
    const settings = await SecurityService.getSecuritySettings();

    return res.status(200).json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('SecurityRoutes: Error getting security settings:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get security settings'
    });
  }
});

// Update security settings (admin only)
router.put('/settings', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('SecurityRoutes: Update security settings request');

  try {
    const settings = await SecurityService.updateSecuritySettings(req.body);

    return res.status(200).json({
      success: true,
      settings,
      message: 'Security settings updated successfully'
    });
  } catch (error) {
    console.error('SecurityRoutes: Error updating security settings:', error);
    return res.status(500).json({
      error: error.message || 'Failed to update security settings'
    });
  }
});

// Get login attempts (admin only)
router.get('/login-attempts', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('SecurityRoutes: Get login attempts request');

  try {
    const attempts = await SecurityService.getLoginAttempts();

    return res.status(200).json({
      success: true,
      attempts
    });
  } catch (error) {
    console.error('SecurityRoutes: Error getting login attempts:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get login attempts'
    });
  }
});

// Get active sessions (admin only)
router.get('/sessions', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('SecurityRoutes: Get active sessions request');

  try {
    const sessions = await SecurityService.getActiveSessions();

    return res.status(200).json({
      success: true,
      sessions
    });
  } catch (error) {
    console.error('SecurityRoutes: Error getting active sessions:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get active sessions'
    });
  }
});

// Force logout user (admin only)
router.post('/logout/:userId', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('SecurityRoutes: Force logout user request:', req.params.userId);

  try {
    const result = await SecurityService.forceLogout(req.params.userId);

    return res.status(200).json(result);
  } catch (error) {
    console.error('SecurityRoutes: Error forcing logout:', error);
    return res.status(500).json({
      error: error.message || 'Failed to logout user'
    });
  }
});

// Block IP address (admin only)
router.post('/block-ip', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('SecurityRoutes: Block IP address request');

  try {
    const { ipAddress, reason } = req.body;

    if (!ipAddress) {
      return res.status(400).json({
        error: 'IP address is required'
      });
    }

    const result = await SecurityService.blockIpAddress(ipAddress, reason);

    return res.status(200).json(result);
  } catch (error) {
    console.error('SecurityRoutes: Error blocking IP address:', error);
    return res.status(500).json({
      error: error.message || 'Failed to block IP address'
    });
  }
});

// Get security audit log (admin only)
router.get('/audit-log', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('SecurityRoutes: Get security audit log request');

  try {
    const result = await SecurityService.getSecurityAuditLog(req.query);

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('SecurityRoutes: Error getting audit log:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get audit log'
    });
  }
});

module.exports = router;