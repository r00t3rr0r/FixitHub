const express = require('express');
const FinancialService = require('../services/financialService');
const { requireUser, requireRole } = require('./middleware/auth');

const router = express.Router();

/**
 * Einheitliche Fehlerantwort.
 *
 * Fachliche Fehler tragen statusCode + deutsche Meldung und werden unveraendert
 * durchgereicht. Ein UNERWARTETER Laufzeitfehler wird NICHT mehr als 400 mit seinem
 * technischen englischen Text ausgeliefert (frueher landete z.B.
 * "Maximum call stack size exceeded" direkt im Toast des Bearbeiters), sondern als
 * 500 mit einer deutschen Meldung; der Stack geht ins Log.
 */
const respondWithError = (res, error, context, fallbackMessage) => {
  const statusCode = Number(error?.statusCode);
  if (Number.isFinite(statusCode) && statusCode >= 400 && statusCode < 600) {
    console.warn(`${context}:`, error.message);
    return res.status(statusCode).json({
      success: false,
      error: error.message,
      code: error.code || undefined,
    });
  }

  console.error(`${context}:`, error);
  return res.status(500).json({
    success: false,
    error: fallbackMessage,
    code: 'INTERNAL_ERROR',
  });
};

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
    const {
      amount,
      reason,
      mode,
      gatewayProvider,
      gatewayReference
    } = req.body;

    if (!amount || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Amount and reason are required'
      });
    }

    const refund = await FinancialService.processRefund(req.params.id, amount, reason, {
      mode,
      gatewayProvider,
      gatewayReference
    });

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
      orderId: req.query.orderId,
      bookingId: req.query.bookingId,
      isReverseCharge: req.query.isReverseCharge,
      zmRelevant: req.query.zmRelevant,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      // Belegtyp-Ausschnitt: 'invoices' | 'creditNotes' | 'all'. isCreditNote ist die
      // gleichwertige Schreibweise ('true'/'false'), die der Client bereits schickt.
      // Ohne diese beiden Felder bekaemen die Rechnungs- und die Gutschriftenseite
      // denselben Ausschnitt und muessten clientseitig nachfiltern.
      scope: req.query.scope,
      isCreditNote: req.query.isCreditNote,
      // Belegnummer (verankert, indexgestuetzt) und Freitext (Nummer/Kunde/E-Mail).
      invoiceNumber: req.query.invoiceNumber,
      search: req.query.search,
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
    // Validate required fields
    const validation = FinancialService.validateGatewayConfiguration(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed: ' + validation.errors.join('; ')
      });
    }

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

// Create invoice from repair order IDs (admin only)
router.post('/invoices/from-repairs', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('POST /api/admin/financial/invoices/from-repairs - Generating invoice from repair orders');

  try {
    const { repairOrderIds, options } = req.body;

    if (!repairOrderIds || !Array.isArray(repairOrderIds) || repairOrderIds.length === 0) {
      return res.status(400).json({ success: false, error: 'repairOrderIds array is required' });
    }

    const invoice = await FinancialService.generateFromRepairOrders(repairOrderIds, options || {});
    return res.status(201).json({ success: true, message: 'Invoice generated successfully', invoice });
  } catch (error) {
    console.error('Error generating invoice from repair orders:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to generate invoice' });
  }
});

// Change invoice status (admin only)
router.patch('/invoices/:id/status', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('PATCH /api/admin/financial/invoices/:id/status - Changing invoice status:', req.params.id);

  try {
    const { status, notes, paymentMethod, paidAt } = req.body;
    if (!status) return res.status(400).json({ success: false, error: 'Es wurde kein neuer Status angegeben.' });

    const invoice = await FinancialService.changeInvoiceStatus(req.params.id, status, {
      notes,
      paymentMethod,
      paidAt,
    });
    return res.status(200).json({ success: true, message: 'Der Belegstatus wurde geändert.', invoice });
  } catch (error) {
    return respondWithError(res, error, 'Error changing invoice status', 'Der Belegstatus konnte nicht geändert werden.');
  }
});

