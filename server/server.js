// Load environment variables
require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const basicRoutes = require("./routes/index");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const adminRoutes = require("./routes/adminRoutes");
const seedRoutes = require("./routes/seedRoutes");
const { connectDB } = require("./config/database");
const SeedService = require("./services/seedService");
const cors = require("cors");

if (!process.env.DATABASE_URL) {
  console.error("Error: DATABASE_URL variables in .env missing.");
  process.exit(-1);
}

const app = express();
const port = process.env.PORT || 3000;
// Pretty-print JSON responses
app.enable('json spaces');
// We want to be consistent with URL paths, so we enable strict routing
app.enable('strict routing');

app.use(cors({}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  }
};

initializeDatabase();

app.on("error", (error) => {
  console.error(`Server error: ${error.message}`);
  console.error(error.stack);
});

// Basic Routes
app.use(basicRoutes);
// Authentication Routes
app.use('/api/auth', authRoutes);
// User Routes
app.use('/api/users', userRoutes);
// Service Routes
app.use('/api/services', serviceRoutes);
// Admin Routes
app.use('/api/admin', adminRoutes);
// Seed Routes
app.use('/api/seed', seedRoutes);

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

app.listen(port, () => {
  console.log(`Server running at http://localhost:3000`);
});