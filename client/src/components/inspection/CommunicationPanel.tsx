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
  submitUnlockInfoUpdate,
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
import { CheckCircle2, MessageCircle, AlertCircle, Plus, Send, Clock, User, HelpCircle, X, Trash2, FileText, Maximize2, RefreshCw } from "lucide-react"
import { acceptComplaintOffer, rejectComplaintOffer } from "@/api/complaints"
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
  /**
   * "full" renders the complete thread inline (default).
   * "compact" renders only the latest message as a preview with a button
   * that opens the full conversation inside a larger dialog.
   */
  variant?: "full" | "compact"
  /** Controlled open state for the feedback dialog (optional – for external triggers) */
  feedbackOpen?: boolean
  onFeedbackOpenChange?: (open: boolean) => void
  /** Controlled open state for the quick-action dialog (optional – for external triggers) */
  quickActionOpen?: boolean
  onQuickActionOpenChange?: (open: boolean) => void
}

type OrderQuickActionType = 'part_replacement' | 'incorrect_device' | 'incorrect_unlock_code' | 'additional_costs'
type RepairRequestQuickActionType = 'parts_needed' | 'approval_required' | 'additional_cost' | 'status_update' | 'schedule_appointment'
type QuickActionType = OrderQuickActionType | RepairRequestQuickActionType

interface QuickActionOption {
  value: QuickActionType
  emoji: string
  tone: 'is-part' | 'is-device' | 'is-unlock' | 'is-cost'
}

const ORDER_QUICK_ACTION_OPTIONS: QuickActionOption[] = [
  { value: 'part_replacement', emoji: '🔧', tone: 'is-part' },
  { value: 'incorrect_device', emoji: '❌', tone: 'is-device' },
  { value: 'incorrect_unlock_code', emoji: '🔐', tone: 'is-unlock' },
  { value: 'additional_costs', emoji: '💰', tone: 'is-cost' },
]

