import api from './api';

export interface PartCSVData {
  itemName: string;
  itemDescription?: string;
  category: string;
  manufacturer: string;
  brand: string;
  compatibleDevices?: string;
  versionType?: string;
  quantity?: number | string;
  minStockLevel?: number | string;
  unitCost?: number | string;
  sellingPrice?: number | string;
  storageLocation?: string;
  notes?: string;
  supplierName?: string;
  supplierEmail?: string;
  supplierPhone?: string;
}

export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  skippedRows: number;
  errorRows: number;
}

export interface DuplicateInfo {
  itemName: string;
  brand: string;
  type: 'duplicate_in_csv' | 'duplicate_in_database';
  message: string;
}

export interface ValidationError {
  itemName: string;
  brand: string;
  errors: string[];
}

export interface ValidationResult {
  success: boolean;
  data?: any[];
  summary?: ValidationSummary;
  duplicates?: DuplicateInfo[];
  validationErrors?: ValidationError[];
  message?: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  results: {
    successful: Array<{ itemName: string; brand: string; sku: string }>;
    failed: Array<{ itemName: string; brand: string; error: string }>;
  };
}

// Description: Validate CSV parts data and preview import results
// Endpoint: POST /api/csv-parts-import/validate
// Request: { csvData: Array<Record<string, string>>, columnMapping: Record<string, string>, options?: { skipDuplicates?: boolean, updateExisting?: boolean } }
// Response: { success: boolean, data: Array, summary: { totalRows: number, validRows: number, duplicateRows: number, skippedRows: number, errorRows: number }, duplicates?: Array, validationErrors?: Array }
export const validatePartsCSVImport = async (
  csvData: any[],
  columnMapping: Record<string, string>,
  options?: { skipDuplicates?: boolean; updateExisting?: boolean }
): Promise<ValidationResult> => {
  try {
    console.log('API: Validating parts CSV import with', csvData.length, 'rows');
    const response = await api.post('/api/csv-parts-import/validate', {
      csvData,
      columnMapping,
      options
    });
    console.log('API: Validation result:', response.data);
    return response.data;
  } catch (error) {
    console.error('API: Error validating parts CSV import:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Import validated parts into the database
// Endpoint: POST /api/csv-parts-import/import
// Request: { parts: Array }
// Response: { success: boolean, imported: number, failed: number, results: { successful: Array, failed: Array } }
export const importPartsFromCSV = async (parts: any[]): Promise<ImportResult> => {
  try {
    console.log('API: Importing', parts.length, 'parts from CSV');
    const response = await api.post('/api/csv-parts-import/import', {
      parts
    });
    console.log('API: Import complete:', response.data);
    return response.data;
  } catch (error) {
    console.error('API: Error importing parts from CSV:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
