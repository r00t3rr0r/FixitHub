const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireUser } = require('./middleware/auth');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const User = require('../models/User');
const FinancialService = require('../services/financialService');
const PaymentService = require('../services/paymentService');
const InvoicePdfService = require('../services/invoicePdfService');
const NotificationService = require('../services/notificationService');

// Deutsches Betragsformat fuer Meldungen an die Oberflaeche (20,00 € statt 20.00 €).
function formatEuroDe(value) {
  return `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

const getFrontendBaseUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';

const normalizeAllowedPaymentMethods = (methods) => {
  if (!Array.isArray(methods)) return [];
  const normalized = methods
    .map((method) => String(method || '').trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(normalized));
};

const invoiceProviderAliases = {
  stripe: ['stripe', 'credit_card', 'debit_card'],
  paypal: ['paypal'],
  bank_transfer: ['bank_transfer', 'invoice'],
};

const loadAllowedInvoiceMethodsForUser = async (userId) => {
  const userWithGroup = await User.findById(userId)
    .populate('primaryCustomerGroupId', 'financeProfile.allowedPaymentMethods')
    .select('primaryCustomerGroupId')
    .lean();

  return normalizeAllowedPaymentMethods(
    userWithGroup?.primaryCustomerGroupId?.financeProfile?.allowedPaymentMethods
  );
};

const isInvoiceProviderAllowed = ({ provider, allowedMethods }) => {
  if (!Array.isArray(allowedMethods) || allowedMethods.length === 0) return true;
  const aliases = invoiceProviderAliases[String(provider || '').trim().toLowerCase()] || [];
  return aliases.some((alias) => allowedMethods.includes(alias));
};

const getGatewayFromRequest = async (gatewayId, gatewayProvider) => {
  const gateways = await FinancialService.getPaymentGateways();
  const gateway = gateways.find((item) => item._id === gatewayId && item.provider === gatewayProvider);
  if (!gateway || !gateway.isActive) {
    throw new Error('Die gewählte Zahlungsart ist derzeit nicht verfügbar.');
  }
  return gateway;
};

// Deutsche Kundenmeldungen des Rechnungsbereichs. Der Status traegt die Fehlerart,
// der Code bleibt maschinenlesbar (der Client waehlt anhand des Status/Codes).
const INVOICE_NOT_FOUND_MESSAGE = 'Die Rechnung wurde nicht gefunden.';
const INVOICE_FORBIDDEN_MESSAGE = 'Sie haben keine Berechtigung für diese Rechnung.';

const buildAccessError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const isPrivilegedRole = (user) => user?.role === 'admin' || user?.role === 'staff';

// Nicht ausgestellte Belege (Entwurf, Freigabe) sind fuer Kunden unsichtbar - auch ein
// verworfener Entwurf (Status 'cancelled', cancellation.kind 'draft_discarded').
const CUSTOMER_HIDDEN_STATUSES = ['draft', 'pending_approval'];
const isNeverIssued = (invoice) => CUSTOMER_HIDDEN_STATUSES.includes(String(invoice?.status || ''))
  || invoice?.cancellation?.kind === 'draft_discarded';
const NOT_DISCARDED_FILTER = { 'cancellation.kind': { $ne: 'draft_discarded' } };

// KUNDENSICHT eines Belegs: interne Felder verlassen den Server nicht - Revisionsspur
// (Bearbeiternamen, interne Details, rohe SMTP-Fehler), technische Sperren, Mahn-Interna
// (Fehlertexte, naechster interner Termin), Archiv-Metadaten und die Storno-Interna
// (Bearbeiter, Vorstatus, gebuchter Betrag). Erhalten bleibt alles, was der Kunde auf dem
// Beleg bzw. in seiner Ansicht sieht (Positionen, Betraege, Status, Storno-Hinweis mit
// Grund und Gutschriftnummer, erreichte Mahnstufen). Admin/Mitarbeiter: unveraendert.
const CUSTOMER_HIDDEN_INVOICE_FIELDS = [
  'auditTrail', 'dunningLock', 'allocationLock', 'dunningLastFailure',
  'documentArchive', 'documentHistory', 'nextDunningDueDate', 'lockedAt',
  'activeBillingKeys',
];
const toCustomerInvoice = (invoice) => {
  if (!invoice || typeof invoice !== 'object') return invoice;
  const plain = typeof invoice.toObject === 'function' ? invoice.toObject() : { ...invoice };
  CUSTOMER_HIDDEN_INVOICE_FIELDS.forEach((field) => { delete plain[field]; });
  if (Array.isArray(plain.dunningHistory)) {
    // Nur tatsaechlich versendete Schreiben (Altbestand ohne result: emailSentAt gesetzt).
    plain.dunningHistory = plain.dunningHistory
      .filter((entry) => entry && (entry.result === 'sent' || (!entry.result && entry.emailSentAt)))
      .map((entry) => ({ stage: entry.stage, executedAt: entry.executedAt }));
  }
  if (plain.cancellation && typeof plain.cancellation === 'object') {
    const { kind, state, reason, completedAt, creditNoteId, creditNoteNumber } = plain.cancellation;
    plain.cancellation = { kind, state, reason, completedAt, creditNoteId, creditNoteNumber };
  }
  return plain;
};
const forViewer = (user, invoice) => (isPrivilegedRole(user) ? invoice : toCustomerInvoice(invoice));

// Nur fachliche, bereits deutsche Meldungen gehen an den Kunden; technische Fehler
// (Netzwerk, Anbieter-SDK, englische Laufzeittexte) werden durch einen deutschen Satz
// ersetzt und nur geloggt.
const toCustomerMessage = (error, fallback) => {
  const message = String(error?.message || '');
  return /[äöüÄÖÜß]|^(Die|Der|Das|Diese|Dieser|Bitte|Für|Sie|Ihre|Ungültig|Kein)\b/.test(message) ? message : fallback;
};

const PAYMENT_FIELD_LABELS = {
  cardholderName: 'Karteninhaber',
  cardNumber: 'Kartennummer',
  cardExpiry: 'Ablaufdatum',
  cardCvc: 'Prüfnummer',
  'billingAddress.street': 'Straße',
  'billingAddress.city': 'Ort',
  'billingAddress.zipCode': 'PLZ',
  'billingAddress.country': 'Land',
  paypalEmail: 'PayPal-E-Mail',
  accountHolder: 'Kontoinhaber',
  iban: 'IBAN'
};

// Zahlungshistorie einer Rechnung.
// Gelesen wird nach DERSELBEN Regel wie in der Admin-Detailansicht: ueber die
// Rechnung ODER den Auftrag. Altbestandszahlungen (und Gateway-Vorauszahlungen)
// tragen haeufig nur eine orderId - ohne den breiteren Treffer sieht der Kunde
// eine leere Historie, waehrend der Beleg als bezahlt gefuehrt wird.
const loadInvoicePaymentHistory = async (invoiceId, orderId = null) => {
  const matchConditions = [{ invoiceId }];
  const normalizedOrderId = orderId && typeof orderId === 'object' ? (orderId._id || orderId) : orderId;
  if (normalizedOrderId) matchConditions.push({ orderId: normalizedOrderId });

  const payments = await Payment.find({ $or: matchConditions })
    .sort({ processedAt: -1, createdAt: -1 })
    .lean();

  return payments.map((payment) => ({
    _id: String(payment._id),
    date: payment.processedAt || payment.createdAt || new Date(),
    amount: Number(payment.amount || 0),
    // Nur abgeschlossene Zahlungen sind eingegangenes Geld; eine angekuendigte
    // Ueberweisung ('pending') oder eine Erstattung muss erkennbar bleiben.
    status: payment.status,
    refundAmount: Number(payment.refundAmount || 0),
    method: payment.paymentMethod,
    note: payment.gatewayResponse || payment.metadata?.providerReference || payment.transactionId || ''
  }));
};

// Zahlungsstand fuer die Kundenansicht aus DERSELBEN Berechnung wie im Admin
// (PaymentService). `remainingAmount` wird daraus abgeleitet, nicht aus paidAmount.
const withBalance = async (invoice) => {
  if (!invoice) return invoice;
  const balance = await PaymentService.computeInvoiceBalance(invoice);
  return {
    ...invoice,
    balance: balance ? FinancialService.toBalancePayload(balance) : null,
    paymentState: balance?.paymentState || 'open',
  };
};

const assertInvoiceOwner = (invoice, user) => {
  if (!invoice) throw buildAccessError(INVOICE_NOT_FOUND_MESSAGE, 404, 'INVOICE_NOT_FOUND');

  if (isPrivilegedRole(user)) return;

  const invoiceCustomerId = invoice.customerId?._id || invoice.customerId;
  const requesterId = user?._id || user;

  if (!invoiceCustomerId || !requesterId || String(invoiceCustomerId) !== String(requesterId)) {
    throw buildAccessError(INVOICE_FORBIDDEN_MESSAGE, 403, 'INVOICE_FORBIDDEN');
  }
  // Ein Entwurf existiert fuer den Kunden nicht (kein Hinweis auf seine Existenz).
  if (isNeverIssued(invoice)) {
    throw buildAccessError(INVOICE_NOT_FOUND_MESSAGE, 404, 'INVOICE_NOT_FOUND');
  }
};

// Bezug "Bestellung": die Buchung (bzw. der Auftrag) zum Beleg, damit Kunden- und
// Adminansicht direkt dorthin springen koennen.
const loadBookingReference = async (invoice) => {
  const Booking = require('../models/Booking');
  const Order = require('../models/Order');
  let bookingId = invoice?.bookingId?._id || invoice?.bookingId || null;
  if (!bookingId) {
    const orderId = invoice?.orderId?._id || invoice?.orderId || (invoice?.repairOrderIds || [])[0] || null;
    if (orderId) {
      const order = await Order.findById(orderId?._id || orderId).setOptions({ skipAutoPopulate: true }).select('bookingId').lean();
      bookingId = order?.bookingId || null;
    }
  }
  if (!bookingId) return null;
  const booking = await Booking.findById(bookingId).setOptions({ skipAutoPopulate: true }).select('_id bookingNumber customerId').lean();
  if (!booking) return null;
  return { _id: String(booking._id), bookingNumber: booking.bookingNumber || '' };
};

// Offener Betrag aus der gemeinsamen Berechnung (Forderung minus gueltige
// Zuordnungen) - nicht aus dem denormalisierten paidAmount.
const validatePaymentAmount = async (invoice, amount) => {
  const numericAmount = Math.round(Number(amount) * 100) / 100;
  const balance = await PaymentService.computeInvoiceBalance(invoice);
  const remaining = Number(balance?.open || 0);
  if (!numericAmount || numericAmount <= 0) throw new Error('Ungültiger Zahlungsbetrag.');
  if (numericAmount > remaining + 0.01) {
    throw new Error(`Der Betrag übersteigt den offenen Rechnungsbetrag (${formatEuroDe(remaining)}).`);
  }
  return { numericAmount, remaining };
};

const hasAddressContent = (address) => {
  if (!address || typeof address !== 'object') return false;
  const value = (field) => String(address[field] || '').trim();
  return Boolean(
    value('street')
    || value('city')
    || value('zip')
    || value('zipCode')
    || value('postalCode')
    || value('country')
    || value('state')
  );
};

const withProfileBillingAddress = (invoice) => {
  if (!invoice || hasAddressContent(invoice.billingAddress) || !invoice.customerId || typeof invoice.customerId !== 'object') {
    return invoice;
  }

  const customer = invoice.customerId;
  const invoiceAddress = customer.invoiceAddress;
  const paymentAddress = customer.paymentAddress;
  const profileAddress = hasAddressContent(invoiceAddress)
    ? invoiceAddress
    : (hasAddressContent(paymentAddress) ? paymentAddress : null);

  if (!profileAddress) return invoice;

  return {
    ...invoice,
    billingAddress: {
      street: profileAddress.street || '',
      city: profileAddress.city || '',
      state: profileAddress.state || '',
      zip: profileAddress.zip || profileAddress.zipCode || profileAddress.postalCode || '',
      zipCode: profileAddress.zipCode || profileAddress.zip || profileAddress.postalCode || '',
      country: profileAddress.country || customer.country || '',
    },
  };
};

const buildPaypalInvoiceId = (invoice) => {
  const rawBase = String(invoice?.invoiceNumber || invoice?._id || 'invoice')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 90);
  // Ensure uniqueness across retries/partial payments so PayPal does not reject with DUPLICATE_INVOICE_ID.
  return `${rawBase}-${Date.now().toString(36)}`;
};

const getPaypalAccessToken = async (gateway) => {
  const config = gateway.configuration || {};
  const useLive = config.environment === 'live';
  const clientId = useLive ? config.live_client_id : config.sandbox_client_id;
  const clientSecret = useLive ? config.live_client_secret : config.sandbox_client_secret;
  const baseUrl = useLive ? (config.api_base_url_live || 'https://api-m.paypal.com') : (config.api_base_url_sandbox || 'https://api-m.sandbox.paypal.com');

  if (!clientId || !clientSecret) {
    throw new Error('PayPal ist derzeit nicht eingerichtet. Bitte wählen Sie eine andere Zahlungsart.');
  }

  const tokenResponse = await axios.post(
    `${baseUrl}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      auth: {
        username: clientId,
        password: clientSecret
      },
      timeout: 15000
    }
  );

  return {
    accessToken: tokenResponse.data.access_token,
    baseUrl
  };
};

