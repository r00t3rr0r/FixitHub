import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/useToast"
import { getWorkflowTemplates, getAddOnWorkflows, WorkflowTemplate, AddOnWorkflow } from "@/api/workflow"
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
  Play,
  Pause,
  RotateCcw
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

export function WorkflowManagement() {
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([])
  const [addOnWorkflows, setAddOnWorkflows] = useState<AddOnWorkflow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [deviceFilter, setDeviceFilter] = useState("all")
  const { toast } = useToast()

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Fetching workflow data...")
        const [workflowResponse, addOnResponse] = await Promise.all([
          getWorkflowTemplates(),
          getAddOnWorkflows()
        ])

        setWorkflows((workflowResponse as any).workflows || [])
        setAddOnWorkflows((addOnResponse as any).addOnWorkflows || [])
      } catch (error) {
        console.error("Error fetching workflow data:", error)
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
      {/* Header */}
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
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Workflow
        </Button>
      </div>

      {/* Stats Cards */}
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

      {/* Filters */}
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
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
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
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
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
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
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
    </div>
  )
}