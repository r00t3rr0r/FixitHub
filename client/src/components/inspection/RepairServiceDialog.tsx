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

interface ServiceData {
  _id: string;
  serviceId: {
    _id: string;
    name: string;
    price: number;
    estimatedTime: number;
  };
  price: number;
  estimatedTime: number;
  notes: string;
}

interface RepairServiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  service?: ServiceData;
  mode: 'edit' | 'add';
  availableServices: Array<{ _id: string; name: string; price: number; estimatedTime: number }>;
  onSave: (data: any) => Promise<void>;
}

export const RepairServiceDialog: React.FC<RepairServiceDialogProps> = ({
  isOpen,
  onClose,
  service,
  mode,
  availableServices,
  onSave,
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [showServiceSuggestions, setShowServiceSuggestions] = useState(false);
  const [formData, setFormData] = useState({
    serviceId: '',
    price: 0,
    estimatedTime: 0,
    notes: '',
  });

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

  // Initialize form data
  useEffect(() => {
    if (mode === 'edit' && service && service.serviceId) {
      setFormData({
        serviceId: service.serviceId?._id || '',
        price: service.price || 0,
        estimatedTime: service.estimatedTime || 0,
        notes: service.notes || '',
      });
      setServiceSearchTerm(service.serviceId?.name || '');
      setShowServiceSuggestions(false);
    } else {
      setFormData({
        serviceId: '',
        price: 0,
        estimatedTime: 0,
        notes: '',
      });
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

  const handleSubmit = async () => {
    // Validation
    if (mode === 'add' && !formData.serviceId) {
      toast({
        title: 'Fehler',
        description: 'Bitte wählen Sie einen Service aus.',
        variant: 'destructive',
      });
      return;
    }

    if (formData.price < 0 || formData.estimatedTime < 0) {
      toast({
        title: 'Fehler',
        description: 'Preis und geschätzte Zeit müssen positive Werte sein.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await onSave(formData);
      toast({
        title: 'Erfolg',
        description: `Service wurde erfolgreich ${mode === 'edit' ? 'aktualisiert' : 'hinzugefügt'}.`,
      });
      onClose();
    } catch (error: any) {
      console.error(`Error saving service: ${error.message}`);
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedService = availableServices.find((s) => s._id === formData.serviceId);

  const handleResetForm = () => {
    if (mode === 'edit' && service && service.serviceId) {
      setFormData({
        serviceId: service.serviceId?._id || '',
        price: service.price || 0,
        estimatedTime: service.estimatedTime || 0,
        notes: service.notes || '',
      });
      setServiceSearchTerm(service.serviceId?.name || '');
      setShowServiceSuggestions(false);
      return;
    }

    setFormData({
      serviceId: '',
      price: 0,
      estimatedTime: 0,
      notes: '',
    });
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

  const canSubmit = mode === 'edit'
    ? formData.price >= 0 && formData.estimatedTime >= 0
    : Boolean(formData.serviceId) && formData.price >= 0 && formData.estimatedTime >= 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="order-dialog-content order-repair-service-dialog w-[96vw] max-w-[760px] max-h-[88vh] overflow-y-auto">
        <DialogHeader className="order-dialog-header">
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4 flex-shrink-0" />
            {mode === 'edit' ? 'Reparaturservice bearbeiten' : 'Reparaturservice zum Auftrag hinzufügen'}
          </DialogTitle>
          <DialogDescription>
            Wählen Sie eine Service-Vorlage und passen Sie bei Bedarf Preis, Zeit und Notizen an.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pb-2">
          {mode === 'add' && (
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
                            <span className="text-xs font-semibold text-slate-600">{item.price.toFixed(2)} €</span>
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
                          {item.name} - {item.price.toFixed(2)} €
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
                    <span className="rounded-full border bg-slate-50 px-2.5 py-1">{selectedService.price.toFixed(2)} €</span>
                    <span className="rounded-full border bg-slate-50 px-2.5 py-1">{selectedService.estimatedTime} Min.</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <p className="text-[0.7rem] font-bold uppercase tracking-wide text-[#1a2a5e]">
              {mode === 'add' ? '2 · Preis & Zeit' : 'Preis & Zeit'}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price">Preis (€) *</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={handlePriceChange}
                placeholder="0.00"
              />
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
                <p className="text-sm font-semibold text-slate-900">
                  {selectedService?.name || (mode === 'edit' ? 'Reparaturservice bearbeiten' : 'Kein Reparaturservice ausgewählt')}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {formData.estimatedTime > 0 ? `${formData.estimatedTime} Minuten` : 'Keine Zeitangabe'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-900">{Number(formData.price || 0).toFixed(2)} €</p>
                {selectedService && (
                  <Badge variant="secondary" className="text-xs">
                    <Wrench className="mr-1 h-3 w-3" />
                    Vorlage
                  </Badge>
                )}
              </div>
            </div>
          </div>
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
            <Button onClick={handleSubmit} disabled={!canSubmit || isLoading}>
              {isLoading ? 'Speichert...' : mode === 'edit' ? 'Service aktualisieren' : 'Reparaturservice hinzufügen'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
