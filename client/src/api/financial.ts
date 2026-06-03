import api from './api';

export type InvoiceStatus =
  | 'draft' | 'pending_approval' | 'sent' | 'viewed'
  | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'credited';

export interface Payment {
  _id: string;
  orderId?: string;
  invoiceId?: string;
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
  refundMode?: 'gateway' | 'manual';
  refundGatewayProvider?: PaymentGateway['provider'] | 'manual';
  refundGatewayReference?: string;
  disputeReason?: string;
  disputeStatus?: 'open' | 'under_review' | 'resolved' | 'closed';
  metadata?: Record<string, unknown>;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  numberPrefix?: string;
  orderId?: string;
  repairOrderIds?: string[];
  bookingId?: string;
  creditNoteOf?: string;
  isCreditNote?: boolean;
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  status: InvoiceStatus;
  dunningLevel?: number;
  dunningNotifiedAt?: string;
  dueDate: string;
  sentAt?: string;
  approvedAt?: string;
  paidAt?: string;
  cancelledAt?: string;
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
  type: 'service' | 'addon' | 'product' | 'fee' | 'discount';
}

export interface DunningAction {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  dunningLevel: number;
  daysPastDue: number;
  amount: number;
  action: string;
}

export interface DunningRunItem {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail?: string;
  dueDate?: string;
  amountOpen: number;
  dunningLevel?: number;
  status: 'pending' | 'processing' | 'sent' | 'escalated' | 'skipped' | 'failed';
  note?: string;
  lastActionAt?: string;
}

