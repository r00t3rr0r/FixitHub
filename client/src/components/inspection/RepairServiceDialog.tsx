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
  const [formData, setFormData] = useState({
    serviceId: '',
    price: 0,
    estimatedTime: 0,
    notes: '',
  });

  const noteTemplates = [
    'Erstdiagnose abgeschlossen. Bitte den Standard-Reparaturablauf fortsetzen.',
    'Kunde hat eine priorisierte Bearbeitung fuer diesen Service angefragt.',
    'Bitte vor Uebergabe die abschliessende Qualitaetskontrolle dokumentieren.',
  ];

  const quickTimeOptions = [15, 30, 45, 60];

  // Initialize form data
  useEffect(() => {
    if (mode === 'edit' && service && service.serviceId) {
      setFormData({
        serviceId: service.serviceId?._id || '',
        price: service.price || 0,
        estimatedTime: service.estimatedTime || 0,
        notes: service.notes || '',
      });
    } else {
      setFormData({
        serviceId: '',
        price: 0,
        estimatedTime: 0,
        notes: '',
      });
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
        description: 'Bitte waehlen Sie einen Service aus.',
        variant: 'destructive',
      });
      return;
    }

    if (formData.price < 0 || formData.estimatedTime < 0) {
      toast({
        title: 'Fehler',
        description: 'Preis und geschaetzte Zeit muessen positive Werte sein.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await onSave(formData);
      toast({
        title: 'Erfolg',
        description: `Service wurde erfolgreich ${mode === 'edit' ? 'aktualisiert' : 'hinzugefuegt'}.`,
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

  const handleSubmitAndContinue = async () => {
    // Keep the dialog open to speed up adding multiple services.
    if (mode === 'edit') {
      await handleSubmit();
      return;
    }

    if (!formData.serviceId) {
      toast({
        title: 'Fehler',
        description: 'Bitte waehlen Sie einen Service aus.',
        variant: 'destructive',
      });
      return;
    }

    if (formData.price < 0 || formData.estimatedTime < 0) {
      toast({
        title: 'Fehler',
        description: 'Preis und geschaetzte Zeit muessen positive Werte sein.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await onSave(formData);
      toast({
        title: 'Erfolg',
        description: 'Service wurde hinzugefuegt. Sie koennen direkt den naechsten erfassen.',
      });
      setFormData({
        serviceId: '',
        price: 0,
        estimatedTime: 0,
        notes: '',
      });
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

  const handleResetToPreset = () => {
    if (!selectedService) return;
    setFormData((prev) => ({
      ...prev,
      price: selectedService.price,
      estimatedTime: selectedService.estimatedTime,
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="order-dialog-content order-repair-service-dialog w-[96vw] max-w-[640px]">
        <DialogHeader className="order-dialog-header">
          <DialogTitle>
            {mode === 'edit' ? 'Reparaturservice bearbeiten' : 'Reparaturservice zum Auftrag hinzufuegen'}
          </DialogTitle>
          <DialogDescription>
            Nutzen Sie Vorlagen und Schnellaktionen fuer eine zuegige und praezise Erfassung.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pb-2">
          {mode === 'add' && (
            <div className="space-y-2">
              <Label htmlFor="service-select">Service *</Label>
              <Select value={formData.serviceId} onValueChange={handleServiceSelect}>
                <SelectTrigger id="service-select">
                  <SelectValue placeholder="Reparaturservice auswaehlen..." />
                </SelectTrigger>
                <SelectContent>
                  {availableServices.map((service) => (
                    <SelectItem key={service._id} value={service._id}>
                      {service.name} - ${service.price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === 'add' && selectedService && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{selectedService.name}</p>
                  <p className="text-xs text-slate-600 mt-1">Standardwerte aus dem Servicekatalog</p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  <Wrench className="mr-1 h-3 w-3" />
                  Vorlage
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-700">
                <span className="rounded-full bg-white px-2.5 py-1 border">${selectedService.price.toFixed(2)}</span>
                <span className="rounded-full bg-white px-2.5 py-1 border">{selectedService.estimatedTime} min</span>
                <button
                  type="button"
                  onClick={handleResetToPreset}
                  className="inline-flex items-center rounded-full border bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
                >
                  <RotateCcw className="mr-1 h-3 w-3" />
                  Standardwerte wiederherstellen
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price">Preis ($) *</Label>
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
              <Label htmlFor="time">Geschaetzte Zeit (Minuten) *</Label>
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
              Schnellaktionen Zeit
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

          <div className="space-y-2">
              <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={handleNotesChange}
                placeholder="Zusaetzliche Hinweise erfassen..."
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
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Abbrechen
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {mode === 'add' && (
              <Button variant="secondary" onClick={handleSubmitAndContinue} disabled={isLoading}>
                {isLoading ? 'Speichert...' : 'Speichern & weiteren erfassen'}
              </Button>
            )}
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? 'Speichert...' : mode === 'edit' ? 'Service aktualisieren' : 'Service speichern'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
