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
// Endpoint: GET /api/workflows/templates
// Request: { deviceType?: string, serviceType?: string }
// Response: { success: boolean, workflows: WorkflowTemplate[] }
export const getWorkflowTemplates = async (filters: any = {}) => {
  try {
    console.log("Fetching workflow templates with filters:", filters);
    const params = new URLSearchParams();
    if (filters.deviceType) params.append('deviceType', filters.deviceType);
    if (filters.serviceType) params.append('serviceType', filters.serviceType);
    if (filters.isActive !== undefined) params.append('isActive', filters.isActive.toString());

    const response = await api.get(`/api/workflows/templates?${params.toString()}`);
    console.log("Successfully fetched workflow templates:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error fetching workflow templates:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get add-on service workflows
// Endpoint: GET /api/workflows/addons
// Request: {}
// Response: { success: boolean, addOnWorkflows: AddOnWorkflow[] }
export const getAddOnWorkflows = async () => {
  try {
    console.log("Fetching add-on workflows");
    const response = await api.get('/api/workflows/addons');
    console.log("Successfully fetched add-on workflows:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error fetching add-on workflows:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create new workflow template
// Endpoint: POST /api/workflows/templates
// Request: WorkflowTemplate
// Response: { success: boolean, workflow: WorkflowTemplate }
export const createWorkflowTemplate = async (workflowData: Partial<WorkflowTemplate>) => {
  try {
    console.log("Creating workflow template:", workflowData);
    const response = await api.post('/api/workflows/templates', workflowData);
    console.log("Successfully created workflow template:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error creating workflow template:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update workflow template
// Endpoint: PUT /api/workflows/templates/:id
// Request: Partial<WorkflowTemplate>
// Response: { success: boolean, workflow: WorkflowTemplate }
export const updateWorkflowTemplate = async (workflowId: string, updates: Partial<WorkflowTemplate>) => {
  try {
    console.log("Updating workflow template:", workflowId, updates);
    const response = await api.put(`/api/workflows/templates/${workflowId}`, updates);
    console.log("Successfully updated workflow template:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error updating workflow template:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete workflow template
// Endpoint: DELETE /api/workflows/templates/:id
// Request: {}
// Response: { success: boolean, message: string }
export const deleteWorkflowTemplate = async (workflowId: string) => {
  try {
    console.log("Deleting workflow template:", workflowId);
    const response = await api.delete(`/api/workflows/templates/${workflowId}`);
    console.log("Successfully deleted workflow template:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error deleting workflow template:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get single workflow template by ID
// Endpoint: GET /api/workflows/templates/:id
// Request: {}
// Response: { success: boolean, workflow: WorkflowTemplate }
export const getWorkflowTemplateById = async (workflowId: string) => {
  try {
    console.log("Fetching workflow template by ID:", workflowId);
    const response = await api.get(`/api/workflows/templates/${workflowId}`);
    console.log("Successfully fetched workflow template:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error fetching workflow template by ID:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create new add-on workflow
// Endpoint: POST /api/workflows/addons
// Request: Partial<AddOnWorkflow>
// Response: { success: boolean, addOnWorkflow: AddOnWorkflow }
export const createAddOnWorkflow = async (workflowData: Partial<AddOnWorkflow>) => {
  try {
    console.log("Creating add-on workflow:", workflowData);
    const response = await api.post('/api/workflows/addons', workflowData);
    console.log("Successfully created add-on workflow:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error creating add-on workflow:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update add-on workflow
// Endpoint: PUT /api/workflows/addons/:id
// Request: Partial<AddOnWorkflow>
// Response: { success: boolean, addOnWorkflow: AddOnWorkflow }
export const updateAddOnWorkflow = async (workflowId: string, updates: Partial<AddOnWorkflow>) => {
  try {
    console.log("Updating add-on workflow:", workflowId, updates);
    const response = await api.put(`/api/workflows/addons/${workflowId}`, updates);
    console.log("Successfully updated add-on workflow:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error updating add-on workflow:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get workflow statistics
// Endpoint: GET /api/workflows/stats
// Request: {}
// Response: { success: boolean, stats: object }
export const getWorkflowStats = async () => {
  try {
    console.log("Fetching workflow statistics");
    const response = await api.get('/api/workflows/stats');
    console.log("Successfully fetched workflow statistics:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error fetching workflow statistics:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};