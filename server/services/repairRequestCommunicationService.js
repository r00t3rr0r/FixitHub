const RepairRequestCommunication = require('../models/RepairRequestCommunication');
const RepairRequest = require('../models/RepairRequest');
const NotificationService = require('./notificationService');

class RepairRequestCommunicationService {
  // Get or create communication thread for a repair request
  static async getOrCreateCommunicationThread(repairRequestId) {
    try {
      let communication = await RepairRequestCommunication.findOne({ repairRequestId });

      if (!communication) {
        console.log(`RepairRequestCommunicationService: Creating new communication thread for repair request ${repairRequestId}`);
        communication = new RepairRequestCommunication({
          repairRequestId,
          messages: [],
          status: 'active',
          pendingFeedbackCount: 0,
          pendingActionsCount: 0,
        });
        await communication.save();
      }

      return communication;
    } catch (error) {
      console.error(`RepairRequestCommunicationService: Error getting or creating communication thread: ${error.message}`, error);
      throw error;
    }
  }

  // Get communication thread (used by frontend)
  static async getCommunicationThread(repairRequestId) {
    try {
      console.log(`RepairRequestCommunicationService: Getting communication thread for repair request ${repairRequestId}`);

      let communication = await RepairRequestCommunication.findOne({ repairRequestId });

      if (!communication) {
        communication = await this.getOrCreateCommunicationThread(repairRequestId);
      }

      // Sort messages by date
      if (communication && communication.messages && communication.messages.length > 0) {
        communication.messages.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
      }

      console.log(`RepairRequestCommunicationService: Communication thread retrieved with ${communication?.messages?.length || 0} messages`);
      return communication;
    } catch (error) {
      console.error(`RepairRequestCommunicationService: Error getting communication thread: ${error.message}`, error);
      throw error;
    }
  }

