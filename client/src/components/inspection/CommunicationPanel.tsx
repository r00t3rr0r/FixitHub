import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/useToast"
import {
  getCommunicationThreadWithNotes,
  respondToFeedback as respondToInspectionFeedback,
  markMessagesAsRead as markInspectionMessagesAsRead,
  sendFeedbackRequest as sendInspectionFeedbackRequest,
  createQuickAction as createInspectionQuickAction,
  completeQuickAction as completeInspectionQuickAction,
  sendMessage as sendInspectionMessage,
  addInternalNote,
  submitUnlockInfoUpdate,
  InternalNote,
} from "@/api/inspectionCommunication"
import {
  getCommunicationThread as getRepairRequestCommunicationThread,
  respondToFeedback as respondToRepairRequestFeedback,
  markMessagesAsRead as markRepairRequestMessagesAsRead,
  sendFeedbackRequest as sendRepairRequestFeedbackRequest,
  createQuickAction as createRepairRequestQuickAction,
  completeQuickAction as completeRepairRequestQuickAction,
  sendMessage as sendRepairRequestMessage,
} from "@/api/repairRequestCommunication"
import { getUserProfile, UserProfile } from "@/api/user"
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  HelpCircle,
  Inbox,
  Lock,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  UserRound,
} from "lucide-react"
import { acceptComplaintOffer, rejectComplaintOffer } from "@/api/complaints"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

/**
 * Gemeinsamer Gesprächsbereich (Auftrag oder Reparaturanfrage) für Kunden UND Personal.
 * Eingebettet in: Postfach (/messages), Auftragsdetail (Kunde + Admin), Inspektion,
 * Buchungs-/Termin-Modal, Reparaturanfrage-Details.
 *
 * Personal schreibt mit EINDEUTIGER Zielgruppe:
 *   - "Nachricht an Kunden"      -> Badge "An Kunden", Kunde sieht sie und erhält eine E-Mail
 *   - "Interne Notiz" (Auftrag)  -> Badge "Intern – nur für das Team", Kunde sieht nichts
 *   - "Rückfrage an Kunden"      -> strukturierte Frage mit Antwortoptionen
 *   - "Aktion anfordern"         -> Aktion, die der Kunde erledigen muss
 * Rückfrage und Aktion sind Composer-Modi (keine zweiten, verschachtelten Dialoge mehr).
 */
interface CommunicationPanelProps {
  orderId: string
  /** Nur wenn bekannt (Inspektionsseite). Der Server übernimmt ausschließlich eine Inspektion DIESES Auftrags. */
  inspectionId?: string
  entityType?: "order" | "repair-request"
  /**
   * "full" zeigt den kompletten Verlauf (Standard).
   * "compact" zeigt die letzte Nachricht; "Gesamten Verlauf anzeigen" klappt den Verlauf
   * inline auf (kein zweiter Dialog). Die Vorschau markiert NICHTS als gelesen.
   */
  variant?: "full" | "compact"
  /**
   * "inline" (Standard): Verlauf max. min(450px, 55vh) hoch, kurze Verläufe bleiben kurz.
   * "fill": füllt den Elterncontainer (flex, min-h-0); Verlauf scrollt, Eingabe bleibt unten sichtbar.
   */
  layout?: "inline" | "fill"
  /** Der Container zeigt bereits eine Überschrift - keine zweite Titelzeile im Panel. */
  hideTitle?: boolean
  /** Verlauf beim Anzeigen für DIESEN Benutzer als gelesen markieren (Standard: true; compact erst nach Aufklappen). */
  markReadOnView?: boolean
  /** Wird nach erfolgreichem Markieren als gelesen aufgerufen (z. B. Postfach-Zähler neu laden). */
  onRead?: () => void
  /** Wird nach einer erfolgreich gesendeten Nachricht / Notiz / Rückfrage / Aktion aufgerufen. */
  onSent?: () => void
  /** Externe Auslöser (z. B. Kopfzeilen-Buttons): schalten den Composer in den Modus "Rückfrage" bzw. "Aktion". */
  feedbackOpen?: boolean
  onFeedbackOpenChange?: (open: boolean) => void
  quickActionOpen?: boolean
  onQuickActionOpenChange?: (open: boolean) => void
  /**
   * Meldet nach jedem geänderten Verlauf, was beim KUNDEN noch offen ist (unbeantwortete
   * Rückfragen, offene Aktionen, offene Angebote) - so braucht z. B. die Auftragsdetailseite
   * für ihren "Nächster Schritt" keinen zweiten Abruf desselben Verlaufs.
   */
  onThreadChange?: (pending: { questions: number; actions: number; offers: number }) => void
}

type OrderQuickActionType = 'part_replacement' | 'incorrect_device' | 'incorrect_unlock_code' | 'additional_costs'
type RepairRequestQuickActionType = 'parts_needed' | 'approval_required' | 'additional_cost' | 'status_update' | 'schedule_appointment'
type QuickActionType = OrderQuickActionType | RepairRequestQuickActionType
type ComposerMode = 'message' | 'internal' | 'question' | 'action'

const ORDER_QUICK_ACTIONS: OrderQuickActionType[] = ['part_replacement', 'incorrect_device', 'incorrect_unlock_code', 'additional_costs']
const REPAIR_REQUEST_QUICK_ACTIONS: RepairRequestQuickActionType[] = ['parts_needed', 'approval_required', 'additional_cost', 'status_update', 'schedule_appointment']

interface PanelMessage {
  _id: string
  senderId?: { _id?: string; name?: string; email?: string; avatar?: string } | string | null
  senderUserId?: string | null
  senderName: string
  senderType: "staff" | "customer" | "system"
  senderRole?: string
  messageType: "text" | "feedback_request" | "quick_action" | "system_notification" | "repair_offer"
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
    description?: string
    status: "pending" | "completed" | "cancelled"
    metadata?: any
    completedAt?: string
  }
  metadata?: Record<string, any>
  createdAt: string
  updatedAt?: string
  readBy?: Array<{ userId: any; readAt: string }>
}

