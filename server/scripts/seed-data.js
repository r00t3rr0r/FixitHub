#!/usr/bin/env node

/**
 * Seed Data Script
 * This script seeds the database with test data for development
 * Usage: node server/scripts/seed-data.js [--type {all|admin|users|services}]
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/FixitHub';

// Import SeedService
const SeedService = require('../services/seedService');

async function seedData() {
  try {
    console.log('🌱 Connecting to MongoDB...');
    await mongoose.connect(DATABASE_URL);
    console.log('✅ Connected to MongoDB\n');

    const seedType = process.argv.includes('--type')
      ? process.argv[process.argv.indexOf('--type') + 1]
      : 'all';

    const validTypes = ['all', 'admin', 'users', 'services', 'devices', 'products', 'blog', 'faq', 'homepage'];

    if (!validTypes.includes(seedType)) {
      console.log('❌ Invalid seed type. Valid options:');
      validTypes.forEach(t => console.log(`   - ${t}`));
      process.exit(1);
    }

    console.log(`🌱 Starting database seeding (type: ${seedType})...\n`);

    const results = {
      success: [],
      skipped: [],
      failed: []
    };

    // Seed based on type
    switch (seedType) {
      case 'all':
        console.log('📝 Seeding admin user...');
        try {
          await SeedService.seedAdminUser();
          results.success.push('Admin user');
        } catch (e) {
          results.failed.push(`Admin user: ${e.message}`);
        }

        console.log('👥 Seeding test users...');
        try {
          await SeedService.seedTestUsers();
          results.success.push('Test users');
        } catch (e) {
          results.failed.push(`Test users: ${e.message}`);
        }

        console.log('🔧 Seeding services...');
        try {
          await SeedService.seedServices();
          results.success.push('Services');
        } catch (e) {
          results.failed.push(`Services: ${e.message}`);
        }

        console.log('📦 Seeding devices...');
        try {
          await SeedService.seedDevices();
          results.success.push('Devices');
        } catch (e) {
          results.failed.push(`Devices: ${e.message}`);
        }

        console.log('🛍️  Seeding products...');
        try {
          await SeedService.seedProducts();
          results.success.push('Products');
        } catch (e) {
          results.failed.push(`Products: ${e.message}`);
        }

        console.log('📰 Seeding blog posts...');
        try {
          await SeedService.seedBlogData();
          results.success.push('Blog posts');
        } catch (e) {
          results.failed.push(`Blog posts: ${e.message}`);
        }

        console.log('❓ Seeding FAQs...');
        try {
          await SeedService.seedFAQs();
          results.success.push('FAQs');
        } catch (e) {
          results.failed.push(`FAQs: ${e.message}`);
        }

        console.log('🏠 Seeding homepage template...');
        try {
          await SeedService.seedHomepageTemplate();
          results.success.push('Homepage template');
        } catch (e) {
          results.failed.push(`Homepage template: ${e.message}`);
        }

        break;

      case 'admin':
        console.log('📝 Seeding admin user...');
        try {
          await SeedService.seedAdminUser();
          results.success.push('Admin user');
        } catch (e) {
          results.failed.push(`Admin user: ${e.message}`);
        }
        break;

      case 'users':
        console.log('👥 Seeding test users...');
        try {
          await SeedService.seedTestUsers();
          results.success.push('Test users');
        } catch (e) {
          results.failed.push(`Test users: ${e.message}`);
        }
        break;

      case 'services':
        console.log('🔧 Seeding services...');
        try {
          await SeedService.seedServices();
          results.success.push('Services');
        } catch (e) {
          results.failed.push(`Services: ${e.message}`);
        }
        break;

      case 'devices':
        console.log('📦 Seeding devices...');
        try {
          await SeedService.seedDevices();
          results.success.push('Devices');
        } catch (e) {
          results.failed.push(`Devices: ${e.message}`);
        }
        break;

      case 'products':
        console.log('🛍️  Seeding products...');
        try {
          await SeedService.seedProducts();
          results.success.push('Products');
        } catch (e) {
          results.failed.push(`Products: ${e.message}`);
        }
        break;

      case 'blog':
        console.log('📰 Seeding blog posts...');
        try {
          await SeedService.seedBlogData();
          results.success.push('Blog posts');
        } catch (e) {
          results.failed.push(`Blog posts: ${e.message}`);
        }
        break;

      case 'faq':
        console.log('❓ Seeding FAQs...');
        try {
          await SeedService.seedFAQs();
          results.success.push('FAQs');
        } catch (e) {
          results.failed.push(`FAQs: ${e.message}`);
        }
        break;

      case 'homepage':
        console.log('🏠 Seeding homepage template...');
        try {
          await SeedService.seedHomepageTemplate();
          results.success.push('Homepage template');
        } catch (e) {
          results.failed.push(`Homepage template: ${e.message}`);
        }
        break;
    }

    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('📊 Seeding Results');
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
seedData();
