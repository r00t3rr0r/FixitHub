const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  reminderNumber: {
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
  type: {
    type: String,
    enum: ['payment', 'pickup', 'followup', 'feedback', 'maintenance', 'custom'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  notificationMethod: {
    type: [String],
    enum: ['email', 'sms', 'push', 'in-app'],
    default: ['email', 'in-app']
  },
  status: {
    type: String,
    enum: ['scheduled', 'sent', 'delivered', 'failed', 'cancelled'],
    default: 'scheduled'
  },
  sentAt: {
    type: Date
  },
  deliveredAt: {
    type: Date
  },
  failureReason: {
    type: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdByName: {
    type: String
  },
  recurring: {
    enabled: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly'
    },
    endDate: {
      type: Date
    }
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  metadata: {
    type: Map,
    of: String,
    default: {}
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

// Generate reminder number before saving
reminderSchema.pre('save', async function(next) {
  if (this.isNew && !this.reminderNumber) {
    try {
      console.log('Reminder pre-save: Generating reminder number');
      const year = new Date().getFullYear();
      const count = await mongoose.model('Reminder').countDocuments();
      this.reminderNumber = `RMD-${year}-${String(count + 1).padStart(4, '0')}`;
      console.log('Reminder pre-save: Generated reminder number:', this.reminderNumber);
    } catch (error) {
      console.error('Reminder pre-save: Error generating reminder number:', error);
      this.reminderNumber = `RMD-${Date.now()}`;
    }
  }

  this.updatedAt = new Date();
  next();
});

// Indexes for better performance
reminderSchema.index({ bookingId: 1 });
reminderSchema.index({ customerId: 1 });
reminderSchema.index({ status: 1 });
reminderSchema.index({ scheduledDate: 1 });
reminderSchema.index({ createdAt: -1 });
reminderSchema.index({ reminderNumber: 1 });

// Populate customer and booking when querying
reminderSchema.pre(/^find/, function(next) {
  // Check if auto-populate should be skipped
  if (this.getOptions().skipAutoPopulate) {
    return next();
  }

  this.populate('customerId', 'firstName lastName email phone avatar')
      .populate('bookingId', 'bookingNumber status totalCost')
      .populate('orderId', 'orderNumber deviceBrand deviceModel')
      .populate('createdBy', 'firstName lastName email role');
  next();
});

const Reminder = mongoose.model('Reminder', reminderSchema);

module.exports = Reminder;
