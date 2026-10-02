const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Order = require('../models/Order');
const EmailService = require('./emailService');
const NotificationTemplateService = require('./notificationTemplateService');
const { formatEuroDe } = require('../utils/money');

// Eingebettete Dateien (base64-Data-URIs, z. B. ein Versandlabel-PDF) gehoeren nie in
// Benachrichtigungstext oder -metadaten. Dieses Muster erkennt sie beim Lesen alter Daten.
const DATA_URI_PATTERN = /data:[\w.+\/-]+;base64,[A-Za-z0-9+/=\r\n]+/g;
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const MAX_NOTIFICATION_PAGE_SIZE = 200;

/**
 * Vertrag fuer strukturierte Aktionen an einer Benachrichtigung (GET /api/notifications):
 *   notification.actions = [{ kind: 'open' | 'download', label: string, url: string }]
 *   - 'open'     : url ist ein Client-Pfad (react-router), z. B. '/my-complaints/<id>'
 *   - 'download' : url ist ein authentifizierter API-Pfad, der eine Datei liefert,
 *                  z. B. '/api/complaints/<id>/shipping-label' (PDF, Besitz-/Rollenpruefung)
 *   notification.metadata.document (optional, gespeichert):
 *     { kind: 'complaint_shipping_label', complaintId, complaintNumber, trackingNumber,
 *       downloadPath, filename }
 *   notification.category: 'order' | 'message' | 'payment' | 'complaint' | 'assignment' | 'reminder' | 'system'
 */
class NotificationService {
  static getSupportedNotificationTypes() {
    return ['order_update', 'payment', 'message', 'system', 'assignment', 'reminder'];
  }

  static formatEuroDe(value) {
    return formatEuroDe(value);
  }

  static getComplaintShippingLabelDownloadPath(complaintId) {
    return `/api/complaints/${complaintId}/shipping-label`;
  }

  // Strukturierte Dokumentreferenz fuer das Reklamations-Versandlabel (statt der PDF-Daten).
  static buildComplaintShippingLabelDocument({ complaintId, complaintNumber, trackingNumber } = {}) {
    const id = String(complaintId || '');
    return {
      kind: 'complaint_shipping_label',
      complaintId: id,
      complaintNumber: complaintNumber || null,
      trackingNumber: trackingNumber || null,
      downloadPath: this.getComplaintShippingLabelDownloadPath(id),
      filename: `Versandlabel-${complaintNumber || id}.pdf`,
    };
  }

  // Kurzer Kundentext "Reklamation genehmigt" (eine Stelle fuer Route, Lese-Bereinigung und Skript).
  static buildComplaintApprovedMessage({ complaintNumber, complaintOrderNumber } = {}) {
    const reference = complaintNumber ? `Ihre Reklamation ${complaintNumber}` : 'Ihre Reklamation';
    const orderPart = complaintOrderNumber ? ` (Reklamationsauftrag ${complaintOrderNumber})` : '';
    return `${reference} wurde genehmigt. Bitte senden Sie Ihr Gerät mit dem DHL-Versandlabel an uns${orderPart}. `
      + 'Das Versandlabel können Sie hier herunterladen.';
  }

  static stripEmbeddedData(text) {
    return String(text || '').replace(DATA_URI_PATTERN, '').replace(/\s{2,}/g, ' ').trim();
  }

  /**
   * Kategorie fuer Filter/Zaehler: Rechnungen und Zahlungen zusammen, Reklamationen eigene
   * Kategorie (frueher als "Auftragsaktualisierung" einsortiert).
   */
  static getNotificationCategory(notification = {}) {
    const metadata = notification.metadata || {};
    const type = String(notification.type || '').toLowerCase();
    if (type === 'payment' || metadata.isInvoice === true) return 'payment';
    if (metadata.complaintId) return 'complaint';
    if (type === 'message') return 'message';
    if (type === 'order_update') return 'order';
    if (type === 'assignment' || type === 'reminder') return type;
    return 'system';
  }

