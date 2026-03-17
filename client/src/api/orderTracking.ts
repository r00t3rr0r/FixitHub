import api from './api';

export interface TrackingData {
  token: string;
  email: string;
}

export interface TrackedOrder {
  _id: string;
  orderNumber: string;
  status: string;
  progress: number;
  deviceBrand: string;
  deviceModel: string;
  deviceType: string;
  totalCost: number;
  services: any[];
  addOns: any[];
  shopProducts: any[];
  timeline: any[];
  customerNotes: string;
  photos: string[];
  estimatedCompletion: Date | null;
  guestInfo: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    billingAddress: any;
    shippingAddress: any;
  };
  shippingStatus?: string;
  trackingNumber?: string;
  carrier?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrackingResponse {
  success: boolean;
  order: TrackedOrder;
  relatedOrders: any[];
  booking: any | null;
}

// Description: Track guest order using tracking token and email
// Endpoint: GET /api/track-order
// Query Params: token, email
// Response: { success: boolean, order: TrackedOrder, relatedOrders: any[], booking: any }
export const trackOrder = async (data: TrackingData): Promise<TrackingResponse> => {
  try {
    const response = await api.get('/api/track-order', {
      params: {
        token: data.token,
        email: data.email
      }
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export interface BookingTrackingResponse {
  success: boolean;
  booking: any;
  orders: TrackedOrder[];
}

// Description: Track guest booking using tracking token and email
// Endpoint: GET /api/track-order/booking
// Query Params: token, email
// Response: { success: boolean, booking: any, orders: TrackedOrder[] }
export const trackBooking = async (data: TrackingData): Promise<BookingTrackingResponse> => {
  try {
    const response = await api.get('/api/track-order/booking', {
      params: {
        token: data.token,
        email: data.email
      }
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};
