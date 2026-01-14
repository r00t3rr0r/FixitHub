import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ValidationError {
  index: number;
  email: string;
  errors: string[];
  data: any;
}

interface ValidationErrorsPanelProps {
  errors: ValidationError[];
  onSkipRecords?: (skippedIndices: number[]) => void;
  onProceedWithValidRecords?: () => void;
  validRecordsCount?: number;
  totalRecords?: number;
}

export const ValidationErrorsPanel: React.FC<ValidationErrorsPanelProps> = ({
  errors,
  onSkipRecords,
  onProceedWithValidRecords,
  validRecordsCount = 0,
  totalRecords = 0
}) => {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const toggleRowExpand = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const toggleRowSelect = (index: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRows(newSelected);
    setSelectAll(false);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(errors.map(e => e.index)));
    } else {
      setSelectedRows(new Set());
    }
    setSelectAll(checked);
  };

  const handleSkipSelected = () => {
    const skippedIndices = Array.from(selectedRows).sort((a, b) => a - b);
    onSkipRecords?.(skippedIndices);
  };

  const handleSkipAll = () => {
    const allIndices = errors.map(e => e.index);
    onSkipRecords?.(allIndices);
  };

  const handleProceedWithValid = () => {
    // Skip only the selected records
    const skippedIndices = Array.from(selectedRows).sort((a, b) => a - b);
    if (skippedIndices.length > 0) {
      onSkipRecords?.(skippedIndices);
    }
    onProceedWithValidRecords?.();
  };

  const invalidCount = errors.length;
  const canImportValidRecords = validRecordsCount > 0;

  return (
    <div className="space-y-4">
      <Alert className="bg-red-50 border-red-200">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <p className="font-semibold mb-2">Validation Errors Found</p>
          <p className="text-sm">
            {invalidCount} record(s) have validation errors that must be resolved or skipped.
            {canImportValidRecords && (
              <span> {validRecordsCount} valid record(s) can be imported.</span>
            )}
          </p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Records with Errors</CardTitle>
          <CardDescription>
            Review and select records to skip or fix
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Checkbox
              id="selectAll"
              checked={selectAll}
              onCheckedChange={handleSelectAll}
              aria-label="Select all error records"
            />
            <label htmlFor="selectAll" className="text-sm font-medium cursor-pointer">
              Select All ({selectedRows.size}/{invalidCount})
            </label>
          </div>

          <ScrollArea className="w-full border rounded-lg">
            <div className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectAll}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Error Count</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errors.map((error, idx) => (
                    <React.Fragment key={idx}>
                      <TableRow className="bg-red-50/30">
                        <TableCell>
                          <Checkbox
                            checked={selectedRows.has(error.index)}
                            onCheckedChange={() => toggleRowSelect(error.index)}
                            aria-label={`Select ${error.email}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{error.email}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{error.errors.length} error(s)</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRowExpand(error.index)}
                            className="p-1"
                          >
                            {expandedRows.has(error.index) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedRows.has(error.index) && (
                        <TableRow className="bg-red-50/50">
                          <TableCell colSpan={4} className="p-4">
                            <div className="space-y-3">
                              <div>
                                <p className="text-sm font-semibold mb-2">Validation Errors:</p>
                                <ul className="space-y-1">
                                  {error.errors.map((err, errIdx) => (
                                    <li key={errIdx} className="text-sm text-red-700 flex items-start gap-2">
                                      <span className="text-red-600">•</span>
                                      {err}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              {error.data && (
                                <div className="text-xs text-gray-600 bg-white p-2 rounded border border-gray-200">
                                  <p className="font-medium mb-1">Record Data:</p>
                                  <div className="space-y-1">
                                    {Object.entries(error.data)
                                      .slice(0, 5)
                                      .map(([key, value]) => (
                                        <div key={key}>
                                          <span className="font-medium">{key}:</span> {String(value || '-')}
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>

          <div className="text-xs text-muted-foreground">
            {selectedRows.size > 0 && (
              <p>{selectedRows.size} record(s) selected for skipping</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2">
            {canImportValidRecords && (
              <>
                <Button
                  onClick={handleProceedWithValid}
                  variant="default"
                  className="w-full"
                >
                  {selectedRows.size > 0
                    ? `Skip Selected (${selectedRows.size}) & Import Valid Records (${validRecordsCount})`
                    : `Import Only Valid Records (${validRecordsCount})`}
                </Button>
                <p className="text-xs text-blue-700 text-center">
                  Skips selected records and imports the {validRecordsCount} valid record(s)
                </p>
              </>
            )}

            {selectedRows.size > 0 && (
              <Button
                onClick={handleSkipSelected}
                variant="outline"
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Skip Selected {selectedRows.size} Record(s)
              </Button>
            )}

            <Button
              onClick={handleSkipAll}
              variant="outline"
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Skip All {invalidCount} Error Records
            </Button>
          </div>

          <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded">
            <p className="font-medium mb-1">How to fix records with errors:</p>
            <ul className="space-y-1">
              <li>• <strong>Skip:</strong> Remove the record from import</li>
              <li>• <strong>Fix locally:</strong> Correct the CSV file and re-import</li>
              <li>• <strong>Import valid:</strong> Only import records without errors</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
