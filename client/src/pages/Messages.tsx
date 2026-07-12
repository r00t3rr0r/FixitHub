import { useEffect, useState } from "react"
import { SEO } from '@/components/SEO'
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import {
  getInspectionCommunications,
  getRepairRequestCommunications,
  sendInspectionMessage,
  sendRepairRequestMessage,
  respondToFeedback,
  respondToRepairRequestFeedback,
  completeQuickAction,
  completeRepairRequestQuickAction,
  CommunicationMessage,
  OrderCommunication,
} from "@/api/messages"
import {
  MessageSquare,
  Search,
  Send,
  Paperclip,
  Clock,
  Circle,
  Plus,
  AlertCircle,
  CheckCircle,
  ClipboardList,
  X
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { buildOrderDetailsState } from "@/lib/orderDetailsNavigation"
import "../styles/messages.css"

export function Messages() {
  type MobileMessageFilter = 'all' | 'unread'

  const { t } = useTranslation()
  const { user } = useAuth()
  const location = useLocation()
  const userRole = user?.role || 'customer'
  const [searchTerm, setSearchTerm] = useState("")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  ))
  const [mobileFilter, setMobileFilter] = useState<MobileMessageFilter>('all')

  // Order Feedback State
  const [orderFeedbacks, setOrderFeedbacks] = useState<OrderCommunication[]>([])
  const [selectedOrderFeedback, setSelectedOrderFeedback] = useState<OrderCommunication | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState("")
  const [sendingFeedbackMessage, setSendingFeedbackMessage] = useState(false)
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [feedbackResponse, setFeedbackResponse] = useState<any>(null)
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false)

  useEffect(() => {
    const reopenFeedbackDialogId = (location.state as { reopenFeedbackDialogId?: string } | null)?.reopenFeedbackDialogId
    if (!reopenFeedbackDialogId || orderFeedbacks.length === 0) {
      return
    }

    const feedbackToOpen = orderFeedbacks.find((feedback) => feedback._id === reopenFeedbackDialogId)
    if (feedbackToOpen) {
      setSelectedOrderFeedback(feedbackToOpen)
      setShowFeedbackDialog(true)
    }
  }, [location.state, orderFeedbacks])

  const currentUserId = String((user as any)?._id || (user as any)?.id || '')

  const isRepairRequestCommunication = (communication?: OrderCommunication | null) =>
    communication?.communicationType === 'repair_request'

  const getCommunicationSourceId = (communication?: OrderCommunication | null) =>
    communication?.sourceId || communication?.repairRequestId || communication?.orderId || ''

  const getCommunicationLink = (communication?: OrderCommunication | null) => {
    if (!communication) {
      return '#'
    }

    if (isRepairRequestCommunication(communication)) {
      if (userRole === 'customer') {
        return '/my-repair-requests'
      }
      if (userRole === 'admin') {
        return `/admin/repair-requests?requestId=${encodeURIComponent(getCommunicationSourceId(communication))}`
      }
      return `/staff/repair-requests?requestId=${encodeURIComponent(getCommunicationSourceId(communication))}`
    }

    return communication.orderId ? `/orders/${communication.orderId}` : '#'
  }

  const getCommunicationTitle = (communication?: OrderCommunication | null) => {
    if (!communication) {
      return 'Vorgang'
    }

    if (isRepairRequestCommunication(communication)) {
      if (communication.requestNumber) {
        return `Repair Request #${communication.requestNumber}`
      }
      return `Repair Request #${getCommunicationSourceId(communication).slice(0, 8)}`
    }

    if (communication.orderNumber) {
      return `Order #${communication.orderNumber}`
    }
    return `Order #${(communication.orderId || '').toString().slice(0, 8)}`
  }

  const isReadByCurrentUser = (message: CommunicationMessage) => {
    if (!currentUserId) {
      return false
    }

    return (message.readBy || []).some((entry: any) => {
      const readById = String(entry?.userId?._id || entry?.userId || '')
      return readById === currentUserId
    })
  }

  const getUnreadCustomerFeedbackMessageCount = (feedback: OrderCommunication) => {
    return (feedback.messages || []).filter((msg) => (
      msg.senderType === 'customer' && !isReadByCurrentUser(msg)
    )).length
  }

  const getFeedbackMarkerCount = (feedback: OrderCommunication) => {
    return getUnreadCustomerFeedbackMessageCount(feedback)
      + (feedback.pendingFeedbackCount || 0)
      + (feedback.pendingActionsCount || 0)
  }

  // Initial feedback load
  useEffect(() => {
    loadOrderFeedbacks()
  }, [])

  // Polling mechanism: refresh feedbacks while the page is open
  useEffect(() => {
    console.log("Starting feedback polling...")
    const pollInterval = setInterval(() => {
      console.log("Polling for new feedback data...")
      loadOrderFeedbacks({ silent: true })
    }, 5000)

    return () => {
      console.log("Stopping feedback polling...")
      clearInterval(pollInterval)
    }
  }, [])

  const loadOrderFeedbacks = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      if (!silent) {
        setFeedbackLoading(true)
      }
      const [inspectionResponse, repairRequestResponse] = await Promise.all([
        getInspectionCommunications({ page: 1, limit: 100 }),
        getRepairRequestCommunications({ page: 1, limit: 100 }),
      ])

      const inspectionFeedbacks = ((inspectionResponse?.communications || []) as OrderCommunication[])
        .map((communication) => ({
          ...communication,
          communicationType: 'order' as const,
          sourceId: communication.orderId,
        }))

      const repairRequestFeedbacks = ((repairRequestResponse?.communications || []) as OrderCommunication[])
        .map((communication) => ({
          ...communication,
          communicationType: 'repair_request' as const,
          sourceId: communication.repairRequestId,
          orderId: communication.orderId || '',
        }))

      const feedbacks = [...inspectionFeedbacks, ...repairRequestFeedbacks]
        .sort((a, b) => {
          const aTime = new Date(a.lastMessageAt || a.updatedAt || 0).getTime()
          const bTime = new Date(b.lastMessageAt || b.updatedAt || 0).getTime()
          return bTime - aTime
        })

      console.log("Loaded communications (inspection + repair requests):", feedbacks)
      setOrderFeedbacks(feedbacks)

      setSelectedOrderFeedback((prev) => {
        if (!feedbacks.length) {
          return null
        }

        if (!prev) {
          return feedbacks[0]
        }

        const updatedSelected = feedbacks.find(
          item => item._id === prev._id && item.communicationType === prev.communicationType
        )
        return updatedSelected || feedbacks[0]
      })
    } catch (error) {
      console.error("Error loading order feedbacks:", error)
    } finally {
      if (!silent) {
        setFeedbackLoading(false)
      }
    }
  }

  const handleRespondToFeedback = async (messageId: string, selectedOption: any) => {
    try {
      if (!selectedOrderFeedback) {
        return
      }

      const sourceId = getCommunicationSourceId(selectedOrderFeedback)
      const response = isRepairRequestCommunication(selectedOrderFeedback)
        ? await respondToRepairRequestFeedback(sourceId, messageId, selectedOption)
        : await respondToFeedback(sourceId, messageId, selectedOption)

      if (response?.communication) {
        const updatedCommunication = {
          ...response.communication,
          communicationType: selectedOrderFeedback.communicationType,
          sourceId,
        }

        setSelectedOrderFeedback(updatedCommunication)
        setOrderFeedbacks(prev => prev.map(item => (
          item._id === updatedCommunication._id && item.communicationType === updatedCommunication.communicationType
            ? updatedCommunication
            : item
        )))
        setRespondingTo(null)
        setFeedbackResponse(null)
      }
    } catch (error) {
      console.error("Error responding to feedback:", error)
    }
  }

  const handleCompleteAction = async (messageId: string) => {
    try {
      if (!selectedOrderFeedback) {
        return
      }

      const sourceId = getCommunicationSourceId(selectedOrderFeedback)
      const response = isRepairRequestCommunication(selectedOrderFeedback)
        ? await completeRepairRequestQuickAction(sourceId, messageId)
        : await completeQuickAction(sourceId, messageId)

      if (response?.communication) {
        const updatedCommunication = {
          ...response.communication,
          communicationType: selectedOrderFeedback.communicationType,
          sourceId,
        }

        setSelectedOrderFeedback(updatedCommunication)
        setOrderFeedbacks(prev => prev.map(item => (
          item._id === updatedCommunication._id && item.communicationType === updatedCommunication.communicationType
            ? updatedCommunication
            : item
        )))
      }
    } catch (error) {
      console.error("Error completing action:", error)
    }
  }

  const handleSendFeedbackMessage = async () => {
    if (!selectedOrderFeedback || !feedbackMessage.trim()) return

    try {
      setSendingFeedbackMessage(true)
      const sourceId = getCommunicationSourceId(selectedOrderFeedback)
      const response = isRepairRequestCommunication(selectedOrderFeedback)
        ? await sendRepairRequestMessage(sourceId, feedbackMessage.trim())
        : await sendInspectionMessage(sourceId, feedbackMessage.trim())

      if (response?.communication) {
        const updatedCommunication = {
          ...response.communication,
          communicationType: selectedOrderFeedback.communicationType,
          sourceId,
        }

        setSelectedOrderFeedback(updatedCommunication)
        setOrderFeedbacks(prev => prev.map(item => (
          item._id === updatedCommunication._id && item.communicationType === updatedCommunication.communicationType
            ? updatedCommunication
            : item
        )))
      }

      setFeedbackMessage("")
    } catch (error) {
      console.error("Error sending feedback tab message:", error)
    } finally {
      setSendingFeedbackMessage(false)
    }
  }

  const closeFeedbackDialog = () => {
    setShowFeedbackDialog(false)
    setSelectedOrderFeedback(null)
    setMobileMenuOpen(true)
    setFeedbackMessage("")
    setRespondingTo(null)
    setFeedbackResponse(null)
  }

  const unreadCount = orderFeedbacks.filter((feedback) => getUnreadCustomerFeedbackMessageCount(feedback) > 0).length

  const filteredOrderFeedbacks = orderFeedbacks.filter(feedback => {
    if (mobileFilter === 'unread' && getUnreadCustomerFeedbackMessageCount(feedback) === 0) {
      return false
    }

    const orderId = (feedback.orderId || '').toString().toLowerCase()
    const repairRequestId = (feedback.repairRequestId || '').toString().toLowerCase()
    const requestNumber = (feedback.requestNumber || '').toString().toLowerCase()
    const orderNumber = (feedback.orderNumber || '').toString().toLowerCase()
    const deviceInfo = (feedback.deviceInfo || '').toString().toLowerCase()
    const search = searchTerm.toLowerCase()

    return (
      orderId.includes(search) ||
      repairRequestId.includes(search) ||
      requestNumber.includes(search) ||
      orderNumber.includes(search) ||
      deviceInfo.includes(search)
    )
  })

  const getFeedbackCountBadges = (feedback: OrderCommunication) => {
    const badges = []
    if (feedback.pendingFeedbackCount > 0) {
      badges.push(
        <span key="feedback" className="messages-feedback-badge pending">
          {feedback.pendingFeedbackCount} Feedback
        </span>
      )
    }
    if (feedback.pendingActionsCount > 0) {
      badges.push(
        <span key="actions" className="messages-feedback-badge action">
          {feedback.pendingActionsCount} Aktionen
        </span>
      )
    }
    return badges
  }

  const formatLastUpdated = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'gerade eben'
    if (diffMins < 60) return `vor ${diffMins}m`
    if (diffHours < 24) return `vor ${diffHours}h`
    if (diffDays < 7) return `vor ${diffDays}d`
    return date.toLocaleDateString('de-DE', { month: 'short', day: 'numeric' })
  }

  return (
    <div className={`messages-page${mobileMenuOpen ? ' mobile-menu-open' : ''}`}>
      <SEO
        title="Nachrichten – FixitHub Kundenportal"
        description="Direkter Kontakt mit Ihrem FixitHub-Techniker. Nachrichten lesen und antworten – schnell und unkompliziert im Kundenportal."
        canonical="/messages"
        noindex={true}
      />
      {/* Header */}
      <div className="messages-header">
        <div className="container">
          <div className="messages-header-content">
            <div className="messages-header-title">
              <MessageSquare className="messages-icon-lg" />
              <div>
                <h1>Nachrichten & Feedback</h1>
                <p>Verwalten Sie alle Ihre Kommunikationen und Order-Feedbacks</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container">
        <div className="messages-mobile-topbar" aria-label="Mobile Nachrichtensteuerung">
          <button
            type="button"
            className="messages-mobile-topbar-btn"
            onClick={() => setMobileMenuOpen(true)}
          >
            <ClipboardList size={16} />
            Vorgänge
          </button>
          <div className="messages-mobile-topbar-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Vorgang suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="messages-mobile-topbar-input"
            />
          </div>
        </div>

        <div className="messages-mobile-filter" role="group" aria-label="Nachrichtenfilter mobil">
          <button
            type="button"
            className={`messages-mobile-filter-chip${mobileFilter === 'all' ? ' active' : ''}`}
            onClick={() => setMobileFilter('all')}
          >
            Alle Nachrichten
            <span className="messages-mobile-filter-chip-count">{orderFeedbacks.length}</span>
          </button>
          <button
            type="button"
            className={`messages-mobile-filter-chip${mobileFilter === 'unread' ? ' active' : ''}`}
            onClick={() => setMobileFilter('unread')}
          >
            Ungelesene Nachrichten
            <span className="messages-mobile-filter-chip-count">{unreadCount}</span>
          </button>
        </div>

        <div className="messages-wrapper">
            {/* Feedback Sidebar */}
            <div className={`messages-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
              {/* Search Box */}
              <div className="messages-search-box">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Nach Order suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="messages-search-input"
                />
              </div>

              {/* Feedback List */}
              <div className="messages-list">
                {feedbackLoading ? (
                  <div className="messages-empty">
                    <div className="messages-loading-spinner-small"></div>
                  </div>
                ) : filteredOrderFeedbacks.length === 0 ? (
                  <div className="messages-empty">
                    <ClipboardList size={32} />
                    <p>Kein Feedback vorhanden</p>
                  </div>
                ) : (
                  filteredOrderFeedbacks.map((feedback) => (
                    <div
                      key={feedback._id}
                      className={`messages-feedback-item ${
                        selectedOrderFeedback?._id === feedback._id ? 'active' : ''
                      }`}
                      onClick={() => {
                        setSelectedOrderFeedback(feedback)
                        setMobileMenuOpen(false)
                        setShowFeedbackDialog(true)
                      }}
                    >
                      <div className="messages-feedback-item-header messages-feedback-item-header--compact">
                        <h3>
                          {getCommunicationTitle(feedback)}
                        </h3>
                        {getFeedbackMarkerCount(feedback) > 0 && (
                          <span className="messages-unread-badge">
                            {getFeedbackMarkerCount(feedback) > 9 ? '9+' : getFeedbackMarkerCount(feedback)}
                          </span>
                        )}
                      </div>
                      {feedback.customer && (
                        <p className="messages-list-customer">
                          Kunde: {feedback.customer.name}
                          {feedback.customer.email ? ` (${feedback.customer.email})` : ''}
                        </p>
                      )}
                      <div className="messages-feedback-badges">
                        {getFeedbackCountBadges(feedback)}
                      </div>
                      <span className="messages-list-time">
                        {formatLastUpdated(feedback.lastMessageAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {mobileMenuOpen && (
              <button
                type="button"
                className="messages-sidebar-overlay"
                aria-label="Vorgangsliste schließen"
                onClick={() => setMobileMenuOpen(false)}
              />
            )}

            {/* Feedback Detail Area */}
            <div className="messages-feedback-detail">
              <div className="messages-no-selection messages-no-selection-dialog-hint">
                <ClipboardList size={64} />
                <h3>Wählen Sie einen Vorgang aus</h3>
                <p>Die Konversation wird als Dialog geöffnet.</p>
                <button
                  type="button"
                  className="messages-open-list-btn"
                  onClick={() => setMobileMenuOpen(true)}
                >
                  Vorgänge öffnen
                </button>
              </div>
            </div>
        </div>

        <Dialog
          open={showFeedbackDialog && !!selectedOrderFeedback}
          onOpenChange={(open) => {
            if (!open) {
              closeFeedbackDialog()
              return
            }
            setShowFeedbackDialog(true)
          }}
        >
          <DialogContent className="messages-feedback-dialog-content max-w-[95vw] sm:max-w-3xl my-0 sm:my-3 max-h-dvh sm:max-h-[92vh] p-0 gap-0 overflow-hidden border-none rounded-[16px] sm:rounded-[24px] shadow-[0_20px_60px_rgba(26,42,94,0.3)] flex flex-col [&>button]:hidden">
            {selectedOrderFeedback && (
              <>
                <DialogHeader className="messages-feedback-dialog-header">
                  <button
                    type="button"
                    className="messages-feedback-dialog-close"
                    aria-label="Dialog schließen"
                    onClick={closeFeedbackDialog}
                  >
                    <X size={18} />
                  </button>

                  <DialogTitle className="messages-feedback-dialog-title" style={{ color: 'rgb(245, 185, 0)' }}>
                    {getCommunicationTitle(selectedOrderFeedback)}
                  </DialogTitle>
                  <DialogDescription className="messages-feedback-dialog-description">
                    {selectedOrderFeedback.customer
                      ? `Kunde: ${selectedOrderFeedback.customer.name}${selectedOrderFeedback.customer.email ? ` • ${selectedOrderFeedback.customer.email}` : ''}`
                      : 'Konversation zum Vorgang'}
                  </DialogDescription>

                  <div className="messages-feedback-dialog-meta-grid">
                    <div className="messages-feedback-dialog-meta-item">
                      <p>Nachrichten</p>
                      <strong>{selectedOrderFeedback.messages.length}</strong>
                    </div>
                    <div className="messages-feedback-dialog-meta-item">
                      <p>Offen</p>
                      <strong>{selectedOrderFeedback.pendingFeedbackCount || 0}</strong>
                    </div>
                    <div className="messages-feedback-dialog-meta-item">
                      <p>Aktionen</p>
                      <strong>{selectedOrderFeedback.pendingActionsCount || 0}</strong>
                    </div>
                  </div>
                </DialogHeader>

                <div className="messages-feedback-dialog-body">
                  <div className="messages-feedback-dialog-toolbar">
                    {getCommunicationSourceId(selectedOrderFeedback) && (
                      <Link
                        to={getCommunicationLink(selectedOrderFeedback)}
                        state={
                          !isRepairRequestCommunication(selectedOrderFeedback)
                            ? buildOrderDetailsState(location, {
                                label: t('common.back'),
                                restoreState: selectedOrderFeedback?._id
                                  ? { reopenFeedbackDialogId: selectedOrderFeedback._id }
                                  : undefined,
                              })
                            : undefined
                        }
                        className="messages-order-link-btn"
                      >
                        Zum Vorgang
                      </Link>
                    )}
                  </div>

                  <div className="messages-feedback-messages">
                    {selectedOrderFeedback.messages.length === 0 ? (
                      <div className="messages-feedback-empty">
                        <MessageSquare size={48} />
                        <p>Keine Nachrichten</p>
                      </div>
                    ) : (
                      selectedOrderFeedback.messages.map((msg: CommunicationMessage) => (
                        <div key={msg._id} className="messages-feedback-message">
                          {msg.messageType === 'text' || msg.messageType === 'system_notification' ? (
                            <div className={`messages-feedback-text`}>
                              <div className="messages-feedback-sender">
                                <strong>{msg.senderName}</strong>
                                <span className={`messages-sender-type ${msg.senderType}`}>
                                  {msg.senderType === 'staff' ? '👤 Team' : msg.senderType === 'customer' ? '👥 Sie' : '🔔 System'}
                                </span>
                              </div>
                              <p>{msg.content}</p>
                              <span className="messages-timestamp">
                                {new Date(msg.createdAt).toLocaleDateString('de-DE', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          ) : msg.messageType === 'feedback_request' && msg.feedbackRequest ? (
                            <div className="messages-feedback-request">
                              <div className="messages-feedback-request-header">
                                <AlertCircle size={20} className="messages-icon-warning" />
                                <div>
                                  <strong>Feedback erforderlich</strong>
                                  <span className={`messages-feedback-request-status ${msg.feedbackRequest.status}`}>
                                    {msg.feedbackRequest.status === 'pending' ? '⏳ Ausstehend' : '✓ Beantwortet'}
                                  </span>
                                </div>
                              </div>
                              <p className="messages-feedback-question">{msg.feedbackRequest.question}</p>

                              {msg.feedbackRequest.status === 'pending' && respondingTo !== msg._id ? (
                                <div className="messages-feedback-options">
                                  {msg.feedbackRequest.options.map((option) => (
                                    <button
                                      key={option.value}
                                      className="messages-feedback-option-btn"
                                      onClick={() => {
                                        setRespondingTo(msg._id)
                                        setFeedbackResponse(option)
                                      }}
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                              ) : respondingTo === msg._id ? (
                                <div className="messages-feedback-confirm">
                                  <p>Bestätigung: <strong>{feedbackResponse?.label}</strong></p>
                                  <div className="messages-feedback-confirm-actions">
                                    <button
                                      className="messages-confirm-btn primary"
                                      onClick={() => handleRespondToFeedback(
                                        msg._id,
                                        feedbackResponse
                                      )}
                                    >
                                      Bestätigen
                                    </button>
                                    <button
                                      className="messages-confirm-btn secondary"
                                      onClick={() => {
                                        setRespondingTo(null)
                                        setFeedbackResponse(null)
                                      }}
                                    >
                                      Abbrechen
                                    </button>
                                  </div>
                                </div>
                              ) : msg.feedbackRequest.response ? (
                                <div className="messages-feedback-answered">
                                  <CheckCircle size={18} className="messages-icon-success" />
                                  <p>Antwort: <strong>{msg.feedbackRequest.response.label}</strong></p>
                                  <span className="messages-answered-time">
                                    {new Date(msg.feedbackRequest.respondedAt || '').toLocaleDateString('de-DE')}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          ) : msg.messageType === 'quick_action' && msg.quickAction ? (
                            <div className="messages-quick-action">
                              <div className="messages-quick-action-header">
                                <AlertCircle size={20} className="messages-icon-action" />
                                <div>
                                  <strong>Aktion erforderlich</strong>
                                  <span className={`messages-action-status ${msg.quickAction.status}`}>
                                    {msg.quickAction.status === 'pending' ? '⏳ Ausstehend' : '✓ Abgeschlossen'}
                                  </span>
                                </div>
                              </div>
                              <p className="messages-action-label">{msg.quickAction.actionLabel}</p>
                              {msg.quickAction.description && (
                                <p className="messages-action-description">{msg.quickAction.description}</p>
                              )}

                              {msg.quickAction.status === 'pending' && (
                                <button
                                  className="messages-action-complete-btn"
                                  onClick={() => handleCompleteAction(msg._id)}
                                >
                                  <CheckCircle size={16} />
                                  Abgeschlossen markieren
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="messages-feedback-dialog-footer">
                  <div className="messages-chat-input">
                    <div className="messages-input-wrapper">
                      <button className="messages-input-btn" title="Datei anhängen" disabled>
                        <Paperclip size={20} />
                      </button>
                      <textarea
                        placeholder="Nachricht eingeben..."
                        value={feedbackMessage}
                        onChange={(e) => setFeedbackMessage(e.target.value)}
                        className="messages-textarea"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSendFeedbackMessage()
                          }
                        }}
                        rows={1}
                      />
                      <button
                        className={`messages-send-btn ${!feedbackMessage.trim() || sendingFeedbackMessage ? 'disabled' : ''}`}
                        onClick={handleSendFeedbackMessage}
                        disabled={!feedbackMessage.trim() || sendingFeedbackMessage}
                        title="Senden"
                      >
                        <Send size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}