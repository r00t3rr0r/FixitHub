#!/usr/bin/env node

/**
 * Script to clean up old completed orders from the database
 * Useful for removing test data or maintaining database size
 *
 * Usage: node server/scripts/cleanup-old-orders.js [--days=90] [--status=completed] [--confirm]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, gracefulShutdown } = require('../config/database');
const Order = require('../models/Order');

async function cleanupOldOrders() {
  console.log('=== Cleanup Old Orders ===');

  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    let daysOld = 90;
    let status = 'completed';
    let confirmDelete = false;

    args.forEach(arg => {
      if (arg.startsWith('--days=')) {
        daysOld = parseInt(arg.split('=')[1]);
      } else if (arg.startsWith('--status=')) {
        status = arg.split('=')[1];
      } else if (arg === '--confirm') {
        confirmDelete = true;
      }
    });

    // Connect to database
    console.log('Connecting to database...');
    await connectDB();
    console.log('✓ Connected to database');

    // Calculate date threshold
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysOld);

    console.log(`\nSearching for orders:`);
    console.log(`  Status: ${status}`);
    console.log(`  Older than: ${daysOld} days (before ${dateThreshold.toISOString()})`);

    // Build query
    const query = {
      status: status,
      createdAt: { $lt: dateThreshold }
    };

    // Find matching orders
    const ordersToDelete = await Order.find(query).select('orderNumber status createdAt customerId deviceBrand deviceModel totalCost');
    const count = ordersToDelete.length;

    console.log(`\n✓ Found ${count} order(s) matching criteria`);

    if (count === 0) {
      console.log('\nNo orders to delete.');
      return;
    }

    // Display sample of orders
    console.log('\nSample orders to be deleted:');
    ordersToDelete.slice(0, 5).forEach((order, index) => {
      console.log(`  ${index + 1}. ${order.orderNumber} - ${order.deviceBrand} ${order.deviceModel} - $${order.totalCost} - ${order.createdAt.toDateString()}`);
    });

    if (count > 5) {
      console.log(`  ... and ${count - 5} more`);
    }

    // Check for confirmation
    if (!confirmDelete) {
      console.log('\n⚠ DRY RUN MODE - No orders were deleted');
      console.log('Add --confirm flag to actually delete these orders');
      console.log(`\nExample: node server/scripts/cleanup-old-orders.js --days=${daysOld} --status=${status} --confirm`);
      return;
    }

    // Delete orders
    console.log('\n⚠ DELETING ORDERS...');
    const result = await Order.deleteMany(query);

    console.log(`✓ Successfully deleted ${result.deletedCount} order(s)`);

    // Calculate space saved (rough estimate)
    const avgOrderSize = 5; // KB
    const spaceSaved = (result.deletedCount * avgOrderSize / 1024).toFixed(2);
    console.log(`✓ Approximate space freed: ${spaceSaved} MB`);

  } catch (error) {
    console.error('✗ Error cleaning up orders:', error);
    throw error;
  } finally {
    await gracefulShutdown();
  }
}

// Run the script
if (require.main === module) {
  cleanupOldOrders()
    .then(() => {
      console.log('\n✓ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = cleanupOldOrders;
