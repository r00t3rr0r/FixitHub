const Notification = require('../models/Notification');
const User = require('../models/User');
const Order = require('../models/Order');
const EmailService = require('./emailService');
const NotificationTemplateService = require('./notificationTemplateService');

class NotificationService {
  // Delete all notifications
  static async deleteAllNotifications() {
    try {
      const result = await Notification.deleteMany({});
      return { success: true, deletedCount: result.deletedCount };
    } catch (error) {
      console.error('NotificationService: Error deleting all notifications:', error);
      throw error;
    }
  }
  static getCustomerNotificationTemplateCandidates() {
    return [
      'Benachrichtigungs-Updates fuer Kunden',
      'Benachrichtigungs-Update fuer Kunden',
      'Benachrichtigungs-Updates für Kunden',
      'Benachrichtigungs-Update für Kunden'
    ];
  }

  static async resolveCustomerNotificationTemplateName() {
    const candidates = this.getCustomerNotificationTemplateCandidates();

    for (const candidate of candidates) {
      const template = await NotificationTemplateService.getTemplateByName(candidate, 'email');
      if (template && template.isActive !== false) {
        return template.name;
      }
    }

    return candidates[0];
  }

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

  static buildNotificationTypeSummaryHtml(notificationType, extraRows = '') {
    const tdLabelStyle = 'padding:10px 0;border-bottom:1px solid #d8dce6;font-size:13px;font-weight:700;color:#1a2a5e;width:170px;vertical-align:top;';
    const tdValueStyle = 'padding:10px 0;border-bottom:1px solid #d8dce6;font-size:14px;color:#2d3748;vertical-align:top;';

    const categories = {
      order_update: { label: 'Auftraege', value: 'Neues Update verfuegbar' },
      payment: { label: 'Zahlungen', value: 'Neues Update verfuegbar' },
      message: { label: 'Nachrichten', value: 'Neue Nachricht verfuegbar' },
      assignment: { label: 'Zuweisungen', value: 'Neue Zuweisung verfuegbar' },
      reminder: { label: 'Erinnerungen', value: 'Neue Erinnerung verfuegbar' },
      system: { label: 'System', value: 'Neuer Systemhinweis verfuegbar' },
    };

    const category = categories[String(notificationType || 'system').toLowerCase()] || categories.system;

    return `<tr>
      <td style="${tdLabelStyle}">${category.label}</td>
      <td style="${tdValueStyle}">${category.value}</td>
    </tr>${extraRows || ''}`;
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


      const notificationType = String(savedNotification.type || 'system').toLowerCase();
      const notificationCategoryLabel = this.getNotificationCategoryLabel(notificationType);
      let orderContext = null;
      if (savedNotification.orderId) {
        try {
          orderContext = await Order.findById(savedNotification.orderId)
            .select('orderNumber deviceBrand deviceModel')
            .lean();
        } catch (orderLoadError) {
          console.error('NotificationService: Failed to load order context for email:', orderLoadError.message);
        }
      }

      const orderNumberForEmail = orderContext?.orderNumber || (savedNotification.orderId ? String(savedNotification.orderId) : '');
      const orderDeviceVisual = EmailService.buildDeviceModelVisualHtml({
        deviceBrand: orderContext?.deviceBrand || '',
        deviceModel: orderContext?.deviceModel || '',
        imageUrl: await EmailService.resolveDeviceModelImageUrl({
          deviceBrand: orderContext?.deviceBrand || '',
          deviceModel: orderContext?.deviceModel || '',
        })
      });

      const extraRows = orderContext
        ? `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #d8dce6;font-size:13px;font-weight:700;color:#1a2a5e;width:170px;vertical-align:top;">Auftrag</td>
      <td style="padding:10px 0;border-bottom:1px solid #d8dce6;font-size:14px;color:#2d3748;vertical-align:top;">${EmailService.escapeHtml(orderNumberForEmail)}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #d8dce6;font-size:13px;font-weight:700;color:#1a2a5e;width:170px;vertical-align:top;">Geraet</td>
      <td style="padding:10px 0;border-bottom:1px solid #d8dce6;font-size:14px;color:#2d3748;vertical-align:top;">${orderDeviceVisual}</td>
    </tr>`
        : '';

      const notificationTypeSummary = this.buildNotificationTypeSummaryHtml(notificationType, extraRows);
      const notificationCreatedAt = new Date(savedNotification.createdAt || Date.now()).toLocaleString('de-DE');
      const notificationReference = savedNotification.orderId
        ? `Auftrag ${orderNumberForEmail}`
        : 'Konto-Benachrichtigung';
      const notificationActionLabel = savedNotification.actionUrl
        ? 'Bitte oeffnen Sie den verlinkten Bereich im Kundenkonto.'
        : 'Bitte pruefen Sie Ihre Benachrichtigungen im Kundenkonto.';

      const notificationsUrl = await EmailService.buildSystemUrl('/notifications');
      const notificationActionUrl = savedNotification.actionUrl
        ? await EmailService.buildSystemUrl(savedNotification.actionUrl)
        : notificationsUrl;

      const templateName = await this.resolveCustomerNotificationTemplateName();

      const emailResult = await EmailService.sendTemplateEmail(templateName, user.email, {
        companyName: process.env.COMPANY_NAME || 'McRepair.de',
        customerName,
        notificationCategoryLabel,
        notificationCreatedAt,
        notificationTitle: savedNotification.title || 'Neue Benachrichtigung',
        notificationMessage: savedNotification.message || 'Es liegt ein neues Update vor.',
        notificationReference,
        notificationActionLabel,
        notificationsUrl,
        notificationActionUrl,
        notificationTypeSummary,
        orderNumber: orderNumberForEmail,
        deviceBrand: orderContext?.deviceBrand || '',
        deviceModel: orderContext?.deviceModel || '',
        orderDeviceVisual,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
        supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789',
      });

      if (!emailResult?.success) {
        throw new Error(emailResult?.error || 'Template email send failed');
      }
    } catch (error) {
      console.error('NotificationService: Error sending notification email:', error);
    }
  }

  // Create a new notification
  static async createNotification(notificationData, options = {}) {
    console.log('NotificationService: Creating notification for user:', notificationData.userId);

    try {
      const notification = new Notification(notificationData);
      const savedNotification = await notification.save();

      if (options.sendEmail !== false) {
        await this.sendCustomerNotificationEmail(savedNotification);
      }

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
      title: 'Statusupdate zu Ihrem Auftrag',
      message: message || 'Der Status Ihres Auftrags wurde aktualisiert.',
      type: 'order_update',
      orderId,
      actionUrl: `/orders/${orderId}`
    });
  }

  // Create payment notification
  static async createPaymentNotification(userId, amount, status, orderId = null) {
    const title = status === 'completed' ? 'Zahlung erfolgreich verarbeitet' : 'Zahlung fehlgeschlagen';
    const message = status === 'completed' 
      ? `Ihre Zahlung ueber ${Number(amount || 0).toFixed(2)} EUR wurde erfolgreich verarbeitet.`
      : `Ihre Zahlung ueber ${Number(amount || 0).toFixed(2)} EUR ist fehlgeschlagen. Bitte versuchen Sie es erneut.`;

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