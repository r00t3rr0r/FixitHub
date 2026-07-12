import { useEffect, useRef, useState } from "react"
import { SEO } from '@/components/SEO'
import { Link, useSearchParams } from "react-router-dom"
import { useToast } from "@/hooks/useToast"
import {
  trackGuestRepairRequest,
  getGuestRepairRequestCommunication,
  sendGuestRepairRequestMessage,
  GuestTrackAccess,
} from "@/api/guestRepairRequest"
import { searchDevices } from "@/api/devices"
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
  User,
  Wrench,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

// ─── helpers ────────────────────────────────────────────────────────────────

function statusStyle(status: string) {
  switch (status) {
    case "pending":   return "border-amber-200 bg-amber-50 text-amber-800"
    case "reviewing": return "border-sky-200 bg-sky-50 text-sky-800"
    case "approved":  return "border-emerald-200 bg-emerald-50 text-emerald-800"
    case "rejected":  return "border-rose-200 bg-rose-50 text-rose-800"
    case "converted": return "border-purple-200 bg-purple-50 text-purple-800"
    default:          return "border-slate-200 bg-slate-50 text-slate-700"
  }
}

function statusLabel(status: string) {
  return (
    { pending: "Ausstehend", reviewing: "In Prüfung", approved: "Genehmigt", rejected: "Abgelehnt", converted: "In Auftrag umgewandelt" }[status] ?? status
  )
}

function statusIcon(status: string) {
  switch (status) {
    case "pending":   return <Clock className="h-3.5 w-3.5" />
    case "reviewing": return <TrendingUp className="h-3.5 w-3.5" />
    case "approved":  return <CheckCircle2 className="h-3.5 w-3.5" />
    case "rejected":  return <XCircle className="h-3.5 w-3.5" />
    case "converted": return <Wrench className="h-3.5 w-3.5" />
    default:          return null
  }
}

const STEPS = [
  { label: "Eingegangen" },
  { label: "In Prüfung" },
  { label: "Entschieden" },
]
const stepIndex = (status: string) =>
  status === "approved" || status === "rejected" || status === "converted" ? 2
  : status === "reviewing" ? 1
  : 0

