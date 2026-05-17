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
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import { Upload, FileText, CheckCircle2, AlertTriangle, Download, SkipForward, RotateCcw } from 'lucide-react';
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
  ErrorRow,
} from '@/api/csvServiceImport';

interface ServiceCSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

type RowEditState = {
  name: string;
  price: string;
  category: string;
  skipped: boolean;
  clientErrors: string[];
};

const parseLocalizedPrice = (value: string): number => {
  const s = value.replace(/[€$£\s]/g, '').trim();
  if (!s) return NaN;
  // German: "1.234,56" or "99,90"
  if (s.includes(',') && s.includes('.')) {
    return s.lastIndexOf(',') > s.lastIndexOf('.')
      ? parseFloat(s.replace(/\./g, '').replace(',', '.'))
      : parseFloat(s.replace(/,/g, ''));
  }
  if (s.includes(',')) return parseFloat(s.replace(',', '.'));
  return parseFloat(s);
};

const validateRowClient = (name: string, price: string, category: string): string[] => {
  const errs: string[] = [];
  if (!name.trim()) errs.push('Service-Name ist erforderlich');
  else if (name.trim().length < 2) errs.push('Name muss mindestens 2 Zeichen haben');
  const p = parseLocalizedPrice(price);
  if (isNaN(p)) errs.push('Preis muss eine gültige Zahl sein');
  else if (p < 0) errs.push('Preis muss ≥ 0 sein');
  if (!category.trim()) errs.push('Kategorie ist erforderlich');
  return errs;
};

