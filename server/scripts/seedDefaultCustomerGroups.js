const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const CustomerGroup = require('../models/CustomerGroup');

const GROUPS = [
  {
    key: 'standard-retail',
    name: 'Standard Retail',
    description: 'System-Fallbackgruppe fuer Standardkunden ohne spezielle Regelzuordnung.',
    status: 'active',
    priority: 20,
    mode: 'standard',
    isExclusive: false,
    isDefault: true,
    assignmentMode: {
      allowManual: true,
      allowRuleBased: true,
      allowApi: true,
    },
    financeProfile: {
      discountPercent: 0,
      paymentDueDays: 14,
      cashDiscountPercent: 0,
      cashDiscountDays: 0,
      creditLimit: 0,
      currency: 'EUR',
      taxMode: 'default',
      paymentTermsLabel: 'Net 14',
      invoicePrefix: 'STD-',
      invoiceProfile: {
        invoiceSeries: 'STD-2026',
        consolidateInvoices: false,
        splitByOrderType: false,
        requireManualApprovalAbove: 0,
      },
      allowedPaymentMethods: ['bank_transfer', 'paypal', 'credit_card'],
    },
    affiliateProfile: {
      attributionModel: 'last_click',
      fixedAffiliateId: '',
      defaultCommissionType: 'percentage',
      defaultCommissionValue: 5,
      releaseTrigger: 'invoice_paid',
      holdDays: 14,
      allowProductOverrides: true,
    },
    conflictPolicy: {
      resolutionStrategy: 'priority',
      fallbackGroupId: null,
      excludedGroupIds: [],
    },
    metadata: {
      tags: ['fallback', 'retail'],
      notes: 'Automatischer Fallback fuer alle Kunden ohne Match.',
    },
  },
  {
    key: 'vip-premium',
    name: 'VIP Premium',
    description: 'Premium-Endkunden mit erweiterten Konditionen und priorisierter Betreuung.',
    status: 'active',
    priority: 90,
    mode: 'vip',
    isExclusive: true,
    isDefault: false,
    assignmentMode: {
      allowManual: true,
      allowRuleBased: true,
      allowApi: true,
    },
    financeProfile: {
      discountPercent: 12,
      paymentDueDays: 30,
      cashDiscountPercent: 2,
      cashDiscountDays: 10,
      creditLimit: 2500,
      currency: 'EUR',
      taxMode: 'default',
      paymentTermsLabel: 'Net 30',
      invoicePrefix: 'VIP-',
      invoiceProfile: {
        invoiceSeries: 'VIP-2026',
        consolidateInvoices: true,
        splitByOrderType: false,
        requireManualApprovalAbove: 1500,
      },
      allowedPaymentMethods: ['bank_transfer', 'paypal', 'credit_card'],
    },
    affiliateProfile: {
      attributionModel: 'last_click',
      fixedAffiliateId: '',
      defaultCommissionType: 'percentage',
      defaultCommissionValue: 8,
      releaseTrigger: 'invoice_paid',
      holdDays: 21,
      allowProductOverrides: true,
    },
    conflictPolicy: {
      resolutionStrategy: 'exclusive_first',
      fallbackGroupId: null,
      excludedGroupIds: [],
    },
    metadata: {
      tags: ['vip', 'premium'],
      notes: 'Nur fuer verifizierte Top-Kunden vorgesehen.',
    },
  },
  {
    key: 'b2b-business',
    name: 'B2B Business',
    description: 'Geschaeftskunden mit erweitertem Zahlungsziel und B2B-Rechnungsprofil.',
    status: 'active',
    priority: 80,
    mode: 'b2b',
    isExclusive: false,
    isDefault: false,
    assignmentMode: {
      allowManual: true,
      allowRuleBased: true,
      allowApi: true,
    },
    financeProfile: {
      discountPercent: 5,
      paymentDueDays: 30,
      cashDiscountPercent: 1,
      cashDiscountDays: 7,
      creditLimit: 7500,
      currency: 'EUR',
      taxMode: 'reverse_charge',
      paymentTermsLabel: 'Net 30 (B2B)',
      invoicePrefix: 'B2B-',
      invoiceProfile: {
        invoiceSeries: 'B2B-2026',
        consolidateInvoices: true,
        splitByOrderType: true,
        requireManualApprovalAbove: 2500,
      },
      allowedPaymentMethods: ['bank_transfer', 'debit_card'],
    },
    affiliateProfile: {
      attributionModel: 'first_click',
      fixedAffiliateId: '',
      defaultCommissionType: 'percentage',
      defaultCommissionValue: 4,
      releaseTrigger: 'invoice_paid',
      holdDays: 14,
      allowProductOverrides: false,
    },
    conflictPolicy: {
      resolutionStrategy: 'priority',
      fallbackGroupId: null,
      excludedGroupIds: [],
    },
    metadata: {
      tags: ['b2b', 'business'],
      notes: 'Fokus auf Firmenkunden mit Rechnungs- und Freigabeprozess.',
    },
  },
  {
    key: 'affiliate-performance',
    name: 'Affiliate Performance',
    description: 'Kunden mit starker Affiliate-Herkunft und provisionsorientierter Steuerung.',
    status: 'active',
    priority: 70,
    mode: 'affiliate',
    isExclusive: false,
    isDefault: false,
    assignmentMode: {
      allowManual: true,
      allowRuleBased: true,
      allowApi: true,
    },
    financeProfile: {
      discountPercent: 3,
      paymentDueDays: 14,
      cashDiscountPercent: 0,
      cashDiscountDays: 0,
      creditLimit: 1000,
      currency: 'EUR',
      taxMode: 'default',
      paymentTermsLabel: 'Net 14',
      invoicePrefix: 'AFF-',
      invoiceProfile: {
        invoiceSeries: 'AFF-2026',
        consolidateInvoices: false,
        splitByOrderType: false,
        requireManualApprovalAbove: 1000,
      },
      allowedPaymentMethods: ['bank_transfer', 'paypal'],
    },
    affiliateProfile: {
      attributionModel: 'fixed_source',
      fixedAffiliateId: 'default-affiliate-source',
      defaultCommissionType: 'percentage',
      defaultCommissionValue: 10,
      releaseTrigger: 'invoice_paid',
      holdDays: 30,
      allowProductOverrides: true,
    },
    conflictPolicy: {
      resolutionStrategy: 'manual_first',
      fallbackGroupId: null,
      excludedGroupIds: [],
    },
    metadata: {
      tags: ['affiliate', 'performance'],
      notes: 'Provisionen werden erst nach Zahlungs-Trigger und Hold-Phase freigegeben.',
    },
  },
];

async function run() {
  console.log('Seeding default customer groups started...');
  await connectDB();

  try {
    const createdOrUpdated = [];

    await CustomerGroup.updateMany({ isDefault: true }, { $set: { isDefault: false } });

    for (const groupConfig of GROUPS) {
      const group = await CustomerGroup.findOneAndUpdate(
        { key: groupConfig.key },
        { $set: groupConfig },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      createdOrUpdated.push({
        id: String(group._id),
        key: group.key,
        name: group.name,
        priority: group.priority,
        isDefault: group.isDefault,
        mode: group.mode,
      });
    }

    console.log('Done. Customer groups created/updated:');
    createdOrUpdated.forEach((item) => {
      console.log(`- ${item.name} (${item.key}) | mode=${item.mode} | priority=${item.priority} | default=${item.isDefault}`);
    });
  } finally {
    await mongoose.connection.close();
  }
}

run().catch((error) => {
  console.error('Seeding default customer groups failed:', error);
  process.exit(1);
});
