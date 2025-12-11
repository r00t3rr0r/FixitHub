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
  deviceType?: string;
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
  // Device unlock information
  unlockPattern?: string[];
  unlockCode?: string;
  noLock?: boolean;
  unlockConfirmation?: {
    confirmedBy?: string;
    confirmedByName?: string;
    confirmedAt?: string;
    confirmationStatus?: 'verified' | 'incorrect' | 'unable-to-verify';
    notes?: string;
  };
  // Shipping and tracking information
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  trackingNumber?: string;
  carrier?: string;
  shippingStatus?: 'pending' | 'label-created' | 'shipped' | 'in-transit' | 'out-for-delivery' | 'delivered' | 'failed';
  estimatedDelivery?: string;
  actualDelivery?: string;
  shippingLabelUrl?: string;
  shippingCost?: number;
  trackingEvents?: Array<{
    timestamp: string;
    location: string;
    status: string;
    description: string;
  }>;
}

export interface AddOnService {
  _id: string;
  name: string;
  description: string;
  price: number;
  status: 'pending' | 'in-progress' | 'completed';
  estimatedTime: string;
}

export interface ShopProduct {
  _id: string;
  productId: {
    _id: string;
    name: string;
    price: number;
    images: string[];
    category: string;
    brand: string;
    stock: number;
  };
  quantity: number;
  priceAtOrder: number;
  addedAt: string;
  addedBy: {
    _id: string;
    name: string;
    email: string;
  };
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

// Description: Add shop product to order
// Endpoint: POST /api/admin/orders/:id/shop-products
// Request: { productId: string, quantity: number }
// Response: { success: boolean, message: string, order: Order }
export const addShopProductToOrder = async (orderId: string, productId: string, quantity: number) => {
  console.log('addShopProductToOrder called with:', { orderId, productId, quantity });

  try {
    const response = await api.post(`/api/admin/orders/${orderId}/shop-products`, {
      productId,
      quantity
    });
    console.log('addShopProductToOrder API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('addShopProductToOrder API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update shop product quantity in order
// Endpoint: PUT /api/admin/orders/:id/shop-products/:productItemId
// Request: { quantity: number }
// Response: { success: boolean, message: string, order: Order }
export const updateShopProductQuantity = async (orderId: string, productItemId: string, quantity: number) => {
  console.log('updateShopProductQuantity called with:', { orderId, productItemId, quantity });

  try {
    const response = await api.put(`/api/admin/orders/${orderId}/shop-products/${productItemId}`, {
      quantity
    });
    console.log('updateShopProductQuantity API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('updateShopProductQuantity API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Remove shop product from order
// Endpoint: DELETE /api/admin/orders/:id/shop-products/:productItemId
// Request: {}
// Response: { success: boolean, message: string, order: Order }
export const removeShopProductFromOrder = async (orderId: string, productItemId: string) => {
  console.log('removeShopProductFromOrder called with:', { orderId, productItemId });

  try {
    const response = await api.delete(`/api/admin/orders/${orderId}/shop-products/${productItemId}`);
    console.log('removeShopProductFromOrder API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('removeShopProductFromOrder API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};