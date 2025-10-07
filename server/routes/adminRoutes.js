const express = require('express');
const UserService = require('../services/userService.js');
const { requireUser } = require('./middleware/auth.js');

const router = express.Router();

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  console.log('Admin middleware: Checking admin role for user:', req.user.email);
  
  if (req.user.role !== 'admin') {
    console.log('Admin middleware: Access denied - user is not admin:', req.user.role);
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  console.log('Admin middleware: Admin access granted for user:', req.user.email);
  next();
};

// Get all users with filtering and pagination
router.get('/users', requireUser, requireAdmin, async (req, res) => {
  console.log('Admin: Get users request received from:', req.user.email);
  console.log('Admin: Query parameters:', req.query);

  try {
    const {
      search = '',
      role = 'all',
      status = 'all',
      page = 1,
      limit = 50
    } = req.query;

    const filters = {};
    
    // Build search filter
    if (search) {
      filters.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Build role filter
    if (role !== 'all') {
      filters.role = role;
    }

    // Build status filter - map frontend status to backend isActive
    if (status !== 'all') {
      if (status === 'active') {
        filters.isActive = true;
      } else if (status === 'inactive') {
        filters.isActive = false;
      }
    }

    console.log('Admin: Applied filters:', filters);

    const users = await UserService.listWithFilters(filters, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    // Transform users to match frontend expectations
    const transformedUsers = users.data.map(user => ({
      ...user.toJSON(),
      status: user.isActive ? 'active' : 'inactive',
      lastActivity: user.lastLoginAt || user.createdAt
    }));

    console.log(`Admin: Returning ${transformedUsers.length} users out of ${users.total} total`);

    return res.status(200).json({
      users: transformedUsers,
      totalPages: users.totalPages,
      currentPage: users.currentPage,
      totalUsers: users.total
    });

  } catch (error) {
    console.error('Admin: Error getting users:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Create new user
router.post('/users', requireUser, requireAdmin, async (req, res) => {
  console.log('Admin: Create user request received from:', req.user.email);
  console.log('Admin: User data:', { ...req.body, password: '[HIDDEN]' });

  try {
    const { name, email, phone, role, password, sendWelcomeEmail } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      console.log('Admin: Missing required fields for user creation');
      return res.status(400).json({ message: 'Name, email, password, and role are required' });
    }

    // Split name into first and last name
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const userData = {
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      phone: phone || '',
      role
    };

    console.log('Admin: Creating user with role:', role);
    const newUser = await UserService.create(userData);

    // TODO: Implement welcome email sending if sendWelcomeEmail is true
    if (sendWelcomeEmail) {
      console.log('Admin: Welcome email requested but not implemented yet');
    }

    const responseUser = {
      ...newUser.toJSON(),
      status: newUser.isActive ? 'active' : 'inactive',
      lastActivity: newUser.lastLoginAt || newUser.createdAt
    };

    console.log('Admin: User created successfully with ID:', newUser._id);

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: responseUser
    });

  } catch (error) {
    console.error('Admin: Error creating user:', error);
    return res.status(400).json({ message: error.message || 'Failed to create user' });
  }
});

// Update user role
router.put('/users/:id/role', requireUser, requireAdmin, async (req, res) => {
  console.log('Admin: Update user role request from:', req.user.email, 'for user:', req.params.id);
  console.log('Admin: New role:', req.body.role);

  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['customer', 'staff', 'admin'].includes(role)) {
      console.log('Admin: Invalid role provided:', role);
      return res.status(400).json({ message: 'Valid role is required (customer, staff, admin)' });
    }

    // Prevent admin from changing their own role
    if (id === req.user._id.toString()) {
      console.log('Admin: Attempt to change own role blocked');
      return res.status(400).json({ message: 'Cannot change your own role' });
    }

    const updatedUser = await UserService.update(id, { role });

    if (!updatedUser) {
      console.log('Admin: User not found for role update:', id);
      return res.status(404).json({ message: 'User not found' });
    }

    const responseUser = {
      _id: updatedUser._id,
      role: updatedUser.role
    };

    console.log('Admin: User role updated successfully');

    return res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      user: responseUser
    });

  } catch (error) {
    console.error('Admin: Error updating user role:', error);
    return res.status(500).json({ message: error.message || 'Failed to update user role' });
  }
});

