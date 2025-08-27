// Load environment variables
require("dotenv").config();

// Add startup logging
console.log('=== FixitHub Server Starting ===');
console.log('Environment variables check:');
console.log('- PORT:', process.env.PORT || 3000);
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Missing');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Missing');
console.log('- REFRESH_TOKEN_SECRET:', process.env.REFRESH_TOKEN_SECRET ? 'Set' : 'Missing');

const mongoose = require("mongoose");
const express = require("express");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const basicRoutes = require("./routes/index");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const addOnServiceRoutes = require("./routes/addOnServiceRoutes");
const adminRoutes = require("./routes/adminRoutes");
const orderRoutes = require("./routes/orderRoutes");
const adminOrderRoutes = require("./routes/adminOrderRoutes");
const messageRoutes = require("./routes/messageRoutes");
const seedRoutes = require("./routes/seedRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const { connectDB } = require("./config/database");
const SeedService = require("./services/seedService");
const cors = require("cors");
const path = require("path");

if (!process.env.DATABASE_URL) {
  console.error("Error: DATABASE_URL variables in .env missing.");
  process.exit(-1);
}

console.log('Creating Express app...');
const app = express();
const port = process.env.PORT || 3000;

// Pretty-print JSON responses
app.enable('json spaces');
// We want to be consistent with URL paths, so we enable strict routing
app.enable('strict routing');

console.log('Setting up middleware...');
app.use(cors({}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Request headers:', req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request body:', req.body);
  }
  next();
});

// Database connection and auto-seeding
const initializeDatabase = async () => {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Database connected successfully');

    // Auto-seed admin user if it doesn't exist
    console.log('Checking if admin user exists...');
    try {
      const seedResult = await SeedService.seedAdmin();
      console.log('Admin seeding result:', seedResult.message);
    } catch (error) {
      console.error('Error seeding admin user:', error.message);
    }

    // Auto-seed services if they don't exist
    console.log('Checking if services exist...');
    try {
      const servicesSeedResult = await SeedService.seedServices();
      console.log('Services seeding result:', servicesSeedResult.message);
    } catch (error) {
      console.error('Error seeding services:', error.message);
    }

    // Auto-seed add-on services if they don't exist
    console.log('Checking if add-on services exist...');
    try {
      const addOnsSeedResult = await SeedService.seedAddOnServices();
      console.log('Add-on services seeding result:', addOnsSeedResult.message);
    } catch (error) {
      console.error('Error seeding add-on services:', error.message);
    }

    // Auto-seed inventory if it doesn't exist
    console.log('Checking if inventory exists...');
    try {
      const inventorySeedResult = await SeedService.seedInventory();
      console.log('Inventory seeding result:', inventorySeedResult.message);
    } catch (error) {
      console.error('Error seeding inventory:', error.message);
    }

    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('Initializing database...');
initializeDatabase();

app.on("error", (error) => {
  console.error(`Server error: ${error.message}`);
  console.error(error.stack);
});

console.log('Setting up routes...');
// Basic Routes
app.use(basicRoutes);
// Authentication Routes
app.use('/api/auth', authRoutes);
// User Routes
app.use('/api/users', userRoutes);
// Service Routes
app.use('/api/services', serviceRoutes);
// Add-on Service Routes
app.use('/api/addons', addOnServiceRoutes);
// Admin Routes
app.use('/api/admin', adminRoutes);
// Order Routes
app.use('/api/orders', orderRoutes);
// Admin Order Routes
app.use('/api/admin/orders', adminOrderRoutes);
// Message Routes
app.use('/api/messages', messageRoutes);
// Inventory Routes
app.use('/api/inventory', inventoryRoutes);
// Seed Routes
app.use('/api/seed', seedRoutes);

console.log('Routes configured successfully');

// If no routes handled the request, it's a 404
app.use((req, res, next) => {
  console.log(`404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).send("Page not found.");
});

// Error handling
app.use((err, req, res, next) => {
  console.error(`Unhandled application error: ${err.message}`);
  console.error(err.stack);
  res.status(500).send("There was an error serving your request.");
});

console.log(`Attempting to start server on port ${port}...`);
app.listen(port, (error) => {
  if (error) {
    console.error('Failed to start server:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
  console.log(`✅ Server running successfully at http://localhost:${port}`);
  console.log('=== FixitHub Server Ready ===');
});