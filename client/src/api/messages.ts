import api from './api';

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'staff' | 'admin';
  senderAvatar: string;
  content: string;
  attachments: MessageAttachment[];
  timestamp: string;
  isRead: boolean;
  messageType: 'text' | 'image' | 'file' | 'system';
}

export interface MessageAttachment {
  _id: string;
  name: string;
  url: string;
  type: 'image' | 'document' | 'video';
  size: number;
}

export interface Conversation {
  _id: string;
  orderId: string;
  orderNumber: string;
  deviceInfo: string;
  participants: ConversationParticipant[];
  lastMessage: Message;
  unreadCount: number;
  status: 'active' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface ConversationParticipant {
  _id: string;
  name: string;
  role: 'customer' | 'staff' | 'admin';
  avatar: string;
  isOnline: boolean;
  lastSeen: string;
}

export interface MessageThread {
  conversation: Conversation;
  messages: Message[];
  hasMore: boolean;
  totalCount: number;
}

// Description: Get all conversations for the current user
// Endpoint: GET /api/messages/conversations
// Request: { page?: number, limit?: number, search?: string }
// Response: { conversations: Conversation[], totalPages: number, currentPage: number, unreadCount: number }
export const getConversations = (params: any = {}) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        conversations: [
          {
            _id: 'conv1',
            orderId: 'order1',
            orderNumber: 'ORD-2024-001',
            deviceInfo: 'iPhone 15 Pro - Screen Replacement',
            participants: [
              {
                _id: 'customer1',
                name: 'John Doe',
                role: 'customer',
                avatar: 'https://via.placeholder.com/40x40/3b82f6/ffffff?text=JD',
                isOnline: true,
                lastSeen: '2024-01-15T10:30:00Z'
              },
              {
                _id: 'staff1',
                name: 'Sarah Johnson',
                role: 'staff',
                avatar: 'https://via.placeholder.com/40x40/10b981/ffffff?text=SJ',
                isOnline: false,
                lastSeen: '2024-01-15T09:45:00Z'
              }
            ],
            lastMessage: {
              _id: 'msg1',
              conversationId: 'conv1',
              senderId: 'staff1',
              senderName: 'Sarah Johnson',
              senderRole: 'staff',
              senderAvatar: 'https://via.placeholder.com/40x40/10b981/ffffff?text=SJ',
              content: 'Your device repair is progressing well. We should have it ready by tomorrow.',
              attachments: [],
              timestamp: '2024-01-15T10:30:00Z',
              isRead: false,
              messageType: 'text'
            },
            unreadCount: 2,
            status: 'active',
            createdAt: '2024-01-14T09:00:00Z',
            updatedAt: '2024-01-15T10:30:00Z'
          },
          {
            _id: 'conv2',
            orderId: 'order2',
            orderNumber: 'ORD-2024-002',
            deviceInfo: 'Samsung Galaxy S24 - Camera Repair',
            participants: [
              {
                _id: 'customer1',
                name: 'John Doe',
                role: 'customer',
                avatar: 'https://via.placeholder.com/40x40/3b82f6/ffffff?text=JD',
                isOnline: true,
                lastSeen: '2024-01-15T10:30:00Z'
              },
              {
                _id: 'staff2',
                name: 'Mike Chen',
                role: 'staff',
                avatar: 'https://via.placeholder.com/40x40/8b5cf6/ffffff?text=MC',
                isOnline: true,
                lastSeen: '2024-01-15T10:25:00Z'
              }
            ],
            lastMessage: {
              _id: 'msg2',
              conversationId: 'conv2',
              senderId: 'customer1',
              senderName: 'John Doe',
              senderRole: 'customer',
              senderAvatar: 'https://via.placeholder.com/40x40/3b82f6/ffffff?text=JD',
              content: 'Thank you for the update! When can I pick it up?',
              attachments: [],
              timestamp: '2024-01-15T08:15:00Z',
              isRead: true,
              messageType: 'text'
            },
            unreadCount: 0,
            status: 'active',
            createdAt: '2024-01-13T14:00:00Z',
            updatedAt: '2024-01-15T08:15:00Z'
          }
        ],
        totalPages: 1,
        currentPage: 1,
        unreadCount: 2
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.get('/api/messages/conversations', { params });
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};

