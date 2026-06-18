const express = require('express');
const router = express.Router();
const RepairWorkflowService = require('../services/repairWorkflowService');
const { requireUser } = require('./middleware/auth');

router.get('/admin/inactive', requireUser, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const { thresholdHours = 3 } = req.query;
    const thresholdMs = thresholdHours * 60 * 60 * 1000;
    const workflows = await RepairWorkflowService.getInactiveWorkflows(thresholdMs);

    res.json({
      success: true,
      workflows,
    });
  } catch (error) {
    console.error('Error getting inactive workflows:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/:orderId/init', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { customerId, inspectionId } = req.body;
    const technicianId = req.user._id;

    const workflow = await RepairWorkflowService.initializeRepairWorkflow(
      orderId,
      customerId,
      technicianId,
      inspectionId,
    );

    res.json({
      success: true,
      workflow,
    });
  } catch (error) {
    console.error('Error initializing repair workflow:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/:orderId/approve', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { internalNotes, orderChanges, notifyCustomer } = req.body;
    const technicianId = req.user._id;
    const technicianName = req.user.name || req.user.email;

    const workflow = await RepairWorkflowService.approveRepairStart(
      orderId,
      internalNotes,
      orderChanges,
      notifyCustomer,
      technicianId,
      technicianName,
    );

    res.json({
      success: true,
      workflow,
    });
  } catch (error) {
    console.error('Error approving repair start:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get('/:orderId', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params;
    const workflow = await RepairWorkflowService.getActiveWorkflow(orderId);

    res.json({
      success: true,
      workflow: workflow || null,
    });
  } catch (error) {
    console.error('Error getting active workflow:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/:orderId/pause', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { pauseReason } = req.body;
    const technicianId = req.user._id;
    const technicianName = req.user.name || req.user.email;

    const workflow = await RepairWorkflowService.pauseRepair(orderId, pauseReason, technicianId, technicianName);

    res.json({
      success: true,
      workflow,
    });
  } catch (error) {
    console.error('Error pausing repair:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/:orderId/resume', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params;
    const technicianId = req.user._id;
    const technicianName = req.user.name || req.user.email;

    const workflow = await RepairWorkflowService.resumeRepair(orderId, technicianId, technicianName);

    res.json({
      success: true,
      workflow,
    });
  } catch (error) {
    console.error('Error resuming repair:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/:orderId/complete', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params;
    const technicianId = req.user._id;
    const technicianName = req.user.name || req.user.email;

    const workflow = await RepairWorkflowService.completeRepair(orderId, technicianId, technicianName);

    res.json({
      success: true,
      workflow,
    });
  } catch (error) {
    console.error('Error completing repair:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.post('/:orderId/incidents', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { incidentType, reason, additionalData } = req.body;
    const technicianId = req.user._id;
    const technicianName = req.user.name || req.user.email;

    const workflow = await RepairWorkflowService.reportIncident(
      orderId,
      incidentType,
      reason,
      additionalData,
      technicianId,
      technicianName,
    );

    res.json({
      success: true,
      workflow,
    });
  } catch (error) {
    console.error('Error reporting incident:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
