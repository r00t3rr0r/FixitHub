import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { fetchLabelPdf, saveBlobAsFile } from "@/api/labelPdf"
import { useToast } from "@/hooks/useToast"

/**
 * Laedt eine Datei von einem authentifizierten API-Pfad (z. B. das Reklamations-Versandlabel
 * GET /api/complaints/:id/shipping-label) und speichert sie im Browser. Der Server prueft
 * Besitz bzw. Rolle; es werden nie PDF-Daten in Listen oder Benachrichtigungen mitgeliefert.
 */
export async function downloadAuthorizedFile(url: string, filename: string) {
  // Gemeinsamer, getesteter PDF-Weg (api/labelPdf.ts): Identitaets-Transform statt
  // `transformResponse: undefined` - letzteres faellt in axios auf den JSON-Transform der
  // Instanz zurueck und liess den Download still scheitern (gleiche Ursache wie DHL-2).
  // Prueft die PDF-Signatur und liefert deutsche Fehlermeldungen (403/404/…).
  const blob = await fetchLabelPdf(url, "inbound")
  saveBlobAsFile(blob, filename)
}

export function getComplaintShippingLabelPath(complaintId: string) {
  return `/api/complaints/${complaintId}/shipping-label`
}

export async function downloadComplaintShippingLabel(complaintId: string, complaintNumber?: string) {
  return downloadAuthorizedFile(
    getComplaintShippingLabelPath(complaintId),
    `Versandlabel-${complaintNumber || complaintId}.pdf`
  )
}

type ComplaintLabelDownloadButtonProps = {
  /** Authentifizierter API-Pfad; Standard: Versandlabel der Reklamation */
  url?: string
  complaintId?: string
  complaintNumber?: string
  filename?: string
  label?: string
  className?: string
  variant?: "primary" | "secondary"
  onDownloaded?: () => void
}

/**
 * Sichtbare Primaeraktion "Versandlabel herunterladen" mit Lade- und Fehlerzustand.
 */
export function ComplaintLabelDownloadButton({
  url,
  complaintId,
  complaintNumber,
  filename,
  label = "Versandlabel herunterladen",
  className = "",
  variant = "primary",
  onDownloaded,
}: ComplaintLabelDownloadButtonProps) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const targetUrl = url || (complaintId ? getComplaintShippingLabelPath(complaintId) : "")
  const targetName = filename || `Versandlabel-${complaintNumber || complaintId || "Reklamation"}.pdf`

  const baseStyle =
    variant === "primary"
      ? "bg-[#1a2a5e] text-white hover:bg-[#2a3f7e] border border-[#1a2a5e]"
      : "bg-white text-[#1a2a5e] hover:bg-[#eef3ff] border border-[#1a2a5e]"

  return (
    <button
      type="button"
      disabled={busy || !targetUrl}
      aria-busy={busy}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${baseStyle} ${className}`}
      onClick={async (event) => {
        event.stopPropagation()
        if (!targetUrl) return
        try {
          setBusy(true)
          await downloadAuthorizedFile(targetUrl, targetName)
          onDownloaded?.()
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Versandlabel konnte nicht geladen werden",
            description: error?.message || "Bitte versuchen Sie es erneut.",
          })
        } finally {
          setBusy(false)
        }
      }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {busy ? "Wird geladen …" : label}
    </button>
  )
}
