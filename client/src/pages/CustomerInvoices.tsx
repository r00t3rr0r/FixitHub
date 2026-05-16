import { useState, useEffect, useRef } from "react";
import { formatEUR } from '@/lib/utils';
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
  getInvoicePaypalConfig,
  initializeInvoicePayment,
  markInvoiceAsViewed,
  payInvoice,
  Invoice,
  InvoicePaymentGateway,
  InvoicePaypalSdkConfig,
} from "@/api/invoices";
import { useToast } from "@/hooks/useToast";

export function CustomerInvoices() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
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

  // --- PayPal JS SDK state for invoice payment ---
  const [paypalInvoiceSdkReady, setPaypalInvoiceSdkReady] = useState(false);
  const [paypalInvoiceSdkLoading, setPaypalInvoiceSdkLoading] = useState(false);
  const [paypalInvoiceError, setPaypalInvoiceError] = useState("");
  const [paypalInvoiceConfig, setPaypalInvoiceConfig] = useState<InvoicePaypalSdkConfig | null>(null);
  const paypalInvoiceButtonRef = useRef<HTMLDivElement | null>(null);

  // Mutable ref so PayPal callbacks always read the latest state values
  const invoicePaypalValuesRef = useRef({
    selectedInvoice: null as Invoice | null,
    selectedGateway: null as InvoicePaymentGateway | null,
    amount: "",
    acceptedTerms: false,
    payerName: "",
    payerEmail: "",
  });

  // Keep the ref in sync on every render
  const _selectedGatewayForRef = paymentGateways.find((g) => g._id === selectedGatewayId) ?? null;
  invoicePaypalValuesRef.current = {
    selectedInvoice,
    selectedGateway: _selectedGatewayForRef,
    amount: paymentAmount,
    acceptedTerms,
    payerName,
    payerEmail,
  };

  // Load PayPal JS SDK when a PayPal gateway is selected
  useEffect(() => {
    const gateway = paymentGateways.find((g) => g._id === selectedGatewayId);
    if (!showInvoiceDialog || gateway?.provider !== 'paypal') {
      setPaypalInvoiceSdkReady(false);
      setPaypalInvoiceError("");
      setPaypalInvoiceConfig(null);
      return;
    }

    let cancelled = false;
    const loadSdk = async () => {
      setPaypalInvoiceSdkLoading(true);
      setPaypalInvoiceError("");
      try {
        const config = await getInvoicePaypalConfig(selectedGatewayId);
        if (cancelled) return;
        setPaypalInvoiceConfig(config);

        const scriptId = "paypal-js-sdk";
        const paypalLocale = (config.locale || 'de_DE').replace('-', '_');
        const sdkSrc = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.clientId)}&currency=${encodeURIComponent(config.currency)}&intent=${encodeURIComponent(config.intent.toLowerCase())}&locale=${encodeURIComponent(paypalLocale)}&components=buttons`;

        if ((window as any).paypal?.Buttons) {
          setPaypalInvoiceSdkReady(true);
          setPaypalInvoiceSdkLoading(false);
          return;
        }

        const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
        if (existingScript && existingScript.src !== sdkSrc) {
          existingScript.remove();
        } else if (existingScript) {
          existingScript.addEventListener('load', () => {
            if (cancelled) return;
            setPaypalInvoiceSdkReady(true);
            setPaypalInvoiceSdkLoading(false);
          });
          existingScript.addEventListener('error', () => {
            if (cancelled) return;
            setPaypalInvoiceError('PayPal SDK konnte nicht geladen werden.');
            setPaypalInvoiceSdkLoading(false);
          });
          return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = sdkSrc;
        script.async = true;
        script.onload = () => {
          if (cancelled) return;
          setPaypalInvoiceSdkReady(true);
          setPaypalInvoiceSdkLoading(false);
        };
        script.onerror = () => {
          if (cancelled) return;
          setPaypalInvoiceError('PayPal SDK konnte nicht geladen werden.');
          setPaypalInvoiceSdkLoading(false);
        };
        document.body.appendChild(script);
      } catch (err: any) {
        if (cancelled) return;
        setPaypalInvoiceError(err.message || 'PayPal-Konfiguration konnte nicht geladen werden.');
        setPaypalInvoiceSdkLoading(false);
      }
    };

    loadSdk();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInvoiceDialog, selectedGatewayId]);

  // Render PayPal buttons when SDK is ready
  useEffect(() => {
    if (
      !showInvoiceDialog ||
      !paypalInvoiceSdkReady ||
      !paypalInvoiceConfig ||
      !paypalInvoiceButtonRef.current ||
      !(window as any).paypal?.Buttons
    ) {
      return;
    }

    paypalInvoiceButtonRef.current.innerHTML = '';

    const paypalNs = (window as any).paypal;
    const buttons = paypalNs.Buttons({
      style: {
        layout: paypalInvoiceConfig.button.layout || 'vertical',
        color: paypalInvoiceConfig.button.color || 'gold',
        shape: paypalInvoiceConfig.button.shape || 'rect',
        label: paypalInvoiceConfig.button.label || 'paypal',
      },
      onClick: (_data: any, actions: any) => {
        const vals = invoicePaypalValuesRef.current;
        const amount = Number(vals.amount);

        if (!vals.acceptedTerms) {
          toast({ title: t('common.error'), description: 'Bitte bestätigen Sie die Zahlungsbedingungen.', variant: 'destructive' });
          return actions.reject();
        }

        if (!vals.payerName?.trim() || !vals.payerEmail?.trim()) {
          toast({ title: t('common.error'), description: 'Name und E-Mail des Zahlers sind erforderlich.', variant: 'destructive' });
          return actions.reject();
        }

        if (!amount || amount <= 0) {
          toast({ title: t('common.error'), description: 'Bitte geben Sie einen gültigen Zahlungsbetrag ein.', variant: 'destructive' });
          return actions.reject();
        }

        if (!vals.selectedInvoice || !vals.selectedGateway) {
          toast({ title: t('common.error'), description: 'Rechnung oder Gateway konnte nicht geladen werden.', variant: 'destructive' });
          return actions.reject();
        }

        return actions.resolve();
      },
      createOrder: async () => {
        const vals = invoicePaypalValuesRef.current;
        if (!vals.selectedInvoice || !vals.selectedGateway) {
          throw new Error('Rechnung oder Gateway nicht gefunden.');
        }
        const amount = Number(vals.amount);
        if (!amount || amount <= 0) throw new Error('Invalid amount');
        const initResp = await initializeInvoicePayment(vals.selectedInvoice._id, {
          amount,
          gatewayId: vals.selectedGateway._id,
          gatewayProvider: 'paypal',
          paymentData: {
            payerName: vals.payerName,
            payerEmail: vals.payerEmail,
            paypalEmail: vals.payerEmail,
            acceptedTerms: vals.acceptedTerms,
          },
        });
        return initResp.providerReference;
      },
      onApprove: async (data: { orderID: string }) => {
        try {
          setProcessingPayment(true);
          const vals = invoicePaypalValuesRef.current;
          if (!vals.selectedInvoice || !vals.selectedGateway) {
            throw new Error('Rechnung nicht gefunden.');
          }
          const response = await confirmInvoicePayment(vals.selectedInvoice._id, {
            gatewayProvider: 'paypal',
            gatewayId: vals.selectedGateway._id,
            providerReference: data.orderID,
          });

          const updatedInvoice = {
            ...vals.selectedInvoice,
            ...response.invoice,
            amountPaid: response.invoice?.paidAmount ?? response.invoice?.amountPaid,
            paymentMethod: 'paypal',
            paymentHistory: [
              {
                _id: response.payment?._id,
                date: response.payment?.processedAt || new Date().toISOString(),
                amount: Number(vals.amount),
                method: vals.selectedGateway.name,
                note: response.payment?.transactionId || 'PayPal',
              },
              ...(vals.selectedInvoice.paymentHistory || []),
            ],
          };
          setSelectedInvoice(updatedInvoice);
          setInvoices((prev) => prev.map((inv) => (inv._id === updatedInvoice._id ? updatedInvoice : inv)));
          setPaymentAmount(Math.max(0, Number(response.remainingAmount || 0)).toFixed(2));

          toast({ title: t('common.success'), description: 'PayPal-Zahlung erfolgreich abgeschlossen.' });
        } catch (err: any) {
          toast({ title: t('common.error'), description: err.message || 'PayPal-Zahlung konnte nicht abgeschlossen werden.', variant: 'destructive' });
        } finally {
          setProcessingPayment(false);
        }
      },
      onCancel: () => {
        toast({ title: t('common.error'), description: 'PayPal-Zahlung wurde abgebrochen.', variant: 'destructive' });
      },
      onError: () => {
        toast({ title: t('common.error'), description: 'PayPal-Dialog konnte nicht gestartet werden.', variant: 'destructive' });
      },
    });

    if (!buttons?.isEligible || !buttons.isEligible()) {
      setPaypalInvoiceError('PayPal ist in dieser Umgebung nicht verfügbar.');
      return;
    }
    buttons.render(paypalInvoiceButtonRef.current);
  }, [showInvoiceDialog, paypalInvoiceSdkReady, paypalInvoiceConfig]);

  useEffect(() => {
    fetchInvoices();
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
        description: `Der Betrag übersteigt den offenen Restbetrag (${formatEUR(outstandingAmount)}).`,
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

  const getStatusAccentColor = (status: string) => {
    switch (status) {
      case "paid":
        return "#10b981";
      case "overdue":
        return "#ef4444";
      case "sent":
        return "#3b82f6";
      case "viewed":
        return "#f5b800";
      case "cancelled":
        return "#64748b";
      default:
        return "#94a3b8";
    }
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
      <div className="mx-auto w-[calc(100%-2rem)] max-w-[1200px] pb-8 space-y-8 max-[480px]:w-[calc(100%-0.8rem)] max-[360px]:w-[calc(100%-0.5rem)]">
        {/* Header Section */}
        <div className="w-full overflow-hidden rounded-[18px] border-b border-[#2a3f7e] bg-gradient-to-br from-[#1a2a5e] to-[#0f1d45] px-6 py-12 text-white max-[480px]:rounded-[12px] max-[480px]:px-3 max-[360px]:px-[10px]">
          <div className="flex items-start gap-4 sm:items-center max-[480px]:items-start max-[480px]:gap-[10px]">
            <FileText className="h-12 w-12 flex-shrink-0 text-[#f5b800] max-sm:h-[34px] max-sm:w-[34px]" />
            <div>
              <h1 className="m-0 text-[2rem] font-extrabold leading-[1.2] tracking-[-0.5px] max-[480px]:text-[1rem] max-[480px]:leading-[1.25] max-[360px]:text-[0.92rem]">{t('invoices.myInvoices')}</h1>
              <p className="mt-1 text-[0.95rem] leading-[1.35] text-[rgba(255,255,255,0.85)] opacity-90 max-[480px]:text-[0.76rem] max-[360px]:text-[0.72rem]">{t('invoices.manageYourInvoices')}</p>
            </div>
          </div>
        </div>

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

        {/* Invoices List */}
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
            <CardContent className="p-4 sm:p-5 space-y-3">
              {filteredInvoices.map((invoice) => {
                const isOverdue = new Date(invoice.dueDate) < new Date() && invoice.status !== "paid";

                return (
                  <div
                    key={invoice._id}
                    onClick={() => handleViewInvoice(invoice)}
                    className="group bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex items-center gap-4 cursor-pointer transition-all hover:border-[#f5b800] hover:shadow-md"
                  >
                    <div
                      className="w-1 self-stretch rounded-full"
                      style={{ background: getStatusAccentColor(invoice.status) }}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">{invoice.invoiceNumber}</span>
                        <Badge variant={getStatusBadgeVariant(invoice.status)} className="flex items-center gap-1.5 w-fit text-xs px-2.5 py-1 font-semibold">
                          {getStatusIcon(invoice.status)}
                          {getStatusLabel(invoice.status)}
                        </Badge>
                      </div>

                      <p className="text-base font-semibold text-slate-900 truncate mb-1.5">
                        {invoice.customerName}
                      </p>

                      <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-600 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(invoice.createdAt).toLocaleDateString("de-DE")}
                        </span>
                        <span className={`inline-flex items-center gap-1 ${isOverdue ? "text-red-600 font-semibold" : ""}`}>
                          <AlertCircle className="h-3.5 w-3.5" />
                          {t('invoices.dueDate')}: {new Date(invoice.dueDate).toLocaleDateString("de-DE")}
                        </span>
                        <span className="inline-flex items-center gap-1 font-bold text-[#1a2a5e]">
                          <DollarSign className="h-3.5 w-3.5" />
                          {formatEUR(invoice.total)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadInvoice(invoice);
                        }}
                        className="h-9 w-9 p-0 border-[#f5b800] text-[#f5b800] hover:bg-[#f5b800] hover:text-white"
                        title={t('common.download')}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <div className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-[#1a2a5e] group-hover:border-[#f5b800]">
                        <Eye className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
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
                              <td className="text-right py-1.5 px-2 text-xs text-slate-600 font-medium">{formatEUR(item.unitPrice)}</td>
                              <td className="text-right py-1.5 px-2 text-xs font-medium">
                                {item.discount != null && item.discount > 0
                                  ? <span className="text-emerald-600">-{formatEUR(item.discount)}</span>
                                  : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="text-right py-1.5 px-2 text-xs text-slate-600 font-medium">
                                {item.taxRate != null ? `${item.taxRate}%` : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="text-right py-1.5 px-3 text-xs font-bold text-[#1a2a5e]">{formatEUR(item.total)}</td>
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
                        <span className="font-semibold text-slate-700">{formatEUR(selectedInvoice.subtotal)}</span>
                      </div>
                      {selectedInvoice.tax > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">MwSt.</span>
                          <span className="font-semibold text-slate-700">+ {formatEUR(selectedInvoice.tax)}</span>
                        </div>
                      )}
                      {selectedInvoice.discount > 0 && (
                        <div className="flex justify-between text-xs text-emerald-600">
                          <span>Rabatt</span>
                          <span className="font-semibold">- {formatEUR(selectedInvoice.discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs font-bold border-t border-slate-200 pt-1.5">
                        <span className="text-[#1a2a5e]">Bruttobetrag</span>
                        <span className="text-[#1a2a5e]">{formatEUR(selectedInvoice.total)}</span>
                      </div>
                      {selectedInvoice.amountPaid != null && selectedInvoice.amountPaid > 0 && (
                        <div className="flex justify-between text-xs text-emerald-600">
                          <span>Bereits bezahlt</span>
                          <span className="font-semibold">- {formatEUR(selectedInvoice.amountPaid)}</span>
                        </div>
                      )}
                      {selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' && (
                        <div className="flex justify-between text-xs font-bold border-t border-red-100 pt-1.5 text-red-600">
                          <span>Offener Restbetrag</span>
                          <span>{formatEUR(selectedInvoice.total - (selectedInvoice.amountPaid || 0))}</span>
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
                              <span className="text-xs font-bold text-emerald-600 ml-2 shrink-0">{formatEUR(payment.amount)}</span>
                            </div>
                          ))}
                        </div>
                      ) : selectedInvoice.status === 'paid' && selectedInvoice.paidAt ? (
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-semibold text-slate-700">{new Date(selectedInvoice.paidAt).toLocaleDateString('de-DE')}</p>
                            <p className="text-[10px] text-slate-400">Vollständige Zahlung</p>
                          </div>
                          <span className="text-xs font-bold text-emerald-600 ml-2">{formatEUR(selectedInvoice.total)}</span>
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
                        <span className="text-[10px] text-blue-100">Offen: {formatEUR(outstandingAmount)}</span>
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
                          <div className="rounded-md border border-[#f5b800]/60 bg-white p-2 space-y-2">
                            <p className="text-[10px] font-bold text-[#1a2a5e] uppercase tracking-wider">PayPal</p>
                            {paypalInvoiceSdkLoading && (
                              <div className="flex items-center gap-2 py-2">
                                <div className="animate-spin h-4 w-4 border-2 border-[#1a2a5e] border-t-transparent rounded-full" />
                                <span className="text-[10px] text-slate-500">PayPal wird geladen…</span>
                              </div>
                            )}
                            {paypalInvoiceError && (
                              <p className="text-[10px] text-red-600">{paypalInvoiceError}</p>
                            )}
                            {paypalInvoiceSdkReady && !paypalInvoiceError && (
                              <div ref={paypalInvoiceButtonRef} className="min-h-[40px]" />
                            )}
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
                    {selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' && selectedInvoice.status !== 'credited' && selectedGateway?.provider !== 'paypal' && (
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
