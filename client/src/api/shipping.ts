import api from './api';

export interface ShipmentData {
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  serviceType?: string;
  shipperAddress?: string;
  shipperCity?: string;
  shipperPostalCode?: string;
  shipperCountry?: string;
  shipperEmail?: string;
  shipperPhone?: string;
  shipperCompany?: string;
  shipperName?: string;
  receiverName?: string;
  receiverAddress?: string;
  receiverCity?: string;
  receiverPostalCode?: string;
  receiverCountry?: string;
  receiverEmail?: string;
  receiverPhone?: string;
  receiverNumber?: string;
  shippingCost?: number;
  isCustomsDeclarable?: boolean;
  parcelDePickupPayload?: Record<string, unknown>;
}

export interface PickupSearchQuery {
  postalCode?: string;
  city?: string;
  street?: string;
  houseNumber?: string;
  countryCode?: string;
  radius?: number;
  limit?: number;
  locationType?: 'branch' | 'locker' | 'retail' | string;
  branchCode?: string;
  retailID?: string;
  preferNearest?: boolean;
}

export interface PickupLocation {
  id: string;
  name: string;
  type: string;
  distance: number;
  branchCode?: string;
  retailID?: string;
  address: {
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
    countryCode: string;
  };
  raw?: Record<string, unknown>;
}

export interface PickupLocationsResult {
  success: boolean;
  count: number;
  locations: PickupLocation[];
  query?: Record<string, unknown>;
  endpoint?: string;
}

export interface TrackingEvent {
  timestamp: string;
  location: string;
  status: string;
  description: string;
}

export interface TrackingInfo {
  success: boolean;
  trackingNumber: string;
  status: string;
  description: string;
  estimatedDelivery?: string;
  events: TrackingEvent[];
  order?: {
    orderNumber: string;
    shippingStatus: string;
    estimatedDelivery?: string;
    actualDelivery?: string;
    trackingEvents: TrackingEvent[];
  };
}

export interface ShipmentResult {
  success: boolean;
  trackingNumber: string;
  labelUrl: string;
  estimatedDelivery: string;
  shipmentId: string;
  error?: string;
}

// Description: Create shipping label for an order
// Endpoint: POST /api/orders/:id/shipping/create-label
// Request: { shipmentData: ShipmentData }
// Response: ShipmentResult
export const createShippingLabel = async (orderId: string, shipmentData: ShipmentData): Promise<ShipmentResult> => {
  try {
    const response = await api.post(`/api/orders/${orderId}/shipping/create-label`, { shipmentData });
    return response.data;
  } catch (error: any) {
    console.error('Create shipping label error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get tracking information for an order
// Endpoint: GET /api/orders/:id/tracking
// Request: {}
// Response: TrackingInfo
export const getOrderTracking = async (orderId: string): Promise<TrackingInfo> => {
  try {
    const response = await api.get(`/api/orders/${orderId}/tracking`);
    return response.data;
  } catch (error: any) {
    console.error('Get tracking info error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update order tracking from DHL API
// Endpoint: PUT /api/orders/:id/tracking/update
// Request: {}
// Response: { success: boolean, order: Order, trackingInfo: TrackingInfo }
export const updateOrderTracking = async (orderId: string) => {
  try {
    const response = await api.put(`/api/orders/${orderId}/tracking/update`);
    return response.data;
  } catch (error: any) {
    console.error('Update tracking error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Lookup DHL pickup locations for an order shipping flow
// Endpoint: POST /api/orders/:id/shipping/pickup-locations
// Request: PickupSearchQuery
// Response: PickupLocationsResult
export const lookupPickupLocations = async (
  orderId: string,
  query: PickupSearchQuery
): Promise<PickupLocationsResult> => {
  try {
    const response = await api.post(`/api/orders/${orderId}/shipping/pickup-locations`, query);
    return response.data;
  } catch (error: any) {
    console.error('Lookup pickup locations error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
