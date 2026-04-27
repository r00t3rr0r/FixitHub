import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Lock, X, RotateCcw, AlertCircle } from "lucide-react"

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
  const [unlockMethod, setUnlockMethod] = useState<"pattern" | "code" | "nolock" | "noinfo">(
    unlockCode ? "code" : pattern.length > 0 ? "pattern" : "nolock"
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
    setUnlockMethod(method as "pattern" | "code" | "nolock" | "noinfo")

    if (method === "nolock") {
      onNoLockChange(true)
      setSelectedPattern([])
      onPatternChange([])
      onUnlockCodeChange("")
    } else if (method === "noinfo") {
      onNoLockChange(false)
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
    <div className="space-y-3">
      {/* Unlock Method Selection */}
      <div className="space-y-2">
        <RadioGroup
          value={unlockMethod}
          onValueChange={handleUnlockMethodChange}
          className="space-y-2"
        >
          {/* No Lock Option - jetzt als erste Option */}
          <label 
            htmlFor="nolock-method" 
            className="flex items-center space-x-2 p-2 rounded-md border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
          >
            <RadioGroupItem value="nolock" id="nolock-method" />
            <span className="font-medium text-sm" style={{ color: '#2d3748' }}>
              Keine Sperre
            </span>
          </label>

          {/* Pattern Entry Option */}
          <label 
            htmlFor="pattern-method" 
            className="flex items-center space-x-2 p-2 rounded-md border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
          >
            <RadioGroupItem value="pattern" id="pattern-method" />
            <span className="font-medium text-sm" style={{ color: '#2d3748' }}>
              Entsperrmuster
            </span>
          </label>

          {/* Unlock Code Option */}
          <label 
            htmlFor="code-method" 
            className="flex items-center space-x-2 p-2 rounded-md border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
          >
            <RadioGroupItem value="code" id="code-method" />
            <span className="font-medium text-sm" style={{ color: '#2d3748' }}>
              Entsperrcode
            </span>
          </label>

          {/* No Information Option - neue Option */}
          <label 
            htmlFor="noinfo-method" 
            className="flex items-center space-x-2 p-2 rounded-md border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
          >
            <RadioGroupItem value="noinfo" id="noinfo-method" />
            <span className="font-medium text-sm" style={{ color: '#2d3748' }}>
              Ich möchte keine Angaben machen
            </span>
          </label>
        </RadioGroup>
      </div>

      {/* Pattern Input Grid */}
      {unlockMethod === "pattern" && (
        <Card className="p-2.5 sm:p-3 bg-gray-50 border-gray-200">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4" style={{ color: '#1a2a5e' }} />
              <h3 className="font-semibold text-sm" style={{ color: '#1a2a5e' }}>Entsperrmuster eingeben</h3>
            </div>

            {/* 3x3 Pattern Grid */}
            <div className="w-full max-w-[220px] mx-auto">
              <div
                className="grid gap-1.5 sm:gap-2 w-fit mx-auto"
                style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
              >
                {patternDots.flat().map((dot) => (
                  <button
                    key={dot}
                    type="button"
                    onClick={() => handleDotClick(dot)}
                    disabled={noLock}
                    className={`
                      rounded-full border-2 font-semibold text-sm transition-all
                      ${
                        selectedPattern.includes(dot.toString())
                          ? "shadow-md scale-95"
                          : "bg-white hover:shadow-sm"
                      }
                      ${noLock ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
                    `}
                    style={{
                      width: "clamp(2.4rem, 14vw, 3.5rem)",
                      height: "clamp(2.4rem, 14vw, 3.5rem)",
                      borderColor: selectedPattern.includes(dot.toString()) ? '#1a2a5e' : '#d8dce6',
                      backgroundColor: selectedPattern.includes(dot.toString()) ? '#1a2a5e' : '#ffffff',
                      color: selectedPattern.includes(dot.toString()) ? '#ffffff' : '#1a2a5e'
                    }}
                  >
                    {dot}
                  </button>
                ))}
              </div>
            </div>

            {/* Pattern Sequence Display */}
            {selectedPattern.length > 0 && (
              <div className="p-2 rounded-md bg-blue-50 text-center">
                <p className="text-xs text-gray-600 mb-0.5">Entsperrmuster:</p>
                <p className="text-sm font-mono font-semibold break-words" style={{ color: '#1a2a5e' }}>
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
              className="w-full text-xs h-8"
            >
              <RotateCcw className="h-3 w-3 mr-1.5" />
              Zurücksetzen
            </Button>
          </div>
        </Card>
      )}

      {/* Unlock Code Input */}
      {unlockMethod === "code" && (
        <Card className="p-2.5 sm:p-3 bg-gray-50 border-gray-200">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4" style={{ color: '#1a2a5e' }} />
              <h3 className="font-semibold text-sm" style={{ color: '#1a2a5e' }}>Code eingeben</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unlockCode" className="text-xs text-gray-600">PIN / Passwort</Label>
              <Input
                id="unlockCode"
                type="password"
                placeholder="Entsperrcode eingeben"
                value={unlockCode}
                onChange={(e) => onUnlockCodeChange(e.target.value)}
                disabled={noLock}
                className="font-mono text-center tracking-[0.15em] sm:tracking-widest text-base h-10 sm:h-9"
              />
              <p className="text-xs text-gray-500">
                Der Code wird vertraulich behandelt und nur von unseren Technikern verwendet
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* No Lock Info */}
      {unlockMethod === "nolock" && (
        <Card className="p-3 bg-green-50 border-green-200">
          <div className="flex items-start gap-2">
            <X className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm text-green-900 mb-0.5">
                Keine Sperre erforderlich
              </h3>
              <p className="text-xs text-green-700">
                Das Gerät hat keine Sicherheitssperre oder ist bereits entsperrt. Unsere Techniker benötigen keine Entsperrinformationen.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* No Information Warning */}
      {unlockMethod === "noinfo" && (
        <Card className="p-3 bg-amber-50 border-amber-300">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm text-amber-900 mb-1">
                Wichtiger Hinweis zur Garantie
              </h3>
              <p className="text-xs text-amber-800">
                Wenn Sie keine Entsperrinformationen angeben, kann die Reparatur ohne Garantie durchgeführt werden. Unsere Techniker können das Gerät ohne Zugang nicht vollständig testen und die Funktionstüchtigkeit nach der Reparatur nicht garantieren.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
