const mongoose = require('mongoose');

// Schema for feedback request that requires customer action
const feedbackRequestSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['agreement', 'confirmation', 'selection'],
    required: true,
  },
  question: {
    type: String,
    required: true,
  },
  options: [{
    label: String,
    value: String,
  }],
  response: {
    label: String,
    value: String,
  },
  respondedAt: {
    type: Date,
  },
  respondedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  status: {
    type: String,
    enum: ['pending', 'responded', 'expired'],
    default: 'pending',
  },
  expiresAt: {
    type: Date,
  },
}, { _id: true });

// Schema for quick action items
const quickActionSchema = new mongoose.Schema({
  actionType: {
    type: String,
    enum: ['part_replacement', 'incorrect_device', 'incorrect_unlock_code', 'additional_costs'],
    required: true,
  },
  actionLabel: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'pending',
  },
}, { _id: true });

// Schema for communication message
const communicationMessageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  senderType: {
    type: String,
    enum: ['staff', 'customer', 'system'],
    default: 'staff',
  },
  senderName: {
    type: String,
    required: true,
  },
  senderRole: {
    type: String,
  },
  messageType: {
    type: String,
    enum: ['text', 'feedback_request', 'quick_action', 'system_notification', 'repair_offer'],
    default: 'text',
  },
  content: {
    type: String,
    required: true,
  },
  feedbackRequest: feedbackRequestSchema,
  quickAction: quickActionSchema,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  }],
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileType: String,
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

const InspectionCommunicationSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  },
  inspectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeviceInspection',
  },
  createdBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    role: String,
  },
  messages: [communicationMessageSchema],
  status: {
    type: String,
    enum: ['active', 'archived', 'resolved'],
    default: 'active',
  },
  pendingFeedbackCount: {
    type: Number,
    default: 0,
  },
  pendingActionsCount: {
    type: Number,
    default: 0,
  },
  lastMessageAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index for efficient queries
InspectionCommunicationSchema.index({ orderId: 1, createdAt: -1 });
InspectionCommunicationSchema.index({ inspectionId: 1, createdAt: -1 });

module.exports = mongoose.model('InspectionCommunication', InspectionCommunicationSchema);
