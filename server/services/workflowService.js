const {
  WorkflowTemplate,
  AddOnWorkflow,
  WorkflowSeedSuppression,
  SEED_WORKFLOW_TEMPLATE_NAMES
} = require('../models/Workflow');
const AddOnService = require('../models/AddOnService');

class WorkflowService {
  // ---------------------------------------------------------------------
  // Seed suppression helpers
  // ---------------------------------------------------------------------
  // Only the names SeedService owns are ever suppressed. A hand-made template
  // must not be able to block a seed name, and deleting one must not grow the
  // suppression collection (there is no admin UI to inspect or clear it).
  static isSeedOwnedTemplateName(name) {
    return SEED_WORKFLOW_TEMPLATE_NAMES.includes(String(name || '').trim());
  }

  // Records that the admin no longer wants a seed template under this name.
  // Never throws - a bookkeeping failure must not fail the caller's operation.
  static async recordSeedSuppression(name) {
    if (!WorkflowService.isSeedOwnedTemplateName(name)) {
      return;
    }
    try {
      await WorkflowSeedSuppression.updateOne(
        { name },
        { $set: { name, deletedAt: new Date() } },
        { upsert: true }
      );
    } catch (suppressionError) {
      console.error('WorkflowService: Could not record seed suppression for', name, suppressionError.message);
    }
  }

  // Lifts the suppression - the admin has a template under this name again.
  // Never throws, for the same reason.
  static async clearSeedSuppression(name) {
    if (!WorkflowService.isSeedOwnedTemplateName(name)) {
      return;
    }
    try {
      await WorkflowSeedSuppression.deleteOne({ name });
    } catch (suppressionError) {
      console.error('WorkflowService: Could not clear seed suppression for', name, suppressionError.message);
    }
  }

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
      console.log('WorkflowService: Sample workflow structure:', workflows[0] ? {
        id: workflows[0]._id,
        name: workflows[0].name,
        hasSteps: !!workflows[0].steps,
        stepsLength: workflows[0].steps?.length || 0,
        hasDeviceTypes: !!workflows[0].deviceTypes,
        deviceTypesLength: workflows[0].deviceTypes?.length || 0,
        hasServiceTypes: !!workflows[0].serviceTypes,
        serviceTypesLength: workflows[0].serviceTypes?.length || 0,
        hasWorkflowSettings: !!workflows[0].workflowSettings,
        estimatedTotalTime: workflows[0].estimatedTotalTime
      } : 'No workflows found');
      
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

      // Set default estimatedTotalTime if not provided
      if (!workflowData.estimatedTotalTime) {
        workflowData.estimatedTotalTime = 0;
        console.log('WorkflowService: Setting default estimatedTotalTime to 0');
      }

      console.log('WorkflowService: Validation passed, creating workflow');
      const workflow = new WorkflowTemplate(workflowData);
      const savedWorkflow = await workflow.save();

      // Re-creating a template by name lifts the "deleted by admin" seed suppression
      await WorkflowService.clearSeedSuppression(savedWorkflow.name);

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

