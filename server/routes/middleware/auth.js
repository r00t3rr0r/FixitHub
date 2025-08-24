const jwt = require('jsonwebtoken');
const UserService = require('../../services/userService.js');

const requireUser = async (req, res, next) => {
  console.log('Auth middleware called for:', req.url);
  
  const authHeader = req.headers.authorization;
  console.log('Authorization header:', authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('No valid authorization header found');
    return res.status(403).json({ message: 'Access token is required' });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  console.log('Extracted token:', token ? 'Token present' : 'No token');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded successfully for user:', decoded.sub);
    
    const user = await UserService.get(decoded.sub);
    
    if (!user) {
      console.log('User not found for token');
      return res.status(403).json({ message: 'User not found' });
    }

    if (!user.isActive) {
      console.log('User account is inactive');
      return res.status(403).json({ message: 'User account is inactive' });
    }

    console.log('User authenticated successfully:', user.email);
    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Access token has expired' });
    }
    
    return res.status(403).json({ message: 'Invalid access token' });
  }
};

module.exports = {
  requireUser,
};