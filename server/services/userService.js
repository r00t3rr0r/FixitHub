const { randomUUID } = require('crypto');
const mongoose = require('mongoose');

const User = require('../models/User.js');
const { generatePasswordHash, validatePassword } = require('../utils/password.js');

class UserService {
  static async list() {
    try {
      return User.find();
    } catch (err) {
      throw new Error(`Database error while listing users: ${err}`);
    }
  }

  static async listWithFilters(filters = {}, options = {}) {
    try {
      const { page = 1, limit = 50 } = options;
      const skip = (page - 1) * limit;

      console.log('UserService.listWithFilters: Filters:', filters, 'Options:', options);

      const [data, total] = await Promise.all([
        User.find(filters)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        User.countDocuments(filters).exec()
      ]);

      const totalPages = Math.ceil(total / limit);

      console.log(`UserService.listWithFilters: Found ${data.length} users out of ${total} total`);

      return {
        data,
        total,
        currentPage: page,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      };
    } catch (err) {
      console.error('UserService.listWithFilters: Database error:', err);
      throw new Error(`Database error while listing users with filters: ${err}`);
    }
  }

  static async bulkUpdateStatus(userIds, isActive) {
    try {
      console.log('UserService.bulkUpdateStatus: Updating users:', userIds, 'isActive:', isActive);

      const result = await User.updateMany(
        { _id: { $in: userIds } },
        { $set: { isActive } }
      ).exec();

      console.log('UserService.bulkUpdateStatus: Update result:', result);
      return result;
    } catch (err) {
      console.error('UserService.bulkUpdateStatus: Database error:', err);
      throw new Error(`Database error while bulk updating user status: ${err}`);
    }
  }

  static async get(id) {
    try {
      return User.findOne({ _id: id }).exec();
    } catch (err) {
      throw new Error(`Database error while getting the user by their ID: ${err}`);
    }
  }

  static async getByEmail(email) {
    try {
      console.log(`UserService.getByEmail: Looking for user with email: ${email}`);
      const user = await User.findOne({ email }).exec();
      if (user) {
        console.log(`UserService.getByEmail: Found user with email: ${email}, ID: ${user._id}, role: ${user.role}`);
      } else {
        console.log(`UserService.getByEmail: No user found with email: ${email}`);
      }
      return user;
    } catch (err) {
      console.error(`UserService.getByEmail: Database error while getting user by email ${email}:`, err);
      throw new Error(`Database error while getting the user by their email: ${err}`);
    }
  }

  static async update(id, data) {
    try {
      console.log('UserService: Updating user with ID:', id, 'Data:', data);

      // Remove sensitive fields that shouldn't be updated directly
      const { password, refreshToken, _id, createdAt, ...updateData } = data;

      const updatedUser = await User.findOneAndUpdate(
        { _id: id },
        updateData,
        { new: true, upsert: false }
      );

      console.log('UserService: User updated successfully');
      return updatedUser;
    } catch (err) {
      console.error('UserService: Error updating user:', err);
      throw new Error(`Database error while updating user ${id}: ${err}`);
    }
  }

  static async delete(id) {
    try {
      console.log('UserService.delete: Deleting user with ID:', id);
      const result = await User.deleteOne({ _id: id }).exec();
      console.log('UserService.delete: Delete result:', result);
      return (result.deletedCount === 1);
    } catch (err) {
      console.error('UserService.delete: Database error:', err);
      throw new Error(`Database error while deleting user ${id}: ${err}`);
    }
  }

