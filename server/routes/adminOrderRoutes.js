const express = require('express');
const OrderService = require('../services/orderService');
const DeviceChangeService = require('../services/deviceChangeService');
const NotificationService = require('../services/notificationService');
const InspectionCommunicationService = require('../services/inspectionCommunicationService');
const Order = require('../models/Order');
const OrderHistory = require('../utils/orderHistory');
const { requireUser } = require('./middleware/auth');

const router = express.Router();

// Middleware to check if user is admin or staff
const requireAdminOrStaff = (req, res, next) => {
  if (!req.user || !['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Zugriff verweigert. Nur für Admin und Personal.' });
  }
  next();
};

// Fehler von Auftragsaenderungen an die Oberflaeche: Status und deutsche Meldung aus
// dem Service (statusCode/code/details, z. B. 409 ORDER_VALUE_NOT_RECONCILED oder
// ORDER_EDIT_CONFLICT). Unerwartete Fehler werden nicht roh (englisch) durchgereicht.
const respondOrderEditError = (res, error, fallbackMessage, fallbackStatus = 500) => {
  const statusCode = Number(error?.statusCode)
    || (error?.name === 'ValidationError' || error?.name === 'CastError' ? 400 : fallbackStatus);
  const message = error?.statusCode ? error.message : fallbackMessage;
  return res.status(statusCode).json({
    error: message,
    code: error?.code || undefined,
    details: error?.details || undefined,
  });
};

const isConfirmFlag = (value) => value === true || value === 'true';

// Bestaetigung einer Neuberechnung (siehe OrderService.getPricingConditionsForEdit):
// confirmRepricing plus die GEZEIGTE Abweichung repricingBasis = { storedTotal, expectedTotal }
// (details der 409). Hat sich der Auftrag seitdem geaendert, antwortet der Service mit einer
// frischen 409 (details.confirmationOutdated). Bei DELETE auch als Query
// (?confirmRepricing=true&repricingStoredTotal=..&repricingExpectedTotal=..).
const readRepricingConfirmation = (body, query = {}, { allowQuery = false } = {}) => {
  const fromQuery = allowQuery && query.repricingStoredTotal !== undefined
    ? { storedTotal: query.repricingStoredTotal, expectedTotal: query.repricingExpectedTotal }
    : undefined;
  const repricingBasis = body && body.repricingBasis !== undefined && body.repricingBasis !== null
    ? body.repricingBasis
    : fromQuery;
  return {
    confirmRepricing: isConfirmFlag(body?.confirmRepricing) || (allowQuery && isConfirmFlag(query.confirmRepricing)),
    ...(repricingBasis !== undefined ? { repricingBasis } : {}),
  };
};

// Get all orders (admin/staff)
router.get('/', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Admin get all orders request received from user:', req.user.email);

  try {
    const filters = {
      search: req.query.search,
      status: req.query.status,
      priority: req.query.priority,
      deviceType: req.query.deviceType,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      assignedStaff: req.query.assignedStaff,
      // Kommagetrennte Auftrags-IDs (Filter "Warten auf Kundenrückmeldung" der Admin-Liste).
      ...(req.query.ids !== undefined ? { ids: String(req.query.ids) } : {}),
      page: req.query.page,
      limit: req.query.limit
    };

    const result = await OrderService.getAll(filters);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting admin orders:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to get orders' 
    });
  }
});

// Get assigned orders for current staff member
router.get('/assigned', requireUser, async (req, res) => {
  console.log('Get assigned orders request received for user:', req.user.email);

  try {
    if (!req.user._id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const filters = {
      search: req.query.search,
      status: req.query.status,
      priority: req.query.priority,
      assignedStaff: req.user._id.toString(),
      includeComplaintFollowups: true,
      page: req.query.page || 1,
      limit: req.query.limit || 50
    };

    const result = await OrderService.getAll(filters);

    console.log('Assigned orders retrieved:', result.orders?.length || 0, 'orders');
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting assigned orders:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get assigned orders'
    });
  }
});

// Get single order by ID (admin/staff)
router.get('/:id', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Admin get order by ID request received:', req.params.id);

  try {
    // Personal-Ansicht (vollstaendiger Konditionen-Snapshot). Das Label-PDF (Base64)
    // gehoert nicht in die Detailantwort - hasShippingLabel/hasReturnLabel zeigen, ob
    // eines existiert; der Download laeuft ueber die eigenen Label-Endpunkte.
    const order = await OrderService.getById(req.params.id, { audience: 'staff' });
    if (order.shippingLabelUrl) {
      order.shippingLabelUrl = '';
    }

    return res.status(200).json({ order });
  } catch (error) {
    console.error('Error getting admin order by ID:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: 'Auftrag wurde nicht gefunden.' });
    }
    return res.status(500).json({
      error: 'Der Auftrag konnte nicht geladen werden.'
    });
  }
});

