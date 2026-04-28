import { useEffect, useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/hooks/useToast'
import {
  createSegment,
  listSegments,
  previewSegment,
  updateSegment,
  type MarketingSegment,
} from '@/api/marketingPromo'
import { MarketingPromoHeader } from '@/components/admin/marketing-promo/MarketingPromoHeader'

const DEFAULT_FORM = {
  internalName: '',
  description: '',
  status: 'active',
  newsletterOptInOnly: true,
  minTotalOrders: 0,
  minTotalSpent: 0,
  includeCountry: '',
}

export function MarketingPromoSegments() {
  const { toast } = useToast()

  const getErrorMessage = (error: unknown, fallback: string) => (
    error instanceof Error ? error.message : fallback
  )

  const [rows, setRows] = useState<MarketingSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('all')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MarketingSegment | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [previewCount, setPreviewCount] = useState<number | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const response = await listSegments({ status, limit: 100 })
      setRows(response.rows)
    } catch (error: unknown) {
      console.error('Failed loading segments:', error)
      toast({ title: 'Fehler', description: getErrorMessage(error, 'Segmente konnten nicht geladen werden.'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [status])

  const openCreate = () => {
    setEditing(null)
    setForm(DEFAULT_FORM)
    setPreviewCount(null)
    setDialogOpen(true)
  }

  const openEdit = (item: MarketingSegment) => {
    setEditing(item)
    setForm({
      internalName: item.internalName,
      description: item.description || '',
      status: item.status,
      newsletterOptInOnly: item.rules?.newsletterOptInOnly !== false,
      minTotalOrders: item.rules?.minTotalOrders || 0,
      minTotalSpent: item.rules?.minTotalSpent || 0,
      includeCountry: item.rules?.includeCountries?.[0] || '',
    })
    setPreviewCount(item.lastPreviewCount || null)
    setDialogOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        internalName: form.internalName,
        description: form.description,
        status: form.status,
        rules: {
          roles: ['customer'],
          statuses: ['active'],
          newsletterOptInOnly: form.newsletterOptInOnly,
          includeCountries: form.includeCountry ? [form.includeCountry] : [],
          minTotalOrders: Number(form.minTotalOrders),
          minTotalSpent: Number(form.minTotalSpent),
        },
      }

      if (editing?._id) {
        await updateSegment(editing._id, payload)
      } else {
        await createSegment(payload)
      }

      toast({ title: 'Erfolg', description: editing ? 'Segment aktualisiert.' : 'Segment erstellt.' })
      setDialogOpen(false)
      await loadData()
    } catch (error: unknown) {
      console.error('Failed saving segment:', error)
      toast({ title: 'Fehler', description: getErrorMessage(error, 'Speichern fehlgeschlagen.'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = async () => {
    if (!editing?._id) {
      toast({ title: 'Hinweis', description: 'Speichere das Segment zuerst.', variant: 'destructive' })
      return
    }

    try {
      const response = await previewSegment(editing._id)
      setPreviewCount(response.preview.count)
      toast({ title: 'Segment-Vorschau', description: `${response.preview.count} Treffer` })
    } catch (error: unknown) {
      toast({ title: 'Fehler', description: getErrorMessage(error, 'Vorschau fehlgeschlagen.'), variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <MarketingPromoHeader
        title="Segmente"
        description="Zielgruppen auf Basis bestehender Kundendaten definieren und wiederverwenden."
        current="Segmente"
      />

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="active">active</SelectItem>
                <SelectItem value="archived">archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={loadData}>Aktualisieren</Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Neues Segment
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>{editing ? 'Segment bearbeiten' : 'Segment erstellen'}</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={form.internalName} onChange={(e) => setForm((prev) => ({ ...prev, internalName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Beschreibung</Label>
                    <Input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Land (optional)</Label>
                    <Input placeholder="z. B. DE" value={form.includeCountry} onChange={(e) => setForm((prev) => ({ ...prev, includeCountry: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Min. Bestellungen</Label>
                      <Input type="number" value={form.minTotalOrders} onChange={(e) => setForm((prev) => ({ ...prev, minTotalOrders: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Min. Umsatz</Label>
                      <Input type="number" value={form.minTotalSpent} onChange={(e) => setForm((prev) => ({ ...prev, minTotalSpent: Number(e.target.value) }))} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded border border-slate-200 p-3">
                    <div>
                      <Label>Nur Opt-in-Empfaenger</Label>
                      <p className="text-xs text-slate-500">Beruecksichtigt nur Newsletter-zugelassene Empfaenger.</p>
                    </div>
                    <Switch checked={form.newsletterOptInOnly} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, newsletterOptInOnly: checked }))} />
                  </div>

                  {previewCount !== null && (
                    <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                      Vorschau Treffer: <strong>{previewCount}</strong>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  {editing && (
                    <Button variant="outline" onClick={handlePreview}>Vorschau aktualisieren</Button>
                  )}
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
                  <Button onClick={save} disabled={saving}>{saving ? 'Speichert...' : 'Speichern'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading && <p className="text-sm text-slate-500">Lade Segmente...</p>}
        {!loading && rows.length === 0 && <p className="text-sm text-slate-500">Keine Segmente gefunden.</p>}

        {rows.map((item) => (
          <Card key={item._id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold text-slate-900">{item.internalName}</p>
                <p className="text-xs text-slate-500">{item.description || 'Ohne Beschreibung'}</p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline">{item.status}</Badge>
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" />
                  {item.lastPreviewCount || 0}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => openEdit(item)}>Bearbeiten</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
