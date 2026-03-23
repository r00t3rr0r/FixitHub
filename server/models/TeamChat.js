const mongoose = require('mongoose');

const teamChatMessageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeamChatRoom',
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  senderAvatar: {
    type: String,
    default: ''
  },
  content: {
    type: String,
    required: true
  },
  messageType: {
    type: String,
    enum: ['text', 'file', 'image', 'announcement'],
    default: 'text'
  },
  attachments: [{
    name: String,
    url: String,
    type: String,
    size: Number
  }],
  isRead: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  versionKey: false
});

const teamChatRoomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['general', 'team', 'project', 'announcement', 'private'],
    default: 'general'
  },
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['member', 'moderator', 'admin'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  versionKey: false
});

// Update timestamp on save
teamChatRoomSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Indexes
teamChatMessageSchema.index({ roomId: 1, createdAt: 1 });
teamChatMessageSchema.index({ senderId: 1 });
teamChatRoomSchema.index({ 'members.userId': 1, isActive: 1, updatedAt: -1 });

const TeamChatMessage = mongoose.model('TeamChatMessage', teamChatMessageSchema);
const TeamChatRoom = mongoose.model('TeamChatRoom', teamChatRoomSchema);

module.exports = {
  TeamChatMessage,
  TeamChatRoom
};