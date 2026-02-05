import api from './api';
import {
  getGuestCart as getGuestCartFromStorage,
  addToGuestCart as addToGuestCartStorage,
  updateGuestCartItem as updateGuestCartItemStorage,
  removeFromGuestCart as removeFromGuestCartStorage,
  clearGuestCart as clearGuestCartStorage,
  addRepairOrderToGuestCart as addRepairOrderToGuestCartStorage,
  removeRepairOrderFromGuestCart as removeRepairOrderFromGuestCartStorage,
  GuestCart
} from '@/utils/guestCart';

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
  // SEO Fields
  searchKeywords?: string;
  seoName?: string;
  seoTitleTag?: string;
  seoMetaKeywords?: string;
  seoMetaDescription?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  _id: string;
  productId: Product;
  quantity: number;
  price: number;
}

export interface RepairOrderItem {
  _id: string;
  deviceType: string;
  deviceBrand: string;
  deviceModel: string;
  services: string[];
  addOns: Array<{
    name: string;
    description: string;
    price: number;
    estimatedTime: string;
  }>;
  customerNotes: string;
  photos: string[];
  totalCost: number;
  addedAt: string;
  unlockPattern?: string[];
  unlockCode?: string;
  noLock?: boolean;
}

export interface Cart {
  _id: string;
  user: string;
  items: CartItem[];
  repairOrders?: RepairOrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  totalItems: number;
  promoCode?: string;
  discount?: number;
  createdAt: string;
  updatedAt: string;
}

