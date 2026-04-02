const mongoose = require('mongoose');

const customerGroupSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'archived'],
    default: 'active',
    index: true,
  },
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 9999,
  },
  mode: {
    type: String,
    enum: ['standard', 'vip', 'b2b', 'affiliate', 'custom'],
    default: 'standard',
  },
  isExclusive: {
    type: Boolean,
    default: false,
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  validFrom: {
    type: Date,
  },
  validUntil: {
    type: Date,
  },
  assignmentMode: {
    allowManual: {
      type: Boolean,
      default: true,
    },
    allowRuleBased: {
      type: Boolean,
      default: true,
    },
    allowApi: {
      type: Boolean,
      default: true,
    },
  },
  financeProfile: {
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    paymentDueDays: {
      type: Number,
      default: 14,
      min: 0,
      max: 365,
    },
    cashDiscountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    cashDiscountDays: {
      type: Number,
      default: 0,
      min: 0,
      max: 365,
    },
    creditLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'EUR',
      trim: true,
      uppercase: true,
    },
    taxMode: {
      type: String,
      enum: ['default', 'tax_free', 'reverse_charge', 'custom'],
      default: 'default',
    },
    paymentTermsLabel: {
      type: String,
      default: 'Net 14',
      trim: true,
    },
    invoicePrefix: {
      type: String,
      default: '',
      trim: true,
    },
    invoiceProfile: {
      invoiceSeries: {
        type: String,
        default: '',
        trim: true,
      },
      consolidateInvoices: {
        type: Boolean,
        default: false,
      },
      splitByOrderType: {
        type: Boolean,
        default: false,
      },
      requireManualApprovalAbove: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    allowedPaymentMethods: [{
      type: String,
      enum: ['credit_card', 'debit_card', 'paypal', 'stripe', 'bank_transfer'],
    }],
  },
  affiliateProfile: {
    attributionModel: {
      type: String,
      enum: ['first_click', 'last_click', 'fixed_source'],
      default: 'last_click',
    },
    defaultCommissionType: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'percentage',
    },
    defaultCommissionValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    fixedAffiliateId: {
      type: String,
      default: '',
      trim: true,
    },
    releaseTrigger: {
      type: String,
      enum: ['order_created', 'order_completed', 'invoice_created', 'invoice_paid'],
      default: 'invoice_paid',
    },
    holdDays: {
      type: Number,
      default: 0,
      min: 0,
      max: 365,
    },
    allowProductOverrides: {
      type: Boolean,
      default: true,
    },
  },
  conflictPolicy: {
    resolutionStrategy: {
      type: String,
      enum: ['priority', 'manual_first', 'exclusive_first'],
      default: 'priority',
    },
    fallbackGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CustomerGroup',
    },
    excludedGroupIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CustomerGroup',
    }],
  },
  metadata: {
    tags: [{
      type: String,
      trim: true,
    }],
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

customerGroupSchema.index({ name: 1 });
customerGroupSchema.index({ status: 1, priority: -1 });

module.exports = mongoose.models.CustomerGroup || mongoose.model('CustomerGroup', customerGroupSchema);