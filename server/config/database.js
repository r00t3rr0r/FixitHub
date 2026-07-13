const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    console.log('Database URL:', process.env.DATABASE_URL.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')); // Hide password in logs

    // Build connection options
    const connectionOptions = {
      // Connection timeout
      serverSelectionTimeoutMS: 5000,
      // Socket timeout
      socketTimeoutMS: 45000,
    };

    // If separate credentials are provided, build auth options
    if (process.env.MONGODB_USERNAME && process.env.MONGODB_PASSWORD) {
      connectionOptions.auth = {
        username: process.env.MONGODB_USERNAME,
        password: process.env.MONGODB_PASSWORD
      };
      if (process.env.MONGODB_AUTH_SOURCE) {
        connectionOptions.authSource = process.env.MONGODB_AUTH_SOURCE;
      }
      console.log('Using separate MongoDB authentication credentials');
    }

    const conn = await mongoose.connect(process.env.DATABASE_URL, connectionOptions);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);

    // Connection event handlers
    mongoose.connection.on('connected', () => {
      console.log('Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      console.error('Mongoose connection error:', err);

      // Provide specific guidance for authentication errors
      if (err.message && err.message.includes('authentication')) {
        console.error('💡 Authentication Error: MongoDB requires valid credentials');
        console.error('   Solutions:');
        console.error('   1. Add credentials to DATABASE_URL: mongodb://username:password@host:port/database?authSource=admin');
        console.error('   2. Or set MONGODB_USERNAME, MONGODB_PASSWORD, and MONGODB_AUTH_SOURCE environment variables');
        console.error('   3. Or disable authentication in MongoDB for development');
      }
    });

    mongoose.connection.on('disconnected', () => {
      console.log('Mongoose disconnected from MongoDB');
    });

    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('Stack trace:', error.stack);

    // Check for common connection issues
    if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Suggestion: Make sure MongoDB is running on your system');
      console.error('   - Start MongoDB service');
      console.error('   - Or use MongoDB Atlas cloud database');
    }

    if (error.message.includes('authentication') || error.message.includes('requires authentication')) {
      console.error('💡 Authentication Error: MongoDB requires valid credentials');
      console.error('   Current DATABASE_URL does not include valid authentication');
      console.error('   Solutions:');
      console.error('   1. Update DATABASE_URL with credentials: mongodb://username:password@host:port/database?authSource=admin');
      console.error('   2. Set MONGODB_USERNAME, MONGODB_PASSWORD, and MONGODB_AUTH_SOURCE environment variables');
      console.error('   3. Disable authentication in MongoDB for development');
      console.error('   4. Create a MongoDB user with proper permissions:');
      console.error('      mongosh admin --eval "db.createUser({user: \'fixithub\', pwd: \'yourpassword\', roles: [{role: \'readWrite\', db: \'McRepair.de\'}]})"');
    }

    if (error.message.includes('ETIMEDOUT') || error.message.includes('timed out')) {
      console.error('💡 Suggestion: Connection timed out');
      console.error('   - Check if MongoDB is accessible at the specified host and port');
      console.error('   - Check firewall settings');
      console.error('   - For cloud databases, check network access settings');
    }

    throw error;
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  try {
    console.log('Closing MongoDB connection...');
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
  }
};

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await gracefulShutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await gracefulShutdown();
  process.exit(0);
});

module.exports = { connectDB, gracefulShutdown };