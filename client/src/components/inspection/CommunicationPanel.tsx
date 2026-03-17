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
import { CheckCircle2, MessageCircle, AlertCircle, Plus, Send, Clock, User, HelpCircle } from "lucide-react"
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
}

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
  const isUserEditingRef = useRef(false)

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
    isUserEditingRef.current =
      showFeedbackDialog ||
      showQuickActionDialog ||
      feedbackQuestion.trim().length > 0 ||
      feedbackOption1Label.trim().length > 0 ||
      feedbackOption2Label.trim().length > 0 ||
      quickActionDescription.trim().length > 0
  }, [
    showFeedbackDialog,
    showQuickActionDialog,
    feedbackQuestion,
    feedbackOption1Label,
    feedbackOption2Label,
    quickActionDescription,
  ])

  // Load communication thread
  useEffect(() => {
    let isActive = true

    const loadCommunication = async (silent = false) => {
      try {
        if (!isActive) return
        if (!silent) setLoading(true)
        const thread = await getCommunicationThread(orderId)
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
      <div className="inspection-comm-panel mt-4 space-y-3">
        <div className="inspection-comm-header flex items-center justify-between gap-2">
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
                  {feedbackQuestion.trim() ? "✓" : "required"}
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
                Ask a clear question that requires a yes/no or choice-based answer. Example: "Do you approve the $45 battery replacement?"
              </p>
            </div>

            <div className="inspection-comm-tips border rounded-lg p-3">
              <p className="inspection-comm-tips-title text-xs font-medium mb-2">Tips for effective feedback:</p>
              <ul className="inspection-comm-tips-list text-xs space-y-1 list-disc list-inside">
                <li>Be specific about what you need from the customer</li>
                <li>Offer 2-3 clear response options</li>
                <li>Avoid open-ended questions</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="option1" className="flex items-center gap-2">
                <span>{t('communicationPanel.firstOption')}</span>
                <span className={`inspection-comm-required text-xs ${feedbackOption1Label.trim() ? "is-valid" : "is-empty"}`}>
                  {feedbackOption1Label.trim() ? "✓" : "required"}
                </span>
              </Label>
              <Input
                id="option1"
                placeholder={t('communicationPanel.exampleOption1')}
                value={feedbackOption1Label}
                onChange={(e) => setFeedbackOption1Label(e.target.value)}
                className={`inspection-comm-input transition-colors ${
                  feedbackOption1Label.trim()
                    ? "is-valid"
                    : "is-empty"
                }`}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="option2" className="flex items-center gap-2">
                <span>{t('communicationPanel.secondOption')}</span>
                <span className={`inspection-comm-required text-xs ${feedbackOption2Label.trim() ? "is-valid" : "is-empty"}`}>
                  {feedbackOption2Label.trim() ? "✓" : "required"}
                </span>
              </Label>
              <Input
                id="option2"
                placeholder={t('communicationPanel.exampleOption2')}
                value={feedbackOption2Label}
                onChange={(e) => setFeedbackOption2Label(e.target.value)}
                className={`inspection-comm-input transition-colors ${
                  feedbackOption2Label.trim()
                    ? "is-valid"
                    : "is-empty"
                }`}
              />
            </div>

            {/* Preview Section */}
            {feedbackQuestion.trim() && (feedbackOption1Label.trim() || feedbackOption2Label.trim()) && (
              <div className="inspection-comm-preview border rounded-lg p-3">
                <p className="inspection-comm-preview-title text-xs font-medium mb-2">Preview:</p>
                <div className="inspection-comm-preview-content space-y-2 border-l-4 p-3 rounded">
                  <p className="font-medium text-sm">{feedbackQuestion}</p>
                  <div className="space-y-1 text-xs">
                    {feedbackOption1Label.trim() && (
                      <div className="inspection-comm-preview-option flex items-center gap-2 p-2 rounded border">
                        <div className="inspection-comm-preview-dot w-3 h-3 rounded-full border" />
                        <span>{feedbackOption1Label}</span>
                      </div>
                    )}
                    {feedbackOption2Label.trim() && (
                      <div className="inspection-comm-preview-option flex items-center gap-2 p-2 rounded border">
                        <div className="inspection-comm-preview-dot w-3 h-3 rounded-full border" />
                        <span>{feedbackOption2Label}</span>
                      </div>
                    )}
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
              disabled={sendingFeedback || !feedbackQuestion.trim() || !feedbackOption1Label.trim() || !feedbackOption2Label.trim()}
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
                <option value="part_replacement">{t('communicationPanel.partReplacementRequired')}</option>
                <option value="incorrect_device">{t('communicationPanel.incorrectDeviceSpecification')}</option>
                <option value="incorrect_unlock_code">{t('communicationPanel.incorrectUnlockCode')}</option>
                <option value="additional_costs">{t('communicationPanel.additionalCostsRequired')}</option>
              </select>
            </div>

            {/* Action Type Info Box */}
            <div className={`inspection-comm-action-type-box border rounded-lg p-3 text-xs transition-colors ${
              quickActionType === 'part_replacement'
                ? 'is-part'
                : quickActionType === 'incorrect_device'
                ? 'is-device'
                : quickActionType === 'incorrect_unlock_code'
                ? 'is-unlock'
                : 'is-cost'
            }`}>
              <p className="font-medium mb-2">
                {quickActionType === 'part_replacement' && '🔧 Part Replacement Required'}
                {quickActionType === 'incorrect_device' && '❌ Incorrect Device Specified'}
                {quickActionType === 'incorrect_unlock_code' && '🔐 Incorrect Unlock Code'}
                {quickActionType === 'additional_costs' && '💰 Additional Costs Required'}
              </p>
              <p className="opacity-75">
                {quickActionType === 'part_replacement' && 'Notify customer that additional parts need to be replaced to complete the repair'}
                {quickActionType === 'incorrect_device' && 'Notify customer that the device specifications provided do not match the device brought in'}
                {quickActionType === 'incorrect_unlock_code' && 'Notify customer that the unlock code provided is incorrect or does not work'}
                {quickActionType === 'additional_costs' && 'Notify customer of unexpected costs that require approval before proceeding'}
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
                  quickActionType === 'part_replacement'
                    ? 'is-part'
                    : quickActionType === 'incorrect_device'
                    ? 'is-device'
                    : quickActionType === 'incorrect_unlock_code'
                    ? 'is-unlock'
                    : 'is-cost'
                }`}>
                  <div className="flex items-start gap-2">
                    <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 inspection-comm-preview-icon ${
                      quickActionType === 'part_replacement'
                        ? 'is-part'
                        : quickActionType === 'incorrect_device'
                        ? 'is-device'
                        : quickActionType === 'incorrect_unlock_code'
                        ? 'is-unlock'
                        : 'is-cost'
                    }`} />
                    <div className="flex-1">
                      <p className={`font-medium text-sm mb-1 inspection-comm-preview-heading ${
                        quickActionType === 'part_replacement'
                          ? 'is-part'
                          : quickActionType === 'incorrect_device'
                          ? 'is-device'
                          : quickActionType === 'incorrect_unlock_code'
                          ? 'is-unlock'
                          : 'is-cost'
                      }`}>
                        {quickActionType === 'part_replacement' && '🔧 Part Replacement Required'}
                        {quickActionType === 'incorrect_device' && '❌ Device Mismatch'}
                        {quickActionType === 'incorrect_unlock_code' && '🔐 Unlock Code Issue'}
                        {quickActionType === 'additional_costs' && '💰 Additional Costs'}
                      </p>
                      <p className={`text-xs inspection-comm-preview-copy ${
                        quickActionType === 'part_replacement'
                          ? 'is-part'
                          : quickActionType === 'incorrect_device'
                          ? 'is-device'
                          : quickActionType === 'incorrect_unlock_code'
                          ? 'is-unlock'
                          : 'is-cost'
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
