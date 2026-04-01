const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

module.exports = auth;