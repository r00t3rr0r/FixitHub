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

export type NotificationTemplateInput = Omit<NotificationTemplate, '_id' | 'createdAt' | 'updatedAt'>;

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

export interface FinancialSettings {
  defaults: {
    currency: string;
    locale: string;
    taxRate: number;
    defaultDiscount: number;
    paymentTerms: string;
    paymentDueDays: number;
    invoicePrefix: string;
    creditNotePrefix: string;
    defaultPaymentMethod: 'credit_card' | 'debit_card' | 'paypal' | 'stripe' | 'bank_transfer';
  };
  discountPolicy: {
    allowManualDiscounts: boolean;
    maxDiscountPercent: number;
    earlyPaymentDiscountPercent: number;
    lateFeePercent: number;
  };
  invoiceMetadata: {
    sellerName: string;
    sellerVatId: string;
    sellerRegistrationNumber: string;
    issuerEmail: string;
    issuerPhone: string;
    invoiceFooter: string;
    legalFooter: string;
  };
  paymentPreferences: {
    partialPaymentsAllowed: boolean;
    autoAttachPdf: boolean;
    sendInternalCopy: boolean;
    internalCopyEmail: string;
    showTaxBreakdown: boolean;
    showDiscountBreakdown: boolean;
    defaultVisualTheme: 'classic' | 'modern' | 'minimal';
    accentColor: string;
  };
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
  financialSettings: FinancialSettings;
  updatedAt: string;
}

// Description: Get system configuration
// Endpoint: GET /api/system-config
// Request: {}
// Response: { success: boolean, config: SystemConfig }
export const getSystemConfig = async () => {
  try {
    const response = await api.get('/api/system-config');
    return response.data;
  } catch (error: any) {
    console.error('Error getting system config:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update system configuration
// Endpoint: PUT /api/system-config
// Request: { config: SystemConfig }
// Response: { success: boolean, config: SystemConfig, message: string }
export const updateSystemConfig = async (config: SystemConfig) => {
  try {
    const response = await api.put('/api/system-config', config);
    return response.data;
  } catch (error: any) {
    console.error('Error updating system config:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get notification templates
// Endpoint: GET /api/system-config/notification-templates
// Request: {}
// Response: { success: boolean, templates: NotificationTemplate[] }
export const getNotificationTemplates = async () => {
  try {
    const response = await api.get('/api/system-config/notification-templates');
    return response.data;
  } catch (error: any) {
    console.error('Error getting notification templates:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create notification template
// Endpoint: POST /api/system-config/notification-templates
// Request: { template: NotificationTemplateInput }
// Response: { success: boolean, template: NotificationTemplate, message: string }
export const createNotificationTemplate = async (template: NotificationTemplateInput) => {
  try {
    const response = await api.post('/api/system-config/notification-templates', template);
    return response.data;
  } catch (error: any) {
    console.error('Error creating notification template:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update notification template
// Endpoint: PUT /api/system-config/notification-templates/:id
// Request: { template: NotificationTemplateInput }
// Response: { success: boolean, template: NotificationTemplate, message: string }
export const updateNotificationTemplate = async (id: string, template: NotificationTemplateInput) => {
  try {
    const response = await api.put(`/api/system-config/notification-templates/${id}`, template);
    return response.data;
  } catch (error: any) {
    console.error('Error updating notification template:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete notification template
// Endpoint: DELETE /api/system-config/notification-templates/:id
// Request: {}
// Response: { success: boolean, message: string }
export const deleteNotificationTemplate = async (id: string) => {
  try {
    const response = await api.delete(`/api/system-config/notification-templates/${id}`);
    return response.data;
  } catch (error: any) {
    console.error('Error deleting notification template:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get integrations
// Endpoint: GET /api/system-config/integrations
// Request: {}
// Response: { success: boolean, integrations: Integration[] }
export const getIntegrations = async () => {
  try {
    const response = await api.get('/api/system-config/integrations');
    return response.data;
  } catch (error: any) {
    console.error('Error getting integrations:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create integration
// Endpoint: POST /api/system-config/integrations
// Request: { integration: Omit<Integration, '_id'> }
// Response: { success: boolean, integration: Integration, message: string }
export const createIntegration = async (integration: Omit<Integration, '_id'>) => {
  try {
    const response = await api.post('/api/system-config/integrations', integration);
    return response.data;
  } catch (error: any) {
    console.error('Error creating integration:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update integration
// Endpoint: PUT /api/system-config/integrations/:id
// Request: { integration: Omit<Integration, '_id'> }
// Response: { success: boolean, integration: Integration, message: string }
export const updateIntegration = async (id: string, integration: Omit<Integration, '_id'>) => {
  try {
    const response = await api.put(`/api/system-config/integrations/${id}`, integration);
    return response.data;
  } catch (error: any) {
    console.error('Error updating integration:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete integration
// Endpoint: DELETE /api/system-config/integrations/:id
// Request: {}
// Response: { success: boolean, message: string }
export const deleteIntegration = async (id: string) => {
  try {
    const response = await api.delete(`/api/system-config/integrations/${id}`);
    return response.data;
  } catch (error: any) {
    console.error('Error deleting integration:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Test integration
// Endpoint: POST /api/system-config/integrations/:id/test
// Request: {}
// Response: { success: boolean, result: { success: boolean, message: string } }
export const testIntegration = async (id: string) => {
  try {
    const response = await api.post(`/api/system-config/integrations/${id}/test`);
    return response.data;
  } catch (error: any) {
    console.error('Error testing integration:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Clear system cache
// Endpoint: POST /api/system-config/cache/clear
// Request: {}
// Response: { success: boolean, message: string }
export const clearCache = async () => {
  try {
    const response = await api.post('/api/system-config/cache/clear');
    return response.data;
  } catch (error: any) {
    console.error('Error clearing cache:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Run security scan
// Endpoint: POST /api/system-config/security/scan
// Request: {}
// Response: { success: boolean, message: string, results?: any }
export const runSecurityScan = async () => {
  try {
    const response = await api.post('/api/system-config/security/scan');
    return response.data;
  } catch (error: any) {
    console.error('Error running security scan:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};