  /**
   * Zielpfad einer Benachrichtigung im Client. Bildet bekannte tote bzw. Listen-Ziele auf den
   * Datensatz ab (auch fuer bereits gespeicherte Benachrichtigungen, rein beim Lesen):
   *   /customer/invoices      -> /invoices (?invoiceId=)
   *   /admin/orders/:id       -> /orders/:id
   *   /my-complaints (+ID)    -> /my-complaints/:id (Kunde) bzw. /admin/complaints?complaintId= (Admin)
   *   /repair-requests/:id    -> /my-repair-requests?requestId= | /admin/... | /staff/repair-requests?requestId=
   */
  static resolveActionUrl(notification = {}, role = 'customer') {
    const metadata = notification.metadata || {};
    const normalizedRole = String(role || 'customer').toLowerCase();
    const isAdmin = normalizedRole === 'admin';
    const isStaff = normalizedRole === 'staff';
    const rawUrl = String(notification.actionUrl || '').trim();
    const orderIdValue = notification.orderId && typeof notification.orderId === 'object' && notification.orderId._id
      ? notification.orderId._id
      : notification.orderId;
    const complaintId = metadata.complaintId ? String(metadata.complaintId) : '';

    const complaintTarget = () => {
      if (!complaintId) return '';
      if (isAdmin) return `/admin/complaints?complaintId=${complaintId}`;
      if (isStaff) {
        const orderTarget = metadata.complaintOrderId || orderIdValue;
        return orderTarget ? `/orders/${orderTarget}` : '';
      }
      return `/my-complaints/${complaintId}`;
    };

    if (/^\/customer\/invoices/.test(rawUrl)) {
      return metadata.invoiceId ? `/invoices?invoiceId=${metadata.invoiceId}` : '/invoices';
    }
    const adminOrderMatch = rawUrl.match(/^\/admin\/orders\/([a-f0-9]{24})\/?$/i);
    if (adminOrderMatch) {
      return `/orders/${adminOrderMatch[1]}`;
    }
    if ((rawUrl === '/my-complaints' || rawUrl === '/my-complaints/') && complaintId) {
      return complaintTarget();
    }
    if (/^\/admin\/complaints/.test(rawUrl) && !isAdmin && complaintId) {
      return complaintTarget();
    }
    const repairRequestMatch = rawUrl.match(/^\/repair-requests\/([a-f0-9]{24})\/?$/i);
    if (repairRequestMatch) {
      const requestId = repairRequestMatch[1];
      if (isAdmin) return `/admin/repair-requests?requestId=${requestId}`;
      if (isStaff) return `/staff/repair-requests?requestId=${requestId}`;
      return `/my-repair-requests?requestId=${requestId}`;
    }
    if (rawUrl) {
      return rawUrl;
    }
    if (complaintId) {
      return complaintTarget();
    }
    if (orderIdValue && OBJECT_ID_PATTERN.test(String(orderIdValue))) {
      return `/orders/${orderIdValue}`;
    }
    return '';
  }

