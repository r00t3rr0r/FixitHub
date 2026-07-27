#!/usr/bin/env node

/**
 * Test Login Script
 * This script tests the login functionality to ensure authentication is working correctly
 * Usage: node server/scripts/test-login.js
 */

const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Test credentials
const testCredentials = [
  {
    email: 'admin@example.com',
    password: 'admin123',
    role: 'admin'
  },
  {
    email: 'customer@example.com',
    password: 'password123',
    role: 'customer'
  },
  {
    email: 'staff@example.com',
    password: 'password123',
    role: 'staff'
  }
];

async function testLogin(credentials) {
  try {
    console.log(`\n📝 Testing login for ${credentials.role} (${credentials.email})...`);

    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email: credentials.email,
      password: credentials.password
    });

    if (response.status === 200 && response.data.token) {
      console.log(`✅ Login successful for ${credentials.role}`);
      console.log(`   Token: ${response.data.token.substring(0, 50)}...`);
      return true;
    } else {
      console.log(`❌ Login failed - unexpected response for ${credentials.role}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Login failed for ${credentials.role}:`);
    if (error.response?.data?.error) {
      console.log(`   Error: ${error.response.data.error}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
    return false;
  }
}

async function testDatabaseHealth() {
  try {
    console.log('\n🏥 Testing database health...');

    const response = await axios.get(`${API_URL}/api/health`);

    if (response.status === 200) {
      console.log('✅ Server health check passed');
      console.log(`   Status: ${response.data.status}`);
      return true;
    }
  } catch (error) {
    console.log('❌ Server health check failed');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('🧪 McRepair.de Login Test Suite');
  console.log('='.repeat(60));
  console.log(`API URL: ${API_URL}`);

  let results = {
    health: false,
    logins: []
  };

  // Test database health first
  results.health = await testDatabaseHealth();

  if (!results.health) {
    console.log('\n⚠️  Server health check failed. Attempting logins anyway...\n');
  }

  // Test each user login
  for (const creds of testCredentials) {
    const success = await testLogin(creds);
    results.logins.push({
      role: creds.role,
      success
    });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`Server Health: ${results.health ? '✅ Passed' : '❌ Failed'}`);

  const successCount = results.logins.filter(l => l.success).length;
  console.log(`Login Tests: ${successCount}/${results.logins.length} passed`);

  results.logins.forEach(result => {
    console.log(`  - ${result.role}: ${result.success ? '✅' : '❌'}`);
  });

  const allPassed = results.health && results.logins.every(l => l.success);

  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('✅ All tests passed!');
  } else {
    console.log('❌ Some tests failed. Check the errors above.');
  }
  console.log('='.repeat(60));

  process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('Test suite error:', error.message);
  process.exit(1);
});
