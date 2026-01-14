#!/usr/bin/env node

/**
 * Script to test API endpoints
 * Useful for verifying that the API is working correctly
 *
 * Usage: node server/scripts/test-api.js [--host=http://localhost:3000]
 */

const axios = require('axios');

// Configuration
const args = process.argv.slice(2);
let apiHost = 'http://localhost:3000';

args.forEach(arg => {
  if (arg.startsWith('--host=')) {
    apiHost = arg.split('=')[1];
  }
});

console.log('=== API Testing Script ===');
console.log(`Testing API at: ${apiHost}\n`);

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper function to run a test
async function runTest(name, testFn) {
  process.stdout.write(`Testing ${name}... `);
  try {
    await testFn();
    console.log('✓ PASSED');
    results.passed++;
    results.tests.push({ name, status: 'passed' });
  } catch (error) {
    console.log(`✗ FAILED: ${error.message}`);
    results.failed++;
    results.tests.push({ name, status: 'failed', error: error.message });
  }
}

async function testAPI() {
  let authToken = null;
  let userId = null;

  // Test 1: Health check
  await runTest('Health Check (GET /api/health)', async () => {
    const response = await axios.get(`${apiHost}/api/health`);
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    if (!response.data.status || response.data.status !== 'ok') {
      throw new Error('Health check returned invalid status');
    }
  });

  // Test 2: Login with admin credentials
  await runTest('Admin Login (POST /api/auth/login)', async () => {
    const response = await axios.post(`${apiHost}/api/auth/login`, {
      email: 'admin@example.com',
      password: 'admin123'
    });

    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    if (!response.data.accessToken) {
      throw new Error('No access token returned');
    }

    authToken = response.data.accessToken;
    if (response.data.user) {
      userId = response.data.user._id || response.data.user.id;
    }
  });

  // Test 3: Get user profile
  await runTest('Get User Profile (GET /api/users/me)', async () => {
    if (!authToken) {
      throw new Error('No auth token available');
    }

    const response = await axios.get(`${apiHost}/api/users/me`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    if (!response.data.email) {
      throw new Error('No email in user profile');
    }
  });

  // Test 4: Get orders
  await runTest('Get Orders (GET /api/orders)', async () => {
    if (!authToken) {
      throw new Error('No auth token available');
    }

    const response = await axios.get(`${apiHost}/api/orders`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    if (!Array.isArray(response.data.orders)) {
      throw new Error('Orders response is not an array');
    }
  });

  // Test 5: Get services
  await runTest('Get Services (GET /api/services)', async () => {
    const response = await axios.get(`${apiHost}/api/services`);

    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    if (!Array.isArray(response.data.services)) {
      throw new Error('Services response is not an array');
    }
  });

  // Test 6: Get products
  await runTest('Get Products (GET /api/products)', async () => {
    const response = await axios.get(`${apiHost}/api/products`);

    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    if (!Array.isArray(response.data.products)) {
      throw new Error('Products response is not an array');
    }
  });

  // Test 7: Get device brands
  await runTest('Get Device Brands (GET /api/devices/brands)', async () => {
    const response = await axios.get(`${apiHost}/api/devices/brands`);

    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    if (!Array.isArray(response.data)) {
      throw new Error('Brands response is not an array');
    }
  });

  // Test 8: Get cart (requires auth)
  await runTest('Get Cart (GET /api/cart)', async () => {
    if (!authToken) {
      throw new Error('No auth token available');
    }

    const response = await axios.get(`${apiHost}/api/cart`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
  });

  // Test 9: Unauthorized access test
  await runTest('Unauthorized Access (GET /api/orders without token)', async () => {
    try {
      await axios.get(`${apiHost}/api/orders`);
      throw new Error('Expected 401 error but request succeeded');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        // This is expected
        return;
      }
      throw new Error(`Expected 401 status, got ${error.response?.status || 'unknown'}`);
    }
  });

  // Test 10: Invalid endpoint
  await runTest('Invalid Endpoint (GET /api/nonexistent)', async () => {
    try {
      await axios.get(`${apiHost}/api/nonexistent`);
      throw new Error('Expected 404 error but request succeeded');
    } catch (error) {
      if (error.response && error.response.status === 404) {
        // This is expected
        return;
      }
      throw new Error(`Expected 404 status, got ${error.response?.status || 'unknown'}`);
    }
  });

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`✓ Passed: ${results.passed}`);
  console.log(`✗ Failed: ${results.failed}`);

  if (results.failed > 0) {
    console.log('\nFailed Tests:');
    results.tests
      .filter(t => t.status === 'failed')
      .forEach(t => {
        console.log(`  • ${t.name}: ${t.error}`);
      });
  }

  console.log('\n' + (results.failed === 0 ? '✓ All tests passed!' : '⚠ Some tests failed'));

  return results.failed === 0;
}

// Run the tests
if (require.main === module) {
  testAPI()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n✗ Test suite failed:', error.message);
      process.exit(1);
    });
}

module.exports = testAPI;
