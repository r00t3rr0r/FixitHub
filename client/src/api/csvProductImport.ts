import api from './api';

export interface ValidationResult {
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
    existingId?: string;
  }>;
  totalRows: number;
  validRows: number;
}

export interface ImportResult {
  successful: Array<{
    row: number;
    productId: string;
    name: string;
    sku: string;
  }>;
  failed: Array<{
    row: number;
    name: string;
    error: string;
  }>;
  updated: Array<{
    row: number;
    productId: string;
    name: string;
    sku: string;
  }>;
  skipped: Array<{
    row: number;
    name: string;
    sku: string;
    reason: string;
  }>;
}

export interface CSVHeaders {
  headers: string[];
  sampleData: any[];
  totalRows: number;
}

// Description: Upload CSV file and get headers for column mapping
// Endpoint: POST /api/csv-product-import/validate
// Request: FormData with file
// Response: { headers: string[], sampleData: any[], totalRows: number }
export const uploadCSVForMapping = async (file: File): Promise<CSVHeaders> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/api/csv-product-import/validate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error: any) {
    console.error('Error uploading CSV:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Validate CSV file with column mapping
// Endpoint: POST /api/csv-product-import/validate
// Request: FormData with file and columnMapping
// Response: ValidationResult
export const validateCSVProductImport = async (
  file: File,
  columnMapping: Record<string, string>
): Promise<ValidationResult> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('columnMapping', JSON.stringify(columnMapping));

    const response = await api.post('/api/csv-product-import/validate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error: any) {
    console.error('Error validating CSV:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Import validated products from CSV
// Endpoint: POST /api/csv-product-import/import
// Request: { validatedProducts: Array, options: { updateExisting: boolean, skipDuplicates: boolean } }
// Response: ImportResult
export const importProductsFromCSV = async (
  validatedProducts: Array<{ rowIndex: number; data: any; warnings: string[] }>,
  options: { updateExisting: boolean; skipDuplicates: boolean }
): Promise<ImportResult> => {
  try {
    const response = await api.post('/api/csv-product-import/import', {
      validatedProducts,
      options,
    });

    return response.data;
  } catch (error: any) {
    console.error('Error importing products:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
