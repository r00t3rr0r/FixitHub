import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Search,
  SearchX,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Home,
  Users,
  BookMarked,
  ExternalLink,
  DollarSign,
  FileText,
  MessageSquare,
  AlertCircle,
  Boxes,
  Package2,
  UserCheck,
  BarChart3,
  Layers,
  Wrench,
  FolderTree,
  Plus,
  Smartphone,
  GitBranch,
  Settings,
  Database,
  Shield,
  Mail,
  Activity,
  ShoppingBag,
  HelpCircle,
  Layout,
  Megaphone,
  Radio,
  Bell,
  User,
  type LucideIcon,
} from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { adminSearchIndex } from "@/config/adminSearchIndex"
import "./AdminSidebarSearch.css"

interface AdminSidebarSearchProps {
  isCollapsed: boolean
}

// Preserve a sensible group order instead of alphabetical.
const GROUP_ORDER = [
  "Allgemein",
  "Kunden & Aufträge",
  "Anfragen",
  "Teile & Personal",
  "Analysen",
  "System Management",
  "Content Management",
  "Marketing/Promo",
  "Persönlich",
]

const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  Users,
  BookMarked,
  ExternalLink,
  DollarSign,
  FileText,
  MessageSquare,
  AlertCircle,
  Boxes,
  Package2,
  UserCheck,
  BarChart3,
  Layers,
  Wrench,
  FolderTree,
  Plus,
  Smartphone,
  GitBranch,
  Settings,
  Database,
  Shield,
  Mail,
  Activity,
  ShoppingBag,
  HelpCircle,
  Layout,
  Search,
  Megaphone,
  Radio,
  Bell,
  User,
}

export function AdminSidebarSearch({ isCollapsed }: AdminSidebarSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const navigate = useNavigate()

  // Global keyboard shortcut: Cmd/Ctrl+K opens the admin search from anywhere.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  const groupedItems = useMemo(() => {
    const groups = new Map<string, typeof adminSearchIndex>()
    for (const item of adminSearchIndex) {
      const existing = groups.get(item.group) || []
      existing.push(item)
      groups.set(item.group, existing)
    }
    return GROUP_ORDER
      .filter((group) => groups.has(group))
      .map((group) => ({ group, items: groups.get(group)! }))
  }, [])

  const handleSelect = (path: string) => {
    setOpen(false)
    navigate(path)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`admin-sidebar-search-trigger ${isCollapsed ? "collapsed" : ""}`}
        aria-label="Admin-Bereich durchsuchen"
        title="Suchen (Cmd/Ctrl+K)"
      >
        <Search className="admin-sidebar-search-icon" />
        {!isCollapsed && <span className="admin-sidebar-search-placeholder">Menü &amp; Einstellungen durchsuchen…</span>}
        {!isCollapsed && <kbd className="admin-sidebar-search-kbd">⌘K</kbd>}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="admin-search-dialog-content">
          <DialogTitle className="sr-only">Admin-Bereich durchsuchen</DialogTitle>
          <DialogDescription className="sr-only">
            Suche nach Seiten, Einstellungen und Funktionen im Admin-Bereich und navigiere direkt dorthin.
          </DialogDescription>
          <Command
            className="admin-search-command"
            filter={(value, search, keywords) => {
              const haystack = `${value} ${(keywords || []).join(" ")}`.toLowerCase()
              return haystack.includes(search.toLowerCase()) ? 1 : 0
            }}
          >
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Seite, Einstellung oder Funktion suchen…"
              className="admin-search-input"
            />

            <CommandList className="admin-search-list">
              <CommandEmpty>
                <div className="admin-search-empty">
                  <SearchX className="admin-search-empty-icon" />
                  <p className="admin-search-empty-title">Keine Treffer gefunden</p>
                  <p className="admin-search-empty-subtitle">Versuche einen anderen Begriff, z. B. „SMTP“ oder „Mahnwesen“.</p>
                </div>
              </CommandEmpty>
              {groupedItems.map(({ group, items }) => (
                <CommandGroup key={group} heading={group} className="admin-search-group">
                  {items.map((item) => {
                    const Icon = ICON_MAP[item.icon] || FileText
                    return (
                      <CommandItem
                        key={item.id}
                        value={item.title}
                        keywords={item.keywords}
                        onSelect={() => handleSelect(item.path)}
                        className="admin-search-item"
                      >
                        <span className="admin-search-item-icon">
                          <Icon />
                        </span>
                        <span className="admin-search-item-text">
                          <span className="admin-search-item-title">{item.title}</span>
                          {item.description && (
                            <span className="admin-search-item-description">{item.description}</span>
                          )}
                        </span>
                        <span className="admin-search-item-group">{group}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ))}
            </CommandList>

            <div className="admin-search-footer">
              <span className="admin-search-footer-hint">
                <span className="admin-search-kbd-pill"><ArrowUp /><ArrowDown /></span>
                Navigieren
              </span>
              <span className="admin-search-footer-hint">
                <span className="admin-search-kbd-pill"><CornerDownLeft /></span>
                Öffnen
              </span>
              <span className="admin-search-footer-hint">
                <span className="admin-search-kbd-pill admin-search-kbd-pill-text">Esc</span>
                Schließen
              </span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}

