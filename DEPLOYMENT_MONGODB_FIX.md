# MongoDB Authentication Fix for Deployment

## Problem

When trying to create an account in the deployed application, you get the error:

```
Error: Database error while getting the user by their email: MongoServerError: command find requires authentication
```

## Root Cause

The deployed MongoDB instance has authentication enabled, but the application is not configured with valid MongoDB credentials. The connection string in your deployment environment variables doesn't include username and password.

## Solution

You need to configure MongoDB authentication credentials in your deployment environment. The exact steps depend on your hosting platform.

### For Pythagora/General Cloud Deployments

1. **Obtain MongoDB Credentials**
   - If using MongoDB Atlas: Get your connection string from the Atlas dashboard
   - If using a custom MongoDB server: Get the username, password, host, and port

2. **Update Environment Variables**

   In your deployment platform's environment variable settings, update the `DATABASE_URL`:

   **For MongoDB Atlas:**
   ```
   DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/FixitHub?retryWrites=true&w=majority
   ```

   **For Self-Hosted MongoDB with Authentication:**
   ```
   DATABASE_URL=mongodb://username:password@host:port/FixitHub?authSource=admin
   ```

   **Example:**
   ```
   DATABASE_URL=mongodb://fixithub:SecurePassword123@db.example.com:27017/FixitHub?authSource=admin
   ```

3. **Alternative: Use Separate Environment Variables**

   Instead of embedding credentials in DATABASE_URL, you can set:
   ```
   DATABASE_URL=mongodb://your-host:27017/FixitHub
   MONGODB_USERNAME=fixithub
   MONGODB_PASSWORD=SecurePassword123
   MONGODB_AUTH_SOURCE=admin
   ```

4. **Restart Your Application**

   After updating environment variables, restart the deployed application for changes to take effect.

### Platform-Specific Instructions

#### Heroku

```bash
heroku config:set DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/FixitHub?retryWrites=true&w=majority"
```

Or via the Heroku Dashboard:
1. Go to your app → Settings → Config Vars
2. Edit `DATABASE_URL` with your MongoDB connection string

#### Railway

1. Go to your project → Variables
2. Edit `DATABASE_URL` variable
3. Add your MongoDB connection string with credentials
4. Deploy changes

#### Vercel

1. Go to Project Settings → Environment Variables
2. Edit `DATABASE_URL`
3. Add your MongoDB connection string
4. Redeploy

#### DigitalOcean App Platform

1. Go to your app → Settings → Environment Variables
2. Edit `DATABASE_URL`
3. Add your MongoDB connection string
4. Save and redeploy

#### AWS (Elastic Beanstalk, ECS, Lambda)

1. Configure environment variables in your service
2. Set `DATABASE_URL` with authentication
3. Redeploy your application

### Setting Up MongoDB Atlas (Recommended for Production)

If you don't have a MongoDB instance yet, MongoDB Atlas provides a free tier:

1. **Create an Atlas Account**
   - Visit https://www.mongodb.com/cloud/atlas
   - Sign up for a free account

2. **Create a Cluster**
   - Choose the free tier (M0)
   - Select a cloud provider and region close to your users

3. **Create a Database User**
   - Go to Database Access
   - Click "Add New Database User"
   - Choose authentication method (usually username/password)
   - Set username: `fixithub`
   - Generate a secure password
   - Assign role: "Read and write to any database"

4. **Whitelist IP Addresses**
   - Go to Network Access
   - Click "Add IP Address"
   - For development: Click "Allow Access from Anywhere" (0.0.0.0/0)
   - For production: Add specific IP addresses of your deployment servers

5. **Get Connection String**
   - Go to your cluster → Connect → Connect your application
   - Copy the connection string
   - Replace `<password>` with your actual password
   - Replace `<dbname>` with `FixitHub`

   Example:
   ```
   mongodb+srv://fixithub:your_password_here@cluster0.xxxxx.mongodb.net/FixitHub?retryWrites=true&w=majority
   ```

6. **Add to Deployment Environment**
   - Use this connection string as your `DATABASE_URL` environment variable

