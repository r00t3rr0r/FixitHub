const express = require('express');
const router = express.Router();
const ContactMessageService = require('../services/contactMessageService');
const { requireUser } = require('./middleware/auth');

// Middleware to ensure admin access
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Nur Administratoren haben Zugang zu dieser Ressource.',
    });
  }
  next();
};

/**
 * GET /api/admin/contact-messages
 * Get all contact messages with filters
 */
router.get('/', requireUser, requireAdmin, async (req, res) => {
  try {
    const {
      status,
      search,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

    const filters = {
      status: status || '',
      search: search || '',
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc',
    };

    const result = await ContactMessageService.getContactMessages(filters);

    res.status(200).json(result);
  } catch (error) {
    console.error('AdminContactRoutes: Error fetching messages:', error);
    res.status(500).json({
      error: error.message || 'Fehler beim Abrufen von Kontaktanfragen.',
    });
  }
});

/**
 * GET /api/admin/contact-messages/stats
 * Get contact message statistics
 */
router.get('/stats', requireUser, requireAdmin, async (req, res) => {
  try {
    const stats = await ContactMessageService.getContactMessageStats();
    res.status(200).json(stats);
  } catch (error) {
    console.error('AdminContactRoutes: Error fetching stats:', error);
    res.status(500).json({
      error: error.message || 'Fehler beim Abrufen von Statistiken.',
    });
  }
});

/**
 * GET /api/admin/contact-messages/:messageId
 * Get single contact message by ID
 */
router.get('/:messageId', requireUser, requireAdmin, async (req, res) => {
  try {
    const message = await ContactMessageService.getContactMessageById(req.params.messageId);
    
    // Mark as read
    if (message.status === 'new') {
      await ContactMessageService.updateMessageStatus(req.params.messageId, 'read');
      message.status = 'read';
    }

    res.status(200).json(message);
  } catch (error) {
    console.error('AdminContactRoutes: Error fetching message:', error);
    res.status(404).json({
      error: error.message || 'Kontaktanfrage nicht gefunden.',
    });
  }
});

/**
 * PUT /api/admin/contact-messages/:messageId/status
 * Update message status
 */
router.put('/:messageId/status', requireUser, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['new', 'read', 'replied', 'closed'].includes(status)) {
      return res.status(400).json({
        error: 'Ungültiger Status.',
      });
    }

    const message = await ContactMessageService.updateMessageStatus(
      req.params.messageId,
      status
    );

    res.status(200).json(message);
  } catch (error) {
    console.error('AdminContactRoutes: Error updating status:', error);
    res.status(500).json({
      error: error.message || 'Fehler beim Aktualisieren des Status.',
    });
  }
});

/**
 * POST /api/admin/contact-messages/:messageId/reply
 * Send reply to contact message
 */
router.post('/:messageId/reply', requireUser, requireAdmin, async (req, res) => {
  try {
    const {
      subject,
      message,
      htmlContent,
      templateName,
      variables,
      draft,
    } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Bitte geben Sie eine Antwortnachricht ein.',
      });
    }

    const replyData = {
      subject: subject || `Re: Kontaktanfrage`,
      message,
      htmlContent,
      repliedBy: `${req.user.firstName || ''} ${req.user.lastName || req.user.email}`.trim(),
      templateName,
      variables,
    };

    let result;
    if (draft) {
      result = await ContactMessageService.saveDraftReply(
        req.params.messageId,
        replyData
      );
    } else {
      result = await ContactMessageService.sendReply(
        req.params.messageId,
        replyData
      );
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('AdminContactRoutes: Error sending reply:', error);
    res.status(500).json({
      error: error.message || 'Fehler beim Senden der Antwort.',
    });
  }
});

/**
 * DELETE /api/admin/contact-messages/:messageId
 * Delete contact message
 */
router.delete('/:messageId', requireUser, requireAdmin, async (req, res) => {
  try {
    const message = await ContactMessageService.deleteMessage(req.params.messageId);
    res.status(200).json({
      success: true,
      message: 'Kontaktanfrage gelöscht.',
      deletedMessage: message,
    });
  } catch (error) {
    console.error('AdminContactRoutes: Error deleting message:', error);
    res.status(500).json({
      error: error.message || 'Fehler beim Löschen der Kontaktanfrage.',
    });
  }
});

module.exports = router;
