#!/usr/bin/env node

/**
 * MongoDB Authentication Setup Script
 *
 * This script helps set up MongoDB authentication for the FixitHub application.
 * It provides multiple options for configuring MongoDB credentials.
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testConnection(connectionString) {
  try {
    console.log('\n🔍 Testing MongoDB connection...');
    const client = new MongoClient(connectionString);
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    console.log('✅ Connection successful!');
    await client.close();
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    return false;
  }
}

async function createMongoDBUser(adminConnectionString, username, password, database) {
  try {
    console.log('\n🔧 Creating MongoDB user...');
    const client = new MongoClient(adminConnectionString);
    await client.connect();

    const adminDb = client.db('admin');
    await adminDb.command({
      createUser: username,
      pwd: password,
      roles: [
        { role: 'readWrite', db: database },
        { role: 'dbAdmin', db: database }
      ]
    });

    console.log(`✅ User '${username}' created successfully with readWrite and dbAdmin roles on '${database}' database`);
    await client.close();
    return true;
  } catch (error) {
    if (error.codeName === 'DuplicateKey') {
      console.log(`⚠️  User '${username}' already exists`);
      return true;
    }
    console.error('❌ Failed to create user:', error.message);
    return false;
  }
}

async function updateEnvFile(databaseUrl) {
  const envPath = path.join(__dirname, '../../.env');

  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found');
    return false;
  }

  let envContent = fs.readFileSync(envPath, 'utf8');

  // Update DATABASE_URL
  envContent = envContent.replace(
    /DATABASE_URL=.*/,
    `DATABASE_URL=${databaseUrl}`
  );

  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file updated successfully');
  return true;
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   MongoDB Authentication Setup for FixitHub          ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  console.log('This script will help you configure MongoDB authentication.\n');
  console.log('Options:');
  console.log('1. Use existing MongoDB with authentication');
  console.log('2. Create a new MongoDB user for FixitHub');
  console.log('3. Use MongoDB without authentication (development only)');
  console.log('4. Exit\n');

  const choice = await question('Select an option (1-4): ');

  switch (choice.trim()) {
    case '1': {
      console.log('\n📝 Enter your MongoDB connection details:\n');
      const host = await question('MongoDB host (default: localhost): ') || 'localhost';
      const port = await question('MongoDB port (default: 27017): ') || '27017';
      const username = await question('MongoDB username: ');
      const password = await question('MongoDB password: ');
      const database = await question('Database name (default: FixitHub): ') || 'FixitHub';
      const authSource = await question('Auth source (default: admin): ') || 'admin';

      const connectionString = `mongodb://${username}:${password}@${host}:${port}/${database}?authSource=${authSource}`;

      const success = await testConnection(connectionString);
      if (success) {
        await updateEnvFile(connectionString);
        console.log('\n✅ MongoDB authentication configured successfully!');
        console.log('   You can now start your application.');
      } else {
        console.log('\n❌ Failed to configure MongoDB. Please check your credentials and try again.');
      }
      break;
    }

    case '2': {
      console.log('\n📝 Creating a new MongoDB user for FixitHub:\n');
      console.log('⚠️  Note: You need admin access to MongoDB to create users.\n');

      const host = await question('MongoDB host (default: localhost): ') || 'localhost';
      const port = await question('MongoDB port (default: 27017): ') || '27017';
      const adminUsername = await question('MongoDB admin username (default: admin): ') || 'admin';
      const adminPassword = await question('MongoDB admin password: ');

      const newUsername = await question('New username for FixitHub (default: fixithub): ') || 'fixithub';
      const newPassword = await question('New password for FixitHub: ');
      const database = await question('Database name (default: FixitHub): ') || 'FixitHub';

      const adminConnectionString = `mongodb://${adminUsername}:${adminPassword}@${host}:${port}/admin?authSource=admin`;

      const created = await createMongoDBUser(adminConnectionString, newUsername, newPassword, database);

      if (created) {
        const connectionString = `mongodb://${newUsername}:${newPassword}@${host}:${port}/${database}?authSource=admin`;
        const success = await testConnection(connectionString);

        if (success) {
          await updateEnvFile(connectionString);
          console.log('\n✅ MongoDB user created and configured successfully!');
          console.log('   You can now start your application.');
        }
      }
      break;
    }

    case '3': {
      console.log('\n⚠️  Using MongoDB without authentication (development only):\n');
      const host = await question('MongoDB host (default: localhost): ') || 'localhost';
      const port = await question('MongoDB port (default: 27017): ') || '27017';
      const database = await question('Database name (default: FixitHub): ') || 'FixitHub';

      const connectionString = `mongodb://${host}:${port}/${database}`;

      const success = await testConnection(connectionString);
      if (success) {
        await updateEnvFile(connectionString);
        console.log('\n✅ MongoDB configured without authentication.');
        console.log('   ⚠️  This is NOT recommended for production!');
      }
      break;
    }

    case '4':
      console.log('\nExiting...');
      break;

    default:
      console.log('\n❌ Invalid option selected.');
  }

  rl.close();
}

// Run the script
main().catch(error => {
  console.error('\n❌ An error occurred:', error.message);
  process.exit(1);
});
