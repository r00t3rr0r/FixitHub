const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

// Schema for repair order items in cart
const repairOrderItemSchema = new mongoose.Schema({
  deviceType: {
    type: String,
    required: true
  },
  deviceBrand: {
    type: String,
    required: true
  },
  deviceModel: {
    type: String,
    required: true
  },
  deviceImage: {
    type: String,
    default: ''
  },
  services: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  }],
  serviceNames: [{
    type: String
  }],
  addOns: [{
    name: String,
    description: String,
    price: Number,
    estimatedTime: String
  }],
  customerNotes: {
    type: String,
    default: ''
  },
  photos: [{
    type: String
  }],
  totalCost: {
    type: Number,
    required: true,
    min: 0
  },
  // Device unlock information
  unlockPattern: {
    type: [String],
    default: []
  },
  unlockCode: {
    type: String,
    default: ''
  },
  noLock: {
    type: Boolean,
    default: false
  },
  // Additional repair information
  errorDescription: {
    type: String,
    default: ''
  },
  waterDamage: {
    type: String,
    enum: ['yes', 'no', 'dont-know', 'unsure', ''],
    default: ''
  },
  previousRepairAttempts: {
    type: String,
    enum: ['yes', 'no', 'dont-know', 'unsure', ''],
    default: ''
  },
  previousRepairDetails: {
    type: String,
    default: ''
  },
  itemCondition: {
    type: String,
    enum: ['original', 'refurbished', 'unsure', ''],
    default: ''
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [cartItemSchema],
  repairOrders: [repairOrderItemSchema],
  promoCode: {
    type: String,
    default: ''
  },
  promoCodeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PromoCode',
    default: null,
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed_amount', ''],
    default: '',
  },
  discountValue: {
    type: Number,
    default: 0,
    min: 0,
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  subtotal: {
    type: Number,
    default: 0,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    default: 0,
    min: 0
  },
  totalItems: {
    type: Number,
    default: 0,
    min: 0
  },
  sessionId: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
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

// Calculate totals before saving
cartSchema.pre('save', async function(next) {
  console.log('Cart pre-save: Calculating totals');

  // Populate product details to calculate totals
  await this.populate('items.productId');
  await this.populate('repairOrders.services');

  let subtotal = 0;
  let totalItems = 0;

  // Calculate subtotal from product items
  this.items.forEach(item => {
    if (item.productId && item.productId.price) {
      subtotal += item.productId.price * item.quantity;
      totalItems += item.quantity;
    }
  });

  // Calculate subtotal from repair orders
  this.repairOrders.forEach(order => {
    subtotal += order.totalCost;
    totalItems += 1;
  });

  this.subtotal = Number(subtotal.toFixed(2));
  this.totalItems = totalItems;

  // Apply discount
  const discountAmount = Number(this.discount || 0);
  const subtotalAfterDiscount = Math.max(0, this.subtotal - discountAmount);

  // Prices are already gross (brutto) — extract the VAT component, do NOT add on top
  // VAT extraction: tax = gross * (19/119)
  this.tax = Number((subtotalAfterDiscount * (19 / 119)).toFixed(2));

  // Total equals the gross price (VAT already included)
  this.total = Number(subtotalAfterDiscount.toFixed(2));

  this.updatedAt = new Date();

  console.log('Cart pre-save: Calculated totals - subtotal:', this.subtotal, 'discount:', discountAmount, 'tax:', this.tax, 'total:', this.total, 'repair orders:', this.repairOrders.length);
  next();
});

// Index for better performance
cartSchema.index({ userId: 1 });
cartSchema.index({ sessionId: 1 });
cartSchema.index({ isActive: 1 });

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;