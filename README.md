# FixitHub

FixitHub is a comprehensive device repair platform designed to streamline the repair process for customers, staff members, and administrators. It offers a user-friendly interface for ordering repairs, tracking progress, managing inventory, and handling all aspects of the repair business workflow. The app includes web shop functionality, shopping cart features, add-on service management, a knowledge base, business analytics, a content management system with blog capabilities, and SEO optimization tools.

## Overview

FixitHub is a full-stack application with both a frontend and a backend, organized as follows:

- **Frontend**: Developed using ReactJS and hosted in the `client/` directory. It utilizes Vite for development, the Shadcn UI component library, and Tailwind CSS for styling. The frontend handles routing through `react-router-dom` and makes API requests to endpoints prefixed with `/api/`.
- **Backend**: Implemented with Express.js hosted in the `server/` directory. It exposes REST API endpoints and uses MongoDB for database services via Mongoose. The backend handles user authentication and authorization using JWT tokens, with specific routes for login, registration, and more.

The two parts of the project—frontend and backend—run concurrently through a single command using the `concurrently` tool.

## Features

### User Roles & Access Levels

- **Customer**: 
  - Place and track repair orders
  - Access personal dashboard and order history
  - Communicate with staff
  - Browse and purchase from the web shop
  - Add special services to orders
  - Rate and review repair experiences
  - Read blog articles and browse content

- **Staff/Agent**:
  - Manage assigned repair orders
  - Update order statuses and communicate with customers
  - Track work hours and tasks
  - Manage knowledge base articles
  - Create and edit blog content
  - Manage add-on services

- **Admin**:
  - Comprehensive management capabilities
  - Manage users, inventory, services 
  - Access advanced reporting and analytics
  - Full control over web shop settings, and add-on services
  - Full content management and SEO optimization tools

## Getting started

### Requirements

Before setting up the project, ensure you have the following installed:

- Node.js (version 14.x or later)
- NPM (version 6.x or later)
- MongoDB (for the backend database)

### Quickstart

1. **Clone the repository**:
   ```sh
   git clone <repository_url>
   cd <repository_directory>
   ```

2. **Install dependencies**:
   ```sh
   npm install
   ```

3. **Setup environment variables**:
   Copy the `.env.example` file to `.env` in the root directory and update the values:
   ```sh
   cp .env.example .env
   ```

   Then edit `.env` and update the following key variables:
   ```sh
   # Database Configuration
   DATABASE_URL=mongodb://localhost:27017/FixitHub
   # Or with authentication:
   # DATABASE_URL=mongodb://username:password@localhost:27017/FixitHub?authSource=admin

   # JWT Configuration (auto-generated if you ran setup-env.js)
   JWT_SECRET=<Your JWT secret>
   REFRESH_TOKEN_SECRET=<Your refresh token secret>
   SESSION_SECRET=<Your session secret>
   ```

   **MongoDB Authentication:** If your MongoDB requires authentication, see [MONGODB_AUTH_SETUP.md](./MONGODB_AUTH_SETUP.md) for detailed instructions.

   Alternatively, run the automated setup script:
   ```sh
   cd server
   node scripts/setup-env.js
   ```

   For correct homepage link previews (Open Graph/Twitter/canonical), configure the frontend site URL:
   ```sh
   cp client/.env.example client/.env
   ```

   ```env
   VITE_SITE_URL=https://www.fixithub.com
   ```

4. **Start the project**:
   ```sh
   npm run start
   ```
   This command starts both the frontend and backend concurrently.

5. **Access the application**:
   - **Frontend**: Visit `http://localhost:5173`
   - **Backend**: The API server runs at `http://localhost:3000`

## Troubleshooting

### MongoDB Authentication Error

**Error:** `MongoServerError: command find requires authentication`

**Solution:** Your MongoDB instance requires authentication. See the detailed guide: [MONGODB_AUTH_SETUP.md](./MONGODB_AUTH_SETUP.md)

Quick fix:
```bash
# Run the interactive setup script
cd server
node scripts/setup-mongodb-auth.js
```

Or manually update your `.env` file:
```env
DATABASE_URL=mongodb://username:password@localhost:27017/FixitHub?authSource=admin
```

### Connection Refused Error

**Error:** `ECONNREFUSED`

**Solution:** MongoDB is not running. Start MongoDB:
```bash
# Linux/Ubuntu
sudo systemctl start mongod

# macOS
brew services start mongodb-community

# Windows
net start MongoDB
```

### Port Already in Use

**Error:** `Port 3000 is already in use`

**Solution:** Either kill the process using the port or change the PORT in `.env`:
```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or change the port in .env
PORT=3001
```

### Missing Dependencies

**Error:** `Cannot find module 'xyz'`

**Solution:** Reinstall dependencies:
```bash
npm install
cd client && npm install
cd ../server && npm install
```

## Development Scripts

### Database Management

```bash
# Seed database with test data
cd server
node scripts/seed-data.js

# Reset database (WARNING: Deletes all data)
node scripts/reset-database.js --confirm

# Verify admin user
node scripts/verify-admin.js

# Test login functionality
node scripts/test-login.js

# Setup MongoDB authentication
node scripts/setup-mongodb-auth.js
```

### Environment Setup

```bash
# Generate secure environment variables
cd server
node scripts/setup-env.js
```

## Test Accounts

After seeding the database, you can use these test accounts:

- **Admin**: admin@example.com / admin123
- **Staff**: staff@example.com / password123
- **Customer**: customer@example.com / password123

### License

The project is proprietary (not open source).  
© 2024. All rights reserved.
