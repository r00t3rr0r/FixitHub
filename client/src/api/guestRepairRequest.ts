import api from './api';
import { GuestInfo } from '@/components/auth/AuthRequiredDialog';
import type { RepairRequest } from './repairRequests';

export interface GuestRepairRequestData {
  deviceSource: 'catalog' | 'manual';
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

const messageOf = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback;

// Description: Create a repair request as a guest
// Endpoint: POST /api/repair-requests/guest
// Request: { guestInfo, deviceSource, ...deviceAndIssueData }
// Response: { success: true, requestNumber, guestTrackingToken }
export const createGuestRepairRequest = async (
  guestInfo: GuestInfo,
  data: GuestRepairRequestData
): Promise<{ requestNumber: string; guestTrackingToken: string }> => {
  try {
    const response = await api.post('/api/repair-requests/guest', { guestInfo, ...data });
    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Fehler beim Erstellen der Gast-Anfrage.');
    }
    return response.data;
  } catch (error: any) {
    throw new Error(messageOf(error, 'Fehler beim Erstellen der Gast-Anfrage.'));
  }
};

// Description: Track a guest repair request (customer view, no internal data)
// Endpoint: GET /api/repair-requests/guest/track?token=...&email=...
// Response: { success: true, request: RepairRequest (Kundensicht inkl. quote, responseRequired, convertedOrder) }
export const trackGuestRepairRequest = async (token: string, email: string): Promise<RepairRequest> => {
  try {
    const response = await api.get('/api/repair-requests/guest/track', { params: { token, email } });
    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Reparaturanfrage nicht gefunden.');
    }
    return response.data.request;
  } catch (error: any) {
    // status: HTTP-Status (z. B. 403/404 = nicht gefunden; fehlend/5xx = Lade- bzw. Netzwerkfehler)
    const wrapped: Error & { status?: number } = new Error(messageOf(error, 'Reparaturanfrage nicht gefunden.'));
    wrapped.status = error?.response?.status;
    throw wrapped;
  }
};

// Description: Get communication thread for a guest repair request
// Endpoint: GET /api/repair-requests/guest/:id/communication?token=...&email=...
// Response: { success: true, communication: Object | null }
export const getGuestRepairRequestCommunication = async (requestId: string, access: GuestTrackAccess) => {
  try {
    const response = await api.get(`/api/repair-requests/guest/${requestId}/communication`, {
      params: { token: access.token, email: access.email },
    });
    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Nachrichten konnten nicht geladen werden.');
    }
    return response.data.communication;
  } catch (error: any) {
    throw new Error(messageOf(error, 'Nachrichten konnten nicht geladen werden.'));
  }
};

// Description: Send a message as a guest (idempotent with clientMessageId)
// Endpoint: POST /api/repair-requests/guest/:id/message
// Request: { token, email, content, clientMessageId? }
// Response: { success: true, communication: Object, duplicate: boolean }
export const sendGuestRepairRequestMessage = async (
  requestId: string,
  access: GuestTrackAccess,
  content: string,
  clientMessageId?: string
) => {
  try {
    const response = await api.post(`/api/repair-requests/guest/${requestId}/message`, {
      token: access.token,
      email: access.email,
      content,
      clientMessageId,
    });
    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Nachricht konnte nicht gesendet werden.');
    }
    return response.data.communication;
  } catch (error: any) {
    throw new Error(messageOf(error, 'Nachricht konnte nicht gesendet werden.'));
  }
};

// Description: Structured answer of a guest to a feedback request (also the Kostenvoranschlag question)
// Endpoint: POST /api/repair-requests/guest/:id/feedback-response
// Request: { token, email, messageId, response: { label, value } }
// Response: { success: true, communication: Object, request: RepairRequest }
export const respondToGuestFeedback = async (
  requestId: string,
  access: GuestTrackAccess,
  messageId: string,
  answer: { label: string; value: string }
): Promise<{ communication: any; request: RepairRequest }> => {
  try {
    const response = await api.post(`/api/repair-requests/guest/${requestId}/feedback-response`, {
      token: access.token,
      email: access.email,
      messageId,
      response: answer,
    });
    return { communication: response.data.communication, request: response.data.request };
  } catch (error: any) {
    throw new Error(messageOf(error, 'Die Antwort konnte nicht gespeichert werden.'));
  }
};

// Description: Guest accepts/declines the published Kostenvoranschlag
// Endpoint: POST /api/repair-requests/guest/:id/quote/respond
// Request: { token, email, decision: 'accept' | 'decline', quoteVersion: number, amount?: number }
// Response: { success: true, request: RepairRequest }
//           409 { code: 'QUOTE_CHANGED' } => Kostenvoranschlag inzwischen geändert (Error.code gesetzt)
export const respondToGuestQuote = async (
  requestId: string,
  access: GuestTrackAccess,
  decision: 'accept' | 'decline',
  seen: { quoteVersion: number; amount?: number }
): Promise<RepairRequest> => {
  try {
    const response = await api.post(`/api/repair-requests/guest/${requestId}/quote/respond`, {
      token: access.token,
      email: access.email,
      decision,
      quoteVersion: seen.quoteVersion,
      amount: seen.amount,
    });
    return response.data.request;
  } catch (error: any) {
    const wrapped: Error & { code?: string } = new Error(messageOf(error, 'Die Antwort konnte nicht gespeichert werden.'));
    wrapped.code = error?.response?.data?.code;
    throw wrapped;
  }
};
