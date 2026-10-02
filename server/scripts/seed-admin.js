#!/usr/bin/env node

/**
 * Script to seed an admin user into the database
 * Useful for setting up a fresh database or creating additional admin accounts
 *
 * Usage: node server/scripts/seed-admin.js
 */

require('dotenv').config();
const { connectDB, gracefulShutdown } = require('../config/database');
const SeedService = require('../services/seedService');

// Create-only: delegates to SeedService.seedAdminUser(), which never modifies an
// existing admin. The initial password comes from SEED_ADMIN_PASSWORD, otherwise
// a random one is generated and printed once by SeedService.
async function seedAdmin() {
  console.log('=== Seeding Admin User ===');

  try {
    // Connect to database
    console.log('Connecting to database...');
    await connectDB();
    console.log('✓ Connected to database');

    const result = await SeedService.seedAdminUser();
    console.log(`✓ ${result.message}`);

  } catch (error) {
    console.error('✗ Error seeding admin user:', error);
    throw error;
  } finally {
    await gracefulShutdown();
  }
}

// Run the script
if (require.main === module) {
  seedAdmin()
    .then(() => {
      console.log('\n✓ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = seedAdmin;
