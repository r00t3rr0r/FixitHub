const mongoose = require('mongoose');

const pauseHistorySchema = new mongoose.Schema({
  pausedAt: Date,
  resumedAt: Date,
  durationMs: Number,
  reason: String,
}, { _id: true });

const incidentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['defective_part', 'spare_part_needed', 'customer_info', 'other_repair', 'technician_handover', 'needs_time'],
    required: true,
  },
  status: {
    type: String,
    enum: ['reported', 'escalated', 'resolved'],
    default: 'reported',
  },
  reason: String,
  notes: String,
  additionalData: mongoose.Schema.Types.Mixed,
  emailSentAt: Date,
  reportedByTechnicianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reportedByTechnicianName: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

const repairWorkflowSchema = new mongoose.Schema({
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
  inspectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeviceInspection',
    required: false,
  },

  status: {
    type: String,
    enum: ['pending-confirmation', 'in-progress', 'paused', 'completed', 'incident'],
    default: 'pending-confirmation',
  },

  approvalData: {
    internalNotes: String,
    orderChanges: mongoose.Schema.Types.Mixed,
    notifyCustomer: {
      type: Boolean,
      default: false,
    },
    approvedAt: Date,
    approvedByTechnicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedByTechnicianName: String,
  },

  timerData: {
    startedAt: Date,
    pausedAt: Date,
    resumedAt: Date,
    completedAt: Date,
    totalPausedMs: {
      type: Number,
      default: 0,
    },
    pauseHistory: [pauseHistorySchema],
  },

  incidents: [incidentSchema],

  lastStatusChangeAt: {
    type: Date,
    default: Date.now,
  },

  metadata: {
    elapsedTimeMs: Number,
  },

  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, { versionKey: false });

repairWorkflowSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

repairWorkflowSchema.index({ orderId: 1 });
repairWorkflowSchema.index({ technicianId: 1 });
repairWorkflowSchema.index({ customerId: 1 });
repairWorkflowSchema.index({ status: 1 });
repairWorkflowSchema.index({ lastStatusChangeAt: 1 });

module.exports = mongoose.model('RepairWorkflow', repairWorkflowSchema);
