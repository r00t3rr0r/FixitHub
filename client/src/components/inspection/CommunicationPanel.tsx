import { useEffect, useState, useRef } from "react"
import { useTranslation } from "react-i18next"
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
import { ScrollArea } from "@/components/ui/scroll-area"

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
  // Description: React component for managing inspection communication threads
  // i18n keys: communicationPanel namespace
  const { t } = useTranslation()
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
        console.log("CommunicationPanel: User profile loaded:", userResponse)
      } catch (error) {
        console.error("CommunicationPanel: Error loading user profile:", error)
      }
    }

    loadUserProfile()
  }, [])

  // Load communication thread
  useEffect(() => {
    let isActive = true;
    let loadTimeout: NodeJS.Timeout | null = null;

    const loadCommunication = async () => {
      try {
        if (!isActive) return;
        setLoading(true)
        const thread = await getCommunicationThread(orderId)
        if (isActive) {
          setCommunication(thread)
          console.log("CommunicationPanel: Communication thread loaded with", thread?.messages?.length || 0, "messages")
        }
      } catch (error) {
        if (isActive) {
          console.error("CommunicationPanel: Error loading communication thread:", error)
        }
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    if (orderId) {
      // Initial load
      loadCommunication()
      // Set up polling for updates every 3 seconds
      const interval = setInterval(() => {
        loadCommunication()
      }, 3000)
      return () => {
        isActive = false
        clearInterval(interval)
        if (loadTimeout) clearTimeout(loadTimeout)
      }
    }
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
      console.log("CommunicationPanel: Responding to feedback:", { messageId, response })
      const updated = await respondToFeedback(orderId, messageId, response)
      console.log("CommunicationPanel: Received updated communication after feedback response:", updated)
      setCommunication(updated)
      console.log("CommunicationPanel: Feedback response recorded successfully, state updated with", updated?.messages?.length || 0, "messages")

      // Mark messages as read after responding to feedback
      try {
        await markMessagesAsRead(orderId)
        console.log("CommunicationPanel: Messages marked as read after feedback response")
      } catch (readError) {
        console.error("CommunicationPanel: Error marking messages as read after feedback response:", readError)
        // Don't throw, as the main operation succeeded
      }

      toast({
        title: t('common.success'),
        description: t('communicationPanel.successResponseRecorded'),
      })
    } catch (error: any) {
      console.error("CommunicationPanel: Error responding to feedback:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('communicationPanel.errorEnterDescription'),
        variant: "destructive",
      })
    } finally {
      setResponding(false)
    }
  }

  const handleSendFeedback = async () => {
    if (!feedbackQuestion.trim() || !feedbackOption1Label.trim() || !feedbackOption2Label.trim()) {
      toast({
        title: t('common.error'),
        description: t('communicationPanel.errorFillAllFields'),
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
      console.log("CommunicationPanel: Sending feedback request:", { orderId, question: feedbackQuestion, options })
      const updated = await sendFeedbackRequest(orderId, inspectionId || "", feedbackQuestion, options)
      console.log("CommunicationPanel: Received updated communication after sending feedback:", updated)
      setCommunication(updated)
      console.log("CommunicationPanel: Feedback request sent successfully, state updated with", updated?.messages?.length || 0, "messages")
      toast({
        title: t('common.success'),
        description: t('communicationPanel.successFeedbackSent'),
      })
      // Reset form
      setFeedbackQuestion("")
      setFeedbackOption1Label("")
      setFeedbackOption1Value("")
      setFeedbackOption2Label("")
      setFeedbackOption2Value("")
      setShowFeedbackDialog(false)
    } catch (error: any) {
      console.error("CommunicationPanel: Error sending feedback:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('communicationPanel.errorFillAllFields'),
        variant: "destructive",
      })
    } finally {
      setSendingFeedback(false)
    }
  }

  const handleSendQuickAction = async () => {
    if (!quickActionDescription.trim()) {
      toast({
        title: t('common.error'),
        description: t('communicationPanel.errorEnterDescription'),
        variant: "destructive",
      })
      return
    }

    try {
      setSendingQuickAction(true)
      console.log("CommunicationPanel: Sending quick action:", { orderId, actionType: quickActionType, description: quickActionDescription })
      const updated = await createQuickAction(orderId, inspectionId || "", quickActionType, quickActionDescription)
      console.log("CommunicationPanel: Received updated communication after sending quick action:", updated)
      setCommunication(updated)
      console.log("CommunicationPanel: Quick action sent successfully, state updated with", updated?.messages?.length || 0, "messages")
      toast({
        title: t('common.success'),
        description: t('communicationPanel.successActionSent'),
      })
      // Reset form
      setQuickActionDescription("")
      setQuickActionType('part_replacement')
      setShowQuickActionDialog(false)
    } catch (error: any) {
      console.error("CommunicationPanel: Error sending quick action:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('communicationPanel.errorEnterDescription'),
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
            <h3 className="text-sm font-semibold">{t('communicationPanel.communicationAndFeedback')}</h3>
          </div>

          {/* Staff/Admin Action Buttons */}
          {isStaffOrAdmin && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowFeedbackDialog(true)}
                className="h-7 px-2 text-xs"
                title={t('communicationPanel.sendFeedbackRequest')}
              >
                <Send className="w-3 h-3 mr-1" />
                {t('communicationPanel.feedback')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowQuickActionDialog(true)}
                className="h-7 px-2 text-xs"
                title={t('communicationPanel.sendQuickAction')}
              >
                <Plus className="w-3 h-3 mr-1" />
                {t('communicationPanel.action')}
              </Button>
            </div>
          )}
        </div>

        {/* Communication Messages - Scrollable History */}
        {communicationMessages.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <ScrollArea className="h-96 w-full">
              <div className="p-3 space-y-2">
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
                            {t('communicationPanel.youResponded')} <span className="font-medium">{message.feedbackRequest.response?.label}</span>
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
                            {t('communicationPanel.from')} <span className="font-medium">{message.senderName}</span>
                          </p>
                        </div>
                        {message.quickAction.status === "completed" && (
                          <Badge variant="default" className="gap-1 flex-shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            {t('communicationPanel.completed')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {communicationMessages.length === 0 && isStaffOrAdmin && (
          <p className="text-sm text-gray-500">{t('communicationPanel.noCommunicationMessages')}</p>
        )}
      </div>

      {/* Feedback Request Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('communicationPanel.sendFeedbackRequest')}</DialogTitle>
            <DialogDescription>
              {t('communicationPanel.askCustomerQuestion')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="question">{t('communicationPanel.question')}</Label>
              <Textarea
                id="question"
                placeholder={t('communicationPanel.exampleQuestion')}
                value={feedbackQuestion}
                onChange={(e) => setFeedbackQuestion(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="option1">{t('communicationPanel.firstOption')}</Label>
              <Input
                id="option1"
                placeholder={t('communicationPanel.exampleOption1')}
                value={feedbackOption1Label}
                onChange={(e) => setFeedbackOption1Label(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="option2">{t('communicationPanel.secondOption')}</Label>
              <Input
                id="option2"
                placeholder={t('communicationPanel.exampleOption2')}
                value={feedbackOption2Label}
                onChange={(e) => setFeedbackOption2Label(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedbackDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSendFeedback} disabled={sendingFeedback}>
              {sendingFeedback ? t('communicationPanel.sendingFeedback') : t('communicationPanel.sendFeedback')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Action Dialog */}
      <Dialog open={showQuickActionDialog} onOpenChange={setShowQuickActionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('communicationPanel.sendQuickAction')}</DialogTitle>
            <DialogDescription>
              {t('communicationPanel.notifyCustomer')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="actionType">{t('communicationPanel.actionType')}</Label>
              <select
                id="actionType"
                value={quickActionType}
                onChange={(e) => setQuickActionType(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
              >
                <option value="part_replacement">{t('communicationPanel.partReplacementRequired')}</option>
                <option value="incorrect_device">{t('communicationPanel.incorrectDeviceSpecification')}</option>
                <option value="incorrect_unlock_code">{t('communicationPanel.incorrectUnlockCode')}</option>
                <option value="additional_costs">{t('communicationPanel.additionalCostsRequired')}</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('communicationPanel.description')}</Label>
              <Textarea
                id="description"
                placeholder={t('communicationPanel.describeAction')}
                value={quickActionDescription}
                onChange={(e) => setQuickActionDescription(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickActionDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSendQuickAction} disabled={sendingQuickAction}>
              {sendingQuickAction ? t('communicationPanel.sendingAction') : t('communicationPanel.sendAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
