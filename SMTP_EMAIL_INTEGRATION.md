# SMTP Email Integration - Advanced Logging & Delivery Tracking

## Overview
The SMTP email integration has been significantly enhanced with advanced logging, retry logic, and comprehensive delivery tracking. This ensures robust email delivery with detailed observability for troubleshooting and monitoring.

## New Components

### 1. Logger Utility (`/server/utils/logger.js`)
**Purpose:** Structured logging system for all services

**Features:**
- **Log Levels:** DEBUG, INFO, WARN, ERROR, CRITICAL
- **Structured Output:** Contextual information in JSON format
- **Dual Output:** Console (colored) + File logging
- **Context Propagation:** Per-logger context for request tracing
- **Service Identification:** Each logger knows its service name
- **Log Files:** Organized by service and date in `/server/logs/`

**Usage:**
```javascript
const Logger = require('./utils/logger');
const logger = new Logger('EmailService', { context: { version: '2.0' } });

logger.info('Email sent successfully', { to: 'user@example.com', messageId: '123' });
logger.error('SMTP connection failed', smtpError, { host: 'smtp.gmail.com', port: 587 });
logger.debug('SMTP Configuration', { host, port, auth: true });
```

**Log Entry Format:**
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "service": "EmailService",
  "level": "ERROR",
  "message": "SMTP connection verification failed",
  "context": { "service": "email", "version": "2.0" },
  "data": {
    "host": "smtp.gmail.com",
    "port": 587,
    "errorMessage": "Connection refused"
  },
  "pid": 12345
}
```

### 2. Email Retry Handler (`/server/utils/emailLogger.js`)
**Purpose:** Automatic retry logic with exponential backoff

**Features:**
- **Exponential Backoff:** Progressive delay between retries (1s, 2s, 4s... 30s max)
- **Jitter:** Random delay component to prevent thundering herd
- **Intelligent Retries:** Retries only transient errors (ECONNREFUSED, ETIMEDOUT, etc.)
- **Max Retries:** Configurable (default: 3 attempts)
- **Detailed Logging:** Each retry attempt is logged with context

**Configuration:**
```javascript
const retryHandler = new EmailRetryHandler({
  maxRetries: 3,           // Maximum retry attempts
  baseDelay: 1000,         // Starting delay in milliseconds
  maxBackoffDelay: 30000,  // Maximum delay between retries
  exponentialBase: 2       // Backoff multiplier
});
```

**Retryable Errors:**
- ECONNREFUSED - Connection refused
- ENOTFOUND - Host not found
- ETIMEDOUT - Operation timeout
- EHOSTUNREACH - Host unreachable
- ENETUNREACH - Network unreachable
- Messages containing: "timeout", "temporarily unavailable", "service unavailable", "too many connections"

### 3. Email Delivery Tracker (`/server/utils/emailLogger.js`)
**Purpose:** Track and monitor all email delivery attempts

**Features:**
- **Complete Records:** Logs all delivery attempts with status
- **In-Memory History:** Stores last 1000 delivery records
- **Statistics:** Success/failure rates, average delivery time
- **History Lookup:** Query delivery history by email address
- **Detailed Metadata:** Captures template names, attempts, durations, errors

**Tracking Data:**
```javascript
{
  id: "1705318245123-a1b2c3d4e",
  timestamp: "2024-01-15T10:30:45.123Z",
  to: "user@example.com",
  templateName: "Guest Order Confirmation",
  subject: "Order Confirmation - Order #12345",
  messageId: "abc123@gmail.com",
  status: "sent",           // 'sent', 'failed', 'queued'
  attempts: 2,              // Number of retry attempts
  duration: 2500,           // Milliseconds
  error: null,              // Error message if failed
  metadata: {
    orderNumbers: ["12345", "12346"],
    variables: ["customerName", "orderNumber"]
  }
}
```

## Enhanced Email Service

### getTransporter()
**Enhanced Features:**
- Advanced logging for configuration source detection
- SMTP connection verification (non-blocking)
- Support for requiresAuthentication and requiresTLS options
- Fallback chain: emailSettings → emailIntegration → environment variables
- Sanitized SMTP configuration logging (no credentials)

**Log Output:**
```
[10:30:45] [EmailService] INFO: Using SMTP settings from system configuration
[10:30:45] [EmailService] DEBUG: SMTP Configuration {"host":"smtp.gmail.com","port":587,"requiresAuthentication":true,"secure":true,"requiresTLS":true}
[10:30:46] [EmailService] DEBUG: SMTP connection verified successfully {"configSource":"systemConfiguration","host":"smtp.gmail.com","port":587}
```

### sendGuestOrderConfirmation()
**Enhanced with:**
- Retry logic via EmailRetryHandler
- Structured logging with order metadata
- Delivery tracking with message ID and duration
- Graceful error handling that doesn't block checkout

**Response Format:**
```javascript
{
  success: true,
  messageId: "abc123@gmail.com",
  attempts: 1,        // Retry attempts made
  duration: 2500      // Milliseconds to send
}
```

### sendTemplateEmail()
**Enhanced with:**
- Comprehensive validation logging (missing variables)
- Template rendering logging
- Retry logic with template context
- Failure tracking by template type
- Metadata capture for analysis

**Key Enhancements:**
```javascript
// Before sending, validates:
- Required template variables present
- Template exists and is active
- Variables are properly formatted

