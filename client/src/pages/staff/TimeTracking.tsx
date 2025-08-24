import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/useToast"
import {
  Clock,
  Play,
  Pause,
  Square,
  Calendar,
  BarChart3,
  Timer,
  CheckCircle,
  Coffee
} from "lucide-react"

interface TimeEntry {
  _id: string
  orderId: string
  orderNumber: string
  taskType: string
  startTime: string
  endTime?: string
  duration: number
  status: 'active' | 'paused' | 'completed'
  description: string
}

export function TimeTracking() {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [activeTimer, setActiveTimer] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchTimeEntries = async () => {
      try {
        // Mock data for time entries
        const mockEntries: TimeEntry[] = [
          {
            _id: '1',
            orderId: 'order1',
            orderNumber: 'ORD-2024-001',
            taskType: 'Screen Replacement',
            startTime: '2024-01-15T09:00:00Z',
            endTime: '2024-01-15T11:30:00Z',
            duration: 150,
            status: 'completed',
            description: 'iPhone 15 Pro screen replacement'
          },
          {
            _id: '2',
            orderId: 'order2',
            orderNumber: 'ORD-2024-002',
            taskType: 'Battery Replacement',
            startTime: '2024-01-15T13:00:00Z',
            duration: 45,
            status: 'active',
            description: 'Samsung Galaxy S24 battery replacement'
          }
        ]
        setTimeEntries(mockEntries)
        
        // Find active timer
        const active = mockEntries.find(entry => entry.status === 'active')
        if (active) {
          setActiveTimer(active._id)
          setCurrentTime(active.duration)
        }
      } catch (error) {
        console.error("Error fetching time entries:", error)
        toast({
          title: "Error",
          description: "Failed to load time tracking data",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchTimeEntries()
  }, [toast])

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (activeTimer) {
      interval = setInterval(() => {
        setCurrentTime(prev => prev + 1)
      }, 60000) // Update every minute
    }
    return () => clearInterval(interval)
  }, [activeTimer])

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const handleStartTimer = (entryId: string) => {
    setActiveTimer(entryId)
    setCurrentTime(0)
    toast({
      title: "Timer Started",
      description: "Time tracking has begun for this task"
    })
  }

  const handlePauseTimer = () => {
    setActiveTimer(null)
    toast({
      title: "Timer Paused",
      description: "Time tracking has been paused"
    })
  }

  const handleStopTimer = () => {
    setActiveTimer(null)
    setCurrentTime(0)
    toast({
      title: "Timer Stopped",
      description: "Time entry has been completed"
    })
  }

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

  const todayEntries = timeEntries.filter(entry => 
    new Date(entry.startTime).toDateString() === new Date().toDateString()
  )
  const totalToday = todayEntries.reduce((sum, entry) => sum + entry.duration, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Clock className="h-8 w-8" />
          Time Tracking
        </h1>
        <p className="text-muted-foreground">
          Track your work hours and manage time entries
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Today's Hours
            </CardTitle>
            <Timer className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {formatTime(totalToday)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Active Tasks
            </CardTitle>
            <Play className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {timeEntries.filter(e => e.status === 'active').length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Completed Today
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {todayEntries.filter(e => e.status === 'completed').length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Break Time
            </CardTitle>
            <Coffee className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              0h 30m
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Timer */}
      {activeTimer && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <Play className="h-5 w-5" />
              Active Timer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {formatTime(currentTime)}
                </p>
                <p className="text-green-700 dark:text-green-300">
                  {timeEntries.find(e => e._id === activeTimer)?.description}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handlePauseTimer}>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
                <Button variant="destructive" onClick={handleStopTimer}>
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Time Entries</CardTitle>
          <CardDescription>
            Your recent time tracking entries and active tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {timeEntries.map((entry) => (
              <div key={entry._id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${
                    entry.status === 'active' ? 'bg-green-500 animate-pulse' :
                    entry.status === 'paused' ? 'bg-yellow-500' :
                    'bg-gray-500'
                  }`} />
                  <div>
                    <p className="font-medium">{entry.orderNumber}</p>
                    <p className="text-sm text-muted-foreground">{entry.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Started: {new Date(entry.startTime).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-medium">{formatTime(entry.duration)}</p>
                    <Badge variant={
                      entry.status === 'active' ? 'default' :
                      entry.status === 'paused' ? 'secondary' :
                      'outline'
                    }>
                      {entry.status}
                    </Badge>
                  </div>
                  {entry.status !== 'active' && entry.status !== 'completed' && (
                    <Button
                      size="sm"
                      onClick={() => handleStartTimer(entry._id)}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}