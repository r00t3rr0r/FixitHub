import { useMemo, useState, type ChangeEvent, type ReactNode } from "react"
import Papa from "papaparse"
import {
  Archive,
  Activity,
  CircleAlert,
  ChevronDown,
  ChevronUp,
  Columns3,
  CreditCard,
  Database,
  DollarSign,
  FileSearch,
  FileUp,
  Filter,
  ListTree,
  Mail,
  Phone,
  Receipt,
  Search,
  SlidersHorizontal,
  Trash2,
  User,
  Users,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/useToast"
import "./BookingsManagement.css"

const STORAGE_KEY = "fixithub_admin_legacy_orders_archive_v1"

type LegacyOrderRow = Record<string, string>

type ImportedDataset = {
  fileName: string
  importedAt: string
  columns: string[]
  rows: LegacyOrderRow[]
}

type SearchMatchSummary = {
  key: string
  label: string
  previews: string[]
}

type LegacyOrderGroup = {
  id: string
  orderNumber: string
  customerNumber: string
  customerDisplay: string
  email: string
  status: string
  payment: string
  shippingCountry: string
  currency: string
  orderDate: string
  amountTotal: number
  positions: number
  rows: LegacyOrderRow[]
  matchedColumns: SearchMatchSummary[]
}

type LegacyTableColumn = {
  id: string
  label: string
  source: "overview" | "csv"
  filterType: "text" | "select" | "number" | "date"
  getFilterValue: (group: LegacyOrderGroup) => string
  renderCell: (group: LegacyOrderGroup, query: string) => ReactNode
  filterOptions?: string[]
}

type OverviewSection = {
  id: string
  title: string
  groups: {
    id: string
    title: string
    items: {
      key: string
      label: string
      values: string[]
    }[]
  }[]
}

const REQUIRED_COLUMNS = [
  "Kunden-Nr",
  "Kundenkategorie",
  "Kundengruppe",
  "K_Vorname",
  "K_Nachname",
  "K_E-Mail",
  "Bestell Nr.",
  "Bestelldatum",
  "Status",
  "Versandland",
  "Wahrung",
  "Artikelnummer",
  "Bezeichnung",
  "Menge",
  "Betrag",
]

const HEADER_ALIASES: Record<string, string[]> = {
  "Kunden-Nr": ["Kunden-Nr", "Kunden-Nr******"],
  "Wahrung": ["Wahrung", "Waehrung"],
}

const SEARCH_FIELD_MAP: { key: string; label: string }[] = [
  { key: "Bestell Nr.", label: "Auftragsnummer" },
  { key: "Externe Belegnummer", label: "Externe Belegnummer" },
  { key: "Kunden-Nr", label: "Kundennummer" },
  { key: "Bestelldatum", label: "Bestelldatum" },
  { key: "K_Vorname", label: "Vorname" },
  { key: "K_Nachname", label: "Nachname" },
  { key: "K_Firma", label: "Firma" },
  { key: "K_E-Mail", label: "E-Mail" },
  { key: "Status", label: "Status" },
  { key: "Zahlungsart", label: "Zahlungsart" },
  { key: "Versandland", label: "Versandland" },
  { key: "Wahrung", label: "Waehrung" },
  { key: "Artikelnummer", label: "Artikelnummer" },
  { key: "Bezeichnung", label: "Bezeichnung" },
]

const CSV_COLUMN_ID_PREFIX = "csv:"

const LEGACY_OVERVIEW_COLUMNS: LegacyTableColumn[] = [
  {
    id: "orderNumber",
    label: "Auftrag",
    source: "overview",
    filterType: "text",
    getFilterValue: (group) => group.orderNumber,
    renderCell: (group, query) => <span className="font-semibold text-slate-900">{highlightText(group.orderNumber, query)}</span>,
  },
  {
    id: "customerNumber",
    label: "Kunden-Nr.",
    source: "overview",
    filterType: "text",
    getFilterValue: (group) => group.customerNumber,
    renderCell: (group, query) => <span>{highlightText(group.customerNumber, query)}</span>,
  },
  {
    id: "customerDisplay",
    label: "Kunde",
    source: "overview",
    filterType: "text",
    getFilterValue: (group) => group.customerDisplay,
    renderCell: (group, query) => <span className="font-medium">{highlightText(group.customerDisplay, query)}</span>,
  },
  {
    id: "email",
    label: "E-Mail",
    source: "overview",
    filterType: "text",
    getFilterValue: (group) => group.email,
    renderCell: (group, query) => <span className="text-sm">{highlightText(group.email, query)}</span>,
  },
  {
    id: "orderDate",
    label: "Datum",
    source: "overview",
    filterType: "date",
    getFilterValue: (group) => group.orderDate,
    renderCell: (group, query) => <span className="text-sm">{highlightText(group.orderDate, query)}</span>,
  },
  {
    id: "status",
    label: "Status",
    source: "overview",
    filterType: "select",
    getFilterValue: (group) => group.status,
    renderCell: (group, query) => <Badge variant="secondary">{highlightText(group.status, query)}</Badge>,
  },
  {
    id: "payment",
    label: "Zahlungsart",
    source: "overview",
    filterType: "select",
    getFilterValue: (group) => group.payment,
    renderCell: (group, query) => <span className="text-sm">{highlightText(group.payment, query)}</span>,
  },
  {
    id: "shippingCountry",
    label: "Versandland",
    source: "overview",
    filterType: "select",
    getFilterValue: (group) => group.shippingCountry,
    renderCell: (group, query) => <span className="text-sm">{highlightText(group.shippingCountry, query)}</span>,
  },
  {
    id: "currency",
    label: "Waehrung",
    source: "overview",
    filterType: "select",
    getFilterValue: (group) => group.currency,
    renderCell: (group, query) => <span className="text-sm">{highlightText(group.currency, query)}</span>,
  },
  {
    id: "positions",
    label: "Positionen",
    source: "overview",
    filterType: "number",
    getFilterValue: (group) => String(group.positions),
    renderCell: (group) => <span className="text-sm">{group.positions}</span>,
  },
  {
    id: "amountTotal",
    label: "Betrag",
    source: "overview",
    filterType: "number",
    getFilterValue: (group) => `${group.amountTotal} ${formatMoney(group.amountTotal)}`,
    renderCell: (group) => <span className="font-semibold">{formatMoney(group.amountTotal)}</span>,
  },
]

const DEFAULT_VISIBLE_COLUMN_IDS = LEGACY_OVERVIEW_COLUMNS.map((column) => column.id)

function normalizeHeader(value: string): string {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .trim()
}

function toCanonicalHeader(value: string): string {
  const normalizedValue = normalizeHeader(value)
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (normalizedValue === canonical) return canonical
    if (aliases.includes(normalizedValue)) return canonical
  }
  return normalizedValue
}

