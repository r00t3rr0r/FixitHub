const express = require('express');
const SystemConfigService = require('../services/systemConfigService');
const ProviderConfigService = require('../services/providerConfigService');
const { requireUser, requireRole } = require('./middleware/auth');

const router = express.Router();

// Get system configuration (admin only)
router.get('/', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Get system configuration request received');

  try {
    const config = await SystemConfigService.getSystemConfiguration();

    return res.status(200).json({
      success: true,
      config
    });
  } catch (error) {
    console.error('Error getting system configuration:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get system configuration'
    });
  }
});

// Update system configuration (admin only)
router.put('/', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Update system configuration request received');

  try {
    const config = await SystemConfigService.updateSystemConfiguration(req.body);

    return res.status(200).json({
      success: true,
      config,
      message: 'System configuration updated successfully'
    });
  } catch (error) {
    console.error('Error updating system configuration:', error);
    return res.status(500).json({
      error: error.message || 'Failed to update system configuration'
    });
  }
});

// Get system status (admin only)
router.get('/status', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Get system status request received');

  try {
    const status = await SystemConfigService.getSystemStatus();

    return res.status(200).json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Error getting system status:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get system status'
    });
  }
});

// Get notification templates (admin only)
router.get('/notification-templates', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Get notification templates request received');

  try {
    const templates = await SystemConfigService.getNotificationTemplates();

    return res.status(200).json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('Error getting notification templates:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get notification templates'
    });
  }
});

// Create notification template (admin only)
router.post('/notification-templates', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Create notification template request received');

  try {
    const template = await SystemConfigService.createNotificationTemplate(req.body);

    return res.status(201).json({
      success: true,
      template,
      message: 'Notification template created successfully'
    });
  } catch (error) {
    console.error('Error creating notification template:', error);
    return res.status(400).json({
      error: error.message || 'Failed to create notification template'
    });
  }
});

// Update notification template (admin only)
router.put('/notification-templates/:id', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Update notification template request received:', req.params.id);

  try {
    const template = await SystemConfigService.updateNotificationTemplate(req.params.id, req.body);

    return res.status(200).json({
      success: true,
      template,
      message: 'Notification template updated successfully'
    });
  } catch (error) {
    console.error('Error updating notification template:', error);
    if (error.message === 'Notification template not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to update notification template'
    });
  }
});

// Delete notification template (admin only)
router.delete('/notification-templates/:id', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Delete notification template request received:', req.params.id);

  try {
    const result = await SystemConfigService.deleteNotificationTemplate(req.params.id);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error deleting notification template:', error);
    return res.status(500).json({
      error: error.message || 'Failed to delete notification template'
    });
  }
});

// Get integrations (admin only)
router.get('/integrations', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Get integrations request received');

  try {
    const integrations = await SystemConfigService.getIntegrations();

    return res.status(200).json({
      success: true,
      integrations
    });
  } catch (error) {
    console.error('Error getting integrations:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get integrations'
    });
  }
});

// Create integration (admin only)
router.post('/integrations', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Create integration request received');

  try {
    const integration = await SystemConfigService.createIntegration(req.body);

    return res.status(201).json({
      success: true,
      integration,
      message: 'Integration created successfully'
    });
  } catch (error) {
    console.error('Error creating integration:', error);
    return res.status(400).json({
      error: error.message || 'Failed to create integration'
    });
  }
});

// Update integration (admin only)
router.put('/integrations/:id', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Update integration request received:', req.params.id);

  try {
    const integration = await SystemConfigService.updateIntegration(req.params.id, req.body);

    return res.status(200).json({
      success: true,
      integration,
      message: 'Integration updated successfully'
    });
  } catch (error) {
    console.error('Error updating integration:', error);
    if (error.message === 'Integration not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to update integration'
    });
  }
});

// Delete integration (admin only)
router.delete('/integrations/:id', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Delete integration request received:', req.params.id);

  try {
    const result = await SystemConfigService.deleteIntegration(req.params.id);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error deleting integration:', error);
    return res.status(500).json({
      error: error.message || 'Failed to delete integration'
    });
  }
});

// Test integration (admin only)
router.post('/integrations/:id/test', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Test integration request received:', req.params.id);

  try {
    const result = await SystemConfigService.testIntegration(req.params.id);

    return res.status(200).json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Error testing integration:', error);
    if (error.message === 'Integration not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to test integration'
    });
  }
});

// ===== SMS/PUSH PROVIDER CONFIGURATION ROUTES =====

// Get all SMS/Push provider configurations
router.get('/providers', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Get providers request received');

  try {
    const providers = await ProviderConfigService.getProviderIntegrations();

    return res.status(200).json({
      success: true,
      providers,
      message: `Found ${providers.length} provider configurations`
    });
  } catch (error) {
    console.error('Error getting providers:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get providers'
    });
  }
});

