#!/usr/bin/env node

/**
 * Script to delete all users except the admin
 * Usage: node server/scripts/delete-non-admin-users.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { connectDB, gracefulShutdown } = require('../config/database');

async function deleteNonAdminUsers() {
  try {
    await connectDB();
    console.log('Connected to database');

    // Find the admin user
    const admin = await User.findOne({ role: 'admin', email: 'admin@example.com' });
    if (!admin) {
      console.error('No admin user found with email admin@example.com. Aborting.');
      process.exit(1);
    }

    // Delete all users except the admin
    const result = await User.deleteMany({ _id: { $ne: admin._id } });
    console.log(`Deleted ${result.deletedCount} users (all except admin).`);

    await gracefulShutdown();
    process.exit(0);
  } catch (err) {
    console.error('Error deleting users:', err);
    process.exit(1);
  }
}

deleteNonAdminUsers();
