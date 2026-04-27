const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireUser } = require('./middleware/auth');
const CartService = require('../services/cartService');
const UserService = require('../services/userService');
const OrderService = require('../services/orderService');
const BookingService = require('../services/bookingService');
const EmailService = require('../services/emailService');
const FinancialService = require('../services/financialService');
const Service = require('../models/Service');
const Payment = require('../models/Payment');
const normalizeEmailAddress = (email) => String(email || '').trim().toLowerCase();

const sanitizeMoney = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Number(numeric.toFixed(2));
};

const formatMoney = (value) => sanitizeMoney(value).toFixed(2);

const getFrontendBaseUrl = () => process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';

const getActivePaypalGateway = async () => {
  const gateways = await FinancialService.getPaymentGateways();
  const gateway = gateways.find((item) => item.provider === 'paypal' && item.isActive);
  if (!gateway) {
    throw new Error('PayPal gateway is not configured or inactive.');
  }
  return gateway;
};

const getPaypalAccessToken = async (gateway) => {
  const config = gateway.configuration || {};
  const useLive = config.environment === 'live';
  const clientId = useLive ? config.live_client_id : config.sandbox_client_id;
  const clientSecret = useLive ? config.live_client_secret : config.sandbox_client_secret;
  const baseUrl = useLive
    ? (config.api_base_url_live || 'https://api-m.paypal.com')
    : (config.api_base_url_sandbox || 'https://api-m.sandbox.paypal.com');

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials are not configured.');
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
    baseUrl,
    clientId,
    environment: useLive ? 'live' : 'sandbox'
  };
};

const verifyPaypalWebhookSignature = async ({ gateway, webhookEvent, headers }) => {
  const config = gateway.configuration || {};
  if (!config.webhook_id) {
    throw new Error('PayPal webhook_id is not configured.');
  }

  const transmissionId = headers['paypal-transmission-id'];
  const transmissionTime = headers['paypal-transmission-time'];
  const transmissionSig = headers['paypal-transmission-sig'];
  const certUrl = headers['paypal-cert-url'];
  const authAlgo = headers['paypal-auth-algo'];

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    throw new Error('Missing PayPal webhook signature headers.');
  }

  const { accessToken, baseUrl } = await getPaypalAccessToken(gateway);
  const verificationResponse = await axios.post(
    `${baseUrl}/v1/notifications/verify-webhook-signature`,
    {
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: config.webhook_id,
      webhook_event: webhookEvent
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    }
  );

  return verificationResponse.data?.verification_status === 'SUCCESS';
};

const findPaymentByPaypalResource = async ({ orderId, captureId }) => {
  const orConditions = [];

  if (captureId) {
    orConditions.push({ 'metadata.providerDetails.captureId': captureId });
    orConditions.push({ 'metadata.providerReference': captureId });
    orConditions.push({ transactionId: captureId });
  }

  if (orderId) {
    orConditions.push({ transactionId: orderId });
    orConditions.push({ 'metadata.paypalOrderId': orderId });
  }

  if (!orConditions.length) return null;

  return Payment.findOne({ $or: orConditions }).sort({ createdAt: -1 });
};

const applyPaypalWebhookUpdate = async ({ payment, eventType, resource, orderId, captureId }) => {
  if (!payment) return null;

  const resourceAmount = resource?.amount || {};
  const amountValue = Number(resourceAmount.value || 0);
  const safeAmount = Number.isFinite(amountValue) && amountValue > 0 ? amountValue : payment.amount;

  const providerDetails = {
    ...(payment.metadata?.providerDetails || {}),
    webhookEventType: eventType,
    webhookResourceStatus: resource?.status || '',
    webhookCaptureId: captureId || '',
    webhookOrderId: orderId || '',
    webhookUpdatedAt: new Date().toISOString()
  };

  if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
    payment.status = 'completed';
    payment.processedAt = payment.processedAt || new Date();
    payment.amount = safeAmount;
    payment.gatewayResponse = `PayPal webhook completed capture ${captureId || orderId || payment.transactionId}`;
  }

  if (eventType === 'PAYMENT.CAPTURE.PENDING') {
    payment.status = 'processing';
    payment.gatewayResponse = `PayPal webhook pending capture ${captureId || orderId || payment.transactionId}`;
  }

  if (eventType === 'PAYMENT.CAPTURE.DENIED' || eventType === 'PAYMENT.CAPTURE.DECLINED') {
    payment.status = 'failed';
    payment.gatewayResponse = `PayPal webhook denied capture ${captureId || orderId || payment.transactionId}`;
  }

  if (eventType === 'PAYMENT.CAPTURE.REFUNDED' || eventType === 'PAYMENT.CAPTURE.REVERSED') {
    payment.status = 'refunded';
    payment.refundAmount = safeAmount;
    payment.refundedAt = payment.refundedAt || new Date();
    payment.refundReason = resource?.status_details?.reason || `paypal_${eventType.toLowerCase()}`;
    payment.refundMode = 'gateway';
    payment.refundGatewayProvider = 'paypal';
    payment.refundGatewayReference = captureId || orderId || '';
    payment.gatewayResponse = `PayPal webhook refund/reversal ${captureId || orderId || payment.transactionId}`;
  }

  payment.metadata = {
    ...(payment.metadata || {}),
    gatewayProvider: 'paypal',
    paypalOrderId: orderId || payment.metadata?.paypalOrderId || '',
    providerReference: captureId || payment.metadata?.providerReference || payment.transactionId,
    providerDetails
  };

  await payment.save();
  return payment;
};

const buildPaypalLineItems = (cart, currencyCode) => {
  const lineItems = [];

  for (const item of (cart?.items || [])) {
    const product = item?.productId || item?.product || {};
    const label = String(product?.name || 'Produkt').trim().slice(0, 127);
    const quantity = Math.max(1, Number(item?.quantity || 1));
    const unitAmount = sanitizeMoney(product?.price ?? item?.price ?? 0);

    if (unitAmount <= 0) continue;

    lineItems.push({
      name: label || 'Produkt',
      quantity: String(quantity),
      unit_amount: {
        currency_code: currencyCode,
        value: formatMoney(unitAmount)
      }
    });
  }

  for (const repairOrder of (cart?.repairOrders || [])) {
    const label = [repairOrder?.deviceBrand, repairOrder?.deviceModel]
      .filter(Boolean)
      .join(' ')
      .trim()
      .slice(0, 127);
    const unitAmount = sanitizeMoney(repairOrder?.totalCost || 0);

    if (unitAmount <= 0) continue;

    lineItems.push({
      name: label || 'Reparaturauftrag',
      quantity: '1',
      unit_amount: {
        currency_code: currencyCode,
        value: formatMoney(unitAmount)
      }
    });
  }

  if (lineItems.length === 0) {
    const fallbackAmount = sanitizeMoney(cart?.total || 0);
    lineItems.push({
      name: 'FixitHub Bestellung',
      quantity: '1',
      unit_amount: {
        currency_code: currencyCode,
        value: formatMoney(fallbackAmount)
      }
    });
  }

  return lineItems;
};

