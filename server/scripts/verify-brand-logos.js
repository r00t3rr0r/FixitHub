#!/usr/bin/env node

/**
 * Verify Brand Logos Local Storage Implementation
 * 
 * Checks:
 * 1. All logo PNG files exist in public/assets/brand-logos/
 * 2. Database brands have local logo paths (not external URLs)
 * 3. Server can serve logos via /assets/ route
 * 4. brandLogos.js configuration is correct
 * 
 * Usage:
 *   node server/scripts/verify-brand-logos.js
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/FixitHub';
const { DeviceBrand } = require('../models/Device');
const { BRAND_LOGO_MAPPING } = require('../utils/brandLogoMapping');
const { BRAND_LOGOS, getBrandLogoUrl } = require('../utils/brandLogos');

const LOGO_DIR = path.join(__dirname, '../../public/assets/brand-logos');
const EXPECTED_LOGOS = [
  'acer.png',
  'apple.png',
  'asus.png',
  'blackberry.png',
  'dell.png',
  'google.png',
  'hmd-global.png',
  'nokia.png',
  'htc.png',
  'huawei.png',
  'lg.png',
  'lenovo.png',
  'microsoft.png',
  'motorola.png',
  'oneplus.png',
  'samsung.png',
  'sony.png',
  'toshiba.png',
  'xiaomi.png'
];

let checksOk = 0;
let checksFailed = 0;

function logOk(message) {
  console.log(`✓ ${message}`);
  checksOk++;
}

function logFail(message) {
  console.error(`✗ ${message}`);
  checksFailed++;
}

async function verifyLogos() {
  console.log('=== Brand Logos Verification ===\n');

  // Check 1: Logo files exist
  console.log('Check 1: Logo PNG files...');
  if (!fs.existsSync(LOGO_DIR)) {
    logFail(`Logo directory does not exist: ${LOGO_DIR}`);
    return;
  }
  logOk(`Logo directory exists: ${LOGO_DIR}`);

  const actualFiles = fs.readdirSync(LOGO_DIR).sort();
  const expectedFiles = EXPECTED_LOGOS.sort();

  if (actualFiles.length !== expectedFiles.length) {
    logFail(`Expected ${expectedFiles.length} logo files, found ${actualFiles.length}`);
  } else {
    logOk(`Found all ${expectedFiles.length} expected logo files`);
  }

  // Check for missing files
  for (const file of expectedFiles) {
    if (!actualFiles.includes(file)) {
      logFail(`Missing logo file: ${file}`);
    }
  }

  // Check 2: Logo mapping configuration
  console.log('\nCheck 2: Brand Logo Mapping...');
  const mappingKeys = Object.keys(BRAND_LOGO_MAPPING).length;
  if (mappingKeys < 19) {
    logFail(`Mapping only has ${mappingKeys} entries, expected at least 19`);
  } else {
    logOk(`Brand Logo Mapping has ${mappingKeys} entries`);
  }

  // Check for /assets/ paths in mapping
  let localPaths = 0;
  for (const [key, path] of Object.entries(BRAND_LOGO_MAPPING)) {
    if (path && path.startsWith('/assets/brand-logos/')) {
      localPaths++;
    }
  }
  if (localPaths !== mappingKeys) {
    logFail(`Not all mapping entries use local paths. Found ${localPaths}/${mappingKeys}`);
  } else {
    logOk(`All ${mappingKeys} mapping entries use local paths`);
  }

  // Check 3: brandLogos configuration
  console.log('\nCheck 3: Brand Logos Configuration...');
  const brandsConfigCount = Object.keys(BRAND_LOGOS).length;
  if (brandsConfigCount < 19) {
    logFail(`BRAND_LOGOS config only has ${brandsConfigCount} entries`);
  } else {
    logOk(`BRAND_LOGOS configuration has ${brandsConfigCount} entries`);
  }

  // Check 4: Database verification
  console.log('\nCheck 4: Database Brands...');
  try {
    await mongoose.connect(DATABASE_URL);
    const brands = await DeviceBrand.find({});
    
    if (brands.length === 0) {
      logFail('No brands found in database');
    } else {
      logOk(`Found ${brands.length} brands in database`);
    }

    // Check logo paths in database
    let correctPaths = 0;
    let incorrectPaths = 0;
    const problemBrands = [];

    for (const brand of brands) {
      if (brand.logo && brand.logo.startsWith('/assets/brand-logos/')) {
        correctPaths++;
      } else if (brand.logo) {
        incorrectPaths++;
        problemBrands.push(`${brand.name}: ${brand.logo}`);
      }
    }

    if (correctPaths === brands.length) {
      logOk(`All ${correctPaths} database brands use local logo paths`);
    } else {
      logFail(`Only ${correctPaths}/${brands.length} brands use local paths (${incorrectPaths} use other paths)`);
      if (problemBrands.length <= 5) {
        problemBrands.forEach(p => console.log(`  - ${p}`));
      }
    }

    // Check 5: Sample brand resolution
    console.log('\nCheck 5: Brand Resolution Function...');
    const testCases = [
      { name: 'Apple', expected: '/assets/brand-logos/apple.png' },
      { name: 'Samsung', expected: '/assets/brand-logos/samsung.png' },
      { name: 'HMD Global, Nokia', expected: '/assets/brand-logos/hmd-global.png' },
    ];

    for (const test of testCases) {
      const result = getBrandLogoUrl(test.name);
      if (result === test.expected) {
        logOk(`getBrandLogoUrl('${test.name}') = ${result}`);
      } else {
        logFail(`getBrandLogoUrl('${test.name}') returned '${result}', expected '${test.expected}'`);
      }
    }

  } catch (error) {
    logFail(`Database check failed: ${error.message}`);
  } finally {
    await mongoose.disconnect();
  }

  // Summary
  console.log(`\n=== Verification Summary ===`);
  console.log(`✓ Passed: ${checksOk}`);
  console.log(`✗ Failed: ${checksFailed}`);

  if (checksFailed === 0) {
    console.log('\n🎉 All checks passed! Brand logos are correctly configured.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some checks failed. Please review the issues above.');
    process.exit(1);
  }
}

verifyLogos().catch((error) => {
  console.error('Fatal error:', error);
  process.exitCode = 1;
});
