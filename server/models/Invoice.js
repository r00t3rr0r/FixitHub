const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  type: {
    type: String,
    enum: ['service', 'addon', 'product', 'fee'],
    required: true
  }
}, { _id: true });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    unique: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
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
  customerEmail: {
    type: String,
    required: true
  },
  items: [invoiceItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  },
  dueDate: {
    type: Date,
    required: true
  },
  sentAt: {
    type: Date
  },
  paidAt: {
    type: Date
  },
  notes: {
    type: String,
    default: ''
  },
  template: {
    type: String,
    default: 'standard'
  },
  paymentTerms: {
    type: String,
    default: 'Net 30'
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

// Generate invoice number before saving
invoiceSchema.pre('save', async function(next) {
  if (this.isNew && !this.invoiceNumber) {
    try {
      const year = new Date().getFullYear();
      const count = await this.constructor.countDocuments();
      this.invoiceNumber = `INV-${year}-${String(count + 1).padStart(3, '0')}`;
    } catch (error) {
      console.error('Error generating invoice number:', error);
      this.invoiceNumber = `INV-${Date.now()}`;
    }
  }
  this.updatedAt = new Date();
  next();
});

// Calculate totals before saving
invoiceSchema.pre('save', function(next) {
  if (this.items && this.items.length > 0) {
    this.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
    this.total = this.subtotal + this.tax - this.discount;
  }
  next();
});

// Populate customer and order info
invoiceSchema.pre(/^find/, function(next) {
  this.populate('customerId', 'name email')
      .populate('orderId', 'orderNumber deviceBrand deviceModel');
  next();
});

// Index for efficient queries
invoiceSchema.index({ customerId: 1, createdAt: -1 });
invoiceSchema.index({ status: 1 });
// invoiceNumber already has unique: true index, no need for duplicate
invoiceSchema.index({ dueDate: 1 });

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;