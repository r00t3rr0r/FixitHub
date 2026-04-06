const express = require('express');
const SystemConfigService = require('../services/systemConfigService');
const ProviderConfigService = require('../services/providerConfigService');
const EmailService = require('../services/emailService');
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

// Send a notification template as a real test email
router.post('/notification-templates/:id/send-test', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Send template test email request received:', req.params.id);

  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ success: false, message: 'Recipient address (to) is required' });

    const config = await SystemConfigService.getSystemConfiguration();
    const template = config.notificationTemplates.id(req.params.id);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    if (template.type !== 'email') {
      return res.status(400).json({ success: false, message: 'Only email templates can be sent as test email' });
    }

    const sampleTrackingUrl = await EmailService.buildSystemUrl('/tracking/REP-2026-0001');
    const sampleVerificationUrl = await EmailService.buildSystemUrl('/verify/example-token');
    const samplePasswordResetUrl = await EmailService.buildSystemUrl('/reset/example-token');
    const sampleInvoiceUrl = await EmailService.buildSystemUrl('/invoice/INV-2026-0001');

    // Replace all {{variable}} placeholders with sample values
    const fillPlaceholders = (text) => {
      const sampleValues = {
        customerName: 'Max Mustermann',
        firstName: 'Max',
        lastName: 'Mustermann',
        email: to,
        orderNumber: 'ORD-2026-0001',
        repairNumber: 'REP-2026-0001',
        deviceName: 'iPhone 15 Pro',
        deviceModel: 'iPhone 15 Pro',
        status: 'In Bearbeitung',
        estimatedCost: '89,00 €',
        totalAmount: '89,00 €',
        amountPaid: '89,00 €',
        technician: 'FixitHub Service',
        notes: 'Ihr Gerät wird gerade geprüft.',
        completionDate: new Date().toLocaleDateString('de-DE'),
        shopName: 'FixitHub',
        shopAddress: 'Musterstraße 1, 12345 Musterstadt',
        supportEmail: 'support@fixithub.de',
        supportPhone: '+49 123 456789',
        trackingUrl: sampleTrackingUrl,
        verificationUrl: sampleVerificationUrl,
        passwordResetUrl: samplePasswordResetUrl,
        invoiceUrl: sampleInvoiceUrl,
      };
      return text.replace(/{{(\w+)}}/g, (match, key) => sampleValues[key] || `[${key}]`);
    };

    const subject = fillPlaceholders(template.subject || `[Test] ${template.name}`);
    const htmlContent = fillPlaceholders(template.content);

    // Build SMTP transporter from saved config
    const nodemailer = require('nodemailer');
    const emailSettings = config.emailSettings;

    if (!emailSettings || !emailSettings.smtpHost) {
      return res.status(400).json({ success: false, message: 'Keine SMTP-Konfiguration gefunden. Bitte zuerst E-Mail-Einstellungen speichern.' });
    }

    const transporterConfig = {
      host: emailSettings.smtpHost,
      port: emailSettings.smtpPort || 587,
      secure: emailSettings.requiresTLS && (emailSettings.smtpPort === 465),
    };

    if (emailSettings.requiresAuthentication && emailSettings.smtpUsername && emailSettings.smtpPassword) {
      transporterConfig.auth = { user: emailSettings.smtpUsername, pass: emailSettings.smtpPassword };
    }

    const transporter = nodemailer.createTransport(transporterConfig);
    const from = emailSettings.smtpUsername || `noreply@${emailSettings.smtpHost}`;

    const mailOptions = {
      from,
      to,
      subject,
      html: htmlContent,
      text: htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('Template test email sent:', info.messageId);
    return res.status(200).json({
      success: true,
      message: `Test-E-Mail der Vorlage "${template.name}" erfolgreich an ${to} gesendet (ID: ${info.messageId})`
    });
  } catch (error) {
    console.error('Error sending template test email:', error);
    return res.status(500).json({ success: false, message: `Senden fehlgeschlagen: ${error.message}` });
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

// Test email settings (admin only)
router.post('/email/test', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Test email settings request received');

  try {
    const { smtpHost, smtpPort, smtpUsername, smtpPassword, requiresAuthentication, requiresTLS } = req.body;

    if (!smtpHost) {
      return res.status(400).json({
        success: false,
        message: 'SMTP Host is required'
      });
    }

    const result = await SystemConfigService.testEmailSettings({
      smtpHost,
      smtpPort: smtpPort || 587,
      smtpUsername,
      smtpPassword,
      requiresAuthentication: requiresAuthentication !== false,
      requiresTLS: requiresTLS !== false
    });

    return res.status(200).json({
      success: result.success,
      message: result.message
    });
  } catch (error) {
    console.error('Error testing email settings:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to test email settings'
    });
  }
});

