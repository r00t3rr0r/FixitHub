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

interface ConfirmUnlockDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (confirmationStatus: 'verified' | 'incorrect' | 'unable-to-verify', notes: string) => Promise<void>
  unlockPattern?: string[]
  unlockCode?: string
  noLock?: boolean
  isLoading?: boolean
}

// Description: Dialog component for admin/staff to confirm device unlock code or pattern
// Component: ConfirmUnlockDialog
// Props: isOpen, onOpenChange, onConfirm, unlockPattern, unlockCode, noLock, isLoading
// Renders: Modal dialog with confirmation options and notes field
export function ConfirmUnlockDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  unlockPattern = [],
  unlockCode = "",
  noLock = false,
  isLoading = false
}: ConfirmUnlockDialogProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [confirmationStatus, setConfirmationStatus] = useState<'verified' | 'incorrect' | 'unable-to-verify'>('verified')
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    try {
      setSubmitting(true)
      await onConfirm(confirmationStatus, notes)

      toast({
        title: t('common.success', 'Success'),
        description: t('orderDetails.unlockConfirmationSuccess', 'Unlock confirmation recorded successfully'),
        variant: "default"
      })

      // Reset form and close dialog
      setConfirmationStatus('verified')
      setNotes("")
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
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
              {t('orderDetails.currentUnlockInfo', 'Current Unlock Information')}
            </p>
            <div className="space-y-1 text-sm text-slate-700 dark:text-slate-400">
              {unlockPattern.length > 0 && (
                <p>
                  <span className="font-mono">{unlockPattern.join(' → ')}</span>{' '}
                  <span className="text-xs text-slate-500">({t('orderDetails.pattern', 'Pattern')})</span>
                </p>
              )}
              {unlockCode && (
                <p>
                  <span className="font-mono">••••••••</span>{' '}
                  <span className="text-xs text-slate-500">({t('orderDetails.code', 'Code')})</span>
                </p>
              )}
              {noLock && (
                <p className="text-green-700 dark:text-green-300">
                  ✓ {t('orderDetails.deviceHasNoLock', 'Device has no lock')}
                </p>
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
              disabled={submitting || isLoading}
              className="resize-none h-24"
            />
          </div>
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
