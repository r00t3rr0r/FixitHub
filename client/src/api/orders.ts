import api from './api';

export interface Order {
  _id: string;
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
export const getOrders = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        orders: [
          {
            _id: '1',
            deviceBrand: 'Apple',
            deviceModel: 'iPhone 14 Pro',
            services: ['Screen Replacement', 'Battery Replacement'],
            addOns: [
              {
                _id: 'addon1',
                name: 'Screen Protector',
                description: 'Premium tempered glass protection',
                price: 25,
                status: 'completed',
                estimatedTime: '5 minutes'
              }
            ],
            status: 'in-progress',
            estimatedCompletion: '2024-01-15',
            totalCost: 299,
            createdAt: '2024-01-10',
            photos: ['https://picsum.photos/400/300?random=10'],
            customerNotes: 'Phone dropped, screen cracked',
            staffNotes: ['Diagnostic completed', 'Parts ordered'],
            progress: 60
          },
          {
            _id: '2',
            deviceBrand: 'Samsung',
            deviceModel: 'Galaxy S23',
            services: ['Camera Repair'],
            addOns: [],
            status: 'completed',
            estimatedCompletion: '2024-01-08',
            totalCost: 150,
            createdAt: '2024-01-05',
            photos: ['https://picsum.photos/400/300?random=11'],
            customerNotes: 'Camera not focusing properly',
            staffNotes: ['Camera module replaced', 'Quality check passed'],
            progress: 100
          }
        ]
      });
    }, 500);
  });
};

// Description: Create a new repair order
// Endpoint: POST /api/orders
// Request: { deviceBrand: string, deviceModel: string, services: string[], addOns: string[], customerNotes: string, photos: File[] }
// Response: { success: boolean, orderId: string, message: string }
export const createOrder = (orderData: any) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        orderId: 'ORD-' + Math.random().toString(36).substr(2, 9),
        message: 'Order created successfully'
      });
    }, 1000);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.post('/api/orders', orderData);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};

// Description: Get order details by ID
// Endpoint: GET /api/orders/:id
// Request: {}
// Response: { order: Order }
export const getOrderById = (orderId: string) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        order: {
          _id: orderId,
          deviceBrand: 'Apple',
          deviceModel: 'iPhone 14 Pro',
          services: ['Screen Replacement', 'Battery Replacement'],
          addOns: [
            {
              _id: 'addon1',
              name: 'Screen Protector',
              description: 'Premium tempered glass protection',
              price: 25,
              status: 'completed',
              estimatedTime: '5 minutes'
            }
          ],
          status: 'in-progress',
          estimatedCompletion: '2024-01-15',
          totalCost: 299,
          createdAt: '2024-01-10',
          photos: ['https://picsum.photos/400/300?random=10'],
          customerNotes: 'Phone dropped, screen cracked',
          staffNotes: ['Diagnostic completed', 'Parts ordered', 'Screen replacement in progress'],
          progress: 60
        }
      });
    }, 500);
  });
};