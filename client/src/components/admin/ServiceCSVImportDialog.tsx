import React, { useState } from 'react';
import Papa from 'papaparse';
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

  const sanitizeColumns = (columns: unknown[]): string[] => {
    return Array.from(
      new Set(
        (Array.isArray(columns) ? columns : [])
          .map((col) =>
            String(col ?? '')
              .replace(/^\uFEFF/, '')
              .replace(/[\x00-\x1F\x7F]/g, ' ')
              .trim()
          )
          .filter((col) => col !== '' && col !== '__parsed_extra')
      )
    );
  };

  const extractHeadersFromFile = async (file: File): Promise<string[]> => {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: 'greedy',
        preview: 20,
        complete: (results) => {
          const rows = Array.isArray(results.data) ? (results.data as unknown[]) : [];

          const headerRow = rows.find((row) => {
            if (!Array.isArray(row)) return false;
            const normalized = row.map((cell) => String(cell ?? '').trim());
            if (!normalized.some((cell) => cell !== '')) return false;

            // Ignore Excel-style delimiter hints like "sep=;".
            if (normalized.length === 1 && /^sep\s*=\s*[,;|\t]$/i.test(normalized[0])) {
              return false;
            }

            return true;
          }) as unknown[] | undefined;

          resolve(sanitizeColumns(Array.isArray(headerRow) ? headerRow : []));
        },
        error: () => {
          resolve([]);
        },
      });
    });
  };

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
        // First pass: get columns for mapping.
        // Some CSV sources can return empty `columns`; derive a fallback from preview row keys.
        const apiColumns = Array.isArray(result.columns) ? result.columns : [];
        const previewRows = Array.isArray(result.previewData) ? result.previewData : [];
        const firstPreviewRow = previewRows.find((row) => row && typeof row === 'object') || {};
        const previewColumns = Object.keys(firstPreviewRow);

        const fileHeaderColumns = await extractHeadersFromFile(selectedFile);
        const filteredColumns = sanitizeColumns([...apiColumns, ...previewColumns, ...fileHeaderColumns]);

        if (filteredColumns.length === 0) {
          throw new Error('No CSV columns could be detected. Please verify the file contains a valid header row.');
        }

        setCsvColumns(filteredColumns);
        setPreviewData(previewRows);
        setProgress(100);
        setStep('mapping');

        // Try to auto-map columns based on common names (English + German)
        const autoMapping: Record<string, string> = {};

        const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, '_');

        filteredColumns.forEach((col) => {
          const n = norm(col);
          const lowerCol = col.toLowerCase();

          // Article number / SKU
          if (n === 'artikelnummer' || n === 'artikel_nr' || n === 'artnr' || n === 'article_number' || n === 'sku') {
            autoMapping['articleNumber'] = col;
          }

          // Name
          else if (n === 'artikelname' || n === 'name' || n === 'service_name' || n === 'bezeichnung') {
            autoMapping['name'] = col;
          }
          // Category / Service type (German repair_services.csv uses "Service")
          else if (n === 'service' || n === 'service_precise' || lowerCol.includes('category') || lowerCol.includes('kategorie')) {
            autoMapping['category'] = col;
            if (n === 'service' || n === 'service_precise') {
              autoMapping['service'] = col;
            }
          }
          // Prices
          else if (n === 'std._vk_brutto' || n === 'std_vk_brutto' || n === 'price_gross') {
            autoMapping['priceGross'] = col;
          }
          else if (n === 'std._vk_netto' || n === 'std_vk_netto' || n === 'price_net') {
            autoMapping['priceNet'] = col;
          }
          else if (n === 'ek_netto' || n.startsWith('ek_netto') || n === 'purchase_price') {
            autoMapping['purchasePrice'] = col;
          }
          else if (n === 'uvp') {
            autoMapping['msrp'] = col;
          }
          else if (n === 'steuerklasse') {
            autoMapping['taxClass'] = col;
          }
          else if (n === '_quelle') {
            autoMapping['source'] = col;
          }
          else if (!autoMapping['price'] && (lowerCol.includes('preis') || (lowerCol.includes('price') && !lowerCol.includes('net') && !lowerCol.includes('brutto')))) {
            autoMapping['price'] = col;
          }
          // Description
          else if (n === 'kurzbeschreibung') {
            autoMapping['shortDescription'] = col;
          }
          else if (lowerCol.includes('beschreibung') || lowerCol === 'description') {
            autoMapping['description'] = col;
          }
          else if (n === 'druck_kurzbeschreibung' || n === 'druckkurzbeschreibung') {
            autoMapping['printShortDescription'] = col;
          }
          else if (n === 'druck_beschreibung' || n === 'druckbeschreibung') {
            autoMapping['printDescription'] = col;
          }
          else if (n === 'anmerkung' || n === 'amerkung') {
            autoMapping['note'] = col;
          }
          // Search / SEO
          else if (n === 'suchbegriffe' || n === 'keywords') {
            autoMapping['searchKeywords'] = col;
          }
          else if (n.includes('seo_name') || n.includes('seo_namen')) {
            autoMapping['seoName'] = col;
          }
          else if (n.includes('seo_titel')) {
            autoMapping['seoTitleTag'] = col;
          }
          else if (n.includes('seo_meta_keywords') || n === 'meta_keywords') {
            autoMapping['seoMetaKeywords'] = col;
          }
          else if (n.includes('seo_meta_description') || n === 'meta_description') {
            autoMapping['seoMetaDescription'] = col;
          }
          // Manufacturer / model
          else if (n === 'hersteller_precise' || n === 'manufacturer_precise') {
            autoMapping['manufacturerPrecise'] = col;
          }
          else if (n === 'hersteller' || n === 'manufacturer') {
            autoMapping['manufacturer'] = col;
          }
          else if (n === 'gerätemodell_precise' || n === 'geraetemodell_precise' || n === 'model_precise') {
            autoMapping['modelPrecise'] = col;
          }
          else if (n === 'gerätemodell' || n === 'geraetemodell' || n === 'modell' || n === 'model') {
            autoMapping['model'] = col;
          }
          // Color
          else if (n === 'farbe' || n === 'color') {
            autoMapping['color'] = col;
          }
          // Time / difficulty / warranty / device types / status (legacy English)
          else if (lowerCol.includes('time') || lowerCol.includes('duration') || lowerCol.includes('dauer')) {
            autoMapping['estimatedTime'] = col;
          } else if (lowerCol.includes('difficulty') || lowerCol.includes('schwierigkeit')) {
            autoMapping['difficulty'] = col;
          } else if (lowerCol.includes('warranty') || lowerCol.includes('garantie')) {
            autoMapping['warrantyPeriod'] = col;
          } else if (lowerCol.includes('devicetype') || lowerCol.includes('device_type') || lowerCol.includes('gerätetyp') || lowerCol.includes('geraetetyp')) {
            autoMapping['deviceTypes'] = col;
          } else if (lowerCol.includes('active') || lowerCol === 'aktiv' || lowerCol === 'is_active') {
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

  // Download sample CSV (German repair_services.csv format with semicolon delimiter)
  const handleDownloadSample = () => {
    const sampleData = [
      ['Artikelname', 'Std. VK Brutto', 'Std. VK Netto', 'EK Netto', 'Hersteller_precise', 'Gerätemodell_precise', 'Farbe', 'Service'],
      ['Apple iPhone 15 Display Reparatur (Standard)', '129,90', '109,16', '119,02', 'Apple', 'iPhone 15', '', 'Display Reparatur (Standard)'],
      ['Apple iPhone 15 Akkutausch', '109,90', '92,35', '17,75', 'Apple', 'iPhone 15', '', 'Akkutausch'],
      ['Samsung Galaxy A54 (A546B) Display Reparatur Black', '189,90', '159,58', '46,90', 'Samsung', 'Galaxy A54 (A546B)', 'Black', 'Display Reparatur'],
    ];

    const csv = sampleData
      .map((row) => row.map((c) => (String(c).includes(';') ? `"${c}"` : c)).join(';'))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
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
