import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/useToast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { getCommunicationThread } from "@/api/inspectionCommunication"
import { MessageCircle, ChevronDown } from "lucide-react"

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

  // Load communication thread
  useEffect(() => {
    const loadThread = async () => {
      try {
        setLoading(true)
        const thread = await getCommunicationThread(orderId)
        setCommunication(thread)
        console.log("Order messages summary loaded:", thread)
      } catch (error) {
        console.error("Error loading communication thread:", error)
      } finally {
        setLoading(false)
      }
    }

    if (orderId) {
      loadThread()
      // Set up polling for new messages every 10 seconds
      const interval = setInterval(loadThread, 10000)
      return () => clearInterval(interval)
    }
  }, [orderId])

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
          <DialogContent className="max-w-2xl max-h-96">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                {t("communicationPanel.communicationHistory")}
              </DialogTitle>
              <DialogDescription>
                {messageCount} {messageCount === 1 ? t("communicationPanel.message") : t("communicationPanel.messages")}
              </DialogDescription>
            </DialogHeader>

            {/* Full Communication Panel in Dialog */}
            <div className="max-h-80 overflow-y-auto space-y-2">
              {communication?.messages?.map((message) => (
                <div key={message._id} className="space-y-1">
                  <div
                    className={`flex gap-2 ${
                      message.senderType === "customer" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      <AvatarImage src={message.senderId?.avatar} />
                      <AvatarFallback className="text-xs">
                        {message.senderName?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={`flex-1 ${
                        message.senderType === "customer" ? "items-end" : "items-start"
                      } flex flex-col`}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
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
                        className={`rounded-lg p-2 max-w-xs text-xs ${
                          message.senderType === "customer"
                            ? "bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-100"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        }`}
                      >
                        <p>{message.content}</p>
                      </div>
                      <span className="text-xs text-muted-foreground mt-0.5">
                        {new Date(message.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