// Send a real test email to verify SMTP delivery end-to-end
router.post('/email/send-test', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('Send test email request received');

  try {
    const { to, subject, body, from, smtpHost, smtpPort, smtpUsername, smtpPassword, requiresAuthentication, requiresTLS } = req.body;

    if (!to) return res.status(400).json({ success: false, message: 'Recipient address (to) is required' });
    if (!subject) return res.status(400).json({ success: false, message: 'Subject is required' });
    if (!smtpHost) return res.status(400).json({ success: false, message: 'SMTP Host is required' });

    const nodemailer = require('nodemailer');

    const transporterConfig = {
      host: smtpHost,
      port: smtpPort || 587,
      secure: requiresTLS && (smtpPort === 465)
    };

    if (requiresAuthentication !== false) {
      let username = smtpUsername;
      let password = smtpPassword;

      // If password not sent from frontend, load from saved config
      if (!password) {
        const SystemConfigService = require('../services/systemConfigService');
        const savedConfig = await SystemConfigService.getSystemConfiguration();
        if (savedConfig && savedConfig.emailSettings) {
          if (!username) username = savedConfig.emailSettings.smtpUsername;
          password = savedConfig.emailSettings.smtpPassword;
        }
      }

      if (username || password) {
        transporterConfig.auth = { user: username, pass: password };
      }
    }

    const transporter = nodemailer.createTransport(transporterConfig);

    const senderAddress = from || smtpUsername || `noreply@${smtpHost}`;

    const info = await transporter.sendMail({
      from: senderAddress,
      to,
      subject,
      text: body || 'FixitHub SMTP Test',
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="color:#2563eb">FixitHub SMTP Test</h2>
        <p>${(body || '').replace(/\n/g, '<br>')}</p>
        <hr style="margin:24px 0;border-color:#e5e7eb">
        <p style="color:#6b7280;font-size:12px">Gesendet über ${smtpHost}:${smtpPort} · ${new Date().toLocaleString('de-DE')}</p>
      </div>`
    });

    console.log('Test email sent:', info.messageId);
    return res.status(200).json({
      success: true,
      message: `Test-E-Mail erfolgreich gesendet (Message-ID: ${info.messageId})`
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    return res.status(500).json({
      success: false,
      message: `Test-E-Mail konnte nicht gesendet werden: ${error.message}`
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

// ===== EMAIL DELIVERY MONITORING ROUTES =====

/**
 * Get email delivery statistics and health
 * Provides insights into email delivery success rates and performance
 */
router.get('/email/delivery-stats', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const EmailService = require('../services/emailService');
    const stats = EmailService.deliveryTracker.getStatistics();
    const smtpStats = EmailService.deliveryTracker.getSMTPStatistics();

    return res.status(200).json({
      success: true,
      stats,
      smtpStats,
      message: 'Email delivery statistics retrieved'
    });
  } catch (error) {
    console.error('Error getting email delivery stats:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get email delivery statistics'
    });
  }
});

/**
 * Get email delivery history for a specific recipient
 * Shows recent delivery attempts and their status
 */
router.get('/email/delivery-history/:email', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const { email } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    // Decode email if URL encoded
    const decodedEmail = decodeURIComponent(email);

    const EmailService = require('../services/emailService');
    const history = EmailService.deliveryTracker.getDeliveryHistory(decodedEmail, limit);

    return res.status(200).json({
      success: true,
      email: decodedEmail,
      history,
      count: history.length,
      message: `Retrieved ${history.length} delivery records`
    });
  } catch (error) {
    console.error('Error getting email delivery history:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get email delivery history'
    });
  }
});

/**
 * Get complete delivery log (all records in memory)
 * Useful for debugging and monitoring overall email health
 */
router.get('/email/delivery-log', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const EmailService = require('../services/emailService');
    const filter = req.query.filter || 'all'; // 'all', 'sent', 'failed', 'queued'

    const allLogs = EmailService.deliveryTracker.deliveryLog;
    
    let filteredLogs = allLogs;
    if (filter !== 'all') {
      filteredLogs = allLogs.filter(log => log.status === filter);
    }

    // Sort by timestamp descending
    const sortedLogs = filteredLogs.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    // Paginate results
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedLogs = sortedLogs.slice(startIndex, endIndex);

    return res.status(200).json({
      success: true,
      logs: paginatedLogs,
      pagination: {
        page,
        limit,
        total: sortedLogs.length,
        pages: Math.ceil(sortedLogs.length / limit)
      },
      filter,
      message: `Retrieved ${paginatedLogs.length} email delivery logs`
    });
  } catch (error) {
    console.error('Error getting email delivery log:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get email delivery log'
    });
  }
});

/**
 * Get advanced email logging protocol including SMTP connection log
 */
router.get('/email/advanced-log', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const EmailService = require('../services/emailService');
    const filter = req.query.filter || 'all';
    const smtpStatus = req.query.smtpStatus || 'all';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const smtpLimit = parseInt(req.query.smtpLimit) || 50;

    const allLogs = EmailService.deliveryTracker.deliveryLog;
    const filteredDeliveryLogs = filter === 'all'
      ? allLogs
      : allLogs.filter((log) => log.status === filter);

    const sortedDeliveryLogs = [...filteredDeliveryLogs].sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedDeliveryLogs = sortedDeliveryLogs.slice(startIndex, endIndex);

    const smtpConnectionLog = EmailService.deliveryTracker.getSMTPConnectionLog(smtpStatus, smtpLimit);
    const smtpStats = EmailService.deliveryTracker.getSMTPStatistics();

    return res.status(200).json({
      success: true,
      deliveryLogs: paginatedDeliveryLogs,
      smtpConnectionLog,
      smtpStats,
      pagination: {
        page,
        limit,
        total: sortedDeliveryLogs.length,
        pages: Math.ceil(sortedDeliveryLogs.length / limit)
      },
      filters: {
        delivery: filter,
        smtp: smtpStatus
      },
      message: 'Advanced email logging protocol retrieved'
    });
  } catch (error) {
    console.error('Error getting advanced email log:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get advanced email log'
    });
  }
});

/**
 * Clear delivery log entries (all or by status)
 */
router.delete('/email/delivery-log', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const status = req.query.status || 'all';
    const EmailService = require('../services/emailService');
    const clearedCount = EmailService.deliveryTracker.clearDeliveryLog(status);

    return res.status(200).json({
      success: true,
      clearedCount,
      status,
      message: `${clearedCount} delivery log entries cleared`
    });
  } catch (error) {
    console.error('Error clearing email delivery log:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear email delivery log'
    });
  }
});

/**
 * Clear SMTP connection log entries (all or by status)
 */
router.delete('/email/smtp-log', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const status = req.query.status || 'all';
    const EmailService = require('../services/emailService');
    const clearedCount = EmailService.deliveryTracker.clearSMTPConnectionLog(status);

    return res.status(200).json({
      success: true,
      clearedCount,
      status,
      message: `${clearedCount} SMTP log entries cleared`
    });
  } catch (error) {
    console.error('Error clearing SMTP connection log:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear SMTP log'
    });
  }
});

module.exports = router;
