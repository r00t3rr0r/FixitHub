import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getEPartOrders,
  getSuppliers,
  createEPartOrder,
  updateEPartOrder,
  receiveOrderItems,
  cancelEPartOrder,
  getEPartOrderById,
  getOrderStatistics,
  createSupplier,
  updateSupplier,
  uploadInvoice,
  downloadInvoice,
  requestReturnExchange,
  updateReturnExchange,
  type EPartOrder,
  type Supplier,
  type OrderStatistics,
} from '@/api/epartOrders';
import { getParts, type Part } from '@/api/parts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/useToast';
import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Edit,
  Euro,
  Eye,
  Loader2,
  Package,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShoppingCart,
  Truck,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import NeedListManagement from '@/components/admin/NeedListManagement';
import { cn, formatEUR } from '@/lib/utils';
import { formatDecimalInput, parseDecimalInput } from '@/lib/parseDecimalInput';

// ---------------------------------------------------------------------------
// Fachliche Bezeichnungen (identisch mit den Server-Texten in epartOrderService.js)
// ---------------------------------------------------------------------------
type OrderStatus = EPartOrder['status'];
type PaymentStatus = EPartOrder['paymentStatus'];

const STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  pending: 'Offen',
  confirmed: 'Bestellt',
  shipped: 'Versendet',
  partial: 'Teilweise erhalten',
  received: 'Erhalten',
  cancelled: 'Storniert',
};
const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: 'border-slate-300 bg-white text-slate-700',
  pending: 'border-amber-300 bg-amber-50 text-amber-800',
  confirmed: 'border-blue-300 bg-blue-50 text-blue-800',
  shipped: 'border-indigo-300 bg-indigo-50 text-indigo-800',
  partial: 'border-orange-300 bg-orange-50 text-orange-800',
  received: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  cancelled: 'border-red-300 bg-red-50 text-red-800',
};
const ITEM_STATUS_LABELS: Record<string, string> = {
  pending: 'Offen',
  partial: 'Teilweise erhalten',
  received: 'Erhalten',
  cancelled: 'Storniert',
};
// Manuell setzbar; "Teilweise erhalten"/"Erhalten" nur ueber Wareneingang, "Storniert" ueber Stornieren.
const MANUAL_STATUSES: OrderStatus[] = ['draft', 'pending', 'confirmed', 'shipped'];
const CREATE_STATUSES: OrderStatus[] = ['draft', 'pending', 'confirmed'];
const RECEIVABLE_STATUSES: OrderStatus[] = ['confirmed', 'shipped', 'partial'];
const PAYMENT_LABELS: Record<string, string> = {
  unpaid: 'Unbezahlt',
  partial: 'Teilweise bezahlt',
  paid: 'Bezahlt',
};
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  account: 'Auf Rechnung (Lieferantenkonto)',
  bank_transfer: 'Überweisung',
  credit_card: 'Kreditkarte',
  check: 'Scheck',
  cash: 'Bar',
};
const RETURN_STATUS_LABELS: Record<string, string> = {
  requested: 'Angefordert',
  approved: 'Genehmigt',
  in_transit: 'Unterwegs',
  completed: 'Abgeschlossen',
  rejected: 'Abgelehnt',
};
const TIMELINE_LABELS: Record<string, string> = {
  created: 'Angelegt',
  tracking_updated: 'Sendungsnummer',
  delivery_date_updated: 'Lieferdatum',
  notes_updated: 'Notiz',
  payment_updated: 'Zahlung',
  items_received: 'Wareneingang',
  invoice_uploaded: 'Rechnung',
  return_exchange_requested: 'Rücksendung/Umtausch',
  ...STATUS_LABELS,
};
const ORDERS_PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const formatDate = (value?: string | Date | null) => {
  if (!value) return '–';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '–';
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const formatDateTime = (value?: string | Date | null) => {
  if (!value) return 'Zeitpunkt nicht erfasst';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Zeitpunkt nicht erfasst';
  return date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const toDateInput = (value?: string | null) => (value ? String(value).slice(0, 10) : '');
const errorText = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn('whitespace-nowrap font-medium', STATUS_BADGE_CLASS[status] || '')}>
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const className = status === 'paid'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
    : status === 'partial'
      ? 'border-amber-300 bg-amber-50 text-amber-800'
      : 'border-slate-300 bg-white text-slate-700';
  return (
    <Badge variant="outline" className={cn('whitespace-nowrap font-medium', className)}>
      {PAYMENT_LABELS[status] || status}
    </Badge>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-700" role="alert">
      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

function LoadState({ state, loadingText, errorText: errorMessage, onRetry, emptyText, colSpan }: {
  state: 'loading' | 'error' | 'empty';
  loadingText: string;
  errorText: string;
  emptyText: string;
  onRetry: () => void;
  colSpan: number;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-24 text-center text-sm">
        {state === 'loading' && (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {loadingText}
          </span>
        )}
        {state === 'error' && (
          <span className="inline-flex flex-wrap items-center justify-center gap-3 text-red-700">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {errorMessage}
            <Button size="sm" variant="outline" onClick={onRetry}>Erneut versuchen</Button>
          </span>
        )}
        {state === 'empty' && <span className="text-muted-foreground">{emptyText}</span>}
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Lieferanten-Formular (eine Komponente fuer Anlegen und Bearbeiten)
// ---------------------------------------------------------------------------
type SupplierForm = {
  name: string;
  email: string;
  contactPerson: string;
  phone: string;
  website: string;
  ustId: string;
  street: string;
  zipCode: string;
  city: string;
  state: string;
  country: string;
  iban: string;
  bic: string;
  bankName: string;
  accountHolder: string;
  paymentTerms: string;
  leadTime: string;
  isActive: boolean;
};

const emptySupplierForm = (): SupplierForm => ({
  name: '', email: '', contactPerson: '', phone: '', website: '', ustId: '',
  street: '', zipCode: '', city: '', state: '', country: 'Deutschland',
  iban: '', bic: '', bankName: '', accountHolder: '',
  paymentTerms: '30 Tage netto', leadTime: '7', isActive: true,
});

const supplierToForm = (supplier: Supplier): SupplierForm => ({
  name: supplier.name || '',
  email: supplier.email || '',
  contactPerson: supplier.contactPerson || '',
  phone: supplier.phone || '',
  website: supplier.website || '',
  ustId: supplier.ustId || '',
  street: supplier.address?.street || '',
  zipCode: supplier.address?.zipCode || '',
  city: supplier.address?.city || '',
  state: supplier.address?.state || '',
  country: supplier.address?.country || '',
  iban: supplier.paymentInformation?.iban || '',
  bic: supplier.paymentInformation?.bic || '',
  bankName: supplier.paymentInformation?.bankName || '',
  accountHolder: supplier.paymentInformation?.accountHolder || '',
  paymentTerms: supplier.paymentTerms || '',
  leadTime: supplier.leadTime !== undefined && supplier.leadTime !== null ? String(supplier.leadTime) : '',
  isActive: supplier.isActive !== false,
});

const validateSupplierForm = (form: SupplierForm) => {
  const errors: Partial<Record<keyof SupplierForm, string>> = {};
  if (!form.name.trim()) errors.name = 'Bitte einen Namen eingeben.';
  if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = 'Bitte eine gültige E-Mail-Adresse eingeben.';
  if (form.leadTime.trim()) {
    const leadTime = Number(form.leadTime.trim());
    if (!Number.isInteger(leadTime) || leadTime < 0 || leadTime > 365) {
      errors.leadTime = 'Ganze Zahl zwischen 0 und 365 Tagen.';
    }
  }
  return errors;
};

const supplierFormToPayload = (form: SupplierForm, includeStatus: boolean): Partial<Supplier> => ({
  name: form.name.trim(),
  email: form.email.trim(),
  contactPerson: form.contactPerson.trim(),
  phone: form.phone.trim(),
  website: form.website.trim(),
  ustId: form.ustId.trim(),
  address: {
    street: form.street.trim(),
    zipCode: form.zipCode.trim(),
    city: form.city.trim(),
    state: form.state.trim(),
    country: form.country.trim(),
  },
  paymentInformation: {
    iban: form.iban.trim(),
    bic: form.bic.trim(),
    bankName: form.bankName.trim(),
    accountHolder: form.accountHolder.trim(),
  },
  paymentTerms: form.paymentTerms.trim(),
  leadTime: form.leadTime.trim() === '' ? undefined : Number(form.leadTime.trim()),
  ...(includeStatus ? { isActive: form.isActive } : {}),
});

function SupplierFormFields({
  form,
  errors,
  onChange,
  showStatus,
  idPrefix,
}: {
  form: SupplierForm;
  errors: Partial<Record<keyof SupplierForm, string>>;
  onChange: (key: keyof SupplierForm, value: string | boolean) => void;
  showStatus: boolean;
  idPrefix: string;
}) {
  const field = (key: keyof SupplierForm, label: string, props: { placeholder?: string; type?: string; autoComplete?: string; inputMode?: 'numeric' | 'email' | 'tel' | 'url' | 'text'; className?: string; required?: boolean } = {}) => (
    <div className={props.className}>
      <Label htmlFor={`${idPrefix}-${key}`} className="text-xs font-medium text-slate-700">
        {label}{props.required ? ' *' : ''}
      </Label>
      <Input
        id={`${idPrefix}-${key}`}
        type={props.type || 'text'}
        inputMode={props.inputMode}
        autoComplete={props.autoComplete || 'off'}
        placeholder={props.placeholder}
        value={String(form[key] ?? '')}
        onChange={(e) => onChange(key, e.target.value)}
        aria-invalid={Boolean(errors[key])}
        className={cn('mt-1 h-9 text-sm', errors[key] && 'border-red-500 focus-visible:ring-red-500')}
      />
      <FieldError message={errors[key]} />
    </div>
  );

  const sectionTitle = 'border-b border-slate-200 pb-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-slate-600';

  return (
    <div className="space-y-5">
      <section className="space-y-3" aria-labelledby={`${idPrefix}-master`}>
        <h3 id={`${idPrefix}-master`} className={sectionTitle}>Stammdaten</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field('name', 'Name', { placeholder: 'z. B. Teile Großhandel GmbH', required: true })}
          {field('email', 'E-Mail für Bestellungen', { type: 'email', inputMode: 'email', placeholder: 'bestellung@lieferant.de', required: true })}
          {field('contactPerson', 'Ansprechpartner', { placeholder: 'Vor- und Nachname' })}
          {field('phone', 'Telefon', { type: 'tel', inputMode: 'tel', placeholder: '+49 30 1234567' })}
          {field('website', 'Website', { inputMode: 'url', placeholder: 'https://lieferant.de' })}
          {field('ustId', 'USt-IdNr.', { placeholder: 'DE123456789' })}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby={`${idPrefix}-address`}>
        <h3 id={`${idPrefix}-address`} className={sectionTitle}>Adresse</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
          {field('street', 'Straße und Hausnummer', { className: 'sm:col-span-6' })}
          {field('zipCode', 'PLZ', { className: 'sm:col-span-2', inputMode: 'numeric' })}
          {field('city', 'Ort', { className: 'sm:col-span-4' })}
          {field('state', 'Bundesland / Region', { className: 'sm:col-span-3' })}
          {field('country', 'Land', { className: 'sm:col-span-3' })}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby={`${idPrefix}-bank`}>
        <h3 id={`${idPrefix}-bank`} className={sectionTitle}>Bankverbindung</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field('iban', 'IBAN', { placeholder: 'DE89 3704 0044 0532 0130 00' })}
          {field('bic', 'BIC', { placeholder: 'COBADEFFXXX' })}
          {field('bankName', 'Bank')}
          {field('accountHolder', 'Kontoinhaber')}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby={`${idPrefix}-terms`}>
        <h3 id={`${idPrefix}-terms`} className={sectionTitle}>Konditionen</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {field('paymentTerms', 'Zahlungsbedingungen', { placeholder: 'z. B. 30 Tage netto' })}
          {field('leadTime', 'Lieferzeit (Tage)', { inputMode: 'numeric', placeholder: '7' })}
          {showStatus && (
            <div>
              <Label htmlFor={`${idPrefix}-status`} className="text-xs font-medium text-slate-700">Status</Label>
              <Select value={form.isActive ? 'active' : 'inactive'} onValueChange={(value) => onChange('isActive', value === 'active')}>
                <SelectTrigger id={`${idPrefix}-status`} className="mt-1 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktiv – in Bestellungen auswählbar</SelectItem>
                  <SelectItem value="inactive">Inaktiv – ausgeblendet, kann wieder aktiviert werden</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bestellung anlegen
// ---------------------------------------------------------------------------
type OrderLineDraft = { key: string; partId: string; quantity: string; unitPrice: string };
type NewOrderDraft = {
  supplierId: string;
  status: OrderStatus;
  items: OrderLineDraft[];
  expectedDeliveryDate: string;
  tax: string;
  shippingCost: string;
  paymentMethod: string;
  notes: string;
};
let lineKeyCounter = 0;
const newLine = (): OrderLineDraft => ({ key: `line-${Date.now()}-${(lineKeyCounter += 1)}`, partId: '', quantity: '1', unitPrice: '' });
const emptyOrderDraft = (): NewOrderDraft => ({
  supplierId: '',
  status: 'draft',
  items: [newLine()],
  expectedDeliveryDate: '',
  tax: '',
  shippingCost: '',
  paymentMethod: 'account',
  notes: '',
});

// ---------------------------------------------------------------------------
// Seite
// ---------------------------------------------------------------------------
type DetailForm = {
  status: OrderStatus;
  trackingNumber: string;
  expectedDeliveryDate: string;
  paymentStatus: PaymentStatus;
  notes: string;
};
const orderToDetailForm = (order: EPartOrder): DetailForm => ({
  status: order.status,
  trackingNumber: order.trackingNumber || '',
  expectedDeliveryDate: toDateInput(order.expectedDeliveryDate),
  paymentStatus: order.paymentStatus,
  notes: order.notes || '',
});

const PAGE_TABS = ['need-lists', 'orders', 'suppliers'] as const;
type PageTab = typeof PAGE_TABS[number];

export default function EPartOrderManagement() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') as PageTab | null;
  const activeTab: PageTab = requestedTab && PAGE_TABS.includes(requestedTab) ? requestedTab : 'orders';
  const setActiveTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const dialogContentClass = 'w-[calc(100vw-1.5rem)] gap-0 overflow-hidden border-slate-200 p-0 shadow-xl';
  const dialogHeaderClass = 'space-y-1 border-b border-slate-800 bg-[#1a2a5e] px-5 py-3 pr-12 text-left';
  const dialogTitleClass = 'text-base font-semibold text-white';
  const dialogDescriptionClass = 'text-xs text-slate-200';
  const dialogBodyClass = 'space-y-4 px-5 py-4';
  const dialogFooterClass = 'gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3';
  // Schliessen-X (letztes Kind von DialogContent) auf dem dunklen Kopf sichtbar machen.
  const closeButtonOnDark = '[&>button:last-child]:text-white [&>button:last-child]:opacity-90';

  // ---------------- Bestellungen
  const [orders, setOrders] = useState<EPartOrder[]>([]);
  const [ordersState, setOrdersState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [ordersError, setOrdersError] = useState('');
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: ORDERS_PAGE_SIZE });
  const [page, setPage] = useState(1);
  const [statistics, setStatistics] = useState<OrderStatistics | null>(null);
  // ?status=… aus der URL (Dashboard-Links: aktiv / ausstehend / verzoegert oder ein Einzelstatus) -
  // der Server wendet dieselbe Gruppenregel an wie der Dashboard-Zähler (listFilterGroups.js).
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const ordersRequestRef = useRef(0);

  // ---------------- Lieferanten
  const [activeSuppliers, setActiveSuppliers] = useState<Supplier[]>([]);
  const [supplierRows, setSupplierRows] = useState<Supplier[]>([]);
  const [supplierListFilter, setSupplierListFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [suppliersState, setSuppliersState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [suppliersError, setSuppliersError] = useState('');
  const [parts, setParts] = useState<Part[]>([]);
  const [partsError, setPartsError] = useState('');

  // ---------------- Dialoge
  const [showCreateOrderDialog, setShowCreateOrderDialog] = useState(false);
  const [newOrder, setNewOrder] = useState<NewOrderDraft>(emptyOrderDraft);
  const [orderErrors, setOrderErrors] = useState<Record<string, string>>({});
  const [creatingOrder, setCreatingOrder] = useState(false);

  const [supplierDialog, setSupplierDialog] = useState<{ open: boolean; mode: 'create' | 'edit'; supplierId?: string; returnTo?: 'order' }>({ open: false, mode: 'create' });
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(emptySupplierForm);
  const [supplierErrors, setSupplierErrors] = useState<Partial<Record<keyof SupplierForm, string>>>({});
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const [selectedOrder, setSelectedOrder] = useState<EPartOrder | null>(null);
  const [showOrderDetailsDialog, setShowOrderDetailsDialog] = useState(false);
  const [openingOrderId, setOpeningOrderId] = useState<string | null>(null);
  const [detailForm, setDetailForm] = useState<DetailForm | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsSavedAt, setDetailsSavedAt] = useState<Date | null>(null);
  const [detailsError, setDetailsError] = useState('');

  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [receiveDraft, setReceiveDraft] = useState<Record<string, string>>({});
  const [receiving, setReceiving] = useState(false);

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const [showInvoiceUploadDialog, setShowInvoiceUploadDialog] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);

  const [showReturnExchangeDialog, setShowReturnExchangeDialog] = useState(false);
  const [returnExchangeForm, setReturnExchangeForm] = useState<{
    type: 'return' | 'exchange';
    reason: string;
    description: string;
    affectedItems: Array<{ itemId: string; quantity: string; issueDescription: string }>;
  }>({ type: 'return', reason: '', description: '', affectedItems: [] });
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [updatingReturn, setUpdatingReturn] = useState(false);

  // ---------------------------------------------------------------- Laden
  useEffect(() => {
    const handle = window.setTimeout(() => setSearchQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, supplierFilter, searchQuery]);

  const loadOrders = useCallback(async () => {
    const requestId = ordersRequestRef.current + 1;
    ordersRequestRef.current = requestId;
    setOrdersState('loading');
    try {
      const [ordersData, statsData] = await Promise.all([
        getEPartOrders({
          status: statusFilter !== 'all' ? statusFilter : undefined,
          supplierId: supplierFilter !== 'all' ? supplierFilter : undefined,
          search: searchQuery || undefined,
          page,
          limit: ORDERS_PAGE_SIZE,
        }),
        getOrderStatistics(),
      ]);
      if (ordersRequestRef.current !== requestId) return;
      setOrders(ordersData.orders || []);
      setPagination(ordersData.pagination || { total: 0, page: 1, pages: 1, limit: ORDERS_PAGE_SIZE });
      setStatistics(statsData);
      setOrdersState('ready');
    } catch (error) {
      if (ordersRequestRef.current !== requestId) return;
      setOrdersError(errorText(error, 'Unbekannter Fehler'));
      setOrdersState('error');
    }
  }, [statusFilter, supplierFilter, searchQuery, page]);

  const loadSuppliers = useCallback(async () => {
    setSuppliersState('loading');
    try {
      const [activeData, listData] = await Promise.all([
        getSuppliers({ isActive: true }),
        supplierListFilter === 'active'
          ? Promise.resolve(null)
          : getSuppliers(supplierListFilter === 'inactive' ? { isActive: false } : undefined),
      ]);
      const active = activeData.suppliers || [];
      setActiveSuppliers(active);
      setSupplierRows(listData ? listData.suppliers || [] : active);
      setSuppliersState('ready');
    } catch (error) {
      setSuppliersError(errorText(error, 'Unbekannter Fehler'));
      setSuppliersState('error');
    }
  }, [supplierListFilter]);

  const loadParts = useCallback(async () => {
    try {
      const partsData = await getParts({ limit: 1000 });
      setParts(partsData.parts || []);
      setPartsError('');
    } catch (error) {
      setPartsError(errorText(error, 'Ersatzteile konnten nicht geladen werden.'));
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  useEffect(() => {
    loadParts();
  }, [loadParts]);

  const refreshOrder = useCallback(async (orderId: string) => {
    const { order } = await getEPartOrderById(orderId);
    setSelectedOrder(order);
    setDetailForm(orderToDetailForm(order));
    return order as EPartOrder;
  }, []);

  const getSupplierName = (supplierId: string | Supplier | undefined | null) => {
    if (supplierId && typeof supplierId === 'object') return supplierId.name;
    const supplier = [...activeSuppliers, ...supplierRows].find((s) => s._id === supplierId);
    return supplier?.name || 'Unbekannter Lieferant';
  };

  // ---------------------------------------------------------------- Lieferanten
  const openCreateSupplier = (returnTo?: 'order') => {
    setSupplierForm(emptySupplierForm());
    setSupplierErrors({});
    if (returnTo === 'order') {
      // Sequentielle Dialoge statt verschachtelter Modals; Bestellentwurf bleibt erhalten.
      setShowCreateOrderDialog(false);
    }
    setSupplierDialog({ open: true, mode: 'create', returnTo });
  };

  const openEditSupplier = (supplier: Supplier) => {
    setSupplierForm(supplierToForm(supplier));
    setSupplierErrors({});
    setSupplierDialog({ open: true, mode: 'edit', supplierId: supplier._id });
  };

  const closeSupplierDialog = (open: boolean) => {
    if (open || savingSupplier) return;
    const returnTo = supplierDialog.returnTo;
    setSupplierDialog((prev) => ({ ...prev, open: false }));
    if (returnTo === 'order') setShowCreateOrderDialog(true);
  };

  const handleSupplierFieldChange = (key: keyof SupplierForm, value: string | boolean) => {
    setSupplierForm((prev) => ({ ...prev, [key]: value }));
    if (supplierErrors[key]) setSupplierErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSaveSupplier = async (event?: FormEvent) => {
    event?.preventDefault();
    if (savingSupplier) return;
    const errors = validateSupplierForm(supplierForm);
    setSupplierErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    setSavingSupplier(true);
    try {
      const isEdit = supplierDialog.mode === 'edit' && supplierDialog.supplierId;
      const response = isEdit
        ? await updateSupplier(supplierDialog.supplierId as string, supplierFormToPayload(supplierForm, true))
        : await createSupplier(supplierFormToPayload(supplierForm, false));
      const saved: Supplier | undefined = response?.supplier;
      const returnTo = supplierDialog.returnTo;
      setSupplierDialog((prev) => ({ ...prev, open: false }));
      await loadSuppliers();
      if (returnTo === 'order' && saved?._id) {
        setNewOrder((prev) => ({ ...prev, supplierId: saved._id }));
        setOrderErrors((prev) => ({ ...prev, supplierId: '' }));
        setShowCreateOrderDialog(true);
        toast({ title: `Lieferant „${saved.name}“ angelegt und ausgewählt` });
      } else {
        toast({ title: `Lieferant „${saved?.name || supplierForm.name}“ gespeichert` });
      }
    } catch (error) {
      const message = errorText(error, 'Unbekannter Fehler');
      if (/E-Mail/i.test(message)) setSupplierErrors((prev) => ({ ...prev, email: message }));
      else if (/Name/i.test(message) && !/existiert/.test(message)) setSupplierErrors((prev) => ({ ...prev, name: message }));
      else if (/Lieferzeit/i.test(message)) setSupplierErrors((prev) => ({ ...prev, leadTime: message }));
      toast({
        title: 'Lieferant konnte nicht gespeichert werden',
        description: `${message} Ihre Eingaben bleiben erhalten.`,
        variant: 'destructive',
      });
    } finally {
      setSavingSupplier(false);
    }
  };

  const handleReactivateSupplier = async (supplier: Supplier) => {
    setReactivatingId(supplier._id);
    try {
      await updateSupplier(supplier._id, { isActive: true });
      toast({ title: `Lieferant „${supplier.name}“ wieder aktiviert` });
      await loadSuppliers();
    } catch (error) {
      toast({ title: 'Lieferant konnte nicht aktiviert werden', description: errorText(error, 'Unbekannter Fehler'), variant: 'destructive' });
    } finally {
      setReactivatingId(null);
    }
  };

  // ---------------------------------------------------------------- Bestellung anlegen
  const openCreateOrder = () => {
    setOrderErrors({});
    setShowCreateOrderDialog(true);
  };

  const updateOrderLine = (key: string, field: keyof OrderLineDraft, value: string) => {
    setNewOrder((prev) => ({
      ...prev,
      items: prev.items.map((line) => (line.key === key ? { ...line, [field]: value } : line)),
    }));
    setOrderErrors((prev) => ({ ...prev, [`${key}.${field}`]: '', items: '' }));
  };

  const handlePartSelected = (key: string, partId: string) => {
    const part = parts.find((p) => p._id === partId);
    setNewOrder((prev) => ({
      ...prev,
      items: prev.items.map((line) => {
        if (line.key !== key) return line;
        const suggestedPrice = line.unitPrice.trim() === '' && part?.cost ? formatDecimalInput(part.cost) : line.unitPrice;
        return { ...line, partId, unitPrice: suggestedPrice };
      }),
    }));
    setOrderErrors((prev) => ({ ...prev, [`${key}.partId`]: '', items: '' }));
  };

  const orderPreview = useMemo(() => {
    const subtotal = newOrder.items.reduce((sum, line) => {
      const quantity = Number(line.quantity);
      const price = parseDecimalInput(line.unitPrice) ?? 0;
      return sum + (Number.isInteger(quantity) && quantity > 0 ? quantity * Math.max(0, price) : 0);
    }, 0);
    const shipping = Math.max(0, parseDecimalInput(newOrder.shippingCost) ?? 0);
    const tax = Math.max(0, parseDecimalInput(newOrder.tax) ?? 0);
    return { subtotal, shipping, tax, total: subtotal + shipping + tax };
  }, [newOrder]);

  const validateOrderDraft = () => {
    const errors: Record<string, string> = {};
    if (!newOrder.supplierId) errors.supplierId = 'Bitte einen Lieferanten auswählen.';
    if (newOrder.items.length === 0) errors.items = 'Bitte mindestens eine Position hinzufügen.';
    newOrder.items.forEach((line) => {
      if (!line.partId) errors[`${line.key}.partId`] = 'Bitte ein Ersatzteil auswählen.';
      const quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) errors[`${line.key}.quantity`] = 'Ganze Zahl ab 1.';
      if (line.unitPrice.trim() !== '') {
        const price = parseDecimalInput(line.unitPrice);
        if (price === null || price < 0) errors[`${line.key}.unitPrice`] = 'Betrag wie 12,50 eingeben.';
      }
    });
    (['tax', 'shippingCost'] as const).forEach((key) => {
      if (newOrder[key].trim() !== '') {
        const value = parseDecimalInput(newOrder[key]);
        if (value === null || value < 0) errors[key] = 'Betrag wie 4,90 eingeben (0 oder größer).';
      }
    });
    return errors;
  };

  const handleCreateOrder = async (event?: FormEvent) => {
    event?.preventDefault();
    if (creatingOrder) return;
    const errors = validateOrderDraft();
    setOrderErrors(errors);
    if (Object.values(errors).some(Boolean)) {
      toast({ title: 'Bitte die markierten Felder prüfen', variant: 'destructive' });
      return;
    }

    setCreatingOrder(true);
    try {
      const response = await createEPartOrder({
        supplierId: newOrder.supplierId,
        status: newOrder.status,
        items: newOrder.items.map((line) => ({
          partId: line.partId,
          quantity: Number(line.quantity),
          unitPrice: parseDecimalInput(line.unitPrice) ?? 0,
        })),
        expectedDeliveryDate: newOrder.expectedDeliveryDate || undefined,
        tax: parseDecimalInput(newOrder.tax) ?? 0,
        shippingCost: parseDecimalInput(newOrder.shippingCost) ?? 0,
        paymentMethod: newOrder.paymentMethod,
        notes: newOrder.notes,
      });
      toast({ title: `Bestellung ${response?.order?.orderNumber || ''} angelegt`.trim() });
      setShowCreateOrderDialog(false);
      setNewOrder(emptyOrderDraft());
      setOrderErrors({});
      await loadOrders();
    } catch (error) {
      toast({
        title: 'Bestellung konnte nicht angelegt werden',
        description: `${errorText(error, 'Unbekannter Fehler')} Ihre Eingaben bleiben erhalten.`,
        variant: 'destructive',
      });
    } finally {
      setCreatingOrder(false);
    }
  };

  // ---------------------------------------------------------------- Bestelldetails
  const handleViewOrder = async (orderId: string) => {
    setOpeningOrderId(orderId);
    try {
      await refreshOrder(orderId);
      setDetailsSavedAt(null);
      setDetailsError('');
      setShowOrderDetailsDialog(true);
    } catch (error) {
      toast({ title: 'Bestellung konnte nicht geladen werden', description: errorText(error, 'Unbekannter Fehler'), variant: 'destructive' });
    } finally {
      setOpeningOrderId(null);
    }
  };

  const detailsDirty = Boolean(selectedOrder && detailForm && (
    detailForm.status !== selectedOrder.status
    || detailForm.trackingNumber.trim() !== (selectedOrder.trackingNumber || '')
    || detailForm.expectedDeliveryDate !== toDateInput(selectedOrder.expectedDeliveryDate)
    || detailForm.paymentStatus !== selectedOrder.paymentStatus
    || detailForm.notes !== (selectedOrder.notes || '')
  ));

  const handleSaveDetails = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!selectedOrder || !detailForm || !detailsDirty || savingDetails) return;
    const payload: Parameters<typeof updateEPartOrder>[1] = {};
    if (detailForm.status !== selectedOrder.status) payload.status = detailForm.status;
    if (detailForm.trackingNumber.trim() !== (selectedOrder.trackingNumber || '')) payload.trackingNumber = detailForm.trackingNumber.trim();
    if (detailForm.expectedDeliveryDate !== toDateInput(selectedOrder.expectedDeliveryDate)) payload.expectedDeliveryDate = detailForm.expectedDeliveryDate;
    if (detailForm.paymentStatus !== selectedOrder.paymentStatus) payload.paymentStatus = detailForm.paymentStatus;
    if (detailForm.notes !== (selectedOrder.notes || '')) payload.notes = detailForm.notes;

    setSavingDetails(true);
    setDetailsError('');
    try {
      const { order } = await updateEPartOrder(selectedOrder._id, payload);
      setSelectedOrder(order);
      setDetailForm(orderToDetailForm(order));
      setDetailsSavedAt(new Date());
      toast({ title: `Bestellung ${order.orderNumber} gespeichert` });
      loadOrders();
    } catch (error) {
      const message = errorText(error, 'Unbekannter Fehler');
      setDetailsError(message);
      toast({ title: 'Änderungen konnten nicht gespeichert werden', description: `${message} Ihre Eingaben bleiben erhalten.`, variant: 'destructive' });
    } finally {
      setSavingDetails(false);
    }
  };

  // ---------------------------------------------------------------- Wareneingang
  const openReceiveDialog = () => {
    if (!selectedOrder) return;
    const draft: Record<string, string> = {};
    selectedOrder.items.forEach((item) => {
      const remaining = Math.max(0, item.quantity - item.receivedQuantity);
      if (remaining > 0 && item._id && item.status !== 'cancelled') draft[item._id] = String(remaining);
    });
    setReceiveDraft(draft);
    setShowReceiveDialog(true);
  };

  const receiveLines = useMemo(() => {
    if (!selectedOrder) return [];
    return selectedOrder.items
      .filter((item) => item._id && item.status !== 'cancelled' && item.quantity - item.receivedQuantity > 0)
      .map((item) => {
        const remaining = item.quantity - item.receivedQuantity;
        const text = receiveDraft[item._id as string] ?? '';
        const quantity = text.trim() === '' ? 0 : Number(text);
        let error = '';
        if (!Number.isInteger(quantity) || quantity < 0) error = 'Ganze Zahl ab 0 eingeben.';
        else if (quantity > remaining) error = `Höchstens ${remaining} Stück offen.`;
        return { item, remaining, text, quantity, error };
      });
  }, [selectedOrder, receiveDraft]);
  const receiveHasErrors = receiveLines.some((line) => line.error);
  const receiveTotal = receiveLines.reduce((sum, line) => sum + (line.error ? 0 : line.quantity), 0);

  const handleReceiveItems = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!selectedOrder || receiving || receiveHasErrors || receiveTotal <= 0) return;
    setReceiving(true);
    try {
      const items = receiveLines
        .filter((line) => line.quantity > 0)
        .map((line) => ({ itemId: line.item._id as string, quantity: line.quantity }));
      const { order } = await receiveOrderItems(selectedOrder._id, items);
      setSelectedOrder(order);
      setDetailForm(orderToDetailForm(order));
      setShowReceiveDialog(false);
      toast({
        title: order.status === 'received' ? 'Wareneingang gebucht – Bestellung vollständig erhalten' : 'Wareneingang gebucht – Bestellung teilweise erhalten',
        description: `${receiveTotal} Stück wurden dem Lager zugebucht.`,
      });
      loadOrders();
    } catch (error) {
      toast({ title: 'Wareneingang konnte nicht gebucht werden', description: errorText(error, 'Unbekannter Fehler'), variant: 'destructive' });
      try {
        await refreshOrder(selectedOrder._id);
      } catch {
        /* Anzeige bleibt beim letzten Stand */
      }
    } finally {
      setReceiving(false);
    }
  };

  // ---------------------------------------------------------------- Stornieren
  const handleCancelOrder = async () => {
    if (!selectedOrder || cancelling) return;
    setCancelling(true);
    try {
      const { order } = await cancelEPartOrder(selectedOrder._id, cancelReason.trim() || 'Storniert durch Mitarbeiter');
      setSelectedOrder(order);
      setDetailForm(orderToDetailForm(order));
      setShowCancelDialog(false);
      setCancelReason('');
      toast({ title: `Bestellung ${order.orderNumber} storniert` });
      loadOrders();
    } catch (error) {
      toast({ title: 'Bestellung konnte nicht storniert werden', description: errorText(error, 'Unbekannter Fehler'), variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  // ---------------------------------------------------------------- Rechnung
  const handleUploadInvoice = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!selectedOrder || !invoiceFile || uploadingInvoice) return;
    setUploadingInvoice(true);
    try {
      await uploadInvoice(selectedOrder._id, invoiceFile);
      toast({ title: 'Rechnung hochgeladen' });
      setShowInvoiceUploadDialog(false);
      setInvoiceFile(null);
      await refreshOrder(selectedOrder._id);
    } catch (error) {
      toast({ title: 'Rechnung konnte nicht hochgeladen werden', description: errorText(error, 'Unbekannter Fehler'), variant: 'destructive' });
    } finally {
      setUploadingInvoice(false);
    }
  };

  const handleDownloadInvoice = async (order: EPartOrder) => {
    try {
      const blob = await downloadInvoice(order._id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = order.invoiceFile?.originalName || `Rechnung-${order.orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({ title: 'Rechnung konnte nicht heruntergeladen werden', description: errorText(error, 'Unbekannter Fehler'), variant: 'destructive' });
    }
  };

  // ---------------------------------------------------------------- Ruecksendung / Umtausch
  const openReturnDialog = () => {
    if (!selectedOrder) return;
    const firstItem = selectedOrder.items.find((item) => item.receivedQuantity > 0);
    setReturnExchangeForm({
      type: 'return',
      reason: '',
      description: '',
      affectedItems: firstItem?._id ? [{ itemId: firstItem._id, quantity: '1', issueDescription: '' }] : [],
    });
    setShowReturnExchangeDialog(true);
  };

  const handleRequestReturnExchange = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!selectedOrder || submittingReturn) return;
    if (returnExchangeForm.affectedItems.length === 0) {
      toast({ title: 'Bitte mindestens eine Position auswählen', variant: 'destructive' });
      return;
    }
    if (!returnExchangeForm.reason.trim() || !returnExchangeForm.description.trim()) {
      toast({ title: 'Bitte Grund und Beschreibung angeben', variant: 'destructive' });
      return;
    }
    const invalidQuantity = returnExchangeForm.affectedItems.find((entry) => {
      const quantity = Number(entry.quantity);
      const max = selectedOrder.items.find((i) => i._id === entry.itemId)?.receivedQuantity || 0;
      return !Number.isInteger(quantity) || quantity < 1 || quantity > max;
    });
    if (invalidQuantity) {
      toast({ title: 'Menge prüfen', description: 'Die Menge muss zwischen 1 und der erhaltenen Menge liegen.', variant: 'destructive' });
      return;
    }
    setSubmittingReturn(true);
    try {
      await requestReturnExchange(selectedOrder._id, {
        ...returnExchangeForm,
        affectedItems: returnExchangeForm.affectedItems.map((entry) => ({ ...entry, quantity: Number(entry.quantity) })),
      });
      toast({ title: returnExchangeForm.type === 'return' ? 'Rücksendung angefordert' : 'Umtausch angefordert' });
      setShowReturnExchangeDialog(false);
      await refreshOrder(selectedOrder._id);
    } catch (error) {
      toast({ title: 'Anfrage konnte nicht gespeichert werden', description: errorText(error, 'Unbekannter Fehler'), variant: 'destructive' });
    } finally {
      setSubmittingReturn(false);
    }
  };

  const handleUpdateReturnExchange = async (status: 'approved' | 'in_transit' | 'completed' | 'rejected', notes?: string) => {
    if (!selectedOrder || updatingReturn) return;
    setUpdatingReturn(true);
    try {
      await updateReturnExchange(selectedOrder._id, { status, notes });
      toast({ title: `Rücksendung/Umtausch: ${RETURN_STATUS_LABELS[status]}` });
      await refreshOrder(selectedOrder._id);
    } catch (error) {
      toast({ title: 'Status konnte nicht geändert werden', description: errorText(error, 'Unbekannter Fehler'), variant: 'destructive' });
    } finally {
      setUpdatingReturn(false);
    }
  };

  // ---------------------------------------------------------------- Render-Helfer
  const filtersActive = statusFilter !== 'all' || supplierFilter !== 'all' || searchInput.trim() !== '';
  const inPreparation = statistics
    ? (statistics.ordersByStatus.draft || 0) + (statistics.ordersByStatus.pending || 0) + (statistics.ordersByStatus.confirmed || 0)
    : 0;
  const underway = statistics ? (statistics.ordersByStatus.shipped || 0) + (statistics.ordersByStatus.partial || 0) : 0;
  const canReceive = Boolean(selectedOrder && RECEIVABLE_STATUSES.includes(selectedOrder.status));
  const statusEditable = Boolean(selectedOrder && MANUAL_STATUSES.includes(selectedOrder.status));
  const selectedSupplierInactive = newOrder.supplierId && !activeSuppliers.some((s) => s._id === newOrder.supplierId);

  const statCard = (label: string, value: string | number, hint: string, Icon: typeof ShoppingCart) => (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-xs font-medium text-slate-600">{label}</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
        </div>
        <Icon className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto max-w-[1600px] space-y-4 px-4 py-4 lg:px-5">
      <div className="rounded-lg border border-slate-200 bg-gradient-to-r from-[#1a2a5e] via-[#243976] to-[#2b4a92] px-4 py-4 text-white shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Ersatzteilbestellungen</h1>
        <p className="mt-1 text-sm text-slate-200">Bedarfslisten, Bestellungen bei Lieferanten und Wareneingang</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
          <TabsTrigger value="need-lists" className="h-10 text-sm font-semibold">
            <ClipboardList className="mr-2 h-4 w-4" aria-hidden="true" />
            Bedarfslisten
          </TabsTrigger>
          <TabsTrigger value="orders" className="h-10 text-sm font-semibold">
            <ShoppingCart className="mr-2 h-4 w-4" aria-hidden="true" />
            Bestellungen
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="h-10 text-sm font-semibold">
            <Package className="mr-2 h-4 w-4" aria-hidden="true" />
            Lieferanten
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------ Bestellungen */}
        <TabsContent value="orders" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Bestellungen bei Lieferanten</h2>
              <p className="text-sm text-slate-600">Bestellung öffnen, um Sendungsnummer, Zahlung und Wareneingang zu bearbeiten.</p>
            </div>
            <Button onClick={openCreateOrder} className="h-10 px-4">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Bestellung anlegen
            </Button>
          </div>

          {statistics && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {statCard('Bestellungen', statistics.totalOrders, 'alle Status, inkl. Stornos', ShoppingCart)}
              {statCard('Bestellwert gesamt (brutto, ohne Stornos)', formatEUR(statistics.totalSpent), 'Summe der Bestellbeträge', Euro)}
              {statCard('In Vorbereitung', inPreparation, 'Entwurf, Offen, Bestellt', Package)}
              {statCard('Unterwegs / teilweise erhalten', underway, 'Versendet oder Teilmenge gebucht', Truck)}
            </div>
          )}

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
              <div>
                <Label htmlFor="epo-search" className="text-xs font-medium text-slate-700">Suche (Bestellnr., Notiz, Sendungsnr.)</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="epo-search"
                    placeholder="z. B. EPO-000123"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="h-9 pl-8 text-sm"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="epo-status-filter" className="text-xs font-medium text-slate-700">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="epo-status-filter" className="mt-1 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    <SelectItem value="aktiv">Alle aktiven (nicht erhalten/storniert)</SelectItem>
                    <SelectItem value="ausstehend">Ausstehend (Entwurf, offen, bestellt)</SelectItem>
                    <SelectItem value="verzoegert">Verzögert (Liefertermin überschritten)</SelectItem>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="epo-supplier-filter" className="text-xs font-medium text-slate-700">Lieferant</Label>
                <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                  <SelectTrigger id="epo-supplier-filter" className="mt-1 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Lieferanten</SelectItem>
                    {activeSuppliers.map((supplier) => (
                      <SelectItem key={supplier._id} value={supplier._id}>{supplier.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                className="h-9"
                disabled={!filtersActive}
                onClick={() => {
                  setStatusFilter('all');
                  setSupplierFilter('all');
                  setSearchInput('');
                }}
              >
                Filter zurücksetzen
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bestellnr.</TableHead>
                      <TableHead>Lieferant</TableHead>
                      <TableHead className="text-right">Positionen</TableHead>
                      <TableHead className="text-right">Gesamt (brutto)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Zahlung</TableHead>
                      <TableHead>Bestellt am</TableHead>
                      <TableHead>Erwartet</TableHead>
                      <TableHead>Sendungsnr.</TableHead>
                      <TableHead className="text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordersState === 'loading' && orders.length === 0 ? (
                      <LoadState state="loading" colSpan={10} loadingText="Bestellungen werden geladen …" errorText="" emptyText="" onRetry={loadOrders} />
                    ) : ordersState === 'error' ? (
                      <LoadState state="error" colSpan={10} loadingText="" errorText={`Bestellungen konnten nicht geladen werden (${ordersError}).`} emptyText="" onRetry={loadOrders} />
                    ) : orders.length === 0 ? (
                      <LoadState
                        state="empty"
                        colSpan={10}
                        loadingText=""
                        errorText=""
                        emptyText={filtersActive ? 'Keine Bestellungen für diese Filter.' : 'Noch keine Bestellungen. Über „Bestellung anlegen“ oder eine Bedarfsliste erstellen.'}
                        onRetry={loadOrders}
                      />
                    ) : (
                      orders.map((order) => (
                        <TableRow key={order._id} className={cn('transition-colors hover:bg-slate-50', ordersState === 'loading' && 'opacity-60')}>
                          <TableCell className="font-semibold text-slate-900">{order.orderNumber}</TableCell>
                          <TableCell>{getSupplierName(order.supplierId)}</TableCell>
                          <TableCell className="text-right">{order.items.length}</TableCell>
                          <TableCell className="whitespace-nowrap text-right">{formatEUR(order.totalCost)}</TableCell>
                          <TableCell><StatusBadge status={order.status} /></TableCell>
                          <TableCell><PaymentBadge status={order.paymentStatus} /></TableCell>
                          <TableCell className="whitespace-nowrap">{formatDate(order.orderDate)}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatDate(order.expectedDeliveryDate)}</TableCell>
                          <TableCell className="max-w-[160px] truncate">{order.trackingNumber || '–'}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewOrder(order._id)}
                              disabled={openingOrderId === order._id}
                              aria-label={`Details zu ${order.orderNumber} ansehen`}
                            >
                              {openingOrderId === order._id
                                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                : <Eye className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
                              Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
                <span>
                  {pagination.total === 0
                    ? '0 Bestellungen'
                    : `${(pagination.page - 1) * pagination.limit + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} von ${pagination.total} Bestellungen`}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1 || ordersState === 'loading'} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
                    Zurück
                  </Button>
                  <span aria-live="polite">Seite {pagination.page} von {Math.max(1, pagination.pages)}</span>
                  <Button variant="outline" size="sm" disabled={page >= pagination.pages || ordersState === 'loading'} onClick={() => setPage((p) => p + 1)}>
                    Weiter
                    <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------ Bedarfslisten */}
        <TabsContent value="need-lists">
          <NeedListManagement onOrderCreated={loadOrders} />
        </TabsContent>

        {/* ------------------------------------------------------------ Lieferanten */}
        <TabsContent value="suppliers" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Lieferanten</h2>
              <p className="text-sm text-slate-600">Inaktive Lieferanten sind in Bestellungen nicht auswählbar und können wieder aktiviert werden.</p>
            </div>
            <Button onClick={() => openCreateSupplier()} className="h-10 px-4">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Lieferant anlegen
            </Button>
          </div>

          <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-1" role="group" aria-label="Lieferanten filtern">
            {([['active', 'Aktiv'], ['inactive', 'Inaktiv'], ['all', 'Alle']] as const).map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={supplierListFilter === value ? 'default' : 'ghost'}
                aria-pressed={supplierListFilter === value}
                onClick={() => setSupplierListFilter(value)}
                className="h-8 px-4"
              >
                {label}
              </Button>
            ))}
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>E-Mail</TableHead>
                      <TableHead>Ansprechpartner</TableHead>
                      <TableHead>Telefon</TableHead>
                      <TableHead>USt-IdNr.</TableHead>
                      <TableHead>Zahlungsbedingungen</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliersState === 'loading' && supplierRows.length === 0 ? (
                      <LoadState state="loading" colSpan={8} loadingText="Lieferanten werden geladen …" errorText="" emptyText="" onRetry={loadSuppliers} />
                    ) : suppliersState === 'error' ? (
                      <LoadState state="error" colSpan={8} loadingText="" errorText={`Lieferanten konnten nicht geladen werden (${suppliersError}).`} emptyText="" onRetry={loadSuppliers} />
                    ) : supplierRows.length === 0 ? (
                      <LoadState
                        state="empty"
                        colSpan={8}
                        loadingText=""
                        errorText=""
                        emptyText={supplierListFilter === 'inactive' ? 'Keine inaktiven Lieferanten.' : 'Noch keine Lieferanten. Über „Lieferant anlegen“ hinzufügen.'}
                        onRetry={loadSuppliers}
                      />
                    ) : (
                      supplierRows.map((supplier) => (
                        <TableRow key={supplier._id} className={cn(!supplier.isActive && 'bg-slate-50 text-slate-500')}>
                          <TableCell className="font-semibold text-slate-900">
                            {supplier.name}
                            {supplier.website && (
                              <a href={/^https?:\/\//i.test(supplier.website) ? supplier.website : `https://${supplier.website}`} target="_blank" rel="noopener noreferrer" className="block text-xs font-normal text-blue-700 underline">
                                {supplier.website.replace(/^https?:\/\//i, '')}
                              </a>
                            )}
                          </TableCell>
                          <TableCell>{supplier.email}</TableCell>
                          <TableCell>{supplier.contactPerson || '–'}</TableCell>
                          <TableCell className="whitespace-nowrap">{supplier.phone || '–'}</TableCell>
                          <TableCell>{supplier.ustId || '–'}</TableCell>
                          <TableCell>{supplier.paymentTerms || '–'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={supplier.isActive ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-white text-slate-600'}>
                              {supplier.isActive ? 'Aktiv' : 'Inaktiv'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {!supplier.isActive && (
                                <Button size="sm" onClick={() => handleReactivateSupplier(supplier)} disabled={reactivatingId === supplier._id}>
                                  {reactivatingId === supplier._id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
                                  Wieder aktivieren
                                </Button>
                              )}
                              <Button size="sm" variant="outline" onClick={() => openEditSupplier(supplier)}>
                                <Edit className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                Bearbeiten
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------------------ Dialog: Bestellung anlegen */}
      <Dialog open={showCreateOrderDialog} onOpenChange={(open) => { if (!creatingOrder) setShowCreateOrderDialog(open); }}>
        <DialogContent className={cn(dialogContentClass, closeButtonOnDark, 'max-w-4xl')}>
          <DialogHeader className={dialogHeaderClass}>
            <DialogTitle className={dialogTitleClass}>Bestellung anlegen</DialogTitle>
            <DialogDescription className={dialogDescriptionClass}>
              Ersatzteile bei einem Lieferanten bestellen. Beträge in Euro, z. B. 12,50.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className={dialogBodyClass}>
            <form id="epo-create-order-form" onSubmit={handleCreateOrder} className="space-y-4" noValidate>
              <div>
                <Label htmlFor="epo-new-supplier" className="text-xs font-medium text-slate-700">Lieferant *</Label>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <Select
                    value={newOrder.supplierId || undefined}
                    onValueChange={(value) => {
                      setNewOrder((prev) => ({ ...prev, supplierId: value }));
                      setOrderErrors((prev) => ({ ...prev, supplierId: '' }));
                    }}
                  >
                    <SelectTrigger id="epo-new-supplier" className={cn('h-9 flex-1 text-sm', orderErrors.supplierId && 'border-red-500')}>
                      <SelectValue placeholder={activeSuppliers.length ? 'Lieferant auswählen' : 'Noch kein aktiver Lieferant vorhanden'} />
                    </SelectTrigger>
                    <SelectContent>
                      {activeSuppliers.map((supplier) => (
                        <SelectItem key={supplier._id} value={supplier._id}>
                          {supplier.name} – {supplier.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" className="h-9" onClick={() => openCreateSupplier('order')}>
                    <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Neuen Lieferanten anlegen
                  </Button>
                </div>
                <FieldError message={orderErrors.supplierId || (selectedSupplierInactive ? 'Der gewählte Lieferant ist inaktiv.' : '')} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">Positionen *</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setNewOrder((prev) => ({ ...prev, items: [...prev.items, newLine()] }))}>
                    <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    Position hinzufügen
                  </Button>
                </div>
                {partsError && (
                  <p className="flex flex-wrap items-center gap-2 text-xs text-red-700">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    Ersatzteile konnten nicht geladen werden ({partsError}).
                    <Button type="button" size="sm" variant="outline" onClick={loadParts}>Erneut versuchen</Button>
                  </p>
                )}
                <FieldError message={orderErrors.items} />
                {newOrder.items.map((line, index) => (
                  <div key={line.key} className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_90px_130px_auto] sm:items-start">
                    <div>
                      <Label htmlFor={`${line.key}-part`} className="text-xs text-slate-700">Ersatzteil (Position {index + 1})</Label>
                      <Select value={line.partId || undefined} onValueChange={(value) => handlePartSelected(line.key, value)}>
                        <SelectTrigger id={`${line.key}-part`} className={cn('mt-1 h-9 text-sm', orderErrors[`${line.key}.partId`] && 'border-red-500')}>
                          <SelectValue placeholder="Ersatzteil auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {parts.map((part) => (
                            <SelectItem key={part._id} value={part._id}>
                              {part.name || part.itemName} ({part.sku})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError message={orderErrors[`${line.key}.partId`]} />
                    </div>
                    <div>
                      <Label htmlFor={`${line.key}-qty`} className="text-xs text-slate-700">Menge</Label>
                      <Input
                        id={`${line.key}-qty`}
                        inputMode="numeric"
                        value={line.quantity}
                        onChange={(e) => updateOrderLine(line.key, 'quantity', e.target.value.replace(/[^\d]/g, ''))}
                        className={cn('mt-1 h-9 text-sm', orderErrors[`${line.key}.quantity`] && 'border-red-500')}
                      />
                      <FieldError message={orderErrors[`${line.key}.quantity`]} />
                    </div>
                    <div>
                      <Label htmlFor={`${line.key}-price`} className="text-xs text-slate-700">Einzelpreis (€)</Label>
                      <Input
                        id={`${line.key}-price`}
                        inputMode="decimal"
                        placeholder="0,00"
                        value={line.unitPrice}
                        onChange={(e) => updateOrderLine(line.key, 'unitPrice', e.target.value)}
                        onBlur={() => {
                          const parsed = parseDecimalInput(line.unitPrice);
                          if (parsed !== null && parsed >= 0) updateOrderLine(line.key, 'unitPrice', formatDecimalInput(parsed));
                        }}
                        className={cn('mt-1 h-9 text-sm', orderErrors[`${line.key}.unitPrice`] && 'border-red-500')}
                      />
                      <FieldError message={orderErrors[`${line.key}.unitPrice`]} />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 self-end text-red-700 hover:text-red-800"
                      onClick={() => setNewOrder((prev) => ({ ...prev, items: prev.items.filter((l) => l.key !== line.key) }))}
                      aria-label={`Position ${index + 1} entfernen`}
                    >
                      <X className="mr-1 h-4 w-4" aria-hidden="true" />
                      Entfernen
                    </Button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Label htmlFor="epo-new-status" className="text-xs font-medium text-slate-700">Bestellstatus</Label>
                  <Select value={newOrder.status} onValueChange={(value) => setNewOrder((prev) => ({ ...prev, status: value as OrderStatus }))}>
                    <SelectTrigger id="epo-new-status" className="mt-1 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CREATE_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>{STATUS_LABELS[status]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[11px] text-slate-500">„Bestellt“ = beim Lieferanten bestellt; Wareneingang ist ab „Bestellt“ möglich.</p>
                </div>
                <div>
                  <Label htmlFor="epo-new-date" className="text-xs font-medium text-slate-700">Voraussichtliche Lieferung</Label>
                  <Input
                    id="epo-new-date"
                    type="date"
                    value={newOrder.expectedDeliveryDate}
                    onChange={(e) => setNewOrder((prev) => ({ ...prev, expectedDeliveryDate: e.target.value }))}
                    className="mt-1 h-9 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="epo-new-payment" className="text-xs font-medium text-slate-700">Zahlungsart</Label>
                  <Select value={newOrder.paymentMethod} onValueChange={(value) => setNewOrder((prev) => ({ ...prev, paymentMethod: value }))}>
                    <SelectTrigger id="epo-new-payment" className="mt-1 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="epo-new-tax" className="text-xs font-medium text-slate-700">MwSt.-Betrag (€)</Label>
                  <Input
                    id="epo-new-tax"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={newOrder.tax}
                    onChange={(e) => { setNewOrder((prev) => ({ ...prev, tax: e.target.value })); setOrderErrors((prev) => ({ ...prev, tax: '' })); }}
                    className={cn('mt-1 h-9 text-sm', orderErrors.tax && 'border-red-500')}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Steuerbetrag laut Lieferantenrechnung; leer oder 0 = nicht erfasst.</p>
                  <FieldError message={orderErrors.tax} />
                </div>
                <div>
                  <Label htmlFor="epo-new-shipping" className="text-xs font-medium text-slate-700">Versandkosten (€)</Label>
                  <Input
                    id="epo-new-shipping"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={newOrder.shippingCost}
                    onChange={(e) => { setNewOrder((prev) => ({ ...prev, shippingCost: e.target.value })); setOrderErrors((prev) => ({ ...prev, shippingCost: '' })); }}
                    className={cn('mt-1 h-9 text-sm', orderErrors.shippingCost && 'border-red-500')}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Wird anteilig auf die Positionen verteilt.</p>
                  <FieldError message={orderErrors.shippingCost} />
                </div>
              </div>

              <div>
                <Label htmlFor="epo-new-notes" className="text-xs font-medium text-slate-700">Notiz</Label>
                <Textarea
                  id="epo-new-notes"
                  value={newOrder.notes}
                  onChange={(e) => setNewOrder((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="z. B. Lieferantenreferenz oder Ansprechpartner"
                  className="mt-1 min-h-[72px] text-sm"
                />
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-slate-200 bg-white p-3 text-sm sm:grid-cols-4">
                <div><dt className="text-xs text-slate-500">Positionen</dt><dd className="font-medium">{formatEUR(orderPreview.subtotal)}</dd></div>
                <div><dt className="text-xs text-slate-500">Versand</dt><dd className="font-medium">{formatEUR(orderPreview.shipping)}</dd></div>
                <div><dt className="text-xs text-slate-500">MwSt.</dt><dd className="font-medium">{orderPreview.tax > 0 ? formatEUR(orderPreview.tax) : 'nicht erfasst'}</dd></div>
                <div><dt className="text-xs text-slate-500">Gesamt (brutto)</dt><dd className="font-semibold text-slate-900">{formatEUR(orderPreview.total)}</dd></div>
              </dl>
            </form>
          </DialogBody>

          <DialogFooter className={dialogFooterClass}>
            <Button type="button" variant="outline" onClick={() => setShowCreateOrderDialog(false)} disabled={creatingOrder}>
              Abbrechen
            </Button>
            <Button type="submit" form="epo-create-order-form" disabled={creatingOrder}>
              {creatingOrder ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}
              {creatingOrder ? 'Wird gespeichert …' : 'Bestellung anlegen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------ Dialog: Lieferant anlegen / bearbeiten */}
      <Dialog open={supplierDialog.open} onOpenChange={closeSupplierDialog}>
        <DialogContent className={cn(dialogContentClass, closeButtonOnDark, 'max-w-3xl')}>
          <DialogHeader className={dialogHeaderClass}>
            <DialogTitle className={dialogTitleClass}>
              {supplierDialog.mode === 'edit' ? 'Lieferant bearbeiten' : 'Lieferant anlegen'}
            </DialogTitle>
            <DialogDescription className={dialogDescriptionClass}>
              {supplierDialog.returnTo === 'order'
                ? 'Nach dem Speichern geht es zurück zur Bestellung; der Lieferant ist dann ausgewählt.'
                : 'Pflichtfelder sind mit * markiert. Enter speichert.'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className={dialogBodyClass}>
            <form id="epo-supplier-form" onSubmit={handleSaveSupplier} noValidate>
              <SupplierFormFields
                form={supplierForm}
                errors={supplierErrors}
                onChange={handleSupplierFieldChange}
                showStatus={supplierDialog.mode === 'edit'}
                idPrefix="epo-supplier"
              />
            </form>
          </DialogBody>
          <DialogFooter className={dialogFooterClass}>
            <Button type="button" variant="outline" onClick={() => closeSupplierDialog(false)} disabled={savingSupplier}>
              Abbrechen
            </Button>
            <Button type="submit" form="epo-supplier-form" disabled={savingSupplier}>
              {savingSupplier ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}
              {savingSupplier ? 'Wird gespeichert …' : 'Lieferant speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------ Dialog: Bestelldetails */}
      {selectedOrder && detailForm && (
        <Dialog open={showOrderDetailsDialog} onOpenChange={(open) => { if (!savingDetails) setShowOrderDetailsDialog(open); }}>
          <DialogContent className={cn(dialogContentClass, closeButtonOnDark, 'max-w-5xl')}>
            <DialogHeader className={dialogHeaderClass}>
              <DialogTitle className={dialogTitleClass}>Bestellung {selectedOrder.orderNumber}</DialogTitle>
              <DialogDescription className={cn(dialogDescriptionClass, 'flex flex-wrap items-center gap-x-3 gap-y-1')}>
                <span>{getSupplierName(selectedOrder.supplierId)}</span>
                <StatusBadge status={selectedOrder.status} />
                <span>Gesamt (brutto): {formatEUR(selectedOrder.totalCost)}</span>
                <PaymentBadge status={selectedOrder.paymentStatus} />
                <span>Sendungsnr.: {selectedOrder.trackingNumber || 'nicht erfasst'}</span>
              </DialogDescription>
            </DialogHeader>

            <DialogBody className={dialogBodyClass}>
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-md border border-slate-200 bg-slate-100 p-1">
                  <TabsTrigger value="overview" className="h-9 text-sm font-semibold">Übersicht</TabsTrigger>
                  <TabsTrigger value="items" className="h-9 text-sm font-semibold">Positionen ({selectedOrder.items.length})</TabsTrigger>
                  <TabsTrigger value="timeline" className="h-9 text-sm font-semibold">Verlauf</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <dl className="grid grid-cols-2 gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm lg:grid-cols-4">
                    <div><dt className="text-xs text-slate-500">Positionen</dt><dd className="font-semibold">{formatEUR(selectedOrder.subtotal)}</dd></div>
                    <div><dt className="text-xs text-slate-500">Versand</dt><dd className="font-semibold">{formatEUR(selectedOrder.shippingCost)}</dd></div>
                    <div><dt className="text-xs text-slate-500">MwSt.</dt><dd className="font-semibold">{selectedOrder.tax > 0 ? formatEUR(selectedOrder.tax) : 'nicht erfasst'}</dd></div>
                    <div><dt className="text-xs text-slate-500">Gesamt (brutto)</dt><dd className="font-bold text-slate-900">{formatEUR(selectedOrder.totalCost)}</dd></div>
                  </dl>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <Card className="border-slate-200 shadow-sm lg:col-span-2">
                      <CardHeader className="px-4 py-3">
                        <CardTitle className="text-sm">Lieferung &amp; Zahlung</CardTitle>
                        <CardDescription className="text-xs">Änderungen werden erst mit „Änderungen speichern“ übernommen.</CardDescription>
                      </CardHeader>
                      <CardContent className="px-4 pb-4">
                        <form id="epo-details-form" onSubmit={handleSaveDetails} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <Label htmlFor="epo-detail-status" className="text-xs font-medium text-slate-700">Bestellstatus</Label>
                            {statusEditable ? (
                              <Select value={detailForm.status} onValueChange={(value) => setDetailForm((prev) => (prev ? { ...prev, status: value as OrderStatus } : prev))}>
                                <SelectTrigger id="epo-detail-status" className="mt-1 h-9 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {MANUAL_STATUSES.map((status) => (
                                    <SelectItem key={status} value={status}>{STATUS_LABELS[status]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="mt-1 flex h-9 items-center"><StatusBadge status={selectedOrder.status} /></div>
                            )}
                            <p className="mt-1 text-[11px] text-slate-500">
                              {statusEditable
                                ? '„Teilweise erhalten“ und „Erhalten“ entstehen nur über „Wareneingang buchen“.'
                                : 'Dieser Status wird durch Wareneingang bzw. Stornierung gesetzt.'}
                            </p>
                          </div>
                          <div>
                            <Label htmlFor="epo-detail-payment" className="text-xs font-medium text-slate-700">Zahlungsstatus</Label>
                            <Select value={detailForm.paymentStatus} onValueChange={(value) => setDetailForm((prev) => (prev ? { ...prev, paymentStatus: value as PaymentStatus } : prev))}>
                              <SelectTrigger id="epo-detail-payment" className="mt-1 h-9 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="epo-detail-tracking" className="text-xs font-medium text-slate-700">Sendungsnummer</Label>
                            <Input
                              id="epo-detail-tracking"
                              maxLength={64}
                              placeholder="z. B. 00340434..."
                              value={detailForm.trackingNumber}
                              onChange={(e) => setDetailForm((prev) => (prev ? { ...prev, trackingNumber: e.target.value } : prev))}
                              className="mt-1 h-9 text-sm"
                            />
                            <p className="mt-1 text-[11px] text-slate-500">Feld leeren und speichern entfernt die Sendungsnummer.</p>
                          </div>
                          <div>
                            <Label htmlFor="epo-detail-date" className="text-xs font-medium text-slate-700">Voraussichtliche Lieferung</Label>
                            <Input
                              id="epo-detail-date"
                              type="date"
                              value={detailForm.expectedDeliveryDate}
                              onChange={(e) => setDetailForm((prev) => (prev ? { ...prev, expectedDeliveryDate: e.target.value } : prev))}
                              className="mt-1 h-9 text-sm"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <Label htmlFor="epo-detail-notes" className="text-xs font-medium text-slate-700">Notiz</Label>
                            <Textarea
                              id="epo-detail-notes"
                              value={detailForm.notes}
                              onChange={(e) => setDetailForm((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                              className="mt-1 min-h-[64px] text-sm"
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                            <Button type="submit" disabled={!detailsDirty || savingDetails}>
                              {savingDetails ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}
                              {savingDetails ? 'Wird gespeichert …' : 'Änderungen speichern'}
                            </Button>
                            {detailsDirty && !savingDetails && (
                              <Button type="button" variant="ghost" onClick={() => setDetailForm(orderToDetailForm(selectedOrder))}>
                                Änderungen verwerfen
                              </Button>
                            )}
                            <span className="text-xs" aria-live="polite">
                              {detailsError
                                ? <span className="text-red-700">Nicht gespeichert: {detailsError}</span>
                                : detailsDirty
                                  ? <span className="text-amber-700">Ungespeicherte Änderungen</span>
                                  : detailsSavedAt
                                    ? <span className="text-emerald-700">Gespeichert um {detailsSavedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                                    : null}
                            </span>
                          </div>
                        </form>
                      </CardContent>
                    </Card>

                    <Card className="border-slate-200 shadow-sm">
                      <CardHeader className="px-4 py-3">
                        <CardTitle className="text-sm">Aktionen</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 px-4 pb-4">
                        <div className="space-y-1">
                          <Button className="w-full justify-start" onClick={openReceiveDialog} disabled={!canReceive}>
                            <CheckCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                            Wareneingang buchen
                          </Button>
                          {!canReceive && (
                            <p className="text-[11px] text-slate-500">
                              {selectedOrder.status === 'received'
                                ? 'Alle Positionen sind erhalten.'
                                : selectedOrder.status === 'cancelled'
                                  ? 'Stornierte Bestellung.'
                                  : 'Möglich, sobald der Status „Bestellt“ oder „Versendet“ ist.'}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-medium text-slate-700">Rechnung des Lieferanten</p>
                          {selectedOrder.invoiceFile ? (
                            <Button variant="outline" className="w-full justify-start" onClick={() => handleDownloadInvoice(selectedOrder)}>
                              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                              Rechnung herunterladen
                            </Button>
                          ) : (
                            <Button variant="outline" className="w-full justify-start" onClick={() => { setInvoiceFile(null); setShowInvoiceUploadDialog(true); }}>
                              <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                              Rechnung hochladen
                            </Button>
                          )}
                          {selectedOrder.invoiceFile && <p className="truncate text-[11px] text-slate-500">{selectedOrder.invoiceFile.originalName}</p>}
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-medium text-slate-700">Rücksendung / Umtausch</p>
                          {selectedOrder.returnExchange && selectedOrder.returnExchange.status !== 'none' ? (
                            <div className="space-y-2 rounded-md border border-slate-200 p-2 text-xs">
                              <p>
                                <span className="font-medium">{selectedOrder.returnExchange.type === 'exchange' ? 'Umtausch' : 'Rücksendung'}:</span>{' '}
                                {RETURN_STATUS_LABELS[selectedOrder.returnExchange.status] || selectedOrder.returnExchange.status}
                              </p>
                              <p>Grund: {selectedOrder.returnExchange.reason}</p>
                              {selectedOrder.returnExchange.status === 'requested' && (
                                <div className="flex flex-wrap gap-2">
                                  <Button size="sm" variant="outline" disabled={updatingReturn} onClick={() => handleUpdateReturnExchange('approved')}>Genehmigen</Button>
                                  <Button size="sm" variant="outline" className="text-red-700" disabled={updatingReturn} onClick={() => handleUpdateReturnExchange('rejected', 'Abgelehnt durch Mitarbeiter')}>Ablehnen</Button>
                                </div>
                              )}
                              {selectedOrder.returnExchange.status === 'approved' && (
                                <Button size="sm" variant="outline" disabled={updatingReturn} onClick={() => handleUpdateReturnExchange('in_transit')}>Als unterwegs markieren</Button>
                              )}
                              {selectedOrder.returnExchange.status === 'in_transit' && (
                                <Button size="sm" disabled={updatingReturn} onClick={() => handleUpdateReturnExchange('completed')}>Als abgeschlossen markieren</Button>
                              )}
                            </div>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={openReturnDialog}
                                disabled={!selectedOrder.items.some((item) => item.receivedQuantity > 0) || selectedOrder.status === 'cancelled'}
                              >
                                <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                                Rücksendung/Umtausch anfordern
                              </Button>
                              {!selectedOrder.items.some((item) => item.receivedQuantity > 0) && (
                                <p className="text-[11px] text-slate-500">Erst nach einem Wareneingang möglich.</p>
                              )}
                            </>
                          )}
                        </div>

                        {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'received' && (
                          <Button variant="outline" className="w-full justify-start border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => { setCancelReason(''); setShowCancelDialog(true); }}>
                            <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                            Bestellung stornieren
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="items">
                  <div className="overflow-x-auto rounded-md border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ersatzteil</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead className="text-right">Bestellt</TableHead>
                          <TableHead className="text-right">Erhalten</TableHead>
                          <TableHead className="text-right">Offen</TableHead>
                          <TableHead className="text-right">Einzelpreis</TableHead>
                          <TableHead>Preisart</TableHead>
                          <TableHead className="text-right">Versandanteil</TableHead>
                          <TableHead className="text-right">Zusatzkosten</TableHead>
                          <TableHead className="text-right">Positionssumme</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedOrder.items.map((item) => (
                          <TableRow key={item._id}>
                            <TableCell className="font-medium">{item.partName}</TableCell>
                            <TableCell>{item.sku}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">{item.receivedQuantity}</TableCell>
                            <TableCell className="text-right">{Math.max(0, item.quantity - item.receivedQuantity)}</TableCell>
                            <TableCell className="whitespace-nowrap text-right">{formatEUR(item.unitPrice)}</TableCell>
                            <TableCell>{item.priceType === 'gross' ? 'Brutto' : 'Netto'}</TableCell>
                            <TableCell className="whitespace-nowrap text-right">{formatEUR(item.shippingShare ?? item.shippingCost ?? 0)}</TableCell>
                            <TableCell className="whitespace-nowrap text-right">{formatEUR(item.additionalCost || 0)}</TableCell>
                            <TableCell className="whitespace-nowrap text-right font-medium">{formatEUR(item.totalPrice)}</TableCell>
                            <TableCell>{ITEM_STATUS_LABELS[item.status] || item.status}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Beträge wie vom Lieferanten erfasst (Preisart je Position). MwSt. der Bestellung: {selectedOrder.tax > 0 ? formatEUR(selectedOrder.tax) : 'nicht erfasst'}.
                  </p>
                </TabsContent>

                <TabsContent value="timeline">
                  {selectedOrder.timeline.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Noch keine Einträge im Verlauf.</p>
                  ) : (
                    <ol className="space-y-2">
                      {[...selectedOrder.timeline].reverse().map((entry, index) => (
                        <li key={entry._id || index} className="flex flex-col gap-1 rounded-md border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:gap-3">
                          <time className="w-40 shrink-0 text-xs text-slate-500">{formatDateTime(entry.completedAt)}</time>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{TIMELINE_LABELS[entry.status] || entry.status}</p>
                            <p className="break-words text-xs text-slate-600">{entry.description}</p>
                            {entry.notes && <p className="text-xs italic text-slate-500">{entry.notes}</p>}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </TabsContent>
              </Tabs>
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}

      {/* ------------------------------------------------------------ Dialog: Wareneingang */}
      {selectedOrder && (
        <Dialog open={showReceiveDialog} onOpenChange={(open) => { if (!receiving) setShowReceiveDialog(open); }}>
          <DialogContent className={cn(dialogContentClass, closeButtonOnDark, 'max-w-xl')}>
            <DialogHeader className={dialogHeaderClass}>
              <DialogTitle className={dialogTitleClass}>Wareneingang buchen – {selectedOrder.orderNumber}</DialogTitle>
              <DialogDescription className={dialogDescriptionClass}>
                Gelieferte Menge je Position eintragen. Die Menge wird dem Lager zugebucht; mehr als offen ist nicht möglich.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className={dialogBodyClass}>
              <form id="epo-receive-form" onSubmit={handleReceiveItems} className="space-y-2" noValidate>
                {receiveLines.length === 0 && <p className="text-sm text-muted-foreground">Keine offenen Positionen.</p>}
                {receiveLines.map((line) => (
                  <div key={line.item._id} className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{line.item.partName}</p>
                      <p className="text-xs text-slate-600">Offen: {line.remaining} von {line.item.quantity}</p>
                    </div>
                    <div className="w-28">
                      <Label htmlFor={`receive-${line.item._id}`} className="sr-only">Erhaltene Menge für {line.item.partName}</Label>
                      <Input
                        id={`receive-${line.item._id}`}
                        inputMode="numeric"
                        value={line.text}
                        onChange={(e) => setReceiveDraft((prev) => ({ ...prev, [line.item._id as string]: e.target.value.replace(/[^\d]/g, '') }))}
                        className={cn('h-9 text-right text-sm', line.error && 'border-red-500')}
                        aria-invalid={Boolean(line.error)}
                      />
                      <FieldError message={line.error} />
                    </div>
                  </div>
                ))}
              </form>
            </DialogBody>
            <DialogFooter className={dialogFooterClass}>
              <Button type="button" variant="outline" onClick={() => setShowReceiveDialog(false)} disabled={receiving}>Abbrechen</Button>
              <Button type="submit" form="epo-receive-form" disabled={receiving || receiveHasErrors || receiveTotal <= 0}>
                {receiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle className="mr-2 h-4 w-4" aria-hidden="true" />}
                {receiving ? 'Wird gebucht …' : `Wareneingang speichern (${receiveTotal} Stück)`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ------------------------------------------------------------ Bestaetigung: Stornieren */}
      {selectedOrder && (
        <AlertDialog open={showCancelDialog} onOpenChange={(open) => { if (!cancelling) setShowCancelDialog(open); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bestellung {selectedOrder.orderNumber} stornieren?</AlertDialogTitle>
              <AlertDialogDescription>
                Offene Positionen werden storniert. Bereits gebuchte Wareneingänge bleiben im Lager. Dies kann nicht rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div>
              <Label htmlFor="epo-cancel-reason" className="text-xs font-medium text-slate-700">Grund (optional, erscheint im Verlauf)</Label>
              <Input id="epo-cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="mt-1 h-9 text-sm" />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelling}>Nicht stornieren</AlertDialogCancel>
              <Button variant="destructive" onClick={handleCancelOrder} disabled={cancelling}>
                {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {cancelling ? 'Wird storniert …' : 'Bestellung stornieren'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* ------------------------------------------------------------ Dialog: Rechnung hochladen */}
      <Dialog open={showInvoiceUploadDialog} onOpenChange={(open) => { if (!uploadingInvoice) setShowInvoiceUploadDialog(open); }}>
        <DialogContent className={cn(dialogContentClass, closeButtonOnDark, 'max-w-lg')}>
          <DialogHeader className={dialogHeaderClass}>
            <DialogTitle className={dialogTitleClass}>Rechnung hochladen</DialogTitle>
            <DialogDescription className={dialogDescriptionClass}>PDF, Bild oder Office-Dokument, höchstens 10 MB.</DialogDescription>
          </DialogHeader>
          <DialogBody className={dialogBodyClass}>
            <form id="epo-invoice-form" onSubmit={handleUploadInvoice}>
              <Label htmlFor="epo-invoice-file" className="text-xs font-medium text-slate-700">Datei</Label>
              <Input
                id="epo-invoice-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                className="mt-1 h-10 text-sm file:mr-3 file:text-xs"
              />
              {invoiceFile && (
                <p className="mt-2 text-xs text-slate-600">
                  Ausgewählt: {invoiceFile.name} ({(invoiceFile.size / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} KB)
                </p>
              )}
            </form>
          </DialogBody>
          <DialogFooter className={dialogFooterClass}>
            <Button type="button" variant="outline" onClick={() => setShowInvoiceUploadDialog(false)} disabled={uploadingInvoice}>Abbrechen</Button>
            <Button type="submit" form="epo-invoice-form" disabled={!invoiceFile || uploadingInvoice}>
              {uploadingInvoice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="mr-2 h-4 w-4" aria-hidden="true" />}
              {uploadingInvoice ? 'Wird hochgeladen …' : 'Rechnung hochladen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------ Dialog: Ruecksendung / Umtausch */}
      {selectedOrder && (
        <Dialog open={showReturnExchangeDialog} onOpenChange={(open) => { if (!submittingReturn) setShowReturnExchangeDialog(open); }}>
          <DialogContent className={cn(dialogContentClass, closeButtonOnDark, 'max-w-3xl')}>
            <DialogHeader className={dialogHeaderClass}>
              <DialogTitle className={dialogTitleClass}>Rücksendung/Umtausch anfordern</DialogTitle>
              <DialogDescription className={dialogDescriptionClass}>Für defekte oder falsch gelieferte Teile dieser Bestellung.</DialogDescription>
            </DialogHeader>
            <DialogBody className={dialogBodyClass}>
              <form id="epo-return-form" onSubmit={handleRequestReturnExchange} className="space-y-4" noValidate>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="epo-return-type" className="text-xs font-medium text-slate-700">Art *</Label>
                    <Select value={returnExchangeForm.type} onValueChange={(value: 'return' | 'exchange') => setReturnExchangeForm((prev) => ({ ...prev, type: value }))}>
                      <SelectTrigger id="epo-return-type" className="mt-1 h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="return">Rücksendung (Gutschrift)</SelectItem>
                        <SelectItem value="exchange">Umtausch (Ersatzlieferung)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="epo-return-reason" className="text-xs font-medium text-slate-700">Grund *</Label>
                    <Input
                      id="epo-return-reason"
                      value={returnExchangeForm.reason}
                      onChange={(e) => setReturnExchangeForm((prev) => ({ ...prev, reason: e.target.value }))}
                      placeholder="z. B. defekt geliefert, falsches Teil"
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="epo-return-description" className="text-xs font-medium text-slate-700">Beschreibung *</Label>
                  <Textarea
                    id="epo-return-description"
                    value={returnExchangeForm.description}
                    onChange={(e) => setReturnExchangeForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="mt-1 min-h-[72px] text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700">Betroffene Positionen *</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const firstItem = selectedOrder.items.find((item) => item.receivedQuantity > 0);
                        if (firstItem?._id) {
                          setReturnExchangeForm((prev) => ({ ...prev, affectedItems: [...prev.affectedItems, { itemId: firstItem._id as string, quantity: '1', issueDescription: '' }] }));
                        }
                      }}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      Position hinzufügen
                    </Button>
                  </div>
                  {returnExchangeForm.affectedItems.map((entry, index) => (
                    <div key={index} className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_80px_1fr_auto] sm:items-end">
                      <div>
                        <Label className="text-xs text-slate-700">Position</Label>
                        <Select
                          value={entry.itemId}
                          onValueChange={(value) => setReturnExchangeForm((prev) => ({ ...prev, affectedItems: prev.affectedItems.map((e, i) => (i === index ? { ...e, itemId: value } : e)) }))}
                        >
                          <SelectTrigger className="mt-1 h-9 text-sm">
                            <SelectValue placeholder="Position auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedOrder.items.filter((item) => item.receivedQuantity > 0).map((item) => (
                              <SelectItem key={item._id} value={item._id as string}>{item.partName} (erhalten: {item.receivedQuantity})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-700">Menge</Label>
                        <Input
                          inputMode="numeric"
                          value={entry.quantity}
                          onChange={(e) => setReturnExchangeForm((prev) => ({ ...prev, affectedItems: prev.affectedItems.map((x, i) => (i === index ? { ...x, quantity: e.target.value.replace(/[^\d]/g, '') } : x)) }))}
                          className="mt-1 h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-700">Fehlerbeschreibung</Label>
                        <Input
                          value={entry.issueDescription}
                          onChange={(e) => setReturnExchangeForm((prev) => ({ ...prev, affectedItems: prev.affectedItems.map((x, i) => (i === index ? { ...x, issueDescription: e.target.value } : x)) }))}
                          className="mt-1 h-9 text-sm"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 text-red-700"
                        onClick={() => setReturnExchangeForm((prev) => ({ ...prev, affectedItems: prev.affectedItems.filter((_, i) => i !== index) }))}
                      >
                        <X className="mr-1 h-4 w-4" aria-hidden="true" />
                        Entfernen
                      </Button>
                    </div>
                  ))}
                </div>
              </form>
            </DialogBody>
            <DialogFooter className={dialogFooterClass}>
              <Button type="button" variant="outline" onClick={() => setShowReturnExchangeDialog(false)} disabled={submittingReturn}>Abbrechen</Button>
              <Button type="submit" form="epo-return-form" disabled={submittingReturn}>
                {submittingReturn && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {submittingReturn ? 'Wird gesendet …' : 'Anfrage speichern'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
