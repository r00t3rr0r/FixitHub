import { useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useToast } from "@/hooks/useToast"
import {
  trackGuestRepairRequest,
  getGuestRepairRequestCommunication,
  sendGuestRepairRequestMessage,
  GuestTrackAccess,
} from "@/api/guestRepairRequest"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Droplets,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Wrench,
  XCircle,
  ChevronDown,
  ChevronUp,
  User,
} from "lucide-react"

// ─────────────────────────── helpers ───────────────────────────

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: "Ausstehend",
    color: "border-amber-200 bg-amber-50 text-amber-800",
    icon: <Clock className="h-4 w-4 text-amber-600" />,
  },
  reviewing: {
    label: "In Prüfung",
    color: "border-blue-200 bg-blue-50 text-blue-800",
    icon: <Search className="h-4 w-4 text-blue-600" />,
  },
  approved: {
    label: "Genehmigt",
    color: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  },
  rejected: {
    label: "Abgelehnt",
    color: "border-red-200 bg-red-50 text-red-800",
    icon: <XCircle className="h-4 w-4 text-red-500" />,
  },
  converted: {
    label: "In Auftrag umgewandelt",
    color: "border-purple-200 bg-purple-50 text-purple-800",
    icon: <Wrench className="h-4 w-4 text-purple-600" />,
  },
}

const STEP_LABELS = ["Ausstehend", "In Prüfung", "Genehmigt / Abgelehnt"]
const STATUS_TO_STEP: Record<string, number> = {
  pending: 0,
  reviewing: 1,
  approved: 2,
  rejected: 2,
  converted: 2,
}

