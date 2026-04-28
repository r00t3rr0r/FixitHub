const mongoose = require('mongoose');

const marketingAuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    entityLabel: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    performedByEmail: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    requestContext: {
      ip: { type: String, default: '' },
      userAgent: { type: String, default: '' },
    },
  },
  {
    timestamps: true,
    collection: 'marketing_audit_logs',
  }
);

marketingAuditLogSchema.index({ createdAt: -1, action: 1 });

const MarketingAuditLog = mongoose.model('MarketingAuditLog', marketingAuditLogSchema);

module.exports = MarketingAuditLog;
