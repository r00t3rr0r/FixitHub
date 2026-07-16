const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const { ACCESS_COOKIE_NAME } = require('../../utils/authCookies');

const getTokenFromRequest = (req) => {
  const cookieToken = req.cookies?.[ACCESS_COOKIE_NAME];
  if (cookieToken) {
    return cookieToken;
  }

  const authorizationHeader = req.header('Authorization');
  if (!authorizationHeader) {
    return null;
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
};

const auth = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);

    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('Auth middleware: JWT_SECRET missing');
      return res.status(500).json({ error: 'Server authentication configuration is invalid.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    const user = await User.findById(decoded.sub).select('-password');

    if (!user) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.warn('Auth middleware: Token expired');
      return res.status(401).json({ error: 'Token expired.' });
    }

    if (error.name === 'JsonWebTokenError') {
      console.warn('Auth middleware: Invalid token');
      return res.status(401).json({ error: 'Invalid token.' });
    }

    console.error('Auth middleware: Authentication error:', error);

    res.status(500).json({ error: 'Authentication failed.' });
  }
};

// Middleware to optionally authenticate user (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);

    if (!token || token === 'null' || token === 'undefined') {
      return next(); // Continue without user
    }

    if (!process.env.JWT_SECRET) {
      console.error('OptionalAuth middleware: JWT_SECRET missing');
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    const user = await User.findById(decoded.sub).select('-password');

    if (!user) {
      return next(); // Continue without user
    }

    req.user = user;
    next();
  } catch (error) {
    console.warn('OptionalAuth middleware: Authentication failed');
    // Continue without user even if auth fails
    next();
  }
};

// Middleware to require user authentication
const requireUser = auth;

// Middleware to require specific roles
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      console.log('RequireRole middleware: No user found in request');
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      console.log(`RequireRole middleware: User ${req.user.email} has role ${req.user.role}, but requires one of: ${roles.join(', ')}`);
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }

    console.log(`RequireRole middleware: User ${req.user.email} has required role ${req.user.role}`);
    next();
  };
};

// Middleware to require admin role (composite: auth + role check)
const requireAdmin = [auth, requireRole(['admin'])];

// Middleware to require staff role (composite: auth + role check)
const requireStaff = [auth, requireRole(['admin', 'staff'])];

module.exports = { auth, requireUser, optionalAuth, requireRole, requireAdmin, requireStaff };