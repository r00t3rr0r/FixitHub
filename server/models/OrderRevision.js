const mongoose = require('mongoose');

const orderRevisionSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  revisionNumber: {
    type: Number,
    required: true
  },
  triggerReason: {
    type: String,
    enum: [
      'initial_creation',
      'diagnostic_addition',
      'scope_change',
      'addon_added',
      'addon_updated',
      'addon_removed',
      'service_updated',
      'device_change',
      'price_adjustment',
      'discount_applied',
      'manual_edit'
    ],
    default: 'manual_edit'
  },
  previousGrossAmount: {
    type: Number,
    required: true,
    default: 0
  },
  newGrossAmount: {
    type: Number,
    required: true
  },
  deltaGrossAmount: {
    type: Number,
    required: true,
    default: 0
  },
  snapshotItems: {
    type: Array,
    default: []
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  changedByName: {
    type: String,
    default: 'System'
  },
  notes: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  versionKey: false
});

orderRevisionSchema.index({ orderId: 1, revisionNumber: 1 }, { unique: true });

module.exports = mongoose.model('OrderRevision', orderRevisionSchema);
