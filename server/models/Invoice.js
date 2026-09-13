const mongoose = require('mongoose');
const CalculationHelper = require('../services/calculationHelper');

const invoiceItemSchema = new mongoose.Schema({
  serviceName: {
    type: String,
    trim: true
  },
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
  unitGrossPrice: {
    type: Number
  },
  unitNetPrice: {
    type: Number
  },
  lineGrossTotal: {
    type: Number
  },
  lineNetTotal: {
    type: Number
  },
  taxRate: {
    type: Number,
    default: 19
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
  correctionType: {
    type: String,
    enum: ['full_cancellation', 'partial_refund', 'price_adjustment', null],
    default: null
  },
  lockedAt: {
    type: Date
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
  // Rechnungssumme-Konzept (Finale Basis für MwSt-Berechnung)
  invoiceGrossTotal: {
    type: Number
  },
  invoiceNetTotal: {
    type: Number
  },
  invoiceTaxTotal: {
    type: Number
  },
  taxRate: {
    type: Number,
    default: 19
  },
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled', 'credited'],
    default: 'sent'
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
    max: 4
  },
  dunningStage: {
    type: String,
    enum: ['none', 'payment_reminder', 'dunning_notice', 'final_notice', 'collection'],
    default: 'none'
  },
  dunningNotifiedAt: {
    type: Date
  },
  originalDueDate: {
    type: Date
  },
  nextDunningDueDate: {
    type: Date
  },
  dunningHistory: [{
    stage: {
      type: String,
      enum: ['payment_reminder', 'dunning_notice', 'final_notice', 'collection'],
      required: true
    },
    executedAt: {
      type: Date,
      required: true
    },
    previousDueDate: Date,
    nextDueDate: Date,
    dunningRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DunningRun'
    },
    emailSentAt: Date,
    emailError: String
  }],
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
  isReverseCharge: {
    type: Boolean,
    default: false
  },
  reverseChargeNotice: {
    type: String,
    default: 'Steuerschuldnerschaft des Leistungsempfängers / Reverse Charge'
  },
  customerVatId: {
    type: String,
    default: '',
    trim: true
  },
  sellerVatId: {
    type: String,
    default: '',
    trim: true
  },
  zmRelevant: {
    type: Boolean,
    default: false
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
    const isReverseCharge = Boolean(this.isReverseCharge);
    if (isReverseCharge) {
      this.taxRate = 0;
      this.tax = 0;
      this.zmRelevant = true;
      if (!this.reverseChargeNotice) {
        this.reverseChargeNotice = 'Steuerschuldnerschaft des Leistungsempfängers / Reverse Charge';
      }
    }

    const hasExplicitTotal = Number.isFinite(Number(this.total));
    const discount = Number.isFinite(Number(this.discount)) ? Number(this.discount) : 0;
    const taxRate = isReverseCharge ? 0 : (Number.isFinite(Number(this.taxRate)) ? Number(this.taxRate) : 19);

    const calculated = CalculationHelper.calculateInvoiceTotals(this.items, {
      taxRatePercent: taxRate,
      additionalDiscount: discount,
      isReverseCharge
    });

    // Populate item calculations (unitNetPrice, unitGrossPrice, lineGrossTotal, lineNetTotal)
    this.items.forEach((item, index) => {
      const calcItem = calculated.items[index];
      if (calcItem) {
        if (!item.unitGrossPrice) item.unitGrossPrice = calcItem.unitGrossPrice;
        if (!item.unitNetPrice) item.unitNetPrice = calcItem.unitNetPrice;
        if (!item.lineGrossTotal) item.lineGrossTotal = calcItem.lineGrossTotal;
        if (!item.lineNetTotal) item.lineNetTotal = calcItem.lineNetTotal;
        if (!item.taxRate) item.taxRate = calcItem.taxRate;
      }
    });

    if (!hasExplicitTotal) {
      this.total = calculated.invoiceGrossTotal;
      this.subtotal = calculated.invoiceNetTotal;
      this.tax = calculated.invoiceTaxTotal;
    } else {
      // If total was explicitly set (e.g., custom override), recalculate Net & Tax from it
      const explicitGross = Number(this.total);
      const taxDivisor = 1 + (taxRate / 100);
      const explicitNet = CalculationHelper.round(explicitGross / taxDivisor);
      const explicitTax = isReverseCharge ? 0 : CalculationHelper.round(explicitGross - explicitNet);

      this.subtotal = Number.isFinite(Number(this.subtotal)) ? Number(this.subtotal) : explicitNet;
      this.tax = isReverseCharge ? 0 : (Number.isFinite(Number(this.tax)) ? Number(this.tax) : explicitTax);
    }

    this.invoiceGrossTotal = this.total;
    this.invoiceNetTotal = this.subtotal;
    this.invoiceTaxTotal = isReverseCharge ? 0 : this.tax;
  }
  next();
});

// Populate customer and order info
invoiceSchema.pre(/^find/, function(next) {
  this.populate('customerId', 'customerNumber invoiceAddress paymentAddress addressAddition country company firstName lastName name email vatId')
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