const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireUser } = require('./middleware/auth');
// Endpunkte ohne Anmeldung (Gast-Checkout, PayPal-Gast, Konto im Checkout, Mail erneut senden)
// sind je Client-IP/E-Mail begrenzt - Werte und Begruendung in middleware/guestAccess.js.
const { guestCreateLimits, guestPaymentLimit, resendVerificationLimits } = require('./middleware/guestAccess');
const CartService = require('../services/cartService');
const UserService = require('../services/userService');
const OrderService = require('../services/orderService');
const BookingService = require('../services/bookingService');
const EmailService = require('../services/emailService');
const FinancialService = require('../services/financialService');
const Service = require('../models/Service');
const Payment = require('../models/Payment');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const normalizeEmailAddress = (email) => String(email || '').trim().toLowerCase();

// Distributes a cart-level discount across the individual orders created from that cart,
// proportional to each order's raw (pre-discount) total. This keeps the order total
// consistent with what the customer saw in the cart/booking summary, instead of the
// order silently reverting to the undiscounted price.
const allocateProportionalAmount = (rawAmounts, totalAmount) => {
  const grandTotal = rawAmounts.reduce((sum, amount) => sum + Number(amount || 0), 0);
  const safeTotal = Math.max(0, Math.min(Number(totalAmount || 0), grandTotal));

  if (grandTotal <= 0 || safeTotal <= 0) {
    return rawAmounts.map(() => 0);
  }

  const shares = rawAmounts.map((amount) => Number(((Number(amount || 0) / grandTotal) * safeTotal).toFixed(2)));
  const allocated = shares.reduce((sum, share) => sum + share, 0);
  const roundingDiff = Number((safeTotal - allocated).toFixed(2));

  if (roundingDiff !== 0 && shares.length > 0) {
    // Assign any rounding remainder to the largest order to minimize relative impact
    let largestIndex = 0;
    for (let i = 1; i < rawAmounts.length; i++) {
      if (Number(rawAmounts[i] || 0) > Number(rawAmounts[largestIndex] || 0)) largestIndex = i;
    }
    shares[largestIndex] = Number((shares[largestIndex] + roundingDiff).toFixed(2));
  }

  return shares;
};

const linkCheckoutPayment = async ({ paymentMethod, paymentData = {}, booking, orders = [], customerId = null, guestInfo = null }) => {
  if (!booking || String(paymentMethod || '').toLowerCase() !== 'paypal') return null;

  const paypalOrderId = String(paymentData.paypalOrderId || '').trim();
  const paypalCaptureId = String(paymentData.paypalCaptureId || '').trim();
  const paymentLookup = [
    paypalOrderId ? { transactionId: paypalOrderId } : null,
    paypalOrderId ? { 'metadata.paypalOrderId': paypalOrderId } : null,
    paypalCaptureId ? { transactionId: paypalCaptureId } : null,
    paypalCaptureId ? { 'metadata.providerReference': paypalCaptureId } : null,
    paypalCaptureId ? { 'metadata.providerDetails.captureId': paypalCaptureId } : null,
  ].filter(Boolean);

  let payment = paymentLookup.length > 0
    ? await Payment.findOne({
      $or: paymentLookup,
      ...(customerId ? { customerId } : { isGuest: true, guestEmail: normalizeEmailAddress(guestInfo?.email) }),
    })
    : null;

  if (!payment) return null;
  // Eine bereits einer ANDEREN Buchung zugeordnete Zahlung wird nie umgehaengt (z. B.
  // Wiederholung eines Checkouts mit fremdem Idempotenzschluessel).
  if (payment.bookingId && String(payment.bookingId) !== String(booking._id)) {
    console.warn('CheckoutRoutes: Payment already linked to another booking, not relinked:', String(payment._id));
    return null;
  }

  payment.bookingId = booking._id;
  // orderId bleibt der erste Auftrag des Warenkorbs (Rueckwaertskompatibilitaet fuer
  // auftragsbezogene Leser). Die VOLLSTAENDIGE Zuordnung steht in
  // metadata.checkoutOrderIds; auftragsbezogene Auswertungen muessen zusaetzlich
  // ueber bookingId lesen, sonst faellt bei einem Warenkorb mit mehreren Auftraegen
  // der gesamte Umsatz auf orders[0].
  payment.orderId = orders[0]?._id;
  payment.orderNumber = orders[0]?.orderNumber || '';
  payment.metadata = {
    ...(payment.metadata || {}),
    checkoutBookingId: String(booking._id),
    checkoutOrderIds: orders.map((order) => String(order._id)),
    linkedAt: new Date().toISOString(),
  };
  await payment.save();

  // Existiert zu dieser Buchung bereits eine offene Rechnung, wird die Vorauszahlung
  // SOFORT zugeordnet - nicht erst beim naechsten Rechnungslauf. Bewusst nicht fatal:
  // die Zahlung ist erfasst, eine fehlgeschlagene Zuordnung darf den Checkout nicht
  // abbrechen. Der Aufruf ist idempotent.
  await autoAllocateBookingPayments(booking._id, 'linkCheckoutPayment');

  return payment;
};

/**
 * Ordnet eingegangene Zahlungen einer Buchung den offenen Rechnungen zu.
 * Mehrfachaufrufe sind unschaedlich (siehe FinancialService.autoAllocateUnallocatedPayments):
 * bereits zugeordnete Betraege werden abgezogen, die Buchung laeuft ueber ein
 * bedingtes Update auf der Zahlung.
 */
const autoAllocateBookingPayments = async (bookingId, context) => {
  if (!bookingId) return;
  try {
    await FinancialService.autoAllocateUnallocatedPayments(String(bookingId));
  } catch (error) {
    console.error(`CheckoutRoutes: auto allocation failed (${context}):`, error.message);
  }
};

/**
 * Wird eine Zahlung ERST NACH der Rechnungsstellung abgeschlossen (verspaeteter
 * Webhook, nachtraegliche Capture-Bestaetigung), muss die Zuordnung ebenfalls laufen.
 * Ohne diesen Aufruf bliebe das Geld unzugeordnet und die Rechnung mahnbar.
 */
const allocateAfterPaymentCompleted = async (payment, context) => {
  if (!payment) return;
  const bookingId = payment.bookingId
    || payment.metadata?.checkoutBookingId
    || null;
  if (!bookingId) return;
  await autoAllocateBookingPayments(bookingId, context);
};

const normalizeCheckoutAddress = (address) => {
  const normalized = {
    street: String(address?.street || '').trim(),
    city: String(address?.city || '').trim(),
    state: String(address?.state || '').trim(),
    zipCode: String(address?.zipCode || address?.postalCode || '').trim(),
    country: String(address?.country || '').trim(),
  };

  const cityLooksLikePostalCode = /^\d{4,10}$/.test(normalized.city);
  const zipLooksLikeCity = /[A-Za-zÄÖÜäöüß]/.test(normalized.zipCode);

  // Guard against browser autofill swapping city and postal code.
  if (cityLooksLikePostalCode && zipLooksLikeCity) {
    const originalCity = normalized.city;
    normalized.city = normalized.zipCode;
    normalized.zipCode = originalCity;
  }

  return normalized;
};

const buildCheckoutVerificationUrl = async (user) => {
  const verificationToken = jwt.sign(
    { userId: user._id, email: user.email },
    process.env.JWT_SECRET || 'default_secret',
    { expiresIn: '7d' }
  );

  const verificationBaseUrl = await EmailService.buildSystemUrl('/verify-email');
  const redirectPath = encodeURIComponent('/cart?checkout=1');
  return `${verificationBaseUrl}?token=${verificationToken}&redirect=${redirectPath}&source=checkout`;
};

const sendCheckoutVerificationEmail = async (user) => {
  const verificationUrl = await buildCheckoutVerificationUrl(user);
  return EmailService.sendRegistrationEmail(
    user.email,
    user.firstName || 'Valued Customer',
    verificationUrl
  );
};

const sanitizeMoney = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Number(numeric.toFixed(2));
};

const formatMoney = (value) => sanitizeMoney(value).toFixed(2);

const extractPaypalApiError = (error) => {
  const data = error?.response?.data;
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  const details = Array.isArray(data.details)
    ? data.details.map((detail) => ({
        issue: detail?.issue,
        description: detail?.description,
        field: detail?.field,
        value: detail?.value
      }))
    : undefined;

  return {
    name: data.name,
    message: data.message,
    debugId: data.debug_id,
    details: details && details.length > 0 ? details : undefined
  };
};

const getFrontendBaseUrl = () => process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';

const roundCurrency = (value) => Number(Number(value || 0).toFixed(2));

const normalizeAllowedPaymentMethods = (methods) => {
  if (!Array.isArray(methods)) return [];
  const normalized = methods
    .map((method) => String(method || '').trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(normalized));
};

const checkoutMethodAliases = {
  card: ['credit_card', 'debit_card', 'stripe'],
  paypal: ['paypal'],
  invoice: ['invoice', 'bank_transfer'],
};

const DEFAULT_ALLOWED_CHECKOUT_METHODS = normalizeAllowedPaymentMethods([
  'credit_card',
  'debit_card',
  'stripe',
  'paypal',
]);

const loadAllowedCheckoutMethodsForUser = async (userId) => {
  const userWithGroup = await User.findById(userId)
    .populate('customerGroupIds', 'status financeProfile.allowedPaymentMethods')
    .populate('primaryCustomerGroupId', 'financeProfile.allowedPaymentMethods')
    .select('primaryCustomerGroupId customerGroupIds')
    .lean();

  const activeAssignedGroups = Array.isArray(userWithGroup?.customerGroupIds)
    ? userWithGroup.customerGroupIds.filter((group) => String(group?.status || '').toLowerCase() === 'active')
    : [];

  const assignedGroupMethods = normalizeAllowedPaymentMethods(
    activeAssignedGroups.flatMap((group) => group?.financeProfile?.allowedPaymentMethods || [])
  );

  if (assignedGroupMethods.length > 0) {
    return assignedGroupMethods;
  }

  const primaryGroupMethods = normalizeAllowedPaymentMethods(
    userWithGroup?.primaryCustomerGroupId?.financeProfile?.allowedPaymentMethods
  );

  if (primaryGroupMethods.length > 0) {
    return primaryGroupMethods;
  }

  return DEFAULT_ALLOWED_CHECKOUT_METHODS;
};