const buildPaypalAmount = (cart, lineItems, currencyCode, sendBreakdown = true) => {
  const total = sanitizeMoney(cart?.total || 0);
  if (!sendBreakdown) {
    return {
      currency_code: currencyCode,
      value: formatMoney(total)
    };
  }

  const itemTotal = sanitizeMoney(
    lineItems.reduce((sum, item) => sum + Number(item.unit_amount?.value || 0) * Number(item.quantity || 1), 0)
  );
  const taxTotal = sanitizeMoney(cart?.tax || 0);
  const discount = sanitizeMoney(cart?.discount || 0);
  let shipping = sanitizeMoney(total - itemTotal - taxTotal + discount);
  if (shipping < 0) shipping = 0;

  return {
    currency_code: currencyCode,
    value: formatMoney(total),
    breakdown: {
      item_total: {
        currency_code: currencyCode,
        value: formatMoney(itemTotal)
      },
      tax_total: {
        currency_code: currencyCode,
        value: formatMoney(taxTotal)
      },
      shipping: {
        currency_code: currencyCode,
        value: formatMoney(shipping)
      },
      discount: {
        currency_code: currencyCode,
        value: formatMoney(discount)
      }
    }
  };
};

const validateGuestCheckoutPayload = ({ guestInfo, cartData }) => {
  if (!guestInfo || !guestInfo.email || !guestInfo.firstName || !guestInfo.lastName) {
    throw new Error('Guest information (email, firstName, lastName) is required');
  }

  const billingAddress = guestInfo.billingAddress || {};
  if (!billingAddress.street || !billingAddress.city || !billingAddress.zipCode) {
    const error = new Error('Complete billing address (street, city, postal code) is required');
    error.missingFields = {
      street: !billingAddress.street,
      city: !billingAddress.city,
      zipCode: !billingAddress.zipCode
    };
    throw error;
  }

  const hasRepairOrders = Array.isArray(cartData?.repairOrders) && cartData.repairOrders.length > 0;
  const hasShopProducts = Array.isArray(cartData?.items) && cartData.items.length > 0;
  if (!hasRepairOrders && !hasShopProducts) {
    throw new Error('Cart is empty. Please add items before checkout.');
  }
};

const buildGuestPaypalPayload = async ({ cartData, guestInfo, currencyCode, sendBreakdown = true }) => {
  const Product = require('../models/Product');

  const lineItems = [];
  let total = 0;
  let tax = 0;
  const discount = 0;
  const shipping = 0;

  if (Array.isArray(cartData?.items)) {
    for (const item of cartData.items) {
      const quantity = Math.max(1, Number(item?.quantity || 1));
      const productId = item?.product?._id || item?.productId;
      if (!productId) continue;

      const product = await Product.findById(productId).lean();
      if (!product) continue;

      const unitAmount = sanitizeMoney(product.price || 0);
      if (unitAmount <= 0) continue;

      total += unitAmount * quantity;
      lineItems.push({
        name: String(product.name || 'Produkt').trim().slice(0, 127) || 'Produkt',
        quantity: String(quantity),
        unit_amount: {
          currency_code: currencyCode,
          value: formatMoney(unitAmount)
        }
      });
    }
  }

  if (Array.isArray(cartData?.repairOrders)) {
    for (const repairOrder of cartData.repairOrders) {
      const serviceIds = Array.isArray(repairOrder?.services)
        ? repairOrder.services.map((service) => service?._id || service).filter(Boolean)
        : [];

      const services = serviceIds.length
        ? await Service.find({ _id: { $in: serviceIds } }).lean()
        : [];

      let repairAmount = services.reduce((sum, service) => sum + sanitizeMoney(service.price || 0), 0);
      if (Array.isArray(repairOrder?.addOns)) {
        repairAmount += repairOrder.addOns.reduce((sum, addOn) => sum + sanitizeMoney(addOn?.price || 0), 0);
      }

      repairAmount = sanitizeMoney(repairAmount);
      if (repairAmount <= 0) continue;

      total += repairAmount;

      const label = [repairOrder?.deviceBrand, repairOrder?.deviceModel]
        .filter(Boolean)
        .join(' ')
        .trim()
        .slice(0, 127);

      lineItems.push({
        name: label || 'Reparaturauftrag',
        quantity: '1',
        unit_amount: {
          currency_code: currencyCode,
          value: formatMoney(repairAmount)
        }
      });
    }
  }

  if (lineItems.length === 0) {
    throw new Error('Cart is empty. Please add items before checkout.');
  }

  const amount = sendBreakdown
    ? {
        currency_code: currencyCode,
        value: formatMoney(total),
        breakdown: {
          item_total: {
            currency_code: currencyCode,
            value: formatMoney(total)
          },
          tax_total: {
            currency_code: currencyCode,
            value: formatMoney(tax)
          },
          shipping: {
            currency_code: currencyCode,
            value: formatMoney(shipping)
          },
          discount: {
            currency_code: currencyCode,
            value: formatMoney(discount)
          }
        }
      }
    : {
        currency_code: currencyCode,
        value: formatMoney(total)
      };

  return {
    lineItems,
    amount,
    total: sanitizeMoney(total),
    payerEmail: normalizeEmailAddress(guestInfo.email)
  };
};

const validateCheckoutAddress = (user) => {
  const invoiceAddress = user?.invoiceAddress || {};
  if (!invoiceAddress.street || !invoiceAddress.city || !invoiceAddress.zipCode) {
    const error = new Error('Please complete your invoice address in your profile before checkout. Street, city, and postal code are required for return label generation.');
    error.missingFields = {
      street: !invoiceAddress.street,
      city: !invoiceAddress.city,
      zipCode: !invoiceAddress.zipCode
    };
    throw error;
  }
};

// Description: Get PayPal public SDK configuration for checkout
// Endpoint: GET /api/checkout/paypal/config
// Response: { success: boolean, clientId, currency, intent, locale, button }
router.get('/paypal/config', requireUser, async (req, res) => {
  try {
    const gateway = await getActivePaypalGateway();
    const config = gateway.configuration || {};
    const useLive = config.environment === 'live';
    const clientId = useLive ? config.live_client_id : config.sandbox_client_id;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'PayPal client ID is not configured.'
      });
    }

    return res.json({
      success: true,
      clientId,
      currency: (config.default_currency || config.currency || 'EUR').toUpperCase(),
      intent: (config.payment_intent || 'CAPTURE').toUpperCase(),
      locale: config.locale || 'de-DE',
      environment: config.environment || 'sandbox',
      button: {
        enabled: config.button_enabled !== false,
        layout: config.button_layout || 'vertical',
        color: config.button_color || 'gold',
        shape: config.button_shape || 'rect',
        label: config.button_label || 'paypal'
      }
    });
  } catch (error) {
    console.error('CheckoutRoutes: Error loading PayPal config:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to load PayPal config.'
    });
  }
});

// Description: Get PayPal public SDK configuration for guest checkout
// Endpoint: GET /api/checkout/paypal/guest/config
// Response: { success: boolean, clientId, currency, intent, locale, button }
router.get('/paypal/guest/config', async (req, res) => {
  try {
    const gateway = await getActivePaypalGateway();
    const config = gateway.configuration || {};
    const useLive = config.environment === 'live';
    const clientId = useLive ? config.live_client_id : config.sandbox_client_id;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'PayPal client ID is not configured.'
      });
    }

    return res.json({
      success: true,
      clientId,
      currency: (config.default_currency || config.currency || 'EUR').toUpperCase(),
      intent: (config.payment_intent || 'CAPTURE').toUpperCase(),
      locale: config.locale || 'de-DE',
      environment: config.environment || 'sandbox',
      button: {
        enabled: config.button_enabled !== false,
        layout: config.button_layout || 'vertical',
        color: config.button_color || 'gold',
        shape: config.button_shape || 'rect',
        label: config.button_label || 'paypal'
      }
    });
  } catch (error) {
    console.error('CheckoutRoutes: Error loading guest PayPal config:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to load PayPal config.'
    });
  }
});

