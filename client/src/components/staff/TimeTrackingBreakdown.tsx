import { CalendarDays, Coffee, Timer } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface TimeTrackingBreakItem {
  startTime: string | Date
  endTime?: string | Date | null
  durationHours: number
  reason?: string
}

interface TimeTrackingOrderItem {
  orderId?: string | null
  orderNumber: string
  startTime: string | Date
  endTime?: string | Date | null
  durationHours: number
}

interface TimeTrackingBreakdownProps {
  breaks: TimeTrackingBreakItem[]
  orders: TimeTrackingOrderItem[]
  breakHours: number
  selectedDate?: string | Date | null
  compact?: boolean
  className?: string
}

const formatHours = (hours?: number) => {
  if (!hours || !Number.isFinite(hours)) return "0h"
  const fullHours = Math.floor(hours)
  const minutes = Math.round((hours - fullHours) * 60)
  return minutes > 0 ? `${fullHours}h ${minutes}m` : `${fullHours}h`
}

const formatClock = (value?: string | Date | null) => {
  if (!value) return "laeuft"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "-"
  return date.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })
}

const formatDateLabel = (value?: string | Date | null) => {
  if (!value) return "Heute"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "Heute"
  const today = new Date()
  const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const normalizedValue = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  if (normalizedToday === normalizedValue) return "Heute"
  return date.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function TimeTrackingBreakdown({
  breaks,
  orders,
  breakHours,
  selectedDate,
  compact = false,
  className,
}: TimeTrackingBreakdownProps) {
  const longestOrderHours = orders.reduce((max, order) => Math.max(max, order.durationHours || 0), 0)
  const dateLabel = formatDateLabel(selectedDate)

  return (
    <Card className={cn("border-slate-200 bg-white/95 shadow-sm", className)}>
      <CardHeader className={cn("border-b border-slate-100", compact ? "px-3 py-2" : "px-4 py-3") }>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className={cn("flex items-center gap-2 font-semibold text-slate-800", compact ? "text-sm" : "text-base")}>
            <Timer className={compact ? "h-4 w-4 text-blue-700" : "h-4.5 w-4.5 text-blue-700"} />
            Tagesaufschluesselung
          </CardTitle>
          <div className={cn("inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-800", compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs")}>
            <CalendarDays className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
            {dateLabel}
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn("grid gap-3", compact ? "px-3 py-3" : "px-4 py-4")}>
        <div className="grid gap-3 md:grid-cols-2">
          <section className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-700">
                <Coffee className={compact ? "h-3.5 w-3.5 text-amber-600" : "h-4 w-4 text-amber-600"} />
                <span className={compact ? "text-[11px] font-semibold uppercase tracking-[0.12em]" : "text-xs font-semibold uppercase tracking-[0.14em]"}>Pausen</span>
              </div>
              <strong className={cn("text-slate-900", compact ? "text-xs" : "text-sm")}>{formatHours(breakHours)}</strong>
            </div>

            {breaks.length > 0 ? (
              <div className="grid gap-2">
                {breaks.map((pause, index) => (
                  <div
                    key={`${pause.startTime}-${index}`}
                    className={cn("flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/80", compact ? "px-2.5 py-2" : "px-3 py-2.5")}
                  >
                    <div className="grid gap-0.5 min-w-0">
                      <span className={cn("font-medium text-slate-800", compact ? "text-xs" : "text-sm")}>
                        {formatClock(pause.startTime)} - {formatClock(pause.endTime)}
                      </span>
                      {pause.reason ? (
                        <small className={cn("truncate text-slate-500", compact ? "text-[11px]" : "text-xs")}>{pause.reason}</small>
                      ) : null}
                    </div>
                    <strong className={cn("shrink-0 text-slate-900", compact ? "text-xs" : "text-sm")}>{formatHours(pause.durationHours)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className={cn("rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-500", compact ? "px-2.5 py-2 text-[11px]" : "px-3 py-2.5 text-xs")}>
                Fuer dieses Datum wurden keine Pausen erfasst.
              </p>
            )}
          </section>

          <section className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-700">
                <Timer className={compact ? "h-3.5 w-3.5 text-blue-700" : "h-4 w-4 text-blue-700"} />
                <span className={compact ? "text-[11px] font-semibold uppercase tracking-[0.12em]" : "text-xs font-semibold uppercase tracking-[0.14em]"}>Auftragszeiten</span>
              </div>
              <strong className={cn("text-slate-900", compact ? "text-xs" : "text-sm")}>{orders.length}</strong>
            </div>

            {orders.length > 0 ? (
              <div className="grid gap-2">
                {orders.map((order) => {
                  const width = longestOrderHours > 0
                    ? `${Math.max((order.durationHours / longestOrderHours) * 100, 10)}%`
                    : "0%"

                  return (
                    <div
                      key={`${order.orderId || order.orderNumber}-${order.startTime}`}
                      className={cn("grid gap-1.5 rounded-lg border border-slate-200 bg-white", compact ? "px-2.5 py-2" : "px-3 py-2.5")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className={cn("truncate font-medium text-slate-800", compact ? "text-xs" : "text-sm")}>#{order.orderNumber}</span>
                        <strong className={cn("shrink-0 text-slate-900", compact ? "text-xs" : "text-sm")}>{formatHours(order.durationHours)}</strong>
                      </div>
                      <div className={cn("overflow-hidden rounded-full bg-slate-100", compact ? "h-1.5" : "h-2") }>
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-700 to-sky-500" style={{ width }} />
                      </div>
                      <small className={cn("text-slate-500", compact ? "text-[11px]" : "text-xs")}>
                        {formatClock(order.startTime)} - {formatClock(order.endTime)}
                      </small>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className={cn("rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-500", compact ? "px-2.5 py-2 text-[11px]" : "px-3 py-2.5 text-xs")}>
                Fuer dieses Datum wurden keine Auftragszeiten erfasst.
              </p>
            )}
          </section>
        </div>
      </CardContent>
    </Card>
  )
}