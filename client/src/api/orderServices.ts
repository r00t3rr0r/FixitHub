import api from './api';

// Description: Get all services for an order (populated with full service details)
// Endpoint: GET /api/order-services/:orderId
// Request: {}
// Response: { services: Array<{ _id, serviceId, price, estimatedTime, notes }> }
export const getOrderServices = async (orderId: string) => {
  try {
    const response = await api.get(`/api/order-services/${orderId}`);
    return response.data;
  } catch (error: any) {
    console.error(`Error fetching order services: ${error.message}`);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update an existing repair service in an order
// Endpoint: PUT /api/order-services/:orderId/:serviceId
// Request: { price?: number, estimatedTime?: number, notes?: string }
// Response: { order: Order }
export const updateOrderService = async (
  orderId: string,
  serviceId: string,
  data: {
    price?: number;
    estimatedTime?: number;
    notes?: string;
  }
) => {
  try {
    const response = await api.put(
      `/api/order-services/${orderId}/${serviceId}`,
      data
    );
    console.log(`Service ${serviceId} updated in order ${orderId}`);
    return response.data;
  } catch (error: any) {
    console.error(`Error updating order service: ${error.message}`);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Add a new repair service to an order
// Endpoint: POST /api/order-services/:orderId
// Request: { serviceId: string, price?: number, estimatedTime?: number, notes?: string }
// Response: { order: Order }
export const addServiceToOrder = async (
  orderId: string,
  serviceId: string,
  options?: {
    price?: number;
    estimatedTime?: number;
    notes?: string;
  }
) => {
  try {
    const response = await api.post(`/api/order-services/${orderId}`, {
      serviceId,
      ...options,
    });
    console.log(`Service ${serviceId} added to order ${orderId}`);
    return response.data;
  } catch (error: any) {
    console.error(`Error adding service to order: ${error.message}`);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Remove a repair service from an order
// Endpoint: DELETE /api/order-services/:orderId/:serviceId
// Request: {}
// Response: { order: Order }
export const removeServiceFromOrder = async (
  orderId: string,
  serviceId: string
) => {
  try {
    const response = await api.delete(
      `/api/order-services/${orderId}/${serviceId}`
    );
    console.log(`Service ${serviceId} removed from order ${orderId}`);
    return response.data;
  } catch (error: any) {
    console.error(`Error removing service from order: ${error.message}`);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
