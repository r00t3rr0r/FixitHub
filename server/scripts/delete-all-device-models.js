// Script to delete all device models from the database
const mongoose = require('mongoose');
const DeviceModel = require('../models/Device').DeviceModel || require('../models/DeviceModel');

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb://localhost/fixithub';

async function deleteAllDeviceModels() {
  await mongoose.connect(MONGODB_URI);
  const result = await mongoose.model('DeviceModel').deleteMany({});
  console.log(`Deleted ${result.deletedCount} device models.`);
  await mongoose.disconnect();
}

deleteAllDeviceModels().catch(err => {
  console.error('Error deleting device models:', err);
  process.exit(1);
});
