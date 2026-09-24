const Payment = require('../models/Payment');
const PaymentAllocation = require('../models/PaymentAllocation');
const Invoice = require('../models/Invoice');
const DunningRun = require('../models/DunningRun');
const Order = require('../models/Order');
const Booking = require('../models/Booking');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const SystemConfiguration = require('../models/SystemConfiguration');
const CalculationHelper = require('./calculationHelper');
const OrderRevisionService = require('./orderRevisionService');
const EmailService = require('./emailService');
const NotificationService = require('./notificationService');
const { Types } = require('mongoose');
const crypto = require('crypto');
const PaymentService = require('./paymentService');

// Fachlicher Fehler mit HTTP-Status und deutscher, UI-tauglicher Meldung.
function buildFinancialError(message, statusCode = 400, code = 'FINANCIAL_ERROR') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

// Zeitfenster fuer die abgeleitete Idempotenz (Doppelklick / Retry des Clients).
const IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000;

/**
 * Baut den Idempotenzschluessel einer Zahlungserfassung.
 * Ein vom Aufrufer geschickter Schluessel gewinnt immer. Ohne Schluessel wird ein
 * Fingerabdruck aus Vorgang, Betrag, Zahlart, Datum und Verwendungszweck gebildet
 * und in ein Zeitfenster gebucht: derselbe Request innerhalb des Fensters ist ein
 * Duplikat, eine bewusst spaeter erneut erfasste identische Zahlung nicht.
 */
function buildPaymentIdempotencyKey(scope, fingerprintParts, explicitKey = null, bucketOffset = 0) {
  const cleanExplicit = String(explicitKey || '').trim();
  if (cleanExplicit) return `client:${scope}:${cleanExplicit.slice(0, 120)}`;

  const bucket = Math.floor(Date.now() / IDEMPOTENCY_WINDOW_MS) - bucketOffset;
  const fingerprint = crypto
    .createHash('sha1')
    .update(fingerprintParts.map((part) => String(part ?? '')).join('|'))
    .digest('hex')
    .slice(0, 24);
  return `auto:${scope}:${fingerprint}:${bucket}`;
}

/**
 * Sucht eine bereits erfasste Zahlung zum selben Idempotenzschluessel.
 * Es werden das aktuelle UND das vorherige Zeitfenster geprueft, damit ein
 * Doppelklick genau auf einer Fenstergrenze nicht durchrutscht.
 */
async function findDuplicatePayment(scope, fingerprintParts, explicitKey = null) {
  const keys = String(explicitKey || '').trim()
    ? [buildPaymentIdempotencyKey(scope, fingerprintParts, explicitKey)]
    : [
      buildPaymentIdempotencyKey(scope, fingerprintParts, null, 0),
      buildPaymentIdempotencyKey(scope, fingerprintParts, null, 1),
    ];
  const existing = await Payment.findOne({ idempotencyKey: { $in: keys } });
  return { keys, existing };
}

function parseDueDaysFromTerms(paymentTerms) {
  if (!paymentTerms) return null;

  const match = String(paymentTerms).match(/(\d+)/);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePaymentDueDays(value, fallback = 7) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(14, Math.max(1, Math.floor(numericValue)));
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

const DUNNING_STAGES = [
  { level: 1, stage: 'payment_reminder', trigger: 'payment_reminder', label: 'Zahlungserinnerung' },
  { level: 2, stage: 'dunning_notice', trigger: 'dunning_notice', label: 'Mahnung' },
  { level: 3, stage: 'final_notice', trigger: 'final_dunning_notice', label: 'Letzte Mahnung' }
];

function calculateDiscountAmount(subtotal, discountPercent) {
  const numericSubtotal = Number(subtotal);
  const numericDiscountPercent = Number(discountPercent);

  if (!Number.isFinite(numericSubtotal) || numericSubtotal <= 0) return 0;
  if (!Number.isFinite(numericDiscountPercent) || numericDiscountPercent <= 0) return 0;

  return Number(((numericSubtotal * numericDiscountPercent) / 100).toFixed(2));
}

/**
 * Steuersatz-Kontrakt: die API erwartet einen PROZENTWERT (19, 7, 0), keinen Faktor.
 * Uebergangsweise wird ein Wert echt zwischen 0 und 1 als alter Bruchwert (0.19)
 * erkannt und umgerechnet, damit ein alter Client-Bundle nicht 1/100 der MwSt bucht.
 */
function normalizeTaxRatePercent(value, fallbackPercent = CalculationHelper.DEFAULT_TAX_RATE) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    const fallback = Number(fallbackPercent);
    return Number.isFinite(fallback) ? fallback : CalculationHelper.DEFAULT_TAX_RATE;
  }
  if (numericValue > 0 && numericValue < 1) {
    console.warn(`FinancialService: taxRate ${numericValue} looks like a legacy fraction, interpreting as ${numericValue * 100}%`);
    return CalculationHelper.round(numericValue * 100);
  }
  return numericValue;
}

// Korrekturarten, die KEINE Wertminderung der Rechnung sind, sondern die Rueckgabe
// bereits erhaltenen Geldes (Ueberzahlung). Sie duerfen weder den gutschreibbaren
// Rechnungswert verbrauchen noch als Auftragswertminderung gezaehlt werden.
const REFUND_CORRECTION_TYPES = ['partial_refund'];
// Vom Client setzbare Korrekturtypen (Invoice.correctionType-Enum ohne null).
const VALID_CORRECTION_TYPES = ['full_cancellation', 'partial_refund', 'price_adjustment'];

// Zahlungsziel (Net X). Skonto wird bewusst nicht mehr ausgewiesen - es wurde nie
// tatsaechlich gewaehrt und ist aus allen aktiven Flows entfernt.
function composePaymentTerms(financialProfile) {
  return String(financialProfile?.paymentTerms || '').trim() || 'Net 14';
}

// Geraetekennzeichnung fuer Rechnungspositionen: Marke/Modell, IMEI bzw. Seriennummer.
function buildDeviceLabel(order, fallbackDevice = '') {
  const base = String(
    fallbackDevice || `${order?.deviceBrand || ''} ${order?.deviceModel || ''}`.trim() || 'Gerät'
  ).trim();

  const identifiers = [];
  const imei = String(order?.imei || '').trim();
  const serialNumber = String(order?.serialNumber || '').trim();
  if (imei) identifiers.push(`IMEI: ${imei}`);
  if (serialNumber) identifiers.push(`SN: ${serialNumber}`);

  return identifiers.length > 0 ? `${base} (${identifiers.join(', ')})` : base;
}

/**
 * Baut die Rechnungspositionen eines Auftrags.
 * Jede Position traegt den echten Service-/Produktnamen plus Geraetekennzeichnung -
 * niemals interne IDs, ein ObjectId-Dump oder den Platzhalter "Service".
 * Alle Preise sind BRUTTO (siehe CalculationHelper).
 */
function buildInvoiceItemsFromOrder(order, options = {}) {
  if (!order) return [];

  const deviceLabel = buildDeviceLabel(order, options.deviceLabel);
  const items = [];

  if (order.deviceType === 'Shop Products' || (order.shopProducts || []).length > 0) {
    (order.shopProducts || []).forEach((product) => {
      const quantity = Number(product.quantity) || 1;
      const unitPrice = Number(product.priceAtOrder) || 0;
      const serviceName = product.productId?.name || 'Produkt';
      items.push({
        serviceName,
        description: serviceName,
        quantity,
        unitPrice,
        total: CalculationHelper.round(unitPrice * quantity),
        type: 'product'
      });
    });
  }

  (order.services || []).forEach((service) => {
    const serviceName = (typeof service === 'string' ? service : service?.serviceId?.name) || 'Reparaturservice';
    items.push({
      serviceName,
      description: `${deviceLabel} – ${serviceName}`,
      quantity: 1,
      unitPrice: Number(service?.price) || 0,
      total: CalculationHelper.round(Number(service?.price) || 0),
      type: 'service'
    });
  });

  (order.addOns || []).forEach((addon) => {
    const serviceName = addon?.name || 'Zusatzleistung';
    const price = Number(addon?.price) || 0;
    items.push({
      serviceName,
      description: `${deviceLabel} – ${serviceName}`,
      quantity: 1,
      unitPrice: price,
      total: CalculationHelper.round(price),
      type: 'addon'
    });
  });

  return items;
}

// Laedt Auftraege so, dass buildInvoiceItemsFromOrder echte Service-/Produktnamen sieht.
function findOrdersForInvoiceItems(filter) {
  return Order.find(filter)
    .setOptions({ skipAutoPopulate: true })
    .select('orderNumber status totalCost discount deviceType deviceBrand deviceModel imei serialNumber services shopProducts addOns bookingId')
    .populate('services.serviceId', 'name')
    .populate('shopProducts.productId', 'name');
}

function normalizeBillingAddress(address) {
  if (!address || typeof address !== 'object') return null;

  const street = String(address.street || address.line1 || address.addressLine1 || '').trim();
  const city = String(address.city || address.town || '').trim();
  const zip = String(address.zip || address.zipCode || address.postalCode || address.postcode || '').trim();
  const state = String(address.state || address.province || '').trim();
  const country = String(address.country || '').trim();

  if (!street && !city && !zip && !state && !country) return null;

  return {
    street,
    city,
    zip,
    zipCode: zip,
    state,
    country,
  };
}

function normalizeShippingAddress(address) {
  if (!address || typeof address !== 'object') return null;

  const street = String(address.street || address.line1 || address.addressLine1 || '').trim();
  const city = String(address.city || address.town || '').trim();
  const zip = String(address.zip || address.zipCode || address.postalCode || address.postcode || '').trim();
  const state = String(address.state || address.province || '').trim();
  const country = String(address.country || '').trim();

  if (!street && !city && !zip && !state && !country) return null;

  return {
    street,
    city,
    zip,
    zipCode: zip,
    state,
    country,
  };
}

function resolveBillingAddressFromCustomer(customer) {
  if (!customer) return null;
  return normalizeBillingAddress(customer.invoiceAddress)
    || normalizeBillingAddress(customer.paymentAddress)
    || null;
}

function resolveBillingAddressFromOrder(order) {
  if (!order) return null;
  return normalizeBillingAddress(order.guestInfo?.billingAddress)
    || resolveBillingAddressFromCustomer(order.customerId)
    || null;
}

function resolveBillingAddressFromBooking(booking) {
  if (!booking) return null;
  return normalizeBillingAddress(booking.guestInfo?.billingAddress)
    || resolveBillingAddressFromCustomer(booking.customerId)
    || null;
}

function resolveShippingAddressFromCustomer(customer) {
  if (!customer) return null;
  return normalizeShippingAddress(customer.paymentAddress)
    || normalizeShippingAddress(customer.shippingAddress)
    || normalizeShippingAddress(customer.invoiceAddress)
    || null;
}

function resolveShippingAddressFromOrder(order) {
  if (!order) return null;
  return normalizeShippingAddress(order.guestInfo?.shippingAddress)
    || normalizeShippingAddress(order.shippingAddress)
    || resolveShippingAddressFromCustomer(order.customerId)
    || null;
}

function resolveShippingAddressFromBooking(booking) {
  if (!booking) return null;
  return normalizeShippingAddress(booking.guestInfo?.shippingAddress)
    || normalizeShippingAddress(booking.shippingAddress)
    || resolveShippingAddressFromCustomer(booking.customerId)
    || null;
}

// Valid invoice status transitions
const INVOICE_STATUS_TRANSITIONS = {
  draft:            ['pending_approval', 'sent', 'cancelled'],
  pending_approval: ['sent', 'draft', 'cancelled'],
  sent:             ['viewed', 'partially_paid', 'paid', 'overdue', 'cancelled'],
  viewed:           ['partially_paid', 'paid', 'overdue', 'cancelled'],
  partially_paid:   ['paid', 'overdue', 'cancelled'],
  paid:             ['credited'],
  overdue:          ['partially_paid', 'paid', 'cancelled'],
  cancelled:        ['credited'],
  credited:         []
};

// Belegstatus, deren ZAHLUNGSSTAND den Belegstatus fortschreiben darf.
// Grundlage sind die zuordnungsfaehigen Status aus dem PaymentService; 'draft' und
// 'pending_approval' fehlen dort bewusst: ein Beleg ohne Freigabe darf nicht ueber
// eingegangenes Geld nach 'paid'/'partially_paid' gedraengt werden - diesen Uebergang
// kennt INVOICE_STATUS_TRANSITIONS nicht und der Beleg waere danach unbeweglich.
// 'paid' kommt hinzu, damit eine entfernte oder erstattete Zahlung einen bereits
// bezahlten Beleg wieder oeffnen kann. 'cancelled' und 'credited' bleiben unberuehrt.
// Der BETRAG (paidAmount) wird in jedem Fall geschrieben: Geld wird immer verbucht,
// nur der Beleg wird nicht bewegt.
const PAYMENT_DERIVED_STATUS_WRITABLE = [...PaymentService.ALLOCATABLE_INVOICE_STATUSES, 'paid'];

// Deutsches Belegstatus-Label (Quelle: PaymentService). Meldungen, die den
// Bearbeiter erreichen, duerfen den rohen englischen Enum-Wert nicht zeigen -
// der technische Wert bleibt im Fehlercode und im Log.
const invoiceStatusLabelDe = PaymentService.invoiceStatusLabel;

// Default financial settings (fallback if no config exists)
const DEFAULT_FINANCIAL_SETTINGS = {
  defaults: {
    currency: 'EUR',
    locale: 'de-DE',
    taxRate: 19,
    paymentDueDays: 7,
    paymentTerms: 'Net 7',
    invoicePrefix: 'INV-',
    creditNotePrefix: 'CN-',
    defaultDiscount: 0,
    defaultPaymentMethod: 'credit_card'
  },
  discountPolicy: {
    allowManualDiscounts: true,
    maxDiscountPercent: 20,
    lateFeePercent: 5
  },
  invoiceMetadata: {
    sellerName: 'McRepair.de',
    sellerVatId: '',
    registrationNumber: '',
    issuerEmail: '',
    issuerPhone: '',
    invoiceFooter: '',
    legalFooter: ''
  },
  paymentPreferences: {
    partialPaymentsAllowed: true,
    autoAttachPdf: true,
    showTaxBreakdown: true,
    defaultVisualTheme: 'modern',
    accentColor: '#1a2a5e'
  }
};

const MANUAL_PAYMENT_METHODS = ['credit_card', 'sepa', 'paypal', 'cash'];

function normalizeTrackedPaymentMethod(value) {
  if (value == null || value === '') return null;
  const normalized = String(value).trim().toLowerCase();
  return MANUAL_PAYMENT_METHODS.includes(normalized) ? normalized : null;
}

function normalizeTrackedPaidAt(value) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Belegtyp-Ausschnitt der Rechnungsliste.
 * Akzeptiert beide Schreibweisen, die der Client schicken kann:
 *   scope=invoices|creditNotes|all   oder   isCreditNote=true|false
 * Ohne Angabe bleibt es beim bisherigen Verhalten (beides).
 */
function normalizeInvoiceScope(scope, isCreditNote) {
  const raw = String(scope ?? '').trim().toLowerCase();
  if (raw === 'invoices' || raw === 'invoice' || raw === 'regular') return 'invoices';
  if (raw === 'creditnotes' || raw === 'creditnote' || raw === 'credit_notes') return 'creditNotes';
  if (raw === 'all' || raw === 'both') return 'all';

  if (isCreditNote === true || isCreditNote === 'true' || isCreditNote === 1 || isCreditNote === '1') return 'creditNotes';
  if (isCreditNote === false || isCreditNote === 'false' || isCreditNote === 0 || isCreditNote === '0') return 'invoices';
  return 'all';
}

/**
 * Regex-Baustein fuer die Belegnummernsuche.
 * Trennzeichen werden weich behandelt ('INV 2026/42', 'inv-2026-42', '#INV-2026-42'
 * treffen dieselbe Nummer) und fuehrende Nullen der laufenden Nummer sind optional.
 * Deckt damit auch Altformate wie 'INV-1712345678-ab12cd' ab.
 */
function buildInvoiceNumberPattern(value) {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/^#/, '')
    .replace(/[\s_/]+/g, '-')
    .replace(/-+/g, '-');
  if (!cleaned) return '';

  return cleaned
    .split('-')
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? `0*${part}` : escapeRegExp(part)))
    .join('[-\\s_/]*');
}

// Safely extracts a Mongo id string from an ObjectId, populated doc, or plain id string.
function toIdString(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    // ObjectId zuerst: ein ObjectId liefert auf `_id` sich selbst zurueck, die
    // _id-Verzweigung wuerde sich daher endlos selbst aufrufen.
    if (typeof value.toHexString === 'function') return value.toHexString();
    if (value._id != null) return toIdString(value._id);
    if (value.id != null) return toIdString(value.id);
  }
  return String(value);
}

class FinancialService {
  // Helper: Load financial settings from SystemConfiguration
  static async getFinancialSettings() {
    try {
      const config = await SystemConfiguration.findOne().lean();
      if (!config || !config.financialSettings) {
        return DEFAULT_FINANCIAL_SETTINGS;
      }
      // Deep merge with defaults to ensure all fields exist
      return {
        defaults: { ...DEFAULT_FINANCIAL_SETTINGS.defaults, ...(config.financialSettings.defaults || {}) },
        discountPolicy: { ...DEFAULT_FINANCIAL_SETTINGS.discountPolicy, ...(config.financialSettings.discountPolicy || {}) },
        invoiceMetadata: { ...DEFAULT_FINANCIAL_SETTINGS.invoiceMetadata, ...(config.financialSettings.invoiceMetadata || {}) },
        paymentPreferences: { ...DEFAULT_FINANCIAL_SETTINGS.paymentPreferences, ...(config.financialSettings.paymentPreferences || {}) }
      };
    } catch (error) {
      console.error('FinancialService: Error loading financial settings, using defaults:', error.message);
      return DEFAULT_FINANCIAL_SETTINGS;
    }
  }

