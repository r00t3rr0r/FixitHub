import React, { useState, useEffect, useRef, useCallback } from "react";
import { SEO } from '@/components/SEO'
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useNavigationType, useSearchParams } from "react-router-dom";
import "./CustomerBookings.css";
import {
  Package,
  Smartphone,
  Clock,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Truck,
  QrCode,
  Download,
  Printer,
  MessageSquare,
  X,
  CreditCard,
  Home,
  Receipt,
  AlertCircle,
  Euro,
  Loader2,
  RotateCcw,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getBookings,
  getBookingOrders,
  getBooking,
  downloadBookingShippingLabel,
  getBookingInvoices,
  getBookingInboundLabel,
  createBookingInboundLabel,
  downloadInboundLabel,
  printInboundLabel,
  type InboundLabelView,
} from "@/api/bookings";
import { getCustomerBookingPayments, type CustomerBookingPaymentOverview } from "@/api/bookingPayments";
import { downloadInvoicePdf } from "@/api/invoices";
import { attachInvoiceBalances, summarizeInvoicePayment, INVOICE_PAYMENT_TONE_CLASSES } from "@/api/orders";
import { createOrderComplaint } from "@/api/orders";
import { getUnreadMessageCounts } from "@/api/inspectionCommunication";
import { useToast } from "@/hooks/useToast";
import { buildOrderDetailsState, getOrderDetailsPath } from "@/lib/orderDetailsNavigation";
import { formatEUR } from "@/lib/utils";
import { READY_NEUTRAL_LABEL } from "@/lib/returnMethod";

interface AddressFields {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

interface BookingItem {
  _id?: string;
  type: string;
  device?: string;
  orderId: string;
  orderNumber?: string;
  services?: Array<{
    name: string;
    price: number;
    estimatedTime?: number;
  }>;
  products?: Array<{
    name: string;
    quantity: number;
    price: number;
    totalPrice: number;
  }>;
  cost: number;
  status?: string;
  progress?: number;
  hasComplaint?: boolean;
  // Reklamations-Folgeauftrag (vom Server zur Lesezeit angehaengt, nicht in booking.items gespeichert)
  isComplaintFollowup?: boolean;
  parentOrderId?: string | null;
  parentOrderNumber?: string;
  readTimeItem?: boolean;
}

interface PaymentBalance {
  total?: number;
  reference?: number;
  open?: number;
  received?: number;
  overpaid?: number;
  refundPending?: number;
}

interface Booking {
  _id: string;
  bookingNumber: string;
  customerId: {
    _id: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    email: string;
    phone: string;
    avatar?: string;
    invoiceAddress?: AddressFields;
    paymentAddress?: AddressFields & { sameAsInvoice?: boolean };
  };
  guestInfo?: {
    billingAddress?: AddressFields;
    shippingAddress?: AddressFields;
  };
  billingAddress?: AddressFields;
  shippingAddress?: AddressFields;
  orderIds?: Array<{
    billingAddress?: AddressFields;
    shippingAddress?: AddressFields;
    guestInfo?: {
      billingAddress?: AddressFields;
      shippingAddress?: AddressFields;
    };
  }>;
  items: BookingItem[];
  totalCost: number;
  status: string;
  billingStatus: string;
  paymentStatus?: string;
  // Zahlungsstand vom Server (gleiche Berechnung wie in der Adminliste); null = unbekannt
  paymentBalance?: PaymentBalance | null;
  overallProgress: number;
  createdAt: string;
  updatedAt: string;
  returnLabelUrl?: string;
  returnQRCodeUrl?: string;
  returnTrackingNumber?: string;
  returnShipmentStatus?: string;
  returnShipmentStatusDescription?: string;
  returnCreatedAt?: string;
  returnReceivedAt?: string;
  trackingNumber?: string;
  carrier?: string;
  // Richtung des gespeicherten Versandlabels. 'inbound' = Einsendung an McRepair
  // (Hinweg), 'outbound' = Ruecksendung an den Kunden (Rueckweg). Kommt vom Server
  // (GET /api/bookings/:id); fehlt das Feld, gilt 'inbound'.
  shippingLabelDirection?: 'inbound' | 'outbound';
  shippingStatus?: string;
  shippingStatusDescription?: string;
  shippingLabelUrl?: string;
  shippingCreatedAt?: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  timeline?: Array<{
    _id?: string;
    status: string;
    title?: string;
    description: string;
    completedAt: string;
  }>;
  liveShippingTracking?: {
    status?: string;
    statusCodeRaw?: string;
    description?: string;
    estimatedDelivery?: string;
    service?: string;
    shipmentId?: string;
    events?: Array<{
      timestamp?: string;
      location?: string;
      status?: string;
      statusCode?: string;
      description?: string;
    }>;
  };
}

type DialogTab = 'payments' | 'shipping' | 'items' | 'timeline' | 'contact';

// ---------------------------------------------------------------------------------------
// Gemeinsame Anzeige-Regeln (Liste + Dialog)
// ---------------------------------------------------------------------------------------

/**
 * Sprungziel fuer "Rechnung oeffnen".
 * Das Ziel steht in der URL, damit ein kopierter Link und ein harter Reload
 * dieselbe Rechnung oeffnen - der zusaetzlich mitgegebene location.state bleibt
 * als Fallback fuer die reine In-App-Navigation erhalten.
 */
const buildInvoiceDeepLink = (invoiceId: string): string =>
  `/invoices?highlightInvoiceId=${encodeURIComponent(invoiceId)}&openInvoiceId=${encodeURIComponent(invoiceId)}`;

const getInvoiceStatusLabel = (status: string): string => {
  switch (status) {
    case 'draft': return 'Vorlage';
    case 'pending_approval': return 'Ausstehend';
    case 'sent': return 'Gesendet';
    case 'viewed': return 'Angesehen';
    case 'partially_paid': return 'Teilbezahlt';
    case 'paid': return 'Bezahlt';
    case 'overdue': return 'Überfällig';
    case 'cancelled': return 'Storniert';
    case 'credited': return 'Gutgeschrieben';
    default: return status;
  }
};

const getInvoiceStatusBadgeClass = (status: string): string => {
  switch (status) {
    case 'paid': return 'bg-green-100 text-green-700 border border-green-200';
    case 'partially_paid': return 'bg-blue-100 text-blue-700 border border-blue-200';
    case 'overdue': return 'bg-red-100 text-red-700 border border-red-200';
    case 'sent': return 'bg-purple-100 text-purple-700 border border-purple-200';
    case 'viewed': return 'bg-indigo-100 text-indigo-700 border border-indigo-200';
    case 'cancelled': return 'bg-gray-100 text-gray-500 border border-gray-200';
    case 'draft': return 'bg-gray-100 text-gray-600 border border-gray-200';
    default: return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
  }
};

// Deutsche Bezeichnungen fuer die Status-Enums von Buchung UND Auftrag. Dient als
// defaultValue fuer t('status.<wert>') - es erscheint nie ein roher i18n-Schluessel
// wie "status.diagnostic-assessment" (CUSTUX-4).
const STATUS_LABELS_DE: Record<string, string> = {
  pending: 'Ausstehend',
  'payment-pending': 'Zahlung ausstehend',
  processing: 'In Bearbeitung',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
  'diagnostic-assessment': 'Diagnosebewertung',
  diagnosed: 'Diagnose abgeschlossen',
  'awaiting-parts': 'Wartet auf Teile',
  'in-progress': 'Reparatur läuft',
  paused: 'Pausiert',
  'on-hold': 'Angehalten',
  'quality-check': 'Qualitätsprüfung',
  // Liste ohne Versandstand: neutral (Abholung/Versand zeigt die Auftragsansicht, lib/returnMethod).
  'ready-for-pickup': READY_NEUTRAL_LABEL,
};

const statusBadgeClass = (status: string): string => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-900 border border-yellow-300';
    case 'payment-pending': return 'bg-orange-100 text-orange-900 border border-orange-300';
    case 'processing':
    case 'in-progress': return 'bg-blue-100 text-blue-900 border border-blue-300';
    case 'diagnostic-assessment': return 'bg-purple-100 text-purple-900 border border-purple-300';
    case 'diagnosed': return 'bg-indigo-100 text-indigo-900 border border-indigo-300';
    case 'awaiting-parts': return 'bg-orange-100 text-orange-900 border border-orange-300';
    case 'paused':
    case 'on-hold': return 'bg-gray-100 text-gray-800 border border-gray-300';
    case 'quality-check': return 'bg-cyan-100 text-cyan-900 border border-cyan-300';
    case 'ready-for-pickup': return 'bg-teal-100 text-teal-900 border border-teal-300';
    case 'completed': return 'bg-green-100 text-green-900 border border-green-300';
    case 'cancelled': return 'bg-red-100 text-red-900 border border-red-300';
    default: return 'bg-gray-100 text-gray-800 border border-gray-300';
  }
};

// Versandstatus ist ein englischer Enum-Wert aus der Datenbank.
const getShippingStatusLabel = (status?: string) => {
  switch (status) {
    case 'pending': return 'Ausstehend';
    case 'label-created': return 'Label erstellt';
    case 'shipped': return 'Versendet';
    case 'in-transit': return 'Unterwegs';
    case 'out-for-delivery': return 'In Zustellung';
    case 'delivered': return 'Zugestellt';
    case 'failed': return 'Fehlgeschlagen';
    default: return status || 'Unbekannt';
  }
};

