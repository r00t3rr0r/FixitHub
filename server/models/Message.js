const mongoose = require('mongoose');

const messageAttachmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['image', 'document', 'video'],
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
}, { _id: true });

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  senderName: {
    type: String,
    required: true,
  },
  senderRole: {
    type: String,
    enum: ['customer', 'staff', 'admin'],
    required: true,
  },
  senderAvatar: {
    type: String,
    default: '',
  },
  content: {
    type: String,
    required: true,
  },
  attachments: [messageAttachmentSchema],
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text',
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  versionKey: false,
  timestamps: { createdAt: true, updatedAt: false }
});

// Index for efficient queries
messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ senderId: 1 });

// Populate sender information when querying
messageSchema.pre(/^find/, function(next) {
  this.populate('senderId', 'name avatar role');
  next();
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;