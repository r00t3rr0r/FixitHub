const express = require('express');
const UserService = require('../services/userService.js');
const EmailService = require('../services/emailService.js');
const { requireUser } = require('./middleware/auth.js');
const User = require('../models/User.js');
const { generateAccessToken, generateRefreshToken } = require('../utils/auth.js');
const jwt = require('jsonwebtoken');

const router = express.Router();

router.post('/login', async (req, res) => {
  console.log('Login request received:', { 
    body: { email: req.body.email, password: '[HIDDEN]' }, 
    headers: { 
      'user-agent': req.headers['user-agent'],
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'host': req.headers.host
    }
  });

  const sendError = (msg, details = null) => {
    console.log('Sending login error:', msg, details ? `Details: ${JSON.stringify(details)}` : '');
    return res.status(400).json({ 
      message: msg,
      ...(process.env.NODE_ENV === 'development' && details ? { debug: details } : {})
    });
  };

  const { email, password } = req.body;

  if (!email || !password) {
    console.log('Missing email or password');
    return sendError('Email and password are required');
  }

  try {
    console.log('Attempting to authenticate user:', email);
    console.log('Password provided length:', password.length);
    console.log('Environment:', process.env.NODE_ENV);

    // Check if user exists first
    const userExists = await User.findOne({ email }).exec();
    if (!userExists) {
      console.log(`User not found in database: ${email}`);
      return sendError('Email or password is incorrect', {
        issue: 'user_not_found',
        suggestion: 'User may need to be created. Try running seed data endpoint.'
      });
    }

    console.log(`User found: ${email}, role: ${userExists.role}, isActive: ${userExists.isActive}, status: ${userExists.status}`);

    // Check if user's email is verified (status must be 'active')
    if (userExists.status === 'inactive') {
      console.log(`User email not verified for: ${email}`);
      return sendError('Email address not verified. Please check your email and click the verification link.', {
        issue: 'email_not_verified',
        status: 'inactive'
      });
    }

    // Check if user is blocked or suspended
    if (userExists.status === 'blocked' || userExists.status === 'suspended') {
      console.log(`User account is ${userExists.status} for: ${email}`);
      return sendError(`Your account has been ${userExists.status}. Please contact support.`, {
        issue: `account_${userExists.status}`
      });
    }

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
      console.log('This usually means password mismatch or inactive account');
      
      // Provide debugging info in development
      const debugInfo = process.env.NODE_ENV === 'development' ? {
        issue: 'authentication_failed',
        userExists: true,
        userActive: userExists.isActive,
        suggestion: email.includes('@example.com') 
          ? 'Try running the seed endpoint to ensure test users have correct passwords'
          : 'Check if password is correct'
      } : null;
      
      return sendError('Email or password is incorrect', debugInfo);
    }
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' ? { 
        debug: {
          error: error.message,
          suggestion: 'Check database connection and server logs'
        }
      } : {})
    });
  }
});

router.post('/register', async (req, res, next) => {
  console.log('Register request received:', { body: req.body });

  if (req.user) {
    console.log('User already logged in, returning user');
    return res.json({ user: req.user });
  }

  try {
    const { email, password, firstName, lastName, phone, role } = req.body;

    console.log('Creating new user with email:', email);
    const user = await UserService.create({
      email,
      password,
      firstName: firstName || '',
      lastName: lastName || '',
      phone: phone || '',
      role: role || 'customer',
      status: 'inactive', // New users start as inactive until email is verified
      isActive: false
    });

    console.log('User created successfully:', user.email);

    // Send registration email with template
    try {
      const verificationToken = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET || 'default_secret',
        { expiresIn: '7d' }
      );
      
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
      
      const emailResult = await EmailService.sendRegistrationEmail(
        user.email,
        user.firstName || 'Valued Customer',
        verificationUrl
      );

      if (emailResult.success) {
        console.log('Registration email sent successfully to:', user.email);
      } else {
        console.error('Failed to send registration email:', emailResult.error);
        // Don't fail registration if email fails - log and continue
      }
    } catch (emailError) {
      console.error('Error sending registration email:', emailError.message);
      // Email failure should not block registration
    }

    return res.status(200).json({
      success: true,
      message: 'User registered successfully. Please check your email to activate your account.',
      user: user
    });
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

// Verify email and activate account endpoint
router.post('/verify-email', async (req, res) => {
  console.log('Verify email request received');

  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'default_secret'
      );
    } catch (verifyError) {
      console.error('Token verification failed:', verifyError.message);
      return res.status(400).json({
        success: false,
        message: 'Verification token is invalid or has expired. Please register again.'
      });
    }

    const { userId, email } = decoded;

    // Find user and verify token
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.email !== email) {
      return res.status(400).json({
        success: false,
        message: 'Email mismatch. Token is invalid.'
      });
    }

    // Repeated verification attempts should return a failure message
    if (user.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'Email has already been verified.'
      });
    }

    // Activate account
    user.status = 'active';
    user.isActive = true;
    await user.save();

    console.log('Email verified and account activated for user:', email);

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully! Your account is now active. You can log in.'
    });
  } catch (error) {
    console.error('Error verifying email:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify email'
    });
  }
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

/**
 * POST /api/auth/forgot-password
 * Send password reset email to user
 */
router.post('/forgot-password', async (req, res) => {
  console.log('Forgot password request received');

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      // Don't leak that email doesn't exist - just say we sent it
      console.log('Password reset requested for non-existent email:', email);
      return res.status(200).json({
        success: true,
        message: 'If an account exists with that email, you will receive a password reset link.'
      });
    }

    // Generate password reset token valid for 1 hour
    const resetToken = jwt.sign(
      { userId: user._id, email: user.email, type: 'password-reset' },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '1h' }
    );

    // Store reset token hash in database (optional but recommended)
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    // Build reset URL with token
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    const expiresAt = new Date(Date.now() + 3600000).toLocaleString('de-DE');

    // Send password reset email
    const emailResult = await EmailService.sendPasswordResetEmail(
      user.email,
      user.firstName || 'Valued Customer',
      resetUrl,
      expiresAt
    );

    if (emailResult.success) {
      console.log('Password reset email sent to:', user.email);
    } else {
      console.error('Failed to send password reset email:', emailResult.error);
    }

    return res.status(200).json({
      success: true,
      message: 'If an account exists with that email, you will receive a password reset link.'
    });
  } catch (error) {
    console.error('Error in forgot-password:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error processing password reset request'
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset user password with token
 */
router.post('/reset-password', async (req, res) => {
  console.log('Reset password request received');

  const { token, newPassword, confirmPassword } = req.body;

  if (!token || !newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Token, new password, and password confirmation are required'
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Passwords do not match'
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters long'
    });
  }

  try {
    // Verify reset token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'default_secret'
    );

    if (decoded.type !== 'password-reset') {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset token'
      });
    }

    // Find user and verify token
    const user = await User.findById(decoded.userId);

    if (!user || user.email !== decoded.email) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset token or user not found'
      });
    }

    if (user.passwordResetExpires && user.passwordResetExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token has expired'
      });
    }

    // Update password
    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    console.log('Password reset successful for user:', user.email);

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({
        success: false,
        message: 'Password reset token has expired'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset token'
      });
    }

    console.error('Error in reset-password:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error resetting password'
    });
  }
});

module.exports = router;