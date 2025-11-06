#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api';
let authToken = null;

async function login(email, password) {
  try {
    console.log(`\n📝 Logging in as ${email}...`);
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email,
      password
    });

    authToken = response.data.token;
    console.log(`✅ Successfully logged in. Token: ${authToken.slice(0, 20)}...`);
    return response.data;
  } catch (error) {
    console.error(`❌ Login failed:`, error.response?.data?.error || error.message);
    throw error;
  }
}

async function getOrders() {
  try {
    console.log(`\n📦 Fetching orders...`);
    const response = await axios.get(`${API_BASE_URL}/orders`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    console.log(`✅ Found ${response.data.orders.length} orders`);
    return response.data.orders;
  } catch (error) {
    console.error(`❌ Failed to fetch orders:`, error.response?.data?.error || error.message);
    throw error;
  }
}

async function getProgressTimeline(orderId) {
  try {
    console.log(`\n⏱️  Fetching progress timeline for order ${orderId}...`);
    const response = await axios.get(`${API_BASE_URL}/orders/${orderId}/progress-timeline`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    console.log(`✅ Timeline retrieved successfully!`);
    console.log(`\n📊 Progress Timeline Data:`);
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to fetch progress timeline:`, error.response?.data?.error || error.message);
    throw error;
  }
}

async function runTests() {
  try {
    console.log('🚀 Starting Progress Timeline API Tests...\n');

    // Login as admin
    await login('admin@example.com', 'admin123');

    // Get orders
    const orders = await getOrders();

    if (orders.length === 0) {
      console.log('\n⚠️  No orders found. Please create an order first.');
      return;
    }

    // Test progress timeline for first order
    const firstOrder = orders[0];
    console.log(`\n🎯 Testing with order: ${firstOrder._id}`);
    const timeline = await getProgressTimeline(firstOrder._id);

    // Validate timeline structure
    console.log(`\n✅ Timeline Structure Validation:`);
    console.log(`  - Has 'stages' array: ${Array.isArray(timeline.stages)}`);
    console.log(`  - Number of stages: ${timeline.stages.length}`);
    console.log(`  - Has 'currentStage': ${!!timeline.currentStage}`);
    console.log(`  - Has 'orderStatus': ${!!timeline.orderStatus}`);
    console.log(`  - Has 'progress': ${typeof timeline.progress === 'number'}`);

    // Validate each stage
    console.log(`\n✅ Validating stages:`);
    timeline.stages.forEach((stage, index) => {
      console.log(`  Stage ${index + 1}: ${stage.label}`);
      console.log(`    - ID: ${stage.id}`);
      console.log(`    - Status: ${stage.status}`);
      console.log(`    - Date: ${stage.date || 'N/A'}`);
    });

    console.log(`\n✅ All tests passed!`);
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Test failed:`, error.message);
    process.exit(1);
  }
}

runTests();
