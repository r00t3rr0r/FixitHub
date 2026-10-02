import api from './api';

export interface CreatedBy {
  userId: string;
  name: string;
  role: string;
}

export interface Communication {
  _id: string;
  orderId: string;
  messages: any[];
  status: 'active' | 'archived' | 'resolved';
  pendingFeedbackCount: number;
  pendingActionsCount: number;
  createdBy?: CreatedBy;
  createdAt: string;
  updatedAt: string;
}

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

// Interne Notiz eines Auftrags (Speicher Order.staffNotes, Typ 'internal'). Kommt NUR in
// Personal-Antworten vor - Kunden- und Gastpfade liefern das Feld nie aus.
export interface InternalNote {
  _id: string;
  staffId: string | null;
  staffName: string;
  note: string;
  createdAt: string;
  visibility: 'internal';
}

// Description: Get thread plus (staff only) internal notes
// Endpoint: GET /api/inspection-communication/:orderId
// Response: { communication: Object|null, internalNotes?: InternalNote[] }
export const getCommunicationThreadWithNotes = async (orderId: string): Promise<{ communication: any; internalNotes: InternalNote[] | null }> => {
  try {
    const response = await api.get(`/api/inspection-communication/${orderId}`);
    return {
      communication: response.data.communication,
      internalNotes: Array.isArray(response.data.internalNotes) ? response.data.internalNotes : null,
    };
  } catch (error) {
    throw new Error((error as any)?.response?.data?.error || (error as any).message);
  }
};

// Description: Save an internal note (staff only; customer is NOT notified)
// Endpoint: POST /api/inspection-communication/:orderId/internal-note
// Request: { note: string, clientMessageId?: string }
// Response: { internalNote, internalNotes, created }
export const addInternalNote = async (orderId: string, note: string, clientMessageId?: string) => {
  try {
    const response = await api.post(`/api/inspection-communication/${orderId}/internal-note`, { note, clientMessageId });
    return response.data as { internalNote: InternalNote | null; internalNotes: InternalNote[]; created: boolean };
  } catch (error) {
    throw new Error((error as any)?.response?.data?.error || (error as any).message);
  }
};

// Description: Send a message in the communication thread (customer-visible)
// Endpoint: POST /api/inspection-communication/:orderId/message
// Request: { content: string, clientMessageId?: string }  (gleiche clientMessageId = keine Doppelnachricht)
// Response: { communication: Object, created: boolean }
export const sendMessage = async (orderId: string, content: string, clientMessageId?: string) => {
  try {
    const response = await api.post(`/api/inspection-communication/${orderId}/message`, {
      content,
      clientMessageId,
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
// inspectionId ist optional: der Server uebernimmt nur eine DeviceInspection dieses Auftrags.
export const sendFeedbackRequest = async (
  orderId: string,
  inspectionId: string | undefined,
  question: string,
  options: Array<{ label: string; value: string }>,
  clientMessageId?: string
) => {
  try {
    const response = await api.post(`/api/inspection-communication/${orderId}/feedback-request`, {
      inspectionId: inspectionId || undefined,
      question,
      options,
      clientMessageId,
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
  inspectionId: string | undefined,
  actionType: 'part_replacement' | 'incorrect_device' | 'incorrect_unlock_code' | 'additional_costs' | 'update_unlock_info' | 'customer_defect_info',
  description?: string,
  metadata?: any,
  clientMessageId?: string
) => {
  try {
    const response = await api.post(`/api/inspection-communication/${orderId}/quick-action`, {
      inspectionId: inspectionId || undefined,
      actionType,
      description,
      metadata,
      clientMessageId,
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

// Description: Get unread message counts for multiple orders
// Endpoint: POST /api/inspection-communication/unread-counts
// Request: { orderIds: Array<string> }
// Response: { unreadCounts: Record<string, { unread: number, senderType?: string }> }
export const getUnreadMessageCounts = async (orderIds: string[]) => {
  try {
    const response = await api.post(`/api/inspection-communication/unread-counts`, {
      orderIds,
    });
    return response.data.unreadCounts;
  } catch (error) {
    console.error('getUnreadMessageCounts error:', error);
    throw new Error((error as any)?.response?.data?.error || (error as any).message);
  }
};

// Description: Submit updated unlock information (customer facing)
// Endpoint: POST /api/inspection-communication/:orderId/update-unlock-info
// Request: { unlockCode?: string, unlockPattern?: string[], noLock?: boolean }
// Response: { order: Object }
export const submitUnlockInfoUpdate = async (
  orderId: string,
  data: { unlockCode?: string; unlockPattern?: string[]; noLock?: boolean }
) => {
  try {
    const response = await api.post(`/api/inspection-communication/${orderId}/update-unlock-info`, data);
    return response.data;
  } catch (error) {
    console.error('submitUnlockInfoUpdate error:', error);
    throw new Error((error as any)?.response?.data?.error || (error as any).message);
  }
};
