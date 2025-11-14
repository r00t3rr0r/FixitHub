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
  startedAt: {
    type: Date,
  },
  completedAt: {
    type: Date,
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
    required: true,
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
    required: true,
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
  deviceType: {
    type: String,
    default: 'Smartphone',
  },
  services: [orderServiceSchema],
  addOns: [addOnServiceSchema],
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'quality-check', 'completed', 'ready-for-pickup', 'cancelled'],
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
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null,
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
      .populate('shopProducts.productId', 'name price images category brand stock')
      .populate('shopProducts.addedBy', 'name email')
      .populate('workflows.workflowTemplateId')
      .populate('workflows.steps.assignedStaffId', 'name avatar');
  next();
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;