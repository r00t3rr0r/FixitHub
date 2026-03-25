const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const DunningRun = require('../models/DunningRun');
const Order = require('../models/Order');
const User = require('../models/User');

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

class FinancialService {
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
        .limit(limit);

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

      // Get customer info if customerId is provided
      if (cleanedInvoiceData.customerId) {
        const customer = await User.findById(cleanedInvoiceData.customerId);
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
      }

      // Create invoice
      const invoice = new Invoice(cleanedInvoiceData);
      await invoice.save();

      console.log('FinancialService: Invoice created successfully');
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

      // Update invoice status
      invoice.status = 'sent';
      invoice.sentAt = new Date();
      await invoice.save();

      // Here you would integrate with email service (SendGrid, etc.)
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
      // For now, return mock data as this would typically be stored in system configuration
      const gateways = [
        {
          _id: 'gateway1',
          name: 'Stripe',
          provider: 'stripe',
          isActive: true,
          configuration: {
            publicKey: 'pk_test_***',
            secretKey: 'sk_test_***',
            webhookUrl: 'https://api.fixithub.com/webhooks/stripe',
            currency: 'USD',
            processingFee: 2.9,
            fraudProtection: true
          },
          supportedMethods: ['credit_card', 'debit_card', 'apple_pay', 'google_pay'],
          countries: ['US', 'CA', 'GB', 'AU'],
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
            currency: 'USD',
            processingFee: 3.5,
            fraudProtection: true
          },
          supportedMethods: ['paypal', 'paypal_credit'],
          countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR'],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date()
        }
      ];

      console.log('FinancialService: Payment gateways retrieved successfully');
      return gateways;
    } catch (error) {
      console.error('FinancialService: Error getting payment gateways:', error);
      throw error;
    }
  }

  static async updatePaymentGateway(gatewayId, updates) {
    console.log('FinancialService: Updating payment gateway:', gatewayId);

    try {
      // Mock implementation - in real app this would update system configuration
      const updatedGateway = {
        _id: gatewayId,
        ...updates,
        updatedAt: new Date()
      };

      console.log('FinancialService: Payment gateway updated successfully');
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

      const amount = typeof order.totalCost === 'object' ? Number(order.totalCost) : order.totalCost;

      const payment = new Payment({
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerId: order.customerId._id,
        customerName: order.customerId.name,
        amount: amount,
        paymentMethod: 'credit_card', // Default method
        gatewayResponse: 'Payment created'
      });

      await payment.save();

      console.log('FinancialService: Payment created from order successfully');
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

      const invoice = new Invoice({
        orderId: order._id,
        customerId: order.customerId._id,
        customerName: order.customerId.name,
        customerEmail: order.customerId.email,
        items,
        subtotal: totalCost,
        tax: totalCost * 0.08, // 8% tax
        total: totalCost * 1.08,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      });

      await invoice.save();

      console.log('FinancialService: Invoice created from order successfully');
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
    const taxRate  = options.taxRate != null ? options.taxRate : 0.19;
    const tax      = subtotal * taxRate;
    const discount = options.discount || 0;
    const total    = subtotal + tax - discount;

    const invoiceData = {
      repairOrderIds,
      orderId: orders.length === 1 ? orders[0]._id : undefined,
      customerId:    customer._id,
      customerName:  customer.name,
      customerEmail: customer.email,
      items,
      subtotal,
      tax,
      discount,
      total,
      numberPrefix:  options.numberPrefix || 'INV',
      dueDate:       options.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      paymentTerms:  options.paymentTerms || 'Net 30',
      notes:         options.notes || '',
      status:        'draft'
    };

    const invoice = new Invoice(invoiceData);
    await invoice.save();

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

    invoice.status = newStatus;

    if (newStatus === 'sent') {
      invoice.sentAt = new Date();
    } else if (newStatus === 'pending_approval') {
      // no extra field
    } else if (newStatus === 'paid') {
      invoice.paidAt = new Date();
      invoice.paidAmount = invoice.total;
    } else if (newStatus === 'cancelled') {
      invoice.cancelledAt = new Date();
    } else if (newStatus === 'approved') {
      invoice.approvedAt = new Date();
    }

    if (data.notes) invoice.notes = data.notes;

    await invoice.save();
    return invoice;
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

    // Build credit note items (negative amounts)
    const creditItems = (options.items || original.items).map(item => ({
      description: `Gutschrift: ${item.description}`,
      quantity: item.quantity,
      unitPrice: -Math.abs(item.unitPrice),
      total: -Math.abs(item.total),
      type: item.type
    }));

    const subtotal  = creditItems.reduce((s, i) => s + i.total, 0);
    const tax       = subtotal * (options.taxRate != null ? options.taxRate : 0.19);
    const discount  = Math.abs(Number(options.discount) || 0);
    const total     = subtotal + tax - discount;

    const creditNote = new Invoice({
      creditNoteOf:  original._id,
      isCreditNote:  true,
      numberPrefix:  options.numberPrefix || 'CN',
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

    return creditNote;
  }

  // Get detailed invoice context: invoice + linked payments + linked credit notes
  static async getInvoiceDetails(invoiceId) {
    console.log('FinancialService: Getting invoice details for:', invoiceId);

    const invoice = await Invoice.findById(invoiceId)
      .populate('creditNoteOf', 'invoiceNumber status total createdAt isCreditNote');
    if (!invoice) throw new Error('Invoice not found');

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