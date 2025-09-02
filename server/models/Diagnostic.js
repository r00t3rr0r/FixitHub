const mongoose = require('mongoose');

const diagnosticStepSchema = new mongoose.Schema({
  order: {
    type: Number,
    required: true
  },
  instruction: {
    type: String,
    required: true
  },
  expectedResult: {
    type: String,
    required: true
  },
  tools: [{
    type: String
  }],
  warningNotes: {
    type: String
  }
}, {
  _id: true,
  versionKey: false
});

const troubleshootingStepSchema = new mongoose.Schema({
  issue: {
    type: String,
    required: true
  },
  symptoms: [{
    type: String
  }],
  solutions: [{
    type: String
  }],
  escalationRequired: {
    type: Boolean,
    default: false
  }
}, {
  _id: true,
  versionKey: false
});

const diagnosticTestSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  deviceTypes: [{
    type: String,
    required: true
  }],
  category: {
    type: String,
    required: true,
    enum: ['hardware', 'software', 'performance', 'connectivity']
  },
  estimatedTime: {
    type: Number,
    required: true,
    min: 1
  },
  tools: [{
    type: String
  }],
  steps: [diagnosticStepSchema],
  passFailCriteria: [{
    type: String
  }],
  troubleshootingGuide: [troubleshootingStepSchema],
  isActive: {
    type: Boolean,
    default: true
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

const formFieldSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['text', 'number', 'boolean', 'select', 'multiselect', 'textarea', 'file']
  },
  required: {
    type: Boolean,
    default: false
  },
  options: [{
    type: String
  }],
  validation: {
    min: Number,
    max: Number,
    pattern: String
  }
}, {
  _id: true,
  versionKey: false
});

const diagnosticFormSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  deviceTypes: [{
    type: String,
    required: true
  }],
  fields: [formFieldSchema],
  isActive: {
    type: Boolean,
    default: true
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

const testResultSchema = new mongoose.Schema({
  stepId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  stepName: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pass', 'fail', 'warning', 'skipped']
  },
  actualResult: {
    type: String,
    required: true
  },
  notes: {
    type: String
  }
}, {
  _id: true,
  versionKey: false
});

const diagnosticResultSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiagnosticTest',
    required: true
  },
  testName: {
    type: String,
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  results: [testResultSchema],
  overallStatus: {
    type: String,
    required: true,
    enum: ['pass', 'fail', 'warning']
  },
  notes: {
    type: String
  },
  recommendedActions: [{
    type: String
  }],
  photos: [{
    type: String
  }],
  performedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  versionKey: false
});

// Indexes for better query performance
diagnosticTestSchema.index({ category: 1, deviceTypes: 1 });
diagnosticTestSchema.index({ isActive: 1 });
diagnosticFormSchema.index({ deviceTypes: 1, isActive: 1 });
diagnosticResultSchema.index({ orderId: 1, performedBy: 1 });

// Update timestamp on save
diagnosticTestSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

diagnosticFormSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const DiagnosticTest = mongoose.model('DiagnosticTest', diagnosticTestSchema);
const DiagnosticForm = mongoose.model('DiagnosticForm', diagnosticFormSchema);
const DiagnosticResult = mongoose.model('DiagnosticResult', diagnosticResultSchema);

module.exports = {
  DiagnosticTest,
  DiagnosticForm,
  DiagnosticResult
};