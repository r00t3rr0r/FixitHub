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
  customer?: {
    name: string;
    email: string;
    phone?: string;
    isGuest?: boolean;
  };
  participants: ConversationParticipant[];
  lastMessage: Message;
  unreadCount: number;
  status: 'active' | 'closed';
  createdBy?: {
    userId: string;
    name: string;
    role: 'customer' | 'staff' | 'admin';
  };
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

// ============================================
// ORDER FEEDBACK & INTERACTION ENDPOINTS
// ============================================

export interface FeedbackRequest {
  _id: string;
  type: string;
  question: string;
  options: Array<{ label: string; value: string }>;
  response?: { label: string; value: string };
  respondedAt?: string;
  status: 'pending' | 'responded' | 'expired';
  expiresAt?: string;
}

export interface QuickAction {
  _id: string;
  actionType: string;
  actionLabel: string;
  description?: string;
  metadata?: any;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
}

export interface OrderCommunication {
  _id: string;
  communicationType?: 'order' | 'repair_request';
  sourceId?: string;
  orderId: string;
  repairRequestId?: string;
  orderNumber?: string;
  requestNumber?: string;
  deviceInfo?: string;
  customer?: {
    name: string;
    email: string;
    phone?: string;
    isGuest?: boolean;
  };
  messages: CommunicationMessage[];
  pendingFeedbackCount: number;
  pendingActionsCount: number;
  createdBy?: {
    userId: string;
    name: string;
    role: 'customer' | 'staff' | 'admin';
  };
  status: 'active' | 'archived' | 'resolved';
  lastMessageAt: string;
}

export interface CommunicationMessage {
  _id: string;
  senderType: 'staff' | 'customer' | 'system';
  senderName: string;
  senderRole?: string;
  messageType: 'text' | 'feedback_request' | 'quick_action' | 'system_notification';
  content: string;
  feedbackRequest?: FeedbackRequest;
  quickAction?: QuickAction;
  attachments: Array<{ fileName: string; fileUrl: string; fileType: string }>;
  createdAt: string;
  readBy?: Array<{ userId: string; readAt: string }>;
}

// Description: Get inspection communication for an order
// Endpoint: GET /api/inspection-communication/:orderId
// Response: { communication: OrderCommunication }
export const getInspectionCommunication = async (orderId: string) => {
  try {
    const response = await api.get(`/api/inspection-communication/${orderId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching inspection communication:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Send message to inspection communication thread
// Endpoint: POST /api/inspection-communication/:orderId/message
// Request: { content: string }
// Response: { communication: OrderCommunication }
export const sendInspectionMessage = async (orderId: string, content: string) => {
  try {
    const response = await api.post(`/api/inspection-communication/${orderId}/message`, { content });
    return response.data;
  } catch (error: any) {
    console.error('Error sending inspection communication message:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get all inspection communications visible to the current user
// Endpoint: GET /api/inspection-communication
// Request: { page?: number, limit?: number, search?: string }
// Response: { communications: OrderCommunication[], totalPages: number, currentPage: number, totalCount: number }
export const getInspectionCommunications = async (params: any = {}) => {
  try {
    const response = await api.get('/api/inspection-communication', { params });
    return response.data;
  } catch (error: any) {
    console.error('Error fetching inspection communications:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get all repair-request communications visible to the current user
// Endpoint: GET /api/repair-request-communication
// Request: { page?: number, limit?: number, search?: string }
// Response: { communications: OrderCommunication[], totalPages: number, currentPage: number, totalCount: number }
export const getRepairRequestCommunications = async (params: any = {}) => {
  try {
    const response = await api.get('/api/repair-request-communication', { params });
    return response.data;
  } catch (error: any) {
    console.error('Error fetching repair request communications:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get repair request communication
// Endpoint: GET /api/repair-request-communication/:repairRequestId
// Response: { communication: OrderCommunication }
export const getRepairRequestCommunication = async (repairRequestId: string) => {
  try {
    const response = await api.get(`/api/repair-request-communication/${repairRequestId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching repair request communication:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Send message to repair-request communication thread
// Endpoint: POST /api/repair-request-communication/:repairRequestId/message
// Request: { content: string }
// Response: { communication: OrderCommunication }
export const sendRepairRequestMessage = async (repairRequestId: string, content: string) => {
  try {
    const response = await api.post(`/api/repair-request-communication/${repairRequestId}/message`, { content });
    return response.data;
  } catch (error: any) {
    console.error('Error sending repair-request communication message:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Respond to a feedback request in a repair request communication
// Endpoint: POST /api/repair-request-communication/:repairRequestId/feedback-response
// Request: { messageId: string, response: { label: string, value: string } }
// Response: { communication: OrderCommunication }
export const respondToRepairRequestFeedback = async (
  repairRequestId: string,
  messageId: string,
  response: { label: string; value: string }
) => {
  try {
    const endpoint = `/api/repair-request-communication/${repairRequestId}/feedback-response`;
    const apiResponse = await api.post(endpoint, { messageId, response });
    return apiResponse.data;
  } catch (error: any) {
    console.error('Error responding to repair-request feedback:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Complete a quick action in a repair request communication
// Endpoint: PUT /api/repair-request-communication/:repairRequestId/quick-action/:messageId/complete
// Response: { communication: OrderCommunication }
export const completeRepairRequestQuickAction = async (repairRequestId: string, messageId: string) => {
  try {
    const response = await api.put(
      `/api/repair-request-communication/${repairRequestId}/quick-action/${messageId}/complete`,
      {}
    );
    return response.data;
  } catch (error: any) {
    console.error('Error completing repair-request quick action:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Respond to a feedback request
// Endpoint: POST /api/inspection-communication/:orderId/feedback-response
// Request: { messageId: string, response: { label: string, value: string } }
// Response: { communication: OrderCommunication }
export const respondToFeedback = async (
  orderId: string,
  messageId: string,
  response: { label: string; value: string }
) => {
  try {
    const endpoint = `/api/inspection-communication/${orderId}/feedback-response`;
    const apiResponse = await api.post(endpoint, { messageId, response });
    return apiResponse.data;
  } catch (error: any) {
    console.error('Error responding to feedback:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Complete a quick action
// Endpoint: PUT /api/inspection-communication/:orderId/quick-action/:messageId/complete
// Response: { communication: OrderCommunication }
export const completeQuickAction = async (orderId: string, messageId: string) => {
  try {
    const response = await api.put(
      `/api/inspection-communication/${orderId}/quick-action/${messageId}/complete`,
      {}
    );
    return response.data;
  } catch (error: any) {
    console.error('Error completing quick action:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};