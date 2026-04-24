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

// Delete all bookings and orders (admin only)
// Description: Delete all bookings and orders from the database
// Endpoint: POST /api/database/delete-bookings-orders
// Request: {}
// Response: { success: boolean, message: string, results: { orders: { before: number, deleted: number, after: number }, bookings: { before: number, deleted: number, after: number } }, timestamp: string }
router.post('/delete-bookings-orders', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('DatabaseRoutes: Delete all bookings and orders request');

  try {
    const result = await DatabaseService.deleteAllBookingsAndOrders();

    return res.status(200).json(result);
  } catch (error) {
    console.error('DatabaseRoutes: Error deleting bookings and orders:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete bookings and orders'
    });
  }
});

// Delete all invoices (admin only)
// Description: Delete all invoices from the database
// Endpoint: POST /api/database/delete-invoices
// Request: {}
// Response: { success: boolean, message: string, results: { before: number, deleted: number, after: number }, timestamp: string }
router.post('/delete-invoices', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('DatabaseRoutes: Delete all invoices request');

  try {
    const result = await DatabaseService.deleteAllInvoices();

    return res.status(200).json(result);
  } catch (error) {
    console.error('DatabaseRoutes: Error deleting invoices:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete invoices'
    });
  }
});

// Delete all complaints (admin only)
// Description: Delete all complaints from the database
// Endpoint: POST /api/database/delete-complaints
// Request: {}
// Response: { success: boolean, message: string, results: { before: number, deleted: number, after: number }, timestamp: string }
router.post('/delete-complaints', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('DatabaseRoutes: Delete all complaints request');

  try {
    const result = await DatabaseService.deleteAllComplaints();

    return res.status(200).json(result);
  } catch (error) {
    console.error('DatabaseRoutes: Error deleting complaints:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete complaints'
    });
  }
});

// Delete all repair requests (admin only)
// Description: Delete all repair requests from the database
// Endpoint: POST /api/database/delete-repair-requests
// Request: {}
// Response: { success: boolean, message: string, results: { before: number, deleted: number, after: number }, timestamp: string }
router.post('/delete-repair-requests', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('DatabaseRoutes: Delete all repair requests request');

  try {
    const result = await DatabaseService.deleteAllRepairRequests();

    return res.status(200).json(result);
  } catch (error) {
    console.error('DatabaseRoutes: Error deleting repair requests:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete repair requests'
    });
  }
});

// --- Monitoring Metrics ---
router.get('/metrics', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const db = req.query.db || null;
    const metrics = await DatabaseService.getMonitoringMetrics(db);
    res.json({ metrics });
  } catch (e) {
    console.error('DatabaseRoutes: Error in /metrics:', e);
    res.status(500).json({ error: e.message || 'Failed to get metrics' });
  }
});

module.exports = router;

// Delete all notifications (admin only)
router.post('/delete-notifications', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('DatabaseRoutes: Delete all notifications request');
  try {
    const result = await DatabaseService.deleteAllNotifications();
    return res.status(200).json(result);
  } catch (error) {
    console.error('DatabaseRoutes: Error deleting notifications:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete notifications'
    });
  }
});

// Delete all messages (admin only)
router.post('/delete-messages', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('DatabaseRoutes: Delete all messages request');
  try {
    const result = await DatabaseService.deleteAllMessages();
    return res.status(200).json(result);
  } catch (error) {
    console.error('DatabaseRoutes: Error deleting messages:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete messages'
    });
  }
});

// Delete all needslists (admin only)
router.post('/delete-needslists', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('DatabaseRoutes: Delete all needslists request');
  try {
    const result = await DatabaseService.deleteAllNeedslists();
    return res.status(200).json(result);
  } catch (error) {
    console.error('DatabaseRoutes: Error deleting needslists:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete needslists'
    });
  }
});

// Delete all payments (admin only)
router.post('/delete-payments', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('DatabaseRoutes: Delete all payments request');
  try {
    const result = await DatabaseService.deleteAllPayments();
    return res.status(200).json(result);
  } catch (error) {
    console.error('DatabaseRoutes: Error deleting payments:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete payments'
    });
  }
});

// Delete all contact messages (admin only)
router.post('/delete-contact-messages', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('DatabaseRoutes: Delete all contact messages request');
  try {
    const result = await DatabaseService.deleteAllContactMessages();
    return res.status(200).json(result);
  } catch (error) {
    console.error('DatabaseRoutes: Error deleting contact messages:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete contact messages'
    });
  }
});