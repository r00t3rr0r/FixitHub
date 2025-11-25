#!/usr/bin/env node

/**
 * Script to seed an admin user into the database
 * Useful for setting up a fresh database or creating additional admin accounts
 *
 * Usage: node server/scripts/seed-admin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, gracefulShutdown } = require('../config/database');
const { generatePasswordHash } = require('../utils/password');
const User = require('../models/User');

async function seedAdmin() {
  console.log('=== Seeding Admin User ===');

  try {
    // Connect to database
    console.log('Connecting to database...');
    await connectDB();
    console.log('✓ Connected to database');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@example.com' });

    if (existingAdmin) {
      console.log('⚠ Admin user already exists:');
      console.log(`  Email: ${existingAdmin.email}`);
      console.log(`  Name: ${existingAdmin.name}`);
      console.log(`  Role: ${existingAdmin.role}`);
      console.log(`  Active: ${existingAdmin.isActive}`);
      console.log('\nSkipping admin creation.');
      return;
    }

    // Create admin user
    console.log('\nCreating admin user...');
    const hashedPassword = await generatePasswordHash('admin123');

    const adminUser = new User({
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Admin User',
      phone: '+1 (555) 000-0000',
      role: 'admin',
      isActive: true,
      avatar: 'https://via.placeholder.com/150x150/3b82f6/ffffff?text=AU',
      notificationPreferences: {
        email: true,
        sms: false,
        push: true,
        orderUpdates: true,
        promotions: false,
        newsletter: false
      }
    });

    await adminUser.save();

    console.log('✓ Admin user created successfully!');
    console.log('\n=== Admin Credentials ===');
    console.log('  Email: admin@example.com');
    console.log('  Password: admin123');
    console.log('  Role: admin');
    console.log('\n⚠ IMPORTANT: Change this password in production!');

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
