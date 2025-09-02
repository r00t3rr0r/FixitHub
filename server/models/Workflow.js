const mongoose = require('mongoose');

const formFieldSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['text', 'textarea', 'number', 'checkbox', 'radio', 'select', 'multiselect', 'file', 'date', 'time'],
    required: true,
  },
  required: {
    type: Boolean,
    default: false,
  },
  placeholder: {
    type: String,
  },
  helpText: {
    type: String,
  },
  options: [{
    value: String,
    label: String,
  }],
  validation: {
    min: Number,
    max: Number,
    pattern: String,
    minLength: Number,
    maxLength: Number,
  },
  defaultValue: {
    type: mongoose.Schema.Types.Mixed,
  },
  order: {
    type: Number,
    default: 0,
  },
  isConditional: {
    type: Boolean,
    default: false,
  },
  conditionalLogic: {
    dependsOn: String, // field ID
    condition: String, // 'equals', 'not_equals', 'contains', etc.
    value: mongoose.Schema.Types.Mixed,
  }
}, { _id: false });

const automationRuleSchema = new mongoose.Schema({
  trigger: {
    type: String,
    enum: ['step_completion', 'time_delay', 'condition_met', 'manual', 'form_submission'],
    required: true,
  },
  condition: {
    type: String, // JSON string for complex conditions
  },
  action: {
    type: String,
    enum: ['send_notification', 'update_status', 'assign_staff', 'create_task', 'move_to_next_step'],
    required: true,
  },
  actionData: {
    type: mongoose.Schema.Types.Mixed, // Flexible data for action parameters
  },
  isActive: {
    type: Boolean,
    default: true,
  }
});

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
  formFields: [formFieldSchema],
  requiresFormCompletion: {
    type: Boolean,
    default: false,
  },
  automationRules: [automationRuleSchema],
  position: {
    x: {
      type: Number,
      default: 0,
    },
    y: {
      type: Number,
      default: 0,
    }
  },
  canSkip: {
    type: Boolean,
    default: false,
  },
  requiresApproval: {
    type: Boolean,
    default: false,
  },
  notificationSettings: {
    onStart: {
      type: Boolean,
      default: false,
    },
    onComplete: {
      type: Boolean,
      default: false,
    },
    onDelay: {
      type: Boolean,
      default: false,
    }
  }
});

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
  globalAutomationRules: [automationRuleSchema],
  workflowSettings: {
    allowParallelSteps: {
      type: Boolean,
      default: false,
    },
    requireStrictOrder: {
      type: Boolean,
      default: true,
    },
    autoProgressOnCompletion: {
      type: Boolean,
      default: false,
    }
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
  automationRules: [automationRuleSchema],
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

  // Ensure step orders are sequential
  if (this.steps && this.steps.length > 0) {
    this.steps.sort((a, b) => a.order - b.order);
    this.steps.forEach((step, index) => {
      step.order = index + 1;
    });
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