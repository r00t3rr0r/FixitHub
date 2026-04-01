import api from './api';

export interface Complaint {
  _id: string;
  complaintNumber: string;
  bookingId: string;
  orderId?: string;
  newOrderId?: string;
  workflowType?: 'legacy' | 'order-complaint';
  customerId: {
    _id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    phone?: string;
    avatar?: string;
  };
  subject: string;
  description: string;
  category: 'quality' | 'service' | 'delivery' | 'billing' | 'communication' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status:
    | 'open'
    | 'in-progress'
    | 'pending-customer'
    | 'resolved'
    | 'closed'
    | 'pending_approval'
    | 'approved'
    | 'rejected'
    | 'acknowledged'
    | 'denied'
    | 'new_repair';
  complaintReason?: string;
  rejectionReason?: string;
  technicianReason?: string;
  repairNotes?: string;
  shippingLabelUrl?: string;
  extraCosts?: number;
  serviceFee?: number;
  partialRefund?: number;
  additionalParts?: Array<{
    name: string;
    quantity: number;
    cost: number;
  }>;
  repairOffer?: {
    amount: number;
    description: string;
    createdAt?: string;
    acceptedAt?: string;
    rejectedAt?: string;
    status: 'pending' | 'accepted' | 'rejected' | 'none';
  };
  complaintLogs?: Array<{
    actorId?: string;
    actorName: string;
    actorRole: string;
    action: string;
    fromStatus?: string;
    toStatus?: string;
    notes?: string;
    createdAt: string;
    metadata?: Record<string, any>;
  }>;
  assignedTo?: {
    _id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  assignedToName?: string;
  comments: Array<{
    _id: string;
    userId: string;
    userName: string;
    userRole: string;
    comment: string;
    isInternal: boolean;
    createdAt: string;
  }>;
  resolution?: string;
  resolvedAt?: string;
  resolvedBy?: {
    _id: string;
    firstName?: string;
    lastName?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Description: Get all complaints for a booking
// Endpoint: GET /api/complaints/booking/:bookingId
// Request: {}
// Response: { success: boolean, complaints: Complaint[] }
export const getComplaintsByBooking = async (bookingId: string) => {
  try {
    const response = await api.get(`/api/complaints/booking/${bookingId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get all complaints (admin only)
// Endpoint: GET /api/complaints
// Request: { status?: string, category?: string, priority?: string, limit?: number, skip?: number }
// Response: { success: boolean, complaints: Complaint[] }
export const getAllComplaints = async (filters?: {
  status?: string;
  category?: string;
  priority?: string;
  from?: string;
  to?: string;
  technicianId?: string;
  limit?: number;
  skip?: number;
}) => {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.from) params.append('from', filters.from);
    if (filters?.to) params.append('to', filters.to);
    if (filters?.technicianId) params.append('technicianId', filters.technicianId);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.skip) params.append('skip', filters.skip.toString());

    const queryString = params.toString();
    const endpoint = queryString ? `/api/complaints?${queryString}` : '/api/complaints';

    const response = await api.get(endpoint);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get a specific complaint by ID
// Endpoint: GET /api/complaints/:id
// Request: {}
// Response: { success: boolean, complaint: Complaint }
export const getComplaint = async (complaintId: string) => {
  try {
    const response = await api.get(`/api/complaints/${complaintId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create a new complaint
// Endpoint: POST /api/complaints
// Request: { bookingId: string, orderId?: string, customerId: string, subject: string, description: string, category: string, priority?: string }
// Response: { success: boolean, complaint: Complaint }
export const createComplaint = async (complaintData: {
  bookingId: string;
  orderId?: string;
  subject: string;
  description: string;
  category: string;
  priority?: string;
}) => {
  try {
    const response = await api.post('/api/complaints', complaintData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update complaint status
// Endpoint: PUT /api/complaints/:id/status
// Request: { status: string }
// Response: { success: boolean, complaint: Complaint }
export const updateComplaintStatus = async (complaintId: string, status: string) => {
  try {
    const response = await api.put(`/api/complaints/${complaintId}/status`, { status });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Add comment to complaint
// Endpoint: POST /api/complaints/:id/comments
// Request: { comment: string, isInternal?: boolean }
// Response: { success: boolean, complaint: Complaint }
export const addComplaintComment = async (
  complaintId: string,
  comment: string,
  isInternal?: boolean
) => {
  try {
    const response = await api.post(`/api/complaints/${complaintId}/comments`, {
      comment,
      isInternal,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Assign complaint to staff
// Endpoint: PUT /api/complaints/:id/assign
// Request: { staffId: string, staffName: string }
// Response: { success: boolean, complaint: Complaint }
export const assignComplaint = async (
  complaintId: string,
  staffId: string,
  staffName: string
) => {
  try {
    const response = await api.put(`/api/complaints/${complaintId}/assign`, {
      staffId,
      staffName,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Resolve complaint
// Endpoint: PUT /api/complaints/:id/resolve
// Request: { resolution: string }
// Response: { success: boolean, complaint: Complaint }
export const resolveComplaint = async (complaintId: string, resolution: string) => {
  try {
    const response = await api.put(`/api/complaints/${complaintId}/resolve`, { resolution });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Close complaint
// Endpoint: PUT /api/complaints/:id/close
// Request: {}
// Response: { success: boolean, complaint: Complaint }
export const closeComplaint = async (complaintId: string) => {
  try {
    const response = await api.put(`/api/complaints/${complaintId}/close`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Customer accepts new repair offer
// Endpoint: POST /api/complaints/:id/accept-offer
export const acceptComplaintOffer = async (complaintId: string) => {
  try {
    const response = await api.post(`/api/complaints/${complaintId}/accept-offer`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Customer rejects new repair offer
// Endpoint: POST /api/complaints/:id/reject-offer
export const rejectComplaintOffer = async (complaintId: string, serviceFee?: number) => {
  try {
    const response = await api.post(`/api/complaints/${complaintId}/reject-offer`, { serviceFee });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Convert an accepted repair offer into a booking with its follow-up order
// Endpoint: POST /api/complaints/:id/convert-offer-to-booking
export const convertAcceptedOfferToBooking = async (complaintId: string) => {
  try {
    const response = await api.post(`/api/complaints/${complaintId}/convert-offer-to-booking`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Admin approves complaint
// Endpoint: PATCH /api/complaints/:id/approve
export const approveComplaint = async (complaintId: string) => {
  try {
    const response = await api.patch(`/api/complaints/${complaintId}/approve`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Admin rejects complaint
// Endpoint: PATCH /api/complaints/:id/reject
export const rejectComplaint = async (complaintId: string, rejectionReason: string) => {
  try {
    const response = await api.patch(`/api/complaints/${complaintId}/reject`, {
      rejection_reason: rejectionReason,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Technician acknowledges complaint
// Endpoint: PATCH /api/complaints/:id/acknowledge
export const acknowledgeComplaint = async (
  complaintId: string,
  payload: {
    technician_reason: string;
    additional_parts?: Array<{ name: string; quantity: number; cost: number }>;
    partial_refund?: number;
    repair_notes?: string;
  }
) => {
  try {
    const response = await api.patch(`/api/complaints/${complaintId}/acknowledge`, payload);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Technician denies complaint and creates new offer
// Endpoint: PATCH /api/complaints/:id/deny
export const denyComplaint = async (
  complaintId: string,
  payload: {
    technician_reason: string;
    offer_amount?: number;
    offer_description?: string;
  }
) => {
  try {
    const response = await api.patch(`/api/complaints/${complaintId}/deny`, payload);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};