function parseLocalizedNumber(value: string): number {
  const input = String(value || "").trim()
  if (!input) return 0

  const sanitized = input.replace(/[^0-9,.-]/g, "")
  if (!sanitized) return 0

  const hasComma = sanitized.includes(",")
  const hasDot = sanitized.includes(".")

  if (hasComma && hasDot) {
    if (sanitized.lastIndexOf(",") > sanitized.lastIndexOf(".")) {
      const normalized = sanitized.replace(/\./g, "").replace(/,/g, ".")
      const parsed = Number(normalized)
      return Number.isFinite(parsed) ? parsed : 0
    }
    const normalized = sanitized.replace(/,/g, "")
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  if (hasComma && !hasDot) {
    const normalized = sanitized.replace(/,/g, ".")
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const parsed = Number(sanitized)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0)
}

function getCustomerDisplay(row: LegacyOrderRow): string {
  const company = row["K_Firma"] || ""
  const firstName = row["K_Vorname"] || ""
  const lastName = row["K_Nachname"] || ""
  const fullName = `${firstName} ${lastName}`.trim()

  if (company && fullName) return `${company} (${fullName})`
  return company || fullName || "-"
}

function toUniqueValues(rows: LegacyOrderRow[], key: string): string[] {
  const values = Array.from(new Set(rows.map((row) => String(row[key] || "").trim()).filter(Boolean)))
  return values.sort((a, b) => a.localeCompare(b, "de"))
}

function normalizeAliasedRow(input: Record<string, unknown>): LegacyOrderRow {
  const normalized: LegacyOrderRow = {}

  for (const [rawKey, rawValue] of Object.entries(input || {})) {
    const key = toCanonicalHeader(rawKey)
    const value = typeof rawValue === "string" ? rawValue.trim() : String(rawValue || "").trim()
    normalized[key] = value
  }

  return normalized
}

function deriveColumnsFromRows(rows: LegacyOrderRow[]): string[] {
  const columnSet = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columnSet.has(key)) columnSet.add(key)
    }
  }
  return Array.from(columnSet)
}

function getPersistedDataset(): ImportedDataset | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.rows)) return null
    return parsed as ImportedDataset
  } catch {
    return null
  }
}

function getSearchMatches(rows: LegacyOrderRow[], searchValue: string): SearchMatchSummary[] {
  if (!searchValue) return []
  const term = searchValue.toLowerCase()
  const matches = new Map<string, SearchMatchSummary>()

  for (const row of rows) {
    for (const field of SEARCH_FIELD_MAP) {
      const rawValue = String(row[field.key] || "").trim()
      const value = rawValue.toLowerCase()
      if (!value.includes(term)) continue

      const existing = matches.get(field.key)
      if (!existing) {
        matches.set(field.key, {
          key: field.key,
          label: field.label,
          previews: rawValue ? [rawValue] : [],
        })
        continue
      }

      if (rawValue && !existing.previews.includes(rawValue) && existing.previews.length < 2) {
        existing.previews.push(rawValue)
      }
    }
  }

  return Array.from(matches.values())
}

function normalizeFilterValue(value: string): string {
  return String(value || "").trim().toLowerCase()
}

