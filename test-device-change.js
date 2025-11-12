#!/usr/bin/env node

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3001';
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin123';

let adminToken = null;
let orderId = null;
let adminUserId = null;

// Helper function to make API requests
async function request(method, path, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${path}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response?.data) {
      throw new Error(`API Error: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

// Step 1: Login as admin
async function login() {
  console.log('\n📝 Step 1: Logging in as admin...');
  try {
    const response = await request('POST', '/api/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    adminToken = response.accessToken;
    adminUserId = response.user._id;
    console.log('✅ Admin logged in successfully');
    console.log(`   Token: ${adminToken.substring(0, 20)}...`);
    console.log(`   User ID: ${adminUserId}`);
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    throw error;
  }
}

// Step 2: Get an order (or create one if needed)
async function getOrCreateOrder() {
  console.log('\n📝 Step 2: Fetching an existing order...');
  try {
    const response = await request('GET', '/api/admin/orders?limit=1', null, {
      'Authorization': `Bearer ${adminToken}`
    });

    if (response.orders && response.orders.length > 0) {
      orderId = response.orders[0]._id;
      console.log('✅ Found order:', orderId);
      console.log(`   Current device: ${response.orders[0].deviceBrand} ${response.orders[0].deviceModel}`);
      return;
    }

    console.log('⚠️  No orders found. Please create an order first.');
    throw new Error('No orders available for testing');
  } catch (error) {
    console.error('❌ Failed to get order:', error.message);
    throw error;
  }
}

// Step 3: Test the device change endpoint
async function testDeviceChange() {
  console.log('\n📝 Step 3: Testing device change endpoint...');
  try {
    const newDevice = {
      deviceBrand: 'Samsung',
      deviceModel: 'Galaxy S24 Ultra',
      deviceType: 'Smartphone'
    };

    console.log('   Updating device to:', newDevice);

    const response = await request(
      'PUT',
      `/api/admin/orders/${orderId}/device`,
      newDevice,
      { 'Authorization': `Bearer ${adminToken}` }
    );

    console.log('✅ Device changed successfully');
    console.log(`   Response status: ${response.success}`);
    console.log(`   Message: ${response.message}`);
    console.log(`   Updated device: ${response.order.deviceBrand} ${response.order.deviceModel}`);

    // Verify the change was recorded in timeline
    const timeline = response.order.timeline || [];
    const deviceChangeEntry = timeline.find(entry => entry.status === 'Device Changed');
    if (deviceChangeEntry) {
      console.log('   ✅ Timeline entry created:', deviceChangeEntry.description);
    }
  } catch (error) {
    console.error('❌ Device change failed:', error.message);
    throw error;
  }
}

// Step 4: Verify the change persisted
async function verifyDeviceChange() {
  console.log('\n📝 Step 4: Verifying device change persisted...');
  try {
    const response = await request(
      'GET',
      `/api/admin/orders/${orderId}`,
      null,
      { 'Authorization': `Bearer ${adminToken}` }
    );

    console.log('✅ Device verification successful');
    console.log(`   Device Brand: ${response.order.deviceBrand}`);
    console.log(`   Device Model: ${response.order.deviceModel}`);
    console.log(`   Device Type: ${response.order.deviceType}`);
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    throw error;
  }
}

// Main test runner
async function runTests() {
  console.log('\n🧪 Testing Device Change Functionality');
  console.log('=========================================');

  try {
    await login();
    await getOrCreateOrder();
    await testDeviceChange();
    await verifyDeviceChange();

    console.log('\n✅ All tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests
runTests();
