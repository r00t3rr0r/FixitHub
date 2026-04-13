const nodemailer = require('nodemailer');
const SystemConfigService = require('./systemConfigService');
const NotificationTemplateService = require('./notificationTemplateService');
const Logger = require('../utils/logger');
const WebsiteSettings = require('../models/WebsiteSettings');
const Order = require('../models/Order');
const { DeviceModel, DeviceBrand } = require('../models/Device');
const { EmailRetryHandler, EmailDeliveryTracker } = require('../utils/emailLogger');

/**
 * Email Service for sending emails via nodemailer
 * Supports SMTP configuration from database and environment variables
 * Includes advanced logging, retry logic, and delivery tracking
 */
class EmailService {
  static systemBaseUrlCache = {
    value: null,
    expiresAt: 0
  };

  static TRIGGER_TEMPLATE_MAP = {
    user_registered: 'Registrierung und Kontoaktivierung',
    password_reset_requested: 'Passwort zuruecksetzen',
    order_created: 'Auftragsbestaetigung Reparatur',
    order_status_updated: 'Statusupdate Auftrag oder Buchung',
    device_received: 'Geraet eingegangen',
    quote_approval_requested: 'Kostenvoranschlag zur Freigabe',
    diagnosis_completed: 'Diagnose abgeschlossen',
    order_completed: 'Reparatur abgeschlossen und Rueckversand',
    payment_confirmed: 'Zahlung bestaetigt',
    booking_created: 'Buchung angelegt',
    guest_booking_created: 'Gast Buchung Tracking',
    booking_status_updated: 'Buchung Statusupdate',
    booking_ready_for_pickup: 'Buchung bereit zur Abholung',
    booking_cancelled: 'Buchung storniert',
    repair_request_created: 'Repair Requests eingegangen',
    repair_request_processing: 'Repair Request in Bearbeitung',
    repair_request_diagnosed: 'Repair Request Diagnose abgeschlossen',
    repair_request_message: 'Repair Request neue Nachricht',
    repair_request_completed: 'Repair Request abgeschlossen',
    complaint_created: 'Reklamation eingegangen',
    complaint_processing: 'Reklamation in Bearbeitung',
    complaint_message: 'Reklamation neue Nachricht',
    complaint_resolved: 'Reklamation geloest',
    complaint_rejected: 'Reklamation abgelehnt',
    appointment_reminder: 'Terminerinnerung',
    warranty_reminder: 'Garantieerinnerung',
    invoice_created: 'Neue Rechnung verfuegbar',
    pickup_reminder: 'Abholung bereit Erinnerung',
    contact_form_confirmation: 'Kontaktformular Bestaetigung an Absender',
    system_notification: 'Allgemeine Systemnachricht'
  };

  // Backward compatibility for existing installations that still use older template names.
  static TRIGGER_TEMPLATE_FALLBACKS = {
    repair_request_created: ['Repair Request eingegangen']
  };

  static logger = new Logger('EmailService', { 
    context: { 
      service: 'email',
      version: '2.0'
    } 
  });
  
  static retryHandler = new EmailRetryHandler({
    maxRetries: 3,
    baseDelay: 1000,
    maxBackoffDelay: 30000,
    exponentialBase: 2
  });
  
  static deliveryTracker = new EmailDeliveryTracker();