// Update order status (admin/staff)
// Request: { status: one of Order.ORDER_STATUSES, reason?: string (nur Verlauf, intern),
//            note?: string (Altname fuer reason - wird NICHT an Kunden gesendet),
//            customerMessage?: string (ausdruecklicher Hinweis an den Kunden) }
// Response: { success, message, order, unchanged?: true }  - gleicher Status: 200 ohne Eintrag
//           errors: 400 { error: 'Unbekannter Auftragsstatus.', code: 'INVALID_ORDER_STATUS' }, 404, 409
router.put('/:id/status', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Update order status request received:', req.params.id, req.body);

  try {
    const { status, note, reason, customerMessage, reopen } = req.body || {};
    // "Storno aufheben" ist eine Admin-Entscheidung (Personal sieht die Aktion nicht).
    if (reopen === true && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Nur Administratoren können eine Stornierung aufheben.', code: 'REOPEN_ADMIN_ONLY' });
    }

    if (!status) {
      return res.status(400).json({ error: 'Bitte einen Status angeben.' });
    }

    // Eine Liste: das Enum des Modells (HIST-7). Frueher erlaubte die Route Werte wie
    // 'diagnosed'/'on-hold', die das Modell ablehnte (500 mit englischer Mongoose-Meldung).
    if (!Order.ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Unbekannter Auftragsstatus.', code: 'INVALID_ORDER_STATUS' });
    }

    const order = await OrderService.updateStatus(req.params.id, status, null, req.user._id, {
      reason: typeof reason === 'string' && reason.trim() ? reason.trim() : (typeof note === 'string' ? note.trim() : ''),
      customerMessage: typeof customerMessage === 'string' ? customerMessage.trim() : '',
      source: reopen === true ? 'Storno aufheben' : 'Statusmenü',
      reopen: reopen === true,
    });
    const unchanged = Boolean(order?.$locals?.unchanged);

    return res.status(200).json({
      success: true,
      unchanged: unchanged || undefined,
      message: unchanged
        ? 'Der Auftrag hat bereits diesen Status – keine Änderung gespeichert.'
        : (status === 'cancelled'
          ? 'Der Auftrag wurde storniert. Rechnungen und Zahlungen wurden nicht verändert.'
          : 'Der Auftragsstatus wurde aktualisiert.'),
      // Storno (HIST-14): angehaltene Arbeit und Hinweise getrennt vom Speichererfolg.
      cancelEffects: order?.$locals?.cancelEffects || undefined,
      warnings: order?.$locals?.warnings?.length ? order.$locals.warnings : undefined,
      order
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    if (error && error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code || undefined });
    }
    return res.status(500).json({ 
      error: 'Der Auftragsstatus konnte nicht aktualisiert werden.'
    });
  }
});

// Confirm customer pickup (admin/staff) — sets status to completed and records who confirmed
// Idempotent (HIST-13): eine zweite Bestaetigung aendert nichts ({ alreadyConfirmed: true }).
// Verlaufseintrag 'Pickup Confirmed' im selben Schreibvorgang.
router.post('/:id/confirm-pickup', requireUser, requireAdminOrStaff, async (req, res) => {
  try {
    const { order, alreadyConfirmed } = await OrderService.confirmPickup(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      alreadyConfirmed: alreadyConfirmed || undefined,
      message: alreadyConfirmed ? 'Die Abholung wurde bereits bestätigt.' : 'Die Abholung wurde bestätigt.',
      order,
    });
  } catch (error) {
    console.error('Error confirming pickup:', error);
    if (error && error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code || undefined });
    }
    return res.status(500).json({ error: 'Die Abholung konnte nicht bestätigt werden.' });
  }
});

// Assign staff to order (admin/staff)
router.put('/:id/assign', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Assign staff to order request received:', req.params.id, req.body);

  try {
    const { staffIds } = req.body;

    if (!staffIds || !Array.isArray(staffIds) || staffIds.length === 0) {
      return res.status(400).json({ error: 'Staff IDs are required' });
    }

    const order = await OrderService.assignStaff(req.params.id, staffIds, req.user);
    const unchanged = Boolean(order?.$locals?.unchanged);

    // Notify each assigned staff member asynchronously - nicht bei unveraenderter Zuweisung
    // (Wiederholung/Doppelklick erzeugt keine zweite Benachrichtigung, HIST-6).
    if (!unchanged) setImmediate(async () => {
      try {
        for (const staffId of staffIds) {
          await NotificationService.createAssignmentNotification(
            staffId,
            order._id,
            order.orderNumber
          );
        }
      } catch (notifError) {
        console.error('Error creating assignment notification:', notifError.message);
      }
    });

    return res.status(200).json({
      success: true,
      unchanged: unchanged || undefined,
      message: 'Staff assigned successfully'
    });
  } catch (error) {
    console.error('Error assigning staff to order:', error);
    if (error && error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code || undefined });
    }
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ 
      error: error.message || 'Failed to assign staff' 
    });
  }
});

// Add staff note to order (admin/staff)
router.post('/:id/notes', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Add note to order request received:', req.params.id, req.body);

  try {
    const { note, type } = req.body;

    if (!note) {
      return res.status(400).json({ error: 'Note is required' });
    }

    const validTypes = ['general', 'technical', 'customer', 'internal'];
    const noteType = type && validTypes.includes(type) ? type : 'general';

    const newNote = await OrderService.addNote(req.params.id, note, noteType, req.user._id);

    return res.status(201).json({
      success: true,
      message: 'Note added successfully',
      note: newNote
    });
  } catch (error) {
    console.error('Error adding note to order:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to add note'
    });
  }
});

