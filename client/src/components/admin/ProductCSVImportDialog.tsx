import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import {
  uploadCSVForMapping,
  validateCSVProductImport,
  importProductsFromCSV,
  ValidationResult,
  ImportResult,
  CSVHeaders,
} from '@/api/csvProductImport';
import ProductColumnAssignmentPanel from './ProductColumnAssignmentPanel';
import ProductCSVPreviewTable from './ProductCSVPreviewTable';

interface ProductCSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

type ImportStep = 'upload' | 'mapping' | 'validation' | 'preview' | 'import' | 'complete';

const ProductCSVImportDialog: React.FC<ProductCSVImportDialogProps> = ({
  open,
  onOpenChange,
  onImportComplete,
}) => {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvHeaders, setCSVHeaders] = useState<CSVHeaders | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importProgress, setImportProgress] = useState(0);
  const dialogHeaderClass = '-mx-6 -mt-6 mb-2 rounded-t-lg bg-[#1a2a5e] px-6 py-3 text-white';

  const resetDialog = useCallback(() => {
    setCurrentStep('upload');
    setSelectedFile(null);
    setCSVHeaders(null);
    setColumnMapping({});
    setValidationResult(null);
    setImportResult(null);
    setIsProcessing(false);
    setUpdateExisting(false);
    setSkipDuplicates(true);
    setImportProgress(0);
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        toast({
          variant: 'destructive',
          title: 'Invalid File',
          description: 'Please select a valid CSV file',
        });
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'File Too Large',
          description: 'Please select a file smaller than 10MB',
        });
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    try {
      const headers = await uploadCSVForMapping(selectedFile);
      setCSVHeaders(headers);
      setCurrentStep('mapping');

      toast({
        title: 'File Uploaded',
        description: `CSV file parsed successfully. Found ${headers.totalRows} rows.`,
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: error.message || 'Failed to upload CSV file',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleValidate = async () => {
    if (!selectedFile || !columnMapping) return;

    // Check required fields
    const requiredFields = ['name', 'category', 'price'];
    const missingFields = requiredFields.filter(field => !columnMapping[field]);

    if (missingFields.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Missing Required Fields',
        description: `Please map the following required fields: ${missingFields.join(', ')}`,
      });
      return;
    }

    setIsProcessing(true);
    setCurrentStep('validation');

    try {
      const result = await validateCSVProductImport(selectedFile, columnMapping);
      setValidationResult(result);
      setCurrentStep('preview');

      if (result.valid) {
        toast({
          title: 'Validation Successful',
          description: `${result.validRows} products are ready to import`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Validation Failed',
          description: `Found ${result.errors.length} errors in the CSV file`,
        });
      }
    } catch (error: any) {
      console.error('Validation error:', error);
      toast({
        variant: 'destructive',
        title: 'Validation Failed',
        description: error.message || 'Failed to validate CSV file',
      });
      setCurrentStep('mapping');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!validationResult || !validationResult.valid) return;

    setIsProcessing(true);
    setCurrentStep('import');
    setImportProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const result = await importProductsFromCSV(validationResult.validatedProducts, {
        updateExisting,
        skipDuplicates,
      });

      clearInterval(progressInterval);
      setImportProgress(100);
      setImportResult(result);
      setCurrentStep('complete');

      toast({
        title: 'Import Complete',
        description: `Successfully imported ${result.successful.length} products`,
      });

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: error.message || 'Failed to import products',
      });
      setCurrentStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'upload':
        return (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <div className="space-y-2">
                <h3 className="font-semibold">Upload CSV File</h3>
                <p className="text-sm text-muted-foreground">
                  Select a CSV file containing product data (max 10MB)
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload">
                  <Button variant="outline" className="mt-2" asChild>
                    <span>
                      <Upload className="mr-2 h-4 w-4" />
                      Choose File
                    </span>
                  </Button>
                </label>
                {selectedFile && (
                  <p className="text-sm text-green-600 mt-2">
                    <CheckCircle2 className="inline h-4 w-4 mr-1" />
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>CSV Format Requirements:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>Required columns: Product Name, Category, Price</li>
                  <li>Optional columns: Description, Brand, SKU, Stock, Images, etc.</li>
                  <li>First row should contain column headers</li>
                  <li>Use comma as delimiter</li>
                  <li>For lists (images, features), use comma-separated values within quotes</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        );

      case 'mapping':
        return csvHeaders ? (
          <ProductColumnAssignmentPanel
            csvHeaders={csvHeaders.headers}
            columnMapping={columnMapping}
            onColumnMappingChange={setColumnMapping}
          />
        ) : null;

      case 'validation':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-semibold">Validating CSV data...</p>
            <p className="text-sm text-muted-foreground">Please wait while we check your data</p>
          </div>
        );

      case 'preview':
        return validationResult ? (
          <div className="space-y-4">
            <ProductCSVPreviewTable validationResult={validationResult} />

            {validationResult.duplicates.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="updateExisting"
                    checked={updateExisting}
                    onCheckedChange={(checked) => setUpdateExisting(checked as boolean)}
                  />
                  <Label htmlFor="updateExisting">
                    Update existing products with matching SKU
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="skipDuplicates"
                    checked={skipDuplicates}
                    onCheckedChange={(checked) => setSkipDuplicates(checked as boolean)}
                    disabled={updateExisting}
                  />
                  <Label htmlFor="skipDuplicates">
                    Skip duplicate products (don't import)
                  </Label>
                </div>
              </div>
            )}
          </div>
        ) : null;

      case 'import':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-semibold">Importing products...</p>
            <div className="w-full max-w-md">
              <Progress value={importProgress} className="h-2" />
              <p className="text-sm text-muted-foreground text-center mt-2">
                {importProgress}% complete
              </p>
            </div>
          </div>
        );

      case 'complete':
        return importResult ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-2">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                <h3 className="text-2xl font-bold">Import Complete!</h3>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{importResult.successful.length}</div>
                <div className="text-sm text-muted-foreground">Created</div>
              </div>
              <div className="bg-white border border-gray-200 shadow-sm p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{importResult.updated.length}</div>
                <div className="text-sm text-muted-foreground">Updated</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-yellow-600">{importResult.skipped.length}</div>
                <div className="text-sm text-muted-foreground">Skipped</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-600">{importResult.failed.length}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
            </div>

            {importResult.failed.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Failed Imports:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    {importResult.failed.slice(0, 5).map((failure, index) => (
                      <li key={index}>
                        Row {failure.row}: {failure.name} - {failure.error}
                      </li>
                    ))}
                    {importResult.failed.length > 5 && (
                      <li>... and {importResult.failed.length - 5} more failures</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : null;

      default:
        return null;
    }
  };

  const getDialogTitle = () => {
    switch (currentStep) {
      case 'upload':
        return 'Import Products from CSV';
      case 'mapping':
        return 'Map CSV Columns';
      case 'validation':
        return 'Validating Data';
      case 'preview':
        return 'Preview & Confirm';
      case 'import':
        return 'Importing Products';
      case 'complete':
        return 'Import Complete';
      default:
        return 'CSV Import';
    }
  };

  const getDialogDescription = () => {
    switch (currentStep) {
      case 'upload':
        return 'Upload a CSV file containing product data to import';
      case 'mapping':
        return 'Assign CSV columns to product fields';
      case 'validation':
        return 'Validating your data for import';
      case 'preview':
        return 'Review the data before importing';
      case 'import':
        return 'Importing products into the database';
      case 'complete':
        return 'Your products have been imported successfully';
      default:
        return '';
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      resetDialog();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto text-sm">
        <DialogHeader className={dialogHeaderClass}>
          <DialogTitle className="text-base text-white">{getDialogTitle()}</DialogTitle>
          <DialogDescription className="text-xs text-white/80">{getDialogDescription()}</DialogDescription>
        </DialogHeader>

        <div className="py-3">{renderStepContent()}</div>

        <DialogFooter className="gap-2">
          {currentStep === 'upload' && (
            <>
              <Button size="sm" variant="outline" onClick={handleClose} disabled={isProcessing}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleUpload} disabled={!selectedFile || isProcessing}>
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Next
              </Button>
            </>
          )}

          {currentStep === 'mapping' && (
            <>
              <Button size="sm" variant="outline" onClick={() => setCurrentStep('upload')} disabled={isProcessing}>
                Back
              </Button>
              <Button size="sm" onClick={handleValidate} disabled={isProcessing}>
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Validate Data
              </Button>
            </>
          )}

          {currentStep === 'preview' && (
            <>
              <Button size="sm" variant="outline" onClick={() => setCurrentStep('mapping')} disabled={isProcessing}>
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={!validationResult?.valid || isProcessing}
              >
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import Products
              </Button>
            </>
          )}

          {currentStep === 'complete' && (
            <Button size="sm" onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProductCSVImportDialog;
