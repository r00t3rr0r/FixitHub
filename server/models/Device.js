const mongoose = require('mongoose');

const deviceModelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeviceBrand',
    required: true
  },
  deviceType: {
    type: String,
    required: true,
    enum: ['smartphone', 'tablet', 'laptop', 'smartwatch', 'gaming-console']
  },
  image: {
    type: String,
    default: ''
  },
  specifications: {
    type: Map,
    of: String,
    default: {}
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const deviceBrandSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  logo: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamps before saving
deviceModelSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

deviceBrandSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Indexes for better performance
deviceModelSchema.index({ brandId: 1, deviceType: 1 });
deviceModelSchema.index({ name: 1 });
// deviceBrandSchema name already has unique: true index at line 46, no need for duplicate

const DeviceModel = mongoose.model('DeviceModel', deviceModelSchema);
const DeviceBrand = mongoose.model('DeviceBrand', deviceBrandSchema);

module.exports = {
  DeviceModel,
  DeviceBrand
};