// Assign EPart to order (admin/staff)
router.post('/:id/eparts', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Assign EPart to order request received:', req.params.id, req.body);

  try {
    const { partId, versionId, quantity } = req.body;

    if (!partId || !versionId || !quantity) {
      return res.status(400).json({ error: 'Part ID, version ID, and quantity are required' });
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    const order = await OrderService.assignEPart(
      req.params.id,
      partId,
      versionId,
      quantity,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'EPart assigned successfully',
      order
    });
  } catch (error) {
    console.error('Error assigning EPart to order:', error);
    if (error.message === 'Order not found' || error.message === 'Part not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to assign EPart'
    });
  }
});

// Record missing EPart added to need list (admin/staff)
router.post('/:id/eparts/need-list', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Record EPart need list entry request received:', req.params.id, req.body);

  try {
    const { partId, quantity, needListId, needListName, needListStatus, targetType, notes } = req.body;

    if (!partId || !quantity) {
      return res.status(400).json({ error: 'Part ID and quantity are required' });
    }

    if (!needListId && !needListName) {
      return res.status(400).json({ error: 'Need list ID or need list name is required' });
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    const order = await OrderService.recordEPartNeedListEntry(
      req.params.id,
      {
        partId,
        quantity,
        needListId,
        needListName,
        needListStatus,
        targetType,
        notes,
      },
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'EPart need list entry recorded successfully',
      order
    });
  } catch (error) {
    console.error('Error recording EPart need list entry:', error);
    if (
      error.message === 'Order not found' ||
      error.message === 'Part not found' ||
      error.message === 'Need list not found'
    ) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to record EPart need list entry'
    });
  }
});

// Remove EPart from order (admin/staff)
router.delete('/:id/eparts/:ePartId', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Remove EPart from order request received:', req.params.id, req.params.ePartId);

  try {
    const order = await OrderService.removeEPart(
      req.params.id,
      req.params.ePartId,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'EPart removed successfully',
      order
    });
  } catch (error) {
    console.error('Error removing EPart from order:', error);
    if (error.message === 'Order not found' || error.message === 'EPart not found in order') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to remove EPart'
    });
  }
});

// Update EPart status (admin/staff)
router.put('/:id/eparts/:ePartId/status', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Update EPart status request received:', req.params.id, req.params.ePartId, req.body);

  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['pending', 'allocated', 'used'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await OrderService.updateEPartStatus(
      req.params.id,
      req.params.ePartId,
      status,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'EPart status updated successfully',
      order
    });
  } catch (error) {
    console.error('Error updating EPart status:', error);
    if (error.message === 'Order not found' || error.message === 'EPart not found in order') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to update EPart status'
    });
  }
});

// Description: Add add-on service to order
// Endpoint: POST /api/admin/orders/:id/addons
// Request: { name: string, description?: string, price: number (LIST gross), estimatedTime?: string, status?: string,
//            confirmRepricing?: boolean, repricingBasis?: { storedTotal: number, expectedTotal: number } }
//          confirmRepricing: explicit confirmation to re-price an order whose stored value does not match its
//          positions (otherwise 409 { code: 'ORDER_VALUE_NOT_RECONCILED', details }).
//          repricingBasis: the details.storedTotal / details.expectedTotal the user confirmed; if the order changed
//          since, 409 ORDER_VALUE_NOT_RECONCILED with the NEW details and details.confirmationOutdated = true.
// Response: { success: boolean, message: string, order: Order }
//           errors: { error: string (German), code?: string, details?: object } with 400/404/409
router.post('/:id/addons', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Add add-on to order request received:', req.params.id, req.body);

  try {
    const { name, description, price, estimatedTime, status } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Bitte geben Sie Name und Preis der Zusatzleistung an.' });
    }

    if (typeof price !== 'number' || price < 0) {
      return res.status(400).json({ error: 'Der Preis muss eine Zahl größer oder gleich 0 sein.' });
    }

    const order = await OrderService.addAddonToOrder(
      req.params.id,
      { name, description, price, estimatedTime, status, ...readRepricingConfirmation(req.body) },
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Die Zusatzleistung wurde hinzugefügt.',
      order,
      // Revision/Finanzabgleich laufen nach dem Speichern; Fehler sind sichtbar (HIST-5b).
      warnings: Array.isArray(order?.$locals?.warnings) ? order.$locals.warnings : [],
    });
  } catch (error) {
    console.error('Error adding add-on to order:', error);
    return respondOrderEditError(res, error, 'Die Zusatzleistung konnte nicht hinzugefügt werden.');
  }
});

// Description: Update add-on service in order
// Endpoint: PUT /api/admin/orders/:id/addons/:addonId
// Request: { name?: string, description?: string, price?: number, estimatedTime?: string, status?: string, progress?: number,
//            confirmRepricing?: boolean, repricingBasis? (see POST /:id/addons) }
// Response: { success: boolean, message: string, order: Order }
router.put('/:id/addons/:addonId', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Update add-on in order request received:', req.params.id, req.params.addonId, req.body);

  try {
    const { name, description, price, estimatedTime, status, progress } = req.body;

    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      return res.status(400).json({ error: 'Der Preis muss eine Zahl größer oder gleich 0 sein.' });
    }

    if (status && !['pending', 'in-progress', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Ungültiger Status der Zusatzleistung.' });
    }

    if (progress !== undefined && (typeof progress !== 'number' || progress < 0 || progress > 100)) {
      return res.status(400).json({ error: 'Der Fortschritt muss zwischen 0 und 100 liegen.' });
    }

    const order = await OrderService.updateOrderAddon(
      req.params.id,
      req.params.addonId,
      { name, description, price, estimatedTime, status, progress, ...readRepricingConfirmation(req.body) },
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Die Zusatzleistung wurde aktualisiert.',
      order,
      // Revision/Finanzabgleich laufen nach dem Speichern; Fehler sind sichtbar (HIST-5b).
      warnings: Array.isArray(order?.$locals?.warnings) ? order.$locals.warnings : [],
    });
  } catch (error) {
    console.error('Error updating add-on in order:', error);
    return respondOrderEditError(res, error, 'Die Zusatzleistung konnte nicht aktualisiert werden.');
  }
});

