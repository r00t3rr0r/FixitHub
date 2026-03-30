import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/useToast"
import {
  Send,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Lock,
  Shield,
  MessageSquare,
} from "lucide-react"

interface ConfirmUnlockDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (
    confirmationStatus: "verified" | "incorrect" | "unable-to-verify",
    notes: string,
    requestFromCustomer?: boolean
  ) => Promise<void>
  unlockPattern?: string[]
  unlockCode?: string
  noLock?: boolean
  isLoading?: boolean
  orderId?: string
  onOpenContactCustomer?: () => void
}

type VerificationStatus = "verified" | "incorrect" | "unable-to-verify"

const STATUS_OPTIONS: {
  value: VerificationStatus
  labelKey: string
  labelFallback: string
  descKey: string
  descFallback: string
  icon: React.ElementType
  colorClass: string
  activeClass: string
}[] = [
  {
    value: "verified",
    labelKey: "orderDetails.verified",
    labelFallback: "Verifiziert",
    descKey: "orderDetails.verifiedDesc",
    descFallback: "Entsperrcode/-muster korrekt und verifiziert",
    icon: CheckCircle2,
    colorClass: "cudlg-status-verified",
    activeClass: "cudlg-status-verified--active",
  },
  {
    value: "incorrect",
    labelKey: "orderDetails.incorrect",
    labelFallback: "Falsch",
    descKey: "orderDetails.incorrectDesc",
    descFallback: "Die angegebene Entsperrinformation ist nicht korrekt",
    icon: XCircle,
    colorClass: "cudlg-status-incorrect",
    activeClass: "cudlg-status-incorrect--active",
  },
  {
    value: "unable-to-verify",
    labelKey: "orderDetails.unableToVerify",
    labelFallback: "Nicht verifizierbar",
    descKey: "orderDetails.unableToVerifyDesc",
    descFallback: "Entsperrinformation konnte nicht überprüft werden",
    icon: HelpCircle,
    colorClass: "cudlg-status-unable",
    activeClass: "cudlg-status-unable--active",
  },
]

