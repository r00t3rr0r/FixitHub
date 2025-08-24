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
// Endpoint: GET /api/user/profile
// Request: {}
// Response: { user: UserProfile }
export const getUserProfile = () => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
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

      // Split name into first and last name
      const nameParts = name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      resolve({
        user: {
          _id: 'user1',
          firstName: firstName,
          lastName: lastName,
          name: name,
          email: email,
          phone: '+1 (555) 123-4567',
          role: role,
          invoiceAddress: {
            street: '123 Main Street',
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            country: 'United States'
          },
          paymentAddress: {
            street: '123 Main Street',
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            country: 'United States',
            sameAsInvoice: true
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
// Request: { firstName?: string, lastName?: string, phone?: string, invoiceAddress?: object, paymentAddress?: object, preferences?: object }
// Response: { success: boolean, message: string, user: UserProfile }
export const updateUserProfile = (profileData: any) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      const fullName = `${profileData.firstName || 'John'} ${profileData.lastName || 'Doe'}`.trim();
      
      resolve({
        success: true,
        message: 'Profile updated successfully',
        user: {
          _id: 'user1',
          firstName: profileData.firstName || 'John',
          lastName: profileData.lastName || 'Doe',
          name: fullName,
          email: 'john.doe@example.com',
          phone: profileData.phone || '+1 (555) 123-4567',
          role: 'customer',
          invoiceAddress: profileData.invoiceAddress || {
            street: '123 Main Street',
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            country: 'United States'
          },
          paymentAddress: profileData.paymentAddress || {
            street: '123 Main Street',
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            country: 'United States',
            sameAsInvoice: true
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
// Request: FormData with file
// Response: { success: boolean, message: string, avatarUrl: string }
export const uploadAvatar = (file: File) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      // Create a mock URL for the uploaded avatar
      const mockAvatarUrl = URL.createObjectURL(file);
      resolve({
        success: true,
        message: 'Avatar uploaded successfully',
        avatarUrl: mockAvatarUrl
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