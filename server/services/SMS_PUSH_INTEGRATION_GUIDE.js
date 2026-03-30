/**
 * SMS/PUSH NOTIFICATION SERVICE INTEGRATION GUIDE
 * ================================================
 * 
 * This document describes how to use SMS and Push notifications
 * alongside the Email templates in your FixitHub system.
 */

// ========== 1. SENDING SMS NOTIFICATIONS ==========

const NotificationTemplateService = require('./services/notificationTemplateService');
const twilio = require('twilio'); // Example SMS provider

/**
 * Send SMS notification using template
 * SMS templates use simplified, character-limited text (< 160 chars)
 */
async function sendSMS(phoneNumber, templateName, variables) {
  // Get SMS template
  const smsTemplate = await NotificationTemplateService.renderTemplate(
    templateName,
    'sms',
    variables
  );

  if (!smsTemplate) {
    console.error(`SMS template "${templateName}" not found`);
    return;
  }

  // Example with Twilio (integrate your SMS provider)
  // const accountSid = process.env.TWILIO_ACCOUNT_SID;
  // const authToken = process.env.TWILIO_AUTH_TOKEN;
  // const client = twilio(accountSid, authToken);
  //
  // await client.messages.create({
  //   body: smsTemplate.content,
  //   from: process.env.TWILIO_PHONE_NUMBER,
  //   to: phoneNumber
  // });
}

// Example usage:
// await sendSMS('+49123456789', 'Auftragsbestätigung SMS', {
//   companyName: 'MyRepairShop',
//   orderNumber: 'ORD-12345',
//   deviceBrand: 'Apple',
//   deviceModel: 'iPhone 15',
//   trackingUrl: 'https://short.link/tracking'
// });


// ========== 2. SENDING PUSH NOTIFICATIONS ==========

/**
 * Send push notification using template
 * Push templates are concise, mobile-optimized (2-3 lines)
 */
async function sendPushNotification(userId, templateName, variables) {
  // Get push template
  const pushTemplate = await NotificationTemplateService.renderTemplate(
    templateName,
    'push',
    variables
  );

  if (!pushTemplate) {
    console.error(`Push template "${templateName}" not found`);
    return;
  }

  // Example with Firebase Cloud Messaging
  // const admin = require('firebase-admin');
  // const message = {
  //   notification: {
  //     title: pushTemplate.subject,
  //     body: pushTemplate.content
  //   },
  //   data: {
  //     orderId: variables.orderNumber,
  //     action: 'order-status'
  //   }
  // };
  //
  // await admin.messaging().send({
  //   ...message,
  //   token: userFCMToken
  // });
}

// Example usage:
// await sendPushNotification(userId, 'Fertigstellung Push', {
//   deviceBrand: 'Apple',
//   deviceModel: 'iPhone 15',
//   trackingUrl: 'https://short.link/return'
// });


// ========== 3. AVAILABLE TEMPLATES ==========

/**
 * Available SMS/Push Template Pairs
 * (Use same template names with 'email', 'sms', or 'push' channel type)
 * 
 * 1. Registrierung und Kontoaktivierung
 *    ├─ Email: Full welcome message with details
 *    ├─ SMS: "Willkommen! Bitte bestätigen Sie Ihre Email..."
 *    └─ Push: "Konto-Aktivierung erforderlich"
 * 
 * 2. Auftragsbestätigung Reparatur
 *    ├─ Email: Complete order details
 *    ├─ SMS: "Auftrag eingegangen..." (with tracking link)
 *    └─ Push: "Ihr {{deviceBrand}}-Reparaturauftrag aufgenommen"
 * 
 * 3. Statusupdate Auftrag oder Buchung
 *    ├─ Email: Detailed status explanation
 *    ├─ SMS: "Status: {{orderStatus}}"
 *    └─ Push: "Auftrag #{{orderNumber}} aktualisiert"
 * 
 * 4. Gerät eingegangen
 *    ├─ Email: Detailed receipt confirmation
 *    ├─ SMS: "Ihr {{deviceBrand}} wurde empfangen"
 *    └─ Push: "Gerät eingegangen ✓"
 * 
 * 5. Kostenvoranschlag zur Freigabe
 *    ├─ Email: Quote details with approval form
 *    ├─ SMS: "Quote {{quoteAmount}} - Genehmigung bis {{approvalDeadline}}"
 *    └─ Push: "Kostenvoranschlag {{quoteAmount}} - Genehmigung erforderlich"
 * 
 * 6. Reparatur abgeschlossen und Rückversand
 *    ├─ Email: Completion and return shipping details
 *    ├─ SMS: "Reparatur abgeschlossen! Versand unterwegs"
 *    └─ Push: "Reparatur vollständig ✓"
 * 
 * 7. Zahlung bestätigt
 *    ├─ Email: Payment receipt and invoice
 *    ├─ SMS: "Zahlung {{amountPaid}} eingegangen"
 *    └─ Push: "Zahlung empfangen ✓"
 * 
 * 8. Passwort zurücksetzen
 *    ├─ Email: Security reset instructions
 *    ├─ SMS: "Reset-Link: {{passwordResetUrl}}"
 *    └─ Push: "Passwort zurücksetzen"
 */


