/**
 * Script: remove-gaming-console-category.js
 * Removes the "Spielekonsolen" / gaming-console DeviceType from MongoDB.
 * Run with: node server/scripts/remove-gaming-console-category.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { DeviceType, DeviceModel, DeviceBrand } = require('../models/Device');

async function main() {
  await mongoose.connect(process.env.DATABASE_URL);
  console.log('Connected to MongoDB');

  // Find any DeviceType whose name matches gaming console variants
  const targets = await DeviceType.find({
    name: { $regex: /spielekonsolen|gaming.?console|konsole/i }
  });

  if (targets.length === 0) {
    console.log('No gaming-console DeviceType found. Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  for (const dt of targets) {
    console.log(`Found DeviceType: _id="${dt._id}", name="${dt.name}"`);

    // Count linked models/brands before deletion
    const modelCount = await DeviceModel.countDocuments({ deviceType: dt._id });
    const brandCount = await DeviceBrand.countDocuments({ deviceType: dt._id });
    console.log(`  → ${modelCount} DeviceModel(s), ${brandCount} DeviceBrand(s) linked`);

    if (modelCount > 0 || brandCount > 0) {
      console.log('  → Deleting linked DeviceModels and DeviceBrands...');
      await DeviceModel.deleteMany({ deviceType: dt._id });
      await DeviceBrand.deleteMany({ deviceType: dt._id });
    }

    await DeviceType.deleteOne({ _id: dt._id });
    console.log(`  → DeviceType "${dt.name}" deleted.`);
  }

  console.log('Done.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
