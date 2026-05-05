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
import { ColumnAssignmentPanelDevice } from './ColumnAssignmentPanelDevice';
import { CSVPreviewTable } from './CSVPreviewTable';
import { ValidationErrorsPanel } from './ValidationErrorsPanel';
import { validateDeviceCSVImport, importDevicesFromCSV } from '@/api/csvDeviceImport';
import { getBrands, Brand } from '@/api/brands';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from 'react-i18next';
import { Upload, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface CSVImportDevicesDialogProps {
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
  duplicates?: Array<{ name: string; type: string; message: string }>;
  validationErrors?: Array<{ index: number; name: string; errors: string[]; data: any }>;
  validatedRecords?: any[];
  message?: string;
}

export const CSVImportDevicesDialog: React.FC<CSVImportDevicesDialogProps> = ({
  open,
  onOpenChange,
  onImportSuccess
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State management
  const [brands, setBrands] = useState<Brand[]>([]);
  // Fetch brands on open
  React.useEffect(() => {
    if (open) {
      getBrands().then(res => {
        setBrands(res || []);
      });
    }
  }, [open]);
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

    if (file.size > 100 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'CSV file must be smaller than 100MB'
      });
      return;
    }

    // Parse CSV file
    Papa.parse(file, {
      skipEmptyLines: true,
      header: true,
      complete: (results) => {
        let rawRows = results.data;
        const columns = Object.keys((rawRows[0] as any) || {});
        // Auto-map columns for device models.
        // Strategy: try EXACT (case-insensitive) match first across all aliases of every
        // field. Only fall back to substring matching for aliases that don't have an exact
        // hit. This avoids picking e.g. "Artikelname" for `name` (because it contains
        // "name") or "Category" for `deviceType` (because `category` is in its alias list)
        // when more specific columns like "Gerätemodell_precise" / "DeviceType" exist.
        const autoMapping: Record<string, string> = {};
        const commonMappings: Record<string, string[]> = {
          name: ['name', 'modell', 'model', 'model_name', 'gerätemodell', 'geraetemodell', 'gerätemodell_precise', 'geraetemodell_precise'],
          brandId: ['brandid', 'brand_id'],
          deviceType: ['devicetype', 'device_type', 'gerätetyp', 'geraetetyp', 'devicetyp'],
          manufacturer: ['manufacturer', 'hersteller', 'hersteller_precise', 'brand', 'marke', 'brand_name'],
          image: ['image', 'bild', 'image_url'],
          series: ['series', 'serie'],
          year: ['year', 'jahr', 'release_year', 'releaseyear'],
          slug: ['slug'],
          modelNumbers: ['modelnumbers', 'model_numbers', 'model numbers', 'model-numbers', 'modellnummern', 'modell nummern', 'modellnummer', 'model_no'],
          synonyms: ['synonyms', 'synonyme', 'aliases', 'alias'],
          commonProblems: ['commonproblems', 'common_problems', 'problems', 'probleme'],
          specifications: ['specifications', 'spezifikationen', 'specs'],
          images: ['images', 'device_images', 'bilder'],
          network: ['network', 'netzwerk'],
          physical: ['physical', 'physisch', 'physical_specs'],
          display: ['display', 'display_specs', 'anzeige'],
          platform: ['platform', 'plattform'],
          memory: ['memory', 'speicher'],
          rearCamera: ['rearcamera', 'rear_camera', 'hauptkamera'],
          frontCamera: ['frontcamera', 'front_camera', 'frontkamera'],
          audio: ['audio', 'audio_specs'],
          connectivity: ['connectivity', 'verbindung', 'connect_specs'],
          features: ['features', 'features_specs', 'funktionen'],
          battery: ['battery', 'akku', 'battery_specs'],
          other: ['other', 'sonstiges'],
          'other.models': ['other.models', 'modellvarianten', 'model_variants'],
          'other.sarValues.head': ['sar_head', 'sar_wert_kopf'],
          'other.sarValues.body': ['sar_body', 'sar_wert_koerper'],
          'other.price': ['price', 'preis'],
          'other.releaseDate': ['release_date', 'erscheinungsdatum'],
          'other.colors': ['colors', 'farben'],
        };

        const usedColumns = new Set<string>();
        const findExact = (aliases: string[]) =>
          columns.find(
            (col) =>
              !usedColumns.has(col) &&
              aliases.some((alias) => col.toLowerCase() === alias.toLowerCase())
          );
        const findSubstring = (aliases: string[]) =>
          columns.find(
            (col) =>
              !usedColumns.has(col) &&
              aliases.some((alias) => col.toLowerCase().includes(alias.toLowerCase()))
          );

        // Pass 1: exact matches (claim columns first so they aren't reused).
        Object.entries(commonMappings).forEach(([field, aliases]) => {
          const exact = findExact(aliases);
          if (exact) {
            autoMapping[field] = exact;
            usedColumns.add(exact);
          }
        });
        // Pass 2: substring fallback for fields that didn't get an exact hit.
        Object.entries(commonMappings).forEach(([field, aliases]) => {
          if (autoMapping[field]) return;
          const sub = findSubstring(aliases);
          if (sub) {
            autoMapping[field] = sub;
            usedColumns.add(sub);
          }
        });

        // Brand-Namen zu IDs mappen, falls brandId gemappt ist
        let unmappedBrands: string[] = [];
        if (autoMapping.brandId && brands.length > 0) {
          rawRows = rawRows.map(row => {
            const brandValue = row[autoMapping.brandId]?.trim();
            const foundBrand = brands.find(b => b.name.toLowerCase() === brandValue?.toLowerCase());
            if (!foundBrand && brandValue && !unmappedBrands.includes(brandValue)) {
              unmappedBrands.push(brandValue);
            }
            return {
              ...row,
              [autoMapping.brandId]: foundBrand ? foundBrand._id : row[autoMapping.brandId]
            };
          });
        }

        setCSVData(rawRows);
        setCSVColumns(columns);
        setColumnMapping(autoMapping);
        setStep('mapping');
        if (unmappedBrands.length > 0) {
          toast({
            variant: 'destructive',
            title: 'Warnung: Unbekannte Marken',
            description: `Folgende Marken konnten nicht zugeordnet werden: ${unmappedBrands.slice(0, 10).join(', ')}${unmappedBrands.length > 10 ? ', ...' : ''}`
          });
        } else {
          toast({
            title: 'File loaded',
            description: `Successfully loaded ${rawRows.length} rows with ${columns.length} columns`
          });
        }
      },
      error: (error) => {
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
    setSkippedIndices(new Set());
    try {
      const result = await validateDeviceCSVImport(csvData, columnMapping, { skipDuplicates });
      setValidationResult(result);
      if (result.success) {
        setStep('preview');
      } else {
        setStep('errors');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Validation error',
        description: error.message
      });
      setStep('errors');
    } finally {
      setIsValidating(false);
    }
  };

  // Handle import
  const handleImport = async () => {
    setIsImporting(true);
    setImportProgress(0);
    try {
      // Vor dem Import: Brand-Namen zu IDs mappen, falls noch kein ObjectId
      const allRecords = (validationResult?.validatedRecords || []).map(row => {
        let brandId = row.brandId;
        // Wenn brandId kein 24-stelliger Hex-String ist, versuche Mapping
        if (typeof brandId === 'string' && !/^[a-f\d]{24}$/i.test(brandId)) {
          const foundBrand = brands.find(b => b.name.toLowerCase() === brandId.trim().toLowerCase());
          if (foundBrand) brandId = foundBrand._id;
        }
        return { ...row, brandId };
      });
      // Debug: Logge die ersten 3 Records, die importiert werden sollen
      if (allRecords.length > 0) {
        // eslint-disable-next-line no-console
        console.log('[ImportDeviceModels] Erste 3 Records für Import:', allRecords.slice(0, 3));
      }
      const batchSize = 20;
      let imported = 0;
      let failed = 0;
      for (let i = 0; i < allRecords.length; i += batchSize) {
        const batch = allRecords.slice(i, i + batchSize);
        const result = await importDevicesFromCSV(batch);
        imported += result.imported || 0;
        failed += result.failed || 0;
        setImportProgress(Math.round(((i + batch.length) / allRecords.length) * 100));
      }
      toast({
        title: 'Import abgeschlossen',
        description: `${imported} Geräte importiert, ${failed} Fehler.`
      });
      onImportSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Import error',
        description: error.message
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Device Models from CSV</DialogTitle>
            <DialogDescription>
              Follow the steps below to import device models from a CSV file
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
                    Select a CSV file containing device model data. The file must include columns for model name, manufacturer and device type.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium mb-2">Click to upload or drag and drop</p>
                    <p className="text-sm text-muted-foreground">CSV file up to 100MB</p>
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
              <ColumnAssignmentPanelDevice
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
                  Skip duplicate device models (if unchecked, import will fail on duplicates)
                </label>
              </div>

              <Button
                onClick={handleValidate}
                disabled={isValidating || !columnMapping.name || !columnMapping.manufacturer || !columnMapping.deviceType}
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
                  onSkipRecords={(skippedIndices) => {
                    // Filter out skipped indices from csvData, re-validate
                    const indicesToSkip = new Set(skippedIndices);
                    const filtered = csvData.filter((_, idx) => !indicesToSkip.has(idx));
                    setCSVData(filtered);
                    setStep('mapping'); // zurück zum Mapping, damit der Nutzer ggf. nochmal prüfen kann
                    toast({
                      title: 'Skipped error records',
                      description: `${skippedIndices.length} error records skipped. Please re-validate.`,
                    });
                  }}
                  onProceedWithValidRecords={() => {
                    // Nur die validierten Datensätze übernehmen und zur Preview springen
                    if (validationResult?.validatedRecords?.length) {
                      setCSVData(validationResult.validatedRecords);
                      setStep('preview');
                      toast({
                        title: 'Proceeding with valid records',
                        description: `${validationResult.validatedRecords.length} valid records ready for import.`
                      });
                    }
                  }}
                  validRecordsCount={validationResult.validatedRecords?.length || 0}
                  recordLabel="Model Name"
                />
              )}
            </TabsContent>

            {/* Step 4: Preview */}
            <TabsContent value="preview" className="space-y-4">
              <CSVPreviewTable
                data={validationResult?.validatedRecords || []}
                columnMapping={columnMapping}
              />
              <Button
                onClick={() => setStep('import')}
                className="w-full"
                disabled={isImporting}
              >
                Proceed to Import
              </Button>
            </TabsContent>

            {/* Step 5: Import */}
            <TabsContent value="import" className="space-y-4">
              <Progress value={importProgress} className="w-full" />
              <Button
                onClick={handleImport}
                disabled={isImporting}
                className="w-full"
              >
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Import Device Models
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
};
