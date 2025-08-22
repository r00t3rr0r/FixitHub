import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import { getDiagnosticTests, getDiagnosticForms, DiagnosticTest, DiagnosticForm } from "@/api/diagnostics"
import {
  Stethoscope,
  Search,
  Plus,
  Edit,
  Eye,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  Wrench,
  Smartphone,
  Wifi,
  Zap
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

export function DiagnosticTools() {
  const [tests, setTests] = useState<DiagnosticTest[]>([])
  const [forms, setForms] = useState<DiagnosticForm[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const { toast } = useToast()

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Fetching diagnostic data...")
        const [testsResponse, formsResponse] = await Promise.all([
          getDiagnosticTests(),
          getDiagnosticForms()
        ])

        setTests((testsResponse as any).tests || [])
        setForms((formsResponse as any).forms || [])
      } catch (error) {
        console.error("Error fetching diagnostic data:", error)
        toast({
          title: "Error",
          description: "Failed to load diagnostic data",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [toast])

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'hardware':
        return <Smartphone className="h-4 w-4" />
      case 'software':
        return <FileText className="h-4 w-4" />
      case 'performance':
        return <Zap className="h-4 w-4" />
      case 'connectivity':
        return <Wifi className="h-4 w-4" />
      default:
        return <Wrench className="h-4 w-4" />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'hardware':
        return 'bg-blue-500 text-white'
      case 'software':
        return 'bg-green-500 text-white'
      case 'performance':
        return 'bg-orange-500 text-white'
      case 'connectivity':
        return 'bg-purple-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const filteredTests = tests.filter(test => {
    const matchesSearch = test.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         test.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === "all" || test.category === categoryFilter
    return matchesSearch && matchesCategory
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
            <Stethoscope className="h-8 w-8" />
            Diagnostic Tools
          </h1>
          <p className="text-muted-foreground">
            Digital forms, checklists, and troubleshooting guides
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Test
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Total Tests
            </CardTitle>
            <Stethoscope className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {tests.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Hardware Tests
            </CardTitle>
            <Smartphone className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {tests.filter(t => t.category === 'hardware').length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Diagnostic Forms
            </CardTitle>
            <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {forms.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Avg. Test Time
            </CardTitle>
            <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {Math.round(tests.reduce((sum, t) => sum + t.estimatedTime, 0) / tests.length || 0)} min
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
                  placeholder="Search diagnostic tests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="hardware">Hardware</SelectItem>
                  <SelectItem value="software">Software</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                  <SelectItem value="connectivity">Connectivity</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="tests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tests">Diagnostic Tests</TabsTrigger>
          <TabsTrigger value="forms">Assessment Forms</TabsTrigger>
        </TabsList>

        <TabsContent value="tests" className="space-y-4">
          <div className="grid gap-6">
            {filteredTests.map((test) => (
              <Card key={test._id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {getCategoryIcon(test.category)}
                        {test.name}
                        <Badge className={getCategoryColor(test.category)}>
                          {test.category}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {test.description}
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
                    {test.deviceTypes.map((device) => (
                      <Badge key={device} variant="outline">{device}</Badge>
                    ))}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium mb-2">Test Steps ({test.steps.length})</p>
                      <div className="space-y-2">
                        {test.steps.slice(0, 3).map((step, index) => (
                          <div key={step._id} className="flex items-start gap-2 text-sm">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium mt-0.5">
                              {step.order}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{step.instruction}</p>
                              <p className="text-muted-foreground text-xs">{step.expectedResult}</p>
                            </div>
                          </div>
                        ))}
                        {test.steps.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{test.steps.length - 3} more steps
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">Tools Required</p>
                      <div className="space-y-1">
                        {test.tools.map((tool, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <Wrench className="h-3 w-3 text-muted-foreground" />
                            <span>{tool}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Estimated time: {test.estimatedTime} minutes</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm font-medium mb-2">Pass/Fail Criteria</p>
                    <div className="space-y-1">
                      {test.passFailCriteria.map((criteria, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          <span>{criteria}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {test.troubleshootingGuide.length > 0 && (
                    <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg">
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        Troubleshooting Guide
                      </p>
                      <div className="space-y-2">
                        {test.troubleshootingGuide.slice(0, 2).map((guide, index) => (
                          <div key={guide._id} className="text-sm">
                            <p className="font-medium">{guide.issue}</p>
                            <p className="text-muted-foreground text-xs">
                              {guide.solutions.slice(0, 2).join(', ')}
                              {guide.solutions.length > 2 && '...'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="forms" className="space-y-4">
          <div className="grid gap-4">
            {forms.map((form) => (
              <Card key={form._id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {form.name}
                        <Badge variant={form.isActive ? "default" : "secondary"}>
                          {form.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {form.description}
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
                    {form.deviceTypes.map((device) => (
                      <Badge key={device} variant="outline">{device}</Badge>
                    ))}
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Form Fields ({form.fields.length})</p>
                    <div className="space-y-2">
                      {form.fields.slice(0, 4).map((field) => (
                        <div key={field._id} className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                          <span className="font-medium">{field.label}</span>
                          <Badge variant="outline" className="text-xs">{field.type}</Badge>
                          {field.required && (
                            <Badge variant="destructive" className="text-xs">Required</Badge>
                          )}
                        </div>
                      ))}
                      {form.fields.length > 4 && (
                        <p className="text-xs text-muted-foreground">
                          +{form.fields.length - 4} more fields
                        </p>
                      )}
                    </div>
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