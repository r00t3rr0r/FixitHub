import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Lock, CheckCircle, AlertCircle, HelpCircle, X } from "lucide-react"
import { UnlockPatternVisual } from "@/components/inspection/UnlockPatternVisual"

interface UnlockConfirmation {
  confirmedBy?: string
  confirmedByName?: string
  confirmedAt?: string
  confirmationStatus?: 'verified' | 'incorrect' | 'unable-to-verify'
  notes?: string
}

interface UnlockInformationDisplayProps {
  unlockPattern?: string[]
  unlockCode?: string
  noLock?: boolean
  unlockConfirmation?: UnlockConfirmation
  onConfirmClick?: () => void
  canConfirm?: boolean
}

// Description: Display device unlock information prominently on Order Details page
// Component: UnlockInformationDisplay
// Props: unlockPattern, unlockCode, noLock, unlockConfirmation, onConfirmClick, canConfirm
// Renders: Card with unlock information and confirmation status
export function UnlockInformationDisplay({
  unlockPattern = [],
  unlockCode = "",
  noLock = false,
  unlockConfirmation,
  onConfirmClick,
  canConfirm = false
}: UnlockInformationDisplayProps) {
  const { t } = useTranslation()

  // Helper function to get confirmation status badge
  const getConfirmationBadge = () => {
    if (!unlockConfirmation?.confirmationStatus) {
      return (
        <Badge variant="outline" className="bg-yellow-50 border-yellow-300 text-yellow-800">
          <HelpCircle className="h-3 w-3 mr-1" />
          {t('orderDetails.unlockNotConfirmed', 'Not Confirmed')}
        </Badge>
      )
    }

    switch (unlockConfirmation.confirmationStatus) {
      case 'verified':
        return (
          <Badge className="bg-green-100 border-green-300 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            {t('orderDetails.unlockVerified', 'Verified')}
          </Badge>
        )
      case 'incorrect':
        return (
          <Badge className="bg-red-100 border-red-300 text-red-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            {t('orderDetails.unlockIncorrect', 'Incorrect')}
          </Badge>
        )
      case 'unable-to-verify':
        return (
          <Badge variant="outline" className="bg-gray-50 border-gray-300 text-gray-800">
            <HelpCircle className="h-3 w-3 mr-1" />
            {t('orderDetails.unlockUnableToVerify', 'Unable to Verify')}
          </Badge>
        )
      default:
        return null
    }
  }

  // If no unlock information provided, return null
  if (!unlockPattern.length && !unlockCode && !noLock) {
    return null
  }

  return (
    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-1" />
            <div>
              <CardTitle className="text-lg">
                {t('orderDetails.deviceLockInformation', 'Device Lock Information')}
              </CardTitle>
              <CardDescription>
                {t('orderDetails.deviceLockDesc', 'Unlock information collected during order creation')}
              </CardDescription>
            </div>
          </div>
          <div className="text-right">
            {getConfirmationBadge()}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Unlock Pattern Display */}
        {unlockPattern.length > 0 && (
          <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-900">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
              {t('orderDetails.unlockPattern', 'Unlock Pattern')}
            </p>
            <div className="flex flex-col items-center gap-1">
              <UnlockPatternVisual pattern={unlockPattern} size={150} />
              <span className="text-xs text-slate-500">
                ({unlockPattern.length} {t('orderDetails.dots', 'dots')})
              </span>
            </div>
          </div>
        )}

        {/* Unlock Code Display */}
        {unlockCode && (
          <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-900">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
              {t('orderDetails.unlockCode', 'Unlock Code')}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={unlockCode}
                readOnly
                className="flex-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono text-sm"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {t('orderDetails.unlockCodeConfidential', 'Code is kept confidential')}
            </p>
          </div>
        )}

        {/* No Lock Display */}
        {noLock && (
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
            <div className="flex items-center gap-2">
              <X className="h-4 w-4 text-green-600 dark:text-green-400" />
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                {t('orderDetails.unlockNoLock', 'Device has no lock')}
              </p>
            </div>
          </div>
        )}

        {/* Confirmation Status */}
        {unlockConfirmation && (
          <div className="mt-4 pt-4 border-t border-blue-100 dark:border-blue-900">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
              {t('orderDetails.confirmationStatus', 'Confirmation Status')}
            </p>
            <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
              <p>
                <span className="font-medium">
                  {t('orderDetails.confirmedBy', 'Confirmed by:')}
                </span>{' '}
                {unlockConfirmation.confirmedByName}
              </p>
              <p>
                <span className="font-medium">
                  {t('orderDetails.confirmedAt', 'Confirmed at:')}
                </span>{' '}
                {unlockConfirmation.confirmedAt
                  ? new Date(unlockConfirmation.confirmedAt).toLocaleString()
                  : 'N/A'}
              </p>
              {unlockConfirmation.notes && (
                <p>
                  <span className="font-medium">
                    {t('orderDetails.notes', 'Notes:')}
                  </span>{' '}
                  {unlockConfirmation.notes}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Confirm Button - Only show if user is admin/staff and not yet confirmed or can re-confirm */}
        {canConfirm && onConfirmClick && (
          <div className="mt-4 pt-4 border-t border-blue-100 dark:border-blue-900">
            <button
              onClick={onConfirmClick}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {unlockConfirmation
                ? t('orderDetails.updateConfirmation', 'Update Confirmation')
                : t('orderDetails.confirmUnlock', 'Confirm Unlock Information')}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
