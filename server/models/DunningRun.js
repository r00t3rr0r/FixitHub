const mongoose = require('mongoose');

const dunningRunItemSchema = new mongoose.Schema({
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true
  },
  invoiceNumber: {
    type: String,
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  customerEmail: {
    type: String
  },
  dueDate: {
    type: Date
  },
  amountOpen: {
    type: Number,
    default: 0
  },
  dunningLevel: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'sent', 'escalated', 'skipped', 'failed'],
    default: 'pending'
  },
  note: {
    type: String,
    default: ''
  },
  lastActionAt: {
    type: Date
  },
  lastActionBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { _id: false });

const dunningRunLogSchema = new mongoose.Schema({
  at: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['created', 'started', 'paused', 'resumed', 'completed', 'cancelled', 'item_update', 'note', 'system'],
    default: 'system'
  },
  message: {
    type: String,
    required: true
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { _id: false });

const dunningRunSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['draft', 'running', 'paused', 'completed', 'cancelled'],
    default: 'draft'
  },
  defaultStatus: {
    type: String,
    enum: ['draft', 'pending_approval', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled', 'credited'],
    default: 'overdue'
  },
  defaultNote: {
    type: String,
    default: ''
  },
  items: {
    type: [dunningRunItemSchema],
    default: []
  },
  logs: {
    type: [dunningRunLogSchema],
    default: []
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  versionKey: false
});

dunningRunSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

dunningRunSchema.index({ createdAt: -1 });
dunningRunSchema.index({ status: 1 });
dunningRunSchema.index({ 'items.invoiceId': 1 });

module.exports = mongoose.model('DunningRun', dunningRunSchema);