      // A rename moves the template out from under its old name. If that old name
      // is a seed name, the seeder would otherwise re-create it on the next boot
      // (the rename is a resurrection vector). If the NEW name is a suppressed
      // seed name, the admin has a template under that name again, so lift it.
      const previousName = String(existingWorkflow.name || '').trim();
      const currentName = String(updatedWorkflow.name || '').trim();
      if (previousName !== currentName) {
        await WorkflowService.recordSeedSuppression(previousName);
        await WorkflowService.clearSeedSuppression(currentName);
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

      // Remember the deletion so SeedService.seedWorkflows() does not recreate
      // this template on the next server boot. Never let this fail the deletion.
      await WorkflowService.recordSeedSuppression(deletedWorkflow.name);

      console.log('WorkflowService: Workflow template deleted successfully');
      return { success: true, message: 'Workflow template deleted successfully' };
    } catch (error) {
      console.error('WorkflowService: Error deleting workflow template:', error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------
  // Workflow suggestion matching
  // ---------------------------------------------------------------------
  // A template is a catch-all ("general") template when it is scoped to neither
  // a device type nor a service type. Such a template used to be suggested on
  // EVERY order; it is now only offered as a fallback (see getSuggestedWorkflows).
  static isCatchAllTemplate(workflow) {
    const deviceTypes = workflow?.deviceTypes || [];
    const serviceTypes = workflow?.serviceTypes || [];
    return deviceTypes.length === 0 && serviceTypes.length === 0;
  }

  // A template is GENERAL when it leaves at least one scope dimension open - no
  // deviceTypes ("any device") or no serviceTypes ("any service"). The pre-refactor
  // query offered exactly these on every order (`deviceTypes $size 0` OR
  // `serviceTypes $size 0`), so they stay offerable, but only through the fallback
  // tier in getSuggestedWorkflows. isCatchAllTemplate (BOTH empty) is its strictest
  // case and is therefore always general as well.
  static isGeneralTemplate(workflow) {
    const deviceTypes = workflow?.deviceTypes || [];
    const serviceTypes = workflow?.serviceTypes || [];
    return deviceTypes.length === 0 || serviceTypes.length === 0;
  }

  // A template matches an order when every scope it declares matches.
  // An empty deviceTypes array means "any device", an empty serviceTypes array
  // means "any service" - but only within the scope the template does declare.
  //
  // serviceTypes is stored as [String], but the admin UI (WorkflowManagement.tsx)
  // writes Service ObjectId strings into it while the order side only knows the
  // service CATEGORY. We therefore accept a match on either representation, so a
  // template scoped in the admin UI actually matches instead of matching nothing
  // (and no data migration is required). See F1-D.
  //
  // Compared case-insensitively and trimmed: the template UI writes 'Smartphone',
  // while device data from the catalogue (Device.deviceType is `lowercase: true`)
  // can reach an order as 'smartphone'. An exact comparison made such orders match
  // no specific template, so only the general fallback was offered ("the general
  // workflow is back").
  static normalizeScopeToken(token) {
    return token === undefined || token === null ? '' : String(token).trim().toLowerCase();
  }

  static matchesOrderScope(workflow, deviceType, serviceCategories = [], serviceIds = []) {
    const normalize = WorkflowService.normalizeScopeToken;
    const deviceTypes = (workflow?.deviceTypes || []).map(normalize).filter(Boolean);
    const serviceTypes = (workflow?.serviceTypes || []).map(normalize).filter(Boolean);

    const deviceMatches = deviceTypes.length === 0 || deviceTypes.includes(normalize(deviceType));

    const orderServiceTokens = [
      ...(serviceCategories || []),
      ...(serviceIds || [])
    ]
      .map(normalize)
      .filter(Boolean);

    const serviceMatches = serviceTypes.length === 0 ||
      orderServiceTokens.some((token) => serviceTypes.includes(token));

    return deviceMatches && serviceMatches;
  }

  // Get the workflow templates that should be offered for an order.
  // Rule: specific templates (scoped to the order's device type and/or service
  // categories, every declared dimension matching) win. General templates - those
  // that leave at least one dimension open, catch-alls included - are offered only
  // when no specific template matches the order at all. Templates already assigned
  // to the order are never suggested again.
  static async getSuggestedWorkflows({
    deviceType,
    serviceCategories = [],
    serviceIds = [],
    assignedTemplateIds = []
  } = {}) {
    console.log('WorkflowService: Getting suggested workflows for', {
      deviceType,
      serviceCategories,
      serviceIdCount: (serviceIds || []).length,
      assignedCount: (assignedTemplateIds || []).length
    });

    try {
      const templates = await WorkflowTemplate.find({ isActive: true }).sort({ createdAt: -1 });

      const assigned = new Set(
        (assignedTemplateIds || [])
          .map((id) => (id ? String(id) : ''))
          .filter(Boolean)
      );

      // Drop the already-assigned templates FIRST. The catch-all fallback has to be
      // decided on what is still offerable: if the only matching specific template
      // is already assigned to this order, the order is back to having no specific
      // option and the general template must be offered again (otherwise the
      // suggestion list comes back empty).
      const offerable = templates.filter((template) => !assigned.has(String(template._id)));

      const specificMatches = offerable.filter(
        (template) => !WorkflowService.isCatchAllTemplate(template) &&
          WorkflowService.matchesOrderScope(template, deviceType, serviceCategories, serviceIds)
      );

      // Fallback tier. The pre-refactor query offered a template whenever
      // `deviceTypes $size 0` OR `serviceTypes $size 0` held, so a half-scoped
      // template (e.g. serviceTypes ['Akku'] with no deviceTypes) was offered even on
      // an order it contradicts. Limiting the fallback to templates with BOTH arrays
      // empty dropped those templates from the suggestions altogether. They are
      // offered again here - but as a FALLBACK only, so the unconditional catch-all
      // of the old query does not come back: as soon as one specific template matches,
      // no general template is suggested.
      const generalMatches = offerable.filter(
        (template) => WorkflowService.isGeneralTemplate(template)
      );

      // Within the fallback, a true catch-all (no device AND no service scope) is the
      // honest "general" answer. A half-scoped template that CONTRADICTS the order
      // (e.g. deviceTypes ['Smartphone'] on a Laptop order) is only offered when there
      // is no catch-all at all, so the assignment dialog is never left empty.
      const catchAllMatches = generalMatches.filter(
        (template) => WorkflowService.isCatchAllTemplate(template)
      );
      const fallback = catchAllMatches.length > 0 ? catchAllMatches : generalMatches;

      const suggested = specificMatches.length > 0 ? specificMatches : fallback;

      console.log('WorkflowService: Suggested', suggested.length, 'workflows', {
        offerableCount: offerable.length,
        specificMatchCount: specificMatches.length,
        generalCount: generalMatches.length,
        catchAllCount: catchAllMatches.length,
        usedGeneralFallback: specificMatches.length === 0
      });

      return suggested;
    } catch (error) {
      console.error('WorkflowService: Error getting suggested workflows:', error);
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

      // A duplicate carrying a suppressed seed name re-occupies that name.
      await WorkflowService.clearSeedSuppression(savedWorkflow.name);

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