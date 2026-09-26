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
  // Where reportedModel came from, so a report can say how reliable "Gemeldetes Modell" is:
  //   order-snapshot            Order.reportedDevice, written once when the order was created
  //   order-snapshot-unverified Order.reportedDevice captured lazily AFTER an earlier recorded change
  //   order-timeline            oldest "Device Changed" entry of the order history (legacy order)
  //   order-current             no snapshot and no change recorded: the booked device is the current one
  //   order-current-unverified  no snapshot, a change is recorded but its original device is unreadable
  // Missing on inspections created before 25.09.2026 (unknown origin, shown as recorded).
  reportedModelSource: {
    type: String,
    enum: ['order-snapshot', 'order-snapshot-unverified', 'order-timeline', 'order-current', 'order-current-unverified'],
  },
  verifiedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

// Schema for identification numbers
const identificationSchema = new mongoose.Schema({
  deviceType: {
    type: String,
    // 'Other' covers free-form order device types that have no canonical equivalent
    // (the catalog of device types is admin-editable), so step 2 can never hard-fail.
    enum: ['Smartphone', 'Laptop', 'Tablet', 'Watch', 'Headphones', 'Other'],
    required: true,
  },
  deviceTypeLabel: String, // Original, unnormalised device type as recorded on the order
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
      enum: ['OK', 'Not OK', 'Not tested'],
      required: true,
    },
    current: String,
    notes: String,
  },
  power: {
    status: {
      type: String,
      enum: ['OK', 'Not OK', 'Not tested'],
      required: true,
    },
    notes: String,
  },
  wifi: {
    status: {
      type: String,
      enum: ['OK', 'Not OK', 'Not tested'],
      required: true,
    },
    notes: String,
  },
  frontCamera: {
    status: {
      type: String,
      enum: ['OK', 'Not OK', 'Not tested'],
      required: true,
    },
    notes: String,
  },
  mainCamera: {
    status: {
      type: String,
      enum: ['OK', 'Not OK', 'Not tested'],
      required: true,
    },
    notes: String,
  },
  buttons: {
    status: {
      type: String,
      enum: ['working', 'not-working'],
      default: 'working',
    },
    notes: String,
  },
  notes: String,
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
      enum: ['not-applicable', 'working', 'defective', 'not-testable'],
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
    max: 7, // the wizard has 7 steps
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
  // DEPRECATED: the "Reparatureinschaetzung" control was removed from the inspection UI and
  // completeInspection() ignores both fields on write. Historical values were largely written
  // automatically by old clients (default 'repairable'), so they are kept in the database but
  // never shown (UI, PDF, e-mail) - do not repurpose them.
  isRepairable: {
    type: Boolean,
  },
  repairOffer: {
    // Only set when a price was actually given. A missing price is UNKNOWN, never 0.
    cost: Number,
    // true = the cost was given explicitly (0 = a deliberately free quote). Records written
    // before 25.09.2026 do not have it: the client then sent 0 whenever no price existed, so
    // a legacy 0 without this flag is treated as unknown (see resolveKnownRepairCost).
    costSpecified: Boolean,
    timeframe: String,
    description: String,
  },
  // DEPRECATED - see isRepairable above.
  completionAction: {
    type: String,
    enum: ['repairable', 'not-repairable', 'inform-customer'],
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

// The only repair cost that may be shown anywhere (UI, PDF, e-mail): an explicitly given price,
// or - for legacy records without costSpecified - a positive one. Returns null when unknown.
const resolveKnownRepairCost = (repairOffer) => {
  if (!repairOffer || typeof repairOffer !== 'object') {
    return null;
  }
  const { cost } = repairOffer;
  if (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0) {
    return null;
  }
  if (repairOffer.costSpecified === true) {
    return cost;
  }
  return cost > 0 ? cost : null;
};

deviceInspectionSchema.statics.resolveKnownRepairCost = resolveKnownRepairCost;

// API responses additionally carry repairOfferKnownCost (number | null), so no client has to
// re-derive "unknown" from a raw cost that may be a legacy default 0.
deviceInspectionSchema.set('toJSON', {
  transform(doc, ret) {
    if (typeof doc.ownerDocument === 'function' && doc.ownerDocument() !== doc) {
      return ret; // subdocument
    }
    ret.repairOfferKnownCost = resolveKnownRepairCost(ret.repairOffer);
    return ret;
  },
});

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
