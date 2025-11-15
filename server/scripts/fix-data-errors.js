#!/usr/bin/env node

/**
 * Data Error Fix Script
 * This script fixes common data integrity issues in the database
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const { generatePasswordHash } = require('../utils/password');
const Order = require('../models/Order');
const User = require('../models/User');
const Service = require('../models/Service');

console.log('🔧 FixitHub Data Error Fix Tool');
console.log('=================================\n');

async function fixErrors() {
  try {
    await connectDB();
    console.log('✅ Database connection successful\n');

    // Fix 1: Orders without customer references
    console.log('🔧 Fixing orders without customer references...');
    const ordersWithoutCustomer = await Order.find(
      {
        $or: [
          { customer: { $exists: false } },
          { customer: null }
        ]
      },
      null,
      { skipAutoPopulate: true }
    ).lean();

    if (ordersWithoutCustomer.length > 0) {
      console.log(`Found ${ordersWithoutCustomer.length} orders without customer references`);

      // Get or create a default "Guest" user for orphaned orders
      let guestUser = await User.findOne({ email: 'guest@fixithub.com' });

      if (!guestUser) {
        console.log('Creating guest user for orphaned orders...');
        const hashedPassword = await generatePasswordHash('GuestPassword123!');
        guestUser = await User.create({
          firstName: 'Guest',
          lastName: 'User',
          email: 'guest@fixithub.com',
          password: hashedPassword,
          role: 'customer',
          phoneNumber: 'N/A'
        });
        console.log('✅ Guest user created');
      }

      // Update all orders without customer to point to guest user
      // Use native MongoDB driver to ensure the update works
      const db = mongoose.connection.db;
      const ordersCollection = db.collection('orders');

      const updateResult = await ordersCollection.updateMany(
        {
          $or: [
            { customer: { $exists: false } },
            { customer: null }
          ]
        },
        { $set: { customer: guestUser._id } }
      );

      console.log(`✅ Fixed ${updateResult.modifiedCount} orders with missing customer references\n`);
    } else {
      console.log('✅ No orders without customer references found\n');
    }

    // Fix 2: Orders with invalid service references
    console.log('🔧 Fixing orders with invalid service references...');
    const ordersWithServices = await Order.find(
      {
        'services': { $exists: true, $ne: [] }
      },
      null,
      { skipAutoPopulate: true }
    ).lean();

    let fixedServicesCount = 0;
    let removedInvalidServicesCount = 0;

    for (const order of ordersWithServices) {
      let needsUpdate = false;
      const validServices = [];

      for (const orderService of order.services || []) {
        // Check if service reference exists
        if (!orderService.service) {
          console.log(`  ⚠️  Order ${order.orderNumber}: Service missing 'service' field`);
          removedInvalidServicesCount++;
          needsUpdate = true;
          continue;
        }

        // Check if service is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(orderService.service)) {
          console.log(`  ⚠️  Order ${order.orderNumber}: Invalid service ObjectId: ${orderService.service}`);
          removedInvalidServicesCount++;
          needsUpdate = true;
          continue;
        }

        // Check if service exists in database
        const serviceExists = await Service.findById(orderService.service);
        if (!serviceExists) {
          console.log(`  ⚠️  Order ${order.orderNumber}: Service ${orderService.service} not found in database`);
          removedInvalidServicesCount++;
          needsUpdate = true;
          continue;
        }

        // Service is valid
        validServices.push(orderService);
      }

      if (needsUpdate) {
        await Order.updateOne(
          { _id: order._id },
          { $set: { services: validServices } }
        );
        fixedServicesCount++;
        console.log(`  ✅ Fixed order ${order.orderNumber}: ${validServices.length} valid services remaining`);
      }
    }

    console.log(`\n✅ Fixed ${fixedServicesCount} orders`);
    console.log(`✅ Removed ${removedInvalidServicesCount} invalid service references\n`);

    // Fix 3: Recalculate order totals for affected orders
    console.log('🔧 Recalculating order totals...');
    const ordersToRecalculate = await Order.find(
      {
        $or: [
          { totalCost: { $exists: false } },
          { totalCost: 0 },
          { services: { $ne: [] } }
        ]
      },
      null,
      { skipAutoPopulate: true }
    );

    let recalculatedCount = 0;
    for (const order of ordersToRecalculate) {
      let totalCost = 0;

      // Calculate services cost
      for (const service of order.services || []) {
        totalCost += service.price || 0;
      }

      // Calculate add-ons cost
      for (const addOn of order.addOnServices || []) {
        totalCost += addOn.price || 0;
      }

      // Calculate e-parts cost
      for (const ePart of order.eParts || []) {
        totalCost += (ePart.unitCost || 0) * (ePart.quantity || 1);
      }

      // Calculate shop products cost
      for (const product of order.shopProducts || []) {
        totalCost += (product.price || 0) * (product.quantity || 1);
      }

      if (totalCost !== order.totalCost) {
        await Order.updateOne(
          { _id: order._id },
          { $set: { totalCost } }
        );
        recalculatedCount++;
        console.log(`  ✅ Recalculated order ${order.orderNumber}: $${totalCost.toFixed(2)}`);
      }
    }

    console.log(`\n✅ Recalculated ${recalculatedCount} order totals\n`);

    console.log('🎉 All errors fixed successfully!');

  } catch (error) {
    console.error('❌ Error during fix:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔒 Database connection closed');
  }
}

// Run the fix
fixErrors().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
