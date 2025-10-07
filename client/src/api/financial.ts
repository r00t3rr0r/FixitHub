import api from './api';

export interface Payment {
  _id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'disputed';
  paymentMethod: 'credit_card' | 'debit_card' | 'paypal' | 'stripe' | 'bank_transfer';
  transactionId: string;
  gatewayResponse: string;
  createdAt: string;
  processedAt?: string;
  refundedAt?: string;
  refundAmount?: number;
  refundReason?: string;
  disputeReason?: string;
  disputeStatus?: 'open' | 'under_review' | 'resolved' | 'closed';
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  orderId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string;
  sentAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  template: string;
  paymentTerms: string;
}

export interface InvoiceItem {
  _id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  type: 'service' | 'addon' | 'product' | 'fee';
}

export interface FinancialReport {
  period: string;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  grossMargin: number;
  orderRevenue: number;
  addonRevenue: number;
  productRevenue: number;
  refundAmount: number;
  disputeAmount: number;
  paymentMethodBreakdown: {
    method: string;
    amount: number;
    percentage: number;
  }[];
  monthlyTrends: {
    month: string;
    revenue: number;
    orders: number;
    avgOrderValue: number;
  }[];
}

export interface PaymentGateway {
  _id: string;
  name: string;
  provider: 'stripe' | 'paypal' | 'square' | 'authorize_net';
  isActive: boolean;
  configuration: {
    publicKey?: string;
    secretKey?: string;
    webhookUrl?: string;
    currency: string;
    processingFee: number;
    fraudProtection: boolean;
  };
  supportedMethods: string[];
  countries: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSearchResult {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  invoiceAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  paymentAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    sameAsInvoice: boolean;
  };
}

// Description: Search customers for invoice creation
// Endpoint: GET /api/admin/financial/customers/search
// Request: { query: string }
// Response: { customers: CustomerSearchResult[] }
export const searchCustomers = async (query: string) => {
  try {
    const response = await api.get('/api/admin/financial/customers/search', { params: { query } });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get all payments with filtering
// Endpoint: GET /api/admin/financial/payments
// Request: { status?: string, method?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number }
// Response: { payments: Payment[], totalPages: number, currentPage: number, totalAmount: number }
export const getPayments = async (filters: any = {}) => {
  try {
    const response = await api.get('/api/admin/financial/payments', { params: filters });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Process a refund for a payment
// Endpoint: POST /api/admin/financial/payments/:id/refund
// Request: { amount: number, reason: string }
// Response: { success: boolean, message: string, refund: object }
export const processRefund = async (paymentId: string, amount: number, reason: string) => {
  try {
    const response = await api.post(`/api/admin/financial/payments/${paymentId}/refund`, {
      amount,
      reason
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get all invoices with filtering
// Endpoint: GET /api/admin/financial/invoices
// Request: { status?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number }
// Response: { invoices: Invoice[], totalPages: number, currentPage: number, totalAmount: number }
export const getInvoices = async (filters: any = {}) => {
  try {
    const response = await api.get('/api/admin/financial/invoices', { params: filters });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create a new invoice
// Endpoint: POST /api/admin/financial/invoices
// Request: Partial<Invoice>
// Response: { success: boolean, invoice: Invoice }
export const createInvoice = async (invoiceData: Partial<Invoice>) => {
  try {
    const response = await api.post('/api/admin/financial/invoices', invoiceData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Send invoice to customer
// Endpoint: POST /api/admin/financial/invoices/:id/send
// Request: { email?: string, message?: string }
// Response: { success: boolean, message: string }
export const sendInvoice = async (invoiceId: string, email?: string, message?: string) => {
  try {
    const response = await api.post(`/api/admin/financial/invoices/${invoiceId}/send`, {
      email,
      message
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get financial reports
// Endpoint: GET /api/admin/financial/reports
// Request: { period?: string, dateFrom?: string, dateTo?: string }
// Response: { report: FinancialReport }
export const getFinancialReports = async (filters: any = {}) => {
  try {
    const response = await api.get('/api/admin/financial/reports', { params: filters });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get payment gateways
// Endpoint: GET /api/admin/financial/gateways
// Request: {}
// Response: { gateways: PaymentGateway[] }
export const getPaymentGateways = async () => {
  try {
    const response = await api.get('/api/admin/financial/gateways');
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update payment gateway configuration
// Endpoint: PUT /api/admin/financial/gateways/:id
// Request: Partial<PaymentGateway>
// Response: { success: boolean, gateway: PaymentGateway }
export const updatePaymentGateway = async (gatewayId: string, updates: Partial<PaymentGateway>) => {
  try {
    const response = await api.put(`/api/admin/financial/gateways/${gatewayId}`, updates);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};