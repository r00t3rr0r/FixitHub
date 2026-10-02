import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, Circle, CircleDashed, Clock, ExternalLink, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getOrderHistory,
  type OrderHistoryEntry,
  type OrderHistoryGroup,
  type OrderHistoryLink,
  type OrderMilestone,
  type OrderMilestones,
} from "@/api/orders"

/**
 * Verlauf eines Auftrags für Personal/Admin (Tab "Verlauf" im Auftragsdetail).
 *
 * Datenquelle ist ausschließlich GET /api/orders/:id/history (HIST-CONTRACT): der Server
 * führt Timeline, Änderungsbelege, Rechnungen, Zahlungen und Altdaten zusammen, liefert
 * deutsche Titel, Kategorie, Akteur, Änderungen, Grund und eine Verknüpfung zum Datensatz.
 * Die Meilensteine sind ehrlich: "Übersprungen – nicht erfasst" und "Zeitpunkt nicht erfasst"
 * werden nie als abgeschlossen dargestellt. Hier wird nur gerendert und gefiltert.
 */
interface OrderHistoryPanelProps {
  orderId: string
  /** Ändert sich (z. B. order.updatedAt), wird der Verlauf neu geladen. */
  refreshToken?: string | number
  /** Klick auf eine Verknüpfung (Rechnung, Zahlung, Prüfbericht, Konversation, Sendung …). */
  onOpenLink?: (link: OrderHistoryLink, entry: OrderHistoryEntry) => void
  /** Meldet die Gesamtzahl (für den Tab-Zähler). */
  onTotalChange?: (total: number) => void
}

type LoadState = 'loading' | 'ready' | 'error'

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const describeMilestone = (stage: OrderMilestone, { showActor = true }: { showActor?: boolean } = {}) => {
  const when = formatDateTime(stage.reachedAt) || stage.date || ''
  const actor = showActor && stage.actorName ? ` · ${stage.actorName}` : ''
  switch (stage.state) {
    case 'reached':
      return stage.timeKnown && when ? `Erreicht am ${when}${actor}` : (stage.note || 'Zeitpunkt nicht erfasst')
    case 'current':
      return when ? `Aktueller Schritt · seit ${when}${actor}` : 'Aktueller Schritt'
    case 'skipped':
      return stage.note || 'Übersprungen – nicht erfasst'
    default:
      return 'Offen'
  }
}

const MILESTONE_TONE: Record<string, string> = {
  reached: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  current: 'border-[#e5ab00] bg-[#fff6d6] text-[#1a2a5e]',
  skipped: 'border-dashed border-slate-300 bg-slate-50 text-slate-600',
  pending: 'border-slate-200 bg-white text-slate-500',
}

const MilestoneIcon = ({ state }: { state: OrderMilestone['state'] }) => {
  if (state === 'reached') return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
  if (state === 'current') return <Clock className="h-4 w-4 shrink-0 text-[#1a2a5e]" aria-hidden="true" />
  if (state === 'skipped') return <CircleDashed className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
  return <Circle className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
}

