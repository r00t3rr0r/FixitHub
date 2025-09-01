const mongoose = require('mongoose');

const scheduleEventSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['work', 'break', 'meeting', 'training', 'maintenance', 'appointment'],
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  isAllDay: {
    type: Boolean,
    default: false
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  location: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  reminder: {
    enabled: {
      type: Boolean,
      default: true
    },
    minutes: {
      type: Number,
      default: 15
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

// Index for efficient queries
scheduleEventSchema.index({ staffId: 1, startTime: 1 });
scheduleEventSchema.index({ startTime: 1, endTime: 1 });

// Update timestamp on save
scheduleEventSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const ScheduleEvent = mongoose.model('ScheduleEvent', scheduleEventSchema);

module.exports = ScheduleEvent;