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
export const getConversations = async (params: any = {}) => {
  try {
    const response = await api.get('/api/messages/conversations', { params });
    return response.data;
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get messages for a specific conversation
// Endpoint: GET /api/messages/conversations/:conversationId
// Request: { page?: number, limit?: number }
// Response: { conversation: Conversation, messages: Message[], hasMore: boolean, totalCount: number }
export const getConversationMessages = async (conversationId: string, params: any = {}) => {
  try {
    const response = await api.get(`/api/messages/conversations/${conversationId}`, { params });
    return response.data;
  } catch (error: any) {
    console.error('Error fetching conversation messages:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Send a new message
// Endpoint: POST /api/messages/conversations/:conversationId/messages
// Request: { content: string, attachments?: File[] }
// Response: { success: boolean, message: Message }
export const sendMessage = async (conversationId: string, content: string, attachments: File[] = []) => {
  try {
    const formData = new FormData();
    formData.append('content', content);
    attachments.forEach((file) => {
      formData.append('attachments', file);
    });

    const response = await api.post(`/api/messages/conversations/${conversationId}/messages`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  } catch (error: any) {
    console.error('Error sending message:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Mark messages as read
// Endpoint: PUT /api/messages/conversations/:conversationId/read
// Request: { messageIds?: string[] }
// Response: { success: boolean, message: string }
export const markMessagesAsRead = async (conversationId: string, messageIds?: string[]) => {
  try {
    const response = await api.put(`/api/messages/conversations/${conversationId}/read`, { messageIds });
    return response.data;
  } catch (error: any) {
    console.error('Error marking messages as read:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Start a new conversation for an order
// Endpoint: POST /api/messages/conversations
// Request: { orderId: string, initialMessage: string }
// Response: { success: boolean, conversation: Conversation }
export const startConversation = async (orderId: string, initialMessage: string) => {
  try {
    const response = await api.post('/api/messages/conversations', { orderId, initialMessage });
    return response.data;
  } catch (error: any) {
    console.error('Error starting conversation:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};