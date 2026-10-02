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

// Fachliche Fehler (statusCode, deutsch) unveraendert; technische/englische Texte
// (Mongoose-Validierung, Laufzeitfehler) als deutsche Meldung, Details nur im Log.
const germanCreateError = (error, fallbackMessage) => {
  if (Number.isFinite(Number(error?.statusCode)) && error?.message) return error.message;
  if (error?.name === 'ValidationError') return 'Die Rechnungsdaten sind unvollständig oder ungültig. Bitte Positionen, Kunde und Beträge prüfen.';
  return fallbackMessage;
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
      limit: req.query.limit,
      // Buchungs-/Auftrags-/Rechnungsnummer oder Kunde (FIN-9)
      search: req.query.search,
      // 'pruefung' = Zahlungen in Pruefung (gleiche Regel wie der Dashboard-Zaehler)
      review: req.query.review
    };

    const result = await FinancialService.getPayments(filters);

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    return respondWithError(res, error, 'Error getting payments', 'Die Zahlungen konnten nicht geladen werden.');
  }
});

// Process refund (admin only)
// mode 'manual'  = Rueckzahlung wurde ausserhalb ausgefuehrt und wird hier erfasst.
// mode 'gateway' = ECHTE Erstattung beim Zahlungsanbieter (derzeit PayPal). Eine
//                  ausstehende Anbieter-Erstattung zaehlt erst nach Bestaetigung.
router.post('/payments/:id/refund', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('POST /api/admin/financial/payments/:id/refund - Processing refund for payment:', req.params.id);

  try {
    const {
      amount,
      reason,
      mode,
      gatewayProvider,
      gatewayReference,
      idempotencyKey
    } = req.body || {};

    if (!amount || !String(reason || '').trim()) {
      return res.status(400).json({
        success: false,
        error: 'Betrag und Grund der Erstattung sind erforderlich.'
      });
    }

    const refund = await FinancialService.processRefund(req.params.id, amount, reason, {
      mode,
      gatewayProvider,
      gatewayReference,
      idempotencyKey: idempotencyKey || req.get('Idempotency-Key') || undefined,
      recordedBy: req.user?._id,
    });

    let message = 'Die Erstattung wurde erfasst.';
    if (refund.indeterminate) {
      // Zeitueberschreitung/Stoerung beim Anbieter: das Geld kann bereits geflossen sein.
      message = 'PayPal hat nicht eindeutig geantwortet. Die Erstattung ist als „ausstehend – Abgleich nötig“ vorgemerkt und zählt noch nicht als erstattet. '
        + 'Sie wird über die PayPal-Benachrichtigung abgeglichen oder beim erneuten Auslösen desselben Vorgangs geprüft – es wird dabei nicht doppelt erstattet.';
    } else if (refund.duplicate && refund.status === 'completed') {
      message = 'Diese Erstattung wurde bereits erfasst und nicht erneut gebucht.';
    } else if (refund.status === 'pending') {
      message = 'Die Erstattung wurde beim Zahlungsanbieter angestoßen und ist noch ausstehend. Sie zählt erst nach Bestätigung als erstattet.';
    } else if (refund.duplicate) {
      message = 'Diese Erstattung wurde bereits erfasst und nicht erneut gebucht.';
    }

    return res.status(refund.duplicate ? 200 : 201).json({
      success: true,
      message,
      refund,
      ...(refund.warning ? { warning: refund.warning } : {}),
    });
  } catch (error) {
    return respondWithError(res, error, 'Error processing refund', 'Die Erstattung konnte nicht erfasst werden.');
  }
});

