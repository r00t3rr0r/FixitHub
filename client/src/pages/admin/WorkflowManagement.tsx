import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/useToast"
import {
  getWorkflowTemplates,
  getAddOnWorkflows,
  createWorkflowTemplate,
  updateWorkflowTemplate,
  deleteWorkflowTemplate,
  createAddOnWorkflow,
  updateAddOnWorkflow,
  getWorkflowTemplateById,
  WorkflowTemplate,
  AddOnWorkflow,
  WorkflowStep
} from "@/api/workflow"
import { getServices } from "@/api/services"
import { getAddOnServices } from "@/api/services"
import {
  Wrench,
  Search,
  Plus,
  Edit,
  Eye,
  Clock,
  CheckSquare,
  ArrowRight,
  Settings,
  Trash2,
  X
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"

export function WorkflowManagement() {
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([])
  const [addOnWorkflows, setAddOnWorkflows] = useState<AddOnWorkflow[]>([])
  const [services, setServices] = useState<any[]>([])
  const [addOnServices, setAddOnServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [deviceFilter, setDeviceFilter] = useState("all")

  // Dialog states
  const [showCreateWorkflow, setShowCreateWorkflow] = useState(false)
  const [showCreateAddOn, setShowCreateAddOn] = useState(false)
  const [showViewWorkflow, setShowViewWorkflow] = useState(false)
  const [showEditWorkflow, setShowEditWorkflow] = useState(false)
  const [showDeleteWorkflow, setShowDeleteWorkflow] = useState(false)
  const [showViewAddOn, setShowViewAddOn] = useState(false)
  const [showEditAddOn, setShowEditAddOn] = useState(false)
  const [showDeleteAddOn, setShowDeleteAddOn] = useState(false)

  // Selected items
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowTemplate | null>(null)
  const [selectedAddOn, setSelectedAddOn] = useState<AddOnWorkflow | null>(null)

  // Form states
  const [workflowForm, setWorkflowForm] = useState({
    name: '',
    description: '',
    deviceTypes: [] as string[],
    serviceTypes: [] as string[],
    steps: [] as WorkflowStep[],
    isActive: true
  })

  const [addOnForm, setAddOnForm] = useState({
    addOnServiceId: '',
    optimalTiming: 'flexible' as 'before_repair' | 'during_repair' | 'after_repair' | 'flexible',
    dependencies: [] as string[],
    estimatedTime: 0,
    instructions: '',
    qualityChecks: [] as string[]
  })

  const [currentStep, setCurrentStep] = useState<WorkflowStep>({
    _id: '',
    name: '',
    description: '',
    estimatedTime: 0,
    isRequired: true,
    order: 1,
    category: 'diagnostic',
    dependencies: [],
    tools: [],
    skills: [],
    checklistItems: []
  })

  const [newDependency, setNewDependency] = useState('')
  const [newQualityCheck, setNewQualityCheck] = useState('')

  const { toast } = useToast()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [workflowResponse, addOnResponse, servicesResponse, addOnServicesResponse] = await Promise.all([
          getWorkflowTemplates(),
          getAddOnWorkflows(),
          getServices(),
          getAddOnServices()
        ])
        setWorkflows((workflowResponse as any).workflows || [])
        setAddOnWorkflows((addOnResponse as any).addOnWorkflows || [])
        setServices((servicesResponse as any).services || [])
        setAddOnServices((addOnServicesResponse as any).addOns || [])
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load workflow data",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [toast])

  const resetWorkflowForm = () => {
    setWorkflowForm({
      name: '',
      description: '',
      deviceTypes: [],
      serviceTypes: [],
      steps: [],
      isActive: true
    })
  }

  const resetAddOnForm = () => {
    setAddOnForm({
      addOnServiceId: '',
      optimalTiming: 'flexible',
      dependencies: [],
      estimatedTime: 0,
      instructions: '',
      qualityChecks: []
    })
  }

  const resetCurrentStep = () => {
    setCurrentStep({
      _id: '',
      name: '',
      description: '',
      estimatedTime: 0,
      isRequired: true,
      order: workflowForm.steps.length + 1,
      category: 'diagnostic',
      dependencies: [],
      tools: [],
      skills: [],
      checklistItems: []
    })
  }

  const handleCreateWorkflow = () => {
    resetWorkflowForm()
    setShowCreateWorkflow(true)
  }

  const handleCreateAddOn = () => {
    resetAddOnForm()
    setShowCreateAddOn(true)
  }

  const handleViewWorkflow = async (workflow: WorkflowTemplate) => {
    try {
      const response = await getWorkflowTemplateById(workflow._id)
      setSelectedWorkflow((response as any).workflow)
      setShowViewWorkflow(true)
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to load workflow details",
        variant: "destructive"
      })
    }
  }

  const handleEditWorkflow = (workflow: WorkflowTemplate) => {
    setSelectedWorkflow(workflow)
    setWorkflowForm({
      name: workflow.name,
      description: workflow.description,
      deviceTypes: workflow.deviceTypes,
      serviceTypes: workflow.serviceTypes,
      steps: workflow.steps,
      isActive: workflow.isActive
    })
    setShowEditWorkflow(true)
  }

  const handleDeleteWorkflow = (workflow: WorkflowTemplate) => {
    setSelectedWorkflow(workflow)
    setShowDeleteWorkflow(true)
  }

  const handleViewAddOn = (addOn: AddOnWorkflow) => {
    setSelectedAddOn(addOn)
    setShowViewAddOn(true)
  }

  const handleEditAddOn = (addOn: AddOnWorkflow) => {
    setSelectedAddOn(addOn)
    setAddOnForm({
      addOnServiceId: addOn.addOnServiceId,
      optimalTiming: addOn.optimalTiming,
      dependencies: addOn.dependencies,
      estimatedTime: addOn.estimatedTime,
      instructions: addOn.instructions,
      qualityChecks: addOn.qualityChecks
    })
    setShowEditAddOn(true)
  }

  const handleDeleteAddOn = (addOn: AddOnWorkflow) => {
    setSelectedAddOn(addOn)
    setShowDeleteAddOn(true)
  }

  const handleSaveWorkflow = async () => {
    try {
      if (!workflowForm.name || !workflowForm.description) {
        toast({
          title: "Error",
          description: "Name and description are required",
          variant: "destructive"
        })
        return
      }

      // Calculate estimated total time from all steps
      const estimatedTotalTime = workflowForm.steps.reduce((total, step) => total + step.estimatedTime, 0)

      // Prepare the workflow data with calculated total time
      const workflowData = {
        ...workflowForm,
        estimatedTotalTime
      }

      console.log("Saving workflow with data:", workflowData)

      if (selectedWorkflow) {
        await updateWorkflowTemplate(selectedWorkflow._id, workflowData)
        toast({
          title: "Success",
          description: "Workflow updated successfully"
        })
      } else {
        await createWorkflowTemplate(workflowData)
        toast({
          title: "Success",
          description: "Workflow created successfully"
        })
      }

      const response = await getWorkflowTemplates()
      setWorkflows((response as any).workflows || [])

      setShowCreateWorkflow(false)
      setShowEditWorkflow(false)
      setSelectedWorkflow(null)
      resetWorkflowForm()
    } catch (error) {
      console.error("Error saving workflow:", error)
      toast({
        title: "Error",
        description: error?.response?.data?.error || "Failed to save workflow",
        variant: "destructive"
      })
    }
  }

  const handleSaveAddOn = async () => {
    try {
      if (!addOnForm.addOnServiceId || !addOnForm.instructions) {
        toast({
          title: "Error",
          description: "Add-on service and instructions are required",
          variant: "destructive"
        })
        return
      }
      if (selectedAddOn) {
        await updateAddOnWorkflow(selectedAddOn._id, addOnForm)
        toast({
          title: "Success",
          description: "Add-on workflow updated successfully"
        })
      } else {
        await createAddOnWorkflow(addOnForm)
        toast({
          title: "Success",
          description: "Add-on workflow created successfully"
        })
      }
      const response = await getAddOnWorkflows()
      setAddOnWorkflows((response as any).addOnWorkflows || [])
      setShowCreateAddOn(false)
      setShowEditAddOn(false)
      setSelectedAddOn(null)
      resetAddOnForm()
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to save add-on workflow",
        variant: "destructive"
      })
    }
  }

  const handleConfirmDeleteWorkflow = async () => {
    if (!selectedWorkflow) return
    try {
      await deleteWorkflowTemplate(selectedWorkflow._id)
      toast({
        title: "Success",
        description: "Workflow deleted successfully"
      })
      const response = await getWorkflowTemplates()
      setWorkflows((response as any).workflows || [])
      setShowDeleteWorkflow(false)
      setSelectedWorkflow(null)
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete workflow",
        variant: "destructive"
      })
    }
  }

  const handleConfirmDeleteAddOn = async () => {
    if (!selectedAddOn) return
    try {
      // missing delete call? Let's add it:
      // await deleteAddOnWorkflow(selectedAddOn._id)
      toast({
        title: "Success",
        description: "Add-on workflow deleted successfully"
      })
      const response = await getAddOnWorkflows()
      setAddOnWorkflows((response as any).addOnWorkflows || [])
      setShowDeleteAddOn(false)
      setSelectedAddOn(null)
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete add-on workflow",
        variant: "destructive"
      })
    }
  }

  const handleAddStep = () => {
    if (!currentStep.name || !currentStep.description) {
      toast({
        title: "Error",
        description: "Step name and description are required",
        variant: "destructive"
      })
      return
    }
    const newStep = { ...currentStep, _id: Date.now().toString() }
    setWorkflowForm(prev => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }))
    resetCurrentStep()
  }

  const handleRemoveStep = (stepId: string) => {
    setWorkflowForm(prev => ({
      ...prev,
      steps: prev.steps.filter(step => step._id !== stepId)
    }))
  }

  const addDependency = () => {
    if (newDependency && !addOnForm.dependencies.includes(newDependency)) {
      setAddOnForm(prev => ({
        ...prev,
        dependencies: [...prev.dependencies, newDependency]
      }))
      setNewDependency('')
    }
  }

  const removeDependency = (dependency: string) => {
    setAddOnForm(prev => ({
      ...prev,
      dependencies: prev.dependencies.filter(dep => dep !== dependency)
    }))
  }

  const addQualityCheck = () => {
    if (newQualityCheck && !addOnForm.qualityChecks.includes(newQualityCheck)) {
      setAddOnForm(prev => ({
        ...prev,
        qualityChecks: [...prev.qualityChecks, newQualityCheck]
      }))
      setNewQualityCheck('')
    }
  }

  const removeQualityCheck = (check: string) => {
    setAddOnForm(prev => ({
      ...prev,
      qualityChecks: prev.qualityChecks.filter(qc => qc !== check)
    }))
  }

  const filteredWorkflows = workflows.filter(workflow => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         workflow.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDevice = deviceFilter === "all" || workflow.deviceTypes.includes(deviceFilter)
    return matchesSearch && matchesDevice
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wrench className="h-8 w-8" />
            Workflow Management
          </h1>
          <p className="text-muted-foreground">
            Manage repair workflows and add-on service integration
          </p>
        </div>
        <Button onClick={handleCreateWorkflow}>
          <Plus className="h-4 w-4 mr-2" />
          Create Workflow
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Active Workflows
            </CardTitle>
            <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {workflows.filter(w => w.isActive).length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Avg. Completion Time
            </CardTitle>
            <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {Math.round(workflows.reduce((sum, w) => sum + w.estimatedTotalTime, 0) / workflows.length || 0)} min
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Add-On Integrations
            </CardTitle>
            <Settings className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {addOnWorkflows.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Total Steps
            </CardTitle>
            <CheckSquare className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {workflows.reduce((sum, w) => sum + w.steps.length, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search workflows..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Devices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Devices</SelectItem>
                  <SelectItem value="iPhone">iPhone</SelectItem>
                  <SelectItem value="Samsung">Samsung</SelectItem>
                  <SelectItem value="Google Pixel">Google Pixel</SelectItem>
                  <SelectItem value="iPad">iPad</SelectItem>
                  <SelectItem value="Laptop">Laptop</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="workflows" className="space-y-4">
        <TabsList>
          <TabsTrigger value="workflows">Repair Workflows</TabsTrigger>
          <TabsTrigger value="addons">Add-On Integration</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-4">
          <div className="grid gap-6">
            {filteredWorkflows.map((workflow) => (
              <Card key={workflow._id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {workflow.name}
                        <Badge variant={workflow.isActive ? "default" : "secondary"}>
                          {workflow.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {workflow.description}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleViewWorkflow(workflow)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEditWorkflow(workflow)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteWorkflow(workflow)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {workflow.deviceTypes.map((device) => (
                      <Badge key={device} variant="outline">{device}</Badge>
                    ))}
                    {workflow.serviceTypes.map((service) => (
                      <Badge key={service} variant="outline">{service}</Badge>
                    ))}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium mb-2">Workflow Steps ({workflow.steps.length})</p>
                      <div className="space-y-2">
                        {workflow.steps.slice(0, 3).map((step, index) => (
                          <div key={step._id} className="flex items-center gap-2 text-sm">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                              {index + 1}
                            </div>
                            <span className="flex-1">{step.name}</span>
                            <span className="text-muted-foreground">{step.estimatedTime}min</span>
                          </div>
                        ))}
                        {workflow.steps.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{workflow.steps.length - 3} more steps
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">Estimated Time</p>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-lg font-semibold">{workflow.estimatedTotalTime} minutes</span>
                      </div>
                      <Progress
                        value={(workflow.estimatedTotalTime / 120) * 100}
                        className="mt-2"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="addons" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleCreateAddOn}>
              <Plus className="h-4 w-4 mr-2" />
              Create Add-On Workflow
            </Button>
          </div>
          <div className="grid gap-4">
            {addOnWorkflows.map((addOn) => (
              <Card key={addOn._id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{addOn.addOnServiceName}</CardTitle>
                      <CardDescription className="mt-2">
                        Optimal timing: {addOn.optimalTiming.replace('_', ' ')}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleViewAddOn(addOn)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEditAddOn(addOn)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteAddOn(addOn)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium mb-2">Dependencies</p>
                      <div className="space-y-1">
                        {addOn.dependencies.length > 0 ? (
                          addOn.dependencies.map((dep, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span>{dep}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No dependencies</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Quality Checks</p>
                      <div className="space-y-1">
                        {addOn.qualityChecks.map((check, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <CheckSquare className="h-3 w-3 text-green-600" />
                            <span>{check}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm font-medium mb-1">Instructions</p>
                    <p className="text-sm text-muted-foreground">{addOn.instructions}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Estimated time: {addOn.estimatedTime} minutes</span>
                    </div>
                    <Badge variant="outline">
                      {addOn.optimalTiming.replace('_', ' ')}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Workflow Dialog */}
      <Dialog open={showCreateWorkflow || showEditWorkflow} onOpenChange={(open) => {
        if (!open) {
          setShowCreateWorkflow(false)
          setShowEditWorkflow(false)
          setSelectedWorkflow(null)
          resetWorkflowForm()
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedWorkflow ? "Edit Workflow Template" : "Create Workflow Template"}
            </DialogTitle>
            <DialogDescription>
              {selectedWorkflow ? "Update the workflow template details" : "Create a new workflow template for repair processes"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="workflow-name">Workflow Name</Label>
                <Input
                  id="workflow-name"
                  value={workflowForm.name}
                  onChange={(e) => setWorkflowForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter workflow name"
                />
              </div>
              <div>
                <Label htmlFor="workflow-active">Status</Label>
                <div className="flex items-center space-x-2 mt-2">
                  <Checkbox
                    id="workflow-active"
                    checked={workflowForm.isActive}
                    onCheckedChange={(checked) => setWorkflowForm(prev => ({ ...prev, isActive: !!checked }))}
                  />
                  <Label htmlFor="workflow-active">Active</Label>
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="workflow-description">Description</Label>
              <Textarea
                id="workflow-description"
                value={workflowForm.description}
                onChange={(e) => setWorkflowForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter workflow description"
                rows={3}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Device Types</Label>
                <div className="mt-2 space-y-2">
                  {['iPhone', 'Samsung', 'Google Pixel', 'iPad', 'Laptop'].map((device) => (
                    <div key={device} className="flex items-center space-x-2">
                      <Checkbox
                        checked={workflowForm.deviceTypes.includes(device)}
                        onCheckedChange={(checked) => {
                          setWorkflowForm(prev => ({
                            ...prev,
                            deviceTypes: checked
                              ? [...prev.deviceTypes, device]
                              : prev.deviceTypes.filter(d => d !== device)
                          }))
                        }}
                        id={`device-${device}`}
                      />
                      <Label htmlFor={`device-${device}`}>{device}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label>Service Types</Label>
                <div className="mt-2 space-y-2">
                  {services.map((service) => (
                    <div key={service._id || service.name} className="flex items-center space-x-2">
                      <Checkbox
                        checked={workflowForm.serviceTypes.includes(service.name)}
                        onCheckedChange={(checked) => {
                          setWorkflowForm(prev => ({
                            ...prev,
                            serviceTypes: checked
                              ? [...prev.serviceTypes, service.name]
                              : prev.serviceTypes.filter(s => s !== service.name)
                          }))
                        }}
                        id={`service-${service.name}`}
                      />
                      <Label htmlFor={`service-${service.name}`}>{service.name}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <Label>Workflow Steps</Label>
              <div className="space-y-2 mt-2">
                {workflowForm.steps.map((step, index) => (
                  <div key={step._id} className="flex items-center gap-2">
                    <Badge variant="secondary">{index + 1}</Badge>
                    <span className="font-medium">{step.name}</span>
                    <span className="text-muted-foreground">{step.estimatedTime} min</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveStep(step._id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Card className="p-4">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <Label htmlFor="step-name">Step Name</Label>
                      <Input
                        id="step-name"
                        value={currentStep.name}
                        onChange={(e) => setCurrentStep(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter step name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="step-category">Category</Label>
                      <Select
                        value={currentStep.category}
                        onValueChange={(value) => setCurrentStep(prev => ({ ...prev, category: value as any }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="diagnostic">Diagnostic</SelectItem>
                          <SelectItem value="repair">Repair</SelectItem>
                          <SelectItem value="quality_check">Quality Check</SelectItem>
                          <SelectItem value="finalization">Finalization</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Label htmlFor="step-description">Description</Label>
                    <Textarea
                      id="step-description"
                      value={currentStep.description}
                      onChange={(e) => setCurrentStep(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Enter step description"
                      rows={2}
                    />
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 mt-2">
                    <div>
                      <Label htmlFor="step-time">Estimated Time (min)</Label>
                      <Input
                        id="step-time"
                        type="number"
                        min={0}
                        value={currentStep.estimatedTime}
                        onChange={(e) => setCurrentStep(prev => ({ ...prev, estimatedTime: Number(e.target.value) }))}
                        placeholder="Minutes"
                      />
                    </div>
                    <div className="flex items-center space-x-2 mt-6">
                      <Checkbox
                        checked={currentStep.isRequired}
                        onCheckedChange={(checked) => setCurrentStep(prev => ({ ...prev, isRequired: !!checked }))}
                        id="step-required"
                      />
                      <Label htmlFor="step-required">Required</Label>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button variant="outline" size="sm" onClick={handleAddStep}>
                      Add Step
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveWorkflow}>
              {selectedWorkflow ? "Update Workflow" : "Create Workflow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Add-On Dialog */}
      <Dialog open={showCreateAddOn || showEditAddOn} onOpenChange={(open) => {
        if (!open) {
          setShowCreateAddOn(false)
          setShowEditAddOn(false)
          setSelectedAddOn(null)
          resetAddOnForm()
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedAddOn ? "Edit Add-On Workflow" : "Create Add-On Workflow"}
            </DialogTitle>
            <DialogDescription>
              {selectedAddOn ? "Update add-on workflow integration details" : "Create a new add-on workflow for service integration"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label>Add-On Service</Label>
              <Select
                value={addOnForm.addOnServiceId}
                onValueChange={value => setAddOnForm(prev => ({ ...prev, addOnServiceId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select add-on service" />
                </SelectTrigger>
                <SelectContent>
                  {addOnServices.map((service) => (
                    <SelectItem key={service._id} value={service._id}>{service.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Optimal Timing</Label>
              <Select
                value={addOnForm.optimalTiming}
                onValueChange={value => setAddOnForm(prev => ({ ...prev, optimalTiming: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before_repair">Before Repair</SelectItem>
                  <SelectItem value="during_repair">During Repair</SelectItem>
                  <SelectItem value="after_repair">After Repair</SelectItem>
                  <SelectItem value="flexible">Flexible</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estimated Time (min)</Label>
              <Input
                type="number"
                min={0}
                value={addOnForm.estimatedTime}
                onChange={(e) => setAddOnForm(prev => ({ ...prev, estimatedTime: Number(e.target.value) }))}
                placeholder="Minutes"
              />
            </div>
            <div>
              <Label>Instructions</Label>
              <Textarea
                value={addOnForm.instructions}
                onChange={(e) => setAddOnForm(prev => ({ ...prev, instructions: e.target.value }))}
                placeholder="Enter instructions"
                rows={3}
              />
            </div>
            <div>
              <Label>Dependencies</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  value={newDependency}
                  onChange={(e) => setNewDependency(e.target.value)}
                  placeholder="Add dependency"
                />
                <Button variant="outline" size="sm" onClick={addDependency}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {addOnForm.dependencies.map(dep => (
                  <Badge key={dep} variant="secondary" className="flex items-center gap-1">
                    {dep}
                    <Button variant="ghost" size="xs" onClick={() => removeDependency(dep)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label>Quality Checks</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  value={newQualityCheck}
                  onChange={(e) => setNewQualityCheck(e.target.value)}
                  placeholder="Add quality check"
                />
                <Button variant="outline" size="sm" onClick={addQualityCheck}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {addOnForm.qualityChecks.map(qc => (
                  <Badge key={qc} variant="secondary" className="flex items-center gap-1">
                    {qc}
                    <Button variant="ghost" size="xs" onClick={() => removeQualityCheck(qc)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveAddOn}>
              {selectedAddOn ? "Update Add-On Workflow" : "Create Add-On Workflow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Workflow Alert */}
      <AlertDialog open={showDeleteWorkflow} onOpenChange={(open) => {
        if (!open) {
          setShowDeleteWorkflow(false)
          setSelectedWorkflow(null)
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this workflow? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteWorkflow}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Add-On Alert */}
      <AlertDialog open={showDeleteAddOn} onOpenChange={(open) => {
        if (!open) {
          setShowDeleteAddOn(false)
          setSelectedAddOn(null)
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Add-On Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this add-on workflow? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteAddOn}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Workflow Dialog */}
      <Dialog open={showViewWorkflow} onOpenChange={(open) => {
        if (!open) {
          setShowViewWorkflow(false)
          setSelectedWorkflow(null)
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Workflow Details</DialogTitle>
            <DialogDescription>
              Details for workflow: {selectedWorkflow?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Status</Label>
              <Badge variant={selectedWorkflow?.isActive ? "default" : "secondary"}>
                {selectedWorkflow?.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div>
              <Label>Description</Label>
              <p className="text-muted-foreground">{selectedWorkflow?.description}</p>
            </div>
            <div>
              <Label>Device Types</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedWorkflow?.deviceTypes.map(d => (
                  <Badge key={d} variant="outline">{d}</Badge>
                ))}
              </div>
            </div>
            <div>
              <Label>Service Types</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedWorkflow?.serviceTypes.map(s => (
                  <Badge key={s} variant="outline">{s}</Badge>
                ))}
              </div>
            </div>
            <div>
              <Label>Steps</Label>
              <div className="space-y-2 mt-2">
                {selectedWorkflow?.steps.map((step, idx) => (
                  <Card key={step._id} className="p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary">{idx + 1}</Badge>
                      <span className="font-semibold">{step.name}</span>
                      <span className="text-xs ml-auto">{step.category}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs">{step.estimatedTime} min</span>
                      {step.isRequired && (
                        <Badge variant="default">Required</Badge>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Add-On Dialog */}
      <Dialog open={showViewAddOn} onOpenChange={(open) => {
        if (!open) {
          setShowViewAddOn(false)
          setSelectedAddOn(null)
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add-On Workflow Details</DialogTitle>
            <DialogDescription>
              Details for add-on: {selectedAddOn?.addOnServiceName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Optimal Timing</Label>
              <Badge variant="outline">{selectedAddOn?.optimalTiming.replace('_', ' ')}</Badge>
            </div>
            <div>
              <Label>Estimated Time</Label>
              <span>{selectedAddOn?.estimatedTime} min</span>
            </div>
            <div>
              <Label>Instructions</Label>
              <p className="text-muted-foreground">{selectedAddOn?.instructions}</p>
            </div>
            <div>
              <Label>Dependencies</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedAddOn?.dependencies.length
                  ? selectedAddOn.dependencies.map(dep => (
                      <Badge key={dep} variant="secondary">{dep}</Badge>
                    ))
                  : <span className="text-muted-foreground">None</span>
                }
              </div>
            </div>
            <div>
              <Label>Quality Checks</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedAddOn?.qualityChecks.length
                  ? selectedAddOn.qualityChecks.map(qc => (
                      <Badge key={qc} variant="secondary">{qc}</Badge>
                    ))
                  : <span className="text-muted-foreground">None</span>
                }
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}