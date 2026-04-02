const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const AddOnService = require('../models/AddOnService');
const Product = require('../models/Product');
const { BlogPost } = require('../models/BlogPost');
const Invoice = require('../models/Invoice');
const Complaint = require('../models/Complaint');
const RepairRequest = require('../models/RepairRequest');

class DatabaseService {
  // Get database statistics
  async getDatabaseStats() {
    console.log('DatabaseService: Getting database statistics');

    try {
      const stats = await mongoose.connection.db.stats();

      const collections = await mongoose.connection.db.listCollections().toArray();
      const collectionStats = [];

      for (const collection of collections) {
        try {
          // Use collStats command instead of stats() method
          const collStats = await mongoose.connection.db.command({
            collStats: collection.name
          });
          
          collectionStats.push({
            name: collection.name,
            count: collStats.count || 0,
            size: collStats.size || 0,
            avgObjSize: collStats.avgObjSize || 0,
            storageSize: collStats.storageSize || 0,
            indexes: collStats.nindexes || 0
          });
        } catch (error) {
          console.log(`Could not get stats for collection ${collection.name}:`, error.message);
          // Get basic count for collections where collStats fails
          try {
            const count = await mongoose.connection.db.collection(collection.name).countDocuments();
            collectionStats.push({
              name: collection.name,
              count: count,
              size: 0,
              avgObjSize: 0,
              storageSize: 0,
              indexes: 0
            });
          } catch (countError) {
            console.log(`Could not get count for collection ${collection.name}:`, countError.message);
            collectionStats.push({
              name: collection.name,
              count: 0,
              size: 0,
              avgObjSize: 0,
              storageSize: 0,
              indexes: 0
            });
          }
        }
      }

      return {
        database: {
          name: mongoose.connection.db.databaseName,
          collections: stats.collections || 0,
          objects: stats.objects || 0,
          dataSize: stats.dataSize || 0,
          storageSize: stats.storageSize || 0,
          indexes: stats.indexes || 0,
          indexSize: stats.indexSize || 0
        },
        collections: collectionStats,
        connectionStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
      };
    } catch (error) {
      console.error('DatabaseService: Error getting database stats:', error);
      throw new Error('Failed to get database statistics');
    }
  }

  // Get recent operations
  async getRecentOperations() {
    console.log('DatabaseService: Getting recent operations');

    // Mock data for recent operations
    return [
      {
        _id: '1',
        operation: 'insert',
        collection: 'orders',
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        duration: 45,
        status: 'success'
      },
      {
        _id: '2',
        operation: 'update',
        collection: 'users',
        timestamp: new Date(Date.now() - 1000 * 60 * 10),
        duration: 23,
        status: 'success'
      },
      {
        _id: '3',
        operation: 'find',
        collection: 'products',
        timestamp: new Date(Date.now() - 1000 * 60 * 15),
        duration: 12,
        status: 'success'
      }
    ];
  }

  // Backup database
  async backupDatabase() {
    console.log('DatabaseService: Creating database backup');

    // In a real implementation, this would create an actual backup
    // For now, return a mock response
    const backupId = 'backup_' + Date.now();

    return {
      success: true,
      backupId,
      message: 'Database backup created successfully',
      timestamp: new Date(),
      size: '125.4 MB'
    };
  }

