const mongoose = require('mongoose');

const notificationTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['email', 'sms', 'push'],
    required: true
  },
  subject: {
    type: String,
    required: function() { return this.type === 'email'; }
  },
  content: {
    type: String,
    required: true
  },
  variables: [{
    name: String,
    description: String,
    required: Boolean
  }],
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
}, { _id: true });

const integrationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['payment', 'email', 'sms', 'storage', 'analytics', 'shipping'],
    required: true
  },
  provider: {
    type: String,
    required: true
  },
  apiKey: {
    type: String,
    required: true
  },
  apiSecret: {
    type: String
  },
  endpoint: {
    type: String
  },
  // Flexible credentials object to support different integration requirements
  credentials: {
    apiKey: {
      type: String
    },
    apiSecret: {
      type: String
    },
    apiEndpoint: {
      type: String
    },
    accountId: {
      type: String
    }
  },
  // Flexible metadata object for additional configuration
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastTested: {
    type: Date
  },
  testStatus: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'pending'
  }
}, { _id: true });

const systemConfigurationSchema = new mongoose.Schema({
  // General Settings
  siteName: {
    type: String,
    default: 'FixitHub'
  },
  adminEmail: {
    type: String,
    default: 'admin@fixithub.com'
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  
  // Email Configuration
  emailSettings: {
    smtpHost: {
      type: String,
      default: 'smtp.gmail.com'
    },
    smtpPort: {
      type: Number,
      default: 587
    },
    smtpUsername: {
      type: String,
      default: ''
    },
    smtpPassword: {
      type: String,
      default: ''
    },
    enableNotifications: {
      type: Boolean,
      default: true
    }
  },

  // Notification Settings
  notificationSettings: {
    orderNotifications: {
      type: Boolean,
      default: true
    },
    paymentNotifications: {
      type: Boolean,
      default: true
    },
    systemAlerts: {
      type: Boolean,
      default: true
    }
  },

  // Notification Templates
  notificationTemplates: [notificationTemplateSchema],

  // Workflow Settings
  workflowSettings: {
    autoAssignment: {
      type: Boolean,
      default: false
    },
    requireApproval: {
      type: Boolean,
      default: true
    },
    defaultEstimatedTime: {
      type: Number,
      default: 60
    },
    enableAutomation: {
      type: Boolean,
      default: true
    }
  },

  // Security Settings
  securitySettings: {
    passwordPolicy: {
      minLength: {
        type: Number,
        default: 8
      },
      requireUppercase: {
        type: Boolean,
        default: true
      },
      requireLowercase: {
        type: Boolean,
        default: true
      },
      requireNumbers: {
        type: Boolean,
        default: true
      },
      requireSpecialChars: {
        type: Boolean,
        default: false
      }
    },
    sessionTimeout: {
      type: Number,
      default: 3600 // 1 hour in seconds
    },
    maxLoginAttempts: {
      type: Number,
      default: 5
    },
    lockoutDuration: {
      type: Number,
      default: 900 // 15 minutes in seconds
    },
    enableTwoFactor: {
      type: Boolean,
      default: false
    }
  },

  // Content Settings
  contentSettings: {
    maxImageSize: {
      type: Number,
      default: 5242880 // 5MB in bytes
    },
    maxFileSize: {
      type: Number,
      default: 10485760 // 10MB in bytes
    },
    allowedImageTypes: [{
      type: String,
      default: ['jpg', 'jpeg', 'png', 'gif', 'webp']
    }],
    allowedFileTypes: [{
      type: String,
      default: ['pdf', 'doc', 'docx', 'txt']
    }],
    requireApproval: {
      type: Boolean,
      default: false
    },
    autoOptimizeImages: {
      type: Boolean,
      default: true
    }
  },

  // Shopping Cart Settings
  cartSettings: {
    sessionTimeout: {
      type: Number,
      default: 1800 // 30 minutes
    },
    maxItems: {
      type: Number,
      default: 50
    },
    enableGuestCheckout: {
      type: Boolean,
      default: true
    },
    requirePhone: {
      type: Boolean,
      default: false
    },
    enablePromoCode: {
      type: Boolean,
      default: true
    },
    abandonmentEmailDelay: {
      type: Number,
      default: 3600 // 1 hour
    }
  },

  // Third-party Integrations
  integrations: [integrationSchema],

  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  versionKey: false
});

// Update timestamp before saving
systemConfigurationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Update nested template timestamps
  if (this.notificationTemplates) {
    this.notificationTemplates.forEach(template => {
      if (template.isModified()) {
        template.updatedAt = new Date();
      }
    });
  }
  
  next();
});

const SystemConfiguration = mongoose.model('SystemConfiguration', systemConfigurationSchema);

module.exports = SystemConfiguration;