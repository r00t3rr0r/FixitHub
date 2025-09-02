import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, User, Settings, Trash2, Edit, ArrowDown } from 'lucide-react';
import { WorkflowStep } from '@/types/workflow';

interface VisualBuilderNodeProps {
  step: WorkflowStep;
  index: number;
  isLast: boolean;
  onEdit: (step: WorkflowStep) => void;
  onDelete: (stepId: string) => void;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
  isReadOnly?: boolean;
}

export function VisualBuilderNode({
  step,
  index,
  isLast,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  isReadOnly = false
}: VisualBuilderNodeProps) {
  console.log('VisualBuilderNode: Rendering node for step:', {
    stepId: step._id,
    stepName: step.name,
    index,
    isLast,
    isReadOnly
  });

  const handleEdit = () => {
    console.log('VisualBuilderNode: Edit button clicked for step:', step._id, step.name);
    if (!isReadOnly) {
      onEdit(step);
    }
  };

  const handleDelete = () => {
    console.log('VisualBuilderNode: Delete button clicked for step:', step._id, step.name);
    if (!isReadOnly && step._id) {
      onDelete(step._id);
    }
  };

  const handleMoveUp = () => {
    console.log('VisualBuilderNode: Move up clicked for step at index:', index);
    if (!isReadOnly && onMoveUp && index > 0) {
      onMoveUp(index);
    }
  };

  const handleMoveDown = () => {
    console.log('VisualBuilderNode: Move down clicked for step at index:', index);
    if (!isReadOnly && onMoveDown && !isLast) {
      onMoveDown(index);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      'diagnostic': 'bg-blue-100 text-blue-800',
      'repair': 'bg-green-100 text-green-800',
      'testing': 'bg-yellow-100 text-yellow-800',
      'quality_assurance': 'bg-purple-100 text-purple-800',
      'documentation': 'bg-gray-100 text-gray-800',
      'customer_communication': 'bg-pink-100 text-pink-800'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      'low': 'bg-green-100 text-green-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'high': 'bg-orange-100 text-orange-800',
      'critical': 'bg-red-100 text-red-800'
    };
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="relative">
      <Card className="w-full max-w-md mx-auto mb-4 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold text-gray-900 mb-2">
                {step.name}
              </CardTitle>
              <div className="flex flex-wrap gap-2 mb-2">
                <Badge className={getCategoryColor(step.category)}>
                  {step.category.replace('_', ' ')}
                </Badge>
                <Badge className={getPriorityColor(step.priority)}>
                  {step.priority}
                </Badge>
              </div>
            </div>
            {!isReadOnly && (
              <div className="flex flex-col gap-1 ml-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMoveUp}
                  disabled={index === 0}
                  className="h-6 w-6 p-0"
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMoveDown}
                  disabled={isLast}
                  className="h-6 w-6 p-0"
                >
                  ↓
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <p className="text-sm text-gray-600 mb-4 line-clamp-3">
            {step.description}
          </p>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              <span>{step.estimatedTime} minutes</span>
            </div>
            
            {step.assignedRole && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <User className="h-4 w-4" />
                <span>{step.assignedRole.replace('_', ' ')}</span>
              </div>
            )}
            
            {step.requiredTools && step.requiredTools.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Settings className="h-4 w-4" />
                <span>{step.requiredTools.join(', ')}</span>
              </div>
            )}
            
            {step.automationRules && step.automationRules.length > 0 && (
              <div className="text-xs text-blue-600">
                {step.automationRules.length} automation rule(s)
              </div>
            )}
          </div>
          
          {!isReadOnly && (
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
                className="h-8 px-2"
              >
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {!isLast && (
        <div className="flex justify-center mb-4">
          <ArrowDown className="h-6 w-6 text-gray-400" />
        </div>
      )}
    </div>
  );
}