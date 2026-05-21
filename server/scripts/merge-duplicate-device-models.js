const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { connectDB } = require('../config/database');
const DeviceService = require('../services/deviceService');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit-groups='));
  const limitGroups = limitArg ? Number(limitArg.split('=')[1]) || 0 : 0;

  console.log('Starting duplicate model merge...');
  console.log(`Options: dryRun=${dryRun}, limitGroups=${limitGroups || 'all'}`);

  await connectDB();

  const result = await DeviceService.mergeDuplicateModels({
    dryRun,
    limitGroups,
  });

  console.log('Merge summary:');
  console.log(JSON.stringify(result, null, 2));

  await mongoose.connection.close();
  console.log('Database connection closed');
}

main().catch(async (error) => {
  console.error('Duplicate model merge failed:', error);
  try {
    await mongoose.connection.close();
  } catch (_) {
    // ignore close errors
  }
  process.exit(1);
});
