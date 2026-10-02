const express = require('express');
const router = express.Router();
const InspectionCommunicationService = require('../services/inspectionCommunicationService');
const Order = require('../models/Order');
const { requireUser, requireStaff } = require('./middleware/auth');

const isStaff = (user) => ['admin', 'staff'].includes(user?.role);

// Jeder erfolgreiche Schreibzugriff (Nachricht, Notiz, Rueckfrage, Aktion, Gelesen) leert den
// kurzen Zaehler-Cache des Postfachs, damit Seitenleiste/Dashboard sofort stimmen.
router.use((req, res, next) => {
  if (req.method !== 'GET' && req.path !== '/unread-counts') {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        require('../services/communicationInboxService').invalidateSummaryCache();
      }
    });
  }
  next();
});

// Fehlerantwort: bekannte (deutsche) Fehler mit Status, sonst generische deutsche Meldung.
const sendError = (res, error, fallback) => {
  const status = Number(error?.status) || 500;
  if (status >= 500) {
    console.error(`InspectionCommunicationRoutes: ${fallback}: ${error?.stack || error}`);
    return res.status(500).json({ error: fallback });
  }
  return res.status(status).json({ error: error.message });
};

// Zugriffsschutz fuer alle Routen mit :orderId (K04): Personal/Admin duerfen jeden Auftrag
// sehen; ein Kunde nur Auftraege mit Order.customerId === eigene ID. Fremde, unbekannte und
// ungueltige IDs bekommen fuer Kunden DIESELBE Antwort (403), damit sich die Existenz eines
// Auftrags nicht erraten laesst (gleicher Vertrag wie GET /api/orders/:id/shipments).
const requireOrderAccess = async (req, res, next) => {
  const privileged = isStaff(req.user);
  const deny = () => (privileged
    ? res.status(404).json({ error: 'Auftrag wurde nicht gefunden.' })
    : res.status(403).json({ error: 'Zugriff verweigert.' }));
  try {
    const { orderId } = req.params;
    if (!/^[a-f0-9]{24}$/i.test(String(orderId || ''))) {
      return deny();
    }
    const order = await Order.findById(orderId)
      .setOptions({ skipAutoPopulate: true })
      .select('_id customerId')
      .lean();
    if (!order) return deny();
    if (!privileged && String(order.customerId || '') !== String(req.user._id)) {
      return deny();
    }
    req.communicationOrder = order;
    return next();
  } catch (error) {
    console.error(`InspectionCommunicationRoutes: access check failed: ${error}`);
    return res.status(500).json({ error: 'Zugriff konnte nicht geprüft werden.' });
  }
};

// Description: Get communication threads visible to current user
// Endpoint: GET /api/inspection-communication
// Request: { page?: number, limit?: number, search?: string }
// Response: { communications: Array<Object>, totalPages: number, currentPage: number, totalCount: number }
// NOTE: Kunden sehen nur eigene Auftraege (Service). Das zentrale Postfach nutzt
//       GET /api/communications/inbox (alle Quellen, serverseitig paginiert).
router.get('/', requireUser, async (req, res) => {
  try {
    const filters = {
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
    };

    const result = await InspectionCommunicationService.getCommunicationsForUser(
      req.user._id,
      req.user.role,
      filters
    );

    res.status(200).json(result);
  } catch (error) {
    sendError(res, error, 'Nachrichten konnten nicht geladen werden.');
  }
});

// Description: Get unread message counts for multiple orders
// Endpoint: POST /api/inspection-communication/unread-counts
// Request: { orderIds: Array<string> }
// Response: { unreadCounts: Record<string, { unread: number, senderType?: string, awaitingReply?: boolean }> }
// Kunden bekommen nur Zaehler eigener Auftraege (fremde IDs werden still ignoriert).
router.post('/unread-counts', requireUser, async (req, res) => {
  try {
    const { orderIds } = req.body || {};

    if (!orderIds || !Array.isArray(orderIds)) {
      return res.status(400).json({ error: 'orderIds (Liste) ist erforderlich.' });
    }

    let allowedIds = orderIds.map(String).filter((id) => /^[a-f0-9]{24}$/i.test(id)).slice(0, 500);
    if (!isStaff(req.user) && allowedIds.length) {
      const owned = await Order.find({ _id: { $in: allowedIds }, customerId: req.user._id })
        .setOptions({ skipAutoPopulate: true })
        .select('_id')
        .lean();
      allowedIds = owned.map((order) => String(order._id));
    }

    const unreadCounts = await InspectionCommunicationService.getUnreadMessageCounts(allowedIds, req.user._id, req.user.role);

    res.status(200).json({ unreadCounts });
  } catch (error) {
    sendError(res, error, 'Ungelesene Nachrichten konnten nicht gezählt werden.');
  }
});

