const express = require('express');
const router = express.Router();
const RepairRequestCommunicationService = require('../services/repairRequestCommunicationService');
const { requireUser } = require('./middleware/auth');

// Description: Get communication thread for a repair request
// Endpoint: GET /api/repair-request-communication/:repairRequestId
// Request: {}
// Response: { communication: Object }
router.get('/:repairRequestId', requireUser, async (req, res) => {
  try {
    const { repairRequestId } = req.params;

    console.log(`RepairRequestCommunicationRoutes: GET /${repairRequestId} - Fetching communication thread`);

    const communication = await RepairRequestCommunicationService.getCommunicationThread(repairRequestId);

    res.status(200).json({ communication });
  } catch (error) {
    console.error(`RepairRequestCommunicationRoutes: Error fetching communication thread: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Send a message in the communication thread
// Endpoint: POST /api/repair-request-communication/:repairRequestId/message
// Request: { content: string }
// Response: { communication: Object }
router.post('/:repairRequestId/message', requireUser, async (req, res) => {
  try {
    const { repairRequestId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    console.log(`RepairRequestCommunicationRoutes: POST /${repairRequestId}/message - Sending message`);

    const communication = await RepairRequestCommunicationService.sendMessage(
      repairRequestId,
      req.user._id,
      req.user.firstName && req.user.lastName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user.email,
      content,
      req.user.role === 'customer' ? 'customer' : 'staff',
      req.user.role
    );

    res.status(201).json({ communication });
  } catch (error) {
    console.error(`RepairRequestCommunicationRoutes: Error sending message: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Send a feedback request
// Endpoint: POST /api/repair-request-communication/:repairRequestId/feedback-request
// Request: { question: string, options: Array<{label, value}> }
// Response: { communication: Object }
router.post('/:repairRequestId/feedback-request', requireUser, async (req, res) => {
  try {
    const { repairRequestId } = req.params;
    const { question, options } = req.body;

    if (!question || !options || options.length === 0) {
      return res.status(400).json({ error: 'Question and options are required' });
    }

    console.log(`RepairRequestCommunicationRoutes: POST /${repairRequestId}/feedback-request - Sending feedback request`);

    const communication = await RepairRequestCommunicationService.sendFeedbackRequest(
      repairRequestId,
      req.user._id,
      req.user.firstName && req.user.lastName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user.email,
      question,
      options,
      req.user.role
    );

    res.status(201).json({ communication });
  } catch (error) {
    console.error(`RepairRequestCommunicationRoutes: Error sending feedback request: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Respond to a feedback request
// Endpoint: POST /api/repair-request-communication/:repairRequestId/feedback-response
// Request: { messageId: string, response: {label, value} }
// Response: { communication: Object }
router.post('/:repairRequestId/feedback-response', requireUser, async (req, res) => {
  try {
    const { repairRequestId } = req.params;
    const { messageId, response } = req.body;

    if (!messageId || !response) {
      return res.status(400).json({ error: 'messageId and response are required' });
    }

    console.log(`RepairRequestCommunicationRoutes: POST /${repairRequestId}/feedback-response - Recording feedback response`);

    const communication = await RepairRequestCommunicationService.respondToFeedback(
      repairRequestId,
      messageId,
      response,
      req.user._id,
      req.user.firstName && req.user.lastName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user.email
    );

    res.status(200).json({ communication });
  } catch (error) {
    console.error(`RepairRequestCommunicationRoutes: Error responding to feedback: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Create a quick action
// Endpoint: POST /api/repair-request-communication/:repairRequestId/quick-action
// Request: { actionType: string, description?: string, metadata?: object }
// Response: { communication: Object }
router.post('/:repairRequestId/quick-action', requireUser, async (req, res) => {
  try {
    const { repairRequestId } = req.params;
    const { actionType, description, metadata } = req.body;

    if (!actionType) {
      return res.status(400).json({ error: 'actionType is required' });
    }

    const validActions = ['parts_needed', 'approval_required', 'additional_cost', 'status_update', 'schedule_appointment'];
    if (!validActions.includes(actionType)) {
      return res.status(400).json({ error: `Invalid action type. Must be one of: ${validActions.join(', ')}` });
    }

    console.log(`RepairRequestCommunicationRoutes: POST /${repairRequestId}/quick-action - Creating quick action ${actionType}`);

    const communication = await RepairRequestCommunicationService.createQuickAction(
      repairRequestId,
      req.user._id,
      req.user.firstName && req.user.lastName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user.email,
      actionType,
      description,
      metadata,
      req.user.role
    );

    res.status(201).json({ communication });
  } catch (error) {
    console.error(`RepairRequestCommunicationRoutes: Error creating quick action: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Complete a quick action
// Endpoint: PUT /api/repair-request-communication/:repairRequestId/quick-action/:messageId/complete
// Request: {}
// Response: { communication: Object }
router.put('/:repairRequestId/quick-action/:messageId/complete', requireUser, async (req, res) => {
  try {
    const { repairRequestId, messageId } = req.params;

    console.log(`RepairRequestCommunicationRoutes: PUT /${repairRequestId}/quick-action/${messageId}/complete - Completing quick action`);

    const communication = await RepairRequestCommunicationService.completeQuickAction(repairRequestId, messageId);

    res.status(200).json({ communication });
  } catch (error) {
    console.error(`RepairRequestCommunicationRoutes: Error completing quick action: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Mark all messages as read
// Endpoint: PUT /api/repair-request-communication/:repairRequestId/mark-read
// Request: {}
// Response: { communication: Object }
router.put('/:repairRequestId/mark-read', requireUser, async (req, res) => {
  try {
    const { repairRequestId } = req.params;

    console.log(`RepairRequestCommunicationRoutes: PUT /${repairRequestId}/mark-read - Marking messages as read`);

    const communication = await RepairRequestCommunicationService.markMessagesAsRead(repairRequestId, req.user._id);

    res.status(200).json({ communication });
  } catch (error) {
    console.error(`RepairRequestCommunicationRoutes: Error marking messages as read: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Get pending feedback count
// Endpoint: GET /api/repair-request-communication/:repairRequestId/pending-feedback
// Request: {}
// Response: { count: number }
router.get('/:repairRequestId/pending-feedback', requireUser, async (req, res) => {
  try {
    const { repairRequestId } = req.params;

    console.log(`RepairRequestCommunicationRoutes: GET /${repairRequestId}/pending-feedback - Getting pending feedback count`);

    const count = await RepairRequestCommunicationService.getPendingFeedbackCount(repairRequestId);

    res.status(200).json({ count });
  } catch (error) {
    console.error(`RepairRequestCommunicationRoutes: Error getting pending feedback count: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Get pending actions count
// Endpoint: GET /api/repair-request-communication/:repairRequestId/pending-actions
// Request: {}
// Response: { count: number }
router.get('/:repairRequestId/pending-actions', requireUser, async (req, res) => {
  try {
    const { repairRequestId } = req.params;

    console.log(`RepairRequestCommunicationRoutes: GET /${repairRequestId}/pending-actions - Getting pending actions count`);

    const count = await RepairRequestCommunicationService.getPendingActionsCount(repairRequestId);

    res.status(200).json({ count });
  } catch (error) {
    console.error(`RepairRequestCommunicationRoutes: Error getting pending actions count: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

// Description: Get unread message count for a repair request
// Endpoint: GET /api/repair-request-communication/:repairRequestId/unread-count
// Request: {}
// Response: { unreadCount: number }
router.get('/:repairRequestId/unread-count', requireUser, async (req, res) => {
  try {
    const { repairRequestId } = req.params;

    console.log(`RepairRequestCommunicationRoutes: GET /${repairRequestId}/unread-count - Getting unread message count`);

    const unreadCount = await RepairRequestCommunicationService.getUnreadMessageCount(repairRequestId, req.user._id);

    res.status(200).json({ unreadCount });
  } catch (error) {
    console.error(`RepairRequestCommunicationRoutes: Error getting unread message count: ${error.message}`, error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
