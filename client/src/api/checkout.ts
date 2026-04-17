import api from './api';

export type CheckoutApiError = Error & {
  status?: number;
  missingFields?: Record<string, boolean>;
};

const toCheckoutError = (error: any, fallbackMessage: string): CheckoutApiError => {
  const responseData = error?.response?.data || error?.data || {};
  const message = responseData?.error || responseData?.message || error?.message || fallbackMessage;
  const enrichedError = new Error(message) as CheckoutApiError;
  enrichedError.status = error?.response?.status || error?.status;
  if (responseData?.missingFields && typeof responseData.missingFields === 'object') {
    enrichedError.missingFields = responseData.missingFields;
  }
  return enrichedError;
};

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
  items: unknown[];
  repairOrders: unknown[];
}

export interface CheckoutPaypalConfig {
  clientId: string;
  currency: string;
  intent: 'CAPTURE' | 'AUTHORIZE';
  locale: string;
  environment: 'sandbox' | 'live';
  button: {
    enabled: boolean;
    layout: 'vertical' | 'horizontal';
    color: 'gold' | 'blue' | 'silver';
    shape: 'rect' | 'pill';
    label: 'paypal' | 'pay' | 'checkout';
  };
}

export interface CheckoutPaypalCreateOrderResponse {
  success: boolean;
  orderId: string;
  amount: number;
  currency: string;
}

export interface CheckoutPaypalCaptureOrderResponse {
  success: boolean;
  alreadyCaptured?: boolean;
  orderId: string;
  captureId: string;
  amount: number;
  currency: string;
  receipt: {
    paymentId: string;
    transactionId: string;
  };
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
    throw toCheckoutError(error, 'Checkout failed');
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
    throw toCheckoutError(error, 'Guest checkout failed');
  }
};

export const getCheckoutPaypalConfig = async (): Promise<CheckoutPaypalConfig> => {
  try {
    const response = await api.get('/api/checkout/paypal/config');
    return response.data;
  } catch (error: any) {
    throw toCheckoutError(error, 'Failed to load PayPal configuration');
  }
};

export const createCheckoutPaypalOrder = async (payload?: {
  returnPath?: string;
}): Promise<CheckoutPaypalCreateOrderResponse> => {
  try {
    const response = await api.post('/api/checkout/paypal/create-order', payload || {});
    return response.data;
  } catch (error: any) {
    throw toCheckoutError(error, 'Failed to create PayPal order');
  }
};

export const captureCheckoutPaypalOrder = async (orderId: string): Promise<CheckoutPaypalCaptureOrderResponse> => {
  try {
    const response = await api.post('/api/checkout/paypal/capture-order', { orderId });
    return response.data;
  } catch (error: any) {
    throw toCheckoutError(error, 'Failed to capture PayPal order');
  }
};

export const getGuestCheckoutPaypalConfig = async (): Promise<CheckoutPaypalConfig> => {
  try {
    const response = await api.get('/api/checkout/paypal/guest/config');
    return response.data;
  } catch (error: any) {
    throw toCheckoutError(error, 'Failed to load guest PayPal configuration');
  }
};

export const createGuestCheckoutPaypalOrder = async (payload: {
  guestInfo: GuestCheckoutData;
  cartData: GuestCartData;
  returnPath?: string;
}): Promise<CheckoutPaypalCreateOrderResponse> => {
  try {
    const response = await api.post('/api/checkout/paypal/guest/create-order', payload);
    return response.data;
  } catch (error: any) {
    throw toCheckoutError(error, 'Failed to create guest PayPal order');
  }
};

export const captureGuestCheckoutPaypalOrder = async (payload: {
  orderId: string;
  guestInfo: GuestCheckoutData;
}): Promise<CheckoutPaypalCaptureOrderResponse> => {
  try {
    const response = await api.post('/api/checkout/paypal/guest/capture-order', payload);
    return response.data;
  } catch (error: any) {
    throw toCheckoutError(error, 'Failed to capture guest PayPal order');
  }
};
