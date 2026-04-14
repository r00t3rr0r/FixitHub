const mongoose = require('mongoose');

const contactMessageReplySchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true,
    default: () => new mongoose.Types.ObjectId(),
  },
  repliedBy: {
    type: String,
    required: true, // Admin name
  },
  repliedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  subject: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  htmlContent: {
    type: String,
  },
  templateName: {
    type: String, // For tracking which template was used
  },
  variables: {
    type: mongoose.Schema.Types.Mixed, // Stores template variables used
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'failed'],
    default: 'sent',
  },
  sentAt: {
    type: Date,
  },
  messageId: {
    type: String, // Nodemailer message ID
  },
  error: {
    type: String,
  },
}, { _id: true, timestamps: false });

const contactMessageSchema = new mongoose.Schema({
  // Message Number
  messageNumber: {
    type: String,
    required: true,
    unique: true,
  },

  // Sender Information
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
  },
  phone: {
    type: String,
    default: '',
  },

  // Message Details
  subject: {
    type: String,
    enum: ['repair', 'status', 'business', 'complaint', 'other'],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },

  // Additional Information
  orderNumber: {
    type: String,
    default: '',
  },

  // IP & User Agent (for spam detection)
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },

  // Status
  status: {
    type: String,
    enum: ['new', 'read', 'replied', 'closed'],
    default: 'new',
  },
  isSpam: {
    type: Boolean,
    default: false,
  },

  // Replies
  replies: [contactMessageReplySchema],

  // Metadata
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
  timestamps: true,
});

// Indexes for efficient queries
contactMessageSchema.index({ email: 1 });
contactMessageSchema.index({ status: 1 });
contactMessageSchema.index({ createdAt: -1 });
contactMessageSchema.index({ messageNumber: 1 });

const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema);

module.exports = ContactMessage;
