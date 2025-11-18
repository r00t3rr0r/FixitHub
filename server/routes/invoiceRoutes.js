const express = require('express');
const router = express.Router();
const { requireUser } = require('./middleware/auth');
const Invoice = require('../models/Invoice');

// Description: Get all invoices for the authenticated customer
// Endpoint: GET /api/invoices
// Request: { status?: string, limit?: number, skip?: number }
// Response: { success: boolean, invoices: Invoice[], count: number }
router.get('/', requireUser, async (req, res) => {
  try {
    console.log('InvoiceRoutes: Getting invoices for user:', req.user._id);

    const { status, limit = 50, skip = 0 } = req.query;

    const filters = { customerId: req.user._id };
    if (status) {
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

    // Verify ownership
    if (invoice.customerId.toString() !== req.user._id.toString() && req.user.role !== 'admin' && req.user.role !== 'staff') {
      console.log('InvoiceRoutes: Unauthorized access to invoice');
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view this invoice',
      });
    }

    console.log('InvoiceRoutes: Invoice retrieved successfully');

    res.json({
      success: true,
      invoice: invoice,
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
    if (invoice.customerId.toString() !== req.user._id.toString()) {
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

    const totalInvoices = await Invoice.countDocuments({ customerId: req.user._id });
    const paidInvoices = await Invoice.countDocuments({ customerId: req.user._id, status: 'paid' });
    const unpaidInvoices = await Invoice.countDocuments({
      customerId: req.user._id,
      status: { $in: ['sent', 'viewed', 'overdue'] }
    });
    const overdueInvoices = await Invoice.countDocuments({ customerId: req.user._id, status: 'overdue' });

    // Calculate total amounts
    const totalAmount = await Invoice.aggregate([
      { $match: { customerId: req.user._id } },
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
