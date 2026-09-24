import api from './api';

export interface CustomerInfo {
  _id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  paymentMethods?: {
    type: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
    isDefault: boolean;
  }[];
  isActive: boolean;
  role: string;
  createdAt: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  bookingId?: string;
  customerId: CustomerInfo;
  guestInfo?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    isGuest?: boolean;
    billingAddress?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
    shippingAddress?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
  };
  deviceBrand: string;
  deviceModel: string;
  deviceType?: string;
  services: string[];
  addOns: AddOnService[];
  status: 'pending' | 'in-progress' | 'paused' | 'quality-check' | 'completed' | 'ready-for-pickup';
  estimatedCompletion: string;
  totalCost: number;
  // Money, gross-first: totalCost is the GROSS total AFTER discount, `discount` is
  // the gross discount already contained in it, netAmount/taxAmount are derived
  // from totalCost and taxRate is a PERCENT (19), never a fraction.
  discount?: number;
  appliedPromoCode?: string;
  originalGrossAmount?: number;
  dealerDiscountPercent?: number;
  dealerDiscountAmount?: number;
  netAmount?: number;
  taxAmount?: number;
  taxRate?: number;
  // Reconciliation of the stored position list prices with the discounted total.
  pricing?: OrderPricingSummary;
  createdAt: string;
  updatedAt?: string;
  photos: string[];
  customerNotes: string;
  staffNotes: string[];
  ePartNeedListEntries?: Array<{
    _id: string;
    partId: {
      _id: string;
      itemName: string;
      itemDescription: string;
      category: string;
      sku: string;
    };
    quantity: number;
    needListId?: {
      _id: string;
      name: string;
      status: 'draft' | 'ready' | 'ordered' | 'archived';
    } | null;
    needListName: string;
    needListStatus: 'draft' | 'ready' | 'ordered' | 'archived';
    targetType: 'existing' | 'new' | 'today';
    notes?: string;
    requestedAt: string;
    requestedBy?: {
      _id: string;
      name: string;
      email: string;
    } | null;
  }>;
  progress: number;
  timeline?: Array<{
    _id?: string;
    status?: string;
    description?: string;
    completedAt?: string;
    staffId?: string;
    staffName?: string;
  }>;
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'partial';
  // Device unlock information
  unlockPattern?: string[];
  unlockCode?: string;
  noLock?: boolean;
  unlockConfirmation?: {
    confirmedBy?: string;
    confirmedByName?: string;
    confirmedAt?: string;
    confirmationStatus?: 'verified' | 'incorrect' | 'unable-to-verify';
    notes?: string;
  };
  pickupConfirmation?: {
    confirmedBy?: string;
    confirmedByName?: string;
    confirmedAt?: string;
  };
  // Additional repair information from Step 3
  errorDescription?: string;
  waterDamage?: 'yes' | 'no' | 'dont-know' | '';
  previousRepairAttempts?: 'yes' | 'no' | 'dont-know' | '';
  previousRepairDetails?: string;
  itemCondition?: 'original' | 'refurbished' | '';
  imei?: string;
  serialNumber?: string;
  // Shipping and tracking information
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  trackingNumber?: string;
  carrier?: string;
  shippingStatus?: 'pending' | 'label-created' | 'shipped' | 'in-transit' | 'out-for-delivery' | 'delivered' | 'failed';
  shippingStatusDescription?: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  shippingLabelUrl?: string;
  shippingCost?: number;
  returnLabelUrl?: string;
  returnQRCodeUrl?: string;
  returnTrackingNumber?: string;
  returnShipmentId?: string;
  returnShipmentStatus?: 'pending' | 'label-created' | 'in-transit' | 'delivered' | 'failed' | '';
  returnShipmentStatusDescription?: string;
  returnCreatedAt?: string;
  returnReceivedAt?: string;
  // returnLabelUrl holds a full base64 PDF and is therefore NOT part of the order
  // detail payload; use this flag to decide whether a download can be offered.
  hasReturnLabel?: boolean;
  trackingEvents?: Array<{
    timestamp: string;
    location: string;
    status: string;
    description: string;
  }>;
  hasComplaint?: boolean;
  complaintReason?: string;
  complaintId?: string;
  complaintNumber?: string;
  complaintStatus?: string;
  complaintOrderId?: string;
  complaintOrderNumber?: string;
  isComplaintFollowup?: boolean;
  parentOrderId?: string;
  sourceComplaintId?: string;
}

// Money breakdown of an order, computed server-side (OrderService.buildOrderPricingSummary).
// This is the SINGLE AUTHORITY for the order money on the detail screen - the client
// renders it, it does not recompute it.
// positionsGross is the sum of the stored GROSS LIST prices of all positions,
// grossTotal is order.totalCost MINUS dealerDiscountAmount (the Haendlerrabatt is not
// yet contained in totalCost), so every discount is subtracted from the gross exactly
// once. netTotal = grossTotal / (1 + taxRate/100); taxRate is a PERCENT (19).
export interface OrderPricingSummary {
  positionsGross: number;
  servicesGross: number;
  addOnsGross: number;
  shopProductsGross: number;
  discount: number;
  appliedPromoCode?: string;
  dealerDiscountPercent: number;
  dealerDiscountAmount: number;
  grossTotal: number;
  netTotal: number;
  taxAmount: number;
  taxRate: number;
  positionsReconcile: boolean;
}

