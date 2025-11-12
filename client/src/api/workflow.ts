import api from './api';

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'checkbox' | 'radio' | 'select' | 'multiselect' | 'file' | 'date' | 'time';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
  defaultValue?: any;
  order: number;
  isConditional: boolean;
  conditionalLogic?: {
    dependsOn: string;
    condition: string;
    value: any;
  };
}

export interface AutomationRule {
  _id?: string;
  trigger: 'step_completion' | 'time_delay' | 'condition_met' | 'manual' | 'form_submission';
  condition?: string;
  action: 'send_notification' | 'update_status' | 'assign_staff' | 'create_task' | 'move_to_next_step';
  actionData?: any;
  isActive: boolean;
}

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
  formFields: FormField[];
  requiresFormCompletion: boolean;
  automationRules: AutomationRule[];
  position: {
    x: number;
    y: number;
  };
  canSkip: boolean;
  requiresApproval: boolean;
  notificationSettings: {
    onStart: boolean;
    onComplete: boolean;
    onDelay: boolean;
  };
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
  globalAutomationRules: AutomationRule[];
  workflowSettings: {
    allowParallelSteps: boolean;
    requireStrictOrder: boolean;
    autoProgressOnCompletion: boolean;
  };
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
  automationRules: AutomationRule[];
}

