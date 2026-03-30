/**
 * SMS/Push Provider Configuration Service
 * Manages configuration for SMS (Twilio, Vonage, etc.) and Push (Firebase, etc.) providers
 */

const SystemConfigService = require('./systemConfigService');

class ProviderConfigService {
  /**
   * Get all SMS/Push provider integrations
   */
  static async getProviderIntegrations(types = ['sms', 'push']) {
    try {
      console.log('ProviderConfigService: Getting provider integrations for types:', types);
      
      const config = await SystemConfigService.getSystemConfiguration();
      const providers = (config.integrations || []).filter(int => types.includes(int.type));
      
      console.log(`ProviderConfigService: Found ${providers.length} provider integrations`);
      return providers;
    } catch (error) {
      console.error('ProviderConfigService: Error getting providers:', error);
      throw error;
    }
  }

  /**
   * Get SMS provider configuration
   */
  static async getSMSProvider() {
    try {
      const config = await SystemConfigService.getSystemConfiguration();
      const smsProvider = (config.integrations || []).find(int => int.type === 'sms' && int.isActive);
      
      if (!smsProvider) {
        console.log('ProviderConfigService: No active SMS provider configured');
        return null;
      }
      
      console.log('ProviderConfigService: SMS provider found:', smsProvider.provider);
      return smsProvider;
    } catch (error) {
      console.error('ProviderConfigService: Error getting SMS provider:', error);
      throw error;
    }
  }

  /**
   * Get Push provider configuration
   */
  static async getPushProvider() {
    try {
      const config = await SystemConfigService.getSystemConfiguration();
      const pushProvider = (config.integrations || []).find(int => int.type === 'push' && int.isActive);
      
      if (!pushProvider) {
        console.log('ProviderConfigService: No active Push provider configured');
        return null;
      }
      
      console.log('ProviderConfigService: Push provider found:', pushProvider.provider);
      return pushProvider;
    } catch (error) {
      console.error('ProviderConfigService: Error getting Push provider:', error);
      throw error;
    }
  }

