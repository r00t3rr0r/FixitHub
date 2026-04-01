/**
 * Email tracking and retry utility
 * Provides retry logic, delivery tracking, and detailed error logging
 */

const Logger = require('./logger');

class EmailRetryHandler {
  constructor(options = {}) {
    this.logger = new Logger('EmailRetry', { context: { retryHandler: true } });
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.maxBackoffDelay = options.maxBackoffDelay || 30000; // 30 seconds
    this.exponentialBase = options.exponentialBase || 2;
    this.retryableErrors = options.retryableErrors || [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'EHOSTUNREACH',
      'ENETUNREACH'
    ];
  }

  /**
   * Calculate delay for exponential backoff
   */
  calculateDelay(attempt) {
    const delay = this.baseDelay * Math.pow(this.exponentialBase, attempt - 1);
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    const finalDelay = Math.min(delay + jitter, this.maxBackoffDelay);
    return Math.round(finalDelay);
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    if (!error) return false;
    
    // Check error code
    if (error.code && this.retryableErrors.includes(error.code)) {
      return true;
    }

    // Check error message for known transient errors
    const message = error.message || '';
    const transientPatterns = [
      /timeout/i,
      /ECONNREFUSED/,
      /ENOTFOUND/,
      /temporarily unavailable/i,
      /service unavailable/i,
      /too many connections/i
    ];

    return transientPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry(operation, operationName, emailInfo = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await operation();
        const duration = Date.now() - startTime;

        this.logger.info(`${operationName} succeeded`, {
          attempt,
          duration: `${duration}ms`,
          messageId: result.messageId,
          to: emailInfo.to
        });

        return {
          success: true,
          result,
          attempts: attempt,
          duration
        };
      } catch (error) {
        lastError = error;
        const duration = Date.now();

        if (attempt < this.maxRetries && this.isRetryableError(error)) {
          const delay = this.calculateDelay(attempt);
          this.logger.logRetry(operationName, attempt, this.maxRetries, delay, error);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Either max retries reached or error is not retryable
          this.logger.error(`${operationName} failed after ${attempt} attempts`, error, {
            attempt,
            maxRetries: this.maxRetries,
            isRetryable: this.isRetryableError(error),
            to: emailInfo.to,
            errorMessage: error.message,
            errorCode: error.code
          });
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: this.maxRetries
    };
  }
}

/**
 * Email delivery tracker
 * Logs and monitors email delivery to database/file
 */
class EmailDeliveryTracker {
  constructor(options = {}) {
    this.logger = new Logger('EmailDelivery', { context: { deliveryTracker: true } });
    this.deliveryLog = [];
    this.smtpConnectionLog = [];
  }

  /**
   * Record email delivery
   */
  recordDelivery(deliveryInfo) {
    const record = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      to: deliveryInfo.to,
      templateName: deliveryInfo.templateName,
      subject: deliveryInfo.subject,
      messageId: deliveryInfo.messageId,
      status: deliveryInfo.status, // 'sent', 'failed', 'queued'
      attempts: deliveryInfo.attempts,
      duration: deliveryInfo.duration,
      error: deliveryInfo.error,
      metadata: deliveryInfo.metadata || {}
    };

    this.deliveryLog.push(record);

    // Keep only recent records in memory (last 1000)
    if (this.deliveryLog.length > 1000) {
      this.deliveryLog = this.deliveryLog.slice(-1000);
    }

    // Log the delivery
    if (record.status === 'sent') {
      this.logger.info('Email delivered', {
        to: record.to,
        subject: record.subject?.substring(0, 50),
        messageId: record.messageId,
        duration: `${record.duration}ms`,
        attempts: record.attempts
      });
    } else if (record.status === 'failed') {
      this.logger.error('Email delivery failed', 
        new Error(record.error), 
        {
          to: record.to,
          subject: record.subject?.substring(0, 50),
          attempts: record.attempts
        }
      );
    }

    return record;
  }

  /**
   * Record SMTP connection and verification attempts
   */
  recordSMTPConnection(connectionInfo) {
    const record = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      source: connectionInfo.source || 'unknown',
      host: connectionInfo.host,
      port: connectionInfo.port,
      secure: Boolean(connectionInfo.secure),
      requiresTLS: Boolean(connectionInfo.requiresTLS),
      hasAuth: Boolean(connectionInfo.hasAuth),
      status: connectionInfo.status || 'attempted', // attempted | verified | failed
      message: connectionInfo.message || '',
      error: connectionInfo.error || null
    };

    this.smtpConnectionLog.push(record);

    if (this.smtpConnectionLog.length > 500) {
      this.smtpConnectionLog = this.smtpConnectionLog.slice(-500);
    }

    if (record.status === 'failed') {
      this.logger.error('SMTP connection failed', new Error(record.error || record.message || 'Unknown SMTP error'), {
        source: record.source,
        host: record.host,
        port: record.port,
        secure: record.secure,
        requiresTLS: record.requiresTLS,
        hasAuth: record.hasAuth
      });
    } else {
      this.logger.info('SMTP connection event', {
        source: record.source,
        host: record.host,
        port: record.port,
        status: record.status,
        secure: record.secure,
        requiresTLS: record.requiresTLS,
        hasAuth: record.hasAuth
      });
    }

    return record;
  }

  /**
   * Get SMTP connection log with optional status filtering
   */
  getSMTPConnectionLog(status = 'all', limit = 50) {
    const filtered = status === 'all'
      ? this.smtpConnectionLog
      : this.smtpConnectionLog.filter((entry) => entry.status === status);

    return [...filtered]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Get delivery history for email address
   */
  getDeliveryHistory(toEmail, limit = 10) {
    return this.deliveryLog
      .filter(record => record.to === toEmail)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get statistics on email delivery
   */
  getStatistics() {
    const stats = {
      totalRecords: this.deliveryLog.length,
      sent: 0,
      failed: 0,
      queued: 0,
      averageDuration: 0,
      failureRate: 0
    };

    let totalDuration = 0;

    this.deliveryLog.forEach(record => {
      if (record.status === 'sent') {
        stats.sent++;
        totalDuration += record.duration || 0;
      } else if (record.status === 'failed') {
        stats.failed++;
      } else if (record.status === 'queued') {
        stats.queued++;
      }
    });

    stats.averageDuration = stats.sent > 0 ? Math.round(totalDuration / stats.sent) : 0;
    stats.failureRate = stats.totalRecords > 0 
      ? Math.round((stats.failed / stats.totalRecords) * 100) 
      : 0;

    return stats;
  }
}

module.exports = {
  EmailRetryHandler,
  EmailDeliveryTracker,
  Logger: require('./logger')
};