// Update user status
router.put('/users/:id/status', requireUser, requireAdmin, async (req, res) => {
  console.log('Admin: Update user status request from:', req.user.email, 'for user:', req.params.id);
  console.log('Admin: New status:', req.body.status);

  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'inactive', 'suspended'].includes(status)) {
      console.log('Admin: Invalid status provided:', status);
      return res.status(400).json({ message: 'Valid status is required (active, inactive, suspended)' });
    }

    // Prevent admin from deactivating themselves
    if (id === req.user._id.toString() && status !== 'active') {
      console.log('Admin: Attempt to deactivate own account blocked');
      return res.status(400).json({ message: 'Cannot deactivate your own account' });
    }

    // Map frontend status to backend isActive field
    const isActive = status === 'active';
    
    const updatedUser = await UserService.update(id, { isActive });

    if (!updatedUser) {
      console.log('Admin: User not found for status update:', id);
      return res.status(404).json({ message: 'User not found' });
    }

    const responseUser = {
      _id: updatedUser._id,
      status: updatedUser.isActive ? 'active' : 'inactive'
    };

    console.log('Admin: User status updated successfully');

    return res.status(200).json({
      success: true,
      message: 'User status updated successfully',
      user: responseUser
    });

  } catch (error) {
    console.error('Admin: Error updating user status:', error);
    return res.status(500).json({ message: error.message || 'Failed to update user status' });
  }
});

// Bulk update user status
router.put('/users/bulk-status', requireUser, requireAdmin, async (req, res) => {
  console.log('Admin: Bulk status update request from:', req.user.email);
  console.log('Admin: User IDs:', req.body.userIds, 'Status:', req.body.status);

  try {
    const { userIds, status } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      console.log('Admin: Invalid userIds provided for bulk update');
      return res.status(400).json({ message: 'Valid array of user IDs is required' });
    }

    if (!status || !['active', 'inactive', 'suspended'].includes(status)) {
      console.log('Admin: Invalid status provided for bulk update:', status);
      return res.status(400).json({ message: 'Valid status is required (active, inactive, suspended)' });
    }

    // Prevent admin from deactivating themselves
    if (userIds.includes(req.user._id.toString()) && status !== 'active') {
      console.log('Admin: Attempt to deactivate own account in bulk update blocked');
      return res.status(400).json({ message: 'Cannot deactivate your own account' });
    }

    // Map frontend status to backend isActive field
    const isActive = status === 'active';
    
    const result = await UserService.bulkUpdateStatus(userIds, isActive);

    console.log(`Admin: Bulk status update completed - ${result.modifiedCount} users updated`);

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} users updated successfully`,
      updatedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Admin: Error in bulk status update:', error);
    return res.status(500).json({ message: error.message || 'Failed to update users' });
  }
});

// Delete user
router.delete('/users/:id', requireUser, requireAdmin, async (req, res) => {
  console.log('Admin: Delete user request from:', req.user.email, 'for user:', req.params.id);

  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (id === req.user._id.toString()) {
      console.log('Admin: Attempt to delete own account blocked');
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const deleted = await UserService.delete(id);

    if (!deleted) {
      console.log('Admin: User not found for deletion:', id);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Admin: User deleted successfully');

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Admin: Error deleting user:', error);
    return res.status(500).json({ message: error.message || 'Failed to delete user' });
  }
});

// Get detailed user information
router.get('/users/:id/details', requireUser, requireAdmin, async (req, res) => {
  console.log('Admin: Get user details request from:', req.user.email, 'for user:', req.params.id);

  try {
    const { id } = req.params;

    const userDetails = await UserService.getDetailedUserInfo(id);

    if (!userDetails) {
      console.log('Admin: User not found for details:', id);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Admin: User details retrieved successfully');

    return res.status(200).json({
      success: true,
      user: userDetails
    });

  } catch (error) {
    console.error('Admin: Error getting user details:', error);
    return res.status(500).json({ message: error.message || 'Failed to get user details' });
  }
});

module.exports = router;