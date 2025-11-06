import { Button } from "@/components/ui/button"
import { Package, AlertCircle, Lock, DollarSign } from "lucide-react"

interface QuickActionButtonsProps {
  onPartReplacement: () => void
  onIncorrectDevice: () => void
  onIncorrectUnlockCode: () => void
  onAdditionalCosts: () => void
  isLoading?: boolean
}

export function QuickActionButtons({
  onPartReplacement,
  onIncorrectDevice,
  onIncorrectUnlockCode,
  onAdditionalCosts,
  isLoading = false,
}: QuickActionButtonsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Button
        variant="outline"
        onClick={onPartReplacement}
        disabled={isLoading}
        className="flex items-center gap-2 justify-start h-auto py-3"
      >
        <Package className="w-4 h-4" />
        <span>Part Replacement</span>
      </Button>

      <Button
        variant="outline"
        onClick={onIncorrectDevice}
        disabled={isLoading}
        className="flex items-center gap-2 justify-start h-auto py-3"
      >
        <AlertCircle className="w-4 h-4" />
        <span>Incorrect Device</span>
      </Button>

      <Button
        variant="outline"
        onClick={onIncorrectUnlockCode}
        disabled={isLoading}
        className="flex items-center gap-2 justify-start h-auto py-3"
      >
        <Lock className="w-4 h-4" />
        <span>Incorrect Unlock Code</span>
      </Button>

      <Button
        variant="outline"
        onClick={onAdditionalCosts}
        disabled={isLoading}
        className="flex items-center gap-2 justify-start h-auto py-3"
      >
        <DollarSign className="w-4 h-4" />
        <span>Additional Costs</span>
      </Button>
    </div>
  )
}
