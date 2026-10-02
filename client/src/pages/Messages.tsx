import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { SEO } from "@/components/SEO"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/useToast"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { CommunicationPanel } from "@/components/inspection/CommunicationPanel"
import {
  getInbox,
  getConversationThread,
  markConversationRead,
  InboxItem,
  InboxResponse,
  InboxSourceType,
  InboxFilter,
  ConversationThreadMessage,
} from "@/api/messages"
import { addComplaintComment } from "@/api/complaints"
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  ExternalLink,
  HelpCircle,
  Inbox,
  Lock,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  UserRound,
  Wrench,
  X,
} from "lucide-react"

/**
 * Zentrales Postfach: alle Gespräche zu Aufträgen, Reparaturanfragen und Reklamationen
 * (Admins zusätzlich Kontaktanfragen) an einem Ort. Links die Liste, rechts das Gespräch mit
 * Antwortfeld - kein Dialog, kein Seitenwechsel. Filter, Suche, Seite und geöffnetes Gespräch
 * stehen in der URL (/messages?thread=order:<id>&source=…&filter=…&q=…&page=…), damit Zurück,
 * Dashboard und Auftragsdetail genau dieses Gespräch öffnen.
 */

const PAGE_SIZE = 25
const SOURCE_KEYS: InboxSourceType[] = ['order', 'repair_request', 'complaint', 'contact']
const SOURCE_CHIP_LABEL: Record<InboxSourceType, string> = {
  order: 'Aufträge',
  repair_request: 'Reparaturanfragen',
  complaint: 'Reklamationen',
  contact: 'Kontaktanfragen',
}
const SOURCE_STYLE: Record<InboxSourceType, string> = {
  order: 'border-indigo-300 bg-indigo-50 text-indigo-800',
  repair_request: 'border-teal-300 bg-teal-50 text-teal-800',
  complaint: 'border-rose-300 bg-rose-50 text-rose-800',
  contact: 'border-slate-300 bg-slate-50 text-slate-700',
}
const SOURCE_FALLBACK_LABEL: Record<InboxSourceType, string> = {
  order: 'Auftrag',
  repair_request: 'Reparaturanfrage',
  complaint: 'Reklamation',
  contact: 'Kontaktanfrage',
}

const SourceIcon = ({ source, className = 'h-3.5 w-3.5' }: { source: InboxSourceType; className?: string }) => {
  if (source === 'order') return <Wrench className={className} aria-hidden="true" />
  if (source === 'repair_request') return <ClipboardList className={className} aria-hidden="true" />
  if (source === 'complaint') return <ShieldAlert className={className} aria-hidden="true" />
  return <Mail className={className} aria-hidden="true" />
}

