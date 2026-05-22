import api from './api';
import { GuestInfo } from '@/components/auth/AuthRequiredDialog';

export interface GuestRepairRequestData {
  deviceType: string;
  deviceBrand: string;
  deviceModel: string;
  deviceModelId?: string;
  issueDescription: string;
  issueOccurredDate?: string;
  repairAttempts?: string;
  modelNumber?: string;
  waterDamage?: 'no' | 'yes' | 'unsure';
  previousRepairDetails?: string;
  itemCondition?: 'original' | 'refurbished' | 'unsure';
  images?: string[];
}

export interface GuestTrackAccess {
  token: string;
  email: string;
}

// Description: Create a repair request as a guest
// Endpoint: POST /api/repair-requests/guest
// Request: { guestInfo, ...deviceAndIssueData }
// Response: { success: true, requestNumber, guestTrackingToken }
export const createGuestRepairRequest = async (
  guestInfo: GuestInfo,
  data: GuestRepairRequestData
): Promise<{ requestNumber: string; guestTrackingToken: string }> => {
  const response = await api.post('/api/repair-requests/guest', { guestInfo, ...data });
  if (response.status !== 201 || !response.data?.success) {
    throw new Error(response.data?.message || 'Fehler beim Erstellen der Gast-Anfrage.');
  }
  return response.data;
};

// Description: Track a guest repair request
// Endpoint: GET /api/repair-requests/guest/track?token=...&email=...
// Response: { success: true, request: RepairRequest }
export const trackGuestRepairRequest = async (token: string, email: string) => {
  const response = await api.get('/api/repair-requests/guest/track', {
    params: { token, email },
  });
  if (!response.data?.success) {
    throw new Error(response.data?.message || 'Reparaturanfrage nicht gefunden.');
  }
  return response.data.request;
};

// Description: Get communication thread for a guest repair request
// Endpoint: GET /api/repair-requests/guest/:id/communication?token=...&email=...
// Response: { success: true, communication: Object | null }
export const getGuestRepairRequestCommunication = async (
  requestId: string,
  access: GuestTrackAccess
) => {
  const response = await api.get(`/api/repair-requests/guest/${requestId}/communication`, {
    params: { token: access.token, email: access.email },
  });
  if (!response.data?.success) {
    throw new Error(response.data?.message || 'Kommunikation nicht gefunden.');
  }
  return response.data.communication;
};

// Description: Send a message as a guest
// Endpoint: POST /api/repair-requests/guest/:id/message
// Request: { token, email, content }
// Response: { success: true, communication: Object }
export const sendGuestRepairRequestMessage = async (
  requestId: string,
  access: GuestTrackAccess,
  content: string
) => {
  const response = await api.post(`/api/repair-requests/guest/${requestId}/message`, {
    token: access.token,
    email: access.email,
    content,
  });
  if (!response.data?.success) {
    throw new Error(response.data?.message || 'Nachricht konnte nicht gesendet werden.');
  }
  return response.data.communication;
};
