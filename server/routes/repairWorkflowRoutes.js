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
  technicianName: req.user.name || req.user.email,
});

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
    const { internalNotes, orderChanges, notifyCustomer } = req.body;
    const { technicianId, technicianName } = technicianOf(req);

    const workflow = await RepairWorkflowService.approveRepairStart(
      orderId,
      internalNotes,
      orderChanges,
      notifyCustomer,
      technicianId,
      technicianName,
    );

    res.json({
      success: true,
      workflow,
    });
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

    res.json({
      success: true,
      workflow,
    });
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

    res.json({
      success: true,
      workflow,
    });
  } catch (error) {
    console.error('Error resuming repair:', error);
    return sendError(res, error, 'Reparatur-Workflow konnte nicht fortgesetzt werden.');
  }
});

router.post('/:orderId/complete', requireAdminOrStaff, validateOrderId, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { technicianId, technicianName } = technicianOf(req);

    const workflow = await RepairWorkflowService.completeRepair(orderId, technicianId, technicianName);

    res.json({
      success: true,
      workflow,
    });
  } catch (error) {
    console.error('Error completing repair:', error);
    return sendError(res, error, 'Reparatur-Workflow konnte nicht abgeschlossen werden.');
  }
});

router.post('/:orderId/incidents', requireAdminOrStaff, validateOrderId, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { incidentType, reason, additionalData } = req.body;
    const { technicianId, technicianName } = technicianOf(req);

    const workflow = await RepairWorkflowService.reportIncident(
      orderId,
      incidentType,
      reason,
      additionalData,
      technicianId,
      technicianName,
    );

    res.json({
      success: true,
      workflow,
    });
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

    res.json({
      success: true,
      workflow,
      message: 'Zwischenfall wurde als erledigt markiert.',
    });
  } catch (error) {
    console.error('Error resolving incident:', error);
    return sendError(res, error, 'Zwischenfall konnte nicht als erledigt markiert werden.');
  }
});

module.exports = router;
