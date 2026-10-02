import api from './api';

// TypeScript interfaces

export type RepairRequestStatus = 'pending' | 'reviewing' | 'approved' | 'rejected' | 'converted';
export type RepairRequestQuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined';
export type DeviceSource = 'catalog' | 'manual';

// Kostenvoranschlag (Kundensicht: nie im Entwurf sichtbar; Personal: effectiveQuote inkl. Entwurf)
export interface RepairRequestQuote {
  amount: number;
  description?: string;
  status: RepairRequestQuoteStatus;
  version?: number;
  legacy?: boolean;
  publishedAt?: string | Date | null;
  publishedByName?: string;
  draftUpdatedAt?: string | Date | null;
  draftUpdatedByName?: string;
  respondedAt?: string | Date | null;
  respondedByName?: string;
  responseChannel?: 'customer' | 'guest';
  feedbackMessageId?: string | null;
  emailStatus?: 'accepted' | 'failed';
  emailError?: string;
  emailSentAt?: string | Date | null;
}

export interface ReportedDevice {
  deviceType?: string;
  brand?: string;
  model?: string;
  modelNumber?: string;
  deviceModelId?: string;
  source?: DeviceSource;
  capturedAt?: string | Date;
}

export interface CommunicationSummary {
  unreadCount: number;
  awaitingReply: boolean;
  pendingFeedbackCount: number;
  pendingActionsCount: number;
  messageCount?: number;
  lastMessageAt?: string | Date | null;
}

export interface ConvertedOrderLink {
  orderNumber: string;
  status?: string;
  path: string | null;
  bookingNumber?: string;
}

export interface RepairRequest {
  _id: string;
  requestNumber: string;
  customerId?: {
    _id: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    email: string;
    phone?: string;
    avatar?: string;
  } | string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  isGuest?: boolean;
  deviceType: string;
  deviceBrand: string;
  deviceModel: string;
  deviceLabel?: string;
  deviceSource?: DeviceSource;
  reportedDevice?: ReportedDevice;
  deviceModelId?: {
    _id: string;
    name: string;
    manufacturer?: string;
    image?: string;
    specifications?: any;
  } | string | null;
  issueDescription: string;
  issueOccurredDate: string;
  repairAttempts?: string;
  modelNumber: string;
  waterDamage?: 'no' | 'yes' | 'unsure';
  previousRepairDetails?: string;
  itemCondition?: 'original' | 'refurbished' | 'unsure';
  images: string[];
  status: RepairRequestStatus;
  statusLabel?: string;
  assignedStaffId?: {
    _id: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
  } | null;
  assignedStaffName?: string;
  messages?: RepairRequestMessage[];
  convertedToOrderId?: {
    _id: string;
    orderNumber: string;
    status: string;
    totalCost?: number;
  } | null;
  convertedOrder?: ConvertedOrderLink;
  convertedAt?: Date;
  convertedByStaffId?: string;
  convertedByStaffName?: string;
  adminNotes?: AdminNote[];
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  estimatedCost?: number;
  quote?: RepairRequestQuote | null;          // Kundensicht (nur veröffentlicht) bzw. Rohfeld (Personal)
  effectiveQuote?: RepairRequestQuote | null; // Personalsicht inkl. Entwurf/Altbestand
  responseRequired?: boolean;
  communicationSummary?: CommunicationSummary;
  createdAt: Date;
  updatedAt: Date;
  reviewDeadline?: Date;
}

export interface RepairRequestMessage {
  _id: string;
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'staff' | 'admin';
  message: string;
  sentAt: Date;
  isRead: boolean;
}

export interface AdminNote {
  _id: string;
  staffId: string;
  staffName: string;
  note: string;
  createdAt: Date;
}

