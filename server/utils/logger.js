/**
 * Advanced structured logging utility for FixitHub
 * Provides context-rich logging with severity levels and error tracking
 */

const fs = require('fs');
const path = require('path');

// Log levels with priority
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4
};

class Logger {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.logLevel = process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL] : LOG_LEVELS.INFO;
    this.enableFileLogging = options.enableFileLogging !== false;
    this.logDir = options.logDir || path.join(__dirname, '..', 'logs');
    this.enableConsole = options.enableConsole !== false;
    this.context = options.context || {};
    
    // Ensure log directory exists
    if (this.enableFileLogging && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Set additional context for all subsequent logs
   */
  setContext(contextData) {
    this.context = { ...this.context, ...contextData };
  }

  /**
   * Clear context
   */
  clearContext() {
    this.context = {};
  }

  /**
   * Format log message with timestamp and context
   */
  formatLog(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    return {
      timestamp,
      service: this.serviceName,
      level,
      message,
      context: this.context,
      data,
      pid: process.pid
    };
  }

  /**
   * Write log to console
   */
  writeConsole(logEntry) {
    const colors = {
      DEBUG: '\x1b[36m',    // Cyan
      INFO: '\x1b[32m',     // Green
      WARN: '\x1b[33m',     // Yellow
      ERROR: '\x1b[31m',    // Red
      CRITICAL: '\x1b[35m'  // Magenta
    };
    const reset = '\x1b[0m';

    const colorCode = colors[logEntry.level] || reset;
    const timestamp = logEntry.timestamp.substring(11, 19); // HH:MM:SS
    
    let output = `${colorCode}[${timestamp}] [${logEntry.service}] ${logEntry.level}: ${logEntry.message}${reset}`;
    
    if (Object.keys(logEntry.data).length > 0) {
      output += ` ${JSON.stringify(logEntry.data)}`;
    }
    
    if (Object.keys(logEntry.context).length > 0) {
      output += ` [Context: ${JSON.stringify(logEntry.context)}]`;
    }

    console.log(output);
  }

  /**
   * Write log to file
   */
  writeFile(logEntry) {
    try {
      const date = logEntry.timestamp.split('T')[0]; // YYYY-MM-DD
      const logFile = path.join(this.logDir, `${this.serviceName}-${date}.log`);
      
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(logFile, logLine);
    } catch (error) {
      console.error(`Failed to write log file: ${error.message}`);
    }
  }

  /**
   * Log message at specified level
   */
  log(level, message, data = {}) {
    const levelValue = LOG_LEVELS[level] || LOG_LEVELS.INFO;
    
    // Don't log if below minimum level
    if (levelValue < this.logLevel) {
      return;
    }

    const logEntry = this.formatLog(level, message, data);

    if (this.enableConsole) {
      this.writeConsole(logEntry);
    }

    if (this.enableFileLogging) {
      this.writeFile(logEntry);
    }
  }

  /**
   * Debug level logging
   */
  debug(message, data = {}) {
    this.log('DEBUG', message, data);
  }

  /**
   * Info level logging
   */
  info(message, data = {}) {
    this.log('INFO', message, data);
  }

  /**
   * Warn level logging
   */
  warn(message, data = {}) {
    this.log('WARN', message, data);
  }

  /**
   * Error level logging with enhanced context
   */
  error(message, error, additionalData = {}) {
    const errorData = {
      ...additionalData,
      errorMessage: error?.message || String(error),
      errorCode: error?.code,
      errorStack: error?.stack?.split('\n').slice(0, 3).join(' | ') // First 3 stack lines
    };

    this.log('ERROR', message, errorData);
  }

  /**
   * Critical level logging (for severe issues)
   */
  critical(message, error, additionalData = {}) {
    const errorData = {
      ...additionalData,
      errorMessage: error?.message || String(error),
      errorCode: error?.code,
      errorStack: error?.stack
    };

    this.log('CRITICAL', message, errorData);
  }

  /**
   * Log email-specific information
   */
  logEmailOperation(operation, emailData) {
    const sanitized = {
      to: emailData.to,
      templateName: emailData.templateName,
      subject: emailData.subject?.substring(0, 50),
      messageId: emailData.messageId,
      duration: emailData.duration + 'ms'
    };

    this.info(`Email ${operation}`, sanitized);
  }

  /**
   * Log SMTP configuration (sanitized for security)
   */
  logSMTPConfig(config) {
    const sanitized = {
      host: config.host,
      port: config.port,
      requiresAuthentication: config.auth?.user ? true : false,
      secure: config.secure,
      requiresTLS: config.requiresTLS
    };

    this.debug('SMTP Configuration', sanitized);
  }

  /**
   * Log retry attempt
   */
  logRetry(operation, attempt, maxAttempts, delay, error) {
    this.warn(`${operation} retry`, {
      attempt: `${attempt}/${maxAttempts}`,
      retryDelayMs: delay,
      lastError: error?.message
    });
  }

  /**
   * Log template rendering
   */
  logTemplateRender(templateName, success, error = null) {
    if (success) {
      this.debug('Template rendered', { templateName });
    } else {
      this.error('Template render failed', error, { templateName });
    }
  }
}

module.exports = Logger;