// Description: Get all invoices for the authenticated customer
// Endpoint: GET /api/invoices
// Request: { status?: string, limit?: number, skip?: number }
// Response: { success: boolean, invoices: Invoice[], count: number }
router.get('/', requireUser, async (req, res) => {
  try {
    console.log('InvoiceRoutes: Getting invoices for user:', req.user._id);

    const { status, limit = 50, skip = 0, orderId, bookingId } = req.query;

    const filters = {
      customerId: req.user._id,
      status: { $nin: CUSTOMER_HIDDEN_STATUSES },
      ...NOT_DISCARDED_FILTER
    };

    if (status) {
      if (CUSTOMER_HIDDEN_STATUSES.includes(String(status))) {
        return res.json({
          success: true,
          invoices: [],
          count: 0,
        });
      }
      filters.status = status;
    }

    // Optional: nur die Belege eines Auftrags bzw. einer Buchung (immer innerhalb der
    // eigenen Belege - customerId bleibt Pflichtfilter).
    const mongoose = require('mongoose');
    const scope = [];
    if (orderId && mongoose.Types.ObjectId.isValid(String(orderId))) {
      scope.push({ orderId: String(orderId) }, { repairOrderIds: String(orderId) });
    }
    if (bookingId && mongoose.Types.ObjectId.isValid(String(bookingId))) {
      scope.push({ bookingId: String(bookingId) });
    }
    if (scope.length > 0) filters.$or = scope;

    const invoices = await Invoice.find(filters)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('customerId', 'customerNumber invoiceAddress paymentAddress addressAddition country company firstName lastName name email')
      .populate('orderId', 'orderNumber deviceBrand deviceModel status')
      .lean();

    const count = await Invoice.countDocuments(filters);
    // Zahlungsstand je Rechnung aus der gemeinsamen Berechnung (wie im Admin).
    const balances = await PaymentService.getInvoiceBalances(invoices);
    const hydratedInvoices = invoices.map((invoice) => {
      const balance = balances.get(String(invoice._id));
      return {
        ...forViewer(req.user, withProfileBillingAddress(invoice)),
        balance: balance ? FinancialService.toBalancePayload(balance) : null,
        paymentState: balance?.paymentState || 'open',
      };
    });

    console.log('InvoiceRoutes: Retrieved', invoices.length, 'invoices for user');

    res.json({
      success: true,
      invoices: hydratedInvoices,
      count: count,
    });
  } catch (error) {
    console.error('InvoiceRoutes: Error getting invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Die Rechnungen konnten nicht geladen werden.',
    });
  }
});

