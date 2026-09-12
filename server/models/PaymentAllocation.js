const mongoose = require('mongoose');

const paymentAllocationSchema = new mongoose.Schema({
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true,
    index: true
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true,
    index: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    index: true
  },
  allocatedAmount: {
    type: Number,
    required: true,
    min: 0.01
  },
  allocatedAt: {
    type: Date,
    default: Date.now
  },
  note: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  versionKey: false
});

module.exports = mongoose.model('PaymentAllocation', paymentAllocationSchema);
