import { useState, useEffect, useRef } from "react";
import { SEO } from '@/components/SEO'
import { formatEUR } from '@/lib/utils';
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
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
  getInvoice,
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
import jsPDF from "jspdf";

export function CustomerInvoices() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);

  const [highlightedInvoiceId, setHighlightedInvoiceId] = useState<string | null>(null);
  const [pendingHighlightId, setPendingHighlightId] = useState<string | null>(null);
  const [pendingOpenId, setPendingOpenId] = useState<string | null>(null);
  const [paymentGateways, setPaymentGateways] = useState<InvoicePaymentGateway[]>([]);
  const [loadingPaymentGateways, setLoadingPaymentGateways] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [selectedGatewayId, setSelectedGatewayId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [termsError, setTermsError] = useState(false);

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

  // Handle incoming navigation state for invoice highlight + dialog open
  useEffect(() => {
    const state = location.state as any;
    if (state?.highlightInvoiceId) {
      setPendingHighlightId(state.highlightInvoiceId);
      setPendingOpenId(state.openInvoiceId || state.highlightInvoiceId);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  useEffect(() => {
    if (!pendingHighlightId || loading || invoices.length === 0) return;
    const invoiceId = pendingHighlightId;
    const openId = pendingOpenId;
    setPendingHighlightId(null);
    setPendingOpenId(null);

    const timer = setTimeout(() => {
      const row = document.querySelector(`[data-invoice-id="${invoiceId}"]`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedInvoiceId(invoiceId);
        setTimeout(() => setHighlightedInvoiceId(null), 1600);
      }
      if (openId) {
        const inv = invoices.find((i) => i._id === openId);
        if (inv) setTimeout(() => handleViewInvoice(inv), 900);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [pendingHighlightId, loading, invoices]);

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
          setTermsError(true);
          document.getElementById('invoice-terms-checkbox')?.closest('label')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
          isJsSdk: true,
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
          };
          setSelectedInvoice(updatedInvoice);
          setPaymentAmount(Math.max(0, Number(response.remainingAmount || 0)).toFixed(2));
          await fetchInvoices();

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
      const detailedResponse = await getInvoice(invoice._id);
      const detailedInvoice = detailedResponse.invoice || invoice;
      const mergedInvoice = {
        ...invoice,
        ...detailedInvoice,
        customerId:
          (typeof detailedInvoice.customerId === 'object' && detailedInvoice.customerId)
            ? detailedInvoice.customerId
            : invoice.customerId,
      } as Invoice;
      setSelectedInvoice(mergedInvoice);
      setShowInvoiceDialog(true);
      setPayerName(mergedInvoice.customerName || invoice.customerName || "");
      setPayerEmail(mergedInvoice.customerEmail || invoice.customerEmail || "");

      const openAmount = Math.max(0, Number(mergedInvoice.total || 0) - Number(mergedInvoice.paidAmount || mergedInvoice.amountPaid || 0));
      setPaymentAmount(openAmount.toFixed(2));

      setSelectedGatewayId("");
      setAcceptedTerms(false);
      setTermsError(false);
      setPaypalEmail(mergedInvoice.customerEmail || invoice.customerEmail || "");
      setBankAccountHolder(mergedInvoice.customerName || invoice.customerName || "");
      setBankIban("");
      setBankBic("");
      setBankTransferReference(mergedInvoice.invoiceNumber || invoice.invoiceNumber || "");
      setBillingStreet("");
      setBillingCity("");
      setBillingZipCode("");
      setBillingCountry("DE");

      await fetchPaymentGateways();

      // Mark as viewed if it was sent
      if (mergedInvoice.status === 'sent') {
        await markInvoiceAsViewed(mergedInvoice._id);
        // Update local state
        setInvoices((prev) =>
          prev.map((inv) =>
            inv._id === mergedInvoice._id ? { ...inv, status: 'viewed' as const } : inv
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
      const gateways = response.gateways || [];
      setPaymentGateways(gateways);
      setSelectedGatewayId((current) => {
        if (current && gateways.some((gateway) => gateway._id === current)) {
          return current;
        }

        const preferredGateway = gateways.find((gateway) => gateway.provider === 'paypal') || gateways[0] || null;
        return preferredGateway?._id || '';
      });
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

  const normalizeAddressLines = (addressInput: unknown, fallbackCountry = "", fallbackAddition = "") => {
    const readText = (value: unknown) => String(value ?? "").trim();
    const pickField = (source: Record<string, unknown>, keys: string[]) => {
      for (const key of keys) {
        const candidate = readText(source[key]);
        if (candidate) return candidate;
      }
      return "";
    };

    if (!addressInput) return [] as string[];

    if (typeof addressInput === "string") {
      return addressInput
        .split(/\n|,/) 
        .map((line) => line.trim())
        .filter(Boolean);
    }

    if (typeof addressInput !== "object") return [] as string[];

    const source = addressInput as Record<string, unknown>;
    const street = pickField(source, ["street", "line1", "addressLine1", "address1"]);
    const street2 = pickField(source, ["line2", "addressLine2", "address2"]);
    const zip = pickField(source, ["zip", "postalCode", "postcode", "zipCode"]);
    const city = pickField(source, ["city", "town"]);
    const state = pickField(source, ["state", "province"]);
    const country = pickField(source, ["country"]) || fallbackCountry;
    const addition = pickField(source, ["addressAddition", "addition"]) || fallbackAddition;
    const zipCity = [zip, city].filter(Boolean).join(" ").trim();

    return [addition, street, street2, zipCity, state, country].filter(Boolean);
  };

  const resolveInvoiceBillingAddressLines = (invoice: Invoice) => {
    const invoiceAny = invoice as Invoice & {
      customerId?: string | {
        country?: string;
        addressAddition?: string;
        invoiceAddress?: unknown;
        paymentAddress?: { sameAsInvoice?: boolean } & Record<string, unknown>;
        address?: unknown;
      };
    };

    const customerProfileFromInvoice = typeof invoiceAny.customerId === "object" ? invoiceAny.customerId : undefined;
    const fallbackInvoice = invoices.find((inv) => inv._id === invoice._id) as (Invoice & { customerId?: unknown }) | undefined;
    const customerProfileFromList =
      fallbackInvoice && typeof fallbackInvoice.customerId === "object"
        ? (fallbackInvoice.customerId as {
            country?: string;
            addressAddition?: string;
            invoiceAddress?: unknown;
            paymentAddress?: { sameAsInvoice?: boolean } & Record<string, unknown>;
            address?: unknown;
          })
        : undefined;
    const customerProfile = customerProfileFromInvoice || customerProfileFromList;
    const fallbackCountry = String(customerProfile?.country ?? "").trim();
    const fallbackAddition = String(customerProfile?.addressAddition ?? "").trim();

    const profileInvoiceAddress = normalizeAddressLines(
      customerProfile?.invoiceAddress,
      fallbackCountry,
      fallbackAddition,
    );
    if (profileInvoiceAddress.length) return profileInvoiceAddress;

    const profileGenericAddress = normalizeAddressLines(
      customerProfile?.address,
      fallbackCountry,
      fallbackAddition,
    );
    if (profileGenericAddress.length) return profileGenericAddress;

    const profileRootAddress = normalizeAddressLines(
      customerProfile,
      fallbackCountry,
      fallbackAddition,
    );
    if (profileRootAddress.length) return profileRootAddress;

    const paymentProfileAddress = normalizeAddressLines(
      customerProfile?.paymentAddress,
      fallbackCountry,
      fallbackAddition,
    );
    if (paymentProfileAddress.length) return paymentProfileAddress;

    return normalizeAddressLines(invoice.billingAddress);
  };

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
      setTermsError(true);
      document.getElementById('invoice-terms-checkbox')?.closest('label')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  const handleDownloadInvoice = async (invoice: Invoice) => {
    try {
      const detailedResponse = await getInvoice(invoice._id);
      const sourceInvoice = (detailedResponse?.invoice || invoice) as Invoice;

      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const left = 12;
      const right = pageWidth - 12;
      const strictTemplateMode = true;
      const logoUrl = "https://www.mcrepair.de/bilder/intern/shoplogo/logo180.png";
      const reviewUrl = "https://search.google.com/local/writereview?placeid=ChIJVVVVlf1QqEcRtHn-0ehLwpk&source=g.page.m.dd._&laa=lu-desktop-reviews-dialog-review-solicitation";
      const lineSoft: [number, number, number] = [203, 210, 222];
      const lineStrong: [number, number, number] = [138, 149, 170];

      const drawLine = (x1: number, y1: number, x2: number, y2: number, strong = false) => {
        const color = strong ? lineStrong : lineSoft;
        pdf.setDrawColor(...color);
        pdf.setLineWidth(strong ? 0.4 : 0.22);
        pdf.line(x1, y1, x2, y2);
      };

      const drawRect = (x: number, y: number, w: number, h: number, strong = false) => {
        const color = strong ? lineStrong : lineSoft;
        pdf.setDrawColor(...color);
        pdf.setLineWidth(strong ? 0.4 : 0.24);
        pdf.rect(x, y, w, h);
      };

      const formatDate = (value?: string | Date) => {
        if (!value) return "-";
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return "-";
        return parsed.toLocaleDateString("de-DE");
      };

      const formatMoney = (value: number | undefined | null) => {
        const numeric = Number(value || 0);
        return `${numeric.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
      };

      const formatSignedMoney = (value: number | undefined | null) => {
        const numeric = Number(value || 0);
        const sign = numeric < 0 ? "-" : "";
        const absolute = Math.abs(numeric);
        return `${sign}${absolute.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
      };

      const formatTax = (value: number | undefined | null) => {
        const numeric = Number(value || 0);
        return `${numeric.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
      };

      const cleanText = (value: unknown, fallback = "-") => {
        const text = String(value ?? "").trim();
        return text || fallback;
      };

      const normalizeAmount = (value: number | undefined | null) => Number(value || 0);

      const createQrDataUrl = async (value: string): Promise<string | null> => {
        try {
          const qrModule = await import("qrcode");
          const toDataURL = (qrModule as any).toDataURL || (qrModule as any).default?.toDataURL;
          if (!toDataURL) return null;

          return await toDataURL(value, {
            errorCorrectionLevel: "M",
            margin: 1,
            width: 300,
            color: {
              dark: "#0b1220",
              light: "#FFFFFF",
            },
          });
        } catch {
          return null;
        }
      };

      const loadImageData = async (url: string): Promise<{ dataUrl: string; width: number; height: number } | null> => {
        return new Promise((resolve) => {
          const image = new Image();
          image.crossOrigin = "anonymous";
          image.onload = () => {
            try {
              const canvas = document.createElement("canvas");
              canvas.width = image.naturalWidth;
              canvas.height = image.naturalHeight;
              const context = canvas.getContext("2d");
              if (!context) {
                resolve(null);
                return;
              }
              context.drawImage(image, 0, 0);
              resolve({
                dataUrl: canvas.toDataURL("image/png"),
                width: image.naturalWidth,
                height: image.naturalHeight,
              });
            } catch {
              resolve(null);
            }
          };
          image.onerror = () => resolve(null);
          if (url.startsWith("data:")) {
            image.src = url;
          } else {
            image.src = url.includes("?") ? `${url}&v=1` : `${url}?v=1`;
          }
        });
      };

      const rawInvoice = sourceInvoice as Invoice & {
        customerId?: string | {
          _id?: string;
          customerNumber?: string;
          addressAddition?: string;
          country?: string;
          invoiceAddress?: {
            street?: string;
            city?: string;
            state?: string;
            zipCode?: string;
            country?: string;
          };
          paymentAddress?: {
            street?: string;
            city?: string;
            state?: string;
            zipCode?: string;
            country?: string;
            sameAsInvoice?: boolean;
          };
        };
        customerNumber?: string;
      };

      const pickAddressField = (source: Record<string, unknown>, keys: string[]) => {
        for (const key of keys) {
          const value = cleanText(source[key], "");
          if (value) return value;
        }
        return "";
      };

      const toAddressLines = (addressInput?: unknown, fallbackCountry = "", fallbackAddition = "") => {
        if (!addressInput) return [];

        if (typeof addressInput === "string") {
          return addressInput
            .split(/\n|,/) 
            .map((line) => line.trim())
            .filter(Boolean);
        }

        if (typeof addressInput === "object") {
          const addressAny = addressInput as Record<string, unknown>;
          const street = pickAddressField(addressAny, ["street", "line1", "addressLine1", "address1"]);
          const street2 = pickAddressField(addressAny, ["line2", "addressLine2", "address2"]);
          const zip = pickAddressField(addressAny, ["zip", "postalCode", "postcode", "zipCode"]);
          const city = pickAddressField(addressAny, ["city", "town"]);
          const state = pickAddressField(addressAny, ["state", "province"]);
          const country = pickAddressField(addressAny, ["country"]) || fallbackCountry;
          const addition = pickAddressField(addressAny, ["addressAddition", "addition"]) || fallbackAddition;
          const zipCity = [zip, city].filter(Boolean).join(" ").trim();
          return [addition, street, street2, zipCity, state, country].filter(Boolean);
        }

        return [];
      };

      const billingAddressLines = (() => {
        const customerProfile = typeof rawInvoice.customerId === "object" ? rawInvoice.customerId : undefined;
        const profileAddress = toAddressLines(
          customerProfile?.invoiceAddress,
          cleanText(customerProfile?.country, ""),
          cleanText(customerProfile?.addressAddition, ""),
        );
        if (profileAddress.length) return profileAddress;

        const paymentProfileAddress = toAddressLines(
          customerProfile?.paymentAddress,
          cleanText(customerProfile?.country, ""),
          cleanText(customerProfile?.addressAddition, ""),
        );
        if (paymentProfileAddress.length) return paymentProfileAddress;

        const invoiceAddress = toAddressLines(sourceInvoice.billingAddress);
        if (invoiceAddress.length) return invoiceAddress;

        if (typeof sourceInvoice.billingAddress === "string") {
          return sourceInvoice.billingAddress
            .split(/\n|,/)
            .map((line) => line.trim())
            .filter(Boolean);
        }

        if (sourceInvoice.billingAddress && typeof sourceInvoice.billingAddress === "object") {
          const addressAny = sourceInvoice.billingAddress as Record<string, unknown>;
          const street = pickAddressField(addressAny, ["street", "line1", "addressLine1", "address1"]);
          const street2 = pickAddressField(addressAny, ["line2", "addressLine2", "address2"]);
          const zip = pickAddressField(addressAny, ["zip", "postalCode", "postcode", "zipCode"]);
          const city = pickAddressField(addressAny, ["city", "town"]);
          const state = pickAddressField(addressAny, ["state", "province"]);
          const country = pickAddressField(addressAny, ["country"]);
          const zipCity = [zip, city].filter(Boolean).join(" ").trim();
          return [street, street2, zipCity, state, country].filter(Boolean);
        }

        return [];
      })();

      const customerIdentityLines = [
        cleanText(sourceInvoice.customerName),
        cleanText(sourceInvoice.contactPerson, ""),
      ].filter(Boolean);
      const invoiceAddressLines = billingAddressLines.length ? billingAddressLines : ["Rechnungsadresse nicht hinterlegt"];
      const customerLines = [...customerIdentityLines, ...invoiceAddressLines];

      const orderNumber = cleanText(sourceInvoice.orderId?.orderNumber);
      const invoiceNumber = cleanText(sourceInvoice.invoiceNumber);
      const customerIdRaw = typeof rawInvoice.customerId === "string"
        ? rawInvoice.customerId
        : rawInvoice.customerId?._id;
      const customerNumber = cleanText(
        rawInvoice.customerNumber ||
        (typeof rawInvoice.customerId === "object" ? rawInvoice.customerId?.customerNumber : "") ||
        (customerIdRaw ? `KD${String(customerIdRaw).slice(-6).toUpperCase()}` : ""),
      );

      const invoiceDate = formatDate(sourceInvoice.createdAt);
      const dueDate = formatDate(sourceInvoice.dueDate);
      const paymentMethod = cleanText(sourceInvoice.paymentMethod || "-");

      const amountPaid = normalizeAmount(sourceInvoice.amountPaid ?? sourceInvoice.paidAmount ?? 0);
      const subtotal = normalizeAmount(sourceInvoice.subtotal);
      const total = normalizeAmount(sourceInvoice.total);
      const taxAmount = normalizeAmount(sourceInvoice.tax);
      const discountAmount = normalizeAmount(sourceInvoice.discount);
      const openAmount = total - amountPaid;
      const defaultTaxRate = sourceInvoice.items.find((item) => typeof item.taxRate === "number")?.taxRate ?? (taxAmount > 0 ? 19 : 0);

      const latestPayment = sourceInvoice.paymentHistory && sourceInvoice.paymentHistory.length > 0 ? sourceInvoice.paymentHistory[0] : undefined;
      const paymentDate = formatDate(latestPayment?.date || sourceInvoice.createdAt);

      const paymentHistoryRows = (() => {
        const normalized = (sourceInvoice.paymentHistory || [])
          .map((entry) => ({
            date: entry?.date,
            amount: normalizeAmount(entry?.amount),
            method: cleanText(entry?.method || paymentMethod, "-"),
            note: cleanText(entry?.note || "", ""),
          }))
          .filter((entry) => Number.isFinite(entry.amount) && entry.amount > 0)
          .sort((a, b) => {
            const tsA = a.date ? new Date(a.date).getTime() : 0;
            const tsB = b.date ? new Date(b.date).getTime() : 0;
            return tsB - tsA;
          });

        if (normalized.length > 0) {
          return normalized;
        }

        if (amountPaid > 0) {
          return [{
            date: sourceInvoice.paidAt || sourceInvoice.createdAt,
            amount: amountPaid,
            method: cleanText(paymentMethod, "-"),
            note: "Gesamtzahlung",
          }];
        }

        return [] as Array<{ date?: string; amount: number; method: string; note: string }>;
      })();

      const baseline = 4;

      const logoAsset = await loadImageData(logoUrl);
      const qrDataUrl = await createQrDataUrl(reviewUrl);
      const qrAsset = qrDataUrl ? await loadImageData(qrDataUrl) : null;
      let logoLeftBoundary = right;

      if (logoAsset) {
        const maxLogoWidth = 38;
        const maxLogoHeight = 14;
        const logoRatio = logoAsset.width / Math.max(logoAsset.height, 1);
        let logoWidth = maxLogoWidth;
        let logoHeight = logoWidth / logoRatio;

        if (logoHeight > maxLogoHeight) {
          logoHeight = maxLogoHeight;
          logoWidth = logoHeight * logoRatio;
        }

        const logoX = right - logoWidth;
        const logoY = 9.5;
        logoLeftBoundary = logoX;
        pdf.addImage(logoAsset.dataUrl, "PNG", logoX, logoY, logoWidth, logoHeight, undefined, "FAST");
      } else {
        pdf.setDrawColor(28, 43, 92);
        pdf.setLineWidth(0.35);
        pdf.rect(right - 43, 9, 31, 13.5);
        logoLeftBoundary = right - 43;
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(28, 43, 92);
        pdf.setFontSize(8.8);
        pdf.text("McRepair.de", right - 27.5, 16, { align: "center" });
      }

      // Top sender line
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text("Online Point GmbH, Kurfuerstenstrasse 106, 10787 Berlin", left, 14);
      drawLine(left, 16, Math.max(left + 30, logoLeftBoundary - 2), 16);

      // Recipient block
      const recipientTop = 19;
      const recipientWidth = 76;
      const recipientTextWidth = recipientWidth - 5.2;
      const recipientLines = (customerLines.length ? customerLines : ["-"])
        .flatMap((line) => pdf.splitTextToSize(String(line), recipientTextWidth));
      const recipientHeight = Math.max(19, recipientLines.length * 4 + 10.5);
      drawRect(left, recipientTop, recipientWidth, recipientHeight);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.8);
      pdf.text("Rechnungsadresse", left + 2.4, recipientTop + 5.2);
      drawLine(left + 2, recipientTop + 6.8, left + recipientWidth - 2, recipientTop + 6.8);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.1);
      pdf.text(recipientLines, left + 2.4, recipientTop + 10.8);

      // Headline
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text("Rechnung", pageWidth / 2, 56, { align: "center" });

      // Meta row
      drawLine(left, 61.5, right, 61.5, true);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text("Seite: 1", left, 65);
      pdf.text(invoiceDate, right, 65, { align: "right" });
      pdf.text(`Rechnungsnr. ${invoiceNumber} bzgl. Bestellnummer: ${orderNumber}`, left, 71);
      pdf.text(`Kundennummer: ${customerNumber}`, left, 77);
      if (!strictTemplateMode) {
        pdf.text(`Faelligkeitsdatum: ${dueDate}`, right, 77, { align: "right" });
      }
      drawLine(left, 79.8, right, 79.8);

      // Items table (professionelles, nutzerfreundliches Grid)
      const tableLeft = left;
      const tableRight = right;
      const tableTop = 84.5;
      const tableHeaderHeight = 9;
      const colWidths = {
        pos: 10,
        qty: 20,
        article: 24,
        desc: 56,
        tax: 12,
        unit: 26,
      };
      const xPos = tableLeft;
      const xQty = xPos + colWidths.pos;
      const xArticle = xQty + colWidths.qty;
      const xDesc = xArticle + colWidths.article;
      const xTax = xDesc + colWidths.desc;
      const xUnit = xTax + colWidths.tax;
      const xTotal = tableRight;

      pdf.setFillColor(245, 248, 252);
      pdf.rect(tableLeft, tableTop, tableRight - tableLeft, tableHeaderHeight, "F");
      drawLine(tableLeft, tableTop, tableRight, tableTop, true);
      drawLine(tableLeft, tableTop + tableHeaderHeight, tableRight, tableTop + tableHeaderHeight, true);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.8);
      const headerTextY = tableTop + 5.8;
      pdf.text("Pos.", xPos + 1.6, headerTextY);
      pdf.text("Menge", xQty + 1.6, headerTextY);
      pdf.text("Art.-Nr.", xArticle + 1.6, headerTextY);
      pdf.text("Leistung / Beschreibung", xDesc + 1.6, headerTextY);
      pdf.text("USt.", xTax + 1.6, headerTextY);
      pdf.text("Einzel", xUnit + colWidths.unit - 1.8, headerTextY, { align: "right" });
      pdf.text("Gesamt", xTotal - 1.8, headerTextY, { align: "right" });

      let tableCursorY = tableTop + tableHeaderHeight;

      if (!invoice.items.length) {
        const emptyRowHeight = 10;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.8);
        pdf.text("Keine Positionen vorhanden", xDesc + 1.6, tableCursorY + 6);
        tableCursorY += emptyRowHeight;
        drawLine(tableLeft, tableCursorY, tableRight, tableCursorY);
      } else {
        invoice.items.forEach((item, index) => {
          const itemAny = item as Invoice["items"][number] & { articleNumber?: string; sku?: string };
          const descLines = pdf.splitTextToSize(cleanText(item.description), colWidths.desc - 3.4);
          const descLineCount = Math.max(descLines.length, 1);
          const rowHeight = Math.max(9.5, descLineCount * 3.9 + 3.8);
          const rowBottom = tableCursorY + rowHeight;

          if (index % 2 === 1) {
            pdf.setFillColor(252, 253, 255);
            pdf.rect(tableLeft, tableCursorY, tableRight - tableLeft, rowHeight, "F");
          }

          const taxRate = item.taxRate != null ? item.taxRate : defaultTaxRate;
          const rowTextY = tableCursorY + 5.5;

          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8.7);
          pdf.text(String(index + 1), xPos + 1.6, rowTextY);
          pdf.text(`${cleanText(item.quantity, 1)} Stk`, xQty + 1.6, rowTextY);
          pdf.text(cleanText(itemAny.articleNumber || itemAny.sku, "-"), xArticle + 1.6, rowTextY);
          pdf.text(descLines, xDesc + 1.6, rowTextY);
          pdf.text(`${Number(taxRate || 0).toLocaleString("de-DE", { maximumFractionDigits: 2 })}%`, xTax + 1.6, rowTextY);
          pdf.text(formatMoney(item.unitPrice), xUnit + colWidths.unit - 1.8, rowTextY, { align: "right" });
          pdf.text(formatMoney(item.total), xTotal - 1.8, rowTextY, { align: "right" });

          drawLine(tableLeft, rowBottom, tableRight, rowBottom);
          tableCursorY = rowBottom;
        });
      }

      drawRect(tableLeft, tableTop, tableRight - tableLeft, tableCursorY - tableTop, true);
      [xQty, xArticle, xDesc, xTax, xUnit].forEach((xLine) => {
        drawLine(xLine, tableTop, xLine, tableCursorY);
      });

      // Informations- und Summenbereich als 2-Spalten-Layout
      const footerY = pageHeight - 22;
      const footerTop = footerY - 4;
      const groupedTaxLabel = taxAmount > 0
        ? `(${Number(defaultTaxRate).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
        : "(0,00%)";

      let y = tableCursorY + 5.5;
      const summaryWidth = 72;
      const summaryX = right - summaryWidth;
      const infoX = left;
      const infoWidth = summaryX - infoX - 4;

      const detailLines = [
        `Leistungsdatum: ${invoiceDate}`,
        `Zahlungsart: ${paymentMethod}`,
        `Faelligkeitsdatum: ${dueDate}`,
        `E-Mail: ${cleanText(sourceInvoice.customerEmail, "-")}`,
      ];

      const notes = cleanText(sourceInvoice.notes, "");
      const rawNoteLines = notes ? pdf.splitTextToSize(notes, infoWidth - 8) : [];

      let noteLines = rawNoteLines.slice(0, 7);
      const rowHeight = 5.9;
      const totalsRows = [
        { label: "Gesamt Netto", value: formatMoney(subtotal), emphasize: false },
        { label: `zzgl. ${formatTax(defaultTaxRate)} MwSt. ${groupedTaxLabel}`, value: formatMoney(taxAmount), emphasize: false },
      ];
      if (discountAmount > 0) {
        totalsRows.push({ label: "Betrag vor Rabatt", value: formatMoney(subtotal + taxAmount), emphasize: false });
        totalsRows.push({ label: "Rabatt", value: `- ${formatMoney(discountAmount)}`, emphasize: false });
      }
      totalsRows.push({ label: "Gesamtbetrag", value: formatMoney(total), emphasize: true });
      if (amountPaid > 0) {
        totalsRows.push({ label: `Zahlung (${paymentMethod})`, value: formatMoney(amountPaid), emphasize: false });
      }
      totalsRows.push({ label: "Offener Betrag", value: formatSignedMoney(openAmount), emphasize: true });

      const computeInfoHeight = () => 10 + detailLines.length * 4.9 + (noteLines.length ? 6 + noteLines.length * 4 : 0);
      const computeSummaryHeight = () => 10 + totalsRows.length * rowHeight;

      const maxBlockHeight = footerTop - y - 8;
      while (computeInfoHeight() > maxBlockHeight && noteLines.length > 0) {
        noteLines = noteLines.slice(0, noteLines.length - 1);
      }
      if (rawNoteLines.length > noteLines.length && noteLines.length > 0) {
        const lastLine = String(noteLines[noteLines.length - 1]);
        noteLines[noteLines.length - 1] = `${lastLine} ...`;
      }

      const infoHeight = computeInfoHeight();
      const summaryHeight = computeSummaryHeight();
      const cardHeight = Math.max(infoHeight, summaryHeight, 24);

      const qrSize = 17;
      const feedbackTextLines = [
        "Wenn Sie mit der Reparatur zufrieden",
        "waren, bewerten Sie uns gern.",
        "Wir freuen uns auf Ihr Feedback!",
      ];
      const feedbackTextBlockHeight = 11.5;
      const feedbackBoxHeight = qrSize + feedbackTextBlockHeight + 11;
      const feedbackGap = 4;
      const paymentSectionGap = 4;
      const paymentHistoryVisibleRows = paymentHistoryRows.slice(0, 6);
      const paymentHistoryHasMore = paymentHistoryRows.length > paymentHistoryVisibleRows.length;
      const paymentHistoryHeaderHeight = 12.2;
      const paymentHistoryRowHeight = 6.1;
      const paymentHistoryEmptyHeight = 8.6;
      const paymentHistoryMoreHintHeight = paymentHistoryHasMore ? 4.2 : 0;
      const paymentHistoryBodyHeight = paymentHistoryVisibleRows.length > 0
        ? paymentHistoryVisibleRows.length * paymentHistoryRowHeight
        : paymentHistoryEmptyHeight;
      const paymentHistoryHeight = paymentHistoryHeaderHeight + paymentHistoryBodyHeight + paymentHistoryMoreHintHeight;
      const requiredBottomSectionHeight = cardHeight + paymentSectionGap + paymentHistoryHeight + feedbackGap + feedbackBoxHeight;

      if (y + requiredBottomSectionHeight > footerTop - 2) {
        pdf.addPage();

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13.5);
        pdf.text("Rechnung - Fortsetzung", left, 18);
        drawLine(left, 21, right, 21, true);

        if (logoAsset) {
          const maxLogoWidth = 34;
          const maxLogoHeight = 12;
          const logoRatio = logoAsset.width / Math.max(logoAsset.height, 1);
          let logoWidth = maxLogoWidth;
          let logoHeight = logoWidth / logoRatio;
          if (logoHeight > maxLogoHeight) {
            logoHeight = maxLogoHeight;
            logoWidth = logoHeight * logoRatio;
          }
          const logoX = right - logoWidth;
          pdf.addImage(logoAsset.dataUrl, "PNG", logoX, 9, logoWidth, logoHeight, undefined, "FAST");
        }

        y = 26;
      }

      pdf.setFillColor(250, 252, 254);
      pdf.rect(infoX, y, infoWidth, cardHeight, "F");
      drawRect(infoX, y, infoWidth, cardHeight);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text("Rechnungsdetails", infoX + 2.4, y + 5.2);
      drawLine(infoX + 1.8, y + 6.8, infoX + infoWidth - 1.8, y + 6.8);

      let infoCursor = y + 11;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.7);
      detailLines.forEach((line) => {
        pdf.text(line, infoX + 2.4, infoCursor);
        infoCursor += 4.9;
      });

      if (noteLines.length) {
        infoCursor += 1;
        pdf.setFont("helvetica", "bold");
        pdf.text("Hinweise", infoX + 2.4, infoCursor + 1.8);
        infoCursor += 4.4;
        pdf.setFont("helvetica", "normal");
        pdf.text(noteLines, infoX + 2.4, infoCursor + 1.2);
      }

      pdf.setFillColor(248, 250, 253);
      pdf.rect(summaryX, y, summaryWidth, cardHeight, "F");
      drawRect(summaryX, y, summaryWidth, cardHeight, true);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text("Zahlungsuebersicht", summaryX + 2.5, y + 5.2);
      drawLine(summaryX + 2, y + 6.8, summaryX + summaryWidth - 2, y + 6.8);

      let summaryCursor = y + 11;
      totalsRows.forEach((row, index) => {
        if (row.emphasize) {
          pdf.setFillColor(238, 244, 252);
          pdf.rect(summaryX + 1.2, summaryCursor - 3.8, summaryWidth - 2.4, rowHeight, "F");
        }

        pdf.setFont("helvetica", row.emphasize ? "bold" : "normal");
        pdf.setFontSize(row.emphasize ? 9.2 : 8.7);
        pdf.text(row.label, summaryX + 2.4, summaryCursor);
        pdf.text(row.value, summaryX + summaryWidth - 2.2, summaryCursor, { align: "right" });

        if (index < totalsRows.length - 1) {
          drawLine(summaryX + 2, summaryCursor + 2.1, summaryX + summaryWidth - 2, summaryCursor + 2.1);
        }
        summaryCursor += rowHeight;
      });

      // Payment history section (professionell strukturiert als kompaktes Journal)
      const paymentHistoryY = y + cardHeight + paymentSectionGap;
      const paymentHistoryX = left;
      const paymentHistoryWidth = right - left;
      const paymentDateColWidth = 25;
      const paymentAmountColWidth = 30;
      const paymentDetailColWidth = paymentHistoryWidth - paymentDateColWidth - paymentAmountColWidth - 5.6;
      const paymentDetailMaxChars = 60;

      pdf.setFillColor(250, 252, 254);
      pdf.rect(paymentHistoryX, paymentHistoryY, paymentHistoryWidth, paymentHistoryHeight, "F");
      drawRect(paymentHistoryX, paymentHistoryY, paymentHistoryWidth, paymentHistoryHeight);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(26, 42, 94);
      pdf.text("Zahlungsverlauf", paymentHistoryX + 2.4, paymentHistoryY + 5.2);
      drawLine(paymentHistoryX + 2, paymentHistoryY + 6.8, paymentHistoryX + paymentHistoryWidth - 2, paymentHistoryY + 6.8);

      const paymentHeaderY = paymentHistoryY + 10.2;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.2);
      pdf.setTextColor(76, 91, 121);
      pdf.text("Datum", paymentHistoryX + 2.4, paymentHeaderY);
      pdf.text("Methode / Notiz", paymentHistoryX + paymentDateColWidth + 2.2, paymentHeaderY);
      pdf.text("Betrag", paymentHistoryX + paymentHistoryWidth - 2.4, paymentHeaderY, { align: "right" });
      drawLine(paymentHistoryX + 2, paymentHeaderY + 1.6, paymentHistoryX + paymentHistoryWidth - 2, paymentHeaderY + 1.6);

      let paymentRowY = paymentHeaderY + 4.5;
      if (paymentHistoryVisibleRows.length > 0) {
        paymentHistoryVisibleRows.forEach((row, index) => {
          if (index % 2 === 1) {
            pdf.setFillColor(253, 253, 255);
            pdf.rect(paymentHistoryX + 1.2, paymentRowY - 3.9, paymentHistoryWidth - 2.4, paymentHistoryRowHeight, "F");
          }

          const methodAndNoteRaw = row.note ? `${row.method} • ${row.note}` : row.method;
          const methodAndNote = methodAndNoteRaw.length > paymentDetailMaxChars
            ? `${methodAndNoteRaw.slice(0, paymentDetailMaxChars - 1)}...`
            : methodAndNoteRaw;

          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8.4);
          pdf.setTextColor(30, 41, 59);
          pdf.text(formatDate(row.date), paymentHistoryX + 2.4, paymentRowY);
          pdf.text(methodAndNote, paymentHistoryX + paymentDateColWidth + 2.2, paymentRowY, { maxWidth: paymentDetailColWidth });
          pdf.setFont("helvetica", "bold");
          pdf.text(formatMoney(row.amount), paymentHistoryX + paymentHistoryWidth - 2.4, paymentRowY, { align: "right" });

          drawLine(paymentHistoryX + 2, paymentRowY + 2.1, paymentHistoryX + paymentHistoryWidth - 2, paymentRowY + 2.1);
          paymentRowY += paymentHistoryRowHeight;
        });
      } else {
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(8.4);
        pdf.setTextColor(107, 114, 128);
        pdf.text("Noch keine Zahlungen erfasst", paymentHistoryX + 2.4, paymentRowY);
      }

      if (paymentHistoryHasMore) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(95, 109, 134);
        pdf.text(`Weitere Zahlungen: ${paymentHistoryRows.length - paymentHistoryVisibleRows.length}`, paymentHistoryX + 2.4, paymentHistoryY + paymentHistoryHeight - 1.9);
      }

      pdf.setTextColor(0, 0, 0);

      // Feedback callout + QR (collision-safe placement oberhalb Footer)
      const postCardY = paymentHistoryY + paymentHistoryHeight;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.8);
      const feedbackX = right - 46;
      const feedbackWidth = 48;
      const feedbackTopPreferred = postCardY + 4;
      const feedbackTopMax = footerTop - feedbackBoxHeight - 5;
      const feedbackTop = Math.min(feedbackTopPreferred, feedbackTopMax);
      if (feedbackTop >= postCardY + 1.5) {
        pdf.setFillColor(248, 251, 255);
        pdf.rect(feedbackX - 2, feedbackTop, feedbackWidth, feedbackBoxHeight, "F");
        drawRect(feedbackX - 2, feedbackTop, feedbackWidth, feedbackBoxHeight);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(26, 42, 94);
        pdf.text("Bewertung", feedbackX + (feedbackWidth - 4) / 2, feedbackTop + 4.8, { align: "center" });
        drawLine(feedbackX + 2, feedbackTop + 6.2, feedbackX + feedbackWidth - 4, feedbackTop + 6.2);

        const qrX = feedbackX + (feedbackWidth - 4 - qrSize) / 2;
        const qrY = feedbackTop + 7.4;
        if (qrAsset) {
          pdf.addImage(qrAsset.dataUrl, "PNG", qrX, qrY, qrSize, qrSize, undefined, "FAST");
        } else {
          drawRect(qrX, qrY, qrSize, qrSize);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(7.4);
          pdf.text("QR", qrX + qrSize / 2, qrY + qrSize / 2 + 0.8, { align: "center" });
        }

        const feedbackTextY = qrY + qrSize + 4.3;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.6);
        pdf.setTextColor(30, 41, 59);
        pdf.text(feedbackTextLines[0], feedbackX + feedbackWidth / 2 - 2, feedbackTextY, { align: "center" });
        pdf.text(feedbackTextLines[1], feedbackX + feedbackWidth / 2 - 2, feedbackTextY + 3.7, { align: "center" });
        pdf.text(feedbackTextLines[2], feedbackX + feedbackWidth / 2 - 2, feedbackTextY + 7.4, { align: "center" });
        pdf.setTextColor(0, 0, 0);
      }

      drawLine(left, footerY - 4, right, footerY - 4, true);
      drawLine(pageWidth / 2 - 24, footerY - 1, pageWidth / 2 - 24, pageHeight - 8);
      drawLine(right - 64, footerY - 1, right - 64, pageHeight - 8);
      pdf.setFontSize(8.2);
      pdf.text(["Online Point GmbH", "Kurfuerstenstrasse 106", "10787 Berlin", "Tel.: 030 403 688 951"], left, footerY);
      pdf.text(["Commerzbank AG", "IBAN: DE95100400000501905400", "BIC: COBADEFFXXX"], pageWidth / 2 - 18, footerY);
      pdf.text(["Amtsgericht Charlottenburg", "HRB 136735 B", "Geschaeftsfuehrer: Julian Szymansky", "Ust-IdNr.: DE318981969"], right - 58, footerY);

      const safeInvoiceNumber = cleanText(sourceInvoice.invoiceNumber).replace(/[^a-zA-Z0-9_-]/g, "_");
      pdf.save(`Rechnung_${safeInvoiceNumber}.pdf`);

      toast({
        title: t("common.success"),
        description: t("invoices.downloadStarted"),
      });
    } catch (error: any) {
      console.error("CustomerInvoices: Error generating invoice PDF", error);
      toast({
        title: t("common.error"),
        description: error?.message || "Die Rechnung konnte nicht als PDF erstellt werden.",
        variant: "destructive",
      });
    }
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
      <SEO
        title="Meine Rechnungen – McRepair.de Kundenportal"
        description="Rechnungen für Reparaturen und Einkäufe einsehen und herunterladen. Transparente Abrechnung in Ihrem McRepair.de Kundenportal."
        canonical="/invoices"
        noindex={true}
      />
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
                    data-invoice-id={invoice._id}
                    onClick={() => handleViewInvoice(invoice)}
                    className={`group bg-white border rounded-xl p-4 sm:p-5 flex items-center gap-4 cursor-pointer transition-all hover:border-[#f5b800] hover:shadow-md ${
                      highlightedInvoiceId === invoice._id
                        ? 'border-[#f5b800] shadow-md ring-2 ring-[#f5b800] ring-opacity-60'
                        : 'border-slate-200'
                    }`}
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
                    <DialogTitle className="text-[#f5b800] font-bold text-sm leading-tight">
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
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">{selectedInvoice.paymentMethod || '-'}</p>
                    </div>
                    <div className="col-span-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rechnungsadresse</p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">
                        {(() => {
                          const addressLines = resolveInvoiceBillingAddressLines(selectedInvoice);
                          return addressLines.length ? addressLines.join(', ') : 'Rechnungsadresse nicht hinterlegt';
                        })()}
                      </p>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="rounded-xl border-2 border-[#f5b800]/25 overflow-hidden shadow-sm">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e] px-4 py-2.5 flex items-center gap-2.5">
                      <div className="h-6 w-6 rounded-full bg-[#f5b800] flex items-center justify-center flex-shrink-0">
                        <FileText className="h-3 w-3 text-[#1a2a5e]" />
                      </div>
                      <h3 className="font-extrabold text-sm text-[#f5b800] uppercase tracking-wide">Positionen</h3>
                      <span className="ml-auto text-[10px] text-blue-200/60 font-medium">{selectedInvoice.items.length} {selectedInvoice.items.length === 1 ? 'Position' : 'Positionen'}</span>
                    </div>

                    {/* Column headers */}
                    <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-0 bg-slate-100 border-b border-slate-200 px-4 py-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Leistung</span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-12">Menge</span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-20">Einzelpr.</span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-16">Rabatt</span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-12">MwSt.</span>
                      <span className="text-[10px] font-bold text-[#1a2a5e] uppercase tracking-wider text-right w-20">Gesamt</span>
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-slate-100 bg-white">
                      {selectedInvoice.items.map((item, idx) => (
                        <div key={item._id} className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-0 px-4 py-2.5 items-center ${idx % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                          <div className="min-w-0 pr-3">
                            <p className="text-sm font-semibold text-slate-800 leading-tight truncate">{item.description}</p>
                            {item.type && (
                              <span className="inline-block mt-0.5 text-[9px] font-bold text-[#1a2a5e] bg-[#f5b800]/20 border border-[#f5b800]/40 px-1.5 py-0.5 rounded-full leading-tight uppercase tracking-wide">
                                {item.type}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-600 font-medium text-right w-12">{item.quantity}</span>
                          <span className="text-xs text-slate-600 font-medium text-right w-20">{formatEUR(item.unitPrice)}</span>
                          <span className="text-xs font-medium text-right w-16">
                            {item.discount != null && item.discount > 0
                              ? <span className="text-emerald-600 font-semibold">-{formatEUR(item.discount)}</span>
                              : <span className="text-slate-300">—</span>}
                          </span>
                          <span className="text-xs text-slate-500 font-medium text-right w-12">
                            {item.taxRate != null ? `${item.taxRate}%` : <span className="text-slate-300">—</span>}
                          </span>
                          <span className="text-sm font-extrabold text-[#1a2a5e] text-right w-20">{formatEUR(item.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Financial Summary + Payment History */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Totals */}
                    <div className="border border-slate-200 rounded-lg p-3 space-y-1">
                      {(() => {
                        const subtotalValue = Number(selectedInvoice.subtotal || 0);
                        const taxValue = Number(selectedInvoice.tax || 0);
                        const discountValue = Number(selectedInvoice.discount || 0);
                        const normalAmount = subtotalValue + taxValue;
                        const discountedAmount = Math.max(0, Number(selectedInvoice.total || 0));
                        return (
                          <>
                            <div className="flex justify-between text-xs rounded bg-slate-50 px-2 py-1.5 border border-slate-200">
                              <span className="text-slate-500">Normaler Betrag</span>
                              <span className="font-semibold text-slate-700">{formatEUR(normalAmount)}</span>
                            </div>
                            {discountValue > 0 && (
                              <div className="flex justify-between text-xs rounded bg-emerald-50 px-2 py-1.5 border border-emerald-200">
                                <span className="text-emerald-700">Rabattierter Zahlbetrag</span>
                                <span className="font-bold text-emerald-700">{formatEUR(discountedAmount)}</span>
                              </div>
                            )}
                          </>
                        );
                      })()}
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
                    <div className="rounded-xl border-2 border-[#f5b800]/30 overflow-hidden shadow-sm">
                      {/* Section Header */}
                      <div className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e] px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-[#f5b800] flex items-center justify-center flex-shrink-0 shadow">
                            <DollarSign className="h-4 w-4 text-[#1a2a5e]" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-sm text-[#f5b800] uppercase tracking-wide leading-tight">Rechnung bezahlen</h3>
                            <p className="text-[10px] text-blue-200/70 leading-tight">Wählen Sie Ihre Zahlungsmethode</p>
                          </div>
                        </div>
                        <div className="text-right bg-white/10 rounded-lg px-3 py-1.5">
                          <p className="text-[9px] text-blue-200/60 uppercase tracking-wider">Offener Betrag</p>
                          <p className="text-lg font-extrabold text-[#f5b800] leading-tight">{formatEUR(outstandingAmount)}</p>
                        </div>
                      </div>

                      <div className="p-4 space-y-3 bg-white">
                        {/* Row 1: Payment Method + Amount */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-600">Zahlungsmethode</label>
                            <Select value={selectedGatewayId} onValueChange={setSelectedGatewayId}>
                              <SelectTrigger className="h-9 text-sm bg-white border-slate-200">
                                <SelectValue placeholder={loadingPaymentGateways ? 'Lade…' : 'Methode wählen'} />
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
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-600">
                              Betrag <span className="text-[10px] font-normal text-slate-400">({selectedGateway?.currency || 'EUR'})</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">€</span>
                              <Input
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value.replace(',', '.'))}
                                className="h-9 text-sm bg-white border-slate-200 pl-7 font-semibold"
                                placeholder="0.00"
                                inputMode="decimal"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Row 2: Payer Info */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-600">Ihr Name</label>
                            <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} className="h-9 text-sm bg-white border-slate-200" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-600">Ihre E-Mail</label>
                            <Input type="email" value={payerEmail} onChange={(e) => setPayerEmail(e.target.value)} className="h-9 text-sm bg-white border-slate-200" />
                          </div>
                        </div>

                        {/* Stripe */}
                        {selectedGateway?.provider === 'stripe' && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                            <p className="text-xs font-semibold text-[#635bff]">Stripe – Rechnungsadresse</p>
                            <p className="text-[10px] text-slate-400">Sie werden nach dem Klick auf „Jetzt bezahlen" zur sicheren Stripe-Seite weitergeleitet.</p>
                            <div className="grid grid-cols-2 gap-2">
                              <Input value={billingStreet} onChange={(e) => setBillingStreet(e.target.value)} className="h-8 text-xs" placeholder="Straße" />
                              <Input value={billingCity} onChange={(e) => setBillingCity(e.target.value)} className="h-8 text-xs" placeholder="Stadt" />
                              <Input value={billingZipCode} onChange={(e) => setBillingZipCode(e.target.value)} className="h-8 text-xs" placeholder="PLZ" />
                              <Input value={billingCountry} onChange={(e) => setBillingCountry(e.target.value)} className="h-8 text-xs" placeholder="Land" />
                            </div>
                          </div>
                        )}

                        {/* PayPal */}
                        {selectedGateway?.provider === 'paypal' && (
                          <div className="rounded-lg border border-[#f5b800]/40 bg-[#fffdf0] p-3 space-y-2">
                            <p className="text-xs font-semibold text-[#003087]">PayPal</p>
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

                        {/* Bank Transfer */}
                        {selectedGateway?.provider === 'bank_transfer' && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                            <p className="text-xs font-semibold text-emerald-700">Banküberweisung – Ihre Daten</p>
                            <div className="grid grid-cols-2 gap-2">
                              <Input value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} className="h-8 text-xs" placeholder="Kontoinhaber" />
                              <Input value={bankIban} onChange={(e) => setBankIban(e.target.value)} className="h-8 text-xs" placeholder="IBAN" />
                              <Input value={bankBic} onChange={(e) => setBankBic(e.target.value)} className="h-8 text-xs" placeholder="BIC (optional)" />
                              <Input value={bankTransferReference} onChange={(e) => setBankTransferReference(e.target.value)} className="h-8 text-xs" placeholder="Verwendungszweck" />
                            </div>
                            <div className="rounded-md bg-white border border-slate-200 p-2.5 text-xs text-slate-600 space-y-0.5">
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Empfänger-Bankdaten</p>
                              <p><span className="text-slate-400">Empfänger:</span> {selectedGateway.configuration.account_holder || '–'}</p>
                              <p><span className="text-slate-400">IBAN:</span> {selectedGateway.configuration.iban || '–'}</p>
                              <p><span className="text-slate-400">BIC:</span> {selectedGateway.configuration.bic || '–'}</p>
                              <p><span className="text-slate-400">Bank:</span> {selectedGateway.configuration.bank_name || '–'}</p>
                            </div>
                          </div>
                        )}

                        {/* Terms */}
                        <label className={`flex items-start gap-2.5 cursor-pointer rounded-md transition-colors ${termsError ? 'bg-red-50 border border-red-300 p-2 -mx-2' : ''}`}>
                          <input
                            id="invoice-terms-checkbox"
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={(e) => { setAcceptedTerms(e.target.checked); if (e.target.checked) setTermsError(false); }}
                            className={`mt-0.5 h-4 w-4 rounded cursor-pointer flex-shrink-0 accent-[#f5b800] ${termsError ? 'border-2 border-red-500' : 'border-slate-300'}`}
                          />
                          <span className={`text-xs leading-relaxed ${termsError ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                            Ich bestätige die Zahlungsbedingungen und die Richtigkeit meiner Angaben.
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="space-y-2">
                    {selectedInvoice.notes && (
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <h3 className="font-bold text-[10px] text-[#1a2a5e] uppercase tracking-wider mb-1">Notizen</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">{selectedInvoice.notes}</p>
                      </div>
                    )}
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
