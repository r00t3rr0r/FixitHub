import { useEffect, useMemo, useState } from 'react'
import { Plus, Send, Copy, Archive, CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/hooks/useToast'
import {
  archiveNewsletter,
  createNewsletter,
  duplicateNewsletter,
  listNewsletters,
  listSegments,
  scheduleNewsletter,
  sendNewsletterNow,
  testSendNewsletter,
  updateNewsletter,
  type MarketingSegment,
  type Newsletter,
} from '@/api/marketingPromo'
import { MarketingPromoHeader } from '@/components/admin/marketing-promo/MarketingPromoHeader'

const DEFAULT_FORM = {
  internalName: '',
  subject: '',
  preheader: '',
  content: '',
  templateName: 'Allgemeine Systemnachricht',
  status: 'draft',
  segmentId: 'none',
  scheduledAt: '',
}

export function MarketingPromoNewsletters() {
  const { toast } = useToast()

  const getErrorMessage = (error: unknown, fallback: string) => (
    error instanceof Error ? error.message : fallback
  )

  const [rows, setRows] = useState<Newsletter[]>([])
  const [segments, setSegments] = useState<MarketingSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Newsletter | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)

  const [testEmailById, setTestEmailById] = useState<Record<string, string>>({})
  const [scheduleById, setScheduleById] = useState<Record<string, string>>({})

  const segmentOptions = useMemo(() => segments.filter((item) => item.status === 'active'), [segments])

  const loadData = async () => {
    setLoading(true)
    try {
      const [newsletterResponse, segmentResponse] = await Promise.all([
        listNewsletters({ search, status, limit: 100 }),
        listSegments({ status: 'active', limit: 100 }),
      ])
      setRows(newsletterResponse.rows)
      setSegments(segmentResponse.rows)
    } catch (error: unknown) {
      console.error('Failed loading newsletters:', error)
      toast({
        title: 'Fehler',
        description: getErrorMessage(error, 'Newsletter konnten nicht geladen werden.'),
        variant: 'destructive',
      })
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
    setIsDialogOpen(true)
  }

  const openEdit = (item: Newsletter) => {
    setEditing(item)
    setForm({
      internalName: item.internalName || '',
      subject: item.subject || '',
      preheader: item.preheader || '',
      content: item.content || '',
      templateName: item.templateName || 'Allgemeine Systemnachricht',
      status: item.status || 'draft',
      segmentId: item.segmentId?._id || 'none',
      scheduledAt: item.scheduledAt ? String(item.scheduledAt).slice(0, 16) : '',
    })
    setIsDialogOpen(true)
  }

  const saveNewsletter = async () => {
    setSaving(true)
    try {
      const payload = {
        internalName: form.internalName,
        subject: form.subject,
        preheader: form.preheader,
        content: form.content,
        templateName: form.templateName,
        status: form.status,
        segmentId: form.segmentId === 'none' ? null : form.segmentId,
      }

      if (editing?._id) {
        await updateNewsletter(editing._id, payload)
      } else {
        await createNewsletter(payload)
      }

      toast({ title: 'Erfolg', description: editing ? 'Newsletter aktualisiert.' : 'Newsletter erstellt.' })
      setIsDialogOpen(false)
      await loadData()
    } catch (error: unknown) {
      console.error('Failed saving newsletter:', error)
      toast({ title: 'Fehler', description: getErrorMessage(error, 'Speichern fehlgeschlagen.'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateNewsletter(id)
      toast({ title: 'Erfolg', description: 'Newsletter dupliziert.' })
      await loadData()
    } catch (error: unknown) {
      toast({ title: 'Fehler', description: getErrorMessage(error, 'Duplizieren fehlgeschlagen.'), variant: 'destructive' })
    }
  }

  const handleArchive = async (id: string) => {
    try {
      await archiveNewsletter(id)
      toast({ title: 'Erfolg', description: 'Newsletter archiviert.' })
      await loadData()
    } catch (error: unknown) {
      toast({ title: 'Fehler', description: getErrorMessage(error, 'Archivieren fehlgeschlagen.'), variant: 'destructive' })
    }
  }

  const handleTestSend = async (id: string) => {
    const email = (testEmailById[id] || '').trim()
    if (!email) {
      toast({ title: 'Hinweis', description: 'Bitte Test-E-Mail eingeben.', variant: 'destructive' })
      return
    }

    try {
      await testSendNewsletter(id, email)
      toast({ title: 'Erfolg', description: 'Testversand gestartet.' })
    } catch (error: unknown) {
      toast({ title: 'Fehler', description: getErrorMessage(error, 'Testversand fehlgeschlagen.'), variant: 'destructive' })
    }
  }

  const handleSchedule = async (id: string) => {
    const value = (scheduleById[id] || '').trim()
    if (!value) {
      toast({ title: 'Hinweis', description: 'Bitte Versandzeitpunkt eingeben.', variant: 'destructive' })
      return
    }

    try {
      await scheduleNewsletter(id, new Date(value).toISOString())
      toast({ title: 'Erfolg', description: 'Newsletter eingeplant.' })
      await loadData()
    } catch (error: unknown) {
      toast({ title: 'Fehler', description: getErrorMessage(error, 'Planung fehlgeschlagen.'), variant: 'destructive' })
    }
  }

  const handleSendNow = async (id: string) => {
    try {
      await sendNewsletterNow(id)
      toast({ title: 'Erfolg', description: 'Versand abgeschlossen.' })
      await loadData()
    } catch (error: unknown) {
      toast({ title: 'Fehler', description: getErrorMessage(error, 'Versand fehlgeschlagen.'), variant: 'destructive' })
    }
  }

  const filteredRows = rows.filter((item) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return item.internalName.toLowerCase().includes(q) || item.subject.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      <MarketingPromoHeader
        title="Newsletter"
        description="Newsletter-Kampagnen anlegen, planen, testen und versenden."
        current="Newsletter"
      />

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Suche</Label>
            <Input placeholder="Name oder Betreff..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="draft">draft</SelectItem>
                <SelectItem value="scheduled">scheduled</SelectItem>
                <SelectItem value="sending">sending</SelectItem>
                <SelectItem value="sent">sent</SelectItem>
                <SelectItem value="failed">failed</SelectItem>
                <SelectItem value="archived">archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={loadData}>Aktualisieren</Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Neuer Newsletter
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editing ? 'Newsletter bearbeiten' : 'Newsletter erstellen'}</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label>Interner Name</Label>
                    <Input value={form.internalName} onChange={(e) => setForm((prev) => ({ ...prev, internalName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Betreff</Label>
                    <Input value={form.subject} onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Preheader</Label>
                    <Input value={form.preheader} onChange={(e) => setForm((prev) => ({ ...prev, preheader: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Segment</Label>
                    <Select value={form.segmentId} onValueChange={(value) => setForm((prev) => ({ ...prev, segmentId: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Kein Segment</SelectItem>
                        {segmentOptions.map((segment) => (
                          <SelectItem key={segment._id} value={segment._id}>{segment.internalName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Inhalt</Label>
                    <Textarea rows={10} value={form.content} onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))} />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Abbrechen</Button>
                  <Button onClick={saveNewsletter} disabled={saving}>{saving ? 'Speichert...' : 'Speichern'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading && <p className="text-sm text-slate-500">Lade Newsletter...</p>}
        {!loading && filteredRows.length === 0 && <p className="text-sm text-slate-500">Keine Newsletter gefunden.</p>}

        {filteredRows.map((item) => (
          <Card key={item._id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{item.internalName}</p>
                  <p className="text-xs text-slate-500">{item.subject}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{item.status}</Badge>
                  <Button variant="outline" size="sm" onClick={() => openEdit(item)}>Bearbeiten</Button>
                  <Button variant="outline" size="sm" onClick={() => handleDuplicate(item._id)}>
                    <Copy className="mr-1 h-4 w-4" />
                    Duplizieren
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleArchive(item._id)}>
                    <Archive className="mr-1 h-4 w-4" />
                    Archivieren
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 text-xs md:grid-cols-4">
                <div className="rounded border border-slate-200 p-2">Gesendet: {item.stats?.sent || 0}</div>
                <div className="rounded border border-slate-200 p-2">Geoeffnet: {item.stats?.opened || 0}</div>
                <div className="rounded border border-slate-200 p-2">Geklickt: {item.stats?.clicked || 0}</div>
                <div className="rounded border border-slate-200 p-2">Fehler: {item.stats?.failed || 0}</div>
              </div>

              <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="test@example.com"
                    value={testEmailById[item._id] || ''}
                    onChange={(e) => setTestEmailById((prev) => ({ ...prev, [item._id]: e.target.value }))}
                  />
                  <Button variant="outline" onClick={() => handleTestSend(item._id)}>
                    <Send className="mr-1 h-4 w-4" />
                    Test
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Input
                    type="datetime-local"
                    value={scheduleById[item._id] || ''}
                    onChange={(e) => setScheduleById((prev) => ({ ...prev, [item._id]: e.target.value }))}
                  />
                  <Button variant="outline" onClick={() => handleSchedule(item._id)}>
                    <CalendarClock className="mr-1 h-4 w-4" />
                    Planen
                  </Button>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => handleSendNow(item._id)}>Jetzt senden</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