// Record a (partial) payment against an invoice (admin only)
router.post('/invoices/:id/payments', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('POST /api/admin/financial/invoices/:id/payments - Recording invoice payment:', req.params.id);

  try {
    const result = await FinancialService.addInvoicePayment(req.params.id, {
      ...req.body,
      recordedBy: req.user?._id,
    });

    // Der persistierte Zustand, der HTTP-Status und die Meldung muessen sich decken:
    // eine bereits erfasste Zahlung ist kein Fehler und wird als 200 mit Hinweis
    // beantwortet, eine neue Buchung als 201.
    const warningTexts = [];
    if (result.warnings && result.warnings.length > 0) {
      warningTexts.push('Die Zahlung wurde gebucht. Der Auftrags-/Buchungsstatus konnte nicht automatisch nachgezogen werden.');
    }
    if (result.warning) warningTexts.push(result.warning);

    return res.status(result.duplicate ? 200 : 201).json({
      success: true,
      duplicate: Boolean(result.duplicate),
      message: result.message || 'Zahlung wurde erfasst.',
      payment: result.payment,
      invoice: result.invoice,
      ...(warningTexts.length > 0 ? { warning: warningTexts.join(' ') } : {}),
    });
  } catch (error) {
    return respondWithError(res, error, 'Error recording invoice payment', 'Die Zahlung konnte nicht erfasst werden.');
  }
});

// Create credit note for an invoice (admin only)
router.post('/invoices/:id/credit-note', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('POST /api/admin/financial/invoices/:id/credit-note - Creating credit note:', req.params.id);

  try {
    // req.body NICHT unbesehen durchreichen: correctionType steuert die Obergrenze
    // der Gutschrift und darf nur aus der bekannten Liste kommen.
    const { items, discount, taxRate, reason, dueDate, correctionType } = req.body || {};
    const creditNote = await FinancialService.createCreditNote(req.params.id, {
      ...(items !== undefined ? { items } : {}),
      ...(discount !== undefined ? { discount } : {}),
      ...(taxRate !== undefined ? { taxRate } : {}),
      ...(reason !== undefined ? { reason } : {}),
      ...(dueDate !== undefined ? { dueDate } : {}),
      ...(correctionType !== undefined ? { correctionType } : {}),
    });
    return res.status(201).json({ success: true, message: 'Gutschrift wurde erstellt.', creditNote });
  } catch (error) {
    return respondWithError(res, error, 'Error creating credit note', 'Die Gutschrift konnte nicht erstellt werden.');
  }
});

// Get overdue invoices (admin only) — must be declared before /:id to avoid shadowing
router.get('/invoices/overdue', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const invoices = await FinancialService.getOverdueInvoices();
    return res.status(200).json({ success: true, invoices });
  } catch (error) {
    console.error('Error getting overdue invoices:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to get overdue invoices' });
  }
});

// Get invoice details with linked payments & credit notes (admin only)
router.get('/invoices/:id', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('GET /api/admin/financial/invoices/:id - Getting invoice details:', req.params.id);
  try {
    const result = await FinancialService.getInvoiceDetails(req.params.id);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('Error getting invoice details:', error);
    return res.status(404).json({ success: false, error: error.message || 'Invoice not found' });
  }
});

// Run dunning job manually (admin only)
router.post('/dunning/run', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const result = await FinancialService.runDunningJob();
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('Error running dunning job:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to run dunning job' });
  }
});

// Transfer an overdue invoice to collection manually; collection is never auto-escalated.
router.post('/dunning/invoices/:id/collection', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const invoice = await FinancialService.activateCollection(req.params.id, req.user?._id);
    return res.status(200).json({ success: true, invoice });
  } catch (error) {
    console.error('Error activating collection:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to activate collection' });
  }
});

// Create persistent dunning run (admin only)
router.post('/dunning/runs', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const run = await FinancialService.createDunningRun(req.body, req.user?._id);
    return res.status(201).json({ success: true, run });
  } catch (error) {
    console.error('Error creating dunning run:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to create dunning run' });
  }
});

// Get dunning runs (admin only)
router.get('/dunning/runs', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const runs = await FinancialService.getDunningRuns({ status: req.query.status });
    return res.status(200).json({ success: true, runs });
  } catch (error) {
    console.error('Error getting dunning runs:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to get dunning runs' });
  }
});

// Get dunning run details (admin only)
router.get('/dunning/runs/:id', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const run = await FinancialService.getDunningRunById(req.params.id);
    return res.status(200).json({ success: true, run });
  } catch (error) {
    console.error('Error getting dunning run:', error);
    return res.status(404).json({ success: false, error: error.message || 'Failed to get dunning run' });
  }
});

// Update dunning run metadata/status (admin only)
router.patch('/dunning/runs/:id', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const run = await FinancialService.updateDunningRun(req.params.id, req.body, req.user?._id);
    return res.status(200).json({ success: true, run });
  } catch (error) {
    console.error('Error updating dunning run:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to update dunning run' });
  }
});

// Update dunning run item (admin only)
router.patch('/dunning/runs/:id/items/:invoiceId', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const run = await FinancialService.updateDunningRunItem(req.params.id, req.params.invoiceId, req.body, req.user?._id);
    return res.status(200).json({ success: true, run });
  } catch (error) {
    console.error('Error updating dunning run item:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to update dunning item' });
  }
});

