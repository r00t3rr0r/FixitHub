import { useEffect, useState, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import {
  getCommunicationThread as getInspectionCommunicationThread,
  respondToFeedback as respondToInspectionFeedback,
  markMessagesAsRead as markInspectionMessagesAsRead,
  sendFeedbackRequest as sendInspectionFeedbackRequest,
  createQuickAction as createInspectionQuickAction,
  sendMessage as sendInspectionMessage,
} from "@/api/inspectionCommunication"
import {
  getCommunicationThread as getRepairRequestCommunicationThread,
  respondToFeedback as respondToRepairRequestFeedback,
  markMessagesAsRead as markRepairRequestMessagesAsRead,
  sendFeedbackRequest as sendRepairRequestFeedbackRequest,
  createQuickAction as createRepairRequestQuickAction,
  sendMessage as sendRepairRequestMessage,
} from "@/api/repairRequestCommunication"
import { getUserProfile, UserProfile } from "@/api/user"
import { CheckCircle2, MessageCircle, AlertCircle, Plus, Send, Clock, User, HelpCircle, X, Trash2 } from "lucide-react"
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
import { UnifiedMessage, UnifiedCommunication } from "./CommunicationHistoryDialog"

interface CommunicationPanelProps {
  orderId: string
  inspectionId?: string
  entityType?: "order" | "repair-request"
}

type OrderQuickActionType = 'part_replacement' | 'incorrect_device' | 'incorrect_unlock_code' | 'additional_costs'
type RepairRequestQuickActionType = 'parts_needed' | 'approval_required' | 'additional_cost' | 'status_update' | 'schedule_appointment'
type QuickActionType = OrderQuickActionType | RepairRequestQuickActionType

interface QuickActionOption {
  value: QuickActionType
  label: string
  title: string
  description: string
  tone: 'is-part' | 'is-device' | 'is-unlock' | 'is-cost'
}

const ORDER_QUICK_ACTION_OPTIONS: QuickActionOption[] = [
  {
    value: 'part_replacement',
    label: 'Part replacement required',
    title: '🔧 Part Replacement Required',
    description: 'Notify customer that additional parts need to be replaced to complete the repair',
    tone: 'is-part',
  },
  {
    value: 'incorrect_device',
    label: 'Incorrect device specification',
    title: '❌ Incorrect Device Specified',
    description: 'Notify customer that the device specifications provided do not match the device brought in',
    tone: 'is-device',
  },
  {
    value: 'incorrect_unlock_code',
    label: 'Incorrect unlock code',
    title: '🔐 Incorrect Unlock Code',
    description: 'Notify customer that the unlock code provided is incorrect or does not work',
    tone: 'is-unlock',
  },
  {
    value: 'additional_costs',
    label: 'Additional costs required',
    title: '💰 Additional Costs Required',
    description: 'Notify customer of unexpected costs that require approval before proceeding',
    tone: 'is-cost',
  },
]

const REPAIR_REQUEST_QUICK_ACTION_OPTIONS: QuickActionOption[] = [
  {
    value: 'parts_needed',
    label: 'Parts needed',
    title: '🔧 Parts Needed',
    description: 'Notify customer that additional parts are required to continue the repair request',
    tone: 'is-part',
  },
  {
    value: 'approval_required',
    label: 'Approval required',
    title: '✅ Customer Approval Required',
    description: 'Ask customer to approve the next repair step before work continues',
    tone: 'is-device',
  },
  {
    value: 'additional_cost',
    label: 'Additional cost',
    title: '💰 Additional Cost',
    description: 'Inform customer about additional costs and request confirmation',
    tone: 'is-cost',
  },
  {
    value: 'status_update',
    label: 'Status update',
    title: '📌 Repair Status Update',
    description: 'Send a structured status update with clear next steps',
    tone: 'is-device',
  },
  {
    value: 'schedule_appointment',
    label: 'Schedule appointment',
    title: '📅 Schedule Appointment',
    description: 'Ask customer to schedule a handover, pickup, or follow-up appointment',
    tone: 'is-unlock',
  },
]

// Use unified message and communication interfaces
type Message = UnifiedMessage
type Communication = UnifiedCommunication

// Prevent unnecessary rerenders by applying updates only when relevant fields changed.
const hasThreadChanged = (
  prev: Communication | null,
  next: Communication | null,
): boolean => {
  if (!prev && next) return true
  if (prev && !next) return false
  if (!prev || !next) return false

  if ((prev.pendingFeedbackCount || 0) !== (next.pendingFeedbackCount || 0)) return true
  if ((prev.pendingActionsCount || 0) !== (next.pendingActionsCount || 0)) return true

  const prevMessages = prev.messages || []
  const nextMessages = next.messages || []

  if (prevMessages.length !== nextMessages.length) return true
  if (nextMessages.length === 0) return false

  const prevLast = prevMessages[prevMessages.length - 1]
  const nextLast = nextMessages[nextMessages.length - 1]

  return (
    prevLast?._id !== nextLast?._id ||
    prevLast?.updatedAt !== nextLast?.updatedAt ||
    prevLast?.createdAt !== nextLast?.createdAt
  )
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

export function CommunicationPanel({
  orderId,
  inspectionId,
  entityType = "order",
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
  const [newMessage, setNewMessage] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)
  const [feedbackQuestion, setFeedbackQuestion] = useState("")
  const [feedbackOptions, setFeedbackOptions] = useState<Array<{ label: string; value: string }>>([
    { label: "", value: "" },
    { label: "", value: "" },
  ])
  const [quickActionType, setQuickActionType] = useState<QuickActionType>('part_replacement')
  const [quickActionDescription, setQuickActionDescription] = useState("")
  const isUserEditingRef = useRef(false)
  const quickActionOptions = entityType === "repair-request" ? REPAIR_REQUEST_QUICK_ACTION_OPTIONS : ORDER_QUICK_ACTION_OPTIONS
  const defaultQuickActionType = (quickActionOptions[0]?.value || 'part_replacement') as QuickActionType
  const selectedQuickActionOption = quickActionOptions.find((option) => option.value === quickActionType) || quickActionOptions[0]

  useEffect(() => {
    setQuickActionType(defaultQuickActionType)
  }, [defaultQuickActionType])

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

  // Track whether the user is actively editing so background polling does not interrupt input.
  useEffect(() => {
    const hasFeedbackOptions = feedbackOptions.some(opt => opt.label.trim().length > 0)
    isUserEditingRef.current =
      showFeedbackDialog ||
      showQuickActionDialog ||
      newMessage.trim().length > 0 ||
      feedbackQuestion.trim().length > 0 ||
      hasFeedbackOptions ||
      quickActionDescription.trim().length > 0
  }, [
    showFeedbackDialog,
    showQuickActionDialog,
    newMessage,
    feedbackQuestion,
    feedbackOptions,
    quickActionDescription,
  ])

  // Load communication thread
  useEffect(() => {
    let isActive = true

    const loadCommunication = async (silent = false) => {
      try {
        if (!isActive) return
        if (!silent) setLoading(true)
        const thread = entityType === "repair-request"
          ? await getRepairRequestCommunicationThread(orderId)
          : await getInspectionCommunicationThread(orderId)
        if (isActive) {
          setCommunication((prev) => {
            if (!hasThreadChanged(prev, thread)) {
              return prev
            }
            console.log("CommunicationPanel: Communication thread updated with", thread?.messages?.length || 0, "messages")
            return thread
          })
        }
      } catch (error) {
        if (isActive) {
          console.error("CommunicationPanel: Error loading communication thread:", error)
        }
      } finally {
        if (isActive && !silent) {
          setLoading(false)
        }
      }
    }

    if (orderId) {
      // Initial foreground load
      loadCommunication(false)

      // Poll less aggressively and only when user is not actively interacting.
      const interval = setInterval(() => {
        if (!isActive) return
        if (document.visibilityState !== 'visible') return
        if (isUserEditingRef.current) return
        loadCommunication(true)
      }, 10000)

      return () => {
        isActive = false
        clearInterval(interval)
      }
    }
  }, [entityType, orderId])

  // Mark messages as read
  useEffect(() => {
    if (communication?.messages && communication.messages.length > 0) {
      const markAsRead = entityType === "repair-request"
        ? markRepairRequestMessagesAsRead
        : markInspectionMessagesAsRead

      markAsRead(orderId).catch((error) =>
        console.error("Error marking messages as read:", error)
      )
    }
  }, [communication?.messages, entityType, orderId])

  const handleFeedbackResponse = async (messageId: string, response: { label: string; value: string }) => {
    try {
      setResponding(true)
      console.log("CommunicationPanel: Responding to feedback:", { messageId, response })
      const updated = entityType === "repair-request"
        ? await respondToRepairRequestFeedback(orderId, messageId, response)
        : await respondToInspectionFeedback(orderId, messageId, response)
      console.log("CommunicationPanel: Received updated communication after feedback response:", updated)
      setCommunication(updated)
      console.log("CommunicationPanel: Feedback response recorded successfully, state updated with", updated?.messages?.length || 0, "messages")

      // Mark messages as read after responding to feedback
      try {
        const markAsRead = entityType === "repair-request"
          ? markRepairRequestMessagesAsRead
          : markInspectionMessagesAsRead
        await markAsRead(orderId)
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
      setSendingMessage(true)
      console.log("CommunicationPanel: Sending message:", newMessage)
      const updated = entityType === "repair-request"
        ? await sendRepairRequestMessage(orderId, newMessage)
        : await sendInspectionMessage(orderId, newMessage)
      console.log("CommunicationPanel: Message sent successfully, state updated with", updated?.messages?.length || 0, "messages")
      setCommunication(updated)
      setNewMessage("")
      toast({
        title: t('common.success'),
        description: "Nachricht erfolgreich versendet",
      })
    } catch (error: any) {
      console.error("CommunicationPanel: Error sending message:", error)
      toast({
        title: t('common.error'),
        description: error.message || "Fehler beim Versenden der Nachricht",
        variant: "destructive",
      })
    } finally {
      setSendingMessage(false)
    }
  }

  const handleAddFeedbackOption = () => {
    setFeedbackOptions([...feedbackOptions, { label: "", value: "" }])
  }

  const handleRemoveFeedbackOption = (index: number) => {
    if (feedbackOptions.length > 2) {
      setFeedbackOptions(feedbackOptions.filter((_, i) => i !== index))
    } else {
      toast({
        title: t('common.error'),
        description: "Mindestens 2 Optionen sind erforderlich",
        variant: "destructive",
      })
    }
  }

  const handleUpdateFeedbackOption = (index: number, field: 'label' | 'value', value: string) => {
    const updated = [...feedbackOptions]
    updated[index] = { ...updated[index], [field]: value }
    if (field === 'label' && !updated[index].value) {
      updated[index].value = value.toLowerCase()
    }
    setFeedbackOptions(updated)
  }

  const handleSendFeedback = async () => {
    const validOptions = feedbackOptions.filter(opt => opt.label.trim())
    if (!feedbackQuestion.trim() || validOptions.length < 2) {
      toast({
        title: t('common.error'),
        description: validOptions.length < 2 ? "Mindestens 2 Optionen sind erforderlich" : t('communicationPanel.errorFillAllFields'),
        variant: "destructive",
      })
      return
    }

    try {
      setSendingFeedback(true)
      console.log("CommunicationPanel: Sending feedback request:", { orderId, question: feedbackQuestion, options: validOptions })
      const updated = entityType === "repair-request"
        ? await sendRepairRequestFeedbackRequest(orderId, feedbackQuestion, validOptions)
        : await sendInspectionFeedbackRequest(orderId, inspectionId || "", feedbackQuestion, validOptions)
      console.log("CommunicationPanel: Received updated communication after sending feedback:", updated)
      setCommunication(updated)
      console.log("CommunicationPanel: Feedback request sent successfully, state updated with", updated?.messages?.length || 0, "messages")
      toast({
        title: t('common.success'),
        description: t('communicationPanel.successFeedbackSent'),
      })
      // Reset form
      setFeedbackQuestion("")
      setFeedbackOptions([
        { label: "", value: "" },
        { label: "", value: "" },
      ])
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
      const updated = entityType === "repair-request"
        ? await createRepairRequestQuickAction(orderId, quickActionType as RepairRequestQuickActionType, quickActionDescription)
        : await createInspectionQuickAction(orderId, inspectionId || "", quickActionType as OrderQuickActionType, quickActionDescription)
      console.log("CommunicationPanel: Received updated communication after sending quick action:", updated)
      setCommunication(updated)
      console.log("CommunicationPanel: Quick action sent successfully, state updated with", updated?.messages?.length || 0, "messages")
      toast({
        title: t('common.success'),
        description: t('communicationPanel.successActionSent'),
      })
      // Reset form
      setQuickActionDescription("")
      setQuickActionType(defaultQuickActionType)
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

  // Filter to include text messages, feedback_request and quick_action messages
  const communicationMessages = communication?.messages.filter((msg) =>
    ["text", "feedback_request", "quick_action"].includes(msg.messageType)
  ) || []

  // Show panel if there are communication messages OR if user is staff/admin (so they can send)
  const shouldShowPanel = communicationMessages.length > 0 || isStaffOrAdmin

  if (!shouldShowPanel) {
    return null
  }

  return (
    <>
      <div className="inspection-comm-panel mt-4 space-y-3">
        <div className="inspection-comm-header flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="inspection-comm-header-left flex items-center gap-2">
              <MessageCircle className="inspection-comm-header-icon w-4 h-4" />
              <h3 className="inspection-comm-title text-sm font-semibold">{t('communicationPanel.communicationAndFeedback')}</h3>
              {(communication?.pendingFeedbackCount || 0) + (communication?.pendingActionsCount || 0) > 0 && (
                <Badge variant="secondary" className="inspection-comm-counter text-xs">
                  {(communication?.pendingFeedbackCount || 0) + (communication?.pendingActionsCount || 0)}
                </Badge>
              )}
            </div>

            {/* Staff/Admin Action Buttons */}
            {isStaffOrAdmin && (
              <div className="inspection-comm-toolbar flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowFeedbackDialog(true)}
                  className="inspection-comm-toolbar-btn h-7 px-2 text-xs gap-1"
                  title={t('communicationPanel.sendFeedbackRequest')}
                >
                  <HelpCircle className="w-3 h-3" />
                  {t('communicationPanel.feedback')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowQuickActionDialog(true)}
                  className="inspection-comm-toolbar-btn h-7 px-2 text-xs gap-1"
                  title={t('communicationPanel.sendQuickAction')}
                >
                  <AlertCircle className="w-3 h-3" />
                  {t('communicationPanel.action')}
                </Button>
              </div>
            )}
          </div>

          {/* Created By Information - Staff/Admin Only */}
          {isStaffOrAdmin && communication?.createdBy && (
            <div className="inspection-comm-created-by text-xs text-gray-600 px-1">
              von {communication.createdBy.name} ({communication.createdBy.role})
            </div>
          )}
        </div>

        {/* Message Input Area - Staff/Admin Only */}
        {isStaffOrAdmin && (
          <div className="inspection-comm-input-section border rounded-lg p-3 bg-blue-50">
            <Label htmlFor="message-input" className="text-xs font-semibold mb-2 block">
              Nachricht senden
            </Label>
            <div className="flex gap-2">
              <Textarea
                id="message-input"
                placeholder="Nachricht eingeben..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="min-h-[60px] resize-none text-xs"
                disabled={sendingMessage}
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setNewMessage("")}
                disabled={sendingMessage || !newMessage.trim()}
                className="h-7 text-xs"
              >
                Löschen
              </Button>
              <Button
                size="sm"
                onClick={handleSendMessage}
                disabled={sendingMessage || !newMessage.trim()}
                className="h-7 text-xs gap-1"
              >
                {sendingMessage ? (
                  <>
                    <span className="inline-block animate-spin">⏳</span>
                    Sendet...
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    Senden
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Communication Messages - Scrollable History */}
        {communicationMessages.length > 0 && (
          <div className="inspection-comm-thread border rounded-lg overflow-hidden bg-white">
            <ScrollArea className="h-[450px] w-full">
              <div className="inspection-comm-thread-content p-4 space-y-3">
              {communicationMessages.map((message) => (
                <div key={message._id} className="space-y-2">
                  {/* Feedback Requests */}
                  {message.messageType === "feedback_request" && message.feedbackRequest && (
                    <div className={`inspection-comm-feedback-card border-l-4 rounded-r-lg p-4 transition-all ${
                      message.feedbackRequest.status === "pending"
                        ? "is-pending"
                        : "is-completed"
                    }`}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <p className="inspection-comm-question font-semibold text-sm mb-2">
                            {message.feedbackRequest.question}
                          </p>
                          <div className="inspection-comm-meta flex items-center gap-2 text-xs mb-3">
                            <User className="w-3 h-3" />
                            <span>{message.senderName}</span>
                            <Clock className="w-3 h-3 ml-2" />
                            <span>{formatMessageTime(message.createdAt)}</span>
                          </div>
                        </div>
                        <Badge
                          variant={message.feedbackRequest.status === "pending" ? "outline" : "default"}
                          className="inspection-comm-status text-xs flex-shrink-0"
                        >
                          {message.feedbackRequest.status === "pending" ? "⏳ Pending" : "✓ Responded"}
                        </Badge>
                      </div>

                      {message.feedbackRequest.status === "pending" ? (
                        <div className="space-y-2">
                          <p className="inspection-comm-response-hint text-xs mb-2">Click to respond:</p>
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
                              className="inspection-comm-option-btn w-full justify-start text-left h-auto py-2.5"
                            >
                              <div className="flex items-center gap-2 w-full">
                                <div className="inspection-comm-option-dot w-4 h-4 rounded-full border-2 flex-shrink-0" />
                                <span className="text-sm">{option.label}</span>
                              </div>
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <div className="inspection-comm-answered flex items-center gap-2 px-3 py-2 rounded">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                          <span className="text-sm">
                            {t('communicationPanel.youResponded')} <span className="font-semibold">{message.feedbackRequest.response?.label}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Text Messages */}
                  {message.messageType === "text" && (
                    <div className="inspection-comm-text-message border rounded-lg p-3 bg-white hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Avatar className="w-6 h-6">
                              <AvatarImage src={message.senderId?.avatar} />
                              <AvatarFallback className="text-xs">
                                {message.senderName.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{message.senderName}</p>
                              <p className="text-xs text-muted-foreground">{formatMessageTime(message.createdAt)}</p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-700 break-words whitespace-pre-wrap">
                            {message.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick Actions */}
                  {message.messageType === "quick_action" && message.quickAction && (
                    <div className={`inspection-comm-action-card border-l-4 rounded-r-lg p-4 transition-all ${
                      message.quickAction.status === "pending"
                        ? "is-pending"
                        : "is-completed"
                    }`}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="inspection-comm-action-icon w-4 h-4 flex-shrink-0" />
                            <p className="inspection-comm-action-title font-semibold text-sm">
                              {message.quickAction.actionLabel}
                            </p>
                          </div>
                          {message.quickAction.description && (
                            <p className="inspection-comm-action-description text-sm p-2 rounded mb-2 border">
                              {message.quickAction.description}
                            </p>
                          )}
                          <div className="inspection-comm-meta flex items-center gap-2 text-xs">
                            <User className="w-3 h-3" />
                            <span>{message.senderName}</span>
                            <Clock className="w-3 h-3 ml-2" />
                            <span>{formatMessageTime(message.createdAt)}</span>
                          </div>
                        </div>
                        {message.quickAction.status === "completed" && (
                          <Badge variant="default" className="inspection-comm-status gap-1 flex-shrink-0 text-xs">
                            <CheckCircle2 className="w-3 h-3" />
                            {t('communicationPanel.completed')}
                          </Badge>
                        )}
                        {message.quickAction.status === "pending" && (
                          <Badge variant="outline" className="inspection-comm-status gap-1 flex-shrink-0 text-xs">
                            ⏳ {t('communicationPanel.pending')}
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
          <div className="inspection-comm-empty flex flex-col items-center justify-center p-8 border rounded-lg bg-gray-50">
            <MessageCircle className="w-8 h-8 mb-2" />
            <p className="text-sm text-center">{t('communicationPanel.noCommunicationMessages')}</p>
          </div>
        )}
      </div>

      {/* Feedback Request Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="inspection-comm-dialog max-w-md">
          <DialogHeader>
            <DialogTitle className="inspection-comm-dialog-title flex items-center gap-2">
              <HelpCircle className="inspection-comm-dialog-icon w-5 h-5" />
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
                <span className={`inspection-comm-required text-xs ${feedbackQuestion.trim() ? "is-valid" : "is-empty"}`}>
                  {feedbackQuestion.trim() ? "✓" : "erforderlich"}
                </span>
              </Label>
              <Textarea
                id="question"
                placeholder={t('communicationPanel.exampleQuestion')}
                value={feedbackQuestion}
                onChange={(e) => setFeedbackQuestion(e.target.value)}
                className={`inspection-comm-input min-h-[80px] resize-none transition-colors ${
                  feedbackQuestion.trim()
                    ? "is-valid"
                    : "is-empty"
                }`}
              />
              <p className="inspection-comm-help text-xs">
                Stellen Sie eine klare Frage, die eine Ja/Nein- oder Multiple-Choice-Antwort erfordert. Beispiel: "Genehmigen Sie den Austausch der Batterie für 45 €?"
              </p>
            </div>

            <div className="inspection-comm-tips border rounded-lg p-3">
              <p className="inspection-comm-tips-title text-xs font-medium mb-2">Tipps für effektive Rückmeldungen:</p>
              <ul className="inspection-comm-tips-list text-xs space-y-1 list-disc list-inside">
                <li>Seien Sie spezifisch, was Sie vom Kunden brauchen</li>
                <li>Bieten Sie 2-4 klare Antwortoptionen an</li>
                <li>Vermeiden Sie offene Fragen</li>
              </ul>
            </div>

            {/* Dynamic Feedback Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Antwortoptionen ({feedbackOptions.filter(opt => opt.label.trim()).length} von {feedbackOptions.length})</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddFeedbackOption}
                  className="h-6 text-xs gap-1"
                  disabled={feedbackOptions.length >= 5}
                >
                  <Plus className="w-3 h-3" />
                  Option hinzufügen
                </Button>
              </div>

              {feedbackOptions.map((option, index) => (
                <div key={index} className="space-y-1 pb-2 border-b">
                  <Label htmlFor={`option-${index}`} className="text-xs flex items-center gap-2">
                    <span>Option {index + 1}</span>
                    {option.label.trim() && <span className="text-green-600">✓</span>}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id={`option-${index}`}
                      placeholder={`z.B. Ja, fortfahren / Nein, ablehnen`}
                      value={option.label}
                      onChange={(e) => handleUpdateFeedbackOption(index, 'label', e.target.value)}
                      className="flex-1 text-xs"
                    />
                    {feedbackOptions.length > 2 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveFeedbackOption(index)}
                        className="h-8 w-8 p-0"
                        title="Option entfernen"
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Preview Section */}
            {feedbackQuestion.trim() && feedbackOptions.filter(opt => opt.label.trim()).length >= 2 && (
              <div className="inspection-comm-preview border rounded-lg p-3">
                <p className="inspection-comm-preview-title text-xs font-medium mb-2">Vorschau:</p>
                <div className="inspection-comm-preview-content space-y-2 border-l-4 p-3 rounded bg-gray-50">
                  <p className="font-medium text-sm">{feedbackQuestion}</p>
                  <div className="space-y-1 text-xs">
                    {feedbackOptions.filter(opt => opt.label.trim()).map((option, idx) => (
                      <div key={idx} className="inspection-comm-preview-option flex items-center gap-2 p-2 rounded border bg-white">
                        <div className="inspection-comm-preview-dot w-3 h-3 rounded-full border" />
                        <span>{option.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFeedbackDialog(false)}
              disabled={sendingFeedback}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSendFeedback}
              disabled={sendingFeedback || !feedbackQuestion.trim() || feedbackOptions.filter(opt => opt.label.trim()).length < 2}
              className="gap-2"
            >
              {sendingFeedback ? (
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Action Dialog */}
      <Dialog open={showQuickActionDialog} onOpenChange={setShowQuickActionDialog}>
        <DialogContent className="inspection-comm-dialog max-w-md">
          <DialogHeader>
            <DialogTitle className="inspection-comm-dialog-title flex items-center gap-2">
              <AlertCircle className="inspection-comm-dialog-icon danger w-5 h-5" />
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
                <span className="inspection-comm-required text-xs is-empty">required</span>
              </Label>
              <select
                id="actionType"
                value={quickActionType}
                onChange={(e) => setQuickActionType(e.target.value as any)}
                className="inspection-comm-select w-full px-3 py-2 border rounded-md bg-white text-sm transition-colors"
              >
                {quickActionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Type Info Box */}
            <div className={`inspection-comm-action-type-box border rounded-lg p-3 text-xs transition-colors ${
              selectedQuickActionOption?.tone || 'is-cost'
            }`}>
              <p className="font-medium mb-2">
                {selectedQuickActionOption?.title}
              </p>
              <p className="opacity-75">
                {selectedQuickActionOption?.description}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="flex items-center gap-2">
                <span>{t('communicationPanel.description')}</span>
                <span className={`inspection-comm-required text-xs ${quickActionDescription.trim() ? "is-valid" : "is-empty"}`}>
                  {quickActionDescription.trim() ? "✓" : "required"}
                </span>
              </Label>
              <Textarea
                id="description"
                placeholder={t('communicationPanel.describeAction')}
                value={quickActionDescription}
                onChange={(e) => setQuickActionDescription(e.target.value)}
                className={`inspection-comm-input min-h-[100px] resize-none transition-colors ${
                  quickActionDescription.trim()
                    ? "is-valid"
                    : "is-empty"
                }`}
              />
              <p className="inspection-comm-help text-xs">
                Provide clear, specific details about the action and any next steps the customer needs to take. Be professional but friendly.
              </p>
            </div>

            {/* Preview Section */}
            {quickActionDescription.trim() && (
              <div className="inspection-comm-preview border rounded-lg p-3">
                <p className="inspection-comm-preview-title text-xs font-medium mb-2">Preview:</p>
                <div className={`inspection-comm-action-preview space-y-2 border-l-4 rounded p-3 ${
                  selectedQuickActionOption?.tone || 'is-cost'
                }`}>
                  <div className="flex items-start gap-2">
                    <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 inspection-comm-preview-icon ${
                      selectedQuickActionOption?.tone || 'is-cost'
                    }`} />
                    <div className="flex-1">
                      <p className={`font-medium text-sm mb-1 inspection-comm-preview-heading ${
                        selectedQuickActionOption?.tone || 'is-cost'
                      }`}>
                        {selectedQuickActionOption?.title}
                      </p>
                      <p className={`text-xs inspection-comm-preview-copy ${
                        selectedQuickActionOption?.tone || 'is-cost'
                      }`}>
                        {quickActionDescription}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowQuickActionDialog(false)}
              disabled={sendingQuickAction}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSendQuickAction}
              disabled={sendingQuickAction || !quickActionDescription.trim()}
              className="gap-2"
            >
              {sendingQuickAction ? (
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
