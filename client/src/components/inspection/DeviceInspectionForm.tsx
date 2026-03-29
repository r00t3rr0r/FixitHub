import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/useToast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import {
  initializeInspection,
  getInspection,
  updateModelVerification,
  updateIdentification,
  updateAccessories,
  updateExternalInspection,
  updateDeviceTests,
  updateAppleSpecific,
  completeInspection,
} from '@/api/deviceInspection';

interface DeviceInspectionFormProps {
  orderId: string;
  customerId?: string | null;
  deviceType: string;
  deviceBrand?: string;
  deviceModel?: string;
  onComplete?: () => void;
}

export function DeviceInspectionForm({
  orderId,
  customerId,
  deviceType,
  deviceBrand,
  deviceModel,
  onComplete,
}: DeviceInspectionFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [inspection, setInspection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [expandedSteps, setExpandedSteps] = useState<number[]>([1]);

  // Step 1: Model Verification
  const [reportedModel, setReportedModel] = useState('');
  const [actualModel, setActualModel] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'correct' | 'incorrect-more-expensive' | 'incorrect-same-cheaper' | 'unverifiable'>('correct');
  const [costDifference, setCostDifference] = useState(0);
  const [modelNotes, setModelNotes] = useState('');

  // Step 2: Identification
  const [imei, setImei] = useState('');
  const [serialNumber, setSerialNumber] = useState('');

  // Step 3: Accessories
  const [hasOriginalPackaging, setHasOriginalPackaging] = useState(false);
  const [hasCaseCover, setHasCaseCover] = useState(false);
  const [hasPowerAdapter, setHasPowerAdapter] = useState(false);
  const [accessoriesNotes, setAccessoriesNotes] = useState('');

  // Step 4: External Inspection
  const [displayStatus, setDisplayStatus] = useState<'OK' | 'Not OK'>('OK');
  const [frameStatus, setFrameStatus] = useState<'OK' | 'Not OK'>('OK');
  const [backCoverStatus, setBackCoverStatus] = useState<'OK' | 'Not OK'>('OK');
  const [buttonsStatus, setButtonsStatus] = useState<'OK' | 'Not OK'>('OK');
  const [hasDamage, setHasDamage] = useState(false);
  const [damageDescription, setDamageDescription] = useState('');
  const [externalNotes, setExternalNotes] = useState('');

  // Step 5: Device Tests
  const [chargingStatus, setChargingStatus] = useState<'OK' | 'Not OK'>('OK');
  const [powerStatus, setPowerStatus] = useState<'OK' | 'Not OK'>('OK');
  const [wifiStatus, setWifiStatus] = useState<'OK' | 'Not OK'>('OK');
  const [frontCameraStatus, setFrontCameraStatus] = useState<'OK' | 'Not OK'>('OK');
  const [mainCameraStatus, setMainCameraStatus] = useState<'OK' | 'Not OK'>('OK');

  // Step 6: Apple-specific
  const [modemFirmwarePresent, setModemFirmwarePresent] = useState(false);
  const [touchIdFaceIdApplicable, setTouchIdFaceIdApplicable] = useState(false);
  const [touchIdFaceIdWorking, setTouchIdFaceIdWorking] = useState(false);

  // Final step
  const [isRepairable, setIsRepairable] = useState<boolean | null>(null);
  const [repairCost, setRepairCost] = useState('');
  const [repairTimeframe, setRepairTimeframe] = useState('');
  const [repairDescription, setRepairDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const getVerificationStatusLabel = (
    value: 'correct' | 'incorrect-more-expensive' | 'incorrect-same-cheaper' | 'unverifiable'
  ) => {
    switch (value) {
      case 'correct':
        return t('inspection.verification.correct', 'Korrekt - Modell stimmt überein');
      case 'incorrect-more-expensive':
        return t('inspection.verification.incorrectMoreExpensive', 'Falsch - Teureres Modell');
      case 'incorrect-same-cheaper':
        return t('inspection.verification.incorrectSameCheaper', 'Falsch - Gleichwertig oder günstiger');
      case 'unverifiable':
        return t('inspection.verification.unverifiable', 'Nicht verifizierbar - Keine eindeutige Bestimmung');
      default:
        return value;
    }
  };

  const getChecklistStatusLabel = (value: 'OK' | 'Not OK') => {
    if (value === 'OK') {
      return t('inspection.status.ok', 'In Ordnung');
    }
    return t('inspection.status.notOk', 'Nicht in Ordnung');
  };

  // Initialize inspection
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);

        // First, try to get existing inspection
        let existingInspection = null;
        try {
          const result = await getInspection(orderId);
          existingInspection = result.inspection;
        } catch (error) {
          console.log('No existing inspection found, will create new one');
        }

        // If no existing inspection, initialize a new one
        if (!existingInspection) {
          const result = await initializeInspection(orderId, customerId);
          existingInspection = result.inspection;
        }

        setInspection(existingInspection);

        // Load existing data if available
        if (existingInspection) {
          const insp = existingInspection;

          if (insp.modelVerification) {
            setReportedModel(insp.modelVerification.reportedModel);
            setActualModel(insp.modelVerification.actualModel);
            setVerificationStatus(insp.modelVerification.verificationStatus);
            setCostDifference(insp.modelVerification.costDifference);
            setModelNotes(insp.modelVerification.notes);
          } else {
            // Pre-fill with order's device model for a new inspection
            // Combine brand and model, but skip placeholder values like 'N/A'
            const brandPart = deviceBrand && deviceBrand !== 'N/A' ? deviceBrand : '';
            const orderDeviceModel = [brandPart, deviceModel].filter(Boolean).join(' ');
            if (orderDeviceModel) {
              setReportedModel(orderDeviceModel);
              setActualModel(orderDeviceModel);
            }
          }

          if (insp.identification) {
            setImei(insp.identification.imei || '');
            setSerialNumber(insp.identification.serialNumber || '');
          }

          // Continue loading other fields...
        }

        setLoading(false);
      } catch (error) {
        console.error('Error initializing inspection:', error);
        toast({
          title: t('inspection.toast.errorTitle', 'Fehler'),
          description: t('inspection.toast.initError', 'Inspektion konnte nicht initialisiert werden'),
        });
        setLoading(false);
      }
    };

    init();
  }, [orderId, customerId]);

  const toggleStep = (step: number) => {
    if (expandedSteps.includes(step)) {
      setExpandedSteps(expandedSteps.filter(s => s !== step));
    } else {
      setExpandedSteps([...expandedSteps, step]);
    }
  };

  const handleModelVerification = async () => {
    try {
      setSubmitting(true);
      await updateModelVerification(
        orderId,
        reportedModel,
        actualModel,
        verificationStatus,
        costDifference,
        modelNotes
      );
      toast({
        title: t('inspection.toast.successTitle', 'Erfolg'),
        description: t('inspection.toast.modelSaved', 'Modellprüfung gespeichert'),
      });
      setCurrentStep(2);
      setExpandedSteps([2]);
    } catch (error: any) {
      toast({ title: t('inspection.toast.errorTitle', 'Fehler'), description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleIdentification = async () => {
    try {
      setSubmitting(true);
      await updateIdentification(orderId, deviceType, imei, serialNumber);
      toast({
        title: t('inspection.toast.successTitle', 'Erfolg'),
        description: t('inspection.toast.identificationSaved', 'Identifikation gespeichert'),
      });
      setCurrentStep(3);
      setExpandedSteps([3]);
    } catch (error: any) {
      toast({ title: t('inspection.toast.errorTitle', 'Fehler'), description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccessories = async () => {
    try {
      setSubmitting(true);
      await updateAccessories(orderId, {
        originalPackaging: { present: hasOriginalPackaging },
        caseCover: { present: hasCaseCover },
        powerAdapter: { present: hasPowerAdapter },
        otherAccessories: [],
        description: accessoriesNotes,
      });
      toast({
        title: t('inspection.toast.successTitle', 'Erfolg'),
        description: t('inspection.toast.accessoriesSaved', 'Zubehör gespeichert'),
      });
      setCurrentStep(4);
      setExpandedSteps([4]);
    } catch (error: any) {
      toast({ title: t('inspection.toast.errorTitle', 'Fehler'), description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExternalInspection = async () => {
    try {
      setSubmitting(true);
      await updateExternalInspection(orderId, {
        display: { status: displayStatus },
        frame: { status: frameStatus },
        backCover: { status: backCoverStatus },
        buttons: { status: buttonsStatus },
        visibleDamages: { hasDamage, description: damageDescription },
        uniqueNotes: externalNotes,
      });
      toast({
        title: t('inspection.toast.successTitle', 'Erfolg'),
        description: t('inspection.toast.externalSaved', 'Äußere Inspektion gespeichert'),
      });
      setCurrentStep(5);
      setExpandedSteps([5]);
    } catch (error: any) {
      toast({ title: t('inspection.toast.errorTitle', 'Fehler'), description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeviceTests = async () => {
    try {
      setSubmitting(true);
      await updateDeviceTests(orderId, {
        charging: { status: chargingStatus },
        power: { status: powerStatus },
        wifi: { status: wifiStatus },
        frontCamera: { status: frontCameraStatus },
        mainCamera: { status: mainCameraStatus },
      });
      toast({
        title: t('inspection.toast.successTitle', 'Erfolg'),
        description: t('inspection.toast.testsSaved', 'Gerätetests gespeichert'),
      });
      setCurrentStep(6);
      setExpandedSteps([6]);
    } catch (error: any) {
      toast({ title: t('inspection.toast.errorTitle', 'Fehler'), description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAppleSpecific = async () => {
    try {
      setSubmitting(true);
      await updateAppleSpecific(orderId, {
        modemFirmware: { present: modemFirmwarePresent },
        touchIdFaceId: { applicable: touchIdFaceIdApplicable, working: touchIdFaceIdWorking },
      });
      toast({
        title: t('inspection.toast.successTitle', 'Erfolg'),
        description: t('inspection.toast.appleSaved', 'Apple-spezifische Prüfungen gespeichert'),
      });
      setCurrentStep(7);
      setExpandedSteps([7]);
    } catch (error: any) {
      toast({ title: t('inspection.toast.errorTitle', 'Fehler'), description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteInspection = async () => {
    try {
      setSubmitting(true);
      await completeInspection(orderId, isRepairable || false, {
        cost: parseFloat(repairCost),
        timeframe: repairTimeframe,
        description: repairDescription,
      });
      toast({
        title: t('inspection.toast.successTitle', 'Erfolg'),
        description: t('inspection.toast.completed', 'Inspektion abgeschlossen'),
      });
      onComplete?.();
    } catch (error: any) {
      toast({ title: t('inspection.toast.errorTitle', 'Fehler'), description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-600 font-medium">
        {t('inspection.loading', 'Inspektion wird geladen...')}
      </div>
    );
  }

  return (
    <div className="inspection-form">
      {/* Step 1: Model Verification */}
      <Card className="inspection-step-card">
        <CardHeader
          className="inspection-step-header cursor-pointer"
          onClick={() => toggleStep(1)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={currentStep >= 1 ? 'default' : 'outline'} className={currentStep >= 1 ? 'inspection-step-badge' : ''}>
                {t('inspection.steps.step1', 'Schritt 1')}
              </Badge>
              <CardTitle className="inspection-step-title">{t('inspection.steps.modelVerification', 'Modellprüfung')}</CardTitle>
            </div>
            {expandedSteps.includes(1) ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSteps.includes(1) && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="reported-model">{t('inspection.fields.reportedModel', 'Gemeldetes Modell')}</Label>
                <Input
                  id="reported-model"
                  value={reportedModel}
                  onChange={(e) => setReportedModel(e.target.value)}
                  placeholder={t('inspection.placeholders.reportedModel', 'Vom Kunden gemeldetes Modell')}
                />
              </div>
              <div>
                <Label htmlFor="actual-model">{t('inspection.fields.actualModel', 'Tatsächliches Modell')}</Label>
                <Input
                  id="actual-model"
                  value={actualModel}
                  onChange={(e) => setActualModel(e.target.value)}
                  placeholder={t('inspection.placeholders.actualModel', 'Auf dem Gerät festgestelltes Modell')}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="verification-status">{t('inspection.fields.verificationStatus', 'Prüfstatus')}</Label>
              <Select value={verificationStatus} onValueChange={(value: any) => setVerificationStatus(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="correct">{getVerificationStatusLabel('correct')}</SelectItem>
                  <SelectItem value="incorrect-more-expensive">{getVerificationStatusLabel('incorrect-more-expensive')}</SelectItem>
                  <SelectItem value="incorrect-same-cheaper">{getVerificationStatusLabel('incorrect-same-cheaper')}</SelectItem>
                  <SelectItem value="unverifiable">{getVerificationStatusLabel('unverifiable')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {verificationStatus !== 'correct' && (
              <div>
                <Label htmlFor="cost-difference">{t('inspection.fields.costDifference', 'Kostenabweichung ($)')}</Label>
                <Input
                  id="cost-difference"
                  type="number"
                  value={costDifference}
                  onChange={(e) => setCostDifference(parseFloat(e.target.value))}
                />
              </div>
            )}

            <div>
              <Label htmlFor="model-notes">{t('inspection.fields.notes', 'Notizen')}</Label>
              <Textarea
                id="model-notes"
                value={modelNotes}
                onChange={(e) => setModelNotes(e.target.value)}
                placeholder={t('inspection.placeholders.notes', 'Zusätzliche Hinweise...')}
              />
            </div>

            <Button onClick={handleModelVerification} disabled={submitting} className="inspection-primary-button">
              {t('inspection.actions.saveContinue', 'Speichern & Weiter')}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Step 2: Identification */}
      <Card className="inspection-step-card">
        <CardHeader
          className="inspection-step-header cursor-pointer"
          onClick={() => toggleStep(2)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={currentStep >= 2 ? 'default' : 'outline'} className={currentStep >= 2 ? 'inspection-step-badge' : ''}>
                {t('inspection.steps.step2', 'Schritt 2')}
              </Badge>
              <CardTitle className="inspection-step-title">{t('inspection.steps.deviceIdentification', 'Geräteidentifikation')}</CardTitle>
            </div>
            {expandedSteps.includes(2) ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSteps.includes(2) && (
          <CardContent className="space-y-4">
            {deviceType === 'Smartphone' ? (
              <div>
                <Label htmlFor="imei">{t('inspection.fields.imei', 'IMEI-Nummer')}</Label>
                <Input
                  id="imei"
                  value={imei}
                  onChange={(e) => setImei(e.target.value)}
                  placeholder={t('inspection.placeholders.imei', 'IMEI eingeben')}
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="serial">{t('inspection.fields.serialNumber', 'Seriennummer')}</Label>
                <Input
                  id="serial"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder={t('inspection.placeholders.serialNumber', 'Seriennummer eingeben')}
                />
              </div>
            )}

            <Button onClick={handleIdentification} disabled={submitting} className="inspection-primary-button">
              {t('inspection.actions.saveContinue', 'Speichern & Weiter')}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Step 3: Accessories */}
      <Card className="inspection-step-card">
        <CardHeader
          className="inspection-step-header cursor-pointer"
          onClick={() => toggleStep(3)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={currentStep >= 3 ? 'default' : 'outline'} className={currentStep >= 3 ? 'inspection-step-badge' : ''}>
                {t('inspection.steps.step3', 'Schritt 3')}
              </Badge>
              <CardTitle className="inspection-step-title">{t('inspection.steps.accessoriesPackaging', 'Zubehör & Verpackung')}</CardTitle>
            </div>
            {expandedSteps.includes(3) ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSteps.includes(3) && (
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="packaging"
                  checked={hasOriginalPackaging}
                  onCheckedChange={(checked) => setHasOriginalPackaging(checked as boolean)}
                />
                <Label htmlFor="packaging">{t('inspection.fields.originalPackaging', 'Originalverpackung vorhanden')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="case"
                  checked={hasCaseCover}
                  onCheckedChange={(checked) => setHasCaseCover(checked as boolean)}
                />
                <Label htmlFor="case">{t('inspection.fields.caseCover', 'Hülle/Case vorhanden')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="adapter"
                  checked={hasPowerAdapter}
                  onCheckedChange={(checked) => setHasPowerAdapter(checked as boolean)}
                />
                <Label htmlFor="adapter">{t('inspection.fields.powerAdapter', 'Netzteil vorhanden (falls zutreffend)')}</Label>
              </div>
            </div>

            <div>
              <Label htmlFor="accessories-notes">{t('inspection.fields.additionalNotes', 'Zusätzliche Notizen')}</Label>
              <Textarea
                id="accessories-notes"
                value={accessoriesNotes}
                onChange={(e) => setAccessoriesNotes(e.target.value)}
                placeholder={t('inspection.placeholders.accessoriesNotes', 'Zubehör oder Zustand beschreiben...')}
              />
            </div>

            <Button onClick={handleAccessories} disabled={submitting} className="inspection-primary-button">
              {t('inspection.actions.saveContinue', 'Speichern & Weiter')}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Step 4: External Inspection */}
      <Card className="inspection-step-card">
        <CardHeader
          className="inspection-step-header cursor-pointer"
          onClick={() => toggleStep(4)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={currentStep >= 4 ? 'default' : 'outline'} className={currentStep >= 4 ? 'inspection-step-badge' : ''}>
                {t('inspection.steps.step4', 'Schritt 4')}
              </Badge>
              <CardTitle className="inspection-step-title">{t('inspection.steps.externalInspection', 'Äußere Inspektion')}</CardTitle>
            </div>
            {expandedSteps.includes(4) ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSteps.includes(4) && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: t('inspection.fields.display', 'Bildschirm'), state: displayStatus, setter: setDisplayStatus },
                { label: t('inspection.fields.frame', 'Rahmen'), state: frameStatus, setter: setFrameStatus },
                { label: t('inspection.fields.backCover', 'Rückseite'), state: backCoverStatus, setter: setBackCoverStatus },
                { label: t('inspection.fields.buttons', 'Tasten'), state: buttonsStatus, setter: setButtonsStatus },
              ].map(({ label, state, setter }) => (
                <div key={label}>
                  <Label htmlFor={label}>{label}</Label>
                  <Select value={state} onValueChange={setter as any}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OK">{getChecklistStatusLabel('OK')}</SelectItem>
                      <SelectItem value="Not OK">{getChecklistStatusLabel('Not OK')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="damage"
                  checked={hasDamage}
                  onCheckedChange={(checked) => setHasDamage(checked as boolean)}
                />
                <Label htmlFor="damage">{t('inspection.fields.visibleDamage', 'Sichtbare Schäden festgestellt')}</Label>
              </div>

              {hasDamage && (
                <div>
                  <Label htmlFor="damage-desc">{t('inspection.fields.damageDescription', 'Schäden beschreiben')}</Label>
                  <Textarea
                    id="damage-desc"
                    value={damageDescription}
                    onChange={(e) => setDamageDescription(e.target.value)}
                    placeholder={t('inspection.placeholders.damageDescription', 'Schäden beschreiben...')}
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="external-notes">{t('inspection.fields.additionalNotes', 'Zusätzliche Notizen')}</Label>
              <Textarea
                id="external-notes"
                value={externalNotes}
                onChange={(e) => setExternalNotes(e.target.value)}
                placeholder={t('inspection.placeholders.externalNotes', 'Besondere Beobachtungen...')}
              />
            </div>

            <Button onClick={handleExternalInspection} disabled={submitting} className="inspection-primary-button">
              {t('inspection.actions.saveContinue', 'Speichern & Weiter')}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Step 5: Device Tests */}
      <Card className="inspection-step-card">
        <CardHeader
          className="inspection-step-header cursor-pointer"
          onClick={() => toggleStep(5)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={currentStep >= 5 ? 'default' : 'outline'} className={currentStep >= 5 ? 'inspection-step-badge' : ''}>
                {t('inspection.steps.step5', 'Schritt 5')}
              </Badge>
              <CardTitle className="inspection-step-title">{t('inspection.steps.deviceTests', 'Gerätetests')}</CardTitle>
            </div>
            {expandedSteps.includes(5) ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSteps.includes(5) && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: t('inspection.fields.charging', 'Laden'), state: chargingStatus, setter: setChargingStatus },
                { label: t('inspection.fields.power', 'Einschalten'), state: powerStatus, setter: setPowerStatus },
                { label: t('inspection.fields.wifi', 'Wi-Fi'), state: wifiStatus, setter: setWifiStatus },
                { label: t('inspection.fields.frontCamera', 'Frontkamera'), state: frontCameraStatus, setter: setFrontCameraStatus },
                { label: t('inspection.fields.mainCamera', 'Hauptkamera'), state: mainCameraStatus, setter: setMainCameraStatus },
              ].map(({ label, state, setter }) => (
                <div key={label}>
                  <Label htmlFor={label}>{label}</Label>
                  <Select value={state} onValueChange={setter as any}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OK">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" /> {getChecklistStatusLabel('OK')}
                        </div>
                      </SelectItem>
                      <SelectItem value="Not OK">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-500" /> {getChecklistStatusLabel('Not OK')}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <Button onClick={handleDeviceTests} disabled={submitting} className="inspection-primary-button">
              {t('inspection.actions.saveContinue', 'Speichern & Weiter')}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Step 6: Apple-Specific */}
      <Card className="inspection-step-card">
        <CardHeader
          className="inspection-step-header cursor-pointer"
          onClick={() => toggleStep(6)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={currentStep >= 6 ? 'default' : 'outline'} className={currentStep >= 6 ? 'inspection-step-badge' : ''}>
                {t('inspection.steps.step6', 'Schritt 6')}
              </Badge>
              <CardTitle className="inspection-step-title">{t('inspection.steps.appleChecks', 'Apple-spezifische Prüfungen')}</CardTitle>
            </div>
            {expandedSteps.includes(6) ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSteps.includes(6) && (
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="modem"
                  checked={modemFirmwarePresent}
                  onCheckedChange={(checked) => setModemFirmwarePresent(checked as boolean)}
                />
                <Label htmlFor="modem">{t('inspection.fields.modemFirmware', 'Modem-Firmware vorhanden')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="touchid-applicable"
                  checked={touchIdFaceIdApplicable}
                  onCheckedChange={(checked) => setTouchIdFaceIdApplicable(checked as boolean)}
                />
                <Label htmlFor="touchid-applicable">{t('inspection.fields.touchFaceApplicable', 'Touch ID / Face ID vorhanden')}</Label>
              </div>
              {touchIdFaceIdApplicable && (
                <div className="ml-6 flex items-center gap-2">
                  <Checkbox
                    id="touchid-working"
                    checked={touchIdFaceIdWorking}
                    onCheckedChange={(checked) => setTouchIdFaceIdWorking(checked as boolean)}
                  />
                  <Label htmlFor="touchid-working">{t('inspection.fields.touchFaceWorking', 'Touch ID / Face ID funktioniert')}</Label>
                </div>
              )}
            </div>

            <Button onClick={handleAppleSpecific} disabled={submitting} className="inspection-primary-button">
              {t('inspection.actions.saveContinue', 'Speichern & Weiter')}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Final Step: Summary */}
      <Card className="inspection-step-card">
        <CardHeader
          className="inspection-step-header cursor-pointer"
          onClick={() => toggleStep(7)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={currentStep >= 7 ? 'default' : 'outline'} className={currentStep >= 7 ? 'inspection-step-badge' : ''}>
                {t('inspection.steps.summaryBadge', 'Abschluss')}
              </Badge>
              <CardTitle className="inspection-step-title">{t('inspection.steps.summaryTitle', 'Inspektionszusammenfassung')}</CardTitle>
            </div>
            {expandedSteps.includes(7) ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSteps.includes(7) && (
          <CardContent className="space-y-4">
            <div>
              <Label>{t('inspection.fields.repairableQuestion', 'Ist das Gerät reparierbar?')}</Label>
              <div className="inspection-repairable-actions">
                <Button
                  variant={isRepairable === true ? 'default' : 'outline'}
                  onClick={() => setIsRepairable(true)}
                  className={isRepairable === true ? 'inspection-primary-button' : ''}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {t('common.yes', 'Ja')}
                </Button>
                <Button
                  variant={isRepairable === false ? 'destructive' : 'outline'}
                  onClick={() => setIsRepairable(false)}
                  className={isRepairable === false ? 'inspection-primary-button' : ''}
                  data-destructive={isRepairable === false ? 'true' : 'false'}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  {t('common.no', 'Nein')}
                </Button>
              </div>
            </div>

            {isRepairable && (
              <>
                <div>
                  <Label htmlFor="repair-cost">{t('inspection.fields.estimatedRepairCost', 'Geschätzte Reparaturkosten ($)')}</Label>
                  <Input
                    id="repair-cost"
                    type="number"
                    value={repairCost}
                    onChange={(e) => setRepairCost(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="repair-timeframe">{t('inspection.fields.repairTimeframe', 'Reparaturzeitraum')}</Label>
                  <Input
                    id="repair-timeframe"
                    value={repairTimeframe}
                    onChange={(e) => setRepairTimeframe(e.target.value)}
                    placeholder={t('inspection.placeholders.repairTimeframe', 'z. B. 3-5 Tage')}
                  />
                </div>

                <div>
                  <Label htmlFor="repair-description">{t('inspection.fields.repairDescription', 'Reparaturbeschreibung')}</Label>
                  <Textarea
                    id="repair-description"
                    value={repairDescription}
                    onChange={(e) => setRepairDescription(e.target.value)}
                    placeholder={t('inspection.placeholders.repairDescription', 'Erforderliche Reparatur beschreiben...')}
                  />
                </div>
              </>
            )}

            <Button
              onClick={handleCompleteInspection}
              disabled={submitting || isRepairable === null}
              className="w-full inspection-primary-button"
            >
              {t('inspection.actions.completeInspection', 'Inspektion abschließen')}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
