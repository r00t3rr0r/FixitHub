#!/usr/bin/env node

/**
 * Test script for Device Inspection API
 * Tests all inspection workflow endpoints
 * Usage: npm run seed && node scripts/test-inspection.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const axios = require('axios');
const { connectDB } = require('../config/database');

const API_BASE = process.env.API_URL || 'http://localhost:3000/api';
let adminToken = '';
let testOrderId = '';
let testCustomerId = '';
let testTechnicianId = '';

const testInspection = async () => {
  try {
    // Connect to database
    console.log('Connecting to database...');
    await connectDB();

    // Step 1: Login as admin to get token
    console.log('\n=== Step 1: Admin Login ===');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@example.com',
      password: 'admin123',
    });

    adminToken = loginResponse.data.token;
    testTechnicianId = loginResponse.data.user._id;
    console.log('✓ Admin logged in successfully');
    console.log(`  Token: ${adminToken.substring(0, 20)}...`);

    // Step 2: Get an existing order for testing
    console.log('\n=== Step 2: Fetch Test Order ===');
    const ordersResponse = await axios.get(`${API_BASE}/admin/orders`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (ordersResponse.data.orders && ordersResponse.data.orders.length > 0) {
      const testOrder = ordersResponse.data.orders[0];
      testOrderId = testOrder._id;
      testCustomerId = testOrder.customerId._id || testOrder.customerId;
      console.log('✓ Test order found');
      console.log(`  Order ID: ${testOrderId}`);
      console.log(`  Customer ID: ${testCustomerId}`);
      console.log(`  Device: ${testOrder.deviceBrand} ${testOrder.deviceModel}`);
      console.log(`  Device Type: ${testOrder.deviceType}`);
    } else {
      throw new Error('No orders found. Please seed test data first with: npm run seed');
    }

    // Step 3: Initialize Inspection
    console.log('\n=== Step 3: Initialize Inspection ===');
    const initResponse = await axios.post(
      `${API_BASE}/device-inspections/init`,
      {
        orderId: testOrderId,
        customerId: testCustomerId,
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    console.log('✓ Inspection initialized');
    console.log(`  Inspection ID: ${initResponse.data.inspection._id}`);

    // Step 4: Update Model Verification
    console.log('\n=== Step 4: Model Verification ===');
    await axios.put(
      `${API_BASE}/device-inspections/${testOrderId}/model-verification`,
      {
        reportedModel: 'iPhone 12',
        actualModel: 'iPhone 12',
        verificationStatus: 'correct',
        costDifference: 0,
        notes: 'Model matches customer report',
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    console.log('✓ Model verification saved');

    // Step 5: Update Identification
    console.log('\n=== Step 5: Device Identification ===');
    const idResponse = await axios.put(
      `${API_BASE}/device-inspections/${testOrderId}/identification`,
      {
        deviceType: 'Smartphone',
        imei: '351234567890123',
        serialNumber: null,
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    console.log('✓ Identification saved');
    console.log(`  IMEI: 351234567890123`);

    // Step 6: Update Accessories
    console.log('\n=== Step 6: Accessories & Packaging ===');
    await axios.put(
      `${API_BASE}/device-inspections/${testOrderId}/accessories`,
      {
        originalPackaging: { present: true, description: 'Original box present' },
        caseCover: { present: true, description: 'Apple case included' },
        powerAdapter: { present: true, description: 'USB-C adapter included' },
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    console.log('✓ Accessories checked');

    // Step 7: Update External Inspection
    console.log('\n=== Step 7: External Inspection ===');
    await axios.put(
      `${API_BASE}/device-inspections/${testOrderId}/external-inspection`,
      {
        display: { status: 'OK', notes: 'Screen in good condition' },
        frame: { status: 'OK', notes: 'No frame damage' },
        backCover: { status: 'OK', notes: 'Back glass intact' },
        buttons: { status: 'OK', notes: 'All buttons responsive' },
        visibleDamages: { hasDamage: false, description: '' },
        uniqueNotes: 'Device appears to be in excellent condition',
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    console.log('✓ External inspection completed');

    // Step 8: Update Device Tests
    console.log('\n=== Step 8: Device Testing ===');
    const testResponse = await axios.put(
      `${API_BASE}/device-inspections/${testOrderId}/device-tests`,
      {
        charging: { status: 'OK', notes: 'Charges normally' },
        power: { status: 'OK', notes: 'Powers on and off' },
        wifi: { status: 'OK', notes: 'Wi-Fi connects' },
        frontCamera: { status: 'OK', notes: 'Front camera functional' },
        mainCamera: { status: 'OK', notes: 'Main camera functional' },
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    console.log('✓ Device tests completed');
    console.log(`  Failed tests: ${testResponse.data.hasFailedTests ? 'Yes' : 'No'}`);

    // Step 9: Update Apple-Specific Checks
    console.log('\n=== Step 9: Apple-Specific Checks ===');
    await axios.put(
      `${API_BASE}/device-inspections/${testOrderId}/apple-specific`,
      {
        modemFirmware: { present: true, notes: 'Modem firmware present' },
        touchIdFaceId: { applicable: true, working: true, notes: 'Face ID working' },
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    console.log('✓ Apple-specific checks completed');

    // Step 10: Get Inspection Status
    console.log('\n=== Step 10: Get Inspection Status ===');
    const inspectionResponse = await axios.get(
      `${API_BASE}/device-inspections/${testOrderId}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    const inspection = inspectionResponse.data.inspection;
    console.log('✓ Inspection status retrieved');
    console.log(`  Status: ${inspection.status}`);
    console.log(`  Completed Steps: ${inspection.completedSteps.length}/6`);
    console.log(`  Has Failed Tests: ${inspection.hasFailedTests}`);

    // Step 11: Complete Inspection
    console.log('\n=== Step 11: Complete Inspection ===');
    const completeResponse = await axios.put(
      `${API_BASE}/device-inspections/${testOrderId}/complete`,
      {
        isRepairable: true,
        repairOffer: {
          cost: 299,
          timeframe: '3-5 days',
          description: 'Screen replacement',
        },
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    console.log('✓ Inspection completed');
    console.log(`  Repairable: ${completeResponse.data.inspection.isRepairable}`);
    console.log(`  Repair Cost: $${completeResponse.data.inspection.repairOffer?.cost}`);

    // Step 12: Generate Report
    console.log('\n=== Step 12: Generate Inspection Report ===');
    const reportResponse = await axios.get(
      `${API_BASE}/device-inspections/${testOrderId}/report`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    console.log('✓ Report generated');
    console.log(`  Report URL: ${reportResponse.data.reportUrl}`);

    console.log('\n=== All Tests Passed! ===\n');
    console.log('Summary:');
    console.log('✓ Inspection initialized');
    console.log('✓ Model verified');
    console.log('✓ Device identification recorded');
    console.log('✓ Accessories checked');
    console.log('✓ External inspection completed');
    console.log('✓ Device tests completed');
    console.log('✓ Apple-specific checks completed');
    console.log('✓ Inspection finalized');
    console.log('✓ Report generated');

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Test Failed!');
    console.error('Error:', error.message);

    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }

    if (error.response?.status) {
      console.error('Status:', error.response.status);
    }

    process.exit(1);
  }
};

// Run tests
testInspection();
