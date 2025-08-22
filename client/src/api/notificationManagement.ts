import api from './api';

export interface NotificationTemplate {
  _id: string;
  name: string;
  type: 'email' | 'sms' | 'push' | 'in_app';
  subject?: string;
  content: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  usage: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  };
}

export interface NotificationRule {
  _id: string;
  name: string;
  description: string;
  trigger: 'order_created' | 'order_updated' | 'payment_received' | 'custom';
  conditions: {
    field: string;
    operator: string;
    value: string;
  }[];
  channels: ('email' | 'sms' | 'push' | 'in_app')[];
  templateId: string;
  templateName: string;
  delay: number;
  isActive: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  escalation: {
    enabled: boolean;
    delay: number;
    channels: string[];
  };
}

export interface NotificationHistory {
  _id: string;
  templateId: string;
  templateName: string;
  recipient: {
    type: 'customer' | 'staff' | 'admin';
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  channel: 'email' | 'sms' | 'push' | 'in_app';
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'opened' | 'clicked';
  content: {
    subject?: string;
    body: string;
  };
  sentAt: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  failureReason?: string;
  metadata: {
    orderId?: string;
    campaignId?: string;
    priority: string;
  };
}

export interface NotificationSettings {
  _id: string;
  email: {
    enabled: boolean;
    provider: 'sendgrid' | 'mailgun' | 'ses';
    fromName: string;
    fromEmail: string;
    replyTo: string;
    rateLimits: {
      perMinute: number;
      perHour: number;
      perDay: number;
    };
  };
  sms: {
    enabled: boolean;
    provider: 'twilio' | 'nexmo' | 'aws_sns';
    rateLimits: {
      perMinute: number;
      perHour: number;
      perDay: number;
    };
  };
  push: {
    enabled: boolean;
    provider: 'firebase' | 'onesignal';
    webPush: boolean;
    mobilePush: boolean;
  };
  inApp: {
    enabled: boolean;
    retention: number;
    realTime: boolean;
  };
}

export interface NotificationAnalytics {
  totalSent: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  failureRate: number;
  channelBreakdown: {
    channel: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  }[];
  templatePerformance: {
    templateId: string;
    templateName: string;
    sent: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
  }[];
  timeSeriesData: {
    date: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  }[];
}

// Description: Get all notification templates
// Endpoint: GET /api/admin/notifications/templates
// Request: { type?: string, status?: string, search?: string }
// Response: { templates: NotificationTemplate[] }
export const getNotificationTemplates = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        templates: [
          {
            _id: 'template1',
            name: 'Order Confirmation',
            type: 'email',
            subject: 'Order Confirmation - {{orderNumber}}',
            content: 'Dear {{customerName}}, your order {{orderNumber}} has been confirmed...',
            variables: ['customerName', 'orderNumber', 'orderTotal', 'estimatedCompletion'],
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-15T10:30:00Z',
            usage: {
              sent: 1250,
              delivered: 1230,
              opened: 890,
              clicked: 340
            }
          },
          {
            _id: 'template2',
            name: 'Repair Status Update',
            type: 'sms',
            content: 'Hi {{customerName}}, your {{deviceModel}} repair is now {{status}}. Track: {{trackingUrl}}',
            variables: ['customerName', 'deviceModel', 'status', 'trackingUrl'],
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-10T14:20:00Z',
            usage: {
              sent: 890,
              delivered: 885,
              opened: 0,
              clicked: 120
            }
          },
          {
            _id: 'template3',
            name: 'Payment Reminder',
            type: 'push',
            content: 'Payment due for order {{orderNumber}}. Amount: ${{amount}}',
            variables: ['orderNumber', 'amount', 'dueDate'],
            isActive: false,
            createdAt: '2024-01-05T00:00:00Z',
            updatedAt: '2024-01-12T09:15:00Z',
            usage: {
              sent: 450,
              delivered: 430,
              opened: 280,
              clicked: 95
            }
          }
        ]
      });
    }, 500);
  });
};

// Description: Get notification automation rules
// Endpoint: GET /api/admin/notifications/rules
// Request: { trigger?: string, status?: string }
// Response: { rules: NotificationRule[] }
export const getNotificationRules = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        rules: [
          {
            _id: 'rule1',
            name: 'Order Confirmation Flow',
            description: 'Send confirmation email and SMS when order is created',
            trigger: 'order_created',
            conditions: [
              { field: 'orderTotal', operator: 'greater_than', value: '50' }
            ],
            channels: ['email', 'sms'],
            templateId: 'template1',
            templateName: 'Order Confirmation',
            delay: 0,
            isActive: true,
            priority: 'high',
            escalation: {
              enabled: false,
              delay: 0,
              channels: []
            }
          },
          {
            _id: 'rule2',
            name: 'Repair Status Updates',
            description: 'Notify customers when repair status changes',
            trigger: 'order_updated',
            conditions: [
              { field: 'status', operator: 'changed', value: 'any' }
            ],
            channels: ['sms', 'push', 'in_app'],
            templateId: 'template2',
            templateName: 'Repair Status Update',
            delay: 5,
            isActive: true,
            priority: 'normal',
            escalation: {
              enabled: true,
              delay: 60,
              channels: ['email']
            }
          }
        ]
      });
    }, 500);
  });
};

