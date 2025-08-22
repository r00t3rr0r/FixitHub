import api from './api';

export interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'order_update' | 'payment' | 'message' | 'system';
  isRead: boolean;
  createdAt: string;
  orderId?: string;
  actionUrl?: string;
}

// Description: Get user notifications
// Endpoint: GET /api/notifications
// Request: { limit?: number, unreadOnly?: boolean }
// Response: { notifications: Notification[], unreadCount: number }
export const getNotifications = (params: any = {}) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        notifications: [
          {
            _id: 'notif1',
            title: 'Order Status Update',
            message: 'Your iPhone 14 Pro repair is now in progress',
            type: 'order_update',
            isRead: false,
            createdAt: '2024-01-15T10:30:00Z',
            orderId: '1',
            actionUrl: '/orders/1'
          },
          {
            _id: 'notif2',
            title: 'Payment Processed',
            message: 'Payment of $299 has been successfully processed',
            type: 'payment',
            isRead: false,
            createdAt: '2024-01-15T09:15:00Z',
            actionUrl: '/orders/1'
          },
          {
            _id: 'notif3',
            title: 'New Message',
            message: 'You have a new message from your repair technician',
            type: 'message',
            isRead: true,
            createdAt: '2024-01-14T16:45:00Z',
            actionUrl: '/messages'
          }
        ],
        unreadCount: 2
      });
    }, 300);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.get('/api/notifications', { params });
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};

// Description: Mark notification as read
// Endpoint: PUT /api/notifications/:id/read
// Request: {}
// Response: { success: boolean }
export const markNotificationAsRead = (notificationId: string) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true
      });
    }, 200);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.put(`/api/notifications/${notificationId}/read`);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};