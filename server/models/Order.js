const mongoose = require('mongoose');
const CalculationHelper = require('../services/calculationHelper');

const addOnServiceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed'],
    default: 'pending',
  },
  estimatedTime: {
    type: String,
    default: '',
  },
  completedAt: {
    type: Date,
  },
  qualityPhotos: [{
    type: String,
  }],
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
}, { _id: true });

const staffNoteSchema = new mongoose.Schema({
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
  type: {
    type: String,
    enum: ['general', 'technical', 'customer', 'internal'],
    default: 'general',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

// Pickup confirmation schema
const pickupConfirmationSchema = new mongoose.Schema({
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  confirmedByName: {
    type: String,
    required: true,
  },
  confirmedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

// Unlock pattern/code confirmation schema
const unlockConfirmationSchema = new mongoose.Schema({
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  confirmedByName: {
    type: String,
    required: true,
  },
  confirmedAt: {
    type: Date,
    default: Date.now,
  },
  confirmationStatus: {
    type: String,
    enum: ['verified', 'incorrect', 'unable-to-verify'],
    required: true,
  },
  notes: {
    type: String,
    default: '',
  },
}, { _id: true });

const orderTimelineSchema = new mongoose.Schema({
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
  photos: [{
    type: String,
  }],
}, { _id: true });

const workflowPauseEventSchema = new mongoose.Schema({
  pausedAt: {
    type: Date,
    required: true,
  },
  resumedAt: {
    type: Date,
  },
  durationMinutes: {
    type: Number,
    default: 0,
    min: 0,
  },
  reason: {
    type: String,
    default: '',
  },
  stepId: {
    type: String,
    default: '',
  },
  stepName: {
    type: String,
    default: '',
  },
  stepIndex: {
    type: Number,
    default: -1,
  },
}, { _id: true });

const workflowAssignedStaffSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    default: '',
  },
  avatar: {
    type: String,
    default: '',
  },
  assignedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const workflowStepExecutionSchema = new mongoose.Schema({
  stepId: {
    type: String,
    required: true,
  },
  stepName: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'skipped'],
    default: 'pending',
  },
  assignedStaffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  assignedStaff: [workflowAssignedStaffSchema],
  startedAt: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
  totalPausedMinutes: {
    type: Number,
    default: 0,
    min: 0,
  },
  currentPauseStartedAt: {
    type: Date,
  },
  pauseHistory: [workflowPauseEventSchema],
  actualDurationMinutes: {
    type: Number,
    default: 0,
    min: 0,
  },
  estimatedDurationMinutes: {
    type: Number,
    default: 0,
    min: 0,
  },
  durationDeltaMinutes: {
    type: Number,
    default: 0,
  },
  formData: {
    type: mongoose.Schema.Types.Mixed,
  },
  checklistData: {
    type: Map,
    of: Boolean,
  },
  notes: {
    type: String,
  },
  photos: [{
    type: String,
  }],
}, { _id: true });

const orderWorkflowSchema = new mongoose.Schema({
  workflowTemplateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkflowTemplate',
    required: true,
  },
  workflowName: {
    type: String,
    required: true,
  },
  assignedStaffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  assignedStaff: [workflowAssignedStaffSchema],
  steps: [workflowStepExecutionSchema],
  currentStepIndex: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['not-started', 'in-progress', 'completed', 'on-hold'],
    default: 'not-started',
  },
  startedAt: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
  pausedAt: {
    type: Date,
  },
  totalPausedMinutes: {
    type: Number,
    default: 0,
    min: 0,
  },
  pauseHistory: [workflowPauseEventSchema],
  pauseReason: {
    type: String,
    default: '',
  },
  estimatedCompletionTime: {
    type: Number, // in minutes
  },
}, { _id: true });

const orderEPartSchema = new mongoose.Schema({
  partId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true,
  },
  versionId: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  status: {
    type: String,
    enum: ['pending', 'allocated', 'used'],
    default: 'pending',
  },
  assignedAt: {
    type: Date,
    default: Date.now,
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Made optional to support guest orders
  },
}, { _id: true });

