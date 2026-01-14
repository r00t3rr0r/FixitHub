import api from './api';

export interface User {
  _id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  role: 'customer' | 'staff' | 'admin';
  avatar: string;
  isActive: boolean;
  createdAt: string;
  totalOrders: number;
  totalSpent: number;
  // Customer-specific fields
  customerNumber?: string;
  customerGroup?: string;
  salutation?: string;
  title?: string;
  company?: string;
  addressAddition?: string;
  customerOrigin?: string;
  postId?: string;
  newsletter?: boolean;
  comment?: string;
  paymentMethod?: string;
  paymentTerms?: string;
  internalKey?: string;
  status?: string;
  discount?: number;
}

export interface CreateUserData {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: 'customer' | 'staff' | 'admin';
  sendWelcomeEmail?: boolean;
}

export interface GetUsersParams {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface GetUsersResponse {
  users: User[];
  totalPages: number;
  currentPage: number;
  totalUsers: number;
}

// Description: Create a new user (admin only)
// Endpoint: POST /api/admin/users
// Request: { name: string, email: string, phone: string, password: string, role: string, sendWelcomeEmail?: boolean }
// Response: { success: boolean, user: User, message: string }
export const createUser = async (userData: CreateUserData) => {
  console.log('createUser called with data:', userData);

  // Ensure role is included - default to 'customer' if not specified
  const userDataWithRole = {
    ...userData,
    role: userData.role || 'customer'
  };

  try {
    const response = await api.post('/api/admin/users', userDataWithRole);
    console.log('createUser API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('createUser API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get all users with pagination and filtering (admin only)
// Endpoint: GET /api/admin/users
// Request: { search?: string, role?: string, status?: string, page?: number, limit?: number }
// Response: { users: User[], totalPages: number, currentPage: number, totalUsers: number }
export const getUsers = async (params: GetUsersParams = {}): Promise<GetUsersResponse> => {
  console.log('getUsers called with params:', params);

  try {
    const response = await api.get('/api/admin/users', { params });
    console.log('getUsers API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('getUsers API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update user details (admin only)
// Endpoint: PUT /api/admin/users/:id
// Request: { name?: string, email?: string, phone?: string, role?: string, isActive?: boolean }
// Response: { success: boolean, user: User, message: string }
export const updateUser = async (userId: string, userData: Partial<User>) => {
  console.log('updateUser called with ID:', userId, 'and data:', userData);

  try {
    const response = await api.put(`/api/admin/users/${userId}`, userData);
    console.log('updateUser API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('updateUser API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update user role (admin only)
// Endpoint: PUT /api/admin/users/:id
// Request: { role: string }
// Response: { success: boolean, user: User, message: string }
export const updateUserRole = async (userId: string, role: string) => {
  console.log('updateUserRole called with ID:', userId, 'and role:', role);

  try {
    const response = await api.put(`/api/admin/users/${userId}`, { role });
    console.log('updateUserRole API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('updateUserRole API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update user status (admin only)
// Endpoint: PUT /api/admin/users/:id/status
// Request: { status: string }
// Response: { success: boolean, user: User, message: string }
export const updateUserStatus = async (userId: string, status: string) => {
  console.log('updateUserStatus called with ID:', userId, 'and status:', status);

  try {
    const response = await api.put(`/api/admin/users/${userId}/status`, { status });
    console.log('updateUserStatus API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('updateUserStatus API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Bulk update user status (admin only)
// Endpoint: PUT /api/admin/users/bulk-status
// Request: { userIds: string[], status: string }
// Response: { success: boolean, message: string }
export const bulkUpdateUserStatus = async (userIds: string[], status: string) => {
  console.log('bulkUpdateUserStatus called with IDs:', userIds, 'and status:', status);

  const isActive = status === 'active';

  try {
    const response = await api.put('/api/admin/users/bulk-status', { userIds, isActive });
    console.log('bulkUpdateUserStatus API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('bulkUpdateUserStatus API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete user (admin only)
// Endpoint: DELETE /api/admin/users/:id
// Request: {}
// Response: { success: boolean, message: string }
export const deleteUser = async (userId: string) => {
  console.log('deleteUser called with ID:', userId);

  try {
    const response = await api.delete(`/api/admin/users/${userId}`);
    console.log('deleteUser API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('deleteUser API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export interface DetailedUser extends User {
  firstName: string;
  lastName: string;
  invoiceAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  paymentAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    sameAsInvoice: boolean;
  };
  preferences: {
    notifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
    communication: {
      orderUpdates: boolean;
      promotions: boolean;
      newsletter: boolean;
    };
  };
  department?: string;
  specializations?: string[];
  addOnCapabilities?: string[];
  employmentStartDate?: string;
  employmentEndDate?: string;
  skills?: Array<{
    name: string;
    level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  }>;
  orders: Array<{
    _id: string;
    orderNumber: string;
    status: string;
    totalCost: number;
    createdAt: string;
    deviceBrand: string;
    deviceModel: string;
  }>;
  orderStats: {
    totalOrders: number;
    totalSpent: number;
    avgOrderValue: number;
    completedOrders: number;
    pendingOrders: number;
    inProgressOrders: number;
  };
  paymentHistory: Array<{
    _id: string;
    orderId: string;
    amount: number;
    status: string;
    method: string;
    createdAt: string;
    transactionId: string;
  }>;
  customerGroup: string;
  activityLog: Array<{
    _id: string;
    action: string;
    description: string;
    ipAddress: string;
    userAgent: string;
    timestamp: string;
  }>;
  lastActivity: string;
}

// Description: Get detailed user information (admin only)
// Endpoint: GET /api/admin/users/:id/details
// Request: {}
// Response: { success: boolean, user: DetailedUser }
export const getUserDetails = async (userId: string) => {
  console.log('getUserDetails called with ID:', userId);

  try {
    const response = await api.get(`/api/admin/users/${userId}/details`);
    console.log('getUserDetails API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('getUserDetails API error:', error);
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Export users to CSV file (admin only)
// Endpoint: GET /api/admin/users/export/csv
// Request: { userIds?: string[], filters?: { search?: string, role?: string, status?: string } }
// Response: CSV file as blob
export const exportUsersToCSV = async (userIds?: string[], filters?: any) => {
  console.log('exportUsersToCSV called with userIds:', userIds, 'and filters:', filters);

  try {
    const params = new URLSearchParams();
    if (userIds && userIds.length > 0) {
      params.append('userIds', JSON.stringify(userIds));
    }
    if (filters) {
      if (filters.search) params.append('search', filters.search);
      if (filters.role) params.append('role', filters.role);
      if (filters.status) params.append('status', filters.status);
    }

    const response = await api.get(`/api/admin/users/export/csv?${params.toString()}`, {
      responseType: 'blob'
    });

    console.log('exportUsersToCSV API response received');

    // Create a download link for the CSV file
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `users_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);

    return { success: true, message: 'CSV export completed' };
  } catch (error) {
    console.error('exportUsersToCSV API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
