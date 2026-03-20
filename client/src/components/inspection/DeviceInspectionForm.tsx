import { useEffect, useState } from 'react';
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
        toast({ title: 'Error', description: 'Failed to initialize inspection' });
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
      toast({ title: 'Success', description: 'Model verification saved' });
      setCurrentStep(2);
      setExpandedSteps([2]);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleIdentification = async () => {
    try {
      setSubmitting(true);
      await updateIdentification(orderId, deviceType, imei, serialNumber);
      toast({ title: 'Success', description: 'Identification saved' });
      setCurrentStep(3);
      setExpandedSteps([3]);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message });
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
      toast({ title: 'Success', description: 'Accessories saved' });
      setCurrentStep(4);
      setExpandedSteps([4]);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message });
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
      toast({ title: 'Success', description: 'External inspection saved' });
      setCurrentStep(5);
      setExpandedSteps([5]);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message });
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
      toast({ title: 'Success', description: 'Device tests saved' });
      setCurrentStep(6);
      setExpandedSteps([6]);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message });
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
      toast({ title: 'Success', description: 'Apple-specific checks saved' });
      setCurrentStep(7);
      setExpandedSteps([7]);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message });
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
      toast({ title: 'Success', description: 'Inspection completed' });
      onComplete?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600 font-medium">Loading inspection...</div>;
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
                Step 1
              </Badge>
              <CardTitle className="inspection-step-title">Model Verification</CardTitle>
            </div>
            {expandedSteps.includes(1) ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSteps.includes(1) && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="reported-model">Reported Model</Label>
                <Input
                  id="reported-model"
                  value={reportedModel}
                  onChange={(e) => setReportedModel(e.target.value)}
                  placeholder="Model reported by customer"
                />
              </div>
              <div>
                <Label htmlFor="actual-model">Actual Model</Label>
                <Input
                  id="actual-model"
                  value={actualModel}
                  onChange={(e) => setActualModel(e.target.value)}
                  placeholder="Model found on device"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="verification-status">Verification Status</Label>
              <Select value={verificationStatus} onValueChange={(value: any) => setVerificationStatus(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="correct">Correct - Model matches</SelectItem>
                  <SelectItem value="incorrect-more-expensive">Incorrect - More expensive</SelectItem>
                  <SelectItem value="incorrect-same-cheaper">Incorrect - Same or cheaper</SelectItem>
                  <SelectItem value="unverifiable">Unverifiable - Cannot determine</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {verificationStatus !== 'correct' && (
              <div>
                <Label htmlFor="cost-difference">Cost Difference ($)</Label>
                <Input
                  id="cost-difference"
                  type="number"
                  value={costDifference}
                  onChange={(e) => setCostDifference(parseFloat(e.target.value))}
                />
              </div>
            )}

            <div>
              <Label htmlFor="model-notes">Notes</Label>
              <Textarea
                id="model-notes"
                value={modelNotes}
                onChange={(e) => setModelNotes(e.target.value)}
                placeholder="Any additional notes..."
              />
            </div>

            <Button onClick={handleModelVerification} disabled={submitting} className="inspection-primary-button">
              Save & Continue
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
                Step 2
              </Badge>
              <CardTitle className="inspection-step-title">Device Identification</CardTitle>
            </div>
            {expandedSteps.includes(2) ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSteps.includes(2) && (
          <CardContent className="space-y-4">
            {deviceType === 'Smartphone' ? (
              <div>
                <Label htmlFor="imei">IMEI Number</Label>
                <Input
                  id="imei"
                  value={imei}
                  onChange={(e) => setImei(e.target.value)}
                  placeholder="Enter IMEI"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="serial">Serial Number</Label>
                <Input
                  id="serial"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="Enter Serial Number"
                />
              </div>
            )}

            <Button onClick={handleIdentification} disabled={submitting} className="inspection-primary-button">
              Save & Continue
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
                Step 3
              </Badge>
              <CardTitle className="inspection-step-title">Accessories & Packaging</CardTitle>
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
                <Label htmlFor="packaging">Original Packaging Present</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="case"
                  checked={hasCaseCover}
                  onCheckedChange={(checked) => setHasCaseCover(checked as boolean)}
                />
                <Label htmlFor="case">Case/Cover Present</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="adapter"
                  checked={hasPowerAdapter}
                  onCheckedChange={(checked) => setHasPowerAdapter(checked as boolean)}
                />
                <Label htmlFor="adapter">Power Adapter Present (if applicable)</Label>
              </div>
            </div>

            <div>
              <Label htmlFor="accessories-notes">Additional Notes</Label>
              <Textarea
                id="accessories-notes"
                value={accessoriesNotes}
                onChange={(e) => setAccessoriesNotes(e.target.value)}
                placeholder="Describe any accessories or condition..."
              />
            </div>

            <Button onClick={handleAccessories} disabled={submitting} className="inspection-primary-button">
              Save & Continue
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
                Step 4
              </Badge>
              <CardTitle className="inspection-step-title">External Inspection</CardTitle>
            </div>
            {expandedSteps.includes(4) ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSteps.includes(4) && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Display', state: displayStatus, setter: setDisplayStatus },
                { label: 'Frame', state: frameStatus, setter: setFrameStatus },
                { label: 'Back Cover', state: backCoverStatus, setter: setBackCoverStatus },
                { label: 'Buttons', state: buttonsStatus, setter: setButtonsStatus },
              ].map(({ label, state, setter }) => (
                <div key={label}>
                  <Label htmlFor={label}>{label}</Label>
                  <Select value={state} onValueChange={setter as any}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OK">OK</SelectItem>
                      <SelectItem value="Not OK">Not OK</SelectItem>
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
                <Label htmlFor="damage">Visible Damage Detected</Label>
              </div>

              {hasDamage && (
                <div>
                  <Label htmlFor="damage-desc">Describe Damage</Label>
                  <Textarea
                    id="damage-desc"
                    value={damageDescription}
                    onChange={(e) => setDamageDescription(e.target.value)}
                    placeholder="Describe the damage..."
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="external-notes">Additional Notes</Label>
              <Textarea
                id="external-notes"
                value={externalNotes}
                onChange={(e) => setExternalNotes(e.target.value)}
                placeholder="Any unique observations..."
              />
            </div>

            <Button onClick={handleExternalInspection} disabled={submitting} className="inspection-primary-button">
              Save & Continue
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
                Step 5
              </Badge>
              <CardTitle className="inspection-step-title">Device Testing</CardTitle>
            </div>
            {expandedSteps.includes(5) ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSteps.includes(5) && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Charging', state: chargingStatus, setter: setChargingStatus },
                { label: 'Power', state: powerStatus, setter: setPowerStatus },
                { label: 'Wi-Fi', state: wifiStatus, setter: setWifiStatus },
                { label: 'Front Camera', state: frontCameraStatus, setter: setFrontCameraStatus },
                { label: 'Main Camera', state: mainCameraStatus, setter: setMainCameraStatus },
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
                          <CheckCircle2 className="h-4 w-4 text-green-500" /> OK
                        </div>
                      </SelectItem>
                      <SelectItem value="Not OK">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-500" /> Not OK
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <Button onClick={handleDeviceTests} disabled={submitting} className="inspection-primary-button">
              Save & Continue
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
                Step 6
              </Badge>
              <CardTitle className="inspection-step-title">Apple-Specific Checks</CardTitle>
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
                <Label htmlFor="modem">Modem Firmware Present</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="touchid-applicable"
                  checked={touchIdFaceIdApplicable}
                  onCheckedChange={(checked) => setTouchIdFaceIdApplicable(checked as boolean)}
                />
                <Label htmlFor="touchid-applicable">Touch ID / Face ID Applicable</Label>
              </div>
              {touchIdFaceIdApplicable && (
                <div className="ml-6 flex items-center gap-2">
                  <Checkbox
                    id="touchid-working"
                    checked={touchIdFaceIdWorking}
                    onCheckedChange={(checked) => setTouchIdFaceIdWorking(checked as boolean)}
                  />
                  <Label htmlFor="touchid-working">Touch ID / Face ID Working</Label>
                </div>
              )}
            </div>

            <Button onClick={handleAppleSpecific} disabled={submitting} className="inspection-primary-button">
              Save & Continue
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
                Summary
              </Badge>
              <CardTitle className="inspection-step-title">Inspection Summary</CardTitle>
            </div>
            {expandedSteps.includes(7) ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {expandedSteps.includes(7) && (
          <CardContent className="space-y-4">
            <div>
              <Label>Is Device Repairable?</Label>
              <div className="inspection-repairable-actions">
                <Button
                  variant={isRepairable === true ? 'default' : 'outline'}
                  onClick={() => setIsRepairable(true)}
                  className={isRepairable === true ? 'inspection-primary-button' : ''}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Yes
                </Button>
                <Button
                  variant={isRepairable === false ? 'destructive' : 'outline'}
                  onClick={() => setIsRepairable(false)}
                  className={isRepairable === false ? 'inspection-primary-button' : ''}
                  data-destructive={isRepairable === false ? 'true' : 'false'}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  No
                </Button>
              </div>
            </div>

            {isRepairable && (
              <>
                <div>
                  <Label htmlFor="repair-cost">Estimated Repair Cost ($)</Label>
                  <Input
                    id="repair-cost"
                    type="number"
                    value={repairCost}
                    onChange={(e) => setRepairCost(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="repair-timeframe">Repair Timeframe</Label>
                  <Input
                    id="repair-timeframe"
                    value={repairTimeframe}
                    onChange={(e) => setRepairTimeframe(e.target.value)}
                    placeholder="e.g., 3-5 days"
                  />
                </div>

                <div>
                  <Label htmlFor="repair-description">Repair Description</Label>
                  <Textarea
                    id="repair-description"
                    value={repairDescription}
                    onChange={(e) => setRepairDescription(e.target.value)}
                    placeholder="Describe the repair needed..."
                  />
                </div>
              </>
            )}

            <Button
              onClick={handleCompleteInspection}
              disabled={submitting || isRepairable === null}
              className="w-full inspection-primary-button"
            >
              Complete Inspection
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
