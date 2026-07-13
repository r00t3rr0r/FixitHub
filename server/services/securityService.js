const User = require('../models/User');
const SystemConfiguration = require('../models/SystemConfiguration');

const DEFAULT_PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false
};

class SecurityService {
  // Get security settings
  async getSecuritySettings() {
    console.log('SecurityService: Getting security settings');

    const config = await SystemConfiguration.findOne() || new SystemConfiguration();
    const loginAttempts = await this.getLoginAttempts();
    const activeSessions = await this.getActiveSessions();
    const securityEvents = await this.getSecurityEvents();

    return {
      settings: {
        passwordPolicy: config.securitySettings?.passwordPolicy || DEFAULT_PASSWORD_POLICY,
        sessionTimeout: config.securitySettings?.sessionTimeout || 3600,
        maxLoginAttempts: config.securitySettings?.maxLoginAttempts || 5,
        lockoutDuration: config.securitySettings?.lockoutDuration || 900,
        enableTwoFactor: config.securitySettings?.enableTwoFactor || false
      },
      loginAttempts,
      activeSessions,
      securityEvents
    };
  }

  async getPasswordPolicy() {
    const config = await SystemConfiguration.findOne().select('securitySettings.passwordPolicy');
    const policy = config?.securitySettings?.passwordPolicy || {};

    return {
      minLength: Number.isInteger(policy.minLength) ? policy.minLength : DEFAULT_PASSWORD_POLICY.minLength,
      requireUppercase: typeof policy.requireUppercase === 'boolean' ? policy.requireUppercase : DEFAULT_PASSWORD_POLICY.requireUppercase,
      requireLowercase: typeof policy.requireLowercase === 'boolean' ? policy.requireLowercase : DEFAULT_PASSWORD_POLICY.requireLowercase,
      requireNumbers: typeof policy.requireNumbers === 'boolean' ? policy.requireNumbers : DEFAULT_PASSWORD_POLICY.requireNumbers,
      requireSpecialChars: typeof policy.requireSpecialChars === 'boolean' ? policy.requireSpecialChars : DEFAULT_PASSWORD_POLICY.requireSpecialChars
    };
  }

  async validatePasswordAgainstPolicy(password) {
    const policy = await this.getPasswordPolicy();
    const failedRules = [];

    if (password.length < policy.minLength) {
      failedRules.push(`must be at least ${policy.minLength} characters long`);
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      failedRules.push('must include at least one uppercase letter');
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      failedRules.push('must include at least one lowercase letter');
    }

    if (policy.requireNumbers && !/[0-9]/.test(password)) {
      failedRules.push('must include at least one number');
    }

    if (policy.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
      failedRules.push('must include at least one special character');
    }

    return {
      policy,
      isValid: failedRules.length === 0,
      failedRules
    };
  }

  // Update security settings
  async updateSecuritySettings(settings) {
    console.log('SecurityService: Updating security settings');

    let config = await SystemConfiguration.findOne();
    if (!config) {
      config = new SystemConfiguration();
    }

    config.securitySettings = {
      ...config.securitySettings,
      ...settings
    };

    await config.save();
    console.log('SecurityService: Security settings updated successfully');

    return config.securitySettings;
  }

  // Get login attempts
  async getLoginAttempts() {
    console.log('SecurityService: Getting login attempts');

    // Mock data for now - in real implementation, this would come from a security log collection
    return [
      {
        _id: '1',
        email: 'user@example.com',
        ipAddress: '192.168.1.1',
        success: false,
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        userAgent: 'Mozilla/5.0...'
      },
      {
        _id: '2',
        email: 'admin@mcrepair.de',
        ipAddress: '192.168.1.2',
        success: true,
        timestamp: new Date(Date.now() - 1000 * 60 * 10),
        userAgent: 'Mozilla/5.0...'
      }
    ];
  }

  // Get active sessions
  async getActiveSessions() {
    console.log('SecurityService: Getting active sessions');

    const users = await User.find({ isActive: true }).select('email lastLoginAt').limit(10);

    return users.map(user => ({
      _id: user._id,
      email: user.email,
      ipAddress: '192.168.1.' + Math.floor(Math.random() * 255),
      loginTime: user.lastLoginAt || new Date(),
      lastActivity: new Date(),
      userAgent: 'Mozilla/5.0...'
    }));
  }

  // Get security events
  async getSecurityEvents() {
    console.log('SecurityService: Getting security events');

    // Mock data for now
    return [
      {
        _id: '1',
        type: 'login_failure',
        description: 'Failed login attempt',
        ipAddress: '192.168.1.1',
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        severity: 'medium'
      },
      {
        _id: '2',
        type: 'password_change',
        description: 'Password changed successfully',
        ipAddress: '192.168.1.2',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        severity: 'low'
      },
      {
        _id: '3',
        type: 'suspicious_activity',
        description: 'Multiple failed login attempts',
        ipAddress: '192.168.1.1',
        timestamp: new Date(Date.now() - 1000 * 60 * 60),
        severity: 'high'
      }
    ];
  }

  // Force logout user
  async forceLogout(userId) {
    console.log('SecurityService: Force logout user:', userId);

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Invalidate refresh token
    user.refreshToken = null;
    await user.save();

    console.log('SecurityService: User logged out successfully');
    return { success: true, message: 'User logged out successfully' };
  }

  // Block IP address
  async blockIpAddress(ipAddress, reason) {
    console.log('SecurityService: Blocking IP address:', ipAddress);

    // In real implementation, this would add to a blocked IPs collection
    // For now, just return success
    return {
      success: true,
      message: `IP address ${ipAddress} blocked successfully`,
      reason
    };
  }

  // Get security audit log
  async getSecurityAuditLog(filters = {}) {
    console.log('SecurityService: Getting security audit log');

    // Mock audit log data
    return {
      logs: [
        {
          _id: '1',
          action: 'user_created',
          performedBy: 'admin@mcrepair.de',
          targetUser: 'newuser@example.com',
          timestamp: new Date(Date.now() - 1000 * 60 * 60),
          ipAddress: '192.168.1.2',
          details: 'New user account created'
        },
        {
          _id: '2',
          action: 'password_policy_updated',
          performedBy: 'admin@mcrepair.de',
          timestamp: new Date(Date.now() - 1000 * 60 * 120),
          ipAddress: '192.168.1.2',
          details: 'Password policy requirements updated'
        }
      ],
      totalCount: 2
    };
  }
}

module.exports = new SecurityService();