// Description: Get PayPal JS SDK config for invoice payment (public client-id only)
// Endpoint: GET /api/invoices/paypal/config
// Request: { gatewayId?: string }
// Response: { success: boolean, clientId, currency, intent, locale, gatewayId, environment, button }
router.get('/paypal/config', requireUser, async (req, res) => {
  try {
    const allowedMethods = await loadAllowedInvoiceMethodsForUser(req.user._id);
    if (!isInvoiceProviderAllowed({ provider: 'paypal', allowedMethods })) {
      return res.status(403).json({ success: false, error: 'PayPal ist für Ihre Kundengruppe nicht freigegeben.' });
    }

    const { gatewayId } = req.query;
    const gateways = await FinancialService.getPaymentGateways();

    let gateway;
    if (gatewayId) {
      gateway = gateways.find((g) => String(g._id) === String(gatewayId) && g.provider === 'paypal' && g.isActive);
    }
    if (!gateway) {
      gateway = gateways.find((g) => g.provider === 'paypal' && g.isActive);
    }
    if (!gateway) {
      return res.status(404).json({ success: false, error: 'Kein aktives PayPal-Gateway gefunden.' });
    }

    const config = gateway.configuration || {};
    const useLive = config.environment === 'live';
    const clientId = useLive ? config.live_client_id : config.sandbox_client_id;

    if (!clientId) {
      return res.status(400).json({ success: false, error: 'PayPal Client-ID ist nicht konfiguriert.' });
    }

    return res.json({
      success: true,
      clientId,
      currency: (config.default_currency || config.currency || 'EUR').toUpperCase(),
      intent: (config.payment_intent || 'CAPTURE').toUpperCase(),
      locale: config.locale || 'de-DE',
      gatewayId: String(gateway._id),
      environment: config.environment || 'sandbox',
      button: {
        layout: config.button_layout || 'vertical',
        color: config.button_color || 'gold',
        shape: config.button_shape || 'rect',
        label: config.button_label || 'paypal'
      }
    });
  } catch (error) {
    console.error('InvoiceRoutes: Error loading PayPal SDK config:', error);
    return res.status(400).json({ success: false, error: toCustomerMessage(error, 'Die PayPal-Konfiguration konnte nicht geladen werden.') });
  }
});

// Description: Get active payment gateways available for customer invoice payment
// Endpoint: GET /api/invoices/payment-gateways
// Request: {}
// Response: { success: boolean, gateways: Array }
router.get('/payment-gateways', requireUser, async (req, res) => {
  try {
    const gateways = await FinancialService.getPaymentGateways();
    const allowedMethods = await loadAllowedInvoiceMethodsForUser(req.user._id);

    const customerGateways = gateways
      .filter((gateway) => (
        gateway.isActive
        && ['stripe', 'paypal', 'bank_transfer'].includes(gateway.provider)
        && isInvoiceProviderAllowed({ provider: gateway.provider, allowedMethods })
      ))
      .map((gateway) => ({
        _id: gateway._id,
        name: gateway.name,
        provider: gateway.provider,
        supportedMethods: gateway.supportedMethods || [],
        currency: gateway.configuration?.default_currency || gateway.configuration?.currency || 'EUR',
        processingFee: gateway.configuration?.processingFee || 0,
        requiresRedirect: ['stripe', 'paypal'].includes(gateway.provider),
        configuration: {
          mode: gateway.configuration?.mode,
          payment_mode: gateway.configuration?.payment_mode,
          success_url: gateway.configuration?.success_url,
          cancel_url: gateway.configuration?.cancel_url,
          return_url: gateway.configuration?.return_url,
          account_holder: gateway.configuration?.account_holder,
          iban: gateway.configuration?.iban,
          bic: gateway.configuration?.bic,
          bank_name: gateway.configuration?.bank_name,
          payment_reference_template: gateway.configuration?.payment_reference_template,
          payment_term_days: gateway.configuration?.payment_term_days,
          title: gateway.configuration?.title,
          description_checkout: gateway.configuration?.description_checkout
        }
      }));

    return res.json({
      success: true,
      gateways: customerGateways
    });
  } catch (error) {
    console.error('InvoiceRoutes: Error getting customer payment gateways:', error);
    return res.status(500).json({
      success: false,
      error: 'Die Zahlungsarten konnten nicht geladen werden.'
    });
  }
});

