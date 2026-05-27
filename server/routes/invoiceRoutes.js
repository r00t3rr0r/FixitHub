const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireUser } = require('./middleware/auth');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const FinancialService = require('../services/financialService');
const NotificationService = require('../services/notificationService');

const getFrontendBaseUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';

const getGatewayFromRequest = async (gatewayId, gatewayProvider) => {
  const gateways = await FinancialService.getPaymentGateways();
  const gateway = gateways.find((item) => item._id === gatewayId && item.provider === gatewayProvider);
  if (!gateway || !gateway.isActive) {
    throw new Error('Selected payment gateway is not available');
  }
  return gateway;
};

const loadInvoicePaymentHistory = async (invoiceId) => {
  const payments = await Payment.find({ invoiceId })
    .sort({ processedAt: -1, createdAt: -1 })
    .lean();

  return payments.map((payment) => ({
    _id: String(payment._id),
    date: payment.processedAt || payment.createdAt || new Date(),
    amount: Number(payment.amount || 0),
    method: payment.paymentMethod,
    note: payment.gatewayResponse || payment.metadata?.providerReference || payment.transactionId || ''
  }));
};

const assertInvoiceOwner = (invoice, user) => {
  if (!invoice) throw new Error('Invoice not found');

  const isPrivilegedUser = user?.role === 'admin' || user?.role === 'staff';
  if (isPrivilegedUser) return;

  const invoiceCustomerId = invoice.customerId?._id || invoice.customerId;
  const requesterId = user?._id || user;

  if (!invoiceCustomerId || !requesterId || String(invoiceCustomerId) !== String(requesterId)) {
    throw new Error('You do not have permission to access this invoice');
  }
};

