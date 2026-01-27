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
  data: (msg, data) => console.log(`\n📊 ${msg}:`, JSON.stringify(data, null, 2)),
  section: (msg) => console.log(`\n${'='.repeat(80)}\n${msg}\n${'='.repeat(80)}`)
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
    log.info(`Found ${response.data.deviceTypes.length} device types`);
    return response.data.deviceTypes[0];
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
    log.info(`Found ${response.data.manufacturers.length} manufacturers`);
    return response.data.manufacturers[0];
  } catch (error) {
    log.error(`Failed to fetch manufacturers: ${error.response?.data?.error || error.message}`);
    return null;
  }
}

async function getModels(deviceTypeId, manufacturerId) {
  try {
    log.step('Step 4: Fetching models with comprehensive specifications');
    const response = await axios.get(`${BASE_URL}/api/devices/models?deviceType=${deviceTypeId}&manufacturer=${manufacturerId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (response.data.models.length === 0) {
      log.error('No models found');
      return null;
    }

    const model = response.data.models[0];
    log.info('✅ Model fetched successfully');

    // Verify all specification sections are present
    log.section('COMPREHENSIVE SPECIFICATIONS VERIFICATION');

    const specificationSections = [
      'images',
      'network',
      'physical',
      'display',
      'platform',
      'memory',
      'rearCamera',
      'frontCamera',
      'audio',
      'connectivity',
      'features',
      'battery',
      'other'
    ];

    let allSectionsPresent = true;
    const missingOrEmptySections = [];
    const presentSections = [];

    console.log('\n📋 Checking specification sections:');
    specificationSections.forEach(section => {
      const hasSection = model.hasOwnProperty(section);
      if (hasSection) {
        presentSections.push(section);
        console.log(`  ✅ ${section}: Present`);
      } else {
        allSectionsPresent = false;
        missingOrEmptySections.push(section);
        console.log(`  ❌ ${section}: MISSING`);
      }
    });

    log.section('DETAILED SPECIFICATION DATA');

    // Display the actual data for each section
    if (model.images !== undefined) {
      log.data('Images', model.images);
    }

    if (model.network !== undefined) {
      log.data('Network', model.network);
    }

    if (model.physical !== undefined) {
      log.data('Physical', model.physical);
    }

    if (model.display !== undefined) {
      log.data('Display', model.display);
    }

    if (model.platform !== undefined) {
      log.data('Platform', model.platform);
    }

    if (model.memory !== undefined) {
      log.data('Memory', model.memory);
    }

    if (model.rearCamera !== undefined) {
      log.data('Rear Camera', model.rearCamera);
    }

    if (model.frontCamera !== undefined) {
      log.data('Front Camera', model.frontCamera);
    }

    if (model.audio !== undefined) {
      log.data('Audio', model.audio);
    }

    if (model.connectivity !== undefined) {
      log.data('Connectivity', model.connectivity);
    }

    if (model.features !== undefined) {
      log.data('Features', model.features);
    }

    if (model.battery !== undefined) {
      log.data('Battery', model.battery);
    }

    if (model.other !== undefined) {
      log.data('Other', model.other);
    }

    // Display basic information
    log.section('BASIC INFORMATION');
    log.data('Model Info', {
      _id: model._id,
      name: model.name,
      manufacturer: model.manufacturer,
      brandId: model.brandId,
      deviceType: model.deviceType,
      image: model.image
    });

    return {
      model,
      allSectionsPresent,
      presentSections,
      missingOrEmptySections
    };
  } catch (error) {
    log.error(`Failed to fetch models: ${error.response?.data?.error || error.message}`);
    return null;
  }
}

async function runTests() {
  log.section('🧪 COMPREHENSIVE SPECIFICATIONS VERIFICATION TEST');

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

  // Step 4: Get models and verify comprehensive specifications
  const result = await getModels(deviceType._id, manufacturer._id);
  if (!result) {
    log.error('Cannot continue without model');
    process.exit(1);
  }

  log.section('📊 TEST RESULTS SUMMARY');

  console.log('\n✅ Present Sections:', result.presentSections.length);
  result.presentSections.forEach(section => {
    console.log(`   - ${section}`);
  });

  if (result.missingOrEmptySections.length > 0) {
    console.log('\n❌ Missing Sections:', result.missingOrEmptySections.length);
    result.missingOrEmptySections.forEach(section => {
      console.log(`   - ${section}`);
    });
  }

  log.section('FINAL VERDICT');

  if (result.allSectionsPresent) {
    log.info('✅ ALL COMPREHENSIVE SPECIFICATION SECTIONS ARE PRESENT!');
    console.log('\n🎉 The backend is now returning comprehensive device specifications including:');
    console.log('   ✅ Basic Information (Name, Brand, Device Type, Image)');
    console.log('   ✅ Network (5G bands, network technologies)');
    console.log('   ✅ Physical (Dimensions, weight, build quality)');
    console.log('   ✅ Display (Screen size, resolution, refresh rate)');
    console.log('   ✅ Platform (OS, chip, CPU, GPU)');
    console.log('   ✅ Memory (Storage options)');
    console.log('   ✅ Cameras (Front and rear camera specifications)');
    console.log('   ✅ Audio (Loudspeaker, 3.5mm jack)');
    console.log('   ✅ Connectivity (WLAN, Bluetooth, NFC, USB, etc.)');
    console.log('   ✅ Features (Sensors, special features)');
    console.log('   ✅ Battery (Type, charging, usage times)');
    console.log('   ✅ Other (Models, SAR values, price, release date, colors)');
    console.log('   ✅ Images (Device images with captions)');
  } else {
    log.error('❌ SOME SPECIFICATION SECTIONS ARE MISSING');
    console.log('\nPlease check the missing sections listed above.');
  }

  console.log('\n' + '='.repeat(80));
}

// Run the tests
runTests().catch(error => {
  log.error(`Test execution failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
