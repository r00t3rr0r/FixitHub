const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    console.log('Database URL:', process.env.DATABASE_URL);
    
    const conn = await mongoose.connect(process.env.DATABASE_URL);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);
    
    // Connection event handlers
    mongoose.connection.on('connected', () => {
      console.log('Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      console.error('Mongoose connection error:', err);
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
    
    if (error.message.includes('authentication failed')) {
      console.error('💡 Suggestion: Check your MongoDB credentials');
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