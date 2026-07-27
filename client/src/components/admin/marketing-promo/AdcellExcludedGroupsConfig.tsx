import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/useToast'
import { getAdcellExcludedCustomerGroups, updateAdcellExcludedCustomerGroups } from '@/api/marketingPromo'
import { getCustomerGroups, type CustomerGroup } from '@/api/customerGroups'
import { AlertCircle, Loader2 } from 'lucide-react'

export function AdcellExcludedGroupsConfig() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [groups, setGroups] = useState<CustomerGroup[]>([])
  const [excludedGroupIds, setExcludedGroupIds] = useState<string[]>([])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getCustomerGroups({}),
      getAdcellExcludedCustomerGroups(),
    ])
      .then(([groupRes, excludedRes]) => {
        if (groupRes.groups) setGroups(groupRes.groups)
        if (excludedRes.success) setExcludedGroupIds(excludedRes.excludedGroupIds || [])
      })
      .catch((err) => {
        console.error('Failed to load data:', err)
        toast({ title: 'Fehler', description: 'Kundengruppen konnten nicht geladen werden.', variant: 'destructive' })
      })
      .finally(() => setLoading(false))
  }, [])

  const toggleGroup = (groupId: string) => {
    setExcludedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    )
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await updateAdcellExcludedCustomerGroups(excludedGroupIds)
      if (res.success) {
        setExcludedGroupIds(res.excludedGroupIds || [])
        toast({ title: 'Gespeichert', description: res.message || 'Ausgeschlossene Gruppen aktualisiert.' })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Speichern fehlgeschlagen.'
      toast({ title: 'Fehler', description: msg, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ausgeschlossene Kundengruppen</CardTitle>
        <CardDescription className="text-xs">
          Kunden in diesen Gruppen erhalten Rabatte auf ihrer Rechnung und sollten nicht zum ADCELL Conversion Tracking erfasst werden.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alert box */}
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <p className="font-semibold">Warum ausschließen?</p>
            <p>
              Kunden mit Rabattprozenten haben verfälschte Bestellbeträge. Das Tracking würde falsche Konversionsgelder an ADCELL
              übermitteln. Diese Kundengruppen sollten daher ausgeschlossen werden.
            </p>
          </div>
        </div>

        {/* Groups list */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        )}

        {!loading && groups.length === 0 && (
          <p className="text-xs text-slate-500">Keine Kundengruppen vorhanden.</p>
        )}

        {!loading && groups.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {groups.map((group) => (
              <div
                key={group._id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
              >
                <Checkbox
                  id={`group-${group._id}`}
                  checked={excludedGroupIds.includes(group._id)}
                  disabled={loading}
                  onCheckedChange={() => toggleGroup(group._id)}
                />
                <label
                  htmlFor={`group-${group._id}`}
                  className="flex-1 cursor-pointer text-sm font-medium"
                >
                  {group.name}
                  {group.description && (
                    <p className="text-xs text-slate-500 font-normal mt-0.5">{group.description}</p>
                  )}
                </label>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {!loading && excludedGroupIds.length > 0 && (
          <p className="text-xs bg-blue-50 border border-blue-200 rounded p-2 text-blue-700">
            <strong>{excludedGroupIds.length}</strong> Gruppe{excludedGroupIds.length !== 1 ? 'n' : ''} ausgeschlossen
          </p>
        )}

        {/* Save button */}
        <Button onClick={save} disabled={saving || loading} className="w-full">
          {saving ? 'Wird gespeichert...' : 'Ausgeschlossene Gruppen speichern'}
        </Button>
      </CardContent>
    </Card>
  )
}
