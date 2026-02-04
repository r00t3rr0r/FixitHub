import api from './api';

// Description: Get communication thread for an order
// Endpoint: GET /api/inspection-communication/:orderId
// Request: {}
// Response: { communication: Object }
export const getCommunicationThread = async (orderId: string) => {
  try {
    const response = await api.get(`/api/inspection-communication/${orderId}`);
    return response.data.communication;
  } catch (error) {
    console.error('getCommunicationThread error:', error);
    throw new Error((error as any)?.response?.data?.error || (error as any).message);
  }
};

// Description: Send a message in the communication thread
// Endpoint: POST /api/inspection-communication/:orderId/message
// Request: { content: string }
// Response: { communication: Object }
export const sendMessage = async (orderId: string, content: string) => {
  try {
    const response = await api.post(`/api/inspection-communication/${orderId}/message`, {
      content,
    });
    return response.data.communication;
  } catch (error) {
    console.error('sendMessage error:', error);
    throw new Error((error as any)?.response?.data?.error || (error as any).message);
  }
};

// Description: Send a feedback request
// Endpoint: POST /api/inspection-communication/:orderId/feedback-request
// Request: { inspectionId: string, question: string, options: Array<{label, value}> }
// Response: { communication: Object }
export const sendFeedbackRequest = async (
  orderId: string,
  inspectionId: string,
  question: string,
  options: Array<{ label: string; value: string }>
) => {
  try {
    const response = await api.post(`/api/inspection-communication/${orderId}/feedback-request`, {
      inspectionId,
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
// Endpoint: POST /api/inspection-communication/:orderId/feedback-response
// Request: { messageId: string, response: {label, value} }
// Response: { communication: Object }
export const respondToFeedback = async (
  orderId: string,
  messageId: string,
  response: { label: string; value: string }
) => {
  try {
    const response_obj = await api.post(`/api/inspection-communication/${orderId}/feedback-response`, {
      messageId,
      response,
    });
    return response_obj.data.communication;
  } catch (error) {
    console.error('respondToFeedback error:', error);
    throw new Error((error as any)?.response?.data?.error || (error as any).message);
  }
};

// Description: Create a quick action
// Endpoint: POST /api/inspection-communication/:orderId/quick-action
// Request: { inspectionId: string, actionType: string, description?: string, metadata?: object }
// Response: { communication: Object }
export const createQuickAction = async (
  orderId: string,
  inspectionId: string,
  actionType: 'part_replacement' | 'incorrect_device' | 'incorrect_unlock_code' | 'additional_costs',
  description?: string,
  metadata?: any
) => {
  try {
    const response = await api.post(`/api/inspection-communication/${orderId}/quick-action`, {
      inspectionId,
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
// Endpoint: PUT /api/inspection-communication/:orderId/quick-action/:messageId/complete
// Request: {}
// Response: { communication: Object }
export const completeQuickAction = async (orderId: string, messageId: string) => {
  try {
    const response = await api.put(`/api/inspection-communication/${orderId}/quick-action/${messageId}/complete`, {});
    return response.data.communication;
  } catch (error) {
    console.error('completeQuickAction error:', error);
    throw new Error((error as any)?.response?.data?.error || (error as any).message);
  }
};

// Description: Mark all messages as read
// Endpoint: PUT /api/inspection-communication/:orderId/mark-read
// Request: {}
// Response: { communication: Object }
export const markMessagesAsRead = async (orderId: string) => {
  try {
    const response = await api.put(`/api/inspection-communication/${orderId}/mark-read`, {});
    return response.data.communication;
  } catch (error) {
    console.error('markMessagesAsRead error:', error);
    throw new Error((error as any)?.response?.data?.error || (error as any).message);
  }
};

// Description: Get pending feedback count
// Endpoint: GET /api/inspection-communication/:orderId/pending-feedback
// Request: {}
// Response: { count: number }
export const getPendingFeedbackCount = async (orderId: string) => {
  try {
    const response = await api.get(`/api/inspection-communication/${orderId}/pending-feedback`);
    return response.data.count;
  } catch (error) {
    console.error('getPendingFeedbackCount error:', error);
    throw new Error((error as any)?.response?.data?.error || (error as any).message);
  }
};

// Description: Get pending actions count
// Endpoint: GET /api/inspection-communication/:orderId/pending-actions
// Request: {}
// Response: { count: number }
export const getPendingActionsCount = async (orderId: string) => {
  try {
    const response = await api.get(`/api/inspection-communication/${orderId}/pending-actions`);
    return response.data.count;
  } catch (error) {
    console.error('getPendingActionsCount error:', error);
    throw new Error((error as any)?.response?.data?.error || (error as any).message);
  }
};
