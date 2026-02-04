import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/useToast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  getCommunicationThread,
  sendMessage,
  sendFeedbackRequest,
  createQuickAction,
  respondToFeedback,
  markMessagesAsRead,
} from "@/api/inspectionCommunication"
import { MessageCircle, ChevronDown, Settings, Plus, Send, CheckCircle2, AlertCircle, Clock } from "lucide-react"

interface OrderMessagesSummaryProps {
  orderId: string
  userRole?: string
  customer?: { name: string; email: string; avatar?: string }
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

export function OrderMessagesSummary({
  orderId,
  userRole,
  customer,
}: OrderMessagesSummaryProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [communication, setCommunication] = useState<Communication | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
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
    "part_replacement" | "incorrect_device" | "incorrect_unlock_code" | "additional_costs"
  >("part_replacement")
  const [quickActionDescription, setQuickActionDescription] = useState("")
  const [respondingTo, setRespondingTo] = useState<string | null>(null)

  // Load communication thread
  useEffect(() => {
    const loadThread = async () => {
      try {
        const thread = await getCommunicationThread(orderId)
        setCommunication(thread)
        console.log("OrderMessagesSummary: Communication thread loaded:", thread, {
          hasMessages: thread?.messages?.length || 0,
          pendingFeedback: thread?.pendingFeedbackCount || 0,
          pendingActions: thread?.pendingActionsCount || 0,
        })

        // Mark as read only when dialog is open
        if (dialogOpen) {
          await markMessagesAsRead(orderId).catch((error) =>
            console.error("OrderMessagesSummary: Error marking messages as read:", error)
          )
        }
      } catch (error) {
        console.error("OrderMessagesSummary: Error loading communication thread:", error)
      } finally {
        if (loading) setLoading(false)
      }
    }

    if (orderId) {
      // Load immediately
      if (loading) {
        console.log("OrderMessagesSummary: Initial load for order:", orderId)
        loadThread()
      } else {
        // If already loaded, just poll for updates
        const interval = setInterval(() => {
          console.log("OrderMessagesSummary: Polling for updates")
          loadThread()
        }, 5000)
        return () => clearInterval(interval)
      }
    }
  }, [orderId, dialogOpen, loading])

  // Handle sending message
  const handleSendMessage = async () => {
    if (!newMessage.trim()) {
      toast({
        title: t("common.error"),
        description: t("communicationPanel.errorEnterMessage"),
        variant: "destructive",
      })
      return
    }

    try {
      setSending(true)
      const updated = await sendMessage(orderId, newMessage)
      setCommunication(updated)
      setNewMessage("")
      toast({
        title: t("common.success"),
        description: t("communicationPanel.successMessageSent"),
      })
    } catch (error: any) {
      console.error("Error sending message:", error)
      toast({
        title: t("common.error"),
        description: error.message || t("communicationPanel.errorSendingMessage"),
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
      setRespondingTo(messageId)
      console.log("OrderMessagesSummary: Responding to feedback:", { messageId, response })
      const updated = await respondToFeedback(orderId, messageId, response)
      setCommunication(updated)
      console.log("OrderMessagesSummary: Feedback response recorded successfully")
      toast({
        title: t("common.success"),
        description: t("communicationPanel.successResponseRecorded"),
      })
    } catch (error: any) {
      console.error("OrderMessagesSummary: Error responding to feedback:", error)
      toast({
        title: t("common.error"),
        description: error.message || t("communicationPanel.errorRespondingToFeedback"),
        variant: "destructive",
      })
    } finally {
      setRespondingTo(null)
    }
  }

  // Handle sending feedback request
  const handleSendFeedback = async () => {
    if (!feedbackQuestion.trim()) {
      toast({
        title: t("common.error"),
        description: t("communicationPanel.errorQuestion"),
        variant: "destructive",
      })
      return
    }

    const validOptions = feedbackOptions.filter((opt) => opt.label.trim())
    if (validOptions.length < 2) {
      toast({
        title: t("common.error"),
        description: t("communicationPanel.errorMinTwoOptions"),
        variant: "destructive",
      })
      return
    }

    try {
      setSending(true)
      const updated = await sendFeedbackRequest(
        orderId,
        "",
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
      toast({
        title: t("common.success"),
        description: t("communicationPanel.successFeedbackSent"),
      })
    } catch (error: any) {
      console.error("Error sending feedback:", error)
      toast({
        title: t("common.error"),
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
        title: t("common.error"),
        description: t("communicationPanel.errorDescription"),
        variant: "destructive",
      })
      return
    }

    try {
      setSending(true)
      const updated = await createQuickAction(
        orderId,
        "",
        quickActionType,
        quickActionDescription
      )
      setCommunication(updated)
      setQuickActionDescription("")
      setShowQuickActionDialog(false)
      toast({
        title: t("common.success"),
        description: t("communicationPanel.successActionSent"),
      })
    } catch (error: any) {
      console.error("Error sending quick action:", error)
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const isStaffOrAdmin = userRole === "staff" || userRole === "admin"
  const isCustomer = userRole === "customer"

  const hasMessages = communication?.messages && communication.messages.length > 0
  const lastMessage = hasMessages ? communication.messages[communication.messages.length - 1] : null
  const messageCount = communication?.messages?.length || 0

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="w-4 h-4" />
            {t("communicationPanel.customerMessages")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-2">
            {t("common.loading")}...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!hasMessages) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3 pt-3 px-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="w-4 h-4" />
          {t("communicationPanel.customerMessages")}
        </CardTitle>
        <CardDescription className="text-xs mt-1">
          {messageCount} {messageCount === 1 ? t("communicationPanel.message") : t("communicationPanel.messages")}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-3 space-y-3">
        {/* Last Message Preview */}
        {lastMessage && (
          <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3 border border-gray-200 dark:border-gray-800">
            <div className="flex items-start gap-2 mb-2">
              <Avatar className="h-6 w-6 flex-shrink-0">
                <AvatarImage src={lastMessage.senderId?.avatar} />
                <AvatarFallback className="text-xs">
                  {lastMessage.senderName?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">
                    {lastMessage.senderName}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {lastMessage.senderType === "customer"
                      ? t("common.customer")
                      : lastMessage.senderType === "staff"
                      ? t("common.staff")
                      : t("common.system")}
                  </Badge>
                </div>
                <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 line-clamp-2">
                  {lastMessage.content}
                </p>
                <span className="text-xs text-muted-foreground mt-1 inline-block">
                  {new Date(lastMessage.createdAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Expand Button */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full text-xs h-8">
              <ChevronDown className="h-3 w-3 mr-1" />
              {t("communicationPanel.viewHistory")} ({messageCount})
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <div className="flex-1">
                  <DialogTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    {t("communicationPanel.communicationHistory")}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    {communication?.pendingFeedbackCount! > 0 || communication?.pendingActionsCount! > 0
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowFeedbackDialog(true)}
                      title={t("communicationPanel.sendFeedbackRequest")}
                    >
                      <Settings className="w-4 h-4" />
                      <span className="hidden sm:inline ml-1">{t("communicationPanel.feedback")}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowQuickActionDialog(true)}
                      title={t("communicationPanel.sendQuickAction")}
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline ml-1">{t("communicationPanel.action")}</span>
                    </Button>
                  </div>
                )}
              </div>
            </DialogHeader>

            <Separator />

            {/* Messages Area */}
            <ScrollArea className="flex-1 min-h-[300px] pr-4">
              <div className="space-y-4 pl-4">
                {communication?.messages?.map((message) => (
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
                                ? t("common.customer")
                                : message.senderType === "staff"
                                ? t("common.staff")
                                : t("common.system")}
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
                            {new Date(message.createdAt).toLocaleString("en-US", {
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
                              {t("communicationPanel.feedbackRequest")}
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
                              {isCustomer
                                ? t("communicationPanel.youResponded")
                                : t("communicationPanel.customerResponded")}:{" "}
                              <span className="font-semibold">
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
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                              {message.quickAction.actionLabel}
                            </p>
                            {message.quickAction.description && (
                              <p className="text-xs text-blue-800 dark:text-blue-200 mt-2">
                                {message.quickAction.description}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                              {t("communicationPanel.from")} {message.senderName}
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
                            {t(`communicationPanel.${message.quickAction.status}`)}
                          </Badge>
                        </div>
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

            <Separator />

            {/* Message Input */}
            <div className="pt-4 space-y-3">
              <div className="flex gap-2">
                <Textarea
                  placeholder={t("communicationPanel.typeMessage")}
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
                  {t("common.clear")}
                </Button>
                <Button
                  size="sm"
                  disabled={!newMessage.trim() || sending}
                  onClick={handleSendMessage}
                >
                  <Send className="w-4 h-4 mr-1" />
                  {sending ? t("communicationPanel.sending") : t("common.send")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Feedback Request Dialog */}
        <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("communicationPanel.sendFeedbackRequest")}</DialogTitle>
              <DialogDescription>
                {t("communicationPanel.askCustomerFeedback")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("communicationPanel.question")}</label>
                <Textarea
                  placeholder={t("communicationPanel.enterQuestion")}
                  value={feedbackQuestion}
                  onChange={(e) => setFeedbackQuestion(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium">{t("communicationPanel.options")}</label>
                {feedbackOptions.map((option, index) => (
                  <Input
                    key={index}
                    placeholder={t("communicationPanel.option", { number: index + 1 })}
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

            <DialogHeader>
              <Button variant="outline" onClick={() => setShowFeedbackDialog(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSendFeedback} disabled={sending}>
                {sending ? t("common.sending") : t("common.send")}
              </Button>
            </DialogHeader>
          </DialogContent>
        </Dialog>

        {/* Quick Action Dialog */}
        <Dialog open={showQuickActionDialog} onOpenChange={setShowQuickActionDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("communicationPanel.sendQuickAction")}</DialogTitle>
              <DialogDescription>
                {t("communicationPanel.notifyCustomerAction")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("communicationPanel.actionType")}</label>
                <select
                  value={quickActionType}
                  onChange={(e) =>
                    setQuickActionType(
                      e.target.value as
                        | "part_replacement"
                        | "incorrect_device"
                        | "incorrect_unlock_code"
                        | "additional_costs"
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
                >
                  <option value="part_replacement">
                    {t("communicationPanel.partReplacementRequired")}
                  </option>
                  <option value="incorrect_device">
                    {t("communicationPanel.incorrectDevice")}
                  </option>
                  <option value="incorrect_unlock_code">
                    {t("communicationPanel.incorrectUnlock")}
                  </option>
                  <option value="additional_costs">
                    {t("communicationPanel.additionalCostsRequired")}
                  </option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("communicationPanel.description")}</label>
                <Textarea
                  placeholder={t("communicationPanel.describeAction")}
                  value={quickActionDescription}
                  onChange={(e) => setQuickActionDescription(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </div>

            <DialogHeader>
              <Button variant="outline" onClick={() => setShowQuickActionDialog(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSendQuickAction} disabled={sending}>
                {sending ? t("common.sending") : t("common.send")}
              </Button>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
