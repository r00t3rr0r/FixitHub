const mongoose = require('mongoose');

const workflowStepSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  estimatedTime: {
    type: Number,
    required: true,
    min: 0,
  },
  isRequired: {
    type: Boolean,
    default: true,
  },
  order: {
    type: Number,
    required: true,
    min: 1,
  },
  category: {
    type: String,
    enum: ['diagnostic', 'repair', 'quality', 'addon', 'completion'],
    required: true,
  },
  dependencies: [{
    type: String,
  }],
  tools: [{
    type: String,
  }],
  skills: [{
    type: String,
  }],
  checklistItems: [{
    type: String,
  }],
}, { _id: true });

const workflowTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  deviceTypes: [{
    type: String,
    required: true,
  }],
  serviceTypes: [{
    type: String,
    required: true,
  }],
  steps: [workflowStepSchema],
  estimatedTotalTime: {
    type: Number,
    required: true,
    min: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
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

const addOnWorkflowSchema = new mongoose.Schema({
  addOnServiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AddOnService',
    required: true,
  },
  addOnServiceName: {
    type: String,
    required: true,
  },
  optimalTiming: {
    type: String,
    enum: ['before_repair', 'during_repair', 'after_repair', 'flexible'],
    required: true,
  },
  dependencies: [{
    type: String,
  }],
  estimatedTime: {
    type: Number,
    required: true,
    min: 0,
  },
  instructions: {
    type: String,
    required: true,
  },
  qualityChecks: [{
    type: String,
  }],
  isActive: {
    type: Boolean,
    default: true,
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

// Update timestamps before saving
workflowTemplateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate total estimated time from steps
  if (this.steps && this.steps.length > 0) {
    this.estimatedTotalTime = this.steps.reduce((total, step) => total + step.estimatedTime, 0);
  }
  
  next();
});

addOnWorkflowSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Populate add-on service details when querying
addOnWorkflowSchema.pre(/^find/, function(next) {
  this.populate('addOnServiceId', 'name description price category');
  next();
});

const WorkflowTemplate = mongoose.model('WorkflowTemplate', workflowTemplateSchema);
const AddOnWorkflow = mongoose.model('AddOnWorkflow', addOnWorkflowSchema);

module.exports = {
  WorkflowTemplate,
  AddOnWorkflow
};