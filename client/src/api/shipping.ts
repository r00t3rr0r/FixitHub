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
  receiverAddress?: string;
  receiverCity?: string;
  receiverPostalCode?: string;
  receiverCountry?: string;
  shippingCost?: number;
  isCustomsDeclarable?: boolean;
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
