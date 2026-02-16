const mongoose = require('mongoose');

// Schema for feedback request that requires customer action
const feedbackRequestSchema = new mongoose.Schema({
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
    type: String,
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
    enum: ['parts_needed', 'approval_required', 'additional_cost', 'status_update', 'schedule_appointment'],
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
    name: String,
    email: String,
    avatar: String,
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
    enum: ['text', 'feedback_request', 'quick_action', 'system_notification'],
    default: 'text',
  },
  content: {
    type: String,
    required: true,
  },
  feedbackRequest: feedbackRequestSchema,
  quickAction: quickActionSchema,
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

const RepairRequestCommunicationSchema = new mongoose.Schema({
  repairRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RepairRequest',
    required: true,
    unique: true,
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
RepairRequestCommunicationSchema.index({ repairRequestId: 1, createdAt: -1 });

module.exports = mongoose.model('RepairRequestCommunication', RepairRequestCommunicationSchema);
