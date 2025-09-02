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
  sku?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  _id: string;
  productId: Product;
  quantity: number;
  price: number;
}

export interface Cart {
  _id: string;
  user: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  totalItems: number;
  promoCode?: string;
  discount?: number;
  createdAt: string;
  updatedAt: string;
}

// Description: Get a list of products with optional filters
// Endpoint: GET /api/products
// Request: { category?: string, brand?: string, search?: string, page?: number, limit?: number }
// Response: { success: boolean, products: Product[], totalPages: number, currentPage: number, totalProducts: number }
export const getProducts = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) queryParams.append(key, value.toString());
    });
    
    const url = `/api/products${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get a single product by ID
// Endpoint: GET /api/products/:id
// Request: { id: string }
// Response: { success: boolean, product: Product }
export const getProduct = async (id: string) => {
  try {
    const response = await api.get(`/api/products/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create a new product
// Endpoint: POST /api/products
// Request: { name: string, description: string, price: number, originalPrice?: number, images: string[], category: string, brand: string, stockCount: number, features?: string[], compatibility?: string[], weight?: number, dimensions?: object }
// Response: { success: boolean, message: string, product: Product }
export const createProduct = async (productData: Partial<Product>) => {
  try {
    const response = await api.post('/api/products', productData);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update a product
// Endpoint: PUT /api/products/:id
// Request: { id: string, ...productData }
// Response: { success: boolean, message: string, product: Product }
export const updateProduct = async (id: string, productData: Partial<Product>) => {
  try {
    const response = await api.put(`/api/products/${id}`, productData);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete a product
// Endpoint: DELETE /api/products/:id
// Request: { id: string }
// Response: { success: boolean, message: string }
export const deleteProduct = async (id: string) => {
  try {
    const response = await api.delete(`/api/products/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get product categories
// Endpoint: GET /api/products/categories/list
// Request: {}
// Response: { success: boolean, categories: Array<{ name: string, count: number }> }
export const getProductCategories = async () => {
  try {
    const response = await api.get('/api/products/categories/list');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get product brands
// Endpoint: GET /api/products/brands/list
// Request: {}
// Response: { success: boolean, brands: Array<{ name: string, count: number }> }
export const getProductBrands = async () => {
  try {
    const response = await api.get('/api/products/brands/list');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get user's cart
// Endpoint: GET /api/cart
// Request: {}
// Response: { success: boolean, cart: Cart }
export const getCart = async () => {
  try {
    const response = await api.get('/api/cart');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Add item to cart
// Endpoint: POST /api/cart/add
// Request: { productId: string, quantity: number }
// Response: { success: boolean, message: string, cart: Cart }
export const addToCart = async (data: { productId: string; quantity: number }) => {
  try {
    const response = await api.post('/api/cart/add', data);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update cart item quantity
// Endpoint: PUT /api/cart/update
// Request: { productId: string, quantity: number }
// Response: { success: boolean, message: string, cart: Cart }
export const updateCartItem = async (productId: string, quantity: number) => {
  try {
    const response = await api.put('/api/cart/update', { productId, quantity });
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Remove item from cart
// Endpoint: DELETE /api/cart/remove/:productId
// Request: { productId: string }
// Response: { success: boolean, message: string, cart: Cart }
export const removeFromCart = async (productId: string) => {
  try {
    const response = await api.delete(`/api/cart/remove/${productId}`);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Clear cart
// Endpoint: DELETE /api/cart/clear
// Request: {}
// Response: { success: boolean, message: string }
export const clearCart = async () => {
  try {
    const response = await api.delete('/api/cart/clear');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Apply promo code to cart
// Endpoint: POST /api/cart/promo
// Request: { promoCode: string }
// Response: { success: boolean, message: string, cart: Cart, discount: number }
export const applyPromoCode = async (data: { promoCode: string }) => {
  try {
    const response = await api.post('/api/cart/promo', data);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};