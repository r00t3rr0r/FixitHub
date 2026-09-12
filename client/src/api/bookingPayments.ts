import api from './api';

export type BookingPaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'sepa'
  | 'credit_card'
  | 'debit_card'
  | 'paypal'
  | 'invoice';

export interface BookingPaymentAllocation {
  _id: string;
  invoiceId: string;
  invoiceNumber: string;
  allocatedAmount: number;
  allocatedAt: string;
  note?: string;
}

export interface BookingPayment {
  _id: string;
  amount: number;
  currency: string;
  paymentDate: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'disputed';
  paymentMethod: BookingPaymentMethod;
  transactionId: string;
  paymentReference?: string;
  note?: string;
  source?: 'manual' | 'gateway' | 'checkout' | 'paypal_import';
  refundAmount?: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  allocations: BookingPaymentAllocation[];
  paypalOrderId?: string;
  paypalCaptureId?: string;
  createdAt: string;
}

export interface BookingPaymentInvoice {
  _id: string;
  invoiceNumber: string;
  status: string;
  isCreditNote: boolean;
  total: number;
  paidAmount: number;
  openAmount: number;
  dueDate?: string;
  createdAt: string;
  isOpen: boolean;
}

export interface BookingPaymentSummary {
  orderValue: number;
  invoicedTotal: number;
  creditedTotal: number;
  receivedTotal: number;
  allocatedTotal: number;
  unallocatedTotal: number;
  invoiceOpenTotal: number;
  notInvoicedTotal: number;
  openOrderBalance: number;
  isOverpaid: boolean;
  isFullyPaid: boolean;
}

export interface BookingPaymentOverview {
  booking: {
    _id: string;
    bookingNumber: string;
    status: string;
    billingStatus: string;
    paymentStatus: string;
    totalCost: number;
    createdAt: string;
  };
  invoices: BookingPaymentInvoice[];
  payments: BookingPayment[];
  summary: BookingPaymentSummary;
  paymentMethods: BookingPaymentMethod[];
  importResult?: {
    imported: number;
    updated: number;
    linked: number;
    warning?: string;
  };
}

// The shared Axios instance resolves every status code, so failures are detected explicitly.
const unwrap = (response: { status: number; data?: { success?: boolean; error?: string } }): BookingPaymentOverview => {
  const payload = response?.data || {};
  if (response?.status >= 400 || payload.success === false) {
    throw new Error(payload.error || 'Die Zahlungsdaten konnten nicht verarbeitet werden.');
  }
  return payload as unknown as BookingPaymentOverview;
};

// Description: Get order value, invoices and payments of a booking in one call
// Endpoint: GET /api/bookings/:id/payments
export const getBookingPayments = async (bookingId: string) => {
  const response = await api.get(`/api/bookings/${bookingId}/payments`);
  return unwrap(response);
};

// Description: Record a manual payment for a booking
// Endpoint: POST /api/bookings/:id/payments
export const createBookingPayment = async (
  bookingId: string,
  data: {
    amount: number;
    paymentDate?: string;
    paymentMethod: BookingPaymentMethod;
    note?: string;
    paymentReference?: string;
    invoiceId?: string;
  }
) => {
  const response = await api.post(`/api/bookings/${bookingId}/payments`, data);
  return unwrap(response);
};

// Description: Import PayPal transactions and link existing PayPal payments to the booking
// Endpoint: POST /api/bookings/:id/payments/paypal/import
export const importBookingPaypalPayments = async (bookingId: string) => {
  const response = await api.post(`/api/bookings/${bookingId}/payments/paypal/import`, {});
  return unwrap(response);
};

// Description: Allocate a payment to an invoice of the booking
// Endpoint: POST /api/bookings/:id/payments/:paymentId/allocations
export const allocateBookingPayment = async (
  bookingId: string,
  paymentId: string,
  data: { invoiceId: string; amount?: number; note?: string }
) => {
  const response = await api.post(`/api/bookings/${bookingId}/payments/${paymentId}/allocations`, data);
  return unwrap(response);
};

// Description: Remove an invoice allocation from a payment
// Endpoint: DELETE /api/bookings/:id/payments/:paymentId/allocations/:allocationId
export const removeBookingPaymentAllocation = async (
  bookingId: string,
  paymentId: string,
  allocationId: string
) => {
  const response = await api.delete(`/api/bookings/${bookingId}/payments/${paymentId}/allocations/${allocationId}`);
  return unwrap(response);
};

// Description: Delete a manually recorded payment
// Endpoint: DELETE /api/bookings/:id/payments/:paymentId
export const deleteBookingPayment = async (bookingId: string, paymentId: string) => {
  const response = await api.delete(`/api/bookings/${bookingId}/payments/${paymentId}`);
  return unwrap(response);
};
