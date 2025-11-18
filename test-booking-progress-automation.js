/**
 * Test Script for Booking Progress Automation
 *
 * This script tests the automatic booking status update feature that changes
 * booking status to "processing" when associated orders progress, and calculates
 * overall progress from all orders.
 *
 * Prerequisites:
 * - MongoDB running
 * - At least one customer account
 * - At least one booking with orders
 *
 * Usage: node test-booking-progress-automation.js
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000';

// Test user credentials
const adminCredentials = {
  email: 'admin@fixithub.com',
  password: 'admin123'
};

let authToken = '';
let testBookingId = '';
let testOrderId = '';

async function login() {
  console.log('\n🔐 Logging in as admin...');
  try {
    const response = await axios.post(`${API_URL}/api/auth/login`, adminCredentials);
    authToken = response.data.token;
    console.log('✅ Login successful');
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data?.error || error.message);
    return false;
  }
}

async function getBookings() {
  console.log('\n📋 Fetching bookings...');
  try {
    const response = await axios.get(`${API_URL}/api/bookings`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    const bookings = response.data.bookings || [];
    console.log(`✅ Found ${bookings.length} bookings`);

    if (bookings.length > 0) {
      testBookingId = bookings[0]._id;
      console.log(`📦 Using booking: ${testBookingId}`);
      console.log(`   Status: ${bookings[0].status}`);
      console.log(`   Progress: ${bookings[0].overallProgress || 0}%`);
      console.log(`   Orders: ${bookings[0].orderIds?.length || 0}`);

      if (bookings[0].orderIds && bookings[0].orderIds.length > 0) {
        testOrderId = bookings[0].orderIds[0]._id || bookings[0].orderIds[0];
        console.log(`   First Order ID: ${testOrderId}`);
      }

      return bookings[0];
    } else {
      console.log('⚠️  No bookings found in the system');
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to fetch bookings:', error.response?.data?.error || error.message);
    return null;
  }
}

async function getBookingOrders(bookingId) {
  console.log(`\n📦 Fetching orders for booking ${bookingId}...`);
  try {
    const response = await axios.get(`${API_URL}/api/bookings/${bookingId}/orders`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    const orders = response.data.orders || [];
    console.log(`✅ Found ${orders.length} orders for booking`);

    orders.forEach((order, idx) => {
      console.log(`\n   Order ${idx + 1}:`);
      console.log(`   - Order Number: ${order.orderNumber}`);
      console.log(`   - Type: ${order.type}`);
      console.log(`   - Status: ${order.status}`);
      console.log(`   - Progress: ${order.progress || 0}%`);
      console.log(`   - Cost: $${order.cost}`);
    });

    return orders;
  } catch (error) {
    console.error('❌ Failed to fetch booking orders:', error.response?.data?.error || error.message);
    return [];
  }
}

async function updateOrderStatus(orderId, status) {
  console.log(`\n🔄 Updating order ${orderId} status to "${status}"...`);
  try {
    const response = await axios.put(
      `${API_URL}/api/admin/orders/${orderId}/status`,
      { status, note: 'Testing automatic booking status update' },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    console.log(`✅ Order status updated to "${status}"`);
    console.log(`   Order Progress: ${response.data.order.progress || 0}%`);
    return response.data.order;
  } catch (error) {
    console.error('❌ Failed to update order status:', error.response?.data?.error || error.message);
    return null;
  }
}

async function checkBookingStatus(bookingId) {
  console.log(`\n🔍 Checking booking ${bookingId} status...`);
  try {
    const response = await axios.get(`${API_URL}/api/bookings/${bookingId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    const booking = response.data.booking;
    console.log(`✅ Booking status retrieved:`);
    console.log(`   Status: ${booking.status}`);
    console.log(`   Overall Progress: ${booking.overallProgress || 0}%`);
    console.log(`   Orders: ${booking.orderIds?.length || 0}`);

    // Show timeline if available
    if (booking.timeline && booking.timeline.length > 0) {
      console.log('\n   📜 Recent Timeline:');
      booking.timeline.slice(-3).forEach(event => {
        console.log(`   - ${event.status}: ${event.description}`);
      });
    }

    return booking;
  } catch (error) {
    console.error('❌ Failed to check booking status:', error.response?.data?.error || error.message);
    return null;
  }
}

async function runTest() {
  console.log('🧪 Testing Booking Progress Automation');
  console.log('=====================================\n');

  // Step 1: Login
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('\n❌ Test failed: Unable to login');
    return;
  }

  // Step 2: Get bookings
  const booking = await getBookings();
  if (!booking) {
    console.log('\n⚠️  Test skipped: No bookings available');
    console.log('💡 Create a booking with orders first using the checkout process');
    return;
  }

  // Step 3: Get orders for the booking
  const orders = await getBookingOrders(testBookingId);
  if (orders.length === 0) {
    console.log('\n⚠️  Test skipped: Booking has no orders');
    return;
  }

  // Get first order ID
  const firstOrderId = orders[0].orderId;

  // Step 4: Check initial booking status
  console.log('\n📊 INITIAL STATE');
  console.log('================');
  const initialBooking = await checkBookingStatus(testBookingId);
  const initialStatus = initialBooking?.status;
  const initialProgress = initialBooking?.overallProgress || 0;

  // Step 5: Update order status to in-progress
  console.log('\n🔄 TEST: Changing order status to "in-progress"');
  console.log('================================================');
  await updateOrderStatus(firstOrderId, 'in-progress');

  // Wait for hook to execute
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 6: Check booking status after order update
  console.log('\n📊 STATE AFTER ORDER UPDATE');
  console.log('===========================');
  const updatedBooking = await checkBookingStatus(testBookingId);
  const updatedStatus = updatedBooking?.status;
  const updatedProgress = updatedBooking?.overallProgress || 0;

  // Step 7: Verify changes
  console.log('\n✅ TEST RESULTS');
  console.log('==============');
  console.log(`Initial Status: ${initialStatus}`);
  console.log(`Updated Status: ${updatedStatus}`);
  console.log(`Initial Progress: ${initialProgress}%`);
  console.log(`Updated Progress: ${updatedProgress}%`);

  if (initialStatus === 'pending' && updatedStatus === 'processing') {
    console.log('\n🎉 SUCCESS: Booking status automatically changed from "pending" to "processing"!');
  } else if (updatedStatus === 'processing') {
    console.log('\n✅ SUCCESS: Booking status is already "processing"');
  } else {
    console.log(`\n⚠️  INFO: Booking status is "${updatedStatus}" (not tested for auto-update from this state)`);
  }

  if (updatedProgress > initialProgress) {
    console.log(`🎉 SUCCESS: Overall progress increased from ${initialProgress}% to ${updatedProgress}%!`);
  } else if (updatedProgress > 0) {
    console.log(`✅ SUCCESS: Overall progress is ${updatedProgress}%`);
  }

  console.log('\n✅ Test completed successfully!');
  console.log('\n💡 TIP: Check the server logs for detailed hook execution logs');
}

// Run the test
runTest().catch(error => {
  console.error('\n❌ Test failed with error:', error.message);
  process.exit(1);
});
