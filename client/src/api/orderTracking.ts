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

export interface BookingNumberTrackingData {
  bookingNumber: string;
  email: string;
}

export interface GuestTrackingAccess {
  token?: string;
  bookingNumber?: string;
  email: string;
}

export interface GuestCommunicationMessage {
  _id: string;
  senderType: 'staff' | 'customer' | 'system';
  senderName: string;
  senderRole?: string;
  messageType: 'text' | 'feedback_request' | 'quick_action' | 'system_notification' | 'repair_offer';
  content: string;
  feedbackRequest?: {
    question: string;
    options: Array<{ label: string; value: string }>;
    response?: { label: string; value: string };
    respondedAt?: string;
    status: 'pending' | 'responded' | 'expired';
  };
  quickAction?: {
    actionType: string;
    actionLabel: string;
    description?: string;
    status: 'pending' | 'completed' | 'cancelled';
    createdAt: string;
    completedAt?: string;
  };
  createdAt: string;
}

export interface GuestOrderCommunication {
  _id: string;
  orderId: string;
  status: 'active' | 'archived' | 'resolved';
  pendingFeedbackCount: number;
  pendingActionsCount: number;
  lastMessageAt?: string;
  messages: GuestCommunicationMessage[];
}

export const trackBookingByNumber = async (data: BookingNumberTrackingData): Promise<BookingTrackingResponse> => {
  try {
    const response = await api.get('/api/track-order/by-number', {
      params: {
        bookingNumber: data.bookingNumber,
        email: data.email
      }
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const getGuestBookingOrderCommunication = async (
  orderId: string,
  access: GuestTrackingAccess
): Promise<{ success: boolean; communication: GuestOrderCommunication | null }> => {
  try {
    const response = await api.get(`/api/track-order/booking/${orderId}/communication`, {
      params: {
        token: access.token,
        bookingNumber: access.bookingNumber,
        email: access.email,
      },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const sendGuestBookingOrderMessage = async (
  orderId: string,
  access: GuestTrackingAccess,
  content: string
): Promise<{ success: boolean; communication: GuestOrderCommunication }> => {
  try {
    const response = await api.post(`/api/track-order/booking/${orderId}/communication/message`, {
      token: access.token,
      bookingNumber: access.bookingNumber,
      email: access.email,
      content,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const respondGuestBookingOrderFeedback = async (
  orderId: string,
  messageId: string,
  selectedResponse: { label: string; value: string },
  access: GuestTrackingAccess
): Promise<{ success: boolean; communication: GuestOrderCommunication }> => {
  try {
    const response = await api.post(`/api/track-order/booking/${orderId}/communication/feedback-response`, {
      token: access.token,
      bookingNumber: access.bookingNumber,
      email: access.email,
      messageId,
      response: selectedResponse,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export const completeGuestBookingOrderAction = async (
  orderId: string,
  messageId: string,
  access: GuestTrackingAccess
): Promise<{ success: boolean; communication: GuestOrderCommunication }> => {
  try {
    const response = await api.put(`/api/track-order/booking/${orderId}/communication/quick-action/${messageId}/complete`, {
      token: access.token,
      bookingNumber: access.bookingNumber,
      email: access.email,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};
