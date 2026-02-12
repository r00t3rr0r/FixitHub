const mongoose = require('mongoose');

const repairRequestSchema = new mongoose.Schema({
  // Request Number
  requestNumber: {
    type: String,
    required: true,
    unique: true,
  },

  // Customer Information
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  customerName: {
    type: String,
    required: true,
  },
  customerEmail: {
    type: String,
    required: true,
  },
  customerPhone: {
    type: String,
    required: true,
  },

  // Device Information
  deviceType: {
    type: String,
    required: true,
  },
  deviceBrand: {
    type: String,
    required: true,
  },
  deviceModel: {
    type: String,
    required: true,
  },
  deviceModelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeviceModel',
  },

  // Questionnaire Responses
  issueDescription: {
    type: String,
    required: true,
  },
  issueOccurredDate: {
    type: String,
    required: true,
  },
  repairAttempts: {
    type: String,
    required: true,
  },
  additionalInfo: {
    type: String,
    default: '',
  },

  // Image Uploads
  images: [{
    type: String,
  }],

  // Status Management
  status: {
    type: String,
    enum: ['pending', 'reviewing', 'approved', 'rejected', 'converted'],
    default: 'pending',
  },

  // Staff Assignment
  assignedStaffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  assignedStaffName: {
    type: String,
    default: '',
  },

  // Communication Thread
  messages: [{
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    senderRole: {
      type: String,
      enum: ['customer', 'staff', 'admin'],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  }],

  // Converted Order Information
  convertedToOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
  },
  convertedAt: {
    type: Date,
  },
  convertedByStaffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  convertedByStaffName: {
    type: String,
    default: '',
  },

  // Admin Notes
  adminNotes: [{
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    staffName: {
      type: String,
      required: true,
    },
    note: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],

  // Priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },

  // Estimated Cost
  estimatedCost: {
    type: Number,
    min: 0,
    default: 0,
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },

  // Review Deadline
  reviewDeadline: {
    type: Date,
  },
}, {
  versionKey: false
});

// Auto-generate request number
repairRequestSchema.pre('save', async function(next) {
  if (this.isNew && !this.requestNumber) {
    try {
      const count = await this.constructor.countDocuments();
      this.requestNumber = `RR-${Date.now()}-${(count + 1).toString().padStart(5, '0')}`;
      console.log(`Generated request number: ${this.requestNumber}`);
    } catch (error) {
      console.error('Error generating request number:', error);
      return next(error);
    }
  }

  if (!this.isNew) {
    this.updatedAt = Date.now();
  }

  next();
});

// Index for faster queries
// Note: requestNumber already has a unique index from schema definition (line 8)
// repairRequestSchema.index({ requestNumber: 1 }); // Removed to avoid duplicate index warning
repairRequestSchema.index({ customerId: 1 });
repairRequestSchema.index({ status: 1 });
repairRequestSchema.index({ createdAt: -1 });

const RepairRequest = mongoose.model('RepairRequest', repairRequestSchema);

module.exports = RepairRequest;
