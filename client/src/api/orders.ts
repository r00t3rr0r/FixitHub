import api from './api';
import { toShippingLabelError } from './shipping';
import type { OrderValueReconciliationDetails } from './orderServices';

export interface CustomerInfo {
  _id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  paymentMethods?: {
    type: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
    isDefault: boolean;
  }[];
  isActive: boolean;
  role: string;
  createdAt: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  bookingId?: string;
  customerId: CustomerInfo;
  guestInfo?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    isGuest?: boolean;
    billingAddress?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
    shippingAddress?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
  };
  deviceBrand: string;
  deviceModel: string;
  deviceType?: string;
  services: string[];
  addOns: AddOnService[];
  status: 'pending' | 'in-progress' | 'paused' | 'quality-check' | 'completed' | 'ready-for-pickup';
  estimatedCompletion: string;
  totalCost: number;
  // Money, gross-first: totalCost is the GROSS total AFTER discount, `discount` is
  // the gross discount already contained in it, netAmount/taxAmount are derived
  // from totalCost and taxRate is a PERCENT (19), never a fraction.
  discount?: number;
  appliedPromoCode?: string;
  originalGrossAmount?: number;
  dealerDiscountPercent?: number;
  dealerDiscountAmount?: number;
  netAmount?: number;
  taxAmount?: number;
  taxRate?: number;
  // Reconciliation of the stored position list prices with the discounted total.
  pricing?: OrderPricingSummary;
  createdAt: string;
  updatedAt?: string;
  photos: string[];
  customerNotes: string;
  staffNotes: string[];
  ePartNeedListEntries?: Array<{
    _id: string;
    partId: {
      _id: string;
      itemName: string;
      itemDescription: string;
      category: string;
      sku: string;
    };
    quantity: number;
    needListId?: {
      _id: string;
      name: string;
      status: 'draft' | 'ready' | 'ordered' | 'archived';
    } | null;
    needListName: string;
    needListStatus: 'draft' | 'ready' | 'ordered' | 'archived';
    targetType: 'existing' | 'new' | 'today';
    notes?: string;
    requestedAt: string;
    requestedBy?: {
      _id: string;
      name: string;
      email: string;
    } | null;
  }>;
  progress: number;
  timeline?: Array<{
    _id?: string;
    status?: string;
    description?: string;
    completedAt?: string;
    staffId?: string;
    staffName?: string;
  }>;
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'partial';
  // Device unlock information
  unlockPattern?: string[];
  unlockCode?: string;
  noLock?: boolean;
  unlockConfirmation?: {
    confirmedBy?: string;
    confirmedByName?: string;
    confirmedAt?: string;
    confirmationStatus?: 'verified' | 'incorrect' | 'unable-to-verify';
    notes?: string;
  };
  pickupConfirmation?: {
    confirmedBy?: string;
    confirmedByName?: string;
    confirmedAt?: string;
  };
  // Additional repair information from Step 3
  errorDescription?: string;
  waterDamage?: 'yes' | 'no' | 'dont-know' | '';
  previousRepairAttempts?: 'yes' | 'no' | 'dont-know' | '';
  previousRepairDetails?: string;
  itemCondition?: 'original' | 'refurbished' | '';
  imei?: string;
  serialNumber?: string;
  // Shipping and tracking information
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  trackingNumber?: string;
  carrier?: string;
  shippingStatus?: 'pending' | 'label-created' | 'shipped' | 'in-transit' | 'out-for-delivery' | 'delivered' | 'failed';
  shippingStatusDescription?: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  shippingLabelUrl?: string;
  shippingCost?: number;
  returnLabelUrl?: string;
  returnQRCodeUrl?: string;
  returnTrackingNumber?: string;
  returnShipmentId?: string;
  returnShipmentStatus?: 'pending' | 'label-created' | 'in-transit' | 'delivered' | 'failed' | '';
  returnShipmentStatusDescription?: string;
  returnCreatedAt?: string;
  returnReceivedAt?: string;
  // returnLabelUrl holds a full base64 PDF and is therefore NOT part of the order
  // detail payload; use this flag to decide whether a download can be offered.
  hasReturnLabel?: boolean;
  trackingEvents?: Array<{
    timestamp: string;
    location: string;
    status: string;
    description: string;
  }>;
  hasComplaint?: boolean;
  complaintReason?: string;
  complaintId?: string;
  complaintNumber?: string;
  complaintStatus?: string;
  complaintOrderId?: string;
  complaintOrderNumber?: string;
  isComplaintFollowup?: boolean;
  parentOrderId?: string;
  sourceComplaintId?: string;
}

