const mongoose = require('mongoose');

// Content Block Schema
const contentBlockSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['hero', 'services', 'testimonials', 'cta', 'gallery', 'banner', 'features', 'stats', 'html']
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  settings: {
    backgroundColor: {
      type: String,
      default: '#ffffff'
    },
    textColor: {
      type: String,
      default: '#000000'
    },
    padding: {
      type: String,
      default: '20px'
    },
    margin: {
      type: String,
      default: '0px'
    },
    alignment: {
      type: String,
      enum: ['left', 'center', 'right'],
      default: 'left'
    },
    animation: {
      type: String,
      default: 'none'
    },
    customCSS: {
      type: String,
      default: ''
    }
  },
  order: {
    type: Number,
    required: true,
    default: 0
  },
  isVisible: {
    type: Boolean,
    default: true
  }
}, {
  _id: true,
  versionKey: false
});

// Homepage Section Schema
const homepageSectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  blocks: [contentBlockSchema],
  layout: {
    type: String,
    enum: ['single', 'two-column', 'three-column', 'grid'],
    default: 'single'
  },
  order: {
    type: Number,
    required: true,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  _id: true,
  versionKey: false
});

// Layout Template Schema
const layoutTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  preview: {
    type: String,
    default: ''
  },
  sections: [homepageSectionSchema],
  colorScheme: {
    primary: {
      type: String,
      default: '#3b82f6'
    },
    secondary: {
      type: String,
      default: '#1e40af'
    },
    accent: {
      type: String,
      default: '#10b981'
    },
    background: {
      type: String,
      default: '#ffffff'
    },
    text: {
      type: String,
      default: '#1f2937'
    }
  },
  typography: {
    headingFont: {
      type: String,
      default: 'Inter'
    },
    bodyFont: {
      type: String,
      default: 'Inter'
    },
    fontSize: {
      type: String,
      default: '16px'
    }
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

// A/B Test Variant Schema
const abTestVariantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LayoutTemplate',
    required: true
  },
  trafficPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  conversions: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },
  conversionRate: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  _id: true,
  versionKey: false
});

// A/B Test Schema
const abTestSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  variants: [abTestVariantSchema],
  status: {
    type: String,
    enum: ['draft', 'running', 'paused', 'completed'],
    default: 'draft'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date
  },
  goal: {
    type: String,
    required: true
  },
  winner: {
    type: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

// Update timestamps on save
layoutTemplateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

abTestSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Indexes for better performance
layoutTemplateSchema.index({ isDefault: 1 });
layoutTemplateSchema.index({ createdBy: 1 });
abTestSchema.index({ status: 1 });
abTestSchema.index({ createdBy: 1 });

const LayoutTemplate = mongoose.model('LayoutTemplate', layoutTemplateSchema);
const ABTest = mongoose.model('ABTest', abTestSchema);

module.exports = {
  LayoutTemplate,
  ABTest
};