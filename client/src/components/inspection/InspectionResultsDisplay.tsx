import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { useNavigate } from 'react-router-dom';
import { getInspection, generateInspectionReport } from '@/api/deviceInspection';
import {
  CheckCircle2,
  AlertCircle,
  Download,
  Smartphone,
  Package,
  Eye,
  Zap,
  FileText,
  Loader,
  ArrowRight,
  Play,
  Wrench,
  ShieldCheck,
  Cpu,
} from 'lucide-react';

interface InspectionResultsDisplayProps {
  orderId: string;
  onStartInspection?: () => void;
  userRole?: string;
}

export function InspectionResultsDisplay({ orderId, onStartInspection, userRole = 'customer' }: InspectionResultsDisplayProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [inspection, setInspection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);

  const canAccessInspectionWorkflow = userRole === 'admin' || userRole === 'staff';

  const handleStartInspection = () => {
    if (onStartInspection) {
      onStartInspection();
    } else {
      navigate(`/inspection/${orderId}`);
    }
  };

  useEffect(() => {
    fetchInspection();
  }, [orderId]);

  const fetchInspection = async () => {
    try {
      setLoading(true);
      const result = await getInspection(orderId);
      setInspection(result.inspection);
    } catch {
      setInspection(null);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true);
      const result = await generateInspectionReport(orderId);
      if (result.reportUrl) {
        const link = document.createElement('a');
        link.href = result.reportUrl;
        link.download = `inspection-report-${orderId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      toast({ title: t('common.success'), description: t('deviceInspection.downloadPdf') });
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message });
    } finally {
      setGeneratingReport(false);
    }
  };

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
    };
    return map[status] || status;
  };

  const conditionColor = (status: string) => {
    if (['OK', 'working', 'light-wear'].includes(status)) return 'emerald';
    if (['scratches-wear', 'heavy-scratches-wear', 'not-applicable', 'not-testable'].includes(status)) return 'amber';
    return 'red';
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-[#1a2a5e]">
        <Loader className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">{t('deviceInspection.loadingInspectionData')}</span>
      </div>
    );
  }

  // ── No inspection ────────────────────────────────────────────────────────
  if (!inspection) {
    if (!canAccessInspectionWorkflow) return null;

    return (
      <div className="rounded-xl border border-dashed border-[#1a2a5e]/25 bg-[#f8f9fc] p-5 text-center space-y-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#1a2a5e]/10">
          <FileText className="h-5 w-5 text-[#1a2a5e]" />
        </span>
        <div>
          <p className="text-sm font-semibold text-[#1a2a5e]">{t('deviceInspection.deviceInspection')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('deviceInspection.noInspectionCompleted')}</p>
        </div>
        <Button
          onClick={handleStartInspection}
          className="bg-[#f5b800] text-[#1a2a5e] hover:bg-[#e5ab00] font-semibold border-0 w-full"
          size="sm"
        >
          <ArrowRight className="h-4 w-4 mr-1.5" />
          {t('deviceInspection.startDeviceInspection')}
        </Button>
      </div>
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const calculateProgress = (): number => {
    const steps = [
      inspection.modelVerification,
      inspection.identification,
      inspection.accessories,
      inspection.externalInspection,
      inspection.deviceTest,
      inspection.appleSpecific,
    ];
    return Math.round((steps.filter(Boolean).length / 6) * 100);
  };

  const getCurrentStep = (): number => {
    const steps = [
      inspection.modelVerification,
      inspection.identification,
      inspection.accessories,
      inspection.externalInspection,
      inspection.deviceTest,
      inspection.appleSpecific,
    ];
    for (let i = 0; i < steps.length; i++) {
      if (!steps[i]) return i + 1;
    }
    return 6;
  };

  const stepLabel = (step: number) => {
    const labels: Record<number, string> = {
      1: t('deviceInspection.modelVerification'),
      2: t('deviceInspection.deviceIdentification'),
      3: t('deviceInspection.accessoriesPackaging'),
      4: t('deviceInspection.externalInspection'),
      5: t('deviceInspection.deviceTesting'),
      6: t('deviceInspection.appleSpecificChecks'),
    };
    return labels[step] ?? '';
  };

  const statusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { label: 'Abgeschlossen', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'in-progress':
        return { label: 'In Bearbeitung', bg: 'bg-[#1a2a5e]/10 text-[#1a2a5e] border-[#1a2a5e]/20' };
      case 'on-hold':
        return { label: 'Pausiert', bg: 'bg-amber-100 text-amber-800 border-amber-200' };
      default:
        return { label: 'Ausstehend', bg: 'bg-gray-100 text-gray-600 border-gray-200' };
    }
  };

  // ── In-Progress ──────────────────────────────────────────────────────────
  if (inspection.status === 'in-progress') {
    const progress = calculateProgress();
    const currentStep = getCurrentStep();

    return (
      <div className="space-y-3">
        {/* McRepair gradient header strip */}
        <div className="rounded-xl overflow-hidden border border-[#1a2a5e]/15">
          <div className="bg-gradient-to-r from-[#1a2a5e] to-[#0f1d45] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15">
                <FileText className="h-4 w-4 text-white" />
              </span>
              <span className="text-sm font-semibold text-white">Geräteinspektion</span>
            </div>
            <Badge className="bg-[#f5b800]/20 text-[#f5b800] border border-[#f5b800]/30 text-[10px]">
              In Bearbeitung
            </Badge>
          </div>

          <div className="bg-white p-4 space-y-3">
            {/* Progress */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#1a2a5e]">
                  Schritt {currentStep} von 6
                </span>
                <span className="font-semibold text-[#1a2a5e]">{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-[#1a2a5e]/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#1a2a5e] to-[#f5b800] transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Current step */}
            <div className="rounded-lg bg-[#f8f9fc] border border-[#1a2a5e]/10 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-[#1a2a5e]/60 font-medium mb-0.5">
                Aktueller Schritt
              </p>
              <p className="text-xs font-semibold text-[#1a2a5e]">{stepLabel(currentStep)}</p>
              {canAccessInspectionWorkflow && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {t('deviceInspection.clickContinue')}
                </p>
              )}
            </div>

            {/* Continue button — staff/admin only */}
            {canAccessInspectionWorkflow && (
              <Button
                onClick={handleStartInspection}
                className="w-full bg-[#f5b800] text-[#1a2a5e] hover:bg-[#e5ab00] font-semibold border-0"
                size="sm"
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />
                {t('deviceInspection.continueInspection')}
              </Button>
            )}

            {!canAccessInspectionWorkflow && (
              <p className="text-[10px] text-center text-muted-foreground">
                {t('deviceInspection.inspectionWillBeCompletedShortly')}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Completed inspection ─────────────────────────────────────────────────
  const sc = statusConfig(inspection.status);

  return (
    <div className="space-y-0 rounded-xl overflow-hidden border border-[#1a2a5e]/15">
      {/* Header */}
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
          <Badge className={`border text-[10px] ${sc.bg}`}>{sc.label}</Badge>
        </div>
      </div>

      <div className="bg-white divide-y divide-[#1a2a5e]/08">

        {/* Summary grid */}
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
                  <span className="text-[10px] uppercase tracking-wide text-[#1a2a5e]/50 font-medium">Gerätetyp</span>
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

        {/* Accessories */}
        {inspection.accessories && (
          <div className="px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Package className="h-3.5 w-3.5 text-[#1a2a5e]/50" />
              <span className="text-[10px] uppercase tracking-wide text-[#1a2a5e]/50 font-medium">
                {t('deviceInspection.accessories')}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'originalPackaging', label: t('deviceInspection.packaging') },
                { key: 'caseCover', label: t('deviceInspection.case') },
                { key: 'powerAdapter', label: t('deviceInspection.adapter') },
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
                      {acc.present ? (
                        <CheckCircle2 className="h-2.5 w-2.5" />
                      ) : (
                        <AlertCircle className="h-2.5 w-2.5" />
                      )}
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

        {/* External condition */}
        {inspection.externalInspection && (
          <div className="px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Eye className="h-3.5 w-3.5 text-[#1a2a5e]/50" />
              <span className="text-[10px] uppercase tracking-wide text-[#1a2a5e]/50 font-medium">
                {t('deviceInspection.externalCondition')}
              </span>
            </div>
            <div className="space-y-1">
              {[
                { label: t('deviceInspection.display'), data: inspection.externalInspection.display },
                { label: t('deviceInspection.frame'), data: inspection.externalInspection.frame },
                { label: t('deviceInspection.backCover'), data: inspection.externalInspection.backCover },
                { label: t('deviceInspection.buttons'), data: inspection.externalInspection.buttons },
              ].map(({ label, data }) => {
                if (!data) return null;
                const color = conditionColor(data.status);
                const badgeCls = color === 'emerald'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : color === 'amber'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-red-50 text-red-600 border-red-200';
                return (
                  <div key={label} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">{label}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${badgeCls}`}>
                        {color === 'emerald' ? (
                          <CheckCircle2 className="h-2.5 w-2.5" />
                        ) : (
                          <AlertCircle className="h-2.5 w-2.5" />
                        )}
                        {conditionLabel(data.status)}
                      </span>
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
                  <span className="font-semibold">{t('deviceInspection.visibleDamage')}</span>{' '}
                  {inspection.externalInspection.visibleDamages.description}
                </p>
              </div>
            )}
            {inspection.externalInspection.uniqueNotes && (
              <p className="text-[10px] text-muted-foreground italic mt-1">{inspection.externalInspection.uniqueNotes}</p>
            )}
          </div>
        )}

        {/* Failed tests detail */}
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

        {/* Apple-specific */}
        {inspection.appleSpecific && (
          <div className="px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Cpu className="h-3.5 w-3.5 text-[#1a2a5e]/50" />
              <span className="text-[10px] uppercase tracking-wide text-[#1a2a5e]/50 font-medium">Apple-spezifische Checks</span>
            </div>
            <div className="space-y-1">
              {inspection.appleSpecific.modemFirmware?.status && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">Modem-Firmware</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                    inspection.appleSpecific.modemFirmware.status === 'working'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : inspection.appleSpecific.modemFirmware.status === 'not-testable'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-red-50 text-red-600 border-red-200'
                  }`}>
                    {conditionLabel(inspection.appleSpecific.modemFirmware.status)}
                  </span>
                </div>
              )}
              {inspection.appleSpecific.modemFirmware?.notes && (
                <p className="text-[10px] text-muted-foreground italic pl-1">{inspection.appleSpecific.modemFirmware.notes}</p>
              )}
              {inspection.appleSpecific.touchIdFaceId?.status &&
                inspection.appleSpecific.touchIdFaceId.status !== 'not-applicable' && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">Touch ID / Face ID</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                    inspection.appleSpecific.touchIdFaceId.status === 'working'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-600 border-red-200'
                  }`}>
                    {conditionLabel(inspection.appleSpecific.touchIdFaceId.status)}
                  </span>
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

        {/* PDF Download */}
        {inspection.status === 'completed' && (
          <div className="px-4 py-3">
            <Button
              onClick={handleGenerateReport}
              disabled={generatingReport}
              className="w-full bg-[#f5b800] text-[#1a2a5e] hover:bg-[#e5ab00] font-semibold border-0"
              size="sm"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {generatingReport ? t('deviceInspection.generating') : t('deviceInspection.downloadPdf')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