interface PanelThread {
  _id: string
  messages: PanelMessage[]
  pendingFeedbackCount?: number
  pendingActionsCount?: number
}

type ThreadEntry =
  | { kind: 'message'; key: string; createdAt: string; message: PanelMessage }
  | { kind: 'internal'; key: string; createdAt: string; note: InternalNote }

const VISIBLE_MESSAGE_TYPES = ["text", "feedback_request", "quick_action", "repair_offer", "system_notification"]

// Antworten werden mit JSONbig geparst (Objekte ohne Prototyp): String(objekt) wirft dort einen
// TypeError. Eingebettete Absender ohne Id (z. B. Gaeste in Reparaturanfragen: {name, email})
// liefern deshalb '' statt den Verlauf abstuerzen zu lassen.
const idOf = (value: any): string => {
  if (!value) return ''
  if (typeof value === 'object') {
    if (value._id) return idOf(value._id)
    if (value.id) return idOf(value.id)
    return typeof value.toHexString === 'function' ? value.toHexString() : ''
  }
  return String(value)
}

const newDraftId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
      return `draft-${(crypto as any).randomUUID()}`
    }
  } catch {
    /* Fallback unten */
  }
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

// Nur geänderte Verläufe übernehmen (verhindert unnötiges Neurendern beim Polling).
const threadSignature = (thread: PanelThread | null, notes: InternalNote[] | null) => {
  const messages = thread?.messages || []
  const last = messages[messages.length - 1]
  return [
    messages.length,
    last?._id,
    last?.updatedAt,
    thread?.pendingFeedbackCount || 0,
    thread?.pendingActionsCount || 0,
    messages.filter((m) => m.feedbackRequest?.status === 'responded').length,
    messages.filter((m) => m.quickAction?.status === 'completed').length,
    messages.filter((m) => m.metadata?.status && m.messageType === 'repair_offer').map((m) => m.metadata?.status).join(','),
    (notes || []).length,
  ].join('|')
}

// Deutsche Zeitangaben ("gerade eben", "vor 5 Min.", "gestern", sonst Datum).
const formatMessageTime = (dateString?: string | null): string => {
  if (!dateString) return 'Zeitpunkt unbekannt'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return 'Zeitpunkt unbekannt'
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'gerade eben'
  if (diffMins < 60) return `vor ${diffMins} Min.`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `vor ${diffHours} Std.`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'gestern'
  if (diffDays < 7) return `vor ${diffDays} Tagen`
  return date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const formatAbsolute = (dateString?: string | null) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('de-DE')
}

const formatEuro = (value: unknown) =>
  Number(value || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

function UnlockPatternGrid({
  pattern,
  onPatternChange,
  disabled,
}: {
  pattern: string[]
  onPatternChange: (p: string[]) => void
  disabled?: boolean
}) {
  const dots = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
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
              aria-label={`Punkt ${d}`}
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
          Muster zurücksetzen
        </button>
      )}
    </div>
  )
}

