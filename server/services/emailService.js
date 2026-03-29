const nodemailer = require('nodemailer');
const SystemConfigService = require('./systemConfigService');
const NotificationTemplateService = require('./notificationTemplateService');

class EmailService {
  /**
   * Get email transporter from system configuration
   */
  static async getTransporter() {
    try {
      const config = await SystemConfigService.getSystemConfiguration();
      const emailIntegration = config.integrations.find(
        int => int.type === 'email' && int.enabled
      );

      if (!emailIntegration) {
        console.warn('EmailService: No enabled email integration found, using default SMTP settings');
        // Fallback to environment variables or default settings
        return nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: process.env.SMTP_PORT || 587,
          secure: false,
          auth: {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || ''
          }
        });
      }

      return nodemailer.createTransport({
        host: emailIntegration.settings.smtpHost || 'smtp.gmail.com',
        port: emailIntegration.settings.smtpPort || 587,
        secure: false,
        auth: {
          user: emailIntegration.apiKey,
          pass: emailIntegration.apiSecret
        }
      });
    } catch (error) {
      console.error('EmailService: Error getting transporter:', error);
      throw error;
    }
  }

  /**
   * Send guest order confirmation email with tracking link
   */
  static async sendGuestOrderConfirmation(orderData) {
    try {
      console.log('EmailService: Sending guest order confirmation email to:', orderData.guestEmail);

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

      const info = await transporter.sendMail(mailOptions);
      console.log('EmailService: Guest order confirmation email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('EmailService: Error sending guest order confirmation email:', error);
      // Don't throw error - email failure shouldn't block checkout
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
   * @param {string} templateName - Template name (e.g., 'Registrierung und Kontoaktivierung')
   * @param {string} toEmail - Recipient email address
   * @param {object} variables - Template variables object
   * @returns {Promise<object>} { success, messageId, error }
   */
  static async sendTemplateEmail(templateName, toEmail, variables = {}) {
    try {
      console.log(`EmailService: Sending template email "${templateName}" to ${toEmail}`);

      // Validate required variables
      const validation = await NotificationTemplateService.validateTemplateVariables(
        templateName,
        'email',
        variables
      );

      if (!validation.isValid) {
        console.error(`EmailService: Missing required variables: ${validation.missingVariables.join(', ')}`);
        return {
          success: false,
          error: `Missing required variables: ${validation.missingVariables.join(', ')}`
        };
      }

      // Render template
      const rendered = await NotificationTemplateService.renderTemplate(templateName, 'email', variables);
      
      if (!rendered) {
        return {
          success: false,
          error: `Template "${templateName}" not found or inactive`
        };
      }

      const transporter = await this.getTransporter();
      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@fixithub.com',
        to: toEmail,
        subject: rendered.subject,
        html: rendered.content,
        text: rendered.text
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`EmailService: Template email sent successfully to ${toEmail}:`, info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`EmailService: Error sending template email: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send registration/account activation email
   */
  static async sendRegistrationEmail(toEmail, customerName, verificationUrl, companyName = 'FixitHub') {
    return this.sendTemplateEmail('Registrierung und Kontoaktivierung', toEmail, {
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
    return this.sendTemplateEmail('Passwort zurücksetzen', toEmail, {
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
    return this.sendTemplateEmail('Auftragsbestätigung Reparatur', toEmail, {
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
    return this.sendTemplateEmail('Statusupdate Auftrag oder Buchung', toEmail, {
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
    return this.sendTemplateEmail('Gerät eingegangen', toEmail, {
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
    return this.sendTemplateEmail('Kostenvoranschlag zur Freigabe', toEmail, {
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
    return this.sendTemplateEmail('Reparatur abgeschlossen und Rückversand', toEmail, {
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
    return this.sendTemplateEmail('Zahlung bestätigt', toEmail, {
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
