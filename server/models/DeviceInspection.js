const mongoose = require('mongoose');

// Schema for model verification step
const modelVerificationSchema = new mongoose.Schema({
  reportedModel: {
    type: String,
    required: true,
  },
  actualModel: {
    type: String,
    required: true,
  },
  verified: {
    type: Boolean,
    required: true,
  },
  verificationStatus: {
    type: String,
    enum: ['correct', 'incorrect-more-expensive', 'incorrect-same-cheaper', 'unverifiable'],
    required: true,
  },
  costDifference: {
    type: Number,
    default: 0, // positive if actual is more expensive
  },
  supervisorNotified: {
    type: Boolean,
    default: false,
  },
  supervisorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  notes: String,
  verifiedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

// Schema for identification numbers
const identificationSchema = new mongoose.Schema({
  deviceType: {
    type: String,
    enum: ['Smartphone', 'Laptop', 'Tablet', 'Watch', 'Headphones'],
    required: true,
  },
  imei: String, // For phones
  serialNumber: String, // For laptops/tablets
  imeiRequired: {
    type: Boolean,
    default: false,
  },
  identified: {
    type: Boolean,
    default: false,
  },
  identifiedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

// Schema for accessories and packaging
const accessoriesSchema = new mongoose.Schema({
  originalPackaging: {
    present: Boolean,
    description: String,
  },
  caseCover: {
    present: Boolean,
    description: String,
  },
  powerAdapter: {
    present: Boolean,
    description: String,
  },
  simTray: {
    present: Boolean,
    description: String,
  },
  cables: {
    present: Boolean,
    description: String,
  },
  otherAccessories: [{
    name: String,
    present: Boolean,
    description: String,
  }],
  additionalAccessoriesText: String,
  description: String,
  checkedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

// Schema for external inspection
const externalInspectionSchema = new mongoose.Schema({
  display: {
    status: {
      type: String,
      enum: [
        '--',
        'OK',
        'Not OK',
        'light-wear',
        'scratches-wear',
        'heavy-scratches-wear',
        'damaged',
      ],
      required: true,
    },
    notes: String,
  },
  frame: {
    status: {
      type: String,
      enum: [
        '--',
        'OK',
        'Not OK',
        'light-wear',
        'scratches-wear',
        'heavy-scratches-wear',
        'damaged',
      ],
      required: true,
    },
    notes: String,
  },
  backCover: {
    status: {
      type: String,
      enum: [
        '--',
        'OK',
        'Not OK',
        'light-wear',
        'scratches-wear',
        'heavy-scratches-wear',
        'damaged',
      ],
      required: true,
    },
    notes: String,
  },
  buttons: {
    status: {
      type: String,
      enum: ['OK', 'Not OK', 'working', 'not-working'],
      required: true,
    },
    notes: String,
  },
  visibleDamages: {
    hasDamage: Boolean,
    description: String,
  },
  uniqueNotes: String,
  photos: [String],
  inspectedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

// Schema for device testing
const deviceTestSchema = new mongoose.Schema({
  charging: {
    status: {
      type: String,
      enum: ['OK', 'Not OK'],
      required: true,
    },
    current: String,
    notes: String,
  },
  power: {
    status: {
      type: String,
      enum: ['OK', 'Not OK'],
      required: true,
    },
    notes: String,
  },
  wifi: {
    status: {
      type: String,
      enum: ['OK', 'Not OK'],
      required: true,
    },
    notes: String,
  },
  frontCamera: {
    status: {
      type: String,
      enum: ['OK', 'Not OK'],
      required: true,
    },
    notes: String,
  },
  mainCamera: {
    status: {
      type: String,
      enum: ['OK', 'Not OK'],
      required: true,
    },
    notes: String,
  },
  testedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

// Schema for Apple-specific checks
const appleSpecificSchema = new mongoose.Schema({
  modemFirmware: {
    status: {
      type: String,
      enum: ['working', 'defective', 'not-testable'],
      default: 'working',
    },
    present: Boolean,
    notes: String,
  },
  touchIdFaceId: {
    status: {
      type: String,
      enum: ['not-applicable', 'working', 'defective'],
      default: 'not-applicable',
    },
    applicable: Boolean,
    working: Boolean,
    notes: String,
  },
  customerInfoAction: {
    requested: {
      type: Boolean,
      default: false,
    },
    note: String,
  },
  checkedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

// Schema for action log
const actionLogSchema = new mongoose.Schema({
  action: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
  technicianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  technicianName: String,
  resultStatus: {
    type: String,
    enum: ['success', 'warning', 'error', 'info'],
  },
  details: mongoose.Schema.Types.Mixed,
}, { _id: true });

// Main Device Inspection Schema
const deviceInspectionSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    unique: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  technicianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // Inspection steps
  modelVerification: modelVerificationSchema,
  identification: identificationSchema,
  accessories: accessoriesSchema,
  externalInspection: externalInspectionSchema,
  deviceTest: deviceTestSchema,
  appleSpecific: appleSpecificSchema,

  // Status tracking
  status: {
    type: String,
    enum: ['not-started', 'in-progress', 'completed', 'on-hold'],
    default: 'not-started',
  },
  currentStep: {
    type: Number,
    default: 1,
    min: 1,
    max: 6,
  },
  completedSteps: [{
    step: Number,
    completedAt: Date,
  }],

  // Test results and notifications
  hasFailedTests: {
    type: Boolean,
    default: false,
  },
  failedTestDetails: [{
    testName: String,
    reason: String,
  }],
  customerNotificationCreated: {
    type: Boolean,
    default: false,
  },

  // Repair assessment
  isRepairable: {
    type: Boolean,
  },
  repairOffer: {
    cost: Number,
    timeframe: String,
    description: String,
  },
  completionAction: {
    type: String,
    enum: ['repairable', 'not-repairable', 'inform-customer'],
    default: 'repairable',
  },
  customerInformation: {
    shouldInform: {
      type: Boolean,
      default: false,
    },
    reason: String,
    note: String,
    suggestedStatus: String,
    mailTemplate: String,
    generatedAt: Date,
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'awaiting-customer'],
  },

  // Report generation
  reportGenerated: {
    type: Boolean,
    default: false,
  },
  reportUrl: String,
  reportGeneratedAt: Date,

  // Action logs
  actionLogs: [actionLogSchema],

  // Timestamps
  startedAt: Date,
  completedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, { versionKey: false });

// Update timestamp on save
deviceInspectionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index for quick lookups
// orderId already has unique: true index at line 226, no need for duplicate
deviceInspectionSchema.index({ customerId: 1 });
deviceInspectionSchema.index({ technicianId: 1 });
deviceInspectionSchema.index({ status: 1 });

module.exports = mongoose.model('DeviceInspection', deviceInspectionSchema);
