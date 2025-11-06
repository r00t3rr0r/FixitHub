import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
        <CardContent className="space-y-6">
          {/* Model Verification */}
          {inspection.modelVerification && (
            <div className="border-l-4 border-blue-500 pl-4">
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="h-4 w-4" />
                <h4 className="font-semibold">Model Verification</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reported Model:</span>
                  <span className="font-medium">{inspection.modelVerification.reportedModel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Actual Model:</span>
                  <span className="font-medium">{inspection.modelVerification.actualModel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <div className="flex items-center gap-2">
                    {inspection.modelVerification.verified ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="capitalize">
                      {inspection.modelVerification.verificationStatus.replace(/-/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Device Identification */}
          {inspection.identification && (
            <div className="border-l-4 border-purple-500 pl-4">
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="h-4 w-4" />
                <h4 className="font-semibold">Device Identification</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Device Type:</span>
                  <span className="font-medium">{inspection.identification.deviceType}</span>
                </div>
                {inspection.identification.imei && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IMEI:</span>
                    <span className="font-medium">{inspection.identification.imei}</span>
                  </div>
                )}
                {inspection.identification.serialNumber && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Serial Number:</span>
                    <span className="font-medium">{inspection.identification.serialNumber}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Accessories */}
          {inspection.accessories && (
            <div className="border-l-4 border-cyan-500 pl-4">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4" />
                <h4 className="font-semibold">Accessories & Packaging</h4>
              </div>
              <div className="space-y-2 text-sm">
                {inspection.accessories.originalPackaging?.present !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Original Packaging:</span>
                    <div className="flex items-center gap-2">
                      {inspection.accessories.originalPackaging.present ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-gray-400" />
                      )}
                      <span>{inspection.accessories.originalPackaging.present ? 'Present' : 'Not Present'}</span>
                    </div>
                  </div>
                )}
                {inspection.accessories.caseCover?.present !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Case/Cover:</span>
                    <div className="flex items-center gap-2">
                      {inspection.accessories.caseCover.present ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-gray-400" />
                      )}
                      <span>{inspection.accessories.caseCover.present ? 'Present' : 'Not Present'}</span>
                    </div>
                  </div>
                )}
                {inspection.accessories.powerAdapter?.present !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Power Adapter:</span>
                    <div className="flex items-center gap-2">
                      {inspection.accessories.powerAdapter.present ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-gray-400" />
                      )}
                      <span>{inspection.accessories.powerAdapter.present ? 'Present' : 'Not Present'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* External Inspection */}
          {inspection.externalInspection && (
            <div className="border-l-4 border-orange-500 pl-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4" />
                <h4 className="font-semibold">External Inspection</h4>
              </div>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Display', data: inspection.externalInspection.display },
                  { label: 'Frame', data: inspection.externalInspection.frame },
                  { label: 'Back Cover', data: inspection.externalInspection.backCover },
                  { label: 'Buttons', data: inspection.externalInspection.buttons },
                ].map(({ label, data }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}:</span>
                    <div className="flex items-center gap-2">
                      {testStatusIcon(data.status)}
                      <span>{data.status}</span>
                    </div>
                  </div>
                ))}
                {inspection.externalInspection.visibleDamages?.hasDamage && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700">
                    <strong>Visible Damage:</strong> {inspection.externalInspection.visibleDamages.description}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Device Testing */}
          {inspection.deviceTest && (
            <div className="border-l-4 border-green-500 pl-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4" />
                <h4 className="font-semibold">Device Testing</h4>
              </div>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Charging', data: inspection.deviceTest.charging },
                  { label: 'Power', data: inspection.deviceTest.power },
                  { label: 'Wi-Fi', data: inspection.deviceTest.wifi },
                  { label: 'Front Camera', data: inspection.deviceTest.frontCamera },
                  { label: 'Main Camera', data: inspection.deviceTest.mainCamera },
                ].map(({ label, data }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}:</span>
                    <div className="flex items-center gap-2">
                      {testStatusIcon(data.status)}
                      <span>{data.status}</span>
                    </div>
                  </div>
                ))}
              </div>
              {inspection.hasFailedTests && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                  <strong className="text-red-700">Failed Tests:</strong>
                  <ul className="text-red-600 text-xs mt-1">
                    {inspection.failedTestDetails?.map((test: any, idx: number) => (
                      <li key={idx}>• {test.testName}: {test.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Apple-Specific */}
          {inspection.appleSpecific && (
            <div className="border-l-4 border-gray-500 pl-4">
              <div className="flex items-center gap-2 mb-2">
                <Apple className="h-4 w-4" />
                <h4 className="font-semibold">Apple-Specific Checks</h4>
              </div>
              <div className="space-y-2 text-sm">
                {inspection.appleSpecific.modemFirmware && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Modem Firmware:</span>
                    <div className="flex items-center gap-2">
                      {inspection.appleSpecific.modemFirmware.present ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span>{inspection.appleSpecific.modemFirmware.present ? 'Present' : 'Not Present'}</span>
                    </div>
                  </div>
                )}
                {inspection.appleSpecific.touchIdFaceId?.applicable && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Touch ID / Face ID:</span>
                    <div className="flex items-center gap-2">
                      {inspection.appleSpecific.touchIdFaceId.working ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span>{inspection.appleSpecific.touchIdFaceId.working ? 'Working' : 'Not Working'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Repair Assessment */}
          {inspection.isRepairable !== undefined && (
            <div className={`border-l-4 pl-4 ${inspection.isRepairable ? 'border-green-500' : 'border-red-500'}`}>
              <h4 className="font-semibold mb-2">Repair Assessment</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Repairable:</span>
                  <div className="flex items-center gap-2">
                    {inspection.isRepairable ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span>{inspection.isRepairable ? 'Yes' : 'No'}</span>
                  </div>
                </div>
                {inspection.repairOffer && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estimated Cost:</span>
                      <span className="font-medium">${inspection.repairOffer.cost}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Timeframe:</span>
                      <span className="font-medium">{inspection.repairOffer.timeframe}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Description:</span>
                      <span className="font-medium">{inspection.repairOffer.description}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Action Logs */}
          {inspection.actionLogs && inspection.actionLogs.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Action Timeline
              </h4>
              <div className="space-y-2 text-sm">
                {inspection.actionLogs.slice(-5).reverse().map((log: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-start p-2 bg-muted/50 rounded">
                    <div>
                      <p className="font-medium">{log.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant={
                      log.resultStatus === 'success' ? 'secondary' :
                      log.resultStatus === 'error' ? 'destructive' : 'outline'
                    }>
                      {log.resultStatus}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generate Report Button */}
          {inspection.status === 'completed' && (
            <Button
              onClick={handleGenerateReport}
              disabled={generatingReport}
              className="w-full mt-4"
              variant="default"
            >
              <Download className="h-4 w-4 mr-2" />
              {generatingReport ? 'Generating...' : 'Download Inspection Report (PDF)'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
