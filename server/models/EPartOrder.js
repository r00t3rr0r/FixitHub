const mongoose = require('mongoose');

// Supplier Schema
const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  contactPerson: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  website: {
    type: String,
    trim: true
  },
  ustId: {
    type: String,
    trim: true
  },
  paymentInformation: {
    iban: String,
    bic: String,
    bankName: String,
    accountHolder: String
  },
  paymentTerms: {
    type: String,
    trim: true
  },
  leadTime: {
    type: Number,
    default: 7
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  notes: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Order Item Schema
const orderItemSchema = new mongoose.Schema({
  partId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true
  },
  partName: {
    type: String,
    required: true
  },
  sku: {
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
  priceType: {
    type: String,
    enum: ['net', 'gross'],
    default: 'net'
  },
  shippingCost: {
    type: Number,
    default: 0,
    min: 0
  },
  additionalCost: {
    type: Number,
    default: 0,
    min: 0
  },
  shippingShare: {
    type: Number,
    default: 0,
    min: 0
  },
  adjustedLineTotal: {
    type: Number,
    default: 0,
    min: 0
  },
  adjustedUnitPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  receivedQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'partial', 'received', 'cancelled'],
    default: 'pending'
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: false
  }
});

// Timeline Entry Schema
const timelineEntrySchema = new mongoose.Schema({
  status: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  completedAt: {
    type: Date,
    default: Date.now
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  userName: {
    type: String
  },
  notes: {
    type: String
  }
});

// EPart Order Schema
const ePartOrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true
    // Note: Auto-generated in pre-save hook, so not marked as required
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  items: [orderItemSchema],
  status: {
    type: String,
    enum: ['draft', 'pending', 'confirmed', 'shipped', 'partial', 'received', 'cancelled'],
    default: 'draft'
  },
  orderDate: {
    type: Date,
    default: Date.now
  },
  expectedDeliveryDate: {
    type: Date
  },
  actualDeliveryDate: {
    type: Date
  },
  subtotal: {
    type: Number,
    required: true,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  shippingCost: {
    type: Number,
    default: 0
  },
  totalCost: {
    type: Number,
    required: true,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid'
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'bank_transfer', 'check', 'cash', 'account'],
    default: 'account'
  },
  trackingNumber: {
    type: String,
    trim: true
  },
  invoiceFile: {
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    uploadedAt: Date,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  returnExchange: {
    status: {
      type: String,
      enum: ['none', 'requested', 'approved', 'in_transit', 'completed', 'rejected'],
      default: 'none'
    },
    type: {
      type: String,
      enum: ['return', 'exchange']
    },
    reason: String,
    description: String,
    requestedAt: Date,
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    affectedItems: [{
      itemId: {
        type: mongoose.Schema.Types.ObjectId
      },
      quantity: Number,
      issueDescription: String
    }],
    notes: String
  },
  notes: {
    type: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  timeline: [timelineEntrySchema]
}, {
  timestamps: true
});

// Bestellnummern (Format unveraendert EPO-NNNNNN) kommen aus dem atomaren
// DocumentSequence-Zaehler {documentType:'epart_order', year:0}. Frueher:
// countDocuments()+1 -> doppelte Nummern (E11000) bei parallelen Bestellungen.
const EPART_ORDER_SEQUENCE_TYPE = 'epart_order';
const EPART_ORDER_SEQUENCE_YEAR = 0;
const EPART_ORDER_NUMBER_PATTERN = /^EPO-(\d+)$/;

function formatEPartOrderNumber(sequence) {
  return `EPO-${String(sequence).padStart(6, '0')}`;
}

// Hoechste bereits vergebene EPO-Nummer (fuer Seed/Selbstheilung des Zaehlers).
async function findMaxExistingEPartOrderSequence(EPartOrderModel) {
  const rows = await EPartOrderModel.find(
    { orderNumber: { $regex: '^EPO-\\d+$' } },
    { orderNumber: 1 }
  ).lean();
  return rows.reduce((max, row) => {
    const match = EPART_ORDER_NUMBER_PATTERN.exec(String(row.orderNumber || ''));
    const value = match ? Number(match[1]) : 0;
    return Number.isFinite(value) && value > max ? value : max;
  }, 0);
}

// Hebt den Zaehler (nie absenken) auf die hoechste vorhandene Nummer an. Idempotent.
// Wird vor jeder Vergabe einmal pro Prozess ausgefuehrt, damit ein vergessener Seed
// keine Kollision mit Altbestaenden erzeugt. Der Seed-Schritt in
// scripts/seedDocumentSequences.js macht dasselbe explizit (Dry-Run per Default).
let epartCounterAligned = null;
async function alignEPartOrderCounter(EPartOrderModel) {
  const DocumentSequence = require('./DocumentSequence');
  const maxExisting = await findMaxExistingEPartOrderSequence(EPartOrderModel);
  if (maxExisting > 0) {
    try {
      await DocumentSequence.findOneAndUpdate(
        { documentType: EPART_ORDER_SEQUENCE_TYPE, year: EPART_ORDER_SEQUENCE_YEAR },
        { $max: { sequence: maxExisting }, $set: { updatedAt: new Date() } },
        { upsert: true, new: true }
      );
    } catch (error) {
      if (error?.code !== 11000) throw error;
      // Paralleler Upsert hat den Zaehler angelegt -> erneut anheben.
      await DocumentSequence.updateOne(
        { documentType: EPART_ORDER_SEQUENCE_TYPE, year: EPART_ORDER_SEQUENCE_YEAR },
        { $max: { sequence: maxExisting } }
      );
    }
  }
  return maxExisting;
}

async function allocateEPartOrderNumber(EPartOrderModel) {
  const DocumentSequence = require('./DocumentSequence');
  if (!epartCounterAligned) {
    epartCounterAligned = alignEPartOrderCounter(EPartOrderModel).catch((error) => {
      epartCounterAligned = null;
      throw error;
    });
  }
  await epartCounterAligned;
  const sequence = await DocumentSequence.allocate(EPART_ORDER_SEQUENCE_TYPE, EPART_ORDER_SEQUENCE_YEAR);
  return formatEPartOrderNumber(sequence);
}

// Generate order number before saving
ePartOrderSchema.pre('save', async function(next) {
  try {
    if (this.isNew && !this.orderNumber) {
      this.orderNumber = await allocateEPartOrderNumber(mongoose.model('EPartOrder'));
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Create indexes for faster queries
supplierSchema.index({ name: 1, isActive: 1 });
supplierSchema.index({ email: 1 });
// orderNumber already has unique: true index, no need for duplicate
ePartOrderSchema.index({ supplierId: 1, status: 1 });
ePartOrderSchema.index({ createdBy: 1 });
ePartOrderSchema.index({ orderDate: 1 });

const Supplier = mongoose.model('Supplier', supplierSchema);
const EPartOrder = mongoose.model('EPartOrder', ePartOrderSchema);

module.exports = {
  Supplier,
  EPartOrder,
  EPART_ORDER_SEQUENCE_TYPE,
  EPART_ORDER_SEQUENCE_YEAR,
  formatEPartOrderNumber,
  findMaxExistingEPartOrderSequence,
};
