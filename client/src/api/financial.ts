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
  paymentMethod: 'credit_card' | 'debit_card' | 'paypal' | 'stripe' | 'bank_transfer' | 'prepayment' | 'cash';
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
  /** Einzelne Erstattungsvorgaenge; nur 'completed' ist tatsaechlich zurueckgezahlt. */
  refunds?: PaymentRefundEntry[];
  /** Vom Server berechnet: Betrag nach abgeschlossenen Erstattungen. */
  effectiveAmount?: number;
  allocatedAmount?: number;
  /** Frei verfuegbarer, keiner Rechnung zugeordneter Rest (ohne laufende Erstattungen). */
  unallocatedAmount?: number;
  /** Beim Anbieter angestossene, noch nicht bestaetigte Erstattungen. */
  refundsInProgress?: number;
}

export interface PaymentRefundEntry {
  _id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  /** true = PayPal hat nicht eindeutig geantwortet; bleibt 'pending', bis abgeglichen. */
  unresolved?: boolean;
  /** PayPal-Request-Id dieses Versuchs (Wiederholung desselben Versuchs = dieselbe ID). */
  requestId?: string;
  attempt?: number;
  lastCheckedAt?: string;
  mode?: 'gateway' | 'manual';
  provider?: string;
  reference?: string;
  reason?: string;
  error?: string;
  createdAt?: string;
  completedAt?: string;
}

/**
 * Verbindlicher Zahlungsstand eines Belegs - vom Server EINMAL berechnet und in
 * Liste und Detail identisch geliefert. Der Client rechnet nicht selbst nach.
 */
export interface InvoiceBalance {
  /** Brutto des Belegs. */
  total: number;
  /** Wertmindernde Gutschriften (Preiskorrektur/Storno). */
  credited?: number;
  /** Tatsaechliche Forderung = Brutto - Gutschriften. */
  receivable?: number;
  /** Gueltig zugeordnete Zahlungen. */
  allocated: number;
  open: number;
  overpaid: number;
  /** Insgesamt fuer diesen Beleg eingegangen (auch der nicht zuordenbare Ueberhang). */
  received?: number;
  /** "Ueberzahlt / Erstattung offen": an den Kunden zurueckzuzahlender Betrag. */
  refundPending?: number;
  /** Bereits abgeschlossen erstattet. */
  refunded?: number;
  /** Beim Zahlungsanbieter angestossen, noch nicht bestaetigt. */
  refundsInProgress?: number;
  paymentState?: InvoicePaymentState;
}