const isCheckoutPaymentMethodAllowed = ({ paymentMethod, allowedMethods }) => {
  if (!paymentMethod) return true;
  if (!Array.isArray(allowedMethods) || allowedMethods.length === 0) return true;

  const normalizedMethod = String(paymentMethod).trim().toLowerCase();
  const aliases = checkoutMethodAliases[normalizedMethod] || [normalizedMethod];
  return aliases.some((alias) => allowedMethods.includes(alias));
};

const buildCheckoutPricing = async ({ cart, userId }) => {
  const pricing = await CartService.buildPricing({ cart, userId });
  const financialProfile = await FinancialService.resolveFinancialProfile({ customerId: userId });

  return {
    ...pricing,
    taxAmount: pricing.tax,
    payableTotal: pricing.total,
    paymentDueDays: Number(financialProfile?.paymentDueDays || 0),
    paymentTerms: financialProfile?.paymentTerms || '',
    cashDiscountPercent: Number(financialProfile?.cashDiscountPercent || 0),
    cashDiscountDays: Number(financialProfile?.cashDiscountDays || 0),
    creditLimit: Number(financialProfile?.creditLimit || 0),
  };
};

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

/**
 * CAPTURE-Ereignisse (COMPLETED/PENDING/DENIED/DECLINED) auf die Zahlung anwenden.
 *
 * Erstattungen (PAYMENT.CAPTURE.REFUNDED/REVERSED) laufen hier NICHT durch, sondern
 * ueber PaypalService.handleRefundWebhook (siehe Route): dort ist die Ressource die
 * REFUND-Ressource, die Buchung ist kumulativ und ueber die Refund-ID idempotent.
 * Frueher setzte dieser Weg bei JEDER Teilerstattung status='refunded' und
 * refundAmount = Betrag dieser einen Erstattung und ueberschrieb die Capture-Referenz
 * mit der Refund-ID.
 *
 * Webhooks kommen wiederholt und in beliebiger Reihenfolge: der Zielstatus kommt aus
 * PaypalService.resolveCaptureWebhookStatus (ein spaetes PENDING/COMPLETED stuft eine
 * abgeschlossene oder erstattete Zahlung nicht um), und der Betrag einer bereits
 * abgeschlossenen Zahlung wird nicht ueberschrieben.
 */
const applyPaypalWebhookUpdate = async ({ payment, eventType, resource, orderId, captureId }) => {
  if (!payment) return null;
  const PaypalService = require('../services/paypalService');

  const resourceAmount = resource?.amount || {};
  const amountValue = Number(resourceAmount.value || 0);
  const previousStatus = payment.status;
  const nextStatus = PaypalService.resolveCaptureWebhookStatus(previousStatus, eventType);

  const providerDetails = {
    ...(payment.metadata?.providerDetails || {}),
    webhookEventType: eventType,
    webhookResourceStatus: resource?.status || '',
    webhookCaptureId: captureId || '',
    webhookOrderId: orderId || '',
    webhookUpdatedAt: new Date().toISOString()
  };

  if (nextStatus) {
    payment.status = nextStatus;
    const reference = captureId || orderId || payment.transactionId;
    if (nextStatus === 'completed') {
      payment.processedAt = payment.processedAt || new Date();
      // Nur eine noch nicht abgeschlossene Zahlung uebernimmt den Capture-Betrag.
      if (Number.isFinite(amountValue) && amountValue > 0) payment.amount = amountValue;
      payment.gatewayResponse = `PayPal webhook completed capture ${reference}`;
    } else if (nextStatus === 'processing') {
      payment.gatewayResponse = `PayPal webhook pending capture ${reference}`;
    } else if (nextStatus === 'failed') {
      payment.gatewayResponse = `PayPal webhook denied capture ${reference}`;
    }
  }

  payment.metadata = {
    ...(payment.metadata || {}),
    gatewayProvider: 'paypal',
    paypalOrderId: orderId || payment.metadata?.paypalOrderId || '',
    // Nur CAPTURE-Ereignisse kommen hier an: resource.id ist die Capture-ID und damit
    // die richtige Referenz fuer spaetere Erstattungen.
    providerReference: captureId || payment.metadata?.providerReference || payment.transactionId,
    providerDetails: {
      ...providerDetails,
      captureId: providerDetails.captureId || captureId || undefined,
    }
  };

  await payment.save();

  // Verspaetete Statusaenderung (Webhook trifft nach der Rechnungsstellung ein):
  // Zuordnung nachziehen.
  if (payment.status === 'completed' && previousStatus !== 'completed') {
    await allocateAfterPaymentCompleted(payment, 'paypalWebhook');
  }

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
      name: 'McRepair.de Bestellung',
      quantity: '1',
      unit_amount: {
        currency_code: currencyCode,
        value: formatMoney(fallbackAmount)
      }
    });
  }

  return lineItems;
};

const buildPaypalAmount = (cart, lineItems, currencyCode, sendBreakdown = true, options = {}) => {
  const itemTotal = sanitizeMoney(
    lineItems.reduce((sum, item) => sum + Number(item.unit_amount?.value || 0) * Number(item.quantity || 1), 0)
  );
  const discount = sanitizeMoney(cart?.discount || 0);
  const noShipping = String(options?.shippingPreference || 'NO_SHIPPING').toUpperCase() === 'NO_SHIPPING';

  const fallbackTotal = sanitizeMoney(cart?.total || 0);
  let shipping = 0;

  if (!noShipping) {
    shipping = sanitizeMoney(Math.max(0, fallbackTotal - itemTotal + discount));
  }

  const total = sanitizeMoney(itemTotal + shipping - discount);

  if (!sendBreakdown) {
    return {
      currency_code: currencyCode,
      value: formatMoney(total)
    };
  }

  const breakdown = {
    item_total: {
      currency_code: currencyCode,
      value: formatMoney(itemTotal)
    },
    ...(noShipping ? {} : {
      shipping: {
        currency_code: currencyCode,
        value: formatMoney(shipping)
      }
    }),
    ...(discount > 0 ? {
      discount: {
        currency_code: currencyCode,
        value: formatMoney(discount)
      }
    } : {})
  };

  return {
    currency_code: currencyCode,
    value: formatMoney(total),
    breakdown
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
      // Betrag aus dem Katalog (dieselbe Grundlage wie der Gast-Checkout), keine Client-Preise
      // fuer Zusatzleistungen; unbekannte Leistung/Zusatzleistung wirft einen 400-Fehler.
      const catalog = await CartService.resolveRepairOrderCatalog({
        services: repairOrder?.services,
        addOns: repairOrder?.addOns,
      });
      let repairAmount = sanitizeMoney(catalog.rawTotal);
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
          ...(shipping > 0 ? {
            shipping: {
              currency_code: currencyCode,
              value: formatMoney(shipping)
            }
          } : {}),
          ...(discount > 0 ? {
            discount: {
              currency_code: currencyCode,
              value: formatMoney(discount)
            }
          } : {})
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

    const allowedMethods = await loadAllowedCheckoutMethodsForUser(req.user._id);
    if (!isCheckoutPaymentMethodAllowed({ paymentMethod: 'paypal', allowedMethods })) {
      return res.status(403).json({
        success: false,
        error: 'PayPal ist für Ihre Kundengruppe nicht freigegeben.'
      });
    }

    const cart = await CartService.getCart(req.user._id);
    const hasRepairOrders = cart && Array.isArray(cart.repairOrders) && cart.repairOrders.length > 0;
    const hasShopProducts = cart && Array.isArray(cart.items) && cart.items.length > 0;

    if (!cart || (!hasRepairOrders && !hasShopProducts)) {
      return res.status(400).json({
        success: false,
        error: 'Cart is empty. Please add items before checkout.'
      });
    }

    const checkoutPricing = await buildCheckoutPricing({ cart, userId: req.user._id });

    const gateway = await getActivePaypalGateway();
    const config = gateway.configuration || {};
    const currencyCode = String(checkoutPricing.currency || config.default_currency || config.currency || 'EUR').toUpperCase();
    const lineItems = buildPaypalLineItems(cart, currencyCode);
    const discountedTotal = sanitizeMoney(checkoutPricing.payableTotal);
    const hasGroupDiscount = Number(checkoutPricing.groupDiscountAmount || 0) > 0;
    const amount = {
      currency_code: currencyCode,
      value: formatMoney(discountedTotal)
    };

    const { accessToken, baseUrl } = await getPaypalAccessToken(gateway);
    const frontendBase = getFrontendBaseUrl();
    const returnPath = String(req.body?.returnPath || '/checkout').trim();
    const safeReturnPath = returnPath.startsWith('/') ? returnPath : '/checkout';

    const purchaseUnit = {
      reference_id: `checkout-${req.user._id}`,
      description: (config.description_template || 'McRepair.de Bestellung').replace('{{orderId}}', String(cart._id || 'cart')),
      amount,
      custom_id: String(req.user._id)
    };

    if (!hasGroupDiscount && config.send_breakdown !== false) {
      const lineItemsTotal = sanitizeMoney(
        lineItems.reduce((sum, item) => sum + Number(item.unit_amount?.value || 0) * Number(item.quantity || 1), 0)
      );
      const paypalDiscount = sanitizeMoney(Math.max(0, lineItemsTotal - discountedTotal));
      purchaseUnit.amount = {
        currency_code: currencyCode,
        value: formatMoney(discountedTotal),
        breakdown: {
          item_total: {
            currency_code: currencyCode,
            value: formatMoney(lineItemsTotal)
          },
          ...(paypalDiscount > 0 ? {
            discount: {
              currency_code: currencyCode,
              value: formatMoney(paypalDiscount)
            }
          } : {})
        }
      };
      purchaseUnit.items = lineItems;
    }

    const paypalOrderResponse = await axios.post(
      `${baseUrl}/v2/checkout/orders`,
      {
        intent: (config.payment_intent || 'CAPTURE').toUpperCase(),
        purchase_units: [
          purchaseUnit
        ],
        payer: {
          email_address: user.email
        },
        application_context: {
          brand_name: 'McRepair.de',
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
      amount: discountedTotal,
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
        checkoutPricing,
        createdAt: new Date().toISOString()
      }
    });

    return res.status(201).json({
      success: true,
      orderId: paypalOrderResponse.data.id,
      amount: discountedTotal,
      currency: currencyCode
    });
  } catch (error) {
    console.error('CheckoutRoutes: Error creating PayPal order:', error?.response?.data || error);
    const missingFields = error?.missingFields;
    const paypalError = extractPaypalApiError(error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to create PayPal order.',
      missingFields: missingFields || undefined,
      paypalError
    });
  }
});

