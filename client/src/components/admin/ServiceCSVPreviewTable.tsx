import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { ValidatedRow } from '@/api/csvServiceImport';

interface ServiceCSVPreviewTableProps {
  validatedData: ValidatedRow[];
  errors: string[];
  warnings: string[];
}

const ServiceCSVPreviewTable: React.FC<ServiceCSVPreviewTableProps> = ({
  validatedData,
  errors,
  warnings,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Calculate pagination
  const totalPages = Math.ceil(validatedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = validatedData.slice(startIndex, endIndex);

  // Group errors by row
  const errorsByRow = new Map<number, string[]>();
  errors.forEach((error) => {
    const match = error.match(/Row (\d+):/);
    if (match) {
      const rowNum = parseInt(match[1]);
      if (!errorsByRow.has(rowNum)) {
        errorsByRow.set(rowNum, []);
      }
      errorsByRow.get(rowNum)?.push(error);
    }
  });

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center space-x-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <div>
            <p className="text-sm font-medium">Valid Rows</p>
            <p className="text-2xl font-bold">{validatedData.length}</p>
          </div>
        </div>
        {errors.length > 0 && (
          <div className="flex items-center space-x-2">
            <XCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm font-medium">Errors</p>
              <p className="text-2xl font-bold">{errors.length}</p>
            </div>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-sm font-medium">Warnings</p>
              <p className="text-2xl font-bold">{warnings.length}</p>
            </div>
          </div>
        )}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-semibold">Errors found:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {errors.slice(0, 5).map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
                {errors.length > 5 && (
                  <li className="text-muted-foreground">
                    ...and {errors.length - 5} more errors
                  </li>
                )}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert>
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-semibold">Warnings:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {warnings.slice(0, 3).map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
                {warnings.length > 3 && (
                  <li className="text-muted-foreground">
                    ...and {warnings.length - 3} more warnings
                  </li>
                )}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Data Preview Table */}
      {validatedData.length > 0 && (
        <>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Row</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Est. Time</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.map((row) => {
                  const hasError = errorsByRow.has(row.rowIndex);
                  return (
                    <TableRow key={row.rowIndex} className={hasError ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                      <TableCell className="font-medium">{row.rowIndex}</TableCell>
                      <TableCell>{row.data.name}</TableCell>
                      <TableCell>{row.data.category}</TableCell>
                      <TableCell className="text-right">${row.data.price?.toFixed(2)}</TableCell>
                      <TableCell>{row.data.estimatedTime} min</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.data.difficulty === 'Easy'
                              ? 'default'
                              : row.data.difficulty === 'Hard'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {row.data.difficulty}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {hasError ? (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Error
                          </Badge>
                        ) : (
                          <Badge variant="default">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Valid
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, validatedData.length)} of{' '}
                {validatedData.length} rows
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ServiceCSVPreviewTable;
