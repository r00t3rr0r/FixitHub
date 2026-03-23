import api from './api'

export interface TeamChatRoomSummary {
  _id: string
  name: string
  description?: string
  type?: string
  unreadCount: number
  members?: { userId: { _id: string; name: string; role: string }; role: string }[]
  lastMessage?: {
    content?: string
    senderName?: string
    createdAt?: string
  }
}

export interface TeamChatMessageData {
  _id: string
  roomId?: string
  senderId?: { _id: string; name: string; role: string; avatar?: string } | string
  senderName: string
  senderAvatar?: string
  content: string
  messageType: 'text' | 'file' | 'image' | 'announcement'
  attachments?: { name: string; url: string; type: string; size: number }[]
  createdAt: string
}

export interface StaffMember {
  _id: string
  name?: string
  firstName?: string
  lastName?: string
  role: string
  avatar?: string
}

// GET /api/team-chat/rooms
export const getTeamChatRooms = async (): Promise<{ rooms: TeamChatRoomSummary[] }> => {
  try {
    const response = await api.get('/api/team-chat/rooms')
    return { rooms: Array.isArray(response.data?.rooms) ? response.data.rooms : [] }
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message)
  }
}

// GET /api/team-chat/rooms/:roomId/messages
export const getRoomMessages = async (
  roomId: string,
  page = 1,
  limit = 50
): Promise<{ messages: TeamChatMessageData[]; hasMore: boolean; totalCount: number }> => {
  try {
    const response = await api.get(`/api/team-chat/rooms/${roomId}/messages`, {
      params: { page, limit },
    })
    return {
      messages: Array.isArray(response.data?.messages) ? response.data.messages : [],
      hasMore: response.data?.hasMore ?? false,
      totalCount: response.data?.totalCount ?? 0,
    }
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message)
  }
}

// POST /api/team-chat/rooms/:roomId/messages
export const sendChatMessage = async (
  roomId: string,
  content: string
): Promise<{ message: TeamChatMessageData }> => {
  try {
    const response = await api.post(`/api/team-chat/rooms/${roomId}/messages`, { content })
    return { message: response.data.message }
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message)
  }
}

// POST /api/team-chat/rooms
export const createChatRoom = async (data: {
  name: string
  description?: string
  type: string
  members?: { userId: string }[]
}): Promise<{ room: TeamChatRoomSummary }> => {
  try {
    const response = await api.post('/api/team-chat/rooms', data)
    return { room: response.data.room }
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message)
  }
}

// PUT /api/team-chat/rooms/:roomId/read
export const markRoomAsRead = async (roomId: string): Promise<void> => {
  try {
    await api.put(`/api/team-chat/rooms/${roomId}/read`)
  } catch {
    // non-critical, ignore
  }
}

// GET /api/team-chat/staff-members
export const getChatStaffMembers = async (): Promise<{ members: StaffMember[] }> => {
  try {
    const response = await api.get('/api/team-chat/staff-members')
    return { members: Array.isArray(response.data?.members) ? response.data.members : [] }
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message)
  }
}