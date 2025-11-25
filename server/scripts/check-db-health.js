#!/usr/bin/env node

/**
 * Script to check database health and display statistics
 * Useful for monitoring database status and identifying issues
 *
 * Usage: node server/scripts/check-db-health.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, gracefulShutdown } = require('../config/database');

async function checkDatabaseHealth() {
  console.log('=== Database Health Check ===');

  try {
    // Connect to database
    console.log('\n1. Checking database connection...');
    await connectDB();
    console.log('   ✓ Database connection: OK');

    // Get database info
    const db = mongoose.connection.db;
    const admin = db.admin();

    // Server status
    console.log('\n2. Checking server status...');
    const serverStatus = await admin.serverStatus();
    console.log(`   ✓ MongoDB version: ${serverStatus.version}`);
    console.log(`   ✓ Uptime: ${Math.floor(serverStatus.uptime / 3600)} hours`);
    console.log(`   ✓ Connections: ${serverStatus.connections.current}/${serverStatus.connections.available}`);

    // Database statistics
    console.log('\n3. Checking database statistics...');
    const dbStats = await db.stats();
    console.log(`   ✓ Database: ${db.databaseName}`);
    console.log(`   ✓ Collections: ${dbStats.collections}`);
    console.log(`   ✓ Data Size: ${(dbStats.dataSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   ✓ Storage Size: ${(dbStats.storageSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   ✓ Indexes: ${dbStats.indexes}`);
    console.log(`   ✓ Index Size: ${(dbStats.indexSize / 1024 / 1024).toFixed(2)} MB`);

    // Collection statistics
    console.log('\n4. Checking collection statistics...');
    const collections = await db.listCollections().toArray();

    const collectionStats = [];
    for (const collection of collections) {
      try {
        const stats = await db.collection(collection.name).stats();
        collectionStats.push({
          name: collection.name,
          count: stats.count || 0,
          size: stats.size || 0,
          avgObjSize: stats.avgObjSize || 0,
          indexes: stats.nindexes || 0
        });
      } catch (error) {
        console.log(`   ⚠ Could not get stats for ${collection.name}`);
      }
    }

    // Sort by document count
    collectionStats.sort((a, b) => b.count - a.count);

    console.log('\n   Top collections by document count:');
    collectionStats.slice(0, 10).forEach((stat, index) => {
      console.log(`   ${index + 1}. ${stat.name}: ${stat.count} documents (${(stat.size / 1024).toFixed(2)} KB, ${stat.indexes} indexes)`);
    });

    // Check for issues
    console.log('\n5. Checking for potential issues...');
    let issuesFound = false;

    // Check for large collections without indexes
    const largeCollectionsNoIndexes = collectionStats.filter(c => c.count > 1000 && c.indexes <= 1);
    if (largeCollectionsNoIndexes.length > 0) {
      issuesFound = true;
      console.log('   ⚠ Large collections with minimal indexes:');
      largeCollectionsNoIndexes.forEach(c => {
        console.log(`     - ${c.name}: ${c.count} documents, ${c.indexes} index(es)`);
      });
    }

    // Check for very large average object size
    const largeAvgSize = collectionStats.filter(c => c.avgObjSize > 100000);
    if (largeAvgSize.length > 0) {
      issuesFound = true;
      console.log('   ⚠ Collections with large average document size:');
      largeAvgSize.forEach(c => {
        console.log(`     - ${c.name}: ${(c.avgObjSize / 1024).toFixed(2)} KB avg`);
      });
    }

    // Check connection pool
    if (serverStatus.connections.current / serverStatus.connections.available > 0.8) {
      issuesFound = true;
      console.log('   ⚠ Connection pool is over 80% utilized');
    }

    if (!issuesFound) {
      console.log('   ✓ No issues detected');
    }

    // Recommendations
    console.log('\n6. Recommendations:');
    const totalSize = dbStats.dataSize + dbStats.indexSize;
    if (totalSize > 1024 * 1024 * 1024) { // 1 GB
      console.log('   • Consider archiving old data (use cleanup-old-orders.js)');
    }

    if (collectionStats.some(c => c.count > 10000 && c.indexes <= 1)) {
      console.log('   • Add indexes to large collections for better query performance');
    }

    console.log('   • Run regular backups of your database');
    console.log('   • Monitor database size and plan for scaling');

    console.log('\n=== Health Check Complete ===');

  } catch (error) {
    console.error('\n✗ Error during health check:', error);
    throw error;
  } finally {
    await gracefulShutdown();
  }
}

// Run the script
if (require.main === module) {
  checkDatabaseHealth()
    .then(() => {
      console.log('\n✓ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = checkDatabaseHealth;
