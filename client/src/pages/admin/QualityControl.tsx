import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/useToast"
import { getQualityChecklists, getQualityInspections, getQualityMetrics, QualityChecklist, QualityInspection, QualityMetrics } from "@/api/quality"
import {
  CheckSquare,
  Search,
  Plus,
  Edit,
  Eye,
  Camera,
  AlertTriangle,
  TrendingUp,
  Clock,
  Award,
  Users
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

export function QualityControl() {
  const [checklists, setChecklists] = useState<QualityChecklist[]>([])
  const [inspections, setInspections] = useState<QualityInspection[]>([])
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const { toast } = useToast()

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Fetching quality control data...")
        const [checklistsResponse, inspectionsResponse, metricsResponse] = await Promise.all([
          getQualityChecklists(),
          getQualityInspections(),
          getQualityMetrics()
        ])

        setChecklists((checklistsResponse as any).checklists || [])
        setInspections((inspectionsResponse as any).inspections || [])
        setMetrics((metricsResponse as any).metrics || null)
      } catch (error) {
        console.error("Error fetching quality control data:", error)
        toast({
          title: "Error",
          description: "Failed to load quality control data",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [toast])

  const filteredInspections = inspections.filter(inspection => {
    const matchesSearch = inspection.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inspection.checklistName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || inspection.overallStatus === statusFilter
    return matchesSearch && matchesStatus
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
              {[...Array(5)].map((_, i) => (
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
            <CheckSquare className="h-8 w-8" />
            Quality Control
          </h1>
          <p className="text-muted-foreground">
            Manage quality checklists, inspections, and metrics
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Inspection
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Pass Rate
            </CardTitle>
            <Award className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {metrics?.passRate.toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Total Inspections
            </CardTitle>
            <CheckSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {metrics?.totalInspections}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Avg. Inspection Time
            </CardTitle>
            <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {metrics?.averageInspectionTime.toFixed(1)} min
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Active Checklists
            </CardTitle>
            <CheckSquare className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {checklists.filter(c => c.isActive).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="inspections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inspections">Inspections</TabsTrigger>
          <TabsTrigger value="checklists">Checklists</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="inspections" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search inspections by order number or checklist..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="w-48">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pass">Pass</SelectItem>
                      <SelectItem value="fail">Fail</SelectItem>
                      <SelectItem value="conditional_pass">Conditional Pass</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inspections Table */}
          <Card>
            <CardHeader>
              <CardTitle>Quality Inspections</CardTitle>
              <CardDescription>
                Recent quality control inspections and results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Checklist</TableHead>
                    <TableHead>Inspector</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInspections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <CheckSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">No inspections found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInspections.map((inspection) => (
                      <TableRow key={inspection._id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{inspection.orderNumber}</p>
                            <p className="text-sm text-muted-foreground">Order ID: {inspection.orderId}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{inspection.checklistName}</p>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{inspection.inspectedBy}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            inspection.overallStatus === 'pass' ? 'default' :
                            inspection.overallStatus === 'fail' ? 'destructive' :
                            'secondary'
                          }>
                            {inspection.overallStatus.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">
                            {new Date(inspection.inspectedAt).toLocaleDateString()}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Camera className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checklists" className="space-y-4">
          <div className="grid gap-6">
            {checklists.map((checklist) => (
              <Card key={checklist._id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {checklist.name}
                        <Badge variant={checklist.isActive ? "default" : "secondary"}>
                          {checklist.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {checklist.description}
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
                    {checklist.serviceTypes.map((service) => (
                      <Badge key={service} variant="outline">{service}</Badge>
                    ))}
                    {checklist.deviceTypes.map((device) => (
                      <Badge key={device} variant="outline">{device}</Badge>
                    ))}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium mb-2">Check Items ({checklist.checkItems.length})</p>
                      <div className="space-y-2">
                        {checklist.checkItems.slice(0, 3).map((item, index) => (
                          <div key={item._id} className="flex items-start gap-2 text-sm">
                            <CheckSquare className="h-4 w-4 text-green-600 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium">{item.description}</p>
                              <p className="text-muted-foreground text-xs">{item.category}</p>
                            </div>
                          </div>
                        ))}
                        {checklist.checkItems.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{checklist.checkItems.length - 3} more items
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">Photo Requirements ({checklist.requiredPhotos.length})</p>
                      <div className="space-y-1">
                        {checklist.requiredPhotos.map((photo) => (
                          <div key={photo._id} className="flex items-center gap-2 text-sm">
                            <Camera className="h-3 w-3 text-muted-foreground" />
                            <span>{photo.name}</span>
                            {photo.isRequired && (
                              <Badge variant="destructive" className="text-xs">Required</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {checklist.approvalRequired && (
                    <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                          Customer approval required
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          {metrics && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Quality Performance</CardTitle>
                    <CardDescription>Overall quality metrics and trends</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Pass Rate</span>
                        <span className="text-sm font-medium">{metrics.passRate.toFixed(1)}%</span>
                      </div>
                      <Progress value={metrics.passRate} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Fail Rate</span>
                        <span className="text-sm font-medium">{metrics.failRate.toFixed(1)}%</span>
                      </div>
                      <Progress value={metrics.failRate} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Common Defects</CardTitle>
                    <CardDescription>Most frequently found issues</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {metrics.commonDefects.map((defect, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className="text-sm">{defect.defect}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{defect.count}</span>
                            <Badge variant="outline" className="text-xs">
                              {defect.percentage.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Inspector Performance</CardTitle>
                  <CardDescription>Quality control team performance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Inspector</TableHead>
                        <TableHead>Inspections</TableHead>
                        <TableHead>Pass Rate</TableHead>
                        <TableHead>Avg. Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.inspectorPerformance.map((inspector) => (
                        <TableRow key={inspector.inspectorId}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{inspector.inspectorName}</span>
                            </div>
                          </TableCell>
                          <TableCell>{inspector.inspectionsCount}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{inspector.passRate.toFixed(1)}%</span>
                              <Progress value={inspector.passRate} className="w-16 h-2" />
                            </div>
                          </TableCell>
                          <TableCell>{inspector.averageTime.toFixed(1)} min</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}