import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/useToast"
import {
  CalendarDays,
  Clock,
  Coffee,
  Loader2,
  LogIn,
  LogOut,
  Play,
  Timer,
} from "lucide-react"
import {
  clockIn,
  clockOut,
  endBreak,
  getCurrentStatus,
  getTimeEntries,
  getTimeTrackingSummary,
  startBreak,
  type CurrentStatus,
  type TimeTrackingSummary,
} from "@/api/timeTracking"
import { TimeTrackingBreakdown } from "@/components/staff/TimeTrackingBreakdown"

interface TimelineEntry {
  _id: string
  type: "clock_in" | "clock_out" | "break_start" | "break_end" | "order_start" | "order_end"
  timestamp: string
  orderNumber?: string
  duration?: number
  notes?: string
}

const toDateInputValue = (value?: string | Date | null) => {
  const date = value ? new Date(value) : new Date()
  if (!Number.isFinite(date.getTime())) return new Date().toISOString().slice(0, 10)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

const toDayBounds = (value: string) => {
  const [year, month, day] = value.split("-").map(Number)
  const start = new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0)
  const end = new Date(year, (month || 1) - 1, day || 1, 23, 59, 59, 999)
  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  }
}

const formatHours = (hours?: number) => {
  if (!hours || !Number.isFinite(hours)) return "0h"
  const fullHours = Math.floor(hours)
  const minutes = Math.round((hours - fullHours) * 60)
  return minutes > 0 ? `${fullHours}h ${minutes}m` : `${fullHours}h`
}

const formatMinutes = (minutes?: number) => {
  if (!minutes || !Number.isFinite(minutes)) return "0m"
  const fullHours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (fullHours <= 0) return `${remainingMinutes}m`
  return remainingMinutes > 0 ? `${fullHours}h ${remainingMinutes}m` : `${fullHours}h`
}

const formatTimestamp = (value?: string | Date | null) => {
  if (!value) return "-"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "-"
  return date.toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const formatClock = (value?: string | Date | null) => {
  if (!value) return "-"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "-"
  return date.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })
}