// Description: Get a list of products with optional filters, pagination, and sorting
// Endpoint: GET /api/products
// Request: { page?: number, limit?: number, sortBy?: string, sortOrder?: 'asc'|'desc', category?: string, brand?: string, search?: string }
// Response: { success: boolean, products: Product[], totalPages: number, currentPage: number, totalProducts: number, limit: number }
export const getProducts = async (filters: any = {}) => {
  try {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value.toString());
      }
    });

    const url = `/api/products${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching products:', error);
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

// Helper function to check if user is authenticated
const isAuthenticated = () => {
  return !!localStorage.getItem('accessToken');
};

// Description: Get user's cart (handles both authenticated and guest users)
// Endpoint: GET /api/cart (authenticated) or localStorage (guest)
// Request: {}
// Response: { success: boolean, cart: Cart }
export const getCart = async () => {
  try {
    if (isAuthenticated()) {
      console.log('ShoppingCart: Fetching authenticated user cart from API');
      const response = await api.get('/api/cart');
      console.log('ShoppingCart: Cart fetched successfully', response.data);
      return response.data;
    } else {
      // Return guest cart from localStorage
      console.log('ShoppingCart: Fetching guest cart from localStorage');
      const guestCart = getGuestCartFromStorage();
      return {
        success: true,
        cart: {
          _id: 'guest-cart',
          user: 'guest',
          items: guestCart.items.map(item => ({
            _id: item._id,
            productId: item.product,
            quantity: item.quantity,
            price: item.product.price
          })),
          repairOrders: guestCart.repairOrders,
          subtotal: guestCart.totalCost,
          tax: 0,
          total: guestCart.totalCost,
          totalItems: guestCart.itemCount,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };
    }
  } catch (error) {
    console.error('ShoppingCart: Error fetching cart', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Add item to cart (handles both authenticated and guest users)
// Endpoint: POST /api/cart/add (authenticated) or localStorage (guest)
// Request: { productId: string, quantity: number, product?: Product }
// Response: { success: boolean, message: string, cart: Cart }
export const addToCart = async (data: { productId: string; quantity: number; product?: Product }) => {
  try {
    if (isAuthenticated()) {
      const response = await api.post('/api/cart/add', { productId: data.productId, quantity: data.quantity });
      return response.data;
    } else {
      // Add to guest cart
      if (!data.product) {
        // Fetch product details if not provided
        const productResponse = await getProduct(data.productId);
        data.product = productResponse.product;
      }
      const guestCart = addToGuestCartStorage(data.product, data.quantity);
      return {
        success: true,
        message: 'Item added to cart successfully',
        cart: {
          _id: 'guest-cart',
          user: 'guest',
          items: guestCart.items.map(item => ({
            _id: item._id,
            productId: item.product,
            quantity: item.quantity,
            price: item.product.price
          })),
          repairOrders: guestCart.repairOrders,
          subtotal: guestCart.totalCost,
          tax: 0,
          total: guestCart.totalCost,
          totalItems: guestCart.itemCount,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };
    }
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update cart item quantity (handles both authenticated and guest users)
// Endpoint: PUT /api/cart/update (authenticated) or localStorage (guest)
// Request: { productId: string, quantity: number }
// Response: { success: boolean, message: string, cart: Cart }
export const updateCartItem = async (productId: string, quantity: number) => {
  try {
    if (isAuthenticated()) {
      const response = await api.put('/api/cart/update', { productId, quantity });
      return response.data;
    } else {
      // Update guest cart
      const guestCart = updateGuestCartItemStorage(productId, quantity);
      return {
        success: true,
        message: 'Cart updated successfully',
        cart: {
          _id: 'guest-cart',
          user: 'guest',
          items: guestCart.items.map(item => ({
            _id: item._id,
            productId: item.product,
            quantity: item.quantity,
            price: item.product.price
          })),
          repairOrders: guestCart.repairOrders,
          subtotal: guestCart.totalCost,
          tax: 0,
          total: guestCart.totalCost,
          totalItems: guestCart.itemCount,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };
    }
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Remove item from cart (handles both authenticated and guest users)
// Endpoint: DELETE /api/cart/remove/:productId (authenticated) or localStorage (guest)
// Request: { productId: string }
// Response: { success: boolean, message: string, cart: Cart }
export const removeFromCart = async (productId: string) => {
  try {
    if (isAuthenticated()) {
      const response = await api.delete(`/api/cart/remove/${productId}`);
      return response.data;
    } else {
      // Remove from guest cart
      const guestCart = removeFromGuestCartStorage(productId);
      return {
        success: true,
        message: 'Item removed from cart',
        cart: {
          _id: 'guest-cart',
          user: 'guest',
          items: guestCart.items.map(item => ({
            _id: item._id,
            productId: item.product,
            quantity: item.quantity,
            price: item.product.price
          })),
          repairOrders: guestCart.repairOrders,
          subtotal: guestCart.totalCost,
          tax: 0,
          total: guestCart.totalCost,
          totalItems: guestCart.itemCount,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };
    }
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Clear cart (handles both authenticated and guest users)
// Endpoint: DELETE /api/cart/clear (authenticated) or localStorage (guest)
// Request: {}
// Response: { success: boolean, message: string }
export const clearCart = async () => {
  try {
    if (isAuthenticated()) {
      const response = await api.delete('/api/cart/clear');
      return response.data;
    } else {
      // Clear guest cart
      clearGuestCartStorage();
      return {
        success: true,
        message: 'Cart cleared successfully'
      };
    }
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

// Repair Order interfaces
export interface RepairOrderData {
  deviceType: string;
  deviceBrand: string;
  deviceModel: string;
  services: string[];
  addOns?: Array<{
    name: string;
    description: string;
    price: number;
    estimatedTime: string;
  }>;
  customerNotes?: string;
  photos?: string[];
  totalCost: number;
  unlockPattern?: string[];
  unlockCode?: string;
  noLock?: boolean;
  // Additional repair information
  errorDescription?: string;
  waterDamage?: string;
  previousRepairAttempts?: string;
  previousRepairDetails?: string;
  itemCondition?: string;
}

// Description: Add repair order to cart (handles both authenticated and guest users)
// Endpoint: POST /api/cart/add-repair-order (authenticated) or localStorage (guest)
// Request: { deviceType: string, deviceBrand: string, deviceModel: string, services: string[], addOns: object[], customerNotes: string, photos: string[], totalCost: number, unlockPattern?: string[], unlockCode?: string, noLock?: boolean, errorDescription?: string, waterDamage?: string, previousRepairAttempts?: string, previousRepairDetails?: string, itemCondition?: string }
// Response: { success: boolean, message: string, cart: Cart }
export const addRepairOrderToCart = async (repairOrderData: RepairOrderData) => {
  try {
    if (isAuthenticated()) {
      const response = await api.post('/api/cart/add-repair-order', repairOrderData);
      return response.data;
    } else {
      // Add to guest cart
      const guestCart = addRepairOrderToGuestCartStorage(repairOrderData);
      return {
        success: true,
        message: 'Repair order added to cart successfully',
        cart: {
          _id: 'guest-cart',
          user: 'guest',
          items: guestCart.items.map(item => ({
            _id: item._id,
            productId: item.product,
            quantity: item.quantity,
            price: item.product.price
          })),
          repairOrders: guestCart.repairOrders,
          subtotal: guestCart.totalCost,
          tax: 0,
          total: guestCart.totalCost,
          totalItems: guestCart.itemCount,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };
    }
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Remove repair order from cart (handles both authenticated and guest users)
// Endpoint: DELETE /api/cart/remove-repair-order/:repairOrderId (authenticated) or localStorage (guest)
// Request: { repairOrderId: string }
// Response: { success: boolean, message: string, cart: Cart }
export const removeRepairOrderFromCart = async (repairOrderId: string) => {
  try {
    if (isAuthenticated()) {
      const response = await api.delete(`/api/cart/remove-repair-order/${repairOrderId}`);
      return response.data;
    } else {
      // Remove from guest cart
      const guestCart = removeRepairOrderFromGuestCartStorage(repairOrderId);
      return {
        success: true,
        message: 'Repair order removed from cart',
        cart: {
          _id: 'guest-cart',
          user: 'guest',
          items: guestCart.items.map(item => ({
            _id: item._id,
            productId: item.product,
            quantity: item.quantity,
            price: item.product.price
          })),
          repairOrders: guestCart.repairOrders,
          subtotal: guestCart.totalCost,
          tax: 0,
          total: guestCart.totalCost,
          totalItems: guestCart.itemCount,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };
    }
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};