// Description: Initialize Stripe/PayPal redirect payment for invoice
// Endpoint: POST /api/invoices/:id/payments/initialize
// Request: { amount, gatewayId, gatewayProvider, paymentData }
// Response: { success: boolean, provider, gatewayId, redirectUrl, providerReference }
router.post('/:id/payments/initialize', requireUser, async (req, res) => {
  try {
    const { amount, gatewayId, gatewayProvider, paymentData = {}, isJsSdk = false } = req.body;

    if (!['stripe', 'paypal'].includes(gatewayProvider)) {
      return res.status(400).json({ success: false, error: 'Diese Zahlungsart wird über die Weiterleitung zum Zahlungsanbieter nicht unterstützt. Bitte wählen Sie Kartenzahlung oder PayPal.', code: 'UNSUPPORTED_REDIRECT_PROVIDER' });
    }

    const invoice = await Invoice.findById(req.params.id);
    assertInvoiceOwner(invoice, req.user);
    const allowedMethods = await loadAllowedInvoiceMethodsForUser(req.user._id);
    if (!isInvoiceProviderAllowed({ provider: gatewayProvider, allowedMethods })) {
      return res.status(403).json({ success: false, error: 'Diese Zahlungsart ist für Ihre Kundengruppe nicht freigegeben.' });
    }
    const { numericAmount } = await validatePaymentAmount(invoice, amount);

    const gateway = await getGatewayFromRequest(gatewayId, gatewayProvider);
    const currency = (gateway.configuration?.default_currency || gateway.configuration?.currency || 'EUR').toLowerCase();
    const frontendBase = getFrontendBaseUrl();
    const returnPath = paymentData.returnPath || '/customer/invoices';

    if (gatewayProvider === 'stripe') {
      const config = gateway.configuration || {};
      const useLive = config.mode === 'live';
      const stripeSecretKey = useLive ? config.live_secret_key : config.test_secret_key;

      if (!stripeSecretKey) {
        return res.status(400).json({ success: false, error: 'Die Kartenzahlung ist derzeit nicht eingerichtet. Bitte wählen Sie eine andere Zahlungsart.' });
      }

      const successUrl = `${frontendBase}${returnPath}?paymentStatus=success&paymentProvider=stripe&invoiceId=${invoice._id}&gatewayId=${gateway._id}&sessionId={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${frontendBase}${returnPath}?paymentStatus=cancel&paymentProvider=stripe&invoiceId=${invoice._id}&gatewayId=${gateway._id}`;

      const params = new URLSearchParams();
      params.append('mode', 'payment');
      params.append('success_url', successUrl);
      params.append('cancel_url', cancelUrl);
      params.append('customer_email', paymentData.payerEmail || invoice.customerEmail);
      params.append('client_reference_id', String(invoice._id));
      params.append('line_items[0][quantity]', '1');
      params.append('line_items[0][price_data][currency]', currency);
      params.append('line_items[0][price_data][unit_amount]', String(Math.round(numericAmount * 100)));
      params.append('line_items[0][price_data][product_data][name]', `Invoice ${invoice.invoiceNumber}`);
      params.append('line_items[0][price_data][product_data][description]', 'Invoice payment via McRepair.de');
      params.append('metadata[invoiceId]', String(invoice._id));
      params.append('metadata[invoiceNumber]', invoice.invoiceNumber);
      params.append('metadata[userId]', String(req.user._id));

      const response = await axios.post('https://api.stripe.com/v1/checkout/sessions', params, {
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 15000
      });

      return res.json({
        success: true,
        provider: 'stripe',
        gatewayId: gateway._id,
        redirectUrl: response.data.url,
        providerReference: response.data.id
      });
    }

    if (gatewayProvider === 'paypal') {
      const { accessToken, baseUrl } = await getPaypalAccessToken(gateway);
      const currencyCode = (gateway.configuration?.default_currency || 'EUR').toUpperCase();

      // When called from the PayPal JS SDK (createOrder callback), use a neutral return_url so that
      // PayPal's popup/redirect landing does not trigger the URL-param confirm flow a second time.
      // The JS SDK's onApprove callback handles confirmation directly; the redirect flow uses the
      // full URL with trigger params.
      const returnUrl = isJsSdk
        ? `${frontendBase}${returnPath}`
        : `${frontendBase}${returnPath}?paymentStatus=success&paymentProvider=paypal&invoiceId=${invoice._id}&gatewayId=${gateway._id}`;
      const cancelUrl = isJsSdk
        ? `${frontendBase}${returnPath}`
        : `${frontendBase}${returnPath}?paymentStatus=cancel&paymentProvider=paypal&invoiceId=${invoice._id}&gatewayId=${gateway._id}`;

      const orderResponse = await axios.post(
        `${baseUrl}/v2/checkout/orders`,
        {
          intent: 'CAPTURE',
          purchase_units: [
            {
              reference_id: String(invoice._id),
              custom_id: String(invoice._id),
              invoice_id: buildPaypalInvoiceId(invoice),
              description: `Invoice ${invoice.invoiceNumber || invoice._id}`,
              amount: {
                currency_code: currencyCode,
                value: numericAmount.toFixed(2)
              }
            }
          ],
          application_context: {
            return_url: returnUrl,
            cancel_url: cancelUrl,
            user_action: 'PAY_NOW',
            brand_name: 'McRepair.de'
          }
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const approveLink = (orderResponse.data.links || []).find((link) => link.rel === 'approve')?.href;
      if (!approveLink) {
        return res.status(502).json({ success: false, error: 'Die Weiterleitung zu PayPal konnte nicht erstellt werden. Bitte versuchen Sie es erneut.' });
      }

      return res.json({
        success: true,
        provider: 'paypal',
        gatewayId: gateway._id,
        redirectUrl: approveLink,
        providerReference: orderResponse.data.id
      });
    }

    return res.status(400).json({ success: false, error: 'Diese Zahlungsart wird für Rechnungen nicht unterstützt.' });
  } catch (error) {
    console.error('InvoiceRoutes: Error initializing redirect payment:', error?.response?.data || error);
    return res.status(400).json({
      success: false,
      error: toCustomerMessage(error, 'Die Zahlung konnte nicht gestartet werden. Bitte versuchen Sie es erneut.')
    });
  }
});

// Description: Confirm redirected Stripe/PayPal payment and record it on invoice
// Endpoint: POST /api/invoices/:id/payments/confirm
// Request: { gatewayProvider, gatewayId, providerReference, amount? }
// Response: { success: boolean, payment, invoice, remainingAmount, alreadyRecorded? }
router.post('/:id/payments/confirm', requireUser, async (req, res) => {
  try {
    const { gatewayProvider, gatewayId, providerReference, amount } = req.body;

    if (!['stripe', 'paypal'].includes(gatewayProvider)) {
      return res.status(400).json({ success: false, error: 'Diese Zahlungsart kann nicht über die Rückleitung vom Zahlungsanbieter bestätigt werden.', code: 'UNSUPPORTED_REDIRECT_PROVIDER' });
    }
    if (!providerReference) {
      return res.status(400).json({ success: false, error: 'Die Zahlungsreferenz des Anbieters fehlt.' });
    }

    const invoice = await Invoice.findById(req.params.id);
    assertInvoiceOwner(invoice, req.user);
    const allowedMethods = await loadAllowedInvoiceMethodsForUser(req.user._id);
    if (!isInvoiceProviderAllowed({ provider: gatewayProvider, allowedMethods })) {
      return res.status(403).json({ success: false, error: 'Diese Zahlungsart ist für Ihre Kundengruppe nicht freigegeben.' });
    }

    const existingPayment = await Payment.findOne({
      invoiceId: invoice._id,
      'metadata.providerReference': providerReference
    });

    if (existingPayment) {
      const paymentHistory = await loadInvoicePaymentHistory(invoice._id, invoice.orderId);
      const invoiceWithBalance = await withBalance(invoice.toObject ? invoice.toObject() : invoice);
      return res.json({
        success: true,
        alreadyRecorded: true,
        payment: existingPayment,
        invoice: forViewer(req.user, {
          ...invoiceWithBalance,
          paymentHistory,
          amountPaid: invoice.paidAmount,
        }),
        remainingAmount: Number(invoiceWithBalance?.balance?.open || 0)
      });
    }

    const gateway = await getGatewayFromRequest(gatewayId, gatewayProvider);
    const currency = (gateway.configuration?.default_currency || gateway.configuration?.currency || 'EUR').toUpperCase();

    let finalAmount = Number(amount || 0);
    let gatewayResponse = '';
    let providerDetails = {};

    if (gatewayProvider === 'stripe') {
      const config = gateway.configuration || {};
      const useLive = config.mode === 'live';
      const stripeSecretKey = useLive ? config.live_secret_key : config.test_secret_key;
      if (!stripeSecretKey) {
        return res.status(400).json({ success: false, error: 'Die Kartenzahlung ist derzeit nicht eingerichtet. Bitte wählen Sie eine andere Zahlungsart.' });
      }

      const sessionResponse = await axios.get(
        `https://api.stripe.com/v1/checkout/sessions/${providerReference}`,
        {
          headers: { Authorization: `Bearer ${stripeSecretKey}` },
          timeout: 15000
        }
      );

      const session = sessionResponse.data;
      // Die Session muss zu DIESER Rechnung gehoeren (beim Initialisieren gesetzt):
      // sonst koennte eine bezahlte Session einer anderen Rechnung hier ein zweites Mal
      // gebucht werden.
      const sessionInvoiceId = String(session?.metadata?.invoiceId || session?.client_reference_id || '');
      if (sessionInvoiceId !== String(invoice._id)) {
        return res.status(409).json({ success: false, error: 'Diese Stripe-Zahlung gehört nicht zu dieser Rechnung und wurde nicht verbucht.' });
      }
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ success: false, error: 'Die Stripe-Zahlung ist noch nicht abgeschlossen.' });
      }

      finalAmount = Number(session.amount_total || 0) / 100;
      gatewayResponse = `Stripe checkout session ${session.id} paid`;
      providerDetails = {
        sessionId: session.id,
        paymentStatus: session.payment_status,
        currency: session.currency
      };
    }

    if (gatewayProvider === 'paypal') {
      const { accessToken, baseUrl } = await getPaypalAccessToken(gateway);

      const paypalHeaders = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };

      const fetchOrder = async () => {
        const orderResponse = await axios.get(
          `${baseUrl}/v2/checkout/orders/${providerReference}`,
          {
            headers: paypalHeaders,
            timeout: 15000
          }
        );
        return orderResponse.data;
      };

      // Check order status first to avoid sending an unnecessary capture request that would return 422.
      let order = await fetchOrder();
      // Die PayPal-Order muss zu DIESER Rechnung gehoeren (custom_id/reference_id setzt
      // /payments/initialize). Gepruefte VOR einem Capture: sonst wuerde Geld fuer eine
      // fremde Rechnung eingezogen oder eine bereits bezahlte Order erneut gebucht.
      const boundUnit = order?.purchase_units?.[0] || {};
      const boundInvoiceId = String(boundUnit.custom_id || boundUnit.reference_id || '');
      if (boundInvoiceId !== String(invoice._id)) {
        return res.status(409).json({ success: false, error: 'Diese PayPal-Zahlung gehört nicht zu dieser Rechnung und wurde nicht verbucht.' });
      }
      if (order.status !== 'COMPLETED') {
        try {
          const captureResponse = await axios.post(
            `${baseUrl}/v2/checkout/orders/${providerReference}/capture`,
            {},
            {
              headers: paypalHeaders,
              timeout: 15000
            }
          );
          order = captureResponse.data;
        } catch (captureError) {
          // If PayPal returns 422 UNPROCESSABLE_ENTITY the order may already be captured.
          const errName = captureError?.response?.data?.name;
          if (captureError?.response?.status === 422 || errName === 'UNPROCESSABLE_ENTITY') {
            order = await fetchOrder();
            if (order.status !== 'COMPLETED') {
              return res.status(400).json({ success: false, error: 'Die PayPal-Zahlung konnte nicht abgeschlossen werden.' });
            }
          } else {
            throw captureError;
          }
        }
      }

      if (order.status !== 'COMPLETED') {
        return res.status(400).json({ success: false, error: 'Die PayPal-Zahlung ist noch nicht abgeschlossen.' });
      }

      const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
      finalAmount = Number(capture?.amount?.value || order.purchase_units?.[0]?.amount?.value || 0);
      gatewayResponse = `PayPal order ${order.id} captured`;
      providerDetails = {
        orderId: order.id,
        captureId: capture?.id,
        status: order.status,
        payerId: order?.payer?.payer_id || ''
      };
    }

    // Dieselbe Anbieterzahlung darf nur EINMAL im System stehen - auch wenn sie bereits
    // an anderer Stelle gebucht ist (z.B. als Vorauszahlung im Checkout oder auf einer
    // anderen Rechnung).
    const providerKeys = [...new Set([
      String(providerReference),
      String(providerDetails.captureId || ''),
      String(providerDetails.sessionId || ''),
    ].filter(Boolean))];
    const bookedElsewhere = await Payment.findOne({
      invoiceId: { $ne: invoice._id },
      $or: [
        { 'metadata.providerReference': { $in: providerKeys } },
        { 'metadata.paypalOrderId': { $in: providerKeys } },
        { 'metadata.providerDetails.captureId': { $in: providerKeys } },
        { transactionId: { $in: providerKeys } },
        { idempotencyKey: `gateway:${gatewayProvider}:${providerReference}` },
      ],
    }).select('_id invoiceId').lean();
    if (bookedElsewhere) {
      return res.status(409).json({
        success: false,
        error: 'Diese Zahlung ist bereits an anderer Stelle verbucht und wurde nicht erneut erfasst. Bitte wenden Sie sich an unseren Support, falls die Rechnung dennoch offen ist.',
      });
    }

    // Das Geld ist beim Anbieter bereits eingezogen: es wird IMMER erfasst. Frueher
    // wurde hier erst jetzt gegen den offenen Betrag geprueft - war die Rechnung
    // inzwischen anderweitig bezahlt, scheiterte die Erfassung und das eingezogene
    // Geld stand nirgends. Ein Ueberhang bleibt als "Erstattung offen" sichtbar.
    const numericAmount = Math.round(Number(finalAmount || 0) * 100) / 100;
    if (!(numericAmount > 0)) {
      return res.status(400).json({ success: false, error: 'Der Zahlungsanbieter hat keinen Betrag gemeldet.' });
    }

    const result = await FinancialService.addInvoicePayment(invoice._id, {
      amount: numericAmount,
      currency,
      paymentMethod: gatewayProvider,
      gatewayResponse,
      allowOverpayment: true,
      // Dieselbe Anbieter-Referenz ist genau EINE Zahlung - auch bei parallelem
      // Redirect- und onApprove-Aufruf oder spaeterem Retry.
      idempotencyKey: `gateway:${gatewayProvider}:${providerReference}`,
      metadata: {
        gatewayId,
        gatewayProvider,
        gatewayName: gateway.name,
        providerReference,
        providerDetails,
        confirmedAt: new Date(),
      }
    });

    const paymentHistory = await loadInvoicePaymentHistory(result.invoice._id, result.invoice.orderId);
    const confirmedInvoice = await withBalance(result.invoice?.toObject ? result.invoice.toObject() : result.invoice);
    // Kundensicht wie GET /:id: keine internen Felder in der Antwort.
    const invoiceWithHistory = forViewer(req.user, {
      ...confirmedInvoice,
      paymentHistory,
      amountPaid: result.invoice.paidAmount,
    });

    if (result.duplicate) {
      return res.json({
        success: true,
        alreadyRecorded: true,
        payment: result.payment,
        invoice: invoiceWithHistory,
        remainingAmount: Number(confirmedInvoice?.balance?.open || 0)
      });
    }

    // Notify customer of successful payment
    setImmediate(async () => {
      try {
        const customerId = invoice.customerId._id || invoice.customerId;
        if (customerId) {
          // FIN-4: Zahlungseingang mit Rechnungsnummer und Restbetrag im deutschen
          // Format (frueher "Ihre Zahlung ueber 47.40 EUR wurde erfolgreich verarbeitet.").
          // Die MwSt. steht auf der verlinkten Rechnung - eine Zahlung ist kein Steuerbeleg.
          const invoiceNumber = result.invoice.invoiceNumber || '';
          const openAmount = Number(confirmedInvoice?.balance?.open || 0);
          await NotificationService.createNotification({
            userId: customerId,
            title: 'Zahlung eingegangen',
            message: `Ihre Zahlung über ${formatEuroDe(numericAmount)}${invoiceNumber ? ` zu Rechnung ${invoiceNumber}` : ''} ist eingegangen. `
              + `Offener Restbetrag: ${formatEuroDe(openAmount)}.`,
            type: 'payment',
            orderId: result.invoice.orderId || undefined,
            actionUrl: `/invoices?invoiceId=${result.invoice._id}`,
            metadata: {
              invoiceId: String(result.invoice._id),
              invoiceNumber,
              amount: numericAmount,
              openAmount,
            },
          });
        }
      } catch (notifError) {
        console.error('Error creating payment notification:', notifError.message);
      }
    });

    return res.status(201).json({
      success: true,
      payment: result.payment,
      invoice: invoiceWithHistory,
      ...(result.warning ? { warning: result.warning } : {}),
      remainingAmount: Number(confirmedInvoice?.balance?.open || 0)
    });
  } catch (error) {
    console.error('InvoiceRoutes: Error confirming redirect payment:', error?.response?.data || error);
    return res.status(400).json({
      success: false,
      error: toCustomerMessage(error, 'Die Zahlung konnte nicht bestätigt werden. Bitte wenden Sie sich an unseren Support, falls der Betrag abgebucht wurde.')
    });
  }
});