const SourceBadge = ({ source, label }: { source: InboxSourceType; label?: string }) => (
  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${SOURCE_STYLE[source]}`}>
    <SourceIcon source={source} className="h-3 w-3" />
    {label || SOURCE_FALLBACK_LABEL[source]}
  </span>
)

const formatRelative = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diffMins < 1) return 'gerade eben'
  if (diffMins < 60) return `vor ${diffMins} Min.`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `vor ${diffHours} Std.`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'gestern'
  if (diffDays < 7) return `vor ${diffDays} Tagen`
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const parseThreadKey = (key: string | null): { sourceType: InboxSourceType; sourceId: string } | null => {
  if (!key) return null
  const [sourceType, sourceId] = key.split(':')
  if (!SOURCE_KEYS.includes(sourceType as InboxSourceType) || !/^[a-f0-9]{24}$/i.test(sourceId || '')) return null
  return { sourceType: sourceType as InboxSourceType, sourceId }
}

// "Kunde:", "Team:", "Sie:" bzw. "Intern:" vor der Vorschau - wer zuletzt geschrieben hat.
const senderPrefix = (item: InboxItem, isStaff: boolean) => {
  const last = item.lastMessage
  if (!last) return ''
  if (last.kind === 'internal') return 'Intern: '
  if (last.senderType === 'customer') return isStaff ? 'Kunde: ' : 'Sie: '
  if (last.senderType === 'system') return 'System: '
  return isStaff ? 'Team: ' : 'Team: '
}

// ---------------------------------------------------------------------------- Lesende Verläufe
function ReadOnlyMessages({ messages, isStaff }: { messages: ConversationThreadMessage[]; isStaff: boolean }) {
  return (
    <ol className="space-y-2.5">
      {messages.map((message) => {
        const isInternal = message.isInternal
        const kind = isInternal ? 'internal' : message.senderType
        const badge = isInternal ? 'Intern' : message.senderType === 'customer' ? (isStaff ? 'Kunde' : 'Sie') : message.senderType === 'system' ? 'System' : 'Team'
        return (
          <li
            key={message._id}
            className={`rounded-lg border p-3 ${kind === 'internal' ? 'border-dashed border-amber-400 bg-amber-50' : kind === 'customer' ? 'border-sky-200 bg-sky-50/50' : 'border-indigo-100 bg-white'}`}
          >
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${kind === 'internal' ? 'border-amber-400 bg-amber-100 text-amber-900' : kind === 'customer' ? 'border-sky-300 bg-sky-50 text-sky-800' : 'border-indigo-300 bg-indigo-50 text-indigo-800'}`}>
                {isInternal && <Lock className="h-3 w-3" aria-hidden="true" />}
                {badge}
              </span>
              <span className="font-medium text-foreground/80">{message.senderName}</span>
              <time dateTime={message.createdAt || ''} title={message.createdAt ? new Date(message.createdAt).toLocaleString('de-DE') : ''}>
                {formatRelative(message.createdAt)}
              </time>
              {isInternal && <span className="text-amber-900">Für Kunden nicht sichtbar</span>}
              {message.legacy && <span>(früheres Nachrichtensystem)</span>}
            </div>
            <p className="whitespace-pre-wrap break-words text-sm text-foreground">{message.content}</p>
          </li>
        )
      })}
    </ol>
  )
}