export interface CustomerOrderInvoice {
  _id: string;
  invoiceNumber?: string;
  status?: string;
  total?: number;
  createdAt?: string;
  dueDate?: string;
  isCreditNote?: boolean;
  orderId?: any;
  bookingId?: any;
  repairOrderIds?: any[];
}

export interface AddOnService {
  _id: string;
  name: string;
  description: string;
  price: number;
  status: 'pending' | 'in-progress' | 'completed';
  estimatedTime: string;
}

export interface ShopProduct {
  _id: string;
  productId: {
    _id: string;
    name: string;
    price: number;
    images: string[];
    category: string;
    brand: string;
    stock: number;
  };
  quantity: number;
  priceAtOrder: number;
  addedAt: string;
  addedBy: {
    _id: string;
    name: string;
    email: string;
  };
}

// Description: Get all orders for the current user
// Endpoint: GET /api/orders
// Request: {}
// Response: { orders: Order[] }
export const getOrders = async () => {
  console.log('API: Making request to /api/orders');
  try {
    const response = await api.get('/api/orders');
    console.log('API: Received response from /api/orders:', response);
    console.log('API: Response data:', response.data);
    return response.data;
  } catch (error) {
    console.error('API: Error in getOrders:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create a new repair order
// Endpoint: POST /api/orders
// Request: { deviceBrand: string, deviceModel: string, services: string[], addOns: string[], customerNotes: string, photos: File[] }
// Response: { success: boolean, orderId: string, orderNumber: string, message: string }
export const createOrder = async (orderData: any) => {
  console.log('createOrder called with data:', orderData);
  
  try {
    const response = await api.post('/api/orders', orderData);
    console.log('createOrder API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('createOrder API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get order details by ID
// Endpoint: GET /api/orders/:id
// Request: {}
// Response: { order: Order }
export const getOrderById = async (orderId: string) => {
  console.log('getOrderById called with ID:', orderId);

  try {
    const response = await api.get(`/api/orders/${orderId}`);
    console.log('getOrderById API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('getOrderById API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Download shipping label PDF for an order
// Endpoint: GET /api/orders/:id/shipping-label
// Response: PDF file blob
export const downloadOrderShippingLabel = async (orderId: string, filename?: string) => {
  const response = await api.get(`/api/orders/${orderId}/shipping-label`, {
    responseType: 'blob',
    transformResponse: undefined,
    validateStatus: (status: number) => status === 200,
  });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `versandlabel-${orderId}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// Description: Create a return label for an order that has no linked booking
// Endpoint: POST /api/orders/:id/return-label
// Response: { success: boolean, returnId, returnTrackingNumber, labelUrl, qrCodeUrl, order }
export const createOrderReturnLabel = async (orderId: string) => {
  try {
    const response = await api.post(`/api/orders/${orderId}/return-label`);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Download return label PDF for an order
// Endpoint: GET /api/orders/:id/return-label
// Response: PDF file blob
export const downloadOrderReturnLabel = async (orderId: string, filename?: string) => {
  const response = await api.get(`/api/orders/${orderId}/return-label`, {
    responseType: 'blob',
    transformResponse: undefined,
    validateStatus: (status: number) => status === 200,
  });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `ruecksendelabel-${orderId}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// Description: Load the invoices the AUTHENTICATED CUSTOMER may see for one order.
//              Uses the customer-scoped invoice endpoint (server/routes/invoiceRoutes.js
//              GET /api/invoices), which is hard-filtered to `customerId: req.user._id`
//              and excludes drafts - so no other customer's documents can be reached.
//              orderId/bookingId are passed as query parameters for the day the server
//              filters on them; until then the filtering happens here on an already
//              owner-scoped result set.
// Endpoint: GET /api/invoices?orderId=&bookingId=&limit=
// Response: { success: boolean, invoices: CustomerOrderInvoice[], count: number }
export const getCustomerInvoicesForOrder = async (
  orderId: string,
  bookingId?: string | null
): Promise<CustomerOrderInvoice[]> => {
  // Exactly ONE request.
  // Booked order: GET /api/bookings/:id/invoices is server-side scoped to this
  // booking, runs an owner-or-staff check and excludes Entwuerfe for a customer
  // (server/routes/bookingRoutes.js). It is a true superset of what this page needs:
  // BookingService.getBookingInvoices matches bookingId OR orderId/repairOrderIds of
  // the booking's orders, so documents that are linked only to the ORDER (legacy
  // invoices and credit notes written before the bookingId copy landed) are included.
  // That is why the second, identical /api/invoices call the previous version fired
  // is gone without losing coverage.
  // Standalone order: fall back to the owner-scoped list. The server does not filter
  // by orderId yet (it ignores the parameter), so the narrowing below still runs
  // locally; send the parameter anyway so it starts working the moment it lands.
  const fetchInvoices = async (): Promise<CustomerOrderInvoice[]> => {
    if (bookingId) {
      const response = await api.get(`/api/bookings/${bookingId}/invoices`);
      return Array.isArray(response?.data?.invoices) ? response.data.invoices : [];
    }
    const params = new URLSearchParams({ limit: '100', orderId });
    const response = await api.get(`/api/invoices?${params.toString()}`);
    return Array.isArray(response?.data?.invoices) ? response.data.invoices : [];
  };

  const invoices = await fetchInvoices();

  const idOf = (value: any): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return String(value._id || value.id || '');
  };

  const wantedOrderId = String(orderId || '');
  const wantedBookingId = String(bookingId || '');

  return invoices
    .filter((invoice) => {
      // Entwuerfe are never shown here. Both endpoints already drop them for a
      // customer; this keeps the promise if the helper is ever called as staff.
      if (String(invoice?.status || '').toLowerCase() === 'draft') return false;
      if (wantedOrderId && idOf(invoice.orderId) === wantedOrderId) return true;
      if (wantedOrderId && Array.isArray(invoice.repairOrderIds)
        && invoice.repairOrderIds.some((entry) => idOf(entry) === wantedOrderId)) return true;
      if (wantedBookingId && idOf(invoice.bookingId) === wantedBookingId) return true;
      return false;
    })
    .sort((a, b) => {
      const aDate = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });
};

// Description: Download an invoice PDF as the owning customer. The endpoint runs
//              assertInvoiceOwner (server/routes/invoiceRoutes.js) and refuses drafts,
//              so a customer can only ever fetch their own finalised documents.
// Endpoint: GET /api/invoices/:id/pdf
// Response: PDF file blob
export const downloadCustomerInvoicePdf = async (invoiceId: string, filename?: string) => {
  const response = await api.get(`/api/invoices/${invoiceId}/pdf`, {
    responseType: 'blob',
    transformResponse: undefined,
    validateStatus: (status: number) => status === 200,
  });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `rechnung-${invoiceId}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// Description: Get order progress timeline with milestone data
// Endpoint: GET /api/orders/:id/progress-timeline
// Request: {}
// Response: { stages: Array<{ id: string, label: string, status: string, date?: string }>, currentStage: string }
export const getOrderProgressTimeline = async (orderId: string) => {
  console.log('getOrderProgressTimeline called with ID:', orderId);

  try {
    const response = await api.get(`/api/orders/${orderId}/progress-timeline`);
    console.log('getOrderProgressTimeline API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('getOrderProgressTimeline API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Add shop product to order
// Endpoint: POST /api/admin/orders/:id/shop-products
// Request: { productId: string, quantity: number }
// Response: { success: boolean, message: string, order: Order }
export const addShopProductToOrder = async (orderId: string, productId: string, quantity: number) => {
  console.log('addShopProductToOrder called with:', { orderId, productId, quantity });

  try {
    const response = await api.post(`/api/admin/orders/${orderId}/shop-products`, {
      productId,
      quantity
    });
    console.log('addShopProductToOrder API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('addShopProductToOrder API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update shop product quantity in order
// Endpoint: PUT /api/admin/orders/:id/shop-products/:productItemId
// Request: { quantity: number }
// Response: { success: boolean, message: string, order: Order }
export const updateShopProductQuantity = async (orderId: string, productItemId: string, quantity: number) => {
  console.log('updateShopProductQuantity called with:', { orderId, productItemId, quantity });

  try {
    const response = await api.put(`/api/admin/orders/${orderId}/shop-products/${productItemId}`, {
      quantity
    });
    console.log('updateShopProductQuantity API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('updateShopProductQuantity API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Remove shop product from order
// Endpoint: DELETE /api/admin/orders/:id/shop-products/:productItemId
// Request: {}
// Response: { success: boolean, message: string, order: Order }
export const removeShopProductFromOrder = async (orderId: string, productItemId: string) => {
  console.log('removeShopProductFromOrder called with:', { orderId, productItemId });

  try {
    const response = await api.delete(`/api/admin/orders/${orderId}/shop-products/${productItemId}`);
    console.log('removeShopProductFromOrder API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('removeShopProductFromOrder API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create complaint for a completed order
// Endpoint: POST /api/orders/:orderId/complaint
// Request: { reason: string, description: string }
// Response: { success: boolean, complaint: Complaint }
export const createOrderComplaint = async (orderId: string, payload: { reason: string; description: string }) => {
  try {
    const response = await api.post(`/api/orders/${orderId}/complaint`, payload);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};