// Description: Pay invoice with active system gateway
// Endpoint: POST /api/invoices/:id/pay
// Request: { amount, gatewayId, gatewayProvider, paymentData }
// Response: { success: boolean, invoice: Invoice, payment: Payment }
router.post('/:id/pay', requireUser, async (req, res) => {
  try {
    const { amount, gatewayId, gatewayProvider, paymentData = {} } = req.body;

    if (['stripe', 'paypal'].includes(gatewayProvider)) {
      return res.status(400).json({
        success: false,
        error: 'Kartenzahlung und PayPal werden über die Weiterleitung zum Zahlungsanbieter abgewickelt. Bitte die Zahlung erneut starten.',
        code: 'REDIRECT_REQUIRED'
      });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice || CUSTOMER_HIDDEN_STATUSES.includes(String(invoice.status || ''))) {
      return res.status(404).json({ success: false, error: INVOICE_NOT_FOUND_MESSAGE, code: 'INVOICE_NOT_FOUND' });
    }

    const invoiceCustomerId = invoice.customerId?._id || invoice.customerId;
    if (!invoiceCustomerId || String(invoiceCustomerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, error: 'Sie haben keine Berechtigung, diese Rechnung zu bezahlen.', code: 'INVOICE_FORBIDDEN' });
    }
    if (['cancelled', 'credited'].includes(String(invoice.status || '')) || invoice.isCreditNote) {
      return res.status(409).json({ success: false, error: 'Für diesen Beleg ist keine Zahlung offen.', code: 'INVOICE_NOT_PAYABLE' });
    }

    const allowedMethods = await loadAllowedInvoiceMethodsForUser(req.user._id);
    if (!isInvoiceProviderAllowed({ provider: gatewayProvider, allowedMethods })) {
      return res.status(403).json({ success: false, error: 'Diese Zahlungsart ist für Ihre Kundengruppe nicht freigegeben.' });
    }

    const gateways = await FinancialService.getPaymentGateways();
    const gateway = gateways.find((item) => item._id === gatewayId && item.provider === gatewayProvider);
    if (!gateway || !gateway.isActive) {
      return res.status(400).json({ success: false, error: 'Die gewählte Zahlungsart ist derzeit nicht verfügbar.', code: 'GATEWAY_UNAVAILABLE' });
    }

    let numericAmount = 0;
    try {
      ({ numericAmount } = await validatePaymentAmount(invoice, amount));
    } catch (validationError) {
      return res.status(400).json({ success: false, error: validationError.message });
    }

    const requiredFieldsByProvider = {
      stripe: ['cardholderName', 'cardNumber', 'cardExpiry', 'cardCvc', 'billingAddress.street', 'billingAddress.city', 'billingAddress.zipCode', 'billingAddress.country'],
      paypal: ['paypalEmail'],
      bank_transfer: ['accountHolder', 'iban']
    };

    const getField = (obj, path) => path.split('.').reduce((acc, key) => (acc && acc[key] != null ? acc[key] : undefined), obj);
    const missingFields = (requiredFieldsByProvider[gatewayProvider] || []).filter((field) => {
      const value = getField(paymentData, field);
      return value == null || String(value).trim() === '';
    });

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Bitte füllen Sie alle Pflichtfelder aus: ${missingFields.map((field) => PAYMENT_FIELD_LABELS[field] || field).join(', ')}.`
      });
    }

    const methodByProvider = {
      stripe: 'stripe',
      paypal: 'paypal',
      bank_transfer: 'bank_transfer'
    };

    const safePaymentMetadata = {
      gatewayId,
      gatewayProvider,
      gatewayName: gateway.name,
      invoiceNumber: invoice.invoiceNumber,
      payerName: paymentData.payerName || invoice.customerName,
      payerEmail: paymentData.payerEmail || invoice.customerEmail,
      acceptedTerms: Boolean(paymentData.acceptedTerms),
      acceptedAt: paymentData.acceptedTerms ? new Date() : null,
      details: gatewayProvider === 'stripe'
        ? {
            cardholderName: paymentData.cardholderName,
            cardLast4: String(paymentData.cardNumber || '').replace(/\s+/g, '').slice(-4),
            cardBrand: paymentData.cardBrand || 'card',
            cardExpiry: paymentData.cardExpiry,
            billingAddress: paymentData.billingAddress || {}
          }
        : gatewayProvider === 'paypal'
          ? {
              paypalEmail: paymentData.paypalEmail,
              paypalPayerId: paymentData.paypalPayerId || '',
              billingAddress: paymentData.billingAddress || {}
            }
          : {
              accountHolder: paymentData.accountHolder,
              iban: paymentData.iban,
              bic: paymentData.bic || '',
              bankName: paymentData.bankName || gateway.configuration?.bank_name || '',
              transferReference: paymentData.transferReference || gateway.configuration?.payment_reference_template || invoice.invoiceNumber
            }
    };

    // Ueber diesen Weg laeuft KEIN Zahlungsanbieter (Stripe/PayPal gehen ueber den
    // Redirect). Was der Kunde hier angibt - z.B. eine Ueberweisung mit IBAN - ist eine
    // ANKUENDIGUNG, kein Zahlungseingang. Frueher wurde sie als abgeschlossene Zahlung
    // gebucht: ein Kunde konnte jede Rechnung durch Eingabe einer IBAN auf "bezahlt"
    // setzen. Jetzt wird sie als 'pending' vorgemerkt und zaehlt erst, wenn der
    // Eingang im Admin erfasst ist.
    const method = methodByProvider[gatewayProvider] || 'bank_transfer';

    // Idempotenz: dieselbe Ankuendigung (Rechnung, Betrag, Zahlart, Kunde) wird nur
    // EINMAL vorgemerkt, solange sie offen ist - ein Doppelklick oder Retry legt keine
    // zweite Vormerkung an, die ein Bearbeiter spaeter doppelt uebernehmen koennte.
    const announcementFilter = {
      invoiceId: invoice._id,
      customerId: invoiceCustomerId,
      amount: numericAmount,
      paymentMethod: method,
      source: 'gateway',
    };
    const respondWithAnnouncement = async (payment, alreadyRecorded) => {
      const paymentHistory = await loadInvoicePaymentHistory(invoice._id, invoice.orderId);
      const currentInvoice = await withBalance(invoice.toObject ? invoice.toObject() : invoice);
      return res.status(202).json({
        success: true,
        pending: true,
        ...(alreadyRecorded ? { alreadyRecorded: true } : {}),
        message: alreadyRecorded
          ? 'Diese Zahlung ist bereits vorgemerkt. Die Rechnung gilt als bezahlt, sobald der Zahlungseingang bei uns bestätigt ist.'
          : 'Ihre Zahlung wurde vorgemerkt. Die Rechnung gilt als bezahlt, sobald der Zahlungseingang bei uns bestätigt ist.',
        payment,
        invoice: forViewer(req.user, {
          ...currentInvoice,
          paymentHistory,
          amountPaid: invoice.paidAmount,
        }),
        remainingAmount: Number(currentInvoice?.balance?.open || 0)
      });
    };
    const openAnnouncement = await Payment.findOne({ ...announcementFilter, status: 'pending' });
    if (openAnnouncement) return respondWithAnnouncement(openAnnouncement, true);
    // Paralleler Doppelklick: der eindeutige Schluessel laesst nur eine Vormerkung zu.
    // Die Zahl bereits erledigter Vormerkungen gehoert dazu, damit eine NEUE Ankuendigung
    // nach Bestaetigung/Ablehnung der alten wieder moeglich ist.
    const settledAnnouncements = await Payment.countDocuments({ ...announcementFilter, status: { $ne: 'pending' } });
    const announcementKey = `announce:${invoice._id}:${String(invoiceCustomerId)}:${method}:${numericAmount.toFixed(2)}:${settledAnnouncements}`;

    let announcement;
    try {
      announcement = await Payment.create({
        invoiceId: invoice._id,
        orderId: invoice.orderId?._id || invoice.orderId || undefined,
        bookingId: invoice.bookingId || undefined,
        customerId: invoiceCustomerId,
        customerName: invoice.customerName,
        amount: numericAmount,
        currency: gateway.configuration?.default_currency || gateway.configuration?.currency || 'EUR',
        paymentMethod: method,
        status: 'pending',
        source: 'gateway',
        paymentReference: invoice.invoiceNumber ? `Rechnung ${invoice.invoiceNumber}` : '',
        gatewayResponse: `Vom Kunden angekündigt über ${gateway.name} – Zahlungseingang noch nicht bestätigt`,
        idempotencyKey: announcementKey,
        metadata: safePaymentMetadata
      });
    } catch (createError) {
      if (createError?.code === 11000 && String(createError?.message || '').includes('idempotencyKey')) {
        const winner = await Payment.findOne({ idempotencyKey: announcementKey });
        if (winner) return respondWithAnnouncement(winner, true);
      }
      throw createError;
    }

    return respondWithAnnouncement(announcement, false);
  } catch (error) {
    console.error('InvoiceRoutes: Error processing invoice payment:', error);
    return res.status(400).json({
      success: false,
      error: toCustomerMessage(error, 'Die Zahlung konnte nicht vorgemerkt werden. Bitte versuchen Sie es erneut.')
    });
  }
});

// Description: Invoices (and credit notes) of one repair order
// Endpoint: GET /api/invoices/for-order/:orderId
// Auth: Admin/Mitarbeiter sehen alle Belege des Auftrags (inkl. Entwuerfe, markiert);
//       ein Kunde nur, wenn der Auftrag ihm gehoert, und nur ausgestellte Belege.
// Response: { success, invoices: Invoice[] (mit balance/paymentState), bookingReference }
router.get('/for-order/:orderId', requireUser, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const Order = require('../models/Order');
    if (!mongoose.Types.ObjectId.isValid(String(req.params.orderId || ''))) {
      return res.status(404).json({ success: false, error: 'Der Auftrag wurde nicht gefunden.', code: 'ORDER_NOT_FOUND' });
    }
    const order = await Order.findById(req.params.orderId)
      .setOptions({ skipAutoPopulate: true })
      .select('_id customerId bookingId orderNumber')
      .lean();
    if (!order) {
      return res.status(404).json({ success: false, error: 'Der Auftrag wurde nicht gefunden.', code: 'ORDER_NOT_FOUND' });
    }
    const privileged = isPrivilegedRole(req.user);
    if (!privileged && String(order.customerId || '') !== String(req.user._id)) {
      return res.status(403).json({ success: false, error: 'Sie haben keine Berechtigung für diesen Auftrag.', code: 'ORDER_FORBIDDEN' });
    }

    const scope = [{ orderId: order._id }, { repairOrderIds: order._id }];
    if (order.bookingId) scope.push({ bookingId: order.bookingId });
    const filter = { $or: scope };
    if (!privileged) {
      // Kunde: nur eigene, ausgestellte Belege - auch wenn die Buchung weitere enthaelt.
      filter.customerId = req.user._id;
      filter.status = { $nin: CUSTOMER_HIDDEN_STATUSES };
      Object.assign(filter, NOT_DISCARDED_FILTER);
    }
    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .populate('orderId', 'orderNumber deviceBrand deviceModel status')
      .lean();
    const balances = await PaymentService.getInvoiceBalances(invoices);
    const bookingReference = invoices.length > 0 ? await loadBookingReference(invoices[0]) : await loadBookingReference({ orderId: order._id });

    return res.json({
      success: true,
      invoices: invoices.map((invoice) => {
        const balance = balances.get(String(invoice._id));
        return {
          ...forViewer(req.user, invoice),
          balance: balance ? FinancialService.toBalancePayload(balance) : null,
          paymentState: balance?.paymentState || 'open',
        };
      }),
      bookingReference,
    });
  } catch (error) {
    console.error('InvoiceRoutes: Error loading invoices for order:', error);
    return res.status(500).json({ success: false, error: 'Die Belege zum Auftrag konnten nicht geladen werden.' });
  }
});

// Description: Download a specific invoice as PDF
// Endpoint: GET /api/invoices/:id/pdf
// Ausgestellte Belege: IMMER die archivierte Fassung (FinancialService.ensureInvoiceDocument) -
// byte-identisch bei jedem Abruf, unveraendert nach spaeteren Zahlungen. Entwuerfe nur fuer
// Admin/Mitarbeiter als nicht archivierte Vorschau; fuer Kunden existieren sie nicht.
router.get('/:id/pdf', requireUser, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id || ''))) {
      throw buildAccessError(INVOICE_NOT_FOUND_MESSAGE, 404, 'INVOICE_NOT_FOUND');
    }
    const invoice = await Invoice.findById(req.params.id).setOptions({ skipAutoPopulate: true }).select('_id customerId status invoiceNumber isCreditNote cancellation.kind').lean();
    assertInvoiceOwner(invoice, req.user);

    const isDraft = isNeverIssued(invoice);
    const pdf = isDraft
      ? await FinancialService.renderDraftPdf(invoice._id)
      : (await FinancialService.ensureInvoiceDocument(invoice._id, { reason: 'Abruf', actorId: req.user._id, actorName: req.user.name || '' })).buffer;
    const safeInvoiceNumber = String(invoice.invoiceNumber || invoice._id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const prefix = isDraft ? 'Entwurf' : (invoice.isCreditNote ? 'Gutschrift' : 'Rechnung');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${prefix}_${safeInvoiceNumber}.pdf"`,
      'Content-Length': pdf.length,
      'Cache-Control': 'private, no-store'
    });
    return res.send(pdf);
  } catch (error) {
    const statusCode = Number(error?.statusCode);
    if (Number.isFinite(statusCode) && statusCode >= 400 && statusCode < 500) {
      return res.status(statusCode).json({ success: false, error: error.message, code: error.code });
    }
    console.error('InvoiceRoutes: Error generating invoice PDF:', error);
    return res.status(500).json({ success: false, error: 'Das Rechnungs-PDF konnte nicht erstellt werden.', code: 'INVOICE_PDF_FAILED' });
  }
});

