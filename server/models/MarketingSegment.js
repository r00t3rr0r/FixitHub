const mongoose = require('mongoose');

const segmentRuleSchema = new mongoose.Schema(
  {
    roles: [
      {
        type: String,
        enum: ['customer', 'staff', 'admin'],
      },
    ],
    statuses: [
      {
        type: String,
        enum: ['active', 'inactive', 'suspended', 'blocked'],
      },
    ],
    newsletterOptInOnly: {
      type: Boolean,
      default: true,
    },
    includeCustomerGroupIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CustomerGroup',
      },
    ],
    includeCountries: [
      {
        type: String,
        trim: true,
      },
    ],
    minTotalOrders: {
      type: Number,
      min: 0,
      default: 0,
    },
    minTotalSpent: {
      type: Number,
      min: 0,
      default: 0,
    },
    createdAfter: Date,
    createdBefore: Date,
  },
  { _id: false }
);

const marketingSegmentSchema = new mongoose.Schema(
  {
    internalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 5000,
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
    rules: {
      type: segmentRuleSchema,
      default: () => ({}),
    },
    lastPreviewCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    collection: 'marketing_segments',
  }
);

marketingSegmentSchema.index({ status: 1, createdAt: -1 });
marketingSegmentSchema.index({ internalName: 'text', description: 'text' });

const MarketingSegment = mongoose.model('MarketingSegment', marketingSegmentSchema);

module.exports = MarketingSegment;