// Money breakdown of an order, computed server-side (OrderService.buildOrderPricingSummary).
// This is the SINGLE AUTHORITY for the order money on the detail screen - the client
// renders it, it does not recompute it.
// positionsGross is the sum of the stored GROSS LIST prices of all positions,
// grossTotal is order.totalCost MINUS dealerDiscountAmount (the Haendlerrabatt is not
// yet contained in totalCost), so every discount is subtracted from the gross exactly
// once. netTotal = grossTotal / (1 + taxRate/100); taxRate is a PERCENT (19).
export interface OrderPricingSummary {
  positionsGross: number;
  servicesGross: number;
  addOnsGross: number;
  shopProductsGross: number;
  discount: number;
  appliedPromoCode?: string;
  // Aufteilung von `discount` (Summe bleibt `discount`): Kunden-/Händlerkondition in
  // Prozent und EUR sowie ein fester Aktionsrabatt (Gutscheincode).
  groupDiscountPercent?: number;
  groupDiscountAmount?: number;
  promoDiscountAmount?: number;
  // Herkunft der Kondition: none | customer | customer_group | settings_default | legacy
  conditionsSource?: string;
  conditionsAppliedAt?: string | null;
  dealerDiscountPercent: number;
  dealerDiscountAmount: number;
  grossTotal: number;
  netTotal: number;
  taxAmount: number;
  taxRate: number;
  positionsReconcile: boolean;
}

export interface CustomerOrderInvoice {
  _id: string;
  invoiceNumber?: string;
  status?: string;
  total?: number;
  createdAt?: string;
  dueDate?: string;
  isCreditNote?: boolean;
  orderId?: any;
  bookingId?: any;
  repairOrderIds?: any[];
  /** Zahlungsstand vom Server (fehlt bei älteren Antworten - dann nichts erfinden). */
  balance?: InvoiceBalanceView | null;
  paymentState?: string;
}

// ── Zahlungsstand eines Belegs ───────────────────────────────────────────────
// Der Server berechnet ihn EINMAL (PaymentService.buildInvoiceBalance) und liefert ihn
// in Liste und Detail als `balance` (+ `paymentState`). Die Oberfläche rendert ihn nur –
// sie rechnet nie `total - paidAmount` nach. Belegstatus (Versendet, Überfällig …) und
// Zahlungsstand (Teilbezahlt, Überzahlt …) sind getrennte Dimensionen.
export interface InvoiceBalanceView {
  total?: number;
  credited?: number;
  receivable?: number;
  allocated?: number;
  open?: number;
  overpaid?: number;
  received?: number;
  refundPending?: number;
  refunded?: number;
  refundsInProgress?: number;
  paymentState?: string;
}

export type InvoicePaymentTone = 'open' | 'partial' | 'paid' | 'overpaid' | 'credited' | 'unknown';

export interface InvoicePaymentSummary {
  /** false = der Server hat keinen Zahlungsstand geliefert; dann KEINE Beträge anzeigen. */
  known: boolean;
  tone: InvoicePaymentTone;
  /** Kurzlabel, z. B. "Teilbezahlt · offen 12,00 €" oder "Überzahlt · Erstattung offen 5,00 €". */
  label: string;
  open: number | null;
  received: number | null;
  refundPending: number | null;
  refundsInProgress: number | null;
}

const formatEuroAmount = (value: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0);

const readAmount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : null;
};

