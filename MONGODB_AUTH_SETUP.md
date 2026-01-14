# MongoDB Authentication Setup Guide

## Problem: "command find requires authentication" Error

If you're seeing the error message:
```
Error: Database error while getting the user by their email: MongoServerError: command find requires authentication
```

This means your MongoDB instance requires authentication, but your application doesn't have valid credentials configured.

## Quick Solutions

### Solution 1: Add Credentials to Your Connection String (Recommended)

Update your `.env` file's `DATABASE_URL` to include your MongoDB username and password:

```env
DATABASE_URL=mongodb://username:password@host:port/FixitHub?authSource=admin
```

**Example:**
```env
DATABASE_URL=mongodb://fixithub:mypassword123@localhost:27017/FixitHub?authSource=admin
```

### Solution 2: Use the Setup Script

We've provided an interactive script to help you configure MongoDB authentication:

```bash
cd server
node scripts/setup-mongodb-auth.js
```

The script will guide you through:
- Testing your MongoDB connection
- Creating a new MongoDB user
- Updating your `.env` file automatically

### Solution 3: Create MongoDB User Manually

If you have admin access to MongoDB, you can create a user manually:

#### Step 1: Connect to MongoDB as admin

```bash
mongosh admin
```

#### Step 2: Create a user for FixitHub

```javascript
db.createUser({
  user: "fixithub",
  pwd: "yourSecurePassword",
  roles: [
    { role: "readWrite", db: "FixitHub" },
    { role: "dbAdmin", db: "FixitHub" }
  ]
})
```

#### Step 3: Update your `.env` file

```env
DATABASE_URL=mongodb://fixithub:yourSecurePassword@localhost:27017/FixitHub?authSource=admin
```

### Solution 4: Disable Authentication (Development Only)

**⚠️ WARNING: Only use this for local development!**

If you're running MongoDB locally for development and want to disable authentication:

#### Step 1: Stop MongoDB

```bash
sudo systemctl stop mongod
# or
brew services stop mongodb-community
```

#### Step 2: Edit MongoDB configuration

Edit your MongoDB config file (`/etc/mongod.conf` or `/usr/local/etc/mongod.conf`):

```yaml
# Comment out or remove the security section
# security:
#   authorization: "enabled"
```

#### Step 3: Restart MongoDB

```bash
sudo systemctl start mongod
# or
brew services start mongodb-community
```

#### Step 4: Update your `.env` file

```env
DATABASE_URL=mongodb://localhost:27017/FixitHub
```

## Environment Variable Options

### Option 1: Include credentials in DATABASE_URL

```env
DATABASE_URL=mongodb://username:password@host:port/database?authSource=admin
```

### Option 2: Use separate environment variables

```env
DATABASE_URL=mongodb://localhost:27017/FixitHub
MONGODB_USERNAME=fixithub
MONGODB_PASSWORD=yourSecurePassword
MONGODB_AUTH_SOURCE=admin
```

The application will automatically use these credentials if provided.

## Connection String Formats

### Local MongoDB with authentication:
```
mongodb://username:password@localhost:27017/FixitHub?authSource=admin
```

### MongoDB Atlas (cloud):
```
mongodb+srv://username:password@cluster.mongodb.net/FixitHub?retryWrites=true&w=majority
```

### Local MongoDB without authentication:
```
mongodb://localhost:27017/FixitHub
```

## Testing Your Connection

After configuring your credentials, restart your application and check the logs:

```bash
npm run dev
```

You should see:
```
✅ MongoDB Connected: localhost:27017/FixitHub
```

If you see authentication errors, the credentials are incorrect or the user doesn't have the required permissions.

## Common Issues

### Issue: "Authentication failed"

**Cause:** Invalid username or password

**Solution:**
1. Verify your username and password are correct
2. Check that the user exists in MongoDB:
   ```bash
   mongosh admin
   db.getUsers()
   ```

### Issue: "User is not allowed to do action [find] on [database.collection]"

**Cause:** User doesn't have the required permissions

**Solution:** Grant the user readWrite role:
```javascript
db.grantRolesToUser("fixithub", [
  { role: "readWrite", db: "FixitHub" },
  { role: "dbAdmin", db: "FixitHub" }
])
```

### Issue: Connection works locally but fails in deployment

**Cause:** Different MongoDB configuration in production

**Solution:**
1. Check your deployment environment's MongoDB connection details
2. Ensure the DATABASE_URL environment variable is set correctly in your deployment platform
3. For cloud deployments (Heroku, Railway, etc.), add the DATABASE_URL in the platform's environment variable settings
4. For MongoDB Atlas, ensure your IP address is whitelisted in Network Access settings

## Security Best Practices

1. **Never commit credentials to Git**
   - Keep `.env` in `.gitignore`
   - Use environment variables in production

2. **Use strong passwords**
   - Generate secure passwords: `openssl rand -base64 32`

3. **Limit user permissions**
   - Only grant necessary database roles
   - Use separate users for different environments

4. **Use connection string format carefully**
   - Special characters in passwords must be URL-encoded
   - Example: `p@ssw0rd` becomes `p%40ssw0rd`

5. **Enable authentication in production**
   - Never deploy with authentication disabled
   - Use TLS/SSL for database connections

## Need Help?

If you're still experiencing issues:

1. Check the application logs for specific error messages
2. Verify MongoDB is running: `mongosh --eval "db.version()"`
3. Test the connection string directly:
   ```bash
   mongosh "mongodb://username:password@localhost:27017/FixitHub?authSource=admin"
   ```
4. Review MongoDB server logs for authentication attempts

## Additional Resources

- [MongoDB Authentication Documentation](https://www.mongodb.com/docs/manual/core/authentication/)
- [MongoDB Connection String URI Format](https://www.mongodb.com/docs/manual/reference/connection-string/)
- [MongoDB Atlas Setup Guide](https://www.mongodb.com/docs/atlas/getting-started/)