// ========== 4. INTEGRATION POINTS ==========

/**
 * Recommended integration points in your workflow:
 * 
 * 1. USER REGISTRATION
 *    → sendTemplateEmail('Registrierung...', email, variables)
 *    → sendSMS(phone, 'Registrierung SMS', variables)
 *    → sendPushNotification(userId, 'Registrierung Push', variables)
 * 
 * 2. PASSWORD RESET
 *    → sendTemplateEmail('Passwort zurücksetzen', email, variables)
 *    → sendSMS(phone, 'Passwort-Reset SMS', variables) [optional]
 * 
 * 3. ORDER CREATION
 *    → emailService.sendOrderConfirmationEmail(email, orderData)
 *    → sendSMS(customerPhone, 'Auftragsbestätigung SMS', orderVars)
 *    → sendPushNotification(userId, 'Auftragsbestätigung Push', orderVars)
 * 
 * 4. ORDER STATUS CHANGES
 *    → emailService.sendOrderStatusUpdateEmail(email, statusData)
 *    → sendSMS(customerPhone, 'Statusupdate SMS', statusData)
 *    → sendPushNotification(userId, 'Statusupdate Push', statusData)
 * 
 * 5. DEVICE RECEIVED
 *    → emailService.sendDeviceReceivedEmail(email, deviceData)
 *    → sendSMS(customerPhone, 'Geraetemeldung SMS', deviceData)
 *    → sendPushNotification(userId, 'Geraetemeldung Push', deviceData)
 * 
 * 6. QUOTE REQUEST APPROVAL
 *    → emailService.sendQuoteApprovalEmail(email, quoteData)
 *    → sendSMS(customerPhone, 'Kostenvoranschlag SMS', quoteData)
 *    → sendPushNotification(userId, 'Kostenvoranschlag Push', quoteData)
 * 
 * 7. REPAIR COMPLETION
 *    → emailService.sendCompletionEmail(email, completionData)
 *    → sendSMS(customerPhone, 'Fertigstellung SMS', completionData)
 *    → sendPushNotification(userId, 'Fertigstellung Push', completionData)
 * 
 * 8. PAYMENT CONFIRMATION
 *    → emailService.sendPaymentConfirmationEmail(email, paymentData)
 *    → sendSMS(customerPhone, 'Zahlungsbestätigung SMS', paymentData)
 *    → sendPushNotification(userId, 'Zahlungsbestätigung Push', paymentData)
 */


// ========== 5. VALIDATION ==========

/**
 * Validate templates before sending
 */
async function validateAndSendNotification(templateName, channelType, variables) {
  const validation = await NotificationTemplateService.validateTemplateVariables(
    templateName,
    channelType,
    variables
  );

  if (!validation.isValid) {
    console.error('Missing required variables:', validation.missingVariables);
    console.error('Required:', validation.requiredVariables);
    return {
      success: false,
      error: `Missing: ${validation.missingVariables.join(', ')}`
    };
  }

  // Proceed with sending
  const rendered = await NotificationTemplateService.renderTemplate(
    templateName,
    channelType,
    variables
  );

  // Send via appropriate channel
  // if (channelType === 'sms') await sendSMS(...)
  // if (channelType === 'push') await sendPushNotification(...)
  // if (channelType === 'email') await sendEmail(...)
}


// ========== 6. MULTI-CHANNEL EXAMPLE ==========

/**
 * Send same message via all active channels
 */
async function notifyCustomer(customerId, templateBaseName, variables, channels = ['email', 'sms', 'push']) {
  const results = {};

  for (const channel of channels) {
    try {
      let templateName = templateBaseName;
      
      // Map base name to specific channel template
      // e.g. 'Auftragsbestätigung' → 'Auftragsbestätigung Reparatur' (email),
      //                                'Auftragsbestätigung SMS' (sms),
      //                                'Auftragsbestätigung Push' (push)
      
      if (channel === 'sms') {
        templateName = templateBaseName.replace('Reparatur', '').trim() + ' SMS';
      } else if (channel === 'push') {
        templateName = templateBaseName.replace('Reparatur', '').trim() + ' Push';
      }

      const rendered = await NotificationTemplateService.renderTemplate(
        templateName,
        channel,
        variables
      );

      if (rendered) {
        // Send via channel
        // results[channel] = await sendViaChannel(channel, rendered, customerId);
      }
    } catch (error) {
      results[channel] = { success: false, error: error.message };
    }
  }

  return results;
}

module.exports = {
  sendSMS,
  sendPushNotification,
  validateAndSendNotification,
  notifyCustomer
};
