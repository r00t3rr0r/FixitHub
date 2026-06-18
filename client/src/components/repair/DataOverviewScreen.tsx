import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Smartphone,
  Package,
  Zap,
  CheckCircle2,
  AlertCircle,
  Eye,
  FileText,
  Wrench,
  Cpu,
  Loader,
  ShieldCheck,
  Play,
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { CorrectionModal } from './CorrectionModal';

interface DataOverviewScreenProps {
  orderId: string;
  workflow: any;
  onWorkflowUpdated: (workflow: any) => void;
}

export function DataOverviewScreen({ orderId, workflow, onWorkflowUpdated }: DataOverviewScreenProps) {
  const { toast } = useToast();
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [inspection, setInspection] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true);

        const orderRes = await fetch(`/api/orders/${orderId}`);
        if (orderRes.ok) {
          const orderData = await orderRes.json();
          setOrder(orderData.order);
        }

        const inspectionRes = await fetch(`/api/device-inspections/${orderId}`);
        if (inspectionRes.ok) {
          const inspectionData = await inspectionRes.json();
          setInspection(inspectionData.inspection);
        }
      } catch (err: any) {
        console.error('Error loading data:', err);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [orderId]);

  const handleApprove = async () => {
    try {
      setApproving(true);
      const response = await fetch(`/api/repair-workflows/${orderId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          internalNotes: '',
          orderChanges: null,
          notifyCustomer: false,
        }),
      });

      if (!response.ok) throw new Error('Failed to approve repair');

      const data = await response.json();
      onWorkflowUpdated(data.workflow);
      toast({ title: 'Erfolg', description: 'Reparatur-Workflow gestartet' });
    } catch (err: any) {
      console.error('Error approving repair:', err);
      toast({ title: 'Fehler', description: err.message });
    } finally {
      setApproving(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const conditionLabel = (status: string) => {
    const map: Record<string, string> = {
      'OK': 'OK',
      'Not OK': 'Nicht OK',
      'light-wear': 'Leichte Abnutzung',
      'scratches-wear': 'Kratzer',
      'heavy-scratches-wear': 'Starke Kratzer',
      'damaged': 'Beschädigt',
      'working': 'Funktioniert',
      'not-working': 'Defekt',
      'not-applicable': 'Nicht zutreffend',
      'defective': 'Defekt',
      'not-testable': 'Nicht testbar',
    };
    return map[status] || status;
  };

  const conditionColor = (status: string) => {
    if (['OK', 'working', 'light-wear'].includes(status)) return 'emerald';
    if (['scratches-wear', 'heavy-scratches-wear', 'not-applicable', 'not-testable'].includes(status)) return 'amber';
    return 'red';
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const color = conditionColor(status);
    const cls =
      color === 'emerald'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : color === 'amber'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-red-50 text-red-600 border-red-200';
    const Icon = color === 'emerald' ? CheckCircle2 : AlertCircle;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${cls}`}>
        <Icon className="h-2.5 w-2.5" />
        {conditionLabel(status)}
      </span>
    );
  };

  const SectionHeader = ({ icon: Icon, label }: { icon: any; label: string }) => (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon className="h-3.5 w-3.5 text-[#1a2a5e]/50" />
      <span className="text-[10px] uppercase tracking-wide text-[#1a2a5e]/50 font-medium">{label}</span>
    </div>
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loadingData) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-[#1a2a5e]">
        <Loader className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Daten werden geladen…</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">

        {/* ── Auftragsinformationen ── */}
        {order && (
          <div className="rounded-xl overflow-hidden border border-[#1a2a5e]/15">
            <div className="bg-gradient-to-r from-[#1a2a5e] to-[#0f1d45] px-4 py-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15">
                <Smartphone className="h-4 w-4 text-white" />
              </span>
              <p className="text-sm font-semibold text-white leading-tight">Auftragsinformationen</p>
            </div>
            <div className="bg-white divide-y divide-[#1a2a5e]/08">
              <div className="grid grid-cols-2 gap-px bg-[#1a2a5e]/08 p-px">
                {[
                  { label: 'Auftragsnummer', value: order.orderNumber },
                  { label: 'Gerät', value: `${order.deviceBrand || ''} ${order.deviceModel || ''}`.trim() || 'N/A' },
                  { label: 'Gerätetyp', value: order.deviceType || 'N/A' },
                  { label: 'Kunde', value: order.customerId?.name || order.customerId?.firstName || 'N/A' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white p-3 space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wide text-[#1a2a5e]/50 font-medium">{label}</p>
                    <p className="text-xs font-semibold text-[#1a2a5e] break-words leading-tight">{value}</p>
                  </div>
                ))}
              </div>

              {/* Gebuchte Reparaturen */}
              <div className="px-4 py-3 space-y-1.5">
                <SectionHeader icon={Wrench} label="Gebuchte Reparaturen" />
                {Array.isArray(order.services) && order.services.length > 0 ? (
                  <div className="space-y-1">
                    {order.services.map((service: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between gap-2 rounded-md bg-[#f8f9fc] border border-[#1a2a5e]/08 px-2.5 py-1.5">
                        <span className="text-xs text-[#1a2a5e]">
                          {service?.name || service?.serviceName || String(service)}
                        </span>
                        {service?.price != null && (
                          <span className="text-[10px] font-semibold text-[#1a2a5e]">
                            {Number(service.price).toFixed(2)} €
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Keine Services gebucht</p>
                )}
                {typeof order.totalCost === 'number' && (
                  <div className="flex items-center justify-between pt-1 border-t border-[#1a2a5e]/08">
                    <span className="text-[10px] font-medium text-[#1a2a5e]/60">Gesamt</span>
                    <span className="text-xs font-bold text-[#1a2a5e]">{order.totalCost.toFixed(2)} €</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Inspektionsbericht ── */}
        {inspection && (
          <div className="rounded-xl overflow-hidden border border-[#1a2a5e]/15">
            <div className="bg-gradient-to-r from-[#1a2a5e] to-[#0f1d45] px-4 py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <ShieldCheck className="h-4 w-4 text-white" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white leading-tight">Inspektionsbericht</p>
                  {inspection.completedAt && (
                    <p className="text-[10px] text-white/60 leading-none mt-0.5">
                      Abgeschlossen {new Date(inspection.completedAt).toLocaleDateString('de-DE')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {inspection.hasFailedTests && (
                  <Badge className="bg-red-500/20 text-red-300 border border-red-400/30 text-[10px]">
                    Tests fehlgeschlagen
                  </Badge>
                )}
                {inspection.status === 'completed' && (
                  <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px]">Abgeschlossen</Badge>
                )}
                {inspection.status === 'in-progress' && (
                  <Badge className="bg-[#1a2a5e]/10 text-[#1a2a5e] border border-[#1a2a5e]/20 text-[10px]">In Bearbeitung</Badge>
                )}
              </div>
            </div>

            <div className="bg-white divide-y divide-[#1a2a5e]/08">

              {/* Summary grid: Modell, Identifikation, Gerätetests, Reparierbar */}
              {(inspection.modelVerification || inspection.identification || inspection.deviceTest || inspection.isRepairable !== undefined) && (
                <div className="grid grid-cols-2 gap-px bg-[#1a2a5e]/08 p-px">
                  {inspection.modelVerification && (
                    <div className="bg-white p-3 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Smartphone className="h-3.5 w-3.5 text-[#1a2a5e]/50" />
                        <span className="text-[10px] uppercase tracking-wide text-[#1a2a5e]/50 font-medium">Modell</span>
                      </div>
                      <p className="text-xs font-semibold text-[#1a2a5e] break-words leading-tight">
                        {inspection.modelVerification.actualModel}
                      </p>
                      {inspection.modelVerification.reportedModel &&
                        inspection.modelVerification.reportedModel !== inspection.modelVerification.actualModel && (
                          <p className="text-[10px] text-muted-foreground break-words">
                            Gemeldet: {inspection.modelVerification.reportedModel}
                          </p>
                      )}
                      <div className="flex items-center gap-1">
                        {inspection.modelVerification.verified ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                        )}
                        <span className="text-[10px] text-muted-foreground capitalize">
                          {inspection.modelVerification.verificationStatus?.replace(/-/g, ' ')}
                        </span>
                      </div>
                      {inspection.modelVerification.costDifference != null &&
                        inspection.modelVerification.costDifference !== 0 && (
                          <p className="text-[10px] text-amber-600">
                            Preisdifferenz: {inspection.modelVerification.costDifference > 0 ? '+' : ''}{inspection.modelVerification.costDifference} €
                          </p>
                      )}
                      {inspection.modelVerification.notes && (
                        <p className="text-[10px] text-muted-foreground italic break-words">{inspection.modelVerification.notes}</p>
                      )}
                    </div>
                  )}

                  {inspection.identification && (
                    <div className="bg-white p-3 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-[#1a2a5e]/50" />
                        <span className="text-[10px] uppercase tracking-wide text-[#1a2a5e]/50 font-medium">Identifikation</span>
                      </div>
                      <p className="text-xs font-semibold text-[#1a2a5e] break-words leading-tight">
                        {inspection.identification.deviceType}
                      </p>
                      {inspection.identification.imei && (
                        <p className="text-[10px] text-muted-foreground break-all">IMEI: {inspection.identification.imei}</p>
                      )}
                      {inspection.identification.serialNumber && (
                        <p className="text-[10px] text-muted-foreground break-all">S/N: {inspection.identification.serialNumber}</p>
                      )}
                    </div>
                  )}

                  {inspection.deviceTest && (
                    <div className="bg-white p-3 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-[#1a2a5e]/50" />
                        <span className="text-[10px] uppercase tracking-wide text-[#1a2a5e]/50 font-medium">Gerätetests</span>
                      </div>
                      {[
                        { key: 'charging', label: 'Laden' },
                        { key: 'power', label: 'Einschalten' },
                        { key: 'wifi', label: 'WLAN' },
                        { key: 'frontCamera', label: 'Frontkamera' },
                        { key: 'mainCamera', label: 'Hauptkamera' },
                      ].map(({ key, label }) => {
                        const test = inspection.deviceTest[key];
                        if (!test) return null;
                        const ok = test.status === 'OK';
                        return (
                          <div key={key}>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] text-muted-foreground">{label}</span>
                              <span className={`text-[10px] font-medium ${ok ? 'text-emerald-600' : 'text-red-600'}`}>
                                {ok ? 'OK' : 'Fehler'}
                              </span>
                            </div>
                            {!ok && test.notes && (
                              <p className="text-[10px] text-muted-foreground italic pl-1">{test.notes}</p>
                            )}
                          </div>
                        );
                      })}
                      {inspection.deviceTest.charging?.current && (
                        <p className="text-[10px] text-muted-foreground">Ladestrom: {inspection.deviceTest.charging.current}</p>
                      )}
                    </div>
                  )}

                  {inspection.isRepairable !== undefined && (
                    <div className="bg-white p-3 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Wrench className="h-3.5 w-3.5 text-[#1a2a5e]/50" />
                        <span className="text-[10px] uppercase tracking-wide text-[#1a2a5e]/50 font-medium">Reparierbar</span>
                      </div>
                      {inspection.isRepairable ? (
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                          <span className="text-xs font-semibold text-emerald-600">Ja</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                          <span className="text-xs font-semibold text-red-600">Nein</span>
                        </div>
                      )}
                      {inspection.repairOffer?.cost != null && (
                        <p className="text-[10px] text-muted-foreground">{inspection.repairOffer.cost} €</p>
                      )}
                      {inspection.repairOffer?.timeframe && (
                        <p className="text-[10px] text-muted-foreground">{inspection.repairOffer.timeframe}</p>
                      )}
                      {inspection.repairOffer?.description && (
                        <p className="text-[10px] text-muted-foreground italic break-words">{inspection.repairOffer.description}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Zubehör */}
              {inspection.accessories && (
                <div className="px-4 py-3 space-y-1.5">
                  <SectionHeader icon={Package} label="Zubehör & Verpackung" />
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: 'originalPackaging', label: 'Verpackung' },
                      { key: 'caseCover', label: 'Schutzhülle' },
                      { key: 'powerAdapter', label: 'Netzteil' },
                      { key: 'simTray', label: 'SIM-Schublade' },
                      { key: 'cables', label: 'Kabel' },
                    ].map(({ key, label }) => {
                      const item = inspection.accessories[key];
                      if (!item || item.present === undefined) return null;
                      return (
                        <span
                          key={key}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                            item.present
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-red-50 text-red-600 border-red-200'
                          }`}
                        >
                          {item.present ? (
                            <CheckCircle2 className="h-2.5 w-2.5" />
                          ) : (
                            <AlertCircle className="h-2.5 w-2.5" />
                          )}
                          {label}
                        </span>
                      );
                    })}
                    {Array.isArray(inspection.accessories.otherAccessories) &&
                      inspection.accessories.otherAccessories.map((acc: any, idx: number) =>
                        acc?.name ? (
                          <span
                            key={idx}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                              acc.present
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-600 border-red-200'
                            }`}
                          >
                            {acc.present ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                            {acc.name}
                          </span>
                        ) : null
                      )}
                  </div>
                  {inspection.accessories.additionalAccessoriesText && (
                    <p className="text-[10px] text-muted-foreground italic mt-1">{inspection.accessories.additionalAccessoriesText}</p>
                  )}
                </div>
              )}

              {/* Äußerer Zustand */}
              {inspection.externalInspection && (
                <div className="px-4 py-3 space-y-1.5">
                  <SectionHeader icon={Eye} label="Äußerer Zustand" />
                  <div className="space-y-1">
                    {[
                      { label: 'Display', data: inspection.externalInspection.display },
                      { label: 'Rahmen', data: inspection.externalInspection.frame },
                      { label: 'Rückseite', data: inspection.externalInspection.backCover },
                      { label: 'Tasten', data: inspection.externalInspection.buttons },
                    ].map(({ label, data }) => {
                      if (!data) return null;
                      return (
                        <div key={label} className="flex flex-col gap-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-muted-foreground">{label}</span>
                            <StatusBadge status={data.status} />
                          </div>
                          {data.notes && (
                            <p className="text-[10px] text-muted-foreground italic pl-1">{data.notes}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {inspection.externalInspection.visibleDamages?.hasDamage && (
                    <div className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-red-50 border border-red-200 px-2.5 py-2">
                      <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-px" />
                      <p className="text-[11px] text-red-700 break-words leading-snug">
                        <span className="font-semibold">Sichtbare Schäden:</span>{' '}
                        {inspection.externalInspection.visibleDamages.description}
                      </p>
                    </div>
                  )}
                  {inspection.externalInspection.uniqueNotes && (
                    <p className="text-[10px] text-muted-foreground italic mt-1">{inspection.externalInspection.uniqueNotes}</p>
                  )}
                </div>
              )}

              {/* Fehlgeschlagene Tests */}
              {inspection.hasFailedTests && Array.isArray(inspection.failedTestDetails) && inspection.failedTestDetails.length > 0 && (
                <div className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-[10px] uppercase tracking-wide text-red-500 font-medium">Fehlgeschlagene Tests</span>
                  </div>
                  <div className="space-y-1">
                    {inspection.failedTestDetails.map((test: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-1.5 rounded-md bg-red-50 border border-red-200 px-2 py-1.5">
                        <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0 mt-px" />
                        <div className="min-w-0">
                          <span className="text-[10px] font-semibold text-red-700">{test.testName}</span>
                          {test.reason && <p className="text-[10px] text-red-600 break-words">{test.reason}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Apple-spezifische Checks */}
              {inspection.appleSpecific && (
                <div className="px-4 py-3 space-y-1.5">
                  <SectionHeader icon={Cpu} label="Apple-spezifische Checks" />
                  <div className="space-y-1">
                    {inspection.appleSpecific.modemFirmware?.status && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-muted-foreground">Modem-Firmware</span>
                        <StatusBadge status={inspection.appleSpecific.modemFirmware.status} />
                      </div>
                    )}
                    {inspection.appleSpecific.modemFirmware?.notes && (
                      <p className="text-[10px] text-muted-foreground italic pl-1">{inspection.appleSpecific.modemFirmware.notes}</p>
                    )}
                    {inspection.appleSpecific.touchIdFaceId?.status &&
                      inspection.appleSpecific.touchIdFaceId.status !== 'not-applicable' && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-muted-foreground">Touch ID / Face ID</span>
                        <StatusBadge status={inspection.appleSpecific.touchIdFaceId.status} />
                      </div>
                    )}
                    {inspection.appleSpecific.touchIdFaceId?.notes &&
                      inspection.appleSpecific.touchIdFaceId.status !== 'not-applicable' && (
                      <p className="text-[10px] text-muted-foreground italic pl-1">{inspection.appleSpecific.touchIdFaceId.notes}</p>
                    )}
                    {inspection.appleSpecific.customerInfoAction?.requested &&
                      inspection.appleSpecific.customerInfoAction?.note && (
                      <div className="mt-1 flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-px" />
                        <p className="text-[10px] text-amber-700 break-words">{inspection.appleSpecific.customerInfoAction.note}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Aktionen ── */}
        <div className="rounded-xl overflow-hidden border border-[#1a2a5e]/15">
          <div className="bg-gradient-to-r from-[#1a2a5e] to-[#0f1d45] px-4 py-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15">
              <Play className="h-4 w-4 text-white" />
            </span>
            <p className="text-sm font-semibold text-white">Reparatur freigeben & starten</p>
          </div>
          <div className="bg-white px-4 py-4 space-y-3">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Überprüfen Sie alle erfassten Daten. Sie können Änderungen vornehmen oder die Reparatur direkt starten.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-[#1a2a5e]/20 text-[#1a2a5e] hover:bg-[#1a2a5e]/05 font-semibold"
                onClick={() => setShowCorrectionModal(true)}
              >
                Korrigieren
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-[#f5b800] text-[#1a2a5e] hover:bg-[#e5ab00] font-semibold border-0"
                onClick={handleApprove}
                disabled={approving}
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />
                {approving ? 'Wird gestartet…' : 'Bestätigen & Starten'}
              </Button>
            </div>
          </div>
        </div>

      </div>

      {showCorrectionModal && (
        <CorrectionModal
          orderId={orderId}
          inspection={inspection}
          order={order}
          onClose={() => setShowCorrectionModal(false)}
          onApprove={(workflow) => {
            onWorkflowUpdated(workflow);
            setShowCorrectionModal(false);
          }}
        />
      )}
    </>
  );
}
