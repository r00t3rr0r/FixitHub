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

    console.log('Fetching workflow templates with filters:', filters);
    const workflows = await WorkflowService.getWorkflowTemplates(filters);
    
    console.log('Workflow templates retrieved:', {
      count: workflows.length,
      workflows: workflows.map(w => ({
        id: w._id,
        name: w.name,
        stepsCount: w.steps?.length || 0,
        hasSteps: !!w.steps,
        hasDeviceTypes: !!w.deviceTypes,
        hasServiceTypes: !!w.serviceTypes
      }))
    });

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

// Reorder workflow steps (admin only)
router.put('/templates/:id/reorder-steps', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Reorder workflow steps request received:', req.params.id);

  try {
    const { stepOrderData } = req.body;
    const workflow = await WorkflowService.reorderWorkflowSteps(req.params.id, stepOrderData);

    return res.status(200).json({
      success: true,
      workflow,
      message: 'Workflow steps reordered successfully'
    });
  } catch (error) {
    console.error('Error reordering workflow steps:', error);
    if (error.message === 'Workflow template not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to reorder workflow steps'
    });
  }
});

// Add form field to workflow step (admin only)
router.post('/templates/:id/steps/:stepId/form-fields', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Add form field request received for step:', req.params.stepId);

  try {
    const workflow = await WorkflowService.addFormFieldToStep(req.params.id, req.params.stepId, req.body);

    return res.status(201).json({
      success: true,
      workflow,
      message: 'Form field added successfully'
    });
  } catch (error) {
    console.error('Error adding form field:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to add form field'
    });
  }
});

// Update form field in workflow step (admin only)
router.put('/templates/:id/steps/:stepId/form-fields/:fieldId', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Update form field request received:', req.params.fieldId);

  try {
    const workflow = await WorkflowService.updateFormField(
      req.params.id,
      req.params.stepId,
      req.params.fieldId,
      req.body
    );

    return res.status(200).json({
      success: true,
      workflow,
      message: 'Form field updated successfully'
    });
  } catch (error) {
    console.error('Error updating form field:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to update form field'
    });
  }
});

// Remove form field from workflow step (admin only)
router.delete('/templates/:id/steps/:stepId/form-fields/:fieldId', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Remove form field request received:', req.params.fieldId);

  try {
    const workflow = await WorkflowService.removeFormField(
      req.params.id,
      req.params.stepId,
      req.params.fieldId
    );

    return res.status(200).json({
      success: true,
      workflow,
      message: 'Form field removed successfully'
    });
  } catch (error) {
    console.error('Error removing form field:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to remove form field'
    });
  }
});

// Add automation rule to workflow step (admin only)
router.post('/templates/:id/steps/:stepId/automation-rules', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Add automation rule request received for step:', req.params.stepId);

  try {
    const workflow = await WorkflowService.addAutomationRule(req.params.id, req.params.stepId, req.body);

    return res.status(201).json({
      success: true,
      workflow,
      message: 'Automation rule added successfully'
    });
  } catch (error) {
    console.error('Error adding automation rule:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to add automation rule'
    });
  }
});

// Update automation rule (admin only)
router.put('/templates/:id/steps/:stepId/automation-rules/:ruleId', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Update automation rule request received:', req.params.ruleId);

  try {
    const workflow = await WorkflowService.updateAutomationRule(
      req.params.id,
      req.params.stepId,
      req.params.ruleId,
      req.body
    );

    return res.status(200).json({
      success: true,
      workflow,
      message: 'Automation rule updated successfully'
    });
  } catch (error) {
    console.error('Error updating automation rule:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to update automation rule'
    });
  }
});

// Remove automation rule (admin only)
router.delete('/templates/:id/steps/:stepId/automation-rules/:ruleId', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Remove automation rule request received:', req.params.ruleId);

  try {
    const workflow = await WorkflowService.removeAutomationRule(
      req.params.id,
      req.params.stepId,
      req.params.ruleId
    );

    return res.status(200).json({
      success: true,
      workflow,
      message: 'Automation rule removed successfully'
    });
  } catch (error) {
    console.error('Error removing automation rule:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to remove automation rule'
    });
  }
});

// Duplicate workflow template (admin only)
router.post('/templates/:id/duplicate', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Duplicate workflow template request received:', req.params.id);

  try {
    const { newName } = req.body;
    const workflow = await WorkflowService.duplicateWorkflowTemplate(req.params.id, newName);

    return res.status(201).json({
      success: true,
      workflow,
      message: 'Workflow template duplicated successfully'
    });
  } catch (error) {
    console.error('Error duplicating workflow template:', error);
    if (error.message === 'Workflow template not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to duplicate workflow template'
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