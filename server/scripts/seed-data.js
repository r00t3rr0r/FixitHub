#!/usr/bin/env node

/**
 * Seed Data CLI
 *
 * Bootstraps the database with the focused seed set:
 *   system config + notification templates, admin user,
 *   languages, homepage template, workflows, blog, FAQs, SEO.
 *
 * Usage:
 *   node server/scripts/seed-data.js                # all
 *   node server/scripts/seed-data.js --type admin   # individual
 *
 * Valid --type values:
 *   all | admin | system | notification-templates |
 *   languages | homepage | workflows | blog | faqs | seo
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/FixitHub';
const SeedService = require('../services/seedService');

const tasks = {
  admin: () => SeedService.seedAdminUser(),
  system: () => SeedService.seedSystemConfiguration(),
  'notification-templates': () => SeedService.seedNotificationTemplates({ force: true }),
  languages: () => SeedService.seedLanguages(),
  homepage: () => SeedService.seedHomepageTemplate(),
  workflows: () => SeedService.seedWorkflows(),
  blog: () => SeedService.seedBlogData(),
  faqs: () => SeedService.seedFAQs(),
  seo: () => SeedService.seedSEOSettings(),
  all: () => SeedService.seedAll()
};

async function main() {
  const idx = process.argv.indexOf('--type');
  const type = idx >= 0 ? process.argv[idx + 1] : 'all';

  if (!tasks[type]) {
    console.error(`Invalid --type "${type}". Valid options: ${Object.keys(tasks).join(', ')}`);
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(DATABASE_URL);
  console.log('Connected.');

  try {
    console.log(`Running seed task: ${type}`);
    const result = await tasks[type]();
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
