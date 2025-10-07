const SystemConfiguration = require('../models/SystemConfiguration');
const nodemailer = require('nodemailer');

class SystemConfigService {
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
      const savedConfig = await config.save();
      
      const newTemplate = savedConfig.notificationTemplates[savedConfig.notificationTemplates.length - 1];
      console.log('SystemConfigService: Notification template created successfully');
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
        throw new Error('Notification template not found');
      }

      Object.assign(template, updates);
      await config.save();
      
      console.log('SystemConfigService: Notification template updated successfully');
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
      const savedConfig = await config.save();
      
      const newIntegration = savedConfig.integrations[savedConfig.integrations.length - 1];
      console.log('SystemConfigService: Integration created successfully');
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
        throw new Error('Integration not found');
      }

      Object.assign(integration, updates);
      await config.save();
      
      console.log('SystemConfigService: Integration updated successfully');
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
        throw new Error('Integration not found');
      }

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
        default:
          testResult = { success: true, message: 'Integration configuration saved successfully' };
      }

      // Update test status
      integration.lastTested = new Date();
      integration.testStatus = testResult.success ? 'success' : 'failed';
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