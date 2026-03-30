const mongoose = require('mongoose');

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
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null,
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

  this.populate('customerId', 'name email phone avatar address paymentMethods isActive role createdAt')
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
      .populate('workflows.steps.assignedStaffId', 'name avatar')
      .populate('workflows.steps.assignedStaff.staffId', 'name avatar');
  next();
});

// Post-save hook to update booking status and progress when order progresses
orderSchema.post('save', async function(doc) {
  console.log('Order post-save hook: Order saved, checking for booking updates:', doc._id);

  // Only proceed if this order belongs to a booking
  if (!doc.bookingId) {
    console.log('Order post-save hook: No booking associated, skipping');
    return;
  }

  try {
    const Booking = mongoose.model('Booking');
    const booking = await Booking.findById(doc.bookingId);

    if (!booking) {
      console.log('Order post-save hook: Booking not found:', doc.bookingId);
      return;
    }

    console.log('Order post-save hook: Found booking:', booking._id, 'Current status:', booking.status);

    // Get all orders for this booking
    const Order = mongoose.model('Order');
    const allOrders = await Order.find({ bookingId: booking._id });

    console.log('Order post-save hook: Found', allOrders.length, 'orders for booking');

    // Calculate overall progress from all orders
    let totalProgress = 0;
    let hasInProgressOrders = false;
    let allCompleted = true;

    allOrders.forEach(order => {
      totalProgress += (order.progress || 0);
      if (order.status === 'diagnostic-assessment' || order.status === 'in-progress' || order.status === 'quality-check') {
        hasInProgressOrders = true;
      }
      if (order.status !== 'completed' && order.status !== 'cancelled') {
        allCompleted = false;
      }
    });

    const averageProgress = allOrders.length > 0 ? Math.round(totalProgress / allOrders.length) : 0;

    console.log('Order post-save hook: Calculated progress:', averageProgress, '%');
    console.log('Order post-save hook: Has in-progress orders:', hasInProgressOrders);
    console.log('Order post-save hook: All completed:', allCompleted);

    // Update booking status based on order progress
    let newBookingStatus = booking.status;
    let statusChanged = false;

    // If any order is in progress and booking is still pending, change to processing
    if (hasInProgressOrders && booking.status === 'pending') {
      newBookingStatus = 'processing';
      statusChanged = true;
      console.log('Order post-save hook: Changing booking status from pending to processing');
    }

    // If all orders are completed, mark booking as completed
    if (allCompleted && allOrders.length > 0 && booking.status !== 'completed' && booking.status !== 'cancelled') {
      newBookingStatus = 'completed';
      statusChanged = true;
      console.log('Order post-save hook: All orders completed, changing booking status to completed');
    }

    // Update booking with new status and progress
    if (statusChanged) {
      booking.status = newBookingStatus;
      booking.timeline.push({
        status: `Status Changed to ${newBookingStatus}`,
        description: `Booking status automatically updated based on order progress`,
        completedAt: new Date(),
        staffId: 'system',
        staffName: 'System'
      });
    }

    // Store overall progress in booking (we'll add this field to model)
    booking.overallProgress = averageProgress;

    await booking.save();
    console.log('Order post-save hook: Booking updated successfully with status:', newBookingStatus, 'and progress:', averageProgress, '%');

  } catch (error) {
    console.error('Order post-save hook: Error updating booking:', error);
    // Don't throw error to avoid breaking order save operation
  }
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;