  static async resolveFinancialProfile({ customerId = null, customer = null } = {}) {
    const settings = await FinancialService.getFinancialSettings();

    const targetCustomerId = customerId
      || customer?._id
      || customer?.id
      || customer?.customerId
      || null;

    let resolvedCustomer = null;

    if (targetCustomerId) {
      resolvedCustomer = await User.findById(targetCustomerId)
        .populate('primaryCustomerGroupId', 'name key financeProfile')
        .lean();
    }

    const groupFinanceProfile = resolvedCustomer?.primaryCustomerGroupId?.financeProfile || {};
    const customerPaymentTerms = resolvedCustomer?.paymentTerms || '';
    const customerDueDays = resolvedCustomer?.paymentDueDays ?? parseDueDaysFromTerms(customerPaymentTerms);
    const taxMode = groupFinanceProfile.taxMode || 'default';
    const resolvedTaxRate = taxMode === 'tax_free' || taxMode === 'reverse_charge'
      ? 0
      : settings.defaults.taxRate;

    return {
      currency: groupFinanceProfile.currency || settings.defaults.currency,
      locale: settings.defaults.locale,
      taxRate: resolvedTaxRate,
      taxMode,
      paymentDueDays: normalizePaymentDueDays(
        customerDueDays ?? groupFinanceProfile.paymentDueDays ?? settings.defaults.paymentDueDays
      ),
      paymentTerms: customerPaymentTerms || groupFinanceProfile.paymentTermsLabel || settings.defaults.paymentTerms,
      // Kein invoicePrefix mehr: die Belegnummer kommt global aus DocumentSequence
      // ('INV-JJJJ-NNNN' / 'INV-CN-JJJJ-NNNN') und ist nicht mehr gruppenabhaengig.
      defaultDiscountPercent: typeof resolvedCustomer?.discount === 'number' && resolvedCustomer.discount > 0
        ? resolvedCustomer.discount
        : groupFinanceProfile.discountPercent ?? settings.defaults.defaultDiscount,
      defaultPaymentMethod: resolvedCustomer?.paymentMethod
        || (Array.isArray(groupFinanceProfile.allowedPaymentMethods) && groupFinanceProfile.allowedPaymentMethods[0])
        || settings.defaults.defaultPaymentMethod,
      creditLimit: groupFinanceProfile.creditLimit ?? 0,
      sellerVatId: settings.invoiceMetadata?.sellerVatId || 'DE318981969',
      invoiceMetadata: settings.invoiceMetadata || {},
      customer: resolvedCustomer,
      group: resolvedCustomer?.primaryCustomerGroupId || null,
    };
  }
  static mapPaymentMethodToGateway(paymentMethod) {
    if (paymentMethod === 'paypal') return 'paypal';
    if (paymentMethod === 'stripe') return 'stripe';
    return null;
  }

  // Customer Management
  static async searchCustomers(query) {
    console.log('FinancialService: Searching customers with query:', query);

    try {
      const searchRegex = new RegExp(String(query).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

      const customers = await User.find({
        $or: [
          { name: searchRegex },
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { customerNumber: searchRegex }
        ],
        role: 'customer'
      })
      .select('name firstName lastName customerNumber email phone invoiceAddress paymentAddress company country vatId')
      .limit(10);

      console.log('FinancialService: Found', customers.length, 'customers');
      return customers;
    } catch (error) {
      console.error('FinancialService: Error searching customers:', error);
      throw error;
    }
  }

  // Payment Management
  static async getPayments(filters = {}) {
    console.log('FinancialService: Getting payments with filters:', filters);

    try {
      const query = {};

      // Apply filters
      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.method) {
        query.paymentMethod = filters.method;
      }

      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) {
          query.createdAt.$gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
          query.createdAt.$lte = new Date(filters.dateTo);
        }
      }

      // Pagination
      const page = parseInt(filters.page) || 1;
      const limit = filters.limit ? parseInt(filters.limit) : 500;
      const skip = (page - 1) * limit;

      const [paymentSummary] = await Payment.aggregate([
        {
          $match: query,
        },
        {
          $facet: {
            items: [
              { $sort: { createdAt: -1 } },
              { $skip: skip },
              { $limit: limit },
            ],
            totalCount: [{ $count: 'count' }],
            totalAmount: [{ $group: { _id: null, totalAmount: { $sum: '$amount' } } }],
          },
        },
      ]);

      const payments = (paymentSummary?.items || []).map((payment) => ({ ...payment }));
      const totalPayments = paymentSummary?.totalCount?.[0]?.count || 0;
      const totalPages = Math.ceil(totalPayments / limit);
      const totalAmount = paymentSummary?.totalAmount?.[0]?.totalAmount || 0;

