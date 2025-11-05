import api from './api';

export interface StaffMember {
  _id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  specializations: string[];
}

export interface AdminOrder {
  _id: string;
  orderNumber: string;
  customerId: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    avatar: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    paymentMethods?: {
      type: string;
      last4: string;
      expiryMonth: number;
      expiryYear: number;
      isDefault: boolean;
    }[];
    isActive: boolean;
    role: string;
    createdAt: string;
  };
  deviceBrand: string;
  deviceModel: string;
  deviceType: string;
  services: string[];
  addOns: {
    _id: string;
    name: string;
    description: string;
    price: number;
    status: string;
    estimatedTime: string;
  }[];
  status: 'pending' | 'in-progress' | 'quality-check' | 'completed' | 'ready-for-pickup' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assignedStaff: {
    _id: string;
    name: string;
    avatar: string;
  }[];
  estimatedCompletion: string;
  totalCost: number;
  photos: string[];
  customerNotes: string;
  staffNotes: {
    _id: string;
    staffId: string;
    staffName: string;
    note: string;
    type: string;
    createdAt: string;
  }[];
  progress: number;
  timeline: {
    _id: string;
    status: string;
    description: string;
    completedAt: string;
    staffId: string;
    staffName: string;
  }[];
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'partial';
  createdAt: string;
}

// Description: Get all orders for admin/staff
// Endpoint: GET /api/admin/orders
// Request: { search?: string, status?: string, priority?: string }
// Response: { orders: AdminOrder[], totalPages: number, currentPage: number, totalOrders: number }
export const getAdminOrders = async (filters: any = {}) => {
  console.log('getAdminOrders called with filters:', filters);
  try {
    const params = new URLSearchParams();

    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.deviceType) params.append('deviceType', filters.deviceType);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    if (filters.assignedStaff) params.append('assignedStaff', filters.assignedStaff);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const queryString = params.toString();
    const url = queryString ? `/api/admin/orders?${queryString}` : '/api/admin/orders';

    const response = await api.get(url);
    console.log('getAdminOrders API response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('getAdminOrders API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }

  // OLD MOCKED DATA - REMOVED
  /* return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        orders: [
          {
            _id: 'order1',
            orderNumber: 'ORD-2024-001',
            customerId: {
              _id: 'customer1',
              name: 'John Smith',
              email: 'john.smith@example.com',
              phone: '+1 (555) 123-4567',
              avatar: 'https://via.placeholder.com/100x100/3b82f6/ffffff?text=JS',
              address: {
                street: '123 Main St',
                city: 'New York',
                state: 'NY',
                zipCode: '10001',
                country: 'USA'
              },
              paymentMethods: [{
                type: 'visa',
                last4: '4242',
                expiryMonth: 12,
                expiryYear: 2025,
                isDefault: true
              }],
              isActive: true,
              role: 'customer',
              createdAt: '2024-01-01T00:00:00Z'
            },
            deviceBrand: 'Apple',
            deviceModel: 'iPhone 14 Pro',
            deviceType: 'Smartphone',
            services: ['Screen Replacement', 'Battery Replacement'],
            addOns: [{
              _id: 'addon1',
              name: 'Screen Protector',
              description: 'Premium tempered glass screen protector',
              price: 25,
              status: 'pending',
              estimatedTime: '15 minutes'
            }],
            status: 'pending',
            priority: 'normal',
            assignedStaff: [],
            estimatedCompletion: '2024-01-20T17:00:00Z',
            totalCost: 299,
            photos: ['https://via.placeholder.com/400x300/f3f4f6/374151?text=Device+Photo'],
            customerNotes: 'Screen cracked after dropping the phone',
            staffNotes: [],
            progress: 0,
            timeline: [{
              _id: 'timeline1',
              status: 'Order Received',
              description: 'Order placed by customer',
              completedAt: '2024-01-15T10:00:00Z',
              staffId: 'system',
              staffName: 'System'
            }],
            paymentStatus: 'pending',
            createdAt: '2024-01-15T10:00:00Z'
          },
          {
            _id: 'order2',
            orderNumber: 'ORD-2024-002',
            customerId: {
              _id: 'customer2',
              name: 'Sarah Johnson',
              email: 'sarah.johnson@example.com',
              phone: '+1 (555) 234-5678',
              avatar: 'https://via.placeholder.com/100x100/10b981/ffffff?text=SJ',
              isActive: true,
              role: 'customer',
              createdAt: '2024-01-02T00:00:00Z'
            },
            deviceBrand: 'Samsung',
            deviceModel: 'Galaxy S23',
            deviceType: 'Smartphone',
            services: ['Water Damage Repair'],
            addOns: [],
            status: 'in-progress',
            priority: 'high',
            assignedStaff: [{
              _id: 'staff1',
              name: 'Mike Chen',
              avatar: 'https://via.placeholder.com/100x100/3b82f6/ffffff?text=MC'
            }],
            estimatedCompletion: '2024-01-18T15:00:00Z',
            totalCost: 199,
            photos: [],
            customerNotes: 'Phone got wet in the rain',
            staffNotes: [{
              _id: 'note1',
              staffId: 'staff1',
              staffName: 'Mike Chen',
              note: 'Initial assessment completed. Water damage is moderate.',
              type: 'technical',
              createdAt: '2024-01-16T09:00:00Z'
            }],
            progress: 45,
            timeline: [
              {
                _id: 'timeline2',
                status: 'Order Received',
                description: 'Order placed by customer',
                completedAt: '2024-01-15T14:00:00Z',
                staffId: 'system',
                staffName: 'System'
              },
              {
                _id: 'timeline3',
                status: 'In Progress',
                description: 'Repair work started',
                completedAt: '2024-01-16T09:00:00Z',
                staffId: 'staff1',
                staffName: 'Mike Chen'
              }
            ],
            paymentStatus: 'paid',
            createdAt: '2024-01-15T14:00:00Z'
          }
        ],
        totalPages: 1,
        currentPage: 1,
        totalOrders: 2
      });
    }, 500);
  }); */
};