// Description: Get all workflow templates
// Endpoint: GET /api/workflows/templates
// Request: { deviceType?: string, serviceType?: string }
// Response: { success: boolean, workflows: WorkflowTemplate[] }
export const getWorkflowTemplates = async (filters: any = {}) => {
  try {
    console.log("WorkflowAPI: getWorkflowTemplates called with filters:", filters);
    const params = new URLSearchParams();
    if (filters.deviceType) params.append('deviceType', filters.deviceType);
    if (filters.serviceType) params.append('serviceType', filters.serviceType);
    if (filters.isActive !== undefined) params.append('isActive', filters.isActive.toString());

    const url = `/api/workflows/templates?${params.toString()}`;
    console.log("WorkflowAPI: Making request to:", url);
    
    const response = await api.get(url);
    console.log("WorkflowAPI: getWorkflowTemplates response received:", {
      success: response.data.success,
      workflowCount: response.data.workflows?.length || 0,
      workflows: response.data.workflows?.map(w => ({ id: w._id, name: w.name, stepsCount: w.steps?.length || 0 }))
    });
    return response.data;
  } catch (error: any) {
    console.error("WorkflowAPI: getWorkflowTemplates error:", error);
    console.error("WorkflowAPI: Error details:", {
      message: error.message,
      response: error?.response?.data,
      status: error?.response?.status
    });
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
    console.log("WorkflowAPI: createWorkflowTemplate called with data:", {
      name: workflowData.name,
      deviceTypesCount: workflowData.deviceTypes?.length || 0,
      serviceTypesCount: workflowData.serviceTypes?.length || 0,
      stepsCount: workflowData.steps?.length || 0,
      estimatedTotalTime: workflowData.estimatedTotalTime
    });
    
    const response = await api.post('/api/workflows/templates', workflowData);
    console.log("WorkflowAPI: createWorkflowTemplate response:", {
      success: response.data.success,
      workflowId: response.data.workflow?._id,
      workflowName: response.data.workflow?.name
    });
    return response.data;
  } catch (error: any) {
    console.error("WorkflowAPI: createWorkflowTemplate error:", error);
    console.error("WorkflowAPI: Error details:", {
      message: error.message,
      response: error?.response?.data,
      status: error?.response?.status
    });
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update workflow template
// Endpoint: PUT /api/workflows/templates/:id
// Request: Partial<WorkflowTemplate>
// Response: { success: boolean, workflow: WorkflowTemplate }
export const updateWorkflowTemplate = async (workflowId: string, updates: Partial<WorkflowTemplate>) => {
  try {
    console.log("WorkflowAPI: updateWorkflowTemplate called:", {
      workflowId,
      updateFields: Object.keys(updates),
      stepsCount: updates.steps?.length || 0,
      estimatedTotalTime: updates.estimatedTotalTime
    });
    
    const response = await api.put(`/api/workflows/templates/${workflowId}`, updates);
    console.log("WorkflowAPI: updateWorkflowTemplate response:", {
      success: response.data.success,
      workflowId: response.data.workflow?._id,
      workflowName: response.data.workflow?.name
    });
    return response.data;
  } catch (error: any) {
    console.error("WorkflowAPI: updateWorkflowTemplate error:", error);
    console.error("WorkflowAPI: Error details:", {
      message: error.message,
      response: error?.response?.data,
      status: error?.response?.status
    });
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

// Description: Reorder workflow steps
// Endpoint: PUT /api/workflows/templates/:id/reorder-steps
// Request: { stepOrderData: Array<{ stepId: string, newOrder: number, position?: { x: number, y: number } }> }
// Response: { success: boolean, workflow: WorkflowTemplate }
export const reorderWorkflowSteps = async (workflowId: string, stepOrderData: Array<{ stepId: string, newOrder: number, position?: { x: number, y: number } }>) => {
  try {
    console.log("Reordering workflow steps:", workflowId, stepOrderData);
    const response = await api.put(`/api/workflows/templates/${workflowId}/reorder-steps`, { stepOrderData });
    console.log("Successfully reordered workflow steps:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error reordering workflow steps:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Add form field to workflow step
// Endpoint: POST /api/workflows/templates/:id/steps/:stepId/form-fields
// Request: FormField
// Response: { success: boolean, workflow: WorkflowTemplate }
export const addFormFieldToStep = async (workflowId: string, stepId: string, formField: FormField) => {
  try {
    console.log("Adding form field to step:", stepId, formField);
    const response = await api.post(`/api/workflows/templates/${workflowId}/steps/${stepId}/form-fields`, formField);
    console.log("Successfully added form field:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error adding form field:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update form field in workflow step
// Endpoint: PUT /api/workflows/templates/:id/steps/:stepId/form-fields/:fieldId
// Request: Partial<FormField>
// Response: { success: boolean, workflow: WorkflowTemplate }
export const updateFormField = async (workflowId: string, stepId: string, fieldId: string, updates: Partial<FormField>) => {
  try {
    console.log("Updating form field:", fieldId, updates);
    const response = await api.put(`/api/workflows/templates/${workflowId}/steps/${stepId}/form-fields/${fieldId}`, updates);
    console.log("Successfully updated form field:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error updating form field:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Remove form field from workflow step
// Endpoint: DELETE /api/workflows/templates/:id/steps/:stepId/form-fields/:fieldId
// Request: {}
// Response: { success: boolean, workflow: WorkflowTemplate }
export const removeFormField = async (workflowId: string, stepId: string, fieldId: string) => {
  try {
    console.log("Removing form field:", fieldId);
    const response = await api.delete(`/api/workflows/templates/${workflowId}/steps/${stepId}/form-fields/${fieldId}`);
    console.log("Successfully removed form field:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error removing form field:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Add automation rule to workflow step
// Endpoint: POST /api/workflows/templates/:id/steps/:stepId/automation-rules
// Request: AutomationRule
// Response: { success: boolean, workflow: WorkflowTemplate }
export const addAutomationRule = async (workflowId: string, stepId: string, automationRule: AutomationRule) => {
  try {
    console.log("Adding automation rule to step:", stepId, automationRule);
    const response = await api.post(`/api/workflows/templates/${workflowId}/steps/${stepId}/automation-rules`, automationRule);
    console.log("Successfully added automation rule:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error adding automation rule:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update automation rule
// Endpoint: PUT /api/workflows/templates/:id/steps/:stepId/automation-rules/:ruleId
// Request: Partial<AutomationRule>
// Response: { success: boolean, workflow: WorkflowTemplate }
export const updateAutomationRule = async (workflowId: string, stepId: string, ruleId: string, updates: Partial<AutomationRule>) => {
  try {
    console.log("Updating automation rule:", ruleId, updates);
    const response = await api.put(`/api/workflows/templates/${workflowId}/steps/${stepId}/automation-rules/${ruleId}`, updates);
    console.log("Successfully updated automation rule:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error updating automation rule:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Remove automation rule
// Endpoint: DELETE /api/workflows/templates/:id/steps/:stepId/automation-rules/:ruleId
// Request: {}
// Response: { success: boolean, workflow: WorkflowTemplate }
export const removeAutomationRule = async (workflowId: string, stepId: string, ruleId: string) => {
  try {
    console.log("Removing automation rule:", ruleId);
    const response = await api.delete(`/api/workflows/templates/${workflowId}/steps/${stepId}/automation-rules/${ruleId}`);
    console.log("Successfully removed automation rule:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error removing automation rule:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Duplicate workflow template
// Endpoint: POST /api/workflows/templates/:id/duplicate
// Request: { newName?: string }
// Response: { success: boolean, workflow: WorkflowTemplate }
export const duplicateWorkflowTemplate = async (workflowId: string, newName?: string) => {
  try {
    console.log("Duplicating workflow template:", workflowId, newName);
    const response = await api.post(`/api/workflows/templates/${workflowId}/duplicate`, { newName });
    console.log("Successfully duplicated workflow template:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error duplicating workflow template:", error);
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

// ===== Order Workflow Execution APIs =====

// Description: Get suggested workflows for an order based on device type and services
// Endpoint: GET /api/admin/orders/:orderId/workflows/suggested
// Request: {}
// Response: { success: boolean, workflows: WorkflowTemplate[] }
export const getSuggestedWorkflowsForOrder = async (orderId: string) => {
  try {
    console.log("OrderWorkflowAPI: Getting suggested workflows for order:", orderId);
    const response = await api.get(`/api/admin/orders/${orderId}/workflows/suggested`);
    console.log("OrderWorkflowAPI: Received suggested workflows:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("OrderWorkflowAPI: Error getting suggested workflows:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get workflows assigned to an order
// Endpoint: GET /api/admin/orders/:orderId/workflows
// Request: {}
// Response: { success: boolean, workflows: OrderWorkflow[] }
export const getOrderWorkflows = async (orderId: string) => {
  try {
    console.log("OrderWorkflowAPI: Getting workflows for order:", orderId);
    const response = await api.get(`/api/admin/orders/${orderId}/workflows`);
    console.log("OrderWorkflowAPI: Received order workflows:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("OrderWorkflowAPI: Error getting order workflows:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Assign workflow template to an order
// Endpoint: POST /api/admin/orders/:orderId/workflows
// Request: { workflowTemplateId: string }
// Response: { success: boolean, message: string, order: Order }
export const assignWorkflowToOrder = async (orderId: string, workflowTemplateId: string) => {
  try {
    console.log("OrderWorkflowAPI: Assigning workflow to order:", { orderId, workflowTemplateId });
    const response = await api.post(`/api/admin/orders/${orderId}/workflows`, { workflowTemplateId });
    console.log("OrderWorkflowAPI: Workflow assigned successfully:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("OrderWorkflowAPI: Error assigning workflow:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Start workflow execution
// Endpoint: POST /api/admin/orders/:orderId/workflows/:workflowId/start
// Request: {}
// Response: { success: boolean, message: string, order: Order }
export const startWorkflow = async (orderId: string, workflowId: string) => {
  try {
    console.log("OrderWorkflowAPI: Starting workflow:", { orderId, workflowId });
    const response = await api.post(`/api/admin/orders/${orderId}/workflows/${workflowId}/start`);
    console.log("OrderWorkflowAPI: Workflow started successfully:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("OrderWorkflowAPI: Error starting workflow:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Complete workflow step
// Endpoint: POST /api/admin/orders/:orderId/workflows/:workflowId/steps/:stepId/complete
// Request: { formData?: object, checklistData?: object, notes?: string, photos?: string[] }
// Response: { success: boolean, message: string, order: Order }
export const completeWorkflowStep = async (
  orderId: string,
  workflowId: string,
  stepId: string,
  stepData: {
    formData?: any;
    checklistData?: any;
    notes?: string;
    photos?: string[];
  }
) => {
  try {
    console.log("OrderWorkflowAPI: Completing workflow step:", { orderId, workflowId, stepId, stepData });
    const response = await api.post(
      `/api/admin/orders/${orderId}/workflows/${workflowId}/steps/${stepId}/complete`,
      stepData
    );
    console.log("OrderWorkflowAPI: Workflow step completed successfully:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("OrderWorkflowAPI: Error completing workflow step:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Skip workflow step
// Endpoint: POST /api/admin/orders/:orderId/workflows/:workflowId/steps/:stepId/skip
// Request: { reason?: string }
// Response: { success: boolean, message: string, order: Order }
export const skipWorkflowStep = async (
  orderId: string,
  workflowId: string,
  stepId: string,
  reason?: string
) => {
  try {
    console.log("OrderWorkflowAPI: Skipping workflow step:", { orderId, workflowId, stepId, reason });
    const response = await api.post(
      `/api/admin/orders/${orderId}/workflows/${workflowId}/steps/${stepId}/skip`,
      { reason }
    );
    console.log("OrderWorkflowAPI: Workflow step skipped successfully:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("OrderWorkflowAPI: Error skipping workflow step:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update workflow status (pause/resume)
// Endpoint: PUT /api/admin/orders/:orderId/workflows/:workflowId/status
// Request: { status: 'in-progress' | 'on-hold' }
// Response: { success: boolean, message: string, order: Order }
export const updateWorkflowStatus = async (
  orderId: string,
  workflowId: string,
  status: 'in-progress' | 'on-hold'
) => {
  try {
    console.log("OrderWorkflowAPI: Updating workflow status:", { orderId, workflowId, status });
    const response = await api.put(
      `/api/admin/orders/${orderId}/workflows/${workflowId}/status`,
      { status }
    );
    console.log("OrderWorkflowAPI: Workflow status updated successfully:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("OrderWorkflowAPI: Error updating workflow status:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Navigate to previous step
// Endpoint: POST /api/admin/orders/:orderId/workflows/:workflowId/steps/:stepId/goto
// Request: {}
// Response: { success: boolean, message: string, order: Order }
export const goBackToStep = async (
  orderId: string,
  workflowId: string,
  stepId: string
) => {
  try {
    console.log("OrderWorkflowAPI: Going back to step:", { orderId, workflowId, stepId });
    const response = await api.post(
      `/api/admin/orders/${orderId}/workflows/${workflowId}/steps/${stepId}/goto`
    );
    console.log("OrderWorkflowAPI: Successfully navigated to step:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("OrderWorkflowAPI: Error navigating to step:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete workflow from order
// Endpoint: DELETE /api/admin/orders/:orderId/workflows/:workflowId
// Request: {}
// Response: { success: boolean, message: string, order: Order }
export const deleteWorkflowFromOrder = async (orderId: string, workflowId: string) => {
  try {
    console.log("OrderWorkflowAPI: Deleting workflow from order:", { orderId, workflowId });
    const response = await api.delete(`/api/admin/orders/${orderId}/workflows/${workflowId}`);
    console.log("OrderWorkflowAPI: Workflow deleted successfully:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("OrderWorkflowAPI: Error deleting workflow:", error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};