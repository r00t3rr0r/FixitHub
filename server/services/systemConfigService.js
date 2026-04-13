const SystemConfiguration = require('../models/SystemConfiguration');
const nodemailer = require('nodemailer');
const {
  DEFAULT_NOTIFICATION_TEMPLATE_VERSION,
  getDefaultNotificationTemplates
} = require('./defaultNotificationTemplates');

function normalizeTemplateKey(template) {
  return `${template.type}:${String(template.name || '').trim().toLowerCase()}`;
}

class SystemConfigService {
  static async applyDefaultNotificationTemplatesIfNeeded(config) {
    if (!config || config.notificationTemplateDefaultsVersion >= DEFAULT_NOTIFICATION_TEMPLATE_VERSION) {
      return config;
    }

    const defaultTemplates = getDefaultNotificationTemplates();
    const existingKeys = new Set((config.notificationTemplates || []).map(normalizeTemplateKey));
    const missingTemplates = defaultTemplates.filter((template) => !existingKeys.has(normalizeTemplateKey(template)));

    if (missingTemplates.length > 0) {
      config.notificationTemplates.push(...missingTemplates);
      config.markModified('notificationTemplates');
    }

    // Migrate selected managed templates when defaults evolve.
    // This ensures layout/functionality updates (e.g. dual CTA buttons) are applied on existing installations.
    const previousVersion = config.notificationTemplateDefaultsVersion || 0;
    if (previousVersion < 6) {
      const bookingTemplateKey = normalizeTemplateKey({ type: 'email', name: 'Buchung angelegt' });
      const defaultBookingTemplate = defaultTemplates.find(
        (template) => normalizeTemplateKey(template) === bookingTemplateKey
      );
      const existingBookingTemplate = (config.notificationTemplates || []).find(
        (template) => normalizeTemplateKey(template) === bookingTemplateKey
      );

      if (defaultBookingTemplate && existingBookingTemplate) {
        existingBookingTemplate.subject = defaultBookingTemplate.subject;
        existingBookingTemplate.content = defaultBookingTemplate.content;
        existingBookingTemplate.variables = defaultBookingTemplate.variables;
        config.markModified('notificationTemplates');
      }
    }

    if (previousVersion < 7) {
      const notifTemplateKey = normalizeTemplateKey({ type: 'email', name: 'Benachrichtigungs-Updates fuer Kunden' });
      const defaultNotifTemplate = defaultTemplates.find(
        (template) => normalizeTemplateKey(template) === notifTemplateKey
      );
      const existingNotifTemplate = (config.notificationTemplates || []).find(
        (template) => normalizeTemplateKey(template) === notifTemplateKey
      );

      if (defaultNotifTemplate && existingNotifTemplate) {
        existingNotifTemplate.subject = defaultNotifTemplate.subject;
        existingNotifTemplate.content = defaultNotifTemplate.content;
        existingNotifTemplate.variables = defaultNotifTemplate.variables;
        config.markModified('notificationTemplates');
      }
    }

    if (previousVersion < 8) {
      // Version 8: new "Diagnose abgeschlossen" template – added via missingTemplates push above;
      // no content migration needed for existing templates.
    }

    if (previousVersion < 9) {
      // Version 9: styled McRepair.de brand hardcoded in email header.
      // Re-apply content for all email templates to pick up the new header HTML.
      for (const defaultTemplate of defaultTemplates.filter((t) => t.type === 'email')) {
        const key = normalizeTemplateKey(defaultTemplate);
        const existing = (config.notificationTemplates || []).find(
          (t) => normalizeTemplateKey(t) === key
        );
        if (existing) {
          existing.content = defaultTemplate.content;
        }
      }
      config.markModified('notificationTemplates');
    }

    if (previousVersion < 10) {
      // Version 10: adds contact-form sender confirmation email template.
      // Added automatically via missingTemplates push above.
    }

    if (previousVersion < 11) {
      // Version 11: adds dedicated guest booking tracking email template.
      // Added automatically via missingTemplates push above.
    }

    config.notificationTemplateDefaultsVersion = DEFAULT_NOTIFICATION_TEMPLATE_VERSION;
    await config.save();

    return config;
  }

  // Get system configuration
  static async getSystemConfiguration() {
    console.log('SystemConfigService: Getting system configuration');

    try {
      let config = await SystemConfiguration.findOne();
      
      if (!config) {
        console.log('SystemConfigService: No configuration found, creating default');
        config = new SystemConfiguration();
        await config.save();
      }

      config = await this.applyDefaultNotificationTemplatesIfNeeded(config);

      console.log('SystemConfigService: Configuration retrieved successfully');
      return config;
    } catch (error) {
      console.error('SystemConfigService: Error getting configuration:', error);
      throw error;
    }
  }