function StatusStepper({ status }: { status: string }) {
  const step = STATUS_TO_STEP[status] ?? 0
  return (
    <div className="flex items-center gap-0">
      {STEP_LABELS.map((label, i) => {
        const done = i < step
        const active = i === step
        return (
          <div key={label} className="flex min-w-0 flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition
                  ${done ? "border-[#1a2a5e] bg-[#1a2a5e] text-white" : active ? "border-[#f5b800] bg-[#f5b800] text-[#1a2a5e]" : "border-slate-300 bg-white text-slate-400"}`}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`hidden text-center text-[9px] font-semibold leading-tight sm:block ${active ? "text-[#1a2a5e]" : done ? "text-[#1a2a5e]/70" : "text-slate-400"}`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`mx-1 h-0.5 flex-1 ${i < step ? "bg-[#1a2a5e]" : "bg-slate-200"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function MessageBubble({ msg }: { msg: any }) {
  const isStaff = msg.senderType === "staff" || msg.senderRole === "staff" || msg.senderRole === "admin"
  const isSystem = msg.senderType === "system"
  if (isSystem) {
    return (
      <div className="mx-auto max-w-xs rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-center text-[10px] text-slate-500">
        {msg.content}
      </div>
    )
  }
  return (
    <div className={`flex gap-2 ${isStaff ? "flex-row" : "flex-row-reverse"}`}>
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold
          ${isStaff ? "bg-[#1a2a5e] text-white" : "bg-[#f5b800] text-[#1a2a5e]"}`}
      >
        {isStaff ? "MC" : <User className="h-3.5 w-3.5" />}
      </div>
      <div className={`max-w-[80%] ${isStaff ? "items-start" : "items-end"} flex flex-col gap-0.5`}>
        <span className="text-[10px] font-semibold text-slate-500">
          {isStaff ? "McRepair Team" : "Sie"} · {new Date(msg.createdAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </span>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
            ${isStaff
              ? "rounded-tl-sm bg-[#f0f4ff] text-[#1a2a5e]"
              : "rounded-tr-sm bg-[#1a2a5e] text-white"}`}
        >
          {msg.content}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────── main component ───────────────────────────

export function GuestRepairRequestTracking() {
  const { toast } = useToast()
  const [searchParams] = useSearchParams()

  const [token, setToken] = useState(searchParams.get("token") || "")
  const [email, setEmail] = useState(searchParams.get("email") || "")
  const [tokenInput, setTokenInput] = useState(searchParams.get("token") || "")
  const [emailInput, setEmailInput] = useState(searchParams.get("email") || "")

  const [loading, setLoading] = useState(false)
  const [repairRequest, setRepairRequest] = useState<any | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [communication, setCommunication] = useState<any | null>(null)
  const [commLoading, setCommLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)

  const [showDetails, setShowDetails] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const access: GuestTrackAccess = { token, email }

  // Auto-load when URL params are present
  useEffect(() => {
    if (token && email) {
      loadRequest(token, email)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [communication?.messages?.length])

  // Periodic communication refresh
  useEffect(() => {
    if (!repairRequest?._id) return
    const interval = setInterval(() => loadCommunication(repairRequest._id, access, false), 10000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repairRequest?._id, token, email])

  const loadRequest = async (t = token, e = email) => {
    if (!t || !e) return
    try {
      setLoading(true)
      setNotFound(false)
      const req = await trackGuestRepairRequest(t, e)
      setRepairRequest(req)
      setToken(t)
      setEmail(e)
      // Load communication thread
      await loadCommunication(req._id, { token: t, email: e }, true)
    } catch (err: any) {
      setNotFound(true)
      setRepairRequest(null)
      toast({ title: "Nicht gefunden", description: err.message || "Anfrage konnte nicht geladen werden.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const loadCommunication = async (requestId: string, acc: GuestTrackAccess, showLoader = false) => {
    try {
      if (showLoader) setCommLoading(true)
      const comm = await getGuestRepairRequestCommunication(requestId, acc)
      setCommunication(comm)
    } catch {
      // silently ignore
    } finally {
      if (showLoader) setCommLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadRequest(tokenInput.trim(), emailInput.trim().toLowerCase())
  }

  const handleRefresh = async () => {
    if (!repairRequest?._id) return
    setRefreshing(true)
    try {
      const req = await trackGuestRepairRequest(token, email)
      setRepairRequest(req)
      await loadCommunication(req._id, access, false)
    } catch {
      // silently ignore
    } finally {
      setRefreshing(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || !repairRequest?._id) return
    try {
      setSending(true)
      const updated = await sendGuestRepairRequestMessage(repairRequest._id, access, message.trim())
      setCommunication(updated)
      setMessage("")
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message || "Nachricht konnte nicht gesendet werden.", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const statusMeta = repairRequest ? (STATUS_META[repairRequest.status] ?? STATUS_META.pending) : null

  // ─── render ───

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_-10%,rgba(245,184,0,0.14),transparent_42%),radial-gradient(circle_at_100%_0%,rgba(26,42,94,0.18),transparent_48%),linear-gradient(180deg,#f8fbff_0%,#eef3fb_42%,#f5f8fe_100%)]">

      {/* Hero Banner */}
      <section className="relative overflow-hidden border-b border-white/20 bg-[linear-gradient(132deg,#1a2a5e_0%,#21408e_54%,#2e5cc1_100%)] px-4 py-10 text-white sm:px-6 sm:py-14">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-8 h-48 w-48 rounded-full bg-yellow-300/15 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-3xl">
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Zurück zur Startseite
          </Link>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-blue-50">
              <ShieldCheck className="h-3 w-3" /> McRepair Service
            </span>
          </div>

          <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Reparaturanfrage verfolgen
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
            Geben Sie Ihr Tracking-Token und Ihre E-Mail-Adresse ein, um den aktuellen Status Ihrer Anfrage einzusehen und mit unserem Team zu kommunizieren.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">

        {/* Search Card */}
        {!repairRequest && (
          <Card className="border border-slate-200/90 bg-white/95 shadow-[0_14px_42px_-24px_rgba(15,23,42,0.4)]">
            <CardHeader className="border-b border-slate-100/80 pb-3 pt-4">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-[#1a2a5e] sm:text-lg">
                <Search className="h-5 w-5" /> Anfrage suchen
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="track-token" className="text-xs font-semibold text-slate-700">
                    Tracking-Token <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="track-token"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Ihr persönlicher Tracking-Code aus der E-Mail"
                    className="h-9 border-slate-300 bg-white font-mono text-sm placeholder:font-sans placeholder:text-slate-400 focus-visible:border-[#1a2a5e] focus-visible:ring-[#1a2a5e]/20"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="track-email" className="text-xs font-semibold text-slate-700">
                    E-Mail-Adresse <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="track-email"
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="Die bei der Anfrage verwendete E-Mail"
                    className="h-9 border-slate-300 bg-white text-sm placeholder:text-slate-400 focus-visible:border-[#1a2a5e] focus-visible:ring-[#1a2a5e]/20"
                    required
                  />
                </div>
                {notFound && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Keine Anfrage mit diesen Daten gefunden. Bitte prüfen Sie Token und E-Mail.
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-10 w-full bg-[#1a2a5e] font-bold hover:bg-[#0f1d45]"
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Wird gesucht…</>
                  ) : (
                    <><Search className="mr-2 h-4 w-4" /> Anfrage abrufen</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Loading skeleton */}
        {loading && !repairRequest && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-[#1a2a5e]" />
          </div>
        )}

        {/* Repair Request Details */}
        {repairRequest && (
          <>
            {/* Status Card */}
            <Card className="border border-slate-200/90 bg-white/95 shadow-[0_14px_42px_-24px_rgba(15,23,42,0.4)]">
              <CardHeader className="border-b border-slate-100/80 pb-3 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Anfrage-Nr.</p>
                    <p className="text-lg font-extrabold text-[#1a2a5e]">{repairRequest.requestNumber}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta?.color}`}>
                      {statusMeta?.icon}
                      {statusMeta?.label}
                    </div>
                    <button
                      type="button"
                      onClick={handleRefresh}
                      disabled={refreshing}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                      title="Aktualisieren"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                {/* Stepper */}
                {repairRequest.status !== "rejected" && (
                  <StatusStepper status={repairRequest.status} />
                )}
                {repairRequest.status === "rejected" && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <XCircle className="h-4 w-4 shrink-0" />
                    Ihre Reparaturanfrage wurde leider abgelehnt. Bei Fragen wenden Sie sich an unser Team.
                  </div>
                )}
                {repairRequest.status === "converted" && (
                  <div className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-purple-800">
                    <Wrench className="h-4 w-4 shrink-0" />
                    Ihre Anfrage wurde in einen Reparaturauftrag umgewandelt.
                  </div>
                )}

                {/* Device summary */}
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white">
                    <Smartphone className="h-5 w-5 text-[#1a2a5e]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#1a2a5e]">
                      {repairRequest.deviceBrand} {repairRequest.deviceModel}
                    </p>
                    <p className="text-xs text-slate-500">{repairRequest.deviceType}</p>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Eingegangen</p>
                    <p className="mt-0.5 text-xs font-bold text-[#1a2a5e]">
                      {new Date(repairRequest.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </p>
                  </div>
                  {repairRequest.reviewDeadline && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Frist</p>
                      <p className="mt-0.5 text-xs font-bold text-[#1a2a5e]">
                        {new Date(repairRequest.reviewDeadline).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </p>
                    </div>
                  )}
                  {repairRequest.estimatedCost > 0 && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Kostenschätzung</p>
                      <p className="mt-0.5 text-xs font-bold text-emerald-900">
                        {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(repairRequest.estimatedCost)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Details toggle */}
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-[#1a2a5e] transition hover:bg-slate-100"
                >
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Anfrage-Details
                  </span>
                  {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showDetails && (
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Fehlerbeschreibung</p>
                      <p className="mt-1 text-slate-800">{repairRequest.issueDescription}</p>
                    </div>
                    {repairRequest.issueOccurredDate && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Defekt aufgetreten</p>
                        <p className="mt-0.5 text-slate-800">{repairRequest.issueOccurredDate}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Wasserschaden</p>
                        <p className="mt-0.5 text-slate-800 capitalize">
                          {{ no: "Nein", yes: "Ja", unsure: "Unbekannt" }[repairRequest.waterDamage as string] ?? repairRequest.waterDamage}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Vorherige Reparaturen</p>
                        <p className="mt-0.5 text-slate-800 capitalize">
                          {{ no: "Nein", yes: "Ja", unsure: "Unbekannt" }[repairRequest.repairAttempts as string] ?? (repairRequest.repairAttempts || "Nein")}
                        </p>
                      </div>
                    </div>
                    {repairRequest.images?.length > 0 && (
                      <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Bilder ({repairRequest.images.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {repairRequest.images.map((src: string, i: number) => (
                            <img
                              key={i}
                              src={src}
                              alt={`Bild ${i + 1}`}
                              className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Communication Card */}
            <Card className="border border-slate-200/90 bg-white/95 shadow-[0_14px_42px_-24px_rgba(15,23,42,0.4)]">
              <CardHeader className="border-b border-slate-100/80 pb-3 pt-4">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-[#1a2a5e] sm:text-lg">
                  <MessageSquare className="h-5 w-5" /> Nachrichten
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {commLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-[#1a2a5e]" />
                  </div>
                ) : (
                  <>
                    {/* Message thread */}
                    <div className="mb-4 max-h-[360px] min-h-[120px] overflow-y-auto rounded-xl border border-slate-100 bg-[#f8fafc] p-3 sm:max-h-[440px]">
                      {!communication?.messages?.length ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-slate-400">
                          <MessageSquare className="h-8 w-8 opacity-40" />
                          <p>Noch keine Nachrichten. Unser Team meldet sich in Kürze.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {communication.messages.map((msg: any) => (
                            <MessageBubble key={msg._id || msg.createdAt} msg={msg} />
                          ))}
                          <div ref={messagesEndRef} />
                        </div>
                      )}
                    </div>

                    <Separator className="mb-4" />

                    {/* Message input */}
                    {repairRequest.status !== "rejected" ? (
                      <form onSubmit={handleSendMessage} className="space-y-2">
                        <Textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Nachricht an das McRepair-Team…"
                          rows={3}
                          className="resize-none border-slate-300 text-sm focus-visible:border-[#1a2a5e] focus-visible:ring-[#1a2a5e]/20"
                          disabled={sending}
                        />
                        <Button
                          type="submit"
                          disabled={!message.trim() || sending}
                          className="h-9 w-full bg-[#1a2a5e] font-semibold hover:bg-[#0f1d45] sm:w-auto"
                        >
                          {sending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Wird gesendet…</>
                          ) : (
                            <><Send className="mr-2 h-4 w-4" /> Senden</>
                          )}
                        </Button>
                      </form>
                    ) : (
                      <p className="text-center text-xs text-slate-400">
                        Anfragekanal geschlossen. Für Rückfragen wenden Sie sich per E-Mail an uns.
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Track another request */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => { setRepairRequest(null); setCommunication(null); setNotFound(false) }}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <Search className="h-3.5 w-3.5" /> Andere Anfrage suchen
              </button>
            </div>
          </>
        )}

        {/* Help hint */}
        {!repairRequest && !loading && (
          <div className="rounded-xl border border-[#1a2a5e]/10 bg-[#1a2a5e]/5 px-4 py-4 text-sm text-[#1a2a5e]">
            <p className="font-semibold">Wo finde ich mein Tracking-Token?</p>
            <p className="mt-1 text-[#1a2a5e]/80">
              Nach dem Absenden Ihrer Gast-Reparaturanfrage haben wir Ihnen eine Bestätigungs-E-Mail gesendet.
              Diese enthält einen direkten Link sowie das Token zum manuellen Eintragen.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
