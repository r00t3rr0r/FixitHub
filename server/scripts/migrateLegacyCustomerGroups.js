const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const User = require('../models/User');
const CustomerGroup = require('../models/CustomerGroup');

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

async function run() {
  const applyChanges = process.argv.includes('--apply');

  console.log('Customer group migration started');
  console.log('Mode:', applyChanges ? 'apply' : 'dry-run');

  await connectDB();

  try {
    const legacyGroups = await User.aggregate([
      {
        $match: {
          role: 'customer',
          customerGroup: { $exists: true, $nin: ['', null] },
        },
      },
      {
        $group: {
          _id: '$customerGroup',
          customerCount: { $sum: 1 },
        },
      },
      { $sort: { customerCount: -1, _id: 1 } },
    ]);

    if (legacyGroups.length === 0) {
      console.log('No legacy customerGroup strings found.');
      return;
    }

    console.log('Found legacy groups:');
    for (const group of legacyGroups) {
      console.log(`- ${group._id}: ${group.customerCount} customers`);
    }

    const summary = [];

    for (const group of legacyGroups) {
      const key = slugify(group._id);
      if (!key) {
        console.warn(`Skipping invalid legacy group value: ${group._id}`);
        continue;
      }

      const existing = await CustomerGroup.findOne({ key }).lean();
      summary.push({
        name: group._id,
        key,
        customerCount: group.customerCount,
        exists: Boolean(existing),
      });

      if (!applyChanges || existing) {
        continue;
      }

      await CustomerGroup.create({
        key,
        name: group._id,
        description: `Migrated from legacy User.customerGroup value: ${group._id}`,
        status: 'active',
        priority: 10,
        mode: 'custom',
        assignmentMode: {
          allowManual: true,
          allowRuleBased: true,
          allowApi: true,
        },
        financeProfile: {
          paymentDueDays: 14,
          discountPercent: 0,
          cashDiscountPercent: 0,
          cashDiscountDays: 0,
          creditLimit: 0,
          currency: 'EUR',
          taxMode: 'default',
          paymentTermsLabel: 'Net 14',
          invoicePrefix: '',
          allowedPaymentMethods: ['bank_transfer'],
        },
        affiliateProfile: {
          attributionModel: 'last_click',
          defaultCommissionType: 'percentage',
          defaultCommissionValue: 0,
          releaseTrigger: 'invoice_paid',
          holdDays: 0,
        },
      });
    }

    console.log('Migration summary:');
    for (const item of summary) {
      console.log(`- ${item.name} -> ${item.key} (${item.customerCount} customers) ${item.exists ? '[exists]' : applyChanges ? '[created]' : '[pending create]'}`);
    }

    if (!applyChanges) {
      console.log('Dry-run complete. Re-run with --apply to create missing CustomerGroup documents.');
    }
  } finally {
    await mongoose.connection.close();
  }
}

run().catch((error) => {
  console.error('Customer group migration failed:', error);
  process.exit(1);
});