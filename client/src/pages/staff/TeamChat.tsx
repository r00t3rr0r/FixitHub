import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/useToast"
import {
  Send,
  Users,
  Plus,
  Search,
  Paperclip,
  Smile,
  MoreVertical,
  Hash,
  Lock,
  MessageSquare
} from "lucide-react"

interface TeamMember {
  _id: string
  name: string
  avatar: string
  role: string
  isOnline: boolean
}

interface ChatRoom {
  _id: string
  name: string
  description: string
  type: 'general' | 'team' | 'project' | 'announcement'
  members: TeamMember[]
  lastMessage?: {
    content: string
    senderName: string
    createdAt: string
  }
  unreadCount: number
}

interface Message {
  _id: string
  content: string
  senderName: string
  senderAvatar: string
  createdAt: string
  messageType: 'text' | 'file' | 'image'
  attachments?: any[]
}

export function TeamChat() {
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchChatRooms()
  }, [])

  const fetchChatRooms = async () => {
    try {
      setLoading(true)
      
      // Mock data for demonstration
      const mockRooms: ChatRoom[] = [
        {
          _id: "1",
          name: "General",
          description: "General team discussions",
          type: "general",
          members: [
            {
              _id: "1",
              name: "John Doe",
              avatar: "https://via.placeholder.com/40",
              role: "staff",
              isOnline: true
            },
            {
              _id: "2",
              name: "Jane Smith",
              avatar: "https://via.placeholder.com/40",
              role: "admin",
              isOnline: false
            }
          ],
          lastMessage: {
            content: "Good morning team!",
            senderName: "John Doe",
            createdAt: new Date().toISOString()
          },
          unreadCount: 2
        },
        {
          _id: "2",
          name: "Technical Support",
          description: "Technical discussions and support",
          type: "team",
          members: [
            {
              _id: "1",
              name: "John Doe",
              avatar: "https://via.placeholder.com/40",
              role: "staff",
              isOnline: true
            }
          ],
          unreadCount: 0
        }
      ]

      setRooms(mockRooms)
      if (mockRooms.length > 0) {
        setSelectedRoom(mockRooms[0])
        fetchMessages(mockRooms[0]._id)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load chat rooms",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (roomId: string) => {
    try {
      // Mock messages for demonstration
      const mockMessages: Message[] = [
        {
          _id: "1",
          content: "Good morning team!",
          senderName: "John Doe",
          senderAvatar: "https://via.placeholder.com/40",
          createdAt: new Date(Date.now() - 60000).toISOString(),
          messageType: "text"
        },
        {
          _id: "2",
          content: "Hello! Ready for today's repairs.",
          senderName: "Jane Smith",
          senderAvatar: "https://via.placeholder.com/40",
          createdAt: new Date().toISOString(),
          messageType: "text"
        }
      ]

      setMessages(mockMessages)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load messages",
        variant: "destructive"
      })
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedRoom) return

    try {
      // Mock sending message
      const newMsg: Message = {
        _id: Date.now().toString(),
        content: newMessage,
        senderName: "You",
        senderAvatar: "https://via.placeholder.com/40",
        createdAt: new Date().toISOString(),
        messageType: "text"
      }

      setMessages(prev => [...prev, newMsg])
      setNewMessage("")

      toast({
        title: "Success",
        description: "Message sent successfully"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive"
      })
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Team Chat</h1>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[600px]">
          <Card className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded"></div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-3 animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-96 bg-muted rounded"></div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team Chat</h1>
          <p className="text-muted-foreground">Communicate with your team members</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Room
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[600px]">
        {/* Chat Rooms Sidebar */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Chat Rooms
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search rooms..."
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[480px]">
              <div className="space-y-1 p-3">
                {rooms.map((room) => (
                  <div
                    key={room._id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedRoom?._id === room._id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent'
                    }`}
                    onClick={() => {
                      setSelectedRoom(room)
                      fetchMessages(room._id)
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {room.type === 'general' ? (
                          <Hash className="h-4 w-4" />
                        ) : room.type === 'announcement' ? (
                          <MessageSquare className="h-4 w-4" />
                        ) : (
                          <Lock className="h-4 w-4" />
                        )}
                        <span className="font-medium text-sm">{room.name}</span>
                      </div>
                      {room.unreadCount > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {room.unreadCount}
                        </Badge>
                      )}
                    </div>
                    {room.lastMessage && (
                      <p className="text-xs opacity-70 truncate">
                        {room.lastMessage.senderName}: {room.lastMessage.content}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Messages Area */}
        <Card className="lg:col-span-3 flex flex-col">
          {selectedRoom ? (
            <>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedRoom.name}</CardTitle>
                    <CardDescription>{selectedRoom.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {selectedRoom.members.length} members
                    </Badge>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <Separator />

              <CardContent className="flex-1 flex flex-col p-0">
                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div key={message._id} className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={message.senderAvatar} />
                          <AvatarFallback>
                            {message.senderName.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{message.senderName}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(message.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm">{message.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <Separator />

                {/* Message Input */}
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon">
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="flex-1"
                    />
                    <Button variant="ghost" size="icon">
                      <Smile className="h-4 w-4" />
                    </Button>
                    <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Select a chat room</h3>
                <p className="text-muted-foreground">Choose a room from the sidebar to start chatting</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}