export type InvoicePaymentState = 'open' | 'partially_paid' | 'paid' | 'overpaid' | 'credited';

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  /** LEGACY - wird vom Server vergeben und ist nicht mehr vom Client setzbar. */
  numberPrefix?: string;
  orderId?: string | { _id: string; orderNumber?: string; status?: string; deviceType?: string; deviceBrand?: string; deviceModel?: string };
  repairOrderIds?: (string | { _id: string; orderNumber?: string; status?: string; deviceType?: string; deviceBrand?: string; deviceModel?: string })[];
  bookingId?: string;
  /** Vom Server aufgeloeste Buchung (ueber orderId/repairOrderIds), falls bookingId leer ist. */
  resolvedBookingId?: string;
  creditNoteOf?: string | { _id: string; invoiceNumber?: string; total?: number; status?: InvoiceStatus; createdAt?: string };
  /** Eingefrorene Nummer der Ursprungsrechnung - bevorzugt fuer die Anzeige. */
  creditNoteOfNumber?: string;
  correctionType?: 'full_cancellation' | 'partial_refund' | 'price_adjustment';
  isCreditNote?: boolean;
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: InvoiceItem[];
  /** NETTO-Gesamtbetrag (der Server rechnet brutto-first). */
  subtotal: number;
  /** Herausgerechnete MwSt. */
  tax: number;
  /** BRUTTO-Rabattbetrag, immer positiv gespeichert. */
  discount: number;
  /** BRUTTO-Gesamtbetrag. */
  total: number;
  /** Gespiegelte Summen aus dem Invoice-Modell - bevorzugt fuer die Anzeige. */
  invoiceNetTotal?: number;
  invoiceTaxTotal?: number;
  invoiceGrossTotal?: number;
  paidAmount: number;
  status: InvoiceStatus;
  dunningLevel?: number;
  dunningStage?: 'none' | 'payment_reminder' | 'dunning_notice' | 'final_notice' | 'collection';
  dunningNotifiedAt?: string;
  originalDueDate?: string;
  nextDunningDueDate?: string;
  dueDate: string;
  sentAt?: string;
  approvedAt?: string;
  paidAt?: string;
  paymentMethod?: 'credit_card' | 'sepa' | 'paypal' | 'cash';
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  template: string;
  paymentTerms: string;
  isReverseCharge?: boolean;
  reverseChargeNotice?: string;
  customerVatId?: string;
  sellerVatId?: string;
  zmRelevant?: boolean;
  taxRate?: number;
  /** Die EINE gespeicherte Zahlungsbedingung (Tage); paymentTerms ist daraus abgeleitet. */
  paymentDueDays?: number;
  /** Zahlungsstand aus Liste/Detail (Server). */
  balance?: InvoiceBalance;
  paymentState?: InvoicePaymentState;
  /** Nur in der Mahnliste (GET /invoices/overdue): Mahnstand aus der Serverberechnung. */
  dunning?: InvoiceDunningState;
  /** Storno-Datensatz (ausgestellter Beleg storniert bzw. Entwurf verworfen). */
  cancellation?: {
    kind?: 'storno' | 'draft_discarded';
    state?: 'processing' | 'completed';
    reason?: string;
    requestedAt?: string;
    completedAt?: string;
    actorName?: string;
    previousStatus?: InvoiceStatus;
    creditNoteId?: string;
    creditNoteNumber?: string;
    allocatedAtCancellation?: number;
  };
  /** Revisionsspur der Belegaktionen (Storno, Versand, Archivierung, Mahnung). */
  auditTrail?: Array<{ at: string; action: string; actorName?: string; detail?: string }>;
}

export interface InvoiceDunningState {
  originalDueDate: string | null;
  daysOverdue: number;
  openAmount: number;
  currentStage: 'none' | 'payment_reminder' | 'dunning_notice' | 'final_notice' | 'collection';
  currentStageLabel: string;
  currentLevel: number;
  nextStage: string | null;
  nextStageLabel: string | null;
  nextEligibleDate: string | null;
  /** true = der naechste Mahnschritt ist jetzt zulaessig. */
  eligible: boolean;
  /** Deutscher Grund, warum (noch) kein Mahnschritt moeglich ist. */
  reason: string;
  lastFailure: { at: string | null; stage: string; stageLabel: string; error: string } | null;
}

export interface DunningStepResult {
  outcome: 'sent' | 'failed' | 'skipped';
  message: string;
  invoiceId: string;
  invoiceNumber: string;
  stage?: string;
  stageLabel?: string;
}

