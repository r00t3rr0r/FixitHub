const mongoose = require('mongoose');

const addOnServiceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  estimatedTime: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Protection', 'Service', 'Warranty', 'Accessory', 'Data']
  },
  compatibility: [{
    deviceType: {
      type: String,
      required: true
    },
    brands: [{
      type: String
    }]
  }],
  bundleDiscount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  popularity: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  versionKey: false
});

// Update the updatedAt field before saving
addOnServiceSchema.pre('save', function(next) {
  if (!this.isNew) {
    this.updatedAt = Date.now();
  }
  next();
});

const AddOnService = mongoose.model('AddOnService', addOnServiceSchema);

module.exports = AddOnService;