export const summarizeInvoicePayment = (
  invoice: { balance?: InvoiceBalanceView | null; paymentState?: string; isCreditNote?: boolean } | null | undefined
): InvoicePaymentSummary => {
  const balance = invoice?.balance;
  const unknown: InvoicePaymentSummary = {
    known: false, tone: 'unknown', label: '', open: null, received: null, refundPending: null, refundsInProgress: null,
  };
  if (!invoice || !balance || typeof balance !== 'object' || invoice.isCreditNote) return unknown;

  const open = readAmount(balance.open);
  const received = readAmount(balance.received ?? balance.allocated);
  const refundPending = readAmount(balance.refundPending ?? balance.overpaid);
  const refundsInProgress = readAmount(balance.refundsInProgress);
  if (open === null && received === null && refundPending === null) return unknown;

  const state = String(invoice.paymentState || balance.paymentState || '').toLowerCase();
  const base = { known: true, open, received, refundPending, refundsInProgress };

  if (state === 'overpaid' || (refundPending ?? 0) > 0.009) {
    return { ...base, tone: 'overpaid', label: `Überzahlt · Erstattung offen ${formatEuroAmount(refundPending ?? 0)}` };
  }
  if (state === 'credited') {
    return { ...base, tone: 'credited', label: 'Gutgeschrieben' };
  }
  if (state === 'paid' || ((open ?? 0) <= 0.009 && (received ?? 0) > 0.009)) {
    return { ...base, tone: 'paid', label: 'Bezahlt' };
  }
  if ((open ?? 0) <= 0.009) {
    // z. B. Beleg über 0,00 € - nichts offen, aber auch nichts eingegangen.
    return { ...base, tone: 'paid', label: 'Ausgeglichen' };
  }
  if (state === 'partially_paid' || ((received ?? 0) > 0.009 && (open ?? 0) > 0.009)) {
    return { ...base, tone: 'partial', label: `Teilbezahlt · offen ${formatEuroAmount(open ?? 0)}` };
  }
  return { ...base, tone: 'open', label: `Offen ${formatEuroAmount(open ?? 0)}` };
};

export const INVOICE_PAYMENT_TONE_CLASSES: Record<InvoicePaymentTone, string> = {
  open: 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800',
  partial: 'bg-orange-100 text-orange-800 border border-orange-200 dark:bg-orange-900/40 dark:text-orange-200 dark:border-orange-800',
  paid: 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/40 dark:text-green-200 dark:border-green-800',
  overpaid: 'bg-violet-100 text-violet-800 border border-violet-200 dark:bg-violet-900/40 dark:text-violet-200 dark:border-violet-800',
  credited: 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  unknown: 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

// Ergänzt Belege ohne `balance` um den Zahlungsstand aus der kundeneigenen Rechnungsliste
// GET /api/invoices - dieselbe Serverberechnung. GET /api/bookings/:id/invoices liefert
// balance/paymentState inzwischen selbst (BookingService.getBookingInvoices); dann entfällt
// dieser zweite Aufruf ganz. Er bleibt nur als Rückfall für ältere Antworten bzw. einen
// serverseitigen Ausfall der Saldenberechnung (balance: null). Belege, für die kein
// Zahlungsstand gefunden wird, bleiben OHNE balance (die Anzeige erfindet dann nichts).
export const attachInvoiceBalances = async <T extends { _id: string; balance?: InvoiceBalanceView | null; paymentState?: string }>(
  invoices: T[]
): Promise<T[]> => {
  const list = Array.isArray(invoices) ? invoices : [];
  if (list.length === 0 || list.every((invoice) => invoice && invoice.balance && typeof invoice.balance === 'object')) {
    return list;
  }
  try {
    const response = await api.get('/api/invoices?limit=500');
    const withBalance = Array.isArray(response?.data?.invoices) ? response.data.invoices : [];
    const byId = new Map<string, { balance?: InvoiceBalanceView | null; paymentState?: string }>();
    withBalance.forEach((entry: any) => {
      if (entry?._id && entry.balance) byId.set(String(entry._id), { balance: entry.balance, paymentState: entry.paymentState });
    });
    return list.map((invoice) => {
      if (invoice.balance && typeof invoice.balance === 'object') return invoice;
      const match = byId.get(String(invoice._id));
      return match ? { ...invoice, balance: match.balance, paymentState: match.paymentState } : invoice;
    });
  } catch (error) {
    console.error('Zahlungsstand der Rechnungen konnte nicht geladen werden:', error);
    return list;
  }
};

// Offene Erstattung (Überzahlung) aus Sicht EINES Auftrags. Eine Buchungs-/Sammelrechnung
// über mehrere Aufträge lässt sich keinem einzelnen Auftrag zurechnen - ihr Betrag wird
// getrennt als Beleg-Betrag ausgewiesen, statt bei jedem Auftrag der Buchung als dessen
// eigene Überzahlung zu erscheinen.
export interface RefundPendingByScope {
  /** Überzahlung aus Rechnungen, die nur diesen Auftrag betreffen. */
  orderAmount: number;
  /** Überzahlte Rechnungen, die mehrere Aufträge (bzw. die ganze Buchung) abdecken. */
  bookingLevel: Array<{ invoiceId: string; invoiceNumber: string; amount: number }>;
}

const idOfRef = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value._id || value.id || '');
};

