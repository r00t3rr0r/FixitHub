import api from './api';

export interface MessageThread {
  _id: string;
  type: 'customer_support' | 'internal' | 'order_related' | 'general';
  subject: string;
  participants: {
    _id: string;
    name: string;
    role: 'customer' | 'staff' | 'admin';
    avatar: string;
    email: string;
  }[];
  lastMessage: {
    content: string;
    sentAt: string;
    sentBy: string;
    sentByName: string;
  };
  status: 'active' | 'resolved' | 'archived';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  tags: string[];
  orderId?: string;
  orderNumber?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  unreadCount: number;
  isEscalated: boolean;
  assignedTo?: {
    _id: string;
    name: string;
    avatar: string;
  };
}

export interface Message {
  _id: string;
  threadId: string;
  content: string;
  type: 'text' | 'file' | 'image' | 'system';
  sentBy: {
    _id: string;
    name: string;
    role: 'customer' | 'staff' | 'admin';
    avatar: string;
  };
  sentAt: string;
  readBy: {
    userId: string;
    readAt: string;
  }[];
  attachments: {
    _id: string;
    name: string;
    type: string;
    size: number;
    url: string;
  }[];
  isEdited: boolean;
  editedAt?: string;
  replyTo?: string;
  reactions: {
    emoji: string;
    users: string[];
  }[];
}

export interface CommunicationChannel {
  _id: string;
  name: string;
  description: string;
  type: 'public' | 'private' | 'direct';
  category: 'general' | 'support' | 'technical' | 'announcements';
  members: {
    _id: string;
    name: string;
    role: 'customer' | 'staff' | 'admin';
    avatar: string;
    joinedAt: string;
    permissions: string[];
  }[];
  settings: {
    allowFileSharing: boolean;
    allowGuestAccess: boolean;
    messageRetention: number;
    moderationEnabled: boolean;
  };
  createdBy: string;
  createdAt: string;
  lastActivity: string;
  messageCount: number;
  isArchived: boolean;
}

export interface CommunicationSettings {
  _id: string;
  general: {
    enableRealTimeMessaging: boolean;
    messageRetentionDays: number;
    maxFileSize: number;
    allowedFileTypes: string[];
    enableMessageReactions: boolean;
    enableMessageThreads: boolean;
  };
  notifications: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    desktopNotifications: boolean;
    soundNotifications: boolean;
    notificationSchedule: {
      enabled: boolean;
      startTime: string;
      endTime: string;
      timezone: string;
    };
  };
  moderation: {
    enableAutoModeration: boolean;
    bannedWords: string[];
    requireApproval: boolean;
    escalationRules: {
      enabled: boolean;
      keywords: string[];
      escalateTo: string[];
    };
  };
  integrations: {
    slackEnabled: boolean;
    teamsEnabled: boolean;
    webhookUrl?: string;
    apiIntegrations: string[];
  };
}

export interface CommunicationAnalytics {
  totalMessages: number;
  activeThreads: number;
  averageResponseTime: number;
  resolutionRate: number;
  customerSatisfactionScore: number;
  channelActivity: {
    channelId: string;
    channelName: string;
    messageCount: number;
    activeUsers: number;
    averageResponseTime: number;
  }[];
  userActivity: {
    userId: string;
    userName: string;
    role: string;
    messagesSent: number;
    threadsParticipated: number;
    averageResponseTime: number;
  }[];
  timeSeriesData: {
    date: string;
    messages: number;
    threads: number;
    resolutions: number;
  }[];
  priorityBreakdown: {
    priority: string;
    count: number;
    averageResolutionTime: number;
  }[];
}

