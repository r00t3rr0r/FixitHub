import { useEffect, useState } from "react"
import { useTranslation } from 'react-i18next'
import { useToast } from "@/hooks/useToast"
import { useAuth } from "@/contexts/AuthContext"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BookOpen,
  Search,
  Plus,
  Edit2,
  Eye,
  Star,
  Clock,
  Tag,
  Filter,
  FileText,
  Trash2,
  X,
  Layers,
  Zap,
  HelpCircle,
  ListChecks,
  TrendingUp,
  AlertTriangle,
  LayoutGrid,
  List,
  BookMarked,
  Pin,
  PinOff,
} from "lucide-react"

// ─── Types ──────────────────────────────────────────────────────────────────

interface ArticleStep {
  order: number
  title: string
  description: string
}

interface KnowledgeArticle {
  _id: string
  title: string
  content: string
  category: string
  tags: string[]
  author: { name: string }
  rating: number
  views: number
  lastUpdated: string
  type: "guide" | "troubleshooting" | "procedure" | "faq"
  difficulty: "beginner" | "intermediate" | "advanced"
  estimatedReadTime: number
  steps: ArticleStep[]
  pinned: boolean
  attachments: { type: "image" | "video" | "document"; url: string; name: string }[]
}

type ViewMode = "grid" | "list"

const CATEGORIES = [
  "Displayreparatur",
  "Akkutausch",
  "Wasserschaden",
  "Kamerareparatur",
  "Ladebuchse",
  "Softwareproblem",
  "Gehäusereparatur",
  "Sonstiges",
]

const EMPTY_FORM: Omit<KnowledgeArticle, "_id" | "views" | "lastUpdated" | "author"> = {
  title: "",
  content: "",
  category: "",
  tags: [],
  rating: 0,
  type: "guide",
  difficulty: "beginner",
  estimatedReadTime: 5,
  steps: [],
  pinned: false,
  attachments: [],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  guide:          { label: "knowledgeBase.typeGuide",       color: "#1a2a5e", bg: "#e8ecf7", Icon: BookOpen },
  troubleshooting:{ label: "knowledgeBase.typeTroubleshooting",     color: "#b45309", bg: "#fef3c7", Icon: Zap },
  procedure:      { label: "knowledgeBase.typeProcedure",        color: "#065f46", bg: "#d1fae5", Icon: ListChecks },
  faq:            { label: "knowledgeBase.typeFaq",             color: "#6b21a8", bg: "#f3e8ff", Icon: HelpCircle },
}

const DIFF_META: Record<string, { label: string; color: string; bg: string }> = {
  beginner:     { label: "knowledgeBase.diffBeginner",     color: "#065f46", bg: "#d1fae5" },
  intermediate: { label: "knowledgeBase.diffIntermediate",color: "#92400e", bg: "#fef3c7" },
  advanced:     { label: "knowledgeBase.diffAdvanced",        color: "#991b1b", bg: "#fee2e2" },
}

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
}

function timeAgo(iso: string, t: (key: string, options?: any) => string) {
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return t('knowledgeBase.justNow')
  if (diff < 3600) return t('knowledgeBase.minutesAgo', { count: Math.floor(diff / 60) })
  if (diff < 86400) return t('knowledgeBase.hoursAgo', { count: Math.floor(diff / 3600) })
  return t('knowledgeBase.daysAgo', { count: Math.floor(diff / 86400) })
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const { t } = useTranslation()
  const m = TYPE_META[type] ?? { label: type, color: "#4a5568", bg: "#edf2f7", Icon: FileText }
  const { Icon } = m
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: m.bg, color: m.color,
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
    }}>
      <Icon size={10} /> {t(m.label)}
    </span>
  )
}

function DiffBadge({ difficulty }: { difficulty: string }) {
  const { t } = useTranslation()
  const m = DIFF_META[difficulty] ?? { label: difficulty, color: "#4a5568", bg: "#edf2f7" }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: m.bg, color: m.color,
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
    }}>
      {t(m.label)}
    </span>
  )
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg, #1a2a5e 0%, #2a3f7e 100%)",
      color: "#fff", fontWeight: 700, fontSize: size * 0.35,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      {initials(name)}
    </div>
  )
}

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={16}
          style={{
            cursor: onChange ? "pointer" : "default",
            fill: i <= (hover || Math.round(value)) ? "#f5b800" : "transparent",
            stroke: i <= (hover || Math.round(value)) ? "#f5b800" : "#d1d5db",
            transition: "all 0.1s",
          }}
          onMouseEnter={() => onChange && setHover(i)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange?.(i)}
        />
      ))}
    </div>
  )
}