function StatusStepper({ status }: { status: string }) {
  const active   = stepIndex(status)
  const rejected = status === "rejected"
  return (
    <div className="flex w-full items-start">
      {STEPS.map((step, i) => {
        const done    = i < active
        const current = i === active
        const isLast  = i === STEPS.length - 1
        return (
          <div key={step.label} className={`flex items-center ${isLast ? "shrink-0" : "flex-1"}`}>
            {/* Step bubble + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition
                  ${done    ? "border-[#1a2a5e] bg-[#1a2a5e] text-white"
                  : current && rejected ? "border-rose-500 bg-rose-500 text-white"
                  : current ? "border-[#f5b800] bg-[#f5b800] text-[#1a2a5e]"
                  : "border-slate-200 bg-white text-slate-400"}`}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`hidden text-center text-[10px] font-semibold leading-tight sm:block
                  ${current ? "text-[#1a2a5e]" : done ? "text-slate-500" : "text-slate-400"}`}
              >
                {step.label}
              </span>
            </div>
            {/* Connector line (full remaining width between bubbles) */}
            {!isLast && (
              <div className={`mx-2 mb-5 h-0.5 flex-1 rounded-full ${i < active ? "bg-[#1a2a5e]" : "bg-slate-200"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function MessageBubble({ msg }: { msg: any }) {
  const isStaff  = ["staff", "admin"].includes(msg.senderRole) || msg.senderType === "staff"
  const isSystem = msg.senderType === "system"

  if (isSystem) {
    return (
      <div className="mx-auto max-w-[85%] rounded-full border border-slate-200 bg-white px-4 py-1.5 text-center text-[11px] text-slate-500 shadow-sm">
        {msg.content}
      </div>
    )
  }

  const time = new Date(msg.createdAt).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  })

  return (
    <div className={`flex gap-2.5 ${isStaff ? "" : "flex-row-reverse"}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold
          ${isStaff ? "bg-[#1a2a5e] text-white" : "bg-[#f5b800] text-[#1a2a5e]"}`}
      >
        {isStaff ? "MC" : <User className="h-3.5 w-3.5" />}
      </div>
      <div className={`flex max-w-[78%] flex-col gap-1 ${isStaff ? "items-start" : "items-end"}`}>
        <span className="text-[10px] font-medium text-slate-400">
          {isStaff ? "McRepair Team" : "Sie"} · {time}
        </span>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm
            ${isStaff ? "rounded-tl-sm bg-slate-100 text-slate-800" : "rounded-tr-sm bg-[#1a2a5e] text-white"}`}
        >
          {msg.content}
        </div>
      </div>
    </div>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export function GuestRepairRequestTracking() {
  const { toast } = useToast()
  const [searchParams] = useSearchParams()

  const [token, setToken]           = useState(searchParams.get("token") || "")
  const [email, setEmail]           = useState(searchParams.get("email") || "")
  const [tokenInput, setTokenInput] = useState(searchParams.get("token") || "")
  const [emailInput, setEmailInput] = useState(searchParams.get("email") || "")

  const [loading, setLoading]             = useState(false)
  const [repairRequest, setRepairRequest] = useState<any | null>(null)
  const [notFound, setNotFound]           = useState(false)
  const [deviceImage, setDeviceImage]     = useState<string | null>(null)

  const [communication, setCommunication] = useState<any | null>(null)
  const [commLoading, setCommLoading]     = useState(false)
  const [message, setMessage]             = useState("")
  const [sending, setSending]             = useState(false)
  const [refreshing, setRefreshing]       = useState(false)
  const [showDetails, setShowDetails]     = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const access: GuestTrackAccess = { token, email }

  useEffect(() => {
    if (token && email) loadRequest(token, email)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Resolve device model image from catalog
  useEffect(() => {
    if (!repairRequest) { setDeviceImage(null); return }
    let cancelled = false
    const rr = repairRequest as any

    // 1. Check direct fields populated by the server
    const direct = [
      rr.deviceModelId?.image,
      rr.deviceModelId?.images?.[0]?.url,
      rr.deviceModelId?.images?.[0]?.base64,
    ].find((v): v is string => typeof v === "string" && v.trim().length > 0)

    if (direct) { setDeviceImage(direct); return }

    // 2. Fall back to device catalog search
    const brand = rr.deviceBrand || ""
    const model = rr.deviceModel || ""
    if (!model) return

    const normalize = (s = "") => s.toLowerCase().replace(/\s+/g, " ").trim()
    const normalizeCompact = (s = "") => normalize(s).replace(/[^a-z0-9]/g, "")
    const nb = normalize(brand)
    const nm = normalize(model)
    const nc = normalizeCompact(model)

    ;(async () => {
      const queries = [`${brand} ${model}`.trim(), model]
        .filter((q, i, a) => q && a.indexOf(q) === i)
      for (const q of queries) {
        try {
          const res = await searchDevices(q)
          const devices: any[] = res?.devices || []
          const best =
            devices.find((d) => d.image && normalize(d.name) === nm && (!nb || normalize(d.manufacturer) === nb)) ||
            devices.find((d) => d.image && normalize(d.name) === nm) ||
            devices.find((d) => d.image && normalizeCompact(d.name) === nc) ||
            devices.find((d) => d.image)
          if (best?.image) {
            if (!cancelled) setDeviceImage(best.image)
            return
          }
        } catch { /* silent */ }
      }
    })()

    return () => { cancelled = true }
  }, [repairRequest?._id, repairRequest?.deviceBrand, repairRequest?.deviceModel])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [communication?.messages?.length])

  useEffect(() => {
    if (!repairRequest?._id) return
    const id = setInterval(() => loadCommunication(repairRequest._id, access, false), 10_000)
    return () => clearInterval(id)
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
      await loadCommunication(req._id, { token: t, email: e }, true)
    } catch (err: any) {
      setNotFound(true)
      setRepairRequest(null)
      toast({ title: "Nicht gefunden", description: err.message || "Keine Anfrage mit diesen Daten gefunden.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const loadCommunication = async (id: string, acc: GuestTrackAccess, showLoader = false) => {
    if (showLoader) setCommLoading(true)
    try {
      const comm = await getGuestRepairRequestCommunication(id, acc)
      setCommunication(comm)
    } catch { /* silent */ } finally {
      if (showLoader) setCommLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadRequest(tokenInput.trim(), emailInput.trim().toLowerCase())
  }

  const handleRefresh = async () => {
    if (!repairRequest?._id || refreshing) return
    setRefreshing(true)
    try {
      const req = await trackGuestRepairRequest(token, email)
      setRepairRequest(req)
      await loadCommunication(req._id, access, false)
    } catch { /* silent */ } finally {
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

  // ─── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_-10%,rgba(245,184,0,0.14),transparent_42%),radial-gradient(circle_at_100%_0%,rgba(26,42,94,0.18),transparent_48%),linear-gradient(180deg,#f8fbff_0%,#eef3fb_42%,#f5f8fe_100%)]">
      <SEO
        title="Reparaturanfrage verfolgen – McRepair.de"
        description="Verfolgen Sie Ihre Reparaturanfrage ganz ohne Login. Geben Sie Ihre Vorgangsnummer ein und prüfen Sie den aktuellen Status."
        canonical="/guest-repair-tracking"
      />
      <div className="container max-w-3xl py-6 sm:py-10">

        {/* ── Hero Card ── */}
        <div className="mb-6 w-full overflow-hidden rounded-[18px] border-b border-[#2a3f7e] bg-gradient-to-br from-[#1a2a5e] to-[#0f1d45] px-5 py-7 text-white sm:rounded-2xl sm:px-8 sm:py-10">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-white/80 transition-colors hover:text-[#f5b800]"
          >
            <ChevronLeft className="h-4 w-4" />
            Zurück zur Startseite
          </Link>

          <div className="flex items-start gap-4 sm:items-center">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f5b800]/20">
              <Wrench className="h-7 w-7 text-[#f5b800]" />
            </div>
            <div>
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-100">
                  <ShieldCheck className="h-2.5 w-2.5" /> McRepair Service
                </span>
              </div>
              <h1 className="text-[1.6rem] font-extrabold leading-tight tracking-tight sm:text-3xl">
                Reparaturanfrage verfolgen
              </h1>
              <p className="mt-1 text-sm leading-snug text-white/75 sm:text-[0.95rem]">
                Prüfen Sie den Status Ihrer Anfrage und kommunizieren Sie direkt mit unserem Team.
              </p>
            </div>
          </div>
        </div>

        {/* ── Search Form ── */}
        {!repairRequest && (
          <Card className="border-none bg-white shadow-lg">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2.5 text-lg text-[#1a2a5e]">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[rgba(26,42,94,0.08)]">
                  <Search className="h-4 w-4 text-[#1a2a5e]" />
                </span>
                Anfrage suchen
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSearch} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">
                    E-Mail-Adresse <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="Die bei der Anfrage verwendete E-Mail"
                      className="h-11 pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Tracking-Token <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="text"
                      required
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder="Ihr persönlicher Tracking-Code aus der E-Mail"
                      className="h-11 pl-10 font-mono text-sm placeholder:font-sans"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Den Tracking-Code finden Sie in der Bestätigungs-E-Mail nach dem Absenden Ihrer Anfrage.
                  </p>
                </div>

                {notFound && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Keine Anfrage mit diesen Daten gefunden. Bitte prüfen Sie Token und E-Mail.
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full bg-[#f5b800] font-bold text-[#1a2a5e] hover:bg-[#e5ab00]"
                >
                  {loading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Wird gesucht…</>
                    : <><Search className="mr-2 h-4 w-4" /> Anfrage abrufen</>}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── Loading ── */}
        {loading && !repairRequest && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#1a2a5e]" />
          </div>
        )}

        {/* ── Request Details ── */}
        {repairRequest && (
          <div className="space-y-5">

            {/* Status overview */}
            <Card className="overflow-hidden border-none bg-white shadow-lg">
              <CardHeader className="border-b border-slate-100 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Anfrage-Nummer</p>
                    <CardTitle className="mt-0.5 flex items-center gap-2 text-xl text-[#1a2a5e]">
                      <FileText className="h-5 w-5" />
                      {repairRequest.requestNumber}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`border ${statusStyle(repairRequest.status)} inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold`}>
                      {statusIcon(repairRequest.status)}
                      {statusLabel(repairRequest.status)}
                    </Badge>
                    <button
                      type="button"
                      onClick={handleRefresh}
                      disabled={refreshing}
                      title="Aktualisieren"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5 pt-5">

                {/* Progress stepper */}
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Bearbeitungsfortschritt</p>
                  <StatusStepper status={repairRequest.status} />
                  {repairRequest.status === "rejected" && (
                    <p className="mt-3 flex items-center gap-2 text-sm text-rose-700">
                      <XCircle className="h-4 w-4 shrink-0" />
                      Ihre Anfrage wurde leider abgelehnt. Bei Fragen können Sie uns per Nachricht kontaktieren.
                    </p>
                  )}
                  {repairRequest.status === "converted" && (
                    <p className="mt-3 flex items-center gap-2 text-sm text-purple-700">
                      <Wrench className="h-4 w-4 shrink-0" />
                      Ihre Anfrage wurde erfolgreich in einen Reparaturauftrag umgewandelt.
                    </p>
                  )}
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Eingegangen</p>
                    <p className="mt-1 font-bold text-[#1a2a5e]">
                      {new Date(repairRequest.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </p>
                  </div>
                  {repairRequest.reviewDeadline && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Antwortfrist</p>
                      <p className="mt-1 font-bold text-amber-800">
                        {new Date(repairRequest.reviewDeadline).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </p>
                    </div>
                  )}
                  {repairRequest.estimatedCost > 0 && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Kostenschätzung</p>
                      <p className="mt-1 font-bold text-emerald-800">
                        {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(repairRequest.estimatedCost)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Device */}
                <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[rgba(26,42,94,0.08)] overflow-hidden">
                    {deviceImage ? (
                      <img
                        src={deviceImage}
                        alt={`${repairRequest.deviceBrand} ${repairRequest.deviceModel}`}
                        className="h-full w-full object-contain p-1"
                        onError={(e) => { e.currentTarget.style.display = "none"; setDeviceImage(null) }}
                      />
                    ) : (
                      <Smartphone className="h-6 w-6 text-[#1a2a5e]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Gerät</p>
                    <p className="truncate font-bold text-[#1a2a5e]">
                      {repairRequest.deviceBrand} {repairRequest.deviceModel}
                    </p>
                    <p className="text-sm text-slate-500">{repairRequest.deviceType}</p>
                  </div>
                </div>

                {/* Expandable details */}
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-[#1a2a5e] transition hover:bg-slate-100"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Anfrage-Details anzeigen
                  </span>
                  {showDetails ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>

                {showDetails && (
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Fehlerbeschreibung</p>
                      <p className="leading-relaxed text-slate-800">{repairRequest.issueDescription}</p>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      {repairRequest.issueOccurredDate && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Defekt aufgetreten</p>
                          <p className="mt-0.5 font-medium text-slate-700">{repairRequest.issueOccurredDate}</p>
                        </div>
                      )}
                      <div>
                        <p className="mb-0.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          <Droplets className="h-3 w-3" /> Wasserschaden
                        </p>
                        <p className="font-medium text-slate-700">
                          {{ no: "Nein", yes: "Ja", unsure: "Unbekannt" }[repairRequest.waterDamage as string] ?? repairRequest.waterDamage}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vorh. Reparaturen</p>
                        <p className="mt-0.5 font-medium text-slate-700">
                          {{ no: "Nein", yes: "Ja", unsure: "Unbekannt" }[repairRequest.repairAttempts as string] ?? (repairRequest.repairAttempts || "Nein")}
                        </p>
                      </div>
                    </div>
                    {repairRequest.images?.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Fotos ({repairRequest.images.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {repairRequest.images.map((src: string, i: number) => (
                              <img
                                key={i}
                                src={src}
                                alt={`Bild ${i + 1}`}
                                className="h-16 w-16 rounded-xl border border-slate-200 object-cover"
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Communication card */}
            <Card className="overflow-hidden border-none bg-white shadow-lg">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="flex items-center gap-2.5 text-lg text-[#1a2a5e]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[rgba(26,42,94,0.08)]">
                    <MessageSquare className="h-4 w-4 text-[#1a2a5e]" />
                  </span>
                  Nachrichten
                  {communication?.messages?.length > 0 && (
                    <span className="ml-auto rounded-full bg-[#1a2a5e] px-2.5 py-0.5 text-xs font-semibold text-white">
                      {communication.messages.length}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                {commLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-[#1a2a5e]" />
                  </div>
                ) : (
                  <>
                    {/* Thread */}
                    <div className="mb-5 max-h-[400px] min-h-[120px] overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-4 sm:max-h-[480px]">
                      {!communication?.messages?.length ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
                            <MessageSquare className="h-6 w-6 text-slate-300" />
                          </div>
                          <p className="text-sm font-medium text-slate-500">Noch keine Nachrichten</p>
                          <p className="text-xs text-slate-400">Unser Team meldet sich in Kürze bei Ihnen.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {communication.messages.map((msg: any) => (
                            <MessageBubble key={msg._id ?? msg.createdAt} msg={msg} />
                          ))}
                          <div ref={messagesEndRef} />
                        </div>
                      )}
                    </div>

                    <Separator className="mb-5" />

                    {repairRequest.status !== "rejected" ? (
                      <form onSubmit={handleSendMessage} className="space-y-3">
                        <Textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Nachricht an das McRepair-Team …"
                          rows={3}
                          disabled={sending}
                          className="resize-none border-slate-200 text-sm focus-visible:border-[#1a2a5e] focus-visible:ring-[#1a2a5e]/20"
                        />
                        <Button
                          type="submit"
                          disabled={!message.trim() || sending}
                          className="h-10 w-full bg-[#f5b800] font-bold text-[#1a2a5e] hover:bg-[#e5ab00] sm:w-auto"
                        >
                          {sending
                            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Wird gesendet…</>
                            : <><Send className="mr-2 h-4 w-4" /> Nachricht senden</>}
                        </Button>
                      </form>
                    ) : (
                      <p className="text-center text-sm text-slate-400">
                        Dieser Kommunikationskanal ist geschlossen. Bei Fragen kontaktieren Sie uns per E-Mail.
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Reset link */}
            <div className="pb-4 text-center">
              <button
                type="button"
                onClick={() => { setRepairRequest(null); setCommunication(null); setNotFound(false) }}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-[#1a2a5e]"
              >
                <Search className="h-4 w-4" /> Andere Anfrage suchen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

