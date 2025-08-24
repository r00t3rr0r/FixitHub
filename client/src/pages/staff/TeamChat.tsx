import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/useToast"
import {
  MessageSquare,
  Send,
  Users,
  Phone,
  Video,
  Paperclip,
  Smile,
  Search
} from "lucide-react"

interface TeamMember {
  _id: string
  name: string
  avatar: string
  role: string
  isOnline: boolean
  lastSeen: string
}

interface ChatMessage {
  _id: string
  senderId: string
  senderName: string
  senderAvatar: string
  content: string
  timestamp: string
  type: 'text' | 'image' | 'file'
}

export function TeamChat() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const fetchTeamData = async () => {
      try {
        // Mock team members data
        const mockTeamMembers: TeamMember[] = [
          {
            _id: 'staff1',
            name: 'Sarah Johnson',
            avatar: 'https://via.placeholder.com/40x40/10b981/ffffff?text=SJ',
            role: 'Senior Technician',
            isOnline: true,
            lastSeen: new Date().toISOString()
          },
          {
            _id: 'staff2',
            name: 'Mike Chen',
            avatar: 'https://via.placeholder.com/40x40/3b82f6/ffffff?text=MC',
            role: 'Supervisor',
            isOnline: true,
            lastSeen: new Date().toISOString()
          },
          {
            _id: 'staff3',
            name: 'Emily Rodriguez',
            avatar: 'https://via.placeholder.com/40x40/8b5cf6/ffffff?text=ER',
            role: 'Technician',
            isOnline: false,
            lastSeen: '2024-01-15T14:30:00Z'
          }
        ]

        // Mock messages data
        const mockMessages: ChatMessage[] = [
          {
            _id: 'msg1',
            senderId: 'staff2',
            senderName: 'Mike Chen',
            senderAvatar: 'https://via.placeholder.com/40x40/3b82f6/ffffff?text=MC',
            content: 'Good morning team! We have several urgent orders today. Let\'s prioritize the iPhone 15 repairs.',
            timestamp: '2024-01-15T09:00:00Z',
            type: 'text'
          },
          {
            _id: 'msg2',
            senderId: 'staff1',
            senderName: 'Sarah Johnson',
            senderAvatar: 'https://via.placeholder.com/40x40/10b981/ffffff?text=SJ',
            content: 'I\'m working on ORD-2024-001 right now. Should be done by noon.',
            timestamp: '2024-01-15T09:15:00Z',
            type: 'text'
          },
          {
            _id: 'msg3',
            senderId: 'staff3',
            senderName: 'Emily Rodriguez',
            senderAvatar: 'https://via.placeholder.com/40x40/8b5cf6/ffffff?text=ER',
            content: 'I can help with the Samsung repairs after I finish the current Pixel repair.',
            timestamp: '2024-01-15T09:30:00Z',
            type: 'text'
          }
        ]

        setTeamMembers(mockTeamMembers)
        setMessages(mockMessages)
      } catch (error) {
        console.error("Error fetching team data:", error)
        toast({
          title: "Error",
          description: "Failed to load team chat",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchTeamData()
  }, [toast])

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return

    try {
      setSending(true)
      
      const message: ChatMessage = {
        _id: 'msg_' + Date.now(),
        senderId: 'current_user',
        senderName: 'Current User',
        senderAvatar: 'https://via.placeholder.com/40x40/6b7280/ffffff?text=CU',
        content: newMessage,
        timestamp: new Date().toISOString(),
        type: 'text'
      }

      setMessages(prev => [...prev, message])
      setNewMessage("")

      toast({
        title: "Message sent",
        description: "Your message has been sent to the team"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      })
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="h-8 w-8" />
          Team Chat
        </h1>
        <p className="text-muted-foreground">
          Collaborate with your team members in real-time
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Team Members Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members
            </CardTitle>
            <CardDescription>
              {teamMembers.filter(m => m.isOnline).length} online
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {teamMembers.map((member) => (
                <div key={member._id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                  <div className="relative">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={member.avatar} />
                      <AvatarFallback>
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-background ${
                      member.isOnline ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.role}</p>
                    {!member.isOnline && (
                      <p className="text-xs text-muted-foreground">
                        Last seen: {new Date(member.lastSeen).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Team Chat</CardTitle>
              <CardDescription>General team discussion</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm">
                <Phone className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Video className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Messages Area */}
            <ScrollArea className="h-96 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message._id} className="flex items-start gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={message.senderAvatar} />
                      <AvatarFallback className="text-xs">
                        {message.senderName.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{message.senderName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3 max-w-md">
                        <p className="text-sm">{message.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Smile className="h-4 w-4" />
                </Button>
                <Input
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}