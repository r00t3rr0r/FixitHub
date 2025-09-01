const mongoose = require('mongoose');

const performanceMetricSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  period: {
    type: String,
    required: true // Format: YYYY-MM
  },
  metrics: {
    ordersCompleted: {
      type: Number,
      default: 0
    },
    averageCompletionTime: {
      type: Number,
      default: 0 // in hours
    },
    customerSatisfaction: {
      type: Number,
      default: 0 // 1-5 rating
    },
    efficiency: {
      type: Number,
      default: 0 // percentage
    },
    qualityScore: {
      type: Number,
      default: 0 // percentage
    },
    revenue: {
      type: Number,
      default: 0
    },
    hoursWorked: {
      type: Number,
      default: 0
    }
  },
  goals: {
    ordersTarget: {
      type: Number,
      default: 0
    },
    revenueTarget: {
      type: Number,
      default: 0
    },
    satisfactionTarget: {
      type: Number,
      default: 4.5
    }
  },
  achievements: [{
    title: String,
    description: String,
    earnedAt: Date,
    icon: String
  }],
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

// Compound index for efficient queries
performanceMetricSchema.index({ staffId: 1, period: 1 }, { unique: true });

// Update timestamp on save
performanceMetricSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const PerformanceMetric = mongoose.model('PerformanceMetric', performanceMetricSchema);

module.exports = PerformanceMetric;