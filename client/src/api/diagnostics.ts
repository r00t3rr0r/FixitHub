import api from './api';

export interface DiagnosticTest {
  _id: string;
  name: string;
  description: string;
  deviceTypes: string[];
  category: 'hardware' | 'software' | 'performance' | 'connectivity';
  estimatedTime: number;
  tools: string[];
  steps: DiagnosticStep[];
  passFailCriteria: string[];
  troubleshootingGuide: TroubleshootingStep[];
}

export interface DiagnosticStep {
  _id: string;
  order: number;
  instruction: string;
  expectedResult: string;
  tools: string[];
  warningNotes?: string;
}

export interface TroubleshootingStep {
  _id: string;
  issue: string;
  symptoms: string[];
  solutions: string[];
  escalationRequired: boolean;
}

export interface DiagnosticResult {
  _id: string;
  orderId: string;
  testId: string;
  testName: string;
  performedBy: string;
  performedAt: string;
  results: TestResult[];
  overallStatus: 'pass' | 'fail' | 'warning';
  notes: string;
  recommendedActions: string[];
  photos: string[];
}

export interface TestResult {
  stepId: string;
  stepName: string;
  status: 'pass' | 'fail' | 'warning' | 'skipped';
  actualResult: string;
  notes?: string;
}

export interface DiagnosticForm {
  _id: string;
  name: string;
  description: string;
  deviceTypes: string[];
  fields: FormField[];
  isActive: boolean;
}

export interface FormField {
  _id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'textarea' | 'file';
  required: boolean;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

// Description: Get all diagnostic tests
// Endpoint: GET /api/admin/diagnostics/tests
// Request: { deviceType?: string, category?: string }
// Response: { tests: DiagnosticTest[] }
export const getDiagnosticTests = async (filters: any = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.deviceType) params.append('deviceType', filters.deviceType);
    if (filters.category) params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);

    const response = await api.get(`/api/admin/diagnostics/tests?${params.toString()}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get diagnostic forms
// Endpoint: GET /api/admin/diagnostics/forms
// Request: { deviceType?: string }
// Response: { forms: DiagnosticForm[] }
export const getDiagnosticForms = async (filters: any = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.deviceType) params.append('deviceType', filters.deviceType);
    if (filters.search) params.append('search', filters.search);

    const response = await api.get(`/api/admin/diagnostics/forms?${params.toString()}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Submit diagnostic result
// Endpoint: POST /api/admin/diagnostics/results
// Request: DiagnosticResult
// Response: { success: boolean, result: DiagnosticResult }
export const submitDiagnosticResult = async (resultData: Partial<DiagnosticResult>) => {
  try {
    const response = await api.post('/api/admin/diagnostics/results', resultData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create diagnostic test
// Endpoint: POST /api/admin/diagnostics/tests
// Request: Partial<DiagnosticTest>
// Response: { success: boolean, test: DiagnosticTest }
export const createDiagnosticTest = async (testData: Partial<DiagnosticTest>) => {
  try {
    const response = await api.post('/api/admin/diagnostics/tests', testData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update diagnostic test
// Endpoint: PUT /api/admin/diagnostics/tests/:testId
// Request: Partial<DiagnosticTest>
// Response: { success: boolean, test: DiagnosticTest }
export const updateDiagnosticTest = async (testId: string, testData: Partial<DiagnosticTest>) => {
  try {
    const response = await api.put(`/api/admin/diagnostics/tests/${testId}`, testData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete diagnostic test
// Endpoint: DELETE /api/admin/diagnostics/tests/:testId
// Request: {}
// Response: { success: boolean, message: string }
export const deleteDiagnosticTest = async (testId: string) => {
  try {
    const response = await api.delete(`/api/admin/diagnostics/tests/${testId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create diagnostic form
// Endpoint: POST /api/admin/diagnostics/forms
// Request: Partial<DiagnosticForm>
// Response: { success: boolean, form: DiagnosticForm }
export const createDiagnosticForm = async (formData: Partial<DiagnosticForm>) => {
  try {
    const response = await api.post('/api/admin/diagnostics/forms', formData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update diagnostic form
// Endpoint: PUT /api/admin/diagnostics/forms/:formId
// Request: Partial<DiagnosticForm>
// Response: { success: boolean, form: DiagnosticForm }
export const updateDiagnosticForm = async (formId: string, formData: Partial<DiagnosticForm>) => {
  try {
    const response = await api.put(`/api/admin/diagnostics/forms/${formId}`, formData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete diagnostic form
// Endpoint: DELETE /api/admin/diagnostics/forms/:formId
// Request: {}
// Response: { success: boolean, message: string }
export const deleteDiagnosticForm = async (formId: string) => {
  try {
    const response = await api.delete(`/api/admin/diagnostics/forms/${formId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get diagnostic statistics
// Endpoint: GET /api/admin/diagnostics/stats
// Request: {}
// Response: { stats: { totalTests: number, totalForms: number, totalResults: number, averageTestTime: number } }
export const getDiagnosticStats = async () => {
  try {
    const response = await api.get('/api/admin/diagnostics/stats');
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};