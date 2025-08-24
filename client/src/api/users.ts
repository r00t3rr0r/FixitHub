import api from './api';

export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: 'customer' | 'staff' | 'admin';
  status: 'active' | 'inactive' | 'suspended';
  lastActivity: string;
  createdAt: string;
  avatar: string;
  totalOrders: number;
  totalSpent: number;
}

export interface CreateUserData {
  name: string;
  email: string;
  phone: string;
  role: 'customer' | 'staff' | 'admin';
  password: string;
  sendWelcomeEmail: boolean;
}

// Description: Get all users with filtering and pagination
// Endpoint: GET /api/admin/users
// Request: { search?: string, role?: string, status?: string, page?: number, limit?: number }
// Response: { users: User[], totalPages: number, currentPage: number, totalUsers: number }
export const getUsers = async (filters: any = {}) => {
  try {
    const response = await api.get('/api/admin/users', { params: filters });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Create a new user
// Endpoint: POST /api/admin/users
// Request: CreateUserData
// Response: { success: boolean, message: string, user: User }
export const createUser = async (userData: CreateUserData) => {
  try {
    const response = await api.post('/api/admin/users', userData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Update user role
// Endpoint: PUT /api/admin/users/:id/role
// Request: { role: string }
// Response: { success: boolean, message: string, user: User }
export const updateUserRole = async (userId: string, role: string) => {
  try {
    const response = await api.put(`/api/admin/users/${userId}/role`, { role });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Update user status
// Endpoint: PUT /api/admin/users/:id/status
// Request: { status: string }
// Response: { success: boolean, message: string, user: User }
export const updateUserStatus = async (userId: string, status: string) => {
  try {
    const response = await api.put(`/api/admin/users/${userId}/status`, { status });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Bulk update user status
// Endpoint: PUT /api/admin/users/bulk-status
// Request: { userIds: string[], status: string }
// Response: { success: boolean, message: string, updatedCount: number }
export const bulkUpdateUserStatus = async (userIds: string[], status: string) => {
  try {
    const response = await api.put('/api/admin/users/bulk-status', { userIds, status });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Delete a user
// Endpoint: DELETE /api/admin/users/:id
// Request: {}
// Response: { success: boolean, message: string }
export const deleteUser = async (userId: string) => {
  try {
    const response = await api.delete(`/api/admin/users/${userId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.message || error.message);
  }
};