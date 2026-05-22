import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/useToast'
import {
  getMarketingReports,
  listMarketingAuditLogs,
  type MarketingAuditLog,
  type Newsletter,
  type PromoCode,
  type PromoRedemption,
} from '@/api/marketingPromo'
import { MarketingPromoHeader } from '@/components/admin/marketing-promo/MarketingPromoHeader'

export function MarketingPromoReports() {
  const { toast } = useToast()

  const getErrorMessage = (error: unknown, fallback: string) => (
    error instanceof Error ? error.message : fallback
  )

  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [newsletterStatus, setNewsletterStatus] = useState('all')
  const [promoStatus, setPromoStatus] = useState('all')

  const [newsletterRows, setNewsletterRows] = useState<Newsletter[]>([])
  const [promoRows, setPromoRows] = useState<PromoCode[]>([])
  const [redemptionRows, setRedemptionRows] = useState<PromoRedemption[]>([])
  const [deliveryStats, setDeliveryStats] = useState<Array<{ _id: string; count: number }>>([])
  const [auditRows, setAuditRows] = useState<MarketingAuditLog[]>([])

  const loadData = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (from) params.from = new Date(from).toISOString()
      if (to) params.to = new Date(to).toISOString()
      params.newsletterStatus = newsletterStatus
      params.promoStatus = promoStatus

      const [reportResponse, auditResponse] = await Promise.all([
        getMarketingReports(params),
        listMarketingAuditLogs({ limit: '30' }),
      ])

      setNewsletterRows(reportResponse.newsletterRows || [])
      setPromoRows(reportResponse.promoRows || [])
      setRedemptionRows(reportResponse.redemptionRows || [])
      setDeliveryStats(reportResponse.newsletterDeliveryStats || [])
      setAuditRows(auditResponse.rows || [])
    } catch (error: unknown) {
      console.error('Failed loading reports:', error)
      toast({ title: 'Fehler', description: getErrorMessage(error, 'Reports konnten nicht geladen werden.'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <div className="marketing-promo-page space-y-4">
      <MarketingPromoHeader
        title="Reports"
        description="Newsletter- und Promo-Performance inklusive Audit-Log."
        current="Reports"
      />

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="space-y-2">
            <Label>Von</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Bis</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Newsletter-Status</Label>
            <Select value={newsletterStatus} onValueChange={setNewsletterStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="draft">draft</SelectItem>
                <SelectItem value="scheduled">scheduled</SelectItem>
                <SelectItem value="sent">sent</SelectItem>
                <SelectItem value="failed">failed</SelectItem>
                <SelectItem value="archived">archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Promo-Status</Label>
            <Select value={promoStatus} onValueChange={setPromoStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
          <div className="flex items-end">
            <Button onClick={loadData}>Anwenden</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Newsletter Delivery Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {deliveryStats.length === 0 && <p className="text-sm text-slate-500">Keine Delivery-Daten.</p>}
            {deliveryStats.map((item) => (
              <div key={item._id} className="flex items-center justify-between rounded border border-slate-200 p-2 text-sm">
                <span>{item._id}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Promo KPI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="rounded border border-slate-200 p-2">Codes: {promoRows.length}</div>
            <div className="rounded border border-slate-200 p-2">Einloesungen: {redemptionRows.length}</div>
            <div className="rounded border border-slate-200 p-2">
              Rabattvolumen: {promoRows.reduce((sum, row) => sum + Number(row.discountVolume || 0), 0).toFixed(2)} EUR
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Newsletter Verlauf</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading && <p className="text-sm text-slate-500">Lade...</p>}
            {!loading && newsletterRows.length === 0 && <p className="text-sm text-slate-500">Keine Daten.</p>}
            {newsletterRows.slice(0, 25).map((row) => (
              <div key={row._id} className="rounded border border-slate-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{row.internalName}</p>
                  <Badge variant="outline">{row.status}</Badge>
                </div>
                <p className="text-xs text-slate-500">sent={row.stats?.sent || 0}, opened={row.stats?.opened || 0}, clicked={row.stats?.clicked || 0}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Promo & Redemptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {promoRows.slice(0, 15).map((row) => (
              <div key={row._id} className="rounded border border-slate-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{row.code}</p>
                  <Badge variant="outline">{row.status}</Badge>
                </div>
                <p className="text-xs text-slate-500">Einloesungen {row.usageCount || 0} • Rabatt {Number(row.discountVolume || 0).toFixed(2)} EUR</p>
              </div>
            ))}
            {redemptionRows.slice(0, 10).map((row) => (
              <div key={row._id} className="rounded border border-slate-200 p-3 text-xs text-slate-600">
                {row.promoCodeId?.code || row.code} • {Number(row.discountAmount || 0).toFixed(2)} EUR • {new Date(row.redeemedAt).toLocaleString('de-DE')}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit-Log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {auditRows.length === 0 && <p className="text-sm text-slate-500">Keine Audit-Eintraege.</p>}
          {auditRows.map((entry) => (
            <div key={entry._id} className="rounded border border-slate-200 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{entry.action}</p>
                <p className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString('de-DE')}</p>
              </div>
              <p className="text-xs text-slate-500">{entry.entityType} {entry.entityLabel ? `(${entry.entityLabel})` : ''} • {entry.performedByEmail}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