export interface InvoiceItem {
  _id: string;
  serviceName?: string;
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
  firstName?: string;
  lastName?: string;
  customerNumber?: string;
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

const extractErrorMessage = (error: unknown, fallback = 'Operation failed'): string => {
  if (error && typeof error === 'object') {
    // The response interceptor rejects with the raw AxiosResponse for status >= 400,
    // but network-level errors still arrive as an AxiosError with a nested `.response`.
    const err = error as { data?: { error?: string; message?: string }; response?: { data?: { error?: string; message?: string } } };
    const data = err.response?.data || err.data;
    if (data?.error) return data.error;
    if (data?.message) return data.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
};

// ── Customer Search ──────────────────────────────────────────────────────────
export const searchCustomers = async (query: string) => {
  try {
    const response = await api.get('/api/admin/financial/customers/search', { params: { query } });
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to search customers'));
  }
};

// ── Payments ──────────────────────────────────────────────────────────────────
export const getPayments = async (filters: Record<string, unknown> = {}) => {
  try {
    const response = await api.get('/api/admin/financial/payments', { params: filters });
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to fetch payments'));
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
    /** Gegen Doppelklick/Retry: gleicher Schluessel = gleiche Erstattung. */
    idempotencyKey?: string;
  }
): Promise<{
  success: boolean;
  message?: string;
  warning?: string;
  refund?: {
    _id: string;
    paymentId: string;
    amount: number;
    status: 'pending' | 'completed' | 'failed';
    mode: 'gateway' | 'manual';
    /** true = Ergebnis bei PayPal unklar (Zeitüberschreitung/Störung); zählt noch nicht als erstattet. */
    indeterminate?: boolean;
    gatewayProvider?: string;
    gatewayReference?: string;
    refundedTotal?: number;
    duplicate?: boolean;
  };
}> => {
  try {
    const response = await api.post(`/api/admin/financial/payments/${paymentId}/refund`, {
      amount,
      reason,
      ...options
    });
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Die Erstattung konnte nicht erfasst werden.'));
  }
};

// Abgleich eines ungeklaerten PayPal-Erstattungsversuchs (refunds[].unresolved) nach
// Pruefung im PayPal-Konto. 'executed' braucht die Erstattungs-ID aus dem PayPal-Konto.
// Endpoint: POST /api/admin/financial/payments/:id/refunds/:refundId/reconcile
export const reconcileRefund = async (
  paymentId: string,
  refundId: string,
  body: { resolution: 'executed' | 'not-executed'; providerRefundId?: string }
): Promise<{ success: boolean; message?: string; refund?: { _id: string; status: 'pending' | 'completed' | 'failed'; amount: number; refundedTotal?: number } }> => {
  try {
    const response = await api.post(`/api/admin/financial/payments/${paymentId}/refunds/${refundId}/reconcile`, body);
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Der Abgleich der Erstattung ist fehlgeschlagen.'));
  }
};

// ── Invoices ──────────────────────────────────────────────────────────────────
export const getInvoices = async (filters: Record<string, unknown> = {}) => {
  try {
    const response = await api.get('/api/admin/financial/invoices', { params: filters });
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to fetch invoices'));
  }
};

export const getInvoiceDetails = async (invoiceId: string): Promise<{
  invoice: Invoice & { creditNoteOf?: Partial<Invoice> | string };
  payments: Payment[];
  creditNotes: Partial<Invoice>[];
  balance?: InvoiceBalance | null;
}> => {
  try {
    const response = await api.get(`/api/admin/financial/invoices/${invoiceId}`);
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to fetch invoice details'));
  }
};

export const createInvoice = async (invoiceData: Partial<Invoice>) => {
  try {
    const response = await api.post('/api/admin/financial/invoices', invoiceData);
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to create invoice'));
  }
};

export const generateInvoiceFromRepairs = async (
  repairOrderIds: string[],
  options?: Partial<{
    /** PROZENTWERT (19), niemals ein Bruch (0.19). */
    taxRate: number;
    discount: number;
    dueDate: string;
    paymentTerms: string;
    notes: string;
    isReverseCharge: boolean;
    customerVatId: string;
    sellerVatId: string;
    reverseChargeNotice: string;
  }>
) => {
  try {
    const response = await api.post('/api/admin/financial/invoices/from-repairs', { repairOrderIds, options });
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to generate invoice from repair orders'));
  }
};

export const changeInvoiceStatus = async (
  invoiceId: string,
  status: InvoiceStatus,
  payload?: {
    notes?: string;
    paymentMethod?: Invoice['paymentMethod'];
    paidAt?: string;
    /** Nur fuer 'cancelled' auf einem Beleg mit gebuchtem Geld (Storno bestaetigt). */
    confirmPaidCancellation?: boolean;
  }
) => {
  try {
    const response = await api.patch(`/api/admin/financial/invoices/${invoiceId}/status`, {
      status,
      notes: payload?.notes,
      paymentMethod: payload?.paymentMethod,
      paidAt: payload?.paidAt,
      confirmPaidCancellation: payload?.confirmPaidCancellation === true,
    });
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to change invoice status'));
  }
};

// Rechnungsstorno: ausgestellter Beleg -> Storno-Gutschrift (INV-CN-...), Original bleibt.
// Endpoint: POST /api/admin/financial/invoices/:id/cancel
// 409 CANCELLATION_REQUIRES_CONFIRMATION, wenn bereits Geld gebucht ist (dann mit
// confirmPaidCancellation erneut senden - es wird nichts automatisch erstattet).
export const cancelInvoice = async (
  invoiceId: string,
  body: { reason: string; confirmPaidCancellation?: boolean; sendEmail?: boolean; message?: string }
): Promise<{
  success: boolean;
  message?: string;
  alreadyCancelled?: boolean;
  invoice?: Invoice;
  creditNote?: Invoice | null;
  allocatedAtCancellation?: number;
  balance?: InvoiceBalance;
  emailSent?: boolean;
  warning?: string;
}> => {
  try {
    const response = await api.post(`/api/admin/financial/invoices/${invoiceId}/cancel`, body);
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Die Rechnung konnte nicht storniert werden.'));
  }
};

// Entwurf verwerfen (kein Storno; die Nummer bleibt belegt, keine Gutschrift).
// Endpoint: POST /api/admin/financial/invoices/:id/discard
export const discardDraftInvoice = async (invoiceId: string, reason: string) => {
  try {
    const response = await api.post(`/api/admin/financial/invoices/${invoiceId}/discard`, { reason });
    return response.data as { success: boolean; message?: string; invoice?: Invoice; alreadyDiscarded?: boolean };
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Der Entwurf konnte nicht verworfen werden.'));
  }
};

// Einzelner Mahnschritt (dieselbe Serverlogik wie Mahnlauf und Cron).
// Endpoint: POST /api/admin/financial/dunning/invoices/:id/step
export const runDunningStep = async (invoiceId: string, customMessage?: string, recipientEmail?: string): Promise<{ success: boolean; message?: string; result?: DunningStepResult }> => {
  try {
    const response = await api.post(`/api/admin/financial/dunning/invoices/${invoiceId}/step`, { customMessage, recipientEmail });
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Der Mahnschritt konnte nicht ausgeführt werden.'));
  }
};

// Gespeicherten Mahnlauf ausfuehren (jeder Fall ueber dieselbe Serverlogik).
// Endpoint: POST /api/admin/financial/dunning/runs/:id/execute
export const executeDunningRun = async (runId: string, customMessage?: string): Promise<{
  success: boolean;
  run?: DunningRun;
  sent?: number;
  failed?: number;
  skipped?: number;
}> => {
  try {
    const response = await api.post(`/api/admin/financial/dunning/runs/${runId}/execute`, { customMessage });
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Der Mahnlauf konnte nicht ausgeführt werden.'));
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
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to add invoice payment'));
  }
};

export const createCreditNote = async (invoiceId: string, options: {
  reason?: string;
  /** PROZENTWERT (19), niemals ein Bruch (0.19). */
  taxRate?: number;
  /** Positiver BRUTTO-Rabattbetrag. */
  discount?: number;
  dueDate?: string;
  notifyCustomer?: boolean;
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
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to create credit note'));
  }
};

// Utility: Create invoice from a specific order
// Endpoint: POST /api/admin/financial/orders/:orderId/invoice
export const createInvoiceFromOrder = async (orderId: string) => {
  try {
    const response = await api.post(`/api/admin/financial/orders/${orderId}/invoice`);
    return response.data;
  } catch (error: unknown) {
    const err = error as { response?: { status?: number; data?: { error?: string; code?: string; existingInvoice?: { _id?: string; invoiceNumber?: string }; redirectTo?: string } }; message?: string };
    const apiError = new Error(err.response?.data?.error || err.message || 'Failed to create invoice from order') as Error & {
      status?: number;
      code?: string;
      existingInvoice?: { _id?: string; invoiceNumber?: string };
      existingInvoiceId?: string;
      existingInvoiceNumber?: string;
      redirectTo?: string;
    };
    apiError.status = err.response?.status;
    apiError.code = err.response?.data?.code;
    apiError.existingInvoice = err.response?.data?.existingInvoice;
    apiError.existingInvoiceId = err.response?.data?.existingInvoice?._id;
    apiError.existingInvoiceNumber = err.response?.data?.existingInvoice?.invoiceNumber;
    apiError.redirectTo = err.response?.data?.redirectTo;
    throw apiError;
  }
};

export const getOverdueInvoices = async () => {
  try {
    const response = await api.get('/api/admin/financial/invoices/overdue');
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to fetch overdue invoices'));
  }
};

export const runDunningJob = async () => {
  try {
    const response = await api.post('/api/admin/financial/dunning/run');
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to run dunning job'));
  }
};

export const activateCollection = async (invoiceId: string) => {
  try {
    const response = await api.post(`/api/admin/financial/dunning/invoices/${invoiceId}/collection`);
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to activate collection'));
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
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to create dunning run'));
  }
};

export const getDunningRuns = async (filters: { status?: string } = {}) => {
  try {
    const response = await api.get('/api/admin/financial/dunning/runs', { params: filters });
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to fetch dunning runs'));
  }
};

export const getDunningRunById = async (runId: string) => {
  try {
    const response = await api.get(`/api/admin/financial/dunning/runs/${runId}`);
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to fetch dunning run details'));
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
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to update dunning run'));
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
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to update dunning run item'));
  }
};

export const addDunningRunItem = async (runId: string, invoiceId: string) => {
  try {
    const response = await api.post(`/api/admin/financial/dunning/runs/${runId}/items`, { invoiceId });
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to add dunning run item'));
  }
};

export const sendInvoice = async (invoiceId: string, email?: string, message?: string) => {
  try {
    const response = await api.post(`/api/admin/financial/invoices/${invoiceId}/send`, { email, message });
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to send invoice'));
  }
};

export const exportPayments = async (filters: Record<string, unknown> = {}, format: 'csv' | 'json' = 'csv') => {
  try {
    const response = await api.get('/api/admin/financial/export/payments', {
      params: { ...filters, format },
      responseType: format === 'csv' ? 'blob' : 'json'
    });
    return response;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to export payments'));
  }
};

export const exportInvoicesData = async (filters: Record<string, unknown> = {}, format: 'csv' | 'json' = 'csv') => {
  try {
    const response = await api.get('/api/admin/financial/export/invoices', {
      params: { ...filters, format },
      responseType: format === 'csv' ? 'blob' : 'json'
    });
    return response;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to export invoices'));
  }
};

export interface ReconcileOverpaymentResult {
  success: boolean;
  isOverpaid: boolean;
  overpaidAmount: number;
  /** Wird nicht mehr erzeugt: eine Ueberzahlung aendert keinen Beleg. */
  creditNote?: null;
  refundStatus?: 'pending' | 'completed';
  refunds?: Array<{ _id: string; paymentId: string; amount: number; status: 'pending' | 'completed' | 'failed' }>;
  message?: string;
}

export const reconcileOverpayment = async (bookingId: string, options?: { amount?: number; reason?: string; processRefund?: boolean; refundMode?: 'manual' | 'gateway' }): Promise<ReconcileOverpaymentResult> => {
  try {
    const response = await api.post(`/api/admin/financial/bookings/${encodeURIComponent(bookingId)}/overpayment/reconcile`, options || {});
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Error reconciling overpayment'));
  }
};

export type PaymentRequestStatus =
  | 'pending'
  | 'accepted_by_provider'
  | 'failed'
  | 'skipped_no_recipient';

export interface PaymentRequestRecord {
  _id: string;
  bookingId?: string;
  bookingNumber?: string;
  /** 'invoice' = per Rechnungsnummer fuer genau diese Rechnung angefordert. */
  targetType?: 'invoice' | 'booking';
  invoiceId?: string;
  invoiceNumber?: string;
  amount?: number;
  openBalanceAtRequest?: number;
  /** Derzeit immer 'email' - es gibt keine PayPal-Zahlungsanforderung ueber die API. */
  channel?: 'email' | string;
  paymentLink?: string;
  noteDelivered?: boolean;
  templateName?: string;
  recipientEmail?: string;
  recipientName?: string;
  note?: string;
  status: PaymentRequestStatus;
  providerMessageId?: string;
  attempts?: number;
  error?: string;
  requestedAt: string;
  requestedBy?: { _id?: string; firstName?: string; lastName?: string; email?: string } | string;
}

export interface RequestAdditionalPaymentResult {
  success: boolean;
  /**
   * 'accepted_by_provider' bedeutet: der Mailserver hat die Nachricht angenommen.
   * Das ist KEINE Zustellbestaetigung.
   */
  status?: PaymentRequestStatus;
  code?: string;
  message?: string;
  recipientEmail?: string;
  amount?: number;
  openBalance?: number;
  requestId?: string;
  error?: string;
  isOverpaid?: boolean;
  channel?: 'email';
  targetType?: 'invoice' | 'booking';
  invoiceNumber?: string;
  paymentLink?: string;
  noteDelivered?: boolean;
  templateName?: string;
}

export const requestAdditionalPayment = async (
  bookingId: string,
  options?: { amount?: number; note?: string }
): Promise<RequestAdditionalPaymentResult> => {
  try {
    // Kennung darf Buchungs-, Auftrags- ODER Rechnungsnummer sein.
    const response = await api.post(`/api/admin/financial/bookings/${encodeURIComponent(bookingId)}/payment-request`, options || {});
    return response.data as RequestAdditionalPaymentResult;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Zahlungsaufforderung konnte nicht gesendet werden.'));
  }
};

/**
 * Verlauf der bereits versendeten Zahlungsaufforderungen einer Buchung.
 * Endpunkt wird vom Payments-Track geliefert; solange er fehlt, meldet der Aufruf
 * `available: false`, damit die UI einen ehrlichen Hinweis statt einer leeren
 * "Es wurde noch nichts gesendet"-Liste zeigt.
 */
export const getPaymentRequests = async (
  bookingId: string
): Promise<{ available: boolean; requests: PaymentRequestRecord[] }> => {
  try {
    const response = await api.get(`/api/admin/financial/bookings/${encodeURIComponent(bookingId)}/payment-requests`);
    const data = response.data as { requests?: PaymentRequestRecord[]; paymentRequests?: PaymentRequestRecord[] };
    return { available: true, requests: data?.requests || data?.paymentRequests || [] };
  } catch (error: unknown) {
    const status = (error as { status?: number; response?: { status?: number } })?.response?.status
      ?? (error as { status?: number })?.status;
    if (status === 404 || status === 501) {
      return { available: false, requests: [] };
    }
    throw new Error(extractErrorMessage(error, 'Verlauf der Zahlungsaufforderungen konnte nicht geladen werden.'));
  }
};

export const syncBookingFinancials = async (bookingId: string, type: 'booking' | 'order' = 'booking') => {
  try {
    const response = await api.post(`/api/admin/financial/bookings/${bookingId}/sync`, { type });
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Error syncing financials'));
  }
};

// ── Reports ───────────────────────────────────────────────────────────────────
export const getFinancialReports = async (filters: Record<string, unknown> = {}) => {
  try {
    const response = await api.get('/api/admin/financial/reports', { params: filters });
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to fetch financial reports'));
  }
};

// ── Payment Gateways ──────────────────────────────────────────────────────────
export const getPaymentGateways = async () => {
  try {
    const response = await api.get('/api/admin/financial/gateways');
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to fetch payment gateways'));
  }
};

export const updatePaymentGateway = async (gatewayId: string, updates: Partial<PaymentGateway>) => {
  try {
    const response = await api.put(`/api/admin/financial/gateways/${gatewayId}`, updates);
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to update payment gateway'));
  }
};