// Description: Get a specific invoice by ID
// Endpoint: GET /api/invoices/:id
// Request: {}
// Response: { success: boolean, invoice: Invoice }
//   invoice.bookingReference = { _id, bookingNumber } | null  (Sprung "Bestellung")
//   invoice.relatedCreditNotes = [{ _id, invoiceNumber, total, correctionType, createdAt }]
router.get('/:id', requireUser, async (req, res) => {
  try {
    console.log('InvoiceRoutes: Getting invoice:', req.params.id);

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id || ''))) {
      return res.status(404).json({ success: false, error: INVOICE_NOT_FOUND_MESSAGE, code: 'INVOICE_NOT_FOUND' });
    }
    const invoice = await Invoice.findById(req.params.id)
      .populate('customerId', 'customerNumber invoiceAddress paymentAddress addressAddition country company firstName lastName name email')
      .populate('orderId', 'orderNumber deviceBrand deviceModel status')
      .lean();

    try {
      assertInvoiceOwner(invoice, req.user);
    } catch (accessError) {
      console.log('InvoiceRoutes: Invoice access refused:', accessError.code);
      return res.status(accessError.statusCode || 403).json({ success: false, error: accessError.message, code: accessError.code });
    }

    console.log('InvoiceRoutes: Invoice retrieved successfully');

    const enrichedInvoice = await withBalance(withProfileBillingAddress(invoice));
    const paymentHistory = await loadInvoicePaymentHistory(invoice._id, invoice.orderId);
    const bookingReference = await loadBookingReference(invoice);
    const creditNoteFilter = { creditNoteOf: invoice._id, isCreditNote: true };
    if (!isPrivilegedRole(req.user)) Object.assign(creditNoteFilter, { status: { $nin: CUSTOMER_HIDDEN_STATUSES } }, NOT_DISCARDED_FILTER);
    const relatedCreditNotes = invoice.isCreditNote
      ? []
      : (await Invoice.find(creditNoteFilter)
        .setOptions({ skipAutoPopulate: true })
        .select('_id invoiceNumber total correctionType createdAt status')
        .sort({ createdAt: 1 })
        .lean()).map((note) => ({ ...note, _id: String(note._id) }));
    const invoiceWithHistory = {
      ...enrichedInvoice,
      paymentHistory,
      amountPaid: enrichedInvoice.paidAmount,
      bookingReference,
      relatedCreditNotes,
    };

    res.json({
      success: true,
      invoice: forViewer(req.user, invoiceWithHistory),
    });
  } catch (error) {
    console.error('InvoiceRoutes: Error getting invoice:', error);
    res.status(500).json({
      success: false,
      error: 'Die Rechnung konnte nicht geladen werden.',
    });
  }
});

