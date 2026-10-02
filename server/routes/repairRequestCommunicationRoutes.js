const express = require('express');
const router = express.Router();
const RepairRequest = require('../models/RepairRequest');
const RepairRequestCommunicationService = require('../services/repairRequestCommunicationService');
const RepairRequestService = require('../services/repairRequestService');
const { requireUser } = require('./middleware/auth');

// Jeder erfolgreiche Schreibzugriff leert den kurzen Zaehler-Cache des Postfachs (wie bei den
// Auftrags-Threads), damit Seitenleiste/Dashboard nicht bis zu 10 s nachhinken.
router.use((req, res, next) => {
  if (req.method !== 'GET') {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        require('../services/communicationInboxService').invalidateSummaryCache(); // eslint-disable-line global-require
      }
    });
  }
  next();
});

// Zugriff: Personal/Admin auf alle Threads; Kunden nur auf Threads ihrer eigenen Anfrage
// (fremd/unbekannt/ungültig => 403). Rückfragen und Aktionen anlegen nur Personal.
// Antworten auf Rückfragen nur der Kunde selbst (Personal antwortet nicht im Namen des Kunden).

const sendError = (res, error, fallback) => {
  const isValidation = error?.name === 'ValidationError' || error?.name === 'CastError';
  const status = Number(error?.statusCode) || (isValidation ? 400 : 500);
  const message = error?.statusCode ? error.message : (isValidation ? 'Ungültige Eingabe.' : fallback);
  if (status >= 500) console.error(`RepairRequestCommunicationRoutes: ${fallback}`, error);
  return res.status(status).json({ error: message, message, ...(error?.code ? { code: error.code } : {}) });
};

const displayName = (user) => RepairRequestService.actorNameOf(user);
const isStaff = (user) => RepairRequestService.isStaffUser(user);

// Interne Notizen (RepairRequest.adminNotes) – ausschliesslich für Personal, in der Thread-Antwort
// als eigenes Feld "internalNotes" (nie im communication-Objekt, nie für Kunden/Gäste).
const loadInternalNotes = async (repairRequestId) => {
  const rr = await RepairRequest.findById(repairRequestId).select('adminNotes').lean();
  return (rr?.adminNotes || []).map((note) => ({
    _id: note._id,
    kind: 'internal',
    visibility: 'internal',
    content: note.note,
    senderName: note.staffName,
    staffId: note.staffId,
    createdAt: note.createdAt,
  }));
};

// Description: Get communication threads visible to current user
// Endpoint: GET /api/repair-request-communication
// Request: { page?: number, limit?: number (max 100), search?: string }
// Response: { communications: Array<{..., unreadCount, awaitingReply, link}>, totalPages, currentPage, totalCount }
// NOTE: This route MUST be defined before /:repairRequestId routes to avoid route collision
router.get('/', requireUser, async (req, res) => {
  try {
    const result = await RepairRequestCommunicationService.getCommunicationsForUser(req.user._id, req.user.role, {
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
    });
    res.status(200).json(result);
  } catch (error) {
    sendError(res, error, 'Nachrichten konnten nicht geladen werden.');
  }
});

// Description: Get communication thread for a repair request
// Endpoint: GET /api/repair-request-communication/:repairRequestId
// Response: { communication: Object | null, summary: { unreadCount, awaitingReply, ... }, internalNotes?: [...] (nur Personal) }
router.get('/:repairRequestId', requireUser, async (req, res) => {
  try {
    const rr = await RepairRequestService.assertAccess(req.user, req.params.repairRequestId);
    const communication = await RepairRequestCommunicationService.getCommunicationThread(rr._id);
    const payload = {
      communication,
      summary: RepairRequestCommunicationService.summarizeThread(communication, req.user),
    };
    if (isStaff(req.user)) {
      payload.internalNotes = await loadInternalNotes(rr._id);
    }
    res.status(200).json(payload);
  } catch (error) {
    sendError(res, error, 'Nachrichten konnten nicht geladen werden.');
  }
});

// Description: Send a message in the communication thread ("Nachricht an Kunden senden" for staff)
// Endpoint: POST /api/repair-request-communication/:repairRequestId/message
// Request: { content: string, clientMessageId?: string }
// Response: { communication: Object, duplicate: boolean }
router.post('/:repairRequestId/message', requireUser, async (req, res) => {
  try {
    const { content, clientMessageId } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: 'Nachrichteninhalt darf nicht leer sein.' });
    }
    const rr = await RepairRequestService.assertAccess(req.user, req.params.repairRequestId);
    const staff = isStaff(req.user);
    const communication = await RepairRequestCommunicationService.sendMessage(
      rr._id,
      req.user._id,
      displayName(req.user),
      String(content),
      staff ? 'staff' : 'customer',
      req.user.role,
      { clientMessageId }
    );
    const duplicate = Boolean(communication?.$locals?.duplicate);
    res.status(duplicate ? 200 : 201).json({ communication, duplicate });
  } catch (error) {
    sendError(res, error, 'Die Nachricht konnte nicht gesendet werden.');
  }
});

// Description: Send a feedback request (staff only)
// Endpoint: POST /api/repair-request-communication/:repairRequestId/feedback-request
// Request: { question: string, options: Array<{label, value}> }
router.post('/:repairRequestId/feedback-request', requireUser, async (req, res) => {
  try {
    const rr = await RepairRequestService.assertAccess(req.user, req.params.repairRequestId, { staffOnly: true });
    const { question, options } = req.body || {};
    const communication = await RepairRequestCommunicationService.sendFeedbackRequest(
      rr._id,
      req.user._id,
      displayName(req.user),
      question,
      options,
      req.user.role
    );
    res.status(201).json({ communication });
  } catch (error) {
    sendError(res, error, 'Die Rückfrage konnte nicht gesendet werden.');
  }
});

