import api from './api';
import { toShippingLabelError, type ShipmentResult } from './shipping';
import { downloadLabelPdf, labelFilename, printLabelPdf } from './labelPdf';

export const createManualRepairBooking = async (data: {
  repairOrders: Array<Record<string, any>>;
  guestInfo: Record<string, any>;
  createShippingLabel?: boolean;
}) => {
  try {
    const response = await api.post('/api/bookings/manual-repair', data);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get all bookings for the authenticated user with pagination
// Endpoint: GET /api/bookings
// Request: { status?: string, billingStatus?: string, limit?: number, skip?: number }
// Response: { success: boolean, bookings: Array<Booking>, count: number, total: number }
export const getBookings = async (filters?: {
  status?: string;
  billingStatus?: string;
  /** Kundensuche (Buchung, Auftrag oder Geraet) - serverseitig, nur eigene Buchungen. */
  search?: string;
  limit?: number;
  skip?: number;
}) => {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.billingStatus) params.append('billingStatus', filters.billingStatus);
    if (filters?.search && filters.search.trim()) params.append('search', filters.search.trim());
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
  paymentStatus?: 'pending' | 'paid' | 'refunded' | 'partial' | 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'overdue'
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
// Grund ist Pflicht (intern). 409 BOOKING_HAS_OPEN_ORDERS: zuerst die offenen Aufträge
// einzeln stornieren - die deutsche Servermeldung nennt die Auftragsnummern.
export const cancelBooking = async (bookingId: string, reason: string) => {
  try {
    const response = await api.delete(`/api/bookings/${bookingId}`, { data: { reason } });
    return response.data;
  } catch (error: any) {
    const wrapped: Error & { openOrders?: Array<{ _id: string; orderNumber: string; status: string }> } =
      new Error(error?.response?.data?.error || error.message);
    if (Array.isArray(error?.response?.data?.openOrders)) wrapped.openOrders = error.response.data.openOrders;
    throw wrapped;
  }
};

// Description: Get all bookings for admin with filtering and pagination (admin only)
// Endpoint: GET /api/bookings
// Request: { status?: string, billingStatus?: string, limit?: number, skip?: number }
// Response: { success: boolean, bookings: Array<Booking>, count: number, total: number }
export const getAdminBookings = async (filters?: {
  status?: string;
  billingStatus?: string;
  communication?: 'unread-customer-response';
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  skip?: number;
}) => {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.billingStatus) params.append('billingStatus', filters.billingStatus);
    if (filters?.communication) params.append('communication', filters.communication);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
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
// Request: { invoiceMode?: 'booking' | 'order', orderId?: string }
// Response: { success: boolean, invoicePreview: object }
export const previewBookingInvoice = async (
  bookingId: string,
  options?: {
    invoiceMode?: 'booking' | 'order';
    orderId?: string;
  }
) => {
  try {
    const response = await api.get(`/api/bookings/${bookingId}/invoice/preview`, {
      params: options,
    });
    return response.data;
  } catch (error: any) {
    const apiError = new Error(error?.response?.data?.error || error.message) as Error & {
      status?: number;
      code?: string;
      existingInvoice?: { _id?: string; invoiceNumber?: string };
      existingInvoiceId?: string;
      existingInvoiceNumber?: string;
      redirectTo?: string;
    };
    apiError.status = error?.response?.status;
    apiError.code = error?.response?.data?.code;
    apiError.existingInvoice = error?.response?.data?.existingInvoice;
    apiError.existingInvoiceId = error?.response?.data?.existingInvoice?._id;
    apiError.existingInvoiceNumber = error?.response?.data?.existingInvoice?.invoiceNumber;
    apiError.redirectTo = error?.response?.data?.redirectTo;
    throw apiError;
  }
};

// Description: Create invoice from booking
// Endpoint: POST /api/bookings/:id/invoice
// Request: { dueDate?: string, notes?: string, sendImmediately?: boolean, invoiceMode?: 'booking' | 'order', orderId?: string }
// Response: { success: boolean, invoice: Invoice }
export const createBookingInvoice = async (
  bookingId: string,
  invoiceData?: {
    dueDate?: string;
    notes?: string;
    sendImmediately?: boolean;
    invoiceMode?: 'booking' | 'order';
    orderId?: string;
  }
) => {
  try {
    const response = await api.post(`/api/bookings/${bookingId}/invoice`, invoiceData || {});
    return response.data;
  } catch (error: any) {
    const apiError = new Error(error?.response?.data?.error || error.message) as Error & {
      status?: number;
      code?: string;
      existingInvoice?: { _id?: string; invoiceNumber?: string };
      existingInvoiceId?: string;
      existingInvoiceNumber?: string;
      redirectTo?: string;
    };
    apiError.status = error?.response?.status;
    apiError.code = error?.response?.data?.code;
    apiError.existingInvoice = error?.response?.data?.existingInvoice;
    apiError.existingInvoiceId = error?.response?.data?.existingInvoice?._id;
    apiError.existingInvoiceNumber = error?.response?.data?.existingInvoice?.invoiceNumber;
    apiError.redirectTo = error?.response?.data?.redirectTo;
    throw apiError;
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

// Description: Download shipping label PDF for a booking
// Endpoint: GET /api/bookings/:id/shipping-label
// Response: PDF file blob
// Einsendelabel der Buchung (Kunde -> McRepair). Wirft LabelPdfError mit deutscher Meldung
// (401/403/404/Netzwerk) - Aufrufer zeigen sie im Toast an. Siehe labelPdf.ts (DHL-2).
export const downloadBookingShippingLabel = async (bookingId: string, filename?: string): Promise<void> => {
  await downloadLabelPdf(
    `/api/bookings/${bookingId}/shipping-label`,
    filename || labelFilename('inbound', bookingId),
    'inbound'
  );
};

// Description: Download return label PDF for a booking (DHL-Retoure = ebenfalls Einsendung)
// Endpoint: GET /api/bookings/:id/return-label
// Response: PDF file blob
export const downloadBookingReturnLabel = async (bookingId: string, filename?: string): Promise<void> => {
  await downloadLabelPdf(
    `/api/bookings/${bookingId}/return-label`,
    filename || labelFilename('inbound', bookingId),
    'inbound'
  );
};

// ============================================
// EINSENDESTATUS DER BUCHUNG (Kunde -> McRepair)
// ============================================

export type InboundLabelState =
  | 'ready'
  | 'registered'
  | 'creating'
  | 'review'
  | 'error'
  | 'none'
  | 'not-needed'
  | 'cancelled';

export interface InboundLabelInfo {
  state: InboundLabelState;
  /** Inhaber/Team darf "DHL-Einsendelabel erstellen" ausloesen (POST .../inbound-label). */
  canCreate: boolean;
  /** Fertiger deutscher Hinweistext fuer den Kunden. */
  message: string;
  trackingNumber: string;
  /** Relative API-Adresse des PDFs (nur bei state 'ready'). */
  downloadUrl: string;
  /** Dateiname DHL-Einsendelabel_<BKG|ORD>.pdf bzw. DHL-Testlabel_<BKG>.pdf */
  filename: string;
  source: '' | 'booking' | 'booking-retoure' | 'order';
  /** Dummy-Modus: Testlabel, nicht fuer den Versand. */
  placeholder: boolean;
  shippingStatus: string;
  /** Ein Geraet der Buchung ist bereits bei McRepair eingegangen. */
  deviceReceived: boolean;
  /** Nur Team: */
  lastError?: string;
  reconcileUrl?: string;
  reconciliationReason?: string;
}

export interface InboundLabelBookingSummary {
  _id: string;
  bookingNumber: string;
  createdAt: string | null;
  status: string;
  totalCost: number;
  currency: string;
  paymentStatus: string;
  billingStatus: string;
  paymentMethod: '' | 'card' | 'paypal' | 'invoice';
  deviceCount: number;
  isGuest: boolean;
}

export interface InboundLabelOrderSummary {
  orderId: string;
  orderNumber: string;
  type: 'repair' | 'product';
  device: string;
  status: string;
}

export interface InboundLabelView {
  success: boolean;
  /** Nur bei GET /api/orders/:id/inbound-label */
  scope?: 'booking' | 'order';
  orderId?: string;
  booking: InboundLabelBookingSummary | null;
  orders: InboundLabelOrderSummary[];
  inbound: InboundLabelInfo;
  created?: boolean;
  alreadyExists?: boolean;
}

export class InboundLabelRequestError extends Error {
  status?: number;
  code?: string;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'InboundLabelRequestError';
    this.status = status;
    this.code = code;
  }
}

const toInboundLabelRequestError = (error: unknown, fallback: string): InboundLabelRequestError => {
  const err = error as { status?: number; data?: any; response?: { status?: number; data?: any }; message?: string };
  const status = err?.status ?? err?.response?.status;
  const data = err?.data ?? err?.response?.data;
  const message = status === 401
    ? 'Bitte melden Sie sich an, um Ihr Einsendelabel abzurufen.'
    : status === 403 || status === 404
      ? 'Buchung nicht gefunden.'
      : (data?.error || data?.message || fallback);
  return new InboundLabelRequestError(message, status, data?.code);
};

// Description: Einsendestatus der Buchung (Bestellbestaetigung, Auftragsdetail, Buchungsliste)
// Endpoint: GET /api/bookings/:id/inbound-label  (Inhaber oder Team; sonst 403)
export const getBookingInboundLabel = async (bookingId: string): Promise<InboundLabelView> => {
  try {
    const response = await api.get(`/api/bookings/${bookingId}/inbound-label`);
    return response.data as InboundLabelView;
  } catch (error: unknown) {
    throw toInboundLabelRequestError(error, 'Der Status des Einsendelabels konnte nicht geladen werden.');
  }
};

// Description: "DHL-Einsendelabel erstellen" (Inhaber oder Team), hoechstens ein Label je Buchung
// Endpoint: POST /api/bookings/:id/inbound-label
export const createBookingInboundLabel = async (bookingId: string): Promise<InboundLabelView> => {
  try {
    const response = await api.post(`/api/bookings/${bookingId}/inbound-label`, {});
    return response.data as InboundLabelView;
  } catch (error: unknown) {
    throw toInboundLabelRequestError(error, 'Das Einsendelabel konnte nicht erstellt werden.');
  }
};

// Einsendelabel laut Einsendestatus herunterladen bzw. drucken (nutzt downloadUrl/filename
// aus der Antwort, dadurch auch fuer Retoure- und Auftragsplatz korrekt).
export const downloadInboundLabel = async (inbound: Pick<InboundLabelInfo, 'downloadUrl' | 'filename'>): Promise<void> => {
  await downloadLabelPdf(inbound.downloadUrl, inbound.filename || labelFilename('inbound', 'Buchung'), 'inbound');
};

export const printInboundLabel = async (inbound: Pick<InboundLabelInfo, 'downloadUrl'>): Promise<void> => {
  await printLabelPdf(inbound.downloadUrl, 'inbound');
};

// Description: Create return label for booking (admin/staff only)
// Endpoint: POST /api/bookings/:id/return-label
// Request: { labelType?: 'PDF' | 'QR' | 'BOTH' }
// Response: { success: boolean, returnId: string, returnTrackingNumber: string, labelUrl: string, qrCodeUrl: string, qrLink: string, message: string }
export const createReturnLabel = async (
  bookingId: string,
  labelType?: 'PDF' | 'QR' | 'BOTH'
) => {
  try {
    const response = await api.post(`/api/bookings/${bookingId}/return-label`, {
      labelType: labelType || 'BOTH',
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
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

// Description: Bulk update shipping statuses for all active bookings from DHL API (admin/staff only)
// Endpoint: PUT /api/bookings/shipping-status/bulk-update
// Request: {}
// Response: { success: boolean, total: number, updated: number, skipped: number, errors: number, results: Array }
export const bulkUpdateBookingShippingStatuses = async () => {
  try {
    const response = await api.put('/api/bookings/shipping-status/bulk-update')
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

// Description: Create shipping label for a booking (admin/staff only)
// Endpoint: POST /api/bookings/:id/shipping/create-label
// Request: { shipmentData: { weight, length, width, height, serviceType, receiverName, receiverAddress, etc. } }
// Response: { success: boolean, trackingNumber: string, labelUrl: string, estimatedDelivery: Date }
export const createBookingShippingLabel = async (bookingId: string, shipmentData: object): Promise<ShipmentResult> => {
  try {
    const response = await api.post(`/api/bookings/${bookingId}/shipping/create-label`, {
      shipmentData
    });
    return response.data;
  } catch (error: unknown) {
    throw toShippingLabelError(error);
  }
};

// Description: Lookup DHL pickup locations for booking shipping flow
// Endpoint: POST /api/bookings/:id/shipping/pickup-locations
// Request: { postalCode?: string, city?: string, street?: string, houseNumber?: string, countryCode?: string, radius?: number, limit?: number, locationType?: string }
// Response: { success: boolean, count: number, locations: Array, query: object }
export const lookupPickupLocationsForBooking = async (bookingId: string, query: any) => {
  try {
    const response = await api.post(`/api/bookings/${bookingId}/shipping/pickup-locations`, query);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

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
