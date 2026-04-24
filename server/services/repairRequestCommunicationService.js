const RepairRequestCommunication = require('../models/RepairRequestCommunication');
const RepairRequest = require('../models/RepairRequest');
const NotificationService = require('./notificationService');

class RepairRequestCommunicationService {
  // Get communication threads visible to the current user
  static async getCommunicationsForUser(userId, userRole = 'customer', filters = {}) {
    try {
      const page = parseInt(filters.page, 10) || 1;
      const limit = parseInt(filters.limit, 10) || 20;
      const skip = (page - 1) * limit;
      const search = (filters.search || '').trim();

      const communicationQuery = {};

      // Customers can only see communication threads for their own repair requests.
      if (userRole !== 'staff' && userRole !== 'admin') {
        const customerRequests = await RepairRequest.find({ customerId: userId }).select('_id').lean();
        const customerRequestIds = customerRequests.map((request) => request._id);

        if (customerRequestIds.length === 0) {
          return {
            communications: [],
            totalPages: 0,
            currentPage: page,
            totalCount: 0,
          };
        }

        communicationQuery.repairRequestId = { $in: customerRequestIds };
      }

      if (search) {
        const searchRegex = new RegExp(search, 'i');
        const matchingRequestsQuery = {
          $or: [
            { requestNumber: { $regex: searchRegex } },
            { deviceBrand: { $regex: searchRegex } },
            { deviceModel: { $regex: searchRegex } },
            { customerName: { $regex: searchRegex } },
            { customerEmail: { $regex: searchRegex } },
          ],
        };

        if (userRole !== 'staff' && userRole !== 'admin') {
          matchingRequestsQuery.customerId = userId;
        }

        const matchingRequests = await RepairRequest.find(matchingRequestsQuery).select('_id').lean();
        const matchingRequestIds = matchingRequests.map((request) => request._id);

        communicationQuery.repairRequestId = { $in: matchingRequestIds };
      }

      let communications = await RepairRequestCommunication.find(communicationQuery)
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .populate('createdBy.userId', 'name email avatar');

      // Filtere alle Kommunikations-Threads ohne Nachrichten heraus
      communications = communications.filter(comm => Array.isArray(comm.messages) && comm.messages.length > 0);

      const totalCount = communications.length;
      const paginatedCommunications = communications.slice(skip, skip + limit);

      const repairRequestIds = paginatedCommunications
        .map((comm) => comm.repairRequestId)
        .filter(Boolean);

      const repairRequests = await RepairRequest.find({ _id: { $in: repairRequestIds } })
        .select('_id requestNumber deviceBrand deviceModel customerId customerName customerEmail customerPhone')
        .populate('customerId', 'name email phone')
        .lean();

      const requestById = new Map(repairRequests.map((request) => [request._id.toString(), request]));

      const normalizedCommunications = paginatedCommunications.map((comm) => {
        const repairRequestId = comm.repairRequestId ? comm.repairRequestId.toString() : null;
        const repairRequest = repairRequestId ? requestById.get(repairRequestId) : null;

        return {
          _id: comm._id,
          repairRequestId,
          requestNumber: repairRequest?.requestNumber || '',
          deviceInfo: repairRequest ? `${repairRequest.deviceBrand} ${repairRequest.deviceModel}` : '',
          customer: repairRequest
            ? {
                name: repairRequest.customerId?.name || repairRequest.customerName || 'Kunde',
                email: repairRequest.customerId?.email || repairRequest.customerEmail || '',
                phone: repairRequest.customerId?.phone || repairRequest.customerPhone || '',
                isGuest: false,
              }
            : null,
          messages: comm.messages || [],
          status: comm.status,
          pendingFeedbackCount: comm.pendingFeedbackCount || 0,
          pendingActionsCount: comm.pendingActionsCount || 0,
          createdBy: comm.createdBy,
          lastMessageAt: comm.lastMessageAt || comm.updatedAt,
          createdAt: comm.createdAt,
          updatedAt: comm.updatedAt,
        };
      });

      return {
        communications: normalizedCommunications,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        totalCount,
      };
    } catch (error) {
      console.error(`RepairRequestCommunicationService: Error getting communications for user: ${error.message}`, error);
      throw error;
    }
  }

  // Get or create communication thread for a repair request
  static async getOrCreateCommunicationThread(repairRequestId, initiatingUserId = null, initiatingUserName = null, initiatingUserRole = null) {
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
          createdBy: initiatingUserId ? {
            userId: initiatingUserId,
            name: initiatingUserName,
            role: initiatingUserRole,
          } : undefined,
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
        // NICHT mehr automatisch anlegen!
        return null;
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
        communication = await this.getOrCreateCommunicationThread(repairRequestId, senderId, senderName, senderRole);
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
              title: 'Neue Nachricht zu Ihrer Reparaturanfrage',
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
        communication = await this.getOrCreateCommunicationThread(repairRequestId, senderId, senderName, senderRole);
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
            title: 'Rueckmeldung zu Ihrer Reparaturanfrage erforderlich',
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
        communication = await this.getOrCreateCommunicationThread(repairRequestId, senderId, senderName, senderRole);
      }

      // Map action type to label
      const actionLabels = {
        'parts_needed': 'Ersatzteile erforderlich',
        'approval_required': 'Kundenfreigabe erforderlich',
        'additional_cost': 'Zusatzkosten-Schaetzung',
        'status_update': 'Statusupdate zur Reparatur',
        'schedule_appointment': 'Terminvereinbarung erforderlich',
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
            message: description || 'Zu Ihrer Reparaturanfrage ist eine Aktion erforderlich.',
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

  // Get unread message count
  static async getUnreadMessageCount(repairRequestId, userId) {
    try {
      console.log(`RepairRequestCommunicationService: Getting unread message count for repair request ${repairRequestId} for user ${userId}`);

      const communication = await RepairRequestCommunication.findOne({ repairRequestId });

      if (!communication || !communication.messages) {
        return 0;
      }

      // Count messages that haven't been read by this user
      let unreadCount = 0;
      for (const message of communication.messages) {
        // Check if user has read this message
        const isRead = message.readBy && message.readBy.some(r => r.userId.toString() === userId.toString());
        if (!isRead) {
          unreadCount++;
        }
      }

      console.log(`RepairRequestCommunicationService: Found ${unreadCount} unread messages`);
      return unreadCount;
    } catch (error) {
      console.error(`RepairRequestCommunicationService: Error getting unread message count: ${error.message}`, error);
      throw error;
    }
  }
}

module.exports = RepairRequestCommunicationService;