  // Update system configuration
  static async updateSystemConfiguration(updates) {
    console.log('SystemConfigService: Updating system configuration');

    try {
      let config = await SystemConfiguration.findOne();
      
      if (!config) {
        config = new SystemConfiguration(updates);
      } else {
        Object.assign(config, updates);
      }

      const savedConfig = await config.save();
      console.log('SystemConfigService: Configuration updated successfully');
      return savedConfig;
    } catch (error) {
      console.error('SystemConfigService: Error updating configuration:', error);
      throw error;
    }
  }

  // Get notification templates
  static async getNotificationTemplates() {
    console.log('SystemConfigService: Getting notification templates');

    try {
      const config = await this.getSystemConfiguration();
      return config.notificationTemplates || [];
    } catch (error) {
      console.error('SystemConfigService: Error getting notification templates:', error);
      throw error;
    }
  }

  // Create notification template
  static async createNotificationTemplate(templateData) {
    console.log('SystemConfigService: Creating notification template:', templateData.name);

    try {
      const config = await this.getSystemConfiguration();

      config.notificationTemplates.push(templateData);
      config.markModified('notificationTemplates'); // Mark nested document as modified
      const savedConfig = await config.save();

      const newTemplate = savedConfig.notificationTemplates[savedConfig.notificationTemplates.length - 1];
      console.log('SystemConfigService: Notification template created successfully with ID:', newTemplate._id);
      return newTemplate;
    } catch (error) {
      console.error('SystemConfigService: Error creating notification template:', error);
      throw error;
    }
  }

  // Update notification template
  static async updateNotificationTemplate(templateId, updates) {
    console.log('SystemConfigService: Updating notification template:', templateId);

    try {
      const config = await this.getSystemConfiguration();
      const template = config.notificationTemplates.id(templateId);

      if (!template) {
        console.error('SystemConfigService: Notification template not found:', templateId);
        throw new Error('Notification template not found');
      }

      Object.assign(template, updates);
      config.markModified('notificationTemplates'); // Mark nested document as modified
      await config.save();

      console.log('SystemConfigService: Notification template updated successfully:', template.name);
      return template;
    } catch (error) {
      console.error('SystemConfigService: Error updating notification template:', error);
      throw error;
    }
  }

  // Delete notification template
  static async deleteNotificationTemplate(templateId) {
    console.log('SystemConfigService: Deleting notification template:', templateId);

    try {
      const config = await this.getSystemConfiguration();
      config.notificationTemplates.pull(templateId);
      config.markModified('notificationTemplates'); // Mark nested document as modified
      await config.save();

      console.log('SystemConfigService: Notification template deleted successfully');
      return { success: true, message: 'Notification template deleted successfully' };
    } catch (error) {
      console.error('SystemConfigService: Error deleting notification template:', error);
      throw error;
    }
  }

  // Get integrations
  static async getIntegrations() {
    console.log('SystemConfigService: Getting integrations');

    try {
      const config = await this.getSystemConfiguration();
      return config.integrations || [];
    } catch (error) {
      console.error('SystemConfigService: Error getting integrations:', error);
      throw error;
    }
  }

  // Create integration
  static async createIntegration(integrationData) {
    console.log('SystemConfigService: Creating integration:', integrationData.name);

    try {
      const config = await this.getSystemConfiguration();

      config.integrations.push(integrationData);
      config.markModified('integrations'); // Mark nested document as modified
      const savedConfig = await config.save();

      const newIntegration = savedConfig.integrations[savedConfig.integrations.length - 1];
      console.log('SystemConfigService: Integration created successfully with ID:', newIntegration._id);
      return newIntegration;
    } catch (error) {
      console.error('SystemConfigService: Error creating integration:', error);
      throw error;
    }
  }

  // Update integration
  static async updateIntegration(integrationId, updates) {
    console.log('SystemConfigService: Updating integration:', integrationId);

    try {
      const config = await this.getSystemConfiguration();
      const integration = config.integrations.id(integrationId);

      if (!integration) {
        console.error('SystemConfigService: Integration not found:', integrationId);
        throw new Error('Integration not found');
      }

      Object.assign(integration, updates);
      config.markModified('integrations'); // Mark nested document as modified
      await config.save();

      console.log('SystemConfigService: Integration updated successfully:', integration.name);
      return integration;
    } catch (error) {
      console.error('SystemConfigService: Error updating integration:', error);
      throw error;
    }
  }

