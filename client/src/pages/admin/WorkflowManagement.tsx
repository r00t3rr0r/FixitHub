import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/useToast';
import { VisualBuilder } from '@/components/workflow/VisualBuilder';
import { StepFormDialog } from '@/components/workflow/StepFormDialog';
import { StepManagementDialog } from '@/components/workflow/StepManagementDialog';
import {
  getWorkflowTemplates,
  createWorkflowTemplate,
  updateWorkflowTemplate,
  deleteWorkflowTemplate,
  getWorkflowTemplateById,
  duplicateWorkflowTemplate,
  getAddOnWorkflows,
  createAddOnWorkflow,
  updateAddOnWorkflow,
  getWorkflowStats,
  addFormFieldToStep,
  updateFormField,
  removeFormField,
  addAutomationRule,
  updateAutomationRule,
  removeAutomationRule,
  WorkflowTemplate,
  WorkflowStep,
  AddOnWorkflow,
  FormField,
  AutomationRule
} from '@/api/workflow';
import { getServices } from '@/api/services';
import { getAddOnServices } from '@/api/services';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Move,
  Copy,
  Settings,
  Zap,
  Clock,
  Users,
  BarChart3,
  Filter,
  Search,
  Download,
  Upload
} from 'lucide-react';

export function WorkflowManagement() {
  console.log('WorkflowManagement: Component initialized');

  const { toast } = useToast();
  
  // State management
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
  const [addOnWorkflows, setAddOnWorkflows] = useState<AddOnWorkflow[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [addOnServices, setAddOnServices] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showVisualBuilder, setShowVisualBuilder] = useState(false);
  const [showStepDialog, setShowStepDialog] = useState(false);
  const [showStepManagementDialog, setShowStepManagementDialog] = useState(false);
  const [showAddOnDialog, setShowAddOnDialog] = useState(false);

  // Selected items
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowTemplate | null>(null);
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);
  const [selectedAddOnWorkflow, setSelectedAddOnWorkflow] = useState<AddOnWorkflow | null>(null);

  // Form data
  const [workflowForm, setWorkflowForm] = useState({
    name: '',
    description: '',
    deviceTypes: [] as string[],
    serviceTypes: [] as string[],
    isActive: true,
    steps: [] as WorkflowStep[],
    workflowSettings: {
      allowParallelSteps: false,
      requireStrictOrder: true,
      autoProgressOnCompletion: false
    }
  });

  const [addOnForm, setAddOnForm] = useState({
    addOnServiceId: '',
    optimalTiming: 'during_repair' as 'before_repair' | 'during_repair' | 'after_repair' | 'flexible',
    dependencies: [] as string[],
    estimatedTime: 30,
    instructions: '',
    qualityChecks: [] as string[]
  });

  // Load initial data
  useEffect(() => {
    console.log('WorkflowManagement: Loading initial data');
    loadData();
  }, []);

  const loadData = async () => {
    console.log('WorkflowManagement: loadData called');
    setLoading(true);
    try {
      console.log('WorkflowManagement: Fetching workflows, services, and stats');
      const [workflowsRes, addOnWorkflowsRes, servicesRes, addOnServicesRes, statsRes] = await Promise.all([
        getWorkflowTemplates(),
        getAddOnWorkflows(),
        getServices(),
        getAddOnServices(),
        getWorkflowStats()
      ]);

      console.log('WorkflowManagement: Data loaded successfully:', {
        workflowsCount: workflowsRes.workflows?.length || 0,
        addOnWorkflowsCount: addOnWorkflowsRes.addOnWorkflows?.length || 0,
        servicesCount: servicesRes.services?.length || 0,
        addOnServicesCount: addOnServicesRes.services?.length || 0
      });

      setWorkflows(workflowsRes.workflows || []);
      setAddOnWorkflows(addOnWorkflowsRes.addOnWorkflows || []);
      setServices(servicesRes.services || []);
      setAddOnServices(addOnServicesRes.services || []);
      setStats(statsRes.stats || {});
    } catch (error: any) {
      console.error('WorkflowManagement: Error loading data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load workflow data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Workflow CRUD operations
  const handleCreateWorkflow = async () => {
    console.log('WorkflowManagement: Creating workflow:', workflowForm.name);
    try {
      const result = await createWorkflowTemplate(workflowForm);
      console.log('WorkflowManagement: Workflow created successfully:', result.workflow?._id);
      
      setWorkflows(prev => [result.workflow, ...prev]);
      setShowCreateDialog(false);
      resetWorkflowForm();
      
      toast({
        title: 'Success',
        description: 'Workflow created successfully'
      });
    } catch (error: any) {
      console.error('WorkflowManagement: Error creating workflow:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create workflow',
        variant: 'destructive'
      });
    }
  };

  const handleUpdateWorkflow = async () => {
    console.log('WorkflowManagement: Updating workflow:', selectedWorkflow?._id);
    if (!selectedWorkflow) return;

    try {
      const result = await updateWorkflowTemplate(selectedWorkflow._id, workflowForm);
      console.log('WorkflowManagement: Workflow updated successfully');
      
      setWorkflows(prev => prev.map(w => w._id === selectedWorkflow._id ? result.workflow : w));
      setShowEditDialog(false);
      setSelectedWorkflow(null);
      resetWorkflowForm();
      
      toast({
        title: 'Success',
        description: 'Workflow updated successfully'
      });
    } catch (error: any) {
      console.error('WorkflowManagement: Error updating workflow:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update workflow',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    console.log('WorkflowManagement: Deleting workflow:', workflowId);
    if (!confirm('Are you sure you want to delete this workflow?')) return;

    try {
      await deleteWorkflowTemplate(workflowId);
      console.log('WorkflowManagement: Workflow deleted successfully');
      
      setWorkflows(prev => prev.filter(w => w._id !== workflowId));
      
      toast({
        title: 'Success',
        description: 'Workflow deleted successfully'
      });
    } catch (error: any) {
      console.error('WorkflowManagement: Error deleting workflow:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete workflow',
        variant: 'destructive'
      });
    }
  };

  const handleDuplicateWorkflow = async (workflowId: string) => {
    console.log('WorkflowManagement: Duplicating workflow:', workflowId);
    try {
      const result = await duplicateWorkflowTemplate(workflowId);
      console.log('WorkflowManagement: Workflow duplicated successfully');
      
      setWorkflows(prev => [result.workflow, ...prev]);
      
      toast({
        title: 'Success',
        description: 'Workflow duplicated successfully'
      });
    } catch (error: any) {
      console.error('WorkflowManagement: Error duplicating workflow:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to duplicate workflow',
        variant: 'destructive'
      });
    }
  };

  // Add-on workflow operations
  const handleCreateAddOnWorkflow = async () => {
    console.log('WorkflowManagement: Creating add-on workflow');
    try {
      const result = await createAddOnWorkflow(addOnForm);
      console.log('WorkflowManagement: Add-on workflow created successfully');
      
      setAddOnWorkflows(prev => [result.addOnWorkflow, ...prev]);
      setShowAddOnDialog(false);
      resetAddOnForm();
      
      toast({
        title: 'Success',
        description: 'Add-on workflow created successfully'
      });
    } catch (error: any) {
      console.error('WorkflowManagement: Error creating add-on workflow:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create add-on workflow',
        variant: 'destructive'
      });
    }
  };

  // Step management operations
  const handleSaveStep = async (stepData: Partial<WorkflowStep>) => {
    console.log('WorkflowManagement: Saving step:', stepData.name);
    if (!selectedWorkflow) return;

    try {
      const updatedWorkflow = { ...selectedWorkflow };
      
      if (stepData._id && !stepData._id.startsWith('temp_')) {
        // Update existing step
        const stepIndex = updatedWorkflow.steps.findIndex(s => s._id === stepData._id);
        if (stepIndex >= 0) {
          updatedWorkflow.steps[stepIndex] = stepData as WorkflowStep;
        }
      } else {
        // Add new step
        const newStep = {
          ...stepData,
          _id: `step_${Date.now()}`,
          order: updatedWorkflow.steps.length + 1
        } as WorkflowStep;
        updatedWorkflow.steps.push(newStep);
      }

      const result = await updateWorkflowTemplate(selectedWorkflow._id, updatedWorkflow);
      setSelectedWorkflow(result.workflow);
      setWorkflows(prev => prev.map(w => w._id === selectedWorkflow._id ? result.workflow : w));
      
      console.log('WorkflowManagement: Step saved successfully');
    } catch (error: any) {
      console.error('WorkflowManagement: Error saving step:', error);
      throw error;
    }
  };

  const handleAddFormFieldToStep = async (formField: FormField) => {
    console.log('WorkflowManagement: Adding form field to step');
    if (!selectedWorkflow || !selectedStep) return;

    try {
      const result = await addFormFieldToStep(selectedWorkflow._id, selectedStep._id, formField);
      setSelectedWorkflow(result.workflow);
      setWorkflows(prev => prev.map(w => w._id === selectedWorkflow._id ? result.workflow : w));
    } catch (error: any) {
      console.error('WorkflowManagement: Error adding form field:', error);
      throw error;
    }
  };

  const handleUpdateFormField = async (fieldId: string, updates: Partial<FormField>) => {
    console.log('WorkflowManagement: Updating form field:', fieldId);
    if (!selectedWorkflow || !selectedStep) return;

    try {
      const result = await updateFormField(selectedWorkflow._id, selectedStep._id, fieldId, updates);
      setSelectedWorkflow(result.workflow);
      setWorkflows(prev => prev.map(w => w._id === selectedWorkflow._id ? result.workflow : w));
    } catch (error: any) {
      console.error('WorkflowManagement: Error updating form field:', error);
      throw error;
    }
  };

  const handleRemoveFormField = async (fieldId: string) => {
    console.log('WorkflowManagement: Removing form field:', fieldId);
    if (!selectedWorkflow || !selectedStep) return;

    try {
      const result = await removeFormField(selectedWorkflow._id, selectedStep._id, fieldId);
      setSelectedWorkflow(result.workflow);
      setWorkflows(prev => prev.map(w => w._id === selectedWorkflow._id ? result.workflow : w));
    } catch (error: any) {
      console.error('WorkflowManagement: Error removing form field:', error);
      throw error;
    }
  };

  const handleAddAutomationRule = async (rule: AutomationRule) => {
    console.log('WorkflowManagement: Adding automation rule to step');
    if (!selectedWorkflow || !selectedStep) return;

    try {
      const result = await addAutomationRule(selectedWorkflow._id, selectedStep._id, rule);
      setSelectedWorkflow(result.workflow);
      setWorkflows(prev => prev.map(w => w._id === selectedWorkflow._id ? result.workflow : w));
    } catch (error: any) {
      console.error('WorkflowManagement: Error adding automation rule:', error);
      throw error;
    }
  };

  const handleUpdateAutomationRule = async (ruleId: string, updates: Partial<AutomationRule>) => {
    console.log('WorkflowManagement: Updating automation rule:', ruleId);
    if (!selectedWorkflow || !selectedStep) return;

    try {
      const result = await updateAutomationRule(selectedWorkflow._id, selectedStep._id, ruleId, updates);
      setSelectedWorkflow(result.workflow);
      setWorkflows(prev => prev.map(w => w._id === selectedWorkflow._id ? result.workflow : w));
    } catch (error: any) {
      console.error('WorkflowManagement: Error updating automation rule:', error);
      throw error;
    }
  };

  const handleRemoveAutomationRule = async (ruleId: string) => {
    console.log('WorkflowManagement: Removing automation rule:', ruleId);
    if (!selectedWorkflow || !selectedStep) return;

    try {
      const result = await removeAutomationRule(selectedWorkflow._id, selectedStep._id, ruleId);
      setSelectedWorkflow(result.workflow);
      setWorkflows(prev => prev.map(w => w._id === selectedWorkflow._id ? result.workflow : w));
    } catch (error: any) {
      console.error('WorkflowManagement: Error removing automation rule:', error);
      throw error;
    }
  };

  // Helper functions
  const resetWorkflowForm = () => {
    console.log('WorkflowManagement: Resetting workflow form');
    setWorkflowForm({
      name: '',
      description: '',
      deviceTypes: [],
      serviceTypes: [],
      isActive: true,
      steps: [],
      workflowSettings: {
        allowParallelSteps: false,
        requireStrictOrder: true,
        autoProgressOnCompletion: false
      }
    });
  };

  const resetAddOnForm = () => {
    console.log('WorkflowManagement: Resetting add-on form');
    setAddOnForm({
      addOnServiceId: '',
      optimalTiming: 'during_repair',
      dependencies: [],
      estimatedTime: 30,
      instructions: '',
      qualityChecks: []
    });
  };

  const openEditDialog = (workflow: WorkflowTemplate) => {
    console.log('WorkflowManagement: Opening edit dialog for workflow:', workflow.name);
    setSelectedWorkflow(workflow);
    setWorkflowForm({
      name: workflow.name,
      description: workflow.description,
      deviceTypes: workflow.deviceTypes,
      serviceTypes: workflow.serviceTypes,
      isActive: workflow.isActive,
      steps: workflow.steps,
      workflowSettings: workflow.workflowSettings || {
        allowParallelSteps: false,
        requireStrictOrder: true,
        autoProgressOnCompletion: false
      }
    });
    setShowEditDialog(true);
  };

  const openVisualBuilder = (workflow: WorkflowTemplate) => {
    console.log('WorkflowManagement: Opening visual builder for workflow:', workflow.name);
    setSelectedWorkflow(workflow);
    setShowVisualBuilder(true);
  };

  const openViewDialog = (workflow: WorkflowTemplate) => {
    console.log('WorkflowManagement: Opening view dialog for workflow:', workflow.name);
    setSelectedWorkflow(workflow);
    setShowViewDialog(true);
  };

  // Filter workflows
  const filteredWorkflows = workflows.filter(workflow => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         workflow.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterActive === undefined || workflow.isActive === filterActive;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workflow Management</h1>
          <p className="text-muted-foreground">
            Create and manage repair workflows with interactive steps and automation
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Workflow
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeWorkflows || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Steps</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSteps || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Automation Rules</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAutomationRules || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageCompletionTime || 0}m</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="workflows" className="space-y-4">
        <TabsList>
          <TabsTrigger value="workflows">Workflow Templates</TabsTrigger>
          <TabsTrigger value="addons">Add-On Integration</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-4">
          {/* Search and Filter */}
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search workflows..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={filterActive?.toString() || 'all'} onValueChange={(value) => 
              setFilterActive(value === 'all' ? undefined : value === 'true')
            }>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Workflows List */}
          <div className="grid gap-4">
            {filteredWorkflows.map((workflow) => (
              <Card key={workflow._id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        {workflow.name}
                        <Badge variant={workflow.isActive ? 'default' : 'secondary'}>
                          {workflow.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{workflow.description}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openViewDialog(workflow)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(workflow)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openVisualBuilder(workflow)}
                      >
                        <Move className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicateWorkflow(workflow._id)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteWorkflow(workflow._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{workflow.steps.length} steps</span>
                    <span>{workflow.estimatedTotalTime || 0} minutes</span>
                    <span>{workflow.deviceTypes.length} device types</span>
                    <span>{workflow.serviceTypes.length} service types</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="addons" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Add-On Workflows</h3>
            <Button onClick={() => setShowAddOnDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Add-On Workflow
            </Button>
          </div>

          <div className="grid gap-4">
            {addOnWorkflows.map((addOnWorkflow) => (
              <Card key={addOnWorkflow._id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{addOnWorkflow.addOnServiceName}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Optimal timing: {addOnWorkflow.optimalTiming.replace('_', ' ')}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{addOnWorkflow.estimatedTime} minutes</span>
                    <span>{addOnWorkflow.dependencies.length} dependencies</span>
                    <span>{addOnWorkflow.qualityChecks.length} quality checks</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Workflow Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
            <DialogDescription>
              Create a new workflow template with steps and automation rules
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Workflow Name *</Label>
                <Input
                  id="name"
                  value={workflowForm.name}
                  onChange={(e) => setWorkflowForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter workflow name"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={workflowForm.isActive}
                    onCheckedChange={(checked) => setWorkflowForm(prev => ({ ...prev, isActive: checked }))}
                  />
                  <Label>Active</Label>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={workflowForm.description}
                onChange={(e) => setWorkflowForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter workflow description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Device Types *</Label>
                <Select onValueChange={(value) => {
                  if (!workflowForm.deviceTypes.includes(value)) {
                    setWorkflowForm(prev => ({
                      ...prev,
                      deviceTypes: [...prev.deviceTypes, value]
                    }));
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select device types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smartphone">Smartphone</SelectItem>
                    <SelectItem value="tablet">Tablet</SelectItem>
                    <SelectItem value="laptop">Laptop</SelectItem>
                    <SelectItem value="desktop">Desktop</SelectItem>
                    <SelectItem value="smartwatch">Smartwatch</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-1">
                  {workflowForm.deviceTypes.map((type) => (
                    <Badge key={type} variant="secondary" className="cursor-pointer" onClick={() => {
                      setWorkflowForm(prev => ({
                        ...prev,
                        deviceTypes: prev.deviceTypes.filter(t => t !== type)
                      }));
                    }}>
                      {type} ×
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Service Types *</Label>
                <Select onValueChange={(value) => {
                  if (!workflowForm.serviceTypes.includes(value)) {
                    setWorkflowForm(prev => ({
                      ...prev,
                      serviceTypes: [...prev.serviceTypes, value]
                    }));
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select service types" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service._id} value={service._id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-1">
                  {workflowForm.serviceTypes.map((typeId) => {
                    const service = services.find(s => s._id === typeId);
                    return service ? (
                      <Badge key={typeId} variant="secondary" className="cursor-pointer" onClick={() => {
                        setWorkflowForm(prev => ({
                          ...prev,
                          serviceTypes: prev.serviceTypes.filter(t => t !== typeId)
                        }));
                      }}>
                        {service.name} ×
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateWorkflow}>
              Create Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Workflow Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Workflow</DialogTitle>
            <DialogDescription>
              Update workflow template properties
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Workflow Name *</Label>
                <Input
                  id="edit-name"
                  value={workflowForm.name}
                  onChange={(e) => setWorkflowForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter workflow name"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={workflowForm.isActive}
                    onCheckedChange={(checked) => setWorkflowForm(prev => ({ ...prev, isActive: checked }))}
                  />
                  <Label>Active</Label>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description *</Label>
              <Textarea
                id="edit-description"
                value={workflowForm.description}
                onChange={(e) => setWorkflowForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter workflow description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateWorkflow}>
              Update Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Workflow Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedWorkflow?.name}</DialogTitle>
            <DialogDescription>
              Workflow template details and steps
            </DialogDescription>
          </DialogHeader>
          {selectedWorkflow && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Description</Label>
                  <p className="text-sm">{selectedWorkflow.description}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge variant={selectedWorkflow.isActive ? 'default' : 'secondary'}>
                    {selectedWorkflow.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Steps</Label>
                  <p className="text-sm font-medium">{selectedWorkflow.steps.length}</p>
                </div>
                <div>
                  <Label>Estimated Time</Label>
                  <p className="text-sm font-medium">{selectedWorkflow.estimatedTotalTime || 0} minutes</p>
                </div>
                <div>
                  <Label>Device Types</Label>
                  <p className="text-sm font-medium">{selectedWorkflow.deviceTypes.length}</p>
                </div>
              </div>
              <div>
                <Label>Steps</Label>
                <div className="space-y-2 mt-2">
                  {selectedWorkflow.steps.map((step, index) => (
                    <Card key={step._id}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{step.name}</h4>
                            <p className="text-sm text-muted-foreground">{step.description}</p>
                          </div>
                          <div className="text-right">
                            <Badge>{step.category}</Badge>
                            <p className="text-sm text-muted-foreground mt-1">{step.estimatedTime}m</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add-On Workflow Dialog */}
      <Dialog open={showAddOnDialog} onOpenChange={setShowAddOnDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Add-On Workflow</DialogTitle>
            <DialogDescription>
              Create a workflow for add-on service integration
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Add-On Service *</Label>
              <Select
                value={addOnForm.addOnServiceId}
                onValueChange={(value) => setAddOnForm(prev => ({ ...prev, addOnServiceId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select add-on service" />
                </SelectTrigger>
                <SelectContent>
                  {addOnServices.map((service) => (
                    <SelectItem key={service._id} value={service._id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Optimal Timing</Label>
                <Select
                  value={addOnForm.optimalTiming}
                  onValueChange={(value: any) => setAddOnForm(prev => ({ ...prev, optimalTiming: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="before_repair">Before Repair</SelectItem>
                    <SelectItem value="during_repair">During Repair</SelectItem>
                    <SelectItem value="after_repair">After Repair</SelectItem>
                    <SelectItem value="flexible">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estimated Time (minutes)</Label>
                <Input
                  type="number"
                  value={addOnForm.estimatedTime}
                  onChange={(e) => setAddOnForm(prev => ({ ...prev, estimatedTime: parseInt(e.target.value) || 0 }))}
                  min="1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Instructions</Label>
              <Textarea
                value={addOnForm.instructions}
                onChange={(e) => setAddOnForm(prev => ({ ...prev, instructions: e.target.value }))}
                placeholder="Enter detailed instructions"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddOnDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAddOnWorkflow}>
              Create Add-On Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visual Builder */}
      {showVisualBuilder && selectedWorkflow && (
        <Dialog open={showVisualBuilder} onOpenChange={setShowVisualBuilder}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
            <VisualBuilder
              workflow={selectedWorkflow}
              onSave={async (updatedWorkflow) => {
                console.log('WorkflowManagement: Saving workflow from visual builder');
                try {
                  const result = await updateWorkflowTemplate(selectedWorkflow._id, updatedWorkflow);
                  setWorkflows(prev => prev.map(w => w._id === selectedWorkflow._id ? result.workflow : w));
                  setShowVisualBuilder(false);
                  setSelectedWorkflow(null);
                  
                  toast({
                    title: 'Success',
                    description: 'Workflow saved successfully'
                  });
                } catch (error: any) {
                  console.error('WorkflowManagement: Error saving workflow from visual builder:', error);
                  toast({
                    title: 'Error',
                    description: error.message || 'Failed to save workflow',
                    variant: 'destructive'
                  });
                }
              }}
              onClose={() => {
                console.log('WorkflowManagement: Closing visual builder');
                setShowVisualBuilder(false);
                setSelectedWorkflow(null);
              }}
              services={services}
              addOnServices={addOnServices}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Step Form Dialog */}
      <StepFormDialog
        open={showStepDialog}
        onOpenChange={setShowStepDialog}
        step={selectedStep}
        onSave={handleSaveStep}
        mode={selectedStep?._id?.startsWith('temp_') ? 'create' : 'edit'}
        existingSteps={selectedWorkflow?.steps || []}
      />

      {/* Step Management Dialog */}
      <StepManagementDialog
        open={showStepManagementDialog}
        onOpenChange={setShowStepManagementDialog}
        step={selectedStep}
        onSave={handleSaveStep}
        onAddFormField={handleAddFormFieldToStep}
        onUpdateFormField={handleUpdateFormField}
        onRemoveFormField={handleRemoveFormField}
        onAddAutomationRule={handleAddAutomationRule}
        onUpdateAutomationRule={handleUpdateAutomationRule}
        onRemoveAutomationRule={handleRemoveAutomationRule}
        isNew={selectedStep?._id?.startsWith('temp_')}
      />
    </div>
  );
}