  static async authenticateWithPassword(email, password) {
    if (!email) throw new Error('Email is required');
    if (!password) throw new Error('Password is required');

    try {
      console.log(`UserService.authenticateWithPassword: Attempting to authenticate user: ${email}`);
      console.log(`UserService.authenticateWithPassword: Password provided length: ${password.length}`);

      const user = await User.findOne({email}).exec();
      if (!user) {
        console.log(`UserService.authenticateWithPassword: No user found with email: ${email}`);
        return null;
      }

      console.log(`UserService.authenticateWithPassword: User found with email: ${email}, validating password...`);
      console.log(`UserService.authenticateWithPassword: Stored password hash length: ${user.password.length}`);
      console.log(`UserService.authenticateWithPassword: User role: ${user.role}, isActive: ${user.isActive}`);

      // Check if user is active
      if (!user.isActive) {
        console.log(`UserService.authenticateWithPassword: User account is inactive: ${email}`);
        return null;
      }

      const passwordValid = await validatePassword(password, user.password);
      console.log(`UserService.authenticateWithPassword: Password validation result for ${email}: ${passwordValid}`);

      if (!passwordValid) {
        console.log(`UserService.authenticateWithPassword: Password validation failed for user: ${email}`);
        
        // Log expected passwords for debugging in development
        if (process.env.NODE_ENV === 'development') {
          if (email === 'admin@example.com') {
            console.log(`UserService.authenticateWithPassword: Expected password for admin should be 'admin123'`);
          } else if (email.includes('@example.com')) {
            console.log(`UserService.authenticateWithPassword: Expected password for test users should be 'password123'`);
          }
        }
        return null;
      }

      console.log(`UserService.authenticateWithPassword: Authentication successful for user: ${email}`);
      user.lastLoginAt = Date.now();
      const updatedUser = await user.save();
      console.log(`UserService.authenticateWithPassword: Last login time updated for user: ${email}`);
      return updatedUser;
    } catch (err) {
      console.error(`UserService.authenticateWithPassword: Database error while authenticating user ${email}:`, err);
      throw new Error(`Database error while authenticating user ${email} with password: ${err}`);
    }
  }

  static async create({
    email,
    password,
    firstName = '',
    lastName = '',
    phone = '',
    role = 'customer',
    status = 'active',
    isActive,
  }) {
    if (!email) throw new Error('Email is required');
    if (!password) throw new Error('Password is required');

    console.log('UserService.create: Creating user with email:', email, 'role:', role);

    const existingUser = await UserService.getByEmail(email);
    if (existingUser) {
      console.log(`UserService.create: User with email ${email} already exists`);
      throw new Error('User with this email already exists');
    }

    console.log(`UserService.create: Generating password hash for user: ${email}`);
    const hash = await generatePasswordHash(password);
    console.log(`UserService.create: Password hash generated for user: ${email}, hash length: ${hash.length}`);

    try {
      // Generate full name from first and last name
      const name = `${firstName} ${lastName}`.trim();

      const user = new User({
        email,
        password: hash,
        firstName,
        lastName,
        name,
        phone,
        role,
        status,
        isActive: isActive ?? status !== 'inactive',
        // Set default avatar based on initials
        avatar: `https://via.placeholder.com/150x150/3b82f6/ffffff?text=${firstName.charAt(0)}${lastName.charAt(0)}`,
      });

      console.log(`UserService.create: Saving user to database: ${email}`);
      await user.save();
      console.log(`UserService.create: User created successfully with ID: ${user._id}, role: ${user.role}`);
      return user;
    } catch (err) {
      console.error('UserService.create: Error creating user:', err);
      throw new Error(`Database error while creating new user: ${err}`);
    }
  }

  static async setPassword(user, password) {
    if (!password) throw new Error('Password is required');
    user.password = await generatePasswordHash(password); // eslint-disable-line

    try {
      if (!user.isNew) {
        await user.save();
      }

      return user;
    } catch (err) {
      throw new Error(`Database error while setting user password: ${err}`);
    }
  }

