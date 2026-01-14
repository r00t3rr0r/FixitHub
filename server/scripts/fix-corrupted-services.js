const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Fix corrupted services in orders
async function fixCorruptedServices() {
  try {
    const Order = require('../models/Order');

    console.log('🔍 Searching for orders with corrupted services...');

    // Get all orders
    const orders = await Order.find({}).setOptions({ skipAutoPopulate: true });
    console.log(`Found ${orders.length} orders to check`);

    let fixedCount = 0;
    let corruptedCount = 0;

    for (const order of orders) {
      let needsFix = false;

      // Check if services array has corrupted data
      if (order.services && order.services.length > 0) {
        for (let i = 0; i < order.services.length; i++) {
          const service = order.services[i];

          // Check if service has the string-indexed corruption pattern
          if (service && typeof service === 'object') {
            // If it has numeric string keys like "0", "1", "2", it's corrupted
            if (service.hasOwnProperty('0') || service.hasOwnProperty('1')) {
              console.log(`⚠️  Order ${order.orderNumber} (${order._id}) has corrupted service at index ${i}`);
              console.log('   Corrupted data:', JSON.stringify(service).substring(0, 100));

              // Try to extract the ObjectId from the corrupted data
              // The corrupted data looks like: {"0":"6","1":"8","2":"a",...}
              // These are the individual characters of the ObjectId string
              const chars = [];
              let j = 0;
              while (service.hasOwnProperty(String(j))) {
                chars.push(service[String(j)]);
                j++;
              }
              const reconstructedId = chars.join('');

              console.log(`   Reconstructed ObjectId: ${reconstructedId}`);

              // Verify it's a valid ObjectId
              if (mongoose.Types.ObjectId.isValid(reconstructedId)) {
                // Replace the corrupted service with a minimal valid structure
                order.services[i] = {
                  serviceId: new mongoose.Types.ObjectId(reconstructedId),
                  price: service.price || 0,
                  estimatedTime: service.estimatedTime || 0,
                  notes: service.notes || ''
                };
                needsFix = true;
                console.log(`   ✅ Fixed service ${i}`);
              } else {
                console.log(`   ❌ Could not reconstruct valid ObjectId`);
                // Remove the corrupted service
                order.services.splice(i, 1);
                i--;
                needsFix = true;
              }

              corruptedCount++;
            }
            // Check if service is missing required fields
            else if (!service.serviceId || !service.price !== undefined || !service.estimatedTime !== undefined) {
              console.log(`⚠️  Order ${order.orderNumber} (${order._id}) has incomplete service at index ${i}`);
              console.log('   Service data:', JSON.stringify(service));

              // If serviceId is an ObjectId, keep it; otherwise try to fix
              if (service.serviceId && mongoose.Types.ObjectId.isValid(service.serviceId)) {
                order.services[i] = {
                  serviceId: service.serviceId,
                  price: service.price || 0,
                  estimatedTime: service.estimatedTime || 0,
                  notes: service.notes || ''
                };
                needsFix = true;
                console.log(`   ✅ Fixed incomplete service ${i}`);
              } else {
                console.log(`   ❌ Removing invalid service ${i}`);
                order.services.splice(i, 1);
                i--;
                needsFix = true;
              }

              corruptedCount++;
            }
          }
        }
      }

      if (needsFix) {
        try {
          // Save with validation disabled temporarily
          await Order.updateOne(
            { _id: order._id },
            { $set: { services: order.services } },
            { runValidators: false }
          );
          console.log(`✅ Fixed order ${order.orderNumber}`);
          fixedCount++;
        } catch (saveError) {
          console.error(`❌ Error saving order ${order.orderNumber}:`, saveError.message);
        }
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Total orders checked: ${orders.length}`);
    console.log(`   Corrupted services found: ${corruptedCount}`);
    console.log(`   Orders fixed: ${fixedCount}`);
    console.log('\n✅ Database repair completed!');

  } catch (error) {
    console.error('❌ Error fixing corrupted services:', error);
    throw error;
  }
}

// Main execution
async function main() {
  console.log('🔧 Starting database repair script...\n');

  await connectDB();
  await fixCorruptedServices();

  await mongoose.connection.close();
  console.log('\n👋 Database connection closed');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