// Description: Get message threads with filtering
// Endpoint: GET /api/admin/communications/threads
// Request: { type?: string, status?: string, priority?: string, assignedTo?: string, search?: string, page?: number }
// Response: { threads: MessageThread[], totalPages: number, currentPage: number }
export const getMessageThreads = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        threads: [
          {
            _id: 'thread1',
            type: 'customer_support',
            subject: 'Issue with iPhone 15 Pro repair',
            participants: [
              {
                _id: 'customer1',
                name: 'John Doe',
                role: 'customer',
                avatar: 'https://via.placeholder.com/40x40/3b82f6/ffffff?text=JD',
                email: 'john.doe@example.com'
              },
              {
                _id: 'staff1',
                name: 'Sarah Johnson',
                role: 'staff',
                avatar: 'https://via.placeholder.com/40x40/10b981/ffffff?text=SJ',
                email: 'sarah.johnson@fixithub.com'
              }
            ],
            lastMessage: {
              content: 'Thank you for the update. When can I expect my device to be ready?',
              sentAt: '2024-01-15T14:30:00Z',
              sentBy: 'customer1',
              sentByName: 'John Doe'
            },
            status: 'active',
            priority: 'high',
            tags: ['repair-inquiry', 'iphone'],
            orderId: 'order1',
            orderNumber: 'ORD-2024-001',
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T14:30:00Z',
            messageCount: 8,
            unreadCount: 2,
            isEscalated: false,
            assignedTo: {
              _id: 'staff1',
              name: 'Sarah Johnson',
              avatar: 'https://via.placeholder.com/40x40/10b981/ffffff?text=SJ'
            }
          },
          {
            _id: 'thread2',
            type: 'internal',
            subject: 'Team meeting notes - Weekly sync',
            participants: [
              {
                _id: 'staff1',
                name: 'Sarah Johnson',
                role: 'staff',
                avatar: 'https://via.placeholder.com/40x40/10b981/ffffff?text=SJ',
                email: 'sarah.johnson@fixithub.com'
              },
              {
                _id: 'staff2',
                name: 'Mike Chen',
                role: 'staff',
                avatar: 'https://via.placeholder.com/40x40/f59e0b/ffffff?text=MC',
                email: 'mike.chen@fixithub.com'
              },
              {
                _id: 'admin1',
                name: 'Admin User',
                role: 'admin',
                avatar: 'https://via.placeholder.com/40x40/ef4444/ffffff?text=AU',
                email: 'admin@fixithub.com'
              }
            ],
            lastMessage: {
              content: 'Great meeting today. I\'ll follow up on the inventory issues.',
              sentAt: '2024-01-15T16:45:00Z',
              sentBy: 'admin1',
              sentByName: 'Admin User'
            },
            status: 'active',
            priority: 'normal',
            tags: ['meeting', 'team-sync'],
            createdAt: '2024-01-15T15:00:00Z',
            updatedAt: '2024-01-15T16:45:00Z',
            messageCount: 12,
            unreadCount: 0,
            isEscalated: false
          }
        ],
        totalPages: 5,
        currentPage: 1
      });
    }, 500);
  });
};

// Description: Get messages for a specific thread
// Endpoint: GET /api/admin/communications/threads/:threadId/messages
// Request: { page?: number, limit?: number }
// Response: { messages: Message[], totalPages: number, currentPage: number }
export const getThreadMessages = (threadId: string, filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        messages: [
          {
            _id: 'msg1',
            threadId: threadId,
            content: 'Hello, I have a question about my iPhone repair order.',
            type: 'text',
            sentBy: {
              _id: 'customer1',
              name: 'John Doe',
              role: 'customer',
              avatar: 'https://via.placeholder.com/40x40/3b82f6/ffffff?text=JD'
            },
            sentAt: '2024-01-15T10:00:00Z',
            readBy: [
              { userId: 'staff1', readAt: '2024-01-15T10:05:00Z' }
            ],
            attachments: [],
            isEdited: false,
            reactions: [
              { emoji: '👍', users: ['staff1'] }
            ]
          },
          {
            _id: 'msg2',
            threadId: threadId,
            content: 'Hi John! I\'d be happy to help you with your repair order. What specific question do you have?',
            type: 'text',
            sentBy: {
              _id: 'staff1',
              name: 'Sarah Johnson',
              role: 'staff',
              avatar: 'https://via.placeholder.com/40x40/10b981/ffffff?text=SJ'
            },
            sentAt: '2024-01-15T10:05:00Z',
            readBy: [
              { userId: 'customer1', readAt: '2024-01-15T10:10:00Z' }
            ],
            attachments: [],
            isEdited: false,
            reactions: []
          }
        ],
        totalPages: 2,
        currentPage: 1
      });
    }, 500);
  });
};

// Description: Get communication channels
// Endpoint: GET /api/admin/communications/channels
// Request: { type?: string, category?: string, archived?: boolean }
// Response: { channels: CommunicationChannel[] }
export const getCommunicationChannels = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        channels: [
          {
            _id: 'channel1',
            name: 'General Support',
            description: 'General customer support discussions',
            type: 'public',
            category: 'support',
            members: [
              {
                _id: 'staff1',
                name: 'Sarah Johnson',
                role: 'staff',
                avatar: 'https://via.placeholder.com/40x40/10b981/ffffff?text=SJ',
                joinedAt: '2024-01-01T00:00:00Z',
                permissions: ['read', 'write', 'moderate']
              },
              {
                _id: 'staff2',
                name: 'Mike Chen',
                role: 'staff',
                avatar: 'https://via.placeholder.com/40x40/f59e0b/ffffff?text=MC',
                joinedAt: '2024-01-01T00:00:00Z',
                permissions: ['read', 'write']
              }
            ],
            settings: {
              allowFileSharing: true,
              allowGuestAccess: false,
              messageRetention: 90,
              moderationEnabled: true
            },
            createdBy: 'admin1',
            createdAt: '2024-01-01T00:00:00Z',
            lastActivity: '2024-01-15T16:30:00Z',
            messageCount: 1250,
            isArchived: false
          },
          {
            _id: 'channel2',
            name: 'Technical Team',
            description: 'Internal technical discussions and updates',
            type: 'private',
            category: 'technical',
            members: [
              {
                _id: 'staff1',
                name: 'Sarah Johnson',
                role: 'staff',
                avatar: 'https://via.placeholder.com/40x40/10b981/ffffff?text=SJ',
                joinedAt: '2024-01-01T00:00:00Z',
                permissions: ['read', 'write']
              },
              {
                _id: 'staff2',
                name: 'Mike Chen',
                role: 'staff',
                avatar: 'https://via.placeholder.com/40x40/f59e0b/ffffff?text=MC',
                joinedAt: '2024-01-01T00:00:00Z',
                permissions: ['read', 'write', 'moderate']
              }
            ],
            settings: {
              allowFileSharing: true,
              allowGuestAccess: false,
              messageRetention: 365,
              moderationEnabled: false
            },
            createdBy: 'admin1',
            createdAt: '2024-01-01T00:00:00Z',
            lastActivity: '2024-01-15T15:20:00Z',
            messageCount: 890,
            isArchived: false
          }
        ]
      });
    }, 500);
  });
};