  static buildNotificationActions(notification = {}) {
    const actions = [];
    const document = notification.metadata?.document;
    if (document && document.kind === 'complaint_shipping_label' && document.downloadPath) {
      actions.push({ kind: 'download', label: 'Versandlabel herunterladen', url: document.downloadPath, filename: document.filename || undefined });
    }
    if (notification.actionUrl) {
      const category = notification.category || this.getNotificationCategory(notification);
      const openLabel = category === 'complaint'
        ? 'Reklamation öffnen'
        : category === 'payment'
          ? 'Rechnungen öffnen'
          : (notification.orderId || /^\/orders\//.test(notification.actionUrl)) ? 'Auftrag öffnen' : 'Öffnen';
      actions.push({ kind: 'open', label: openLabel, url: notification.actionUrl });
    }
    return actions;
  }

  /**
   * Bereinigung beim Lesen (gilt auch fuer Altdaten, ohne sie umzuschreiben):
   *  - eingebettete base64-Dateien aus Text und Metadaten entfernen
   *  - "Reklamation genehmigt" mit Label-PDF -> kurzer Text + Dokumentreferenz
   *  - Zielpfad auf den Datensatz abbilden, Kategorie und Aktionen ergaenzen
   */
  static sanitizeNotificationForClient(rawNotification, role = 'customer') {
    if (!rawNotification) return rawNotification;
    const notification = typeof rawNotification.toObject === 'function' ? rawNotification.toObject() : { ...rawNotification };
    const metadata = notification.metadata && typeof notification.metadata === 'object' && !Array.isArray(notification.metadata)
      ? { ...notification.metadata }
      : {};

    let hadEmbeddedLabel = false;
    // Verschachtelte Werte (Objekte/Arrays, begrenzte Tiefe) werden als Kopie ohne data:-Zeichenketten
    // zurueckgegeben; die Originaldaten bleiben unveraendert.
    const stripNested = (value, depth) => {
      if (depth > 5 || value === null || typeof value !== 'object' || value instanceof Date) return value;
      if (typeof value.toHexString === 'function') return value; // ObjectId
      if (Array.isArray(value)) {
        return value
          .filter((item) => !(typeof item === 'string' && /^data:/i.test(item.trim())))
          .map((item) => stripNested(item, depth + 1));
      }
      const copy = {};
      Object.keys(value).forEach((nestedKey) => {
        const nestedValue = value[nestedKey];
        if (typeof nestedValue === 'string' && /^data:/i.test(nestedValue.trim())) return;
        copy[nestedKey] = stripNested(nestedValue, depth + 1);
      });
      return copy;
    };
    Object.keys(metadata).forEach((key) => {
      const value = metadata[key];
      if (typeof value === 'string' && /^data:/i.test(value.trim())) {
        if (/label/i.test(key)) hadEmbeddedLabel = true;
        delete metadata[key];
      } else if (value && typeof value === 'object') {
        metadata[key] = stripNested(value, 1);
      }
    });

    const originalMessage = String(notification.message || '');
    DATA_URI_PATTERN.lastIndex = 0;
    const messageHadData = DATA_URI_PATTERN.test(originalMessage);
    DATA_URI_PATTERN.lastIndex = 0;

    const isComplaintApproval = String(metadata.event || '') === 'admin_approved' && metadata.complaintId;
    if (isComplaintApproval && !metadata.document && (hadEmbeddedLabel || messageHadData || metadata.shippingLabelStored || metadata.trackingNumber)) {
      metadata.document = this.buildComplaintShippingLabelDocument({
        complaintId: metadata.complaintId,
        complaintNumber: metadata.complaintNumber,
        trackingNumber: metadata.trackingNumber,
      });
    }

    if (messageHadData) {
      notification.message = isComplaintApproval
        ? this.buildComplaintApprovedMessage({ complaintNumber: metadata.complaintNumber, complaintOrderNumber: metadata.complaintOrderNumber })
        : (this.stripEmbeddedData(originalMessage.replace(/Versandlabel:\s*/gi, '')) || 'Es liegt ein neues Update vor.');
    }

    notification.metadata = metadata;
    notification.category = this.getNotificationCategory(notification);
    notification.actionUrl = this.resolveActionUrl(notification, role);
    notification.actions = this.buildNotificationActions(notification);
    return notification;
  }

  static isInvoiceNotification(notificationData = {}) {
    if (notificationData?.metadata?.isInvoice === true) {
      return true;
    }

    const title = String(notificationData?.title || '');
    const message = String(notificationData?.message || '');
    return /(invoice|rechnung)/i.test(`${title} ${message}`);
  }

  static isTypeChannelEnabled(user, notificationType, channel) {
    const normalizedType = String(notificationType || 'system').toLowerCase();
    const supportedTypes = this.getSupportedNotificationTypes();
    const resolvedType = supportedTypes.includes(normalizedType) ? normalizedType : 'system';

    const notifications = user?.preferences?.notifications || {};

    if (channel === 'email' && notifications.email === false) return false;
    if (channel === 'push' && notifications.push === false) return false;

    const channelMap = notifications.channelsByType || {};
    const value = channelMap?.[resolvedType]?.[channel];
    if (typeof value === 'boolean') return value;

    return true;
  }

  static isOrderEventChannelEnabled(user, channel, notificationData = {}) {
    if (String(notificationData?.type || '').toLowerCase() !== 'order_update') {
      return true;
    }

    const eventStatus = notificationData?.metadata?.orderStatusEvent || notificationData?.status || null;
    return this.isOrderStatusEventEnabled(user, channel, eventStatus);
  }

  static shouldSendEmailForNotification(user, notificationData = {}, options = {}) {
    if (options.forceEmail) {
      return true;
    }

    if (options.sendEmail === false) {
      return false;
    }

    if (this.isInvoiceNotification(notificationData)) {
      return true;
    }

    const typeEnabled = this.isTypeChannelEnabled(user, notificationData.type, 'email');
    const eventEnabled = this.isOrderEventChannelEnabled(user, 'email', notificationData);
    return typeEnabled && eventEnabled;
  }

  static shouldCreateInAppNotification(user, notificationData = {}, options = {}) {
    if (options.sendInApp === false) {
      return false;
    }

    const typeEnabled = this.isTypeChannelEnabled(user, notificationData.type, 'push');
    const eventEnabled = this.isOrderEventChannelEnabled(user, 'push', notificationData);
    return typeEnabled && eventEnabled;
  }

  static normalizeOrderStatusEventKey(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'completed') return 'completed';
    if (normalized === 'ready-for-pickup') return 'readyForPickup';
    if (normalized === 'in-progress') return 'inProgress';
    return null;
  }