// Description: Remove add-on service from order
// Endpoint: DELETE /api/admin/orders/:id/addons/:addonId
// Request: { confirmRepricing?: boolean, repricingBasis? } (body, or ?confirmRepricing=true
//          &repricingStoredTotal=..&repricingExpectedTotal=..; see POST /:id/addons)
// Response: { success: boolean, message: string, order: Order }
router.delete('/:id/addons/:addonId', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Remove add-on from order request received:', req.params.id, req.params.addonId);

  try {
    const order = await OrderService.removeAddonFromOrder(
      req.params.id,
      req.params.addonId,
      req.user._id,
      readRepricingConfirmation(req.body, req.query, { allowQuery: true })
    );

    return res.status(200).json({
      success: true,
      message: 'Die Zusatzleistung wurde entfernt.',
      order,
      // Revision/Finanzabgleich laufen nach dem Speichern; Fehler sind sichtbar (HIST-5b).
      warnings: Array.isArray(order?.$locals?.warnings) ? order.$locals.warnings : [],
    });
  } catch (error) {
    console.error('Error removing add-on from order:', error);
    return respondOrderEditError(res, error, 'Die Zusatzleistung konnte nicht entfernt werden.');
  }
});

// Description: Assign staff to add-on service
// Endpoint: PUT /api/admin/orders/:id/addons/:addonId/assign
// Request: { staffId: string }
// Response: { success: boolean, message: string, order: Order }
//           errors: { error: string (German), code?: string } - 400 INVALID_STAFF, 404 ORDER_NOT_FOUND /
//           ADDON_NOT_FOUND, 409 ORDER_EDIT_CONFLICT
router.put('/:id/addons/:addonId/assign', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Assign staff to add-on request received:', req.params.id, req.params.addonId, req.body);

  try {
    const { staffId } = req.body || {};

    if (!staffId) {
      return res.status(400).json({ error: 'Bitte wählen Sie einen Mitarbeiter aus.', code: 'STAFF_REQUIRED' });
    }

    const order = await OrderService.assignStaffToAddon(
      req.params.id,
      req.params.addonId,
      staffId,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Der Mitarbeiter wurde der Zusatzleistung zugewiesen.',
      order
    });
  } catch (error) {
    console.error('Error assigning staff to add-on:', error);
    return respondOrderEditError(res, error, 'Der Mitarbeiter konnte der Zusatzleistung nicht zugewiesen werden.');
  }
});

// ===== Workflow Execution Routes =====

// Description: Get suggested workflows for an order based on device type and services
// Endpoint: GET /api/admin/orders/:id/workflows/suggested
// Request: {}
// Response: { success: boolean, workflows: WorkflowTemplate[] }
router.get('/:id/workflows/suggested', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Get suggested workflows for order request received:', req.params.id);

  try {
    const workflows = await OrderService.getSuggestedWorkflows(req.params.id);

    return res.status(200).json({
      success: true,
      workflows
    });
  } catch (error) {
    console.error('Error getting suggested workflows:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to get suggested workflows'
    });
  }
});

// Description: Get workflows assigned to an order
// Endpoint: GET /api/admin/orders/:id/workflows
// Request: {}
// Response: { success: boolean, workflows: OrderWorkflow[] }
router.get('/:id/workflows', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Get order workflows request received:', req.params.id);

  try {
    const workflows = await OrderService.getOrderWorkflows(req.params.id);

    return res.status(200).json({
      success: true,
      workflows
    });
  } catch (error) {
    console.error('Error getting order workflows:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to get order workflows'
    });
  }
});

// Description: Assign workflow template to an order
// Endpoint: POST /api/admin/orders/:id/workflows
// Request: { workflowTemplateId: string }
// Response: { success: boolean, message: string, order: Order }
router.post('/:id/workflows', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Assign workflow to order request received:', req.params.id, req.body);

  try {
    const { workflowTemplateId, assignedWorkflowStaffId } = req.body;

    if (!workflowTemplateId) {
      return res.status(400).json({ error: 'Workflow template ID is required' });
    }

    const order = await OrderService.assignWorkflowToOrder(
      req.params.id,
      workflowTemplateId,
      req.user._id,
      assignedWorkflowStaffId
    );

    const alreadyAssigned = Boolean(order && order._workflowAlreadyAssigned);

    return res.status(200).json({
      success: true,
      message: alreadyAssigned
        ? 'Workflow is already assigned to this order'
        : 'Workflow assigned to order successfully',
      alreadyAssigned,
      order
    });
  } catch (error) {
    console.error('Error assigning workflow to order:', error);
    if (error && error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code || undefined });
    }
    if (error.message === 'Order not found' || error.message === 'Workflow template not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to assign workflow to order'
    });
  }
});

