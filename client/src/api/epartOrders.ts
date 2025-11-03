import api from './api';

// ============ TYPES ============

export interface Supplier {
  _id: string;
  name: string;
  contactPerson?: string;
  email: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  website?: string;
  ustId?: string;
  paymentInformation?: {
    iban?: string;
    bic?: string;
    bankName?: string;
    accountHolder?: string;
  };
  paymentTerms?: string;
  leadTime?: number;
  rating?: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  _id?: string;
  partId: string;
  partName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  receivedQuantity: number;
  status: 'pending' | 'partial' | 'received' | 'cancelled';
}

export interface TimelineEntry {
  _id: string;
  status: string;
  description: string;
  completedAt: string;
  userId?: string;
  userName?: string;
  notes?: string;
}

export interface EPartOrder {
  _id: string;
  orderNumber: string;
  supplierId: string | Supplier;
  items: OrderItem[];
  status: 'draft' | 'pending' | 'confirmed' | 'shipped' | 'partial' | 'received' | 'cancelled';
  orderDate: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  subtotal: number;
  tax: number;
  shippingCost: number;
  totalCost: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  paymentMethod: 'credit_card' | 'bank_transfer' | 'check' | 'cash' | 'account';
  trackingNumber?: string;
  notes?: string;
  createdBy: string | { _id: string; name: string; email: string };
  receivedBy?: string | { _id: string; name: string; email: string };
  timeline: TimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderStatistics {
  totalOrders: number;
  totalSpent: number;
  ordersByStatus: Record<string, number>;
  topSuppliers: Array<{
    supplierId: string;
    supplierName: string;
    orderCount: number;
    totalSpent: number;
  }>;
}

// ============ SUPPLIER API ============

// Description: Get all suppliers
// Endpoint: GET /api/epart-orders/suppliers
// Request: { isActive?: boolean, search?: string }
// Response: { suppliers: Array<Supplier> }
export const getSuppliers = async (filters?: { isActive?: boolean; search?: string }) => {
  try {
    const params = new URLSearchParams();
    if (filters?.isActive !== undefined) {
      params.append('isActive', String(filters.isActive));
    }
    if (filters?.search) {
      params.append('search', filters.search);
    }

    const response = await api.get(`/api/epart-orders/suppliers?${params.toString()}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get supplier by ID
// Endpoint: GET /api/epart-orders/suppliers/:id
// Request: {}
// Response: { supplier: Supplier }
export const getSupplierById = async (supplierId: string) => {
  try {
    const response = await api.get(`/api/epart-orders/suppliers/${supplierId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create new supplier
// Endpoint: POST /api/epart-orders/suppliers
// Request: Supplier data
// Response: { supplier: Supplier }
export const createSupplier = async (supplierData: Partial<Supplier>) => {
  try {
    const response = await api.post('/api/epart-orders/suppliers', supplierData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update supplier
// Endpoint: PUT /api/epart-orders/suppliers/:id
// Request: Supplier data
// Response: { supplier: Supplier }
export const updateSupplier = async (supplierId: string, updateData: Partial<Supplier>) => {
  try {
    const response = await api.put(`/api/epart-orders/suppliers/${supplierId}`, updateData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete (deactivate) supplier
// Endpoint: DELETE /api/epart-orders/suppliers/:id
// Request: {}
// Response: { message: string }
export const deleteSupplier = async (supplierId: string) => {
  try {
    const response = await api.delete(`/api/epart-orders/suppliers/${supplierId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// ============ ORDER API ============

// Description: Get all epart orders with filters
// Endpoint: GET /api/epart-orders
// Request: { status?, supplierId?, paymentStatus?, search?, startDate?, endDate?, page?, limit? }
// Response: { orders: Array<EPartOrder>, pagination: { total, page, pages, limit } }
export const getEPartOrders = async (filters?: {
  status?: string;
  supplierId?: string;
  paymentStatus?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) => {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.supplierId) params.append('supplierId', filters.supplierId);
    if (filters?.paymentStatus) params.append('paymentStatus', filters.paymentStatus);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const response = await api.get(`/api/epart-orders?${params.toString()}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get order statistics
// Endpoint: GET /api/epart-orders/statistics
// Request: { startDate?, endDate? }
// Response: OrderStatistics
export const getOrderStatistics = async (filters?: { startDate?: string; endDate?: string }) => {
  try {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await api.get(`/api/epart-orders/statistics?${params.toString()}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get order by ID
// Endpoint: GET /api/epart-orders/:id
// Request: {}
// Response: { order: EPartOrder }
export const getEPartOrderById = async (orderId: string) => {
  try {
    const response = await api.get(`/api/epart-orders/${orderId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create new epart order
// Endpoint: POST /api/epart-orders
// Request: Order data
// Response: { order: EPartOrder }
export const createEPartOrder = async (orderData: {
  supplierId: string;
  items: Array<{ partId: string; quantity: number; unitPrice: number }>;
  status?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  tax?: number;
  shippingCost?: number;
  paymentMethod?: string;
  notes?: string;
}) => {
  try {
    const response = await api.post('/api/epart-orders', orderData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update epart order
// Endpoint: PUT /api/epart-orders/:id
// Request: Update data
// Response: { order: EPartOrder }
export const updateEPartOrder = async (
  orderId: string,
  updateData: {
    status?: string;
    trackingNumber?: string;
    paymentStatus?: string;
    expectedDeliveryDate?: string;
    notes?: string;
    tax?: number;
    shippingCost?: number;
    statusNotes?: string;
  }
) => {
  try {
    const response = await api.put(`/api/epart-orders/${orderId}`, updateData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Receive order items (full or partial)
// Endpoint: POST /api/epart-orders/:id/receive
// Request: { items: Array<{ itemId, quantity }> }
// Response: { order: EPartOrder }
export const receiveOrderItems = async (
  orderId: string,
  items: Array<{ itemId: string; quantity: number }>
) => {
  try {
    const response = await api.post(`/api/epart-orders/${orderId}/receive`, { items });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Cancel epart order
// Endpoint: POST /api/epart-orders/:id/cancel
// Request: { reason?: string }
// Response: { order: EPartOrder }
export const cancelEPartOrder = async (orderId: string, reason?: string) => {
  try {
    const response = await api.post(`/api/epart-orders/${orderId}/cancel`, { reason });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};