// Description: Get messages for a specific conversation
// Endpoint: GET /api/messages/conversations/:conversationId
// Request: { page?: number, limit?: number }
// Response: { conversation: Conversation, messages: Message[], hasMore: boolean, totalCount: number }
export const getConversationMessages = (conversationId: string, params: any = {}) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        conversation: {
          _id: conversationId,
          orderId: 'order1',
          orderNumber: 'ORD-2024-001',
          deviceInfo: 'iPhone 15 Pro - Screen Replacement',
          participants: [
            {
              _id: 'customer1',
              name: 'John Doe',
              role: 'customer',
              avatar: 'https://via.placeholder.com/40x40/3b82f6/ffffff?text=JD',
              isOnline: true,
              lastSeen: '2024-01-15T10:30:00Z'
            },
            {
              _id: 'staff1',
              name: 'Sarah Johnson',
              role: 'staff',
              avatar: 'https://via.placeholder.com/40x40/10b981/ffffff?text=SJ',
              isOnline: false,
              lastSeen: '2024-01-15T09:45:00Z'
            }
          ],
          status: 'active',
          createdAt: '2024-01-14T09:00:00Z',
          updatedAt: '2024-01-15T10:30:00Z'
        },
        messages: [
          {
            _id: 'msg1',
            conversationId: conversationId,
            senderId: 'customer1',
            senderName: 'John Doe',
            senderRole: 'customer',
            senderAvatar: 'https://via.placeholder.com/40x40/3b82f6/ffffff?text=JD',
            content: 'Hi, I wanted to check on the status of my iPhone repair. When do you think it will be ready?',
            attachments: [],
            timestamp: '2024-01-14T09:15:00Z',
            isRead: true,
            messageType: 'text'
          },
          {
            _id: 'msg2',
            conversationId: conversationId,
            senderId: 'staff1',
            senderName: 'Sarah Johnson',
            senderRole: 'staff',
            senderAvatar: 'https://via.placeholder.com/40x40/10b981/ffffff?text=SJ',
            content: 'Hello John! I\'ve started working on your iPhone. The screen replacement is going smoothly. I expect to have it completed by tomorrow afternoon.',
            attachments: [],
            timestamp: '2024-01-14T10:30:00Z',
            isRead: true,
            messageType: 'text'
          },
          {
            _id: 'msg3',
            conversationId: conversationId,
            senderId: 'staff1',
            senderName: 'Sarah Johnson',
            senderRole: 'staff',
            senderAvatar: 'https://via.placeholder.com/40x40/10b981/ffffff?text=SJ',
            content: 'Here\'s a photo of the progress so far. The old screen has been removed and I\'m preparing to install the new one.',
            attachments: [
              {
                _id: 'att1',
                name: 'repair_progress.jpg',
                url: 'https://via.placeholder.com/400x300/10b981/ffffff?text=Repair+Progress',
                type: 'image',
                size: 245760
              }
            ],
            timestamp: '2024-01-14T14:20:00Z',
            isRead: true,
            messageType: 'image'
          },
          {
            _id: 'msg4',
            conversationId: conversationId,
            senderId: 'customer1',
            senderName: 'John Doe',
            senderRole: 'customer',
            senderAvatar: 'https://via.placeholder.com/40x40/3b82f6/ffffff?text=JD',
            content: 'Great! Thank you for the update and photo. That looks professional. What time tomorrow should I plan to pick it up?',
            attachments: [],
            timestamp: '2024-01-14T15:45:00Z',
            isRead: true,
            messageType: 'text'
          },
          {
            _id: 'msg5',
            conversationId: conversationId,
            senderId: 'staff1',
            senderName: 'Sarah Johnson',
            senderRole: 'staff',
            senderAvatar: 'https://via.placeholder.com/40x40/10b981/ffffff?text=SJ',
            content: 'Your device repair is progressing well. We should have it ready by tomorrow around 3 PM. I\'ll send you a notification when it\'s ready for pickup.',
            attachments: [],
            timestamp: '2024-01-15T10:30:00Z',
            isRead: false,
            messageType: 'text'
          },
          {
            _id: 'msg6',
            conversationId: conversationId,
            senderId: 'system',
            senderName: 'System',
            senderRole: 'staff',
            senderAvatar: '',
            content: 'Order status updated to "Quality Check" - Your device is undergoing final quality inspection.',
            attachments: [],
            timestamp: '2024-01-15T10:35:00Z',
            isRead: false,
            messageType: 'system'
          }
        ],
        hasMore: false,
        totalCount: 6
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.get(`/api/messages/conversations/${conversationId}`, { params });
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};

// Description: Send a new message
// Endpoint: POST /api/messages/conversations/:conversationId/messages
// Request: { content: string, attachments?: File[] }
// Response: { success: boolean, message: Message }
export const sendMessage = (conversationId: string, content: string, attachments: File[] = []) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: {
          _id: 'msg_' + Date.now(),
          conversationId: conversationId,
          senderId: 'customer1',
          senderName: 'John Doe',
          senderRole: 'customer',
          senderAvatar: 'https://via.placeholder.com/40x40/3b82f6/ffffff?text=JD',
          content: content,
          attachments: attachments.map((file, index) => ({
            _id: 'att_' + Date.now() + '_' + index,
            name: file.name,
            url: URL.createObjectURL(file),
            type: file.type.startsWith('image/') ? 'image' : 'document',
            size: file.size
          })),
          timestamp: new Date().toISOString(),
          isRead: true,
          messageType: attachments.some(f => f.type.startsWith('image/')) ? 'image' : 'text'
        }
      });
    }, 800);
  });
  // Uncomment the below lines to make an actual API call
  // const formData = new FormData();
  // formData.append('content', content);
  // attachments.forEach((file, index) => {
  //   formData.append(`attachments`, file);
  // });
  // try {
  //   return await api.post(`/api/messages/conversations/${conversationId}/messages`, formData, {
  //     headers: { 'Content-Type': 'multipart/form-data' }
  //   });
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};

// Description: Mark messages as read
// Endpoint: PUT /api/messages/conversations/:conversationId/read
// Request: { messageIds?: string[] }
// Response: { success: boolean, message: string }
export const markMessagesAsRead = (conversationId: string, messageIds?: string[]) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Messages marked as read'
      });
    }, 300);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.put(`/api/messages/conversations/${conversationId}/read`, { messageIds });
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};

// Description: Start a new conversation for an order
// Endpoint: POST /api/messages/conversations
// Request: { orderId: string, initialMessage: string }
// Response: { success: boolean, conversation: Conversation }
export const startConversation = (orderId: string, initialMessage: string) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        conversation: {
          _id: 'conv_' + Date.now(),
          orderId: orderId,
          orderNumber: 'ORD-2024-' + Math.floor(Math.random() * 1000),
          deviceInfo: 'Device - Service',
          participants: [
            {
              _id: 'customer1',
              name: 'John Doe',
              role: 'customer',
              avatar: 'https://via.placeholder.com/40x40/3b82f6/ffffff?text=JD',
              isOnline: true,
              lastSeen: new Date().toISOString()
            }
          ],
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });
    }, 800);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.post('/api/messages/conversations', { orderId, initialMessage });
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};