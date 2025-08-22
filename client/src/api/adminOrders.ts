import api from './api';

export interface AdminOrder {
  _id: string;
  orderNumber: string;
  customer: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    avatar: string;
  };
  deviceBrand: string;
  deviceModel: string;
  services: string[];
  addOns: AdminAddOnService[];
  status: 'pending' | 'in-progress' | 'quality-check' | 'completed' | 'ready-for-pickup' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assignedStaff: {
    _id: string;
    name: string;
    avatar: string;
  }[];
  estimatedCompletion: string;
  actualCompletion?: string;
  totalCost: number;
  createdAt: string;
  updatedAt: string;
  photos: string[];
  customerNotes: string;
  staffNotes: AdminStaffNote[];
  progress: number;
  timeline: AdminOrderTimeline[];
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'partial';
  deviceType: string;
}

export interface AdminAddOnService {
  _id: string;
  name: string;
  description: string;
  price: number;
  status: 'pending' | 'in-progress' | 'completed';
  estimatedTime: string;
  completedAt?: string;
  qualityPhotos: string[];
  progress: number;
}

export interface AdminStaffNote {
  _id: string;
  staffId: string;
  staffName: string;
  note: string;
  createdAt: string;
  type: 'general' | 'technical' | 'customer' | 'internal';
}

export interface AdminOrderTimeline {
  _id: string;
  status: string;
  description: string;
  completedAt: string;
  staffId: string;
  staffName: string;
  photos?: string[];
}

