const mongoose = require('mongoose');

const affiliateCommissionSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomerGroup',
  },
  affiliateId: {
    type: String,
    default: '',
  },
  attributionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AffiliateAttribution',
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  },
  commissionType: {
    type: String,
    enum: ['fixed', 'percentage'],
    default: 'percentage',
  },
  commissionValue: {
    type: Number,
    default: 0,
    min: 0,
  },
  baseAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  computedAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: ['pending', 'locked', 'approved', 'released', 'cancelled', 'reversed'],
    default: 'pending',
  },
  releaseTrigger: {
    type: String,
    enum: ['order_created', 'order_completed', 'invoice_created', 'invoice_paid'],
    default: 'invoice_paid',
  },
  triggerReachedAt: Date,
  holdUntil: Date,
  releasedAt: Date,
  reversalReason: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.models.AffiliateCommission || mongoose.model('AffiliateCommission', affiliateCommissionSchema);