export function ConfirmUnlockDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  unlockPattern = [],
  unlockCode = "",
  noLock = false,
  isLoading = false,
  orderId,
  onOpenContactCustomer,
}: ConfirmUnlockDialogProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [confirmationStatus, setConfirmationStatus] =
    useState<VerificationStatus>("verified")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [requestingFromCustomer, setRequestingFromCustomer] = useState(false)
  const [codeHidden, setCodeHidden] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)

  const busy = submitting || isLoading
  const showActionPanel =
    confirmationStatus === "incorrect" ||
    confirmationStatus === "unable-to-verify"

  const handleConfirm = async () => {
    try {
      setSubmitting(true)
      await onConfirm(confirmationStatus, notes, requestingFromCustomer)
      toast({
        title: t("common.success", "Erfolg"),
        description: requestingFromCustomer
          ? t(
              "orderDetails.unlockRequestSent",
              "Anfrage wurde an den Kunden gesendet"
            )
          : t(
              "orderDetails.unlockConfirmationSuccess",
              "Entsperrbestätigung erfolgreich gespeichert"
            ),
        variant: "default",
      })
      setConfirmationStatus("verified")
      setNotes("")
      setRequestingFromCustomer(false)
      setCodeHidden(false)
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: t("common.error", "Fehler"),
        description:
          error.message ||
          t(
            "orderDetails.unlockConfirmationError",
            "Bestätigung konnte nicht gespeichert werden"
          ),
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleContactCustomer = () => {
    if (onOpenContactCustomer) {
      onOpenContactCustomer()
      onOpenChange(false)
    }
  }

  const handleCopyCode = async () => {
    if (!unlockCode) return
    try {
      await navigator.clipboard.writeText(unlockCode)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      toast({
        title: t("common.error", "Fehler"),
        description: t("orderDetails.copyFailed", "Kopieren fehlgeschlagen"),
        variant: "destructive",
      })
    }
  }

  const hasUnlockInfo =
    unlockPattern.length > 0 || Boolean(unlockCode) || noLock

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="order-dialog-content cudlg-content">
        {/* ── Header ── */}
        <DialogHeader className="order-dialog-header cudlg-header">
          <div className="cudlg-header-inner">
            <div className="cudlg-header-icon">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="cudlg-title">
                {t("orderDetails.confirmUnlockCode", "Entsperrinfo bestätigen")}
              </DialogTitle>
              <DialogDescription className="cudlg-subtitle">
                {t(
                  "orderDetails.confirmUnlockDesc",
                  "Entsperr­information des Geräts prüfen und Status festlegen"
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* ── Body ── */}
        <div className="cudlg-body">
          {/* Unlock Info Display */}
          {hasUnlockInfo && (
            <div className="cudlg-unlock-card">
              <div className="cudlg-unlock-card-label">
                <Lock className="h-3.5 w-3.5" />
                {t("orderDetails.currentUnlockInfo", "Aktuelle Entsperr­information")}
              </div>

              {/* Pattern */}
              {unlockPattern.length > 0 && (
                <div className="cudlg-unlock-row">
                  <span className="cudlg-unlock-type-badge">
                    {t("orderDetails.pattern", "Muster")}
                  </span>
                  <span className="cudlg-unlock-value cudlg-unlock-value--pattern">
                    {unlockPattern.join(" → ")}
                  </span>
                </div>
              )}

              {/* Code */}
              {unlockCode && (
                <div className="cudlg-unlock-row">
                  <span className="cudlg-unlock-type-badge">
                    {t("orderDetails.code", "Code")}
                  </span>
                  <span
                    className={`cudlg-unlock-value cudlg-unlock-value--code ${
                      codeHidden ? "cudlg-unlock-value--hidden" : ""
                    }`}
                  >
                    {codeHidden
                      ? "•".repeat(Math.max(unlockCode.length, 6))
                      : unlockCode}
                  </span>
                  <div className="cudlg-unlock-actions">
                    <button
                      type="button"
                      className="cudlg-icon-btn"
                      onClick={() => setCodeHidden((h) => !h)}
                      title={
                        codeHidden
                          ? t("common.show", "Anzeigen")
                          : t("common.hide", "Ausblenden")
                      }
                    >
                      {codeHidden ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      className={`cudlg-icon-btn ${codeCopied ? "cudlg-icon-btn--copied" : ""}`}
                      onClick={handleCopyCode}
                      title={t("common.copy", "Kopieren")}
                    >
                      {codeCopied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* No Lock */}
              {noLock && (
                <div className="cudlg-unlock-row cudlg-unlock-row--nolock">
                  <CheckCircle2 className="h-4 w-4 cudlg-nolock-icon" />
                  <span>
                    {t("orderDetails.deviceHasNoLock", "Gerät hat keine Sperre")}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Status Selection */}
          <div className="cudlg-section">
            <p className="cudlg-section-label">
              {t("orderDetails.verificationStatus", "Verifizierungsstatus")}
            </p>
            <div className="cudlg-status-grid">
              {STATUS_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const active = confirmationStatus === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`cudlg-status-card ${opt.colorClass} ${active ? opt.activeClass : ""}`}
                    onClick={() => setConfirmationStatus(opt.value)}
                    disabled={busy}
                  >
                    <div className="cudlg-status-card-icon">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="cudlg-status-card-text">
                      <span className="cudlg-status-card-title">
                        {t(opt.labelKey, opt.labelFallback)}
                      </span>
                      <span className="cudlg-status-card-desc">
                        {t(opt.descKey, opt.descFallback)}
                      </span>
                    </div>
                    {active && (
                      <div className="cudlg-status-card-check">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="cudlg-section">
            <label htmlFor="cudlg-notes" className="cudlg-section-label">
              <MessageSquare className="h-3.5 w-3.5" />
              {t("orderDetails.confirmationNotes", "Notizen")}{" "}
              <span className="cudlg-optional">
                ({t("common.optional", "optional")})
              </span>
            </label>
            <Textarea
              id="cudlg-notes"
              placeholder={t(
                "orderDetails.confirmationNotesPlaceholder",
                "Zusätzliche Hinweise zur Entsperrverifizierung …"
              )}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={busy}
              className="cudlg-notes"
            />
          </div>

          {/* Action Panel for incorrect / unable */}
          {showActionPanel && (
            <div
              className={`cudlg-action-panel ${
                confirmationStatus === "incorrect"
                  ? "cudlg-action-panel--red"
                  : "cudlg-action-panel--amber"
              }`}
            >
              <div className="cudlg-action-panel-row">
                <AlertCircle className="h-4 w-4 cudlg-action-panel-icon" />
                <div>
                  <p className="cudlg-action-panel-title">
                    {confirmationStatus === "incorrect"
                      ? t(
                          "orderDetails.incorrectActionNeeded",
                          "Falscher Code — Aktion erforderlich"
                        )
                      : t(
                          "orderDetails.unableToVerifyActionNeeded",
                          "Nicht verifizierbar — Aktion erforderlich"
                        )}
                  </p>
                  <p className="cudlg-action-panel-desc">
                    {t(
                      "orderDetails.requestUnlockFromCustomer",
                      "Entsperrinformation direkt beim Kunden anfordern"
                    )}
                  </p>
                </div>
              </div>
              <div className="cudlg-action-panel-btns">
                {onOpenContactCustomer && (
                  <button
                    type="button"
                    className="cudlg-contact-btn"
                    onClick={handleContactCustomer}
                    disabled={busy}
                  >
                    <Send className="h-3.5 w-3.5" />
                    {t("orderDetails.contactCustomer", "Kunden kontaktieren")}
                  </button>
                )}
                <label className="cudlg-request-label">
                  <input
                    type="checkbox"
                    checked={requestingFromCustomer}
                    onChange={(e) => setRequestingFromCustomer(e.target.checked)}
                    disabled={busy}
                    className="cudlg-request-checkbox"
                  />
                  {t("orderDetails.markAsRequested", "Als angefordert markieren")}
                </label>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <DialogFooter className="cudlg-footer">
          <Button
            variant="outline"
            className="cudlg-btn-cancel"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {t("common.cancel", "Abbrechen")}
          </Button>
          <button
            type="button"
            className="cudlg-btn-confirm"
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? (
              <>
                <span className="cudlg-spinner" />
                {t("common.loading", "Wird gespeichert …")}
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {t("orderDetails.confirmButton", "Bestätigen")}
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
