import api from './api';

export interface ContactMessageReply {
  _id?: string;
  repliedBy: string;
  repliedAt: string;
  subject: string;
  message: string;
  htmlContent?: string;
  templateName?: string;
  variables?: Record<string, any>;
  status: 'draft' | 'sent' | 'failed';
  sentAt?: string;
  messageId?: string;
  error?: string;
}

export interface ContactMessage {
  _id: string;
  messageNumber: string;
  name: string;
  email: string;
  phone?: string;
  subject: 'repair' | 'status' | 'business' | 'complaint' | 'other';
  message: string;
  orderNumber?: string;
  ipAddress?: string;
  userAgent?: string;
  status: 'new' | 'read' | 'replied' | 'closed';
  isSpam: boolean;
  replies: ContactMessageReply[];
  createdAt: string;
  updatedAt: string;
}

export interface ContactMessageFilters {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}

export interface ContactMessageStats {
  total: number;
  new: number;
  replied: number;
  closed: number;
}

/**
 * Get all contact messages with filters
 */
export const getContactMessages = async (
  filters: ContactMessageFilters = {}
): Promise<any> => {
  try {
    const params = {
      status: filters.status || '',
      search: filters.search || '',
      page: filters.page || 1,
      limit: filters.limit || 20,
      sortBy: filters.sortBy || 'createdAt',
      sortOrder: filters.sortOrder || 'desc',
    };

    const response = await api.get('/api/admin/contact-messages', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(
      error?.response?.data?.error ||
      error?.message ||
      'Fehler beim Abrufen von Kontaktanfragen.'
    );
  }
};

/**
 * Get contact message statistics
 */
export const getContactMessageStats = async (): Promise<ContactMessageStats> => {
  try {
    const response = await api.get('/api/admin/contact-messages/stats');
    return response.data;
  } catch (error: any) {
    throw new Error(
      error?.response?.data?.error ||
      error?.message ||
      'Fehler beim Abrufen von Statistiken.'
    );
  }
};

/**
 * Get single contact message by ID
 */
export const getContactMessageById = async (messageId: string): Promise<ContactMessage> => {
  try {
    const response = await api.get(`/api/admin/contact-messages/${messageId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(
      error?.response?.data?.error ||
      error?.message ||
      'Fehler beim Abrufen der Kontaktanfrage.'
    );
  }
};

/**
 * Update contact message status
 */
export const updateContactMessageStatus = async (
  messageId: string,
  status: 'new' | 'read' | 'replied' | 'closed'
): Promise<ContactMessage> => {
  try {
    const response = await api.put(
      `/api/admin/contact-messages/${messageId}/status`,
      { status }
    );
    return response.data;
  } catch (error: any) {
    throw new Error(
      error?.response?.data?.error ||
      error?.message ||
      'Fehler beim Aktualisieren des Status.'
    );
  }
};

/**
 * Send reply to contact message
 */
export const sendContactMessageReply = async (
  messageId: string,
  replyData: {
    subject?: string;
    message: string;
    htmlContent?: string;
    templateName?: string;
    variables?: Record<string, any>;
    draft?: boolean;
  }
): Promise<any> => {
  try {
    const response = await api.post(
      `/api/admin/contact-messages/${messageId}/reply`,
      replyData
    );
    return response.data;
  } catch (error: any) {
    throw new Error(
      error?.response?.data?.error ||
      error?.message ||
      'Fehler beim Senden der Antwort.'
    );
  }
};

/**
 * Delete contact message
 */
export const deleteContactMessage = async (messageId: string): Promise<any> => {
  try {
    const response = await api.delete(`/api/admin/contact-messages/${messageId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(
      error?.response?.data?.error ||
      error?.message ||
      'Fehler beim Löschen der Kontaktanfrage.'
    );
  }
};
