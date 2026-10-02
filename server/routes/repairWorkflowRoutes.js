const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const RepairWorkflowService = require('../services/repairWorkflowService');
const { requireUser, requireRole } = require('./middleware/auth');

// Der Reparatur-Workflow enthaelt interne Notizen, Zwischenfaelle und Technikernamen
// und steuert die Zeiterfassung. Lesen und Aendern ist deshalb Admin/Staff vorbehalten;
// Kunden sehen den Reparaturfortschritt ueber den Auftragsstatus.
const requireAdminOrStaff = [requireUser, requireRole(['admin', 'staff'])];

// Deutsche Meldung + passender Status. `error` wird zusaetzlich gesetzt, weil der
// Client-Helfer (api/repairWorkflow.ts) Fehlermeldungen aus data.error liest.
const sendError = (res, error, fallbackMessage) => {
  const statusCode = Number(error?.statusCode) || 500;
  const message = error?.name === 'RepairWorkflowError' && error.message
    ? error.message
    : fallbackMessage;
  return res.status(statusCode).json({
    success: false,
    message,
    error: message,
    ...(error?.code ? { code: error.code } : {}),
  });
};

const validateOrderId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(String(req.params.orderId || ''))) {
    return res.status(400).json({ success: false, message: 'Ungültige Auftrags-ID.', error: 'Ungültige Auftrags-ID.' });
  }
  return next();
};

const technicianOf = (req) => ({
  technicianId: req.user._id,
  technicianName: req.user.name || [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email,
});

const NOTIFICATION_MESSAGES = {
  sent: 'Kunde wurde benachrichtigt (Benachrichtigung und E-Mail).',
  sentGuest: 'Kunde wurde per E-Mail benachrichtigt (Gastauftrag ohne Kundenkonto).',
  duplicate: 'Der Kunde wurde hierzu bereits benachrichtigt – keine zweite Nachricht gesendet.',
  failed: 'Gespeichert, aber der Kunde konnte nicht benachrichtigt werden.',
  // Altwerte (vor dem Gast-E-Mail-Weg gespeichert) bleiben lesbar.
  no_customer_account: 'Gespeichert. Der Auftrag hat kein Kundenkonto (Gastauftrag) – bitte den Kunden auf anderem Weg informieren.',
  no_contact: 'Gespeichert. Für diesen Gastauftrag ist keine E-Mail-Adresse hinterlegt – bitte den Kunden auf anderem Weg informieren.',
  order_cancelled: 'Gespeichert. Der Auftrag ist storniert – es wurde keine Nachricht an den Kunden gesendet.',
  preferences: 'Gespeichert. Der Kunde hat Benachrichtigungen abgeschaltet – es wurde nichts gesendet.',
};

const sentMessageOf = (notification) => (notification?.inApp === false && notification?.email === 'sent'
  ? NOTIFICATION_MESSAGES.sentGuest
  : NOTIFICATION_MESSAGES.sent);

/**
 * Einheitliche Erfolgsantwort der Zustandswechsel:
 * { success, workflow, message, orderStatus, orderStatusChanged, warnings[],
 *   customerNotification: { status: 'sent'|'failed'|'skipped'|'duplicate', reason?, error?, inApp?, email?, message? } }
 * Speichererfolg (success/message) und Benachrichtigungsergebnis werden GETRENNT gemeldet.
 */
const sendTransitionResult = (res, workflow, successMessage) => {
  const orderSync = workflow?.$locals?.orderSync || { warnings: [] };
  const customerNotification = workflow?.$locals?.customerNotification || { status: 'skipped', reason: 'not_requested' };
  const warnings = [...(orderSync.warnings || [])];
  if (customerNotification.status === 'failed') {
    warnings.push(`${NOTIFICATION_MESSAGES.failed}${customerNotification.error ? ` (${customerNotification.error})` : ''}`);
  } else if (customerNotification.status === 'skipped' && NOTIFICATION_MESSAGES[customerNotification.reason]) {
    warnings.push(NOTIFICATION_MESSAGES[customerNotification.reason]);
  }
  return res.json({
    success: true,
    workflow,
    message: successMessage,
    orderStatus: orderSync.orderStatus || null,
    orderStatusChanged: Boolean(orderSync.statusChanged),
    warnings,
    customerNotification,
  });
};

router.get('/admin/inactive', requireAdminOrStaff, async (req, res) => {
  try {
    const { thresholdHours = 3 } = req.query;
    const thresholdMs = thresholdHours * 60 * 60 * 1000;
    const workflows = await RepairWorkflowService.getInactiveWorkflows(thresholdMs);

    res.json({
      success: true,
      workflows,
    });
  } catch (error) {
    console.error('Error getting inactive workflows:', error);
    return sendError(res, error, 'Inaktive Reparatur-Workflows konnten nicht geladen werden.');
  }
});

// "Warten auf Kundenrückmeldung" fuer die Auftragslisten (Admin und Staff).
// Query: orderIds=<id>,<id>,... (optional; ohne Angabe alle wartenden Auftraege).
// Antwort: { success, orders: [{ orderId, orderNumber, since, overdue, reasons: [{ type, label, detail, since, overdue, sourceId }] }], count }
router.get('/admin/awaiting-customer-feedback', requireAdminOrStaff, async (req, res) => {
  try {
    const rawIds = typeof req.query.orderIds === 'string' ? req.query.orderIds : '';
    const orderIds = rawIds
      ? rawIds.split(',').map((id) => id.trim()).filter(Boolean).slice(0, 500)
      : null;
    const orders = await RepairWorkflowService.getAwaitingCustomerFeedback(orderIds);

    res.json({
      success: true,
      orders,
      count: orders.length,
    });
  } catch (error) {
    console.error('Error getting orders awaiting customer feedback:', error);
    return sendError(res, error, 'Aufträge mit offener Kundenrückmeldung konnten nicht geladen werden.');
  }
});

router.post('/:orderId/init', requireAdminOrStaff, validateOrderId, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { customerId, inspectionId } = req.body;
    const technicianId = req.user._id;

    const workflow = await RepairWorkflowService.initializeRepairWorkflow(
      orderId,
      customerId,
      technicianId,
      inspectionId,
    );

    res.json({
      success: true,
      workflow,
    });
  } catch (error) {
    console.error('Error initializing repair workflow:', error);
    return sendError(res, error, 'Reparatur-Workflow konnte nicht angelegt werden.');
  }
});

