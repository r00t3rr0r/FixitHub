const { WorkflowTemplate, AddOnWorkflow } = require('../models/Workflow');
const AddOnService = require('../models/AddOnService');

class WorkflowService {
  // Get all workflow templates with optional filters
  static async getWorkflowTemplates(filters = {}) {
    console.log('WorkflowService: Getting workflow templates with filters:', filters);

    try {
      const query = {};

      // Apply filters
      if (filters.deviceType) {
        query.deviceTypes = { $in: [filters.deviceType] };
      }

      if (filters.serviceType) {
        query.serviceTypes = { $in: [filters.serviceType] };
      }

      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }

      const workflows = await WorkflowTemplate.find(query)
        .sort({ createdAt: -1 });

      console.log('WorkflowService: Found', workflows.length, 'workflow templates');
      return workflows;
    } catch (error) {
      console.error('WorkflowService: Error getting workflow templates:', error);
      throw error;
    }
  }

  // Get single workflow template by ID
  static async getWorkflowTemplateById(workflowId) {
    console.log('WorkflowService: Getting workflow template by ID:', workflowId);

    try {
      const workflow = await WorkflowTemplate.findById(workflowId);

      if (!workflow) {
        throw new Error('Workflow template not found');
      }

      console.log('WorkflowService: Workflow template found:', workflow.name);
      return workflow;
    } catch (error) {
      console.error('WorkflowService: Error getting workflow template by ID:', error);
      throw error;
    }
  }

  // Create new workflow template
  static async createWorkflowTemplate(workflowData) {
    console.log('WorkflowService: Creating new workflow template with data:', {
      name: workflowData.name,
      deviceTypes: workflowData.deviceTypes,
      serviceTypes: workflowData.serviceTypes,
      stepsCount: workflowData.steps?.length || 0,
      estimatedTotalTime: workflowData.estimatedTotalTime,
      isActive: workflowData.isActive
    });

    try {
      // Validate required fields
      if (!workflowData.name || !workflowData.description) {
        console.error('WorkflowService: Validation failed - missing name or description');
        throw new Error('Workflow name and description are required');
      }

      if (!workflowData.deviceTypes || workflowData.deviceTypes.length === 0) {
        console.error('WorkflowService: Validation failed - no device types specified');
        throw new Error('At least one device type must be specified');
      }

      if (!workflowData.serviceTypes || workflowData.serviceTypes.length === 0) {
        console.error('WorkflowService: Validation failed - no service types specified');
        throw new Error('At least one service type must be specified');
      }

      console.log('WorkflowService: Validation passed, creating workflow');
      const workflow = new WorkflowTemplate(workflowData);
      const savedWorkflow = await workflow.save();

      console.log('WorkflowService: Workflow template created successfully:', {
        id: savedWorkflow._id,
        name: savedWorkflow.name,
        stepsCount: savedWorkflow.steps?.length || 0,
        estimatedTotalTime: savedWorkflow.estimatedTotalTime
      });
      return savedWorkflow;
    } catch (error) {
      console.error('WorkflowService: Error creating workflow template:', error);
      console.error('WorkflowService: Error details:', {
        message: error.message,
        stack: error.stack,
        workflowData: JSON.stringify(workflowData, null, 2)
      });
      throw error;
    }
  }

  // Update workflow template
  static async updateWorkflowTemplate(workflowId, updateData) {
    console.log('WorkflowService: Updating workflow template:', {
      workflowId,
      updateFields: Object.keys(updateData),
      stepsCount: updateData.steps?.length || 0,
      estimatedTotalTime: updateData.estimatedTotalTime
    });

    try {
      // Validate the workflow exists first
      const existingWorkflow = await WorkflowTemplate.findById(workflowId);
      if (!existingWorkflow) {
        console.error('WorkflowService: Workflow template not found:', workflowId);
        throw new Error('Workflow template not found');
      }

      console.log('WorkflowService: Found existing workflow:', {
        id: existingWorkflow._id,
        name: existingWorkflow.name,
        currentStepsCount: existingWorkflow.steps?.length || 0
      });

      // Clean up the updateData to remove temporary IDs and invalid ObjectIds
      if (updateData.steps) {
        console.log('WorkflowService: Cleaning up steps data');
        updateData.steps = updateData.steps.map((step, index) => {
          const cleanStep = { ...step };

          // Remove temporary IDs that start with 'temp_' or are not valid ObjectIds
          if (cleanStep._id && (cleanStep._id.toString().startsWith('temp_') || !cleanStep._id.match(/^[0-9a-fA-F]{24}$/))) {
            console.log(`WorkflowService: Removing invalid step ID: ${cleanStep._id}`);
            delete cleanStep._id;
          }

          // Clean automation rules - remove custom _id fields
          if (cleanStep.automationRules) {
            cleanStep.automationRules = cleanStep.automationRules.map(rule => {
              const cleanRule = { ...rule };
              // Remove custom _id fields that don't conform to ObjectId format
              if (cleanRule._id && typeof cleanRule._id === 'string' && !cleanRule._id.match(/^[0-9a-fA-F]{24}$/)) {
                console.log(`WorkflowService: Removing invalid automation rule ID: ${cleanRule._id}`);
                delete cleanRule._id;
              }
              return cleanRule;
            });
          }

          // Ensure step order is set correctly
          if (!cleanStep.order || cleanStep.order !== index + 1) {
            console.log(`WorkflowService: Setting step order for step ${index}: ${cleanStep.name}`);
            cleanStep.order = index + 1;
          }

          return cleanStep;
        });
      }

      console.log('WorkflowService: Performing update with cleaned data');
      const updatedWorkflow = await WorkflowTemplate.findByIdAndUpdate(
        workflowId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedWorkflow) {
        console.error('WorkflowService: Workflow template not found after update:', workflowId);
        throw new Error('Workflow template not found');
      }

      console.log('WorkflowService: Workflow template updated successfully:', {
        id: updatedWorkflow._id,
        name: updatedWorkflow.name,
        stepsCount: updatedWorkflow.steps?.length || 0,
        estimatedTotalTime: updatedWorkflow.estimatedTotalTime
      });
      return updatedWorkflow;
    } catch (error) {
      console.error('WorkflowService: Error updating workflow template:', error);
      console.error('WorkflowService: Error details:', {
        message: error.message,
        stack: error.stack,
        workflowId,
        updateData: JSON.stringify(updateData, null, 2)
      });
      throw error;
    }
  }

  // Delete workflow template
  static async deleteWorkflowTemplate(workflowId) {
    console.log('WorkflowService: Deleting workflow template:', workflowId);

    try {
      const deletedWorkflow = await WorkflowTemplate.findByIdAndDelete(workflowId);

      if (!deletedWorkflow) {
        throw new Error('Workflow template not found');
      }

      console.log('WorkflowService: Workflow template deleted successfully');
      return { success: true, message: 'Workflow template deleted successfully' };
    } catch (error) {
      console.error('WorkflowService: Error deleting workflow template:', error);
      throw error;
    }
  }

  // Reorder workflow steps
  static async reorderWorkflowSteps(workflowId, stepOrderData) {
    console.log('WorkflowService: Reordering workflow steps for workflow:', workflowId);

    try {
      const workflow = await WorkflowTemplate.findById(workflowId);
      if (!workflow) {
        throw new Error('Workflow template not found');
      }

      // Update step orders based on provided data
      stepOrderData.forEach(({ stepId, newOrder, position }) => {
        const step = workflow.steps.id(stepId);
        if (step) {
          step.order = newOrder;
          if (position) {
            step.position = position;
          }
        }
      });

      // Sort steps by order
      workflow.steps.sort((a, b) => a.order - b.order);

      const savedWorkflow = await workflow.save();
      console.log('WorkflowService: Workflow steps reordered successfully');
      return savedWorkflow;
    } catch (error) {
      console.error('WorkflowService: Error reordering workflow steps:', error);
      throw error;
    }
  }

  // Add form field to workflow step
  static async addFormFieldToStep(workflowId, stepId, formField) {
    console.log('WorkflowService: Adding form field to step:', stepId);

    try {
      const workflow = await WorkflowTemplate.findById(workflowId);
      if (!workflow) {
        throw new Error('Workflow template not found');
      }

      const step = workflow.steps.id(stepId);
      if (!step) {
        throw new Error('Workflow step not found');
      }

      // Generate unique ID for form field if not provided
      if (!formField.id) {
        formField.id = `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      step.formFields.push(formField);
      const savedWorkflow = await workflow.save();

      console.log('WorkflowService: Form field added successfully');
      return savedWorkflow;
    } catch (error) {
      console.error('WorkflowService: Error adding form field:', error);
      throw error;
    }
  }

  // Update form field in workflow step
  static async updateFormField(workflowId, stepId, fieldId, updateData) {
    console.log('WorkflowService: Updating form field:', fieldId);

    try {
      const workflow = await WorkflowTemplate.findById(workflowId);
      if (!workflow) {
        throw new Error('Workflow template not found');
      }

      const step = workflow.steps.id(stepId);
      if (!step) {
        throw new Error('Workflow step not found');
      }

      const fieldIndex = step.formFields.findIndex(field => field.id === fieldId);
      if (fieldIndex === -1) {
        throw new Error('Form field not found');
      }

      // Update the form field
      Object.assign(step.formFields[fieldIndex], updateData);
      const savedWorkflow = await workflow.save();

      console.log('WorkflowService: Form field updated successfully');
      return savedWorkflow;
    } catch (error) {
      console.error('WorkflowService: Error updating form field:', error);
      throw error;
    }
  }

  // Remove form field from workflow step
  static async removeFormField(workflowId, stepId, fieldId) {
    console.log('WorkflowService: Removing form field:', fieldId);

    try {
      const workflow = await WorkflowTemplate.findById(workflowId);
      if (!workflow) {
        throw new Error('Workflow template not found');
      }

      const step = workflow.steps.id(stepId);
      if (!step) {
        throw new Error('Workflow step not found');
      }

      const fieldIndex = step.formFields.findIndex(field => field.id === fieldId);
      if (fieldIndex === -1) {
        throw new Error('Form field not found');
      }

      step.formFields.splice(fieldIndex, 1);
      const savedWorkflow = await workflow.save();

      console.log('WorkflowService: Form field removed successfully');
      return savedWorkflow;
    } catch (error) {
      console.error('WorkflowService: Error removing form field:', error);
      throw error;
    }
  }

  // Add automation rule to workflow step
  static async addAutomationRule(workflowId, stepId, automationRule) {
    console.log('WorkflowService: Adding automation rule to step:', stepId);

    try {
      const workflow = await WorkflowTemplate.findById(workflowId);
      if (!workflow) {
        throw new Error('Workflow template not found');
      }

      const step = workflow.steps.id(stepId);
      if (!step) {
        throw new Error('Workflow step not found');
      }

      step.automationRules.push(automationRule);
      const savedWorkflow = await workflow.save();

      console.log('WorkflowService: Automation rule added successfully');
      return savedWorkflow;
    } catch (error) {
      console.error('WorkflowService: Error adding automation rule:', error);
      throw error;
    }
  }

  // Update automation rule
  static async updateAutomationRule(workflowId, stepId, ruleId, updateData) {
    console.log('WorkflowService: Updating automation rule:', ruleId);

    try {
      const workflow = await WorkflowTemplate.findById(workflowId);
      if (!workflow) {
        throw new Error('Workflow template not found');
      }

      const step = workflow.steps.id(stepId);
      if (!step) {
        throw new Error('Workflow step not found');
      }

      const rule = step.automationRules.id(ruleId);
      if (!rule) {
        throw new Error('Automation rule not found');
      }

      Object.assign(rule, updateData);
      const savedWorkflow = await workflow.save();

      console.log('WorkflowService: Automation rule updated successfully');
      return savedWorkflow;
    } catch (error) {
      console.error('WorkflowService: Error updating automation rule:', error);
      throw error;
    }
  }

  // Remove automation rule
  static async removeAutomationRule(workflowId, stepId, ruleId) {
    console.log('WorkflowService: Removing automation rule:', ruleId);

    try {
      const workflow = await WorkflowTemplate.findById(workflowId);
      if (!workflow) {
        throw new Error('Workflow template not found');
      }

      const step = workflow.steps.id(stepId);
      if (!step) {
        throw new Error('Workflow step not found');
      }

      step.automationRules.pull(ruleId);
      const savedWorkflow = await workflow.save();

      console.log('WorkflowService: Automation rule removed successfully');
      return savedWorkflow;
    } catch (error) {
      console.error('WorkflowService: Error removing automation rule:', error);
      throw error;
    }
  }

  // Duplicate workflow template
  static async duplicateWorkflowTemplate(workflowId, newName) {
    console.log('WorkflowService: Duplicating workflow template:', workflowId);

    try {
      const originalWorkflow = await WorkflowTemplate.findById(workflowId);
      if (!originalWorkflow) {
        throw new Error('Workflow template not found');
      }

      const duplicateData = originalWorkflow.toObject();
      delete duplicateData._id;
      delete duplicateData.createdAt;
      delete duplicateData.updatedAt;

      duplicateData.name = newName || `${duplicateData.name} (Copy)`;
      duplicateData.isActive = false; // New duplicates start as inactive

      const duplicateWorkflow = new WorkflowTemplate(duplicateData);
      const savedWorkflow = await duplicateWorkflow.save();

      console.log('WorkflowService: Workflow template duplicated successfully');
      return savedWorkflow;
    } catch (error) {
      console.error('WorkflowService: Error duplicating workflow template:', error);
      throw error;
    }
  }

  // Get all add-on workflows
  static async getAddOnWorkflows() {
    console.log('WorkflowService: Getting add-on workflows');

    try {
      const addOnWorkflows = await AddOnWorkflow.find({ isActive: true })
        .sort({ createdAt: -1 });

      console.log('WorkflowService: Found', addOnWorkflows.length, 'add-on workflows');
      return addOnWorkflows;
    } catch (error) {
      console.error('WorkflowService: Error getting add-on workflows:', error);
      throw error;
    }
  }

  // Create new add-on workflow
  static async createAddOnWorkflow(workflowData) {
    console.log('WorkflowService: Creating new add-on workflow for service:', workflowData.addOnServiceId);

    try {
      // Verify the add-on service exists
      const addOnService = await AddOnService.findById(workflowData.addOnServiceId);
      if (!addOnService) {
        throw new Error('Add-on service not found');
      }

      // Set the service name from the service
      workflowData.addOnServiceName = addOnService.name;

      const addOnWorkflow = new AddOnWorkflow(workflowData);
      const savedWorkflow = await addOnWorkflow.save();

      console.log('WorkflowService: Add-on workflow created successfully with ID:', savedWorkflow._id);
      return savedWorkflow;
    } catch (error) {
      console.error('WorkflowService: Error creating add-on workflow:', error);
      throw error;
    }
  }

  // Update add-on workflow
  static async updateAddOnWorkflow(workflowId, updateData) {
    console.log('WorkflowService: Updating add-on workflow:', workflowId);

    try {
      const updatedWorkflow = await AddOnWorkflow.findByIdAndUpdate(
        workflowId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedWorkflow) {
        throw new Error('Add-on workflow not found');
      }

      console.log('WorkflowService: Add-on workflow updated successfully');
      return updatedWorkflow;
    } catch (error) {
      console.error('WorkflowService: Error updating add-on workflow:', error);
      throw error;
    }
  }

  // Get workflow statistics
  static async getWorkflowStats() {
    console.log('WorkflowService: Getting workflow statistics');

    try {
      const [workflowStats, addOnStats] = await Promise.all([
        WorkflowTemplate.aggregate([
          {
            $group: {
              _id: '$isActive',
              count: { $sum: 1 },
              avgTime: { $avg: '$estimatedTotalTime' },
              totalSteps: { $sum: { $size: '$steps' } },
              totalAutomationRules: {
                $sum: {
                  $sum: {
                    $map: {
                      input: '$steps',
                      as: 'step',
                      in: { $size: { $ifNull: ['$$step.automationRules', []] } }
                    }
                  }
                }
              }
            }
          }
        ]),
        AddOnWorkflow.aggregate([
          {
            $group: {
              _id: '$optimalTiming',
              count: { $sum: 1 }
            }
          }
        ])
      ]);

      const stats = {
        activeWorkflows: 0,
        inactiveWorkflows: 0,
        averageCompletionTime: 0,
        totalSteps: 0,
        totalAutomationRules: 0,
        addOnIntegrations: 0,
        timingDistribution: {}
      };

      // Process workflow stats
      workflowStats.forEach(stat => {
        if (stat._id === true) {
          stats.activeWorkflows = stat.count;
          stats.averageCompletionTime = Math.round(stat.avgTime || 0);
          stats.totalSteps = stat.totalSteps;
          stats.totalAutomationRules = stat.totalAutomationRules;
        } else {
          stats.inactiveWorkflows = stat.count;
        }
      });

      // Process add-on stats
      addOnStats.forEach(stat => {
        stats.timingDistribution[stat._id] = stat.count;
        stats.addOnIntegrations += stat.count;
      });

      console.log('WorkflowService: Workflow statistics calculated');
      return stats;
    } catch (error) {
      console.error('WorkflowService: Error getting workflow statistics:', error);
      throw error;
    }
  }
}

module.exports = WorkflowService;