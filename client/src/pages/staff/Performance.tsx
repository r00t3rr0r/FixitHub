import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/useToast"
import {
  BarChart3,
  TrendingUp,
  Award,
  Target,
  Clock,
  Star,
  CheckCircle,
  Calendar,
  Trophy,
  Zap
} from "lucide-react"

interface PerformanceData {
  ordersCompleted: number
  averageCompletionTime: number
  customerSatisfaction: number
  efficiency: number
  qualityScore: number
  goals: {
    ordersTarget: number
    ordersAchieved: number
    satisfactionTarget: number
    satisfactionAchieved: number
    efficiencyTarget: number
    efficiencyAchieved: number
  }
  achievements: {
    _id: string
    title: string
    description: string
    earnedAt: string
    icon: string
  }[]
  monthlyStats: {
    month: string
    orders: number
    satisfaction: number
    efficiency: number
  }[]
}

export function Performance() {
  const [performance, setPerformance] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        // Mock performance data
        const mockPerformance: PerformanceData = {
          ordersCompleted: 156,
          averageCompletionTime: 2.3,
          customerSatisfaction: 4.8,
          efficiency: 94,
          qualityScore: 96,
          goals: {
            ordersTarget: 160,
            ordersAchieved: 156,
            satisfactionTarget: 4.5,
            satisfactionAchieved: 4.8,
            efficiencyTarget: 90,
            efficiencyAchieved: 94
          },
          achievements: [
            {
              _id: 'ach1',
              title: 'Quality Master',
              description: 'Maintained 95%+ quality score for 3 months',
              earnedAt: '2024-01-10T00:00:00Z',
              icon: 'trophy'
            },
            {
              _id: 'ach2',
              title: 'Speed Demon',
              description: 'Completed 50 orders in record time',
              earnedAt: '2024-01-05T00:00:00Z',
              icon: 'zap'
            },
            {
              _id: 'ach3',
              title: 'Customer Favorite',
              description: 'Received 4.8+ rating from customers',
              earnedAt: '2023-12-20T00:00:00Z',
              icon: 'star'
            }
          ],
          monthlyStats: [
            { month: 'Oct 2023', orders: 42, satisfaction: 4.6, efficiency: 91 },
            { month: 'Nov 2023', orders: 48, satisfaction: 4.7, efficiency: 93 },
            { month: 'Dec 2023', orders: 52, satisfaction: 4.8, efficiency: 94 },
            { month: 'Jan 2024', orders: 14, satisfaction: 4.9, efficiency: 96 }
          ]
        }

        setPerformance(mockPerformance)
      } catch (error) {
        console.error("Error fetching performance data:", error)
        toast({
          title: "Error",
          description: "Failed to load performance data",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchPerformance()
  }, [toast])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-8 bg-muted rounded w-1/2 mt-2"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!performance) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BarChart3 className="h-8 w-8" />
          Performance Dashboard
        </h1>
        <p className="text-muted-foreground">
          Track your performance metrics and achievements
        </p>
      </div>

      {/* Performance Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Orders Completed
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {performance.ordersCompleted}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              This month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Customer Satisfaction
            </CardTitle>
            <Star className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {performance.customerSatisfaction}/5
            </div>
            <p className="text-xs text-green-600 dark:text-green-400">
              Average rating
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Efficiency Score
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {performance.efficiency}%
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400">
              Above target
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Quality Score
            </CardTitle>
            <Award className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {performance.qualityScore}%
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              Excellent quality
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Goals Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Monthly Goals
          </CardTitle>
          <CardDescription>
            Track your progress towards monthly targets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Orders Completed</span>
                <span className="text-sm text-muted-foreground">
                  {performance.goals.ordersAchieved} / {performance.goals.ordersTarget}
                </span>
              </div>
              <Progress 
                value={(performance.goals.ordersAchieved / performance.goals.ordersTarget) * 100} 
                className="h-2"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Customer Satisfaction</span>
                <span className="text-sm text-muted-foreground">
                  {performance.goals.satisfactionAchieved} / {performance.goals.satisfactionTarget}
                </span>
              </div>
              <Progress 
                value={(performance.goals.satisfactionAchieved / performance.goals.satisfactionTarget) * 100} 
                className="h-2"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Efficiency Score</span>
                <span className="text-sm text-muted-foreground">
                  {performance.goals.efficiencyAchieved}% / {performance.goals.efficiencyTarget}%
                </span>
              </div>
              <Progress 
                value={(performance.goals.efficiencyAchieved / performance.goals.efficiencyTarget) * 100} 
                className="h-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Recent Achievements
          </CardTitle>
          <CardDescription>
            Your latest accomplishments and milestones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {performance.achievements.map((achievement) => (
              <div key={achievement._id} className="p-4 border rounded-lg bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950 dark:to-orange-950">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-full">
                    {achievement.icon === 'trophy' && <Trophy className="h-5 w-5 text-yellow-600" />}
                    {achievement.icon === 'zap' && <Zap className="h-5 w-5 text-yellow-600" />}
                    {achievement.icon === 'star' && <Star className="h-5 w-5 text-yellow-600" />}
                  </div>
                  <div>
                    <h4 className="font-semibold">{achievement.title}</h4>
                    <p className="text-xs text-muted-foreground">
                      {new Date(achievement.earnedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {achievement.description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Monthly Performance Trends
          </CardTitle>
          <CardDescription>
            Your performance over the last few months
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {performance.monthlyStats.map((stat, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{stat.month}</p>
                  <p className="text-sm text-muted-foreground">{stat.orders} orders completed</p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <p className="font-medium">{stat.satisfaction}</p>
                    <p className="text-xs text-muted-foreground">Satisfaction</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium">{stat.efficiency}%</p>
                    <p className="text-xs text-muted-foreground">Efficiency</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}