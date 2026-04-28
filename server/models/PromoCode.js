const mongoose = require('mongoose');

const promoCodeRuleSchema = new mongoose.Schema(
  {
    minimumOrderValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    usageLimitTotal: {
      type: Number,
      min: 0,
      default: 0,
    },
    usageLimitPerCustomer: {
      type: Number,
      min: 0,
      default: 0,
    },
    combinable: {
      type: Boolean,
      default: false,
    },
    productIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    serviceCategoryIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceCategory',
      },
    ],
    customerGroupIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CustomerGroup',
      },
    ],
  },
  { _id: false }
);

const promoCodeSchema = new mongoose.Schema(
  {
    internalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      unique: true,
      minlength: 3,
      maxlength: 40,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 5000,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed_amount'],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'inactive', 'expired', 'archived'],
      default: 'draft',
    },
    rules: {
      type: promoCodeRuleSchema,
      default: () => ({}),
    },
    usageCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    discountVolume: {
      type: Number,
      min: 0,
      default: 0,
    },
    revenueAttributed: {
      type: Number,
      min: 0,
      default: 0,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MarketingCampaign',
      default: null,
    },
    newsletterIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Newsletter',
      },
    ],
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
    collection: 'promo_codes',
  }
);

promoCodeSchema.index({ code: 1 }, { unique: true });
promoCodeSchema.index({ status: 1, startDate: 1, endDate: 1 });
promoCodeSchema.index({ internalName: 'text', code: 'text', description: 'text' });

const PromoCode = mongoose.model('PromoCode', promoCodeSchema);

module.exports = PromoCode;
