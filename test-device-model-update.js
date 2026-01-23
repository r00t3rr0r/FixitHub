const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test credentials
const ADMIN_CREDENTIALS = {
  email: 'admin@example.com',
  password: 'admin123'
};

let authToken = '';

// Helper function to log with colors
const log = {
  info: (msg) => console.log(`\n✅ ${msg}`),
  error: (msg) => console.log(`\n❌ ${msg}`),
  step: (msg) => console.log(`\n🔹 ${msg}`),
  data: (msg, data) => console.log(`\n📊 ${msg}:`, JSON.stringify(data, null, 2))
};

async function login() {
  try {
    log.step('Step 1: Logging in as admin');
    const response = await axios.post(`${BASE_URL}/api/auth/login`, ADMIN_CREDENTIALS);
    authToken = response.data.accessToken;
    log.info('Successfully logged in');
    return true;
  } catch (error) {
    log.error(`Login failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function getDeviceTypes() {
  try {
    log.step('Step 2: Fetching device types');
    const response = await axios.get(`${BASE_URL}/api/devices/types`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    log.data('Device types', response.data.deviceTypes);
    return response.data.deviceTypes[0]; // Return first device type
  } catch (error) {
    log.error(`Failed to fetch device types: ${error.response?.data?.error || error.message}`);
    return null;
  }
}

async function getManufacturers(deviceTypeId) {
  try {
    log.step('Step 3: Fetching manufacturers for device type');
    const response = await axios.get(`${BASE_URL}/api/devices/manufacturers?deviceType=${deviceTypeId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    log.data('Manufacturers', response.data.manufacturers);
    return response.data.manufacturers[0]; // Return first manufacturer
  } catch (error) {
    log.error(`Failed to fetch manufacturers: ${error.response?.data?.error || error.message}`);
    return null;
  }
}

async function getModels(deviceTypeId, manufacturerId) {
  try {
    log.step('Step 4: Fetching models');
    const response = await axios.get(`${BASE_URL}/api/devices/models?deviceType=${deviceTypeId}&manufacturer=${manufacturerId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    log.data('Models', response.data.models);

    if (response.data.models.length === 0) {
      log.error('No models found');
      return null;
    }

    const model = response.data.models[0];

    // Verify brandId is present
    if (!model.brandId) {
      log.error('❌ CRITICAL: Model does not have brandId field!');
      log.data('Model data', model);
      return null;
    }

    log.info('✅ Model has brandId field');
    log.data('Selected model for testing', model);
    return model;
  } catch (error) {
    log.error(`Failed to fetch models: ${error.response?.data?.error || error.message}`);
    return null;
  }
}

async function updateModel(modelId, updateData) {
  try {
    log.step('Step 5: Updating model');
    log.data('Update payload', updateData);

    const response = await axios.put(`${BASE_URL}/api/devices/models/${modelId}`, updateData, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    log.info('✅ Model updated successfully');
    log.data('Updated model', response.data.model);
    return response.data.model;
  } catch (error) {
    log.error(`Failed to update model: ${error.response?.data?.error || error.message}`);
    log.data('Error response', error.response?.data);
    return null;
  }
}

async function testEmptyBrandId(modelId) {
  try {
    log.step('Step 6: Testing validation - trying to update with empty brandId');

    const response = await axios.put(`${BASE_URL}/api/devices/models/${modelId}`, {
      name: 'Test Model',
      brandId: '',  // Empty string - should fail
      deviceType: 'smartphone'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    log.error('❌ VALIDATION FAILED: Empty brandId was accepted!');
    return false;
  } catch (error) {
    if (error.response?.data?.error?.includes('Brand ID is required')) {
      log.info('✅ Validation working: Empty brandId was rejected');
      return true;
    } else {
      log.error(`Unexpected error: ${error.response?.data?.error || error.message}`);
      return false;
    }
  }
}

async function runTests() {
  console.log('='.repeat(80));
  console.log('🧪 DEVICE MODEL UPDATE FIX VERIFICATION TEST');
  console.log('='.repeat(80));

  // Step 1: Login
  const loginSuccess = await login();
  if (!loginSuccess) {
    log.error('Cannot continue without authentication');
    process.exit(1);
  }

  // Step 2: Get device types
  const deviceType = await getDeviceTypes();
  if (!deviceType) {
    log.error('Cannot continue without device type');
    process.exit(1);
  }

  // Step 3: Get manufacturers
  const manufacturer = await getManufacturers(deviceType._id);
  if (!manufacturer) {
    log.error('Cannot continue without manufacturer');
    process.exit(1);
  }

  // Step 4: Get models and verify brandId is present
  const model = await getModels(deviceType._id, manufacturer._id);
  if (!model) {
    log.error('Cannot continue without model');
    process.exit(1);
  }

  // Step 5: Update model with valid data
  const updateData = {
    name: model.name,
    brandId: model.brandId,  // This should now be present
    deviceType: model.deviceType,
    image: model.image || '',
    specifications: model.specifications || {}
  };

  const updatedModel = await updateModel(model._id, updateData);
  if (!updatedModel) {
    log.error('Model update failed');
    process.exit(1);
  }

  // Step 6: Test validation
  const validationPassed = await testEmptyBrandId(model._id);

  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(80));

  if (model.brandId && updatedModel && validationPassed) {
    log.info('✅ ALL TESTS PASSED!');
    console.log('\n✅ 1. Models now include brandId field');
    console.log('✅ 2. Model update works with brandId');
    console.log('✅ 3. Validation prevents empty brandId');
    console.log('\n🎉 The fix is working correctly!');
  } else {
    log.error('❌ SOME TESTS FAILED');
    if (!model.brandId) console.log('❌ Models do not include brandId field');
    if (!updatedModel) console.log('❌ Model update failed');
    if (!validationPassed) console.log('❌ Validation is not working');
  }

  console.log('='.repeat(80));
}

// Run the tests
runTests().catch(error => {
  log.error(`Test execution failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