// Description: Get communication thread for an order
// Endpoint: GET /api/inspection-communication/:orderId
// Response: { communication: Object|null, internalNotes?: Array }  (internalNotes NUR fuer Personal)
router.get('/:orderId', requireUser, requireOrderAccess, async (req, res) => {
  try {
    const { orderId } = req.params;
    const communication = await InspectionCommunicationService.getCommunicationThread(orderId);
    const payload = { communication };
    if (isStaff(req.user)) {
      payload.internalNotes = await InspectionCommunicationService.getInternalNotes(orderId);
    }
    res.status(200).json(payload);
  } catch (error) {
    sendError(res, error, 'Der Verlauf konnte nicht geladen werden.');
  }
});

// Description: Send a message in the communication thread (customer-visible)
// Endpoint: POST /api/inspection-communication/:orderId/message
// Request: { content: string, clientMessageId?: string }
// Response: 201 { communication, created: true } | 200 { communication, created: false } (Wiederholung)
router.post('/:orderId/message', requireUser, requireOrderAccess, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { content, clientMessageId } = req.body || {};

    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: 'Bitte geben Sie eine Nachricht ein.' });
    }

    const { communication, created } = await InspectionCommunicationService.sendMessageWithResult(
      orderId,
      req.user._id,
      req.user.name || req.user.email,
      content,
      isStaff(req.user) ? 'staff' : 'customer',
      req.user.role,
      { clientMessageId }
    );

    res.status(created ? 201 : 200).json({ communication, created });
  } catch (error) {
    sendError(res, error, 'Die Nachricht konnte nicht gesendet werden.');
  }
});

// Description: Save an internal note (staff only, never visible to the customer)
// Endpoint: POST /api/inspection-communication/:orderId/internal-note
// Request: { note: string, clientMessageId?: string }
// Response: 201|200 { internalNote, internalNotes, created }
// Speicher: Order.staffNotes (Typ 'internal'); keine Kundenbenachrichtigung, keine E-Mail.
router.post('/:orderId/internal-note', requireStaff, requireOrderAccess, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { note, content, clientMessageId } = req.body || {};
    const result = await InspectionCommunicationService.addInternalNote(
      orderId,
      req.user,
      note !== undefined ? note : content,
      clientMessageId
    );
    res.status(result.created ? 201 : 200).json(result);
  } catch (error) {
    sendError(res, error, 'Die interne Notiz konnte nicht gespeichert werden.');
  }
});

// Description: Send a feedback request (structured question to the customer) - staff only
// Endpoint: POST /api/inspection-communication/:orderId/feedback-request
// Request: { inspectionId?: string, question: string, options: Array<{label, value}>, clientMessageId?: string }
// Response: { communication: Object }
// inspectionId wird serverseitig geprueft: nur eine DeviceInspection DIESES Auftrags wird gespeichert.
router.post('/:orderId/feedback-request', requireStaff, requireOrderAccess, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { inspectionId, question, options, clientMessageId } = req.body || {};

    if (!question || !Array.isArray(options) || options.length === 0) {
      return res.status(400).json({ error: 'Bitte eine Frage und mindestens zwei Antwortoptionen angeben.' });
    }

    const outcome = {};
    const communication = await InspectionCommunicationService.sendFeedbackRequest(
      orderId,
      inspectionId,
      req.user._id,
      req.user.name || req.user.email,
      question,
      options,
      req.user.role,
      { clientMessageId, result: outcome }
    );

    res.status(outcome.created === false ? 200 : 201).json({ communication, created: outcome.created !== false });
  } catch (error) {
    sendError(res, error, 'Die Rückfrage konnte nicht gesendet werden.');
  }
});

// Description: Respond to a feedback request - only the order's customer
// Endpoint: POST /api/inspection-communication/:orderId/feedback-response
// Request: { messageId: string, response: {label, value} }
// Response: { communication: Object } | 409 wenn bereits beantwortet
// Mitarbeiter duerfen NICHT im Namen des Kunden antworten (Produktentscheidung 01.10.2026).
router.post('/:orderId/feedback-response', requireUser, requireOrderAccess, async (req, res) => {
  try {
    if (isStaff(req.user)) {
      return res.status(403).json({ error: 'Rückfragen kann nur der Kunde selbst beantworten.' });
    }
    const { orderId } = req.params;
    const { messageId, response } = req.body || {};

    if (!messageId || !response) {
      return res.status(400).json({ error: 'Bitte wählen Sie eine Antwort aus.' });
    }

    const communication = await InspectionCommunicationService.respondToFeedback(
      orderId,
      messageId,
      response,
      req.user._id,
      req.user.name || req.user.email
    );

    res.status(200).json({ communication });
  } catch (error) {
    sendError(res, error, 'Die Antwort konnte nicht gespeichert werden.');
  }
});

