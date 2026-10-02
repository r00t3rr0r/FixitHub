import { useState, useEffect, useRef } from "react";
import { SEO } from '@/components/SEO'
import { formatEUR } from '@/lib/utils';
import { getInvoiceItemServiceName } from '@/lib/invoiceItems';
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
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  confirmInvoicePayment,
  downloadInvoicePdf,
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
import { summarizeInvoicePayment, INVOICE_PAYMENT_TONE_CLASSES, type InvoiceBalanceView } from "@/api/orders";

// Der Server liefert je Rechnung den Zahlungsstand (`balance`, `paymentState`) und in der
// Zahlungshistorie den Status jeder Zahlung ('pending' = nur angekündigt). Ältere Antworten
// haben beides nicht - dann werden keine offenen/bezahlten Beträge erfunden.
type InvoicePaymentHistoryEntry = NonNullable<Invoice["paymentHistory"]>[number] & { status?: string; refundAmount?: number };
type InvoiceWithBalance = Omit<Invoice, "paymentHistory"> & {
  balance?: InvoiceBalanceView | null;
  paymentState?: string;
  paymentHistory?: InvoicePaymentHistoryEntry[];
};

// Deutsche Bezeichnung der Zahlart (nie der rohe Enum-Wert).
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  credit_card: "Kreditkarte",
  card: "Kreditkarte",
  debit_card: "Debitkarte",
  stripe: "Kreditkarte (Stripe)",
  paypal: "PayPal",
  sepa: "SEPA-Lastschrift",
  bank_transfer: "Überweisung",
  invoice: "Rechnung (Überweisung)",
  cash: "Bar",
};

