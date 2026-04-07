 import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "react-router-dom"
import "./CustomerComplaints.css"
import {
  AlertTriangle,
  Search,
  Filter,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Ban,
  Wrench,
  MessageSquare,
  Send,
  Eye,
  Tag,
  Calendar,
  Loader2,
  Info,
  ThumbsUp,
  ThumbsDown,
  FileText,
  Download,
  ExternalLink,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/useToast"
import {
  Complaint,
  getMyComplaints,
  getComplaint,
  createComplaint,
  addComplaintComment,
  acceptComplaintOffer,
  rejectComplaintOffer,
} from "@/api/complaints"
import { buildOrderDetailsState, getOrderDetailsPath } from "@/lib/orderDetailsNavigation"

/* ────────────────────────────────────────────────
   Status metadata
   ──────────────────────────────────────────────── */
const STATUS_META: Record<
  string,
  { label: string; className: string; icon: React.ReactNode }
> = {
  open: {
    label: "Offen",
    className: "cc-badge-open",
    icon: <FileText size={12} />,
  },
  "in-progress": {
    label: "In Bearbeitung",
    className: "cc-badge-inprogress",
    icon: <Wrench size={12} />,
  },
  "pending-customer": {
    label: "Antwort erforderlich",
    className: "cc-badge-pending",
    icon: <AlertTriangle size={12} />,
  },
  resolved: {
    label: "Gelöst",
    className: "cc-badge-resolved",
    icon: <CheckCircle2 size={12} />,
  },
  closed: {
    label: "Geschlossen",
    className: "cc-badge-closed",
    icon: <Ban size={12} />,
  },
  pending_approval: {
    label: "Wird geprüft",
    className: "cc-badge-open",
    icon: <Clock size={12} />,
  },
  approved: {
    label: "Genehmigt",
    className: "cc-badge-approved",
    icon: <ShieldCheck size={12} />,
  },
  rejected: {
    label: "Abgelehnt",
    className: "cc-badge-rejected",
    icon: <XCircle size={12} />,
  },
  acknowledged: {
    label: "Anerkannt",
    className: "cc-badge-acknowledged",
    icon: <CheckCircle2 size={12} />,
  },
  denied: {
    label: "Angebot vorhanden",
    className: "cc-badge-denied",
    icon: <AlertTriangle size={12} />,
  },
  new_repair: {
    label: "Neue Reparatur",
    className: "cc-badge-newrepair",
    icon: <Wrench size={12} />,
  },
}

const CATEGORY_LABELS: Record<string, string> = {
  quality: "Qualität",
  service: "Service",
  delivery: "Lieferung",
  billing: "Rechnung",
  communication: "Kommunikation",
  other: "Sonstiges",
}

const STATUS_ACCENT: Record<string, string> = {
  open: "#3b82f6",
  "in-progress": "#f5b800",
  "pending-customer": "#f97316",
  resolved: "#22c55e",
  closed: "#94a3b8",
  pending_approval: "#3b82f6",
  approved: "#16a34a",
  rejected: "#ef4444",
  acknowledged: "#06b6d4",
  denied: "#ec4899",
  new_repair: "#8b5cf6",
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/* ────────────────────────────────────────────────
   Status Badge component
   ──────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    className: "cc-badge-closed",
    icon: <Info size={12} />,
  }
  return (
    <span className={`cc-badge ${meta.className}`}>
      {meta.icon}
      {meta.label}
    </span>
  )
}

/* ────────────────────────────────────────────────
   Main Component
   ──────────────────────────────────────────────── */
export function CustomerComplaints() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()

  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [filtered, setFiltered] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Detail dialog
  const [selected, setSelected] = useState<Complaint | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  // New message
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)

  // Offer handling
  const [offerLoading, setOfferLoading] = useState(false)

  // Create dialog
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    subject: "",
    description: "",
    category: "quality",
    priority: "medium",
  })

  /* ── Load complaints ── */
  useEffect(() => {
    loadComplaints()
  }, [])

  async function loadComplaints() {
    try {
      setLoading(true)
      const data = await getMyComplaints()
      const list: Complaint[] = data.complaints ?? []
      setComplaints(list)
      setFiltered(list)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  /* ── Filter ── */
  useEffect(() => {
    let list = complaints
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.subject.toLowerCase().includes(q) ||
          c.complaintNumber?.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== "all") {
      list = list.filter((c) => c.status === statusFilter)
    }
    setFiltered(list)
  }, [search, statusFilter, complaints])

  /* ── Open detail ── */
  async function openDetail(c: Complaint) {
    setSelected(c)
    setShowDetail(true)
    setMessage("")
    try {
      setDetailLoading(true)
      const data = await getComplaint(c._id)
      setSelected(data.complaint)
    } catch {
      // keep cached version
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    const reopenComplaintId = (location.state as { reopenComplaintId?: string } | null)?.reopenComplaintId
    if (!reopenComplaintId || complaints.length === 0) {
      return
    }

    const complaintToOpen = complaints.find((complaint) => complaint._id === reopenComplaintId)
    if (complaintToOpen) {
      openDetail(complaintToOpen)
    }
  }, [location.state, complaints])

  /* ── Send message ── */
  async function handleSend() {
    if (!selected || !message.trim()) return
    try {
      setSending(true)
      await addComplaintComment(selected._id, message.trim(), false)
      setMessage("")
      const data = await getComplaint(selected._id)
      setSelected(data.complaint)
      // refresh list in background
      loadComplaints()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message })
    } finally {
      setSending(false)
    }
  }

  /* ── Accept offer ── */
  async function handleAcceptOffer() {
    if (!selected) return
    try {
      setOfferLoading(true)
      await acceptComplaintOffer(selected._id)
      const data = await getComplaint(selected._id)
      setSelected(data.complaint)
      loadComplaints()
      toast({ title: "Angebot angenommen", description: "Wir kümmern uns um den nächsten Schritt." })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message })
    } finally {
      setOfferLoading(false)
    }
  }

  /* ── Reject offer ── */
  async function handleRejectOffer() {
    if (!selected) return
    try {
      setOfferLoading(true)
      await rejectComplaintOffer(selected._id)
      const data = await getComplaint(selected._id)
      setSelected(data.complaint)
      loadComplaints()
      toast({ title: "Angebot abgelehnt" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message })
    } finally {
      setOfferLoading(false)
    }
  }

  /* ── Create complaint ── */
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.subject.trim() || !form.description.trim()) return
    try {
      setSubmitting(true)
      await createComplaint({
        subject: form.subject.trim(),
        description: form.description.trim(),
        category: form.category as Complaint["category"],
        priority: form.priority as Complaint["priority"],
      })
      toast({ title: "Reklamation eingereicht", description: "Wir melden uns so schnell wie möglich." })
      setShowCreate(false)
      setForm({ subject: "", description: "", category: "quality", priority: "medium" })
      loadComplaints()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Visible comments (no internal notes for customers) ── */
  const visibleComments =
    selected?.comments?.filter((c) => !c.isInternal) ?? []

  /* ── Repair offer (pending) visible when status is denied ── */
  const showOffer =
    selected?.repairOffer &&
    selected.repairOffer.status === "pending" &&
    selected.status === "denied"

  const baseOrderId = selected
    ? (typeof selected.orderId === "string"
      ? selected.orderId
      : (selected.orderId as any)?._id) || ""
    : ""

  const baseOrderNumber = selected
    ? ((selected.orderId as any)?.orderNumber || (baseOrderId ? `#${baseOrderId.slice(-8).toUpperCase()}` : "—"))
    : "—"

  /* ────────────────────── RENDER ────────────────────── */
  return (
    <div className="customer-complaints">
      {/* ── Page Header ── */}
      <div className="mb-8 w-full overflow-hidden rounded-[18px] border-b border-[#2a3f7e] bg-gradient-to-br from-[#1a2a5e] to-[#0f1d45] px-6 py-12 text-white max-[480px]:rounded-[12px] max-[480px]:px-3 max-[360px]:px-[10px]">
        <div className="flex items-start gap-4 sm:items-center max-[480px]:items-start max-[480px]:gap-[10px]">
          <FileText className="h-12 w-12 flex-shrink-0 text-[#f5b800] max-sm:h-[34px] max-sm:w-[34px]" />
          <div>
            <h1 className="m-0 text-[2rem] font-extrabold leading-[1.2] tracking-[-0.5px] max-[480px]:text-[1rem] max-[480px]:leading-[1.25] max-[360px]:text-[0.92rem]">Meine Reklamationen</h1>
            <p className="mt-1 text-[0.95rem] leading-[1.35] text-[rgba(255,255,255,0.85)] opacity-90 max-[480px]:text-[0.76rem] max-[360px]:text-[0.72rem]">Verfolge und verwalte deine Reklamationen</p>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="cc-filter-bar">
        <div className="cc-filter-bar-label">
          <div className="cc-filter-bar-icon">
            <Filter size={16} />
          </div>
          <span>Filter</span>
        </div>

        <div className="cc-search-wrapper">
          <Search />
          <input
            className="cc-search-input"
            placeholder="Suche nach Betreff, Nummer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="cc-filter-select-wrap">
          <select
            className="cc-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Alle Status</option>
            <option value="open">Offen</option>
            <option value="in-progress">In Bearbeitung</option>
            <option value="pending-customer">Antwort erforderlich</option>
            <option value="denied">Angebot vorhanden</option>
            <option value="resolved">Gelöst</option>
            <option value="closed">Geschlossen</option>
          </select>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="cc-loading">
          <Loader2 size={32} />
          <span>Reklamationen werden geladen…</span>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && filtered.length === 0 && (
        <div className="cc-empty">
          <MessageSquare size={48} />
          <h3>Keine Reklamationen gefunden</h3>
          <p>
            {complaints.length === 0
              ? "Sie haben noch keine Reklamation eingereicht."
              : "Keine Reklamationen entsprechen Ihrer Suche."}
          </p>
          {complaints.length === 0 && (
            <button className="cc-new-btn" onClick={() => setShowCreate(true)}>
              <Plus size={16} />
              Jetzt Reklamation einreichen
            </button>
          )}
        </div>
      )}

      {/* ── Complaint card list ── */}
      {!loading && filtered.length > 0 && (
        <div className="cc-list">
          {filtered.map((c) => (
            <div key={c._id} className="cc-card" onClick={() => openDetail(c)}>
              {/* Colored left accent */}
              <div
                className="cc-card-accent"
                style={{ background: STATUS_ACCENT[c.status] ?? "#94a3b8" }}
              />

              <div className="cc-card-body">
                <div className="cc-card-top">
                  <span className="cc-card-number">{c.complaintNumber ?? "—"}</span>
                  <StatusBadge status={c.status} />
                </div>
                <div className="cc-card-subject">{c.subject}</div>
                <div className="cc-card-meta">
                  <span className="cc-card-meta-item">
                    <Tag size={13} />
                    <span className="cc-category">
                      {CATEGORY_LABELS[c.category] ?? c.category}
                    </span>
                  </span>
                  <span className="cc-card-meta-item">
                    <Calendar size={13} />
                    {formatDate(c.createdAt)}
                  </span>
                  {(c.comments?.length ?? 0) > 0 && (
                    <span className="cc-card-meta-item">
                      <MessageSquare size={13} />
                      {c.comments.filter((m) => !m.isInternal).length} Nachrichten
                    </span>
                  )}
                </div>
              </div>

              <div className="cc-card-action">
                <Eye size={16} style={{ color: "#8892a8" }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════
          Detail Dialog
          ════════════════════════════════════════ */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="cc-dialog-content cc-dialog-content--detail">
          <DialogHeader className="cc-dialog-header cc-dialog-header--detail">
            <DialogTitle className="cc-dialog-title">
              {selected?.subject ?? "Reklamation"}
            </DialogTitle>
            <div className="cc-dialog-meta-row">
              {selected?.status && <StatusBadge status={selected.status} />}
            </div>
            <p className="cc-dialog-subtitle">Eingereicht am {selected ? formatDate(selected.createdAt) : ""}</p>
            <div className="cc-dialog-order-row">
              <span className="cc-dialog-order-label">Zugrundeliegender Auftrag</span>
              {baseOrderId ? (
                <button
                  type="button"
                  className="cc-dialog-order-link"
                  onClick={() => navigate(getOrderDetailsPath(baseOrderId), {
                    state: buildOrderDetailsState(location, {
                      label: t('common.back'),
                      restoreState: selected?._id ? { reopenComplaintId: selected._id } : undefined,
                    }),
                  })}
                >
                  <FileText size={13} />
                  {baseOrderNumber}
                  <ExternalLink size={12} />
                </button>
              ) : (
                <span className="cc-dialog-order-missing">Kein Auftrag verknüpft</span>
              )}
            </div>
          </DialogHeader>

          {detailLoading && (
            <div className="cc-loading" style={{ padding: "2rem" }}>
              <Loader2 size={24} />
            </div>
          )}

          {!detailLoading && selected && (
            <div className="cc-detail-layout">
              {/* ── Summary ── */}
              <div className="cc-detail-section cc-section-summary">
                <p className="cc-detail-section-title">Übersicht</p>
                <div className="cc-detail-grid">
                  <div className="cc-detail-item">
                    <label>Status</label>
                    <span>
                      <StatusBadge status={selected.status} />
                    </span>
                  </div>
                  <div className="cc-detail-item">
                    <label>Kategorie</label>
                    <span>{CATEGORY_LABELS[selected.category] ?? selected.category}</span>
                  </div>
                  <div className="cc-detail-item">
                    <label>Auftragsnummer</label>
                    <span>
                      {(selected.orderId as any)?.orderNumber ?? (selected.orderId as string) ?? "—"}
                    </span>
                  </div>
                  <div className="cc-detail-item">
                    <label>Eingereicht am</label>
                    <span>{formatDate(selected.createdAt)}</span>
                  </div>
                  {selected.newOrderId && (
                    <div className="cc-detail-item">
                      <label>Verknüpfter Reklamationsauftrag</label>
                      <span>
                        {(selected.newOrderId as any)?.orderNumber
                          ? (selected.newOrderId as any).orderNumber
                          : `#${(selected.newOrderId as string).slice(-8).toUpperCase()}`}
                      </span>
                      {(selected.newOrderId as any)?._id && (
                        <button
                          type="button"
                          className="cc-detail-link"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(getOrderDetailsPath((selected.newOrderId as any)._id), {
                              state: buildOrderDetailsState(location, {
                                label: t('common.back'),
                                restoreState: selected?._id ? { reopenComplaintId: selected._id } : undefined,
                              }),
                            })
                          }}
                        >
                          <ExternalLink size={12} />
                          Auftrag öffnen
                        </button>
                      )}
                    </div>
                  )}
                  {selected.shippingLabelUrl && (
                    <div className="cc-detail-item">
                      <label>Versandlabel</label>
                      <span>Verfügbar</span>
                      <a
                        href={selected.shippingLabelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cc-detail-link cc-detail-link--primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download size={12} />
                        Label herunterladen
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Description ── */}
              <div className="cc-detail-section cc-section-description">
                <p className="cc-detail-section-title">Beschreibung</p>
                <div className="cc-description-box">{selected.description}</div>
              </div>

              {/* ── Technician reason ── */}
              {selected.technicianReason && (
                <div className="cc-detail-section cc-section-technician">
                  <p className="cc-detail-section-title">Techniker-Begründung</p>
                  <div className="cc-info-box cc-info-box--technician">
                    <Wrench size={15} className="cc-info-box-icon" />
                    <p>{selected.technicianReason}</p>
                  </div>
                </div>
              )}

              {/* ── Repair Offer ── */}
              {showOffer && selected.repairOffer && (
                <div className="cc-offer-box cc-section-offer">
                  <p className="cc-offer-box-title">
                    <AlertTriangle size={16} />
                    Reparaturangebot
                  </p>
                  <p className="cc-offer-amount">
                    {selected.repairOffer.amount.toFixed(2)} €
                  </p>
                  <p className="cc-offer-description">
                    {selected.repairOffer.description}
                  </p>
                  <div className="cc-offer-actions">
                    <button
                      className="cc-btn-accept"
                      onClick={handleAcceptOffer}
                      disabled={offerLoading}
                    >
                      {offerLoading ? (
                        <Loader2 size={14} />
                      ) : (
                        <ThumbsUp size={14} />
                      )}
                      Angebot annehmen
                    </button>
                    <button
                      className="cc-btn-reject"
                      onClick={handleRejectOffer}
                      disabled={offerLoading}
                    >
                      <ThumbsDown size={14} />
                      Angebot ablehnen
                    </button>
                  </div>
                </div>
              )}

              {/* ── Communication thread ── */}
              <div className="cc-detail-section cc-section-communication">
                <p className="cc-detail-section-title">
                  Kommunikation ({visibleComments.length})
                </p>

                {visibleComments.length === 0 ? (
                  <div className="cc-thread-empty">
                    Noch keine Nachrichten. Schreiben Sie uns Ihre Fragen oder Anmerkungen.
                  </div>
                ) : (
                  <div className="cc-thread">
                    {visibleComments.map((cm) => (
                      <div
                        key={cm._id}
                        className={`cc-thread-item${cm.userRole !== "customer" ? " is-staff" : ""}`}
                      >
                        <div className="cc-thread-meta">
                          <span className="cc-thread-author">{cm.userName}</span>
                          <span
                            className={`cc-thread-role ${cm.userRole === "customer" ? "customer" : "staff"}`}
                          >
                            {cm.userRole === "customer" ? "Sie" : "Support"}
                          </span>
                          <span className="cc-thread-time">
                            {formatDate(cm.createdAt)}
                          </span>
                        </div>
                        <p className="cc-thread-text">{cm.comment}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Composer — only if complaint is not closed/resolved */}
                {!["closed", "resolved"].includes(selected.status) && (
                  <div className="cc-composer">
                    <textarea
                      rows={3}
                      placeholder="Nachricht schreiben…"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend()
                      }}
                    />
                    <div className="cc-composer-footer">
                      <button
                        className="cc-send-btn"
                        onClick={handleSend}
                        disabled={sending || !message.trim()}
                      >
                        {sending ? <Loader2 size={14} /> : <Send size={14} />}
                        Senden
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════
          Create Complaint Dialog
          ════════════════════════════════════════ */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="cc-dialog-content">
          <DialogHeader className="cc-dialog-header">
            <DialogTitle className="cc-dialog-title">Neue Reklamation einreichen</DialogTitle>
            <p className="cc-dialog-subtitle">
              Schildern Sie Ihr Anliegen – wir kümmern uns schnellstmöglich darum.
            </p>
          </DialogHeader>

          <form onSubmit={handleCreate} className="cc-form">
            <div className="cc-form-group">
              <label className="cc-form-label">
                Betreff <span>*</span>
              </label>
              <input
                className="cc-form-input"
                placeholder="Kurze Zusammenfassung Ihres Anliegens"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                required
              />
            </div>

            <div className="cc-form-row">
              <div className="cc-form-group">
                <label className="cc-form-label">
                  Kategorie <span>*</span>
                </label>
                <select
                  className="cc-form-select"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  <option value="quality">Qualität</option>
                  <option value="service">Service</option>
                  <option value="delivery">Lieferung</option>
                  <option value="billing">Rechnung</option>
                  <option value="communication">Kommunikation</option>
                  <option value="other">Sonstiges</option>
                </select>
              </div>

              <div className="cc-form-group">
                <label className="cc-form-label">Priorität</label>
                <select
                  className="cc-form-select"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                >
                  <option value="low">Niedrig</option>
                  <option value="medium">Normal</option>
                  <option value="high">Hoch</option>
                  <option value="urgent">Dringend</option>
                </select>
              </div>
            </div>

            <div className="cc-form-group">
              <label className="cc-form-label">
                Beschreibung <span>*</span>
              </label>
              <textarea
                className="cc-form-textarea"
                placeholder="Bitte beschreiben Sie Ihr Anliegen so genau wie möglich…"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                required
              />
            </div>

            <div className="cc-form-footer">
              <button
                type="button"
                className="cc-btn-secondary"
                onClick={() => setShowCreate(false)}
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="cc-btn-primary"
                disabled={submitting || !form.subject.trim() || !form.description.trim()}
              >
                {submitting ? <Loader2 size={14} /> : <Send size={14} />}
                Absenden
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
