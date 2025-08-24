import api from './api';

// Description: Login user functionality
// Endpoint: POST /api/auth/login
// Request: { email: string, password: string }
// Response: { accessToken: string, refreshToken: string }
export const login = async (email: string, password: string) => {
  console.log('Making login request with email:', email);
  
  try {
    const response = await api.post('/api/auth/login', { email, password });
    console.log('Login response received:', response.data);
    return response.data;
  } catch (error) {
    console.error('Login error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers
    });
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Register user functionality
// Endpoint: POST /api/auth/register
// Request: { email: string, password: string }
// Response: { email: string }
export const register = async (email: string, password: string) => {
  console.log('Making register request with email:', email);
  
  try {
    const response = await api.post('/api/auth/register', {email, password});
    console.log('Register response received:', response.data);
    return response.data;
  } catch (error) {
    console.error('Register error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw new Error(error?.response?.data?.message || error.message);
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
    throw new Error(error?.response?.data?.message || error.message);
  }
};