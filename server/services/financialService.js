const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const User = require('../models/User');

class FinancialService {
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

  static async processRefund(paymentId, amount, reason) {
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

      // Update payment status and refund info
      payment.status = 'refunded';
      payment.refundAmount = amount;
      payment.refundReason = reason;
      payment.refundedAt = new Date();

      await payment.save();

      console.log('FinancialService: Refund processed successfully');
      return {
        _id: 'refund_' + Date.now(),
        paymentId,
        amount,
        reason,
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
}

module.exports = FinancialService;