// Description: Start workflow execution
// Endpoint: POST /api/admin/orders/:id/workflows/:workflowId/start
// Request: {}
// Response: { success: boolean, message: string, order: Order }
router.post('/:id/workflows/:workflowId/start', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Start workflow request received:', req.params.id, req.params.workflowId);

  try {
    const order = await OrderService.startWorkflow(
      req.params.id,
      req.params.workflowId,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Workflow started successfully',
      order
    });
  } catch (error) {
    console.error('Error starting workflow:', error);
    if (error && error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code || undefined });
    }
    if (error.message === 'Order not found' || error.message === 'Workflow not found in order') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to start workflow'
    });
  }
});

// Description: Assign one or multiple staff members to a workflow step
// Endpoint: PUT /api/admin/orders/:id/workflows/:workflowId/steps/:stepId/assign
// Request: { staffIds: string[] }
// Response: { success: boolean, message: string, order: Order }
router.put('/:id/workflows/:workflowId/steps/:stepId/assign', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Assign workflow step staff request received:', req.params.id, req.params.workflowId, req.params.stepId, req.body);

  try {
    const { staffIds } = req.body;

    if (!Array.isArray(staffIds) || staffIds.length === 0) {
      return res.status(400).json({ error: 'At least one staff ID is required' });
    }

    const order = await OrderService.assignWorkflowStepStaff(
      req.params.id,
      req.params.workflowId,
      req.params.stepId,
      staffIds,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Workflow step staff assigned successfully',
      order
    });
  } catch (error) {
    console.error('Error assigning workflow step staff:', error);
    if (error && error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code || undefined });
    }
    if (error.message === 'Order not found' ||
        error.message === 'Workflow not found in order' ||
        error.message === 'Step not found in workflow') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to assign workflow step staff'
    });
  }
});

// Description: Complete workflow step
// Endpoint: POST /api/admin/orders/:id/workflows/:workflowId/steps/:stepId/complete
// Request: { formData?: object, checklistData?: object, notes?: string, photos?: string[] }
// Response: { success: boolean, message: string, order: Order }
router.post('/:id/workflows/:workflowId/steps/:stepId/complete', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Complete workflow step request received:', req.params.id, req.params.workflowId, req.params.stepId, req.body);

  try {
    const { formData, checklistData, notes, photos, timing } = req.body;

    const order = await OrderService.completeWorkflowStep(
      req.params.id,
      req.params.workflowId,
      req.params.stepId,
      { formData, checklistData, notes, photos, timing },
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Workflow step completed successfully',
      order
    });
  } catch (error) {
    console.error('Error completing workflow step:', error);
    if (error && error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code || undefined });
    }
    if (error.message === 'Order not found' ||
        error.message === 'Workflow not found in order' ||
        error.message === 'Step not found in workflow') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to complete workflow step'
    });
  }
});

// Description: Skip workflow step
// Endpoint: POST /api/admin/orders/:id/workflows/:workflowId/steps/:stepId/skip
// Request: { reason?: string }
// Response: { success: boolean, message: string, order: Order }
router.post('/:id/workflows/:workflowId/steps/:stepId/skip', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Skip workflow step request received:', req.params.id, req.params.workflowId, req.params.stepId, req.body);

  try {
    const { reason } = req.body;

    const order = await OrderService.skipWorkflowStep(
      req.params.id,
      req.params.workflowId,
      req.params.stepId,
      reason,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Workflow step skipped successfully',
      order
    });
  } catch (error) {
    console.error('Error skipping workflow step:', error);
    if (error && error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code || undefined });
    }
    if (error.message === 'Order not found' ||
        error.message === 'Workflow not found in order' ||
        error.message === 'Step not found in workflow') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to skip workflow step'
    });
  }
});

// Description: Update workflow status (pause/resume)
// Endpoint: PUT /api/admin/orders/:id/workflows/:workflowId/status
// Request: { status: 'in-progress' | 'on-hold', pauseReason?: string }
// Response: { success: boolean, message: string, order: Order }
router.put('/:id/workflows/:workflowId/status', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Update workflow status request received:', req.params.id, req.params.workflowId, req.body);

  try {
    const { status, pauseReason } = req.body;

    if (!status) {
      console.error('Update workflow status: Status is required');
      return res.status(400).json({ error: 'Bitte einen Status angeben.' });
    }

    console.log('Update workflow status: Calling OrderService with:', {
      orderId: req.params.id,
      workflowId: req.params.workflowId,
      status,
      pauseReason: pauseReason || 'N/A',
      staffId: req.user._id
    });

    const order = await OrderService.updateWorkflowStatus(
      req.params.id,
      req.params.workflowId,
      status,
      req.user._id,
      pauseReason
    );

    console.log('Update workflow status: Success. Order status:', order.status);

    return res.status(200).json({
      success: true,
      unchanged: order?.$locals?.unchanged || undefined,
      message: status === 'on-hold' ? 'Der Workflow wurde pausiert.' : 'Der Workflow wurde fortgesetzt.',
      order
    });
  } catch (error) {
    console.error('Error updating workflow status:', error);
    if (error && error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code || undefined });
    }
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      orderId: req.params.id,
      workflowId: req.params.workflowId
    });
    if (error.message === 'Order not found' || error.message === 'Workflow not found in order') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to update workflow status'
    });
  }
});

