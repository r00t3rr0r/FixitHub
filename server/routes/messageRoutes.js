const express = require('express');
const MessageService = require('../services/messageService');
const { requireUser } = require('./middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/messages/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow images and documents
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and documents are allowed'));
    }
  }
});

// Get all conversations for current user
router.get('/conversations', requireUser, async (req, res) => {
  console.log('Get conversations request from user:', req.user.email);

  try {
    const filters = {
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search
    };

    const result = await MessageService.getConversations(req.user._id, filters);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting conversations:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get conversations'
    });
  }
});

// Get messages for a specific conversation
router.get('/conversations/:conversationId', requireUser, async (req, res) => {
  console.log('Get conversation messages request:', req.params.conversationId);

  try {
    const filters = {
      page: req.query.page,
      limit: req.query.limit
    };

    const result = await MessageService.getConversationMessages(
      req.params.conversationId,
      req.user._id,
      filters
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting conversation messages:', error);
    if (error.message === 'Conversation not found or access denied') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to get messages'
    });
  }
});

// Send a message to a conversation
router.post('/conversations/:conversationId/messages', requireUser, upload.array('attachments', 5), async (req, res) => {
  console.log('Send message request to conversation:', req.params.conversationId);

  try {
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({
        error: 'Message content is required'
      });
    }

    // Process attachments
    const attachments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        attachments.push({
          name: file.originalname,
          url: `/uploads/messages/${file.filename}`,
          type: file.mimetype.startsWith('image/') ? 'image' : 'document',
          size: file.size
        });
      });
    }

    const message = await MessageService.sendMessage(
      req.params.conversationId,
      req.user._id,
      content,
      attachments
    );

    return res.status(201).json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Error sending message:', error);
    if (error.message === 'Conversation not found or access denied') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to send message'
    });
  }
});

// Mark messages as read
router.put('/conversations/:conversationId/read', requireUser, async (req, res) => {
  console.log('Mark messages as read request for conversation:', req.params.conversationId);

  try {
    const { messageIds } = req.body;

    const result = await MessageService.markMessagesAsRead(
      req.params.conversationId,
      req.user._id,
      messageIds
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error marking messages as read:', error);
    if (error.message === 'Conversation not found or access denied') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to mark messages as read'
    });
  }
});

// Start a new conversation for an order
router.post('/conversations', requireUser, async (req, res) => {
  console.log('Start conversation request from user:', req.user.email);

  try {
    const { orderId, initialMessage } = req.body;

    if (!orderId) {
      return res.status(400).json({
        error: 'Order ID is required'
      });
    }

    const result = await MessageService.startConversation(
      orderId,
      req.user._id,
      initialMessage
    );

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error starting conversation:', error);
    if (error.message === 'Conversation already exists for this order') {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message || 'Failed to start conversation'
    });
  }
});

module.exports = router;