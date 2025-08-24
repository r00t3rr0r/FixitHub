const { randomUUID } = require('crypto');

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
        console.log(`UserService.getByEmail: Found user with email: ${email}, ID: ${user._id}`);
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
      const result = await User.deleteOne({ _id: id }).exec();
      return (result.deletedCount === 1);
    } catch (err) {
      throw new Error(`Database error while deleting user ${id}: ${err}`);
    }
  }

  static async authenticateWithPassword(email, password) {
    if (!email) throw new Error('Email is required');
    if (!password) throw new Error('Password is required');

    try {
      console.log(`UserService.authenticateWithPassword: Attempting to authenticate user: ${email}`);
      const user = await User.findOne({email}).exec();
      if (!user) {
        console.log(`UserService.authenticateWithPassword: No user found with email: ${email}`);
        return null;
      }

      console.log(`UserService.authenticateWithPassword: User found with email: ${email}, validating password...`);
      const passwordValid = await validatePassword(password, user.password);
      console.log(`UserService.authenticateWithPassword: Password validation result for ${email}: ${passwordValid}`);
      
      if (!passwordValid) {
        console.log(`UserService.authenticateWithPassword: Password validation failed for user: ${email}`);
        return null;
      }

      console.log(`UserService.authenticateWithPassword: Authentication successful for user: ${email}`);
      user.lastLoginAt = Date.now();
      const updatedUser = await user.save();
      return updatedUser;
    } catch (err) {
      console.error(`UserService.authenticateWithPassword: Database error while authenticating user ${email}:`, err);
      throw new Error(`Database error while authenticating user ${email} with password: ${err}`);
    }
  }

  static async create({ email, password, firstName = '', lastName = '', phone = '', role = 'customer' }) {
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
    console.log(`UserService.create: Password hash generated for user: ${email}`);

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
        // Set default avatar based on initials
        avatar: `https://via.placeholder.com/150x150/3b82f6/ffffff?text=${firstName.charAt(0)}${lastName.charAt(0)}`,
      });

      console.log(`UserService.create: Saving user to database: ${email}`);
      await user.save();
      console.log(`UserService.create: User created successfully with ID: ${user._id}`);
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
}

module.exports = UserService;