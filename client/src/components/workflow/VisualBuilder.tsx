import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/useToast";
import { StepManagementDialog } from "./StepManagementDialog";
import { WorkflowTemplate, WorkflowStep, FormField, AutomationRule } from "@/api/workflow";
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Settings,
  FormInput,
  Zap,
  Clock,
  CheckCircle,
  AlertTriangle,
  Move
} from "lucide-react";

interface VisualBuilderProps {
  workflow: WorkflowTemplate;
  onSave: (workflow: Partial<WorkflowTemplate>) => Promise<void>;
  onClose: () => void;
  services: any[];
  addOnServices: any[];
}

export function VisualBuilder({ workflow, onSave, onClose, services, addOnServices }: VisualBuilderProps) {
  console.log('VisualBuilder: Component initialized with workflow:', workflow.name);

  const { t } = useTranslation();
  const { toast } = useToast();
  const [workflowData, setWorkflowData] = useState<WorkflowTemplate>(workflow);
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);
  const [showStepDialog, setShowStepDialog] = useState(false);
  const [isNewStep, setIsNewStep] = useState(false);
  const [saving, setSaving] = useState(false);

  // Update local workflow data when prop changes
  useEffect(() => {
    console.log('VisualBuilder: Updating workflow data from props');
    setWorkflowData(workflow);
  }, [workflow]);

  const handleSaveWorkflow = async () => {
    console.log('VisualBuilder: Saving workflow changes');
    setSaving(true);
    try {
      await onSave(workflowData);
      console.log('VisualBuilder: Workflow saved successfully');
      toast({
        title: t('common.success'),
        description: t('workflowManagement.visualBuilder.workflowSavedSuccess')
      });
    } catch (error: any) {
      console.error('VisualBuilder: Error saving workflow:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('workflowManagement.visualBuilder.errorSavingWorkflow'),
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddStep = () => {
    console.log('VisualBuilder: Adding new step');
    const newStep: Partial<WorkflowStep> = {
      _id: `temp_${Date.now()}`,
      name: '',
      description: '',
      estimatedTime: 30,
      isRequired: true,
      order: workflowData.steps.length + 1,
      category: 'diagnostic',
      canSkip: false,
      requiresApproval: false,
      requiresFormCompletion: false,
      tools: [],
      skills: [],
      checklistItems: [],
      dependencies: [],
      formFields: [],
      automationRules: [],
      position: { x: 0, y: 0 },
      notificationSettings: {
        onStart: false,
        onComplete: false,
        onDelay: false
      }
    };

    setSelectedStep(newStep as WorkflowStep);
    setIsNewStep(true);
    setShowStepDialog(true);
  };

  const handleEditStep = (step: WorkflowStep) => {
    console.log('VisualBuilder: Editing step:', step.name);
    setSelectedStep(step);
    setIsNewStep(false);
    setShowStepDialog(true);
  };

  const handleDeleteStep = (stepId: string) => {
    console.log('VisualBuilder: Deleting step:', stepId);
    if (!confirm(t('workflowManagement.confirmDeleteStep'))) return;

    setWorkflowData(prev => ({
      ...prev,
      steps: prev.steps.filter(step => step._id !== stepId).map((step, index) => ({
        ...step,
        order: index + 1
      }))
    }));

    toast({
      title: t('common.success'),
      description: t('workflowManagement.visualBuilder.stepDeletedSuccess')
    });
  };

  const handleSaveStep = async (stepData: Partial<WorkflowStep>) => {
    console.log('VisualBuilder: Saving step:', stepData.name);
    
    try {
      if (isNewStep) {
        // Add new step
        const newStep = {
          ...stepData,
          _id: `step_${Date.now()}`,
          order: workflowData.steps.length + 1
        } as WorkflowStep;

        console.log('VisualBuilder: Adding new step to workflow');
        setWorkflowData(prev => ({
          ...prev,
          steps: [...prev.steps, newStep]
        }));
      } else {
        // Update existing step
        console.log('VisualBuilder: Updating existing step in workflow');
        setWorkflowData(prev => ({
          ...prev,
          steps: prev.steps.map(step => 
            step._id === stepData._id ? { ...step, ...stepData } as WorkflowStep : step
          )
        }));
      }

      setShowStepDialog(false);
      setSelectedStep(null);
      setIsNewStep(false);

      toast({
        title: "Success",
        description: `Step ${isNewStep ? 'added' : 'updated'} successfully`
      });
    } catch (error: any) {
      console.error('VisualBuilder: Error saving step:', error);
      throw error;
    }
  };

  const handleAddFormField = async (formField: FormField) => {
    console.log('VisualBuilder: Adding form field to step');
    if (!selectedStep) return;

    // For new steps, update local state
    if (isNewStep) {
      setSelectedStep(prev => prev ? {
        ...prev,
        formFields: [...(prev.formFields || []), formField]
      } : null);
    }
  };

  const handleUpdateFormField = async (fieldId: string, updates: Partial<FormField>) => {
    console.log('VisualBuilder: Updating form field:', fieldId);
    if (!selectedStep) return;

    // For new steps, update local state
    if (isNewStep) {
      setSelectedStep(prev => prev ? {
        ...prev,
        formFields: prev.formFields?.map(field =>
          field.id === fieldId ? { ...field, ...updates } : field
        ) || []
      } : null);
    }
  };

  const handleRemoveFormField = async (fieldId: string) => {
    console.log('VisualBuilder: Removing form field:', fieldId);
    if (!selectedStep) return;

    // For new steps, update local state
    if (isNewStep) {
      setSelectedStep(prev => prev ? {
        ...prev,
        formFields: prev.formFields?.filter(field => field.id !== fieldId) || []
      } : null);
    }
  };

  const handleAddAutomationRule = async (rule: AutomationRule) => {
    console.log('VisualBuilder: Adding automation rule to step');
    if (!selectedStep) return;

    // For new steps, update local state
    if (isNewStep) {
      setSelectedStep(prev => prev ? {
        ...prev,
        automationRules: [...(prev.automationRules || []), rule]
      } : null);
    }
  };

  const handleUpdateAutomationRule = async (ruleId: string, updates: Partial<AutomationRule>) => {
    console.log('VisualBuilder: Updating automation rule:', ruleId);
    if (!selectedStep) return;

    // For new steps, update local state
    if (isNewStep) {
      setSelectedStep(prev => prev ? {
        ...prev,
        automationRules: prev.automationRules?.map(rule =>
          rule._id === ruleId ? { ...rule, ...updates } : rule
        ) || []
      } : null);
    }
  };

  const handleRemoveAutomationRule = async (ruleId: string) => {
    console.log('VisualBuilder: Removing automation rule:', ruleId);
    if (!selectedStep) return;

    // For new steps, update local state
    if (isNewStep) {
      setSelectedStep(prev => prev ? {
        ...prev,
        automationRules: prev.automationRules?.filter(rule => rule._id !== ruleId) || []
      } : null);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'diagnostic':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'repair':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'quality':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'addon':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'completion':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const sortedSteps = [...workflowData.steps].sort((a, b) => a.order - b.order);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h2 className="text-2xl font-bold">{workflowData.name}</h2>
          <p className="text-muted-foreground">Visual Workflow Builder</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleAddStep}>
            <Plus className="h-4 w-4 mr-2" />
            Add Step
          </Button>
          <Button onClick={handleSaveWorkflow} disabled={saving}>
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Workflow
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
      </div>

      {/* Workflow Canvas */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="space-y-4">
          {sortedSteps.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Settings className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Steps Added</h3>
                <p className="text-muted-foreground text-center mb-6">
                  Start building your workflow by adding the first step with interactive forms and automation
                </p>
                <Button onClick={handleAddStep} size="lg">
                  <Plus className="h-5 w-5 mr-2" />
                  Add First Step
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sortedSteps.map((step, index) => (
                <Card key={step._id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            Step {step.order}
                          </Badge>
                          <Badge className={`text-xs ${getCategoryColor(step.category)}`}>
                            {step.category}
                          </Badge>
                          {step.isRequired && (
                            <Badge variant="destructive" className="text-xs">
                              Required
                            </Badge>
                          )}
                          {step.requiresApproval && (
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approval
                            </Badge>
                          )}
                          {step.requiresFormCompletion && (
                            <Badge variant="secondary" className="text-xs">
                              <FormInput className="h-3 w-3 mr-1" />
                              Form Required
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg">{step.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {step.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditStep(step)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteStep(step._id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {/* Step Details */}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{step.estimatedTime} min</span>
                        </div>
                        {step.dependencies && step.dependencies.length > 0 && (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4" />
                            <span>{step.dependencies.length} dependencies</span>
                          </div>
                        )}
                        {step.tools && step.tools.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Settings className="h-4 w-4" />
                            <span>{step.tools.length} tools</span>
                          </div>
                        )}
                      </div>

                      {/* Form Fields Summary */}
                      {step.formFields && step.formFields.length > 0 && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <FormInput className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              Interactive Form Fields ({step.formFields.length})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {step.formFields.slice(0, 3).map((field) => (
                              <Badge key={field.id} variant="outline" className="text-xs">
                                {field.label} ({field.type})
                              </Badge>
                            ))}
                            {step.formFields.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{step.formFields.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Automation Rules Summary */}
                      {step.automationRules && step.automationRules.length > 0 && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              Automation Rules ({step.automationRules.length})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {step.automationRules.slice(0, 2).map((rule, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {rule.trigger} → {rule.action}
                              </Badge>
                            ))}
                            {step.automationRules.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{step.automationRules.length - 2} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Checklist Items */}
                      {step.checklistItems && step.checklistItems.length > 0 && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              Checklist ({step.checklistItems.length} items)
                            </span>
                          </div>
                          <div className="space-y-1">
                            {step.checklistItems.slice(0, 2).map((item, index) => (
                              <div key={index} className="text-xs text-muted-foreground">
                                • {item}
                              </div>
                            ))}
                            {step.checklistItems.length > 2 && (
                              <div className="text-xs text-muted-foreground">
                                ... and {step.checklistItems.length - 2} more items
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Step Management Dialog */}
      <StepManagementDialog
        open={showStepDialog}
        onOpenChange={setShowStepDialog}
        step={selectedStep}
        onSave={handleSaveStep}
        onAddFormField={handleAddFormField}
        onUpdateFormField={handleUpdateFormField}
        onRemoveFormField={handleRemoveFormField}
        onAddAutomationRule={handleAddAutomationRule}
        onUpdateAutomationRule={handleUpdateAutomationRule}
        onRemoveAutomationRule={handleRemoveAutomationRule}
        isNew={isNewStep}
      />
    </div>
  );
}