// ─── Tag Input ────────────────────────────────────────────────────────────────

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const { t } = useTranslation()
  const [input, setInput] = useState("")
  const add = () => {
    const v = input.trim()
    if (v && !tags.includes(v)) onChange([...tags, v])
    setInput("")
  }
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add() } }}
          placeholder={t('knowledgeBase.tagInputPlaceholder')}
          style={{
            flex: 1, height: 36, border: "1px solid #d8dce6", borderRadius: 6,
            padding: "0 10px", fontSize: 13, fontFamily: "inherit",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={add}
          style={{
            background: "#1a2a5e", color: "#fff", border: "none",
            borderRadius: 6, padding: "0 14px", fontSize: 13, cursor: "pointer",
            fontWeight: 600,
          }}
        >
          +
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {tags.map(tag => (
          <span key={tag} style={{
            background: "#e8ecf7", color: "#1a2a5e", fontSize: 12,
            fontWeight: 600, padding: "3px 10px", borderRadius: 20,
            display: "inline-flex", alignItems: "center", gap: 5,
          }}>
            {tag}
            <X size={10} style={{ cursor: "pointer" }}
              onClick={() => onChange(tags.filter(x => x !== tag))} />
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Steps Editor ─────────────────────────────────────────────────────────────

function StepsEditor({ steps, onChange }: { steps: ArticleStep[]; onChange: (s: ArticleStep[]) => void }) {
  const { t } = useTranslation()
  const add = () => onChange([...steps, { order: steps.length + 1, title: "", description: "" }])
  const update = (i: number, field: keyof ArticleStep, val: string) => {
    const next = [...steps]
    next[i] = { ...next[i], [field]: val }
    onChange(next)
  }
  const remove = (i: number) => {
    const next = steps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx + 1 }))
    onChange(next)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {steps.map((step, i) => (
        <div key={i} style={{
          background: "#f8f9fc", border: "1px solid #d8dce6",
          borderRadius: 8, padding: "10px 12px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{
              width: 24, height: 24, borderRadius: "50%",
              background: "#1a2a5e", color: "#fff",
              fontSize: 11, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>{i + 1}</span>
            <input
              value={step.title}
              onChange={e => update(i, "title", e.target.value)}
              placeholder={t('knowledgeBase.stepTitlePlaceholder', { step: i + 1 })}
              style={{
                flex: 1, height: 32, border: "1px solid #d8dce6", borderRadius: 6,
                padding: "0 8px", fontSize: 12, fontFamily: "inherit", outline: "none",
              }}
            />
            <button type="button" onClick={() => remove(i)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#e53e3e" }}>
              <X size={14} />
            </button>
          </div>
          <textarea
            value={step.description}
            onChange={e => update(i, "description", e.target.value)}
            placeholder={t('knowledgeBase.stepDescriptionPlaceholder')}
            rows={2}
            style={{
              width: "100%", border: "1px solid #d8dce6", borderRadius: 6,
              padding: "6px 8px", fontSize: 12, fontFamily: "inherit",
              resize: "vertical", outline: "none",
            }}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        style={{
          background: "none", border: "1px dashed #1a2a5e", borderRadius: 8,
          color: "#1a2a5e", fontWeight: 600, fontSize: 13, padding: "8px 0",
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        {t('knowledgeBase.addStep')}
      </button>
    </div>
  )
}

// ─── Article Dialog (Create / Edit) ──────────────────────────────────────────

interface ArticleDialogProps {
  open: boolean
  initial?: KnowledgeArticle | null
  onClose: () => void
  onSave: (data: Omit<KnowledgeArticle, "_id" | "views" | "lastUpdated" | "author">) => void
}

function ArticleDialog({ open, initial, onClose, onSave }: ArticleDialogProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [activeTab, setActiveTab] = useState<"content" | "meta" | "steps">("content")
  const [customCategory, setCustomCategory] = useState("")
  const [showCustom, setShowCustom] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        title: initial.title,
        content: initial.content,
        category: initial.category,
        tags: [...initial.tags],
        rating: initial.rating,
        type: initial.type,
        difficulty: initial.difficulty,
        estimatedReadTime: initial.estimatedReadTime,
        steps: [...initial.steps],
        pinned: initial.pinned,
        attachments: [...initial.attachments],
      } : { ...EMPTY_FORM })
      setActiveTab("content")
      setCustomCategory("")
      setShowCustom(false)
    }
  }, [open, initial])

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }))

  const tabStyle = (t: string): React.CSSProperties => ({
    padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
    borderRadius: 8, border: "none", fontFamily: "inherit",
    background: activeTab === t ? "#1a2a5e" : "transparent",
    color: activeTab === t ? "#fff" : "#647087",
    transition: "all 0.15s",
  })

  const handleSave = () => {
    if (!form.title.trim()) return
    if (!form.content.trim()) return
    if (!form.category) return
    onSave(form)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent style={{
        maxWidth: 700, width: "calc(100vw - 32px)",
        maxHeight: "90vh", overflowY: "auto",
        fontFamily: '"IBM Plex Sans","Inter",sans-serif',
        padding: 0,
      }}>
        {/* Dialog Header */}
        <div style={{
          background: "linear-gradient(135deg, #1a2a5e 0%, #2a3f7e 100%)",
          padding: "20px 24px 16px",
          borderRadius: "8px 8px 0 0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: "rgba(245,184,0,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {initial ? <Edit2 size={18} color="#f5b800" /> : <Plus size={18} color="#f5b800" />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff" }}>
                {initial ? t('knowledgeBase.editArticle') : t('knowledgeBase.createNewArticle')}
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
                {initial ? t('knowledgeBase.changesSavedImmediately') : t('knowledgeBase.createArticleForTeam')}
              </p>
            </div>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginTop: 16 }}>
            {(["content", "meta", "steps"] as const).map(tab => (
              <button key={tab} style={tabStyle(tab)} onClick={() => setActiveTab(tab)}>
                {tab === "content" ? t('knowledgeBase.tabContent') : tab === "meta" ? t('knowledgeBase.tabDetails') : t('knowledgeBase.tabSteps')}
              </button>
            ))}
          </div>
        </div>

        {/* Dialog Body */}
        <div style={{ padding: "20px 24px" }}>

          {/* TAB: Content */}
          {activeTab === "content" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#1a2a5e", display: "block", marginBottom: 6 }}>
                  {t('knowledgeBase.titleRequired')}
                </label>
                <input
                  value={form.title}
                  onChange={e => set("title", e.target.value)}
                  placeholder={t('knowledgeBase.titlePlaceholder')}
                  style={{
                    width: "100%", height: 40, border: "1.5px solid #d8dce6",
                    borderRadius: 8, padding: "0 12px", fontSize: 14,
                    fontFamily: "inherit", outline: "none",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={e => e.target.style.borderColor = "#1a2a5e"}
                  onBlur={e => e.target.style.borderColor = "#d8dce6"}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#1a2a5e", display: "block", marginBottom: 6 }}>
                  {t('knowledgeBase.contentRequired')}
                </label>
                <textarea
                  value={form.content}
                  onChange={e => set("content", e.target.value)}
                  placeholder={t('knowledgeBase.contentPlaceholder')}
                  rows={6}
                  style={{
                    width: "100%", border: "1.5px solid #d8dce6",
                    borderRadius: 8, padding: "10px 12px", fontSize: 13,
                    fontFamily: "inherit", resize: "vertical", outline: "none",
                    transition: "border-color 0.2s", lineHeight: 1.6,
                  }}
                  onFocus={e => e.target.style.borderColor = "#1a2a5e"}
                  onBlur={e => e.target.style.borderColor = "#d8dce6"}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#1a2a5e", display: "block", marginBottom: 6 }}>
                  {t('knowledgeBase.tags')}
                </label>
                <TagInput tags={form.tags} onChange={t => set("tags", t)} />
              </div>
            </div>
          )}

          {/* TAB: Meta */}
          {activeTab === "meta" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#1a2a5e", display: "block", marginBottom: 6 }}>
                    {t('knowledgeBase.categoryRequired')}
                  </label>
                  {!showCustom ? (
                    <Select value={form.category} onValueChange={v => {
                      if (v === "__custom__") { setShowCustom(true); set("category", "") }
                      else set("category", v)
                    }}>
                      <SelectTrigger style={{ height: 40, fontSize: 13, borderRadius: 8 }}>
                        <SelectValue placeholder={t('knowledgeBase.selectCategory')} />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        <SelectItem value="__custom__">{t('knowledgeBase.customCategory')}</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        autoFocus
                        value={customCategory}
                        onChange={e => setCustomCategory(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") { set("category", customCategory); setShowCustom(false) }
                          if (e.key === "Escape") { setShowCustom(false); setCustomCategory("") }
                        }}
                        placeholder={t('knowledgeBase.newCategoryPlaceholder')}
                        style={{
                          flex: 1, height: 40, border: "1.5px solid #1a2a5e", borderRadius: 8,
                          padding: "0 10px", fontSize: 13, fontFamily: "inherit", outline: "none",
                        }}
                      />
                      <button type="button"
                        onClick={() => { set("category", customCategory); setShowCustom(false) }}
                        style={{ background: "#1a2a5e", color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer" }}>
                        OK
                      </button>
                      <button type="button"
                        onClick={() => { setShowCustom(false); setCustomCategory("") }}
                        style={{ background: "#f5f5f5", color: "#647087", border: "none", borderRadius: 8, padding: "0 10px", cursor: "pointer" }}>
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#1a2a5e", display: "block", marginBottom: 6 }}>
                    {t('knowledgeBase.articleType')}
                  </label>
                  <Select value={form.type} onValueChange={v => set("type", v)}>
                    <SelectTrigger style={{ height: 40, fontSize: 13, borderRadius: 8 }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="guide">{t('knowledgeBase.typeGuideOption')}</SelectItem>
                      <SelectItem value="troubleshooting">{t('knowledgeBase.typeTroubleshootingOption')}</SelectItem>
                      <SelectItem value="procedure">{t('knowledgeBase.typeProcedureOption')}</SelectItem>
                      <SelectItem value="faq">{t('knowledgeBase.typeFaqOption')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#1a2a5e", display: "block", marginBottom: 6 }}>
                    {t('knowledgeBase.difficulty')}
                  </label>
                  <Select value={form.difficulty} onValueChange={v => set("difficulty", v as any)}>
                    <SelectTrigger style={{ height: 40, fontSize: 13, borderRadius: 8 }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">{t('knowledgeBase.diffBeginnerOption')}</SelectItem>
                      <SelectItem value="intermediate">{t('knowledgeBase.diffIntermediateOption')}</SelectItem>
                      <SelectItem value="advanced">{t('knowledgeBase.diffAdvancedOption')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#1a2a5e", display: "block", marginBottom: 6 }}>
                    {t('knowledgeBase.readTimeMinutes')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={form.estimatedReadTime}
                    onChange={e => set("estimatedReadTime", Number(e.target.value))}
                    style={{
                      width: "100%", height: 40, border: "1.5px solid #d8dce6",
                      borderRadius: 8, padding: "0 12px", fontSize: 13,
                      fontFamily: "inherit", outline: "none",
                    }}
                    onFocus={e => e.target.style.borderColor = "#1a2a5e"}
                    onBlur={e => e.target.style.borderColor = "#d8dce6"}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#1a2a5e", display: "block", marginBottom: 8 }}>
                  {t('knowledgeBase.rating')}
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <StarRating value={form.rating} onChange={v => set("rating", v)} />
                  <span style={{ fontSize: 12, color: "#647087" }}>{form.rating > 0 ? `${form.rating}/5` : t('knowledgeBase.notYetRated')}</span>
                </div>
              </div>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <div
                    onClick={() => set("pinned", !form.pinned)}
                    style={{
                      width: 42, height: 24, borderRadius: 12,
                      background: form.pinned ? "#1a2a5e" : "#d8dce6",
                      position: "relative", transition: "background 0.2s", cursor: "pointer",
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", background: "#fff",
                      position: "absolute", top: 3,
                      left: form.pinned ? 21 : 3,
                      transition: "left 0.2s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                    }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#273246" }}>
                    {t('knowledgeBase.pinArticle')}
                  </span>
                  <span style={{ fontSize: 12, color: "#647087" }}>
                    {t('knowledgeBase.pinnedArticlesAppearOnTop')}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* TAB: Steps */}
          {activeTab === "steps" && (
            <div>
              <p style={{ fontSize: 13, color: "#647087", marginBottom: 12, lineHeight: 1.5 }}>
                {t('knowledgeBase.stepsDescription')}
              </p>
              <StepsEditor steps={form.steps} onChange={s => set("steps", s)} />
            </div>
          )}
        </div>

        {/* Dialog Footer */}
        <div style={{
          padding: "14px 24px", borderTop: "1px solid #eceef3",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "#f8f9fc", borderRadius: "0 0 8px 8px",
        }}>
          <div style={{ display: "flex", gap: 6 }}>
            {(["content", "meta", "steps"] as const).map((t) => (
              <div key={t} style={{
                width: 8, height: 8, borderRadius: "50%",
                background: activeTab === t ? "#1a2a5e" : "#d8dce6",
                transition: "background 0.2s",
              }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 38, padding: "0 16px", border: "1px solid #d8dce6",
                borderRadius: 8, background: "#fff", color: "#647087",
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!form.title.trim() || !form.content.trim() || !form.category}
              style={{
                height: 38, padding: "0 20px",
                background: (!form.title.trim() || !form.content.trim() || !form.category)
                  ? "#d8dce6" : "#f5b800",
                border: "none", borderRadius: 8,
                color: (!form.title.trim() || !form.content.trim() || !form.category)
                  ? "#9ca3af" : "#1a2a5e",
                fontSize: 13, fontWeight: 700, cursor:
                  (!form.title.trim() || !form.content.trim() || !form.category)
                    ? "not-allowed" : "pointer",
                transition: "all 0.15s", fontFamily: "inherit",
              }}
            >
              {initial ? t('knowledgeBase.saveChanges') : t('knowledgeBase.createArticle')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Article View Dialog ──────────────────────────────────────────────────────

function ArticleViewDialog({
  article,
  onClose,
  onEdit,
}: {
  article: KnowledgeArticle | null
  onClose: () => void
  onEdit: () => void
}) {
  const { t } = useTranslation()
  if (!article) return null
  const { Icon: _Icon } = TYPE_META[article.type] ?? { Icon: FileText }

  return (
    <Dialog open={!!article} onOpenChange={v => !v && onClose()}>
      <DialogContent style={{
        maxWidth: 720, width: "calc(100vw - 32px)",
        maxHeight: "92vh", overflowY: "auto",
        fontFamily: '"IBM Plex Sans","Inter",sans-serif',
        padding: 0,
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #1a2a5e 0%, #2a3f7e 100%)",
          padding: "20px 24px",
          borderRadius: "8px 8px 0 0",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                <TypeBadge type={article.type} />
                <DiffBadge difficulty={article.difficulty} />
                {article.pinned && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    background: "rgba(245,184,0,0.15)", color: "#f5b800",
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                  }}>
                    <Pin size={10} /> {t('knowledgeBase.pinned')}
                  </span>
                )}
              </div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>
                {article.title}
              </h2>
              <div style={{ display: "flex", gap: 16, marginTop: 10, color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Avatar name={article.author.name} size={20} />
                  {article.author.name}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={12} /> {t('knowledgeBase.readTime', { minutes: article.estimatedReadTime })}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Eye size={12} /> {t('knowledgeBase.viewCount', { count: article.views })}
                </span>
              </div>
            </div>
            <button
              onClick={onEdit}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#f5b800", border: "none", borderRadius: 8,
                padding: "8px 14px", color: "#1a2a5e", fontSize: 12,
                fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                flexShrink: 0, marginLeft: 12,
              }}
            >
              <Edit2 size={13} /> {t('common.edit')}
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          {/* Content */}
          <div style={{
            background: "#f8f9fc", borderRadius: 10, padding: "16px",
            marginBottom: 20, border: "1px solid #eceef3",
          }}>
            <p style={{ margin: 0, fontSize: 14, color: "#273246", lineHeight: 1.75 }}>
              {article.content}
            </p>
          </div>

          {/* Steps */}
          {article.steps.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a2a5e", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <ListChecks size={16} /> {t('knowledgeBase.stepByStepGuide')}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {article.steps.map((step, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 12, alignItems: "flex-start",
                    background: "#fff", border: "1px solid #eceef3",
                    borderRadius: 10, padding: "12px 14px",
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: "linear-gradient(135deg, #1a2a5e, #2a3f7e)",
                      color: "#fff", fontSize: 12, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>{i + 1}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#273246" }}>{step.title}</div>
                      {step.description && (
                        <div style={{ fontSize: 13, color: "#647087", marginTop: 4, lineHeight: 1.6 }}>
                          {step.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {article.tags.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: "#1a2a5e", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Tag size={13} /> Tags
              </h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {article.tags.map(t => (
                  <span key={t} style={{
                    background: "#e8ecf7", color: "#1a2a5e",
                    fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                  }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Stats Row */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px,1fr))",
            gap: 10, padding: "14px",
            background: "#f8f9fc", borderRadius: 10, border: "1px solid #eceef3",
          }}>
            {[
              { label: t('knowledgeBase.rating'), value: <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Star size={14} fill="#f5b800" color="#f5b800" /><span style={{ fontWeight: 700 }}>{article.rating.toFixed(1)}</span></div> },
              { label: t('knowledgeBase.category'), value: article.category },
              { label: t('knowledgeBase.updated'), value: timeAgo(article.lastUpdated, t) },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#647087", marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#273246" }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function DeleteDialog({ article, onClose, onConfirm }: {
  article: KnowledgeArticle | null
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={!!article} onOpenChange={v => !v && onClose()}>
      <DialogContent style={{
        maxWidth: 420, fontFamily: '"IBM Plex Sans","Inter",sans-serif', padding: 0,
      }}>
        <div style={{ padding: "24px" }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16,
          }}>
            <AlertTriangle size={22} color="#e53e3e" />
          </div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#273246" }}>
            {t('knowledgeBase.deleteArticleTitle')}
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: "#647087", lineHeight: 1.6 }}>
            {t('knowledgeBase.deleteConfirmationPrefix')} <strong style={{ color: "#273246" }}>„{article?.title}"</strong> {t('knowledgeBase.deleteConfirmationSuffix')}
          </p>
        </div>
        <div style={{
          padding: "12px 24px 20px",
          display: "flex", gap: 8, justifyContent: "flex-end",
        }}>
          <button
            onClick={onClose}
            style={{
              height: 38, padding: "0 16px", border: "1px solid #d8dce6",
              borderRadius: 8, background: "#fff", color: "#647087",
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            style={{
              height: 38, padding: "0 16px",
              background: "#e53e3e", border: "none", borderRadius: 8,
              color: "#fff", fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {t('knowledgeBase.deletePermanently')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Article Card (Grid) ──────────────────────────────────────────────────────

function ArticleCard({
  article,
  onView,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  article: KnowledgeArticle
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  onTogglePin: () => void
}) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  const { Icon: _Icon } = TYPE_META[article.type] ?? { Icon: FileText }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#fff",
        border: `1px solid ${hovered ? "#1a2a5e" : "#d8dce6"}`,
        borderRadius: 12,
        overflow: "hidden",
        transition: "all 0.2s",
        boxShadow: hovered ? "0 6px 24px rgba(26,42,94,0.12)" : "0 1px 3px rgba(0,0,0,0.06)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Pin indicator */}
      {article.pinned && (
        <div style={{
          position: "absolute", top: 10, right: 10,
          background: "#fef3c7", borderRadius: 6, padding: "2px 6px",
          display: "flex", alignItems: "center", gap: 3,
          fontSize: 10, fontWeight: 700, color: "#92400e",
        }}>
          <Pin size={9} /> {t('knowledgeBase.pinned')}
        </div>
      )}

      {/* Category stripe */}
      <div style={{
        height: 4,
        background: TYPE_META[article.type]?.bg ?? "#e8ecf7",
        borderBottom: `1px solid ${TYPE_META[article.type]?.bg ?? "#e8ecf7"}`,
      }} />

      <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Type + Difficulty */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <TypeBadge type={article.type} />
          <DiffBadge difficulty={article.difficulty} />
        </div>

        {/* Title */}
        <h3
          onClick={onView}
          style={{
            margin: 0, fontSize: 14, fontWeight: 700, color: "#1a2a5e",
            lineHeight: 1.4, cursor: "pointer",
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical", overflow: "hidden",
          }}
        >
          {article.title}
        </h3>

        {/* Excerpt */}
        <p style={{
          margin: 0, fontSize: 12, color: "#647087", lineHeight: 1.55,
          display: "-webkit-box", WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical", overflow: "hidden",
          flex: 1,
        }}>
          {article.content}
        </p>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {article.tags.slice(0, 3).map(tag => (
              <span key={tag} style={{
                background: "#f0f2f8", color: "#4a5568",
                fontSize: 11, padding: "2px 7px", borderRadius: 20,
              }}>{tag}</span>
            ))}
            {article.tags.length > 3 && (
              <span style={{
                background: "#f0f2f8", color: "#4a5568",
                fontSize: 11, padding: "2px 7px", borderRadius: 20,
              }}>+{article.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Stats */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 11, color: "#647087",
        }}>
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Star size={11} fill="#f5b800" color="#f5b800" /> {article.rating.toFixed(1)}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Eye size={11} /> {article.views}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Clock size={11} /> {article.estimatedReadTime}min
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Avatar name={article.author.name} size={18} />
            <span style={{ fontSize: 10 }}>{article.author.name.split(" ")[0]}</span>
          </div>
        </div>
      </div>

      {/* Actions Footer */}
      <div style={{
        borderTop: "1px solid #eceef3",
        display: "flex",
        background: hovered ? "#f8f9fc" : "#fff",
        transition: "background 0.15s",
      }}>
        <button onClick={onView} style={actionBtnStyle("#1a2a5e")}>
          <Eye size={14} /> {t('knowledgeBase.read')}
        </button>
        <button onClick={onEdit} style={actionBtnStyle("#647087")}>
          <Edit2 size={14} />
        </button>
        <button onClick={onTogglePin} style={actionBtnStyle("#92400e")}>
          {article.pinned ? <PinOff size={14} /> : <Pin size={14} />}
        </button>
        <button onClick={onDelete} style={actionBtnStyle("#e53e3e")}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

function actionBtnStyle(_hoverColor: string): React.CSSProperties {
  return {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
    padding: "9px 0", background: "none", border: "none", cursor: "pointer",
    fontSize: 12, color: "#647087", fontFamily: "inherit", fontWeight: 500,
    transition: "color 0.15s",
    borderRight: "1px solid #eceef3",
  }
}

// ─── Article Row (List) ───────────────────────────────────────────────────────

function ArticleRow({
  article, onView, onEdit, onDelete, onTogglePin,
}: {
  article: KnowledgeArticle
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  onTogglePin: () => void
}) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "12px 16px",
        background: hovered ? "#f8f9fc" : "#fff",
        border: `1px solid ${hovered ? "#b0b8c9" : "#eceef3"}`,
        borderRadius: 10, transition: "all 0.15s",
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: TYPE_META[article.type]?.bg ?? "#e8ecf7",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {(() => { const { Icon } = TYPE_META[article.type] ?? { Icon: FileText }; return <Icon size={16} color={TYPE_META[article.type]?.color ?? "#4a5568"} /> })()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            onClick={onView}
            style={{
              fontSize: 13, fontWeight: 700, color: "#1a2a5e", cursor: "pointer",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >{article.title}</span>
          {article.pinned && <Pin size={11} color="#92400e" />}
          <DiffBadge difficulty={article.difficulty} />
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#647087", marginTop: 3 }}>
          <span>{article.category}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <Star size={10} fill="#f5b800" color="#f5b800" /> {article.rating.toFixed(1)}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <Eye size={10} /> {article.views}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <Clock size={10} /> {article.estimatedReadTime}min
          </span>
          <span>{timeAgo(article.lastUpdated, t)}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <button onClick={onView} style={iconBtnStyle}><Eye size={14} /></button>
        <button onClick={onEdit} style={iconBtnStyle}><Edit2 size={14} /></button>
        <button onClick={onTogglePin} style={iconBtnStyle}>{article.pinned ? <PinOff size={14} /> : <Pin size={14} />}</button>
        <button onClick={onDelete} style={{ ...iconBtnStyle, color: "#e53e3e" }}><Trash2 size={14} /></button>
      </div>
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 6,
  background: "#f0f2f8", border: "none", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "#4a5568", transition: "background 0.15s",
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function KnowledgeBase() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { toast } = useToast()

  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")

  // Dialogs
  const [showCreate, setShowCreate] = useState(false)
  const [editArticle, setEditArticle] = useState<KnowledgeArticle | null>(null)
  const [viewArticle, setViewArticle] = useState<KnowledgeArticle | null>(null)
  const [deleteArticle, setDeleteArticle] = useState<KnowledgeArticle | null>(null)

  // ── Seed data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const authorName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Tech Staff"
    const mockArticles: KnowledgeArticle[] = [
      {
        _id: "1",
        title: "iPhone 15 Pro Display tauschen – vollständige Anleitung",
        content: "Schritt-für-Schritt-Anleitung für den Austausch des Displays beim iPhone 15 Pro. Inkl. Werkzeugempfehlungen, Sicherheitshinweisen und Tipps für einen sauberen Einbau ohne verbleibende Spaltmaße.",
        category: "Displayreparatur",
        tags: ["iPhone 15 Pro", "Display", "OLED", "Werkzeug"],
        author: { name: authorName },
        rating: 4.8,
        views: 1247,
        lastUpdated: new Date(Date.now() - 86400000 * 3).toISOString(),
        type: "guide",
        difficulty: "intermediate",
        estimatedReadTime: 12,
        pinned: true,
        steps: [
          { order: 1, title: "Gerät ausschalten & SIM entfernen", description: "iPhone vollständig ausschalten. SIM-Karte herausnehmen und Nano-SIM-Fach sichern." },
          { order: 2, title: "Pentalobe-Schrauben lösen", description: "Die zwei Pentalobe-Schrauben unten am Gerät mit dem P2-Schraubenzieher lösen." },
          { order: 3, title: "Display anheben", description: "Saugnapf am unteren Rand ansetzen, leicht anheben. Spatel vorsichtig in den Spalt schieben." },
          { order: 4, title: "Stecker trennen", description: "Alle vier Display-Stecker trennen. Schraube am Steckerrahmen vorher entfernen." },
          { order: 5, title: "Neues Display einbauen", description: "In umgekehrter Reihenfolge neues Display einsetzen, alle Stecker fest einrasten lassen." },
        ],
        attachments: [{ type: "video", url: "#", name: "Video-Anleitung" }],
      },
      {
        _id: "2",
        title: "Wasserschaden-Checkliste – Sofortmaßnahmen",
        content: "Wie du einen Wasserschaden richtig einschätzt und die richtigen Sofortmaßnahmen einleitest. Diese Checkliste führt dich durch alle relevanten Prüfpunkte.",
        category: "Wasserschaden",
        tags: ["Wasserschaden", "Sofortmaßnahme", "Checkliste", "Korrosion"],
        author: { name: "Mike Chen" },
        rating: 4.9,
        views: 892,
        lastUpdated: new Date(Date.now() - 86400000 * 6).toISOString(),
        type: "procedure",
        difficulty: "beginner",
        estimatedReadTime: 8,
        pinned: false,
        steps: [
          { order: 1, title: "Gerät sofort ausschalten", description: "Kein Einschalten versuchen! Kurzschluss vermeiden." },
          { order: 2, title: "SIM & SD-Karte entfernen", description: "Alle Karten sofort herausnehmen und trocknen." },
          { order: 3, title: "Sichtprüfung auf Korrosion", description: "Mit Lupe Kontakte und Platine auf Grünfärbung oder Rost prüfen." },
        ],
        attachments: [{ type: "document", url: "#", name: "Checkliste.pdf" }],
      },
      {
        _id: "3",
        title: "Akkuproblem diagnostizieren",
        content: "Häufige Akkuprobleme und ihre Ursachen: Ladestau, Tiefentladung, Schwellung. Wie du richtig testest und die optimale Lösung wählst.",
        category: "Akkutausch",
        tags: ["Akku", "Diagnose", "Ladeproblem", "Schwellung"],
        author: { name: "Emily Rodriguez" },
        rating: 4.7,
        views: 654,
        lastUpdated: new Date(Date.now() - 86400000 * 10).toISOString(),
        type: "troubleshooting",
        difficulty: "beginner",
        estimatedReadTime: 6,
        pinned: false,
        steps: [],
        attachments: [],
      },
      {
        _id: "4",
        title: "Samsung Rückkamera tauschen",
        content: "Anleitung für den Kameratausch bei Samsung Galaxy S-Serie. Auf Kameraobjektiv-Ausrichtung und korrekte Fixierung des Flex-Kabels achten.",
        category: "Kamerareparatur",
        tags: ["Samsung", "Kamera", "Galaxy", "Flex-Kabel"],
        author: { name: "Tom Weber" },
        rating: 4.5,
        views: 421,
        lastUpdated: new Date(Date.now() - 86400000 * 14).toISOString(),
        type: "guide",
        difficulty: "advanced",
        estimatedReadTime: 15,
        pinned: false,
        steps: [],
        attachments: [{ type: "image", url: "#", name: "Kamera-Einbau Foto" }],
      },
      {
        _id: "5",
        title: "Häufige Fragen: Reparaturzeiten & Preise",
        content: "Antworten auf die häufigsten Kundenfragen zu Reparaturzeiten, Preistransparenz, Garantie und dem Ablauf einer Reparaturannahme.",
        category: "Sonstiges",
        tags: ["FAQ", "Preise", "Garantie", "Reparaturzeit"],
        author: { name: "Lisa Müller" },
        rating: 4.6,
        views: 1089,
        lastUpdated: new Date(Date.now() - 86400000 * 2).toISOString(),
        type: "faq",
        difficulty: "beginner",
        estimatedReadTime: 4,
        pinned: false,
        steps: [],
        attachments: [],
      },
    ]
    setArticles(mockArticles)
    setLoading(false)
  }, [user])

  // ── Filtered list ────────────────────────────────────────────────────────────
  const filtered = articles
    .filter(a => {
      const q = searchTerm.toLowerCase()
      return !q || a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q) || a.tags.some(t => t.toLowerCase().includes(q))
    })
    .filter(a => categoryFilter === "all" || a.category === categoryFilter)
    .filter(a => typeFilter === "all" || a.type === typeFilter)
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))

  const categories = Array.from(new Set(articles.map(a => a.category)))

  // Stats
  const totalViews = articles.reduce((s, a) => s + a.views, 0)
  const avgRating = articles.length ? (articles.reduce((s, a) => s + a.rating, 0) / articles.length).toFixed(1) : "–"

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleCreate = (data: Omit<KnowledgeArticle, "_id" | "views" | "lastUpdated" | "author">) => {
    const authorName = (user as any)?.name || user?.email || t('knowledgeBase.unknown')
    const newArticle: KnowledgeArticle = {
      ...data,
      _id: Date.now().toString(),
      views: 0,
      lastUpdated: new Date().toISOString(),
      author: { name: authorName },
    }
    setArticles(prev => [newArticle, ...prev])
    setShowCreate(false)
    toast({ title: t('knowledgeBase.articleCreated'), description: t('knowledgeBase.articleCreatedDesc', { title: newArticle.title }) })
  }

  const handleEdit = (data: Omit<KnowledgeArticle, "_id" | "views" | "lastUpdated" | "author">) => {
    if (!editArticle) return
    setArticles(prev => prev.map(a => a._id === editArticle._id
      ? { ...a, ...data, lastUpdated: new Date().toISOString() }
      : a
    ))
    setEditArticle(null)
    toast({ title: t('knowledgeBase.articleUpdated'), description: t('knowledgeBase.articleSavedDesc', { title: data.title }) })
  }

  const handleDelete = () => {
    if (!deleteArticle) return
    setArticles(prev => prev.filter(a => a._id !== deleteArticle._id))
    setDeleteArticle(null)
    toast({ title: t('knowledgeBase.articleDeleted'), description: t('knowledgeBase.articleDeletedDesc') })
  }

  const handleTogglePin = (article: KnowledgeArticle) => {
    setArticles(prev => prev.map(a => a._id === article._id ? { ...a, pinned: !a.pinned } : a))
    toast({
      title: article.pinned ? t('knowledgeBase.articleUnpinned') : t('knowledgeBase.articlePinned'),
      description: article.pinned ? t('knowledgeBase.unpinnedDesc') : t('knowledgeBase.pinnedDesc'),
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        fontFamily: '"IBM Plex Sans","Inter",sans-serif',
        background: "radial-gradient(1200px 500px at -5% -10%, #dde6ff 0%, transparent 55%), radial-gradient(900px 420px at 120% -20%, #d7f2f0 0%, transparent 50%), #f4f6fb",
        minHeight: "100vh", padding: "1rem",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <div style={{ height: 80, background: "#fff", borderRadius: 10, animation: "pulse 1.5s infinite" }} />
        {[1, 2, 3].map(i => <div key={i} style={{ height: 200, background: "#fff", borderRadius: 10, opacity: 0.7 }} />)}
      </div>
    )
  }

  return (
    <div style={{
      fontFamily: '"IBM Plex Sans","Inter",sans-serif',
      background: "radial-gradient(1200px 500px at -5% -10%, #dde6ff 0%, transparent 55%), radial-gradient(900px 420px at 120% -20%, #d7f2f0 0%, transparent 50%), #f4f6fb",
      minHeight: "100vh",
      padding: "0.8rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.7rem",
    }}>
      {/* ── Header ── */}
      <div style={{
        background: "linear-gradient(135deg, #1a2a5e 0%, #223875 80%)",
        borderRadius: 10, border: "1px solid #2f4a90",
        padding: "16px 20px",
        display: "flex", flexWrap: "wrap", gap: 12,
        justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: "rgba(245,184,0,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <BookMarked size={22} color="#f5b800" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>
              {t('knowledgeBase.title')}
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
              {t('knowledgeBase.subtitle')}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#f5b800", border: "none", borderRadius: 8,
            padding: "10px 18px", color: "#1a2a5e", fontSize: 13,
            fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 2px 8px rgba(245,184,0,0.3)", transition: "all 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#e5ab00")}
          onMouseLeave={e => (e.currentTarget.style.background = "#f5b800")}
        >
          <Plus size={16} /> {t('knowledgeBase.createArticle')}
        </button>
      </div>

      {/* ── Stats Row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.5rem" }}>
        {[
          { label: t('knowledgeBase.totalArticles'), value: articles.length, Icon: BookOpen, accent: false },
          { label: t('knowledgeBase.categoriesLabel'), value: categories.length, Icon: Layers, accent: false },
          { label: t('knowledgeBase.totalViews'), value: totalViews.toLocaleString(), Icon: TrendingUp, accent: false },
          { label: t('knowledgeBase.avgRating'), value: avgRating, Icon: Star, accent: true },
          { label: t('knowledgeBase.pinnedLabel'), value: articles.filter(a => a.pinned).length, Icon: Pin, accent: false },
        ].map(s => (
          <div key={s.label} style={{
            background: "#fff", border: "1px solid #d8dce6", borderRadius: 10,
            padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: "#647087" }}>{s.label}</p>
              <h3 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700, color: s.accent ? "#b07e00" : "#1a2a5e" }}>
                {s.value}
              </h3>
            </div>
            <s.Icon size={18} color={s.accent ? "#b07e00" : "#1a2a5e"} style={{ opacity: 0.55 }} />
          </div>
        ))}
      </div>

      {/* ── Search & Filters ── */}
      <div style={{
        background: "#fff", border: "1px solid #d8dce6", borderRadius: 10, padding: "14px 16px",
        display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
      }}>
        {/* Search */}
        <div style={{ flex: "1 1 240px", position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#8892a8" }} />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={t('knowledgeBase.searchPlaceholder')}
            style={{
              width: "100%", height: 38, border: "1px solid #d8dce6", borderRadius: 8,
              paddingLeft: 34, paddingRight: 12, fontSize: 13, fontFamily: "inherit",
              outline: "none", transition: "border-color 0.2s",
            }}
            onFocus={e => e.target.style.borderColor = "#1a2a5e"}
            onBlur={e => e.target.style.borderColor = "#d8dce6"}
          />
          {searchTerm && (
            <X size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#8892a8", cursor: "pointer" }}
              onClick={() => setSearchTerm("")} />
          )}
        </div>

        {/* Category filter */}
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger style={{ width: 160, height: 38, fontSize: 13, borderRadius: 8, border: "1px solid #d8dce6" }}>
            <Filter size={13} style={{ marginRight: 6, color: "#8892a8" }} />
            <SelectValue placeholder={t('knowledgeBase.category')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('knowledgeBase.allCategories')}</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Type filter */}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger style={{ width: 150, height: 38, fontSize: 13, borderRadius: 8, border: "1px solid #d8dce6" }}>
            <SelectValue placeholder={t('knowledgeBase.type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('knowledgeBase.allTypes')}</SelectItem>
            <SelectItem value="guide">{t('knowledgeBase.typeGuidesOption')}</SelectItem>
            <SelectItem value="troubleshooting">{t('knowledgeBase.typeTroubleshootingOption')}</SelectItem>
            <SelectItem value="procedure">{t('knowledgeBase.typeProceduresOption')}</SelectItem>
            <SelectItem value="faq">{t('knowledgeBase.typeFaqOption')}</SelectItem>
          </SelectContent>
        </Select>

        {/* View mode toggle */}
        <div style={{
          display: "flex", border: "1px solid #d8dce6", borderRadius: 8, overflow: "hidden",
          marginLeft: "auto",
        }}>
          {(["grid", "list"] as ViewMode[]).map(m => (
            <button key={m}
              onClick={() => setViewMode(m)}
              style={{
                width: 38, height: 38, border: "none", cursor: "pointer",
                background: viewMode === m ? "#1a2a5e" : "#fff",
                color: viewMode === m ? "#fff" : "#647087",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
            >
              {m === "grid" ? <LayoutGrid size={15} /> : <List size={15} />}
            </button>
          ))}
        </div>
      </div>

      {/* ── Category Quick-Filters ── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {["all", ...categories].map(c => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c)}
            style={{
              height: 28, padding: "0 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: categoryFilter === c ? "none" : "1px solid #d8dce6",
              background: categoryFilter === c ? "#1a2a5e" : "#fff",
              color: categoryFilter === c ? "#fff" : "#647087",
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
            }}
          >
            {c === "all" ? t('common.all') : c}
            {c !== "all" && (
              <span style={{
                marginLeft: 5, background: categoryFilter === c ? "rgba(255,255,255,0.2)" : "#f0f2f8",
                borderRadius: 10, padding: "0 5px", fontSize: 10,
                color: categoryFilter === c ? "#fff" : "#647087",
              }}>
                {articles.filter(a => a.category === c).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Results info ── */}
      <div style={{ fontSize: 12, color: "#647087", paddingLeft: 2 }}>
        {filtered.length === articles.length
          ? t('knowledgeBase.articleCount', { count: articles.length })
          : t('knowledgeBase.filteredArticleCount', { filtered: filtered.length, total: articles.length })}
        {searchTerm && ` · ${t('knowledgeBase.searchLabel')}: „${searchTerm}"`}
      </div>

      {/* ── Articles (Grid) ── */}
      {filtered.length > 0 ? (
        viewMode === "grid" ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "0.65rem",
          }}>
            {filtered.map(article => (
              <ArticleCard
                key={article._id}
                article={article}
                onView={() => setViewArticle(article)}
                onEdit={() => { setViewArticle(null); setEditArticle(article) }}
                onDelete={() => setDeleteArticle(article)}
                onTogglePin={() => handleTogglePin(article)}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map(article => (
              <ArticleRow
                key={article._id}
                article={article}
                onView={() => setViewArticle(article)}
                onEdit={() => { setViewArticle(null); setEditArticle(article) }}
                onDelete={() => setDeleteArticle(article)}
                onTogglePin={() => handleTogglePin(article)}
              />
            ))}
          </div>
        )
      ) : (
        <div style={{
          background: "#fff", border: "1px solid #d8dce6", borderRadius: 12,
          padding: "48px 24px", textAlign: "center",
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: 14,
            background: "#e8ecf7",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <BookOpen size={26} color="#1a2a5e" style={{ opacity: 0.5 }} />
          </div>
          <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "#273246" }}>
            {t('knowledgeBase.noArticlesFound')}
          </h3>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "#647087" }}>
            {searchTerm ? t('knowledgeBase.noResultsFor', { term: searchTerm }) : t('knowledgeBase.noArticlesInCategory')}
          </p>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "#f5b800", border: "none", borderRadius: 8,
              padding: "10px 20px", color: "#1a2a5e", fontSize: 13,
              fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <Plus size={15} /> {t('knowledgeBase.createFirstArticle')}
          </button>
        </div>
      )}

      {/* ── Dialogs ── */}
      <ArticleDialog
        open={showCreate}
        initial={null}
        onClose={() => setShowCreate(false)}
        onSave={handleCreate}
      />

      <ArticleDialog
        open={!!editArticle}
        initial={editArticle}
        onClose={() => setEditArticle(null)}
        onSave={handleEdit}
      />

      <ArticleViewDialog
        article={viewArticle}
        onClose={() => setViewArticle(null)}
        onEdit={() => { setEditArticle(viewArticle); setViewArticle(null) }}
      />

      <DeleteDialog
        article={deleteArticle}
        onClose={() => setDeleteArticle(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}