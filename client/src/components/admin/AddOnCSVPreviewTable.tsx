import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ValidatedRow } from '@/api/csvAddOnImport';
import {
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

interface AddOnCSVPreviewTableProps {
  validatedData: ValidatedRow[];
  errors: string[];
  warnings: string[];
}

const AddOnCSVPreviewTable: React.FC<AddOnCSVPreviewTableProps> = ({
  validatedData,
  errors,
  warnings,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Pagination
  const totalPages = Math.ceil(validatedData.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentData = validatedData.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <div className="space-y-4">
      {/* Validation Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="font-semibold">Valid Rows</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{validatedData.length}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="font-semibold">Errors</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{errors.length}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <span className="font-semibold">Warnings</span>
          </div>
          <div className="text-2xl font-bold text-yellow-600">{warnings.length}</div>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-semibold">Validation Errors:</p>
              <ul className="list-disc list-inside space-y-1 text-sm max-h-48 overflow-y-auto">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-semibold">Warnings:</p>
              <ul className="list-disc list-inside space-y-1 text-sm max-h-48 overflow-y-auto">
                {warnings.slice(0, 10).map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
                {warnings.length > 10 && (
                  <li className="text-muted-foreground">
                    ...and {warnings.length - 10} more warnings
                  </li>
                )}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Data Preview Table */}
      {validatedData.length > 0 && (
        <div className="border rounded-lg">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Data Preview</h3>
            <p className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(endIndex, validatedData.length)} of{' '}
              {validatedData.length} valid rows
            </p>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Row</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Estimated Time</TableHead>
                  <TableHead>Bundle Discount</TableHead>
                  <TableHead>Popularity</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.map((item) => (
                  <TableRow key={item.rowIndex}>
                    <TableCell className="font-mono text-sm">{item.rowIndex}</TableCell>
                    <TableCell className="font-medium">
                      {item.data.name || '-'}
                      {item.data.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-1">
                          {item.data.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.data.category || '-'}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">
                      ${item.data.price?.toFixed(2) || '0.00'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.data.estimatedTime || '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.data.bundleDiscount !== undefined
                        ? `${item.data.bundleDiscount}%`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.data.popularity !== undefined
                        ? `${item.data.popularity}%`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Valid
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}

      {validatedData.length === 0 && errors.length === 0 && (
        <div className="text-center py-8 border rounded-lg">
          <p className="text-muted-foreground">No valid data to preview</p>
        </div>
      )}
    </div>
  );
};

export default AddOnCSVPreviewTable;