const PAYMENT_HISTORY_STATUS_LABELS: Record<string, string> = {
  pending: "Angekündigt – Eingang noch nicht bestätigt",
  processing: "In Bearbeitung",
  failed: "Fehlgeschlagen",
  refunded: "Erstattet",
  disputed: "Angefochten",
};

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

  // Sprungziel aus der URL - so oeffnet auch ein kopierter Link oder ein harter
  // Reload die richtige Rechnung. location.state bleibt als Fallback fuer die
  // bestehende In-App-Navigation erhalten (bei einem Reload ist es leer).
  // Beide Quellen werden nach der Uebernahme entfernt, damit derselbe Sprung nicht
  // bei jedem Renderdurchlauf erneut ausgeloest wird.
  useEffect(() => {
    const state = location.state as { highlightInvoiceId?: string; openInvoiceId?: string } | null;
    const params = new URLSearchParams(location.search);
    const highlightId = state?.highlightInvoiceId || params.get('highlightInvoiceId') || '';
    if (!highlightId) return;

    const openId = state?.openInvoiceId || params.get('openInvoiceId') || highlightId;
    setPendingHighlightId(highlightId);
    setPendingOpenId(openId);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.search, location.pathname, navigate]);

  useEffect(() => {
    // Der Sprung aus einer Buchung darf nicht still ins Leere laufen, wenn die
    // Rechnung nicht in der geladenen Liste steht (Serverdefault limit=50).
    if (!pendingHighlightId || loading) return;
    const invoiceId = pendingHighlightId;
    const openId = pendingOpenId;

    // Das Zuruecksetzen passiert erst im Timer: Ein setState direkt hier loest sofort
    // einen neuen Effektlauf aus, dessen Cleanup den Timer loescht - der Sprung lief
    // dann nie (weder Hervorhebung noch Rechnungsdialog).
    const timer = setTimeout(() => {
      setPendingHighlightId(null);
      setPendingOpenId(null);
      void (async () => {
        const row = document.querySelector(`[data-invoice-id="${invoiceId}"]`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightedInvoiceId(invoiceId);
          setTimeout(() => setHighlightedInvoiceId(null), 1600);
        }
        if (!openId) return;

        const known = invoices.find((i) => i._id === openId);
        if (known) {
          setTimeout(() => void handleViewInvoice(known), 900);
          return;
        }

        try {
          const response = await getInvoice(openId);
          if (response?.invoice) {
            await handleViewInvoice(response.invoice as Invoice);
            return;
          }
          throw new Error('Rechnung nicht gefunden');
        } catch (error: unknown) {
          toast({
            title: t('common.error'),
            description: error instanceof Error
              ? error.message
              : 'Diese Rechnung konnte nicht geöffnet werden.',
            variant: 'destructive',
          });
        }
      })();
    }, 150);

    return () => clearTimeout(timer);
  }, [pendingHighlightId, pendingOpenId, loading, invoices]);

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
          const confirmedPayment = summarizeInvoicePayment(updatedInvoice as InvoiceWithBalance);
          setPaymentAmount(confirmedPayment.known ? Math.max(0, confirmedPayment.open ?? 0).toFixed(2) : "");
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

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      console.log('CustomerInvoices: Fetching invoices with status filter:', statusFilter);

      const filters: { status?: string } = {};
      if (statusFilter !== "all") {
        filters.status = statusFilter;
      }

      const response = await getCustomerInvoices(filters);
      console.log('CustomerInvoices: Received invoices:', response.invoices?.length);

      setInvoices(response.invoices || []);
    } catch (error: unknown) {
      console.error('CustomerInvoices: Error fetching invoices:', error);
      const msg = error instanceof Error ? error.message : t('invoices.errorFetchingInvoices');
      toast({
        title: t('common.error'),
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchInvoices();
  }, [statusFilter]);

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

      // Vorbelegung mit dem offenen Betrag des SERVERS; ohne Zahlungsstand bleibt das Feld leer.
      const mergedPayment = summarizeInvoicePayment(mergedInvoice as InvoiceWithBalance);
      setPaymentAmount(mergedPayment.known ? Math.max(0, mergedPayment.open ?? 0).toFixed(2) : "");

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
  // Zahlungsstand der geöffneten Rechnung - nur vom Server, nie "Gesamt - bezahlt".
  const selectedInvoicePayment = summarizeInvoicePayment(selectedInvoice as InvoiceWithBalance | null);
  const outstandingAmount: number | null = selectedInvoicePayment.known ? Math.max(0, selectedInvoicePayment.open ?? 0) : null;

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
    if (outstandingAmount !== null && amount > outstandingAmount + 0.01) {
      toast({
        title: t('common.error'),
        description: `Der Betrag übersteigt den offenen Restbetrag (${formatEUR(outstandingAmount ?? 0)}).`,
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

      // Eine Überweisung o. Ä. ist nur eine ANKÜNDIGUNG (HTTP 202, pending: true): Sie zählt
      // erst, wenn der Eingang bestätigt ist. Die Historie kommt vom Server (mit Status) -
      // hier wird keine abgeschlossene Zahlung erfunden.
      const isPendingAnnouncement = response?.pending === true;
      const updatedInvoice = {
        ...selectedInvoice,
        ...response.invoice,
        amountPaid: response.invoice?.paidAmount ?? response.invoice?.amountPaid,
        paymentMethod: provider,
        paymentHistory: Array.isArray(response.invoice?.paymentHistory)
          ? response.invoice.paymentHistory
          : selectedInvoice.paymentHistory,
      } as Invoice;

      setSelectedInvoice(updatedInvoice);
      setInvoices((prev) => prev.map((invoice) => (invoice._id === updatedInvoice._id ? updatedInvoice : invoice)));
      const updatedPayment = summarizeInvoicePayment(updatedInvoice as InvoiceWithBalance);
      setPaymentAmount(updatedPayment.known ? Math.max(0, updatedPayment.open ?? 0).toFixed(2) : "");

      toast({
        title: isPendingAnnouncement ? 'Zahlung vorgemerkt' : t('common.success'),
        description: isPendingAnnouncement
          ? (response?.message || 'Ihre Zahlung wurde vorgemerkt. Die Rechnung gilt als bezahlt, sobald der Zahlungseingang bei uns bestätigt ist.')
          : `Zahlung über ${selectedGateway.name} wurde erfasst.`,
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

  // Download = das ARCHIVIERTE Rechnungsdokument vom Server (GET /api/invoices/:id/pdf):
  // dieselbe, unveraenderliche Fassung, die per E-Mail versendet wurde (Fusszeile,
  // Bewertungs-QR nur mit konfiguriertem Ziel, Stand bei Rechnungsstellung). Frueher
  // wurde hier clientseitig ein eigenes PDF gebaut - mit abweichender Fusszeile und einer
  // fest eingetragenen Bewertungsadresse. Der aktuelle Zahlungsstand steht in der Ansicht.
  const handleDownloadInvoice = async (invoice: Invoice) => {
    try {
      await downloadInvoicePdf(invoice._id, invoice.invoiceNumber);
      toast({
        title: t("common.success"),
        description: t("invoices.downloadStarted"),
      });
    } catch (error: any) {
      console.error("CustomerInvoices: Error downloading invoice PDF", error);
      toast({
        title: t("common.error"),
        description: error?.message || "Die Rechnung konnte nicht als PDF geladen werden.",
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
                        {(() => {
                          // Zahlungsstand (getrennt vom Belegstatus) - nur wenn der Server ihn liefert.
                          const payment = summarizeInvoicePayment(invoice as InvoiceWithBalance);
                          return payment.known ? (
                            <span className={`text-xs px-2 py-0.5 rounded font-semibold ${INVOICE_PAYMENT_TONE_CLASSES[payment.tone]}`}>
                              {payment.label}
                            </span>
                          ) : null;
                        })()}
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
                  <div className="flex items-center gap-1.5 shrink-0">
                    {selectedInvoice.isReverseCharge && (
                      <Badge className="bg-indigo-600 text-white border border-indigo-400 text-xs font-semibold px-2 py-0.5">
                        Reverse Charge
                      </Badge>
                    )}
                    <Badge
                      variant={getStatusBadgeVariant(selectedInvoice.status)}
                      className="text-xs font-semibold px-2 py-0.5 flex items-center gap-1"
                    >
                      {getStatusIcon(selectedInvoice.status)}
                      {getStatusLabel(selectedInvoice.status)}
                    </Badge>
                  </div>
                )}
              </div>
            </DialogHeader>

            {selectedInvoice && (
              <DialogBody>
                <div className="p-4 space-y-3">
                  {selectedInvoice.isReverseCharge && (
                    <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 text-xs text-indigo-900">
                      <p className="font-bold flex items-center gap-1.5 text-indigo-950">
                        <CheckCircle className="h-4 w-4 text-indigo-600" />
                        {selectedInvoice.reverseChargeNotice || 'Steuerschuldnerschaft des Leistungsempfängers / Reverse Charge'}
                      </p>
                      <div className="mt-1 grid grid-cols-2 gap-2 text-indigo-800 text-[11px]">
                        <p><strong>USt-IdNr. Aussteller:</strong> {selectedInvoice.sellerVatId || 'DE318981969'}</p>
                        <p><strong>USt-IdNr. Empfänger:</strong> {selectedInvoice.customerVatId || '-'}</p>
                      </div>
                    </div>
                  )}

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
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">{PAYMENT_METHOD_LABELS[String(selectedInvoice.paymentMethod || '').toLowerCase()] || selectedInvoice.paymentMethod || '-'}</p>
                    </div>
                    {(selectedInvoice.bookingReference || selectedInvoice.orderId?.orderNumber) && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bestellung</p>
                        {selectedInvoice.bookingReference ? (
                          <button
                            type="button"
                            className="text-xs font-semibold text-[#1a2a5e] underline underline-offset-2 mt-0.5 hover:text-[#f5b800]"
                            onClick={() => navigate('/bookings', { state: { reopenBookingDialog: selectedInvoice.bookingReference?._id } })}
                          >
                            {selectedInvoice.bookingReference.bookingNumber || 'Buchung öffnen'}
                          </button>
                        ) : (
                          <p className="text-xs font-semibold text-slate-700 mt-0.5">{selectedInvoice.orderId?.orderNumber}</p>
                        )}
                      </div>
                    )}
                    {selectedInvoice.status === 'cancelled' && selectedInvoice.cancellation?.kind === 'storno' && (
                      <div className="col-span-3 rounded-md border border-slate-300 bg-slate-50 px-3 py-2">
                        <p className="text-xs font-semibold text-slate-700">
                          Diese Rechnung wurde storniert{selectedInvoice.cancellation.creditNoteNumber ? ` (Storno-Gutschrift ${selectedInvoice.cancellation.creditNoteNumber})` : ''}.
                          {' '}Bereits gezahlte Beträge bleiben Ihnen gutgeschrieben und werden verrechnet oder erstattet.
                        </p>
                      </div>
                    )}
                    {(selectedInvoice.relatedCreditNotes || []).length > 0 && (
                      <div className="col-span-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gutschriften zu dieser Rechnung</p>
                        <p className="text-xs font-semibold text-slate-700 mt-0.5">
                          {(selectedInvoice.relatedCreditNotes || []).map((note) => `${note.invoiceNumber} (${formatEUR(Math.abs(Number(note.total || 0)))})`).join(', ')}
                        </p>
                      </div>
                    )}
                    {selectedInvoice.customerVatId && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">USt-IdNr. Kunde</p>
                        <p className="text-xs font-semibold text-slate-700 mt-0.5">{selectedInvoice.customerVatId}</p>
                      </div>
                    )}
                    <div className={selectedInvoice.customerVatId ? "col-span-2" : "col-span-3"}>
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
                            <p className="text-sm font-semibold text-slate-800 leading-tight truncate">{getInvoiceItemServiceName(item)}</p>
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
                      <h3 className="font-bold text-[10px] text-[#1a2a5e] uppercase tracking-wider mb-2">Finanzübersicht</h3>
                      {(() => {
                        // Alle Betraege stammen aus dem gespeicherten Beleg (brutto-first).
                        const netValue = Number(selectedInvoice.invoiceNetTotal ?? selectedInvoice.subtotal ?? 0);
                        const taxValue = Number(selectedInvoice.invoiceTaxTotal ?? selectedInvoice.tax ?? 0);
                        const grossValue = Number(selectedInvoice.invoiceGrossTotal ?? selectedInvoice.total ?? 0);
                        const discountValue = Number(selectedInvoice.discount || 0);
                        const taxRateValue = selectedInvoice.isReverseCharge
                          ? 0
                          : (Number.isFinite(Number(selectedInvoice.taxRate)) ? Number(selectedInvoice.taxRate) : 19);
                        return (
                          <>
                            {discountValue > 0 && (
                              <>
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-500">Betrag vor Rabatt (brutto)</span>
                                  <span className="font-semibold text-slate-700">{formatEUR(grossValue + discountValue)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-emerald-600">
                                  <span>Rabatt (brutto)</span>
                                  <span className="font-semibold">- {formatEUR(discountValue)}</span>
                                </div>
                              </>
                            )}
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">Nettobetrag</span>
                              <span className="font-semibold text-slate-700">{formatEUR(netValue)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">
                                {selectedInvoice.isReverseCharge ? 'MwSt. (0 % – Reverse Charge)' : `enthaltene MwSt. (${taxRateValue} %)`}
                              </span>
                              <span className="font-semibold text-slate-700">{formatEUR(taxValue)}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold border-t border-slate-200 pt-1.5">
                              <span className="text-[#1a2a5e]">Bruttobetrag</span>
                              <span className="text-[#1a2a5e]">{formatEUR(grossValue)}</span>
                            </div>
                          </>
                        );
                      })()}
                      {selectedInvoicePayment.known && (selectedInvoicePayment.received ?? 0) > 0 && (
                        <div className="flex justify-between text-xs text-emerald-600">
                          <span>Bereits eingegangen</span>
                          <span className="font-semibold">- {formatEUR(selectedInvoicePayment.received ?? 0)}</span>
                        </div>
                      )}
                      {selectedInvoicePayment.known && (selectedInvoicePayment.refundPending ?? 0) > 0 && (
                        <div className="flex justify-between text-xs font-bold border-t border-violet-100 pt-1.5 text-violet-700">
                          <span>Überzahlt · Erstattung offen</span>
                          <span>{formatEUR(selectedInvoicePayment.refundPending ?? 0)}</span>
                        </div>
                      )}
                      {selectedInvoicePayment.known && (selectedInvoicePayment.open ?? 0) > 0 && selectedInvoice.status !== 'cancelled' && (
                        <div className="flex justify-between text-xs font-bold border-t border-red-100 pt-1.5 text-red-600">
                          <span>Offener Restbetrag</span>
                          <span>{formatEUR(selectedInvoicePayment.open ?? 0)}</span>
                        </div>
                      )}
                      {!selectedInvoicePayment.known && selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' && (
                        <div className="flex justify-between text-xs border-t border-slate-100 pt-1.5 text-slate-500">
                          <span>Zahlungsstand</span>
                          <span>derzeit nicht verfügbar</span>
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
                          {((selectedInvoice as InvoiceWithBalance).paymentHistory || []).map((payment, idx) => {
                            const statusLabel = payment.status ? PAYMENT_HISTORY_STATUS_LABELS[payment.status] : '';
                            const counts = !payment.status || payment.status === 'completed';
                            return (
                              <div key={idx} className="flex justify-between items-start border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                                <div>
                                  <p className="text-xs font-semibold text-slate-700">{new Date(payment.date).toLocaleDateString('de-DE')}</p>
                                  {payment.method && <p className="text-[10px] text-slate-400">{payment.method}</p>}
                                  {statusLabel && <p className="text-[10px] font-semibold text-amber-700">{statusLabel}</p>}
                                  {payment.note && <p className="text-[10px] text-slate-400 italic">{payment.note}</p>}
                                </div>
                                <span className={`text-xs font-bold ml-2 shrink-0 ${counts ? 'text-emerald-600' : 'text-slate-400'}`}>{formatEUR(payment.amount)}</span>
                              </div>
                            );
                          })}
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
                          <p className="text-lg font-extrabold text-[#f5b800] leading-tight">{outstandingAmount === null ? '–' : formatEUR(outstandingAmount)}</p>
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
                      className="h-8 text-xs px-3 bg-[#1a2a5e] border-[#1a2a5e] text-[#f5b800] hover:bg-[#0f1d45] hover:border-[#0f1d45] hover:text-[#f5b800] font-semibold"
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      {t('common.download')}
                    </Button>
                    {selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' && selectedInvoice.status !== 'credited' && selectedGateway?.provider !== 'paypal' && (
                      <Button
                        size="sm"
                        onClick={handlePayInvoice}
                        disabled={processingPayment || (outstandingAmount !== null && outstandingAmount <= 0)}
                        className="h-8 text-xs px-3 bg-gradient-to-r from-[#f5b800] to-[#e5ab00] hover:from-[#e5ab00] hover:to-[#d9a400] text-white font-bold shadow"
                      >
                        <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                        {processingPayment ? 'Wird verarbeitet...' : t('invoices.payNow')}
                      </Button>
                    )}
                  </div>
                </div>
              </DialogBody>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