const getBillingStatusLabel = (status: string) => {
  switch (status) {
    case 'draft': return 'Vorlage';
    case 'sent': return 'Gesendet';
    case 'viewed': return 'Angesehen';
    case 'partially_paid':
    case 'partially-paid': return 'Teilbezahlt';
    case 'overdue': return 'Überfällig';
    case 'unpaid': return 'Offen';
    case 'overpaid': return 'Überzahlt';
    case 'paid': return 'Bezahlt';
    default: return status || 'Unbekannt';
  }
};

const getPaymentMethodLabel = (method?: string) => {
  switch (method) {
    case 'stripe':
    case 'card': return 'Karte';
    case 'paypal': return 'PayPal';
    case 'bank_transfer': return 'Überweisung';
    case 'cash': return 'Bar';
    case 'invoice': return 'Rechnung';
    case 'manual': return 'Manuell erfasst';
    default: return method || 'Unbekannt';
  }
};

const formatDate = (dateString?: string | null) => {
  if (!dateString) return '–';
  return new Date(dateString).toLocaleDateString('de-DE', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatDateTime = (dateString?: string | null) => {
  if (!dateString) return '–';
  return new Date(dateString).toLocaleString('de-DE', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const dhlTrackingUrl = (trackingNumber: string) =>
  `https://www.dhl.com/de-de/home/tracking/tracking-parcel.html?submit=1&tracking-id=${encodeURIComponent(trackingNumber)}`;

/** Gebuchte Geraete (ohne Shop-Artikel und ohne Reklamations-Folgeauftraege - die zaehlen nicht als weiteres Geraet). */
const repairItemsOf = (booking: Pick<Booking, 'items'>) => (booking.items || [])
  .filter((item) => item.type !== 'product' && !item.isComplaintFollowup);

/** Hinweis fuer Buchungen mit mehreren Positionen: alle Betraege gelten fuer die ganze Buchung. */
const wholeBookingHint = (booking: Pick<Booking, 'items'>): string | null => {
  const items = (booking.items || []).filter((item) => !item.isComplaintFollowup);
  if (items.length <= 1) return null;
  const devices = repairItemsOf(booking).length;
  return devices > 1
    ? `Beträge gelten für die gesamte Buchung (${devices} Geräte).`
    : `Beträge gelten für die gesamte Buchung (${items.length} Positionen).`;
};

type MoneyView =
  | { known: true; total: number; received: number; open: number; overpaid: number }
  | { known: false; total: number };

/** Gesamt / Bezahlt / Offen aus dem Server-Zahlungsstand - nie erfunden (null = unbekannt). */
const moneyFromBalance = (booking: Pick<Booking, 'paymentBalance' | 'totalCost'>): MoneyView => {
  const balance = booking.paymentBalance;
  if (!balance) return { known: false, total: Number(booking.totalCost || 0) };
  const total = Number(balance.total ?? balance.reference ?? booking.totalCost ?? 0);
  const received = Number(balance.received ?? 0);
  const open = Math.max(0, Number(balance.open ?? 0));
  const overpaid = Math.max(0, Number(balance.refundPending ?? balance.overpaid ?? 0));
  return { known: true, total, received, open, overpaid };
};

const RESTORE_KEY = 'customerBookings:return';
const PAGE_SIZES = [10, 20, 50, 100];
const STATUS_FILTERS = ['pending', 'payment-pending', 'processing', 'completed', 'cancelled'];

// ---------------------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------------------

function MoneySummary({
  total,
  received,
  open,
  overpaid,
  known,
  compact = false,
}: {
  total: number;
  received?: number;
  open?: number;
  overpaid?: number;
  known: boolean;
  compact?: boolean;
}) {
  return (
    <dl className={`cb-money${compact ? ' cb-money--compact' : ''}`}>
      <div className="cb-money-item">
        <dt>Gesamt (brutto)</dt>
        <dd>{formatEUR(total)}</dd>
      </div>
      {known ? (
        <>
          <div className="cb-money-item">
            <dt>Bezahlt</dt>
            <dd className={Number(received) > 0 ? 'cb-money-positive' : ''}>{formatEUR(received || 0)}</dd>
          </div>
          {Number(overpaid) > 0.009 ? (
            <div className="cb-money-item">
              <dt>Überzahlt · Erstattung offen</dt>
              <dd className="cb-money-refund">{formatEUR(overpaid || 0)}</dd>
            </div>
          ) : (
            <div className="cb-money-item">
              <dt>Offen</dt>
              <dd className={Number(open) > 0.009 ? 'cb-money-open' : 'cb-money-positive'}>
                {Number(open) > 0.009 ? formatEUR(open || 0) : (
                  <span className="inline-flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />{formatEUR(0)}</span>
                )}
              </dd>
            </div>
          )}
        </>
      ) : (
        <div className="cb-money-item cb-money-item--wide">
          <dt>Zahlungsstand</dt>
          <dd className="cb-money-unknown">derzeit nicht verfügbar</dd>
        </div>
      )}
    </dl>
  );
}

/**
 * Einsendelabel (Kunde -> McRepair) einer Buchung: Text vom Server (GET .../inbound-label),
 * Herunterladen/Drucken/Erstellen ueber die DHL-Helfer mit deutscher Fehlermeldung im Toast.
 */
function InboundLabelBlock({
  bookingId,
  bookingNumber,
  view,
  onViewChange,
  variant = 'card',
}: {
  bookingId: string;
  bookingNumber?: string;
  view: InboundLabelView;
  onViewChange: (view: InboundLabelView) => void;
  variant?: 'card' | 'dialog';
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<'' | 'download' | 'print' | 'create'>('');
  const inbound = view.inbound;
  const headingId = `inbound-${variant}-${bookingId}`;

  const run = async (kind: 'download' | 'print' | 'create') => {
    setBusy(kind);
    try {
      if (kind === 'download') {
        await downloadInboundLabel(inbound);
      } else if (kind === 'print') {
        await printInboundLabel(inbound);
      } else {
        const next = await createBookingInboundLabel(bookingId);
        onViewChange(next);
        toast({
          title: next.alreadyExists ? 'Einsendelabel liegt bereits vor' : 'Einsendelabel erstellt',
          description: next.inbound?.message || 'Sie können das DHL-Einsendelabel jetzt herunterladen.',
        });
      }
    } catch (error) {
      toast({
        title: kind === 'create' ? 'Einsendelabel konnte nicht erstellt werden' : 'Einsendelabel konnte nicht geladen werden',
        description: error instanceof Error ? error.message : 'Bitte versuchen Sie es später erneut.',
        variant: 'destructive',
      });
    } finally {
      setBusy('');
    }
  };

  const showTracking = Boolean(inbound.trackingNumber) && !inbound.placeholder;
  const statusText = inbound.shippingStatus && !['pending', 'label-created', ''].includes(inbound.shippingStatus)
    ? getShippingStatusLabel(inbound.shippingStatus)
    : '';

  return (
    <section className={`cb-inbound cb-inbound--${variant} cb-inbound--${inbound.state}`} aria-labelledby={headingId}>
      <div className="cb-inbound-head">
        <Truck className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
        <h4 id={headingId} className="cb-inbound-title">
          {variant === 'card' ? 'Gerät an McRepair senden' : 'DHL-Einsendelabel (Sie → McRepair)'}
        </h4>
        {inbound.placeholder && <span className="cb-testlabel">Testlabel</span>}
        {statusText && <span className="cb-inbound-status">Einsendung: {statusText}</span>}
      </div>
      {inbound.message && <p className="cb-inbound-message">{inbound.message}</p>}
      {(inbound.state === 'creating' || inbound.state === 'review') && (
        <p className="cb-inbound-wait"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Bitte warten – Sie müssen nichts weiter tun.</p>
      )}
      <div className="cb-inbound-actions">
        {inbound.state === 'ready' && inbound.downloadUrl && (
          <>
            <Button
              type="button"
              className="cb-btn-primary"
              onClick={() => void run('download')}
              disabled={Boolean(busy)}
              aria-label={`DHL-Einsendelabel herunterladen (PDF)${bookingNumber ? ` für Buchung ${bookingNumber}` : ''}`}
            >
              {busy === 'download' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="mr-2 h-4 w-4" aria-hidden="true" />}
              Einsendelabel herunterladen (PDF)
            </Button>
            <Button type="button" variant="outline" className="cb-btn-secondary" onClick={() => void run('print')} disabled={Boolean(busy)}>
              {busy === 'print' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Printer className="mr-2 h-4 w-4" aria-hidden="true" />}
              Label drucken
            </Button>
          </>
        )}
        {inbound.canCreate && inbound.state !== 'ready' && (
          <Button type="button" className="cb-btn-primary" onClick={() => void run('create')} disabled={Boolean(busy)}>
            {busy === 'create' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Truck className="mr-2 h-4 w-4" aria-hidden="true" />}
            {busy === 'create' ? 'Einsendelabel wird erstellt …' : 'DHL-Einsendelabel erstellen'}
          </Button>
        )}
        {showTracking && (
          <a className="cb-inbound-tracking" href={dhlTrackingUrl(inbound.trackingNumber)} target="_blank" rel="noopener noreferrer">
            Sendung {inbound.trackingNumber} verfolgen <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------
// Seite "Meine Buchungen"
// ---------------------------------------------------------------------------------------

type InboundEntry = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; view: InboundLabelView };

export function CustomerBookings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter, Suche, Seite und Seitengroesse stehen in der URL (CUSTUX-2): "Zurück" aus dem
  // Auftragsdetail (backTarget.search) und die Browser-Zurück-Taste stellen sie wieder her.
  const rawStatus = searchParams.get('status') || 'all';
  const statusFilter = STATUS_FILTERS.includes(rawStatus) ? rawStatus : 'all';
  const query = (searchParams.get('q') || '').trim();
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const perPageParam = parseInt(searchParams.get('perPage') || '20', 10);
  const itemsPerPage = PAGE_SIZES.includes(perPageParam) ? perPageParam : 20;

  const [searchInput, setSearchInput] = useState(query);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [totalBookings, setTotalBookings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestSeq = useRef(0);

  const [unreadCounts, setUnreadCounts] = useState<Record<string, { unread: number; senderType?: string }>>({});
  const [inboundByBooking, setInboundByBooking] = useState<Record<string, InboundEntry>>({});

  const [dialogBooking, setDialogBooking] = useState<Booking | null>(null);
  const [dialogTab, setDialogTab] = useState<DialogTab>('payments');
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const [complaintOrder, setComplaintOrder] = useState<BookingItem | null>(null);
  const [complaintReason, setComplaintReason] = useState("");
  const [complaintDescription, setComplaintDescription] = useState("");
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  const restoreDoneRef = useRef(false);

  const updateParams = useCallback((patch: Record<string, string | number | null>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(patch).forEach(([key, value]) => {
        const isDefault = value === null || value === '' || (key === 'status' && value === 'all')
          || (key === 'page' && Number(value) === 1) || (key === 'perPage' && Number(value) === 20);
        if (isDefault) next.delete(key);
        else next.set(key, String(value));
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Suche: Eingabe sofort sichtbar, Anfrage 300 ms verzoegert (serverseitig, alle Seiten).
  useEffect(() => {
    if (searchInput.trim() === query) return undefined;
    const timer = window.setTimeout(() => updateParams({ q: searchInput.trim(), page: null }), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, query, updateParams]);

  // Zurueck/Vor im Browser aendert q - Eingabefeld nachziehen.
  useEffect(() => {
    setSearchInput((current) => (current.trim() === query ? current : query));
  }, [query]);

  useEffect(() => {
    const seq = ++requestSeq.current;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await getBookings({
          limit: itemsPerPage,
          skip: (currentPage - 1) * itemsPerPage,
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
          ...(query ? { search: query } : {}),
        });
        if (seq !== requestSeq.current) return;
        const bookingsData: Booking[] = response?.bookings || [];
        setBookings(bookingsData);
        setTotalBookings(Number(response?.total ?? bookingsData.length) || 0);
      } catch (error) {
        if (seq !== requestSeq.current) return;
        console.error('CustomerBookings: Error fetching bookings:', error);
        setBookings([]);
        setTotalBookings(0);
        setLoadError(error instanceof Error && error.message ? error.message : 'Unbekannter Fehler');
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    };
    void load();
  }, [statusFilter, query, currentPage, itemsPerPage, reloadKey]);

  // Ungelesene Nachrichten je Auftrag (nicht kritisch: Fehler nur im Log).
  useEffect(() => {
    const orderIds = bookings.flatMap((booking) => (booking.items || []).map((item) => item.orderId).filter(Boolean));
    if (orderIds.length === 0) {
      setUnreadCounts({});
      return;
    }
    let cancelled = false;
    getUnreadMessageCounts(orderIds)
      .then((counts) => { if (!cancelled) setUnreadCounts(counts || {}); })
      .catch((error) => console.error("CustomerBookings: Error fetching unread counts:", error));
    return () => { cancelled = true; };
  }, [bookings]);

  // Einsendestatus nur fuer Buchungen, in denen noch ein Geraet eingesendet werden muss
  // (Reparaturauftrag 'pending'); eine Anfrage je Buchung, Ergebnis zwischengespeichert.
  const needsInbound = (booking: Booking) => booking.status !== 'cancelled'
    && repairItemsOf(booking).some((item) => (item.status || 'pending') === 'pending');

  const loadInbound = useCallback(async (bookingId: string) => {
    setInboundByBooking((prev) => ({ ...prev, [bookingId]: { status: 'loading' } }));
    try {
      const view = await getBookingInboundLabel(bookingId);
      setInboundByBooking((prev) => ({ ...prev, [bookingId]: { status: 'ready', view } }));
    } catch (error) {
      setInboundByBooking((prev) => ({
        ...prev,
        [bookingId]: { status: 'error', message: error instanceof Error ? error.message : 'Einsendestatus konnte nicht geladen werden.' },
      }));
    }
  }, []);

  useEffect(() => {
    bookings.filter(needsInbound).forEach((booking) => {
      if (!inboundByBooking[booking._id]) void loadInbound(booking._id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  // Rueckkehr aus dem Auftragsdetail: denselben "Details ansehen"-Link fokussieren und die
  // Scrollposition wiederherstellen (nach dem globalen ScrollToTop, der bis 220 ms laeuft).
  useEffect(() => {
    if (restoreDoneRef.current || loading) return undefined;
    const state = (location.state || {}) as { restoreFocusOrderId?: string; reopenBookingDialog?: string; reopenBookingTab?: DialogTab };
    let saved: { orderId?: string; scrollY?: number; ts?: number; key?: string } | null = null;
    try {
      saved = JSON.parse(window.sessionStorage.getItem(RESTORE_KEY) || 'null');
    } catch {
      saved = null;
    }
    // Nur der Verlaufseintrag, von dem aus "Details ansehen" geklickt wurde (gleicher
    // location.key), stellt wieder her - ein Reload eines spaeter ueber die Navigation
    // geoeffneten /bookings springt nicht an eine alte Position.
    const savedFresh = saved && saved.orderId && Date.now() - Number(saved.ts || 0) < 30 * 60 * 1000 ? saved : null;
    const savedForPop = savedFresh && (!savedFresh.key || savedFresh.key === location.key) ? savedFresh : null;
    const focusOrderId = state.restoreFocusOrderId || (navigationType === 'POP' ? savedForPop?.orderId : undefined);
    if (!focusOrderId) {
      restoreDoneRef.current = true;
      try { window.sessionStorage.removeItem(RESTORE_KEY); } catch { /* ohne Speicher nichts aufzuraeumen */ }
      return undefined;
    }
    const scrollY = savedFresh && savedFresh.orderId === focusOrderId && typeof savedFresh.scrollY === 'number' ? savedFresh.scrollY : null;
    const timer = window.setTimeout(() => {
      restoreDoneRef.current = true;
      try { window.sessionStorage.removeItem(RESTORE_KEY); } catch { /* ohne Speicher kein Wiederherstellen */ }
      const link = document.querySelector<HTMLElement>(`[data-order-link="${focusOrderId}"]`);
      if (scrollY !== null) window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
      if (link) {
        link.focus({ preventScroll: scrollY !== null });
        const rect = link.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) link.scrollIntoView({ block: 'center' });
      }
    }, 260);
    return () => window.clearTimeout(timer);
  }, [loading, bookings, location.state, location.key, navigationType]);

  // Aelterer Ruecksprung (Dialog wieder oeffnen), z. B. aus gespeicherten Verlaufseintraegen.
  useEffect(() => {
    const state = (location.state || {}) as { reopenBookingDialog?: string; reopenBookingTab?: DialogTab };
    if (!state.reopenBookingDialog) return;
    let cancelled = false;
    getBooking(state.reopenBookingDialog)
      .then((response) => {
        if (cancelled || !response?.booking?._id) return;
        setDialogBooking(response.booking);
        setDialogTab(state.reopenBookingTab || 'payments');
        setShowDetailDialog(true);
      })
      .catch((error) => console.error("CustomerBookings: Error reopening booking dialog:", error));
    return () => { cancelled = true; };
  }, [location.state]);

  const rememberReturnPosition = (orderId: string) => {
    try {
      window.sessionStorage.setItem(RESTORE_KEY, JSON.stringify({ orderId, scrollY: window.scrollY, ts: Date.now(), key: location.key }));
    } catch {
      /* privater Modus: Ruecksprung funktioniert dann nur ueber den Zurück-Button */
    }
  };

  // Ruecksprungziel mit dem EINGEGEBENEN Suchbegriff - auch wenn die 300-ms-Verzoegerung
  // ihn noch nicht in die URL geschrieben hat (schneller Klick direkt nach dem Tippen).
  const backSearch = (() => {
    const typed = searchInput.trim();
    if (typed === query) return location.search;
    const next = new URLSearchParams(location.search);
    if (typed) next.set('q', typed); else next.delete('q');
    next.delete('page');
    const text = next.toString();
    return text ? `?${text}` : '';
  })();
  const orderLinkState = (orderId: string) => buildOrderDetailsState({ ...location, search: backSearch }, {
    label: 'Zurück zu meinen Buchungen',
    restoreState: { restoreFocusOrderId: orderId },
  });

  const openBookingDialog = (booking: Booking, tab: DialogTab) => {
    setDialogBooking(booking);
    setDialogTab(tab);
    setShowDetailDialog(true);
    // Vollstaendige Buchung (Verlauf, Adressen, Versandfelder) nachladen; bis dahin zeigt der
    // Dialog die Daten aus der Liste.
    getBooking(booking._id)
      .then((response) => {
        if (response?.booking?._id === booking._id) {
          setDialogBooking((current) => (current && current._id === booking._id
            ? { ...response.booking, paymentBalance: booking.paymentBalance, items: booking.items }
            : current));
        }
      })
      .catch((error) => console.error("CustomerBookings: Failed to load full booking for detail dialog:", error));
  };

  const openOrderComplaintDialog = (order: BookingItem) => {
    if (!order.orderId || order.status !== 'completed' || order.hasComplaint) return;
    setComplaintOrder(order);
    setComplaintReason("");
    setComplaintDescription("");
  };

  const handleSubmitComplaint = async () => {
    if (!complaintOrder?.orderId) return;

    if (!complaintReason.trim() || !complaintDescription.trim()) {
      toast({
        title: "Fehlende Angaben",
        description: "Bitte Reklamationsgrund und Beschreibung ausfüllen.",
        variant: "destructive"
      });
      return;
    }

    try {
      setSubmittingComplaint(true);
      await createOrderComplaint(complaintOrder.orderId, {
        reason: complaintReason.trim(),
        description: complaintDescription.trim()
      });
      toast({
        title: "Reklamation eingereicht",
        description: "Ihre Reklamation wurde an unser Team gesendet."
      });
      setComplaintOrder(null);
      setReloadKey((key) => key + 1);
    } catch (error: unknown) {
      toast({
        title: "Reklamation fehlgeschlagen",
        description: error instanceof Error ? error.message : "Reklamation konnte nicht angelegt werden.",
        variant: "destructive"
      });
    } finally {
      setSubmittingComplaint(false);
    }
  };

  // Die Seite ist deutsch: zuerst die eigene deutsche Bezeichnung, sonst der deutsche
  // Locale-Text (nie gemischte Sprachen, nie ein roher Schluessel).
  const statusLabel = (status?: string) => {
    const value = status || 'pending';
    return STATUS_LABELS_DE[value] || t(`status.${value}`, { lng: 'de', defaultValue: value });
  };

  const filterActive = statusFilter !== 'all' || Boolean(query);
  const totalPages = Math.max(1, Math.ceil(totalBookings / itemsPerPage));

  // Seitennummer hinter der letzten Seite (alter Link, Liste inzwischen kuerzer): auf die
  // letzte vorhandene Seite springen statt "noch keine Buchungen" zu zeigen.
  useEffect(() => {
    if (loading || loadError || bookings.length > 0 || totalBookings === 0) return;
    if (currentPage > totalPages) updateParams({ page: totalPages });
  }, [loading, loadError, bookings.length, totalBookings, currentPage, totalPages, updateParams]);
  const resetFilters = () => {
    setSearchInput('');
    updateParams({ status: null, q: null, page: null });
  };

  const renderDeviceRow = (booking: Booking, item: BookingItem, index: number) => {
    const repairItems = repairItemsOf(booking);
    const isProduct = item.type === 'product';
    const isFollowup = Boolean(item.isComplaintFollowup);
    const repairIndex = repairItems.indexOf(item);
    const deviceName = isProduct
      ? `Shop-Artikel: ${(item.products || []).map((product) => product.name).filter(Boolean).join(', ') || 'Produkte'}`
      : (item.device || 'Gerät');
    const orderLabel = item.orderNumber ? `Auftrag ${item.orderNumber}` : (item.orderId ? `Auftrag ${String(item.orderId).slice(-8).toUpperCase()}` : '');
    const progress = Math.max(0, Math.min(100, Number(item.progress || 0)));
    const unread = item.orderId ? Number(unreadCounts[item.orderId]?.unread || 0) : 0;
    const complaintEligible = Boolean(item.orderId) && item.status === 'completed' && !item.hasComplaint;
    const services = (item.services || []).map((service) => service.name).filter(Boolean).join(', ');
    const status = item.status || 'pending';

    return (
      <li key={item.orderId || item._id || index} className={`cb-device${isFollowup ? ' cb-device--followup' : ''}`}>
        <div className="cb-device-icon" aria-hidden="true">
          {isProduct ? <ShoppingBag className="h-5 w-5" /> : isFollowup ? <AlertCircle className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
        </div>
        <div className="cb-device-main">
          {isFollowup ? (
            <span className="cb-device-index cb-device-index--followup">
              Reklamationsauftrag{item.parentOrderNumber ? ` zu Auftrag ${item.parentOrderNumber}` : ''}
            </span>
          ) : !isProduct && repairIndex >= 0 && repairItems.length > 1 && (
            <span className="cb-device-index">Gerät {repairIndex + 1} von {repairItems.length}</span>
          )}
          <span className="cb-device-name">{deviceName}</span>
          <span className="cb-device-sub">
            {[orderLabel, services, item.cost ? formatEUR(item.cost) : ''].filter(Boolean).join(' · ')}
          </span>
        </div>
        <div className="cb-device-status">
          <Badge className={`${statusBadgeClass(status)} cb-status-badge`}>{statusLabel(status)}</Badge>
          {!isProduct && (
            <div className="cb-progress" aria-label={`Fortschritt ${progress} %`} role="img">
              <div className="cb-progress-track"><div className="cb-progress-fill" style={{ width: `${progress}%` }} /></div>
              <span className="cb-progress-text" aria-hidden="true">{progress} %</span>
            </div>
          )}
        </div>
        <div className="cb-device-actions">
          {unread > 0 && item.orderId && (
            <Link
              to={`/messages?thread=${encodeURIComponent(`order:${item.orderId}`)}`}
              className="cb-btn-messages"
              aria-label={`${unread} ungelesene ${unread === 1 ? 'Nachricht' : 'Nachrichten'} zu ${orderLabel || deviceName} öffnen`}
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              {unread > 99 ? '99+' : unread} {unread === 1 ? 'neue Nachricht' : 'neue Nachrichten'}
            </Link>
          )}
          {complaintEligible && (
            <Button type="button" variant="outline" size="sm" className="cb-btn-secondary" onClick={() => openOrderComplaintDialog(item)}>
              <AlertCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Reklamation anmelden
            </Button>
          )}
          {item.orderId && (
            <Link
              to={getOrderDetailsPath(item.orderId)}
              state={orderLinkState(item.orderId)}
              onClick={() => rememberReturnPosition(item.orderId)}
              className="cb-details-link"
              data-order-link={item.orderId}
              aria-label={`Details ansehen: ${isFollowup ? 'Reklamationsauftrag, ' : ''}${deviceName}${orderLabel ? `, ${orderLabel}` : ''}`}
            >
              Details ansehen
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </li>
    );
  };

  const renderInboundForCard = (booking: Booking) => {
    if (!needsInbound(booking)) return null;
    const entry = inboundByBooking[booking._id];
    if (!entry || entry.status === 'loading') {
      return (
        <div className="cb-inbound cb-inbound--card cb-inbound--loading" role="status">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Einsendestatus wird geladen …
        </div>
      );
    }
    if (entry.status === 'error') {
      return (
        <div className="cb-inbound cb-inbound--card cb-inbound--error" role="alert">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>Einsendestatus konnte nicht geladen werden.</span>
          <Button type="button" variant="outline" className="cb-btn-secondary" size="sm" onClick={() => void loadInbound(booking._id)}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Erneut versuchen
          </Button>
        </div>
      );
    }
    const { inbound } = entry.view;
    if (inbound.deviceReceived || ['not-needed', 'cancelled'].includes(inbound.state)) return null;
    return (
      <InboundLabelBlock
        bookingId={booking._id}
        bookingNumber={booking.bookingNumber}
        view={entry.view}
        onViewChange={(view) => setInboundByBooking((prev) => ({ ...prev, [booking._id]: { status: 'ready', view } }))}
      />
    );
  };

  const renderBookingCard = (booking: Booking) => {
    const bookingLabel = booking.bookingNumber || `#${booking._id.slice(-8).toUpperCase()}`;
    const money = moneyFromBalance(booking);
    const hint = wholeBookingHint(booking);
    const repairCount = repairItemsOf(booking).length;
    const items = booking.items || [];
    const shopCount = items.filter((item) => item.type === 'product').length;
    const followupCount = items.filter((item) => item.isComplaintFollowup).length;
    const headingId = `booking-${booking._id}`;

    return (
      <article key={booking._id} className="cb-booking" aria-labelledby={headingId}>
        <header className="cb-booking-head">
          <div className="cb-booking-id">
            <h3 id={headingId} className="cb-booking-title">
              <Package className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              Buchung {bookingLabel}
            </h3>
            <p className="cb-booking-meta">
              vom {formatDate(booking.createdAt)}
              {repairCount > 0 && ` · ${repairCount} ${repairCount === 1 ? 'Gerät' : 'Geräte'}`}
              {shopCount > 0 && ` · ${shopCount} Shop-${shopCount === 1 ? 'Position' : 'Positionen'}`}
              {followupCount > 0 && ` · ${followupCount} ${followupCount === 1 ? 'Reklamationsauftrag' : 'Reklamationsaufträge'}`}
            </p>
            <div className="cb-booking-badges">
              <Badge className={`${statusBadgeClass(booking.status)} cb-status-badge`}>
                <span className="sr-only">Buchungsstatus: </span>{statusLabel(booking.status)}
              </Badge>
              {!money.known && (
                <Badge className="bg-gray-100 text-gray-800 border border-gray-300 cb-status-badge">
                  Zahlung: {getBillingStatusLabel(booking.billingStatus)}
                </Badge>
              )}
            </div>
          </div>
          <MoneySummary
            known={money.known}
            total={money.total}
            received={money.known ? money.received : undefined}
            open={money.known ? money.open : undefined}
            overpaid={money.known ? money.overpaid : undefined}
          />
        </header>
        {hint && <p className="cb-booking-hint">{hint}</p>}

        {renderInboundForCard(booking)}

        {items.length > 0 ? (
          <ul className="cb-devices" aria-label={`Geräte und Positionen der Buchung ${bookingLabel}`}>
            {items.map((item, index) => renderDeviceRow(booking, item, index))}
          </ul>
        ) : (
          <p className="cb-devices-empty">Zu dieser Buchung sind keine Aufträge hinterlegt.</p>
        )}

        <footer className="cb-booking-foot">
          <Button type="button" variant="outline" size="sm" className="cb-btn-secondary" onClick={() => openBookingDialog(booking, 'payments')}>
            <Receipt className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Rechnungen &amp; Zahlungen
          </Button>
          <Button type="button" variant="outline" size="sm" className="cb-btn-secondary" onClick={() => openBookingDialog(booking, 'shipping')}>
            <Truck className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Versand &amp; Verlauf
          </Button>
        </footer>
      </article>
    );
  };

  const renderListBody = () => {
    if (loading) {
      return (
        <div className="cb-state" role="status" aria-busy="true">
          <div className="cb-skeleton" aria-hidden="true" />
          <div className="cb-skeleton" aria-hidden="true" />
          <p className="cb-state-text"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Buchungen werden geladen …</p>
        </div>
      );
    }
    if (loadError) {
      return (
        <div className="cb-state cb-state--error" role="alert">
          <AlertCircle className="h-8 w-8" aria-hidden="true" />
          <p className="cb-state-title">Buchungen konnten nicht geladen werden.</p>
          <p className="cb-state-text">Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.</p>
          <Button type="button" className="cb-btn-primary" onClick={() => setReloadKey((key) => key + 1)}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" /> Erneut versuchen
          </Button>
        </div>
      );
    }
    if (bookings.length === 0 && totalBookings > 0) {
      return (
        <div className="cb-state">
          <Search className="h-8 w-8" aria-hidden="true" />
          <p className="cb-state-title">Auf dieser Seite gibt es keine Buchungen.</p>
          <p className="cb-state-text">Insgesamt {totalBookings} {totalBookings === 1 ? 'Buchung' : 'Buchungen'}{filterActive ? ' für diese Auswahl' : ''}.</p>
          <Button type="button" variant="outline" className="cb-btn-secondary" onClick={() => updateParams({ page: null })}>Zur ersten Seite</Button>
        </div>
      );
    }
    if (bookings.length === 0) {
      return filterActive ? (
        <div className="cb-state">
          <Search className="h-8 w-8" aria-hidden="true" />
          <p className="cb-state-title">Keine Buchungen für diese Auswahl.</p>
          <p className="cb-state-text">Ändern Sie den Suchbegriff oder den Status.</p>
          <Button type="button" variant="outline" className="cb-btn-secondary" onClick={resetFilters}>Filter zurücksetzen</Button>
        </div>
      ) : (
        <div className="cb-state">
          <Package className="h-8 w-8" aria-hidden="true" />
          <p className="cb-state-title">Sie haben noch keine Buchungen.</p>
          <p className="cb-state-text">Buchen Sie eine Reparatur – hier sehen Sie danach jedes Gerät mit seinem Status.</p>
          <Button type="button" className="cb-btn-primary" onClick={() => navigate('/#repair-order-configurator')}>
            Reparatur buchen
          </Button>
        </div>
      );
    }
    return <div className="cb-list">{bookings.map(renderBookingCard)}</div>;
  };

  const firstShown = totalBookings === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const lastShown = Math.min(currentPage * itemsPerPage, totalBookings);

  return (
    <div className="customer-bookings-page min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-amber-50/20">
      <SEO
        title="Meine Buchungen – McRepair.de Kundenportal"
        description="Alle Reparaturbuchungen auf einen Blick: Termine, Status und Details im McRepair.de Kundenportal einsehen und verwalten."
        canonical="/bookings"
        noindex={true}
      />
      <div className="mx-auto w-[calc(100%-2rem)] max-w-[1200px] pb-8 space-y-5 max-[480px]:w-[calc(100%-0.8rem)] max-[360px]:w-[calc(100%-0.5rem)]">
        {/* Kopfbereich */}
        <div className="w-full overflow-hidden rounded-[18px] border-b border-[#2a3f7e] bg-gradient-to-br from-[#1a2a5e] to-[#0f1d45] px-6 py-7 text-white max-[480px]:rounded-[12px] max-[480px]:px-3 max-[480px]:py-5">
          <div className="flex items-start gap-4 sm:items-center max-[480px]:gap-[10px]">
            <Package className="h-10 w-10 flex-shrink-0 text-[#f5b800] max-sm:h-[30px] max-sm:w-[30px]" aria-hidden="true" />
            <div>
              <h1 className="m-0 text-[1.75rem] font-extrabold leading-[1.2] tracking-[-0.5px] max-[480px]:text-[1.15rem]">Meine Buchungen</h1>
              <p className="mt-1 text-[0.95rem] leading-[1.35] text-[rgba(255,255,255,0.88)] max-[480px]:text-[0.8rem]">
                Jedes Gerät mit Status – über „Details ansehen“ öffnen Sie die Reparatur.
              </p>
            </div>
          </div>
        </div>

        {/* Filter */}
        <section className="cb-filters" aria-label="Buchungen filtern">
          <div className="cb-filter-field cb-filter-field--search">
            <Label htmlFor="cb-search" className="cb-filter-label">Suche</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" aria-hidden="true" />
              <Input
                id="cb-search"
                type="search"
                placeholder="Buchung, Auftrag oder Gerät suchen …"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="pl-10 h-10 text-sm border-slate-300 focus:border-[#f5b800] focus:ring-[#f5b800]"
              />
            </div>
          </div>
          <div className="cb-filter-field cb-filter-field--status">
            <Label htmlFor="cb-status" className="cb-filter-label">Status</Label>
            <Select value={statusFilter} onValueChange={(value) => updateParams({ status: value, page: null })}>
              <SelectTrigger id="cb-status" className="h-10 text-sm border-slate-300 focus:border-[#f5b800] focus:ring-[#f5b800]">
                <SelectValue placeholder="Status wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                {STATUS_FILTERS.map((status) => (
                  <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filterActive && (
            <Button type="button" variant="ghost" className="cb-filter-reset" onClick={resetFilters}>
              <X className="mr-1.5 h-4 w-4" aria-hidden="true" /> Filter zurücksetzen
            </Button>
          )}
        </section>

        {/* Liste */}
        <section className="cb-list-section" aria-labelledby="cb-list-heading" aria-busy={loading}>
          <div className="cb-list-head">
            <h2 id="cb-list-heading" className="cb-list-heading">Buchungen</h2>
            {!loading && !loadError && (
              <p className="cb-list-count" aria-live="polite">
                {totalBookings} {totalBookings === 1 ? 'Buchung' : 'Buchungen'}{filterActive ? ' für diese Auswahl' : ''}
              </p>
            )}
          </div>

          {renderListBody()}

          {!loading && !loadError && totalBookings > 0 && (totalBookings > itemsPerPage || itemsPerPage !== 20) && (
            <nav className="cb-pagination" aria-label="Seiten">
              <p className="cb-pagination-range">{firstShown}–{lastShown} von {totalBookings}</p>
              <div className="cb-pagination-controls">
                <div className="flex items-center gap-2">
                  <Label htmlFor="cb-per-page" className="text-sm text-slate-700">Pro Seite</Label>
                  <Select value={String(itemsPerPage)} onValueChange={(value) => updateParams({ perPage: Number(value), page: null })}>
                    <SelectTrigger id="cb-per-page" className="h-9 w-20 text-sm border-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cb-btn-secondary h-9"
                    onClick={() => updateParams({ page: Math.max(1, currentPage - 1) })}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" /> Zurück
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                    .map((page, index, array) => (
                      <React.Fragment key={page}>
                        {index > 0 && page - array[index - 1] > 1 && <span className="px-1 text-slate-500" aria-hidden="true">…</span>}
                        <Button
                          type="button"
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          className={currentPage === page ? "h-9 w-9 p-0 bg-[#1a2a5e] text-white" : "h-9 w-9 p-0"}
                          aria-current={currentPage === page ? 'page' : undefined}
                          aria-label={`Seite ${page}`}
                          onClick={() => updateParams({ page })}
                        >
                          {page}
                        </Button>
                      </React.Fragment>
                    ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cb-btn-secondary h-9"
                    onClick={() => updateParams({ page: Math.min(totalPages, currentPage + 1) })}
                    disabled={currentPage >= totalPages}
                  >
                    Weiter <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </nav>
          )}
        </section>

        <Dialog open={Boolean(complaintOrder)} onOpenChange={(open) => !open && setComplaintOrder(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reklamation anmelden</DialogTitle>
              <DialogDescription>
                {complaintOrder?.device ? `${complaintOrder.device} · ` : ''}Auftrag {complaintOrder?.orderNumber || complaintOrder?.orderId}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cb-complaint-reason">Reklamationsgrund</Label>
                <Input
                  id="cb-complaint-reason"
                  placeholder="z. B. Fehler wieder aufgetreten"
                  value={complaintReason}
                  onChange={(event) => setComplaintReason(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cb-complaint-description">Beschreibung</Label>
                <Textarea
                  id="cb-complaint-description"
                  placeholder="Bitte beschreiben Sie den Sachverhalt möglichst konkret."
                  value={complaintDescription}
                  onChange={(event) => setComplaintDescription(event.target.value)}
                  rows={5}
                />
              </div>
            </DialogBody>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" className="cb-btn-secondary" onClick={() => setComplaintOrder(null)} disabled={submittingComplaint}>
                Abbrechen
              </Button>
              <Button type="button" onClick={handleSubmitComplaint} disabled={submittingComplaint}>
                {submittingComplaint ? 'Wird gesendet …' : 'Reklamation senden'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {dialogBooking && (
          <BookingDetailDialog
            booking={dialogBooking}
            open={showDetailDialog}
            initialTab={dialogTab}
            onClose={() => {
              setShowDetailDialog(false);
              setDialogBooking(null);
            }}
            navigate={navigate}
            statusLabel={statusLabel}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Buchungsdialog "Rechnungen, Zahlungen & Versand" (EIN Container auf Buchungsebene)
// ---------------------------------------------------------------------------------------

interface BookingDetailDialogProps {
  booking: Booking;
  open: boolean;
  initialTab: DialogTab;
  onClose: () => void;
  navigate: ReturnType<typeof useNavigate>;
  statusLabel: (status?: string) => string;
}

function BookingDetailDialog({
  booking,
  open,
  initialTab,
  onClose,
  navigate,
  statusLabel,
}: BookingDetailDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<DialogTab>(initialTab);
  const [detailOrders, setDetailOrders] = useState<any[]>([]);

  const [bookingInvoices, setBookingInvoices] = useState<any[]>([]);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [loadingBookingInvoices, setLoadingBookingInvoices] = useState(false);
  const [pdfInvoiceId, setPdfInvoiceId] = useState<string | null>(null);

  const [paymentOverview, setPaymentOverview] = useState<CustomerBookingPaymentOverview | null>(null);
  const [paymentsState, setPaymentsState] = useState<'loading' | 'ready' | 'error'>('loading');

  const [inboundView, setInboundView] = useState<InboundLabelView | null>(null);
  const [inboundState, setInboundState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [downloadingOutbound, setDownloadingOutbound] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => { setActiveTab(initialTab); }, [initialTab, booking._id]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoadingBookingInvoices(true);
    setInvoicesError(null);
    getBookingInvoices(booking._id)
      .then((data) => attachInvoiceBalances(data?.invoices || []))
      .then((invoices) => { if (!cancelled) setBookingInvoices(invoices); })
      .catch((error) => {
        if (cancelled) return;
        setBookingInvoices([]);
        setInvoicesError(error instanceof Error ? error.message : 'Rechnungen konnten nicht geladen werden.');
      })
      .finally(() => { if (!cancelled) setLoadingBookingInvoices(false); });

    setPaymentsState('loading');
    getCustomerBookingPayments(booking._id)
      .then((overview) => { if (!cancelled) { setPaymentOverview(overview); setPaymentsState('ready'); } })
      .catch(() => { if (!cancelled) { setPaymentOverview(null); setPaymentsState('error'); } });

    setInboundState('loading');
    getBookingInboundLabel(booking._id)
      .then((view) => { if (!cancelled) { setInboundView(view); setInboundState('ready'); } })
      .catch(() => { if (!cancelled) { setInboundView(null); setInboundState('error'); } });

    getBookingOrders(booking._id)
      .then((res: any) => { if (!cancelled) setDetailOrders(res?.orders || []); })
      .catch(() => { if (!cancelled) setDetailOrders([]); });

    return () => { cancelled = true; };
  }, [open, booking._id, reloadKey]);

  const productItems = (booking.items || []).filter((item) => item.type === 'product');
  const hint = wholeBookingHint(booking);
  const bookingLabel = booking.bookingNumber || `#${booking._id.slice(-8).toUpperCase()}`;

  // Zahlungssummen: bevorzugt aus der Kundenprojektion von GET /api/bookings/:id/payments,
  // sonst aus dem Listen-Zahlungsstand (gleiche Berechnung); unbekannt -> keine Zahl erfinden.
  const listMoney = moneyFromBalance(booking);
  const summary = paymentOverview?.summary;
  const money: MoneyView = summary
    ? {
        known: true,
        total: Number(summary.referenceTotal || 0),
        received: Number(summary.receivedTotal || 0),
        open: Math.max(0, Number(summary.openOrderBalance || 0)),
        overpaid: Math.max(0, Number(summary.refundPendingTotal || summary.overpaidTotal || 0)),
      }
    : listMoney;

  const isOutboundLegacyLabel = booking.shippingLabelDirection === 'outbound'
    && Boolean(booking.trackingNumber || booking.shippingLabelUrl);
  const outboundOrders = detailOrders.filter((entry: any) => entry?.outboundShipment?.trackingNumber);
  const inboundVisible = inboundView && !['not-needed'].includes(inboundView.inbound.state);

  const handleDownloadOutbound = async () => {
    setDownloadingOutbound(true);
    try {
      await downloadBookingShippingLabel(booking._id);
    } catch (error) {
      toast({
        title: 'Versandlabel konnte nicht geladen werden',
        description: error instanceof Error ? error.message : 'Bitte versuchen Sie es später erneut.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingOutbound(false);
    }
  };

  const tabs: Array<{ value: DialogTab; label: string }> = [
    { value: 'payments', label: 'Rechnungen & Zahlungen' },
    { value: 'shipping', label: 'Versand' },
    ...(productItems.length > 0 ? [{ value: 'items' as DialogTab, label: 'Shop-Artikel' }] : []),
    { value: 'timeline', label: 'Verlauf' },
    { value: 'contact', label: 'Adressen' },
  ];

  const hasAddressData = (addr?: AddressFields | null) => Boolean(
    addr && (addr.street || addr.city || addr.zipCode || addr.state || addr.country)
  );
  const firstOrder = Array.isArray(booking.orderIds)
    ? booking.orderIds.find((order) => order && typeof order === 'object')
    : undefined;
  const billAddr = booking.customerId?.invoiceAddress
    || booking.billingAddress
    || booking.guestInfo?.billingAddress
    || firstOrder?.billingAddress
    || firstOrder?.guestInfo?.billingAddress;
  const payAddr = booking.customerId?.paymentAddress;
  const deliveryAddr = payAddr?.sameAsInvoice === false
    ? payAddr
    : booking.shippingAddress
      || booking.guestInfo?.shippingAddress
      || firstOrder?.shippingAddress
      || firstOrder?.guestInfo?.shippingAddress;
  const deliverySameAsInvoice = payAddr?.sameAsInvoice !== false && !hasAddressData(deliveryAddr);
  const customer = booking.customerId || ({} as Booking['customerId']);

  const renderAddress = (addr?: AddressFields | null) => (
    hasAddressData(addr) ? (
      <div className="text-sm space-y-0.5 text-[var(--gray-700,#2d3748)]">
        {addr!.street && <p>{addr!.street}</p>}
        {(addr!.zipCode || addr!.city) && <p>{[addr!.zipCode, addr!.city].filter(Boolean).join(' ')}</p>}
        {addr!.country && <p className="text-[var(--gray-500,#636e85)] text-xs">{addr!.country}</p>}
      </div>
    ) : (
      <p className="text-sm italic text-[var(--gray-500,#636e85)]">Nicht angegeben</p>
    )
  );

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="booking-detail-dialog-content max-w-[95vw] sm:max-w-2xl my-0 sm:my-3 max-h-dvh sm:max-h-[92vh] p-0 gap-0 overflow-hidden border-none rounded-[16px] sm:rounded-[24px] shadow-[0_20px_60px_rgba(26,42,94,0.3)] flex flex-col [&>button]:hidden">
        <DialogHeader className="booking-detail-dialog-header">
          <div className="booking-detail-dialog-header-bg-orb booking-detail-dialog-header-bg-orb--top" />
          <div className="booking-detail-dialog-header-bg-orb booking-detail-dialog-header-bg-orb--bottom" />

          <div className="booking-detail-dialog-header-content">
            <button type="button" onClick={onClose} className="booking-detail-dialog-close-x" aria-label="Schließen">
              <X size={22} aria-hidden="true" />
            </button>
            <DialogTitle className="booking-detail-dialog-title">
              Buchung {bookingLabel}
            </DialogTitle>
            <DialogDescription className="booking-detail-dialog-description">
              Rechnungen, Zahlungen, Versand und Verlauf dieser Buchung. Die Reparatur je Gerät öffnen Sie in der Liste über „Details ansehen“.
            </DialogDescription>

            <div className="booking-detail-dialog-meta-grid">
              <div className="booking-detail-dialog-meta-item">
                <p>Erstellt</p>
                <strong>{formatDate(booking.createdAt)}</strong>
              </div>
              <div className="booking-detail-dialog-meta-item">
                <p>Status</p>
                <strong>{statusLabel(booking.status)}</strong>
              </div>
              <div className="booking-detail-dialog-meta-item">
                <p>Gesamt (brutto)</p>
                <strong>{formatEUR(money.total)}</strong>
              </div>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="booking-detail-dialog-body">
          <div className="booking-detail-dialog-inner">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DialogTab)} className="w-full mt-0">
              <TabsList className="booking-detail-tabs-list">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="booking-detail-tab-trigger">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* ---------------- Rechnungen & Zahlungen ---------------- */}
              <TabsContent value="payments" className="space-y-4 mt-4">
                <section className="cb-dialog-card" aria-labelledby="cb-dialog-money">
                  <h3 id="cb-dialog-money" className="cb-dialog-card-title">Zahlungsstand</h3>
                  {paymentsState === 'loading' && !listMoney.known ? (
                    <p className="text-sm text-[var(--gray-600,#4a5568)]">Zahlungsstand wird geladen …</p>
                  ) : (
                    <MoneySummary
                      known={money.known}
                      total={money.total}
                      received={money.known ? money.received : undefined}
                      open={money.known ? money.open : undefined}
                      overpaid={money.known ? money.overpaid : undefined}
                    />
                  )}
                  {hint && <p className="cb-booking-hint cb-booking-hint--inline">{hint}</p>}
                  {summary && Number(summary.notInvoicedTotal || 0) > 0.009 && (
                    <p className="mt-2 text-sm text-[var(--gray-700,#2d3748)]">
                      Davon noch nicht in Rechnung gestellt: <strong>{formatEUR(summary.notInvoicedTotal)}</strong>
                    </p>
                  )}
                </section>

                <section className="cb-dialog-card" aria-labelledby="cb-dialog-invoices">
                  <h3 id="cb-dialog-invoices" className="cb-dialog-card-title">Rechnungen</h3>
                  {loadingBookingInvoices ? (
                    <p className="flex items-center gap-2 text-sm text-[var(--gray-600,#4a5568)]">
                      <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Rechnungen werden geladen …
                    </p>
                  ) : invoicesError ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-red-700" role="alert">
                      <AlertCircle className="h-4 w-4" aria-hidden="true" /> Rechnungen konnten nicht geladen werden.
                      <Button type="button" variant="outline" className="cb-btn-secondary" size="sm" onClick={() => setReloadKey((key) => key + 1)}>Erneut versuchen</Button>
                    </div>
                  ) : bookingInvoices.length === 0 ? (
                    <p className="text-sm text-[var(--gray-600,#4a5568)]">Noch keine Rechnung erstellt. Sie erhalten die Rechnung per E-Mail, sobald sie vorliegt.</p>
                  ) : (
                    <ul className="space-y-2">
                      {bookingInvoices.map((inv: any) => {
                        // Zahlungsstand ausschließlich vom Server; ohne ihn keine Beträge erfinden.
                        const payment = summarizeInvoicePayment(inv);
                        const openAmount = payment.known ? (payment.open ?? 0) : 0;
                        const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== 'paid' && (!payment.known || openAmount > 0);
                        return (
                          <li key={inv._id} className="cb-invoice">
                            <Receipt className="h-4 w-4 text-[var(--primary-blue,#1a2a5e)] flex-shrink-0 mt-0.5" aria-hidden="true" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-[var(--gray-800,#1a202c)]">Rechnung {inv.invoiceNumber}</span>
                                <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${getInvoiceStatusBadgeClass(inv.status)}`}>
                                  {getInvoiceStatusLabel(inv.status)}
                                </span>
                                {payment.known && (
                                  <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${INVOICE_PAYMENT_TONE_CLASSES[payment.tone]}`}>
                                    {payment.label}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-x-3 gap-y-0.5 mt-0.5 flex-wrap text-xs text-[var(--gray-700,#2d3748)]">
                                <span>Gesamt (brutto): <strong>{formatEUR(inv.total)}</strong></span>
                                {payment.known && (payment.received ?? 0) > 0 && <span>Bezahlt: <strong>{formatEUR(payment.received ?? 0)}</strong></span>}
                                {payment.known && openAmount > 0 && (
                                  <span className={isOverdue ? 'text-red-700 font-semibold' : ''}>Offen: <strong>{formatEUR(openAmount)}</strong></span>
                                )}
                                {payment.known && (payment.refundPending ?? 0) > 0 && (
                                  <span className="font-semibold text-violet-800">Überzahlt · Erstattung offen {formatEUR(payment.refundPending ?? 0)}</span>
                                )}
                                {inv.dueDate && (
                                  <span className={isOverdue ? 'text-red-700 font-semibold' : 'text-[var(--gray-600,#4a5568)]'}>
                                    {isOverdue && <AlertCircle className="inline h-3 w-3 mr-0.5" aria-hidden="true" />}
                                    {isOverdue ? 'Überfällig seit' : 'Fällig am'} {formatDate(inv.dueDate)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="cb-invoice-actions">
                              <Button
                                type="button"
                                variant="outline" className="cb-btn-secondary"
                                size="sm"
                                onClick={() => {
                                  onClose();
                                  navigate(buildInvoiceDeepLink(inv._id), { state: { highlightInvoiceId: inv._id, openInvoiceId: inv._id } });
                                }}
                              >
                                {payment.known && openAmount > 0 ? 'Rechnung öffnen & bezahlen' : 'Rechnung öffnen'}
                              </Button>
                              <Button
                                type="button"
                                variant="outline" className="cb-btn-secondary"
                                size="sm"
                                disabled={pdfInvoiceId === inv._id}
                                aria-label={`PDF der Rechnung ${inv.invoiceNumber} herunterladen`}
                                onClick={async () => {
                                  setPdfInvoiceId(inv._id);
                                  try {
                                    await downloadInvoicePdf(inv._id, inv.invoiceNumber);
                                  } catch (error) {
                                    toast({
                                      title: 'Rechnungs-PDF konnte nicht geladen werden',
                                      description: error instanceof Error ? error.message : 'Bitte versuchen Sie es später erneut.',
                                      variant: 'destructive',
                                    });
                                  } finally {
                                    setPdfInvoiceId(null);
                                  }
                                }}
                              >
                                <Download className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                                {pdfInvoiceId === inv._id ? 'Lädt …' : 'PDF'}
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <section className="cb-dialog-card" aria-labelledby="cb-dialog-payments">
                  <h3 id="cb-dialog-payments" className="cb-dialog-card-title">Zahlungseingänge</h3>
                  {paymentsState === 'loading' ? (
                    <p className="text-sm text-[var(--gray-600,#4a5568)]">Zahlungen werden geladen …</p>
                  ) : paymentsState === 'error' ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-red-700" role="alert">
                      <AlertCircle className="h-4 w-4" aria-hidden="true" /> Zahlungen konnten nicht geladen werden.
                      <Button type="button" variant="outline" className="cb-btn-secondary" size="sm" onClick={() => setReloadKey((key) => key + 1)}>Erneut versuchen</Button>
                    </div>
                  ) : (paymentOverview?.payments || []).length === 0 ? (
                    <p className="text-sm text-[var(--gray-600,#4a5568)]">Noch keine Zahlung eingegangen.</p>
                  ) : (
                    <ul className="space-y-2">
                      {(paymentOverview?.payments || []).map((payment) => (
                        <li key={payment._id} className="cb-payment">
                          <Euro className="h-4 w-4 text-green-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-green-800">{formatEUR(payment.effectiveAmount ?? payment.amount)}</span>
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-green-50 text-green-800 border border-green-200 font-semibold">
                                {getPaymentMethodLabel(payment.paymentMethod)}
                              </span>
                              {Number(payment.refundedAmount || 0) > 0 && (
                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-800 border border-violet-200 font-semibold">
                                  {payment.status === 'refunded' ? 'Erstattet' : `Teilweise erstattet: ${formatEUR(payment.refundedAmount)}`}
                                </span>
                              )}
                              <span className="text-xs text-[var(--gray-600,#4a5568)]">{formatDateTime(payment.paymentDate)}</span>
                            </div>
                            <p className="text-xs text-[var(--gray-700,#2d3748)] mt-0.5">
                              {(payment.allocations || []).length > 0
                                ? `Zugeordnet: ${payment.allocations.map((allocation) => `Rechnung ${allocation.invoiceNumber} (${formatEUR(allocation.allocatedAmount)})`).join(', ')}`
                                : 'Vorauszahlung (noch keiner Rechnung zugeordnet)'}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </TabsContent>

              {/* ---------------- Versand ---------------- */}
              <TabsContent value="shipping" className="space-y-4 mt-4">
                {inboundState === 'loading' ? (
                  <p className="flex items-center gap-2 text-sm text-[var(--gray-600,#4a5568)]"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Versandstand wird geladen …</p>
                ) : inboundState === 'error' ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-red-700" role="alert">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" /> Versandstand konnte nicht geladen werden.
                    <Button type="button" variant="outline" className="cb-btn-secondary" size="sm" onClick={() => setReloadKey((key) => key + 1)}>Erneut versuchen</Button>
                  </div>
                ) : inboundVisible && inboundView ? (
                  <InboundLabelBlock
                    bookingId={booking._id}
                    bookingNumber={booking.bookingNumber}
                    view={inboundView}
                    onViewChange={setInboundView}
                    variant="dialog"
                  />
                ) : null}

                {/* DHL-8: der QR-Code ist eine data:-URL - Browser blockieren das Oeffnen in einem
                    neuen Tab, daher direkt hier anzeigen (am Schalter vorzeigen). */}
                {booking.returnQRCodeUrl && /^(data:image\/|https:\/\/)/i.test(booking.returnQRCodeUrl) && (
                  <figure className="cb-qr">
                    <img className="cb-qr-image" src={booking.returnQRCodeUrl} alt={`DHL-QR-Code zur Einsendung der Buchung ${bookingLabel}`} />
                    <figcaption className="cb-qr-caption">
                      <QrCode className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                      QR-Code für die DHL-Filiale – am Schalter vorzeigen, falls Sie das Einsendelabel nicht selbst drucken.
                    </figcaption>
                  </figure>
                )}
                {(booking.returnCreatedAt || booking.returnReceivedAt) && (
                  <ul className="cb-dialog-facts">
                    {booking.returnCreatedAt && <li><Clock className="h-4 w-4" aria-hidden="true" /> Einsendelabel erstellt am {formatDateTime(booking.returnCreatedAt)}</li>}
                    {booking.returnReceivedAt && <li><CheckCircle className="h-4 w-4" aria-hidden="true" /> Gerät eingegangen am {formatDateTime(booking.returnReceivedAt)}</li>}
                  </ul>
                )}

                {outboundOrders.length > 0 && (
                  <section className="cb-dialog-card" aria-labelledby="cb-dialog-outbound">
                    <h3 id="cb-dialog-outbound" className="cb-dialog-card-title">Auslieferung an Sie (McRepair → Sie)</h3>
                    <ul className="space-y-2">
                      {outboundOrders.map((entry: any, index: number) => (
                        <li key={entry.orderId || entry._id || index} className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--gray-200,#d8dce6)] bg-[var(--gray-50,#f5f6f8)] p-2 text-sm">
                          <span className="font-semibold">{[entry.device, entry.orderNumber ? `Auftrag ${entry.orderNumber}` : ''].filter(Boolean).join(' · ') || 'Auftrag'}</span>
                          <span className="font-mono">{entry.outboundShipment.trackingNumber}</span>
                          {entry.outboundShipment.status && (
                            <Badge className="bg-blue-100 text-[var(--primary-blue,#1a2a5e)] border border-blue-300 text-xs font-bold">
                              {getShippingStatusLabel(entry.outboundShipment.status)}
                            </Badge>
                          )}
                          <a href={dhlTrackingUrl(entry.outboundShipment.trackingNumber)} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1">
                            Sendung verfolgen <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {isOutboundLegacyLabel && (
                  <section className="cb-dialog-card" aria-labelledby="cb-dialog-legacy-outbound">
                    <h3 id="cb-dialog-legacy-outbound" className="cb-dialog-card-title">Versandlabel an Sie (McRepair → Sie, älteres Buchungslabel)</h3>
                    {booking.trackingNumber && (
                      <p className="text-sm">Sendungsnummer: <span className="font-mono font-semibold">{booking.trackingNumber}</span>
                        {booking.shippingStatus && <> · {getShippingStatusLabel(booking.shippingStatus)}</>}
                      </p>
                    )}
                    {booking.shippingLabelUrl && (
                      <Button type="button" variant="outline" size="sm" className="cb-btn-secondary mt-2" onClick={() => void handleDownloadOutbound()} disabled={downloadingOutbound}>
                        <Download className="mr-1.5 h-4 w-4" aria-hidden="true" /> {downloadingOutbound ? 'Lädt …' : 'Versandlabel herunterladen (PDF)'}
                      </Button>
                    )}
                  </section>
                )}

                {booking.liveShippingTracking?.events && booking.liveShippingTracking.events.length > 0 && (
                  <section className="cb-dialog-card" aria-labelledby="cb-dialog-dhl-events">
                    <h3 id="cb-dialog-dhl-events" className="cb-dialog-card-title">
                      Sendungsverlauf DHL {booking.trackingNumber ? `(${booking.trackingNumber})` : ''}
                    </h3>
                    <ul className="space-y-2">
                      {booking.liveShippingTracking.events.slice(0, 10).map((event, idx) => (
                        <li key={`${event.timestamp || 'no-time'}-${idx}`} className="rounded-lg p-2 bg-[var(--gray-50,#f5f6f8)] border border-[var(--gray-200,#d8dce6)]">
                          <p className="text-sm font-semibold text-[var(--gray-800,#1a202c)]">{event.description || event.status || 'Statusupdate'}</p>
                          <p className="text-xs text-[var(--gray-600,#4a5568)] mt-0.5">
                            {event.timestamp ? formatDateTime(event.timestamp) : 'Zeit unbekannt'}
                            {event.location ? ` • ${event.location}` : ''}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {inboundView && inboundView.inbound.state === 'ready' && !inboundView.inbound.deviceReceived && (
                  <section className="cb-dialog-card cb-dialog-card--hint" aria-labelledby="cb-dialog-howto">
                    <h3 id="cb-dialog-howto" className="cb-dialog-card-title">So senden Sie Ihr Gerät ein</h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-[var(--gray-700,#2d3748)]">
                      <li>Einsendelabel herunterladen und ausdrucken</li>
                      <li>Gerät sicher verpacken (ein Paket für alle Geräte dieser Buchung)</li>
                      <li>Label gut sichtbar auf das Paket kleben</li>
                      <li>Paket in einer DHL-Filiale oder Packstation abgeben</li>
                    </ol>
                  </section>
                )}

                {inboundState === 'ready' && !inboundVisible && outboundOrders.length === 0 && !isOutboundLegacyLabel && (
                  <p className="text-sm text-[var(--gray-600,#4a5568)]">Noch keine Versanddaten vorhanden.</p>
                )}
              </TabsContent>

              {/* ---------------- Shop-Artikel ---------------- */}
              {productItems.length > 0 && (
                <TabsContent value="items" className="space-y-3 mt-4">
                  {productItems.map((item) => (
                    <section key={item._id || item.orderId} className="cb-dialog-card">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <h3 className="cb-dialog-card-title !mb-0">
                          Shop-Artikel{item.orderNumber ? ` · Auftrag ${item.orderNumber}` : ''}
                        </h3>
                        <Badge className={`${statusBadgeClass(item.status || 'pending')} cb-status-badge`}>{statusLabel(item.status)}</Badge>
                      </div>
                      {item.products && item.products.length > 0 ? (
                        <ul className="space-y-2">
                          {item.products.map((product, idx) => (
                            <li key={idx} className="flex justify-between items-center gap-2 text-sm p-2 bg-[var(--gray-50,#f5f6f8)] rounded-lg">
                              <div className="min-w-0">
                                <p className="font-semibold text-[var(--gray-800,#1a202c)]">{product.name}</p>
                                <p className="text-xs text-[var(--gray-600,#4a5568)]">Menge: {product.quantity} × {formatEUR(product.price)}</p>
                              </div>
                              <p className="font-bold text-[var(--primary-blue,#1a2a5e)] flex-shrink-0">{formatEUR(product.totalPrice)}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-[var(--gray-600,#4a5568)]">Keine Produkte</p>
                      )}
                    </section>
                  ))}
                </TabsContent>
              )}

              {/* ---------------- Verlauf ---------------- */}
              <TabsContent value="timeline" className="space-y-3 mt-4">
                {booking.timeline && booking.timeline.length > 0 ? (
                  <ol className="space-y-2">
                    {booking.timeline.map((event, index) => (
                      <li key={event._id || `${event.completedAt}-${index}`} className="cb-timeline-entry">
                        <CheckCircle className="h-5 w-5 text-green-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-[var(--primary-blue,#1a2a5e)]">
                            {event.title || STATUS_LABELS_DE[event.status] || event.status}
                          </p>
                          {event.description && <p className="text-sm text-[var(--gray-700,#2d3748)]">{event.description}</p>}
                          <p className="text-xs text-[var(--gray-600,#4a5568)] mt-0.5">
                            {event.completedAt ? formatDateTime(event.completedAt) : 'Zeitpunkt nicht erfasst'}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-[var(--gray-600,#4a5568)]">Noch keine Einträge im Verlauf.</p>
                )}
              </TabsContent>

              {/* ---------------- Adressen ---------------- */}
              <TabsContent value="contact" className="space-y-4 mt-4">
                <section className="cb-dialog-card" aria-labelledby="cb-dialog-contact">
                  <h3 id="cb-dialog-contact" className="cb-dialog-card-title">Kontakt</h3>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-2 border-[var(--accent-yellow,#f5b800)] flex-shrink-0">
                      <AvatarImage src={customer.avatar} alt="" />
                      <AvatarFallback className="text-sm font-bold bg-[var(--primary-blue,#1a2a5e)] text-white">
                        {String(customer.firstName || customer.name || customer.email || '?').charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 text-sm">
                      <p className="font-bold text-[var(--gray-800,#1a202c)]">
                        {customer.firstName ? `${customer.firstName} ${customer.lastName || ''}` : (customer.name || customer.email)}
                      </p>
                      {customer.email && <p className="text-[var(--gray-600,#4a5568)]">{customer.email}</p>}
                      <p className="text-[var(--gray-600,#4a5568)]">Telefon: {customer.phone || 'nicht angegeben'}</p>
                    </div>
                  </div>
                </section>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <section className="cb-dialog-card" aria-labelledby="cb-dialog-billing">
                    <h3 id="cb-dialog-billing" className="cb-dialog-card-title flex items-center gap-1.5"><CreditCard className="h-4 w-4" aria-hidden="true" /> Rechnungsadresse</h3>
                    {renderAddress(billAddr)}
                  </section>
                  <section className="cb-dialog-card" aria-labelledby="cb-dialog-delivery">
                    <h3 id="cb-dialog-delivery" className="cb-dialog-card-title flex items-center gap-1.5"><Home className="h-4 w-4" aria-hidden="true" /> Lieferadresse</h3>
                    {deliverySameAsInvoice
                      ? <p className="text-sm italic text-[var(--gray-600,#4a5568)]">{hasAddressData(billAddr) ? 'Identisch mit Rechnungsadresse' : 'Nicht angegeben'}</p>
                      : renderAddress(deliveryAddr)}
                  </section>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
