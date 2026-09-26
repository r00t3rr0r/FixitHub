import type { AxiosRequestConfig } from 'axios';
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
  /** NETTO-Gesamtbetrag (der Server rechnet brutto-first). */
  subtotal: number;
  /** Aus dem Brutto herausgerechnete MwSt. */
  tax: number;
  /** BRUTTO-Rabattbetrag, immer positiv gespeichert. */
  discount: number;
  /** BRUTTO-Gesamtbetrag. */
  total: number;
  /** Spiegelfelder des Invoice-Modells - bevorzugt fuer die Anzeige. */
  invoiceNetTotal?: number;
  invoiceTaxTotal?: number;
  invoiceGrossTotal?: number;
  isCreditNote?: boolean;
  creditNoteOfNumber?: string;
  status: 'draft' | 'pending_approval' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'credited';
  dueDate: string;
  sentAt?: string;
  paidAt?: string;
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
  contactPerson?: string;
  billingAddress?: string | {
    street?: string;
    city?: string;
    zip?: string;
    zipCode?: string;
    country?: string;
    state?: string;
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
  /** GET /api/invoices/:id: Buchung zum Beleg (Sprung "Bestellung"), sonst null. */
  bookingReference?: { _id: string; bookingNumber: string } | null;
  /** GET /api/invoices/:id: ausgestellte Gutschriften/Storno-Gutschriften zu dieser Rechnung. */
  relatedCreditNotes?: Array<{
    _id: string;
    invoiceNumber: string;
    total: number;
    correctionType?: 'full_cancellation' | 'partial_refund' | 'price_adjustment' | null;
    createdAt: string;
    status?: string;
  }>;
  creditNoteOf?: string | { _id: string; invoiceNumber?: string };
  correctionType?: 'full_cancellation' | 'partial_refund' | 'price_adjustment' | null;
  /** Storno-Datensatz eines stornierten Belegs (Grund, Zeitpunkt, Storno-Gutschrift). */
  cancellation?: {
    kind?: 'storno' | 'draft_discarded';
    state?: 'processing' | 'completed';
    reason?: string;
    completedAt?: string;
    creditNoteNumber?: string;
  };
}

export interface InvoiceItem {
  _id: string;
  serviceName?: string;
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
  paymentData: Record<string, unknown>;
  isJsSdk?: boolean;
}

export interface InvoicePaymentInitializationResponse {
  success: boolean;
  provider: 'stripe' | 'paypal';
  gatewayId: string;
  redirectUrl: string;
  providerReference: string;
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
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to fetch customer invoices'));
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
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to fetch invoice'));
  }
};

// Der PDF-Endpunkt antwortet ausschliesslich englisch ('Invoice not found', '... permission ...').
// Fuer die Oberflaeche wird deshalb NICHT der Servertext durchgereicht, sondern anhand des
// HTTP-Status eine deutsche Meldung gewaehlt.
export type InvoicePdfAction = 'download' | 'print';

const PDF_ACTION_VERBS: Record<InvoicePdfAction, string> = {
  download: 'herunterzuladen',
  print: 'zu drucken',
};

export const extractPdfErrorMessage = (error: unknown, action: InvoicePdfAction = 'download'): string => {
  const err = error as { status?: number; response?: { status?: number } };
  const status = err?.status ?? err?.response?.status;
  const verb = PDF_ACTION_VERBS[action];
  if (status === 401) return `Bitte melden Sie sich erneut an, um die Rechnung ${verb}.`;
  if (status === 403) return `Sie haben keine Berechtigung, diese Rechnung ${verb}.`;
  if (status === 404) return 'Die Rechnung wurde nicht gefunden.';
  if (status) return `Rechnungs-PDF konnte nicht geladen werden (HTTP ${status}).`;
  return 'Rechnungs-PDF konnte nicht geladen werden.';
};

// Gemeinsame Konfiguration fuer JEDEN Abruf von /api/invoices/:id/pdf (Download UND Druck).
// Die beiden Aufrufer teilen sie bewusst, damit der folgende Fallstrick nicht erneut
// einzeln nachgebaut wird:
//   * 'transformResponse: undefined' schaltet den Instanz-Transform NICHT ab. axios (1.18.1)
//     merged transformResponse mit defaultToConfig2 und faellt bei undefined auf die
//     Instanzkonfiguration zurueck - der JSON-Transform aus api.ts ruft dann data.trim() auf
//     einem Blob auf und wirft 'data.trim is not a function'. Nur ein expliziter
//     Identitaets-Transform laesst die Binaerdaten unveraendert durch.
//   * KEIN validateStatus-Override. Die Instanz akzeptiert jeden Status (validateStatus:
//     () => true) und der Response-Interceptor wirft fuer >= 400 einen ApiError mit .status.
//     Ein eigenes 'status === 200' wuerde stattdessen den axios-Fehlerpfad und damit den
//     401/403-Refresh-und-Logout-Zweig scharf schalten - ein 403 auf ein PDF wuerde den
//     Bearbeiter abmelden.
export const invoicePdfRequestConfig = (): AxiosRequestConfig => ({
  responseType: 'blob',
  transformResponse: [(data: unknown) => data],
});

// Ein JSON-Fehlerobjekt oder eine HTML-Fehlerseite waere ebenfalls ein Blob - Download und
// Druck wuerden daraus eine unbrauchbare Datei bzw. eine leere Druckvorschau erzeugen.
// Deshalb wird die PDF-Signatur geprueft, bevor die Daten verwendet werden.
export const toValidPdfBlob = async (payload: unknown): Promise<Blob> => {
  const raw = payload instanceof Blob ? payload : new Blob([payload as BlobPart]);
  const header = await raw.slice(0, 5).text().catch(() => '');
  if (!header.startsWith('%PDF')) {
    throw new Error('Der Server hat kein gültiges PDF geliefert.');
  }
  return new Blob([raw], { type: 'application/pdf' });
};

// Description: Download the canonical invoice PDF as a file
// Endpoint: GET /api/invoices/:id/pdf
// Auth: requireUser + assertInvoiceOwner (Admin/Staff sehen alle, Kunden nur eigene)
// Der Server liefert das PDF mit 'Content-Disposition: inline'. Der Download wird
// deshalb clientseitig ueber einen Blob + <a download> erzwungen - so bleibt die
// bestehende Vorschau-/Druckfunktion (invoicePrint.ts) unveraendert nutzbar.
export const downloadInvoicePdf = async (invoiceId: string, invoiceNumber?: string): Promise<void> => {
  if (!invoiceId) throw new Error('Rechnungs-ID fehlt.');

  let response;
  try {
    response = await api.get(`/api/invoices/${invoiceId}/pdf`, invoicePdfRequestConfig());
  } catch (error: unknown) {
    throw new Error(extractPdfErrorMessage(error, 'download'));
  }

  const pdfBlob = await toValidPdfBlob(response.data);

  const safeName = String(invoiceNumber || invoiceId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const blobUrl = URL.createObjectURL(pdfBlob);
  try {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `Rechnung_${safeName}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
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
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to mark invoice as viewed'));
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
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to fetch invoice stats'));
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
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to fetch payment gateways'));
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
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to pay invoice'));
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
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to initialize payment'));
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
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to confirm payment'));
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
  } catch (error: unknown) {
    throw new Error(extractErrorMessage(error, 'Failed to fetch PayPal config'));
  }
};
