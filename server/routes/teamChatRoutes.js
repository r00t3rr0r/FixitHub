const express = require('express');
const TeamChatService = require('../services/teamChatService');
const { requireUser } = require('./middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/chat/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
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

// Middleware to check if user is staff or admin
const requireStaffOrAdmin = (req, res, next) => {
  if (!req.user || !['staff', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Staff or admin role required.' });
  }
  next();
};

// Get chat rooms for current user
router.get('/rooms', requireUser, requireStaffOrAdmin, async (req, res) => {
  console.log('Get chat rooms request from user:', req.user.email);

  try {
    const rooms = await TeamChatService.getChatRooms(req.user._id);
    return res.status(200).json({ rooms });
  } catch (error) {
    console.error('Error getting chat rooms:', error);
    return res.status(500).json({ error: error.message || 'Failed to get chat rooms' });
  }
});

// Get messages for a chat room
router.get('/rooms/:roomId/messages', requireUser, requireStaffOrAdmin, async (req, res) => {
  console.log('Get room messages request:', req.params.roomId);

  try {
    const filters = {
      page: req.query.page,
      limit: req.query.limit
    };

    const result = await TeamChatService.getRoomMessages(req.params.roomId, req.user._id, filters);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting room messages:', error);
    if (error.message === 'Chat room not found or access denied') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Failed to get messages' });
  }
});

// Send message to chat room
router.post('/rooms/:roomId/messages', requireUser, requireStaffOrAdmin, upload.array('attachments', 5), async (req, res) => {
  console.log('Send message request to room:', req.params.roomId);

  try {
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Process attachments
    const attachments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        attachments.push({
          name: file.originalname,
          url: `/uploads/chat/${file.filename}`,
          type: file.mimetype.startsWith('image/') ? 'image' : 'document',
          size: file.size
        });
      });
    }

    const message = await TeamChatService.sendMessage(
      req.params.roomId,
      req.user._id,
      content,
      attachments
    );

    return res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('Error sending message:', error);
    if (error.message === 'Chat room not found or access denied') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

// Create new chat room
router.post('/rooms', requireUser, requireStaffOrAdmin, async (req, res) => {
  console.log('Create chat room request from user:', req.user.email);

  try {
    const room = await TeamChatService.createChatRoom(req.body, req.user._id);
    return res.status(201).json({ success: true, room });
  } catch (error) {
    console.error('Error creating chat room:', error);
    return res.status(400).json({ error: error.message || 'Failed to create chat room' });
  }
});

// Mark messages as read
router.put('/rooms/:roomId/read', requireUser, requireStaffOrAdmin, async (req, res) => {
  console.log('Mark messages as read request for room:', req.params.roomId);

  try {
    const result = await TeamChatService.markMessagesAsRead(req.params.roomId, req.user._id);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return res.status(500).json({ error: error.message || 'Failed to mark messages as read' });
  }
});

module.exports = router;