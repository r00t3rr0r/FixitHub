import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import {
  getCommunicationThread,
  respondToFeedback,
  markMessagesAsRead,
  sendFeedbackRequest,
  createQuickAction,
} from "@/api/inspectionCommunication"
import { getUserProfile, UserProfile } from "@/api/user"
import { CheckCircle2, MessageCircle, AlertCircle, Plus, Send } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

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
  const [user, setUser] = useState<UserProfile | null>(null)
  const [communication, setCommunication] = useState<Communication | null>(null)
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState(false)
  const [sendingFeedback, setSendingFeedback] = useState(false)
  const [sendingQuickAction, setSendingQuickAction] = useState(false)
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false)
  const [showQuickActionDialog, setShowQuickActionDialog] = useState(false)
  const [feedbackQuestion, setFeedbackQuestion] = useState("")
  const [feedbackOption1Label, setFeedbackOption1Label] = useState("")
  const [feedbackOption1Value, setFeedbackOption1Value] = useState("")
  const [feedbackOption2Label, setFeedbackOption2Label] = useState("")
  const [feedbackOption2Value, setFeedbackOption2Value] = useState("")
  const [quickActionType, setQuickActionType] = useState<'part_replacement' | 'incorrect_device' | 'incorrect_unlock_code' | 'additional_costs'>('part_replacement')
  const [quickActionDescription, setQuickActionDescription] = useState("")

  // Load user profile
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const userResponse = await getUserProfile()
        setUser(userResponse.user || userResponse)
        console.log("User profile loaded:", userResponse)
      } catch (error) {
        console.error("Error loading user profile:", error)
      }
    }

    loadUserProfile()
  }, [])

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

  const handleSendFeedback = async () => {
    if (!feedbackQuestion.trim() || !feedbackOption1Label.trim() || !feedbackOption2Label.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      })
      return
    }

    try {
      setSendingFeedback(true)
      const options = [
        { label: feedbackOption1Label, value: feedbackOption1Value || feedbackOption1Label.toLowerCase() },
        { label: feedbackOption2Label, value: feedbackOption2Value || feedbackOption2Label.toLowerCase() },
      ]
      const updated = await sendFeedbackRequest(orderId, inspectionId || "", feedbackQuestion, options)
      setCommunication(updated)
      toast({
        title: "Success",
        description: "Feedback request sent to customer",
      })
      // Reset form
      setFeedbackQuestion("")
      setFeedbackOption1Label("")
      setFeedbackOption1Value("")
      setFeedbackOption2Label("")
      setFeedbackOption2Value("")
      setShowFeedbackDialog(false)
    } catch (error: any) {
      console.error("Error sending feedback:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to send feedback request",
        variant: "destructive",
      })
    } finally {
      setSendingFeedback(false)
    }
  }

  const handleSendQuickAction = async () => {
    if (!quickActionDescription.trim()) {
      toast({
        title: "Error",
        description: "Please enter a description",
        variant: "destructive",
      })
      return
    }

    try {
      setSendingQuickAction(true)
      const updated = await createQuickAction(orderId, inspectionId || "", quickActionType, quickActionDescription)
      setCommunication(updated)
      toast({
        title: "Success",
        description: "Quick action sent to customer",
      })
      // Reset form
      setQuickActionDescription("")
      setQuickActionType('part_replacement')
      setShowQuickActionDialog(false)
    } catch (error: any) {
      console.error("Error sending quick action:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to send quick action",
        variant: "destructive",
      })
    } finally {
      setSendingQuickAction(false)
    }
  }

  // Check if user is staff or admin
  const isStaffOrAdmin = user?.role === 'staff' || user?.role === 'admin'

  if (loading) {
    return null // Don't show while loading
  }

  // Filter only feedback_request and quick_action messages
  const communicationMessages = communication?.messages.filter((msg) =>
    ["feedback_request", "quick_action"].includes(msg.messageType)
  ) || []

  // Show panel if there are communication messages OR if user is staff/admin (so they can send)
  const shouldShowPanel = communicationMessages.length > 0 || isStaffOrAdmin

  if (!shouldShowPanel) {
    return null
  }

  return (
    <>
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold">Communication & Feedback</h3>
          </div>

          {/* Staff/Admin Action Buttons */}
          {isStaffOrAdmin && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowFeedbackDialog(true)}
                className="h-7 px-2 text-xs"
                title="Send feedback request to customer"
              >
                <Send className="w-3 h-3 mr-1" />
                Feedback
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowQuickActionDialog(true)}
                className="h-7 px-2 text-xs"
                title="Send quick action to customer"
              >
                <Plus className="w-3 h-3 mr-1" />
                Action
              </Button>
            </div>
          )}
        </div>

        {/* Communication Messages */}
        {communicationMessages.length > 0 && (
          <div className="space-y-2">
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
        )}

        {communicationMessages.length === 0 && isStaffOrAdmin && (
          <p className="text-sm text-gray-500">No communication messages yet. Use the buttons above to send feedback or actions to the customer.</p>
        )}
      </div>

      {/* Feedback Request Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Feedback Request to Customer</DialogTitle>
            <DialogDescription>
              Ask the customer a question about the repair
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="question">Question</Label>
              <Textarea
                id="question"
                placeholder="e.g., Do you approve the $45 battery replacement?"
                value={feedbackQuestion}
                onChange={(e) => setFeedbackQuestion(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="option1">First Option</Label>
              <Input
                id="option1"
                placeholder="e.g., Yes, proceed with repair"
                value={feedbackOption1Label}
                onChange={(e) => setFeedbackOption1Label(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="option2">Second Option</Label>
              <Input
                id="option2"
                placeholder="e.g., No, don't proceed"
                value={feedbackOption2Label}
                onChange={(e) => setFeedbackOption2Label(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedbackDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendFeedback} disabled={sendingFeedback}>
              {sendingFeedback ? "Sending..." : "Send Feedback Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Action Dialog */}
      <Dialog open={showQuickActionDialog} onOpenChange={setShowQuickActionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Quick Action to Customer</DialogTitle>
            <DialogDescription>
              Notify the customer of an important action
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="actionType">Action Type</Label>
              <select
                id="actionType"
                value={quickActionType}
                onChange={(e) => setQuickActionType(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
              >
                <option value="part_replacement">Part Replacement Required</option>
                <option value="incorrect_device">Incorrect Device Specification</option>
                <option value="incorrect_unlock_code">Incorrect Unlock Code</option>
                <option value="additional_costs">Additional Costs Required</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the action or issue..."
                value={quickActionDescription}
                onChange={(e) => setQuickActionDescription(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickActionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendQuickAction} disabled={sendingQuickAction}>
              {sendingQuickAction ? "Sending..." : "Send Action"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