// Abgleich eines ungeklaerten PayPal-Erstattungsversuchs (admin only), nachdem der
// Stand im PayPal-Konto geprueft wurde.
// Body: { resolution: 'executed' | 'not-executed', providerRefundId? }
router.post('/payments/:id/refunds/:refundId/reconcile', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const { resolution, providerRefundId } = req.body || {};
    const refund = await FinancialService.resolveUnresolvedRefund(req.params.id, req.params.refundId, {
      resolution,
      providerRefundId,
      actorName: req.user?.name || req.user?.email || '',
    });
    return res.status(200).json({
      success: true,
      message: refund.status === 'completed'
        ? 'Die Erstattung wurde als ausgeführt verbucht.'
        : 'Der Erstattungsversuch wurde als nicht ausgeführt abgeschlossen; der Betrag ist wieder erstattbar.',
      refund,
    });
  } catch (error) {
    return respondWithError(res, error, 'Error reconciling refund', 'Der Abgleich der Erstattung ist fehlgeschlagen.');
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
      // 'offen' | 'ueberfaellig' = offene Forderungen (gleiche Regel wie der Dashboard-Zaehler)
      receivable: req.query.receivable,
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
      message: 'Rechnung wurde erstellt.',
      invoice
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    return res.status(Number(error?.statusCode) || 400).json({
      success: false,
      error: germanCreateError(error, 'Die Rechnung konnte nicht erstellt werden.'),
      code: error?.code || undefined,
    });
  }
});

// Send invoice to customer (admin only)
router.post('/invoices/:id/send', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('POST /api/admin/financial/invoices/:id/send - Sending invoice:', req.params.id);

  try {
    const { email, message } = req.body;
    const result = await FinancialService.sendInvoice(req.params.id, email, message, {
      actorId: req.user?._id,
      actorName: req.user?.name || req.user?.email || '',
    });

    return res.status(200).json(result);
  } catch (error) {
    return respondWithError(res, error, 'Error sending invoice', 'Die Rechnung konnte nicht versendet werden.');
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
    return respondWithError(res, error, 'Error getting financial reports', 'Der Finanzbericht konnte nicht geladen werden.');
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
    // repairOrderIds: Auftragsnummern (ORD-...) ODER interne IDs. options.dryRun = true
    // liefert nur die Vorschau (Umfang, Betraege, bereits berechnete Auftraege) und
    // speichert nichts (FIN-10).
    const { repairOrderIds, options } = req.body || {};

    if (!repairOrderIds || !Array.isArray(repairOrderIds) || repairOrderIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Bitte mindestens einen Auftrag auswählen.', code: 'ORDER_IDS_REQUIRED' });
    }

    // enforceCompletion setzt ausschliesslich der Server: nicht abgeschlossene Auftraege
    // werden nur mit ausdruecklicher Bestaetigung (confirmIncompleteOrders) berechnet.
    const safeOptions = { ...(options && typeof options === 'object' ? options : {}), enforceCompletion: true };
    if (safeOptions.dryRun === true) {
      const preview = await FinancialService.previewInvoiceFromRepairOrders(repairOrderIds, safeOptions);
      return res.status(200).json({ success: true, preview });
    }

    const invoice = await FinancialService.generateFromRepairOrders(repairOrderIds, safeOptions);
    return res.status(201).json({ success: true, message: 'Rechnung wurde erstellt.', invoice });
  } catch (error) {
    // 409 (Auftrag bereits berechnet) samt bestehender Rechnung durchreichen.
    const statusCode = Number(error?.statusCode);
    if (Number.isFinite(statusCode) && statusCode >= 400 && statusCode < 600) {
      console.warn('Error generating invoice from repair orders:', error.message);
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
        existingInvoice: error.existingInvoice,
        incompleteOrders: error.incompleteOrders,
      });
    }
    console.error('Error generating invoice from repair orders:', error);
    return res.status(500).json({
      success: false,
      error: germanCreateError(error, 'Die Rechnung konnte nicht erstellt werden.'),
      code: 'INTERNAL_ERROR',
    });
  }
});

