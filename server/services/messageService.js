const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Order = require('../models/Order');
const User = require('../models/User');

class MessageService {
  // Get all conversations for a user
  static async getConversations(userId, filters = {}) {
    console.log('MessageService: Getting conversations for user:', userId);

    try {
      const query = {
        'participants.userId': userId
      };

      // Apply search filter
      if (filters.search) {
        query.$or = [
          { orderNumber: { $regex: filters.search, $options: 'i' } },
          { deviceInfo: { $regex: filters.search, $options: 'i' } }
        ];
      }

      // Pagination
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 20;
      const skip = (page - 1) * limit;

      const conversations = await Conversation.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalConversations = await Conversation.countDocuments(query);
      const totalPages = Math.ceil(totalConversations / limit);

      // Get unread count for each conversation
      const conversationsWithUnread = await Promise.all(
        conversations.map(async (conv) => {
          const unreadCount = await Message.countDocuments({
            conversationId: conv._id,
            senderId: { $ne: userId },
            isRead: false
          });

          // Get last message
          const lastMessage = await Message.findOne({
            conversationId: conv._id
          }).sort({ createdAt: -1 });

          return {
            _id: conv._id,
            orderId: conv.orderId._id,
            orderNumber: conv.orderNumber,
            deviceInfo: conv.deviceInfo,
            participants: conv.participants,
            lastMessage: lastMessage || null,
            unreadCount,
            status: conv.status,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt
          };
        })
      );

      // Calculate total unread count
      const totalUnreadCount = conversationsWithUnread.reduce(
        (sum, conv) => sum + conv.unreadCount, 0
      );

      console.log('MessageService: Found', conversations.length, 'conversations');

      return {
        conversations: conversationsWithUnread,
        totalPages,
        currentPage: page,
        unreadCount: totalUnreadCount
      };
    } catch (error) {
      console.error('MessageService: Error getting conversations:', error);
      throw error;
    }
  }

  // Get messages for a conversation
  static async getConversationMessages(conversationId, userId, filters = {}) {
    console.log('MessageService: Getting messages for conversation:', conversationId);

    try {
      // Verify user has access to this conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        'participants.userId': userId
      });

      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      // Pagination
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 50;
      const skip = (page - 1) * limit;

      const messages = await Message.find({ conversationId })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit);

      const totalMessages = await Message.countDocuments({ conversationId });
      const hasMore = skip + messages.length < totalMessages;

      console.log('MessageService: Found', messages.length, 'messages');

      // Map messages to match frontend interface
      const formattedMessages = messages.map(message => ({
        _id: message._id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        senderName: message.senderName,
        senderRole: message.senderRole,
        senderAvatar: message.senderAvatar,
        content: message.content,
        attachments: message.attachments,
        timestamp: message.createdAt, // Map createdAt to timestamp for frontend consistency
        isRead: message.isRead,
        messageType: message.messageType
      }));

      return {
        conversation: {
          _id: conversation._id,
          orderId: conversation.orderId._id,
          orderNumber: conversation.orderNumber,
          deviceInfo: conversation.deviceInfo,
          participants: conversation.participants,
          status: conversation.status,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt
        },
        messages: formattedMessages,
        hasMore,
        totalCount: totalMessages
      };
    } catch (error) {
      console.error('MessageService: Error getting conversation messages:', error);
      throw error;
    }
  }

  // Send a message
  static async sendMessage(conversationId, senderId, content, attachments = []) {
    console.log('MessageService: Sending message to conversation:', conversationId);

    try {
      // Verify conversation exists and user has access
      const conversation = await Conversation.findOne({
        _id: conversationId,
        'participants.userId': senderId
      });

      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      // Get sender details
      const sender = await User.findById(senderId);
      if (!sender) {
        throw new Error('Sender not found');
      }

      // Determine message type
      let messageType = 'text';
      if (attachments.length > 0) {
        messageType = attachments.some(att => att.type === 'image') ? 'image' : 'file';
      }

      // Create message
      // Messages sent by the user are automatically marked as read (they wrote it)
      const message = new Message({
        conversationId,
        senderId,
        senderName: sender.name,
        senderRole: sender.role,
        senderAvatar: sender.avatar || '',
        content,
        attachments,
        messageType,
        isRead: true // User's own messages are marked as read immediately
      });

      const savedMessage = await message.save();

      // Update conversation's last message and timestamp
      conversation.lastMessageId = savedMessage._id;
      conversation.updatedAt = new Date();
      await conversation.save();

      console.log('MessageService: Message sent successfully - Message marked as read for sender (isRead: true)');

      return {
        _id: savedMessage._id,
        conversationId: savedMessage.conversationId,
        senderId: savedMessage.senderId,
        senderName: savedMessage.senderName,
        senderRole: savedMessage.senderRole,
        senderAvatar: savedMessage.senderAvatar,
        content: savedMessage.content,
        attachments: savedMessage.attachments,
        timestamp: savedMessage.createdAt,
        isRead: savedMessage.isRead,
        messageType: savedMessage.messageType
      };
    } catch (error) {
      console.error('MessageService: Error sending message:', error);
      throw error;
    }
  }

  // Mark messages as read
  static async markMessagesAsRead(conversationId, userId, messageIds = null) {
    console.log('MessageService: Marking messages as read for conversation:', conversationId);

    try {
      // Verify user has access to conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        'participants.userId': userId
      });

      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      const query = {
        conversationId,
        senderId: { $ne: userId }, // Only mark messages from other users as read
        isRead: false
      };

      if (messageIds && messageIds.length > 0) {
        query._id = { $in: messageIds };
      }

      const result = await Message.updateMany(query, { isRead: true });

      console.log('MessageService: Marked', result.modifiedCount, 'messages as read');

      return {
        success: true,
        message: `Marked ${result.modifiedCount} messages as read`
      };
    } catch (error) {
      console.error('MessageService: Error marking messages as read:', error);
      throw error;
    }
  }

  // Start a new conversation for an order
  static async startConversation(orderId, customerId, initialMessage) {
    console.log('MessageService: Starting conversation for order:', orderId);

    try {
      // Get order details
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Check if conversation already exists
      const existingConversation = await Conversation.findOne({ orderId });
      if (existingConversation) {
        throw new Error('Conversation already exists for this order');
      }

      // Get customer details
      const customer = await User.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Create device info string
      const deviceInfo = `${order.deviceBrand} ${order.deviceModel} - ${order.services.join(', ')}`;

      // Create conversation
      const conversation = new Conversation({
        orderId,
        orderNumber: order.orderNumber,
        deviceInfo,
        participants: [{
          userId: customerId,
          name: customer.name,
          role: customer.role,
          avatar: customer.avatar || '',
          isOnline: true,
          lastSeen: new Date()
        }],
        status: 'active'
      });

      const savedConversation = await conversation.save();

      // Send initial message if provided
      if (initialMessage) {
        await this.sendMessage(savedConversation._id, customerId, initialMessage);
      }

      console.log('MessageService: Conversation started successfully');

      return {
        success: true,
        conversation: {
          _id: savedConversation._id,
          orderId: savedConversation.orderId,
          orderNumber: savedConversation.orderNumber,
          deviceInfo: savedConversation.deviceInfo,
          participants: savedConversation.participants,
          status: savedConversation.status,
          createdAt: savedConversation.createdAt,
          updatedAt: savedConversation.updatedAt
        }
      };
    } catch (error) {
      console.error('MessageService: Error starting conversation:', error);
      throw error;
    }
  }
}

module.exports = MessageService;