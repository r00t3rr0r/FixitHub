const mongoose = require('mongoose');

const newsletterSchema = new mongoose.Schema(
  {
    internalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
    },
    preheader: {
      type: String,
      default: '',
      trim: true,
      maxlength: 280,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500000,
    },
    templateName: {
      type: String,
      default: 'Allgemeine Systemnachricht',
      trim: true,
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'sending', 'sent', 'failed', 'archived'],
      default: 'draft',
    },
    scheduledAt: Date,
    sentAt: Date,
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MarketingSegment',
      default: null,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MarketingCampaign',
      default: null,
    },
    promoCodeIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PromoCode',
      },
    ],
    recipientSnapshot: {
      total: { type: Number, min: 0, default: 0 },
      emails: [
        {
          type: String,
          trim: true,
          lowercase: true,
        },
      ],
    },
    stats: {
      sent: { type: Number, min: 0, default: 0 },
      opened: { type: Number, min: 0, default: 0 },
      clicked: { type: Number, min: 0, default: 0 },
      bounced: { type: Number, min: 0, default: 0 },
      unsubscribed: { type: Number, min: 0, default: 0 },
      failed: { type: Number, min: 0, default: 0 },
    },
    lastError: {
      type: String,
      default: '',
      maxlength: 5000,
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
    collection: 'newsletters',
  }
);

newsletterSchema.index({ status: 1, createdAt: -1 });
newsletterSchema.index({ scheduledAt: 1 });
newsletterSchema.index({ internalName: 'text', subject: 'text', content: 'text' });

const Newsletter = mongoose.model('Newsletter', newsletterSchema);

module.exports = Newsletter;
