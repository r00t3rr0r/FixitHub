import api from './api';

export interface BillingAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface UserInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  country: string;
  vatId: string;
  billingAddress: BillingAddress;
  shippingAddress: ShippingAddress;
}

export interface CheckoutRegistrationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  company?: string;
  country?: string;
  vatId?: string;
  billingAddress?: BillingAddress;
  shippingAddress?: ShippingAddress;
}

export interface GuestCheckoutData {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  billingAddress: BillingAddress;
  shippingAddress: ShippingAddress;
}

export interface GuestCartData {
  items: any[];
  repairOrders: any[];
}

// Description: Initialize checkout - validates user authentication and returns cart with user info
// Endpoint: POST /api/checkout/initialize
// Request: {}
// Response: { success: boolean, cart: Cart, userInfo: UserInfo }
export const initializeCheckout = async () => {
  try {
    const response = await api.post('/api/checkout/initialize');
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Register guest user with extended profile during checkout
// Endpoint: POST /api/checkout/register
// Request: { email, password, firstName, lastName, phone, company, country, vatId, billingAddress, shippingAddress }
// Response: { success: boolean, message: string, user: User, accessToken: string, refreshToken: string }
export const registerDuringCheckout = async (data: CheckoutRegistrationData) => {
  try {
    const response = await api.post('/api/checkout/register', data);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Complete checkout - creates orders from cart repair orders and clears cart
// Endpoint: POST /api/checkout/complete
// Request: { paymentMethod?: string, paymentData?: Record<string, string> }
// Response: { success: boolean, message: string, orders: Order[], orderIds: string[] }
export const completeCheckout = async (
  paymentMethod?: string,
  paymentData?: Record<string, string>
) => {
  try {
    const response = await api.post('/api/checkout/complete', { paymentMethod, paymentData });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Complete guest checkout - creates orders from guest cart data without authentication
// Endpoint: POST /api/checkout/guest-complete
// Request: { guestInfo: { email, firstName, lastName, phone, billingAddress, shippingAddress }, cartData: { items, repairOrders }, paymentMethod?: string, paymentData?: Record<string, string> }
// Response: { success: boolean, message: string, orders: Order[], orderIds: string[], guestEmail: string }
export const completeGuestCheckout = async (
  guestInfo: GuestCheckoutData,
  cartData: GuestCartData,
  paymentMethod?: string,
  paymentData?: Record<string, string>
) => {
  try {
    const response = await api.post('/api/checkout/guest-complete', {
      guestInfo,
      cartData,
      paymentMethod,
      paymentData,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};
