import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import {
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  getCurrentStatus,
  getTimeTrackingSummary,
  type CurrentStatus,
  type TimeTrackingSummary
} from '@/api/timeTracking';
import {
  Clock,
  LogIn,
  LogOut,
  Coffee,
  PlayCircle,
  Loader2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const TimeTrackingWidget: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [status, setStatus] = useState<CurrentStatus | null>(null);
  const [summary, setSummary] = useState<TimeTrackingSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch current status and summary
  const fetchData = async () => {
    try {
      setLoading(true);
      const [statusData, summaryData] = await Promise.all([
        getCurrentStatus(),
        getTimeTrackingSummary()
      ]);
      setStatus(statusData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Failed to fetch time tracking data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleClockIn = async () => {
    try {
      setActionLoading(true);
      const result = await clockIn();
      toast({
        title: t('timeTracking.clockedIn') || 'Clocked In',
        description: result.message
      });
      await fetchData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('timeTracking.error') || 'Error',
        description: error.message
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    try {
      setActionLoading(true);
      const result = await clockOut();
      toast({
        title: t('timeTracking.clockedOut') || 'Clocked Out',
        description: `${t('timeTracking.workedToday') || 'Worked today'}: ${Math.round((result.session.workDuration || 0) / 60 * 100) / 100} ${t('timeTracking.hours') || 'hours'}`
      });
      await fetchData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('timeTracking.error') || 'Error',
        description: error.message
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartBreak = async () => {
    try {
      setActionLoading(true);
      const result = await startBreak();
      toast({
        title: t('timeTracking.breakStarted') || 'Break Started',
        description: result.message
      });
      await fetchData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('timeTracking.error') || 'Error',
        description: error.message
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndBreak = async () => {
    try {
      setActionLoading(true);
      const result = await endBreak();
      toast({
        title: t('timeTracking.breakEnded') || 'Break Ended',
        description: result.message
      });
      await fetchData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('timeTracking.error') || 'Error',
        description: error.message
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (statusValue: string) => {
    const statusConfig = {
      offline: { label: t('timeTracking.offline') || 'Offline', variant: 'secondary' as const },
      online: { label: t('timeTracking.online') || 'Online', variant: 'default' as const },
      working: { label: t('timeTracking.working') || 'Working', variant: 'default' as const },
      on_break: { label: t('timeTracking.onBreak') || 'On Break', variant: 'outline' as const },
      pending: { label: t('timeTracking.pending') || 'Pending', variant: 'outline' as const }
    };

    const config = statusConfig[statusValue] || statusConfig.offline;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatTime = (date: Date | string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('timeTracking.title') || 'Time Tracking'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('timeTracking.title') || 'Time Tracking'}
          </div>
          {status && getStatusBadge(status.status)}
        </CardTitle>
        <CardDescription>
          {t('timeTracking.description') || 'Track your work hours and manage breaks'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Clock In/Out Actions */}
        <div className="flex flex-col gap-2">
          {status?.status === 'offline' ? (
            <Button
              onClick={handleClockIn}
              disabled={actionLoading}
              className="w-full"
              size="lg"
            >
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              {t('timeTracking.clockIn') || 'Clock In'}
            </Button>
          ) : (
            <>
              <Button
                onClick={handleClockOut}
                disabled={actionLoading}
                variant="destructive"
                className="w-full"
                size="lg"
              >
                {actionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="mr-2 h-4 w-4" />
                )}
                {t('timeTracking.clockOut') || 'Clock Out'}
              </Button>

              {status?.status === 'on_break' ? (
                <Button
                  onClick={handleEndBreak}
                  disabled={actionLoading}
                  variant="outline"
                  className="w-full"
                >
                  {actionLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlayCircle className="mr-2 h-4 w-4" />
                  )}
                  {t('timeTracking.endBreak') || 'End Break'}
                </Button>
              ) : (
                <Button
                  onClick={handleStartBreak}
                  disabled={actionLoading || status?.status === 'offline'}
                  variant="outline"
                  className="w-full"
                >
                  {actionLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Coffee className="mr-2 h-4 w-4" />
                  )}
                  {t('timeTracking.startBreak') || 'Start Break'}
                </Button>
              )}
            </>
          )}
        </div>

        {/* Current Session Info */}
        {status?.status !== 'offline' && (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('timeTracking.clockedInAt') || 'Clocked in at'}:</span>
              <span className="font-medium">{formatTime(status?.lastClockIn)}</span>
            </div>
            {status?.currentOrder && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('timeTracking.currentOrder') || 'Current order'}:</span>
                <span className="font-medium">{status.currentOrder.orderNumber}</span>
              </div>
            )}
          </div>
        )}

        {/* Time Summary */}
        {summary && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t('timeTracking.summary') || 'Time Summary'}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-bold">{summary.summary.hoursToday}</div>
                <div className="text-xs text-muted-foreground">{t('timeTracking.hoursToday') || 'Hours Today'}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-bold">{summary.summary.hoursThisWeek}</div>
                <div className="text-xs text-muted-foreground">{t('timeTracking.hoursThisWeek') || 'Hours This Week'}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-bold">{summary.summary.hoursThisMonth}</div>
                <div className="text-xs text-muted-foreground">{t('timeTracking.hoursThisMonth') || 'Hours This Month'}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-bold">{summary.summary.averageHoursPerDay}</div>
                <div className="text-xs text-muted-foreground">{t('timeTracking.avgPerDay') || 'Avg/Day'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Last Clock Out */}
        {status?.status === 'offline' && status?.lastClockOut && (
          <div className="text-sm text-muted-foreground text-center">
            {t('timeTracking.lastClockedOut') || 'Last clocked out at'} {formatTime(status.lastClockOut)}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TimeTrackingWidget;
