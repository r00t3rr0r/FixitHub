import api from './api';

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: 'customer' | 'staff' | 'admin';
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
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
// Endpoint: GET /api/user/profile
// Request: {}
// Response: { user: UserProfile }
export const getUserProfile = () => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      // Try to determine user role from stored token or other means
      // Since we can't modify auth files, we'll use a simple approach
      // Check if there's any way to determine the current user
      
      // For now, we'll create a simple mechanism to store user info
      const storedUserRole = localStorage.getItem('currentUserRole') || 'customer';
      const storedUserEmail = localStorage.getItem('currentUserEmail') || 'customer@example.com';
      const storedUserName = localStorage.getItem('currentUserName') || 'John Doe';
      
      let role = storedUserRole;
      let name = storedUserName;
      let email = storedUserEmail;
      let avatar = 'https://via.placeholder.com/150x150/3b82f6/ffffff?text=JD';
      
      // Set avatar based on role
      if (role === 'admin') {
        avatar = 'https://via.placeholder.com/150x150/ef4444/ffffff?text=AU';
      } else if (role === 'staff') {
        avatar = 'https://via.placeholder.com/150x150/3b82f6/ffffff?text=SM';
      }

      resolve({
        user: {
          _id: 'user1',
          name: name,
          email: email,
          phone: '+1 (555) 123-4567',
          role: role, // This will now be dynamic based on the stored user role
          address: {
            street: '123 Main Street',
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            country: 'United States'
          },
          avatar: avatar,
          preferences: {
            notifications: {
              email: true,
              sms: true,
              push: true
            },
            communication: {
              orderUpdates: true,
              promotions: false,
              newsletter: true
            }
          },
          createdAt: '2023-06-15T10:30:00Z',
          totalOrders: role === 'customer' ? 8 : 0,
          totalSpent: role === 'customer' ? 1247.50 : 0
        }
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.get('/api/user/profile');
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};

// Description: Update user profile
// Endpoint: PUT /api/user/profile
// Request: { name?: string, phone?: string, address?: object, preferences?: object }
// Response: { success: boolean, message: string, user: UserProfile }
export const updateUserProfile = (profileData: any) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Profile updated successfully',
        user: {
          _id: 'user1',
          name: profileData.name || 'John Doe',
          email: 'john.doe@example.com',
          phone: profileData.phone || '+1 (555) 123-4567',
          role: 'customer',
          address: profileData.address || {
            street: '123 Main Street',
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            country: 'United States'
          },
          avatar: 'https://via.placeholder.com/150x150/3b82f6/ffffff?text=JD',
          preferences: profileData.preferences || {
            notifications: {
              email: true,
              sms: true,
              push: true
            },
            communication: {
              orderUpdates: true,
              promotions: false,
              newsletter: true
            }
          },
          createdAt: '2023-06-15T10:30:00Z',
          totalOrders: 8,
          totalSpent: 1247.50
        }
      });
    }, 800);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.put('/api/user/profile', profileData);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};

// Description: Upload user avatar
// Endpoint: POST /api/user/avatar
// Request: FormData with avatar file
// Response: { success: boolean, message: string, avatarUrl: string }
export const uploadAvatar = (file: File) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Avatar uploaded successfully',
        avatarUrl: 'https://via.placeholder.com/150x150/3b82f6/ffffff?text=JD'
      });
    }, 1000);
  });
  // Uncomment the below lines to make an actual API call
  // const formData = new FormData();
  // formData.append('avatar', file);
  // try {
  //   return await api.post('/api/user/avatar', formData, {
  //     headers: { 'Content-Type': 'multipart/form-data' }
  //   });
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};