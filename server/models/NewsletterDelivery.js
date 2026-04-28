const mongoose = require('mongoose');

const newsletterDeliverySchema = new mongoose.Schema(
  {
    newsletterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Newsletter',
      required: true,
      index: true,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MarketingCampaign',
      default: null,
      index: true,
    },
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MarketingSegment',
      default: null,
      index: true,
    },
    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    isTest: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'failed', 'bounced', 'opened', 'clicked', 'unsubscribed'],
      default: 'queued',
      index: true,
    },
    providerMessageId: {
      type: String,
      default: '',
      trim: true,
    },
    error: {
      type: String,
      default: '',
      maxlength: 5000,
    },
    openedAt: Date,
    clickedAt: Date,
    sentAt: Date,
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'newsletter_deliveries',
  }
);

newsletterDeliverySchema.index({ newsletterId: 1, createdAt: -1 });
newsletterDeliverySchema.index({ recipientEmail: 1, newsletterId: 1 });

const NewsletterDelivery = mongoose.model('NewsletterDelivery', newsletterDeliverySchema);

module.exports = NewsletterDelivery;
