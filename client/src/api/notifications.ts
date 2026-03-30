import api from './api';

export interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'order_update' | 'payment' | 'message' | 'system' | 'assignment' | 'reminder';
  isRead: boolean;
  createdAt: string;
  orderId?: string;
  actionUrl?: string;
}

// Description: Get user notifications
// Endpoint: GET /api/notifications
// Request: { limit?: number, unreadOnly?: boolean }
// Response: { notifications: Notification[], unreadCount: number }
export const getNotifications = async (params: any = {}) => {
  try {
    const response = await api.get('/api/notifications', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Mark notification as read
// Endpoint: PUT /api/notifications/:id/read
// Request: {}
// Response: { success: boolean, notification: Notification }
export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const response = await api.put(`/api/notifications/${notificationId}/read`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Mark all notifications as read
// Endpoint: PUT /api/notifications/read-all
// Request: {}
// Response: { success: boolean, count: number }
export const markAllNotificationsAsRead = async () => {
  try {
    const response = await api.put('/api/notifications/read-all');
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete a single notification
// Endpoint: DELETE /api/notifications/:id
// Request: {}
// Response: { success: boolean }
export const deleteNotification = async (notificationId: string) => {
  try {
    const response = await api.delete(`/api/notifications/${notificationId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete all notifications
// Endpoint: DELETE /api/notifications
// Request: {}
// Response: { success: boolean, count: number }
export const deleteAllNotifications = async () => {
  try {
    const response = await api.delete('/api/notifications');
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};