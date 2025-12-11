import api from './api';

export interface NotificationTemplate {
  _id: string;
  name: string;
  type: 'email' | 'sms' | 'push';
  subject?: string;
  content: string;
  variables: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Integration {
  _id: string;
  name: string;
  type: 'payment' | 'email' | 'sms' | 'storage' | 'analytics' | 'shipping';
  provider: string;
  apiKey: string;
  apiSecret?: string;
  endpoint?: string;
  settings: Record<string, any>;
  isActive: boolean;
  lastTested?: string;
  testStatus: 'success' | 'failed' | 'pending';
}

export interface SystemConfig {
  _id?: string;
  siteName: string;
  adminEmail: string;
  timezone: string;
  maintenanceMode: boolean;
  emailSettings: {
    smtpHost: string;
    smtpPort: number;
    smtpUsername: string;
    smtpPassword: string;
    enableNotifications: boolean;
  };
  notificationSettings: {
    orderNotifications: boolean;
    paymentNotifications: boolean;
    systemAlerts: boolean;
  };
  workflowSettings: {
    autoAssignment: boolean;
    requireApproval: boolean;
    defaultEstimatedTime: number;
    enableAutomation: boolean;
  };
  securitySettings: {
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
    };
    sessionTimeout: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
    enableTwoFactor: boolean;
  };
  contentSettings: {
    maxImageSize: number;
    maxFileSize: number;
    allowedImageTypes: string[];
    allowedFileTypes: string[];
    requireApproval: boolean;
    autoOptimizeImages: boolean;
  };
  cartSettings: {
    sessionTimeout: number;
    maxItems: number;
    enableGuestCheckout: boolean;
    requirePhone: boolean;
    enablePromoCode: boolean;
    abandonmentEmailDelay: number;
  };
  updatedAt: string;
}

// Description: Get system configuration
// Endpoint: GET /api/system-config
// Request: {}
// Response: { success: boolean, config: SystemConfig }
export const getSystemConfig = async () => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        config: {
          _id: '507f1f77bcf86cd799439011',
          siteName: 'FixitHub',
          adminEmail: 'admin@fixithub.com',
          timezone: 'UTC',
          maintenanceMode: false,
          emailSettings: {
            smtpHost: 'smtp.gmail.com',
            smtpPort: 587,
            smtpUsername: '',
            smtpPassword: '',
            enableNotifications: true
          },
          notificationSettings: {
            orderNotifications: true,
            paymentNotifications: true,
            systemAlerts: true
          },
          workflowSettings: {
            autoAssignment: false,
            requireApproval: true,
            defaultEstimatedTime: 60,
            enableAutomation: true
          },
          securitySettings: {
            passwordPolicy: {
              minLength: 8,
              requireUppercase: true,
              requireLowercase: true,
              requireNumbers: true,
              requireSpecialChars: false
            },
            sessionTimeout: 3600,
            maxLoginAttempts: 5,
            lockoutDuration: 900,
            enableTwoFactor: false
          },
          contentSettings: {
            maxImageSize: 5242880,
            maxFileSize: 10485760,
            allowedImageTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
            allowedFileTypes: ['pdf', 'doc', 'docx', 'txt'],
            requireApproval: false,
            autoOptimizeImages: true
          },
          cartSettings: {
            sessionTimeout: 1800,
            maxItems: 50,
            enableGuestCheckout: true,
            requirePhone: false,
            enablePromoCode: true,
            abandonmentEmailDelay: 3600
          },
          updatedAt: new Date().toISOString()
        }
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.get('/api/system-config');
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Update system configuration
// Endpoint: PUT /api/system-config
// Request: { config: SystemConfig }
// Response: { success: boolean, config: SystemConfig, message: string }
export const updateSystemConfig = async (config: SystemConfig) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        config: {
          ...config,
          updatedAt: new Date().toISOString()
        },
        message: 'System configuration updated successfully'
      });
    }, 1000);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.put('/api/system-config', config);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Get notification templates