function normalizeDateLikeValue(value: string): string {
  const normalized = String(value || "").trim()
  if (!normalized) return ""

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`

  const localMatch = normalized.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/)
  if (localMatch) {
    const day = localMatch[1].padStart(2, "0")
    const month = localMatch[2].padStart(2, "0")
    const year = localMatch[3].length === 2 ? `20${localMatch[3]}` : localMatch[3]
    return `${year}-${month}-${day}`
  }

  return normalized.toLowerCase()
}

function isLikelyDateValue(value: string): boolean {
  const normalized = String(value || "").trim()
  if (!normalized) return false
  return /^(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})$/.test(normalized)
}

function isLikelyNumericValue(value: string): boolean {
  const normalized = String(value || "").trim()
  if (!normalized) return false
  return /^[-+]?\d+(?:[.,]\d+)?$/.test(normalized.replace(/\s+/g, ""))
}

function detectAutoFilterType(column: string, values: string[]): LegacyTableColumn["filterType"] {
  const nonEmptyValues = values.filter(Boolean)
  if (nonEmptyValues.length === 0) return "text"

  if (nonEmptyValues.length <= 15 && nonEmptyValues.every((value) => value.length <= 60)) {
    return "select"
  }

  const lowerColumn = column.toLowerCase()
  if (lowerColumn.includes("datum") || lowerColumn.includes("date") || nonEmptyValues.every(isLikelyDateValue)) {
    return "date"
  }

  if (lowerColumn.includes("betrag") || lowerColumn.includes("preis") || lowerColumn.includes("menge") || nonEmptyValues.every(isLikelyNumericValue)) {
    return "number"
  }

  return "text"
}

function matchesColumnFilter(group: LegacyOrderGroup, column: LegacyTableColumn, filterValue: string): boolean {
  const normalizedFilter = normalizeFilterValue(filterValue)
  if (!normalizedFilter) return true

  const candidate = normalizeFilterValue(column.getFilterValue(group))
  if (!candidate) return false

  if (column.filterType === "select") {
    return candidate === normalizedFilter
  }

  if (column.filterType === "date") {
    return normalizeDateLikeValue(candidate).includes(normalizeDateLikeValue(normalizedFilter))
  }

  if (column.filterType === "number") {
    return candidate.includes(normalizedFilter)
  }

  return candidate.includes(normalizedFilter)
}

function highlightText(value: string, query: string): ReactNode {
  const text = String(value || "")
  const q = query.trim()
  if (!q) return text || "-"

  const lowerText = text.toLowerCase()
  const lowerQuery = q.toLowerCase()
  const index = lowerText.indexOf(lowerQuery)

  if (index < 0) return text || "-"

  const start = text.slice(0, index)
  const middle = text.slice(index, index + q.length)
  const end = text.slice(index + q.length)

  return (
    <>
      {start}
      <mark className="rounded bg-amber-200 px-0.5 text-slate-900">{middle}</mark>
      {end}
    </>
  )
}

function buildOrderGroups(rows: LegacyOrderRow[]): LegacyOrderGroup[] {
  const grouped = new Map<string, LegacyOrderRow[]>()

  rows.forEach((row, idx) => {
    const orderNumber = (row["Bestell Nr."] || "").trim()
    const key = orderNumber || `row-${idx}`
    const existing = grouped.get(key) || []
    existing.push(row)
    grouped.set(key, existing)
  })

  return Array.from(grouped.entries()).map(([id, groupRows]) => {
    const first = groupRows[0] || {}
    const amountTotal = groupRows.reduce((sum, row) => {
      return sum + parseLocalizedNumber(row["Betrag"] || row["Netto Gesamt"] || "0")
    }, 0)

    return {
      id,
      orderNumber: first["Bestell Nr."] || "(ohne Nummer)",
      customerNumber: first["Kunden-Nr"] || "-",
      customerDisplay: getCustomerDisplay(first),
      email: first["K_E-Mail"] || "-",
      status: first["Status"] || "-",
      payment: first["Zahlungsart"] || "-",
      shippingCountry: first["Versandland"] || "-",
      currency: first["Wahrung"] || "-",
      orderDate: first["Bestelldatum"] || "-",
      amountTotal,
      positions: groupRows.length,
      rows: groupRows,
      matchedColumns: [],
    }
  })
}

function formatColumnLabel(column: string): string {
  return column
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function toCsvColumnId(column: string): string {
  return `${CSV_COLUMN_ID_PREFIX}${column}`
}

function summarizeColumnValues(values: string[]): string {
  if (values.length === 0) return "-"
  if (values.length === 1) return values[0]

  const preview = values.slice(0, 2).join(" | ")
  return values.length > 2 ? `${preview} +${values.length - 2}` : preview
}

function buildCsvTableColumn(column: string, rows: LegacyOrderRow[]): LegacyTableColumn {
  const filterOptions = toUniqueValues(rows, column)
  const filterType = detectAutoFilterType(column, filterOptions)

  return {
    id: toCsvColumnId(column),
    label: formatColumnLabel(column),
    source: "csv",
    filterType,
    filterOptions: filterType === "select" ? filterOptions : undefined,
    getFilterValue: (group) => uniqueColumnValues(group.rows, column).join(" | "),
    renderCell: (group, query) => {
      const values = uniqueColumnValues(group.rows, column)
      const preview = summarizeColumnValues(values)

      return (
        <span className="text-sm" title={values.join(" | ") || undefined}>
          {highlightText(preview, query)}
        </span>
      )
    },
  }
}

function sectionForColumn(column: string): string {
  if (column.startsWith("K_") || column.includes("Kunden") || column === "Steuernr") return "customer"
  if (column.startsWith("L_") || column.includes("Versand") || column.includes("Liefer")) return "shipping"
  if (
    column.includes("Zahl")
    || column.includes("Betrag")
    || column.includes("Wahrung")
    || column.includes("SKR")
    || column.includes("USt")
    || column.includes("Netto")
    || column.includes("Brutto")
    || column.includes("Rabatt")
  ) return "payment"
  if (
    column.includes("Artikel")
    || column.includes("Bezeichnung")
    || column.includes("Position")
    || column.includes("Variation")
    || column.includes("Stucklisten")
    || column.includes("Menge")
    || column.includes("Hinweis")
  ) return "items"
  return "order"
}

function subgroupForColumn(column: string): { id: string; title: string } {
  if (column.startsWith("K_")) {
    if (column.includes("E-Mail") || column.includes("Tel") || column.includes("Mobil") || column.includes("Fax")) {
      return { id: "customer-contact", title: "Kontakt" }
    }
    if (column.includes("Stra") || column.includes("Adress") || column.includes("PLZ") || column.includes("Ort") || column.includes("Bundesland") || column.includes("Land")) {
      return { id: "customer-address", title: "Adresse" }
    }
    if (column.includes("Firma") || column.includes("Titel") || column.includes("Anrede") || column.includes("z. Hd.")) {
      return { id: "customer-master", title: "Stammdaten" }
    }
    return { id: "customer-other", title: "Weitere Kundendaten" }
  }

  if (column.startsWith("L_") || column.includes("Versand") || column.includes("Liefer")) {
    if (column.includes("E-Mail") || column.includes("Tel") || column.includes("Mobil") || column.includes("Fax")) {
      return { id: "shipping-contact", title: "Lieferkontakt" }
    }
    if (column.includes("Stra") || column.includes("Adress") || column.includes("PLZ") || column.includes("Ort") || column.includes("Bundesland") || column.includes("Land")) {
      return { id: "shipping-address", title: "Lieferadresse" }
    }
    return { id: "shipping-other", title: "Weitere Versandinfos" }
  }

  if (
    column.includes("Artikel")
    || column.includes("Bezeichnung")
    || column.includes("Position")
    || column.includes("Menge")
  ) {
    return { id: "item-core", title: "Positionskern" }
  }

  if (column.includes("Variation")) {
    return { id: "item-variation", title: "Variationen" }
  }

  if (
    column.includes("USt")
    || column.includes("Netto")
    || column.includes("Brutto")
    || column.includes("Rabatt")
    || column.includes("Betrag")
    || column.includes("Zahl")
    || column.includes("Wahrung")
    || column.includes("SKR")
  ) {
    return { id: "payment-financial", title: "Finanzdaten" }
  }

  if (column.includes("Status") || column.includes("Bestell") || column.includes("Externe")) {
    return { id: "order-core", title: "Kerninfos" }
  }

  return { id: "other", title: "Weitere Infos" }
}

function uniqueColumnValues(rows: LegacyOrderRow[], column: string): string[] {
  const seen = new Set<string>()
  const values: string[] = []

  for (const row of rows) {
    const value = String(row[column] || "").trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    values.push(value)
  }

  return values
}

function isLongInfoValue(values: string[]): boolean {
  const joined = values.join(" | ")
  return joined.length > 90 || joined.includes("\n")
}

function toPairRows<T>(items: T[], perRow = 2): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += perRow) {
    rows.push(items.slice(i, i + perRow))
  }
  return rows
}

function buildOverviewSections(columns: string[], rows: LegacyOrderRow[]): OverviewSection[] {
  const grouped: Record<string, OverviewSection> = {
    order: { id: "order", title: "Auftragsdaten", groups: [] },
    customer: { id: "customer", title: "Kundendaten", groups: [] },
    shipping: { id: "shipping", title: "Liefer- und Versanddaten", groups: [] },
    payment: { id: "payment", title: "Zahlung und Betraege", groups: [] },
    items: { id: "items", title: "Artikel und Positionen", groups: [] },
  }

  const groupMap = new Map<string, Map<string, { id: string; title: string; items: { key: string; label: string; values: string[] }[] }>>()

  for (const column of columns) {
    const values = uniqueColumnValues(rows, column)
    if (values.length === 0) continue

    const sectionId = sectionForColumn(column)
    const subgroup = subgroupForColumn(column)

    if (!groupMap.has(sectionId)) {
      groupMap.set(sectionId, new Map())
    }

    const sectionGroups = groupMap.get(sectionId)!
    if (!sectionGroups.has(subgroup.id)) {
      sectionGroups.set(subgroup.id, {
        id: subgroup.id,
        title: subgroup.title,
        items: [],
      })
    }

    sectionGroups.get(subgroup.id)!.items.push({
      key: column,
      label: formatColumnLabel(column),
      values,
    })
  }

  for (const [sectionId, section] of Object.entries(grouped)) {
    const sectionGroups = groupMap.get(sectionId)
    if (!sectionGroups) continue
    section.groups = Array.from(sectionGroups.values())
      .filter((subgroup) => subgroup.items.length > 0)
      .sort((a, b) => a.title.localeCompare(b.title, "de"))
  }

  return [grouped.order, grouped.customer, grouped.shipping, grouped.payment, grouped.items]
    .filter((section) => section.groups.length > 0)
}

function getFirstNonEmptyValue(rows: LegacyOrderRow[], keys: string[]): string {
  for (const row of rows) {
    for (const key of keys) {
      const value = String(row[key] || "").trim()
      if (value) return value
    }
  }
  return ""
}

function getAddressData(rows: LegacyOrderRow[], prefix: "K" | "L") {
  const street = getFirstNonEmptyValue(rows, [`${prefix}_Straße`, `${prefix}_Strasse`])
  const zip = getFirstNonEmptyValue(rows, [`${prefix}_PLZ`])
  const city = getFirstNonEmptyValue(rows, [`${prefix}_Ort`])
  const state = getFirstNonEmptyValue(rows, [`${prefix}_Bundesland`])
  const country = getFirstNonEmptyValue(rows, [`${prefix}_Land`])

  return {
    street,
    zip,
    city,
    state,
    country,
    hasData: Boolean(street || zip || city || state || country),
  }
}

function statusProgress(status: string): number {
  const normalized = String(status || "").toLowerCase()
  if (normalized.includes("abgeschlossen") || normalized.includes("completed")) return 100
  if (normalized.includes("in bearbeitung") || normalized.includes("processing") || normalized.includes("progress")) return 60
  if (normalized.includes("offen") || normalized.includes("pending")) return 25
  return 50
}

export function LegacyOrdersArchive() {
  const { toast } = useToast()
  const [dataset, setDataset] = useState<ImportedDataset | null>(() => getPersistedDataset())
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [paymentFilter, setPaymentFilter] = useState("all")
  const [countryFilter, setCountryFilter] = useState("all")
  const [currencyFilter, setCurrencyFilter] = useState("all")
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [isColumnFiltersExpanded, setIsColumnFiltersExpanded] = useState(false)
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(DEFAULT_VISIBLE_COLUMN_IDS)
  const [pageSize, setPageSize] = useState("20")
  const [page, setPage] = useState(1)

  const rows = useMemo(() => dataset?.rows || [], [dataset])
  const allColumns = useMemo(() => {
    if (!dataset) return []
    if (Array.isArray(dataset.columns) && dataset.columns.length > 0) return dataset.columns
    return deriveColumnsFromRows(dataset.rows)
  }, [dataset])

  const orderGroups = useMemo(() => buildOrderGroups(rows), [rows])

  const statusOptions = useMemo(() => toUniqueValues(rows, "Status"), [rows])
  const paymentOptions = useMemo(() => toUniqueValues(rows, "Zahlungsart"), [rows])
  const countryOptions = useMemo(() => toUniqueValues(rows, "Versandland"), [rows])
  const currencyOptions = useMemo(() => toUniqueValues(rows, "Wahrung"), [rows])
  const csvTableColumns = useMemo(
    () => allColumns.map((column) => buildCsvTableColumn(column, rows)),
    [allColumns, rows]
  )
  const availableTableColumns = useMemo(
    () => [...LEGACY_OVERVIEW_COLUMNS, ...csvTableColumns],
    [csvTableColumns]
  )
  const visibleColumns = useMemo(
    () => availableTableColumns.filter((column) => visibleColumnIds.includes(column.id)),
    [availableTableColumns, visibleColumnIds]
  )
  const columnFilterOptions = useMemo(
    () => availableTableColumns.reduce<Record<string, string[]>>((accumulator, column) => {
      if (column.filterOptions) {
        accumulator[column.id] = column.filterOptions
        return accumulator
      }

      if (column.id === "status") accumulator[column.id] = statusOptions
      if (column.id === "payment") accumulator[column.id] = paymentOptions
      if (column.id === "shippingCountry") accumulator[column.id] = countryOptions
      if (column.id === "currency") accumulator[column.id] = currencyOptions
      return accumulator
    }, {}),
    [availableTableColumns, statusOptions, paymentOptions, countryOptions, currencyOptions]
  )
  const activeColumnFilterCount = useMemo(
    () => Object.values(columnFilters).filter((value) => normalizeFilterValue(value).length > 0).length,
    [columnFilters]
  )
  const autoSelectFilterCount = useMemo(
    () => visibleColumns.filter((column) => column.filterType === "select").length,
    [visibleColumns]
  )

  const matchedRequiredColumns = useMemo(() => {
    if (!allColumns.length) return []
    const keys = new Set(allColumns)
    return REQUIRED_COLUMNS.filter((column) => keys.has(column))
  }, [allColumns])

  const filteredOrderGroups = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return orderGroups
      .map((group) => {
        const matchedColumns = getSearchMatches(group.rows, term)
        return {
          ...group,
          matchedColumns,
        }
      })
      .filter((group) => {
        const matchStatus = statusFilter === "all" || group.status === statusFilter
        const matchPayment = paymentFilter === "all" || group.payment === paymentFilter
        const matchCountry = countryFilter === "all" || group.shippingCountry === countryFilter
        const matchCurrency = currencyFilter === "all" || group.currency === currencyFilter
        const matchColumns = availableTableColumns.every((column) => matchesColumnFilter(group, column, columnFilters[column.id] || ""))

        if (!(matchStatus && matchPayment && matchCountry && matchCurrency && matchColumns)) return false

        if (!term) return true
        return group.matchedColumns.length > 0
      })
      .sort((a, b) => b.orderDate.localeCompare(a.orderDate))
  }, [orderGroups, searchTerm, statusFilter, paymentFilter, countryFilter, currencyFilter, columnFilters, availableTableColumns])

  const filteredRows = useMemo(() => filteredOrderGroups.flatMap((group) => group.rows), [filteredOrderGroups])

  const uniqueOrders = useMemo(() => orderGroups.length, [orderGroups])
  const uniqueCustomers = useMemo(() => new Set(rows.map((row) => row["Kunden-Nr"]).filter(Boolean)).size, [rows])

  const amountSum = useMemo(() => {
    return filteredRows.reduce((acc, row) => {
      const amount = parseLocalizedNumber(row["Betrag"] || row["Netto Gesamt"] || "0")
      return acc + amount
    }, 0)
  }, [filteredRows])

  const pageSizeNumber = Number(pageSize)
  const totalPages = Math.max(1, Math.ceil(filteredOrderGroups.length / pageSizeNumber))
  const safePage = Math.min(page, totalPages)
  const pageStart = filteredOrderGroups.length === 0 ? 0 : (safePage - 1) * pageSizeNumber + 1
  const pageEnd = Math.min(filteredOrderGroups.length, safePage * pageSizeNumber)

  const pagedGroups = useMemo(() => {
    const start = (safePage - 1) * pageSizeNumber
    const end = start + pageSizeNumber
    return filteredOrderGroups.slice(start, end)
  }, [filteredOrderGroups, safePage, pageSizeNumber])

  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null
    return filteredOrderGroups.find((group) => group.id === selectedOrderId)
      || orderGroups.find((group) => group.id === selectedOrderId)
      || null
  }, [selectedOrderId, filteredOrderGroups, orderGroups])

  const selectedOverviewSections = useMemo(() => {
    if (!selectedOrder) return []
    return buildOverviewSections(allColumns, selectedOrder.rows)
  }, [selectedOrder, allColumns])

  const selectedOverviewMeta = useMemo(() => {
    if (!selectedOrder) return null

    const rowsForOrder = selectedOrder.rows
    const customerName = selectedOrder.customerDisplay
    const billingAddress = getAddressData(rowsForOrder, "K")
    const shippingAddress = getAddressData(rowsForOrder, "L")

    const grossSubtotal = rowsForOrder.reduce((sum, row) => sum + parseLocalizedNumber(row["VK Brutto"] || "0"), 0)
    const netSubtotal = rowsForOrder.reduce((sum, row) => sum + parseLocalizedNumber(row["VK Netto"] || row["Netto Gesamt"] || "0"), 0)
    const discountPercentValues = Array.from(new Set(rowsForOrder.map((row) => String(row["Rabatt(%)"] || "").trim()).filter(Boolean)))
    const vatValues = Array.from(new Set(rowsForOrder.map((row) => String(row["USt"] || "").trim()).filter(Boolean)))

    return {
      customerName,
      customerInitial: (customerName || "?").charAt(0).toUpperCase(),
      customerId: selectedOrder.customerNumber,
      customerEmail: selectedOrder.email,
      customerPhone: getFirstNonEmptyValue(rowsForOrder, ["K_Tel", "K_Mobil"]),
      billingAddress,
      shippingAddress,
      progress: statusProgress(selectedOrder.status),
      grossSubtotal,
      netSubtotal,
      discountPercentValues,
      vatValues,
      createdAt: getFirstNonEmptyValue(rowsForOrder, ["Bestelldatum"]),
      paidAt: getFirstNonEmptyValue(rowsForOrder, ["Bezahl Datum"]),
    }
  }, [selectedOrder])

  const selectedGroupedCardData = useMemo(() => {
    const buckets = {
      customer: [] as { sectionTitle: string; groupTitle: string; items: { key: string; label: string; values: string[] }[] }[],
      status: [] as { sectionTitle: string; groupTitle: string; items: { key: string; label: string; values: string[] }[] }[],
      finance: [] as { sectionTitle: string; groupTitle: string; items: { key: string; label: string; values: string[] }[] }[],
    }

    for (const section of selectedOverviewSections) {
      const bucketName = section.id === "customer"
        ? "customer"
        : section.id === "payment"
          ? "finance"
          : "status"

      for (const group of section.groups) {
        if (!group.items.length) continue
        buckets[bucketName].push({
          sectionTitle: section.title,
          groupTitle: group.title,
          items: group.items,
        })
      }
    }

    return buckets
  }, [selectedOverviewSections])

  const importCsv = (file: File) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: normalizeHeader,
      complete: (result) => {
        if (result.errors?.length) {
          toast({
            title: "CSV Import mit Warnungen",
            description: `Es wurden ${result.errors.length} Parsing-Hinweise gemeldet. Daten wurden soweit moeglich geladen.`,
            variant: "destructive",
          })
        }

        const parsedRows = (result.data || [])
          .map((entry) => normalizeAliasedRow(entry || {}))
          .filter((row) => Object.values(row).some((value) => String(value || "").trim() !== ""))

        const importedColumns = (result.meta.fields || [])
          .map((field) => toCanonicalHeader(field))
          .filter((value) => value.length > 0)
        const normalizedColumns = Array.from(new Set(importedColumns))
        const fallbackColumns = deriveColumnsFromRows(parsedRows)

        const nextDataset: ImportedDataset = {
          fileName: file.name,
          importedAt: new Date().toISOString(),
          columns: normalizedColumns.length > 0 ? normalizedColumns : fallbackColumns,
          rows: parsedRows,
        }

        setDataset(nextDataset)
        setSearchTerm("")
        setStatusFilter("all")
        setPaymentFilter("all")
        setCountryFilter("all")
        setCurrencyFilter("all")
        setColumnFilters({})
        setVisibleColumnIds(DEFAULT_VISIBLE_COLUMN_IDS)
        setSelectedOrderId(null)
        setPage(1)

        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDataset))

        toast({
          title: "CSV importiert",
          description: `${parsedRows.length} Zeilen aus ${file.name} wurden geladen.`,
        })
      },
      error: (error) => {
        toast({
          title: "CSV Import fehlgeschlagen",
          description: error.message || "Die Datei konnte nicht gelesen werden.",
          variant: "destructive",
        })
      },
    })
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    importCsv(file)
    event.target.value = ""
  }

  const clearImportedData = () => {
    setDataset(null)
    setSearchTerm("")
    setStatusFilter("all")
    setPaymentFilter("all")
    setCountryFilter("all")
    setCurrencyFilter("all")
    setColumnFilters({})
    setVisibleColumnIds(DEFAULT_VISIBLE_COLUMN_IDS)
    setSelectedOrderId(null)
    setPage(1)
    localStorage.removeItem(STORAGE_KEY)

    toast({
      title: "Archiv geleert",
      description: "Die importierten Altdaten wurden entfernt.",
    })
  }

  const updateColumnFilter = (columnId: string, value: string) => {
    setColumnFilters((current) => ({
      ...current,
      [columnId]: value,
    }))
    setPage(1)
  }

  const clearAllFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setPaymentFilter("all")
    setCountryFilter("all")
    setCurrencyFilter("all")
    setColumnFilters({})
    setPage(1)
  }

  const toggleVisibleColumn = (columnId: string, isVisible: boolean) => {
    setVisibleColumnIds((current) => {
      if (isVisible) {
        if (current.includes(columnId)) return current
        const nextIds = new Set([...current, columnId])
        return availableTableColumns
          .map((column) => column.id)
          .filter((id) => nextIds.has(id))
      }

      if (current.length === 1) return current
      return current.filter((id) => id !== columnId)
    })

    if (!isVisible) {
      setColumnFilters((current) => {
        if (!(columnId in current)) return current
        const next = { ...current }
        delete next[columnId]
        return next
      })
    }
  }

  return (
    <div className="container mx-auto max-w-[1700px] space-y-4 px-4 py-4 lg:px-5">
      <div className="rounded-lg border border-slate-200 bg-gradient-to-r from-[#14264f] via-[#1f3f82] to-[#2f5fb5] px-4 py-4 text-white shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Alte Auftragsdaten Archiv</h1>
            <p className="mt-1 text-sm text-slate-200">
              Intuitive Auftragsansicht mit Suchtreffern und Detail-Dialog fuer alle CSV-Felder.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-white/95 px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-white">
            <FileUp className="h-4 w-4" />
            CSV importieren
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
          </label>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Importierte Zeilen</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-slate-500" />
              <span className="text-2xl font-bold text-slate-900">{rows.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Eindeutige Auftraege</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-slate-500" />
              <span className="text-2xl font-bold text-slate-900">{uniqueOrders}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Eindeutige Kunden</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-500" />
              <span className="text-2xl font-bold text-slate-900">{uniqueCustomers}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Summe (gefiltert)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-slate-500" />
              <span className="text-2xl font-bold text-slate-900">{formatMoney(amountSum)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import-Status</CardTitle>
          <CardDescription>
            {dataset
              ? `Quelle: ${dataset.fileName} | Import: ${new Date(dataset.importedAt).toLocaleString("de-DE")}`
              : "Noch keine CSV importiert"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={matchedRequiredColumns.length === REQUIRED_COLUMNS.length ? "default" : "secondary"}>
              {matchedRequiredColumns.length}/{REQUIRED_COLUMNS.length} Kernspalten erkannt
            </Badge>
            {matchedRequiredColumns.length !== REQUIRED_COLUMNS.length && rows.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                <CircleAlert className="h-3.5 w-3.5" />
                Einige Spalten fehlen. Alle importierten Felder bleiben im Detail-Dialog einsehbar.
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {matchedRequiredColumns.slice(0, 12).map((column) => (
              <Badge key={column} variant="outline">{column}</Badge>
            ))}
          </div>

          {dataset && (
            <Button variant="outline" size="sm" onClick={clearImportedData}>
              <Trash2 className="mr-2 h-4 w-4" />
              Archiv leeren
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Suche & Filter</CardTitle>
          <CardDescription>Schneller Zugriff auf alte Auftraege mit Spaltensuche, Sichtbarkeitssteuerung und einstellbarer Seitenlaenge.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="grid flex-1 grid-cols-1 gap-3 xl:grid-cols-5">
              <div className="xl:col-span-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Suche: Bestellnr, Kunden-Nr, Name, E-Mail, Artikelnummer ..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value)
                      setPage(1)
                    }}
                  />
                </div>
              </div>

              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1) }}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  {statusOptions.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={paymentFilter} onValueChange={(value) => { setPaymentFilter(value); setPage(1) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Zahlungsart" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Zahlungsarten</SelectItem>
                  {paymentOptions.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={countryFilter} onValueChange={(value) => { setCountryFilter(value); setPage(1) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Versandland" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Versandlaender</SelectItem>
                  {countryOptions.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={currencyFilter} onValueChange={(value) => { setCurrencyFilter(value); setPage(1) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Waehrung" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Waehrungen</SelectItem>
                  {currencyOptions.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Columns3 className="h-4 w-4" />
                    Spalten
                    <Badge variant="secondary" className="ml-1">{visibleColumns.length}/{availableTableColumns.length}</Badge>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-[70vh] w-64 overflow-y-auto">
                  <DropdownMenuLabel>Sichtbare Tabellen-Spalten</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-medium text-slate-500">Uebersicht</DropdownMenuLabel>
                  {LEGACY_OVERVIEW_COLUMNS.map((column) => {
                    const checked = visibleColumnIds.includes(column.id)
                    const disableHide = checked && visibleColumnIds.length === 1
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={checked}
                        disabled={disableHide}
                        onCheckedChange={(nextChecked) => toggleVisibleColumn(column.id, nextChecked === true)}
                      >
                        {column.label}
                      </DropdownMenuCheckboxItem>
                    )
                  })}

                  {csvTableColumns.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs font-medium text-slate-500">CSV-Spalten</DropdownMenuLabel>
                      {csvTableColumns.map((column) => {
                        const checked = visibleColumnIds.includes(column.id)
                        const disableHide = checked && visibleColumnIds.length === 1
                        return (
                          <DropdownMenuCheckboxItem
                            key={column.id}
                            checked={checked}
                            disabled={disableHide}
                            onCheckedChange={(nextChecked) => toggleVisibleColumn(column.id, nextChecked === true)}
                          >
                            {column.label}
                          </DropdownMenuCheckboxItem>
                        )
                      })}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="outline" onClick={clearAllFilters}>
                Filter zuruecksetzen
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                <div className="inline-flex items-center gap-2 font-medium">
                  <SlidersHorizontal className="h-4 w-4" />
                  Spaltenfilter
                </div>
                <Badge variant="outline">{activeColumnFilterCount} aktiv</Badge>
                <Badge variant="outline">{visibleColumns.length} sichtbar</Badge>
                <Badge variant="outline">{autoSelectFilterCount} Auto-Auswahl</Badge>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 self-start sm:self-auto"
                onClick={() => setIsColumnFiltersExpanded((current) => !current)}
              >
                {isColumnFiltersExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {isColumnFiltersExpanded ? "Filter minimieren" : "Filter erweitern"}
              </Button>
            </div>

            {!isColumnFiltersExpanded ? (
              <p className="mt-3 text-sm text-slate-600">
                Die Spaltenfilter sind minimiert. Beim Erweitern werden fuer sichtbare Spalten automatisch passende Filter angezeigt: Auswahlfelder bei wenigen Werten, Freitext fuer offene Inhalte sowie optimierte Eingaben fuer Zahlen- und Datumsfelder.
              </p>
            ) : (
              <>
                <p className="mb-3 mt-3 text-sm text-slate-600">
                  Automatische Filterwahl je sichtbarer Spalte: Auswahl bei wenigen Auspraegungen, Freitext fuer offene Inhalte sowie optimierte Eingaben fuer Zahlen und Datumswerte.
                </p>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
                  {visibleColumns.map((column) => {
                    const filterValue = columnFilters[column.id] || ""
                    const options = columnFilterOptions[column.id] || []

                    return (
                      <div key={`column-filter-${column.id}`} className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{column.label}</label>
                        {column.filterType === "select" ? (
                          <Select value={filterValue || "all"} onValueChange={(value) => updateColumnFilter(column.id, value === "all" ? "" : value)}>
                            <SelectTrigger>
                              <SelectValue placeholder={`${column.label} filtern`} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Alle Werte</SelectItem>
                              {options.map((option) => (
                                <SelectItem key={`${column.id}-${option}`} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={column.filterType === "number" ? "number" : column.filterType === "date" ? "date" : "text"}
                            inputMode={column.filterType === "number" ? "decimal" : undefined}
                            value={filterValue}
                            placeholder={`${column.label} filtern`}
                            onChange={(event) => updateColumnFilter(column.id, event.target.value)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {searchTerm.trim() && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              <div className="flex items-center gap-2 font-medium">
                <FileSearch className="h-4 w-4" />
                Suchbegriff "{searchTerm}" gefunden in {filteredOrderGroups.length} Auftraegen und {filteredRows.length} Positionen.
              </div>
              <p className="mt-1 text-xs text-blue-700">
                In der Treffer-Spalte siehst du direkt Spaltenname und Wertauszug des jeweiligen Treffers.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Auftragsuebersicht</CardTitle>
          <CardDescription>
            {dataset ? "Kompakte Leseansicht. Klicke auf Details fuer den kompletten Datensatz." : "Importiere zuerst eine CSV-Datei."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleColumns.map((column) => (
                    <TableHead key={`head-${column.id}`}>{column.label}</TableHead>
                  ))}
                  <TableHead>Treffer</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumns.length + 2} className="h-20 text-center text-muted-foreground">
                      {dataset ? "Keine Auftraege fuer diese Filter." : "Noch keine CSV importiert."}
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedGroups.map((group) => (
                    <TableRow
                      key={group.id}
                      className="cursor-pointer transition-colors hover:bg-slate-50 focus-visible:bg-slate-50"
                      tabIndex={0}
                      onClick={() => setSelectedOrderId(group.id)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return
                        event.preventDefault()
                        setSelectedOrderId(group.id)
                      }}
                    >
                      {visibleColumns.map((column) => (
                        <TableCell key={`${group.id}-${column.id}`}>{column.renderCell(group, searchTerm)}</TableCell>
                      ))}
                      <TableCell>
                        {group.matchedColumns.length > 0 ? (
                          <div className="space-y-1.5">
                            {group.matchedColumns.slice(0, 2).map((match) => (
                              <div key={`${group.id}-${match.key}`} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-900">{match.label}</div>
                                <div className="truncate text-xs text-slate-700">
                                  {highlightText(match.previews[0] || "-", searchTerm)}
                                </div>
                              </div>
                            ))}
                            {group.matchedColumns.length > 2 && (
                              <Badge variant="outline" className="text-[11px]">+{group.matchedColumns.length - 2} weitere Spalten</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setSelectedOrderId(group.id)}>
                          <ListTree className="mr-2 h-3.5 w-3.5" />
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span className="text-sm text-muted-foreground">
              Seite {safePage} von {totalPages} | Zeige {pageStart}-{pageEnd} von {filteredOrderGroups.length} Auftraegen
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Auftraege pro Seite</span>
              <Select value={pageSize} onValueChange={(value) => { setPageSize(value); setPage(1) }}>
                <SelectTrigger className="h-8 w-[90px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={safePage <= 1}>
                Zurueck
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={safePage >= totalPages}>
                Weiter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedOrder)} onOpenChange={(open) => { if (!open) setSelectedOrderId(null) }}>
        <DialogContent
          className="bookings-detail-dialog w-[96vw] max-w-6xl max-h-[90vh] overflow-y-auto"
          style={{
            background: "var(--off-white, #f8f9fc)",
            border: "1px solid var(--gray-200, #d8dce6)",
            borderRadius: "var(--radius-lg, 16px)",
            boxShadow: "var(--shadow-xl, 0 16px 48px rgba(0,0,0,0.15))",
            fontFamily: "var(--font-main, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)",
          }}
        >
          <DialogHeader className="bookings-detail-header" style={{ marginBottom: "14px", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.22)" }}>
            <DialogTitle style={{ fontSize: "1.15rem", fontWeight: "700", color: "#f5c800", marginBottom: "2px", letterSpacing: "-0.5px" }}>
              Auftragsdetails
            </DialogTitle>
            <DialogDescription style={{ fontSize: "0.78rem", color: "#c8d0e7", fontWeight: "500" }}>
              Vollstaendige Detailansicht mit Positionen und allen importierten CSV-Spalten.
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList
                className="grid w-full grid-cols-2"
                style={{
                  background: "var(--white, #ffffff)",
                  border: "1px solid var(--gray-200, #d8dce6)",
                  borderRadius: "var(--radius-md, 10px)",
                  padding: "2px",
                  boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))",
                  gap: "2px",
                }}
              >
                <TabsTrigger value="overview" style={{ fontSize: "0.76rem", fontWeight: "600", borderRadius: "var(--radius-sm, 6px)", transition: "var(--transition, all 0.25s cubic-bezier(0.4, 0, 0.2, 1))" }}>
                  Uebersicht
                </TabsTrigger>
                <TabsTrigger value="raw" style={{ fontSize: "0.76rem", fontWeight: "600", borderRadius: "var(--radius-sm, 6px)", transition: "var(--transition, all 0.25s cubic-bezier(0.4, 0, 0.2, 1))" }}>
                  Alle CSV-Felder
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div
                  style={{
                    background: "var(--white, #ffffff)",
                    border: "1px solid var(--gray-200, #d8dce6)",
                    borderRadius: "var(--radius-lg, 16px)",
                    padding: "20px",
                    boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))",
                  }}
                >
                  <div className="flex items-center gap-2" style={{ background: "linear-gradient(180deg, #1a2a5e 0%, #0f1d45 100%)", padding: "10px 16px", borderRadius: "16px 16px 0 0", margin: "-20px -20px 16px -20px", borderBottom: "1px solid #0f1d45" }}>
                    <div style={{ background: "rgba(245,200,0,0.18)", borderRadius: "8px", padding: "6px" }}>
                      <User className="h-4 w-4" style={{ color: "#f5c800" }} />
                    </div>
                    <h3 style={{ color: "#f5c800", fontSize: "1rem", fontWeight: "700" }}>Kundeninformationen</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-3 md:col-span-1">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 flex items-center justify-center rounded-full" style={{ border: "2px solid var(--accent-yellow, #f5b800)", background: "var(--primary-blue, #1a2a5e)", color: "#fff", fontWeight: 700 }}>
                          {selectedOverviewMeta?.customerInitial || "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate" style={{ color: "var(--gray-900, #111827)" }}>{selectedOverviewMeta?.customerName || "-"}</p>
                          <p className="text-xs truncate" style={{ color: "var(--gray-400, #8892a8)" }}>ID: {selectedOverviewMeta?.customerId || "-"}</p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--primary-blue, #1a2a5e)" }} />
                          <span className="truncate" style={{ color: "var(--gray-700, #2d3748)" }}>{selectedOverviewMeta?.customerEmail || "Nicht verfuegbar"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--primary-blue, #1a2a5e)" }} />
                          <span style={{ color: selectedOverviewMeta?.customerPhone ? "var(--gray-700, #2d3748)" : "var(--gray-400, #8892a8)" }}>{selectedOverviewMeta?.customerPhone || "Nicht verfuegbar"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <div className="flex items-center gap-1.5 mb-2">
                        <CreditCard className="h-3.5 w-3.5" style={{ color: "var(--primary-blue, #1a2a5e)" }} />
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gray-500, #636e85)" }}>Zugeordnete Kundendaten</p>
                      </div>

                      {selectedGroupedCardData.customer.length > 0 ? (
                        <div className="space-y-2">
                          {selectedGroupedCardData.customer.map((group) => (
                            <div key={`customer-group-${group.sectionTitle}-${group.groupTitle}`} className="rounded border border-[#dbe5f7] bg-[#fbfdff] p-2">
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.05em]" style={{ color: "#2f558e" }}>
                                {group.sectionTitle} - {group.groupTitle}
                              </p>
                              <div className="space-y-1">
                                {group.items.map((item) => (
                                  <div key={`customer-item-${group.groupTitle}-${item.key}`} className="text-[11px] leading-snug" style={{ color: "var(--gray-700, #2d3748)" }}>
                                    <span className="font-semibold" style={{ color: "var(--gray-500, #636e85)" }}>{item.label}:</span>{" "}
                                    <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.values.join(" | ")}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm" style={{ color: "var(--gray-400, #8892a8)" }}>Keine Kundendaten verfuegbar</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div style={{ background: "var(--white, #ffffff)", border: "1px solid var(--gray-200, #d8dce6)", borderRadius: "var(--radius-lg, 16px)", padding: "20px", boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))" }}>
                    <div className="flex items-center gap-2" style={{ background: "linear-gradient(180deg, #1a2a5e 0%, #0f1d45 100%)", padding: "10px 16px", borderRadius: "16px 16px 0 0", margin: "-20px -20px 16px -20px", borderBottom: "1px solid #0f1d45" }}>
                      <div style={{ background: "rgba(245,200,0,0.18)", borderRadius: "8px", padding: "6px" }}>
                        <Activity className="h-4 w-4" style={{ color: "#f5c800" }} />
                      </div>
                      <h3 style={{ color: "#f5c800", fontSize: "1rem", fontWeight: "700" }}>Auftragsstatus</h3>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gray-500, #636e85)" }}>Status</p>
                        <Badge className="bg-green-100 text-green-800">{selectedOrder.status || "Unbekannt"}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gray-500, #636e85)" }}>Positionen</p>
                        <span className="font-bold text-sm" style={{ color: "var(--primary-blue, #1a2a5e)" }}>{selectedOrder.positions}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gray-500, #636e85)" }}>Gesamtfortschritt</p>
                        <span className="text-xs font-bold" style={{ color: "var(--primary-blue, #1a2a5e)" }}>{selectedOverviewMeta?.progress || 0}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div className="h-2 rounded-full bg-[#1a2a5e]" style={{ width: `${selectedOverviewMeta?.progress || 0}%` }} />
                      </div>

                      {selectedGroupedCardData.status.length > 0 && (
                        <>
                          <div className="pt-2" style={{ borderTop: "1px dashed var(--gray-200, #d8dce6)" }}>
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gray-500, #636e85)" }}>
                              Zugeordnete Auftragsinfos
                            </p>
                          </div>
                          <div className="space-y-2">
                            {selectedGroupedCardData.status.map((group) => (
                              <div key={`status-group-${group.sectionTitle}-${group.groupTitle}`} className="rounded border border-[#dbe5f7] bg-[#fbfdff] p-2">
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.05em]" style={{ color: "#2f558e" }}>
                                  {group.sectionTitle} - {group.groupTitle}
                                </p>
                                <div className="space-y-1">
                                  {group.items.map((item) => (
                                    <div key={`status-item-${group.groupTitle}-${item.key}`} className="text-[11px] leading-snug" style={{ color: "var(--gray-700, #2d3748)" }}>
                                      <span className="font-semibold" style={{ color: "var(--gray-500, #636e85)" }}>{item.label}:</span>{" "}
                                      <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.values.join(" | ")}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ background: "var(--white, #ffffff)", border: "1px solid var(--gray-200, #d8dce6)", borderRadius: "var(--radius-lg, 16px)", padding: "20px", boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))" }}>
                    <div className="flex items-center gap-2" style={{ background: "linear-gradient(180deg, #1a2a5e 0%, #0f1d45 100%)", padding: "10px 16px", borderRadius: "16px 16px 0 0", margin: "-20px -20px 16px -20px", borderBottom: "1px solid #0f1d45" }}>
                      <div style={{ background: "rgba(245,200,0,0.18)", borderRadius: "8px", padding: "6px" }}>
                        <DollarSign className="h-4 w-4" style={{ color: "#f5c800" }} />
                      </div>
                      <h3 style={{ color: "#f5c800", fontSize: "1rem", fontWeight: "700" }}>Finanzen</h3>
                    </div>

                    <div className="space-y-2">
                      {selectedGroupedCardData.finance.length > 0 ? (
                        <div className="space-y-2">
                          {selectedGroupedCardData.finance.map((group) => (
                            <div key={`finance-group-${group.sectionTitle}-${group.groupTitle}`} className="rounded border border-[#dbe5f7] bg-[#fbfdff] p-2">
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.05em]" style={{ color: "#2f558e" }}>
                                {group.sectionTitle} - {group.groupTitle}
                              </p>
                              <div className="space-y-1">
                                {group.items.map((item) => (
                                  <div key={`finance-item-${group.groupTitle}-${item.key}`} className="text-[11px] leading-snug" style={{ color: "var(--gray-700, #2d3748)" }}>
                                    <span className="font-semibold" style={{ color: "var(--gray-500, #636e85)" }}>{item.label}:</span>{" "}
                                    <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.values.join(" | ")}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-sm">
                          <span style={{ color: "var(--gray-500, #636e85)" }}>Keine Finanzdaten</span>
                          <span style={{ color: "var(--gray-700, #2d3748)", fontWeight: 500 }}>-</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2" style={{ borderTop: "2px solid var(--gray-200, #d8dce6)" }}>
                        <span className="font-semibold text-sm" style={{ color: "var(--gray-700, #2d3748)" }}>Gesamtbetrag</span>
                        <span className="font-bold text-lg" style={{ color: "var(--primary-blue, #1a2a5e)" }}>{formatMoney(selectedOrder.amountTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ background: "var(--white, #ffffff)", border: "1px solid var(--gray-200, #d8dce6)", borderRadius: "var(--radius-lg, 16px)", padding: "16px", boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="h-3.5 w-3.5" style={{ color: "var(--primary-blue, #1a2a5e)" }} />
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--gray-500, #636e85)" }}>Zeitstempel</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm" style={{ color: "var(--gray-700, #2d3748)" }}>
                    <div><span style={{ color: "var(--gray-500, #636e85)" }}>Bestelldatum: </span><span style={{ fontWeight: 600 }}>{selectedOverviewMeta?.createdAt || "-"}</span></div>
                    <div><span style={{ color: "var(--gray-500, #636e85)" }}>Bezahl Datum: </span><span style={{ fontWeight: 600 }}>{selectedOverviewMeta?.paidAt || "-"}</span></div>
                  </div>
                </div>

                <Card className="border-[#c9d7f2] bg-white">
                  <CardHeader>
                    <CardTitle className="text-sm text-[#1f3f82]">Positionen im Auftrag</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Artikelnummer</TableHead>
                            <TableHead>Bezeichnung</TableHead>
                            <TableHead>Menge</TableHead>
                            <TableHead>USt</TableHead>
                            <TableHead>Betrag</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedOrder.rows.map((row, idx) => (
                            <TableRow key={`position-${selectedOrder.id}-${idx}`}>
                              <TableCell>{highlightText(row["Artikelnummer"] || "-", searchTerm)}</TableCell>
                              <TableCell className="max-w-[420px] truncate" title={row["Bezeichnung"] || ""}>
                                {highlightText(row["Bezeichnung"] || "-", searchTerm)}
                              </TableCell>
                              <TableCell>{row["Menge"] || "-"}</TableCell>
                              <TableCell>{row["USt"] || "-"}</TableCell>
                              <TableCell>{formatMoney(parseLocalizedNumber(row["Betrag"] || row["Netto Gesamt"] || "0"))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-[#c9d7f2] bg-white">
                  <CardHeader>
                    <CardTitle className="text-sm text-[#1f3f82]">Alle Spalteninformationen (aufbereitet)</CardTitle>
                    <CardDescription>
                      Jede importierte CSV-Spalte ist hier enthalten und nach Themen gruppiert.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="grid gap-3 grid-cols-1">
                      {selectedOverviewSections.map((section) => (
                        <div key={section.id} className="rounded-md border border-[#d7e1f5] bg-[#f8fbff] p-3 shadow-sm">
                          <div
                            className="mb-2 rounded-md px-3 py-2"
                            style={{
                              background: "linear-gradient(180deg, #1a2a5e 0%, #0f1d45 100%)",
                              border: "1px solid #0f1d45",
                            }}
                          >
                            <h4 className="text-sm font-semibold uppercase tracking-[0.05em]" style={{ color: "#f5c800" }}>
                              {section.title}
                            </h4>
                          </div>
                          <div className="mt-2 space-y-2">
                            {section.groups.map((subgroup) => (
                              <details key={`${section.id}-${subgroup.id}`} open className="rounded border border-[#e1e9f8] bg-white shadow-sm">
                                <summary
                                  className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] border-b"
                                  style={{
                                    background: "linear-gradient(180deg, #1a2a5e 0%, #0f1d45 100%)",
                                    color: "#f5c800",
                                    borderColor: "#0f1d45",
                                  }}
                                >
                                  {subgroup.title}
                                </summary>
                                <div className="space-y-1.5 px-3 pb-3 pt-2">
                                  <div className="space-y-1">
                                    {toPairRows(subgroup.items.filter((item) => !isLongInfoValue(item.values)), 2).map((row, rowIndex) => (
                                      <div key={`short-row-${subgroup.id}-${rowIndex}`} className="rounded border border-[#dbe5f7] bg-[#fbfdff] px-2 py-1.5">
                                        <div className="grid grid-cols-1 gap-1 md:grid-cols-2 md:gap-x-3">
                                          {row.map((item) => (
                                            <div key={item.key} className="text-[11px] leading-snug" style={{ color: "var(--gray-700, #2d3748)" }}>
                                              <span className="font-semibold" style={{ color: "#36598f" }}>{item.label}:</span>{" "}
                                              <span>{item.values.join(" | ") || "-"}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="space-y-1">
                                    {subgroup.items
                                      .filter((item) => isLongInfoValue(item.values))
                                      .map((item) => (
                                        <div key={item.key} className="rounded border border-[#dbe5f7] bg-[#fbfdff] px-2 py-1.5 text-[11px] leading-snug" style={{ color: "var(--gray-700, #2d3748)" }}>
                                          <span className="font-semibold" style={{ color: "#36598f" }}>{item.label}:</span>{" "}
                                          <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.values.join("\n\n")}</span>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              </details>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="raw" className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Vollstaendige Rohdaten-Ansicht: alle importierten CSV-Spalten fuer diesen Auftrag.
                </p>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {allColumns.map((column) => (
                          <TableHead key={`raw-header-${column}`}>{column}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.rows.map((row, rowIndex) => (
                        <TableRow key={`raw-row-${selectedOrder.id}-${rowIndex}`}>
                          {allColumns.map((column) => {
                            const rawValue = row[column] || ""
                            if (!rawValue) return <TableCell key={`raw-cell-${rowIndex}-${column}`}>-</TableCell>
                            if (column === "Status") {
                              return (
                                <TableCell key={`raw-cell-${rowIndex}-${column}`}>
                                  <Badge variant="secondary">{highlightText(rawValue, searchTerm)}</Badge>
                                </TableCell>
                              )
                            }
                            if (column === "Betrag") {
                              return <TableCell key={`raw-cell-${rowIndex}-${column}`}>{formatMoney(parseLocalizedNumber(rawValue))}</TableCell>
                            }
                            return (
                              <TableCell key={`raw-cell-${rowIndex}-${column}`} className="max-w-[280px] truncate" title={rawValue}>
                                {highlightText(rawValue, searchTerm)}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
