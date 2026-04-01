const mongoose = require('mongoose');

const affiliateAttributionSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  sourceType: {
    type: String,
    enum: ['affiliate', 'campaign', 'referral_code', 'partner'],
    required: true,
  },
  affiliateId: {
    type: String,
    default: '',
  },
  campaignId: {
    type: String,
    default: '',
  },
  referralCode: {
    type: String,
    default: '',
  },
  attributionModel: {
    type: String,
    enum: ['first_click', 'last_click', 'fixed_source'],
    default: 'last_click',
  },
  sourceLocked: {
    type: Boolean,
    default: false,
  },
  firstTouchAt: Date,
  lastTouchAt: Date,
  conversionEvent: {
    type: String,
    enum: ['signup', 'first_order', 'invoice_paid'],
    default: 'signup',
  },
  metadata: {
    utmSource: String,
    utmCampaign: String,
    landingPage: String,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.models.AffiliateAttribution || mongoose.model('AffiliateAttribution', affiliateAttributionSchema);