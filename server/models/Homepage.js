const mongoose = require('mongoose');

// Content Block Schema with enhanced settings
const contentBlockSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['hero', 'about', 'services', 'blog', 'shop', 'testimonials', 'contact', 'cta', 'gallery', 'banner', 'features', 'stats', 'footer', 'html']
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
    },
    // Advanced visual settings
    opacity: {
      type: Number,
      default: 1,
      min: 0,
      max: 1
    },
    borderRadius: {
      type: String,
      default: '0px'
    },
    borderWidth: {
      type: String,
      default: '0px'
    },
    borderColor: {
      type: String,
      default: '#000000'
    },
    borderStyle: {
      type: String,
      enum: ['none', 'solid', 'dashed', 'dotted'],
      default: 'none'
    },
    boxShadow: {
      type: String,
      default: 'none'
    },
    transform: {
      type: String,
      default: 'none'
    },
    transition: {
      type: String,
      default: 'none'
    },
    zIndex: {
      type: Number,
      default: 0
    },
    overflow: {
      type: String,
      enum: ['visible', 'hidden', 'scroll', 'auto'],
      default: 'visible'
    },
    filter: {
      type: String,
      default: 'none'
    },
    backdropFilter: {
      type: String,
      default: 'none'
    },
    gradient: {
      enabled: {
        type: Boolean,
        default: false
      },
      type: {
        type: String,
        enum: ['linear', 'radial'],
        default: 'linear'
      },
      direction: {
        type: String,
        default: 'to right'
      },
      colors: [{
        type: String
      }]
    },
    visualEffects: {
      blur: {
        type: Number,
        default: 0
      },
      brightness: {
        type: Number,
        default: 1
      },
      contrast: {
        type: Number,
        default: 1
      },
      saturate: {
        type: Number,
        default: 1
      },
      hueRotate: {
        type: Number,
        default: 0
      },
      sepia: {
        type: Number,
        default: 0
      },
      grayscale: {
        type: Number,
        default: 0
      }
    },
    hover: {
      backgroundColor: {
        type: String
      },
      textColor: {
        type: String
      },
      transform: {
        type: String
      },
      opacity: {
        type: Number
      },
      transition: {
        type: String
      }
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

// Homepage Section Schema with enhanced settings
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
  },
  settings: {
    backgroundColor: {
      type: String,
      default: '#ffffff'
    },
    backgroundImage: {
      type: String,
      default: ''
    },
    padding: {
      type: String,
      default: '60px 0'
    },
    margin: {
      type: String,
      default: '0px'
    },
    minHeight: {
      type: String,
      default: 'auto'
    },
    maxWidth: {
      type: String,
      default: '100%'
    },
    opacity: {
      type: Number,
      default: 1,
      min: 0,
      max: 1
    },
    borderRadius: {
      type: String,
      default: '0px'
    },
    borderWidth: {
      type: String,
      default: '0px'
    },
    borderColor: {
      type: String,
      default: '#000000'
    },
    borderStyle: {
      type: String,
      enum: ['none', 'solid', 'dashed', 'dotted'],
      default: 'none'
    },
    boxShadow: {
      type: String,
      default: 'none'
    },
    transform: {
      type: String,
      default: 'none'
    },
    transition: {
      type: String,
      default: 'none'
    },
    zIndex: {
      type: Number,
      default: 0
    },
    overflow: {
      type: String,
      enum: ['visible', 'hidden', 'scroll', 'auto'],
      default: 'visible'
    },
    filter: {
      type: String,
      default: 'none'
    },
    backdropFilter: {
      type: String,
      default: 'none'
    },
    gradient: {
      enabled: {
        type: Boolean,
        default: false
      },
      type: {
        type: String,
        enum: ['linear', 'radial'],
        default: 'linear'
      },
      direction: {
        type: String,
        default: 'to right'
      },
      colors: [{
        type: String
      }]
    },
    visualEffects: {
      blur: {
        type: Number,
        default: 0
      },
      brightness: {
        type: Number,
        default: 1
      },
      contrast: {
        type: Number,
        default: 1
      },
      saturate: {
        type: Number,
        default: 1
      },
      hueRotate: {
        type: Number,
        default: 0
      },
      sepia: {
        type: Number,
        default: 0
      },
      grayscale: {
        type: Number,
        default: 0
      }
    },
    customHTML: {
      type: String,
      default: ''
    },
    customCSS: {
      type: String,
      default: ''
    }
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

// Create standalone HomepageSection model for compatibility
const homepageSectionStandaloneSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['hero', 'about', 'services', 'blog', 'shop', 'testimonials', 'contact', 'cta', 'gallery', 'banner', 'features', 'stats', 'footer', 'html']
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
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    required: true,
    default: 0
  }
}, {
  timestamps: true,
  versionKey: false
});

const LayoutTemplate = mongoose.model('LayoutTemplate', layoutTemplateSchema);
const ABTest = mongoose.model('ABTest', abTestSchema);
const HomepageSection = mongoose.model('HomepageSection', homepageSectionStandaloneSchema);

module.exports = {
  LayoutTemplate,
  ABTest,
  HomepageSection
};