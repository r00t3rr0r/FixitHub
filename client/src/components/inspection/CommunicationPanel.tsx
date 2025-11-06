import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import {
  getCommunicationThread,
  sendMessage,
  createQuickAction,
  respondToFeedback,
  markMessagesAsRead,
} from "@/api/inspectionCommunication"
import { QuickActionButtons } from "./QuickActionButtons"
import { FeedbackRequestDialog } from "./FeedbackRequestDialog"
import { Send, AlertCircle, CheckCircle2, MessageCircle } from "lucide-react"

interface CommunicationPanelProps {
  orderId: string
  inspectionId?: string
  staffOnly?: boolean
}

interface Message {
  _id: string
  senderId: {
    name: string
    email: string
    avatar?: string
  }
  senderName: string
  senderType: "staff" | "customer" | "system"
  messageType: "text" | "feedback_request" | "quick_action" | "system_notification"
  content: string
  feedbackRequest?: {
    question: string
    options: Array<{ label: string; value: string }>
    response?: { label: string; value: string }
    status: "pending" | "responded" | "expired"
  }
  quickAction?: {
    actionType: string
    actionLabel: string
    description: string
    status: "pending" | "completed" | "cancelled"
  }
  createdAt: string
  readBy: Array<{ userId: string; readAt: string }>
}

interface Communication {
  _id: string
  messages: Message[]
  pendingFeedbackCount: number
  pendingActionsCount: number
}

export function CommunicationPanel({
  orderId,
  inspectionId,
  staffOnly = false,
}: CommunicationPanelProps) {
  const { toast } = useToast()
  const [communication, setCommunication] = useState<Communication | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [newMessage, setNewMessage] = useState("")
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false)
  const [selectedActionType, setSelectedActionType] = useState("")

  // Load communication thread
  useEffect(() => {
    const loadCommunication = async () => {
      try {
        setLoading(true)
        const thread = await getCommunicationThread(orderId)
        setCommunication(thread)
        console.log("Communication thread loaded:", thread)
      } catch (error) {
        console.error("Error loading communication thread:", error)
        toast({
          title: "Error",
          description: "Failed to load communication thread",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadCommunication()
  }, [orderId, toast])

  // Mark messages as read
  useEffect(() => {
    if (communication?.messages && communication.messages.length > 0) {
      markMessagesAsRead(orderId).catch((error) =>
        console.error("Error marking messages as read:", error)
      )
    }
  }, [communication?.messages, orderId])

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return

    try {
      setSending(true)
      const updated = await sendMessage(orderId, newMessage.trim())
      setCommunication(updated)
      setNewMessage("")
      toast({
        title: "Success",
        description: "Message sent successfully",
      })
    } catch (error) {
      console.error("Error sending message:", error)
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const handleQuickAction = async (actionType: string) => {
    try {
      setSending(true)
      const updated = await createQuickAction(orderId, inspectionId || "", actionType)
      setCommunication(updated)
      toast({
        title: "Success",
        description: `${actionType.replace(/_/g, " ")} action created`,
      })
    } catch (error) {
      console.error("Error creating quick action:", error)
      toast({
        title: "Error",
        description: "Failed to create quick action",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const handleFeedbackResponse = async (messageId: string, response: { label: string; value: string }) => {
    try {
      setSending(true)
      const updated = await respondToFeedback(orderId, messageId, response)
      setCommunication(updated)
      toast({
        title: "Success",
        description: "Feedback response recorded",
      })
    } catch (error) {
      console.error("Error responding to feedback:", error)
      toast({
        title: "Error",
        description: "Failed to respond to feedback",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const openFeedbackDialog = (actionType: string) => {
    setSelectedActionType(actionType)
    setFeedbackDialogOpen(true)
  }

  const handleFeedbackDialogSubmit = async (message: string) => {
    await handleSendMessage()
    await handleQuickAction(selectedActionType)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Communication Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  const hasPendingFeedback = communication && communication.pendingFeedbackCount > 0
  const hasPendingActions = communication && communication.pendingActionsCount > 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            <CardTitle>Communication Panel</CardTitle>
          </div>
          <div className="flex gap-2">
            {hasPendingFeedback && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="w-3 h-3" />
                {communication.pendingFeedbackCount} Pending
              </Badge>
            )}
            {hasPendingActions && (
              <Badge variant="secondary" className="gap-1">
                <AlertCircle className="w-3 h-3" />
                {communication.pendingActionsCount} Actions
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          Direct communication with customer for inspection updates and feedback
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Messages Section */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto border rounded-lg p-4 bg-muted/30">
          {communication?.messages && communication.messages.length > 0 ? (
            communication.messages.map((message) => (
              <div key={message._id} className="space-y-2">
                {/* Text Messages */}
                {message.messageType === "text" && (
                  <div
                    className={`flex gap-3 ${
                      message.senderType === "customer" ? "justify-start" : "justify-end"
                    }`}
                  >
                    {message.senderType === "customer" && (
                      <Avatar className="w-8 h-8 mt-1">
                        <AvatarImage src={message.senderId?.avatar} />
                        <AvatarFallback>{message.senderName.charAt(0)}</AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.senderType === "customer"
                          ? "bg-background border"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      <p className="text-sm font-medium">{message.senderName}</p>
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-60 mt-1">
                        {new Date(message.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}

                {/* Feedback Requests */}
                {message.messageType === "feedback_request" && message.feedbackRequest && (
                  <div className="border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950 p-3 rounded">
                    <p className="font-medium text-sm mb-2">{message.feedbackRequest.question}</p>
                    {message.feedbackRequest.status === "pending" && (
                      <div className="space-y-2">
                        {message.feedbackRequest.options.map((option) => (
                          <Button
                            key={option.value}
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleFeedbackResponse(message._id, {
                                label: option.label,
                                value: option.value,
                              })
                            }
                            disabled={sending}
                            className="w-full justify-start"
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    )}
                    {message.feedbackRequest.status === "responded" && (
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm">
                          Responded: {message.feedbackRequest.response?.label}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Actions */}
                {message.messageType === "quick_action" && message.quickAction && (
                  <div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950 p-3 rounded">
                    <div className="flex items-center gap-2 justify-between">
                      <div>
                        <p className="font-medium text-sm">{message.quickAction.actionLabel}</p>
                        {message.quickAction.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {message.quickAction.description}
                          </p>
                        )}
                      </div>
                      {message.quickAction.status === "completed" && (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Completed
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No messages yet. Start communication with the customer.
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            disabled={sending}
          />
          <Button
            onClick={handleSendMessage}
            disabled={sending || !newMessage.trim()}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Quick Action Buttons */}
        {staffOnly && (
          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-semibold">Quick Actions</h3>
            <QuickActionButtons
              onPartReplacement={() => openFeedbackDialog("part_replacement")}
              onIncorrectDevice={() => openFeedbackDialog("incorrect_device")}
              onIncorrectUnlockCode={() => openFeedbackDialog("incorrect_unlock_code")}
              onAdditionalCosts={() => openFeedbackDialog("additional_costs")}
              isLoading={sending}
            />
          </div>
        )}

        {/* Feedback Dialog */}
        <FeedbackRequestDialog
          open={feedbackDialogOpen}
          onOpenChange={setFeedbackDialogOpen}
          actionType={selectedActionType}
          onSubmit={handleFeedbackDialogSubmit}
          isLoading={sending}
        />
      </CardContent>
    </Card>
  )
}
