const Notification = require('../models/Notification');
const User = require('../models/User');
const EmailService = require('./emailService');

class NotificationService {
  static getNotificationCategoryLabel(type) {
    switch (String(type || '').toLowerCase()) {
      case 'order_update':
        return 'Auftraege';
      case 'payment':
        return 'Zahlungen';
      case 'message':
        return 'Nachrichten';
      case 'assignment':
        return 'Zuweisungen';
      case 'reminder':
        return 'Erinnerungen';
      case 'system':
      default:
        return 'System';
    }
  }

  static buildNotificationTypeSummary(notificationType) {
    const labels = {
      order_update: 'Neues Update verfuegbar',
      payment: 'Neues Update verfuegbar',
      message: 'Neue Nachricht verfuegbar',
      assignment: 'Neue Zuweisung verfuegbar',
      reminder: 'Neue Erinnerung verfuegbar',
      system: 'Neuer Systemhinweis verfuegbar'
    };

    const inactiveLabel = 'Aktuell kein neues Update';

    return {
      ordersInfo: notificationType === 'order_update' ? labels.order_update : inactiveLabel,
      paymentsInfo: notificationType === 'payment' ? labels.payment : inactiveLabel,
      messagesInfo: notificationType === 'message' ? labels.message : inactiveLabel,
      assignmentsInfo: notificationType === 'assignment' ? labels.assignment : inactiveLabel,
      remindersInfo: notificationType === 'reminder' ? labels.reminder : inactiveLabel,
      systemInfo: notificationType === 'system' ? labels.system : inactiveLabel,
    };
  }

  static async sendCustomerNotificationEmail(savedNotification) {
    try {
      const user = await User.findById(savedNotification.userId)
        .select('email firstName lastName name role preferences.notifications.email')
        .lean();

      if (!user || !user.email) {
        return;
      }

      if (String(user.role || '').toLowerCase() !== 'customer') {
        return;
      }

      const emailNotificationsEnabled = user?.preferences?.notifications?.email !== false;
      if (!emailNotificationsEnabled) {
        return;
      }

      const customerName = String(
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || user.email
      );

      const toAbsoluteUrl = (url) => {
        const value = String(url || '').trim();
        if (!value) return '';
        if (/^https?:\/\//i.test(value)) return value;

        const baseUrl = String(process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || '').trim();
        if (!baseUrl) return value;

        const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const normalizedPath = value.startsWith('/') ? value : `/${value}`;
        return `${normalizedBase}${normalizedPath}`;
      };

      const notificationType = String(savedNotification.type || 'system').toLowerCase();
      const notificationCategoryLabel = this.getNotificationCategoryLabel(notificationType);
      const typeSummary = this.buildNotificationTypeSummary(notificationType);
      const notificationCreatedAt = new Date(savedNotification.createdAt || Date.now()).toLocaleString('de-DE');
      const notificationReference = savedNotification.orderId
        ? `Auftrag ${String(savedNotification.orderId)}`
        : 'Konto-Benachrichtigung';
      const notificationActionLabel = savedNotification.actionUrl
        ? 'Bitte oeffnen Sie den verlinkten Bereich im Kundenkonto.'
        : 'Bitte pruefen Sie Ihre Benachrichtigungen im Kundenkonto.';

      await EmailService.sendTemplateEmail('Benachrichtigungs-Update fuer Kunden', user.email, {
        companyName: process.env.COMPANY_NAME || 'FixitHub',
        customerName,
        notificationCategoryLabel,
        notificationCreatedAt,
        notificationTitle: savedNotification.title || 'Neue Benachrichtigung',
        notificationMessage: savedNotification.message || 'Es liegt ein neues Update vor.',
        notificationReference,
        notificationActionLabel,
        notificationsUrl: toAbsoluteUrl(savedNotification.actionUrl || '/notifications'),
        supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
        supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789',
        ...typeSummary,
      });
    } catch (error) {
      console.error('NotificationService: Error sending notification email:', error);
    }
  }

  // Create a new notification
  static async createNotification(notificationData) {
    console.log('NotificationService: Creating notification for user:', notificationData.userId);

    try {
      const notification = new Notification(notificationData);
      const savedNotification = await notification.save();

      await this.sendCustomerNotificationEmail(savedNotification);

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