// Description: Get all orders for admin management
// Endpoint: GET /api/admin/orders
// Request: { search?: string, status?: string, priority?: string, deviceType?: string, dateFrom?: string, dateTo?: string, assignedStaff?: string, page?: number, limit?: number }
// Response: { orders: AdminOrder[], totalPages: number, currentPage: number, totalOrders: number, stats: object }
export const getAdminOrders = (filters: any = {}) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        orders: [
          {
            _id: 'order1',
            orderNumber: 'ORD-2024-001',
            customer: {
              _id: 'customer1',
              name: 'John Doe',
              email: 'john.doe@example.com',
              phone: '+1 (555) 123-4567',
              avatar: 'https://via.placeholder.com/50x50/3b82f6/ffffff?text=JD'
            },
            deviceBrand: 'Apple',
            deviceModel: 'iPhone 15 Pro',
            deviceType: 'Smartphone',
            services: ['Screen Replacement', 'Battery Replacement'],
            addOns: [
              {
                _id: 'addon1',
                name: 'Screen Protector',
                description: 'Premium tempered glass protection',
                price: 25,
                status: 'completed',
                estimatedTime: '5 minutes',
                completedAt: '2024-01-14T15:30:00Z',
                qualityPhotos: ['https://via.placeholder.com/300x200/10b981/ffffff?text=Screen+Protector'],
                progress: 100
              },
              {
                _id: 'addon2',
                name: 'Phone Case',
                description: 'Protective case with drop protection',
                price: 35,
                status: 'in-progress',
                estimatedTime: '2 minutes',
                qualityPhotos: [],
                progress: 50
              }
            ],
            status: 'in-progress',
            priority: 'high',
            assignedStaff: [
              {
                _id: 'staff1',
                name: 'Sarah Johnson',
                avatar: 'https://via.placeholder.com/50x50/10b981/ffffff?text=SJ'
              }
            ],
            estimatedCompletion: '2024-01-16T17:00:00Z',
            totalCost: 359,
            createdAt: '2024-01-14T09:00:00Z',
            updatedAt: '2024-01-15T14:30:00Z',
            photos: ['https://via.placeholder.com/400x300/3b82f6/ffffff?text=iPhone+15+Pro'],
            customerNotes: 'Phone dropped, screen cracked and battery draining fast',
            staffNotes: [
              {
                _id: 'note1',
                staffId: 'staff1',
                staffName: 'Sarah Johnson',
                note: 'Diagnostic completed. Screen and battery both need replacement.',
                createdAt: '2024-01-14T10:30:00Z',
                type: 'technical'
              },
              {
                _id: 'note2',
                staffId: 'staff1',
                staffName: 'Sarah Johnson',
                note: 'Parts ordered and received. Starting repair process.',
                createdAt: '2024-01-15T09:00:00Z',
                type: 'general'
              }
            ],
            progress: 65,
            timeline: [
              {
                _id: 'timeline1',
                status: 'Order Received',
                description: 'Order placed by customer',
                completedAt: '2024-01-14T09:00:00Z',
                staffId: 'system',
                staffName: 'System'
              },
              {
                _id: 'timeline2',
                status: 'Diagnostic Complete',
                description: 'Device assessed and repair plan created',
                completedAt: '2024-01-14T10:30:00Z',
                staffId: 'staff1',
                staffName: 'Sarah Johnson',
                photos: ['https://via.placeholder.com/300x200/3b82f6/ffffff?text=Diagnostic']
              },
              {
                _id: 'timeline3',
                status: 'Parts Ordered',
                description: 'Required parts ordered from supplier',
                completedAt: '2024-01-14T11:00:00Z',
                staffId: 'staff1',
                staffName: 'Sarah Johnson'
              },
              {
                _id: 'timeline4',
                status: 'Repair Started',
                description: 'Screen replacement in progress',
                completedAt: '2024-01-15T14:00:00Z',
                staffId: 'staff1',
                staffName: 'Sarah Johnson'
              }
            ],
            paymentStatus: 'paid'
          },
          {
            _id: 'order2',
            orderNumber: 'ORD-2024-002',
            customer: {
              _id: 'customer2',
              name: 'Emily Davis',
              email: 'emily.davis@example.com',
              phone: '+1 (555) 234-5678',
              avatar: 'https://via.placeholder.com/50x50/8b5cf6/ffffff?text=ED'
            },
            deviceBrand: 'Samsung',
            deviceModel: 'Galaxy S24 Ultra',
            deviceType: 'Smartphone',
            services: ['Camera Repair'],
            addOns: [],
            status: 'quality-check',
            priority: 'normal',
            assignedStaff: [
              {
                _id: 'staff2',
                name: 'Mike Chen',
                avatar: 'https://via.placeholder.com/50x50/f59e0b/ffffff?text=MC'
              }
            ],
            estimatedCompletion: '2024-01-15T16:00:00Z',
            totalCost: 149,
            createdAt: '2024-01-13T14:00:00Z',
            updatedAt: '2024-01-15T15:45:00Z',
            photos: ['https://via.placeholder.com/400x300/8b5cf6/ffffff?text=Galaxy+S24'],
            customerNotes: 'Camera not focusing properly, especially in low light',
            staffNotes: [
              {
                _id: 'note3',
                staffId: 'staff2',
                staffName: 'Mike Chen',
                note: 'Camera module replaced successfully. Running quality tests.',
                createdAt: '2024-01-15T15:00:00Z',
                type: 'technical'
              }
            ],
            progress: 90,
            timeline: [
              {
                _id: 'timeline5',
                status: 'Order Received',
                description: 'Order placed by customer',
                completedAt: '2024-01-13T14:00:00Z',
                staffId: 'system',
                staffName: 'System'
              },
              {
                _id: 'timeline6',
                status: 'Repair Complete',
                description: 'Camera module replaced',
                completedAt: '2024-01-15T15:00:00Z',
                staffId: 'staff2',
                staffName: 'Mike Chen',
                photos: ['https://via.placeholder.com/300x200/8b5cf6/ffffff?text=Camera+Fixed']
              }
            ],
            paymentStatus: 'paid'
          }
        ],
        totalPages: 1,
        currentPage: 1,
        totalOrders: 2,
        stats: {
          pending: 0,
          inProgress: 1,
          qualityCheck: 1,
          completed: 0,
          totalRevenue: 508,
          averageCompletionTime: '2.5 days'
        }
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.get('/api/admin/orders', { params: filters });
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};