export const splitRefundPendingByScope = (
  invoices: Array<{
    _id: string;
    invoiceNumber?: string;
    orderId?: any;
    repairOrderIds?: any[];
    bookingId?: any;
    isCreditNote?: boolean;
    balance?: InvoiceBalanceView | null;
    paymentState?: string;
  }>,
  orderId: string
): RefundPendingByScope => {
  const wanted = String(orderId || '');
  const result: RefundPendingByScope = { orderAmount: 0, bookingLevel: [] };
  (Array.isArray(invoices) ? invoices : []).forEach((invoice) => {
    const payment = summarizeInvoicePayment(invoice);
    const amount = payment.known ? Number(payment.refundPending ?? 0) : 0;
    if (!(amount > 0.009)) return;
    const coveredOrders = new Set(
      [idOfRef(invoice.orderId), ...(Array.isArray(invoice.repairOrderIds) ? invoice.repairOrderIds.map(idOfRef) : [])]
        .filter(Boolean)
    );
    // Beleg nur fuer ANDERE Auftraege der Buchung: gehoert weder zu diesem Auftrag noch
    // ist er ein Buchungsbeleg, der diesen Auftrag mit abdeckt.
    if (coveredOrders.size > 0 && !coveredOrders.has(wanted)) return;
    const onlyThisOrder = coveredOrders.size > 0 && [...coveredOrders].every((entry) => entry === wanted);
    if (onlyThisOrder) {
      result.orderAmount = Math.round((result.orderAmount + amount) * 100) / 100;
    } else {
      result.bookingLevel.push({
        invoiceId: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber || '',
        amount: Math.round(amount * 100) / 100,
      });
    }
  });
  return result;
};

export interface AddOnService {
  _id: string;
  name: string;
  description: string;
  price: number;
  status: 'pending' | 'in-progress' | 'completed';
  estimatedTime: string;
}

export interface ShopProduct {
  _id: string;
  productId: {
    _id: string;
    name: string;
    price: number;
    images: string[];
    category: string;
    brand: string;
    stock: number;
  };
  quantity: number;
  priceAtOrder: number;
  addedAt: string;
  addedBy: {
    _id: string;
    name: string;
    email: string;
  };
}