// Description: Navigate back to previous step
// Endpoint: POST /api/admin/orders/:id/workflows/:workflowId/steps/:stepId/goto
// Request: {}
// Response: { success: boolean, message: string, order: Order }
router.post('/:id/workflows/:workflowId/steps/:stepId/goto', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Go back to workflow step request received:', req.params.id, req.params.workflowId, req.params.stepId);

  try {
    const order = await OrderService.goBackToStep(
      req.params.id,
      req.params.workflowId,
      req.params.stepId,
      req.user._id,
      typeof req.body?.reason === 'string' ? req.body.reason : ''
    );

    return res.status(200).json({
      success: true,
      message: 'Der Schritt wurde erneut geöffnet.',
      order
    });
  } catch (error) {
    console.error('Error navigating to step:', error);
    if (error && error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code || undefined });
    }
    if (error.message === 'Order not found' ||
        error.message === 'Workflow not found in order' ||
        error.message === 'Step not found in workflow') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({
      error: error.message || 'Failed to navigate to step'
    });
  }
});

// Description: Update device information for an order
// Endpoint: PUT /api/admin/orders/:id/device
// Request: { deviceBrand: string, deviceModel: string, deviceType?: string }
// Response: { success: boolean, message: string, order: Order }
router.put('/:id/device', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Update device information request received:', req.params.id, req.body);

  try {
    const { deviceBrand, deviceModel, deviceType, reason } = req.body || {};

    // Validate required fields
    if (!deviceBrand || !String(deviceBrand).trim()) {
      return res.status(400).json({ error: 'Bitte geben Sie die Marke an.' });
    }

    if (!deviceModel || !String(deviceModel).trim()) {
      return res.status(400).json({ error: 'Bitte geben Sie das Modell an.' });
    }

    // EIN Pfad fuer Geraetekorrekturen (HIST-9): frueher aenderte diese Route das Geraet ohne
    // Preisbildung, Service-Pruefung, Revision und Grund. Jetzt delegiert sie an den
    // Geraetewechsel (gleiche Regeln, gleicher Verlaufseintrag wie POST /:id/change-device).
    const current = await Order.findById(req.params.id).setOptions({ skipAutoPopulate: true }).select('deviceType').lean();
    if (!current) {
      return res.status(404).json({ error: 'Auftrag wurde nicht gefunden.' });
    }
    const result = await DeviceChangeService.changeDeviceAndRecalculateServices(
      req.params.id,
      {
        deviceBrand: String(deviceBrand).trim(),
        deviceModel: String(deviceModel).trim(),
        deviceType: deviceType ? String(deviceType).trim() : current.deviceType,
        reason: typeof reason === 'string' ? reason.trim() : '',
        source: 'Gerätedaten bearbeiten',
        ...readRepricingConfirmation(req.body || {}),
      },
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Die Gerätedaten wurden gespeichert.',
      order: result.order,
      pricingChangesSummary: result.pricingChangesSummary,
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
    });
  } catch (error) {
    console.error('Error updating device information:', error);
    return respondOrderEditError(res, error, 'Die Gerätedaten konnten nicht gespeichert werden.', 400);
  }
});

// Description: Confirm/verify the device unlock code or pattern
// Endpoint: POST /api/admin-orders/:id/confirm-unlock
// Request: { confirmationStatus: 'verified' | 'incorrect' | 'unable-to-verify', notes?: string }
// Response: { order: Order }
router.post('/:id/confirm-unlock', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Unlock confirmation request received for order:', req.params.id, 'from user:', req.user.email);

  try {
    const { confirmationStatus, notes = '' } = req.body;

    // Validate required fields
    if (!confirmationStatus) {
      return res.status(400).json({ error: 'Confirmation status is required' });
    }

    const order = await OrderService.confirmUnlock(
      req.params.id,
      req.user._id,
      req.user.name,
      confirmationStatus,
      notes
    );

    console.log('Unlock confirmation successful for order:', req.params.id);

    return res.status(200).json({ order });
  } catch (error) {
    console.error('Error confirming unlock:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('No unlock information') || error.message.includes('Invalid confirmation status')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Failed to confirm unlock' });
  }
});