router.post('/:orderId/approve', requireAdminOrStaff, validateOrderId, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { internalNotes, orderChanges, notifyCustomer, customerMessage } = req.body || {};
    const { technicianId, technicianName } = technicianOf(req);

    const workflow = await RepairWorkflowService.approveRepairStart(
      orderId,
      internalNotes,
      orderChanges,
      notifyCustomer === true,
      technicianId,
      technicianName,
      { customerMessage },
    );

    return sendTransitionResult(res, workflow, 'Die Reparatur wurde gestartet.');
  } catch (error) {
    console.error('Error approving repair start:', error);
    return sendError(res, error, 'Reparatur konnte nicht freigegeben werden.');
  }
});

// Reines Lesen: aendert nie den Arbeitszustand (kein Pausieren/Fortsetzen beim Oeffnen).
router.get('/:orderId', requireAdminOrStaff, validateOrderId, async (req, res) => {
  try {
    const { orderId } = req.params;
    const workflow = await RepairWorkflowService.getActiveWorkflow(orderId);

    res.json({
      success: true,
      workflow: workflow || null,
    });
  } catch (error) {
    console.error('Error getting active workflow:', error);
    return sendError(res, error, 'Reparatur-Workflow konnte nicht geladen werden.');
  }
});

router.post('/:orderId/pause', requireAdminOrStaff, validateOrderId, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { pauseReason } = req.body;
    const { technicianId, technicianName } = technicianOf(req);

    const workflow = await RepairWorkflowService.pauseRepair(orderId, pauseReason, technicianId, technicianName);

    return sendTransitionResult(res, workflow, 'Die Reparatur wurde pausiert.');
  } catch (error) {
    console.error('Error pausing repair:', error);
    return sendError(res, error, 'Reparatur-Workflow konnte nicht pausiert werden.');
  }
});

router.post('/:orderId/resume', requireAdminOrStaff, validateOrderId, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { technicianId, technicianName } = technicianOf(req);

    const workflow = await RepairWorkflowService.resumeRepair(orderId, technicianId, technicianName);

    return sendTransitionResult(res, workflow, 'Die Reparatur wurde fortgesetzt.');
  } catch (error) {
    console.error('Error resuming repair:', error);
    return sendError(res, error, 'Reparatur-Workflow konnte nicht fortgesetzt werden.');
  }
});

router.post('/:orderId/complete', requireAdminOrStaff, validateOrderId, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { technicianId, technicianName } = technicianOf(req);

    const { notifyCustomer, customerMessage } = req.body || {};

    const workflow = await RepairWorkflowService.completeRepair(orderId, technicianId, technicianName, {
      notifyCustomer: notifyCustomer === true,
      customerMessage,
    });

    return sendTransitionResult(res, workflow, 'Die Reparatur wurde abgeschlossen.');
  } catch (error) {
    console.error('Error completing repair:', error);
    return sendError(res, error, 'Reparatur-Workflow konnte nicht abgeschlossen werden.');
  }
});

