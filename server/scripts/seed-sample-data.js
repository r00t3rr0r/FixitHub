#!/usr/bin/env node

/**
 * Script to seed sample data for testing and development
 * Creates users, orders, products, and services
 *
 * Usage: node server/scripts/seed-sample-data.js [--confirm]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, gracefulShutdown } = require('../config/database');
const { generatePasswordHash } = require('../utils/password');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Service = require('../models/Service');
const DeviceBrand = require('../models/Device').DeviceBrand;
const DeviceModel = require('../models/Device').DeviceModel;

async function seedSampleData() {
  console.log('=== Seeding Sample Data ===');

  try {
    // Check for confirmation
    const args = process.argv.slice(2);
    const confirmSeed = args.includes('--confirm');

    if (!confirmSeed) {
      console.log('\n⚠ DRY RUN MODE');
      console.log('This will create sample data in your database.');
      console.log('Add --confirm flag to proceed with seeding.');
      console.log('\nExample: node server/scripts/seed-sample-data.js --confirm');
      return;
    }

    // Connect to database
    console.log('\nConnecting to database...');
    await connectDB();
    console.log('✓ Connected to database');

    const hashedPassword = await generatePasswordHash('password123');

    // 1. Create sample users
    console.log('\n1. Creating sample users...');
    const users = [];

    // Check if users already exist
    const existingCustomer = await User.findOne({ email: 'customer@example.com' });
    if (!existingCustomer) {
      const customer = new User({
        email: 'customer@example.com',
        password: hashedPassword,
        name: 'John Customer',
        phone: '+1 (555) 111-1111',
        role: 'customer',
        isActive: true
      });
      await customer.save();
      users.push(customer);
      console.log('   ✓ Created customer user');
    } else {
      users.push(existingCustomer);
      console.log('   • Customer user already exists');
    }

    const existingStaff = await User.findOne({ email: 'staff@example.com' });
    if (!existingStaff) {
      const staff = new User({
        email: 'staff@example.com',
        password: hashedPassword,
        name: 'Jane Staff',
        phone: '+1 (555) 222-2222',
        role: 'staff',
        isActive: true,
        department: 'Repair',
        specializations: ['Screen Repair', 'Battery Replacement']
      });
      await staff.save();
      users.push(staff);
      console.log('   ✓ Created staff user');
    } else {
      users.push(existingStaff);
      console.log('   • Staff user already exists');
    }

    // 2. Create sample devices
    console.log('\n2. Creating sample devices...');
    let appleBrand = await DeviceBrand.findOne({ name: 'Apple' });
    if (!appleBrand) {
      appleBrand = new DeviceBrand({
        name: 'Apple',
        logo: 'https://via.placeholder.com/150x150/000000/ffffff?text=Apple'
      });
      await appleBrand.save();
      console.log('   ✓ Created Apple brand');
    } else {
      console.log('   • Apple brand already exists');
    }

    let iphone14 = await DeviceModel.findOne({ name: 'iPhone 14 Pro' });
    if (!iphone14) {
      iphone14 = new DeviceModel({
        brand: appleBrand._id,
        name: 'iPhone 14 Pro',
        type: 'Smartphone',
        specifications: {
          display: '6.1 inch',
          processor: 'A16 Bionic',
          ram: '6GB'
        }
      });
      await iphone14.save();
      console.log('   ✓ Created iPhone 14 Pro model');
    } else {
      console.log('   • iPhone 14 Pro model already exists');
    }

    // 3. Create sample services
    console.log('\n3. Creating sample services...');
    let screenRepairService = await Service.findOne({ name: 'Screen Replacement' });
    if (!screenRepairService) {
      screenRepairService = new Service({
        name: 'Screen Replacement',
        description: 'Complete screen and digitizer replacement',
        category: 'Display',
        price: 199,
        estimatedTime: 60,
        deviceTypes: ['Smartphone'],
        isActive: true
      });
      await screenRepairService.save();
      console.log('   ✓ Created Screen Replacement service');
    } else {
      console.log('   • Screen Replacement service already exists');
    }

    let batteryService = await Service.findOne({ name: 'Battery Replacement' });
    if (!batteryService) {
      batteryService = new Service({
        name: 'Battery Replacement',
        description: 'Replace old battery with new OEM battery',
        category: 'Battery',
        price: 79,
        estimatedTime: 30,
        deviceTypes: ['Smartphone'],
        isActive: true
      });
      await batteryService.save();
      console.log('   ✓ Created Battery Replacement service');
    } else {
      console.log('   • Battery Replacement service already exists');
    }

    // 4. Create sample products
    console.log('\n4. Creating sample products...');
    let phoneCase = await Product.findOne({ name: 'Premium Phone Case' });
    if (!phoneCase) {
      phoneCase = new Product({
        name: 'Premium Phone Case',
        description: 'High-quality protective case',
        category: 'Accessories',
        brand: 'Generic',
        price: 29.99,
        stockQuantity: 50,
        images: ['https://via.placeholder.com/300x300/3b82f6/ffffff?text=Phone+Case'],
        isActive: true
      });
      await phoneCase.save();
      console.log('   ✓ Created Premium Phone Case product');
    } else {
      console.log('   • Premium Phone Case product already exists');
    }

    // 5. Create sample orders
    console.log('\n5. Creating sample orders...');
    const existingOrder = await Order.findOne({ customerId: users[0]._id });
    if (!existingOrder) {
      const order = new Order({
        customerId: users[0]._id,
        deviceBrand: appleBrand.name,
        deviceModel: iphone14.name,
        deviceType: 'Smartphone',
        services: [
          {
            service: screenRepairService._id,
            name: screenRepairService.name,
            price: screenRepairService.price,
            estimatedTime: screenRepairService.estimatedTime,
            status: 'pending'
          }
        ],
        status: 'pending',
        totalCost: screenRepairService.price,
        customerNotes: 'Screen is cracked',
        paymentStatus: 'pending',
        priority: 'normal'
      });
      await order.save();
      console.log(`   ✓ Created sample order: ${order.orderNumber}`);
    } else {
      console.log('   • Sample orders already exist');
    }

    // Summary
    console.log('\n=== Seeding Complete ===');
    console.log('\nCreated sample data:');
    console.log(`  • Users: ${users.length}`);
    console.log(`  • Device Brands: 1`);
    console.log(`  • Device Models: 1`);
    console.log(`  • Services: 2`);
    console.log(`  • Products: 1`);
    console.log(`  • Orders: 1`);
    console.log('\nTest Credentials:');
    console.log('  Customer: customer@example.com / password123');
    console.log('  Staff: staff@example.com / password123');

  } catch (error) {
    console.error('\n✗ Error seeding data:', error);
    throw error;
  } finally {
    await gracefulShutdown();
  }
}

// Run the script
if (require.main === module) {
  seedSampleData()
    .then(() => {
      console.log('\n✓ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = seedSampleData;