// Description: Request updated unlock information from the customer
// Endpoint: POST /api/admin-orders/:id/request-unlock-update
// Request: {}
// Response: { order: Order, communication: Object }
router.post('/:id/request-unlock-update', requireUser, requireAdminOrStaff, async (req, res) => {
  const orderId = req.params.id;
  console.log('Request unlock update received for order:', orderId, 'by user:', req.user.email);

  try {
    const order = await Order.findById(orderId).setOptions({ skipAutoPopulate: true });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Determine what type of unlock info exists
    const unlockType = order.unlockPattern && order.unlockPattern.length > 0 ? 'pattern' : 'code';

    // Confirm unlock as incorrect
    const updatedOrder = await OrderService.confirmUnlock(
      orderId,
      req.user._id,
      req.user.name,
      'incorrect',
      req.body.notes || ''
    );

    // Pause MIT Verlaufseintrag (HIST-13). Frueher: findByIdAndUpdate mit 'pauseReason' - ein
    // Feld, das das Order-Schema nicht kennt (wurde verworfen), ohne Eintrag; der Auftrag wurde
    // nach der Kundenantwort nie automatisch fortgesetzt. Der Eintrag 'Order Paused For Customer'
    // ist die Markierung, an der OrderHistory.resumeIfPausedForCustomer die Fortsetzung erkennt.
    const confirmedAtMs = updatedOrder?.unlockConfirmation?.confirmedAt
      ? new Date(updatedOrder.unlockConfirmation.confirmedAt).getTime()
      : Date.now();
    const pausedOrder = await OrderService.updateStatus(orderId, 'paused', null, req.user._id, {
      key: 'Order Paused For Customer',
      reason: 'Entsperrinformationen falsch – Rückmeldung des Kunden erwartet',
      source: 'Entsperrdaten',
      eventKey: `unlock-request:${confirmedAtMs}`,
      notifyCustomer: false,
    });

    // War der Auftrag bereits aus einem ANDEREN Grund pausiert (Workflow-Pause, fehlende Teile),
    // bleibt dieser Grund bestehen: kein Statuswechsel, keine automatische Fortsetzung nach der
    // Kundenantwort (das wuerde die andere Pause stillschweigend aufheben). Der Verlauf zeigt die
    // Anforderung trotzdem ehrlich (nur Team).
    if (pausedOrder?.$locals?.unchanged && pausedOrder.status === 'paused'
      && !OrderHistory.hasEventKey(pausedOrder, `unlock-request:${confirmedAtMs}`)) {
      const note = OrderHistory.entry({
        key: 'Unlock Update Requested',
        type: 'inspection',
        description: 'Neue Entsperrdaten beim Kunden angefordert. Der Auftrag war bereits pausiert; dieser Grund bleibt bestehen, der Auftrag wird nach der Kundenantwort nicht automatisch fortgesetzt.',
        actor: req.user,
        source: 'Entsperrdaten',
        eventKey: `unlock-request-while-paused:${confirmedAtMs}`,
      });
      const { filter, update } = OrderHistory.updateFor(note, { _id: orderId });
      await Order.updateOne(filter, update);
    }

    // Create a quick action message for the customer to update unlock info
    const description = unlockType === 'pattern'
      ? 'Bitte geben Sie ein neues Entsperrmuster für Ihr Gerät an.'
      : 'Bitte geben Sie einen neuen Entsperrcode für Ihr Gerät an.';

    const communication = await InspectionCommunicationService.createQuickAction(
      orderId,
      null,
      req.user._id,
      req.user.name,
      'update_unlock_info',
      description,
      { unlockType },
      req.user.role
    );

    console.log('Request unlock update successful for order:', orderId);
    return res.status(200).json({ order: pausedOrder || updatedOrder, communication });
  } catch (error) {
    console.error('Error requesting unlock update:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Failed to request unlock update' });
  }
});

// ===== Shop Products Routes =====

// Description: Add shop product to order
// Endpoint: POST /api/admin/orders/:id/shop-products
// Request: { productId: string, quantity: number, confirmRepricing?: boolean, repricingBasis? (see POST /:id/addons) }
// Response: { success: boolean, message: string, order: Order }
router.post('/:id/shop-products', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Add shop product to order request received:', req.params.id, req.body);

  try {
    const { productId, quantity } = req.body;

    if (!productId || !quantity) {
      return res.status(400).json({ error: 'Bitte wählen Sie ein Produkt und eine Menge aus.' });
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: 'Die Menge muss größer als 0 sein.' });
    }

    const order = await OrderService.addShopProduct(
      req.params.id,
      productId,
      quantity,
      req.user._id,
      readRepricingConfirmation(req.body)
    );

    return res.status(200).json({
      success: true,
      message: 'Das Produkt wurde dem Auftrag hinzugefügt.',
      order
    });
  } catch (error) {
    console.error('Error adding shop product to order:', error);
    return respondOrderEditError(res, error, 'Das Produkt konnte nicht hinzugefügt werden.', 400);
  }
});

// Description: Update shop product quantity in order
// Endpoint: PUT /api/admin/orders/:id/shop-products/:productItemId
// Request: { quantity: number, confirmRepricing?: boolean, repricingBasis? (see POST /:id/addons) }
// Response: { success: boolean, message: string, order: Order }
router.put('/:id/shop-products/:productItemId', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Update shop product quantity in order request received:', req.params.id, req.params.productItemId, req.body);

  try {
    const { quantity } = req.body;

    if (!quantity) {
      return res.status(400).json({ error: 'Bitte geben Sie eine Menge an.' });
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: 'Die Menge muss größer als 0 sein.' });
    }

    const order = await OrderService.updateShopProductQuantity(
      req.params.id,
      req.params.productItemId,
      quantity,
      req.user._id,
      readRepricingConfirmation(req.body)
    );

    return res.status(200).json({
      success: true,
      message: 'Die Produktmenge wurde aktualisiert.',
      order
    });
  } catch (error) {
    console.error('Error updating shop product quantity:', error);
    return respondOrderEditError(res, error, 'Die Produktmenge konnte nicht aktualisiert werden.', 400);
  }
});

