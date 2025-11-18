const mongoose = require('mongoose');

// Schema for complaint comments/updates
const complaintCommentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userRole: {
    type: String,
    enum: ['customer', 'staff', 'admin'],
    required: true
  },
  comment: {
    type: String,
    required: true
  },
  isInternal: {
    type: Boolean,
    default: false // Internal notes only visible to staff/admin
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const complaintSchema = new mongoose.Schema({
  complaintNumber: {
    type: String,
    unique: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
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
  subject: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['quality', 'service', 'delivery', 'billing', 'communication', 'other'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'pending-customer', 'resolved', 'closed'],
    default: 'open'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedToName: {
    type: String
  },
  comments: [complaintCommentSchema],
  resolution: {
    type: String
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

// Generate complaint number before saving
complaintSchema.pre('save', async function(next) {
  if (this.isNew && !this.complaintNumber) {
    try {
      console.log('Complaint pre-save: Generating complaint number');
      const year = new Date().getFullYear();
      const count = await mongoose.model('Complaint').countDocuments();
      this.complaintNumber = `CMP-${year}-${String(count + 1).padStart(4, '0')}`;
      console.log('Complaint pre-save: Generated complaint number:', this.complaintNumber);
    } catch (error) {
      console.error('Complaint pre-save: Error generating complaint number:', error);
      this.complaintNumber = `CMP-${Date.now()}`;
    }
  }

  this.updatedAt = new Date();
  next();
});

// Indexes for better performance
complaintSchema.index({ bookingId: 1 });
complaintSchema.index({ customerId: 1 });
complaintSchema.index({ status: 1 });
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ complaintNumber: 1 });

// Populate customer and booking when querying
complaintSchema.pre(/^find/, function(next) {
  // Check if auto-populate should be skipped
  if (this.getOptions().skipAutoPopulate) {
    return next();
  }

  this.populate('customerId', 'firstName lastName email phone avatar')
      .populate('bookingId', 'bookingNumber status totalCost')
      .populate('orderId', 'orderNumber deviceBrand deviceModel')
      .populate('assignedTo', 'firstName lastName email role')
      .populate('resolvedBy', 'firstName lastName email');
  next();
});

const Complaint = mongoose.model('Complaint', complaintSchema);

module.exports = Complaint;