// On error, logs:
- Template name and recipient
- Missing variables (if applicable)
- SMTP error details
- Retry attempt information
```

## New Admin Endpoints

### 1. GET `/api/system-config/email/delivery-stats`
**Purpose:** Overall email delivery health and statistics

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalRecords": 150,
    "sent": 142,
    "failed": 5,
    "queued": 3,
    "averageDuration": 2340,  // milliseconds
    "failureRate": 3           // percentage
  },
  "message": "Email delivery statistics retrieved"
}
```

### 2. GET `/api/system-config/email/delivery-history/:email?limit=20`
**Purpose:** Retrieve delivery history for a specific recipient

**Example Request:**
```
GET /api/system-config/email/delivery-history/user@example.com?limit=10
```

**Response:**
```json
{
  "success": true,
  "email": "user@example.com",
  "history": [
    {
      "id": "1705318245123-a1b2c3d4e",
      "timestamp": "2024-01-15T10:30:45.123Z",
      "templateName": "Guest Order Confirmation",
      "subject": "Order Confirmation - Order #12345",
      "status": "sent",
      "attempts": 1,
      "duration": 2500,
      "error": null
    }
  ],
  "count": 5,
  "message": "Retrieved 5 delivery records"
}
```

### 3. GET `/api/system-config/email/delivery-log?filter=all&page=1&limit=50`
**Purpose:** Browse complete delivery log with filtering and pagination

**Query Parameters:**
- `filter`: 'all' (default), 'sent', 'failed', 'queued'
- `page`: Page number (default: 1)
- `limit`: Records per page (default: 50)

**Response:**
```json
{
  "success": true,
  "logs": [ /* delivery records */ ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 234,
    "pages": 5
  },
  "filter": "all",
  "message": "Retrieved 50 email delivery logs"
}
```

## Email Sending Methods

All email sending methods have been updated to use the new retry and logging infrastructure:

### 1. **sendGuestOrderConfirmation(orderData)**
   - Purpose: Send order confirmation to guest users
   - Retry Enabled: Yes
   - Tracking: Yes
   - Template: Direct HTML/Text

### 2. **sendTemplateEmail(templateName, toEmail, variables)**
   - Purpose: Generic template-based email sending
   - Retry Enabled: Yes
   - Tracking: Yes
   - Template: From database

### 3. **sendRegistrationEmail(toEmail, customerName, verificationUrl)**
   - Template: 'Registrierung und Kontoaktivierung'
   - Variables: customerName, customerEmail, verificationUrl, etc.

### 4. **sendPasswordResetEmail(toEmail, customerName, passwordResetUrl, resetExpiresAt)**
   - Template: 'Passwort zurücksetzen'
   - Variables: customerName, passwordResetUrl, resetExpiresAt, etc.

### 5. **sendOrderConfirmationEmail(toEmail, orderData)**
   - Template: 'Auftragsbestätigung Reparatur'
   - Variables: customerName, orderNumber, deviceBrand, estimatedCompletion, etc.

### 6. **sendOrderStatusUpdateEmail(toEmail, orderData)**
   - Template: 'Statusupdate Auftrag oder Buchung'
   - Variables: customerName, orderNumber, orderStatus, statusUpdatedAt, etc.

### 7. **sendDeviceReceivedEmail(toEmail, orderData)**
   - Template: 'Gerät eingegangen'
   - Variables: customerName, orderNumber, deviceBrand, receivedAt, etc.