// Description: Mark invoice as viewed by customer
// Endpoint: PUT /api/invoices/:id/view
// Request: {}
// Response: { success: boolean, invoice: Invoice }
router.put('/:id/view', requireUser, async (req, res) => {
  try {
    console.log('InvoiceRoutes: Marking invoice as viewed:', req.params.id);

    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      console.log('InvoiceRoutes: Invoice not found');
      return res.status(404).json({
        success: false,
        error: INVOICE_NOT_FOUND_MESSAGE,
      });
    }

    // Verify ownership
    const viewCustomerId = invoice.customerId?._id || invoice.customerId;
    if (String(viewCustomerId || '') !== req.user._id.toString()) {
      console.log('InvoiceRoutes: Unauthorized access to invoice');
      return res.status(403).json({
        success: false,
        error: INVOICE_FORBIDDEN_MESSAGE,
      });
    }
    // Entwurf/Freigabe/verworfener Entwurf existiert fuer den Kunden nicht - wie GET /:id.
    if (!isPrivilegedRole(req.user) && isNeverIssued(invoice)) {
      return res.status(404).json({ success: false, error: INVOICE_NOT_FOUND_MESSAGE, code: 'INVOICE_NOT_FOUND' });
    }

    // Update status to 'viewed' if it was 'sent'
    if (invoice.status === 'sent') {
      invoice.status = 'viewed';
      await invoice.save();
      // syncPaymentDerivedState zieht Auftrag UND Buchung nach und scheitert bewusst
      // nicht fatal - ein Altbestands-Booking darf die bereits gespeicherte
      // Statusaenderung nicht nachtraeglich als Fehler erscheinen lassen.
      await FinancialService.syncPaymentDerivedState(invoice, 'invoiceRoutes:viewed');
      console.log('InvoiceRoutes: Invoice status updated to viewed');
    }

    res.json({
      success: true,
      invoice: forViewer(req.user, invoice),
    });
  } catch (error) {
    console.error('InvoiceRoutes: Error marking invoice as viewed:', error);
    res.status(500).json({
      success: false,
      error: 'Die Rechnung konnte nicht als gelesen markiert werden.',
    });
  }
});

