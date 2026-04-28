import { useEffect, useState } from 'react'
import { Archive, Plus, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/hooks/useToast'
import {
  archivePromoCode,
  createPromoCode,
  listPromoCodes,
  togglePromoCode,
  updatePromoCode,
  type PromoCode,
} from '@/api/marketingPromo'
import { MarketingPromoHeader } from '@/components/admin/marketing-promo/MarketingPromoHeader'

const DEFAULT_FORM = {
  internalName: '',
  code: '',
  description: '',
  discountType: 'percentage',
  value: 10,
  startDate: '',
  endDate: '',
  status: 'draft',
  minimumOrderValue: 0,
  usageLimitTotal: 0,
  usageLimitPerCustomer: 0,
  combinable: false,
}

export function MarketingPromoPromoCodes() {
  const { toast } = useToast()

  const getErrorMessage = (error: unknown, fallback: string) => (
    error instanceof Error ? error.message : fallback
  )

  const [rows, setRows] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PromoCode | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)

  const loadData = async () => {
    setLoading(true)
    try {
      const response = await listPromoCodes({ search, status, limit: 100 })
      setRows(response.rows)
    } catch (error: unknown) {
      console.error('Failed loading promo codes:', error)
      toast({ title: 'Fehler', description: getErrorMessage(error, 'Promo-Codes konnten nicht geladen werden.'), variant: 'destructive' })
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
    setDialogOpen(true)
  }

  const openEdit = (item: PromoCode) => {
    setEditing(item)
    setForm({
      internalName: item.internalName,
      code: item.code,
      description: item.description || '',
      discountType: item.discountType,
      value: item.value,
      startDate: item.startDate ? String(item.startDate).slice(0, 10) : '',
      endDate: item.endDate ? String(item.endDate).slice(0, 10) : '',
      status: item.status,
      minimumOrderValue: item.rules?.minimumOrderValue || 0,
      usageLimitTotal: item.rules?.usageLimitTotal || 0,
      usageLimitPerCustomer: item.rules?.usageLimitPerCustomer || 0,
      combinable: !!item.rules?.combinable,
    })
    setDialogOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        internalName: form.internalName,
        code: form.code,
        description: form.description,
        discountType: form.discountType,
        value: Number(form.value),
        startDate: form.startDate,
        endDate: form.endDate,
        status: form.status,
        rules: {
          minimumOrderValue: Number(form.minimumOrderValue),
          usageLimitTotal: Number(form.usageLimitTotal),
          usageLimitPerCustomer: Number(form.usageLimitPerCustomer),
          combinable: form.combinable,
        },
      }

      if (editing?._id) {
        await updatePromoCode(editing._id, payload)
      } else {
        await createPromoCode(payload)
      }

      toast({ title: 'Erfolg', description: editing ? 'Promo-Code aktualisiert.' : 'Promo-Code erstellt.' })
      setDialogOpen(false)
      await loadData()
    } catch (error: unknown) {
      console.error('Failed saving promo code:', error)
      toast({ title: 'Fehler', description: getErrorMessage(error, 'Speichern fehlgeschlagen.'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (item: PromoCode) => {
    try {
      const enable = item.status !== 'active'
      await togglePromoCode(item._id, enable)
      toast({ title: 'Erfolg', description: enable ? 'Promo-Code aktiviert.' : 'Promo-Code deaktiviert.' })
      await loadData()
    } catch (error: unknown) {
      toast({ title: 'Fehler', description: getErrorMessage(error, 'Statuswechsel fehlgeschlagen.'), variant: 'destructive' })
    }
  }

  const handleArchive = async (item: PromoCode) => {
    try {
      await archivePromoCode(item._id)
      toast({ title: 'Erfolg', description: 'Promo-Code archiviert.' })
      await loadData()
    } catch (error: unknown) {
      toast({ title: 'Fehler', description: getErrorMessage(error, 'Archivieren fehlgeschlagen.'), variant: 'destructive' })
    }
  }

  const filtered = rows.filter((item) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return item.internalName.toLowerCase().includes(q) || item.code.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      <MarketingPromoHeader
        title="Promo Codes"
        description="Rabattcodes inklusive Regeln, Laufzeiten und Aktivierung verwalten."
        current="Promo Codes"
      />

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Suche</Label>
            <Input placeholder="Name oder Code..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="draft">draft</SelectItem>
                <SelectItem value="active">active</SelectItem>
                <SelectItem value="inactive">inactive</SelectItem>
                <SelectItem value="expired">expired</SelectItem>
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
                  Neuer Promo-Code
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editing ? 'Promo-Code bearbeiten' : 'Promo-Code erstellen'}</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Interner Name</Label>
                    <Input value={form.internalName} onChange={(e) => setForm((prev) => ({ ...prev, internalName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Code</Label>
                    <Input value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Rabattart</Label>
                    <Select value={form.discountType} onValueChange={(value) => setForm((prev) => ({ ...prev, discountType: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">percentage</SelectItem>
                        <SelectItem value="fixed_amount">fixed_amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Wert</Label>
                    <Input type="number" value={form.value} onChange={(e) => setForm((prev) => ({ ...prev, value: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Startdatum</Label>
                    <Input type="date" value={form.startDate} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Enddatum</Label>
                    <Input type="date" value={form.endDate} onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Mindestbestellwert</Label>
                    <Input type="number" value={form.minimumOrderValue} onChange={(e) => setForm((prev) => ({ ...prev, minimumOrderValue: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nutzungslimit gesamt</Label>
                    <Input type="number" value={form.usageLimitTotal} onChange={(e) => setForm((prev) => ({ ...prev, usageLimitTotal: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nutzungslimit pro Kunde</Label>
                    <Input type="number" value={form.usageLimitPerCustomer} onChange={(e) => setForm((prev) => ({ ...prev, usageLimitPerCustomer: Number(e.target.value) }))} />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch checked={form.combinable} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, combinable: checked }))} />
                    <Label>Kombinierbar</Label>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Beschreibung</Label>
                    <Textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
                  <Button onClick={save} disabled={saving}>{saving ? 'Speichert...' : 'Speichern'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading && <p className="text-sm text-slate-500">Lade Promo-Codes...</p>}
        {!loading && filtered.length === 0 && <p className="text-sm text-slate-500">Keine Promo-Codes gefunden.</p>}

        {filtered.map((item) => (
          <Card key={item._id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{item.code}</p>
                  <p className="text-xs text-slate-500">{item.internalName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{item.status}</Badge>
                  <Button variant="outline" size="sm" onClick={() => openEdit(item)}>Bearbeiten</Button>
                  <Button variant="outline" size="sm" onClick={() => handleToggle(item)}>
                    <Power className="mr-1 h-4 w-4" />
                    {item.status === 'active' ? 'Deaktivieren' : 'Aktivieren'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleArchive(item)}>
                    <Archive className="mr-1 h-4 w-4" />
                    Archivieren
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 text-xs md:grid-cols-4">
                <div className="rounded border border-slate-200 p-2">Rabatt: {item.discountType === 'percentage' ? `${item.value}%` : `${item.value} EUR`}</div>
                <div className="rounded border border-slate-200 p-2">Einloesungen: {item.usageCount || 0}</div>
                <div className="rounded border border-slate-200 p-2">Rabattvolumen: {(item.discountVolume || 0).toFixed(2)} EUR</div>
                <div className="rounded border border-slate-200 p-2">Umsatzbezug: {(item.revenueAttributed || 0).toFixed(2)} EUR</div>
              </div>

              <div className="text-xs text-slate-500">
                Gueltig von {new Date(item.startDate).toLocaleDateString('de-DE')} bis {new Date(item.endDate).toLocaleDateString('de-DE')}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