const REPAIR_REQUEST_QUICK_ACTION_OPTIONS: QuickActionOption[] = [
  { value: 'parts_needed', emoji: '🔧', tone: 'is-part' },
  { value: 'approval_required', emoji: '✅', tone: 'is-device' },
  { value: 'additional_cost', emoji: '💰', tone: 'is-cost' },
  { value: 'status_update', emoji: '📌', tone: 'is-device' },
  { value: 'schedule_appointment', emoji: '📅', tone: 'is-unlock' },
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

function UnlockPatternGrid({
  pattern,
  onPatternChange,
  disabled,
}: {
  pattern: string[]
  onPatternChange: (p: string[]) => void
  disabled?: boolean
}) {
  const dots = [[1,2,3],[4,5,6],[7,8,9]]
  const handleDot = (d: number) => {
    if (disabled) return
    onPatternChange([...pattern, d.toString()])
  }
  return (
    <div className="space-y-1">
      <div className="inline-grid grid-cols-3 gap-2 bg-muted/40 rounded-lg p-3">
        {dots.flat().map((d) => {
          const count = pattern.filter((p) => p === d.toString()).length
          const active = count > 0
          return (
            <button
              key={d}
              type="button"
              onClick={() => handleDot(d)}
              disabled={disabled}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                active
                  ? 'bg-primary border-primary text-primary-foreground shadow-md'
                  : 'bg-background border-border text-muted-foreground hover:border-primary/60 hover:bg-primary/5'
              }`}
            >
              {active ? (count > 1 ? `${d}×${count}` : d) : d}
            </button>
          )
        })}
      </div>
      {pattern.length > 0 && (
        <button
          type="button"
          onClick={() => onPatternChange([])}
          disabled={disabled}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          ↩ Muster zurücksetzen
        </button>
      )}
    </div>
  )
}

export function CommunicationPanel({
  orderId,
  inspectionId,
  entityType = "order",
  variant = "full",
  feedbackOpen,
  onFeedbackOpenChange,
  quickActionOpen,
  onQuickActionOpenChange,
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
  const [_showFeedbackDialog, _setShowFeedbackDialog] = useState(false)
  const [_showQuickActionDialog, _setShowQuickActionDialog] = useState(false)
  // Support optional controlled mode from parent (for external trigger buttons)
  const showFeedbackDialog = feedbackOpen !== undefined ? feedbackOpen : _showFeedbackDialog
  const setShowFeedbackDialog = (v: boolean) => {
    _setShowFeedbackDialog(v)
    onFeedbackOpenChange?.(v)
  }
  const showQuickActionDialog = quickActionOpen !== undefined ? quickActionOpen : _showQuickActionDialog
  const setShowQuickActionDialog = (v: boolean) => {
    _setShowQuickActionDialog(v)
    onQuickActionOpenChange?.(v)
  }
  const [newMessage, setNewMessage] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)
  const [feedbackQuestion, setFeedbackQuestion] = useState("")
  const [feedbackOptions, setFeedbackOptions] = useState<Array<{ label: string; value: string }>>([
    { label: "", value: "" },
    { label: "", value: "" },
  ])
  const [quickActionType, setQuickActionType] = useState<QuickActionType>('part_replacement')
  const [quickActionDescription, setQuickActionDescription] = useState("")
  const [offerActionLoading, setOfferActionLoading] = useState<"accept" | "reject" | "">("")
  const [showFullChatDialog, setShowFullChatDialog] = useState(false)
  const [unlockUpdateForms, setUnlockUpdateForms] = useState<Record<string, {
    unlockCode: string
    unlockPattern: string[]
    noLock: boolean
    submitting: boolean
    selectedType: 'code' | 'pattern' | 'noLock'
  }>>({})
  const isUserEditingRef = useRef(false)
  const quickActionBaseOptions = entityType === "repair-request" ? REPAIR_REQUEST_QUICK_ACTION_OPTIONS : ORDER_QUICK_ACTION_OPTIONS
  const quickActionOptions = quickActionBaseOptions.map((option) => ({
    value: option.value,
    tone: option.tone,
    label: t(`communicationPanel.quickActions.${option.value}.label`),
    title: `${option.emoji} ${t(`communicationPanel.quickActions.${option.value}.title`)}`,
    description: t(`communicationPanel.quickActions.${option.value}.description`),
  }))
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

  const getUnlockUpdateForm = (messageId: string, defaultType: 'code' | 'pattern' | 'noLock') => {
    return unlockUpdateForms[messageId] ?? {
      unlockCode: '',
      unlockPattern: [],
      noLock: false,
      submitting: false,
      selectedType: defaultType,
    }
  }

  const updateUnlockForm = (messageId: string, patch: Partial<typeof unlockUpdateForms[string]>) => {
    setUnlockUpdateForms((prev) => ({
      ...prev,
      [messageId]: { ...(prev[messageId] ?? { unlockCode: '', unlockPattern: [], noLock: false, submitting: false, selectedType: 'code' }), ...patch },
    }))
  }

  const handleSubmitUnlockUpdate = async (messageId: string) => {
    const form = unlockUpdateForms[messageId]
    if (!form) return
    updateUnlockForm(messageId, { submitting: true })
    try {
      let payload: { unlockCode?: string; unlockPattern?: string[]; noLock?: boolean } = {}
      if (form.selectedType === 'noLock') {
        payload = { noLock: true }
      } else if (form.selectedType === 'pattern') {
        if (!form.unlockPattern || form.unlockPattern.length < 4) {
          toast({ title: 'Fehler', description: 'Bitte zeichnen Sie ein Entsperrmuster mit mindestens 4 Punkten.', variant: 'destructive' })
          updateUnlockForm(messageId, { submitting: false })
          return
        }
        payload = { unlockPattern: form.unlockPattern }
      } else {
        if (!form.unlockCode || form.unlockCode.trim().length === 0) {
          toast({ title: 'Fehler', description: 'Bitte geben Sie einen Entsperrcode ein.', variant: 'destructive' })
          updateUnlockForm(messageId, { submitting: false })
          return
        }
        payload = { unlockCode: form.unlockCode.trim() }
      }
      await submitUnlockInfoUpdate(orderId, payload)
      // Refresh thread
      const thread = await getInspectionCommunicationThread(orderId)
      setCommunication(thread)
      toast({ title: 'Erfolg', description: 'Entsperrinformation erfolgreich aktualisiert. Das Team wird benachrichtigt.' })
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message || 'Aktualisierung fehlgeschlagen', variant: 'destructive' })
      updateUnlockForm(messageId, { submitting: false })
    }
  }

  const handleAcceptRepairOffer = async (complaintId: string) => {
    try {
      setOfferActionLoading("accept")
      await acceptComplaintOffer(complaintId)
      // Refresh thread so the offer card shows accepted state
      const thread = entityType === "repair-request"
        ? await getRepairRequestCommunicationThread(orderId)
        : await getInspectionCommunicationThread(orderId)
      setCommunication(thread)
      toast({ title: "Angebot angenommen", description: "Der neue Reparaturauftrag wird erstellt." })
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message || "Aktion fehlgeschlagen", variant: "destructive" })
    } finally {
      setOfferActionLoading("")
    }
  }

  const handleRejectRepairOffer = async (complaintId: string) => {
    try {
      setOfferActionLoading("reject")
      await rejectComplaintOffer(complaintId)
      const thread = entityType === "repair-request"
        ? await getRepairRequestCommunicationThread(orderId)
        : await getInspectionCommunicationThread(orderId)
      setCommunication(thread)
      toast({ title: "Angebot abgelehnt", description: "Die Reklamation wird geschlossen." })
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message || "Aktion fehlgeschlagen", variant: "destructive" })
    } finally {
      setOfferActionLoading("")
    }
  }

  // Check if user is staff or admin
  const isStaffOrAdmin = user?.role === 'staff' || user?.role === 'admin'
  const canSendMessages = Boolean(user?.role)

  if (loading) {
    return null // Don't show while loading
  }

  // Filter to include text messages, feedback_request, quick_action and repair_offer messages
  const communicationMessages = communication?.messages.filter((msg) =>
    ["text", "feedback_request", "quick_action", "repair_offer"].includes(msg.messageType)
  ) || []

  // Show panel if there are communication messages OR if user can compose new ones.
  const shouldShowPanel = communicationMessages.length > 0 || canSendMessages

  if (!shouldShowPanel) {
    return null
  }

  const lastMessage = communicationMessages[communicationMessages.length - 1]
  const pendingTotal =
    (communication?.pendingFeedbackCount || 0) + (communication?.pendingActionsCount || 0)

  const getMessageSnippet = (message?: Message): string => {
    if (!message) return ""
    switch (message.messageType) {
      case "feedback_request":
        return message.feedbackRequest?.question || ""
      case "quick_action":
        return [message.quickAction?.actionLabel, message.quickAction?.description]
          .filter(Boolean)
          .join(" – ")
      case "repair_offer": {
        const meta = message.metadata as
          | { offerAmount?: number; offerDescription?: string }
          | undefined
        if (meta?.offerDescription) return meta.offerDescription
        if (meta?.offerAmount != null) return `Reparaturangebot: ${meta.offerAmount.toFixed(2)} €`
        return "Reparaturangebot"
      }
      default:
        return message.content || ""
    }
  }

  const getMessageTypeLabel = (message?: Message): string | null => {
    switch (message?.messageType) {
      case "feedback_request":
        return t('communicationPanel.feedback')
      case "quick_action":
        return t('communicationPanel.action')
      case "repair_offer":
        return "Angebot"
      default:
        return null
    }
  }

  const panelBody = (
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
                  className="h-7 px-2 text-xs gap-1"
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
                          {message.feedbackRequest.status === "pending" ? `⏳ ${t('communicationPanel.pending')}` : `✓ ${t('communicationPanel.answered')}`}
                        </Badge>
                      </div>

                      {message.feedbackRequest.status === "pending" ? (
                        <div className="space-y-2">
                          <p className="inspection-comm-response-hint text-xs mb-2">{t('communicationPanel.clickToRespond')}</p>
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
                  {message.messageType === "quick_action" && message.quickAction && (() => {
                    const qa = message.quickAction
                    const isUpdateUnlockInfo = qa.actionType === 'update_unlock_info'
                    const isCustomerUser = user?.role === 'customer'
                    const isPending = qa.status === 'pending'
                    const defaultUnlockType = (qa.metadata as any)?.unlockType === 'pattern' ? 'pattern' : 'code'
                    const form = getUnlockUpdateForm(message._id, defaultUnlockType as 'code' | 'pattern' | 'noLock')

                    if (isUpdateUnlockInfo) {
                      return (
                        <div className={`rounded-lg border-l-4 p-4 transition-colors ${
                          isPending ? 'border-l-red-500 bg-red-50/60 border border-red-200' : 'border-l-emerald-500 bg-emerald-50/40 border border-emerald-200'
                        }`}>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <RefreshCw className="w-4 h-4 flex-shrink-0 text-red-600" />
                                <p className="font-semibold text-sm text-foreground">
                                  Entsperrinformation aktualisieren
                                </p>
                              </div>
                              {qa.description && (
                                <p className="text-sm text-foreground/80 mb-1">{qa.description}</p>
                              )}
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                <span>{formatMessageTime(message.createdAt)}</span>
                              </div>
                            </div>
                            {isPending ? (
                              <Badge variant="outline" className="gap-1 flex-shrink-0 text-xs border-red-300 bg-red-100 text-red-800">
                                ⏳ Ausstehend
                              </Badge>
                            ) : (
                              <Badge className="gap-1 flex-shrink-0 text-xs border border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                <CheckCircle2 className="w-3 h-3" />
                                Erledigt
                              </Badge>
                            )}
                          </div>

                          {isPending && isCustomerUser && (
                            <div className="mt-3 space-y-3">
                              {/* Type selector */}
                              <div className="flex gap-2 flex-wrap">
                                {(['code', 'pattern', 'noLock'] as const).map((type) => (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => updateUnlockForm(message._id, { selectedType: type })}
                                    disabled={form.submitting}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                                      form.selectedType === type
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-background text-foreground border-border hover:bg-muted'
                                    }`}
                                  >
                                    {type === 'code' && '🔢 Entsperrcode'}
                                    {type === 'pattern' && '🔷 Entsperrmuster'}
                                    {type === 'noLock' && '✅ Keine Sperre'}
                                  </button>
                                ))}
                              </div>

                              {form.selectedType === 'code' && (
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-foreground/70">Entsperrcode (PIN oder Passwort)</label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="Entsperrcode eingeben …"
                                    value={form.unlockCode}
                                    onChange={(e) => updateUnlockForm(message._id, { unlockCode: e.target.value })}
                                    disabled={form.submitting}
                                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                                  />
                                </div>
                              )}

                              {form.selectedType === 'pattern' && (
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-foreground/70">
                                    Entsperrmuster zeichnen
                                    {form.unlockPattern.length > 0 && (
                                      <span className="ml-2 text-primary">{form.unlockPattern.join(' → ')}</span>
                                    )}
                                  </label>
                                  <UnlockPatternGrid
                                    pattern={form.unlockPattern}
                                    onPatternChange={(p) => updateUnlockForm(message._id, { unlockPattern: p })}
                                    disabled={form.submitting}
                                  />
                                </div>
                              )}

                              {form.selectedType === 'noLock' && (
                                <p className="text-sm text-foreground/70 bg-muted/50 rounded-md px-3 py-2">
                                  Ihr Gerät wird als <strong>entsperrt / ohne Sperre</strong> markiert.
                                </p>
                              )}

                              <Button
                                size="sm"
                                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                                disabled={form.submitting}
                                onClick={() => handleSubmitUnlockUpdate(message._id)}
                              >
                                {form.submitting ? (
                                  <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Wird gesendet …</>
                                ) : (
                                  <><Send className="w-3.5 h-3.5 mr-1.5" /> Entsperrinformation senden</>
                                )}
                              </Button>
                            </div>
                          )}

                          {isPending && !isCustomerUser && (
                            <p className="text-xs text-muted-foreground mt-2">Wartet auf Rückmeldung des Kunden.</p>
                          )}
                        </div>
                      )
                    }

                    return (
                      <div className={`rounded-lg border p-4 transition-colors ${
                        isPending ? "border-amber-300 bg-amber-50/50" : "border-emerald-300 bg-emerald-50/40"
                      }`}>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertCircle className="w-4 h-4 flex-shrink-0 text-primary" />
                              <p className="font-semibold text-sm text-foreground">
                                {qa.actionLabel}
                              </p>
                            </div>
                            {qa.description && (
                              <p className="text-sm p-2 rounded mb-2 border bg-background text-foreground/90">
                                {qa.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <User className="w-3 h-3" />
                              <span>{message.senderName}</span>
                              <Clock className="w-3 h-3 ml-2" />
                              <span>{formatMessageTime(message.createdAt)}</span>
                            </div>
                          </div>
                          {qa.status === "completed" && (
                            <Badge className="gap-1 flex-shrink-0 text-xs border border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                              <CheckCircle2 className="w-3 h-3" />
                              {t('communicationPanel.completed')}
                            </Badge>
                          )}
                          {isPending && (
                            <Badge variant="outline" className="gap-1 flex-shrink-0 text-xs border-amber-300 bg-amber-100 text-amber-800">
                              ⏳ {t('communicationPanel.pending')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Repair Offer Messages */}
                  {message.messageType === "repair_offer" && message.metadata && (() => {
                    const offerMeta = message.metadata as { complaintId: string; offerAmount: number; offerDescription: string; status: string }
                    const isPending = offerMeta.status === 'pending'
                    const isAccepted = offerMeta.status === 'accepted'
                    const isCustomerUser = user?.role === 'customer'

                    return (
                      <div className={`inspection-comm-feedback-card border-l-4 rounded-r-lg p-4 transition-all ${
                        isPending ? 'border-rose-400 bg-rose-50' : isAccepted ? 'border-green-400 bg-green-50' : 'border-slate-300 bg-slate-50'
                      }`}>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="w-4 h-4 text-rose-600 flex-shrink-0" />
                              <p className="font-semibold text-sm">Neues Reparaturangebot</p>
                            </div>
                            <p className="text-sm text-gray-700 mb-2">{offerMeta.offerDescription}</p>
                            <p className="text-base font-bold text-rose-700">{offerMeta.offerAmount.toFixed(2)} €</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatMessageTime(message.createdAt)}</span>
                            </div>
                          </div>
                          <Badge
                            className={`text-xs flex-shrink-0 ${
                              isAccepted ? 'bg-green-100 text-green-800 border-green-300' :
                              offerMeta.status === 'rejected' ? 'bg-slate-100 text-slate-700 border-slate-300' :
                              'bg-rose-100 text-rose-800 border-rose-300'
                            } border`}
                          >
                            {isPending ? '⏳ Ausstehend' : isAccepted ? '✓ Angenommen' : '✗ Abgelehnt'}
                          </Badge>
                        </div>

                        {isPending && isCustomerUser && (
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                              disabled={offerActionLoading !== ""}
                              onClick={() => handleAcceptRepairOffer(offerMeta.complaintId)}
                            >
                              {offerActionLoading === "accept" ? "..." : "✓ Angebot annehmen"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 border-rose-400 text-rose-700 hover:bg-rose-50 h-8 text-xs"
                              disabled={offerActionLoading !== ""}
                              onClick={() => handleRejectRepairOffer(offerMeta.complaintId)}
                            >
                              {offerActionLoading === "reject" ? "..." : "✗ Angebot ablehnen"}
                            </Button>
                          </div>
                        )}

                        {isPending && !isCustomerUser && (
                          <p className="text-xs text-muted-foreground mt-1">Warte auf Kundenentscheidung.</p>
                        )}

                        {!isPending && (
                          <div className={`flex items-center gap-2 px-3 py-2 rounded text-xs mt-1 ${
                            isAccepted ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                            <span>{isAccepted ? 'Angebot wurde angenommen' : 'Angebot wurde abgelehnt'}</span>
                          </div>
                        )}
                      </div>
                    )
                  })()}
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

        {/* Message Input Area */}
        {canSendMessages && (
          <div className={`inspection-comm-input-section border rounded-lg p-3 ${isStaffOrAdmin ? 'bg-blue-50' : 'bg-white'}`}>
            <Label htmlFor="message-input" className="text-xs font-semibold mb-2 block">
              {isStaffOrAdmin ? 'Nachricht senden' : 'Nachricht an das Reparaturteam'}
            </Label>
            <div className="flex gap-2">
              <Textarea
                id="message-input"
                placeholder={isStaffOrAdmin ? 'Nachricht eingeben...' : 'Ihre Nachricht an das Reparaturteam...'}
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
      </div>
  )

  const compactPreview = (
    <div className="rounded-xl border border-[#1a2a5e]/15 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gradient-to-r from-[#1a2a5e] to-[#0f1d45]">
        <div className="flex items-center gap-2 text-white">
          <MessageCircle className="w-4 h-4 text-[#f5b800]" />
          <span className="text-sm font-semibold">
            {t('communicationPanel.communicationAndFeedback')}
          </span>
        </div>
        {pendingTotal > 0 && (
          <span className="inline-flex items-center rounded-full bg-[#f5b800] px-2 py-0.5 text-[11px] font-semibold text-[#1a2a5e]">
            {pendingTotal} {t('communicationPanel.pending')}
          </span>
        )}
      </div>

      <div className="p-3">
        {lastMessage ? (
          <div className="flex items-start gap-3">
            <Avatar className="w-8 h-8 border border-[#1a2a5e]/15">
              <AvatarImage src={lastMessage.senderId?.avatar} />
              <AvatarFallback className="bg-[#1a2a5e]/10 text-[#1a2a5e] text-xs font-semibold">
                {lastMessage.senderName?.split(' ').map((n: string) => n[0]).join('').substring(0, 2) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-[#1a2a5e] truncate">{lastMessage.senderName}</p>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap">
                  <Clock className="w-3 h-3" />
                  {formatMessageTime(lastMessage.createdAt)}
                </span>
              </div>
              {getMessageTypeLabel(lastMessage) && (
                <span className="mt-0.5 inline-flex items-center rounded-full border border-[#1a2a5e]/20 bg-[#1a2a5e]/5 px-2 py-0.5 text-[10px] font-medium text-[#1a2a5e]">
                  {getMessageTypeLabel(lastMessage)}
                </span>
              )}
              <p className="mt-1 text-xs text-gray-600 line-clamp-2 break-words whitespace-pre-wrap">
                {getMessageSnippet(lastMessage)}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <MessageCircle className="w-4 h-4" />
            {t('communicationPanel.noCommunicationMessages')}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[#1a2a5e]/10 bg-[#f8f9fc] px-3 py-2">
        <span className="text-[11px] text-muted-foreground">
          {communicationMessages.length > 1
            ? `+${communicationMessages.length - 1} weitere Nachrichten`
            : 'Nur die letzte Nachricht wird angezeigt'}
        </span>
        <Button
          size="sm"
          onClick={() => setShowFullChatDialog(true)}
          className="h-8 gap-1.5 bg-[#1a2a5e] hover:bg-[#0f1d45] text-white text-xs font-semibold"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          Gesamten Chatverlauf öffnen
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {variant === "compact" ? compactPreview : panelBody}

      {variant === "compact" && (
        <Dialog open={showFullChatDialog} onOpenChange={setShowFullChatDialog}>
          <DialogContent className="order-dialog-content inspection-comm-dialog w-[calc(100vw-12px)] sm:max-w-3xl max-h-[92dvh] overflow-hidden flex flex-col p-0 gap-0">
            <DialogHeader className="space-y-1 border-b border-[#0f1d45] px-4 py-3 bg-gradient-to-r from-[#1a2a5e] to-[#0f1d45]">
              <DialogTitle className="text-base flex items-center gap-2 text-white">
                <MessageCircle className="w-5 h-5 text-[#f5b800]" />
                Kundenkommunikation
              </DialogTitle>
              <DialogDescription className="text-xs text-white/80">
                Vollständiger Chatverlauf mit allen Nachrichten, Rückfragen und Aktionen.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {panelBody}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Feedback Request Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="order-dialog-content inspection-comm-dialog w-[calc(100vw-12px)] sm:max-w-2xl max-h-[92dvh] overflow-hidden flex flex-col">
          <DialogHeader className="order-dialog-header space-y-1 border-b pb-3">
            <DialogTitle className="text-base flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-primary" />
              {t('communicationPanel.sendFeedbackRequest')}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t('communicationPanel.askCustomerFeedback')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1 overflow-y-auto flex-1 pr-1">
            <section className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <Label htmlFor="question" className="flex items-center justify-between gap-2 text-xs font-medium">
                <span>{t('communicationPanel.question')}</span>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${feedbackQuestion.trim() ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
                  {feedbackQuestion.trim() ? 'Ausgefüllt' : 'Pflichtfeld'}
                </span>
              </Label>
              <Textarea
                id="question"
                placeholder={t('communicationPanel.exampleQuestion')}
                value={feedbackQuestion}
                onChange={(e) => setFeedbackQuestion(e.target.value)}
                className={`min-h-[88px] resize-none text-xs ${
                  feedbackQuestion.trim()
                    ? 'border-emerald-300 focus-visible:ring-emerald-500/30'
                    : 'border-amber-300 focus-visible:ring-amber-500/30'
                }`}
              />
              <p className="text-xs text-muted-foreground">
                Stellen Sie eine klare Frage, die eine Ja/Nein- oder Multiple-Choice-Antwort erfordert. Beispiel: "Genehmigen Sie den Austausch der Batterie für 45 €?"
              </p>
            </section>

            <section className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
              <p className="text-xs font-medium text-blue-900 mb-2">Tipps für effektive Rückmeldungen:</p>
              <ul className="text-xs space-y-1 list-disc list-inside text-blue-900/90">
                <li>Seien Sie spezifisch, was Sie vom Kunden brauchen</li>
                <li>Bieten Sie 2-4 klare Antwortoptionen an</li>
                <li>Vermeiden Sie offene Fragen</li>
              </ul>
            </section>

            {/* Dynamic Feedback Options */}
            <section className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Antwortoptionen ({feedbackOptions.filter(opt => opt.label.trim()).length} von {feedbackOptions.length})</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddFeedbackOption}
                  className="h-7 text-xs gap-1"
                  disabled={feedbackOptions.length >= 5}
                >
                  <Plus className="w-3 h-3" />
                  Option hinzufügen
                </Button>
              </div>

              {feedbackOptions.map((option, index) => (
                <div key={index} className="space-y-1 rounded-md border bg-background p-2">
                  <Label htmlFor={`option-${index}`} className="text-xs flex items-center gap-2 font-medium">
                    <span>Option {index + 1}</span>
                    {option.label.trim() && <span className="text-emerald-600">✓</span>}
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
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Option entfernen"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </section>

            {/* Preview Section */}
            {feedbackQuestion.trim() && feedbackOptions.filter(opt => opt.label.trim()).length >= 2 && (
              <section className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium mb-2">Vorschau:</p>
                <div className="space-y-2 border-l-2 border-primary/30 p-3 rounded bg-background">
                  <p className="font-medium text-sm">{feedbackQuestion}</p>
                  <div className="space-y-1 text-xs">
                    {feedbackOptions.filter(opt => opt.label.trim()).map((option, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded border bg-background">
                        <div className="w-3 h-3 rounded-full border border-muted-foreground/50" />
                        <span>{option.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>

          <DialogFooter className="border-t pt-3 mt-2 bg-background sticky bottom-0 z-10">
            <Button
              variant="outline"
              onClick={() => setShowFeedbackDialog(false)}
              disabled={sendingFeedback}
              size="sm"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSendFeedback}
              disabled={sendingFeedback || !feedbackQuestion.trim() || feedbackOptions.filter(opt => opt.label.trim()).length < 2}
              className="gap-2"
              size="sm"
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
        <DialogContent className="order-dialog-content inspection-comm-dialog w-[calc(100vw-12px)] sm:max-w-2xl max-h-[92dvh] overflow-hidden flex flex-col">
          <DialogHeader className="order-dialog-header space-y-1 border-b pb-3">
            <DialogTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-primary" />
              {t('communicationPanel.sendQuickAction')}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t('communicationPanel.notifyCustomerAction')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1 pr-1 pt-1">
            <section className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <Label htmlFor="actionType" className="flex items-center justify-between gap-2 text-xs font-medium">
                <span>{t('communicationPanel.actionType')}</span>
                <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] border-amber-300 bg-amber-50 text-amber-700">
                  {t('communicationPanel.required')}
                </span>
              </Label>
              <select
                id="actionType"
                value={quickActionType}
                onChange={(e) => setQuickActionType(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-md bg-background text-xs transition-colors"
              >
                {quickActionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </section>

            {/* Action Type Info Box */}
            <section className="border rounded-lg p-3 text-xs transition-colors bg-muted/20">
              <p className="font-medium mb-2 text-sm">
                {selectedQuickActionOption?.title}
              </p>
              <p className="text-muted-foreground">
                {selectedQuickActionOption?.description}
              </p>
            </section>

            <section className="space-y-2 rounded-lg border p-3">
              <Label htmlFor="description" className="flex items-center justify-between gap-2 text-xs font-medium">
                <span>{t('communicationPanel.description')}</span>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${quickActionDescription.trim() ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
                  {quickActionDescription.trim() ? 'Ausgefüllt' : t('communicationPanel.required')}
                </span>
              </Label>
              <Textarea
                id="description"
                placeholder={t('communicationPanel.describeAction')}
                value={quickActionDescription}
                onChange={(e) => setQuickActionDescription(e.target.value)}
                className={`min-h-[100px] resize-none text-xs transition-colors ${
                  quickActionDescription.trim()
                    ? 'border-emerald-300 focus-visible:ring-emerald-500/30'
                    : 'border-amber-300 focus-visible:ring-amber-500/30'
                }`}
              />
              <p className="inspection-comm-help text-xs text-muted-foreground">
                {t('communicationPanel.actionDescriptionHelp')}
              </p>
            </section>

            {/* Preview Section */}
            {quickActionDescription.trim() && (
              <section className="inspection-comm-preview border rounded-lg bg-muted/20 p-3">
                <p className="inspection-comm-preview-title text-xs font-medium mb-2">{t('communicationPanel.preview')}</p>
                <div className="space-y-2 border-l-2 border-primary/30 rounded p-3 bg-background">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium text-sm mb-1 text-foreground">
                        {selectedQuickActionOption?.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {quickActionDescription}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>

          <DialogFooter className="border-t pt-3 mt-2 bg-background sticky bottom-0 z-10">
            <Button
              variant="outline"
              onClick={() => setShowQuickActionDialog(false)}
              disabled={sendingQuickAction}
              size="sm"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSendQuickAction}
              disabled={sendingQuickAction || !quickActionDescription.trim()}
              className="gap-2"
              size="sm"
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
