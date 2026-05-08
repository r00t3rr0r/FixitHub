#!/usr/bin/env node

/**
 * Update Device Brand Logos
 *
 * Sets the `logo` field on each DeviceBrand document to the
 * matching LOCAL logo path. Local logos are served from /assets/brand-logos/
 * with fallback to logo.dev if local file not available.
 *
 * Usage:
 *   node server/scripts/update-brand-logos.js
 *   node server/scripts/update-brand-logos.js --force   # overwrite existing non-empty logos too
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/FixitHub';
const { DeviceBrand } = require('../models/Device');
const { BRAND_LOGOS, getBrandLogoUrl } = require('../utils/brandLogos');

async function main() {
  const force = process.argv.includes('--force');
  console.log(`Connecting to MongoDB (${DATABASE_URL})...`);
  await mongoose.connect(DATABASE_URL);

  try {
    const brands = await DeviceBrand.find({});
    console.log(`Found ${brands.length} brand(s) in the database.`);

    let updated = 0;
    let skipped = 0;
    const unmatched = [];

    for (const brand of brands) {
      const url = getBrandLogoUrl(brand.name);

      if (!url) {
        unmatched.push(brand.name);
        continue;
      }

      const placeholderRegex = /placeholder\.com/i;
      const shouldUpdate =
        force || !brand.logo || placeholderRegex.test(brand.logo) || brand.logo === url;

      if (!shouldUpdate) {
        skipped++;
        continue;
      }

      if (brand.logo === url) {
        skipped++;
        continue;
      }

      brand.logo = url;
      await brand.save();
      console.log(`  ✓ ${brand.name} → ${url}`);
      updated++;
    }

    console.log(`\nUpdated: ${updated}, Skipped: ${skipped}`);
    if (unmatched.length) {
      console.log(`Unmatched brand names (no logo URL configured):`);
      unmatched.forEach((n) => console.log(`  - ${n}`));
    }
    console.log(`\nKnown brands in BRAND_LOGOS map: ${Object.keys(BRAND_LOGOS).length}`);
  } catch (error) {
    console.error('Failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
