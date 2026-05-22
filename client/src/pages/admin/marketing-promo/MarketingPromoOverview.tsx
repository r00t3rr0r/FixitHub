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
    <div className="marketing-promo-page space-y-4">
      <MarketingPromoHeader
        title="Marketing/Promo Uebersicht"
        description="Kampagnenleistung fuer Newsletter und Promo-Codes auf einen Blick."
        current="Uebersicht"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="marketing-promo-kpi">
          <CardHeader className="pb-1">
            <CardTitle className="marketing-promo-kpi-title">Newsletter gesendet</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between pt-0">
            <p className="marketing-promo-kpi-value font-bold">{newsletter.sent}</p>
            <Mail className="h-4 w-4 text-mcrepair-blue" />
          </CardContent>
        </Card>

        <Card className="marketing-promo-kpi">
          <CardHeader className="pb-1">
            <CardTitle className="marketing-promo-kpi-title">Open/Click</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between pt-0">
            <p className="marketing-promo-kpi-value font-bold">{newsletter.opened} / {newsletter.clicked}</p>
            <TrendingUp className="h-4 w-4 text-mcrepair-blue" />
          </CardContent>
        </Card>

        <Card className="marketing-promo-kpi">
          <CardHeader className="pb-1">
            <CardTitle className="marketing-promo-kpi-title">Aktive Promo-Codes</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between pt-0">
            <p className="marketing-promo-kpi-value font-bold">{promo.activeCodes}</p>
            <Ticket className="h-4 w-4 text-mcrepair-blue" />
          </CardContent>
        </Card>

        <Card className="marketing-promo-kpi">
          <CardHeader className="pb-1">
            <CardTitle className="marketing-promo-kpi-title">Einloesungen</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between pt-0">
            <p className="marketing-promo-kpi-value font-bold">{promo.redemptions}</p>
            <BarChart3 className="h-4 w-4 text-mcrepair-blue" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Card className="marketing-promo-panel">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base text-mcrepair-blue">Letzte Newsletter</CardTitle>
            <Button asChild variant="outline" size="sm" className="h-8 px-2 text-xs">
              <Link to="/admin/marketing-promo/newsletters">Alle</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading && <p className="text-xs marketing-promo-subtle">Lade Newsletter...</p>}
            {!loading && (overview?.recentNewsletters || []).length === 0 && (
              <p className="text-xs marketing-promo-subtle">Keine Newsletter vorhanden.</p>
            )}

            <div className="space-y-1.5">
              {(overview?.recentNewsletters || []).map((item) => (
                <div key={item._id} className="marketing-promo-item rounded border">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{item.internalName}</p>
                    <Badge variant="outline">{item.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs marketing-promo-subtle">{item.subject}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="marketing-promo-panel">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base text-mcrepair-blue">Letzte Promo-Codes</CardTitle>
            <Button asChild variant="outline" size="sm" className="h-8 px-2 text-xs">
              <Link to="/admin/marketing-promo/promo-codes">Alle</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading && <p className="text-xs marketing-promo-subtle">Lade Promo-Codes...</p>}
            {!loading && (overview?.recentPromoCodes || []).length === 0 && (
              <p className="text-xs marketing-promo-subtle">Keine Promo-Codes vorhanden.</p>
            )}

            <div className="space-y-1.5">
              {(overview?.recentPromoCodes || []).map((item) => (
                <div key={item._id} className="marketing-promo-item rounded border">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{item.code}</p>
                    <Badge variant="outline">{item.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs marketing-promo-subtle">{item.internalName}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="marketing-promo-panel">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base text-mcrepair-blue">Audit-Log (letzte Aktionen)</CardTitle>
          <Button asChild size="sm" className="marketing-promo-btn-brand h-8 px-3 text-xs">
            <Link to="/admin/marketing-promo/reports">Reports</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {(overview?.recentAudit || []).map((entry) => (
              <div key={entry._id} className="marketing-promo-item rounded border text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">{entry.action}</p>
                  <p className="text-xs marketing-promo-subtle">{new Date(entry.createdAt).toLocaleString('de-DE')}</p>
                </div>
                <p className="text-xs marketing-promo-subtle">
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
