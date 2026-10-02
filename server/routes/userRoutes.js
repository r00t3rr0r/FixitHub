const express = require('express');
const UserService = require('../services/userService.js');
const { requireUser } = require('./middleware/auth.js');

const router = express.Router();

// Get current user profile
router.get('/me', requireUser, async (req, res) => {
  console.log('Get user profile request received for user:', req.user.email);
  
  try {
    // Return the user object that's already attached by the auth middleware
    return res.status(200).json({ user: req.user });
  } catch (error) {
    console.error('Error getting user profile:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Update current user profile
// SEC-PROFILE: Nur Selbstbedienungs-Felder. Vorher wurde der gesamte Body uebernommen, damit konnte
// jeder eingeloggte Kunde role:'admin', status, email, Rabatt, Kundennummer usw. selbst setzen.
// Rollen/Status/E-Mail aendert nur der Admin ueber /api/admin/users/:id.
const SELF_EDITABLE_PROFILE_FIELDS = [
  'firstName', 'lastName', 'name', 'salutation', 'title', 'company', 'phone', 'addressAddition',
  'newsletter', 'avatar', 'invoiceAddress', 'paymentAddress', 'preferences'
];

router.put('/me', requireUser, async (req, res) => {
  console.log('Update user profile request received for user:', req.user.email);

  try {
    const userId = req.user._id;
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const updateData = {};
    SELF_EDITABLE_PROFILE_FIELDS.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(body, field)) updateData[field] = body[field];
    });
    console.log('Update profile fields:', Object.keys(updateData));

    // Update the user
    const updatedUser = await UserService.update(userId, updateData);

    if (!updatedUser) {
      console.log('User not found for update:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('User profile updated successfully');
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Upload avatar endpoint (placeholder for now)
router.post('/avatar', requireUser, async (req, res) => {
  console.log('Avatar upload request received for user:', req.user.email);
  
  // For now, return a mock response since file upload requires additional setup
  // This would typically use multer or similar middleware for file handling
  return res.status(200).json({
    success: true,
    message: 'Avatar upload endpoint - implementation pending',
    avatarUrl: req.user.avatar
  });
});

module.exports = router;