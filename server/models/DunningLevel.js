const mongoose = require('mongoose');

const dunningLevelSchema = new mongoose.Schema({
  level: {
    type: Number,
    required: true,
    unique: true,
    min: 1,
    max: 3
  },
  name: {
    type: String,
    required: true
  },
  daysPastDue: {
    type: Number,
    required: true,
    min: 1
  },
  feeGross: {
    type: Number,
    default: 0,
    min: 0
  },
  interestRatePercent: {
    type: Number,
    default: 0,
    min: 0
  },
  emailTemplateKey: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  versionKey: false
});

module.exports = mongoose.model('DunningLevel', dunningLevelSchema);
