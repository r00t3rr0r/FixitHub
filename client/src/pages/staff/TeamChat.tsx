import { useState, useEffect, useRef, useCallback } from "react"
import { useTranslation } from 'react-i18next'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/useToast"
import { useAuth } from "@/contexts/AuthContext"
import {
  Send, Users, Plus, Search, Hash, Lock, MessageSquare, Bell,
  Wrench, X, ChevronDown, UserPlus, Ticket, CheckCircle2, Clock,
  AlertCircle, User, AtSign, RefreshCw, Loader2,
} from "lucide-react"
import {
  getTeamChatRooms,
  getRoomMessages,
  sendChatMessage,
  createChatRoom,
  markRoomAsRead,
  getChatStaffMembers,
  type TeamChatRoomSummary,
  type TeamChatMessageData,
  type StaffMember,
} from "@/api/teamChat"

// ─── Types ────────────────────────────────────────────────────────────────────

type RoomType = 'general' | 'team' | 'private' | 'project' | 'announcement'

interface RoomMember {
  userId: { _id: string; name: string; role: string } | string
  role: string
}

interface ChatRoom extends Omit<TeamChatRoomSummary, 'members'> {
  type: RoomType
  members: RoomMember[]
}

interface OrderStatus {
  orderNumber: string
  status: 'assigned' | 'in_progress' | 'waiting_parts' | 'completed' | 'on_hold'
  device: string
  assignedTo: string
}

interface LocalMessage {
  _id: string
  content: string
  senderName: string
  senderId: string
  createdAt: string
  messageType: 'text' | 'file' | 'image' | 'order_card'
  mentions: string[]
  orderCard?: OrderStatus
  isOwn: boolean
  isPending?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<OrderStatus['status'], { label: string; color: string; icon: typeof Clock }> = {
  assigned:      { label: 'teamChat.statusAssigned',     color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: Ticket },
  in_progress:   { label: 'teamChat.statusInProgress',   color: 'bg-amber-100 text-amber-700 border-amber-200',    icon: Wrench },
  waiting_parts: { label: 'teamChat.statusWaitingParts',  color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Clock },
  completed:     { label: 'teamChat.statusCompleted',    color: 'bg-green-100 text-green-700 border-green-200',    icon: CheckCircle2 },
  on_hold:       { label: 'teamChat.statusOnHold',       color: 'bg-gray-100 text-gray-700 border-gray-200',       icon: AlertCircle },
}

const ROOM_SECTION_LABELS: Record<string, string> = {
  general: "teamChat.sectionGeneral",
  team: "teamChat.sectionTeams",
  project: "teamChat.sectionWorkshop",
  private: "teamChat.sectionDirectMessages",
}

const POLL_INTERVAL_MS = 5000

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string, t: (key: string) => string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return t("teamChat.timeNow")
  if (diff < 3600000) return `${Math.floor(diff / 60000)} ${t("teamChat.timeMinutes")}`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} ${t("teamChat.timeHours")}`
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })
}

function initials(name: string): string {
  return name.trim().split(/\s+/).map(n => n[0] ?? "").join("").toUpperCase().slice(0, 2) || "?"
}

function staffMemberName(m: StaffMember, unknownLabel = "?"): string {
  return m.name || `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || unknownLabel
}

function roomMemberName(m: RoomMember): string {
  if (typeof m.userId === "string") return m.userId
  return m.userId?.name ?? "?"
}

function extractSenderId(raw: TeamChatMessageData['senderId']): string {
  if (!raw) return ""
  if (typeof raw === "string") return raw
  return raw._id ?? ""
}

function extractSenderName(raw: TeamChatMessageData['senderId'], fallback: string): string {
  if (!raw || typeof raw === "string") return fallback
  return raw.name ?? fallback
}

function highlightMentions(text: string): React.ReactNode {
  if (!text.includes("@")) return text
  const parts = text.split(/(@[\w][\w\s]*[\w]|@[\w]+)/g)
  return parts.map((part, i) =>
    part.startsWith("@")
      ? <span key={i} className="text-blue-600 font-semibold bg-blue-50 rounded px-0.5">{part}</span>
      : part
  )
}