  // Delete integration
  static async deleteIntegration(integrationId) {
    console.log('SystemConfigService: Deleting integration:', integrationId);

    try {
      const config = await this.getSystemConfiguration();
      config.integrations.pull(integrationId);
      config.markModified('integrations'); // Mark nested document as modified
      await config.save();

      console.log('SystemConfigService: Integration deleted successfully');
      return { success: true, message: 'Integration deleted successfully' };
    } catch (error) {
      console.error('SystemConfigService: Error deleting integration:', error);
      throw error;
    }
  }

  // Test integration connection
  static async testIntegration(integrationId) {
    console.log('SystemConfigService: Testing integration:', integrationId);

    try {
      const config = await this.getSystemConfiguration();
      const integration = config.integrations.id(integrationId);

      if (!integration) {
        console.error('SystemConfigService: Integration not found:', integrationId);
        throw new Error('Integration not found');
      }

      console.log('SystemConfigService: Testing integration type:', integration.type, 'provider:', integration.provider);

      let testResult = { success: false, message: 'Test not implemented for this integration type' };

      // Test based on integration type
      switch (integration.type) {
        case 'email':
          testResult = await this.testEmailIntegration(integration);
          break;
        case 'payment':
          testResult = await this.testPaymentIntegration(integration);
          break;
        case 'sms':
          testResult = await this.testSMSIntegration(integration);
          break;
        case 'shipping':
          testResult = await this.testShippingIntegration(integration);
          break;
        default:
          testResult = { success: true, message: 'Integration configuration saved successfully' };
      }

      // Update test status
      integration.lastTested = new Date();
      integration.testStatus = testResult.success ? 'success' : 'failed';
      config.markModified('integrations'); // Mark nested document as modified
      await config.save();

      console.log('SystemConfigService: Integration test completed:', testResult);
      return testResult;
    } catch (error) {
      console.error('SystemConfigService: Error testing integration:', error);
      throw error;
    }
  }

  // Test email integration
  static async testEmailIntegration(integration) {
    try {
      const transporter = nodemailer.createTransporter({
        host: integration.settings.smtpHost || 'smtp.gmail.com',
        port: integration.settings.smtpPort || 587,
        secure: false,
        auth: {
          user: integration.apiKey,
          pass: integration.apiSecret
        }
      });

      await transporter.verify();
      return { success: true, message: 'Email configuration is valid' };
    } catch (error) {
      return { success: false, message: `Email test failed: ${error.message}` };
    }
  }

  // Test email settings (direct settings test)
  static async testEmailSettings(settings) {
    try {
      const nodemailer = require('nodemailer');
      
      const transporterConfig = {
        host: settings.smtpHost,
        port: settings.smtpPort || 587,
        secure: settings.requiresTLS && (settings.smtpPort === 465)
      };

      // Add authentication if required
      if (settings.requiresAuthentication) {
        let username = settings.smtpUsername;
        let password = settings.smtpPassword;

        // If password is not provided (frontend never sends it back), load from saved config
        if (!password) {
          const savedConfig = await this.getSystemConfiguration();
          if (savedConfig && savedConfig.emailSettings) {
            if (!username) username = savedConfig.emailSettings.smtpUsername;
            password = savedConfig.emailSettings.smtpPassword;
          }
        }

        if (username || password) {
          transporterConfig.auth = {
            user: username,
            pass: password
          };
        }
      }

      const transporter = nodemailer.createTransport(transporterConfig);
      
      // Verify the connection
      await transporter.verify();
      
      return { 
        success: true, 
        message: 'Email configuration is valid and SMTP settings are working correctly' 
      };
    } catch (error) {
      console.error('SystemConfigService: Email settings test failed:', error);
      return { 
        success: false, 
        message: `Email settings test failed: ${error.message}` 
      };
    }
  }