router.post('/:orderId/incidents', requireAdminOrStaff, validateOrderId, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { incidentType, reason, additionalData, notifyCustomer, customerMessage } = req.body || {};
    const { technicianId, technicianName } = technicianOf(req);

    if (!String(reason || '').trim()) {
      return res.status(400).json({ success: false, message: 'Bitte eine Kurzbeschreibung des Zwischenfalls angeben.', error: 'Bitte eine Kurzbeschreibung des Zwischenfalls angeben.' });
    }

    const workflow = await RepairWorkflowService.reportIncident(
      orderId,
      incidentType,
      String(reason).trim(),
      additionalData,
      technicianId,
      technicianName,
      { notifyCustomer: notifyCustomer === true, customerMessage },
    );

    return sendTransitionResult(res, workflow, 'Der Zwischenfall wurde gemeldet.');
  } catch (error) {
    console.error('Error reporting incident:', error);
    return sendError(res, error, 'Zwischenfall konnte nicht gemeldet werden.');
  }
});

// Autorisierte Erledigung eines Zwischenfalls (beendet z. B. "Warten auf Kundenrückmeldung").
router.post('/:orderId/incidents/:incidentId/resolve', requireAdminOrStaff, validateOrderId, async (req, res) => {
  try {
    const { orderId, incidentId } = req.params;
    const { note } = req.body || {};
    const { technicianId, technicianName } = technicianOf(req);

    const workflow = await RepairWorkflowService.resolveIncident(orderId, incidentId, note, technicianId, technicianName);

    return sendTransitionResult(res, workflow, 'Zwischenfall wurde als erledigt markiert.');
  } catch (error) {
    console.error('Error resolving incident:', error);
    return sendError(res, error, 'Zwischenfall konnte nicht als erledigt markiert werden.');
  }
});

// Abgeschlossene Reparatur wieder aufnehmen (HIST-11).
// Request: { reason: string (Pflicht) }
// Response: wie die anderen Zustandswechsel; 409 wenn bereits ein Versandlabel an den Kunden
// existiert oder der Auftrag abgeschlossen/storniert ist, 400 ohne Grund.
router.post('/:orderId/reopen', requireAdminOrStaff, validateOrderId, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body || {};
    const { technicianId, technicianName } = technicianOf(req);
    const workflow = await RepairWorkflowService.reopenRepair(orderId, reason, technicianId, technicianName);
    return sendTransitionResult(res, workflow, 'Die Reparatur wurde wieder aufgenommen.');
  } catch (error) {
    console.error('Error reopening repair:', error);
    return sendError(res, error, 'Die Reparatur konnte nicht wieder aufgenommen werden.');
  }
});

// Auftragsstatus/-verlauf erneut abgleichen (nach der Warnung "Auftragsstatus konnte nicht
// aktualisiert werden"). Idempotent.
router.post('/:orderId/sync-order', requireAdminOrStaff, validateOrderId, async (req, res) => {
  try {
    const { workflow, orderSync } = await RepairWorkflowService.syncOrderForCurrentState(req.params.orderId, req.user);
    workflow.$locals.orderSync = orderSync;
    workflow.$locals.customerNotification = { status: 'skipped', reason: 'not_requested' };
    return sendTransitionResult(res, workflow, orderSync.warnings.length
      ? 'Der Auftragsstatus konnte weiterhin nicht aktualisiert werden.'
      : 'Auftragsstatus und Verlauf sind aktuell.');
  } catch (error) {
    console.error('Error syncing order from repair workflow:', error);
    return sendError(res, error, 'Der Auftragsstatus konnte nicht abgeglichen werden.');
  }
});

// Kundenbenachrichtigung erneut senden (ohne den Zustand erneut zu speichern).
// Request: { target: 'approval' | 'completion' | 'incident', incidentId?: string, customerMessage?: string }
// Response: { success, workflow, customerNotification, message }
router.post('/:orderId/notify-customer', requireAdminOrStaff, validateOrderId, async (req, res) => {
  try {
    const { target, incidentId, customerMessage } = req.body || {};
    const { workflow, customerNotification } = await RepairWorkflowService.retryCustomerNotification(req.params.orderId, {
      target, incidentId, customerMessage,
    });
    const message = customerNotification.status === 'sent'
      ? sentMessageOf(customerNotification)
      : (customerNotification.status === 'duplicate'
        ? NOTIFICATION_MESSAGES.duplicate
        : (NOTIFICATION_MESSAGES[customerNotification.reason] || `${NOTIFICATION_MESSAGES.failed}${customerNotification.error ? ` (${customerNotification.error})` : ''}`));
    return res.json({ success: customerNotification.status === 'sent' || customerNotification.status === 'duplicate', workflow, customerNotification, message });
  } catch (error) {
    console.error('Error retrying customer notification:', error);
    return sendError(res, error, 'Die Benachrichtigung konnte nicht gesendet werden.');
  }
});

module.exports = router;
