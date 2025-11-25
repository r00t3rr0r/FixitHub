# Database & API Management Scripts

This directory contains utility scripts for managing the FixitHub database and testing the API.

## Available Scripts

### 1. seed-admin.js
Creates an admin user in the database.

**Usage:**
```bash
node server/scripts/seed-admin.js
```

**What it does:**
- Checks if admin user already exists
- Creates admin user with credentials:
  - Email: admin@example.com
  - Password: admin123
  - Role: admin

**When to use:**
- Setting up a fresh database
- Creating an admin account for testing
- Recovering admin access

---

### 2. seed-sample-data.js
Creates sample data for testing and development.

**Usage:**
```bash
# Dry run (preview what will be created)
node server/scripts/seed-sample-data.js

# Actually create the data
node server/scripts/seed-sample-data.js --confirm
```

**What it does:**
- Creates test users (customer and staff)
- Creates sample devices (Apple iPhone 14 Pro)
- Creates sample services (Screen Replacement, Battery Replacement)
- Creates sample products (Phone Case)
- Creates sample orders

**Test Credentials:**
- Customer: customer@example.com / password123
- Staff: staff@example.com / password123

**When to use:**
- Setting up development environment
- Testing features with realistic data
- Demonstrating the application

---

### 3. cleanup-old-orders.js
Removes old completed orders from the database.

**Usage:**
```bash
# Preview orders that would be deleted (default: 90 days old, completed status)
node server/scripts/cleanup-old-orders.js

# Delete orders older than 90 days with completed status
node server/scripts/cleanup-old-orders.js --confirm

# Custom parameters
node server/scripts/cleanup-old-orders.js --days=180 --status=cancelled --confirm
```

**Parameters:**
- `--days=N` : Delete orders older than N days (default: 90)
- `--status=STATUS` : Filter by status (default: completed)
- `--confirm` : Actually perform the deletion (without this, it's a dry run)

**What it does:**
- Finds orders matching the criteria
- Shows a preview of what will be deleted
- Optionally deletes the orders
- Reports space saved

**When to use:**
- Regular database maintenance
- Removing test data
- Managing database size

---

### 4. check-db-health.js
Checks database health and displays statistics.

**Usage:**
```bash
node server/scripts/check-db-health.js
```

**What it does:**
- Verifies database connection
- Shows MongoDB server status and uptime
- Displays database statistics (size, collections, indexes)
- Lists top collections by document count
- Identifies potential issues:
  - Large collections without proper indexes
  - Collections with large document sizes
  - High connection pool utilization
- Provides recommendations

**When to use:**
- Periodic health checks
- Troubleshooting performance issues
- Planning for scaling
- Before and after major data operations

---

### 5. test-api.js
Tests API endpoints to verify functionality.

**Usage:**
```bash
# Test local API
node server/scripts/test-api.js

# Test remote API
node server/scripts/test-api.js --host=https://api.example.com
```

**What it tests:**
- Health check endpoint
- Authentication (login)
- User profile retrieval
- Orders endpoint
- Services endpoint
- Products endpoint
- Device brands endpoint
- Shopping cart endpoint
- Unauthorized access handling
- Invalid endpoint handling

**Exit codes:**
- 0: All tests passed
- 1: One or more tests failed

**When to use:**
- After deploying changes
- Verifying API functionality
- Automated testing in CI/CD
- Troubleshooting API issues

---

## Common Workflows

### Initial Setup
```bash
# 1. Seed admin user
node server/scripts/seed-admin.js

# 2. Create sample data for testing
node server/scripts/seed-sample-data.js --confirm

# 3. Check database health
node server/scripts/check-db-health.js

# 4. Test API
node server/scripts/test-api.js
```

### Regular Maintenance
```bash
# Check database health
node server/scripts/check-db-health.js

# Clean up old orders (preview first)
node server/scripts/cleanup-old-orders.js
node server/scripts/cleanup-old-orders.js --confirm

# Test API functionality
node server/scripts/test-api.js
```

### Development Testing
```bash
# Seed fresh test data
node server/scripts/seed-sample-data.js --confirm

# Test API endpoints
node server/scripts/test-api.js
```

---

## Safety Features

All scripts include safety features:

1. **Dry Run Mode**: Destructive operations require `--confirm` flag
2. **Connection Verification**: All scripts verify database connection before proceeding
3. **Error Handling**: Comprehensive error handling and reporting
4. **Graceful Shutdown**: Proper database connection cleanup

---

## Prerequisites

- Node.js installed
- MongoDB connection configured in `.env`
- Server dependencies installed (`npm install` in server directory)

---

## Troubleshooting

### "Cannot connect to database"
- Check MongoDB is running
- Verify `DATABASE_URL` in `.env` is correct
- Check network connectivity

### "Script hangs or doesn't complete"
- Press Ctrl+C to cancel
- Check MongoDB server status
- Look for error messages in console

### "Authentication failed"
- Verify MongoDB credentials in `.env`
- Check user permissions in MongoDB

---

## Notes

- **Production Use**: Always test scripts in a non-production environment first
- **Backups**: Create backups before running cleanup scripts
- **Passwords**: Change default passwords in production
- **Scheduling**: Consider using cron jobs for regular maintenance tasks