// Change invoice status (admin only)
router.patch('/invoices/:id/status', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('PATCH /api/admin/financial/invoices/:id/status - Changing invoice status:', req.params.id);

  try {
    const { status, notes, paymentMethod, paidAt, confirmPaidCancellation } = req.body;
    if (!status) return res.status(400).json({ success: false, error: 'Es wurde kein neuer Status angegeben.' });

    const invoice = await FinancialService.changeInvoiceStatus(req.params.id, status, {
      notes,
      paymentMethod,
      paidAt,
      // "Bezahlt" erfasst den fehlenden Betrag als echte Zahlung - mit Bearbeiter.
      recordedBy: req.user?._id,
      actorName: req.user?.name || req.user?.email || '',
      // "Storniert" laeuft ueber das Storno (Gutschrift); bei gebuchtem Geld nur bestaetigt.
      confirmPaidCancellation: confirmPaidCancellation === true,
    });
    return res.status(200).json({ success: true, message: 'Der Belegstatus wurde geändert.', invoice });
  } catch (error) {
    return respondWithError(res, error, 'Error changing invoice status', 'Der Belegstatus konnte nicht geändert werden.');
  }
});

// Rechnungsstorno (admin only): ausgestellter Beleg -> Storno-Gutschrift, Original bleibt.
// Body: { reason (Pflicht), confirmPaidCancellation?: boolean, sendEmail?: boolean, message?: string }
// Response 200: { success, alreadyCancelled, invoice, creditNote, allocatedAtCancellation, balance, emailSent?, warning? }
router.post('/invoices/:id/cancel', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const { reason, confirmPaidCancellation, sendEmail, message } = req.body || {};
    const result = await FinancialService.cancelInvoice(req.params.id, {
      reason,
      confirmPaidCancellation: confirmPaidCancellation === true,
      sendEmail: sendEmail === true,
      message,
      actorId: req.user?._id,
      actorName: req.user?.name || req.user?.email || '',
    });
    return res.status(200).json({
      success: true,
      message: result.alreadyCancelled
        ? 'Diese Rechnung war bereits storniert.'
        : `Die Rechnung wurde storniert. Storno-Gutschrift ${result.creditNote?.invoiceNumber || ''} wurde ausgestellt.`,
      ...result,
    });
  } catch (error) {
    return respondWithError(res, error, 'Error cancelling invoice', 'Die Rechnung konnte nicht storniert werden.');
  }
});

// Entwurf verwerfen (admin only) - getrennt vom Storno; nur fuer nicht ausgestellte Belege.
router.post('/invoices/:id/discard', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const result = await FinancialService.discardDraftInvoice(req.params.id, {
      reason: req.body?.reason,
      actorId: req.user?._id,
      actorName: req.user?.name || req.user?.email || '',
    });
    return res.status(200).json({ success: true, message: 'Der Entwurf wurde verworfen.', ...result });
  } catch (error) {
    return respondWithError(res, error, 'Error discarding draft invoice', 'Der Entwurf konnte nicht verworfen werden.');
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

// Mahnliste (admin only) — must be declared before /:id to avoid shadowing.
// Nur ueberfaellige Belege mit echter offener Forderung. Jeder Eintrag traegt zusaetzlich
// `dunning` { originalDueDate, daysOverdue, openAmount, currentStage, currentStageLabel,
// nextStage, nextStageLabel, nextEligibleDate, eligible, reason, lastFailure } sowie
// `balance`/`paymentState` (additiv; die Belegfelder bleiben unveraendert).
router.get('/invoices/overdue', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const invoices = await FinancialService.getOverdueInvoices();
    return res.status(200).json({ success: true, invoices });
  } catch (error) {
    return respondWithError(res, error, 'Error getting overdue invoices', 'Die Mahnliste konnte nicht geladen werden.');
  }
});

// Get invoice details with linked payments & credit notes (admin only)
router.get('/invoices/:id', requireUser, requireRole(['admin']), async (req, res) => {
  console.log('GET /api/admin/financial/invoices/:id - Getting invoice details:', req.params.id);
  try {
    const result = await FinancialService.getInvoiceDetails(req.params.id);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    if (error?.name === 'CastError') {
      return res.status(404).json({ success: false, error: 'Rechnung wurde nicht gefunden.', code: 'INVOICE_NOT_FOUND' });
    }
    return respondWithError(res, error, 'Error getting invoice details', 'Die Rechnungsdetails konnten nicht geladen werden.');
  }
});