// Description: Remove shop product from order
// Endpoint: DELETE /api/admin/orders/:id/shop-products/:productItemId
// Request: { confirmRepricing?: boolean, repricingBasis? } (body, or ?confirmRepricing=true
//          &repricingStoredTotal=..&repricingExpectedTotal=..; see POST /:id/addons)
// Response: { success: boolean, message: string, order: Order }
router.delete('/:id/shop-products/:productItemId', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Remove shop product from order request received:', req.params.id, req.params.productItemId);

  try {
    const order = await OrderService.removeShopProduct(
      req.params.id,
      req.params.productItemId,
      req.user._id,
      readRepricingConfirmation(req.body, req.query, { allowQuery: true })
    );

    return res.status(200).json({
      success: true,
      message: 'Das Produkt wurde aus dem Auftrag entfernt.',
      order
    });
  } catch (error) {
    console.error('Error removing shop product from order:', error);
    return respondOrderEditError(res, error, 'Das Produkt konnte nicht entfernt werden.');
  }
});

// Description: Delete workflow from order
// Endpoint: DELETE /api/admin/orders/:id/workflows/:workflowId
// Request: {}
// Response: { success: boolean, message: string, order: Order }
router.delete('/:id/workflows/:workflowId', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('Delete workflow from order request received:', req.params.id, req.params.workflowId);

  try {
    const order = await OrderService.removeWorkflowFromOrder(
      req.params.id,
      req.params.workflowId,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Workflow removed from order successfully',
      order
    });
  } catch (error) {
    console.error('Error deleting workflow from order:', error);
    if (error.message === 'Order not found' || error.message === 'Workflow not found in order') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to delete workflow from order'
    });
  }
});

// Description: Change device and recalculate repair services
// Endpoint: POST /api/admin/orders/:id/change-device
// Request: { deviceBrand: string, deviceModel: string, deviceType: string,
//            serviceReplacements?: Array<{ oldOrderServiceId: string, newServiceId: string }>,
//            serviceReplacement?: { oldOrderServiceId, newServiceId } (legacy single swap),
//            reason?: string (stored in the order history),
//            confirmRepricing?: boolean, repricingBasis? (see POST /:id/addons) }
// Response: { success: boolean, message: string, order: Order, pricingChangesSummary: Object,
//             requiresConfirmation: boolean, warnings: string[] (German; the change IS saved) }
//           errors: { error: string (German), code?: string, details?: object } with 400/404/409
router.post('/:id/change-device', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('[DeviceChange] Change device request received:', req.params.id, req.body);

  try {
    const {
      deviceBrand,
      deviceModel,
      deviceType,
      serviceReplacement,
      serviceReplacements,
      reason,
    } = req.body || {};

    if (!deviceBrand || !deviceModel || !deviceType) {
      return res.status(400).json({ error: 'Bitte geben Sie Marke, Modell und Gerätetyp an.' });
    }

    const result = await DeviceChangeService.changeDeviceAndRecalculateServices(
      req.params.id,
      {
        deviceBrand,
        deviceModel,
        deviceType,
        serviceReplacement,
        serviceReplacements,
        reason: typeof reason === 'string' ? reason.trim() : '',
        // Herkunft fuer den Verlauf, z. B. 'Inspektion Schritt 1' oder 'Gerätekarte'.
        source: typeof req.body?.source === 'string' ? req.body.source.trim().slice(0, 80) : '',
        ...readRepricingConfirmation(req.body || {}),
      },
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: 'Gerätewechsel gespeichert, Reparaturservices und Auftragswert wurden neu berechnet.',
      order: result.order,
      pricingChangesSummary: result.pricingChangesSummary,
      requiresConfirmation: result.requiresConfirmation,
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
    });
  } catch (error) {
    console.error('[DeviceChange] Error changing device:', error);
    return respondOrderEditError(res, error, 'Der Gerätewechsel konnte nicht gespeichert werden.', 400);
  }
});

// Description: Confirm device change after pricing approval
// Endpoint: POST /api/admin/orders/:id/confirm-device-change
// Request: { confirmed: boolean }
// Response: { success: boolean, message: string, order: Order }
router.post('/:id/confirm-device-change', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('[DeviceChange] Confirm device change request received:', req.params.id, req.body);

  try {
    const { confirmed } = req.body;

    if (typeof confirmed !== 'boolean') {
      return res.status(400).json({ error: 'Bitte geben Sie an, ob der Gerätewechsel bestätigt wird.' });
    }

    const order = await DeviceChangeService.confirmDeviceChange(
      req.params.id,
      confirmed,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: confirmed ? 'Der Gerätewechsel wurde bestätigt.' : 'Der Gerätewechsel wurde abgebrochen.',
      order,
    });
  } catch (error) {
    console.error('[DeviceChange] Error confirming device change:', error);
    return respondOrderEditError(res, error, 'Die Bestätigung des Gerätewechsels ist fehlgeschlagen.', 400);
  }
});

// Description: Get compatible services for a device type
// Endpoint: GET /api/admin/orders/device-type/:deviceType/compatible-services
// Request: {}
// Response: { services: Array<Service> }
router.get('/device-type/:deviceType/compatible-services', requireUser, requireAdminOrStaff, async (req, res) => {
  console.log('[DeviceChange] Get compatible services for device type:', req.params.deviceType);

  try {
    const { deviceType } = req.params;
    const { deviceBrand, deviceModel } = req.query;

    if (!deviceType) {
      return res.status(400).json({ error: 'Device type is required' });
    }

    const services = await DeviceChangeService.getCompatibleServices(deviceType, {
      deviceBrand,
      deviceModel,
    });

    return res.status(200).json({
      success: true,
      services,
    });
  } catch (error) {
    console.error('[DeviceChange] Error getting compatible services:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get compatible services',
    });
  }
});

module.exports = router;