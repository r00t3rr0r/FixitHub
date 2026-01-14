const mongoose = require('mongoose');

// Schema for booking timeline entries
const bookingTimelineSchema = new mongoose.Schema({
  status: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  completedAt: {
    type: Date,
    default: Date.now,
  },
  staffId: {
    type: String,
    default: 'system',
  },
  staffName: {
    type: String,
    default: 'System',
  },
}, { _id: true });

// Schema for booking items (consolidated line items)
const bookingItemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['repair', 'product'],
    required: true,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  },
  orderNumber: {
    type: String,
    default: '',
  },
  device: {
    type: String,
  },
  status: {
    type: String,
    default: 'pending',
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  services: [{
    name: String,
    price: Number,
    estimatedTime: Number,
  }],
  products: [{
    name: String,
    quantity: Number,
    price: Number,
    totalPrice: Number,
  }],
  cost: {
    type: Number,
    required: true,
    min: 0,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

const bookingSchema = new mongoose.Schema({
  bookingNumber: {
    type: String,
    unique: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  orderIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  }],
  repairOrderIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
  }],
  shopProductOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
  },
  items: [bookingItemSchema],
  status: {
    type: String,
    enum: ['pending', 'payment-pending', 'processing', 'completed', 'cancelled'],
    default: 'pending',
  },
  billingStatus: {
    type: String,
    enum: ['unpaid', 'partially-paid', 'paid'],
    default: 'unpaid',
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'partial'],
    default: 'pending',
  },
  subtotal: {
    type: Number,
    default: 0,
    min: 0,
  },
  tax: {
    type: Number,
    default: 0,
    min: 0,
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0,
  },
  appliedPromoCode: {
    type: String,
    default: '',
  },
  totalOrders: {
    type: Number,
    default: 0,
  },
  overallProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  // Return shipping information for DHL Parcel DE Returns
  returnLabelUrl: {
    type: String,
    default: '',
  },
  returnQRCodeUrl: {
    type: String,
    default: '',
  },
  returnTrackingNumber: {
    type: String,
    default: '',
  },
  returnShipmentId: {
    type: String,
    default: '',
  },
  returnShipmentStatus: {
    type: String,
    enum: ['pending', 'label-created', 'in-transit', 'delivered', 'failed', ''],
    default: 'pending',
  },
  returnCreatedAt: {
    type: Date,
  },
  returnReceivedAt: {
    type: Date,
  },
  timeline: [bookingTimelineSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  versionKey: false,
});

// Generate booking number before saving
bookingSchema.pre('save', async function(next) {
  if (this.isNew && !this.bookingNumber) {
    try {
      console.log('Booking pre-save: Generating booking number');
      const year = new Date().getFullYear();
      const count = await mongoose.model('Booking').countDocuments();
      this.bookingNumber = `BKG-${year}-${String(count + 1).padStart(4, '0')}`;
      console.log('Booking pre-save: Generated booking number:', this.bookingNumber);
    } catch (error) {
      console.error('Booking pre-save: Error generating booking number:', error);
      this.bookingNumber = `BKG-${Date.now()}`;
    }
  }

  // Update totalOrders based on orderIds length
  this.totalOrders = this.orderIds ? this.orderIds.length : 0;
  this.updatedAt = new Date();

  console.log('Booking pre-save: Total orders:', this.totalOrders, 'Booking status:', this.status);
  next();
});

// Add initial timeline entry when booking is created
bookingSchema.pre('save', function(next) {
  if (this.isNew) {
    console.log('Booking pre-save: Adding initial timeline entry');
    this.timeline.push({
      status: 'Booking Created',
      description: 'Orders consolidated into booking',
      completedAt: new Date(),
      staffId: 'system',
      staffName: 'System',
    });
  }
  next();
});

// Index for better performance
bookingSchema.index({ customerId: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ createdAt: -1 });
// bookingNumber already has unique: true index at line 81, no need for duplicate

// Populate customer when querying
bookingSchema.pre(/^find/, function(next) {
  // Check if auto-populate should be skipped
  if (this.getOptions().skipAutoPopulate) {
    return next();
  }

  this.populate('customerId', 'firstName lastName email phone avatar')
      .populate('orderIds', 'orderNumber status totalCost deviceBrand deviceModel progress')
      .populate('repairOrderIds', 'orderNumber status totalCost progress')
      .populate('shopProductOrderId', 'orderNumber status totalCost progress');
  next();
});

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
