const nodemailer = require('nodemailer');
const SystemConfigService = require('./systemConfigService');
const NotificationTemplateService = require('./notificationTemplateService');
const Logger = require('../utils/logger');
const { EmailRetryHandler, EmailDeliveryTracker } = require('../utils/emailLogger');

/**
 * Email Service for sending emails via nodemailer
 * Supports SMTP configuration from database and environment variables
 * Includes advanced logging, retry logic, and delivery tracking
 */
class EmailService {
  static TRIGGER_TEMPLATE_MAP = {
    user_registered: 'Registrierung und Kontoaktivierung',
    password_reset_requested: 'Passwort zuruecksetzen',
    order_created: 'Auftragsbestaetigung Reparatur',
    order_status_updated: 'Statusupdate Auftrag oder Buchung',
    device_received: 'Geraet eingegangen',
    quote_approval_requested: 'Kostenvoranschlag zur Freigabe',
    order_completed: 'Reparatur abgeschlossen und Rueckversand',
    payment_confirmed: 'Zahlung bestaetigt',
    booking_created: 'Buchung angelegt',
    booking_status_updated: 'Buchung Statusupdate',
    booking_ready_for_pickup: 'Buchung bereit zur Abholung',
    booking_cancelled: 'Buchung storniert',
    repair_request_created: 'Repair Request eingegangen',
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
    system_notification: 'Allgemeine Systemnachricht'
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
      const trackingUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/track-order?token=${orderData.trackingToken}&email=${encodeURIComponent(orderData.guestEmail)}`;

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
      this.logger.info('Attempting to send template email', {
        templateName,
        to: toEmail,
        variableKeys: Object.keys(variables)
      });

      // Validate required variables
      const validation = await NotificationTemplateService.validateTemplateVariables(
        templateName,
        'email',
        variables
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
      const rendered = await NotificationTemplateService.renderTemplate(templateName, 'email', variables);
      
      if (!rendered) {
        this.logger.error('Template not found or inactive', new Error(`Template "${templateName}" not found`), {
          templateName,
          to: toEmail
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
          metadata: { variables: Object.keys(variables) }
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
          metadata: { variables: Object.keys(variables) }
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

    return this.sendTemplateEmail(templateName, toEmail, variables);
  }

  /**
   * Send registration/account activation email
   */
  static async sendRegistrationEmail(toEmail, customerName, verificationUrl, companyName = 'FixitHub') {
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
  static async sendPasswordResetEmail(toEmail, customerName, passwordResetUrl, resetExpiresAt, companyName = 'FixitHub') {
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
  static async sendOrderConfirmationEmail(toEmail, orderData, companyName = 'FixitHub') {
    return this.sendTriggerEmail('order_created', toEmail, {
      companyName,
      customerName: orderData.customerName || 'Valued Customer',
      customerEmail: toEmail,
      orderNumber: orderData.orderNumber,
      deviceBrand: orderData.deviceBrand,
      deviceModel: orderData.deviceModel,
      serviceName: orderData.serviceName,
      estimatedCompletion: orderData.estimatedCompletion,
      trackingUrl: orderData.trackingUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/orders/${orderData.orderId}`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
      supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
    });
  }

  /**
   * Send order status update email
   */
  static async sendOrderStatusUpdateEmail(toEmail, orderData, companyName = 'FixitHub') {
    return this.sendTriggerEmail('order_status_updated', toEmail, {
      companyName,
      customerName: orderData.customerName || 'Valued Customer',
      orderNumber: orderData.orderNumber,
      orderStatus: orderData.orderStatus,
      statusMessage: orderData.statusMessage,
      statusUpdatedAt: new Date(orderData.statusUpdatedAt || Date.now()).toLocaleDateString('de-DE'),
      trackingUrl: orderData.trackingUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/orders/${orderData.orderId}`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
      supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
    });
  }

  /**
   * Send device received email
   */
  static async sendDeviceReceivedEmail(toEmail, orderData, companyName = 'FixitHub') {
    return this.sendTriggerEmail('device_received', toEmail, {
      companyName,
      customerName: orderData.customerName || 'Valued Customer',
      orderNumber: orderData.orderNumber,
      deviceBrand: orderData.deviceBrand,
      deviceModel: orderData.deviceModel,
      receivedAt: new Date(orderData.receivedAt || Date.now()).toLocaleDateString('de-DE'),
      trackingUrl: orderData.trackingUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/orders/${orderData.orderId}`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
      supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
    });
  }

  /**
   * Send quote approval request email
   */
  static async sendQuoteApprovalEmail(toEmail, orderData, companyName = 'FixitHub') {
    return this.sendTriggerEmail('quote_approval_requested', toEmail, {
      companyName,
      customerName: orderData.customerName || 'Valued Customer',
      orderNumber: orderData.orderNumber,
      deviceBrand: orderData.deviceBrand,
      deviceModel: orderData.deviceModel,
      serviceName: orderData.serviceName,
      quoteAmount: `€${(orderData.quoteAmount || 0).toFixed(2)}`,
      approvalDeadline: orderData.approvalDeadline || 'within 5 business days',
      approvalUrl: orderData.approvalUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/orders/${orderData.orderId}/approve`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
      supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
    });
  }

  /**
   * Send repair completion and return shipping email
   */
  static async sendCompletionEmail(toEmail, orderData, companyName = 'FixitHub') {
    return this.sendTriggerEmail('order_completed', toEmail, {
      companyName,
      customerName: orderData.customerName || 'Valued Customer',
      orderNumber: orderData.orderNumber,
      deviceBrand: orderData.deviceBrand,
      deviceModel: orderData.deviceModel,
      returnShipmentStatus: orderData.returnShipmentStatus || 'dispatched',
      returnTrackingNumber: orderData.returnTrackingNumber || 'Tracking info will be updated soon',
      trackingUrl: orderData.trackingUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/orders/${orderData.orderId}`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
      supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
    });
  }

  /**
   * Send payment confirmation email
   */
  static async sendPaymentConfirmationEmail(toEmail, paymentData, companyName = 'FixitHub') {
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
      invoiceUrl: paymentData.invoiceUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invoices/${paymentData.invoiceId}`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
      supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789'
    });
  }
}

module.exports = EmailService;
