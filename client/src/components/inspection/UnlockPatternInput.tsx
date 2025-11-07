import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Lock, X, RotateCcw } from "lucide-react"

interface UnlockPatternInputProps {
  onPatternChange: (pattern: string[]) => void
  onUnlockCodeChange: (code: string) => void
  onNoLockChange: (noLock: boolean) => void
  noLock?: boolean
  pattern?: string[]
  unlockCode?: string
}

// Description: Visual unlock pattern input component for device lock screen patterns
// Component: UnlockPatternInput
// Props: onPatternChange, onUnlockCodeChange, onNoLockChange, noLock, pattern, unlockCode
// Renders: 3x3 grid for pattern entry, unlock code input, and no-lock option
export function UnlockPatternInput({
  onPatternChange,
  onUnlockCodeChange,
  onNoLockChange,
  noLock = false,
  pattern = [],
  unlockCode = ""
}: UnlockPatternInputProps) {
  const [selectedPattern, setSelectedPattern] = useState<string[]>(pattern)
  const [unlockMethod, setUnlockMethod] = useState<"pattern" | "code" | "nolock">(
    noLock ? "nolock" : unlockCode ? "code" : "pattern"
  )

  const patternDots = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9]
  ]

  const handleDotClick = (dot: number) => {
    if (unlockMethod !== "pattern" || noLock) return

    const dotStr = dot.toString()
    const newPattern = selectedPattern.includes(dotStr)
      ? selectedPattern.filter(d => d !== dotStr)
      : [...selectedPattern, dotStr]

    setSelectedPattern(newPattern)
    onPatternChange(newPattern)
  }

  const handleResetPattern = () => {
    setSelectedPattern([])
    onPatternChange([])
  }

  const handleUnlockMethodChange = (method: string) => {
    setUnlockMethod(method as "pattern" | "code" | "nolock")

    if (method === "nolock") {
      onNoLockChange(true)
      setSelectedPattern([])
      onPatternChange([])
      onUnlockCodeChange("")
    } else if (method === "pattern") {
      onNoLockChange(false)
      onUnlockCodeChange("")
    } else if (method === "code") {
      onNoLockChange(false)
      setSelectedPattern([])
      onPatternChange([])
    }
  }

  return (
    <div className="space-y-6">
      {/* Unlock Method Selection */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Device Lock Status</Label>
        <RadioGroup
          value={unlockMethod}
          onValueChange={handleUnlockMethodChange}
          className="space-y-3"
        >
          {/* Pattern Entry Option */}
          <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
            <RadioGroupItem value="pattern" id="pattern-method" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="pattern-method" className="font-medium cursor-pointer">
                Device Has Pattern Lock
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Enter the unlock pattern by clicking the dots in sequence
              </p>
            </div>
          </div>

          {/* Unlock Code Option */}
          <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
            <RadioGroupItem value="code" id="code-method" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="code-method" className="font-medium cursor-pointer">
                Device Has Unlock Code
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Enter PIN, pattern, or passcode as text
              </p>
            </div>
          </div>

          {/* No Lock Option */}
          <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
            <RadioGroupItem value="nolock" id="nolock-method" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="nolock-method" className="font-medium cursor-pointer">
                Device Has No Lock
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Device has no security lock or unlocked already
              </p>
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* Pattern Input Grid */}
      {unlockMethod === "pattern" && (
        <Card className="p-6 bg-gradient-to-br from-primary/5 to-secondary/5">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Enter Pattern</h3>
              <span className="text-xs text-muted-foreground ml-auto">
                {selectedPattern.length} dot{selectedPattern.length !== 1 ? "s" : ""} selected
              </span>
            </div>

            {/* 3x3 Pattern Grid */}
            <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto">
              {patternDots.flat().map((dot) => (
                <button
                  key={dot}
                  type="button"
                  onClick={() => handleDotClick(dot)}
                  disabled={noLock}
                  className={`
                    w-16 h-16 rounded-full border-2 font-bold text-lg transition-all
                    ${
                      selectedPattern.includes(dot.toString())
                        ? "border-primary bg-primary text-primary-foreground shadow-lg scale-95"
                        : "border-primary/30 bg-background hover:border-primary/60 hover:shadow-md"
                    }
                    ${noLock ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
                  `}
                >
                  {dot}
                </button>
              ))}
            </div>

            {/* Pattern Sequence Display */}
            {selectedPattern.length > 0 && (
              <div className="p-3 rounded-lg bg-secondary/10 text-center">
                <p className="text-sm text-muted-foreground mb-1">Pattern sequence:</p>
                <p className="text-lg font-mono font-bold text-primary">
                  {selectedPattern.join(" → ")}
                </p>
              </div>
            )}

            {/* Reset Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetPattern}
              disabled={selectedPattern.length === 0 || noLock}
              className="w-full"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Pattern
            </Button>
          </div>
        </Card>
      )}

      {/* Unlock Code Input */}
      {unlockMethod === "code" && (
        <Card className="p-6 bg-gradient-to-br from-primary/5 to-secondary/5">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Enter Unlock Code</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unlockCode">Unlock Code / PIN / Passcode</Label>
              <Input
                id="unlockCode"
                type="password"
                placeholder="Enter the device unlock code"
                value={unlockCode}
                onChange={(e) => onUnlockCodeChange(e.target.value)}
                disabled={noLock}
                className="font-mono text-center tracking-widest"
              />
              <p className="text-xs text-muted-foreground">
                This code will be kept confidential and only used by our technicians
              </p>
            </div>

            {/* Show/Hide Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={noLock}
            >
              Show Code
            </Button>
          </div>
        </Card>
      )}

      {/* No Lock Info */}
      {unlockMethod === "nolock" && (
        <Card className="p-6 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <div className="flex items-start gap-3">
            <X className="h-5 w-5 text-green-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                No Lock Required
              </h3>
              <p className="text-sm text-green-800 dark:text-green-200">
                The device has no security lock or is already unlocked. Our technicians will not need to enter any unlock codes or patterns.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
