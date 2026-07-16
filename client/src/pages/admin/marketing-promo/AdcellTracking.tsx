import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/useToast'
import { getAdcellConfig, updateAdcellConfig, type AdcellConfig } from '@/api/marketingPromo'
import { invalidateAdcellConfigCache } from '@/hooks/useAdcellConfig'
import { MarketingPromoHeader } from '@/components/admin/marketing-promo/MarketingPromoHeader'
import { ExternalLink, Info } from 'lucide-react'

const DEFAULT_CONFIG: AdcellConfig = {
  enabled: true,
  pid: '10419',
  eventId: '13229',
  conversionEnabled: true,
  firstPartyEnabled: true,
  containerTagsEnabled: true,
}

export function AdcellTrackingPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<AdcellConfig>(DEFAULT_CONFIG)

  useEffect(() => {
    setLoading(true)
    getAdcellConfig()
      .then((res) => { if (res.success) setConfig(res.config) })
      .catch(() => toast({ title: 'Fehler', description: 'Konfiguration konnte nicht geladen werden.', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [])

  const set = <K extends keyof AdcellConfig>(key: K, value: AdcellConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }))

  const save = async () => {
    setSaving(true)
    try {
      const res = await updateAdcellConfig(config)
      if (res.success) {
        setConfig(res.config)
        invalidateAdcellConfigCache()
        toast({ title: 'Gespeichert', description: res.message || 'ADCELL Konfiguration wurde gespeichert.' })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Speichern fehlgeschlagen.'
      toast({ title: 'Fehler', description: msg, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const trackingUrl = (path: string, extra: string) =>
    `https://t.adcell.com/${path}?pid=${config.pid}&eventid=${config.eventId}${extra}`

  return (
    <div className="marketing-promo-page space-y-4">
      <MarketingPromoHeader
        title="ADCELL Tracking"
        description="Konfiguration des ADCELL Affiliate-Tracking-Codes für Conversion-, 1st-Party- und Retargeting-Events."
        current="ADCELL Tracking"
      />

      {/* Master toggle */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                ADCELL Tracking
                <Badge variant={config.enabled ? 'default' : 'secondary'} className="text-xs">
                  {config.enabled ? 'Aktiv' : 'Deaktiviert'}
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                Globaler Schalter – deaktiviert alle ADCELL-Skripte auf der gesamten Website.
              </CardDescription>
            </div>
            <Switch
              checked={config.enabled}
              disabled={loading}
              onCheckedChange={(v) => set('enabled', v)}
            />
          </div>
        </CardHeader>
      </Card>

      {/* Partner IDs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Partner-IDs</CardTitle>
          <CardDescription className="text-xs">
            Diese Werte werden von ADCELL vorgegeben und dürfen nicht ohne Rücksprache geändert werden.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="adcell-pid">Publisher-ID (pid)</Label>
            <Input
              id="adcell-pid"
              value={config.pid}
              disabled={loading}
              onChange={(e) => set('pid', e.target.value.replace(/\D/g, ''))}
              placeholder="10419"
            />
            <p className="text-[11px] text-slate-500">Nur Ziffern erlaubt.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adcell-eid">Event-ID (eventid)</Label>
            <Input
              id="adcell-eid"
              value={config.eventId}
              disabled={loading}
              onChange={(e) => set('eventId', e.target.value.replace(/\D/g, ''))}
              placeholder="13229"
            />
            <p className="text-[11px] text-slate-500">Nur Ziffern erlaubt.</p>
          </div>
        </CardContent>
      </Card>

      {/* Individual tracking toggles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tracking-Module</CardTitle>
          <CardDescription className="text-xs">
            Jedes Modul kann unabhängig aktiviert oder deaktiviert werden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Conversion Tracking */}
          <div className="flex items-start justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">Conversion Tracking</p>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Pflicht</Badge>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Wird auf der Bestellbestätigungsseite ausgelöst. Übergibt Bestellnummer, Betrag und Gutscheincodes.
              </p>
              {config.conversionEnabled && config.enabled && (
                <a
                  href={trackingUrl('t/track.js', '&referenz=PREVIEW&betrag=0.00')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1 text-[10px] text-blue-600 hover:underline"
                >
                  Tracking-URL-Vorschau <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
            <Switch
              checked={config.conversionEnabled}
              disabled={loading}
              onCheckedChange={(v) => set('conversionEnabled', v)}
            />
          </div>

          {/* 1st Party Tracking */}
          <div className="flex items-start justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">1st Party Tracking</p>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Pflicht</Badge>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Lädt <code className="text-[10px]">trad.js</code> auf jeder Seite und ruft{' '}
                <code className="text-[10px]">Adcell.Tracking.track()</code> bei jedem Seitenaufruf auf.
                Identifiziert Nutzer auch ohne Third-Party-Cookies.
              </p>
            </div>
            <Switch
              checked={config.firstPartyEnabled}
              disabled={loading}
              onCheckedChange={(v) => set('firstPartyEnabled', v)}
            />
          </div>

          {/* Container Tags */}
          <div className="flex items-start justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">Container Tags / Retargeting</p>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Optional</Badge>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Markiert Besucher auf Startseite, Shop, Produktseite, Warenkorb und Bestellabschluss
                für ADCELL Re-Targeting-Partner.
              </p>
            </div>
            <Switch
              checked={config.containerTagsEnabled}
              disabled={loading}
              onCheckedChange={(v) => set('containerTagsEnabled', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Info box */}
      <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
        <div className="space-y-1">
          <p className="font-semibold">Hinweis zum Betrag (betrag-Parameter)</p>
          <p>
            Der Conversion-Tracking-Parameter <code>betrag</code> wird als Netto-Warenkorbwert ohne
            Versandkosten und ohne Umsatzsteuer übergeben. Aktuell wird der gespeicherte Bruttobetrag
            der Bestellung verwendet. Für eine exakte Netto-Übergabe sollte der Checkout-Flow
            entsprechend angepasst werden.
          </p>
          <p>
            <strong>Exklusives Gutschein-Test-Code:</strong>{' '}
            <code>ADCELL_VOUCHER_TRACKING_TEST_CODE</code>
          </p>
        </div>
      </div>

      {/* Preview of generated scripts */}
      {config.enabled && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Generierte Tracking-Codes (Vorschau)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {config.conversionEnabled && (
              <div>
                <p className="text-[11px] font-semibold text-slate-600 mb-1">Conversion Tracking</p>
                <pre className="rounded bg-slate-900 text-green-400 text-[10px] p-3 overflow-x-auto whitespace-pre-wrap break-all">
{`<script type="text/javascript" async
  src="https://t.adcell.com/t/track.js?pid=${config.pid}&eventid=${config.eventId}&referenz=BESTELLNUMMER&betrag=NETTOBETRAG">
</script>
<noscript>
  <img src="https://t.adcell.com/t/track?pid=${config.pid}&eventid=${config.eventId}&referenz=BESTELLNUMMER&betrag=NETTOBETRAG"
       border="0" width="1" height="1">
</noscript>`}
                </pre>
              </div>
            )}
            {config.firstPartyEnabled && (
              <div>
                <p className="text-[11px] font-semibold text-slate-600 mb-1">1st Party Tracking</p>
                <pre className="rounded bg-slate-900 text-green-400 text-[10px] p-3 overflow-x-auto whitespace-pre-wrap break-all">
{`<script type="text/javascript" src="https://t.adcell.com/js/trad.js"></script>
<script>Adcell.Tracking.track();</script>`}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || loading} className="min-w-[140px]">
          {saving ? 'Speichern...' : 'Konfiguration speichern'}
        </Button>
      </div>
    </div>
  )
}
