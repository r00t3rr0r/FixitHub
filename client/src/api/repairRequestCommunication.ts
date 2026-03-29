import api from './api';

export interface CreatedBy {
  userId: string;
  name: string;
  role: string;
}

export interface RepairCommunication {
  _id: string;
  repairRequestId: string;
  messages: any[];
  status: 'active' | 'archived' | 'resolved';
  pendingFeedbackCount: number;
  pendingActionsCount: number;
  createdBy?: CreatedBy;
  createdAt: string;
  updatedAt: string;
}

// Description: Get communication thread for a repair request
// Endpoint: GET /api/repair-request-communication/:repairRequestId
// Request: {}
// Response: { communication: Object }
export const getCommunicationThread = async (repairRequestId: string) => {
  try {
    const response = await api.get(`/api/repair-request-communication/${repairRequestId}`);
    return response.data.communication;
  } catch (error) {
    console.error('getCommunicationThread error:', error);
    throw new Error((error as any)?.response?.data?.error || (error as any).message);
  }
};

// Description: Send a message in the communication thread
// Endpoint: POST /api/repair-request-communication/:repairRequestId/message
// Request: { content: string }
// Response: { communication: Object }
export const sendMessage = async (repairRequestId: string, content: string) => {
  try {
    const response = await api.post(`/api/repair-request-communication/${repairRequestId}/message`, {
      content,
    });
    return response.data.communication;
  } catch (error) {
    console.error('sendMessage error:', error);
    throw new Error((error as any)?.response?.data?.error || (error as any).message);
  }
};

// Description: Send a feedback request
// Endpoint: POST /api/repair-request-communication/:repairRequestId/feedback-request
// Request: { question: string, options: Array<{label, value}> }
// Response: { communication: Object }
export const sendFeedbackRequest = async (
  repairRequestId: string,
  question: string,
  options: Array<{ label: string; value: string }>
) => {
  try {
    const response = await api.post(`/api/repair-request-communication/${repairRequestId}/feedback-request`, {
      question,
      options,
    });
    return response.data.communication;
  } catch (error) {
    console.error('sendFeedbackRequest error:', error);
    throw new Error((error as any)?.response?.data?.error || (error as any).message);
  }
};

// Description: Respond to a feedback request
// Endpoint: POST /api/repair-request-communication/:repairRequestId/feedback-response
// Request: { messageId: string, response: {label, value} }
// Response: { communication: Object }
export const respondToFeedback = async (
  repairRequestId: string,
  messageId: string,
  response: { label: string; value: string }
) => {
  try {
    const response_obj = await api.post(`/api/repair-request-communication/${repairRequestId}/feedback-response`, {
      messageId,
      response,
    });
    return response_obj.data.communication;
  } catch (error) {
    console.error('respondToFeedback error:', error);
    throw new Error((error as any)?.response?.data?.error || (error as any).message);
  }
};

// Description: Create a quick action for repair request
// Endpoint: POST /api/repair-request-communication/:repairRequestId/quick-action
// Request: { actionType: string, description?: string }
// Response: { communication: Object }
export const createQuickAction = async (
  repairRequestId: string,
  actionType: 'parts_needed' | 'approval_required' | 'additional_cost' | 'status_update' | 'schedule_appointment',
  description?: string,
  metadata?: any
) => {
  try {
    const response = await api.post(`/api/repair-request-communication/${repairRequestId}/quick-action`, {
      actionType,
      description,
      metadata,
    });
    return response.data.communication;
  } catch (error) {
    console.error('createQuickAction error:', error);
    throw new Error((error as any)?.response?.data?.error || (error as any).message);
  }
};

// Description: Complete a quick action
// Endpoint: PUT /api/repair-request-communication/:repairRequestId/quick-action/:messageId/complete
// Request: {}
// Response: { communication: Object }
export const completeQuickAction = async (repairRequestId: string, messageId: string) => {
  try {
    const response = await api.put(`/api/repair-request-communication/${repairRequestId}/quick-action/${messageId}/complete`, {});
    return response.data.communication;
  } catch (error) {
    console.error('completeQuickAction error:', error);
    throw new Error((error as any)?.response?.data?.error || (error as any).message);
  }
};

// Description: Mark all messages as read
// Endpoint: PUT /api/repair-request-communication/:repairRequestId/mark-read
// Request: {}
// Response: { communication: Object }
export const markMessagesAsRead = async (repairRequestId: string) => {
  try {
    const response = await api.put(`/api/repair-request-communication/${repairRequestId}/mark-read`, {});
    return response.data.communication;
  } catch (error) {
    console.error('markMessagesAsRead error:', error);
    throw new Error((error as any)?.response?.data?.error || (error as any).message);
  }
};

// Description: Get pending feedback count
// Endpoint: GET /api/repair-request-communication/:repairRequestId/pending-feedback
// Request: {}
// Response: { count: number }
export const getPendingFeedbackCount = async (repairRequestId: string) => {
  try {
    const response = await api.get(`/api/repair-request-communication/${repairRequestId}/pending-feedback`);
    return response.data.count;
  } catch (error) {
    console.error('getPendingFeedbackCount error:', error);
    throw new Error((error as any)?.response?.data?.error || (error as any).message);
  }
};

// Description: Get pending actions count
// Endpoint: GET /api/repair-request-communication/:repairRequestId/pending-actions
// Request: {}
// Response: { count: number }
export const getPendingActionsCount = async (repairRequestId: string) => {
  try {
    const response = await api.get(`/api/repair-request-communication/${repairRequestId}/pending-actions`);
    return response.data.count;
  } catch (error) {
    console.error('getPendingActionsCount error:', error);
    throw new Error((error as any)?.response?.data?.error || (error as any).message);
  }
};

// Description: Get unread message count for a repair request
// Endpoint: GET /api/repair-request-communication/:repairRequestId/unread-count
// Request: {}
// Response: { unreadCount: number }
export const getUnreadMessageCount = async (repairRequestId: string) => {
  try {
    const response = await api.get(`/api/repair-request-communication/${repairRequestId}/unread-count`);
    return response.data.unreadCount || 0;
  } catch (error) {
    console.error('getUnreadMessageCount error:', error);
    throw new Error((error as any)?.response?.data?.error || (error as any).message);
  }
};
