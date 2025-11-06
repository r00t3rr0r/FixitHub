import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import { useAuth } from "@/contexts/AuthContext"
import {
  getCommunicationThread,
  respondToFeedback,
  markMessagesAsRead,
} from "@/api/inspectionCommunication"
import { CheckCircle2, MessageCircle, AlertCircle } from "lucide-react"

interface CommunicationPanelProps {
  orderId: string
  inspectionId?: string
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
}: CommunicationPanelProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [communication, setCommunication] = useState<Communication | null>(null)
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState(false)

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
      } finally {
        setLoading(false)
      }
    }

    loadCommunication()
  }, [orderId])

  // Mark messages as read
  useEffect(() => {
    if (communication?.messages && communication.messages.length > 0) {
      markMessagesAsRead(orderId).catch((error) =>
        console.error("Error marking messages as read:", error)
      )
    }
  }, [communication?.messages, orderId])

  const handleFeedbackResponse = async (messageId: string, response: { label: string; value: string }) => {
    try {
      setResponding(true)
      const updated = await respondToFeedback(orderId, messageId, response)
      setCommunication(updated)
      toast({
        title: "Success",
        description: "Your response has been recorded",
      })
    } catch (error: any) {
      console.error("Error responding to feedback:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to submit response",
        variant: "destructive",
      })
    } finally {
      setResponding(false)
    }
  }

  if (loading) {
    return null // Don't show while loading
  }

  // Filter only feedback_request and quick_action messages
  const communicationMessages = communication?.messages.filter((msg) =>
    ["feedback_request", "quick_action"].includes(msg.messageType)
  ) || []

  // Don't show panel if no communication messages
  if (communicationMessages.length === 0) {
    return null
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-semibold">Communication & Feedback</h3>
      </div>

      {communicationMessages.map((message) => (
        <div key={message._id} className="space-y-2">
          {/* Feedback Requests */}
          {message.messageType === "feedback_request" && message.feedbackRequest && (
            <div className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950 p-4 rounded">
              <p className="font-medium text-sm mb-3 text-amber-900 dark:text-amber-100">
                {message.feedbackRequest.question}
              </p>
              {message.feedbackRequest.status === "pending" ? (
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
                      disabled={responding}
                      className="w-full justify-start text-left h-auto py-2"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm">
                    You responded: <span className="font-medium">{message.feedbackRequest.response?.label}</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Quick Actions */}
          {message.messageType === "quick_action" && message.quickAction && (
            <div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950 p-4 rounded">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-medium text-sm text-blue-900 dark:text-blue-100">
                    {message.quickAction.actionLabel}
                  </p>
                  {message.quickAction.description && (
                    <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                      {message.quickAction.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    From: <span className="font-medium">{message.senderName}</span>
                  </p>
                </div>
                {message.quickAction.status === "completed" && (
                  <Badge variant="default" className="gap-1 flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    Completed
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