const getStatusMeta = (status?: CurrentStatus["status"]) => {
  switch (status) {
    case "working":
      return { label: "In Arbeit", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" }
    case "on_break":
      return { label: "Pause", badge: "bg-amber-100 text-amber-800 border-amber-200" }
    case "online":
      return { label: "Eingestempelt", badge: "bg-sky-100 text-sky-800 border-sky-200" }
    case "pending":
      return { label: "Ausstehend", badge: "bg-orange-100 text-orange-800 border-orange-200" }
    default:
      return { label: "Offline", badge: "bg-slate-100 text-slate-700 border-slate-200" }
  }
}

const getEntryLabel = (entry: TimelineEntry) => {
  switch (entry.type) {
    case "clock_in":
      return "Eingestempelt"
    case "clock_out":
      return "Ausgestempelt"
    case "break_start":
      return "Pause gestartet"
    case "break_end":
      return "Pause beendet"
    case "order_start":
      return `Auftrag gestartet${entry.orderNumber ? ` #${entry.orderNumber}` : ""}`
    case "order_end":
      return `Auftrag beendet${entry.orderNumber ? ` #${entry.orderNumber}` : ""}`
    default:
      return entry.type
  }
}

const getActiveSessionMinutes = (status: CurrentStatus | null) => {
  if (!status?.activeSession?.clockInTime) return 0
  const start = new Date(status.activeSession.clockInTime).getTime()
  if (!Number.isFinite(start)) return 0

  const breakMinutes = (status.activeSession.breaks || []).reduce((sum, breakItem) => {
    const breakStart = new Date(breakItem.startTime).getTime()
    const breakEnd = new Date(breakItem.endTime || new Date()).getTime()
    if (!Number.isFinite(breakStart) || !Number.isFinite(breakEnd) || breakEnd <= breakStart) {
      return sum
    }
    return sum + Math.round((breakEnd - breakStart) / 60000)
  }, 0)

  const totalMinutes = Math.max(Math.round((Date.now() - start) / 60000), 0)
  return Math.max(totalMinutes - breakMinutes, 0)
}

export function TimeTracking() {
  const { toast } = useToast()
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()))
  const [status, setStatus] = useState<CurrentStatus | null>(null)
  const [summary, setSummary] = useState<TimeTrackingSummary | null>(null)
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState<null | "clockIn" | "clockOut" | "breakStart" | "breakEnd">(null)
  const [activeMinutes, setActiveMinutes] = useState(0)

  const fetchData = async (background = false) => {
    try {
      if (background) setRefreshing(true)
      else setLoading(true)

      const dayBounds = toDayBounds(selectedDate)
      const [statusResult, summaryResult, entriesResult] = await Promise.allSettled([
        getCurrentStatus(),
        getTimeTrackingSummary({ date: selectedDate }),
        getTimeEntries({ ...dayBounds, limit: 25 }),
      ])

      if (statusResult.status === "fulfilled") {
        setStatus(statusResult.value)
        setActiveMinutes(getActiveSessionMinutes(statusResult.value))
      }

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value)
      }

      if (entriesResult.status === "fulfilled") {
        setEntries((entriesResult.value?.entries || []) as TimelineEntry[])
      }
    } catch (error) {
      console.error("Error fetching time tracking data:", error)
      toast({
        title: "Fehler",
        description: "Zeiterfassungsdaten konnten nicht geladen werden.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedDate])

  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true)
    }, 30000)

    return () => clearInterval(interval)
  }, [selectedDate])

  useEffect(() => {
    setActiveMinutes(getActiveSessionMinutes(status))

    if (!status || (status.status !== "working" && status.status !== "online" && status.status !== "on_break")) {
      return
    }

    const interval = setInterval(() => {
      setActiveMinutes(getActiveSessionMinutes(status))
    }, 60000)

    return () => clearInterval(interval)
  }, [status])

  const handleAction = async (
    action: "clockIn" | "clockOut" | "breakStart" | "breakEnd",
    handler: () => Promise<unknown>,
    successTitle: string,
    successDescription: string,
  ) => {
    setActionLoading(action)
    try {
      await handler()
      await fetchData(true)
      toast({ title: successTitle, description: successDescription })
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error?.message || "Aktion konnte nicht ausgefuehrt werden.",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const statusMeta = getStatusMeta(status?.status)
  const selectedSummary = summary?.summary

  const stats = useMemo(() => {
    const orderHours = (selectedSummary?.ordersToday || []).reduce((sum, order) => sum + (order.durationHours || 0), 0)
    return [
      {
        label: "Arbeitszeit Tag",
        value: formatHours(selectedSummary?.hoursToday),
      },
      {
        label: "Pausen Tag",
        value: formatHours(selectedSummary?.breakHoursToday),
      },
      {
        label: "Auftragszeit Tag",
        value: formatHours(orderHours),
      },
      {
        label: "Sitzung live",
        value: formatMinutes(activeMinutes),
      },
    ]
  }, [activeMinutes, selectedSummary])

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#1b2552] px-4 py-4 text-white shadow-sm md:px-5 md:py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-white/14 p-2">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold leading-tight md:text-2xl">Zeiterfassung</h1>
                <p className="mt-0.5 text-sm text-blue-50/90">
                  Kompakte Tagesansicht mit Status, Pausen und Auftragszeiten.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Badge className={`border ${statusMeta.badge} justify-center px-2.5 py-1 text-xs font-semibold`}>
              {statusMeta.label}
            </Badge>
            <div className="flex items-center gap-2 rounded-xl bg-white/12 px-3 py-2 backdrop-blur-sm">
              <CalendarDays className="h-4 w-4 text-blue-50" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="h-8 border-white/20 bg-white/10 px-2 text-xs text-white [color-scheme:dark] placeholder:text-blue-100/70 focus-visible:ring-white/40"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-slate-200 shadow-sm">
            <CardContent className="px-3 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{stat.label}</p>
              <div className="mt-1 text-lg font-semibold text-slate-900">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm font-semibold text-slate-800">Aktuelle Schicht</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 px-4 py-3 pt-0">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Eingestempelt seit</p>
                <div className="mt-1 text-sm font-semibold text-slate-900">{formatClock(status?.lastClockIn)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Letzte Aktivitaet</p>
                <div className="mt-1 text-sm font-semibold text-slate-900">{formatTimestamp(status?.lastActivity)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Aktueller Auftrag</p>
                <div className="mt-1 truncate text-sm font-semibold text-slate-900">{status?.currentOrder?.orderNumber ? `#${status.currentOrder.orderNumber}` : "Kein Auftrag"}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(!status || status.status === "offline") && (
                <Button
                  size="sm"
                  className="h-8 bg-blue-700 px-3 text-xs hover:bg-blue-800"
                  disabled={actionLoading !== null}
                  onClick={() => handleAction("clockIn", clockIn, "Eingestempelt", "Deine Arbeitszeit wurde gestartet.")}
                >
                  {actionLoading === "clockIn" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <LogIn className="mr-1.5 h-3.5 w-3.5" />}
                  Einstempeln
                </Button>
              )}

              {(status?.status === "online" || status?.status === "working") && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs"
                    disabled={actionLoading !== null}
                    onClick={() => handleAction("breakStart", startBreak, "Pause gestartet", "Die Pause wurde erfasst.")}
                  >
                    {actionLoading === "breakStart" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Coffee className="mr-1.5 h-3.5 w-3.5" />}
                    Pause starten
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs"
                    disabled={actionLoading !== null}
                    onClick={() => handleAction("clockOut", clockOut, "Ausgestempelt", "Die Arbeitszeit wurde beendet.")}
                  >
                    {actionLoading === "clockOut" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <LogOut className="mr-1.5 h-3.5 w-3.5" />}
                    Ausstempeln
                  </Button>
                </>
              )}

              {status?.status === "on_break" && (
                <>
                  <Button
                    size="sm"
                    className="h-8 bg-blue-700 px-3 text-xs hover:bg-blue-800"
                    disabled={actionLoading !== null}
                    onClick={() => handleAction("breakEnd", endBreak, "Pause beendet", "Die Arbeitszeit laeuft wieder.")}
                  >
                    {actionLoading === "breakEnd" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
                    Pause beenden
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs"
                    disabled={actionLoading !== null}
                    onClick={() => handleAction("clockOut", clockOut, "Ausgestempelt", "Die Arbeitszeit wurde beendet.")}
                  >
                    {actionLoading === "clockOut" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <LogOut className="mr-1.5 h-3.5 w-3.5" />}
                    Ausstempeln
                  </Button>
                </>
              )}

              <Button size="sm" variant="ghost" className="ml-auto h-8 px-3 text-xs text-slate-600" disabled={refreshing} onClick={() => fetchData(true)}>
                {refreshing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Timer className="mr-1.5 h-3.5 w-3.5" />}
                Aktualisieren
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm font-semibold text-slate-800">Zusammenfassung</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 px-4 py-3 pt-0">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <span className="text-slate-600">Woche</span>
              <strong className="text-slate-900">{formatHours(selectedSummary?.hoursThisWeek)}</strong>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <span className="text-slate-600">Monat</span>
              <strong className="text-slate-900">{formatHours(selectedSummary?.hoursThisMonth)}</strong>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <span className="text-slate-600">Gesamt Arbeitszeit</span>
              <strong className="text-slate-900">{formatHours(selectedSummary?.totalHoursWorked)}</strong>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <span className="text-slate-600">Gesamt Pausenzeit</span>
              <strong className="text-slate-900">{formatHours(selectedSummary?.totalBreakHours)}</strong>
            </div>
          </CardContent>
        </Card>
      </div>

      <TimeTrackingBreakdown
        breakHours={selectedSummary?.breakHoursToday || 0}
        breaks={selectedSummary?.breaksToday || []}
        orders={selectedSummary?.ordersToday || []}
        selectedDate={selectedSummary?.selectedDate || selectedDate}
      />

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between px-4 py-3">
          <CardTitle className="text-sm font-semibold text-slate-800">Zeitereignisse des Tages</CardTitle>
          <Badge variant="outline" className="text-[11px] text-slate-600">{entries.length} Eintraege</Badge>
        </CardHeader>
        <CardContent className="px-4 py-3 pt-0">
          {entries.length > 0 ? (
            <div className="grid gap-2">
              {entries.map((entry) => (
                <div key={entry._id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{getEntryLabel(entry)}</p>
                    <p className="text-[11px] text-slate-500">{entry.notes || "Automatisch erfasst"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold text-slate-900">{formatTimestamp(entry.timestamp)}</p>
                    <p className="text-[11px] text-slate-500">{entry.duration ? formatMinutes(entry.duration) : entry.orderNumber ? `#${entry.orderNumber}` : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
              Fuer das ausgewaehlte Datum liegen keine Zeiteintraege vor.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}