// Description: Get invoice statistics for customer
// Endpoint: GET /api/invoices/stats
// Request: {}
// Response: { success: boolean, stats: object }
router.get('/stats/summary', requireUser, async (req, res) => {
  try {
    console.log('InvoiceRoutes: Getting invoice statistics for user:', req.user._id);

    const customerInvoiceScope = { customerId: req.user._id, status: { $nin: CUSTOMER_HIDDEN_STATUSES }, ...NOT_DISCARDED_FILTER };

    const totalInvoices = await Invoice.countDocuments(customerInvoiceScope);
    const paidInvoices = await Invoice.countDocuments({ ...customerInvoiceScope, status: 'paid' });
    const unpaidInvoices = await Invoice.countDocuments({
      ...customerInvoiceScope,
      status: { $in: ['sent', 'viewed', 'overdue'] }
    });
    const overdueInvoices = await Invoice.countDocuments({ ...customerInvoiceScope, status: 'overdue' });

    // Calculate total amounts
    const totalAmount = await Invoice.aggregate([
      { $match: customerInvoiceScope },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    const paidAmount = await Invoice.aggregate([
      { $match: { customerId: req.user._id, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    const unpaidAmount = await Invoice.aggregate([
      { $match: { customerId: req.user._id, status: { $in: ['sent', 'viewed', 'overdue'] } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    const stats = {
      totalInvoices,
      paidInvoices,
      unpaidInvoices,
      overdueInvoices,
      totalAmount: totalAmount.length > 0 ? totalAmount[0].total : 0,
      paidAmount: paidAmount.length > 0 ? paidAmount[0].total : 0,
      unpaidAmount: unpaidAmount.length > 0 ? unpaidAmount[0].total : 0,
    };

    console.log('InvoiceRoutes: Invoice statistics retrieved successfully');

    res.json({
      success: true,
      stats: stats,
    });
  } catch (error) {
    console.error('InvoiceRoutes: Error getting invoice statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Die Rechnungsübersicht konnte nicht geladen werden.',
    });
  }
});

module.exports = router;