  // Send a message
  static async sendMessage(repairRequestId, senderId, senderName, content, senderType = 'staff', senderRole = null) {
    try {
      console.log(`RepairRequestCommunicationService: Sending message to repair request ${repairRequestId} from ${senderName}`);

      let communication = await RepairRequestCommunication.findOne({ repairRequestId });

      if (!communication) {
        communication = await this.getOrCreateCommunicationThread(repairRequestId);
      }

      const message = {
        senderId: {
          name: senderName,
          email: '',
          avatar: null,
        },
        senderType,
        senderName,
        senderRole,
        messageType: 'text',
        content,
        readBy: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      communication.messages.push(message);
      communication.lastMessageAt = new Date();
      await communication.save();

      // Refetch to ensure all messages are properly structured
      communication = await RepairRequestCommunication.findOne({ repairRequestId });

      if (communication && communication.messages && communication.messages.length > 0) {
        communication.messages.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
      }

      console.log(`RepairRequestCommunicationService: Message sent successfully`);

      // Create notification for relevant parties
      try {
        const repairRequest = await RepairRequest.findById(repairRequestId);
        if (repairRequest) {
          if (senderType === 'staff' && repairRequest.customerId) {
            // Notify customer if message is from staff
            await NotificationService.createNotification({
              userId: repairRequest.customerId,
              title: 'New Message on Your Repair Request',
              message: content.substring(0, 100),
              type: 'message',
              actionUrl: `/my-repair-requests`,
              metadata: { repairRequestId, messageType: 'text' }
            }).catch(err => console.error('Error creating notification:', err));
          } else if (senderType === 'customer' && repairRequest.assignedStaffId) {
            // Notify assigned staff if message is from customer
            await NotificationService.createNotification({
              userId: repairRequest.assignedStaffId,
              title: 'New Message from Customer',
              message: content.substring(0, 100),
              type: 'message',
              actionUrl: `/repair-requests/${repairRequestId}`,
              metadata: { repairRequestId, messageType: 'text' }
            }).catch(err => console.error('Error creating notification:', err));
          }
        }
      } catch (notificationError) {
        console.error(`RepairRequestCommunicationService: Error creating notification: ${notificationError.message}`, notificationError);
      }

      return communication;
    } catch (error) {
      console.error(`RepairRequestCommunicationService: Error sending message: ${error.message}`, error);
      throw error;
    }
  }

  // Send a feedback request
  static async sendFeedbackRequest(repairRequestId, senderId, senderName, question, options, senderRole = null) {
    try {
      console.log(`RepairRequestCommunicationService: Sending feedback request to repair request ${repairRequestId}`);

      let communication = await RepairRequestCommunication.findOne({ repairRequestId });

      if (!communication) {
        communication = await this.getOrCreateCommunicationThread(repairRequestId);
      }

      const expirationTime = new Date();
      expirationTime.setHours(expirationTime.getHours() + 48); // 48 hour expiration

      const message = {
        senderId: {
          name: senderName,
          email: '',
          avatar: null,
        },
        senderType: 'staff',
        senderName,
        senderRole,
        messageType: 'feedback_request',
        content: question,
        feedbackRequest: {
          question,
          options,
          status: 'pending',
          expiresAt: expirationTime,
        },
        readBy: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      communication.messages.push(message);
      communication.lastMessageAt = new Date();
      communication.pendingFeedbackCount = (communication.pendingFeedbackCount || 0) + 1;
      await communication.save();

      // Refetch to ensure all messages are properly structured
      communication = await RepairRequestCommunication.findOne({ repairRequestId });

      if (communication && communication.messages && communication.messages.length > 0) {
        communication.messages.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
      }

      console.log(`RepairRequestCommunicationService: Feedback request sent successfully`);

      // Create notification for customer
      try {
        const repairRequest = await RepairRequest.findById(repairRequestId);
        if (repairRequest && repairRequest.customerId) {
          const lastMessage = communication && communication.messages && communication.messages.length > 0
            ? communication.messages[communication.messages.length - 1]
            : null;

          await NotificationService.createNotification({
            userId: repairRequest.customerId,
            title: 'Feedback Requested on Your Repair Request',
            message: question,
            type: 'message',
            actionUrl: `/my-repair-requests`,
            metadata: { repairRequestId, messageId: lastMessage?._id, messageType: 'feedback_request' }
          }).catch(err => console.error('Error creating notification:', err));
        }
      } catch (notificationError) {
        console.error(`RepairRequestCommunicationService: Error creating notification: ${notificationError.message}`, notificationError);
      }

      return communication;
    } catch (error) {
      console.error(`RepairRequestCommunicationService: Error sending feedback request: ${error.message}`, error);
      throw error;
    }
  }

  // Respond to a feedback request
  static async respondToFeedback(repairRequestId, messageId, response, responderId, responderName) {
    try {
      console.log(`RepairRequestCommunicationService: Recording feedback response for repair request ${repairRequestId}`);

      const communication = await RepairRequestCommunication.findOne({ repairRequestId });

      if (!communication) {
        throw new Error('Communication thread not found');
      }

      const message = communication.messages.id(messageId);

      if (!message) {
        throw new Error('Message not found');
      }

      if (message.messageType !== 'feedback_request') {
        throw new Error('Message is not a feedback request');
      }

      if (!message.feedbackRequest) {
        throw new Error('Feedback request data not found');
      }

      // Update the feedback response
      message.feedbackRequest.response = response;
      message.feedbackRequest.status = 'responded';
      message.feedbackRequest.respondedBy = responderName;
      message.feedbackRequest.respondedAt = new Date();

      // Decrease pending feedback count
      communication.pendingFeedbackCount = Math.max(0, (communication.pendingFeedbackCount || 1) - 1);
      communication.lastMessageAt = new Date();

      await communication.save();

      // Refetch to ensure all messages are properly structured
      const updatedCommunication = await RepairRequestCommunication.findOne({ repairRequestId });

      if (updatedCommunication && updatedCommunication.messages && updatedCommunication.messages.length > 0) {
        updatedCommunication.messages.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
      }

      console.log(`RepairRequestCommunicationService: Feedback response recorded successfully`);

      // Create notification for staff
      try {
        const repairRequest = await RepairRequest.findById(repairRequestId);
        if (repairRequest && repairRequest.assignedStaffId) {
          await NotificationService.createNotification({
            userId: repairRequest.assignedStaffId,
            title: 'Customer Responded to Feedback',
            message: `Response: ${response.label}`,
            type: 'message',
            actionUrl: `/repair-requests/${repairRequestId}`,
            metadata: { repairRequestId, messageId, messageType: 'feedback_response' }
          }).catch(err => console.error('Error creating notification:', err));
        }
      } catch (notificationError) {
        console.error(`RepairRequestCommunicationService: Error creating notification: ${notificationError.message}`, notificationError);
      }

      return updatedCommunication;
    } catch (error) {
      console.error(`RepairRequestCommunicationService: Error responding to feedback: ${error.message}`, error);
      throw error;
    }
  }

  // Create a quick action
  static async createQuickAction(repairRequestId, senderId, senderName, actionType, description = '', metadata = {}, senderRole = null) {
    try {
      console.log(`RepairRequestCommunicationService: Creating quick action ${actionType} for repair request ${repairRequestId}`);

      let communication = await RepairRequestCommunication.findOne({ repairRequestId });

      if (!communication) {
        communication = await this.getOrCreateCommunicationThread(repairRequestId);
      }

      // Map action type to label
      const actionLabels = {
        'parts_needed': 'Parts Needed',
        'approval_required': 'Customer Approval Required',
        'additional_cost': 'Additional Cost Estimate',
        'status_update': 'Repair Status Update',
        'schedule_appointment': 'Schedule Appointment',
      };

      const message = {
        senderId: {
          name: senderName,
          email: '',
          avatar: null,
        },
        senderType: 'staff',
        senderName,
        senderRole,
        messageType: 'quick_action',
        content: description,
        quickAction: {
          actionType,
          actionLabel: actionLabels[actionType] || actionType,
          description,
          status: 'pending',
          metadata,
        },
        readBy: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      communication.messages.push(message);
      communication.lastMessageAt = new Date();
      communication.pendingActionsCount = (communication.pendingActionsCount || 0) + 1;
      await communication.save();

      // Refetch to ensure all messages are properly structured
      const updatedCommunication = await RepairRequestCommunication.findOne({ repairRequestId });

      if (updatedCommunication && updatedCommunication.messages && updatedCommunication.messages.length > 0) {
        updatedCommunication.messages.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
      }

      console.log(`RepairRequestCommunicationService: Quick action created successfully`);

      // Create notification for customer
      try {
        const repairRequest = await RepairRequest.findById(repairRequestId);
        if (repairRequest && repairRequest.customerId) {
          const lastMessage = updatedCommunication && updatedCommunication.messages && updatedCommunication.messages.length > 0
            ? updatedCommunication.messages[updatedCommunication.messages.length - 1]
            : null;

          await NotificationService.createNotification({
            userId: repairRequest.customerId,
            title: actionLabels[actionType] || actionType,
            message: description || 'An action has been requested on your repair request',
            type: 'message',
            actionUrl: `/my-repair-requests`,
            metadata: { repairRequestId, messageId: lastMessage?._id, messageType: 'quick_action', actionType }
          }).catch(err => console.error('Error creating notification:', err));
        }
      } catch (notificationError) {
        console.error(`RepairRequestCommunicationService: Error creating notification: ${notificationError.message}`, notificationError);
      }

      return updatedCommunication;
    } catch (error) {
      console.error(`RepairRequestCommunicationService: Error creating quick action: ${error.message}`, error);
      throw error;
    }
  }

  // Complete a quick action
  static async completeQuickAction(repairRequestId, messageId) {
    try {
      console.log(`RepairRequestCommunicationService: Completing quick action for repair request ${repairRequestId}`);

      const communication = await RepairRequestCommunication.findOne({ repairRequestId });

      if (!communication) {
        throw new Error('Communication thread not found');
      }

      const message = communication.messages.id(messageId);

      if (!message) {
        throw new Error('Message not found');
      }

      if (message.messageType !== 'quick_action') {
        throw new Error('Message is not a quick action');
      }

      if (!message.quickAction) {
        throw new Error('Quick action data not found');
      }

      // Update the quick action status
      message.quickAction.status = 'completed';
      message.quickAction.completedAt = new Date();

      // Decrease pending actions count
      communication.pendingActionsCount = Math.max(0, (communication.pendingActionsCount || 1) - 1);
      communication.lastMessageAt = new Date();

      await communication.save();

      // Refetch to ensure all messages are properly structured
      const updatedCommunication = await RepairRequestCommunication.findOne({ repairRequestId });

      if (updatedCommunication && updatedCommunication.messages && updatedCommunication.messages.length > 0) {
        updatedCommunication.messages.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
      }

      console.log(`RepairRequestCommunicationService: Quick action completed successfully`);
      return updatedCommunication;
    } catch (error) {
      console.error(`RepairRequestCommunicationService: Error completing quick action: ${error.message}`, error);
      throw error;
    }
  }

  // Mark messages as read
  static async markMessagesAsRead(repairRequestId, userId) {
    try {
      console.log(`RepairRequestCommunicationService: Marking messages as read for repair request ${repairRequestId}`);

      const communication = await RepairRequestCommunication.findOne({ repairRequestId });

      if (!communication) {
        throw new Error('Communication thread not found');
      }

      // Mark unread messages from other senders as read
      const now = new Date();
      let updatedCount = 0;

      for (const message of communication.messages) {
        const isAlreadyRead = message.readBy && message.readBy.some(r => r.userId.toString() === userId.toString());
        if (!isAlreadyRead) {
          if (!message.readBy) {
            message.readBy = [];
          }
          message.readBy.push({
            userId,
            readAt: now,
          });
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        await communication.save();
      }

      console.log(`RepairRequestCommunicationService: Marked ${updatedCount} messages as read`);
      return communication;
    } catch (error) {
      console.error(`RepairRequestCommunicationService: Error marking messages as read: ${error.message}`, error);
      throw error;
    }
  }

  // Get pending feedback count
  static async getPendingFeedbackCount(repairRequestId) {
    try {
      console.log(`RepairRequestCommunicationService: Getting pending feedback count for repair request ${repairRequestId}`);

      const communication = await RepairRequestCommunication.findOne({ repairRequestId });

      if (!communication) {
        return 0;
      }

      return communication.pendingFeedbackCount || 0;
    } catch (error) {
      console.error(`RepairRequestCommunicationService: Error getting pending feedback count: ${error.message}`, error);
      throw error;
    }
  }

  // Get pending actions count
  static async getPendingActionsCount(repairRequestId) {
    try {
      console.log(`RepairRequestCommunicationService: Getting pending actions count for repair request ${repairRequestId}`);

      const communication = await RepairRequestCommunication.findOne({ repairRequestId });

      if (!communication) {
        return 0;
      }

      return communication.pendingActionsCount || 0;
    } catch (error) {
      console.error(`RepairRequestCommunicationService: Error getting pending actions count: ${error.message}`, error);
      throw error;
    }
  }
}

module.exports = RepairRequestCommunicationService;
