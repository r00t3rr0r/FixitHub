import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
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
import { PartsColumnAssignmentPanel } from './PartsColumnAssignmentPanel';
import { PartsCSVPreviewTable } from './PartsCSVPreviewTable';
import { validatePartsCSVImport, importPartsFromCSV, ValidationResult } from '@/api/csvPartsImport';
import { useToast } from '@/hooks/useToast';
import { Upload, AlertCircle, CheckCircle, Loader2, FileText, Download } from 'lucide-react';

interface PartsCSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess?: () => void;
}

export const PartsCSVImportDialog: React.FC<PartsCSVImportDialogProps> = ({
  open,
  onOpenChange,
  onImportSuccess
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State management
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'import'>('upload');
  const [csvData, setCSVData] = useState<any[]>([]);
  const [csvColumns, setCSVColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

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

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'CSV file must be smaller than 10MB for optimal performance'
      });
      return;
    }

    console.log('Parts CSV Import: Parsing file:', file.name, '- Size:', file.size, 'bytes');

    // Parse CSV file
    Papa.parse(file, {
      skipEmptyLines: true,
      header: true,
      complete: (results) => {
        console.log('Parts CSV Import: File parsed successfully');
        console.log(`Parts CSV Import: Found ${results.data.length} rows and ${Object.keys((results.data[0] as any) || {}).length} columns`);

        setCSVData(results.data);
        const columns = Object.keys((results.data[0] as any) || {});
        setCSVColumns(columns);

        // Auto-map columns if they match common names
        const autoMapping: Record<string, string> = {};
        const commonMappings = {
          itemName: ['itemname', 'item_name', 'name', 'part_name', 'partname', 'part name'],
          itemDescription: ['itemdescription', 'item_description', 'description', 'desc'],
          category: ['category', 'type', 'part_category'],
          manufacturer: ['manufacturer', 'mfr', 'maker'],
          brand: ['brand', 'make'],
          compatibleDevices: ['compatibledevices', 'compatible_devices', 'devices', 'compatibility'],
          versionType: ['versiontype', 'version_type', 'version', 'type'],
          quantity: ['quantity', 'qty', 'stock', 'in_stock'],
          minStockLevel: ['minstocklevel', 'min_stock_level', 'min_stock', 'minstock', 'minimum'],
          unitCost: ['unitcost', 'unit_cost', 'cost', 'price', 'cost_price'],
          sellingPrice: ['sellingprice', 'selling_price', 'sale_price', 'sell_price'],
          storageLocation: ['storagelocation', 'storage_location', 'location', 'storage'],
          notes: ['notes', 'note', 'comments', 'remarks'],
          supplierName: ['suppliername', 'supplier_name', 'supplier', 'vendor'],
          supplierEmail: ['supplieremail', 'supplier_email', 'vendor_email'],
          supplierPhone: ['supplierphone', 'supplier_phone', 'vendor_phone']
        };

        Object.entries(commonMappings).forEach(([field, aliases]) => {
          const foundColumn = columns.find(col =>
            aliases.some(alias => col.toLowerCase().replace(/\s+/g, '') === alias.toLowerCase())
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
        console.error('Parts CSV Import: Error parsing file:', error);
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
    // Check if all required fields are mapped
    const requiredFields = ['itemName', 'category', 'manufacturer', 'brand'];
    const unmappedRequired = requiredFields.filter(field => !columnMapping[field]);

    if (unmappedRequired.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Missing required mappings',
        description: `Please map these required fields: ${unmappedRequired.join(', ')}`
      });
      return;
    }

    setIsValidating(true);
    console.log('Parts CSV Import: Starting validation');

    try {
      const result = await validatePartsCSVImport(csvData, columnMapping, { skipDuplicates, updateExisting });
      console.log('Parts CSV Import: Validation result:', result);
      setValidationResult(result);

      if (result.success) {
        setStep('preview');
        toast({
          title: 'Validation successful',
          description: `${result.data?.length || 0} part(s) ready to import`
        });
      } else if (result.duplicates && result.duplicates.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Duplicates found',
          description: `${result.duplicates.length} duplicate parts detected. Enable "Skip Duplicates" to proceed.`
        });
      } else if (result.validationErrors && result.validationErrors.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Validation errors',
          description: `${result.validationErrors.length} parts have validation errors`
        });
      }
    } catch (error) {
      console.error('Parts CSV Import: Validation error:', error);
      toast({
        variant: 'destructive',
        title: 'Validation failed',
        description: error.message || 'An error occurred during validation'
      });
    } finally {
      setIsValidating(false);
    }
  };

  // Handle import
  const handleImport = async () => {
    setIsImporting(true);
    setImportProgress(0);
    setStep('import');
    console.log('Parts CSV Import: Starting part import');

    try {
      if (!validationResult?.data) {
        throw new Error('No validated data to import');
      }

      const result = await importPartsFromCSV(validationResult.data);

      console.log('Parts CSV Import: Import result:', result);
      setImportProgress(100);

      if (result.imported > 0) {
        toast({
          title: 'Import successful',
          description: `Successfully imported ${result.imported} part(s)${result.failed > 0 ? `, ${result.failed} failed` : ''}`
        });

        if (onImportSuccess) {
          onImportSuccess();
        }

        // Close dialog after successful import
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        toast({
          variant: 'destructive',
          title: 'Import failed',
          description: `Failed to import parts. ${result.failed} error(s) occurred.`
        });
      }
    } catch (error) {
      console.error('Parts CSV Import: Import error:', error);
      toast({
        variant: 'destructive',
        title: 'Import failed',
        description: error.message || 'An error occurred during import'
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Handle close
  const handleClose = () => {
    setStep('upload');
    setCSVData([]);
    setCSVColumns([]);
    setColumnMapping({});
    setValidationResult(null);
    setSkipDuplicates(false);
    setUpdateExisting(false);
    setImportProgress(0);
    setShowConfirmDialog(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  // Download sample CSV
  const handleDownloadSample = () => {
    const sampleData = [
      {
        itemName: 'iPhone 15 Pro Screen Assembly',
        itemDescription: 'High-quality OLED display replacement',
        category: 'display',
        manufacturer: 'Apple',
        brand: 'Apple',
        compatibleDevices: 'iPhone 15 Pro',
        versionType: 'original',
        quantity: '10',
        minStockLevel: '5',
        unitCost: '180.00',
        sellingPrice: '250.00',
        storageLocation: 'Shelf A1',
        notes: 'Handle with care',
        supplierName: 'TechParts Inc',
        supplierEmail: 'orders@techparts.com',
        supplierPhone: '+1-555-0123'
      },
      {
        itemName: 'Samsung Galaxy S24 Battery',
        itemDescription: 'High-capacity lithium battery',
        category: 'battery',
        manufacturer: 'Samsung',
        brand: 'Samsung',
        compatibleDevices: 'Galaxy S24, Galaxy S24+',
        versionType: 'original',
        quantity: '15',
        minStockLevel: '8',
        unitCost: '45.00',
        sellingPrice: '75.00',
        storageLocation: 'Shelf B2',
        notes: 'Store in cool, dry place',
        supplierName: 'Battery Depot',
        supplierEmail: 'info@batterydepot.com',
        supplierPhone: '+1-555-0456'
      }
    ];

    const csv = Papa.unparse(sampleData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'parts_import_sample.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Parts from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import parts into your inventory. Follow the steps to map columns and validate data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Progress Steps */}
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 ${step === 'upload' ? 'text-primary' : step !== 'upload' ? 'text-green-600' : 'text-muted-foreground'}`}>
                {step !== 'upload' ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-current flex items-center justify-center">
                    <span className="text-xs">1</span>
                  </div>
                )}
                <span className="text-sm font-medium">Upload</span>
              </div>
              <Separator className="flex-1 mx-2" />
              <div className={`flex items-center gap-2 ${step === 'mapping' ? 'text-primary' : ['preview', 'import'].includes(step) ? 'text-green-600' : 'text-muted-foreground'}`}>
                {['preview', 'import'].includes(step) ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-current flex items-center justify-center">
                    <span className="text-xs">2</span>
                  </div>
                )}
                <span className="text-sm font-medium">Map Columns</span>
              </div>
              <Separator className="flex-1 mx-2" />
              <div className={`flex items-center gap-2 ${step === 'preview' ? 'text-primary' : step === 'import' ? 'text-green-600' : 'text-muted-foreground'}`}>
                {step === 'import' ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-current flex items-center justify-center">
                    <span className="text-xs">3</span>
                  </div>
                )}
                <span className="text-sm font-medium">Preview</span>
              </div>
              <Separator className="flex-1 mx-2" />
              <div className={`flex items-center gap-2 ${step === 'import' ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className="h-5 w-5 rounded-full border-2 border-current flex items-center justify-center">
                  <span className="text-xs">4</span>
                </div>
                <span className="text-sm font-medium">Import</span>
              </div>
            </div>

            <Separator />

            {/* Step 1: Upload */}
            {step === 'upload' && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Upload CSV File</CardTitle>
                    <CardDescription>
                      Select a CSV file containing parts data. Maximum file size: 10MB.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <div className="space-y-2">
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          variant="default"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Choose CSV File
                        </Button>
                        <Input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <p className="text-sm text-muted-foreground">
                          or drag and drop your CSV file here
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadSample}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Sample CSV
                      </Button>
                    </div>

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>CSV Requirements:</strong>
                        <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                          <li>File must be in CSV format (.csv)</li>
                          <li>First row must contain column headers</li>
                          <li>Required columns: Item Name, Category, Manufacturer, Brand</li>
                          <li>Category values: display, battery, camera, speaker, microphone, charging-port, button, sensor, tool, adhesive, screw, other</li>
                          <li>Maximum file size: 10MB</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Step 2: Column Mapping */}
            {step === 'mapping' && (
              <div className="space-y-4">
                <PartsColumnAssignmentPanel
                  csvColumns={csvColumns}
                  columnMapping={columnMapping}
                  onMappingChange={setColumnMapping}
                />

                <Card>
                  <CardHeader>
                    <CardTitle>Import Options</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="skipDuplicates"
                        checked={skipDuplicates}
                        onCheckedChange={(checked) => setSkipDuplicates(checked as boolean)}
                      />
                      <Label htmlFor="skipDuplicates" className="text-sm font-normal cursor-pointer">
                        Skip duplicate parts (parts that already exist in the database will be ignored)
                      </Label>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button onClick={handleValidate} disabled={isValidating}>
                    {isValidating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Validate Data
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Preview */}
            {step === 'preview' && validationResult && (
              <div className="space-y-4">
                <PartsCSVPreviewTable validationResult={validationResult} />

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setStep('mapping')}>
                    Back to Mapping
                  </Button>
                  <Button
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={!validationResult.success || (validationResult.data?.length || 0) === 0}
                  >
                    Import Parts
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Import Progress */}
            {step === 'import' && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Importing Parts...</CardTitle>
                    <CardDescription>
                      Please wait while we import your parts into the inventory
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Progress value={importProgress} />
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      {isImporting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Importing parts...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Import completed
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Import</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to import {validationResult?.data?.length || 0} part(s) into your inventory.
              This action cannot be undone. Do you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport}>
              Confirm Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
