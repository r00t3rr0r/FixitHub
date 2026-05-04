import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/useToast";
import { VisualBuilder } from "@/components/workflow/VisualBuilder";
import {
  getWorkflowTemplates,
  createWorkflowTemplate,
  updateWorkflowTemplate,
  deleteWorkflowTemplate,
  duplicateWorkflowTemplate,
  getAddOnWorkflows,
  getWorkflowStats,
  WorkflowTemplate
} from "@/api/workflow";
import { getServices } from "@/api/services";
import { getAddOnServices } from "@/api/services";
import {
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Copy,
  Move,
  Settings,
  Clock,
  Zap,
  FormInput,
  CheckCircle,
  AlertTriangle,
  Users,
  BarChart3,
  Activity,
  TrendingUp,
  Calendar,
  FileText,
  Workflow
} from "lucide-react";

export function WorkflowManagement() {
  console.log('WorkflowManagement: Component initialized');

  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
  const [addOnWorkflows, setAddOnWorkflows] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [addOnServices, setAddOnServices] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showVisualBuilder, setShowVisualBuilder] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    deviceTypes: [] as string[],
    serviceTypes: [] as string[],
    isActive: true,
    estimatedTotalTime: 0
  });

  const deviceTypeOptions = [
    'Smartphone',
    'Tablet', 
    'Laptop',
    'Desktop',
    'Smart Watch',
    'Headphones',
    'Camera'
  ];

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

      console.log('WorkflowManagement: Raw API responses:', {
        workflowsRes,
        addOnServicesRes
      });

      console.log('WorkflowManagement: Data loaded successfully:', {
        workflowsCount: workflowsRes.workflows?.length || 0,
        addOnWorkflowsCount: addOnWorkflowsRes.addOnWorkflows?.length || 0,
        servicesCount: servicesRes.services?.length || 0,
        addOnServicesCount: addOnServicesRes.addOns?.length || addOnServicesRes.services?.length || 0
      });

      setWorkflows(workflowsRes.workflows || []);
      setAddOnWorkflows(addOnWorkflowsRes.addOnWorkflows || []);
      setServices(servicesRes.services || []);
      // Fix: Use addOns property instead of services for add-on services
      setAddOnServices(addOnServicesRes.addOns || addOnServicesRes.services || []);
      setStats(statsRes.stats || {});
    } catch (error: any) {
      console.error('WorkflowManagement: Error loading data:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('workflowManagement.failedToLoadWorkflows'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkflows = workflows.filter(workflow => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         workflow.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && workflow.isActive) ||
                         (filterStatus === 'inactive' && !workflow.isActive);
    return matchesSearch && matchesStatus;
  });

  const handleCreateWorkflow = async () => {
    console.log('WorkflowManagement: Creating new workflow');
    try {
      const result = await createWorkflowTemplate(formData);
      setWorkflows(prev => [result.workflow, ...prev]);
      setShowCreateDialog(false);
      resetForm();
      toast({
        title: t('common.success'),
        description: t('workflowManagement.workflowCreatedSuccess')
      });
    } catch (error: any) {
      console.error('WorkflowManagement: Error creating workflow:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('workflowManagement.failedToCreateWorkflow'),
        variant: 'destructive'
      });
    }
  };

  const handleUpdateWorkflow = async () => {
    console.log('WorkflowManagement: Updating workflow');
    if (!selectedWorkflow) return;

    try {
      const result = await updateWorkflowTemplate(selectedWorkflow._id, formData);
      setWorkflows(prev => prev.map(w => w._id === selectedWorkflow._id ? result.workflow : w));
      setShowEditDialog(false);
      setSelectedWorkflow(null);
      resetForm();
      toast({
        title: t('common.success'),
        description: t('workflowManagement.workflowUpdated')
      });
    } catch (error: any) {
      console.error('WorkflowManagement: Error updating workflow:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('workflowManagement.failedToUpdateWorkflow'),
        variant: 'destructive'
      });
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    console.log('WorkflowManagement: Deleting workflow:', workflowId);
    if (!confirm(t('workflowManagement.confirmDelete'))) return;

    try {
      await deleteWorkflowTemplate(workflowId);
      setWorkflows(prev => prev.filter(w => w._id !== workflowId));
      toast({
        title: t('common.success'),
        description: t('workflowManagement.workflowDeleted')
      });
    } catch (error: any) {
      console.error('WorkflowManagement: Error deleting workflow:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('workflowManagement.failedToDeleteWorkflow'),
        variant: 'destructive'
      });
    }
  };

  const handleDuplicateWorkflow = async (workflowId: string) => {
    console.log('WorkflowManagement: Duplicating workflow:', workflowId);
    try {
      const result = await duplicateWorkflowTemplate(workflowId);
      setWorkflows(prev => [result.workflow, ...prev]);
      toast({
        title: t('common.success'),
        description: t('workflowManagement.workflowDuplicated')
      });
    } catch (error: any) {
      console.error('WorkflowManagement: Error duplicating workflow:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('workflowManagement.failedToDuplicateWorkflow'),
        variant: 'destructive'
      });
    }
  };

  const openCreateDialog = () => {
    console.log('WorkflowManagement: Opening create dialog');
    resetForm();
    setShowCreateDialog(true);
  };

  const openEditDialog = (workflow: WorkflowTemplate) => {
    console.log('WorkflowManagement: Opening edit dialog for:', workflow.name);
    setSelectedWorkflow(workflow);
    setFormData({
      name: workflow.name,
      description: workflow.description,
      deviceTypes: workflow.deviceTypes || [],
      serviceTypes: workflow.serviceTypes || [],
      isActive: workflow.isActive
    });
    setShowEditDialog(true);
  };

  const openViewDialog = (workflow: WorkflowTemplate) => {
    console.log('WorkflowManagement: Opening view dialog for:', workflow.name);
    setSelectedWorkflow(workflow);
    setShowViewDialog(true);
  };

  const openVisualBuilder = (workflow: WorkflowTemplate) => {
    console.log('WorkflowManagement: Opening visual builder for:', workflow.name);
    setSelectedWorkflow(workflow);
    setShowVisualBuilder(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      deviceTypes: [],
      serviceTypes: [],
      isActive: true
    });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div
        className="flex items-center justify-between rounded-lg px-4 py-3"
        style={{ background: 'linear-gradient(180deg, #1a2a5e 0%, #0f1d45 100%)' }}
      >
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">{t('workflowManagement.pageHeading')}</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {t('workflowManagement.description')}
          </p>
        </div>
        <Button onClick={openCreateDialog} size="sm" variant="secondary" className="h-7 text-xs px-2">
          <Plus className="h-3 w-3 mr-1" />
          {t('workflowManagement.createNewWorkflow')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2 px-3">
            <CardTitle className="text-xs font-medium">{t('workflowManagement.stats.activeWorkflows')}</CardTitle>
            <Activity className="h-3 w-3 text-muted-foreground" />
          </CardHeader>
          <CardContent className="py-1 px-3">
            <div className="text-lg font-bold">{stats.activeWorkflows || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats.inactiveWorkflows || 0} {t('workflowManagement.inactiveStatus')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2 px-3">
            <CardTitle className="text-xs font-medium">{t('workflowManagement.stats.totalSteps')}</CardTitle>
            <Settings className="h-3 w-3 text-muted-foreground" />
          </CardHeader>
          <CardContent className="py-1 px-3">
            <div className="text-lg font-bold">{stats.totalSteps || 0}</div>
            <p className="text-xs text-muted-foreground">
              {t('workflowManagement.stats.acrossAllWorkflows')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2 px-3">
            <CardTitle className="text-xs font-medium">{t('workflowManagement.stats.automationRules')}</CardTitle>
            <Zap className="h-3 w-3 text-muted-foreground" />
          </CardHeader>
          <CardContent className="py-1 px-3">
            <div className="text-lg font-bold">{stats.totalAutomationRules || 0}</div>
            <p className="text-xs text-muted-foreground">
              {t('workflowManagement.stats.activeAutomations')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2 px-3">
            <CardTitle className="text-xs font-medium">{t('workflowManagement.stats.averageCompletionTime')}</CardTitle>
            <Clock className="h-3 w-3 text-muted-foreground" />
          </CardHeader>
          <CardContent className="py-1 px-3">
            <div className="text-lg font-bold">{stats.averageCompletionTime || 0}m</div>
            <p className="text-xs text-muted-foreground">
              {t('workflowManagement.stats.estimatedTime')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-2">
        <div className="flex-1 max-w-xs">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder={t('workflowManagement.searchWorkflows')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 h-7 text-xs"
            />
          </div>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px] h-7 text-xs">
            <SelectValue placeholder={t('workflowManagement.filterByStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">{t('workflowManagement.allWorkflows')}</SelectItem>
            <SelectItem value="active" className="text-xs">{t('workflowManagement.activeStatus')}</SelectItem>
            <SelectItem value="inactive" className="text-xs">{t('workflowManagement.inactiveStatus')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Workflows List */}
      <div className="grid gap-2">
        {filteredWorkflows.map((workflow) => {
          console.log('WorkflowManagement: Rendering workflow:', {
            id: workflow._id,
            name: workflow.name,
            hasSteps: !!workflow.steps,
            stepsLength: workflow.steps?.length || 0,
            hasDeviceTypes: !!workflow.deviceTypes,
            deviceTypesLength: workflow.deviceTypes?.length || 0,
            hasServiceTypes: !!workflow.serviceTypes,
            serviceTypesLength: workflow.serviceTypes?.length || 0,
          });

          return (
            <Card key={workflow._id}>
              <CardHeader className="py-2 px-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      {workflow.name}
                      <Badge variant={workflow.isActive ? 'default' : 'secondary'} className="text-xs h-4 px-1">
                        {workflow.isActive ? t('workflowManagement.activeStatus') : t('workflowManagement.inactiveStatus')}
                      </Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{workflow.description}</p>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => openViewDialog(workflow)}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => openEditDialog(workflow)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => openVisualBuilder(workflow)}
                      title="Visual Builder"
                    >
                      <Move className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleDuplicateWorkflow(workflow._id)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleDeleteWorkflow(workflow._id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="py-3 px-4 lg:px-5">
                <div className="space-y-2">
                  {/* Basic Statistics Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <Settings className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{workflow.steps?.length || 0}</span>
                      <span className="text-muted-foreground">{t('workflowManagement.labels.steps')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{workflow.estimatedTotalTime || 0}</span>
                      <span className="text-muted-foreground">{t('workflowManagement.labels.minutes')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FormInput className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">
                        {workflow.steps?.reduce((total, step) => total + (step.formFields?.length || 0), 0) || 0}
                      </span>
                      <span className="text-muted-foreground">{t('workflowManagement.labels.formFields')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">
                        {workflow.steps?.reduce((total, step) => total + (step.automationRules?.length || 0), 0) || 0}
                      </span>
                      <span className="text-muted-foreground">{t('workflowManagement.labels.automationRules')}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {/* Context: where this workflow can be used */}
                    {(workflow.deviceTypes?.length > 0 || workflow.serviceTypes?.length > 0) && (
                      <div className="rounded-lg border bg-background p-3 space-y-2 min-w-0">
                        {workflow.deviceTypes && workflow.deviceTypes.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-sm font-medium">{t('workflowManagement.workflowDetails.deviceTypes')}:</span>
                            <div className="flex flex-wrap gap-1">
                              {workflow.deviceTypes.map((type) => (
                                <Badge key={type} variant="outline" className="text-xs">
                                  {type}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {workflow.serviceTypes && workflow.serviceTypes.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-sm font-medium">{t('workflowManagement.workflowDetails.serviceTypes')}:</span>
                            <div className="flex flex-wrap gap-1">
                              {workflow.serviceTypes.map((typeId) => {
                                const service = services.find(s => s._id === typeId);
                                return service ? (
                                  <Badge key={typeId} variant="outline" className="text-xs">
                                    {service.name}
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Structure: categories and quick step preview */}
                    {workflow.steps && workflow.steps.length > 0 && (
                      <div className="rounded-lg border bg-background p-3 space-y-2 min-w-0">
                        <div className="space-y-1.5">
                          <span className="text-sm font-medium">{t('workflowManagement.workflowDetails.stepCategories')}:</span>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(
                              workflow.steps.reduce((acc, step) => {
                                acc[step.category] = (acc[step.category] || 0) + 1;
                                return acc;
                              }, {} as Record<string, number>)
                            ).map(([category, count]) => (
                              <Badge key={category} variant="secondary" className="text-xs">
                                {category}: {count}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-sm font-medium">{t('workflowManagement.workflowDetails.stepOverview')}:</span>
                          <div className="space-y-1 max-h-36 overflow-y-auto">
                            {workflow.steps.slice(0, 3).map((step, index) => (
                              <div key={step._id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Badge variant="outline" className="text-xs shrink-0">
                                    {index + 1}
                                  </Badge>
                                  <span className="font-medium truncate">{step.name}</span>
                                  <Badge className={`text-xs shrink-0 ${getCategoryColor(step.category)}`}>
                                    {step.category}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                                  <span>{step.estimatedTime}m</span>
                                  {step.formFields?.length > 0 && (
                                    <span className="flex items-center gap-1">
                                      <FormInput className="h-3 w-3" />
                                      {step.formFields.length}
                                    </span>
                                  )}
                                  {step.automationRules?.length > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Zap className="h-3 w-3" />
                                      {step.automationRules.length}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                            {workflow.steps.length > 3 && (
                              <div className="text-xs text-muted-foreground text-center py-1">
                                {t('workflowManagement.workflowDetails.moreSteps', { count: workflow.steps.length - 3 })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Interactive nested elements: full-width and grouped by purpose */}
                  {workflow.steps && workflow.steps.some(step => step.formFields?.length > 0 || step.automationRules?.length > 0) && (
                    <div className="bg-muted/50 rounded-lg p-3.5 space-y-3 w-full">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <FormInput className="h-4 w-4" />
                        {t('workflowManagement.workflowDetails.interactiveElements')}
                      </h4>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                        {/* Input-related nested elements */}
                        {workflow.steps.some(step => step.formFields?.length > 0) && (
                          <div className="rounded-md border bg-background p-2.5">
                            <span className="font-medium">{t('workflowManagement.workflowDetails.formFieldTypes')}:</span>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {Object.entries(
                                workflow.steps.reduce((acc, step) => {
                                  step.formFields?.forEach(field => {
                                    acc[field.type] = (acc[field.type] || 0) + 1;
                                  });
                                  return acc;
                                }, {} as Record<string, number>)
                              ).map(([type, count]) => (
                                <Badge key={type} variant="outline" className="text-xs">
                                  {type}: {count}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Automation-related nested elements */}
                        {workflow.steps.some(step => step.automationRules?.length > 0) && (
                          <div className="rounded-md border bg-background p-2.5">
                            <span className="font-medium">{t('workflowManagement.workflowDetails.automationTriggers')}:</span>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {Object.entries(
                                workflow.steps.reduce((acc, step) => {
                                  step.automationRules?.forEach(rule => {
                                    acc[rule.trigger] = (acc[rule.trigger] || 0) + 1;
                                  });
                                  return acc;
                                }, {} as Record<string, number>)
                              ).map(([trigger, count]) => (
                                <Badge key={trigger} variant="outline" className="text-xs">
                                  {trigger.replace('_', ' ')}: {count}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Workflow Settings */}
                  {workflow.workflowSettings && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      {workflow.workflowSettings.allowParallelSteps && (
                        <Badge variant="secondary" className="text-xs">
                          {t('workflowManagement.workflowDetails.parallelStepsAllowed')}
                        </Badge>
                      )}
                      {workflow.workflowSettings.requireStrictOrder && (
                        <Badge variant="secondary" className="text-xs">
                          {t('workflowManagement.workflowDetails.strictOrderRequired')}
                        </Badge>
                      )}
                      {workflow.workflowSettings.autoProgressOnCompletion && (
                        <Badge variant="secondary" className="text-xs">
                          {t('workflowManagement.workflowDetails.autoProgress')}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Fallback for workflows without detailed data */}
                  {(!workflow.steps || workflow.steps.length === 0) && (!workflow.deviceTypes || workflow.deviceTypes.length === 0) && (
                    <div className="text-center py-4 text-muted-foreground">
                      <p className="text-sm">{t('workflowManagement.workflowDetails.noDetailedData')}</p>
                      <p className="text-xs">{t('workflowManagement.workflowDetails.useVisualBuilder')}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create Workflow Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-xl p-0 overflow-hidden">
          <DialogHeader
            className="px-4 py-3"
            style={{ background: 'linear-gradient(180deg, #1a2a5e 0%, #0f1d45 100%)' }}
          >
            <DialogTitle className="text-sm font-semibold text-white">{t('workflowManagement.dialogs.createWorkflowTitle')}</DialogTitle>
            <DialogDescription className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {t('workflowManagement.dialogs.createWorkflowDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="name" className="text-xs">{t('workflowManagement.labels.workflowName')}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('workflowManagement.labels.workflowName')}
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="active" className="text-xs">{t('workflowManagement.labels.workflowStatus')}</Label>
                <div className="flex items-center space-x-2 pt-1">
                  <Switch
                    id="active"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                  />
                  <Label htmlFor="active" className="text-xs">{formData.isActive ? t('workflowManagement.activeStatus') : t('workflowManagement.inactiveStatus')}</Label>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="description" className="text-xs">{t('workflowManagement.labels.description')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t('workflowManagement.labels.description')}
                rows={2}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('workflowManagement.workflowDetails.deviceTypes')}</Label>
              <div className="grid grid-cols-3 gap-1">
                {deviceTypeOptions.map((type) => (
                  <div key={type} className="flex items-center space-x-1">
                    <input
                      type="checkbox"
                      id={type}
                      checked={formData.deviceTypes.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData(prev => ({ ...prev, deviceTypes: [...prev.deviceTypes, type] }));
                        } else {
                          setFormData(prev => ({ ...prev, deviceTypes: prev.deviceTypes.filter(t => t !== type) }));
                        }
                      }}
                    />
                    <Label htmlFor={type} className="text-xs">{type}</Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('workflowManagement.workflowDetails.serviceTypes')}</Label>
              <div className="grid grid-cols-2 gap-1 max-h-24 overflow-y-auto">
                {services.map((service) => (
                  <div key={service._id} className="flex items-center space-x-1">
                    <input
                      type="checkbox"
                      id={service._id}
                      checked={formData.serviceTypes.includes(service._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData(prev => ({ ...prev, serviceTypes: [...prev.serviceTypes, service._id] }));
                        } else {
                          setFormData(prev => ({ ...prev, serviceTypes: prev.serviceTypes.filter(t => t !== service._id) }));
                        }
                      }}
                    />
                    <Label htmlFor={service._id} className="text-xs">{service.name}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="px-4 py-2 border-t">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowCreateDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleCreateWorkflow}>
              {t('workflowManagement.createNewWorkflow')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Workflow Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-xl p-0 overflow-hidden">
          <DialogHeader
            className="px-4 py-3"
            style={{ background: 'linear-gradient(180deg, #1a2a5e 0%, #0f1d45 100%)' }}
          >
            <DialogTitle className="text-sm font-semibold text-white">{t("workflowManagement.dialogs.editWorkflowTitle")}</DialogTitle>
            <DialogDescription className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>{t("workflowManagement.dialogs.editWorkflowDesc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-name" className="text-xs">{t('workflowManagement.labels.workflowName')}</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('workflowManagement.labels.workflowName')}
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-active" className="text-xs">{t('workflowManagement.labels.workflowStatus')}</Label>
                <div className="flex items-center space-x-2 pt-1">
                  <Switch
                    id="edit-active"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                  />
                  <Label htmlFor="edit-active" className="text-xs">{formData.isActive ? t('workflowManagement.activeStatus') : t('workflowManagement.inactiveStatus')}</Label>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-description" className="text-xs">{t('workflowManagement.labels.description')}</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter workflow description"
                rows={2}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('workflowManagement.workflowDetails.deviceTypes')}</Label>
              <div className="grid grid-cols-3 gap-1">
                {deviceTypeOptions.map((type) => (
                  <div key={type} className="flex items-center space-x-1">
                    <input
                      type="checkbox"
                      id={`edit-${type}`}
                      checked={formData.deviceTypes.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData(prev => ({ ...prev, deviceTypes: [...prev.deviceTypes, type] }));
                        } else {
                          setFormData(prev => ({ ...prev, deviceTypes: prev.deviceTypes.filter(t => t !== type) }));
                        }
                      }}
                    />
                    <Label htmlFor={`edit-${type}`} className="text-xs">{type}</Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('workflowManagement.workflowDetails.serviceTypes')}</Label>
              <div className="grid grid-cols-2 gap-1 max-h-24 overflow-y-auto">
                {services.map((service) => (
                  <div key={service._id} className="flex items-center space-x-1">
                    <input
                      type="checkbox"
                      id={`edit-${service._id}`}
                      checked={formData.serviceTypes.includes(service._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData(prev => ({ ...prev, serviceTypes: [...prev.serviceTypes, service._id] }));
                        } else {
                          setFormData(prev => ({ ...prev, serviceTypes: prev.serviceTypes.filter(t => t !== service._id) }));
                        }
                      }}
                    />
                    <Label htmlFor={`edit-${service._id}`} className="text-xs">{service.name}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="px-4 py-2 border-t">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowEditDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleUpdateWorkflow}>
              {t('workflowManagement.buttons.update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Workflow Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader
            className="px-4 py-3 flex-shrink-0"
            style={{ background: 'linear-gradient(180deg, #1a2a5e 0%, #0f1d45 100%)' }}
          >
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-white">
              {selectedWorkflow?.name}
              <Badge variant={selectedWorkflow?.isActive ? 'default' : 'secondary'} className="text-xs h-4 px-1">
                {selectedWorkflow?.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>{t("workflowManagement.dialogs.viewWorkflowDesc")}</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
          {selectedWorkflow && (
            <div className="space-y-3 p-4">
              <div>
                <h3 className="text-xs font-semibold mb-1">{t('workflowManagement.labels.description')}</h3>
                <p className="text-xs text-muted-foreground">{selectedWorkflow.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <h3 className="text-xs font-semibold mb-1">{t('workflowManagement.workflowDetails.deviceTypes')}</h3>
                  <div className="flex flex-wrap gap-1">
                    {selectedWorkflow.deviceTypes?.map((type) => (
                      <Badge key={type} variant="outline" className="text-xs h-4 px-1">{type}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold mb-1">{t('workflowManagement.workflowDetails.serviceTypes')}</h3>
                  <div className="flex flex-wrap gap-1">
                    {selectedWorkflow.serviceTypes?.map((typeId) => {
                      const service = services.find(s => s._id === typeId);
                      return service ? (
                        <Badge key={typeId} variant="outline" className="text-xs h-4 px-1">{service.name}</Badge>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>

              {selectedWorkflow.steps && selectedWorkflow.steps.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold mb-2">{t('workflowManagement.dialogs.workflowStepsCount', { count: selectedWorkflow.steps.length })}</h3>
                  <div className="space-y-2">
                    {selectedWorkflow.steps.map((step, index) => (
                      <Card key={step._id}>
                        <CardContent className="p-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-1 mb-1">
                                <Badge variant="outline" className="text-xs h-4 px-1">Step {index + 1}</Badge>
                                <Badge className={`text-xs h-4 px-1 ${getCategoryColor(step.category)}`}>
                                  {step.category}
                                </Badge>
                                {step.isRequired && (
                                  <Badge variant="destructive" className="text-xs h-4 px-1">Required</Badge>
                                )}
                              </div>
                              <h4 className="text-xs font-semibold">{step.name}</h4>
                              <p className="text-xs text-muted-foreground">{step.description}</p>
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {step.estimatedTime} min
                              </div>
                            </div>
                          </div>

                          {/* Step Details */}
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            {step.formFields && step.formFields.length > 0 && (
                              <div>
                                <span className="font-medium">Form Fields ({step.formFields.length}):</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {step.formFields.map((field) => (
                                    <Badge key={field.id} variant="outline" className="text-xs">
                                      {field.label} ({field.type})
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {step.automationRules && step.automationRules.length > 0 && (
                              <div>
                                <span className="font-medium">Automation Rules ({step.automationRules.length}):</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {step.automationRules.map((rule, ruleIndex) => (
                                    <Badge key={ruleIndex} variant="outline" className="text-xs">
                                      {rule.trigger} → {rule.action}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {step.checklistItems && step.checklistItems.length > 0 && (
                            <div className="mt-3">
                              <span className="text-xs font-medium">Checklist Items:</span>
                              <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                                {step.checklistItems.map((item, itemIndex) => (
                                  <li key={itemIndex} className="flex items-center gap-2">
                                    <CheckCircle className="h-3 w-3" />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
          <DialogFooter className="px-4 py-2 border-t flex-shrink-0">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowViewDialog(false)}>
              {t('common.close')}
            </Button>
            {selectedWorkflow && (
              <Button size="sm" className="h-7 text-xs" onClick={() => openVisualBuilder(selectedWorkflow)}>
                <Move className="h-3 w-3 mr-1" />
                {t('workflowManagement.buttons.openVisualBuilder')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visual Builder */}
      {showVisualBuilder && selectedWorkflow && (
        <Dialog open={showVisualBuilder} onOpenChange={setShowVisualBuilder}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
            <DialogHeader className="sr-only">
              <DialogTitle>Visual Workflow Builder</DialogTitle>
              <DialogDescription>
                Visual interface for building and editing workflow steps with interactive elements
              </DialogDescription>
            </DialogHeader>
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
    </div>
  );
}