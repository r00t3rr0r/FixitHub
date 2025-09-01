const Notification = require('../models/Notification');

class NotificationService {
  // Create a new notification
  static async createNotification(notificationData) {
    console.log('NotificationService: Creating notification for user:', notificationData.userId);

    try {
      const notification = new Notification(notificationData);
      const savedNotification = await notification.save();

      console.log('NotificationService: Notification created successfully');
      return savedNotification;
    } catch (error) {
      console.error('NotificationService: Error creating notification:', error);
      throw error;
    }
  }

  // Get notifications for a user
  static async getUserNotifications(userId, filters = {}) {
    console.log('NotificationService: Getting notifications for user:', userId);

    try {
      const query = { userId };
      
      if (filters.unreadOnly === 'true') {
        query.isRead = false;
      }

      const limit = parseInt(filters.limit) || 20;
      
      const notifications = await Notification.find(query)
        .populate('orderId', 'orderNumber deviceBrand deviceModel')
        .sort({ createdAt: -1 })
        .limit(limit);

      const unreadCount = await Notification.countDocuments({
        userId,
        isRead: false
      });

      console.log('NotificationService: Found', notifications.length, 'notifications');
      return {
        notifications,
        unreadCount
      };
    } catch (error) {
      console.error('NotificationService: Error getting notifications:', error);
      throw error;
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId, userId) {
    console.log('NotificationService: Marking notification as read:', notificationId);

    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        { 
          isRead: true,
          readAt: new Date()
        },
        { new: true }
      );

      if (!notification) {
        throw new Error('Notification not found');
      }

      console.log('NotificationService: Notification marked as read');
      return notification;
    } catch (error) {
      console.error('NotificationService: Error marking notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read for a user
  static async markAllAsRead(userId) {
    console.log('NotificationService: Marking all notifications as read for user:', userId);

    try {
      const result = await Notification.updateMany(
        { userId, isRead: false },
        { 
          isRead: true,
          readAt: new Date()
        }
      );

      console.log('NotificationService: Marked', result.modifiedCount, 'notifications as read');
      return { success: true, count: result.modifiedCount };
    } catch (error) {
      console.error('NotificationService: Error marking all notifications as read:', error);
      throw error;
    }
  }

  // Create order update notification
  static async createOrderUpdateNotification(orderId, userId, status, message) {
    return this.createNotification({
      userId,
      title: 'Order Status Update',
      message,
      type: 'order_update',
      orderId,
      actionUrl: `/orders/${orderId}`
    });
  }

  // Create payment notification
  static async createPaymentNotification(userId, amount, status, orderId = null) {
    const title = status === 'completed' ? 'Payment Processed' : 'Payment Failed';
    const message = status === 'completed' 
      ? `Payment of $${amount} has been successfully processed`
      : `Payment of $${amount} failed. Please try again.`;

    return this.createNotification({
      userId,
      title,
      message,
      type: 'payment',
      orderId,
      actionUrl: orderId ? `/orders/${orderId}` : '/profile'
    });
  }

  // Create assignment notification
  static async createAssignmentNotification(staffId, orderId, orderNumber) {
    return this.createNotification({
      userId: staffId,
      title: 'New Order Assignment',
      message: `You have been assigned to order ${orderNumber}`,
      type: 'assignment',
      orderId,
      actionUrl: `/orders/${orderId}`
    });
  }
}

module.exports = NotificationService;