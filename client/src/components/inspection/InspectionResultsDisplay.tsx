import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/useToast';
import { useNavigate } from 'react-router-dom';
import { getInspection, generateInspectionReport } from '@/api/deviceInspection';
import {
  CheckCircle2,
  AlertCircle,
  Download,
  Clock,
  Smartphone,
  Package,
  Eye,
  Zap,
  Apple,
  FileText,
  Loader,
  ArrowRight,
  Play,
} from 'lucide-react';

interface InspectionResultsDisplayProps {
  orderId: string;
  onStartInspection?: () => void;
}

export function InspectionResultsDisplay({ orderId, onStartInspection }: InspectionResultsDisplayProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [inspection, setInspection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);

  const handleStartInspection = () => {
    if (onStartInspection) {
      onStartInspection();
    } else {
      // Navigate to inspection workflow page
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
    } catch (error: any) {
      console.log('Inspection not found, which is normal if not yet created');
      setInspection(null);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true);
      const result = await generateInspectionReport(orderId);

      // Download the report
      if (result.reportUrl) {
        const link = document.createElement('a');
        link.href = result.reportUrl;
        link.download = `inspection-report-${orderId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast({ title: 'Success', description: 'Report generated and downloaded' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message });
    } finally {
      setGeneratingReport(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader className="h-5 w-5 animate-spin" />
          <span className="ml-2">Loading inspection data...</span>
        </CardContent>
      </Card>
    );
  }

  // No inspection yet
  if (!inspection) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Device Inspection
          </CardTitle>
          <CardDescription>No inspection has been completed yet for this device</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleStartInspection} className="w-full">
            <ArrowRight className="h-4 w-4 mr-2" />
            Start Device Inspection
          </Button>
        </CardContent>
      </Card>
    );
  }

  const calculateProgress = (): number => {
    if (!inspection) return 0;

    const steps = [
      inspection.modelVerification,
      inspection.identification,
      inspection.accessories,
      inspection.externalInspection,
      inspection.deviceTest,
      inspection.appleSpecific,
    ];

    const completedSteps = steps.filter(step => step !== null && step !== undefined).length;
    return Math.round((completedSteps / 6) * 100);
  };

  const getCurrentStep = (): number => {
    if (!inspection) return 0;

    const steps = [
      inspection.modelVerification,
      inspection.identification,
      inspection.accessories,
      inspection.externalInspection,
      inspection.deviceTest,
      inspection.appleSpecific,
    ];

    for (let i = 0; i < steps.length; i++) {
      if (!steps[i]) {
        return i + 1;
      }
    }
    return 6;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'in-progress':
        return <Badge className="bg-blue-500">In Progress</Badge>;
      case 'on-hold':
        return <Badge className="bg-yellow-500">On Hold</Badge>;
      default:
        return <Badge className="bg-gray-500">Not Started</Badge>;
    }
  };

  const testStatusIcon = (status: string) => {
    return status === 'OK' ? (
      <CheckCircle2 className="h-4 w-4 text-green-500" />
    ) : (
      <AlertCircle className="h-4 w-4 text-red-500" />
    );
  };

  // Show special UI for in-progress inspections
  if (inspection && inspection.status === 'in-progress') {
    const progress = calculateProgress();
    const currentStep = getCurrentStep();

    return (
      <div className="space-y-4">
        {/* In-Progress Card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-blue-900">Device Inspection</CardTitle>
              </div>
              <Badge className="bg-blue-500">In Progress</Badge>
            </div>
            <CardDescription className="text-blue-800">
              Continue where you left off
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Step {currentStep} of 6</span>
                <span className="text-sm font-medium">{progress}% Complete</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Step Information */}
            <div className="bg-white p-3 rounded border border-blue-200">
              <p className="text-sm text-muted-foreground">
                {currentStep === 1 && '📱 Model Verification'}
                {currentStep === 2 && '📱 Device Identification'}
                {currentStep === 3 && '📦 Accessories & Packaging'}
                {currentStep === 4 && '👁️ External Inspection'}
                {currentStep === 5 && '⚡ Device Testing'}
                {currentStep === 6 && '🍎 Apple-Specific Checks'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Click "Continue" to resume inspection</p>
            </div>

            {/* Continue Button */}
            <Button onClick={handleStartInspection} className="w-full bg-blue-600 hover:bg-blue-700">
              <Play className="h-4 w-4 mr-2" />
              Continue Inspection
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Inspection Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <CardTitle>Device Inspection Report</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(inspection.status)}
              {inspection.hasFailedTests && (
                <Badge className="bg-red-500">Failed Tests</Badge>
              )}
            </div>
          </div>
          <CardDescription>
            Completed on {inspection.completedAt ? new Date(inspection.completedAt).toLocaleDateString() : 'Pending'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Compact Summary Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Model Verification */}
            {inspection.modelVerification && (
              <div className="border-l-2 border-blue-500 pl-2">
                <p className="text-muted-foreground">Model</p>
                <p className="font-medium">{inspection.modelVerification.actualModel}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  {inspection.modelVerification.verified ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-red-500" />
                  )}
                  <span className="text-xs capitalize">
                    {inspection.modelVerification.verificationStatus.replace(/-/g, ' ')}
                  </span>
                </div>
              </div>
            )}

            {/* Device Identification */}
            {inspection.identification && (
              <div className="border-l-2 border-purple-500 pl-2">
                <p className="text-muted-foreground">Device Type</p>
                <p className="font-medium">{inspection.identification.deviceType}</p>
                {inspection.identification.imei && (
                  <p className="text-xs text-muted-foreground truncate">IMEI: {inspection.identification.imei}</p>
                )}
              </div>
            )}

            {/* Device Tests Summary */}
            {inspection.deviceTest && (
              <div className="border-l-2 border-green-500 pl-2">
                <p className="text-muted-foreground">Device Tests</p>
                <p className="font-medium">
                  {inspection.hasFailedTests ? (
                    <span className="text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Failed
                    </span>
                  ) : (
                    <span className="text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> OK
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Repair Assessment */}
            {inspection.isRepairable !== undefined && (
              <div className={`border-l-2 pl-2 ${inspection.isRepairable ? 'border-green-500' : 'border-red-500'}`}>
                <p className="text-muted-foreground">Repairable</p>
                <p className="font-medium">
                  {inspection.isRepairable ? (
                    <span className="text-green-600">Yes</span>
                  ) : (
                    <span className="text-red-600">No</span>
                  )}
                </p>
                {inspection.repairOffer?.cost && (
                  <p className="text-xs text-muted-foreground">${inspection.repairOffer.cost}</p>
                )}
              </div>
            )}
          </div>

          {/* Accessories Quick Check */}
          {inspection.accessories && (
            <div className="border-t pt-2 text-xs">
              <p className="text-muted-foreground font-medium mb-1">Accessories</p>
              <div className="flex gap-2 flex-wrap">
                {inspection.accessories.originalPackaging?.present !== undefined && (
                  <Badge variant={inspection.accessories.originalPackaging.present ? 'secondary' : 'outline'} className="text-xs">
                    {inspection.accessories.originalPackaging.present ? '✓' : '✗'} Packaging
                  </Badge>
                )}
                {inspection.accessories.caseCover?.present !== undefined && (
                  <Badge variant={inspection.accessories.caseCover.present ? 'secondary' : 'outline'} className="text-xs">
                    {inspection.accessories.caseCover.present ? '✓' : '✗'} Case
                  </Badge>
                )}
                {inspection.accessories.powerAdapter?.present !== undefined && (
                  <Badge variant={inspection.accessories.powerAdapter.present ? 'secondary' : 'outline'} className="text-xs">
                    {inspection.accessories.powerAdapter.present ? '✓' : '✗'} Adapter
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* External Inspection Quick Check */}
          {inspection.externalInspection && (
            <div className="text-xs">
              <p className="text-muted-foreground font-medium mb-1">External Condition</p>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: 'Display', data: inspection.externalInspection.display },
                  { label: 'Frame', data: inspection.externalInspection.frame },
                  { label: 'Back Cover', data: inspection.externalInspection.backCover },
                  { label: 'Buttons', data: inspection.externalInspection.buttons },
                ].map(({ label, data }) => (
                  <Badge key={label} variant={data.status === 'OK' ? 'secondary' : 'destructive'} className="text-xs">
                    {data.status === 'OK' ? '✓' : '✗'} {label}
                  </Badge>
                ))}
              </div>
              {inspection.externalInspection.visibleDamages?.hasDamage && (
                <p className="text-red-600 mt-1 text-xs">⚠️ Visible damage: {inspection.externalInspection.visibleDamages.description}</p>
              )}
            </div>
          )}

          {/* Generate Report Button - Compact */}
          {inspection.status === 'completed' && (
            <Button
              onClick={handleGenerateReport}
              disabled={generatingReport}
              className="w-full mt-2 h-8 text-xs"
              variant="default"
              size="sm"
            >
              <Download className="h-3 w-3 mr-1" />
              {generatingReport ? 'Generating...' : 'Download PDF'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
