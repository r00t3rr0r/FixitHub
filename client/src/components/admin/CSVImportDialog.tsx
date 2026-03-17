import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { ColumnAssignmentPanel } from './ColumnAssignmentPanel';
import { CSVPreviewTable } from './CSVPreviewTable';
import { ValidationErrorsPanel } from './ValidationErrorsPanel';
import { validateCSVImport, importUsersFromCSV } from '@/api/csvImport';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from 'react-i18next';
import { Upload, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess?: () => void;
}

interface ValidationResult {
  success: boolean;
  data?: any[];
  summary?: {
    totalRows: number;
    validRows: number;
    duplicateRows: number;
    skippedRows: number;
    invalidRows?: number;
  };
  duplicates?: Array<{ email: string; type: string; message: string }>;
  validationErrors?: Array<{ index: number; email: string; errors: string[]; data: any }>;
  validatedRecords?: any[];
  message?: string;
}

export const CSVImportDialog: React.FC<CSVImportDialogProps> = ({
  open,
  onOpenChange,
  onImportSuccess
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State management
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'errors' | 'import'>('upload');
  const [csvData, setCSVData] = useState<any[]>([]);
  const [csvColumns, setCSVColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [skippedIndices, setSkippedIndices] = useState<Set<number>>(new Set());

  // Handle file upload
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please upload a CSV file'
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'CSV file must be smaller than 10MB'
      });
      return;
    }

    // Parse CSV file
    Papa.parse(file, {
      skipEmptyLines: true,
      header: true,
      complete: (results) => {
        console.log('CSV Import: File parsed successfully');
        console.log(`CSV Import: Found ${results.data.length} rows and ${Object.keys((results.data[0] as any) || {}).length} columns`);

        setCSVData(results.data);
        const columns = Object.keys((results.data[0] as any) || {});
        setCSVColumns(columns);

        // Auto-map columns if they match common names
        const autoMapping: Record<string, string> = {};
        const commonMappings = {
          email: ['email', 'e-mail', 'mail', 'user_email'],
          name: ['name', 'full_name', 'fullname', 'user_name'],
          phone: ['phone', 'phone_number', 'mobile', 'contact'],
          firstName: ['first_name', 'firstname', 'vorname'],
          lastName: ['last_name', 'lastname', 'nachname'],
          surname: ['surname', 'nachname_zusatz', 'family_name'],
          role: ['role', 'user_role', 'position'],
          company: ['company', 'organization', 'org'],
          country: ['country', 'nation'],
          vatId: ['vat_id', 'vatid', 'ust_id', 'ustid', 'umsatzsteuer_id', 'umsatzsteuerid'],
          isActive: ['active', 'status', 'enabled', 'is_active'],
          customerNumber: ['customer_number', 'customernumber', 'kundennummer', 'cust_no'],
          customerGroup: ['customer_group', 'customergroup', 'kundengruppe'],
          salutation: ['salutation', 'anrede', 'title_prefix'],
          title: ['title', 'titel'],
          addressAddition: ['address_addition', 'addressaddition', 'adresszusatz'],
          customerOrigin: ['customer_origin', 'customerorigin', 'kundenherkunft'],
          postId: ['post_id', 'postid', 'post'],
          paymentMethod: ['payment_method', 'paymentmethod', 'zahlungsart'],
          paymentTerms: ['payment_terms', 'paymentterms', 'zahlungsziel'],
          internalKey: ['internal_key', 'internalkey', 'interner_schlüssel'],
          discount: ['discount', 'rabatt', 'discount_percent'],
          status: ['status', 'user_status', 'account_status'],
          newsletter: ['newsletter', 'newsletter_subscription', 'subscribe'],
          comment: ['comment', 'comments', 'notes', 'kommentar']
        };

        Object.entries(commonMappings).forEach(([field, aliases]) => {
          const foundColumn = columns.find(col =>
            aliases.some(alias => col.toLowerCase().includes(alias.toLowerCase()))
          );
          if (foundColumn) {
            autoMapping[field] = foundColumn;
          }
        });

        setColumnMapping(autoMapping);
        setStep('mapping');

        toast({
          title: 'File loaded',
          description: `Successfully loaded ${results.data.length} rows with ${columns.length} columns`
        });
      },
      error: (error) => {
        console.error('CSV Import: Error parsing file:', error);
        toast({
          variant: 'destructive',
          title: 'Error parsing CSV',
          description: error.message
        });
      }
    });
  };

  // Handle validation
  const handleValidate = async () => {
    setIsValidating(true);
    console.log('CSV Import: Starting validation');
    setSkippedIndices(new Set());

    try {
      const result = await validateCSVImport(csvData, columnMapping, { skipDuplicates });
      console.log('CSV Import: Validation result:', result);
      setValidationResult(result);

      if (result.success) {
        setStep('preview');
        toast({
          title: 'Validation successful',
          description: `${result.data?.length || 0} records ready to import`
        });
      } else if (result.duplicates && result.duplicates.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Duplicates found',
          description: `${result.duplicates.length} duplicate emails detected. Enable "Skip Duplicates" to proceed.`
        });
      } else if (result.validationErrors && result.validationErrors.length > 0) {
        console.log(`CSV Import: Found ${result.validationErrors.length} records with validation errors`);
        setStep('errors');
        toast({
          variant: 'destructive',
          title: 'Validation errors found',
          description: `${result.validationErrors.length} record(s) have validation errors. Review and select which to skip.`
        });
      }
    } catch (error) {
      console.error('CSV Import: Validation error:', error);
      toast({
        variant: 'destructive',
        title: 'Validation failed',
        description: error.message || 'An error occurred during validation'
      });
    } finally {
      setIsValidating(false);
    }
  };

  // Handle skipping records with errors
  const handleSkipRecords = (indices: number[]) => {
    console.log('CSV Import: Marking records for skipping:', indices);
    setSkippedIndices(new Set(indices));
  };

  // Handle proceeding with valid records
  const handleProceedWithValidRecords = () => {
    console.log('CSV Import: Proceeding with valid records, skipping', skippedIndices.size, 'records');

    if (validationResult?.validatedRecords) {
      // Set data to only the validated records
      setValidationResult({
        ...validationResult,
        success: true,
        data: validationResult.validatedRecords,
        summary: {
          ...validationResult.summary,
          validRows: validationResult.validatedRecords.length
        }
      });
      setStep('preview');
      toast({
        title: 'Errors skipped',
        description: `Proceeding with ${validationResult.validatedRecords.length} valid record(s)`
      });
    }
  };

  // Handle import
  const handleImport = async () => {
    setIsImporting(true);
    setImportProgress(0);
    console.log('CSV Import: Starting user import');

    try {
      if (!validationResult?.data) {
        throw new Error('No validated data to import');
      }

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + Math.random() * 30, 90));
      }, 500);

      const result = await importUsersFromCSV(validationResult.data);
      clearInterval(progressInterval);

      console.log('CSV Import: Import result:', result);
      setImportProgress(100);

      toast({
        title: 'Import completed',
        description: `Successfully imported ${result.imported} user(s)`
      });

      // Reset dialog
      setTimeout(() => {
        setStep('upload');
        setCSVData([]);
        setCSVColumns([]);
        setColumnMapping({});
        setValidationResult(null);
        setSkipDuplicates(false);
        setImportProgress(0);
        setSkippedIndices(new Set());
        onOpenChange(false);
        onImportSuccess?.();
      }, 2000);
    } catch (error) {
      console.error('CSV Import: Import error:', error);
      toast({
        variant: 'destructive',
        title: 'Import failed',
        description: error.message || 'An error occurred during import'
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Users from CSV</DialogTitle>
            <DialogDescription>
              Follow the steps below to import users from a CSV file
            </DialogDescription>
          </DialogHeader>

          <Tabs value={step} onValueChange={(value) => setStep(value as any)}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="upload" disabled={csvData.length === 0 && step !== 'upload'}>
                Upload
              </TabsTrigger>
              <TabsTrigger value="mapping" disabled={csvData.length === 0}>
                Mapping
              </TabsTrigger>
              <TabsTrigger value="errors" disabled={!validationResult?.validationErrors || validationResult.validationErrors.length === 0}>
                Errors ({validationResult?.validationErrors?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="preview" disabled={!validationResult?.success}>
                Preview
              </TabsTrigger>
              <TabsTrigger value="import" disabled={!validationResult?.success || isImporting}>
                Import
              </TabsTrigger>
            </TabsList>

            {/* Step 1: Upload */}
            <TabsContent value="upload" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Step 1: Upload CSV File</CardTitle>
                  <CardDescription>
                    Select a CSV file containing user data. The file must include email and name columns.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium mb-2">Click to upload or drag and drop</p>
                    <p className="text-sm text-muted-foreground">CSV file up to 10MB</p>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>

                  {csvData.length > 0 && (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        Loaded {csvData.length} records from CSV file
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Step 2: Mapping */}
            <TabsContent value="mapping" className="space-y-4">
              <ColumnAssignmentPanel
                csvColumns={csvColumns}
                columnMapping={columnMapping}
                onMappingChange={setColumnMapping}
              />

              <div className="flex items-center gap-2">
                <Checkbox
                  id="skipDuplicates"
                  checked={skipDuplicates}
                  onCheckedChange={(checked) => setSkipDuplicates(checked as boolean)}
                />
                <label htmlFor="skipDuplicates" className="text-sm font-medium cursor-pointer">
                  Skip duplicate emails (if unchecked, import will fail on duplicates)
                </label>
              </div>

              <Button
                onClick={handleValidate}
                disabled={isValidating || Object.values(columnMapping).filter(v => v).length === 0}
                className="w-full"
              >
                {isValidating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Validate & Preview Data
              </Button>
            </TabsContent>

            {/* Step 3: Errors */}
            <TabsContent value="errors" className="space-y-4">
              {validationResult?.validationErrors && validationResult.validationErrors.length > 0 && (
                <ValidationErrorsPanel
                  errors={validationResult.validationErrors}
                  onSkipRecords={handleSkipRecords}
                  onProceedWithValidRecords={handleProceedWithValidRecords}
                  validRecordsCount={validationResult.validatedRecords?.length || 0}
                  totalRecords={validationResult.summary?.totalRows || 0}
                />
              )}
            </TabsContent>

            {/* Step 4: Preview */}
            <TabsContent value="preview" className="space-y-4">
              {validationResult && (
                <>
                  <Card className="bg-white border-gray-200 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base">Validation Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Rows</p>
                          <p className="text-2xl font-bold">{validationResult.summary?.totalRows}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Valid Rows</p>
                          <p className="text-2xl font-bold text-green-600">
                            {validationResult.summary?.validRows}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Duplicates</p>
                          <p className="text-2xl font-bold text-amber-600">
                            {validationResult.summary?.duplicateRows}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Skipped</p>
                          <p className="text-2xl font-bold text-gray-600">
                            {validationResult.summary?.skippedRows}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <CSVPreviewTable
                    data={validationResult.data || []}
                    columnMapping={columnMapping}
                    validationErrors={validationResult.validationErrors}
                    maxRows={10}
                  />
                </>
              )}

              <Button
                onClick={() => setStep('import')}
                disabled={!validationResult?.success}
                className="w-full"
              >
                Proceed to Import
              </Button>
            </TabsContent>

            {/* Step 5: Import */}
            <TabsContent value="import" className="space-y-4">
              {!isImporting ? (
                <>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      You are about to import {validationResult?.summary?.validRows} user(s) into the system.
                      This action cannot be undone.
                    </AlertDescription>
                  </Alert>

                  <Button
                    onClick={() => setShowConfirmDialog(true)}
                    className="w-full"
                    variant="default"
                  >
                    Import Users
                  </Button>
                </>
              ) : (
                <div className="space-y-4">
                  <Progress value={importProgress} className="h-2" />
                  <p className="text-center text-sm text-muted-foreground">
                    Importing {importProgress === 100 ? 'completed' : 'in progress'}...
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Import</AlertDialogTitle>
            <AlertDialogDescription>
              This will import {validationResult?.summary?.validRows} user(s) into the system. This action
              cannot be undone. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirmDialog(false);
                handleImport();
              }}
            >
              Confirm Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
