const express = require('express');
const router = express.Router();
const { requireAdmin } = require('./middleware/auth');
const PageTemplateService = require('../services/pageTemplateService');

// Description: Get all available page templates
// Endpoint: GET /api/page-templates
// Request: {}
// Response: { templates: Array<Template> }
router.get('/', requireAdmin, async (req, res) => {
  try {
    console.log('GET /api/page-templates - Fetching available templates');

    const templates = PageTemplateService.getTemplates();

    res.status(200).json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch templates'
    });
  }
});

// Description: Get template by ID
// Endpoint: GET /api/page-templates/:templateId
// Request: { templateId: string }
// Response: { template: Template }
router.get('/:templateId', requireAdmin, async (req, res) => {
  try {
    const { templateId } = req.params;
    console.log(`GET /api/page-templates/${templateId} - Fetching template`);

    const template = PageTemplateService.getTemplateById(templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.status(200).json({
      success: true,
      template
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch template'
    });
  }
});

// Description: Apply template to page
// Endpoint: POST /api/page-templates/apply
// Request: { pageId: string, templateId: string }
// Response: { success: boolean, message: string }
router.post('/apply', requireAdmin, async (req, res) => {
  try {
    const { pageId, templateId } = req.body;
    const userId = req.user._id;

    console.log(`POST /api/page-templates/apply - Applying template ${templateId} to page ${pageId}`);

    if (!pageId || !templateId) {
      return res.status(400).json({
        success: false,
        error: 'Page ID and template ID are required'
      });
    }

    const result = await PageTemplateService.applyTemplate(pageId, templateId, userId);

    res.status(200).json(result);
  } catch (error) {
    console.error('Error applying template:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to apply template'
    });
  }
});

module.exports = router;
