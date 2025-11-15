import api from './api';

// Kanban Column Interface
export interface KanbanColumn<T> {
  label: string;
  orders?: T[];
  bookings?: T[];
}

// Orders Kanban Response
export interface OrdersKanbanResponse {
  columns: {
    [status: string]: KanbanColumn<any>;
  };
}

// Bookings Kanban Response
export interface BookingsKanbanResponse {
  columns: {
    [status: string]: KanbanColumn<any>;
  };
}

// Description: Get orders grouped by status for Kanban view
// Endpoint: GET /api/kanban/orders
// Request: { search?: string, priority?: string }
// Response: { columns: { [status]: { label: string, orders: Order[] } } }
export const getOrdersKanban = async (filters?: { search?: string; priority?: string }): Promise<OrdersKanbanResponse> => {
  try {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.priority) params.append('priority', filters.priority);

    const response = await api.get(`/api/kanban/orders?${params.toString()}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get bookings grouped by status for Kanban view
// Endpoint: GET /api/kanban/bookings
// Request: { search?: string, billingStatus?: string }
// Response: { columns: { [status]: { label: string, bookings: Booking[] } } }
export const getBookingsKanban = async (filters?: { search?: string; billingStatus?: string }): Promise<BookingsKanbanResponse> => {
  try {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.billingStatus) params.append('billingStatus', filters.billingStatus);

    const response = await api.get(`/api/kanban/bookings?${params.toString()}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update order status via Kanban drag-and-drop
// Endpoint: PUT /api/kanban/orders/:id/status
// Request: { status: string }
// Response: { order: Order }
export const updateOrderStatus = async (orderId: string, status: string): Promise<any> => {
  try {
    const response = await api.put(`/api/kanban/orders/${orderId}/status`, { status });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update booking status via Kanban drag-and-drop
// Endpoint: PUT /api/kanban/bookings/:id/status
// Request: { status: string }
// Response: { booking: Booking }
export const updateBookingStatus = async (bookingId: string, status: string): Promise<any> => {
  try {
    const response = await api.put(`/api/kanban/bookings/${bookingId}/status`, { status });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};