// Description: Create a quick action (request an action from the customer) - staff only
// Endpoint: POST /api/inspection-communication/:orderId/quick-action
// Request: { inspectionId?: string, actionType: string, description?: string, metadata?: object, clientMessageId?: string }
// Response: { communication: Object }
router.post('/:orderId/quick-action', requireStaff, requireOrderAccess, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { inspectionId, actionType, description, metadata, clientMessageId } = req.body || {};

    if (!actionType) {
      return res.status(400).json({ error: 'Bitte wählen Sie eine Aktion aus.' });
    }

    const validActions = ['part_replacement', 'incorrect_device', 'incorrect_unlock_code', 'additional_costs', 'update_unlock_info', 'customer_defect_info'];
    if (!validActions.includes(actionType)) {
      return res.status(400).json({ error: 'Unbekannte Aktion.' });
    }

    const outcome = {};
    const communication = await InspectionCommunicationService.createQuickAction(
      orderId,
      inspectionId,
      req.user._id,
      req.user.name || req.user.email,
      actionType,
      description,
      metadata,
      req.user.role,
      { clientMessageId, result: outcome }
    );

    res.status(outcome.created === false ? 200 : 201).json({ communication, created: outcome.created !== false });
  } catch (error) {
    sendError(res, error, 'Die Aktion konnte nicht gesendet werden.');
  }
});

// Description: Complete a quick action (order customer or staff)
// Endpoint: PUT /api/inspection-communication/:orderId/quick-action/:messageId/complete
// Response: { communication: Object }
router.put('/:orderId/quick-action/:messageId/complete', requireUser, requireOrderAccess, async (req, res) => {
  try {
    const { orderId, messageId } = req.params;
    const communication = await InspectionCommunicationService.completeQuickAction(orderId, messageId, {
      userId: req.user._id,
      role: req.user.role,
    });
    res.status(200).json({ communication });
  } catch (error) {
    sendError(res, error, 'Die Aktion konnte nicht abgeschlossen werden.');
  }
});

// Description: Mark all messages as read for the current user (per-user read state)
// Endpoint: PUT /api/inspection-communication/:orderId/mark-read
// Response: { communication: Object|null }
router.put('/:orderId/mark-read', requireUser, requireOrderAccess, async (req, res) => {
  try {
    const { orderId } = req.params;
    const communication = await InspectionCommunicationService.markMessagesAsRead(orderId, req.user._id);
    res.status(200).json({ communication });
  } catch (error) {
    sendError(res, error, 'Nachrichten konnten nicht als gelesen markiert werden.');
  }
});

// Description: Get pending feedback count
// Endpoint: GET /api/inspection-communication/:orderId/pending-feedback
// Response: { count: number }
router.get('/:orderId/pending-feedback', requireUser, requireOrderAccess, async (req, res) => {
  try {
    const count = await InspectionCommunicationService.getPendingFeedbackCount(req.params.orderId);
    res.status(200).json({ count });
  } catch (error) {
    sendError(res, error, 'Offene Rückfragen konnten nicht gezählt werden.');
  }
});

// Description: Get pending actions count
// Endpoint: GET /api/inspection-communication/:orderId/pending-actions
// Response: { count: number }
router.get('/:orderId/pending-actions', requireUser, requireOrderAccess, async (req, res) => {
  try {
    const count = await InspectionCommunicationService.getPendingActionsCount(req.params.orderId);
    res.status(200).json({ count });
  } catch (error) {
    sendError(res, error, 'Offene Aktionen konnten nicht gezählt werden.');
  }
});

// Description: Customer submits updated unlock information
// Endpoint: POST /api/inspection-communication/:orderId/update-unlock-info
// Request: { unlockCode?: string, unlockPattern?: string[], noLock?: boolean }
// Response: { order: Object }
router.post('/:orderId/update-unlock-info', requireUser, requireOrderAccess, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { unlockCode, unlockPattern, noLock } = req.body || {};

    const order = await InspectionCommunicationService.submitUnlockInfoUpdate(
      orderId,
      req.user._id,
      req.user.name || req.user.email,
      { unlockCode, unlockPattern, noLock }
    );

    res.status(200).json({ order });
  } catch (error) {
    console.error(`InspectionCommunicationRoutes: Error updating unlock info: ${error}`);
    if (error.message === 'Order not found') {
      return res.status(404).json({ error: 'Auftrag wurde nicht gefunden.' });
    }
    if (error.message === 'Unauthorized') {
      return res.status(403).json({ error: 'Zugriff verweigert.' });
    }
    if (/Ungültige Entsperrinformation/.test(error.message || '')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Die Entsperrinformation konnte nicht gespeichert werden.' });
  }
});

module.exports = router;
