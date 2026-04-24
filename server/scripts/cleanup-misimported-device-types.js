#!/usr/bin/env node

/**
 * Cleanup DeviceModel rows whose `deviceType` was wrongly set to a service
 * category (Hardware/Display/Power/Camera/Software/Emergency) by an old run
 * of the device CSV import that auto-mapped the wrong column.
 *
 * Also removes orphan DeviceType documents that share these names and any
 * DeviceBrand left without a single remaining model.
 *
 * Usage:
 *   node server/scripts/cleanup-misimported-device-types.js          # dry run
 *   node server/scripts/cleanup-misimported-device-types.js --confirm  # actually delete
 */

require('dotenv').config();
const { connectDB, gracefulShutdown } = require('../config/database');
const { DeviceModel, DeviceBrand, DeviceType } = require('../models/Device');

const BAD_TYPES = ['hardware', 'display', 'power', 'camera', 'software', 'emergency'];

async function run() {
  const confirm = process.argv.includes('--confirm');
  console.log('=== Cleanup mis-imported device types ===');
  console.log(confirm ? 'Mode: APPLY' : 'Mode: DRY-RUN (pass --confirm to delete)');

  await connectDB();

  const modelFilter = { deviceType: { $in: BAD_TYPES } };
  const badModels = await DeviceModel.find(modelFilter).select('_id name brandId deviceType').lean();
  console.log(`Found ${badModels.length} DeviceModel rows with bad deviceType.`);

  const typeFilter = { _id: { $in: BAD_TYPES } };
  const badTypes = await DeviceType.find(typeFilter).select('_id name').lean();
  console.log(`Found ${badTypes.length} DeviceType rows with bad id.`);

  if (!confirm) {
    badModels.slice(0, 10).forEach((m) => {
      console.log(`  - [${m.deviceType}] ${m.name} (${m._id})`);
    });
    if (badModels.length > 10) console.log(`  … and ${badModels.length - 10} more.`);
    badTypes.forEach((t) => console.log(`  - DeviceType ${t._id}`));
    await gracefulShutdown();
    return;
  }

  const affectedBrandIds = [...new Set(badModels.map((m) => String(m.brandId)).filter(Boolean))];

  const modelResult = await DeviceModel.deleteMany(modelFilter);
  const typeResult = await DeviceType.deleteMany(typeFilter);
  console.log(`Deleted ${modelResult.deletedCount} DeviceModel rows.`);
  console.log(`Deleted ${typeResult.deletedCount} DeviceType rows.`);

  let removedBrands = 0;
  for (const brandId of affectedBrandIds) {
    const remaining = await DeviceModel.countDocuments({ brandId });
    if (remaining === 0) {
      await DeviceBrand.deleteOne({ _id: brandId });
      removedBrands += 1;
    }
  }
  console.log(`Removed ${removedBrands} DeviceBrand rows that no longer have any models.`);

  await gracefulShutdown();
}

run().catch(async (err) => {
  console.error('Cleanup failed:', err);
  try {
    await gracefulShutdown();
  } catch (_) {
    /* noop */
  }
  process.exit(1);
});
