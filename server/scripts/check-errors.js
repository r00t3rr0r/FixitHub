#!/usr/bin/env node

/**
 * Error Diagnostic Script
 * This script checks for common errors and logs them for debugging
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const { connectDB } = require('../config/database');

console.log('🔍 FixitHub Error Diagnostic Tool');
console.log('==================================\n');

async function checkErrors() {
  console.log('✅ Checking environment variables...');
  const requiredEnvVars = [
    'PORT',
    'DATABASE_URL',
    'JWT_SECRET',
    'REFRESH_TOKEN_SECRET',
    'SESSION_SECRET',
    'CLIENT_URL',
    'SERVER_URL'
  ];

  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    console.error('❌ Missing environment variables:', missingVars);
  } else {
    console.log('✅ All required environment variables are set\n');
  }

  console.log('✅ Checking database connection...');
  try {
    await connectDB();
    console.log('✅ Database connection successful\n');

    console.log('✅ Checking database collections...');
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`✅ Found ${collections.length} collections:`, collections.map(c => c.name).join(', '), '\n');

    console.log('✅ Checking for data integrity issues...');

    // Check for orders with missing customer references
    const Order = require('../models/Order');
    const ordersWithoutCustomer = await Order.countDocuments({ customer: { $exists: false } });
    if (ordersWithoutCustomer > 0) {
      console.warn(`⚠️  Found ${ordersWithoutCustomer} orders without customer references`);
    } else {
      console.log('✅ All orders have customer references');
    }

    // Check for orders with invalid services
    const ordersWithInvalidServices = await Order.countDocuments({
      'services': { $exists: true, $ne: [] },
      'services.service': { $exists: false }
    });
    if (ordersWithInvalidServices > 0) {
      console.warn(`⚠️  Found ${ordersWithInvalidServices} orders with invalid service references`);
    } else {
      console.log('✅ All orders have valid service references');
    }

    // Check for users without required fields
    const User = require('../models/User');
    const usersWithoutEmail = await User.countDocuments({ email: { $exists: false } });
    if (usersWithoutEmail > 0) {
      console.error(`❌ Found ${usersWithoutEmail} users without email addresses`);
    } else {
      console.log('✅ All users have email addresses');
    }

    // Check for duplicate emails
    const duplicateEmails = await User.aggregate([
      { $group: { _id: '$email', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    if (duplicateEmails.length > 0) {
      console.error(`❌ Found ${duplicateEmails.length} duplicate email addresses:`, duplicateEmails.map(d => d._id));
    } else {
      console.log('✅ No duplicate email addresses found');
    }

    console.log('\n✅ Diagnostic check complete!');

  } catch (error) {
    console.error('❌ Error during diagnostic check:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔒 Database connection closed');
  }
}

// Run the diagnostic check
checkErrors().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
