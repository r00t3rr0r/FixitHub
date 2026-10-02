import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import { approveRepairStart, defaultRepairCustomerMessage, describeCustomerNotification } from '@/api/repairWorkflow';
import { formatEUR } from '@/lib/utils';
import {
  FileText,
  Bell,
  Wrench,
  AlertCircle,
  Smartphone,
  Euro,
  Lock,
  Send,
} from 'lucide-react';

interface CorrectionModalProps {
  orderId: string;
  inspection?: any;
  order?: any;
  onClose: () => void;
  onApprove: (workflow: any) => void;
}

export function CorrectionModal({ orderId, inspection, order, onClose, onApprove }: CorrectionModalProps) {
  const { toast } = useToast();
  const [internalNotes, setInternalNotes] = useState('');
  const [notifyCustomer, setNotifyCustomer] = useState(false);
  const [customerMessage, setCustomerMessage] = useState(() => defaultRepairCustomerMessage('approve', order));
  const [loading, setLoading] = useState(false);

  // Dynamic order changes based on inspection data
  const [correctedModel, setCorrectedModel] = useState('');
  const [correctedServices, setCorrectedServices] = useState('');
  const [correctedCost, setCorrectedCost] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  useEffect(() => {
    if (inspection?.modelVerification && !inspection.modelVerification.verified) {
      setCorrectedModel(inspection.modelVerification.actualModel || '');
    }
  }, [inspection]);

  const hasModelMismatch =
    inspection?.modelVerification &&
    !inspection.modelVerification.verified;

  const hasCostDifference =
    inspection?.modelVerification?.costDifference != null &&
    inspection.modelVerification.costDifference !== 0;

  const hasFailedTests = inspection?.hasFailedTests;

  const buildOrderChanges = () => {
    const changes: Record<string, any> = {};
    if (correctedModel.trim()) changes.correctedModel = correctedModel.trim();
    if (correctedServices.trim()) changes.correctedServices = correctedServices.trim();
    if (correctedCost.trim()) changes.correctedCost = correctedCost.trim();
    if (additionalNotes.trim()) changes.additionalNotes = additionalNotes.trim();
    return Object.keys(changes).length > 0 ? changes : null;
  };

  // Ueber den gemeinsamen API-Client (CSRF-Header, deutsche Servermeldungen) - NOTIF-6.
  // Speichern und Kundenbenachrichtigung werden getrennt gemeldet.
  const handleSave = async () => {
    if (notifyCustomer && !customerMessage.trim()) {
      toast({ title: 'Hinweis', description: 'Bitte die Nachricht an den Kunden eingeben oder „Kunde informieren“ ausschalten.', variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const result = await approveRepairStart(orderId, internalNotes, buildOrderChanges(), notifyCustomer, customerMessage.trim());
      toast({ title: 'Gespeichert', description: 'Korrekturen gespeichert, die Reparatur wurde gestartet.' });
      const described = describeCustomerNotification(result.customerNotification);
      if (described) {
        toast({
          title: described.title,
          description: described.description,
          variant: described.tone === 'success' || described.tone === 'info' ? undefined : 'destructive',
        });
      }
      (result.warnings || []).filter((warning) => /Auftragsstatus/.test(warning)).forEach((warning) => {
        toast({ title: 'Hinweis', description: warning, variant: 'destructive' });
      });
      onApprove(result.workflow);
    } catch (err: any) {
      console.error('Error saving corrections:', err);
      toast({
        title: 'Nicht gespeichert',
        description: err.message || 'Die Korrektur konnte nicht gespeichert werden.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1a2a5e]">
            <Wrench className="h-5 w-5" />
            Auftrag korrigieren
          </DialogTitle>
          <DialogDescription>
            Passen Sie die Auftragsdaten an und fügen Sie interne Notizen hinzu, bevor der Workflow gestartet wird.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">

          {/* Interne Notiz */}
          <div className="space-y-2">
            <Label htmlFor="correction-notes" className="text-sm font-medium text-slate-700 flex flex-wrap items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              Interne Notiz
              <Badge variant="outline" className="gap-1 border-slate-300 bg-slate-100 text-[10px] text-slate-700">
                <Lock className="h-3 w-3" aria-hidden="true" /> Intern – nur für das Team
              </Badge>
            </Label>
            <Textarea
              id="correction-notes"
              placeholder="z. B. spezielle Handlungsschritte, Abweichungen – wird dem Kunden nie gesendet"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              disabled={loading}
              className="min-h-[90px] resize-none text-sm"
            />
          </div>

          <Separator />

          {/* Änderungen am Auftrag – dynamisch */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-[#1a2a5e]" />
              <span className="text-sm font-semibold text-slate-800">Änderungen am Auftrag</span>
            </div>

            {/* Modellkorrektur – nur wenn Mismatch erkannt */}
            {hasModelMismatch && (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-3.5 w-3.5 text-amber-600" />
                  <Label htmlFor="corrected-model" className="text-xs font-medium text-amber-800">
                    Modellkorrektur
                  </Label>
                  <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-100 text-amber-700">
                    Abweichung erkannt
                  </Badge>
                </div>
                <p className="text-[11px] text-amber-700">
                  Gemeldet: <span className="font-medium">{inspection.modelVerification.reportedModel}</span>
                  {' → '}Tatsächlich: <span className="font-medium">{inspection.modelVerification.actualModel}</span>
                </p>
                <Input
                  id="corrected-model"
                  value={correctedModel}
                  onChange={(e) => setCorrectedModel(e.target.value)}
                  placeholder="Korrektes Modell eingeben"
                  disabled={loading}
                  className="text-sm"
                />
              </div>
            )}

            {/* Kostenkorrektur – nur wenn Preisdifferenz */}
            {hasCostDifference && (
              <div className="space-y-2 rounded-lg border border-orange-200 bg-orange-50/50 p-3">
                <div className="flex items-center gap-2">
                  <Euro className="h-3.5 w-3.5 text-orange-600" />
                  <Label htmlFor="corrected-cost" className="text-xs font-medium text-orange-800">
                    Kostenanpassung
                  </Label>
                </div>
                <p className="text-[11px] text-orange-700">
                  Preisdifferenz: <span className="font-semibold">
                    {inspection.modelVerification.costDifference > 0 ? '+' : ''}
                    {formatEUR(inspection.modelVerification.costDifference)}
                  </span>
                </p>
                <Input
                  id="corrected-cost"
                  value={correctedCost}
                  onChange={(e) => setCorrectedCost(e.target.value)}
                  placeholder="Neuer Gesamtpreis (€)"
                  disabled={loading}
                  className="text-sm"
                  type="number"
                  step="0.01"
                />
              </div>
            )}

            {/* Fehlgeschlagene Tests Hinweis */}
            {hasFailedTests && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/50 p-3">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-red-800">Fehlgeschlagene Tests erkannt</p>
                  <p className="text-[11px] text-red-700">
                    Bitte prüfen Sie, ob zusätzliche Reparaturen oder angepasste Services erforderlich sind.
                  </p>
                </div>
              </div>
            )}

            {/* Reparaturservices anpassen */}
            <div className="space-y-2">
              <Label htmlFor="corrected-services" className="text-xs font-medium text-slate-700">
                Reparaturservices anpassen
                <span className="text-slate-400 font-normal ml-1">(optional)</span>
              </Label>
              <Textarea
                id="corrected-services"
                value={correctedServices}
                onChange={(e) => setCorrectedServices(e.target.value)}
                placeholder="z. B. zusätzliche Reparatur hinzufügen, Service entfernen …"
                disabled={loading}
                className="min-h-[60px] resize-none text-sm"
              />
            </div>

            {/* Weitere Änderungen */}
            <div className="space-y-2">
              <Label htmlFor="additional-changes" className="text-xs font-medium text-slate-700">
                Sonstige Änderungen
                <span className="text-slate-400 font-normal ml-1">(optional)</span>
              </Label>
              <Input
                id="additional-changes"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Weitere Anpassungen am Auftrag …"
                disabled={loading}
                className="text-sm"
              />
            </div>
          </div>

          <Separator />

          {/* Kunde informieren: nur der Text "Nachricht an Kunden" geht hinaus, nie die interne Notiz */}
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Bell className="h-4 w-4 text-[#1a2a5e]" />
                <div>
                  <p className="text-sm font-medium text-slate-800">Kunde informieren</p>
                  <p className="text-[11px] text-slate-500">Benachrichtigung im Kundenkonto und E-Mail beim Speichern</p>
                </div>
              </div>
              <Switch
                checked={notifyCustomer}
                onCheckedChange={setNotifyCustomer}
                disabled={loading}
                aria-label="Kunde informieren"
              />
            </div>
            {notifyCustomer && (
              <div className="space-y-1.5">
                <Label htmlFor="correction-customer-message" className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-700">
                  Nachricht an Kunden
                  <Badge variant="outline" className="gap-1 border-blue-300 bg-blue-50 text-[10px] text-blue-800">
                    <Send className="h-3 w-3" aria-hidden="true" /> An Kunden
                  </Badge>
                </Label>
                <Textarea
                  id="correction-customer-message"
                  value={customerMessage}
                  onChange={(e) => setCustomerMessage(e.target.value)}
                  disabled={loading}
                  className="min-h-[70px] resize-none text-sm bg-white"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="border-slate-200"
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-[#1a2a5e] hover:bg-[#2a3f7e] text-white"
          >
            {loading ? 'Wird gespeichert…' : 'Speichern & Fortfahren'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