// Description: Get order details by ID for admin
// Endpoint: GET /api/admin/orders/:id
// Request: {}
// Response: { order: AdminOrder }
export const getAdminOrderById = (orderId: string) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        order: {
          _id: orderId,
          orderNumber: 'ORD-2024-001',
          customer: {
            _id: 'customer1',
            name: 'John Doe',
            email: 'john.doe@example.com',
            phone: '+1 (555) 123-4567',
            avatar: 'https://via.placeholder.com/50x50/3b82f6/ffffff?text=JD'
          },
          deviceBrand: 'Apple',
          deviceModel: 'iPhone 15 Pro',
          deviceType: 'Smartphone',
          services: ['Screen Replacement', 'Battery Replacement'],
          addOns: [
            {
              _id: 'addon1',
              name: 'Screen Protector',
              description: 'Premium tempered glass protection',
              price: 25,
              status: 'completed',
              estimatedTime: '5 minutes',
              completedAt: '2024-01-14T15:30:00Z',
              qualityPhotos: ['https://via.placeholder.com/300x200/10b981/ffffff?text=Screen+Protector'],
              progress: 100
            }
          ],
          status: 'in-progress',
          priority: 'high',
          assignedStaff: [
            {
              _id: 'staff1',
              name: 'Sarah Johnson',
              avatar: 'https://via.placeholder.com/50x50/10b981/ffffff?text=SJ'
            }
          ],
          estimatedCompletion: '2024-01-16T17:00:00Z',
          totalCost: 359,
          createdAt: '2024-01-14T09:00:00Z',
          updatedAt: '2024-01-15T14:30:00Z',
          photos: ['https://via.placeholder.com/400x300/3b82f6/ffffff?text=iPhone+15+Pro'],
          customerNotes: 'Phone dropped, screen cracked and battery draining fast',
          staffNotes: [
            {
              _id: 'note1',
              staffId: 'staff1',
              staffName: 'Sarah Johnson',
              note: 'Diagnostic completed. Screen and battery both need replacement.',
              createdAt: '2024-01-14T10:30:00Z',
              type: 'technical'
            }
          ],
          progress: 65,
          timeline: [
            {
              _id: 'timeline1',
              status: 'Order Received',
              description: 'Order placed by customer',
              completedAt: '2024-01-14T09:00:00Z',
              staffId: 'system',
              staffName: 'System'
            },
            {
              _id: 'timeline2',
              status: 'Diagnostic Complete',
              description: 'Device assessed and repair plan created',
              completedAt: '2024-01-14T10:30:00Z',
              staffId: 'staff1',
              staffName: 'Sarah Johnson',
              photos: ['https://via.placeholder.com/300x200/3b82f6/ffffff?text=Diagnostic']
            }
          ],
          paymentStatus: 'paid'
        }
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.get(`/api/admin/orders/${orderId}`);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};

// Description: Update order status
// Endpoint: PUT /api/admin/orders/:id/status
// Request: { status: string, note?: string }
// Response: { success: boolean, message: string, order: AdminOrder }
export const updateOrderStatus = (orderId: string, status: string, note?: string) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Order status updated successfully',
        order: { _id: orderId, status }
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.put(`/api/admin/orders/${orderId}/status`, { status, note });
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};

// Description: Assign staff to order
// Endpoint: PUT /api/admin/orders/:id/assign
// Request: { staffIds: string[] }
// Response: { success: boolean, message: string }
export const assignStaffToOrder = (orderId: string, staffIds: string[]) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Staff assigned successfully'
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.put(`/api/admin/orders/${orderId}/assign`, { staffIds });
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};

// Description: Add staff note to order
// Endpoint: POST /api/admin/orders/:id/notes
// Request: { note: string, type: string }
// Response: { success: boolean, message: string, note: AdminStaffNote }
export const addOrderNote = (orderId: string, note: string, type: string) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Note added successfully',
        note: {
          _id: 'note' + Date.now(),
          staffId: 'current-staff',
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
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};