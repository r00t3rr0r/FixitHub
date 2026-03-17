const express = require('express');
const FinancialService = require('../services/financialService');
const { requireUser, requireRole } = require('./middleware/auth');

const router = express.Router();

// Payment Management Routes

// Get all payments (admin only)
router.get('/payments', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('GET /api/admin/financial/payments - Getting payments with filters:', req.query);

  try {
    const filters = {
      status: req.query.status,
      method: req.query.method,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      page: req.query.page,
      limit: req.query.limit
    };

    const result = await FinancialService.getPayments(filters);

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error getting payments:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get payments'
    });
  }
});

// Process refund (admin only)
router.post('/payments/:id/refund', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('POST /api/admin/financial/payments/:id/refund - Processing refund for payment:', req.params.id);

  try {
    const { amount, reason } = req.body;

    if (!amount || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Amount and reason are required'
      });
    }

    const refund = await FinancialService.processRefund(req.params.id, amount, reason);

    return res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      refund
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process refund'
    });
  }
});

// Customer Management Routes

// Search customers for invoice creation (admin only)
router.get('/customers/search', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('GET /api/admin/financial/customers/search - Searching customers with query:', req.query.query);

  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 2 characters long'
      });
    }

    const customers = await FinancialService.searchCustomers(query);

    return res.status(200).json({
      success: true,
      customers
    });
  } catch (error) {
    console.error('Error searching customers:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to search customers'
    });
  }
});

// Invoice Management Routes

// Get all invoices (admin only)
router.get('/invoices', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('GET /api/admin/financial/invoices - Getting invoices with filters:', req.query);

  try {
    const filters = {
      status: req.query.status,
      customerId: req.query.customerId,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      page: req.query.page,
      limit: req.query.limit
    };

    const result = await FinancialService.getInvoices(filters);

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error getting invoices:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get invoices'
    });
  }
});

// Create new invoice (admin only)
router.post('/invoices', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('POST /api/admin/financial/invoices - Creating new invoice');

  try {
    const invoice = await FinancialService.createInvoice(req.body);

    return res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      invoice
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to create invoice'
    });
  }
});

// Send invoice to customer (admin only)
router.post('/invoices/:id/send', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('POST /api/admin/financial/invoices/:id/send - Sending invoice:', req.params.id);

  try {
    const { email, message } = req.body;
    const result = await FinancialService.sendInvoice(req.params.id, email, message);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error sending invoice:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send invoice'
    });
  }
});

// Financial Reports Routes

// Get financial reports (admin only)
router.get('/reports', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('GET /api/admin/financial/reports - Getting financial reports with filters:', req.query);

  try {
    const filters = {
      period: req.query.period,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    };

    const report = await FinancialService.getFinancialReports(filters);

    return res.status(200).json({
      success: true,
      report
    });
  } catch (error) {
    console.error('Error getting financial reports:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get financial reports'
    });
  }
});

// Payment Gateway Management Routes

// Get payment gateways (admin only)
router.get('/gateways', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('GET /api/admin/financial/gateways - Getting payment gateways');

  try {
    const gateways = await FinancialService.getPaymentGateways();

    return res.status(200).json({
      success: true,
      gateways
    });
  } catch (error) {
    console.error('Error getting payment gateways:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get payment gateways'
    });
  }
});

// Update payment gateway (admin only)
router.put('/gateways/:id', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('PUT /api/admin/financial/gateways/:id - Updating payment gateway:', req.params.id);

  try {
    const gateway = await FinancialService.updatePaymentGateway(req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: 'Payment gateway updated successfully',
      gateway
    });
  } catch (error) {
    console.error('Error updating payment gateway:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update payment gateway'
    });
  }
});

// Utility Routes

// Create payment from order (admin only)
router.post('/orders/:orderId/payment', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('POST /api/admin/financial/orders/:orderId/payment - Creating payment from order:', req.params.orderId);

  try {
    const payment = await FinancialService.createPaymentFromOrder(req.params.orderId);

    return res.status(201).json({
      success: true,
      message: 'Payment created successfully',
      payment
    });
  } catch (error) {
    console.error('Error creating payment from order:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to create payment from order'
    });
  }
});

// Create invoice from order (admin only)
router.post('/orders/:orderId/invoice', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('POST /api/admin/financial/orders/:orderId/invoice - Creating invoice from order:', req.params.orderId);

  try {
    const invoice = await FinancialService.createInvoiceFromOrder(req.params.orderId);

    return res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      invoice
    });
  } catch (error) {
    console.error('Error creating invoice from order:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to create invoice from order'
    });
  }
});

module.exports = router;