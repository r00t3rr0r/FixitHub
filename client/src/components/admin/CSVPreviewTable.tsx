import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';

interface CSVPreviewTableProps {
  data: any[];
  columnMapping: Record<string, string>;
  validationErrors?: Array<{ email: string; errors: string[] }>;
  maxRows?: number;
}

export const CSVPreviewTable: React.FC<CSVPreviewTableProps> = ({
  data,
  columnMapping,
  validationErrors = [],
  maxRows = 10
}) => {
  const displayData = data.slice(0, maxRows);
  const validationMap = new Map(validationErrors.map(v => [v.email?.toLowerCase(), v.errors]));

  // Get mapped column headers
  const mappedColumns = Object.entries(columnMapping)
    .filter(([_, value]) => value)
    .map(([key, value]) => ({ key, label: value }));

  if (displayData.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">No data to preview</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Status</TableHead>
                {mappedColumns.map(column => (
                  <TableHead key={column.key} className="whitespace-nowrap">
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.map((row, index) => {
                const email = row[columnMapping.email]?.toLowerCase();
                const errors = validationMap.get(email);
                const isValid = !errors || errors.length === 0;

                return (
                  <TableRow key={index} className={!isValid ? 'bg-destructive/5' : ''}>
                    <TableCell className="text-center">
                      {isValid ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      )}
                    </TableCell>
                    {mappedColumns.map(column => {
                      const cellValue = row[columnMapping[column.key]] || '-';
                      return (
                        <TableCell key={column.key} className="whitespace-nowrap text-sm">
                          {cellValue}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {data.length > maxRows && (
        <p className="text-sm text-muted-foreground">
          Showing {maxRows} of {data.length} rows
        </p>
      )}

      {validationErrors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-900">Validation Errors Found</p>
              <ul className="mt-2 space-y-1">
                {validationErrors.slice(0, 5).map((error, idx) => (
                  <li key={idx} className="text-amber-800">
                    <strong>{error.email}:</strong> {error.errors.join(', ')}
                  </li>
                ))}
              </ul>
              {validationErrors.length > 5 && (
                <p className="mt-2 text-amber-800">
                  ...and {validationErrors.length - 5} more errors
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
