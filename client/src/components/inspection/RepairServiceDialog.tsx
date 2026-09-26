import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/useToast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock3, RotateCcw, Wrench } from 'lucide-react';
import {
  ORDER_VALUE_NOT_RECONCILED,
  describeRepricingConsequence,
  readOrderServiceErrorCode,
  readReconciliationDetails,
  type OrderValueReconciliationDetails,
} from '@/api/orderServices';

interface ServiceData {
  _id: string;
  // null bei einer manuellen Reparaturposition (bewusst ohne Katalog-ID)
  serviceId: {
    _id: string;
    name: string;
    price: number;
    estimatedTime: number;
  } | null;
  isManual?: boolean;
  name?: string;
  description?: string;
  price: number;
  estimatedTime: number;
  notes: string;
}

export interface RepairServiceFormData {
  serviceId: string;
  isManual: boolean;
  name: string;
  description: string;
  // STANDARD-/LISTENPREIS brutto. Der Kunden-/Händlerrabatt wird automatisch auf
  // Auftragsebene abgezogen - nie in der Position.
  price: number;
  estimatedTime: number;
  notes: string;
  reason: string;
  // Nur gesetzt, nachdem der Server eine Neuberechnung abgelehnt hat, weil der
  // gespeicherte Auftragswert nicht zu den Positionen passt (409
  // ORDER_VALUE_NOT_RECONCILED) und die Mitarbeiterin sie ausdrücklich bestätigt.
  confirmRepricing?: boolean;
}

// Vertrag mit dem Server (POST/PUT /api/order-services, siehe orderServiceRoutes.js):
//   Katalog hinzufügen:   { serviceId, price?, estimatedTime?, notes?, reason?, confirmRepricing? }
//   Manuell hinzufügen:   { isManual: true, name, description?, price, estimatedTime?, notes?, reason?,
//                           confirmRepricing? } - OHNE serviceId
//   Ändern:               { price?, estimatedTime?, notes?, name?, description? (nur manuell), reason?,
//                           confirmRepricing? }
//   Antwort:              { order, pricing, warnings: string[] }
//   Fehler:               { error: string (deutsch), code?: string, details?: object }
//
// onSave MUSS bei einem Serverfehler ein rejected Promise liefern (throw), dessen Error
// die deutsche Servermeldung als message trägt - der Dialog bleibt dann offen und zeigt
// die Meldung. Trägt der Error zusätzlich code === 'ORDER_VALUE_NOT_RECONCILED' (als
// error.code oder error.response.data.code; api/orderServices.ts behält code und details),
// zeigt der Dialog die Abweichung (gespeicherter Wert, Positionen, Rabatt, Differenz) und
// bietet die ausdrückliche Bestätigung der Neuberechnung an: onSave wird erneut mit
// confirmRepricing: true aufgerufen.
// Erfolgsmeldung und Warnungen (warnings[]) zeigt die aufrufende Seite.
interface RepairServiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  service?: ServiceData;
  mode: 'edit' | 'add';
  availableServices: Array<{ _id: string; name: string; price: number; estimatedTime: number }>;
  onSave: (data: RepairServiceFormData) => Promise<void>;
  // Kunden-/Händlerrabatt dieses Auftrags in Prozent (aus pricing.groupDiscountPercent)
  // - nur für die Vorschau; gerechnet wird ausschließlich auf dem Server.
  discountPercent?: number;
}

