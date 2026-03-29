import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import {
  getConversations,
  getConversationMessages,
  sendMessage,
  markMessagesAsRead,
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
  Phone,
  Video,
  MoreVertical,
  Clock,
  CheckCheck,
  Circle,
  X,
  Paperclip as AttachIcon,
  Smile,
  Plus,
  AlertCircle,
  CheckCircle,
  ClipboardList,
  MessageCircle,
  RefreshCw
} from "lucide-react"
import "../styles/messages.css"

type TabType = 'conversations' | 'feedback'

export function Messages() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const userRole = user?.role || 'customer'
  const [activeTab, setActiveTab] = useState<TabType>('conversations')
  const [conversations, setConversations] = useState<any[]>([])
  const [selectedConversation, setSelectedConversation] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Order Feedback State
  const [orderFeedbacks, setOrderFeedbacks] = useState<OrderCommunication[]>([])
  const [selectedOrderFeedback, setSelectedOrderFeedback] = useState<OrderCommunication | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState("")
  const [sendingFeedbackMessage, setSendingFeedbackMessage] = useState(false)
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [feedbackResponse, setFeedbackResponse] = useState<any>(null)

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

  const hasConversationMarker = (conversation: any) => {
    if (userRole !== 'staff' && userRole !== 'admin') {
      return false
    }

    const unreadCount = Number(conversation?.unreadCount || 0)
    if (unreadCount <= 0) {
      return false
    }

    const senderRole = conversation?.lastMessage?.senderRole
    if (!senderRole) {
      return true
    }

    return senderRole === 'customer'
  }

  const getConversationMarkerCount = (conversation: any) => {
    if (!hasConversationMarker(conversation)) {
      return 0
    }

    return Number(conversation?.unreadCount || 0)
  }

  const orderLink = (orderId?: string) => orderId ? `/orders/${orderId}` : '#'

  // Load conversations
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        console.log("Fetching conversations...")
        const response = await getConversations()
        const conversationsData = (response as any).conversations || []
        console.log("Conversations data:", conversationsData)
        setConversations(conversationsData)
        
        if (conversationsData.length > 0) {
          setSelectedConversation(conversationsData[0])
          const messagesResponse = await getConversationMessages(conversationsData[0]._id)
          setMessages((messagesResponse as any).messages || [])
        }
      } catch (error) {
        console.error("Error fetching conversations:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchConversations()
  }, [])

  // Initial feedback load
  useEffect(() => {
    loadOrderFeedbacks()
  }, [])

  // Polling mechanism: Refresh feedbacks every 5 seconds when on feedback tab
  useEffect(() => {
    if (activeTab === 'feedback') {
      console.log("Starting feedback polling...")
      const pollInterval = setInterval(() => {
        console.log("Polling for new feedback data...")
        loadOrderFeedbacks()
      }, 5000)

      return () => {
        console.log("Stopping feedback polling...")
        clearInterval(pollInterval)
      }
    }
  }, [activeTab])

  const loadOrderFeedbacks = async () => {
    try {
      setFeedbackLoading(true)
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
      setFeedbackLoading(false)
    }
  }

  const handleConversationSelect = async (conversation: any) => {
    setSelectedConversation(conversation)
    setMobileMenuOpen(false)
    try {
      const response = await getConversationMessages(conversation._id)
      setMessages((response as any).messages || [])
      
      if (conversation.unreadCount > 0) {
        await markMessagesAsRead(conversation._id)
        setConversations(prev => 
          prev.map(conv => 
            conv._id === conversation._id 
              ? { ...conv, unreadCount: 0 }
              : conv
          )
        )
      }
    } catch (error) {
      console.error("Error loading messages:", error)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return

    try {
      setSending(true)
      const response = await sendMessage(selectedConversation._id, newMessage)
      setMessages([...messages, (response as any).message])
      setNewMessage("")
    } catch (error: any) {
      console.error("Error sending message:", error)
    } finally {
      setSending(false)
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

  const filteredConversations = conversations.filter(conv => {
    const orderNumber = (conv.orderNumber || '').toString().toLowerCase()
    const deviceInfo = (conv.deviceInfo || '').toString().toLowerCase()
    const search = searchTerm.toLowerCase()
    return orderNumber.includes(search) || deviceInfo.includes(search)
  })

  const filteredOrderFeedbacks = orderFeedbacks.filter(feedback => {
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

  const getStatusBadge = (unreadCount: number) => {
    if (unreadCount > 0) {
      return <span className="messages-unread-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
    }
    return null
  }

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

  if (loading && activeTab === 'conversations') {
    return (
      <div className="messages-container">
        <div className="messages-loading">
          <div className="messages-loading-spinner"></div>
          <p>Nachrichten werden geladen...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="messages-page">
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

      {/* Tabs */}
      <div className="container">
        <div className="messages-tabs">
          <button
            className={`messages-tab ${activeTab === 'conversations' ? 'active' : ''}`}
            onClick={() => setActiveTab('conversations')}
          >
            <MessageCircle size={18} />
            Konversationen
            {conversations.some(c => getConversationMarkerCount(c) > 0) && (
              <span className="messages-tab-badge">
                {conversations.reduce((sum, c) => sum + getConversationMarkerCount(c), 0)}
              </span>
            )}
          </button>
          <button
            className={`messages-tab ${activeTab === 'feedback' ? 'active' : ''}`}
            onClick={() => setActiveTab('feedback')}
          >
            <ClipboardList size={18} />
            Order-Feedback & Aktionen
            {orderFeedbacks.reduce((sum, f) => sum + getFeedbackMarkerCount(f), 0) > 0 && (
              <span className="messages-tab-badge">
                {orderFeedbacks.reduce((sum, f) => sum + getFeedbackMarkerCount(f), 0)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="container">
        {activeTab === 'conversations' ? (
          // Conversations Tab
          <div className="messages-wrapper">
            {/* Conversations Sidebar */}
            <div className={`messages-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
              <div className="messages-sidebar-header">
                <h2>Konversationen</h2>
                <button 
                  className="messages-sidebar-close"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search Box */}
              <div className="messages-search-box">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="messages-search-input"
                />
              </div>

              {/* Conversations List */}
              <div className="messages-list">
                {filteredConversations.length === 0 ? (
                  <div className="messages-empty">
                    <MessageSquare size={32} />
                    <p>Keine Konversationen</p>
                  </div>
                ) : (
                  filteredConversations.map((conversation) => (
                    <div
                      key={conversation._id}
                      className={`messages-list-item ${
                        selectedConversation?._id === conversation._id ? 'active' : ''
                      }`}
                      onClick={() => handleConversationSelect(conversation)}
                    >
                      <div className="messages-list-item-avatar">
                        <div className="messages-avatar">
                          {conversation.participants[1]?.avatar ? (
                            <img src={conversation.participants[1]?.avatar} alt="" />
                          ) : (
                            <span>
                              {conversation.participants[1]?.name
                                .split(' ')
                                .map((n: string) => n[0])
                                .join('')}
                            </span>
                          )}
                        </div>
                        {conversation.participants[1]?.isOnline && (
                          <div className="messages-status-online"></div>
                        )}
                      </div>

                      <div className="messages-list-item-content">
                        <div className="messages-list-item-header">
                          <h3>{conversation.orderNumber}</h3>
                          {getStatusBadge(getConversationMarkerCount(conversation))}
                        </div>
                        <p className="messages-list-device">
                          {conversation.deviceInfo}
                        </p>
                        {conversation.customer && (
                          <p className="messages-list-customer">
                            Kunde: {conversation.customer.name}
                            {conversation.customer.email ? ` (${conversation.customer.email})` : ''}
                          </p>
                        )}
                        {conversation.createdBy && (userRole === 'staff' || userRole === 'admin') && (
                          <p className="messages-list-creator">
                            von {conversation.createdBy.name} ({conversation.createdBy.role})
                          </p>
                        )}
                        {conversation.orderId && (
                          <Link
                            to={orderLink(conversation.orderId)}
                            className="messages-order-link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Zur Order
                          </Link>
                        )}
                        <p className="messages-list-preview">
                          {conversation.lastMessage?.content || 'Keine Nachrichten'}
                        </p>
                        <span className="messages-list-time">
                          {formatLastUpdated(conversation.lastMessage?.timestamp || new Date().toISOString())}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className="messages-chat">
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
                  <div className="messages-chat-header">
                    <button 
                      className="messages-mobile-back"
                      onClick={() => setMobileMenuOpen(true)}
                    >
                      ←
                    </button>
                    <div className="messages-chat-header-info">
                      <div className="messages-chat-header-avatar">
                        {selectedConversation.participants[1]?.avatar ? (
                          <img src={selectedConversation.participants[1]?.avatar} alt="" />
                        ) : (
                          <span>
                            {selectedConversation.participants[1]?.name
                              .split(' ')
                              .map((n: string) => n[0])
                              .join('')}
                          </span>
                        )}
                        {selectedConversation.participants[1]?.isOnline && (
                          <div className="messages-status-online-lg"></div>
                        )}
                      </div>
                      <div>
                        <h3>{selectedConversation.orderNumber}</h3>
                        <p>{selectedConversation.deviceInfo}</p>
                        {selectedConversation.customer && (
                          <p className="messages-chat-customer">
                            Kunde: {selectedConversation.customer.name}
                            {selectedConversation.customer.email ? ` • ${selectedConversation.customer.email}` : ''}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="messages-chat-actions">
                      <button className="messages-action-btn" title="Anrufen">
                        <Phone size={18} />
                      </button>
                      <button className="messages-action-btn" title="Video">
                        <Video size={18} />
                      </button>
                      <button className="messages-action-btn" title="Mehr">
                        <MoreVertical size={18} />
                      </button>
                      {selectedConversation.orderId && (
                        <Link
                          to={orderLink(selectedConversation.orderId)}
                          className="messages-order-link-btn"
                        >
                          Zur Order
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="messages-chat-body">
                    {messages.length === 0 ? (
                      <div className="messages-chat-empty">
                        <MessageSquare size={48} />
                        <p>Noch keine Nachrichten</p>
                        <span>Starten Sie ein Gespräch, indem Sie eine Nachricht senden</span>
                      </div>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message._id}
                          className={`messages-message-wrapper ${
                            message.senderRole === 'customer' ? 'sent' : 'received'
                          }`}
                        >
                          {message.senderRole !== 'customer' && (
                            <div className="messages-message-avatar">
                              {message.senderAvatar ? (
                                <img src={message.senderAvatar} alt="" />
                              ) : (
                                <span>
                                  {message.senderName
                                    .split(' ')
                                    .map((n: string) => n[0])
                                    .join('')}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="messages-message-group">
                            <div className={`messages-message ${
                              message.senderRole === 'customer'
                                ? 'message-sent'
                                : message.messageType === 'system'
                                ? 'message-system'
                                : 'message-received'
                            }`}>
                              <p>{message.content}</p>
                              {message.attachments?.length > 0 && (
                                <div className="messages-attachments">
                                  {message.attachments.map((attachment: any) => (
                                    <div key={attachment._id} className="messages-attachment">
                                      <AttachIcon size={14} />
                                      <span>{attachment.name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="messages-message-meta">
                              <span className="messages-message-time">
                                {new Date(message.timestamp).toLocaleTimeString('de-DE', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              {message.senderRole === 'customer' && (
                                <span className={`messages-message-status ${message.isRead ? 'read' : 'sent'}`}>
                                  <CheckCheck size={14} />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Message Input */}
                  <div className="messages-chat-input">
                    <div className="messages-input-wrapper">
                      <button className="messages-input-btn" title="Datei anhängen">
                        <Paperclip size={20} />
                      </button>
                      <textarea
                        placeholder="Geben Sie Ihre Nachricht ein..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="messages-textarea"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSendMessage()
                          }
                        }}
                        rows={1}
                      />
                      <button className="messages-input-btn" title="Emoji">
                        <Smile size={20} />
                      </button>
                      <button
                        className={`messages-send-btn ${
                          !newMessage.trim() || sending ? 'disabled' : ''
                        }`}
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || sending}
                        title="Senden"
                      >
                        <Send size={20} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="messages-no-selection">
                  <MessageSquare size={64} />
                  <h3>Wählen Sie eine Konversation aus</h3>
                  <p>Wählen Sie eine Konversation aus der Liste, um zu beginnen</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Feedback Tab
          <div className="messages-wrapper">
            {/* Feedback Sidebar */}
            <div className={`messages-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
              <div className="messages-sidebar-header">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <h2>Vorgänge mit Feedback</h2>
                    <button
                      className="messages-action-btn"
                      onClick={() => loadOrderFeedbacks()}
                      disabled={feedbackLoading}
                      title="Feedback aktualisieren"
                    >
                      <RefreshCw size={20} style={{ animation: feedbackLoading ? 'spin 1s linear infinite' : 'none' }} />
                    </button>
                  </div>
                <button 
                  className="messages-sidebar-close"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>

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

            {/* Feedback Detail Area */}
            <div className="messages-feedback-detail">
              {selectedOrderFeedback ? (
                <div className="messages-feedback-container">
                  {/* Header */}
                  <div className="messages-feedback-header">
                    <button 
                      className="messages-mobile-back"
                      onClick={() => setMobileMenuOpen(true)}
                    >
                      ←
                    </button>
                    <div>
                      <h2>
                        {getCommunicationTitle(selectedOrderFeedback)}
                      </h2>
                      {selectedOrderFeedback.customer && (
                        <p className="messages-chat-customer">
                          Kunde: {selectedOrderFeedback.customer.name}
                          {selectedOrderFeedback.customer.email ? ` • ${selectedOrderFeedback.customer.email}` : ''}
                        </p>
                      )}
                      <p>{selectedOrderFeedback.messages.length} Nachrichten</p>
                    </div>
                    {getCommunicationSourceId(selectedOrderFeedback) && (
                      <Link
                        to={getCommunicationLink(selectedOrderFeedback)}
                        className="messages-order-link-btn"
                      >
                        Zum Vorgang
                      </Link>
                    )}
                  </div>

                  {/* Messages */}
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
                            // Text Message
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
                            // Feedback Request
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
                            // Quick Action
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

                  <div className="messages-chat-input">
                    <div className="messages-input-wrapper">
                      <button className="messages-input-btn" title="Datei anhängen" disabled>
                        <Paperclip size={20} />
                      </button>
                      <textarea
                        placeholder="Nachricht zur Order-Kommunikation senden..."
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
              ) : (
                <div className="messages-no-selection">
                  <ClipboardList size={64} />
                  <h3>Wählen Sie eine Order aus</h3>
                  <p>Wählen Sie eine Order aus der Liste, um Feedback und Aktionen zu sehen</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}