  static normalizeBaseUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) {
      return '';
    }

    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

    try {
      const parsed = new URL(withProtocol);
      return `${parsed.protocol}//${parsed.host}`;
    } catch (error) {
      return '';
    }
  }

  static async getSystemBaseUrl() {
    const now = Date.now();
    if (this.systemBaseUrlCache.value && this.systemBaseUrlCache.expiresAt > now) {
      return this.systemBaseUrlCache.value;
    }

    const candidates = [];

    try {
      const websiteSettings = await WebsiteSettings.findOne()
        .select('customDomain')
        .lean();
      if (websiteSettings?.customDomain) {
        candidates.push(websiteSettings.customDomain);
      }
    } catch (error) {
      this.logger.warn('Unable to resolve WebsiteSettings customDomain for email links', {
        error: error.message
      });
    }

    candidates.push(
      process.env.FRONTEND_URL,
      process.env.CLIENT_URL,
      process.env.PUBLIC_APP_URL,
      process.env.WEBSITE_URL,
      process.env.APP_URL,
      process.env.SERVER_URL,
      'http://localhost:5173'
    );

    const resolvedBaseUrl = candidates
      .map((candidate) => this.normalizeBaseUrl(candidate))
      .find(Boolean) || 'http://localhost:5173';

    this.systemBaseUrlCache = {
      value: resolvedBaseUrl,
      expiresAt: now + 5 * 60 * 1000
    };

    return resolvedBaseUrl;
  }

  static async buildSystemUrl(pathOrUrl = '') {
    const value = String(pathOrUrl || '').trim();
    if (!value) {
      return '';
    }

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    const baseUrl = await this.getSystemBaseUrl();
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const normalizedPath = value.startsWith('/') ? value : `/${value}`;

    return `${normalizedBase}${normalizedPath}`;
  }

  static async normalizeTemplateVariables(variables = {}) {
    const normalizedVariables = { ...variables };
    const urlKeyPattern = /(url|link)$/i;

    for (const [key, rawValue] of Object.entries(normalizedVariables)) {
      if (typeof rawValue !== 'string') {
        continue;
      }

      const trimmedValue = rawValue.trim();
      if (!trimmedValue) {
        continue;
      }

      if (urlKeyPattern.test(key) || /^https?:\/\//i.test(trimmedValue) || trimmedValue.startsWith('/')) {
        normalizedVariables[key] = await this.buildSystemUrl(trimmedValue);
      }
    }

    return normalizedVariables;
  }

  static escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  static normalizeModelText(value = '') {
    return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  static normalizeModelTextCompact(value = '') {
    return this.normalizeModelText(value).replace(/[^a-z0-9]/g, '');
  }

  static async resolveOrderDeviceContext(variables = {}) {
    const deviceBrand = String(variables.deviceBrand || '').trim();
    const deviceModel = String(variables.deviceModel || '').trim();
    const orderId = String(variables.orderId || '').trim();
    const orderNumber = String(variables.orderNumber || '').trim();

    if (deviceBrand || deviceModel) {
      return { deviceBrand, deviceModel };
    }

    let order = null;
    try {
      if (orderId) {
        order = await Order.findById(orderId).select('deviceBrand deviceModel').lean();
      } else if (orderNumber) {
        order = await Order.findOne({ orderNumber }).select('deviceBrand deviceModel').lean();
      }
    } catch (error) {
      this.logger.warn('Failed to resolve order context for email image rendering', {
        orderId,
        orderNumber,
        error: error.message
      });
    }

    return {
      deviceBrand: String(order?.deviceBrand || '').trim(),
      deviceModel: String(order?.deviceModel || '').trim(),
    };
  }

  static async resolveDeviceModelImageUrl({ deviceBrand = '', deviceModel = '', fallbackUrl = '' } = {}) {
    const trimmedFallback = String(fallbackUrl || '').trim();
    if (trimmedFallback) {
      return trimmedFallback;
    }

    const normalizedBrand = this.normalizeModelText(deviceBrand);
    const normalizedModel = this.normalizeModelText(deviceModel);
    const compactModel = this.normalizeModelTextCompact(deviceModel);
    if (!normalizedModel) {
      return '';
    }

    try {
      const brand = normalizedBrand
        ? await DeviceBrand.findOne({ name: new RegExp(`^${String(deviceBrand).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
            .select('_id name')
            .lean()
        : null;

      let modelCandidates = [];
      if (brand?._id) {
        modelCandidates = await DeviceModel.find({ brandId: brand._id })
          .select('name image images')
          .lean();
      }

      if (!modelCandidates.length) {
        modelCandidates = await DeviceModel.find({ name: new RegExp(String(deviceModel).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
          .select('name image images')
          .limit(15)
          .lean();
      }

      const pickImage = (candidate) => {
        if (!candidate) return '';
        return String(
          candidate.image ||
          candidate.images?.[0]?.url ||
          candidate.images?.[0]?.base64 ||
          ''
        ).trim();
      };

      const exact = modelCandidates.find((candidate) => {
        const name = this.normalizeModelText(candidate.name);
        const compactName = this.normalizeModelTextCompact(candidate.name);
        return pickImage(candidate) && (name === normalizedModel || (compactModel && compactName === compactModel));
      });

      const fuzzy = modelCandidates.find((candidate) => {
        const name = this.normalizeModelText(candidate.name);
        const compactName = this.normalizeModelTextCompact(candidate.name);
        return pickImage(candidate) && (
          name.includes(normalizedModel) ||
          normalizedModel.includes(name) ||
          (compactModel ? compactName.includes(compactModel) || compactModel.includes(compactName) : false)
        );
      });

      const match = exact || fuzzy || modelCandidates.find((candidate) => pickImage(candidate));
      return pickImage(match);
    } catch (error) {
      this.logger.warn('Failed to resolve device model image for email', {
        deviceBrand,
        deviceModel,
        error: error.message
      });
      return '';
    }
  }

  static buildDeviceModelVisualHtml({ deviceBrand = '', deviceModel = '', imageUrl = '' } = {}) {
    const deviceLabel = this.escapeHtml([deviceBrand, deviceModel].filter(Boolean).join(' ').trim() || 'Geraet');
    const safeImageUrl = String(imageUrl || '').trim();

    if (safeImageUrl) {
      return `
<div style="display:flex;align-items:center;gap:10px;">
  <img src="${this.escapeHtml(safeImageUrl)}" alt="${deviceLabel}" style="display:block;width:56px;height:56px;object-fit:cover;border-radius:12px;border:1px solid #d8dce6;background:#ffffff;" />
  <div style="font-size:14px;line-height:1.5;color:#2d3748;font-weight:600;">${deviceLabel}</div>
</div>`.trim();
    }

    return `
<div style="display:flex;align-items:center;gap:10px;">
  <div style="display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:12px;border:1px solid #d8dce6;background:#eef3ff;color:#1a2a5e;font-size:24px;line-height:1;">📱</div>
  <div style="font-size:14px;line-height:1.5;color:#2d3748;font-weight:600;">${deviceLabel}</div>
</div>`.trim();
  }

  static async addDeviceVisualVariables(variables = {}) {
    const normalized = { ...variables };
    const context = await this.resolveOrderDeviceContext(normalized);
    const deviceBrand = context.deviceBrand || String(normalized.deviceBrand || '').trim();
    const deviceModel = context.deviceModel || String(normalized.deviceModel || '').trim();

    normalized.deviceBrand = deviceBrand || normalized.deviceBrand || '';
    normalized.deviceModel = deviceModel || normalized.deviceModel || '';

    const modelImageUrl = await this.resolveDeviceModelImageUrl({
      deviceBrand,
      deviceModel,
      fallbackUrl: normalized.deviceModelImageUrl,
    });

    normalized.deviceModelImageUrl = modelImageUrl;
    normalized.orderDeviceVisual = this.buildDeviceModelVisualHtml({
      deviceBrand,
      deviceModel,
      imageUrl: modelImageUrl,
    });

    return normalized;
  }

  /**
   * Get email transporter from system configuration
   */
  static async getTransporter() {
    try {
      const config = await SystemConfigService.getSystemConfiguration();
      let transporterConfig;
      let configSource;
      
      // First, try to use emailSettings from system configuration
      if (config.emailSettings && config.emailSettings.smtpHost && config.emailSettings.enableNotifications) {
        this.logger.info('Using SMTP settings from system configuration');
        
        transporterConfig = {
          host: config.emailSettings.smtpHost,
          port: config.emailSettings.smtpPort || 587,
          secure: config.emailSettings.requiresTLS && (config.emailSettings.smtpPort === 465),
          requiresTLS: config.emailSettings.requiresTLS
        };

        // Add authentication if required
        if (config.emailSettings.requiresAuthentication) {
          transporterConfig.auth = {
            user: config.emailSettings.smtpUsername,
            pass: config.emailSettings.smtpPassword
          };
        }

        configSource = 'systemConfiguration';
        this.logger.logSMTPConfig(transporterConfig);
      } 
      // Fallback to email integration if available
      else if (config.integrations && Array.isArray(config.integrations)) {
        const emailIntegration = config.integrations.find(
          int => int.type === 'email' && int.isActive
        );

        if (emailIntegration) {
          this.logger.info('Using email integration from system configuration');
          transporterConfig = {
            host: emailIntegration.settings.smtpHost || 'smtp.gmail.com',
            port: emailIntegration.settings.smtpPort || 587,
            secure: emailIntegration.settings.requiresTLS && (emailIntegration.settings.smtpPort === 465),
            requiresTLS: emailIntegration.settings.requiresTLS,
            auth: {
              user: emailIntegration.apiKey,
              pass: emailIntegration.apiSecret
            }
          };
          configSource = 'emailIntegration';
          this.logger.logSMTPConfig(transporterConfig);
        }
      }

      // Final fallback to environment variables
      if (!transporterConfig) {
        this.logger.warn('No email configuration found in system config, using environment variables');
        transporterConfig = {
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: process.env.SMTP_PORT || 587,
          secure: process.env.SMTP_SECURE === 'true',
          requiresTLS: process.env.SMTP_TLS === 'true'
        };

        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
          transporterConfig.auth = {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          };
        }

        configSource = 'environment';
        this.logger.logSMTPConfig(transporterConfig);
      }

      const transporter = nodemailer.createTransport(transporterConfig);

      this.deliveryTracker.recordSMTPConnection({
        source: configSource,
        host: transporterConfig.host,
        port: transporterConfig.port,
        secure: transporterConfig.secure,
        requiresTLS: transporterConfig.requiresTLS,
        hasAuth: Boolean(transporterConfig.auth),
        status: 'attempted',
        message: 'SMTP transporter created'
      });
      
      // Verify connection configuration on first use
      transporter.verify((error, success) => {
        if (error) {
          this.deliveryTracker.recordSMTPConnection({
            source: configSource,
            host: transporterConfig.host,
            port: transporterConfig.port,
            secure: transporterConfig.secure,
            requiresTLS: transporterConfig.requiresTLS,
            hasAuth: Boolean(transporterConfig.auth),
            status: 'failed',
            message: 'SMTP verification failed',
            error: error.message
          });
          this.logger.error(
            `SMTP connection verification failed (${configSource})`,
            error,
            { host: transporterConfig.host, port: transporterConfig.port }
          );
        } else {
          this.deliveryTracker.recordSMTPConnection({
            source: configSource,
            host: transporterConfig.host,
            port: transporterConfig.port,
            secure: transporterConfig.secure,
            requiresTLS: transporterConfig.requiresTLS,
            hasAuth: Boolean(transporterConfig.auth),
            status: 'verified',
            message: success ? 'SMTP verification successful' : 'SMTP verification completed'
          });
          this.logger.debug('SMTP connection verified successfully', {
            configSource,
            host: transporterConfig.host,
            port: transporterConfig.port
          });
        }
      });

      return transporter;
    } catch (error) {
      this.deliveryTracker.recordSMTPConnection({
        source: 'exception',
        host: undefined,
        port: undefined,
        secure: false,
        requiresTLS: false,
        hasAuth: false,
        status: 'failed',
        message: 'Failed to initialize SMTP transporter',
        error: error.message
      });
      this.logger.error('Error getting transporter', error, { context: 'getTransporter' });
      throw error;
    }
  }

  /**
   * Send guest order confirmation email with tracking link
   * Uses retry logic and advanced logging
   */
  static async sendGuestOrderConfirmation(orderData) {
    const operation = async () => {
      const transporter = await this.getTransporter();

      // Generate tracking URL
      const trackingUrlBase = await this.buildSystemUrl('/track-order');
      const trackingUrl = `${trackingUrlBase}?token=${orderData.trackingToken}&email=${encodeURIComponent(orderData.guestEmail)}`;

      // Build email HTML
      const emailHtml = this.buildGuestOrderConfirmationEmail(orderData, trackingUrl);

      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@fixithub.com',
        to: orderData.guestEmail,
        subject: `Order Confirmation - ${orderData.orderNumbers.join(', ')}`,
        html: emailHtml,
        text: this.buildGuestOrderConfirmationText(orderData, trackingUrl)
      };

      return await transporter.sendMail(mailOptions);
    };

    const emailInfo = {
      to: orderData.guestEmail,
      templateName: 'Guest Order Confirmation',
      subject: `Order Confirmation - ${orderData.orderNumbers.join(', ')}`
    };

    try {
      this.logger.info('Sending guest order confirmation email', {
        to: orderData.guestEmail,
        orderNumbers: orderData.orderNumbers
      });

      const result = await this.retryHandler.executeWithRetry(
        operation.bind(this),
        'sendGuestOrderConfirmation',
        emailInfo
      );

      if (result.success) {
        this.deliveryTracker.recordDelivery({
          to: emailInfo.to,
          templateName: emailInfo.templateName,
          subject: emailInfo.subject,
          messageId: result.result.messageId,
          status: 'sent',
          attempts: result.attempts,
          duration: result.duration,
          metadata: { orderNumbers: orderData.orderNumbers }
        });

        return {
          success: true,
          messageId: result.result.messageId,
          attempts: result.attempts,
          duration: result.duration
        };
      } else {
        this.deliveryTracker.recordDelivery({
          to: emailInfo.to,
          templateName: emailInfo.templateName,
          subject: emailInfo.subject,
          status: 'failed',
          attempts: result.attempts,
          error: result.error?.message,
          metadata: { orderNumbers: orderData.orderNumbers }
        });

        return {
          success: false,
          error: result.error?.message || 'Failed to send email after retries',
          attempts: result.attempts
        };
      }
    } catch (error) {
      this.logger.error('Unexpected error in sendGuestOrderConfirmation', error, {
        to: emailInfo.to,
        orderNumbers: orderData.orderNumbers
      });

      this.deliveryTracker.recordDelivery({
        to: emailInfo.to,
        templateName: emailInfo.templateName,
        subject: emailInfo.subject,
        status: 'failed',
        attempts: 0,
        error: error.message
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Build HTML email for guest order confirmation
   */
  static buildGuestOrderConfirmationEmail(orderData, trackingUrl) {
    const { guestName, guestEmail, orderNumbers, totalAmount, bookingNumber, trackingToken } = orderData;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1a2a5e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f8f9fc; padding: 30px; border-radius: 0 0 8px 8px; }
    .order-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .button { display: inline-block; background-color: #1a2a5e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Order Confirmation</h1>
    </div>
    <div class="content">
      <p>Dear ${guestName},</p>
      <p>Thank you for your order! We've received your request and will begin processing it shortly.</p>
      
      <div class="order-details">
        <h2>Order Details</h2>
        ${bookingNumber ? `<div class="info-row"><strong>Booking Number:</strong><span>${bookingNumber}</span></div>` : ''}
        <div class="info-row">
          <strong>Order Number(s):</strong>
          <span>${orderNumbers.join(', ')}</span>
        </div>
        <div class="info-row">
          <strong>Email:</strong>
          <span>${guestEmail}</span>
        </div>
        ${totalAmount ? `<div class="info-row"><strong>Total Amount:</strong><span>€${totalAmount.toFixed(2)}</span></div>` : ''}
      </div>

      <h3>Track Your Order</h3>
      <p>You can track the status of your order at any time using the link below:</p>
      
      <div style="text-align: center;">
        <a href="${trackingUrl}" class="button">Track Your Order</a>
      </div>

      <p style="font-size: 12px; color: #666; margin-top: 20px;">
        Or copy and paste this link into your browser:<br>
        <a href="${trackingUrl}" style="color: #1a2a5e; word-break: break-all;">${trackingUrl}</a>
      </p>

      <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <strong>Important:</strong> Please save this email for your records. You'll need the tracking link above to check your order status.
      </div>

      <p>If you have any questions, please don't hesitate to contact our support team.</p>

      <p>Best regards,<br>
      The FixitHub Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} FixitHub. All rights reserved.</p>
      <p>This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Build plain text email for guest order confirmation
   */
  static buildGuestOrderConfirmationText(orderData, trackingUrl) {
    const { guestName, guestEmail, orderNumbers, totalAmount, bookingNumber } = orderData;

    return `
Order Confirmation

Dear ${guestName},

Thank you for your order! We've received your request and will begin processing it shortly.

ORDER DETAILS
${bookingNumber ? `Booking Number: ${bookingNumber}\n` : ''}Order Number(s): ${orderNumbers.join(', ')}
Email: ${guestEmail}
${totalAmount ? `Total Amount: €${totalAmount.toFixed(2)}\n` : ''}

TRACK YOUR ORDER
You can track the status of your order at any time using this link:
${trackingUrl}

Important: Please save this email for your records!

If you have any questions, please contact our support team.

Best regards,
The FixitHub Team

---
© ${new Date().getFullYear()} FixitHub. All rights reserved.
This is an automated email. Please do not reply to this message.
    `;
  }

  // ===== TEMPLATE-BASED EMAIL SENDING METHODS =====

  /**
   * Generic method to send template-based email
   * Uses retry logic and advanced logging for all template-based emails
   * @param {string} templateName - Template name (e.g., 'Registrierung und Kontoaktivierung')
   * @param {string} toEmail - Recipient email address
   * @param {object} variables - Template variables object
   * @returns {Promise<object>} { success, messageId, error, attempts, duration }
   */
  static async sendTemplateEmail(templateName, toEmail, variables = {}) {
    const emailInfo = {
      to: toEmail,
      templateName: templateName,
      subject: ''
    };

    try {
      const normalizedBaseVariables = await this.normalizeTemplateVariables(variables);
      const normalizedVariables = await this.addDeviceVisualVariables(normalizedBaseVariables);

      this.logger.info('Attempting to send template email', {
        templateName,
        to: toEmail,
        variableKeys: Object.keys(normalizedVariables)
      });

      // Validate required variables
      const validation = await NotificationTemplateService.validateTemplateVariables(
        templateName,
        'email',
        normalizedVariables
      );

      if (!validation.isValid) {
        const validationError = validation.error || `Missing required variables: ${validation.missingVariables.join(', ')}`;

        this.logger.warn('Template validation failed - missing variables', {
          templateName,
          missingVariables: validation.missingVariables,
          validationError,
          to: toEmail
        });

        this.deliveryTracker.recordDelivery({
          to: emailInfo.to,
          templateName: emailInfo.templateName,
          status: 'failed',
          attempts: 0,
          error: validationError
        });

        return {
          success: false,
          error: validationError
        };
      }

      // Render template
      const rendered = await NotificationTemplateService.renderTemplate(templateName, 'email', normalizedVariables);
      
      if (!rendered) {
        this.logger.error('Template not found or inactive', new Error(`Template "${templateName}" not found`), {
          templateName,
          to: toEmail,
          variableKeys: Object.keys(normalizedVariables)
        });

        this.deliveryTracker.recordDelivery({
          to: emailInfo.to,
          templateName: emailInfo.templateName,
          status: 'failed',
          attempts: 0,
          error: `Template "${templateName}" not found or inactive`
        });

        return {
          success: false,
          error: `Template "${templateName}" not found or inactive`
        };
      }

      emailInfo.subject = rendered.subject;

      // Send email with retry logic
      const operation = async () => {
        const transporter = await this.getTransporter();
        const mailOptions = {
          from: process.env.SMTP_FROM || 'noreply@fixithub.com',
          to: toEmail,
          subject: rendered.subject,
          html: rendered.content,
          text: rendered.text,
          replyTo: process.env.SUPPORT_EMAIL || 'support@fixithub.com'
        };

        return await transporter.sendMail(mailOptions);
      };

      const result = await this.retryHandler.executeWithRetry(
        operation.bind(this),
        `sendTemplateEmail(${templateName})`,
        emailInfo
      );

      if (result.success) {
        this.deliveryTracker.recordDelivery({
          to: emailInfo.to,
          templateName: emailInfo.templateName,
          subject: emailInfo.subject,
          messageId: result.result.messageId,
          status: 'sent',
          attempts: result.attempts,
          duration: result.duration,
          metadata: { variables: Object.keys(normalizedVariables) }
        });

        return {
          success: true,
          messageId: result.result.messageId,
          attempts: result.attempts,
          duration: result.duration
        };
      } else {
        this.deliveryTracker.recordDelivery({
          to: emailInfo.to,
          templateName: emailInfo.templateName,
          subject: emailInfo.subject,
          status: 'failed',
          attempts: result.attempts,
          error: result.error?.message,
          metadata: { variables: Object.keys(normalizedVariables) }
        });

        return {
          success: false,
          error: result.error?.message || 'Failed to send email after retries',
          attempts: result.attempts
        };
      }
    } catch (error) {
      this.logger.error('Unexpected error in sendTemplateEmail', error, {
        templateName,
        to: toEmail
      });

      this.deliveryTracker.recordDelivery({
        to: emailInfo.to,
        templateName: emailInfo.templateName,
        subject: emailInfo.subject,
        status: 'failed',
        attempts: 0,
        error: error.message
      });

      return { success: false, error: error.message };
    }
  }

  static async sendTriggerEmail(trigger, toEmail, variables = {}) {
    const templateName = this.TRIGGER_TEMPLATE_MAP[trigger];

    if (!templateName) {
      this.logger.warn('Unknown email trigger mapping', { trigger, to: toEmail });
      return {
        success: false,
        error: `No template mapping configured for trigger "${trigger}"`
      };
    }

    const candidateTemplates = [
      templateName,
      ...(this.TRIGGER_TEMPLATE_FALLBACKS[trigger] || [])
    ].filter((name, index, arr) => Boolean(name) && arr.indexOf(name) === index);

    let lastResult = null;
    for (const candidateTemplate of candidateTemplates) {
      const result = await this.sendTemplateEmail(candidateTemplate, toEmail, variables);
      if (result?.success) {
        return result;
      }
      lastResult = result;
    }

    return lastResult || {
      success: false,
      error: `Failed to send trigger email for "${trigger}"`
    };
  }

  /**
   * Send registration/account activation email
   */
  static async sendRegistrationEmail(toEmail, customerName, verificationUrl, companyName = 'McRepair.de') {
    return this.sendTriggerEmail('user_registered', toEmail, {
      companyName,
      customerName,
      customerEmail: toEmail,
      verificationUrl,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
      supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
    });
  }

  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(toEmail, customerName, passwordResetUrl, resetExpiresAt, companyName = 'McRepair.de') {
    return this.sendTriggerEmail('password_reset_requested', toEmail, {
      companyName,
      customerName,
      customerEmail: toEmail,
      passwordResetUrl,
      resetExpiresAt,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
      supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
    });
  }

  /**
   * Send order confirmation email
   */
  static async sendOrderConfirmationEmail(toEmail, orderData, companyName = 'McRepair.de') {
    const defaultTrackingUrl = await this.buildSystemUrl(`/orders/${orderData.orderId}`);
    return this.sendTriggerEmail('order_created', toEmail, {
      companyName,
      customerName: orderData.customerName || 'Valued Customer',
      customerEmail: toEmail,
      orderNumber: orderData.orderNumber,
      deviceBrand: orderData.deviceBrand,
      deviceModel: orderData.deviceModel,
      serviceName: orderData.serviceName,
      estimatedCompletion: orderData.estimatedCompletion,
      trackingUrl: orderData.trackingUrl || defaultTrackingUrl,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
      supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
    });
  }

  /**
   * Send diagnosis completed email
   */
  static async sendDiagnosisCompletedEmail(toEmail, orderData, companyName = 'McRepair.de') {
    const orderUrl = await this.buildSystemUrl(`/orders/${orderData.orderId}`);
    return this.sendTriggerEmail('diagnosis_completed', toEmail, {
      companyName,
      customerName: orderData.customerName || 'Geehrter Kunde',
      orderNumber: orderData.orderNumber,
      deviceBrand: orderData.deviceBrand,
      deviceModel: orderData.deviceModel,
      diagnosisResult: orderData.isRepairable ? 'Reparierbar' : 'Nicht reparierbar',
      diagnosisCompletedAt: new Date(orderData.diagnosisCompletedAt || Date.now()).toLocaleString('de-DE'),
      deviceCondition: orderData.deviceCondition || 'Wird im Bericht beschrieben',
      recommendedAction: orderData.recommendedAction || (orderData.isRepairable ? 'Kostenvoranschlag wird erstellt' : 'Bitte kontaktieren Sie uns fuer weitere Optionen'),
      orderUrl,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
      supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
    });
  }

  /**
   * Send order status update email
   */
  static async sendOrderStatusUpdateEmail(toEmail, orderData, companyName = 'McRepair.de') {
    const defaultTrackingUrl = await this.buildSystemUrl(`/orders/${orderData.orderId}`);
    return this.sendTriggerEmail('order_status_updated', toEmail, {
      companyName,
      customerName: orderData.customerName || 'Valued Customer',
      orderNumber: orderData.orderNumber,
      orderStatus: orderData.orderStatus,
      statusMessage: orderData.statusMessage,
      statusUpdatedAt: new Date(orderData.statusUpdatedAt || Date.now()).toLocaleDateString('de-DE'),
      trackingUrl: orderData.trackingUrl || defaultTrackingUrl,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
      supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
    });
  }

  /**
   * Send device received email
   */
  static async sendDeviceReceivedEmail(toEmail, orderData, companyName = 'McRepair.de') {
    const defaultTrackingUrl = await this.buildSystemUrl(`/orders/${orderData.orderId}`);
    return this.sendTriggerEmail('device_received', toEmail, {
      companyName,
      customerName: orderData.customerName || 'Valued Customer',
      orderNumber: orderData.orderNumber,
      deviceBrand: orderData.deviceBrand,
      deviceModel: orderData.deviceModel,
      receivedAt: new Date(orderData.receivedAt || Date.now()).toLocaleDateString('de-DE'),
      trackingUrl: orderData.trackingUrl || defaultTrackingUrl,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
      supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
    });
  }

  /**
   * Send quote approval request email
   */
  static async sendQuoteApprovalEmail(toEmail, orderData, companyName = 'McRepair.de') {
    const defaultApprovalUrl = await this.buildSystemUrl(`/orders/${orderData.orderId}/approve`);
    return this.sendTriggerEmail('quote_approval_requested', toEmail, {
      companyName,
      customerName: orderData.customerName || 'Valued Customer',
      orderNumber: orderData.orderNumber,
      deviceBrand: orderData.deviceBrand,
      deviceModel: orderData.deviceModel,
      serviceName: orderData.serviceName,
      quoteAmount: `€${(orderData.quoteAmount || 0).toFixed(2)}`,
      approvalDeadline: orderData.approvalDeadline || 'within 5 business days',
      approvalUrl: orderData.approvalUrl || defaultApprovalUrl,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
      supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
    });
  }

  /**
   * Send repair completion and return shipping email
   */
  static async sendCompletionEmail(toEmail, orderData, companyName = 'McRepair.de') {
    const defaultTrackingUrl = await this.buildSystemUrl(`/orders/${orderData.orderId}`);
    return this.sendTriggerEmail('order_completed', toEmail, {
      companyName,
      customerName: orderData.customerName || 'Valued Customer',
      orderNumber: orderData.orderNumber,
      deviceBrand: orderData.deviceBrand,
      deviceModel: orderData.deviceModel,
      returnShipmentStatus: orderData.returnShipmentStatus || 'dispatched',
      returnTrackingNumber: orderData.returnTrackingNumber || 'Tracking info will be updated soon',
      trackingUrl: orderData.trackingUrl || defaultTrackingUrl,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
      supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
    });
  }

  /**
   * Send payment confirmation email
   */
  static async sendPaymentConfirmationEmail(toEmail, paymentData, companyName = 'McRepair.de') {
    const defaultInvoiceUrl = await this.buildSystemUrl(`/invoices/${paymentData.invoiceId}`);
    return this.sendTriggerEmail('payment_confirmed', toEmail, {
      companyName,
      customerName: paymentData.customerName || 'Valued Customer',
      orderNumber: paymentData.orderNumber,
      amountPaid: `€${(paymentData.amountPaid || 0).toFixed(2)}`,
      paymentMethod: paymentData.paymentMethod || 'Card',
      paidAt: new Date(paymentData.paidAt || Date.now()).toLocaleDateString('de-DE', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }),
      invoiceNumber: paymentData.invoiceNumber,
      invoiceUrl: paymentData.invoiceUrl || defaultInvoiceUrl,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
      supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
    });
  }

  /**
   * Send contact form confirmation email to sender.
   */
  static async sendContactFormConfirmationEmail(toEmail, contactData, companyName = 'McRepair.de') {
    const submittedAt = contactData.submittedAt || new Date().toLocaleString('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const preview = String(contactData.message || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 220);

    const subjectLabels = {
      repair: 'Reparaturanfrage',
      status: 'Statusanfrage',
      business: 'Geschaeftliche Anfrage',
      complaint: 'Reklamation',
      other: 'Allgemeine Anfrage'
    };

    const subjectLabel = subjectLabels[contactData.subject] || subjectLabels.other;
    const supportEmail = process.env.SUPPORT_EMAIL || 'support@fixithub.com';
    const supportPhone = process.env.SUPPORT_PHONE || '+49 (0) 123/456789';
    const contactUrl = await this.buildSystemUrl('/contact');

    return this.sendTriggerEmail('contact_form_confirmation', toEmail, {
      companyName,
      customerName: contactData.name || 'Kunde',
      customerEmail: toEmail,
      contactSubject: subjectLabel,
      submittedAt,
      messagePreview: preview || '-',
      supportEmail,
      supportPhone,
      contactUrl
    });
  }
}

module.exports = EmailService;