// Description: Create PayPal order for guest checkout cart
// Endpoint: POST /api/checkout/paypal/guest/create-order
// Request: { guestInfo, cartData, returnPath?: string }
// Response: { success: boolean, orderId, amount, currency }
router.post('/paypal/guest/create-order', guestPaymentLimit, async (req, res) => {
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
            description: 'McRepair.de Gastbestellung',
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
          brand_name: 'McRepair.de',
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
    const paypalError = extractPaypalApiError(error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to create guest PayPal order.',
      missingFields: error?.missingFields || undefined,
      paypalError
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
    await allocateAfterPaymentCompleted(payment, 'paypalCapture');

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
router.post('/paypal/guest/capture-order', guestPaymentLimit, async (req, res) => {
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
    await allocateAfterPaymentCompleted(payment, 'paypalGuestCapture');

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
            await allocateAfterPaymentCompleted(existingPayment, 'paypalGuestReconcile');
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

    // Erstattung/Rueckbuchung: die Ressource ist die REFUND-Ressource (id = Refund-ID,
    // Capture im Link rel="up"). Kumulativ und idempotent ueber die Refund-ID -
    // schliesst auch eine ausstehende oder ungeklaerte App-Erstattung genau einmal ab.
    if (eventType === 'PAYMENT.CAPTURE.REFUNDED' || eventType === 'PAYMENT.CAPTURE.REVERSED') {
      const PaypalService = require('../services/paypalService');
      const refundResult = await PaypalService.handleRefundWebhook(eventType, resource);
      return res.status(200).json({
        success: true,
        acknowledged: true,
        eventType,
        paymentUpdated: Boolean(refundResult?.applied),
        duplicate: Boolean(refundResult?.duplicate),
        ...(refundResult?.reason ? { reason: refundResult.reason } : {}),
      });
    }

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
  const allowedPaymentMethods = await loadAllowedCheckoutMethodsForUser(req.user._id);
  const checkoutPricing = await buildCheckoutPricing({ cart, userId: req.user._id });


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
        country: user.paymentAddress?.sameAsInvoice ? user.invoiceAddress?.country : user.paymentAddress?.country || '',
        sameAsInvoice: user.paymentAddress?.sameAsInvoice !== false,
        deliveryType: user.paymentAddress?.deliveryType || 'address',
        packstationNumber: user.paymentAddress?.packstationNumber || '',
        postNumber: user.paymentAddress?.postNumber || ''
      }
    };

    console.log('CheckoutRoutes: Checkout initialized successfully');
    res.json({
      success: true,
      cart,
      userInfo,
      availablePaymentMethods: allowedPaymentMethods,
      checkoutPricing
    });
  } catch (error) {
    console.error('CheckoutRoutes: Error initializing checkout:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Register guest user with extended profile during checkout and send verification email
// Endpoint: POST /api/checkout/register
// Request: { email, password, firstName, lastName, phone, company, country, vatId, billingAddress: { street, city, state, zipCode, country }, shippingAddress: { street, city, state, zipCode, country } }
// Response: { success: boolean, message: string, user: User, requiresEmailVerification: boolean }
router.post('/register', ...guestCreateLimits, async (req, res) => {
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
    const normalizedBillingAddress = normalizeCheckoutAddress(billingAddress);
    const normalizedShippingAddress = normalizeCheckoutAddress(shippingAddress);

    // Validate required fields
    if (!normalizedEmail || !password || !firstName || !lastName) {
      console.log('CheckoutRoutes: Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Email, password, first name, and last name are required'
      });
    }

    let user;

    // Check if user already exists
    const existingUser = await UserService.getByEmail(normalizedEmail);
    if (existingUser) {
      const canReuseInactiveCustomer =
        existingUser.role === 'customer' &&
        existingUser.status === 'inactive' &&
        existingUser.isActive === false;

      if (!canReuseInactiveCustomer) {
        console.log('CheckoutRoutes: User already exists and cannot be reused:', normalizedEmail);
        return res.status(400).json({
          success: false,
          error: 'User with this email already exists. Please login instead.'
        });
      }

      existingUser.firstName = firstName || '';
      existingUser.lastName = lastName || '';
      existingUser.name = `${firstName || ''} ${lastName || ''}`.trim();
      existingUser.phone = phone || '';
      existingUser.company = company || '';
      existingUser.country = country || '';
      existingUser.vatId = vatId || '';
      existingUser.invoiceAddress = {
        ...normalizedBillingAddress
      };
      existingUser.paymentAddress = {
        ...normalizedShippingAddress,
        sameAsInvoice: false
      };
      existingUser.status = 'inactive';
      existingUser.isActive = false;
      existingUser.refreshToken = null;
      existingUser.passwordResetToken = null;
      existingUser.passwordResetExpires = null;

      user = await UserService.setPassword(existingUser, password);
      console.log('CheckoutRoutes: Reused inactive customer account for checkout:', normalizedEmail);
    }

    if (!user) {
      // Create user with extended profile
      const userData = {
        email: normalizedEmail,
        password,
        firstName,
        lastName,
        phone: phone || '',
        role: 'customer',
        status: 'inactive',
        isActive: false,
        company: company || '',
        country: country || '',
        vatId: vatId || '',
        invoiceAddress: normalizedBillingAddress,
        paymentAddress: {
          ...normalizedShippingAddress,
          sameAsInvoice: false
        }
      };

      console.log('CheckoutRoutes: Creating new checkout user:', normalizedEmail);
      user = await UserService.create(userData);
    }

    try {
      const emailResult = await sendCheckoutVerificationEmail(user);

      if (emailResult.success) {
        console.log('CheckoutRoutes: Verification email sent successfully to:', user.email);
      } else {
        console.error('CheckoutRoutes: Failed to send verification email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('CheckoutRoutes: Error sending verification email:', emailError.message);
    }

    console.log('CheckoutRoutes: Checkout account registration completed (verification required):', email);

    res.json({
      success: true,
      message: 'Account registration successful. Please verify your email to continue checkout.',
      user: user.toObject(),
      requiresEmailVerification: true
    });
  } catch (error) {
    console.error('CheckoutRoutes: Error during guest registration:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ---------------------------------------------------------------------------
// Gemeinsame Helfer fuer /complete und /guest-complete (DHL-1, DHL-6, DHL-11, DHL-14)
// ---------------------------------------------------------------------------

// Idempotenzschluessel je Bezahlversuch (vom Client erzeugt, bis zum Erfolg im
// sessionStorage gehalten). Nur ein unverfaelschter, kurzer Token wird akzeptiert.
const sanitizeCheckoutAttemptId = (value) => {
  const text = String(value || '').trim();
  return /^[A-Za-z0-9_-]{8,80}$/.test(text) ? text : '';
};

// Buchung fuer die Checkout-Antwort OHNE Base64-PDFs (Einsendelabel/Retoure/QR). Die Seite
// /order-success laedt den Einsendestatus selbst (GET /api/bookings/:id/inbound-label bzw.
// Gast-Sendungsverfolgung); das PDF gehoert nicht in sessionStorage.
// Positivliste (K04): kein Verlauf (kann interne Fehlertexte enthalten), keine Gast-/Kundendaten,
// keine Labels. Der Client braucht nur Nummer, Betrag und Status.
const CHECKOUT_BOOKING_FIELDS = [
  '_id', 'bookingNumber', 'status', 'billingStatus', 'paymentStatus', 'paymentMethod',
  'totalCost', 'subtotal', 'tax', 'discount', 'currency', 'orderIds', 'items',
  'shippingStatus', 'trackingNumber', 'createdAt', 'updatedAt',
];
const toCheckoutBookingPayload = (booking, orderIds = []) => {
  if (!booking) return { orderIds };
  const plain = typeof booking.toObject === 'function' ? booking.toObject() : { ...booking };
  const payload = {};
  CHECKOUT_BOOKING_FIELDS.forEach((field) => {
    if (plain[field] !== undefined) payload[field] = plain[field];
  });
  return { ...payload, hasShippingLabel: Boolean(String(plain.shippingLabelUrl || '').trim()) };
};

// Hat die Rechnungs-/Absenderadresse eine Hausnummer? Das DHL-Einsendelabel (Kunde ist
// Absender) braucht Strasse UND Hausnummer; ohne sie scheitert das Label nach der Buchung.
// Dieselbe Zerlegung wie beim Buchungs-Einsendelabel (BookingService.buildBookingShipmentData),
// damit der Checkout nichts durchlaesst, woran das Label danach scheitert.
const addressHasHouseNumber = (address = {}) => {
  const parts = BookingService.splitStreetAndHouse(String(address.street || ''));
  // Nur die Felder, die buildBookingShipmentData auch liest (Strasse + `number`).
  return Boolean(String(parts.house || '').trim() || String(address.number || '').trim());
};
const HOUSE_NUMBER_REQUIRED_MESSAGE = 'Bitte ergänzen Sie die Hausnummer in Ihrer Rechnungsadresse – sie wird für das DHL-Einsendelabel benötigt.';

const describeCheckoutSuccess = ({ repairCount, hasShopOrder }) => {
  const repairText = repairCount === 1 ? '1 Reparaturauftrag' : `${repairCount} Reparaturaufträgen`;
  if (repairCount > 0 && hasShopOrder) return `Ihre Buchung mit ${repairText} und einer Shop-Bestellung wurde angelegt.`;
  if (repairCount > 0) return `Ihre Buchung mit ${repairText} wurde angelegt.`;
  if (hasShopOrder) return 'Ihre Shop-Bestellung wurde angelegt.';
  return 'Ihre Buchung wurde angelegt.';
};

// Wiederholter Abschluss mit demselben Idempotenzschluessel: dieselbe Buchung zurueckgeben,
// nichts neu anlegen (kein zweiter Auftrag, kein zweites DHL-Label, keine zweite Mail).
// K04: die Wiederholung liest Auftraege, die das Team inzwischen bearbeitet haben kann
// (interne Notizen, Ersatzteile, Workflows). Deshalb nur diese Positivliste.
const REPEATED_CHECKOUT_ORDER_FIELDS = '_id orderNumber deviceBrand deviceModel deviceType status totalCost guestTrackingToken';
// Felder der Buchung fuer die Idempotenz-Suche (nie Labels/Verlauf laden).
const CHECKOUT_ATTEMPT_BOOKING_SELECT = `${CHECKOUT_BOOKING_FIELDS.join(' ')} customerId guestInfo.email guestTrackingToken checkoutAttemptId`;

const buildRepeatedCheckoutResponse = async (booking, {
  guest = false,
  guestEmail = '',
  paymentMethod = '',
  paymentData = null,
  customerId = null,
  guestInfo = null,
} = {}) => {
  const Order = require('../models/Order');
  const Booking = require('../models/Booking');
  const loaded = await Order.find({ _id: { $in: booking.orderIds || [] } })
    .setOptions({ skipAutoPopulate: true })
    .select(REPEATED_CHECKOUT_ORDER_FIELDS)
    .lean();
  // Reihenfolge der Buchung beibehalten (orders[0] = erster Auftrag wie beim ersten Abschluss).
  const position = new Map((booking.orderIds || []).map((id, index) => [String(id), index]));
  loaded.sort((a, b) => (position.get(String(a._id)) ?? 0) - (position.get(String(b._id)) ?? 0));

  // Wiederholung NACH einer (neuen) PayPal-Erfassung: die Zahlung muss an der vorhandenen
  // Buchung haengen, sonst bliebe sie unzugeordnet (Kunde sieht Erfolg, Geld ohne Buchung).
  // linkCheckoutPayment ist idempotent und haengt nie eine fremd zugeordnete Zahlung um;
  // eine Doppelzahlung erscheint in der Zahlungsuebersicht als "Überzahlt / Erstattung offen".
  if (String(paymentMethod || '').toLowerCase() === 'paypal' && paymentData?.paypalCaptureId) {
    try {
      await linkCheckoutPayment({ paymentMethod, paymentData, booking, orders: loaded, customerId, guestInfo });
    } catch (paymentLinkError) {
      console.error('CheckoutRoutes: Error linking repeated checkout payment to booking:', paymentLinkError);
    }
  }

  const orders = loaded.map(({ guestTrackingToken, ...order }) => order);
  const orderIds = orders.map((order) => String(order._id));
  const hasShippingLabel = Boolean(await Booking.exists({ _id: booking._id, shippingLabelUrl: { $nin: ['', null] } }));
  return {
    success: true,
    alreadyCompleted: true,
    message: 'Ihre Buchung wurde bereits angelegt.',
    booking: { ...toCheckoutBookingPayload(booking, orderIds), hasShippingLabel },
    bookingId: String(booking._id),
    bookingNumber: booking.bookingNumber || '',
    orders,
    orderIds,
    ...(guest ? {
      bookingTrackingToken: booking.guestTrackingToken || null,
      guestEmail,
      trackingToken: loaded[0]?.guestTrackingToken || null,
    } : {}),
  };
};

// ---------------------------------------------------------------------------
// Atomarer Anspruch auf den Idempotenzschluessel (DHL-14), BEVOR Auftraege entstehen.
// Frueher wurde der Schluessel erst beim Speichern der Buchung erzwungen: zwei gleichzeitige
// Anfragen legten beide Auftraege an, die Auftraege der zweiten blieben ohne Buchung.
// Ein Dokument je (Kunde bzw. Gast-E-Mail, Schluessel) mit eindeutiger _id; ein verwaister
// Anspruch (Prozessabbruch) darf nach CHECKOUT_ATTEMPT_CLAIM_STALE_MS uebernommen werden.
// Erfolgreiche Ansprueche bleiben bestehen (TTL raeumt sie nach 7 Tagen ab; danach schuetzt
// der eindeutige Index Booking.checkoutAttemptId).
// ---------------------------------------------------------------------------
const CHECKOUT_ATTEMPT_CLAIM_STALE_MS = 2 * 60 * 1000;
const CHECKOUT_ATTEMPT_WAIT_MS = 20 * 1000;
const CHECKOUT_ATTEMPT_POLL_MS = 300;
let checkoutAttemptIndexReady = null;
const checkoutAttemptClaims = () => {
  const collection = require('mongoose').connection.collection('checkoutattemptclaims');
  if (!checkoutAttemptIndexReady) {
    checkoutAttemptIndexReady = collection
      .createIndex({ claimedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60, name: 'claimedAt_ttl' })
      .catch((indexError) => {
        checkoutAttemptIndexReady = null;
        console.error('CheckoutRoutes: Could not ensure checkout attempt TTL index:', indexError.message);
      });
  }
  return collection;
};

const claimCheckoutAttempt = async (scope, checkoutAttemptId) => {
  const collection = checkoutAttemptClaims();
  const _id = `${scope}|${checkoutAttemptId}`;
  const claimedAt = new Date();
  try {
    await collection.insertOne({ _id, claimedAt });
  } catch (claimError) {
    if (claimError?.code !== 11000) throw claimError;
    const takeover = await collection.updateOne(
      { _id, claimedAt: { $lt: new Date(claimedAt.getTime() - CHECKOUT_ATTEMPT_CLAIM_STALE_MS) } },
      { $set: { claimedAt } }
    );
    if (!takeover?.modifiedCount) return null;
  }
  return {
    keep: false,
    release: () => collection.deleteOne({ _id, claimedAt }).catch((releaseError) => {
      console.error('CheckoutRoutes: Could not release checkout attempt claim:', releaseError.message);
    }),
  };
};

/**
 * Anspruch holen oder auf die parallele Anfrage mit demselben Schluessel warten.
 * Ergebnis: { claim } (diese Anfrage legt an) | { existing } (Buchung der anderen Anfrage)
 *           | { busy: true } (andere Anfrage laeuft noch nach CHECKOUT_ATTEMPT_WAIT_MS).
 */
const acquireCheckoutAttempt = async ({ scope, checkoutAttemptId, findExisting }) => {
  const deadline = Date.now() + CHECKOUT_ATTEMPT_WAIT_MS;
  for (;;) {
    const claim = await claimCheckoutAttempt(scope, checkoutAttemptId);
    if (claim) {
      // Uebernommener (verwaister) Anspruch: die Buchung kann trotzdem schon existieren.
      const existing = await findExisting();
      if (existing) {
        await claim.release();
        return { existing };
      }
      return { claim };
    }
    const existing = await findExisting();
    if (existing) return { existing };
    if (Date.now() >= deadline) return { busy: true };
    await new Promise((resolve) => setTimeout(resolve, CHECKOUT_ATTEMPT_POLL_MS));
  }
};

const CHECKOUT_IN_PROGRESS_RESPONSE = {
  success: false,
  code: 'CHECKOUT_IN_PROGRESS',
  error: 'Ihre Bestellung wird gerade angelegt. Bitte nicht erneut bezahlen – prüfen Sie in einem Moment Ihre Buchungen.',
};

// Rueckfall, falls trotz Anspruch (z. B. nach Ablauf eines verwaisten Anspruchs) eine andere
// Anfrage dieselbe Buchung gespeichert hat: die soeben angelegten, noch keiner Buchung
// zugeordneten Auftraege DIESER Anfrage entfernen, statt Doppelauftraege zu hinterlassen.
const discardUnbookedOrdersOfRequest = async (orderIds = []) => {
  if (!orderIds.length) return;
  try {
    const Order = require('../models/Order');
    const result = await Order.deleteMany({
      _id: { $in: orderIds },
      $or: [{ bookingId: null }, { bookingId: { $exists: false } }],
    });
    console.warn('CheckoutRoutes: Discarded unbooked orders of a repeated checkout request:', orderIds, result?.deletedCount);
  } catch (discardError) {
    console.error('CheckoutRoutes: Could not discard unbooked orders of a repeated checkout request:', orderIds, discardError.message);
  }
};

// Der Schluessel gehoert bereits einer ANDEREN Buchung (fremder Kunde/andere E-Mail - praktisch
// nur bei Manipulation): die Auftraege dieser Anfrage existieren schon, also die Buchung ohne
// Schluessel anlegen statt Auftraege ohne Buchung zurueckzulassen.
const createBookingWithoutAttemptKey = async (bookingCreateData) => {
  if (!bookingCreateData) return null;
  try {
    const { checkoutAttemptId: _ignored, ...withoutKey } = bookingCreateData;
    return await BookingService.create(withoutKey);
  } catch (retryError) {
    console.error('CheckoutRoutes: Error creating booking without attempt key:', retryError);
    return null;
  }
};

// Description: Complete checkout - creates orders from cart repair orders and shop products, clears cart
// Endpoint: POST /api/checkout/complete
// Request: { paymentMethod?: string, paymentData?: object }
// Response: { success: boolean, message: string, orders: Order[], orderIds: string[] }
router.post('/complete', requireUser, async (req, res) => {
  // Anspruch auf den Idempotenzschluessel (DHL-14); wird freigegeben, solange noch kein
  // Auftrag angelegt wurde (Validierungsfehler -> derselbe Versuch darf erneut senden).
  let attemptClaim = null;
  try {
    console.log('CheckoutRoutes: Completing checkout for user:', req.user._id);

    const { paymentMethod, paymentData } = req.body;
    const isCapturedPaypalPayment = paymentMethod === 'paypal' && !!paymentData?.paypalCaptureId;
    const resolvedPaymentStatus = isCapturedPaypalPayment ? 'paid' : 'pending';
    const resolvedBillingStatus = isCapturedPaypalPayment ? 'paid' : 'unpaid';

    // Get user information to validate invoice address
    const user = await UserService.get(req.user._id);
    const allowedMethods = await loadAllowedCheckoutMethodsForUser(req.user._id);
    if (!isCheckoutPaymentMethodAllowed({ paymentMethod, allowedMethods })) {
      return res.status(403).json({
        success: false,
        error: 'Die gewählte Zahlungsart ist für Ihre Kundengruppe nicht freigegeben.'
      });
    }

    if (!user) {
      console.log('CheckoutRoutes: User not found');
      return res.status(404).json({
        success: false,
        error: 'Das Kundenkonto wurde nicht gefunden.'
      });
    }

    // Idempotenz (DHL-14): derselbe Bezahlversuch nach verlorener Antwort -> dieselbe Buchung.
    const checkoutAttemptId = sanitizeCheckoutAttemptId(req.body?.checkoutAttemptId);
    const findAttemptBooking = async () => {
      if (!checkoutAttemptId) return null;
      const Booking = require('../models/Booking');
      return Booking.findOne({ checkoutAttemptId, customerId: req.user._id })
        .setOptions({ skipAutoPopulate: true })
        .select(CHECKOUT_ATTEMPT_BOOKING_SELECT)
        .lean();
    };
    const repeatedOptions = { paymentMethod, paymentData, customerId: req.user._id };
    if (checkoutAttemptId) {
      const existingBooking = await findAttemptBooking();
      if (existingBooking) {
        console.log('CheckoutRoutes: Repeated checkout attempt, returning existing booking:', existingBooking._id);
        return res.json(await buildRepeatedCheckoutResponse(existingBooking, repeatedOptions));
      }
      const acquired = await acquireCheckoutAttempt({
        scope: `customer:${req.user._id}`,
        checkoutAttemptId,
        findExisting: findAttemptBooking,
      });
      if (acquired.existing) {
        console.log('CheckoutRoutes: Parallel repeated checkout attempt, returning booking of the other request:', acquired.existing._id);
        return res.json(await buildRepeatedCheckoutResponse(acquired.existing, repeatedOptions));
      }
      if (acquired.busy) return res.status(409).json(CHECKOUT_IN_PROGRESS_RESPONSE);
      attemptClaim = acquired.claim;
    }

    // Validate invoice address - required for return label generation
    const invoiceAddress = user.invoiceAddress || {};
    console.log('CheckoutRoutes: Validating invoice address:', JSON.stringify(invoiceAddress, null, 2));

    if (!invoiceAddress.street || !invoiceAddress.city || !invoiceAddress.zipCode) {
      console.log('CheckoutRoutes: Incomplete invoice address');
      return res.status(400).json({
        success: false,
        error: 'Bitte vervollständigen Sie Ihre Rechnungsadresse (Straße mit Hausnummer, PLZ, Ort) – sie wird für das DHL-Einsendelabel benötigt.',
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
        code: 'CART_EMPTY',
        error: 'Ihr Warenkorb ist leer. Falls Sie gerade bezahlt haben, prüfen Sie bitte Ihre Buchungen – Ihre Bestellung wurde möglicherweise bereits angelegt.'
      });
    }

    // Reparaturen bekommen ein DHL-Einsendelabel mit dem Kunden als Absender: ohne Hausnummer
    // scheitert es NACH der Buchung (DHL-6). Deshalb hier vor dem Anlegen pruefen.
    if (hasRepairOrders && !addressHasHouseNumber(invoiceAddress)) {
      return res.status(400).json({
        success: false,
        code: 'HOUSE_NUMBER_REQUIRED',
        error: HOUSE_NUMBER_REQUIRED_MESSAGE,
        missingFields: { houseNumber: true }
      });
    }

    console.log('CheckoutRoutes: Found', cart.repairOrders?.length || 0, 'repair orders and', cart.items?.length || 0, 'shop products in cart');

    // Preisgrundlage = KATALOG (dieselbe, aus der unten die Auftraege entstehen), nie der im
    // Warenkorb gespeicherte Betrag: sonst konnten doppelte Leistungs-IDs oder frei gewaehlte
    // Zusatzleistungspreise die Rabattbasis aufblaehen (Auftraege 0,00 €) und Buchungsbetrag
    // und Auftragssumme auseinanderlaufen. Unbekannte Leistung/Zusatzleistung -> 400, bevor
    // irgendetwas angelegt wird.
    const repairCatalogs = [];
    if (hasRepairOrders) {
      try {
        for (const repairOrder of cart.repairOrders) {
          repairCatalogs.push(await CartService.resolveRepairOrderCatalog({
            services: repairOrder.services,
            addOns: repairOrder.addOns,
          }));
        }
      } catch (catalogError) {
        return res.status(catalogError.status === 400 ? 400 : 500).json({
          success: false,
          code: catalogError.code || 'CART_CATALOG_INVALID',
          error: catalogError.message || 'Der Warenkorb konnte nicht geprüft werden.'
        });
      }
    }
    const serverSubtotal = Number((
      repairCatalogs.reduce((sum, catalog) => sum + catalog.rawTotal, 0)
      + (hasShopProducts ? CartService.calculateCartSubtotal({ items: cart.items, repairOrders: [] }) : 0)
    ).toFixed(2));

    let appliedPromoData = null;
    if (String(cart.promoCode || '').trim()) {
      try {
        const promoSubtotal = serverSubtotal;
        appliedPromoData = await CartService.resolvePromoCodeForCheckout({
          promoCode: cart.promoCode,
          subtotal: promoSubtotal,
          customerId: req.user._id,
        });
      } catch (promoError) {
        return res.status(400).json({
          success: false,
          error: promoError.message || 'Invalid promo code'
        });
      }

      if (appliedPromoData) {
        cart.promoCode = appliedPromoData.promo.code;
        cart.promoCodeId = appliedPromoData.promo._id;
        cart.discountType = appliedPromoData.discountType;
        cart.discountValue = appliedPromoData.discountValue;
        cart.discount = appliedPromoData.discountAmount;
        await cart.save();
      }
    }

    const checkoutPricing = await buildCheckoutPricing({
      cart: { subtotal: serverSubtotal, discount: cart.discount, items: [], repairOrders: [] },
      userId: req.user._id,
    });
    const isInvoiceCheckout = String(paymentMethod || '').toLowerCase() === 'invoice';
    if (isInvoiceCheckout && Number(checkoutPricing.creditLimit || 0) > 0 && Number(checkoutPricing.payableTotal || 0) > Number(checkoutPricing.creditLimit || 0)) {
      return res.status(400).json({
        success: false,
        error: `Kreditlimit überschritten. Offener Betrag: ${checkoutPricing.payableTotal.toFixed(2)} ${checkoutPricing.currency}, Limit: ${Number(checkoutPricing.creditLimit).toFixed(2)} ${checkoutPricing.currency}`
      });
    }

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

    // Resolve a single shipping address that should be persisted on every order
    // created in this checkout. Prefer paymentAddress (delivery), fall back to
    // invoiceAddress. Without this the order detail and admin views show empty
    // shipping fields and DHL only has the populate fallback to rely on.
    const fallbackAddress = (() => {
      const payment = user.paymentAddress || {};
      const invoice = user.invoiceAddress || {};
      const isPackstation = payment.deliveryType === 'packstation' && payment.packstationNumber;
      const useInvoice = !isPackstation && (payment.sameAsInvoice || !payment.street);
      const source = useInvoice ? invoice : payment;
      return {
        street: isPackstation ? '' : (source.street || invoice.street || ''),
        city: isPackstation ? (payment.city || invoice.city || '') : (source.city || invoice.city || ''),
        state: isPackstation ? '' : (source.state || invoice.state || ''),
        zipCode: isPackstation ? (payment.zipCode || invoice.zipCode || '') : (source.zipCode || invoice.zipCode || ''),
        country: isPackstation ? (payment.country || invoice.country || '') : (source.country || invoice.country || ''),
        deliveryType: payment.deliveryType || 'address',
        packstationNumber: payment.packstationNumber || '',
        postNumber: payment.postNumber || '',
      };
    })();
    console.log('CheckoutRoutes: Resolved shippingAddress for orders:', fallbackAddress);

    // Build order specs first (without persisting) so the cart-level discount can be
    // allocated proportionally across all orders before any order is created.
    const orderSpecs = [];

    // Prepare orders from repair orders in the cart
    if (hasRepairOrders) {
      for (let repairIndex = 0; repairIndex < cart.repairOrders.length; repairIndex++) {
        const repairOrder = cart.repairOrders[repairIndex];
        try {
          console.log('CheckoutRoutes: Preparing order from repair order:', repairOrder);

          // Leistungen und Zusatzleistungen aus dem oben aufgeloesten Katalog (dedupliziert,
          // Katalogpreise) - dieselbe Grundlage wie serverSubtotal / checkoutPricing.
          const catalog = repairCatalogs[repairIndex];
          const totalCost = catalog.rawTotal;
          const services = catalog.serviceDocs.map(service => ({
            serviceId: service._id,
            price: service.price,
            estimatedTime: parseEstimatedTime(service.estimatedTime),
            notes: ''
          }));

          // Prepare order data matching the Order model schema
          const orderData = {
            customerId: req.user._id,
            deviceBrand: repairOrder.deviceBrand,
            deviceModel: repairOrder.deviceModel,
            deviceType: repairOrder.deviceType || 'Smartphone',
            services: services,
            addOns: catalog.addOns,
            customerNotes: repairOrder.customerNotes || '',
            photos: repairOrder.photos || [],
            status: 'pending',
            priority: 'normal',
            progress: 0,
            paymentStatus: resolvedPaymentStatus,
            estimatedCompletion: null,
            // Persist shipping address explicitly so admin views and DHL get the
            // values without depending on populate fallbacks.
            shippingAddress: fallbackAddress,
            // Device unlock information from cart
            unlockPattern: repairOrder.unlockPattern || [],
            unlockCode: repairOrder.unlockCode || '',
            noLock: repairOrder.noLock || false,
            // Additional repair information from cart
            errorDescription: repairOrder.errorDescription || '',
            waterDamage: repairOrder.waterDamage || '',
            previousRepairAttempts: repairOrder.previousRepairAttempts || '',
            previousRepairDetails: repairOrder.previousRepairDetails || '',
            itemCondition: repairOrder.itemCondition || '',
            imei: repairOrder.imei || '',
            serialNumber: repairOrder.serialNumber || ''
          };

          orderSpecs.push({ orderData, rawTotalCost: totalCost });
        } catch (orderError) {
          console.error('CheckoutRoutes: Error preparing order from repair order:', orderError);
          // Continue with other orders even if one fails
        }
      }
    }

    // Prepare an order from shop products if present
    if (hasShopProducts && cart.items.length > 0) {
      try {
        console.log('CheckoutRoutes: Preparing order from shop products');

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
          status: 'pending',
          priority: 'normal',
          progress: 0,
          paymentStatus: resolvedPaymentStatus,
          estimatedCompletion: null,
          shippingAddress: fallbackAddress
        };

        orderSpecs.push({ orderData: shopOrderData, rawTotalCost: totalCost });
      } catch (shopOrderError) {
        console.error('CheckoutRoutes: Error preparing order from shop products:', shopOrderError);
        // Log but don't fail the entire checkout
      }
    }

    // Invariante vor jeder Anlage: die vorbereiteten Auftraege bilden genau die Preisgrundlage
    // der Buchung (checkoutPricing.subtotal). Sonst (Auftrag nicht vorbereitbar) wuerde die
    // Buchung einen anderen Betrag tragen als ihre Auftraege -> abbrechen, nichts anlegen.
    const preparedRawTotal = Number(orderSpecs.reduce((sum, spec) => sum + Number(spec.rawTotalCost || 0), 0).toFixed(2));
    if (Math.abs(preparedRawTotal - Number(checkoutPricing.subtotal || 0)) > 0.004) {
      console.error('CheckoutRoutes: Prepared orders do not match checkout pricing:', preparedRawTotal, checkoutPricing.subtotal);
      return res.status(500).json({
        success: false,
        error: 'Der Warenkorb konnte nicht vollständig übernommen werden. Es wurde nichts gebucht. Bitte prüfen Sie den Warenkorb und versuchen Sie es erneut.'
      });
    }

    // Allocate the cart-level discount (promo code + customer group discount)
    // proportionally across the prepared orders so the order price stays in sync
    // with what the customer saw in the cart/booking summary.
    const totalCheckoutDiscount = Number((cart.discount || 0) + (checkoutPricing.groupDiscountAmount || 0));
    const discountShares = allocateProportionalAmount(
      orderSpecs.map((spec) => spec.rawTotalCost),
      totalCheckoutDiscount
    );

    for (let i = 0; i < orderSpecs.length; i++) {
      const { orderData, rawTotalCost } = orderSpecs[i];
      const allocatedDiscount = discountShares[i] || 0;
      orderData.totalCost = Number((rawTotalCost - allocatedDiscount).toFixed(2));
      orderData.discount = allocatedDiscount;
      orderData.appliedPromoCode = cart.promoCode || '';

      try {
        console.log('CheckoutRoutes: Order data prepared:', orderData);
        // Vertrauenswuerdige Checkout-Preisbildung NUR ueber die interne Option -
        // nie ueber den Request-Body. Aktionsanteil (fest) und Gruppenprozentsatz
        // werden als zeitgebundener Snapshot am Auftrag festgehalten.
        const order = await OrderService.create(orderData, {
          trustedPricing: {
            totalCost: orderData.totalCost,
            discount: allocatedDiscount,
            promoDiscountAmount: allocateProportionalAmount(
              orderSpecs.map((spec) => spec.rawTotalCost),
              Number(cart.discount || 0)
            )[i] || 0,
            groupDiscountPercent: Number(checkoutPricing.groupDiscountPercent || 0),
          },
        });
        console.log('CheckoutRoutes: Order created successfully:', order._id);

        createdOrders.push(order);
        orderIds.push(order._id.toString());
      } catch (orderError) {
        console.error('CheckoutRoutes: Error creating order:', orderError);
        // Continue with other orders even if one fails
      }
    }

    if (createdOrders.length === 0) {
      console.log('CheckoutRoutes: No orders were created');
      return res.status(500).json({
        success: false,
        error: 'Die Aufträge konnten nicht angelegt werden. Bitte versuchen Sie es erneut.'
      });
    }
    // Teilweise angelegt: die Buchung traegt den Betrag ALLER Geraete (checkoutPricing) -
    // mit fehlenden Auftraegen liefen Buchungsbetrag und Auftragssumme auseinander. Die
    // bereits angelegten (noch ungebuchten) Auftraege dieser Anfrage werden verworfen.
    if (createdOrders.length !== orderSpecs.length) {
      console.error('CheckoutRoutes: Only', createdOrders.length, 'of', orderSpecs.length, 'orders created - discarding');
      await discardUnbookedOrdersOfRequest(orderIds);
      return res.status(500).json({
        success: false,
        error: 'Die Aufträge konnten nicht vollständig angelegt werden. Es wurde nichts gebucht. Bitte versuchen Sie es erneut.'
      });
    }
    // Ab hier existieren Auftraege: der Anspruch bleibt bestehen (keine zweite Anlage).
    if (attemptClaim) attemptClaim.keep = true;

    // Create booking to consolidate all orders
    console.log('CheckoutRoutes: Creating booking to consolidate', createdOrders.length, 'orders');
    let booking = null;
    let bookingCreateData = null;
    try {
      const mongoose = require('mongoose');
      bookingCreateData = {
        customerId: req.user._id,
        orderIds: orderIds.map(id => new mongoose.Types.ObjectId(id)),
        discount: Number((cart.discount || 0) + (checkoutPricing.groupDiscountAmount || 0)),
        checkoutPricing,
        appliedPromoCode: cart.promoCode || '',
        status: 'pending',
        billingStatus: resolvedBillingStatus,
        paymentStatus: resolvedPaymentStatus,
        paymentMethod: paymentMethod || '',
        checkoutAttemptId: checkoutAttemptId || undefined,
      };
      booking = await BookingService.create(bookingCreateData);
      console.log('CheckoutRoutes: Booking created successfully:', booking._id);
    } catch (bookingError) {
      console.error('CheckoutRoutes: Error creating booking:', bookingError);
      // Gleichzeitige Wiederholung desselben Bezahlversuchs (eindeutiger Index): die andere
      // Anfrage hat die Buchung bereits angelegt -> deren Ergebnis zurueckgeben.
      if (checkoutAttemptId && bookingError?.code === 11000) {
        const existingBooking = await findAttemptBooking();
        if (existingBooking) {
          await discardUnbookedOrdersOfRequest(orderIds);
          return res.json(await buildRepeatedCheckoutResponse(existingBooking, repeatedOptions));
        }
        booking = await createBookingWithoutAttemptKey(bookingCreateData);
      }
      // Don't fail checkout if booking creation fails - orders were created
      // This is a graceful degradation scenario
    }

    if (booking && isCapturedPaypalPayment) {
      try {
        await linkCheckoutPayment({
          paymentMethod,
          paymentData,
          booking,
          orders: createdOrders,
          customerId: req.user._id,
        });
      } catch (paymentLinkError) {
        console.error('CheckoutRoutes: Error linking checkout payment to booking:', paymentLinkError);
      }
    }

    if (appliedPromoData && Number(cart.discount || 0) > 0 && createdOrders.length > 0) {
      try {
        const totalOrderAmount = createdOrders.reduce((sum, order) => sum + Number(order.totalCost || 0), 0);
        await CartService.consumePromoCodeRedemption({
          promoCode: appliedPromoData.promo.code,
          customerId: req.user._id,
          orderId: createdOrders[0]._id,
          orderAmount: totalOrderAmount,
          discountAmount: Number(cart.discount || 0),
          metadata: {
            bookingId: booking?._id || null,
            orderIds,
            source: 'checkout-complete',
          },
        });
      } catch (promoProcessingError) {
        console.error('CheckoutRoutes: Error processing promo redemption (non-fatal):', promoProcessingError);
      }
    }

    // Clear the cart after successful order creation
    try {
      await CartService.clearCart(req.user._id);
      console.log('CheckoutRoutes: Cart cleared successfully');
    } catch (clearError) {
      console.error('CheckoutRoutes: Error clearing cart:', clearError);
      // Don't fail the request if cart clearing fails - orders were created
    }

    // Create descriptive success message
    const repairOrderCount = hasRepairOrders ? (cart.repairOrders?.length || 0) : 0;
    const shopProductCount = hasShopProducts ? 1 : 0; // Shop products create 1 combined order
    const totalOrders = createdOrders.length;

    // Deutsche Erfolgsmeldung (DHL-11) - der Client zeigt sie direkt im Toast.
    const successMessage = describeCheckoutSuccess({ repairCount: repairOrderCount, hasShopOrder: shopProductCount > 0 });
    console.log('CheckoutRoutes: Checkout completed successfully. Created booking:', booking?._id, 'orders:', totalOrders);

    res.json({
      success: true,
      message: successMessage,
      booking: toCheckoutBookingPayload(booking, orderIds),
      bookingId: booking?._id?.toString() || null,
      bookingNumber: booking?.bookingNumber || '',
      orders: createdOrders,
      orderIds: orderIds,
      checkoutPricing
    });
  } catch (error) {
    console.error('CheckoutRoutes: Error completing checkout:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (attemptClaim && !attemptClaim.keep) await attemptClaim.release();
  }
});

// Description: Resend checkout verification email for inactive customer account
// Endpoint: POST /api/checkout/resend-verification-email
// Request: { email }
// Response: { success: boolean, message: string }
router.post('/resend-verification-email', ...resendVerificationLimits, async (req, res) => {
  try {
    const normalizedEmail = normalizeEmailAddress(req.body?.email);

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const user = await UserService.getByEmail(normalizedEmail);

    if (!user || user.role !== 'customer') {
      return res.status(404).json({
        success: false,
        error: 'Customer account not found for this email.'
      });
    }

    if (user.status === 'active' || user.isActive === true) {
      return res.status(400).json({
        success: false,
        error: 'This account is already verified. Please login instead.'
      });
    }

    const emailResult = await sendCheckoutVerificationEmail(user);

    if (!emailResult?.success) {
      return res.status(500).json({
        success: false,
        error: emailResult?.error || 'Failed to resend verification email.'
      });
    }

    console.log('CheckoutRoutes: Verification email resent to:', normalizedEmail);

    return res.json({
      success: true,
      message: 'Verification email sent again. Please check your inbox.'
    });
  } catch (error) {
    console.error('CheckoutRoutes: Error resending verification email:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to resend verification email.'
    });
  }
});

// Ein zahlender Gast darf nach der PayPal-Erfassung nie an den Anlege-Limits scheitern
// (sonst: Geld abgebucht, keine Buchung). Ausgenommen werden deshalb (nur serverseitig
// geprueft, siehe guestAccess.js isCreationExempt):
//  - die Wiederholung eines bereits abgeschlossenen Bezahlversuchs (checkoutAttemptId + E-Mail
//    einer vorhandenen Gast-Buchung) - sie legt nichts an, sondern liefert die Buchung erneut;
//  - ein Abschluss mit paypalCaptureId einer ERFASSTEN Gast-Zahlung derselben E-Mail, die noch
//    keiner Buchung zugeordnet ist (danach gilt die Ausnahme fuer diese Zahlung nicht mehr).
const markExemptGuestCompletion = async (req, res, next) => {
  try {
    const body = req.body || {};
    const email = typeof body.guestInfo?.email === 'string' ? normalizeEmailAddress(body.guestInfo.email) : '';
    if (!email) return next();
    const checkoutAttemptId = sanitizeCheckoutAttemptId(body.checkoutAttemptId);
    if (checkoutAttemptId) {
      const Booking = require('../models/Booking');
      const existing = await Booking.findOne({ checkoutAttemptId, customerId: null })
        .setOptions({ skipAutoPopulate: true })
        .select('guestInfo.email')
        .lean();
      if (existing && normalizeEmailAddress(existing.guestInfo?.email) === email) {
        req.guestCreationLimitExempt = true;
        return next();
      }
    }
    const captureId = body.paymentMethod === 'paypal' && typeof body.paymentData?.paypalCaptureId === 'string'
      ? body.paymentData.paypalCaptureId.trim()
      : '';
    if (captureId) {
      const paid = await Payment.exists({
        isGuest: true,
        guestEmail: email,
        paymentMethod: 'paypal',
        status: 'completed',
        bookingId: null,
        $or: [{ 'metadata.providerDetails.captureId': captureId }, { 'metadata.providerReference': captureId }],
      });
      if (paid) req.guestCreationLimitExempt = true;
    }
  } catch (error) {
    // Im Zweifel greifen die normalen Limits.
    console.error('CheckoutRoutes: Paid guest completion could not be checked:', error.message);
  }
  return next();
};

// Description: Complete guest checkout - creates orders from guest cart data without authentication
// Endpoint: POST /api/checkout/guest-complete
// Request: { guestInfo: { email, firstName, lastName, billingAddress, shippingAddress }, cartData: { items, repairOrders }, paymentMethod?: string, paymentData?: object }
// Response: { success: boolean, message: string, orders: Order[], orderIds: string[] }
router.post('/guest-complete', markExemptGuestCompletion, ...guestCreateLimits, async (req, res) => {
  let attemptClaim = null; // siehe /complete (DHL-14)
  try {
    console.log('CheckoutRoutes: Processing guest checkout');

    const { guestInfo, cartData, paymentMethod, paymentData } = req.body;
    if (!isCheckoutPaymentMethodAllowed({ paymentMethod, allowedMethods: DEFAULT_ALLOWED_CHECKOUT_METHODS })) {
      return res.status(403).json({
        success: false,
        error: 'Die gewählte Zahlungsart ist im Checkout standardmäßig nicht freigegeben.'
      });
    }
    const isCapturedPaypalPayment = paymentMethod === 'paypal' && !!paymentData?.paypalCaptureId;
    const resolvedPaymentStatus = isCapturedPaypalPayment ? 'paid' : 'pending';
    const resolvedBillingStatus = isCapturedPaypalPayment ? 'paid' : 'unpaid';

    // Validate guest information
    if (!guestInfo || !guestInfo.email || !guestInfo.firstName || !guestInfo.lastName) {
      console.log('CheckoutRoutes: Missing required guest information');
      return res.status(400).json({
        success: false,
        error: 'Bitte geben Sie Vorname, Nachname und E-Mail-Adresse an.'
      });
    }

    // Idempotenz (DHL-14): derselbe Bezahlversuch (Schluessel + E-Mail) nach verlorener
    // Antwort liefert dieselbe Buchung statt einer zweiten Buchung mit zweitem DHL-Label.
    const checkoutAttemptId = sanitizeCheckoutAttemptId(req.body?.checkoutAttemptId);
    const normalizedGuestEmail = normalizeEmailAddress(guestInfo.email);
    const findGuestAttemptBooking = async () => {
      if (!checkoutAttemptId) return null;
      const Booking = require('../models/Booking');
      const candidate = await Booking.findOne({ checkoutAttemptId, customerId: null })
        .setOptions({ skipAutoPopulate: true })
        .select(CHECKOUT_ATTEMPT_BOOKING_SELECT)
        .lean();
      return candidate && normalizeEmailAddress(candidate.guestInfo?.email) === normalizedGuestEmail ? candidate : null;
    };
    const repeatedGuestOptions = { guest: true, guestEmail: guestInfo.email, paymentMethod, paymentData, guestInfo };
    const repeatedGuestBooking = await findGuestAttemptBooking();
    if (repeatedGuestBooking) {
      console.log('CheckoutRoutes: Repeated guest checkout attempt, returning existing booking:', repeatedGuestBooking._id);
      return res.json(await buildRepeatedCheckoutResponse(repeatedGuestBooking, repeatedGuestOptions));
    }
    if (checkoutAttemptId) {
      const acquired = await acquireCheckoutAttempt({
        scope: `guest:${normalizedGuestEmail}`,
        checkoutAttemptId,
        findExisting: findGuestAttemptBooking,
      });
      if (acquired.existing) {
        console.log('CheckoutRoutes: Parallel repeated guest checkout, returning booking of the other request:', acquired.existing._id);
        return res.json(await buildRepeatedCheckoutResponse(acquired.existing, repeatedGuestOptions));
      }
      if (acquired.busy) return res.status(409).json(CHECKOUT_IN_PROGRESS_RESPONSE);
      attemptClaim = acquired.claim;
    }

    // Validate billing address
    const billingAddress = guestInfo.billingAddress || {};
    if (!billingAddress.street || !billingAddress.city || !billingAddress.zipCode) {
      console.log('CheckoutRoutes: Incomplete billing address');
      return res.status(400).json({
        success: false,
        error: 'Bitte vervollständigen Sie Ihre Rechnungsadresse (Straße mit Hausnummer, PLZ, Ort).',
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
        code: 'CART_EMPTY',
        error: 'Ihr Warenkorb ist leer.'
      });
    }

    const hasRepairOrders = cartData.repairOrders && cartData.repairOrders.length > 0;
    const hasShopProducts = cartData.items && cartData.items.length > 0;

    // Einsendelabel (Kunde = Absender) braucht eine Hausnummer. Gast-Auftraege nutzen die
    // Lieferadresse, sonst die Rechnungsadresse (BookingService.buildBookingShipmentData).
    const guestLabelAddress = (guestInfo.shippingAddress && guestInfo.shippingAddress.street) ? guestInfo.shippingAddress : billingAddress;
    if (hasRepairOrders && !addressHasHouseNumber(guestLabelAddress)) {
      return res.status(400).json({
        success: false,
        code: 'HOUSE_NUMBER_REQUIRED',
        error: guestLabelAddress === billingAddress
          ? HOUSE_NUMBER_REQUIRED_MESSAGE
          : 'Bitte ergänzen Sie die Hausnummer in Ihrer Lieferadresse – sie wird für das DHL-Einsendelabel benötigt.',
        missingFields: { houseNumber: true }
      });
    }

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
    const orderSpecs = [];

    // Prepare orders from repair orders in the guest cart
    if (hasRepairOrders) {
      // Gast-Warenkorb kommt vollstaendig vom Client: Leistungen (dedupliziert) und
      // Zusatzleistungen (Katalogpreis) aus dem Katalog; Unbekanntes -> 400, nichts angelegt.
      const guestRepairCatalogs = [];
      try {
        for (const repairOrder of cartData.repairOrders) {
          guestRepairCatalogs.push(await CartService.resolveRepairOrderCatalog({
            services: repairOrder?.services,
            addOns: repairOrder?.addOns,
          }));
        }
      } catch (catalogError) {
        return res.status(catalogError.status === 400 ? 400 : 500).json({
          success: false,
          code: catalogError.code || 'CART_CATALOG_INVALID',
          error: catalogError.message || 'Der Warenkorb konnte nicht geprüft werden.'
        });
      }
      for (let repairIndex = 0; repairIndex < cartData.repairOrders.length; repairIndex++) {
        const repairOrder = cartData.repairOrders[repairIndex];
        try {
          console.log('CheckoutRoutes: Preparing order from guest repair order:', repairOrder);

          const catalog = guestRepairCatalogs[repairIndex];
          const totalCost = catalog.rawTotal;
          const services = catalog.serviceDocs.map(service => ({
            serviceId: service._id,
            price: service.price,
            estimatedTime: parseEstimatedTime(service.estimatedTime),
            notes: ''
          }));

          // Prepare order data with guest information
          const orderData = {
            customerId: null, // No user ID for guest orders
            guestInfo: guestUserData, // Store guest information with the order
            deviceBrand: repairOrder.deviceBrand,
            deviceModel: repairOrder.deviceModel,
            deviceType: repairOrder.deviceType || 'Smartphone',
            services: services,
            addOns: catalog.addOns,
            customerNotes: repairOrder.customerNotes || '',
            photos: repairOrder.photos || [],
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
            itemCondition: repairOrder.itemCondition || '',
            imei: repairOrder.imei || '',
            serialNumber: repairOrder.serialNumber || ''
          };

          orderSpecs.push({ orderData, rawTotalCost: totalCost });
        } catch (orderError) {
          console.error('CheckoutRoutes: Error preparing guest order from repair order:', orderError);
          // Continue with other orders even if one fails
        }
      }
    }

    // Prepare an order from shop products if present
    if (hasShopProducts && cartData.items.length > 0) {
      try {
        console.log('CheckoutRoutes: Preparing order from guest shop products');

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
          status: 'pending',
          priority: 'normal',
          progress: 0,
          paymentStatus: resolvedPaymentStatus,
          estimatedCompletion: null
        };

        orderSpecs.push({ orderData: shopOrderData, rawTotalCost: totalCost });
      } catch (shopOrderError) {
        console.error('CheckoutRoutes: Error preparing guest shop product order:', shopOrderError);
      }
    }

    if (orderSpecs.length === 0) {
      console.log('CheckoutRoutes: No guest orders were prepared');
      return res.status(500).json({
        success: false,
        error: 'Die Aufträge konnten nicht angelegt werden. Bitte versuchen Sie es erneut.'
      });
    }

    // Resolve the promo code against the raw (pre-discount) subtotal, then allocate the
    // resulting discount proportionally across the orders before persisting them.
    const guestRawSubtotal = orderSpecs.reduce((sum, spec) => sum + Number(spec.rawTotalCost || 0), 0);
    let guestPromoData = null;
    const normalizedGuestPromoCode = String(cartData?.promoCode || '').trim().toUpperCase();
    if (normalizedGuestPromoCode) {
      try {
        guestPromoData = await CartService.resolvePromoCodeForCheckout({
          promoCode: normalizedGuestPromoCode,
          subtotal: guestRawSubtotal,
          customerId: null,
        });
      } catch (promoError) {
        return res.status(400).json({
          success: false,
          error: promoError.message || 'Invalid promo code'
        });
      }
    }

    const guestDiscountShares = allocateProportionalAmount(
      orderSpecs.map((spec) => spec.rawTotalCost),
      Number(guestPromoData?.discountAmount || 0)
    );

    for (let i = 0; i < orderSpecs.length; i++) {
      const { orderData, rawTotalCost } = orderSpecs[i];
      const allocatedDiscount = guestDiscountShares[i] || 0;
      orderData.totalCost = Number((rawTotalCost - allocatedDiscount).toFixed(2));
      orderData.discount = allocatedDiscount;
      orderData.appliedPromoCode = guestPromoData?.promo?.code || '';

      try {
        console.log('CheckoutRoutes: Guest order data prepared:', orderData);
        // Gast-Checkout: nur der Aktionsrabatt (fester Betrag), keine Gruppenkondition.
        const order = await OrderService.create(orderData, {
          trustedPricing: {
            totalCost: orderData.totalCost,
            discount: allocatedDiscount,
            promoDiscountAmount: allocatedDiscount,
            groupDiscountPercent: 0,
          },
        });
        console.log('CheckoutRoutes: Guest order created successfully:', order._id);

        createdOrders.push(order);
        orderIds.push(order._id.toString());
      } catch (orderError) {
        console.error('CheckoutRoutes: Error creating guest order:', orderError);
        // Continue with other orders even if one fails
      }
    }

    if (createdOrders.length === 0) {
      console.log('CheckoutRoutes: No guest orders were created');
      return res.status(500).json({
        success: false,
        error: 'Die Aufträge konnten nicht angelegt werden. Bitte versuchen Sie es erneut.'
      });
    }
    // Teilweise angelegt: Buchungsbetrag (guestRawSubtotal aller Geraete) != Auftragssumme ->
    // angelegte, ungebuchte Auftraege verwerfen, nichts buchen (wie im Kunden-Checkout).
    if (createdOrders.length !== orderSpecs.length) {
      console.error('CheckoutRoutes: Only', createdOrders.length, 'of', orderSpecs.length, 'guest orders created - discarding');
      await discardUnbookedOrdersOfRequest(orderIds);
      return res.status(500).json({
        success: false,
        error: 'Die Aufträge konnten nicht vollständig angelegt werden. Es wurde nichts gebucht. Bitte versuchen Sie es erneut.'
      });
    }
    if (attemptClaim) attemptClaim.keep = true;

    // Create booking to consolidate all guest orders
    console.log('CheckoutRoutes: Creating booking for guest orders:', createdOrders.length);
    let booking = null;
    let bookingCreateData = null;
    try {
      const mongoose = require('mongoose');
      const guestDiscountAmount = Number(guestPromoData?.discountAmount || 0);
      const guestFinalTotal = Number((guestRawSubtotal - guestDiscountAmount).toFixed(2));
      // Order prices (and therefore guestFinalTotal) are gross/VAT-inclusive, so the tax
      // portion must be extracted from the final (post-discount) total, not added on top.
      const guestFinancialProfile = await FinancialService.resolveFinancialProfile({ customerId: null });
      const guestTaxRatePercent = Math.max(0, Number(guestFinancialProfile?.taxRate || 0));
      const guestTax = guestTaxRatePercent > 0
        ? Number((guestFinalTotal * (guestTaxRatePercent / (100 + guestTaxRatePercent))).toFixed(2))
        : 0;
      bookingCreateData = {
        customerId: null,
        guestInfo: guestUserData,
        orderIds: orderIds.map(id => new mongoose.Types.ObjectId(id)),
        discount: guestDiscountAmount,
        // Orders were already created with the discount baked into their totalCost, so
        // pass an explicit checkoutPricing snapshot here too. This makes resolveBookingPricing
        // use this authoritative total instead of re-subtracting the discount from the
        // (already discounted) sum of order.totalCost, which would double-count it.
        checkoutPricing: {
          subtotal: guestRawSubtotal,
          totalDiscount: guestDiscountAmount,
          tax: guestTax,
          total: guestFinalTotal,
        },
        appliedPromoCode: guestPromoData?.promo?.code || '',
        status: 'pending',
        billingStatus: resolvedBillingStatus,
        paymentStatus: resolvedPaymentStatus,
        paymentMethod: paymentMethod || '',
        checkoutAttemptId: checkoutAttemptId || undefined,
      };
      booking = await BookingService.create(bookingCreateData);
      console.log('CheckoutRoutes: Guest booking created successfully:', booking._id);
    } catch (bookingError) {
      console.error('CheckoutRoutes: Error creating guest booking:', bookingError);
      if (checkoutAttemptId && bookingError?.code === 11000) {
        const existingGuestBooking = await findGuestAttemptBooking();
        if (existingGuestBooking) {
          await discardUnbookedOrdersOfRequest(orderIds);
          return res.json(await buildRepeatedCheckoutResponse(existingGuestBooking, repeatedGuestOptions));
        }
        booking = await createBookingWithoutAttemptKey(bookingCreateData);
      }
    }

    if (booking && isCapturedPaypalPayment) {
      try {
        await linkCheckoutPayment({
          paymentMethod,
          paymentData,
          booking,
          orders: createdOrders,
          guestInfo,
        });
      } catch (paymentLinkError) {
        console.error('CheckoutRoutes: Error linking guest checkout payment to booking:', paymentLinkError);
      }
    }

    if (guestPromoData && createdOrders.length > 0) {
      try {
        const guestTotalAmount = createdOrders.reduce((sum, order) => sum + Number(order.totalCost || 0), 0);
        await CartService.consumePromoCodeRedemption({
          promoCode: guestPromoData.promo.code,
          customerId: null,
          orderId: createdOrders[0]._id,
          orderAmount: guestTotalAmount,
          discountAmount: Number(guestPromoData.discountAmount || 0),
          metadata: {
            bookingId: booking?._id || null,
            orderIds,
            source: 'guest-checkout-complete',
            guestEmail: guestInfo.email,
          },
        });
      } catch (promoProcessingError) {
        console.error('CheckoutRoutes: Error processing guest promo redemption (non-fatal):', promoProcessingError);
      }
    }

    // Deutsche Erfolgsmeldung (DHL-11).
    const totalOrders = createdOrders.length;
    const guestRepairCount = createdOrders.filter((order) => order.deviceType !== 'Shop Products').length;
    const successMessage = describeCheckoutSuccess({
      repairCount: guestRepairCount,
      hasShopOrder: createdOrders.some((order) => order.deviceType === 'Shop Products'),
    });

    console.log('CheckoutRoutes: Guest checkout completed successfully, orders:', totalOrders);

    // Bestaetigungs-Mail (FIN-14 / DHL-13): Frueher wurde 'guest_booking_created' hier UND in
    // BookingService.create verschickt - der Gast bekam zwei Mails, eine davon mit relativem
    // Link und abweichendem Betragsformat. Es gibt jetzt genau EINEN Absender:
    // BookingService.create (absolute Links ueber buildSystemUrl, Einsendelabel als Anhang,
    // Positionsuebersicht, Gesamtbetrag der Buchung).

    res.json({
      success: true,
      message: successMessage,
      booking: toCheckoutBookingPayload(booking, orderIds),
      bookingId: booking?._id?.toString() || null,
      bookingNumber: booking?.bookingNumber || '',
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
  } finally {
    if (attemptClaim && !attemptClaim.keep) await attemptClaim.release();
  }
});

module.exports = router;
module.exports.buildPaypalAmount = buildPaypalAmount;
module.exports.allocateProportionalAmount = allocateProportionalAmount;
