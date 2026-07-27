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
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['service', 'addon', 'product', 'fee', 'discount'],
    required: true
  }
}, { _id: true });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    unique: true
  },
  numberPrefix: {
    type: String,
    default: 'INV'
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  repairOrderIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  creditNoteOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  isCreditNote: {
    type: Boolean,
    default: false
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
  billingAddress: {
    street: {
      type: String,
      default: ''
    },
    city: {
      type: String,
      default: ''
    },
    state: {
      type: String,
      default: ''
    },
    zip: {
      type: String,
      default: ''
    },
    zipCode: {
      type: String,
      default: ''
    },
    country: {
      type: String,
      default: ''
    }
  },
  shippingAddress: {
    street: {
      type: String,
      default: ''
    },
    city: {
      type: String,
      default: ''
    },
    state: {
      type: String,
      default: ''
    },
    zip: {
      type: String,
      default: ''
    },
    zipCode: {
      type: String,
      default: ''
    },
    country: {
      type: String,
      default: ''
    }
  },
  items: [invoiceItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled', 'credited'],
    default: 'draft'
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  dunningLevel: {
    type: Number,
    default: 0,
    min: 0,
    max: 3
  },
  dunningNotifiedAt: {
    type: Date
  },
  dueDate: {
    type: Date,
    required: true
  },
  sentAt: {
    type: Date
  },
  approvedAt: {
    type: Date
  },
  paidAt: {
    type: Date
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'sepa', 'paypal', 'cash', null],
    default: null
  },
  cancelledAt: {
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

// Generate invoice number before saving (configurable prefix)
invoiceSchema.pre('save', async function(next) {
  if (this.isNew && !this.invoiceNumber) {
    try {
      const year = new Date().getFullYear();
      const prefix = this.isCreditNote
        ? (this.numberPrefix || 'INV') + '-CN'
        : (this.numberPrefix || 'INV');
      const count = await this.constructor.countDocuments();
      this.invoiceNumber = `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
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
    const itemsTotal = this.items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const hasSubtotal = Number.isFinite(Number(this.subtotal));
    const hasTax = Number.isFinite(Number(this.tax));
    const hasDiscount = Number.isFinite(Number(this.discount));
    const hasTotal = Number.isFinite(Number(this.total));

    // Keep explicit values from services/routes. Only derive missing fields.
    if (!hasSubtotal) {
      if (hasTotal) {
        this.subtotal = Number(this.total) - Number(this.tax || 0) + Number(this.discount || 0);
      } else {
        this.subtotal = itemsTotal;
      }
    }

    if (!hasTax) {
      this.tax = 0;
    }

    if (!hasDiscount) {
      this.discount = 0;
    }

    if (!hasTotal) {
      this.total = Number(this.subtotal || 0) + Number(this.tax || 0) - Number(this.discount || 0);
    }
  }
  next();
});

// Populate customer and order info
invoiceSchema.pre(/^find/, function(next) {
  this.populate('customerId', 'customerNumber invoiceAddress paymentAddress addressAddition country company firstName lastName name email')
      .populate('orderId', 'orderNumber deviceBrand deviceModel');
  next();
});

// Index for efficient queries
invoiceSchema.index({ customerId: 1, createdAt: -1 });
invoiceSchema.index({ bookingId: 1, createdAt: -1 });
invoiceSchema.index({ status: 1 });
// invoiceNumber already has unique: true index, no need for duplicate
invoiceSchema.index({ dueDate: 1 });

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;