// Description: Get notification history with filtering
// Endpoint: GET /api/admin/notifications/history
// Request: { channel?: string, status?: string, dateFrom?: string, dateTo?: string, page?: number }
// Response: { history: NotificationHistory[], totalPages: number, currentPage: number }
export const getNotificationHistory = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        history: [
          {
            _id: 'hist1',
            templateId: 'template1',
            templateName: 'Order Confirmation',
            recipient: {
              type: 'customer',
              id: 'customer1',
              name: 'John Doe',
              email: 'john.doe@example.com',
              phone: '+1234567890'
            },
            channel: 'email',
            status: 'opened',
            content: {
              subject: 'Order Confirmation - ORD-2024-001',
              body: 'Dear John Doe, your order ORD-2024-001 has been confirmed...'
            },
            sentAt: '2024-01-15T10:30:00Z',
            deliveredAt: '2024-01-15T10:31:00Z',
            openedAt: '2024-01-15T11:45:00Z',
            metadata: {
              orderId: 'order1',
              priority: 'high'
            }
          },
          {
            _id: 'hist2',
            templateId: 'template2',
            templateName: 'Repair Status Update',
            recipient: {
              type: 'customer',
              id: 'customer2',
              name: 'Jane Smith',
              email: 'jane.smith@example.com',
              phone: '+1234567891'
            },
            channel: 'sms',
            status: 'delivered',
            content: {
              body: 'Hi Jane Smith, your iPhone 15 Pro repair is now in progress.'
            },
            sentAt: '2024-01-15T14:20:00Z',
            deliveredAt: '2024-01-15T14:21:00Z',
            metadata: {
              orderId: 'order2',
              priority: 'normal'
            }
          }
        ],
        totalPages: 10,
        currentPage: 1
      });
    }, 500);
  });
};

// Description: Get notification settings
// Endpoint: GET /api/admin/notifications/settings
// Request: {}
// Response: { settings: NotificationSettings }
export const getNotificationSettings = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        settings: {
          _id: 'settings1',
          email: {
            enabled: true,
            provider: 'sendgrid',
            fromName: 'FixitHub',
            fromEmail: 'noreply@fixithub.com',
            replyTo: 'support@fixithub.com',
            rateLimits: {
              perMinute: 100,
              perHour: 1000,
              perDay: 10000
            }
          },
          sms: {
            enabled: true,
            provider: 'twilio',
            rateLimits: {
              perMinute: 50,
              perHour: 500,
              perDay: 2000
            }
          },
          push: {
            enabled: true,
            provider: 'firebase',
            webPush: true,
            mobilePush: true
          },
          inApp: {
            enabled: true,
            retention: 30,
            realTime: true
          }
        }
      });
    }, 500);
  });
};

// Description: Get notification analytics
// Endpoint: GET /api/admin/notifications/analytics
// Request: { dateFrom?: string, dateTo?: string }
// Response: { analytics: NotificationAnalytics }
export const getNotificationAnalytics = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        analytics: {
          totalSent: 15420,
          deliveryRate: 97.8,
          openRate: 68.5,
          clickRate: 24.3,
          failureRate: 2.2,
          channelBreakdown: [
            { channel: 'email', sent: 8500, delivered: 8350, opened: 5800, clicked: 2100 },
            { channel: 'sms', sent: 4200, delivered: 4150, opened: 0, clicked: 890 },
            { channel: 'push', sent: 2100, delivered: 2050, opened: 1200, clicked: 450 },
            { channel: 'in_app', sent: 620, delivered: 620, opened: 580, clicked: 320 }
          ],
          templatePerformance: [
            { templateId: 'template1', templateName: 'Order Confirmation', sent: 1250, deliveryRate: 98.4, openRate: 71.2, clickRate: 27.2 },
            { templateId: 'template2', templateName: 'Repair Status Update', sent: 890, deliveryRate: 99.4, openRate: 0, clickRate: 13.5 }
          ],
          timeSeriesData: [
            { date: '2024-01-01', sent: 450, delivered: 440, opened: 310, clicked: 120 },
            { date: '2024-01-02', sent: 520, delivered: 510, opened: 360, clicked: 140 },
            { date: '2024-01-03', sent: 480, delivered: 470, opened: 330, clicked: 125 }
          ]
        }
      });
    }, 500);
  });
};

// Description: Create notification template
// Endpoint: POST /api/admin/notifications/templates
// Request: Partial<NotificationTemplate>
// Response: { success: boolean, template: NotificationTemplate }
export const createNotificationTemplate = (templateData: Partial<NotificationTemplate>) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        template: {
          _id: 'template_' + Date.now(),
          ...templateData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          usage: { sent: 0, delivered: 0, opened: 0, clicked: 0 }
        }
      });
    }, 1000);
  });
};

// Description: Update notification settings
// Endpoint: PUT /api/admin/notifications/settings
// Request: Partial<NotificationSettings>
// Response: { success: boolean, settings: NotificationSettings }
export const updateNotificationSettings = (settingsData: Partial<NotificationSettings>) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        settings: {
          _id: 'settings1',
          ...settingsData
        }
      });
    }, 800);
  });
};