export function OrderMilestoneList({ milestones, showActor = true }: { milestones: OrderMilestones | null | undefined; showActor?: boolean }) {
  const stages = Array.isArray(milestones?.stages) ? milestones!.stages : []
  if (!stages.length) return null
  return (
    <ol className="admin-od-milestones" aria-label="Meilensteine">
      {stages.map((stage) => (
        <li
          key={stage.id}
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${MILESTONE_TONE[stage.state] || MILESTONE_TONE.pending}`}
          aria-current={stage.state === 'current' ? 'step' : undefined}
        >
          <MilestoneIcon state={stage.state} />
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold leading-tight">{stage.label}</span>
            <span className="block text-xs leading-snug">{describeMilestone(stage, { showActor })}</span>
            {stage.state === 'reached' && stage.detail ? <span className="block text-xs leading-snug opacity-80">{stage.detail}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function OrderHistoryPanel({ orderId, refreshToken, onOpenLink, onTotalChange }: OrderHistoryPanelProps) {
  const [groupId, setGroupId] = useState<string>('all')
  const [entries, setEntries] = useState<OrderHistoryEntry[]>([])
  const [groups, setGroups] = useState<OrderHistoryGroup[]>([])
  const [milestones, setMilestones] = useState<OrderMilestones | null>(null)
  const [total, setTotal] = useState(0)
  const [allTotal, setAllTotal] = useState<number | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [state, setState] = useState<LoadState>('loading')
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const requestRef = useRef(0)

  const activeGroup = useMemo(() => groups.find((group) => group.id === groupId) || null, [groups, groupId])
  const activeTypes = activeGroup?.types

  useEffect(() => {
    if (!orderId) return
    const requestId = ++requestRef.current
    setState('loading')
    setLoadMoreError(false)
    getOrderHistory(orderId, { types: groupId === 'all' ? undefined : activeTypes, limit: 100 })
      .then((response) => {
        if (requestId !== requestRef.current) return
        setEntries(Array.isArray(response?.entries) ? response.entries : [])
        setGroups(Array.isArray(response?.groups) ? response.groups : [])
        setMilestones(response?.milestones || null)
        setTotal(Number(response?.total) || 0)
        setNextCursor(response?.nextCursor || null)
        if (groupId === 'all') {
          setAllTotal(Number(response?.total) || 0)
          onTotalChange?.(Number(response?.total) || 0)
        }
        setState('ready')
      })
      .catch((error) => {
        if (requestId !== requestRef.current) return
        console.error('OrderHistoryPanel: Verlauf konnte nicht geladen werden:', error)
        setState('error')
      })
    // activeTypes folgt groupId; groups selbst lösen kein Neuladen aus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, groupId, refreshToken, reloadToken])

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    setLoadMoreError(false)
    try {
      const response = await getOrderHistory(orderId, { types: groupId === 'all' ? undefined : activeTypes, before: nextCursor, limit: 100 })
      setEntries((current) => [...current, ...(Array.isArray(response?.entries) ? response.entries : [])])
      setNextCursor(response?.nextCursor || null)
    } catch (error) {
      console.error('OrderHistoryPanel: Ältere Einträge konnten nicht geladen werden:', error)
      setLoadMoreError(true)
    } finally {
      setLoadingMore(false)
    }
  }

  const chips: Array<{ id: string; label: string; count: number | null }> = [
    { id: 'all', label: 'Alle', count: allTotal },
    ...groups.map((group) => ({ id: group.id, label: group.label, count: group.count })),
  ]

  return (
    <div className="admin-od-history space-y-4">
      <section aria-labelledby="admin-od-milestones-title" className="space-y-2">
        <h3 id="admin-od-milestones-title" className="text-sm font-semibold text-[#1a2a5e]">Meilensteine</h3>
        {state === 'loading' && !milestones ? (
          <p className="text-[13px] text-muted-foreground" role="status">Meilensteine werden geladen …</p>
        ) : milestones?.stages?.length ? (
          <>
            <OrderMilestoneList milestones={milestones} />
            {(milestones.paused || milestones.cancelled) && (
              <p className="text-xs text-amber-800">
                <AlertTriangle className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                {milestones.cancelled ? 'Auftrag storniert.' : 'Auftrag ist pausiert.'}
              </p>
            )}
          </>
        ) : state === 'error' ? null : (
          <p className="text-[13px] text-muted-foreground">Keine Meilensteine verfügbar.</p>
        )}
      </section>

      <section aria-labelledby="admin-od-history-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="admin-od-history-title" className="text-sm font-semibold text-[#1a2a5e]">
            Einträge{state === 'ready' ? ` (${total})` : ''}
          </h3>
          <Button type="button" size="sm" variant="outline" onClick={() => setReloadToken((value) => value + 1)} disabled={state === 'loading'}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Neu laden
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Verlauf filtern">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              aria-pressed={groupId === chip.id}
              onClick={() => setGroupId(chip.id)}
              className={`admin-od-chip ${groupId === chip.id ? 'is-active' : ''}`}
            >
              {chip.label}
              {chip.count !== null && chip.count !== undefined ? <span className="admin-od-chip-count">{chip.count}</span> : null}
            </button>
          ))}
        </div>

        {state === 'loading' ? (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Verlauf wird geladen …
          </p>
        ) : state === 'error' ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-[13px] text-red-800" role="alert">
            Verlauf konnte nicht geladen werden.{' '}
            <Button type="button" size="sm" variant="outline" className="ml-2" onClick={() => setReloadToken((value) => value + 1)}>
              Erneut versuchen
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-[13px] text-muted-foreground">
            {groupId === 'all' ? 'Noch keine Verlaufseinträge.' : 'Noch keine Einträge in dieser Kategorie.'}
          </p>
        ) : (
          <ol className="admin-od-history-list">
            {entries.map((entry) => {
              const when = entry.timeKnown ? formatDateTime(entry.at) : ''
              return (
                <li key={entry.id} className="admin-od-history-item">
                  <div className="admin-od-history-time">
                    {when || <span className="italic">{entry.timeNote || 'Zeitpunkt nicht erfasst'}</span>}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-[#1a2a5e]">{entry.title}</span>
                      <span className="admin-od-history-type">{entry.typeLabel}</span>
                      {entry.source ? <span className="admin-od-history-source">Quelle: {entry.source}</span> : null}
                      {entry.visibility === 'customer' ? <span className="admin-od-history-source">für Kunden sichtbar</span> : null}
                    </div>
                    {entry.description ? <p className="text-[13px] text-slate-700 break-words">{entry.description}</p> : null}
                    {Array.isArray(entry.changes) && entry.changes.length > 0 ? (
                      <ul className="space-y-0.5 text-[13px] text-slate-700">
                        {entry.changes.map((change, index) => (
                          <li key={`${entry.id}-change-${index}`} className="break-words">
                            <span className="font-medium">{change.label}:</span> {change.fromText || '–'} → {change.toText || '–'}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {entry.reason ? <p className="text-[13px] text-slate-700">Grund: {entry.reason}</p> : null}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {entry.actor?.name ? <span>von {entry.actor.name}</span> : null}
                      {entry.link && onOpenLink ? (
                        <button type="button" className="admin-od-history-link" onClick={() => onOpenLink(entry.link as OrderHistoryLink, entry)}>
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          {entry.link.label}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        {state === 'ready' && nextCursor ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore ? 'Ältere Einträge werden geladen …' : 'Ältere Einträge laden'}
            </Button>
            {loadMoreError ? <span className="text-xs text-red-700">Ältere Einträge konnten nicht geladen werden. Erneut versuchen</span> : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}

export default OrderHistoryPanel
