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
    unique: true,
    required: true
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

// Generate order number before saving
ePartOrderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    const count = await mongoose.model('EPartOrder').countDocuments();
    this.orderNumber = `EPO-${String(count + 1).padStart(6, '0')}`;
  }
  next();
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

module.exports = { Supplier, EPartOrder };
