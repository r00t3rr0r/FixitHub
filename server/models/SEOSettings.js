const mongoose = require('mongoose');

const seoSettingsSchema = new mongoose.Schema({
  pageType: {
    type: String,
    required: true,
    enum: ['global', 'homepage', 'blog_post', 'product', 'service', 'page']
  },
  pageId: {
    type: String, // Can be ObjectId string or page identifier
    default: ''
  },
  title: {
    type: String,
    required: true,
    maxlength: 60
  },
  description: {
    type: String,
    required: true,
    maxlength: 160
  },
  keywords: [{
    type: String
  }],
  canonicalUrl: {
    type: String,
    default: ''
  },
  openGraph: {
    title: String,
    description: String,
    image: String,
    type: {
      type: String,
      default: 'website'
    },
    url: String
  },
  twitterCard: {
    card: {
      type: String,
      default: 'summary_large_image'
    },
    title: String,
    description: String,
    image: String
  },
  schemaMarkup: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  robots: {
    index: {
      type: Boolean,
      default: true
    },
    follow: {
      type: Boolean,
      default: true
    },
    noarchive: {
      type: Boolean,
      default: false
    },
    nosnippet: {
      type: Boolean,
      default: false
    }
  },
  priority: {
    type: Number,
    default: 0.5,
    min: 0,
    max: 1
  },
  changeFreq: {
    type: String,
    enum: ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'],
    default: 'weekly'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  versionKey: false
});

// Update timestamp on save
seoSettingsSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Indexes for better performance
seoSettingsSchema.index({ pageType: 1, pageId: 1 });
seoSettingsSchema.index({ isActive: 1 });

const SEOSettings = mongoose.model('SEOSettings', seoSettingsSchema);

module.exports = SEOSettings;