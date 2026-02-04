import { useEffect, useState } from "react"
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
  sendMessage,
} from "@/api/inspectionCommunication"
import { CheckCircle2, MessageCircle, AlertCircle, Plus, Send, Clock, User, HelpCircle, Settings, ChevronDown, Check } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

// Unified Message interface used by both components
export interface UnifiedMessage {
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
    respondedAt?: string
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

// Unified Communication interface used by both components
export interface UnifiedCommunication {
  _id: string
  messages: UnifiedMessage[]
  pendingFeedbackCount: number
  pendingActionsCount: number
  status?: "active" | "archived" | "resolved"
  lastMessageAt?: string
}

export interface CommunicationHistoryDialogProps {
  orderId: string
  inspectionId?: string
  userRole?: string
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  triggerContent?: React.ReactNode
  allowMessages?: boolean
}

// Helper function to format timestamps
const formatMessageTime = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  } catch {
    return "Unknown"
  }
}

export function CommunicationHistoryDialog({
  orderId,
  inspectionId,
  userRole,
  isOpen: externalIsOpen,
  onOpenChange: externalOnOpenChange,
  triggerContent,
  allowMessages = false,
}: CommunicationHistoryDialogProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [communication, setCommunication] = useState<UnifiedCommunication | null>(null)
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState(false)
  const [sending, setSending] = useState(false)
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false)
  const [showQuickActionDialog, setShowQuickActionDialog] = useState(false)
  const [showMessageDialog, setShowMessageDialog] = useState(false)
  const [newMessage, setNewMessage] = useState("")
  const [feedbackQuestion, setFeedbackQuestion] = useState("")
  const [feedbackOption1Label, setFeedbackOption1Label] = useState("")
  const [feedbackOption1Value, setFeedbackOption1Value] = useState("")
  const [feedbackOption2Label, setFeedbackOption2Label] = useState("")
  const [feedbackOption2Value, setFeedbackOption2Value] = useState("")
  const [quickActionType, setQuickActionType] = useState<'part_replacement' | 'incorrect_device' | 'incorrect_unlock_code' | 'additional_costs'>('part_replacement')
  const [quickActionDescription, setQuickActionDescription] = useState("")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen
  const setIsOpen = externalOnOpenChange || setInternalIsOpen

  // Get current user ID
  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const response = await fetch('/api/users/me', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          setCurrentUserId(data.user?._id)
        }
      } catch (error) {
        console.error("CommunicationHistoryDialog: Error fetching user ID:", error)
      }
    }
    fetchUserId()
  }, [])

  // Load communication thread
  useEffect(() => {
    let isActive = true
    let loadTimeout: NodeJS.Timeout | null = null

    const loadCommunication = async () => {
      try {
        if (!isActive) return
        setLoading(true)
        const thread = await getCommunicationThread(orderId)
        if (isActive) {
          setCommunication(thread)
          console.log("CommunicationHistoryDialog: Communication thread loaded with", thread?.messages?.length || 0, "messages")
        }
      } catch (error) {
        if (isActive) {
          console.error("CommunicationHistoryDialog: Error loading communication thread:", error)
        }
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    if (isOpen && orderId) {
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
  }, [isOpen, orderId])

  // Mark messages as read
  useEffect(() => {
    if (isOpen && communication?.messages && communication.messages.length > 0) {
      markMessagesAsRead(orderId).catch((error) =>
        console.error("CommunicationHistoryDialog: Error marking messages as read:", error)
      )
    }
  }, [isOpen, communication?.messages, orderId])

  const handleFeedbackResponse = async (messageId: string, response: { label: string; value: string }) => {
    try {
      setResponding(true)
      console.log("CommunicationHistoryDialog: Responding to feedback:", { messageId, response })
      const updated = await respondToFeedback(orderId, messageId, response)
      setCommunication(updated)
      console.log("CommunicationHistoryDialog: Feedback response recorded successfully")

      try {
        await markMessagesAsRead(orderId)
      } catch (readError) {
        console.error("CommunicationHistoryDialog: Error marking messages as read after feedback:", readError)
      }

      toast({
        title: t('common.success'),
        description: t('communicationPanel.successResponseRecorded'),
      })
    } catch (error: any) {
      console.error("CommunicationHistoryDialog: Error responding to feedback:", error)
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
      setSending(true)
      const options = [
        { label: feedbackOption1Label, value: feedbackOption1Value || feedbackOption1Label.toLowerCase() },
        { label: feedbackOption2Label, value: feedbackOption2Value || feedbackOption2Label.toLowerCase() },
      ]
      console.log("CommunicationHistoryDialog: Sending feedback request")
      const updated = await sendFeedbackRequest(orderId, inspectionId || "", feedbackQuestion, options)
      setCommunication(updated)
      console.log("CommunicationHistoryDialog: Feedback request sent successfully")
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
      console.error("CommunicationHistoryDialog: Error sending feedback:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('communicationPanel.errorFillAllFields'),
        variant: "destructive",
      })
    } finally {
      setSending(false)
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
      setSending(true)
      console.log("CommunicationHistoryDialog: Sending quick action")
      const updated = await createQuickAction(orderId, inspectionId || "", quickActionType, quickActionDescription)
      setCommunication(updated)
      console.log("CommunicationHistoryDialog: Quick action sent successfully")
      toast({
        title: t('common.success'),
        description: t('communicationPanel.successActionSent'),
      })
      // Reset form
      setQuickActionDescription("")
      setQuickActionType('part_replacement')
      setShowQuickActionDialog(false)
    } catch (error: any) {
      console.error("CommunicationHistoryDialog: Error sending quick action:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('communicationPanel.errorEnterDescription'),
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim()) {
      toast({
        title: t('common.error'),
        description: t('communicationPanel.errorEnterMessage'),
        variant: "destructive",
      })
      return
    }

    try {
      setSending(true)
      console.log("CommunicationHistoryDialog: Sending message")
      const updated = await sendMessage(orderId, newMessage)
      setCommunication(updated)
      console.log("CommunicationHistoryDialog: Message sent successfully")
      setNewMessage("")
      setShowMessageDialog(false)
      toast({
        title: t('common.success'),
        description: t('communicationPanel.successMessageSent'),
      })
    } catch (error: any) {
      console.error("CommunicationHistoryDialog: Error sending message:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('communicationPanel.errorSendingMessage'),
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  // Check if user is staff or admin
  const isStaffOrAdmin = userRole === 'staff' || userRole === 'admin'

  // Filter messages based on context
  const allMessages = communication?.messages || []
  const unreadCount = allMessages.filter((msg) => {
    if (!currentUserId) return false
    return !msg.readBy?.some((r) => r.userId === currentUserId)
  }).length || 0

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {triggerContent && (
        <DialogTrigger asChild>
          {triggerContent}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-3xl max-h-[80vh] !grid-rows-[auto_1fr_auto] grid grid-rows-3 gap-0">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                {t("communicationPanel.communicationHistory")}
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {unreadCount} unread
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {(communication?.pendingFeedbackCount || 0) + (communication?.pendingActionsCount || 0) > 0
                  ? t("communicationPanel.pendingInteractions", {
                      count:
                        (communication?.pendingFeedbackCount || 0) +
                        (communication?.pendingActionsCount || 0),
                    })
                  : t("communicationPanel.allCaught")}
              </DialogDescription>
            </div>

            {/* Staff/Admin Action Buttons */}
            {isStaffOrAdmin && (
              <div className="flex gap-1">
                {allowMessages && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowMessageDialog(true)}
                    title="Send message"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1">Message</span>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowFeedbackDialog(true)}
                  title={t("communicationPanel.sendFeedbackRequest")}
                >
                  <HelpCircle className="w-4 h-4" />
                  <span className="hidden sm:inline ml-1">{t("communicationPanel.feedback")}</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowQuickActionDialog(true)}
                  title={t("communicationPanel.sendQuickAction")}
                >
                  <AlertCircle className="w-3 h-3" />
                  <span className="hidden sm:inline ml-1">{t("communicationPanel.action")}</span>
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <Separator className="my-0" />

        {/* Messages Area */}
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center text-muted-foreground">
              {t("common.loading")}...
            </div>
          </div>
        ) : (
          <ScrollArea className="overflow-hidden border rounded-md">
            <div className="space-y-4 p-4">
              {allMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-gray-500">
                  <MessageCircle className="w-8 h-8 mb-2" />
                  <p className="text-sm">{t('communicationPanel.noCommunicationMessages')}</p>
                </div>
              ) : (
                allMessages.map((message) => (
                  <div key={message._id} className="space-y-2">
                    {/* Text Messages */}
                    {message.messageType === "text" && (
                      <div className={`flex gap-3 ${message.senderType === "customer" ? "flex-row-reverse" : ""}`}>
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={message.senderId?.avatar} />
                          <AvatarFallback>
                            {message.senderName?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`flex-1 ${message.senderType === "customer" ? "items-end" : "items-start"} flex flex-col`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold">
                              {message.senderName}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {message.senderType === "customer" ? t("common.customer") : t("common.staff")}
                            </Badge>
                          </div>
                          <div className={`rounded-lg p-3 max-w-md ${
                            message.senderType === "customer"
                              ? "bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-100"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          }`}>
                            <p className="text-sm">{message.content}</p>
                          </div>
                          <span className="text-xs text-muted-foreground mt-1">
                            {formatMessageTime(message.createdAt)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Feedback Requests */}
                    {message.messageType === "feedback_request" && message.feedbackRequest && (
                      <div className={`border-l-4 rounded-r-lg p-4 transition-all ${
                        message.feedbackRequest.status === "pending"
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
                          : "border-green-500 bg-green-50 dark:bg-green-950/30"
                      }`}>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1">
                            <p className="font-semibold text-sm mb-2 text-gray-900 dark:text-gray-100">
                              {message.feedbackRequest.question}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-3">
                              <User className="w-3 h-3" />
                              <span>{message.senderName}</span>
                              <Clock className="w-3 h-3 ml-2" />
                              <span>{formatMessageTime(message.createdAt)}</span>
                            </div>
                          </div>
                          <Badge
                            variant={message.feedbackRequest.status === "pending" ? "outline" : "default"}
                            className="text-xs flex-shrink-0"
                          >
                            {message.feedbackRequest.status === "pending" ? "⏳ Pending" : "✓ Responded"}
                          </Badge>
                        </div>

                        {message.feedbackRequest.status === "pending" && (
                          <div className="space-y-2">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Click to respond:</p>
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
                                className="w-full justify-start text-left h-auto py-2.5"
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <div className="w-4 h-4 rounded-full border-2 border-gray-400 flex-shrink-0" />
                                  <span className="text-sm">{option.label}</span>
                                </div>
                              </Button>
                            ))}
                          </div>
                        )}
                        {message.feedbackRequest.status === "responded" && (
                          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-3 py-2 rounded">
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                            <span className="text-sm">
                              {t('communicationPanel.youResponded')} <span className="font-semibold">{message.feedbackRequest.response?.label}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quick Actions */}
                    {message.messageType === "quick_action" && message.quickAction && (
                      <div className={`border-l-4 rounded-r-lg p-4 transition-all ${
                        message.quickAction.status === "pending"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                          : "border-green-500 bg-green-50 dark:bg-green-950/30"
                      }`}>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                              <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                                {message.quickAction.actionLabel}
                              </p>
                            </div>
                            {message.quickAction.description && (
                              <p className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900/50 p-2 rounded mb-2 border border-gray-200 dark:border-gray-700">
                                {message.quickAction.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                              <User className="w-3 h-3" />
                              <span>{message.senderName}</span>
                              <Clock className="w-3 h-3 ml-2" />
                              <span>{formatMessageTime(message.createdAt)}</span>
                            </div>
                          </div>
                          {message.quickAction.status === "completed" && (
                            <Badge variant="default" className="gap-1 flex-shrink-0 text-xs">
                              <CheckCircle2 className="w-3 h-3" />
                              {t('communicationPanel.completed')}
                            </Badge>
                          )}
                          {message.quickAction.status === "pending" && (
                            <Badge variant="outline" className="gap-1 flex-shrink-0 text-xs">
                              ⏳ {t('communicationPanel.pending')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        )}

        <Separator className="my-0" />
      </DialogContent>

      {/* Feedback Request Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-amber-600" />
              {t('communicationPanel.sendFeedbackRequest')}
            </DialogTitle>
            <DialogDescription>
              {t('communicationPanel.askCustomerFeedback')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="question" className="flex items-center gap-2">
                <span>{t('communicationPanel.question')}</span>
                <span className={`text-xs ${feedbackQuestion.trim() ? "text-green-600" : "text-gray-400"}`}>
                  {feedbackQuestion.trim() ? "✓" : "required"}
                </span>
              </Label>
              <Textarea
                id="question"
                placeholder={t('communicationPanel.exampleQuestion')}
                value={feedbackQuestion}
                onChange={(e) => setFeedbackQuestion(e.target.value)}
                className={`min-h-[80px] resize-none transition-colors ${
                  feedbackQuestion.trim()
                    ? "border-green-300 dark:border-green-700"
                    : "border-gray-300 dark:border-gray-600"
                }`}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="option1" className="flex items-center gap-2">
                <span>{t('communicationPanel.firstOption')}</span>
                <span className={`text-xs ${feedbackOption1Label.trim() ? "text-green-600" : "text-gray-400"}`}>
                  {feedbackOption1Label.trim() ? "✓" : "required"}
                </span>
              </Label>
              <Input
                id="option1"
                placeholder={t('communicationPanel.exampleOption1')}
                value={feedbackOption1Label}
                onChange={(e) => setFeedbackOption1Label(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="option2" className="flex items-center gap-2">
                <span>{t('communicationPanel.secondOption')}</span>
                <span className={`text-xs ${feedbackOption2Label.trim() ? "text-green-600" : "text-gray-400"}`}>
                  {feedbackOption2Label.trim() ? "✓" : "required"}
                </span>
              </Label>
              <Input
                id="option2"
                placeholder={t('communicationPanel.exampleOption2')}
                value={feedbackOption2Label}
                onChange={(e) => setFeedbackOption2Label(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowFeedbackDialog(false)}
              disabled={sending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSendFeedback}
              disabled={sending || !feedbackQuestion.trim() || !feedbackOption1Label.trim() || !feedbackOption2Label.trim()}
              className="gap-2"
            >
              {sending ? (
                <>
                  <span className="inline-block animate-spin">⏳</span>
                  {t('communicationPanel.sendingFeedback')}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {t('communicationPanel.sendFeedback')}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Action Dialog */}
      <Dialog open={showQuickActionDialog} onOpenChange={setShowQuickActionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              {t('communicationPanel.sendQuickAction')}
            </DialogTitle>
            <DialogDescription>
              {t('communicationPanel.notifyCustomerAction')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="actionType" className="flex items-center gap-2">
                <span>{t('communicationPanel.actionType')}</span>
                <span className="text-xs text-gray-400">required</span>
              </Label>
              <select
                id="actionType"
                value={quickActionType}
                onChange={(e) => setQuickActionType(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-sm"
              >
                <option value="part_replacement">{t('communicationPanel.partReplacementRequired')}</option>
                <option value="incorrect_device">{t('communicationPanel.incorrectDeviceSpecification')}</option>
                <option value="incorrect_unlock_code">{t('communicationPanel.incorrectUnlockCode')}</option>
                <option value="additional_costs">{t('communicationPanel.additionalCostsRequired')}</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="flex items-center gap-2">
                <span>{t('communicationPanel.description')}</span>
                <span className={`text-xs ${quickActionDescription.trim() ? "text-green-600" : "text-gray-400"}`}>
                  {quickActionDescription.trim() ? "✓" : "required"}
                </span>
              </Label>
              <Textarea
                id="description"
                placeholder={t('communicationPanel.describeAction')}
                value={quickActionDescription}
                onChange={(e) => setQuickActionDescription(e.target.value)}
                className={`min-h-[100px] resize-none transition-colors ${
                  quickActionDescription.trim()
                    ? "border-green-300 dark:border-green-700"
                    : "border-gray-300 dark:border-gray-600"
                }`}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowQuickActionDialog(false)}
              disabled={sending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSendQuickAction}
              disabled={sending || !quickActionDescription.trim()}
              className="gap-2"
            >
              {sending ? (
                <>
                  <span className="inline-block animate-spin">⏳</span>
                  {t('communicationPanel.sendingAction')}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {t('communicationPanel.sendAction')}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Message Dialog */}
      {allowMessages && (
        <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-blue-600" />
                Send Message
              </DialogTitle>
              <DialogDescription>
                Send a direct message to the customer
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowMessageDialog(false)}
                disabled={sending}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleSendMessage}
                disabled={sending || !newMessage.trim()}
                className="gap-2"
              >
                {sending ? (
                  <>
                    <span className="inline-block animate-spin">⏳</span>
                    {t('communicationPanel.sending')}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {t('common.send')}
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  )
}