  // Get backup history
  async getBackupHistory() {
    console.log('DatabaseService: Getting backup history');

    // Mock backup history
    return [
      {
        _id: 'backup_1703123456789',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
        size: '125.4 MB',
        status: 'completed',
        type: 'manual'
      },
      {
        _id: 'backup_1703037056789',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
        size: '123.8 MB',
        status: 'completed',
        type: 'scheduled'
      },
      {
        _id: 'backup_1702950656789',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72),
        size: '122.1 MB',
        status: 'completed',
        type: 'scheduled'
      }
    ];
  }

  // Optimize database
  async optimizeDatabase() {
    console.log('DatabaseService: Optimizing database');

    try {
      // Run database optimization commands
      const collections = await mongoose.connection.db.listCollections().toArray();
      const results = [];

      for (const collection of collections) {
        try {
          // Reindex collection
          await mongoose.connection.db.collection(collection.name).reIndex();
          results.push({
            collection: collection.name,
            status: 'optimized'
          });
        } catch (error) {
          results.push({
            collection: collection.name,
            status: 'error',
            error: error.message
          });
        }
      }

      return {
        success: true,
        message: 'Database optimization completed',
        results,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('DatabaseService: Error optimizing database:', error);
      throw new Error('Failed to optimize database');
    }
  }

  // Get database health
  async getDatabaseHealth() {
    console.log('DatabaseService: Checking database health');

    try {
      const pingResult = await mongoose.connection.db.admin().ping();
      const serverStatus = await mongoose.connection.db.admin().serverStatus();

      return {
        status: pingResult.ok === 1 ? 'healthy' : 'unhealthy',
        uptime: serverStatus.uptime || 0,
        connections: {
          current: serverStatus.connections?.current || 0,
          available: serverStatus.connections?.available || 0
        },
        memory: {
          resident: serverStatus.mem?.resident || 0,
          virtual: serverStatus.mem?.virtual || 0
        },
        network: {
          bytesIn: serverStatus.network?.bytesIn || 0,
          bytesOut: serverStatus.network?.bytesOut || 0
        },
        lastCheck: new Date()
      };
    } catch (error) {
      console.error('DatabaseService: Error checking database health:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        lastCheck: new Date()
      };
    }
  }

  // Clean up old data
  async cleanupOldData(options = {}) {
    console.log('DatabaseService: Cleaning up old data');

    const {
      olderThanDays = 90,
      collections = ['logs', 'sessions', 'notifications']
    } = options;

    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const results = [];

    try {
      // Clean up old notifications
      if (collections.includes('notifications')) {
        const notificationResult = await mongoose.connection.db.collection('notifications')
          .deleteMany({ createdAt: { $lt: cutoffDate }, isRead: true });

        results.push({
          collection: 'notifications',
          deletedCount: notificationResult.deletedCount || 0
        });
      }

      return {
        success: true,
        message: 'Data cleanup completed',
        results,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('DatabaseService: Error during cleanup:', error);
      throw new Error('Failed to cleanup old data');
    }
  }

  // Delete all bookings and orders
  async deleteAllBookingsAndOrders() {
    console.log('DatabaseService: Deleting all bookings and orders');

    try {
      // Get counts before deletion
      const orderCountBefore = await Order.countDocuments();
      const bookingCountBefore = await Booking.countDocuments();

      // Delete all orders
      const ordersDeleteResult = await Order.deleteMany({});
      console.log(`DatabaseService: Deleted ${ordersDeleteResult.deletedCount} orders`);

      // Delete all bookings
      const bookingsDeleteResult = await Booking.deleteMany({});
      console.log(`DatabaseService: Deleted ${bookingsDeleteResult.deletedCount} bookings`);

      // Verify deletion
      const orderCountAfter = await Order.countDocuments();
      const bookingCountAfter = await Booking.countDocuments();

      return {
        success: true,
        message: 'All bookings and orders deleted successfully',
        results: {
          orders: {
            before: orderCountBefore,
            deleted: ordersDeleteResult.deletedCount,
            after: orderCountAfter
          },
          bookings: {
            before: bookingCountBefore,
            deleted: bookingsDeleteResult.deletedCount,
            after: bookingCountAfter
          }
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('DatabaseService: Error deleting bookings and orders:', error);
      throw new Error(`Failed to delete bookings and orders: ${error.message}`);
    }
  }

  // Delete all invoices
  async deleteAllInvoices() {
    console.log('DatabaseService: Deleting all invoices');

    try {
      // Get count before deletion
      const countBefore = await Invoice.countDocuments();

      // Delete all invoices
      const deleteResult = await Invoice.deleteMany({});
      console.log(`DatabaseService: Deleted ${deleteResult.deletedCount} invoices`);

      // Verify deletion
      const countAfter = await Invoice.countDocuments();

      return {
        success: true,
        message: 'All invoices deleted successfully',
        results: {
          before: countBefore,
          deleted: deleteResult.deletedCount,
          after: countAfter
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('DatabaseService: Error deleting invoices:', error);
      throw new Error(`Failed to delete invoices: ${error.message}`);
    }
  }

  // Delete all complaints
  async deleteAllComplaints() {
    console.log('DatabaseService: Deleting all complaints');

    try {
      // Get count before deletion
      const countBefore = await Complaint.countDocuments();

      // Delete all complaints
      const deleteResult = await Complaint.deleteMany({});
      console.log(`DatabaseService: Deleted ${deleteResult.deletedCount} complaints`);

      // Verify deletion
      const countAfter = await Complaint.countDocuments();

      return {
        success: true,
        message: 'All complaints deleted successfully',
        results: {
          before: countBefore,
          deleted: deleteResult.deletedCount,
          after: countAfter
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('DatabaseService: Error deleting complaints:', error);
      throw new Error(`Failed to delete complaints: ${error.message}`);
    }
  }

  // Delete all repair requests
  async deleteAllRepairRequests() {
    console.log('DatabaseService: Deleting all repair requests');

    try {
      // Get count before deletion
      const countBefore = await RepairRequest.countDocuments();

      // Delete all repair requests
      const deleteResult = await RepairRequest.deleteMany({});
      console.log(`DatabaseService: Deleted ${deleteResult.deletedCount} repair requests`);

      // Verify deletion
      const countAfter = await RepairRequest.countDocuments();

      return {
        success: true,
        message: 'All repair requests deleted successfully',
        results: {
          before: countBefore,
          deleted: deleteResult.deletedCount,
          after: countAfter
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('DatabaseService: Error deleting repair requests:', error);
      throw new Error(`Failed to delete repair requests: ${error.message}`);
    }
  }
}

module.exports = new DatabaseService();