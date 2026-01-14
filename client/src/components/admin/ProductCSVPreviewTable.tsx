import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

interface ProductCSVPreviewTableProps {
  validationResult: {
    valid: boolean;
    validatedProducts: Array<{
      rowIndex: number;
      data: any;
      warnings: string[];
    }>;
    errors: string[];
    warnings: string[];
    duplicates: Array<{
      row: number;
      field: string;
      value: string;
      message: string;
    }>;
    totalRows: number;
    validRows: number;
  };
}

const ProductCSVPreviewTable: React.FC<ProductCSVPreviewTableProps> = ({ validationResult }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { validatedProducts, errors, warnings, duplicates, totalRows, validRows } = validationResult;

  // Pagination
  const totalPages = Math.ceil(validatedProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = validatedProducts.slice(startIndex, endIndex);

  const getRowStatus = (product: any) => {
    const hasDuplicate = duplicates.some(d => d.row === product.rowIndex);
    const hasWarnings = product.warnings && product.warnings.length > 0;

    if (hasDuplicate) return 'duplicate';
    if (hasWarnings) return 'warning';
    return 'valid';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Valid</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500"><AlertTriangle className="w-3 h-3 mr-1" /> Warning</Badge>;
      case 'duplicate':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Duplicate</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Rows</CardDescription>
            <CardTitle className="text-2xl">{totalRows}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Valid Products</CardDescription>
            <CardTitle className="text-2xl text-green-600">{validRows}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Errors</CardDescription>
            <CardTitle className="text-2xl text-red-600">{errors.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Warnings</CardDescription>
            <CardTitle className="text-2xl text-yellow-600">{warnings.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Validation Errors ({errors.length})</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {errors.slice(0, 10).map((error, index) => (
                <li key={index} className="text-sm">{error}</li>
              ))}
              {errors.length > 10 && (
                <li className="text-sm font-semibold">... and {errors.length - 10} more errors</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Duplicate Warnings */}
      {duplicates.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Duplicate Products Found ({duplicates.length})</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {duplicates.slice(0, 5).map((dup, index) => (
                <li key={index} className="text-sm">{dup.message}</li>
              ))}
              {duplicates.length > 5 && (
                <li className="text-sm font-semibold">... and {duplicates.length - 5} more duplicates</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Preview Table */}
      <Card>
        <CardHeader>
          <CardTitle>Data Preview</CardTitle>
          <CardDescription>
            Showing {startIndex + 1}-{Math.min(endIndex, validatedProducts.length)} of {validatedProducts.length} products
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Row</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>SKU</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentProducts.map((product) => {
                  const status = getRowStatus(product);
                  const rowDuplicates = duplicates.filter(d => d.row === product.rowIndex);

                  return (
                    <TableRow key={product.rowIndex}>
                      <TableCell className="font-medium">{product.rowIndex}</TableCell>
                      <TableCell>{getStatusBadge(status)}</TableCell>
                      <TableCell>
                        {product.data.name}
                        {product.warnings.length > 0 && (
                          <div className="text-xs text-yellow-600 mt-1">
                            {product.warnings[0]}
                          </div>
                        )}
                        {rowDuplicates.length > 0 && (
                          <div className="text-xs text-red-600 mt-1">
                            {rowDuplicates[0].message}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{product.data.category}</TableCell>
                      <TableCell>${product.data.price}</TableCell>
                      <TableCell>{product.data.stockQuantity || 0}</TableCell>
                      <TableCell className="font-mono text-sm">{product.data.sku || '-'}</TableCell>
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
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductCSVPreviewTable;
