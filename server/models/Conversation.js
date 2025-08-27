const mongoose = require('mongoose');

const conversationParticipantSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['customer', 'staff', 'admin'],
    required: true,
  },
  avatar: {
    type: String,
    default: '',
  },
  isOnline: {
    type: Boolean,
    default: false,
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  },
  orderNumber: {
    type: String,
    required: true,
  },
  deviceInfo: {
    type: String,
    required: true,
  },
  participants: [conversationParticipantSchema],
  lastMessageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
  status: {
    type: String,
    enum: ['active', 'closed'],
    default: 'active',
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
  versionKey: false,
});

// Index for efficient queries
conversationSchema.index({ orderId: 1 });
conversationSchema.index({ 'participants.userId': 1 });

// Update timestamp on save
conversationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Populate order and last message when querying
conversationSchema.pre(/^find/, function(next) {
  this.populate('orderId', 'orderNumber deviceBrand deviceModel services')
      .populate('lastMessageId');
  next();
});

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;