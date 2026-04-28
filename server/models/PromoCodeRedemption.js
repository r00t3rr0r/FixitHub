const mongoose = require('mongoose');

const promoCodeRedemptionSchema = new mongoose.Schema(
  {
    promoCodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PromoCode',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    orderAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    discountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    currency: {
      type: String,
      default: 'EUR',
      trim: true,
      maxlength: 16,
    },
    redeemedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'promo_code_redemptions',
  }
);

promoCodeRedemptionSchema.index({ promoCodeId: 1, redeemedAt: -1 });
promoCodeRedemptionSchema.index({ customerId: 1, promoCodeId: 1, redeemedAt: -1 });

const PromoCodeRedemption = mongoose.model('PromoCodeRedemption', promoCodeRedemptionSchema);

module.exports = PromoCodeRedemption;
