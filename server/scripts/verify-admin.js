#!/usr/bin/env node

/**
 * Verify Admin User Script
 * Checks if the admin user exists and, if SEED_ADMIN_PASSWORD is set, whether it
 * matches. Read-only: never creates the admin or resets its password (use
 * `node scripts/seed-data.js --type admin` to create a missing admin).
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const { validatePassword } = require('../utils/password');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function verifyAdmin() {
  try {
    console.log('='.repeat(60));
    console.log('🔍 Admin User Verification Script');
    console.log('='.repeat(60));
    console.log();

    // Connect to database
    console.log('📡 Connecting to database...');
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ Connected to database\n');

    // Check for admin user
    const adminEmail = 'admin@example.com';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;

    console.log(`🔎 Searching for admin user: ${adminEmail}`);
    const admin = await User.findOne({ email: adminEmail });

    if (!admin) {
      console.log('❌ Admin user not found!');
      console.log('   Create it with: node scripts/seed-data.js --type admin');
      process.exitCode = 1;
      return;
    }

    console.log('✅ Admin user found!');
    console.log(`   ID: ${admin._id}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   Active: ${admin.isActive}`);
    console.log(`   Created: ${admin.createdAt}`);

    if (!adminPassword) {
      console.log('\nℹ️  SEED_ADMIN_PASSWORD is not set - skipping password check.');
      return;
    }

    // Test password (never reset it here)
    console.log('\n🔐 Testing SEED_ADMIN_PASSWORD against the stored password...');
    const isValid = await validatePassword(adminPassword, admin.password);
    console.log(isValid
      ? '✅ Password validation successful!'
      : '❌ Password does not match SEED_ADMIN_PASSWORD (it may have been changed deliberately).');
    console.log();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from database');
  }
}

// Run verification
verifyAdmin();
