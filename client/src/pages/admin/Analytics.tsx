import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/useToast"
import {
  getProfitabilityReport,
  type ProfitabilityBookingRow,
  type ProfitabilityOrderRow,
  type ProfitabilitySettings,
  type ProfitabilitySettingsMeta,
  updateProfitabilitySettings,
} from "@/api/adminAnalytics"
import {
  BarChart3,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Columns3,
  Download,
  Filter,
  RefreshCw,
  Search,
  Settings2,
  Save,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react"
import "./Analytics.css"

type PeriodSummary = {
  label: string
  bookings: number
  netRevenue: number
  profit: number
  marginPercent: number
}

const DEFAULT_SETTINGS: ProfitabilitySettings = {
  labor: {
    defaultHourlyRate: 92,
    includeTrackedTimeOnly: true,
    fallbackProgressWeight: 0.72,
    minimumProgressFactor: 0.18,
    productHandlingMinutes: 8,
  },
  materials: {
    repairMaterialBaseRate: 0.2,
    repairMaterialPerServiceRate: 0.035,
    minimumRepairMaterialRate: 0.18,
    maximumRepairMaterialRate: 0.42,
    productMaterialRate: 0.72,
    fallbackShopProductCostRate: 0.65,
  },
  subcontracting: {
    enabled: true,
    defaultRate: 0.12,
    keywords: ["logic", "board", "micro", "solder", "wasser", "water", "daten", "data"],
  },
  overhead: {
    monthlyRent: 2600,
    monthlyUtilities: 580,
    monthlyAdminPayroll: 4200,
    monthlySoftware: 480,
    monthlyInsurance: 340,
    monthlyMarketing: 690,
    monthlyOtherFixedCosts: 520,
    targetMonthlyBillableHours: 480,
  },
  depreciation: {
    monthlyEquipmentDepreciation: 780,
  },
  otherCosts: {
    packagingRate: 0.01,
    paymentFeeRate: 0.015,
    flatShippingCostPerBooking: 6.9,
    warrantyReserveRate: 0.02,
  },
  warranty: {
    keywords: ["nacharbeit", "rework", "warranty", "garantie", "gewaehr"],
    defaultLabel: "90 Tage Standard",
    flaggedLabel: "Nacharbeit / Gewaehrleistung",
  },
  formula: {
    profitWeights: {
      netRevenue: 1,
      directCosts: 1,
      overheadCost: 1,
      depreciationCost: 1,
      otherOperatingCost: 1,
    },
    operatingCostWeights: {
      packaging: 1,
      paymentFallback: 1,
      paymentGateway: 1,
      warrantyReserve: 1,
      orderShipping: 1,
      bookingFlatShipping: 1,
    },
  },
}

const DEFAULT_SETTINGS_META: ProfitabilitySettingsMeta = {
  monthlyOverhead: 0,
  monthlyDepreciation: 0,
  overheadHourlyRate: 0,
  depreciationHourlyRate: 0,
}

const roundHours = (value: number) => Math.round((value + Number.EPSILON) * 10) / 10
const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const buildSettingsMetaFromDraft = (settings: ProfitabilitySettings): ProfitabilitySettingsMeta => {
  const monthlyOverhead =
    Number(settings.overhead.monthlyRent || 0) +
    Number(settings.overhead.monthlyUtilities || 0) +
    Number(settings.overhead.monthlyAdminPayroll || 0) +
    Number(settings.overhead.monthlySoftware || 0) +
    Number(settings.overhead.monthlyInsurance || 0) +
    Number(settings.overhead.monthlyMarketing || 0) +
    Number(settings.overhead.monthlyOtherFixedCosts || 0)
  const monthlyDepreciation = Number(settings.depreciation.monthlyEquipmentDepreciation || 0)
  const billableHours = Math.max(1, Number(settings.overhead.targetMonthlyBillableHours || 0))

  return {
    monthlyOverhead: roundCurrency(monthlyOverhead),
    monthlyDepreciation: roundCurrency(monthlyDepreciation),
    overheadHourlyRate: roundCurrency(monthlyOverhead / billableHours),
    depreciationHourlyRate: roundCurrency(monthlyDepreciation / billableHours),
  }
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)

const formatHours = (value: number) => `${roundHours(value).toFixed(1)} h`
const formatPercent = (value: number) => `${(Number.isFinite(value) ? value : 0).toFixed(1)} %`
const formatRate = (value: number) => `${(Number.isFinite(value) ? value : 0).toFixed(3)}`
const csvEscape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`

const formatDate = (value?: string) => {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
}

type StatusTone = "neutral" | "info" | "warning" | "success" | "danger"

const STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: "Ausstehend", tone: "neutral" },
  "payment-pending": { label: "Zahlung ausstehend", tone: "warning" },
  processing: { label: "In Bearbeitung", tone: "info" },
  completed: { label: "Abgeschlossen", tone: "success" },
  cancelled: { label: "Storniert", tone: "danger" },
  "in-progress": { label: "In Arbeit", tone: "info" },
  "quality-check": { label: "Qualitaetspruefung", tone: "warning" },
  "diagnostic-assessment": { label: "Diagnose", tone: "warning" },
  "ready-for-pickup": { label: "Abholbereit", tone: "success" },
  open: { label: "Offen", tone: "neutral" },
  paid: { label: "Bezahlt", tone: "success" },
  unpaid: { label: "Unbezahlt", tone: "warning" },
}

const PAYMENT_META: Record<string, { label: string; tone: StatusTone }> = {
  unpaid: { label: "Unbezahlt", tone: "warning" },
  "partially-paid": { label: "Teilbezahlt", tone: "info" },
  paid: { label: "Bezahlt", tone: "success" },
  pending: { label: "Ausstehend", tone: "warning" },
  processing: { label: "In Pruefung", tone: "info" },
  failed: { label: "Fehlgeschlagen", tone: "danger" },
  refunded: { label: "Erstattet", tone: "neutral" },
  open: { label: "Offen", tone: "neutral" },
  offen: { label: "Offen", tone: "neutral" },
}

const getStatusMeta = (status?: string) => {
  const normalized = String(status || "").trim().toLowerCase()
  if (!normalized) {
    return { label: "Unbekannt", tone: "neutral" as StatusTone }
  }

  return STATUS_META[normalized] || {
    label: normalized
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    tone: "neutral" as StatusTone,
  }
}

const getPaymentMeta = (status?: string) => {
  const normalized = String(status || "").trim().toLowerCase()
  if (!normalized) {
    return { label: "Unbekannt", tone: "neutral" as StatusTone }
  }

  return PAYMENT_META[normalized] || {
    label: normalized
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    tone: "neutral" as StatusTone,
  }
}

function ToneBadge({ label, tone, className = "" }: { label: string; tone: StatusTone; className?: string }) {
  return (
    <Badge variant="outline" className={`analytics-inline-badge analytics-status-badge analytics-status-${tone} ${className}`.trim()}>
      {label}
    </Badge>
  )
}

function StatusBadge({ status }: { status?: string }) {
  const meta = getStatusMeta(status)

  return <ToneBadge label={meta.label} tone={meta.tone} />
}

function PaymentBadge({ paymentLabel }: { paymentLabel?: string }) {
  const parts = String(paymentLabel || "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)

  return (
    <div className="analytics-payment-badges">
      {(parts.length > 0 ? parts : [String(paymentLabel || "Unbekannt")]).map((part) => {
        const meta = getPaymentMeta(part)
        return <ToneBadge key={`${part}-${meta.label}`} label={meta.label} tone={meta.tone} className="analytics-payment-badge" />
      })}
    </div>
  )
}

type ProfitabilityColumnId =
  | "booking"
  | "date"
  | "customer"
  | "serviceType"
  | "status"
  | "netRevenue"
  | "directCosts"
  | "materialCost"
  | "subcontractCost"
  | "laborCost"
  | "overheadCost"
  | "depreciationCost"
  | "paymentGatewayFees"
  | "shippingFlatCost"
  | "otherOperatingCost"
  | "profit"
  | "marginPercent"
  | "plannedHours"
  | "actualHours"
  | "hourlyRate"
  | "varianceHours"
  | "paymentLabel"
  | "warrantyLabel"

type ProfitabilityColumnPreference = {
  id: ProfitabilityColumnId
  visible: boolean
}

type OrderDetailColumnId =
  | "order"
  | "status"
  | "device"
  | "netRevenue"
  | "materialCost"
  | "subcontractCost"
  | "laborCost"
  | "paymentGatewayFees"
  | "shippingFlatCost"
  | "profit"
  | "plannedHours"
  | "actualHours"
  | "trackedHours"

type OrderDetailColumnPreference = {
  id: OrderDetailColumnId
  visible: boolean
}

type ProfitabilityColumnDefinition = {
  id: ProfitabilityColumnId
  label: string
  description: string
  defaultVisible: boolean
  required?: boolean
  align?: "left" | "right"
  cell: (row: ProfitabilityBookingRow) => ReactNode
  csvValue: (row: ProfitabilityBookingRow) => string | number
}

type OrderDetailColumnDefinition = {
  id: OrderDetailColumnId
  label: string
  description: string
  defaultVisible: boolean
  required?: boolean
  align?: "left" | "right"
  cell: (order: ProfitabilityOrderRow) => ReactNode
}

const COLUMN_STORAGE_KEY = "fixithub-profitability-columns-v1"
const ORDER_DETAIL_COLUMN_STORAGE_KEY = "fixithub-profitability-order-columns-v1"
const DENSE_VIEW_STORAGE_KEY = "fixithub-profitability-dense-view-v1"

const ORDER_DETAIL_COLUMNS: OrderDetailColumnDefinition[] = [
  {
    id: "order",
    label: "Auftrag",
    description: "Auftragsnummer und Kurzbeschreibung.",
    defaultVisible: true,
    required: true,
    cell: (order) => (
      <div className="analytics-cell-stack analytics-cell-stack-wide">
        <strong>{order.orderNumber}</strong>
        <span>{order.description}</span>
      </div>
    ),
  },
  {
    id: "status",
    label: "Status",
    description: "Aktueller Bearbeitungsstatus mit Fortschritt.",
    defaultVisible: true,
    cell: (order) => (
      <div className="analytics-cell-stack">
        <StatusBadge status={order.status} />
        <span>{Math.round(order.progress)} % Fortschritt</span>
      </div>
    ),
  },
  {
    id: "device",
    label: "Geraet",
    description: "Geraet oder Modellbezug des Auftrags.",
    defaultVisible: true,
    cell: (order) => order.device || "-",
  },
  {
    id: "netRevenue",
    label: "Netto",
    description: "Nettoerloes des Einzelauftrags.",
    defaultVisible: true,
    align: "right",
    cell: (order) => formatCurrency(order.netRevenue),
  },
  {
    id: "materialCost",
    label: "Material",
    description: "Material- und Teilekosten.",
    defaultVisible: true,
    align: "right",
    cell: (order) => formatCurrency(order.materialCost),
  },
  {
    id: "subcontractCost",
    label: "Fremdleistung",
    description: "Extern vergebene Kostenanteile.",
    defaultVisible: false,
    align: "right",
    cell: (order) => formatCurrency(order.subcontractCost),
  },
  {
    id: "laborCost",
    label: "Lohn",
    description: "Interne Lohnkosten des Auftrags.",
    defaultVisible: true,
    align: "right",
    cell: (order) => formatCurrency(order.laborCost),
  },
  {
    id: "paymentGatewayFees",
    label: "Gateway",
    description: "Transaktionsgebuehren der genutzten Zahlungsgateways.",
    defaultVisible: true,
    align: "right",
    cell: (order) => formatCurrency(order.paymentGatewayFees),
  },
  {
    id: "shippingFlatCost",
    label: "Versand pauschal",
    description: "Pauschale Versandkosten je Buchung (anteilig pro Auftrag).",
    defaultVisible: true,
    align: "right",
    cell: (order) => formatCurrency(order.shippingFlatCost),
  },
  {
    id: "profit",
    label: "Ergebnis",
    description: "Gewinn oder Verlust je Auftrag.",
    defaultVisible: true,
    align: "right",
    cell: (order) => <span className={order.profit >= 0 ? "analytics-positive" : "analytics-negative"}>{formatCurrency(order.profit)}</span>,
  },
  {
    id: "plannedHours",
    label: "Soll",
    description: "Geplante Stunden.",
    defaultVisible: true,
    align: "right",
    cell: (order) => formatHours(order.plannedHours),
  },
  {
    id: "actualHours",
    label: "Ist",
    description: "Tatsaechlich angesetzte Stunden.",
    defaultVisible: true,
    align: "right",
    cell: (order) => formatHours(order.actualHours),
  },
  {
    id: "trackedHours",
    label: "Erfasst",
    description: "Reale Zeiterfassung aus WorkSessions.",
    defaultVisible: true,
    align: "right",
    cell: (order) => formatHours(order.trackedHours),
  },
]

const createDefaultOrderDetailPreferences = (): OrderDetailColumnPreference[] =>
  ORDER_DETAIL_COLUMNS.map((column) => ({
    id: column.id,
    visible: column.required ? true : column.defaultVisible,
  }))

const normalizeOrderDetailPreferences = (value: unknown): OrderDetailColumnPreference[] => {
  const incoming = Array.isArray(value) ? value : []
  const knownColumns = new Map(ORDER_DETAIL_COLUMNS.map((column) => [column.id, column]))
  const seen = new Set<OrderDetailColumnId>()
  const normalized: OrderDetailColumnPreference[] = []

  for (const entry of incoming) {
    if (!entry || typeof entry !== "object") continue

    const candidateId = (entry as OrderDetailColumnPreference).id
    const definition = knownColumns.get(candidateId)
    if (!definition || seen.has(candidateId)) continue

    normalized.push({
      id: candidateId,
      visible: definition.required ? true : Boolean((entry as OrderDetailColumnPreference).visible),
    })
    seen.add(candidateId)
  }

  for (const column of ORDER_DETAIL_COLUMNS) {
    if (seen.has(column.id)) continue
    normalized.push({
      id: column.id,
      visible: column.required ? true : column.defaultVisible,
    })
  }

  return normalized
}

function OrderDetailsTable({
  orders,
  columns,
}: {
  orders: ProfitabilityOrderRow[]
  columns: OrderDetailColumnDefinition[]
}) {
  return (
    <div className="analytics-order-detail-table">
      <Table>
        <TableHeader>
          <TableRow className="analytics-order-detail-head">
            {columns.map((column) => (
              <TableHead key={column.id} className={column.align === "right" ? "text-right" : undefined}>
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id} className="analytics-order-detail-row">
              {columns.map((column) => (
                <TableCell key={`${order.id}-${column.id}`} className={column.align === "right" ? "text-right" : undefined}>
                  {column.cell(order)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

const PROFITABILITY_COLUMNS: ProfitabilityColumnDefinition[] = [
  {
    id: "booking",
    label: "Buchung",
    description: "Buchungsnummer und Anzahl zugeordneter Auftraege.",
    defaultVisible: true,
    required: true,
    cell: (row) => (
      <div className="analytics-cell-stack">
        <strong>{row.bookingNumber}</strong>
        <span>{row.orderCount} Auftraege</span>
      </div>
    ),
    csvValue: (row) => row.bookingNumber,
  },
  {
    id: "date",
    label: "Datum",
    description: "Buchungsdatum.",
    defaultVisible: true,
    required: true,
    cell: (row) => formatDate(row.bookingDate),
    csvValue: (row) => formatDate(row.bookingDate),
  },
  {
    id: "customer",
    label: "Kunde",
    description: "Kundenname und Segment.",
    defaultVisible: true,
    required: true,
    cell: (row) => (
      <div className="analytics-cell-stack">
        <strong>{row.customerName}</strong>
        <span>{row.customerGroup}</span>
      </div>
    ),
    csvValue: (row) => `${row.customerName} (${row.customerGroup})`,
  },
  {
    id: "serviceType",
    label: "Leistung",
    description: "Kategorisierung und Zusammenfassung der Buchung.",
    defaultVisible: true,
    cell: (row) => (
      <div className="analytics-cell-stack analytics-cell-stack-wide">
        <strong>{row.serviceType}</strong>
        <span>{row.itemSummary}</span>
      </div>
    ),
    csvValue: (row) => `${row.serviceType} - ${row.itemSummary}`,
  },
  {
    id: "status",
    label: "Status",
    description: "Aktueller Buchungsstatus.",
    defaultVisible: true,
    cell: (row) => <StatusBadge status={row.status} />,
    csvValue: (row) => getStatusMeta(row.status).label,
  },
  {
    id: "netRevenue",
    label: "Erloese netto",
    description: "Nettoerloes nach Abzug der Steuer.",
    defaultVisible: true,
    align: "right",
    cell: (row) => formatCurrency(row.netRevenue),
    csvValue: (row) => row.netRevenue.toFixed(2),
  },
  {
    id: "directCosts",
    label: "Direktkosten",
    description: "Material, Fremdleistung und direkte Lohnkosten.",
    defaultVisible: true,
    align: "right",
    cell: (row) => formatCurrency(row.directCosts),
    csvValue: (row) => row.directCosts.toFixed(2),
  },
  {
    id: "materialCost",
    label: "Material",
    description: "Verbrauchtes Material und Teilekosten.",
    defaultVisible: true,
    align: "right",
    cell: (row) => formatCurrency(row.materialCost),
    csvValue: (row) => row.materialCost.toFixed(2),
  },
  {
    id: "subcontractCost",
    label: "Fremdleistung",
    description: "Extern vergebene Leistungsanteile.",
    defaultVisible: false,
    align: "right",
    cell: (row) => formatCurrency(row.subcontractCost),
    csvValue: (row) => row.subcontractCost.toFixed(2),
  },
  {
    id: "laborCost",
    label: "Lohnkosten",
    description: "Interne Arbeitskosten auf Stundenbasis.",
    defaultVisible: false,
    align: "right",
    cell: (row) => formatCurrency(row.laborCost),
    csvValue: (row) => row.laborCost.toFixed(2),
  },
  {
    id: "overheadCost",
    label: "Gemeinkosten",
    description: "Verteilte Fixkosten pro verrechenbarer Stunde.",
    defaultVisible: false,
    align: "right",
    cell: (row) => formatCurrency(row.overheadCost),
    csvValue: (row) => row.overheadCost.toFixed(2),
  },
  {
    id: "depreciationCost",
    label: "Abschreibung",
    description: "Monatliche Abschreibung auf Auftraege verteilt.",
    defaultVisible: false,
    align: "right",
    cell: (row) => formatCurrency(row.depreciationCost),
    csvValue: (row) => row.depreciationCost.toFixed(2),
  },
  {
    id: "paymentGatewayFees",
    label: "Gateway-Gebuehren",
    description: "Tatsaechliche Zahlungsgebuehren aus Transaktionen der Buchung.",
    defaultVisible: true,
    align: "right",
    cell: (row) => formatCurrency(row.paymentGatewayFees),
    csvValue: (row) => row.paymentGatewayFees.toFixed(2),
  },
  {
    id: "shippingFlatCost",
    label: "Versand pauschal",
    description: "Pauschale Versandkosten je Buchung.",
    defaultVisible: true,
    align: "right",
    cell: (row) => formatCurrency(row.shippingFlatCost),
    csvValue: (row) => row.shippingFlatCost.toFixed(2),
  },
  {
    id: "otherOperatingCost",
    label: "Sonstige",
    description: "Verpackung, Garantiereserven und sonstige operative Kosten.",
    defaultVisible: false,
    align: "right",
    cell: (row) => formatCurrency(row.otherOperatingCost),
    csvValue: (row) => row.otherOperatingCost.toFixed(2),
  },
  {
    id: "profit",
    label: "Ergebnis",
    description: "Gewinn oder Verlust der Buchung.",
    defaultVisible: true,
    align: "right",
    cell: (row) => <span className={row.profit >= 0 ? "analytics-positive" : "analytics-negative"}>{formatCurrency(row.profit)}</span>,
    csvValue: (row) => row.profit.toFixed(2),
  },
  {
    id: "marginPercent",
    label: "Marge",
    description: "Profit in Prozent des Nettoerloeses.",
    defaultVisible: true,
    align: "right",
    cell: (row) => formatPercent(row.marginPercent),
    csvValue: (row) => row.marginPercent.toFixed(1),
  },
  {
    id: "plannedHours",
    label: "Soll",
    description: "Kalkulierte Sollstunden.",
    defaultVisible: false,
    align: "right",
    cell: (row) => formatHours(row.plannedHours),
    csvValue: (row) => row.plannedHours.toFixed(1),
  },
  {
    id: "actualHours",
    label: "Ist",
    description: "Tatsaechlich angesetzte Arbeitszeit.",
    defaultVisible: true,
    align: "right",
    cell: (row) => formatHours(row.actualHours),
    csvValue: (row) => row.actualHours.toFixed(1),
  },
  {
    id: "hourlyRate",
    label: "Satz",
    description: "Verwendeter Stundenkostensatz.",
    defaultVisible: false,
    align: "right",
    cell: (row) => formatCurrency(row.hourlyRate),
    csvValue: (row) => row.hourlyRate.toFixed(2),
  },
  {
    id: "varianceHours",
    label: "Abweichung",
    description: "Differenz zwischen Ist- und Sollstunden.",
    defaultVisible: false,
    align: "right",
    cell: (row) => <span className={row.varianceHours <= 0 ? "analytics-positive" : "analytics-negative"}>{formatHours(row.varianceHours)}</span>,
    csvValue: (row) => row.varianceHours.toFixed(1),
  },
  {
    id: "paymentLabel",
    label: "Zahlung",
    description: "Abrechnungs- und Zahlungsstatus.",
    defaultVisible: true,
    cell: (row) => <PaymentBadge paymentLabel={row.paymentLabel} />,
    csvValue: (row) => row.paymentLabel,
  },
  {
    id: "warrantyLabel",
    label: "Gewaehrleistung",
    description: "Markierung fuer Gewaehrleistung oder Nacharbeit.",
    defaultVisible: false,
    cell: (row) => row.warrantyLabel,
    csvValue: (row) => row.warrantyLabel,
  },
]

const createDefaultColumnPreferences = (): ProfitabilityColumnPreference[] =>
  PROFITABILITY_COLUMNS.map((column) => ({
    id: column.id,
    visible: column.required ? true : column.defaultVisible,
  }))

const normalizeColumnPreferences = (value: unknown): ProfitabilityColumnPreference[] => {
  const incoming = Array.isArray(value) ? value : []
  const knownColumns = new Map(PROFITABILITY_COLUMNS.map((column) => [column.id, column]))
  const seen = new Set<ProfitabilityColumnId>()
  const normalized: ProfitabilityColumnPreference[] = []

  for (const entry of incoming) {
    if (!entry || typeof entry !== "object") continue

    const candidateId = (entry as ProfitabilityColumnPreference).id
    const definition = knownColumns.get(candidateId)
    if (!definition || seen.has(candidateId)) continue

    normalized.push({
      id: candidateId,
      visible: definition.required ? true : Boolean((entry as ProfitabilityColumnPreference).visible),
    })
    seen.add(candidateId)
  }

  for (const column of PROFITABILITY_COLUMNS) {
    if (seen.has(column.id)) continue
    normalized.push({
      id: column.id,
      visible: column.required ? true : column.defaultVisible,
    })
  }

  return normalized
}

const aggregateRows = (rows: ProfitabilityBookingRow[]): PeriodSummary => {
  const totals = rows.reduce(
    (accumulator, row) => ({
      bookings: accumulator.bookings + 1,
      netRevenue: accumulator.netRevenue + row.netRevenue,
      profit: accumulator.profit + row.profit,
    }),
    { bookings: 0, netRevenue: 0, profit: 0 },
  )

  return {
    label: "",
    bookings: totals.bookings,
    netRevenue: roundCurrency(totals.netRevenue),
    profit: roundCurrency(totals.profit),
    marginPercent: totals.netRevenue > 0 ? (totals.profit / totals.netRevenue) * 100 : 0,
  }
}

const isSameMonth = (date: Date, now: Date) => date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
const isSameQuarter = (date: Date, now: Date) => date.getFullYear() === now.getFullYear() && Math.floor(date.getMonth() / 3) === Math.floor(now.getMonth() / 3)

function NumberField({
  id,
  label,
  value,
  step = "0.01",
  min,
  max,
  description,
  onChange,
}: {
  id: string
  label: string
  value: number
  step?: string
  min?: number
  max?: number
  description?: string
  onChange: (value: number) => void
}) {
  return (
    <div className="analytics-settings-field">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        step={step}
        min={min}
        max={max}
        value={String(Number.isFinite(value) ? value : 0)}
        onChange={(event) => onChange(Number(event.target.value || 0))}
      />
      {description ? <p>{description}</p> : null}
    </div>
  )
}

function TextField({
  id,
  label,
  value,
  description,
  onChange,
}: {
  id: string
  label: string
  value: string
  description?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="analytics-settings-field analytics-settings-field-full">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
      {description ? <p>{description}</p> : null}
    </div>
  )
}

function ToggleField({
  id,
  label,
  checked,
  description,
  onCheckedChange,
}: {
  id: string
  label: string
  checked: boolean
  description?: string
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="analytics-settings-switch">
      <div>
        <Label htmlFor={id}>{label}</Label>
        {description ? <p>{description}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

const clampNumber = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const FORMULA_PRESETS: Record<string, ProfitabilitySettings["formula"]> = {
  conservative: {
    profitWeights: {
      netRevenue: 1,
      directCosts: 1.08,
      overheadCost: 1.06,
      depreciationCost: 1.04,
      otherOperatingCost: 1.08,
    },
    operatingCostWeights: {
      packaging: 1,
      paymentFallback: 1.1,
      paymentGateway: 1,
      warrantyReserve: 1.1,
      orderShipping: 1,
      bookingFlatShipping: 1.08,
    },
  },
  realistic: {
    profitWeights: {
      netRevenue: 1,
      directCosts: 1,
      overheadCost: 1,
      depreciationCost: 1,
      otherOperatingCost: 1,
    },
    operatingCostWeights: {
      packaging: 1,
      paymentFallback: 1,
      paymentGateway: 1,
      warrantyReserve: 1,
      orderShipping: 1,
      bookingFlatShipping: 1,
    },
  },
  growth: {
    profitWeights: {
      netRevenue: 1,
      directCosts: 0.96,
      overheadCost: 0.94,
      depreciationCost: 0.94,
      otherOperatingCost: 0.95,
    },
    operatingCostWeights: {
      packaging: 0.95,
      paymentFallback: 1,
      paymentGateway: 1,
      warrantyReserve: 0.92,
      orderShipping: 0.96,
      bookingFlatShipping: 0.95,
    },
  },
}

const sanitizeSettingsDraft = (input: ProfitabilitySettings): ProfitabilitySettings => {
  const next = JSON.parse(JSON.stringify(input)) as ProfitabilitySettings

  next.otherCosts.flatShippingCostPerBooking = clampNumber(Number(next.otherCosts.flatShippingCostPerBooking || 0), 0, 500)

  const profitWeights = next.formula.profitWeights
  profitWeights.netRevenue = clampNumber(Number(profitWeights.netRevenue || 0), 0, 3)
  profitWeights.directCosts = clampNumber(Number(profitWeights.directCosts || 0), 0, 3)
  profitWeights.overheadCost = clampNumber(Number(profitWeights.overheadCost || 0), 0, 3)
  profitWeights.depreciationCost = clampNumber(Number(profitWeights.depreciationCost || 0), 0, 3)
  profitWeights.otherOperatingCost = clampNumber(Number(profitWeights.otherOperatingCost || 0), 0, 3)

  const operatingCostWeights = next.formula.operatingCostWeights
  operatingCostWeights.packaging = clampNumber(Number(operatingCostWeights.packaging || 0), 0, 3)
  operatingCostWeights.paymentFallback = clampNumber(Number(operatingCostWeights.paymentFallback || 0), 0, 3)
  operatingCostWeights.paymentGateway = clampNumber(Number(operatingCostWeights.paymentGateway || 0), 0, 3)
  operatingCostWeights.warrantyReserve = clampNumber(Number(operatingCostWeights.warrantyReserve || 0), 0, 3)
  operatingCostWeights.orderShipping = clampNumber(Number(operatingCostWeights.orderShipping || 0), 0, 3)
  operatingCostWeights.bookingFlatShipping = clampNumber(Number(operatingCostWeights.bookingFlatShipping || 0), 0, 3)

  return next
}

export function Analytics() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [orderColumnsOpen, setOrderColumnsOpen] = useState(false)
  const [rows, setRows] = useState<ProfitabilityBookingRow[]>([])
  const [settings, setSettings] = useState<ProfitabilitySettings>(DEFAULT_SETTINGS)
  const [settingsDraft, setSettingsDraft] = useState<ProfitabilitySettings>(DEFAULT_SETTINGS)
  const [settingsMeta, setSettingsMeta] = useState<ProfitabilitySettingsMeta>(DEFAULT_SETTINGS_META)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [denseView, setDenseView] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem(DENSE_VIEW_STORAGE_KEY) === "true"
  })
  const [columnPreferences, setColumnPreferences] = useState<ProfitabilityColumnPreference[]>(() => {
    if (typeof window === "undefined") {
      return createDefaultColumnPreferences()
    }

    try {
      const stored = window.localStorage.getItem(COLUMN_STORAGE_KEY)
      return stored ? normalizeColumnPreferences(JSON.parse(stored)) : createDefaultColumnPreferences()
    } catch {
      return createDefaultColumnPreferences()
    }
  })
  const [columnDraft, setColumnDraft] = useState<ProfitabilityColumnPreference[]>(columnPreferences)
  const [orderDetailPreferences, setOrderDetailPreferences] = useState<OrderDetailColumnPreference[]>(() => {
    if (typeof window === "undefined") {
      return createDefaultOrderDetailPreferences()
    }

    try {
      const stored = window.localStorage.getItem(ORDER_DETAIL_COLUMN_STORAGE_KEY)
      return stored ? normalizeOrderDetailPreferences(JSON.parse(stored)) : createDefaultOrderDetailPreferences()
    } catch {
      return createDefaultOrderDetailPreferences()
    }
  })
  const [orderDetailDraft, setOrderDetailDraft] = useState<OrderDetailColumnPreference[]>(orderDetailPreferences)

  const loadReport = async (showToast = false) => {
    try {
      if (showToast) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      const response = await getProfitabilityReport(200)
      const nextRows = Array.isArray(response?.rows) ? response.rows : []
      const nextSettings = response?.settings || DEFAULT_SETTINGS
      const nextMeta = response?.settingsMeta || DEFAULT_SETTINGS_META

      setRows(nextRows)
      setSettings(nextSettings)
      setSettingsDraft(nextSettings)
      setSettingsMeta(nextMeta)

      if (showToast) {
        toast({
          title: "Rentabilitaet aktualisiert",
          description: `${nextRows.length} Buchungen mit Backend-Kalkulation geladen`,
        })
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Rentabilitaet konnte nicht geladen werden",
        description: error?.message || "Unbekannter Fehler",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadReport()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(columnPreferences))
  }, [columnPreferences])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(ORDER_DETAIL_COLUMN_STORAGE_KEY, JSON.stringify(orderDetailPreferences))
  }, [orderDetailPreferences])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(DENSE_VIEW_STORAGE_KEY, denseView ? "true" : "false")
  }, [denseView])

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return rows.filter((row) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        row.bookingNumber.toLowerCase().includes(normalizedSearch) ||
        row.customerName.toLowerCase().includes(normalizedSearch) ||
        row.itemSummary.toLowerCase().includes(normalizedSearch) ||
        row.orders.some(
          (order) =>
            order.orderNumber.toLowerCase().includes(normalizedSearch) ||
            order.description.toLowerCase().includes(normalizedSearch) ||
            String(order.device || "").toLowerCase().includes(normalizedSearch),
        )

      const matchesStatus = statusFilter === "all" || row.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [rows, searchTerm, statusFilter])

  const totals = useMemo(() => aggregateRows(filteredRows), [filteredRows])
  const settingsDraftMeta = useMemo(() => buildSettingsMetaFromDraft(settingsDraft), [settingsDraft])

  const formulaPreview = useMemo(() => {
    const sampleNetRevenue = 120
    const sampleDirectCosts = 52
    const sampleAllocationHours = 1.5
    const sampleOrderShipping = 4.2
    const warrantyFlagged = true

    const profitWeights = settingsDraft.formula.profitWeights
    const operatingWeights = settingsDraft.formula.operatingCostWeights

    const packagingCost =
      sampleNetRevenue * settingsDraft.otherCosts.packagingRate * Math.max(0, Number(operatingWeights.packaging || 0))
    const paymentFallbackCost =
      sampleNetRevenue * settingsDraft.otherCosts.paymentFeeRate * Math.max(0, Number(operatingWeights.paymentFallback || 0))
    const paymentGatewayCost =
      sampleNetRevenue * settingsDraft.otherCosts.paymentFeeRate * Math.max(0, Number(operatingWeights.paymentGateway || 0))
    const warrantyReserveCost = warrantyFlagged
      ? sampleNetRevenue * settingsDraft.otherCosts.warrantyReserveRate * Math.max(0, Number(operatingWeights.warrantyReserve || 0))
      : 0
    const orderShippingCost = sampleOrderShipping * Math.max(0, Number(operatingWeights.orderShipping || 0))
    const bookingFlatShippingCost =
      settingsDraft.otherCosts.flatShippingCostPerBooking * Math.max(0, Number(operatingWeights.bookingFlatShipping || 0))
    const otherOperatingCost = roundCurrency(
      packagingCost +
        paymentFallbackCost +
        paymentGatewayCost +
        warrantyReserveCost +
        orderShippingCost +
        bookingFlatShippingCost,
    )

    const overheadCost = roundCurrency(sampleAllocationHours * settingsDraftMeta.overheadHourlyRate)
    const depreciationCost = roundCurrency(sampleAllocationHours * settingsDraftMeta.depreciationHourlyRate)

    const weightedNetRevenue = sampleNetRevenue * Math.max(0, Number(profitWeights.netRevenue || 0))
    const weightedDirectCosts = sampleDirectCosts * Math.max(0, Number(profitWeights.directCosts || 0))
    const weightedOverheadCost = overheadCost * Math.max(0, Number(profitWeights.overheadCost || 0))
    const weightedDepreciationCost = depreciationCost * Math.max(0, Number(profitWeights.depreciationCost || 0))
    const weightedOtherOperatingCost = otherOperatingCost * Math.max(0, Number(profitWeights.otherOperatingCost || 0))

    return {
      sampleNetRevenue,
      sampleDirectCosts,
      sampleAllocationHours,
      overheadCost,
      depreciationCost,
      otherOperatingCost,
      packagingCost: roundCurrency(packagingCost),
      paymentFallbackCost: roundCurrency(paymentFallbackCost),
      paymentGatewayCost: roundCurrency(paymentGatewayCost),
      warrantyReserveCost: roundCurrency(warrantyReserveCost),
      orderShippingCost: roundCurrency(orderShippingCost),
      bookingFlatShippingCost: roundCurrency(bookingFlatShippingCost),
      weightedNetRevenue: roundCurrency(weightedNetRevenue),
      weightedDirectCosts: roundCurrency(weightedDirectCosts),
      weightedOverheadCost: roundCurrency(weightedOverheadCost),
      weightedDepreciationCost: roundCurrency(weightedDepreciationCost),
      weightedOtherOperatingCost: roundCurrency(weightedOtherOperatingCost),
      profit: roundCurrency(
        weightedNetRevenue -
          weightedDirectCosts -
          weightedOverheadCost -
          weightedDepreciationCost -
          weightedOtherOperatingCost,
      ),
    }
  }, [settingsDraft, settingsDraftMeta])

  const profitabilityShare = useMemo(() => {
    if (filteredRows.length === 0) return 0
    return (filteredRows.filter((row) => row.profit >= 0).length / filteredRows.length) * 100
  }, [filteredRows])

  const currentPeriodCards = useMemo(() => {
    const now = new Date()
    const monthRows = filteredRows.filter((row) => {
      const date = new Date(row.bookingDate)
      return !Number.isNaN(date.getTime()) && isSameMonth(date, now)
    })
    const quarterRows = filteredRows.filter((row) => {
      const date = new Date(row.bookingDate)
      return !Number.isNaN(date.getTime()) && isSameQuarter(date, now)
    })
    const yearRows = filteredRows.filter((row) => {
      const date = new Date(row.bookingDate)
      return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear()
    })

    return [
      { label: "Aktueller Monat", ...aggregateRows(monthRows) },
      { label: "Aktuelles Quartal", ...aggregateRows(quarterRows) },
      { label: "Aktuelles Jahr", ...aggregateRows(yearRows) },
    ]
  }, [filteredRows])

  const monthlyTrend = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      const rowsForMonth = filteredRows.filter((row) => {
        const date = new Date(row.bookingDate)
        return !Number.isNaN(date.getTime()) && isSameMonth(date, monthDate)
      })

      return {
        label: monthDate.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }),
        monthKey: `${monthDate.getFullYear()}-${monthDate.getMonth()}`,
        ...aggregateRows(rowsForMonth),
      }
    })
  }, [filteredRows])

  const statusOptions = useMemo(() => {
    const values = Array.from(new Set(rows.map((row) => row.status))).filter(Boolean)
    return values.sort()
  }, [rows])

  const visibleColumns = useMemo(() => {
    const columnMap = new Map(PROFITABILITY_COLUMNS.map((column) => [column.id, column]))
    return columnPreferences
      .filter((column) => column.visible || columnMap.get(column.id)?.required)
      .map((column) => columnMap.get(column.id))
      .filter((column): column is ProfitabilityColumnDefinition => Boolean(column))
  }, [columnPreferences])

  const visibleOrderDetailColumns = useMemo(() => {
    const columnMap = new Map(ORDER_DETAIL_COLUMNS.map((column) => [column.id, column]))
    return orderDetailPreferences
      .filter((column) => column.visible || columnMap.get(column.id)?.required)
      .map((column) => columnMap.get(column.id))
      .filter((column): column is OrderDetailColumnDefinition => Boolean(column))
  }, [orderDetailPreferences])

  const exportCsv = () => {
    const header = visibleColumns.map((column) => column.label)

    const lines = filteredRows.map((row) => visibleColumns.map((column) => column.csvValue(row)))

    const csvContent = [header, ...lines].map((line) => line.map((value) => csvEscape(value)).join(";")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `rentabilitaet-backend-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const toggleRow = (rowId: string) => {
    setExpandedRows((current) => ({
      ...current,
      [rowId]: !current[rowId],
    }))
  }

  const moveDraftColumn = (index: number, direction: -1 | 1) => {
    setColumnDraft((current) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= current.length) return current

      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
  }

  const setDraftColumnVisibility = (id: ProfitabilityColumnId, visible: boolean) => {
    setColumnDraft((current) =>
      current.map((column) => {
        if (column.id !== id) return column
        const definition = PROFITABILITY_COLUMNS.find((entry) => entry.id === id)
        return {
          ...column,
          visible: definition?.required ? true : visible,
        }
      }),
    )
  }

  const resetColumnPreferences = () => {
    setColumnDraft(createDefaultColumnPreferences())
  }

  const applyColumnPreferences = () => {
    setColumnPreferences(normalizeColumnPreferences(columnDraft))
    setColumnsOpen(false)
  }

  const moveOrderDetailDraftColumn = (index: number, direction: -1 | 1) => {
    setOrderDetailDraft((current) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= current.length) return current

      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
  }

  const setOrderDetailDraftVisibility = (id: OrderDetailColumnId, visible: boolean) => {
    setOrderDetailDraft((current) =>
      current.map((column) => {
        if (column.id !== id) return column
        const definition = ORDER_DETAIL_COLUMNS.find((entry) => entry.id === id)
        return {
          ...column,
          visible: definition?.required ? true : visible,
        }
      }),
    )
  }

  const resetOrderDetailPreferences = () => {
    setOrderDetailDraft(createDefaultOrderDetailPreferences())
  }

  const applyOrderDetailPreferences = () => {
    setOrderDetailPreferences(normalizeOrderDetailPreferences(orderDetailDraft))
    setOrderColumnsOpen(false)
  }

  const updateLaborNumber = (key: keyof ProfitabilitySettings["labor"], value: number) => {
    setSettingsDraft((current) => ({
      ...current,
      labor: { ...current.labor, [key]: value },
    }))
  }

  const updateMaterialsNumber = (key: keyof ProfitabilitySettings["materials"], value: number) => {
    setSettingsDraft((current) => ({
      ...current,
      materials: { ...current.materials, [key]: value },
    }))
  }

  const updateOverheadNumber = (key: keyof ProfitabilitySettings["overhead"], value: number) => {
    setSettingsDraft((current) => ({
      ...current,
      overhead: { ...current.overhead, [key]: value },
    }))
  }

  const updateDepreciationNumber = (key: keyof ProfitabilitySettings["depreciation"], value: number) => {
    setSettingsDraft((current) => ({
      ...current,
      depreciation: { ...current.depreciation, [key]: value },
    }))
  }

  const updateOtherCostsNumber = (key: keyof ProfitabilitySettings["otherCosts"], value: number) => {
    setSettingsDraft((current) => ({
      ...current,
      otherCosts: { ...current.otherCosts, [key]: value },
    }))
  }

  const updateSubcontractingNumber = (key: "defaultRate", value: number) => {
    setSettingsDraft((current) => ({
      ...current,
      subcontracting: { ...current.subcontracting, [key]: value },
    }))
  }

  const updateFormulaNumber = (
    section: keyof ProfitabilitySettings["formula"],
    key: string,
    value: number,
  ) => {
    setSettingsDraft((current) => ({
      ...current,
      formula: {
        ...current.formula,
        [section]: {
          ...current.formula[section],
          [key]: value,
        },
      },
    }))
  }

  const applyFormulaPreset = (presetKey: keyof typeof FORMULA_PRESETS) => {
    const preset = FORMULA_PRESETS[presetKey]
    setSettingsDraft((current) => ({
      ...current,
      formula: {
        profitWeights: { ...preset.profitWeights },
        operatingCostWeights: { ...preset.operatingCostWeights },
      },
    }))
  }

  const saveSettings = async () => {
    try {
      setSavingSettings(true)
      const sanitizedSettings = sanitizeSettingsDraft(settingsDraft)
      setSettingsDraft(sanitizedSettings)
      await updateProfitabilitySettings(sanitizedSettings)
      setSettings(sanitizedSettings)
      await loadReport(false)
      setSettingsOpen(false)
      toast({
        title: "Einstellungen gespeichert",
        description: "Die Rentabilitaetsparameter wurden im Backend aktualisiert.",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Einstellungen konnten nicht gespeichert werden",
        description: error?.message || "Unbekannter Fehler",
      })
    } finally {
      setSavingSettings(false)
    }
  }

  if (loading) {
    return (
      <div className="analytics-loading-screen">
        <RefreshCw className="h-6 w-6 animate-spin text-[#1a2a5e]" />
        <p>Backend-Rentabilitaetsdaten werden geladen...</p>
      </div>
    )
  }

  return (
    <>
      <div className={`analytics-page${denseView ? " analytics-dense-view" : ""}`}>
        <section className="analytics-hero">
          <div>
            <div className="analytics-hero-kicker">Admin Analytics</div>
            <h1>
              <BarChart3 className="h-8 w-8" />
              Rentabilitaet pro Buchung und Auftrag
            </h1>
            <p>
              Die Tabelle nutzt jetzt echte Zeiterfassungsdaten aus WorkSessions, reale E-Part-Einstandskosten aus dem Lager und eine zentrale Backend-Konfiguration fuer Gemeinkosten, Abschreibung und Risikoreserven.
            </p>
          </div>

          <div className="analytics-hero-actions">
            <Button variant="outline" className="analytics-hero-button" onClick={() => loadReport(true)}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Aktualisieren
            </Button>
            <Button variant="outline" className="analytics-hero-button" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="h-4 w-4" />
              Einstellungen
            </Button>
            <Button className="analytics-hero-button analytics-hero-button-primary" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              CSV Export
            </Button>
          </div>
        </section>

        <section className="analytics-kpi-grid">
          <Card className="analytics-kpi-card analytics-kpi-card-primary">
            <CardHeader>
              <CardTitle>
                <Wallet className="h-4 w-4" />
                Nettoerloese
              </CardTitle>
              <CardDescription>Gefilterte Backend-Auswertung</CardDescription>
            </CardHeader>
            <CardContent>
              <strong>{formatCurrency(totals.netRevenue)}</strong>
              <span>{filteredRows.length} Buchungen im aktuellen Filter</span>
            </CardContent>
          </Card>

          <Card className="analytics-kpi-card">
            <CardHeader>
              <CardTitle>
                <TrendingUp className="h-4 w-4" />
                Gewinn / Verlust
              </CardTitle>
              <CardDescription>Nach echter Zeit und Kostenkonfiguration</CardDescription>
            </CardHeader>
            <CardContent>
              <strong className={totals.profit >= 0 ? "analytics-positive" : "analytics-negative"}>{formatCurrency(totals.profit)}</strong>
              <span>{formatPercent(totals.marginPercent)} Umsatzrentabilitaet</span>
            </CardContent>
          </Card>

          <Card className="analytics-kpi-card">
            <CardHeader>
              <CardTitle>
                <Wrench className="h-4 w-4" />
                Arbeitsleistung
              </CardTitle>
              <CardDescription>Ist-Stunden aus Zeiterfassung priorisiert</CardDescription>
            </CardHeader>
            <CardContent>
              <strong>{formatHours(filteredRows.reduce((sum, row) => sum + row.actualHours, 0))}</strong>
              <span>{formatHours(filteredRows.reduce((sum, row) => sum + row.varianceHours, 0))} Abweichung gesamt</span>
            </CardContent>
          </Card>

          <Card className="analytics-kpi-card">
            <CardHeader>
              <CardTitle>
                <Filter className="h-4 w-4" />
                Profitabel
              </CardTitle>
              <CardDescription>Anteil positiver Buchungen</CardDescription>
            </CardHeader>
            <CardContent>
              <strong>{formatPercent(profitabilityShare)}</strong>
              <span>
                {filteredRows.filter((row) => row.profit >= 0).length} von {filteredRows.length} Buchungen
              </span>
            </CardContent>
          </Card>
        </section>

        <section className="analytics-period-grid">
          {currentPeriodCards.map((card) => (
            <Card key={card.label} className="analytics-period-card">
              <CardHeader>
                <CardTitle>
                  <CalendarRange className="h-4 w-4" />
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="analytics-period-metric">
                  <span>Umsatz</span>
                  <strong>{formatCurrency(card.netRevenue)}</strong>
                </div>
                <div className="analytics-period-metric">
                  <span>Ergebnis</span>
                  <strong className={card.profit >= 0 ? "analytics-positive" : "analytics-negative"}>{formatCurrency(card.profit)}</strong>
                </div>
                <div className="analytics-period-footer">
                  <span>{card.bookings} Buchungen</span>
                  <Badge variant="outline">{formatPercent(card.marginPercent)} Rendite</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="analytics-content-grid">
          <Card className="analytics-panel">
            <CardHeader>
              <CardTitle>Monatsverlauf</CardTitle>
              <CardDescription>Rentabilitaet ueber die letzten sechs Monate</CardDescription>
            </CardHeader>
            <CardContent className="analytics-trend-list">
              {monthlyTrend.map((month) => (
                <div key={month.monthKey} className="analytics-trend-row">
                  <div>
                    <strong>{month.label}</strong>
                    <span>{month.bookings} Buchungen</span>
                  </div>
                  <div>
                    <strong>{formatCurrency(month.netRevenue)}</strong>
                    <span className={month.profit >= 0 ? "analytics-positive" : "analytics-negative"}>{formatCurrency(month.profit)}</span>
                  </div>
                  <Badge variant="outline">{formatPercent(month.marginPercent)}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="analytics-panel analytics-assumptions-card">
            <CardHeader>
              <CardTitle>Backend-Konfiguration</CardTitle>
              <CardDescription>Aktive Parameter fuer die Berechnung</CardDescription>
            </CardHeader>
            <CardContent className="analytics-assumptions-list">
              <div>
                <strong>Stundensatz</strong>
                <span>{formatCurrency(settings.labor.defaultHourlyRate)} pro Arbeitsstunde</span>
              </div>
              <div>
                <strong>Gemeinkosten</strong>
                <span>{formatCurrency(settingsMeta.overheadHourlyRate)} pro verrechenbarer Stunde</span>
              </div>
              <div>
                <strong>Abschreibung</strong>
                <span>{formatCurrency(settingsMeta.depreciationHourlyRate)} pro verrechenbarer Stunde</span>
              </div>
              <div>
                <strong>Shop-Produkt-Fallback</strong>
                <span>{formatPercent(settings.materials.fallbackShopProductCostRate * 100)} vom Verkaufspreis</span>
              </div>
              <div>
                <strong>Gewaehrleistungsreserve</strong>
                <span>{formatPercent(settings.otherCosts.warrantyReserveRate * 100)} bei markierten Faellen</span>
              </div>
              <div>
                <strong>Versandpauschale je Buchung</strong>
                <span>{formatCurrency(settings.otherCosts.flatShippingCostPerBooking)}</span>
              </div>
              <p>
                Prioritaet hat immer die erfasste WorkSession-Zeit pro Auftrag. Wenn fuer einen Auftrag noch keine vollständige Zeiterfassung vorliegt, greift der Backend-Fallback auf Basis von Sollzeit und Fortschritt.
              </p>
            </CardContent>
          </Card>
        </section>

        <Card className="analytics-panel analytics-table-panel">
          <CardHeader className="analytics-table-header">
            <div>
              <CardTitle>Rentabilitaetstabelle</CardTitle>
              <CardDescription>Pflichtfelder und Zusatzspalten pro Buchung mit echter Auftragsaufschluesselung</CardDescription>
            </div>

            <div className="analytics-toolbar">
              <label className="analytics-search-field">
                <Search className="h-4 w-4" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buchung, Kunde oder Position suchen"
                />
              </label>

              <label className="analytics-select-field">
                <Filter className="h-4 w-4" />
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">Alle Status</option>
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                        {getStatusMeta(option).label}
                    </option>
                  ))}
                </select>
              </label>

              <Button
                type="button"
                variant="outline"
                className="analytics-columns-button"
                onClick={() => {
                  setColumnDraft(columnPreferences)
                  setColumnsOpen(true)
                }}
              >
                <Columns3 className="h-4 w-4" />
                Spalten
                <span className="analytics-column-pill">{visibleColumns.length}</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="analytics-columns-button"
                onClick={() => {
                  setOrderDetailDraft(orderDetailPreferences)
                  setOrderColumnsOpen(true)
                }}
              >
                <Columns3 className="h-4 w-4" />
                Detailspalten
                <span className="analytics-column-pill">{visibleOrderDetailColumns.length}</span>
              </Button>

              <label className="analytics-dense-toggle">
                <span>Dense View</span>
                <Switch checked={denseView} onCheckedChange={setDenseView} />
              </label>
            </div>
          </CardHeader>

          <CardContent>
            {filteredRows.length === 0 ? (
              <div className="analytics-empty-state">
                <BarChart3 className="h-12 w-12" />
                <h3>Keine Buchungen im aktuellen Filter</h3>
                <p>Pruefe Suchbegriff oder Statusfilter und aktualisiere die Ansicht bei Bedarf.</p>
              </div>
            ) : (
              <>
                <div className="analytics-desktop-table">
                  <Table>
                    <TableHeader>
                      <TableRow className="analytics-table-head-row">
                        <TableHead className="analytics-table-control"></TableHead>
                        {visibleColumns.map((column) => (
                          <TableHead key={column.id} className={column.align === "right" ? "text-right" : undefined}>
                            {column.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((row) => {
                        const isExpanded = Boolean(expandedRows[row.id])

                        return (
                          <Fragment key={row.id}>
                            <TableRow className="analytics-table-row">
                              <TableCell className="analytics-table-control">
                                <button type="button" className="analytics-expand-button" onClick={() => toggleRow(row.id)}>
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                              </TableCell>
                              {visibleColumns.map((column) => (
                                <TableCell key={`${row.id}-${column.id}`} className={column.align === "right" ? "text-right" : undefined}>
                                  {column.cell(row)}
                                </TableCell>
                              ))}
                            </TableRow>

                            {isExpanded ? (
                              <TableRow className="analytics-detail-row">
                                <TableCell colSpan={visibleColumns.length + 1}>
                                  <div className="analytics-detail-panel">
                                    <div className="analytics-detail-summary">
                                      <div>
                                        <span>Status</span>
                                        <strong>{getStatusMeta(row.status).label}</strong>
                                      </div>
                                      <div>
                                        <span>Nettoerloes</span>
                                        <strong>{formatCurrency(row.netRevenue)}</strong>
                                      </div>
                                      <div>
                                        <span>Ergebnis</span>
                                        <strong className={row.profit >= 0 ? "analytics-positive" : "analytics-negative"}>{formatCurrency(row.profit)}</strong>
                                      </div>
                                      <div>
                                        <span>Umsatzrentabilitaet</span>
                                        <strong>{formatPercent(row.marginPercent)}</strong>
                                      </div>
                                    </div>
                                    <OrderDetailsTable orders={row.orders} columns={visibleOrderDetailColumns} />
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </Fragment>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="analytics-mobile-list">
                  {filteredRows.map((row) => {
                    const isExpanded = Boolean(expandedRows[row.id])

                    return (
                      <article key={row.id} className="analytics-mobile-card">
                        <button type="button" className="analytics-mobile-card-header analytics-mobile-card-trigger" onClick={() => toggleRow(row.id)}>
                          <div>
                            <strong>{row.bookingNumber}</strong>
                            <span>{row.customerName}</span>
                            <span>{row.serviceType}</span>
                          </div>
                          <div className="analytics-mobile-card-header-actions">
                            <StatusBadge status={row.status} />
                            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </div>
                        </button>

                        <div className="analytics-mobile-card-metrics">
                          <div>
                            <span>Nettoerloes</span>
                            <strong>{formatCurrency(row.netRevenue)}</strong>
                          </div>
                          <div>
                            <span>Ergebnis</span>
                            <strong className={row.profit >= 0 ? "analytics-positive" : "analytics-negative"}>{formatCurrency(row.profit)}</strong>
                          </div>
                          <div>
                            <span>Ist</span>
                            <strong>{formatHours(row.actualHours)}</strong>
                          </div>
                          <div>
                            <span>Marge</span>
                            <strong>{formatPercent(row.marginPercent)}</strong>
                          </div>
                        </div>

                        <div className="analytics-mobile-card-meta">
                          <span>{formatDate(row.bookingDate)}</span>
                          <span>{row.paymentLabel}</span>
                          <span>{row.warrantyLabel}</span>
                        </div>

                        {isExpanded ? (
                          <div className="analytics-mobile-card-details">
                            <OrderDetailsTable orders={row.orders} columns={visibleOrderDetailColumns} />
                          </div>
                        ) : null}
                      </article>
                    )
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={columnsOpen} onOpenChange={setColumnsOpen}>
        <DialogContent className="analytics-columns-dialog">
          <DialogHeader>
            <DialogTitle>Spalten der Rentabilitaetstabelle</DialogTitle>
            <DialogDescription>
              Waehle die sichtbaren Spalten, sortiere ihre Reihenfolge und richte die Tabelle passend fuer dein Team ein.
            </DialogDescription>
          </DialogHeader>

          <div className="analytics-columns-summary">
            <Badge variant="outline">{columnDraft.filter((column) => column.visible).length} sichtbar</Badge>
            <span>Pflichtspalten bleiben zur Orientierung immer eingeblendet.</span>
          </div>

          <div className="analytics-columns-list">
            {columnDraft.map((column, index) => {
              const definition = PROFITABILITY_COLUMNS.find((entry) => entry.id === column.id)
              if (!definition) return null

              return (
                <div key={column.id} className="analytics-columns-item">
                  <div className="analytics-columns-item-info">
                    <div className="analytics-columns-item-index">{index + 1}</div>
                    <div>
                      <strong>{definition.label}</strong>
                      <p>{definition.description}</p>
                    </div>
                  </div>

                  <div className="analytics-columns-item-actions">
                    <label className="analytics-columns-toggle">
                      <Checkbox
                        checked={definition.required ? true : column.visible}
                        disabled={definition.required}
                        onCheckedChange={(checked) => setDraftColumnVisibility(column.id, checked === true)}
                      />
                      <span>{definition.required ? "Fixiert" : column.visible ? "Sichtbar" : "Ausgeblendet"}</span>
                    </label>

                    <Button type="button" variant="outline" size="icon" onClick={() => moveDraftColumn(index, -1)} disabled={index === 0}>
                      <span className="sr-only">Nach oben</span>
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => moveDraftColumn(index, 1)}
                      disabled={index === columnDraft.length - 1}
                    >
                      <span className="sr-only">Nach unten</span>
                      ↓
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          <DialogFooter className="analytics-columns-footer">
            <Button type="button" variant="outline" onClick={resetColumnPreferences}>
              Standard wiederherstellen
            </Button>
            <Button type="button" className="analytics-settings-save" onClick={applyColumnPreferences}>
              Anwenden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={orderColumnsOpen} onOpenChange={setOrderColumnsOpen}>
        <DialogContent className="analytics-columns-dialog">
          <DialogHeader>
            <DialogTitle>Spalten der Auftragsdetails</DialogTitle>
            <DialogDescription>
              Lege fest, welche Kennzahlen in der aufgeklappten Order-Untertabelle sichtbar sind und in welcher Reihenfolge sie erscheinen.
            </DialogDescription>
          </DialogHeader>

          <div className="analytics-columns-summary">
            <Badge variant="outline">{orderDetailDraft.filter((column) => column.visible).length} sichtbar</Badge>
            <span>Mindestens die Auftragskennung bleibt immer sichtbar.</span>
          </div>

          <div className="analytics-columns-list">
            {orderDetailDraft.map((column, index) => {
              const definition = ORDER_DETAIL_COLUMNS.find((entry) => entry.id === column.id)
              if (!definition) return null

              return (
                <div key={column.id} className="analytics-columns-item">
                  <div className="analytics-columns-item-info">
                    <div className="analytics-columns-item-index">{index + 1}</div>
                    <div>
                      <strong>{definition.label}</strong>
                      <p>{definition.description}</p>
                    </div>
                  </div>

                  <div className="analytics-columns-item-actions">
                    <label className="analytics-columns-toggle">
                      <Checkbox
                        checked={definition.required ? true : column.visible}
                        disabled={definition.required}
                        onCheckedChange={(checked) => setOrderDetailDraftVisibility(column.id, checked === true)}
                      />
                      <span>{definition.required ? "Fixiert" : column.visible ? "Sichtbar" : "Ausgeblendet"}</span>
                    </label>

                    <Button type="button" variant="outline" size="icon" onClick={() => moveOrderDetailDraftColumn(index, -1)} disabled={index === 0}>
                      <span className="sr-only">Nach oben</span>
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => moveOrderDetailDraftColumn(index, 1)}
                      disabled={index === orderDetailDraft.length - 1}
                    >
                      <span className="sr-only">Nach unten</span>
                      ↓
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          <DialogFooter className="analytics-columns-footer">
            <Button type="button" variant="outline" onClick={resetOrderDetailPreferences}>
              Standard wiederherstellen
            </Button>
            <Button type="button" className="analytics-settings-save" onClick={applyOrderDetailPreferences}>
              Anwenden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="analytics-settings-dialog">
          <DialogHeader>
            <DialogTitle>Rentabilitaets-Einstellungen</DialogTitle>
            <DialogDescription>
              Alle Parameter dieser Tabelle werden zentral im Backend gespeichert und bei der naechsten Berechnung sofort verwendet.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="labor" className="analytics-settings-tabs">
            <TabsList className="analytics-settings-tab-list">
              <TabsTrigger value="labor">Zeit</TabsTrigger>
              <TabsTrigger value="materials">Material</TabsTrigger>
              <TabsTrigger value="overhead">Gemeinkosten</TabsTrigger>
              <TabsTrigger value="formula">Rechenweg</TabsTrigger>
              <TabsTrigger value="warranty">Garantie</TabsTrigger>
            </TabsList>

            <TabsContent value="labor" className="analytics-settings-grid">
              <NumberField
                id="labor-rate"
                label="Stundensatz"
                value={settingsDraft.labor.defaultHourlyRate}
                description="Basis fuer Arbeitszeitkosten pro effektiver Stunde."
                onChange={(value) => updateLaborNumber("defaultHourlyRate", value)}
              />
              <NumberField
                id="labor-progress"
                label="Fallback Fortschrittsgewicht"
                value={settingsDraft.labor.fallbackProgressWeight}
                step="0.01"
                description="Minimaler Faktor fuer noch nicht vollstaendig erfasste Auftraege."
                onChange={(value) => updateLaborNumber("fallbackProgressWeight", value)}
              />
              <NumberField
                id="labor-minimum"
                label="Minimaler Progressfaktor"
                value={settingsDraft.labor.minimumProgressFactor}
                step="0.01"
                description="Untergrenze fuer die Fallback-Stundenableitung."
                onChange={(value) => updateLaborNumber("minimumProgressFactor", value)}
              />
              <NumberField
                id="labor-product"
                label="Produkt-Handling in Minuten"
                value={settingsDraft.labor.productHandlingMinutes}
                step="1"
                description="Sollzeit pro Shop-Produkt im Auftrag."
                onChange={(value) => updateLaborNumber("productHandlingMinutes", value)}
              />
              <ToggleField
                id="tracked-time"
                label="Erfasste Zeit priorisieren"
                checked={settingsDraft.labor.includeTrackedTimeOnly}
                description="WorkSession-Zeiten haben immer Vorrang in der Ist-Kalkulation."
                onCheckedChange={(checked) =>
                  setSettingsDraft((current) => ({
                    ...current,
                    labor: { ...current.labor, includeTrackedTimeOnly: checked },
                  }))
                }
              />
            </TabsContent>

            <TabsContent value="materials" className="analytics-settings-grid">
              <NumberField
                id="repair-base"
                label="Repair Material Basisrate"
                value={settingsDraft.materials.repairMaterialBaseRate}
                step="0.01"
                description="Fallback nur wenn keine echten Teilekosten vorliegen."
                onChange={(value) => updateMaterialsNumber("repairMaterialBaseRate", value)}
              />
              <NumberField
                id="repair-service"
                label="Zuschlag pro Service"
                value={settingsDraft.materials.repairMaterialPerServiceRate}
                step="0.01"
                onChange={(value) => updateMaterialsNumber("repairMaterialPerServiceRate", value)}
              />
              <NumberField
                id="repair-min"
                label="Minimale Repairrate"
                value={settingsDraft.materials.minimumRepairMaterialRate}
                step="0.01"
                onChange={(value) => updateMaterialsNumber("minimumRepairMaterialRate", value)}
              />
              <NumberField
                id="repair-max"
                label="Maximale Repairrate"
                value={settingsDraft.materials.maximumRepairMaterialRate}
                step="0.01"
                onChange={(value) => updateMaterialsNumber("maximumRepairMaterialRate", value)}
              />
              <NumberField
                id="product-rate"
                label="Produkt-Materialquote"
                value={settingsDraft.materials.productMaterialRate}
                step="0.01"
                onChange={(value) => updateMaterialsNumber("productMaterialRate", value)}
              />
              <NumberField
                id="product-fallback"
                label="Shop-Produkt Kostenfallback"
                value={settingsDraft.materials.fallbackShopProductCostRate}
                step="0.01"
                onChange={(value) => updateMaterialsNumber("fallbackShopProductCostRate", value)}
              />
              <ToggleField
                id="subcontracting-enabled"
                label="Fremdleistung aktiv"
                checked={settingsDraft.subcontracting.enabled}
                description="Keyword-basierte Auslagerung auftragsbezogen berechnen."
                onCheckedChange={(checked) =>
                  setSettingsDraft((current) => ({
                    ...current,
                    subcontracting: { ...current.subcontracting, enabled: checked },
                  }))
                }
              />
              <NumberField
                id="subcontracting-rate"
                label="Fremdleistungsquote"
                value={settingsDraft.subcontracting.defaultRate}
                step="0.01"
                onChange={(value) => updateSubcontractingNumber("defaultRate", value)}
              />
              <TextField
                id="subcontracting-keywords"
                label="Fremdleistungs-Keywords"
                value={settingsDraft.subcontracting.keywords.join(", ")}
                description="Kommagetrennte Begriffe fuer ausgelagerte Faelle."
                onChange={(value) =>
                  setSettingsDraft((current) => ({
                    ...current,
                    subcontracting: {
                      ...current.subcontracting,
                      keywords: value.split(",").map((entry) => entry.trim()).filter(Boolean),
                    },
                  }))
                }
              />
            </TabsContent>

            <TabsContent value="overhead" className="analytics-settings-grid">
              <NumberField id="rent" label="Miete pro Monat" value={settingsDraft.overhead.monthlyRent} onChange={(value) => updateOverheadNumber("monthlyRent", value)} />
              <NumberField id="utilities" label="Nebenkosten pro Monat" value={settingsDraft.overhead.monthlyUtilities} onChange={(value) => updateOverheadNumber("monthlyUtilities", value)} />
              <NumberField id="admin-payroll" label="Admin-Personal pro Monat" value={settingsDraft.overhead.monthlyAdminPayroll} onChange={(value) => updateOverheadNumber("monthlyAdminPayroll", value)} />
              <NumberField id="software" label="Software pro Monat" value={settingsDraft.overhead.monthlySoftware} onChange={(value) => updateOverheadNumber("monthlySoftware", value)} />
              <NumberField id="insurance" label="Versicherung pro Monat" value={settingsDraft.overhead.monthlyInsurance} onChange={(value) => updateOverheadNumber("monthlyInsurance", value)} />
              <NumberField id="marketing" label="Marketing pro Monat" value={settingsDraft.overhead.monthlyMarketing} onChange={(value) => updateOverheadNumber("monthlyMarketing", value)} />
              <NumberField id="other-fixed" label="Sonstige Fixkosten pro Monat" value={settingsDraft.overhead.monthlyOtherFixedCosts} onChange={(value) => updateOverheadNumber("monthlyOtherFixedCosts", value)} />
              <NumberField id="billable-hours" label="Ziel-Billable-Hours pro Monat" value={settingsDraft.overhead.targetMonthlyBillableHours} step="1" onChange={(value) => updateOverheadNumber("targetMonthlyBillableHours", value)} />
              <NumberField id="depreciation" label="Abschreibung pro Monat" value={settingsDraft.depreciation.monthlyEquipmentDepreciation} onChange={(value) => updateDepreciationNumber("monthlyEquipmentDepreciation", value)} />
              <NumberField id="packaging" label="Verpackungsquote" value={settingsDraft.otherCosts.packagingRate} step="0.01" onChange={(value) => updateOtherCostsNumber("packagingRate", value)} />
              <NumberField id="payment-fee" label="Zahlungsgebuehrenquote" value={settingsDraft.otherCosts.paymentFeeRate} step="0.01" onChange={(value) => updateOtherCostsNumber("paymentFeeRate", value)} />
            </TabsContent>

            <TabsContent value="formula" className="analytics-settings-grid">
              <div className="analytics-settings-formula-note analytics-settings-field-full">
                <strong>So funktioniert die Berechnung</strong>
                <p>
                  1) Es werden die Kostenblaecke je Auftrag berechnet (Direktkosten, Gemeinkosten, Abschreibung, Sonstige).
                </p>
                <p>
                  2) Jeder Block kann mit einem Faktor gewichtet werden. Der Standard ist immer 1.00.
                </p>
                <p>
                  3) Ergebnis = gewichtete Nettoerloese minus gewichtete Kosten. Mit den Faktoren kannst du die Formel an dein Controlling anpassen.
                </p>
                <div className="analytics-formula-presets">
                  <span>Profile:</span>
                  <Button type="button" variant="outline" onClick={() => applyFormulaPreset("conservative")}>Konservativ</Button>
                  <Button type="button" variant="outline" onClick={() => applyFormulaPreset("realistic")}>Realistisch</Button>
                  <Button type="button" variant="outline" onClick={() => applyFormulaPreset("growth")}>Wachstum</Button>
                </div>
              </div>

              <NumberField
                id="shipping-flat"
                label="Versandkostenpauschale pro Buchung"
                value={settingsDraft.otherCosts.flatShippingCostPerBooking}
                step="0.01"
                min={0}
                max={500}
                description="Zusatzkosten, die pauschal jeder Buchung zugeschlagen werden."
                onChange={(value) => updateOtherCostsNumber("flatShippingCostPerBooking", value)}
              />
              <NumberField
                id="weight-net-revenue"
                label="Faktor Nettoerloes"
                value={settingsDraft.formula.profitWeights.netRevenue}
                step="0.01"
                min={0}
                max={3}
                description="1.00 = unveraendert. Hoehere Werte gewichten Erloese staerker."
                onChange={(value) => updateFormulaNumber("profitWeights", "netRevenue", value)}
              />
              <NumberField
                id="weight-direct-costs"
                label="Faktor Direktkosten"
                value={settingsDraft.formula.profitWeights.directCosts}
                step="0.01"
                min={0}
                max={3}
                description="Material + Fremdleistung + Lohn."
                onChange={(value) => updateFormulaNumber("profitWeights", "directCosts", value)}
              />
              <NumberField
                id="weight-overhead"
                label="Faktor Gemeinkosten"
                value={settingsDraft.formula.profitWeights.overheadCost}
                step="0.01"
                min={0}
                max={3}
                onChange={(value) => updateFormulaNumber("profitWeights", "overheadCost", value)}
              />
              <NumberField
                id="weight-depreciation"
                label="Faktor Abschreibung"
                value={settingsDraft.formula.profitWeights.depreciationCost}
                step="0.01"
                min={0}
                max={3}
                onChange={(value) => updateFormulaNumber("profitWeights", "depreciationCost", value)}
              />
              <NumberField
                id="weight-other-operating"
                label="Faktor Sonstige Kosten"
                value={settingsDraft.formula.profitWeights.otherOperatingCost}
                step="0.01"
                min={0}
                max={3}
                onChange={(value) => updateFormulaNumber("profitWeights", "otherOperatingCost", value)}
              />
              <NumberField
                id="weight-packaging"
                label="Faktor Verpackung"
                value={settingsDraft.formula.operatingCostWeights.packaging}
                step="0.01"
                min={0}
                max={3}
                onChange={(value) => updateFormulaNumber("operatingCostWeights", "packaging", value)}
              />
              <NumberField
                id="weight-payment-fallback"
                label="Faktor Zahlungs-Fallback"
                value={settingsDraft.formula.operatingCostWeights.paymentFallback}
                step="0.01"
                min={0}
                max={3}
                description="Wirkt nur, wenn keine echten Gateway-Transaktionen vorliegen."
                onChange={(value) => updateFormulaNumber("operatingCostWeights", "paymentFallback", value)}
              />
              <NumberField
                id="weight-payment-gateway"
                label="Faktor Gateway-Gebuehren"
                value={settingsDraft.formula.operatingCostWeights.paymentGateway}
                step="0.01"
                min={0}
                max={3}
                onChange={(value) => updateFormulaNumber("operatingCostWeights", "paymentGateway", value)}
              />
              <NumberField
                id="weight-warranty"
                label="Faktor Gewaehrleistungsreserve"
                value={settingsDraft.formula.operatingCostWeights.warrantyReserve}
                step="0.01"
                min={0}
                max={3}
                onChange={(value) => updateFormulaNumber("operatingCostWeights", "warrantyReserve", value)}
              />
              <NumberField
                id="weight-order-shipping"
                label="Faktor Auftragsversand"
                value={settingsDraft.formula.operatingCostWeights.orderShipping}
                step="0.01"
                min={0}
                max={3}
                description="Gewichtet die am Auftrag erfassten Versandkosten."
                onChange={(value) => updateFormulaNumber("operatingCostWeights", "orderShipping", value)}
              />
              <NumberField
                id="weight-flat-shipping"
                label="Faktor Versandpauschale"
                value={settingsDraft.formula.operatingCostWeights.bookingFlatShipping}
                step="0.01"
                min={0}
                max={3}
                description="Gewichtet die pauschalen Versandkosten je Buchung."
                onChange={(value) => updateFormulaNumber("operatingCostWeights", "bookingFlatShipping", value)}
              />
              <div className="analytics-settings-formula-preview analytics-settings-field-full">
                <div className="analytics-formula-equation">
                  <span>Formelvorschau (Beispiel)</span>
                  <strong>
                    Ergebnis = {formatCurrency(formulaPreview.weightedNetRevenue)} - {formatCurrency(formulaPreview.weightedDirectCosts)} - {formatCurrency(formulaPreview.weightedOverheadCost)} - {formatCurrency(formulaPreview.weightedDepreciationCost)} - {formatCurrency(formulaPreview.weightedOtherOperatingCost)}
                  </strong>
                  <strong className={formulaPreview.profit >= 0 ? "analytics-positive" : "analytics-negative"}>{formatCurrency(formulaPreview.profit)}</strong>
                </div>
                <div className="analytics-settings-preview">
                  <div>
                    <span>Nettoerloes (Beispiel)</span>
                    <strong>{formatCurrency(formulaPreview.sampleNetRevenue)}</strong>
                  </div>
                  <div>
                    <span>Direktkosten (Beispiel)</span>
                    <strong>{formatCurrency(formulaPreview.sampleDirectCosts)}</strong>
                  </div>
                  <div>
                    <span>Gemeinkosten (bei {formulaPreview.sampleAllocationHours.toFixed(1)} h)</span>
                    <strong>{formatCurrency(formulaPreview.overheadCost)}</strong>
                  </div>
                  <div>
                    <span>Abschreibung (bei {formulaPreview.sampleAllocationHours.toFixed(1)} h)</span>
                    <strong>{formatCurrency(formulaPreview.depreciationCost)}</strong>
                  </div>
                  <div>
                    <span>Sonstige Kosten gesamt</span>
                    <strong>{formatCurrency(formulaPreview.otherOperatingCost)}</strong>
                  </div>
                  <div>
                    <span>Verpackung / Zahlungsfallback</span>
                    <strong>
                      {formatCurrency(formulaPreview.packagingCost)} / {formatCurrency(formulaPreview.paymentFallbackCost)}
                    </strong>
                  </div>
                  <div>
                    <span>Gateway / Gewaehrleistung</span>
                    <strong>
                      {formatCurrency(formulaPreview.paymentGatewayCost)} / {formatCurrency(formulaPreview.warrantyReserveCost)}
                    </strong>
                  </div>
                  <div>
                    <span>Auftragsversand / Versandpauschale</span>
                    <strong>
                      {formatCurrency(formulaPreview.orderShippingCost)} / {formatCurrency(formulaPreview.bookingFlatShippingCost)}
                    </strong>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="warranty" className="analytics-settings-grid">
              <NumberField id="warranty-rate" label="Gewaehrleistungsreserve" value={settingsDraft.otherCosts.warrantyReserveRate} step="0.01" onChange={(value) => updateOtherCostsNumber("warrantyReserveRate", value)} />
              <TextField
                id="warranty-keywords"
                label="Garantie-Keywords"
                value={settingsDraft.warranty.keywords.join(", ")}
                description="Kommagetrennte Begriffe fuer Nacharbeit und Gewaehrleistung."
                onChange={(value) =>
                  setSettingsDraft((current) => ({
                    ...current,
                    warranty: {
                      ...current.warranty,
                      keywords: value.split(",").map((entry) => entry.trim()).filter(Boolean),
                    },
                  }))
                }
              />
              <TextField
                id="warranty-default"
                label="Standard-Label"
                value={settingsDraft.warranty.defaultLabel}
                onChange={(value) =>
                  setSettingsDraft((current) => ({
                    ...current,
                    warranty: { ...current.warranty, defaultLabel: value },
                  }))
                }
              />
              <TextField
                id="warranty-flagged"
                label="Markiertes Garantie-Label"
                value={settingsDraft.warranty.flaggedLabel}
                onChange={(value) =>
                  setSettingsDraft((current) => ({
                    ...current,
                    warranty: { ...current.warranty, flaggedLabel: value },
                  }))
                }
              />
              <div className="analytics-settings-preview analytics-settings-field-full">
                <div>
                  <span>Aktuelle Overheadrate</span>
                  <strong>{formatCurrency(settingsDraftMeta.overheadHourlyRate)}</strong>
                </div>
                <div>
                  <span>Aktuelle Abschreibungsrate</span>
                  <strong>{formatCurrency(settingsDraftMeta.depreciationHourlyRate)}</strong>
                </div>
                <div>
                  <span>Monatliche Gemeinkosten</span>
                  <strong>{formatCurrency(settingsDraftMeta.monthlyOverhead)}</strong>
                </div>
                <div>
                  <span>Monatliche Abschreibung</span>
                  <strong>{formatCurrency(settingsDraftMeta.monthlyDepreciation)}</strong>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDraft(settings)}>
              Zuruecksetzen
            </Button>
            <Button className="analytics-settings-save" onClick={saveSettings} disabled={savingSettings}>
              <Save className="h-4 w-4" />
              {savingSettings ? "Speichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
