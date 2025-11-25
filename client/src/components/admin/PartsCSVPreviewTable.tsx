import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { ValidationResult } from '@/api/csvPartsImport';

interface PartsCSVPreviewTableProps {
  validationResult: ValidationResult;
}

export const PartsCSVPreviewTable: React.FC<PartsCSVPreviewTableProps> = ({
  validationResult
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data = [], summary, duplicates = [], validationErrors = [] } = validationResult;

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = data.slice(startIndex, endIndex);

  const hasErrors = (validationErrors && validationErrors.length > 0) || (duplicates && duplicates.length > 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Total Rows</CardDescription>
              <CardTitle className="text-2xl">{summary.totalRows}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Valid Rows</CardDescription>
              <CardTitle className="text-2xl text-green-600">{summary.validRows}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Duplicates</CardDescription>
              <CardTitle className="text-2xl text-orange-600">{summary.duplicateRows}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Errors</CardDescription>
              <CardTitle className="text-2xl text-red-600">{summary.errorRows}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Will Import</CardDescription>
              <CardTitle className="text-2xl text-blue-600">{data.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors && validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong className="block mb-2">Found {validationErrors.length} validation error(s):</strong>
            <ul className="list-disc list-inside space-y-1 text-sm max-h-40 overflow-y-auto">
              {validationErrors.slice(0, 5).map((error, index) => (
                <li key={index}>
                  <strong>{error.itemName} ({error.brand}):</strong> {error.errors.join(', ')}
                </li>
              ))}
              {validationErrors.length > 5 && (
                <li className="text-muted-foreground">
                  ... and {validationErrors.length - 5} more errors
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Duplicate Warnings */}
      {duplicates && duplicates.length > 0 && (
        <Alert variant="default" className="border-orange-500/50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription>
            <strong className="block mb-2">Found {duplicates.length} duplicate(s):</strong>
            <ul className="list-disc list-inside space-y-1 text-sm max-h-40 overflow-y-auto">
              {duplicates.slice(0, 5).map((dup, index) => (
                <li key={index}>
                  <strong>{dup.itemName} ({dup.brand}):</strong> {dup.message}
                </li>
              ))}
              {duplicates.length > 5 && (
                <li className="text-muted-foreground">
                  ... and {duplicates.length - 5} more duplicates
                </li>
              )}
            </ul>
            <p className="text-xs mt-2 text-muted-foreground">
              Enable "Skip Duplicates" option to import only new parts.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Success Message */}
      {!hasErrors && data.length > 0 && (
        <Alert className="border-green-500/50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <strong>Validation successful!</strong> {data.length} part(s) are ready to be imported.
          </AlertDescription>
        </Alert>
      )}

      {/* Preview Table */}
      {data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview of Parts to Import</CardTitle>
            <CardDescription>
              Showing {startIndex + 1} to {Math.min(endIndex, data.length)} of {data.length} part(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Manufacturer</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentData.map((part, index) => {
                    const version = part.versions && part.versions.length > 0 ? part.versions[0] : {};
                    const rowNumber = startIndex + index + 1;

                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{rowNumber}</TableCell>
                        <TableCell className="font-medium">{part.itemName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {part.category?.charAt(0).toUpperCase() + part.category?.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>{part.brand}</TableCell>
                        <TableCell>{part.manufacturer}</TableCell>
                        <TableCell className="text-right">{version.quantity || 0}</TableCell>
                        <TableCell className="text-right">
                          ${(version.unitCost || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ${(version.sellingPrice || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Ready
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No Data Message */}
      {data.length === 0 && !hasErrors && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No valid parts found to import. Please check your CSV file and column mappings.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
