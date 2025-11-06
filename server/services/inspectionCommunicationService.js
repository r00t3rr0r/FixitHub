const InspectionCommunication = require('../models/InspectionCommunication');
const Order = require('../models/Order');
const DeviceInspection = require('../models/DeviceInspection');
const NotificationService = require('./notificationService');

class InspectionCommunicationService {
  // Get or create communication thread for an order
  static async getOrCreateCommunicationThread(orderId, inspectionId = null) {
    try {
      let communication = await InspectionCommunication.findOne({ orderId });

      if (!communication) {
        console.log(`InspectionCommunicationService: Creating new communication thread for order ${orderId}`);
        communication = new InspectionCommunication({
          orderId,
          inspectionId,
          messages: [],
          status: 'active',
        });
        await communication.save();
      }

      return communication;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error getting or creating communication thread: ${error}`);
      throw error;
    }
  }

  // Send a message
  static async sendMessage(orderId, senderId, senderName, content, senderType = 'staff', senderRole = null) {
    try {
      console.log(`InspectionCommunicationService: Sending message to order ${orderId} from ${senderName}`);

      let communication = await InspectionCommunication.findOne({ orderId });

      if (!communication) {
        communication = await this.getOrCreateCommunicationThread(orderId);
      }

      const message = {
        senderId,
        senderType,
        senderName,
        senderRole,
        messageType: 'text',
        content,
        readBy: [],
      };

      communication.messages.push(message);
      communication.lastMessageAt = new Date();
      await communication.save();

      console.log(`InspectionCommunicationService: Message sent successfully`);
      return communication;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error sending message: ${error}`);
      throw error;
    }
  }

  // Send a feedback request
  static async sendFeedbackRequest(orderId, inspectionId, senderId, senderName, question, options, senderRole = null) {
    try {
      console.log(`InspectionCommunicationService: Sending feedback request to order ${orderId}`);

      let communication = await InspectionCommunication.findOne({ orderId });

      if (!communication) {
        communication = await this.getOrCreateCommunicationThread(orderId, inspectionId);
      }

      const expirationTime = new Date();
      expirationTime.setHours(expirationTime.getHours() + 48); // 48 hour expiration

      const message = {
        senderId,
        senderType: 'staff',
        senderName,
        senderRole,
        messageType: 'feedback_request',
        content: question,
        feedbackRequest: {
          type: 'agreement',
          question,
          options,
          status: 'pending',
          expiresAt: expirationTime,
        },
        readBy: [],
      };

      communication.messages.push(message);
      communication.lastMessageAt = new Date();
      communication.pendingFeedbackCount = (communication.pendingFeedbackCount || 0) + 1;
      await communication.save();

      // Create notification for customer
      try {
        const order = await Order.findById(orderId);
        if (order && order.customerId) {
          await NotificationService.createNotification(
            order.customerId,
            'inspection_feedback_required',
            'Feedback Required on Your Repair Inspection',
            question,
            { orderId, messageId: message._id },
            'inspection'
          );
        }
      } catch (notificationError) {
        console.error(`InspectionCommunicationService: Error creating notification: ${notificationError}`);
        // Don't throw, as the main operation succeeded
      }

      console.log(`InspectionCommunicationService: Feedback request sent successfully`);
      return communication;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error sending feedback request: ${error}`);
      throw error;
    }
  }

  // Respond to feedback request
  static async respondToFeedback(orderId, messageId, response, responderId, respondedByName) {
    try {
      console.log(`InspectionCommunicationService: Recording feedback response from ${respondedByName}`);

      const communication = await InspectionCommunication.findOne({ orderId });

      if (!communication) {
        throw new Error('Communication thread not found');
      }

      const messageIndex = communication.messages.findIndex(
        msg => msg._id && msg._id.toString() === messageId
      );

      if (messageIndex === -1) {
        throw new Error('Message not found');
      }

      const message = communication.messages[messageIndex];

      if (!message.feedbackRequest) {
        throw new Error('This message is not a feedback request');
      }

      message.feedbackRequest.response = response;
      message.feedbackRequest.respondedAt = new Date();
      message.feedbackRequest.respondedBy = responderId;
      message.feedbackRequest.status = 'responded';
      communication.pendingFeedbackCount = Math.max(0, communication.pendingFeedbackCount - 1);
      communication.lastMessageAt = new Date();

      await communication.save();

      console.log(`InspectionCommunicationService: Feedback response recorded successfully`);
      return communication;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error responding to feedback: ${error}`);
      throw error;
    }
  }

  // Create a quick action
  static async createQuickAction(orderId, inspectionId, senderId, senderName, actionType, description = null, metadata = null, senderRole = null) {
    try {
      console.log(`InspectionCommunicationService: Creating quick action ${actionType} for order ${orderId}`);

      let communication = await InspectionCommunication.findOne({ orderId });

      if (!communication) {
        communication = await this.getOrCreateCommunicationThread(orderId, inspectionId);
      }

      // Define action labels
      const actionLabels = {
        part_replacement: 'Part Replacement Required',
        incorrect_device: 'Incorrect Device Specified',
        incorrect_unlock_code: 'Incorrect Unlock Code',
        additional_costs: 'Additional Costs Required',
      };

      const message = {
        senderId,
        senderType: 'staff',
        senderName,
        senderRole,
        messageType: 'quick_action',
        content: actionLabels[actionType] || actionType,
        quickAction: {
          actionType,
          actionLabel: actionLabels[actionType] || actionType,
          description,
          metadata,
          status: 'pending',
        },
        readBy: [],
      };

      communication.messages.push(message);
      communication.lastMessageAt = new Date();
      communication.pendingActionsCount = (communication.pendingActionsCount || 0) + 1;
      await communication.save();

      // Create notification for customer
      try {
        const order = await Order.findById(orderId);
        if (order && order.customerId) {
          await NotificationService.createNotification(
            order.customerId,
            'inspection_quick_action',
            `${actionLabels[actionType] || actionType}`,
            description || actionLabels[actionType] || actionType,
            { orderId, messageId: message._id, actionType },
            'inspection'
          );
        }
      } catch (notificationError) {
        console.error(`InspectionCommunicationService: Error creating notification: ${notificationError}`);
        // Don't throw, as the main operation succeeded
      }

      console.log(`InspectionCommunicationService: Quick action created successfully`);
      return communication;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error creating quick action: ${error}`);
      throw error;
    }
  }

  // Complete a quick action
  static async completeQuickAction(orderId, messageId) {
    try {
      console.log(`InspectionCommunicationService: Completing quick action in order ${orderId}`);

      const communication = await InspectionCommunication.findOne({ orderId });

      if (!communication) {
        throw new Error('Communication thread not found');
      }

      const messageIndex = communication.messages.findIndex(
        msg => msg._id && msg._id.toString() === messageId
      );

      if (messageIndex === -1) {
        throw new Error('Message not found');
      }

      const message = communication.messages[messageIndex];

      if (!message.quickAction) {
        throw new Error('This message is not a quick action');
      }

      message.quickAction.status = 'completed';
      message.quickAction.completedAt = new Date();
      communication.pendingActionsCount = Math.max(0, communication.pendingActionsCount - 1);
      communication.lastMessageAt = new Date();

      await communication.save();

      console.log(`InspectionCommunicationService: Quick action completed successfully`);
      return communication;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error completing quick action: ${error}`);
      throw error;
    }
  }

  // Get communication thread with all messages
  static async getCommunicationThread(orderId) {
    try {
      console.log(`InspectionCommunicationService: Fetching communication thread for order ${orderId}`);

      const communication = await InspectionCommunication.findOne({ orderId })
        .populate('messages.senderId', 'name email role avatar')
        .populate('messages.feedbackRequest.respondedBy', 'name email')
        .sort({ 'messages.createdAt': 1 });

      if (!communication) {
        return await this.getOrCreateCommunicationThread(orderId);
      }

      return communication;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error fetching communication thread: ${error}`);
      throw error;
    }
  }

  // Mark messages as read
  static async markMessagesAsRead(orderId, userId) {
    try {
      console.log(`InspectionCommunicationService: Marking messages as read for user ${userId} in order ${orderId}`);

      const communication = await InspectionCommunication.findOne({ orderId });

      if (!communication) {
        throw new Error('Communication thread not found');
      }

      communication.messages.forEach(message => {
        const hasUserRead = message.readBy.some(read => read.userId.toString() === userId.toString());
        if (!hasUserRead) {
          message.readBy.push({
            userId,
            readAt: new Date(),
          });
        }
      });

      await communication.save();

      console.log(`InspectionCommunicationService: Messages marked as read`);
      return communication;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error marking messages as read: ${error}`);
      throw error;
    }
  }

  // Get pending feedback count for an order
  static async getPendingFeedbackCount(orderId) {
    try {
      const communication = await InspectionCommunication.findOne({ orderId });
      return communication ? communication.pendingFeedbackCount : 0;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error getting pending feedback count: ${error}`);
      throw error;
    }
  }

  // Get pending actions count for an order
  static async getPendingActionsCount(orderId) {
    try {
      const communication = await InspectionCommunication.findOne({ orderId });
      return communication ? communication.pendingActionsCount : 0;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error getting pending actions count: ${error}`);
      throw error;
    }
  }
}

module.exports = InspectionCommunicationService;
