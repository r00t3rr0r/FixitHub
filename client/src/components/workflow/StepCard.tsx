import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Edit, 
  Trash2, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Settings, 
  FormInput,
  Zap,
  ArrowUp,
  ArrowDown,
  FileText
} from "lucide-react";
import { WorkflowStep } from "@/api/workflow";

interface StepCardProps {
  step: WorkflowStep;
  stepIndex: number;
  totalSteps: number;
  onEdit: (step: WorkflowStep) => void;
  onDelete: (stepId: string) => void;
  onMoveUp: (stepId: string) => void;
  onMoveDown: (stepId: string) => void;
  onAddFormField: (step: WorkflowStep) => void;
  onAddAutomation: (step: WorkflowStep) => void;
  isSelected?: boolean;
  onClick?: (step: WorkflowStep) => void;
}

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

export const StepCard: React.FC<StepCardProps> = ({
  step,
  stepIndex,
  totalSteps,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddFormField,
  onAddAutomation,
  isSelected = false,
  onClick
}) => {
  const handleCardClick = () => {
    if (onClick) {
      onClick(step);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(step);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(step._id);
  };

  const handleMoveUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMoveUp(step._id);
  };

  const handleMoveDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMoveDown(step._id);
  };

  const handleAddFormField = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddFormField(step);
  };

  const handleAddAutomation = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddAutomation(step);
  };

  return (
    <Card 
      className={`transition-all duration-200 hover:shadow-md cursor-pointer ${
        isSelected ? 'ring-2 ring-primary border-primary' : ''
      }`}
      onClick={handleCardClick}
    >
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
                  <FileText className="h-3 w-3 mr-1" />
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
            {stepIndex > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMoveUp}
                className="h-8 w-8 p-0"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
            {stepIndex < totalSteps - 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMoveDown}
                className="h-8 w-8 p-0"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEdit}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
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
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FormInput className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Form Fields ({step.formFields.length})
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddFormField}
                  className="h-6 px-2 text-xs"
                >
                  Add Field
                </Button>
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
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Automation Rules ({step.automationRules.length})
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddAutomation}
                  className="h-6 px-2 text-xs"
                >
                  Add Rule
                </Button>
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

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {(!step.formFields || step.formFields.length === 0) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddFormField}
                className="flex-1"
              >
                <FormInput className="h-4 w-4 mr-2" />
                Add Form Fields
              </Button>
            )}
            {(!step.automationRules || step.automationRules.length === 0) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddAutomation}
                className="flex-1"
              >
                <Zap className="h-4 w-4 mr-2" />
                Add Automation
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};