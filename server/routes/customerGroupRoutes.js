const express = require('express');
const CustomerGroupService = require('../services/customerGroupService');
const { requireUser, requireRole } = require('./middleware/auth');

const router = express.Router();

router.get('/overview', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const overview = await CustomerGroupService.getOverview();
    return res.status(200).json({
      success: true,
      overview,
    });
  } catch (error) {
    console.error('Error getting customer group overview:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get customer group overview',
    });
  }
});

router.get('/', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const result = await CustomerGroupService.listGroups(req.query);
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error listing customer groups:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to list customer groups',
    });
  }
});

router.post('/', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const group = await CustomerGroupService.createGroup(req.body, req.user._id);
    return res.status(201).json({
      success: true,
      message: 'Customer group created successfully',
      group,
    });
  } catch (error) {
    console.error('Error creating customer group:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to create customer group',
    });
  }
});

router.get('/rules', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const result = await CustomerGroupService.listRules(req.query);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('Error listing customer group rules:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to list customer group rules' });
  }
});

router.post('/rules', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const rule = await CustomerGroupService.createRule(req.body);
    return res.status(201).json({ success: true, rule });
  } catch (error) {
    console.error('Error creating customer group rule:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to create customer group rule' });
  }
});

router.put('/rules/:id', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const rule = await CustomerGroupService.updateRule(req.params.id, req.body);
    return res.status(200).json({ success: true, rule });
  } catch (error) {
    console.error('Error updating customer group rule:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to update customer group rule' });
  }
});

router.patch('/rules/:id/status', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    if (!req.body.status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }
    const rule = await CustomerGroupService.changeRuleStatus(req.params.id, req.body.status);
    return res.status(200).json({ success: true, rule });
  } catch (error) {
    console.error('Error changing customer group rule status:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to change customer group rule status' });
  }
});

router.post('/rules/preview', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const preview = await CustomerGroupService.previewRule(req.body);
    return res.status(200).json({ success: true, preview });
  } catch (error) {
    console.error('Error previewing customer group rule:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to preview customer group rule' });
  }
});

router.post('/customers/:customerId/groups/recalculate', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const result = await CustomerGroupService.recalculateCustomerGroups(req.params.customerId, req.user._id);
    return res.status(200).json({ success: true, result });
  } catch (error) {
    console.error('Error recalculating customer groups:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to recalculate customer groups' });
  }
});

router.put('/customers/:customerId/groups/primary', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    if (!req.body.primaryGroupId) {
      return res.status(400).json({ success: false, error: 'primaryGroupId is required' });
    }

    const result = await CustomerGroupService.updateCustomerPrimaryGroup(
      req.params.customerId,
      req.body.primaryGroupId,
      req.user._id
    );
    return res.status(200).json({ success: true, result });
  } catch (error) {
    console.error('Error setting customer primary group:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to set customer primary group' });
  }
});

router.get('/:id', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const group = await CustomerGroupService.getGroupById(req.params.id);
    return res.status(200).json({
      success: true,
      group,
    });
  } catch (error) {
    console.error('Error getting customer group:', error);
    return res.status(404).json({
      success: false,
      error: error.message || 'Failed to get customer group',
    });
  }
});

router.put('/:id', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const group = await CustomerGroupService.updateGroup(req.params.id, req.body, req.user._id);
    return res.status(200).json({
      success: true,
      message: 'Customer group updated successfully',
      group,
    });
  } catch (error) {
    console.error('Error updating customer group:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to update customer group',
    });
  }
});

router.patch('/:id/status', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    if (!req.body.status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }

    const group = await CustomerGroupService.changeStatus(req.params.id, req.body.status, req.user._id);
    return res.status(200).json({
      success: true,
      message: 'Customer group status updated successfully',
      group,
    });
  } catch (error) {
    console.error('Error changing customer group status:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to change customer group status',
    });
  }
});

router.delete('/:id', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    await CustomerGroupService.deleteGroup(req.params.id);
    return res.status(200).json({
      success: true,
      message: 'Customer group deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting customer group:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to delete customer group',
    });
  }
});

router.get('/:id/customers', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const customers = await CustomerGroupService.getGroupCustomers(req.params.id, req.query);
    return res.status(200).json({
      success: true,
      ...customers,
    });
  } catch (error) {
    console.error('Error getting customer group customers:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get customer group customers',
    });
  }
});

router.post('/:id/assignments', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const assignment = await CustomerGroupService.addAssignment(req.params.id, req.body, req.user._id);
    return res.status(201).json({ success: true, assignment });
  } catch (error) {
    console.error('Error creating customer group assignment:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to create customer group assignment' });
  }
});

router.delete('/:id/assignments/:assignmentId', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    await CustomerGroupService.revokeAssignment(req.params.id, req.params.assignmentId, req.user._id);
    return res.status(200).json({ success: true, message: 'Assignment revoked successfully' });
  } catch (error) {
    console.error('Error revoking customer group assignment:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to revoke customer group assignment' });
  }
});

router.get('/:id/financial-summary', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const summary = await CustomerGroupService.getFinancialSummary(req.params.id);
    return res.status(200).json({ success: true, summary });
  } catch (error) {
    console.error('Error getting customer group financial summary:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to get customer group financial summary' });
  }
});

router.get('/:id/affiliate-summary', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const summary = await CustomerGroupService.getAffiliateSummary(req.params.id);
    return res.status(200).json({ success: true, summary });
  } catch (error) {
    console.error('Error getting customer group affiliate summary:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to get customer group affiliate summary' });
  }
});

module.exports = router;