const orderEPartNeedListEntrySchema = new mongoose.Schema({
  partId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  needListId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NeedList',
    default: null,
  },
  needListName: {
    type: String,
    required: true,
    trim: true,
  },
  needListStatus: {
    type: String,
    enum: ['draft', 'ready', 'ordered', 'archived'],
    default: 'draft',
  },
  targetType: {
    type: String,
    enum: ['existing', 'new', 'today'],
    default: 'existing',
  },
  notes: {
    type: String,
    default: '',
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
}, { _id: true });

// Shop products schema for orders
const orderShopProductSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  priceAtOrder: {
    type: Number,
    required: true,
    min: 0,
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed'],
    default: 'pending',
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Made optional to support guest orders
  },
}, { _id: true });

// Define service schema for order services (repair services)
const orderServiceSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  estimatedTime: {
    type: Number,
    required: true,
    min: 0,
  },
  notes: {
    type: String,
    default: '',
  },
}, { _id: true });

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Made optional to support guest orders
  },
  // Guest information for non-registered users
  guestInfo: {
    email: {
      type: String,
      default: '',
    },
    firstName: {
      type: String,
      default: '',
    },
    lastName: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    isGuest: {
      type: Boolean,
      default: false,
    },
    billingAddress: {
      street: {
        type: String,
        default: '',
      },
      city: {
        type: String,
        default: '',
      },
      state: {
        type: String,
        default: '',
      },
      zipCode: {
        type: String,
        default: '',
      },
      country: {
        type: String,
        default: '',
      },
    },
    shippingAddress: {
      street: {
        type: String,
        default: '',
      },
      city: {
        type: String,
        default: '',
      },
      state: {
        type: String,
        default: '',
      },
      zipCode: {
        type: String,
        default: '',
      },
      country: {
        type: String,
        default: '',
      },
    },
  },
  deviceBrand: {
    type: String,
    required: true,
  },
  deviceModel: {
    type: String,
    required: true,
  },
  deviceType: {
    type: String,
    default: 'Smartphone',
  },
  services: [orderServiceSchema],
  addOns: [addOnServiceSchema],
  status: {
    type: String,
    enum: ['pending', 'diagnostic-assessment', 'in-progress', 'paused', 'quality-check', 'completed', 'ready-for-pickup', 'cancelled'],
    default: 'pending',
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  },
  assignedStaff: [{
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    name: String,
    avatar: String,
    assignedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  estimatedCompletion: {
    type: Date,
  },
  actualCompletion: {
    type: Date,
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0,
  },
  // Auftragswert-Konzept (immer Brutto, Händlerrabatt vor Steuerabzug)
  originalGrossAmount: {
    type: Number,
    min: 0,
  },
  dealerDiscountPercent: {
    type: Number,
    default: 0,
    min: 0,
  },
  dealerDiscountAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Cart/promo-level discount (proportional share of the checkout discount applied to
  // this order). totalCost already has this subtracted; kept separately so the
  // discount stays visible/consistent in order details, payment mask and invoices.
  discount: {
    type: Number,
    default: 0,
    min: 0,
  },
  appliedPromoCode: {
    type: String,
    default: '',
  },
  netAmount: {
    type: Number,
    min: 0,
  },
  taxAmount: {
    type: Number,
    min: 0,
  },
  taxRate: {
    type: Number,
    default: 19,
  },
  revisionCount: {
    type: Number,
    default: 0,
  },
  photos: [{
    type: String,
  }],
  customerNotes: {
    type: String,
    default: '',
  },
  staffNotes: [staffNoteSchema],
  eParts: [orderEPartSchema],
  ePartNeedListEntries: [orderEPartNeedListEntrySchema],
  shopProducts: [orderShopProductSchema],
  workflows: [orderWorkflowSchema],
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  timeline: [orderTimelineSchema],
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'partial'],
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'sepa', 'paypal', 'cash', null],
    default: null,
  },
  paidAt: {
    type: Date,
    default: null,
  },
  // Device unlock information
  unlockPattern: {
    type: [String],
    default: [],
  },
  unlockCode: {
    type: String,
    default: '',
  },
  noLock: {
    type: Boolean,
    default: false,
  },
  unlockConfirmation: unlockConfirmationSchema,
  pickupConfirmation: pickupConfirmationSchema,
  // Additional repair information
  errorDescription: {
    type: String,
    default: '',
  },
  waterDamage: {
    type: String,
    enum: ['yes', 'no', 'dont-know', 'unsure', ''],
    default: '',
  },
  previousRepairAttempts: {
    type: String,
    enum: ['yes', 'no', 'dont-know', 'unsure', ''],
    default: '',
  },
  previousRepairDetails: {
    type: String,
    default: '',
  },
  itemCondition: {
    type: String,
    enum: ['original', 'refurbished', 'unsure', ''],
    default: '',
  },
  imei: {
    type: String,
    default: '',
  },
  serialNumber: {
    type: String,
    default: '',
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null,
  },
  hasComplaint: {
    type: Boolean,
    default: false,
  },
  complaintReason: {
    type: String,
    default: '',
  },
  parentOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
  },
  sourceComplaintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint',
    default: null,
  },
  isComplaintFollowup: {
    type: Boolean,
    default: false,
  },
  // When true, blocks completion/shipping until paymentStatus becomes 'paid' (e.g. rejected complaint offer)
  requiresPaymentBeforeCompletion: {
    type: Boolean,
    default: false,
  },
  // Shipping and tracking information
  shippingAddress: {
    street: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      default: '',
    },
    state: {
      type: String,
      default: '',
    },
    zipCode: {
      type: String,
      default: '',
    },
    country: {
      type: String,
      default: '',
    },
    deliveryType: {
      type: String,
      default: '',
    },
    packstationNumber: {
      type: String,
      default: '',
    },
    postNumber: {
      type: String,
      default: '',
    },
  },
  trackingNumber: {
    type: String,
    default: '',
  },
  carrier: {
    type: String,
    default: 'DHL',
  },
  shippingStatus: {
    type: String,
    enum: ['pending', 'label-created', 'shipped', 'in-transit', 'out-for-delivery', 'delivered', 'failed'],
    default: 'pending',
  },
  shippingStatusDescription: {
    type: String,
    default: '',
  },
  estimatedDelivery: {
    type: Date,
  },
  actualDelivery: {
    type: Date,
  },
  shippingLabelUrl: {
    type: String,
    default: '',
  },
  shippingLabelCreationInProgress: {
    type: Boolean,
    default: false,
  },
  shippingCost: {
    type: Number,
    default: 0,
  },
  trackingEvents: [{
    timestamp: {
      type: Date,
      required: true,
    },
    location: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
  }],
  // Guest order tracking
  guestTrackingToken: {
    type: String,
    default: '',
    index: true, // Add index for fast lookups
  },
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