  static async getDetailedUserInfo(userId) {
    try {
      console.log('UserService.getDetailedUserInfo: Getting detailed info for user:', userId);

      // Get user basic information
      const user = await User.findById(userId)
        .populate('primaryCustomerGroupId', '_id name key')
        .populate('customerGroupIds', '_id name key')
        .exec();
      if (!user) {
        throw new Error('User not found');
      }

      // Get user's orders
      const Order = require('../models/Order');
      const orders = await Order.find({ customerId: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .exec();

      // Calculate order statistics
      const orderStats = await Order.aggregate([
        { $match: { customerId: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalSpent: { $sum: '$totalCost' },
            avgOrderValue: { $avg: '$totalCost' },
            completedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            pendingOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            inProgressOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] }
            }
          }
        }
      ]);

      // Get payment history (mock data for now since we don't have a Payment model)
      const paymentHistory = [
        {
          _id: 'payment1',
          orderId: orders[0]?._id || 'order1',
          amount: 299.99,
          status: 'completed',
          method: 'credit_card',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          transactionId: 'txn_' + Math.random().toString(36).substr(2, 9)
        },
        {
          _id: 'payment2',
          orderId: orders[1]?._id || 'order2',
          amount: 149.99,
          status: 'completed',
          method: 'paypal',
          createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          transactionId: 'txn_' + Math.random().toString(36).substr(2, 9)
        }
      ];

      // Get activity log (mock data for now)
      const activityLog = [
        {
          _id: 'activity1',
          action: 'login',
          description: 'User logged in',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          timestamp: user.lastLoginAt || new Date()
        },
        {
          _id: 'activity2',
          action: 'profile_update',
          description: 'Updated profile information',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        },
        {
          _id: 'activity3',
          action: 'order_created',
          description: 'Created new repair order',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
        }
      ];

      // Determine customer group based on total spent and orders
      let customerGroup = 'New Customer';
      const stats = orderStats[0];
      if (stats) {
        if (stats.totalSpent > 1000) {
          customerGroup = 'VIP Customer';
        } else if (stats.totalSpent > 500) {
          customerGroup = 'Premium Customer';
        } else if (stats.totalOrders > 3) {
          customerGroup = 'Regular Customer';
        }
      }

      const populatedPrimaryGroup = user.primaryCustomerGroupId;
      const populatedGroups = Array.isArray(user.customerGroupIds) ? user.customerGroupIds : [];
      const primaryCustomerGroupId = populatedPrimaryGroup?._id
        ? String(populatedPrimaryGroup._id)
        : user.primaryCustomerGroupId
          ? String(user.primaryCustomerGroupId)
          : null;
      const customerGroupIds = populatedGroups.map((group) => String(group._id || group));
      const customerGroups = populatedGroups.map((group) => ({
        _id: String(group._id || group),
        name: group.name || user.customerGroup || 'Customer Group',
        key: group.key || '',
        isPrimary: String(group._id || group) === primaryCustomerGroupId,
      }));

      const detailedInfo = {
        // Basic user info
        _id: user._id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,

        // Address information
        invoiceAddress: user.invoiceAddress,
        paymentAddress: user.paymentAddress,

        // Preferences
        preferences: user.preferences,

        // Staff-specific fields (if applicable)
        department: user.department,
        specializations: user.specializations,
        addOnCapabilities: user.addOnCapabilities,
        employmentStartDate: user.employmentStartDate,
        employmentEndDate: user.employmentEndDate,
        skills: user.skills,

        // Order information
        orders: orders,
        orderStats: stats || {
          totalOrders: 0,
          totalSpent: 0,
          avgOrderValue: 0,
          completedOrders: 0,
          pendingOrders: 0,
          inProgressOrders: 0
        },

        // Payment information
        paymentHistory: paymentHistory,

        // Customer classification
        customerGroup: populatedPrimaryGroup?.name || user.customerGroup || customerGroup,
        primaryCustomerGroupId,
        customerGroupIds,
        customerGroups,

        // Activity log
        activityLog: activityLog,

        // Additional metadata
        status: user.isActive ? 'active' : 'inactive',
        lastActivity: user.lastLoginAt || user.createdAt,
        totalOrders: user.totalOrders,
        totalSpent: user.totalSpent
      };

      console.log('UserService.getDetailedUserInfo: Detailed info compiled successfully');
      return detailedInfo;

    } catch (err) {
      console.error('UserService.getDetailedUserInfo: Error getting detailed user info:', err);
      throw new Error(`Error getting detailed user information: ${err.message}`);
    }
  }
}

module.exports = UserService;