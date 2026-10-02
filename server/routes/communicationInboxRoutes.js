const express = require('express');
const router = express.Router();
const CommunicationInboxService = require('../services/communicationInboxService');
const { requireUser } = require('./middleware/auth');

// Zentrales Postfach - lesender Adapter ueber Auftrags-, Reparaturanfrage-, Reklamations- und
// (nur Admin) Kontaktanfrage-Gespraeche. Antworten laufen weiter ueber die Routen der Quellen.

const sendError = (res, error, fallback) => {
  const status = Number(error?.status) || 500;
  if (status >= 500) {
    console.error(`CommunicationInboxRoutes: ${fallback}: ${error?.stack || error}`);
    return res.status(500).json({ success: false, error: fallback });
  }
  return res.status(status).json({ success: false, error: error.message });
};

// Description: Unified inbox list (server-side paginated, all sources)
// Endpoint: GET /api/communications/inbox
// Query: source=all|order|repair_request|complaint|contact, filter=all|unread|awaiting_reply, q, page, limit (max 50)
// Response: { success, items[], page, limit, totalCount, totalPages, hasMore, counts, sourceErrors[], partial, ... }
router.get('/inbox', requireUser, async (req, res) => {
  try {
    const result = await CommunicationInboxService.listInbox(req.user, req.query || {});
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, 'Nachrichten konnten nicht geladen werden.');
  }
});

// Description: Counters for sidebar badge and dashboard
// Endpoint: GET /api/communications/summary?recent=<n>
// Response: { success, unread, unreadMessages, awaitingReply, bySource, recent[], sourceErrors[], partial }
router.get('/summary', requireUser, async (req, res) => {
  try {
    const result = await CommunicationInboxService.getSummary(req.user, { recentLimit: req.query.recent });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    sendError(res, error, 'Nachrichtenzähler konnten nicht geladen werden.');
  }
});

// Description: Read-only thread view (complaint comments, contact request, legacy repair-request messages)
// Endpoint: GET /api/communications/thread/:sourceType/:sourceId
// Response: { success, thread: { key, sourceType, sourceId, messages[] } }
router.get('/thread/:sourceType/:sourceId', requireUser, async (req, res) => {
  try {
    const thread = await CommunicationInboxService.getThread(req.user, req.params.sourceType, req.params.sourceId);
    res.status(200).json({ success: true, thread });
  } catch (error) {
    sendError(res, error, 'Der Verlauf konnte nicht geladen werden.');
  }
});

// Description: Mark a conversation as read for the current user
// Endpoint: PUT /api/communications/:sourceType/:sourceId/read
// Response: { success, updated }
router.put('/:sourceType/:sourceId/read', requireUser, async (req, res) => {
  try {
    const result = await CommunicationInboxService.markRead(req.user, req.params.sourceType, req.params.sourceId);
    res.status(200).json(result);
  } catch (error) {
    sendError(res, error, 'Das Gespräch konnte nicht als gelesen markiert werden.');
  }
});

module.exports = router;