const ServiceCSVImportDialog: React.FC<ServiceCSVImportDialogProps> = ({
  open,
  onOpenChange,
  onImportComplete,
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState<'upload' | 'mapping' | 'review-errors' | 'preview' | 'importing' | 'complete'>('upload');
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
  const [rowEdits, setRowEdits] = useState<Map<number, RowEditState>>(new Map());

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
            if (normalized.length === 1 && /^sep\s*=\s*[,;|\t]$/i.test(normalized[0])) return false;
            return true;
          }) as unknown[] | undefined;
          resolve(sanitizeColumns(Array.isArray(headerRow) ? headerRow : []));
        },
        error: () => resolve([]),
      });
    });
  };

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
    setRowEdits(new Map());
    onOpenChange(false);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast({ variant: 'destructive', title: 'Ungültige Datei', description: 'Bitte eine CSV-Datei auswählen.' });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setProgress(20);
    try {
      const result = await validateCSVServiceImport(selectedFile);
      setProgress(60);
      if (result.needsMapping) {
        const apiColumns = Array.isArray(result.columns) ? result.columns : [];
        const previewRows = Array.isArray(result.previewData) ? result.previewData : [];
        const firstPreviewRow = previewRows.find((row) => row && typeof row === 'object') || {};
        const previewColumns = Object.keys(firstPreviewRow);
        const fileHeaderColumns = await extractHeadersFromFile(selectedFile);
        const filteredColumns = sanitizeColumns([...apiColumns, ...previewColumns, ...fileHeaderColumns]);
        if (filteredColumns.length === 0) {
          throw new Error('Keine CSV-Spalten erkannt. Bitte Datei mit gültiger Kopfzeile verwenden.');
        }
        setCsvColumns(filteredColumns);
        setPreviewData(previewRows);
        setProgress(100);
        setStep('mapping');
        const autoMapping: Record<string, string> = {};
        const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, '_');
        filteredColumns.forEach((col) => {
          const n = norm(col);
          const lowerCol = col.toLowerCase();
          if (n === 'artikelnummer' || n === 'artikel_nr' || n === 'artnr' || n === 'article_number' || n === 'sku') autoMapping['articleNumber'] = col;
          else if (n === 'artikelname' || n === 'name' || n === 'service_name' || n === 'bezeichnung') autoMapping['name'] = col;
          else if (n === 'service' || n === 'service_precise' || lowerCol.includes('category') || lowerCol.includes('kategorie')) {
            autoMapping['category'] = col;
            if (n === 'service' || n === 'service_precise') autoMapping['service'] = col;
          }
          else if (n === 'std._vk_brutto' || n === 'std_vk_brutto' || n === 'price_gross') autoMapping['priceGross'] = col;
          else if (n === 'std._vk_netto' || n === 'std_vk_netto' || n === 'price_net') autoMapping['priceNet'] = col;
          else if (n === 'ek_netto' || n.startsWith('ek_netto') || n === 'purchase_price') autoMapping['purchasePrice'] = col;
          else if (n === 'uvp') autoMapping['msrp'] = col;
          else if (n === 'steuerklasse') autoMapping['taxClass'] = col;
          else if (n === '_quelle') autoMapping['source'] = col;
          else if (!autoMapping['price'] && (lowerCol.includes('preis') || (lowerCol.includes('price') && !lowerCol.includes('net') && !lowerCol.includes('brutto')))) autoMapping['price'] = col;
          else if (n === 'kurzbeschreibung') autoMapping['shortDescription'] = col;
          else if (lowerCol.includes('beschreibung') || lowerCol === 'description') autoMapping['description'] = col;
          else if (n === 'druck_kurzbeschreibung' || n === 'druckkurzbeschreibung') autoMapping['printShortDescription'] = col;
          else if (n === 'druck_beschreibung' || n === 'druckbeschreibung') autoMapping['printDescription'] = col;
          else if (n === 'anmerkung' || n === 'amerkung') autoMapping['note'] = col;
          else if (n === 'suchbegriffe' || n === 'keywords') autoMapping['searchKeywords'] = col;
          else if (n.includes('seo_name') || n.includes('seo_namen')) autoMapping['seoName'] = col;
          else if (n.includes('seo_titel')) autoMapping['seoTitleTag'] = col;
          else if (n.includes('seo_meta_keywords') || n === 'meta_keywords') autoMapping['seoMetaKeywords'] = col;
          else if (n.includes('seo_meta_description') || n === 'meta_description') autoMapping['seoMetaDescription'] = col;
          else if (n === 'hersteller_precise' || n === 'manufacturer_precise') autoMapping['manufacturerPrecise'] = col;
          else if (n === 'hersteller' || n === 'manufacturer') autoMapping['manufacturer'] = col;
          else if (n === 'gerätemodell_precise' || n === 'geraetemodell_precise' || n === 'model_precise') autoMapping['modelPrecise'] = col;
          else if (n === 'gerätemodell' || n === 'geraetemodell' || n === 'modell' || n === 'model') autoMapping['model'] = col;
          else if (n === 'farbe' || n === 'color') autoMapping['color'] = col;
          else if (lowerCol.includes('time') || lowerCol.includes('duration') || lowerCol.includes('dauer')) autoMapping['estimatedTime'] = col;
          else if (lowerCol.includes('difficulty') || lowerCol.includes('schwierigkeit')) autoMapping['difficulty'] = col;
          else if (lowerCol.includes('warranty') || lowerCol.includes('garantie')) autoMapping['warrantyPeriod'] = col;
          else if (lowerCol.includes('devicetype') || lowerCol.includes('device_type') || lowerCol.includes('gerätetyp') || lowerCol.includes('geraetetyp')) autoMapping['deviceTypes'] = col;
          else if (lowerCol.includes('active') || lowerCol === 'aktiv' || lowerCol === 'is_active') autoMapping['isActive'] = col;
        });
        setColumnMapping(autoMapping);
        toast({ title: 'Datei hochgeladen', description: `CSV-Datei erfolgreich hochgeladen. ${result.totalRows} Zeilen gefunden. Bitte Spalten zuordnen.` });
      } else {
        setValidationResult(result);
        setProgress(100);
        setStep('preview');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Upload fehlgeschlagen', description: error.message || 'CSV-Datei konnte nicht hochgeladen werden.' });
    } finally {
      setIsProcessing(false);
    }
  };

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
        toast({ title: 'Validierung abgeschlossen', description: `${result.validatedData?.length || 0} Zeilen erfolgreich validiert.` });
      } else {
        // Build per-row edit state from the returned errorRows
        const edits = new Map<number, RowEditState>();
        (result.errorRows || []).forEach((row: ErrorRow) => {
          edits.set(row.rowIndex, {
            name: String(row.data.name || ''),
            price: isNaN(row.data.price) ? '' : String(row.data.price),
            category: String(row.data.category || ''),
            skipped: false,
            clientErrors: row.errors.map((e) => e.replace(/^Row \d+:\s*/, '')),
          });
        });
        setRowEdits(edits);
        setStep('review-errors');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Validierung fehlgeschlagen', description: error.message || 'CSV-Daten konnten nicht validiert werden.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const updateRowEdit = (rowIndex: number, patch: Partial<RowEditState>) => {
    setRowEdits((prev) => {
      const m = new Map(prev);
      const current = m.get(rowIndex);
      if (current) m.set(rowIndex, { ...current, ...patch });
      return m;
    });
  };

  const handleContinueWithEdits = () => {
    // Client-validate all non-skipped edited rows
    let allValid = true;
    const updatedEdits = new Map(rowEdits);
    updatedEdits.forEach((edit, rowIndex) => {
      if (!edit.skipped) {
        const clientErrors = validateRowClient(edit.name, edit.price, edit.category);
        updatedEdits.set(rowIndex, { ...edit, clientErrors });
        if (clientErrors.length > 0) allValid = false;
      }
    });
    setRowEdits(updatedEdits);

    if (!allValid) {
      toast({ title: 'Noch Fehler vorhanden', description: 'Bitte alle markierten Felder korrigieren oder die Zeile überspringen.', variant: 'destructive' });
      return;
    }

    // Build fixed rows from edited state
    const fixedRows: ValidatedRow[] = [];
    updatedEdits.forEach((edit, rowIndex) => {
      if (!edit.skipped && validationResult?.errorRows) {
        const original = validationResult.errorRows.find((r) => r.rowIndex === rowIndex);
        if (original) {
          fixedRows.push({
            rowIndex,
            data: {
              ...original.data,
              name: edit.name.trim(),
              price: parseLocalizedPrice(edit.price),
              category: edit.category.trim(),
            },
          });
        }
      }
    });

    const combined = [...(validationResult?.validatedData || []), ...fixedRows].sort((a, b) => a.rowIndex - b.rowIndex);
    setValidationResult((prev) => prev ? { ...prev, validatedData: combined, success: true, errors: [] } : prev);
    setStep('preview');
  };

  const handleSkipAllAndContinue = () => {
    // validationResult.validatedData already contains only valid rows
    setValidationResult((prev) => prev ? { ...prev, success: true, errors: [] } : prev);
    setStep('preview');
  };

  const handleImport = async () => {
    if (!validationResult?.validatedData) return;
    setIsProcessing(true);
    setStep('importing');
    setProgress(0);
    try {
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 5, 90));
      }, 200);
      const result = await importServicesFromCSV(validationResult.validatedData, { skipDuplicates, updateExisting });
      clearInterval(progressInterval);
      setProgress(100);
      setImportResult(result);
      setStep('complete');
      if (result.success) {
        toast({ title: 'Import abgeschlossen', description: `${result.stats.importedCount} Services erfolgreich importiert.` });
        onImportComplete();
      } else {
        toast({ variant: 'destructive', title: 'Import mit Fehlern abgeschlossen', description: `${result.stats.importedCount} importiert, ${result.stats.failedCount} fehlgeschlagen.` });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Import fehlgeschlagen', description: error.message || 'Services konnten nicht importiert werden.' });
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadSample = () => {
    const sampleData = [
      ['Artikelname', 'Std. VK Brutto', 'Std. VK Netto', 'EK Netto', 'Hersteller_precise', 'Gerätemodell_precise', 'Farbe', 'Service'],
      ['Apple iPhone 15 Display Reparatur (Standard)', '129,90', '109,16', '119,02', 'Apple', 'iPhone 15', '', 'Display Reparatur (Standard)'],
      ['Apple iPhone 15 Akkutausch', '109,90', '92,35', '17,75', 'Apple', 'iPhone 15', '', 'Akkutausch'],
      ['Samsung Galaxy A54 (A546B) Display Reparatur Black', '189,90', '159,58', '46,90', 'Samsung', 'Galaxy A54 (A546B)', 'Black', 'Display Reparatur'],
    ];
    const csv = sampleData.map((row) => row.map((c) => (String(c).includes(';') ? `"${c}"` : c)).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'service_import_sample.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const errorRowList = validationResult?.errorRows || [];
  const skippedCount = Array.from(rowEdits.values()).filter((e) => e.skipped).length;
  const fixableCount = errorRowList.length - skippedCount;
  const validCount = validationResult?.validatedData?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Services aus CSV importieren</DialogTitle>
          <DialogDescription>
            CSV-Datei hochladen um mehrere Repair Services auf einmal zu importieren
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: File Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <div className="space-y-2">
                <Label htmlFor="csv-file" className="cursor-pointer">
                  <div className="text-lg font-medium">CSV-Datei auswählen</div>
                  <div className="text-sm text-muted-foreground">oder drag &amp; drop</div>
                </Label>
                <input id="csv-file" type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
              </div>
              {selectedFile && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <FileText className="h-5 w-5" />
                  <span className="font-medium">{selectedFile.name}</span>
                </div>
              )}
            </div>
            <Button variant="outline" onClick={handleDownloadSample} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Beispiel-CSV herunterladen
            </Button>
            {isProcessing && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-center text-muted-foreground">CSV wird hochgeladen und geparst…</p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <Tabs defaultValue="mapping">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="mapping">Spalten zuordnen</TabsTrigger>
                <TabsTrigger value="preview">Datenvorschau</TabsTrigger>
              </TabsList>
              <TabsContent value="mapping" className="space-y-4">
                <ServiceColumnAssignmentPanel
                  csvColumns={csvColumns}
                  columnMapping={columnMapping}
                  onColumnMappingChange={(field, column) => setColumnMapping((prev) => ({ ...prev, [field]: column }))}
                />
              </TabsContent>
              <TabsContent value="preview">
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Erste 5 Zeilen:</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          {csvColumns.filter((col) => col && col.trim() !== '').map((col) => (
                            <th key={col} className="text-left p-2 border-b">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, index) => (
                          <tr key={index}>
                            {csvColumns.filter((col) => col && col.trim() !== '').map((col) => (
                              <td key={col} className="p-2 border-b">{row[col]}</td>
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
                <p className="text-sm text-center text-muted-foreground">Daten werden validiert…</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review Errors */}
        {step === 'review-errors' && validationResult && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="border rounded-lg p-3 bg-red-50 border-red-200 text-center">
                <p className="text-2xl font-bold text-red-600">{errorRowList.length}</p>
                <p className="text-xs text-red-500">Zeilen mit Fehlern</p>
              </div>
              <div className="border rounded-lg p-3 bg-green-50 border-green-200 text-center">
                <p className="text-2xl font-bold text-green-600">{validCount}</p>
                <p className="text-xs text-green-500">Gültige Zeilen</p>
              </div>
              <div className="border rounded-lg p-3 bg-slate-50 border-slate-200 text-center">
                <p className="text-2xl font-bold text-slate-600">{skippedCount}</p>
                <p className="text-xs text-slate-500">Übersprungen</p>
              </div>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Fehlende Pflichtfelder (<strong>Name</strong>, <strong>Preis</strong>, <strong>Kategorie</strong>) können direkt inline korrigiert werden.
                Zeilen die nicht repariert werden können bitte überspringen.
              </AlertDescription>
            </Alert>

            {/* Error row list */}
            <div className="max-h-[45vh] overflow-y-auto space-y-2 pr-1">
              {errorRowList.map((errorRow) => {
                const edit = rowEdits.get(errorRow.rowIndex);
                if (!edit) return null;
                const hasRemainingErrors = !edit.skipped && edit.clientErrors.length > 0;
                return (
                  <div
                    key={errorRow.rowIndex}
                    className={`border rounded-lg p-3 text-sm transition-all ${
                      edit.skipped
                        ? 'opacity-40 bg-slate-50 border-slate-200'
                        : hasRemainingErrors
                        ? 'bg-white border-red-200'
                        : 'bg-green-50 border-green-200'
                    }`}
                  >
                    {/* Row header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">Zeile {errorRow.rowIndex}</Badge>
                        {edit.skipped && <span className="text-xs text-slate-500">übersprungen</span>}
                        {!edit.skipped && !hasRemainingErrors && (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> korrigiert
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`h-7 text-xs px-2 ${edit.skipped ? 'text-blue-600 hover:text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => updateRowEdit(errorRow.rowIndex, { skipped: !edit.skipped })}
                      >
                        {edit.skipped ? (
                          <><RotateCcw className="h-3 w-3 mr-1" />Wiederherstellen</>
                        ) : (
                          <><SkipForward className="h-3 w-3 mr-1" />Überspringen</>
                        )}
                      </Button>
                    </div>

                    {!edit.skipped && (
                      <>
                        {/* Error badges */}
                        {edit.clientErrors.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {edit.clientErrors.map((err, i) => (
                              <span key={i} className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                                {err}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Editable fields */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">Name *</p>
                            <Input
                              value={edit.name}
                              onChange={(e) => updateRowEdit(errorRow.rowIndex, { name: e.target.value, clientErrors: [] })}
                              className={`h-7 text-xs ${!edit.name.trim() ? 'border-red-300 focus-visible:ring-red-300' : ''}`}
                              placeholder="Service-Name"
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">Preis *</p>
                            <Input
                              value={edit.price}
                              onChange={(e) => updateRowEdit(errorRow.rowIndex, { price: e.target.value, clientErrors: [] })}
                              className={`h-7 text-xs ${!edit.price.trim() || isNaN(parseLocalizedPrice(edit.price)) ? 'border-red-300 focus-visible:ring-red-300' : ''}`}
                              placeholder="0,00"
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">Kategorie *</p>
                            <Input
                              value={edit.category}
                              onChange={(e) => updateRowEdit(errorRow.rowIndex, { category: e.target.value, clientErrors: [] })}
                              className={`h-7 text-xs ${!edit.category.trim() ? 'border-red-300 focus-visible:ring-red-300' : ''}`}
                              placeholder="z.B. Display Reparatur"
                            />
                          </div>
                        </div>

                        {/* Additional context fields (read-only) */}
                        {(errorRow.data.manufacturerPrecise || errorRow.data.modelPrecise) && (
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {errorRow.data.manufacturerPrecise && <span className="mr-2">Hersteller: <strong>{errorRow.data.manufacturerPrecise}</strong></span>}
                            {errorRow.data.modelPrecise && <span>Modell: <strong>{errorRow.data.modelPrecise}</strong></span>}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 4: Preview and Validation */}
        {step === 'preview' && validationResult && (
          <div className="space-y-4">
            <ServiceCSVPreviewTable
              validatedData={validationResult.validatedData || []}
              errors={validationResult.errors || []}
              warnings={validationResult.warnings || []}
            />
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold">Import-Optionen</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="skipDuplicates" checked={skipDuplicates} onCheckedChange={(checked) => setSkipDuplicates(checked as boolean)} />
                  <Label htmlFor="skipDuplicates">Duplikate überspringen</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="updateExisting" checked={updateExisting} onCheckedChange={(checked) => setUpdateExisting(checked as boolean)} />
                  <Label htmlFor="updateExisting">Bestehende Services aktualisieren</Label>
                </div>
              </div>
              {validationResult.duplicateCheck?.hasDuplicates && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {validationResult.duplicateCheck.duplicateCount} doppelter Service bereits in der Datenbank gefunden.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Importing */}
        {step === 'importing' && (
          <div className="space-y-4 py-8">
            <div className="text-center">
              <Upload className="h-16 w-16 mx-auto mb-4 animate-pulse" />
              <h3 className="text-lg font-semibold">Services werden importiert…</h3>
              <p className="text-muted-foreground">Bitte warten</p>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {/* Step 6: Complete */}
        {step === 'complete' && importResult && (
          <div className="space-y-4">
            <div className="text-center py-6">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-semibold">Import abgeschlossen!</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{importResult.stats.importedCount}</div>
                <div className="text-sm text-muted-foreground">Importiert</div>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600">{importResult.stats.skippedCount}</div>
                <div className="text-sm text-muted-foreground">Übersprungen</div>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{importResult.stats.failedCount}</div>
                <div className="text-sm text-muted-foreground">Fehlgeschlagen</div>
              </div>
            </div>
            {importResult.failed.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-semibold">Fehlgeschlagene Imports:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {importResult.failed.map((fail) => (
                        <li key={fail.rowIndex}>Zeile {fail.rowIndex}: {fail.serviceName} — {fail.error}</li>
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
              <Button variant="outline" onClick={handleClose}>Abbrechen</Button>
              <Button onClick={handleUpload} disabled={!selectedFile || isProcessing}>Weiter</Button>
            </>
          )}
          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>Zurück</Button>
              <Button onClick={handleValidate} disabled={isProcessing}>Daten validieren</Button>
            </>
          )}
          {step === 'review-errors' && (
            <>
              <Button variant="outline" onClick={() => setStep('mapping')}>Zurück</Button>
              <Button
                variant="outline"
                onClick={handleSkipAllAndContinue}
                disabled={validCount === 0}
              >
                <SkipForward className="h-4 w-4 mr-1" />
                Alle Fehler überspringen &amp; mit {validCount} Zeilen fortfahren
              </Button>
              <Button
                onClick={handleContinueWithEdits}
                disabled={fixableCount === 0 && validCount === 0}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Korrekturen anwenden &amp; fortfahren
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep(errorRowList.length > 0 ? 'review-errors' : 'mapping')}>Zurück</Button>
              <Button onClick={handleImport} disabled={!validationResult?.success || isProcessing}>
                Services importieren ({validationResult?.validatedData?.length || 0} Zeilen)
              </Button>
            </>
          )}
          {step === 'complete' && (
            <Button onClick={handleClose}>Schließen</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ServiceCSVImportDialog;
