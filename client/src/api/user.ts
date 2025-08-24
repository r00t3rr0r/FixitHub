import api from './api';

export interface UserProfile {
  _id: string;
  firstName: string;
  lastName: string;
  name: string; // Keep for backward compatibility
  email: string;
  phone: string;
  role: 'customer' | 'staff' | 'admin';
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
  avatar: string;
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
  createdAt: string;
  totalOrders: number;
  totalSpent: number;
}

// Description: Get user profile
// Endpoint: GET /api/users/me
// Request: {}
// Response: { user: UserProfile }
export const getUserProfile = async () => {
  try {
    console.log('Making API call to get user profile');
    const response = await api.get('/api/users/me');
    console.log('User profile response received:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Update user profile
// Endpoint: PUT /api/users/me
// Request: { firstName?: string, lastName?: string, phone?: string, invoiceAddress?: object, paymentAddress?: object, preferences?: object }
// Response: { success: boolean, message: string, user: UserProfile }
export const updateUserProfile = async (profileData: any) => {
  try {
    console.log('Making API call to update user profile:', profileData);
    const response = await api.put('/api/users/me', profileData);
    console.log('User profile update response received:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Upload user avatar
// Endpoint: POST /api/users/avatar
// Request: FormData with file
// Response: { success: boolean, message: string, avatarUrl: string }
export const uploadAvatar = async (file: File) => {
  try {
    console.log('Making API call to upload avatar');
    const formData = new FormData();
    formData.append('avatar', file);
    
    const response = await api.post('/api/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    console.log('Avatar upload response received:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error uploading avatar:', error);
    throw new Error(error?.response?.data?.message || error.message);
  }
};