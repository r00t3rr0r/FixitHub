const mongoose = require('mongoose');

const marketingCampaignSchema = new mongoose.Schema(
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
      enum: ['draft', 'active', 'archived'],
      default: 'draft',
    },
    newsletterIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Newsletter',
      },
    ],
    promoCodeIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PromoCode',
      },
    ],
    startDate: Date,
    endDate: Date,
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
    collection: 'marketing_campaigns',
  }
);

marketingCampaignSchema.index({ status: 1, createdAt: -1 });
marketingCampaignSchema.index({ internalName: 'text', description: 'text' });

const MarketingCampaign = mongoose.model('MarketingCampaign', marketingCampaignSchema);

module.exports = MarketingCampaign;
