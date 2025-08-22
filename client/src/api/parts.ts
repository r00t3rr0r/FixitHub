import api from './api';

export interface Part {
  _id: string;
  partNumber: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  compatibleDevices: string[];
  supplier: string;
  cost: number;
  sellingPrice: number;
  stockQuantity: number;
  minStockLevel: number;
  location: string;
  condition: 'new' | 'refurbished' | 'used';
  warranty: number;
  images: string[];
  specifications: { [key: string]: string };
  lastUpdated: string;
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
// Endpoint: GET /api/admin/parts
// Request: { category?: string, brand?: string, lowStock?: boolean, search?: string }
// Response: { parts: Part[], totalValue: number, lowStockCount: number }
export const getParts = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        parts: [
          {
            _id: 'part1',
            partNumber: 'IPH15-SCR-001',
            name: 'iPhone 15 Pro Screen Assembly',
            description: 'Original quality OLED screen assembly with digitizer',
            category: 'Display',
            brand: 'Apple',
            compatibleDevices: ['iPhone 15 Pro'],
            supplier: 'TechParts Inc',
            cost: 180,
            sellingPrice: 250,
            stockQuantity: 15,
            minStockLevel: 5,
            location: 'A1-B2',
            condition: 'new',
            warranty: 90,
            images: ['https://via.placeholder.com/300x300/3b82f6/ffffff?text=iPhone+Screen'],
            specifications: {
              'Screen Size': '6.1 inches',
              'Resolution': '2556x1179',
              'Technology': 'OLED'
            },
            lastUpdated: '2024-01-15T10:30:00Z'
          },
          {
            _id: 'part2',
            name: 'Samsung Galaxy S24 Battery',
            partNumber: 'SAM-S24-BAT-001',
            description: 'High capacity lithium-ion battery',
            category: 'Battery',
            brand: 'Samsung',
            compatibleDevices: ['Galaxy S24', 'Galaxy S24+'],
            supplier: 'PowerCell Solutions',
            cost: 45,
            sellingPrice: 75,
            stockQuantity: 3,
            minStockLevel: 10,
            location: 'B2-C1',
            condition: 'new',
            warranty: 180,
            images: ['https://via.placeholder.com/300x300/10b981/ffffff?text=Battery'],
            specifications: {
              'Capacity': '4000mAh',
              'Voltage': '3.85V',
              'Type': 'Li-ion'
            },
            lastUpdated: '2024-01-14T15:20:00Z'
          }
        ],
        totalValue: 12450,
        lowStockCount: 1
      });
    }, 500);
  });
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
// Endpoint: PUT /api/admin/parts/:id/stock
// Request: { quantity: number, operation: 'add' | 'subtract' | 'set' }
// Response: { success: boolean, part: Part }
export const updatePartStock = (partId: string, quantity: number, operation: 'add' | 'subtract' | 'set') => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        part: {
          _id: partId,
          stockQuantity: operation === 'set' ? quantity : (operation === 'add' ? quantity : -quantity)
        }
      });
    }, 500);
  });
};