### 8. **sendQuoteApprovalEmail(toEmail, orderData)**
   - Template: 'Kostenvoranschlag zur Freigabe'
   - Variables: customerName, orderNumber, quoteAmount, approvalDeadline, etc.

### 9. **sendCompletionEmail(toEmail, orderData)**
   - Template: 'Reparatur abgeschlossen und Rückversand'
   - Variables: customerName, orderNumber, returnShipmentStatus, trackingNumber, etc.

### 10. **sendPaymentConfirmationEmail(toEmail, paymentData)**
   - Template: 'Zahlung bestätigt'
   - Variables: customerName, orderNumber, amountPaid, paymentMethod, invoiceNumber, etc.

## Error Handling

### Transient Errors (Retried)
These errors are automatically retried with exponential backoff:
- Network connection issues
- DNS resolution failures
- SMTP server timeout
- Host unreachable
- Too many connections

### Permanent Errors (Not Retried)
These errors are logged and reported immediately:
- Invalid SMTP credentials
- Malformed email address
- SMTP server rejects relay
- Template not found
- Missing required variables

## Log Files

Logs are stored in `/server/logs/` with the following structure:

```
/server/logs/
├── EmailService-2024-01-15.log
├── EmailService-2024-01-14.log
├── EmailRetry-2024-01-15.log
├── EmailDelivery-2024-01-15.log
└── Logger-2024-01-15.log
```

**Enable/Disable File Logging:**
```javascript
const logger = new Logger('EmailService', { 
  enableFileLogging: false,  // Disable file logging
  enableConsole: true,       // Enable console output
  logDir: '/custom/path'     // Custom log directory
});
```

**Set Log Level:**
```bash
# Set LOG_LEVEL environment variable
export LOG_LEVEL=DEBUG   # Show all logs
export LOG_LEVEL=INFO    # Show INFO and above
export LOG_LEVEL=ERROR   # Show only errors
```

## Configuration in System Settings

**Email Settings Model:**
```javascript
{
  smtpHost: "smtp.gmail.com",
  smtpPort: 587,
  smtpUsername: "accounts@fixithub.com",
  smtpPassword: "encrypted_password",
  enableNotifications: true,
  requiresAuthentication: true,
  requiresTLS: true
}
```

**Test Endpoint:**
```bash
POST /api/system-config/email/test
{
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 587,
  "smtpUsername": "accounts@fixithub.com",
  "smtpPassword": "password",
  "requiresAuthentication": true,
  "requiresTLS": true
}
```

## Monitoring & Debugging

### Check Email Delivery Health
```bash
# Get overall statistics
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/system-config/email/delivery-stats

# Get history for specific user
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/system-config/email/delivery-history/user@example.com?limit=10

# Browse delivery log
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/system-config/email/delivery-log?filter=failed&limit=20
```

### View Log Files
```bash
# Watch email service logs in real-time
tail -f /server/logs/EmailService-$(date +%Y-%m-%d).log

# Search for errors
grep "ERROR" /server/logs/EmailService-*.log

# View JSON-formatted logs
cat /server/logs/EmailService-2024-01-15.log | jq '.'
```

### Common Troubleshooting

**No emails being sent:**
1. Check delivery stats: `delivery_stats.sent === 0`
2. Check error log filtering by status='failed'
3. Verify SMTP configuration in System Settings
4. Run test endpoint with SMTP credentials
5. Check server logs for connection errors

**High failure rate:**
1. Check `delivery_stats.failureRate`
2. Review failed delivery records for error patterns
3. Verify SMTP credentials are correct
4. Check if SMTP server is accessible
5. Verify TLS/SSL settings match server requirements

**Slow email delivery:**
1. Check average duration: `delivery_stats.averageDuration`
2. Review individual records for high duration values
3. Check network connectivity
4. Verify SMTP server load
5. Consider adjusting retry backoff settings

## Performance Impact

- **Memory:** Each delivery record ~500 bytes; 1000 records = ~500 KB
- **File I/O:** One JSON line per delivery logged to daily file
- **Retry Logic:** Adds minimal overhead; only retries on network errors
- **Transporter Creation:** Cached and reused per request

## Future Enhancements

Potential improvements for future versions:
- [ ] Database persistence for delivery records
- [ ] Email queue with scheduled retry processing
- [ ] Advanced analytics dashboard
- [ ] Webhook notifications for failed deliveries
- [ ] DKIM/SPF validation
- [ ] Bounce handling and automatic unsubscribe
- [ ] Template A/B testing
- [ ] Delivery rate SLA tracking
