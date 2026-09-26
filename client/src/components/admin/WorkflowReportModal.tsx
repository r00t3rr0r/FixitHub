import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle2, ClipboardCheck, Download, Euro, ShieldCheck, Smartphone, Wrench } from "lucide-react"
import { useToast } from "@/hooks/useToast"
import { getKnownRepairCost } from "@/api/deviceInspection"
import { jsPDF } from "jspdf"

interface WorkflowReportModalProps {
  isOpen: boolean
  onClose: () => void
  workflow: WorkflowReport
  orderId: string
}

type RGB = [number, number, number]

type ReportRow = {
  label: string
  value: string
  tone?: "success" | "warning" | "danger" | "neutral"
}

type ReportSection = {
  title: string
  rows: ReportRow[]
}

type UnknownRecord = Record<string, unknown>

type WorkflowStep = {
  stepName?: string
  status?: string
  assignedStaffId?: unknown
  staffName?: string
  startedAt?: string | Date
  completedAt?: string | Date
  formData?: UnknownRecord
  checklistData?: Record<string, unknown>
  notes?: string
  photos?: string[]
}

type WorkflowPauseEntry = {
  pausedAt?: string | Date
  resumedAt?: string | Date
  reason?: string
  stepName?: string
}

type WorkflowReport = {
  workflowName?: string
  status?: string
  startedAt?: string | Date
  completedAt?: string | Date
  pausedAt?: string | Date
  pauseReason?: string
  pauseHistory?: WorkflowPauseEntry[]
  steps?: WorkflowStep[]
  [key: string]: unknown
}

type InspectionPart = {
  status?: string
  notes?: string
  current?: string
  present?: boolean
  description?: string
}

type DeviceInspection = {
  modelVerification?: {
    reportedModel?: string
    actualModel?: string
    verificationStatus?: string
    costDifference?: number | string
    notes?: string
  }
  identification?: {
    deviceType?: string
    imei?: string
    serialNumber?: string
    identified?: boolean
  }
  accessories?: {
    originalPackaging?: InspectionPart
    caseCover?: InspectionPart
    powerAdapter?: InspectionPart
    simTray?: InspectionPart
    cables?: InspectionPart
    otherAccessories?: InspectionPart[]
    additionalAccessoriesText?: string
    description?: string
  }
  externalInspection?: {
    display?: InspectionPart
    frame?: InspectionPart
    backCover?: InspectionPart
    buttons?: InspectionPart
    visibleDamages?: { hasDamage?: boolean; description?: string }
    uniqueNotes?: string
    photos?: string[]
  }
  deviceTest?: {
    charging?: InspectionPart
    power?: InspectionPart
    wifi?: InspectionPart
    frontCamera?: InspectionPart
    mainCamera?: InspectionPart
    buttons?: InspectionPart
    notes?: string
  }
  appleSpecific?: {
    modemFirmware?: InspectionPart
    touchIdFaceId?: InspectionPart
    customerInfoAction?: { requested?: boolean; note?: string }
  }
  status?: string
  hasFailedTests?: boolean
  failedTestDetails?: Array<{ testName?: string; reason?: string }>
  // DEPRECATED (isRepairable, completionAction): stored legacy values were client defaults and
  // are never shown. Only repairOfferKnownCost / an explicitly specified cost is a real price.
  isRepairable?: boolean
  repairOffer?: { cost?: number | string; costSpecified?: boolean; timeframe?: string; description?: string }
  repairOfferKnownCost?: number | null
  completionAction?: string
  customerInformation?: { reason?: string; note?: string }
  [key: string]: unknown
}

type PricingSummary = {
  originalDevice?: { brand?: string; model?: string; type?: string }
  newDevice?: { brand?: string; model?: string; type?: string }
  serviceChanges?: Array<{
    serviceName?: string
    originalPrice?: number | string
    newPrice?: number | string
    difference?: number | string
    status?: string
  }>
  totalCostBefore?: number | string
  totalCostAfter?: number | string
  totalCostDifference?: number | string
  totalCostStatus?: string
}

const brand = {
  navy: [26, 42, 94] as RGB,
  navyDark: [15, 29, 69] as RGB,
  gold: [245, 184, 0] as RGB,
  ink: [39, 50, 70] as RGB,
  muted: [100, 116, 139] as RGB,
  line: [226, 232, 240] as RGB,
  soft: [248, 250, 252] as RGB,
  success: [5, 150, 105] as RGB,
  warning: [217, 119, 6] as RGB,
  danger: [220, 38, 38] as RGB,
}

