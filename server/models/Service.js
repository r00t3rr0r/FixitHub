const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
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
    // Support both hardcoded categories and dynamic categories from ServiceCategory model
    // No enum validation to allow dynamic categories
    trim: true
  },
  deviceTypes: [{
    type: String,
    required: true
  }],
  manufacturer: {
    type: String,
    trim: true,
    default: ''
  },
  manufacturerPrecise: {
    type: String,
    trim: true,
    default: ''
  },
  model: {
    type: String,
    trim: true,
    default: ''
  },
  modelPrecise: {
    type: String,
    trim: true,
    default: ''
  },
  internalRepairInfo: {
    type: String,
    default: ''
  },
  externalRepairInfo: {
    type: String,
    default: ''
  },
  linkedKnowledgeBaseArticles: [{
    articleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Article'
    },
    title: {
      type: String,
      trim: true
    },
    url: {
      type: String,
      trim: true
    }
  }],
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
serviceSchema.pre('save', function(next) {
  if (!this.isNew) {
    this.updatedAt = Date.now();
  }
  next();
});

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;