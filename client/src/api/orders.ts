import api from './api';

export interface CustomerInfo {
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
}

export interface Order {
  _id: string;
  orderNumber: string;
  customerId: CustomerInfo;
  deviceBrand: string;
  deviceModel: string;
  services: string[];
  addOns: AddOnService[];
  status: 'pending' | 'in-progress' | 'quality-check' | 'completed' | 'ready-for-pickup';
  estimatedCompletion: string;
  totalCost: number;
  createdAt: string;
  photos: string[];
  customerNotes: string;
  staffNotes: string[];
  progress: number;
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'partial';
}

export interface AddOnService {
  _id: string;
  name: string;
  description: string;
  price: number;
  status: 'pending' | 'in-progress' | 'completed';
  estimatedTime: string;
}

// Description: Get all orders for the current user
// Endpoint: GET /api/orders
// Request: {}
// Response: { orders: Order[] }
export const getOrders = async () => {
  console.log('API: Making request to /api/orders');
  try {
    const response = await api.get('/api/orders');
    console.log('API: Received response from /api/orders:', response);
    console.log('API: Response data:', response.data);
    return response.data;
  } catch (error) {
    console.error('API: Error in getOrders:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create a new repair order
// Endpoint: POST /api/orders
// Request: { deviceBrand: string, deviceModel: string, services: string[], addOns: string[], customerNotes: string, photos: File[] }
// Response: { success: boolean, orderId: string, orderNumber: string, message: string }
export const createOrder = async (orderData: any) => {
  console.log('createOrder called with data:', orderData);
  
  try {
    const response = await api.post('/api/orders', orderData);
    console.log('createOrder API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('createOrder API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get order details by ID
// Endpoint: GET /api/orders/:id
// Request: {}
// Response: { order: Order }
export const getOrderById = async (orderId: string) => {
  console.log('getOrderById called with ID:', orderId);

  try {
    const response = await api.get(`/api/orders/${orderId}`);
    console.log('getOrderById API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('getOrderById API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get order progress timeline with milestone data
// Endpoint: GET /api/orders/:id/progress-timeline
// Request: {}
// Response: { stages: Array<{ id: string, label: string, status: string, date?: string }>, currentStage: string }
export const getOrderProgressTimeline = async (orderId: string) => {
  console.log('getOrderProgressTimeline called with ID:', orderId);

  try {
    const response = await api.get(`/api/orders/${orderId}/progress-timeline`);
    console.log('getOrderProgressTimeline API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('getOrderProgressTimeline API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};