// Absender-Kennzeichnung: Text + Farbe (Farbe ist nie das einzige Merkmal).
function SenderBadge({ type }: { type: 'customer' | 'staff' | 'system' | 'internal' }) {
  const styles: Record<string, string> = {
    customer: 'border-sky-300 bg-sky-50 text-sky-800',
    staff: 'border-indigo-300 bg-indigo-50 text-indigo-800',
    system: 'border-slate-300 bg-slate-50 text-slate-700',
    internal: 'border-amber-400 bg-amber-100 text-amber-900',
  }
  const labels: Record<string, string> = { customer: 'Kunde', staff: 'Team', system: 'System', internal: 'Intern' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${styles[type]}`}>
      {type === 'internal' && <Lock className="h-3 w-3" aria-hidden="true" />}
      {labels[type]}
    </span>
  )
}

export function CommunicationPanel({
  orderId,
  inspectionId,
  entityType = "order",
  variant = "full",
  layout = "inline",
  hideTitle = false,
  markReadOnView = true,
  onRead,
  onSent,
  feedbackOpen,
  onFeedbackOpenChange,
  quickActionOpen,
  onQuickActionOpenChange,
  onThreadChange,
}: CommunicationPanelProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [thread, setThread] = useState<PanelThread | null>(null)
  const [internalNotes, setInternalNotes] = useState<InternalNote[] | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [expanded, setExpanded] = useState(variant !== 'compact')
  const [mode, setMode] = useState<ComposerMode>('message')
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [responding, setResponding] = useState(false)
  const [feedbackQuestion, setFeedbackQuestion] = useState('')
  const [feedbackOptions, setFeedbackOptions] = useState<Array<{ label: string; value: string }>>([
    { label: 'Ja', value: 'ja' },
    { label: 'Nein', value: 'nein' },
  ])
  const quickActionValues: QuickActionType[] = entityType === 'repair-request' ? REPAIR_REQUEST_QUICK_ACTIONS : ORDER_QUICK_ACTIONS
  const [quickActionType, setQuickActionType] = useState<QuickActionType>(quickActionValues[0])
  const [quickActionDescription, setQuickActionDescription] = useState('')
  const [offerActionLoading, setOfferActionLoading] = useState<"accept" | "reject" | "">("")
  const [unlockUpdateForms, setUnlockUpdateForms] = useState<Record<string, {
    unlockCode: string
    unlockPattern: string[]
    noLock: boolean
    submitting: boolean
    selectedType: 'code' | 'pattern' | 'noLock'
  }>>({})

  const isUserEditingRef = useRef(false)
  const submittingRef = useRef(false)
  const draftIdRef = useRef<string>(newDraftId())
  const signatureRef = useRef('')
  const lastMarkedRef = useRef('')
  const threadScrollRef = useRef<HTMLDivElement | null>(null)

  const isStaffOrAdmin = user?.role === 'staff' || user?.role === 'admin'
  const isCustomerUser = user?.role === 'customer'
  const currentUserId = idOf((user as any)?._id || (user as any)?.id)
  const supportsInternalNotes = entityType === 'order'

  useEffect(() => {
    setQuickActionType(quickActionValues[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType])

  useEffect(() => {
    let active = true
    getUserProfile()
      .then((response) => { if (active) setUser(response.user || response) })
      .catch(() => { /* Rolle unbekannt: nur lesen */ })
    return () => { active = false }
  }, [])

  useEffect(() => {
    isUserEditingRef.current =
      draft.trim().length > 0 ||
      feedbackQuestion.trim().length > 0 ||
      quickActionDescription.trim().length > 0 ||
      submitting
  }, [draft, feedbackQuestion, quickActionDescription, submitting])

  const applyThread = useCallback((nextThread: PanelThread | null, nextNotes: InternalNote[] | null) => {
    const signature = threadSignature(nextThread, nextNotes)
    if (signature === signatureRef.current) return
    signatureRef.current = signature
    setThread(nextThread)
    setInternalNotes(nextNotes)
  }, [])

  const fetchThread = useCallback(async (): Promise<{ thread: PanelThread | null; notes: InternalNote[] | null }> => {
    if (entityType === 'repair-request') {
      const rr = await getRepairRequestCommunicationThread(orderId)
      return { thread: rr || null, notes: null }
    }
    const result = await getCommunicationThreadWithNotes(orderId)
    return { thread: result.communication || null, notes: result.internalNotes }
  }, [entityType, orderId])

  // Laden + ruhiges Polling (nur sichtbar und wenn niemand tippt). Laden, Fehler und
  // "leer" sind drei getrennte Zustände.
  useEffect(() => {
    let active = true
    const load = async (silent: boolean) => {
      try {
        if (!silent) {
          setLoadState('loading')
          setLoadError('')
        }
        const result = await fetchThread()
        if (!active) return
        applyThread(result.thread, result.notes)
        setLoadState('ready')
      } catch (error: any) {
        if (!active) return
        if (!silent) {
          setLoadState('error')
          setLoadError(error?.message || '')
        }
      }
    }
    if (!orderId) return () => { active = false }
    signatureRef.current = ''
    load(false)
    const interval = window.setInterval(() => {
      if (!active || document.visibilityState !== 'visible' || isUserEditingRef.current) return
      load(true)
    }, 15000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [orderId, fetchThread, applyThread, reloadToken])

  const messages = useMemo(
    () => (thread?.messages || []).filter((message) => VISIBLE_MESSAGE_TYPES.includes(message.messageType)),
    [thread]
  )

  // Offene Punkte für den Kunden an den Container melden (nur bei geändertem Verlauf).
  useEffect(() => {
    if (!onThreadChange || loadState !== 'ready') return
    onThreadChange({
      questions: messages.filter((m) => m.messageType === 'feedback_request' && m.feedbackRequest?.status === 'pending').length,
      actions: messages.filter((m) => m.messageType === 'quick_action' && m.quickAction?.status === 'pending').length,
      offers: messages.filter((m) => m.messageType === 'repair_offer' && m.metadata?.status === 'pending').length,
    })
  }, [messages, loadState, onThreadChange])

  const entries: ThreadEntry[] = useMemo(() => {
    const list: ThreadEntry[] = messages.map((message) => ({ kind: 'message' as const, key: `m-${message._id}`, createdAt: message.createdAt, message }))
    if (isStaffOrAdmin && internalNotes) {
      internalNotes.forEach((note) => list.push({ kind: 'internal' as const, key: `n-${note._id}`, createdAt: note.createdAt, note }))
    }
    return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [messages, internalNotes, isStaffOrAdmin])

  // Ungelesen für DIESEN Benutzer (gleiche Regel wie der Server).
  const hasUnreadForMe = useMemo(() => {
    if (!currentUserId) return false
    return messages.some((message) => {
      const myRead = (message.readBy || []).find((entry) => idOf(entry?.userId) === currentUserId)
      if (isStaffOrAdmin) {
        if (message.feedbackRequest?.status === 'responded' && message.feedbackRequest.respondedAt) {
          return !myRead || new Date(myRead.readAt).getTime() < new Date(message.feedbackRequest.respondedAt).getTime()
        }
        return message.senderType === 'customer' && !myRead
      }
      return (message.senderType === 'staff' || message.senderType === 'system') && !myRead
    })
  }, [messages, currentUserId, isStaffOrAdmin])

  const markAsRead = useCallback(async () => {
    const mark = entityType === 'repair-request' ? markRepairRequestMessagesAsRead : markInspectionMessagesAsRead
    try {
      await mark(orderId)
      onRead?.()
    } catch {
      /* Lesestatus ist nicht kritisch; nächster Aufruf versucht es erneut */
      lastMarkedRef.current = ''
    }
  }, [entityType, orderId, onRead])

  // Nur wenn der Verlauf WIRKLICH sichtbar ist (voll / aufgeklappt) als gelesen markieren.
  useEffect(() => {
    if (!markReadOnView || !expanded || loadState !== 'ready' || !hasUnreadForMe) return
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    const signature = `${orderId}|${signatureRef.current}`
    if (lastMarkedRef.current === signature) return
    lastMarkedRef.current = signature
    markAsRead()
  }, [markReadOnView, expanded, loadState, hasUnreadForMe, orderId, markAsRead, thread])

  // Neueste Nachricht sichtbar halten.
  useEffect(() => {
    const element = threadScrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [entries.length, expanded])

  // Neuer Modus = neuer Entwurf: eine nach einem Fehlversuch behaltene clientMessageId wird nie
  // für eine andere Nachrichtenart (z. B. Rückfrage statt Nachricht) wiederverwendet.
  useEffect(() => {
    draftIdRef.current = newDraftId()
  }, [mode])

  // Externe Auslöser schalten den Composer-Modus um (statt eines zweiten Dialogs).
  useEffect(() => {
    if (feedbackOpen) {
      setMode('question')
      setExpanded(true)
      onFeedbackOpenChange?.(false)
    }
  }, [feedbackOpen, onFeedbackOpenChange])
  useEffect(() => {
    if (quickActionOpen) {
      setMode('action')
      setExpanded(true)
      onQuickActionOpenChange?.(false)
    }
  }, [quickActionOpen, onQuickActionOpenChange])

  const resetDraftState = () => {
    setDraft('')
    setFeedbackQuestion('')
    setFeedbackOptions([{ label: 'Ja', value: 'ja' }, { label: 'Nein', value: 'nein' }])
    setQuickActionDescription('')
    setQuickActionType(quickActionValues[0])
    draftIdRef.current = newDraftId()
  }

  const reloadAfterWrite = async () => {
    try {
      const result = await fetchThread()
      signatureRef.current = ''
      applyThread(result.thread, result.notes)
      setLoadState('ready')
    } catch {
      /* Anzeige aktualisiert sich beim nächsten Polling */
    }
  }

  const validOptions = feedbackOptions.filter((option) => option.label.trim())
  const canSubmit = !submitting && loadState !== 'error' && (
    mode === 'message' || mode === 'internal'
      ? draft.trim().length > 0
      : mode === 'question'
        ? feedbackQuestion.trim().length > 0 && validOptions.length >= 2
        : quickActionDescription.trim().length > 0
  )

  // EIN Sende-Pfad für Klick und Tastatur; in-flight-Sperre + clientMessageId je Entwurf,
  // damit Doppelklick/Enter-Wiederholung keine zweite Nachricht erzeugt.
  const handleSubmit = async () => {
    if (submittingRef.current || !canSubmit) return
    // Fail closed: eine interne Notiz wird NIE über den Kundenkanal gesendet.
    if (mode === 'internal' && !supportsInternalNotes) {
      toast({ title: 'Nicht gespeichert', description: 'Interne Notizen sind hier nicht verfügbar.', variant: 'destructive' })
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    const clientMessageId = draftIdRef.current
    try {
      if (mode === 'internal' && supportsInternalNotes) {
        const result = await addInternalNote(orderId, draft.trim(), clientMessageId)
        setInternalNotes(result.internalNotes)
        signatureRef.current = ''
        toast({ title: 'Interne Notiz gespeichert', description: 'Nur für das Team sichtbar. Der Kunde wurde nicht benachrichtigt.' })
      } else if (mode === 'question') {
        const options = validOptions.map((option) => ({ label: option.label.trim(), value: (option.value || option.label).trim() }))
        if (entityType === 'repair-request') {
          await sendRepairRequestFeedbackRequest(orderId, feedbackQuestion.trim(), options)
        } else {
          await sendInspectionFeedbackRequest(orderId, inspectionId, feedbackQuestion.trim(), options, clientMessageId)
        }
        toast({ title: 'Rückfrage gesendet', description: 'Der Kunde wurde benachrichtigt und kann direkt antworten.' })
      } else if (mode === 'action') {
        if (entityType === 'repair-request') {
          await createRepairRequestQuickAction(orderId, quickActionType as RepairRequestQuickActionType, quickActionDescription.trim())
        } else {
          await createInspectionQuickAction(orderId, inspectionId, quickActionType as OrderQuickActionType, quickActionDescription.trim(), undefined, clientMessageId)
        }
        toast({ title: 'Aktion angefordert', description: 'Der Kunde wurde benachrichtigt.' })
      } else {
        if (entityType === 'repair-request') {
          await sendRepairRequestMessage(orderId, draft.trim())
        } else {
          await sendInspectionMessage(orderId, draft.trim(), clientMessageId)
        }
        toast({
          title: 'Nachricht gesendet',
          description: isStaffOrAdmin ? 'Der Kunde sieht die Nachricht und erhält eine E-Mail-Benachrichtigung.' : 'Das Reparaturteam wurde benachrichtigt.',
        })
      }
      resetDraftState()
      if (mode !== 'message') setMode('message')
      await reloadAfterWrite()
      onSent?.()
    } catch (error: any) {
      // Entwurf und clientMessageId bleiben erhalten: ein erneuter Versuch ist idempotent.
      toast({
        title: 'Nicht gesendet',
        description: error?.message || 'Bitte erneut versuchen.',
        variant: 'destructive',
      })
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleFeedbackResponse = async (messageId: string, response: { label: string; value: string }) => {
    if (responding) return
    try {
      setResponding(true)
      if (entityType === 'repair-request') {
        await respondToRepairRequestFeedback(orderId, messageId, response)
      } else {
        await respondToInspectionFeedback(orderId, messageId, response)
      }
      await reloadAfterWrite()
      toast({ title: 'Antwort gespeichert', description: 'Das Reparaturteam wurde informiert.' })
    } catch (error: any) {
      toast({ title: 'Antwort nicht gespeichert', description: error?.message || 'Bitte erneut versuchen.', variant: 'destructive' })
      await reloadAfterWrite()
    } finally {
      setResponding(false)
    }
  }

  // Vom Team angeforderte Aktion als erledigt melden (Kunde). Gleicher Server-Pfad wie zuvor
  // im alten Postfach ("Abgeschlossen markieren"); die Entsperr-Aktion schließt ihr Formular.
  const handleCompleteQuickAction = async (messageId: string) => {
    if (responding) return
    try {
      setResponding(true)
      if (entityType === 'repair-request') {
        await completeRepairRequestQuickAction(orderId, messageId)
      } else {
        await completeInspectionQuickAction(orderId, messageId)
      }
      await reloadAfterWrite()
      onSent?.()
      toast({ title: 'Als erledigt gemeldet', description: 'Das Reparaturteam wurde informiert.' })
    } catch (error: any) {
      toast({ title: 'Nicht gespeichert', description: error?.message || 'Bitte erneut versuchen.', variant: 'destructive' })
      await reloadAfterWrite()
    } finally {
      setResponding(false)
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
      await reloadAfterWrite()
      toast({ title: 'Erfolg', description: 'Entsperrinformation erfolgreich aktualisiert. Das Team wird benachrichtigt.' })
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message || 'Aktualisierung fehlgeschlagen', variant: 'destructive' })
      updateUnlockForm(messageId, { submitting: false })
    }
  }

  const handleRepairOffer = async (complaintId: string, decision: 'accept' | 'reject') => {
    try {
      setOfferActionLoading(decision)
      if (decision === 'accept') {
        await acceptComplaintOffer(complaintId)
        toast({ title: "Angebot angenommen", description: "Der neue Reparaturauftrag wird erstellt." })
      } else {
        await rejectComplaintOffer(complaintId)
        toast({ title: "Angebot abgelehnt", description: "Die Reklamation wird geschlossen." })
      }
      await reloadAfterWrite()
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message || "Aktion fehlgeschlagen", variant: "destructive" })
    } finally {
      setOfferActionLoading("")
    }
  }

  const pendingQuestions = messages.filter((m) => m.feedbackRequest?.status === 'pending').length
  const pendingActions = messages.filter((m) => m.quickAction?.status === 'pending').length
  const pendingTotal = pendingQuestions + pendingActions
  const threadUrl = `/messages?thread=${entityType === 'repair-request' ? 'repair_request' : 'order'}:${orderId}`

  // ------------------------------------------------------------------ Darstellung der Einträge
  const renderMeta = (name: string, createdAt: string) => (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/80">{name}</span>
      <span className="inline-flex items-center gap-1" title={formatAbsolute(createdAt)}>
        <Clock className="h-3 w-3" aria-hidden="true" />
        <time dateTime={createdAt}>{formatMessageTime(createdAt)}</time>
      </span>
    </div>
  )

  const renderMessage = (message: PanelMessage) => {
    const senderKind = message.senderType === 'customer' ? 'customer' : message.senderType === 'system' ? 'system' : 'staff'

    if (message.messageType === 'feedback_request' && message.feedbackRequest) {
      const fr = message.feedbackRequest
      const isPending = fr.status === 'pending'
      return (
        <div className={`inspection-comm-feedback-card rounded-lg border border-l-4 p-3 ${isPending ? 'is-pending' : 'is-completed'}`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SenderBadge type={senderKind} />
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" /> Rückfrage an den Kunden
              </span>
            </div>
            <Badge variant="outline" className="text-xs">
              {isPending ? 'Wartet auf Antwort' : 'Beantwortet'}
            </Badge>
          </div>
          <p className="mb-2 text-sm font-semibold text-foreground">{fr.question}</p>
          {renderMeta(message.senderName, message.createdAt)}
          {isPending && isCustomerUser && (
            <div className="mt-3 space-y-2" role="group" aria-label="Antwort auswählen">
              <p className="text-xs text-muted-foreground">Bitte wählen Sie Ihre Antwort:</p>
              {fr.options.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleFeedbackResponse(message._id, { label: option.label, value: option.value })}
                  disabled={responding}
                  className="inspection-comm-option-btn h-auto w-full justify-start py-2.5 text-left"
                >
                  <span className="text-sm">{option.label}</span>
                </Button>
              ))}
            </div>
          )}
          {isPending && !isCustomerUser && (
            <p className="mt-2 text-xs text-muted-foreground">Wartet auf Antwort des Kunden. Antworten kann nur der Kunde selbst.</p>
          )}
          {!isPending && (
            <div className="inspection-comm-answered mt-2 flex items-center gap-2 rounded px-3 py-2">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span className="text-sm">
                {isCustomerUser ? 'Ihre Antwort: ' : 'Antwort des Kunden: '}
                <span className="font-semibold">{fr.response?.label || '–'}</span>
                {fr.respondedAt && <span className="ml-1 text-xs opacity-80">({formatMessageTime(fr.respondedAt)})</span>}
              </span>
            </div>
          )}
        </div>
      )
    }

    if (message.messageType === 'quick_action' && message.quickAction) {
      const qa = message.quickAction
      const isPending = qa.status === 'pending'
      const isUpdateUnlockInfo = qa.actionType === 'update_unlock_info'
      const defaultUnlockType = qa.metadata?.unlockType === 'pattern' ? 'pattern' : 'code'
      const form = getUnlockUpdateForm(message._id, defaultUnlockType as 'code' | 'pattern' | 'noLock')
      return (
        <div className={`rounded-lg border border-l-4 p-3 ${isPending ? 'border-l-amber-500 border-amber-200 bg-amber-50/60' : 'border-l-emerald-500 border-emerald-200 bg-emerald-50/40'}`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SenderBadge type={senderKind} />
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                {isUpdateUnlockInfo ? <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> : <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                Aktion erforderlich
              </span>
            </div>
            <Badge variant="outline" className="text-xs">{isPending ? 'Offen' : 'Erledigt'}</Badge>
          </div>
          <p className="text-sm font-semibold text-foreground">{isUpdateUnlockInfo ? 'Entsperrinformation aktualisieren' : qa.actionLabel}</p>
          {qa.description && <p className="my-1 whitespace-pre-wrap break-words text-sm text-foreground/85">{qa.description}</p>}
          {renderMeta(message.senderName, message.createdAt)}

          {isUpdateUnlockInfo && isPending && isCustomerUser && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Art der Entsperrung">
                {(['code', 'pattern', 'noLock'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => updateUnlockForm(message._id, { selectedType: type })}
                    disabled={form.submitting}
                    aria-pressed={form.selectedType === type}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      form.selectedType === type ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-muted'
                    }`}
                  >
                    {type === 'code' && 'Entsperrcode'}
                    {type === 'pattern' && 'Entsperrmuster'}
                    {type === 'noLock' && 'Keine Sperre'}
                  </button>
                ))}
              </div>
              {form.selectedType === 'code' && (
                <div className="space-y-1">
                  <Label htmlFor={`unlock-code-${message._id}`} className="text-xs">Entsperrcode (PIN oder Passwort)</Label>
                  <Input
                    id={`unlock-code-${message._id}`}
                    inputMode="numeric"
                    placeholder="Entsperrcode eingeben …"
                    value={form.unlockCode}
                    onChange={(e) => updateUnlockForm(message._id, { unlockCode: e.target.value })}
                    disabled={form.submitting}
                  />
                </div>
              )}
              {form.selectedType === 'pattern' && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground/70">
                    Entsperrmuster zeichnen
                    {form.unlockPattern.length > 0 && <span className="ml-2 text-primary">{form.unlockPattern.join(' → ')}</span>}
                  </p>
                  <UnlockPatternGrid
                    pattern={form.unlockPattern}
                    onPatternChange={(p) => updateUnlockForm(message._id, { unlockPattern: p })}
                    disabled={form.submitting}
                  />
                </div>
              )}
              {form.selectedType === 'noLock' && (
                <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-foreground/70">
                  Ihr Gerät wird als <strong>entsperrt / ohne Sperre</strong> markiert.
                </p>
              )}
              <Button size="sm" className="w-full" disabled={form.submitting} onClick={() => handleSubmitUnlockUpdate(message._id)}>
                {form.submitting
                  ? <><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Wird gesendet …</>
                  : <><Send className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Entsperrinformation senden</>}
              </Button>
            </div>
          )}
          {isPending && isCustomerUser && !isUpdateUnlockInfo && (
            <Button size="sm" className="mt-3" disabled={responding} onClick={() => handleCompleteQuickAction(message._id)}>
              {responding
                ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
              Als erledigt markieren
            </Button>
          )}
          {isPending && !isCustomerUser && (
            <p className="mt-2 text-xs text-muted-foreground">Wartet auf den Kunden.</p>
          )}
        </div>
      )
    }

    if (message.messageType === 'repair_offer' && message.metadata) {
      const offer = message.metadata as { complaintId: string; offerAmount: number; offerDescription: string; status: string }
      const isPending = offer.status === 'pending'
      const isAccepted = offer.status === 'accepted'
      return (
        <div className={`rounded-lg border border-l-4 p-3 ${isPending ? 'border-l-rose-400 bg-rose-50' : isAccepted ? 'border-l-green-500 bg-green-50' : 'border-l-slate-300 bg-slate-50'}`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SenderBadge type="system" />
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Reparaturangebot
              </span>
            </div>
            <Badge variant="outline" className="text-xs">{isPending ? 'Wartet auf Entscheidung' : isAccepted ? 'Angenommen' : 'Abgelehnt'}</Badge>
          </div>
          <p className="text-sm text-foreground/85">{offer.offerDescription}</p>
          <p className="my-1 text-base font-bold text-foreground">{formatEuro(offer.offerAmount)}</p>
          {renderMeta(message.senderName, message.createdAt)}
          {isPending && isCustomerUser && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button size="sm" className="flex-1" disabled={offerActionLoading !== ""} onClick={() => handleRepairOffer(offer.complaintId, 'accept')}>
                {offerActionLoading === "accept" ? "Wird gesendet …" : "Angebot annehmen"}
              </Button>
              <Button size="sm" variant="outline" className="flex-1" disabled={offerActionLoading !== ""} onClick={() => handleRepairOffer(offer.complaintId, 'reject')}>
                {offerActionLoading === "reject" ? "Wird gesendet …" : "Angebot ablehnen"}
              </Button>
            </div>
          )}
          {isPending && !isCustomerUser && <p className="mt-2 text-xs text-muted-foreground">Wartet auf die Entscheidung des Kunden.</p>}
        </div>
      )
    }

    // Text- und Systemnachricht
    const isOwn = currentUserId && idOf(message.senderUserId || message.senderId) === currentUserId
    return (
      <div className={`rounded-lg border p-3 ${senderKind === 'customer' ? 'border-sky-200 bg-sky-50/50' : senderKind === 'system' ? 'border-slate-200 bg-slate-50' : 'border-indigo-100 bg-white'}`}>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <SenderBadge type={senderKind} />
          {renderMeta(isOwn ? `${message.senderName} (Sie)` : message.senderName, message.createdAt)}
        </div>
        <p className="whitespace-pre-wrap break-words text-sm text-foreground">{message.content}</p>
      </div>
    )
  }

  const renderInternalNote = (note: InternalNote) => (
    <div className="rounded-lg border border-dashed border-amber-400 bg-amber-50 p-3" aria-label="Interne Notiz, für Kunden nicht sichtbar">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <SenderBadge type="internal" />
        {renderMeta(note.staffName, note.createdAt)}
        <span className="text-[11px] text-amber-900">Für Kunden nicht sichtbar</span>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm text-amber-950">{note.note}</p>
    </div>
  )

  // ------------------------------------------------------------------ Composer
  const modeOptions: Array<{ value: ComposerMode; label: string; icon: JSX.Element }> = isStaffOrAdmin
    ? [
        { value: 'message', label: 'Nachricht an Kunden', icon: <Send className="h-3.5 w-3.5" aria-hidden="true" /> },
        ...(supportsInternalNotes ? [{ value: 'internal' as ComposerMode, label: 'Interne Notiz', icon: <Lock className="h-3.5 w-3.5" aria-hidden="true" /> }] : []),
        { value: 'question', label: 'Rückfrage an Kunden', icon: <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" /> },
        { value: 'action', label: 'Aktion anfordern', icon: <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> },
      ]
    : []

  const isInternalMode = mode === 'internal'
  const primaryLabel = !isStaffOrAdmin
    ? 'Nachricht senden'
    : mode === 'internal'
      ? 'Interne Notiz speichern'
      : mode === 'question'
        ? 'Rückfrage an Kunden senden'
        : mode === 'action'
          ? 'Aktion an Kunden senden'
          : 'Nachricht an Kunden senden'

  const composer = user?.role ? (
    <div
      className={`shrink-0 rounded-lg border-2 p-3 ${isInternalMode ? 'border-amber-400 bg-amber-50' : isStaffOrAdmin ? 'border-sky-300 bg-sky-50/60' : 'border-border bg-white'}`}
      aria-label="Nachricht verfassen"
    >
      {isStaffOrAdmin && (
        <div className="mb-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Was möchten Sie tun?">
          {modeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={mode === option.value}
              onClick={() => setMode(option.value)}
              disabled={submitting}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                mode === option.value
                  ? option.value === 'internal' ? 'border-amber-500 bg-amber-500 text-white' : 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-white text-foreground hover:bg-muted'
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
      )}

      {isStaffOrAdmin && (
        <div className={`mb-2 flex items-start gap-2 rounded-md px-2.5 py-2 text-xs ${isInternalMode ? 'bg-amber-100 text-amber-950' : 'bg-sky-100 text-sky-950'}`} role="note">
          {isInternalMode ? <Lock className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" /> : <UserRound className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />}
          <div>
            <p className="font-bold">{isInternalMode ? 'Intern – nur für das Team' : 'An Kunden'}</p>
            <p>
              {isInternalMode
                ? 'Nur für Mitarbeiter sichtbar. Der Kunde wird nicht benachrichtigt.'
                : mode === 'message' && entityType === 'order'
                  ? 'Der Kunde sieht dies in seinem Kundenkonto und erhält eine E-Mail-Benachrichtigung.'
                  : mode === 'message'
                    ? 'Der Kunde sieht die Nachricht bei seiner Reparaturanfrage.'
                    : 'Der Kunde sieht dies in seinem Kundenkonto bzw. in der Auftragsverfolgung und kann dort direkt antworten.'}
            </p>
          </div>
        </div>
      )}

      {(mode === 'message' || mode === 'internal' || !isStaffOrAdmin) && (
        <div className="space-y-1">
          <Label htmlFor={`comm-draft-${orderId}`} className="text-xs font-semibold">
            {!isStaffOrAdmin ? 'Nachricht an das Reparaturteam' : isInternalMode ? 'Interne Notiz' : 'Nachricht an den Kunden'}
          </Label>
          <Textarea
            id={`comm-draft-${orderId}`}
            placeholder={!isStaffOrAdmin ? 'Ihre Nachricht an das Reparaturteam …' : isInternalMode ? 'Notiz für das Team …' : 'Nachricht an den Kunden …'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            className="min-h-[72px] resize-y bg-white text-sm"
            disabled={submitting || loadState === 'error'}
            maxLength={5000}
          />
        </div>
      )}

      {isStaffOrAdmin && mode === 'question' && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor={`comm-question-${orderId}`} className="text-xs font-semibold">Frage an den Kunden</Label>
            <Textarea
              id={`comm-question-${orderId}`}
              placeholder={t('communicationPanel.exampleQuestion', 'z. B. Dürfen wir den Akku für 45,00 € zusätzlich tauschen?')}
              value={feedbackQuestion}
              onChange={(e) => setFeedbackQuestion(e.target.value)}
              className="min-h-[64px] resize-y bg-white text-sm"
              disabled={submitting}
            />
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-semibold">Antwortoptionen (mindestens 2)</legend>
            {feedbackOptions.map((option, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  aria-label={`Antwortoption ${index + 1}`}
                  value={option.label}
                  placeholder={`Option ${index + 1}`}
                  onChange={(e) => {
                    const next = [...feedbackOptions]
                    next[index] = { label: e.target.value, value: e.target.value.trim().toLowerCase() }
                    setFeedbackOptions(next)
                  }}
                  className="bg-white text-sm"
                  disabled={submitting}
                />
                {feedbackOptions.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFeedbackOptions(feedbackOptions.filter((_, i) => i !== index))}
                    aria-label={`Option ${index + 1} entfernen`}
                    title="Option entfernen"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            ))}
            {feedbackOptions.length < 5 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setFeedbackOptions([...feedbackOptions, { label: '', value: '' }])} disabled={submitting}>
                <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Option hinzufügen
              </Button>
            )}
          </fieldset>
        </div>
      )}

      {isStaffOrAdmin && mode === 'action' && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor={`comm-action-${orderId}`} className="text-xs font-semibold">Welche Aktion braucht der Kunde?</Label>
            <select
              id={`comm-action-${orderId}`}
              value={quickActionType}
              onChange={(e) => setQuickActionType(e.target.value as QuickActionType)}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
              disabled={submitting}
            >
              {quickActionValues.map((value) => (
                <option key={value} value={value}>{t(`communicationPanel.quickActions.${value}.label`)}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t(`communicationPanel.quickActions.${quickActionType}.description`)}</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`comm-action-desc-${orderId}`} className="text-xs font-semibold">Beschreibung für den Kunden</Label>
            <Textarea
              id={`comm-action-desc-${orderId}`}
              placeholder="Was genau soll der Kunde tun?"
              value={quickActionDescription}
              onChange={(e) => setQuickActionDescription(e.target.value)}
              className="min-h-[64px] resize-y bg-white text-sm"
              disabled={submitting}
            />
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          {loadState === 'error' ? 'Senden erst möglich, wenn der Verlauf geladen ist.' : 'Strg + Enter sendet'}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetDraftState}
            disabled={submitting || !(draft.trim() || feedbackQuestion.trim() || quickActionDescription.trim())}
          >
            Entwurf verwerfen
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`gap-1.5 ${isInternalMode ? 'bg-amber-600 text-white hover:bg-amber-700' : ''}`}
          >
            {submitting
              ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Wird gesendet …</>
              : <>{isInternalMode ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />} {primaryLabel}</>}
          </Button>
        </div>
      </div>
    </div>
  ) : null

  // ------------------------------------------------------------------ Verlauf
  const isFill = layout === 'fill'
  const threadArea = (
    <div
      ref={threadScrollRef}
      className={`inspection-comm-thread rounded-lg border bg-white ${isFill ? 'min-h-0 flex-1 overflow-y-auto' : 'max-h-[min(450px,55vh)] overflow-y-auto'}`}
      aria-live="polite"
    >
      {loadState === 'loading' && (
        <div className="space-y-2 p-4" role="status">
          <p className="text-sm text-muted-foreground">Nachrichten werden geladen …</p>
          <div className="h-12 animate-pulse rounded bg-muted" />
          <div className="h-12 animate-pulse rounded bg-muted" />
        </div>
      )}
      {loadState === 'error' && (
        <div className="flex flex-col items-start gap-2 p-4" role="alert">
          <p className="text-sm font-semibold text-destructive">Der Verlauf konnte nicht geladen werden.</p>
          {loadError && <p className="text-xs text-muted-foreground">{loadError}</p>}
          <Button size="sm" variant="outline" onClick={() => setReloadToken((value) => value + 1)}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Erneut versuchen
          </Button>
        </div>
      )}
      {loadState === 'ready' && entries.length === 0 && (
        <div className="inspection-comm-empty flex flex-col items-center justify-center gap-1 p-6 text-center">
          <MessageCircle className="h-7 w-7" aria-hidden="true" />
          <p className="text-sm">Noch keine Nachrichten.</p>
          <p className="text-xs text-muted-foreground">
            {isStaffOrAdmin ? 'Schreiben Sie unten die erste Nachricht an den Kunden.' : 'Sie können dem Reparaturteam unten eine Nachricht schreiben.'}
          </p>
        </div>
      )}
      {loadState === 'ready' && entries.length > 0 && (
        <ol className="space-y-2.5 p-3">
          {entries.map((entry) => (
            <li key={entry.key}>{entry.kind === 'internal' ? renderInternalNote(entry.note) : renderMessage(entry.message)}</li>
          ))}
        </ol>
      )}
    </div>
  )

  // Kompakt-Variante hat ihre eigene Kopfzeile - keine doppelte Überschrift.
  const header = !hideTitle && variant !== 'compact' ? (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <MessageCircle className="inspection-comm-header-icon h-4 w-4" aria-hidden="true" />
        <h3 className="inspection-comm-title text-sm font-semibold">Nachrichten</h3>
        {pendingTotal > 0 && (
          <Badge variant="secondary" className="inspection-comm-counter text-xs">
            {pendingTotal} offen
          </Badge>
        )}
      </div>
    </div>
  ) : null

  const panelBody = (
    <div className={`inspection-comm-panel ${isFill ? 'flex h-full min-h-0 flex-1 flex-col gap-3' : 'space-y-3'}`}>
      {header}
      {isStaffOrAdmin && (pendingQuestions > 0 || pendingActions > 0) && (
        <p className="text-xs text-muted-foreground">
          {pendingQuestions > 0 && `${pendingQuestions} Rückfrage${pendingQuestions === 1 ? '' : 'n'} offen`}
          {pendingQuestions > 0 && pendingActions > 0 && ' · '}
          {pendingActions > 0 && `${pendingActions} Aktion${pendingActions === 1 ? '' : 'en'} offen`}
        </p>
      )}
      {threadArea}
      {composer}
    </div>
  )

  if (variant !== 'compact') {
    return panelBody
  }

  // Kompakt: letzte Nachricht + inline aufklappbarer Verlauf (kein verschachtelter Dialog).
  const lastEntry = entries[entries.length - 1]
  const lastPreview = !lastEntry
    ? ''
    : lastEntry.kind === 'internal'
      ? lastEntry.note.note
      : lastEntry.message.feedbackRequest?.question || lastEntry.message.quickAction?.actionLabel || lastEntry.message.content
  return (
    <div className="space-y-3 rounded-xl border border-[#1a2a5e]/15 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-[#1a2a5e]" aria-hidden="true" />
          <span className="text-sm font-semibold text-[#1a2a5e]">Nachrichten</span>
          {hasUnreadForMe && <Badge className="text-[11px]">Ungelesen</Badge>}
          {pendingTotal > 0 && <Badge variant="outline" className="text-[11px]">{pendingTotal} offen</Badge>}
        </div>
        <Link to={threadUrl} className="inline-flex items-center gap-1 text-xs font-semibold text-[#1a2a5e] underline-offset-2 hover:underline">
          <Inbox className="h-3.5 w-3.5" aria-hidden="true" /> Im Postfach öffnen <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
      {!expanded && (
        <div className="text-sm">
          {loadState === 'loading' && <p className="text-muted-foreground">Nachrichten werden geladen …</p>}
          {loadState === 'error' && (
            <div className="flex flex-wrap items-center gap-2" role="alert">
              <span className="text-destructive">Der Verlauf konnte nicht geladen werden.</span>
              <Button size="sm" variant="outline" onClick={() => setReloadToken((value) => value + 1)}>Erneut versuchen</Button>
            </div>
          )}
          {loadState === 'ready' && !lastEntry && <p className="text-muted-foreground">Noch keine Nachrichten.</p>}
          {loadState === 'ready' && lastEntry && (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <SenderBadge type={lastEntry.kind === 'internal' ? 'internal' : lastEntry.message.senderType === 'customer' ? 'customer' : lastEntry.message.senderType === 'system' ? 'system' : 'staff'} />
                <span className="text-xs text-muted-foreground" title={formatAbsolute(lastEntry.createdAt)}>{formatMessageTime(lastEntry.createdAt)}</span>
              </div>
              <p className="line-clamp-2 whitespace-pre-wrap break-words text-sm text-foreground">{lastPreview}</p>
            </div>
          )}
        </div>
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="w-full justify-center gap-1.5">
        {expanded
          ? <><ChevronUp className="h-4 w-4" aria-hidden="true" /> Verlauf einklappen</>
          : <><ChevronDown className="h-4 w-4" aria-hidden="true" /> Gesamten Verlauf anzeigen und antworten{entries.length > 1 ? ` (${entries.length})` : ''}</>}
      </Button>
      {expanded && panelBody}
    </div>
  )
}
