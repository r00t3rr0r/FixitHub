import api from './api';

export interface ContactFormPayload {
  name: string;
  email: string;
  phone?: string;
  orderNumber?: string;
  subject: 'repair' | 'status' | 'business' | 'complaint' | 'other';
  message: string;
  privacyAccepted: boolean;
  website?: string;
  formStartedAt?: string;
}

export interface ContactFormResponse {
  success: boolean;
  message: string;
  messageId?: string;
}

export const submitContactForm = async (payload: ContactFormPayload): Promise<ContactFormResponse> => {
  try {
    const response = await api.post('/api/contact', payload);
    return response.data;
  } catch (error: any) {
    throw new Error(
      error?.data?.error ||
      error?.response?.data?.error ||
      error?.message ||
      'Die Kontaktanfrage konnte nicht gesendet werden.'
    );
  }
};