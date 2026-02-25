const mongoose = require('mongoose');

/**
 * TimeEntry Schema - Tracks individual clock in/out sessions and break periods
 */
const timeEntrySchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  staffName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['clock_in', 'clock_out', 'break_start', 'break_end', 'order_start', 'order_end'],
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  // For order-specific time tracking
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  orderNumber: String,
  // For task-specific time tracking
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  },
  // Session tracking
  sessionId: {
    type: String, // UUID to group related entries (clock_in with clock_out)
    index: true
  },
  // Duration in minutes (calculated for completed sessions)
  duration: {
    type: Number, // in minutes
    default: 0
  },
  // Notes or reason for entry
  notes: String,
  // Location/IP for security
  ipAddress: String,
  userAgent: String,
  // Manual entry flag (if admin manually adjusts time)
  isManual: {
    type: Boolean,
    default: false
  },
  adjustedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  adjustedAt: Date,
  adjustmentReason: String
}, {
  timestamps: true
});

// Indexes for efficient queries
timeEntrySchema.index({ staffId: 1, timestamp: -1 });
timeEntrySchema.index({ staffId: 1, type: 1, timestamp: -1 });
timeEntrySchema.index({ sessionId: 1 });
timeEntrySchema.index({ orderId: 1 });
timeEntrySchema.index({ createdAt: 1 });

/**
 * WorkSession Schema - Aggregated work sessions with calculated durations
 */
const workSessionSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  staffName: {
    type: String,
    required: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  clockInTime: {
    type: Date,
    required: true
  },
  clockOutTime: Date,
  // Break periods during this session
  breaks: [{
    startTime: {
      type: Date,
      required: true
    },
    endTime: Date,
    duration: Number, // in minutes
    reason: String
  }],
  // Orders worked on during this session
  ordersWorked: [{
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    orderNumber: String,
    startTime: Date,
    endTime: Date,
    duration: Number // in minutes
  }],
  // Tasks completed during this session
  tasksWorked: [{
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task'
    },
    taskTitle: String,
    startTime: Date,
    endTime: Date,
    duration: Number // in minutes
  }],
  // Calculated durations
  totalDuration: {
    type: Number, // in minutes
    default: 0
  },
  workDuration: {
    type: Number, // in minutes (total - breaks)
    default: 0
  },
  breakDuration: {
    type: Number, // in minutes
    default: 0
  },
  // Status
  status: {
    type: String,
    enum: ['active', 'on_break', 'completed'],
    default: 'active'
  },
  // Current activity
  currentOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  currentTaskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  },
  // Metadata
  notes: String,
  isManual: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
workSessionSchema.index({ staffId: 1, clockInTime: -1 });
workSessionSchema.index({ staffId: 1, status: 1 });
workSessionSchema.index({ sessionId: 1 });
workSessionSchema.index({ 'ordersWorked.orderId': 1 });

// Calculate durations before saving
workSessionSchema.pre('save', function(next) {
  if (this.clockInTime && this.clockOutTime) {
    // Calculate total duration
    this.totalDuration = Math.round((this.clockOutTime - this.clockInTime) / (1000 * 60));

    // Calculate break duration
    this.breakDuration = this.breaks.reduce((sum, brk) => {
      if (brk.endTime) {
        return sum + Math.round((brk.endTime - brk.startTime) / (1000 * 60));
      }
      return sum;
    }, 0);

    // Calculate work duration
    this.workDuration = this.totalDuration - this.breakDuration;

    // Update status
    if (this.status !== 'completed') {
      this.status = 'completed';
    }
  }
  next();
});

const TimeEntry = mongoose.model('TimeEntry', timeEntrySchema);
const WorkSession = mongoose.model('WorkSession', workSessionSchema);

module.exports = { TimeEntry, WorkSession };
