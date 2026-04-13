import api from './api';

// Description: Get all bookings for the authenticated user with pagination
// Endpoint: GET /api/bookings
// Request: { status?: string, billingStatus?: string, limit?: number, skip?: number }
// Response: { success: boolean, bookings: Array<Booking>, count: number, total: number }
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
    const payload = response.data || {};
    const booking = payload.booking || {};
    const liveTracking = payload.liveShippingTracking || null;

    const mergedBooking = {
      ...booking,
      liveShippingTracking: liveTracking,
      trackingNumber: booking.trackingNumber || liveTracking?.trackingNumber || '',
      shippingStatus: booking.shippingStatus || liveTracking?.status || '',
      shippingStatusDescription: booking.shippingStatusDescription || liveTracking?.description || '',
      estimatedDelivery: booking.estimatedDelivery || liveTracking?.estimatedDelivery || null,
      carrier: booking.carrier || liveTracking?.carrier || 'DHL',
    };

    return {
      ...payload,
      booking: mergedBooking,
    };
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

// Description: Get all bookings for admin with filtering and pagination (admin only)
// Endpoint: GET /api/bookings
// Request: { status?: string, billingStatus?: string, limit?: number, skip?: number }
// Response: { success: boolean, bookings: Array<Booking>, count: number, total: number }
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

// Description: Get all orders associated with a booking with their current repair progress status
// Endpoint: GET /api/bookings/:id/orders
// Request: {}
// Response: { success: boolean, orders: Array<{orderId, orderNumber, type, device, services, products, status, progress, cost}>, count: number }
export const getBookingOrders = async (bookingId: string) => {
  try {
    const response = await api.get(`/api/bookings/${bookingId}/orders`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Preview invoice for a booking before creation
// Endpoint: GET /api/bookings/:id/invoice/preview
// Request: {}
// Response: { success: boolean, invoicePreview: object }
export const previewBookingInvoice = async (bookingId: string) => {
  try {
    const response = await api.get(`/api/bookings/${bookingId}/invoice/preview`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create invoice from booking
// Endpoint: POST /api/bookings/:id/invoice
// Request: { dueDate?: string, notes?: string, sendImmediately?: boolean }
// Response: { success: boolean, invoice: Invoice }
export const createBookingInvoice = async (
  bookingId: string,
  invoiceData?: {
    dueDate?: string;
    notes?: string;
    sendImmediately?: boolean;
  }
) => {
  try {
    const response = await api.post(`/api/bookings/${bookingId}/invoice`, invoiceData || {});
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get all invoices for a booking
// Endpoint: GET /api/bookings/:id/invoices
// Request: {}
// Response: { success: boolean, invoices: Invoice[] }
export const getBookingInvoices = async (bookingId: string) => {
  try {
    const response = await api.get(`/api/bookings/${bookingId}/invoices`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// ============================================
// DHL RETURNS & SHIPPING API FUNCTIONS
// ============================================

// Description: Create return label for booking (admin/staff only)
// Endpoint: POST /api/bookings/:id/return-label
// Request: { labelType?: 'PDF' | 'QR' | 'BOTH' }
// Response: { success: boolean, returnId: string, returnTrackingNumber: string, labelUrl: string, qrCodeUrl: string, qrLink: string, message: string }
export const createReturnLabel = async (
  bookingId: string,
  labelType?: 'PDF' | 'QR' | 'BOTH'
) => {
  // Mocking the response with realistic DHL return label data
  return new Promise((resolve) => {
    setTimeout(() => {
      // Generate realistic mock data
      const trackingNumber = `${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const shipmentId = `SHP${Date.now()}`;

      resolve({
        success: true,
        returnId: shipmentId,
        returnTrackingNumber: trackingNumber,
        labelUrl: 'https://example.com/return-labels/label-' + bookingId + '.pdf',
        qrCodeUrl: 'https://example.com/return-qrcodes/qr-' + bookingId + '.png',
        qrLink: 'https://dhl.com/return?ref=' + trackingNumber,
        message: 'Return label created successfully',
        returnShipmentStatus: 'label-created',
        returnCreatedAt: new Date().toISOString(),
        booking: {
          _id: bookingId,
          returnTrackingNumber: trackingNumber,
          returnLabelUrl: 'https://example.com/return-labels/label-' + bookingId + '.pdf',
          returnQRCodeUrl: 'https://example.com/return-qrcodes/qr-' + bookingId + '.png',
          returnShipmentId: shipmentId,
          returnShipmentStatus: 'label-created',
          returnCreatedAt: new Date().toISOString(),
        }
      });
    }, 1500); // Simulate API delay
  });

  // Uncomment the below lines to make an actual API call
  // try {
  //   const response = await api.post(`/api/bookings/${bookingId}/return-label`, {
  //     labelType: labelType || 'BOTH',
  //   });
  //   return response.data;
  // } catch (error: any) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Get return tracking information for booking
// Endpoint: GET /api/bookings/:id/return-tracking
// Request: {}
// Response: { success: boolean, trackingNumber: string, status: string, statusDescription: string, estimatedDelivery?: string, events: Array, booking: object }
export const getReturnTracking = async (bookingId: string) => {
  try {
    const response = await api.get(`/api/bookings/${bookingId}/return-tracking`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get outbound shipping tracking information for booking
// Endpoint: GET /api/bookings/:id/shipping-tracking
// Request: {}
// Response: { success: boolean, trackingNumber: string, status: string, description: string, estimatedDelivery?: string, events: Array, booking: object }
export const getBookingShippingTracking = async (bookingId: string) => {
  try {
    const response = await api.get(`/api/bookings/${bookingId}/shipping-tracking`)
    return response.data
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message)
  }
}

// Description: Update outbound shipment status from DHL API for booking
// Endpoint: PUT /api/bookings/:id/shipping-status/update
// Request: {}
// Response: { success: boolean, booking: Booking, trackingInfo: Object }
export const updateBookingShippingStatus = async (bookingId: string) => {
  try {
    const response = await api.put(`/api/bookings/${bookingId}/shipping-status/update`)
    return response.data
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message)
  }
}

// Description: Update return shipment status from DHL API (admin/staff only)
// Endpoint: PUT /api/bookings/:id/return-status/update
// Request: {}
// Response: { success: boolean, booking: Booking, trackingInfo: Object }
export const updateReturnStatus = async (bookingId: string) => {
  try {
    const response = await api.put(`/api/bookings/${bookingId}/return-status/update`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Test DHL Returns API connection (admin only)
// Endpoint: GET /api/bookings/test-dhl-returns
// Request: {}
// Response: { success: boolean, message: string, environment?: string, receiverId?: string, error?: string }
export const testDHLReturnsConnection = async () => {
  try {
    const response = await api.get('/api/bookings/test-dhl-returns');
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};
