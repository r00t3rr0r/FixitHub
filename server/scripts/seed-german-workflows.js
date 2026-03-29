#!/usr/bin/env node

/**
 * Seed German Workflows Script
 * Seeds only German workflow templates.
 * Usage: node server/scripts/seed-german-workflows.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/FixitHub';
const SeedService = require('../services/seedService');

async function seedGermanWorkflows() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(DATABASE_URL);
    console.log('Connected to MongoDB');

    console.log('Seeding German workflows...');
    const created = await SeedService.seedGermanWorkflows();

    console.log('German workflows seeding finished.');
    console.log(`Created workflows: ${created.length}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed German workflows:', error.message);
    process.exit(1);
  } finally {
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error('Failed to disconnect MongoDB cleanly:', disconnectError.message);
    }
  }
}

seedGermanWorkflows();
