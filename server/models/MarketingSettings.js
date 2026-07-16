const mongoose = require('mongoose');

const marketingSettingsSchema = new mongoose.Schema(
  {
    defaultFromName: {
      type: String,
      default: 'McRepair.de Marketing',
      trim: true,
      maxlength: 160,
    },
    defaultReplyTo: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
      maxlength: 240,
    },
    trackOpens: {
      type: Boolean,
      default: true,
    },
    trackClicks: {
      type: Boolean,
      default: true,
    },
    allowTestSend: {
      type: Boolean,
      default: true,
    },
    maxSendBatchSize: {
      type: Number,
      min: 1,
      default: 200,
    },
    // ADCELL Affiliate Tracking
    adcellEnabled: {
      type: Boolean,
      default: true,
    },
    adcellPid: {
      type: String,
      default: '10419',
      trim: true,
      maxlength: 20,
    },
    adcellEventId: {
      type: String,
      default: '13229',
      trim: true,
      maxlength: 20,
    },
    adcellConversionEnabled: {
      type: Boolean,
      default: true,
    },
    adcellFirstPartyEnabled: {
      type: Boolean,
      default: true,
    },
    adcellContainerTagsEnabled: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    collection: 'marketing_settings',
  }
);

const MarketingSettings = mongoose.model('MarketingSettings', marketingSettingsSchema);

module.exports = MarketingSettings;
