#!/usr/bin/env node

/**
 * Comprehensive Brand Logo Usage Verification
 * 
 * Checks all locations where brand logos are used and ensures:
 * 1. APIs return local paths (not external URLs)
 * 2. Static files are served correctly
 * 3. Frontend components can access logos
 * 4. Database contains correct paths
 * 5. No fallback to external services needed
 */

const fetch = require('node-fetch');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/FixitHub';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const { DeviceBrand } = require('../models/Device');

let checksOk = 0;
let checksFailed = 0;

function logOk(msg) {
  console.log(`✓ ${msg}`);
  checksOk++;
}

function logFail(msg) {
  console.error(`✗ ${msg}`);
  checksFailed++;
}

async function test(name, fn) {
  try {
    await fn();
  } catch (error) {
    logFail(`${name}: ${error.message}`);
  }
}

async function main() {
  console.log('=== Brand Logo Usage Verification ===\n');

  // Test 1: API Brands Endpoint
  console.log('Test 1: API /api/devices/brands');
  await test('Fetch brands from API', async () => {
    const response = await fetch(`${SERVER_URL}/api/devices/brands`);
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    
    if (!data.brands || !Array.isArray(data.brands)) {
      throw new Error('Response missing brands array');
    }

    logOk(`API returned ${data.brands.length} brands`);

    // Check all brands use local paths
    let localPaths = 0;
    let invalidPaths = 0;
    
    for (const brand of data.brands) {
      if (!brand.logo) {
        logFail(`Brand ${brand.name} has no logo`);
        invalidPaths++;
        continue;
      }
      
      if (brand.logo.startsWith('/assets/brand-logos/')) {
        localPaths++;
      } else if (brand.logo.startsWith('https://') || brand.logo.startsWith('http://')) {
        logFail(`Brand ${brand.name} still uses external URL: ${brand.logo}`);
        invalidPaths++;
      }
    }

    if (localPaths === data.brands.length) {
      logOk(`All ${localPaths} brands use local logo paths`);
    } else {
      logFail(`Only ${localPaths}/${data.brands.length} brands use local paths`);
    }
  });

  // Test 2: Static File Serving
  console.log('\nTest 2: Static Logo File Serving');
  const testLogos = ['apple.png', 'samsung.png', 'google.png', 'sony.png', 'xiaomi.png'];
  
  for (const logo of testLogos) {
    await test(`Serve /assets/brand-logos/${logo}`, async () => {
      const response = await fetch(`${SERVER_URL}/assets/brand-logos/${logo}`);
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}`);
      }
      const contentType = response.headers.get('content-type');
      if (!contentType.includes('image/png')) {
        throw new Error(`Wrong content-type: ${contentType}`);
      }
      const size = parseInt(response.headers.get('content-length'));
      logOk(`${logo} (${size} bytes, ${contentType})`);
    });
  }

  // Test 3: Database Verification
  console.log('\nTest 3: Database Brand Logos');
  await test('Connect to database', async () => {
    await mongoose.connect(DATABASE_URL);
    logOk('Connected to MongoDB');
  });

  await test('Check database brands', async () => {
    const brands = await DeviceBrand.find({});
    logOk(`Found ${brands.length} brands in database`);

    let correctPaths = 0;
    let externalPaths = 0;
    let missingPaths = 0;
    
    for (const brand of brands) {
      if (!brand.logo) {
        missingPaths++;
        logFail(`${brand.name} has no logo in database`);
      } else if (brand.logo.startsWith('/assets/brand-logos/')) {
        correctPaths++;
      } else if (brand.logo.startsWith('https://') || brand.logo.startsWith('http://')) {
        externalPaths++;
        logFail(`${brand.name} uses external URL: ${brand.logo}`);
      }
    }

    if (correctPaths === brands.length) {
      logOk(`All ${correctPaths} database brands use local paths`);
    } else {
      logFail(`Expected ${brands.length} local paths, got ${correctPaths}`);
      if (externalPaths > 0) logFail(`${externalPaths} brands still use external URLs`);
      if (missingPaths > 0) logFail(`${missingPaths} brands missing logos`);
    }
  });

  // Test 4: Specific Brand Resolution
  console.log('\nTest 4: Specific Brand Resolution');
  
  const testBrands = [
    { name: 'Apple', expectedPath: '/assets/brand-logos/apple.png' },
    { name: 'Samsung', expectedPath: '/assets/brand-logos/samsung.png' },
    { name: 'HMD Global, Nokia', expectedPath: '/assets/brand-logos/hmd-global.png' },
  ];

  for (const testBrand of testBrands) {
    await test(`Resolve brand: ${testBrand.name}`, async () => {
      const brand = await DeviceBrand.findOne({ 
        name: new RegExp(`^${testBrand.name.split(',')[0].trim()}$`, 'i') 
      });
      
      if (!brand) {
        throw new Error(`Brand "${testBrand.name}" not found in database`);
      }

      if (brand.logo === testBrand.expectedPath) {
        logOk(`${testBrand.name}: ${brand.logo}`);
      } else {
        logFail(`${testBrand.name}: expected ${testBrand.expectedPath}, got ${brand.logo}`);
      }
    });
  }

  // Test 5: File Existence Check
  console.log('\nTest 5: Logo Files on Disk');
  const logosDir = path.join(__dirname, '../../public/assets/brand-logos');
  
  await test('Check logos directory', async () => {
    if (!fs.existsSync(logosDir)) {
      throw new Error(`Directory not found: ${logosDir}`);
    }
    const files = fs.readdirSync(logosDir);
    logOk(`Directory exists with ${files.length} files`);
  });

  // Test 6: Frontend Integration Points
  console.log('\nTest 6: Frontend Integration Check');
  
  const frontendFiles = [
    'client/src/components/home/McRepairNav.tsx',
    'client/src/pages/admin/DeviceManagement.tsx',
    'client/src/pages/admin/DeviceBrandsManagement.tsx',
  ];

  for (const file of frontendFiles) {
    await test(`Check ${file}`, async () => {
      const filePath = path.join(__dirname, '../../', file);
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
      }
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (content.includes('brand.logo')) {
        logOk(`${path.basename(file)} uses brand.logo property`);
      } else {
        throw new Error('File does not reference brand.logo');
      }
    });
  }

  // Cleanup
  await mongoose.disconnect();

  // Summary
  console.log(`\n=== Verification Summary ===`);
  console.log(`✓ Passed: ${checksOk}`);
  console.log(`✗ Failed: ${checksFailed}`);

  if (checksFailed === 0) {
    console.log('\n🎉 All checks passed! Brand logos are correctly integrated.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some checks failed. Review the issues above.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
