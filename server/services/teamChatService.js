const { TeamChatMessage, TeamChatRoom } = require('../models/TeamChat');
const User = require('../models/User');

class TeamChatService {
  // Get all chat rooms for a user
  static async getChatRooms(userId) {
    console.log('TeamChatService: Getting chat rooms for user:', userId);

    try {
      const rooms = await TeamChatRoom.find({
        'members.userId': userId,
        isActive: true
      })
        .populate('createdBy', 'name avatar')
        .populate('members.userId', 'name avatar role')
        .sort({ updatedAt: -1 });

      // Get last message for each room
      const roomsWithLastMessage = await Promise.all(
        rooms.map(async (room) => {
          const lastMessage = await TeamChatMessage.findOne({
            roomId: room._id
          }).sort({ createdAt: -1 });

          const unreadCount = await TeamChatMessage.countDocuments({
            roomId: room._id,
            senderId: { $ne: userId },
            'isRead.userId': { $ne: userId }
          });

          return {
            ...room.toObject(),
            lastMessage,
            unreadCount
          };
        })
      );

      console.log('TeamChatService: Found', rooms.length, 'chat rooms');
      return roomsWithLastMessage;
    } catch (error) {
      console.error('TeamChatService: Error getting chat rooms:', error);
      throw error;
    }
  }

  // Get messages for a chat room
  static async getRoomMessages(roomId, userId, filters = {}) {
    console.log('TeamChatService: Getting messages for room:', roomId);

    try {
      // Verify user has access to room
      const room = await TeamChatRoom.findOne({
        _id: roomId,
        'members.userId': userId
      });

      if (!room) {
        throw new Error('Chat room not found or access denied');
      }

      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 50;
      const skip = (page - 1) * limit;

      const messages = await TeamChatMessage.find({ roomId })
        .populate('senderId', 'name avatar role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalMessages = await TeamChatMessage.countDocuments({ roomId });
      const hasMore = skip + messages.length < totalMessages;

      console.log('TeamChatService: Found', messages.length, 'messages');
      return {
        messages: messages.reverse(), // Reverse to show oldest first
        hasMore,
        totalCount: totalMessages
      };
    } catch (error) {
      console.error('TeamChatService: Error getting room messages:', error);
      throw error;
    }
  }

  // Send message to chat room
  static async sendMessage(roomId, senderId, content, attachments = []) {
    console.log('TeamChatService: Sending message to room:', roomId);

    try {
      // Verify user has access to room
      const room = await TeamChatRoom.findOne({
        _id: roomId,
        'members.userId': senderId
      });

      if (!room) {
        throw new Error('Chat room not found or access denied');
      }

      const sender = await User.findById(senderId);
      if (!sender) {
        throw new Error('Sender not found');
      }

      const message = new TeamChatMessage({
        roomId,
        senderId,
        senderName: sender.name,
        senderAvatar: sender.avatar || '',
        content,
        attachments,
        messageType: attachments.length > 0 ? 'file' : 'text'
      });

      const savedMessage = await message.save();

      // Update room's last activity
      room.updatedAt = new Date();
      await room.save();

      console.log('TeamChatService: Message sent successfully');
      return savedMessage;
    } catch (error) {
      console.error('TeamChatService: Error sending message:', error);
      throw error;
    }
  }

  // Create new chat room
  static async createChatRoom(roomData, creatorId) {
    console.log('TeamChatService: Creating new chat room:', roomData.name);

    try {
      const creator = await User.findById(creatorId);
      if (!creator || !['admin', 'staff'].includes(creator.role)) {
        throw new Error('Only admin and staff can create chat rooms');
      }

      // Add creator as admin member
      const members = roomData.members || [];
      members.push({
        userId: creatorId,
        role: 'admin'
      });

      const room = new TeamChatRoom({
        ...roomData,
        members,
        createdBy: creatorId
      });

      const savedRoom = await room.save();
      console.log('TeamChatService: Chat room created successfully');
      return savedRoom;
    } catch (error) {
      console.error('TeamChatService: Error creating chat room:', error);
      throw error;
    }
  }

  // Mark messages as read
  static async markMessagesAsRead(roomId, userId) {
    console.log('TeamChatService: Marking messages as read for room:', roomId);

    try {
      const result = await TeamChatMessage.updateMany(
        {
          roomId,
          senderId: { $ne: userId },
          'isRead.userId': { $ne: userId }
        },
        {
          $push: {
            isRead: {
              userId,
              readAt: new Date()
            }
          }
        }
      );

      console.log('TeamChatService: Marked', result.modifiedCount, 'messages as read');
      return { success: true, count: result.modifiedCount };
    } catch (error) {
      console.error('TeamChatService: Error marking messages as read:', error);
      throw error;
    }
  }
}

module.exports = TeamChatService;