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

// ── DHL Location Finder ──────────────────────────────────────────────────────

export interface DhlLocationAddress {
  street: string;
  city: string;
  postalCode: string;
  countryCode: string;
}

export interface DhlOpeningHours {
  dayOfWeek: string[];
  opens: string;
  closes: string;
}

export interface DhlLocation {
  locationId: string;
  /** "locker" = Packstation, "postoffice" = Postfiliale, "servicepoint" = Paketshop, "postbank" */
  type: 'locker' | 'postoffice' | 'servicepoint' | 'postbank' | string;
  keyword: string;
  keywordId: string;
  name: string;
  distance: number;
  address: DhlLocationAddress;
  openingHours: DhlOpeningHours[];
}

// Description: Search for nearby DHL locations (Packstations, Postfilialen, Paketshops)
// Endpoint: GET /api/dhl/locations
// Request: { query, countryCode?, locationType? }
// Response: { locations: DhlLocation[] }
export const searchDhlLocations = async (
  query: string,
  countryCode = 'DE',
  locationType?: string,
): Promise<DhlLocation[]> => {
  const response = await api.get('/api/dhl/locations', {
    params: { query, countryCode, ...(locationType ? { locationType } : {}) },
  });
  if (response.status !== 200) {
    throw new Error(response.data?.error || 'Fehler beim Laden der DHL-Standorte');
  }
  return response.data?.locations ?? [];
};
