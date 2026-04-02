import { useEffect, useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/useToast"
import { useAuth } from "@/contexts/AuthContext"
import {
  sendMessage,
  getCommunicationThread,
  markMessagesAsRead,
  sendFeedbackRequest,
  respondToFeedback,
  createQuickAction,
  completeQuickAction,
} from "@/api/repairRequestCommunication"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  MessageCircle,
  Send,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
} from "lucide-react"

interface RepairRequestMessagesPanelProps {
  requestId: string
  staffName?: string
  isReadOnly?: boolean
  userRole?: string
}

interface Message {
  _id: string
  senderId: { name: string; email: string; avatar?: string }
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
  status: "active" | "archived" | "resolved"
  lastMessageAt: string
}

export function RepairRequestMessagesPanel({
  requestId,
  staffName,
  isReadOnly,
  userRole,
}: RepairRequestMessagesPanelProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const scrollRef = useRef<HTMLDivElement>(null)

  // State management
  const [communication, setCommunication] = useState<Communication | null>(null)
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false)
  const [showQuickActionDialog, setShowQuickActionDialog] = useState(false)
  const [feedbackQuestion, setFeedbackQuestion] = useState("")
  const [feedbackOptions, setFeedbackOptions] = useState([
    { label: "", value: "" },
    { label: "", value: "" },
  ])
  const [quickActionType, setQuickActionType] = useState<
    "parts_needed" | "approval_required" | "additional_cost" | "status_update" | "schedule_appointment"
  >("parts_needed")
  const [quickActionDescription, setQuickActionDescription] = useState("")
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [completingAction, setCompletingAction] = useState<string | null>(null)
  const [showActionResponseDialog, setShowActionResponseDialog] = useState(false)
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null)
  const [actionResponse, setActionResponse] = useState("")

  // Load communication thread
  useEffect(() => {
    const loadThread = async () => {
      try {
        console.log("RepairRequestMessagesPanel: Loading communication thread for request:", requestId)
        setLoading(true)
        const thread = await getCommunicationThread(requestId)
        setCommunication(thread)
        console.log("RepairRequestMessagesPanel: Communication thread loaded:", thread)

        // Mark as read
        await markMessagesAsRead(requestId).catch((error) =>
          console.error("RepairRequestMessagesPanel: Error marking messages as read:", error)
        )
      } catch (error) {
        console.error("RepairRequestMessagesPanel: Error loading communication thread:", error)
      } finally {
        setLoading(false)
      }
    }

    if (requestId) {
      loadThread()
      // Set up polling for new messages every 5 seconds
      const interval = setInterval(loadThread, 5000)
      return () => clearInterval(interval)
    }
  }, [requestId])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [communication?.messages])

  // Handle sending message
  const handleSendMessage = async () => {
    console.log("RepairRequestMessagesPanel: Handling send message")
    if (!newMessage.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte gib eine Nachricht ein",
        variant: "destructive",
      })
      return
    }

    try {
      setSending(true)
      const updated = await sendMessage(requestId, newMessage)
      setCommunication(updated)
      setNewMessage("")
      console.log("RepairRequestMessagesPanel: Message sent successfully")
      toast({
        title: "Erfolg",
        description: "Nachricht wurde erfolgreich gesendet",
      })
    } catch (error: any) {
      console.error("RepairRequestMessagesPanel: Error sending message:", error)
      toast({
        title: "Fehler",
        description: error.message || "Nachricht konnte nicht gesendet werden",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  // Handle feedback response
  const handleFeedbackResponse = async (
    messageId: string,
    response: { label: string; value: string }
  ) => {
    try {
      console.log("RepairRequestMessagesPanel: Responding to feedback for message:", messageId)
      setRespondingTo(messageId)
      const updated = await respondToFeedback(requestId, messageId, response)
      setCommunication(updated)
      console.log("RepairRequestMessagesPanel: Feedback response recorded")
      toast({
        title: "Erfolg",
        description: "Deine Antwort wurde gespeichert",
      })
    } catch (error: any) {
      console.error("RepairRequestMessagesPanel: Error responding to feedback:", error)
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setRespondingTo(null)
    }
  }

  // Handle quick action completion
  const handleCompleteQuickAction = async () => {
    if (!selectedActionId) return

    try {
      console.log("RepairRequestMessagesPanel: Completing quick action:", selectedActionId)
      setCompletingAction(selectedActionId)
      const updated = await completeQuickAction(requestId, selectedActionId)
      setCommunication(updated)
      console.log("RepairRequestMessagesPanel: Quick action completed")
      setShowActionResponseDialog(false)
      setSelectedActionId(null)
      setActionResponse("")
      toast({
        title: "Erfolg",
        description: "Aktion wurde als erledigt markiert",
      })
    } catch (error: any) {
      console.error("RepairRequestMessagesPanel: Error completing action:", error)
      toast({
        title: "Fehler",
        description: error.message || "Aktion konnte nicht abgeschlossen werden",
        variant: "destructive",
      })
    } finally {
      setCompletingAction(null)
    }
  }

  // Handle sending feedback request
  const handleSendFeedback = async () => {
    if (!feedbackQuestion.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte gib eine Frage ein",
        variant: "destructive",
      })
      return
    }

    const validOptions = feedbackOptions.filter((opt) => opt.label.trim())
    if (validOptions.length < 2) {
      toast({
        title: "Fehler",
        description: "Bitte gib mindestens 2 Optionen an",
        variant: "destructive",
      })
      return
    }

    try {
      console.log("RepairRequestMessagesPanel: Sending feedback request")
      setSending(true)
      const updated = await sendFeedbackRequest(
        requestId,
        feedbackQuestion,
        validOptions
      )
      setCommunication(updated)
      setFeedbackQuestion("")
      setFeedbackOptions([
        { label: "", value: "" },
        { label: "", value: "" },
      ])
      setShowFeedbackDialog(false)
      console.log("RepairRequestMessagesPanel: Feedback request sent")
      toast({
        title: "Erfolg",
        description: "Rueckfrage wurde an den Kunden gesendet",
      })
    } catch (error: any) {
      console.error("RepairRequestMessagesPanel: Error sending feedback:", error)
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  // Handle sending quick action
  const handleSendQuickAction = async () => {
    if (!quickActionDescription.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte gib eine Beschreibung ein",
        variant: "destructive",
      })
      return
    }

    try {
      console.log("RepairRequestMessagesPanel: Sending quick action:", quickActionType)
      setSending(true)
      const updated = await createQuickAction(
        requestId,
        quickActionType,
        quickActionDescription
      )
      setCommunication(updated)
      setQuickActionDescription("")
      setShowQuickActionDialog(false)
      console.log("RepairRequestMessagesPanel: Quick action sent")
      toast({
        title: "Erfolg",
        description: "Aktionshinweis wurde an den Kunden gesendet",
      })
    } catch (error: any) {
      console.error("RepairRequestMessagesPanel: Error sending quick action:", error)
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const isStaffOrAdmin = userRole === "staff" || userRole === "admin"
  const isCustomer = userRole === "customer"

  const formatQuickActionStatus = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Ausstehend",
      completed: "Erledigt",
      cancelled: "Abgebrochen",
    }

    return labels[status] || status
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Nachrichten
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">
            Wird geladen...
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasMessages = communication?.messages && communication.messages.length > 0
  const shouldShowPanel = hasMessages || !isReadOnly

  if (!shouldShowPanel) {
    return null
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Kommunikation
              </CardTitle>
              <CardDescription>
                {communication?.pendingFeedbackCount! > 0 || communication?.pendingActionsCount! > 0
                  ? `${(communication?.pendingFeedbackCount || 0) + (communication?.pendingActionsCount || 0)} offene Interaktionen`
                  : "Keine offenen Interaktionen"}
              </CardDescription>
              {/* Created By Information - Staff/Admin Only */}
              {isStaffOrAdmin && communication?.createdBy && (
                <div className="text-xs text-gray-600 mt-2">
                  Erstellt von {communication.createdBy.name} ({communication.createdBy.role})
                </div>
              )}
            </div>

            {/* Staff/Admin Action Buttons */}
            {isStaffOrAdmin && !isReadOnly && (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowFeedbackDialog(true)}
                  title="Rueckfrage senden"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span className="hidden sm:inline ml-1">Rueckfrage</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowQuickActionDialog(true)}
                  title="Aktionshinweis senden"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline ml-1">Aktion</span>
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="p-0">
          {/* Messages Area */}
          {hasMessages ? (
            <ScrollArea
              ref={scrollRef}
              className="h-[400px] p-4"
            >
              <div className="space-y-4">
                {communication!.messages.map((message) => (
                  <div key={message._id} className="space-y-2">
                    {/* Text Messages */}
                    {message.messageType === "text" && (
                      <div
                        className={`flex gap-3 ${
                          message.senderType === "customer" ? "flex-row-reverse" : ""
                        }`}
                      >
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={message.senderId?.avatar} />
                          <AvatarFallback>
                            {message.senderName?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={`flex-1 ${
                            message.senderType === "customer" ? "items-end" : "items-start"
                          } flex flex-col`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold">
                              {message.senderName}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {message.senderType === "customer"
                                ? "Kunde"
                                : message.senderType === "staff"
                                ? "Mitarbeiter"
                                : "System"}
                            </Badge>
                          </div>
                          <div
                            className={`rounded-lg p-3 max-w-md ${
                              message.senderType === "customer"
                                ? "bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-100"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            }`}
                          >
                            <p className="text-sm">{message.content}</p>
                          </div>
                          <span className="text-xs text-muted-foreground mt-1">
                            {new Date(message.createdAt).toLocaleString("de-DE", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Feedback Requests */}
                    {message.messageType === "feedback_request" && message.feedbackRequest && (
                      <div className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950 p-4 rounded">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="font-semibold text-sm text-amber-900 dark:text-amber-100">
                              Rueckfrage
                            </p>
                            <p className="text-sm mt-1 text-amber-900 dark:text-amber-100">
                              {message.feedbackRequest.question}
                            </p>
                          </div>
                          {message.feedbackRequest.status === "pending" && (
                            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                          )}
                        </div>

                        {message.feedbackRequest.status === "pending" && isCustomer && (
                          <div className="space-y-2 mt-3">
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
                                disabled={respondingTo === message._id}
                                className="w-full justify-start text-left"
                              >
                                {option.label}
                              </Button>
                            ))}
                          </div>
                        )}

                        {message.feedbackRequest.status === "responded" && (
                          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mt-3">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-sm">
                              {isCustomer ? "Du hast geantwortet" : "Kunde hat geantwortet"}:
                              <span className="font-semibold ml-1">
                                {message.feedbackRequest.response?.label}
                              </span>
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quick Actions */}
                    {message.messageType === "quick_action" && message.quickAction && (
                      <div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950 p-4 rounded">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              <p className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                                {message.quickAction.actionLabel}
                              </p>
                            </div>
                            {message.quickAction.description && (
                              <p className="text-xs text-blue-800 dark:text-blue-200 mt-2 ml-6">
                                {message.quickAction.description}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2 ml-6">
                              von {message.senderName}
                            </p>
                          </div>
                          <Badge
                            variant={
                              message.quickAction.status === "completed" ? "default" : "secondary"
                            }
                            className="flex-shrink-0 gap-1"
                          >
                            {message.quickAction.status === "completed" && (
                              <CheckCircle2 className="w-3 h-3" />
                            )}
                            {message.quickAction.status === "pending" && (
                              <Clock className="w-3 h-3" />
                            )}
                            {formatQuickActionStatus(message.quickAction.status)}
                          </Badge>
                        </div>

                        {/* Customer Action Buttons */}
                        {message.quickAction.status === "pending" && isCustomer && (
                          <div className="flex gap-2 mt-3 ml-6">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => {
                                setSelectedActionId(message._id)
                                setShowActionResponseDialog(true)
                              }}
                              disabled={completingAction === message._id}
                              className="gap-1"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              {completingAction === message._id ? "Wird abgeschlossen..." : "Als erledigt markieren"}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* System Notifications */}
                    {message.messageType === "system_notification" && (
                      <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded text-xs text-muted-foreground italic">
                        {message.content}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              {isStaffOrAdmin
                ? "Noch keine Nachrichten. Starte die Kommunikation mit dem Kunden."
                : "Warte auf eine Rueckmeldung vom Team..."}
            </div>
          )}

          <Separator />

          {/* Message Input */}
          {!isReadOnly && (
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Nachricht hier eingeben..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.ctrlKey) {
                      handleSendMessage()
                    }
                  }}
                  className="min-h-[80px] resize-none"
                  disabled={sending}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!newMessage.trim() || sending}
                  onClick={() => setNewMessage("")}
                >
                  Leeren
                </Button>
                <Button
                  size="sm"
                  disabled={!newMessage.trim() || sending}
                  onClick={handleSendMessage}
                >
                  <Send className="w-4 h-4 mr-1" />
                  {sending ? "Wird gesendet..." : "Senden"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feedback Request Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rueckfrage senden</DialogTitle>
            <DialogDescription>
              Frage den Kunden nach einer Rueckmeldung zum Status der Reparaturanfrage
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Frage</label>
              <Textarea
                placeholder="Was moechtest du den Kunden fragen?"
                value={feedbackQuestion}
                onChange={(e) => setFeedbackQuestion(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Optionen</label>
              {feedbackOptions.map((option, index) => (
                <Input
                  key={index}
                  placeholder={`Option ${index + 1}`}
                  value={option.label}
                  onChange={(e) => {
                    const updated = [...feedbackOptions]
                    updated[index].label = e.target.value
                    updated[index].value = e.target.value.toLowerCase()
                    setFeedbackOptions(updated)
                  }}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedbackDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSendFeedback} disabled={sending}>
              {sending ? "Wird gesendet..." : "Senden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Action Dialog (Staff) */}
      <Dialog open={showQuickActionDialog} onOpenChange={setShowQuickActionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aktionshinweis senden</DialogTitle>
            <DialogDescription>
              Informiere den Kunden ueber wichtige noetige Aktionen zu seiner Reparaturanfrage
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Aktionstyp</label>
              <select
                value={quickActionType}
                onChange={(e) =>
                  setQuickActionType(
                    e.target.value as
                      | "parts_needed"
                      | "approval_required"
                      | "additional_cost"
                      | "status_update"
                      | "schedule_appointment"
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
              >
                <option value="parts_needed">Ersatzteile benoetigt</option>
                <option value="approval_required">Kundenfreigabe erforderlich</option>
                <option value="additional_cost">Zusaetzliche Kostenschaetzung</option>
                <option value="status_update">Status-Update zur Reparatur</option>
                <option value="schedule_appointment">Termin planen</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Beschreibung</label>
              <Textarea
                placeholder="Beschreibe die Aktion im Detail..."
                value={quickActionDescription}
                onChange={(e) => setQuickActionDescription(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickActionDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSendQuickAction} disabled={sending}>
              {sending ? "Wird gesendet..." : "Senden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Response Dialog (Customer) */}
      <Dialog open={showActionResponseDialog} onOpenChange={setShowActionResponseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Aktion als erledigt markieren
            </DialogTitle>
            <DialogDescription>
              Gib optional weitere Informationen zum Abschluss dieser Aktion an
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Abschlussnotiz (optional)</label>
              <Textarea
                placeholder="Fuege optional eine Notiz zum Abschluss hinzu..."
                value={actionResponse}
                onChange={(e) => setActionResponse(e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded text-xs text-blue-900 dark:text-blue-100">
              <p>Mit dem Markieren als erledigt bestaetigst du, dass du die erforderliche Aufgabe abgeschlossen hast. Unser Reparaturteam wird benachrichtigt.</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowActionResponseDialog(false)
                setSelectedActionId(null)
                setActionResponse("")
              }}
            >
              Abbrechen
            </Button>
            <Button onClick={handleCompleteQuickAction} disabled={completingAction !== null}>
              {completingAction ? "Wird abgeschlossen..." : "Als erledigt markieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
