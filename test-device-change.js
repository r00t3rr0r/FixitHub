const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

let testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

const log = (message, type = 'info') => {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '✓',
    error: '✗',
    warning: '⚠'
  }[type] || '•';
  console.log(timestamp + ' ' + prefix + ' ' + message);
};

async function runTests() {
  log('Starting Device Change Feature Tests', 'info');
  log('========================================', 'info');

  let adminToken = null;
  let orderId = null;
  let originalDevice = null;

  try {
    // Step 1: Admin Login
    log('Step 1: Admin Login', 'info');
    try {
      const loginResponse = await axios.post(BASE_URL + '/auth/login', {
        email: 'admin@fixithub.com',
        password: 'password123'
      });
      adminToken = loginResponse.data.token;
      log('Admin login successful, token received', 'info');
      testResults.passed++;
    } catch (error) {
      const errorMsg = error.response && error.response.data ? error.response.data.error : error.message;
      log('Admin login failed: ' + errorMsg, 'error');
      testResults.failed++;
      testResults.errors.push('Admin login failed');
      return;
    }

    // Step 2: Get available orders
    log('\nStep 2: Fetching orders', 'info');
    try {
      const ordersResponse = await axios.get(BASE_URL + '/admin/orders', {
        headers: { Authorization: 'Bearer ' + adminToken }
      });

      if (ordersResponse.data.orders && ordersResponse.data.orders.length > 0) {
        orderId = ordersResponse.data.orders[0]._id;
        originalDevice = {
          brand: ordersResponse.data.orders[0].deviceBrand,
          model: ordersResponse.data.orders[0].deviceModel,
          type: ordersResponse.data.orders[0].deviceType
        };
        log('Found order ' + ordersResponse.data.orders[0].orderNumber + ' with device: ' + originalDevice.brand + ' ' + originalDevice.model, 'info');
        testResults.passed++;
      } else {
        log('No orders available for testing', 'warning');
        testResults.failed++;
        testResults.errors.push('No test orders available');
        return;
      }
    } catch (error) {
      const errorMsg = error.response && error.response.data ? error.response.data.error : error.message;
      log('Failed to fetch orders: ' + errorMsg, 'error');
      testResults.failed++;
      testResults.errors.push('Failed to fetch orders');
      return;
    }

    // Step 3: Test Device Change
    log('\nStep 3: Testing device change and service recalculation', 'info');
    try {
      const newDevice = {
        deviceBrand: 'Samsung',
        deviceModel: 'Galaxy S24',
        deviceType: 'Smartphone'
      };

      const changeResponse = await axios.post(
        BASE_URL + '/admin/orders/' + orderId + '/change-device',
        newDevice,
        { headers: { Authorization: 'Bearer ' + adminToken } }
      );

      if (changeResponse.data.success) {
        log('Device change successful', 'info');
        const summary = changeResponse.data.pricingChangesSummary;
        log('Total Cost Before: $' + summary.totalCostBefore.toFixed(2), 'info');
        log('Total Cost After: $' + summary.totalCostAfter.toFixed(2), 'info');
        testResults.passed++;
      } else {
        log('Device change failed: No success flag', 'error');
        testResults.failed++;
      }
    } catch (error) {
      const errorMsg = error.response && error.response.data ? error.response.data.error : error.message;
      log('Device change failed: ' + errorMsg, 'error');
      testResults.failed++;
    }

    // Step 4: Confirm Device Change
    log('\nStep 4: Confirming device change', 'info');
    try {
      const confirmResponse = await axios.post(
        BASE_URL + '/admin/orders/' + orderId + '/confirm-device-change',
        { confirmed: true },
        { headers: { Authorization: 'Bearer ' + adminToken } }
      );

      if (confirmResponse.data.success) {
        log('Device change confirmed successfully', 'info');
        testResults.passed++;
      } else {
        log('Device change confirmation failed', 'error');
        testResults.failed++;
      }
    } catch (error) {
      const errorMsg = error.response && error.response.data ? error.response.data.error : error.message;
      log('Device change confirmation failed: ' + errorMsg, 'error');
      testResults.failed++;
    }

  } catch (error) {
    log('Unexpected error: ' + error.message, 'error');
    testResults.failed++;
  }

  // Print Summary
  log('\n========================================', 'info');
  log('Test Summary', 'info');
  log('Passed: ' + testResults.passed, 'info');
  log('Failed: ' + testResults.failed, 'error');
  log('========================================', 'info');

  process.exit(testResults.failed > 0 ? 1 : 0);
}

runTests().catch(function(error) {
  log('Fatal error: ' + error.message, 'error');
  process.exit(1);
});