const validatePaymentAmount = (invoice, amount) => {
  const numericAmount = Number(amount);
  const remaining = Number(invoice.total || 0) - Number(invoice.paidAmount || 0);
  if (!numericAmount || numericAmount <= 0) throw new Error('Invalid payment amount');
  if (numericAmount > remaining + 0.01) {
    throw new Error(`Payment amount exceeds remaining balance (${remaining.toFixed(2)}).`);
  }
  return { numericAmount, remaining };
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
    throw new Error('PayPal gateway credentials are not configured.');
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

    const { status, limit = 50, skip = 0 } = req.query;

    const filters = {
      customerId: req.user._id,
      status: { $ne: 'draft' }
    };

    if (status) {
      if (status === 'draft') {
        return res.json({
          success: true,
          invoices: [],
          count: 0,
        });
      }
      filters.status = status;
    }

    const invoices = await Invoice.find(filters)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('orderId', 'orderNumber deviceBrand deviceModel status')
      .lean();

    const count = await Invoice.countDocuments(filters);

    console.log('InvoiceRoutes: Retrieved', invoices.length, 'invoices for user');

    res.json({
      success: true,
      invoices: invoices,
      count: count,
    });
  } catch (error) {
    console.error('InvoiceRoutes: Error getting invoices:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Description: Get PayPal JS SDK config for invoice payment (public client-id only)
// Endpoint: GET /api/invoices/paypal/config
// Request: { gatewayId?: string }
// Response: { success: boolean, clientId, currency, intent, locale, gatewayId, environment, button }
router.get('/paypal/config', requireUser, async (req, res) => {
  try {
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
    return res.status(400).json({ success: false, error: error.message || 'PayPal-Konfiguration konnte nicht geladen werden.' });
  }
});

// Description: Get active payment gateways available for customer invoice payment
// Endpoint: GET /api/invoices/payment-gateways
// Request: {}
// Response: { success: boolean, gateways: Array }
router.get('/payment-gateways', requireUser, async (req, res) => {
  try {
    const gateways = await FinancialService.getPaymentGateways();

    const customerGateways = gateways
      .filter((gateway) => gateway.isActive && ['stripe', 'paypal', 'bank_transfer'].includes(gateway.provider))
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
      error: error.message || 'Failed to load payment gateways'
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
      return res.status(400).json({ success: false, error: 'Only Stripe and PayPal support redirect initialization.' });
    }

    const invoice = await Invoice.findById(req.params.id);
    assertInvoiceOwner(invoice, req.user);
    const { numericAmount } = validatePaymentAmount(invoice, amount);

    const gateway = await getGatewayFromRequest(gatewayId, gatewayProvider);
    const currency = (gateway.configuration?.default_currency || gateway.configuration?.currency || 'EUR').toLowerCase();
    const frontendBase = getFrontendBaseUrl();
    const returnPath = paymentData.returnPath || '/customer/invoices';

    if (gatewayProvider === 'stripe') {
      const config = gateway.configuration || {};
      const useLive = config.mode === 'live';
      const stripeSecretKey = useLive ? config.live_secret_key : config.test_secret_key;

      if (!stripeSecretKey) {
        return res.status(400).json({ success: false, error: 'Stripe secret key is not configured.' });
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
      params.append('line_items[0][price_data][product_data][description]', 'Invoice payment via FixitHub');
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
            brand_name: 'FixitHub'
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
        return res.status(502).json({ success: false, error: 'PayPal approval URL could not be generated.' });
      }

      return res.json({
        success: true,
        provider: 'paypal',
        gatewayId: gateway._id,
        redirectUrl: approveLink,
        providerReference: orderResponse.data.id
      });
    }

    return res.status(400).json({ success: false, error: 'Unsupported payment provider.' });
  } catch (error) {
    console.error('InvoiceRoutes: Error initializing redirect payment:', error?.response?.data || error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to initialize payment.'
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
      return res.status(400).json({ success: false, error: 'Only Stripe and PayPal can be confirmed via redirect tokens.' });
    }
    if (!providerReference) {
      return res.status(400).json({ success: false, error: 'Provider reference is required.' });
    }

    const invoice = await Invoice.findById(req.params.id);
    assertInvoiceOwner(invoice, req.user);

    const existingPayment = await Payment.findOne({
      invoiceId: invoice._id,
      'metadata.providerReference': providerReference
    });

    if (existingPayment) {
      const paymentHistory = await loadInvoicePaymentHistory(invoice._id);
      return res.json({
        success: true,
        alreadyRecorded: true,
        payment: existingPayment,
        invoice: {
          ...invoice,
          paymentHistory,
          amountPaid: invoice.paidAmount,
        },
        remainingAmount: Number(invoice.total || 0) - Number(invoice.paidAmount || 0)
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
        return res.status(400).json({ success: false, error: 'Stripe secret key is not configured.' });
      }

      const sessionResponse = await axios.get(
        `https://api.stripe.com/v1/checkout/sessions/${providerReference}`,
        {
          headers: { Authorization: `Bearer ${stripeSecretKey}` },
          timeout: 15000
        }
      );

      const session = sessionResponse.data;
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ success: false, error: 'Stripe payment is not completed yet.' });
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
              return res.status(400).json({ success: false, error: 'PayPal payment could not be completed.' });
            }
          } else {
            throw captureError;
          }
        }
      }

      if (order.status !== 'COMPLETED') {
        return res.status(400).json({ success: false, error: 'PayPal payment is not completed yet.' });
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

    const { numericAmount } = validatePaymentAmount(invoice, finalAmount);

    const result = await FinancialService.addInvoicePayment(invoice._id, {
      amount: numericAmount,
      currency,
      paymentMethod: gatewayProvider,
      gatewayResponse,
      metadata: {
        gatewayId,
        gatewayProvider,
        gatewayName: gateway.name,
        providerReference,
        providerDetails,
        confirmedAt: new Date(),
      }
    });

    const paymentHistory = await loadInvoicePaymentHistory(result.invoice._id);
    const invoiceWithHistory = {
      ...result.invoice,
      paymentHistory,
      amountPaid: result.invoice.paidAmount,
    };

    // Notify customer of successful payment
    setImmediate(async () => {
      try {
        const customerId = invoice.customerId._id || invoice.customerId;
        if (customerId) {
          await NotificationService.createPaymentNotification(
            customerId,
            numericAmount,
            'completed',
            result.invoice.orderId || null
          );
        }
      } catch (notifError) {
        console.error('Error creating payment notification:', notifError.message);
      }
    });

    return res.status(201).json({
      success: true,
      payment: result.payment,
      invoice: invoiceWithHistory,
      remainingAmount: Number(result.invoice.total || 0) - Number(result.invoice.paidAmount || 0)
    });
  } catch (error) {
    console.error('InvoiceRoutes: Error confirming redirect payment:', error?.response?.data || error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to confirm payment.'
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
        error: 'Stripe/PayPal require redirect initialization. Use /payments/initialize first.'
      });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    if (invoice.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'You do not have permission to pay this invoice' });
    }

    const gateways = await FinancialService.getPaymentGateways();
    const gateway = gateways.find((item) => item._id === gatewayId && item.provider === gatewayProvider);
    if (!gateway || !gateway.isActive) {
      return res.status(400).json({ success: false, error: 'Selected payment gateway is not available' });
    }

    const numericAmount = Number(amount);
    const remaining = Number(invoice.total || 0) - Number(invoice.paidAmount || 0);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid payment amount' });
    }
    if (numericAmount > remaining + 0.01) {
      return res.status(400).json({
        success: false,
        error: `Payment amount exceeds remaining balance (${remaining.toFixed(2)}).`
      });
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
        error: `Missing required payment fields: ${missingFields.join(', ')}`
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

    const result = await FinancialService.addInvoicePayment(invoice._id, {
      amount: numericAmount,
      currency: gateway.configuration?.default_currency || gateway.configuration?.currency || 'EUR',
      paymentMethod: methodByProvider[gatewayProvider],
      gatewayResponse: `Customer payment processed via ${gateway.name}`,
      metadata: safePaymentMetadata
    });

    const paymentHistory = await loadInvoicePaymentHistory(result.invoice._id);
    const invoiceWithHistory = {
      ...result.invoice,
      paymentHistory,
      amountPaid: result.invoice.paidAmount,
    };

    // Notify customer of successful payment
    setImmediate(async () => {
      try {
        await NotificationService.createPaymentNotification(
          req.user._id,
          numericAmount,
          'completed',
          result.invoice.orderId || null
        );
      } catch (notifError) {
        console.error('Error creating payment notification:', notifError.message);
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Invoice payment processed successfully',
      payment: result.payment,
      invoice: invoiceWithHistory,
      remainingAmount: Number(result.invoice.total || 0) - Number(result.invoice.paidAmount || 0)
    });
  } catch (error) {
    console.error('InvoiceRoutes: Error processing invoice payment:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to process invoice payment'
    });
  }
});

