const jwt = require('jsonwebtoken');
const User = require('../../models/User');

const auth = async (req, res, next) => {
  try {
    console.log('Auth middleware: Checking authentication');

    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      console.log('Auth middleware: No token provided');
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    console.log('Auth middleware: Token found, verifying...');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Auth middleware: Token decoded:', decoded);
    console.log('Auth middleware: Token verified for user ID:', decoded.sub);

    const user = await User.findById(decoded.sub).select('-password');

    if (!user) {
      console.log('Auth middleware: User not found for ID:', decoded.sub);
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    console.log('Auth middleware: User authenticated:', user.email);
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware: Authentication error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.' });
    }

    res.status(500).json({ error: 'Authentication failed.' });
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

module.exports = { auth, requireUser, requireRole, requireAdmin, requireStaff };