const express = require('express');
const DiagnosticService = require('../services/diagnosticService');
const { requireUser, requireRole } = require('./middleware/auth');

const router = express.Router();

// Get diagnostic statistics (admin only)
router.get('/stats', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Get diagnostic stats request from user:', req.user.email);

  try {
    const stats = await DiagnosticService.getDiagnosticStats();
    return res.status(200).json({ stats });
  } catch (error) {
    console.error('Error getting diagnostic stats:', error);
    return res.status(500).json({ error: error.message || 'Failed to get diagnostic statistics' });
  }
});

// Get all diagnostic tests
router.get('/tests', requireUser, async (req, res) => {
  console.log('Get diagnostic tests request from user:', req.user.email);

  try {
    const { deviceType, category, search } = req.query;
    const filters = { deviceType, category, search };

    const tests = await DiagnosticService.getDiagnosticTests(filters);
    return res.status(200).json({ tests });
  } catch (error) {
    console.error('Error getting diagnostic tests:', error);
    return res.status(500).json({ error: error.message || 'Failed to get diagnostic tests' });
  }
});

// Get single diagnostic test
router.get('/tests/:testId', requireUser, async (req, res) => {
  console.log('Get diagnostic test request for:', req.params.testId);

  try {
    const test = await DiagnosticService.getDiagnosticTest(req.params.testId);
    return res.status(200).json({ test });
  } catch (error) {
    console.error('Error getting diagnostic test:', error);
    return res.status(500).json({ error: error.message || 'Failed to get diagnostic test' });
  }
});

// Create new diagnostic test (admin only)
router.post('/tests', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Create diagnostic test request from user:', req.user.email);

  try {
    const { name, description, deviceTypes, category, estimatedTime, tools, steps, passFailCriteria, troubleshootingGuide } = req.body;

    if (!name || !description || !deviceTypes || !category || !estimatedTime) {
      return res.status(400).json({ error: 'Name, description, device types, category, and estimated time are required' });
    }

    const testData = {
      name,
      description,
      deviceTypes,
      category,
      estimatedTime,
      tools: tools || [],
      steps: steps || [],
      passFailCriteria: passFailCriteria || [],
      troubleshootingGuide: troubleshootingGuide || []
    };

    const test = await DiagnosticService.createDiagnosticTest(testData, req.user._id);
    return res.status(201).json({
      success: true,
      message: 'Diagnostic test created successfully',
      test
    });
  } catch (error) {
    console.error('Error creating diagnostic test:', error);
    return res.status(500).json({ error: error.message || 'Failed to create diagnostic test' });
  }
});

// Update diagnostic test (admin only)
router.put('/tests/:testId', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Update diagnostic test request for:', req.params.testId);

  try {
    const updateData = req.body;
    const test = await DiagnosticService.updateDiagnosticTest(req.params.testId, updateData);
    return res.status(200).json({
      success: true,
      message: 'Diagnostic test updated successfully',
      test
    });
  } catch (error) {
    console.error('Error updating diagnostic test:', error);
    return res.status(500).json({ error: error.message || 'Failed to update diagnostic test' });
  }
});

// Delete diagnostic test (admin only)
router.delete('/tests/:testId', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Delete diagnostic test request for:', req.params.testId);

  try {
    await DiagnosticService.deleteDiagnosticTest(req.params.testId);
    return res.status(200).json({
      success: true,
      message: 'Diagnostic test deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting diagnostic test:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete diagnostic test' });
  }
});

// Get all diagnostic forms
router.get('/forms', requireUser, async (req, res) => {
  console.log('Get diagnostic forms request from user:', req.user.email);

  try {
    const { deviceType, search } = req.query;
    const filters = { deviceType, search };

    const forms = await DiagnosticService.getDiagnosticForms(filters);
    return res.status(200).json({ forms });
  } catch (error) {
    console.error('Error getting diagnostic forms:', error);
    return res.status(500).json({ error: error.message || 'Failed to get diagnostic forms' });
  }
});

// Get single diagnostic form
router.get('/forms/:formId', requireUser, async (req, res) => {
  console.log('Get diagnostic form request for:', req.params.formId);

  try {
    const form = await DiagnosticService.getDiagnosticForm(req.params.formId);
    return res.status(200).json({ form });
  } catch (error) {
    console.error('Error getting diagnostic form:', error);
    return res.status(500).json({ error: error.message || 'Failed to get diagnostic form' });
  }
});

// Create new diagnostic form (admin only)
router.post('/forms', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Create diagnostic form request from user:', req.user.email);

  try {
    const { name, description, deviceTypes, fields } = req.body;

    if (!name || !description || !deviceTypes || !fields) {
      return res.status(400).json({ error: 'Name, description, device types, and fields are required' });
    }

    const formData = {
      name,
      description,
      deviceTypes,
      fields
    };

    const form = await DiagnosticService.createDiagnosticForm(formData, req.user._id);
    return res.status(201).json({
      success: true,
      message: 'Diagnostic form created successfully',
      form
    });
  } catch (error) {
    console.error('Error creating diagnostic form:', error);
    return res.status(500).json({ error: error.message || 'Failed to create diagnostic form' });
  }
});

// Update diagnostic form (admin only)
router.put('/forms/:formId', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Update diagnostic form request for:', req.params.formId);

  try {
    const updateData = req.body;
    const form = await DiagnosticService.updateDiagnosticForm(req.params.formId, updateData);
    return res.status(200).json({
      success: true,
      message: 'Diagnostic form updated successfully',
      form
    });
  } catch (error) {
    console.error('Error updating diagnostic form:', error);
    return res.status(500).json({ error: error.message || 'Failed to update diagnostic form' });
  }
});

// Delete diagnostic form (admin only)
router.delete('/forms/:formId', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Delete diagnostic form request for:', req.params.formId);

  try {
    await DiagnosticService.deleteDiagnosticForm(req.params.formId);
    return res.status(200).json({
      success: true,
      message: 'Diagnostic form deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting diagnostic form:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete diagnostic form' });
  }
});

// Submit diagnostic result (staff and admin)
router.post('/results', requireUser, requireRole(['staff', 'admin']), async (req, res) => {
  console.log('Submit diagnostic result request from user:', req.user.email);

  try {
    const { orderId, testId, testName, results, overallStatus, notes, recommendedActions, photos } = req.body;

    if (!orderId || !testId || !testName || !results || !overallStatus) {
      return res.status(400).json({ error: 'Order ID, test ID, test name, results, and overall status are required' });
    }

    const resultData = {
      orderId,
      testId,
      testName,
      results,
      overallStatus,
      notes: notes || '',
      recommendedActions: recommendedActions || [],
      photos: photos || []
    };

    const result = await DiagnosticService.submitDiagnosticResult(resultData, req.user._id);
    return res.status(201).json({
      success: true,
      message: 'Diagnostic result submitted successfully',
      result
    });
  } catch (error) {
    console.error('Error submitting diagnostic result:', error);
    return res.status(500).json({ error: error.message || 'Failed to submit diagnostic result' });
  }
});

// Get diagnostic results for an order
router.get('/results/order/:orderId', requireUser, async (req, res) => {
  console.log('Get diagnostic results request for order:', req.params.orderId);

  try {
    const results = await DiagnosticService.getDiagnosticResults(req.params.orderId);
    return res.status(200).json({ results });
  } catch (error) {
    console.error('Error getting diagnostic results:', error);
    return res.status(500).json({ error: error.message || 'Failed to get diagnostic results' });
  }
});

module.exports = router;