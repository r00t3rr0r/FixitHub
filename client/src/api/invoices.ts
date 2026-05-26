import api from './api';

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  orderId?: {
    _id: string;
    orderNumber: string;
    deviceBrand: string;
    deviceModel: string;
    status: string;
  };
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: 'draft' | 'pending_approval' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'credited';
  dueDate: string;
  sentAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  template: string;
  paymentTerms: string;
  contactPerson?: string;
  billingAddress?: string | {
    street?: string;
    city?: string;
    zip?: string;
    country?: string;
  };
  paymentMethod?: string;
  amountPaid?: number;
  paidAmount?: number;
  paymentHistory?: Array<{
    _id?: string;
    date: string;
    amount: number;
    method?: string;
    note?: string;
  }>;
}

export interface InvoiceItem {
  _id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  type: 'service' | 'addon' | 'product' | 'fee';
  discount?: number;
  taxRate?: number;
}

export interface InvoiceStats {
  totalInvoices: number;
  paidInvoices: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
}

export interface InvoicePaymentGateway {
  _id: string;
  name: string;
  provider: 'stripe' | 'paypal' | 'bank_transfer';
  supportedMethods: string[];
  currency: string;
  processingFee: number;
  configuration: {
    mode?: string;
    payment_mode?: string;
    success_url?: string;
    cancel_url?: string;
    return_url?: string;
    account_holder?: string;
    iban?: string;
    bic?: string;
    bank_name?: string;
    payment_reference_template?: string;
    payment_term_days?: number;
    title?: string;
    description_checkout?: string;
  };
}

export interface InvoicePaymentPayload {
  amount: number;
  gatewayId: string;
  gatewayProvider: 'stripe' | 'paypal' | 'bank_transfer';
  paymentData: Record<string, any>;
  isJsSdk?: boolean;
}

export interface InvoicePaymentInitializationResponse {
  success: boolean;
  provider: 'stripe' | 'paypal';
  gatewayId: string;
  redirectUrl: string;
  providerReference: string;
}

// Description: Get all invoices for the authenticated customer
// Endpoint: GET /api/invoices
// Request: { status?: string, limit?: number, skip?: number }
// Response: { success: boolean, invoices: Invoice[], count: number }
export const getCustomerInvoices = async (filters?: {
  status?: string;
  limit?: number;
  skip?: number;
}) => {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.skip) params.append('skip', filters.skip.toString());

    const queryString = params.toString();
    const endpoint = queryString ? `/api/invoices?${queryString}` : '/api/invoices';

    const response = await api.get(endpoint);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get a specific invoice by ID
// Endpoint: GET /api/invoices/:id
// Request: {}
// Response: { success: boolean, invoice: Invoice }
export const getInvoice = async (invoiceId: string) => {
  try {
    const response = await api.get(`/api/invoices/${invoiceId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Mark invoice as viewed by customer
// Endpoint: PUT /api/invoices/:id/view
// Request: {}
// Response: { success: boolean, invoice: Invoice }
export const markInvoiceAsViewed = async (invoiceId: string) => {
  try {
    const response = await api.put(`/api/invoices/${invoiceId}/view`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get invoice statistics for customer
// Endpoint: GET /api/invoices/stats/summary
// Request: {}
// Response: { success: boolean, stats: InvoiceStats }
export const getInvoiceStats = async () => {
  try {
    const response = await api.get('/api/invoices/stats/summary');
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get active customer-facing payment gateways for invoice payments
// Endpoint: GET /api/invoices/payment-gateways
// Request: {}
// Response: { success: boolean, gateways: InvoicePaymentGateway[] }
export const getInvoicePaymentGateways = async () => {
  try {
    const response = await api.get('/api/invoices/payment-gateways');
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Pay an invoice via configured payment gateway
// Endpoint: POST /api/invoices/:id/pay
// Request: InvoicePaymentPayload
// Response: { success: boolean, invoice: Invoice, payment: object }
export const payInvoice = async (invoiceId: string, payload: InvoicePaymentPayload) => {
  try {
    const response = await api.post(`/api/invoices/${invoiceId}/pay`, payload);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Initialize redirect/token based payment (Stripe/PayPal)
// Endpoint: POST /api/invoices/:id/payments/initialize
// Request: InvoicePaymentPayload
// Response: InvoicePaymentInitializationResponse
export const initializeInvoicePayment = async (invoiceId: string, payload: InvoicePaymentPayload) => {
  try {
    const response = await api.post(`/api/invoices/${invoiceId}/payments/initialize`, payload);
    return response.data as InvoicePaymentInitializationResponse;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Confirm redirected payment and book it to invoice
// Endpoint: POST /api/invoices/:id/payments/confirm
// Request: { gatewayProvider, gatewayId, providerReference, amount? }
// Response: { success: boolean, invoice: Invoice, payment: object, remainingAmount: number }
export const confirmInvoicePayment = async (
  invoiceId: string,
  payload: {
    gatewayProvider: 'stripe' | 'paypal';
    gatewayId: string;
    providerReference: string;
    amount?: number;
  }
) => {
  try {
    const response = await api.post(`/api/invoices/${invoiceId}/payments/confirm`, payload);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export interface InvoicePaypalSdkConfig {
  clientId: string;
  currency: string;
  intent: string;
  locale: string;
  gatewayId: string;
  environment: string;
  button: {
    layout: string;
    color: string;
    shape: string;
    label: string;
  };
}

// Description: Get PayPal JS SDK public config for invoice payment
// Endpoint: GET /api/invoices/paypal/config
// Request: { gatewayId?: string }
// Response: { success: boolean } & InvoicePaypalSdkConfig
export const getInvoicePaypalConfig = async (gatewayId?: string): Promise<InvoicePaypalSdkConfig> => {
  try {
    const url = gatewayId
      ? `/api/invoices/paypal/config?gatewayId=${encodeURIComponent(gatewayId)}`
      : '/api/invoices/paypal/config';
    const response = await api.get(url);
    return response.data as InvoicePaypalSdkConfig;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};