  /**
   * Configure SMS provider (Twilio, Vonage, etc.)
   */
  static async configureSMSProvider(providerData) {
    try {
      console.log('ProviderConfigService: Configuring SMS provider:', providerData.provider);
      
      const provider = providerData.provider.toLowerCase();
      
      // Validate required fields based on provider
      this.validateSMSProviderConfig(provider, providerData);
      
      // Create integration object
      const integration = {
        name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} SMS`,
        type: 'sms',
        provider: provider,
        apiKey: providerData.apiKey || providerData.accountSid, // Twilio uses accountSid
        apiSecret: providerData.apiSecret || providerData.authToken, // Twilio uses authToken
        settings: {
          provider: provider,
          // Twilio specific
          ...(provider === 'twilio' && {
            accountSid: providerData.accountSid,
            authToken: providerData.authToken,
            fromNumber: providerData.fromNumber,
            messagingServiceSid: providerData.messagingServiceSid
          }),
          // Vonage specific
          ...(provider === 'vonage' && {
            apiKey: providerData.apiKey,
            apiSecret: providerData.apiSecret,
            from: providerData.from,
            brandName: providerData.brandName
          }),
          // AWS SNS specific
          ...(provider === 'aws-sns' && {
            region: providerData.region,
            accessKeyId: providerData.accessKeyId,
            secretAccessKey: providerData.secretAccessKey
          })
        },
        isActive: providerData.isActive !== false
      };
      
      // Save via SystemConfigService
      const result = await this.saveProviderIntegration(integration);
      console.log('ProviderConfigService: SMS provider configured successfully');
      
      return result;
    } catch (error) {
      console.error('ProviderConfigService: Error configuring SMS provider:', error);
      throw error;
    }
  }

  /**
   * Configure Push provider (Firebase, OneSignal, etc.)
   */
  static async configurePushProvider(providerData) {
    try {
      console.log('ProviderConfigService: Configuring Push provider:', providerData.provider);
      
      const provider = providerData.provider.toLowerCase();
      
      // Validate required fields based on provider
      this.validatePushProviderConfig(provider, providerData);
      
      // Create integration object
      const integration = {
        name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Push`,
        type: 'push',
        provider: provider,
        apiKey: providerData.apiKey || providerData.serverKey,
        apiSecret: providerData.apiSecret,
        settings: {
          provider: provider,
          // Firebase specific
          ...(provider === 'firebase' && {
            projectId: providerData.projectId,
            serviceAccountKey: providerData.serviceAccountKey || {},
            databaseUrl: providerData.databaseUrl
          }),
          // OneSignal specific
          ...(provider === 'onesignal' && {
            appId: providerData.appId,
            restApiKey: providerData.restApiKey,
            apiUrl: providerData.apiUrl || 'https://onesignal.com/api/v1'
          }),
          // Expo specific
          ...(provider === 'expo' && {
            accessToken: providerData.accessToken
          })
        },
        isActive: providerData.isActive !== false
      };
      
      // Save via SystemConfigService
      const result = await this.saveProviderIntegration(integration);
      console.log('ProviderConfigService: Push provider configured successfully');
      
      return result;
    } catch (error) {
      console.error('ProviderConfigService: Error configuring Push provider:', error);
      throw error;
    }
  }

  /**
   * Save or update provider integration
   */
  static async saveProviderIntegration(integration) {
    try {
      const config = await SystemConfigService.getSystemConfiguration();
      
      // Remove existing integration of same type+provider if exists
      const existingIndex = (config.integrations || []).findIndex(
        int => int.type === integration.type && int.provider === integration.provider
      );
      
      if (existingIndex >= 0) {
        // Update existing
        config.integrations[existingIndex] = integration;
      } else {
        // Add new
        if (!config.integrations) config.integrations = [];
        config.integrations.push(integration);
      }
      
      config.markModified('integrations');
      await config.save();
      
      console.log(`ProviderConfigService: Integration saved (${integration.type}/${integration.provider})`);
      return integration;
    } catch (error) {
      console.error('ProviderConfigService: Error saving integration:', error);
      throw error;
    }
  }

  /**
   * Test SMS provider connection
   */
  static async testSMSProvider(providerId) {
    try {
      console.log('ProviderConfigService: Testing SMS provider:', providerId);
      
      const config = await SystemConfigService.getSystemConfiguration();
      const provider = (config.integrations || []).find(int => int._id.toString() === providerId);
      
      if (!provider || provider.type !== 'sms') {
        throw new Error('SMS provider not found');
      }
      
      // Test connection based on provider
      let testResult = false;
      
      switch (provider.provider) {
        case 'twilio':
          testResult = await this.testTwilioConnection(provider);
          break;
        case 'vonage':
          testResult = await this.testVonageConnection(provider);
          break;
        case 'aws-sns':
          testResult = await this.testAWSSNSConnection(provider);
          break;
        default:
          throw new Error(`Unknown SMS provider: ${provider.provider}`);
      }
      
      // Update test status
      provider.lastTested = new Date();
      provider.testStatus = testResult ? 'success' : 'failed';
      config.markModified('integrations');
      await config.save();
      
      console.log(`ProviderConfigService: SMS provider test ${testResult ? 'passed' : 'failed'}`);
      return { success: testResult, provider: provider.provider };
    } catch (error) {
      console.error('ProviderConfigService: Error testing SMS provider:', error);
      throw error;
    }
  }

  /**
   * Test Push provider connection
   */
  static async testPushProvider(providerId) {
    try {
      console.log('ProviderConfigService: Testing Push provider:', providerId);
      
      const config = await SystemConfigService.getSystemConfiguration();
      const provider = (config.integrations || []).find(int => int._id.toString() === providerId);
      
      if (!provider || provider.type !== 'push') {
        throw new Error('Push provider not found');
      }
      
      // Test connection based on provider
      let testResult = false;
      
      switch (provider.provider) {
        case 'firebase':
          testResult = await this.testFirebaseConnection(provider);
          break;
        case 'onesignal':
          testResult = await this.testOneSignalConnection(provider);
          break;
        case 'expo':
          testResult = await this.testExpoConnection(provider);
          break;
        default:
          throw new Error(`Unknown Push provider: ${provider.provider}`);
      }
      
      // Update test status
      provider.lastTested = new Date();
      provider.testStatus = testResult ? 'success' : 'failed';
      config.markModified('integrations');
      await config.save();
      
      console.log(`ProviderConfigService: Push provider test ${testResult ? 'passed' : 'failed'}`);
      return { success: testResult, provider: provider.provider };
    } catch (error) {
      console.error('ProviderConfigService: Error testing Push provider:', error);
      throw error;
    }
  }

  /**
   * Validate SMS provider configuration
   */
  static validateSMSProviderConfig(provider, config) {
    const requiredFields = {
      twilio: ['accountSid', 'authToken', 'fromNumber'],
      vonage: ['apiKey', 'apiSecret', 'from'],
      'aws-sns': ['region', 'accessKeyId', 'secretAccessKey']
    };
    
    const required = requiredFields[provider];
    if (!required) {
      throw new Error(`Unknown SMS provider: ${provider}`);
    }
    
    const missing = required.filter(field => !config[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields for ${provider}: ${missing.join(', ')}`);
    }
  }

  /**
   * Validate Push provider configuration
   */
  static validatePushProviderConfig(provider, config) {
    const requiredFields = {
      firebase: ['projectId', 'serviceAccountKey'],
      onesignal: ['appId', 'restApiKey'],
      expo: ['accessToken']
    };
    
    const required = requiredFields[provider];
    if (!required) {
      throw new Error(`Unknown Push provider: ${provider}`);
    }
    
    const missing = required.filter(field => !config[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields for ${provider}: ${missing.join(', ')}`);
    }
  }

  /**
   * Test connections for various providers
   */
  static async testTwilioConnection(provider) {
    try {
      // Simple validation - in production, make actual API call
      return provider.settings.accountSid && provider.settings.authToken;
    } catch (error) {
      console.error('Twilio test failed:', error);
      return false;
    }
  }

  static async testVonageConnection(provider) {
    try {
      // Simple validation - in production, make actual API call
      return provider.settings.apiKey && provider.settings.apiSecret;
    } catch (error) {
      console.error('Vonage test failed:', error);
      return false;
    }
  }

  static async testAWSSNSConnection(provider) {
    try {
      // Simple validation - in production, make actual AWS SDK call
      return provider.settings.region && provider.settings.accessKeyId && provider.settings.secretAccessKey;
    } catch (error) {
      console.error('AWS SNS test failed:', error);
      return false;
    }
  }

  static async testFirebaseConnection(provider) {
    try {
      // Simple validation - in production, use Firebase SDK
      return provider.settings.projectId && Object.keys(provider.settings.serviceAccountKey).length > 0;
    } catch (error) {
      console.error('Firebase test failed:', error);
      return false;
    }
  }

  static async testOneSignalConnection(provider) {
    try {
      // Simple validation - in production, make actual API call
      return provider.settings.appId && provider.settings.restApiKey;
    } catch (error) {
      console.error('OneSignal test failed:', error);
      return false;
    }
  }

  static async testExpoConnection(provider) {
    try {
      // Simple validation - in production, use Expo SDK
      return provider.settings.accessToken;
    } catch (error) {
      console.error('Expo test failed:', error);
      return false;
    }
  }

  /**
   * Get provider documentation/requirements
   */
  static getProviderInfo(provider) {
    const info = {
      twilio: {
        name: 'Twilio',
        description: 'SMS delivery via Twilio API',
        requiredFields: ['accountSid', 'authToken', 'fromNumber'],
        optionalFields: ['messagingServiceSid'],
        documentation: 'https://www.twilio.com/docs/sms',
        setupGuide: `
          1. Sign up at https://www.twilio.com
          2. Get Account SID and Auth Token from Account Settings
          3. Set up a Twilio phone number or Messaging Service
          4. Enter credentials below
        `
      },
      vonage: {
        name: 'Vonage (Nexmo)',
        description: 'SMS delivery via Vonage API',
        requiredFields: ['apiKey', 'apiSecret', 'from'],
        optionalFields: ['brandName'],
        documentation: 'https://developer.vonage.com/messaging/sms',
        setupGuide: `
          1. Sign up at https://dashboard.vonage.com
          2. Get API Key and Secret from Account Settings
          3. Verify sender ID or phone number
          4. Enter credentials below
        `
      },
      'aws-sns': {
        name: 'AWS SNS',
        description: 'SMS delivery via Amazon Simple Notification Service',
        requiredFields: ['region', 'accessKeyId', 'secretAccessKey'],
        optionalFields: [],
        documentation: 'https://docs.aws.amazon.com/sns/latest/dg/SMSMessages.html',
        setupGuide: `
          1. Create AWS account and configure SNS
          2. Create IAM user with SNS permissions
          3. Get Access Key ID and Secret
          4. Enter region and credentials below
        `
      },
      firebase: {
        name: 'Firebase Cloud Messaging',
        description: 'Push notifications via Firebase',
        requiredFields: ['projectId', 'serviceAccountKey'],
        optionalFields: ['databaseUrl'],
        documentation: 'https://firebase.google.com/docs/cloud-messaging',
        setupGuide: `
          1. Create Firebase project at https://console.firebase.google.com
          2. Enable Cloud Messaging
          3. Download Service Account JSON key
          4. Enter Project ID and paste key content below
        `
      },
      onesignal: {
        name: 'OneSignal',
        description: 'Push notifications via OneSignal',
        requiredFields: ['appId', 'restApiKey'],
        optionalFields: [],
        documentation: 'https://documentation.onesignal.com/reference',
        setupGuide: `
          1. Sign up for OneSignal
          2. Create app and get App ID
          3. Get REST API Key from Settings
          4. Enter credentials below
        `
      },
      expo: {
        name: 'Expo Push Notifications',
        description: 'Push notifications for React Native apps via Expo',
        requiredFields: ['accessToken'],
        optionalFields: [],
        documentation: 'https://docs.expo.dev/push-notifications/overview/',
        setupGuide: `
          1. Create Expo account at https://expo.dev
          2. Create project and configure push notifications
          3. Generate access token
          4. Enter token below
        `
      }
    };
    
    return info[provider] || null;
  }
}

module.exports = ProviderConfigService;