// Vom Bearbeiter gestarteter Mahnlauf (admin only). Dieselbe Logik wie der Cron
// (FinancialService.runDunningJob -> processDunningStep): nur faellige Belege, je eine Stufe.
router.post('/dunning/run', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const result = await FinancialService.runDunningJob({
      source: 'manual',
      actorId: req.user?._id,
      actorName: req.user?.name || req.user?.email || '',
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return respondWithError(res, error, 'Error running dunning job', 'Der Mahnlauf konnte nicht ausgeführt werden.');
  }
});

// Einzelner Mahnschritt aus der Mahnliste / dem Versanddialog (admin only).
// Body: { customMessage?: string }. 200 { success, result } bei Versand, 502 bei
// E-Mail-Fehler (Stufe unveraendert), 409 wenn der Beleg (noch) nicht mahnbar ist.
router.post('/dunning/invoices/:id/step', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const result = await FinancialService.processDunningStep(req.params.id, {
      source: 'manual',
      customMessage: req.body?.customMessage,
      recipientEmail: req.body?.recipientEmail,
      actorId: req.user?._id,
      actorName: req.user?.name || req.user?.email || '',
    });
    if (result.outcome === 'sent') return res.status(200).json({ success: true, message: result.message, result });
    if (result.outcome === 'failed') return res.status(502).json({ success: false, error: result.message, code: 'DUNNING_EMAIL_FAILED', result });
    return res.status(409).json({ success: false, error: result.message, code: 'DUNNING_NOT_ELIGIBLE', result });
  } catch (error) {
    return respondWithError(res, error, 'Error running dunning step', 'Der Mahnschritt konnte nicht ausgeführt werden.');
  }
});

// Transfer an overdue invoice to collection manually; collection is never auto-escalated.
router.post('/dunning/invoices/:id/collection', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const invoice = await FinancialService.activateCollection(req.params.id, req.user?._id, {
      actorName: req.user?.name || req.user?.email || '',
      customMessage: req.body?.customMessage,
    });
    return res.status(200).json({ success: true, invoice });
  } catch (error) {
    return respondWithError(res, error, 'Error activating collection', 'Die Übergabe an das Inkasso ist fehlgeschlagen.');
  }
});

// Gespeicherten Mahnlauf ausfuehren (admin only) - jeder Fall ueber processDunningStep.
router.post('/dunning/runs/:id/execute', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const result = await FinancialService.executeDunningRun(req.params.id, {
      actorId: req.user?._id,
      actorName: req.user?.name || req.user?.email || '',
      customMessage: req.body?.customMessage,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return respondWithError(res, error, 'Error executing dunning run', 'Der Mahnlauf konnte nicht ausgeführt werden.');
  }
});

// Create persistent dunning run (admin only)
router.post('/dunning/runs', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const run = await FinancialService.createDunningRun(req.body, req.user?._id);
    return res.status(201).json({ success: true, run });
  } catch (error) {
    return respondWithError(res, error, 'Error creating dunning run', 'Der Mahnlauf konnte nicht angelegt werden.');
  }
});

// Get dunning runs (admin only)
router.get('/dunning/runs', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const runs = await FinancialService.getDunningRuns({ status: req.query.status });
    return res.status(200).json({ success: true, runs });
  } catch (error) {
    return respondWithError(res, error, 'Error getting dunning runs', 'Die Mahnläufe konnten nicht geladen werden.');
  }
});

// Get dunning run details (admin only)
router.get('/dunning/runs/:id', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const run = await FinancialService.getDunningRunById(req.params.id);
    return res.status(200).json({ success: true, run });
  } catch (error) {
    return respondWithError(res, error, 'Error getting dunning run', 'Der Mahnlauf konnte nicht geladen werden.');
  }
});

