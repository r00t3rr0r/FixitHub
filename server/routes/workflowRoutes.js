const express = require('express');
const WorkflowService = require('../services/workflowService');
const { requireUser, requireRole } = require('./middleware/auth');

const router = express.Router();

// Get all workflow templates (admin/staff only)
router.get('/templates', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  console.log('Get workflow templates request received');

  try {
    const filters = {
      deviceType: req.query.deviceType,
      serviceType: req.query.serviceType,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined
    };

    const workflows = await WorkflowService.getWorkflowTemplates(filters);

    return res.status(200).json({
      success: true,
      workflows
    });
  } catch (error) {
    console.error('Error getting workflow templates:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get workflow templates'
    });
  }
});

// Get single workflow template by ID (admin/staff only)
router.get('/templates/:id', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  console.log('Get workflow template by ID request received:', req.params.id);

  try {
    const workflow = await WorkflowService.getWorkflowTemplateById(req.params.id);

    return res.status(200).json({
      success: true,
      workflow
    });
  } catch (error) {
    console.error('Error getting workflow template by ID:', error);
    if (error.message === 'Workflow template not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to get workflow template'
    });
  }
});

// Create new workflow template (admin only)
router.post('/templates', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Create workflow template request received');

  try {
    const workflow = await WorkflowService.createWorkflowTemplate(req.body);

    return res.status(201).json({
      success: true,
      workflow,
      message: 'Workflow template created successfully'
    });
  } catch (error) {
    console.error('Error creating workflow template:', error);
    return res.status(400).json({
      error: error.message || 'Failed to create workflow template'
    });
  }
});

// Update workflow template (admin only)
router.put('/templates/:id', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Update workflow template request received:', req.params.id);

  try {
    const workflow = await WorkflowService.updateWorkflowTemplate(req.params.id, req.body);

    return res.status(200).json({
      success: true,
      workflow,
      message: 'Workflow template updated successfully'
    });
  } catch (error) {
    console.error('Error updating workflow template:', error);
    if (error.message === 'Workflow template not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to update workflow template'
    });
  }
});

// Delete workflow template (admin only)
router.delete('/templates/:id', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Delete workflow template request received:', req.params.id);

  try {
    const result = await WorkflowService.deleteWorkflowTemplate(req.params.id);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error deleting workflow template:', error);
    if (error.message === 'Workflow template not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to delete workflow template'
    });
  }
});

// Get all add-on workflows (admin/staff only)
router.get('/addons', requireUser, requireRole(['admin', 'staff']), async (req, res) => {
  console.log('Get add-on workflows request received');

  try {
    const addOnWorkflows = await WorkflowService.getAddOnWorkflows();

    return res.status(200).json({
      success: true,
      addOnWorkflows
    });
  } catch (error) {
    console.error('Error getting add-on workflows:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get add-on workflows'
    });
  }
});

// Create new add-on workflow (admin only)
router.post('/addons', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Create add-on workflow request received');

  try {
    const addOnWorkflow = await WorkflowService.createAddOnWorkflow(req.body);

    return res.status(201).json({
      success: true,
      addOnWorkflow,
      message: 'Add-on workflow created successfully'
    });
  } catch (error) {
    console.error('Error creating add-on workflow:', error);
    return res.status(400).json({
      error: error.message || 'Failed to create add-on workflow'
    });
  }
});

// Update add-on workflow (admin only)
router.put('/addons/:id', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Update add-on workflow request received:', req.params.id);

  try {
    const addOnWorkflow = await WorkflowService.updateAddOnWorkflow(req.params.id, req.body);

    return res.status(200).json({
      success: true,
      addOnWorkflow,
      message: 'Add-on workflow updated successfully'
    });
  } catch (error) {
    console.error('Error updating add-on workflow:', error);
    if (error.message === 'Add-on workflow not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to update add-on workflow'
    });
  }
});

// Get workflow statistics (admin only)
router.get('/stats', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Get workflow statistics request received');

  try {
    const stats = await WorkflowService.getWorkflowStats();

    return res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting workflow statistics:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get workflow statistics'
    });
  }
});

module.exports = router;