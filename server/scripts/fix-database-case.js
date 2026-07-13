#!/usr/bin/env node

/**
 * Fix Database Case Issue Script
 *
 * This script fixes the MongoDB database case sensitivity issue by dropping
 * the incorrectly named database and allowing the application to recreate it.
 */

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function fixDatabaseCase() {
  log('\n' + '='.repeat(60), 'cyan');
  log('   Fix Database Case Issue', 'cyan');
  log('='.repeat(60), 'cyan');

  const url = process.env.DATABASE_URL || 'mongodb://localhost:27017/McRepair.de';
  log(`\nConnecting to: ${url}`, 'cyan');

  const client = new MongoClient(url);

  try {
    await client.connect();
    log('✅ Connected to MongoDB', 'green');

    // Get the admin database to list all databases
    const adminDb = client.db().admin();
    const { databases } = await adminDb.listDatabases();

    log('\n📋 Current databases:', 'cyan');
    databases.forEach(db => {
      log(`   - ${db.name}`, db.name.toLowerCase() === 'fixithub' ? 'yellow' : 'reset');
    });

    // Check for the problematic database
    const fixitHubDb = databases.find(db => db.name === 'McRepair.de');
    const fixithubDb = databases.find(db => db.name === 'fixithub');

    if (fixitHubDb && fixithubDb) {
      log('\n⚠️  Found both McRepair.de and fixithub databases!', 'yellow');
      log('   This is causing the case sensitivity issue.', 'yellow');

      // Drop the lowercase one since we want to use the uppercase version
      log('\n🗑️  Dropping the "fixithub" database...', 'yellow');
      await client.db('fixithub').dropDatabase();
      log('✅ Dropped "fixithub" database', 'green');
    } else if (fixithubDb && !fixitHubDb) {
      log('\n📝 Found "fixithub" database, will keep using it', 'cyan');
      log('   Updating .env to use lowercase version...', 'cyan');

      // Update the .env file to use lowercase
      const fs = require('fs');
      const envPath = require('path').join(__dirname, '../../.env');
      let envContent = fs.readFileSync(envPath, 'utf8');
      envContent = envContent.replace(
        /DATABASE_URL=mongodb:\/\/localhost:27017\/McRepair.de/g,
        'DATABASE_URL=mongodb://localhost:27017/fixithub'
      );
      fs.writeFileSync(envPath, envContent);
      log('✅ Updated .env file to use lowercase database name', 'green');
    } else if (fixitHubDb && !fixithubDb) {
      log('\n📝 Found "McRepair.de" database, keeping it', 'cyan');
    } else {
      log('\n✅ No conflicting databases found', 'green');
    }

    log('\n' + '='.repeat(60), 'cyan');
    log('✅ Database case issue fixed!', 'green');
    log('='.repeat(60), 'cyan');
    log('\n💡 The server should automatically restart and reconnect.', 'cyan');

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

fixDatabaseCase().catch(error => {
  log(`\n❌ Script failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