// Query indexes for booking/order list performance
orderSchema.index({ bookingId: 1, createdAt: -1 });
orderSchema.index({ isComplaintFollowup: 1, parentOrderId: 1 });
orderSchema.index({ parentOrderId: 1 });

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    try {
      const year = new Date().getFullYear();
      const count = await mongoose.model('Order').countDocuments();
      this.orderNumber = `ORD-${year}-${String(count + 1).padStart(3, '0')}`;
    } catch (error) {
      console.error('Error generating order number:', error);
      // Fallback to timestamp-based order number
      this.orderNumber = `ORD-${Date.now()}`;
    }
  }

  // Generate tracking token for guest orders
  if (this.isNew && this.guestInfo && this.guestInfo.isGuest && !this.guestTrackingToken) {
    const crypto = require('crypto');
    this.guestTrackingToken = crypto.randomBytes(32).toString('hex');
    console.log('Order: Generated guest tracking token for order:', this.orderNumber);
  }

  // Calculate order values according to domain model (Gross based, dealer discount subtracted first)
  const currentGross = Number(this.totalCost || 0);
  if (this.isNew && (this.originalGrossAmount == null || Number.isNaN(Number(this.originalGrossAmount)))) {
    this.originalGrossAmount = currentGross;
  }

  const orderValueCalc = CalculationHelper.calculateOrderValue(
    this.isNew ? (this.originalGrossAmount || currentGross) : currentGross,
    this.dealerDiscountPercent || 0,
    this.taxRate || 19
  );

  this.dealerDiscountAmount = orderValueCalc.dealerDiscountAmount;
  this.netAmount = orderValueCalc.netAmount;
  this.taxAmount = orderValueCalc.taxAmount;
  this.taxRate = orderValueCalc.taxRate;

  this.updatedAt = new Date();
  next();
});

