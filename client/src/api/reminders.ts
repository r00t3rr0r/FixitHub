import api from './api';

export interface Reminder {
  _id: string;
  reminderNumber: string;
  bookingId: string;
  orderId?: string;
  customerId: {
    _id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    phone?: string;
    avatar?: string;
  };
  type: 'payment' | 'pickup' | 'followup' | 'feedback' | 'maintenance' | 'custom';
  title: string;
  message: string;
  scheduledDate: string;
  notificationMethod: Array<'email' | 'sms' | 'push' | 'in-app'>;
  status: 'scheduled' | 'sent' | 'delivered' | 'failed' | 'cancelled';
  sentAt?: string;
  deliveredAt?: string;
  failureReason?: string;
  createdBy: {
    _id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  createdByName?: string;
  recurring: {
    enabled: boolean;
    frequency?: 'daily' | 'weekly' | 'monthly';
    endDate?: string;
  };
  priority: 'low' | 'medium' | 'high';
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

// Description: Get all reminders for a booking
// Endpoint: GET /api/reminders/booking/:bookingId
// Request: {}
// Response: { success: boolean, reminders: Reminder[] }
export const getRemindersByBooking = async (bookingId: string) => {
  try {
    const response = await api.get(`/api/reminders/booking/${bookingId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get all reminders (admin only)
// Endpoint: GET /api/reminders
// Request: { status?: string, type?: string, dateFrom?: string, dateTo?: string, limit?: number, skip?: number }
// Response: { success: boolean, reminders: Reminder[] }
export const getAllReminders = async (filters?: {
  status?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  skip?: number;
}) => {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.skip) params.append('skip', filters.skip.toString());

    const queryString = params.toString();
    const endpoint = queryString ? `/api/reminders?${queryString}` : '/api/reminders';

    const response = await api.get(endpoint);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get a specific reminder by ID
// Endpoint: GET /api/reminders/:id
// Request: {}
// Response: { success: boolean, reminder: Reminder }
export const getReminder = async (reminderId: string) => {
  try {
    const response = await api.get(`/api/reminders/${reminderId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create a new reminder
// Endpoint: POST /api/reminders
// Request: { bookingId: string, orderId?: string, customerId: string, type: string, title: string, message: string, scheduledDate: string, notificationMethod?: string[], priority?: string, recurring?: object }
// Response: { success: boolean, reminder: Reminder }
export const createReminder = async (reminderData: {
  bookingId: string;
  orderId?: string;
  customerId: string;
  type: string;
  title: string;
  message: string;
  scheduledDate: string;
  notificationMethod?: string[];
  priority?: string;
  recurring?: {
    enabled: boolean;
    frequency?: string;
    endDate?: string;
  };
}) => {
  try {
    const response = await api.post('/api/reminders', reminderData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update reminder
// Endpoint: PUT /api/reminders/:id
// Request: { title?: string, message?: string, scheduledDate?: string, notificationMethod?: string[], priority?: string, recurring?: object }
// Response: { success: boolean, reminder: Reminder }
export const updateReminder = async (
  reminderId: string,
  updateData: {
    title?: string;
    message?: string;
    scheduledDate?: string;
    notificationMethod?: string[];
    priority?: string;
    recurring?: {
      enabled: boolean;
      frequency?: string;
      endDate?: string;
    };
  }
) => {
  try {
    const response = await api.put(`/api/reminders/${reminderId}`, updateData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update reminder status
// Endpoint: PUT /api/reminders/:id/status
// Request: { status: string }
// Response: { success: boolean, reminder: Reminder }
export const updateReminderStatus = async (reminderId: string, status: string) => {
  try {
    const response = await api.put(`/api/reminders/${reminderId}/status`, { status });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Cancel reminder
// Endpoint: PUT /api/reminders/:id/cancel
// Request: {}
// Response: { success: boolean, reminder: Reminder }
export const cancelReminder = async (reminderId: string) => {
  try {
    const response = await api.put(`/api/reminders/${reminderId}/cancel`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete reminder
// Endpoint: DELETE /api/reminders/:id
// Request: {}
// Response: { success: boolean }
export const deleteReminder = async (reminderId: string) => {
  try {
    const response = await api.delete(`/api/reminders/${reminderId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};