      console.log('FinancialService: Found', payments.length, 'payments');
      return {
        payments,
        totalPages,
        currentPage: page,
        totalAmount
      };
    } catch (error) {
      console.error('FinancialService: Error getting payments:', error);
      throw error;
    }
  }

  static async processRefund(paymentId, amount, reason, options = {}) {
    console.log('FinancialService: Processing refund for payment:', paymentId);

    try {
      const payment = await Payment.findById(paymentId);

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'completed') {
        throw new Error('Can only refund completed payments');
      }

      if (amount > payment.amount) {
        throw new Error('Refund amount cannot exceed payment amount');
      }

      const requestedMode = options.mode === 'manual' ? 'manual' : 'gateway';
      let resolvedGatewayProvider = options.gatewayProvider || FinancialService.mapPaymentMethodToGateway(payment.paymentMethod);

      if (requestedMode === 'gateway') {
        if (!resolvedGatewayProvider) {
          throw new Error('No compatible gateway available for this payment method. Use manual mode.');
        }

        const gateways = await FinancialService.getPaymentGateways();
        const selectedGateway = gateways.find((gateway) => gateway.provider === resolvedGatewayProvider);

        if (!selectedGateway) {
          throw new Error('Selected gateway not found');
        }

        if (!selectedGateway.isActive) {
          throw new Error('Selected gateway is not active');
        }

        if (!selectedGateway.supportedMethods.includes(payment.paymentMethod)) {
          throw new Error(`Gateway ${selectedGateway.name} does not support payment method ${payment.paymentMethod}`);
        }
      } else {
        resolvedGatewayProvider = 'manual';
      }

      // Update payment status and refund info
      // Nur eine VOLLerstattung setzt den Status auf 'refunded'. Bei einer
      // Teilerstattung bleibt die Zahlung 'completed' mit gesetztem refundAmount,
      // sonst faellt der noch nicht erstattete Rest dauerhaft aus jeder
      // Saldo- und Zuordnungsrechnung heraus (Filter status: 'completed').
      const refundAmount = CalculationHelper.round(Number(amount));
      const isFullRefund = refundAmount >= CalculationHelper.round(Number(payment.amount || 0)) - 0.01;
      payment.status = isFullRefund ? 'refunded' : 'completed';
      payment.refundAmount = refundAmount;
      payment.refundReason = reason;
      payment.refundedAt = new Date();
      payment.refundMode = requestedMode;
      payment.refundGatewayProvider = resolvedGatewayProvider;
      payment.refundGatewayReference = options.gatewayReference || '';

      await payment.save();

      // Zugeordnete Rechnungen nachziehen: erstattetes Geld darf nicht weiter als
      // beglichen gelten. paidAmount wird aus den GUELTIGEN Zuordnungen neu abgeleitet.
      await FinancialService.recalculateInvoicePaidAmounts(
        (await PaymentAllocation.find({ paymentId: payment._id }).select('invoiceId').lean())
          .map((entry) => entry.invoiceId)
      );

      console.log('FinancialService: Refund processed successfully');
      return {
        _id: 'refund_' + Date.now(),
        paymentId,
        amount,
        reason,
        mode: requestedMode,
        gatewayProvider: resolvedGatewayProvider,
        gatewayReference: options.gatewayReference || '',
        processedAt: new Date()
      };
    } catch (error) {
      console.error('FinancialService: Error processing refund:', error);
      throw error;
    }
  }

  // Invoice Management
  static async getInvoices(filters = {}) {
    console.log('FinancialService: Getting invoices with filters:', filters);

    try {
      const query = {};
      // Mehrere unabhaengige $or-Bedingungen (Auftrag, Belegnummer, Freitext) muessen
      // UND-verknuepft werden - ein zweites query.$or wuerde das erste ueberschreiben
      // und stillschweigend zu viele Belege liefern.
      const andClauses = [];

      // Apply filters
      if (filters.status) {
        query.status = filters.status;
      }

      // BELEGTYP (scope): Rechnungen, Gutschriften oder beides. Wird der Filter
      // ignoriert, bekommen die Rechnungs- und die Gutschriftenseite denselben
      // Ausschnitt und muessen clientseitig nachfiltern - mit dem Ergebnis, dass eine
      // Seite je nach Datenlage leer bleibt, obwohl es Belege gibt.
      const scope = normalizeInvoiceScope(filters.scope, filters.isCreditNote);
      if (scope === 'invoices') {
        // Altbestand kennt das Feld teils gar nicht: 'nicht true' statt '=== false'.
        query.isCreditNote = { $ne: true };
      } else if (scope === 'creditNotes') {
        query.isCreditNote = true;
      }

      if (filters.customerId) {
        query.customerId = filters.customerId;
      }

      if (filters.orderId) {
        const normalizedOrderId = String(filters.orderId).trim();
        if (normalizedOrderId) {
          const orderIdClauses = [
            { orderId: normalizedOrderId },
            { repairOrderIds: normalizedOrderId }
          ];

          if (Types.ObjectId.isValid(normalizedOrderId)) {
            const normalizedOrderObjectId = new Types.ObjectId(normalizedOrderId);
            orderIdClauses.push(
              { orderId: normalizedOrderObjectId },
              { repairOrderIds: normalizedOrderObjectId }
            );
          }

          andClauses.push({ $or: orderIdClauses });
        }
      }

      // BELEGNUMMER: verankerte Suche ab Wortanfang. Der eindeutige Index auf
      // invoiceNumber traegt ein '^'-Regex, ein freies Enthalten-Regex nicht.
      const invoiceNumberPattern = buildInvoiceNumberPattern(filters.invoiceNumber);
      if (invoiceNumberPattern) {
        andClauses.push({ invoiceNumber: { $regex: `^${invoiceNumberPattern}`, $options: 'i' } });
      }

      // FREITEXT: Belegnummer (auch Altformate wie 'INV-1712345678-ab12cd'), Kunde
      // und Kunden-E-Mail.
      const searchTerm = String(filters.search || '').trim();
      if (searchTerm) {
        const searchClauses = [];
        const numberPattern = buildInvoiceNumberPattern(searchTerm);
        if (numberPattern) {
          searchClauses.push({ invoiceNumber: { $regex: `^${numberPattern}`, $options: 'i' } });
          searchClauses.push({ invoiceNumber: { $regex: numberPattern, $options: 'i' } });
          // Reine Ziffernfolge: auch als laufende Nummer am Ende suchen, damit '42'
          // die INV-2026-0042 findet.
          if (/^\d+$/.test(searchTerm)) {
            searchClauses.push({ invoiceNumber: { $regex: `0*${searchTerm}$`, $options: 'i' } });
          }
        }
        const freeText = escapeRegExp(searchTerm);
        searchClauses.push({ customerName: { $regex: freeText, $options: 'i' } });
        searchClauses.push({ customerEmail: { $regex: freeText, $options: 'i' } });
        andClauses.push({ $or: searchClauses });
      }

      if (filters.bookingId) {
        const normalizedBookingId = String(filters.bookingId).trim();
        if (normalizedBookingId) {
          if (Types.ObjectId.isValid(normalizedBookingId)) {
            query.bookingId = new Types.ObjectId(normalizedBookingId);
          } else {
            query.bookingId = normalizedBookingId;
          }
        }
      }

      if (filters.isReverseCharge !== undefined && filters.isReverseCharge !== null && filters.isReverseCharge !== '') {
        query.isReverseCharge = filters.isReverseCharge === true || filters.isReverseCharge === 'true';
      }

      if (filters.zmRelevant !== undefined && filters.zmRelevant !== null && filters.zmRelevant !== '') {
        query.zmRelevant = filters.zmRelevant === true || filters.zmRelevant === 'true';
      }

      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) {
          query.createdAt.$gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
          query.createdAt.$lte = new Date(filters.dateTo);
        }
      }

      if (andClauses.length > 0) {
        query.$and = andClauses;
      }

      // Pagination (innerhalb des gefilterten Ausschnitts, nicht darueber hinaus)
      const page = Math.max(1, parseInt(filters.page) || 1);
      const limit = Math.min(500, Math.max(1, parseInt(filters.limit) || 10));
      const skip = (page - 1) * limit;

      const [invoiceSummary] = await Invoice.aggregate([
        {
          $match: query,
        },
        {
          $facet: {
            items: [
              { $sort: { createdAt: -1 } },
              { $skip: skip },
              { $limit: limit },
            ],
            totalCount: [{ $count: 'count' }],
            totalAmount: [{ $group: { _id: null, totalAmount: { $sum: '$total' } } }],
          },
        },
      ]);

      // Zahlungsstand je Beleg aus den GUELTIGEN Zuordnungen anreichern, damit die
      // Liste denselben Satz (total / allocated / open / overpaid) zeigt wie Detail-
      // und Auftragsansicht und der Client nichts nachrechnen muss.
      const rawInvoices = (invoiceSummary?.items || []).map((invoice) => ({ ...invoice }));
      const allocatedByInvoice = await PaymentService.getAllocatedTotalsByInvoice(
        rawInvoices.map((invoice) => invoice._id)
      );
      const invoices = rawInvoices.map((invoice) => {
        const balance = PaymentService.buildInvoiceBalance(
          invoice,
          Number(allocatedByInvoice.get(String(invoice._id)) || 0)
        );
        return {
          ...invoice,
          // status = Beleglebenslauf, paymentState = Zahlungsstand. Nie vermischen.
          paymentState: balance.paymentState,
          balance: {
            total: balance.total,
            allocated: balance.allocated,
            open: balance.open,
            overpaid: balance.overpaid,
          },
        };
      });
      const totalInvoices = invoiceSummary?.totalCount?.[0]?.count || 0;
      const totalPages = Math.ceil(totalInvoices / limit);
      const totalAmount = invoiceSummary?.totalAmount?.[0]?.totalAmount || 0;

      console.log('FinancialService: Found', invoices.length, 'invoices');
      return {
        invoices,
        // total/limit/scope sind additiv - die bisherigen Felder bleiben unveraendert,
        // damit bestehende Aufrufer nichts anpassen muessen.
        total: totalInvoices,
        limit,
        scope,
        totalPages,
        currentPage: page,
        totalAmount
      };
    } catch (error) {
      console.error('FinancialService: Error getting invoices:', error);
      throw error;
    }
  }

  static async createInvoice(invoiceData) {
    console.log('FinancialService: Creating invoice');

    try {
      // Clean the invoice data - remove empty strings for ObjectId fields
      const cleanedInvoiceData = { ...invoiceData };
      
      // If orderId is an empty string, remove it entirely
      if (cleanedInvoiceData.orderId === '') {
        delete cleanedInvoiceData.orderId;
      }
      
      // If customerId is an empty string, remove it entirely
      if (cleanedInvoiceData.customerId === '') {
        delete cleanedInvoiceData.customerId;
      }

      console.log('FinancialService: Cleaned invoice data:', cleanedInvoiceData);

      // If orderId is provided, validate order exists
      if (cleanedInvoiceData.orderId) {
        const order = await Order.findById(cleanedInvoiceData.orderId);
        if (!order) {
          throw new Error('Order not found');
        }
      }

      const financialProfile = await FinancialService.resolveFinancialProfile({
        customerId: cleanedInvoiceData.customerId || null,
      });

      // Get customer info if customerId is provided
      if (cleanedInvoiceData.customerId) {
        const customer = financialProfile.customer || await User.findById(cleanedInvoiceData.customerId);
        if (!customer) {
          throw new Error('Customer not found');
        }

        // Use customer info from database if not provided in request
        if (!cleanedInvoiceData.customerName) {
          cleanedInvoiceData.customerName = customer.name;
        }
        if (!cleanedInvoiceData.customerEmail) {
          cleanedInvoiceData.customerEmail = customer.email;
        }

        if (!cleanedInvoiceData.billingAddress) {
          cleanedInvoiceData.billingAddress = resolveBillingAddressFromCustomer(customer);
        }
      }

      if (!cleanedInvoiceData.billingAddress && cleanedInvoiceData.orderId) {
        const orderWithAddress = await Order.findById(cleanedInvoiceData.orderId)
          .populate('customerId', 'invoiceAddress paymentAddress')
          .select('guestInfo.billingAddress customerId')
          .lean();
        cleanedInvoiceData.billingAddress = resolveBillingAddressFromOrder(orderWithAddress);
      }

      if (!cleanedInvoiceData.billingAddress && cleanedInvoiceData.bookingId) {
        const bookingWithAddress = await Booking.findById(cleanedInvoiceData.bookingId)
          .populate('customerId', 'invoiceAddress paymentAddress')
          .select('guestInfo.billingAddress guestInfo.shippingAddress shippingAddress customerId')
          .lean();
        cleanedInvoiceData.billingAddress = resolveBillingAddressFromBooking(bookingWithAddress);
        if (!cleanedInvoiceData.shippingAddress) {
          cleanedInvoiceData.shippingAddress = resolveShippingAddressFromBooking(bookingWithAddress);
        }
      }

      if (!cleanedInvoiceData.shippingAddress && cleanedInvoiceData.orderId) {
        const orderWithShippingAddress = await Order.findById(cleanedInvoiceData.orderId)
          .populate('customerId', 'invoiceAddress paymentAddress shippingAddress')
          .select('guestInfo.shippingAddress shippingAddress customerId')
          .lean();
        cleanedInvoiceData.shippingAddress = resolveShippingAddressFromOrder(orderWithShippingAddress);
      }

      if (!cleanedInvoiceData.shippingAddress && cleanedInvoiceData.customerId) {
        const customerForShippingAddress = financialProfile.customer || await User.findById(cleanedInvoiceData.customerId)
          .select('invoiceAddress paymentAddress shippingAddress')
          .lean();
        cleanedInvoiceData.shippingAddress = resolveShippingAddressFromCustomer(customerForShippingAddress);
      }

      if (cleanedInvoiceData.bookingId) {
        const existingInvoice = await Invoice.findOne({ bookingId: cleanedInvoiceData.bookingId })
          .select('_id invoiceNumber')
          .lean();
        if (existingInvoice) {
          const duplicateError = new Error(`An invoice already exists for this booking (${existingInvoice.invoiceNumber || existingInvoice._id})`);
          duplicateError.statusCode = 409;
          throw duplicateError;
        }
      }

      // Belegnummern sind nicht vom Aufrufer setzbar - sie kommen aus DocumentSequence.
      delete cleanedInvoiceData.invoiceNumber;
      delete cleanedInvoiceData.numberPrefix;

      if (!cleanedInvoiceData.dueDate && cleanedInvoiceData.dueDate !== false) {
        const dueDays = normalizePaymentDueDays(financialProfile.paymentDueDays);
        cleanedInvoiceData.dueDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000);
      }

      if (cleanedInvoiceData.dueDate) {
        cleanedInvoiceData.originalDueDate = new Date(cleanedInvoiceData.dueDate);
      }
      
      if (!cleanedInvoiceData.paymentTerms) {
        cleanedInvoiceData.paymentTerms = financialProfile.paymentTerms;
      }

      const isReverseCharge = Boolean(
        cleanedInvoiceData.isReverseCharge ||
        financialProfile.taxMode === 'reverse_charge'
      );

      if (isReverseCharge) {
        cleanedInvoiceData.isReverseCharge = true;
        cleanedInvoiceData.taxRate = 0;
        cleanedInvoiceData.tax = 0;
        cleanedInvoiceData.zmRelevant = true;
        if (!cleanedInvoiceData.reverseChargeNotice) {
          cleanedInvoiceData.reverseChargeNotice = 'Steuerschuldnerschaft des Leistungsempfängers / Reverse Charge';
        }
      }

      if (cleanedInvoiceData.customerVatId === undefined || cleanedInvoiceData.customerVatId === null) {
        cleanedInvoiceData.customerVatId = (financialProfile.customer?.vatId || '').trim();
      } else {
        cleanedInvoiceData.customerVatId = String(cleanedInvoiceData.customerVatId).trim();
      }

      if (!cleanedInvoiceData.sellerVatId) {
        cleanedInvoiceData.sellerVatId = (financialProfile.sellerVatId || 'DE318981969').trim();
      } else {
        cleanedInvoiceData.sellerVatId = String(cleanedInvoiceData.sellerVatId).trim();
      }

      // Positionspreise sind BRUTTO. Netto und MwSt werden vom Invoice-Modell aus dem
      // Brutto herausgerechnet; vom Client gelieferte Summen sind nicht vertrauenswuerdig.
      const hasItems = Array.isArray(cleanedInvoiceData.items) && cleanedInvoiceData.items.length > 0;
      const itemsGrossTotal = hasItems
        ? CalculationHelper.round(cleanedInvoiceData.items.reduce((sum, item) => sum + Number(item.total || 0), 0))
        : 0;

      if (hasItems) {
        delete cleanedInvoiceData.subtotal;
        delete cleanedInvoiceData.tax;
        delete cleanedInvoiceData.total;
      }

      if ((cleanedInvoiceData.discount === undefined || cleanedInvoiceData.discount === null) && itemsGrossTotal > 0) {
        cleanedInvoiceData.discount = calculateDiscountAmount(itemsGrossTotal, financialProfile.defaultDiscountPercent);
      }

      if (isReverseCharge) {
        cleanedInvoiceData.tax = 0;
      }

      if (!Number.isFinite(Number(cleanedInvoiceData.taxRate))) {
        cleanedInvoiceData.taxRate = isReverseCharge ? 0 : financialProfile.taxRate;
      }

      cleanedInvoiceData.status = 'sent';
      cleanedInvoiceData.sentAt = new Date();

      // Create invoice
      const invoice = new Invoice(cleanedInvoiceData);
      await invoice.save();
      const finalized = await FinancialService.finalizeInvoiceCreation(invoice);

      console.log('FinancialService: Invoice created successfully with defaults applied');
      return finalized;
    } catch (error) {
      console.error('FinancialService: Error creating invoice:', error);
      throw error;
    }
  }

  static async sendInvoice(invoiceId, email, message) {
    console.log('FinancialService: Sending invoice:', invoiceId);

    try {
      const invoice = await Invoice.findById(invoiceId);

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const recipientEmail = String(email || invoice.customerEmail || '').trim();
      if (!recipientEmail) {
        throw new Error('Invoice recipient email is required');
      }

      let referenceNumber = '-';
      if (invoice.bookingId) {
        const booking = await Booking.findById(invoice.bookingId).select('bookingNumber').lean();
        referenceNumber = booking?.bookingNumber || String(invoice.bookingId);
      } else if (invoice.orderId?.orderNumber) {
        referenceNumber = String(invoice.orderId.orderNumber);
      } else if (invoice.orderId) {
        const order = await Order.findById(invoice.orderId).select('orderNumber').lean();
        referenceNumber = order?.orderNumber || String(invoice.orderId);
      }

      const customerName = String(invoice.customerName || '').trim() || 'Kunde';
      const invoiceAmount = Number(invoice.total || 0);
      const invoiceUrl = await EmailService.buildSystemUrl(`/invoices?invoiceId=${invoice._id}`);
      const InvoicePdfService = require('./invoicePdfService');
      const invoicePdf = await InvoicePdfService.generate(invoice);
      const safeInvoiceNumber = String(invoice.invoiceNumber || invoice._id).replace(/[^a-zA-Z0-9_-]/g, '_');

      const emailResult = await EmailService.sendTriggerEmail('invoice_created', recipientEmail, {
        companyName: process.env.COMPANY_NAME || 'McRepair.de',
        customerName,
        invoiceNumber: invoice.invoiceNumber,
        orderNumber: referenceNumber,
        invoiceAmount: `EUR ${invoiceAmount.toFixed(2)}`,
        dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('de-DE') : '-',
        paymentMethod: invoice.paymentMethod || 'Ueberweisung',
        invoiceUrl,
        customMessage: String(message || '').trim(),
        supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
        supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
      }, {
        attachments: [{
          filename: `Rechnung_${safeInvoiceNumber}.pdf`,
          content: invoicePdf,
          contentType: 'application/pdf'
        }]
      });

      if (!emailResult?.success) {
        throw new Error(emailResult?.error || 'Failed to send invoice email');
      }

      // Update invoice status
      invoice.status = 'sent';
      invoice.sentAt = new Date();
      await invoice.save();
      await FinancialService.syncPaymentDerivedState(invoice, 'sendInvoice');

      await NotificationService.createNotification({
        userId: invoice.customerId,
        title: 'Neue Rechnung verfuegbar',
        message: `Ihre Rechnung ${invoice.invoiceNumber} wurde versendet.`,
        type: 'system',
        orderId: invoice.orderId || undefined,
        actionUrl: '/customer/invoices',
        metadata: {
          isInvoice: true,
          invoiceId: String(invoice._id),
          invoiceNumber: invoice.invoiceNumber
        }
      }, { sendEmail: false });

      console.log('FinancialService: Invoice sent successfully');

      // Ehrliche Rueckmeldung: die Vorlage 'Neue Rechnung verfuegbar' enthaelt derzeit
      // KEINEN Platzhalter {{customMessage}}, die im Dialog verfasste persoenliche
      // Nachricht wird daher nicht mitgesendet. Das wird gemeldet statt verschwiegen.
      const composedMessage = String(message || '').trim();
      return {
        success: true,
        message: 'Rechnung wurde versendet.',
        recipientEmail,
        providerMessageId: emailResult?.messageId || '',
        customMessageDelivered: false,
        ...(composedMessage
          ? { warning: 'Die persönliche Nachricht wurde NICHT mitgesendet: die E-Mail-Vorlage "Neue Rechnung verfuegbar" enthält keinen Platzhalter dafür.' }
          : {}),
      };
    } catch (error) {
      console.error('FinancialService: Error sending invoice:', error);
      throw error;
    }
  }

  // Financial Reports
  static async getFinancialReports(filters = {}) {
    console.log('FinancialService: Generating financial reports');

    try {
      const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : new Date(new Date().getFullYear(), 0, 1);
      const dateTo = filters.dateTo ? new Date(filters.dateTo) : new Date();

      // Get revenue data
      const revenueData = await Payment.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: dateFrom, $lte: dateTo }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);

      // Get refund and dispute data
      const refundData = await Payment.aggregate([
        {
          $match: {
            status: { $in: ['refunded', 'disputed'] },
            createdAt: { $gte: dateFrom, $lte: dateTo }
          }
        },
        {
          $group: {
            _id: '$status',
            amount: { $sum: '$amount' }
          }
        }
      ]);

      // Get payment method breakdown
      const paymentMethodData = await Payment.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: dateFrom, $lte: dateTo }
          }
        },
        {
          $group: {
            _id: '$paymentMethod',
            amount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);

      // Get monthly trends
      const monthlyTrends = await Payment.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: new Date(dateTo.getFullYear() - 1, dateTo.getMonth(), 1), $lte: dateTo }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            revenue: { $sum: '$amount' },
            orders: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        },
        {
          $limit: 12
        }
      ]);

      const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;
      const refundAmount = refundData.find(r => r._id === 'refunded')?.amount || 0;
      const disputeAmount = refundData.find(r => r._id === 'disputed')?.amount || 0;

      // Calculate payment method breakdown with percentages
      const paymentMethodBreakdown = paymentMethodData.map(method => ({
        method: method._id.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        amount: method.amount,
        percentage: totalRevenue > 0 ? (method.amount / totalRevenue) * 100 : 0
      }));

      // Format monthly trends
      const formattedTrends = monthlyTrends.map(trend => ({
        month: new Date(trend._id.year, trend._id.month - 1).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short'
        }),
        revenue: trend.revenue,
        orders: trend.orders,
        avgOrderValue: trend.orders > 0 ? trend.revenue / trend.orders : 0
      }));

      const report = {
        period: `${dateFrom.toLocaleDateString()} - ${dateTo.toLocaleDateString()}`,
        totalRevenue,
        totalExpenses: totalRevenue * 0.4, // Mock calculation
        netProfit: totalRevenue * 0.6, // Mock calculation
        grossMargin: 60.0, // Mock percentage
        orderRevenue: totalRevenue * 0.85, // Mock calculation
        addonRevenue: totalRevenue * 0.10, // Mock calculation
        productRevenue: totalRevenue * 0.05, // Mock calculation
        refundAmount,
        disputeAmount,
        paymentMethodBreakdown,
        monthlyTrends: formattedTrends
      };

      console.log('FinancialService: Financial report generated successfully');
      return report;
    } catch (error) {
      console.error('FinancialService: Error generating financial reports:', error);
      throw error;
    }
  }

  // Payment Gateway Management
  static async getPaymentGateways() {
    console.log('FinancialService: Getting payment gateways');

    try {
      const fs = require('fs');
      const path = require('path');

      // Base gateways with default configuration
      const gateways = [
        {
          _id: 'gateway1',
          name: 'Stripe',
          provider: 'stripe',
          isActive: true,
          configuration: {
            mode: 'test',
            test_publishable_key: 'pk_test_51...',
            test_secret_key: 'sk_test_51...',
            live_publishable_key: '',
            live_secret_key: '',
            account_id: 'acct_1A2B3C4D5E6F7G8H9',
            api_version: '2023-08-16',
            use_stripe_checkout: true,
            payment_mode: 'payment',
            capture_method: 'automatic',
            statement_descriptor: 'McRepair.de Repair',
            success_url: 'https://shop.de/stripe/success',
            cancel_url: 'https://shop.de/stripe/cancel',
            allowed_payment_methods: ['card', 'paypal', 'klarna'],
            allow_saved_payment_method: true,
            payment_method_config_id: '',
            automatic_payment_methods: true,
            billing_address_collection: 'auto',
            shipping_address_collection: false,
            customer_creation: 'if_required',
            webhook_url: 'https://api.de/stripe/webhook',
            webhook_endpoint_secret: 'whsec_test_...',
            webhook_tolerance_sec: 300,
            webhook_events: ['payment_intent.succeeded', 'charge.refunded'],
            webhooks_enabled: true,
            http_timeout_ms: 10000,
            http_max_retries: 2,
            idempotency_enabled: true,
            idempotency_key_source: 'orderId',
            logging_level: 'error',
            log_request_bodies: false,
            log_response_bodies: false,
            list_page_size_default: 50,
            list_max_page_size: 100,
            currency: 'EUR',
            processingFee: 2.9,
            fraudProtection: true,
            default_currency: 'EUR',
            amount_source: 'system'
          },
          supportedMethods: ['card', 'paypal', 'klarna', 'ideal'],
          countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR'],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date()
        },
        {
          _id: 'gateway2',
          name: 'PayPal',
          provider: 'paypal',
          isActive: true,
          configuration: {
            publicKey: 'paypal_client_id',
            secretKey: 'paypal_client_secret',
            environment: 'sandbox',
            sandbox_client_id: 'Abc123...',
            sandbox_client_secret: 'Efg456...',
            live_client_id: '',
            live_client_secret: '',
            merchant_id: 'ABCDEF1234567',
            api_base_url_sandbox: 'https://api-m.sandbox.paypal.com',
            api_base_url_live: 'https://api-m.paypal.com',
            default_currency: 'EUR',
            allowed_currencies: ['EUR', 'USD'],
            payment_intent: 'CAPTURE',
            amount_source: 'system',
            send_breakdown: true,
            description_template: 'Bestellung {{orderId}}',
            invoice_id_source: 'orderId',
            return_url: 'https://shop.de/paypal/success',
            cancel_url: 'https://shop.de/paypal/cancel',
            button_enabled: true,
            button_layout: 'vertical',
            button_color: 'gold',
            button_shape: 'rect',
            button_label: 'paypal',
            locale: 'de-DE',
            funding_sources_allowed: ['paypal'],
            webhooks_enabled: true,
            webhook_url: 'https://api.de/paypal/webhook',
            webhook_events: ['CHECKOUT.ORDER.APPROVED', 'PAYMENT.CAPTURE.COMPLETED'],
            webhook_id: 'WH-1234...',
            http_timeout_ms: 10000,
            http_max_retries: 2,
            idempotency_enabled: true,
            idempotency_key_source: 'orderId',
            logging_level: 'error',
            log_request_bodies: false,
            log_response_bodies: false,
            list_page_size_default: 50,
            list_max_page_size: 100,
            currency: 'EUR',
            processingFee: 3.5,
            fraudProtection: true
          },
          supportedMethods: ['paypal', 'paypal_credit'],
          countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR'],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date()
        },
        {
          _id: 'gateway3',
          name: 'Banküberweisung',
          provider: 'bank_transfer',
          isActive: true,
          configuration: {
            enabled: true,
            code: 'bank_transfer',
            title: 'Vorkasse / Banküberweisung',
            description_checkout: 'Bitte überweisen Sie den Betrag auf das unten angegebene Konto.',
            account_holder: 'Max Mustermann',
            iban: 'DE00 0000 0000 0000 0000 00',
            bic: 'ABCDEFGHXXX',
            bank_name: 'Musterbank',
            payment_reference_template: 'Bestellnr. {{orderId}}',
            payment_term_days: 14,
            min_order_total: 0,
            max_order_total: 10000,
            allowed_customer_groups: ['b2c', 'b2b'],
            allowed_countries: ['DE', 'AT', 'CH'],
            allowed_shipping_methods: ['standard', 'express'],
            initial_order_status: 'pending_payment',
            expire_unpaid_orders: true,
            expire_action: 'cancel',
            email_instructions_enabled: true,
            email_instructions_text: 'Bitte überweisen Sie den Betrag innerhalb von 14 Tagen auf das angegebene Konto.',
            admin_can_mark_paid: true,
            mark_paid_requires_fields: ['amount', 'payment_date'],
            reporting_tag: 'BANK_TRANSFER',
            currency: 'EUR',
            processingFee: 0,
            fraudProtection: false
          },
          supportedMethods: ['bank_transfer'],
          countries: ['DE', 'AT', 'CH'],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date()
        },
        {
          _id: 'gateway4',
          name: 'Barzahlung',
          provider: 'cash',
          isActive: true,
          configuration: {
            enabled: true,
            code: 'cash_on_pickup',
            title: 'Barzahlung bei Abholung',
            description_checkout: 'Sie bezahlen bei Abholung in bar.',
            cash_mode: 'pickup',
            allowed_shipping_methods: ['pickup_store_1'],
            min_order_total: 0,
            max_order_total: 1000,
            allowed_customer_groups: ['b2c'],
            allowed_product_types: ['physical'],
            initial_order_status: 'waiting_for_pickup',
            mark_paid_on_fulfillment: false,
            admin_can_mark_paid: true,
            mark_paid_requires_fields: ['amount', 'payment_date', 'receipt_no'],
            cash_receipt_number_enabled: true,
            cash_receipt_number_format: 'POS{{storeId}}-{{yyyy}}{{MM}}{{dd}}-{{seq}}',
            email_instructions_enabled: true,
            email_instructions_text: 'Bitte halten Sie den Betrag passend bereit.',
            fee_type: 'none',
            fee_value: 0,
            fee_is_percentage: false,
            reporting_tag: 'CASH',
            sort_order: 20,
            currency: 'EUR',
            processingFee: 0,
            fraudProtection: false
          },
          supportedMethods: ['cash'],
          countries: ['DE', 'AT', 'CH'],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date()
        }
      ];

      // Try to load persisted configurations from files
      const configDir = path.join(process.cwd(), 'server', 'config', 'gateways');
      if (fs.existsSync(configDir)) {
        const files = fs.readdirSync(configDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const configFile = path.join(configDir, file);
              const persisted = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
              const gatewayId = file.replace('.json', '');
              
              // Find and merge with base gateway
              const idx = gateways.findIndex(g => g._id === gatewayId);
              if (idx >= 0) {
                gateways[idx] = { ...gateways[idx], ...persisted };
              }
            } catch (e) {
              console.warn(`Failed to load gateway config from ${file}:`, e.message);
            }
          }
        }
      }

      console.log('FinancialService: Payment gateways retrieved successfully');
      return gateways;
    } catch (error) {
      console.error('FinancialService: Error getting payment gateways:', error);
      throw error;
    }
  }

  static validateGatewayConfiguration(gateway) {
    const errors = [];
    const config = gateway?.configuration || {};

    // Basic validation (all gateways)
    if (!gateway?.name?.trim()) errors.push('Name is required');
    if (!config.currency?.trim()) errors.push('Currency is required');
    if (typeof config.processingFee !== 'number' || config.processingFee < 0) errors.push('Processing Fee must be >= 0');

    // PayPal-specific validation
    if (gateway?.provider === 'paypal') {
      if (!config.environment) errors.push('environment is required');
      if (!config.sandbox_client_id?.trim()) errors.push('sandbox_client_id is required');
      if (!config.sandbox_client_secret?.trim()) errors.push('sandbox_client_secret is required');
      if (!config.default_currency?.trim()) errors.push('default_currency is required');
      if (!config.payment_intent) errors.push('payment_intent is required');
      if (!config.amount_source) errors.push('amount_source is required');
      if (!config.return_url?.trim()) errors.push('return_url is required');
      if (!config.cancel_url?.trim()) errors.push('cancel_url is required');

      // Validate URLs
      const urlFields = ['return_url', 'cancel_url', 'webhook_url'];
      for (const field of urlFields) {
        const value = config[field];
        if (value && typeof value === 'string' && value.trim() !== '' && !value.startsWith('http')) {
          errors.push(`${field} must start with http:// or https://`);
        }
      }
    }

    // Stripe-specific validation
    if (gateway?.provider === 'stripe') {
      if (!config.mode) errors.push('mode is required');
      if (!config.test_publishable_key?.trim()) errors.push('test_publishable_key is required');
      if (!config.test_secret_key?.trim()) errors.push('test_secret_key is required');
      if (!config.default_currency?.trim()) errors.push('default_currency is required');
      if (!config.amount_source) errors.push('amount_source is required');
      if (!config.payment_mode) errors.push('payment_mode is required');
      if (!config.success_url?.trim()) errors.push('success_url is required');
      if (!config.cancel_url?.trim()) errors.push('cancel_url is required');

      // Validate URLs
      const urlFields = ['success_url', 'cancel_url', 'webhook_url'];
      for (const field of urlFields) {
        const value = config[field];
        if (value && typeof value === 'string' && value.trim() !== '' && !value.startsWith('http')) {
          errors.push(`${field} must start with http:// or https://`);
        }
      }
    }

    // bank_transfer-specific validation
    if (gateway?.provider === 'bank_transfer') {
      if (!config.code?.trim()) errors.push('code is required');
      if (!config.title?.trim()) errors.push('title is required');
      if (!config.account_holder?.trim()) errors.push('account_holder is required');
      if (!config.iban?.trim()) errors.push('iban is required');
      if (!config.payment_reference_template?.trim()) errors.push('payment_reference_template is required');
      if (!config.initial_order_status?.trim()) errors.push('initial_order_status is required');
      if (config.admin_can_mark_paid === undefined || config.admin_can_mark_paid === null) errors.push('admin_can_mark_paid is required');
    }

    // cash-specific validation
    if (gateway?.provider === 'cash') {
      if (!config.code?.trim()) errors.push('code is required');
      if (!config.title?.trim()) errors.push('title is required');
      if (!config.cash_mode) errors.push('mode is required');
      if (!config.initial_order_status?.trim()) errors.push('initial_order_status is required');
      if (config.admin_can_mark_paid === undefined || config.admin_can_mark_paid === null) errors.push('admin_can_mark_paid is required');
    }

    return { valid: errors.length === 0, errors };
  }

  static async updatePaymentGateway(gatewayId, updates) {
    console.log('FinancialService: Updating payment gateway:', gatewayId);

    try {
      const fs = require('fs');
      const path = require('path');

      // Path to store gateway configurations
      const configDir = path.join(process.cwd(), 'server', 'config', 'gateways');
      const configFile = path.join(configDir, `${gatewayId}.json`);

      // Ensure directory exists
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Update timestamp
      const updatedGateway = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Persist to file
      fs.writeFileSync(configFile, JSON.stringify(updatedGateway, null, 2), 'utf-8');

      console.log('FinancialService: Payment gateway updated and persisted successfully:', configFile);
      return updatedGateway;
    } catch (error) {
      console.error('FinancialService: Error updating payment gateway:', error);
      throw error;
    }
  }

  // Create payment from order
  static async createPaymentFromOrder(orderId) {
    console.log('FinancialService: Creating payment from order:', orderId);

    try {
      const order = await Order.findById(orderId).populate('customerId');

      if (!order) {
        throw new Error('Order not found');
      }

      const financialProfile = await FinancialService.resolveFinancialProfile({ customer: order.customerId });

      const amount = typeof order.totalCost === 'object' ? Number(order.totalCost) : order.totalCost;
      const paymentMethod = financialProfile.defaultPaymentMethod || 'credit_card';

      const payment = new Payment({
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerId: order.customerId._id,
        customerName: order.customerId.name,
        amount: amount,
        paymentMethod: paymentMethod,
        gatewayResponse: 'Payment created'
      });

      await payment.save();

      console.log('FinancialService: Payment created from order successfully with resolved method:', paymentMethod);
      return payment;
    } catch (error) {
      console.error('FinancialService: Error creating payment from order:', error);
      throw error;
    }
  }

  // Create invoice from order
  // options.additionalItems: zusaetzliche BRUTTO-Positionen (z.B. Servicepauschale),
  // die bereits im order.totalCost enthalten sind und deshalb nicht doppelt zaehlen duerfen.
  static async createInvoiceFromOrder(orderId, options = {}) {
    console.log('FinancialService: Creating invoice from order:', orderId);

    try {
      const order = await Order.findById(orderId).populate('customerId');

      if (!order) {
        throw new Error('Order not found');
      }

      if (order.bookingId) {
        const existingInvoice = await Invoice.findOne({ bookingId: order.bookingId })
          .select('_id invoiceNumber')
          .lean();
        if (existingInvoice) {
          const duplicateError = new Error(`An invoice already exists for this booking (${existingInvoice.invoiceNumber || existingInvoice._id})`);
          duplicateError.statusCode = 409;
          duplicateError.code = 'INVOICE_ALREADY_EXISTS';
          duplicateError.existingInvoice = {
            _id: String(existingInvoice._id),
            invoiceNumber: existingInvoice.invoiceNumber || null,
          };
          throw duplicateError;
        }
      }

      const financialProfile = await FinancialService.resolveFinancialProfile({ customer: order.customerId });

      // Convert totalCost to number if it's a Decimal128
      const totalCost = typeof order.totalCost === 'object' ? Number(order.totalCost) : order.totalCost;

      const additionalItems = Array.isArray(options.additionalItems) ? options.additionalItems : [];
      const additionalGrossTotal = CalculationHelper.round(
        additionalItems.reduce((sum, item) => sum + Number(item.total || 0), 0)
      );

      // Rechnungspositionen mit echten Service-/Produktnamen und Geraetekennzeichnung.
      const items = buildInvoiceItemsFromOrder(order);

      // Der Warenkorb-/Promo-Rabatt steckt bereits in order.totalCost, nicht in den
      // Positionspreisen - er wird deshalb als Rechnungsrabatt (Brutto) weitergereicht.
      let orderDiscount = 0;
      if (items.length > 0) {
        orderDiscount = CalculationHelper.round(Math.max(0, Number(order.discount || 0)));
      } else {
        // Fallback ohne Positionsdaten: eine Sammelposition aus dem Auftragswert.
        items.push({
          serviceName: `${buildDeviceLabel(order)} Reparatur`,
          description: `${buildDeviceLabel(order)} Reparatur`,
          quantity: 1,
          unitPrice: CalculationHelper.round(Math.max(0, Number(totalCost || 0) - additionalGrossTotal)),
          total: CalculationHelper.round(Math.max(0, Number(totalCost || 0) - additionalGrossTotal)),
          type: 'service'
        });
      }

      additionalItems.forEach((item) => items.push({ ...item }));

      const isReverseCharge = Boolean(
        financialProfile.taxMode === 'reverse_charge' ||
        Boolean(order.customerId?.vatId && order.customerId?.country && order.customerId.country !== 'DE')
      );
      const itemsGrossTotal = CalculationHelper.round(items.reduce((sum, item) => sum + Number(item.total || 0), 0));
      const discount = CalculationHelper.round(
        orderDiscount
        + calculateDiscountAmount(
          CalculationHelper.round(itemsGrossTotal - orderDiscount),
          financialProfile.defaultDiscountPercent
        )
      );
      const dueDays = financialProfile.paymentDueDays || 30;
      const paymentTerms = composePaymentTerms(financialProfile);

      const invoice = new Invoice({
        orderId: order._id,
        bookingId: order.bookingId || undefined,
        customerId: order.customerId._id,
        customerName: order.customerId.name,
        customerEmail: order.customerId.email,
        customerVatId: (order.customerId?.vatId || '').trim(),
        sellerVatId: (financialProfile.sellerVatId || 'DE318981969').trim(),
        isReverseCharge,
        reverseChargeNotice: isReverseCharge ? 'Steuerschuldnerschaft des Leistungsempfängers / Reverse Charge' : undefined,
        zmRelevant: isReverseCharge,
        taxRate: isReverseCharge ? 0 : financialProfile.taxRate,
        billingAddress: resolveBillingAddressFromOrder(order),
        shippingAddress: resolveShippingAddressFromOrder(order),
        items,
        // subtotal (Netto), tax und total (Brutto) werden vom Invoice-Modell
        // brutto-first aus den Positionen und dem Rabatt abgeleitet.
        discount,
        dueDate: new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000),
        paymentTerms,
        status: 'sent',
        sentAt: new Date(),
      });

      await invoice.save();
      const finalized = await FinancialService.finalizeInvoiceCreation(invoice);

      console.log('FinancialService: Invoice created from order successfully with resolved tax rate:', financialProfile.taxRate + '%');
      return finalized;
    } catch (error) {
      console.error('FinancialService: Error creating invoice from order:', error);
      throw error;
    }
  }
  // Create invoice from one or more repair order / booking IDs
  static async generateFromRepairOrders(repairOrderIds, options = {}) {
    console.log('FinancialService: Generating invoice from repair orders:', repairOrderIds);

    if (!repairOrderIds || repairOrderIds.length === 0) {
      throw new Error('At least one repair order ID is required');
    }

    const orders = await Order.find({ _id: { $in: repairOrderIds } }).populate('customerId');

    if (orders.length === 0) {
      throw new Error('No repair orders found for the given IDs');
    }

    // All orders must belong to the same customer
    const customerIds = [...new Set(orders.map(o => String(o.customerId._id)))];
    if (customerIds.length > 1) {
      throw new Error('All repair orders must belong to the same customer');
    }

    const customer = orders[0].customerId;
    const financialProfile = await FinancialService.resolveFinancialProfile({ customer });
    const items = [];

    let ordersDiscount = 0;
    orders.forEach(order => {
      const totalCost = typeof order.totalCost === 'object' ? Number(order.totalCost) : (order.totalCost || 0);
      const orderItems = buildInvoiceItemsFromOrder(order);

      if (orderItems.length > 0) {
        orderItems.forEach((item) => items.push(item));
        ordersDiscount = CalculationHelper.round(ordersDiscount + Math.max(0, Number(order.discount || 0)));
      } else {
        const deviceLabel = buildDeviceLabel(order);
        items.push({
          serviceName: `${deviceLabel} Reparatur`,
          description: `${deviceLabel} Reparatur (Auftrag ${order.orderNumber || order._id})`,
          quantity: 1,
          unitPrice: totalCost,
          total: totalCost,
          type: 'service'
        });
      }
    });

    const isReverseCharge = Boolean(
      options.isReverseCharge !== undefined
        ? options.isReverseCharge
        : (financialProfile.taxMode === 'reverse_charge' || (customer?.vatId && customer?.country && customer.country !== 'DE'))
    );
    // Positionspreise sind BRUTTO; Netto/MwSt rechnet das Invoice-Modell heraus.
    // options.taxRate ist ein PROZENTWERT (z.B. 19), kein Faktor.
    const itemsGrossTotal = CalculationHelper.round(items.reduce((s, i) => s + Number(i.total || 0), 0));
    const taxRate  = isReverseCharge ? 0 : normalizeTaxRatePercent(options.taxRate, financialProfile.taxRate);
    // Zwei unabhaengige Rabattquellen, die sich ADDIEREN und einander nie ersetzen:
    //  1. ordersDiscount: der Warenkorb-/Promo-Rabatt der Auftraege. Er steckt nicht in
    //     den Positionspreisen (die sind Listen-Brutto) und muss immer durchgereicht
    //     werden, sonst wird der Kunde um genau diesen Betrag zu hoch belastet.
    //  2. Der manuelle Rabatt des Aufrufers (options.discount) bzw. - wenn keiner
    //     uebergeben wurde - der Kundengruppenrabatt auf den bereits gemindertem Brutto.
    const manualDiscount = options.discount != null
      ? CalculationHelper.round(Math.max(0, Number(options.discount) || 0))
      : calculateDiscountAmount(
        CalculationHelper.round(itemsGrossTotal - ordersDiscount),
        financialProfile.defaultDiscountPercent
      );
    const discount = CalculationHelper.round(
      Math.min(itemsGrossTotal, ordersDiscount + manualDiscount)
    );

    const bookingIds = [...new Set(orders.map((order) => toIdString(order.bookingId)).filter(Boolean))];
    const bookingId = bookingIds.length === 1 ? bookingIds[0] : undefined;

    if (bookingId) {
      const existingInvoice = await Invoice.findOne({ bookingId })
        .select('_id invoiceNumber')
        .lean();
      if (existingInvoice) {
        const duplicateError = new Error(`An invoice already exists for this booking (${existingInvoice.invoiceNumber || existingInvoice._id})`);
        duplicateError.statusCode = 409;
        throw duplicateError;
      }
    }

    const invoiceData = {
      repairOrderIds,
      orderId: orders.length === 1 ? orders[0]._id : undefined,
      bookingId,
      customerId:    customer._id,
      customerName:  customer.name,
      customerEmail: customer.email,
      customerVatId: (options.customerVatId || customer.vatId || '').trim(),
      sellerVatId:   (options.sellerVatId || financialProfile.sellerVatId || 'DE318981969').trim(),
      isReverseCharge,
      reverseChargeNotice: isReverseCharge ? (options.reverseChargeNotice || 'Steuerschuldnerschaft des Leistungsempfängers / Reverse Charge') : undefined,
      zmRelevant:    isReverseCharge,
      billingAddress: resolveBillingAddressFromOrder(orders[0]),
      shippingAddress: resolveShippingAddressFromOrder(orders[0]),
      items,
      // subtotal (Netto), tax und total (Brutto) leitet das Invoice-Modell ab.
      taxRate,
      discount,
      dueDate:       options.dueDate || new Date(Date.now() + (financialProfile.paymentDueDays || 30) * 24 * 60 * 60 * 1000),
      paymentTerms:  options.paymentTerms || composePaymentTerms(financialProfile),
      notes:         options.notes || '',
      status:        'sent',
      sentAt:        new Date()
    };

    const invoice = new Invoice(invoiceData);
    await invoice.save();
    const finalized = await FinancialService.finalizeInvoiceCreation(invoice);

    console.log('FinancialService: Invoice generated from repair orders:', invoice.invoiceNumber);
    return finalized;
  }

  // Change invoice status with transition validation
  static async changeInvoiceStatus(invoiceId, newStatus, data = {}) {
    console.log('FinancialService: Changing invoice status:', invoiceId, '->', newStatus);

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) throw buildFinancialError('Rechnung wurde nicht gefunden.', 404, 'INVOICE_NOT_FOUND');

    const allowed = INVOICE_STATUS_TRANSITIONS[invoice.status] || [];
    if (!allowed.includes(newStatus)) {
      throw buildFinancialError(
        `Ein Beleg im Status "${invoiceStatusLabelDe(invoice.status)}" kann nicht auf "${invoiceStatusLabelDe(newStatus)}" gesetzt werden.`,
        409,
        'INVOICE_STATUS_TRANSITION_INVALID'
      );
    }

    const normalizedPaymentMethod = normalizeTrackedPaymentMethod(data.paymentMethod);
    const normalizedPaidAt = normalizeTrackedPaidAt(data.paidAt);

    if (data.paymentMethod && !normalizedPaymentMethod) {
      throw buildFinancialError('Ungültige Zahlart. Erlaubt sind: Kreditkarte, SEPA, PayPal, Bar.', 400, 'INVALID_PAYMENT_METHOD');
    }

    if (data.paidAt && !normalizedPaidAt) {
      throw buildFinancialError('Ungültiges Zahlungsdatum.', 400, 'INVALID_PAID_AT');
    }

    if (newStatus === 'paid') {
      if (!normalizedPaymentMethod) {
        throw buildFinancialError('Zum Setzen auf "bezahlt" wird die Zahlart benötigt.', 400, 'PAYMENT_METHOD_REQUIRED');
      }
      if (!normalizedPaidAt) {
        throw buildFinancialError('Zum Setzen auf "bezahlt" wird das Zahlungsdatum benötigt.', 400, 'PAID_AT_REQUIRED');
      }
    }

    invoice.status = newStatus;

    if (newStatus === 'sent') {
      invoice.sentAt = new Date();
    } else if (newStatus === 'pending_approval') {
      // no extra field
    } else if (newStatus === 'paid') {
      invoice.paidAt = normalizedPaidAt;
      invoice.paymentMethod = normalizedPaymentMethod;
      invoice.paidAmount = invoice.total;
    } else if (newStatus === 'cancelled') {
      invoice.cancelledAt = new Date();
    } else if (newStatus === 'approved') {
      invoice.approvedAt = new Date();
    }

    if (newStatus !== 'paid') {
      invoice.paymentMethod = normalizedPaymentMethod;
      if (normalizedPaidAt) {
        invoice.paidAt = normalizedPaidAt;
      }
    }

    if (data.notes) invoice.notes = data.notes;

    await invoice.save();

    // Abgeleitete Zustaende nicht fatal nachziehen: der Statuswechsel ist bereits
    // gespeichert und darf nicht nachtraeglich an einem Altbestands-Dokument scheitern.
    await FinancialService.syncPaymentDerivedState(invoice, 'changeInvoiceStatus');

    return invoice;
  }

  /**
   * Leitet invoice.paidAmount (und den daraus folgenden Zahlungsstatus) fuer die
   * uebergebenen Rechnungen NEU aus den gueltigen Zuordnungen ab.
   *
   * Bewusst per updateOne statt save(): der Betragshook des Rechnungsmodells darf
   * festgeschriebene Belege nicht neu berechnen - hier aendert sich nur der
   * Zahlungsstand, nie der Rechnungsbetrag.
   */
  static async recalculateInvoicePaidAmounts(invoiceIds = []) {
    const ids = [...new Set((invoiceIds || []).map((entry) => toIdString(entry)).filter(Boolean))];
    if (ids.length === 0) return [];

    const allocated = await PaymentService.getAllocatedTotalsByInvoice(ids);
    const updated = [];

    for (const invoiceId of ids) {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) continue;

      const paidAmount = CalculationHelper.round(Number(allocated.get(invoiceId) || 0));
      const total = CalculationHelper.round(Number(invoice.total || 0));
      const update = { paidAmount };

      // Der BETRAG wird immer geschrieben, der BELEGSTATUS nur bei freigegebenen
      // Belegen: ein Entwurf oder ein Beleg in Freigabe darf auch ueber diesen Weg
      // nicht nach 'paid'/'partially_paid' gedraengt werden (denselben Schutz hat
      // PaymentService.allocateAtomically). Storniert/gutgeschrieben bleibt ebenfalls
      // unberuehrt.
      if (PAYMENT_DERIVED_STATUS_WRITABLE.includes(String(invoice.status || ''))) {
        if (total > 0 && paidAmount >= total - 0.01) {
          update.status = 'paid';
          update.paidAt = invoice.paidAt || new Date();
        } else if (paidAmount > 0.009) {
          update.status = 'partially_paid';
          update.paidAt = null;
        } else if (['paid', 'partially_paid'].includes(invoice.status)) {
          update.status = invoice.dueDate && new Date(invoice.dueDate) < new Date() ? 'overdue' : 'sent';
          update.paidAt = null;
        }
      }

      await Invoice.updateOne({ _id: invoice._id }, { $set: update });
      const refreshed = await Invoice.findById(invoice._id);
      await FinancialService.syncPaymentDerivedState(refreshed, 'recalculatePaidAmount');
      updated.push(refreshed);
    }

    return updated;
  }

  /**
   * Gemeinsamer Abschluss JEDER Rechnungserstellung.
   *
   * Bereits eingegangene, noch nicht zugeordnete Zahlungen der Buchung werden dem
   * neuen Beleg zugeordnet (Vorauszahlung -> spaetere Rechnung) und der abgeleitete
   * Zahlungsstand wird fortgeschrieben. Die Rechnung wird danach NEU GELESEN, weil
   * die Zuordnung ihre eigene Instanz speichert - sonst gibt der Aufrufer einen
   * veralteten Beleg (paidAmount 0, Status 'sent') an den Client zurueck.
   *
   * Absichtlich an EINER Stelle gebuendelt, damit ein neuer Erstellungspfad die
   * Zuordnung nicht erneut vergessen kann.
   */
  static async finalizeInvoiceCreation(invoice) {
    if (!invoice) return invoice;

    const bookingId = toIdString(invoice.bookingId);
    if (bookingId) {
      try {
        await FinancialService.autoAllocateUnallocatedPayments(bookingId);
      } catch (error) {
        console.error('FinancialService: auto allocation after invoice creation failed:', error);
      }
    }

    const refreshed = await Invoice.findById(invoice._id);
    await FinancialService.syncPaymentDerivedState(refreshed || invoice, 'invoiceCreated');
    return refreshed || invoice;
  }

  static async syncOrderPaymentTracking(invoiceInput) {
    const invoice = invoiceInput && typeof invoiceInput.toObject === 'function'
      ? invoiceInput.toObject()
      : invoiceInput;
    if (!invoice) return;

    const orderIds = [];
    if (invoice.orderId) orderIds.push(invoice.orderId);
    if (Array.isArray(invoice.repairOrderIds) && invoice.repairOrderIds.length > 0) {
      orderIds.push(...invoice.repairOrderIds);
    }

    const uniqueOrderIds = [...new Set(orderIds.map((entry) => toIdString(entry)).filter(Boolean))];
    if (uniqueOrderIds.length === 0) return;

    const orderObjectIds = uniqueOrderIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (orderObjectIds.length === 0) return;

    // TRENNUNG DER ACHSEN (Regel 1 in paymentService.js): Order.paymentStatus ist ein
    // ZAHLUNGSstand und wird deshalb aus den gueltigen Zuordnungen ALLER Belege
    // abgeleitet, die diesen Auftrag betreffen - nicht aus dem Belegstatus der
    // zufaellig zuletzt synchronisierten Rechnung. Frueher hat bei mehreren Belegen
    // einer Buchung der letzte Lauf den Stand der anderen ueberschrieben, und eine
    // stornierte oder auf 'sent' zurueckgesetzte Rechnung hat den Auftrag auf
    // 'pending' gedrueckt, obwohl das Geld weiterhin gegen ihn steht.
    const relatedInvoices = await Invoice.find({
      $or: [
        { orderId: { $in: orderObjectIds } },
        { repairOrderIds: { $in: orderObjectIds } },
      ],
    })
      .select('_id orderId repairOrderIds total status isCreditNote')
      .lean();

    const receivables = relatedInvoices.filter((entry) => !entry.isCreditNote && entry.status !== 'cancelled');
    const creditNotes = relatedInvoices.filter((entry) => entry.isCreditNote && entry.status !== 'cancelled');
    const allocatedByInvoice = await PaymentService.getAllocatedTotalsByInvoice(receivables.map((entry) => entry._id));

    // Auch direkt auf den Auftrag gestempeltes Geld zaehlt: eine Vorauszahlung ohne
    // Beleg darf den Auftrag nicht als 'pending' erscheinen lassen.
    const orderPayments = await Payment.find({
      orderId: { $in: orderObjectIds },
      status: { $in: PaymentService.COUNTABLE_PAYMENT_STATUSES },
    })
      .select('_id orderId amount refundAmount status paymentDate processedAt paymentMethod')
      .lean();

    const invoiceOrderKeys = (entry) => {
      const keys = [];
      if (entry.orderId) keys.push(toIdString(entry.orderId));
      if (Array.isArray(entry.repairOrderIds)) keys.push(...entry.repairOrderIds.map((id) => toIdString(id)));
      return [...new Set(keys.filter((key) => uniqueOrderIds.includes(key)))];
    };

    const emptyState = () => ({ invoiced: 0, allocated: 0, credited: 0, received: 0, paidAt: null, paymentMethod: null });
    const stateByOrder = new Map(uniqueOrderIds.map((id) => [id, emptyState()]));

    receivables.forEach((entry) => {
      const allocated = Number(allocatedByInvoice.get(toIdString(entry._id)) || 0);
      const total = CalculationHelper.round(Math.abs(Number(entry.total || 0)));
      invoiceOrderKeys(entry).forEach((key) => {
        const state = stateByOrder.get(key);
        if (!state) return;
        state.invoiced = CalculationHelper.round(state.invoiced + total);
        state.allocated = CalculationHelper.round(state.allocated + allocated);
      });
    });

    creditNotes.forEach((entry) => {
      const total = CalculationHelper.round(Math.abs(Number(entry.total || 0)));
      invoiceOrderKeys(entry).forEach((key) => {
        const state = stateByOrder.get(key);
        if (!state) return;
        state.credited = CalculationHelper.round(state.credited + total);
      });
    });

    orderPayments.forEach((payment) => {
      const state = stateByOrder.get(toIdString(payment.orderId));
      if (!state) return;
      state.received = CalculationHelper.round(state.received + PaymentService.effectivePaymentAmount(payment));
      const stamp = normalizeTrackedPaidAt(payment.processedAt || payment.paymentDate);
      if (stamp && (!state.paidAt || stamp > state.paidAt)) {
        state.paidAt = stamp;
        state.paymentMethod = normalizeTrackedPaymentMethod(payment.paymentMethod) || state.paymentMethod;
      }
    });

    const fallbackPaymentMethod = normalizeTrackedPaymentMethod(invoice.paymentMethod);
    const fallbackPaidAt = normalizeTrackedPaidAt(invoice.paidAt);
    const paidOrderIds = [];

    for (const orderId of uniqueOrderIds) {
      const state = stateByOrder.get(orderId);
      if (!state) continue;

      const open = CalculationHelper.round(Math.max(0, state.invoiced - state.allocated));
      const moneyHeld = Math.max(state.allocated, state.received);

      let paymentStatus = 'pending';
      if (state.invoiced > 0.009 && state.credited >= state.invoiced - 0.009) paymentStatus = 'refunded';
      else if (state.invoiced > 0.009 && open <= 0.009) paymentStatus = 'paid';
      else if (moneyHeld > 0.009) paymentStatus = 'partial';

      if (paymentStatus === 'paid') paidOrderIds.push(orderId);

      await Order.updateOne(
        { _id: orderId },
        {
          $set: {
            paymentStatus,
            paymentMethod: state.paymentMethod || fallbackPaymentMethod,
            paidAt: paymentStatus === 'paid' ? (state.paidAt || fallbackPaidAt) : (state.paidAt || null),
          }
        }
      );
    }

    if (paidOrderIds.length > 0) {
      await Order.updateMany(
        { _id: { $in: paidOrderIds }, requiresPaymentBeforeCompletion: true },
        { $set: { requiresPaymentBeforeCompletion: false } }
      );

      const paidOrders = await Order.find({ _id: { $in: paidOrderIds }, sourceComplaintId: { $ne: null } })
        .select('sourceComplaintId')
        .lean();
      const complaintIds = [...new Set(paidOrders.map((order) => toIdString(order.sourceComplaintId)).filter(Boolean))];

      if (complaintIds.length > 0) {
        await Complaint.updateMany(
          { _id: { $in: complaintIds }, status: 'awaiting_payment' },
          { $set: { status: 'closed' } }
        );
      }
    }
  }

  static async syncBookingPaymentStatus(invoiceInput) {
    const invoice = invoiceInput && typeof invoiceInput.toObject === 'function'
      ? invoiceInput.toObject()
      : invoiceInput;
    if (!invoice) return;

    let bookingId = invoice.bookingId;

    if (!bookingId && invoice.orderId) {
      const order = await Order.findById(invoice.orderId).select('bookingId').lean();
      bookingId = order?.bookingId;
    }

    if (!bookingId && Array.isArray(invoice.repairOrderIds) && invoice.repairOrderIds.length > 0) {
      const repairOrderIds = invoice.repairOrderIds.map((entry) => toIdString(entry)).filter(Boolean);
      const linkedOrder = repairOrderIds.length > 0
        ? await Order.findOne({
            _id: { $in: repairOrderIds },
            bookingId: { $ne: null }
          }).select('bookingId').lean()
        : null;
      bookingId = linkedOrder?.bookingId;
    }

    if (!bookingId) return;

    await FinancialService.applyBookingPaymentState(bookingId);
  }

  /**
   * Schreibt den ZAHLUNGSSTAND einer Buchung aus den tatsaechlichen Zahlungen.
   *
   * Frueher wurde hier Invoice.status 1:1 nach booking.paymentStatus kopiert. Damit
   * landete ein BELEGSTATUS ('sent'/'versendet') im Zahlungsfeld und verdeckte ein
   * 'teilbezahlt'. Erfuellung (booking.status, booking.shippingStatus) und Zahlung
   * (billingStatus/paymentStatus) sind jetzt getrennt: eine Buchung kann gleichzeitig
   * versendet UND teilbezahlt sein.
   */
  static async applyBookingPaymentState(bookingInput) {
    const booking = bookingInput && typeof bookingInput.save === 'function'
      ? bookingInput
      : await Booking.findById(toIdString(bookingInput));
    if (!booking) return null;

    const orders = await Order.find({ bookingId: booking._id })
      .setOptions({ skipAutoPopulate: true })
      .select('_id')
      .lean();

    const balance = await PaymentService.computeBookingBalance({
      bookingId: booking._id,
      orderIds: orders.map((order) => order._id),
      orderValue: Number(booking.totalCost || 0),
    });
    if (!balance) return null;

    let billingStatus = 'unpaid';
    if (balance.overpaid > 0.009) billingStatus = 'overpaid';
    else if (balance.reference > 0.009 && balance.open <= 0.009) billingStatus = 'paid';
    else if (balance.received > 0.009) billingStatus = 'partially-paid';

    // paymentStatus fuehrt nur noch Zahlungswerte - niemals einen Belegstatus.
    const paymentStatusMap = {
      unpaid: 'pending',
      'partially-paid': 'partial',
      paid: 'paid',
      overpaid: 'paid',
    };

    booking.billingStatus = billingStatus;
    booking.paymentStatus = paymentStatusMap[billingStatus] || 'pending';
    await booking.save();

    return { booking, balance, billingStatus };
  }

  /**
   * Abgeleitete Folgezustaende (Auftrag, Buchung) nachziehen.
   *
   * Bewusst NICHT fatal: die Geldbuchung ist zu diesem Zeitpunkt bereits geschrieben.
   * Ein Fehler beim Fortschreiben abgeleiteter Zustaende - etwa ein Altbestands-
   * Booking, das die heutige Pflichtfeld-Validierung nicht mehr besteht - darf die
   * Zahlung nicht nachtraeglich als Fehler erscheinen lassen. Der Aufruf ist
   * idempotent und kann jederzeit wiederholt werden.
   */
  static async syncPaymentDerivedState(invoice, context = 'payment') {
    const warnings = [];
    try {
      await FinancialService.syncOrderPaymentTracking(invoice);
    } catch (error) {
      warnings.push(`syncOrderPaymentTracking: ${error.message}`);
      console.error(`FinancialService: derived order state not updated (${context}):`, error);
    }
    try {
      await FinancialService.syncBookingPaymentStatus(invoice);
    } catch (error) {
      warnings.push(`syncBookingPaymentStatus: ${error.message}`);
      console.error(`FinancialService: derived booking state not updated (${context}):`, error);
    }
    return warnings;
  }

  /**
   * Doppelbuchungsschutz fuer manuell erfasste Auftragszahlungen.
   * Liefert die zu verwendenden Idempotenzschluessel und - falls vorhanden - die
   * bereits gebuchte identische Zahlung.
   */
  static async findManualPaymentDuplicate({ bookingId, invoiceId, amount, paymentMethod, paymentDate, paymentReference, note, idempotencyKey }) {
    const fingerprint = [
      'booking', toIdString(bookingId), toIdString(invoiceId),
      CalculationHelper.round(Number(amount)).toFixed(2), String(paymentMethod || ''),
      new Date(paymentDate || Date.now()).toISOString().slice(0, 10),
      String(paymentReference || ''), String(note || ''),
    ];
    return findDuplicatePayment('booking-payment', fingerprint, idempotencyKey);
  }

  // Record a partial (or full) payment against an invoice
  //
  // Der gesamte Vorgang ist in sich stimmig: entweder Zahlung + Zuordnung +
  // Rechnungsstand sind geschrieben und der Aufrufer bekommt 2xx, oder es wurde
  // nichts gebucht und der Aufrufer bekommt einen Fehler. Das Fortschreiben der
  // abgeleiteten Zustaende (Auftrag/Buchung) kann die bereits gebuchte Zahlung
  // nicht mehr scheitern lassen - es wird als Warnung zurueckgegeben.
  //
  // paymentData.idempotencyKey (optional) verhindert eine Doppelbuchung bei Retry
  // oder Doppelklick; ohne Schluessel greift ein serverseitig abgeleiteter
  // Fingerabdruck ueber ein 5-Minuten-Fenster.
  static async addInvoicePayment(invoiceId, paymentData) {
    console.log('FinancialService: Adding payment to invoice:', invoiceId);

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) throw buildFinancialError('Rechnung wurde nicht gefunden.', 404, 'INVOICE_NOT_FOUND');

    const allowedStatuses = ['draft', 'pending_approval', 'sent', 'viewed', 'partially_paid', 'overdue'];
    if (!allowedStatuses.includes(invoice.status)) {
      throw buildFinancialError(
        `Für eine Rechnung im Status "${invoiceStatusLabelDe(invoice.status)}" kann keine Zahlung erfasst werden.`,
        409,
        'INVOICE_STATUS_NOT_PAYABLE'
      );
    }

    const amount = CalculationHelper.round(parseFloat(paymentData.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw buildFinancialError('Der Zahlungsbetrag muss größer als 0 sein.', 400, 'INVALID_AMOUNT');
    }

    const paymentDate = paymentData.paymentDate ? new Date(paymentData.paymentDate) : new Date();
    const paymentMethod = paymentData.paymentMethod || 'bank_transfer';
    const note = paymentData.note || paymentData.gatewayResponse || '';

    // Doppelbuchungsschutz VOR der Betragspruefung: eine Wiederholung desselben
    // Requests ist bereits gebucht und darf dem Bearbeiter nicht als
    // "Betrag übersteigt den offenen Rechnungsbetrag" gemeldet werden - genau diese
    // irrefuehrende Meldung entstuende sonst beim Retry nach dem ersten Erfolg.
    const fingerprint = [
      'invoice', toIdString(invoice._id), amount.toFixed(2), paymentMethod,
      new Date(paymentDate).toISOString().slice(0, 10),
      String(paymentData.paymentReference || ''), String(note),
    ];
    const { keys, existing } = await findDuplicatePayment('invoice-payment', fingerprint, paymentData.idempotencyKey);
    if (existing) {
      console.warn('FinancialService: duplicate invoice payment suppressed for invoice', String(invoice._id));
      const currentInvoice = await Invoice.findById(invoice._id);
      return {
        payment: existing,
        invoice: currentInvoice,
        duplicate: true,
        message: 'Diese Zahlung wurde bereits erfasst und nicht erneut gebucht.',
        warnings: [],
      };
    }

    const balanceBefore = await PaymentService.computeInvoiceBalance(invoice);
    const remaining = CalculationHelper.round(balanceBefore ? balanceBefore.open : Number(invoice.total || 0) - Number(invoice.paidAmount || 0));
    if (amount > remaining + 0.01) {
      throw buildFinancialError(
        `Der Zahlungsbetrag (${amount.toFixed(2)} €) übersteigt den offenen Rechnungsbetrag (${remaining.toFixed(2)} €).`,
        400,
        'AMOUNT_EXCEEDS_OPEN'
      );
    }

    // Create payment record
    const payment = new Payment({
      invoiceId: invoice._id,
      orderId:        toIdString(invoice.orderId) || undefined,
      bookingId:      toIdString(invoice.bookingId) || undefined,
      customerId:    invoice.customerId,
      customerName:  invoice.customerName,
      amount,
      currency:       paymentData.currency || 'EUR',
      paymentMethod,
      paymentDate,
      status:         'completed',
      processedAt:    paymentDate,
      transactionId:  paymentData.transactionId || undefined,
      paymentReference: paymentData.paymentReference || (invoice.invoiceNumber ? `Rechnung ${invoice.invoiceNumber}` : ''),
      note,
      allocatedAmount: 0,
      source:         'manual',
      recordedBy:     paymentData.recordedBy || undefined,
      gatewayResponse: paymentData.gatewayResponse || '',
      metadata:       paymentData.metadata || {},
      idempotencyKey: keys[0],
    });

    try {
      await payment.save();
    } catch (error) {
      // E11000 auf idempotencyKey = zwei gleichzeitige Requests, einer hat gewonnen.
      if (error?.code === 11000 && String(error?.message || '').includes('idempotencyKey')) {
        const winner = await Payment.findOne({ idempotencyKey: { $in: keys } });
        const currentInvoice = await Invoice.findById(invoice._id);
        return {
          payment: winner,
          invoice: currentInvoice,
          duplicate: true,
          message: 'Diese Zahlung wurde bereits erfasst und nicht erneut gebucht.',
          warnings: [],
        };
      }
      throw error;
    }

    // Zuordnung + Rechnungsstand atomar fortschreiben. Schlaegt das fehl, wird die
    // eben angelegte Zahlung wieder entfernt: keine halbe Buchung.
    let allocationResult = null;
    try {
      allocationResult = await PaymentService.allocateAtomically({
        payment,
        invoice,
        amount,
        note: paymentData.note || `Zahlung zu Rechnung ${invoice.invoiceNumber || invoice._id}`,
        orderId: toIdString(invoice.orderId) || undefined,
      });
    } catch (allocError) {
      await Payment.deleteOne({ _id: payment._id }).catch(() => {});
      console.error('FinancialService: allocation failed, payment rolled back:', allocError);
      throw buildFinancialError(
        'Die Zahlung konnte der Rechnung nicht zugeordnet werden und wurde nicht gebucht.',
        500,
        'ALLOCATION_FAILED'
      );
    }

    if (!allocationResult) {
      await Payment.deleteOne({ _id: payment._id }).catch(() => {});
      throw buildFinancialError(
        'Die Zahlung konnte nicht gebucht werden, weil der Rechnungsstand parallel geändert wurde. Bitte erneut versuchen.',
        409,
        'ALLOCATION_CONFLICT'
      );
    }

    const updatedInvoice = await Invoice.findById(invoice._id);
    const warnings = await FinancialService.syncPaymentDerivedState(updatedInvoice, 'addInvoicePayment');

    // Ein Beleg ohne Freigabe nimmt das Geld an, behaelt aber seinen Belegstatus:
    // PaymentService.allocateAtomically schreibt fuer 'draft'/'pending_approval'
    // ausschliesslich paidAmount fort. Der Bearbeiter erfaehrt das ausdruecklich,
    // damit er den Beleg nicht faelschlich fuer erledigt haelt.
    const approvalPending = !PaymentService.ALLOCATABLE_INVOICE_STATUSES
      .includes(String(updatedInvoice?.status || invoice.status || ''));
    const warning = approvalPending
      ? `Der Beleg ist noch nicht freigegeben (Status "${invoiceStatusLabelDe(updatedInvoice?.status || invoice.status)}"). Der Zahlungseingang wurde erfasst, der Belegstatus bleibt bis zur Freigabe unverändert.`
      : '';

    return { payment, invoice: updatedInvoice, duplicate: false, warnings, ...(warning ? { warning } : {}) };
  }

  // Create a credit note for a paid or cancelled invoice
  static async createCreditNote(invoiceId, options = {}) {
    console.log('FinancialService: Creating credit note for invoice:', invoiceId);

    const original = await Invoice.findById(invoiceId);
    if (!original) throw buildFinancialError('Rechnung wurde nicht gefunden.', 404, 'INVOICE_NOT_FOUND');

    const allowedStatuses = ['paid', 'cancelled', 'credited', 'partially_paid', 'sent', 'viewed', 'overdue'];
    if (!allowedStatuses.includes(original.status)) {
      throw buildFinancialError(
        `Für eine Rechnung im Status "${invoiceStatusLabelDe(original.status)}" kann keine Gutschrift erstellt werden.`,
        409,
        'INVOICE_STATUS_NOT_CREDITABLE'
      );
    }

    // Load financial settings
    const settings = await FinancialService.getFinancialSettings();

    // Eine Gutschrift ist das exakte Spiegelbild ihrer Ursprungsrechnung: dieselbe
    // Brutto-Logik, derselbe Steuersatz, dieselbe Reverse-Charge-Kennzeichnung.
    const isReverseCharge = Boolean(original.isReverseCharge);
    // options.taxRate ist ein PROZENTWERT (z.B. 19). Ohne Angabe erbt die Gutschrift
    // den Satz der Ursprungsrechnung - nur so stimmt die Spiegelung.
    const taxRate = isReverseCharge
      ? 0
      : normalizeTaxRatePercent(
        options.taxRate,
        Number.isFinite(Number(original.taxRate)) ? Number(original.taxRate) : settings.defaults.taxRate
      );

    // Build credit note items (negative BRUTTO amounts)
    const creditItems = (options.items || original.items).map(item => ({
      serviceName: item.serviceName ? `Gutschrift: ${item.serviceName}` : undefined,
      description: `Gutschrift: ${item.description}`,
      quantity: item.quantity,
      unitPrice: -Math.abs(Number(item.unitPrice) || 0),
      total: -Math.abs(Number(item.total) || 0),
      taxRate,
      type: item.type
    }));

    // Rabatt wird als positiver Betrag gespeichert (Schema min 0); das Vorzeichen
    // setzt die Summenberechnung im Modell.
    const discount = CalculationHelper.round(Math.abs(Number(options.discount) || 0));
    const creditGrossMagnitude = CalculationHelper.round(Math.max(
      0,
      creditItems.reduce((sum, item) => sum + Math.abs(item.total), 0) - discount
    ));

    // Eine Teilgutschrift mit eigenen Positionen ist im Zweifel eine Wertminderung.
    // 'partial_refund' bedeutet ausschliesslich die Rueckgabe einer Ueberzahlung und
    // muss vom Aufrufer explizit angefordert werden (siehe handleOverpayment).
    const correctionType = options.correctionType || (options.items ? 'price_adjustment' : 'full_cancellation');
    // Der Korrekturtyp kommt aus dem Request-Body und MUSS serverseitig geprueft
    // werden: 'partial_refund' ist von der Wertminderungs-Obergrenze ausgenommen und
    // waere sonst ein unbegrenzter Gutschriftshebel.
    if (!VALID_CORRECTION_TYPES.includes(correctionType)) {
      throw buildFinancialError(
        `Ungültiger Korrekturtyp "${correctionType}". Zulässig sind: ${VALID_CORRECTION_TYPES.join(', ')}.`,
        400,
        'INVALID_CORRECTION_TYPE'
      );
    }
    const isRefundNote = REFUND_CORRECTION_TYPES.includes(correctionType);

    // Bereits gutgeschriebene WERTMINDERUNGEN beruecksichtigen, damit dieselbe Minderung
    // nicht bei jedem Sync erneut gutgeschrieben wird. Ueberzahlungsrueckgaben zaehlen
    // hier bewusst nicht mit - sie mindern den Rechnungswert nicht.
    const alreadyCredited = await FinancialService.getCreditedTotal(original._id, { valueAdjustmentsOnly: true });
    const originalGross = Math.abs(CalculationHelper.round(Number(original.total || 0)));
    const remainingCreditable = CalculationHelper.round(originalGross - alreadyCredited);
    if (!isRefundNote && creditGrossMagnitude > remainingCreditable + 0.01) {
      throw buildFinancialError(
        `Die Gutschrift übersteigt den noch gutschreibbaren Betrag der Rechnung ${original.invoiceNumber} `
        + `(offen: ${remainingCreditable.toFixed(2)} €, angefordert: ${creditGrossMagnitude.toFixed(2)} €).`,
        400,
        'CREDIT_NOTE_EXCEEDS_INVOICE'
      );
    }

    // Auch eine ERSTATTUNGSgutschrift braucht eine reale Obergrenze: zurueckgeben
    // laesst sich nur Geld, das tatsaechlich eingegangen ist. Bezug ist das im
    // Vorgang eingegangene Geld (bzw. der auf dem Beleg verbuchte Betrag, wenn es
    // keine Buchung gibt), abzueglich bereits erstatteter Gutschriften.
    if (isRefundNote) {
      const alreadyRefundCredited = CalculationHelper.round(
        await FinancialService.getCreditedTotal(original._id) - alreadyCredited
      );
      let receivedReference = CalculationHelper.round(Number(original.paidAmount || 0));
      const originalBookingId = toIdString(original.bookingId);
      if (originalBookingId) {
        const bookingBalance = await PaymentService.computeBookingBalance({ bookingId: originalBookingId });
        if (bookingBalance) receivedReference = CalculationHelper.round(Math.max(receivedReference, bookingBalance.received));
      }
      const remainingRefundable = CalculationHelper.round(receivedReference - alreadyRefundCredited);
      if (creditGrossMagnitude > remainingRefundable + 0.01) {
        throw buildFinancialError(
          `Die Erstattungsgutschrift übersteigt den tatsächlich eingegangenen Betrag `
          + `(erstattbar: ${Math.max(0, remainingRefundable).toFixed(2)} €, angefordert: ${creditGrossMagnitude.toFixed(2)} €).`,
          400,
          'REFUND_EXCEEDS_RECEIVED'
        );
      }
    }

    const creditNote = new Invoice({
      creditNoteOf:       original._id,
      creditNoteOfNumber: original.invoiceNumber || '',
      isCreditNote:   true,
      correctionType,
      repairOrderIds: original.repairOrderIds,
      orderId:        original.orderId,
      bookingId:      original.bookingId,
      customerId:     original.customerId,
      customerName:   original.customerName,
      customerEmail:  original.customerEmail,
      // normalize*, weil ein nicht gesetztes nested-Objekt als "null-Dokument" gelesen
      // wird und beim Neuanlegen sonst einen CastError erzeugt.
      billingAddress: normalizeBillingAddress(original.billingAddress) || undefined,
      shippingAddress: normalizeShippingAddress(original.shippingAddress) || undefined,
      customerVatId:  original.customerVatId,
      sellerVatId:    original.sellerVatId,
      isReverseCharge,
      reverseChargeNotice: original.reverseChargeNotice,
      zmRelevant:     original.zmRelevant,
      taxRate,
      items:          creditItems,
      discount,
      // subtotal/tax/total werden brutto-first vom Invoice-Modell abgeleitet.
      dueDate:        options.dueDate ? new Date(options.dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      paymentTerms:   'Sofort',
      notes:          options.reason || `Gutschrift für Rechnung ${original.invoiceNumber}`,
      status:         'draft'
    });

    await creditNote.save();

    // Nur eine vollstaendige Gutschrift schliesst die Ursprungsrechnung ab. Bei einer
    // Teilgutschrift bleibt der Status erhalten, sonst waere der Restbetrag weder
    // zahlbar noch mahnbar (INVOICE_STATUS_TRANSITIONS.credited ist leer).
    // Nur Wertminderungen koennen eine Rechnung vollstaendig gutschreiben. Eine
    // Ueberzahlungsrueckgabe laesst die Forderung unveraendert bestehen.
    const creditedAfter = isRefundNote
      ? alreadyCredited
      : CalculationHelper.round(alreadyCredited + creditGrossMagnitude);
    if (!isRefundNote && creditedAfter >= originalGross - 0.01 && originalGross > 0) {
      original.status = 'credited';
      await original.save();
    }

    console.log('FinancialService: Credit note created successfully with tax rate:', taxRate + '%');
    return creditNote;
  }

  // Summe aller bereits zu einer Rechnung erstellten Gutschriften (positiver Betrag).
  // options.valueAdjustmentsOnly: nur WERTMINDERNDE Gutschriften (Preiskorrektur,
  // Storno und Altbelege ohne correctionType). Ueberzahlungsrueckgaben
  // ('partial_refund') sind Geldrueckfluesse und mindern den Rechnungswert nicht -
  // die beiden Toepfe duerfen nie vermischt werden.
  static async getCreditedTotal(invoiceId, options = {}) {
    const query = { creditNoteOf: invoiceId };
    if (options.valueAdjustmentsOnly) {
      // $nin trifft auch Dokumente ohne correctionType (Altbestand = Wertminderung).
      query.correctionType = { $nin: REFUND_CORRECTION_TYPES };
    }
    const creditNotes = await Invoice.find(query)
      .select('total')
      .lean();
    return CalculationHelper.round(
      creditNotes.reduce((sum, note) => sum + Math.abs(Number(note.total || 0)), 0)
    );
  }

  // Get detailed invoice context: invoice + linked payments + linked credit notes
  static async getInvoiceDetails(invoiceId) {
    console.log('FinancialService: Getting invoice details for:', invoiceId);

    const invoice = await Invoice.findById(invoiceId)
      .populate('creditNoteOf', 'invoiceNumber status total createdAt isCreditNote')
      .populate('repairOrderIds', 'orderNumber status deviceType deviceBrand deviceModel')
      .populate('orderId', 'orderNumber status deviceType deviceBrand deviceModel');
    if (!invoice) throw new Error('Invoice not found');

    // Hydrate missing addresses for legacy invoices or paths that stored incomplete address data.
    const hasBillingAddress = normalizeBillingAddress(invoice.billingAddress);
    const hasShippingAddress = normalizeShippingAddress(invoice.shippingAddress);
    if (!hasBillingAddress || !hasShippingAddress) {
      let orderContext = null;
      if (invoice.orderId) {
        orderContext = await Order.findById(invoice.orderId)
          .populate('customerId', 'invoiceAddress paymentAddress shippingAddress')
          .select('guestInfo.billingAddress guestInfo.shippingAddress billingAddress shippingAddress customerId')
          .lean();
      }

      let bookingContext = null;
      if (invoice.bookingId) {
        bookingContext = await Booking.findById(invoice.bookingId)
          .populate('customerId', 'invoiceAddress paymentAddress shippingAddress')
          .select('guestInfo.billingAddress guestInfo.shippingAddress billingAddress shippingAddress customerId')
          .lean();
      }

      if (!hasBillingAddress) {
        invoice.billingAddress =
          resolveBillingAddressFromBooking(bookingContext)
          || resolveBillingAddressFromOrder(orderContext)
          || invoice.billingAddress;
      }

      if (!hasShippingAddress) {
        invoice.shippingAddress =
          resolveShippingAddressFromBooking(bookingContext)
          || resolveShippingAddressFromOrder(orderContext)
          || invoice.shippingAddress;
      }
    }

    // Zahlungen im VORGANGSKONTEXT, nicht nur die auf diesen Beleg gestempelten.
    // Eine Gateway-Vorauszahlung traegt beim Checkout nur bookingId/orderId - eine
    // Abfrage allein auf invoiceId lieferte deshalb immer 0 Zeilen ("Noch keine
    // Zahlungen verzeichnet"), obwohl der Kunde bereits bezahlt hatte.
    const paymentConditions = [{ invoiceId: invoice._id }];
    const invoiceBookingId = toIdString(invoice.bookingId);
    const invoiceOrderId = toIdString(invoice.orderId);
    if (invoiceBookingId) paymentConditions.push({ bookingId: invoiceBookingId });
    if (invoiceOrderId) paymentConditions.push({ orderId: invoiceOrderId });

    const rawPayments = await Payment.find({ $or: paymentConditions })
      .sort({ createdAt: -1 })
      .lean();

    const allocations = rawPayments.length > 0
      ? await PaymentAllocation.find({ paymentId: { $in: rawPayments.map((payment) => payment._id) } }).lean()
      : [];
    const allocatedToThisInvoiceByPayment = new Map();
    allocations.forEach((allocation) => {
      if (toIdString(allocation.invoiceId) !== toIdString(invoice._id)) return;
      const key = toIdString(allocation.paymentId);
      allocatedToThisInvoiceByPayment.set(
        key,
        CalculationHelper.round(Number(allocatedToThisInvoiceByPayment.get(key) || 0) + Number(allocation.allocatedAmount || 0))
      );
    });

    // Jede Zeile traegt, ob sie DIESER Rechnung zugeordnet ist - der Client darf
    // "vorhanden" nicht mit "verrechnet" verwechseln.
    const payments = rawPayments.map((payment) => {
      const allocatedToThisInvoice = CalculationHelper.round(Number(allocatedToThisInvoiceByPayment.get(toIdString(payment._id)) || 0));
      return {
        ...payment,
        allocatedToThisInvoice,
        isAllocatedToThisInvoice: allocatedToThisInvoice > 0.009,
      };
    });

    // Credit notes created for this invoice
    const creditNotes = await Invoice.find({ creditNoteOf: invoice._id })
      .select('_id invoiceNumber status total createdAt isCreditNote notes correctionType')
      .sort({ createdAt: -1 });

    // Verbindlicher Zahlungsstand des Belegs: total / allocated / open / overpaid.
    const balance = await PaymentService.computeInvoiceBalance(invoice);

    return { invoice, payments, creditNotes, balance };
  }

  // Get all overdue invoices, preserving the original customer payment deadline.
  static async getOverdueInvoices() {
    const now = new Date();
    return Invoice.find({
      dueDate: { $lt: now },
      status:  { $nin: ['paid', 'cancelled', 'credited', 'draft'] }
    }).sort({ dueDate: 1 });
  }

  // Marks expired invoices overdue, then advances a case only after its current 7-day dunning deadline.
  static async runDunningJob() {
    console.log('FinancialService: Running dunning job');

    const now = new Date();
    const openInvoices = await Invoice.find({
      dueDate: { $lt: now },
      status: { $nin: ['paid', 'cancelled', 'credited', 'draft'] }
    });

    for (const invoice of openInvoices) {
      if (invoice.status !== 'overdue') {
        invoice.status = 'overdue';
      }
      if (!invoice.originalDueDate) invoice.originalDueDate = invoice.dueDate;
      if (!invoice.nextDunningDueDate && invoice.dunningStage !== 'collection') {
        invoice.nextDunningDueDate = addDays(invoice.dueDate, 7);
      }
      await invoice.save();
    }

    const eligibleInvoices = openInvoices.filter((invoice) => (
      invoice.dunningStage !== 'collection'
      && invoice.nextDunningDueDate
      && new Date(invoice.nextDunningDueDate) < now
      && Number(invoice.dunningLevel || 0) < DUNNING_STAGES.length
    ));

    if (eligibleInvoices.length === 0) {
      return { processed: openInvoices.length, actions: [], run: null };
    }

    const run = new DunningRun({
      name: `Mahnlauf ${now.toLocaleDateString('de-DE')}`,
      status: 'running',
      defaultStatus: 'overdue',
      defaultNote: 'Automatischer fristbasierter Mahnlauf',
      items: eligibleInvoices.map((invoice) => ({
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail,
        dueDate: invoice.nextDunningDueDate,
        amountOpen: Math.max(0, Number(invoice.total || 0) - Number(invoice.paidAmount || 0)),
        dunningLevel: Number(invoice.dunningLevel || 0),
        status: 'processing'
      })),
      logs: [{ type: 'started', message: `Mahnlauf mit ${eligibleInvoices.length} faelligen Faellen gestartet`, at: now }]
    });
    await run.save();

    const actions = [];
    for (const invoice of eligibleInvoices) {
      const stage = DUNNING_STAGES[Number(invoice.dunningLevel || 0)];
      const previousDueDate = invoice.nextDunningDueDate;
      const nextDueDate = addDays(now, 7);
      const emailResult = await EmailService.sendTriggerEmail(stage.trigger, invoice.customerEmail, {
        companyName: process.env.COMPANY_NAME || 'McRepair.de',
        customerName: invoice.customerName || 'Kunde',
        invoiceNumber: invoice.invoiceNumber,
        invoiceAmount: `EUR ${Number(invoice.total || 0).toFixed(2)}`,
        amountOpen: `EUR ${Math.max(0, Number(invoice.total || 0) - Number(invoice.paidAmount || 0)).toFixed(2)}`,
        originalDueDate: new Date(invoice.originalDueDate || invoice.dueDate).toLocaleDateString('de-DE'),
        dueDate: nextDueDate.toLocaleDateString('de-DE'),
        dunningStage: stage.label,
        invoiceUrl: await EmailService.buildSystemUrl(`/invoices?invoiceId=${invoice._id}`),
        supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
        supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
      });

      invoice.status = 'overdue';
      invoice.dunningLevel = stage.level;
      invoice.dunningStage = stage.stage;
      invoice.dunningNotifiedAt = now;
      invoice.nextDunningDueDate = nextDueDate;
      invoice.dunningHistory.push({
        stage: stage.stage,
        executedAt: now,
        previousDueDate,
        nextDueDate,
        dunningRunId: run._id,
        ...(emailResult?.success ? { emailSentAt: now } : { emailError: emailResult?.error || 'E-Mail-Versand fehlgeschlagen' })
      });
      await invoice.save();

      const item = run.items.find((entry) => String(entry.invoiceId) === String(invoice._id));
      if (item) {
        item.dunningLevel = stage.level;
        item.status = emailResult?.success ? 'sent' : 'failed';
        item.lastActionAt = now;
      }
      actions.push({
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail,
        dunningLevel: stage.level,
        dunningStage: stage.stage,
        daysPastDue: Math.floor((now - new Date(invoice.originalDueDate || invoice.dueDate)) / 86400000),
        amount: invoice.total,
        action: `${stage.label} ${emailResult?.success ? 'versendet' : 'nicht versendet'}`
      });
    }

    run.status = 'completed';
    run.logs.push({ type: 'completed', message: `${actions.length} Faelle verarbeitet`, at: new Date() });
    await run.save();
    return { processed: openInvoices.length, actions, run };
  }

  static async activateCollection(invoiceId, userId) {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');
    if (!['overdue', 'partially_paid'].includes(invoice.status)) throw new Error('Only overdue invoices can be transferred to collection');
    if (invoice.dunningStage === 'collection') return invoice;

    const now = new Date();
    const previousDueDate = invoice.nextDunningDueDate;
    const emailResult = await EmailService.sendTriggerEmail('collection_notice', invoice.customerEmail, {
      companyName: process.env.COMPANY_NAME || 'McRepair.de',
      customerName: invoice.customerName || 'Kunde',
      invoiceNumber: invoice.invoiceNumber,
      invoiceAmount: `EUR ${Number(invoice.total || 0).toFixed(2)}`,
      amountOpen: `EUR ${Math.max(0, Number(invoice.total || 0) - Number(invoice.paidAmount || 0)).toFixed(2)}`,
      originalDueDate: new Date(invoice.originalDueDate || invoice.dueDate).toLocaleDateString('de-DE'),
      dueDate: '-',
      dunningStage: 'Inkasso',
      invoiceUrl: await EmailService.buildSystemUrl(`/invoices?invoiceId=${invoice._id}`),
      supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
      supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
    });
    invoice.dunningLevel = 4;
    invoice.dunningStage = 'collection';
    invoice.nextDunningDueDate = undefined;
    invoice.dunningHistory.push({
      stage: 'collection',
      executedAt: now,
      previousDueDate,
      ...(emailResult?.success ? { emailSentAt: now } : { emailError: emailResult?.error || 'E-Mail-Versand fehlgeschlagen' })
    });
    await invoice.save();
    return invoice;
  }

  static async createDunningRun(payload = {}, userId) {
    const invoiceIds = Array.isArray(payload.invoiceIds) ? payload.invoiceIds : [];
    if (invoiceIds.length === 0) throw new Error('At least one invoiceId is required');

    const invoices = await Invoice.find({ _id: { $in: invoiceIds } });
    if (invoices.length === 0) throw new Error('No invoices found for provided invoiceIds');

    const items = invoices.map((invoice) => ({
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      dueDate: invoice.dueDate,
      amountOpen: Math.max(0, Number(invoice.total || 0) - Number(invoice.paidAmount || 0)),
      dunningLevel: invoice.dunningLevel || 0,
      status: 'pending',
      note: ''
    }));

    const run = new DunningRun({
      name: payload.name || `Mahnlauf ${new Date().toLocaleDateString('de-DE')}`,
      status: payload.status || 'draft',
      defaultStatus: payload.defaultStatus || 'overdue',
      defaultNote: payload.defaultNote || '',
      items,
      logs: [
        {
          type: 'created',
          message: `Mahnlauf mit ${items.length} Faellen erstellt`,
          actorId: userId || undefined
        }
      ],
      createdBy: userId || undefined
    });

    await run.save();
    return run;
  }

  static async getDunningRuns(filters = {}) {
    const query = {};
    if (filters.status) query.status = filters.status;
    return DunningRun.find(query).sort({ createdAt: -1 }).limit(100);
  }

  static async getDunningRunById(runId) {
    const run = await DunningRun.findById(runId);
    if (!run) throw new Error('Dunning run not found');
    return run;
  }

  static async updateDunningRun(runId, updates = {}, userId) {
    const run = await DunningRun.findById(runId);
    if (!run) throw new Error('Dunning run not found');

    if (typeof updates.name === 'string') run.name = updates.name;
    if (typeof updates.defaultNote === 'string') run.defaultNote = updates.defaultNote;
    if (typeof updates.defaultStatus === 'string') run.defaultStatus = updates.defaultStatus;
    if (typeof updates.status === 'string') run.status = updates.status;

    if (updates.logMessage) {
      run.logs.push({
        type: updates.logType || 'note',
        message: String(updates.logMessage),
        actorId: userId || undefined,
        at: new Date()
      });
    }

    await run.save();
    return run;
  }

  static async updateDunningRunItem(runId, invoiceId, updates = {}, userId) {
    const run = await DunningRun.findById(runId);
    if (!run) throw new Error('Dunning run not found');

    const item = run.items.find((entry) => String(entry.invoiceId) === String(invoiceId));
    if (!item) throw new Error('Invoice not found in dunning run');

    if (typeof updates.status === 'string') item.status = updates.status;
    if (typeof updates.note === 'string') item.note = updates.note;
    if (typeof updates.amountOpen === 'number') item.amountOpen = updates.amountOpen;

    item.lastActionAt = new Date();
    item.lastActionBy = userId || undefined;

    run.logs.push({
      type: 'item_update',
      message: updates.logMessage || `Fall ${item.invoiceNumber} aktualisiert`,
      invoiceId: item.invoiceId,
      actorId: userId || undefined,
      at: new Date()
    });

    await run.save();
    return run;
  }

  static async addDunningRunItem(runId, invoiceId, userId) {
    const run = await DunningRun.findById(runId);
    if (!run) throw new Error('Dunning run not found');

    const alreadyExists = run.items.some((entry) => String(entry.invoiceId) === String(invoiceId));
    if (alreadyExists) return run;

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    run.items.push({
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      dueDate: invoice.dueDate,
      amountOpen: Math.max(0, Number(invoice.total || 0) - Number(invoice.paidAmount || 0)),
      dunningLevel: invoice.dunningLevel || 0,
      status: 'pending',
      note: 'Manuell hinzugefuegt',
      lastActionAt: new Date(),
      lastActionBy: userId || undefined
    });

    run.logs.push({
      type: 'item_update',
      message: `Fall ${invoice.invoiceNumber} zum Lauf hinzugefuegt`,
      invoiceId: invoice._id,
      actorId: userId || undefined,
      at: new Date()
    });

    await run.save();
    return run;
  }

  // Export payments as CSV or JSON
  static async exportPayments(filters = {}, format = 'csv') {
    const query = {};

    if (filters.status)  query.status  = filters.status;
    if (filters.method)  query.paymentMethod = filters.method;
    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo)   query.createdAt.$lte = new Date(filters.dateTo);
    }

    const payments = await Payment.find(query).sort({ createdAt: -1 }).limit(10000);

    if (format === 'json') return payments;

    // CSV
    const headers = ['transactionId','customerName','amount','currency','paymentMethod','status','createdAt','invoiceId'];
    const rows = payments.map(p => [
      p.transactionId,
      p.customerName,
      p.amount.toFixed(2),
      p.currency,
      p.paymentMethod,
      p.status,
      p.createdAt ? p.createdAt.toISOString() : '',
      p.invoiceId || ''
    ]);

    return [headers, ...rows].map(r => r.join(',')).join('\n');
  }

  // Export invoices as CSV or JSON
  static async exportInvoices(filters = {}, format = 'csv') {
    const query = {};

    if (filters.status)     query.status    = filters.status;
    if (filters.customerId) query.customerId = filters.customerId;
    if (filters.isReverseCharge !== undefined && filters.isReverseCharge !== null && filters.isReverseCharge !== '') {
      query.isReverseCharge = filters.isReverseCharge === true || filters.isReverseCharge === 'true';
    }
    if (filters.zmRelevant !== undefined && filters.zmRelevant !== null && filters.zmRelevant !== '') {
      query.zmRelevant = filters.zmRelevant === true || filters.zmRelevant === 'true';
    }
    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo)   query.createdAt.$lte = new Date(filters.dateTo);
    }

    const invoices = await Invoice.find(query).sort({ createdAt: -1 }).limit(10000);

    if (format === 'json') return invoices;

    // CSV with tax breakdown & reverse charge data
    const headers = [
      'invoiceNumber',
      'customerName',
      'customerEmail',
      'customerVatId',
      'sellerVatId',
      'isReverseCharge',
      'reverseChargeNotice',
      'zmRelevant',
      'subtotal',
      'tax',
      'discount',
      'total',
      'paidAmount',
      'status',
      'dueDate',
      'createdAt',
      'isCreditNote'
    ];
    const rows = invoices.map(inv => [
      inv.invoiceNumber,
      inv.customerName,
      inv.customerEmail,
      inv.customerVatId || '',
      inv.sellerVatId || '',
      inv.isReverseCharge ? '1' : '0',
      `"${(inv.reverseChargeNotice || '').replace(/"/g, '""')}"`,
      inv.zmRelevant ? '1' : '0',
      inv.subtotal.toFixed(2),
      inv.tax.toFixed(2),
      inv.discount.toFixed(2),
      inv.total.toFixed(2),
      (inv.paidAmount || 0).toFixed(2),
      inv.status,
      inv.dueDate ? inv.dueDate.toISOString().split('T')[0] : '',
      inv.createdAt ? inv.createdAt.toISOString() : '',
      inv.isCreditNote ? '1' : '0'
    ]);

    return [headers, ...rows].map(r => r.join(',')).join('\n');
  }

  /**
   * Automatisches Zuordnen unzugeordneter Zahlungen zu offenen Rechnungen eines Auftrags
   */
  /**
   * Ordnet bereits eingegangenes, noch nicht zugeordnetes Geld den offenen Rechnungen
   * einer Buchung zu (typischer Fall: PayPal-Vorauszahlung, Rechnung entsteht spaeter).
   *
   * ZUORDNUNGSREGEL (verbindlich):
   *  - Kandidaten sind alle Zahlungen der Buchung im Status 'completed', abzueglich
   *    Erstattungen und bereits zugeordneter Betraege.
   *  - Zielrechnungen sind offene Forderungen im Status sent/viewed/partially_paid/
   *    overdue. Entwuerfe, Belege in Freigabe und Gutschriften bleiben ausgeschlossen -
   *    eine Zuordnung darf keinen Beleg an der Freigabe vorbei auf 'paid' setzen.
   *  - Reihenfolge ist FIFO: aelteste Faelligkeit zuerst, danach aeltestes Anlagedatum.
   *    Bei MEHREREN offenen Rechnungen wird NICHT alles auf die erste gebucht: jede
   *    Rechnung bekommt hoechstens ihren offenen Betrag, der Rest wandert weiter.
   *  - Ein verbleibender Rest bleibt bewusst nicht zugeordnet (sichtbar als
   *    `unallocatedTotal`) und wird nicht als Ueberzahlung auf eine Rechnung gebucht.
   *
   * Mehrfachaufrufe (wiederholter Webhook, erneute Rechnungserstellung, parallele
   * Laeufe) koennen dasselbe Geld nicht doppelt zaehlen: der bereits zugeordnete
   * Betrag wird jedes Mal neu aus den PaymentAllocation-Zeilen gelesen und die
   * eigentliche Buchung laeuft ueber ein bedingtes Update auf der Zahlung
   * (PaymentService.allocateAtomically).
   */
  static async autoAllocateUnallocatedPayments(bookingId) {
    if (!bookingId) return null;
    try {
      const BookingPaymentService = require('./bookingPaymentService');
      const { booking, orders, invoices } = await BookingPaymentService.loadContext(bookingId);

      // Achtung: loadContext liefert ROHE lean-Dokumente. Das frueher hier gepruefte
      // `inv.isOpen` gibt es dort nicht (es entsteht erst in getOverview), weshalb
      // diese Funktion an jeder Aufrufstelle wirkungslos war. Die Offenheit wird
      // deshalb aus dem Belegstatus selbst bestimmt.
      const openInvoices = PaymentService.sortOpenInvoicesFifo(invoices || []);
      if (openInvoices.length === 0) return { allocated: 0, allocations: [] };

      const orderIds = (orders || []).map((order) => order._id);
      const matchConditions = [{ bookingId: booking._id }];
      if (invoices.length > 0) matchConditions.push({ invoiceId: { $in: invoices.map((invoice) => invoice._id) } });
      if (orderIds.length > 0) matchConditions.push({ orderId: { $in: orderIds } });

      const payments = await Payment.find({ $or: matchConditions, status: 'completed' })
        .sort({ paymentDate: 1, createdAt: 1 });

      // Offener Betrag je Rechnung aus den GUELTIGEN Zuordnungen, nicht aus dem
      // denormalisierten paidAmount - sonst wuerde ein Altbestands-Fehler fortgeschrieben.
      const allocatedByInvoice = await PaymentService.getAllocatedTotalsByInvoice(
        openInvoices.map((invoice) => invoice._id)
      );
      const openAmountByInvoice = new Map(openInvoices.map((invoice) => [
        String(invoice._id),
        CalculationHelper.round(Math.max(0, Number(invoice.total || 0) - Number(allocatedByInvoice.get(String(invoice._id)) || 0))),
      ]));

      const touchedInvoiceIds = new Set();
      const performed = [];
      let allocatedSum = 0;

      for (const payment of payments) {
        const existingAllocations = await PaymentAllocation.find({ paymentId: payment._id }).select('allocatedAmount').lean();
        const alreadyAllocated = CalculationHelper.round(
          existingAllocations.reduce((sum, entry) => sum + Number(entry.allocatedAmount || 0), 0)
        );
        // Erstattungen mindern den zuordenbaren Betrag.
        const effectiveAmount = CalculationHelper.round(
          Math.max(0, Number(payment.amount || 0) - Number(payment.refundAmount || 0))
        );
        let remaining = CalculationHelper.round(effectiveAmount - alreadyAllocated);
        if (remaining <= 0.009) continue;

        payment.allocatedAmount = alreadyAllocated;

        for (const invoiceSummary of openInvoices) {
          if (remaining <= 0.009) break;
          const invoiceKey = String(invoiceSummary._id);
          const invoiceOpen = Number(openAmountByInvoice.get(invoiceKey) || 0);
          if (invoiceOpen <= 0.009) continue;

          const invoice = await Invoice.findById(invoiceSummary._id);
          if (!invoice) continue;
          // Zwischenzeitlicher Statuswechsel (z.B. storniert) beendet die Zuordnung.
          if (!PaymentService.ALLOCATABLE_INVOICE_STATUSES.includes(String(invoice.status || ''))) {
            openAmountByInvoice.set(invoiceKey, 0);
            continue;
          }

          const allocatable = CalculationHelper.round(Math.min(remaining, invoiceOpen));
          const result = await PaymentService.allocateAtomically({
            payment,
            invoice,
            amount: allocatable,
            note: `Automatische Zuordnung (${invoice.invoiceNumber || invoice._id})`,
            orderId: toIdString(invoice.orderId) || toIdString(payment.orderId) || undefined,
          });

          if (!result) {
            // Rennen verloren: ein paralleler Lauf hat diese Zahlung bereits gebucht.
            console.warn('FinancialService: concurrent allocation detected, skipping payment', String(payment._id));
            break;
          }

          remaining = CalculationHelper.round(remaining - allocatable);
          openAmountByInvoice.set(invoiceKey, CalculationHelper.round(invoiceOpen - allocatable));
          allocatedSum = CalculationHelper.round(allocatedSum + allocatable);
          touchedInvoiceIds.add(invoiceKey);
          performed.push({
            paymentId: String(payment._id),
            invoiceId: invoiceKey,
            invoiceNumber: invoice.invoiceNumber || '',
            amount: allocatable,
          });
        }
      }

      for (const invoiceId of touchedInvoiceIds) {
        const invoice = await Invoice.findById(invoiceId);
        if (invoice) await FinancialService.syncPaymentDerivedState(invoice, 'autoAllocate');
      }
      if (touchedInvoiceIds.size === 0) {
        // Auch ohne neue Zuordnung muss der Buchungsstand stimmen.
        await FinancialService.applyBookingPaymentState(booking._id).catch((error) => {
          console.error('FinancialService: booking payment state not updated (autoAllocate):', error);
        });
      }

      return { allocated: allocatedSum, allocations: performed };
    } catch (error) {
      console.error('FinancialService: Error in autoAllocateUnallocatedPayments:', error.message);
      return null;
    }
  }

  /**
   * Synchronisiert Auftragswertänderungen (Order/Booking) mit Rechnung, Zahlungen & Mahnstatus
   */
  static async syncOrderAndBookingValue(targetId, targetType = 'booking') {
    try {
      let bookingId = null;
      let orderId = null;
      const rawId = String(targetId || '').trim();
      const cleanId = rawId.replace(/^#/, '').trim();

      if (targetType === 'order') {
        let order = null;
        if (Types.ObjectId.isValid(rawId)) {
          order = await Order.findById(rawId);
        }
        if (!order && cleanId) {
          order = await Order.findOne({
            $or: [
              { orderNumber: cleanId },
              { orderNumber: `#${cleanId}` },
              { orderNumber: { $regex: new RegExp(`^#?${cleanId}$`, 'i') } }
            ]
          });
        }
        if (order) {
          orderId = order._id;
          bookingId = order.bookingId;
        }
      } else {
        let booking = null;
        if (Types.ObjectId.isValid(rawId)) {
          booking = await Booking.findById(rawId);
        }
        if (!booking && cleanId) {
          booking = await Booking.findOne({
            $or: [
              { bookingNumber: cleanId },
              { bookingNumber: `#${cleanId}` },
              { bookingNumber: { $regex: new RegExp(`^#?${cleanId}$`, 'i') } }
            ]
          });
        }
        if (!booking && cleanId) {
          const order = await Order.findOne({
            $or: [
              { orderNumber: cleanId },
              { orderNumber: `#${cleanId}` },
              { orderNumber: { $regex: new RegExp(`^#?${cleanId}$`, 'i') } }
            ]
          });
          if (order && order.bookingId) {
            booking = await Booking.findById(order.bookingId);
            orderId = order._id;
          }
        }
        if (booking) {
          bookingId = booking._id;
        }
      }

      if (!bookingId && !orderId) return;

      let booking = null;
      if (bookingId) {
        booking = await Booking.findById(bookingId);
        if (booking) {
          const orders = await Order.find({ bookingId: booking._id }).lean();
          if (orders.length > 0) {
            const sumOrders = orders.reduce((sum, o) => sum + Number(o.totalCost || 0), 0);
            booking.totalCost = CalculationHelper.round(sumOrders);
            await booking.save();
          }
        }
      }

      const invoiceQuery = [];
      if (bookingId) invoiceQuery.push({ bookingId });
      if (orderId) invoiceQuery.push({ orderId }, { repairOrderIds: orderId });

      const invoices = await Invoice.find({ $or: invoiceQuery }).sort({ createdAt: -1 });
      if (!invoices || invoices.length === 0) return;

      const mainInvoice = invoices.find(inv => !inv.isCreditNote) || invoices[0];
      let newOrderValue = booking ? Number(booking.totalCost || 0) : null;
      if (newOrderValue === null && orderId) {
        const order = await Order.findById(orderId).select('totalCost').lean();
        newOrderValue = Number(order?.totalCost || 0);
      }
      if (newOrderValue === null) {
        newOrderValue = Number(mainInvoice.total || 0);
      }

      const mutableStatuses = ['draft', 'pending_approval', 'sent', 'viewed', 'partially_paid', 'overdue'];
      if (mutableStatuses.includes(mainInvoice.status)) {
        if (booking) {
          // Positionen mit echten Service-/Produktnamen und Geraetekennzeichnung neu
          // aufbauen. Die Positionssumme kann bei einem Buchungsrabatt bewusst vom
          // autoritativen Brutto-Gesamtbetrag unten abweichen.
          const orders = await findOrdersForInvoiceItems({ bookingId: booking._id });
          const bookingItemByOrderId = new Map();
          (booking.items || []).forEach((bookingItem) => {
            if (bookingItem?.orderId) bookingItemByOrderId.set(String(bookingItem.orderId), bookingItem);
          });

          const items = [];
          orders.forEach((o) => {
            const bookingItem = bookingItemByOrderId.get(String(o._id));
            buildInvoiceItemsFromOrder(o, { deviceLabel: bookingItem?.device })
              .forEach((item) => items.push(item));
          });
          if (items.length > 0) {
            mainInvoice.items = items;
          }
        }

        // Autoritatives BRUTTO; Netto und MwSt rechnet das Invoice-Modell heraus.
        mainInvoice.total = CalculationHelper.round(newOrderValue);

        const allocations = await PaymentAllocation.find({ invoiceId: mainInvoice._id }).lean();
        const paidAmount = CalculationHelper.round(allocations.reduce((sum, a) => sum + Number(a.allocatedAmount || 0), 0));
        mainInvoice.paidAmount = paidAmount;

        // Betrag und Positionen werden auch im Entwurf fortgeschrieben, der
        // BELEGSTATUS aber nur, wenn der Beleg die Freigabe hinter sich hat -
        // 'draft'/'pending_approval' bleiben, wo sie sind (gleicher Schutz wie in
        // recalculateInvoicePaidAmounts und PaymentService.allocateAtomically).
        if (PAYMENT_DERIVED_STATUS_WRITABLE.includes(String(mainInvoice.status || ''))) {
          if (paidAmount >= mainInvoice.total - 0.01 && mainInvoice.total > 0) {
            mainInvoice.status = 'paid';
            mainInvoice.paidAt = mainInvoice.paidAt || new Date();
            mainInvoice.dunningLevel = 0;
            mainInvoice.dunningStage = 'none';
            mainInvoice.nextDunningDueDate = undefined;
          } else if (paidAmount > 0) {
            mainInvoice.status = 'partially_paid';
            mainInvoice.paidAt = null;
          } else {
            mainInvoice.status = mainInvoice.dueDate && new Date(mainInvoice.dueDate) < new Date() ? 'overdue' : 'sent';
            mainInvoice.paidAt = null;
          }
        }

        await mainInvoice.save();
        await FinancialService.syncPaymentDerivedState(mainInvoice, 'syncOrderAndBookingValue');
      } else if (['paid', 'credited'].includes(mainInvoice.status)) {
        const currentInvoiceTotal = Number(mainInvoice.total || 0);
        const diff = CalculationHelper.round(newOrderValue - currentInvoiceTotal);
        // Bereits gutgeschriebene Minderungen abziehen, sonst erzeugt jeder weitere
        // Sync dieselbe Korrektur noch einmal.
        const alreadyCredited = await FinancialService.getCreditedTotal(mainInvoice._id, { valueAdjustmentsOnly: true });
        const outstandingReduction = CalculationHelper.round(Math.abs(Math.min(0, diff)) - alreadyCredited);
        if (diff < -0.01 && outstandingReduction > 0.01) {
          await FinancialService.createCreditNote(mainInvoice._id, {
            reason: `Automatische Korrekturrechnung wegen Auftragswertminderung (-EUR ${outstandingReduction.toFixed(2)})`,
            correctionType: 'price_adjustment',
            discount: 0,
            items: [{
              serviceName: 'Auftragswertanpassung',
              description: 'Auftragswertanpassung (Minderung)',
              quantity: 1,
              unitPrice: outstandingReduction,
              total: outstandingReduction,
              type: 'fee'
            }]
          });
        }
      }
    } catch (error) {
      console.error('FinancialService: Error in syncOrderAndBookingValue:', error.message);
    }
  }

  /**
   * Verarbeitet Überzahlungen (Erstellung Korrekturrechnung & optional Erstattung)
   */
  static async handleOverpayment(bookingId, options = {}) {
    const BookingPaymentService = require('./bookingPaymentService');
    const overview = await BookingPaymentService.getOverview(bookingId);
    // overpaidTotal ist bereits gegen die richtige Bezugsgroesse (gestellte Rechnungen,
    // ersatzweise Auftragswert) gerechnet und nie negativ.
    const calculatedOverpaid = CalculationHelper.round(Math.max(0, Number(overview.summary.overpaidTotal || 0)));
    const specifiedAmount = options.amount != null ? Number(options.amount) : null;
    const overpaidAmount = (specifiedAmount && specifiedAmount > 0) ? CalculationHelper.round(specifiedAmount) : calculatedOverpaid;

    if (!overview.summary.isOverpaid && overpaidAmount <= 0) {
      return { isOverpaid: false, overpaidAmount: 0, message: 'Keine Überzahlung für diese Buchung vorhanden.' };
    }

    const mainInvoice = overview.invoices.find(inv => !inv.isCreditNote);
    let creditNote = null;
    if (mainInvoice) {
      creditNote = await FinancialService.createCreditNote(mainInvoice._id, {
        reason: options.reason || `Überzahlungsgutschrift (${overpaidAmount.toFixed(2)} €)`,
        correctionType: 'partial_refund',
        items: [{
          serviceName: 'Überzahlung',
          description: 'Gutschrift für Überzahlung',
          quantity: 1,
          unitPrice: overpaidAmount,
          total: overpaidAmount,
          type: 'fee'
        }]
      });
    }

    let refundResult = null;
    if (options.processRefund && overview.payments.length > 0) {
      const eligiblePayment = overview.payments.find(p => p.status === 'completed' && p.amount > 0);
      if (eligiblePayment) {
        refundResult = await FinancialService.processRefund(eligiblePayment._id, overpaidAmount, options.reason || 'Erstattung Überzahlung', {
          mode: options.refundMode || 'manual'
        });
      }
    }

    return {
      isOverpaid: true,
      overpaidAmount,
      creditNote,
      refundResult
    };
  }

  /**
   * Sendet eine Zahlungsaufforderung fuer offene Restforderungen.
   *
   * KANAL: ausschliesslich E-MAIL. Es gibt keine PayPal-Zahlungsanforderung in diesem
   * System (paypalService kann nur lesen: getOrder / listTransactions). PayPal kommt
   * erst ins Spiel, wenn der Kunde die Rechnung oeffnet und dort bezahlt.
   *
   * Es wird NIEMALS Erfolg gemeldet, ohne dass der Mailserver die Nachricht
   * tatsaechlich angenommen hat - und Annahme ist keine Zustellbestaetigung.
   * Jeder Versuch (auch der fehlgeschlagene und der ohne Empfaenger) wird als
   * PaymentRequest protokolliert und ist ueber
   * GET /api/admin/financial/bookings/:bookingId/payment-requests abrufbar.
   */
  static async requestAdditionalPayment(bookingId, options = {}, actor = null) {
    const PaymentRequest = require('../models/PaymentRequest');
    const BookingPaymentService = require('./bookingPaymentService');

    // loadContext ist hier NICHT redundant: getOverview liefert eine projizierte
    // Buchung ohne customerId/guestInfo, der Empfaenger waere sonst nie aufloesbar.
    const { booking, invoices } = await BookingPaymentService.loadContext(bookingId);
    const overview = await BookingPaymentService.getOverview(bookingId);
    const openBalance = CalculationHelper.round(Number(overview.summary.openOrderBalance || 0));

    const mainInvoice = PaymentService.sortOpenInvoicesFifo(invoices || [])[0]
      || (invoices || []).find((invoice) => !invoice.isCreditNote)
      || null;

    const customer = booking.customerId ? await User.findById(booking.customerId).lean() : null;
    const recipientEmail = String(customer?.email || booking.guestInfo?.email || '').trim();
    const recipientName = customer
      ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.name || ''
      : `${booking.guestInfo?.firstName || ''} ${booking.guestInfo?.lastName || ''}`.trim();

    const note = String(options.note || '').trim();

    const baseRecord = {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber || '',
      invoiceId: mainInvoice?._id,
      invoiceNumber: mainInvoice?.invoiceNumber || '',
      orderId: toIdString(mainInvoice?.orderId) || undefined,
      openBalanceAtRequest: Math.max(0, openBalance),
      channel: 'email',
      recipientEmail,
      recipientName,
      note,
      requestedBy: actor?._id || undefined,
      requestedByName: actor ? `${actor.firstName || ''} ${actor.lastName || ''}`.trim() || actor.email || '' : '',
      requestedAt: new Date(),
      resendOfId: options.resendOfId || undefined,
    };

    if (openBalance <= 0.009) {
      // Kein Fehler, aber auch kein Versand - und deshalb auch kein "erfolgreich".
      return {
        success: false,
        status: 'no_open_balance',
        openBalance: 0,
        message: 'Keine offene Restforderung vorhanden.',
      };
    }

    // Angeforderter Betrag: der Client schickt seit jeher options.amount, der Server
    // hat ihn bisher ignoriert. Er wird jetzt honoriert und gegen den offenen Betrag
    // geprueft.
    let amount = openBalance;
    if (options.amount != null && String(options.amount).trim() !== '') {
      const requested = CalculationHelper.round(Number(options.amount));
      if (!Number.isFinite(requested) || requested <= 0) {
        throw buildFinancialError('Der angeforderte Betrag muss größer als 0 sein.', 400, 'INVALID_AMOUNT');
      }
      if (requested > openBalance + 0.01) {
        throw buildFinancialError(
          `Der angeforderte Betrag (${requested.toFixed(2)} €) übersteigt die offene Restforderung (${openBalance.toFixed(2)} €).`,
          400,
          'AMOUNT_EXCEEDS_OPEN'
        );
      }
      amount = requested;
    }

    if (!recipientEmail) {
      // Laut scheitern statt still "erfolgreich" zu melden.
      const record = await PaymentRequest.create({
        ...baseRecord,
        amount,
        status: 'skipped_no_recipient',
        error: 'Keine E-Mail-Adresse hinterlegt.',
      });
      return {
        success: false,
        status: 'skipped_no_recipient',
        requestId: String(record._id),
        openBalance,
        amount,
        recipientEmail: '',
        message: 'Für diese Buchung ist keine E-Mail-Adresse hinterlegt - es wurde nichts gesendet.',
      };
    }

    const dueDateLabel = mainInvoice?.dueDate ? new Date(mainInvoice.dueDate).toLocaleDateString('de-DE') : 'sofort';
    const amountLabel = `EUR ${amount.toFixed(2)}`;
    const invoiceUrl = mainInvoice
      ? await EmailService.buildSystemUrl(`/invoices?invoiceId=${mainInvoice._id}`)
      : await EmailService.buildSystemUrl('/invoices');

    const variables = {
      companyName: process.env.COMPANY_NAME || 'McRepair.de',
      customerName: recipientName || 'Kunde',
      invoiceNumber: mainInvoice?.invoiceNumber || booking.bookingNumber || '-',
      openAmount: amountLabel,
      // Variablennamen der Mahnvorlage, damit der Ersatzweg unten validiert.
      amountOpen: amountLabel,
      originalDueDate: dueDateLabel,
      dunningStage: 'Zahlungsaufforderung',
      dueDate: dueDateLabel,
      invoiceUrl,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
      supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789',
      customNote: note || 'Bitte begleichen Sie den offenen Restbetrag.',
    };

    const record = await PaymentRequest.create({ ...baseRecord, amount, status: 'pending' });

    let emailResult = null;
    let templateName = '';
    let attempts = 0;
    try {
      // Erst der fachlich richtige Trigger. Sobald die Vorlage
      // 'Zahlungsaufforderung' im E-Mail-Service hinterlegt ist, greift dieser Weg.
      attempts += 1;
      emailResult = await EmailService.sendTriggerEmail('payment_request', recipientEmail, variables);
      templateName = 'payment_request';

      if (!emailResult?.success) {
        // Ersatzweg ueber die vorhandene Mahnvorlage, damit der Kunde ueberhaupt eine
        // Information bekommt. Der freie Hinweistext hat dort KEINEN Platzhalter und
        // wird daher nicht mitgesendet - siehe noteDelivered.
        attempts += 1;
        const fallback = await EmailService.sendTemplateEmail('Zahlungserinnerung', recipientEmail, variables);
        if (fallback?.success) {
          emailResult = fallback;
          templateName = 'Zahlungserinnerung';
        } else {
          emailResult = { success: false, error: fallback?.error || emailResult?.error || 'E-Mail konnte nicht gesendet werden.' };
        }
      }
    } catch (error) {
      emailResult = { success: false, error: error.message };
    }

    record.attempts = attempts;
    record.templateName = templateName;
    // Der Hinweistext erreicht den Kunden nur ueber eine Vorlage mit {{customNote}}.
    record.noteDelivered = Boolean(note) && emailResult?.success === true && templateName === 'payment_request';

    if (emailResult?.success) {
      record.status = 'accepted_by_provider';
      record.providerMessageId = emailResult.messageId || '';
      record.error = '';
    } else {
      record.status = 'failed';
      record.error = String(emailResult?.error || 'Unbekannter Fehler beim Versand.');
    }
    await record.save();

    const noteWarning = note && !record.noteDelivered
      ? 'Hinweis: Der persönliche Text konnte nicht mitgesendet werden, weil die verwendete E-Mail-Vorlage keinen Platzhalter dafür enthält.'
      : '';

    if (!emailResult?.success) {
      return {
        success: false,
        status: 'failed',
        requestId: String(record._id),
        openBalance,
        amount,
        recipientEmail,
        error: record.error,
        message: `Die Zahlungsaufforderung konnte nicht gesendet werden: ${record.error}`,
      };
    }

    return {
      success: true,
      status: 'accepted_by_provider',
      requestId: String(record._id),
      openBalance,
      amount,
      recipientEmail,
      channel: 'email',
      templateName,
      providerMessageId: record.providerMessageId,
      noteDelivered: record.noteDelivered,
      // Bewusste Wortwahl: uebergeben, nicht zugestellt.
      message: `Zahlungsaufforderung an ${recipientEmail} übergeben (eine Zustellung wird dadurch nicht garantiert).`
        + (noteWarning ? ` ${noteWarning}` : ''),
    };
  }

  /** Historie der Zahlungsaufforderungen einer Buchung, neueste zuerst. */
  static async getPaymentRequests(bookingId, filters = {}) {
    const PaymentRequest = require('../models/PaymentRequest');
    const BookingPaymentService = require('./bookingPaymentService');
    const { booking } = await BookingPaymentService.loadContext(bookingId);

    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 50, 1), 200);
    const requests = await PaymentRequest.find({ bookingId: booking._id })
      .sort({ requestedAt: -1 })
      .limit(limit)
      .lean();

    return { bookingId: String(booking._id), bookingNumber: booking.bookingNumber || '', requests };
  }

  /**
   * Kontrollierter Wiederversand.
   *
   * Der alte Datensatz wird NIE veraendert; es entsteht immer eine neue Zeile mit
   * resendOfId. Innerhalb einer Sperrfrist (Standard 24 h) wird abgelehnt, solange
   * nicht `force` gesetzt ist.
   */
  static async resendPaymentRequest(requestId, options = {}, actor = null) {
    const PaymentRequest = require('../models/PaymentRequest');

    const original = await PaymentRequest.findById(requestId);
    if (!original) throw buildFinancialError('Zahlungsaufforderung wurde nicht gefunden.', 404, 'PAYMENT_REQUEST_NOT_FOUND');

    const cooldownHours = Number.isFinite(Number(options.cooldownHours)) ? Number(options.cooldownHours) : 24;
    if (!options.force && cooldownHours > 0) {
      const since = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
      const recent = await PaymentRequest.findOne({
        bookingId: original.bookingId,
        status: 'accepted_by_provider',
        requestedAt: { $gte: since },
      }).sort({ requestedAt: -1 });

      if (recent) {
        throw buildFinancialError(
          `Für diesen Auftrag wurde bereits am ${new Date(recent.requestedAt).toLocaleString('de-DE')} eine Zahlungsaufforderung versendet. `
          + `Ein erneuter Versand ist erst nach ${cooldownHours} Stunden möglich.`,
          429,
          'PAYMENT_REQUEST_COOLDOWN'
        );
      }
    }

    return FinancialService.requestAdditionalPayment(
      String(original.bookingId),
      {
        note: options.note != null ? options.note : original.note,
        amount: options.amount != null ? options.amount : undefined,
        resendOfId: original._id,
      },
      actor
    );
  }

  // ──────────────────────────────────────────────
}

module.exports = FinancialService;