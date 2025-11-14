import api from './api';

// Description: Get all bookings for the authenticated user
// Endpoint: GET /api/bookings
// Request: { status?: string, billingStatus?: string, limit?: number, skip?: number }
// Response: { success: boolean, bookings: Array<Booking>, count: number }
export const getBookings = async (filters?: {
  status?: string;
  billingStatus?: string;
  limit?: number;
  skip?: number;
}) => {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.billingStatus) params.append('billingStatus', filters.billingStatus);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.skip) params.append('skip', filters.skip.toString());

    const queryString = params.toString();
    const endpoint = queryString ? `/api/bookings?${queryString}` : '/api/bookings';

    const response = await api.get(endpoint);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get a specific booking by ID with all details
// Endpoint: GET /api/bookings/:id
// Request: {}
// Response: { success: boolean, booking: Booking }
export const getBooking = async (bookingId: string) => {
  try {
    const response = await api.get(`/api/bookings/${bookingId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get booking summary for display purposes
// Endpoint: GET /api/bookings/:id/summary
// Request: {}
// Response: { success: boolean, summary: object }
export const getBookingSummary = async (bookingId: string) => {
  try {
    const response = await api.get(`/api/bookings/${bookingId}/summary`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Group existing orders into a booking (admin only)
// Endpoint: POST /api/bookings/group
// Request: { orderIds: string[], customerId: string }
// Response: { success: boolean, booking: Booking, bookingId: string }
export const groupOrdersIntoBooking = async (orderIds: string[], customerId: string) => {
  try {
    const response = await api.post('/api/bookings/group', {
      orderIds,
      customerId,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update booking status (admin only)
// Endpoint: PUT /api/bookings/:id/status
// Request: { status: string, description?: string }
// Response: { success: boolean, booking: Booking }
export const updateBookingStatus = async (
  bookingId: string,
  status: 'pending' | 'payment-pending' | 'processing' | 'completed' | 'cancelled',
  description?: string
) => {
  try {
    const response = await api.put(`/api/bookings/${bookingId}/status`, {
      status,
      description,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update booking billing status (admin only)
// Endpoint: PUT /api/bookings/:id/billing-status
// Request: { billingStatus: string, paymentStatus?: string }
// Response: { success: boolean, booking: Booking }
export const updateBookingBillingStatus = async (
  bookingId: string,
  billingStatus: 'unpaid' | 'partially-paid' | 'paid',
  paymentStatus?: 'pending' | 'paid' | 'refunded' | 'partial'
) => {
  try {
    const response = await api.put(`/api/bookings/${bookingId}/billing-status`, {
      billingStatus,
      paymentStatus,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Cancel a booking (admin only)
// Endpoint: DELETE /api/bookings/:id
// Request: {}
// Response: { success: boolean, booking: Booking }
export const cancelBooking = async (bookingId: string) => {
  try {
    const response = await api.delete(`/api/bookings/${bookingId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get all bookings for admin with filtering (admin only)
// Endpoint: GET /api/bookings
// Request: { status?: string, billingStatus?: string, limit?: number, skip?: number }
// Response: { success: boolean, bookings: Array<Booking>, count: number }
export const getAdminBookings = async (filters?: {
  status?: string;
  billingStatus?: string;
  limit?: number;
  skip?: number;
}) => {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.billingStatus) params.append('billingStatus', filters.billingStatus);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.skip) params.append('skip', filters.skip.toString());

    const queryString = params.toString();
    const endpoint = queryString ? `/api/bookings?${queryString}` : '/api/bookings';

    const response = await api.get(endpoint);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};