// Description: Respond to a feedback request (customer owner only; once)
// Endpoint: POST /api/repair-request-communication/:repairRequestId/feedback-response
// Request: { messageId: string, response: {label, value} }
// Response: { communication } | 409 'Diese Frage wurde bereits beantwortet.'
router.post('/:repairRequestId/feedback-response', requireUser, async (req, res) => {
  try {
    if (isStaff(req.user)) {
      return res.status(403).json({ error: 'Mitarbeitende können Rückfragen nicht im Namen des Kunden beantworten.' });
    }
    const rr = await RepairRequestService.assertAccess(req.user, req.params.repairRequestId);
    const { messageId, response } = req.body || {};
    if (!messageId || !response) {
      return res.status(400).json({ error: 'Rückfrage und Antwort sind erforderlich.' });
    }
    const communication = await RepairRequestCommunicationService.respondToFeedback(
      rr._id,
      messageId,
      response,
      req.user._id,
      displayName(req.user),
      { channel: 'customer' }
    );
    res.status(200).json({ communication });
  } catch (error) {
    sendError(res, error, 'Die Antwort konnte nicht gespeichert werden.');
  }
});

// Description: Create a quick action (staff only)
// Endpoint: POST /api/repair-request-communication/:repairRequestId/quick-action
// Request: { actionType: string, description?: string, metadata?: object }
router.post('/:repairRequestId/quick-action', requireUser, async (req, res) => {
  try {
    const rr = await RepairRequestService.assertAccess(req.user, req.params.repairRequestId, { staffOnly: true });
    const { actionType, description, metadata } = req.body || {};
    if (!actionType) return res.status(400).json({ error: 'Bitte einen Aktionstyp wählen.' });
    const communication = await RepairRequestCommunicationService.createQuickAction(
      rr._id,
      req.user._id,
      displayName(req.user),
      actionType,
      description,
      metadata,
      req.user.role
    );
    res.status(201).json({ communication });
  } catch (error) {
    sendError(res, error, 'Die Aktion konnte nicht angelegt werden.');
  }
});

// Description: Complete a quick action (owner or staff)
// Endpoint: PUT /api/repair-request-communication/:repairRequestId/quick-action/:messageId/complete
router.put('/:repairRequestId/quick-action/:messageId/complete', requireUser, async (req, res) => {
  try {
    const rr = await RepairRequestService.assertAccess(req.user, req.params.repairRequestId);
    const communication = await RepairRequestCommunicationService.completeQuickAction(rr._id, req.params.messageId);
    res.status(200).json({ communication });
  } catch (error) {
    sendError(res, error, 'Die Aktion konnte nicht abgeschlossen werden.');
  }
});

// Description: Mark all messages as read for the current user
// Endpoint: PUT /api/repair-request-communication/:repairRequestId/mark-read
router.put('/:repairRequestId/mark-read', requireUser, async (req, res) => {
  try {
    const rr = await RepairRequestService.assertAccess(req.user, req.params.repairRequestId);
    const communication = await RepairRequestCommunicationService.markMessagesAsRead(rr._id, req.user._id);
    res.status(200).json({ communication });
  } catch (error) {
    sendError(res, error, 'Nachrichten konnten nicht als gelesen markiert werden.');
  }
});

// Description: Get pending feedback count
// Endpoint: GET /api/repair-request-communication/:repairRequestId/pending-feedback
router.get('/:repairRequestId/pending-feedback', requireUser, async (req, res) => {
  try {
    const rr = await RepairRequestService.assertAccess(req.user, req.params.repairRequestId);
    const count = await RepairRequestCommunicationService.getPendingFeedbackCount(rr._id);
    res.status(200).json({ count });
  } catch (error) {
    sendError(res, error, 'Zähler konnte nicht geladen werden.');
  }
});

// Description: Get pending actions count
// Endpoint: GET /api/repair-request-communication/:repairRequestId/pending-actions
router.get('/:repairRequestId/pending-actions', requireUser, async (req, res) => {
  try {
    const rr = await RepairRequestService.assertAccess(req.user, req.params.repairRequestId);
    const count = await RepairRequestCommunicationService.getPendingActionsCount(rr._id);
    res.status(200).json({ count });
  } catch (error) {
    sendError(res, error, 'Zähler konnte nicht geladen werden.');
  }
});

// Description: Get unread message count for a repair request (per user; see unreadCountFor)
// Endpoint: GET /api/repair-request-communication/:repairRequestId/unread-count
// Response: { unreadCount: number, awaitingReply: boolean }
router.get('/:repairRequestId/unread-count', requireUser, async (req, res) => {
  try {
    const rr = await RepairRequestService.assertAccess(req.user, req.params.repairRequestId);
    const communication = await RepairRequestCommunicationService.getCommunicationThread(rr._id);
    const summary = RepairRequestCommunicationService.summarizeThread(communication, req.user);
    res.status(200).json({ unreadCount: summary.unreadCount, awaitingReply: summary.awaitingReply });
  } catch (error) {
    sendError(res, error, 'Zähler konnte nicht geladen werden.');
  }
});

module.exports = router;