export interface RepairRequestFilters {
  status?: string;
  priority?: string;
  quoteStatus?: string;
  customerId?: string;
  assignedStaffId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface RepairRequestStats {
  total: number;
  byStatus: {
    pending: number;
    reviewing: number;
    approved: number;
    rejected: number;
    converted: number;
  };
  highPriority: number;
  unassigned: number;
  quoteSent?: number;
}

export interface CreateRepairRequestData {
  deviceSource: DeviceSource;
  deviceType: string;
  deviceBrand: string;
  deviceModel: string;
  deviceModelId?: string;
  issueDescription: string;
  issueOccurredDate: string;
  repairAttempts?: string;
  modelNumber?: string;
  waterDamage?: 'no' | 'yes' | 'unsure';
  previousRepairDetails?: string;
  itemCondition?: 'original' | 'refurbished' | 'unsure';
  images?: string[];
}

export interface ConvertToOrderData {
  services: string[];
  addOns?: any[];
  // 'none' (Standard): kein DHL-Einsendelabel; 'inbound_label': Gerät wird eingesendet
  shippingMode?: 'none' | 'inbound_label';
}

export interface QuoteSendResult {
  success: boolean;
  request: RepairRequest;
  alreadySent: boolean;
  email: { status: 'accepted' | 'failed' | null; error?: string };
  message: string;
}

export interface UpdateDeviceData {
  deviceModelId?: string;
  manual?: { deviceType: string; deviceBrand: string; deviceModel: string; modelNumber?: string };
}

// Description: Create a new repair request
// Endpoint: POST /api/repair-requests
// Request: { deviceType, deviceBrand, deviceModel, deviceModelId, issueDescription, issueOccurredDate, repairAttempts, modelNumber, images }
// Response: { success: boolean, request: RepairRequest, message: string }
export const createRepairRequest = async (data: CreateRepairRequestData) => {
  try {
    const response = await api.post('/api/repair-requests', data);
    return response.data;
  } catch (error: any) {
    console.error('Error creating repair request:', error);
    throw new Error(error?.response?.data?.message || error?.response?.data?.error || error.message);
  }
};

// Description: Get all repair requests with filtering and pagination (staff/admin only)
// Endpoint: GET /api/repair-requests
// Request: { status?, priority?, customerId?, assignedStaffId?, search?, page?, limit?, sortBy?, sortOrder? }
// Response: { success: boolean, requests: RepairRequest[], pagination: Pagination }
export const getRepairRequests = async (filters?: RepairRequestFilters) => {
  try {
    const response = await api.get('/api/repair-requests', { params: filters });
    return response.data;
  } catch (error: any) {
    console.error('Error getting repair requests:', error);
    throw new Error(error?.response?.data?.message || error?.response?.data?.error || error.message);
  }
};

// Description: Get customer's own repair requests
// Endpoint: GET /api/repair-requests/my-requests
// Request: {}
// Response: { success: boolean, requests: RepairRequest[] }
export const getMyRepairRequests = async () => {
  try {
    const response = await api.get('/api/repair-requests/my-requests');
    return response.data;
  } catch (error: any) {
    console.error('Error getting my repair requests:', error);
    throw new Error(error?.response?.data?.message || error?.response?.data?.error || error.message);
  }
};

// Description: Get repair request statistics (staff/admin only)
// Endpoint: GET /api/repair-requests/statistics
// Request: {}
// Response: { success: boolean, statistics: RepairRequestStats }
export const getRepairRequestStatistics = async () => {
  try {
    const response = await api.get('/api/repair-requests/statistics');
    return response.data;
  } catch (error: any) {
    console.error('Error getting statistics:', error);
    throw new Error(error?.response?.data?.message || error?.response?.data?.error || error.message);
  }
};

// Description: Get a single repair request by ID
// Endpoint: GET /api/repair-requests/:id
// Request: {}
// Response: { success: boolean, request: RepairRequest }
export const getRepairRequestById = async (requestId: string) => {
  try {
    const response = await api.get(`/api/repair-requests/${requestId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error getting repair request:', error);
    throw new Error(error?.response?.data?.message || error?.response?.data?.error || error.message);
  }
};

// Description: Update repair request status (staff/admin only)
// Endpoint: PUT /api/repair-requests/:id/status
// Request: { status: string }
// Response: { success: boolean, request: RepairRequest, message: string }
export const updateRepairRequestStatus = async (requestId: string, status: string) => {
  try {
    const response = await api.put(`/api/repair-requests/${requestId}/status`, { status });
    return response.data;
  } catch (error: any) {
    console.error('Error updating status:', error);
    throw new Error(error?.response?.data?.message || error?.response?.data?.error || error.message);
  }
};

// Description: Assign staff to repair request (admin only)
// Endpoint: PUT /api/repair-requests/:id/assign
// Request: { staffId: string }
// Response: { success: boolean, request: RepairRequest, message: string }
export const assignStaffToRepairRequest = async (requestId: string, staffId: string) => {
  try {
    const response = await api.put(`/api/repair-requests/${requestId}/assign`, { staffId });
    return response.data;
  } catch (error: any) {
    console.error('Error assigning staff:', error);
    throw new Error(error?.response?.data?.message || error?.response?.data?.error || error.message);
  }
};

// Description: Add a message to the communication thread (Deprecated - use repairRequestCommunication API)
// Endpoint: POST /api/repair-requests/:id/messages
// Request: { message: string }
// Response: { success: boolean, request: RepairRequest, message: string }
export const addRepairRequestMessage = async (requestId: string, message: string) => {
  try {
    const response = await api.post(`/api/repair-requests/${requestId}/messages`, { message });
    return response.data;
  } catch (error: any) {
    console.error('Error adding message:', error);
    throw new Error(error?.response?.data?.message || error?.response?.data?.error || error.message);
  }
};

// Description: Mark messages as read
// Endpoint: PUT /api/repair-requests/:id/messages/read
// Request: {}
// Response: { success: boolean, request: RepairRequest }
export const markRepairRequestMessagesAsRead = async (requestId: string) => {
  try {
    const response = await api.put(`/api/repair-requests/${requestId}/messages/read`);
    return response.data;
  } catch (error: any) {
    console.error('Error marking messages as read:', error);
    throw new Error(error?.response?.data?.message || error?.response?.data?.error || error.message);
  }
};

// Description: Add admin note (staff/admin only)
// Endpoint: POST /api/repair-requests/:id/admin-notes
// Request: { note: string }
// Response: { success: boolean, request: RepairRequest, message: string }
export const addAdminNote = async (requestId: string, note: string) => {
  try {
    const response = await api.post(`/api/repair-requests/${requestId}/admin-notes`, { note });
    return response.data;
  } catch (error: any) {
    console.error('Error adding admin note:', error);
    throw new Error(error?.response?.data?.message || error?.response?.data?.error || error.message);
  }
};

// Description: Update priority (staff/admin only)
// Endpoint: PUT /api/repair-requests/:id/priority
// Request: { priority: string }
// Response: { success: boolean, request: RepairRequest, message: string }
export const updateRepairRequestPriority = async (requestId: string, priority: string) => {
  try {
    const response = await api.put(`/api/repair-requests/${requestId}/priority`, { priority });
    return response.data;
  } catch (error: any) {
    console.error('Error updating priority:', error);
    throw new Error(error?.response?.data?.message || error?.response?.data?.error || error.message);
  }
};

// Description: Update estimated cost (staff/admin only)
// Endpoint: PUT /api/repair-requests/:id/estimated-cost
// Request: { estimatedCost: number }
// Response: { success: boolean, request: RepairRequest, message: string }
export const updateRepairRequestEstimatedCost = async (requestId: string, estimatedCost: number) => {
  try {
    const response = await api.put(`/api/repair-requests/${requestId}/estimated-cost`, { estimatedCost });
    return response.data;
  } catch (error: any) {
    console.error('Error updating estimated cost:', error);
    throw new Error(error?.response?.data?.message || error?.response?.data?.error || error.message);
  }
};

// Description: Convert repair request to order (staff/admin only)
// Endpoint: POST /api/repair-requests/:id/convert
// Request: { services: string[], addOns?: AddOn[], totalCost?: number }
// Response: { success: boolean, request: RepairRequest, order: Order, message: string }
export const convertRepairRequestToOrder = async (requestId: string, orderData: ConvertToOrderData) => {
  try {
    const response = await api.post(`/api/repair-requests/${requestId}/convert`, orderData);
    return response.data;
  } catch (error: any) {
    console.error('Error converting to order:', error);
    throw new Error(error?.response?.data?.message || error?.response?.data?.error || error.message);
  }
};

// Description: Delete repair request (admin only)
// Endpoint: DELETE /api/repair-requests/:id
// Request: {}
// Response: { success: boolean, message: string }
export const deleteRepairRequest = async (requestId: string) => {
  try {
    const response = await api.delete(`/api/repair-requests/${requestId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error deleting repair request:', error);
    throw new Error(error?.response?.data?.message || error?.response?.data?.error || error.message);
  }
};

// Description: Save Kostenvoranschlag as draft (sends nothing to the customer)
// Endpoint: PUT /api/repair-requests/:id/quote
// Request: { amount: number (>= 0, brutto EUR), description?: string }
// Response: { success: boolean, request: RepairRequest, changed: boolean, message: string }
export const saveRepairRequestQuoteDraft = async (requestId: string, data: { amount: number; description?: string }) => {
  try {
    const response = await api.put(`/api/repair-requests/${requestId}/quote`, data);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.message || error?.response?.data?.error || error.message);
  }
};

// Description: Publish the Kostenvoranschlag to the customer (once per version; notifies once)
// Endpoint: POST /api/repair-requests/:id/quote/send
// Request: { amount?: number, description?: string }
// Response: QuoteSendResult
export const sendRepairRequestQuote = async (requestId: string, data?: { amount?: number; description?: string }): Promise<QuoteSendResult> => {
  try {
    const response = await api.post(`/api/repair-requests/${requestId}/quote/send`, data || {});
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.message || error?.response?.data?.error || error.message);
  }
};

// Description: Customer accepts/declines the Kostenvoranschlag (owner only)
// Endpoint: POST /api/repair-requests/:id/quote/respond
// Request: { decision: 'accept' | 'decline', quoteVersion: number, amount?: number }
//          quoteVersion/amount = genau der Stand, den der Kunde gesehen hat.
// Response: { success: boolean, request: RepairRequest }
//           409 { code: 'QUOTE_CHANGED' } => Kostenvoranschlag inzwischen geändert (Error.code gesetzt)
export const respondToRepairRequestQuote = async (
  requestId: string,
  decision: 'accept' | 'decline',
  seen: { quoteVersion: number; amount?: number }
) => {
  try {
    const response = await api.post(`/api/repair-requests/${requestId}/quote/respond`, {
      decision,
      quoteVersion: seen.quoteVersion,
      amount: seen.amount,
    });
    return response.data;
  } catch (error: any) {
    const wrapped: Error & { code?: string } = new Error(error?.response?.data?.message || error?.response?.data?.error || error.message);
    wrapped.code = error?.response?.data?.code;
    throw wrapped;
  }
};

// Description: Staff matches the device to a catalog model (customer declaration is kept)
// Endpoint: PUT /api/repair-requests/:id/device
// Request: { deviceModelId } | { manual: { deviceType, deviceBrand, deviceModel, modelNumber? } }
// Response: { success: boolean, request: RepairRequest, changed: boolean, message: string }
export const updateRepairRequestDevice = async (requestId: string, data: UpdateDeviceData) => {
  try {
    const response = await api.put(`/api/repair-requests/${requestId}/device`, data);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.message || error?.response?.data?.error || error.message);
  }
};