// Description: Get all orders for the current user
// Endpoint: GET /api/orders
// Request: {}
// Response: { orders: Order[] }
export const getOrders = async () => {
  console.log('API: Making request to /api/orders');
  try {
    const response = await api.get('/api/orders');
    console.log('API: Received response from /api/orders:', response);
    console.log('API: Response data:', response.data);
    return response.data;
  } catch (error) {
    console.error('API: Error in getOrders:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create a new repair order
// Endpoint: POST /api/orders
// Request: { deviceBrand: string, deviceModel: string, services: string[], addOns: string[], customerNotes: string, photos: File[] }
// Response: { success: boolean, orderId: string, orderNumber: string, message: string }
export const createOrder = async (orderData: any) => {
  console.log('createOrder called with data:', orderData);
  
  try {
    const response = await api.post('/api/orders', orderData);
    console.log('createOrder API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('createOrder API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get order details by ID
// Endpoint: GET /api/orders/:id
// Request: {}
// Response: { order: Order }
export const getOrderById = async (orderId: string) => {
  console.log('getOrderById called with ID:', orderId);

  try {
    const response = await api.get(`/api/orders/${orderId}`);
    console.log('getOrderById API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('getOrderById API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Download shipping label PDF for an order
// Endpoint: GET /api/orders/:id/shipping-label
// Response: PDF file blob
export const downloadOrderShippingLabel = async (orderId: string, filename?: string) => {
  const response = await api.get(`/api/orders/${orderId}/shipping-label`, {
    responseType: 'blob',
    transformResponse: undefined,
    validateStatus: (status: number) => status === 200,
  });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `versandlabel-${orderId}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// Description: Create a return label for an order that has no linked booking
// Endpoint: POST /api/orders/:id/return-label
// Response: { success: boolean, returnId, returnTrackingNumber, labelUrl, qrCodeUrl, order }
export const createOrderReturnLabel = async (orderId: string) => {
  try {
    const response = await api.post(`/api/orders/${orderId}/return-label`);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Abgleich der EINSENDUNG am Auftrag (DHL-Retoure bzw. Einsendelabel im
//              return*-Slot) nach unklarer DHL-Antwort oder verwaister Sperre - nur Admin.
// Endpoint: POST /api/orders/:id/return-label/reconcile (der Server liefert die Adresse
//           zusätzlich als shipments.inbound.reconcileUrl; diese wird bevorzugt)
// Request: { resolution: 'not-created' | 'created', trackingNumber?: string }
// Response: { success: boolean, shipments?: OrderShipmentsView }
// Fehler: wie toShippingLabelError (shipping.ts) mit code/status/details, damit die
// Oberfläche z. B. NO_RECONCILIATION_PENDING erkennen kann.
const isOwnOrderUrl = (url: string | undefined, orderId: string): url is string => {
  if (!url || typeof url !== 'string') return false;
  if (!url.startsWith(`/api/orders/${orderId}/`)) return false;
  const path = url.split(/[?#]/)[0];
  // Kein Pfad-Trick: '..'/'.'-Segmente, kodierte Punkte/Schrägstriche und Backslashes
  // würden nach der Normalisierung im Browser eine andere Adresse treffen.
  if (/\\|%2e|%2f|%5c/i.test(path)) return false;
  return !path.split('/').some((segment) => segment === '..' || segment === '.');
};

export const reconcileOrderInboundShipment = async (
  orderId: string,
  payload: { resolution: 'not-created' | 'created'; trackingNumber?: string },
  reconcileUrl?: string
): Promise<{ success: boolean; shipments?: any; message?: string }> => {
  // Nur eine Adresse DIESES Auftrags akzeptieren.
  const url = isOwnOrderUrl(reconcileUrl, orderId)
    ? reconcileUrl
    : `/api/orders/${orderId}/return-label/reconcile`;
  try {
    const response = await api.post(url, payload);
    return response.data;
  } catch (error: unknown) {
    throw toShippingLabelError(error);
  }
};

// Description: Download return label PDF for an order
// Endpoint: GET /api/orders/:id/return-label
// Response: PDF file blob
export const downloadOrderReturnLabel = async (orderId: string, filename?: string) => {
  const response = await api.get(`/api/orders/${orderId}/return-label`, {
    responseType: 'blob',
    transformResponse: undefined,
    validateStatus: (status: number) => status === 200,
  });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `ruecksendelabel-${orderId}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// Description: Load the invoices the AUTHENTICATED CUSTOMER may see for one order.
//              Uses the customer-scoped invoice endpoint (server/routes/invoiceRoutes.js
//              GET /api/invoices), which is hard-filtered to `customerId: req.user._id`
//              and excludes drafts - so no other customer's documents can be reached.
//              orderId/bookingId are passed as query parameters for the day the server
//              filters on them; until then the filtering happens here on an already
//              owner-scoped result set.
// Endpoint: GET /api/invoices?orderId=&bookingId=&limit=
// Response: { success: boolean, invoices: CustomerOrderInvoice[], count: number }
export const getCustomerInvoicesForOrder = async (
  orderId: string,
  bookingId?: string | null
): Promise<CustomerOrderInvoice[]> => {
  // ONE request for the documents, plus a balance request only as a fallback.
  // Booked order: GET /api/bookings/:id/invoices is server-side scoped to this
  // booking, runs an owner-or-staff check and excludes Entwuerfe for a customer
  // (server/routes/bookingRoutes.js). It is a true superset of what this page needs:
  // BookingService.getBookingInvoices matches bookingId OR orderId/repairOrderIds of
  // the booking's orders, so documents that are linked only to the ORDER (legacy
  // invoices and credit notes written before the bookingId copy landed) are included.
  // It also carries balance/paymentState per document, so attachInvoiceBalances below
  // normally issues NO second request; it only falls back to GET /api/invoices when a
  // document arrives without a balance (older server, or balance computation failed).
  // Standalone order: fall back to the owner-scoped list. The server does not filter
  // by orderId yet (it ignores the parameter), so the narrowing below still runs
  // locally; send the parameter anyway so it starts working the moment it lands.
  const fetchInvoices = async (): Promise<CustomerOrderInvoice[]> => {
    if (bookingId) {
      const response = await api.get(`/api/bookings/${bookingId}/invoices`);
      return Array.isArray(response?.data?.invoices) ? response.data.invoices : [];
    }
    const params = new URLSearchParams({ limit: '100', orderId });
    const response = await api.get(`/api/invoices?${params.toString()}`);
    return Array.isArray(response?.data?.invoices) ? response.data.invoices : [];
  };

  // Zahlungsstand kommt normalerweise schon mit den Belegen; nur Belege ohne balance
  // werden aus der Serverberechnung ergänzt (siehe attachInvoiceBalances).
  const invoices = await attachInvoiceBalances(await fetchInvoices());

  const idOf = (value: any): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return String(value._id || value.id || '');
  };

  const wantedOrderId = String(orderId || '');
  const wantedBookingId = String(bookingId || '');

  return invoices
    .filter((invoice) => {
      // Entwuerfe are never shown here. Both endpoints already drop them for a
      // customer; this keeps the promise if the helper is ever called as staff.
      if (String(invoice?.status || '').toLowerCase() === 'draft') return false;
      if (wantedOrderId && idOf(invoice.orderId) === wantedOrderId) return true;
      if (wantedOrderId && Array.isArray(invoice.repairOrderIds)
        && invoice.repairOrderIds.some((entry) => idOf(entry) === wantedOrderId)) return true;
      if (wantedBookingId && idOf(invoice.bookingId) === wantedBookingId) return true;
      return false;
    })
    .sort((a, b) => {
      const aDate = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });
};

// Description: Download an invoice PDF as the owning customer. The endpoint runs
//              assertInvoiceOwner (server/routes/invoiceRoutes.js) and refuses drafts,
//              so a customer can only ever fetch their own finalised documents.
// Endpoint: GET /api/invoices/:id/pdf
// Response: PDF file blob
export const downloadCustomerInvoicePdf = async (invoiceId: string, filename?: string) => {
  const response = await api.get(`/api/invoices/${invoiceId}/pdf`, {
    responseType: 'blob',
    transformResponse: undefined,
    validateStatus: (status: number) => status === 200,
  });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `rechnung-${invoiceId}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// Description: Get order progress timeline with milestone data
// Endpoint: GET /api/orders/:id/progress-timeline
// Request: {}
// Response: { stages: Array<{ id: string, label: string, status: string, date?: string }>, currentStage: string }
export const getOrderProgressTimeline = async (orderId: string) => {
  console.log('getOrderProgressTimeline called with ID:', orderId);

  try {
    const response = await api.get(`/api/orders/${orderId}/progress-timeline`);
    console.log('getOrderProgressTimeline API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('getOrderProgressTimeline API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// ── Positionsänderungen am Auftrag: Fehler und Bestätigung der Neuberechnung ──────
// Zusatzleistungen, Shop-Produkte und Gerätewechsel antworten bei einem Auftrag, dessen
// gespeicherter Wert nicht zu den Positionen passt, mit 409 ORDER_VALUE_NOT_RECONCILED und
// details (siehe api/orderServices.ts). Der Fehler behält code, status, details und response,
// damit die Oberfläche die Abweichung zeigen und die Bestätigung anbieten kann.
export interface OrderEditError extends Error {
  code?: string;
  status?: number;
  details?: (OrderValueReconciliationDetails & { confirmationOutdated?: boolean }) | Record<string, unknown>;
  response?: unknown;
}

export const toOrderEditError = (error: any): OrderEditError => {
  const data = error?.response?.data || error?.data || {};
  const wrapped: OrderEditError = new Error(
    data?.error || error?.message || 'Die Änderung konnte nicht gespeichert werden.'
  );
  wrapped.code = data?.code || error?.code || undefined;
  wrapped.status = error?.response?.status ?? error?.status;
  wrapped.details = data?.details || undefined;
  wrapped.response = error?.response;
  return wrapped;
};

// Bestätigung einer Neuberechnung, GEBUNDEN an die gezeigte Abweichung: der Server rechnet
// nur neu, solange der Auftrag noch genau diese Abweichung hat (sonst frische 409 mit
// details.confirmationOutdated und den neuen Werten).
export interface OrderRepricingOptions {
  confirmRepricing?: boolean;
  repricingBasis?: { storedTotal: number; expectedTotal: number } | null;
}

export const buildRepricingConfirmation = (
  details?: Pick<OrderValueReconciliationDetails, 'storedTotal' | 'expectedTotal'> | null
): OrderRepricingOptions => ({
  confirmRepricing: true,
  ...(details ? { repricingBasis: { storedTotal: Number(details.storedTotal), expectedTotal: Number(details.expectedTotal) } } : {}),
});

// Nur gesetzte Bestätigungen gehen an den Server (kein confirmRepricing: false im Body).
export const repricingPayload = (options?: OrderRepricingOptions | null): Record<string, unknown> =>
  options?.confirmRepricing === true
    ? { confirmRepricing: true, ...(options.repricingBasis ? { repricingBasis: options.repricingBasis } : {}) }
    : {};

// Hat der Server die Bestätigung abgelehnt, weil sich der Auftrag seit der Anzeige geändert hat?
export const isRepricingConfirmationOutdated = (error: any): boolean =>
  Boolean((error?.details || error?.response?.data?.details)?.confirmationOutdated);

// Description: Add shop product to order
// Endpoint: POST /api/admin/orders/:id/shop-products
// Request: { productId: string, quantity: number, confirmRepricing?: boolean,
//            repricingBasis?: { storedTotal: number, expectedTotal: number } }
// Response: { success: boolean, message: string, order: Order }
// Fehler:  OrderEditError mit code/details (z. B. 409 ORDER_VALUE_NOT_RECONCILED)
export const addShopProductToOrder = async (
  orderId: string,
  productId: string,
  quantity: number,
  options?: OrderRepricingOptions
) => {
  console.log('addShopProductToOrder called with:', { orderId, productId, quantity });

  try {
    const response = await api.post(`/api/admin/orders/${orderId}/shop-products`, {
      productId,
      quantity,
      ...repricingPayload(options),
    });
    console.log('addShopProductToOrder API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('addShopProductToOrder API error:', error);
    throw toOrderEditError(error);
  }
};

// Description: Update shop product quantity in order
// Endpoint: PUT /api/admin/orders/:id/shop-products/:productItemId
// Request: { quantity: number, confirmRepricing?: boolean, repricingBasis? }
// Response: { success: boolean, message: string, order: Order }
// Fehler:  OrderEditError mit code/details (z. B. 409 ORDER_VALUE_NOT_RECONCILED)
export const updateShopProductQuantity = async (
  orderId: string,
  productItemId: string,
  quantity: number,
  options?: OrderRepricingOptions
) => {
  console.log('updateShopProductQuantity called with:', { orderId, productItemId, quantity });

  try {
    const response = await api.put(`/api/admin/orders/${orderId}/shop-products/${productItemId}`, {
      quantity,
      ...repricingPayload(options),
    });
    console.log('updateShopProductQuantity API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('updateShopProductQuantity API error:', error);
    throw toOrderEditError(error);
  }
};

// Description: Remove shop product from order
// Endpoint: DELETE /api/admin/orders/:id/shop-products/:productItemId
// Request: { confirmRepricing?: boolean, repricingBasis? } (Body)
// Response: { success: boolean, message: string, order: Order }
// Fehler:  OrderEditError mit code/details (z. B. 409 ORDER_VALUE_NOT_RECONCILED)
export const removeShopProductFromOrder = async (
  orderId: string,
  productItemId: string,
  options?: OrderRepricingOptions
) => {
  console.log('removeShopProductFromOrder called with:', { orderId, productItemId });

  try {
    const payload = repricingPayload(options);
    const response = await api.delete(
      `/api/admin/orders/${orderId}/shop-products/${productItemId}`,
      Object.keys(payload).length > 0 ? { data: payload } : undefined
    );
    console.log('removeShopProductFromOrder API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('removeShopProductFromOrder API error:', error);
    throw toOrderEditError(error);
  }
};

// Description: Create complaint for a completed order
// Endpoint: POST /api/orders/:orderId/complaint
// Request: { reason: string, description: string }
// Response: { success: boolean, complaint: Complaint }
export const createOrderComplaint = async (orderId: string, payload: { reason: string; description: string }) => {
  try {
    const response = await api.post(`/api/orders/${orderId}/complaint`, payload);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};