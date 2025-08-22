import api from './api';

export interface WorkflowStep {
  _id: string;
  name: string;
  description: string;
  estimatedTime: number;
  isRequired: boolean;
  order: number;
  category: 'diagnostic' | 'repair' | 'quality' | 'addon' | 'completion';
  dependencies: string[];
  tools: string[];
  skills: string[];
  checklistItems: string[];
}

export interface WorkflowTemplate {
  _id: string;
  name: string;
  description: string;
  deviceTypes: string[];
  serviceTypes: string[];
  steps: WorkflowStep[];
  estimatedTotalTime: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddOnWorkflow {
  _id: string;
  addOnServiceId: string;
  addOnServiceName: string;
  optimalTiming: 'before_repair' | 'during_repair' | 'after_repair' | 'flexible';
  dependencies: string[];
  estimatedTime: number;
  instructions: string;
  qualityChecks: string[];
}

// Description: Get all workflow templates
// Endpoint: GET /api/admin/workflows
// Request: { deviceType?: string, serviceType?: string }
// Response: { workflows: WorkflowTemplate[] }
export const getWorkflowTemplates = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        workflows: [
          {
            _id: 'workflow1',
            name: 'iPhone Screen Replacement',
            description: 'Complete workflow for iPhone screen replacement with quality checks',
            deviceTypes: ['iPhone'],
            serviceTypes: ['Screen Replacement'],
            steps: [
              {
                _id: 'step1',
                name: 'Initial Diagnostic',
                description: 'Assess device condition and confirm repair requirements',
                estimatedTime: 15,
                isRequired: true,
                order: 1,
                category: 'diagnostic',
                dependencies: [],
                tools: ['Multimeter', 'Diagnostic Software'],
                skills: ['Hardware Diagnosis'],
                checklistItems: [
                  'Check device powers on',
                  'Test touch functionality',
                  'Inspect for water damage',
                  'Document existing damage'
                ]
              },
              {
                _id: 'step2',
                name: 'Disassembly',
                description: 'Carefully disassemble device to access screen',
                estimatedTime: 20,
                isRequired: true,
                order: 2,
                category: 'repair',
                dependencies: ['step1'],
                tools: ['Pentalobe Screwdriver', 'Suction Cup', 'Spudger'],
                skills: ['Device Disassembly'],
                checklistItems: [
                  'Remove pentalobe screws',
                  'Lift screen carefully',
                  'Disconnect display cables',
                  'Remove old screen assembly'
                ]
              },
              {
                _id: 'step3',
                name: 'Screen Installation',
                description: 'Install new screen and reconnect components',
                estimatedTime: 25,
                isRequired: true,
                order: 3,
                category: 'repair',
                dependencies: ['step2'],
                tools: ['New Screen Assembly', 'Adhesive Strips'],
                skills: ['Component Installation'],
                checklistItems: [
                  'Install new screen assembly',
                  'Connect display cables',
                  'Apply adhesive strips',
                  'Secure with screws'
                ]
              },
              {
                _id: 'step4',
                name: 'Quality Testing',
                description: 'Test all functionality before completion',
                estimatedTime: 10,
                isRequired: true,
                order: 4,
                category: 'quality',
                dependencies: ['step3'],
                tools: ['Testing Software'],
                skills: ['Quality Testing'],
                checklistItems: [
                  'Test touch response',
                  'Check display quality',
                  'Verify all buttons work',
                  'Test cameras and sensors'
                ]
              }
            ],
            estimatedTotalTime: 70,
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-15T10:30:00Z'
          },
          {
            _id: 'workflow2',
            name: 'Samsung Battery Replacement',
            description: 'Standard workflow for Samsung device battery replacement',
            deviceTypes: ['Samsung'],
            serviceTypes: ['Battery Replacement'],
            steps: [
              {
                _id: 'step5',
                name: 'Battery Diagnostic',
                description: 'Test current battery health and performance',
                estimatedTime: 10,
                isRequired: true,
                order: 1,
                category: 'diagnostic',
                dependencies: [],
                tools: ['Battery Tester', 'Diagnostic App'],
                skills: ['Battery Testing'],
                checklistItems: [
                  'Check battery health percentage',
                  'Test charging speed',
                  'Monitor temperature',
                  'Document current capacity'
                ]
              },
              {
                _id: 'step6',
                name: 'Device Opening',
                description: 'Open Samsung device to access battery',
                estimatedTime: 15,
                isRequired: true,
                order: 2,
                category: 'repair',
                dependencies: ['step5'],
                tools: ['Heat Gun', 'Plastic Tools', 'Suction Cup'],
                skills: ['Samsung Disassembly'],
                checklistItems: [
                  'Heat back panel',
                  'Remove back cover',
                  'Disconnect battery connector',
                  'Remove adhesive strips'
                ]
              }
            ],
            estimatedTotalTime: 45,
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-10T14:20:00Z'
          }
        ]
      });
    }, 500);
  });
};

// Description: Get add-on service workflows
// Endpoint: GET /api/admin/workflows/addons
// Request: {}
// Response: { addOnWorkflows: AddOnWorkflow[] }
export const getAddOnWorkflows = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        addOnWorkflows: [
          {
            _id: 'addon_workflow1',
            addOnServiceId: 'addon1',
            addOnServiceName: 'Screen Protector Installation',
            optimalTiming: 'after_repair',
            dependencies: ['Screen Replacement'],
            estimatedTime: 5,
            instructions: 'Clean screen thoroughly, align protector, apply with squeegee',
            qualityChecks: [
              'No air bubbles',
              'Perfect alignment',
              'Touch sensitivity maintained'
            ]
          },
          {
            _id: 'addon_workflow2',
            addOnServiceId: 'addon2',
            addOnServiceName: 'Data Backup',
            optimalTiming: 'before_repair',
            dependencies: [],
            estimatedTime: 30,
            instructions: 'Connect to backup system, verify data integrity, create restore point',
            qualityChecks: [
              'All data backed up',
              'Backup verified',
              'Customer notified'
            ]
          },
          {
            _id: 'addon_workflow3',
            addOnServiceId: 'addon3',
            addOnServiceName: 'Device Cleaning',
            optimalTiming: 'flexible',
            dependencies: [],
            estimatedTime: 10,
            instructions: 'Use appropriate cleaning solutions, clean all surfaces, sanitize',
            qualityChecks: [
              'All surfaces clean',
              'No cleaning residue',
              'Ports clear'
            ]
          }
        ]
      });
    }, 500);
  });
};

// Description: Create new workflow template
// Endpoint: POST /api/admin/workflows
// Request: WorkflowTemplate
// Response: { success: boolean, workflow: WorkflowTemplate }
export const createWorkflowTemplate = (workflowData: Partial<WorkflowTemplate>) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        workflow: {
          _id: 'workflow_' + Date.now(),
          ...workflowData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });
    }, 1000);
  });
};

// Description: Update workflow template
// Endpoint: PUT /api/admin/workflows/:id
// Request: Partial<WorkflowTemplate>
// Response: { success: boolean, workflow: WorkflowTemplate }
export const updateWorkflowTemplate = (workflowId: string, updates: Partial<WorkflowTemplate>) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        workflow: {
          _id: workflowId,
          ...updates,
          updatedAt: new Date().toISOString()
        }
      });
    }, 800);
  });
};