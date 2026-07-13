#!/usr/bin/env node

/**
 * Database Reset Script
 * This script cleanly resets the database for development/testing
 * Usage: node server/scripts/reset-database.js [--confirm]
 *
 * WARNING: This will DELETE ALL DATA in the database!
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/McRepair.de';

async function resetDatabase() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(DATABASE_URL);
    console.log('✅ Connected to MongoDB');

    const confirmed = process.argv.includes('--confirm');

    if (!confirmed) {
      console.log('\n⚠️  WARNING: This will DELETE ALL DATA in the database!');
      console.log(`📍 Database: ${DATABASE_URL}`);
      console.log('\n💡 To confirm, run: node server/scripts/reset-database.js --confirm\n');
      process.exit(0);
    }

    console.log('\n🗑️  Deleting all collections...');

    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
      console.log(`  ✅ Cleared: ${key}`);
    }

    console.log('\n✅ Database reset complete!');
    console.log('💡 Run the server to re-seed initial data:\n   npm run dev\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting database:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run reset
resetDatabase();