// Add initial timeline entry when order is created
orderSchema.pre('save', function(next) {
  if (this.isNew) {
    this.timeline.push({
      status: 'Order Received',
      description: 'Order placed by customer',
      completedAt: new Date(),
      staffId: 'system',
      staffName: 'System'
    });
  }
  next();
});

// Populate customer and assigned staff when querying - include complete customer information
// Can be disabled by setting { skipAutoPopulate: true } in query options
orderSchema.pre(/^find/, function(next) {
  // Check if auto-populate should be skipped
  if (this.getOptions().skipAutoPopulate) {
    return next();
  }

  this.populate('customerId', 'name email phone avatar address invoiceAddress paymentMethods isActive role createdAt')
      .populate('assignedStaff.staffId', 'name avatar')
      .populate('services.serviceId', 'name description price estimatedTime category')
      .populate('eParts.partId')
      .populate('eParts.assignedBy', 'name email')
      .populate('ePartNeedListEntries.partId')
      .populate('ePartNeedListEntries.needListId', 'name status')
      .populate('ePartNeedListEntries.requestedBy', 'name email')
      .populate('shopProducts.productId', 'name price images category brand stock')
      .populate('shopProducts.addedBy', 'name email')
      .populate('workflows.workflowTemplateId')
      .populate('workflows.assignedStaffId', 'name avatar')
      .populate('workflows.assignedStaff.staffId', 'name avatar')
      .populate('workflows.steps.assignedStaffId', 'name avatar')
      .populate('workflows.steps.assignedStaff.staffId', 'name avatar');
  next();
});

// Post-save hook to update booking status and progress when order progresses
orderSchema.post('save', async function(doc) {
  // Only proceed if this order belongs to a booking
  if (!doc.bookingId) {
    return;
  }

  try {
    const Order = mongoose.model('Order');
    const Booking = mongoose.model('Booking');

    const booking = await Booking.findById(doc.bookingId)
      .setOptions({ skipAutoPopulate: true })
      .select('_id status overallProgress');

    if (!booking) {
      return;
    }

    const [stats] = await Order.aggregate([
      { $match: { bookingId: booking._id } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          averageProgress: { $avg: { $ifNull: ['$progress', 0] } },
          inProgressCount: {
            $sum: {
              $cond: [
                { $in: ['$status', ['diagnostic-assessment', 'in-progress', 'quality-check']] },
                1,
                0,
              ],
            },
          },
          incompleteCount: {
            $sum: {
              $cond: [
                { $in: ['$status', ['completed', 'cancelled']] },
                0,
                1,
              ],
            },
          },
        },
      },
    ]);

    const totalOrders = stats?.totalOrders || 0;
    const averageProgress = totalOrders > 0
      ? Math.round(stats.averageProgress || 0)
      : 0;
    const hasInProgressOrders = (stats?.inProgressCount || 0) > 0;
    const allCompleted = totalOrders > 0 && (stats?.incompleteCount || 0) === 0;

    // Update booking status based on order progress
    let newBookingStatus = booking.status;
    let statusChanged = false;

    // If any order is in progress and booking is still pending, change to processing
    if (hasInProgressOrders && booking.status === 'pending') {
      newBookingStatus = 'processing';
      statusChanged = true;
    }

    // If all orders are completed, mark booking as completed
    if (allCompleted && booking.status !== 'completed' && booking.status !== 'cancelled') {
      newBookingStatus = 'completed';
      statusChanged = true;
    }

    const updateSet = {};
    if (statusChanged) {
      updateSet.status = newBookingStatus;
    }
    if (booking.overallProgress !== averageProgress) {
      updateSet.overallProgress = averageProgress;
    }

    if (Object.keys(updateSet).length === 0) {
      return;
    }

    const updateOps = { $set: updateSet };
    if (statusChanged) {
      updateOps.$push = {
        timeline: {
        status: `Status Changed to ${newBookingStatus}`,
        description: `Booking status automatically updated based on order progress`,
        completedAt: new Date(),
        staffId: 'system',
        staffName: 'System'
      },
      };
    }

    await Booking.updateOne({ _id: booking._id }, updateOps);

  } catch (error) {
    console.error('Order post-save hook: Error updating booking:', error);
    // Don't throw error to avoid breaking order save operation
  }
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;