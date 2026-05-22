import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/useToast'
import { getMarketingSettings, updateMarketingSettings, type MarketingSettings } from '@/api/marketingPromo'
import { MarketingPromoHeader } from '@/components/admin/marketing-promo/MarketingPromoHeader'

export function MarketingPromoSettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<MarketingSettings | null>(null)

  const getErrorMessage = (error: unknown, fallback: string) => (
    error instanceof Error ? error.message : fallback
  )

  const loadSettings = async () => {
    setLoading(true)
    try {
      const response = await getMarketingSettings()
      setSettings(response.settings)
    } catch (error: unknown) {
      console.error('Failed loading settings:', error)
      toast({ title: 'Fehler', description: getErrorMessage(error, 'Einstellungen konnten nicht geladen werden.'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const save = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const response = await updateMarketingSettings({
        defaultFromName: settings.defaultFromName,
        defaultReplyTo: settings.defaultReplyTo,
        trackOpens: settings.trackOpens,
        trackClicks: settings.trackClicks,
        allowTestSend: settings.allowTestSend,
        maxSendBatchSize: settings.maxSendBatchSize,
      })
      setSettings(response.settings)
      toast({ title: 'Erfolg', description: 'Einstellungen gespeichert.' })
    } catch (error: unknown) {
      console.error('Failed saving settings:', error)
      toast({ title: 'Fehler', description: getErrorMessage(error, 'Speichern fehlgeschlagen.'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="marketing-promo-page space-y-4">
      <MarketingPromoHeader
        title="Einstellungen"
        description="Globale Marketing/Promo-Defaults fuer Newsletter-Versand und Tracking."
        current="Einstellungen"
      />

      <Card>
        <CardHeader>
          <CardTitle>Versand-Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <p className="text-sm text-slate-500">Lade Einstellungen...</p>}
          {!loading && settings && (
            <>
              <div className="space-y-2">
                <Label>Default From Name</Label>
                <Input
                  value={settings.defaultFromName || ''}
                  onChange={(e) => setSettings((prev) => prev ? ({ ...prev, defaultFromName: e.target.value }) : prev)}
                />
              </div>

              <div className="space-y-2">
                <Label>Default Reply-To</Label>
                <Input
                  type="email"
                  value={settings.defaultReplyTo || ''}
                  onChange={(e) => setSettings((prev) => prev ? ({ ...prev, defaultReplyTo: e.target.value }) : prev)}
                />
              </div>

              <div className="space-y-2">
                <Label>Max Send Batch Size</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={settings.maxSendBatchSize || 200}
                  onChange={(e) => setSettings((prev) => prev ? ({ ...prev, maxSendBatchSize: Number(e.target.value) }) : prev)}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="flex items-center justify-between rounded border border-slate-200 p-3">
                  <Label>Track Opens</Label>
                  <Switch
                    checked={!!settings.trackOpens}
                    onCheckedChange={(checked) => setSettings((prev) => prev ? ({ ...prev, trackOpens: checked }) : prev)}
                  />
                </div>

                <div className="flex items-center justify-between rounded border border-slate-200 p-3">
                  <Label>Track Clicks</Label>
                  <Switch
                    checked={!!settings.trackClicks}
                    onCheckedChange={(checked) => setSettings((prev) => prev ? ({ ...prev, trackClicks: checked }) : prev)}
                  />
                </div>

                <div className="flex items-center justify-between rounded border border-slate-200 p-3">
                  <Label>Allow Test Send</Label>
                  <Switch
                    checked={!!settings.allowTestSend}
                    onCheckedChange={(checked) => setSettings((prev) => prev ? ({ ...prev, allowTestSend: checked }) : prev)}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={save} disabled={saving}>{saving ? 'Speichert...' : 'Speichern'}</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
