#!/usr/bin/env node

const axios = require('axios');

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';

// Test data
let authToken = '';
let testOrderId = '';
let testUserId = '';
let messageId = '';

async function makeRequest(method, path, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${path}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (data) {
      config.data = data;
    }

    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }

    console.log(`\n📤 ${method} ${path}`);
    if (data) {
      console.log('Request body:', JSON.stringify(data, null, 2));
    }

    const response = await axios(config);
    console.log(`✅ Status: ${response.status}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error(`❌ Error: ${error.response?.status || error.message}`);
    if (error.response?.data) {
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

async function runTests() {
  console.log('🧪 Testing Inspection Communication API\n');
  console.log(`API Base URL: ${API_BASE_URL}\n`);

  try {
    // Step 1: Login as admin
    console.log('\n📋 Step 1: Login as admin user');
    const loginResponse = await makeRequest('POST', '/api/auth/login', {
      email: 'admin@example.com',
      password: 'password123',
    });

    authToken = loginResponse.token;
    testUserId = loginResponse.user._id;
    console.log(`✅ Logged in as: ${loginResponse.user.name} (${loginResponse.user.email})`);

    // Step 2: Get orders
    console.log('\n📋 Step 2: Fetch orders');
    const ordersResponse = await makeRequest('GET', '/api/orders');
    if (ordersResponse.orders && ordersResponse.orders.length > 0) {
      testOrderId = ordersResponse.orders[0]._id;
      console.log(`✅ Found order: ${testOrderId}`);
    } else {
      console.log('⚠️ No orders found, creating a test communication thread anyway');
      testOrderId = '68acb7f9c405dad4de3a6c84'; // Use a test order ID
    }

    // Step 3: Get or create communication thread
    console.log('\n📋 Step 3: Get communication thread');
    const threadResponse = await makeRequest('GET', `/api/inspection-communication/${testOrderId}`);
    console.log(`✅ Communication thread retrieved/created`);

    // Step 4: Send a message
    console.log('\n📋 Step 4: Send a message');
    const messageResponse = await makeRequest('POST', `/api/inspection-communication/${testOrderId}/message`, {
      content: 'Hello! We are currently inspecting your device. Please stand by for updates.',
    });
    if (messageResponse.messages && messageResponse.messages.length > 0) {
      messageId = messageResponse.messages[messageResponse.messages.length - 1]._id;
      console.log(`✅ Message sent with ID: ${messageId}`);
    }

    // Step 5: Create a quick action (part replacement)
    console.log('\n📋 Step 5: Create quick action (part replacement)');
    const quickActionResponse = await makeRequest(
      'POST',
      `/api/inspection-communication/${testOrderId}/quick-action`,
      {
        actionType: 'part_replacement',
        description: 'Your device requires a battery replacement. This will add $45 to the repair cost.',
        metadata: {
          partName: 'Battery',
          estimatedCost: 45,
        },
      }
    );
    console.log(`✅ Quick action created`);

    // Step 6: Send feedback request
    console.log('\n📋 Step 6: Send feedback request');
    const feedbackResponse = await makeRequest(
      'POST',
      `/api/inspection-communication/${testOrderId}/feedback-request`,
      {
        inspectionId: null,
        question: 'Do you approve the $45 battery replacement?',
        options: [
          { label: 'Yes, proceed with the repair', value: 'approve' },
          { label: 'No, I need to think about it', value: 'decline' },
          { label: 'No, cancel this repair', value: 'cancel' },
        ],
      }
    );
    if (feedbackResponse.messages && feedbackResponse.messages.length > 0) {
      messageId = feedbackResponse.messages[feedbackResponse.messages.length - 1]._id;
      console.log(`✅ Feedback request sent with ID: ${messageId}`);
    }

    // Step 7: Respond to feedback
    console.log('\n📋 Step 7: Respond to feedback request');
    if (messageId) {
      const responseData = await makeRequest(
        'POST',
        `/api/inspection-communication/${testOrderId}/feedback-response`,
        {
          messageId,
          response: { label: 'Yes, proceed with the repair', value: 'approve' },
        }
      );
      console.log(`✅ Feedback response recorded`);
    }

    // Step 8: Get pending feedback count
    console.log('\n📋 Step 8: Get pending feedback count');
    const feedbackCountResponse = await makeRequest(
      'GET',
      `/api/inspection-communication/${testOrderId}/pending-feedback`
    );
    console.log(`✅ Pending feedback count: ${feedbackCountResponse.count}`);

    // Step 9: Get pending actions count
    console.log('\n📋 Step 9: Get pending actions count');
    const actionsCountResponse = await makeRequest(
      'GET',
      `/api/inspection-communication/${testOrderId}/pending-actions`
    );
    console.log(`✅ Pending actions count: ${actionsCountResponse.count}`);

    // Step 10: Mark messages as read
    console.log('\n📋 Step 10: Mark messages as read');
    const readResponse = await makeRequest('PUT', `/api/inspection-communication/${testOrderId}/mark-read`, {});
    console.log(`✅ Messages marked as read`);

    // Step 11: Get updated communication thread
    console.log('\n📋 Step 11: Get final communication thread');
    const finalThreadResponse = await makeRequest('GET', `/api/inspection-communication/${testOrderId}`);
    console.log(`✅ Final communication thread retrieved with ${finalThreadResponse.messages.length} messages`);

    console.log('\n\n✅ All tests passed successfully!\n');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

runTests();
