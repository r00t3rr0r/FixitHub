import api from './api';

export interface Part {
  stockQuantity: any;
  _id: string;
  itemName: string;
  itemDescription: string;
  category: string;
  sku: string;
  barcode: string;
  manufacturer: string;
  brand: string;
  compatibleDevices: string[];
  versions: PartVersion[];
  specifications: { [key: string]: string };
  dateAdded: string;
  lastUpdated: string;
  lastOrderDate?: string;
  isActive: boolean;
}

export interface PartVersion {
  _id: string;
  versionType: 'original' | 'cheap' | 'efficient';
  versionId: string;
  quantity: number;
  minStockLevel: number;
  reorderLevel: number;
  quantityOnOrder: number;
  unitCost: number;
  sellingPrice: number;
  discounts: number;
  storageLocation: string;
  supplierInfo: SupplierInfo;
  leadTime: number;
  expirationDate?: string;
  status: 'active' | 'discontinued' | 'out-of-stock';
  lowStockAlert: boolean;
  notes: string;
  images: string[];
}

export interface SupplierInfo {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
}

export interface PartOrder {
  _id: string;
  orderNumber: string;
  supplier: string;
  status: 'pending' | 'ordered' | 'shipped' | 'received' | 'cancelled';
  orderDate: string;
  expectedDelivery: string;
  actualDelivery?: string;
  items: PartOrderItem[];
  totalCost: number;
  notes: string;
}

export interface PartOrderItem {
  _id: string;
  partId: string;
  partName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface PartUsage {
  _id: string;
  partId: string;
  partName: string;
  orderId: string;
  orderNumber: string;
  quantity: number;
  usedBy: string;
  usedAt: string;
  notes: string;
}

export interface Supplier {
  _id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  rating: number;
  paymentTerms: string;
  deliveryTime: number;
  isActive: boolean;
}

// Description: Get all parts inventory
// Endpoint: GET /api/inventory
// Request: { category?: string, brand?: string, lowStock?: boolean, search?: string, page?: number, limit?: number }
// Response: { items: Part[], totalPages: number, currentPage: number, totalItems: number, totalValue: number, lowStockCount: number }
export const getParts = async (filters: any = {}) => {
  try {
    const response = await api.get('/api/inventory', { params: filters });

    // Transform inventory items to match Part interface
    const transformedParts = response.data.items.map((item: any) => ({
      _id: item._id,
      partNumber: item.sku,
      name: item.itemName,
      description: item.itemDescription,
      category: item.category,
      brand: item.brand,
      compatibleDevices: item.compatibleDevices,
      supplier: item.versions[0]?.supplierInfo?.name || 'Unknown',
      cost: item.versions[0]?.unitCost || 0,
      sellingPrice: item.versions[0]?.sellingPrice || 0,
      stockQuantity: item.versions.reduce((sum: number, v: any) => sum + v.quantity, 0),
      minStockLevel: item.versions[0]?.minStockLevel || 0,
      location: item.versions[0]?.storageLocation || 'Unknown',
      condition: 'new',
      warranty: 90,
      images: item.versions[0]?.images || [],
      specifications: item.specifications || {},
      lastUpdated: item.lastUpdated,
      // Preserve the original versions data with proper IDs
      versions: item.versions || []
    }));

    return {
      parts: transformedParts,
      totalValue: response.data.totalValue,
      lowStockCount: response.data.lowStockCount
    };
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get part orders
// Endpoint: GET /api/admin/parts/orders
// Request: { status?: string, supplier?: string }
// Response: { orders: PartOrder[] }
export const getPartOrders = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        orders: [
          {
            _id: 'order1',
            orderNumber: 'PO-2024-001',
            supplier: 'TechParts Inc',
            status: 'shipped',
            orderDate: '2024-01-10T09:00:00Z',
            expectedDelivery: '2024-01-17T17:00:00Z',
            items: [
              {
                _id: 'item1',
                partId: 'part1',
                partName: 'iPhone 15 Pro Screen Assembly',
                quantity: 10,
                unitCost: 180,
                totalCost: 1800
              }
            ],
            totalCost: 1800,
            notes: 'Urgent order for high-demand part'
          }
        ]
      });
    }, 500);
  });
};

// Description: Get suppliers
// Endpoint: GET /api/admin/parts/suppliers
// Request: {}
// Response: { suppliers: Supplier[] }
export const getSuppliers = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        suppliers: [
          {
            _id: 'supplier1',
            name: 'TechParts Inc',
            contactPerson: 'John Smith',
            email: 'orders@techparts.com',
            phone: '+1-555-0123',
            address: '123 Tech Street, Silicon Valley, CA',
            website: 'www.techparts.com',
            rating: 4.8,
            paymentTerms: 'Net 30',
            deliveryTime: 3,
            isActive: true
          }
        ]
      });
    }, 500);
  });
};

// Description: Create part order
// Endpoint: POST /api/admin/parts/orders
// Request: Partial<PartOrder>
// Response: { success: boolean, order: PartOrder }
export const createPartOrder = (orderData: Partial<PartOrder>) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        order: {
          _id: 'order_' + Date.now(),
          orderNumber: 'PO-2024-' + Math.floor(Math.random() * 1000),
          ...orderData,
          orderDate: new Date().toISOString()
        }
      });
    }, 1000);
  });
};

// Description: Update part stock
// Endpoint: PUT /api/inventory/:id/quantity
// Request: { versionId: string, quantity: number, operation: 'add' | 'subtract' | 'set', reason?: string }
// Response: { success: boolean, item: Part }
export const updatePartStock = async (partId: string, versionId: string, quantity: number, operation: 'add' | 'subtract' | 'set', reason?: string) => {
  try {
    const response = await api.put(`/api/inventory/${partId}/quantity`, {
      versionId,
      quantity,
      operation,
      reason
    });
    
    return {
      success: response.data.success,
      part: response.data.item
    };
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create new inventory item
// Endpoint: POST /api/inventory
// Request: Partial<Part>
// Response: { success: boolean, item: Part }
export const createInventoryItem = async (itemData: any) => {
  try {
    const response = await api.post('/api/inventory', itemData);
    
    return {
      success: response.data.success,
      item: response.data.item
    };
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get low stock items
// Endpoint: GET /api/inventory/alerts/low-stock
// Request: {}
// Response: { items: Array, count: number }
export const getLowStockItems = async () => {
  try {
    const response = await api.get('/api/inventory/alerts/low-stock');
    
    return {
      items: response.data.items,
      count: response.data.count
    };
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete inventory item
// Endpoint: DELETE /api/inventory/:id
// Request: {}
// Response: { success: boolean, message: string }
export const deletePart = async (partId: string) => {
  try {
    const response = await api.delete(`/api/inventory/${partId}`);

    return {
      success: response.data.success,
      message: response.data.message
    };
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};