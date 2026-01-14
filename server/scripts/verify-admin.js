#!/usr/bin/env node

/**
 * Verify Admin User Script
 * Checks if the admin user exists and can be authenticated
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const { validatePassword, generatePasswordHash } = require('../utils/password');
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
    const adminPassword = 'admin123';

    console.log(`🔎 Searching for admin user: ${adminEmail}`);
    const admin = await User.findOne({ email: adminEmail });

    if (!admin) {
      console.log('❌ Admin user not found!');
      console.log('\n📝 Creating admin user...');

      const hashedPassword = await generatePasswordHash(adminPassword);
      const newAdmin = await User.create({
        email: adminEmail,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        name: 'Admin User',
        phone: '+1 (555) 000-0000',
        role: 'admin',
        avatar: 'https://via.placeholder.com/150x150/3b82f6/ffffff?text=AU',
        isActive: true,
        department: 'Administration',
        specializations: ['System Management', 'User Management'],
        addOnCapabilities: ['All Services']
      });

      console.log('✅ Admin user created successfully!');
      console.log(`   ID: ${newAdmin._id}`);
      console.log(`   Email: ${newAdmin.email}`);
      console.log(`   Password: admin123`);
    } else {
      console.log('✅ Admin user found!');
      console.log(`   ID: ${admin._id}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Active: ${admin.isActive}`);
      console.log(`   Created: ${admin.createdAt}`);

      // Test password
      console.log('\n🔐 Testing password validation...');
      const isValid = await validatePassword(adminPassword, admin.password);

      if (!isValid) {
        console.log('❌ Password validation failed!');
        console.log('📝 Resetting admin password...');

        admin.password = await generatePasswordHash(adminPassword);
        await admin.save();

        console.log('✅ Admin password reset successfully!');
      } else {
        console.log('✅ Password validation successful!');
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Admin user is ready to use!');
    console.log('='.repeat(60));
    console.log('\n📋 Login Credentials:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
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