// Endpoint: GET /api/system-config/notification-templates
// Request: {}
// Response: { success: boolean, templates: NotificationTemplate[] }
export const getNotificationTemplates = async () => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        templates: [
          {
            _id: '507f1f77bcf86cd799439012',
            name: 'Order Confirmation',
            type: 'email',
            subject: 'Your order has been confirmed',
            content: 'Hello {{customerName}}, your order {{orderNumber}} has been confirmed.',
            variables: [
              { name: 'customerName', description: 'Customer full name', required: true },
              { name: 'orderNumber', description: 'Order number', required: true }
            ],
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.get('/api/system-config/notification-templates');
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Create notification template
// Endpoint: POST /api/system-config/notification-templates
// Request: { template: Omit<NotificationTemplate, '_id'> }
// Response: { success: boolean, template: NotificationTemplate, message: string }
export const createNotificationTemplate = async (template: Omit<NotificationTemplate, '_id'>) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        template: {
          ...template,
          _id: '507f1f77bcf86cd799439013',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        message: 'Notification template created successfully'
      });
    }, 1000);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.post('/api/system-config/notification-templates', template);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Update notification template
// Endpoint: PUT /api/system-config/notification-templates/:id
// Request: { template: Omit<NotificationTemplate, '_id'> }
// Response: { success: boolean, template: NotificationTemplate, message: string }
export const updateNotificationTemplate = async (id: string, template: Omit<NotificationTemplate, '_id'>) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        template: {
          ...template,
          _id: id,
          updatedAt: new Date().toISOString()
        },
        message: 'Notification template updated successfully'
      });
    }, 1000);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.put(`/api/system-config/notification-templates/${id}`, template);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Delete notification template
// Endpoint: DELETE /api/system-config/notification-templates/:id
// Request: {}
// Response: { success: boolean, message: string }
export const deleteNotificationTemplate = async (id: string) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Notification template deleted successfully'
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.delete(`/api/system-config/notification-templates/${id}`);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Get integrations
// Endpoint: GET /api/system-config/integrations
// Request: {}
// Response: { success: boolean, integrations: Integration[] }
export const getIntegrations = async () => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        integrations: [
          {
            _id: '507f1f77bcf86cd799439014',
            name: 'SendGrid Email',
            type: 'email',
            provider: 'SendGrid',
            apiKey: 'sg.xxx',
            endpoint: 'https://api.sendgrid.com/v3',
            settings: {},
            isActive: true,
            testStatus: 'success',
            lastTested: new Date().toISOString()
          }
        ]
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.get('/api/system-config/integrations');
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Create integration
// Endpoint: POST /api/system-config/integrations
// Request: { integration: Omit<Integration, '_id'> }
// Response: { success: boolean, integration: Integration, message: string }
export const createIntegration = async (integration: Omit<Integration, '_id'>) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        integration: {
          ...integration,
          _id: '507f1f77bcf86cd799439015'
        },
        message: 'Integration created successfully'
      });
    }, 1000);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.post('/api/system-config/integrations', integration);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Update integration
// Endpoint: PUT /api/system-config/integrations/:id
// Request: { integration: Omit<Integration, '_id'> }
// Response: { success: boolean, integration: Integration, message: string }
export const updateIntegration = async (id: string, integration: Omit<Integration, '_id'>) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        integration: {
          ...integration,
          _id: id
        },
        message: 'Integration updated successfully'
      });
    }, 1000);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.put(`/api/system-config/integrations/${id}`, integration);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Delete integration
// Endpoint: DELETE /api/system-config/integrations/:id
// Request: {}
// Response: { success: boolean, message: string }
export const deleteIntegration = async (id: string) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Integration deleted successfully'
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.delete(`/api/system-config/integrations/${id}`);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Test integration
// Endpoint: POST /api/system-config/integrations/:id/test
// Request: {}
// Response: { success: boolean, result: { success: boolean, message: string } }
export const testIntegration = async (id: string) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        result: {
          success: Math.random() > 0.3, // 70% success rate for demo
          message: Math.random() > 0.3 ? 'Connection successful' : 'Email test failed: Invalid API key'
        }
      });
    }, 2000);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.post(`/api/system-config/integrations/${id}/test`);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Clear system cache
// Endpoint: POST /api/system-config/cache/clear
// Request: {}
// Response: { success: boolean, message: string }
export const clearCache = async () => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'System cache cleared successfully'
      });
    }, 2000);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.post('/api/system-config/cache/clear');
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Run security scan
// Endpoint: POST /api/system-config/security/scan
// Request: {}
// Response: { success: boolean, message: string, results?: any }
export const runSecurityScan = async () => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Security scan completed successfully',
        results: {
          vulnerabilities: 0,
          warnings: 2,
          recommendations: 3,
          lastScan: new Date().toISOString(),
          status: 'passed'
        }
      });
    }, 5000);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.post('/api/system-config/security/scan');
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};