// Description: Get a specific invoice by ID
// Endpoint: GET /api/invoices/:id
// Request: {}
// Response: { success: boolean, invoice: Invoice }
router.get('/:id', requireUser, async (req, res) => {
  try {
    console.log('InvoiceRoutes: Getting invoice:', req.params.id);

    const invoice = await Invoice.findById(req.params.id)
      .populate('orderId', 'orderNumber deviceBrand deviceModel status')
      .lean();

    if (!invoice) {
      console.log('InvoiceRoutes: Invoice not found');
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
      });
    }

    const isPrivilegedUser = req.user.role === 'admin' || req.user.role === 'staff';
    const invoiceCustomerId = invoice.customerId?._id || invoice.customerId;
    const isOwner = invoiceCustomerId.toString() === req.user._id.toString();

    // Verify ownership
    if (!isOwner && !isPrivilegedUser) {
      console.log('InvoiceRoutes: Unauthorized access to invoice');
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view this invoice',
      });
    }

    if (!isPrivilegedUser && invoice.status === 'draft') {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
      });
    }

    console.log('InvoiceRoutes: Invoice retrieved successfully');

    const paymentHistory = await loadInvoicePaymentHistory(invoice._id);
    const invoiceWithHistory = {
      ...invoice,
      paymentHistory,
      amountPaid: invoice.paidAmount,
    };

    res.json({
      success: true,
      invoice: invoiceWithHistory,
    });
  } catch (error) {
    console.error('InvoiceRoutes: Error getting invoice:', error);
    res.status(500).json({
      success: false,
      error: error.message,
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
        error: 'Invoice not found',
      });
    }

    // Verify ownership
    const viewCustomerId = invoice.customerId?._id || invoice.customerId;
    if (viewCustomerId.toString() !== req.user._id.toString()) {
      console.log('InvoiceRoutes: Unauthorized access to invoice');
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view this invoice',
      });
    }

    // Update status to 'viewed' if it was 'sent'
    if (invoice.status === 'sent') {
      invoice.status = 'viewed';
      await invoice.save();
      console.log('InvoiceRoutes: Invoice status updated to viewed');
    }

    res.json({
      success: true,
      invoice: invoice,
    });
  } catch (error) {
    console.error('InvoiceRoutes: Error marking invoice as viewed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
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

    const customerInvoiceScope = { customerId: req.user._id, status: { $ne: 'draft' } };

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
      error: error.message,
    });
  }
});

module.exports = router;
