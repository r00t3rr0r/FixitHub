const mongoose = require('mongoose');

const marketingSettingsSchema = new mongoose.Schema(
  {
    defaultFromName: {
      type: String,
      default: 'FixitHub Marketing',
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
