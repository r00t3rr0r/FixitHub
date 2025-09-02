import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/useToast';
import {
  Plus,
  Trash2,
  Move,
  Save,
  Eye,
  Settings,
  ArrowDown,
  ArrowUp,
  Play,
  Pause,
  Clock,
  User,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface WorkflowStep {
  _id?: string;
  name: string;
  description: string;
  category: 'diagnostic' | 'repair' | 'testing' | 'quality_check' | 'documentation' | 'customer_communication' | 'quality' | 'addon' | 'completion';
  estimatedTime: number;
  skills?: string[]; // Backend uses 'skills'
  requiredSkills?: string[]; // Frontend expects 'requiredSkills'
  tools?: string[];
  materials?: string[];
  instructions?: string;
  order: number;
  isOptional?: boolean;
  isRequired?: boolean;
  automationRules?: {
    condition: string;
    action: string;
    _id?: string;
  }[];
  dependencies?: string[];
  qualityChecks?: {
    name: string;
    description: string;
    required: boolean;
    _id?: string;
  }[];
  checklistItems?: string[];
  formFields?: any[];
  canSkip?: boolean;
  requiresApproval?: boolean;
  notificationSettings?: {
    onStart: boolean;
    onComplete: boolean;
    onDelay: boolean;
  };
}

interface WorkflowTemplate {
  _id?: string;
  name: string;
  description: string;
  deviceTypes: string[];
  serviceTypes: string[];
  steps: WorkflowStep[];
  estimatedTotalTime?: number;
  isActive: boolean;
  workflowSettings?: {
    allowParallelSteps: boolean;
    requireStrictOrder: boolean;
    autoProgressOnCompletion: boolean;
  };
}

interface VisualBuilderProps {
  workflow: WorkflowTemplate;
  onSave: (workflow: WorkflowTemplate) => void;
  onClose: () => void;
  services: any[];
  addOnServices: any[];
}

const STEP_CATEGORIES = [
  { value: 'diagnostic', label: 'Diagnostic', color: 'bg-blue-100 text-blue-800' },
  { value: 'repair', label: 'Repair', color: 'bg-red-100 text-red-800' },
  { value: 'testing', label: 'Testing', color: 'bg-green-100 text-green-800' },
  { value: 'quality', label: 'Quality Check', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'addon', label: 'Add-on Service', color: 'bg-purple-100 text-purple-800' },
  { value: 'completion', label: 'Completion', color: 'bg-indigo-100 text-indigo-800' }
];

// Helper function to normalize step data
const normalizeStep = (step: WorkflowStep): WorkflowStep => {
  return {
    ...step,
    requiredSkills: step.requiredSkills || step.skills || [],
    skills: step.skills || step.requiredSkills || [],
    tools: step.tools || [],
    materials: step.materials || [],
    instructions: step.instructions || '',
    checklistItems: step.checklistItems || [],
    formFields: step.formFields || [],
    automationRules: step.automationRules || [],
    dependencies: step.dependencies || [],
    qualityChecks: step.qualityChecks || [],
    isOptional: step.isOptional || false,
    canSkip: step.canSkip || false,
    requiresApproval: step.requiresApproval || false,
    notificationSettings: step.notificationSettings || {
      onStart: false,
      onComplete: false,
      onDelay: false
    }
  };
};

export function VisualBuilder({ workflow, onSave, onClose, services, addOnServices }: VisualBuilderProps) {
  console.log('VisualBuilder: Component initialized with workflow:', workflow?.name);
  console.log('VisualBuilder: Props received:', {
    workflowId: workflow?._id,
    workflowName: workflow?.name,
    stepsCount: workflow?.steps?.length || 0,
    servicesCount: services?.length || 0,
    addOnServicesCount: addOnServices?.length || 0,
    onSave: typeof onSave,
    onClose: typeof onClose
  });

  const { toast } = useToast();
  
  // Normalize workflow data to ensure all steps have the expected properties
  const normalizedWorkflow = {
    ...workflow,
    steps: (workflow.steps || []).map(normalizeStep)
  };
  
  const [workflowData, setWorkflowData] = useState<WorkflowTemplate>(normalizedWorkflow);

  // Add log when component mounts
  useEffect(() => {
    console.log('VisualBuilder: Component mounted');
    console.log('VisualBuilder: Initial workflow data:', {
      name: workflow?.name,
      stepsCount: workflow?.steps?.length || 0,
      normalizedStepsCount: normalizedWorkflow.steps.length
    });
  }, []);

  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);
  const [showStepDialog, setShowStepDialog] = useState(false);
  const [draggedStep, setDraggedStep] = useState<number | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('VisualBuilder: Workflow data updated:', {
      name: workflowData.name,
      stepsCount: workflowData.steps.length,
      estimatedTotalTime: workflowData.estimatedTotalTime
    });
  }, [workflowData]);

  const handleAddStep = useCallback(() => {
    console.log('VisualBuilder: Adding new step');
    const newStep: WorkflowStep = normalizeStep({
      _id: `temp_${Date.now()}`,
      name: '',
      description: '',
      category: 'diagnostic',
      estimatedTime: 30,
      order: workflowData.steps.length + 1,
    });

    setSelectedStep(newStep);
    setShowStepDialog(true);
  }, [workflowData.steps.length]);

  const handleEditStep = useCallback((step: WorkflowStep) => {
    console.log('VisualBuilder: Editing step:', step.name);
    setSelectedStep(normalizeStep(step));
    setShowStepDialog(true);
  }, []);

  const handleSaveStep = useCallback((stepData: WorkflowStep) => {
    console.log('VisualBuilder: Saving step:', stepData.name);

    try {
      const normalizedStepData = normalizeStep(stepData);
      
      setWorkflowData(prev => {
        const updatedSteps = [...prev.steps];
        const existingIndex = updatedSteps.findIndex(s => s._id === normalizedStepData._id);

        if (existingIndex >= 0) {
          updatedSteps[existingIndex] = normalizedStepData;
          console.log('VisualBuilder: Updated existing step at index:', existingIndex);
        } else {
          updatedSteps.push(normalizedStepData);
          console.log('VisualBuilder: Added new step');
        }

        // Recalculate total estimated time
        const estimatedTotalTime = updatedSteps.reduce((total, step) => total + (step.estimatedTime || 0), 0);
        console.log('VisualBuilder: Recalculated total time:', estimatedTotalTime);

        return {
          ...prev,
          steps: updatedSteps,
          estimatedTotalTime
        };
      });

      setShowStepDialog(false);
      setSelectedStep(null);

      toast({
        title: "Success",
        description: "Step saved successfully"
      });
    } catch (error) {
      console.error('VisualBuilder: Error saving step:', error);
      toast({
        title: "Error",
        description: "Failed to save step",
        variant: "destructive"
      });
    }
  }, [toast]);

  const handleDeleteStep = useCallback((stepId: string) => {
    console.log('VisualBuilder: Deleting step:', stepId);

    try {
      setWorkflowData(prev => {
        const updatedSteps = prev.steps.filter(s => s._id !== stepId);

        // Reorder remaining steps
        const reorderedSteps = updatedSteps.map((step, index) => ({
          ...step,
          order: index + 1
        }));

        // Recalculate total estimated time
        const estimatedTotalTime = reorderedSteps.reduce((total, step) => total + (step.estimatedTime || 0), 0);
        console.log('VisualBuilder: Step deleted, new total time:', estimatedTotalTime);

        return {
          ...prev,
          steps: reorderedSteps,
          estimatedTotalTime
        };
      });

      toast({
        title: "Success",
        description: "Step deleted successfully"
      });
    } catch (error) {
      console.error('VisualBuilder: Error deleting step:', error);
      toast({
        title: "Error",
        description: "Failed to delete step",
        variant: "destructive"
      });
    }
  }, [toast]);

  const handleMoveStep = useCallback((fromIndex: number, toIndex: number) => {
    console.log('VisualBuilder: Moving step from', fromIndex, 'to', toIndex);

    try {
      setWorkflowData(prev => {
        const updatedSteps = [...prev.steps];
        const [movedStep] = updatedSteps.splice(fromIndex, 1);
        updatedSteps.splice(toIndex, 0, movedStep);

        // Update order for all steps
        const reorderedSteps = updatedSteps.map((step, index) => ({
          ...step,
          order: index + 1
        }));

        console.log('VisualBuilder: Steps reordered successfully');

        return {
          ...prev,
          steps: reorderedSteps
        };
      });
    } catch (error) {
      console.error('VisualBuilder: Error moving step:', error);
      toast({
        title: "Error",
        description: "Failed to move step",
        variant: "destructive"
      });
    }
  }, [toast]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    console.log('VisualBuilder: Drag started for step index:', index);
    setDraggedStep(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    console.log('VisualBuilder: Drop event at index:', dropIndex);

    if (draggedStep !== null && draggedStep !== dropIndex) {
      handleMoveStep(draggedStep, dropIndex);
    }
    setDraggedStep(null);
  }, [draggedStep, handleMoveStep]);

  const handleSaveWorkflow = useCallback(() => {
    console.log('VisualBuilder: Saving workflow:', workflowData.name);

    try {
      if (!workflowData.name || !workflowData.description) {
        toast({
          title: "Error",
          description: "Workflow name and description are required",
          variant: "destructive"
        });
        return;
      }

      if (workflowData.steps.length === 0) {
        toast({
          title: "Error",
          description: "At least one step is required",
          variant: "destructive"
        });
        return;
      }

      console.log('VisualBuilder: Validation passed, calling onSave');
      onSave(workflowData);

      toast({
        title: "Success",
        description: "Workflow saved successfully"
      });
    } catch (error) {
      console.error('VisualBuilder: Error saving workflow:', error);
      toast({
        title: "Error",
        description: "Failed to save workflow",
        variant: "destructive"
      });
    }
  }, [workflowData, onSave, toast]);

  const getCategoryStyle = (category: string) => {
    const categoryConfig = STEP_CATEGORIES.find(c => c.value === category);
    return categoryConfig?.color || 'bg-gray-100 text-gray-800';
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex items-center justify-between p-4 bg-white border-b">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold">Visual Workflow Builder</h2>
          <Badge variant="outline">{workflowData.name}</Badge>
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            {formatTime(workflowData.estimatedTotalTime || 0)}
          </Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant={isPreviewMode ? "default" : "outline"}
            size="sm"
            onClick={() => {
              console.log('VisualBuilder: Toggling preview mode:', !isPreviewMode);
              setIsPreviewMode(!isPreviewMode);
            }}
          >
            {isPreviewMode ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
            {isPreviewMode ? 'Edit Mode' : 'Preview Mode'}
          </Button>
          
          <Button onClick={handleSaveWorkflow} size="sm">
            <Save className="w-4 h-4 mr-1" />
            Save Workflow
          </Button>
          
          <Button variant="outline" onClick={onClose} size="sm">
            Close
          </Button>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Workflow Canvas */}
        <div className="flex-1 p-4 overflow-auto">
          <div ref={canvasRef} className="min-h-full">
            {workflowData.steps.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Settings className="w-12 h-12 mb-4" />
                <h3 className="text-lg font-medium mb-2">No Steps Added</h3>
                <p className="text-sm text-center mb-4">
                  Start building your workflow by adding the first step
                </p>
                <Button onClick={handleAddStep}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add First Step
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {workflowData.steps.map((step, index) => {
                  const normalizedStep = normalizeStep(step);
                  
                  return (
                    <div key={step._id} className="relative">
                      {/* Step Card */}
                      <Card
                        className={`transition-all duration-200 hover:shadow-md ${
                          draggedStep === index ? 'opacity-50' : ''
                        } ${isPreviewMode ? 'cursor-default' : 'cursor-move'}`}
                        draggable={!isPreviewMode}
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-medium">
                                {step.order}
                              </div>
                              <div>
                                <CardTitle className="text-lg">{step.name}</CardTitle>
                                <div className="flex items-center space-x-2 mt-1">
                                  <Badge className={getCategoryStyle(step.category)}>
                                    {STEP_CATEGORIES.find(c => c.value === step.category)?.label}
                                  </Badge>
                                  <Badge variant="outline">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {formatTime(step.estimatedTime)}
                                  </Badge>
                                  {normalizedStep.isOptional && (
                                    <Badge variant="secondary">Optional</Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            {!isPreviewMode && (
                              <div className="flex items-center space-x-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditStep(step)}
                                >
                                  <Settings className="w-4 h-4" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => index > 0 && handleMoveStep(index, index - 1)}
                                  disabled={index === 0}
                                >
                                  <ArrowUp className="w-4 h-4" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => index < workflowData.steps.length - 1 && handleMoveStep(index, index + 1)}
                                  disabled={index === workflowData.steps.length - 1}
                                >
                                  <ArrowDown className="w-4 h-4" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteStep(step._id!)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        
                        <CardContent>
                          <p className="text-gray-600 mb-3">{step.description}</p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            {normalizedStep.requiredSkills && normalizedStep.requiredSkills.length > 0 && (
                              <div>
                                <Label className="text-xs font-medium text-gray-500">Required Skills</Label>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {normalizedStep.requiredSkills.map((skill, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      <User className="w-3 h-3 mr-1" />
                                      {skill}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {normalizedStep.tools && normalizedStep.tools.length > 0 && (
                              <div>
                                <Label className="text-xs font-medium text-gray-500">Tools</Label>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {normalizedStep.tools.map((tool, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {tool}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {normalizedStep.materials && normalizedStep.materials.length > 0 && (
                              <div>
                                <Label className="text-xs font-medium text-gray-500">Materials</Label>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {normalizedStep.materials.map((material, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {material}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {normalizedStep.qualityChecks && normalizedStep.qualityChecks.length > 0 && (
                            <div className="mt-3">
                              <Label className="text-xs font-medium text-gray-500">Quality Checks</Label>
                              <div className="space-y-1 mt-1">
                                {normalizedStep.qualityChecks.map((check, idx) => (
                                  <div key={idx} className="flex items-center space-x-2 text-xs">
                                    {check.required ? (
                                      <AlertCircle className="w-3 h-3 text-red-500" />
                                    ) : (
                                      <CheckCircle className="w-3 h-3 text-green-500" />
                                    )}
                                    <span>{check.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      
                      {/* Connection Arrow */}
                      {index < workflowData.steps.length - 1 && (
                        <div className="flex justify-center py-2">
                          <ArrowDown className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {/* Add Step Button */}
                {!isPreviewMode && (
                  <div className="flex justify-center pt-4">
                    <Button onClick={handleAddStep} variant="outline" className="w-full max-w-md">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Step
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Properties Panel */}
        <div className="w-80 bg-white border-l p-4 overflow-auto">
          <h3 className="font-medium mb-4">Workflow Properties</h3>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="workflow-name">Name</Label>
              <Input
                id="workflow-name"
                value={workflowData.name}
                onChange={(e) => {
                  console.log('VisualBuilder: Workflow name changed:', e.target.value);
                  setWorkflowData(prev => ({ ...prev, name: e.target.value }));
                }}
                disabled={isPreviewMode}
              />
            </div>
            
            <div>
              <Label htmlFor="workflow-description">Description</Label>
              <Textarea
                id="workflow-description"
                value={workflowData.description}
                onChange={(e) => {
                  console.log('VisualBuilder: Workflow description changed');
                  setWorkflowData(prev => ({ ...prev, description: e.target.value }));
                }}
                disabled={isPreviewMode}
                rows={3}
              />
            </div>
            
            <div>
              <Label>Device Types</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {workflowData.deviceTypes.map((type, idx) => (
                  <Badge key={idx} variant="secondary">{type}</Badge>
                ))}
              </div>
            </div>
            
            <div>
              <Label>Service Types</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {workflowData.serviceTypes.map((type, idx) => (
                  <Badge key={idx} variant="secondary">{type}</Badge>
                ))}
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Workflow Statistics</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Steps:</span>
                  <span>{workflowData.steps.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Time:</span>
                  <span>{formatTime(workflowData.estimatedTotalTime || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Optional Steps:</span>
                  <span>{workflowData.steps.filter(s => s.isOptional).length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step Dialog */}
      <Dialog open={showStepDialog} onOpenChange={setShowStepDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedStep?._id?.startsWith('temp_') ? 'Add New Step' : 'Edit Step'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedStep && (
            <StepEditor
              step={selectedStep}
              onSave={handleSaveStep}
              onCancel={() => {
                console.log('VisualBuilder: Step editing cancelled');
                setShowStepDialog(false);
                setSelectedStep(null);
              }}
              services={services}
              addOnServices={addOnServices}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Step Editor Component
interface StepEditorProps {
  step: WorkflowStep;
  onSave: (step: WorkflowStep) => void;
  onCancel: () => void;
  services: any[];
  addOnServices: any[];
}

function StepEditor({ step, onSave, onCancel, services, addOnServices }: StepEditorProps) {
  const [stepData, setStepData] = useState<WorkflowStep>(normalizeStep(step));
  const [newSkill, setNewSkill] = useState('');
  const [newTool, setNewTool] = useState('');
  const [newMaterial, setNewMaterial] = useState('');

  const handleSave = () => {
    console.log('StepEditor: Saving step data:', stepData.name);
    
    if (!stepData.name || !stepData.description) {
      console.error('StepEditor: Validation failed - missing name or description');
      return;
    }
    
    onSave(stepData);
  };

  const addSkill = () => {
    if (newSkill.trim()) {
      console.log('StepEditor: Adding skill:', newSkill);
      setStepData(prev => ({
        ...prev,
        requiredSkills: [...(prev.requiredSkills || []), newSkill.trim()],
        skills: [...(prev.skills || []), newSkill.trim()]
      }));
      setNewSkill('');
    }
  };

  const removeSkill = (index: number) => {
    console.log('StepEditor: Removing skill at index:', index);
    setStepData(prev => ({
      ...prev,
      requiredSkills: (prev.requiredSkills || []).filter((_, i) => i !== index),
      skills: (prev.skills || []).filter((_, i) => i !== index)
    }));
  };

  const addTool = () => {
    if (newTool.trim()) {
      console.log('StepEditor: Adding tool:', newTool);
      setStepData(prev => ({
        ...prev,
        tools: [...(prev.tools || []), newTool.trim()]
      }));
      setNewTool('');
    }
  };

  const removeTool = (index: number) => {
    console.log('StepEditor: Removing tool at index:', index);
    setStepData(prev => ({
      ...prev,
      tools: (prev.tools || []).filter((_, i) => i !== index)
    }));
  };

  const addMaterial = () => {
    if (newMaterial.trim()) {
      console.log('StepEditor: Adding material:', newMaterial);
      setStepData(prev => ({
        ...prev,
        materials: [...(prev.materials || []), newMaterial.trim()]
      }));
      setNewMaterial('');
    }
  };

  const removeMaterial = (index: number) => {
    console.log('StepEditor: Removing material at index:', index);
    setStepData(prev => ({
      ...prev,
      materials: (prev.materials || []).filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="step-name">Step Name *</Label>
          <Input
            id="step-name"
            value={stepData.name}
            onChange={(e) => setStepData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter step name"
          />
        </div>
        
        <div>
          <Label htmlFor="step-category">Category</Label>
          <Select
            value={stepData.category}
            onValueChange={(value: any) => setStepData(prev => ({ ...prev, category: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STEP_CATEGORIES.map(category => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="step-description">Description *</Label>
        <Textarea
          id="step-description"
          value={stepData.description}
          onChange={(e) => setStepData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Describe what needs to be done in this step"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="step-time">Estimated Time (minutes)</Label>
          <Input
            id="step-time"
            type="number"
            value={stepData.estimatedTime}
            onChange={(e) => setStepData(prev => ({ ...prev, estimatedTime: parseInt(e.target.value) || 0 }))}
            min="1"
          />
        </div>
        
        <div className="flex items-center space-x-2 pt-6">
          <input
            type="checkbox"
            id="step-optional"
            checked={stepData.isOptional || false}
            onChange={(e) => setStepData(prev => ({ ...prev, isOptional: e.target.checked }))}
          />
          <Label htmlFor="step-optional">Optional Step</Label>
        </div>
      </div>

      <div>
        <Label htmlFor="step-instructions">Instructions</Label>
        <Textarea
          id="step-instructions"
          value={stepData.instructions || ''}
          onChange={(e) => setStepData(prev => ({ ...prev, instructions: e.target.value }))}
          placeholder="Detailed instructions for completing this step"
          rows={4}
        />
      </div>

      {/* Required Skills */}
      <div>
        <Label>Required Skills</Label>
        <div className="flex space-x-2 mt-1">
          <Input
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            placeholder="Add required skill"
            onKeyPress={(e) => e.key === 'Enter' && addSkill()}
          />
          <Button type="button" onClick={addSkill} size="sm">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {(stepData.requiredSkills || []).map((skill, index) => (
            <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeSkill(index)}>
              {skill} ×
            </Badge>
          ))}
        </div>
      </div>

      {/* Tools */}
      <div>
        <Label>Tools</Label>
        <div className="flex space-x-2 mt-1">
          <Input
            value={newTool}
            onChange={(e) => setNewTool(e.target.value)}
            placeholder="Add required tool"
            onKeyPress={(e) => e.key === 'Enter' && addTool()}
          />
          <Button type="button" onClick={addTool} size="sm">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {(stepData.tools || []).map((tool, index) => (
            <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeTool(index)}>
              {tool} ×
            </Badge>
          ))}
        </div>
      </div>

      {/* Materials */}
      <div>
        <Label>Materials</Label>
        <div className="flex space-x-2 mt-1">
          <Input
            value={newMaterial}
            onChange={(e) => setNewMaterial(e.target.value)}
            placeholder="Add required material"
            onKeyPress={(e) => e.key === 'Enter' && addMaterial()}
          />
          <Button type="button" onClick={addMaterial} size="sm">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {(stepData.materials || []).map((material, index) => (
            <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeMaterial(index)}>
              {material} ×
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          Save Step
        </Button>
      </div>
    </div>
  );
}