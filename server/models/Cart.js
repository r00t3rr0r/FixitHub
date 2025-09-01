const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
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

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [cartItemSchema],
  promoCode: {
    type: String,
    default: ''
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
  
  let subtotal = 0;
  let totalItems = 0;
  
  this.items.forEach(item => {
    if (item.productId && item.productId.price) {
      subtotal += item.productId.price * item.quantity;
      totalItems += item.quantity;
    }
  });
  
  this.subtotal = subtotal;
  this.totalItems = totalItems;
  
  // Calculate tax (8% for example)
  this.tax = subtotal * 0.08;
  
  // Apply discount
  const discountAmount = this.discount || 0;
  
  // Calculate total
  this.total = subtotal + this.tax - discountAmount;
  
  this.updatedAt = new Date();
  
  console.log('Cart pre-save: Calculated totals - subtotal:', this.subtotal, 'tax:', this.tax, 'total:', this.total);
  next();
});

// Index for better performance
cartSchema.index({ userId: 1 });
cartSchema.index({ sessionId: 1 });
cartSchema.index({ isActive: 1 });

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;