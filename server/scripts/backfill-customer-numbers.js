#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const apply = process.argv.includes('--apply');
  const dbUrl = process.env.DATABASE_URL || 'mongodb://localhost:27017/McRepair.de';

  await mongoose.connect(dbUrl);
  console.log(`Connected to MongoDB (${apply ? 'apply' : 'dry-run'} mode)`);

  const users = await User.find({
    $or: [
      { customerNumber: { $exists: false } },
      { customerNumber: null },
      { customerNumber: '' },
    ],
  }).sort({ createdAt: 1, _id: 1 });

  console.log(`Found ${users.length} users without a customer number.`);

  let updated = 0;
  if (apply) {
    for (const user of users) {
      user.customerNumber = await User.allocateCustomerNumber();
      await user.save();
      updated += 1;
      console.log(`${user.email} -> ${user.customerNumber}`);
    }
  }

  console.log(apply ? `Generated ${updated} customer numbers.` : 'No changes made. Use --apply to generate numbers.');
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Customer number backfill failed:', error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});
