#!/usr/bin/env node

/**
 * Seed German Data Script
 * This script seeds the database with German translations of test data
 * Usage: node server/scripts/seed-german-data.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/FixitHub';

// Import SeedService
const SeedService = require('../services/seedService');

async function seedGermanData() {
  try {
    console.log('🌱 Connecting to MongoDB...');
    await mongoose.connect(DATABASE_URL);
    console.log('✅ Connected to MongoDB\n');

    console.log(`🌍 Starting German database seeding...\n`);

    const results = {
      success: [],
      skipped: [],
      failed: []
    };

    // Seed German services
    console.log('🔧 Seeding German services...');
    try {
      await SeedService.seedGermanServices();
      results.success.push('German services');
    } catch (e) {
      results.failed.push(`German services: ${e.message}`);
    }

    // Seed German add-on services
    console.log('📦 Seeding German add-on services...');
    try {
      await SeedService.seedGermanAddOnServices();
      results.success.push('German add-on services');
    } catch (e) {
      results.failed.push(`German add-on services: ${e.message}`);
    }

    // Seed German inventory
    console.log('📊 Seeding German inventory...');
    try {
      await SeedService.seedGermanInventory();
      results.success.push('German inventory');
    } catch (e) {
      results.failed.push(`German inventory: ${e.message}`);
    }

    // Seed German devices
    console.log('📱 Seeding German devices...');
    try {
      await SeedService.seedGermanDevices();
      results.success.push('German devices');
    } catch (e) {
      results.failed.push(`German devices: ${e.message}`);
    }

    // Seed German products
    console.log('🛍️  Seeding German products...');
    try {
      await SeedService.seedGermanProducts();
      results.success.push('German products');
    } catch (e) {
      results.failed.push(`German products: ${e.message}`);
    }

    // Seed German blog posts
    console.log('📰 Seeding German blog posts...');
    try {
      await SeedService.seedGermanBlogData();
      results.success.push('German blog posts');
    } catch (e) {
      results.failed.push(`German blog posts: ${e.message}`);
    }

    // Seed German FAQs
    console.log('❓ Seeding German FAQs...');
    try {
      await SeedService.seedGermanFAQs();
      results.success.push('German FAQs');
    } catch (e) {
      results.failed.push(`German FAQs: ${e.message}`);
    }

    // Seed German homepage template
    console.log('🏠 Seeding German homepage template...');
    try {
      await SeedService.seedGermanHomepageTemplate();
      results.success.push('German homepage template');
    } catch (e) {
      results.failed.push(`German homepage template: ${e.message}`);
    }

    // Seed German workflows
    console.log('⚙️  Seeding German workflows...');
    try {
      await SeedService.seedGermanWorkflows();
      results.success.push('German workflows');
    } catch (e) {
      results.failed.push(`German workflows: ${e.message}`);
    }

    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('📊 German Seeding Results');
    console.log('='.repeat(60));

    if (results.success.length > 0) {
      console.log(`✅ Successfully seeded (${results.success.length}):`);
      results.success.forEach(item => console.log(`   • ${item}`));
    }

    if (results.skipped.length > 0) {
      console.log(`⏭️  Skipped (${results.skipped.length}):`);
      results.skipped.forEach(item => console.log(`   • ${item}`));
    }

    if (results.failed.length > 0) {
      console.log(`❌ Failed (${results.failed.length}):`);
      results.failed.forEach(item => console.log(`   • ${item}`));
    }

    console.log('='.repeat(60) + '\n');

    const hasFailures = results.failed.length > 0;
    process.exit(hasFailures ? 1 : 0);
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run seeding
seedGermanData();
