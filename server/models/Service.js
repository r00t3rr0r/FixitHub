const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  articleNumber: {
    type: String,
    trim: true,
    default: ''
  },
  shortDescription: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  printShortDescription: {
    type: String,
    default: ''
  },
  printDescription: {
    type: String,
    default: ''
  },
  note: {
    type: String,
    default: ''
  },
  searchKeywords: {
    type: String,
    default: ''
  },
  seoName: {
    type: String,
    trim: true,
    default: ''
  },
  seoTitleTag: {
    type: String,
    trim: true,
    default: ''
  },
  seoMetaKeywords: {
    type: String,
    default: ''
  },
  seoMetaDescription: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  priceGrossCategory: {
    type: Number,
    default: 0,
    min: 0
  },
  priceGrossJtl: {
    type: Number,
    default: 0,
    min: 0
  },
  priceNet: {
    type: Number,
    default: 0,
    min: 0
  },
  priceNetCategory: {
    type: Number,
    default: 0,
    min: 0
  },
  priceNetJtl: {
    type: Number,
    default: 0,
    min: 0
  },
  purchasePrice: {
    type: Number,
    default: 0,
    min: 0
  },
  msrp: {
    type: Number,
    default: 0,
    min: 0
  },
  taxClass: {
    type: String,
    trim: true,
    default: ''
  },
  source: {
    type: String,
    trim: true,
    default: ''
  },
  estimatedTime: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    required: true,
    // Support both hardcoded categories and dynamic categories from ServiceCategory model
    // No enum validation to allow dynamic categories
    trim: true
  },
  service: {
    type: String,
    trim: true,
    default: ''
  },
  color: {
    type: String,
    trim: true,
    default: ''
  },
  deviceType: {
    type: String,
    trim: true,
    default: ''
  },
  deviceTypes: [{
    type: String
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