// Update dunning run metadata/status (admin only)
router.patch('/dunning/runs/:id', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const run = await FinancialService.updateDunningRun(req.params.id, req.body, req.user?._id);
    return res.status(200).json({ success: true, run });
  } catch (error) {
    return respondWithError(res, error, 'Error updating dunning run', 'Der Mahnlauf konnte nicht geändert werden.');
  }
});

// Update dunning run item (admin only)
router.patch('/dunning/runs/:id/items/:invoiceId', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const run = await FinancialService.updateDunningRunItem(req.params.id, req.params.invoiceId, req.body, req.user?._id);
    return res.status(200).json({ success: true, run });
  } catch (error) {
    return respondWithError(res, error, 'Error updating dunning run item', 'Der Fall konnte nicht geändert werden.');
  }
});

// Add item to dunning run (admin only)
router.post('/dunning/runs/:id/items', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const { invoiceId } = req.body;
    if (!invoiceId) return res.status(400).json({ success: false, error: 'Bitte eine Rechnung auswählen.' });

    const run = await FinancialService.addDunningRunItem(req.params.id, invoiceId, req.user?._id);
    return res.status(200).json({ success: true, run });
  } catch (error) {
    return respondWithError(res, error, 'Error adding dunning run item', 'Der Fall konnte nicht hinzugefügt werden.');
  }
});

// Reconcile overpayment for a booking (admin only)
router.post('/bookings/:bookingId/overpayment/reconcile', requireUser, requireRole(['admin']), async (req, res) => {
  try {
    const { amount, reason, processRefund, refundMode } = req.body || {};
    const result = await FinancialService.handleOverpayment(req.params.bookingId, {
      amount,
      reason,
      processRefund: processRefund === true || processRefund === 'true',
      refundMode,
      recordedBy: req.user?._id,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return respondWithError(res, error, 'Error reconciling overpayment', 'Die Überzahlung konnte nicht bearbeitet werden.');
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
    // 409 PAYMENT_REQUEST_RECENT: letzte Aufforderung mitliefern, damit die Oberflaeche
    // "Zuletzt am … an … gesendet – trotzdem erneut senden?" fragen kann.
    if (error?.code === 'PAYMENT_REQUEST_RECENT') {
      return res.status(409).json({ success: false, error: error.message, code: error.code, recentRequest: error.recentRequest });
    }
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
    const syncResult = await FinancialService.syncOrderAndBookingValue(req.params.bookingId, req.body?.type || 'booking');
    if (syncResult && syncResult.ok === false) {
      console.error('Financial sync failed:', syncResult.error);
      return res.status(500).json({
        success: false,
        error: 'Der Abgleich von Buchung, Auftrag und Rechnung ist fehlgeschlagen. Bitte später erneut versuchen oder den technischen Support informieren.',
        code: 'FINANCIAL_SYNC_FAILED',
      });
    }
    const BookingPaymentService = require('../services/bookingPaymentService');
    const overview = await BookingPaymentService.getOverview(req.params.bookingId);
    return res.status(200).json({ success: true, overview });
  } catch (error) {
    return respondWithError(res, error, 'Error syncing order/booking value', 'Der Finanzabgleich konnte nicht ausgeführt werden.');
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
      message: 'Rechnung wurde erstellt.',
      invoice
    });
  } catch (error) {
    console.error('Error creating invoice from order:', error);
    const existingInvoiceId = error?.existingInvoice?._id || null;
    return res.status(error.statusCode || 400).json({
      success: false,
      error: germanCreateError(error, 'Die Rechnung zum Auftrag konnte nicht erstellt werden.'),
      code: error.code,
      existingInvoice: error.existingInvoice,
      redirectTo: existingInvoiceId ? `/admin/financial?tab=overview&highlightInvoiceId=${existingInvoiceId}` : null,
    });
  }
});

module.exports = router;