// Add item to dunning run (admin only)
router.post('/dunning/runs/:id/items', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const { invoiceId } = req.body;
    if (!invoiceId) return res.status(400).json({ success: false, error: 'invoiceId is required' });

    const run = await FinancialService.addDunningRunItem(req.params.id, invoiceId, req.user?._id);
    return res.status(200).json({ success: true, run });
  } catch (error) {
    console.error('Error adding dunning run item:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to add dunning item' });
  }
});

// Reconcile overpayment for a booking (admin only)
router.post('/bookings/:bookingId/overpayment/reconcile', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const result = await FinancialService.handleOverpayment(req.params.bookingId, req.body || {});
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('Error reconciling overpayment:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to reconcile overpayment' });
  }
});

// Send payment request / Zahlungsaufforderung for a booking (admin only)
// KANAL: E-Mail. Es gibt keine PayPal-Zahlungsanforderung in diesem System.
// Antwort bleibt bewusst HTTP 200 mit `success`/`status` im Body, damit der Client
// zwischen "nichts offen", "kein Empfaenger" und "Versand fehlgeschlagen"
// unterscheiden kann, statt einen generischen Fehler-Toast zu zeigen.
router.post('/bookings/:bookingId/payment-request', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const result = await FinancialService.requestAdditionalPayment(
      req.params.bookingId,
      req.body || {},
      req.user
    );
    return res.status(200).json(result);
  } catch (error) {
    return respondWithError(res, error, 'Error sending payment request', 'Die Zahlungsaufforderung konnte nicht gesendet werden.');
  }
});

// List the payment requests already sent for a booking (admin only).
// Enthaelt Kunden-E-Mail-Adressen und bleibt deshalb admin-only.
router.get('/bookings/:bookingId/payment-requests', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const result = await FinancialService.getPaymentRequests(req.params.bookingId, req.query || {});
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return respondWithError(res, error, 'Error listing payment requests', 'Die Zahlungsaufforderungen konnten nicht geladen werden.');
  }
});

// Controlled re-send of a payment request (admin only).
// Legt immer einen NEUEN Datensatz an; innerhalb der Sperrfrist nur mit force=true.
router.post('/payment-requests/:id/resend', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const result = await FinancialService.resendPaymentRequest(req.params.id, req.body || {}, req.user);
    return res.status(200).json(result);
  } catch (error) {
    return respondWithError(res, error, 'Error resending payment request', 'Die Zahlungsaufforderung konnte nicht erneut gesendet werden.');
  }
});

// Force financial synchronization for a booking or order (admin only)
router.post('/bookings/:bookingId/sync', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    await FinancialService.syncOrderAndBookingValue(req.params.bookingId, req.body?.type || 'booking');
    const BookingPaymentService = require('../services/bookingPaymentService');
    const overview = await BookingPaymentService.getOverview(req.params.bookingId);
    return res.status(200).json({ success: true, overview });
  } catch (error) {
    console.error('Error syncing order/booking value:', error);
    return res.status(400).json({ success: false, error: error.message || 'Failed to sync financial values' });
  }
});

// Export payments (admin only)
router.get('/export/payments', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const { format = 'csv', ...filters } = req.query;
    const data = await FinancialService.exportPayments(filters, format);

    if (format === 'json') {
      return res.status(200).json({ success: true, data });
    }

    const timestamp = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payments-${timestamp}.csv"`);
    return res.status(200).send('\uFEFF' + data); // BOM for Excel
  } catch (error) {
    console.error('Error exporting payments:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to export payments' });
  }
});

// Export invoices (admin only)
router.get('/export/invoices', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const { format = 'csv', ...filters } = req.query;
    const data = await FinancialService.exportInvoices(filters, format);

    if (format === 'json') {
      return res.status(200).json({ success: true, data });
    }

    const timestamp = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="invoices-${timestamp}.csv"`);
    return res.status(200).send('\uFEFF' + data); // BOM for Excel
  } catch (error) {
    console.error('Error exporting invoices:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to export invoices' });
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
    const existingInvoiceId = error?.existingInvoice?._id || null;
    return res.status(error.statusCode || 400).json({
      success: false,
      error: error.message || 'Failed to create invoice from order',
      code: error.code,
      existingInvoice: error.existingInvoice,
      redirectTo: existingInvoiceId ? `/admin/financial?tab=overview&highlightInvoiceId=${existingInvoiceId}` : null,
    });
  }
});

module.exports = router;