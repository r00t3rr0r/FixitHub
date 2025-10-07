import api from './api';

export interface SecuritySettings {
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
  sessionTimeout: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  enableTwoFactor: boolean;
}

export interface LoginAttempt {
  _id: string;
  email: string;
  ipAddress: string;
  success: boolean;
  timestamp: string;
  userAgent: string;
}

export interface ActiveSession {
  _id: string;
  email: string;
  ipAddress: string;
  loginTime: string;
  lastActivity: string;
  userAgent: string;
}

export interface SecurityEvent {
  _id: string;
  type: string;
  description: string;
  ipAddress: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
}

export interface AuditLogEntry {
  _id: string;
  action: string;
  performedBy: string;
  targetUser?: string;
  timestamp: string;
  ipAddress: string;
  details: string;
}

// Description: Get security settings
// Endpoint: GET /api/security/settings
// Request: {}
// Response: { success: boolean, settings: SecuritySettings & { loginAttempts: LoginAttempt[], activeSessions: ActiveSession[], securityEvents: SecurityEvent[] } }
export const getSecuritySettings = async () => {
  try {
    return await api.get('/api/security/settings');
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update security settings
// Endpoint: PUT /api/security/settings
// Request: Partial<SecuritySettings>
// Response: { success: boolean, settings: SecuritySettings, message: string }
export const updateSecuritySettings = async (settings: Partial<SecuritySettings>) => {
  try {
    return await api.put('/api/security/settings', settings);
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get login attempts
// Endpoint: GET /api/security/login-attempts
// Request: {}
// Response: { success: boolean, attempts: LoginAttempt[] }
export const getLoginAttempts = async () => {
  try {
    return await api.get('/api/security/login-attempts');
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get active sessions
// Endpoint: GET /api/security/sessions
// Request: {}
// Response: { success: boolean, sessions: ActiveSession[] }
export const getActiveSessions = async () => {
  try {
    return await api.get('/api/security/sessions');
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Force logout user
// Endpoint: POST /api/security/logout/:userId
// Request: {}
// Response: { success: boolean, message: string }
export const forceLogoutUser = async (userId: string) => {
  try {
    return await api.post(`/api/security/logout/${userId}`);
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Block IP address
// Endpoint: POST /api/security/block-ip
// Request: { ipAddress: string, reason?: string }
// Response: { success: boolean, message: string }
export const blockIpAddress = async (ipAddress: string, reason?: string) => {
  try {
    return await api.post('/api/security/block-ip', { ipAddress, reason });
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get security audit log
// Endpoint: GET /api/security/audit-log
// Request: { page?: number, limit?: number }
// Response: { success: boolean, logs: AuditLogEntry[], totalCount: number }
export const getSecurityAuditLog = async (params = {}) => {
  try {
    return await api.get('/api/security/audit-log', { params });
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};