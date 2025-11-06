const express = require('express');
const router = express.Router();
const InspectionCommunicationService = require('../services/inspectionCommunicationService');
const { auth, requireUser } = require('./middleware/auth');

// Description: Get communication thread for an order
// Endpoint: GET /api/inspection-communication/:orderId
// Request: {}
// Response: { communication: Object }
router.get('/:orderId', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log(`InspectionCommunicationRoutes: GET /${orderId} - Fetching communication thread`);

    const communication = await InspectionCommunicationService.getCommunicationThread(orderId);

    res.status(200).json({ communication });
  } catch (error) {
    console.error(`InspectionCommunicationRoutes: Error fetching communication thread: ${error}`);
    res.status(500).json({ error: error.message });
  }
});

// Description: Send a message in the communication thread
// Endpoint: POST /api/inspection-communication/:orderId/message
// Request: { content: string }
// Response: { communication: Object }
router.post('/:orderId/message', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    console.log(`InspectionCommunicationRoutes: POST /${orderId}/message - Sending message`);

    const communication = await InspectionCommunicationService.sendMessage(
      orderId,
      req.user._id,
      req.user.name || req.user.email,
      content,
      req.user.role === 'customer' ? 'customer' : 'staff',
      req.user.role
    );

    res.status(201).json({ communication });
  } catch (error) {
    console.error(`InspectionCommunicationRoutes: Error sending message: ${error}`);
    res.status(500).json({ error: error.message });
  }
});

// Description: Send a feedback request
// Endpoint: POST /api/inspection-communication/:orderId/feedback-request
// Request: { inspectionId: string, question: string, options: Array<{label, value}> }
// Response: { communication: Object }
router.post('/:orderId/feedback-request', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { inspectionId, question, options } = req.body;

    if (!question || !options || options.length === 0) {
      return res.status(400).json({ error: 'Question and options are required' });
    }

    console.log(`InspectionCommunicationRoutes: POST /${orderId}/feedback-request - Sending feedback request`);

    const communication = await InspectionCommunicationService.sendFeedbackRequest(
      orderId,
      inspectionId,
      req.user._id,
      req.user.name || req.user.email,
      question,
      options,
      req.user.role
    );

    res.status(201).json({ communication });
  } catch (error) {
    console.error(`InspectionCommunicationRoutes: Error sending feedback request: ${error}`);
    res.status(500).json({ error: error.message });
  }
});

// Description: Respond to a feedback request
// Endpoint: POST /api/inspection-communication/:orderId/feedback-response
// Request: { messageId: string, response: {label, value} }
// Response: { communication: Object }
router.post('/:orderId/feedback-response', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { messageId, response } = req.body;

    if (!messageId || !response) {
      return res.status(400).json({ error: 'messageId and response are required' });
    }

    console.log(`InspectionCommunicationRoutes: POST /${orderId}/feedback-response - Recording feedback response`);

    const communication = await InspectionCommunicationService.respondToFeedback(
      orderId,
      messageId,
      response,
      req.user._id,
      req.user.name || req.user.email
    );

    res.status(200).json({ communication });
  } catch (error) {
    console.error(`InspectionCommunicationRoutes: Error responding to feedback: ${error}`);
    res.status(500).json({ error: error.message });
  }
});

// Description: Create a quick action
// Endpoint: POST /api/inspection-communication/:orderId/quick-action
// Request: { inspectionId: string, actionType: string, description?: string, metadata?: object }
// Response: { communication: Object }
router.post('/:orderId/quick-action', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { inspectionId, actionType, description, metadata } = req.body;

    if (!actionType) {
      return res.status(400).json({ error: 'actionType is required' });
    }

    const validActions = ['part_replacement', 'incorrect_device', 'incorrect_unlock_code', 'additional_costs'];
    if (!validActions.includes(actionType)) {
      return res.status(400).json({ error: `Invalid action type. Must be one of: ${validActions.join(', ')}` });
    }

    console.log(`InspectionCommunicationRoutes: POST /${orderId}/quick-action - Creating quick action ${actionType}`);

    const communication = await InspectionCommunicationService.createQuickAction(
      orderId,
      inspectionId,
      req.user._id,
      req.user.name || req.user.email,
      actionType,
      description,
      metadata,
      req.user.role
    );

    res.status(201).json({ communication });
  } catch (error) {
    console.error(`InspectionCommunicationRoutes: Error creating quick action: ${error}`);
    res.status(500).json({ error: error.message });
  }
});

// Description: Complete a quick action
// Endpoint: PUT /api/inspection-communication/:orderId/quick-action/:messageId/complete
// Request: {}
// Response: { communication: Object }
router.put('/:orderId/quick-action/:messageId/complete', requireUser, async (req, res) => {
  try {
    const { orderId, messageId } = req.params;

    console.log(`InspectionCommunicationRoutes: PUT /${orderId}/quick-action/${messageId}/complete - Completing quick action`);

    const communication = await InspectionCommunicationService.completeQuickAction(orderId, messageId);

    res.status(200).json({ communication });
  } catch (error) {
    console.error(`InspectionCommunicationRoutes: Error completing quick action: ${error}`);
    res.status(500).json({ error: error.message });
  }
});

// Description: Mark all messages as read
// Endpoint: PUT /api/inspection-communication/:orderId/mark-read
// Request: {}
// Response: { communication: Object }
router.put('/:orderId/mark-read', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log(`InspectionCommunicationRoutes: PUT /${orderId}/mark-read - Marking messages as read`);

    const communication = await InspectionCommunicationService.markMessagesAsRead(orderId, req.user._id);

    res.status(200).json({ communication });
  } catch (error) {
    console.error(`InspectionCommunicationRoutes: Error marking messages as read: ${error}`);
    res.status(500).json({ error: error.message });
  }
});

// Description: Get pending feedback count
// Endpoint: GET /api/inspection-communication/:orderId/pending-feedback
// Request: {}
// Response: { count: number }
router.get('/:orderId/pending-feedback', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params;

    const count = await InspectionCommunicationService.getPendingFeedbackCount(orderId);

    res.status(200).json({ count });
  } catch (error) {
    console.error(`InspectionCommunicationRoutes: Error getting pending feedback count: ${error}`);
    res.status(500).json({ error: error.message });
  }
});

// Description: Get pending actions count
// Endpoint: GET /api/inspection-communication/:orderId/pending-actions
// Request: {}
// Response: { count: number }
router.get('/:orderId/pending-actions', requireUser, async (req, res) => {
  try {
    const { orderId } = req.params;

    const count = await InspectionCommunicationService.getPendingActionsCount(orderId);

    res.status(200).json({ count });
  } catch (error) {
    console.error(`InspectionCommunicationRoutes: Error getting pending actions count: ${error}`);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
