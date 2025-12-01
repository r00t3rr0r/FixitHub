import api from './api';

// Description: Validate CSV data and preview import results
// Endpoint: POST /api/csv-import/validate
// Request: { csvData: Array<Record<string, string>>, columnMapping: Record<string, string>, options?: { skipDuplicates?: boolean } }
// Response: { success: boolean, data: Array<{ email: string, name: string, phone?: string, role?: string, isActive?: boolean, customerNumber?: string, customerGroup?: string, salutation?: string, title?: string, company?: string, country?: string, addressAddition?: string, customerOrigin?: string, postId?: string, paymentMethod?: string, paymentTerms?: string, internalKey?: string, discount?: number, status?: string, newsletter?: boolean, comment?: string }>, summary: { totalRows: number, validRows: number, duplicateRows: number, skippedRows: number }, duplicates?: Array, validationErrors?: Array }
export const validateCSVImport = async (csvData: any[], columnMapping: Record<string, string>, options?: { skipDuplicates?: boolean }) => {
  try {
    const response = await api.post('/api/csv-import/validate', {
      csvData,
      columnMapping,
      options
    });
    return response.data;
  } catch (error) {
    console.error('Error validating CSV import:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Import validated users into the database
// Endpoint: POST /api/csv-import/import
// Request: { users: Array<{ email: string, name: string, phone?: string, role?: string, isActive?: boolean, password: string, customerNumber?: string, customerGroup?: string, salutation?: string, title?: string, company?: string, country?: string, addressAddition?: string, customerOrigin?: string, postId?: string, paymentMethod?: string, paymentTerms?: string, internalKey?: string, discount?: number, status?: string, newsletter?: boolean, comment?: string }> }
// Response: { success: boolean, imported: number, failed: number, results: { successful: Array<{ email: string, message: string }>, failed: Array<{ email: string, error: string }> } }
export const importUsersFromCSV = async (users: any[]) => {
  try {
    const response = await api.post('/api/csv-import/import', {
      users
    });
    return response.data;
  } catch (error) {
    console.error('Error importing users from CSV:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
