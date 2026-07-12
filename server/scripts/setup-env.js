#!/usr/bin/env node

/**
 * Environment Setup Script
 *
 * This script helps set up the environment for the McRepair.de application.
 * It checks for MongoDB connectivity and generates secure secrets.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function generateSecret() {
  return crypto.randomBytes(64).toString('hex');
}

async function checkMongoDBConnection(url) {
  log('\n🔍 Checking MongoDB connection...', 'cyan');

  const client = new MongoClient(url);

  try {
    await client.connect();
    await client.db().admin().ping();
    log('✅ MongoDB connection successful!', 'green');
    await client.close();
    return true;
  } catch (error) {
    log(`❌ MongoDB connection failed: ${error.message}`, 'red');
    return false;
  }
}

async function updateEnvFile(envPath, updates) {
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Parse existing env file
  const envVars = {};
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });

  // Apply updates
  Object.keys(updates).forEach(key => {
    envVars[key] = updates[key];
  });

  // Write back to file
  const lines = [];
  lines.push('# Server Configuration');
  lines.push(`PORT=${envVars.PORT || '3000'}`);
  lines.push(`NODE_ENV=${envVars.NODE_ENV || 'development'}`);
  lines.push('');
  lines.push('# Database Configuration');
  lines.push(`DATABASE_URL=${envVars.DATABASE_URL || 'mongodb://localhost:27017/fixithub'}`);
  lines.push('');
  lines.push('# JWT Configuration');
  lines.push(`JWT_SECRET=${envVars.JWT_SECRET}`);
  lines.push(`REFRESH_TOKEN_SECRET=${envVars.REFRESH_TOKEN_SECRET}`);
  lines.push('');
  lines.push('# Session Configuration');
  lines.push(`SESSION_SECRET=${envVars.SESSION_SECRET || envVars.JWT_SECRET}`);
  lines.push('');
  lines.push('# Application URLs');
  lines.push(`CLIENT_URL=${envVars.CLIENT_URL || 'http://localhost:5173'}`);
  lines.push(`SERVER_URL=${envVars.SERVER_URL || 'http://localhost:3000'}`);
  lines.push('');

  fs.writeFileSync(envPath, lines.join('\n'));
}

async function main() {
  log('='.repeat(60), 'cyan');
  log('   McRepair.de Environment Setup', 'cyan');
  log('='.repeat(60), 'cyan');

  const envPath = path.join(__dirname, '../../.env');

  // Check if .env file exists
  if (!fs.existsSync(envPath)) {
    log('\n⚠️  .env file not found. Creating new one...', 'yellow');
  } else {
    log('\n📄 Found existing .env file', 'blue');
  }

  // Load existing env or use defaults
  require('dotenv').config({ path: envPath });

  const updates = {};

  // Generate secrets if they don't exist or are default values
  const defaultSecrets = [
    'your-jwt-secret-change-this-in-production-to-a-long-random-string',
    'your-refresh-token-secret-change-this-in-production-to-a-long-random-string',
    'your-session-secret-change-this-in-production-to-a-long-random-string'
  ];

  if (!process.env.JWT_SECRET || defaultSecrets.includes(process.env.JWT_SECRET)) {
    log('\n🔐 Generating JWT_SECRET...', 'cyan');
    updates.JWT_SECRET = generateSecret();
    log('✅ JWT_SECRET generated', 'green');
  } else {
    updates.JWT_SECRET = process.env.JWT_SECRET;
  }

  if (!process.env.REFRESH_TOKEN_SECRET || defaultSecrets.includes(process.env.REFRESH_TOKEN_SECRET)) {
    log('🔐 Generating REFRESH_TOKEN_SECRET...', 'cyan');
    updates.REFRESH_TOKEN_SECRET = generateSecret();
    log('✅ REFRESH_TOKEN_SECRET generated', 'green');
  } else {
    updates.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
  }

  if (!process.env.SESSION_SECRET || defaultSecrets.includes(process.env.SESSION_SECRET)) {
    log('🔐 Generating SESSION_SECRET...', 'cyan');
    updates.SESSION_SECRET = generateSecret();
    log('✅ SESSION_SECRET generated', 'green');
  } else {
    updates.SESSION_SECRET = process.env.SESSION_SECRET;
  }

  // Preserve other settings
  updates.PORT = process.env.PORT || '3000';
  updates.NODE_ENV = process.env.NODE_ENV || 'development';
  updates.DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/fixithub';
  updates.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
  updates.SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

  // Update .env file
  await updateEnvFile(envPath, updates);
  log('\n✅ .env file updated successfully', 'green');

  // Test MongoDB connection
  const mongoConnected = await checkMongoDBConnection(updates.DATABASE_URL);

  if (!mongoConnected) {
    log('\n⚠️  MongoDB Connection Issues:', 'yellow');
    log('   Please ensure MongoDB is running:', 'yellow');
    log('   1. Local MongoDB: Start the MongoDB service', 'yellow');
    log('   2. MongoDB Atlas: Update DATABASE_URL in .env with your connection string', 'yellow');
    log('   3. Docker: Run: docker run -d -p 27017:27017 --name mongodb mongo:latest', 'yellow');
    log('\n   Current DATABASE_URL: ' + updates.DATABASE_URL, 'blue');
  }

  log('\n' + '='.repeat(60), 'cyan');
  log('✅ Setup complete!', 'green');
  log('='.repeat(60), 'cyan');

  if (!mongoConnected) {
    log('\n⚠️  Next steps:', 'yellow');
    log('   1. Set up MongoDB (see options above)', 'yellow');
    log('   2. Run: npm start', 'yellow');
    process.exit(1);
  } else {
    log('\n✅ You can now start the server with: npm start', 'green');
  }
}

// Run the script
main().catch(error => {
  log(`\n❌ Setup failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
