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
export const getUsers = (filters: any = {}) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        users: [
          {
            _id: 'user1',
            name: 'John Doe',
            email: 'john.doe@example.com',
            phone: '+1 (555) 123-4567',
            role: 'customer',
            status: 'active',
            lastActivity: '2024-01-15T10:30:00Z',
            createdAt: '2023-06-15T10:30:00Z',
            avatar: 'https://via.placeholder.com/50x50/3b82f6/ffffff?text=JD',
            totalOrders: 8,
            totalSpent: 1247.50
          },
          {
            _id: 'user2',
            name: 'Sarah Johnson',
            email: 'sarah.johnson@example.com',
            phone: '+1 (555) 234-5678',
            role: 'staff',
            status: 'active',
            lastActivity: '2024-01-15T14:20:00Z',
            createdAt: '2023-08-20T09:15:00Z',
            avatar: 'https://via.placeholder.com/50x50/10b981/ffffff?text=SJ',
            totalOrders: 0,
            totalSpent: 0
          },
          {
            _id: 'user3',
            name: 'Mike Chen',
            email: 'mike.chen@example.com',
            phone: '+1 (555) 345-6789',
            role: 'admin',
            status: 'active',
            lastActivity: '2024-01-15T16:45:00Z',
            createdAt: '2023-05-10T11:00:00Z',
            avatar: 'https://via.placeholder.com/50x50/8b5cf6/ffffff?text=MC',
            totalOrders: 0,
            totalSpent: 0
          },
          {
            _id: 'user4',
            name: 'Emily Davis',
            email: 'emily.davis@example.com',
            phone: '+1 (555) 456-7890',
            role: 'customer',
            status: 'inactive',
            lastActivity: '2024-01-10T08:15:00Z',
            createdAt: '2023-12-01T14:30:00Z',
            avatar: 'https://via.placeholder.com/50x50/f59e0b/ffffff?text=ED',
            totalOrders: 3,
            totalSpent: 450.00
          }
        ],
        totalPages: 1,
        currentPage: 1,
        totalUsers: 4
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.get('/api/admin/users', { params: filters });
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};

// Description: Create a new user
// Endpoint: POST /api/admin/users
// Request: CreateUserData
// Response: { success: boolean, message: string, user: User }
export const createUser = (userData: CreateUserData) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'User created successfully',
        user: {
          _id: 'user' + Math.random().toString(36).substr(2, 9),
          name: userData.name,
          email: userData.email,
          phone: userData.phone,
          role: userData.role,
          status: 'active',
          lastActivity: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          avatar: 'https://via.placeholder.com/50x50/6b7280/ffffff?text=' + userData.name.charAt(0),
          totalOrders: 0,
          totalSpent: 0
        }
      });
    }, 1000);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.post('/api/admin/users', userData);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};

// Description: Update user role
// Endpoint: PUT /api/admin/users/:id/role
// Request: { role: string }
// Response: { success: boolean, message: string, user: User }
export const updateUserRole = (userId: string, role: string) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'User role updated successfully',
        user: {
          _id: userId,
          role: role
        }
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.put(`/api/admin/users/${userId}/role`, { role });
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};

// Description: Update user status
// Endpoint: PUT /api/admin/users/:id/status
// Request: { status: string }
// Response: { success: boolean, message: string, user: User }
export const updateUserStatus = (userId: string, status: string) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'User status updated successfully',
        user: {
          _id: userId,
          status: status
        }
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.put(`/api/admin/users/${userId}/status`, { status });
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};

// Description: Bulk update user status
// Endpoint: PUT /api/admin/users/bulk-status
// Request: { userIds: string[], status: string }
// Response: { success: boolean, message: string, updatedCount: number }
export const bulkUpdateUserStatus = (userIds: string[], status: string) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: `${userIds.length} users updated successfully`,
        updatedCount: userIds.length
      });
    }, 800);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.put('/api/admin/users/bulk-status', { userIds, status });
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};