const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    console.log('Database: Attempting to connect to MongoDB...');
    console.log('Database: Connection string:', process.env.DATABASE_URL);
    
    const conn = await mongoose.connect(process.env.DATABASE_URL, {
      // These options are to handle deprecation warnings
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`Database: MongoDB Connected successfully to: ${conn.connection.host}`);
    console.log(`Database: Connected to database: ${conn.connection.name}`);
    console.log(`Database: Connection state: ${conn.connection.readyState}`);

    // Error handling after initial connection
    mongoose.connection.on('error', err => {
      console.error(`Database: MongoDB connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('Database: MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.info('Database: MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('Database: MongoDB connection closed through app termination');
        process.exit(0);
      } catch (err) {
        console.error('Database: Error during MongoDB shutdown:', err);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error(`Database: Error connecting to MongoDB: ${error.message}`);
    console.error('Database: Full error details:', error);
    process.exit(1);
  }
};

module.exports = {
  connectDB,
};