import api from './api';

export interface ErrorRow {
  rowIndex: number;
  data: Record<string, any>;
  errors: string[];
}

export interface ValidationResult {
  success: boolean;
  needsMapping?: boolean;
  columns?: string[];
  previewData?: any[];
  totalRows?: number;
  validatedData?: ValidatedRow[];
  errorRows?: ErrorRow[];
  errors?: string[];
  warnings?: string[];
  duplicateCheck?: DuplicateCheck;
  stats?: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    duplicateRows: number;
  };
}

export interface ValidatedRow {
  rowIndex: number;
  data: any;
}

export interface DuplicateCheck {
  hasDuplicates: boolean;
  duplicates: Duplicate[];
  duplicateCount: number;
}

export interface Duplicate {
  rowIndex: number;
  serviceName: string;
  category: string;
  existingId: string;
}

export interface ImportResult {
  success: boolean;
  imported: ImportedService[];
  skipped: SkippedService[];
  failed: FailedService[];
  stats: {
    totalProcessed: number;
    importedCount: number;
    skippedCount: number;
    failedCount: number;
  };
}

export interface ImportedService {
  rowIndex: number;
  serviceName: string;
  action: 'created' | 'updated';
  id: string;
}

export interface SkippedService {
  rowIndex: number;
  serviceName: string;
  reason: string;
}

export interface FailedService {
  rowIndex: number;
  serviceName: string;
  error: string;
}

// Description: Validate CSV file for service import
// Endpoint: POST /api/csv-service-import/validate
// Request: FormData with 'file' and optional 'columnMapping' (JSON string)
// Response: ValidationResult
export const validateCSVServiceImport = async (
  file: File,
  columnMapping?: Record<string, string>
): Promise<ValidationResult> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (columnMapping) {
      formData.append('columnMapping', JSON.stringify(columnMapping));
    }

    const response = await api.post('/api/csv-service-import/validate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error: any) {
    console.error('Error validating CSV service import:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Import services from validated CSV data
// Endpoint: POST /api/csv-service-import/import
// Request: { validatedData: ValidatedRow[], options: { skipDuplicates?: boolean, updateExisting?: boolean } }
// Response: ImportResult
export const importServicesFromCSV = async (
  validatedData: ValidatedRow[],
  options?: {
    skipDuplicates?: boolean;
    updateExisting?: boolean;
  }
): Promise<ImportResult> => {
  try {
    const response = await api.post('/api/csv-service-import/import', {
      validatedData,
      options,
    });
    return response.data;
  } catch (error: any) {
    console.error('Error importing services from CSV:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
