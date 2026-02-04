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
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      communication.messages.push(message);
      communication.lastMessageAt = new Date();
      await communication.save();

      // Refetch to ensure all nested documents have proper IDs and timestamps
      communication = await InspectionCommunication.findOne({ orderId })
        .populate('messages.senderId', 'name email role avatar')
        .populate('messages.feedbackRequest.respondedBy', 'name email');

      if (communication && communication.messages && communication.messages.length > 0) {
        communication.messages.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
      }

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
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      communication.messages.push(message);
      communication.lastMessageAt = new Date();
      communication.pendingFeedbackCount = (communication.pendingFeedbackCount || 0) + 1;
      await communication.save();

      // Refetch to ensure all nested documents have proper IDs and timestamps
      communication = await InspectionCommunication.findOne({ orderId })
        .populate('messages.senderId', 'name email role avatar')
        .populate('messages.feedbackRequest.respondedBy', 'name email');

      if (communication && communication.messages && communication.messages.length > 0) {
        communication.messages.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
      }

      // Create notification for customer
      try {
        const order = await Order.findById(orderId);
        if (order && order.customerId) {
          // Get the last message to access the generated _id
          const lastMessage = communication && communication.messages && communication.messages.length > 0
            ? communication.messages[communication.messages.length - 1]
            : null;

          await NotificationService.createNotification({
            userId: order.customerId,
            title: 'Feedback Required on Your Repair Inspection',
            message: question,
            type: 'message',
            orderId,
            actionUrl: `/orders/${orderId}`,
            metadata: { messageId: lastMessage?._id, inspectionId, messageType: 'feedback_request' }
          });
        }
      } catch (notificationError) {
        console.error(`InspectionCommunicationService: Error creating notification for feedback request: ${notificationError.message || notificationError}`, notificationError.stack);
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

      let communication = await InspectionCommunication.findOne({ orderId });

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

      // Mark the message as read by the responder (the customer who responded already knows about this message)
      const hasResponderRead = message.readBy.some(read => read.userId.toString() === responderId.toString());
      if (!hasResponderRead) {
        message.readBy.push({
          userId: responderId,
          readAt: new Date(),
        });
        console.log(`InspectionCommunicationService: Marked feedback request message as read for responder ${respondedByName}`);
      }

      await communication.save();

      // Refetch to ensure all nested documents are properly populated
      communication = await InspectionCommunication.findOne({ orderId })
        .populate('messages.senderId', 'name email role avatar')
        .populate('messages.feedbackRequest.respondedBy', 'name email');

      if (communication && communication.messages && communication.messages.length > 0) {
        communication.messages.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
      }

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
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      communication.messages.push(message);
      communication.lastMessageAt = new Date();
      communication.pendingActionsCount = (communication.pendingActionsCount || 0) + 1;
      await communication.save();

      // Refetch to ensure all nested documents have proper IDs and timestamps
      communication = await InspectionCommunication.findOne({ orderId })
        .populate('messages.senderId', 'name email role avatar')
        .populate('messages.feedbackRequest.respondedBy', 'name email');

      if (communication && communication.messages && communication.messages.length > 0) {
        communication.messages.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
      }

      // Create notification for customer
      try {
        const order = await Order.findById(orderId);
        if (order && order.customerId) {
          // Get the last message to access the generated _id
          const lastMessage = communication && communication.messages && communication.messages.length > 0
            ? communication.messages[communication.messages.length - 1]
            : null;

          await NotificationService.createNotification({
            userId: order.customerId,
            title: `${actionLabels[actionType] || actionType}`,
            message: description || actionLabels[actionType] || actionType,
            type: 'message',
            orderId,
            actionUrl: `/orders/${orderId}`,
            metadata: { messageId: lastMessage?._id, actionType, inspectionId, messageType: 'quick_action' }
          });
        }
      } catch (notificationError) {
        console.error(`InspectionCommunicationService: Error creating notification for quick action: ${notificationError.message || notificationError}`, notificationError.stack);
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

      let communication = await InspectionCommunication.findOne({ orderId });

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

      // Refetch to ensure all nested documents are properly populated
      communication = await InspectionCommunication.findOne({ orderId })
        .populate('messages.senderId', 'name email role avatar')
        .populate('messages.feedbackRequest.respondedBy', 'name email');

      if (communication && communication.messages && communication.messages.length > 0) {
        communication.messages.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
      }

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
        .populate('messages.feedbackRequest.respondedBy', 'name email');

      if (!communication) {
        return await this.getOrCreateCommunicationThread(orderId);
      }

      // Sort messages by createdAt in ascending order (oldest to newest)
      if (communication.messages && communication.messages.length > 0) {
        communication.messages.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
        console.log(`InspectionCommunicationService: Sorted ${communication.messages.length} messages by createdAt`);
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

      let communication = await InspectionCommunication.findOne({ orderId });

      if (!communication) {
        throw new Error('Communication thread not found');
      }

      let markedCount = 0;
      communication.messages.forEach(message => {
        const hasUserRead = message.readBy.some(read => read.userId.toString() === userId.toString());
        if (!hasUserRead) {
          message.readBy.push({
            userId,
            readAt: new Date(),
          });
          markedCount++;
        }
      });

      await communication.save();

      console.log(`InspectionCommunicationService: ${markedCount} messages marked as read`);

      // Refetch to ensure all nested documents have proper IDs and timestamps, and populate sender info
      communication = await InspectionCommunication.findOne({ orderId })
        .populate('messages.senderId', 'name email role avatar')
        .populate('messages.feedbackRequest.respondedBy', 'name email');

      // Sort messages by createdAt
      if (communication && communication.messages && communication.messages.length > 0) {
        communication.messages.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
        console.log(`InspectionCommunicationService: Sorted ${communication.messages.length} messages by createdAt`);
      }

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

  // Get unread message counts for multiple orders
  static async getUnreadMessageCounts(orderIds, userId, userRole) {
    try {
      console.log(`InspectionCommunicationService: Getting unread counts for ${orderIds.length} orders for user ${userId}`);

      const communications = await InspectionCommunication.find({
        orderId: { $in: orderIds }
      }).populate('messages.feedbackRequest.respondedBy', '_id');

      const unreadCounts = {};

      communications.forEach(comm => {
        let unreadCount = 0;
        let lastUnreadSenderType = null;

        // Count messages that haven't been read by the current user
        comm.messages.forEach(message => {
          const hasUserRead = message.readBy.some(
            readEntry => readEntry.userId && readEntry.userId.toString() === userId.toString()
          );

          // Check if this is a feedback request message with a response (for admin/staff view)
          const isFeedbackRequestWithResponse =
            message.feedbackRequest &&
            message.feedbackRequest.status === 'responded' &&
            message.feedbackRequest.respondedBy &&
            message.feedbackRequest.respondedAt;

          // For admin/staff viewing feedback responses from customers
          if (userRole && (userRole === 'admin' || userRole === 'staff') && isFeedbackRequestWithResponse) {
            // Check if this feedback response has been "read" by the current admin/staff user
            // We consider a feedback response as read if the admin has viewed the message after the response was submitted
            const hasReadAfterResponse = message.readBy.some(
              readEntry => {
                if (!readEntry.userId || readEntry.userId.toString() !== userId.toString()) {
                  return false;
                }
                const readAt = new Date(readEntry.readAt);
                const respondedAt = new Date(message.feedbackRequest.respondedAt);
                return readAt >= respondedAt;
              }
            );

            if (!hasReadAfterResponse) {
              // Count this as ONE unread customer message (the response)
              unreadCount++;
              // Feedback responses should be marked as customer messages
              lastUnreadSenderType = 'customer';
              console.log(`InspectionCommunicationService: Found unread feedback response for order ${comm.orderId} - message ${message._id}`);
            }
            // Skip counting this message again as a regular unread message
            return;
          }

          // Count regular messages that haven't been read
          if (!hasUserRead) {
            // Only count messages not sent by the current user
            if (message.senderId && message.senderId.toString() !== userId.toString()) {
              unreadCount++;

              // Track the sender type of the most recent unread message
              if (!lastUnreadSenderType) {
                lastUnreadSenderType = message.senderType;
              }
            }
          }
        });

        if (unreadCount > 0) {
          unreadCounts[comm.orderId.toString()] = {
            unread: unreadCount,
            senderType: lastUnreadSenderType
          };
        }
      });

      console.log(`InspectionCommunicationService: Found unread messages in ${Object.keys(unreadCounts).length} orders`);
      return unreadCounts;
    } catch (error) {
      console.error(`InspectionCommunicationService: Error getting unread message counts: ${error}`);
      throw error;
    }
  }
}

module.exports = InspectionCommunicationService;