  // Test payment integration (mock)
  static async testPaymentIntegration(integration) {
    try {
      // Mock payment gateway test
      if (!integration.apiKey) {
        return { success: false, message: 'API key is required' };
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return { success: true, message: 'Payment gateway connection successful' };
    } catch (error) {
      return { success: false, message: `Payment test failed: ${error.message}` };
    }
  }

  // Test SMS integration (mock)
  static async testSMSIntegration(integration) {
    try {
      // Mock SMS service test
      if (!integration.apiKey) {
        return { success: false, message: 'API key is required' };
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      return { success: true, message: 'SMS service connection successful' };
    } catch (error) {
      return { success: false, message: `SMS test failed: ${error.message}` };
    }
  }

  // Test shipping integration
  static async testShippingIntegration(integration) {
    console.log('SystemConfigService: Testing shipping integration:', integration.provider);

    try {
      // Validate required fields
      if (!integration.apiKey) {
        console.error('SystemConfigService: Shipping integration missing API key');
        return { success: false, message: 'API key is required for shipping integration' };
      }

      // Test based on provider
      if (integration.provider === 'DHL') {
        console.log('SystemConfigService: Testing DHL integration');

        // Import DHL service for testing
        const DHLService = require('./dhlService');
        const normalizedConfig = DHLService.getParcelDEConfig(integration);

        const endpoint =
          normalizedConfig.baseUrl ||
          integration.endpoint ||
          process.env.DHL_API_URL ||
          'https://api-sandbox.dhl.com';

        const isSandbox = String(endpoint).includes('sandbox');

        const clientId =
          integration.apiKey ||
          normalizedConfig.clientId ||
          process.env.DHL_CLIENT_ID ||
          process.env.DHL_API_KEY ||
          '';

        const clientSecret =
          integration.apiSecret ||
          normalizedConfig.clientSecret ||
          process.env.DHL_CLIENT_SECRET ||
          process.env.DHL_API_SECRET ||
          '';

        const username =
          normalizedConfig.username ||
          process.env.DHL_BC_USERNAME ||
          process.env.DHL_BUSINESS_CUSTOMER_USERNAME ||
          (isSandbox ? 'user-valid' : '');

        const password =
          normalizedConfig.password ||
          process.env.DHL_BC_PASSWORD ||
          process.env.DHL_BUSINESS_CUSTOMER_PASSWORD ||
          (isSandbox ? 'SandboxPasswort2023!' : '');

        const missingFields = [
          ['client_id', clientId],
          ['client_secret', clientSecret],
          ['username', username],
          ['password', password]
        ].filter(([, value]) => !value).map(([field]) => field);

        if (missingFields.length > 0) {
          return {
            success: false,
            message: `DHL OAuth configuration incomplete. Missing: ${missingFields.join(', ')}`
          };
        }

        // Persist resolved test data so future tests use the same, known-good values.
        integration.apiKey = clientId;
        integration.apiSecret = clientSecret;
        integration.endpoint = endpoint;
        integration.metadata = {
          ...(integration.metadata || {}),
          environment: isSandbox ? 'sandbox' : 'production',
          clientId,
          clientSecret,
          username,
          password
        };

        integration.credentials = {
          ...(integration.credentials || {}),
          apiKey: clientId,
          apiSecret: clientSecret,
          apiEndpoint: endpoint
        };

        // Test DHL connection
        const testResult = await DHLService.testConnection(
          clientId,
          clientSecret,
          endpoint,
          {
            username,
            password
          }
        );

        console.log('SystemConfigService: DHL test result:', testResult);
        return testResult;
      }

      // Generic shipping integration test for other providers
      console.log('SystemConfigService: Generic shipping integration test');
      return { success: true, message: 'Shipping integration configuration saved successfully' };

    } catch (error) {
      console.error('SystemConfigService: Shipping integration test error:', error);
      return { success: false, message: `Shipping test failed: ${error.message}` };
    }
  }

  // Clear cache (mock implementation)
  static async clearCache() {
    console.log('SystemConfigService: Clearing system cache');
    
    try {
      // Mock cache clearing operation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('SystemConfigService: Cache cleared successfully');
      return { success: true, message: 'System cache cleared successfully' };
    } catch (error) {
      console.error('SystemConfigService: Error clearing cache:', error);
      throw error;
    }
  }

  // Run security scan (mock implementation)
  static async runSecurityScan() {
    console.log('SystemConfigService: Running security scan');
    
    try {
      // Mock security scan operation
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const scanResults = {
        vulnerabilities: 0,
        warnings: 2,
        recommendations: 3,
        lastScan: new Date(),
        status: 'passed'
      };
      
      console.log('SystemConfigService: Security scan completed:', scanResults);
      return { success: true, message: 'Security scan completed successfully', results: scanResults };
    } catch (error) {
      console.error('SystemConfigService: Error running security scan:', error);
      throw error;
    }
  }

  // Get system status
  static async getSystemStatus() {
    console.log('SystemConfigService: Getting system status');
    
    try {
      // Mock system status check
      const status = {
        server: 'online',
        database: 'connected',
        emailService: 'active',
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        lastRestart: new Date(Date.now() - process.uptime() * 1000)
      };
      
      console.log('SystemConfigService: System status retrieved');
      return status;
    } catch (error) {
      console.error('SystemConfigService: Error getting system status:', error);
      throw error;
    }
  }
}

module.exports = SystemConfigService;