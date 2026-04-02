const mongoose = require('mongoose');

const ruleConditionSchema = new mongoose.Schema({
  field: {
    type: String,
    required: true,
  },
  operator: {
    type: String,
    required: true,
    enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains'],
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
}, { _id: false });

const customerGroupRuleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'archived'],
    default: 'draft',
  },
  priority: {
    type: Number,
    default: 0,
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomerGroup',
    required: true,
  },
  stopProcessing: {
    type: Boolean,
    default: false,
  },
  exclusivityMode: {
    type: String,
    enum: ['normal', 'exclusive', 'fallback_only'],
    default: 'normal',
  },
  conditions: [ruleConditionSchema],
  excludedIf: [ruleConditionSchema],
  validFrom: {
    type: Date,
  },
  validUntil: {
    type: Date,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.models.CustomerGroupRule || mongoose.model('CustomerGroupRule', customerGroupRuleSchema);