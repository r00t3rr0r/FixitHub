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
  productId: Product;
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

// Description: Get all shop products
// Endpoint: GET /api/products
// Request: { category?: string, brand?: string, search?: string, page?: number, limit?: number }
// Response: { products: Product[], totalPages: number, currentPage: number }
export const getProducts = async (filters: any = {}) => {
  try {
    const response = await api.get('/api/products', { params: filters });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get shopping cart contents
// Endpoint: GET /api/cart
// Request: {}
// Response: { cart: Cart }
export const getCart = async () => {
  try {
    const response = await api.get('/api/cart');
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Add item to cart
// Endpoint: POST /api/cart/add
// Request: { productId: string, quantity: number }
// Response: { success: boolean, message: string, cart: Cart }
export const addToCart = async (productId: string, quantity: number = 1) => {
  try {
    const response = await api.post('/api/cart/add', { productId, quantity });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update cart item quantity
// Endpoint: PUT /api/cart/update
// Request: { itemId: string, quantity: number }
// Response: { success: boolean, message: string, cart: Cart }
export const updateCartItem = async (itemId: string, quantity: number) => {
  try {
    const response = await api.put('/api/cart/update', { itemId, quantity });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Remove item from cart
// Endpoint: DELETE /api/cart/remove/:itemId
// Request: {}
// Response: { success: boolean, message: string, cart: Cart }
export const removeFromCart = async (itemId: string) => {
  try {
    const response = await api.delete(`/api/cart/remove/${itemId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Apply promo code to cart
// Endpoint: POST /api/cart/promo
// Request: { promoCode: string }
// Response: { success: boolean, message: string, discount: number, cart: Cart }
export const applyPromoCode = async (promoCode: string) => {
  try {
    const response = await api.post('/api/cart/promo', { promoCode });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};