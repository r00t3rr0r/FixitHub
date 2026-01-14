const mongoose = require('mongoose');

const needListItemSchema = new mongoose.Schema({
  part: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true
  },
  partNumber: {
    type: String,
    required: true
  },
  partName: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  currentStock: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    default: ''
  }
}, { _id: true });

const needListSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  items: [needListItemSchema],
  status: {
    type: String,
    enum: ['draft', 'ready', 'ordered', 'archived'],
    default: 'draft'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  convertedToOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EPartOrder',
    default: null
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Indexes for efficient querying
needListSchema.index({ createdBy: 1, status: 1 });
needListSchema.index({ status: 1, priority: 1 });
needListSchema.index({ createdAt: -1 });

// Pre-save hook to update timestamps
needListSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const NeedList = mongoose.model('NeedList', needListSchema);

module.exports = NeedList;
