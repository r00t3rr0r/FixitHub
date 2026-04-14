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
    enum: ['payment', 'email', 'sms', 'push', 'storage', 'analytics', 'shipping'],
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
    type: mongoose.Schema.Types.Mixed,
    default: {}
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
    requiresAuthentication: {
      type: Boolean,
      default: true
    },
    requiresTLS: {
      type: Boolean,
      default: true
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
  notificationTemplateDefaultsVersion: {
    type: Number,
    default: 0
  },

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

  // Financial Settings
  financialSettings: {
    defaults: {
      currency: {
        type: String,
        default: 'EUR'
      },
      locale: {
        type: String,
        default: 'de-DE'
      },
      taxRate: {
        type: Number,
        default: 19
      },
      defaultDiscount: {
        type: Number,
        default: 0
      },
      paymentTerms: {
        type: String,
        default: 'Net 14'
      },
      paymentDueDays: {
        type: Number,
        default: 14
      },
      invoicePrefix: {
        type: String,
        default: 'INV-'
      },
      creditNotePrefix: {
        type: String,
        default: 'CN'
      },
      defaultPaymentMethod: {
        type: String,
        enum: ['credit_card', 'debit_card', 'paypal', 'stripe', 'bank_transfer'],
        default: 'bank_transfer'
      }
    },
    discountPolicy: {
      allowManualDiscounts: {
        type: Boolean,
        default: true
      },
      maxDiscountPercent: {
        type: Number,
        default: 20
      },
      earlyPaymentDiscountPercent: {
        type: Number,
        default: 2
      },
      lateFeePercent: {
        type: Number,
        default: 5
      }
    },
    invoiceMetadata: {
      sellerName: {
        type: String,
        default: 'FixitHub'
      },
      sellerVatId: {
        type: String,
        default: ''
      },
      sellerRegistrationNumber: {
        type: String,
        default: ''
      },
      issuerEmail: {
        type: String,
        default: 'billing@fixithub.com'
      },
      issuerPhone: {
        type: String,
        default: ''
      },
      invoiceFooter: {
        type: String,
        default: 'Vielen Dank fuer Ihr Vertrauen.'
      },
      legalFooter: {
        type: String,
        default: 'Diese Nachricht wurde automatisch erstellt.'
      }
    },
    paymentPreferences: {
      partialPaymentsAllowed: {
        type: Boolean,
        default: true
      },
      autoAttachPdf: {
        type: Boolean,
        default: true
      },
      sendInternalCopy: {
        type: Boolean,
        default: false
      },
      internalCopyEmail: {
        type: String,
        default: ''
      },
      showTaxBreakdown: {
        type: Boolean,
        default: true
      },
      showDiscountBreakdown: {
        type: Boolean,
        default: true
      },
      defaultVisualTheme: {
        type: String,
        enum: ['classic', 'modern', 'minimal'],
        default: 'modern'
      },
      accentColor: {
        type: String,
        default: '#1a2a5e'
      }
    }
  },

  profitabilitySettings: {
    labor: {
      defaultHourlyRate: {
        type: Number,
        default: 92
      },
      includeTrackedTimeOnly: {
        type: Boolean,
        default: true
      },
      fallbackProgressWeight: {
        type: Number,
        default: 0.72
      },
      minimumProgressFactor: {
        type: Number,
        default: 0.18
      },
      productHandlingMinutes: {
        type: Number,
        default: 8
      }
    },
    materials: {
      repairMaterialBaseRate: {
        type: Number,
        default: 0.2
      },
      repairMaterialPerServiceRate: {
        type: Number,
        default: 0.035
      },
      minimumRepairMaterialRate: {
        type: Number,
        default: 0.18
      },
      maximumRepairMaterialRate: {
        type: Number,
        default: 0.42
      },
      productMaterialRate: {
        type: Number,
        default: 0.72
      },
      fallbackShopProductCostRate: {
        type: Number,
        default: 0.65
      }
    },
    subcontracting: {
      enabled: {
        type: Boolean,
        default: true
      },
      defaultRate: {
        type: Number,
        default: 0.12
      },
      keywords: {
        type: [String],
        default: ['logic', 'board', 'micro', 'solder', 'wasser', 'water', 'daten', 'data']
      }
    },
    overhead: {
      monthlyRent: {
        type: Number,
        default: 2600
      },
      monthlyUtilities: {
        type: Number,
        default: 580
      },
      monthlyAdminPayroll: {
        type: Number,
        default: 4200
      },
      monthlySoftware: {
        type: Number,
        default: 480
      },
      monthlyInsurance: {
        type: Number,
        default: 340
      },
      monthlyMarketing: {
        type: Number,
        default: 690
      },
      monthlyOtherFixedCosts: {
        type: Number,
        default: 520
      },
      targetMonthlyBillableHours: {
        type: Number,
        default: 480
      }
    },
    depreciation: {
      monthlyEquipmentDepreciation: {
        type: Number,
        default: 780
      }
    },
    otherCosts: {
      packagingRate: {
        type: Number,
        default: 0.01
      },
      paymentFeeRate: {
        type: Number,
        default: 0.015
      },
      flatShippingCostPerBooking: {
        type: Number,
        default: 6.9
      },
      warrantyReserveRate: {
        type: Number,
        default: 0.02
      }
    },
    warranty: {
      keywords: {
        type: [String],
        default: ['nacharbeit', 'rework', 'warranty', 'garantie', 'gewaehr']
      },
      defaultLabel: {
        type: String,
        default: '90 Tage Standard'
      },
      flaggedLabel: {
        type: String,
        default: 'Nacharbeit / Gewaehrleistung'
      }
    },
    formula: {
      profitWeights: {
        netRevenue: {
          type: Number,
          default: 1
        },
        directCosts: {
          type: Number,
          default: 1
        },
        overheadCost: {
          type: Number,
          default: 1
        },
        depreciationCost: {
          type: Number,
          default: 1
        },
        otherOperatingCost: {
          type: Number,
          default: 1
        }
      },
      operatingCostWeights: {
        packaging: {
          type: Number,
          default: 1
        },
        paymentFallback: {
          type: Number,
          default: 1
        },
        paymentGateway: {
          type: Number,
          default: 1
        },
        warrantyReserve: {
          type: Number,
          default: 1
        },
        orderShipping: {
          type: Number,
          default: 1
        },
        bookingFlatShipping: {
          type: Number,
          default: 1
        }
      }
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