import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import {
  Calendar,
  Clock,
  User,
  MapPin,
  Plus,
  ChevronLeft,
  ChevronRight
} from "lucide-react"

interface ScheduleEvent {
  _id: string
  title: string
  type: 'repair' | 'meeting' | 'break' | 'training'
  startTime: string
  endTime: string
  location?: string
  customer?: string
  orderNumber?: string
  description?: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
}

export function Schedule() {
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        // Mock schedule data
        const mockEvents: ScheduleEvent[] = [
          {
            _id: '1',
            title: 'iPhone 15 Pro Screen Repair',
            type: 'repair',
            startTime: '2024-01-15T09:00:00Z',
            endTime: '2024-01-15T11:00:00Z',
            customer: 'John Doe',
            orderNumber: 'ORD-2024-001',
            description: 'Screen replacement with quality check',
            priority: 'high'
          },
          {
            _id: '2',
            title: 'Team Meeting',
            type: 'meeting',
            startTime: '2024-01-15T14:00:00Z',
            endTime: '2024-01-15T15:00:00Z',
            location: 'Conference Room A',
            description: 'Weekly team sync and updates',
            priority: 'normal'
          },
          {
            _id: '3',
            title: 'Lunch Break',
            type: 'break',
            startTime: '2024-01-15T12:00:00Z',
            endTime: '2024-01-15T13:00:00Z',
            priority: 'normal'
          }
        ]
        setEvents(mockEvents)
      } catch (error) {
        console.error("Error fetching schedule:", error)
        toast({
          title: "Error",
          description: "Failed to load schedule",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchSchedule()
  }, [toast])

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'repair':
        return 'bg-blue-500 text-white'
      case 'meeting':
        return 'bg-purple-500 text-white'
      case 'break':
        return 'bg-green-500 text-white'
      case 'training':
        return 'bg-orange-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-red-500'
      case 'high':
        return 'border-l-orange-500'
      case 'normal':
        return 'border-l-blue-500'
      case 'low':
        return 'border-l-gray-500'
      default:
        return 'border-l-gray-500'
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const todayEvents = events.filter(event => 
    new Date(event.startTime).toDateString() === currentDate.toDateString()
  ).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

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
            <Calendar className="h-8 w-8" />
            Schedule
          </h1>
          <p className="text-muted-foreground">
            View your appointments and manage your daily schedule
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Event
        </Button>
      </div>

      {/* Date Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 1)))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <h2 className="text-2xl font-bold">
                {currentDate.toLocaleDateString('en-US', { 
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </h2>
              <p className="text-muted-foreground">
                {todayEvents.length} events scheduled
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 1)))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Schedule</CardTitle>
          <CardDescription>
            Your appointments and tasks for the selected day
          </CardDescription>
        </CardHeader>
        <CardContent>
          {todayEvents.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No events scheduled</h3>
              <p className="text-muted-foreground">
                You have a free day! Enjoy your time or add new events.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {todayEvents.map((event, index) => (
                <div
                  key={event._id}
                  className={`flex items-start gap-4 p-4 border-l-4 rounded-lg bg-gradient-to-r from-background to-muted/20 ${getPriorityColor(event.priority)}`}
                >
                  <div className="flex-shrink-0 text-center min-w-[80px]">
                    <div className="text-lg font-bold">
                      {formatTime(event.startTime)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatTime(event.endTime)}
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{event.title}</h3>
                      <Badge className={getEventTypeColor(event.type)}>
                        {event.type}
                      </Badge>
                      {event.priority === 'urgent' && (
                        <Badge variant="destructive" className="text-xs">
                          Urgent
                        </Badge>
                      )}
                    </div>
                    
                    {event.description && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {event.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {event.customer && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{event.customer}</span>
                        </div>
                      )}
                      {event.orderNumber && (
                        <div className="flex items-center gap-1">
                          <span>Order: {event.orderNumber}</span>
                        </div>
                      )}
                      {event.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>{event.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {Math.round((new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60))} min
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0">
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {todayEvents.filter(e => e.type === 'repair').length}
              </div>
              <p className="text-sm text-muted-foreground">Repair Tasks</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {todayEvents.filter(e => e.type === 'meeting').length}
              </div>
              <p className="text-sm text-muted-foreground">Meetings</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Math.round(todayEvents.reduce((total, event) => {
                  return total + (new Date(event.endTime).getTime() - new Date(event.startTime).getTime())
                }, 0) / (1000 * 60 * 60))}h
              </div>
              <p className="text-sm text-muted-foreground">Total Hours</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}