// Description: Get communication settings
// Endpoint: GET /api/admin/communications/settings
// Request: {}
// Response: { settings: CommunicationSettings }
export const getCommunicationSettings = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        settings: {
          _id: 'comm_settings1',
          general: {
            enableRealTimeMessaging: true,
            messageRetentionDays: 90,
            maxFileSize: 10485760,
            allowedFileTypes: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
            enableMessageReactions: true,
            enableMessageThreads: true
          },
          notifications: {
            emailNotifications: true,
            pushNotifications: true,
            desktopNotifications: true,
            soundNotifications: false,
            notificationSchedule: {
              enabled: true,
              startTime: '09:00',
              endTime: '18:00',
              timezone: 'America/New_York'
            }
          },
          moderation: {
            enableAutoModeration: true,
            bannedWords: ['spam', 'inappropriate'],
            requireApproval: false,
            escalationRules: {
              enabled: true,
              keywords: ['urgent', 'emergency', 'complaint'],
              escalateTo: ['admin1', 'manager1']
            }
          },
          integrations: {
            slackEnabled: false,
            teamsEnabled: true,
            webhookUrl: 'https://hooks.slack.com/services/...',
            apiIntegrations: ['zapier', 'webhook']
          }
        }
      });
    }, 500);
  });
};

// Description: Get communication analytics
// Endpoint: GET /api/admin/communications/analytics
// Request: { dateFrom?: string, dateTo?: string }
// Response: { analytics: CommunicationAnalytics }
export const getCommunicationAnalytics = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        analytics: {
          totalMessages: 25430,
          activeThreads: 156,
          averageResponseTime: 12.5,
          resolutionRate: 94.2,
          customerSatisfactionScore: 4.6,
          channelActivity: [
            { channelId: 'channel1', channelName: 'General Support', messageCount: 1250, activeUsers: 45, averageResponseTime: 8.5 },
            { channelId: 'channel2', channelName: 'Technical Team', messageCount: 890, activeUsers: 12, averageResponseTime: 15.2 }
          ],
          userActivity: [
            { userId: 'staff1', userName: 'Sarah Johnson', role: 'staff', messagesSent: 450, threadsParticipated: 89, averageResponseTime: 7.2 },
            { userId: 'staff2', userName: 'Mike Chen', role: 'staff', messagesSent: 380, threadsParticipated: 67, averageResponseTime: 9.8 }
          ],
          timeSeriesData: [
            { date: '2024-01-01', messages: 120, threads: 15, resolutions: 12 },
            { date: '2024-01-02', messages: 145, threads: 18, resolutions: 16 },
            { date: '2024-01-03', messages: 98, threads: 12, resolutions: 11 }
          ],
          priorityBreakdown: [
            { priority: 'urgent', count: 23, averageResolutionTime: 2.5 },
            { priority: 'high', count: 67, averageResolutionTime: 8.2 },
            { priority: 'normal', count: 234, averageResolutionTime: 24.1 },
            { priority: 'low', count: 89, averageResolutionTime: 48.5 }
          ]
        }
      });
    }, 500);
  });
};

// Description: Create message thread
// Endpoint: POST /api/admin/communications/threads
// Request: Partial<MessageThread>
// Response: { success: boolean, thread: MessageThread }
export const createMessageThread = (threadData: Partial<MessageThread>) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        thread: {
          _id: 'thread_' + Date.now(),
          ...threadData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: 0,
          unreadCount: 0,
          isEscalated: false
        }
      });
    }, 1000);
  });
};

// Description: Send message to thread
// Endpoint: POST /api/admin/communications/threads/:threadId/messages
// Request: { content: string, type?: string, attachments?: File[] }
// Response: { success: boolean, message: Message }
export const sendMessage = (threadId: string, messageData: any) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: {
          _id: 'msg_' + Date.now(),
          threadId,
          ...messageData,
          sentAt: new Date().toISOString(),
          readBy: [],
          attachments: [],
          isEdited: false,
          reactions: []
        }
      });
    }, 800);
  });
};

// Description: Update communication settings
// Endpoint: PUT /api/admin/communications/settings
// Request: Partial<CommunicationSettings>
// Response: { success: boolean, settings: CommunicationSettings }
export const updateCommunicationSettings = (settingsData: Partial<CommunicationSettings>) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        settings: {
          _id: 'comm_settings1',
          ...settingsData
        }
      });
    }, 800);
  });
};