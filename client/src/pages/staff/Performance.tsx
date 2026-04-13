import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TrendingUp, Target, Award, Clock, Users, DollarSign, Star, Calendar, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/contexts/AuthContext';

interface PerformanceMetrics {
  ordersCompleted: number;
  averageCompletionTime: number;
  customerSatisfaction: number;
  efficiency: number;
  qualityScore: number;
  revenue: number;
  hoursWorked: number;
}

interface PerformanceGoals {
  ordersTarget: number;
  revenueTarget: number;
  satisfactionTarget: number;
}

interface Achievement {
  title: string;
  description: string;
  earnedAt: string;
  icon: string;
}

interface PerformanceData {
  _id: string;
  period: string;
  metrics: PerformanceMetrics;
  goals: PerformanceGoals;
  achievements: Achievement[];
}

export function Performance() {
  const { t } = useTranslation()
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [goalsDialogOpen, setGoalsDialogOpen] = useState(false);
  const [newGoals, setNewGoals] = useState<PerformanceGoals>({
    ordersTarget: 0,
    revenueTarget: 0,
    satisfactionTarget: 4.5
  });
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  const fetchPerformanceData = async () => {
    try {
      setLoading(true);
      
      // Mock data - replace with actual API call
      const mockPerformance: PerformanceData = {
        _id: '1',
        period: new Date().toISOString().slice(0, 7), // Current month
        metrics: {
          ordersCompleted: 45,
          averageCompletionTime: 2.5,
          customerSatisfaction: 4.7,
          efficiency: 92,
          qualityScore: 96,
          revenue: 12500,
          hoursWorked: 160
        },
        goals: {
          ordersTarget: 50,
          revenueTarget: 15000,
          satisfactionTarget: 4.5
        },
        achievements: [
          {
            title: 'Speed Demon',
            description: 'Completed 10 orders in a single day',
            earnedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
            icon: '⚡'
          },
          {
            title: 'Customer Favorite',
            description: 'Achieved 5-star rating from 20 customers',
            earnedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
            icon: '⭐'
          },
          {
            title: 'Quality Master',
            description: 'Maintained 95%+ quality score for 30 days',
            earnedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
            icon: '🏆'
          }
        ]
      };

      setPerformance(mockPerformance);
      setNewGoals(mockPerformance.goals);
    } catch (error) {
      console.error('Error fetching performance data:', error);
      toast({
        title: t('common.error'),
        description: t('staffPerformance.failedToLoad'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGoals = async () => {
    try {
      // Mock API call - replace with actual implementation
      console.log('Updating goals:', newGoals);
      
      if (performance) {
        setPerformance({
          ...performance,
          goals: newGoals
        });
      }

      toast({
        title: t('common.success'),
        description: t('staffPerformance.goalsUpdated'),
      });
      
      setGoalsDialogOpen(false);
    } catch (error) {
      console.error('Error updating goals:', error);
      toast({
        title: t('common.error'),
        description: t('staffPerformance.failedToUpdateGoals'),
        variant: "destructive",
      });
    }
  };

  const getProgressColor = (current: number, target: number) => {
    const percentage = (current / target) * 100;
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!performance) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('staffPerformance.noData')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('staffPerformance.title')}</h1>
          <p className="text-muted-foreground">
            {t('staffPerformance.subtitle')}
          </p>
        </div>
        <Dialog open={goalsDialogOpen} onOpenChange={setGoalsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Target className="h-4 w-4 mr-2" />
              {t('staffPerformance.updateGoals')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('staffPerformance.updatePerformanceGoals')}</DialogTitle>
              <DialogDescription>
                {t('staffPerformance.setTargets')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ordersTarget">{t('staffPerformance.ordersTarget')}</Label>
                <Input
                  id="ordersTarget"
                  type="number"
                  value={newGoals.ordersTarget}
                  onChange={(e) => setNewGoals({
                    ...newGoals,
                    ordersTarget: parseInt(e.target.value)
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revenueTarget">{t('staffPerformance.revenueTarget')}</Label>
                <Input
                  id="revenueTarget"
                  type="number"
                  value={newGoals.revenueTarget}
                  onChange={(e) => setNewGoals({
                    ...newGoals,
                    revenueTarget: parseInt(e.target.value)
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="satisfactionTarget">{t('staffPerformance.satisfactionTarget')}</Label>
                <Input
                  id="satisfactionTarget"
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={newGoals.satisfactionTarget}
                  onChange={(e) => setNewGoals({
                    ...newGoals,
                    satisfactionTarget: parseFloat(e.target.value)
                  })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGoalsDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleUpdateGoals}>
                {t('staffPerformance.updateGoals')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t('staffPerformance.overview')}</TabsTrigger>
          <TabsTrigger value="metrics">{t('staffPerformance.detailedMetrics')}</TabsTrigger>
          <TabsTrigger value="achievements">{t('staffPerformance.achievements')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Key Performance Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('staffPerformance.ordersCompleted')}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{performance.metrics.ordersCompleted}</div>
                <div className="flex items-center gap-2 mt-2">
                  <Progress 
                    value={(performance.metrics.ordersCompleted / performance.goals.ordersTarget) * 100} 
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">
                    {performance.goals.ordersTarget}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('staffPerformance.revenueGenerated')}</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(performance.metrics.revenue)}</div>
                <div className="flex items-center gap-2 mt-2">
                  <Progress 
                    value={(performance.metrics.revenue / performance.goals.revenueTarget) * 100} 
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(performance.goals.revenueTarget)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('staffPerformance.customerSatisfaction')}</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{performance.metrics.customerSatisfaction.toFixed(1)}</div>
                <div className="flex items-center gap-2 mt-2">
                  <Progress 
                    value={(performance.metrics.customerSatisfaction / 5) * 100} 
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">5.0</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('staffPerformance.efficiencyScore')}</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{performance.metrics.efficiency}%</div>
                <div className="flex items-center gap-2 mt-2">
                  <Progress value={performance.metrics.efficiency} className="flex-1" />
                  <span className="text-sm text-muted-foreground">100%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {t('staffPerformance.timeMetrics')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{t('staffPerformance.avgCompletionTime')}</span>
                  <span className="text-2xl font-bold">{performance.metrics.averageCompletionTime}h</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{t('staffPerformance.hoursWorked')}</span>
                  <span className="text-2xl font-bold">{performance.metrics.hoursWorked}h</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{t('staffPerformance.productivityRate')}</span>
                  <span className="text-2xl font-bold">
                    {(performance.metrics.ordersCompleted / performance.metrics.hoursWorked * 8).toFixed(1)}/day
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  {t('staffPerformance.qualityMetrics')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{t('staffPerformance.qualityScore')}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{performance.metrics.qualityScore}%</span>
                    <Badge variant={performance.metrics.qualityScore >= 95 ? 'default' : 'secondary'}>
                      {performance.metrics.qualityScore >= 95 ? t('staffPerformance.excellent') : t('staffPerformance.good')}
                    </Badge>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{t('staffPerformance.customerRating')}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-2xl font-bold">{performance.metrics.customerSatisfaction.toFixed(1)}</span>
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{t('staffPerformance.revenuePerOrder')}</span>
                  <span className="text-2xl font-bold">
                    {formatCurrency(performance.metrics.revenue / performance.metrics.ordersCompleted)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('staffPerformance.goalProgress')}</CardTitle>
                <CardDescription>{t('staffPerformance.goalProgressDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{t('staffPerformance.ordersCompleted')}</span>
                    <span>{performance.metrics.ordersCompleted} / {performance.goals.ordersTarget}</span>
                  </div>
                  <Progress 
                    value={(performance.metrics.ordersCompleted / performance.goals.ordersTarget) * 100}
                    className="h-2"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{t('staffPerformance.revenueTarget')}</span>
                    <span>{formatCurrency(performance.metrics.revenue)} / {formatCurrency(performance.goals.revenueTarget)}</span>
                  </div>
                  <Progress 
                    value={(performance.metrics.revenue / performance.goals.revenueTarget) * 100}
                    className="h-2"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{t('staffPerformance.customerSatisfaction')}</span>
                    <span>{performance.metrics.customerSatisfaction.toFixed(1)} / {performance.goals.satisfactionTarget}</span>
                  </div>
                  <Progress 
                    value={(performance.metrics.customerSatisfaction / performance.goals.satisfactionTarget) * 100}
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('staffPerformance.performanceBreakdown')}</CardTitle>
                <CardDescription>{t('staffPerformance.detailedPerformanceMetrics')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-blue-600">{performance.metrics.efficiency}%</p>
                    <p className="text-sm text-muted-foreground">{t('staffPerformance.efficiency')}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-green-600">{performance.metrics.qualityScore}%</p>
                    <p className="text-sm text-muted-foreground">{t('staffPerformance.quality')}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-purple-600">{performance.metrics.averageCompletionTime}h</p>
                    <p className="text-sm text-muted-foreground">{t('staffPerformance.avgTime')}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-orange-600">{performance.metrics.hoursWorked}h</p>
                    <p className="text-sm text-muted-foreground">{t('staffPerformance.hoursWorked')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                {t('staffPerformance.recentAchievements')}
              </CardTitle>
              <CardDescription>
                {t('staffPerformance.achievementsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {performance.achievements.map((achievement, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="text-2xl">{achievement.icon}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{achievement.title}</h3>
                      <p className="text-sm text-muted-foreground">{achievement.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('staffPerformance.earnedOn')} {new Date(achievement.earnedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      <Calendar className="h-3 w-3 mr-1" />
                      {new Date(achievement.earnedAt).toLocaleDateString()}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}