// Description: Update order status
// Endpoint: PUT /api/admin/orders/:id/status
// Request: { status: string, note?: string }
// Response: { success: boolean, message: string, order: AdminOrder }
export const updateOrderStatus = async (orderId: string, status: string, note?: string) => {
  console.log('updateOrderStatus called:', { orderId, status, note });
  try {
    const response = await api.put(`/api/admin/orders/${orderId}/status`, { status, note });
    console.log('updateOrderStatus API response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('updateOrderStatus API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get available staff members for assignment
// Endpoint: GET /api/admin/staff
// Request: {}
// Response: { staff: StaffMember[] }
export const getAvailableStaff = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        staff: [
          {
            _id: 'staff1',
            name: 'Mike Chen',
            email: 'mike.chen@fixithub.com',
            avatar: 'https://via.placeholder.com/100x100/3b82f6/ffffff?text=MC',
            role: 'staff',
            specializations: ['Samsung Repair', 'Water Damage', 'Advanced Diagnostics']
          },
          {
            _id: 'staff2',
            name: 'Sarah Johnson',
            email: 'sarah.johnson@fixithub.com',
            avatar: 'https://via.placeholder.com/100x100/10b981/ffffff?text=SJ',
            role: 'staff',
            specializations: ['iPhone Repair', 'Screen Replacement', 'Battery Replacement']
          },
          {
            _id: 'staff3',
            name: 'Emily Rodriguez',
            email: 'emily.rodriguez@fixithub.com',
            avatar: 'https://via.placeholder.com/100x100/8b5cf6/ffffff?text=ER',
            role: 'staff',
            specializations: ['Google Pixel Repair', 'Camera Repair', 'Software Issues']
          },
          {
            _id: 'staff4',
            name: 'David Wilson',
            email: 'david.wilson@fixithub.com',
            avatar: 'https://via.placeholder.com/100x100/f59e0b/ffffff?text=DW',
            role: 'staff',
            specializations: ['Tablet Repair', 'Laptop Repair', 'Hardware Diagnostics']
          }
        ]
      });
    }, 300);
  });
};

// Description: Assign staff to order
// Endpoint: PUT /api/admin/orders/:id/assign
// Request: { staffIds: string[] }
// Response: { success: boolean, message: string }
export const assignStaffToOrder = async (orderId: string, staffIds: string[]) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Staff assigned successfully'
      });
    }, 800);
  });
  
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.put(`/api/admin/orders/${orderId}/assign`, { staffIds });
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Add note to order
// Endpoint: POST /api/admin/orders/:id/notes
// Request: { note: string, type?: string }
// Response: { success: boolean, message: string, note: object }
export const addNoteToOrder = async (orderId: string, note: string, type: string = 'general') => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Note added successfully',
        note: {
          _id: 'note_' + Date.now(),
          staffId: 'current_staff',
          staffName: 'Current Staff',
          note,
          type,
          createdAt: new Date().toISOString()
        }
      });
    }, 500);
  });

  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.post(`/api/admin/orders/${orderId}/notes`, { note, type });
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Get order by ID for admin/staff
// Endpoint: GET /api/admin/orders/:id
// Request: {}
// Response: { order: AdminOrder }
export const getAdminOrderById = async (orderId: string) => {
  console.log('getAdminOrderById called with ID:', orderId);
  try {
    const response = await api.get(`/api/admin/orders/${orderId}`);
    console.log('getAdminOrderById API response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('getAdminOrderById API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};