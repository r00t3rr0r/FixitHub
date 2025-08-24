const express = require('express');
const UserService = require('../services/userService.js');
const { requireUser } = require('./middleware/auth.js');
const User = require('../models/User.js');
const { generateAccessToken, generateRefreshToken } = require('../utils/auth.js');
const jwt = require('jsonwebtoken');

const router = express.Router();

router.post('/login', async (req, res) => {
  console.log('Login request received:', { body: req.body, headers: req.headers });
  
  const sendError = msg => {
    console.log('Sending login error:', msg);
    return res.status(400).json({ message: msg });
  };
  
  const { email, password } = req.body;

  if (!email || !password) {
    console.log('Missing email or password');
    return sendError('Email and password are required');
  }

  try {
    console.log('Attempting to authenticate user:', email);
    const user = await UserService.authenticateWithPassword(email, password);

    if (user) {
      console.log('User authenticated successfully:', user.email);
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      user.refreshToken = refreshToken;
      await user.save();
      console.log('Tokens generated and user updated');
      return res.json({...user.toObject(), accessToken, refreshToken});
    } else {
      console.log('Authentication failed for user:', email);
      return sendError('Email or password is incorrect');
    }
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/register', async (req, res, next) => {
  console.log('Register request received:', { body: req.body });
  
  if (req.user) {
    console.log('User already logged in, returning user');
    return res.json({ user: req.user });
  }
  
  try {
    console.log('Creating new user with email:', req.body.email);
    const user = await UserService.create(req.body);
    console.log('User created successfully:', user.email);
    return res.status(200).json(user);
  } catch (error) {
    console.error(`Error while registering user: ${error.message}`);
    return res.status(400).json({ message: error.message });
  }
});

router.post('/logout', async (req, res) => {
  console.log('Logout request received:', req.body);
  
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (user) {
    user.refreshToken = null;
    await user.save();
    console.log('User logged out successfully:', email);
  }

  res.status(200).json({ message: 'User logged out successfully.' });
});

router.post('/refresh', async (req, res) => {
  console.log('Token refresh request received');
  
  const { refreshToken } = req.body;

  if (!refreshToken) {
    console.log('No refresh token provided');
    return res.status(401).json({
      success: false,
      message: 'Refresh token is required'
    });
  }

  try {
    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    console.log('Refresh token verified for user:', decoded.sub);

    // Find the user
    const user = await UserService.get(decoded.sub);

    if (!user) {
      console.log('User not found for refresh token');
      return res.status(403).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.refreshToken !== refreshToken) {
      console.log('Invalid refresh token for user:', user.email);
      return res.status(403).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Update user's refresh token in database
    user.refreshToken = newRefreshToken;
    await user.save();

    console.log('New tokens generated for user:', user.email);

    // Return new tokens
    return res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      }
    });

  } catch (error) {
    console.error(`Token refresh error: ${error.message}`);

    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        message: 'Refresh token has expired'
      });
    }

    return res.status(403).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
});

router.get('/me', requireUser, async (req, res) => {
  console.log('Get user profile request received');
  return res.status(200).json(req.user);
});

module.exports = router;