function mapApiMessage(m: TeamChatMessageData, myId: string): LocalMessage {
  const sid = extractSenderId(m.senderId)
  const sname = extractSenderName(m.senderId, m.senderName)
  const mentions = [...(m.content || "").matchAll(/@([\w][\w\s]*[\w]|[\w]+)/g)].map(x => x[1].trim())
  return {
    _id: m._id,
    content: m.content ?? "",
    senderName: sname,
    senderId: sid,
    createdAt: m.createdAt,
    messageType: (m.messageType === 'file' || m.messageType === 'image') ? m.messageType : 'text',
    mentions,
    isOwn: !!sid && sid === myId,
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function OnlineDot({ isOnline }: { isOnline: boolean }) {
  return (
    <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white ${isOnline ? "bg-green-500" : "bg-gray-400"}`} />
  )
}

function OrderCard({ order }: { order: OrderStatus }) {
  const { t } = useTranslation()
  const cfg = STATUS_CONFIG[order.status]
  const Icon = cfg.icon
  return (
    <div className={`mt-1 rounded border p-2 flex items-start gap-2 text-xs ${cfg.color}`}>
      <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="font-semibold">
          #{order.orderNumber} <span className="font-normal opacity-70">– {order.device}</span>
        </div>
        <div className="opacity-80 mt-0.5">
          {t('teamChat.status')}: <strong>{t(cfg.label)}</strong> · {t('teamChat.assignedTo')}: {order.assignedTo}
        </div>
      </div>
    </div>
  )
}

function MentionPopover({
  query, members, onSelect,
}: { query: string; members: RoomMember[]; onSelect: (name: string) => void }) {
  const items = members
    .map(m => ({
      id: typeof m.userId === "string" ? m.userId : m.userId._id,
      name: roomMemberName(m),
      role: m.role,
    }))
    .filter(m => m.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 5)

  if (!items.length) return null
  return (
    <div className="absolute bottom-full mb-1 left-0 z-50 bg-white border rounded-lg shadow-lg py-1 min-w-[180px]">
      {items.map(m => (
        <button key={m.id} onMouseDown={() => onSelect(m.name)}
          className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 flex items-center gap-2">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="bg-[#1a2a5e] text-white text-[9px]">{initials(m.name)}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{m.name}</span>
          <span className="text-muted-foreground ml-auto text-[10px]">{m.role}</span>
        </button>
      ))}
    </div>
  )
}

function NewRoomModal({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (room: ChatRoom) => void
}) {
  const { toast } = useToast()
  const { t } = useTranslation()
  const [name, setName] = useState("")
  const [type, setType] = useState<RoomType>("team")
  const [selected, setSelected] = useState<string[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [staffLoading, setStaffLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getChatStaffMembers()
      .then(r => setStaffList(r.members))
      .catch(() => {})
      .finally(() => setStaffLoading(false))
  }, [])

  const toggleMember = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await createChatRoom({
        name: name.trim(),
        description: type === "private" ? t('teamChat.privateChat') : t('teamChat.channelDescription', { name: name.trim() }),
        type,
        members: selected.map(id => ({ userId: id })),
      })
      onCreated(res.room as unknown as ChatRoom)
      onClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('teamChat.unknownError')
      toast({ title: t('common.error'), description: message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">{t('teamChat.newChannelChat')}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-2">
          <Input
            placeholder={t('teamChat.channelNamePlaceholder')}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
            className="h-7 text-xs"
          />
          <div className="flex gap-1.5">
            {(["team", "general", "project", "private"] as RoomType[]).map(rt => (
              <button key={rt} onClick={() => setType(rt)}
                className={`flex-1 text-[10px] py-1 rounded border transition-colors ${
                  type === rt ? "bg-[#1a2a5e] text-white border-[#1a2a5e]" : "border-gray-200 hover:bg-gray-50"
                }`}>
                {rt === "team" ? t('teamChat.typeTeam') : rt === "general" ? t('teamChat.typeGeneral') : rt === "project" ? t('teamChat.typeWorkshop') : t('teamChat.typeDirect')}
              </button>
            ))}
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">
              {t('teamChat.members')} {staffLoading && `(${t('common.loading')})`}
            </p>
            <div className="space-y-0.5 max-h-36 overflow-y-auto">
              {staffList.map(m => (
                <label key={m._id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                  <input
                    type="checkbox"
                    checked={selected.includes(m._id)}
                    onChange={() => toggleMember(m._id)}
                    className="accent-[#1a2a5e]"
                  />
                  <span className="text-xs">{staffMemberName(m, t('teamChat.unknown'))}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto capitalize">{m.role}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="h-7 text-xs" disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={!name.trim() || saving}
            className="h-7 text-xs bg-[#1a2a5e] hover:bg-[#0f1d45]">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : t('common.create')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function TeamChat() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { toast } = useToast()
  const myId = user?._id ?? ""
  const myName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || t('teamChat.you')

  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [search, setSearch] = useState("")
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [msgLoading, setMsgLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [showNewRoom, setShowNewRoom] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [showOrderDrop, setShowOrderDrop] = useState(false)
  const [notifications, setNotifications] = useState<{ id: string; text: string; time: string }[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedRoomRef = useRef<ChatRoom | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  selectedRoomRef.current = selectedRoom

  // ── Fetch rooms ──────────────────────────────────────────────────────────────
  const fetchRooms = useCallback(async (silent = false) => {
    if (!silent) setRoomsLoading(true)
    try {
      const { rooms: raw } = await getTeamChatRooms()
      const mapped = raw as unknown as ChatRoom[]
      setRooms(mapped)
      setSelectedRoom(prev => {
        if (prev) return mapped.find(r => r._id === prev._id) ?? prev
        return mapped[0] ?? null
      })
    } catch (err: unknown) {
      if (!silent) {
        const message = err instanceof Error ? err.message : t('teamChat.roomsLoadError')
        toast({ title: t('common.error'), description: message, variant: "destructive" })
      }
    } finally {
      if (!silent) setRoomsLoading(false)
    }
  }, [toast])

  // ── Fetch messages ───────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async (roomId: string, silent = false) => {
    if (!silent) setMsgLoading(true)
    try {
      const { messages: raw } = await getRoomMessages(roomId)
      const mapped = raw.map(m => mapApiMessage(m, myId))
      setMessages(prev => {
        const confirmedIds = new Set(mapped.map(m => m._id))
        const stillPending = prev.filter(m => m.isPending && !confirmedIds.has(m._id))
        return [...mapped, ...stillPending]
      })
    } catch {
      // silent on polling errors
    } finally {
      if (!silent) setMsgLoading(false)
    }
  }, [myId])

  // ── Initial load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  // ── Load messages when room changes ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedRoom) return
    setMessages([])
    fetchMessages(selectedRoom._id)
    markRoomAsRead(selectedRoom._id).catch(() => {})
    setRooms(prev => prev.map(r => r._id === selectedRoom._id ? { ...r, unreadCount: 0 } : r))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom?._id])

  // ── Polling ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    pollTimerRef.current = setInterval(() => {
      const room = selectedRoomRef.current
      if (room) fetchMessages(room._id, true)
      fetchRooms(true)
    }, POLL_INTERVAL_MS)
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current) }
  }, [fetchMessages, fetchRooms])

  // ── Auto-scroll ───────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ── Room selection ────────────────────────────────────────────────────────────
  const selectRoom = (room: ChatRoom) => {
    setSelectedRoom(room)
    setMentionQuery(null)
    setShowOrderDrop(false)
  }

  // ── Mention detection ─────────────────────────────────────────────────────────
  const handleInputChange = (value: string) => {
    setNewMessage(value)
    const lastAt = value.lastIndexOf("@")
    if (lastAt >= 0 && lastAt === value.length - 1) {
      setMentionQuery("")
    } else if (lastAt >= 0 && !value.slice(lastAt + 1).includes(" ")) {
      setMentionQuery(value.slice(lastAt + 1))
    } else {
      setMentionQuery(null)
    }
  }

  const insertMention = (name: string) => {
    const lastAt = newMessage.lastIndexOf("@")
    setNewMessage(newMessage.slice(0, lastAt) + `@${name} `)
    setMentionQuery(null)
    inputRef.current?.focus()
  }

  // ── Send message ──────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedRoom || sending) return
    const content = newMessage.trim()
    const mentions = [...content.matchAll(/@([\w][\w\s]*[\w]|[\w]+)/g)].map(m => m[1].trim())
    const tmpId = `pending-${Date.now()}`

    const optimistic: LocalMessage = {
      _id: tmpId, content, senderName: myName, senderId: myId,
      createdAt: new Date().toISOString(), messageType: "text",
      mentions, isOwn: true, isPending: true,
    }
    setMessages(prev => [...prev, optimistic])
    setNewMessage("")
    setMentionQuery(null)
    setSending(true)

    if (mentions.length > 0) {
      setNotifications(prev => [{
        id: `n-${Date.now()}`,
        text: `${mentions.map(m => `@${m}`).join(", ")} ${t('teamChat.mentioned')}`,
        time: t('teamChat.timeNow'),
      }, ...prev.slice(0, 3)])
    }

    try {
      await sendChatMessage(selectedRoom._id, content)
      setMessages(prev => prev.map(m => m._id === tmpId ? { ...m, isPending: false } : m))
      setRooms(prev => prev.map(r => r._id === selectedRoom._id
        ? { ...r, lastMessage: { content, senderName: myName, createdAt: new Date().toISOString() } }
        : r
      ))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('teamChat.sendError')
      toast({ title: t('teamChat.sendError'), description: message, variant: "destructive" })
      setMessages(prev => prev.filter(m => m._id !== tmpId))
      setNewMessage(content)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
    if (e.key === "Escape") setMentionQuery(null)
  }

  // ── Share order status update ─────────────────────────────────────────────────
  const shareOrderUpdate = async (status: OrderStatus['status']) => {
    if (!selectedRoom) return
    setShowOrderDrop(false)
    const order: OrderStatus = {
      orderNumber: `R-${new Date().getFullYear()}-${String(Math.floor(10 + Math.random() * 89)).padStart(3, "0")}`,
      status,
      device: t('teamChat.deviceStatusUpdate'),
      assignedTo: myName,
    }
    const text = `📋 ${t('teamChat.order')} #${order.orderNumber} | ${order.device} | ${t('teamChat.status')}: ${t(STATUS_CONFIG[status].label)} | ${t('teamChat.assignedTo')}: ${order.assignedTo}`
    const tmpId = `pending-order-${Date.now()}`
    const optimistic: LocalMessage = {
      _id: tmpId, content: text, senderName: myName, senderId: myId,
      createdAt: new Date().toISOString(), messageType: "order_card",
      mentions: [], isOwn: true, isPending: true, orderCard: order,
    }
    setMessages(prev => [...prev, optimistic])
    try {
      await sendChatMessage(selectedRoom._id, text)
      setMessages(prev => prev.map(m => m._id === tmpId ? { ...m, isPending: false } : m))
      toast({ title: t('teamChat.statusShared'), description: `${order.orderNumber} – ${t(STATUS_CONFIG[status].label)}` })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('teamChat.sendError')
      toast({ title: t('common.error'), description: message, variant: "destructive" })
      setMessages(prev => prev.filter(m => m._id !== tmpId))
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────────────
  const filteredRooms = rooms.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.lastMessage?.content ?? "").toLowerCase().includes(search.toLowerCase())
  )
  const grouped: Partial<Record<string, ChatRoom[]>> = {}
  for (const r of filteredRooms) {
    const key = r.type === "announcement" ? "general" : (r.type ?? "general")
    if (!grouped[key]) grouped[key] = []
    grouped[key]!.push(r)
  }

  const totalUnread = rooms.reduce((s, r) => s + (r.unreadCount ?? 0), 0)
  const roomMembers = selectedRoom?.members ?? []

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -mx-3 sm:-mx-4 lg:-mx-6 -my-4 sm:-my-5 lg:-my-6">

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ background: "linear-gradient(135deg, #0f1d45 0%, #1a2a5e 60%, #2a3f7e 100%)" }}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-white/80" />
          <h1 className="text-sm font-semibold text-white tracking-wide">{t('teamChat.title')}</h1>
          {totalUnread > 0 && (
            <Badge className="h-4 min-w-[16px] text-[10px] px-1 bg-red-500 text-white border-0">{totalUnread}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            title={t('teamChat.notifications')}
            className="p-1 rounded hover:bg-white/10 relative transition-colors"
            onClick={() => notifications.length && toast({ title: t('teamChat.mentions'), description: notifications[0]?.text })}
          >
            <Bell className="h-3.5 w-3.5 text-white/80" />
            {notifications.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />}
          </button>
          <button title={t('teamChat.newChannel')} className="p-1 rounded hover:bg-white/10 transition-colors"
            onClick={() => setShowNewRoom(true)}>
            <Plus className="h-3.5 w-3.5 text-white/80" />
          </button>
          <button title={t('common.refresh')} className="p-1 rounded hover:bg-white/10 transition-colors"
            onClick={() => fetchRooms()}>
            <RefreshCw className={`h-3.5 w-3.5 text-white/80 ${roomsLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Notification strip */}
      {notifications.length > 0 && (
        <div className="px-3 py-1 bg-blue-50 border-b border-blue-100 shrink-0 flex items-center gap-2 overflow-x-auto">
          <AtSign className="h-3 w-3 text-blue-500 shrink-0" />
          <span className="text-[10px] text-blue-700 font-medium whitespace-nowrap">{notifications[0].text}</span>
          <span className="text-[10px] text-blue-400 ml-auto whitespace-nowrap">{notifications[0].time}</span>
          <button onClick={() => setNotifications(prev => prev.slice(1))}>
            <X className="h-3 w-3 text-blue-400 shrink-0" />
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar ── */}
        <div className="w-52 shrink-0 border-r flex flex-col bg-gray-50/60">

          {/* Search */}
          <div className="p-2 border-b shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder={`${t('common.search')}...`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-6 h-6 text-[11px] bg-white"
              />
            </div>
          </div>

          {/* Room list */}
          <ScrollArea className="flex-1">
            {roomsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : rooms.length === 0 ? (
              <div className="p-3 text-center">
                <p className="text-[11px] text-muted-foreground">{t('teamChat.noChannelsFound')}</p>
                <button
                  onClick={() => setShowNewRoom(true)}
                  className="mt-2 text-[11px] text-[#1a2a5e] font-medium hover:underline"
                >
                  {t('teamChat.createFirstChannel')}
                </button>
              </div>
            ) : (
              <div className="p-1.5 space-y-3">
                {(["general", "team", "project", "private"] as const).map(section => {
                  const sectionRooms = grouped[section]
                  if (!sectionRooms?.length) return null
                  return (
                    <div key={section}>
                      <div className="flex items-center justify-between px-1.5 mb-0.5">
                        <span className="text-[9px] font-bold text-muted-foreground tracking-wider">
                          {t(ROOM_SECTION_LABELS[section])}
                        </span>
                        {section !== "private" && (
                          <button
                            onClick={() => setShowNewRoom(true)}
                            title={t('teamChat.addChannel')}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Plus className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                      {sectionRooms.map(room => (
                        <button
                          key={room._id}
                          onClick={() => selectRoom(room)}
                          className={`w-full text-left rounded px-1.5 py-1 transition-colors ${
                            selectedRoom?._id === room._id
                              ? "bg-[#1a2a5e] text-white"
                              : "hover:bg-gray-100 text-gray-700"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {room.type === "general" ? (
                              <Hash className="h-3 w-3 shrink-0 opacity-60" />
                            ) : room.type === "private" ? (
                              <div className="relative shrink-0">
                                <Avatar className="h-4 w-4">
                                  <AvatarFallback className={`text-[8px] ${
                                    selectedRoom?._id === room._id ? "bg-white/20 text-white" : "bg-[#1a2a5e] text-white"
                                  }`}>
                                    {initials(roomMemberName(room.members[0]) || "?")}
                                  </AvatarFallback>
                                </Avatar>
                              </div>
                            ) : (
                              <Lock className="h-3 w-3 shrink-0 opacity-60" />
                            )}
                            <span className="text-[11px] font-medium truncate flex-1">{room.name}</span>
                            {(room.unreadCount ?? 0) > 0 && (
                              <Badge className={`h-3.5 min-w-[14px] text-[9px] px-1 border-0 shrink-0 ${
                                selectedRoom?._id === room._id ? "bg-white text-[#1a2a5e]" : "bg-[#1a2a5e] text-white"
                              }`}>
                                {room.unreadCount}
                              </Badge>
                            )}
                          </div>
                          {room.lastMessage?.content && (
                            <p className={`text-[9px] truncate mt-0.5 pl-4 ${
                              selectedRoom?._id === room._id ? "text-white/60" : "text-muted-foreground"
                            }`}>
                              {room.lastMessage.senderName}: {room.lastMessage.content}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>

          {/* Room members panel */}
          {roomMembers.length > 0 && (
            <div className="border-t p-2 shrink-0">
              <p className="text-[9px] font-bold text-muted-foreground tracking-wider mb-1">{t('teamChat.membersSection')}</p>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {roomMembers.slice(0, 8).map((m, i) => {
                  const name = roomMemberName(m)
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="relative shrink-0">
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className="bg-[#1a2a5e] text-white text-[8px]">{initials(name)}</AvatarFallback>
                        </Avatar>
                        <OnlineDot isOnline={false} />
                      </div>
                      <span className="text-[10px] text-gray-600 truncate">{name}</span>
                    </div>
                  )
                })}
                {roomMembers.length > 8 && (
                  <p className="text-[9px] text-muted-foreground">+{roomMembers.length - 8} {t('teamChat.more')}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Chat area ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedRoom ? (
            <div className="flex-1 flex items-center justify-center text-center">
              {roomsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <div>
                  <MessageSquare className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t('teamChat.selectOrCreateChannel')}</p>
                  <button
                    onClick={() => setShowNewRoom(true)}
                    className="mt-2 text-xs text-[#1a2a5e] font-medium hover:underline"
                  >
                    {t('teamChat.createNewChannel')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b bg-white shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  {selectedRoom.type === "general" ? (
                    <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : selectedRoom.type === "private" ? (
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-semibold text-sm truncate">{selectedRoom.name}</span>
                  {selectedRoom.description && (
                    <span className="text-[10px] text-muted-foreground hidden sm:block truncate">
                      – {selectedRoom.description}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{roomMembers.length}</span>
                  </div>
                  <button
                    title={t('teamChat.addMember')}
                    className="p-1 rounded hover:bg-gray-100"
                    onClick={() => toast({ title: t('teamChat.addMember'), description: t('teamChat.addMemberDescription') })}
                  >
                    <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 px-3 py-2">
                {msgLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-center">
                    <div>
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">{t('teamChat.noMessages')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {messages.map((msg, idx) => {
                      const prevMsg = messages[idx - 1]
                      const showSender = !prevMsg || prevMsg.senderId !== msg.senderId

                      if (msg.messageType === "order_card" && msg.orderCard) {
                        return (
                          <div key={msg._id} className="flex justify-center">
                            <div className="max-w-xs w-full">
                              <div className="text-[10px] text-center text-muted-foreground mb-0.5">
                                {t('teamChat.statusUpdateBy')} {msg.senderName} · {timeAgo(msg.createdAt, t)}
                                {msg.isPending && <span className="ml-1 opacity-50">({t('teamChat.sending')})</span>}
                              </div>
                              <OrderCard order={msg.orderCard} />
                            </div>
                          </div>
                        )
                      }

                      const hasMention =
                        msg.content.toLowerCase().includes(`@${myName.toLowerCase()}`) ||
                        msg.mentions.some(m => m.toLowerCase() === myName.toLowerCase())

                      return (
                        <div key={msg._id} className={`flex gap-2 ${msg.isOwn ? "flex-row-reverse" : "flex-row"}`}>
                          {!msg.isOwn && showSender && (
                            <Avatar className="h-6 w-6 mt-0.5 shrink-0">
                              <AvatarFallback className="bg-[#1a2a5e] text-white text-[9px]">
                                {initials(msg.senderName)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          {!msg.isOwn && !showSender && <div className="w-6 shrink-0" />}
                          <div className={`max-w-[70%] flex flex-col ${msg.isOwn ? "items-end" : "items-start"}`}>
                            {showSender && !msg.isOwn && (
                              <span className="text-[10px] text-muted-foreground font-medium mb-0.5">
                                {msg.senderName}
                              </span>
                            )}
                            <div className={`rounded-lg px-2.5 py-1.5 text-xs leading-relaxed ${
                              msg.isOwn
                                ? `bg-[#1a2a5e] text-white rounded-tr-sm ${msg.isPending ? "opacity-60" : ""}`
                                : hasMention
                                  ? "bg-yellow-50 border border-yellow-200 text-gray-800 rounded-tl-sm"
                                  : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
                            }`}>
                              {hasMention && !msg.isOwn && (
                                <span className="flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 mb-0.5">
                                  <AtSign className="h-2.5 w-2.5" /> {t('teamChat.mention')}
                                </span>
                              )}
                              <p className="break-words">{highlightMentions(msg.content)}</p>
                            </div>
                            <span className="text-[9px] text-muted-foreground mt-0.5">
                              {timeAgo(msg.createdAt, t)}{msg.isPending && ` · ${t('teamChat.sending')}…`}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              <Separator />

              {/* Input area */}
              <div className="px-3 py-2 bg-white shrink-0">
                <div className="relative flex items-center gap-1.5">

                  {/* Order status dropdown */}
                  <div className="relative shrink-0">
                    <button
                      title={t('teamChat.shareOrderStatus')}
                      onClick={() => setShowOrderDrop(v => !v)}
                      className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 text-[10px] text-muted-foreground transition-colors"
                    >
                      <Ticket className="h-3 w-3" />
                      <ChevronDown className="h-2.5 w-2.5" />
                    </button>
                    {showOrderDrop && (
                      <div className="absolute bottom-full mb-1 left-0 z-50 bg-white border rounded-lg shadow-lg py-1 min-w-[160px]">
                        <p className="text-[9px] text-muted-foreground px-2 py-0.5 font-semibold border-b mb-1">
                          {t('teamChat.shareStatus')}
                        </p>
                        {(Object.keys(STATUS_CONFIG) as OrderStatus['status'][]).map(s => {
                          const cfg = STATUS_CONFIG[s]
                          const Icon = cfg.icon
                          return (
                            <button key={s} onMouseDown={() => shareOrderUpdate(s)}
                              className="w-full text-left px-2 py-1 text-[10px] hover:bg-gray-50 flex items-center gap-2">
                              <Icon className="h-3 w-3" />{t(cfg.label)}
                            </button>
                          )
                        })}
                        <button
                          onMouseDown={() => setShowOrderDrop(false)}
                          className="w-full text-left px-2 py-1 text-[10px] text-muted-foreground hover:bg-gray-50 border-t mt-1"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Mention popover */}
                  {mentionQuery !== null && roomMembers.length > 0 && (
                    <MentionPopover query={mentionQuery} members={roomMembers} onSelect={insertMention} />
                  )}

                  <Input
                    ref={inputRef}
                    placeholder={t('teamChat.messagePlaceholder', { room: selectedRoom.name })}
                    value={newMessage}
                    onChange={e => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 h-7 text-xs"
                    disabled={sending}
                  />

                  <Button
                    onClick={handleSend}
                    disabled={!newMessage.trim() || sending}
                    className="h-7 w-7 p-0 shrink-0 bg-[#1a2a5e] hover:bg-[#0f1d45]"
                  >
                    {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  </Button>
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  {t('teamChat.inputHelp')}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Room Modal */}
      {showNewRoom && (
        <NewRoomModal
          onClose={() => setShowNewRoom(false)}
          onCreated={room => {
            setRooms(prev => [room, ...prev])
            setSelectedRoom(room)
          }}
        />
      )}
    </div>
  )
}
