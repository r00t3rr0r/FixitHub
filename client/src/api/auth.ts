import api from './api';

interface ApiErrorLike {
  message?: string;
  status?: number;
  statusText?: string;
  data?: {
    message?: string;
    error?: string;
  };
  response?: {
    data?: {
      message?: string;
      error?: string;
    };
    status?: number;
    statusText?: string;
    headers?: unknown;
  };
}

interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

const toErrorMessage = (error: unknown): string => {
  const typedError = error as ApiErrorLike;
  const responseMessage = typedError?.response?.data?.message || typedError?.response?.data?.error;
  if (responseMessage) return responseMessage;

  const directMessage = typedError?.data?.message || typedError?.data?.error;
  if (directMessage) return directMessage;

  const statusCode = typedError?.response?.status ?? typedError?.status;
  if (statusCode) {
    return `Server error (${statusCode}). Please try again.`;
  }

  return typedError?.message || 'Network or server error. Please try again.';
};

// Description: Login user functionality
// Endpoint: POST /api/auth/login
// Request: { email: string, password: string }
// Response: { _id: string, email: string, firstName: string, lastName: string, role: string, accessToken: string, refreshToken: string }
export const login = async (email: string, password: string) => {
  console.log('Making login request with email:', email);

  try {
    const response = await api.post('/api/auth/login', { email, password });
    console.log('Login response received:', response.data);
    return response.data;
  } catch (error) {
    const typedError = error as ApiErrorLike;
    console.error('Login error details:', {
      message: typedError.message,
      response: typedError.response?.data,
      status: typedError.response?.status,
      headers: typedError.response?.headers
    });
    throw new Error(toErrorMessage(error));
  }
};

// Description: Register user functionality
// Endpoint: POST /api/auth/register
// Request: { email: string, password: string, firstName?: string, lastName?: string, phone?: string }
// Response: { success: boolean, message: string, user: object }
export const register = async (email: string, password: string, firstName?: string, lastName?: string, phone?: string) => {
  console.log('Making register request with email:', email);
  
  try {
    const response = await api.post('/api/auth/register', {
      email, 
      password,
      firstName: firstName || '',
      lastName: lastName || '',
      phone: phone || ''
    });
    console.log('Register response received:', response.data);
    return response.data;
  } catch (error) {
    const typedError = error as ApiErrorLike;
    console.error('Register error details:', {
      message: typedError.message,
      response: typedError.response?.data,
      status: typedError.response?.status
    });
    throw new Error(toErrorMessage(error));
  }
};

// Description: Logout
// Endpoint: POST /api/auth/logout
// Request: {}
// Response: { success: boolean, message: string }
export const logout = async () => {
  console.log('Making logout request');
  
  try {
    const response = await api.post('/api/auth/logout');
    console.log('Logout response received:', response.data);
    return response.data;
  } catch (error) {
    console.error('Logout error:', error);
    throw new Error(toErrorMessage(error));
  }
};

export const getCurrentUser = async () => {
  try {
    const response = await api.get('/api/auth/me');
    return response.data;
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
};

export const forgotPassword = async (email: string) => {
  try {
    const response = await api.post('/api/auth/forgot-password', { email });
    return response.data;
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
};

export const resetPassword = async (token: string, newPassword: string, confirmPassword: string) => {
  try {
    const response = await api.post('/api/auth/reset-password', {
      token,
      newPassword,
      confirmPassword
    });
    return response.data;
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
};

export const getPasswordPolicy = async (): Promise<PasswordPolicy> => {
  try {
    const response = await api.get('/api/auth/password-policy');
    return response.data.passwordPolicy;
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
};