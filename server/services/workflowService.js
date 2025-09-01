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
    console.log('WorkflowService: Creating new workflow template:', workflowData.name);

    try {
      const workflow = new WorkflowTemplate(workflowData);
      const savedWorkflow = await workflow.save();

      console.log('WorkflowService: Workflow template created successfully with ID:', savedWorkflow._id);
      return savedWorkflow;
    } catch (error) {
      console.error('WorkflowService: Error creating workflow template:', error);
      throw error;
    }
  }

  // Update workflow template
  static async updateWorkflowTemplate(workflowId, updateData) {
    console.log('WorkflowService: Updating workflow template:', workflowId);

    try {
      const updatedWorkflow = await WorkflowTemplate.findByIdAndUpdate(
        workflowId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedWorkflow) {
        throw new Error('Workflow template not found');
      }

      console.log('WorkflowService: Workflow template updated successfully');
      return updatedWorkflow;
    } catch (error) {
      console.error('WorkflowService: Error updating workflow template:', error);
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
              totalSteps: { $sum: { $size: '$steps' } }
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
        addOnIntegrations: 0,
        timingDistribution: {}
      };

      // Process workflow stats
      workflowStats.forEach(stat => {
        if (stat._id === true) {
          stats.activeWorkflows = stat.count;
          stats.averageCompletionTime = Math.round(stat.avgTime || 0);
          stats.totalSteps = stat.totalSteps;
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