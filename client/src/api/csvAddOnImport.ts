import api from './api';

export interface ValidationResult {
  success: boolean;
  needsMapping?: boolean;
  columns?: string[];
  previewData?: any[];
  totalRows?: number;
  validatedData?: ValidatedRow[];
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
  imported: ImportedAddOn[];
  skipped: SkippedAddOn[];
  failed: FailedAddOn[];
  stats: {
    totalProcessed: number;
    importedCount: number;
    skippedCount: number;
    failedCount: number;
  };
}

export interface ImportedAddOn {
  rowIndex: number;
  serviceName: string;
  action: 'created' | 'updated';
  id: string;
}

export interface SkippedAddOn {
  rowIndex: number;
  serviceName: string;
  reason: string;
}

export interface FailedAddOn {
  rowIndex: number;
  serviceName: string;
  error: string;
}

// Description: Validate CSV file for add-on service import
// Endpoint: POST /api/csv-addon-import/validate
// Request: FormData with 'file' and optional 'columnMapping' (JSON string)
// Response: ValidationResult
export const validateCSVAddOnImport = async (
  file: File,
  columnMapping?: Record<string, string>
): Promise<ValidationResult> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (columnMapping) {
      formData.append('columnMapping', JSON.stringify(columnMapping));
    }

    const response = await api.post('/api/csv-addon-import/validate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error: any) {
    console.error('Error validating CSV add-on import:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Import add-on services from validated CSV data
// Endpoint: POST /api/csv-addon-import/import
// Request: { validatedData: ValidatedRow[], options: { skipDuplicates?: boolean, updateExisting?: boolean } }
// Response: ImportResult
export const importAddOnsFromCSV = async (
  validatedData: ValidatedRow[],
  options?: {
    skipDuplicates?: boolean;
    updateExisting?: boolean;
  }
): Promise<ImportResult> => {
  try {
    const response = await api.post('/api/csv-addon-import/import', {
      validatedData,
      options,
    });
    return response.data;
  } catch (error: any) {
    console.error('Error importing add-ons from CSV:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
