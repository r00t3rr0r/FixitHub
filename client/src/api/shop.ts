import api from './api';

export interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  images: string[];
  category: string;
  brand: string;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  stockCount: number;
  features: string[];
  compatibility: string[];
}

export interface CartItem {
  _id: string;
  product: Product;
  quantity: number;
  addedAt: string;
}

export interface Cart {
  _id: string;
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  tax: number;
  total: number;
  promoCode?: string;
  discount?: number;
}

const mockProducts = [
  {
    _id: 'prod1',
    name: 'Premium Screen Protector',
    description: 'Ultra-clear tempered glass with 9H hardness rating',
    price: 29.99,
    originalPrice: 39.99,
    images: ['https://picsum.photos/400/400?random=1', 'https://picsum.photos/400/400?random=2'],
    category: 'Accessories',
    brand: 'TechGuard',
    rating: 4.8,
    reviewCount: 156,
    inStock: true,
    stockCount: 45,
    features: ['9H Hardness', 'Anti-fingerprint', 'Easy installation'],
    compatibility: ['iPhone 15', 'iPhone 14', 'iPhone 13']
  },
  {
    _id: 'prod2',
    name: 'Wireless Charging Pad',
    description: 'Fast wireless charging with LED indicator',
    price: 49.99,
    images: ['https://picsum.photos/400/400?random=3'],
    category: 'Chargers',
    brand: 'PowerTech',
    rating: 4.6,
    reviewCount: 89,
    inStock: true,
    stockCount: 23,
    features: ['15W Fast Charging', 'LED Indicator', 'Non-slip base'],
    compatibility: ['iPhone', 'Samsung', 'Google Pixel']
  },
  {
    _id: 'prod3',
    name: 'Rugged Phone Case',
    description: 'Military-grade protection with shock absorption',
    price: 39.99,
    images: ['https://picsum.photos/400/400?random=4'],
    category: 'Cases',
    brand: 'ArmorShield',
    rating: 4.9,
    reviewCount: 234,
    inStock: true,
    stockCount: 67,
    features: ['Drop protection', 'Shock absorption', 'Raised edges'],
    compatibility: ['iPhone 15 Pro', 'iPhone 15']
  },
  {
    _id: 'prod4',
    name: 'USB-C Cable',
    description: 'High-speed charging and data transfer cable',
    price: 19.99,
    images: ['https://picsum.photos/400/400?random=5'],
    category: 'Cables',
    brand: 'SpeedLink',
    rating: 4.5,
    reviewCount: 78,
    inStock: false,
    stockCount: 0,
    features: ['Fast charging', 'Data sync', 'Durable braided design'],
    compatibility: ['Samsung', 'Google Pixel', 'iPad Pro']
  }
];

// Description: Get all shop products
// Endpoint: GET /api/shop/products
// Request: { category?: string, brand?: string, search?: string, page?: number, limit?: number }
// Response: { products: Product[], totalPages: number, currentPage: number }
export const getProducts = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        products: mockProducts,
        totalPages: 3,
        currentPage: 1
      });
    }, 500);
  });
};

// Description: Get shopping cart contents
// Endpoint: GET /api/shop/cart
// Request: {}
// Response: { cart: Cart }
export const getCart = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        cart: {
          _id: 'cart1',
          items: [
            {
              _id: 'item1',
              product: {
                ...mockProducts[0],
                images: ['https://picsum.photos/400/400?random=1']
              },
              quantity: 2,
              addedAt: '2024-01-10T10:30:00Z'
            },
            {
              _id: 'item2',
              product: {
                ...mockProducts[1],
                images: ['https://picsum.photos/400/400?random=3']
              },
              quantity: 1,
              addedAt: '2024-01-10T11:15:00Z'
            }
          ],
          totalItems: 3,
          subtotal: 109.97,
          tax: 8.80,
          total: 118.77,
          promoCode: 'SAVE10',
          discount: 10.99
        }
      });
    }, 500);
  });
};

// Description: Add item to cart
// Endpoint: POST /api/shop/cart/add
// Request: { productId: string, quantity: number }
// Response: { success: boolean, message: string, cart: Cart }
export const addToCart = (productId: string, quantity: number = 1) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Item added to cart successfully',
        cart: {
          _id: 'cart1',
          totalItems: 4,
          subtotal: 139.96,
          tax: 11.20,
          total: 151.16
        }
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.post('/api/shop/cart/add', { productId, quantity });
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};

// Description: Update cart item quantity
// Endpoint: PUT /api/shop/cart/update
// Request: { itemId: string, quantity: number }
// Response: { success: boolean, message: string, cart: Cart }
export const updateCartItem = (itemId: string, quantity: number) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Cart updated successfully',
        cart: {
          _id: 'cart1',
          totalItems: quantity > 0 ? 3 : 2,
          subtotal: quantity > 0 ? 109.97 : 79.98,
          tax: quantity > 0 ? 8.80 : 6.40,
          total: quantity > 0 ? 118.77 : 86.38
        }
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.put('/api/shop/cart/update', { itemId, quantity });
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};

// Description: Remove item from cart
// Endpoint: DELETE /api/shop/cart/remove/:itemId
// Request: {}
// Response: { success: boolean, message: string, cart: Cart }
export const removeFromCart = (itemId: string) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Item removed from cart',
        cart: {
          _id: 'cart1',
          totalItems: 2,
          subtotal: 79.98,
          tax: 6.40,
          total: 86.38
        }
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.delete(`/api/shop/cart/remove/${itemId}`);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};

// Description: Apply promo code to cart
// Endpoint: POST /api/shop/cart/promo
// Request: { promoCode: string }
// Response: { success: boolean, message: string, discount: number, cart: Cart }
export const applyPromoCode = (promoCode: string) => {
  // Mocking the response
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (promoCode === 'SAVE10') {
        resolve({
          success: true,
          message: 'Promo code applied successfully',
          discount: 10.99,
          cart: {
            _id: 'cart1',
            totalItems: 3,
            subtotal: 109.97,
            tax: 8.80,
            total: 107.78,
            promoCode: 'SAVE10',
            discount: 10.99
          }
        });
      } else {
        reject(new Error('Invalid promo code'));
      }
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.post('/api/shop/cart/promo', { promoCode });
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};