# FixitHub Server Scripts

This directory contains useful Node.js scripts for database management and testing in development/staging environments.

## Available Scripts

### 1. Test Login (`test-login.js`)
Tests the login functionality to ensure authentication is working correctly.

**Purpose**: Verify that login endpoints are operational and can authenticate users with different roles.

**Usage**:
```bash
node server/scripts/test-login.js
```

**What it does**:
- ✅ Checks server health
- ✅ Tests admin login (admin@example.com / admin123)
- ✅ Tests customer login (if user exists)
- ✅ Tests staff login (if user exists)
- ✅ Displays pass/fail results for each test

**Output**:
```
==============================================================
🧪 FixitHub Login Test Suite
==============================================================
API URL: http://localhost:3000

🏥 Testing database health...
✅ Server health check passed

📝 Testing login for admin (admin@example.com)...
✅ Login successful for admin
   Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

==============================================================
📊 Test Summary
==============================================================
Server Health: ✅ Passed
Login Tests: 1/1 passed
==============================================================
✅ All tests passed!
==============================================================
```

---

### 2. Seed Data (`seed-data.js`)
Populates the database with initial data for development and testing.

**Purpose**: Quickly populate the database with test data including admin users, services, products, blog posts, FAQs, and more.

**Usage**:
```bash
# Seed all data
node server/scripts/seed-data.js

# Seed specific type
node server/scripts/seed-data.js --type admin
node server/scripts/seed-data.js --type users
node server/scripts/seed-data.js --type services
node server/scripts/seed-data.js --type devices
node server/scripts/seed-data.js --type products
node server/scripts/seed-data.js --type blog
node server/scripts/seed-data.js --type faq
node server/scripts/seed-data.js --type homepage
```

**Seed Types**:
| Type | Description |
|------|-------------|
| `all` | Seeds all data (admin, users, services, devices, products, blog, FAQ, homepage) |
| `admin` | Seeds admin user (admin@example.com / admin123) |
| `users` | Seeds test customer and staff users |
| `services` | Seeds repair services and add-on services |
| `devices` | Seeds device brands, types, and models |
| `products` | Seeds web shop products |
| `blog` | Seeds blog posts, categories, and tags |
| `faq` | Seeds frequently asked questions |
| `homepage` | Seeds homepage sections and templates |

**Output Example**:
```
🌱 Connecting to MongoDB...
✅ Connected to MongoDB

🌱 Starting database seeding (type: admin)...

📝 Seeding admin user...
SeedService.seedAdminUser: Starting admin user seeding...
SeedService.seedAdminUser: Admin user already exists, updating password...
SeedService.seedAdminUser: Admin password updated successfully

============================================================
📊 Seeding Results
============================================================
✅ Successfully seeded (1):
   • Admin user
============================================================
```

**Default Test Credentials** (after seeding):
- **Admin**: admin@example.com / admin123
- **Customer**: customer@example.com / password123
- **Staff**: staff@example.com / password123

---

### 3. Reset Database (`reset-database.js`)
Completely clears all data from the database.

**⚠️ WARNING**: This script will DELETE ALL DATA in your database!

**Purpose**: Clean slate for fresh development or testing. Useful when you want to start over with a clean database.

**Usage**:
```bash
# Preview what will be deleted (safe - no changes)
node server/scripts/reset-database.js

# Confirm and delete all data
node server/scripts/reset-database.js --confirm
```

**Output Example**:
```
🔄 Connecting to MongoDB...
✅ Connected to MongoDB

⚠️  WARNING: This will DELETE ALL DATA in the database!
📍 Database: mongodb://localhost:27017/FixitHub

💡 To confirm, run: node server/scripts/reset-database.js --confirm
```

After confirmation:
```
🗑️  Deleting all collections...
  ✅ Cleared: users
  ✅ Cleared: orders
  ✅ Cleared: services
  ✅ Cleared: products
  ... (all collections)

✅ Database reset complete!
💡 Run the server to re-seed initial data:
   npm run dev
```

---

## Common Workflows

### Fresh Start Development
```bash
# 1. Clear the database
node server/scripts/reset-database.js --confirm

# 2. Start the server (auto-seeds initial data)
npm run dev

# 3. Seed additional test data if needed
node server/scripts/seed-data.js --type products
```

### Testing Login
```bash
# 1. Start the server
npm run dev

# 2. In another terminal, test login
node server/scripts/test-login.js
```

### Setup Demo Database
```bash
# 1. Reset database
node server/scripts/reset-database.js --confirm

# 2. Seed all demo data
node server/scripts/seed-data.js --type all

# 3. Start server
npm run dev

# 4. Login with:
#    - Email: admin@example.com
#    - Password: admin123
```

### Quick Debug of Seeding
```bash
# Test individual seed operations
node server/scripts/seed-data.js --type admin
node server/scripts/seed-data.js --type services
node server/scripts/seed-data.js --type homepage
```

---

## Environment Configuration

These scripts use the MongoDB connection URL from your `.env` file:

```bash
DATABASE_URL=mongodb://localhost:27017/FixitHub
```

Make sure MongoDB is running before using any scripts:

```bash
# Start MongoDB (if using local installation)
mongod

# Or check if it's already running
mongo --eval "db.adminCommand('ping')"
```

---

## Troubleshooting

### Script hangs or times out
- Ensure MongoDB is running and accessible
- Check `DATABASE_URL` is correct in `.env`
- Verify network connectivity to MongoDB server

### "Cannot find module" error
- Make sure you're in the project root directory
- Install dependencies: `npm install`
- Check that the script path is correct

### Permission denied errors
- Ensure the script has execute permissions: `chmod +x server/scripts/*.js`
- Or run with node directly: `node server/scripts/script-name.js`

### Database already seeded messages
- These scripts detect existing data and skip re-seeding by default
- To force reseed, use `reset-database.js --confirm` first

---

## Adding New Scripts

When creating new utility scripts:

1. Place them in `server/scripts/` directory
2. Start with shebang: `#!/usr/bin/env node`
3. Add environment variable loading
4. Include clear console output
5. Exit with appropriate code (0 for success, 1 for failure)
6. Document usage in this README

Example template:
```javascript
#!/usr/bin/env node

/**
 * Script Description
 * Usage: node server/scripts/script-name.js [options]
 */

const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  try {
    console.log('Starting script...');
    // Your code here
    console.log('✅ Script completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
```

---

## Performance Notes

- **Seeding all data**: ~5-10 seconds (depending on network latency to MongoDB)
- **Reset database**: ~2-5 seconds
- **Login test**: ~1-2 seconds per test

---

## Security Notes

⚠️ **These scripts are for development/testing only**

- Do NOT run on production databases
- Do NOT expose these scripts to public access
- Do NOT use demo credentials in production
- Always verify `DATABASE_URL` before running reset scripts

---

## Support

For issues with these scripts:
1. Check the troubleshooting section above
2. Review server logs: `npm run dev`
3. Check MongoDB connectivity: `mongo --eval "db.adminCommand('ping')"`
4. Review the error message for clues

---

**Last Updated**: November 3, 2025
**Scripts Directory**: `/server/scripts/`
**Status**: ✅ Production Ready
