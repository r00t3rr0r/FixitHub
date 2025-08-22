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
export const getDiagnosticTests = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        tests: [
          {
            _id: 'test1',
            name: 'iPhone Display Test',
            description: 'Comprehensive display functionality test for iPhone devices',
            deviceTypes: ['iPhone'],
            category: 'hardware',
            estimatedTime: 15,
            tools: ['Display Tester', 'Color Calibrator'],
            steps: [
              {
                _id: 'step1',
                order: 1,
                instruction: 'Power on device and check for display output',
                expectedResult: 'Display shows Apple logo and boots normally',
                tools: ['Power Button'],
                warningNotes: 'If no display, check connections before proceeding'
              },
              {
                _id: 'step2',
                order: 2,
                instruction: 'Test touch sensitivity across entire screen',
                expectedResult: 'All areas respond to touch accurately',
                tools: ['Touch Test App']
              }
            ],
            passFailCriteria: [
              'Display powers on correctly',
              'Touch response is accurate',
              'No dead pixels or discoloration'
            ],
            troubleshootingGuide: [
              {
                _id: 'trouble1',
                issue: 'No Display Output',
                symptoms: ['Black screen', 'No backlight'],
                solutions: ['Check display cable connections', 'Test with known good display'],
                escalationRequired: true
              }
            ]
          }
        ]
      });
    }, 500);
  });
};

// Description: Get diagnostic forms
// Endpoint: GET /api/admin/diagnostics/forms
// Request: { deviceType?: string }
// Response: { forms: DiagnosticForm[] }
export const getDiagnosticForms = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        forms: [
          {
            _id: 'form1',
            name: 'Device Intake Assessment',
            description: 'Initial device condition and customer complaint form',
            deviceTypes: ['iPhone', 'Samsung', 'Google Pixel'],
            isActive: true,
            fields: [
              {
                _id: 'field1',
                name: 'customerComplaint',
                label: 'Customer Complaint',
                type: 'textarea',
                required: true
              },
              {
                _id: 'field2',
                name: 'deviceCondition',
                label: 'Overall Device Condition',
                type: 'select',
                required: true,
                options: ['Excellent', 'Good', 'Fair', 'Poor']
              }
            ]
          }
        ]
      });
    }, 500);
  });
};

// Description: Submit diagnostic result
// Endpoint: POST /api/admin/diagnostics/results
// Request: DiagnosticResult
// Response: { success: boolean, result: DiagnosticResult }
export const submitDiagnosticResult = (resultData: Partial<DiagnosticResult>) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        result: {
          _id: 'result_' + Date.now(),
          ...resultData,
          performedAt: new Date().toISOString()
        }
      });
    }, 800);
  });
};