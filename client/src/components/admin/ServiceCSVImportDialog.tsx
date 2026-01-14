import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/useToast';
import { Upload, FileText, CheckCircle2, AlertTriangle, Download } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import ServiceColumnAssignmentPanel from './ServiceColumnAssignmentPanel';
import ServiceCSVPreviewTable from './ServiceCSVPreviewTable';
import {
  validateCSVServiceImport,
  importServicesFromCSV,
  ValidationResult,
  ValidatedRow,
  ImportResult,
} from '@/api/csvServiceImport';

interface ServiceCSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

const ServiceCSVImportDialog: React.FC<ServiceCSVImportDialogProps> = ({
  open,
  onOpenChange,
  onImportComplete,
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'complete'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Reset state when dialog closes
  const handleClose = () => {
    setStep('upload');
    setSelectedFile(null);
    setCsvColumns([]);
    setPreviewData([]);
    setColumnMapping({});
    setValidationResult(null);
    setImportResult(null);
    setSkipDuplicates(true);
    setUpdateExisting(false);
    setIsProcessing(false);
    setProgress(0);
    onOpenChange(false);
  };

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast({
          variant: 'destructive',
          title: 'Invalid File',
          description: 'Please select a CSV file',
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  // Upload and parse CSV
  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(20);

    try {
      const result = await validateCSVServiceImport(selectedFile);
      setProgress(60);

      if (result.needsMapping) {
        // First pass: get columns for mapping
        // Filter out empty strings to prevent Radix UI Select errors
        const filteredColumns = (result.columns || []).filter((col) => col && col.trim() !== '');
        setCsvColumns(filteredColumns);
        setPreviewData(result.previewData || []);
        setProgress(100);
        setStep('mapping');

        // Try to auto-map columns based on common names
        const autoMapping: Record<string, string> = {};

        filteredColumns.forEach((col) => {
          const lowerCol = col.toLowerCase();
          if (lowerCol.includes('name') || lowerCol === 'service') {
            autoMapping['name'] = col;
          } else if (lowerCol.includes('category')) {
            autoMapping['category'] = col;
          } else if (lowerCol.includes('price') || lowerCol.includes('cost')) {
            autoMapping['price'] = col;
          } else if (lowerCol.includes('description')) {
            autoMapping['description'] = col;
          } else if (lowerCol.includes('time') || lowerCol.includes('duration')) {
            autoMapping['estimatedTime'] = col;
          } else if (lowerCol.includes('difficulty') || lowerCol.includes('level')) {
            autoMapping['difficulty'] = col;
          } else if (lowerCol.includes('warranty')) {
            autoMapping['warrantyPeriod'] = col;
          } else if (lowerCol.includes('device') || lowerCol.includes('type')) {
            autoMapping['deviceTypes'] = col;
          } else if (lowerCol.includes('active') || lowerCol.includes('status')) {
            autoMapping['isActive'] = col;
          }
        });

        setColumnMapping(autoMapping);

        toast({
          title: 'File Uploaded',
          description: `CSV file uploaded successfully. Found ${result.totalRows} rows. Please map the columns.`,
        });
      } else {
        // Direct validation result
        setValidationResult(result);
        setProgress(100);
        setStep('preview');
      }
    } catch (error: any) {
      console.error('Error uploading CSV:', error);
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: error.message || 'Failed to upload CSV file',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Validate with column mapping
  const handleValidate = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(30);

    try {
      const result = await validateCSVServiceImport(selectedFile, columnMapping);
      setProgress(80);
      setValidationResult(result);
      setProgress(100);

      if (result.success) {
        setStep('preview');
        toast({
          title: 'Validation Complete',
          description: `${result.validatedData?.length || 0} rows validated successfully.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Validation Failed',
          description: `Found ${result.errors?.length || 0} errors. Please fix them before importing.`,
        });
      }
    } catch (error: any) {
      console.error('Error validating CSV:', error);
      toast({
        variant: 'destructive',
        title: 'Validation Failed',
        description: error.message || 'Failed to validate CSV data',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Import services
  const handleImport = async () => {
    if (!validationResult?.validatedData) return;

    setIsProcessing(true);
    setStep('importing');
    setProgress(0);

    try {
      // Simulate progress for UX
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 5, 90));
      }, 200);

      const result = await importServicesFromCSV(validationResult.validatedData, {
        skipDuplicates,
        updateExisting,
      });

      clearInterval(progressInterval);
      setProgress(100);
      setImportResult(result);
      setStep('complete');

      if (result.success) {
        toast({
          title: 'Import Complete',
          description: `Successfully imported ${result.stats.importedCount} services.`,
        });
        onImportComplete();
      } else {
        toast({
          variant: 'destructive',
          title: 'Import Completed with Errors',
          description: `Imported ${result.stats.importedCount} services, ${result.stats.failedCount} failed.`,
        });
      }
    } catch (error: any) {
      console.error('Error importing services:', error);
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: error.message || 'Failed to import services',
      });
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  // Download sample CSV
  const handleDownloadSample = () => {
    const sampleData = [
      ['name', 'category', 'price', 'description', 'estimatedTime', 'difficulty', 'warrantyPeriod', 'deviceTypes', 'isActive'],
      ['Screen Replacement', 'Screen Repair', '149.99', 'Replace damaged or cracked screen', '60', 'Medium', '90', 'Smartphone,Tablet', 'true'],
      ['Battery Replacement', 'Battery Replacement', '79.99', 'Replace old or faulty battery', '45', 'Easy', '90', 'Smartphone,Laptop', 'true'],
      ['Water Damage Repair', 'Water Damage', '199.99', 'Professional water damage restoration', '2 hours', 'Hard', '60', 'Smartphone,Tablet,Laptop', 'true'],
    ];

    const csv = sampleData.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'service_import_sample.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Services from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple repair services at once
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: File Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <div className="space-y-2">
                <Label htmlFor="csv-file" className="cursor-pointer">
                  <div className="text-lg font-medium">Choose CSV File</div>
                  <div className="text-sm text-muted-foreground">or drag and drop</div>
                </Label>
                <input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              {selectedFile && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <FileText className="h-5 w-5" />
                  <span className="font-medium">{selectedFile.name}</span>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              onClick={handleDownloadSample}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Sample CSV
            </Button>

            {isProcessing && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-center text-muted-foreground">Uploading and parsing CSV...</p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <Tabs defaultValue="mapping">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="mapping">Column Mapping</TabsTrigger>
                <TabsTrigger value="preview">Data Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="mapping" className="space-y-4">
                <ServiceColumnAssignmentPanel
                  csvColumns={csvColumns}
                  columnMapping={columnMapping}
                  onColumnMappingChange={(field, column) => {
                    setColumnMapping((prev) => ({
                      ...prev,
                      [field]: column,
                    }));
                  }}
                />
              </TabsContent>
              <TabsContent value="preview">
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">First 5 Rows Preview:</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          {csvColumns.filter((col) => col && col.trim() !== '').map((col) => (
                            <th key={col} className="text-left p-2 border-b">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, index) => (
                          <tr key={index}>
                            {csvColumns.filter((col) => col && col.trim() !== '').map((col) => (
                              <td key={col} className="p-2 border-b">
                                {row[col]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {isProcessing && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-center text-muted-foreground">Validating data...</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Preview and Validation */}
        {step === 'preview' && validationResult && (
          <div className="space-y-4">
            <ServiceCSVPreviewTable
              validatedData={validationResult.validatedData || []}
              errors={validationResult.errors || []}
              warnings={validationResult.warnings || []}
            />

            {/* Import Options */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold">Import Options</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="skipDuplicates"
                    checked={skipDuplicates}
                    onCheckedChange={(checked) => setSkipDuplicates(checked as boolean)}
                  />
                  <Label htmlFor="skipDuplicates">Skip duplicate services</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="updateExisting"
                    checked={updateExisting}
                    onCheckedChange={(checked) => setUpdateExisting(checked as boolean)}
                  />
                  <Label htmlFor="updateExisting">Update existing services</Label>
                </div>
              </div>
              {validationResult.duplicateCheck?.hasDuplicates && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Found {validationResult.duplicateCheck.duplicateCount} duplicate service(s) in the database.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Importing */}
        {step === 'importing' && (
          <div className="space-y-4 py-8">
            <div className="text-center">
              <Upload className="h-16 w-16 mx-auto mb-4 animate-pulse" />
              <h3 className="text-lg font-semibold">Importing Services...</h3>
              <p className="text-muted-foreground">Please wait while we import your services</p>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && importResult && (
          <div className="space-y-4">
            <div className="text-center py-6">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-semibold">Import Complete!</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">
                  {importResult.stats.importedCount}
                </div>
                <div className="text-sm text-muted-foreground">Imported</div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-600">
                  {importResult.stats.skippedCount}
                </div>
                <div className="text-sm text-muted-foreground">Skipped</div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="text-2xl font-bold text-red-600">
                  {importResult.stats.failedCount}
                </div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
            </div>

            {importResult.failed.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-semibold">Failed Imports:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {importResult.failed.map((fail) => (
                        <li key={fail.rowIndex}>
                          Row {fail.rowIndex}: {fail.serviceName} - {fail.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={!selectedFile || isProcessing}>
                Continue
              </Button>
            </>
          )}
          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleValidate} disabled={isProcessing}>
                Validate Data
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={!validationResult?.success || isProcessing}
              >
                Import Services
              </Button>
            </>
          )}
          {step === 'complete' && (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ServiceCSVImportDialog;