### Verification

After updating your environment variables:

1. **Check Server Logs**

   You should see:
   ```
   ✅ MongoDB Connected: cluster.mongodb.net:27017/FixitHub
   ```

   Instead of authentication errors.

2. **Test Registration**
   - Try creating a new account
   - Should complete successfully without authentication errors

3. **Test Login**
   - Try logging in with test credentials
   - Should authenticate successfully

## Security Best Practices

### 1. Never Commit Credentials

```gitignore
# Already in .gitignore, but verify:
.env
.env.local
.env.production
```

### 2. Use Strong Passwords

Generate secure passwords:
```bash
openssl rand -base64 32
```

### 3. Special Characters in Passwords

If your password contains special characters, they must be URL-encoded in the connection string:

| Character | Encoded |
|-----------|---------|
| @         | %40     |
| :         | %3A     |
| /         | %2F     |
| #         | %23     |
| %         | %25     |
| &         | %26     |

Example:
- Password: `p@ss:word`
- Encoded: `p%40ss%3Aword`

### 4. Restrict Database Access

For MongoDB Atlas:
- Only whitelist necessary IP addresses
- Use VPC peering for enhanced security
- Enable audit logs

For self-hosted MongoDB:
- Use firewall rules to restrict access
- Enable TLS/SSL for encrypted connections
- Regularly update MongoDB

### 5. Use Separate Databases for Environments

- Development: `FixitHub-dev`
- Staging: `FixitHub-staging`
- Production: `FixitHub`

## Troubleshooting

### Error: "authentication failed"

**Cause:** Wrong username or password

**Solution:**
1. Double-check credentials
2. Verify user exists in MongoDB
3. Check that password doesn't have unencoded special characters

### Error: "Could not connect to any servers"

**Cause:** Network connectivity issue

**Solution:**
1. Check IP whitelist in MongoDB Atlas
2. Verify MongoDB server is running
3. Check firewall rules
4. Verify connection string hostname and port

### Error: "User is not allowed to do action [find]"

**Cause:** User lacks required permissions

**Solution:**
1. Grant readWrite role to the user
2. In MongoDB Atlas: Database Access → Edit User → Set role to "Read and write to any database"

### Still Having Issues?

1. **Check Application Logs**
   - Look for detailed MongoDB connection errors
   - The improved error messages will guide you

2. **Test Connection String Locally**
   ```bash
   mongosh "your-connection-string-here"
   ```

3. **Verify Environment Variables**
   - Ensure `DATABASE_URL` is set correctly in deployment
   - Check for typos in username/password
   - Verify special characters are URL-encoded

4. **Contact Support**
   - Provide error logs
   - Share connection attempt details (without passwords)
   - Mention your hosting platform

## Summary of Changes

This fix includes:

1. ✅ Enhanced database connection with authentication support
2. ✅ Support for separate credential environment variables
3. ✅ Improved error messages with actionable solutions
4. ✅ Password masking in logs for security
5. ✅ Interactive setup script: `setup-mongodb-auth.js`
6. ✅ Comprehensive documentation

## Quick Reference

### Local Development (No Auth)
```env
DATABASE_URL=mongodb://localhost:27017/FixitHub
```

### Local Development (With Auth)
```env
DATABASE_URL=mongodb://fixithub:password@localhost:27017/FixitHub?authSource=admin
```

### MongoDB Atlas
```env
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/FixitHub?retryWrites=true&w=majority
```

### Separate Credentials
```env
DATABASE_URL=mongodb://localhost:27017/FixitHub
MONGODB_USERNAME=fixithub
MONGODB_PASSWORD=SecurePassword123
MONGODB_AUTH_SOURCE=admin
```

## Next Steps

1. Update your deployment environment variables with MongoDB credentials
2. Restart your application
3. Test user registration and login
4. Monitor logs for any remaining issues

If you continue to experience problems after following this guide, please check the detailed troubleshooting section in [MONGODB_AUTH_SETUP.md](./MONGODB_AUTH_SETUP.md).
