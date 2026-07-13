const mongoose = require('mongoose');
require('dotenv').config();

// Load all models first
const User = require('./models/User');
const Order = require('./models/Order');

async function addUnlockData() {
  try {
    await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/McRepair.de');
    console.log('Connected to MongoDB');

    // Find the most recent order
    const order = await Order.findOne().sort({ createdAt: -1 });

    if (!order) {
      console.log('No orders found');
      process.exit(1);
    }

    console.log('Found order:', order.orderNumber);
    console.log('Current unlock data:', {
      unlockPattern: order.unlockPattern,
      unlockCode: order.unlockCode,
      noLock: order.noLock
    });

    // Add unlock information
    order.unlockPattern = ['1', '2', '3', '4', '5'];
    order.unlockCode = '';
    order.noLock = false;

    await order.save();
    console.log('Updated order with unlock pattern');
    console.log('New unlock data:', {
      unlockPattern: order.unlockPattern,
      unlockCode: order.unlockCode,
      noLock: order.noLock
    });

    await mongoose.disconnect();
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

addUnlockData();
