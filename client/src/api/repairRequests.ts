import api from './api';

// TypeScript interfaces
export interface RepairRequest {
  _id: string;
  requestNumber: string;
  customerId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    avatar?: string;
  };
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deviceType: string;
  deviceBrand: string;
  deviceModel: string;
  deviceModelId?: {
    _id: string;
    name: string;
    manufacturer: string;
    specifications?: any;
  };
  issueDescription: string;
  issueOccurredDate: string;
  repairAttempts: string;
  additionalInfo: string;
  images: string[];
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'converted';
  assignedStaffId?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assignedStaffName?: string;
  messages: RepairRequestMessage[];
  convertedToOrderId?: {
    _id: string;
    orderNumber: string;
    status: string;
    totalCost?: number;
  };
  convertedAt?: Date;
  convertedByStaffId?: string;
  convertedByStaffName?: string;
  adminNotes: AdminNote[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedCost: number;
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
}

export interface CreateRepairRequestData {
  deviceType: string;
  deviceBrand: string;
  deviceModel: string;
  deviceModelId?: string;
  issueDescription: string;
  issueOccurredDate: string;
  repairAttempts: string;
  additionalInfo?: string;
  images?: string[];
}

export interface ConvertToOrderData {
  services: string[];
  addOns?: any[];
  totalCost?: number;
}

// Description: Create a new repair request
// Endpoint: POST /api/repair-requests
// Request: { deviceType, deviceBrand, deviceModel, deviceModelId, issueDescription, issueOccurredDate, repairAttempts, additionalInfo, images }
// Response: { success: boolean, request: RepairRequest, message: string }
export const createRepairRequest = async (data: CreateRepairRequestData) => {
  try {
    const response = await api.post('/api/repair-requests', data);
    return response.data;
  } catch (error: any) {
    console.error('Error creating repair request:', error);
    throw new Error(error?.response?.data?.message || error.message);
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
    throw new Error(error?.response?.data?.message || error.message);
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
    throw new Error(error?.response?.data?.message || error.message);
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
    throw new Error(error?.response?.data?.message || error.message);
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
    throw new Error(error?.response?.data?.message || error.message);
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
    throw new Error(error?.response?.data?.message || error.message);
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
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Add a message to the communication thread
// Endpoint: POST /api/repair-requests/:id/messages
// Request: { message: string }
// Response: { success: boolean, request: RepairRequest, message: string }
export const addRepairRequestMessage = async (requestId: string, message: string) => {
  try {
    const response = await api.post(`/api/repair-requests/${requestId}/messages`, { message });
    return response.data;
  } catch (error: any) {
    console.error('Error adding message:', error);
    throw new Error(error?.response?.data?.message || error.message);
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
    throw new Error(error?.response?.data?.message || error.message);
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
    throw new Error(error?.response?.data?.message || error.message);
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
    throw new Error(error?.response?.data?.message || error.message);
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
    throw new Error(error?.response?.data?.message || error.message);
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
    throw new Error(error?.response?.data?.message || error.message);
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
    throw new Error(error?.response?.data?.message || error.message);
  }
};