export interface DunningRun {
  _id: string;
  name: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
  defaultStatus: InvoiceStatus;
  defaultNote?: string;
  items: DunningRunItem[];
  logs: Array<{
    at: string;
    type: string;
    message: string;
    invoiceId?: string;
  }>;
  createdAt: string;
  updatedAt: string;
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
  provider: 'stripe' | 'paypal' | 'square' | 'authorize_net' | 'bank_transfer' | 'cash';
  isActive: boolean;
  configuration: {
    publicKey?: string;
    secretKey?: string;
    webhookUrl?: string;
    currency: string;
    processingFee: number;
    fraudProtection: boolean;
    environment?: 'sandbox' | 'live';
    sandbox_client_id?: string;
    sandbox_client_secret?: string;
    live_client_id?: string;
    live_client_secret?: string;
    merchant_id?: string;
    api_base_url_sandbox?: string;
    api_base_url_live?: string;
    sandbox_portal_url?: string;
    sandbox_region?: string;
    sandbox_account_email?: string;
    sandbox_account_password?: string;
    default_currency?: string;
    allowed_currencies?: string[];
    payment_intent?: 'CAPTURE' | 'AUTHORIZE';
    amount_source?: 'system' | 'manual';
    send_breakdown?: boolean;
    description_template?: string;
    invoice_id_source?: 'orderId' | 'uuid';
    return_url?: string;
    cancel_url?: string;
    button_enabled?: boolean;
    button_layout?: 'vertical' | 'horizontal';
    button_color?: 'gold' | 'blue' | 'silver';
    button_shape?: 'rect' | 'pill';
    button_label?: 'paypal' | 'pay' | 'checkout';
    locale?: string;
    funding_sources_allowed?: string[];
    webhooks_enabled?: boolean;
    webhook_url?: string;
    webhook_events?: string[];
    webhook_id?: string;
    http_timeout_ms?: number;
    http_max_retries?: number;
    idempotency_enabled?: boolean;
    idempotency_key_source?: 'orderId' | 'uuid';
    logging_level?: 'none' | 'error' | 'debug';
    log_request_bodies?: boolean;
    log_response_bodies?: boolean;
    list_page_size_default?: number;
    list_max_page_size?: number;
    mode?: 'test' | 'live';
    test_publishable_key?: string;
    test_secret_key?: string;
    live_publishable_key?: string;
    live_secret_key?: string;
    account_id?: string;
    api_version?: string;
    use_stripe_checkout?: boolean;
    payment_mode?: 'payment' | 'subscription';
    capture_method?: 'automatic' | 'manual';
    statement_descriptor?: string;
    success_url?: string;
    allowed_payment_methods?: string[];
    allow_saved_payment_method?: boolean;
    payment_method_config_id?: string;
    automatic_payment_methods?: boolean;
    billing_address_collection?: 'auto' | 'required';
    shipping_address_collection?: boolean;
    customer_creation?: 'always' | 'if_required' | 'none';
    webhook_endpoint_secret?: string;
    webhook_tolerance_sec?: number;
    // bank_transfer fields
    enabled?: boolean;
    code?: string;
    title?: string;
    description_checkout?: string;
    account_holder?: string;
    iban?: string;
    bic?: string;
    bank_name?: string;
    payment_reference_template?: string;
    payment_term_days?: number;
    min_order_total?: number;
    max_order_total?: number;
    allowed_customer_groups?: string[];
    allowed_countries?: string[];
    allowed_shipping_methods?: string[];
    initial_order_status?: string;
    expire_unpaid_orders?: boolean;
    expire_action?: 'cancel' | 'mark_expired' | 'none';
    email_instructions_enabled?: boolean;
    email_instructions_text?: string;
    admin_can_mark_paid?: boolean;
    mark_paid_requires_fields?: string[];
    reporting_tag?: string;
    // cash fields
    cash_mode?: 'pickup' | 'delivery' | 'both';
    allowed_product_types?: string[];
    mark_paid_on_fulfillment?: boolean;
    cash_receipt_number_enabled?: boolean;
    cash_receipt_number_format?: string;
    fee_type?: 'none' | 'surcharge' | 'discount';
    fee_value?: number;
    fee_is_percentage?: boolean;
    sort_order?: number;
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

// ── Customer Search ──────────────────────────────────────────────────────────
export const searchCustomers = async (query: string) => {
  try {
    const response = await api.get('/api/admin/financial/customers/search', { params: { query } });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// ── Payments ──────────────────────────────────────────────────────────────────
export const getPayments = async (filters: any = {}) => {
  try {
    const response = await api.get('/api/admin/financial/payments', { params: filters });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const processRefund = async (
  paymentId: string,
  amount: number,
  reason: string,
  options?: {
    mode?: 'gateway' | 'manual';
    gatewayProvider?: PaymentGateway['provider'];
    gatewayReference?: string;
  }
) => {
  try {
    const response = await api.post(`/api/admin/financial/payments/${paymentId}/refund`, {
      amount,
      reason,
      ...options
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// ── Invoices ──────────────────────────────────────────────────────────────────
export const getInvoices = async (filters: any = {}) => {
  try {
    const response = await api.get('/api/admin/financial/invoices', { params: filters });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const getInvoiceDetails = async (invoiceId: string): Promise<{
  invoice: Invoice & { creditNoteOf?: Partial<Invoice> | string };
  payments: Payment[];
  creditNotes: Partial<Invoice>[];
}> => {
  try {
    const response = await api.get(`/api/admin/financial/invoices/${invoiceId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const createInvoice = async (invoiceData: Partial<Invoice>) => {
  try {
    const response = await api.post('/api/admin/financial/invoices', invoiceData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const generateInvoiceFromRepairs = async (
  repairOrderIds: string[],
  options?: Partial<{
    taxRate: number;
    discount: number;
    dueDate: string;
    paymentTerms: string;
    notes: string;
    numberPrefix: string;
  }>
) => {
  try {
    const response = await api.post('/api/admin/financial/invoices/from-repairs', { repairOrderIds, options });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const changeInvoiceStatus = async (invoiceId: string, status: InvoiceStatus, notes?: string) => {
  try {
    const response = await api.patch(`/api/admin/financial/invoices/${invoiceId}/status`, { status, notes });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const addInvoicePayment = async (
  invoiceId: string,
  paymentData: {
    amount: number;
    currency?: string;
    paymentMethod: string;
    gatewayResponse?: string;
    metadata?: Record<string, unknown>;
  }
) => {
  try {
    const response = await api.post(`/api/admin/financial/invoices/${invoiceId}/payments`, paymentData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const createCreditNote = async (invoiceId: string, options: {
  reason?: string;
  taxRate?: number;
  discount?: number;
  dueDate?: string;
  numberPrefix?: string;
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    type: InvoiceItem['type'];
  }>;
}) => {
  try {
    const response = await api.post(`/api/admin/financial/invoices/${invoiceId}/credit-note`, options);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const getOverdueInvoices = async () => {
  try {
    const response = await api.get('/api/admin/financial/invoices/overdue');
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const runDunningJob = async () => {
  try {
    const response = await api.post('/api/admin/financial/dunning/run');
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const createDunningRun = async (payload: {
  name: string;
  defaultStatus?: InvoiceStatus;
  defaultNote?: string;
  invoiceIds: string[];
  status?: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
}) => {
  try {
    const response = await api.post('/api/admin/financial/dunning/runs', payload);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const getDunningRuns = async (filters: { status?: string } = {}) => {
  try {
    const response = await api.get('/api/admin/financial/dunning/runs', { params: filters });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const getDunningRunById = async (runId: string) => {
  try {
    const response = await api.get(`/api/admin/financial/dunning/runs/${runId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const updateDunningRun = async (runId: string, updates: Partial<{
  name: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
  defaultStatus: InvoiceStatus;
  defaultNote: string;
  logType: string;
  logMessage: string;
}>) => {
  try {
    const response = await api.patch(`/api/admin/financial/dunning/runs/${runId}`, updates);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const updateDunningRunItem = async (
  runId: string,
  invoiceId: string,
  updates: Partial<{
    status: DunningRunItem['status'];
    note: string;
    amountOpen: number;
    logMessage: string;
  }>
) => {
  try {
    const response = await api.patch(`/api/admin/financial/dunning/runs/${runId}/items/${invoiceId}`, updates);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const addDunningRunItem = async (runId: string, invoiceId: string) => {
  try {
    const response = await api.post(`/api/admin/financial/dunning/runs/${runId}/items`, { invoiceId });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const sendInvoice = async (invoiceId: string, email?: string, message?: string) => {
  try {
    const response = await api.post(`/api/admin/financial/invoices/${invoiceId}/send`, { email, message });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const exportPayments = async (filters: any = {}, format: 'csv' | 'json' = 'csv') => {
  try {
    const response = await api.get('/api/admin/financial/export/payments', {
      params: { ...filters, format },
      responseType: format === 'csv' ? 'blob' : 'json'
    });
    return response;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const exportInvoicesData = async (filters: any = {}, format: 'csv' | 'json' = 'csv') => {
  try {
    const response = await api.get('/api/admin/financial/export/invoices', {
      params: { ...filters, format },
      responseType: format === 'csv' ? 'blob' : 'json'
    });
    return response;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// ── Reports ───────────────────────────────────────────────────────────────────
export const getFinancialReports = async (filters: any = {}) => {
  try {
    const response = await api.get('/api/admin/financial/reports', { params: filters });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// ── Payment Gateways ──────────────────────────────────────────────────────────
export const getPaymentGateways = async () => {
  try {
    const response = await api.get('/api/admin/financial/gateways');
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const updatePaymentGateway = async (gatewayId: string, updates: Partial<PaymentGateway>) => {
  try {
    const response = await api.put(`/api/admin/financial/gateways/${gatewayId}`, updates);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};
