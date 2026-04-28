import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Mail, Ticket, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/useToast'
import { getMarketingOverview, type OverviewResponse } from '@/api/marketingPromo'
import { MarketingPromoHeader } from '@/components/admin/marketing-promo/MarketingPromoHeader'

export function MarketingPromoOverview() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<OverviewResponse | null>(null)

  const getErrorMessage = (error: unknown, fallback: string) => (
    error instanceof Error ? error.message : fallback
  )

  const loadOverview = async () => {
    setLoading(true)
    try {
      const response = await getMarketingOverview()
      setOverview(response)
    } catch (error: unknown) {
      console.error('Failed to load marketing overview:', error)
      toast({
        title: 'Fehler',
        description: getErrorMessage(error, 'Uebersicht konnte nicht geladen werden.'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOverview()
  }, [])

  const newsletter = overview?.newsletterKpis || {
    sent: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    unsubscribed: 0,
    failed: 0,
  }

  const promo = overview?.promoKpis || {
    activeCodes: 0,
    redemptions: 0,
    discountVolume: 0,
    revenueAttributed: 0,
  }

  return (
    <div className="space-y-6">
      <MarketingPromoHeader
        title="Marketing/Promo Uebersicht"
        description="Kampagnenleistung fuer Newsletter und Promo-Codes auf einen Blick."
        current="Uebersicht"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Newsletter gesendet</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-2xl font-bold">{newsletter.sent}</p>
            <Mail className="h-5 w-5 text-slate-500" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Open/Click</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-2xl font-bold">{newsletter.opened} / {newsletter.clicked}</p>
            <TrendingUp className="h-5 w-5 text-slate-500" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Aktive Promo-Codes</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-2xl font-bold">{promo.activeCodes}</p>
            <Ticket className="h-5 w-5 text-slate-500" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Einloesungen</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-2xl font-bold">{promo.redemptions}</p>
            <BarChart3 className="h-5 w-5 text-slate-500" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Letzte Newsletter</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/marketing-promo/newsletters">Alle</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading && <p className="text-sm text-slate-500">Lade Newsletter...</p>}
            {!loading && (overview?.recentNewsletters || []).length === 0 && (
              <p className="text-sm text-slate-500">Keine Newsletter vorhanden.</p>
            )}
            <div className="space-y-2">
              {(overview?.recentNewsletters || []).map((item) => (
                <div key={item._id} className="rounded border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">{item.internalName}</p>
                    <Badge variant="outline">{item.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{item.subject}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Letzte Promo-Codes</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/marketing-promo/promo-codes">Alle</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading && <p className="text-sm text-slate-500">Lade Promo-Codes...</p>}
            {!loading && (overview?.recentPromoCodes || []).length === 0 && (
              <p className="text-sm text-slate-500">Keine Promo-Codes vorhanden.</p>
            )}
            <div className="space-y-2">
              {(overview?.recentPromoCodes || []).map((item) => (
                <div key={item._id} className="rounded border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">{item.code}</p>
                    <Badge variant="outline">{item.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{item.internalName}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Audit-Log (letzte Aktionen)</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/marketing-promo/reports">Reports</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(overview?.recentAudit || []).map((entry) => (
              <div key={entry._id} className="rounded border border-slate-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">{entry.action}</p>
                  <p className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString('de-DE')}</p>
                </div>
                <p className="text-xs text-slate-500">
                  {entry.entityType} {entry.entityLabel ? `(${entry.entityLabel})` : ''} • {entry.performedByEmail}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
