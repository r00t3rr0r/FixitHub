const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  orderNumber: {
    type: String,
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'CAD']
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'disputed'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'paypal', 'stripe', 'bank_transfer'],
    required: true
  },
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  gatewayResponse: {
    type: String,
    default: ''
  },
  processedAt: {
    type: Date
  },
  refundedAt: {
    type: Date
  },
  refundAmount: {
    type: Number,
    min: 0
  },
  refundReason: {
    type: String
  },
  disputeReason: {
    type: String
  },
  disputeStatus: {
    type: String,
    enum: ['open', 'under_review', 'resolved', 'closed']
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
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

// Update timestamp on save
paymentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Generate transaction ID if not provided
paymentSchema.pre('save', function(next) {
  if (this.isNew && !this.transactionId) {
    this.transactionId = 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  next();
});

// Populate customer and order info
paymentSchema.pre(/^find/, function(next) {
  this.populate('customerId', 'name email')
      .populate('orderId', 'orderNumber deviceBrand deviceModel');
  next();
});

// Index for efficient queries
paymentSchema.index({ customerId: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });
// transactionId already has unique: true index, no need for duplicate
paymentSchema.index({ orderNumber: 1 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;