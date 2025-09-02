import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  FormInput,
  Zap,
  ArrowUp,
  ArrowDown,
  Settings
} from "lucide-react";
import { WorkflowStep } from "@/api/workflow";

interface StepListProps {
  steps: WorkflowStep[];
  onAddStep: () => void;
  onEditStep: (step: WorkflowStep) => void;
  onRemoveStep: (stepId: string) => void;
  onAddFormField: (step: WorkflowStep) => void;
  onAddAutomationRule: (step: WorkflowStep) => void;
  onMoveStepUp: (stepId: string) => void;
  onMoveStepDown: (stepId: string) => void;
}

export function StepList({
  steps,
  onAddStep,
  onEditStep,
  onRemoveStep,
  onAddFormField,
  onAddAutomationRule,
  onMoveStepUp,
  onMoveStepDown
}: StepListProps) {
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

  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Workflow Steps</h3>
        <Button onClick={onAddStep} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Step
        </Button>
      </div>

      {sortedSteps.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Settings className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Steps Added</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start building your workflow by adding the first step
            </p>
            <Button onClick={onAddStep}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Step
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedSteps.map((step, index) => (
            <Card key={step._id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Step {step.order}
                      </span>
                      <Badge className={getCategoryColor(step.category)}>
                        {step.category}
                      </Badge>
                      {step.isRequired && (
                        <Badge variant="outline" className="text-red-600 border-red-200">
                          Required
                        </Badge>
                      )}
                      {step.requiresApproval && (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-200">
                          Approval
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base">{step.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {step.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onMoveStepUp(step._id)}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onMoveStepDown(step._id)}
                      disabled={index === sortedSteps.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditStep(step)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveStep(step._id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{step.estimatedTime} min</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FormInput className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{step.formFields?.length || 0} form fields</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{step.automationRules?.length || 0} automation rules</span>
                  </div>
                </div>

                {step.tools && step.tools.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium mb-2">Required Tools:</h4>
                    <div className="flex flex-wrap gap-1">
                      {step.tools.map((tool, toolIndex) => (
                        <Badge key={toolIndex} variant="secondary" className="text-xs">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {step.skills && step.skills.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium mb-2">Required Skills:</h4>
                    <div className="flex flex-wrap gap-1">
                      {step.skills.map((skill, skillIndex) => (
                        <Badge key={skillIndex} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {step.checklistItems && step.checklistItems.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium mb-2">Checklist Items:</h4>
                    <ul className="text-sm space-y-1">
                      {step.checklistItems.map((item, itemIndex) => (
                        <li key={itemIndex} className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {step.dependencies && step.dependencies.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium mb-2">Dependencies:</h4>
                    <div className="flex flex-wrap gap-1">
                      {step.dependencies.map((dep, depIndex) => (
                        <Badge key={depIndex} variant="outline" className="text-xs text-yellow-600 border-yellow-200">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Step {dep}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAddFormField(step)}
                  >
                    <FormInput className="h-4 w-4 mr-2" />
                    Add Form Field
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAddAutomationRule(step)}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Add Automation
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}