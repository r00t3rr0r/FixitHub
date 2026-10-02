import * as React from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { formatDecimalInput, parseDecimalInput } from "@/lib/parseDecimalInput"

/**
 * Zahlenfeld fuer Betraege/Quoten, das "12,50" und "12.50" gleichermassen annimmt.
 *
 * Ersetzt <Input type="number" value={zahl} onChange={parseFloat}>: Dort schreibt React
 * Zwischenstaende ("12." / "0,0") sofort als Zahl zurueck und verliert in deutschem
 * Chrome Trennzeichen und Ziffern (SP-9: "12.50" -> 50, "0,02" -> 2). Hier bleibt der
 * eingegebene Text im Feld; nach aussen geht nur eine gueltige Zahl (oder emptyValue
 * bei leerem Feld). Beim Verlassen wird der Text deutsch formatiert ("12,5").
 */
export interface DecimalInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "min" | "max"> {
  value: number | null | undefined
  onValueChange: (value: number | null) => void
  /** Wert, der bei leerem Feld gemeldet wird (Standard: null). */
  emptyValue?: number | null
  min?: number
  max?: number
  maximumFractionDigits?: number
}

export const DecimalInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
  ({ value, onValueChange, emptyValue = null, min, max, maximumFractionDigits = 4, className, onBlur, onFocus, ...props }, ref) => {
    const [draft, setDraft] = React.useState(() => formatDecimalInput(value ?? null, maximumFractionDigits))
    const focusedRef = React.useRef(false)

    // Externe Aenderungen uebernehmen, solange der Nutzer nicht gerade tippt.
    React.useEffect(() => {
      if (focusedRef.current) return
      const parsed = parseDecimalInput(draft)
      const external = value ?? null
      if (parsed !== external) {
        setDraft(formatDecimalInput(external, maximumFractionDigits))
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, maximumFractionDigits])

    const parsed = parseDecimalInput(draft)
    const outOfRange = parsed !== null && ((min !== undefined && parsed < min) || (max !== undefined && parsed > max))
    const invalid = draft.trim() !== "" && (parsed === null || outOfRange)

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={draft}
        aria-invalid={invalid || undefined}
        className={cn(invalid && "border-red-500 focus-visible:ring-red-500", className)}
        onFocus={(event) => {
          focusedRef.current = true
          onFocus?.(event)
        }}
        onChange={(event) => {
          const text = event.target.value
          setDraft(text)
          if (text.trim() === "") {
            onValueChange(emptyValue)
            return
          }
          const next = parseDecimalInput(text)
          if (next === null) return
          if (min !== undefined && next < min) return
          if (max !== undefined && next > max) return
          onValueChange(next)
        }}
        onBlur={(event) => {
          focusedRef.current = false
          if (!invalid) {
            const current = parseDecimalInput(draft)
            setDraft(current === null ? "" : formatDecimalInput(current, maximumFractionDigits))
          } else {
            // Ungueltiger Text wird nie gespeichert: Feld zeigt danach den Wert, der wirklich gilt
            // (letzter gueltiger Wert des Formulars), statt eines abweichenden Texts.
            setDraft(formatDecimalInput(value ?? null, maximumFractionDigits))
          }
          onBlur?.(event)
        }}
        {...props}
        title={invalid ? "Ungültige Zahl – bitte z. B. 12,50 eingeben" : props.title}
      />
    )
  }
)
DecimalInput.displayName = "DecimalInput"