// Description: Create PayPal order for checkout cart
// Endpoint: POST /api/checkout/paypal/create-order
// Request: { returnPath?: string }
// Response: { success: boolean, orderId, amount, currency }
router.post('/paypal/create-order', requireUser, async (req, res) => {
  try {
    const user = await UserService.get(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    validateCheckoutAddress(user);

    const cart = await CartService.getCart(req.user._id);
    const hasRepairOrders = cart && Array.isArray(cart.repairOrders) && cart.repairOrders.length > 0;
    const hasShopProducts = cart && Array.isArray(cart.items) && cart.items.length > 0;

    if (!cart || (!hasRepairOrders && !hasShopProducts)) {
      return res.status(400).json({
        success: false,
        error: 'Cart is empty. Please add items before checkout.'
      });
    }

    const gateway = await getActivePaypalGateway();
    const config = gateway.configuration || {};
    const currencyCode = (config.default_currency || config.currency || 'EUR').toUpperCase();
    const lineItems = buildPaypalLineItems(cart, currencyCode);
    const amount = buildPaypalAmount(cart, lineItems, currencyCode, config.send_breakdown !== false);

    const { accessToken, baseUrl } = await getPaypalAccessToken(gateway);
    const frontendBase = getFrontendBaseUrl();
    const returnPath = String(req.body?.returnPath || '/checkout').trim();
    const safeReturnPath = returnPath.startsWith('/') ? returnPath : '/checkout';

    const paypalOrderResponse = await axios.post(
      `${baseUrl}/v2/checkout/orders`,
      {
        intent: (config.payment_intent || 'CAPTURE').toUpperCase(),
        purchase_units: [
          {
            reference_id: `checkout-${req.user._id}`,
            description: (config.description_template || 'FixitHub Bestellung').replace('{{orderId}}', String(cart._id || 'cart')),
            amount,
            items: lineItems,
            custom_id: String(req.user._id)
          }
        ],
        payer: {
          email_address: user.email
        },
        application_context: {
          brand_name: 'FixitHub',
          locale: config.locale || 'de-DE',
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING',
          return_url: `${frontendBase}${safeReturnPath}`,
          cancel_url: `${frontendBase}${safeReturnPath}`
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

    const customerName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;

    await Payment.create({
      customerId: req.user._id,
      customerName,
      orderNumber: '',
      amount: sanitizeMoney(cart.total),
      currency: currencyCode,
      paymentMethod: 'paypal',
      status: 'processing',
      transactionId: paypalOrderResponse.data.id,
      gatewayResponse: `PayPal order ${paypalOrderResponse.data.id} created`,
      metadata: {
        gatewayProvider: 'paypal',
        gatewayId: gateway._id,
        paypalOrderId: paypalOrderResponse.data.id,
        cartId: String(cart._id || ''),
        cartTotals: {
          subtotal: sanitizeMoney(cart.subtotal),
          tax: sanitizeMoney(cart.tax),
          discount: sanitizeMoney(cart.discount),
          total: sanitizeMoney(cart.total)
        },
        createdAt: new Date().toISOString()
      }
    });

    return res.status(201).json({
      success: true,
      orderId: paypalOrderResponse.data.id,
      amount: sanitizeMoney(cart.total),
      currency: currencyCode
    });
  } catch (error) {
    console.error('CheckoutRoutes: Error creating PayPal order:', error?.response?.data || error);
    const missingFields = error?.missingFields;
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to create PayPal order.',
      missingFields: missingFields || undefined
    });
  }
});

// Description: Create PayPal order for guest checkout cart
// Endpoint: POST /api/checkout/paypal/guest/create-order
// Request: { guestInfo, cartData, returnPath?: string }
// Response: { success: boolean, orderId, amount, currency }
router.post('/paypal/guest/create-order', async (req, res) => {
  try {
    const { guestInfo, cartData, returnPath } = req.body || {};
    validateGuestCheckoutPayload({ guestInfo, cartData });

    const gateway = await getActivePaypalGateway();
    const config = gateway.configuration || {};
    const currencyCode = (config.default_currency || config.currency || 'EUR').toUpperCase();
    const guestPayload = await buildGuestPaypalPayload({
      cartData,
      guestInfo,
      currencyCode,
      sendBreakdown: config.send_breakdown !== false
    });

    const { accessToken, baseUrl } = await getPaypalAccessToken(gateway);
    const frontendBase = getFrontendBaseUrl();
    const safeReturnPath = String(returnPath || '/checkout').trim().startsWith('/')
      ? String(returnPath || '/checkout').trim()
      : '/checkout';

    const paypalOrderResponse = await axios.post(
      `${baseUrl}/v2/checkout/orders`,
      {
        intent: (config.payment_intent || 'CAPTURE').toUpperCase(),
        purchase_units: [
          {
            reference_id: `guest-checkout-${Date.now()}`,
            description: 'FixitHub Gastbestellung',
            amount: guestPayload.amount,
            items: guestPayload.lineItems,
            custom_id: normalizeEmailAddress(guestInfo.email)
          }
        ],
        payer: {
          email_address: guestPayload.payerEmail,
          name: {
            given_name: String(guestInfo.firstName || '').trim(),
            surname: String(guestInfo.lastName || '').trim()
          }
        },
        application_context: {
          brand_name: 'FixitHub',
          locale: config.locale || 'de-DE',
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING',
          return_url: `${frontendBase}${safeReturnPath}`,
          cancel_url: `${frontendBase}${safeReturnPath}`
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

    const guestNameFull = [
      String(guestInfo.firstName || '').trim(),
      String(guestInfo.lastName || '').trim()
    ].filter(Boolean).join(' ') || guestPayload.payerEmail;

    await Payment.create({
      isGuest: true,
      guestEmail: guestPayload.payerEmail,
      guestName: guestNameFull,
      orderNumber: '',
      amount: guestPayload.total,
      currency: currencyCode,
      paymentMethod: 'paypal',
      status: 'processing',
      transactionId: paypalOrderResponse.data.id,
      gatewayResponse: `PayPal guest order ${paypalOrderResponse.data.id} created`,
      metadata: {
        gatewayProvider: 'paypal',
        gatewayId: String(gateway._id || ''),
        paypalOrderId: paypalOrderResponse.data.id,
        guestBillingAddress: guestInfo.billingAddress || {},
        cartSnapshot: {
          items: Array.isArray(cartData?.items) ? cartData.items.length : 0,
          repairOrders: Array.isArray(cartData?.repairOrders) ? cartData.repairOrders.length : 0,
          total: guestPayload.total
        },
        createdAt: new Date().toISOString()
      }
    });

    return res.status(201).json({
      success: true,
      orderId: paypalOrderResponse.data.id,
      amount: guestPayload.total,
      currency: currencyCode
    });
  } catch (error) {
    console.error('CheckoutRoutes: Error creating guest PayPal order:', error?.response?.data || error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to create guest PayPal order.',
      missingFields: error?.missingFields || undefined
    });
  }
});

// Description: Capture PayPal order after buyer approval
// Endpoint: POST /api/checkout/paypal/capture-order
// Request: { orderId }
// Response: { success: boolean, captureId, orderId, amount, currency, receipt }
router.post('/paypal/capture-order', requireUser, async (req, res) => {
  try {
    const { orderId } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'orderId is required.' });
    }

    const gateway = await getActivePaypalGateway();
    const { accessToken, baseUrl } = await getPaypalAccessToken(gateway);

    const pendingPayment = await Payment.findOne({
      customerId: req.user._id,
      transactionId: orderId,
      paymentMethod: 'paypal'
    });

    if (pendingPayment?.status === 'completed') {
      const details = pendingPayment.metadata?.providerDetails || {};
      return res.json({
        success: true,
        alreadyCaptured: true,
        orderId,
        captureId: details.captureId || '',
        amount: pendingPayment.amount,
        currency: pendingPayment.currency,
        receipt: {
          paymentId: pendingPayment._id,
          transactionId: pendingPayment.transactionId
        }
      });
    }

    const captureResponse = await axios.post(
      `${baseUrl}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const paypalOrder = captureResponse.data;
    if (paypalOrder.status !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        error: 'PayPal payment is not completed.'
      });
    }

    const capture = paypalOrder.purchase_units?.[0]?.payments?.captures?.[0] || {};
    const capturedAmount = sanitizeMoney(capture?.amount?.value || 0);
    const capturedCurrency = String(capture?.amount?.currency_code || gateway.configuration?.default_currency || 'EUR').toUpperCase();

    let payment = pendingPayment;
    if (!payment) {
      const user = await UserService.get(req.user._id);
      const customerName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.email || 'Customer';
      payment = await Payment.create({
        customerId: req.user._id,
        customerName,
        orderNumber: '',
        amount: capturedAmount,
        currency: capturedCurrency,
        paymentMethod: 'paypal',
        status: 'processing',
        transactionId: orderId,
        gatewayResponse: `PayPal order ${orderId} captured`,
        metadata: {}
      });
    }

    payment.status = 'completed';
    payment.processedAt = new Date();
    payment.gatewayResponse = `PayPal order ${orderId} captured successfully`;
    payment.amount = capturedAmount;
    payment.currency = capturedCurrency;
    payment.metadata = {
      ...(payment.metadata || {}),
      gatewayProvider: 'paypal',
      paypalOrderId: orderId,
      providerReference: capture?.id || orderId,
      providerDetails: {
        paypalOrderStatus: paypalOrder.status,
        captureId: capture?.id || '',
        payerId: paypalOrder?.payer?.payer_id || '',
        payerEmail: paypalOrder?.payer?.email_address || ''
      },
      capturedAt: new Date().toISOString()
    };
    await payment.save();

    return res.json({
      success: true,
      orderId,
      captureId: capture?.id || '',
      amount: capturedAmount,
      currency: capturedCurrency,
      receipt: {
        paymentId: payment._id,
        transactionId: payment.transactionId
      }
    });
  } catch (error) {
    console.error('CheckoutRoutes: Error capturing PayPal order:', error?.response?.data || error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to capture PayPal order.'
    });
  }
});

// Description: Capture guest PayPal order after buyer approval
// Endpoint: POST /api/checkout/paypal/guest/capture-order
// Request: { orderId, guestInfo }
// Response: { success: boolean, captureId, orderId, amount, currency, receipt }
router.post('/paypal/guest/capture-order', async (req, res) => {
  try {
    const { orderId, guestInfo } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'orderId is required.' });
    }

    if (!guestInfo || !guestInfo.email) {
      return res.status(400).json({ success: false, error: 'guestInfo.email is required.' });
    }

    const gateway = await getActivePaypalGateway();
    const { accessToken, baseUrl } = await getPaypalAccessToken(gateway);

    const captureResponse = await axios.post(
      `${baseUrl}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const paypalOrder = captureResponse.data;
    if (paypalOrder.status !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        error: 'PayPal payment is not completed.'
      });
    }

    const capture = paypalOrder.purchase_units?.[0]?.payments?.captures?.[0] || {};
    const capturedAmount = sanitizeMoney(capture?.amount?.value || 0);
    const capturedCurrency = String(capture?.amount?.currency_code || gateway.configuration?.default_currency || 'EUR').toUpperCase();
    const guestEmail = normalizeEmailAddress(guestInfo.email);

    let payment = await Payment.findOne({
      isGuest: true,
      transactionId: orderId,
      paymentMethod: 'paypal'
    });

    if (!payment) {
      const guestNameFull = [
        String(guestInfo.firstName || '').trim(),
        String(guestInfo.lastName || '').trim()
      ].filter(Boolean).join(' ') || guestEmail;

      payment = await Payment.create({
        isGuest: true,
        guestEmail,
        guestName: guestNameFull,
        orderNumber: '',
        amount: capturedAmount,
        currency: capturedCurrency,
        paymentMethod: 'paypal',
        status: 'processing',
        transactionId: orderId,
        gatewayResponse: `PayPal guest order ${orderId} captured (late create)`,
        metadata: {}
      });
    }

    payment.status = 'completed';
    payment.processedAt = new Date();
    payment.gatewayResponse = `PayPal guest order ${orderId} captured successfully`;
    payment.amount = capturedAmount;
    payment.currency = capturedCurrency;
    payment.metadata = {
      ...(payment.metadata || {}),
      gatewayProvider: 'paypal',
      paypalOrderId: orderId,
      providerReference: capture?.id || orderId,
      providerDetails: {
        paypalOrderStatus: paypalOrder.status,
        captureId: capture?.id || '',
        payerId: paypalOrder?.payer?.payer_id || '',
        payerEmail: paypalOrder?.payer?.email_address || guestEmail
      },
      capturedAt: new Date().toISOString()
    };
    await payment.save();

    return res.json({
      success: true,
      orderId,
      captureId: capture?.id || '',
      amount: capturedAmount,
      currency: capturedCurrency,
      receipt: {
        paymentId: payment._id,
        transactionId: payment.transactionId
      }
    });
  } catch (error) {
    const paypalErrorName = error?.response?.data?.name;
    if (paypalErrorName === 'UNPROCESSABLE_ENTITY') {
      try {
        const gateway = await getActivePaypalGateway();
        const { accessToken, baseUrl } = await getPaypalAccessToken(gateway);
        const orderId = req.body?.orderId;

        const orderResponse = await axios.get(`${baseUrl}/v2/checkout/orders/${orderId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });

        const order = orderResponse.data || {};
        const capture = order.purchase_units?.[0]?.payments?.captures?.[0] || {};
        if (order.status === 'COMPLETED' && capture?.id) {
          const alreadyCapturedAmount = sanitizeMoney(capture?.amount?.value || 0);
          const alreadyCapturedCurrency = String(capture?.amount?.currency_code || gateway.configuration?.default_currency || 'EUR').toUpperCase();
          const guestEmailFallback = normalizeEmailAddress(req.body?.guestInfo?.email || '');

          const existingPayment = await Payment.findOne({
            isGuest: true,
            transactionId: orderId,
            paymentMethod: 'paypal'
          });

          if (existingPayment && existingPayment.status !== 'completed') {
            existingPayment.status = 'completed';
            existingPayment.processedAt = existingPayment.processedAt || new Date();
            existingPayment.amount = alreadyCapturedAmount;
            existingPayment.currency = alreadyCapturedCurrency;
            existingPayment.metadata = {
              ...(existingPayment.metadata || {}),
              gatewayProvider: 'paypal',
              paypalOrderId: orderId,
              providerReference: capture.id,
              providerDetails: {
                paypalOrderStatus: order.status,
                captureId: capture.id,
                recoveredViaFallback: true
              },
              capturedAt: new Date().toISOString()
            };
            await existingPayment.save();
          }

          return res.json({
            success: true,
            alreadyCaptured: true,
            orderId,
            captureId: capture.id,
            amount: alreadyCapturedAmount,
            currency: alreadyCapturedCurrency,
            receipt: {
              paymentId: existingPayment?._id || '',
              transactionId: capture.id
            }
          });
        }
      } catch (fallbackError) {
        console.error('CheckoutRoutes: Guest PayPal fallback capture check failed:', fallbackError?.response?.data || fallbackError);
      }
    }

    console.error('CheckoutRoutes: Error capturing guest PayPal order:', error?.response?.data || error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to capture guest PayPal order.'
    });
  }
});

// Description: Handle PayPal webhook events for async status updates
// Endpoint: POST /api/checkout/paypal/webhook
// Request: PayPal webhook payload
// Response: { success: boolean }
router.post('/paypal/webhook', async (req, res) => {
  try {
    const gateway = await getActivePaypalGateway();
    const config = gateway.configuration || {};
    const webhookEvent = req.body || {};
    const eventType = webhookEvent.event_type || '';

    if (config.webhooks_enabled === false) {
      return res.status(202).json({ success: true, ignored: true, reason: 'webhooks_disabled' });
    }

    if (!eventType) {
      return res.status(400).json({ success: false, error: 'Missing webhook event_type.' });
    }

    const configuredEvents = Array.isArray(config.webhook_events)
      ? config.webhook_events.map((value) => String(value).trim()).filter(Boolean)
      : [];

    if (configuredEvents.length > 0 && !configuredEvents.includes(eventType)) {
      return res.status(202).json({ success: true, ignored: true, reason: 'event_not_configured' });
    }

    const verified = await verifyPaypalWebhookSignature({
      gateway,
      webhookEvent,
      headers: req.headers
    });

    if (!verified) {
      return res.status(401).json({ success: false, error: 'Webhook signature verification failed.' });
    }

    const supportedEvents = new Set([
      'CHECKOUT.ORDER.APPROVED',
      'PAYMENT.CAPTURE.PENDING',
      'PAYMENT.CAPTURE.COMPLETED',
      'PAYMENT.CAPTURE.DENIED',
      'PAYMENT.CAPTURE.DECLINED',
      'PAYMENT.CAPTURE.REFUNDED',
      'PAYMENT.CAPTURE.REVERSED'
    ]);

    if (!supportedEvents.has(eventType)) {
      return res.status(202).json({ success: true, ignored: true, reason: 'unsupported_event' });
    }

    const resource = webhookEvent.resource || {};
    const orderId = resource.supplementary_data?.related_ids?.order_id
      || resource.id
      || webhookEvent.resource?.id
      || '';
    const captureId = resource.id && eventType.startsWith('PAYMENT.CAPTURE') ? resource.id : '';

    const payment = await findPaymentByPaypalResource({ orderId, captureId });

    if (eventType === 'CHECKOUT.ORDER.APPROVED') {
      if (payment) {
        payment.status = payment.status === 'completed' ? 'completed' : 'processing';
        payment.gatewayResponse = `PayPal webhook approved order ${orderId || payment.transactionId}`;
        payment.metadata = {
          ...(payment.metadata || {}),
          gatewayProvider: 'paypal',
          paypalOrderId: orderId || payment.metadata?.paypalOrderId || payment.transactionId,
          providerDetails: {
            ...(payment.metadata?.providerDetails || {}),
            webhookEventType: eventType,
            webhookOrderStatus: resource.status || 'APPROVED',
            webhookUpdatedAt: new Date().toISOString()
          }
        };
        await payment.save();
      }

      return res.status(200).json({ success: true, acknowledged: true, eventType });
    }

    await applyPaypalWebhookUpdate({ payment, eventType, resource, orderId, captureId });

    return res.status(200).json({
      success: true,
      acknowledged: true,
      eventType,
      paymentUpdated: Boolean(payment)
    });
  } catch (error) {
    console.error('CheckoutRoutes: Error handling PayPal webhook:', error?.response?.data || error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to process PayPal webhook.'
    });
  }
});

// Description: Initialize checkout - validates user authentication and returns cart with user info
// Endpoint: POST /api/checkout/initialize
// Request: {}
// Response: { success: boolean, cart: Cart, userInfo: { firstName, lastName, email, phone, company, country, vatId, billingAddress, shippingAddress } }
router.post('/initialize', requireUser, async (req, res) => {
  try {
    console.log('CheckoutRoutes: Initializing checkout for user:', req.user._id);

    // Get user's cart
    const cart = await CartService.getCart(req.user._id);

    // Check if cart has items
    if (!cart || (cart.items.length === 0 && (!cart.repairOrders || cart.repairOrders.length === 0))) {
      console.log('CheckoutRoutes: Cart is empty');
      return res.status(400).json({
        success: false,
        error: 'Cart is empty. Please add items before checkout.'
      });
    }

    // Get user information
    const user = await UserService.get(req.user._id);

    if (!user) {
      console.log('CheckoutRoutes: User not found');
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Prepare user info for checkout
    const userInfo = {
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email,
      phone: user.phone || '',
      company: user.company || '',
      country: user.country || '',
      vatId: user.vatId || '',
      billingAddress: {
        street: user.invoiceAddress?.street || '',
        city: user.invoiceAddress?.city || '',
        state: user.invoiceAddress?.state || '',
        zipCode: user.invoiceAddress?.zipCode || '',
        country: user.invoiceAddress?.country || ''
      },
      shippingAddress: {
        street: user.paymentAddress?.sameAsInvoice ? user.invoiceAddress?.street : user.paymentAddress?.street || '',
        city: user.paymentAddress?.sameAsInvoice ? user.invoiceAddress?.city : user.paymentAddress?.city || '',
        state: user.paymentAddress?.sameAsInvoice ? user.invoiceAddress?.state : user.paymentAddress?.state || '',
        zipCode: user.paymentAddress?.sameAsInvoice ? user.invoiceAddress?.zipCode : user.paymentAddress?.zipCode || '',
        country: user.paymentAddress?.sameAsInvoice ? user.invoiceAddress?.country : user.paymentAddress?.country || ''
      }
    };

    console.log('CheckoutRoutes: Checkout initialized successfully');
    res.json({
      success: true,
      cart,
      userInfo
    });
  } catch (error) {
    console.error('CheckoutRoutes: Error initializing checkout:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Register guest user with extended profile during checkout
// Endpoint: POST /api/checkout/register
// Request: { email, password, firstName, lastName, phone, company, country, vatId, billingAddress: { street, city, state, zipCode, country }, shippingAddress: { street, city, state, zipCode, country } }
// Response: { success: boolean, message: string, user: User, accessToken: string, refreshToken: string }
router.post('/register', async (req, res) => {
  try {
    console.log('CheckoutRoutes: Guest registration during checkout');

    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      company,
      country,
      vatId,
      billingAddress,
      shippingAddress
    } = req.body;

    const normalizedEmail = normalizeEmailAddress(email);

    // Validate required fields
    if (!normalizedEmail || !password || !firstName || !lastName) {
      console.log('CheckoutRoutes: Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Email, password, first name, and last name are required'
      });
    }

    // Check if user already exists
    const existingUser = await UserService.getByEmail(normalizedEmail);
    if (existingUser) {
      console.log('CheckoutRoutes: User already exists:', normalizedEmail);
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists. Please login instead.'
      });
    }

    // Create user with extended profile
    const userData = {
      email: normalizedEmail,
      password,
      firstName,
      lastName,
      phone: phone || '',
      role: 'customer',
      company: company || '',
      country: country || '',
      vatId: vatId || '',
      invoiceAddress: {
        street: billingAddress?.street || '',
        city: billingAddress?.city || '',
        state: billingAddress?.state || '',
        zipCode: billingAddress?.zipCode || '',
        country: billingAddress?.country || ''
      },
      paymentAddress: {
        street: shippingAddress?.street || '',
        city: shippingAddress?.city || '',
        state: shippingAddress?.state || '',
        zipCode: shippingAddress?.zipCode || '',
        country: shippingAddress?.country || '',
        sameAsInvoice: false
      }
    };

    console.log('CheckoutRoutes: Creating new user:', normalizedEmail);
    const user = await UserService.create(userData);

    // Generate tokens for auto-login
    const { generateAccessToken, generateRefreshToken } = require('../utils/auth');
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Update user with refresh token
    user.refreshToken = refreshToken;
    await user.save();

    console.log('CheckoutRoutes: User created and logged in successfully:', email);

    res.json({
      success: true,
      message: 'Account created successfully',
      user: user.toObject(),
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('CheckoutRoutes: Error during guest registration:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Complete checkout - creates orders from cart repair orders and shop products, clears cart
// Endpoint: POST /api/checkout/complete
// Request: { paymentMethod?: string, paymentData?: object }
// Response: { success: boolean, message: string, orders: Order[], orderIds: string[] }
router.post('/complete', requireUser, async (req, res) => {
  try {
    console.log('CheckoutRoutes: Completing checkout for user:', req.user._id);

    const { paymentMethod, paymentData } = req.body;
    const isCapturedPaypalPayment = paymentMethod === 'paypal' && !!paymentData?.paypalCaptureId;
    const resolvedPaymentStatus = isCapturedPaypalPayment ? 'paid' : 'pending';
    const resolvedBillingStatus = isCapturedPaypalPayment ? 'paid' : 'unpaid';

    // Get user information to validate invoice address
    const user = await UserService.get(req.user._id);

    if (!user) {
      console.log('CheckoutRoutes: User not found');
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Validate invoice address - required for return label generation
    const invoiceAddress = user.invoiceAddress || {};
    console.log('CheckoutRoutes: Validating invoice address:', JSON.stringify(invoiceAddress, null, 2));

    if (!invoiceAddress.street || !invoiceAddress.city || !invoiceAddress.zipCode) {
      console.log('CheckoutRoutes: Incomplete invoice address');
      return res.status(400).json({
        success: false,
        error: 'Please complete your invoice address in your profile before checkout. Street, city, and postal code are required for return label generation.',
        missingFields: {
          street: !invoiceAddress.street,
          city: !invoiceAddress.city,
          zipCode: !invoiceAddress.zipCode
        }
      });
    }

    // Get user's cart
    const cart = await CartService.getCart(req.user._id);

    // Check if cart has any items (repair orders or shop products)
    const hasRepairOrders = cart && cart.repairOrders && cart.repairOrders.length > 0;
    const hasShopProducts = cart && cart.items && cart.items.length > 0;

    if (!cart || (!hasRepairOrders && !hasShopProducts)) {
      console.log('CheckoutRoutes: Cart is empty');
      return res.status(400).json({
        success: false,
        error: 'Cart is empty. Please add items before checkout.'
      });
    }

    console.log('CheckoutRoutes: Found', cart.repairOrders?.length || 0, 'repair orders and', cart.items?.length || 0, 'shop products in cart');

    // Helper function to parse estimated time string to minutes
    const parseEstimatedTime = (timeString) => {
      if (typeof timeString === 'number') {
        return timeString;
      }
      if (!timeString || typeof timeString !== 'string') {
        return 0;
      }

      // Extract the first number from the string (e.g., "2-3 hours" -> 2, "1 hour" -> 1)
      const match = timeString.match(/(\d+)/);
      if (!match) {
        return 0;
      }

      const value = parseInt(match[1], 10);

      // Convert to minutes if it contains "hour"
      if (timeString.toLowerCase().includes('hour')) {
        return value * 60;
      }

      // If it contains "minute" or no unit, assume minutes
      return value;
    };

    const createdOrders = [];
    const orderIds = [];

    // Create orders from repair orders in the cart
    if (hasRepairOrders) {
      for (const repairOrder of cart.repairOrders) {
        try {
          console.log('CheckoutRoutes: Creating order from repair order:', repairOrder);

          // Fetch service details to get price and estimated time
          const serviceDetails = await Service.find({ _id: { $in: repairOrder.services } });

          // Calculate total cost from services
          let totalCost = 0;
          const services = serviceDetails.map(service => {
            totalCost += service.price;
            return {
              serviceId: service._id,
              price: service.price,
              estimatedTime: parseEstimatedTime(service.estimatedTime),
              notes: ''
            };
          });

          // Add addOns to total cost if present
          if (repairOrder.addOns && repairOrder.addOns.length > 0) {
            repairOrder.addOns.forEach(addOn => {
              totalCost += addOn.price || 0;
            });
          }

          // Prepare order data matching the Order model schema
          const orderData = {
            customerId: req.user._id,
            deviceBrand: repairOrder.deviceBrand,
            deviceModel: repairOrder.deviceModel,
            deviceType: repairOrder.deviceType || 'Smartphone',
            services: services,
            addOns: repairOrder.addOns || [],
            customerNotes: repairOrder.customerNotes || '',
            photos: repairOrder.photos || [],
            totalCost: totalCost,
            status: 'pending',
            priority: 'normal',
            progress: 0,
            paymentStatus: resolvedPaymentStatus,
            estimatedCompletion: null,
            // Device unlock information from cart
            unlockPattern: repairOrder.unlockPattern || [],
            unlockCode: repairOrder.unlockCode || '',
            noLock: repairOrder.noLock || false,
            // Additional repair information from cart
            errorDescription: repairOrder.errorDescription || '',
            waterDamage: repairOrder.waterDamage || '',
            previousRepairAttempts: repairOrder.previousRepairAttempts || '',
            previousRepairDetails: repairOrder.previousRepairDetails || '',
            itemCondition: repairOrder.itemCondition || ''
          };

          console.log('CheckoutRoutes: Order data prepared:', orderData);

          // Create the order
          const order = await OrderService.create(orderData);
          console.log('CheckoutRoutes: Order created successfully:', order._id);

          createdOrders.push(order);
          orderIds.push(order._id.toString());
        } catch (orderError) {
          console.error('CheckoutRoutes: Error creating order from repair order:', orderError);
          // Continue with other orders even if one fails
        }
      }
    }

    // Create an order from shop products if present
    if (hasShopProducts && cart.items.length > 0) {
      try {
        console.log('CheckoutRoutes: Creating order from shop products');

        // Populate product details
        const Product = require('../models/Product');
        const populatedItems = [];
        let totalCost = 0;

        for (const item of cart.items) {
          const product = await Product.findById(item.productId);
          if (product) {
            const itemTotal = product.price * item.quantity;
            totalCost += itemTotal;
            populatedItems.push({
              productId: product._id,
              quantity: item.quantity,
              priceAtOrder: product.price,
              addedBy: req.user._id
            });
          }
        }

        // Create a shop product order with placeholder device info
        const shopOrderData = {
          customerId: req.user._id,
          deviceBrand: 'N/A',  // Placeholder for shop-only orders
          deviceModel: 'Shop Products Order',
          deviceType: 'Shop Products',
          services: [],  // Empty services array
          addOns: [],
          shopProducts: populatedItems,
          customerNotes: 'Order containing shop products only',
          photos: [],
          totalCost: totalCost,
          status: 'pending',
          priority: 'normal',
          progress: 0,
          paymentStatus: resolvedPaymentStatus,
          estimatedCompletion: null
        };

        console.log('CheckoutRoutes: Shop order data prepared:', shopOrderData);

        // Create the shop product order
        const shopOrder = await OrderService.create(shopOrderData);
        console.log('CheckoutRoutes: Shop product order created successfully:', shopOrder._id);

        createdOrders.push(shopOrder);
        orderIds.push(shopOrder._id.toString());
      } catch (shopOrderError) {
        console.error('CheckoutRoutes: Error creating shop product order:', shopOrderError);
        // Log but don't fail the entire checkout
      }
    }

    if (createdOrders.length === 0) {
      console.log('CheckoutRoutes: No orders were created');
      return res.status(500).json({
        success: false,
        error: 'Failed to create orders from cart. Please try again.'
      });
    }

    // Create booking to consolidate all orders
    console.log('CheckoutRoutes: Creating booking to consolidate', createdOrders.length, 'orders');
    let booking = null;
    try {
      const mongoose = require('mongoose');
      booking = await BookingService.create({
        customerId: req.user._id,
        orderIds: orderIds.map(id => new mongoose.Types.ObjectId(id)),
        discount: cart.discount || 0,
        appliedPromoCode: cart.promoCode || '',
        status: 'pending',
        billingStatus: resolvedBillingStatus,
        paymentStatus: resolvedPaymentStatus,
        paymentMethod: paymentMethod || '',
      });
      console.log('CheckoutRoutes: Booking created successfully:', booking._id);
    } catch (bookingError) {
      console.error('CheckoutRoutes: Error creating booking:', bookingError);
      // Don't fail checkout if booking creation fails - orders were created
      // This is a graceful degradation scenario
    }

    // Clear the cart after successful order creation
    try {
      cart.repairOrders = [];
      cart.items = [];
      await cart.save();
      console.log('CheckoutRoutes: Cart cleared successfully');
    } catch (clearError) {
      console.error('CheckoutRoutes: Error clearing cart:', clearError);
      // Don't fail the request if cart clearing fails - orders were created
    }

    // Create descriptive success message
    const repairOrderCount = hasRepairOrders ? (cart.repairOrders?.length || 0) : 0;
    const shopProductCount = hasShopProducts ? 1 : 0; // Shop products create 1 combined order
    const totalOrders = createdOrders.length;

    let successMessage = `Successfully created booking with ${totalOrders} order(s)`;
    if (repairOrderCount > 0 && shopProductCount > 0) {
      successMessage = `Successfully created booking with ${repairOrderCount} repair order(s) and 1 shop product order`;
    } else if (repairOrderCount > 0) {
      successMessage = `Successfully created booking with ${repairOrderCount} repair order(s)`;
    } else if (shopProductCount > 0) {
      successMessage = `Successfully created booking with shop product order`;
    }

    console.log('CheckoutRoutes: Checkout completed successfully. Created booking:', booking?._id);

    res.json({
      success: true,
      message: successMessage,
      booking: booking || { orderIds: orderIds },
      bookingId: booking?._id?.toString() || null,
      orders: createdOrders,
      orderIds: orderIds
    });
  } catch (error) {
    console.error('CheckoutRoutes: Error completing checkout:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Complete guest checkout - creates orders from guest cart data without authentication
// Endpoint: POST /api/checkout/guest-complete
// Request: { guestInfo: { email, firstName, lastName, billingAddress, shippingAddress }, cartData: { items, repairOrders }, paymentMethod?: string, paymentData?: object }
// Response: { success: boolean, message: string, orders: Order[], orderIds: string[] }
router.post('/guest-complete', async (req, res) => {
  try {
    console.log('CheckoutRoutes: Processing guest checkout');

    const { guestInfo, cartData, paymentMethod, paymentData } = req.body;
    const isCapturedPaypalPayment = paymentMethod === 'paypal' && !!paymentData?.paypalCaptureId;
    const resolvedPaymentStatus = isCapturedPaypalPayment ? 'paid' : 'pending';
    const resolvedBillingStatus = isCapturedPaypalPayment ? 'paid' : 'unpaid';

    // Validate guest information
    if (!guestInfo || !guestInfo.email || !guestInfo.firstName || !guestInfo.lastName) {
      console.log('CheckoutRoutes: Missing required guest information');
      return res.status(400).json({
        success: false,
        error: 'Guest information (email, firstName, lastName) is required'
      });
    }

    // Validate billing address
    const billingAddress = guestInfo.billingAddress || {};
    if (!billingAddress.street || !billingAddress.city || !billingAddress.zipCode) {
      console.log('CheckoutRoutes: Incomplete billing address');
      return res.status(400).json({
        success: false,
        error: 'Complete billing address (street, city, postal code) is required',
        missingFields: {
          street: !billingAddress.street,
          city: !billingAddress.city,
          zipCode: !billingAddress.zipCode
        }
      });
    }

    // Validate cart data
    if (!cartData || (!cartData.repairOrders || cartData.repairOrders.length === 0) && (!cartData.items || cartData.items.length === 0)) {
      console.log('CheckoutRoutes: Cart is empty');
      return res.status(400).json({
        success: false,
        error: 'Cart is empty. Please add items before checkout.'
      });
    }

    const hasRepairOrders = cartData.repairOrders && cartData.repairOrders.length > 0;
    const hasShopProducts = cartData.items && cartData.items.length > 0;

    console.log('CheckoutRoutes: Found', cartData.repairOrders?.length || 0, 'repair orders and', cartData.items?.length || 0, 'shop products in guest cart');

    // Create a temporary guest user ID for orders (using email as identifier)
    const guestUserId = `guest_${Buffer.from(guestInfo.email).toString('base64')}_${Date.now()}`;

    // Store guest information in a way that can be retrieved
    const guestUserData = {
      email: guestInfo.email,
      firstName: guestInfo.firstName,
      lastName: guestInfo.lastName,
      phone: guestInfo.phone || '',
      isGuest: true,
      billingAddress: billingAddress,
      shippingAddress: guestInfo.shippingAddress || billingAddress
    };

    // Helper function to parse estimated time string to minutes
    const parseEstimatedTime = (timeString) => {
      if (typeof timeString === 'number') {
        return timeString;
      }
      if (!timeString || typeof timeString !== 'string') {
        return 0;
      }

      const match = timeString.match(/(\d+)/);
      if (!match) {
        return 0;
      }

      const value = parseInt(match[1], 10);

      if (timeString.toLowerCase().includes('hour')) {
        return value * 60;
      }

      return value;
    };

    const createdOrders = [];
    const orderIds = [];

    // Create orders from repair orders in the guest cart
    if (hasRepairOrders) {
      for (const repairOrder of cartData.repairOrders) {
        try {
          console.log('CheckoutRoutes: Creating order from guest repair order:', repairOrder);

          // Fetch service details to get price and estimated time
          const serviceDetails = await Service.find({ _id: { $in: repairOrder.services.map(s => s._id || s) } });

          // Calculate total cost from services
          let totalCost = 0;
          const services = serviceDetails.map(service => {
            totalCost += service.price;
            return {
              serviceId: service._id,
              price: service.price,
              estimatedTime: parseEstimatedTime(service.estimatedTime),
              notes: ''
            };
          });

          // Add addOns to total cost if present
          if (repairOrder.addOns && repairOrder.addOns.length > 0) {
            repairOrder.addOns.forEach(addOn => {
              totalCost += addOn.price || 0;
            });
          }

          // Prepare order data with guest information
          const orderData = {
            customerId: null, // No user ID for guest orders
            guestInfo: guestUserData, // Store guest information with the order
            deviceBrand: repairOrder.deviceBrand,
            deviceModel: repairOrder.deviceModel,
            deviceType: repairOrder.deviceType || 'Smartphone',
            services: services,
            addOns: repairOrder.addOns || [],
            customerNotes: repairOrder.customerNotes || '',
            photos: repairOrder.photos || [],
            totalCost: totalCost,
            status: 'pending',
            priority: 'normal',
            progress: 0,
            paymentStatus: resolvedPaymentStatus,
            estimatedCompletion: null,
            unlockPattern: repairOrder.unlockPattern || [],
            unlockCode: repairOrder.unlockCode || '',
            noLock: repairOrder.noLock || false,
            errorDescription: repairOrder.errorDescription || '',
            waterDamage: repairOrder.waterDamage || '',
            previousRepairAttempts: repairOrder.previousRepairAttempts || '',
            previousRepairDetails: repairOrder.previousRepairDetails || '',
            itemCondition: repairOrder.itemCondition || ''
          };

          console.log('CheckoutRoutes: Guest order data prepared:', orderData);

          // Create the order
          const order = await OrderService.create(orderData);
          console.log('CheckoutRoutes: Guest order created successfully:', order._id);

          createdOrders.push(order);
          orderIds.push(order._id.toString());
        } catch (orderError) {
          console.error('CheckoutRoutes: Error creating guest order from repair order:', orderError);
          // Continue with other orders even if one fails
        }
      }
    }

    // Create an order from shop products if present
    if (hasShopProducts && cartData.items.length > 0) {
      try {
        console.log('CheckoutRoutes: Creating order from guest shop products');

        const Product = require('../models/Product');
        const populatedItems = [];
        let totalCost = 0;

        for (const item of cartData.items) {
          const productId = item.product?._id || item.productId;
          const product = await Product.findById(productId);
          if (product) {
            const itemTotal = product.price * item.quantity;
            totalCost += itemTotal;
            populatedItems.push({
              productId: product._id,
              quantity: item.quantity,
              priceAtOrder: product.price
            });
          }
        }

        // Create a shop product order for guest
        const shopOrderData = {
          customerId: null,
          guestInfo: guestUserData,
          deviceBrand: 'N/A',
          deviceModel: 'Shop Products Order',
          deviceType: 'Shop Products',
          services: [],
          addOns: [],
          shopProducts: populatedItems,
          customerNotes: 'Order containing shop products only',
          photos: [],
          totalCost: totalCost,
          status: 'pending',
          priority: 'normal',
          progress: 0,
          paymentStatus: resolvedPaymentStatus,
          estimatedCompletion: null
        };

        console.log('CheckoutRoutes: Guest shop order data prepared:', shopOrderData);

        const shopOrder = await OrderService.create(shopOrderData);
        console.log('CheckoutRoutes: Guest shop product order created successfully:', shopOrder._id);

        createdOrders.push(shopOrder);
        orderIds.push(shopOrder._id.toString());
      } catch (shopOrderError) {
        console.error('CheckoutRoutes: Error creating guest shop product order:', shopOrderError);
      }
    }

    if (createdOrders.length === 0) {
      console.log('CheckoutRoutes: No guest orders were created');
      return res.status(500).json({
        success: false,
        error: 'Failed to create orders from cart. Please try again.'
      });
    }

    // Create booking to consolidate all guest orders
    console.log('CheckoutRoutes: Creating booking for guest orders:', createdOrders.length);
    let booking = null;
    try {
      const mongoose = require('mongoose');
      booking = await BookingService.create({
        customerId: null,
        guestInfo: guestUserData,
        orderIds: orderIds.map(id => new mongoose.Types.ObjectId(id)),
        discount: 0,
        appliedPromoCode: '',
        status: 'pending',
        billingStatus: resolvedBillingStatus,
        paymentStatus: resolvedPaymentStatus,
        paymentMethod: paymentMethod || '',
      });
      console.log('CheckoutRoutes: Guest booking created successfully:', booking._id);
    } catch (bookingError) {
      console.error('CheckoutRoutes: Error creating guest booking:', bookingError);
    }

    // Create success message
    const totalOrders = createdOrders.length;
    let successMessage = `Successfully created ${totalOrders} order(s) for guest checkout`;

    console.log('CheckoutRoutes: Guest checkout completed successfully');

    // Send guest booking confirmation email with booking tracking link
    try {
      const totalAmount = createdOrders.reduce((sum, order) => sum + order.totalCost, 0);

      const bookingToken = booking?.guestTrackingToken || null;
      const bookingTrackingPath = bookingToken
        ? `/track-order/booking?token=${encodeURIComponent(bookingToken)}&email=${encodeURIComponent(guestInfo.email)}`
        : '/track-order/booking';

      const itemSummaryParts = await Promise.all(createdOrders.map(async (order, index) => {
        if (order.deviceType === 'Shop Products') {
          return `<strong>Position ${index + 1}: Produktbestellung</strong><br />Auftrag: ${order.orderNumber} (${order.status || 'pending'})`;
        }

        const deviceBrand = String(order.deviceBrand || '').trim();
        const deviceModel = String(order.deviceModel || '').trim();
        const modelImageUrl = await EmailService.resolveDeviceModelImageUrl({ deviceBrand, deviceModel });
        const deviceVisual = EmailService.buildDeviceModelVisualHtml({ deviceBrand, deviceModel, imageUrl: modelImageUrl });

        return `
          <div style="border:1px solid #d8dce6;border-radius:14px;padding:12px 14px;background:#ffffff;">
            <div style="font-size:14px;font-weight:700;color:#1a2a5e;margin-bottom:10px;">Position ${index + 1}: Reparatur</div>
            <div style="margin-bottom:10px;">${deviceVisual}</div>
            <div style="font-size:13px;line-height:1.6;color:#2d3748;word-break:break-word;overflow-wrap:anywhere;">
              <div><strong>Auftrag:</strong> ${order.orderNumber} (${order.status || 'pending'})</div>
            </div>
          </div>
        `.trim();
      }));

      const itemSummary = `${createdOrders.length} Position(en)<br /><br />${itemSummaryParts.join('<br /><br />')}`;

      console.log('CheckoutRoutes: Sending guest booking tracking email');
      const firstRepairOrder = createdOrders.find((order) => order.deviceType !== 'Shop Products');

      // Build PDF attachment from base64 data URL if available
      const emailOptions = {};
      if (booking?.shippingLabelUrl) {
        const base64Match = booking.shippingLabelUrl.match(/^data:application\/pdf;base64,(.+)$/);
        if (base64Match) {
          emailOptions.attachments = [{
            filename: `versandlabel-${booking.bookingNumber || booking._id}.pdf`,
            content: Buffer.from(base64Match[1], 'base64'),
            contentType: 'application/pdf'
          }];
        }
      }

      let emailResult = await EmailService.sendTriggerEmail('guest_booking_created', guestInfo.email, {
        companyName: process.env.COMPANY_NAME || 'McRepair.de',
        customerName: `${guestInfo.firstName} ${guestInfo.lastName}`,
        bookingNumber: booking?.bookingNumber || 'N/A',
        bookingDate: new Date(booking?.createdAt || Date.now()).toLocaleDateString('de-DE'),
        itemSummary,
        totalAmount: `€${Number(totalAmount || 0).toFixed(2)}`,
        bookingStatus: booking?.status || 'pending',
        deviceBrand: firstRepairOrder?.deviceBrand || '',
        deviceModel: firstRepairOrder?.deviceModel || '',
        trackingUrl: bookingTrackingPath,
        bookingUrl: bookingTrackingPath,
        shippingLabelUrl: booking?.shippingLabelUrl ? bookingTrackingPath : '',
        supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
        supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
      }, emailOptions);

      if (emailResult.success) {
        console.log('CheckoutRoutes: Guest booking tracking email sent successfully');
      } else {
        console.warn('CheckoutRoutes: Failed to send guest booking tracking email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('CheckoutRoutes: Error sending guest booking tracking email:', emailError);
      // Don't fail the checkout if email fails
    }

    res.json({
      success: true,
      message: successMessage,
      booking: booking || { orderIds: orderIds },
      bookingId: booking?._id?.toString() || null,
      bookingTrackingToken: booking?.guestTrackingToken || null,
      orders: createdOrders,
      orderIds: orderIds,
      guestEmail: guestInfo.email,
      trackingToken: createdOrders[0]?.guestTrackingToken || null
    });
  } catch (error) {
    console.error('CheckoutRoutes: Error completing guest checkout:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
