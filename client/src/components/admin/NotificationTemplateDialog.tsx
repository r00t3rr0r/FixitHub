import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/useToast"
import { NotificationTemplate, NotificationTemplateInput } from "@/api/systemConfig"
import { Plus, X, Save, Eye } from "lucide-react"

interface NotificationTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: NotificationTemplate | null
  onSave: (template: NotificationTemplateInput) => Promise<void>
  mode: 'create' | 'edit'
}

const containsHtml = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value)

export function NotificationTemplateDialog({
  open,
  onOpenChange,
  template,
  onSave,
  mode
}: NotificationTemplateDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const [formData, setFormData] = useState<NotificationTemplateInput>({
    name: '',
    type: 'email',
    subject: '',
    content: '',
    variables: [],
    isActive: true
  })

  const [newVariable, setNewVariable] = useState({
    name: '',
    description: '',
    required: false
  })

  const commonVariables = [
    { name: 'customerName', description: 'Vor- und Nachname des Kunden', required: false },
    { name: 'customerEmail', description: 'E-Mail-Adresse des Kunden', required: false },
    { name: 'orderNumber', description: 'Auftragsnummer', required: false },
    { name: 'deviceBrand', description: 'Geraetemarke', required: false },
    { name: 'deviceModel', description: 'Geraetemodell', required: false },
    { name: 'serviceName', description: 'Name der Reparaturleistung', required: false },
    { name: 'orderStatus', description: 'Aktueller Auftragsstatus', required: false },
    { name: 'bookingStatus', description: 'Aktueller Buchungsstatus', required: false },
    { name: 'statusMessage', description: 'Zusatzhinweis zum Status', required: false },
    { name: 'estimatedCompletion', description: 'Voraussichtliche Fertigstellung', required: false },
    { name: 'companyName', description: 'Unternehmensname', required: false },
    { name: 'supportEmail', description: 'Support-E-Mail', required: false },
    { name: 'supportPhone', description: 'Support-Telefonnummer', required: false },
    { name: 'trackingUrl', description: 'Link zur Sendungs- oder Auftragsverfolgung', required: false },
    { name: 'verificationUrl', description: 'Link zur Kontoaktivierung', required: false },
    { name: 'passwordResetUrl', description: 'Link zum Zuruecksetzen des Passworts', required: false },
    { name: 'invoiceUrl', description: 'Link zur Rechnung', required: false },
    { name: 'amountPaid', description: 'Gebuchter Zahlbetrag', required: false }
  ]

  useEffect(() => {
    if (template && mode === 'edit') {
      setFormData({
        name: template.name,
        type: template.type,
        subject: template.subject || '',
        content: template.content,
        variables: template.variables || [],
        isActive: template.isActive
      })
    } else if (mode === 'create') {
      setFormData({
        name: '',
        type: 'email',
        subject: '',
        content: '',
        variables: [],
        isActive: true
      })
    }
  }, [template, mode, open])

  const handleSave = async () => {
    if (!formData.name || !formData.content) {
      toast({
        title: "Fehler",
        description: "Name und Inhalt sind erforderlich",
        variant: "destructive"
      })
      return
    }

    if (formData.type === 'email' && !formData.subject) {
      toast({
        title: "Fehler",
        description: "Ein Betreff ist fuer E-Mail-Vorlagen erforderlich",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      await onSave(formData)
      onOpenChange(false)
      toast({
        title: "Erfolg",
        description: `Vorlage wurde erfolgreich ${mode === 'create' ? 'erstellt' : 'aktualisiert'}`
      })
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const addVariable = () => {
    if (!newVariable.name) {
      toast({
        title: "Fehler",
        description: "Ein Variablenname ist erforderlich",
        variant: "destructive"
      })
      return
    }

    if (formData.variables.some(v => v.name === newVariable.name)) {
      toast({
        title: "Fehler",
        description: "Eine Variable mit diesem Namen existiert bereits",
        variant: "destructive"
      })
      return
    }

    setFormData(prev => ({
      ...prev,
      variables: [...prev.variables, { ...newVariable }]
    }))

    setNewVariable({ name: '', description: '', required: false })
  }

  const removeVariable = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variables: prev.variables.filter((_, i) => i !== index)
    }))
  }

  const addCommonVariable = (variable: typeof commonVariables[0]) => {
    if (formData.variables.some(v => v.name === variable.name)) {
      toast({
        title: "Fehler",
        description: "Die Variable ist bereits vorhanden",
        variant: "destructive"
      })
      return
    }

    setFormData(prev => ({
      ...prev,
      variables: [...prev.variables, variable]
    }))
  }

  const renderPreview = () => {
    let content = formData.content
    formData.variables.forEach(variable => {
      const placeholder = `{{${variable.name}}}`
      const sampleValue = getSampleValue(variable.name)
      content = content.replace(new RegExp(placeholder, 'g'), sampleValue)
    })

    return content
  }

  const getSampleValue = (variableName: string) => {
    const sampleValues: Record<string, string> = {
      customerName: 'Max Mustermann',
      customerEmail: 'max.mustermann@example.de',
      orderNumber: 'REP-2026-1042',
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 14 Pro',
      serviceName: 'Displayreparatur',
      orderStatus: 'In Bearbeitung',
      bookingStatus: 'Diagnose abgeschlossen',
      statusMessage: 'Ihr Geraet ist in der Werkstatt eingegangen und wird aktuell geprueft.',
      estimatedCompletion: '02. April 2026',
      companyName: 'McRepair',
      supportEmail: 'service@mcrepair.de',
      supportPhone: '+49 40 1234567',
      trackingUrl: 'https://mcrepair.de/konto/auftraege/REP-2026-1042',
      verificationUrl: 'https://mcrepair.de/aktivieren/token-123',
      passwordResetUrl: 'https://mcrepair.de/passwort-zuruecksetzen/token-456',
      invoiceUrl: 'https://mcrepair.de/rechnungen/RE-2026-0091',
      amountPaid: '189,00 EUR'
    }
    return sampleValues[variableName] || `[${variableName}]`
  }

  const previewContent = renderPreview()
  const previewContainsHtml = containsHtml(previewContent)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7f] text-white p-6 rounded-t-lg">
          <DialogTitle className="text-xl">
            {mode === 'create' ? 'Benachrichtigungsvorlage erstellen' : 'Benachrichtigungsvorlage bearbeiten'}
          </DialogTitle>
          <DialogDescription className="text-blue-100 text-sm mt-2">
            Erstellen Sie professionelle Vorlagen mit dynamischen Variablen und Live-Vorschau
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 px-6">
          {/* Basic Information */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="name" className="text-sm">Vorlagenname *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="z. B. Auftragsbestaetigung Reparatur"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="type" className="text-sm">Typ *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: 'email' | 'sms' | 'push') => 
                  setFormData(prev => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">E-Mail</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="push">Push-Benachrichtigung</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Subject (for email) */}
          {formData.type === 'email' && (
            <div className="space-y-1">
              <Label htmlFor="subject" className="text-sm">Betreff *</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="z. B. Ihr Reparaturauftrag {{orderNumber}} ist eingegangen"
                className="h-9 text-sm"
              />
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="content" className="text-sm">Inhalt *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="h-8 text-xs"
              >
                <Eye className="h-3 w-3 mr-1" />
                {showPreview ? 'Vorschau ausblenden' : 'Vorschau anzeigen'}
              </Button>
            </div>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Fuegen Sie hier Text oder HTML mit {{variableName}}-Platzhaltern ein."
              rows={10}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Fuer E-Mail-Vorlagen koennen Sie komplettes HTML mit Inline-Styles verwenden. Platzhalter bleiben im Format {'{{variableName}}'}.
            </p>
            {showPreview && (
              <Card className="mt-2 border-blue-200 bg-blue-50">
                <CardHeader className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7f] text-white rounded-t p-3">
                  <CardTitle className="text-sm">Vorschau</CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  {previewContainsHtml ? (
                    <div
                      className="bg-white p-2 rounded border border-blue-200 overflow-auto max-h-[420px]"
                      dangerouslySetInnerHTML={{ __html: previewContent }}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap text-xs bg-white p-2 rounded border border-blue-200">
                      {previewContent}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Variablen</Label>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Haeufige Variablen</CardTitle>
                <CardDescription>Per Klick koennen Sie gaengige Platzhalter uebernehmen</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {commonVariables.map((variable) => (
                    <Button
                      key={variable.name}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addCommonVariable(variable)}
                      disabled={formData.variables.some(v => v.name === variable.name)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {variable.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Eigene Variable hinzufuegen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <Input
                    placeholder="Variablenname"
                    value={newVariable.name}
                    onChange={(e) => setNewVariable(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <Input
                    placeholder="Beschreibung"
                    value={newVariable.description}
                    onChange={(e) => setNewVariable(prev => ({ ...prev, description: e.target.value }))}
                  />
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={newVariable.required}
                      onCheckedChange={(checked) => setNewVariable(prev => ({ ...prev, required: checked }))}
                    />
                    <Label className="text-sm">Pflichtfeld</Label>
                  </div>
                  <Button type="button" onClick={addVariable}>
                    <Plus className="h-4 w-4 mr-2" />
                    Hinzufuegen
                  </Button>
                </div>
              </CardContent>
            </Card>

            {formData.variables.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Aktuelle Variablen</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {formData.variables.map((variable, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {`{{${variable.name}}}`}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {variable.description}
                          </span>
                          {variable.required && (
                            <Badge variant="destructive" className="text-xs">
                              Pflicht
                            </Badge>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeVariable(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
            />
            <Label>Vorlage aktiv</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Speichert...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {mode === 'create' ? 'Vorlage erstellen' : 'Vorlage aktualisieren'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}