export function WorkflowReportModal({
  isOpen,
  onClose,
  workflow,
  orderId,
}: WorkflowReportModalProps) {
  const { toast } = useToast()
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "in-progress":
        return "bg-blue-100 text-blue-800"
      case "skipped":
        return "bg-gray-100 text-gray-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return "—"
    const dateObj = typeof date === "string" ? new Date(date) : date
    if (!Number.isFinite(dateObj.getTime())) return "—"
    return dateObj.toLocaleString("de-DE")
  }

  // Für nicht abgeschlossene Workflows ist das Fenster eine reine Lesesicht auf den
  // aktuellen Stand; es verändert weder Status noch Zeiterfassung.
  const isFinalReport = String(workflow?.status || "").toLowerCase() === "completed"
  const pauseEntries: WorkflowPauseEntry[] = Array.isArray(workflow?.pauseHistory) ? workflow.pauseHistory : []

  const formatValue = (value: unknown): string => {
    if (Array.isArray(value)) {
      return value.map((item) => formatValue(item)).join(", ")
    }
    if (typeof value === "boolean") {
      return value ? "Ja" : "Nein"
    }
    if (typeof value === "object" && value !== null) {
      // Eingebettete Prüfdaten nicht als Roh-JSON ausgeben (enthielte u. a. die veralteten
      // Client-Vorgaben isRepairable/completionAction und einen Default-Preis 0).
      if (isInspectionLike(value)) {
        return "Prüfdaten der Geräteprüfung (siehe Abschnitte oben)"
      }
      return JSON.stringify(value, null, 2)
    }
    return String(value || "-")
  }

  const formatMoney = (value: unknown) => {
    const numberValue = Number(value)
    if (!Number.isFinite(numberValue)) return "-"
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(numberValue)
  }

  const formatStatus = (value: unknown) => {
    const normalized = String(value || "-")
    const labels: Record<string, string> = {
      completed: "Abgeschlossen",
      "in-progress": "In Bearbeitung",
      "on-hold": "Pausiert",
      "not-started": "Nicht gestartet",
      pending: "Ausstehend",
      skipped: "Übersprungen",
      correct: "Modell korrekt",
      "incorrect-more-expensive": "Modell abweichend, teurer",
      "incorrect-same-cheaper": "Modell abweichend, gleicher/günstiger Preis",
      unverifiable: "Nicht verifizierbar",
      OK: "OK",
      "Not OK": "Fehler",
      "Not tested": "Nicht getestet",
      working: "Funktioniert",
      "not-working": "Funktioniert nicht",
      defective: "Defekt",
      "not-testable": "Nicht testbar",
      "not-applicable": "Nicht zutreffend",
      "light-wear": "Leichte Gebrauchsspuren",
      "scratches-wear": "Kratzer/Gebrauchsspuren",
      "heavy-scratches-wear": "Starke Gebrauchsspuren",
      damaged: "Beschädigt",
    }
    return labels[normalized] || normalized.replace(/-/g, " ")
  }

  const getToneForValue = (value: unknown): ReportRow["tone"] => {
    const normalized = String(value || "").toLowerCase()
    if (["ok", "working", "completed", "correct"].includes(normalized)) return "success"
    if (["not ok", "not-working", "defective", "damaged"].includes(normalized)) return "danger"
    if (["not tested", "not-testable", "unverifiable", "incorrect-more-expensive", "incorrect-same-cheaper"].includes(normalized)) return "warning"
    return "neutral"
  }

  const isRecord = (value: unknown): value is UnknownRecord => Boolean(value && typeof value === "object" && !Array.isArray(value))

  const isInspectionLike = (value: unknown): value is DeviceInspection => {
    if (!isRecord(value)) return false
    return [
      "modelVerification",
      "identification",
      "accessories",
      "externalInspection",
      "deviceTest",
      "appleSpecific",
      "repairOffer",
      "failedTestDetails",
    ].some((key) => value[key] !== undefined)
  }

  const findNestedObject = <T extends UnknownRecord>(value: unknown, predicate: (candidate: UnknownRecord) => candidate is T, depth = 0, seen = new Set<object>()): T | null => {
    if (!value || typeof value !== "object" || depth > 5 || seen.has(value)) return null
    seen.add(value)

    if (predicate(value)) return value

    if (Array.isArray(value)) {
      for (const item of value) {
        const match = findNestedObject(item, predicate, depth + 1, seen)
        if (match) return match
      }
      return null
    }

    for (const item of Object.values(value)) {
      const match = findNestedObject(item, predicate, depth + 1, seen)
      if (match) return match
    }

    return null
  }

  const inspection = findNestedObject(workflow, isInspectionLike)
  const pricingSummary = findNestedObject(workflow, (candidate): candidate is PricingSummary => (
    isRecord(candidate.originalDevice) &&
    isRecord(candidate.newDevice) &&
    Array.isArray(candidate.serviceChanges) &&
    candidate.totalCostBefore !== undefined &&
    candidate.totalCostAfter !== undefined
  ))

  const addRow = (rows: ReportRow[], label: string, value: unknown, tone?: ReportRow["tone"]) => {
    if (value === undefined || value === null || value === "") return
    rows.push({ label, value: String(value), tone })
  }

  const buildDiagnosticSections = (): ReportSection[] => {
    if (!inspection) return []

    const sections: ReportSection[] = []

    if (inspection.modelVerification) {
      const model = inspection.modelVerification
      const rows: ReportRow[] = []
      addRow(rows, "Gemeldetes Modell", model.reportedModel)
      addRow(rows, "Festgestelltes Modell", model.actualModel, model.reportedModel && model.actualModel && model.reportedModel !== model.actualModel ? "warning" : "success")
      addRow(rows, "Bewertung", formatStatus(model.verificationStatus), getToneForValue(model.verificationStatus))
      if (model.costDifference !== undefined && Number(model.costDifference) !== 0) {
        const prefix = Number(model.costDifference) > 0 ? "+" : ""
        addRow(rows, "Preisänderung durch Modell", `${prefix}${formatMoney(model.costDifference)}`, Number(model.costDifference) > 0 ? "warning" : "success")
      }
      addRow(rows, "Notiz", model.notes)
      sections.push({ title: "Modellverifizierung", rows })
    }

    if (pricingSummary) {
      const rows: ReportRow[] = []
      addRow(rows, "Vorheriges Modell", `${pricingSummary.originalDevice?.brand || ""} ${pricingSummary.originalDevice?.model || ""}`.trim())
      addRow(rows, "Neues Modell", `${pricingSummary.newDevice?.brand || ""} ${pricingSummary.newDevice?.model || ""}`.trim(), "warning")
      addRow(rows, "Auftragswert vorher", formatMoney(pricingSummary.totalCostBefore))
      addRow(rows, "Auftragswert neu", formatMoney(pricingSummary.totalCostAfter), getToneForValue(pricingSummary.totalCostStatus))
      const difference = Number(pricingSummary.totalCostDifference || 0)
      addRow(rows, "Gesamtdifferenz", `${difference > 0 ? "+" : ""}${formatMoney(difference)}`, difference > 0 ? "warning" : difference < 0 ? "success" : "neutral")
      pricingSummary.serviceChanges?.forEach((change) => {
        const serviceDifference = Number(change.difference || 0)
        addRow(rows, change.serviceName || "Service", `${formatMoney(change.originalPrice)} -> ${formatMoney(change.newPrice)} (${serviceDifference > 0 ? "+" : ""}${formatMoney(change.difference)})`, getToneForValue(change.status))
      })
      sections.push({ title: "Modell- und Preisänderungen", rows })
    }

    if (inspection.identification) {
      const rows: ReportRow[] = []
      addRow(rows, "Gerätetyp", inspection.identification.deviceType)
      addRow(rows, "IMEI", inspection.identification.imei)
      addRow(rows, "Seriennummer", inspection.identification.serialNumber)
      addRow(rows, "Identifiziert", inspection.identification.identified)
      sections.push({ title: "Identifikation", rows })
    }

    if (inspection.accessories) {
      const rows: ReportRow[] = []
      const accessories = [
        ["Originalverpackung", inspection.accessories.originalPackaging],
        ["Schutzhülle", inspection.accessories.caseCover],
        ["Netzteil", inspection.accessories.powerAdapter],
        ["SIM-Schublade", inspection.accessories.simTray],
        ["Kabel", inspection.accessories.cables],
      ] as const
      accessories.forEach(([label, item]) => {
        if (!item || item.present === undefined) return
        addRow(rows, label, item.present ? "Vorhanden" : "Nicht vorhanden", item.present ? "success" : "warning")
        addRow(rows, `${label} Notiz`, item.description)
      })
      inspection.accessories.otherAccessories?.forEach((item) => {
        addRow(rows, item.name || "Weiteres Zubehör", item.present ? "Vorhanden" : "Nicht vorhanden", item.present ? "success" : "warning")
        addRow(rows, `${item.name || "Zubehör"} Notiz`, item.description)
      })
      addRow(rows, "Zusätzliches Zubehör", inspection.accessories.additionalAccessoriesText)
      addRow(rows, "Zubehör-Notiz", inspection.accessories.description)
      sections.push({ title: "Zubehör und Verpackung", rows })
    }

    if (inspection.externalInspection) {
      const rows: ReportRow[] = []
      const parts = [
        ["Display", inspection.externalInspection.display],
        ["Rahmen", inspection.externalInspection.frame],
        ["Rückseite", inspection.externalInspection.backCover],
        ["Tasten", inspection.externalInspection.buttons],
      ] as const
      parts.forEach(([label, part]) => {
        if (!part?.status) return
        addRow(rows, label, formatStatus(part.status), getToneForValue(part.status))
        addRow(rows, `${label} Notiz`, part.notes)
      })
      if (inspection.externalInspection.visibleDamages?.hasDamage !== undefined) {
        addRow(rows, "Sichtbare Schäden", inspection.externalInspection.visibleDamages.hasDamage ? "Ja" : "Nein", inspection.externalInspection.visibleDamages.hasDamage ? "danger" : "success")
        addRow(rows, "Schadensbeschreibung", inspection.externalInspection.visibleDamages.description)
      }
      addRow(rows, "Besondere Hinweise", inspection.externalInspection.uniqueNotes)
      addRow(rows, "Fotos", Array.isArray(inspection.externalInspection.photos) ? `${inspection.externalInspection.photos.length} Foto(s)` : undefined)
      sections.push({ title: "Äußerer Zustand", rows })
    }

    if (inspection.deviceTest) {
      const rows: ReportRow[] = []
      const tests = [
        ["Laden", inspection.deviceTest.charging],
        ["Einschalten", inspection.deviceTest.power],
        ["WLAN", inspection.deviceTest.wifi],
        ["Frontkamera", inspection.deviceTest.frontCamera],
        ["Hauptkamera", inspection.deviceTest.mainCamera],
        ["Tasten", inspection.deviceTest.buttons],
      ] as const
      tests.forEach(([label, test]) => {
        if (!test?.status) return
        addRow(rows, label, formatStatus(test.status), getToneForValue(test.status))
        addRow(rows, `${label} Notiz`, test.notes)
      })
      addRow(rows, "Ladestrom", inspection.deviceTest.charging?.current)
      addRow(rows, "Testnotiz", inspection.deviceTest.notes)
      sections.push({ title: "Funktionstests", rows })
    }

    if (inspection.appleSpecific) {
      const rows: ReportRow[] = []
      addRow(rows, "Modem-Firmware", formatStatus(inspection.appleSpecific.modemFirmware?.status), getToneForValue(inspection.appleSpecific.modemFirmware?.status))
      addRow(rows, "Modem-Firmware Notiz", inspection.appleSpecific.modemFirmware?.notes)
      addRow(rows, "Touch ID / Face ID", formatStatus(inspection.appleSpecific.touchIdFaceId?.status), getToneForValue(inspection.appleSpecific.touchIdFaceId?.status))
      addRow(rows, "Touch ID / Face ID Notiz", inspection.appleSpecific.touchIdFaceId?.notes)
      if (inspection.appleSpecific.customerInfoAction?.requested !== undefined) {
        addRow(rows, "Kundeninformation erforderlich", inspection.appleSpecific.customerInfoAction.requested ? "Ja" : "Nein", inspection.appleSpecific.customerInfoAction.requested ? "warning" : "success")
        addRow(rows, "Kundeninformation Notiz", inspection.appleSpecific.customerInfoAction.note)
      }
      sections.push({ title: "Apple-spezifische Prüfung", rows })
    }

    // Keine "Reparierbar"/"Empfohlene Maßnahme"-Zeile: diese Angaben gibt es in der Inspektion nicht
    // mehr, gespeicherte Altwerte waren automatische Client-Vorgaben. Ein Preis nur, wenn er
    // tatsächlich angegeben wurde; eine Alt-0 ohne Kennzeichnung ist "nicht angegeben".
    if (inspection.repairOffer || inspection.customerInformation || inspection.failedTestDetails?.length) {
      const rows: ReportRow[] = []
      if (inspection.repairOffer) {
        const knownCost = getKnownRepairCost(inspection)
        addRow(
          rows,
          "Kostenvoranschlag",
          knownCost === null ? "nicht angegeben" : `${formatMoney(knownCost)}${knownCost === 0 ? " (kostenlos)" : ""}`,
          knownCost === null ? "neutral" : "warning"
        )
      }
      addRow(rows, "Zeitrahmen", inspection.repairOffer?.timeframe)
      addRow(rows, "Angebotsbeschreibung", inspection.repairOffer?.description)
      addRow(rows, "Kundeninfo Grund", inspection.customerInformation?.reason)
      addRow(rows, "Kundeninfo Notiz", inspection.customerInformation?.note)
      inspection.failedTestDetails?.forEach((failedTest) => {
        addRow(rows, failedTest.testName || "Fehlgeschlagener Test", failedTest.reason, "danger")
      })
      sections.push({ title: "Kostenvoranschlag und Befunde", rows })
    }

    return sections.filter((section) => section.rows.length > 0)
  }

  const diagnosticSections = buildDiagnosticSections()

  const generatePDF = async () => {
    try {
      setIsGeneratingPDF(true)

      const pdf = new jsPDF({ unit: "mm", format: "a4" })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 15
      const contentWidth = pageWidth - 2 * margin
      let yPosition = 0

      const setColor = (color: RGB) => pdf.setTextColor(color[0], color[1], color[2])

      const checkPageSpace = (space: number) => {
        if (yPosition + space > pageHeight - margin) {
          pdf.addPage()
          addPageHeader(false)
        }
      }

      const addPageHeader = (firstPage = false) => {
        pdf.setFillColor(...brand.navy)
        pdf.rect(0, 0, pageWidth, firstPage ? 36 : 20, "F")
        pdf.setFillColor(...brand.gold)
        pdf.rect(0, firstPage ? 34 : 18, pageWidth, 2, "F")
        setColor([255, 255, 255])
        pdf.setFont(undefined, "bold")
        pdf.setFontSize(firstPage ? 20 : 12)
        pdf.text("McRepair", margin, firstPage ? 15 : 12)
        pdf.setFont(undefined, "normal")
        pdf.setFontSize(firstPage ? 10 : 8)
        pdf.text(
          isFinalReport ? "Prüfbericht Geräteprüfung" : "Zwischenstand - Workflow nicht abgeschlossen",
          margin,
          firstPage ? 24 : 16
        )
        yPosition = firstPage ? 47 : 30
      }

      const addText = (text: string, size: number, weight: "bold" | "normal" = "normal", color: RGB = brand.ink, width = contentWidth) => {
        checkPageSpace(8)
        pdf.setFontSize(size)
        setColor(color)
        if (weight === "bold") {
          pdf.setFont(undefined, "bold")
        } else {
          pdf.setFont(undefined, "normal")
        }
        const lines = pdf.splitTextToSize(text, width)
        pdf.text(lines, margin, yPosition)
        yPosition += lines.length * (size * 0.42) + 3
      }

      const addKeyValue = (label: string, value: string, x: number, y: number, width: number, tone: ReportRow["tone"] = "neutral") => {
        const toneColor = tone === "success" ? brand.success : tone === "warning" ? brand.warning : tone === "danger" ? brand.danger : brand.ink
        pdf.setFont(undefined, "bold")
        pdf.setFontSize(7.5)
        setColor(brand.muted)
        pdf.text(label.toUpperCase(), x, y)
        pdf.setFont(undefined, "normal")
        pdf.setFontSize(9)
        setColor(toneColor)
        const lines = pdf.splitTextToSize(value || "-", width)
        pdf.text(lines, x, y + 5)
        return 8 + lines.length * 4
      }

      const addSection = (section: ReportSection) => {
        checkPageSpace(24)
        pdf.setFillColor(...brand.soft)
        pdf.setDrawColor(...brand.line)
        const startY = yPosition
        pdf.roundedRect(margin, startY, contentWidth, 13, 2, 2, "FD")
        pdf.setFont(undefined, "bold")
        pdf.setFontSize(11)
        setColor(brand.navy)
        pdf.text(section.title, margin + 4, startY + 8.5)
        yPosition += 17

        const columnGap = 7
        const columnWidth = (contentWidth - columnGap) / 2
        for (let index = 0; index < section.rows.length; index += 2) {
          const left = section.rows[index]
          const right = section.rows[index + 1]
          const rowY = yPosition
          const leftHeight = addKeyValue(left.label, left.value, margin + 2, rowY, columnWidth - 4, left.tone)
          const rightHeight = right ? addKeyValue(right.label, right.value, margin + columnWidth + columnGap + 2, rowY, columnWidth - 4, right.tone) : 0
          yPosition += Math.max(leftHeight, rightHeight, 12)
          checkPageSpace(16)
        }
        yPosition += 3
      }

      addPageHeader(true)

      pdf.setFont(undefined, "bold")
      pdf.setFontSize(15)
      setColor(brand.navyDark)
      pdf.text(workflow.workflowName || "Workflow-Bericht", margin, yPosition)
      yPosition += 9

      if (!isFinalReport) {
        // Ehrlich über den Stand: kein abgeschlossener Prüfbericht, sondern ein Zwischenstand.
        addText(
          `Zwischenstand vom ${new Date().toLocaleString("de-DE")} (Workflow-Status: ${formatStatus(workflow.status || "not-started")}). Dieses Dokument ist KEIN abgeschlossener Prüfbericht; Befunde und Angaben können sich noch ändern.`,
          9,
          "bold",
          brand.warning
        )
      }

      const completedSteps = workflow.steps?.filter((step) => step.status === "completed").length || 0
      const totalSteps = workflow.steps?.length || 0
      const summaryRows: ReportRow[] = [
        { label: "Auftrag", value: orderId },
        { label: "Status", value: formatStatus(workflow.status || "not-started"), tone: getToneForValue(workflow.status) },
        { label: "Gestartet", value: formatDate(workflow.startedAt) },
        { label: "Abgeschlossen", value: formatDate(workflow.completedAt) },
      ]

      if (totalSteps > 0) {
        summaryRows.push({ label: "Fortschritt", value: `${completedSteps}/${totalSteps} Schritte abgeschlossen`, tone: completedSteps === totalSteps ? "success" : "warning" })
      }

      addSection({ title: "Übersicht", rows: summaryRows })

      if (diagnosticSections.length > 0) {
        diagnosticSections.forEach(addSection)
      } else {
        addText("Keine strukturierten Prüfdaten im Workflow gefunden. Die verfügbaren Workflow-Schritte werden unten ausgegeben.", 9, "normal", brand.muted)
      }

      if (workflow.steps && workflow.steps.length > 0) {
        addText("Workflow-Schritte", 12, "bold", brand.navy)

        workflow.steps.forEach((step, index) => {
          checkPageSpace(30)
          addText(`${index + 1}. ${step.stepName}`, 10, "bold", brand.ink)
          addText(`Status: ${formatStatus(step.status || "pending")}`, 8, "normal", brand.muted)

          if (step.assignedStaffId) {
            addText(`Zugewiesen an: ${step.staffName || "Unbekannt"}`, 8, "normal", brand.muted)
          }

          if (step.startedAt) {
            addText(`Gestartet: ${formatDate(step.startedAt)}`, 8, "normal", brand.muted)
          }

          if (step.completedAt) {
            addText(`Abgeschlossen: ${formatDate(step.completedAt)}`, 8, "normal", brand.muted)
          }

          if (step.formData && Object.keys(step.formData).length > 0) {
            checkPageSpace(15)
            addText("Formulardaten", 9, "bold", brand.navy)
            Object.entries(step.formData).forEach(([key, value]) => {
              checkPageSpace(5)
              const formattedValue = formatValue(value)
              addText(`${key}: ${formattedValue}`, 8, "normal", brand.ink)
            })
          }

          if (step.checklistData && Object.keys(step.checklistData).length > 0) {
            checkPageSpace(15)
            addText("Checkliste", 9, "bold", brand.navy)
            Object.entries(step.checklistData).forEach(([key, value]) => {
              checkPageSpace(5)
              const status = value ? "Erledigt" : "Nicht erledigt"
              addText(`  ${key}: ${status}`, 9)
            })
          }

          if (step.notes) {
            checkPageSpace(10)
            addText("Notizen", 9, "bold", brand.navy)
            const noteLines = pdf.splitTextToSize(step.notes, contentWidth - 10)
            pdf.setFontSize(9)
            setColor(brand.ink)
            pdf.text(noteLines, margin, yPosition)
            yPosition += noteLines.length * 5 + 3
          }

          pdf.setDrawColor(...brand.line)
          pdf.line(margin, yPosition, pageWidth - margin, yPosition)
          yPosition += 5
        })
      }

      yPosition = pageHeight - margin - 10
      pdf.setFontSize(8)
      setColor(brand.muted)
      pdf.text(
        `Erstellt am ${new Date().toLocaleString("de-DE")}`,
        margin,
        yPosition
      )

      pdf.save(
        isFinalReport
          ? `mcrepair-pruefbericht-${orderId}-${new Date().getTime()}.pdf`
          : `mcrepair-zwischenstand-${orderId}-${new Date().getTime()}.pdf`
      )
      toast({ title: "Erfolg", description: "PDF wurde heruntergeladen." })
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast({ variant: "destructive", title: "Fehler", description: "PDF konnte nicht erstellt werden." })
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isFinalReport ? "McRepair Prüfbericht" : "Workflow ansehen (nur lesen)"}</DialogTitle>
          <DialogDescription>
            {isFinalReport
              ? "Professionelle Übersicht der Geräteprüfung inklusive Modell- und Preisänderungen."
              : "Aktueller Stand mit Schritten, Notizen, Befunden und Pausen. Diese Ansicht ändert nichts am Workflow."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-[#1a2a5e]/15 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-[#1a2a5e] to-[#0f1d45] px-5 py-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f5b800] text-[#1a2a5e]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-base font-semibold leading-tight">
                      {isFinalReport ? "McRepair Prüfbericht" : "Zwischenstand – Workflow nicht abgeschlossen"}
                    </p>
                    <p className="text-xs text-white/70">Auftrag {orderId}</p>
                  </div>
                </div>
                {!inspection ? (
                  <Badge className="border border-white/30 bg-white/10 text-white/80">Keine Prüfdaten</Badge>
                ) : inspection.hasFailedTests ? (
                  <Badge className="border border-red-300/40 bg-red-500/20 text-red-100">Prüfung mit Auffälligkeiten</Badge>
                ) : (
                  <Badge className="border border-emerald-300/40 bg-emerald-500/20 text-emerald-50">Prüfdaten erfasst</Badge>
                )}
              </div>
            </div>
            {diagnosticSections.length > 0 && (
              <div className="grid gap-px bg-[#1a2a5e]/10 p-px md:grid-cols-2">
                {diagnosticSections.slice(0, 4).map((section) => (
                  <div key={section.title} className="bg-white p-4">
                    <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#1a2a5e]/70">
                      {section.title === "Modellverifizierung" && <Smartphone className="h-3.5 w-3.5" />}
                      {section.title === "Modell- und Preisänderungen" && <Euro className="h-3.5 w-3.5" />}
                      {section.title === "Funktionstests" && <ClipboardCheck className="h-3.5 w-3.5" />}
                      {section.title === "Kostenvoranschlag und Befunde" && <Wrench className="h-3.5 w-3.5" />}
                      {![
                        "Modellverifizierung",
                        "Modell- und Preisänderungen",
                        "Funktionstests",
                        "Kostenvoranschlag und Befunde",
                      ].includes(section.title) && <CheckCircle2 className="h-3.5 w-3.5" />}
                      {section.title}
                    </p>
                    <div className="space-y-2">
                      {section.rows.slice(0, 4).map((row) => (
                        <div key={`${section.title}-${row.label}`} className="flex items-start justify-between gap-3 text-sm">
                          <span className="text-xs text-slate-500">{row.label}</span>
                          <span className={`max-w-[55%] text-right text-xs font-semibold ${
                            row.tone === "success" ? "text-emerald-700" :
                            row.tone === "warning" ? "text-amber-700" :
                            row.tone === "danger" ? "text-red-700" : "text-slate-800"
                          }`}>
                            {row.tone === "danger" && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Workflow-Übersicht</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Workflow</p>
                  <p className="text-base font-semibold">{workflow.workflowName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <Badge className={getStatusColor(workflow.status)}>
                    {formatStatus(workflow.status || "not-started")}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Gestartet</p>
                  <p className="text-sm">{formatDate(workflow.startedAt)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Abgeschlossen</p>
                  <p className="text-sm">{formatDate(workflow.completedAt)}</p>
                </div>
              </div>
              {String(workflow.status || "").toLowerCase() === "on-hold" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Pausiert seit {formatDate(workflow.pausedAt)}
                  {workflow.pauseReason ? ` – Grund: ${workflow.pauseReason}` : ""}
                </div>
              )}
              {pauseEntries.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium text-gray-500">Pause-Historie</p>
                  <div className="mt-2 space-y-1">
                    {pauseEntries.map((entry, idx) => (
                      <p key={idx} className="text-xs text-gray-600">
                        {formatDate(entry.pausedAt)} – {entry.resumedAt ? formatDate(entry.resumedAt) : "noch pausiert"}
                        {entry.stepName ? ` · Schritt: ${entry.stepName}` : ""}
                        {entry.reason ? ` · Grund: ${entry.reason}` : ""}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {workflow.steps && workflow.steps.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium text-gray-500">Fortschritt</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${
                            (workflow.steps.filter((step) => step.status === "completed")
                              .length / workflow.steps.length) *
                            100
                          }%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold">
                      {workflow.steps.filter((step) => step.status === "completed").length}/
                      {workflow.steps.length}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Steps Section */}
          {workflow.steps && workflow.steps.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Workflow-Schritte</h3>
              {workflow.steps.map((step, index) => (
                <Card key={index}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">
                          Schritt {index + 1}: {step.stepName}
                        </CardTitle>
                        <CardDescription>
                          {step.assignedStaffId && `Zugewiesen an: ${step.staffName || "Unbekannt"}`}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(step.status)}>
                        {formatStatus(step.status || "pending")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Timeline */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500">Gestartet</p>
                        <p className="text-sm">{formatDate(step.startedAt)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500">Abgeschlossen</p>
                        <p className="text-sm">{formatDate(step.completedAt)}</p>
                      </div>
                    </div>

                    {/* Form Data */}
                    {step.formData && Object.keys(step.formData).length > 0 && (
                      <div>
                        <p className="text-sm font-semibold mb-2">Formulardaten</p>
                        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                          {Object.entries(step.formData).map(([key, value], idx) => (
                            <div key={idx} className="text-sm">
                              <span className="font-medium text-gray-700">{key}:</span>
                              <span className="text-gray-600 ml-2">{formatValue(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Checklist Data */}
                    {step.checklistData && Object.keys(step.checklistData).length > 0 && (
                      <div>
                        <p className="text-sm font-semibold mb-2">Checkliste</p>
                        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                          {Object.entries(step.checklistData).map(([key, value], idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              {value ? (
                                <span className="text-green-600 font-bold">✓</span>
                              ) : (
                                <span className="text-red-600 font-bold">✗</span>
                              )}
                              <span className="text-gray-700">{key}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {step.notes && (
                      <div>
                        <p className="text-sm font-semibold mb-2">Notizen</p>
                        <div className="bg-white rounded-lg p-3 text-sm text-gray-700 border border-gray-200 shadow-sm">
                          {step.notes}
                        </div>
                      </div>
                    )}

                    {/* Photos */}
                    {step.photos && step.photos.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold mb-2">Fotos</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {step.photos.map((photo: string, idx: number) => (
                            <div key={idx} className="relative bg-gray-100 rounded-lg overflow-hidden">
                              <img
                                src={photo}
                                alt={`Schritt ${index + 1}, Foto ${idx + 1}`}
                                className="w-full h-24 object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {(!workflow.steps || workflow.steps.length === 0) && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-500">Keine Workflow-Schritte verfügbar</p>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
          >
            Schließen
          </Button>
          <Button
            onClick={generatePDF}
            disabled={isGeneratingPDF}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            {isGeneratingPDF
              ? "PDF wird erstellt …"
              : isFinalReport ? "Prüfbericht als PDF" : "Zwischenstand als PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
