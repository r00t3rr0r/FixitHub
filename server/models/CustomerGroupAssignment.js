const mongoose = require('mongoose');

const customerGroupAssignmentSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomerGroup',
    required: true,
    index: true,
  },
  assignmentType: {
    type: String,
    enum: ['manual', 'rule', 'api', 'import', 'migration'],
    default: 'manual',
  },
  source: {
    ruleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CustomerGroupRule',
    },
    apiClient: {
      type: String,
      default: '',
    },
    note: {
      type: String,
      default: '',
    },
  },
  isPrimary: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'revoked'],
    default: 'active',
  },
  validFrom: {
    type: Date,
    default: Date.now,
  },
  validUntil: {
    type: Date,
  },
  resolvedPriority: {
    type: Number,
    default: 0,
  },
  resolutionReason: {
    type: String,
    default: '',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

customerGroupAssignmentSchema.index({ customerId: 1, groupId: 1, status: 1 });

module.exports = mongoose.models.CustomerGroupAssignment || mongoose.model('CustomerGroupAssignment', customerGroupAssignmentSchema);