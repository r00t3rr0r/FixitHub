const ContactMessage = require('../models/ContactMessage');
const EmailService = require('./emailService');
const NotificationTemplateService = require('./notificationTemplateService');

class ContactMessageService {
  // Delete all contact messages
  static async deleteAllContactMessages() {
    try {
      const ContactMessage = require('../models/ContactMessage');
      const result = await ContactMessage.deleteMany({});
      return { success: true, deletedCount: result.deletedCount };
    } catch (error) {
      console.error('ContactMessageService: Error deleting all contact messages:', error);
      throw error;
    }
  }
  static SUBJECT_LABELS = {
    repair: 'Reparaturanfrage',
    status: 'Statusanfrage',
    business: 'Geschäftliche Anfrage',
    complaint: 'Reklamation',
    other: 'Allgemeine Anfrage',
  };

  /**
   * Generate unique message number
   */
  static async generateMessageNumber() {
    const prefix = 'CM';
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await ContactMessage.countDocuments({});
    const seqNum = String(count + 1).padStart(5, '0');
    return `${prefix}-${dateStr}-${seqNum}`;
  }

  /**
   * Save new contact message to database
   */
  static async saveContactMessage(data) {
    try {
      const messageNumber = await this.generateMessageNumber();

      const contactMessage = new ContactMessage({
        messageNumber,
        name: data.name,
        email: data.email,
        phone: data.phone || '',
        subject: data.subject,
        message: data.message,
        orderNumber: data.orderNumber || '',
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        status: 'new',
        isSpam: data.isSpam || false,
        replies: [],
      });

      await contactMessage.save();
      console.log(`ContactMessageService: Message saved with ID: ${contactMessage._id}`);
      return contactMessage;
    } catch (error) {
      console.error('ContactMessageService: Error saving message:', error);
      throw error;
    }
  }

  /**
   * Get all contact messages with filtering
   */
  static async getContactMessages(filters = {}) {
    try {
      const {
        status = '',
        search = '',
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = filters;

      const query = {};

      if (status && status !== 'all') {
        query.status = status;
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { message: { $regex: search, $options: 'i' } },
          { messageNumber: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (page - 1) * limit;
      const sortObj = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

      const messages = await ContactMessage.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean();

      const totalCount = await ContactMessage.countDocuments(query);
      const totalPages = Math.ceil(totalCount / limit);

      return {
        messages,
        totalCount,
        totalPages,
        currentPage: page,
        limit,
      };
    } catch (error) {
      console.error('ContactMessageService: Error fetching messages:', error);
      throw error;
    }
  }

  /**
   * Get single contact message by ID
   */
  static async getContactMessageById(messageId) {
    try {
      const message = await ContactMessage.findById(messageId);
      if (!message) {
        throw new Error('Kontaktanfrage nicht gefunden');
      }
      return message;
    } catch (error) {
      console.error('ContactMessageService: Error fetching message:', error);
      throw error;
    }
  }

  /**
   * Update message status
   */
  static async updateMessageStatus(messageId, status) {
    try {
      const message = await ContactMessage.findByIdAndUpdate(
        messageId,
        { status, updatedAt: Date.now() },
        { new: true }
      );

      if (!message) {
        throw new Error('Kontaktanfrage nicht gefunden');
      }

      return message;
    } catch (error) {
      console.error('ContactMessageService: Error updating status:', error);
      throw error;
    }
  }

  /**
   * Send reply to contact message
   */
  static async sendReply(messageId, replyData) {
    try {
      const message = await this.getContactMessageById(messageId);

      const {
        subject,
        htmlContent,
        message: messageText,
        repliedBy,
        templateName,
        variables,
      } = replyData;

      const transporter = await EmailService.getTransporter();
      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@fixithub.com',
        to: message.email,
        replyTo: process.env.SUPPORT_EMAIL || 'support@fixithub.com',
        subject: subject || `Re: ${this.SUBJECT_LABELS[message.subject] || message.subject}`,
        html: htmlContent || messageText,
        text: messageText,
      };

      const result = await transporter.sendMail(mailOptions);

      // Add reply to message
      const reply = {
        repliedBy,
        repliedAt: Date.now(),
        subject: mailOptions.subject,
        message: messageText,
        htmlContent,
        templateName,
        variables,
        status: 'sent',
        sentAt: Date.now(),
        messageId: result.messageId,
      };

      message.replies.push(reply);
      message.status = 'replied';
      message.updatedAt = Date.now();
      await message.save();

      console.log(`ContactMessageService: Reply sent to ${message.email}`);
      return {
        success: true,
        messageId: result.messageId,
        reply,
      };
    } catch (error) {
      console.error('ContactMessageService: Error sending reply:', error);
      throw error;
    }
  }

  /**
   * Save reply as draft (without sending)
   */
  static async saveDraftReply(messageId, replyData) {
    try {
      const message = await this.getContactMessageById(messageId);

      const {
        subject,
        htmlContent,
        message: messageText,
        repliedBy,
        templateName,
        variables,
      } = replyData;

      const reply = {
        repliedBy,
        repliedAt: Date.now(),
        subject,
        message: messageText,
        htmlContent,
        templateName,
        variables,
        status: 'draft',
      };

      message.replies.push(reply);
      message.updatedAt = Date.now();
      await message.save();

      return {
        success: true,
        reply,
      };
    } catch (error) {
      console.error('ContactMessageService: Error saving draft:', error);
      throw error;
    }
  }

  /**
   * Get statistics
   */
  static async getContactMessageStats() {
    try {
      const total = await ContactMessage.countDocuments({});
      const newCount = await ContactMessage.countDocuments({ status: 'new' });
      const repliedCount = await ContactMessage.countDocuments({ status: 'replied' });
      const closedCount = await ContactMessage.countDocuments({ status: 'closed' });

      return {
        total,
        new: newCount,
        replied: repliedCount,
        closed: closedCount,
      };
    } catch (error) {
      console.error('ContactMessageService: Error fetching stats:', error);
      throw error;
    }
  }

  /**
   * Delete message
   */
  static async deleteMessage(messageId) {
    try {
      const message = await ContactMessage.findByIdAndDelete(messageId);
      if (!message) {
        throw new Error('Kontaktanfrage nicht gefunden');
      }
      return message;
    } catch (error) {
      console.error('ContactMessageService: Error deleting message:', error);
      throw error;
    }
  }
}

module.exports = ContactMessageService;
