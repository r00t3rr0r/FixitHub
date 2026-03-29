import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Calendar,
  DollarSign,
  Eye,
  Download,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  confirmInvoicePayment,
  getCustomerInvoices,
  getInvoicePaymentGateways,
  getInvoiceStats,
  initializeInvoicePayment,
  markInvoiceAsViewed,
  payInvoice,
  Invoice,
  InvoicePaymentGateway,
} from "@/api/invoices";
import { useToast } from "@/hooks/useToast";

export function CustomerInvoices() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [paymentGateways, setPaymentGateways] = useState<InvoicePaymentGateway[]>([]);
  const [loadingPaymentGateways, setLoadingPaymentGateways] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [selectedGatewayId, setSelectedGatewayId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [paypalEmail, setPaypalEmail] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankIban, setBankIban] = useState("");
  const [bankBic, setBankBic] = useState("");
  const [bankTransferReference, setBankTransferReference] = useState("");
  const [billingStreet, setBillingStreet] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingZipCode, setBillingZipCode] = useState("");
  const [billingCountry, setBillingCountry] = useState("DE");

  useEffect(() => {
    fetchInvoices();
    fetchStats();
  }, [statusFilter]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      console.log('CustomerInvoices: Fetching invoices with status filter:', statusFilter);

      const filters: any = {};
      if (statusFilter !== "all") {
        filters.status = statusFilter;
      }

      const response = await getCustomerInvoices(filters);
      console.log('CustomerInvoices: Received invoices:', response.invoices?.length);

      setInvoices(response.invoices || []);
    } catch (error: any) {
      console.error('CustomerInvoices: Error fetching invoices:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('invoices.errorFetchingInvoices'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      console.log('CustomerInvoices: Fetching invoice statistics');
      const response = await getInvoiceStats();
      console.log('CustomerInvoices: Received stats:', response.stats);
      setStats(response.stats);
    } catch (error: any) {
      console.error('CustomerInvoices: Error fetching stats:', error);
    }
  };

  const handleViewInvoice = async (invoice: Invoice) => {
    try {
      console.log('CustomerInvoices: Viewing invoice:', invoice._id);
      setSelectedInvoice(invoice);
      setShowInvoiceDialog(true);
      setPayerName(invoice.customerName || "");
      setPayerEmail(invoice.customerEmail || "");

      const openAmount = Math.max(0, Number(invoice.total || 0) - Number(invoice.paidAmount || invoice.amountPaid || 0));
      setPaymentAmount(openAmount.toFixed(2));

      setSelectedGatewayId("");
      setAcceptedTerms(false);
      setPaypalEmail(invoice.customerEmail || "");
      setBankAccountHolder(invoice.customerName || "");
      setBankIban("");
      setBankBic("");
      setBankTransferReference(invoice.invoiceNumber || "");
      setBillingStreet("");
      setBillingCity("");
      setBillingZipCode("");
      setBillingCountry("DE");

      await fetchPaymentGateways();

      // Mark as viewed if it was sent
      if (invoice.status === 'sent') {
        await markInvoiceAsViewed(invoice._id);
        // Update local state
        setInvoices((prev) =>
          prev.map((inv) =>
            inv._id === invoice._id ? { ...inv, status: 'viewed' as const } : inv
          )
        );
      }
    } catch (error: any) {
      console.error('CustomerInvoices: Error marking invoice as viewed:', error);
    }
  };

  const fetchPaymentGateways = async () => {
    try {
      setLoadingPaymentGateways(true);
      const response = await getInvoicePaymentGateways();
      setPaymentGateways(response.gateways || []);
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || 'Zahlungsgateways konnten nicht geladen werden.',
        variant: 'destructive',
      });
    } finally {
      setLoadingPaymentGateways(false);
    }
  };

  const selectedGateway = paymentGateways.find((gateway) => gateway._id === selectedGatewayId);
  const outstandingAmount = selectedInvoice
    ? Math.max(0, Number(selectedInvoice.total || 0) - Number(selectedInvoice.paidAmount || selectedInvoice.amountPaid || 0))
    : 0;

  const handlePayInvoice = async () => {
    if (!selectedInvoice) return;
    if (!selectedGateway) {
      toast({ title: t('common.error'), description: 'Bitte wählen Sie ein Zahlungsgateway.', variant: 'destructive' });
      return;
    }

    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      toast({ title: t('common.error'), description: 'Bitte geben Sie einen gültigen Zahlungsbetrag ein.', variant: 'destructive' });
      return;
    }
    if (amount > outstandingAmount + 0.01) {
      toast({
        title: t('common.error'),
        description: `Der Betrag übersteigt den offenen Restbetrag (${outstandingAmount.toFixed(2)} EUR).`,
        variant: 'destructive',
      });
      return;
    }
    if (!payerName.trim() || !payerEmail.trim()) {
      toast({ title: t('common.error'), description: 'Name und E-Mail des Zahlers sind erforderlich.', variant: 'destructive' });
      return;
    }
    if (!acceptedTerms) {
      toast({ title: t('common.error'), description: 'Bitte bestätigen Sie die Zahlungsbedingungen.', variant: 'destructive' });
      return;
    }

    const provider = selectedGateway.provider;

    if (provider === 'stripe') {
      if (!billingStreet.trim() || !billingCity.trim() || !billingZipCode.trim() || !billingCountry.trim()) {
        toast({ title: t('common.error'), description: 'Für Stripe ist eine vollständige Rechnungsadresse erforderlich.', variant: 'destructive' });
        return;
      }
    }

    if (provider === 'paypal' && !paypalEmail.trim()) {
      toast({ title: t('common.error'), description: 'Bitte geben Sie Ihre PayPal E-Mail an.', variant: 'destructive' });
      return;
    }

    if (provider === 'bank_transfer' && (!bankAccountHolder.trim() || !bankIban.trim())) {
      toast({
        title: t('common.error'),
        description: 'Für Überweisung sind Kontoinhaber und IBAN erforderlich.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setProcessingPayment(true);

      if (provider === 'stripe' || provider === 'paypal') {
        const initResponse = await initializeInvoicePayment(selectedInvoice._id, {
          amount,
          gatewayId: selectedGateway._id,
          gatewayProvider: provider,
          paymentData: {
            payerName,
            payerEmail,
            acceptedTerms,
            paypalEmail,
            returnPath: window.location.pathname,
            billingAddress: {
              street: billingStreet,
              city: billingCity,
              zipCode: billingZipCode,
              country: billingCountry,
            },
          },
        });

        if (!initResponse.redirectUrl) {
          throw new Error('Das Gateway hat keine Redirect-URL zurückgegeben.');
        }

        window.location.href = initResponse.redirectUrl;
        return;
      }

      const response = await payInvoice(selectedInvoice._id, {
        amount,
        gatewayId: selectedGateway._id,
        gatewayProvider: provider,
        paymentData: {
          payerName,
          payerEmail,
          acceptedTerms,
          paypalEmail,
          accountHolder: bankAccountHolder,
          iban: bankIban,
          bic: bankBic,
          transferReference: bankTransferReference,
          billingAddress: {
            street: billingStreet,
            city: billingCity,
            zipCode: billingZipCode,
            country: billingCountry,
          },
        },
      });

      const updatedInvoice = {
        ...selectedInvoice,
        ...response.invoice,
        amountPaid: response.invoice?.paidAmount ?? response.invoice?.amountPaid,
        paymentMethod: provider,
        paymentHistory: [
          {
            _id: response.payment?._id,
            date: response.payment?.processedAt || new Date().toISOString(),
            amount,
            method: selectedGateway.name,
            note: response.payment?.transactionId || 'Transaktion erfasst',
          },
          ...(selectedInvoice.paymentHistory || []),
        ],
      };

      setSelectedInvoice(updatedInvoice);
      setInvoices((prev) => prev.map((invoice) => (invoice._id === updatedInvoice._id ? updatedInvoice : invoice)));
      setPaymentAmount(Math.max(0, Number(response.remainingAmount || 0)).toFixed(2));

      toast({
        title: t('common.success'),
        description: `Zahlung über ${selectedGateway.name} wurde erfolgreich erfasst.`,
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || 'Zahlung konnte nicht verarbeitet werden.',
        variant: 'destructive',
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('paymentStatus');
    const paymentProvider = params.get('paymentProvider');
    const invoiceId = params.get('invoiceId');
    const gatewayId = params.get('gatewayId');
    const stripeSessionId = params.get('sessionId');
    const paypalOrderToken = params.get('token');

    if (!paymentStatus || !paymentProvider || !invoiceId || !gatewayId) {
      return;
    }

    if (paymentStatus === 'cancel') {
      toast({
        title: t('common.error'),
        description: 'Zahlung wurde abgebrochen.',
        variant: 'destructive',
      });

      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (paymentStatus !== 'success') {
      return;
    }

    const providerReference = paymentProvider === 'stripe' ? stripeSessionId : paypalOrderToken;
    if (!providerReference || (paymentProvider !== 'stripe' && paymentProvider !== 'paypal')) {
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    const provider = paymentProvider as 'stripe' | 'paypal';

    const confirmRedirectPayment = async () => {
      try {
        const response = await confirmInvoicePayment(invoiceId, {
          gatewayProvider: provider,
          gatewayId,
          providerReference,
        });

        await fetchInvoices();
        await fetchStats();

        toast({
          title: t('common.success'),
          description: response.alreadyRecorded
            ? 'Zahlung wurde bereits verbucht.'
            : `Zahlung über ${provider === 'stripe' ? 'Stripe' : 'PayPal'} erfolgreich bestätigt.`,
        });
      } catch (error: any) {
        toast({
          title: t('common.error'),
          description: error.message || 'Zahlung konnte nicht bestätigt werden.',
          variant: 'destructive',
        });
      } finally {
        window.history.replaceState({}, '', window.location.pathname);
      }
    };

    void confirmRedirectPayment();
  }, []);

  const handleDownloadInvoice = (invoice: Invoice) => {
    // This would typically trigger a PDF download
    console.log('CustomerInvoices: Downloading invoice:', invoice.invoiceNumber);
    toast({
      title: t('common.success'),
      description: t('invoices.downloadStarted'),
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'partially_paid':
        return 'secondary';
      case 'sent':
      case 'viewed':
        return 'secondary';
      case 'overdue':
        return 'destructive';
      case 'draft':
      case 'pending_approval':
      case 'credited':
        return 'outline';
      case 'cancelled':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4" />;
      case 'partially_paid':
        return <DollarSign className="h-4 w-4" />;
      case 'overdue':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    const translation = t(`invoiceStatus.${status}`);
    return translation === `invoiceStatus.${status}` ? status.replace('_', ' ') : translation;
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-amber-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e] rounded-2xl shadow-xl p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#f5b800] rounded-full opacity-5 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#f5b800] rounded-full opacity-5 blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <FileText className="h-8 w-8 text-[#f5b800]" />
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{t('invoices.myInvoices')}</h1>
            </div>
            <p className="text-blue-100 text-base md:text-lg">{t('invoices.manageYourInvoices')}</p>
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e]">{t('invoices.totalInvoices')}</CardTitle>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#1a2a5e] to-[#2a3f7e] flex items-center justify-center">
                  <FileText className="h-6 w-6 text-white" />
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="text-3xl font-extrabold text-[#1a2a5e]">{stats.totalInvoices}</div>
                <p className="text-sm text-slate-500 mt-1">Alle Rechnungen</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e]">{t('invoices.totalAmount')}</CardTitle>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="text-3xl font-extrabold text-[#1a2a5e]">${stats.totalAmount?.toFixed(2) || '0.00'}</div>
                <p className="text-sm text-slate-500 mt-1">Gesamtbetrag</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e]">{t('invoices.unpaid')}</CardTitle>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#f5b800] to-[#e5ab00] flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="text-3xl font-extrabold text-[#f5b800]">${stats.unpaidAmount?.toFixed(2) || '0.00'}</div>
                <p className="text-sm text-slate-500 mt-1">
                  {stats.unpaidInvoices} {t('invoices.invoices')}
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e]">{t('invoices.overdue')}</CardTitle>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-white" />
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="text-3xl font-extrabold text-red-600">{stats.overdueInvoices}</div>
                <p className="text-sm text-slate-500 mt-1">Überfällige Rechnungen</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="border-none shadow-lg bg-white">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-[#1a2a5e]">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#f5b800] to-[#e5ab00] flex items-center justify-center flex-shrink-0">
                  <Filter className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-sm uppercase tracking-wide whitespace-nowrap">{t('common.filter')}</span>
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t('invoices.searchByInvoiceNumber')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9 text-sm border-slate-200 focus:border-[#f5b800] focus:ring-[#f5b800]"
                  />
                </div>
              </div>
              <div className="min-w-[180px]">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 text-sm border-slate-200 focus:border-[#f5b800] focus:ring-[#f5b800]">
                    <SelectValue placeholder={t('common.selectStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.all')}</SelectItem>
                    <SelectItem value="draft">{t('invoiceStatus.draft')}</SelectItem>
                    <SelectItem value="sent">{t('invoiceStatus.sent')}</SelectItem>
                    <SelectItem value="viewed">{t('invoiceStatus.viewed')}</SelectItem>
                    <SelectItem value="paid">{t('invoiceStatus.paid')}</SelectItem>
                    <SelectItem value="overdue">{t('invoiceStatus.overdue')}</SelectItem>
                    <SelectItem value="cancelled">{t('invoiceStatus.cancelled')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoices Table */}
        {filteredInvoices.length === 0 ? (
          <Card className="border-none shadow-lg bg-white">
            <CardContent className="py-16">
              <div className="text-center">
                <div className="h-20 w-20 mx-auto rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-6">
                  <FileText className="h-10 w-10 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-[#1a2a5e] mb-2">{t('invoices.noInvoices')}</h3>
                <p className="text-slate-500 text-base">{t('invoices.noInvoicesDescription')}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-none shadow-lg bg-white overflow-hidden">
            <CardHeader className="pb-4 border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-[#1a2a5e]">{t('invoices.invoiceList')}</CardTitle>
              <CardDescription className="text-base text-slate-500">
                {t('invoices.viewAndManageInvoices')}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50 border-b-2 border-slate-200">
                      <TableHead className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4">{t('invoices.invoiceNumber')}</TableHead>
                      <TableHead className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4">{t('invoices.date')}</TableHead>
                      <TableHead className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4">{t('invoices.dueDate')}</TableHead>
                      <TableHead className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4">{t('invoices.amount')}</TableHead>
                      <TableHead className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4">{t('common.status')}</TableHead>
                      <TableHead className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => (
                      <TableRow key={invoice._id} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="font-bold text-base text-[#1a2a5e] py-5">{invoice.invoiceNumber}</TableCell>
                        <TableCell className="text-base text-slate-600 py-5">
                          {new Date(invoice.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="py-5">
                          <span className={new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid' ? 'text-red-600 font-bold text-base' : 'text-base text-slate-600'}>
                            {new Date(invoice.dueDate).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell className="font-bold text-base text-[#1a2a5e] py-5">
                          ${invoice.total.toFixed(2)}
                        </TableCell>
                        <TableCell className="py-5">
                          <Badge variant={getStatusBadgeVariant(invoice.status)} className="flex items-center gap-1.5 w-fit text-sm px-3 py-1.5 font-semibold">
                            {getStatusIcon(invoice.status)}
                            {getStatusLabel(invoice.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-5">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewInvoice(invoice)}
                              className="h-10 text-sm px-4 border-[#1a2a5e] text-[#1a2a5e] hover:bg-[#1a2a5e] hover:text-white transition-colors font-semibold"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              {t('common.view')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadInvoice(invoice)}
                              className="h-10 text-sm px-4 border-[#f5b800] text-[#f5b800] hover:bg-[#f5b800] hover:text-white transition-colors font-semibold"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              {t('common.download')}
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
        )}

        {/* Invoice Details Dialog */}
        <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0 gap-0 [&>button]:text-white/80 [&>button]:hover:text-white [&>button]:top-3 [&>button]:right-3 [&>button]:ring-offset-transparent">
            {/* Blue Header */}
            <DialogHeader className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e] px-4 py-3 space-y-0 rounded-t-lg">
              <div className="flex items-center justify-between pr-7">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-md bg-white/15 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-white font-bold text-sm leading-tight">
                      {t('invoices.invoiceDetails')}
                    </DialogTitle>
                    <DialogDescription className="text-blue-200/80 text-xs leading-tight mt-0">
                      {selectedInvoice?.invoiceNumber}
                    </DialogDescription>
                  </div>
                </div>
                {selectedInvoice && (
                  <Badge
                    variant={getStatusBadgeVariant(selectedInvoice.status)}
                    className="text-xs font-semibold px-2 py-0.5 shrink-0 flex items-center gap-1"
                  >
                    {getStatusIcon(selectedInvoice.status)}
                    {getStatusLabel(selectedInvoice.status)}
                  </Badge>
                )}
              </div>
            </DialogHeader>

            {selectedInvoice && (
              <div className="overflow-y-auto max-h-[calc(90vh-68px)]">
                <div className="p-4 space-y-3">
                  {/* Basic Info Grid */}
                  <div className="grid grid-cols-3 gap-x-3 gap-y-2 bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rechnungsnr.</p>
                      <p className="text-xs font-bold text-[#1a2a5e] mt-0.5">{selectedInvoice.invoiceNumber}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rechnungsdatum</p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">{new Date(selectedInvoice.createdAt).toLocaleDateString('de-DE')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fälligkeitsdatum</p>
                      <p className={`text-xs font-semibold mt-0.5 ${new Date(selectedInvoice.dueDate) < new Date() && selectedInvoice.status !== 'paid' ? 'text-red-600 font-bold' : 'text-slate-700'}`}>
                        {new Date(selectedInvoice.dueDate).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kundenname</p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">{selectedInvoice.customerName}</p>
                    </div>
                    {selectedInvoice.contactPerson ? (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ansprechpartner</p>
                        <p className="text-xs font-semibold text-slate-700 mt-0.5">{selectedInvoice.contactPerson}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">E-Mail</p>
                        <p className="text-xs font-semibold text-slate-700 mt-0.5 truncate">{selectedInvoice.customerEmail}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Zahlungsart</p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">{selectedInvoice.paymentMethod || selectedInvoice.paymentTerms}</p>
                    </div>
                    {selectedInvoice.billingAddress && (
                      <div className="col-span-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rechnungsadresse</p>
                        <p className="text-xs font-semibold text-slate-700 mt-0.5">
                          {typeof selectedInvoice.billingAddress === 'string'
                            ? selectedInvoice.billingAddress
                            : [
                                selectedInvoice.billingAddress.street,
                                selectedInvoice.billingAddress.zip && selectedInvoice.billingAddress.city
                                  ? `${selectedInvoice.billingAddress.zip} ${selectedInvoice.billingAddress.city}`
                                  : selectedInvoice.billingAddress.city,
                                selectedInvoice.billingAddress.country,
                              ].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Line Items */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-[#1a2a5e] px-3 py-1.5">
                      <h3 className="font-bold text-[10px] text-white uppercase tracking-wider">Positionen</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left py-1.5 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Beschreibung</th>
                            <th className="text-right py-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Menge</th>
                            <th className="text-right py-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Einzelpreis</th>
                            <th className="text-right py-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rabatt</th>
                            <th className="text-right py-1.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">MwSt.</th>
                            <th className="text-right py-1.5 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Zwischensumme</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInvoice.items.map((item, idx) => (
                            <tr key={item._id} className={`border-b border-slate-100 last:border-0 ${idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}`}>
                              <td className="py-1.5 px-3">
                                <p className="text-xs font-semibold text-slate-800">{item.description}</p>
                                <span className="inline-block text-[9px] font-semibold text-amber-700 bg-amber-50 px-1 py-0.5 rounded leading-tight mt-0.5">{item.type}</span>
                              </td>
                              <td className="text-right py-1.5 px-2 text-xs text-slate-600 font-medium">{item.quantity}</td>
                              <td className="text-right py-1.5 px-2 text-xs text-slate-600 font-medium">{item.unitPrice.toFixed(2)} €</td>
                              <td className="text-right py-1.5 px-2 text-xs font-medium">
                                {item.discount != null && item.discount > 0
                                  ? <span className="text-emerald-600">-{item.discount.toFixed(2)} €</span>
                                  : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="text-right py-1.5 px-2 text-xs text-slate-600 font-medium">
                                {item.taxRate != null ? `${item.taxRate}%` : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="text-right py-1.5 px-3 text-xs font-bold text-[#1a2a5e]">{item.total.toFixed(2)} €</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Financial Summary + Payment History */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Totals */}
                    <div className="border border-slate-200 rounded-lg p-3 space-y-1">
                      <h3 className="font-bold text-[10px] text-[#1a2a5e] uppercase tracking-wider mb-2">Finanzübersicht</h3>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Nettobetrag</span>
                        <span className="font-semibold text-slate-700">{selectedInvoice.subtotal.toFixed(2)} €</span>
                      </div>
                      {selectedInvoice.tax > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">MwSt.</span>
                          <span className="font-semibold text-slate-700">+ {selectedInvoice.tax.toFixed(2)} €</span>
                        </div>
                      )}
                      {selectedInvoice.discount > 0 && (
                        <div className="flex justify-between text-xs text-emerald-600">
                          <span>Rabatt</span>
                          <span className="font-semibold">- {selectedInvoice.discount.toFixed(2)} €</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs font-bold border-t border-slate-200 pt-1.5">
                        <span className="text-[#1a2a5e]">Bruttobetrag</span>
                        <span className="text-[#1a2a5e]">{selectedInvoice.total.toFixed(2)} €</span>
                      </div>
                      {selectedInvoice.amountPaid != null && selectedInvoice.amountPaid > 0 && (
                        <div className="flex justify-between text-xs text-emerald-600">
                          <span>Bereits bezahlt</span>
                          <span className="font-semibold">- {selectedInvoice.amountPaid.toFixed(2)} €</span>
                        </div>
                      )}
                      {selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' && (
                        <div className="flex justify-between text-xs font-bold border-t border-red-100 pt-1.5 text-red-600">
                          <span>Offener Restbetrag</span>
                          <span>{(selectedInvoice.total - (selectedInvoice.amountPaid || 0)).toFixed(2)} €</span>
                        </div>
                      )}
                      {selectedInvoice.status === 'paid' && (
                        <div className="flex justify-between text-xs font-bold border-t border-emerald-100 pt-1.5 text-emerald-600">
                          <span>Vollständig bezahlt</span>
                          {selectedInvoice.paidAt && <span>{new Date(selectedInvoice.paidAt).toLocaleDateString('de-DE')}</span>}
                        </div>
                      )}
                    </div>

                    {/* Payment History */}
                    <div className="border border-slate-200 rounded-lg p-3">
                      <h3 className="font-bold text-[10px] text-[#1a2a5e] uppercase tracking-wider mb-2">Zahlungsverlauf</h3>
                      {selectedInvoice.paymentHistory && selectedInvoice.paymentHistory.length > 0 ? (
                        <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                          {selectedInvoice.paymentHistory.map((payment, idx) => (
                            <div key={idx} className="flex justify-between items-start border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                              <div>
                                <p className="text-xs font-semibold text-slate-700">{new Date(payment.date).toLocaleDateString('de-DE')}</p>
                                {payment.method && <p className="text-[10px] text-slate-400">{payment.method}</p>}
                                {payment.note && <p className="text-[10px] text-slate-400 italic">{payment.note}</p>}
                              </div>
                              <span className="text-xs font-bold text-emerald-600 ml-2 shrink-0">{payment.amount.toFixed(2)} €</span>
                            </div>
                          ))}
                        </div>
                      ) : selectedInvoice.status === 'paid' && selectedInvoice.paidAt ? (
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-semibold text-slate-700">{new Date(selectedInvoice.paidAt).toLocaleDateString('de-DE')}</p>
                            <p className="text-[10px] text-slate-400">Vollständige Zahlung</p>
                          </div>
                          <span className="text-xs font-bold text-emerald-600 ml-2">{selectedInvoice.total.toFixed(2)} €</span>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">Keine Zahlungen erfasst</p>
                      )}
                    </div>
                  </div>

                  {/* Payment Gateway Checkout */}
                  {selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' && selectedInvoice.status !== 'credited' && (
                    <div className="border border-blue-200 rounded-lg overflow-hidden">
                      <div className="bg-[#1a2a5e] px-3 py-1.5 flex items-center justify-between">
                        <h3 className="font-bold text-[10px] text-white uppercase tracking-wider">Rechnung bezahlen</h3>
                        <span className="text-[10px] text-blue-100">Offen: {outstandingAmount.toFixed(2)} EUR</span>
                      </div>
                      <div className="p-3 space-y-2 bg-blue-50/40">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Gateway</p>
                            <Select value={selectedGatewayId} onValueChange={setSelectedGatewayId}>
                              <SelectTrigger className="h-8 text-xs bg-white">
                                <SelectValue placeholder={loadingPaymentGateways ? 'Lade...' : 'Gateway wählen'} />
                              </SelectTrigger>
                              <SelectContent>
                                {paymentGateways.map((gateway) => (
                                  <SelectItem key={gateway._id} value={gateway._id}>
                                    {gateway.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Betrag</p>
                            <Input
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value.replace(',', '.'))}
                              className="h-8 text-xs bg-white"
                              placeholder="0.00"
                              inputMode="decimal"
                            />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Währung</p>
                            <Input
                              value={selectedGateway?.currency || 'EUR'}
                              readOnly
                              className="h-8 text-xs bg-slate-50"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Zahler Name</p>
                            <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} className="h-8 text-xs bg-white" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Zahler E-Mail</p>
                            <Input type="email" value={payerEmail} onChange={(e) => setPayerEmail(e.target.value)} className="h-8 text-xs bg-white" />
                          </div>
                        </div>

                        {selectedGateway?.provider === 'stripe' && (
                          <div className="rounded-md border border-blue-200 bg-white p-2 space-y-2">
                            <p className="text-[10px] font-bold text-[#1a2a5e] uppercase tracking-wider">Stripe Redirect</p>
                            <p className="text-[10px] text-slate-500">Nach Klick auf Bezahlen werden Sie zur sicheren Stripe-Zahlungsseite weitergeleitet.</p>
                            <div className="grid grid-cols-2 gap-2">
                              <Input value={billingStreet} onChange={(e) => setBillingStreet(e.target.value)} className="h-8 text-xs" placeholder="Straße" />
                              <Input value={billingCity} onChange={(e) => setBillingCity(e.target.value)} className="h-8 text-xs" placeholder="Stadt" />
                              <Input value={billingZipCode} onChange={(e) => setBillingZipCode(e.target.value)} className="h-8 text-xs" placeholder="PLZ" />
                              <Input value={billingCountry} onChange={(e) => setBillingCountry(e.target.value)} className="h-8 text-xs" placeholder="Land" />
                            </div>
                          </div>
                        )}

                        {selectedGateway?.provider === 'paypal' && (
                          <div className="rounded-md border border-blue-200 bg-white p-2 space-y-1.5">
                            <p className="text-[10px] font-bold text-[#1a2a5e] uppercase tracking-wider">PayPal Angaben</p>
                            <Input
                              type="email"
                              value={paypalEmail}
                              onChange={(e) => setPaypalEmail(e.target.value)}
                              className="h-8 text-xs"
                              placeholder="PayPal E-Mail"
                            />
                            <p className="text-[10px] text-slate-500">Sie werden nach der Erfassung zur finalen Freigabe an PayPal weitergeleitet (je nach Gateway-Konfiguration).</p>
                          </div>
                        )}

                        {selectedGateway?.provider === 'bank_transfer' && (
                          <div className="rounded-md border border-blue-200 bg-white p-2 space-y-2">
                            <p className="text-[10px] font-bold text-[#1a2a5e] uppercase tracking-wider">Überweisungsdaten</p>
                            <div className="grid grid-cols-2 gap-2">
                              <Input value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} className="h-8 text-xs" placeholder="Kontoinhaber" />
                              <Input value={bankIban} onChange={(e) => setBankIban(e.target.value)} className="h-8 text-xs" placeholder="IBAN" />
                              <Input value={bankBic} onChange={(e) => setBankBic(e.target.value)} className="h-8 text-xs" placeholder="BIC (optional)" />
                              <Input value={bankTransferReference} onChange={(e) => setBankTransferReference(e.target.value)} className="h-8 text-xs" placeholder="Verwendungszweck" />
                            </div>
                            <div className="rounded-md bg-slate-50 border border-slate-200 p-2 text-[10px] text-slate-600 space-y-0.5">
                              <p><span className="font-semibold">Empfänger:</span> {selectedGateway.configuration.account_holder || '-'}</p>
                              <p><span className="font-semibold">IBAN:</span> {selectedGateway.configuration.iban || '-'}</p>
                              <p><span className="font-semibold">BIC:</span> {selectedGateway.configuration.bic || '-'}</p>
                              <p><span className="font-semibold">Bank:</span> {selectedGateway.configuration.bank_name || '-'}</p>
                            </div>
                          </div>
                        )}

                        <label className="flex items-center gap-2 text-[11px] text-slate-600">
                          <input
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-300"
                          />
                          Ich bestätige die Zahlungsbedingungen und die Richtigkeit meiner Angaben.
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Notes & Payment Terms */}
                  <div className="space-y-2">
                    {selectedInvoice.notes && (
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <h3 className="font-bold text-[10px] text-[#1a2a5e] uppercase tracking-wider mb-1">Notizen</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">{selectedInvoice.notes}</p>
                      </div>
                    )}
                    <div className="bg-blue-50 rounded-lg p-2.5 border border-blue-100">
                      <p className="text-xs text-slate-500"><span className="font-bold text-slate-600">Zahlungsbedingungen:</span> {selectedInvoice.paymentTerms}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadInvoice(selectedInvoice)}
                      className="h-8 text-xs px-3 border-slate-300 hover:border-slate-400 font-semibold"
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      {t('common.download')}
                    </Button>
                    {selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' && selectedInvoice.status !== 'credited' && (
                      <Button
                        size="sm"
                        onClick={handlePayInvoice}
                        disabled={processingPayment || outstandingAmount <= 0}
                        className="h-8 text-xs px-3 bg-gradient-to-r from-[#f5b800] to-[#e5ab00] hover:from-[#e5ab00] hover:to-[#d9a400] text-white font-bold shadow"
                      >
                        <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                        {processingPayment ? 'Wird verarbeitet...' : t('invoices.payNow')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
