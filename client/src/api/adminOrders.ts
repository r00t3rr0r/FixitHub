import api from './api';
import { generateAvatarPlaceholder, generateImagePlaceholder } from '@/utils/placeholders';

export interface StaffMember {
  _id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  specializations: string[];
  currentWorkload?: {
    assignedOrders: number;
    assignedTasks?: number;
    capacity: number;
    utilizationRate: number;
  };
}

export interface OrderEPart {
  _id: string;
  partId: {
    _id: string;
    itemName: string;
    itemDescription: string;
    category: string;
    sku: string;
    brand: string;
    versions: {
      _id: string;
      versionType: 'original' | 'cheap' | 'efficient';
      versionId: string;
      quantity: number;
      unitCost: number;
      sellingPrice: number;
      status: string;
      storageLocation: string;
    }[];
  };
  versionId: string;
  quantity: number;
  status: 'pending' | 'allocated' | 'used';
  assignedAt: string;
  assignedBy: {
    _id: string;
    name: string;
    email: string;
  };
}

export interface UnlockConfirmation {
  confirmedBy?: string;
  confirmedByName?: string;
  confirmedAt?: string;
  confirmationStatus?: 'verified' | 'incorrect' | 'unable-to-verify';
  notes?: string;
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
  eParts: OrderEPart[];
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
  // Device unlock information
  unlockPattern?: string[];
  unlockCode?: string;
  noLock?: boolean;
  unlockConfirmation?: UnlockConfirmation;
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
              avatar: generateAvatarPlaceholder('JS', 100),
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
            photos: [generateImagePlaceholder('Device Photo', 400, 300)],
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
              avatar: generateAvatarPlaceholder('SJ', 100),
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
              avatar: generateAvatarPlaceholder('MC', 100)
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

// Description: Get available staff members for assignment with workload information
// Endpoint: GET /api/admin/staff-management/staff
// Request: {}
// Response: { staff: StaffMember[] }
export const getAvailableStaff = async () => {
  try {
    console.log('getAvailableStaff: Fetching staff members with workload from API');
    const response = await api.get('/api/admin/staff-management/staff');
    console.log('getAvailableStaff API response:', response.data);

    // Ensure workload information is present
    const staff = response.data.staff || [];
    console.log('getAvailableStaff: Staff members retrieved:', staff.length, 'members');

    return {
      ...response.data,
      staff: staff.map((member: any) => ({
        ...member,
        currentWorkload: member.currentWorkload || {
          assignedOrders: 0,
          assignedTasks: 0,
          capacity: 10,
          utilizationRate: 0
        }
      }))
    };
  } catch (error: any) {
    console.error('getAvailableStaff API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Assign staff to order
// Endpoint: PUT /api/admin/orders/:id/assign
// Request: { staffIds: string[] }
// Response: { success: boolean, message: string }
export const assignStaffToOrder = async (orderId: string, staffIds: string[]) => {
  console.log('assignStaffToOrder called:', { orderId, staffIds });
  try {
    const response = await api.put(`/api/admin/orders/${orderId}/assign`, { staffIds });
    console.log('assignStaffToOrder API response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('assignStaffToOrder API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
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

// Description: Assign EPart to order
// Endpoint: POST /api/admin/orders/:id/eparts
// Request: { partId: string, versionId: string, quantity: number }
// Response: { success: boolean, message: string, order: AdminOrder }
export const assignEPartToOrder = async (orderId: string, partId: string, versionId: string, quantity: number) => {
  console.log('assignEPartToOrder called:', { orderId, partId, versionId, quantity });
  try {
    const response = await api.post(`/api/admin/orders/${orderId}/eparts`, {
      partId,
      versionId,
      quantity
    });
    console.log('assignEPartToOrder API response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('assignEPartToOrder API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Remove EPart from order
// Endpoint: DELETE /api/admin/orders/:id/eparts/:ePartId
// Request: {}
// Response: { success: boolean, message: string, order: AdminOrder }
export const removeEPartFromOrder = async (orderId: string, ePartId: string) => {
  console.log('removeEPartFromOrder called:', { orderId, ePartId });
  try {
    const response = await api.delete(`/api/admin/orders/${orderId}/eparts/${ePartId}`);
    console.log('removeEPartFromOrder API response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('removeEPartFromOrder API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update EPart status
// Endpoint: PUT /api/admin/orders/:id/eparts/:ePartId/status
// Request: { status: string }
// Response: { success: boolean, message: string, order: AdminOrder }
export const updateEPartStatus = async (orderId: string, ePartId: string, status: string) => {
  console.log('updateEPartStatus called:', { orderId, ePartId, status });
  try {
    const response = await api.put(`/api/admin/orders/${orderId}/eparts/${ePartId}/status`, {
      status
    });
    console.log('updateEPartStatus API response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('updateEPartStatus API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Add add-on service to order
// Endpoint: POST /api/admin/orders/:orderId/addons
// Request: { name: string, description?: string, price: number, estimatedTime?: string, status?: string }
// Response: { success: boolean, message: string, order: AdminOrder }
export const addAddonToOrder = async (orderId: string, addonData: {
  name: string;
  description?: string;
  price: number;
  estimatedTime?: string;
  status?: string;
}) => {
  console.log('addAddonToOrder called with orderId:', orderId, 'addonData:', addonData);
  try {
    const response = await api.post(`/api/admin/orders/${orderId}/addons`, addonData);
    console.log('addAddonToOrder API response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('addAddonToOrder API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update add-on service in order
// Endpoint: PUT /api/admin/orders/:orderId/addons/:addonId
// Request: { name?: string, description?: string, price?: number, estimatedTime?: string, status?: string, progress?: number }
// Response: { success: boolean, message: string, order: AdminOrder }
export const updateOrderAddon = async (orderId: string, addonId: string, updateData: {
  name?: string;
  description?: string;
  price?: number;
  estimatedTime?: string;
  status?: string;
  progress?: number;
}) => {
  console.log('updateOrderAddon called with orderId:', orderId, 'addonId:', addonId, 'updateData:', updateData);
  try {
    const response = await api.put(`/api/admin/orders/${orderId}/addons/${addonId}`, updateData);
    console.log('updateOrderAddon API response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('updateOrderAddon API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Remove add-on service from order
// Endpoint: DELETE /api/admin/orders/:orderId/addons/:addonId
// Request: {}
// Response: { success: boolean, message: string, order: AdminOrder }
export const removeAddonFromOrder = async (orderId: string, addonId: string) => {
  console.log('removeAddonFromOrder called with orderId:', orderId, 'addonId:', addonId);
  try {
    const response = await api.delete(`/api/admin/orders/${orderId}/addons/${addonId}`);
    console.log('removeAddonFromOrder API response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('removeAddonFromOrder API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Assign staff to add-on service
// Endpoint: PUT /api/admin/orders/:orderId/addons/:addonId/assign
// Request: { staffId: string }
// Response: { success: boolean, message: string, order: AdminOrder }
export const assignStaffToAddon = async (orderId: string, addonId: string, staffId: string) => {
  console.log('assignStaffToAddon called with orderId:', orderId, 'addonId:', addonId, 'staffId:', staffId);
  try {
    const response = await api.put(`/api/admin/orders/${orderId}/addons/${addonId}/assign`, { staffId });
    console.log('assignStaffToAddon API response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('assignStaffToAddon API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update device information for an order
// Endpoint: PUT /api/admin/orders/:id/device
// Request: { deviceBrand: string, deviceModel: string, deviceType?: string }
// Response: { success: boolean, message: string, order: AdminOrder }
export const updateOrderDevice = async (orderId: string, deviceBrand: string, deviceModel: string, deviceType?: string) => {
  console.log('updateOrderDevice called with orderId:', orderId, 'deviceBrand:', deviceBrand, 'deviceModel:', deviceModel);
  try {
    const response = await api.put(`/api/admin/orders/${orderId}/device`, {
      deviceBrand,
      deviceModel,
      deviceType
    });
    console.log('updateOrderDevice API response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('updateOrderDevice API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Confirm/verify the device unlock code or pattern
// Endpoint: POST /api/admin/orders/:id/confirm-unlock
// Request: { confirmationStatus: 'verified' | 'incorrect' | 'unable-to-verify', notes?: string }
// Response: { order: AdminOrder }
export const confirmUnlockCode = async (orderId: string, confirmationStatus: 'verified' | 'incorrect' | 'unable-to-verify', notes: string = '') => {
  console.log('confirmUnlockCode called with orderId:', orderId, 'confirmationStatus:', confirmationStatus);
  try {
    const response = await api.post(`/api/admin/orders/${orderId}/confirm-unlock`, {
      confirmationStatus,
      notes
    });
    console.log('confirmUnlockCode API response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('confirmUnlockCode API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Change device and recalculate repair services
// Endpoint: POST /api/admin/orders/:id/change-device
// Request: { deviceBrand: string, deviceModel: string, deviceType: string }
// Response: { success: boolean, order: AdminOrder, pricingChangesSummary: Object, requiresConfirmation: boolean }
export const changeDeviceAndRecalculateServices = async (
  orderId: string,
  deviceBrand: string,
  deviceModel: string,
  deviceType: string
) => {
  console.log('changeDeviceAndRecalculateServices called with:', { orderId, deviceBrand, deviceModel, deviceType });
  try {
    const response = await api.post(`/api/admin/orders/${orderId}/change-device`, {
      deviceBrand,
      deviceModel,
      deviceType,
    });
    console.log('changeDeviceAndRecalculateServices API response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('changeDeviceAndRecalculateServices API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Confirm device change after pricing approval
// Endpoint: POST /api/admin/orders/:id/confirm-device-change
// Request: { confirmed: boolean }
// Response: { success: boolean, message: string, order: AdminOrder }
export const confirmDeviceChange = async (orderId: string, confirmed: boolean) => {
  console.log('confirmDeviceChange called with:', { orderId, confirmed });
  try {
    const response = await api.post(`/api/admin/orders/${orderId}/confirm-device-change`, {
      confirmed,
    });
    console.log('confirmDeviceChange API response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('confirmDeviceChange API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get compatible services for a device type
// Endpoint: GET /api/admin/orders/device-type/:deviceType/compatible-services
// Request: {}
// Response: { success: boolean, services: Array<Service> }
export const getCompatibleServices = async (deviceType: string) => {
  console.log('getCompatibleServices called with deviceType:', deviceType);
  try {
    const response = await api.get(`/api/admin/orders/device-type/${deviceType}/compatible-services`);
    console.log('getCompatibleServices API response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('getCompatibleServices API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};