  static isOrderStatusEventEnabled(user, channel, status) {
    const eventKey = this.normalizeOrderStatusEventKey(status);
    if (!eventKey) {
      return channel === 'push';
    }

    const notifications = user?.preferences?.notifications || {};
    const mode = String(notifications.mode || 'standard').toLowerCase();

    if (channel === 'email') {
      if (notifications.email === false) return false;
      if (mode === 'all') return true;

      const emailEvents = notifications.emailEvents || {};
      const explicit = emailEvents[eventKey];
      if (typeof explicit === 'boolean') return explicit;

      return eventKey === 'readyForPickup' || eventKey === 'completed';
    }

    if (notifications.push === false) return false;
    const pushEvents = notifications.pushEvents || {};
    const explicit = pushEvents[eventKey];
    if (typeof explicit === 'boolean') return explicit;

    return true;
  }

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
        return 'Aufträge';
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
      order_update: { label: 'Aufträge', value: 'Neues Update verfügbar' },
      payment: { label: 'Zahlungen', value: 'Neues Update verfügbar' },
      message: { label: 'Nachrichten', value: 'Neue Nachricht verfügbar' },
      assignment: { label: 'Zuweisungen', value: 'Neue Zuweisung verfügbar' },
      reminder: { label: 'Erinnerungen', value: 'Neue Erinnerung verfügbar' },
      system: { label: 'System', value: 'Neuer Systemhinweis verfügbar' },
    };

    const category = categories[String(notificationType || 'system').toLowerCase()] || categories.system;

    return `<tr>
      <td style="${tdLabelStyle}">${category.label}</td>
      <td style="${tdValueStyle}">${category.value}</td>
    </tr>${extraRows || ''}`;
  }

  /**
   * Allgemeine Kunden-E-Mail zu einer Benachrichtigung.
   * Ergebnis (NOTIF-16, statt still zu schlucken): { status: 'sent' | 'skipped' | 'failed', error?, reason? }
   * 'sent' heisst: vom Mailserver angenommen - eine Zustellung beim Empfaenger wird nicht geprueft.
   */
  static async sendCustomerNotificationEmail(savedNotification, options = {}) {
    try {
      const user = await User.findById(savedNotification.userId)
        .select('email firstName lastName name role preferences.notifications')
        .lean();

      if (!user || !user.email) {
        return { status: 'skipped', reason: 'no_email' };
      }

      if (String(user.role || '').toLowerCase() !== 'customer') {
        return { status: 'skipped', reason: 'not_customer' };
      }

      const emailNotificationsEnabled = this.shouldSendEmailForNotification(user, savedNotification, options);
      if (!emailNotificationsEnabled) {
        return { status: 'skipped', reason: 'preferences' };
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
      <td style="padding:10px 0;border-bottom:1px solid #d8dce6;font-size:13px;font-weight:700;color:#1a2a5e;width:170px;vertical-align:top;">Gerät</td>
      <td style="padding:10px 0;border-bottom:1px solid #d8dce6;font-size:14px;color:#2d3748;vertical-align:top;">${orderDeviceVisual}</td>
    </tr>`
        : '';

      const notificationTypeSummary = this.buildNotificationTypeSummaryHtml(notificationType, extraRows);
      const notificationCreatedAt = new Date(savedNotification.createdAt || Date.now()).toLocaleString('de-DE');
      const notificationReference = savedNotification.orderId
        ? `Auftrag ${orderNumberForEmail}`
        : 'Konto-Benachrichtigung';
      const notificationActionLabel = savedNotification.actionUrl
        ? 'Bitte öffnen Sie den verlinkten Bereich im Kundenkonto.'
        : 'Bitte prüfen Sie Ihre Benachrichtigungen im Kundenkonto.';

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
        supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
        supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789',
      });

      if (!emailResult?.success) {
        throw new Error(emailResult?.error || 'Template email send failed');
      }
      return { status: 'sent', messageId: emailResult.messageId || null };
    } catch (error) {
      console.error('NotificationService: Error sending notification email:', error);
      return { status: 'failed', error: error?.message || String(error) };
    }
  }

  /**
   * Benachrichtigung anlegen (In-App und/oder allgemeine Kunden-E-Mail je nach Einstellungen).
   * options:
   *   sendInApp / sendEmail / forceEmail - wie bisher
   *   returnResult: true -> liefert { notification, inApp, emailDelivery, deduplicated }
   *                 (sonst wie bisher die gespeicherte Benachrichtigung bzw. null)
   * notificationData.dedupeKey (optional): dasselbe Ereignis erzeugt je Empfaenger hoechstens
   *   EINE Benachrichtigung (partieller eindeutiger Index); eine Wiederholung sendet auch keine
   *   zweite E-Mail.
   */
  static async createNotification(notificationData, options = {}) {
    console.log('NotificationService: Creating notification for user:', notificationData.userId);

    const finish = (notification, emailDelivery, deduplicated = false) => {
      if (options.returnResult) {
        return { notification: notification || null, inApp: Boolean(notification) && !deduplicated, emailDelivery, deduplicated };
      }
      return notification || null;
    };

    try {
      const user = await User.findById(notificationData.userId)
        .select('email firstName lastName name role preferences.notifications')
        .lean();

      const isCustomer = String(user?.role || '').toLowerCase() === 'customer';
      const sendInApp = isCustomer
        ? this.shouldCreateInAppNotification(user, notificationData, options)
        : options.sendInApp !== false;
      const sendEmail = isCustomer
        ? this.shouldSendEmailForNotification(user, notificationData, options)
        : options.sendEmail !== false;

      const dedupeKey = typeof notificationData.dedupeKey === 'string' && notificationData.dedupeKey.trim()
        ? notificationData.dedupeKey.trim()
        : null;
      const { NotificationDedupeClaim } = Notification;
      if (dedupeKey) {
        const existing = await Notification.findOne({ userId: notificationData.userId, dedupeKey });
        if (existing) {
          console.log('NotificationService: Duplicate notification suppressed:', dedupeKey);
          return finish(existing, { status: 'skipped', reason: 'duplicate' }, true);
        }
        // Bereits als reine E-Mail verschickt (In-App war beim Empfaenger abgeschaltet).
        if (NotificationDedupeClaim && await NotificationDedupeClaim.exists({ userId: notificationData.userId, dedupeKey })) {
          console.log('NotificationService: Duplicate e-mail-only notification suppressed:', dedupeKey);
          return finish(null, { status: 'skipped', reason: 'duplicate' }, true);
        }
      }

      if (!sendInApp && sendEmail) {
        // Ohne In-App-Zeile haelt ein Dedupe-Anspruch den Schluessel fest (atomar ueber den
        // eindeutigen Index), sonst ginge jede Wiederholung erneut per E-Mail hinaus.
        if (dedupeKey && NotificationDedupeClaim) {
          try {
            await NotificationDedupeClaim.create({ userId: notificationData.userId, dedupeKey, channel: 'email' });
          } catch (claimError) {
            if (claimError && claimError.code === 11000) {
              console.log('NotificationService: Concurrent duplicate e-mail-only notification suppressed:', dedupeKey);
              return finish(null, { status: 'skipped', reason: 'duplicate' }, true);
            }
            throw claimError;
          }
        }
        const emailDelivery = await this.sendCustomerNotificationEmail({
          ...notificationData,
          createdAt: new Date(),
        }, {
          ...options,
          forceEmail: true,
        });
        return finish(null, emailDelivery);
      }

      if (!sendInApp && !sendEmail) {
        return finish(null, { status: 'skipped', reason: 'preferences' });
      }

      const payload = { ...notificationData };
      if (dedupeKey) payload.dedupeKey = dedupeKey;
      else delete payload.dedupeKey;
      // Eingebettete Dateien nie speichern (z. B. ein Label-PDF als Data-URI).
      if (typeof payload.message === 'string') {
        DATA_URI_PATTERN.lastIndex = 0;
        if (DATA_URI_PATTERN.test(payload.message)) {
          payload.message = this.stripEmbeddedData(payload.message) || 'Es liegt ein neues Update vor.';
        }
        DATA_URI_PATTERN.lastIndex = 0;
      }

      let savedNotification;
      try {
        savedNotification = await new Notification(payload).save();
      } catch (saveError) {
        if (dedupeKey && saveError && saveError.code === 11000) {
          const existing = await Notification.findOne({ userId: notificationData.userId, dedupeKey });
          console.log('NotificationService: Concurrent duplicate notification suppressed:', dedupeKey);
          return finish(existing, { status: 'skipped', reason: 'duplicate' }, true);
        }
        throw saveError;
      }

      let emailDelivery = { status: 'skipped', reason: sendEmail ? 'not_customer' : 'disabled' };
      if (sendEmail) {
        emailDelivery = await this.sendCustomerNotificationEmail(savedNotification, options);
        if (emailDelivery && ['sent', 'failed'].includes(emailDelivery.status)) {
          try {
            await Notification.updateOne(
              { _id: savedNotification._id },
              { $set: { 'metadata.emailDelivery': { status: emailDelivery.status, at: new Date(), error: emailDelivery.error || null } } }
            );
          } catch (persistError) {
            console.error('NotificationService: Could not persist email delivery result:', persistError.message);
          }
        }
      }

      console.log('NotificationService: Notification created successfully');
      return finish(savedNotification, emailDelivery);
    } catch (error) {
      console.error('NotificationService: Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Benachrichtigungen eines Benutzers (GET /api/notifications).
   * filters: { limit (Standard 20, max. 200), skip, unreadOnly }
   * Antwort: { notifications, unreadCount, totalCount, countsByCategory, unreadByCategory, hasMore, limit, skip }
   * Zaehler kommen aus der Datenbank (nicht aus der geladenen Teilmenge). Jede Benachrichtigung
   * wird beim Lesen bereinigt (keine eingebetteten Dateien, Zielpfad, Kategorie, Aktionen).
   */
  static async getUserNotifications(userId, filters = {}) {
    console.log('NotificationService: Getting notifications for user:', userId);

    try {
      const query = { userId };
      const unreadOnly = filters.unreadOnly === true || filters.unreadOnly === 'true';
      if (unreadOnly) {
        query.isRead = false;
      }

      const parsedLimit = parseInt(filters.limit, 10);
      const limit = Math.min(Math.max(Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20, 1), MAX_NOTIFICATION_PAGE_SIZE);
      const parsedSkip = parseInt(filters.skip, 10);
      const skip = Number.isFinite(parsedSkip) && parsedSkip > 0 ? parsedSkip : 0;

      let userObjectId = null;
      try {
        userObjectId = new mongoose.Types.ObjectId(String(userId));
      } catch (castError) {
        userObjectId = null;
      }

      const [user, notifications, unreadCount, totalCount, categoryRows] = await Promise.all([
        User.findById(userId).select('role').lean(),
        Notification.find(query)
          .populate('orderId', 'orderNumber deviceBrand deviceModel')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Notification.countDocuments({ userId, isRead: false }),
        Notification.countDocuments({ userId }),
        userObjectId
          ? Notification.aggregate([
            { $match: { userId: userObjectId } },
            {
              $group: {
                _id: {
                  $switch: {
                    branches: [
                      { case: { $or: [{ $eq: ['$type', 'payment'] }, { $eq: ['$metadata.isInvoice', true] }] }, then: 'payment' },
                      { case: { $and: [{ $ne: [{ $ifNull: ['$metadata.complaintId', null] }, null] }, { $ne: ['$metadata.complaintId', ''] }] }, then: 'complaint' },
                      { case: { $eq: ['$type', 'message'] }, then: 'message' },
                      { case: { $eq: ['$type', 'order_update'] }, then: 'order' },
                      { case: { $eq: ['$type', 'assignment'] }, then: 'assignment' },
                      { case: { $eq: ['$type', 'reminder'] }, then: 'reminder' },
                    ],
                    default: 'system',
                  },
                },
                total: { $sum: 1 },
                unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } },
              },
            },
          ])
          : [],
      ]);

      const countsByCategory = { order: 0, message: 0, payment: 0, complaint: 0, assignment: 0, reminder: 0, system: 0 };
      const unreadByCategory = { ...countsByCategory };
      (categoryRows || []).forEach((row) => {
        countsByCategory[row._id] = row.total;
        unreadByCategory[row._id] = row.unread;
      });

      const role = user?.role || 'customer';
      const sanitized = notifications.map((notification) => this.sanitizeNotificationForClient(notification, role));
      const matchingTotal = unreadOnly ? unreadCount : totalCount;

      console.log('NotificationService: Found', sanitized.length, 'notifications');
      return {
        notifications: sanitized,
        unreadCount,
        totalCount,
        countsByCategory,
        unreadByCategory,
        hasMore: skip + sanitized.length < matchingTotal,
        limit,
        skip,
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
      const reader = await User.findById(userId).select('role').lean();
      return this.sanitizeNotificationForClient(notification, reader?.role || 'customer');
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
      actionUrl: `/orders/${orderId}`,
      metadata: {
        orderStatusEvent: status,
      },
    }, {
      sendInApp: true,
    });
  }

  // Create payment notification
  static async createPaymentNotification(userId, amount, status, orderId = null) {
    const title = status === 'completed' ? 'Zahlung erfolgreich verarbeitet' : 'Zahlung fehlgeschlagen';
    const message = status === 'completed'
      ? `Ihre Zahlung über ${this.formatEuroDe(amount)} wurde erfolgreich verarbeitet.`
      : `Ihre Zahlung über ${this.formatEuroDe(amount)} ist fehlgeschlagen. Bitte versuchen Sie es erneut.`;

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
      title: 'Neuer Auftrag zugewiesen',
      message: `Ihnen wurde der Auftrag ${orderNumber} zugewiesen.`,
      type: 'assignment',
      orderId,
      actionUrl: `/orders/${orderId}`
    });
  }
}

module.exports = NotificationService;