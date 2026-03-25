import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/useToast';
import {
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
  getPayments,
  processRefund,
  runDunningJob,
  searchCustomers,
  sendInvoice,
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
  type PaymentGateway
} from '@/api/financial';
import {
  AlertTriangle,
  Banknote,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  ListChecks,
  Mail,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  SkipForward,
  Settings,
  ShieldCheck,
  TrendingUp,
  Wallet,
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

const paymentMethodLabel: Record<Payment['paymentMethod'], string> = {
  bank_transfer: 'Banküberweisung',
  credit_card: 'Kreditkarte',
  debit_card: 'Debitkarte',
  paypal: 'PayPal',
  stripe: 'Stripe'
};

const formatCurrency = (value: number, currency = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(Number(value || 0));

const toAmountNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const normalized = value.replace(/\./g, '').replace(',', '.').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

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
  applyEarlyDiscount: boolean;
  earlyDiscountPercent: string;
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

export function FinancialManagement() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [report, setReport] = useState<FinancialReport | null>(null);
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<Invoice[]>([]);

  const [invoiceFilters, setInvoiceFilters] = useState({ status: 'all', dateFrom: '', dateTo: '' });
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
  const [gatewayDialogOpen, setGatewayDialogOpen] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceDetailPayments, setInvoiceDetailPayments] = useState<Payment[]>([]);
  const [invoiceDetailCreditNotes, setInvoiceDetailCreditNotes] = useState<Partial<Invoice>[]>([]);
  const [invoiceDetailLoading, setInvoiceDetailLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway | null>(null);

  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerSearchResult[]>([]);

  const [invoiceForm, setInvoiceForm] = useState({
    orderId: '',
    customerId: '',
    customerName: '',
    customerEmail: '',
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    paymentTerms: 'Net 14',
    notes: '',
    items: [emptyLineItem()]
  });

  const [fromRepairForm, setFromRepairForm] = useState({
    repairOrderIds: '',
    taxRate: '19',
    discount: '0',
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    paymentTerms: 'Net 14',
    notes: '',
    numberPrefix: 'INV-'
  });

  const [statusForm, setStatusForm] = useState<{ status: InvoiceStatus; notes: string }>({
    status: 'pending_approval',
    notes: ''
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    currency: 'EUR',
    paymentMethod: 'bank_transfer',
    gatewayResponse: '',
    scope: 'partial' as 'partial' | 'full',
    reference: '',
    internalNote: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    notifyCustomer: false,
  });

  const [creditForm, setCreditForm] = useState({
    reason: '',
    taxRate: '19',
    scope: 'full' as 'full' | 'partial',
    discount: '0',
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    numberPrefix: 'CN',
    notifyCustomer: false,
  });
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
    applyEarlyDiscount: false,
    earlyDiscountPercent: '2',
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

  const selectedInvoiceAddress = useMemo(() => {
    if (!selectedInvoice) return null;
    const src: any = selectedInvoice;
    return (
      src.invoiceAddress ||
      src.billingAddress ||
      src.customerAddress ||
      src.customer?.invoiceAddress ||
      src.customer?.billingAddress ||
      null
    );
  }, [selectedInvoice]);

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
              const qty = Number(ov?.quantity) > 0 ? Number(ov.quantity) : item.quantity;
              const price = Number(ov?.unitPrice) >= 0 ? Number(ov.unitPrice) : Math.abs(item.unitPrice);
              return {
                description: item.description,
                quantity: qty,
                unitPrice: -price,
                total: -(qty * price),
                type: item.type,
              };
            });
    const subtotal = activeItems.reduce((s, i) => s + i.total, 0);
    const taxRate = Number(creditForm.taxRate) / 100;
    const tax = subtotal * taxRate;
    const discount = -(Math.abs(Number(creditForm.discount) || 0));
    const total = subtotal + tax + discount;
    return { items: activeItems, subtotal, tax, discount, total };
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
    return Math.max(0, toAmountNumber(selectedInvoice.total) - toAmountNumber(selectedInvoice.paidAmount));
  }, [selectedInvoice]);

  const canRecordPayment = (invoice?: Invoice | null) => {
    if (!invoice) return false;
    if (invoice.isCreditNote) return false;
    if (!paymentEligibleInvoiceStatuses.includes(invoice.status)) return false;
    const remaining = Math.max(0, toAmountNumber(invoice.total) - toAmountNumber(invoice.paidAmount));
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

  const dunningEligibleInvoices = useMemo(() => {
    const byId = new Map<string, Invoice>();

    for (const invoice of overdueInvoices) {
      byId.set(invoice._id, invoice);
    }

    for (const invoice of invoices) {
      if (invoice.status === 'overdue') {
        byId.set(invoice._id, invoice);
      }
    }

    return Array.from(byId.values());
  }, [overdueInvoices, invoices]);

  const selectedDunningQueueItem = useMemo(() => {
    if (!selectedInvoice) return null;
    return dunningQueue.find((item) => item.invoiceId === selectedInvoice._id) || null;
  }, [dunningQueue, selectedInvoice]);

  const generatedSendMessage = useMemo(() => {
    if (!selectedInvoice) return '';

    const openAmount = Math.max(0, Number(selectedInvoice.total || 0) - Number(selectedInvoice.paidAmount || 0));
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
      ['Gesamtbetrag', formatCurrency(selectedInvoice.total || 0)],
      ['Offener Betrag', formatCurrency(openAmount)]
    ];

    if (isDetailed && sendComposerForm.includePaymentTerms) {
      invoiceFacts.push(['Zahlungsziel', selectedInvoice.paymentTerms || '-']);
    }

    if (isDetailed && sendComposerForm.includeTaxBreakdown) {
      invoiceFacts.push(['Steuer', formatCurrency(selectedInvoice.tax || 0)]);
    }

    if (isDetailed && sendComposerForm.includeDiscountBreakdown) {
      invoiceFacts.push(['Rabatt', formatCurrency(selectedInvoice.discount || 0)]);
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
        lines.push(`- ${item.description || '-'} | ${item.quantity} x ${formatCurrency(item.unitPrice || 0)} = ${formatCurrency(item.total || 0)}`);
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

    if (sendComposerForm.applyEarlyDiscount) {
      lines.push(`Bei fruehzeitiger Zahlung kann ein Skonto von ${sendComposerForm.earlyDiscountPercent}% beruecksichtigt werden.`);
    }

    lines.push('');
    lines.push(sendComposerForm.closingText);
    lines.push(sendComposerForm.legalFooter);

    return lines.filter((line, index, arr) => !(line === '' && arr[index - 1] === '')).join('\n');
  }, [selectedInvoice, sendComposerForm]);

  const generatedAsciiPreview = useMemo(() => {
    if (!selectedInvoice) return '';
    const openAmount = Math.max(0, Number(selectedInvoice.total || 0) - Number(selectedInvoice.paidAmount || 0));
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
    lines.push(`Gesamt: ${formatCurrency(selectedInvoice.total || 0)}`);
    lines.push(`Offen: ${formatCurrency(openAmount)}`);
    lines.push(line);
    lines.push(generatedSendMessage);
    lines.push(line);

    return lines.join('\n');
  }, [selectedInvoice, sendComposerForm.subject, sendComposerForm.recipientEmail, sendComposerMode, generatedSendMessage]);

  const generatedHtmlPreview = useMemo(() => {
    if (!selectedInvoice) return '';

    const openAmount = Math.max(0, Number(selectedInvoice.total || 0) - Number(selectedInvoice.paidAmount || 0));
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
      ['Gesamtbetrag', formatCurrency(selectedInvoice.total || 0)],
      ['Offener Betrag', formatCurrency(openAmount)],
      ...(isDetailed && sendComposerForm.includePaymentTerms ? [['Zahlungsziel', selectedInvoice.paymentTerms || '-']] : []),
      ...(isDetailed && sendComposerForm.includeTaxBreakdown ? [['Steuer', formatCurrency(selectedInvoice.tax || 0)]] : []),
      ...(isDetailed && sendComposerForm.includeDiscountBreakdown ? [['Rabatt', formatCurrency(selectedInvoice.discount || 0)]] : [])
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
        <div style="border:1px solid ${cardBorder};border-radius:8px;padding:10px;">Gesamt: ${escapeHtml(formatCurrency(selectedInvoice.total || 0))}</div>
        <div style="border:1px solid ${sendComposerForm.emphasizeTotals ? sendComposerForm.accentColor : cardBorder};border-radius:8px;padding:10px;font-weight:${sendComposerForm.emphasizeTotals ? '700' : '500'};color:${sendComposerForm.emphasizeTotals ? sendComposerForm.accentColor : '#111827'};">Offen: ${escapeHtml(formatCurrency(openAmount))}</div>
        <div style="border:1px solid ${cardBorder};border-radius:8px;padding:10px;">Zahlungsziel: ${escapeHtml(sendComposerForm.includePaymentTerms ? (selectedInvoice.paymentTerms || '-') : 'ausgeblendet')}</div>
      </div>

      <div style="margin-top:${spacing};white-space:pre-wrap;">${escapeHtml(sendComposerForm.closingText)}</div>
      <div style="margin-top:8px;color:#6b7280;font-size:12px;">${escapeHtml(sendComposerForm.legalFooter)}</div>
    </div>
  </div>
</div>
`;
  }, [selectedInvoice, sendComposerForm, sendComposerMode, generatedSendMessage]);

  const dunningTimeline = useMemo(() => {
    if (!selectedInvoice) return [] as Array<{ id: string; title: string; detail: string; at?: string; severity: 'neutral' | 'info' | 'warning' | 'success' | 'critical' }>;

    const entries: Array<{ id: string; title: string; detail: string; at?: string; severity: 'neutral' | 'info' | 'warning' | 'success' | 'critical' }> = [];

    entries.push({
      id: 'created',
      title: 'Rechnung erstellt',
      detail: `Status bei Anlage: ${selectedInvoice.status}`,
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
      entries.push({ id: 'paid', title: 'Rechnung bezahlt', detail: `Bezahlt: ${formatCurrency(selectedInvoice.paidAmount || 0)}`, at: selectedInvoice.paidAt, severity: 'success' });
    }
    if (selectedInvoice.cancelledAt) {
      entries.push({ id: 'cancelled', title: 'Rechnung storniert', detail: 'Rechnung wurde storniert', at: selectedInvoice.cancelledAt, severity: 'critical' });
    }

    entries.push({
      id: 'updated',
      title: 'Letzte Aktualisierung',
      detail: `Aktueller Status: ${selectedInvoice.status}`,
      at: selectedInvoice.updatedAt,
      severity: 'neutral'
    });

    if (selectedDunningQueueItem) {
      entries.push({
        id: 'queue_state',
        title: 'Aktueller Mahnlauf-Queue Status',
        detail: `${selectedDunningQueueItem.status}${selectedDunningQueueItem.note ? ` - ${selectedDunningQueueItem.note}` : ''}`,
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
  }, [selectedInvoice, selectedDunningQueueItem]);

  const totals = useMemo(() => {
    const paidAmount = payments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const openInvoices = invoices.filter((i) => !['paid', 'cancelled', 'credited'].includes(i.status));
    const openAmount = openInvoices.reduce((sum, i) => sum + Math.max(0, Number(i.total || 0) - Number(i.paidAmount || 0)), 0);
    const overdueAmount = dunningEligibleInvoices.reduce((sum, i) => sum + Math.max(0, Number(i.total || 0) - Number(i.paidAmount || 0)), 0);
    return {
      paidAmount,
      openCount: openInvoices.length,
      openAmount,
      overdueCount: dunningEligibleInvoices.length,
      overdueAmount
    };
  }, [payments, invoices, dunningEligibleInvoices]);

  const invoiceDraftTotals = useMemo(() => {
    const subtotal = invoiceForm.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
    const tax = subtotal * 0.19;
    return { subtotal, tax, total: subtotal + tax };
  }, [invoiceForm.items]);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const [paymentsRes, invoicesRes, reportRes, gatewaysRes, overdueRes, dunningRunsRes] = await Promise.all([
        getPayments(),
        getInvoices(),
        getFinancialReports(),
        getPaymentGateways(),
        getOverdueInvoices(),
        getDunningRuns()
      ]);

      setPayments(paymentsRes?.payments || []);
      setInvoices(invoicesRes?.invoices || []);
      setReport(reportRes?.report || reportRes || null);
      setGateways(gatewaysRes?.gateways || []);
      setOverdueInvoices(overdueRes?.invoices || []);
      setDunningRuns(dunningRunsRes?.runs || []);
    } catch (error: any) {
      toast({
        title: 'Fehler',
        description: error.message || 'Finanzdaten konnten nicht geladen werden.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancialData();
  }, []);

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

  const onApplyInvoiceFilters = async () => {
    try {
      const params: Record<string, string> = {};
      if (invoiceFilters.status !== 'all') params.status = invoiceFilters.status;
      if (invoiceFilters.dateFrom) params.dateFrom = invoiceFilters.dateFrom;
      if (invoiceFilters.dateTo) params.dateTo = invoiceFilters.dateTo;
      const res = await getInvoices(params);
      setInvoices(res?.invoices || []);
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message || 'Rechnungsfilter fehlgeschlagen.', variant: 'destructive' });
    }
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
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message || 'Payment-Filter fehlgeschlagen.', variant: 'destructive' });
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
        (item as any)[field] = Number(value);
      } else {
        (item as any)[field] = value;
      }

      items[index] = item;
      return { ...prev, items };
    });
  };

  const onCreateInvoice = async () => {
    const items = invoiceForm.items
      .filter((item) => item.description.trim().length > 0)
      .map((item, index) => ({
        _id: `draft-item-${index}`,
        ...item,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        total: Number(item.quantity || 0) * Number(item.unitPrice || 0)
      }));

    if (!invoiceForm.customerId || items.length === 0) {
      toast({ title: 'Fehler', description: 'Bitte Kunde waehlen und Positionen erfassen.', variant: 'destructive' });
      return;
    }

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax = subtotal * 0.19;

    try {
      await createInvoice({
        orderId: invoiceForm.orderId,
        customerId: invoiceForm.customerId,
        customerName: invoiceForm.customerName,
        customerEmail: invoiceForm.customerEmail,
        items,
        subtotal,
        tax,
        discount: 0,
        total: subtotal + tax,
        dueDate: invoiceForm.dueDate,
        notes: invoiceForm.notes,
        paymentTerms: invoiceForm.paymentTerms,
        template: 'default'
      });

      toast({ title: 'Erfolg', description: 'Rechnung erstellt.' });
      setInvoiceDialogOpen(false);
      fetchFinancialData();
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message || 'Rechnungserstellung fehlgeschlagen.', variant: 'destructive' });
    }
  };

  const onCreateInvoiceFromRepairs = async () => {
    const repairOrderIds = fromRepairForm.repairOrderIds.split(',').map((id) => id.trim()).filter(Boolean);
    if (repairOrderIds.length === 0) {
      toast({ title: 'Fehler', description: 'Bitte mindestens eine RepairOrder-ID angeben.', variant: 'destructive' });
      return;
    }

    try {
      await generateInvoiceFromRepairs(repairOrderIds, {
        taxRate: Number(fromRepairForm.taxRate) / 100,
        discount: Number(fromRepairForm.discount),
        dueDate: fromRepairForm.dueDate,
        paymentTerms: fromRepairForm.paymentTerms,
        notes: fromRepairForm.notes,
        numberPrefix: fromRepairForm.numberPrefix
      });

      toast({ title: 'Erfolg', description: 'Rechnung aus RepairOrders erstellt.' });
      setFromRepairDialogOpen(false);
      fetchFinancialData();
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message || 'Generierung aus RepairOrders fehlgeschlagen.', variant: 'destructive' });
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
      if (result.invoice) setSelectedInvoice(result.invoice as Invoice);
    } catch {
      // silently fall back to invoice data already in state
    } finally {
      setInvoiceDetailLoading(false);
    }
  };

  const openSendComposer = (invoice: Invoice, mode: SendComposerMode = 'invoice') => {
    const defaultOpenAmount = Math.max(0, Number(invoice.total || 0) - Number(invoice.paidAmount || 0));
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
      closingText: 'Vielen Dank fuer Ihr Vertrauen.',
      legalFooter: 'Diese Nachricht wurde automatisch erstellt.',
      includeItems: true,
      includeTaxBreakdown: true,
      includeDiscountBreakdown: true,
      includePaymentTerms: true,
      allowPartialPayment: mode === 'reminder',
      applyLateFee: mode === 'reminder',
      lateFeePercent: '5',
      applyEarlyDiscount: false,
      earlyDiscountPercent: '2',
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
    setSendComposerOpen(true);
  };

  const onSendInvoice = async (invoiceId: string, email?: string, message?: string) => {
    try {
      await sendInvoice(invoiceId, email, message);
      toast({ title: 'Erfolg', description: 'Rechnung versendet.' });
      fetchFinancialData();
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message || 'Versand fehlgeschlagen.', variant: 'destructive' });
    }
  };

  const onSubmitSendComposer = async () => {
    if (!selectedInvoice) return;
    if (!sendComposerForm.recipientEmail.trim()) {
      toast({ title: 'Fehler', description: 'Bitte Empfaenger-E-Mail eintragen.', variant: 'destructive' });
      return;
    }

    const basePreview = sendComposerForm.previewFormat === 'ascii' ? generatedAsciiPreview : generatedHtmlPreview;
    const message = sendComposerForm.customMessage.trim() || basePreview;
    const operationalNotes: string[] = [];
    if (sendComposerForm.attachPdf) operationalNotes.push('PDF-Anhang vorgesehen');
    if (sendComposerForm.sendCopyInternal && sendComposerForm.internalCopyEmail.trim()) {
      operationalNotes.push(`Interne Kopie an ${sendComposerForm.internalCopyEmail.trim()}`);
    }

    const finalMessage = operationalNotes.length > 0
      ? `${message}\n\n---\nInterne Versandkonfiguration:\n- ${operationalNotes.join('\n- ')}`
      : message;

    await onSendInvoice(selectedInvoice._id, sendComposerForm.recipientEmail.trim(), finalMessage);
    if (sendComposerMode === 'reminder') {
      onMarkDunningReminderSent(selectedInvoice._id);
    }
    setSendComposerOpen(false);
  };

  const onChangeStatus = async () => {
    if (!selectedInvoice) return;

    try {
      await changeInvoiceStatus(selectedInvoice._id, statusForm.status, statusForm.notes);
      toast({ title: 'Erfolg', description: 'Status aktualisiert.' });
      setStatusDialogOpen(false);
      setSelectedInvoice(null);
      fetchFinancialData();
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message || 'Statuswechsel fehlgeschlagen.', variant: 'destructive' });
    }
  };

  const openPaymentDialog = (invoice: Invoice, presetAmount?: number) => {
    if (!canRecordPayment(invoice)) {
      const remaining = Math.max(0, toAmountNumber(invoice.total) - toAmountNumber(invoice.paidAmount));
      const reason = invoice.isCreditNote
        ? 'Für Gutschriften können keine Teilzahlungen erfasst werden.'
        : remaining <= 0
          ? 'Diese Rechnung ist bereits vollständig bezahlt.'
          : `Für Rechnungsstatus "${invoice.status}" kann keine Zahlung erfasst werden.`;
      toast({ title: 'Nicht möglich', description: reason, variant: 'destructive' });
      return;
    }

    const remaining = Math.max(0, toAmountNumber(invoice.total) - toAmountNumber(invoice.paidAmount));
    if (remaining <= 0) {
      toast({ title: 'Nicht möglich', description: 'Diese Rechnung ist bereits vollständig bezahlt.', variant: 'destructive' });
      return;
    }

    const initialAmount = Math.max(0, Math.min(Number(presetAmount ?? remaining), remaining));

    setSelectedInvoice(invoice);
    setPaymentForm({
      amount: String(initialAmount || ''),
      currency: 'EUR',
      paymentMethod: 'bank_transfer',
      gatewayResponse: '',
      scope: initialAmount >= remaining && remaining > 0 ? 'full' : 'partial',
      reference: '',
      internalNote: '',
      paymentDate: new Date().toISOString().slice(0, 10),
      notifyCustomer: false,
    });
    setPaymentDialogOpen(true);
  };

  const onAddPayment = async () => {
    if (!selectedInvoice) return;

    const amount = Number(paymentForm.amount || 0);
    if (amount <= 0) {
      toast({ title: 'Fehler', description: 'Bitte gueltigen Betrag eingeben.', variant: 'destructive' });
      return;
    }

    const remaining = Math.max(0, Number(selectedInvoice.total || 0) - Number(selectedInvoice.paidAmount || 0));
    if (amount > remaining + 0.01) {
      toast({ title: 'Fehler', description: `Betrag ueberschreitet den offenen Betrag (${formatCurrency(remaining)}).`, variant: 'destructive' });
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

      toast({ title: 'Erfolg', description: paymentForm.scope === 'full' ? 'Zahlung vollständig verbucht.' : 'Teilzahlung verbucht.' });
      setPaymentDialogOpen(false);
      setSelectedInvoice(null);
      setPaymentForm({ amount: '', currency: 'EUR', paymentMethod: 'bank_transfer', gatewayResponse: '', scope: 'partial', reference: '', internalNote: '', paymentDate: new Date().toISOString().slice(0, 10), notifyCustomer: false });
      fetchFinancialData();
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message || 'Teilzahlung fehlgeschlagen.', variant: 'destructive' });
    }
  };

  const openCreditDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setCreditForm({
      reason: '',
      taxRate: '19',
      scope: 'full',
      discount: '0',
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      numberPrefix: 'CN',
      notifyCustomer: false,
    });
    setCreditItemOverrides(
      (invoice.items || []).map(() => ({ included: true, quantity: '', unitPrice: '' }))
    );
    setCreditDialogOpen(true);
  };

  const onCreateCredit = async () => {
    if (!selectedInvoice) return;
    const preview = creditPreview;
    if (!preview) return;
    if (creditForm.scope === 'partial' && preview.items.length === 0) {
      toast({ title: 'Fehler', description: 'Bitte mindestens eine Position auswählen.', variant: 'destructive' });
      return;
    }

    try {
      await createCreditNote(selectedInvoice._id, {
        reason: creditForm.reason,
        taxRate: Number(creditForm.taxRate) / 100,
        discount: Number(creditForm.discount) || 0,
        dueDate: creditForm.dueDate,
        numberPrefix: creditForm.numberPrefix || 'CN',
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

      toast({ title: 'Erfolg', description: 'Gutschrift erstellt.' });
      setCreditDialogOpen(false);
      setSelectedInvoice(null);
      setCreditForm({ reason: '', taxRate: '19', scope: 'full', discount: '0', dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), numberPrefix: 'CN', notifyCustomer: false });
      setCreditItemOverrides([]);
      fetchFinancialData();
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message || 'Gutschrift fehlgeschlagen.', variant: 'destructive' });
    }
  };

  const onRefund = async () => {
    if (!selectedPayment) return;

    const amount = Number(refundForm.amount || 0);
    if (amount <= 0) {
      toast({ title: 'Fehler', description: 'Bitte einen gültigen Betrag angeben.', variant: 'destructive' });
      return;
    }
    if (!refundForm.reason.trim() && !refundForm.reasonCategory) {
      toast({ title: 'Fehler', description: 'Bitte Grund oder Kategorie angeben.', variant: 'destructive' });
      return;
    }

    if (refundForm.mode === 'gateway' && !refundForm.gatewayProvider) {
      toast({ title: 'Fehler', description: 'Bitte ein Gateway für die Rückerstattung auswählen.', variant: 'destructive' });
      return;
    }

    const combinedReason = [
      refundForm.reasonCategory,
      refundForm.reason.trim(),
      refundForm.internalNote.trim() ? `[Intern: ${refundForm.internalNote.trim()}]` : ''
    ].filter(Boolean).join(' – ');

    try {
      await processRefund(selectedPayment._id, amount, combinedReason, {
        mode: refundForm.mode,
        gatewayProvider: refundForm.mode === 'gateway' ? (refundForm.gatewayProvider as PaymentGateway['provider']) : undefined,
        gatewayReference: refundForm.gatewayReference.trim() || undefined
      });
      toast({ title: 'Erfolg', description: 'Erstattung verbucht.' });
      setRefundDialogOpen(false);
      setSelectedPayment(null);
      setRefundForm({ amount: '', reason: '', reasonCategory: '', internalNote: '', mode: 'gateway', gatewayProvider: '', gatewayReference: '', notifyCustomer: false });
      fetchFinancialData();
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message || 'Erstattung fehlgeschlagen.', variant: 'destructive' });
    }
  };

  const onRunDunning = async () => {
    try {
      const res = await runDunningJob();
      toast({ title: 'Erfolg', description: `${res?.actions?.length || 0} Mahnfaelle verarbeitet.` });
      fetchFinancialData();
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message || 'Mahnlauf fehlgeschlagen.', variant: 'destructive' });
    }
  };

  const getInvoiceById = (invoiceId: string) => invoices.find((i) => i._id === invoiceId) || dunningEligibleInvoices.find((i) => i._id === invoiceId) || null;

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
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message || 'Mahnlauf konnte nicht geladen werden.', variant: 'destructive' });
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
      toast({ title: 'Hinweis', description: 'Bitte mindestens eine ueberfaellige Rechnung auswaehlen.' });
      return;
    }

    const queue = dunningEligibleInvoices
      .filter((invoice) => dunningSelection.includes(invoice._id))
      .map((invoice) => ({
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        amountOpen: Math.max(0, Number(invoice.total || 0) - Number(invoice.paidAmount || 0)),
        status: 'pending' as const,
        note: ''
      }));

    if (queue.length === 0) {
      toast({ title: 'Hinweis', description: 'Die Auswahl enthaelt keine verarbeitbaren Mahnfaelle.' });
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
      toast({ title: 'Mahnlauf erstellt', description: `${queue.length} Mahnfaelle in "${dunningRunName}" gespeichert.` });
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message || 'Mahnlauf konnte nicht gespeichert werden.', variant: 'destructive' });
    }
  };

  const setDunningQueueItem = (invoiceId: string, patch: Partial<DunningQueueItem>) => {
    setDunningQueue((prev) => prev.map((item) => (item.invoiceId === invoiceId ? { ...item, ...patch } : item)));
  };

  const onDunningSendReminder = async (invoiceId: string) => {
    const invoice = getInvoiceById(invoiceId);
    if (!invoice) {
      toast({ title: 'Fehler', description: 'Rechnung fuer Mahnung nicht gefunden.', variant: 'destructive' });
      return;
    }

    openSendComposer(invoice, 'reminder');

    setDunningQueueItem(invoiceId, { status: 'processing', note: 'Versanddialog geoeffnet...' });
    syncDunningItemUpdate(invoiceId, { status: 'processing', note: 'Versanddialog geoeffnet...', logMessage: 'Versanddialog geoeffnet' });
  };

  const onMarkDunningReminderSent = (invoiceId: string) => {
    try {
      setDunningQueueItem(invoiceId, { status: 'sent', note: 'Erinnerung versendet' });
      syncDunningItemUpdate(invoiceId, { status: 'sent', note: 'Erinnerung versendet', logMessage: 'Mahnung versendet' });
      toast({ title: 'Erfolg', description: 'Mahnung wurde in den Versand gegeben.' });
    } catch (error: any) {
      setDunningQueueItem(invoiceId, { status: 'failed', note: error.message || 'Versand fehlgeschlagen' });
      toast({ title: 'Fehler', description: error.message || 'Mahnung konnte nicht aktualisiert werden.', variant: 'destructive' });
    }
  };

  const onDunningEscalateInvoice = async (invoiceId: string, status?: InvoiceStatus, note?: string) => {
    const invoice = getInvoiceById(invoiceId);
    if (!invoice) return;

    const nextStatus = status || dunningDefaultStatus;
    const escalationNote = note ?? dunningDefaultNote;
    try {
      setDunningQueueItem(invoiceId, { status: 'processing', note: `Setze Status auf ${nextStatus}...` });
      await changeInvoiceStatus(invoiceId, nextStatus, escalationNote);
      setDunningQueueItem(invoiceId, { status: 'escalated', note: `Status auf ${nextStatus} gesetzt` });
      await syncDunningItemUpdate(invoiceId, {
        status: 'escalated',
        note: `Status auf ${nextStatus} gesetzt`,
        logMessage: `Fall eskaliert auf ${nextStatus}`
      });
      toast({ title: 'Erfolg', description: `Rechnung ${invoice.invoiceNumber} wurde aktualisiert.` });
      fetchFinancialData();
    } catch (error: any) {
      setDunningQueueItem(invoiceId, { status: 'failed', note: error.message || 'Eskalation fehlgeschlagen' });
      toast({ title: 'Fehler', description: error.message || 'Eskalation fehlgeschlagen.', variant: 'destructive' });
    }
  };

  const onDunningSkipItem = (invoiceId: string) => {
    setDunningQueueItem(invoiceId, { status: 'skipped', note: 'Manuell uebersprungen' });
    syncDunningItemUpdate(invoiceId, { status: 'skipped', note: 'Manuell uebersprungen', logMessage: 'Fall uebersprungen' });
  };

  const onDunningRemoveItem = (invoiceId: string) => {
    setDunningQueue((prev) => prev.filter((item) => item.invoiceId !== invoiceId));
    syncDunningItemUpdate(invoiceId, { status: 'skipped', note: 'Aus Lauf entfernt', logMessage: 'Fall aus Lauf entfernt' });
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
          amountOpen: Math.max(0, Number(invoice.total || 0) - Number(invoice.paidAmount || 0)),
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
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message || 'Fall konnte nicht zum Mahnlauf hinzugefuegt werden.', variant: 'destructive' });
    }
  };

  const onExecuteDunningQueue = async () => {
    if (dunningQueue.length === 0) {
      toast({ title: 'Hinweis', description: 'Bitte zuerst einen manuellen Mahnlauf erstellen.' });
      return;
    }
    if (dunningPaused) {
      toast({ title: 'Mahnlauf pausiert', description: 'Bitte fortsetzen, bevor die automatische Verarbeitung gestartet wird.' });
      return;
    }

    setDunningExecuting(true);
    try {
      const runId = await ensureActiveDunningRun();
      if (runId) {
        await updateDunningRun(runId, { status: 'running', logType: 'started', logMessage: 'Automatische Verarbeitung gestartet' });
      }

      for (const item of dunningQueue) {
        if (item.status !== 'pending' && item.status !== 'failed') continue;
        await onDunningSendReminder(item.invoiceId);
        await onDunningEscalateInvoice(item.invoiceId);
      }

      if (runId) {
        const res = await updateDunningRun(runId, { status: 'completed', logType: 'completed', logMessage: 'Mahnlauf abgeschlossen' });
        const run = res?.run as DunningRun;
        setDunningRuns((prev) => [run, ...prev.filter((entry) => entry._id !== run._id)]);
      }

      toast({ title: 'Mahnlauf abgeschlossen', description: 'Alle offenen Mahnfaelle wurden verarbeitet.' });
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
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message || 'Status des Mahnlaufs konnte nicht aktualisiert werden.', variant: 'destructive' });
    }
  };

  const onUpdateGateway = async () => {
    if (!selectedGateway) return;

    try {
      await updatePaymentGateway(selectedGateway._id, selectedGateway);
      toast({ title: 'Erfolg', description: 'Gateway aktualisiert.' });
      setGatewayDialogOpen(false);
      setSelectedGateway(null);
      fetchFinancialData();
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message || 'Gateway-Update fehlgeschlagen.', variant: 'destructive' });
    }
  };

  const onExport = async (type: 'payments' | 'invoices', format: 'csv' | 'json') => {
    try {
      const response = type === 'payments' ? await exportPayments({}, format) : await exportInvoicesData({}, format);

      if (format === 'csv') {
        const blob = response.data as Blob;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }

      toast({ title: 'Erfolg', description: `${type.toUpperCase()} als ${format.toUpperCase()} exportiert.` });
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message || 'Export fehlgeschlagen.', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[340px] items-center justify-center">
        <div className="flex items-center gap-2 rounded-md border border-[#d8dce6] bg-white px-4 py-3 text-[#1a2a5e]">
          <RefreshCw className="h-4 w-4 animate-spin" /> Finanzdaten werden geladen...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[#0f1d45] bg-gradient-to-r from-[#1a2a5e] via-[#1a2a5e] to-[#2a3f7e] px-5 py-5 text-white shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Finance Control Center</h1>
            <p className="text-sm text-[#d8dce6]">Nutzerfreundliches Management von Rechnungen, Zahlungen, Mahnlogik und Drittanbieter-Gateways.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-white/50 bg-white text-[#1a2a5e] hover:bg-[#f8f9fc]" onClick={fetchFinancialData}>
              <RefreshCw className="mr-2 h-4 w-4" /> Aktualisieren
            </Button>
            <Button variant="outline" className="border-white/50 bg-white text-[#1a2a5e] hover:bg-[#f8f9fc]" onClick={onRunDunning}>
              <Mail className="mr-2 h-4 w-4" /> Mahnlauf
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-[#d8dce6]"><CardHeader className="pb-2"><CardDescription>Erfolgreiche Payments</CardDescription><CardTitle className="text-[#1a2a5e]">{formatCurrency(totals.paidAmount)}</CardTitle></CardHeader><CardContent className="pt-0 text-xs text-muted-foreground"><Wallet className="mr-1 inline h-3.5 w-3.5 text-[#2a3f7e]" />Completed Payments</CardContent></Card>
        <Card className="border-[#d8dce6]"><CardHeader className="pb-2"><CardDescription>Offene Rechnungen</CardDescription><CardTitle className="text-[#1a2a5e]">{totals.openCount}</CardTitle></CardHeader><CardContent className="pt-0 text-xs text-muted-foreground">{formatCurrency(totals.openAmount)}</CardContent></Card>
        <Card className="border-[#d8dce6]"><CardHeader className="pb-2"><CardDescription>Ueberfaellige Rechnungen</CardDescription><CardTitle className="text-[#1a2a5e]">{totals.overdueCount}</CardTitle></CardHeader><CardContent className="pt-0 text-xs text-muted-foreground">{formatCurrency(totals.overdueAmount)}</CardContent></Card>
        <Card className="border-[#d8dce6]"><CardHeader className="pb-2"><CardDescription>Nettoprofit</CardDescription><CardTitle className="text-[#1a2a5e]">{formatCurrency(report?.netProfit || 0)}</CardTitle></CardHeader><CardContent className="pt-0 text-xs text-muted-foreground"><TrendingUp className="mr-1 inline h-3.5 w-3.5 text-[#2a3f7e]" />Marge: {Number(report?.grossMargin || 0).toFixed(1)}%</CardContent></Card>
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 border border-[#d8dce6] bg-[#f8f9fc]">
          <TabsTrigger value="overview">Uebersicht</TabsTrigger>
          <TabsTrigger value="dunning">Mahnlaeufe</TabsTrigger>
          <TabsTrigger value="invoices">Rechnungen</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="providers">Provider</TabsTrigger>
          <TabsTrigger value="exports">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card className="border-[#d8dce6]">
            <CardHeader>
              <CardTitle className="text-[#1a2a5e]">Mahnwesen & Faelligkeiten</CardTitle>
              <CardDescription>Ueberfaellige Rechnungen und Mahnstufen-Monitoring.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {dunningEligibleInvoices.length === 0 ? (
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3 text-sm text-muted-foreground">Keine ueberfaelligen Rechnungen vorhanden.</div>
              ) : (
                dunningEligibleInvoices.slice(0, 6).map((invoice) => (
                  <button
                    key={invoice._id}
                    type="button"
                    onClick={() => {
                      setSelectedInvoice(invoice);
                      setDunningCaseStatus(invoice.status === 'overdue' ? 'overdue' : dunningDefaultStatus);
                      setDunningCaseNote(dunningDefaultNote);
                      setDunningCaseDialogOpen(true);
                    }}
                    className="w-full rounded-md border border-[#d8dce6] p-3 text-left transition hover:border-[#1a2a5e] hover:bg-[#f8f9fc]"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-[#1a2a5e]">{invoice.invoiceNumber}</div>
                        <div className="text-xs text-muted-foreground">{invoice.customerName} · Faellig {formatDate(invoice.dueDate)} · {getDaysPastDue(invoice.dueDate)} Tage ueberfaellig</div>
                      </div>
                      <div className="font-semibold text-red-700">{formatCurrency(Math.max(0, Number(invoice.total || 0) - Number(invoice.paidAmount || 0)))}</div>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dunning" className="space-y-4">
          <Card className="border-[#d8dce6]">
            <CardHeader>
              <CardTitle className="text-[#1a2a5e]">Gespeicherte Mahnlaeufe</CardTitle>
              <CardDescription>Persistente Mahnlaeufe laden, Status einsehen und den aktuellen Lauf zur Bearbeitung waehlen.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="md:col-span-2">
                  <Label>Mahnlauf auswaehlen</Label>
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
                    <SelectTrigger><SelectValue placeholder="Gespeicherten Mahnlauf waehlen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kein Lauf ausgewaehlt</SelectItem>
                      {dunningRuns.map((run) => (
                        <SelectItem key={run._id} value={run._id}>
                          {run.name} · {run.status} · {run.items?.length || 0} Faelle
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button variant="outline" className="w-full" onClick={fetchFinancialData}><RefreshCw className="mr-2 h-4 w-4" />Runs neu laden</Button>
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
                  <Eye className="mr-2 h-4 w-4" />Details zum aktiven Lauf
                </Button>
                {selectedDunningRunId && (
                  <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] px-3 py-2 text-sm">
                    Aktiver Lauf: {dunningRuns.find((run) => run._id === selectedDunningRunId)?.name || 'Unbekannt'}
                  </div>
                )}
              </div>

              {selectedDunningRunId && (
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3 text-sm">
                  <div className="mb-2 font-medium text-[#1a2a5e]">Laufhistorie (letzte Eintraege)</div>
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
            <CardHeader>
              <CardTitle className="text-[#1a2a5e]">Manueller Mahnlauf-Builder</CardTitle>
              <CardDescription>Mahnlauf haendisch erstellen, Fallliste steuern und waehrend der Verarbeitung eingreifen.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label>Laufname</Label>
                  <Input value={dunningRunName} onChange={(e) => setDunningRunName(e.target.value)} placeholder="z.B. Mahnlauf Ende Monat" />
                </div>
                <div>
                  <Label>Standard-Eskalationsstatus</Label>
                  <Select value={dunningDefaultStatus} onValueChange={(value) => setDunningDefaultStatus(value as InvoiceStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="pending_approval">Pending Approval</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="partially_paid">Partially Paid</SelectItem>
                      <SelectItem value="cancelled">Canceled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Standard-Notiz</Label>
                  <Input value={dunningDefaultNote} onChange={(e) => setDunningDefaultNote(e.target.value)} placeholder="Notiz fuer Statuswechsel" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={onSelectAllOverdue}><ListChecks className="mr-2 h-4 w-4" />Alle ueberfaelligen auswaehlen</Button>
                <Button variant="outline" onClick={onClearDunningSelection}><XCircle className="mr-2 h-4 w-4" />Auswahl leeren</Button>
                <Button onClick={onCreateManualDunningRun} className="bg-[#1a2a5e] hover:bg-[#2a3f7e]"><PlayCircle className="mr-2 h-4 w-4" />Lauf aus Auswahl erstellen</Button>
                <Button variant="outline" onClick={onExecuteDunningQueue} disabled={dunningExecuting || dunningPaused}><Send className="mr-2 h-4 w-4" />Auto-Verarbeitung starten</Button>
                <Button variant="outline" onClick={onToggleDunningPause}>
                  {dunningPaused ? <PlayCircle className="mr-2 h-4 w-4" /> : <PauseCircle className="mr-2 h-4 w-4" />}
                  {dunningPaused ? 'Fortsetzen' : 'Pausieren'}
                </Button>
                <Button variant="outline" onClick={onRunDunning}><Mail className="mr-2 h-4 w-4" />System-Mahnlauf</Button>
              </div>

              <div className="rounded-md border border-[#d8dce6] p-3 text-sm text-muted-foreground">
                Ausgewaehlt: {dunningSelection.length} · In Queue: {dunningQueue.length} · Laufstatus: {dunningPaused ? 'Pausiert' : dunningExecuting ? 'In Verarbeitung' : 'Bereit'}
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#d8dce6]">
            <CardHeader>
              <CardTitle className="text-[#1a2a5e]">Ueberfaellige Rechnungen (manuelle Auswahl)</CardTitle>
              <CardDescription>Selektiere Faelle fuer den naechsten Mahnlauf und greife pro Rechnung direkt ein.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-[#d8dce6]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[56px]">Auswahl</TableHead>
                      <TableHead>Rechnung</TableHead>
                      <TableHead>Kunde</TableHead>
                      <TableHead>Faellig</TableHead>
                      <TableHead>Offener Betrag</TableHead>
                      <TableHead className="text-right">Interaktion</TableHead>
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
                            {invoice.isCreditNote && <Badge variant="outline">Gutschrift</Badge>}
                          </div>
                          {invoice.isCreditNote && invoice.creditNoteOf && (
                            <div className="text-xs text-muted-foreground">Original: {formatReferenceValue(invoice.creditNoteOf)}</div>
                          )}
                        </TableCell>
                        <TableCell>{invoice.customerName}</TableCell>
                        <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                        <TableCell>{formatCurrency(Math.max(0, Number(invoice.total || 0) - Number(invoice.paidAmount || 0)))}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openInvoiceDetails(invoice)}><Eye className="mr-1 h-3.5 w-3.5" />Details</Button>
                            <Button size="sm" variant="outline" onClick={() => onDunningSendReminder(invoice._id)}><Send className="mr-1 h-3.5 w-3.5" />Senden</Button>
                            <Button size="sm" variant="outline" onClick={() => onDunningEscalateInvoice(invoice._id)}><AlertTriangle className="mr-1 h-3.5 w-3.5" />Eskalieren</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {dunningEligibleInvoices.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Keine ueberfaelligen Rechnungen vorhanden.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#d8dce6]">
            <CardHeader>
              <CardTitle className="text-[#1a2a5e]">Aktiver Mahnlauf</CardTitle>
              <CardDescription>Im laufenden Prozess einzelne Faelle erneut senden, ueberspringen, eskalieren oder entfernen.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-[#d8dce6]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rechnung</TableHead>
                      <TableHead>Kunde</TableHead>
                      <TableHead>Offen</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notiz</TableHead>
                      <TableHead className="text-right">Eingriff</TableHead>
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
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.note || '-'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => onDunningSendReminder(item.invoiceId)}><Send className="mr-1 h-3.5 w-3.5" />Erneut senden</Button>
                            <Button size="sm" variant="outline" onClick={() => onDunningEscalateInvoice(item.invoiceId)}><AlertTriangle className="mr-1 h-3.5 w-3.5" />Status setzen</Button>
                            <Button size="sm" variant="outline" onClick={() => onDunningSkipItem(item.invoiceId)}><SkipForward className="mr-1 h-3.5 w-3.5" />Ueberspringen</Button>
                            <Button size="sm" variant="outline" onClick={() => onDunningRemoveItem(item.invoiceId)}><XCircle className="mr-1 h-3.5 w-3.5" />Entfernen</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {dunningQueue.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Noch kein manueller Mahnlauf aktiv.</TableCell>
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
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-[#1a2a5e]">Rechnungsmanagement</CardTitle>
                <div className="flex gap-2">
                  <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
                    <DialogTrigger asChild><Button className="bg-[#1a2a5e] hover:bg-[#2a3f7e]"><Plus className="mr-2 h-4 w-4" />Neue Rechnung</Button></DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                      <DialogHeader><DialogTitle>Neue Rechnung</DialogTitle><DialogDescription>Kunde waehlen, Positionen anlegen, Rechnung erstellen.</DialogDescription></DialogHeader>

                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Kunde suchen</Label>
                          <Input value={customerQuery} onChange={(e) => onSearchCustomers(e.target.value)} placeholder="Name oder E-Mail" />
                          {customerResults.length > 0 && (
                            <div className="max-h-40 overflow-y-auto rounded-md border border-[#d8dce6]">
                              {customerResults.map((c) => (
                                <button key={c._id} type="button" className="w-full border-b border-[#d8dce6] p-2 text-left hover:bg-[#f8f9fc] last:border-b-0" onClick={() => {
                                  setInvoiceForm((prev) => ({ ...prev, customerId: c._id, customerName: c.name, customerEmail: c.email }));
                                  setCustomerResults([]);
                                  setCustomerQuery(c.name);
                                }}>
                                  <div className="font-medium text-[#1a2a5e]">{c.name}</div>
                                  <div className="text-xs text-muted-foreground">{c.email}</div>
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
                          <div><Label>Zahlungsziel</Label><Input value={invoiceForm.paymentTerms} onChange={(e) => setInvoiceForm((p) => ({ ...p, paymentTerms: e.target.value }))} /></div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Line Items</Label>
                            <Button variant="outline" size="sm" type="button" onClick={onAddInvoiceLineItem}><Plus className="mr-2 h-4 w-4" />Position</Button>
                          </div>

                          {invoiceForm.items.map((item, index) => (
                            <div key={`line-item-${index}`} className="grid gap-2 rounded-md border border-[#d8dce6] p-3 md:grid-cols-12">
                              <div className="md:col-span-5"><Input placeholder="Beschreibung" value={item.description} onChange={(e) => onUpdateInvoiceLineItem(index, 'description', e.target.value)} /></div>
                              <div className="md:col-span-2"><Input type="number" min="1" value={item.quantity} onChange={(e) => onUpdateInvoiceLineItem(index, 'quantity', e.target.value)} /></div>
                              <div className="md:col-span-2"><Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => onUpdateInvoiceLineItem(index, 'unitPrice', e.target.value)} /></div>
                              <div className="md:col-span-2">
                                <Select value={item.type} onValueChange={(value) => onUpdateInvoiceLineItem(index, 'type', value)}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="service">Service</SelectItem>
                                    <SelectItem value="addon">Add-On</SelectItem>
                                    <SelectItem value="product">Teil</SelectItem>
                                    <SelectItem value="fee">Gebuehr</SelectItem>
                                    <SelectItem value="discount">Rabatt</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="md:col-span-1"><Button variant="ghost" size="icon" type="button" onClick={() => onRemoveInvoiceLineItem(index)}><AlertTriangle className="h-4 w-4 text-red-600" /></Button></div>
                            </div>
                          ))}
                        </div>

                        <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3 text-sm">
                          <div className="flex justify-between"><span>Netto</span><span>{formatCurrency(invoiceDraftTotals.subtotal)}</span></div>
                          <div className="flex justify-between"><span>Steuer (19%)</span><span>{formatCurrency(invoiceDraftTotals.tax)}</span></div>
                          <div className="mt-1 flex justify-between font-semibold text-[#1a2a5e]"><span>Gesamt</span><span>{formatCurrency(invoiceDraftTotals.total)}</span></div>
                        </div>

                        <div><Label>Notiz</Label><Textarea value={invoiceForm.notes} onChange={(e) => setInvoiceForm((p) => ({ ...p, notes: e.target.value }))} /></div>
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)}>Abbrechen</Button>
                        <Button className="bg-[#1a2a5e] hover:bg-[#2a3f7e]" onClick={onCreateInvoice}>Rechnung erstellen</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={fromRepairDialogOpen} onOpenChange={setFromRepairDialogOpen}>
                    <DialogTrigger asChild><Button variant="outline" className="border-[#1a2a5e] text-[#1a2a5e] hover:bg-[#f8f9fc]"><FileSpreadsheet className="mr-2 h-4 w-4" />Aus RepairOrders</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Rechnung aus RepairOrder-IDs</DialogTitle><DialogDescription>Mehrere IDs kommasepariert eingeben.</DialogDescription></DialogHeader>
                      <div className="space-y-2">
                        <Label>RepairOrder IDs</Label><Textarea value={fromRepairForm.repairOrderIds} onChange={(e) => setFromRepairForm((p) => ({ ...p, repairOrderIds: e.target.value }))} placeholder="RO-1, RO-2" />
                        <div className="grid grid-cols-2 gap-2">
                          <div><Label>Steuer %</Label><Input type="number" value={fromRepairForm.taxRate} onChange={(e) => setFromRepairForm((p) => ({ ...p, taxRate: e.target.value }))} /></div>
                          <div><Label>Rabatt</Label><Input type="number" value={fromRepairForm.discount} onChange={(e) => setFromRepairForm((p) => ({ ...p, discount: e.target.value }))} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><Label>Faelligkeit</Label><Input type="date" value={fromRepairForm.dueDate} onChange={(e) => setFromRepairForm((p) => ({ ...p, dueDate: e.target.value }))} /></div>
                          <div><Label>Prefix</Label><Input value={fromRepairForm.numberPrefix} onChange={(e) => setFromRepairForm((p) => ({ ...p, numberPrefix: e.target.value }))} /></div>
                        </div>
                      </div>
                      <DialogFooter><Button variant="outline" onClick={() => setFromRepairDialogOpen(false)}>Abbrechen</Button><Button onClick={onCreateInvoiceFromRepairs}>Generieren</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="mb-3 grid gap-2 md:grid-cols-4">
                <Select value={invoiceFilters.status} onValueChange={(value) => setInvoiceFilters((p) => ({ ...p, status: value }))}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending_approval">Pending Approval</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="partially_paid">Partially Paid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Canceled</SelectItem>
                    <SelectItem value="credited">Credited</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={invoiceFilters.dateFrom} onChange={(e) => setInvoiceFilters((p) => ({ ...p, dateFrom: e.target.value }))} />
                <Input type="date" value={invoiceFilters.dateTo} onChange={(e) => setInvoiceFilters((p) => ({ ...p, dateTo: e.target.value }))} />
                <Button variant="outline" onClick={onApplyInvoiceFilters}><Search className="mr-2 h-4 w-4" />Filtern</Button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-[#d8dce6]">
                <Table>
                  <TableHeader><TableRow><TableHead>Rechnung</TableHead><TableHead>Kunde</TableHead><TableHead>Status</TableHead><TableHead>Faelligkeit</TableHead><TableHead>Betrag</TableHead><TableHead>Bezahlt</TableHead><TableHead className="text-right">Aktionen</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice._id}>
                        <TableCell>{invoice.invoiceNumber}</TableCell>
                        <TableCell>{invoice.customerName}</TableCell>
                        <TableCell><Badge variant="outline" className={invoiceStatusClass[invoice.status]}>{invoice.status}</Badge></TableCell>
                        <TableCell><Calendar className="mr-1 inline h-3.5 w-3.5" />{formatDate(invoice.dueDate)}</TableCell>
                        <TableCell>{formatCurrency(invoice.total)}</TableCell>
                        <TableCell>{formatCurrency(invoice.paidAmount || 0)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openInvoiceDetails(invoice)}><Eye className="mr-1 h-3.5 w-3.5" />Details</Button>
                            <Button size="sm" variant="outline" onClick={() => openSendComposer(invoice, 'invoice')}><Send className="mr-1 h-3.5 w-3.5" />Senden</Button>
                            <Button size="sm" variant="outline" onClick={() => { setSelectedInvoice(invoice); setStatusForm({ status: invoice.status, notes: '' }); setStatusDialogOpen(true); }}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Status</Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!canRecordPayment(invoice)}
                              title={canRecordPayment(invoice) ? 'Teilzahlung erfassen' : `Teilzahlung nicht möglich (Status: ${invoice.status}, Offen: ${formatCurrency(Math.max(0, toAmountNumber(invoice.total) - toAmountNumber(invoice.paidAmount)))})`}
                              onClick={() => openPaymentDialog(invoice)}
                            >
                              <Banknote className="mr-1 h-3.5 w-3.5" />Teilzahlung
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={invoice.isCreditNote}
                              onClick={() => openCreditDialog(invoice)}
                            >
                              Gutschrift
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-[#d8dce6]">
              <CardHeader className="pb-2"><CardDescription>Abgeschlossene Zahlungen</CardDescription><CardTitle className="text-[#1a2a5e]">{paymentOverview.completedCount}</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">Volumen: {formatCurrency(paymentOverview.completedVolume)}</CardContent>
            </Card>
            <Card className="border-[#d8dce6]">
              <CardHeader className="pb-2"><CardDescription>Erstattete Vorgänge</CardDescription><CardTitle className="text-[#1a2a5e]">{paymentOverview.refundedCount}</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">Volumen: {formatCurrency(paymentOverview.refundedVolume)}</CardContent>
            </Card>
            <Card className="border-[#d8dce6]">
              <CardHeader className="pb-2"><CardDescription>Offene Prozesse</CardDescription><CardTitle className="text-[#1a2a5e]">{paymentOverview.openCount}</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">Fehlgeschlagen: {paymentOverview.failedCount}</CardContent>
            </Card>
            <Card className="border-[#d8dce6]">
              <CardHeader className="pb-2"><CardDescription>Erfolgsquote</CardDescription><CardTitle className="text-[#1a2a5e]">{paymentOverview.successRate.toFixed(1)}%</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">Gesamtvorgänge: {paymentOverview.totalCount}</CardContent>
            </Card>
          </div>

          <Card className="border-[#d8dce6]">
            <CardHeader>
              <CardTitle className="text-[#1a2a5e]">Zahlungsprozesse verwalten</CardTitle>
              <CardDescription>Filtern, überwachen, erstatten und direkt zur verknüpften Rechnung springen.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3 grid gap-2 md:grid-cols-6">
                <Select value={paymentFilters.status} onValueChange={(value) => setPaymentFilters((p) => ({ ...p, status: value }))}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                    <SelectItem value="disputed">Disputed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={paymentFilters.method} onValueChange={(value) => setPaymentFilters((p) => ({ ...p, method: value }))}>
                  <SelectTrigger><SelectValue placeholder="Methode" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="credit_card">Kreditkarte</SelectItem>
                    <SelectItem value="debit_card">Debitkarte</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="stripe">Stripe</SelectItem>
                    <SelectItem value="bank_transfer">Banküberweisung</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={paymentFilters.dateFrom} onChange={(e) => setPaymentFilters((p) => ({ ...p, dateFrom: e.target.value }))} />
                <Input type="date" value={paymentFilters.dateTo} onChange={(e) => setPaymentFilters((p) => ({ ...p, dateTo: e.target.value }))} />
                <Button variant="outline" onClick={onApplyPaymentFilters}><Search className="mr-2 h-4 w-4" />Filtern</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPaymentFilters({ status: 'all', method: 'all', dateFrom: '', dateTo: '' });
                    getPayments({}).then((res) => setPayments(res.payments || []));
                  }}
                >
                  Zurücksetzen
                </Button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-[#d8dce6]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zahlung</TableHead>
                      <TableHead>Kunde</TableHead>
                      <TableHead>Vorgang</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Methode</TableHead>
                      <TableHead>Betrag</TableHead>
                      <TableHead>Zeitpunkt</TableHead>
                      <TableHead>Referenz</TableHead>
                      <TableHead className="text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => {
                      const metadata = (payment.metadata || {}) as Record<string, unknown>;
                      const linkedInvoice = payment.invoiceId ? getInvoiceById(String(payment.invoiceId)) : null;
                      const processLabel = payment.status === 'refunded'
                        ? 'Erstattung abgeschlossen'
                        : payment.status === 'completed'
                          ? (metadata.scope === 'full' ? 'Vollzahlung' : 'Teilzahlung')
                          : payment.status === 'disputed'
                            ? 'Dispute in Klärung'
                            : 'Zahlungsvorgang';

                      return (
                        <TableRow key={payment._id}>
                          <TableCell>
                            <div className="font-medium text-[#1a2a5e]">{payment.orderNumber || payment._id.slice(-8)}</div>
                            <div className="text-xs text-muted-foreground">{payment.invoiceId ? `Invoice: ${String(payment.invoiceId).slice(-8)}` : 'Ohne Rechnungslink'}</div>
                          </TableCell>
                          <TableCell>{payment.customerName}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge variant="outline">{processLabel}</Badge>
                              {payment.status === 'refunded' && (
                                <div className="text-xs text-purple-700">{formatCurrency(payment.refundAmount || 0, payment.currency || 'EUR')} · {payment.refundGatewayProvider || payment.refundMode || 'n/a'}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className={paymentStatusClass[payment.status]}>{payment.status}</Badge></TableCell>
                          <TableCell>{paymentMethodLabel[payment.paymentMethod]}</TableCell>
                          <TableCell>{formatCurrency(payment.amount, payment.currency || 'EUR')}</TableCell>
                          <TableCell>
                            <div className="text-sm">{formatDate(payment.processedAt || payment.createdAt)}</div>
                            <div className="text-xs text-muted-foreground">{formatDateTime(payment.processedAt || payment.createdAt).split(', ')[1] || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[220px] truncate text-sm" title={payment.transactionId || payment.gatewayResponse || '-'}>
                              {payment.transactionId || payment.gatewayResponse || '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {linkedInvoice && (
                                <Button size="sm" variant="outline" onClick={() => openInvoiceDetails(linkedInvoice)}>
                                  <Eye className="mr-1 h-3.5 w-3.5" />Rechnung
                                </Button>
                              )}
                              {payment.status === 'completed' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const defaultProvider = payment.paymentMethod === 'paypal'
                                      ? 'paypal'
                                      : payment.paymentMethod === 'stripe'
                                        ? 'stripe'
                                        : '';

                                    setSelectedPayment(payment);
                                    setRefundForm({
                                      amount: String(payment.amount),
                                      reason: '',
                                      reasonCategory: '',
                                      internalNote: '',
                                      mode: defaultProvider ? 'gateway' : 'manual',
                                      gatewayProvider: defaultProvider,
                                      gatewayReference: '',
                                      notifyCustomer: false,
                                    });
                                    setRefundDialogOpen(true);
                                  }}
                                >
                                  Erstattung
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {payments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                          Keine Zahlungsvorgänge gefunden.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <Card className="border-[#d8dce6]">
            <CardHeader><CardTitle className="text-[#1a2a5e]">Drittanbieter Zahlungsanbieter</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {gateways.map((gateway) => (
                <div key={gateway._id} className="rounded-md border border-[#d8dce6] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-[#1a2a5e]">{gateway.name}</div>
                      <div className="text-xs text-muted-foreground">{gateway.provider} · {gateway.configuration.currency} · Fee {gateway.configuration.processingFee}</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setSelectedGateway({ ...gateway }); setGatewayDialogOpen(true); }}><Settings className="mr-1 h-3.5 w-3.5" />Konfigurieren</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exports" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-[#d8dce6]"><CardHeader><CardTitle className="text-[#1a2a5e]">Invoices Export</CardTitle></CardHeader><CardContent className="space-y-2"><Button variant="outline" className="w-full" onClick={() => onExport('invoices', 'csv')}><Download className="mr-2 h-4 w-4" />CSV</Button><Button variant="outline" className="w-full" onClick={() => onExport('invoices', 'json')}><Download className="mr-2 h-4 w-4" />JSON</Button></CardContent></Card>
            <Card className="border-[#d8dce6]"><CardHeader><CardTitle className="text-[#1a2a5e]">Payments Export</CardTitle></CardHeader><CardContent className="space-y-2"><Button variant="outline" className="w-full" onClick={() => onExport('payments', 'csv')}><Download className="mr-2 h-4 w-4" />CSV</Button><Button variant="outline" className="w-full" onClick={() => onExport('payments', 'json')}><Download className="mr-2 h-4 w-4" />JSON</Button></CardContent></Card>
            <Card className="border-[#d8dce6]"><CardHeader><CardTitle className="text-[#1a2a5e]">Finanzreport</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-2">Umsatz: {formatCurrency(report?.totalRevenue || 0)}</div><div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-2">Refunds: {formatCurrency(report?.refundAmount || 0)}</div><div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-2">Disputes: {formatCurrency(report?.disputeAmount || 0)}</div></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={sendComposerOpen} onOpenChange={setSendComposerOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {sendComposerMode === 'reminder' ? 'Mahnungsversand konfigurieren' : 'Rechnungsversand konfigurieren'}
            </DialogTitle>
            <DialogDescription>
              Vor dem Versand alle relevanten Inhalte pruefen, Formulierungen bearbeiten und Verrechnungsfunktionen festlegen.
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-[#d8dce6]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-[#1a2a5e]">Versand & Formulierung</CardTitle>
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
                  <CardTitle className="text-base text-[#1a2a5e]">Verrechnungsfunktionen & Vorschau</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-2 text-sm">
                    <div className="rounded-md border border-[#d8dce6] p-2">Rechnung: {selectedInvoice.invoiceNumber}</div>
                    <div className="rounded-md border border-[#d8dce6] p-2">Kunde: {selectedInvoice.customerName}</div>
                    <div className="rounded-md border border-[#d8dce6] p-2">Gesamt: {formatCurrency(selectedInvoice.total || 0)}</div>
                    <div className="rounded-md border border-[#d8dce6] p-2">Offen: {formatCurrency(Math.max(0, Number(selectedInvoice.total || 0) - Number(selectedInvoice.paidAmount || 0)))}</div>
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
                    <div className="flex items-center justify-between"><span>Skontooption ausweisen</span><Switch checked={sendComposerForm.applyEarlyDiscount} onCheckedChange={(v) => setSendComposerForm((p) => ({ ...p, applyEarlyDiscount: v }))} /></div>
                    {sendComposerForm.applyEarlyDiscount && (
                      <div>
                        <Label>Skonto %</Label>
                        <Input type="number" value={sendComposerForm.earlyDiscountPercent} onChange={(e) => setSendComposerForm((p) => ({ ...p, earlyDiscountPercent: e.target.value }))} />
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendComposerOpen(false)}>Abbrechen</Button>
            <Button className="bg-[#1a2a5e] hover:bg-[#2a3f7e]" onClick={onSubmitSendComposer}>Jetzt senden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dunningRunDetailsOpen} onOpenChange={setDunningRunDetailsOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mahnlauf Details</DialogTitle>
            <DialogDescription>Vollstaendige Einsicht in den aktiven Mahnlauf mit Verlauf, Status und Interventionsmoeglichkeiten.</DialogDescription>
          </DialogHeader>

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
                  <CardTitle className="text-base text-[#1a2a5e]">Laufmanagement</CardTitle>
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
                <CardHeader className="pb-2"><CardTitle className="text-base text-[#1a2a5e]">Faelle im Lauf</CardTitle></CardHeader>
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
                            <TableCell>{item.status}</TableCell>
                            <TableCell>{item.note || '-'}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => onDunningSendReminder(String(item.invoiceId))}>Senden</Button>
                                <Button size="sm" variant="outline" onClick={() => onDunningEscalateInvoice(String(item.invoiceId))}>Eskalieren</Button>
                                <Button size="sm" variant="outline" onClick={() => onDunningSkipItem(String(item.invoiceId))}>Skip</Button>
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
                <CardHeader className="pb-2"><CardTitle className="text-base text-[#1a2a5e]">Laufhistorie</CardTitle></CardHeader>
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setDunningRunDetailsOpen(false)}>Schliessen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dunningCaseDialogOpen} onOpenChange={setDunningCaseDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mahnfall-Management</DialogTitle>
            <DialogDescription>
              Strukturierte Detailansicht und direkte Eingriffe fuer den aktuellen Mahnfall.
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="text-xs text-muted-foreground">Rechnung</div>
                  <div className="font-semibold text-[#1a2a5e]">{selectedInvoice.invoiceNumber}</div>
                </div>
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="mt-1"><Badge variant="outline" className={invoiceStatusClass[selectedInvoice.status]}>{selectedInvoice.status}</Badge></div>
                </div>
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="text-xs text-muted-foreground">Offener Betrag</div>
                  <div className="font-semibold text-red-700">{formatCurrency(Math.max(0, Number(selectedInvoice.total || 0) - Number(selectedInvoice.paidAmount || 0)))}</div>
                </div>
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="text-xs text-muted-foreground">Ueberfaellig seit</div>
                  <div className="font-semibold text-[#1a2a5e]">{getDaysPastDue(selectedInvoice.dueDate)} Tagen</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-[#d8dce6]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-[#1a2a5e]">Mahnungsdaten</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div><span className="text-muted-foreground">Kunde:</span> {selectedInvoice.customerName}</div>
                    <div><span className="text-muted-foreground">E-Mail:</span> {selectedInvoice.customerEmail}</div>
                    <div><span className="text-muted-foreground">Faelligkeit:</span> {formatDate(selectedInvoice.dueDate)}</div>
                    <div><span className="text-muted-foreground">Mahnstufe:</span> {selectedInvoice.dunningLevel ?? 0}</div>
                    <div><span className="text-muted-foreground">Zuletzt erinnert:</span> {formatDate(selectedInvoice.dunningNotifiedAt)}</div>
                    <div><span className="text-muted-foreground">Order-ID:</span> {formatReferenceValue(selectedInvoice.orderId)}</div>
                    <div><span className="text-muted-foreground">RepairOrder-IDs:</span> {formatReferenceList(selectedInvoice.repairOrderIds)}</div>
                  </CardContent>
                </Card>

                <Card className="border-[#d8dce6]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-[#1a2a5e]">Eingriff in Mahnlauf</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <Label>Zielstatus</Label>
                      <Select value={dunningCaseStatus} onValueChange={(value) => setDunningCaseStatus(value as InvoiceStatus)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="overdue">Overdue</SelectItem>
                          <SelectItem value="pending_approval">Pending Approval</SelectItem>
                          <SelectItem value="sent">Sent</SelectItem>
                          <SelectItem value="partially_paid">Partially Paid</SelectItem>
                          <SelectItem value="cancelled">Canceled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Notiz fuer Eingriff</Label>
                      <Textarea value={dunningCaseNote} onChange={(e) => setDunningCaseNote(e.target.value)} placeholder="z.B. Kunde telefonisch erreicht" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => onDunningSendReminder(selectedInvoice._id)}><Send className="mr-1 h-3.5 w-3.5" />Mahnung senden</Button>
                      <Button size="sm" variant="outline" onClick={() => onDunningEscalateInvoice(selectedInvoice._id, dunningCaseStatus, dunningCaseNote)}><AlertTriangle className="mr-1 h-3.5 w-3.5" />Status setzen</Button>
                      <Button size="sm" variant="outline" onClick={() => onAddInvoiceToDunningQueue(selectedInvoice)}><ListChecks className="mr-1 h-3.5 w-3.5" />Zu aktivem Lauf</Button>
                      <Button size="sm" variant="outline" onClick={() => onDunningSkipItem(selectedInvoice._id)}><SkipForward className="mr-1 h-3.5 w-3.5" />Ueberspringen</Button>
                      <Button size="sm" variant="outline" onClick={() => onDunningRemoveItem(selectedInvoice._id)}><XCircle className="mr-1 h-3.5 w-3.5" />Aus Lauf entfernen</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-[#d8dce6]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-[#1a2a5e]">Relevante Rechnungspositionen</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-md border border-[#d8dce6]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Beschreibung</TableHead>
                          <TableHead>Typ</TableHead>
                          <TableHead>Menge</TableHead>
                          <TableHead>Einzelpreis</TableHead>
                          <TableHead>Gesamt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(selectedInvoice.items || []).map((item, idx) => (
                          <TableRow key={item._id || `dunning-item-${idx}`}>
                            <TableCell>{item.description || '-'}</TableCell>
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
                  <CardTitle className="text-base text-[#1a2a5e]">Aktivitaets-Timeline</CardTitle>
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

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDunningCaseDialogOpen(false);
              setSelectedInvoice(null);
            }}>
              Schliessen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceDetailsDialogOpen} onOpenChange={setInvoiceDetailsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Rechnungsdetails
              {selectedInvoice?.isCreditNote && (
                <Badge className="bg-violet-100 text-violet-700 border-violet-300 border">Gutschrift</Badge>
              )}
              {selectedInvoice?.status === 'credited' && !selectedInvoice?.isCreditNote && (
                <Badge className="bg-orange-100 text-orange-700 border-orange-300 border">Gutgeschrieben</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Vollstaendige Detailansicht inkl. Zahlungen, Erstattungen und Gutschriften.
            </DialogDescription>
          </DialogHeader>

          {invoiceDetailLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Lade verknuepfte Daten…
            </div>
          )}

          {selectedInvoice && (
            <div className="space-y-4">
              {/* ── Credit-note / Credited banner ─────────────────────────── */}
              {selectedInvoice.isCreditNote && (
                <div className="flex items-start gap-3 rounded-md border border-violet-300 bg-violet-50 p-3 text-sm text-violet-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <span className="font-medium">Diese Rechnung ist eine Gutschrift</span>
                    {(() => {
                      const orig = selectedInvoice.creditNoteOf as any;
                      const origNum = orig?.invoiceNumber || (typeof orig === 'string' ? orig : null);
                      return origNum ? (
                        <span> zur Ursprungsrechnung <span className="font-semibold">{origNum}</span>
                          {orig?.total && <span> ({formatCurrency(orig.total)})</span>}
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
                    <span className="font-medium">Diese Rechnung wurde gutgeschrieben.</span>
                    {invoiceDetailCreditNotes.length > 0 && (
                      <span> Gutschrift: <span className="font-semibold">{invoiceDetailCreditNotes[0].invoiceNumber}</span></span>
                    )}
                  </div>
                </div>
              )}

              {/* ── Stat cards ────────────────────────────────────────────── */}
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="text-xs text-muted-foreground">Rechnungsnummer</div>
                  <div className="font-semibold text-[#1a2a5e]">{selectedInvoice.invoiceNumber}</div>
                </div>
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="mt-1"><Badge variant="outline" className={invoiceStatusClass[selectedInvoice.status]}>{selectedInvoice.status}</Badge></div>
                </div>
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="text-xs text-muted-foreground">Gesamtbetrag</div>
                  <div className="font-semibold text-[#1a2a5e]">{formatCurrency(selectedInvoice.total)}</div>
                </div>
                <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="text-xs text-muted-foreground">Offen</div>
                  <div className="font-semibold text-[#1a2a5e]">{formatCurrency(Math.max(0, Number(selectedInvoice.total || 0) - Number(selectedInvoice.paidAmount || 0)))}</div>
                </div>
              </div>

              {/* ── Customer & Lifecycle ─────────────────────────────────── */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-[#d8dce6]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-[#1a2a5e]">Kunde & Rechnungsadresse</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div><span className="text-muted-foreground">Kunde:</span> {selectedInvoice.customerName}</div>
                    <div><span className="text-muted-foreground">E-Mail:</span> {selectedInvoice.customerEmail}</div>
                    <Separator />
                    {selectedInvoiceAddress ? (
                      <div className="space-y-1">
                        <div>{(selectedInvoiceAddress as any).company || (selectedInvoiceAddress as any).name || '-'}</div>
                        <div>{(selectedInvoiceAddress as any).street || '-'} {(selectedInvoiceAddress as any).houseNumber || ''}</div>
                        <div>{(selectedInvoiceAddress as any).zipCode || '-'} {(selectedInvoiceAddress as any).city || '-'}</div>
                        <div>{(selectedInvoiceAddress as any).state || '-'}</div>
                        <div>{(selectedInvoiceAddress as any).country || '-'}</div>
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed border-[#d8dce6] p-2 text-muted-foreground">
                        Keine Rechnungsadresse in der Rechnung enthalten.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-[#d8dce6]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-[#1a2a5e]">Verknuepfte Orders & Lifecycle</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div><span className="text-muted-foreground">Order-ID:</span> {formatReferenceValue(selectedInvoice.orderId)}</div>
                    <div>
                      <span className="text-muted-foreground">RepairOrder-IDs:</span>{' '}
                      {formatReferenceList(selectedInvoice.repairOrderIds)}
                    </div>
                    <div><span className="text-muted-foreground">Erstellt:</span> {formatDate(selectedInvoice.createdAt)}</div>
                    <div><span className="text-muted-foreground">Faellig:</span> {formatDate(selectedInvoice.dueDate)}</div>
                    <div><span className="text-muted-foreground">Gesendet:</span> {formatDate(selectedInvoice.sentAt)}</div>
                    <div><span className="text-muted-foreground">Bezahlt:</span> {formatDate(selectedInvoice.paidAt)}</div>
                    <div><span className="text-muted-foreground">Zahlungsziel:</span> {selectedInvoice.paymentTerms || '-'}</div>
                    <div><span className="text-muted-foreground">Template:</span> {selectedInvoice.template || '-'}</div>
                  </CardContent>
                </Card>
              </div>

              {/* ── Payments & Refunds ────────────────────────────────────── */}
              {!invoiceDetailLoading && (
                <Card className="border-[#d8dce6]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-[#1a2a5e]">Zahlungen & Erstattungen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {invoiceDetailPayments.length === 0 ? (
                      <div className="rounded-md border border-dashed border-[#d8dce6] p-3 text-center text-sm text-muted-foreground">
                        Keine Zahlungen fuer diese Rechnung erfasst.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {invoiceDetailPayments.map((pmt) => (
                          <div key={pmt._id} className={`rounded-md border p-3 text-sm ${pmt.status === 'refunded' ? 'border-purple-200 bg-purple-50' : 'border-[#d8dce6] bg-[#f8f9fc]'}`}>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-[#1a2a5e]">{formatCurrency(pmt.amount, pmt.currency || 'EUR')}</span>
                                  <Badge variant="outline" className={paymentStatusClass[pmt.status]}>{pmt.status}</Badge>
                                  <span className="text-muted-foreground text-xs">{pmt.paymentMethod}</span>
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
                                      gatewayProvider: (['paypal', 'stripe'].includes(pmt.paymentMethod) ? pmt.paymentMethod : '') as any,
                                      gatewayReference: '',
                                      notifyCustomer: false,
                                    });
                                    setInvoiceDetailsDialogOpen(false);
                                    setRefundDialogOpen(true);
                                  }}
                                >
                                  Erstatten
                                </Button>
                              )}
                            </div>
                            {/* Refund details */}
                            {pmt.status === 'refunded' && (
                              <div className="mt-2 space-y-1 border-t border-purple-200 pt-2">
                                <div className="font-medium text-purple-700">↩ Erstattung</div>
                                <div className="grid gap-x-4 gap-y-1 text-xs text-muted-foreground md:grid-cols-2">
                                  <div><span className="font-medium text-purple-700">Betrag:</span> {formatCurrency(pmt.refundAmount || pmt.amount, pmt.currency || 'EUR')}</div>
                                  <div><span className="font-medium text-purple-700">Datum:</span> {formatDate(pmt.refundedAt)}</div>
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
                          <span className="text-muted-foreground">Summe Zahlungen:</span>
                          <span className="font-semibold text-[#1a2a5e]">
                            {formatCurrency(invoiceDetailPayments.filter(p => p.status === 'completed' || p.status === 'refunded').reduce((s, p) => s + p.amount, 0))}
                          </span>
                        </div>
                        {invoiceDetailPayments.some(p => p.status === 'refunded') && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">davon erstattet:</span>
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
                <Card className="border-[#d8dce6]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-[#1a2a5e]">Verknuepfte Gutschriften</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {invoiceDetailCreditNotes.map((cn) => (
                        <div key={String(cn._id)} className="flex items-center justify-between rounded-md border border-violet-200 bg-violet-50 p-3 text-sm">
                          <div>
                            <div className="font-medium text-violet-800">{cn.invoiceNumber}</div>
                            <div className="text-xs text-muted-foreground">
                              Erstellt: {formatDate(cn.createdAt)} ·{' '}
                              <Badge variant="outline" className={invoiceStatusClass[(cn.status as InvoiceStatus) || 'draft']}>{cn.status}</Badge>
                            </div>
                            {cn.notes && <div className="mt-1 text-xs text-violet-600">{cn.notes}</div>}
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-violet-800">{formatCurrency(cn.total || 0)}</div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="mt-1 h-7 text-xs text-violet-700"
                              onClick={() => {
                                setInvoiceDetailsDialogOpen(false);
                                openInvoiceDetails(cn as Invoice);
                              }}
                            >
                              <Eye className="mr-1 h-3 w-3" />Details
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Invoice items ─────────────────────────────────────────── */}
              <Card className="border-[#d8dce6]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-[#1a2a5e]">Rechnungsposten</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-md border border-[#d8dce6]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Beschreibung</TableHead>
                          <TableHead>Typ</TableHead>
                          <TableHead>Menge</TableHead>
                          <TableHead>Einzelpreis</TableHead>
                          <TableHead>Gesamt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(selectedInvoice.items || []).map((item, idx) => (
                          <TableRow key={item._id || `invoice-item-${idx}`}>
                            <TableCell>{item.description || '-'}</TableCell>
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
                    <div className="rounded-md border border-[#d8dce6] p-2"><span className="text-muted-foreground">Netto:</span> {formatCurrency(selectedInvoice.subtotal || 0)}</div>
                    <div className="rounded-md border border-[#d8dce6] p-2"><span className="text-muted-foreground">Steuer:</span> {formatCurrency(selectedInvoice.tax || 0)}</div>
                    <div className="rounded-md border border-[#d8dce6] p-2"><span className="text-muted-foreground">Rabatt:</span> {formatCurrency(selectedInvoice.discount || 0)}</div>
                    <div className="rounded-md border border-[#d8dce6] p-2 font-semibold text-[#1a2a5e]"><span className="text-muted-foreground">Gesamt:</span> {formatCurrency(selectedInvoice.total || 0)}</div>
                  </div>
                </CardContent>
              </Card>

              {/* ── Notes ─────────────────────────────────────────────────── */}
              <Card className="border-[#d8dce6]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-[#1a2a5e]">Notizen & Zusatzinfos</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {selectedInvoice.notes ? selectedInvoice.notes : <span className="text-muted-foreground">Keine Notiz vorhanden.</span>}
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter className="mt-2 flex-wrap gap-2">
            {/* Quick actions */}
            {selectedInvoice && canRecordPayment(selectedInvoice) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setInvoiceDetailsDialogOpen(false);
                  openPaymentDialog(selectedInvoice);
                }}
              >
                <Banknote className="mr-1 h-3.5 w-3.5" />Teilzahlung
              </Button>
            )}
            {selectedInvoice && ['paid', 'cancelled', 'credited'].includes(selectedInvoice.status) && !selectedInvoice.isCreditNote && invoiceDetailCreditNotes.length === 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setInvoiceDetailsDialogOpen(false);
                  openCreditDialog(selectedInvoice);
                }}
              >
                Gutschrift erstellen
              </Button>
            )}
            {selectedInvoice && invoiceDetailPayments.some(p => p.status === 'completed') && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const refundable = invoiceDetailPayments.find(p => p.status === 'completed');
                  if (refundable) {
                    setSelectedPayment(refundable);
                    setRefundForm({
                      amount: String(refundable.amount),
                      reason: '',
                      reasonCategory: '',
                      internalNote: '',
                      mode: (['paypal', 'stripe'].includes(refundable.paymentMethod) ? 'gateway' : 'manual') as 'gateway' | 'manual',
                      gatewayProvider: (['paypal', 'stripe'].includes(refundable.paymentMethod) ? refundable.paymentMethod : '') as any,
                      gatewayReference: '',
                      notifyCustomer: false,
                    });
                  }
                  setInvoiceDetailsDialogOpen(false);
                  setRefundDialogOpen(true);
                }}
              >
                <Wallet className="mr-1 h-3.5 w-3.5" />Erstattung
              </Button>
            )}
            <Button variant="outline" onClick={() => setInvoiceDetailsDialogOpen(false)}>Schliessen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Erstattung buchen</DialogTitle>
            <DialogDescription>Rückerstattung mit Gateway-Integration und vollständiger Nachvollziehbarkeit erfassen.</DialogDescription>
          </DialogHeader>

          {/* ── Payment context ──────────────────────────────────────── */}
          {selectedPayment && (
            <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3 text-sm space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="font-semibold text-[#1a2a5e]">{selectedPayment.customerName}</div>
                <Badge variant="outline" className={paymentStatusClass[selectedPayment.status]}>{selectedPayment.status}</Badge>
              </div>
              <div className="grid gap-x-6 gap-y-0.5 text-muted-foreground md:grid-cols-3">
                <div><span className="text-foreground font-medium">Methode:</span> {selectedPayment.paymentMethod}</div>
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
              <div className="font-semibold text-[#1a2a5e]">Zusammenfassung</div>
              <div className="grid gap-x-4 gap-y-0.5 md:grid-cols-2">
                <div><span className="text-muted-foreground">Betrag:</span> <span className="font-semibold text-purple-700">{formatCurrency(Number(refundForm.amount))}</span></div>
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>Abbrechen</Button>
            <Button
              onClick={onRefund}
              disabled={!refundForm.amount || Number(refundForm.amount) <= 0 || (!refundForm.reason.trim() && !refundForm.reasonCategory)}
            >
              Erstattung buchen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}><DialogContent><DialogHeader><DialogTitle>Statuswechsel</DialogTitle></DialogHeader><Label>Status</Label><Select value={statusForm.status} onValueChange={(v) => setStatusForm((p) => ({ ...p, status: v as InvoiceStatus }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="pending_approval">Pending Approval</SelectItem><SelectItem value="sent">Sent</SelectItem><SelectItem value="partially_paid">Partially Paid</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="overdue">Overdue</SelectItem><SelectItem value="cancelled">Canceled</SelectItem><SelectItem value="credited">Credited</SelectItem></SelectContent></Select><Label>Notiz</Label><Textarea value={statusForm.notes} onChange={(e) => setStatusForm((p) => ({ ...p, notes: e.target.value }))} /><DialogFooter><Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Abbrechen</Button><Button onClick={onChangeStatus}>Speichern</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Zahlung erfassen</DialogTitle>
            <DialogDescription>Teilzahlungen und Vollzahlungen strukturiert erfassen, prüfen und dokumentieren.</DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3 text-sm space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="font-semibold text-[#1a2a5e]">{selectedInvoice.invoiceNumber}</div>
                <Badge variant="outline" className={invoiceStatusClass[selectedInvoice.status]}>{selectedInvoice.status}</Badge>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <div><span className="text-muted-foreground">Kunde:</span> {selectedInvoice.customerName}</div>
                <div><span className="text-muted-foreground">Rechnung:</span> {formatCurrency(selectedInvoice.total || 0)}</div>
                <div><span className="text-muted-foreground">Bereits bezahlt:</span> {formatCurrency(selectedInvoice.paidAmount || 0)}</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Zahlungsfortschritt</span>
                  <span>{formatCurrency(selectedInvoiceOpenAmount)} offen</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-[#1a2a5e]"
                    style={{ width: `${Math.min(100, Math.max(0, ((Number(selectedInvoice.paidAmount || 0) / Math.max(1, Number(selectedInvoice.total || 0))) * 100)))}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <Separator className="my-1" />

          <div className="space-y-1">
            <Label>Zahlungsart</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`rounded-md border px-3 py-2 text-sm transition-colors ${paymentForm.scope === 'partial' ? 'border-[#1a2a5e] bg-[#1a2a5e] text-white' : 'border-input hover:bg-accent'}`}
                onClick={() => setPaymentForm((p) => ({ ...p, scope: 'partial' }))}
              >
                Teilzahlung
              </button>
              <button
                type="button"
                className={`rounded-md border px-3 py-2 text-sm transition-colors ${paymentForm.scope === 'full' ? 'border-[#1a2a5e] bg-[#1a2a5e] text-white' : 'border-input hover:bg-accent'}`}
                onClick={() => setPaymentForm((p) => ({ ...p, scope: 'full', amount: String(selectedInvoiceOpenAmount) }))}
              >
                Vollzahlung (Restbetrag)
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Betrag *</Label>
                <button
                  type="button"
                  className="text-xs text-[#1a2a5e] underline-offset-2 hover:underline"
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
              <Label>Datum Zahlungseingang</Label>
              <Input
                type="date"
                value={paymentForm.paymentDate}
                onChange={(e) => setPaymentForm((p) => ({ ...p, paymentDate: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>Methode *</Label>
              <Select value={paymentForm.paymentMethod} onValueChange={(v) => setPaymentForm((p) => ({ ...p, paymentMethod: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Banküberweisung</SelectItem>
                  <SelectItem value="credit_card">Kreditkarte</SelectItem>
                  <SelectItem value="debit_card">Debitkarte</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Referenz (optional)</Label>
              <Input
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm((p) => ({ ...p, reference: e.target.value }))}
                placeholder="z. B. Verwendungszweck / Belegnummer"
              />
            </div>
          </div>

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
            <Label htmlFor="payment-notify" className="cursor-pointer">Kunden über Zahlungseingang informieren</Label>
          </div>

          <div className="rounded-md border border-[#d8dce6] bg-slate-50 p-3 text-sm space-y-1">
            <div className="font-semibold text-[#1a2a5e]">Zusammenfassung</div>
            <div className="grid gap-x-4 gap-y-0.5 md:grid-cols-2">
              <div><span className="text-muted-foreground">Vorgang:</span> {paymentForm.scope === 'full' ? 'Vollzahlung' : 'Teilzahlung'}</div>
              <div><span className="text-muted-foreground">Methode:</span> {paymentMethodLabel[paymentForm.paymentMethod as Payment['paymentMethod']] || paymentForm.paymentMethod}</div>
              <div><span className="text-muted-foreground">Betrag:</span> <span className="font-semibold text-[#1a2a5e]">{formatCurrency(Number(paymentForm.amount || 0))}</span></div>
              <div><span className="text-muted-foreground">Rest nach Buchung:</span> {formatCurrency(Math.max(0, selectedInvoiceOpenAmount - Number(paymentForm.amount || 0)))}</div>
            </div>
          </div>

          {selectedInvoicePaymentHistory.length > 0 && (
            <div className="space-y-2">
              <Label>Bisherige Zahlungen zur Rechnung</Label>
              <div className="rounded-md border border-input overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Methode</TableHead>
                      <TableHead className="text-right">Betrag</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoicePaymentHistory.slice(0, 5).map((entry) => (
                      <TableRow key={entry._id}>
                        <TableCell>{formatDate(entry.processedAt || entry.createdAt)}</TableCell>
                        <TableCell><Badge variant="outline" className={paymentStatusClass[entry.status]}>{entry.status}</Badge></TableCell>
                        <TableCell>{paymentMethodLabel[entry.paymentMethod]}</TableCell>
                        <TableCell className="text-right">{formatCurrency(entry.amount, entry.currency || 'EUR')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Abbrechen</Button>
            <Button
              onClick={onAddPayment}
              disabled={!paymentForm.amount || Number(paymentForm.amount) <= 0 || Number(paymentForm.amount) > selectedInvoiceOpenAmount + 0.01}
            >
              Zahlung buchen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gutschrift erstellen</DialogTitle>
            <DialogDescription>Erstellt eine negative Gegenrechnung zur ausgewählten Ursprungsrechnung.</DialogDescription>
          </DialogHeader>

          {/* ── Invoice context ──────────────────────────────────────── */}
          {selectedInvoice && (
            <div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] p-3 text-sm space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="font-semibold text-[#1a2a5e]">{selectedInvoice.invoiceNumber}</div>
                <Badge variant="outline" className={invoiceStatusClass[selectedInvoice.status]}>{selectedInvoice.status}</Badge>
              </div>
              <div className="grid gap-x-6 gap-y-0.5 text-muted-foreground md:grid-cols-2">
                <div><span className="text-foreground font-medium">Kunde:</span> {selectedInvoice.customerName}</div>
                <div><span className="text-foreground font-medium">Gesamtbetrag:</span> {formatCurrency(selectedInvoice.total || 0)}</div>
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
                onClick={() => setCreditForm((p) => ({ ...p, scope: 'full' }))}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${creditForm.scope === 'full' ? 'border-[#1a2a5e] bg-[#1a2a5e] text-white' : 'border-input hover:bg-accent'}`}
              >
                Vollständige Gutschrift
              </button>
              <button
                type="button"
                onClick={() => setCreditForm((p) => ({ ...p, scope: 'partial' }))}
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
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Beschreibung</th>
                      <th className="w-20 px-2 py-1.5 text-right font-medium text-muted-foreground">Menge</th>
                      <th className="w-24 px-2 py-1.5 text-right font-medium text-muted-foreground">Preis (€)</th>
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
                          <td className="px-2 py-1.5 text-foreground">{item.description}</td>
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
                value={creditForm.taxRate}
                onChange={(e) => setCreditForm((p) => ({ ...p, taxRate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Rabatt (€, optional)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={creditForm.discount}
                onChange={(e) => setCreditForm((p) => ({ ...p, discount: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Fälligkeit</Label>
              <Input
                type="date"
                value={creditForm.dueDate}
                onChange={(e) => setCreditForm((p) => ({ ...p, dueDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Nummernpräfix</Label>
              <Input
                value={creditForm.numberPrefix}
                maxLength={8}
                onChange={(e) => setCreditForm((p) => ({ ...p, numberPrefix: e.target.value }))}
              />
            </div>
          </div>

          {/* ── Reason & notify ──────────────────────────────────────── */}
          <div className="space-y-1">
            <Label>Bemerkung / Grund</Label>
            <Textarea
              rows={2}
              value={creditForm.reason}
              onChange={(e) => setCreditForm((p) => ({ ...p, reason: e.target.value }))}
              placeholder="Begründung für die Gutschrift…"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="credit-notify"
              checked={creditForm.notifyCustomer}
              onCheckedChange={(v) => setCreditForm((p) => ({ ...p, notifyCustomer: v }))}
            />
            <Label htmlFor="credit-notify" className="cursor-pointer">Kunden per E-Mail benachrichtigen</Label>
          </div>

          {/* ── Live preview card ─────────────────────────────────────── */}
          {creditPreview && (creditPreview.items.length > 0 || creditForm.scope === 'full') && (
            <div className="rounded-md border border-[#d8dce6] bg-slate-50 p-3 text-sm space-y-1">
              <div className="font-semibold text-[#1a2a5e]">Vorschau Gutschrift</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
                <span className="text-muted-foreground">Nettobetrag</span>
                <span className="text-right font-mono">{formatCurrency(creditPreview.subtotal)}</span>
                <span className="text-muted-foreground">Steuer ({creditForm.taxRate}%)</span>
                <span className="text-right font-mono">{formatCurrency(creditPreview.tax)}</span>
                {Number(creditForm.discount) > 0 && (
                  <>
                    <span className="text-muted-foreground">Rabatt</span>
                    <span className="text-right font-mono">{formatCurrency(creditPreview.discount)}</span>
                  </>
                )}
                <Separator className="col-span-2 my-0.5" />
                <span className="font-semibold text-[#1a2a5e]">Gesamtbetrag</span>
                <span className="text-right font-mono font-semibold text-purple-700">{formatCurrency(creditPreview.total)}</span>
              </div>
              {creditForm.scope === 'partial' && (
                <p className="text-xs text-muted-foreground">{creditPreview.items.length} Position(en) ausgewählt</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialogOpen(false)}>Abbrechen</Button>
            <Button
              onClick={onCreateCredit}
              disabled={
                creditForm.scope === 'partial' &&
                (creditPreview == null || creditPreview.items.length === 0)
              }
            >
              Gutschrift erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={gatewayDialogOpen} onOpenChange={setGatewayDialogOpen}><DialogContent><DialogHeader><DialogTitle>Gateway konfigurieren</DialogTitle></DialogHeader>{selectedGateway && <div className="space-y-2"><Label>Name</Label><Input value={selectedGateway.name} onChange={(e) => setSelectedGateway((p) => p ? { ...p, name: e.target.value } : p)} /><Label>Currency</Label><Input value={selectedGateway.configuration.currency} onChange={(e) => setSelectedGateway((p) => p ? { ...p, configuration: { ...p.configuration, currency: e.target.value } } : p)} /><Label>Processing Fee</Label><Input type="number" value={selectedGateway.configuration.processingFee} onChange={(e) => setSelectedGateway((p) => p ? { ...p, configuration: { ...p.configuration, processingFee: Number(e.target.value) } } : p)} /><div className="rounded-md border border-input px-3 py-2"><div className="flex items-center justify-between text-sm"><span>Aktiv</span><Switch checked={selectedGateway.isActive} onCheckedChange={(v) => setSelectedGateway((p) => p ? { ...p, isActive: v } : p)} /></div></div><div className="rounded-md border border-[#d8dce6] bg-[#f8f9fc] px-3 py-2"><div className="flex items-center justify-between text-sm"><span><ShieldCheck className="mr-1 inline h-4 w-4" />Fraud Protection</span><Switch checked={selectedGateway.configuration.fraudProtection} onCheckedChange={(v) => setSelectedGateway((p) => p ? { ...p, configuration: { ...p.configuration, fraudProtection: v } } : p)} /></div></div></div>}<DialogFooter><Button variant="outline" onClick={() => setGatewayDialogOpen(false)}>Abbrechen</Button><Button onClick={onUpdateGateway}>Speichern</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

export default FinancialManagement;