// Reklamations-Gespräch: Kommentare lesen + antworten (Personal mit klarer Zielgruppe).
function ComplaintConversation({ complaintId, isStaff, onChanged }: { complaintId: string; isStaff: boolean; onChanged: () => void }) {
  const { toast } = useToast()
  const [messages, setMessages] = useState<ConversationThreadMessage[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [internal, setInternal] = useState(false)
  const [sending, setSending] = useState(false)
  const sendingRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setState('loading')
      const thread = await getConversationThread('complaint', complaintId)
      setMessages(thread.messages)
      setState('ready')
    } catch (loadError: any) {
      setError(loadError?.message || '')
      setState('error')
    }
  }, [complaintId])

  useEffect(() => { load(false) }, [load])
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages.length])

  const send = async () => {
    if (sendingRef.current || !draft.trim()) return
    sendingRef.current = true
    setSending(true)
    try {
      await addComplaintComment(complaintId, draft.trim(), isStaff ? internal : undefined)
      toast({
        title: internal ? 'Interne Notiz gespeichert' : 'Nachricht gesendet',
        description: internal ? 'Nur für das Team sichtbar.' : isStaff ? 'Der Kunde wurde benachrichtigt.' : 'Das Team wurde benachrichtigt.',
      })
      setDraft('')
      setInternal(false)
      await load(true)
      onChanged()
    } catch (sendError: any) {
      toast({ title: 'Nicht gesendet', description: sendError?.message || 'Bitte erneut versuchen.', variant: 'destructive' })
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-white p-3" aria-live="polite">
        {state === 'loading' && <p className="text-sm text-muted-foreground" role="status">Verlauf wird geladen …</p>}
        {state === 'error' && (
          <div className="space-y-2" role="alert">
            <p className="text-sm font-semibold text-destructive">Der Verlauf konnte nicht geladen werden.</p>
            {error && <p className="text-xs text-muted-foreground">{error}</p>}
            <Button size="sm" variant="outline" onClick={() => load(false)}><RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />Erneut versuchen</Button>
          </div>
        )}
        {state === 'ready' && messages.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Nachrichten zu dieser Reklamation.</p>}
        {state === 'ready' && messages.length > 0 && <ReadOnlyMessages messages={messages} isStaff={isStaff} />}
      </div>
      <div className={`shrink-0 rounded-lg border-2 p-3 ${internal ? 'border-amber-400 bg-amber-50' : isStaff ? 'border-sky-300 bg-sky-50/60' : 'border-border bg-white'}`}>
        {isStaff && (
          <>
            <div className="mb-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Zielgruppe">
              <button type="button" role="radio" aria-checked={!internal} onClick={() => setInternal(false)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold ${!internal ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white'}`}>
                <Send className="h-3.5 w-3.5" aria-hidden="true" /> Nachricht an Kunden
              </button>
              <button type="button" role="radio" aria-checked={internal} onClick={() => setInternal(true)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold ${internal ? 'border-amber-500 bg-amber-500 text-white' : 'border-border bg-white'}`}>
                <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Interne Notiz
              </button>
            </div>
            <div className={`mb-2 flex items-start gap-2 rounded-md px-2.5 py-2 text-xs ${internal ? 'bg-amber-100 text-amber-950' : 'bg-sky-100 text-sky-950'}`} role="note">
              {internal ? <Lock className="mt-0.5 h-4 w-4" aria-hidden="true" /> : <UserRound className="mt-0.5 h-4 w-4" aria-hidden="true" />}
              <div>
                <p className="font-bold">{internal ? 'Intern – nur für das Team' : 'An Kunden'}</p>
                <p>{internal ? 'Nur für Mitarbeiter sichtbar. Der Kunde wird nicht benachrichtigt.' : 'Der Kunde sieht dies in seinem Kundenkonto und wird benachrichtigt.'}</p>
              </div>
            </div>
          </>
        )}
        <Label htmlFor={`complaint-draft-${complaintId}`} className="text-xs font-semibold">
          {!isStaff ? 'Nachricht an das Team' : internal ? 'Interne Notiz' : 'Nachricht an den Kunden'}
        </Label>
        <Textarea
          id={`complaint-draft-${complaintId}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault()
              send()
            }
          }}
          placeholder={!isStaff ? 'Ihre Nachricht …' : internal ? 'Notiz für das Team …' : 'Nachricht an den Kunden …'}
          className="mt-1 min-h-[72px] bg-white text-sm"
          disabled={sending || state === 'error'}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">Strg + Enter sendet</span>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setDraft('')} disabled={sending || !draft.trim()}>Entwurf verwerfen</Button>
            <Button type="button" size="sm" onClick={send} disabled={sending || !draft.trim() || state === 'error'} className={internal ? 'bg-amber-600 text-white hover:bg-amber-700' : ''}>
              {sending ? 'Wird gesendet …' : !isStaff ? 'Nachricht senden' : internal ? 'Interne Notiz speichern' : 'Nachricht an Kunden senden'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Frühere Nachrichten einer Reparaturanfrage (altes System, nur lesend).
function LegacyRepairRequestMessages({ requestId, isStaff }: { requestId: string; isStaff: boolean }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ConversationThreadMessage[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open || messages) return
    getConversationThread('repair_request', requestId)
      .then((thread) => setMessages(thread.messages))
      .catch((loadError: any) => setError(loadError?.message || 'Frühere Nachrichten konnten nicht geladen werden.'))
  }, [open, messages, requestId])
  return (
    <div className="shrink-0 rounded-lg border bg-slate-50 p-2">
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {open ? 'Frühere Nachrichten ausblenden' : 'Frühere Nachrichten anzeigen (altes Nachrichtensystem)'}
      </Button>
      {open && (
        <div className="max-h-56 overflow-y-auto p-2">
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          {!error && !messages && <p className="text-sm text-muted-foreground">Wird geladen …</p>}
          {messages && <ReadOnlyMessages messages={messages} isStaff={isStaff} />}
        </div>
      )}
    </div>
  )
}

function ContactConversation({ contactId }: { contactId: string }) {
  const [messages, setMessages] = useState<ConversationThreadMessage[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setMessages(null)
    setError('')
    getConversationThread('contact', contactId)
      .then((thread) => setMessages(thread.messages))
      .catch((loadError: any) => setError(loadError?.message || 'Kontaktanfrage konnte nicht geladen werden.'))
  }, [contactId])
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-white p-3">
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        {!error && !messages && <p className="text-sm text-muted-foreground" role="status">Wird geladen …</p>}
        {messages && <ReadOnlyMessages messages={messages} isStaff />}
      </div>
      <p className="shrink-0 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-700">
        Kontaktanfragen werden per E-Mail beantwortet. Bitte nutzen Sie dafür „Zu den Kontaktanfragen“ oben.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------- Seite
export function Messages() {
  const { user } = useAuth()
  const role = (user as any)?.role || 'customer'
  const isStaff = role === 'staff' || role === 'admin'
  const [searchParams, setSearchParams] = useSearchParams()

  const threadKey = searchParams.get('thread')
  const source = (SOURCE_KEYS.includes(searchParams.get('source') as InboxSourceType) ? searchParams.get('source') : 'all') as InboxSourceType | 'all'
  const filterParam = searchParams.get('filter')
  const filter: InboxFilter = filterParam === 'unread' || filterParam === 'awaiting_reply' ? filterParam : 'all'
  const q = searchParams.get('q') || ''
  const pages = Math.min(10, Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1))

  const [searchInput, setSearchInput] = useState(q)
  const [data, setData] = useState<InboxResponse | null>(null)
  const [items, setItems] = useState<InboxItem[]>([])
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [listError, setListError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const requestIdRef = useRef(0)

  const updateParams = useCallback((patch: Record<string, string | null>, replace = false) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === '' || (key === 'source' && value === 'all') || (key === 'filter' && value === 'all') || (key === 'page' && value === '1')) {
        next.delete(key)
      } else {
        next.set(key, value)
      }
    })
    setSearchParams(next, { replace })
  }, [searchParams, setSearchParams])

  // Suche serverseitig, entprellt.
  useEffect(() => { setSearchInput(q) }, [q])
  useEffect(() => {
    if (searchInput === q) return undefined
    const timer = window.setTimeout(() => updateParams({ q: searchInput.trim() || null, page: null }, true), 350)
    return () => window.clearTimeout(timer)
  }, [searchInput, q, updateParams])

  const loadList = useCallback(async (silent = false) => {
    const requestId = ++requestIdRef.current
    try {
      if (!silent) {
        setListState('loading')
        setListError('')
      }
      let collected: InboxItem[] = []
      let last: InboxResponse | null = null
      for (let page = 1; page <= pages; page += 1) {
        const response = await getInbox({ source, filter, q, page, limit: PAGE_SIZE })
        collected = [...collected, ...response.items]
        last = response
        if (!response.hasMore) break
      }
      if (requestId !== requestIdRef.current) return
      setItems(collected)
      setData(last)
      setListState('ready')
    } catch (error: any) {
      if (requestId !== requestIdRef.current) return
      if (!silent) {
        setListError(error?.message || 'Nachrichten konnten nicht geladen werden.')
        setListState('error')
      }
    }
  }, [source, filter, q, pages])

  useEffect(() => { loadList(false) }, [loadList])

  // Ruhige Aktualisierung (Zähler, neue Gespräche) nur bei sichtbarem Tab.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadList(true)
    }, 30000)
    return () => window.clearInterval(timer)
  }, [loadList])

  const loadMore = async () => {
    if (!data?.hasMore || loadingMore) return
    setLoadingMore(true)
    try {
      const response = await getInbox({ source, filter, q, page: data.page + 1, limit: PAGE_SIZE })
      setItems((prev) => [...prev, ...response.items.filter((item) => !prev.some((existing) => existing.key === item.key))])
      setData(response)
      updateParams({ page: String(data.page + 1) }, true)
    } catch (error: any) {
      setListError(error?.message || 'Weitere Gespräche konnten nicht geladen werden.')
    } finally {
      setLoadingMore(false)
    }
  }

  const selected = parseThreadKey(threadKey)
  const selectedItem = useMemo(() => items.find((item) => item.key === threadKey) || null, [items, threadKey])

  // Kontaktanfragen/Reklamationen als gelesen markieren, sobald sie geöffnet werden
  // (Aufträge und Reparaturanfragen markiert das Gesprächspanel selbst).
  useEffect(() => {
    if (!selected || (selected.sourceType !== 'contact' && selected.sourceType !== 'complaint')) return
    markConversationRead(selected.sourceType, selected.sourceId)
      .then(() => loadList(true))
      .catch(() => { /* nicht kritisch */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadKey])

  const handleRead = useCallback(() => {
    setItems((prev) => prev.map((item) => (item.key === threadKey ? { ...item, unreadCount: 0 } : item)))
    loadList(true)
  }, [threadKey, loadList])

  const counts = data?.counts
  const availableSources = data?.availableSources || []
  const sourceErrors = data?.sourceErrors || []
  const hasActiveFilter = source !== 'all' || filter !== 'all' || Boolean(q)

  const fallbackLink = (sourceType: InboxSourceType, sourceId: string) => {
    if (sourceType === 'order') return `/orders/${sourceId}`
    if (sourceType === 'repair_request') return isStaff ? `${role === 'admin' ? '/admin' : '/staff'}/repair-requests?requestId=${sourceId}` : `/my-repair-requests?requestId=${sourceId}`
    if (sourceType === 'complaint') return isStaff ? (role === 'admin' ? '/admin/complaints' : null) : `/my-complaints/${sourceId}`
    return role === 'admin' ? '/admin/contact-requests' : null
  }
  const linkLabelFor = (sourceType: InboxSourceType) => (
    sourceType === 'order' ? 'Zum Auftrag' : sourceType === 'repair_request' ? 'Zur Reparaturanfrage' : sourceType === 'complaint' ? 'Zur Reklamation' : 'Zu den Kontaktanfragen'
  )

  // ------------------------------------------------------------------ Liste
  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
      active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white text-foreground hover:bg-muted'
    }`

  const listPane = (
    <aside className={`flex min-h-0 flex-col gap-3 ${selected ? 'hidden lg:flex' : 'flex'}`} aria-label="Gespräche">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <label htmlFor="messages-search" className="sr-only">Gespräche durchsuchen</label>
        <input
          id="messages-search"
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={isStaff ? 'Auftrags-, Buchungs-, Anfrage-, Reklamationsnr., Kunde oder Gerät' : 'Auftrags-, Buchungs-, Anfrage- oder Reklamationsnummer, Gerät'}
          className="h-10 w-full rounded-md border bg-white pl-9 pr-9 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        {searchInput && (
          <button type="button" onClick={() => setSearchInput('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Suche leeren">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quelle">
        <button type="button" className={chip(source === 'all')} aria-pressed={source === 'all'} onClick={() => updateParams({ source: 'all', page: null })}>
          Alle
        </button>
        {availableSources.map(({ source: entry }) => (
          <button key={entry} type="button" className={chip(source === entry)} aria-pressed={source === entry} onClick={() => updateParams({ source: entry, page: null })}>
            <SourceIcon source={entry} />
            {SOURCE_CHIP_LABEL[entry]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status">
        <button type="button" className={chip(filter === 'all')} aria-pressed={filter === 'all'} onClick={() => updateParams({ filter: 'all', page: null })}>
          Alle{counts ? ` (${counts.all})` : ''}
        </button>
        <button type="button" className={chip(filter === 'unread')} aria-pressed={filter === 'unread'} onClick={() => updateParams({ filter: 'unread', page: null })}>
          Ungelesen{counts ? ` (${counts.unread})` : ''}
        </button>
        {isStaff && (
          <button type="button" className={chip(filter === 'awaiting_reply')} aria-pressed={filter === 'awaiting_reply'} onClick={() => updateParams({ filter: 'awaiting_reply', page: null })}>
            Antwort ausstehend{counts ? ` (${counts.awaitingReply})` : ''}
          </button>
        )}
      </div>
      {isStaff && (
        <p className="text-[11px] text-muted-foreground">
          „Ungelesen“ gilt nur für Sie. „Antwort ausstehend“ gilt für das ganze Team, bis jemand dem Kunden antwortet.
        </p>
      )}

      {sourceErrors.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
          <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4" aria-hidden="true" /> Nicht alle Nachrichten konnten geladen werden</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {sourceErrors.map((entry) => <li key={entry.source}>{entry.message}{source === 'all' && sourceErrors.length < availableSources.length ? ' Andere Nachrichten werden angezeigt.' : ''}</li>)}
          </ul>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => loadList(false)}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Erneut versuchen
          </Button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-white lg:max-h-[calc(100dvh-20rem)]">
        {listState === 'loading' && (
          <div className="space-y-2 p-3" role="status">
            <p className="text-sm text-muted-foreground">Nachrichten werden geladen …</p>
            {[1, 2, 3, 4].map((n) => <div key={n} className="h-16 animate-pulse rounded bg-muted" />)}
          </div>
        )}
        {listState === 'error' && (
          <div className="space-y-2 p-4" role="alert">
            <p className="font-semibold text-destructive">Nachrichten konnten nicht geladen werden.</p>
            <p className="text-xs text-muted-foreground">{listError}</p>
            <Button size="sm" variant="outline" onClick={() => loadList(false)}><RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />Erneut versuchen</Button>
          </div>
        )}
        {listState === 'ready' && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            {/* Quellenfehler nie als "keine Nachrichten" melden (K03). */}
            {sourceErrors.length > 0 ? (
              <p className="text-sm text-amber-900">Gespräche konnten nicht vollständig geladen werden – siehe Hinweis oben.</p>
            ) : (
              <p className="text-sm">{hasActiveFilter ? 'Keine Gespräche für diesen Filter.' : 'Noch keine Nachrichten.'}</p>
            )}
            {hasActiveFilter && (
              <Button size="sm" variant="outline" onClick={() => { setSearchInput(''); updateParams({ source: null, filter: null, q: null, page: null }) }}>
                Filter zurücksetzen
              </Button>
            )}
          </div>
        )}
        {listState === 'ready' && items.length > 0 && (
          <ul className="divide-y">
            {items.map((item) => {
              const active = item.key === threadKey
              const needsCustomerAnswer = !isStaff && (item.pendingQuestions > 0 || item.pendingActions > 0)
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => updateParams({ thread: item.key })}
                    aria-current={active ? 'true' : undefined}
                    className={`block w-full px-3 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${active ? 'bg-primary/10' : 'hover:bg-muted/60'}`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <SourceBadge source={item.sourceType} label={item.sourceLabel} />
                      <span className={`text-sm ${item.unreadCount > 0 ? 'font-bold' : 'font-semibold'} text-foreground`}>{item.title}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">{formatRelative(item.lastMessage?.createdAt || item.lastActivityAt)}</span>
                    </div>
                    {(item.customer || item.device || item.reference.bookingNumber) && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[item.customer?.name && `${item.customer.name}${item.customer.isGuest ? ' (Gast)' : ''}`, item.device, item.reference.bookingNumber && `Buchung ${item.reference.bookingNumber}`]
                          .filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {item.lastMessage && (
                      <p className={`mt-1 line-clamp-2 text-xs ${item.unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                        <span className="font-semibold">{senderPrefix(item, isStaff)}</span>{item.lastMessage.preview}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {item.unreadCount > 0 && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">{item.unreadCount} neu</span>
                      )}
                      {item.awaitingReply && (
                        <span className="rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">Antwort ausstehend</span>
                      )}
                      {isStaff && item.pendingQuestions > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"><HelpCircle className="h-3 w-3" aria-hidden="true" />Rückfrage offen</span>
                      )}
                      {needsCustomerAnswer && (
                        <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800">Ihre Antwort wird benötigt</span>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {listState === 'ready' && data?.hasMore && (
          <div className="border-t p-3 text-center">
            <Button size="sm" variant="outline" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Wird geladen …' : `Weitere laden (${items.length} von ${data.totalCount})`}
            </Button>
          </div>
        )}
      </div>
    </aside>
  )

  // ------------------------------------------------------------------ Gespräch
  const link = selected ? (selectedItem?.link ?? fallbackLink(selected.sourceType, selected.sourceId)) : null
  const readingPane = (
    <section className={`min-h-0 flex-col ${selected ? 'flex' : 'hidden lg:flex'}`} aria-label="Gespräch">
      {!selected ? (
        <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-white p-6 text-center text-muted-foreground">
          <MessageSquare className="h-10 w-10" aria-hidden="true" />
          <p className="text-sm">Wählen Sie links ein Gespräch aus.</p>
          <p className="text-xs">Antworten können Sie direkt hier schreiben.</p>
        </div>
      ) : (
        <div className="flex h-[78dvh] min-h-[480px] flex-col gap-3 rounded-lg border bg-white p-3 lg:h-[calc(100dvh-13rem)]">
          <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b pb-3">
            <div className="min-w-0 space-y-1">
              <Button type="button" variant="ghost" size="sm" className="-ml-2 lg:hidden" onClick={() => updateParams({ thread: null })}>
                <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Zurück zur Übersicht
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <SourceBadge source={selected.sourceType} label={selectedItem?.sourceLabel} />
                <h2 className="text-base font-bold text-foreground">{selectedItem?.title || SOURCE_FALLBACK_LABEL[selected.sourceType]}</h2>
              </div>
              {selectedItem && (selectedItem.customer || selectedItem.device || selectedItem.subtitle) && (
                <p className="text-xs text-muted-foreground">
                  {[selectedItem.customer && `${selectedItem.customer.name}${selectedItem.customer.email ? ` · ${selectedItem.customer.email}` : ''}${selectedItem.customer.isGuest ? ' (Gast)' : ''}`,
                    selectedItem.device, selectedItem.subtitle, selectedItem.reference.bookingNumber && `Buchung ${selectedItem.reference.bookingNumber}`]
                    .filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            {link && (
              <Button asChild variant="outline" size="sm">
                <Link to={link}>
                  {selectedItem?.linkLabel || linkLabelFor(selected.sourceType)} <ExternalLink className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Button>
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            {selected.sourceType === 'order' && (
              <CommunicationPanel
                key={selected.sourceId}
                orderId={selected.sourceId}
                entityType="order"
                layout="fill"
                hideTitle
                onRead={handleRead}
                onSent={() => loadList(true)}
              />
            )}
            {selected.sourceType === 'repair_request' && (
              <>
                {(selectedItem?.legacyMessageCount || 0) > 0 && <LegacyRepairRequestMessages requestId={selected.sourceId} isStaff={isStaff} />}
                <div className="flex min-h-0 flex-1 flex-col">
                  <CommunicationPanel
                    key={selected.sourceId}
                    orderId={selected.sourceId}
                    entityType="repair-request"
                    layout="fill"
                    hideTitle
                    onRead={handleRead}
                    onSent={() => loadList(true)}
                  />
                </div>
              </>
            )}
            {selected.sourceType === 'complaint' && (
              <ComplaintConversation key={selected.sourceId} complaintId={selected.sourceId} isStaff={isStaff} onChanged={() => loadList(true)} />
            )}
            {selected.sourceType === 'contact' && <ContactConversation key={selected.sourceId} contactId={selected.sourceId} />}
          </div>
        </div>
      )}
    </section>
  )

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
      <SEO
        title="Nachrichten – McRepair.de Kundenportal"
        description="Alle Gespräche zu Aufträgen, Reparaturanfragen und Reklamationen an einem Ort."
        canonical="/messages"
        noindex={true}
      />
      <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nachrichten</h1>
          <p className="text-sm text-muted-foreground">
            Alle Gespräche zu Aufträgen, Reparaturanfragen und Reklamationen an einem Ort{role === 'admin' ? ' – inklusive Kontaktanfragen' : ''}.
          </p>
        </div>
        {counts && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            <span className="font-semibold text-foreground">{counts.unread}</span> ungelesen
            {isStaff && <> · <span className="font-semibold text-foreground">{counts.awaitingReply}</span> Antwort ausstehend</>}
          </p>
        )}
      </header>
      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
        {listPane}
        {readingPane}
      </div>
    </div>
  )
}

export default Messages
