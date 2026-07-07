const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const DunningRun = require('../models/DunningRun');
const Order = require('../models/Order');
const Booking = require('../models/Booking');
const User = require('../models/User');
const SystemConfiguration = require('../models/SystemConfiguration');
const EmailService = require('./emailService');
const NotificationService = require('./notificationService');

function parseDueDaysFromTerms(paymentTerms) {
  if (!paymentTerms) return null;

  const match = String(paymentTerms).match(/(\d+)/);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateDiscountAmount(subtotal, discountPercent) {
  const numericSubtotal = Number(subtotal);
  const numericDiscountPercent = Number(discountPercent);

  if (!Number.isFinite(numericSubtotal) || numericSubtotal <= 0) return 0;
  if (!Number.isFinite(numericDiscountPercent) || numericDiscountPercent <= 0) return 0;

  return Number(((numericSubtotal * numericDiscountPercent) / 100).toFixed(2));
}

function composePaymentTerms(financialProfile) {
  const baseTerms = String(financialProfile?.paymentTerms || '').trim();
  const cashDiscountPercent = Number(financialProfile?.cashDiscountPercent || 0);
  const cashDiscountDays = Number(financialProfile?.cashDiscountDays || 0);

  if (cashDiscountPercent > 0 && cashDiscountDays > 0) {
    const skontoText = `${cashDiscountPercent}% Skonto bei Zahlung innerhalb ${cashDiscountDays} Tagen`;
    return baseTerms ? `${baseTerms} | ${skontoText}` : skontoText;
  }

  return baseTerms || 'Net 14';
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

// Default financial settings (fallback if no config exists)
const DEFAULT_FINANCIAL_SETTINGS = {
  defaults: {
    currency: 'EUR',
    locale: 'de-DE',
    taxRate: 19,
    paymentDueDays: 14,
    paymentTerms: 'Net 14',
    invoicePrefix: 'INV-',
    creditNotePrefix: 'CN-',
    defaultDiscount: 0,
    defaultPaymentMethod: 'credit_card'
  },
  discountPolicy: {
    allowManualDiscounts: true,
    maxDiscountPercent: 20,
    earlyPaymentDiscountPercent: 2,
    lateFeePercent: 5
  },
  invoiceMetadata: {
    sellerName: 'FixitHub',
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
    const customerDueDays = parseDueDaysFromTerms(customerPaymentTerms);
    const taxMode = groupFinanceProfile.taxMode || 'default';
    const resolvedTaxRate = taxMode === 'tax_free' || taxMode === 'reverse_charge'
      ? 0
      : settings.defaults.taxRate;

    return {
      currency: groupFinanceProfile.currency || settings.defaults.currency,
      locale: settings.defaults.locale,
      taxRate: resolvedTaxRate,
      taxMode,
      paymentDueDays: customerDueDays ?? groupFinanceProfile.paymentDueDays ?? settings.defaults.paymentDueDays,
      paymentTerms: customerPaymentTerms || groupFinanceProfile.paymentTermsLabel || settings.defaults.paymentTerms,
      invoicePrefix: groupFinanceProfile.invoicePrefix || settings.defaults.invoicePrefix,
      defaultDiscountPercent: typeof resolvedCustomer?.discount === 'number' && resolvedCustomer.discount > 0
        ? resolvedCustomer.discount
        : groupFinanceProfile.discountPercent ?? settings.defaults.defaultDiscount,
      defaultPaymentMethod: resolvedCustomer?.paymentMethod
        || (Array.isArray(groupFinanceProfile.allowedPaymentMethods) && groupFinanceProfile.allowedPaymentMethods[0])
        || settings.defaults.defaultPaymentMethod,
      creditLimit: groupFinanceProfile.creditLimit ?? 0,
      cashDiscountPercent: groupFinanceProfile.cashDiscountPercent ?? settings.discountPolicy.earlyPaymentDiscountPercent,
      cashDiscountDays: groupFinanceProfile.cashDiscountDays ?? 0,
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
      const searchRegex = new RegExp(query, 'i');

      const customers = await User.find({
        $or: [
          { name: searchRegex },
          { email: searchRegex }
        ],
        role: 'customer'
      })
      .select('name email phone invoiceAddress paymentAddress')
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
      const limit = parseInt(filters.limit) || 10;
      const skip = (page - 1) * limit;

      const payments = await Payment.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalPayments = await Payment.countDocuments(query);
      const totalPages = Math.ceil(totalPayments / limit);

      // Calculate total amount
      const totalAmountResult = await Payment.aggregate([
        { $match: query },
        { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
      ]);

      const totalAmount = totalAmountResult.length > 0 ? totalAmountResult[0].totalAmount : 0;

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
      payment.status = 'refunded';
      payment.refundAmount = amount;
      payment.refundReason = reason;
      payment.refundedAt = new Date();
      payment.refundMode = requestedMode;
      payment.refundGatewayProvider = resolvedGatewayProvider;
      payment.refundGatewayReference = options.gatewayReference || '';

      await payment.save();

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

      // Apply filters
      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.customerId) {
        query.customerId = filters.customerId;
      }

      if (filters.orderId) {
        const normalizedOrderId = String(filters.orderId).trim();
        if (normalizedOrderId) {
          query.$or = [
            { orderId: normalizedOrderId },
            { repairOrderIds: normalizedOrderId }
          ];
        }
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
      const limit = parseInt(filters.limit) || 10;
      const skip = (page - 1) * limit;

      const invoices = await Invoice.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('repairOrderIds', 'orderNumber status deviceType')
        .populate('orderId', 'orderNumber status deviceType');

      const totalInvoices = await Invoice.countDocuments(query);
      const totalPages = Math.ceil(totalInvoices / limit);

      // Calculate total amount
      const totalAmountResult = await Invoice.aggregate([
        { $match: query },
        { $group: { _id: null, totalAmount: { $sum: '$total' } } }
      ]);

      const totalAmount = totalAmountResult.length > 0 ? totalAmountResult[0].totalAmount : 0;

      console.log('FinancialService: Found', invoices.length, 'invoices');
      return {
        invoices,
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

      // Apply financial defaults if not explicitly provided
      if (!cleanedInvoiceData.numberPrefix && !cleanedInvoiceData.invoiceNumber) {
        cleanedInvoiceData.numberPrefix = financialProfile.invoicePrefix;
      }
      
      if (!cleanedInvoiceData.dueDate && cleanedInvoiceData.dueDate !== false) {
        const dueDays = financialProfile.paymentDueDays || 14;
        cleanedInvoiceData.dueDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000);
      }
      
      if (!cleanedInvoiceData.paymentTerms) {
        cleanedInvoiceData.paymentTerms = financialProfile.paymentTerms;
      }

      if ((cleanedInvoiceData.discount === undefined || cleanedInvoiceData.discount === null) && Number.isFinite(Number(cleanedInvoiceData.subtotal))) {
        cleanedInvoiceData.discount = calculateDiscountAmount(cleanedInvoiceData.subtotal, financialProfile.defaultDiscountPercent);
      }

      if ((cleanedInvoiceData.tax === undefined || cleanedInvoiceData.tax === null) && Number.isFinite(Number(cleanedInvoiceData.subtotal))) {
        cleanedInvoiceData.tax = Number(cleanedInvoiceData.subtotal) * (financialProfile.taxRate / 100);
      }

      if ((cleanedInvoiceData.total === undefined || cleanedInvoiceData.total === null) && Number.isFinite(Number(cleanedInvoiceData.subtotal))) {
        cleanedInvoiceData.total = Number(cleanedInvoiceData.subtotal) + Number(cleanedInvoiceData.tax || 0) - Number(cleanedInvoiceData.discount || 0);
      }

      // Create invoice
      const invoice = new Invoice(cleanedInvoiceData);
      await invoice.save();
      await FinancialService.syncBookingPaymentStatus(invoice);

      console.log('FinancialService: Invoice created successfully with defaults applied');
      return invoice;
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
        supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
        supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
      });

      if (!emailResult?.success) {
        throw new Error(emailResult?.error || 'Failed to send invoice email');
      }

      // Update invoice status
      invoice.status = 'sent';
      invoice.sentAt = new Date();
      await invoice.save();
      await FinancialService.syncBookingPaymentStatus(invoice);
      await FinancialService.syncBookingPaymentStatus(invoice);

      await NotificationService.createNotification({
        userId: invoice.customerId,
        title: 'Neue Rechnung verfuegbar',
        message: `Ihre Rechnung ${invoice.invoiceNumber} wurde versendet.`,
        type: 'system',
        orderId: invoice.orderId || undefined,
        actionUrl: '/customer/invoices',
        metadata: {
          invoiceId: String(invoice._id),
          invoiceNumber: invoice.invoiceNumber
        }
      }, { sendEmail: false });

      console.log('FinancialService: Invoice sent successfully');
      return { success: true, message: 'Invoice sent successfully' };
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
            statement_descriptor: 'FixitHub Repair',
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
  static async createInvoiceFromOrder(orderId) {
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
          throw duplicateError;
        }
      }

      const financialProfile = await FinancialService.resolveFinancialProfile({ customer: order.customerId });

      // Convert totalCost to number if it's a Decimal128
      const totalCost = typeof order.totalCost === 'object' ? Number(order.totalCost) : order.totalCost;

      // Build invoice items from order
      const items = [];

      // Add main services
      order.services.forEach(service => {
        items.push({
          description: service,
          quantity: 1,
          unitPrice: totalCost / (order.services.length + order.addOns.length),
          total: totalCost / (order.services.length + order.addOns.length),
          type: 'service'
        });
      });

      // Add add-on services
      order.addOns.forEach(addon => {
        items.push({
          description: addon.name,
          quantity: 1,
          unitPrice: addon.price,
          total: addon.price,
          type: 'addon'
        });
      });

      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const discount = calculateDiscountAmount(subtotal, financialProfile.defaultDiscountPercent);
      const taxRate = financialProfile.taxRate / 100;
      const dueDays = financialProfile.paymentDueDays || 30;
      const invoicePrefix = financialProfile.invoicePrefix;
      const paymentTerms = composePaymentTerms(financialProfile);

      const invoice = new Invoice({
        orderId: order._id,
        bookingId: order.bookingId || undefined,
        customerId: order.customerId._id,
        customerName: order.customerId.name,
        customerEmail: order.customerId.email,
        billingAddress: resolveBillingAddressFromOrder(order),
        shippingAddress: resolveShippingAddressFromOrder(order),
        items,
        subtotal,
        tax: subtotal * taxRate,
        discount,
        total: subtotal + (subtotal * taxRate) - discount,
        dueDate: new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000),
        numberPrefix: invoicePrefix,
        paymentTerms,
      });

      await invoice.save();

      console.log('FinancialService: Invoice created from order successfully with resolved tax rate:', financialProfile.taxRate + '%');
      return invoice;
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

    orders.forEach(order => {
      const totalCost = typeof order.totalCost === 'object' ? Number(order.totalCost) : (order.totalCost || 0);
      const serviceCount = (order.services || []).length + (order.addOns || []).length || 1;

      (order.services || []).forEach(service => {
        items.push({
          description: typeof service === 'string' ? service : (service.name || 'Service'),
          quantity: 1,
          unitPrice: totalCost / serviceCount,
          total: totalCost / serviceCount,
          type: 'service'
        });
      });

      (order.addOns || []).forEach(addon => {
        const price = typeof addon.price === 'object' ? Number(addon.price) : (addon.price || 0);
        items.push({
          description: addon.name || 'Add-on',
          quantity: 1,
          unitPrice: price,
          total: price,
          type: 'addon'
        });
      });

      if (items.length === 0) {
        items.push({
          description: `Repair Order #${order.orderNumber || order._id}`,
          quantity: 1,
          unitPrice: totalCost,
          total: totalCost,
          type: 'service'
        });
      }
    });

    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const taxRate  = options.taxRate != null ? options.taxRate : financialProfile.taxRate / 100;
    const tax      = subtotal * taxRate;
    const discount = options.discount != null
      ? options.discount
      : calculateDiscountAmount(subtotal, financialProfile.defaultDiscountPercent);
    const total    = subtotal + tax - discount;

    const bookingIds = [...new Set(orders.map((order) => order.bookingId ? String(order.bookingId) : '').filter(Boolean))];
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
      billingAddress: resolveBillingAddressFromOrder(orders[0]),
      shippingAddress: resolveShippingAddressFromOrder(orders[0]),
      items,
      subtotal,
      tax,
      discount,
      total,
      numberPrefix:  options.numberPrefix || financialProfile.invoicePrefix || 'INV',
      dueDate:       options.dueDate || new Date(Date.now() + (financialProfile.paymentDueDays || 30) * 24 * 60 * 60 * 1000),
      paymentTerms:  options.paymentTerms || composePaymentTerms(financialProfile),
      notes:         options.notes || '',
      status:        'draft'
    };

    const invoice = new Invoice(invoiceData);
    await invoice.save();
    await FinancialService.syncBookingPaymentStatus(invoice);

    console.log('FinancialService: Invoice generated from repair orders:', invoice.invoiceNumber);
    return invoice;
  }

  // Change invoice status with transition validation
  static async changeInvoiceStatus(invoiceId, newStatus, data = {}) {
    console.log('FinancialService: Changing invoice status:', invoiceId, '->', newStatus);

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    const allowed = INVOICE_STATUS_TRANSITIONS[invoice.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Cannot transition from "${invoice.status}" to "${newStatus}"`);
    }

    const normalizedPaymentMethod = normalizeTrackedPaymentMethod(data.paymentMethod);
    const normalizedPaidAt = normalizeTrackedPaidAt(data.paidAt);

    if (data.paymentMethod && !normalizedPaymentMethod) {
      throw new Error('Invalid payment method. Allowed values: credit_card, sepa, paypal, cash');
    }

    if (data.paidAt && !normalizedPaidAt) {
      throw new Error('Invalid paidAt timestamp');
    }

    if (newStatus === 'paid') {
      if (!normalizedPaymentMethod) {
        throw new Error('Payment method is required when marking an invoice as paid');
      }
      if (!normalizedPaidAt) {
        throw new Error('Paid timestamp is required when marking an invoice as paid');
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

    await FinancialService.syncOrderPaymentTracking(invoice);

    await FinancialService.syncBookingPaymentStatus(invoice);

    return invoice;
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

    const uniqueOrderIds = [...new Set(orderIds.map((entry) => String(entry)).filter(Boolean))];
    if (uniqueOrderIds.length === 0) return;

    const paymentStatusMap = {
      paid: 'paid',
      partially_paid: 'partial',
      credited: 'refunded',
    };

    await Order.updateMany(
      { _id: { $in: uniqueOrderIds } },
      {
        $set: {
          paymentStatus: paymentStatusMap[invoice.status] || 'pending',
          paymentMethod: normalizeTrackedPaymentMethod(invoice.paymentMethod),
          paidAt: normalizeTrackedPaidAt(invoice.paidAt),
        }
      }
    );
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
      const linkedOrder = await Order.findOne({
        _id: { $in: invoice.repairOrderIds },
        bookingId: { $ne: null }
      }).select('bookingId').lean();
      bookingId = linkedOrder?.bookingId;
    }

    if (!bookingId) return;

    const booking = await Booking.findById(bookingId);
    if (!booking) return;

    const invoiceStatus = String(invoice.status || 'draft');
    const invoiceLikeStatuses = ['draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue'];
    booking.paymentStatus = invoiceLikeStatuses.includes(invoiceStatus) ? invoiceStatus : 'pending';

    if (invoiceStatus === 'paid') {
      booking.billingStatus = 'paid';
    } else if (invoiceStatus === 'partially_paid') {
      booking.billingStatus = 'partially-paid';
    } else {
      booking.billingStatus = 'unpaid';
    }

    await booking.save();
  }

  // Record a partial (or full) payment against an invoice
  static async addInvoicePayment(invoiceId, paymentData) {
    console.log('FinancialService: Adding payment to invoice:', invoiceId);

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    const allowedStatuses = ['draft', 'pending_approval', 'sent', 'viewed', 'partially_paid', 'overdue'];
    if (!allowedStatuses.includes(invoice.status)) {
      throw new Error(`Cannot record payment for invoice in status "${invoice.status}"`);
    }

    const amount = parseFloat(paymentData.amount);
    if (isNaN(amount) || amount <= 0) throw new Error('Invalid payment amount');

    const remaining = invoice.total - (invoice.paidAmount || 0);
    if (amount > remaining + 0.01) {
      throw new Error(`Payment amount (${amount}) exceeds remaining balance (${remaining.toFixed(2)})`);
    }

    // Create payment record
    const payment = new Payment({
      invoiceId: invoice._id,
      customerId:    invoice.customerId,
      customerName:  invoice.customerName,
      amount,
      currency:       paymentData.currency || 'EUR',
      paymentMethod:  paymentData.paymentMethod || 'bank_transfer',
      status:         'completed',
      processedAt:    new Date(),
      gatewayResponse: paymentData.gatewayResponse || '',
      metadata:       paymentData.metadata || {}
    });

    await payment.save();

    // Update invoice paidAmount and status
    invoice.paidAmount = (invoice.paidAmount || 0) + amount;

    if (invoice.paidAmount >= invoice.total - 0.01) {
      invoice.status    = 'paid';
      invoice.paidAt    = new Date();
    } else {
      invoice.status = 'partially_paid';
    }

    await invoice.save();

    await FinancialService.syncOrderPaymentTracking(invoice);

    await FinancialService.syncBookingPaymentStatus(invoice);

    return { payment, invoice };
  }

  // Create a credit note for a paid or cancelled invoice
  static async createCreditNote(invoiceId, options = {}) {
    console.log('FinancialService: Creating credit note for invoice:', invoiceId);

    const original = await Invoice.findById(invoiceId);
    if (!original) throw new Error('Invoice not found');

    const allowedStatuses = ['paid', 'cancelled', 'credited'];
    if (!allowedStatuses.includes(original.status)) {
      throw new Error(`Credit notes can only be created for paid or cancelled invoices (current: "${original.status}")`);
    }

    // Load financial settings
    const settings = await FinancialService.getFinancialSettings();

    // Build credit note items (negative amounts)
    const creditItems = (options.items || original.items).map(item => ({
      description: `Gutschrift: ${item.description}`,
      quantity: item.quantity,
      unitPrice: -Math.abs(item.unitPrice),
      total: -Math.abs(item.total),
      type: item.type
    }));

    const subtotal  = creditItems.reduce((s, i) => s + i.total, 0);
    const taxRate = options.taxRate != null ? (options.taxRate / 100) : (settings.defaults.taxRate / 100);
    const tax = subtotal * taxRate;
    const discount = Math.abs(Number(options.discount) || 0);
    const total = subtotal + tax - discount;
    const creditNotePrefix = options.numberPrefix || settings.defaults.creditNotePrefix;

    const creditNote = new Invoice({
      creditNoteOf:  original._id,
      isCreditNote:  true,
      numberPrefix:  creditNotePrefix,
      repairOrderIds: original.repairOrderIds,
      orderId:       original.orderId,
      customerId:    original.customerId,
      customerName:  original.customerName,
      customerEmail: original.customerEmail,
      items:         creditItems,
      subtotal,
      tax,
      discount,
      total,
      dueDate:       options.dueDate ? new Date(options.dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      paymentTerms:  'Sofort',
      notes:         options.reason || `Gutschrift für Rechnung ${original.invoiceNumber}`,
      status:        'draft'
    });

    await creditNote.save();

    // Mark original as credited
    original.status = 'credited';
    await original.save();

    console.log('FinancialService: Credit note created successfully with configured tax rate:', settings.defaults.taxRate + '%');
    return creditNote;
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

    // Payments directly booked against this invoice
    const payments = await Payment.find({ invoiceId: invoice._id })
      .sort({ createdAt: -1 });

    // Credit notes created for this invoice
    const creditNotes = await Invoice.find({ creditNoteOf: invoice._id })
      .select('_id invoiceNumber status total createdAt isCreditNote notes')
      .sort({ createdAt: -1 });

    return { invoice, payments, creditNotes };
  }

  // Get all overdue invoices (dueDate passed, status not terminal)
  static async getOverdueInvoices() {
    const now = new Date();
    return Invoice.find({
      dueDate: { $lt: now },
      status:  { $nin: ['paid', 'cancelled', 'credited', 'draft'] }
    }).sort({ dueDate: 1 });
  }

  // Dunning job: find overdue invoices, escalate dunning level, return list with actions
  static async runDunningJob() {
    console.log('FinancialService: Running dunning job');

    const now = new Date();
    const overdueInvoices = await Invoice.find({
      dueDate: { $lt: now },
      status:  { $nin: ['paid', 'cancelled', 'credited'] }
    });

    const actions = [];

    for (const invoice of overdueInvoices) {
      // Mark overdue if not already
      if (!['overdue', 'partially_paid'].includes(invoice.status)) {
        invoice.status = 'overdue';
      }

      const daysPastDue = Math.floor((now - invoice.dueDate) / (1000 * 60 * 60 * 24));
      let newLevel = invoice.dunningLevel || 0;

      if (daysPastDue >= 30 && newLevel < 3) newLevel = 3;
      else if (daysPastDue >= 14 && newLevel < 2) newLevel = 2;
      else if (daysPastDue >= 3  && newLevel < 1) newLevel = 1;

      const escalated = newLevel > (invoice.dunningLevel || 0);

      if (escalated) {
        invoice.dunningLevel      = newLevel;
        invoice.dunningNotifiedAt = now;
        await invoice.save();

        actions.push({
          invoiceId:    invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          customerName:  invoice.customerName,
          customerEmail: invoice.customerEmail,
          dunningLevel:  newLevel,
          daysPastDue,
          amount:        invoice.total,
          action:        `Send dunning notice level ${newLevel}`
        });
      }
    }

    console.log(`FinancialService: Dunning job complete — ${actions.length} notices queued`);
    return { processed: overdueInvoices.length, actions };
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
    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo)   query.createdAt.$lte = new Date(filters.dateTo);
    }

    const invoices = await Invoice.find(query).sort({ createdAt: -1 }).limit(10000);

    if (format === 'json') return invoices;

    // CSV with tax breakdown
    const headers = ['invoiceNumber','customerName','customerEmail','subtotal','tax','discount','total','paidAmount','status','dueDate','createdAt','isCreditNote'];
    const rows = invoices.map(inv => [
      inv.invoiceNumber,
      inv.customerName,
      inv.customerEmail,
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

  // ──────────────────────────────────────────────
}

module.exports = FinancialService;