const formatEuro = (value: number) =>
  Number(value || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

const readErrorMessage = (error: any): string =>
  String(error?.response?.data?.error || error?.message || 'Die Änderung konnte nicht gespeichert werden.');

const emptyForm = (): RepairServiceFormData => ({
  serviceId: '',
  isManual: false,
  name: '',
  description: '',
  price: 0,
  estimatedTime: 0,
  notes: '',
  reason: '',
});

const formFromService = (service: ServiceData): RepairServiceFormData => ({
  serviceId: service.serviceId?._id || '',
  // Nur das gespeicherte Kennzeichen zählt: eine Katalogposition, deren Service inzwischen
  // gelöscht wurde (serviceId nicht mehr auflösbar), ist KEINE manuelle Position - der
  // Server übernimmt Name/Beschreibung nur bei manuellen Positionen.
  isManual: service.isManual === true,
  name: service.name || service.serviceId?.name || '',
  description: service.description || '',
  price: service.price || 0,
  estimatedTime: service.estimatedTime || 0,
  notes: service.notes || '',
  reason: '',
});

export const RepairServiceDialog: React.FC<RepairServiceDialogProps> = ({
  isOpen,
  onClose,
  service,
  mode,
  availableServices,
  onSave,
  discountPercent,
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [showServiceSuggestions, setShowServiceSuggestions] = useState(false);
  const [formData, setFormData] = useState<RepairServiceFormData>(emptyForm());
  // Fehler des letzten Speicherversuchs - bleibt im Dialog sichtbar, bis erneut
  // gespeichert oder der Dialog geschlossen wird.
  const [saveError, setSaveError] = useState<string>('');
  const [needsRepricingConfirmation, setNeedsRepricingConfirmation] = useState(false);
  const [repricingDetails, setRepricingDetails] = useState<OrderValueReconciliationDetails | null>(null);

  const noteTemplates = [
    'Erstdiagnose abgeschlossen. Bitte den Standard-Reparaturablauf fortsetzen.',
    'Kunde hat eine priorisierte Bearbeitung für diesen Service angefragt.',
    'Bitte vor Übergabe die abschließende Qualitätskontrolle dokumentieren.',
  ];

  const quickTimeOptions = [15, 30, 45, 60];

  const normalizedServiceSearch = serviceSearchTerm.trim().toLowerCase();
  const filteredAvailableServices = normalizedServiceSearch
    ? availableServices.filter((item) => {
        const name = item.name?.toLowerCase() || '';
        return name.includes(normalizedServiceSearch);
      })
    : availableServices;

  // Initialize form data (auch für manuelle Positionen ohne Katalog-ID)
  useEffect(() => {
    setSaveError('');
    setNeedsRepricingConfirmation(false);
    setRepricingDetails(null);
    if (mode === 'edit' && service) {
      setFormData(formFromService(service));
      setServiceSearchTerm(service.serviceId?.name || service.name || '');
      setShowServiceSuggestions(false);
    } else {
      setFormData(emptyForm());
      setServiceSearchTerm('');
      setShowServiceSuggestions(false);
    }
  }, [mode, service, isOpen]);

  const handleServiceSelect = (serviceId: string) => {
    const selectedService = availableServices.find((s) => s._id === serviceId);
    if (selectedService) {
      setFormData((prev) => ({
        ...prev,
        serviceId,
        price: selectedService.price,
        estimatedTime: selectedService.estimatedTime,
      }));
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setFormData((prev) => ({
      ...prev,
      price: value,
    }));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setFormData((prev) => ({
      ...prev,
      estimatedTime: value,
    }));
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      notes: e.target.value,
    }));
  };

  const handleSubmit = async (options: { confirmRepricing?: boolean } = {}) => {
    // Validation
    if (mode === 'add' && !formData.isManual && !formData.serviceId) {
      toast({
        title: 'Fehler',
        description: 'Bitte wählen Sie einen Service aus.',
        variant: 'destructive',
      });
      return;
    }

    if (formData.isManual && !formData.name.trim()) {
      toast({
        title: 'Fehler',
        description: 'Bitte geben Sie einen Namen für die manuelle Reparaturposition an.',
        variant: 'destructive',
      });
      return;
    }

    if (formData.price < 0 || formData.estimatedTime < 0) {
      toast({
        title: 'Fehler',
        description: 'Standardpreis und geschätzte Zeit dürfen nicht negativ sein.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setSaveError('');
    try {
      // Die Erfolgsmeldung zeigt die aufrufende Seite erst, wenn der Server die
      // Änderung bestätigt hat - hier keine zweite (ggf. falsche) Erfolgsmeldung.
      await onSave({
        ...formData,
        name: formData.name.trim(),
        serviceId: formData.isManual ? '' : formData.serviceId,
        ...(options.confirmRepricing ? { confirmRepricing: true } : {}),
      });
      setNeedsRepricingConfirmation(false);
      setRepricingDetails(null);
      onClose();
    } catch (error: any) {
      // Speichern fehlgeschlagen: Dialog bleibt offen, Eingaben bleiben erhalten.
      const message = readErrorMessage(error);
      console.error(`Error saving service: ${message}`);
      setSaveError(message);
      const notReconciled = readOrderServiceErrorCode(error) === ORDER_VALUE_NOT_RECONCILED && !options.confirmRepricing;
      setNeedsRepricingConfirmation(notReconciled);
      setRepricingDetails(notReconciled ? readReconciliationDetails(error) : null);
      toast({
        title: 'Fehler',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedService = availableServices.find((s) => s._id === formData.serviceId);

  const handleResetForm = () => {
    if (mode === 'edit' && service) {
      setFormData(formFromService(service));
      setServiceSearchTerm(service.serviceId?.name || service.name || '');
      setShowServiceSuggestions(false);
      return;
    }

    setFormData((prev) => ({ ...emptyForm(), isManual: prev.isManual }));
    setServiceSearchTerm('');
    setShowServiceSuggestions(false);
  };

  const setEntryMode = (isManual: boolean) => {
    setFormData({ ...emptyForm(), isManual });
    setServiceSearchTerm('');
    setShowServiceSuggestions(false);
  };

  const handleResetToPreset = () => {
    if (!selectedService) return;
    setFormData((prev) => ({
      ...prev,
      price: selectedService.price,
      estimatedTime: selectedService.estimatedTime,
    }));
  };

  const pricesValid = formData.price >= 0 && formData.estimatedTime >= 0;
  const canSubmit = formData.isManual
    ? pricesValid && Boolean(formData.name.trim())
    : mode === 'edit'
      ? pricesValid
      : Boolean(formData.serviceId) && pricesValid;

  // Vorschau: Listenpreis -> Rabatt -> Endpreis. Nur Anzeige; der Server rechnet
  // den Rabatt genau einmal auf Auftragsebene.
  const previewPercent = Math.max(0, Number(discountPercent) || 0);
  const previewListPrice = Number(formData.price || 0);
  const previewDiscount = Math.round(previewListPrice * previewPercent) / 100;
  const previewFinal = Math.max(0, previewListPrice - previewDiscount);
  const positionTitle = formData.isManual
    ? (formData.name.trim() || 'Manuelle Reparaturposition')
    : (selectedService?.name || service?.serviceId?.name || service?.name
      || (mode === 'edit' ? 'Reparaturservice bearbeiten' : 'Kein Reparaturservice ausgewählt'));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="order-dialog-content order-repair-service-dialog w-[96vw] max-w-[760px] max-h-[88vh]">
        <DialogHeader className="order-dialog-header">
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4 flex-shrink-0" />
            {mode === 'edit' ? 'Reparaturservice bearbeiten' : 'Reparaturservice zum Auftrag hinzufügen'}
          </DialogTitle>
          <DialogDescription>
            Wählen Sie eine Service-Vorlage oder erfassen Sie eine manuelle Reparaturposition. Der Preis ist immer
            der Standardpreis (brutto); Kunden- und Händlerrabatte werden automatisch abgezogen.
          </DialogDescription>
        </DialogHeader>

        <div className="order-dialog-body space-y-4 pb-2">
          {mode === 'add' && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Art der Position">
              <Button
                type="button"
                size="sm"
                variant={formData.isManual ? 'outline' : 'default'}
                onClick={() => setEntryMode(false)}
              >
                Aus dem Servicekatalog
              </Button>
              <Button
                type="button"
                size="sm"
                variant={formData.isManual ? 'default' : 'outline'}
                onClick={() => setEntryMode(true)}
              >
                Manuelle Reparaturposition
              </Button>
            </div>
          )}

          {formData.isManual && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-[0.7rem] font-bold uppercase tracking-wide text-[#1a2a5e]">
                {mode === 'add' ? '1 · Manuelle Position' : 'Manuelle Position'}
              </p>
              <div className="space-y-2">
                <Label htmlFor="manual-name">Bezeichnung *</Label>
                <Input
                  id="manual-name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="z. B. Platinenreparatur"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-description">Beschreibung</Label>
                <Textarea
                  id="manual-description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Was wird repariert? (erscheint auf Auftrag und Rechnung)"
                  rows={2}
                />
              </div>
            </div>
          )}

          {mode === 'add' && !formData.isManual && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-[0.7rem] font-bold uppercase tracking-wide text-[#1a2a5e]">
                1 · Service auswählen
              </p>
              <div className="space-y-2 relative">
                <Label htmlFor="service-search">Vorlage suchen</Label>
                <Input
                  id="service-search"
                  value={serviceSearchTerm}
                  onChange={(e) => {
                    setServiceSearchTerm(e.target.value);
                    setShowServiceSuggestions(true);
                    if (formData.serviceId) {
                      setFormData((prev) => ({
                        ...prev,
                        serviceId: '',
                      }));
                    }
                  }}
                  onFocus={() => setShowServiceSuggestions(true)}
                  onBlur={() => {
                    setTimeout(() => setShowServiceSuggestions(false), 120);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && showServiceSuggestions && filteredAvailableServices.length > 0) {
                      e.preventDefault();
                      const topResult = filteredAvailableServices[0];
                      handleServiceSelect(topResult._id);
                      setServiceSearchTerm(topResult.name);
                      setShowServiceSuggestions(false);
                    }
                  }}
                  placeholder="Nach Service-Name suchen"
                />
                {showServiceSuggestions && normalizedServiceSearch && (
                  <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                    {filteredAvailableServices.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Keine Treffer gefunden
                      </div>
                    ) : (
                      filteredAvailableServices.map((item) => (
                        <button
                          key={item._id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            handleServiceSelect(item._id);
                            setServiceSearchTerm(item.name);
                            setShowServiceSuggestions(false);
                          }}
                          className="w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-slate-900">{item.name}</p>
                            <span className="text-xs font-semibold text-slate-600">{formatEuro(item.price)}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
                {normalizedServiceSearch && (
                  <p className="text-xs text-muted-foreground">
                    {filteredAvailableServices.length} Treffer
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="service-select">Reparaturservice auswählen *</Label>
                <Select
                  value={formData.serviceId}
                  onValueChange={(value) => {
                    handleServiceSelect(value);
                    const serviceTemplate = availableServices.find((item) => item._id === value);
                    if (serviceTemplate) {
                      setServiceSearchTerm(serviceTemplate.name);
                    }
                  }}
                >
                  <SelectTrigger id="service-select">
                    <SelectValue placeholder="Reparaturservice auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredAvailableServices.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">Keine Service-Vorlagen gefunden</div>
                    ) : (
                      filteredAvailableServices.map((item) => (
                        <SelectItem key={item._id} value={item._id}>
                          {item.name} – {formatEuro(item.price)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedService && (
                <div className="rounded-md border bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">{selectedService.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">Standardwerte aus dem Servicekatalog</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border bg-slate-50 px-2.5 py-1">{formatEuro(selectedService.price)}</span>
                    <span className="rounded-full border bg-slate-50 px-2.5 py-1">{selectedService.estimatedTime} Min.</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <p className="text-[0.7rem] font-bold uppercase tracking-wide text-[#1a2a5e]">
              {mode === 'add' ? '2 · Standardpreis & Zeit' : 'Standardpreis & Zeit'}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price">Standardpreis brutto (€) *</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={handlePriceChange}
                placeholder="0,00"
                aria-describedby="price-hint"
              />
              <p id="price-hint" className="text-xs text-muted-foreground">
                Listenpreis inkl. MwSt. vor Kunden-/Händlerrabatt. Den Rabatt zieht das System automatisch
                einmal auf Auftragsebene ab – bitte keinen bereits rabattierten Preis eintragen.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Geschätzte Zeit (Minuten) *</Label>
              <Input
                id="time"
                type="number"
                min="0"
                step="15"
                value={formData.estimatedTime}
                onChange={handleTimeChange}
                placeholder="0"
              />
            </div>
            </div>

            <div className="space-y-2">
            <Label className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              Zeit-Schnellauswahl
            </Label>
            <div className="flex flex-wrap gap-2">
              {quickTimeOptions.map((time) => (
                <Button
                  key={time}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData((prev) => ({ ...prev, estimatedTime: time }))}
                >
                  {time} Min.
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFormData((prev) => ({ ...prev, estimatedTime: 0 }))}
              >
                  Leeren
              </Button>
            </div>
            </div>

            {selectedService && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetToPreset}
                >
                  <RotateCcw className="mr-1 h-3 w-3" />
                  Standardwerte wiederherstellen
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason" className="flex items-center gap-2">
              Grund der Änderung
              <span className="text-[0.62rem] font-normal text-slate-400">(wird in der Auftragshistorie gespeichert)</span>
            </Label>
            <Input
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="z. B. Zusatzschaden bei der Diagnose festgestellt"
            />
          </div>

          <div className="space-y-2">
              <Label htmlFor="notes" className="flex items-center gap-2">
                Notizen
                <span className="text-[0.62rem] font-normal text-slate-400">(optional)</span>
              </Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={handleNotesChange}
                placeholder="Zusätzliche Hinweise erfassen..."
              rows={3}
            />
            <div className="flex flex-wrap gap-2">
              {noteTemplates.map((template, index) => (
                <Button
                  key={template}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData((prev) => ({ ...prev, notes: template }))}
                >
                  Vorlage {index + 1}
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFormData((prev) => ({ ...prev, notes: '' }))}
              >
                Notizen leeren
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Vorschau</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{positionTitle}</p>
                <p className="text-xs text-slate-600 mt-1">
                  {formData.estimatedTime > 0 ? `${formData.estimatedTime} Minuten` : 'Keine Zeitangabe'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-600">Standardpreis (brutto)</p>
                <p className="text-lg font-bold text-slate-900">{formatEuro(previewListPrice)}</p>
                {(selectedService || formData.isManual) && (
                  <Badge variant="secondary" className="text-xs">
                    <Wrench className="mr-1 h-3 w-3" />
                    {formData.isManual ? 'Manuell' : 'Vorlage'}
                  </Badge>
                )}
              </div>
            </div>
            {previewPercent > 0 ? (
              <div className="grid grid-cols-3 gap-2 border-t border-blue-100 pt-2 text-xs text-slate-700">
                <span>Listenpreis: {formatEuro(previewListPrice)}</span>
                <span>Kundenrabatt {previewPercent.toLocaleString('de-DE')} %: −{formatEuro(previewDiscount)}</span>
                <span className="text-right font-semibold">Endpreis: {formatEuro(previewFinal)}</span>
              </div>
            ) : (
              <p className="border-t border-blue-100 pt-2 text-xs text-slate-600">
                Ein vereinbarter Kunden- oder Händlerrabatt wird automatisch auf Auftragsebene abgezogen.
              </p>
            )}
          </div>
          {saveError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 space-y-2"
            >
              <p className="font-semibold">Nicht gespeichert</p>
              <p>{saveError}</p>
              {needsRepricingConfirmation && (
                <div className="flex flex-col gap-2 border-t border-red-200 pt-2">
                  {repricingDetails && (
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                      <dt>Gespeicherter Auftragswert</dt>
                      <dd className="text-right font-semibold">{formatEuro(repricingDetails.storedTotal)}</dd>
                      <dt>Positionen (Standardpreise brutto)</dt>
                      <dd className="text-right">{formatEuro(repricingDetails.positionsGross)}</dd>
                      <dt>Rabatt</dt>
                      <dd className="text-right">−{formatEuro(repricingDetails.discount)}</dd>
                      <dt>Positionen abzüglich Rabatt</dt>
                      <dd className="text-right">{formatEuro(repricingDetails.expectedTotal)}</dd>
                      <dt>Abweichung</dt>
                      <dd className="text-right font-semibold">
                        {repricingDetails.difference > 0 ? '+' : repricingDetails.difference < 0 ? '−' : ''}
                        {formatEuro(Math.abs(repricingDetails.difference))}
                      </dd>
                    </dl>
                  )}
                  <p className="text-xs">{describeRepricingConsequence(repricingDetails)}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => handleSubmit({ confirmRepricing: true })}
                    disabled={isLoading || !canSubmit}
                  >
                    Neuberechnung bestätigen
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="outline"
            onClick={() => {
              handleResetForm();
              onClose();
            }}
            disabled={isLoading}
          >
            Abbrechen
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              onClick={handleResetForm}
              disabled={isLoading}
            >
              Formular zurücksetzen
            </Button>
            <Button onClick={() => handleSubmit()} disabled={!canSubmit || isLoading}>
              {isLoading ? 'Speichert...' : mode === 'edit' ? 'Service aktualisieren' : 'Reparaturservice hinzufügen'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
