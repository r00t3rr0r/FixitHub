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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/useToast"
import { Send, AlertCircle, Eye, EyeOff, Copy, Check } from "lucide-react"

interface ConfirmUnlockDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (confirmationStatus: 'verified' | 'incorrect' | 'unable-to-verify', notes: string, requestFromCustomer?: boolean) => Promise<void>
  unlockPattern?: string[]
  unlockCode?: string
  noLock?: boolean
  isLoading?: boolean
  orderId?: string
  onOpenContactCustomer?: () => void
}

// Description: Dialog component for admin/staff to confirm device unlock code or pattern
// Component: ConfirmUnlockDialog
// Props: isOpen, onOpenChange, onConfirm, unlockPattern, unlockCode, noLock, isLoading, orderId, onOpenContactCustomer
// Renders: Modal dialog with confirmation options, notes field, and request from customer feature
export function ConfirmUnlockDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  unlockPattern = [],
  unlockCode = "",
  noLock = false,
  isLoading = false,
  orderId,
  onOpenContactCustomer
}: ConfirmUnlockDialogProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [confirmationStatus, setConfirmationStatus] = useState<'verified' | 'incorrect' | 'unable-to-verify'>('verified')
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [requestingFromCustomer, setRequestingFromCustomer] = useState(false)
  const [showUnlockCode, setShowUnlockCode] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)

  const handleConfirm = async () => {
    try {
      setSubmitting(true)
      await onConfirm(confirmationStatus, notes, requestingFromCustomer)

      toast({
        title: t('common.success', 'Success'),
        description: requestingFromCustomer
          ? t('orderDetails.unlockRequestSent', 'Unlock verification request sent to customer')
          : t('orderDetails.unlockConfirmationSuccess', 'Unlock confirmation recorded successfully'),
        variant: "default"
      })

      // Reset form and close dialog
      setConfirmationStatus('verified')
      setNotes("")
      setRequestingFromCustomer(false)
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: t('common.error', 'Error'),
        description: error.message || t('orderDetails.unlockConfirmationError', 'Failed to confirm unlock'),
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRequestFromCustomer = () => {
    if (onOpenContactCustomer) {
      onOpenContactCustomer()
      onOpenChange(false)
    }
  }

  const handleCopyCode = async () => {
    if (unlockCode) {
      try {
        await navigator.clipboard.writeText(unlockCode)
        setCodeCopied(true)
        setTimeout(() => setCodeCopied(false), 2000)
        toast({
          title: t('common.success', 'Success'),
          description: t('orderDetails.codecopied', 'Unlock code copied to clipboard'),
          variant: "default"
        })
      } catch (error) {
        toast({
          title: t('common.error', 'Error'),
          description: t('orderDetails.copyFailed', 'Failed to copy code'),
          variant: "destructive"
        })
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('orderDetails.confirmUnlockCode', 'Confirm Unlock Information')}
          </DialogTitle>
          <DialogDescription>
            {t('orderDetails.confirmUnlockDesc', 'Verify the device unlock information provided by the customer')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Display Current Unlock Information */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-3">
              {t('orderDetails.currentUnlockInfo', 'Current Unlock Information')}
            </p>
            <div className="space-y-3 text-sm text-slate-700 dark:text-slate-400">
              {unlockPattern.length > 0 && (
                <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600">
                  <div>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{unlockPattern.join(' → ')}</span>{' '}
                    <span className="text-xs text-slate-500">({t('orderDetails.pattern', 'Pattern')})</span>
                  </div>
                </div>
              )}
              {unlockCode && (
                <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600 gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {showUnlockCode ? unlockCode : '••••••••'}
                    </span>
                    <span className="text-xs text-slate-500">({t('orderDetails.code', 'Code')})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowUnlockCode(!showUnlockCode)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      title={showUnlockCode ? 'Hide code' : 'Show code'}
                    >
                      {showUnlockCode ? (
                        <EyeOff className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      title="Copy code"
                    >
                      {codeCopied ? (
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <Copy className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>
              )}
              {noLock && (
                <div className="p-2 bg-white dark:bg-slate-800 rounded border border-green-200 dark:border-green-900 text-green-700 dark:text-green-300">
                  ✓ {t('orderDetails.deviceHasNoLock', 'Device has no lock')}
                </div>
              )}
            </div>
          </div>

          {/* Confirmation Status Options */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">
              {t('orderDetails.verificationStatus', 'Verification Status')}
            </Label>
            <RadioGroup
              value={confirmationStatus}
              onValueChange={(value: any) => setConfirmationStatus(value)}
              className="space-y-3"
            >
              {/* Verified Option */}
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-green-300 dark:hover:border-green-700 transition-colors cursor-pointer">
                <RadioGroupItem value="verified" id="verified-status" className="mt-1" />
                <div className="flex-1">
                  <Label
                    htmlFor="verified-status"
                    className="font-medium cursor-pointer text-green-700 dark:text-green-300"
                  >
                    {t('orderDetails.verified', 'Verified')}
                  </Label>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {t('orderDetails.verifiedDesc', 'The unlock information is correct and verified')}
                  </p>
                </div>
              </div>

              {/* Incorrect Option */}
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-700 transition-colors cursor-pointer">
                <RadioGroupItem value="incorrect" id="incorrect-status" className="mt-1" />
                <div className="flex-1">
                  <Label
                    htmlFor="incorrect-status"
                    className="font-medium cursor-pointer text-red-700 dark:text-red-300"
                  >
                    {t('orderDetails.incorrect', 'Incorrect')}
                  </Label>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {t('orderDetails.incorrectDesc', 'The unlock information provided is incorrect')}
                  </p>
                </div>
              </div>

              {/* Unable to Verify Option */}
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-700 transition-colors cursor-pointer">
                <RadioGroupItem value="unable-to-verify" id="unable-status" className="mt-1" />
                <div className="flex-1">
                  <Label
                    htmlFor="unable-status"
                    className="font-medium cursor-pointer text-orange-700 dark:text-orange-300"
                  >
                    {t('orderDetails.unableToVerify', 'Unable to Verify')}
                  </Label>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {t('orderDetails.unableToVerifyDesc', 'Could not verify the unlock information')}
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Notes Field */}
          <div className="space-y-2">
            <Label htmlFor="confirmation-notes">
              {t('orderDetails.confirmationNotes', 'Confirmation Notes')} ({t('common.optional', 'Optional')})
            </Label>
            <Textarea
              id="confirmation-notes"
              placeholder={t('orderDetails.confirmationNotesPlaceholder', 'Add any additional notes about the unlock verification...')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting || isLoading || requestingFromCustomer}
              className="resize-none h-20"
            />
          </div>

          {/* Request From Customer Option - for both Incorrect and Unable to Verify */}
          {(confirmationStatus === 'unable-to-verify' || confirmationStatus === 'incorrect') && (
            <div className={`p-4 rounded-lg border space-y-3 ${
              confirmationStatus === 'unable-to-verify'
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
                : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900'
            }`}>
              <div className="flex items-start gap-2">
                <AlertCircle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                  confirmationStatus === 'unable-to-verify'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
                }`} />
                <div>
                  <p className={`text-sm font-medium ${
                    confirmationStatus === 'unable-to-verify'
                      ? 'text-amber-900 dark:text-amber-100'
                      : 'text-red-900 dark:text-red-100'
                  }`}>
                    {confirmationStatus === 'unable-to-verify'
                      ? t('orderDetails.unableToVerifyActionNeeded', 'Action Needed')
                      : t('orderDetails.incorrectActionNeeded', 'Incorrect Code - Action Needed')}
                  </p>
                  <p className={`text-sm mt-1 ${
                    confirmationStatus === 'unable-to-verify'
                      ? 'text-amber-800 dark:text-amber-200'
                      : 'text-red-800 dark:text-red-200'
                  }`}>
                    {t('orderDetails.requestUnlockFromCustomer', 'You can request the unlock information directly from the customer via message')}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRequestFromCustomer}
                  disabled={submitting || isLoading || !onOpenContactCustomer}
                  className="flex-1"
                >
                  <Send className="h-3 w-3 mr-1" />
                  {t('orderDetails.contactCustomer', 'Contact Customer')}
                </Button>
                <label className={`flex items-center gap-2 px-3 py-2 rounded border text-sm font-medium cursor-pointer ${
                  confirmationStatus === 'unable-to-verify'
                    ? 'border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                    : 'border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20'
                }`}>
                  <input
                    type="checkbox"
                    checked={requestingFromCustomer}
                    onChange={(e) => setRequestingFromCustomer(e.target.checked)}
                    disabled={submitting || isLoading}
                    className="rounded"
                  />
                  {t('orderDetails.markAsRequested', 'Mark as Requested')}
                </label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting || isLoading}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={submitting || isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {submitting || isLoading ? t('common.loading', 'Loading...') : t('orderDetails.confirmButton', 'Confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
