const express = require('express');
const DatabaseService = require('../services/databaseService');
const { requireUser, requireRole } = require('./middleware/auth');

const router = express.Router();

// Get database statistics (admin only)
router.get('/stats', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('DatabaseRoutes: Get database stats request');

  try {
    const stats = await DatabaseService.getDatabaseStats();

    return res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('DatabaseRoutes: Error getting database stats:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get database statistics'
    });
  }
});

// Get recent operations (admin only)
router.get('/operations', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('DatabaseRoutes: Get recent operations request');

  try {
    const operations = await DatabaseService.getRecentOperations();

    return res.status(200).json({
      success: true,
      operations
    });
  } catch (error) {
    console.error('DatabaseRoutes: Error getting recent operations:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get recent operations'
    });
  }
});

// Create database backup (admin only)
router.post('/backup', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('DatabaseRoutes: Create backup request');

  try {
    const result = await DatabaseService.backupDatabase();

    return res.status(200).json(result);
  } catch (error) {
    console.error('DatabaseRoutes: Error creating backup:', error);
    return res.status(500).json({
      error: error.message || 'Failed to create database backup'
    });
  }
});

// Get backup history (admin only)
router.get('/backups', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('DatabaseRoutes: Get backup history request');

  try {
    const backups = await DatabaseService.getBackupHistory();

    return res.status(200).json({
      success: true,
      backups
    });
  } catch (error) {
    console.error('DatabaseRoutes: Error getting backup history:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get backup history'
    });
  }
});

// Optimize database (admin only)
router.post('/optimize', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('DatabaseRoutes: Optimize database request');

  try {
    const result = await DatabaseService.optimizeDatabase();

    return res.status(200).json(result);
  } catch (error) {
    console.error('DatabaseRoutes: Error optimizing database:', error);
    return res.status(500).json({
      error: error.message || 'Failed to optimize database'
    });
  }
});

// Get database health (admin only)
router.get('/health', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('DatabaseRoutes: Get database health request');

  try {
    const health = await DatabaseService.getDatabaseHealth();

    return res.status(200).json({
      success: true,
      health
    });
  } catch (error) {
    console.error('DatabaseRoutes: Error getting database health:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get database health'
    });
  }
});

// Clean up old data (admin only)
router.post('/cleanup', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('DatabaseRoutes: Cleanup old data request');

  try {
    const result = await DatabaseService.cleanupOldData(req.body);

    return res.status(200).json(result);
  } catch (error) {
    console.error('DatabaseRoutes: Error cleaning up data:', error);
    return res.status(500).json({
      error: error.message || 'Failed to cleanup old data'
    });
  }
});

module.exports = router;