// Configure SMS provider (Twilio, Vonage, AWS SNS)
router.post('/providers/sms', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Configure SMS provider request received');

  try {
    const smsConfig = req.body;

    if (!smsConfig.provider) {
      return res.status(400).json({
        error: 'Provider name is required'
      });
    }

    const provider = await ProviderConfigService.configureSMSProvider(smsConfig);

    return res.status(201).json({
      success: true,
      provider,
      message: 'SMS provider configured successfully'
    });
  } catch (error) {
    console.error('Error configuring SMS provider:', error);
    return res.status(400).json({
      error: error.message || 'Failed to configure SMS provider'
    });
  }
});

// Configure Push provider (Firebase, OneSignal, Expo)
router.post('/providers/push', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Configure Push provider request received');

  try {
    const pushConfig = req.body;

    if (!pushConfig.provider) {
      return res.status(400).json({
        error: 'Provider name is required'
      });
    }

    const provider = await ProviderConfigService.configurePushProvider(pushConfig);

    return res.status(201).json({
      success: true,
      provider,
      message: 'Push provider configured successfully'
    });
  } catch (error) {
    console.error('Error configuring Push provider:', error);
    return res.status(400).json({
      error: error.message || 'Failed to configure Push provider'
    });
  }
});

// Update provider configuration
router.put('/providers/:id', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Update provider request received:', req.params.id);

  try {
    const config = await SystemConfigService.getSystemConfiguration();
    const provider = (config.integrations || []).find((int) => int._id.toString() === req.params.id);

    if (!provider || (provider.type !== 'sms' && provider.type !== 'push')) {
      return res.status(404).json({
        error: 'Provider not found'
      });
    }

    Object.assign(provider, req.body);
    config.markModified('integrations');
    await config.save();

    return res.status(200).json({
      success: true,
      provider,
      message: 'Provider updated successfully'
    });
  } catch (error) {
    console.error('Error updating provider:', error);
    return res.status(400).json({
      error: error.message || 'Failed to update provider'
    });
  }
});

// Test provider connection
router.post('/providers/:id/test', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Test provider request received:', req.params.id);

  try {
    const config = await SystemConfigService.getSystemConfiguration();
    const provider = (config.integrations || []).find((int) => int._id.toString() === req.params.id);

    if (!provider) {
      return res.status(404).json({
        error: 'Provider not found'
      });
    }

    let result;
    if (provider.type === 'sms') {
      result = await ProviderConfigService.testSMSProvider(req.params.id);
    } else if (provider.type === 'push') {
      result = await ProviderConfigService.testPushProvider(req.params.id);
    } else {
      return res.status(400).json({
        error: 'Invalid provider type'
      });
    }

    return res.status(200).json({
      success: true,
      result,
      message: `Provider test ${result.success ? 'passed' : 'failed'}`
    });
  } catch (error) {
    console.error('Error testing provider:', error);
    return res.status(400).json({
      error: error.message || 'Failed to test provider'
    });
  }
});

// Delete provider configuration
router.delete('/providers/:id', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Delete provider request received:', req.params.id);

  try {
    const config = await SystemConfigService.getSystemConfiguration();
    const providerIndex = (config.integrations || []).findIndex((int) => int._id.toString() === req.params.id);

    if (providerIndex === -1) {
      return res.status(404).json({
        error: 'Provider not found'
      });
    }

    const deleted = config.integrations.splice(providerIndex, 1)[0];
    config.markModified('integrations');
    await config.save();

    return res.status(200).json({
      success: true,
      message: 'Provider deleted successfully',
      deletedProvider: deleted
    });
  } catch (error) {
    console.error('Error deleting provider:', error);
    return res.status(400).json({
      error: error.message || 'Failed to delete provider'
    });
  }
});

// Get provider information and setup guide
router.get('/providers/info/:providerName', (req, res) => {
  console.log('Get provider info request received:', req.params.providerName);

  try {
    const info = ProviderConfigService.getProviderInfo(req.params.providerName);

    if (!info) {
      return res.status(404).json({
        error: `Unknown provider: ${req.params.providerName}`
      });
    }

    return res.status(200).json({
      success: true,
      info
    });
  } catch (error) {
    console.error('Error getting provider info:', error);
    return res.status(400).json({
      error: error.message || 'Failed to get provider info'
    });
  }
});

// Clear cache (admin only)
router.post('/cache/clear', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Clear cache request received');

  try {
    const result = await SystemConfigService.clearCache();

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error clearing cache:', error);
    return res.status(500).json({
      error: error.message || 'Failed to clear cache'
    });
  }
});

// Run security scan (admin only)
router.post('/security/scan', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Security scan request received');

  try {
    const result = await SystemConfigService.runSecurityScan();

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error running security scan:', error);
    return res.status(500).json({
      error: error.message || 'Failed to run security scan'
    });
  }
});

module.exports = router;
