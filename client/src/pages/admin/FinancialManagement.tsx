import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/useToast';
import { printInvoice, type PrintableInvoice } from '@/lib/invoicePrint';
import { getInvoiceItemServiceName } from '@/lib/invoiceItems';
import { buildOrderDetailsState, getOrderDetailsPath } from '@/lib/orderDetailsNavigation';
import { downloadInvoicePdf } from '@/api/invoices';
import { getAdminBookings } from '@/api/bookings';
import { getAdminOrders } from '@/api/adminOrders';
import { getBookingPayments, type BookingPaymentOverview } from '@/api/bookingPayments';
import {
  activateCollection,
  addDunningRunItem,
  addInvoicePayment,
  changeInvoiceStatus,
  createDunningRun,
  createCreditNote,
  createInvoice,
  exportInvoicesData,
  exportPayments,
  getDunningRunById,
  getDunningRuns,
  generateInvoiceFromRepairs,
  getFinancialReports,
  getInvoiceDetails,
  getInvoices,
  getOverdueInvoices,
  getPaymentGateways,
  getPaymentRequests,
  getPayments,
  processRefund,
  reconcileOverpayment,
  reconcileRefund,
  cancelInvoice,
  discardDraftInvoice,
  runDunningStep,
  executeDunningRun,
  requestAdditionalPayment,
  runDunningJob,
  searchCustomers,
  sendInvoice,
  syncBookingFinancials,
  updateDunningRun,
  updateDunningRunItem,
  updatePaymentGateway,
  type DunningRun,
  type CustomerSearchResult,
  type FinancialReport,
  type Invoice,
  type InvoiceItem,
  type InvoiceStatus,
  type Payment,
  type PaymentGateway,
  type PaymentRequestRecord
} from '@/api/financial';
import {
  getSystemConfig,
  updateSystemConfig,
  type SystemConfig,
} from '@/api/systemConfig';
import {
  AlertTriangle,
  Banknote,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Printer,
  Eye,
  FileSpreadsheet,
  ListChecks,
  Loader2,
  Mail,
  Package,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  SkipForward,
  Settings,
  ShieldCheck,
  Trash2,
  TrendingUp,
  User,
  Wallet,
  Wrench,
  X,
  XCircle
} from 'lucide-react';

const invoiceStatusClass: Record<InvoiceStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  pending_approval: 'bg-amber-100 text-amber-700 border-amber-200',
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  viewed: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  partially_paid: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
  overdue: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
  credited: 'bg-violet-100 text-violet-700 border-violet-200'
};

const paymentStatusClass: Record<Payment['status'], string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  processing: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  refunded: 'bg-purple-100 text-purple-700 border-purple-200',
  disputed: 'bg-orange-100 text-orange-700 border-orange-200'
};

const paymentEligibleInvoiceStatuses: InvoiceStatus[] = ['draft', 'pending_approval', 'sent', 'viewed', 'partially_paid', 'overdue'];

// Mirrors server-side INVOICE_STATUS_TRANSITIONS (financialService.js) to prevent invalid transitions in the UI.
const invoiceStatusTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['pending_approval', 'sent', 'cancelled'],
  pending_approval: ['sent', 'draft', 'cancelled'],
  sent: ['viewed', 'partially_paid', 'paid', 'overdue', 'cancelled'],
  viewed: ['partially_paid', 'paid', 'overdue', 'cancelled'],
  partially_paid: ['paid', 'overdue', 'cancelled'],
  paid: ['credited'],
  overdue: ['partially_paid', 'paid', 'cancelled'],
  cancelled: ['credited'],
  credited: []
};

const invoiceStatusFallbackLabel: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  sent: 'Sent',
  viewed: 'Viewed',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Canceled',
  credited: 'Credited'
};

const paymentMethodLabel: Record<Payment['paymentMethod'], string> = {
  bank_transfer: 'Banküberweisung',
  prepayment: 'Vorkasse',
  cash: 'Bar',
  credit_card: 'Kreditkarte',
  debit_card: 'Debitkarte',
  paypal: 'PayPal',
  stripe: 'Stripe'
};

const getInvoiceStatusLabel = (status: InvoiceStatus, t: (key: string, options?: Record<string, unknown>) => string) =>
  t(`financialManagement.invoiceStatuses.${status}`, { defaultValue: invoiceStatusFallbackLabel[status] || status });

const getPaymentStatusLabel = (status: Payment['status'], t: (key: string, options?: Record<string, unknown>) => string) =>
  t(`financialManagement.paymentStatuses.${status}`, { defaultValue: status });

const getDunningStatusLabel = (status: string, t: (key: string, options?: Record<string, unknown>) => string) =>
  t(`financialManagement.dunningStatuses.${status}`, { defaultValue: status });

const getPaymentMethodLabel = (method: string, t: (key: string, options?: Record<string, unknown>) => string) =>
  t(`financialManagement.paymentMethods.${method}`, { defaultValue: paymentMethodLabel[method as Payment['paymentMethod']] || method });

const trackedPaymentMethodOptions = [
  { value: 'credit_card', label: 'Kreditkarte' },
  { value: 'sepa', label: 'SEPA' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'cash', label: 'Bar' },
] as const;

const formatCurrencyValue = (value: number, currency = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(Number(value || 0));

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('de-DE');
};

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('de-DE');
};

const toDateTimeLocalValue = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatReferenceValue = (value: unknown): string => {
  if (value == null) return '-';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return (
      (typeof source.orderNumber === 'string' && source.orderNumber) ||
      (typeof source.invoiceNumber === 'string' && source.invoiceNumber) ||
      (typeof source.number === 'string' && source.number) ||
      (typeof source._id === 'string' && source._id) ||
      (typeof source.id === 'string' && source.id) ||
      '-'
    );
  }
  return '-';
};

const formatReferenceList = (value: unknown): string => {
  if (!Array.isArray(value) || value.length === 0) return '-';
  return value.map((entry) => formatReferenceValue(entry)).join(', ');
};

const getDaysPastDue = (dueDate?: string): number => {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 0;
  const diff = Date.now() - due.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
};

// Zahlungsstand eines Belegs. Massgeblich ist der vom Server EINMAL berechnete Satz
// (`balance`: Forderung minus gueltig zugeordnete Zahlungen), den Liste und Detail
// identisch liefern. Nur fuer Altantworten ohne `balance` die fruehere Naeherung aus
// dem gespeicherten paidAmount.
const getInvoiceOpenAmount = (invoice?: Partial<Invoice> | null): number => {
  if (!invoice) return 0;
  const open = Number(invoice.balance?.open);
  if (invoice.balance && Number.isFinite(open)) return Math.max(0, open);
  return getInvoiceOpenAmount(invoice);
};

const getInvoicePaidAmount = (invoice?: Partial<Invoice> | null): number => {
  if (!invoice) return 0;
  const allocated = Number(invoice.balance?.allocated);
  if (invoice.balance && Number.isFinite(allocated)) return Math.max(0, allocated);
  return Math.max(0, Number(invoice.paidAmount || 0));
};

// "Ueberzahlt / Erstattung offen": an den Kunden zurueckzuzahlender Betrag.
const getInvoiceRefundPending = (invoice?: Partial<Invoice> | null): number =>
  Math.max(0, Number(invoice?.balance?.refundPending || 0));

// Tatsaechlich eingegangener Betrag einer Zahlung (nach abgeschlossenen Erstattungen).
const getPaymentEffectiveAmount = (payment?: Partial<Payment> | null): number => {
  if (!payment) return 0;
  if (Number.isFinite(Number(payment.effectiveAmount))) return Math.max(0, Number(payment.effectiveAmount));
  return Math.max(0, Number(payment.amount || 0) - Number(payment.refundAmount || 0));
};

// Zahlungsstand-Hinweise NEBEN dem Belegstatus. "Teilbezahlt" und "Ueberzahlt /
// Erstattung offen" sind vom Belegstatus (z.B. versendet) unabhaengig und muessen
// auf einen Blick sichtbar sein - auch wenn der zugeordnete Betrag gekappt ist.
const InvoicePaymentHints = ({ invoice }: { invoice?: Partial<Invoice> | null }) => {
  if (!invoice || invoice.isCreditNote) return null;
  const refundPending = getInvoiceRefundPending(invoice);
  const inProgress = Math.max(0, Number(invoice.balance?.refundsInProgress || 0));
  const state = invoice.balance?.paymentState || invoice.paymentState;
  const received = Math.max(0, Number(invoice.balance?.received || 0));
  return (
    <>
      {state === 'partially_paid' && (
        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-800">
          Teilbezahlt · offen {formatCurrencyValue(getInvoiceOpenAmount(invoice))}
        </Badge>
      )}
      {refundPending > 0.009 && (
        <Badge
          variant="outline"
          className="border-rose-300 bg-rose-50 text-[10px] text-rose-800"
          title={`Insgesamt eingegangen: ${formatCurrencyValue(received)} · davon zurückzuzahlen: ${formatCurrencyValue(refundPending)}`}
        >
          Überzahlt · Erstattung offen {formatCurrencyValue(refundPending)}
        </Badge>
      )}
      {inProgress > 0.009 && (
        <Badge variant="outline" className="border-sky-300 bg-sky-50 text-[10px] text-sky-800">
          Erstattung in Bearbeitung {formatCurrencyValue(inProgress)}
        </Badge>
      )}
    </>
  );
};

// Server-Regel "ungeklärte Anbieter-Erstattung" (FinancialService.isUnresolvedGatewayRefund).
const isRefundEntryUnresolved = (entry: { status?: string; mode?: string; unresolved?: boolean; reference?: string }) =>
  entry.status === 'pending'
  && entry.mode === 'gateway'
  && (entry.unresolved === true || !String(entry.reference || '').trim());

// Geldfluss einer Zahlung: Teilerstattungen (Status bleibt "abgeschlossen"),
// laufende Anbieter-Erstattungen und der keiner Rechnung zugeordnete Rest.
const PaymentMoneyFlow = ({ payment, onReconcile }: {
  payment: Partial<Payment>;
  /** Öffnet den Abgleich eines ungeklärten Anbieter-Erstattungsversuchs. */
  onReconcile?: (payment: Partial<Payment>, entry: NonNullable<Payment['refunds']>[number]) => void;
}) => {
  const currency = payment.currency || 'EUR';
  const refunded = Math.max(0, Number(payment.refundAmount || 0));
  const inProgress = Math.max(0, Number(payment.refundsInProgress || 0));
  const unallocated = Math.max(0, Number(payment.unallocatedAmount || 0));
  // PayPal hat nicht eindeutig geantwortet: das Geld kann bereits zurückgeflossen sein.
  // Dieselbe Regel wie der Server (isUnresolvedGatewayRefund): auch ein ausstehender
  // Anbieter-Eintrag OHNE Referenz ist ungeklärt; der Server liefert das Flag mit.
  const unresolved = (payment.refunds || [])
    .filter(isRefundEntryUnresolved)
    .reduce((sum, entry) => sum + Math.max(0, Number(entry.amount || 0)), 0);
  if (refunded <= 0.009 && inProgress <= 0.009 && unallocated <= 0.009) return null;
  return (
    <div className="mt-0.5 space-y-0.5 text-[11px] font-normal">
      {refunded > 0.009 && (
        <div className="text-purple-700">Erstattet: {formatCurrencyValue(refunded, currency)} · verbleibend {formatCurrencyValue(getPaymentEffectiveAmount(payment), currency)}</div>
      )}
      {inProgress > 0.009 && (
        <div className="text-sky-800">Erstattung in Bearbeitung: {formatCurrencyValue(inProgress, currency)} (zählt erst nach Bestätigung)</div>
      )}
      {unresolved > 0.009 && (
        <div className="text-amber-800">
          PayPal-Ergebnis unklar: {formatCurrencyValue(unresolved, currency)} · Abgleich nötig, nicht erneut erstatten
          {onReconcile && (payment.refunds || []).filter(isRefundEntryUnresolved).map((entry) => (
            <Button
              key={`reconcile-${entry._id}`}
              type="button"
              size="sm"
              variant="outline"
              className="ml-2 h-6 px-2 text-[11px]"
              onClick={() => onReconcile(payment, entry)}
            >
              Abgleichen ({formatCurrencyValue(entry.amount, currency)})
            </Button>
          ))}
        </div>
      )}
      {unallocated > 0.009 && (
        <div className="text-rose-800">Nicht zugeordnet: {formatCurrencyValue(unallocated, currency)} · Überzahlung/Erstattung prüfen</div>
      )}
    </div>
  );
};

// Zusatzfelder der Buchungs-Zahlungsuebersicht (Server liefert sie seit dem
// gemeinsamen Saldo-Kern; der Typ in api/bookingPayments.ts kennt sie noch nicht).
type BookingPaymentSummaryExtended = BookingPaymentOverview['summary'] & {
  referenceTotal?: number;
  overpaidTotal?: number;
  refundPendingTotal?: number;
  refundsInProgressTotal?: number;
};
const getExtendedSummary = (overview?: BookingPaymentOverview | null): BookingPaymentSummaryExtended =>
  (overview?.summary || {}) as BookingPaymentSummaryExtended;

// Zahlungsziel-Text aus dem Faelligkeitsdatum - dieselbe Regel wie im Server
// (Invoice.formatPaymentTerms). Der Text ist nicht frei editierbar, damit Datum und
// Wortlaut nie auseinanderlaufen ("faellig in 7 Tagen, Zahlungsziel Net 30").
const formatPaymentTermsFromDueDate = (dueDate?: string): string => {
  if (!dueDate) return 'Aus Kundenprofil (wird beim Speichern berechnet)';
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return '-';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.max(0, Math.round((due.getTime() - today.getTime()) / 86400000));
  if (days === 0) return 'Sofort fällig ohne Abzug';
  return `${days} ${days === 1 ? 'Tag' : 'Tage'} netto ohne Abzug`;
};

const emptyLineItem = (): Omit<InvoiceItem, '_id' | 'total'> & { total?: number } => ({
  description: '',
  quantity: 1,
  unitPrice: 0,
  type: 'service'
});

type DunningQueueItem = {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  amountOpen: number;
  status: 'pending' | 'processing' | 'sent' | 'escalated' | 'skipped' | 'failed';
  note?: string;
};

type SendComposerMode = 'invoice' | 'reminder';

type SendInvoiceForm = {
  recipientEmail: string;
  ccEmail: string;
  subject: string;
  greeting: string;
  introText: string;
  paymentInstructions: string;
  closingText: string;
  legalFooter: string;
  includeItems: boolean;
  includeTaxBreakdown: boolean;
  includeDiscountBreakdown: boolean;
  includePaymentTerms: boolean;
  allowPartialPayment: boolean;
  applyLateFee: boolean;
  lateFeePercent: string;
  attachPdf: boolean;
  sendCopyInternal: boolean;
  internalCopyEmail: string;
  customMessage: string;
  previewFormat: 'html' | 'ascii';
  visualTheme: 'classic' | 'modern' | 'minimal';
  accentColor: string;
  fontScale: 'sm' | 'md' | 'lg';
  compactSpacing: boolean;
  emphasizeTotals: boolean;
  showHeaderBanner: boolean;
  detailLevel: 'compact' | 'detailed';
};

type FinancialSettingsState = NonNullable<SystemConfig['financialSettings']>;

const DEFAULT_FINANCIAL_SETTINGS: FinancialSettingsState = {
  defaults: {
    currency: 'EUR',
    locale: 'de-DE',
    taxRate: 19,
    defaultDiscount: 0,
    paymentTerms: 'Net 14',
    paymentDueDays: 14,
    invoicePrefix: 'INV-',
    creditNotePrefix: 'CN',
    defaultPaymentMethod: 'bank_transfer',
  },
  discountPolicy: {
    allowManualDiscounts: true,
    maxDiscountPercent: 20,
    lateFeePercent: 5,
  },
  invoiceMetadata: {
    sellerName: 'McRepair.de',
    sellerVatId: '',
    sellerRegistrationNumber: '',
    issuerEmail: 'billing@mcrepair.de',
    issuerPhone: '',
    invoiceFooter: 'Vielen Dank fuer Ihr Vertrauen.',
    legalFooter: 'Diese Nachricht wurde automatisch erstellt.',
  },
  paymentPreferences: {
    partialPaymentsAllowed: true,
    autoAttachPdf: true,
    sendInternalCopy: false,
    internalCopyEmail: '',
    showTaxBreakdown: true,
    showDiscountBreakdown: true,
    defaultVisualTheme: 'modern',
    accentColor: '#1a2a5e',
  },
};

const getDueDateByDays = (days: number) =>
  new Date(Date.now() + Math.max(0, Number(days || 0)) * 86400000).toISOString().slice(0, 10);

const roundCurrency = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

/**
 * Einzige Betragsformel des Clients - identisch zu CalculationHelper.calculateInvoiceTotals
 * auf dem Server (server/services/calculationHelper.js).
 *
 * Positionspreise sind BRUTTO. Der Rabatt wird GENAU EINMAL vom Brutto abgezogen,
 * danach werden Netto und MwSt. aus dem rabattierten Brutto herausgerechnet - niemals
 * oben draufgerechnet. `allowNegative` (Gutschrift) behaelt das Vorzeichen der Positionen.
 *
 * taxRatePercent ist ein PROZENTWERT (19), niemals ein Bruch (0.19).
 */
const computeGrossFirstTotals = (
  items: Array<{ quantity?: number | string; unitPrice?: number | string; total?: number | string }>,
  options: { taxRatePercent: number; discountAmount?: number; isReverseCharge?: boolean; allowNegative?: boolean }
) => {
  const isReverseCharge = Boolean(options.isReverseCharge);
  const taxRate = isReverseCharge ? 0 : (Number.isFinite(Number(options.taxRatePercent)) ? Number(options.taxRatePercent) : 19);
  const taxDivisor = 1 + taxRate / 100;
  const discount = roundCurrency(Math.abs(Number(options.discountAmount) || 0));

  const itemsGrossTotal = roundCurrency(
    (items || []).reduce((sum, item) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const lineGross = item.total != null && item.total !== ''
        ? Number(item.total) || 0
        : (Number(item.unitPrice) || 0) * quantity;
      return sum + roundCurrency(lineGross);
    }, 0)
  );

  const grossTotal = options.allowNegative
    ? roundCurrency(Math.sign(itemsGrossTotal || 0) * Math.max(0, Math.abs(itemsGrossTotal) - discount))
    : roundCurrency(Math.max(0, itemsGrossTotal - discount));
  const netTotal = roundCurrency(grossTotal / taxDivisor);
  const taxTotal = isReverseCharge ? 0 : roundCurrency(grossTotal - netTotal);

  return {
    taxRate,
    isReverseCharge,
    itemsGrossTotal,
    discount,
    // subtotal = NETTO, total = BRUTTO - identisch zur Feldsemantik des Invoice-Modells.
    subtotal: netTotal,
    tax: taxTotal,
    total: grossTotal,
  };
};

const mergeFinancialSettings = (settings?: Partial<FinancialSettingsState> | null): FinancialSettingsState => ({
  defaults: {
    ...DEFAULT_FINANCIAL_SETTINGS.defaults,
    ...(settings?.defaults || {}),
  },
  discountPolicy: {
    ...DEFAULT_FINANCIAL_SETTINGS.discountPolicy,
    ...(settings?.discountPolicy || {}),
  },
  invoiceMetadata: {
    ...DEFAULT_FINANCIAL_SETTINGS.invoiceMetadata,
    ...(settings?.invoiceMetadata || {}),
  },
  paymentPreferences: {
    ...DEFAULT_FINANCIAL_SETTINGS.paymentPreferences,
    ...(settings?.paymentPreferences || {}),
  },
});

const createInvoiceFormState = (settings: FinancialSettingsState) => ({
  orderId: '',
  customerId: '',
  customerName: '',
  customerEmail: '',
  taxRate: String(settings.defaults.taxRate),
  discount: String(settings.defaults.defaultDiscount),
  currency: settings.defaults.currency,
  dueDate: getDueDateByDays(settings.defaults.paymentDueDays),
  paymentTerms: settings.defaults.paymentTerms,
  notes: '',
  isReverseCharge: false,
  customerVatId: '',
  sellerVatId: settings.invoiceMetadata?.sellerVatId || 'DE318981969',
  reverseChargeNotice: 'Steuerschuldnerschaft des Leistungsempfängers / Reverse Charge',
  zmRelevant: false,
  items: [emptyLineItem()],
});

const createFromRepairFormState = (settings: FinancialSettingsState) => ({
  repairOrderIds: '',
  taxRate: String(settings.defaults.taxRate),
  // ZUSATZrabatt in EURO. Der Kundengruppenrabatt steckt bereits im Auftrag
  // (order.discount) und wird vom Server uebernommen - ein Vorschlagswert hier wuerde
  // ihn ein zweites Mal abziehen (Sophies 36,06 statt 42,42).
  discount: '',
  dueDate: getDueDateByDays(settings.defaults.paymentDueDays),
  paymentTerms: settings.defaults.paymentTerms,
  notes: '',
  isReverseCharge: false,
  customerVatId: '',
  sellerVatId: settings.invoiceMetadata?.sellerVatId || 'DE318981969',
  reverseChargeNotice: 'Steuerschuldnerschaft des Leistungsempfängers / Reverse Charge',
});

const createPaymentFormState = (
  settings: FinancialSettingsState,
  amount = '',
  scope: 'partial' | 'full' = 'partial'
) => ({
  amount,
  currency: settings.defaults.currency,
  paymentMethod: settings.defaults.defaultPaymentMethod,
  gatewayResponse: '',
  scope,
  reference: '',
  internalNote: '',
  paymentDate: new Date().toISOString().slice(0, 10),
  notifyCustomer: false,
});

/**
 * Seitengroesse der Belegliste. Bewusst gross: solange eine Serverversion den
 * Belegtyp-Filter nicht anwendet, wird clientseitig nachgefiltert - mit dem
 * Serverdefault von 10 Zeilen wuerden Gutschriften die Plaetze der Rechnungsliste
 * verbrauchen (und umgekehrt).
 */
const INVOICE_PAGE_LIMIT = 100;

/**
 * Antwortform von GET /api/admin/financial/invoices - nur die Felder, die die Liste
 * liest. `scope` ist die Bestaetigung des Servers, WELCHEN Belegausschnitt er
 * geliefert hat; nur dann beschreibt `total` den angezeigten Ausschnitt.
 */
interface InvoiceListResponse {
  invoices?: Invoice[];
  scope?: string;
  total?: number;
  totalCount?: number;
  /** Seitenanzahl im gefilterten Ausschnitt (Server: Math.ceil(total / limit)). */
  totalPages?: number;
}

/** BRUTTO-Rabatt der Ursprungsrechnung, immer als positiver Betrag. */
const getInvoiceDiscountAmount = (invoice?: Invoice | null): number =>
  Math.abs(Number(invoice?.discount) || 0);

const createCreditFormState = (settings: FinancialSettingsState, invoice?: Invoice | null) => ({
  reason: '',
  // Eine Gutschrift spiegelt ihre Ursprungsrechnung: Steuersatz wird geerbt.
  taxRate: String(
    invoice?.isReverseCharge
      ? 0
      : (Number.isFinite(Number(invoice?.taxRate)) ? Number(invoice?.taxRate) : settings.defaults.taxRate)
  ),
  scope: 'full' as 'full' | 'partial',
  // Eine VOLLGUTSCHRIFT spiegelt die Ursprungsrechnung exakt - also auch deren
  // Rabatt. Ohne den geerbten Rabatt wuerde die Vorschau die Summe der
  // Positionen zeigen (z. B. -119,00 EUR) statt des tatsaechlichen
  // Rechnungsbetrags (109,00 EUR bei 10,00 EUR Rabatt) und der Server lehnte die
  // Gutschrift mit CREDIT_NOTE_EXCEEDS_INVOICE ab.
  // Bei einer TEILGUTSCHRIFT waehlt der Bearbeiter die Positionen selbst; der
  // Rabatt der Ursprungsrechnung gehoert dann nicht dazu und wird beim Umschalten
  // auf 0 zurueckgesetzt.
  discount: String(getInvoiceDiscountAmount(invoice)),
  dueDate: getDueDateByDays(settings.defaults.paymentDueDays),
});

interface BookingSearchResultItem {
  _id: string;
  bookingNumber?: string;
  orderNumber?: string;
  status?: string;
  billingStatus?: string;
  paymentStatus?: string;
  totalCost?: number;
  cost?: number;
  createdAt?: string;
  customerId?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
    phone?: string;
  } | null;
  guestInfo?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    isGuest?: boolean;
  } | null;
  items?: Array<{
    type?: string;
    device?: string;
    cost?: number;
    services?: Array<{ name?: string; price?: number }>;
  }>;
  deviceType?: string;
  /** Rechnungs-/Gutschriftnummern, ueber die diese Buchung gefunden wurde. */
  matchedInvoiceNumbers?: string[];
}

/**
 * Belegnummern normalisieren, damit alle historischen Schreibweisen matchen:
 * 'INV--2026-0001' (Doppelbindestrich der Altdaten), 'INV-2026-0001',
 * '#INV 2026 0001' und 'INV_2026/0001' ergeben denselben Schluessel.
 */
const normalizeDocumentNumber = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/[\s_/]+/g, '-')
    .replace(/-+/g, '-');

/**
 * Trifft einen Begriff, der wirklich wie eine BELEGnummer aussieht:
 * mit Praefix (INV-2026-0001, CN-2026-0003, STD-2026-0007, auch die Altformate
 * 'INV--2026-0001' und 'CN--CN-2026-0003') oder praefixlos ('2026-0001').
 * Buchungsnummern wie 'BKG-2026-0001' matchen bewusst NICHT - dafuer ist die
 * Buchungssuche zustaendig, und jeder Treffer hier kostet eine zusaetzliche
 * Belegabfrage pro Tastendruck.
 */
const DOCUMENT_NUMBER_PATTERN = /^(?:inv|cn|std)[-\d]|^\d{4}-\d{3,}/;

/** Nur suchen, wenn der Begriff ueberhaupt wie eine Belegnummer aussieht. */
const looksLikeDocumentNumber = (term: string): boolean => {
  const normalized = normalizeDocumentNumber(term);
  return normalized.length >= 3 && DOCUMENT_NUMBER_PATTERN.test(normalized);
};

/**
 * Seitengroesse der Belegsuche im Autocomplete. Der Server filtert ueber
 * `invoiceNumber`/`search`; 25 Treffer reichen fuer eine Vorschlagsliste mit
 * maximal 12 Eintraegen deutlich aus.
 */
const INVOICE_SUGGESTION_LIMIT = 25;

const getSearchResultCustomerName = (item: BookingSearchResultItem): string => {
  if (item.customerId && typeof item.customerId === 'object') {
    const full = `${item.customerId.firstName || ''} ${item.customerId.lastName || ''}`.trim();
    if (full) return full;
    if (item.customerId.name) return item.customerId.name;
    if (item.customerId.email) return item.customerId.email;
  }
  if (item.guestInfo) {
    const full = `${item.guestInfo.firstName || ''} ${item.guestInfo.lastName || ''}`.trim();
    if (full) return `${full} (Gast)`;
    if (item.guestInfo.email) return `${item.guestInfo.email} (Gast)`;
  }
  return 'Kunde';
};

const getSearchResultCustomerEmail = (item: BookingSearchResultItem): string => {
  if (item.customerId && typeof item.customerId === 'object' && item.customerId.email) {
    return item.customerId.email;
  }
  if (item.guestInfo && item.guestInfo.email) {
    return item.guestInfo.email;
  }
  return '';
};

interface BookingSearchAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectItem?: (item: BookingSearchResultItem) => void;
  placeholder?: string;
  type?: 'booking' | 'order';
  disabled?: boolean;
  /**
   * Treffer ueber eine Rechnungsnummer als RECHNUNG uebernehmen (Kennung = Rechnungs-
   * nummer statt Buchung) - auch fuer Rechnungen ohne Buchung. Fuer die
   * Zahlungsaufforderung: dann gilt der offene Betrag genau dieser Rechnung.
   */
  allowInvoiceTarget?: boolean;
}

function BookingSearchAutocomplete({
  value,
  onChange,
  onSelectItem,
  placeholder = 'Buchungs-ID oder Kundenname eingeben...',
  type = 'booking',
  disabled = false,
  allowInvoiceTarget = false,
}: BookingSearchAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BookingSearchResultItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [unlinkedInvoiceHits, setUnlinkedInvoiceHits] = useState<string[]>([]);
  // Jede Eingabe startet eine neue Abfrage. Ohne Sequenznummer koennte eine
  // langsamere fruehere Antwort eine neuere ueberschreiben und die Vorschlagsliste
  // wuerde zum bereits verworfenen Suchbegriff passen.
  const requestSeqRef = useRef(0);

  const fetchSuggestions = useCallback(async (searchTerm: string) => {
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;
    const isStale = () => seq !== requestSeqRef.current;

    setLoading(true);
    const term = searchTerm.trim();
    try {
      if (type === 'order') {
        const res = await getAdminOrders({ search: term, limit: 8 });
        if (isStale()) return;
        const orders = res?.orders || (Array.isArray(res) ? res : []);
        setResults(orders);
        setUnlinkedInvoiceHits([]);
        return;
      }

      // Buchungen und Belege werden parallel gesucht: Sophie tippt mal eine
      // Buchungsnummer, mal eine Rechnungs-/Gutschriftnummer in dasselbe Feld.
      // Die Belegnummer geht als `invoiceNumber` UND `search` an den Server, damit
      // die Filterung dort stattfindet statt auf einer Seite von 100 Belegen.
      const [bookingRes, invoiceRes] = await Promise.all([
        getAdminBookings({ search: term, limit: 8 }).catch(() => null),
        looksLikeDocumentNumber(term)
          ? getInvoices({ invoiceNumber: term, search: term, limit: INVOICE_SUGGESTION_LIMIT }).catch(() => null)
          : Promise.resolve(null),
      ]);
      if (isStale()) return;

      const bookings: BookingSearchResultItem[] = bookingRes?.bookings || [];
      const byId = new Map<string, BookingSearchResultItem>();
      bookings.forEach((b) => { if (b?._id) byId.set(String(b._id), { ...b }); });

      // Der Server filtert die Belegnummer inzwischen selbst (invoiceNumber/search).
      // Das Ergebnis wird hier trotzdem IMMER nachgefiltert - so kann auch eine
      // aeltere Serverversion, die die Parameter ignoriert, keinen falschen Treffer
      // in die Vorschlagsliste spuelen.
      const needle = normalizeDocumentNumber(term);
      const matchingInvoices: Invoice[] = ((invoiceRes?.invoices || []) as Invoice[]).filter((inv) =>
        normalizeDocumentNumber(inv?.invoiceNumber).includes(needle)
      );

      const unlinked: string[] = [];
      matchingInvoices.forEach((inv) => {
        const bookingId = String(inv.bookingId || inv.resolvedBookingId || '');
        if (!bookingId) {
          if (inv.invoiceNumber) unlinked.push(inv.invoiceNumber);
          return;
        }
        const existing = byId.get(bookingId);
        if (existing) {
          existing.matchedInvoiceNumbers = [
            ...(existing.matchedInvoiceNumbers || []),
            inv.invoiceNumber,
          ].filter(Boolean) as string[];
          return;
        }
        byId.set(bookingId, {
          _id: bookingId,
          totalCost: Number(inv.total || 0),
          createdAt: inv.createdAt,
          customerId: { name: inv.customerName, email: inv.customerEmail },
          matchedInvoiceNumbers: inv.invoiceNumber ? [inv.invoiceNumber] : [],
        });
      });

      setResults(Array.from(byId.values()).slice(0, 12));
      setUnlinkedInvoiceHits(Array.from(new Set(unlinked)).slice(0, 5));
    } catch {
      if (isStale()) return;
      setResults([]);
      setUnlinkedInvoiceHits([]);
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [type]);

  const handleInputChange = (text: string) => {
    onChange(text);
    setIsOpen(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void fetchSuggestions(text);
    }, 250);
  };

  const handleFocus = () => {
    setIsOpen(true);
    void fetchSuggestions(value);
  };

  const handleSelect = (item: BookingSearchResultItem) => {
    // Bei einem Treffer ueber die Rechnungsnummer gibt es keine Buchungsnummer im
    // Ergebnis - dann wird die unveraenderliche Id uebernommen, damit die Aktion
    // garantiert auf der richtigen Buchung landet.
    const invoiceTarget = allowInvoiceTarget && type !== 'order' && (item.matchedInvoiceNumbers || []).length === 1
      ? (item.matchedInvoiceNumbers || [])[0]
      : '';
    const identifier = invoiceTarget || (type === 'order' ? (item.orderNumber || item._id) : (item.bookingNumber || item._id));
    onChange(identifier);
    if (onSelectItem) {
      onSelectItem(item);
    }
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={value}
          disabled={disabled}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="h-8 pl-8 pr-7 text-xs bg-background"
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute right-2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
            title="Eingabe leeren"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg animate-in fade-in-50 zoom-in-95">
          {loading ? (
            <div className="flex items-center justify-center p-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-2 text-primary" />
              Suche {type === 'order' ? 'Bestellungen' : 'Buchungen'}...
            </div>
          ) : results.length > 0 ? (
            <div className="p-1 divide-y divide-border/40">
              {results.map((item) => {
                const idLabel = type === 'order' ? (item.orderNumber || item._id) : (item.bookingNumber || item._id);
                const custName = getSearchResultCustomerName(item);
                const custEmail = getSearchResultCustomerEmail(item);
                const cost = Number(item.totalCost || item.cost || 0);
                const status = item.status || item.billingStatus || 'pending';
                const device = item.items?.[0]?.device || item.deviceType || '';

                return (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="w-full text-left p-2 rounded hover:bg-accent hover:text-accent-foreground flex items-center justify-between transition-colors text-xs group"
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-primary font-mono">{idLabel}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-[#1a2a5e]/30 text-[#1a2a5e] dark:text-[#f5c800] dark:border-[#f5c800]/30 font-normal">
                          {status}
                        </Badge>
                        {(item.matchedInvoiceNumbers || []).map((num) => (
                          <Badge
                            key={num}
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-4 border-purple-300 bg-purple-50 text-purple-800 font-normal"
                          >
                            Beleg: {num}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-1 text-foreground font-medium truncate">
                        <User className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{custName}</span>
                      </div>
                      {(custEmail || device) && (
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground truncate">
                          {custEmail && (
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{custEmail}</span>
                            </span>
                          )}
                          {device && (
                            <span className="truncate text-slate-500 dark:text-slate-400">
                              • {device}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      <div className="font-semibold text-xs text-foreground">
                        {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cost)}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('de-DE') : ''}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-3 text-center text-xs text-muted-foreground">
              Keine {type === 'order' ? 'Bestellungen' : 'Buchungen'} gefunden.
            </div>
          )}
          {!loading && unlinkedInvoiceHits.length > 0 && allowInvoiceTarget && (
            <div className="border-t border-border/40 p-1">
              {unlinkedInvoiceHits.map((num) => (
                <button
                  key={`unlinked-${num}`}
                  type="button"
                  onClick={() => {
                    onChange(num);
                    if (onSelectItem) onSelectItem({ _id: '', matchedInvoiceNumbers: [num] });
                    setIsOpen(false);
                  }}
                  className="w-full rounded p-2 text-left text-[11px] hover:bg-accent"
                >
                  <span className="font-mono font-semibold text-primary">{num}</span>
                  <span className="text-muted-foreground"> · Rechnung ohne Buchung</span>
                </button>
              ))}
            </div>
          )}
          {!loading && unlinkedInvoiceHits.length > 0 && !allowInvoiceTarget && (
            <div className="border-t border-border/40 p-2 text-[11px] text-amber-700">
              {unlinkedInvoiceHits.length === 1 ? 'Beleg ' : 'Belege '}
              <span className="font-mono font-semibold">{unlinkedInvoiceHits.join(', ')}</span>
              {unlinkedInvoiceHits.length === 1 ? ' ist keiner Buchung zugeordnet.' : ' sind keiner Buchung zugeordnet.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export type FinancialManagementMode = 'invoices' | 'creditNotes';

export function FinancialManagement({ mode = 'invoices' }: { mode?: FinancialManagementMode }) {
  const { t } = useTranslation()
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  // Gutschriften sind eine eigene Belegart mit eigener Nummernkreis-Serie und
  // eigener Navigationskategorie. In der Rechnungsliste haben sie nichts verloren.
  const isCreditNoteView = mode === 'creditNotes';

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(mode === 'creditNotes' ? 'invoices' : 'overview');
  const [activeHighlightedInvoiceId, setActiveHighlightedInvoiceId] = useState<string | null>(null);
  const [handledHighlightInvoiceKey, setHandledHighlightInvoiceKey] = useState<string | null>(null);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [savingFinancialSettings, setSavingFinancialSettings] = useState(false);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Set<string>>(new Set());
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<Invoice[]>([]);

  const [invoiceFilters, setInvoiceFilters] = useState({ status: 'all', taxType: 'all', dateFrom: '', dateTo: '', correctionType: 'all', originalInvoiceNumber: '' });
  const [paymentFilters, setPaymentFilters] = useState({ status: 'all', method: 'all', dateFrom: '', dateTo: '' });

  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceDetailsDialogOpen, setInvoiceDetailsDialogOpen] = useState(false);
  const [sendComposerOpen, setSendComposerOpen] = useState(false);
  const [dunningCaseDialogOpen, setDunningCaseDialogOpen] = useState(false);
  const [fromRepairDialogOpen, setFromRepairDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  // Abgleich eines ungeklärten PayPal-Erstattungsversuchs (nach Prüfung im PayPal-Konto).
  const [reconcileTarget, setReconcileTarget] = useState<{ payment: Partial<Payment>; entry: NonNullable<Payment['refunds']>[number] } | null>(null);
  const [reconcileRefundId, setReconcileRefundId] = useState('');
  const [reconcileSubmitting, setReconcileSubmitting] = useState(false);
  const [gatewayDialogOpen, setGatewayDialogOpen] = useState(false);

  const tabFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('tab');
  }, [location.search]);

  const highlightInvoiceIdFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('highlightInvoiceId');
  }, [location.search]);

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceDetailPayments, setInvoiceDetailPayments] = useState<Payment[]>([]);
  const [invoiceDetailCreditNotes, setInvoiceDetailCreditNotes] = useState<Partial<Invoice>[]>([]);
  const [invoiceDetailLoading, setInvoiceDetailLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway | null>(null);

  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerSearchResult[]>([]);

  const financialSettings = useMemo(() => mergeFinancialSettings(systemConfig?.financialSettings), [systemConfig]);
  const formatCurrency = (value: number, currency = financialSettings.defaults.currency) =>
    formatCurrencyValue(value, currency || financialSettings.defaults.currency);

  const [invoiceForm, setInvoiceForm] = useState(() => createInvoiceFormState(DEFAULT_FINANCIAL_SETTINGS));

  const [fromRepairForm, setFromRepairForm] = useState(() => createFromRepairFormState(DEFAULT_FINANCIAL_SETTINGS));

  const [statusForm, setStatusForm] = useState<{
    status: InvoiceStatus;
    notes: string;
    paymentMethod: Invoice['paymentMethod'] | '';
    paidAt: string;
  }>({
    status: 'pending_approval',
    notes: '',
    paymentMethod: '',
    paidAt: toDateTimeLocalValue(),
  });

  const [paymentForm, setPaymentForm] = useState(() => createPaymentFormState(DEFAULT_FINANCIAL_SETTINGS));

  const [creditForm, setCreditForm] = useState(() => createCreditFormState(DEFAULT_FINANCIAL_SETTINGS));
  const [creditItemOverrides, setCreditItemOverrides] = useState<Array<{ included: boolean; quantity: string; unitPrice: string }>>([]);

  const [refundForm, setRefundForm] = useState({
    amount: '',
    reason: '',
    reasonCategory: '',
    internalNote: '',
    mode: 'gateway' as 'gateway' | 'manual',
    gatewayProvider: '',
    gatewayReference: '',
    notifyCustomer: false,
  });

  const [dunningRunName, setDunningRunName] = useState(`Mahnlauf ${new Date().toLocaleDateString('de-DE')}`);
  const [dunningDefaultStatus, setDunningDefaultStatus] = useState<InvoiceStatus>('overdue');
  const [dunningDefaultNote, setDunningDefaultNote] = useState('Manueller Mahnlauf');
  const [dunningSelection, setDunningSelection] = useState<string[]>([]);
  const [dunningQueue, setDunningQueue] = useState<DunningQueueItem[]>([]);
  const [dunningPaused, setDunningPaused] = useState(false);
  const [dunningExecuting, setDunningExecuting] = useState(false);
  const [dunningRuns, setDunningRuns] = useState<DunningRun[]>([]);
  const [selectedDunningRunId, setSelectedDunningRunId] = useState<string>('');
  const [dunningRunDetailsOpen, setDunningRunDetailsOpen] = useState(false);
  const [selectedDunningRun, setSelectedDunningRun] = useState<DunningRun | null>(null);
  const [dunningCaseStatus, setDunningCaseStatus] = useState<InvoiceStatus>('overdue');
  const [dunningCaseNote, setDunningCaseNote] = useState('');
  const [sendComposerMode, setSendComposerMode] = useState<SendComposerMode>('invoice');
  const [sendComposerForm, setSendComposerForm] = useState<SendInvoiceForm>({
    recipientEmail: '',
    ccEmail: '',
    subject: '',
    greeting: 'Guten Tag,',
    introText: 'anbei erhalten Sie Ihre Rechnung.',
    paymentInstructions: 'Bitte begleichen Sie den offenen Betrag fristgerecht unter Angabe der Rechnungsnummer.',
    closingText: 'Vielen Dank fuer Ihr Vertrauen.',
    legalFooter: 'Diese Nachricht wurde automatisch erstellt.',
    includeItems: true,
    includeTaxBreakdown: true,
    includeDiscountBreakdown: true,
    includePaymentTerms: true,
    allowPartialPayment: false,
    applyLateFee: false,
    lateFeePercent: '5',
    attachPdf: true,
    sendCopyInternal: false,
    internalCopyEmail: '',
    customMessage: '',
    previewFormat: 'html',
    visualTheme: 'modern',
    accentColor: '#1a2a5e',
    fontScale: 'md',
    compactSpacing: false,
    emphasizeTotals: true,
    showHeaderBanner: true,
    detailLevel: 'detailed'
  });

  const hasAddressData = (address?: Record<string, unknown> | null) => {
    if (!address || typeof address !== 'object') return false;
    return Boolean(
      address.company ||
      address.name ||
      address.firstName ||
      address.lastName ||
      address.street ||
      address.houseNumber ||
      address.city ||
      address.state ||
      address.zipCode ||
      address.zip ||
      address.country
    );
  };

  const selectedInvoiceAddress = useMemo(() => {
    if (!selectedInvoice) return null;
    const src = selectedInvoice as unknown as Record<string, unknown>;
    const cust = (src.customer || {}) as Record<string, unknown>;
    return (
      (src.invoiceAddress as Record<string, unknown>) ||
      (src.billingAddress as Record<string, unknown>) ||
      (src.customerAddress as Record<string, unknown>) ||
      (cust.invoiceAddress as Record<string, unknown>) ||
      (cust.billingAddress as Record<string, unknown>) ||
      null
    );
  }, [selectedInvoice]);

  const selectedInvoiceShippingAddress = useMemo(() => {
    if (!selectedInvoice) return null;
    const src = selectedInvoice as unknown as Record<string, unknown>;
    const cust = (src.customer || {}) as Record<string, unknown>;
    return (
      (src.shippingAddress as Record<string, unknown>) ||
      (src.deliveryAddress as Record<string, unknown>) ||
      (cust.shippingAddress as Record<string, unknown>) ||
      (cust.paymentAddress as Record<string, unknown>) ||
      null
    );
  }, [selectedInvoice]);

  const selectedInvoiceShippingSameAsBilling = useMemo(() => {
    const src = (selectedInvoice || {}) as unknown as Record<string, unknown>;
    const shipAddr = src.shippingAddress as Record<string, unknown> | undefined;
    const cust = (src.customer || {}) as Record<string, unknown>;
    const payAddr = cust.paymentAddress as Record<string, unknown> | undefined;
    const explicitSameAs = shipAddr?.sameAsInvoice ?? payAddr?.sameAsInvoice;
    if (explicitSameAs === true) return true;
    return !hasAddressData(selectedInvoiceShippingAddress) && hasAddressData(selectedInvoiceAddress);
  }, [selectedInvoice, selectedInvoiceAddress, selectedInvoiceShippingAddress]);

  const compatibleRefundGateways = useMemo(() => {
    if (!selectedPayment) return [];
    return gateways.filter((gateway) => gateway.isActive && gateway.supportedMethods.includes(selectedPayment.paymentMethod));
  }, [gateways, selectedPayment]);

  const suggestedRefundGateway = useMemo(() => {
    if (!selectedPayment) return '';
    if (selectedPayment.paymentMethod === 'paypal') return 'paypal';
    if (selectedPayment.paymentMethod === 'stripe') return 'stripe';
    const firstCompatible = compatibleRefundGateways[0];
    return firstCompatible?.provider || '';
  }, [compatibleRefundGateways, selectedPayment]);

  const creditPreview = useMemo(() => {
    if (!selectedInvoice) return null;
    const srcItems = selectedInvoice.items || [];
    const activeItems =
      creditForm.scope === 'full'
        ? srcItems.map((item) => ({
            serviceName: item.serviceName,
            description: item.description,
            quantity: item.quantity,
            unitPrice: -Math.abs(item.unitPrice),
            total: -Math.abs(item.total),
            type: item.type,
          }))
        : srcItems
            .map((item, i) => ({ item, ov: creditItemOverrides[i] }))
            .filter(({ ov }) => ov?.included !== false)
            .map(({ item, ov }) => {
              // Number('') === 0, deshalb reicht ein '>= 0'-Test nicht: ein leeres Feld
              // muss auf den Rechnungspreis zurueckfallen, nicht auf 0.
              const rawQty = String(ov?.quantity ?? '').trim();
              const rawPrice = String(ov?.unitPrice ?? '').trim();
              const qty = rawQty !== '' && Number(rawQty) > 0 ? Number(rawQty) : item.quantity;
              const price = rawPrice !== '' && Number.isFinite(Number(rawPrice)) && Number(rawPrice) >= 0
                ? Number(rawPrice)
                : Math.abs(item.unitPrice);
              return {
                serviceName: item.serviceName,
                description: item.description,
                quantity: qty,
                // Positionspreise sind BRUTTO (wie auf der Ursprungsrechnung).
                unitPrice: -price,
                total: -roundCurrency(qty * price),
                type: item.type,
              };
            });

    // Exakt dieselbe Brutto-Arithmetik wie der Server: der Rabatt mindert das Brutto
    // einmal, Netto/MwSt. werden anschliessend herausgerechnet.
    const totals = computeGrossFirstTotals(activeItems, {
      taxRatePercent: Number(creditForm.taxRate),
      discountAmount: Number(creditForm.discount),
      isReverseCharge: Boolean(selectedInvoice.isReverseCharge),
      allowNegative: true,
    });

    return {
      items: activeItems,
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount: -totals.discount,
      total: totals.total,
      taxRate: totals.taxRate,
      isReverseCharge: totals.isReverseCharge,
    };
  }, [selectedInvoice, creditForm, creditItemOverrides]);

  const paymentOverview = useMemo(() => {
    const totalCount = payments.length;
    const completed = payments.filter((p) => p.status === 'completed');
    const refunded = payments.filter((p) => p.status === 'refunded');
    const openProcesses = payments.filter((p) => ['pending', 'processing', 'disputed'].includes(p.status));
    const failed = payments.filter((p) => p.status === 'failed');

    const completedVolume = completed.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const refundedVolume = refunded.reduce((sum, p) => sum + Number(p.refundAmount || p.amount || 0), 0);
    const successRate = totalCount > 0 ? ((completed.length / totalCount) * 100) : 0;

    return {
      totalCount,
      completedCount: completed.length,
      refundedCount: refunded.length,
      openCount: openProcesses.length,
      failedCount: failed.length,
      completedVolume,
      refundedVolume,
      successRate,
    };
  }, [payments]);

  const selectedInvoiceOpenAmount = useMemo(() => {
    if (!selectedInvoice) return 0;
    return getInvoiceOpenAmount(selectedInvoice);
  }, [selectedInvoice]);

  const canRecordPayment = (invoice?: Invoice | null) => {
    if (!invoice) return false;
    if (invoice.isCreditNote) return false;
    if (!paymentEligibleInvoiceStatuses.includes(invoice.status)) return false;
    const remaining = getInvoiceOpenAmount(invoice);
    return remaining > 0;
  };

  const selectedInvoicePaymentHistory = useMemo(() => {
    if (!selectedInvoice) return [] as Payment[];
    const fromGlobal = payments.filter((p) => p.invoiceId === selectedInvoice._id);
    const merged = [...invoiceDetailPayments, ...fromGlobal];
    const unique = new Map<string, Payment>();
    for (const entry of merged) unique.set(entry._id, entry);
    return Array.from(unique.values()).sort((a, b) => {
      const da = new Date(a.processedAt || a.createdAt || '').getTime();
      const db = new Date(b.processedAt || b.createdAt || '').getTime();
      return db - da;
    });
  }, [selectedInvoice, invoiceDetailPayments, payments]);

  // Mahnliste ausschließlich aus der Serverberechnung (GET /invoices/overdue): nur
  // überfällige Belege mit echter offener Forderung. Früher kamen alle Belege mit Status
  // 'overdue' hinzu - auch bezahlte oder nur überzahlte.
  const dunningEligibleInvoices = useMemo(() => overdueInvoices, [overdueInvoices]);

  const selectedDunningQueueItem = useMemo(() => {
    if (!selectedInvoice) return null;
    return dunningQueue.find((item) => item.invoiceId === selectedInvoice._id) || null;
  }, [dunningQueue, selectedInvoice]);

  const generatedSendMessage = useMemo(() => {
    if (!selectedInvoice) return '';

    const openAmount = getInvoiceOpenAmount(selectedInvoice);
    const lines: string[] = [];

    lines.push(sendComposerForm.greeting);
    lines.push('');
    lines.push(sendComposerForm.introText);
    lines.push('');
    const isDetailed = sendComposerForm.detailLevel === 'detailed';

    const invoiceFacts: Array<[string, string]> = [
      ['Rechnungsnummer', selectedInvoice.invoiceNumber],
      ['Rechnungsdatum', formatDate(selectedInvoice.createdAt)],
      ['Faelligkeitsdatum', formatDate(selectedInvoice.dueDate)],
      ['Gesamtbetrag', formatCurrencyValue(selectedInvoice.total || 0)],
      ['Offener Betrag', formatCurrencyValue(openAmount)]
    ];

    if (isDetailed && sendComposerForm.includePaymentTerms) {
      invoiceFacts.push(['Zahlungsziel', selectedInvoice.paymentTerms || '-']);
    }

    if (isDetailed && sendComposerForm.includeTaxBreakdown) {
      invoiceFacts.push(['Steuer', formatCurrencyValue(selectedInvoice.tax || 0)]);
    }

    if (isDetailed && sendComposerForm.includeDiscountBreakdown) {
      invoiceFacts.push(['Rabatt', formatCurrencyValue(selectedInvoice.discount || 0)]);
    }

    const longestLabel = Math.max(...invoiceFacts.map(([label]) => label.length));
    lines.push('Rechnungsuebersicht');
    lines.push('------------------');
    for (const [label, value] of invoiceFacts) {
      lines.push(`${label.padEnd(longestLabel, ' ')} : ${value}`);
    }

    if (isDetailed && sendComposerForm.includeItems && selectedInvoice.items?.length) {
      lines.push('');
      lines.push('Positionen:');
      for (const item of selectedInvoice.items) {
        lines.push(`- ${getInvoiceItemServiceName(item)} | ${item.quantity} x ${formatCurrencyValue(item.unitPrice || 0)} = ${formatCurrencyValue(item.total || 0)}`);
      }
    }

    lines.push('');
    lines.push(sendComposerForm.paymentInstructions);

    if (sendComposerForm.allowPartialPayment) {
      lines.push('Teilzahlungen sind nach Ruecksprache moeglich.');
    }

    if (sendComposerForm.applyLateFee) {
      lines.push(`Bei Zahlungsverzug kann eine Verzugspauschale von ${sendComposerForm.lateFeePercent}% anfallen.`);
    }

    lines.push('');
    lines.push(sendComposerForm.closingText);
    lines.push(sendComposerForm.legalFooter);

    return lines.filter((line, index, arr) => !(line === '' && arr[index - 1] === '')).join('\n');
  }, [selectedInvoice, sendComposerForm]);

  const generatedAsciiPreview = useMemo(() => {
    if (!selectedInvoice) return '';
    const openAmount = getInvoiceOpenAmount(selectedInvoice);
    const line = '----------------------------------------------------------------------';
    const lines: string[] = [];

    lines.push(line);
    lines.push(sendComposerMode === 'reminder' ? ' ZAHLUNGSERINNERUNG ' : ' RECHNUNGSVERSAND ');
    lines.push(line);
    lines.push(`Betreff: ${sendComposerForm.subject}`);
    lines.push(`Empfaenger: ${sendComposerForm.recipientEmail || '-'}`);
    lines.push(`Rechnung: ${selectedInvoice.invoiceNumber}`);
    lines.push(`Kunde: ${selectedInvoice.customerName}`);
    lines.push(`Faelligkeit: ${formatDate(selectedInvoice.dueDate)}`);
    lines.push(`Gesamt: ${formatCurrencyValue(selectedInvoice.total || 0)}`);
    lines.push(`Offen: ${formatCurrencyValue(openAmount)}`);
    lines.push(line);
    lines.push(generatedSendMessage);
    lines.push(line);

    return lines.join('\n');
  }, [selectedInvoice, sendComposerForm.subject, sendComposerForm.recipientEmail, sendComposerMode, generatedSendMessage]);

  const generatedHtmlPreview = useMemo(() => {
    if (!selectedInvoice) return '';

    const openAmount = getInvoiceOpenAmount(selectedInvoice);
    const themeBackground =
      sendComposerForm.visualTheme === 'modern'
        ? '#f7f9fc'
        : sendComposerForm.visualTheme === 'classic'
          ? '#ffffff'
          : '#fafafa';
    const cardBorder = sendComposerForm.visualTheme === 'minimal' ? '#e5e7eb' : '#d8dce6';
    const fontSize = sendComposerForm.fontScale === 'sm' ? '13px' : sendComposerForm.fontScale === 'lg' ? '16px' : '14px';
    const spacing = sendComposerForm.compactSpacing ? '10px' : '16px';
    const headingSize = sendComposerForm.fontScale === 'sm' ? '18px' : sendComposerForm.fontScale === 'lg' ? '24px' : '20px';

    const isDetailed = sendComposerForm.detailLevel === 'detailed';

    const invoiceFactsRows = [
      ['Rechnungsnummer', selectedInvoice.invoiceNumber],
      ['Rechnungsdatum', formatDate(selectedInvoice.createdAt)],
      ['Faelligkeitsdatum', formatDate(selectedInvoice.dueDate)],
      ['Gesamtbetrag', formatCurrencyValue(selectedInvoice.total || 0)],
      ['Offener Betrag', formatCurrencyValue(openAmount)],
      ...(isDetailed && sendComposerForm.includePaymentTerms ? [['Zahlungsziel', selectedInvoice.paymentTerms || '-']] : []),
      ...(isDetailed && sendComposerForm.includeTaxBreakdown ? [['Steuer', formatCurrencyValue(selectedInvoice.tax || 0)]] : []),
      ...(isDetailed && sendComposerForm.includeDiscountBreakdown ? [['Rabatt', formatCurrencyValue(selectedInvoice.discount || 0)]] : [])
    ];

    return `
<div style="font-family:Arial,Helvetica,sans-serif;background:${themeBackground};padding:${spacing};font-size:${fontSize};color:#111827;line-height:1.55;">
  <div style="max-width:780px;margin:0 auto;background:#fff;border:1px solid ${cardBorder};border-radius:12px;overflow:hidden;">
    ${sendComposerForm.showHeaderBanner ? `<div style="background:${sendComposerForm.accentColor};color:#fff;padding:${spacing};font-size:${headingSize};font-weight:700;">${sendComposerMode === 'reminder' ? 'Zahlungserinnerung' : 'Ihre Rechnung'}</div>` : ''}
    <div style="padding:${spacing};">
      <div style="font-size:${headingSize};font-weight:700;color:${sendComposerForm.accentColor};margin-bottom:6px;">${escapeHtml(sendComposerForm.subject)}</div>
      <div style="color:#6b7280;margin-bottom:${spacing};">Rechnung ${escapeHtml(selectedInvoice.invoiceNumber)} · Kunde ${escapeHtml(selectedInvoice.customerName)}</div>
      <div style="margin-bottom:${spacing};white-space:pre-wrap;">${escapeHtml(sendComposerForm.greeting)}\n\n${escapeHtml(sendComposerForm.introText)}</div>

      <div style="margin-bottom:${spacing};border:1px solid ${cardBorder};border-radius:10px;overflow:hidden;">
        <div style="background:${sendComposerForm.accentColor};color:#fff;padding:10px 12px;font-weight:700;">Rechnungsuebersicht</div>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            ${invoiceFactsRows
              .map(
                ([label, value], index) => `<tr style="background:${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                  <td style="padding:10px 12px;font-weight:600;color:#374151;border-bottom:1px solid ${cardBorder};">${escapeHtml(label)}</td>
                  <td style="padding:10px 12px;text-align:right;color:${label === 'Offener Betrag' ? sendComposerForm.accentColor : '#111827'};font-weight:${label === 'Offener Betrag' ? '700' : '500'};border-bottom:1px solid ${cardBorder};">${escapeHtml(value)}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>

      <div style="white-space:pre-wrap;margin-bottom:${spacing};">${escapeHtml(sendComposerForm.paymentInstructions)}</div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
        <div style="border:1px solid ${cardBorder};border-radius:8px;padding:10px;">Faelligkeit: ${escapeHtml(formatDate(selectedInvoice.dueDate))}</div>
        <div style="border:1px solid ${cardBorder};border-radius:8px;padding:10px;">Gesamt: ${escapeHtml(formatCurrencyValue(selectedInvoice.total || 0))}</div>
        <div style="border:1px solid ${sendComposerForm.emphasizeTotals ? sendComposerForm.accentColor : cardBorder};border-radius:8px;padding:10px;font-weight:${sendComposerForm.emphasizeTotals ? '700' : '500'};color:${sendComposerForm.emphasizeTotals ? sendComposerForm.accentColor : '#111827'};">Offen: ${escapeHtml(formatCurrencyValue(openAmount))}</div>
        <div style="border:1px solid ${cardBorder};border-radius:8px;padding:10px;">Zahlungsziel: ${escapeHtml(sendComposerForm.includePaymentTerms ? (selectedInvoice.paymentTerms || '-') : 'ausgeblendet')}</div>
      </div>

      <div style="margin-top:${spacing};white-space:pre-wrap;">${escapeHtml(sendComposerForm.closingText)}</div>
      <div style="margin-top:8px;color:#6b7280;font-size:12px;">${escapeHtml(sendComposerForm.legalFooter)}</div>
    </div>
  </div>
</div>
`;
  }, [selectedInvoice, sendComposerForm, sendComposerMode]);

  const dunningTimeline = useMemo(() => {
    if (!selectedInvoice) return [] as Array<{ id: string; title: string; detail: string; at?: string; severity: 'neutral' | 'info' | 'warning' | 'success' | 'critical' }>;

    const entries: Array<{ id: string; title: string; detail: string; at?: string; severity: 'neutral' | 'info' | 'warning' | 'success' | 'critical' }> = [];

    entries.push({
      id: 'created',
      title: 'Rechnung erstellt',
      detail: `Status bei Anlage: ${getInvoiceStatusLabel(selectedInvoice.status, t)}`,
      at: selectedInvoice.createdAt,
      severity: 'neutral'
    });

    entries.push({
      id: 'due',
      title: 'Faelligkeit erreicht',
      detail: `${getDaysPastDue(selectedInvoice.dueDate)} Tage ueberfaellig`,
      at: selectedInvoice.dueDate,
      severity: 'warning'
    });

    if (selectedInvoice.sentAt) {
      entries.push({ id: 'sent', title: 'Rechnung versendet', detail: 'Versand an Kundenkontakt', at: selectedInvoice.sentAt, severity: 'info' });
    }
    if (selectedInvoice.dunningNotifiedAt) {
      entries.push({ id: 'dunning_notified', title: 'Mahnung/Erinnerung versendet', detail: `Mahnstufe: ${selectedInvoice.dunningLevel ?? 0}`, at: selectedInvoice.dunningNotifiedAt, severity: 'warning' });
    }
    if (selectedInvoice.paidAt) {
      entries.push({ id: 'paid', title: 'Rechnung bezahlt', detail: `Bezahlt: ${formatCurrencyValue(getInvoicePaidAmount(selectedInvoice))}`, at: selectedInvoice.paidAt, severity: 'success' });
    }
    if (selectedInvoice.cancelledAt) {
      const cancellation = selectedInvoice.cancellation;
      const isDiscarded = cancellation?.kind === 'draft_discarded';
      const cancellationDetail = cancellation?.reason
        ? [
          `Grund: ${cancellation.reason}`,
          cancellation.actorName ? `durch ${cancellation.actorName}` : '',
          cancellation.creditNoteNumber ? `Storno-Gutschrift ${cancellation.creditNoteNumber}` : '',
          Number(cancellation.allocatedAtCancellation || 0) > 0.009 ? `${formatCurrency(Number(cancellation.allocatedAtCancellation || 0))} bleiben als Guthaben/offene Erstattung` : '',
        ].filter(Boolean).join(' · ')
        : 'Rechnung wurde storniert';
      entries.push({ id: 'cancelled', title: isDiscarded ? 'Entwurf verworfen' : 'Rechnung storniert', detail: cancellationDetail, at: selectedInvoice.cancelledAt, severity: 'critical' });
    }

    entries.push({
      id: 'updated',
      title: 'Letzte Aktualisierung',
      detail: `Aktueller Status: ${getInvoiceStatusLabel(selectedInvoice.status, t)}`,
      at: selectedInvoice.updatedAt,
      severity: 'neutral'
    });

    if (selectedDunningQueueItem) {
      entries.push({
        id: 'queue_state',
        title: 'Aktueller Mahnlauf-Queue Status',
        detail: `${getDunningStatusLabel(selectedDunningQueueItem.status, t)}${selectedDunningQueueItem.note ? ` - ${selectedDunningQueueItem.note}` : ''}`,
        at: selectedInvoice.updatedAt,
        severity:
          selectedDunningQueueItem.status === 'failed'
            ? 'critical'
            : selectedDunningQueueItem.status === 'escalated'
              ? 'warning'
              : selectedDunningQueueItem.status === 'sent'
                ? 'info'
                : selectedDunningQueueItem.status === 'processing'
                  ? 'warning'
                  : selectedDunningQueueItem.status === 'skipped'
                    ? 'neutral'
                    : 'neutral'
      });
    }

    return entries.sort((a, b) => {
      const tsA = a.at ? new Date(a.at).getTime() : 0;
      const tsB = b.at ? new Date(b.at).getTime() : 0;
      return tsA - tsB;
    });
  }, [selectedInvoice, selectedDunningQueueItem, t]);

  const totals = useMemo(() => {
    // Eingegangenes Geld nach abgeschlossenen Erstattungen (Teilerstattung bleibt 'completed').
    const paidAmount = payments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + getPaymentEffectiveAmount(p), 0);
    const openInvoices = invoices.filter((i) => !['paid', 'cancelled', 'credited'].includes(i.status));
    const openAmount = openInvoices.reduce((sum, i) => sum + getInvoiceOpenAmount(i), 0);
    const overdueAmount = dunningEligibleInvoices.reduce((sum, i) => sum + getInvoiceOpenAmount(i), 0);
    return {
      paidAmount,
      openCount: openInvoices.length,
      openAmount,
      overdueCount: dunningEligibleInvoices.length,
      overdueAmount
    };
  }, [payments, invoices, dunningEligibleInvoices]);

  const invoiceDraftTotals = useMemo(() => {
    const isReverseCharge = Boolean(invoiceForm.isReverseCharge);
    // Rabatt wird als PROZENT erfasst und auf das Positions-BRUTTO angewendet.
    const itemsGross = invoiceForm.items.reduce(
      (sum, item) => sum + roundCurrency(Number(item.quantity || 0) * Number(item.unitPrice || 0)),
      0
    );
    const discountAmount = roundCurrency(itemsGross * (Number(invoiceForm.discount || 0) / 100));
    const totals = computeGrossFirstTotals(invoiceForm.items, {
      taxRatePercent: Number(invoiceForm.taxRate || financialSettings.defaults.taxRate),
      discountAmount,
      isReverseCharge,
    });
    return { ...totals, discount: discountAmount };
  }, [invoiceForm.isReverseCharge, invoiceForm.taxRate, invoiceForm.discount, invoiceForm.items, financialSettings.defaults.taxRate]);

  // Der Belegtyp wird als Filter an den Server geschickt (GET .../invoices?isCreditNote=).
  // Der clientseitige Nachfilter bleibt als Netz bestehen, damit eine Serverversion
  // ohne diesen Filter niemals Gutschriften in der Rechnungsliste anzeigt - und
  // umgekehrt.
  const invoiceScopeParams = useMemo(
    () => ({ isCreditNote: isCreditNoteView ? 'true' : 'false', limit: String(INVOICE_PAGE_LIMIT) }),
    [isCreditNoteView]
  );
  const applyInvoiceScope = useCallback(
    (list: Invoice[]) => (list || []).filter((inv) => Boolean(inv.isCreditNote) === isCreditNoteView),
    [isCreditNoteView]
  );

  // Wurde der Belegtyp wirklich vom Server gefiltert? Die Antwort bestaetigt den
  // angewendeten Ausschnitt in `scope`. Fehlt die Bestaetigung (aeltere
  // Serverversion), ist die Liste nur so vollstaendig wie die abgerufene Seite und
  // total/totalAmount beschreiben den UNGEFILTERTEN Bestand - dann darf weder die
  // Gesamtzahl angezeigt noch die Vollstaendigkeit behauptet werden.
  const [invoiceScopeIncomplete, setInvoiceScopeIncomplete] = useState(false);
  // Gesamtzahl der Belege IM GEFILTERTEN AUSSCHNITT laut Server. Die Liste holt nur
  // eine Seite; ohne diese Zahl bliebe unsichtbar, dass es aeltere Belege gibt.
  const [invoiceTotalCount, setInvoiceTotalCount] = useState(0);
  // Aktuell angezeigte Seite und die Seitenanzahl laut Server. Ohne diese beiden
  // Werte waere die Liste auf die erste Seite gekappt und aeltere Belege nur noch
  // ueber die Filter erreichbar.
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceTotalPages, setInvoiceTotalPages] = useState(1);
  const [invoicePageLoading, setInvoicePageLoading] = useState(false);
  const receiveInvoiceList = useCallback(
    (res: InvoiceListResponse | undefined | null, page = 1) => {
      const raw = res?.invoices || [];
      const scoped = applyInvoiceScope(raw);
      setInvoices(scoped);

      const expectedScope = isCreditNoteView ? 'creditNotes' : 'invoices';
      const serverScoped = String(res?.scope || '') === expectedScope;
      // Ohne serverseitigen Filter koennen aeltere Belege fehlen, sobald die Seite
      // voll ausgeschoepft ist.
      setInvoiceScopeIncomplete(!serverScoped && raw.length >= INVOICE_PAGE_LIMIT);

      const reportedTotal = Number(res?.total ?? res?.totalCount);
      const knownTotal = serverScoped && Number.isFinite(reportedTotal) && reportedTotal >= 0;
      setInvoiceTotalCount(knownTotal ? reportedTotal : scoped.length);

      // Blaettern wird nur angeboten, wenn der Server den Belegtyp wirklich
      // gefiltert hat - sonst beschreiben total/totalPages den UNGEFILTERTEN
      // Bestand und die Seitenzahlen waeren gelogen.
      const reportedPages = Number(res?.totalPages);
      setInvoiceTotalPages(
        knownTotal && Number.isFinite(reportedPages) && reportedPages >= 1 ? reportedPages : 1
      );
      setInvoicePage(Math.max(1, page));
    },
    [applyInvoiceScope, isCreditNoteView]
  );

  // Eine Quelle fuer die Listenabfrage: Belegtyp + aktive Filter + Seite. Die
  // Seitennavigation MUSS dieselben Filter mitschicken, sonst blaettert sie durch
  // einen anderen Bestand als der, den der Bearbeiter gerade sieht.
  const buildInvoiceQueryParams = useCallback(
    (page: number): Record<string, string> => {
      const params: Record<string, string> = { ...invoiceScopeParams, page: String(Math.max(1, page)) };
      if (invoiceFilters.status !== 'all') params.status = invoiceFilters.status;
      if (invoiceFilters.dateFrom) params.dateFrom = invoiceFilters.dateFrom;
      if (invoiceFilters.dateTo) params.dateTo = invoiceFilters.dateTo;
      if (invoiceFilters.taxType === 'reverse_charge') params.isReverseCharge = 'true';
      if (invoiceFilters.taxType === 'regular') params.isReverseCharge = 'false';
      return params;
    },
    [invoiceScopeParams, invoiceFilters.status, invoiceFilters.dateFrom, invoiceFilters.dateTo, invoiceFilters.taxType]
  );

  const loadInvoicePage = useCallback(
    async (page: number) => {
      setInvoicePageLoading(true);
      try {
        const res = await getInvoices(buildInvoiceQueryParams(page));
        receiveInvoiceList(res, page);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Die Belege konnten nicht geladen werden.';
        toast({ title: t('common.error'), description: msg, variant: 'destructive' });
      } finally {
        setInvoicePageLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buildInvoiceQueryParams, receiveInvoiceList]
  );

  // Die Listen-API liefert creditNoteOf als reine ObjectId; creditNoteOfNumber ist die
  // eingefrorene Nummer der Ursprungsrechnung und deshalb die Quelle fuer die Anzeige.
  const getOriginalInvoiceNumber = useCallback((invoice: Invoice): string => {
    if (invoice.creditNoteOfNumber) return invoice.creditNoteOfNumber;
    const ref = invoice.creditNoteOf;
    if (ref && typeof ref === 'object' && ref.invoiceNumber) return ref.invoiceNumber;
    return '';
  }, []);

  const getOriginalInvoiceId = useCallback((invoice: Invoice): string => {
    const ref = invoice.creditNoteOf;
    if (!ref) return '';
    return typeof ref === 'object' ? String(ref._id || '') : String(ref);
  }, []);

  const correctionTypeLabels: Record<string, string> = {
    full_cancellation: 'Vollstorno',
    partial_refund: 'Rückzahlung',
    price_adjustment: 'Wertminderung',
  };

  const visibleInvoices = useMemo(() => {
    // Zweites Netz: selbst eine (z. B. durch einen Ansichtswechsel) veraltete Liste
    // kann so nie unter der falschen Ueberschrift landen.
    const scoped = applyInvoiceScope(invoices);
    if (!isCreditNoteView) return scoped;
    const needle = invoiceFilters.originalInvoiceNumber.trim().toLowerCase();
    return scoped.filter((inv) => {
      if (invoiceFilters.correctionType !== 'all' && inv.correctionType !== invoiceFilters.correctionType) return false;
      if (needle && !getOriginalInvoiceNumber(inv).toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [invoices, isCreditNoteView, applyInvoiceScope, invoiceFilters.correctionType, invoiceFilters.originalInvoiceNumber, getOriginalInvoiceNumber]);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const [paymentsRes, invoicesRes, reportRes, gatewaysRes, overdueRes, dunningRunsRes, systemConfigRes] = await Promise.all([
        getPayments(),
        getInvoices(invoiceScopeParams),
        getFinancialReports(),
        getPaymentGateways(),
        getOverdueInvoices(),
        getDunningRuns(),
        getSystemConfig()
      ]);

      setPayments(paymentsRes?.payments || []);
      receiveInvoiceList(invoicesRes);
      setReport(reportRes?.report || reportRes || null);
      setGateways(gatewaysRes?.gateways || []);
      setOverdueInvoices(overdueRes?.invoices || []);
      setDunningRuns(dunningRunsRes?.runs || []);
      setSystemConfig(systemConfigRes?.config || null);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('financialManagement.failedToLoadPayments');
      toast({
        title: t('common.error'),
        description: msg,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // App.tsx erzwingt beim Wechsel Rechnungen <-> Gutschriften ohnehin einen Remount.
  // Die Abhaengigkeit auf isCreditNoteView ist die zweite Absicherung: sollte der key
  // dort je entfernt werden, wird wenigstens neu geladen statt die alte Liste zu zeigen.
  useEffect(() => {
    void fetchFinancialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreditNoteView]);

  useEffect(() => {
    if (!tabFromQuery) return;
    const tabAlias: Record<string, string> = { providers: 'settings', exports: 'settings' };
    const resolvedTab = tabAlias[tabFromQuery] || tabFromQuery;
    const supportedTabs = ['overview', 'invoices', 'dunning', 'payments', 'gateways', 'reports', 'settings'];
    if (supportedTabs.includes(resolvedTab)) {
      setActiveTab(resolvedTab);
    }
  }, [tabFromQuery]);

  // In der Gutschriften-Ansicht rendert die TabsList ausschliesslich den Reiter
  // 'invoices'. Jeder andere Wert (aus ?tab=, aus einem Deep Link oder aus einem
  // Ansichtswechsel) wuerde Inhalte unter einer Leiste ohne markierten Reiter zeigen.
  useEffect(() => {
    if (isCreditNoteView && activeTab !== 'invoices') {
      setActiveTab('invoices');
    }
  }, [isCreditNoteView, activeTab]);

  useEffect(() => {
    if (handledHighlightInvoiceKey !== highlightInvoiceIdFromQuery) {
      setActiveHighlightedInvoiceId(null);
    }
  }, [highlightInvoiceIdFromQuery, handledHighlightInvoiceKey]);

  useEffect(() => {
    if (!highlightInvoiceIdFromQuery || invoices.length === 0) {
      return;
    }

    if (handledHighlightInvoiceKey === highlightInvoiceIdFromQuery) {
      return;
    }

    const targetInvoice = invoices.find((invoice) => invoice._id === highlightInvoiceIdFromQuery || invoice.invoiceNumber === highlightInvoiceIdFromQuery);
    if (!targetInvoice?._id) {
      return;
    }

    // Der Anker [data-finance-invoice-row-id] existiert NUR in der Belegliste.
    // 'overview' hatte keinen Anker und in der Gutschriften-Ansicht ausserdem
    // keinen Reiter - der Deep Link lief dort ins Leere.
    setActiveTab('invoices');
    setActiveHighlightedInvoiceId(targetInvoice._id);
    setHandledHighlightInvoiceKey(highlightInvoiceIdFromQuery);

    const scrollTimer = window.setTimeout(() => {
      const row = document.querySelector<HTMLElement>(`[data-finance-invoice-row-id="${targetInvoice._id}"]`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);

    const clearHighlightTimer = window.setTimeout(() => {
      setActiveHighlightedInvoiceId((current) => (current === targetInvoice._id ? null : current));
    }, 5500);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearHighlightTimer);
    };
  }, [highlightInvoiceIdFromQuery, invoices, handledHighlightInvoiceKey]);

  useEffect(() => {
    if (!systemConfig) return;

    setInvoiceForm((prev) => {
      const hasEdited = Boolean(
        prev.orderId ||
        prev.customerId ||
        prev.customerName ||
        prev.customerEmail ||
        prev.notes ||
        prev.items.some((item) => item.description || Number(item.quantity) !== 1 || Number(item.unitPrice) !== 0)
      );
      return hasEdited ? prev : createInvoiceFormState(financialSettings);
    });

    setFromRepairForm((prev) => {
      const hasEdited = Boolean(prev.repairOrderIds || prev.notes);
      return hasEdited ? prev : createFromRepairFormState(financialSettings);
    });
  }, [financialSettings, systemConfig]);

  const updateFinancialSetting = <Section extends keyof FinancialSettingsState, Key extends keyof FinancialSettingsState[Section]>(
    section: Section,
    key: Key,
    value: FinancialSettingsState[Section][Key]
  ) => {
    setSystemConfig((prev) => {
      if (!prev) return prev;

      const merged = mergeFinancialSettings(prev.financialSettings);

      return {
        ...prev,
        financialSettings: {
          ...merged,
          [section]: {
            ...merged[section],
            [key]: value,
          },
        },
      };
    });
  };

  const onSaveFinancialSettings = async () => {
    if (!systemConfig) return;

    setSavingFinancialSettings(true);
    try {
      const response = await updateSystemConfig(systemConfig);
      setSystemConfig(response.config || systemConfig);
      toast({ title: t('common.success'), description: t('financialManagement.paymentUpdatedSuccess') });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('financialManagement.failedToUpdatePayment');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    } finally {
      setSavingFinancialSettings(false);
    }
  };

  const onSearchCustomers = async (query: string) => {
    setCustomerQuery(query);
    if (query.trim().length < 2) {
      setCustomerResults([]);
      return;
    }

    try {
      const res = await searchCustomers(query.trim());
      setCustomerResults(res?.customers || []);
    } catch {
      setCustomerResults([]);
    }
  };

  // Ein neuer Filter beginnt immer wieder auf Seite 1.
  const onApplyInvoiceFilters = async () => {
    await loadInvoicePage(1);
  };

  const onApplyPaymentFilters = async () => {
    try {
      const params: Record<string, string> = {};
      if (paymentFilters.status !== 'all') params.status = paymentFilters.status;
      if (paymentFilters.method !== 'all') params.method = paymentFilters.method;
      if (paymentFilters.dateFrom) params.dateFrom = paymentFilters.dateFrom;
      if (paymentFilters.dateTo) params.dateTo = paymentFilters.dateTo;
      const res = await getPayments(params);
      setPayments(res?.payments || []);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('financialManagement.failedToLoadPayments');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  const onAddInvoiceLineItem = () => {
    setInvoiceForm((prev) => ({ ...prev, items: [...prev.items, emptyLineItem()] }));
  };

  const onRemoveInvoiceLineItem = (index: number) => {
    setInvoiceForm((prev) => {
      const items = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: items.length ? items : [emptyLineItem()] };
    });
  };

  const onUpdateInvoiceLineItem = (index: number, field: 'description' | 'quantity' | 'unitPrice' | 'type', value: string) => {
    setInvoiceForm((prev) => {
      const items = [...prev.items];
      const item = { ...items[index] };

      if (field === 'quantity' || field === 'unitPrice') {
        (item as unknown as Record<string, unknown>)[field] = Number(value);
      } else {
        (item as unknown as Record<string, unknown>)[field] = value;
      }

      items[index] = item;
      return { ...prev, items };
    });
  };

  // Der Druck laedt das PDF ueber /api/invoices/:id/pdf. Schlaegt das fehl, wirft
  // printInvoice einen Fehler mit deutscher Meldung - ohne diesen Wrapper
  // ('void printInvoice(...)') verschwaende der Fehler und fuer den Bearbeiter
  // passierte sichtbar gar nichts.
  const [pdfPrintingId, setPdfPrintingId] = useState<string | null>(null);

  const printInvoiceWithFeedback = async (invoice: Invoice | PrintableInvoice | null | undefined) => {
    if (!invoice?._id) return;
    setPdfPrintingId(invoice._id);
    try {
      await printInvoice(invoice);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Rechnungs-PDF konnte nicht geladen werden.';
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    } finally {
      setPdfPrintingId(null);
    }
  };

  const onCreateInvoice = async () => {
    const items = invoiceForm.items
      .filter((item) => item.description.trim().length > 0)
      .map((item, index) => ({
        _id: `draft-item-${index}`,
        ...item,
        serviceName: item.description.trim(),
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        total: Number(item.quantity || 0) * Number(item.unitPrice || 0)
      }));

    if (!invoiceForm.customerId || items.length === 0) {
      toast({ title: t('common.error'), description: t('financialManagement.failedToCreateInvoice'), variant: 'destructive' });
      return;
    }

    const isReverseCharge = Boolean(invoiceForm.isReverseCharge);
    // Die Betraege gehoeren dem Server (Invoice-Modell, brutto-first). Wir senden
    // ausschliesslich Positionen, Rabattbetrag und Steuersatz (PROZENT) - niemals
    // subtotal/tax/total, sonst gibt es zwei konkurrierende Wahrheiten.
    const itemsGross = items.reduce((sum, item) => sum + roundCurrency(item.total), 0);
    const discountAmount = roundCurrency(itemsGross * (Number(invoiceForm.discount || 0) / 100));
    const taxRate = isReverseCharge ? 0 : Number(invoiceForm.taxRate || financialSettings.defaults.taxRate);

    try {
      const response = await createInvoice({
        orderId: invoiceForm.orderId,
        customerId: invoiceForm.customerId,
        customerName: invoiceForm.customerName,
        customerEmail: invoiceForm.customerEmail,
        isReverseCharge,
        customerVatId: invoiceForm.customerVatId,
        sellerVatId: invoiceForm.sellerVatId,
        reverseChargeNotice: invoiceForm.reverseChargeNotice,
        zmRelevant: isReverseCharge,
        taxRate,
        items,
        discount: discountAmount,
        dueDate: invoiceForm.dueDate,
        notes: invoiceForm.notes,
        paymentTerms: invoiceForm.paymentTerms,
        template: 'default'
      });

      await sendInvoice(response.invoice._id, response.invoice.customerEmail);
      toast({ title: t('common.success'), description: t('financialManagement.invoiceCreatedSuccess') });
      setInvoiceDialogOpen(false);
      setInvoiceForm(createInvoiceFormState(financialSettings));
      void fetchFinancialData();
      // Nachlauf: die Rechnung IST erstellt. Ein Fehler beim Druck-PDF darf deshalb
      // nicht im catch unten als "Rechnung konnte nicht erstellt werden" landen.
      await printInvoiceWithFeedback(response.invoice);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('financialManagement.failedToCreateInvoice');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  const onCreateInvoiceFromRepairs = async () => {
    const repairOrderIds = fromRepairForm.repairOrderIds.split(',').map((id) => id.trim()).filter(Boolean);
    if (repairOrderIds.length === 0) {
      toast({ title: t('common.error'), description: t('financialManagement.failedToCreateInvoice'), variant: 'destructive' });
      return;
    }

    const isReverseCharge = Boolean(fromRepairForm.isReverseCharge);

    try {
      const response = await generateInvoiceFromRepairs(repairOrderIds, {
        isReverseCharge,
        customerVatId: fromRepairForm.customerVatId,
        sellerVatId: fromRepairForm.sellerVatId,
        reverseChargeNotice: fromRepairForm.reverseChargeNotice,
        // taxRate ist ein PROZENTWERT (19), kein Bruch.
        taxRate: isReverseCharge ? 0 : Number(fromRepairForm.taxRate),
        // Betrag in EUR, zusaetzlich zum bereits im Auftrag verrechneten Rabatt.
        discount: Math.max(0, Number(String(fromRepairForm.discount || '0').replace(',', '.')) || 0),
        dueDate: fromRepairForm.dueDate,
        paymentTerms: fromRepairForm.paymentTerms,
        notes: fromRepairForm.notes
      });

      await sendInvoice(response.invoice._id, response.invoice.customerEmail);
      toast({ title: t('common.success'), description: t('financialManagement.invoiceCreatedSuccess') });
      setFromRepairDialogOpen(false);
      void fetchFinancialData();
      // Nachlauf, siehe onCreateInvoice: der Druck darf den Erfolg nicht umdeuten.
      await printInvoiceWithFeedback(response.invoice);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('financialManagement.failedToCreateInvoice');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  const openInvoiceDetails = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setInvoiceDetailPayments([]);
    setInvoiceDetailCreditNotes([]);
    setInvoiceDetailLoading(true);
    setInvoiceDetailsDialogOpen(true);
    try {
      const result = await getInvoiceDetails(invoice._id);
      setInvoiceDetailPayments(result.payments || []);
      setInvoiceDetailCreditNotes(result.creditNotes || []);
      // Zahlungsstand aus der Detailantwort uebernehmen - dieselbe Berechnung wie die Liste.
      if (result.invoice) setSelectedInvoice({ ...(result.invoice as Invoice), balance: result.balance || invoice.balance });
    } catch {
      // silently fall back to invoice data already in state
    } finally {
      setInvoiceDetailLoading(false);
    }
  };

  // Die Detailansicht muss auch aus einer Verknuepfung heraus erreichbar sein
  // (Gutschrift -> Ursprungsrechnung und zurueck), auch wenn der Beleg nicht in der
  // aktuell geladenen Liste steht.
  const openInvoiceDetailsById = async (invoiceId: string) => {
    if (!invoiceId) return;
    const known = invoices.find((inv) => inv._id === invoiceId);
    if (known) {
      await openInvoiceDetails(known);
      return;
    }
    try {
      const result = await getInvoiceDetails(invoiceId);
      if (!result?.invoice) throw new Error('Beleg nicht gefunden');
      setSelectedInvoice({ ...(result.invoice as Invoice), balance: result.balance || undefined });
      setInvoiceDetailPayments(result.payments || []);
      setInvoiceDetailCreditNotes(result.creditNotes || []);
      setInvoiceDetailsDialogOpen(true);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Beleg konnte nicht geladen werden.';
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  type InvoiceNavigationTarget =
    | { kind: 'booking'; id: string; label: string; title: string }
    | { kind: 'order'; id: string; label: string; title: string }
    | { kind: 'repairOrder'; id: string; label: string; title: string };

  const toIdString = (value: unknown): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && '_id' in (value as Record<string, unknown>)) {
      return String((value as { _id?: unknown })._id || '');
    }
    return String(value);
  };

  /**
   * Bestimmt das Sprungziel einer Rechnungszeile.
   * Die Buchung hat Vorrang: order-basierte Rechnungen speichern BEIDE Bezuege, und
   * Sophies Anforderung ist der Sprung zur Buchung, nicht in die Auftragsliste.
   */
  const resolveInvoiceNavigationTarget = (invoice: Invoice): InvoiceNavigationTarget | null => {
    const bookingId = toIdString(invoice.bookingId) || toIdString(invoice.resolvedBookingId);
    if (bookingId) {
      return { kind: 'booking', id: bookingId, label: t('financialManagement.booking'), title: 'Zur verknüpften Buchung' };
    }

    const orderId = toIdString(invoice.orderId);
    if (orderId) {
      return { kind: 'order', id: orderId, label: t('financialManagement.order'), title: 'Zum verknüpften Auftrag' };
    }

    const repairOrderId = toIdString((invoice.repairOrderIds || [])[0]);
    if (repairOrderId) {
      const count = (invoice.repairOrderIds || []).length;
      return {
        kind: 'repairOrder',
        id: repairOrderId,
        label: `${count} ${count > 1 ? t('financialManagement.ordersPlural') : t('financialManagement.orders')}`,
        title: (invoice.repairOrderIds || [])
          .map((r) => (typeof r === 'object' ? ((r as { orderNumber?: string }).orderNumber || toIdString(r)) : String(r)))
          .join(', '),
      };
    }

    return null;
  };

  const openInvoiceNavigationTarget = (target: InvoiceNavigationTarget) => {
    if (target.kind === 'booking') {
      // Das Ziel steht AUSSCHLIESSLICH in der URL, damit ein harter Reload und ein
      // kopierter Link dieselbe Buchung oeffnen. Den History-State
      // (`reopenBookingDialog`), den die Auftragsliste auswertet, setzt die
      // BookingDeepLinkBridge in App.tsx aus `?openBookingId=` nach - sowohl bei
      // der In-App-Navigation als auch beim direkten Aufruf der URL. Wuerde er hier
      // zusaetzlich mitgegeben, liefe die Buchung bei jeder In-App-Navigation
      // doppelt durch getBooking().
      navigate(`/admin/bookings?openBookingId=${encodeURIComponent(target.id)}&highlightBookingId=${encodeURIComponent(target.id)}`);
      return;
    }
    navigate(getOrderDetailsPath(target.id), {
      state: buildOrderDetailsState(location, { label: t('common.back') }),
    });
  };

  const openSendComposer = (invoice: Invoice, mode: SendComposerMode = 'invoice') => {
    const defaultOpenAmount = getInvoiceOpenAmount(invoice);
    const defaultSubject =
      mode === 'reminder'
        ? `Zahlungserinnerung zu Rechnung ${invoice.invoiceNumber}`
        : `Rechnung ${invoice.invoiceNumber}`;

    setSelectedInvoice(invoice);
    setSendComposerMode(mode);
    setSendComposerForm({
      recipientEmail: invoice.customerEmail || '',
      ccEmail: '',
      subject: defaultSubject,
      greeting: 'Guten Tag,',
      introText:
        mode === 'reminder'
          ? `dies ist eine freundliche Erinnerung zu Ihrer offenen Rechnung ueber ${formatCurrency(defaultOpenAmount)}.`
          : 'anbei erhalten Sie Ihre Rechnung.',
      paymentInstructions: 'Bitte begleichen Sie den offenen Betrag fristgerecht unter Angabe der Rechnungsnummer.',
      closingText: financialSettings.invoiceMetadata.invoiceFooter,
      legalFooter: financialSettings.invoiceMetadata.legalFooter,
      includeItems: true,
      includeTaxBreakdown: financialSettings.paymentPreferences.showTaxBreakdown,
      includeDiscountBreakdown: financialSettings.paymentPreferences.showDiscountBreakdown,
      includePaymentTerms: true,
      allowPartialPayment: mode === 'reminder' && financialSettings.paymentPreferences.partialPaymentsAllowed,
      applyLateFee: mode === 'reminder',
      lateFeePercent: String(financialSettings.discountPolicy.lateFeePercent),
      attachPdf: financialSettings.paymentPreferences.autoAttachPdf,
      sendCopyInternal: financialSettings.paymentPreferences.sendInternalCopy,
      internalCopyEmail: financialSettings.paymentPreferences.internalCopyEmail,
      customMessage: '',
      previewFormat: 'html',
      visualTheme: financialSettings.paymentPreferences.defaultVisualTheme,
      accentColor: financialSettings.paymentPreferences.accentColor,
      fontScale: 'md',
      compactSpacing: false,
      emphasizeTotals: true,
      showHeaderBanner: true,
      detailLevel: 'detailed'
    });
    setSendComposerOpen(true);
  };

  const onSendInvoice = async (invoiceId: string, email?: string, message?: string) => {
    try {
      await sendInvoice(invoiceId, email, message);
      toast({ title: t('common.success'), description: t('financialManagement.paymentUpdatedSuccess') });
      void fetchFinancialData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('financialManagement.failedToUpdatePayment');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  const onSubmitSendComposer = async () => {
    if (!selectedInvoice) return;
    if (!sendComposerForm.recipientEmail.trim()) {
      toast({ title: t('common.error'), description: 'Bitte eine Empfänger-E-Mail-Adresse angeben.', variant: 'destructive' });
      return;
    }

    // An den Kunden geht NUR der frei formulierte Text ({{customMessage}} der Vorlage).
    // Vorschau und interne Versandhinweise sind Arbeitshilfen im Dialog und gehören nicht
    // in die E-Mail (früher wurde ohne eigenen Text die gesamte Vorschau samt interner
    // Konfiguration als "persönliche Nachricht" mitgesendet).
    const message = sendComposerForm.customMessage.trim();

    if (sendComposerMode === 'reminder') {
      // Mahnung: derselbe serverseitige Mahnschritt wie Mahnlauf und Cron - nur ein
      // fälliger Beleg geht genau eine Stufe weiter; ein E-Mail-Fehler erhöht die Stufe nicht.
      const invoiceId = selectedInvoice._id;
      try {
        const res = await runDunningStep(invoiceId, message || undefined, sendComposerForm.recipientEmail.trim());
        onMarkDunningReminderSent(invoiceId, res?.message || res?.result?.message || 'Mahnschritt versendet');
        setSendComposerOpen(false);
        void fetchFinancialData();
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Der Mahnschritt konnte nicht ausgeführt werden.';
        setDunningQueueItem(invoiceId, { status: 'failed', note: msg });
        void syncDunningItemUpdate(invoiceId, { status: 'failed', note: msg, logMessage: msg });
        toast({ title: t('common.error'), description: msg, variant: 'destructive' });
      }
      return;
    }

    await onSendInvoice(selectedInvoice._id, sendComposerForm.recipientEmail.trim(), message);
    setSendComposerOpen(false);
  };

  const [confirmPaidCancellation, setConfirmPaidCancellation] = useState(false);

  const onChangeStatus = async () => {
    if (!selectedInvoice) return;

    // "Storniert": ausgestellter Beleg -> Storno mit Storno-Gutschrift; Entwurf -> verwerfen.
    // Beides braucht einen Grund; gebuchtes Geld bleibt als Guthaben erhalten.
    if (statusForm.status === 'cancelled' && selectedInvoice.status !== 'cancelled') {
      const reason = statusForm.notes.trim();
      if (!reason) {
        toast({ title: t('common.error'), description: 'Bitte im Feld „Notiz“ den Grund für das Storno angeben.', variant: 'destructive' });
        return;
      }
      const isDraft = ['draft', 'pending_approval'].includes(selectedInvoice.status);
      try {
        if (isDraft) {
          await discardDraftInvoice(selectedInvoice._id, reason);
          toast({ title: t('common.success'), description: 'Der Entwurf wurde verworfen.' });
        } else {
          const res = await cancelInvoice(selectedInvoice._id, { reason, confirmPaidCancellation });
          toast({
            title: t('common.success'),
            description: res?.alreadyCancelled
              ? 'Diese Rechnung war bereits storniert.'
              : `Rechnung storniert. Storno-Gutschrift ${res?.creditNote?.invoiceNumber || ''} wurde ausgestellt${Number(res?.allocatedAtCancellation || 0) > 0.009 ? `; ${formatCurrency(Number(res?.allocatedAtCancellation || 0))} bleiben als Guthaben/offene Erstattung erhalten` : ''}.`,
          });
        }
        setStatusDialogOpen(false);
        setSelectedInvoice(null);
        setConfirmPaidCancellation(false);
        void fetchFinancialData();
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Die Rechnung konnte nicht storniert werden.';
        toast({ title: t('common.error'), description: msg, variant: 'destructive' });
      }
      return;
    }

    if (statusForm.status === 'paid') {
      if (!statusForm.paymentMethod) {
        toast({ title: t('common.error'), description: 'Bitte eine Zahlungsart auswaehlen.', variant: 'destructive' });
        return;
      }

      if (!statusForm.paidAt) {
        toast({ title: t('common.error'), description: 'Bitte einen Zahlungszeitpunkt angeben.', variant: 'destructive' });
        return;
      }
    }

    try {
      await changeInvoiceStatus(selectedInvoice._id, statusForm.status, {
        notes: statusForm.notes,
        paymentMethod: statusForm.paymentMethod || undefined,
        paidAt: statusForm.paidAt || undefined,
      });
      toast({ title: t('common.success'), description: t('financialManagement.paymentUpdatedSuccess') });
      setStatusDialogOpen(false);
      setSelectedInvoice(null);
      void fetchFinancialData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('financialManagement.failedToUpdatePayment');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  const openPaymentDialog = (invoice: Invoice, presetAmount?: number) => {
    if (!canRecordPayment(invoice)) {
      const remaining = getInvoiceOpenAmount(invoice);
      const reason = invoice.isCreditNote
        ? 'Für Gutschriften können keine Teilzahlungen erfasst werden.'
        : remaining <= 0
          ? 'Diese Rechnung ist bereits vollständig bezahlt.'
          : `Für Rechnungsstatus "${getInvoiceStatusLabel(invoice.status, t)}" kann keine Zahlung erfasst werden.`;
      toast({ title: t('common.error'), description: reason, variant: 'destructive' });
      return;
    }

    const remaining = getInvoiceOpenAmount(invoice);
    if (remaining <= 0) {
      toast({ title: t('common.error'), description: t('financialManagement.failedToUpdatePayment'), variant: 'destructive' });
      return;
    }

    const initialAmount = Math.max(0, Math.min(Number(presetAmount ?? remaining), remaining));

    setSelectedInvoice(invoice);
    setPaymentForm(
      createPaymentFormState(
        financialSettings,
        String(initialAmount || ''),
        initialAmount >= remaining && remaining > 0 ? 'full' : 'partial'
      )
    );
    setPaymentDialogOpen(true);
  };

  const onAddPayment = async () => {
    if (!selectedInvoice) return;

    const amount = Number(paymentForm.amount || 0);
    if (amount <= 0) {
      toast({ title: t('common.error'), description: t('financialManagement.failedToUpdatePayment'), variant: 'destructive' });
      return;
    }

    const remaining = getInvoiceOpenAmount(selectedInvoice);
    if (amount > remaining + 0.01) {
      toast({ title: t('common.error'), description: t('financialManagement.failedToUpdatePayment'), variant: 'destructive' });
      return;
    }

    const metadata: Record<string, unknown> = {
      scope: paymentForm.scope,
      reference: paymentForm.reference.trim() || undefined,
      internalNote: paymentForm.internalNote.trim() || undefined,
      paymentDate: paymentForm.paymentDate || undefined,
      notifyCustomer: paymentForm.notifyCustomer,
      source: 'admin-financial-management',
    };

    const gatewayResponseLines = [
      paymentForm.gatewayResponse.trim(),
      paymentForm.reference.trim() ? `Reference: ${paymentForm.reference.trim()}` : '',
      paymentForm.internalNote.trim() ? `Note: ${paymentForm.internalNote.trim()}` : '',
      paymentForm.notifyCustomer ? 'NotifyCustomer: true' : '',
      paymentForm.paymentDate ? `PaymentDate: ${paymentForm.paymentDate}` : '',
    ].filter(Boolean);

    try {
      await addInvoicePayment(selectedInvoice._id, {
        amount,
        currency: paymentForm.currency,
        paymentMethod: paymentForm.paymentMethod,
        gatewayResponse: gatewayResponseLines.join('\n'),
        metadata,
      });

      toast({ title: t('common.success'), description: t('financialManagement.paymentUpdatedSuccess') });
      setPaymentDialogOpen(false);
      setSelectedInvoice(null);
      setPaymentForm(createPaymentFormState(financialSettings));
      void fetchFinancialData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('financialManagement.failedToUpdatePayment');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  const openCreditDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setCreditForm(createCreditFormState(financialSettings, invoice));
    setCreditItemOverrides(
      (invoice.items || []).map(() => ({ included: true, quantity: '', unitPrice: '' }))
    );
    setCreditDialogOpen(true);
  };

  const openStatusDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setConfirmPaidCancellation(false);
    setStatusForm({
      status: invoice.status,
      notes: '',
      paymentMethod: invoice.paymentMethod || '',
      paidAt: toDateTimeLocalValue(invoice.paidAt),
    });
    setStatusDialogOpen(true);
  };

  const openRefundDialogFromDetails = () => {
    const refundable = invoiceDetailPayments.find((payment) => payment.status === 'completed');
    if (!refundable) return;

    setSelectedPayment(refundable);
    setRefundForm({
      amount: String(refundable.amount),
      reason: '',
      reasonCategory: '',
      internalNote: '',
      mode: (['paypal', 'stripe'].includes(refundable.paymentMethod) ? 'gateway' : 'manual') as 'gateway' | 'manual',
      gatewayProvider: (['paypal', 'stripe'].includes(refundable.paymentMethod) ? refundable.paymentMethod : '') as PaymentGateway['provider'],
      gatewayReference: '',
      notifyCustomer: false,
    });
    setInvoiceDetailsDialogOpen(false);
    setRefundDialogOpen(true);
  };

  const [pdfDownloadingId, setPdfDownloadingId] = useState<string | null>(null);

  const onDownloadInvoicePdf = async (invoice: Invoice) => {
    if (!invoice?._id) return;
    setPdfDownloadingId(invoice._id);
    try {
      await downloadInvoicePdf(invoice._id, invoice.invoiceNumber);
      toast({ title: t('common.success'), description: 'PDF wurde heruntergeladen.' });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Rechnungs-PDF konnte nicht geladen werden.';
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    } finally {
      setPdfDownloadingId(null);
    }
  };

  // Betraege werden IMMER aus dem gespeicherten Beleg gelesen, nie neu gerechnet.
  // invoiceNetTotal/invoiceTaxTotal/invoiceGrossTotal sind die Spiegelfelder des
  // Invoice-Modells; subtotal/tax/total sind der aeltere Name derselben Werte.
  const getStoredNet = (invoice: Pick<Invoice, 'invoiceNetTotal' | 'subtotal'>) =>
    Number(invoice.invoiceNetTotal ?? invoice.subtotal ?? 0);
  const getStoredTax = (invoice: Pick<Invoice, 'invoiceTaxTotal' | 'tax'>) =>
    Number(invoice.invoiceTaxTotal ?? invoice.tax ?? 0);
  const getStoredGross = (invoice: Pick<Invoice, 'invoiceGrossTotal' | 'total'>) =>
    Number(invoice.invoiceGrossTotal ?? invoice.total ?? 0);

  const renderInvoiceActionsMenu = ({
    invoice,
    includeDetails = true,
    inDetailsDialog = false,
  }: {
    invoice: Invoice;
    includeDetails?: boolean;
    inDetailsDialog?: boolean;
  }) => {
    const paymentAllowed = canRecordPayment(invoice);
    const creditAllowed = inDetailsDialog
      ? ['paid', 'cancelled', 'credited'].includes(invoice.status) && !invoice.isCreditNote && invoiceDetailCreditNotes.length === 0
      : !invoice.isCreditNote;
    const refundAllowed = inDetailsDialog && invoiceDetailPayments.some((payment) => payment.status === 'completed');

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="min-w-[110px]">
            {t('financialManagement.actions')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {includeDetails && (
            <DropdownMenuItem onClick={() => openInvoiceDetails(invoice)}>
              <Eye className="mr-2 h-4 w-4" />{t('common.details', 'Details')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            disabled={pdfDownloadingId === invoice._id}
            onClick={() => { void onDownloadInvoicePdf(invoice); }}
          >
            <Download className="mr-2 h-4 w-4" />
            {pdfDownloadingId === invoice._id ? 'PDF wird geladen…' : 'PDF herunterladen'}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={pdfPrintingId === invoice._id}
            onClick={() => { void printInvoiceWithFeedback(invoice); }}
          >
            <Printer className="mr-2 h-4 w-4" />
            {pdfPrintingId === invoice._id ? 'PDF wird geladen…' : 'PDF drucken'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              if (inDetailsDialog) setInvoiceDetailsDialogOpen(false);
              openSendComposer(invoice, 'invoice');
            }}
          >
            <Send className="mr-2 h-4 w-4" />{t('financialManagement.send')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              if (inDetailsDialog) setInvoiceDetailsDialogOpen(false);
              openStatusDialog(invoice);
            }}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />{t('financialManagement.changeStatus')}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            disabled={!paymentAllowed}
            onClick={() => {
              if (inDetailsDialog) setInvoiceDetailsDialogOpen(false);
              openPaymentDialog(invoice);
            }}
          >
            <Banknote className="mr-2 h-4 w-4" />{t('financialManagement.partialPayment')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              if (inDetailsDialog) setInvoiceDetailsDialogOpen(false);
              toggleInvoiceExpanded(invoice._id);
            }}
          >
            <Wallet className="mr-2 h-4 w-4" />
            {expandedInvoiceIds.has(invoice._id) ? t('financialManagement.collapseProcesses') : t('financialManagement.showProcesses')}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!creditAllowed}
            onClick={() => {
              if (inDetailsDialog) setInvoiceDetailsDialogOpen(false);
              openCreditDialog(invoice);
            }}
          >
            {t('financialManagement.createCreditNote')}
          </DropdownMenuItem>
          {inDetailsDialog && (
            <DropdownMenuItem disabled={!refundAllowed} onClick={openRefundDialogFromDetails}>
              <Wallet className="mr-2 h-4 w-4" />{t('financialManagement.refund')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const onCreateCredit = async () => {
    if (!selectedInvoice) return;
    const preview = creditPreview;
    if (!preview) return;
    if (creditForm.scope === 'partial' && preview.items.length === 0) {
      toast({ title: t('common.error'), description: t('financialManagement.failedToCreateInvoice'), variant: 'destructive' });
      return;
    }

    try {
      await createCreditNote(selectedInvoice._id, {
        reason: creditForm.reason,
        // PROZENT (19), niemals ein Bruch - der Server erwartet denselben Wert,
        // den die Vorschau oben anzeigt.
        taxRate: selectedInvoice.isReverseCharge ? 0 : Number(creditForm.taxRate),
        discount: Math.abs(Number(creditForm.discount) || 0),
        dueDate: creditForm.dueDate,
        // Bewusst KEIN notifyCustomer: POST /invoices/:id/credit-note verschickt
        // nichts. Ein Schalter, der nur so tut, waere schlimmer als keiner - der
        // Dialog weist stattdessen auf den manuellen Versand hin.
        items: creditForm.scope === 'partial'
          ? preview.items.map((i) => ({
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              total: i.total,
              type: i.type as InvoiceItem['type'],
            }))
          : undefined,
      });

      toast({ title: t('common.success'), description: t('financialManagement.invoiceCreatedSuccess') });
      setCreditDialogOpen(false);
      setSelectedInvoice(null);
      setCreditForm(createCreditFormState(financialSettings));
      setCreditItemOverrides([]);
      void fetchFinancialData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('financialManagement.failedToCreateInvoice');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  // Ein Schluessel je geoeffnetem Erstattungsdialog: Doppelklick/Retry bucht nichts doppelt.
  const refundIdempotencyKeyRef = useRef<string>('');

  const onRefund = async () => {
    if (!selectedPayment) return;

    const amount = Number(refundForm.amount || 0);
    if (amount <= 0) {
      toast({ title: t('common.error'), description: t('financialManagement.failedToIssueRefund'), variant: 'destructive' });
      return;
    }
    if (!refundForm.reason.trim() && !refundForm.reasonCategory) {
      toast({ title: t('common.error'), description: t('financialManagement.failedToIssueRefund'), variant: 'destructive' });
      return;
    }

    if (refundForm.mode === 'gateway' && !refundForm.gatewayProvider) {
      toast({ title: t('common.error'), description: t('financialManagement.failedToIssueRefund'), variant: 'destructive' });
      return;
    }

    const combinedReason = [
      refundForm.reasonCategory,
      refundForm.reason.trim(),
      refundForm.internalNote.trim() ? `[Intern: ${refundForm.internalNote.trim()}]` : ''
    ].filter(Boolean).join(' – ');

    try {
      const response = await processRefund(selectedPayment._id, amount, combinedReason, {
        mode: refundForm.mode,
        gatewayProvider: refundForm.mode === 'gateway' ? (refundForm.gatewayProvider as PaymentGateway['provider']) : undefined,
        gatewayReference: refundForm.gatewayReference.trim() || undefined,
        idempotencyKey: refundIdempotencyKeyRef.current || undefined,
      });
      // Eine ausstehende Anbieter-Erstattung ist KEIN Erfolg im Sinne von "Geld zurueck".
      const refundStatus = response?.refund?.status;
      toast({
        title: response?.refund?.indeterminate
          ? 'Erstattung ungeklärt – Abgleich nötig'
          : (refundStatus === 'pending' ? 'Erstattung ausstehend' : t('common.success')),
        description: [response?.message || t('financialManagement.refundIssuedSuccess'), response?.warning].filter(Boolean).join(' '),
      });
      setRefundDialogOpen(false);
      setSelectedPayment(null);
      setRefundForm({ amount: '', reason: '', reasonCategory: '', internalNote: '', mode: 'gateway', gatewayProvider: '', gatewayReference: '', notifyCustomer: false });
      void fetchFinancialData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('financialManagement.failedToIssueRefund');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  const openReconcileDialog = (payment: Partial<Payment>, entry: NonNullable<Payment['refunds']>[number]) => {
    setReconcileTarget({ payment, entry });
    setReconcileRefundId('');
  };

  const onSubmitReconcile = async (resolution: 'executed' | 'not-executed') => {
    if (!reconcileTarget?.payment?._id || !reconcileTarget.entry?._id) return;
    if (resolution === 'executed' && !reconcileRefundId.trim()) {
      toast({ title: t('common.error'), description: 'Bitte die Erstattungs-ID aus dem PayPal-Konto angeben.', variant: 'destructive' });
      return;
    }
    setReconcileSubmitting(true);
    try {
      await reconcileRefund(String(reconcileTarget.payment._id), String(reconcileTarget.entry._id), {
        resolution,
        ...(resolution === 'executed' ? { providerRefundId: reconcileRefundId.trim() } : {}),
      });
      toast({
        title: t('common.success'),
        description: resolution === 'executed'
          ? 'Die Erstattung wurde als bei PayPal ausgeführt verbucht.'
          : 'Der Erstattungsversuch wurde als nicht ausgeführt markiert; der Betrag ist wieder frei.',
      });
      setReconcileTarget(null);
      void fetchFinancialData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Der Abgleich der Erstattung ist fehlgeschlagen.';
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    } finally {
      setReconcileSubmitting(false);
    }
  };

  // Vom Bearbeiter gestarteter Mahnlauf: dieselbe Serverlogik wie der automatische Lauf
  // (nur fällige Belege, je eine Stufe, keine doppelte Mail am selben Tag).
  const onRunDunning = async () => {
    try {
      const res = await runDunningJob();
      const sent = Number(res?.sent || 0);
      const failed = Number(res?.failed || 0);
      const skipped = Number(res?.skipped || 0);
      toast({
        title: failed > 0 ? t('common.error') : t('common.success'),
        description: sent + failed + skipped === 0
          ? 'Mahnlauf ausgeführt: aktuell ist kein Beleg für den nächsten Mahnschritt fällig.'
          : `Mahnlauf ausgeführt: ${sent} versendet, ${failed} fehlgeschlagen, ${skipped} übersprungen.`,
        ...(failed > 0 ? { variant: 'destructive' as const } : {}),
      });
      void fetchFinancialData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Der Mahnlauf konnte nicht ausgeführt werden.';
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  const onActivateCollection = async (invoiceId: string) => {
    try {
      await activateCollection(invoiceId);
      toast({ title: t('common.success'), description: 'Inkasso wurde manuell aktiviert.' });
      void fetchFinancialData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Inkasso konnte nicht aktiviert werden.';
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  const getInvoiceById = (invoiceId: string) => invoices.find((i) => i._id === invoiceId) || dunningEligibleInvoices.find((i) => i._id === invoiceId) || null;

  const paymentsByInvoiceId = useMemo(() => {
    const map = new Map<string, Payment[]>();

    // 1. Map by direct invoiceId
    payments.forEach((payment) => {
      let invId: unknown = payment.invoiceId;
      if (typeof invId === 'object' && invId !== null) {
        invId = (invId as { _id?: string; id?: string })._id || (invId as { _id?: string; id?: string }).id;
      }
      const key = invId ? String(invId) : '';
      if (key) {
        const bucket = map.get(key) || [];
        bucket.push(payment);
        map.set(key, bucket);
      }
    });

    // 2. Also match by orderId, bookingId, or orderNumber if not directly linked
    invoices.forEach((invoice) => {
      const invId = String(invoice._id);
      const existing = map.get(invId) || [];
      const existingIds = new Set(existing.map((p) => String(p._id)));

      const invOrderId = typeof invoice.orderId === 'object' && invoice.orderId !== null
        ? String((invoice.orderId as { _id?: string })._id || '')
        : invoice.orderId ? String(invoice.orderId) : '';

      const invBookingId = invoice.bookingId ? String(invoice.bookingId) : '';
      const invNumber = invoice.invoiceNumber ? String(invoice.invoiceNumber) : '';

      payments.forEach((payment) => {
        if (existingIds.has(String(payment._id))) return;

        const pmtOrderId = typeof payment.orderId === 'object' && payment.orderId !== null
          ? String((payment.orderId as { _id?: string })._id || '')
          : payment.orderId ? String(payment.orderId) : '';

        const pmtBookingId = (payment as unknown as Record<string, unknown>).bookingId
          ? String((payment as unknown as Record<string, unknown>).bookingId)
          : '';

        const pmtOrderNumber = payment.orderNumber ? String(payment.orderNumber) : '';

        const isMatch =
          Boolean(invOrderId && pmtOrderId && invOrderId === pmtOrderId) ||
          Boolean(invBookingId && pmtBookingId && invBookingId === pmtBookingId) ||
          Boolean(invNumber && pmtOrderNumber && invNumber === pmtOrderNumber);

        if (isMatch) {
          existing.push(payment);
          existingIds.add(String(payment._id));
        }
      });

      if (existing.length > 0) {
        map.set(invId, existing);
      }
    });

    return map;
  }, [payments, invoices]);

  const toggleInvoiceExpanded = (invoiceId: string) => {
    setExpandedInvoiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

  const openRefundForPayment = (payment: Payment) => {
    // Eine echte Anbieter-Erstattung ist derzeit nur fuer PayPal angebunden. Alle
    // anderen Zahlarten werden ausserhalb zurueckgezahlt und hier manuell erfasst.
    const defaultProvider = payment.paymentMethod === 'paypal' ? 'paypal' : '';
    // Vorschlag: bevorzugt der nicht zugeordnete Rest (Ueberzahlung), sonst der noch
    // erstattbare Betrag - nie mehr als nach bisherigen Erstattungen uebrig ist.
    const refundable = Math.max(0, getPaymentEffectiveAmount(payment) - Math.max(0, Number(payment.refundsInProgress || 0)));
    const suggested = Number(payment.unallocatedAmount || 0) > 0.009 ? Number(payment.unallocatedAmount) : refundable;

    refundIdempotencyKeyRef.current = `refund-${payment._id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSelectedPayment(payment);
    setRefundForm({
      amount: suggested.toFixed(2),
      reason: '',
      reasonCategory: '',
      internalNote: '',
      mode: defaultProvider ? 'gateway' : 'manual',
      gatewayProvider: defaultProvider,
      gatewayReference: '',
      notifyCustomer: false,
    });
    setRefundDialogOpen(true);
  };

  const hydrateQueueFromRun = (run?: DunningRun | null) => {
    if (!run) {
      setDunningQueue([]);
      return;
    }

    setDunningQueue(
      (run.items || []).map((item) => ({
        invoiceId: String(item.invoiceId),
        invoiceNumber: item.invoiceNumber,
        customerName: item.customerName,
        amountOpen: Number(item.amountOpen || 0),
        status: item.status,
        note: item.note || ''
      }))
    );
  };

  const onLoadDunningRun = async (runId: string) => {
    if (!runId) return;
    try {
      const res = await getDunningRunById(runId);
      const run = res?.run as DunningRun;
      setSelectedDunningRunId(runId);
      setDunningRunName(run?.name || dunningRunName);
      setDunningDefaultStatus((run?.defaultStatus as InvoiceStatus) || 'overdue');
      setDunningDefaultNote(run?.defaultNote || '');
      setDunningPaused(run?.status === 'paused');
      hydrateQueueFromRun(run);
      setDunningRuns((prev) => [run, ...prev.filter((entry) => entry._id !== run._id)]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('financialManagement.failedToLoadPayments');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  const ensureActiveDunningRun = async (extraInvoiceIds: string[] = []) => {
    if (selectedDunningRunId) return selectedDunningRunId;

    const combinedIds = Array.from(new Set([
      ...dunningQueue.map((item) => String(item.invoiceId)),
      ...extraInvoiceIds.map((id) => String(id))
    ])).filter(Boolean);

    if (combinedIds.length === 0) return '';

    const res = await createDunningRun({
      name: dunningRunName || `Mahnlauf ${new Date().toLocaleDateString('de-DE')}`,
      defaultStatus: dunningDefaultStatus,
      defaultNote: dunningDefaultNote,
      invoiceIds: combinedIds,
      status: 'running'
    });

    const run = res?.run as DunningRun;
    setSelectedDunningRunId(run?._id || '');
    hydrateQueueFromRun(run);
    setDunningRuns((prev) => [run, ...prev.filter((item) => item._id !== run._id)]);
    return run?._id || '';
  };

  const syncDunningItemUpdate = async (
    invoiceId: string,
    updates: Partial<{ status: DunningQueueItem['status']; note: string; amountOpen: number; logMessage: string }>
  ) => {
    const runId = await ensureActiveDunningRun([invoiceId]);
    if (!runId) return;
    try {
      const res = await updateDunningRunItem(runId, invoiceId, updates);
      const run = res?.run as DunningRun;
      hydrateQueueFromRun(run);
      setDunningRuns((prev) => [run, ...prev.filter((r) => r._id !== run._id)]);
    } catch (error) {
      console.error('Failed to sync dunning item update:', error);
    }
  };

  const toggleDunningSelection = (invoiceId: string) => {
    setDunningSelection((prev) => (prev.includes(invoiceId) ? prev.filter((id) => id !== invoiceId) : [...prev, invoiceId]));
  };

  const onSelectAllOverdue = () => {
    setDunningSelection(dunningEligibleInvoices.map((invoice) => invoice._id));
  };

  const onClearDunningSelection = () => {
    setDunningSelection([]);
  };

  const onCreateManualDunningRun = async () => {
    if (dunningSelection.length === 0) {
      toast({ title: t('common.error'), description: t('financialManagement.failedToUpdatePayment') });
      return;
    }

    const queue = dunningEligibleInvoices
      .filter((invoice) => dunningSelection.includes(invoice._id))
      .map((invoice) => ({
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        amountOpen: getInvoiceOpenAmount(invoice),
        status: 'pending' as const,
        note: ''
      }));

    if (queue.length === 0) {
      toast({ title: t('common.error'), description: t('financialManagement.failedToUpdatePayment') });
      return;
    }

    try {
      const res = await createDunningRun({
        name: dunningRunName,
        defaultStatus: dunningDefaultStatus,
        defaultNote: dunningDefaultNote,
        invoiceIds: queue.map((entry) => entry.invoiceId),
        status: 'draft'
      });

      const run = res?.run as DunningRun;
      setSelectedDunningRunId(run?._id || '');
      setDunningPaused(false);
      hydrateQueueFromRun(run);
      setDunningRuns((prev) => [run, ...prev.filter((item) => item._id !== run._id)]);
      toast({ title: t('common.success'), description: t('financialManagement.paymentUpdatedSuccess') });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('financialManagement.failedToUpdatePayment');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  const setDunningQueueItem = (invoiceId: string, patch: Partial<DunningQueueItem>) => {
    setDunningQueue((prev) => prev.map((item) => (item.invoiceId === invoiceId ? { ...item, ...patch } : item)));
  };

  const onDunningSendReminder = async (invoiceId: string) => {
    const invoice = getInvoiceById(invoiceId);
    if (!invoice) {
      toast({ title: t('common.error'), description: t('financialManagement.failedToLoadPayments'), variant: 'destructive' });
      return;
    }

    openSendComposer(invoice, 'reminder');

    setDunningQueueItem(invoiceId, { status: 'processing', note: 'Versanddialog geoeffnet...' });
    void syncDunningItemUpdate(invoiceId, { status: 'processing', note: 'Versanddialog geoeffnet...', logMessage: 'Versanddialog geoeffnet' });
  };

  const onMarkDunningReminderSent = (invoiceId: string, note: string) => {
    setDunningQueueItem(invoiceId, { status: 'sent', note });
    void syncDunningItemUpdate(invoiceId, { status: 'sent', note, logMessage: note });
    toast({ title: t('common.success'), description: note });
  };

  // Manueller Eingriff (Detailansicht): Belegstatus ändern, mit Notiz. "Storniert" läuft
  // serverseitig über das Storno (Storno-Gutschrift; die Notiz ist der Storno-Grund).
  const onDunningCaseStatusChange = async (invoiceId: string, status: InvoiceStatus, note: string) => {
    try {
      await changeInvoiceStatus(invoiceId, status, { notes: note || undefined });
      setDunningQueueItem(invoiceId, { status: 'escalated', note: `Status auf ${getInvoiceStatusLabel(status, t)} gesetzt` });
      void syncDunningItemUpdate(invoiceId, { status: 'escalated', note: `Status auf ${getInvoiceStatusLabel(status, t)} gesetzt`, logMessage: `Status manuell auf ${getInvoiceStatusLabel(status, t)} gesetzt` });
      toast({ title: t('common.success'), description: `Status auf ${getInvoiceStatusLabel(status, t)} gesetzt.` });
      void fetchFinancialData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Der Status konnte nicht geändert werden.';
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  // "Eskalieren" = nächster Mahnschritt über den Server (keine reine Statusänderung mehr).
  const onDunningEscalateInvoice = async (invoiceId: string) => {
    try {
      setDunningQueueItem(invoiceId, { status: 'processing', note: 'Mahnschritt wird ausgeführt …' });
      const res = await runDunningStep(invoiceId);
      onMarkDunningReminderSent(invoiceId, res?.message || res?.result?.message || 'Mahnschritt versendet');
      void fetchFinancialData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Der Mahnschritt konnte nicht ausgeführt werden.';
      setDunningQueueItem(invoiceId, { status: 'failed', note: msg });
      void syncDunningItemUpdate(invoiceId, { status: 'failed', note: msg, logMessage: msg });
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  const onDunningSkipItem = (invoiceId: string) => {
    setDunningQueueItem(invoiceId, { status: 'skipped', note: 'Manuell uebersprungen' });
    void syncDunningItemUpdate(invoiceId, { status: 'skipped', note: 'Manuell uebersprungen', logMessage: 'Fall uebersprungen' });
  };

  const onDunningRemoveItem = (invoiceId: string) => {
    setDunningQueue((prev) => prev.filter((item) => item.invoiceId !== invoiceId));
    void syncDunningItemUpdate(invoiceId, { status: 'skipped', note: 'Aus Lauf entfernt', logMessage: 'Fall aus Lauf entfernt' });
  };

  const onAddInvoiceToDunningQueue = async (invoice: Invoice) => {
    setDunningQueue((prev) => {
      if (prev.some((item) => item.invoiceId === invoice._id)) return prev;
      return [
        ...prev,
        {
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customerName,
          amountOpen: getInvoiceOpenAmount(invoice),
          status: 'pending',
          note: 'Manuell hinzugefuegt'
        }
      ];
    });

    const runId = await ensureActiveDunningRun([String(invoice._id)]);
    if (!runId) return;

    try {
      const res = await addDunningRunItem(runId, String(invoice._id));
      const run = res?.run as DunningRun;
      hydrateQueueFromRun(run);
      setDunningRuns((prev) => [run, ...prev.filter((entry) => entry._id !== run._id)]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('financialManagement.failedToUpdatePayment');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  // Gespeicherten Mahnlauf ausführen: der Server verarbeitet jeden Fall über dieselbe
  // Mahnlogik wie der automatische Lauf (nicht fällige Fälle werden mit Grund übersprungen).
  const onExecuteDunningQueue = async () => {
    if (dunningQueue.length === 0) {
      toast({ title: t('common.error'), description: 'Der Mahnlauf enthält keine Fälle.', variant: 'destructive' });
      return;
    }
    if (dunningPaused) {
      toast({ title: t('common.error'), description: 'Der Mahnlauf ist pausiert. Bitte zuerst fortsetzen.', variant: 'destructive' });
      return;
    }

    setDunningExecuting(true);
    try {
      const runId = await ensureActiveDunningRun();
      if (!runId) return;
      const res = await executeDunningRun(runId);
      if (res?.run) {
        hydrateQueueFromRun(res.run);
        setDunningRuns((prev) => [res.run as DunningRun, ...prev.filter((entry) => entry._id !== res.run?._id)]);
      }
      const failed = Number(res?.failed || 0);
      toast({
        title: failed > 0 ? t('common.error') : t('common.success'),
        description: `Mahnlauf ausgeführt: ${Number(res?.sent || 0)} versendet, ${failed} fehlgeschlagen, ${Number(res?.skipped || 0)} übersprungen.`,
        ...(failed > 0 ? { variant: 'destructive' as const } : {}),
      });
      void fetchFinancialData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Der Mahnlauf konnte nicht ausgeführt werden.';
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    } finally {
      setDunningExecuting(false);
    }
  };

  const onToggleDunningPause = async () => {
    const nextPaused = !dunningPaused;
    setDunningPaused(nextPaused);

    if (!selectedDunningRunId) return;
    try {
      const res = await updateDunningRun(selectedDunningRunId, {
        status: nextPaused ? 'paused' : 'running',
        logType: nextPaused ? 'paused' : 'resumed',
        logMessage: nextPaused ? 'Mahnlauf pausiert' : 'Mahnlauf fortgesetzt'
      });
      const run = res?.run as DunningRun;
      setDunningRuns((prev) => prev.map((entry) => (entry._id === run._id ? run : entry)));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('financialManagement.failedToUpdatePayment');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  const validateGatewayConfiguration = (): { valid: boolean; errors: string[] } => {
    if (!selectedGateway) return { valid: false, errors: ['Gateway nicht ausgewählt'] };

    const errors: string[] = [];
    const config = selectedGateway.configuration;

    // Basis-Validierung (alle Gateways)
    if (!selectedGateway.name?.trim()) errors.push('Name ist erforderlich');
    if (!config.currency?.trim()) errors.push('Currency ist erforderlich');
    if (typeof config.processingFee !== 'number' || config.processingFee < 0) errors.push('Processing Fee muss >= 0 sein');

    // PayPal-spezifische Validierung
    if (selectedGateway.provider === 'paypal') {
      if (!config.environment) errors.push('environment ist erforderlich');
      if (!config.sandbox_client_id?.trim()) errors.push('sandbox_client_id ist erforderlich');
      if (!config.sandbox_client_secret?.trim()) errors.push('sandbox_client_secret ist erforderlich');
      if (!config.default_currency?.trim()) errors.push('default_currency ist erforderlich');
      if (!config.payment_intent) errors.push('payment_intent ist erforderlich');
      if (!config.amount_source) errors.push('amount_source ist erforderlich');
      if (!config.return_url?.trim()) errors.push('return_url ist erforderlich');
      if (!config.cancel_url?.trim()) errors.push('cancel_url ist erforderlich');

      // URLs validieren
      const urlFields = ['return_url', 'cancel_url', 'webhook_url'];
      for (const field of urlFields) {
        const value = config[field as keyof typeof config];
        if (value && typeof value === 'string' && value.trim() !== '' && !value.startsWith('http')) {
          errors.push(`${field} muss mit http:// oder https:// beginnen`);
        }
      }
    }

    // Stripe-spezifische Validierung
    if (selectedGateway.provider === 'stripe') {
      if (!config.mode) errors.push('mode ist erforderlich');
      if (!config.test_publishable_key?.trim()) errors.push('test_publishable_key ist erforderlich');
      if (!config.test_secret_key?.trim()) errors.push('test_secret_key ist erforderlich');
      if (!config.default_currency?.trim()) errors.push('default_currency ist erforderlich');
      if (!config.amount_source) errors.push('amount_source ist erforderlich');
      if (!config.payment_mode) errors.push('payment_mode ist erforderlich');
      if (!config.success_url?.trim()) errors.push('success_url ist erforderlich');
      if (!config.cancel_url?.trim()) errors.push('cancel_url ist erforderlich');

      // URLs validieren
      const urlFields = ['success_url', 'cancel_url', 'webhook_url'];
      for (const field of urlFields) {
        const value = config[field as keyof typeof config];
        if (value && typeof value === 'string' && value.trim() !== '' && !value.startsWith('http')) {
          errors.push(`${field} muss mit http:// oder https:// beginnen`);
        }
      }
    }

    // Banküberweisung-spezifische Validierung
    if (selectedGateway.provider === 'bank_transfer') {
      if (!config.code?.trim()) errors.push('code ist erforderlich');
      if (!config.title?.trim()) errors.push('title ist erforderlich');
      if (!config.account_holder?.trim()) errors.push('Kontoinhaber ist erforderlich');
      if (!config.iban?.trim()) errors.push('IBAN ist erforderlich');
      if (!config.payment_reference_template?.trim()) errors.push('payment_reference_template ist erforderlich');
      if (!config.initial_order_status?.trim()) errors.push('initial_order_status ist erforderlich');
      if (config.admin_can_mark_paid === undefined || config.admin_can_mark_paid === null) errors.push('admin_can_mark_paid ist erforderlich');
    }

    // Barzahlung-spezifische Validierung
    if (selectedGateway.provider === 'cash') {
      if (!config.code?.trim()) errors.push('code ist erforderlich');
      if (!config.title?.trim()) errors.push('title ist erforderlich');
      if (!config.cash_mode) errors.push('Modus ist erforderlich');
      if (!config.initial_order_status?.trim()) errors.push('initial_order_status ist erforderlich');
      if (config.admin_can_mark_paid === undefined || config.admin_can_mark_paid === null) errors.push('admin_can_mark_paid ist erforderlich');
    }

    return { valid: errors.length === 0, errors };
  };

  const onUpdateGateway = async () => {
    if (!selectedGateway) return;

    const validation = validateGatewayConfiguration();
    if (!validation.valid) {
      toast({
        title: t('common.error'),
        description: validation.errors.join('; '),
        variant: 'destructive'
      });
      return;
    }

    try {
      await updatePaymentGateway(selectedGateway._id, selectedGateway);
      toast({ title: t('common.success'), description: t('financialManagement.paymentUpdatedSuccess') });
      setGatewayDialogOpen(false);
      setSelectedGateway(null);
      void fetchFinancialData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('financialManagement.failedToUpdatePayment');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  const updateGatewayConfiguration = (key: keyof PaymentGateway['configuration'], value: unknown) => {
    setSelectedGateway((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        configuration: {
          ...prev.configuration,
          [key]: value
        }
      };
    });
  };

  const getConfigString = (key: keyof PaymentGateway['configuration'], fallback = '') => {
    const value = selectedGateway?.configuration?.[key];
    return typeof value === 'string' ? value : fallback;
  };

  const getConfigNumber = (key: keyof PaymentGateway['configuration'], fallback: number) => {
    const value = selectedGateway?.configuration?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  };

  const getConfigBoolean = (key: keyof PaymentGateway['configuration'], fallback = false) => {
    const value = selectedGateway?.configuration?.[key];
    return typeof value === 'boolean' ? value : fallback;
  };

  const getConfigStringList = (key: keyof PaymentGateway['configuration']) => {
    const value = selectedGateway?.configuration?.[key];
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
  };

  const parseStringList = (value: string) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

  const [overpaymentBookingId, setOverpaymentBookingId] = useState('');
  const [overpaymentReason, setOverpaymentReason] = useState('Guthaben-Ausgleich');
  const [overpaymentAmount, setOverpaymentAmount] = useState('');
  const [overpaymentProcessRefund, setOverpaymentProcessRefund] = useState(false);
  const [overpaymentRefundMode, setOverpaymentRefundMode] = useState<'manual' | 'gateway'>('manual');
  const [selectedOverpaymentBooking, setSelectedOverpaymentBooking] = useState<BookingSearchResultItem | null>(null);
  const [overpaymentOverview, setOverpaymentOverview] = useState<BookingPaymentOverview | null>(null);
  const [loadingOverpaymentOverview, setLoadingOverpaymentOverview] = useState(false);
  const [isReconcilingOverpayment, setIsReconcilingOverpayment] = useState(false);

  const [paymentRequestBookingId, setPaymentRequestBookingId] = useState('');
  const [paymentRequestAmount, setPaymentRequestAmount] = useState('');
  const [paymentRequestNote, setPaymentRequestNote] = useState('Bitte begleichen Sie den offenen Betrag.');
  const [selectedPaymentRequestBooking, setSelectedPaymentRequestBooking] = useState<BookingSearchResultItem | null>(null);
  const [paymentRequestOverview, setPaymentRequestOverview] = useState<BookingPaymentOverview | null>(null);
  // Per Rechnungsnummer gewaehlt: dann gilt der offene Betrag genau DIESER Rechnung.
  const [paymentRequestInvoice, setPaymentRequestInvoice] = useState<Invoice | null>(null);
  const [loadingPaymentRequestOverview, setLoadingPaymentRequestOverview] = useState(false);
  const [isSendingPaymentRequest, setIsSendingPaymentRequest] = useState(false);

  const [paymentRequests, setPaymentRequests] = useState<PaymentRequestRecord[]>([]);
  const [paymentRequestsAvailable, setPaymentRequestsAvailable] = useState(true);
  const [loadingPaymentRequests, setLoadingPaymentRequests] = useState(false);

  const [syncBookingId, setSyncBookingId] = useState('');
  const [syncType, setSyncType] = useState<'booking' | 'order'>('booking');
  const [selectedSyncItem, setSelectedSyncItem] = useState<BookingSearchResultItem | null>(null);
  const [isSyncingFinancials, setIsSyncingFinancials] = useState(false);

  /**
   * True, solange der eingegebene Text noch die ausgewaehlte Buchung meint.
   * Wird der Text danach veraendert, muss die Auswahl (und alles, was daraus
   * vorbefuellt wurde) verworfen werden.
   */
  const matchesSelectedBooking = (value: string, selected: BookingSearchResultItem | null): boolean => {
    if (!selected) return false;
    const needle = normalizeDocumentNumber(value);
    if (!needle) return false;
    const candidates = [selected.bookingNumber, selected._id, ...(selected.matchedInvoiceNumbers || [])];
    return candidates.some((candidate) => candidate && normalizeDocumentNumber(candidate) === needle);
  };

  const loadPaymentRequestHistory = async (bookingId: string) => {
    if (!bookingId) {
      setPaymentRequests([]);
      setPaymentRequestsAvailable(true);
      return;
    }
    setLoadingPaymentRequests(true);
    try {
      const res = await getPaymentRequests(bookingId);
      setPaymentRequests(res.requests);
      setPaymentRequestsAvailable(res.available);
    } catch {
      setPaymentRequests([]);
      setPaymentRequestsAvailable(false);
    } finally {
      setLoadingPaymentRequests(false);
    }
  };

  const loadOverpaymentOverview = async (bookingId: string) => {
    if (!bookingId) {
      setOverpaymentOverview(null);
      return;
    }
    setLoadingOverpaymentOverview(true);
    try {
      const overview = await getBookingPayments(bookingId);
      setOverpaymentOverview(overview);
      if (overview?.summary?.isOverpaid) {
        // Vorschlag = tatsaechlich noch zu erstattender Betrag (Server), ohne bereits
        // laufende Anbieter-Erstattungen.
        const overpaidVal = Math.max(0, Number(getExtendedSummary(overview).refundPendingTotal ?? getExtendedSummary(overview).overpaidTotal ?? 0));
        if (overpaidVal > 0) {
          setOverpaymentAmount(overpaidVal.toFixed(2));
          setOverpaymentReason(`Überzahlungsausgleich (${overpaidVal.toFixed(2)} €)`);
        }
      }
    } catch {
      setOverpaymentOverview(null);
    } finally {
      setLoadingOverpaymentOverview(false);
    }
  };

  const loadPaymentRequestOverview = async (bookingId: string, invoiceNumber = '') => {
    if (!bookingId && !invoiceNumber) {
      setPaymentRequestOverview(null);
      setPaymentRequestInvoice(null);
      return;
    }
    setLoadingPaymentRequestOverview(true);
    try {
      if (invoiceNumber) {
        // Rechnungsziel: offener Betrag aus dem Server-Saldo dieser Rechnung.
        const res = await getInvoices({ invoiceNumber, scope: 'invoices', limit: 5 });
        const needle = normalizeDocumentNumber(invoiceNumber);
        const match = ((res?.invoices || []) as Invoice[]).find((inv) => normalizeDocumentNumber(inv.invoiceNumber) === needle) || null;
        setPaymentRequestInvoice(match);
        setPaymentRequestOverview(null);
        const invoiceOpen = match ? getInvoiceOpenAmount(match) : 0;
        if (invoiceOpen > 0) {
          setPaymentRequestAmount(invoiceOpen.toFixed(2));
          setPaymentRequestNote(`Bitte begleichen Sie den offenen Betrag der Rechnung ${match?.invoiceNumber} in Höhe von ${formatCurrencyValue(invoiceOpen)}.`);
        } else {
          setPaymentRequestAmount('');
        }
        return;
      }
      setPaymentRequestInvoice(null);
      const overview = await getBookingPayments(bookingId);
      setPaymentRequestOverview(overview);
      const openBal = overview?.summary?.openOrderBalance || 0;
      if (openBal > 0) {
        setPaymentRequestAmount(openBal.toFixed(2));
        setPaymentRequestNote(`Bitte begleichen Sie den offenen Restbetrag in Höhe von ${formatCurrencyValue(openBal)}.`);
      }
    } catch {
      setPaymentRequestOverview(null);
      setPaymentRequestInvoice(null);
    } finally {
      setLoadingPaymentRequestOverview(false);
    }
  };

  const onSelectOverpaymentBooking = (item: BookingSearchResultItem) => {
    setSelectedOverpaymentBooking(item);
    void loadOverpaymentOverview(item._id || item.bookingNumber || '');
  };

  const onSelectPaymentRequestBooking = (item: BookingSearchResultItem) => {
    setSelectedPaymentRequestBooking(item);
    // Treffer ueber genau eine Rechnungsnummer -> Rechnungsziel (siehe allowInvoiceTarget).
    const invoiceNumber = (item.matchedInvoiceNumbers || []).length === 1 ? (item.matchedInvoiceNumbers || [])[0] : '';
    const identifier = invoiceNumber || item._id || item.bookingNumber || '';
    void loadPaymentRequestOverview(item._id || item.bookingNumber || '', invoiceNumber);
    void loadPaymentRequestHistory(identifier);
  };

  const onSelectSyncItem = (item: BookingSearchResultItem) => {
    setSelectedSyncItem(item);
  };

  const onReconcileOverpaymentHandler = async () => {
    if (!overpaymentBookingId.trim()) {
      toast({ title: t('common.error'), description: 'Bitte Buchungs-ID angeben oder aus den Vorschlägen auswählen.', variant: 'destructive' });
      return;
    }
    setIsReconcilingOverpayment(true);
    try {
      const parsedAmount = overpaymentAmount ? parseFloat(overpaymentAmount.replace(',', '.')) : undefined;
      const res = await reconcileOverpayment(overpaymentBookingId.trim(), {
        amount: parsedAmount,
        reason: overpaymentReason.trim() || 'Guthaben-Ausgleich',
        processRefund: overpaymentProcessRefund,
        refundMode: overpaymentRefundMode
      });
      // Die Meldung kommt vom Server: sie sagt, ob erstattet, ausstehend oder nur als
      // Guthaben stehen gelassen wurde. Eine ausstehende Anbieter-Erstattung ist kein
      // abgeschlossener Erfolg.
      if (res?.isOverpaid === false) {
        toast({
          title: 'Hinweis',
          description: res.message || 'Keine Überzahlung für diesen Auftrag festgestellt.',
          variant: 'default'
        });
      } else {
        toast({
          title: res?.refundStatus === 'pending' ? 'Erstattung ausstehend' : (overpaymentProcessRefund ? t('common.success') : 'Hinweis'),
          description: res?.message || 'Überzahlung wurde geprüft.',
        });
      }
      if (selectedOverpaymentBooking?._id || overpaymentBookingId) {
        void loadOverpaymentOverview(selectedOverpaymentBooking?._id || overpaymentBookingId);
      }
      void fetchFinancialData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Fehler beim Ausgleichen der Überzahlung';
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    } finally {
      setIsReconcilingOverpayment(false);
    }
  };

  const onRequestAdditionalPaymentHandler = async () => {
    if (!paymentRequestBookingId.trim()) {
      toast({ title: t('common.error'), description: 'Bitte Buchungs-ID angeben oder aus den Vorschlägen auswählen.', variant: 'destructive' });
      return;
    }
    setIsSendingPaymentRequest(true);
    try {
      const parsedAmount = paymentRequestAmount ? parseFloat(paymentRequestAmount.replace(',', '.')) : undefined;
      const res = await requestAdditionalPayment(paymentRequestBookingId.trim(), {
        amount: parsedAmount,
        note: paymentRequestNote.trim()
      });

      // Ein Versand gilt nur dann als erfolgreich, wenn der Server das auch sagt.
      // 'accepted_by_provider' heisst: der Mailserver hat die Nachricht angenommen -
      // das ist KEINE Zustellbestaetigung und wird deshalb auch so formuliert.
      if (res?.status === 'skipped_no_recipient' || res?.code === 'NO_RECIPIENT') {
        toast({
          title: t('common.error'),
          description: 'Für diese Buchung ist keine E-Mail-Adresse hinterlegt – es wurde nichts gesendet.',
          variant: 'destructive',
        });
      } else if (res?.status === 'failed' || res?.success === false) {
        const detail = res?.error || res?.message;
        toast({
          title: res?.success === false && !res?.error ? 'Hinweis' : t('common.error'),
          description: detail || 'Die Zahlungsaufforderung konnte nicht gesendet werden.',
          variant: res?.error || res?.status === 'failed' ? 'destructive' : 'default',
        });
      } else if (!res?.recipientEmail) {
        toast({
          title: t('common.error'),
          description: 'Der Server hat keine Empfängeradresse gemeldet – bitte den Versand im E-Mail-Protokoll prüfen.',
          variant: 'destructive',
        });
      } else {
        // Wortlaut vom Server: per E-Mail uebergeben, kein PayPal-Auftrag, Zustellung
        // nicht garantiert - und ob der Hinweistext mitging.
        toast({
          title: res.noteDelivered === false && paymentRequestNote.trim() ? 'Hinweis' : t('common.success'),
          description: res.message || `Zahlungsaufforderung per E-Mail an ${res.recipientEmail} übergeben (Zustellung nicht garantiert).`,
        });
      }

      const historyId = paymentRequestBookingId.trim() || selectedPaymentRequestBooking?._id || '';
      void loadPaymentRequestHistory(historyId);
      void fetchFinancialData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Fehler beim Senden der Zahlungsaufforderung';
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    } finally {
      setIsSendingPaymentRequest(false);
    }
  };

  const onSyncBookingFinancialsHandler = async () => {
    if (!syncBookingId.trim()) {
      toast({ title: t('common.error'), description: 'Bitte ID angeben oder aus den Vorschlägen auswählen.', variant: 'destructive' });
      return;
    }
    setIsSyncingFinancials(true);
    try {
      const res = await syncBookingFinancials(syncBookingId.trim(), syncType);
      toast({
        title: t('common.success'),
        description: `Finanzdaten für ${syncType === 'booking' ? 'Buchung' : 'Bestellung'} ${syncBookingId} erfolgreich synchronisiert.`
      });
      if (selectedSyncItem) {
        setSelectedSyncItem((prev) => prev ? { ...prev, ...res?.overview?.booking } : null);
      }
      void fetchFinancialData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Fehler bei der Synchronisierung der Finanzdaten';
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    } finally {
      setIsSyncingFinancials(false);
    }
  };

  const onExport = async (type: 'payments' | 'invoices' | 'zm', format: 'csv' | 'json') => {
    try {
      let response;
      if (type === 'payments') {
        response = await exportPayments({}, format);
      } else if (type === 'zm') {
        response = await exportInvoicesData({ isReverseCharge: true }, format);
      } else {
        response = await exportInvoicesData({}, format);
      }

      if (format === 'csv') {
        const blob = response.data as Blob;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const filename = type === 'zm'
          ? `zusammenfassende-meldung-zm-${new Date().toISOString().slice(0, 10)}.csv`
          : `${type}-${new Date().toISOString().slice(0, 10)}.csv`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }

      toast({ title: t('common.success'), description: t('financialManagement.paymentUpdatedSuccess') });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('financialManagement.failedToUpdatePayment');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[340px] items-center justify-center">
        <div className="flex items-center gap-2 rounded-md border border-[#d8dce6] bg-white px-4 py-3 text-[#1a2a5e]">
          <RefreshCw className="h-4 w-4 animate-spin" /> {t('common.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[#0f1d45] bg-gradient-to-r from-[#1a2a5e] via-[#1a2a5e] to-[#2a3f7e] px-5 py-5 text-white shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              {isCreditNoteView ? 'Gutschriften' : t('financialManagement.title')}
            </h1>
            <p className="text-sm text-[#d8dce6]">
              {isCreditNoteView
                ? 'Alle Gutschriften mit eigener Nummernkreis-Serie (INV-CN-JJJJ-NNNN) und Bezug zur Ursprungsrechnung.'
                : t('financialManagement.description')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-[#1a2a5e] bg-[#f5c800] text-[#1a2a5e] hover:bg-[#e0b800]" onClick={fetchFinancialData}>
              <RefreshCw className="mr-2 h-4 w-4" /> {t('common.refresh')}
            </Button>
            <Button variant="outline" className="border-[#1a2a5e] bg-[#f5c800] text-[#1a2a5e] hover:bg-[#e0b800]" onClick={onRunDunning}>
              <Mail className="mr-2 h-4 w-4" /> Mahnlauf
            </Button>
          </div>
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {isCreditNoteView ? (
          <TabsList className="grid w-full grid-cols-1 gap-1 border border-[#d8dce6] bg-[#f8f9fc] p-1">
            <TabsTrigger value="invoices" className="data-[state=active]:bg-[#1a2a5e] data-[state=active]:text-white">
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />Gutschriften
            </TabsTrigger>
          </TabsList>
        ) : (
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1 border border-[#d8dce6] bg-[#f8f9fc] p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-[#1a2a5e] data-[state=active]:text-white">
            <TrendingUp className="mr-1.5 h-4 w-4" />{t('financialManagement.tabs.overview')}
          </TabsTrigger>
          <TabsTrigger value="invoices" className="data-[state=active]:bg-[#1a2a5e] data-[state=active]:text-white">
            <FileSpreadsheet className="mr-1.5 h-4 w-4" />{t('financialManagement.tabs.invoices')}
          </TabsTrigger>
          <TabsTrigger value="dunning" className="data-[state=active]:bg-[#1a2a5e] data-[state=active]:text-white">
            <Mail className="mr-1.5 h-4 w-4" />{t('financialManagement.tabs.dunning')}
          </TabsTrigger>
          <TabsTrigger value="payments" className="data-[state=active]:bg-[#1a2a5e] data-[state=active]:text-white">
            <Wallet className="mr-1.5 h-4 w-4" />{t('financialManagement.tabs.payments')}
          </TabsTrigger>
          <TabsTrigger value="gateways" className="data-[state=active]:bg-[#1a2a5e] data-[state=active]:text-white">
            <ShieldCheck className="mr-1.5 h-4 w-4" />{t('financialManagement.tabs.gateways')}
          </TabsTrigger>
          <TabsTrigger value="reports" className="data-[state=active]:bg-[#1a2a5e] data-[state=active]:text-white">
            <Banknote className="mr-1.5 h-4 w-4" />{t('financialManagement.tabs.reports')}
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-[#1a2a5e] data-[state=active]:text-white">
            <Settings className="mr-1.5 h-4 w-4" />{t('financialManagement.tabs.settings')}
          </TabsTrigger>
        </TabsList>
        )}

        <TabsContent value="overview" className="space-y-4">
          {/* KPI Dashboard Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Card className="border-[#d8dce6]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('financialManagement.kpiPaidRevenue')}</span>
                  <Banknote className="h-4 w-4 text-green-600" />
                </div>
                <div className="mt-2 text-xl font-bold text-[#1a2a5e]">
                  {formatCurrencyValue(totals.paidAmount)}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{t('financialManagement.kpiCompletedPayments')}</div>
              </CardContent>
            </Card>

            <Card className="border-[#d8dce6]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('financialManagement.kpiOpenInvoices')}</span>
                  <FileSpreadsheet className="h-4 w-4 text-amber-600" />
                </div>
                <div className="mt-2 text-xl font-bold text-[#1a2a5e]">
                  {formatCurrencyValue(totals.openAmount)}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{t('financialManagement.kpiInvoicesPending', { count: totals.openCount })}</div>
              </CardContent>
            </Card>

            <Card className="border-[#d8dce6]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('financialManagement.kpiOverdueVolume')}</span>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </div>
                <div className="mt-2 text-xl font-bold text-red-700">
                  {formatCurrencyValue(totals.overdueAmount)}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{t('financialManagement.kpiCasesInDunning', { count: totals.overdueCount })}</div>
              </CardContent>
            </Card>

            <Card className="border-[#d8dce6]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('financialManagement.kpiSuccessRate')}</span>
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="mt-2 text-xl font-bold text-[#1a2a5e]">
                  {paymentOverview.successRate.toFixed(1)}%
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{t('financialManagement.kpiOfTransactions', { completed: paymentOverview.completedCount, total: paymentOverview.totalCount })}</div>
              </CardContent>
            </Card>

            <Card className="border-[#d8dce6]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('financialManagement.kpiRefunds')}</span>
                  <RefreshCw className="h-4 w-4 text-purple-600" />
                </div>
                <div className="mt-2 text-xl font-bold text-purple-800">
                  {formatCurrencyValue(paymentOverview.refundedVolume)}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{t('financialManagement.kpiRefundsCount', { count: paymentOverview.refundedCount })}</div>
              </CardContent>
            </Card>

            <Card className="border-indigo-200 bg-indigo-50/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs text-indigo-900 font-medium">
                  <span>{t('financialManagement.reverseCharge')}</span>
                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="mt-2 text-xl font-bold text-indigo-950">
                  {invoices.filter((i) => i.isReverseCharge).length}
                </div>
                <div className="mt-1 text-[11px] text-indigo-800">{t('financialManagement.kpiZmInvoices')}</div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Action Shortcuts */}
          <Card className="border-[#d8dce6]">
            <CardHeader className="bg-[#1a2a5e] rounded-t-lg py-3">
              <CardTitle className="text-sm font-semibold" style={{ color: "#f5c800" }}>{t('financialManagement.quickActions')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-2">
                <Button className="bg-[#f5c800] text-[#1a2a5e] hover:bg-[#e0b800]" onClick={() => setInvoiceDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />{t('financialManagement.createNewInvoice')}
                </Button>
                <Button variant="outline" className="border-[#1a2a5e] text-[#1a2a5e]" onClick={() => setFromRepairDialogOpen(true)}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />{t('financialManagement.generateFromRepairs')}
                </Button>
                <Button variant="outline" className="border-[#1a2a5e] text-[#1a2a5e]" onClick={onRunDunning}>
                  <Mail className="mr-2 h-4 w-4" />{t('financialManagement.runDunning')}
                </Button>
                <Button variant="outline" className="border-[#1a2a5e] text-[#1a2a5e]" onClick={() => setActiveTab('payments')}>
                  <Wallet className="mr-2 h-4 w-4" />{t('financialManagement.paymentsAndRefunds')}
                </Button>
                <Button variant="outline" className="border-[#1a2a5e] text-[#1a2a5e]" onClick={() => setActiveTab('reports')}>
                  <Banknote className="mr-2 h-4 w-4" />{t('financialManagement.reports')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Invoices Table Preview */}
          <Card className="border-[#d8dce6]">
            <CardHeader className="bg-[#1a2a5e] rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle style={{ color: "#f5c800" }}>{t('financialManagement.recentInvoicesOverview')}</CardTitle>
                <Button variant="link" className="text-[#f5c800] hover:text-yellow-300 text-xs" onClick={() => setActiveTab('invoices')}>
                  {t('financialManagement.viewAllInvoices', { count: invoices.length })}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="overflow-x-auto rounded-lg border border-[#d8dce6]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('financialManagement.invoiceNumber')}</TableHead>
                      <TableHead>{t('financialManagement.customer')}</TableHead>
                      <TableHead>{t('financialManagement.status')}</TableHead>
                      <TableHead>{t('financialManagement.dueDate')}</TableHead>
                      <TableHead>{t('financialManagement.totalAmount')}</TableHead>
                      <TableHead>{t('financialManagement.openAmount')}</TableHead>
                      <TableHead className="text-right">{t('financialManagement.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleInvoices.slice(0, 5).map((invoice) => (
                      <TableRow key={`overview-inv-${invoice._id}`}>
                        <TableCell className="font-medium text-[#1a2a5e]">{invoice.invoiceNumber}</TableCell>
                        <TableCell>{invoice.customerName}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge variant="outline" className={invoiceStatusClass[invoice.status]}>{getInvoiceStatusLabel(invoice.status, t)}</Badge>
                            <InvoicePaymentHints invoice={invoice} />
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                        <TableCell>{formatCurrencyValue(invoice.total)}</TableCell>
                        <TableCell>{formatCurrencyValue(getInvoiceOpenAmount(invoice))}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => openInvoiceDetails(invoice)}>
                            <Eye className="mr-1 h-3.5 w-3.5" />{t('common.details', 'Details')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {visibleInvoices.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">{t('financialManagement.noInvoices')}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <Card className="border-[#d8dce6]">
            <CardHeader className="bg-[#1a2a5e] rounded-t-lg">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle style={{ color: "#f5c800" }}>
                  {isCreditNoteView ? 'Gutschriften' : t('financialManagement.invoices')}
                </CardTitle>
                {!isCreditNoteView && (
                <div className="flex gap-2">
                  <Button className="bg-[#f5c800] text-[#1a2a5e] hover:bg-[#e0b800]" onClick={() => setInvoiceDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />{t('financialManagement.createInvoice')}
                  </Button>
                  <Button variant="outline" className="border-[#1a2a5e] bg-[#f5c800] text-[#1a2a5e] hover:bg-[#e0b800]" onClick={() => setFromRepairDialogOpen(true)}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />{t('financialManagement.generateFromRepairs')}
                  </Button>
                </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {invoiceScopeIncomplete && (
                <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    Diese Serverversion filtert den Belegtyp noch nicht selbst. Angezeigt werden nur die{' '}
                    {isCreditNoteView ? 'Gutschriften' : 'Rechnungen'} aus den {INVOICE_PAGE_LIMIT} zuletzt angelegten Belegen
                    – ältere {isCreditNoteView ? 'Gutschriften' : 'Rechnungen'} können fehlen. Bitte grenzen Sie die Liste
                    über die Filter (Zeitraum, Status) ein.
                  </span>
                </div>
              )}
              {!invoiceScopeIncomplete && invoiceTotalCount > invoices.length && (
                <div className="mb-3 flex items-start gap-2 rounded-md border border-[#d8dce6] bg-[#f6f8fc] px-3 py-2 text-sm text-[#1a2a5e]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#1a2a5e]" />
                  <span>
                    Es gibt insgesamt {invoiceTotalCount} {isCreditNoteView ? 'Gutschriften' : 'Rechnungen'}.
                    Angezeigt werden bis zu {INVOICE_PAGE_LIMIT} Belege pro Seite – ältere erreichen Sie
                    über die Seitennavigation unter der Liste oder über die Filter (Zeitraum, Status).
                  </span>
                </div>
              )}
              <div className={`mb-3 grid gap-2 ${isCreditNoteView ? 'md:grid-cols-6' : 'md:grid-cols-5'}`}>
                <Select value={invoiceFilters.status} onValueChange={(value) => setInvoiceFilters((p) => ({ ...p, status: value }))}>
                  <SelectTrigger><SelectValue placeholder={t('financialManagement.status')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('financialManagement.allStatuses')}</SelectItem>
                    <SelectItem value="draft">{t('financialManagement.invoiceStatuses.draft')}</SelectItem>
                    <SelectItem value="pending_approval">{t('financialManagement.invoiceStatuses.pending_approval')}</SelectItem>
                    <SelectItem value="sent">{t('financialManagement.invoiceStatuses.sent')}</SelectItem>
                    <SelectItem value="partially_paid">{t('financialManagement.invoiceStatuses.partially_paid')}</SelectItem>
                    <SelectItem value="paid">{t('financialManagement.invoiceStatuses.paid')}</SelectItem>
                    <SelectItem value="overdue">{t('financialManagement.invoiceStatuses.overdue')}</SelectItem>
                    <SelectItem value="cancelled">{t('financialManagement.invoiceStatuses.cancelled')}</SelectItem>
                    <SelectItem value="credited">{t('financialManagement.invoiceStatuses.credited')}</SelectItem>
                  </SelectContent>
                </Select>
                {isCreditNoteView ? (
                  <Select value={invoiceFilters.correctionType} onValueChange={(value) => setInvoiceFilters((p) => ({ ...p, correctionType: value }))}>
                    <SelectTrigger><SelectValue placeholder="Korrekturart" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Korrekturarten</SelectItem>
                      <SelectItem value="full_cancellation">Vollstorno</SelectItem>
                      <SelectItem value="price_adjustment">Wertminderung</SelectItem>
                      <SelectItem value="partial_refund">Rückzahlung</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={invoiceFilters.taxType} onValueChange={(value) => setInvoiceFilters((p) => ({ ...p, taxType: value }))}>
                    <SelectTrigger><SelectValue placeholder={t('financialManagement.taxType')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('financialManagement.allTaxTypes')}</SelectItem>
                      <SelectItem value="regular">{t('financialManagement.regularTax')}</SelectItem>
                      <SelectItem value="reverse_charge">{t('financialManagement.reverseChargeTax')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {isCreditNoteView && (
                  <Input
                    placeholder="Ursprungsrechnung (z. B. INV-2026-0001)"
                    value={invoiceFilters.originalInvoiceNumber}
                    onChange={(e) => setInvoiceFilters((p) => ({ ...p, originalInvoiceNumber: e.target.value }))}
                  />
                )}
                <Input type="date" value={invoiceFilters.dateFrom} onChange={(e) => setInvoiceFilters((p) => ({ ...p, dateFrom: e.target.value }))} />
                <Input type="date" value={invoiceFilters.dateTo} onChange={(e) => setInvoiceFilters((p) => ({ ...p, dateTo: e.target.value }))} />
                <Button variant="outline" onClick={onApplyInvoiceFilters}><Search className="mr-2 h-4 w-4" />{t('common.filter')}</Button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-[#d8dce6]">
                <Table>
                  <TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>{t('financialManagement.invoiceNumber')}</TableHead><TableHead>{t('financialManagement.customer')}</TableHead><TableHead>{t('financialManagement.status')}</TableHead><TableHead>{t('financialManagement.dueDate')}</TableHead><TableHead>{t('financialManagement.totalAmount')}</TableHead><TableHead>{t('financialManagement.amount')}</TableHead><TableHead>{t('financialManagement.booking')}</TableHead><TableHead className="text-right">{t('financialManagement.actions')}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {visibleInvoices.map((invoice) => {
                      const invoicePayments = paymentsByInvoiceId.get(invoice._id) || [];
                      const isExpanded = expandedInvoiceIds.has(invoice._id);
                      return (
                      <Fragment key={invoice._id}>
                      <TableRow
                        data-finance-invoice-row-id={invoice._id}
                        className={`cursor-pointer ${activeHighlightedInvoiceId === invoice._id ? 'bg-amber-50 ring-1 ring-amber-300' : ''}`}
                        onClick={() => openInvoiceDetails(invoice)}
                      >
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title={isExpanded ? t('financialManagement.collapseProcesses') : `${invoicePayments.length} ${t('financialManagement.paymentProcesses')}`}
                            onClick={() => toggleInvoiceExpanded(invoice._id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-[#1a2a5e]" />
                            ) : (
                              <ChevronRight className={`h-4 w-4 ${invoicePayments.length === 0 ? 'text-muted-foreground/50' : 'text-[#1a2a5e]'}`} />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{invoice.invoiceNumber}</span>
                              {invoice.isCreditNote && (
                                <Badge className="bg-purple-700 text-white text-[10px] px-1.5 py-0.5 border-0">
                                  {t('financialManagement.creditNote', 'Gutschrift')}
                                </Badge>
                              )}
                              {invoice.isCreditNote && invoice.correctionType && (
                                <Badge variant="outline" className="border-purple-300 bg-purple-50 text-[10px] text-purple-800">
                                  {correctionTypeLabels[invoice.correctionType] || invoice.correctionType}
                                </Badge>
                              )}
                              {invoice.isReverseCharge && (
                                <Badge className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 border-0">Reverse Charge</Badge>
                              )}
                              {invoicePayments.length > 0 && (
                                <Badge variant="outline" className="border-[#d8dce6] bg-[#f8f9fc] text-[11px] text-[#1a2a5e]">{invoicePayments.length} Zahlung{invoicePayments.length === 1 ? '' : 'en'}</Badge>
                              )}
                            </div>
                            {invoice.isCreditNote && getOriginalInvoiceNumber(invoice) && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void openInvoiceDetailsById(getOriginalInvoiceId(invoice));
                                }}
                                disabled={!getOriginalInvoiceId(invoice)}
                                className="w-fit text-left text-[11px] text-[#1a2a5e] underline-offset-2 hover:underline disabled:no-underline disabled:text-muted-foreground"
                                title="Zur Ursprungsrechnung"
                              >
                                Ursprungsrechnung: {getOriginalInvoiceNumber(invoice)}
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{invoice.customerName}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge variant="outline" className={invoiceStatusClass[invoice.status]}>{getInvoiceStatusLabel(invoice.status, t)}</Badge>
                            <InvoicePaymentHints invoice={invoice} />
                          </div>
                        </TableCell>
                        <TableCell><Calendar className="mr-1 inline h-3.5 w-3.5" />{formatDate(invoice.dueDate)}</TableCell>
                        <TableCell>{formatCurrencyValue(getStoredGross(invoice))}</TableCell>
                        <TableCell>{formatCurrencyValue(getInvoicePaidAmount(invoice))}</TableCell>
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          {(() => {
                            const target = resolveInvoiceNavigationTarget(invoice);
                            if (!target) return <span className="text-xs text-muted-foreground">—</span>;
                            const Icon = target.kind === 'booking' ? Calendar : target.kind === 'order' ? Package : Wrench;
                            return (
                              <button
                                type="button"
                                onClick={() => openInvoiceNavigationTarget(target)}
                                className="inline-flex items-center gap-1 rounded border border-[#d8dce6] bg-[#f8f9fc] px-2 py-0.5 text-xs font-medium text-[#1a2a5e] transition hover:border-[#1a2a5e] hover:bg-[#e8ecf8]"
                                title={target.title}
                              >
                                <Icon className="h-3 w-3" />
                                {target.label}
                              </button>
                            );
                          })()}
                        </TableCell>
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <div className="flex justify-end">{renderInvoiceActionsMenu({ invoice })}</div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={9} className="bg-[#f8f9fc] p-0">
                            <div className="px-4 py-3">
                              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[#1a2a5e]">
                                <span className="flex items-center gap-2">
                                  <Wallet className="h-3.5 w-3.5" />{t('financialManagement.paymentProcesses')} ({invoicePayments.length})
                                </span>
                              </div>
                              {invoicePayments.length > 0 ? (
                                <div className="overflow-x-auto rounded-md border border-[#d8dce6] bg-white">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>{t('common.process', 'Prozess')}</TableHead>
                                        <TableHead>{t('financialManagement.status')}</TableHead>
                                        <TableHead>{t('financialManagement.paymentMethod')}</TableHead>
                                        <TableHead>{t('financialManagement.amount')}</TableHead>
                                        <TableHead>{t('financialManagement.date')}</TableHead>
                                        <TableHead>{t('financialManagement.transactionId')}</TableHead>
                                        <TableHead className="text-right">{t('financialManagement.actions')}</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {invoicePayments.map((payment) => {
                                        const metadata = (payment.metadata || {}) as Record<string, unknown>;
                                        const processLabel = payment.status === 'refunded'
                                          ? 'Erstattung abgeschlossen'
                                          : payment.status === 'completed'
                                            ? (metadata.scope === 'full' ? t('financialManagement.fullPayment') : t('financialManagement.partialPayment'))
                                            : payment.status === 'disputed'
                                              ? 'Dispute in Klärung'
                                              : 'Zahlungsvorgang';
                                        return (
                                          <TableRow key={payment._id}>
                                            <TableCell>
                                              <div className="space-y-1">
                                                <Badge variant="outline">{processLabel}</Badge>
                                                <div className="text-xs text-muted-foreground">{payment.orderNumber || payment._id.slice(-8)}</div>
                                                {Number(payment.refundAmount || 0) > 0.009 && (
                                                  <div className="text-xs text-purple-700">Erstattet {formatCurrencyValue(payment.refundAmount || 0, payment.currency || 'EUR')} · {payment.refundMode === 'gateway' ? 'über Zahlungsanbieter' : 'manuell erfasst'}</div>
                                                )}
                                              </div>
                                            </TableCell>
                                            <TableCell><Badge variant="outline" className={paymentStatusClass[payment.status]}>{getPaymentStatusLabel(payment.status, t)}</Badge></TableCell>
                                            <TableCell>{getPaymentMethodLabel(payment.paymentMethod, t)}</TableCell>
                                            <TableCell>
                                              {formatCurrencyValue(payment.amount, payment.currency || 'EUR')}
                                              <PaymentMoneyFlow payment={payment} onReconcile={openReconcileDialog} />
                                            </TableCell>
                                            <TableCell>
                                              <div className="text-sm">{formatDate(payment.processedAt || payment.createdAt)}</div>
                                              <div className="text-xs text-muted-foreground">{formatDateTime(payment.processedAt || payment.createdAt).split(', ')[1] || '-'}</div>
                                            </TableCell>
                                            <TableCell>
                                              <div className="max-w-[200px] truncate text-sm" title={payment.transactionId || payment.gatewayResponse || '-'}>
                                                {payment.transactionId || payment.gatewayResponse || '-'}
                                              </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                              {payment.status === 'completed' && (
                                                <Button size="sm" variant="outline" onClick={() => openRefundForPayment(payment)}>{t('financialManagement.refund')}</Button>
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#d8dce6] bg-white p-3 text-xs">
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                                    <span>{t('financialManagement.noPaymentProcesses')}</span>
                                  </div>
                                  {canRecordPayment(invoice) && (
                                    <Button size="sm" variant="outline" onClick={() => openPaymentDialog(invoice)}>
                                      <Banknote className="mr-1.5 h-3.5 w-3.5 text-[#1a2a5e]" />
                                      {t('financialManagement.recordPayment')}
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {/* Seitennavigation: ohne sie waeren aeltere Belege nach der ersten
                  Seite unerreichbar (stille Kappung). */}
              {!invoiceScopeIncomplete && invoiceTotalPages > 1 && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#d8dce6] pt-3 text-sm">
                  <span className="text-muted-foreground">
                    Seite {invoicePage} von {invoiceTotalPages} · {invoiceTotalCount}{' '}
                    {isCreditNoteView ? 'Gutschriften' : 'Rechnungen'} insgesamt
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={invoicePageLoading || invoicePage <= 1}
                      onClick={() => { void loadInvoicePage(invoicePage - 1); }}
                    >
                      Zurück
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={invoicePageLoading || invoicePage >= invoiceTotalPages}
                      onClick={() => { void loadInvoicePage(invoicePage + 1); }}
                    >
                      Weiter
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card className="border-[#d8dce6]">
            <CardHeader className="bg-[#1a2a5e] rounded-t-lg">
              <CardTitle style={{ color: "#f5c800" }}>{t('financialManagement.paymentsManagementTitle')}</CardTitle>
              <CardDescription className="text-[#c8d0e7]">{t('financialManagement.paymentsManagementDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3 grid gap-2 md:grid-cols-6">
                <Select value={paymentFilters.status} onValueChange={(value) => setPaymentFilters((p) => ({ ...p, status: value }))}>
                  <SelectTrigger><SelectValue placeholder={t('financialManagement.status')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('financialManagement.allStatuses')}</SelectItem>
                    <SelectItem value="pending">{t('financialManagement.paymentStatuses.pending')}</SelectItem>
                    <SelectItem value="processing">{t('financialManagement.paymentStatuses.processing')}</SelectItem>
                    <SelectItem value="completed">{t('financialManagement.paymentStatuses.completed')}</SelectItem>
                    <SelectItem value="failed">{t('financialManagement.paymentStatuses.failed')}</SelectItem>
                    <SelectItem value="refunded">{t('financialManagement.paymentStatuses.refunded')}</SelectItem>
                    <SelectItem value="disputed">{t('financialManagement.paymentStatuses.disputed')}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={paymentFilters.method} onValueChange={(value) => setPaymentFilters((p) => ({ ...p, method: value }))}>
                  <SelectTrigger><SelectValue placeholder={t('financialManagement.paymentMethod')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('financialManagement.allMethods')}</SelectItem>
                    <SelectItem value="credit_card">{t('financialManagement.paymentMethods.credit_card')}</SelectItem>
                    <SelectItem value="debit_card">{t('financialManagement.paymentMethods.debit_card')}</SelectItem>
                    <SelectItem value="paypal">{t('financialManagement.paymentMethods.paypal')}</SelectItem>
                    <SelectItem value="stripe">{t('financialManagement.paymentMethods.stripe')}</SelectItem>
                    <SelectItem value="bank_transfer">{t('financialManagement.paymentMethods.bank_transfer')}</SelectItem>
                    <SelectItem value="cash">{t('financialManagement.paymentMethods.cash')}</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={paymentFilters.dateFrom} onChange={(e) => setPaymentFilters((p) => ({ ...p, dateFrom: e.target.value }))} />
                <Input type="date" value={paymentFilters.dateTo} onChange={(e) => setPaymentFilters((p) => ({ ...p, dateTo: e.target.value }))} />
                <Button variant="outline" onClick={onApplyPaymentFilters}><Search className="mr-2 h-4 w-4" />{t('common.filter')}</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPaymentFilters({ status: 'all', method: 'all', dateFrom: '', dateTo: '' });
                    getPayments({}).then((res) => setPayments(res.payments || []));
                  }}
                >
                  {t('common.reset')}
                </Button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-[#d8dce6]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('financialManagement.transactionId')}</TableHead>
                      <TableHead>{t('financialManagement.customer')}</TableHead>
                      <TableHead>{t('financialManagement.status')}</TableHead>
                      <TableHead>{t('financialManagement.paymentMethod')}</TableHead>
                      <TableHead>{t('financialManagement.amount')}</TableHead>
                      <TableHead>{t('financialManagement.date')}</TableHead>
                      <TableHead className="text-right">{t('financialManagement.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={`pay-row-${payment._id}`}>
                        <TableCell>
                          <div className="font-medium text-[#1a2a5e]">{payment.transactionId || payment.orderNumber || payment._id.slice(-8)}</div>
                          {payment.invoiceId && <div className="text-xs text-muted-foreground">Invoice ID: {payment.invoiceId}</div>}
                        </TableCell>
                        <TableCell>{payment.customerName}</TableCell>
                        <TableCell><Badge variant="outline" className={paymentStatusClass[payment.status]}>{getPaymentStatusLabel(payment.status, t)}</Badge></TableCell>
                        <TableCell>{getPaymentMethodLabel(payment.paymentMethod, t)}</TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrencyValue(payment.amount, payment.currency || 'EUR')}
                          <PaymentMoneyFlow payment={payment} onReconcile={openReconcileDialog} />
                        </TableCell>
                        <TableCell>{formatDate(payment.processedAt || payment.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          {payment.status === 'completed' && (
                            <Button size="sm" variant="outline" onClick={() => openRefundForPayment(payment)}>
                              {t('financialManagement.refund')}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {payments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">{t('financialManagement.noPayments')}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        {(activeTab === 'overview' || activeTab === 'payments') && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-[#d8dce6] shadow-sm flex flex-col justify-between">
              <div>
                <CardHeader className="bg-[#1a2a5e] rounded-t-lg py-3">
                  <CardTitle className="text-sm flex items-center justify-between" style={{ color: "#f5c800" }}>
                    <span className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Überzahlung ausgleichen
                    </span>
                    <Badge variant="outline" className="text-[10px] border-[#f5c800]/40 text-[#f5c800] py-0 px-1.5 h-4 font-normal">
                      Erstattung / Guthaben
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs font-medium">Buchungs-/Rechnungsnummer oder Kunde</Label>
                      {loadingOverpaymentOverview && (
                        <span className="flex items-center text-[10px] text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin mr-1 text-primary" />
                          Prüfe Saldo...
                        </span>
                      )}
                    </div>
                    <BookingSearchAutocomplete
                      value={overpaymentBookingId}
                      onChange={(val) => {
                        setOverpaymentBookingId(val);
                        // Sobald der Text nicht mehr zur ausgewaehlten Buchung passt, wird die
                        // Auswahl verworfen: sonst zeigt die Infobox eine andere Buchung an,
                        // als der Button spaeter bucht.
                        if (!matchesSelectedBooking(val, selectedOverpaymentBooking)) {
                          setSelectedOverpaymentBooking(null);
                          setOverpaymentOverview(null);
                          setOverpaymentAmount('');
                          setOverpaymentReason('Guthaben-Ausgleich');
                        }
                      }}
                      onSelectItem={onSelectOverpaymentBooking}
                      placeholder="Buchung, Rechnungsnr. (z.B. INV-2026-0001) oder Kunde suchen..."
                      type="booking"
                    />
                  </div>

                  {/* Selected Booking Info Box */}
                  {(selectedOverpaymentBooking || overpaymentOverview) && (
                    <div className="p-2.5 rounded-md border bg-muted/40 space-y-1.5 animate-in fade-in-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-medium text-foreground truncate">
                          <User className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate">
                            {selectedOverpaymentBooking ? getSearchResultCustomerName(selectedOverpaymentBooking) : 'Kunde'}
                          </span>
                        </div>
                        {overpaymentOverview?.summary?.isOverpaid ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-200 text-[10px] h-4 px-1.5">
                            Überzahlt · Erstattung offen {formatCurrencyValue(Math.max(0, Number(getExtendedSummary(overpaymentOverview).refundPendingTotal ?? getExtendedSummary(overpaymentOverview).overpaidTotal ?? 0)))}
                          </Badge>
                        ) : overpaymentOverview ? (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">
                            Ausgeglichen
                          </Badge>
                        ) : null}
                      </div>

                      {overpaymentOverview && (
                        <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                          <div>Forderung: <span className="font-semibold text-foreground">{formatCurrencyValue(getExtendedSummary(overpaymentOverview).referenceTotal ?? overpaymentOverview.summary.orderValue)}</span></div>
                          <div>Erhalten: <span className="font-semibold text-foreground">{formatCurrencyValue(overpaymentOverview.summary.receivedTotal)}</span></div>
                          {Number(getExtendedSummary(overpaymentOverview).refundsInProgressTotal || 0) > 0.009 && (
                            <div className="col-span-2 text-sky-800">Erstattung in Bearbeitung: {formatCurrencyValue(Number(getExtendedSummary(overpaymentOverview).refundsInProgressTotal || 0))}</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2 sm:col-span-1">
                      <Label className="text-xs font-medium">Grund</Label>
                      <Input
                        value={overpaymentReason}
                        onChange={(e) => setOverpaymentReason(e.target.value)}
                        placeholder="z.B. Guthaben-Ausgleich"
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <Label className="text-xs font-medium">Betrag (€ optional)</Label>
                      <Input
                        value={overpaymentAmount}
                        onChange={(e) => setOverpaymentAmount(e.target.value)}
                        placeholder="Auto (Überzahlung)"
                        className="h-8 text-xs mt-1 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-md border p-2 bg-background">
                    <div className="space-y-0.5 pr-2">
                      <span className="font-medium text-xs">Rückerstattung erfassen</span>
                      <p className="text-[10px] text-muted-foreground">Erstattet nur nicht zugeordnetes Geld. Die Rechnung bleibt unverändert – es wird keine Gutschrift erstellt. Ohne diese Option bleibt die Überzahlung als Guthaben stehen.</p>
                    </div>
                    <Switch checked={overpaymentProcessRefund} onCheckedChange={setOverpaymentProcessRefund} />
                  </div>

                  {overpaymentProcessRefund && (
                    <div className="animate-in fade-in-50">
                      <Label className="text-xs font-medium">Erstattungsmodus</Label>
                      <Select value={overpaymentRefundMode} onValueChange={(v) => setOverpaymentRefundMode(v as 'manual' | 'gateway')}>
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manuell erfasst (Rückzahlung bereits selbst ausgeführt)</SelectItem>
                          <SelectItem value="gateway">Über PayPal erstatten (nur PayPal-Zahlungen)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </div>
              <div className="p-6 pt-0 mt-3">
                <Button
                  size="sm"
                  className="w-full bg-[#f5c800] text-[#1a2a5e] hover:bg-[#e0b800] font-medium"
                  disabled={isReconcilingOverpayment || !overpaymentBookingId.trim()}
                  onClick={onReconcileOverpaymentHandler}
                >
                  {isReconcilingOverpayment ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Wird ausgeglichen...
                    </>
                  ) : (
                    <>
                      <Wallet className="mr-1.5 h-3.5 w-3.5" />
                      {overpaymentProcessRefund ? 'Überzahlung erstatten' : 'Überzahlung prüfen'}
                    </>
                  )}
                </Button>
              </div>
            </Card>

            <Card className="border-[#d8dce6] shadow-sm flex flex-col justify-between">
              <div>
                <CardHeader className="bg-[#1a2a5e] rounded-t-lg py-3">
                  <CardTitle className="text-sm flex items-center justify-between" style={{ color: "#f5c800" }}>
                    <span className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Zahlungsaufforderung senden
                    </span>
                    <Badge variant="outline" className="text-[10px] border-[#f5c800]/40 text-[#f5c800] py-0 px-1.5 h-4 font-normal">
                      Per E-Mail (kein PayPal-Auftrag)
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs font-medium">Buchungs-/Rechnungsnummer oder Kunde</Label>
                      {loadingPaymentRequestOverview && (
                        <span className="flex items-center text-[10px] text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin mr-1 text-primary" />
                          Prüfe Restforderung...
                        </span>
                      )}
                    </div>
                    <BookingSearchAutocomplete
                      value={paymentRequestBookingId}
                      onChange={(val) => {
                        setPaymentRequestBookingId(val);
                        if (!matchesSelectedBooking(val, selectedPaymentRequestBooking)) {
                          setSelectedPaymentRequestBooking(null);
                          setPaymentRequestOverview(null);
                          setPaymentRequestInvoice(null);
                          setPaymentRequestAmount('');
                          setPaymentRequests([]);
                          setPaymentRequestsAvailable(true);
                        }
                      }}
                      onSelectItem={onSelectPaymentRequestBooking}
                      placeholder="Buchung, Rechnungsnr. (z.B. INV-2026-0001) oder Kunde suchen..."
                      type="booking"
                      allowInvoiceTarget
                    />
                  </div>

                  {/* Selected Booking Info Box */}
                  {paymentRequestInvoice && (
                    <div className="p-2.5 rounded-md border bg-muted/40 space-y-1 animate-in fade-in-50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground truncate">
                          Rechnung {paymentRequestInvoice.invoiceNumber} · {paymentRequestInvoice.customerName}
                        </span>
                        {getInvoiceOpenAmount(paymentRequestInvoice) > 0.009 ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] h-4 px-1.5">
                            Offen: {formatCurrencyValue(getInvoiceOpenAmount(paymentRequestInvoice))}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">Kein offener Betrag</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                        <div>Rechnungsbetrag: <span className="font-semibold text-foreground">{formatCurrencyValue(Number(paymentRequestInvoice.invoiceGrossTotal ?? paymentRequestInvoice.total ?? 0))}</span></div>
                        <div>Bezahlt: <span className="font-semibold text-foreground">{formatCurrencyValue(getInvoicePaidAmount(paymentRequestInvoice))}</span></div>
                      </div>
                      {paymentRequestInvoice.customerEmail && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                          <Mail className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{paymentRequestInvoice.customerEmail}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {!paymentRequestInvoice && (selectedPaymentRequestBooking || paymentRequestOverview) && (
                    <div className="p-2.5 rounded-md border bg-muted/40 space-y-1.5 animate-in fade-in-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-medium text-foreground truncate">
                          <User className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate">
                            {selectedPaymentRequestBooking ? getSearchResultCustomerName(selectedPaymentRequestBooking) : 'Kunde'}
                          </span>
                        </div>
                        {paymentRequestOverview?.summary?.openOrderBalance && paymentRequestOverview.summary.openOrderBalance > 0 ? (
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-amber-200 text-[10px] h-4 px-1.5">
                            Offen: {formatCurrencyValue(paymentRequestOverview.summary.openOrderBalance)}
                          </Badge>
                        ) : paymentRequestOverview ? (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">
                            Keine Restforderung
                          </Badge>
                        ) : null}
                      </div>

                      {selectedPaymentRequestBooking && getSearchResultCustomerEmail(selectedPaymentRequestBooking) && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                          <Mail className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{getSearchResultCustomerEmail(selectedPaymentRequestBooking)}</span>
                        </div>
                      )}

                      {paymentRequestOverview && (
                        <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                          <div>Auftrag: <span className="font-semibold text-foreground">{formatCurrencyValue(paymentRequestOverview.summary.orderValue)}</span></div>
                          <div>Bezahlt: <span className="font-semibold text-foreground">{formatCurrencyValue(paymentRequestOverview.summary.receivedTotal)}</span></div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <Label className="text-xs font-medium">Betrag (€ optional)</Label>
                    <Input
                      value={paymentRequestAmount}
                      onChange={(e) => setPaymentRequestAmount(e.target.value)}
                      placeholder="Auto (gesamter offener Betrag)"
                      className="h-8 text-xs mt-1 font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-medium">Hinweis / Notiz</Label>
                    <Textarea
                      value={paymentRequestNote}
                      onChange={(e) => setPaymentRequestNote(e.target.value)}
                      placeholder="Nachricht an den Kunden..."
                      className="text-xs min-h-[60px] mt-1"
                    />
                  </div>

                  {/* ── Verlauf: wofuer wurde bereits eine Zahlungsaufforderung gesendet? ── */}
                  <div className="rounded-md border p-2 bg-background space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Gesendete Zahlungsaufforderungen</span>
                      {loadingPaymentRequests && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                    </div>

                    {!selectedPaymentRequestBooking && !paymentRequests.length ? (
                      <p className="text-[11px] text-muted-foreground">
                        Buchung oder Rechnung auswählen, um den Verlauf zu sehen.
                      </p>
                    ) : !paymentRequestsAvailable ? (
                      <p className="text-[11px] text-amber-700">
                        Der Verlauf wird von dieser Serverversion noch nicht bereitgestellt.
                        Bereits gesendete Aufforderungen können daher nicht angezeigt werden.
                      </p>
                    ) : paymentRequests.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        Hierfür wurde noch keine Zahlungsaufforderung versendet.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {paymentRequests.map((req) => (
                          <div key={req._id} className="rounded border border-border/60 p-1.5 text-[11px]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-foreground">
                                {formatCurrencyValue(Number(req.amount || 0))}
                              </span>
                              <Badge
                                variant="outline"
                                className={
                                  req.status === 'accepted_by_provider'
                                    ? 'h-4 px-1.5 text-[10px] border-emerald-200 bg-emerald-50 text-emerald-800'
                                    : req.status === 'failed'
                                      ? 'h-4 px-1.5 text-[10px] border-red-200 bg-red-50 text-red-800'
                                      : req.status === 'skipped_no_recipient'
                                        ? 'h-4 px-1.5 text-[10px] border-amber-200 bg-amber-50 text-amber-800'
                                        : 'h-4 px-1.5 text-[10px] text-muted-foreground'
                                }
                              >
                                {req.status === 'accepted_by_provider'
                                  ? 'Übergeben'
                                  : req.status === 'failed'
                                    ? 'Fehlgeschlagen'
                                    : req.status === 'skipped_no_recipient'
                                      ? 'Keine E-Mail-Adresse'
                                      : 'Offen'}
                              </Badge>
                            </div>
                            <div className="text-muted-foreground">
                              {formatDateTime(req.requestedAt)}
                              {req.invoiceNumber && <span> · Beleg {req.invoiceNumber}</span>}
                            </div>
                            <div className="text-muted-foreground">
                              Kanal: E-Mail mit Link zur Rechnung (kein PayPal-Zahlungsauftrag)
                              {req.targetType === 'invoice' ? ' · für diese Rechnung' : ' · für die Buchung'}
                            </div>
                            {req.recipientEmail && (
                              <div className="truncate text-muted-foreground">An: {req.recipientEmail}</div>
                            )}
                            {req.note && (
                              <div className="truncate text-muted-foreground">
                                „{req.note}“
                                {req.status === 'accepted_by_provider' && (
                                  <span className={req.noteDelivered ? 'text-emerald-700' : 'text-amber-700'}>
                                    {req.noteDelivered ? ' · Text mitgesendet' : ' · Text NICHT mitgesendet'}
                                  </span>
                                )}
                              </div>
                            )}
                            {req.error && <div className="text-red-700">{req.error}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </div>
              <div className="p-6 pt-0 mt-3">
                <Button
                  size="sm"
                  className="w-full bg-[#f5c800] text-[#1a2a5e] hover:bg-[#e0b800] font-medium"
                  disabled={isSendingPaymentRequest || !paymentRequestBookingId.trim()}
                  onClick={onRequestAdditionalPaymentHandler}
                >
                  {isSendingPaymentRequest ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Wird gesendet...
                    </>
                  ) : (
                    <>
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      Zahlungsaufforderung senden
                    </>
                  )}
                </Button>
              </div>
            </Card>

            <Card className="border-[#d8dce6] shadow-sm flex flex-col justify-between">
              <div>
                <CardHeader className="bg-[#1a2a5e] rounded-t-lg py-3">
                  <CardTitle className="text-sm flex items-center justify-between" style={{ color: "#f5c800" }}>
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Finanzdaten synchronisieren
                    </span>
                    <Badge variant="outline" className="text-[10px] border-[#f5c800]/40 text-[#f5c800] py-0 px-1.5 h-4 font-normal">
                      Positions-Abgleich
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-xs">
                  <div>
                    <Label className="text-xs font-medium">Typ</Label>
                    <Select
                      value={syncType}
                      onValueChange={(v) => {
                        const newType = v as 'booking' | 'order';
                        setSyncType(newType);
                        setSyncBookingId('');
                        setSelectedSyncItem(null);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="booking">Buchung (Booking)</SelectItem>
                        <SelectItem value="order">Bestellung (Order)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-medium">
                      {syncType === 'booking' ? 'Buchungs-ID / Kunde' : 'Bestell-ID / Kunde'}
                    </Label>
                    <div className="mt-1">
                      <BookingSearchAutocomplete
                        key={syncType}
                        value={syncBookingId}
                        onChange={(val) => {
                          setSyncBookingId(val);
                          if (!val) setSelectedSyncItem(null);
                        }}
                        onSelectItem={onSelectSyncItem}
                        placeholder={syncType === 'booking' ? 'Buchung suchen (z.B. BKG-... oder Kunde)...' : 'Bestellung suchen (z.B. ORD-... oder Kunde)...'}
                        type={syncType}
                      />
                    </div>
                  </div>

                  {/* Selected Sync Item Info Box */}
                  {selectedSyncItem && (
                    <div className="p-2.5 rounded-md border bg-muted/40 space-y-1.5 animate-in fade-in-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-medium text-foreground truncate">
                          <User className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate">{getSearchResultCustomerName(selectedSyncItem)}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          {selectedSyncItem.status || 'Status'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                        <div>Typ: <span className="font-semibold text-foreground">{syncType === 'booking' ? 'Buchung' : 'Bestellung'}</span></div>
                        <div>Wert: <span className="font-semibold text-foreground">{formatCurrencyValue(selectedSyncItem.totalCost || selectedSyncItem.cost || 0)}</span></div>
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground">
                    Synchronisiert Auftragswertänderungen mit zugehörigen Rechnungen, Zahlungsallokationen und Mahnstufen.
                  </p>
                </CardContent>
              </div>
              <div className="p-6 pt-0 mt-3">
                <Button
                  size="sm"
                  className="w-full bg-[#f5c800] text-[#1a2a5e] hover:bg-[#e0b800] font-medium"
                  disabled={isSyncingFinancials || !syncBookingId.trim()}
                  onClick={onSyncBookingFinancialsHandler}
                >
                  {isSyncingFinancials ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Synchronisiere...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Synchronisieren
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        )}

        <TabsContent value="gateways" className="space-y-4">
          <Card className="border-[#d8dce6]">
            <CardHeader className="bg-[#1a2a5e] rounded-t-lg">
              <CardTitle style={{ color: "#f5c800" }}>{t('financialManagement.paymentGateways')}</CardTitle>
              <CardDescription className="text-[#c8d0e7]">Aktive Zahlungsmethoden, API-Zugangsdaten und Konditionen verwalten.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                {gateways.map((gateway) => (
                  <div key={gateway._id} className="rounded-lg border border-[#d8dce6] p-4 bg-[#f8f9fc]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-[#1a2a5e] text-base">{gateway.name}</div>
                      <Badge className={gateway.isActive ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}>
                        {gateway.isActive ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground mb-3">
                      <div>Provider: <span className="font-medium text-[#1a2a5e]">{gateway.provider}</span></div>
                      <div>Währung: <span className="font-medium text-[#1a2a5e]">{gateway.configuration?.currency || 'EUR'}</span></div>
                      <div>Gebühr: <span className="font-medium text-[#1a2a5e]">{gateway.configuration?.processingFee || 0}%</span></div>
                      <div>Unterstützte Methoden: <span className="font-medium text-[#1a2a5e]">{gateway.supportedMethods?.join(', ') || '-'}</span></div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-[#1a2a5e] text-[#1a2a5e]"
                      onClick={() => {
                        setSelectedGateway({
                          ...gateway,
                          configuration: { ...gateway.configuration }
                        });
                        setGatewayDialogOpen(true);
                      }}
                    >
                      <Settings className="mr-1.5 h-3.5 w-3.5" />Einstellungen &amp; API-Keys
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card className="border-[#d8dce6]">
            <CardHeader className="bg-[#1a2a5e] rounded-t-lg">
              <CardTitle style={{ color: "#f5c800" }}>{t('financialManagement.reportsAndKpis')}</CardTitle>
              <CardDescription className="text-[#c8d0e7]">{t('financialManagement.reportsAndKpisDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-4 text-sm">
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="text-xs text-muted-foreground">{t('financialManagement.revenue')}</div>
                  <div className="text-lg font-bold text-[#1a2a5e]">{formatCurrencyValue(report?.totalRevenue || 0)}</div>
                </div>
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="text-xs text-muted-foreground">{t('financialManagement.kpiRefunds')}</div>
                  <div className="text-lg font-bold text-purple-700">{formatCurrencyValue(report?.refundAmount || 0)}</div>
                </div>
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="text-xs text-muted-foreground">{t('financialManagement.disputes')}</div>
                  <div className="text-lg font-bold text-amber-700">{formatCurrencyValue(report?.disputeAmount || 0)}</div>
                </div>
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="text-xs text-muted-foreground">{t('financialManagement.netProfit')}</div>
                  <div className="text-lg font-bold text-green-700">{formatCurrencyValue(report?.netProfit || 0)}</div>
                </div>
              </div>

              {report?.paymentMethodBreakdown && report.paymentMethodBreakdown.length > 0 && (
                <div className="space-y-2">
                  <div className="font-medium text-[#1a2a5e] text-sm">{t('financialManagement.paymentMethodBreakdown')}</div>
                  <div className="overflow-x-auto rounded-lg border border-[#d8dce6]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('financialManagement.paymentMethod')}</TableHead>
                          <TableHead>{t('financialManagement.amount')}</TableHead>
                          <TableHead>{t('financialManagement.sharePercentage')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.paymentMethodBreakdown.map((item, idx) => (
                          <TableRow key={`report-pm-${idx}`}>
                            <TableCell className="font-medium">{getPaymentMethodLabel(item.method, t)}</TableCell>
                            <TableCell>{formatCurrencyValue(item.amount)}</TableCell>
                            <TableCell>{item.percentage?.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dunning" className="space-y-4">
          <Card className="border-[#d8dce6]">
            <CardHeader className="bg-[#1a2a5e] rounded-t-lg">
              <CardTitle style={{ color: "#f5c800" }}>{t('financialManagement.savedDunningRuns')}</CardTitle>
              <CardDescription className="text-[#c8d0e7]">{t('financialManagement.savedDunningRunsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="md:col-span-2">
                  <Label>{t('financialManagement.selectDunningRun')}</Label>
                  <Select
                    value={selectedDunningRunId || 'none'}
                    onValueChange={(value) => {
                      if (value === 'none') {
                        setSelectedDunningRunId('');
                        hydrateQueueFromRun(null);
                        return;
                      }
                      onLoadDunningRun(value);
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder={t('financialManagement.selectDunningRun')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('financialManagement.noRunSelected')}</SelectItem>
                      {dunningRuns.map((run) => (
                        <SelectItem key={run._id} value={run._id}>
                          {run.name} · {getDunningStatusLabel(run.status, t)} · {run.items?.length || 0} Faelle
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button variant="outline" className="w-full" onClick={fetchFinancialData}><RefreshCw className="mr-2 h-4 w-4" />{t('financialManagement.reloadRuns')}</Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!selectedDunningRunId}
                  onClick={async () => {
                    if (!selectedDunningRunId) return;
                    const res = await getDunningRunById(selectedDunningRunId);
                    setSelectedDunningRun(res?.run || null);
                    setDunningRunDetailsOpen(true);
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />{t('financialManagement.activeRunDetails')}
                </Button>
                {selectedDunningRunId && (
                  <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] px-3 py-2 text-sm">
                    {t('financialManagement.activeRun')}: {dunningRuns.find((run) => run._id === selectedDunningRunId)?.name || 'Unbekannt'}
                  </div>
                )}
              </div>

              {selectedDunningRunId && (
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3 text-sm">
                  <div className="mb-2 font-medium text-[#1a2a5e]">{t('financialManagement.runHistory')}</div>
                  <div className="space-y-2">
                    {(dunningRuns.find((run) => run._id === selectedDunningRunId)?.logs || []).slice(-5).reverse().map((log, index) => (
                      <div key={`${log.at || 'log'}-${index}`} className="rounded border border-[#d8dce6] bg-white px-3 py-2">
                        <div className="text-xs text-muted-foreground">{formatDateTime(log.at)} · {log.type}</div>
                        <div>{log.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-[#d8dce6]">
            <CardHeader className="bg-[#1a2a5e] rounded-t-lg">
              <CardTitle style={{ color: "#f5c800" }}>{t('financialManagement.manualDunningBuilder')}</CardTitle>
              <CardDescription className="text-[#c8d0e7]">{t('financialManagement.manualDunningBuilderDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label>{t('financialManagement.runName')}</Label>
                  <Input value={dunningRunName} onChange={(e) => setDunningRunName(e.target.value)} placeholder="z.B. Mahnlauf Ende Monat" />
                </div>
                <div>
                  <Label>{t('financialManagement.defaultEscalationStatus')}</Label>
                  <Select value={dunningDefaultStatus} onValueChange={(value) => setDunningDefaultStatus(value as InvoiceStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="overdue">{t('financialManagement.invoiceStatuses.overdue')}</SelectItem>
                      <SelectItem value="pending_approval">{t('financialManagement.invoiceStatuses.pending_approval')}</SelectItem>
                      <SelectItem value="sent">{t('financialManagement.invoiceStatuses.sent')}</SelectItem>
                      <SelectItem value="partially_paid">{t('financialManagement.invoiceStatuses.partially_paid')}</SelectItem>
                      <SelectItem value="cancelled">{t('financialManagement.invoiceStatuses.cancelled')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('financialManagement.defaultNote')}</Label>
                  <Input value={dunningDefaultNote} onChange={(e) => setDunningDefaultNote(e.target.value)} placeholder="Notiz fuer Statuswechsel" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={onSelectAllOverdue}><ListChecks className="mr-2 h-4 w-4" />{t('financialManagement.selectAllOverdue')}</Button>
                <Button variant="outline" onClick={onClearDunningSelection}><XCircle className="mr-2 h-4 w-4" />{t('financialManagement.clearSelection')}</Button>
                <Button onClick={onCreateManualDunningRun} className="bg-[#f5c800] text-[#1a2a5e] hover:bg-[#e0b800]"><PlayCircle className="mr-2 h-4 w-4" />{t('financialManagement.createRunFromSelection')}</Button>
                <Button variant="outline" onClick={onExecuteDunningQueue} disabled={dunningExecuting || dunningPaused}><Send className="mr-2 h-4 w-4" />{t('financialManagement.startAutoProcessing')}</Button>
                <Button variant="outline" onClick={onToggleDunningPause}>
                  {dunningPaused ? <PlayCircle className="mr-2 h-4 w-4" /> : <PauseCircle className="mr-2 h-4 w-4" />}
                  {dunningPaused ? t('financialManagement.resume') : t('financialManagement.pause')}
                </Button>
                <Button variant="outline" onClick={onRunDunning}><Mail className="mr-2 h-4 w-4" />{t('financialManagement.systemDunningRun')}</Button>
              </div>

              <div className="rounded-md border border-[#d8dce6] p-3 text-sm text-muted-foreground">
                Ausgewaehlt: {dunningSelection.length} · In Queue: {dunningQueue.length} · Laufstatus: {dunningPaused ? t('financialManagement.dunningStatuses.paused') : dunningExecuting ? t('financialManagement.dunningStatuses.processing') : 'Bereit'}
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#d8dce6]">
            <CardHeader className="bg-[#1a2a5e] rounded-t-lg">
              <CardTitle style={{ color: "#f5c800" }}>{t('financialManagement.overdueInvoices')}</CardTitle>
              <CardDescription className="text-[#c8d0e7]">{t('financialManagement.overdueInvoicesDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-[#d8dce6]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[56px]">Auswahl</TableHead>
                      <TableHead>{t('financialManagement.invoices')}</TableHead>
                      <TableHead>{t('financialManagement.customer')}</TableHead>
                      <TableHead>{t('financialManagement.originalDueDate')}</TableHead>
                      <TableHead>{t('financialManagement.daysOverdue')}</TableHead>
                      <TableHead>Mahnstufe</TableHead>
                      <TableHead>{t('financialManagement.nextDueDate')}</TableHead>
                      <TableHead>{t('financialManagement.openAmount')}</TableHead>
                      <TableHead className="text-right">{t('financialManagement.interaction')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dunningEligibleInvoices.map((invoice) => (
                      <TableRow key={`dunning-overdue-${invoice._id}`}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={dunningSelection.includes(invoice._id)}
                            onChange={() => toggleDunningSelection(invoice._id)}
                            className="h-4 w-4"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{invoice.invoiceNumber}</span>
                            {invoice.isCreditNote && <Badge variant="outline">{t('financialManagement.creditNote')}</Badge>}
                          </div>
                          {invoice.isCreditNote && invoice.creditNoteOf && (
                            <div className="text-xs text-muted-foreground">Original: {formatReferenceValue(invoice.creditNoteOf)}</div>
                          )}
                        </TableCell>
                        <TableCell>{invoice.customerName}</TableCell>
                        <TableCell>{formatDate(invoice.dunning?.originalDueDate || invoice.originalDueDate || invoice.dueDate)}</TableCell>
                        <TableCell>{invoice.dunning ? invoice.dunning.daysOverdue : getDaysPastDue(invoice.originalDueDate || invoice.dueDate)} Tage</TableCell>
                        <TableCell>
                          <div>{invoice.dunning?.currentStageLabel || '-'}</div>
                          {invoice.dunning?.lastFailure && (
                            <div className="text-xs text-red-700">Letzter Versand fehlgeschlagen ({formatDate(invoice.dunning.lastFailure.at || undefined)}): {invoice.dunning.lastFailure.error}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {invoice.dunningStage === 'collection'
                            ? t('financialManagement.collection')
                            : formatDate(invoice.dunning?.nextEligibleDate || invoice.nextDunningDueDate)}
                          {invoice.dunning && (
                            <div className={`text-xs ${invoice.dunning.eligible ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                              {invoice.dunning.eligible ? `Fällig: ${invoice.dunning.nextStageLabel || 'nächste Stufe'}` : invoice.dunning.reason}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{formatCurrency(invoice.dunning ? invoice.dunning.openAmount : getInvoiceOpenAmount(invoice))}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openInvoiceDetails(invoice)}><Eye className="mr-1 h-3.5 w-3.5" />{t('common.details', 'Details')}</Button>
                            <Button size="sm" variant="outline" onClick={() => onDunningSendReminder(invoice._id)}><Send className="mr-1 h-3.5 w-3.5" />{t('financialManagement.send')}</Button>
                            <Button size="sm" variant="outline" onClick={() => onDunningEscalateInvoice(invoice._id)}><AlertTriangle className="mr-1 h-3.5 w-3.5" />{t('financialManagement.escalate')}</Button>
                            <Button size="sm" variant="outline" disabled={invoice.dunningStage === 'collection'} onClick={() => onActivateCollection(invoice._id)}>{t('financialManagement.collection')}</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {dunningEligibleInvoices.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">Keine überfälligen Rechnungen mit offener Forderung vorhanden.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#d8dce6]">
            <CardHeader className="bg-[#1a2a5e] rounded-t-lg">
              <CardTitle style={{ color: "#f5c800" }}>{t('financialManagement.activeDunningRun')}</CardTitle>
              <CardDescription className="text-[#c8d0e7]">{t('financialManagement.activeDunningRunDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-[#d8dce6]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('financialManagement.invoices')}</TableHead>
                      <TableHead>{t('financialManagement.customer')}</TableHead>
                      <TableHead>{t('financialManagement.openAmount')}</TableHead>
                      <TableHead>{t('financialManagement.status')}</TableHead>
                      <TableHead>{t('financialManagement.notes')}</TableHead>
                      <TableHead className="text-right">{t('financialManagement.interaction')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dunningQueue.map((item) => (
                      <TableRow key={`dunning-queue-${item.invoiceId}`}>
                        <TableCell>{item.invoiceNumber}</TableCell>
                        <TableCell>{item.customerName}</TableCell>
                        <TableCell>{formatCurrency(item.amountOpen)}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              item.status === 'failed'
                                ? 'bg-red-100 text-red-700 border-red-200'
                                : item.status === 'sent'
                                  ? 'bg-blue-100 text-blue-700 border-blue-200'
                                  : item.status === 'escalated'
                                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                                    : item.status === 'skipped'
                                      ? 'bg-slate-100 text-slate-700 border-slate-200'
                                      : item.status === 'processing'
                                        ? 'bg-cyan-100 text-cyan-700 border-cyan-200'
                                        : 'bg-gray-100 text-gray-700 border-gray-200'
                            }
                          >
                            {getDunningStatusLabel(item.status, t)}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.note || '-'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => onDunningSendReminder(item.invoiceId)}><Send className="mr-1 h-3.5 w-3.5" />{t('financialManagement.resend')}</Button>
                            <Button size="sm" variant="outline" onClick={() => onDunningEscalateInvoice(item.invoiceId)}><AlertTriangle className="mr-1 h-3.5 w-3.5" />{t('financialManagement.changeStatus')}</Button>
                            <Button size="sm" variant="outline" onClick={() => onDunningSkipItem(item.invoiceId)}><SkipForward className="mr-1 h-3.5 w-3.5" />{t('financialManagement.skip')}</Button>
                            <Button size="sm" variant="outline" onClick={() => onDunningRemoveItem(item.invoiceId)}><XCircle className="mr-1 h-3.5 w-3.5" />{t('financialManagement.remove')}</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {dunningQueue.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">{t('financialManagement.noActiveDunningRun')}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="settings" className="space-y-4">
          <Card className="border-[#d8dce6]">
            <CardHeader className="bg-[#1a2a5e] rounded-t-lg"><CardTitle style={{ color: "#f5c800" }}>{t('financialManagement.paymentGateways')}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {gateways.map((gateway) => (
                <div key={gateway._id} className="rounded-md border border-[#d8dce6] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-[#1a2a5e]">{gateway.name}</div>
                      <div className="text-xs text-muted-foreground">{gateway.provider} · {gateway.configuration.currency} · Fee {gateway.configuration.processingFee}</div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedGateway({
                          ...gateway,
                          configuration: { ...gateway.configuration }
                        });
                        setGatewayDialogOpen(true);
                      }}
                    >
                      <Settings className="mr-1 h-3.5 w-3.5" />Konfigurieren
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-[#d8dce6]">
            <CardHeader className="bg-[#1a2a5e] rounded-t-lg">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle style={{ color: "#f5c800" }}>{t('financialManagement.billingPaymentParams')}</CardTitle>
                  <CardDescription className="text-[#c8d0e7]">
                    {t('financialManagement.billingPaymentParamsDesc')}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>{t('financialManagement.lastModified')}: {systemConfig?.updatedAt ? formatDateTime(systemConfig.updatedAt) : '-'}</span>
                  <Button className="bg-[#f5c800] text-[#1a2a5e] hover:bg-[#e0b800]" onClick={onSaveFinancialSettings} disabled={savingFinancialSettings || !systemConfig}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${savingFinancialSettings ? 'animate-spin' : ''}`} />{t('common.save')}
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="border-[#d8dce6]">
              <CardHeader className="bg-[#1a2a5e] rounded-t-lg">
                <CardTitle style={{ color: "#f5c800" }}>{t('financialManagement.taxCurrencyDeadlines')}</CardTitle>
                <CardDescription className="text-[#c8d0e7]">{t('financialManagement.taxCurrencyDeadlinesDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <div>
                    <Label>{t('financialManagement.defaultCurrency')}</Label>
                    <Input value={financialSettings.defaults.currency} onChange={(e) => updateFinancialSetting('defaults', 'currency', e.target.value.toUpperCase())} maxLength={3} />
                  </div>
                  <div>
                    <Label>Locale</Label>
                    <Input value={financialSettings.defaults.locale} onChange={(e) => updateFinancialSetting('defaults', 'locale', e.target.value)} placeholder="de-DE" />
                  </div>
                  <div>
                    <Label>{t('financialManagement.taxRate')}</Label>
                    <Input type="number" value={financialSettings.defaults.taxRate} onChange={(e) => updateFinancialSetting('defaults', 'taxRate', Number(e.target.value || 0))} />
                  </div>
                  <div>
                    <Label>{t('financialManagement.dueDays')}</Label>
                    <Input type="number" value={financialSettings.defaults.paymentDueDays} onChange={(e) => updateFinancialSetting('defaults', 'paymentDueDays', Number(e.target.value || 0))} />
                  </div>
                </div>

                <div>
                  <Label>{t('financialManagement.defaultPaymentTerms')}</Label>
                  <Input value={financialSettings.defaults.paymentTerms} onChange={(e) => updateFinancialSetting('defaults', 'paymentTerms', e.target.value)} />
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <div>
                    <Label>{t('financialManagement.invoicePrefix')}</Label>
                    <Input value={financialSettings.defaults.invoicePrefix} onChange={(e) => updateFinancialSetting('defaults', 'invoicePrefix', e.target.value)} />
                  </div>
                  <div>
                    <Label>{t('financialManagement.creditNotePrefix')}</Label>
                    <Input value={financialSettings.defaults.creditNotePrefix} onChange={(e) => updateFinancialSetting('defaults', 'creditNotePrefix', e.target.value)} />
                  </div>
                </div>

                <div>
                  <Label>{t('financialManagement.defaultPaymentMethod')}</Label>
                  <Select
                    value={financialSettings.defaults.defaultPaymentMethod}
                    onValueChange={(value) => updateFinancialSetting('defaults', 'defaultPaymentMethod', value as FinancialSettingsState['defaults']['defaultPaymentMethod'])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">{t('financialManagement.paymentMethods.bank_transfer')}</SelectItem>
                      <SelectItem value="credit_card">{t('financialManagement.paymentMethods.credit_card')}</SelectItem>
                      <SelectItem value="debit_card">{t('financialManagement.paymentMethods.debit_card')}</SelectItem>
                      <SelectItem value="paypal">{t('financialManagement.paymentMethods.paypal')}</SelectItem>
                      <SelectItem value="stripe">{t('financialManagement.paymentMethods.stripe')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#d8dce6]">
              <CardHeader className="bg-[#1a2a5e] rounded-t-lg">
                <CardTitle style={{ color: "#f5c800" }}>{t('financialManagement.discountsAndPaymentLogic')}</CardTitle>
                <CardDescription className="text-[#c8d0e7]">{t('financialManagement.discountsAndPaymentLogicDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <div>
                    <Label>{t('financialManagement.defaultDiscount')}</Label>
                    <Input type="number" value={financialSettings.defaults.defaultDiscount} onChange={(e) => updateFinancialSetting('defaults', 'defaultDiscount', Number(e.target.value || 0))} />
                  </div>
                  <div>
                    <Label>{t('financialManagement.maxDiscount')}</Label>
                    <Input type="number" value={financialSettings.discountPolicy.maxDiscountPercent} onChange={(e) => updateFinancialSetting('discountPolicy', 'maxDiscountPercent', Number(e.target.value || 0))} />
                  </div>
                  <div>
                    <Label>{t('financialManagement.lateFee')}</Label>
                    <Input type="number" value={financialSettings.discountPolicy.lateFeePercent} onChange={(e) => updateFinancialSetting('discountPolicy', 'lateFeePercent', Number(e.target.value || 0))} />
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="flex items-center justify-between"><span className="text-sm">{t('financialManagement.allowManualDiscounts')}</span><Switch checked={financialSettings.discountPolicy.allowManualDiscounts} onCheckedChange={(value) => updateFinancialSetting('discountPolicy', 'allowManualDiscounts', value)} /></div>
                  <div className="flex items-center justify-between"><span className="text-sm">{t('financialManagement.allowPartialPayments')}</span><Switch checked={financialSettings.paymentPreferences.partialPaymentsAllowed} onCheckedChange={(value) => updateFinancialSetting('paymentPreferences', 'partialPaymentsAllowed', value)} /></div>
                  <div className="flex items-center justify-between"><span className="text-sm">{t('financialManagement.autoAttachPdf')}</span><Switch checked={financialSettings.paymentPreferences.autoAttachPdf} onCheckedChange={(value) => updateFinancialSetting('paymentPreferences', 'autoAttachPdf', value)} /></div>
                  <div className="flex items-center justify-between"><span className="text-sm">{t('financialManagement.sendInternalCopy')}</span><Switch checked={financialSettings.paymentPreferences.sendInternalCopy} onCheckedChange={(value) => updateFinancialSetting('paymentPreferences', 'sendInternalCopy', value)} /></div>
                  <div className="flex items-center justify-between"><span className="text-sm">{t('financialManagement.showTaxBreakdown')}</span><Switch checked={financialSettings.paymentPreferences.showTaxBreakdown} onCheckedChange={(value) => updateFinancialSetting('paymentPreferences', 'showTaxBreakdown', value)} /></div>
                  <div className="flex items-center justify-between"><span className="text-sm">{t('financialManagement.showDiscountBreakdown')}</span><Switch checked={financialSettings.paymentPreferences.showDiscountBreakdown} onCheckedChange={(value) => updateFinancialSetting('paymentPreferences', 'showDiscountBreakdown', value)} /></div>
                </div>

                {financialSettings.paymentPreferences.sendInternalCopy && (
                  <div>
                    <Label>{t('financialManagement.internalCopyEmail')}</Label>
                    <Input value={financialSettings.paymentPreferences.internalCopyEmail} onChange={(e) => updateFinancialSetting('paymentPreferences', 'internalCopyEmail', e.target.value)} placeholder="finance@mcrepair.de" />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-[#d8dce6]">
              <CardHeader className="bg-[#1a2a5e] rounded-t-lg">
                <CardTitle style={{ color: "#f5c800" }}>{t('financialManagement.invoiceMetadata')}</CardTitle>
                <CardDescription className="text-[#c8d0e7]">{t('financialManagement.invoiceMetadataDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <div>
                    <Label>{t('financialManagement.senderCompany')}</Label>
                    <Input value={financialSettings.invoiceMetadata.sellerName} onChange={(e) => updateFinancialSetting('invoiceMetadata', 'sellerName', e.target.value)} />
                  </div>
                  <div>
                    <Label>VAT / USt-ID</Label>
                    <Input value={financialSettings.invoiceMetadata.sellerVatId} onChange={(e) => updateFinancialSetting('invoiceMetadata', 'sellerVatId', e.target.value)} />
                  </div>
                  <div>
                    <Label>{t('financialManagement.registrationNumber')}</Label>
                    <Input value={financialSettings.invoiceMetadata.sellerRegistrationNumber} onChange={(e) => updateFinancialSetting('invoiceMetadata', 'sellerRegistrationNumber', e.target.value)} />
                  </div>
                  <div>
                    <Label>{t('financialManagement.billingEmail')}</Label>
                    <Input value={financialSettings.invoiceMetadata.issuerEmail} onChange={(e) => updateFinancialSetting('invoiceMetadata', 'issuerEmail', e.target.value)} />
                  </div>
                </div>

                <div>
                  <Label>{t('financialManagement.billingPhone')}</Label>
                  <Input value={financialSettings.invoiceMetadata.issuerPhone} onChange={(e) => updateFinancialSetting('invoiceMetadata', 'issuerPhone', e.target.value)} />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>{t('financialManagement.defaultTheme')}</Label>
                    <Select
                      value={financialSettings.paymentPreferences.defaultVisualTheme}
                      onValueChange={(value) => updateFinancialSetting('paymentPreferences', 'defaultVisualTheme', value as FinancialSettingsState['paymentPreferences']['defaultVisualTheme'])}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="modern">Modern</SelectItem>
                        <SelectItem value="classic">Classic</SelectItem>
                        <SelectItem value="minimal">Minimal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('financialManagement.accentColor')}</Label>
                    <Input type="color" value={financialSettings.paymentPreferences.accentColor} onChange={(e) => updateFinancialSetting('paymentPreferences', 'accentColor', e.target.value)} className="h-10 p-1" />
                  </div>
                </div>

                <div>
                  <Label>{t('financialManagement.invoiceFooter')}</Label>
                  <Textarea value={financialSettings.invoiceMetadata.invoiceFooter} onChange={(e) => updateFinancialSetting('invoiceMetadata', 'invoiceFooter', e.target.value)} className="min-h-[90px]" />
                </div>

                <div>
                  <Label>{t('financialManagement.legalFooter')}</Label>
                  <Textarea value={financialSettings.invoiceMetadata.legalFooter} onChange={(e) => updateFinancialSetting('invoiceMetadata', 'legalFooter', e.target.value)} className="min-h-[90px]" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-[#d8dce6]">
            <CardHeader className="bg-[#1a2a5e] rounded-t-lg">
              <CardTitle style={{ color: "#f5c800" }}>{t('financialManagement.effectOfDefaults')}</CardTitle>
              <CardDescription className="text-[#c8d0e7]">{t('financialManagement.effectOfDefaultsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3"><span className="text-muted-foreground">{t('financialManagement.standardTax')}:</span><div className="font-semibold text-[#1a2a5e]">{financialSettings.defaults.taxRate}%</div></div>
              <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3"><span className="text-muted-foreground">{t('financialManagement.defaultCurrency')}:</span><div className="font-semibold text-[#1a2a5e]">{financialSettings.defaults.currency}</div></div>
              <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3"><span className="text-muted-foreground">{t('financialManagement.paymentTerms')}:</span><div className="font-semibold text-[#1a2a5e]">{financialSettings.defaults.paymentTerms} / {financialSettings.defaults.paymentDueDays} Tage</div></div>
              <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3"><span className="text-muted-foreground">{t('financialManagement.dispatchTheme')}:</span><div className="font-semibold text-[#1a2a5e]">{financialSettings.paymentPreferences.defaultVisualTheme}</div></div>
            </CardContent>
          </Card>
          <Card className="border-[#d8dce6]">
            <CardHeader className="bg-[#1a2a5e] rounded-t-lg"><CardTitle style={{ color: "#f5c800" }}>{t('financialManagement.reportsAndExport')}</CardTitle><CardDescription className="text-[#c8d0e7]">{t('financialManagement.reportsAndExportDesc')}</CardDescription></CardHeader>
          </Card>
          <div className="grid gap-4 lg:grid-cols-4">
            <Card className="border-[#d8dce6]"><CardHeader className="bg-[#1a2a5e] rounded-t-lg"><CardTitle style={{ color: "#f5c800" }}>{t('financialManagement.invoices')} {t('common.export')}</CardTitle></CardHeader><CardContent className="space-y-2"><Button variant="outline" className="w-full" onClick={() => onExport('invoices', 'csv')}><Download className="mr-2 h-4 w-4" />CSV</Button><Button variant="outline" className="w-full" onClick={() => onExport('invoices', 'json')}><Download className="mr-2 h-4 w-4" />JSON</Button></CardContent></Card>
            <Card className="border-[#d8dce6]"><CardHeader className="bg-[#1a2a5e] rounded-t-lg"><CardTitle style={{ color: "#f5c800" }}>{t('financialManagement.payments')} {t('common.export')}</CardTitle></CardHeader><CardContent className="space-y-2"><Button variant="outline" className="w-full" onClick={() => onExport('payments', 'csv')}><Download className="mr-2 h-4 w-4" />CSV</Button><Button variant="outline" className="w-full" onClick={() => onExport('payments', 'json')}><Download className="mr-2 h-4 w-4" />JSON</Button></CardContent></Card>
            <Card className="border-indigo-200 bg-indigo-50/40"><CardHeader className="bg-indigo-900 rounded-t-lg"><CardTitle style={{ color: "#f5c800" }}>ZM-Meldung (Reverse Charge)</CardTitle></CardHeader><CardContent className="space-y-2"><Button variant="outline" className="w-full bg-white border-indigo-300 text-indigo-950 hover:bg-indigo-50" onClick={() => onExport('zm', 'csv')}><Download className="mr-2 h-4 w-4 text-indigo-600" />ZM CSV</Button><Button variant="outline" className="w-full bg-white border-indigo-300 text-indigo-950 hover:bg-indigo-50" onClick={() => onExport('zm', 'json')}><Download className="mr-2 h-4 w-4 text-indigo-600" />ZM JSON</Button></CardContent></Card>
            <Card className="border-[#d8dce6]"><CardHeader className="bg-[#1a2a5e] rounded-t-lg"><CardTitle style={{ color: "#f5c800" }}>{t('financialManagement.reports')}</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-2">{t('financialManagement.revenue')}: {formatCurrency(report?.totalRevenue || 0)}</div><div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-2">Refunds: {formatCurrency(report?.refundAmount || 0)}</div><div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-2">Disputes: {formatCurrency(report?.disputeAmount || 0)}</div></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] p-0 gap-0 overflow-hidden flex flex-col">
          <DialogHeader className="bg-[#1a2a5e] px-6 py-4 rounded-t-lg border-b border-[#0f1d45] shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold" style={{ color: '#f5c800' }}>
              <Plus className="h-5 w-5" />
              {t('financialManagement.createInvoice')}
            </DialogTitle>
            <DialogDescription className="text-blue-200 text-sm">
              {t('financialManagement.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label>Kunde suchen</Label>
              <Input value={customerQuery} onChange={(e) => onSearchCustomers(e.target.value)} placeholder="Name oder E-Mail" />
              {customerResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-md border border-[#d8dce6]">
                  {customerResults.map((c: CustomerSearchResult) => (
                    <button key={c._id} type="button" className="w-full border-b border-[#d8dce6] p-2 text-left hover:bg-[#f8f9fc] last:border-b-0" onClick={() => {
                      const isEuCrossBorder = Boolean(c.vatId && c.country && c.country !== 'DE');
                      setInvoiceForm((prev) => ({
                        ...prev,
                        customerId: c._id,
                        customerName: c.name,
                        customerEmail: c.email,
                        customerVatId: c.vatId || prev.customerVatId,
                        isReverseCharge: isEuCrossBorder ? true : prev.isReverseCharge,
                        taxRate: isEuCrossBorder ? '0' : prev.taxRate,
                        zmRelevant: isEuCrossBorder ? true : prev.zmRelevant,
                      }));
                      setCustomerResults([]);
                      setCustomerQuery(c.name);
                    }}>
                      <div className="font-medium text-[#1a2a5e] flex items-center gap-2">
                        <span>{c.name}</span>
                        {c.vatId && <Badge variant="outline" className="text-[10px] text-indigo-700 bg-indigo-50 border-indigo-200">USt-ID: {c.vatId}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{c.email} {c.country ? `· ${c.country}` : ''}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label>Kunden-ID</Label><Input value={invoiceForm.customerId} onChange={(e) => setInvoiceForm((p) => ({ ...p, customerId: e.target.value }))} /></div>
              <div><Label>Order-ID</Label><Input value={invoiceForm.orderId} onChange={(e) => setInvoiceForm((p) => ({ ...p, orderId: e.target.value }))} /></div>
              <div><Label>Name</Label><Input value={invoiceForm.customerName} onChange={(e) => setInvoiceForm((p) => ({ ...p, customerName: e.target.value }))} /></div>
              <div><Label>E-Mail</Label><Input value={invoiceForm.customerEmail} onChange={(e) => setInvoiceForm((p) => ({ ...p, customerEmail: e.target.value }))} /></div>
              <div><Label>Faelligkeit</Label><Input type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm((p) => ({ ...p, dueDate: e.target.value }))} /></div>
              <div><Label>Zahlungsziel (aus Fälligkeit)</Label><Input value={formatPaymentTermsFromDueDate(invoiceForm.dueDate)} readOnly disabled title="Wird aus dem Fälligkeitsdatum abgeleitet" /></div>
              <div><Label>Steuer %</Label><Input type="number" min="0" max="100" step="0.1" value={invoiceForm.taxRate} disabled={invoiceForm.isReverseCharge} onChange={(e) => setInvoiceForm((p) => ({ ...p, taxRate: e.target.value }))} /></div>
              <div><Label>Rabatt %</Label><Input type="number" min="0" max="100" step="0.1" value={invoiceForm.discount} onChange={(e) => setInvoiceForm((p) => ({ ...p, discount: e.target.value }))} /></div>
            </div>

            {/* Reverse Charge / Innergemeinschaftliche Lieferung Card */}
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold text-indigo-950 flex items-center gap-2">
                    Innergemeinschaftliche Lieferung (Reverse Charge)
                    {invoiceForm.isReverseCharge && (
                      <Badge className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.2">ZM-Relevant</Badge>
                    )}
                  </Label>
                  <p className="text-xs text-indigo-800/80">
                    Steuerschuldnerschaft des Leistungsempfängers (0% MwSt.) gem. § 13b / § 14a UStG
                  </p>
                </div>
                <Switch
                  checked={invoiceForm.isReverseCharge}
                  onCheckedChange={(checked) => {
                    setInvoiceForm((prev) => ({
                      ...prev,
                      isReverseCharge: checked,
                      taxRate: checked ? '0' : String(financialSettings.defaults.taxRate),
                      zmRelevant: checked,
                    }));
                  }}
                />
              </div>

              {invoiceForm.isReverseCharge && (
                <div className="space-y-3 pt-2 border-t border-indigo-200/70">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label className="text-xs font-semibold text-indigo-950">USt-IdNr. des Kunden (Empfänger)</Label>
                      <Input
                        placeholder="z.B. ATU12345678 oder FR12345678901"
                        value={invoiceForm.customerVatId}
                        onChange={(e) => setInvoiceForm((p) => ({ ...p, customerVatId: e.target.value }))}
                        className="bg-white border-indigo-200 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-indigo-950">USt-IdNr. des Ausstellers (Leistender)</Label>
                      <Input
                        placeholder="DE318981969"
                        value={invoiceForm.sellerVatId}
                        onChange={(e) => setInvoiceForm((p) => ({ ...p, sellerVatId: e.target.value }))}
                        className="bg-white border-indigo-200 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-indigo-950">Rechnungshinweis</Label>
                    <Input
                      value={invoiceForm.reverseChargeNotice}
                      onChange={(e) => setInvoiceForm((p) => ({ ...p, reverseChargeNotice: e.target.value }))}
                      className="bg-white border-indigo-200 text-xs"
                    />
                  </div>
                  <div className="rounded bg-indigo-100/70 p-2 text-[11px] text-indigo-950 leading-relaxed">
                    <strong>Hinweis:</strong> Bei aktivierter Option beträgt der Steuerbetrag <strong>0,00 € (0%)</strong>. Beide USt-IdNrn. sowie der gesetzliche Reverse-Charge-Hinweis werden auf der Rechnung ausgewiesen. Dieser Umsatz wird für die <strong>Zusammenfassende Meldung (ZM)</strong> erfasst.
                  </div>
                </div>
              )}
            </div>

            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-[#1a2a5e]">Positionen (Line Items)</Label>
                <Button variant="outline" size="sm" type="button" className="border-[#1a2a5e] text-[#1a2a5e] hover:bg-[#1a2a5e] hover:text-white" onClick={onAddInvoiceLineItem}><Plus className="mr-2 h-4 w-4" />Position hinzufügen</Button>
              </div>
              {invoiceForm.items.map((item, index) => (
                <div key={`line-item-${index}`} className="grid gap-2 rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3 md:grid-cols-12 items-center">
                  <div className="md:col-span-5"><Input placeholder="Bezeichnung / Service Name" value={item.description} onChange={(e) => onUpdateInvoiceLineItem(index, 'description', e.target.value)} className="bg-white" /></div>
                  <div className="md:col-span-2"><Input type="number" min="1" value={item.quantity} onChange={(e) => onUpdateInvoiceLineItem(index, 'quantity', e.target.value)} className="bg-white" placeholder="Menge" /></div>
                  <div className="md:col-span-2"><Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => onUpdateInvoiceLineItem(index, 'unitPrice', e.target.value)} className="bg-white" placeholder="Preis €" /></div>
                  <div className="md:col-span-2">
                    <Select value={item.type} onValueChange={(value) => onUpdateInvoiceLineItem(index, 'type', value as InvoiceItem['type'])}>
                      <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="service">Service</SelectItem>
                        <SelectItem value="addon">Add-On</SelectItem>
                        <SelectItem value="product">Teil</SelectItem>
                        <SelectItem value="fee">Gebuehr</SelectItem>
                        <SelectItem value="discount">Rabatt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-1 text-right">
                    <Button variant="ghost" size="icon" type="button" title="Position entfernen" onClick={() => onRemoveInvoiceLineItem(index)}>
                      <Trash2 className="h-4 w-4 text-red-600 hover:text-red-800" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3 text-sm">
              <div className="flex justify-between"><span>Netto</span><span>{formatCurrencyValue(invoiceDraftTotals.subtotal, invoiceForm.currency)}</span></div>
              {invoiceDraftTotals.discount > 0 && <div className="flex justify-between text-orange-600"><span>Rabatt ({invoiceForm.discount}%)</span><span>-{formatCurrencyValue(invoiceDraftTotals.discount, invoiceForm.currency)}</span></div>}
              <div className="flex justify-between">
                <span>Steuer {invoiceForm.isReverseCharge ? '(0% - Reverse Charge)' : `(${invoiceForm.taxRate}%)`}</span>
                <span>{formatCurrencyValue(invoiceDraftTotals.tax, invoiceForm.currency)}</span>
              </div>
              <div className="mt-1 flex justify-between font-semibold text-[#1a2a5e]"><span>Gesamt</span><span>{formatCurrencyValue(invoiceDraftTotals.total, invoiceForm.currency)}</span></div>
            </div>
            <div><Label>Notiz</Label><Textarea value={invoiceForm.notes} onChange={(e) => setInvoiceForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Interne oder kundenrelevante Notiz zur Rechnung..." /></div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-[#d8dce6] bg-[#f8f9fc] rounded-b-lg shrink-0 flex justify-end gap-2">
            <Button variant="outline" className="border-[#1a2a5e] text-[#1a2a5e] hover:bg-[#1a2a5e] hover:text-white" onClick={() => setInvoiceDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button className="bg-[#f5c800] text-[#1a2a5e] font-semibold hover:bg-[#e0b800]" onClick={onCreateInvoice}>{t('financialManagement.createInvoice')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fromRepairDialogOpen} onOpenChange={setFromRepairDialogOpen}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden flex flex-col">
          <DialogHeader className="bg-[#1a2a5e] px-6 py-4 rounded-t-lg border-b border-[#0f1d45] shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold" style={{ color: '#f5c800' }}>
              <FileSpreadsheet className="h-5 w-5" />
              Rechnung aus RepairOrder-IDs
            </DialogTitle>
            <DialogDescription className="text-blue-200 text-sm">
              Mehrere Reparaturauftrags-IDs kommasepariert eingeben.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4">
            <div className="space-y-2">
              <Label className="font-semibold text-[#1a2a5e]">RepairOrder IDs *</Label>
              <Textarea value={fromRepairForm.repairOrderIds} onChange={(e) => setFromRepairForm((p) => ({ ...p, repairOrderIds: e.target.value }))} placeholder="RO-1001, RO-1002" rows={3} />
              <p className="text-xs text-muted-foreground">Mehrere IDs mit Komma trennen.</p>
            </div>
            <div className="flex items-center justify-between rounded-md border border-indigo-200 bg-indigo-50/60 p-3">
              <div>
                <Label className="text-xs font-semibold text-indigo-950">Innergemeinschaftliche Lieferung (Reverse Charge)</Label>
                <p className="text-[11px] text-indigo-800">Steuerbetrag 0% / ZM-Relevant</p>
              </div>
              <Switch
                checked={fromRepairForm.isReverseCharge}
                onCheckedChange={(checked) => setFromRepairForm((p) => ({ ...p, isReverseCharge: checked, taxRate: checked ? '0' : String(financialSettings.defaults.taxRate) }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Steuer %</Label><Input type="number" disabled={fromRepairForm.isReverseCharge} value={fromRepairForm.taxRate} onChange={(e) => setFromRepairForm((p) => ({ ...p, taxRate: e.target.value }))} /></div>
              <div>
                <Label>Zusatzrabatt (€ brutto, optional)</Label>
                <Input type="number" min="0" step="0.01" value={fromRepairForm.discount} placeholder="0,00" onChange={(e) => setFromRepairForm((p) => ({ ...p, discount: e.target.value }))} />
                <p className="mt-1 text-[11px] text-muted-foreground">Der Kundengruppenrabatt ist bereits im Auftragswert enthalten und wird automatisch übernommen.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Fälligkeit</Label><Input type="date" value={fromRepairForm.dueDate} onChange={(e) => setFromRepairForm((p) => ({ ...p, dueDate: e.target.value }))} /></div>
              <div><Label>Zahlungsziel (aus Fälligkeit)</Label><Input value={formatPaymentTermsFromDueDate(fromRepairForm.dueDate)} readOnly disabled title="Wird aus dem Fälligkeitsdatum abgeleitet; ohne Datum gilt die Frist aus dem Kundenprofil" /></div>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-[#d8dce6] bg-[#f8f9fc] rounded-b-lg shrink-0 flex justify-end gap-2">
            <Button variant="outline" className="border-[#1a2a5e] text-[#1a2a5e] hover:bg-[#1a2a5e] hover:text-white" onClick={() => setFromRepairDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button className="bg-[#f5c800] text-[#1a2a5e] font-semibold hover:bg-[#e0b800]" onClick={onCreateInvoiceFromRepairs}>Generieren</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sendComposerOpen} onOpenChange={setSendComposerOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
          <DialogHeader className="bg-[#1a2a5e] px-6 py-4 rounded-t-lg border-b border-[#0f1d45] shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold" style={{ color: '#f5c800' }}>
              <Send className="h-5 w-5" />
              {sendComposerMode === 'reminder' ? 'Mahnungsversand konfigurieren' : 'Rechnungsversand konfigurieren'}
            </DialogTitle>
            <DialogDescription className="text-blue-200 text-sm">
              Vor dem Versand alle relevanten Inhalte prüfen, Formulierungen bearbeiten und Verrechnungsfunktionen festlegen.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {selectedInvoice && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-[#d8dce6]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base" style={{ color: "#f5c800" }}>Versand & Formulierung</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Empfaenger E-Mail</Label>
                      <Input value={sendComposerForm.recipientEmail} onChange={(e) => setSendComposerForm((p) => ({ ...p, recipientEmail: e.target.value }))} />
                    </div>
                    <div>
                      <Label>CC E-Mail (optional)</Label>
                      <Input value={sendComposerForm.ccEmail} onChange={(e) => setSendComposerForm((p) => ({ ...p, ccEmail: e.target.value }))} />
                    </div>
                  </div>

                  <div>
                    <Label>Betreff</Label>
                    <Input value={sendComposerForm.subject} onChange={(e) => setSendComposerForm((p) => ({ ...p, subject: e.target.value }))} />
                  </div>

                  <div className="grid gap-3">
                    <div>
                      <Label>Anrede</Label>
                      <Input value={sendComposerForm.greeting} onChange={(e) => setSendComposerForm((p) => ({ ...p, greeting: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Einleitungstext</Label>
                      <Textarea value={sendComposerForm.introText} onChange={(e) => setSendComposerForm((p) => ({ ...p, introText: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Zahlungs- und Verrechnungshinweis</Label>
                      <Textarea value={sendComposerForm.paymentInstructions} onChange={(e) => setSendComposerForm((p) => ({ ...p, paymentInstructions: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Schlusstext</Label>
                      <Textarea value={sendComposerForm.closingText} onChange={(e) => setSendComposerForm((p) => ({ ...p, closingText: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Rechtlicher Footer</Label>
                      <Textarea value={sendComposerForm.legalFooter} onChange={(e) => setSendComposerForm((p) => ({ ...p, legalFooter: e.target.value }))} />
                    </div>
                  </div>

                  <div>
                    <Label>Finaler Nachrichtentext (optional manuell)</Label>
                    <Textarea
                      value={sendComposerForm.customMessage}
                      onChange={(e) => setSendComposerForm((p) => ({ ...p, customMessage: e.target.value }))}
                      placeholder="Leer lassen, um die automatische Vorschau zu verwenden."
                      className="min-h-[140px]"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#d8dce6]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base" style={{ color: "#f5c800" }}>Verrechnungsfunktionen & Vorschau</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-2 text-sm">
                    <div className="rounded-md border border-[#d8dce6] p-2">Rechnung: {selectedInvoice.invoiceNumber}</div>
                    <div className="rounded-md border border-[#d8dce6] p-2">Kunde: {selectedInvoice.customerName}</div>
                    <div className="rounded-md border border-[#d8dce6] p-2">Gesamt: {formatCurrency(selectedInvoice.total || 0)}</div>
                    <div className="rounded-md border border-[#d8dce6] p-2">Offen: {formatCurrency(getInvoiceOpenAmount(selectedInvoice))}</div>
                  </div>

                  <div className="grid gap-2 rounded-md border border-[#d8dce6] bg-white p-3 text-sm md:grid-cols-2">
                    <div>
                      <Label>Informationsniveau</Label>
                      <Select value={sendComposerForm.detailLevel} onValueChange={(value) => setSendComposerForm((p) => ({ ...p, detailLevel: value as 'compact' | 'detailed' }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="compact">Kompakt</SelectItem>
                          <SelectItem value="detailed">Detail</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Preview-Format</Label>
                      <Select value={sendComposerForm.previewFormat} onValueChange={(value) => setSendComposerForm((p) => ({ ...p, previewFormat: value as 'html' | 'ascii' }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="html">HTML</SelectItem>
                          <SelectItem value="ascii">ASCII</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Visuelles Theme</Label>
                      <Select value={sendComposerForm.visualTheme} onValueChange={(value) => setSendComposerForm((p) => ({ ...p, visualTheme: value as 'classic' | 'modern' | 'minimal' }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="modern">Modern</SelectItem>
                          <SelectItem value="classic">Classic</SelectItem>
                          <SelectItem value="minimal">Minimal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Schriftgroesse</Label>
                      <Select value={sendComposerForm.fontScale} onValueChange={(value) => setSendComposerForm((p) => ({ ...p, fontScale: value as 'sm' | 'md' | 'lg' }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sm">Kompakt</SelectItem>
                          <SelectItem value="md">Standard</SelectItem>
                          <SelectItem value="lg">Gross</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Akzentfarbe</Label>
                      <Input type="color" value={sendComposerForm.accentColor} onChange={(e) => setSendComposerForm((p) => ({ ...p, accentColor: e.target.value }))} className="h-10 p-1" />
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-[#d8dce6] px-3 py-2"><span>Kompakte Abstaende</span><Switch checked={sendComposerForm.compactSpacing} onCheckedChange={(v) => setSendComposerForm((p) => ({ ...p, compactSpacing: v }))} /></div>
                    <div className="flex items-center justify-between rounded-md border border-[#d8dce6] px-3 py-2"><span>Gesamtsummen hervorheben</span><Switch checked={sendComposerForm.emphasizeTotals} onCheckedChange={(v) => setSendComposerForm((p) => ({ ...p, emphasizeTotals: v }))} /></div>
                    <div className="flex items-center justify-between rounded-md border border-[#d8dce6] px-3 py-2 md:col-span-2"><span>Header-Banner in E-Mail zeigen</span><Switch checked={sendComposerForm.showHeaderBanner} onCheckedChange={(v) => setSendComposerForm((p) => ({ ...p, showHeaderBanner: v }))} /></div>
                  </div>

                  <div className="grid gap-2 rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3 text-sm">
                    <div className="flex items-center justify-between"><span>Positionen auflisten</span><Switch checked={sendComposerForm.includeItems} onCheckedChange={(v) => setSendComposerForm((p) => ({ ...p, includeItems: v }))} /></div>
                    <div className="flex items-center justify-between"><span>Steuerdetails zeigen</span><Switch checked={sendComposerForm.includeTaxBreakdown} onCheckedChange={(v) => setSendComposerForm((p) => ({ ...p, includeTaxBreakdown: v }))} /></div>
                    <div className="flex items-center justify-between"><span>Rabattdetails zeigen</span><Switch checked={sendComposerForm.includeDiscountBreakdown} onCheckedChange={(v) => setSendComposerForm((p) => ({ ...p, includeDiscountBreakdown: v }))} /></div>
                    <div className="flex items-center justify-between"><span>Zahlungsziel einfuegen</span><Switch checked={sendComposerForm.includePaymentTerms} onCheckedChange={(v) => setSendComposerForm((p) => ({ ...p, includePaymentTerms: v }))} /></div>
                    <div className="flex items-center justify-between"><span>Teilzahlung erlauben</span><Switch checked={sendComposerForm.allowPartialPayment} onCheckedChange={(v) => setSendComposerForm((p) => ({ ...p, allowPartialPayment: v }))} /></div>
                    <div className="flex items-center justify-between"><span>Verzugspauschale ausweisen</span><Switch checked={sendComposerForm.applyLateFee} onCheckedChange={(v) => setSendComposerForm((p) => ({ ...p, applyLateFee: v }))} /></div>
                    {sendComposerForm.applyLateFee && (
                      <div>
                        <Label>Verzugspauschale %</Label>
                        <Input type="number" value={sendComposerForm.lateFeePercent} onChange={(e) => setSendComposerForm((p) => ({ ...p, lateFeePercent: e.target.value }))} />
                      </div>
                    )}
                    <div className="flex items-center justify-between"><span>PDF Anhang beilegen</span><Switch checked={sendComposerForm.attachPdf} onCheckedChange={(v) => setSendComposerForm((p) => ({ ...p, attachPdf: v }))} /></div>
                    <div className="flex items-center justify-between"><span>Interne Versandkopie</span><Switch checked={sendComposerForm.sendCopyInternal} onCheckedChange={(v) => setSendComposerForm((p) => ({ ...p, sendCopyInternal: v }))} /></div>
                    {sendComposerForm.sendCopyInternal && (
                      <div>
                        <Label>Interne E-Mail</Label>
                        <Input value={sendComposerForm.internalCopyEmail} onChange={(e) => setSendComposerForm((p) => ({ ...p, internalCopyEmail: e.target.value }))} />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-1 text-sm font-medium text-[#1a2a5e]">Nachrichtenvorschau ({sendComposerForm.previewFormat.toUpperCase()})</div>
                    {sendComposerForm.previewFormat === 'html' ? (
                      <div className="rounded-md border border-[#d8dce6] bg-white p-2 max-h-[340px] overflow-y-auto">
                        <div dangerouslySetInnerHTML={{ __html: sendComposerForm.customMessage.trim() || generatedHtmlPreview }} />
                      </div>
                    ) : (
                      <pre className="rounded-md border border-[#d8dce6] bg-white p-3 text-xs whitespace-pre-wrap max-h-[340px] overflow-y-auto">
                        {sendComposerForm.customMessage.trim() || generatedAsciiPreview}
                      </pre>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-[#d8dce6] bg-[#f8f9fc] rounded-b-lg shrink-0 flex justify-end gap-2">
            <Button variant="outline" className="border-[#1a2a5e] text-[#1a2a5e] hover:bg-[#1a2a5e] hover:text-white" onClick={() => setSendComposerOpen(false)}>{t('common.cancel')}</Button>
            <Button className="bg-[#f5c800] text-[#1a2a5e] font-semibold hover:bg-[#e0b800]" onClick={onSubmitSendComposer}>Jetzt senden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dunningRunDetailsOpen} onOpenChange={setDunningRunDetailsOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
          <DialogHeader className="bg-[#1a2a5e] px-6 py-4 rounded-t-lg border-b border-[#0f1d45] shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold" style={{ color: '#f5c800' }}>
              <ListChecks className="h-5 w-5" />
              Mahnlauf Details
            </DialogTitle>
            <DialogDescription className="text-blue-200 text-sm">
              Vollständige Einsicht in den aktiven Mahnlauf mit Verlauf, Status und Interventionsmöglichkeiten.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {selectedDunningRun && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3"><div className="text-xs text-muted-foreground">Laufname</div><div className="font-semibold text-[#1a2a5e]">{selectedDunningRun.name}</div></div>
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3"><div className="text-xs text-muted-foreground">Status</div><div className="font-semibold text-[#1a2a5e]">{selectedDunningRun.status}</div></div>
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3"><div className="text-xs text-muted-foreground">Faelle</div><div className="font-semibold text-[#1a2a5e]">{selectedDunningRun.items?.length || 0}</div></div>
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3"><div className="text-xs text-muted-foreground">Erstellt</div><div className="font-semibold text-[#1a2a5e]">{formatDateTime(selectedDunningRun.createdAt)}</div></div>
              </div>

              <Card className="border-[#d8dce6]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base" style={{ color: "#f5c800" }}>Laufmanagement</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const nextStatus = selectedDunningRun.status === 'paused' ? 'running' : 'paused';
                      const res = await updateDunningRun(selectedDunningRun._id, {
                        status: nextStatus,
                        logType: nextStatus === 'paused' ? 'paused' : 'resumed',
                        logMessage: nextStatus === 'paused' ? 'Lauf pausiert' : 'Lauf fortgesetzt'
                      });
                      const run = res?.run as DunningRun;
                      setSelectedDunningRun(run);
                      setSelectedDunningRunId(run._id);
                      setDunningPaused(run.status === 'paused');
                      hydrateQueueFromRun(run);
                      setDunningRuns((prev) => [run, ...prev.filter((entry) => entry._id !== run._id)]);
                    }}
                  >
                    {selectedDunningRun.status === 'paused' ? 'Fortsetzen' : 'Pausieren'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const res = await updateDunningRun(selectedDunningRun._id, { status: 'completed', logType: 'completed', logMessage: 'Lauf manuell abgeschlossen' });
                      const run = res?.run as DunningRun;
                      setSelectedDunningRun(run);
                      setDunningRuns((prev) => [run, ...prev.filter((entry) => entry._id !== run._id)]);
                    }}
                  >
                    Lauf abschliessen
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const res = await updateDunningRun(selectedDunningRun._id, { status: 'cancelled', logType: 'cancelled', logMessage: 'Lauf manuell abgebrochen' });
                      const run = res?.run as DunningRun;
                      setSelectedDunningRun(run);
                      setDunningRuns((prev) => [run, ...prev.filter((entry) => entry._id !== run._id)]);
                    }}
                  >
                    Lauf abbrechen
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-[#d8dce6]">
                <CardHeader className="pb-2"><CardTitle className="text-base" style={{ color: "#f5c800" }}>Faelle im Lauf</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-md border border-[#d8dce6]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rechnung</TableHead>
                          <TableHead>Kunde</TableHead>
                          <TableHead>Offen</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Notiz</TableHead>
                          <TableHead className="text-right">Intervention</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(selectedDunningRun.items || []).map((item) => (
                          <TableRow key={`run-item-${String(item.invoiceId)}`}>
                            <TableCell>{item.invoiceNumber}</TableCell>
                            <TableCell>{item.customerName}</TableCell>
                            <TableCell>{formatCurrency(item.amountOpen || 0)}</TableCell>
                            <TableCell><Badge variant="outline">{getDunningStatusLabel(item.status, t)}</Badge></TableCell>
                            <TableCell>{item.note || '-'}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => onDunningSendReminder(String(item.invoiceId))}>{t('financialManagement.send')}</Button>
                                <Button size="sm" variant="outline" onClick={() => onDunningEscalateInvoice(String(item.invoiceId))}>{t('financialManagement.escalate')}</Button>
                                <Button size="sm" variant="outline" onClick={() => onDunningSkipItem(String(item.invoiceId))}>{t('financialManagement.skip')}</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#d8dce6]">
                <CardHeader className="pb-2"><CardTitle className="text-base" style={{ color: "#f5c800" }}>Laufhistorie</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {(selectedDunningRun.logs || []).slice().reverse().map((log, idx) => (
                    <div key={`${log.at || 'log'}-${idx}`} className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                      <div className="text-xs text-muted-foreground">{formatDateTime(log.at)} · {log.type}</div>
                      <div className="text-sm">{log.message}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-[#d8dce6] bg-[#f8f9fc] rounded-b-lg shrink-0 flex justify-end gap-2">
            <Button variant="outline" className="border-[#1a2a5e] text-[#1a2a5e] hover:bg-[#1a2a5e] hover:text-white" onClick={() => setDunningRunDetailsOpen(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dunningCaseDialogOpen} onOpenChange={setDunningCaseDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] p-0 gap-0 overflow-hidden flex flex-col">
          <DialogHeader className="bg-[#1a2a5e] px-6 py-4 rounded-t-lg border-b border-[#0f1d45] shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold" style={{ color: '#f5c800' }}>
              <AlertTriangle className="h-5 w-5" />
              {t('financialManagement.dunningCaseManagement')}
            </DialogTitle>
            <DialogDescription className="text-blue-200 text-sm">
              Strukturierte Detailansicht und direkte Eingriffe für den aktuellen Mahnfall.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="text-xs text-muted-foreground">{t('financialManagement.invoiceNumber')}</div>
                  <div className="font-semibold text-[#1a2a5e]">{selectedInvoice.invoiceNumber}</div>
                </div>
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="text-xs text-muted-foreground">{t('financialManagement.status')}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Badge variant="outline" className={invoiceStatusClass[selectedInvoice.status]}>{getInvoiceStatusLabel(selectedInvoice.status, t)}</Badge>
                    <InvoicePaymentHints invoice={selectedInvoice} />
                  </div>
                </div>
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="text-xs text-muted-foreground">{t('financialManagement.openAmount')}</div>
                  <div className="font-semibold text-red-700">{formatCurrency(getInvoiceOpenAmount(selectedInvoice))}</div>
                </div>
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="text-xs text-muted-foreground">Ueberfaellig seit</div>
                  <div className="font-semibold text-[#1a2a5e]">{getDaysPastDue(selectedInvoice.dueDate)} Tagen</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-[#d8dce6]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base" style={{ color: "#f5c800" }}>Mahnungsdaten</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div><span className="text-muted-foreground">{t('financialManagement.customer')}:</span> {selectedInvoice.customerName}</div>
                    <div><span className="text-muted-foreground">E-Mail:</span> {selectedInvoice.customerEmail}</div>
                    <div><span className="text-muted-foreground">{t('financialManagement.dueDate')}:</span> {formatDate(selectedInvoice.dueDate)}</div>
                    <div><span className="text-muted-foreground">Mahnstufe:</span> {selectedInvoice.dunningLevel ?? 0}</div>
                    <div><span className="text-muted-foreground">Zuletzt erinnert:</span> {formatDate(selectedInvoice.dunningNotifiedAt)}</div>
                    <div><span className="text-muted-foreground">Auftrag:</span> {formatReferenceValue(selectedInvoice.orderId)}</div>
                    <div><span className="text-muted-foreground">Reparaturaufträge:</span> {formatReferenceList(selectedInvoice.repairOrderIds)}</div>
                  </CardContent>
                </Card>

                <Card className="border-[#d8dce6]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base" style={{ color: "#f5c800" }}>Eingriff in Mahnlauf</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <Label>Zielstatus</Label>
                      <Select value={dunningCaseStatus} onValueChange={(value) => setDunningCaseStatus(value as InvoiceStatus)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="overdue">{t('financialManagement.invoiceStatuses.overdue')}</SelectItem>
                          <SelectItem value="pending_approval">{t('financialManagement.invoiceStatuses.pending_approval')}</SelectItem>
                          <SelectItem value="sent">{t('financialManagement.invoiceStatuses.sent')}</SelectItem>
                          <SelectItem value="partially_paid">{t('financialManagement.invoiceStatuses.partially_paid')}</SelectItem>
                          <SelectItem value="cancelled">{t('financialManagement.invoiceStatuses.cancelled')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Notiz fuer Eingriff</Label>
                      <Textarea value={dunningCaseNote} onChange={(e) => setDunningCaseNote(e.target.value)} placeholder="z.B. Kunde telefonisch erreicht" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => onDunningSendReminder(selectedInvoice._id)}><Send className="mr-1 h-3.5 w-3.5" />{t('financialManagement.send')}</Button>
                      <Button size="sm" variant="outline" onClick={() => onDunningCaseStatusChange(selectedInvoice._id, dunningCaseStatus, dunningCaseNote)}><AlertTriangle className="mr-1 h-3.5 w-3.5" />{t('financialManagement.changeStatus')}</Button>
                      <Button size="sm" variant="outline" onClick={() => onAddInvoiceToDunningQueue(selectedInvoice)}><ListChecks className="mr-1 h-3.5 w-3.5" />Zu aktivem Lauf</Button>
                      <Button size="sm" variant="outline" onClick={() => onDunningSkipItem(selectedInvoice._id)}><SkipForward className="mr-1 h-3.5 w-3.5" />{t('financialManagement.skip')}</Button>
                      <Button size="sm" variant="outline" onClick={() => onDunningRemoveItem(selectedInvoice._id)}><XCircle className="mr-1 h-3.5 w-3.5" />{t('financialManagement.remove')}</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-[#d8dce6]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base" style={{ color: "#f5c800" }}>{t('financialManagement.invoiceItems')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-md border border-[#d8dce6]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('financialManagement.descriptionServiceName')}</TableHead>
                          <TableHead>{t('financialManagement.itemType')}</TableHead>
                          <TableHead>{t('financialManagement.quantity')}</TableHead>
                          <TableHead>{t('financialManagement.unitPrice')}</TableHead>
                          <TableHead>{t('financialManagement.total')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(selectedInvoice.items || []).map((item, idx) => (
                          <TableRow key={item._id || `dunning-item-${idx}`}>
                            <TableCell>{getInvoiceItemServiceName(item)}</TableCell>
                            <TableCell>{item.type || '-'}</TableCell>
                            <TableCell>{item.quantity ?? '-'}</TableCell>
                            <TableCell>{formatCurrency(item.unitPrice || 0)}</TableCell>
                            <TableCell>{formatCurrency(item.total || 0)}</TableCell>
                          </TableRow>
                        ))}
                        {(!selectedInvoice.items || selectedInvoice.items.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Keine Positionen vorhanden.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#d8dce6]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base" style={{ color: "#f5c800" }}>Aktivitaets-Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {dunningTimeline.map((entry) => (
                      <div
                        key={entry.id}
                        className={
                          entry.severity === 'critical'
                            ? 'rounded-md border border-red-200 bg-red-50 p-3'
                            : entry.severity === 'warning'
                              ? 'rounded-md border border-amber-200 bg-amber-50 p-3'
                              : entry.severity === 'success'
                                ? 'rounded-md border border-green-200 bg-green-50 p-3'
                                : entry.severity === 'info'
                                  ? 'rounded-md border border-blue-200 bg-blue-50 p-3'
                                  : 'rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3'
                        }
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium text-[#1a2a5e]">{entry.title}</div>
                          <div className="text-xs text-muted-foreground">{formatDateTime(entry.at)}</div>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">{entry.detail}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-[#d8dce6] bg-[#f8f9fc] rounded-b-lg shrink-0 flex justify-end gap-2">
            <Button variant="outline" className="border-[#1a2a5e] text-[#1a2a5e] hover:bg-[#1a2a5e] hover:text-white" onClick={() => {
              setDunningCaseDialogOpen(false);
              setSelectedInvoice(null);
            }}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceDetailsDialogOpen} onOpenChange={setInvoiceDetailsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="bg-[#1a2a5e] px-6 py-4 rounded-t-lg border-b border-[#0f1d45]">
            <DialogTitle className="flex items-center gap-2 text-xl" style={{ color: '#f5c800' }}>
              <FileSpreadsheet className="h-5 w-5" />
              {t('financialManagement.invoiceDetails')}
              {selectedInvoice?.invoiceNumber && (
                <span className="text-base font-normal text-[#c8d0e7]">· {selectedInvoice.invoiceNumber}</span>
              )}
              {selectedInvoice?.isCreditNote && (
                <Badge className="bg-violet-500/90 text-white border border-violet-300 ml-2">{t('financialManagement.creditNote')}</Badge>
              )}
              {selectedInvoice?.isReverseCharge && (
                <Badge className="bg-indigo-600 text-white border border-indigo-300 ml-2">Reverse Charge</Badge>
              )}
              {selectedInvoice?.status === 'credited' && !selectedInvoice?.isCreditNote && (
                <Badge className="bg-orange-500/90 text-white border border-orange-300 ml-2">{t('financialManagement.credited')}</Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-[#c8d0e7]">
              {t('financialManagement.invoiceDetailsDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4">
          {invoiceDetailLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Lade verknuepfte Daten…
            </div>
          )}

          {selectedInvoice && (
            <div className="space-y-4">
              {/* ── Reverse Charge Banner ─────────────────────────────────── */}
              {selectedInvoice.isReverseCharge && (
                <div className="flex items-start gap-3 rounded-md border border-indigo-300 bg-indigo-50 p-3.5 text-sm text-indigo-950">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                  <div className="w-full">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-indigo-950">{t('financialManagement.reverseCharge')}</span>
                      <Badge className="bg-indigo-600 text-white text-[10px] px-2 py-0.5">ZM-Relevant</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-indigo-800">{selectedInvoice.reverseChargeNotice || 'Steuerschuldnerschaft des Leistungsempfängers / Reverse Charge'}</div>
                    <div className="mt-2.5 grid grid-cols-2 gap-3 text-xs bg-white/80 p-2.5 rounded border border-indigo-200">
                      <div><span className="font-semibold text-indigo-950">{t('financialManagement.sellerVatId')}:</span> {selectedInvoice.sellerVatId || 'DE318981969'}</div>
                      <div><span className="font-semibold text-indigo-950">{t('financialManagement.customerVatId')}:</span> {selectedInvoice.customerVatId || '-'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Credit-note / Credited banner ─────────────────────────── */}
              {selectedInvoice.isCreditNote && (
                <div className="flex items-start gap-3 rounded-md border border-violet-300 bg-violet-50 p-3 text-sm text-violet-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <span className="font-medium">{t('financialManagement.isCreditNoteNotice')}</span>
                    {(() => {
                      const orig = selectedInvoice.creditNoteOf as unknown as Record<string, unknown> | string | undefined;
                      const origNum = typeof orig === 'object' && orig !== null ? (orig.invoiceNumber as string) : (typeof orig === 'string' ? orig : null);
                      const origTotal = typeof orig === 'object' && orig !== null ? (orig.total as number) : undefined;
                      return origNum ? (
                        <span> {t('financialManagement.toOriginalInvoice')} <span className="font-semibold">{origNum}</span>
                          {origTotal !== undefined && <span> ({formatCurrencyValue(origTotal)})</span>}
                        </span>
                      ) : null;
                    })()}
                    {selectedInvoice.notes && <div className="mt-1 text-violet-700">{selectedInvoice.notes}</div>}
                  </div>
                </div>
              )}
              {selectedInvoice.status === 'credited' && !selectedInvoice.isCreditNote && (
                <div className="flex items-start gap-3 rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <span className="font-medium">{t('financialManagement.isCreditedNotice')}</span>
                    {invoiceDetailCreditNotes.length > 0 && (
                      <span> {t('financialManagement.creditNote')}: <span className="font-semibold">{invoiceDetailCreditNotes[0].invoiceNumber}</span></span>
                    )}
                  </div>
                </div>
              )}

              {/* ── Stat cards ────────────────────────────────────────────── */}
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('financialManagement.invoiceNumber')}</div>
                  <div className="mt-1 font-semibold text-[#1a2a5e]">{selectedInvoice.invoiceNumber}</div>
                </div>
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('financialManagement.status')}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Badge variant="outline" className={invoiceStatusClass[selectedInvoice.status]}>{getInvoiceStatusLabel(selectedInvoice.status, t)}</Badge>
                    <InvoicePaymentHints invoice={selectedInvoice} />
                  </div>
                </div>
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('financialManagement.totalAmount')}</div>
                  <div className="mt-1 font-semibold text-[#1a2a5e]">{formatCurrency(getStoredGross(selectedInvoice))}</div>
                </div>
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('financialManagement.openAmount')}</div>
                  <div className="mt-1 font-semibold text-red-700">{formatCurrency(getInvoiceOpenAmount(selectedInvoice))}</div>
                </div>
              </div>

              {/* Geldfluss des Belegs: auch der nicht zuordenbare Ueberhang bleibt sichtbar. */}
              {!selectedInvoice.isCreditNote && selectedInvoice.balance && (
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-md border border-[#d8dce6] bg-white p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Insgesamt eingegangen</div>
                    <div className="mt-1 font-semibold text-[#1a2a5e]">{formatCurrency(Number(selectedInvoice.balance.received ?? getInvoicePaidAmount(selectedInvoice)))}</div>
                  </div>
                  <div className="rounded-md border border-[#d8dce6] bg-white p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Der Rechnung zugeordnet</div>
                    <div className="mt-1 font-semibold text-[#1a2a5e]">{formatCurrency(getInvoicePaidAmount(selectedInvoice))}</div>
                    {Number(selectedInvoice.balance.credited || 0) > 0.009 && (
                      <div className="mt-0.5 text-[11px] text-muted-foreground">Forderung nach Gutschrift: {formatCurrency(Number(selectedInvoice.balance.receivable || 0))}</div>
                    )}
                  </div>
                  <div className={`rounded-md border p-3 ${getInvoiceRefundPending(selectedInvoice) > 0.009 ? 'border-rose-300 bg-rose-50' : 'border-[#d8dce6] bg-white'}`}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Überzahlt / Erstattung offen</div>
                    <div className={`mt-1 font-semibold ${getInvoiceRefundPending(selectedInvoice) > 0.009 ? 'text-rose-800' : 'text-[#1a2a5e]'}`}>{formatCurrency(getInvoiceRefundPending(selectedInvoice))}</div>
                  </div>
                  <div className="rounded-md border border-[#d8dce6] bg-white p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Bereits erstattet</div>
                    <div className="mt-1 font-semibold text-[#1a2a5e]">{formatCurrency(Number(selectedInvoice.balance.refunded || 0))}</div>
                    {Number(selectedInvoice.balance.refundsInProgress || 0) > 0.009 && (
                      <div className="mt-0.5 text-[11px] text-sky-800">In Bearbeitung: {formatCurrency(Number(selectedInvoice.balance.refundsInProgress || 0))}</div>
                    )}
                  </div>
                </div>
              )}

              <Card className="border-[#d8dce6] overflow-hidden">
                <CardHeader className="bg-[#1a2a5e] px-4 py-2.5">
                  <CardTitle className="text-sm" style={{ color: "#f5c800" }}>{t('financialManagement.quickActions')}</CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <Button
                      size="sm"
                      className="bg-[#f5c800] text-[#1a2a5e] hover:bg-[#e0b800] border border-[#1a2a5e]"
                      onClick={() => {
                        setInvoiceDetailsDialogOpen(false);
                        openSendComposer(selectedInvoice, 'invoice');
                      }}
                    >
                      <Send className="mr-1 h-3.5 w-3.5" />{t('financialManagement.send')}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#f5c800] text-[#1a2a5e] hover:bg-[#e0b800] border border-[#1a2a5e] disabled:opacity-50"
                      disabled={pdfDownloadingId === selectedInvoice._id}
                      onClick={() => { void onDownloadInvoicePdf(selectedInvoice); }}
                    >
                      <Download className="mr-1 h-3.5 w-3.5" />
                      {pdfDownloadingId === selectedInvoice._id ? 'PDF wird geladen…' : 'PDF herunterladen'}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#f5c800] text-[#1a2a5e] hover:bg-[#e0b800] border border-[#1a2a5e]"
                      onClick={() => {
                        setInvoiceDetailsDialogOpen(false);
                        openStatusDialog(selectedInvoice);
                      }}
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />{t('financialManagement.changeStatus')}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#f5c800] text-[#1a2a5e] hover:bg-[#e0b800] border border-[#1a2a5e] disabled:opacity-50"
                      disabled={!canRecordPayment(selectedInvoice)}
                      title={canRecordPayment(selectedInvoice)
                        ? t('financialManagement.partialPayment')
                        : `Teilzahlung nicht moeglich (Status: ${getInvoiceStatusLabel(selectedInvoice.status, t)})`}
                      onClick={() => {
                        setInvoiceDetailsDialogOpen(false);
                        openPaymentDialog(selectedInvoice);
                      }}
                    >
                      <Banknote className="mr-1 h-3.5 w-3.5" />{t('financialManagement.partialPayment')}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#f5c800] text-[#1a2a5e] hover:bg-[#e0b800] border border-[#1a2a5e] disabled:opacity-50"
                      disabled={
                        !['paid', 'cancelled', 'credited'].includes(selectedInvoice.status) ||
                        selectedInvoice.isCreditNote ||
                        invoiceDetailCreditNotes.length > 0
                      }
                      onClick={() => {
                        setInvoiceDetailsDialogOpen(false);
                        openCreditDialog(selectedInvoice);
                      }}
                    >
                      <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />{t('financialManagement.createCreditNote')}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* ── Customer & Orders side by side ───────────────────────── */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-[#d8dce6] overflow-hidden">
                  <CardHeader className="bg-[#1a2a5e] px-4 py-2.5">
                    <CardTitle className="text-sm" style={{ color: "#f5c800" }}>{t('financialManagement.customerData')}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-3 text-sm">
                    <div className="flex flex-wrap gap-x-6 gap-y-1 items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">{t('financialManagement.customer')}:</span>
                        {selectedInvoice.customerId ? (
                          <Badge
                            className="cursor-pointer bg-[#1a2a5e] text-white hover:bg-[#243680] border border-[#1a2a5e] gap-1"
                            onClick={() => {
                              setInvoiceDetailsDialogOpen(false);
                              const cid = typeof selectedInvoice.customerId === 'object' && selectedInvoice.customerId !== null
                                ? (selectedInvoice.customerId as unknown as { _id: string })._id
                                : selectedInvoice.customerId;
                              navigate('/admin/users', { state: { reopenUserDetailsId: cid } });
                            }}
                          >
                            <User className="h-3 w-3" />
                            {selectedInvoice.customerName}
                          </Badge>
                        ) : (
                          <span>{selectedInvoice.customerName}</span>
                        )}
                      </div>
                      <div><span className="text-muted-foreground">E-Mail:</span> {selectedInvoice.customerEmail}</div>
                    </div>
                    {/* Adressen nebeneinander */}
                    <div className="grid gap-3 md:grid-cols-2">
                      {/* Rechnungsadresse */}
                      <div className="rounded-md border border-[#d8dce6] overflow-hidden">
                        <div className="bg-[#1a2a5e] px-3 py-1.5 text-xs font-semibold" style={{ color: "#f5c800" }}>{t('financialManagement.invoiceAddress')}</div>
                        <div className="p-3">
                          {hasAddressData(selectedInvoiceAddress) ? (
                            <div className="space-y-0.5">
                              <div className="font-medium">{(selectedInvoiceAddress?.company as string) || (selectedInvoiceAddress?.name as string) || '-'}</div>
                              <div>{(selectedInvoiceAddress?.street as string) || '-'} {(selectedInvoiceAddress?.houseNumber as string) || ''}</div>
                              <div>{(selectedInvoiceAddress?.zipCode as string) || (selectedInvoiceAddress?.zip as string) || '-'} {(selectedInvoiceAddress?.city as string) || '-'}</div>
                              {Boolean(selectedInvoiceAddress?.state) && <div>{selectedInvoiceAddress?.state as string}</div>}
                              <div className="text-muted-foreground">{(selectedInvoiceAddress?.country as string) || '-'}</div>
                            </div>
                          ) : (
                            <div className="text-muted-foreground text-xs italic">{t('financialManagement.noBillingAddress')}</div>
                          )}
                        </div>
                      </div>
                      {/* Lieferadresse */}
                      <div className="rounded-md border border-[#d8dce6] overflow-hidden">
                        <div className="bg-[#1a2a5e] px-3 py-1.5 text-xs font-semibold" style={{ color: "#f5c800" }}>{t('financialManagement.shippingAddress')}</div>
                        <div className="p-3">
                          {selectedInvoiceShippingSameAsBilling ? (
                            <div className="text-muted-foreground italic text-xs">↑ {t('financialManagement.identicalToBilling')}</div>
                          ) : hasAddressData(selectedInvoiceShippingAddress) ? (
                            <div className="space-y-0.5">
                              <div className="font-medium">{(selectedInvoiceShippingAddress?.company as string) || (selectedInvoiceShippingAddress?.name as string) || '-'}</div>
                              <div>{(selectedInvoiceShippingAddress?.street as string) || '-'} {(selectedInvoiceShippingAddress?.houseNumber as string) || ''}</div>
                              <div>{(selectedInvoiceShippingAddress?.zipCode as string) || (selectedInvoiceShippingAddress?.zip as string) || '-'} {(selectedInvoiceShippingAddress?.city as string) || '-'}</div>
                              {Boolean(selectedInvoiceShippingAddress?.state) && <div>{selectedInvoiceShippingAddress?.state as string}</div>}
                              <div className="text-muted-foreground">{(selectedInvoiceShippingAddress?.country as string) || '-'}</div>
                            </div>
                          ) : (
                            <div className="text-muted-foreground text-xs italic">{t('financialManagement.noShippingAddress')}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-[#d8dce6] overflow-hidden">
                  <CardHeader className="bg-[#1a2a5e] px-4 py-2.5">
                    <CardTitle className="text-sm" style={{ color: "#f5c800" }}>{t('financialManagement.linkedOrdersLifecycle')}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-2 text-sm">
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      {/* Order-ID Badge */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">{t('financialManagement.booking')}:</span>
                        {selectedInvoice.orderId ? (() => {
                          const isObj = typeof selectedInvoice.orderId === 'object' && selectedInvoice.orderId !== null;
                          const oid = isObj ? (selectedInvoice.orderId as { _id: string })._id : selectedInvoice.orderId as string;
                          const label = isObj
                            ? ((selectedInvoice.orderId as { orderNumber?: string }).orderNumber || oid.slice(-6))
                            : oid.slice(-6);
                          return (
                            <Badge
                              className="cursor-pointer bg-[#1a2a5e] text-white hover:bg-[#243680] border border-[#1a2a5e] gap-1"
                              onClick={() => {
                                setInvoiceDetailsDialogOpen(false);
                                navigate(`/orders/${oid}`);
                              }}
                            >
                              <Package className="h-3 w-3" />
                              {label}
                            </Badge>
                          );
                        })() : <span className="text-muted-foreground italic text-xs">–</span>}
                      </div>
                      {/* RepairOrder Badges */}
                      {selectedInvoice.repairOrderIds && selectedInvoice.repairOrderIds.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-muted-foreground">{t('financialManagement.repairOrders')}:</span>
                          {selectedInvoice.repairOrderIds.map((rid) => {
                            const isObj = typeof rid === 'object' && rid !== null;
                            const id = isObj ? (rid as { _id: string })._id : (rid as string);
                            const label = isObj
                              ? ((rid as { orderNumber?: string }).orderNumber || id.slice(-6))
                              : id.slice(-6);
                            const r = isObj ? rid as { deviceBrand?: string; deviceModel?: string; deviceType?: string } : null;
                            const tooltip = r
                              ? [label, r.deviceBrand, r.deviceModel].filter(Boolean).join(' – ')
                              : label;
                            return (
                              <Badge
                                key={id}
                                className="cursor-pointer bg-[#1a2a5e] text-white hover:bg-[#243680] border border-[#1a2a5e] gap-1"
                                title={tooltip}
                                onClick={() => {
                                  setInvoiceDetailsDialogOpen(false);
                                  navigate(`/orders/${id}`);
                                }}
                              >
                                <Wrench className="h-3 w-3" />
                                {label}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 pt-1 border-t border-[#d8dce6]">
                      <div><span className="text-muted-foreground">{t('financialManagement.created')}:</span> {formatDate(selectedInvoice.createdAt)}</div>
                      <div><span className="text-muted-foreground">{t('financialManagement.due')}:</span> {formatDate(selectedInvoice.dueDate)}</div>
                      <div><span className="text-muted-foreground">{t('financialManagement.sentAt')}:</span> {formatDate(selectedInvoice.sentAt)}</div>
                      <div><span className="text-muted-foreground">{t('financialManagement.paidAt')}:</span> {formatDate(selectedInvoice.paidAt)}</div>
                      <div><span className="text-muted-foreground">{t('financialManagement.paymentTerms')}:</span> {selectedInvoice.paymentTerms || '-'}</div>
                      <div><span className="text-muted-foreground">Template:</span> {selectedInvoice.template || '-'}</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ── Payments & Refunds ────────────────────────────────────── */}
              {!invoiceDetailLoading && (
                <Card className="border-[#d8dce6] overflow-hidden">
                  <CardHeader className="bg-[#1a2a5e] px-4 py-2.5">
                    <CardTitle className="text-sm" style={{ color: "#f5c800" }}>{t('financialManagement.paymentsAndRefundsSection')}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    {invoiceDetailPayments.length === 0 ? (
                      <div className="rounded-md border border-dashed border-[#d8dce6] p-3 text-center text-sm text-muted-foreground">
                        {t('financialManagement.noPaymentsForInvoice')}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {invoiceDetailPayments.map((pmt) => (
                          <div key={pmt._id} className={`rounded-md border p-3 text-sm ${pmt.status === 'refunded' ? 'border-purple-200 bg-purple-50' : 'border-[#d8dce6] bg-[#f8f9fc]'}`}>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-[#1a2a5e]">{formatCurrency(pmt.amount, pmt.currency || 'EUR')}</span>
                                  <Badge variant="outline" className={paymentStatusClass[pmt.status]}>{getPaymentStatusLabel(pmt.status, t)}</Badge>
                                  <span className="text-muted-foreground text-xs">{getPaymentMethodLabel(pmt.paymentMethod, t)}</span>
                                </div>
                                <div className="text-muted-foreground text-xs">
                                  {pmt.transactionId && <span>TxID: {pmt.transactionId} · </span>}
                                  Eingegangen: {formatDate(pmt.processedAt || pmt.createdAt)}
                                </div>
                              </div>
                              {pmt.status !== 'refunded' && pmt.status === 'completed' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs"
                                  onClick={() => {
                                    setSelectedPayment(pmt);
                                    setRefundForm({
                                      amount: String(pmt.amount),
                                      reason: '',
                                      reasonCategory: '',
                                      internalNote: '',
                                      mode: (['paypal', 'stripe'].includes(pmt.paymentMethod) ? 'gateway' : 'manual') as 'gateway' | 'manual',
                                      gatewayProvider: (['paypal', 'stripe'].includes(pmt.paymentMethod) ? pmt.paymentMethod : '') as PaymentGateway['provider'],
                                      gatewayReference: '',
                                      notifyCustomer: false,
                                    });
                                    setInvoiceDetailsDialogOpen(false);
                                    setRefundDialogOpen(true);
                                  }}
                                >
                                  {t('financialManagement.refund')}
                                </Button>
                              )}
                            </div>
                            {/* Refund details */}
                            {pmt.status === 'refunded' && (
                              <div className="mt-2 space-y-1 border-t border-purple-200 pt-2">
                                <div className="font-medium text-purple-700">↩ {t('financialManagement.refund')}</div>
                                <div className="grid gap-x-4 gap-y-1 text-xs text-muted-foreground md:grid-cols-2">
                                  <div><span className="font-medium text-purple-700">{t('financialManagement.amount')}:</span> {formatCurrency(pmt.refundAmount || pmt.amount, pmt.currency || 'EUR')}</div>
                                  <div><span className="font-medium text-purple-700">{t('financialManagement.date')}:</span> {formatDate(pmt.refundedAt)}</div>
                                  <div><span className="font-medium text-purple-700">Modus:</span> {pmt.refundMode === 'gateway' ? 'Gateway' : pmt.refundMode === 'manual' ? 'Manuell' : '-'}</div>
                                  {pmt.refundGatewayProvider && (
                                    <div><span className="font-medium text-purple-700">Gateway:</span> {pmt.refundGatewayProvider}</div>
                                  )}
                                  {pmt.refundGatewayReference && (
                                    <div className="md:col-span-2"><span className="font-medium text-purple-700">Referenz:</span> {pmt.refundGatewayReference}</div>
                                  )}
                                  {pmt.refundReason && (
                                    <div className="md:col-span-2"><span className="font-medium text-purple-700">Grund:</span> {pmt.refundReason}</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        <div className="flex justify-between border-t border-[#d8dce6] pt-2 text-sm">
                          <span className="text-muted-foreground">{t('financialManagement.totalPayments')}:</span>
                          <span className="font-semibold text-[#1a2a5e]">
                            {formatCurrency(invoiceDetailPayments.filter(p => p.status === 'completed' || p.status === 'refunded').reduce((s, p) => s + p.amount, 0))}
                          </span>
                        </div>
                        {invoiceDetailPayments.some(p => p.status === 'refunded') && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t('financialManagement.thereofRefunded')}:</span>
                            <span className="font-semibold text-purple-700">
                              {formatCurrency(invoiceDetailPayments.filter(p => p.status === 'refunded').reduce((s, p) => s + (p.refundAmount || p.amount), 0))}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ── Linked Credit Notes ───────────────────────────────────── */}
              {!invoiceDetailLoading && invoiceDetailCreditNotes.length > 0 && (
                <Card className="border-[#d8dce6] overflow-hidden">
                  <CardHeader className="bg-[#1a2a5e] px-4 py-2.5">
                    <CardTitle className="text-sm" style={{ color: "#f5c800" }}>{t('financialManagement.linkedCreditNotes')}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      {invoiceDetailCreditNotes.map((cn) => (
                        <div key={String(cn._id)} className="flex items-center justify-between rounded-md border border-violet-200 bg-violet-50 p-3 text-sm">
                          <div>
                            <div className="font-medium text-violet-800">{cn.invoiceNumber}</div>
                            <div className="text-xs text-muted-foreground">
                              {t('financialManagement.created')}: {formatDate(cn.createdAt)} ·{' '}
                              <Badge variant="outline" className={invoiceStatusClass[(cn.status as InvoiceStatus) || 'draft']}>{getInvoiceStatusLabel((cn.status as InvoiceStatus) || 'draft', t)}</Badge>
                            </div>
                            {cn.notes && <div className="mt-1 text-xs text-violet-600">{cn.notes}</div>}
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-violet-800">{formatCurrency(cn.total || 0)}</div>
                            <div className="mt-1 flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-violet-700"
                                onClick={() => { void openInvoiceDetailsById(String(cn._id)); }}
                              >
                                <Eye className="mr-1 h-3 w-3" />{t('common.details', 'Details')}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-violet-700"
                                onClick={() => {
                                  setInvoiceDetailsDialogOpen(false);
                                  navigate(`/admin/credit-notes?highlightInvoiceId=${encodeURIComponent(String(cn._id))}`);
                                }}
                              >
                                Gutschriften
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Invoice items ─────────────────────────────────────────── */}
              <Card className="border-[#d8dce6] overflow-hidden">
                <CardHeader className="bg-[#1a2a5e] px-4 py-2.5">
                  <CardTitle className="text-sm" style={{ color: "#f5c800" }}>{t('financialManagement.invoiceItems')}</CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="overflow-x-auto rounded-md border border-[#d8dce6]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('financialManagement.descriptionServiceName')}</TableHead>
                          <TableHead>{t('financialManagement.itemType')}</TableHead>
                          <TableHead>{t('financialManagement.quantity')}</TableHead>
                          <TableHead>{t('financialManagement.unitPrice')}</TableHead>
                          <TableHead>{t('financialManagement.total')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(selectedInvoice.items || []).map((item, idx) => (
                          <TableRow key={item._id || `invoice-item-${idx}`}>
                            <TableCell>{getInvoiceItemServiceName(item)}</TableCell>
                            <TableCell>{item.type || '-'}</TableCell>
                            <TableCell>{item.quantity ?? '-'}</TableCell>
                            <TableCell>{formatCurrency(item.unitPrice || 0)}</TableCell>
                            <TableCell>{formatCurrency(item.total || 0)}</TableCell>
                          </TableRow>
                        ))}
                        {(!selectedInvoice.items || selectedInvoice.items.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Keine Positionen vorhanden.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-4 text-sm">
                    <div className="rounded-md border border-[#d8dce6] p-2"><span className="text-muted-foreground">{t('financialManagement.net')}:</span> {formatCurrency(getStoredNet(selectedInvoice))}</div>
                    <div className="rounded-md border border-[#d8dce6] p-2"><span className="text-muted-foreground">{t('financialManagement.tax')} ({Number.isFinite(Number(selectedInvoice.taxRate)) ? Number(selectedInvoice.taxRate) : 19} %):</span> {formatCurrency(getStoredTax(selectedInvoice))}</div>
                    <div className="rounded-md border border-[#d8dce6] p-2"><span className="text-muted-foreground">{t('financialManagement.discount')} (brutto):</span> {formatCurrency(selectedInvoice.discount || 0)}</div>
                    <div className="rounded-md border border-[#d8dce6] p-2 font-semibold text-[#1a2a5e]"><span className="text-muted-foreground">{t('financialManagement.total')} (brutto):</span> {formatCurrency(getStoredGross(selectedInvoice))}</div>
                  </div>
                </CardContent>
              </Card>

              {/* ── Notes ─────────────────────────────────────────────────── */}
              <Card className="border-[#d8dce6] overflow-hidden">
                <CardHeader className="bg-[#1a2a5e] px-4 py-2.5">
                  <CardTitle className="text-sm" style={{ color: "#f5c800" }}>{t('financialManagement.notesAndAdditionalInfo')}</CardTitle>
                </CardHeader>
                <CardContent className="p-3 text-sm">
                  {selectedInvoice.notes ? selectedInvoice.notes : <span className="text-muted-foreground">{t('financialManagement.noNotes')}</span>}
                </CardContent>
              </Card>
            </div>
          )}
          </div>

          <DialogFooter className="bg-[#f8f9fc] border-t border-[#d8dce6] px-6 py-3 flex-wrap gap-2 rounded-b-lg">
            <Button className="bg-[#f5c800] text-[#1a2a5e] hover:bg-[#e0b800] border border-[#1a2a5e]" onClick={() => setInvoiceDetailsDialogOpen(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reconcileTarget)} onOpenChange={(open) => { if (!open) setReconcileTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ungeklärte PayPal-Erstattung abgleichen</DialogTitle>
            <DialogDescription>
              PayPal hat auf diesen Erstattungsversuch nicht eindeutig geantwortet. Bitte im PayPal-Konto prüfen,
              ob die Erstattung ausgeführt wurde, und das Ergebnis hier eintragen. Bitte NICHT zusätzlich eine manuelle
              Erstattung erfassen – derselbe Betrag würde sonst doppelt gezählt.
            </DialogDescription>
          </DialogHeader>
          {reconcileTarget && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3 space-y-1">
                <div><span className="text-muted-foreground">Betrag:</span> {formatCurrencyValue(reconcileTarget.entry.amount, reconcileTarget.payment.currency || 'EUR')}</div>
                <div><span className="text-muted-foreground">Grund:</span> {reconcileTarget.entry.reason || '-'}</div>
                <div><span className="text-muted-foreground">Angelegt:</span> {formatDateTime(reconcileTarget.entry.createdAt)}</div>
                {reconcileTarget.entry.error && <div className="text-amber-800">{reconcileTarget.entry.error}</div>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="reconcile-refund-id">PayPal-Erstattungs-ID (nur bei „ausgeführt“)</Label>
                <Input
                  id="reconcile-refund-id"
                  value={reconcileRefundId}
                  onChange={(e) => setReconcileRefundId(e.target.value)}
                  placeholder="z.B. 1AB23456CD789012E"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReconcileTarget(null)} disabled={reconcileSubmitting}>Abbrechen</Button>
            <Button variant="outline" onClick={() => void onSubmitReconcile('not-executed')} disabled={reconcileSubmitting}>Nicht ausgeführt</Button>
            <Button onClick={() => void onSubmitReconcile('executed')} disabled={reconcileSubmitting || !reconcileRefundId.trim()}>Bei PayPal ausgeführt</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="bg-[#1a2a5e] px-6 py-4 rounded-t-lg border-b border-[#0f1d45]">
            <DialogTitle className="flex items-center gap-2 text-xl" style={{ color: '#f5c800' }}>
              <RefreshCw className="h-5 w-5" />
              {t('financialManagement.issueRefund')}
            </DialogTitle>
            <DialogDescription className="text-[#c8d0e7]">
              Rückerstattung mit Gateway-Integration und vollständiger Nachvollziehbarkeit erfassen.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4">
          {/* ── Payment context ──────────────────────────────────────── */}
          {selectedPayment && (
            <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3 text-sm space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="font-semibold text-[#1a2a5e]">{selectedPayment.customerName}</div>
                <Badge variant="outline" className={paymentStatusClass[selectedPayment.status]}>{getPaymentStatusLabel(selectedPayment.status, t)}</Badge>
              </div>
              <div className="grid gap-x-6 gap-y-0.5 text-muted-foreground md:grid-cols-3">
                <div><span className="text-foreground font-medium">{t('financialManagement.paymentMethod')}:</span> {getPaymentMethodLabel(selectedPayment.paymentMethod, t)}</div>
                <div><span className="text-foreground font-medium">Bezahlt:</span> {formatCurrency(selectedPayment.amount, selectedPayment.currency || 'EUR')}</div>
                {selectedPayment.transactionId && (
                  <div><span className="text-foreground font-medium">TxID:</span> <span className="font-mono text-xs">{selectedPayment.transactionId}</span></div>
                )}
              </div>
            </div>
          )}

          <Separator className="my-1" />

          {/* ── Amount ─────────────────────────────────────────────── */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>Erstattungsbetrag *</Label>
              {selectedPayment && (
                <button
                  type="button"
                  className="text-xs text-[#1a2a5e] underline-offset-2 hover:underline"
                  onClick={() => setRefundForm((p) => ({ ...p, amount: String(selectedPayment.amount) }))}
                >
                  Vollständige Erstattung ({formatCurrency(selectedPayment.amount, selectedPayment.currency || 'EUR')})
                </button>
              )}
            </div>
            <div className="relative">
              <Input
                type="number"
                min="0.01"
                step="0.01"
                max={selectedPayment?.amount}
                value={refundForm.amount}
                onChange={(e) => setRefundForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="0.00"
                className="pr-12"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">EUR</span>
            </div>
            {selectedPayment && Number(refundForm.amount) > selectedPayment.amount && (
              <p className="text-xs text-red-600">Betrag überschreitet die original Zahlungssumme von {formatCurrency(selectedPayment.amount, selectedPayment.currency || 'EUR')}.</p>
            )}
          </div>

          {/* ── Reason ─────────────────────────────────────────────── */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Grund (Kategorie)</Label>
              <Select
                value={refundForm.reasonCategory}
                onValueChange={(v) => setRefundForm((p) => ({ ...p, reasonCategory: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Kategorie wählen…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Defektes Produkt">Defektes Produkt</SelectItem>
                  <SelectItem value="Falscher Artikel">Falscher Artikel</SelectItem>
                  <SelectItem value="Nicht geliefert">Nicht geliefert</SelectItem>
                  <SelectItem value="Kundenwunsch">Kundenwunsch</SelectItem>
                  <SelectItem value="Serviceproblem">Serviceproblem</SelectItem>
                  <SelectItem value="Zu viel berechnet">Zu viel berechnet</SelectItem>
                  <SelectItem value="Auftrag storniert">Auftrag storniert</SelectItem>
                  <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Freitext (optional)</Label>
              <Input
                value={refundForm.reason}
                onChange={(e) => setRefundForm((p) => ({ ...p, reason: e.target.value }))}
                placeholder="Ergänzende Beschreibung…"
              />
            </div>
          </div>

          {/* ── Gateway ─────────────────────────────────────────────── */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Abwicklung *</Label>
              <Select
                value={refundForm.mode}
                onValueChange={(value) => {
                  const nextMode = value as 'gateway' | 'manual';
                  setRefundForm((p) => ({
                    ...p,
                    mode: nextMode,
                    gatewayProvider: nextMode === 'gateway' ? (p.gatewayProvider || suggestedRefundGateway) : ''
                  }));
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gateway">Direkt über Gateway</SelectItem>
                  <SelectItem value="manual">Manuell intern verbuchen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Gateway</Label>
              <Select
                disabled={refundForm.mode !== 'gateway'}
                value={refundForm.gatewayProvider}
                onValueChange={(value) => setRefundForm((p) => ({ ...p, gatewayProvider: value }))}
              >
                <SelectTrigger><SelectValue placeholder="Gateway wählen…" /></SelectTrigger>
                <SelectContent>
                  {compatibleRefundGateways.length > 0
                    ? compatibleRefundGateways.map((gw) => (
                        <SelectItem key={gw._id} value={gw.provider}>{gw.name}</SelectItem>
                      ))
                    : gateways.filter(g => g.isActive).map((gw) => (
                        <SelectItem key={gw._id} value={gw.provider}>{gw.name}</SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            </div>
          </div>

          {refundForm.mode === 'gateway' && (
            <div className="space-y-1">
              <Label>Gateway-Referenz (optional)</Label>
              <Input
                value={refundForm.gatewayReference}
                onChange={(e) => setRefundForm((p) => ({ ...p, gatewayReference: e.target.value }))}
                placeholder="z. B. refund_abc123 (wird vom Gateway vergeben)"
                className="font-mono text-sm"
              />
            </div>
          )}

          {refundForm.mode === 'gateway' && compatibleRefundGateways.length === 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
              Kein aktives, zur Zahlungsmethode passendes Gateway gefunden. Bitte auf manuelle Abwicklung wechseln oder Gateway-Konfiguration prüfen.
            </div>
          )}

          <Separator className="my-1" />

          {/* ── Internal note & notify ──────────────────────────────── */}
          <div className="space-y-1">
            <Label>Interne Notiz (optional)</Label>
            <Textarea
              rows={2}
              value={refundForm.internalNote}
              onChange={(e) => setRefundForm((p) => ({ ...p, internalNote: e.target.value }))}
              placeholder="Interne Bemerkung – wird dem Kunden nicht angezeigt"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="refund-notify"
              checked={refundForm.notifyCustomer}
              onCheckedChange={(v) => setRefundForm((p) => ({ ...p, notifyCustomer: v }))}
            />
            <Label htmlFor="refund-notify" className="cursor-pointer">Kunden per E-Mail benachrichtigen</Label>
          </div>

          {/* ── Summary card ────────────────────────────────────────── */}
          {Number(refundForm.amount) > 0 && (
            <div className="rounded-md border border-[#d8dce6] bg-slate-50 p-3 text-sm space-y-1">
              <div className="font-semibold text-[#1a2a5e]">{t('financialManagement.summary')}</div>
              <div className="grid gap-x-4 gap-y-0.5 md:grid-cols-2">
                <div><span className="text-muted-foreground">{t('financialManagement.amount')}:</span> <span className="font-semibold text-purple-700">{formatCurrency(Number(refundForm.amount))}</span></div>
                <div><span className="text-muted-foreground">Abwicklung:</span> {refundForm.mode === 'gateway' ? `Gateway (${refundForm.gatewayProvider || '–'})` : 'Manuell'}</div>
                {(refundForm.reasonCategory || refundForm.reason) && (
                  <div className="md:col-span-2"><span className="text-muted-foreground">Grund:</span> {[refundForm.reasonCategory, refundForm.reason].filter(Boolean).join(' – ')}</div>
                )}
                {selectedPayment && (
                  <div><span className="text-muted-foreground">Verbleibend:</span> {formatCurrency(Math.max(0, selectedPayment.amount - Number(refundForm.amount)), selectedPayment.currency || 'EUR')}</div>
                )}
              </div>
            </div>
          )}

          </div>

          <DialogFooter className="bg-[#f8f9fc] border-t border-[#d8dce6] px-6 py-3 flex-wrap gap-2 rounded-b-lg">
            <Button variant="outline" className="border-[#1a2a5e] bg-[#f5c800] text-[#1a2a5e] hover:bg-[#e0b800]" onClick={() => setRefundDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button
              className="bg-[#f5c800] text-[#1a2a5e] hover:bg-[#e0b800] border border-[#1a2a5e]"
              onClick={onRefund}
              disabled={!refundForm.amount || Number(refundForm.amount) <= 0 || (!refundForm.reason.trim() && !refundForm.reasonCategory)}
            >
              {t('financialManagement.bookRefund')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="bg-[#1a2a5e] px-6 py-4 border-b border-[#0f1d45]">
            <DialogTitle className="text-xl font-bold flex items-center gap-2" style={{ color: '#f5c800' }}>
              <Wrench className="h-5 w-5" /> {t('financialManagement.changeInvoiceStatus')}
            </DialogTitle>
            <DialogDescription className="text-blue-200 text-sm">
              {t('financialManagement.changeInvoiceStatusDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4">
            {selectedInvoice && (
              <div className="rounded-md border border-[#0f1d45] overflow-hidden">
                <div className="bg-[#1a2a5e] px-3 py-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-semibold text-sm" style={{ color: '#f5c800' }}>{selectedInvoice.invoiceNumber}</div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Badge variant="outline" className={invoiceStatusClass[selectedInvoice.status]}>{getInvoiceStatusLabel(selectedInvoice.status, t)}</Badge>
                      <span className="text-blue-200">→</span>
                      <Badge variant="outline" className={invoiceStatusClass[statusForm.status]}>{getInvoiceStatusLabel(statusForm.status, t)}</Badge>
                    </div>
                  </div>
                </div>
                <div className="bg-[#f8f9fc] p-3 text-sm space-y-1">
                  <div className="grid gap-2 md:grid-cols-3">
                    <div><span className="text-muted-foreground">{t('financialManagement.customer')}:</span> {selectedInvoice.customerName}</div>
                    <div><span className="text-muted-foreground">Rechnung:</span> {formatCurrency(selectedInvoice.total || 0)}</div>
                    <div><span className="text-muted-foreground">Bereits bezahlt:</span> {formatCurrency(getInvoicePaidAmount(selectedInvoice))}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-md border border-[#0f1d45] overflow-hidden">
              <div className="bg-[#1a2a5e] px-3 py-2">
                <span className="text-sm font-semibold" style={{ color: '#f5c800' }}>{t('financialManagement.newStatus')}</span>
              </div>
              <div className="bg-[#f8f9fc] p-3">
                <Select value={statusForm.status} onValueChange={(v) => setStatusForm((p) => ({ ...p, status: v as InvoiceStatus }))}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {selectedInvoice && (
                      <SelectItem value={selectedInvoice.status}>{getInvoiceStatusLabel(selectedInvoice.status, t)} ({t('common.current', 'aktuell')})</SelectItem>
                    )}
                    {(selectedInvoice ? invoiceStatusTransitions[selectedInvoice.status] : []).map((status) => (
                      <SelectItem key={status} value={status}>{getInvoiceStatusLabel(status, t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedInvoice && invoiceStatusTransitions[selectedInvoice.status].length === 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    Für den Status "{getInvoiceStatusLabel(selectedInvoice.status, t)}" sind keine weiteren Statuswechsel möglich.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-md border border-[#0f1d45] overflow-hidden">
              <div className="bg-[#1a2a5e] px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-semibold flex items-center gap-1.5" style={{ color: '#f5c800' }}>
                  <Banknote className="h-4 w-4" /> {t('financialManagement.paymentInfo')}
                </span>
                {statusForm.status === 'paid' && (
                  <Badge className="bg-[#f5c800] text-[#1a2a5e] text-[10px]">Erforderlich</Badge>
                )}
              </div>
              <div className="bg-[#f8f9fc] p-3 space-y-3">
                {statusForm.status === 'paid' ? (
                  <div className="space-y-1">
                    <p className="flex items-center gap-1.5 text-xs text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                      {t('financialManagement.paymentInfoRequired')}
                    </p>
                    <p className="text-xs text-[#1a2a5e]">
                      {selectedInvoice && getInvoiceOpenAmount(selectedInvoice) > 0.009
                        ? `Bereits zugeordnete Zahlungen (${formatCurrency(getInvoicePaidAmount(selectedInvoice))}) werden berücksichtigt. Nur der offene Betrag von ${formatCurrency(getInvoiceOpenAmount(selectedInvoice))} wird einmalig als Zahlung erfasst.`
                        : 'Der Beleg ist bereits vollständig bezahlt – es wird kein weiterer Betrag erfasst.'}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Optional – hilfreich zur Dokumentation bereits erhaltener Zahlungen.</p>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label>{t('financialManagement.paymentMethod')} {statusForm.status === 'paid' && <span className="text-red-600">*</span>}</Label>
                    <Select
                      value={statusForm.paymentMethod || undefined}
                      onValueChange={(value) => setStatusForm((p) => ({ ...p, paymentMethod: value as NonNullable<Invoice['paymentMethod']> }))}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Zahlungsart wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {trackedPaymentMethodOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{getPaymentMethodLabel(option.value, t)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>{t('financialManagement.paymentTime')} {statusForm.status === 'paid' && <span className="text-red-600">*</span>}</Label>
                    <Input
                      type="datetime-local"
                      className="bg-white"
                      value={statusForm.paidAt}
                      onChange={(e) => setStatusForm((p) => ({ ...p, paidAt: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            {selectedInvoice && statusForm.status === 'cancelled' && selectedInvoice.status !== 'cancelled' && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 space-y-2">
                {['draft', 'pending_approval'].includes(selectedInvoice.status) ? (
                  <p>Der Entwurf wird verworfen (nicht gelöscht): die Nummer bleibt belegt, es entsteht keine Gutschrift.</p>
                ) : (
                  <>
                    <p>
                      Storno: Die Rechnung bleibt mit Nummer und PDF unverändert erhalten und wird als storniert markiert.
                      Es wird eine Storno-Gutschrift (INV-CN-…) über den noch nicht gutgeschriebenen Betrag ausgestellt.
                      Der Grund (Notiz) ist Pflicht und wird mit Bearbeiter und Zeitpunkt protokolliert.
                    </p>
                    {getInvoicePaidAmount(selectedInvoice) > 0.009 && (
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4"
                          checked={confirmPaidCancellation}
                          onChange={(e) => setConfirmPaidCancellation(e.target.checked)}
                        />
                        <span>
                          Auf diese Rechnung sind bereits {formatCurrency(getInvoicePaidAmount(selectedInvoice))} gebucht. Ich bestätige das Storno:
                          die Zahlung bleibt erhalten und wird als Guthaben bzw. offene Erstattung ausgewiesen – es wird nichts automatisch erstattet.
                        </span>
                      </label>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="rounded-md border border-[#0f1d45] overflow-hidden">
              <div className="bg-[#1a2a5e] px-3 py-2">
                <span className="text-sm font-semibold" style={{ color: '#f5c800' }}>{statusForm.status === 'cancelled' ? 'Grund (Pflicht)' : 'Notiz (optional)'}</span>
              </div>
              <div className="bg-[#f8f9fc] p-3">
                <Textarea
                  className="bg-white"
                  rows={3}
                  placeholder="Interne Bemerkung zur Statusänderung"
                  value={statusForm.notes}
                  onChange={(e) => setStatusForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-[#d8dce6] bg-[#f8f9fc] rounded-b-lg">
            <Button
              variant="outline"
              className="border-[#1a2a5e] text-[#1a2a5e] hover:bg-[#1a2a5e] hover:text-white"
              onClick={() => setStatusDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button className="bg-[#f5c800] text-[#1a2a5e] font-semibold hover:bg-[#e0b800]" onClick={onChangeStatus}>
              {t('financialManagement.saveStatus')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="bg-[#1a2a5e] px-6 py-4 rounded-t-lg border-b border-[#0f1d45]">
            <DialogTitle className="text-xl font-bold" style={{ color: '#f5c800' }}>{t('financialManagement.recordPaymentTitle')}</DialogTitle>
            <DialogDescription className="text-blue-200 text-sm">{t('financialManagement.recordPaymentDesc')}</DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4">

          {selectedInvoice && (
            <div className="rounded-md border border-[#0f1d45] overflow-hidden">
              <div className="bg-[#1a2a5e] px-3 py-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-semibold text-sm" style={{ color: '#f5c800' }}>{selectedInvoice.invoiceNumber}</div>
                  <Badge variant="outline" className={invoiceStatusClass[selectedInvoice.status]}>{getInvoiceStatusLabel(selectedInvoice.status, t)}</Badge>
                </div>
              </div>
              <div className="bg-[#f8f9fc] p-3 text-sm space-y-2">
                <div className="grid gap-2 md:grid-cols-3">
                  <div><span className="text-muted-foreground">{t('financialManagement.customer')}:</span> {selectedInvoice.customerName}</div>
                  <div><span className="text-muted-foreground">Rechnung:</span> {formatCurrency(selectedInvoice.total || 0)}</div>
                  <div><span className="text-muted-foreground">Bereits bezahlt:</span> {formatCurrency(getInvoicePaidAmount(selectedInvoice))}</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t('financialManagement.paymentProgress')}</span>
                    <span>{formatCurrency(selectedInvoiceOpenAmount)} {t('financialManagement.openAmount').toLowerCase()}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-[#1a2a5e]"
                      style={{ width: `${Math.min(100, Math.max(0, ((getInvoicePaidAmount(selectedInvoice) / Math.max(1, Number(selectedInvoice.balance?.receivable ?? selectedInvoice.total ?? 0))) * 100)))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-md border border-[#0f1d45] overflow-hidden">
            <div className="bg-[#1a2a5e] px-3 py-2">
              <span className="text-sm font-semibold" style={{ color: '#f5c800' }}>{t('financialManagement.paymentMethod')}</span>
            </div>
            <div className="bg-[#f8f9fc] p-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${paymentForm.scope === 'partial' ? 'border-[#f5c800] bg-[#f5c800] text-[#1a2a5e]' : 'border-[#d8dce6] bg-white text-[#1a2a5e] hover:bg-[#f5c800]/10'}`}
                onClick={() => setPaymentForm((p) => ({ ...p, scope: 'partial' }))}
              >
                {t('financialManagement.partialPayment')}
              </button>
              <button
                type="button"
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${paymentForm.scope === 'full' ? 'border-[#f5c800] bg-[#f5c800] text-[#1a2a5e]' : 'border-[#d8dce6] bg-white text-[#1a2a5e] hover:bg-[#f5c800]/10'}`}
                onClick={() => setPaymentForm((p) => ({ ...p, scope: 'full', amount: String(selectedInvoiceOpenAmount) }))}
              >
                {t('financialManagement.fullPayment')} ({t('financialManagement.openAmount')})
              </button>
            </div>
            </div>
          </div>

          <div className="rounded-md border border-[#0f1d45] overflow-hidden">
            <div className="bg-[#1a2a5e] px-3 py-2">
              <span className="text-sm font-semibold" style={{ color: '#f5c800' }}>{t('financialManagement.paymentDetails')}</span>
            </div>
            <div className="bg-[#f8f9fc] p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>{t('financialManagement.amount')} *</Label>
                <button
                  type="button"
                  className="text-xs text-[#1a2a5e] underline-offset-2 hover:underline font-medium"
                  onClick={() => setPaymentForm((p) => ({ ...p, amount: String(selectedInvoiceOpenAmount), scope: 'full' }))}
                >
                  Max. übernehmen
                </button>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={selectedInvoiceOpenAmount}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value, scope: Number(e.target.value || 0) >= selectedInvoiceOpenAmount ? 'full' : 'partial' }))}
                  placeholder="0.00"
                  className="pr-12"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">EUR</span>
              </div>
              {Number(paymentForm.amount || 0) > selectedInvoiceOpenAmount && (
                <p className="text-xs text-red-600">Betrag überschreitet den offenen Restbetrag.</p>
              )}
            </div>

            <div className="space-y-1">
              <Label>{t('financialManagement.datePaymentReceived')}</Label>
              <Input
                type="date"
                value={paymentForm.paymentDate}
                onChange={(e) => setPaymentForm((p) => ({ ...p, paymentDate: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>{t('financialManagement.paymentMethod')} *</Label>
              <Select value={paymentForm.paymentMethod} onValueChange={(v) => setPaymentForm((p) => ({ ...p, paymentMethod: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">{t('financialManagement.paymentMethods.bank_transfer')}</SelectItem>
                  <SelectItem value="prepayment">{t('financialManagement.paymentMethods.prepayment')}</SelectItem>
                  <SelectItem value="cash">{t('financialManagement.paymentMethods.cash')}</SelectItem>
                  <SelectItem value="credit_card">{t('financialManagement.paymentMethods.credit_card')}</SelectItem>
                  <SelectItem value="debit_card">{t('financialManagement.paymentMethods.debit_card')}</SelectItem>
                  <SelectItem value="paypal">{t('financialManagement.paymentMethods.paypal')}</SelectItem>
                  <SelectItem value="stripe">{t('financialManagement.paymentMethods.stripe')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{t('financialManagement.referenceOptional')}</Label>
              <Input
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm((p) => ({ ...p, reference: e.target.value }))}
                placeholder="z. B. Verwendungszweck / Belegnummer"
              />
            </div>
          </div>
            </div>
          </div>

          <div className="rounded-md border border-[#0f1d45] overflow-hidden">
            <div className="bg-[#1a2a5e] px-3 py-2">
              <span className="text-sm font-semibold" style={{ color: '#f5c800' }}>{t('financialManagement.additionalInfo')}</span>
            </div>
            <div className="bg-[#f8f9fc] p-3 space-y-3">
          <div className="space-y-1">
            <Label>Gateway/Provider Antwort (optional)</Label>
            <Textarea
              rows={2}
              value={paymentForm.gatewayResponse}
              onChange={(e) => setPaymentForm((p) => ({ ...p, gatewayResponse: e.target.value }))}
              placeholder="Raw Response, Autorisierungsnummer oder technische Details"
            />
          </div>

          <div className="space-y-1">
            <Label>Interne Notiz (optional)</Label>
            <Textarea
              rows={2}
              value={paymentForm.internalNote}
              onChange={(e) => setPaymentForm((p) => ({ ...p, internalNote: e.target.value }))}
              placeholder="Interne Bemerkung zur Zahlung"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="payment-notify"
              checked={paymentForm.notifyCustomer}
              onCheckedChange={(v) => setPaymentForm((p) => ({ ...p, notifyCustomer: v }))}
            />
            <Label htmlFor="payment-notify" className="cursor-pointer">{t('financialManagement.notifyCustomerPayment')}</Label>
          </div>
            </div>
          </div>

          <div className="rounded-md border border-[#0f1d45] overflow-hidden">
            <div className="bg-[#1a2a5e] px-3 py-2">
              <span className="text-sm font-semibold" style={{ color: '#f5c800' }}>{t('financialManagement.summary')}</span>
            </div>
            <div className="bg-[#f8f9fc] p-3 text-sm space-y-1">
            <div className="grid gap-x-4 gap-y-0.5 md:grid-cols-2">
              <div><span className="text-muted-foreground">Vorgang:</span> {paymentForm.scope === 'full' ? t('financialManagement.fullPayment') : t('financialManagement.partialPayment')}</div>
              <div><span className="text-muted-foreground">{t('financialManagement.paymentMethod')}:</span> {getPaymentMethodLabel(paymentForm.paymentMethod, t)}</div>
              <div><span className="text-muted-foreground">{t('financialManagement.amount')}:</span> <span className="font-semibold text-[#1a2a5e]">{formatCurrency(Number(paymentForm.amount || 0))}</span></div>
              <div><span className="text-muted-foreground">Rest nach Buchung:</span> {formatCurrency(Math.max(0, selectedInvoiceOpenAmount - Number(paymentForm.amount || 0)))}</div>
            </div>
            </div>
          </div>

          {selectedInvoicePaymentHistory.length > 0 && (
            <div className="rounded-md border border-[#0f1d45] overflow-hidden">
              <div className="bg-[#1a2a5e] px-3 py-2">
                <span className="text-sm font-semibold" style={{ color: '#f5c800' }}>{t('financialManagement.previousPaymentsForInvoice')}</span>
              </div>
              <div className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#f8f9fc]">
                      <TableHead className="text-[#1a2a5e] font-semibold">{t('financialManagement.date')}</TableHead>
                      <TableHead className="text-[#1a2a5e] font-semibold">{t('financialManagement.status')}</TableHead>
                      <TableHead className="text-[#1a2a5e] font-semibold">{t('financialManagement.paymentMethod')}</TableHead>
                      <TableHead className="text-right text-[#1a2a5e] font-semibold">{t('financialManagement.amount')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoicePaymentHistory.slice(0, 5).map((entry) => (
                      <TableRow key={entry._id}>
                        <TableCell>{formatDate(entry.processedAt || entry.createdAt)}</TableCell>
                        <TableCell><Badge variant="outline" className={paymentStatusClass[entry.status]}>{getPaymentStatusLabel(entry.status, t)}</Badge></TableCell>
                        <TableCell>{getPaymentMethodLabel(entry.paymentMethod, t)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(entry.amount, entry.currency || 'EUR')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          </div>

          <DialogFooter className="px-6 py-4 border-t border-[#d8dce6] bg-[#f8f9fc] rounded-b-lg">
            <Button variant="outline" className="border-[#1a2a5e] text-[#1a2a5e] hover:bg-[#1a2a5e] hover:text-white" onClick={() => setPaymentDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={onAddPayment}
              disabled={!paymentForm.amount || Number(paymentForm.amount) <= 0 || Number(paymentForm.amount) > selectedInvoiceOpenAmount + 0.01}
              className="bg-[#f5c800] text-[#1a2a5e] font-semibold hover:bg-[#e0b800] disabled:opacity-50"
            >
              {t('financialManagement.bookPayment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="bg-[#1a2a5e] px-6 py-4 rounded-t-lg border-b border-[#0f1d45]">
            <DialogTitle className="flex items-center gap-2 text-xl" style={{ color: '#f5c800' }}>
              <FileSpreadsheet className="h-5 w-5" />
              {t('financialManagement.createCreditNote')}
              {selectedInvoice?.invoiceNumber && (
                <span className="text-base font-normal text-[#c8d0e7]">· {selectedInvoice.invoiceNumber}</span>
              )}
            </DialogTitle>
            <DialogDescription className="text-[#c8d0e7]">
              Erstellt eine negative Gegenrechnung zur ausgewählten Ursprungsrechnung.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4">
          {/* ── Invoice context ──────────────────────────────────────── */}
          {selectedInvoice && (
            <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3 text-sm space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="font-semibold text-[#1a2a5e]">{selectedInvoice.invoiceNumber}</div>
                <Badge variant="outline" className={invoiceStatusClass[selectedInvoice.status]}>{getInvoiceStatusLabel(selectedInvoice.status, t)}</Badge>
              </div>
              <div className="grid gap-x-6 gap-y-0.5 text-muted-foreground md:grid-cols-2">
                <div><span className="text-foreground font-medium">{t('financialManagement.customer')}:</span> {selectedInvoice.customerName}</div>
                <div><span className="text-foreground font-medium">{t('financialManagement.totalAmount')}:</span> {formatCurrency(selectedInvoice.total || 0)}</div>
                {selectedInvoice.items?.length ? (
                  <div className="md:col-span-2"><span className="text-foreground font-medium">Positionen:</span> {selectedInvoice.items.length}</div>
                ) : null}
              </div>
            </div>
          )}

          <Separator className="my-1" />

          {/* ── Scope ─────────────────────────────────────────────────── */}
          <div className="space-y-1">
            <Label>Umfang der Gutschrift</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCreditForm((p) => ({ ...p, scope: 'full', discount: String(getInvoiceDiscountAmount(selectedInvoice)) }))}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${creditForm.scope === 'full' ? 'border-[#1a2a5e] bg-[#1a2a5e] text-white' : 'border-input hover:bg-accent'}`}
              >
                Vollständige Gutschrift
              </button>
              <button
                type="button"
                onClick={() => setCreditForm((p) => ({ ...p, scope: 'partial', discount: '0' }))}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${creditForm.scope === 'partial' ? 'border-[#1a2a5e] bg-[#1a2a5e] text-white' : 'border-input hover:bg-accent'}`}
              >
                Teilgutschrift (Positionen anpassen)
              </button>
            </div>
          </div>

          {/* ── Item overrides (partial mode) ────────────────────────── */}
          {creditForm.scope === 'partial' && selectedInvoice?.items?.length && (
            <div className="space-y-2">
              <Label>Positionen</Label>
              <div className="rounded-md border border-input overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="w-8 px-2 py-1.5 text-left font-medium text-muted-foreground"></th>
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Service Name</th>
                      <th className="w-20 px-2 py-1.5 text-right font-medium text-muted-foreground">Menge</th>
                      <th className="w-28 px-2 py-1.5 text-right font-medium text-muted-foreground">Betrag brutto (€)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-input">
                    {(selectedInvoice.items || []).map((item, i) => {
                      const ov = creditItemOverrides[i] ?? { included: true, quantity: String(item.quantity), unitPrice: String(Math.abs(item.unitPrice)) };
                      const included = ov.included !== false;
                      return (
                        <tr key={i} className={included ? '' : 'opacity-40'}>
                          <td className="px-2 py-1.5">
                            <Checkbox
                              checked={included}
                              onCheckedChange={(checked) =>
                                setCreditItemOverrides((prev) => {
                                  const next = [...prev];
                                  while (next.length <= i) next.push({ included: true, quantity: String((selectedInvoice.items || [])[next.length]?.quantity || 1), unitPrice: String(Math.abs((selectedInvoice.items || [])[next.length]?.unitPrice || 0)) });
                                  next[i] = { ...next[i], included: !!checked };
                                  return next;
                                })
                              }
                            />
                          </td>
                          <td className="px-2 py-1.5 text-foreground">{getInvoiceItemServiceName(item)}</td>
                          <td className="px-2 py-1.5 text-right">
                            <Input
                              type="number"
                              min="1"
                              max={item.quantity}
                              className="h-7 w-16 text-right text-xs ml-auto"
                              disabled={!included}
                              value={ov.quantity}
                              onChange={(e) =>
                                setCreditItemOverrides((prev) => {
                                  const next = [...prev];
                                  while (next.length <= i) next.push({ included: true, quantity: String((selectedInvoice.items || [])[next.length]?.quantity || 1), unitPrice: String(Math.abs((selectedInvoice.items || [])[next.length]?.unitPrice || 0)) });
                                  next[i] = { ...next[i], quantity: e.target.value };
                                  return next;
                                })
                              }
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="h-7 w-20 text-right text-xs ml-auto"
                              disabled={!included}
                              value={ov.unitPrice}
                              onChange={(e) =>
                                setCreditItemOverrides((prev) => {
                                  const next = [...prev];
                                  while (next.length <= i) next.push({ included: true, quantity: String((selectedInvoice.items || [])[next.length]?.quantity || 1), unitPrice: String(Math.abs((selectedInvoice.items || [])[next.length]?.unitPrice || 0)) });
                                  next[i] = { ...next[i], unitPrice: e.target.value };
                                  return next;
                                })
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {creditPreview && creditPreview.items.length === 0 && (
                <p className="text-xs text-amber-600">Bitte mindestens eine Position auswählen.</p>
              )}
            </div>
          )}

          {/* ── Finance ───────────────────────────────────────────────── */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Steuersatz (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                disabled={Boolean(selectedInvoice?.isReverseCharge)}
                value={selectedInvoice?.isReverseCharge ? '0' : creditForm.taxRate}
                onChange={(e) => setCreditForm((p) => ({ ...p, taxRate: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                {selectedInvoice?.isReverseCharge
                  ? 'Reverse Charge: die Gutschrift wird mit 0% ausgewiesen.'
                  : 'Wird von der Ursprungsrechnung übernommen und kann überschrieben werden.'}
              </p>
            </div>
            <div className="space-y-1">
              <Label>Rabatt (€ brutto, optional)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={creditForm.discount}
                onChange={(e) => setCreditForm((p) => ({ ...p, discount: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                {creditForm.scope === 'full'
                  ? 'Wird von der Ursprungsrechnung übernommen und mindert den Bruttobetrag genau einmal.'
                  : 'Mindert den Bruttobetrag der Gutschrift genau einmal.'}
              </p>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Fälligkeit</Label>
              <Input
                type="date"
                value={creditForm.dueDate}
                onChange={(e) => setCreditForm((p) => ({ ...p, dueDate: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Die Gutschriftnummer wird automatisch vergeben (INV-CN-JJJJ-NNNN).
              </p>
            </div>
          </div>

          {/* ── Reason ───────────────────────────────────────────────── */}
          <div className="space-y-1">
            <Label>Bemerkung / Grund</Label>
            <Textarea
              rows={2}
              value={creditForm.reason}
              onChange={(e) => setCreditForm((p) => ({ ...p, reason: e.target.value }))}
              placeholder="Begründung für die Gutschrift…"
            />
          </div>

          {/* Frueher stand hier ein Schalter "Kunden per E-Mail benachrichtigen".
              POST /invoices/:id/credit-note verschickt jedoch nichts - der Schalter
              hat nur so getan. Statt einer Scheinfunktion steht hier jetzt der
              tatsaechliche Ablauf. */}
          <p className="text-xs text-muted-foreground">
            Hinweis: Die Gutschrift wird beim Anlegen <strong>nicht</strong> automatisch an den Kunden
            versendet. Das Gutschrift-PDF kann anschließend über das Aktionsmenü heruntergeladen werden.
          </p>

          {/* ── Live preview card ─────────────────────────────────────── */}
          {creditPreview && (creditPreview.items.length > 0 || creditForm.scope === 'full') && (
            <div className="rounded-md border border-[#d8dce6] bg-slate-50 p-3 text-sm space-y-1">
              <div className="font-semibold text-[#1a2a5e]">Vorschau Gutschrift</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
                <span className="text-muted-foreground">Positionen brutto</span>
                <span className="text-right font-mono">{formatCurrency(-Math.abs(creditPreview.items.reduce((sum, i) => sum + Math.abs(i.total), 0)))}</span>
                {Math.abs(creditPreview.discount) > 0 && (
                  <>
                    <span className="text-muted-foreground">Rabatt (brutto)</span>
                    <span className="text-right font-mono">{formatCurrency(Math.abs(creditPreview.discount))}</span>
                  </>
                )}
                <span className="text-muted-foreground">Nettobetrag</span>
                <span className="text-right font-mono">{formatCurrency(creditPreview.subtotal)}</span>
                <span className="text-muted-foreground">
                  MwSt. ({creditPreview.isReverseCharge ? '0 % – Reverse Charge' : `${creditPreview.taxRate} %`})
                </span>
                <span className="text-right font-mono">{formatCurrency(creditPreview.tax)}</span>
                <Separator className="col-span-2 my-0.5" />
                <span className="font-semibold text-[#1a2a5e]">Gesamtbetrag brutto</span>
                <span className="text-right font-mono font-semibold text-purple-700">{formatCurrency(creditPreview.total)}</span>
              </div>
              {creditForm.scope === 'partial' && (
                <p className="text-xs text-muted-foreground">{creditPreview.items.length} Position(en) ausgewählt</p>
              )}
            </div>
          )}

          </div>

          <DialogFooter className="bg-[#f8f9fc] border-t border-[#d8dce6] px-6 py-3 flex-wrap gap-2 rounded-b-lg">
            <Button variant="outline" className="border-[#1a2a5e] bg-[#f5c800] text-[#1a2a5e] hover:bg-[#e0b800]" onClick={() => setCreditDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button
              className="bg-[#f5c800] text-[#1a2a5e] hover:bg-[#e0b800] border border-[#1a2a5e]"
              onClick={onCreateCredit}
              disabled={
                creditForm.scope === 'partial' &&
                (creditPreview == null || creditPreview.items.length === 0)
              }
            >
              {t('financialManagement.createCreditNote')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={gatewayDialogOpen} onOpenChange={setGatewayDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl p-0 gap-0 overflow-hidden flex flex-col">
          <DialogHeader className="bg-[#1a2a5e] px-6 py-4 rounded-t-lg border-b border-[#0f1d45] shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold" style={{ color: '#f5c800' }}>
              <Settings className="h-5 w-5" />
              {t('financialManagement.paymentGateways')}
            </DialogTitle>
            <DialogDescription className="text-blue-200 text-sm">
              Einstellungen für Zahlungsanbieter bearbeiten und speichern.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {selectedGateway && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Name *</Label>
                  <Input
                    required
                    value={selectedGateway.name}
                    onChange={(e) => setSelectedGateway((p) => (p ? { ...p, name: e.target.value } : p))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Currency *</Label>
                  <Input
                    required
                    value={selectedGateway.configuration.currency}
                    onChange={(e) => updateGatewayConfiguration('currency', e.target.value.toUpperCase())}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Processing Fee *</Label>
                  <Input
                    required
                    type="number"
                    step="0.1"
                    value={selectedGateway.configuration.processingFee}
                    onChange={(e) => updateGatewayConfiguration('processingFee', Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="rounded-md border border-input px-3 py-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Aktiv</span>
                  <Switch
                    checked={selectedGateway.isActive}
                    onCheckedChange={(v) => setSelectedGateway((p) => (p ? { ...p, isActive: v } : p))}
                  />
                </div>
              </div>

              <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] px-3 py-2">
                <div className="flex items-center justify-between text-sm">
                  <span><ShieldCheck className="mr-1 inline h-4 w-4" />Fraud Protection</span>
                  <Switch
                    checked={Boolean(selectedGateway.configuration.fraudProtection)}
                    onCheckedChange={(v) => updateGatewayConfiguration('fraudProtection', v)}
                  />
                </div>
              </div>

              {selectedGateway.provider === 'paypal' && (
                <>
                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-semibold text-[#1a2a5e]">Zugang & Umgebung</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>environment *</Label>
                        <Select
                          value={(getConfigString('environment', 'sandbox') as 'sandbox' | 'live')}
                          onValueChange={(value) => updateGatewayConfiguration('environment', value as 'sandbox' | 'live')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sandbox">sandbox</SelectItem>
                            <SelectItem value="live">live</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>merchant_id</Label>
                        <Input
                          value={getConfigString('merchant_id')}
                          onChange={(e) => updateGatewayConfiguration('merchant_id', e.target.value)}
                          placeholder="ABCDEF1234567"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>sandbox_client_id *</Label>
                        <Input
                          required
                          value={getConfigString('sandbox_client_id')}
                          onChange={(e) => updateGatewayConfiguration('sandbox_client_id', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>sandbox_client_secret *</Label>
                        <Input
                          required
                          type="password"
                          value={getConfigString('sandbox_client_secret')}
                          onChange={(e) => updateGatewayConfiguration('sandbox_client_secret', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>live_client_id</Label>
                        <Input
                          value={getConfigString('live_client_id')}
                          onChange={(e) => updateGatewayConfiguration('live_client_id', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>live_client_secret</Label>
                        <Input
                          type="password"
                          value={getConfigString('live_client_secret')}
                          onChange={(e) => updateGatewayConfiguration('live_client_secret', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>api_base_url_sandbox</Label>
                        <Input value={getConfigString('api_base_url_sandbox', 'https://api-m.sandbox.paypal.com')} disabled />
                      </div>
                      <div className="space-y-1">
                        <Label>api_base_url_live</Label>
                        <Input value={getConfigString('api_base_url_live', 'https://api-m.paypal.com')} disabled />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-semibold text-[#1a2a5e]">Sandbox-Testkonto</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>sandbox_portal_url</Label>
                        <Input
                          value={getConfigString('sandbox_portal_url', 'https://sandbox.paypal.com')}
                          onChange={(e) => updateGatewayConfiguration('sandbox_portal_url', e.target.value)}
                          placeholder="https://sandbox.paypal.com"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>sandbox_region</Label>
                        <Input
                          value={getConfigString('sandbox_region', 'DE')}
                          onChange={(e) => updateGatewayConfiguration('sandbox_region', e.target.value.toUpperCase())}
                          placeholder="DE"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>sandbox_account_email</Label>
                        <Input
                          value={getConfigString('sandbox_account_email')}
                          onChange={(e) => updateGatewayConfiguration('sandbox_account_email', e.target.value)}
                          placeholder="sb-xxx@business.example.com"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>sandbox_account_password</Label>
                        <Input
                          type="password"
                          value={getConfigString('sandbox_account_password')}
                          onChange={(e) => updateGatewayConfiguration('sandbox_account_password', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-semibold text-[#1a2a5e]">Checkout & Betragslogik</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>default_currency *</Label>
                        <Input
                          required
                          value={getConfigString('default_currency', 'EUR')}
                          onChange={(e) => updateGatewayConfiguration('default_currency', e.target.value.toUpperCase())}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>allowed_currencies</Label>
                        <Input
                          value={getConfigStringList('allowed_currencies').join(', ')}
                          onChange={(e) => updateGatewayConfiguration('allowed_currencies', parseStringList(e.target.value).map((v) => v.toUpperCase()))}
                          placeholder="EUR, USD"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>payment_intent *</Label>
                        <Select
                          value={(getConfigString('payment_intent', 'CAPTURE') as 'CAPTURE' | 'AUTHORIZE')}
                          onValueChange={(value) => updateGatewayConfiguration('payment_intent', value as 'CAPTURE' | 'AUTHORIZE')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CAPTURE">CAPTURE</SelectItem>
                            <SelectItem value="AUTHORIZE">AUTHORIZE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>amount_source *</Label>
                        <Select
                          value={(getConfigString('amount_source', 'system') as 'system' | 'manual')}
                          onValueChange={(value) => updateGatewayConfiguration('amount_source', value as 'system' | 'manual')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="system">system</SelectItem>
                            <SelectItem value="manual">manual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>description_template</Label>
                        <Input
                          value={getConfigString('description_template')}
                          onChange={(e) => updateGatewayConfiguration('description_template', e.target.value)}
                          placeholder="Bestellung {{orderId}}"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>invoice_id_source</Label>
                        <Select
                          value={(getConfigString('invoice_id_source', 'orderId') as 'orderId' | 'uuid')}
                          onValueChange={(value) => updateGatewayConfiguration('invoice_id_source', value as 'orderId' | 'uuid')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="orderId">orderId</SelectItem>
                            <SelectItem value="uuid">uuid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>return_url *</Label>
                        <Input
                          required
                          value={getConfigString('return_url')}
                          onChange={(e) => updateGatewayConfiguration('return_url', e.target.value)}
                          placeholder="https://shop.de/paypal/success"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>cancel_url *</Label>
                        <Input
                          required
                          value={getConfigString('cancel_url')}
                          onChange={(e) => updateGatewayConfiguration('cancel_url', e.target.value)}
                          placeholder="https://shop.de/paypal/cancel"
                        />
                      </div>
                    </div>
                    <div className="rounded-md border border-input px-3 py-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>send_breakdown</span>
                        <Switch
                          checked={getConfigBoolean('send_breakdown', true)}
                          onCheckedChange={(value) => updateGatewayConfiguration('send_breakdown', value)}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-semibold text-[#1a2a5e]">Frontend / Button / UX</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>button_layout</Label>
                        <Select
                          value={(getConfigString('button_layout', 'vertical') as 'vertical' | 'horizontal')}
                          onValueChange={(value) => updateGatewayConfiguration('button_layout', value as 'vertical' | 'horizontal')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="vertical">vertical</SelectItem>
                            <SelectItem value="horizontal">horizontal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>button_color</Label>
                        <Select
                          value={(getConfigString('button_color', 'gold') as 'gold' | 'blue' | 'silver')}
                          onValueChange={(value) => updateGatewayConfiguration('button_color', value as 'gold' | 'blue' | 'silver')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gold">gold</SelectItem>
                            <SelectItem value="blue">blue</SelectItem>
                            <SelectItem value="silver">silver</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>button_shape</Label>
                        <Select
                          value={(getConfigString('button_shape', 'rect') as 'rect' | 'pill')}
                          onValueChange={(value) => updateGatewayConfiguration('button_shape', value as 'rect' | 'pill')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rect">rect</SelectItem>
                            <SelectItem value="pill">pill</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>button_label</Label>
                        <Select
                          value={(getConfigString('button_label', 'paypal') as 'paypal' | 'pay' | 'checkout')}
                          onValueChange={(value) => updateGatewayConfiguration('button_label', value as 'paypal' | 'pay' | 'checkout')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="paypal">paypal</SelectItem>
                            <SelectItem value="pay">pay</SelectItem>
                            <SelectItem value="checkout">checkout</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>locale</Label>
                        <Input
                          value={getConfigString('locale', 'de-DE')}
                          onChange={(e) => updateGatewayConfiguration('locale', e.target.value)}
                          placeholder="de-DE"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>funding_sources_allowed</Label>
                        <Input
                          value={getConfigStringList('funding_sources_allowed').join(', ')}
                          onChange={(e) => updateGatewayConfiguration('funding_sources_allowed', parseStringList(e.target.value))}
                          placeholder="paypal"
                        />
                      </div>
                    </div>
                    <div className="rounded-md border border-input px-3 py-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>button_enabled</span>
                        <Switch
                          checked={getConfigBoolean('button_enabled', true)}
                          onCheckedChange={(value) => updateGatewayConfiguration('button_enabled', value)}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-semibold text-[#1a2a5e]">Webhooks & Events</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1 md:col-span-2">
                        <Label>webhook_url</Label>
                        <Input
                          value={getConfigString('webhook_url')}
                          onChange={(e) => updateGatewayConfiguration('webhook_url', e.target.value)}
                          placeholder="https://api.de/paypal/webhook"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label>webhook_events</Label>
                        <Textarea
                          value={getConfigStringList('webhook_events').join(', ')}
                          onChange={(e) => updateGatewayConfiguration('webhook_events', parseStringList(e.target.value))}
                          placeholder="CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>webhook_id</Label>
                        <Input
                          value={getConfigString('webhook_id')}
                          onChange={(e) => updateGatewayConfiguration('webhook_id', e.target.value)}
                          placeholder="WH-1234..."
                        />
                      </div>
                    </div>
                    <div className="rounded-md border border-input px-3 py-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>webhooks_enabled</span>
                        <Switch
                          checked={getConfigBoolean('webhooks_enabled', true)}
                          onCheckedChange={(value) => updateGatewayConfiguration('webhooks_enabled', value)}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-semibold text-[#1a2a5e]">Erweiterte / Dev-Settings</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>http_timeout_ms</Label>
                        <Input
                          type="number"
                          min="0"
                          value={getConfigNumber('http_timeout_ms', 10000)}
                          onChange={(e) => updateGatewayConfiguration('http_timeout_ms', Number(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>http_max_retries</Label>
                        <Input
                          type="number"
                          min="0"
                          value={getConfigNumber('http_max_retries', 2)}
                          onChange={(e) => updateGatewayConfiguration('http_max_retries', Number(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>idempotency_key_source</Label>
                        <Select
                          value={(getConfigString('idempotency_key_source', 'orderId') as 'orderId' | 'uuid')}
                          onValueChange={(value) => updateGatewayConfiguration('idempotency_key_source', value as 'orderId' | 'uuid')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="orderId">orderId</SelectItem>
                            <SelectItem value="uuid">uuid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>logging_level</Label>
                        <Select
                          value={(getConfigString('logging_level', 'error') as 'none' | 'error' | 'debug')}
                          onValueChange={(value) => updateGatewayConfiguration('logging_level', value as 'none' | 'error' | 'debug')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">none</SelectItem>
                            <SelectItem value="error">error</SelectItem>
                            <SelectItem value="debug">debug</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>list_page_size_default</Label>
                        <Input
                          type="number"
                          min="1"
                          value={getConfigNumber('list_page_size_default', 50)}
                          onChange={(e) => updateGatewayConfiguration('list_page_size_default', Number(e.target.value) || 1)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>list_max_page_size</Label>
                        <Input
                          type="number"
                          min="1"
                          value={getConfigNumber('list_max_page_size', 100)}
                          onChange={(e) => updateGatewayConfiguration('list_max_page_size', Number(e.target.value) || 1)}
                        />
                      </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="rounded-md border border-input px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>idempotency_enabled</span>
                          <Switch
                            checked={getConfigBoolean('idempotency_enabled', true)}
                            onCheckedChange={(value) => updateGatewayConfiguration('idempotency_enabled', value)}
                          />
                        </div>
                      </div>
                      <div className="rounded-md border border-input px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>log_request_bodies</span>
                          <Switch
                            checked={getConfigBoolean('log_request_bodies', false)}
                            onCheckedChange={(value) => updateGatewayConfiguration('log_request_bodies', value)}
                          />
                        </div>
                      </div>
                      <div className="rounded-md border border-input px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>log_response_bodies</span>
                          <Switch
                            checked={getConfigBoolean('log_response_bodies', false)}
                            onCheckedChange={(value) => updateGatewayConfiguration('log_response_bodies', value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {selectedGateway.provider === 'stripe' && (
                <>
                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-semibold text-[#1a2a5e]">Environment & API-Keys</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>mode *</Label>
                        <Select
                          value={(getConfigString('mode', 'test') as 'test' | 'live')}
                          onValueChange={(value) => updateGatewayConfiguration('mode', value as 'test' | 'live')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="test">test</SelectItem>
                            <SelectItem value="live">live</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>test_publishable_key *</Label>
                        <Input
                          required
                          value={getConfigString('test_publishable_key', '')}
                          onChange={(e) => updateGatewayConfiguration('test_publishable_key', e.target.value)}
                          placeholder="pk_test_..."
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>test_secret_key *</Label>
                        <Input
                          required
                          type="password"
                          value={getConfigString('test_secret_key', '')}
                          onChange={(e) => updateGatewayConfiguration('test_secret_key', e.target.value)}
                          placeholder="sk_test_..."
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>live_publishable_key</Label>
                        <Input
                          value={getConfigString('live_publishable_key', '')}
                          onChange={(e) => updateGatewayConfiguration('live_publishable_key', e.target.value)}
                          placeholder="pk_live_..."
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>live_secret_key</Label>
                        <Input
                          type="password"
                          value={getConfigString('live_secret_key', '')}
                          onChange={(e) => updateGatewayConfiguration('live_secret_key', e.target.value)}
                          placeholder="sk_live_..."
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>account_id</Label>
                        <Input
                          value={getConfigString('account_id', '')}
                          onChange={(e) => updateGatewayConfiguration('account_id', e.target.value)}
                          placeholder="acct_..."
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>api_version</Label>
                        <Input
                          value={getConfigString('api_version', '')}
                          onChange={(e) => updateGatewayConfiguration('api_version', e.target.value)}
                          placeholder="2023-08-16"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-[#1a2a5e]">Checkout & Betragslogik</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-md border border-input px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>use_stripe_checkout</span>
                          <Switch
                            checked={getConfigBoolean('use_stripe_checkout', true)}
                            onCheckedChange={(value) => updateGatewayConfiguration('use_stripe_checkout', value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>payment_mode *</Label>
                        <Select
                          value={(getConfigString('payment_mode', 'payment') as 'payment' | 'subscription')}
                          onValueChange={(value) => updateGatewayConfiguration('payment_mode', value as 'payment' | 'subscription')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="payment">payment</SelectItem>
                            <SelectItem value="subscription">subscription</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>capture_method</Label>
                        <Select
                          value={(getConfigString('capture_method', 'automatic') as 'automatic' | 'manual')}
                          onValueChange={(value) => updateGatewayConfiguration('capture_method', value as 'automatic' | 'manual')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="automatic">automatic</SelectItem>
                            <SelectItem value="manual">manual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>statement_descriptor</Label>
                        <Input
                          value={getConfigString('statement_descriptor', '')}
                          onChange={(e) => updateGatewayConfiguration('statement_descriptor', e.target.value)}
                          placeholder="McRepair.de Repair"
                          maxLength={22}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>success_url *</Label>
                        <Input
                          required
                          value={getConfigString('success_url', '')}
                          onChange={(e) => updateGatewayConfiguration('success_url', e.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>cancel_url *</Label>
                        <Input
                          required
                          value={getConfigString('cancel_url', '')}
                          onChange={(e) => updateGatewayConfiguration('cancel_url', e.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-[#1a2a5e]">Payment-Methoden & Frontend</h4>
                    <div className="space-y-1">
                      <Label>allowed_payment_methods</Label>
                      <Textarea
                        value={getConfigStringList('allowed_payment_methods', ['card', 'paypal']).join(', ')}
                        onChange={(e) => updateGatewayConfiguration('allowed_payment_methods', parseStringList(e.target.value))}
                        placeholder="card, paypal, klarna (kommagetrennt)"
                        className="min-h-20"
                      />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-md border border-input px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>allow_saved_payment_method</span>
                          <Switch
                            checked={getConfigBoolean('allow_saved_payment_method', true)}
                            onCheckedChange={(value) => updateGatewayConfiguration('allow_saved_payment_method', value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>payment_method_config_id</Label>
                        <Input
                          value={getConfigString('payment_method_config_id', '')}
                          onChange={(e) => updateGatewayConfiguration('payment_method_config_id', e.target.value)}
                          placeholder="pmc_..."
                        />
                      </div>
                      <div className="rounded-md border border-input px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>automatic_payment_methods</span>
                          <Switch
                            checked={getConfigBoolean('automatic_payment_methods', true)}
                            onCheckedChange={(value) => updateGatewayConfiguration('automatic_payment_methods', value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>billing_address_collection</Label>
                        <Select
                          value={(getConfigString('billing_address_collection', 'auto') as 'auto' | 'required')}
                          onValueChange={(value) => updateGatewayConfiguration('billing_address_collection', value as 'auto' | 'required')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">auto</SelectItem>
                            <SelectItem value="required">required</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="rounded-md border border-input px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>shipping_address_collection</span>
                          <Switch
                            checked={getConfigBoolean('shipping_address_collection', false)}
                            onCheckedChange={(value) => updateGatewayConfiguration('shipping_address_collection', value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>customer_creation</Label>
                        <Select
                          value={(getConfigString('customer_creation', 'if_required') as 'always' | 'if_required' | 'none')}
                          onValueChange={(value) => updateGatewayConfiguration('customer_creation', value as 'always' | 'if_required' | 'none')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="always">always</SelectItem>
                            <SelectItem value="if_required">if_required</SelectItem>
                            <SelectItem value="none">none</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-[#1a2a5e]">Webhooks & Events</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>webhook_url</Label>
                        <Input
                          value={getConfigString('webhook_url', '')}
                          onChange={(e) => updateGatewayConfiguration('webhook_url', e.target.value)}
                          placeholder="https://api.de/stripe/webhook"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>webhook_endpoint_secret</Label>
                        <Input
                          type="password"
                          value={getConfigString('webhook_endpoint_secret', '')}
                          onChange={(e) => updateGatewayConfiguration('webhook_endpoint_secret', e.target.value)}
                          placeholder="whsec_..."
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>webhook_tolerance_sec</Label>
                        <Input
                          type="number"
                          min="0"
                          value={getConfigNumber('webhook_tolerance_sec', 300)}
                          onChange={(e) => updateGatewayConfiguration('webhook_tolerance_sec', Number(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>webhook_events</Label>
                      <Textarea
                        value={getConfigStringList('webhook_events', ['payment_intent.succeeded']).join(', ')}
                        onChange={(e) => updateGatewayConfiguration('webhook_events', parseStringList(e.target.value))}
                        placeholder="payment_intent.succeeded, charge.refunded (kommagetrennt)"
                        className="min-h-20"
                      />
                    </div>
                    <div className="rounded-md border border-input px-3 py-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>webhooks_enabled</span>
                        <Switch
                          checked={getConfigBoolean('webhooks_enabled', true)}
                          onCheckedChange={(value) => updateGatewayConfiguration('webhooks_enabled', value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-[#1a2a5e]">Erweiterte/Dev-Settings</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>http_timeout_ms</Label>
                        <Input
                          type="number"
                          min="1000"
                          value={getConfigNumber('http_timeout_ms', 10000)}
                          onChange={(e) => updateGatewayConfiguration('http_timeout_ms', Number(e.target.value) || 10000)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>http_max_retries</Label>
                        <Input
                          type="number"
                          min="0"
                          value={getConfigNumber('http_max_retries', 2)}
                          onChange={(e) => updateGatewayConfiguration('http_max_retries', Number(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>idempotency_key_source</Label>
                        <Select
                          value={(getConfigString('idempotency_key_source', 'orderId') as 'orderId' | 'uuid')}
                          onValueChange={(value) => updateGatewayConfiguration('idempotency_key_source', value as 'orderId' | 'uuid')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="orderId">orderId</SelectItem>
                            <SelectItem value="uuid">uuid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>logging_level</Label>
                        <Select
                          value={(getConfigString('logging_level', 'error') as 'none' | 'error' | 'debug')}
                          onValueChange={(value) => updateGatewayConfiguration('logging_level', value as 'none' | 'error' | 'debug')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">none</SelectItem>
                            <SelectItem value="error">error</SelectItem>
                            <SelectItem value="debug">debug</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>list_page_size_default</Label>
                        <Input
                          type="number"
                          min="1"
                          value={getConfigNumber('list_page_size_default', 50)}
                          onChange={(e) => updateGatewayConfiguration('list_page_size_default', Number(e.target.value) || 1)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>list_max_page_size</Label>
                        <Input
                          type="number"
                          min="1"
                          value={getConfigNumber('list_max_page_size', 100)}
                          onChange={(e) => updateGatewayConfiguration('list_max_page_size', Number(e.target.value) || 1)}
                        />
                      </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="rounded-md border border-input px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>idempotency_enabled</span>
                          <Switch
                            checked={getConfigBoolean('idempotency_enabled', true)}
                            onCheckedChange={(value) => updateGatewayConfiguration('idempotency_enabled', value)}
                          />
                        </div>
                      </div>
                      <div className="rounded-md border border-input px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>log_request_bodies</span>
                          <Switch
                            checked={getConfigBoolean('log_request_bodies', false)}
                            onCheckedChange={(value) => updateGatewayConfiguration('log_request_bodies', value)}
                          />
                        </div>
                      </div>
                      <div className="rounded-md border border-input px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>log_response_bodies</span>
                          <Switch
                            checked={getConfigBoolean('log_response_bodies', false)}
                            onCheckedChange={(value) => updateGatewayConfiguration('log_response_bodies', value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {selectedGateway.provider === 'bank_transfer' && (
                <>
                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-semibold text-[#1a2a5e]">Grundeinstellungen</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-md border border-input px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>enabled</span>
                          <Switch
                            checked={getConfigBoolean('enabled', true)}
                            onCheckedChange={(value) => updateGatewayConfiguration('enabled', value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>code *</Label>
                        <Input
                          required
                          value={getConfigString('code', 'bank_transfer')}
                          onChange={(e) => updateGatewayConfiguration('code', e.target.value)}
                          placeholder="bank_transfer"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label>title *</Label>
                        <Input
                          required
                          value={getConfigString('title', '')}
                          onChange={(e) => updateGatewayConfiguration('title', e.target.value)}
                          placeholder="Vorkasse / Banküberweisung"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label>description_checkout</Label>
                        <Textarea
                          value={getConfigString('description_checkout', '')}
                          onChange={(e) => updateGatewayConfiguration('description_checkout', e.target.value)}
                          placeholder="Bitte überweisen Sie den Betrag auf das unten angegebene Konto."
                          className="min-h-16"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-[#1a2a5e]">Bankverbindung</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>account_holder *</Label>
                        <Input
                          required
                          value={getConfigString('account_holder', '')}
                          onChange={(e) => updateGatewayConfiguration('account_holder', e.target.value)}
                          placeholder="Max Mustermann"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>iban *</Label>
                        <Input
                          required
                          value={getConfigString('iban', '')}
                          onChange={(e) => updateGatewayConfiguration('iban', e.target.value)}
                          placeholder="DE00 0000 0000 0000 0000 00"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>bic</Label>
                        <Input
                          value={getConfigString('bic', '')}
                          onChange={(e) => updateGatewayConfiguration('bic', e.target.value)}
                          placeholder="ABCDEFGHXXX"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>bank_name</Label>
                        <Input
                          value={getConfigString('bank_name', '')}
                          onChange={(e) => updateGatewayConfiguration('bank_name', e.target.value)}
                          placeholder="Musterbank"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label>payment_reference_template *</Label>
                        <Input
                          required
                          value={getConfigString('payment_reference_template', '')}
                          onChange={(e) => updateGatewayConfiguration('payment_reference_template', e.target.value)}
                          placeholder="Bestellnr. {{orderId}}"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-[#1a2a5e]">Betrag & Regeln</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>payment_term_days</Label>
                        <Input
                          type="number"
                          min="0"
                          value={getConfigNumber('payment_term_days', 14)}
                          onChange={(e) => updateGatewayConfiguration('payment_term_days', Number(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>initial_order_status *</Label>
                        <Input
                          required
                          value={getConfigString('initial_order_status', 'pending_payment')}
                          onChange={(e) => updateGatewayConfiguration('initial_order_status', e.target.value)}
                          placeholder="pending_payment"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>min_order_total</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={getConfigNumber('min_order_total', 0)}
                          onChange={(e) => updateGatewayConfiguration('min_order_total', Number(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>max_order_total</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={getConfigNumber('max_order_total', 10000)}
                          onChange={(e) => updateGatewayConfiguration('max_order_total', Number(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>expire_action</Label>
                        <Select
                          value={(getConfigString('expire_action', 'cancel') as 'cancel' | 'mark_expired' | 'none')}
                          onValueChange={(value) => updateGatewayConfiguration('expire_action', value as 'cancel' | 'mark_expired' | 'none')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cancel">cancel</SelectItem>
                            <SelectItem value="mark_expired">mark_expired</SelectItem>
                            <SelectItem value="none">none</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>reporting_tag</Label>
                        <Input
                          value={getConfigString('reporting_tag', 'BANK_TRANSFER')}
                          onChange={(e) => updateGatewayConfiguration('reporting_tag', e.target.value)}
                          placeholder="BANK_TRANSFER"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>allowed_customer_groups</Label>
                      <Textarea
                        value={getConfigStringList('allowed_customer_groups', ['b2c', 'b2b']).join(', ')}
                        onChange={(e) => updateGatewayConfiguration('allowed_customer_groups', parseStringList(e.target.value))}
                        placeholder="b2c, b2b (kommagetrennt)"
                        className="min-h-16"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>allowed_countries</Label>
                      <Textarea
                        value={getConfigStringList('allowed_countries', ['DE', 'AT', 'CH']).join(', ')}
                        onChange={(e) => updateGatewayConfiguration('allowed_countries', parseStringList(e.target.value))}
                        placeholder="DE, AT, CH (kommagetrennt)"
                        className="min-h-16"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>allowed_shipping_methods</Label>
                      <Textarea
                        value={getConfigStringList('allowed_shipping_methods', []).join(', ')}
                        onChange={(e) => updateGatewayConfiguration('allowed_shipping_methods', parseStringList(e.target.value))}
                        placeholder="standard, express (kommagetrennt)"
                        className="min-h-16"
                      />
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="rounded-md border border-input px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>expire_unpaid_orders</span>
                          <Switch
                            checked={getConfigBoolean('expire_unpaid_orders', true)}
                            onCheckedChange={(value) => updateGatewayConfiguration('expire_unpaid_orders', value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-[#1a2a5e]">Backoffice & E-Mail</h4>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="rounded-md border border-input px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>admin_can_mark_paid *</span>
                          <Switch
                            checked={getConfigBoolean('admin_can_mark_paid', true)}
                            onCheckedChange={(value) => updateGatewayConfiguration('admin_can_mark_paid', value)}
                          />
                        </div>
                      </div>
                      <div className="rounded-md border border-input px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>email_instructions_enabled</span>
                          <Switch
                            checked={getConfigBoolean('email_instructions_enabled', true)}
                            onCheckedChange={(value) => updateGatewayConfiguration('email_instructions_enabled', value)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>mark_paid_requires_fields</Label>
                      <Textarea
                        value={getConfigStringList('mark_paid_requires_fields', ['amount', 'payment_date']).join(', ')}
                        onChange={(e) => updateGatewayConfiguration('mark_paid_requires_fields', parseStringList(e.target.value))}
                        placeholder="amount, payment_date (kommagetrennt)"
                        className="min-h-16"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>email_instructions_text</Label>
                      <Textarea
                        value={getConfigString('email_instructions_text', '')}
                        onChange={(e) => updateGatewayConfiguration('email_instructions_text', e.target.value)}
                        placeholder="Bitte überweisen Sie den Betrag innerhalb von 14 Tagen..."
                        className="min-h-20"
                      />
                    </div>
                  </div>
                </>
              )}

              {selectedGateway.provider === 'cash' && (
                <>
                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-semibold text-[#1a2a5e]">Grundeinstellungen</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-md border border-input px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>enabled</span>
                          <Switch
                            checked={getConfigBoolean('enabled', true)}
                            onCheckedChange={(value) => updateGatewayConfiguration('enabled', value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>code *</Label>
                        <Input
                          required
                          value={getConfigString('code', 'cash_on_pickup')}
                          onChange={(e) => updateGatewayConfiguration('code', e.target.value)}
                          placeholder="cash_on_pickup"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label>title *</Label>
                        <Input
                          required
                          value={getConfigString('title', '')}
                          onChange={(e) => updateGatewayConfiguration('title', e.target.value)}
                          placeholder="Barzahlung bei Abholung"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label>description_checkout</Label>
                        <Textarea
                          value={getConfigString('description_checkout', '')}
                          onChange={(e) => updateGatewayConfiguration('description_checkout', e.target.value)}
                          placeholder="Sie bezahlen bei Abholung in bar."
                          className="min-h-16"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>mode *</Label>
                        <Select
                          value={(getConfigString('cash_mode', 'pickup') as 'pickup' | 'delivery' | 'both')}
                          onValueChange={(value) => updateGatewayConfiguration('cash_mode', value as 'pickup' | 'delivery' | 'both')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pickup">pickup</SelectItem>
                            <SelectItem value="delivery">delivery</SelectItem>
                            <SelectItem value="both">both</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>initial_order_status *</Label>
                        <Input
                          required
                          value={getConfigString('initial_order_status', 'waiting_for_pickup')}
                          onChange={(e) => updateGatewayConfiguration('initial_order_status', e.target.value)}
                          placeholder="waiting_for_pickup"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>sort_order</Label>
                        <Input
                          type="number"
                          min="0"
                          value={getConfigNumber('sort_order', 20)}
                          onChange={(e) => updateGatewayConfiguration('sort_order', Number(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>reporting_tag</Label>
                        <Input
                          value={getConfigString('reporting_tag', 'CASH')}
                          onChange={(e) => updateGatewayConfiguration('reporting_tag', e.target.value)}
                          placeholder="CASH"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-[#1a2a5e]">Betrag & Regeln</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>min_order_total</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={getConfigNumber('min_order_total', 0)}
                          onChange={(e) => updateGatewayConfiguration('min_order_total', Number(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>max_order_total</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={getConfigNumber('max_order_total', 1000)}
                          onChange={(e) => updateGatewayConfiguration('max_order_total', Number(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>fee_type</Label>
                        <Select
                          value={(getConfigString('fee_type', 'none') as 'none' | 'surcharge' | 'discount')}
                          onValueChange={(value) => updateGatewayConfiguration('fee_type', value as 'none' | 'surcharge' | 'discount')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">none</SelectItem>
                            <SelectItem value="surcharge">surcharge</SelectItem>
                            <SelectItem value="discount">discount</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>fee_value</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={getConfigNumber('fee_value', 0)}
                          onChange={(e) => updateGatewayConfiguration('fee_value', Number(e.target.value) || 0)}
                        />
                      </div>
                      <div className="rounded-md border border-input px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>fee_is_percentage</span>
                          <Switch
                            checked={getConfigBoolean('fee_is_percentage', false)}
                            onCheckedChange={(value) => updateGatewayConfiguration('fee_is_percentage', value)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>allowed_customer_groups</Label>
                      <Textarea
                        value={getConfigStringList('allowed_customer_groups', ['b2c']).join(', ')}
                        onChange={(e) => updateGatewayConfiguration('allowed_customer_groups', parseStringList(e.target.value))}
                        placeholder="b2c, b2b (kommagetrennt)"
                        className="min-h-16"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>allowed_shipping_methods</Label>
                      <Textarea
                        value={getConfigStringList('allowed_shipping_methods', []).join(', ')}
                        onChange={(e) => updateGatewayConfiguration('allowed_shipping_methods', parseStringList(e.target.value))}
                        placeholder="pickup_store_1 (kommagetrennt)"
                        className="min-h-16"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>allowed_product_types</Label>
                      <Textarea
                        value={getConfigStringList('allowed_product_types', ['physical']).join(', ')}
                        onChange={(e) => updateGatewayConfiguration('allowed_product_types', parseStringList(e.target.value))}
                        placeholder="physical (kommagetrennt)"
                        className="min-h-16"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-[#1a2a5e]">Kassenbeleg & Backoffice</h4>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="rounded-md border border-input px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>admin_can_mark_paid *</span>
                          <Switch
                            checked={getConfigBoolean('admin_can_mark_paid', true)}
                            onCheckedChange={(value) => updateGatewayConfiguration('admin_can_mark_paid', value)}
                          />
                        </div>
                      </div>
                      <div className="rounded-md border border-input px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>mark_paid_on_fulfillment</span>
                          <Switch
                            checked={getConfigBoolean('mark_paid_on_fulfillment', false)}
                            onCheckedChange={(value) => updateGatewayConfiguration('mark_paid_on_fulfillment', value)}
                          />
                        </div>
                      </div>
                      <div className="rounded-md border border-input px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>cash_receipt_number_enabled</span>
                          <Switch
                            checked={getConfigBoolean('cash_receipt_number_enabled', true)}
                            onCheckedChange={(value) => updateGatewayConfiguration('cash_receipt_number_enabled', value)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>cash_receipt_number_format</Label>
                      <Input
                        value={getConfigString('cash_receipt_number_format', '')}
                        onChange={(e) => updateGatewayConfiguration('cash_receipt_number_format', e.target.value)}
                        placeholder="POS{{storeId}}-{{yyyy}}{{MM}}{{dd}}-{{seq}}"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>mark_paid_requires_fields</Label>
                      <Textarea
                        value={getConfigStringList('mark_paid_requires_fields', ['amount', 'payment_date', 'receipt_no']).join(', ')}
                        onChange={(e) => updateGatewayConfiguration('mark_paid_requires_fields', parseStringList(e.target.value))}
                        placeholder="amount, payment_date, receipt_no (kommagetrennt)"
                        className="min-h-16"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-[#1a2a5e]">E-Mail-Hinweise</h4>
                    <div className="rounded-md border border-input px-3 py-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>email_instructions_enabled</span>
                        <Switch
                          checked={getConfigBoolean('email_instructions_enabled', true)}
                          onCheckedChange={(value) => updateGatewayConfiguration('email_instructions_enabled', value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>email_instructions_text</Label>
                      <Textarea
                        value={getConfigString('email_instructions_text', '')}
                        onChange={(e) => updateGatewayConfiguration('email_instructions_text', e.target.value)}
                        placeholder="Bitte halten Sie den Betrag passend bereit."
                        className="min-h-20"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {selectedGateway && (() => {
            const validation = validateGatewayConfiguration();
            return (
              <>
                {!validation.valid && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm">
                    <div className="font-semibold text-red-900 mb-2">Validierungsfehler:</div>
                    <ul className="list-inside list-disc space-y-1 text-red-800">
                      {validation.errors.map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            );
          })()}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-[#d8dce6] bg-[#f8f9fc] rounded-b-lg shrink-0 flex justify-end gap-2">
            <Button variant="outline" className="border-[#1a2a5e] text-[#1a2a5e] hover:bg-[#1a2a5e] hover:text-white" onClick={() => setGatewayDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button
              className="bg-[#f5c800] text-[#1a2a5e] font-semibold hover:bg-[#e0b800]"
              onClick={onUpdateGateway}
              disabled={(() => {
                const validation = validateGatewayConfiguration();
                return !validation.valid;
              })()}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default FinancialManagement;
