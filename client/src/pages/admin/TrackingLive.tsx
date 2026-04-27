import { useCallback, useEffect, useState } from 'react';
import {
  liveTrackingApi,
  LiveTrackingSummary,
  ActiveSession,
  TopItem,
  TrackingEvent,
  PublicLiveStats,
} from '../../api/liveTracking';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Separator } from '../../components/ui/separator';
import { 
  Activity, 
  Eye, 
  MousePointer, 
  Users, 
  TrendingUp,
  Monitor,
  Globe,
  Clock,
  Smartphone,
  Tablet,
  Laptop,
  BarChart3,
  ArrowUpRight,
  Circle
} from 'lucide-react';
import { cn } from '../../lib/utils';

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: string;
  description?: string;
  color?: 'blue' | 'green' | 'purple' | 'orange';
}

function MetricCard({ title, value, icon, trend, description, color = 'blue' }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
  };

  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn('rounded-lg p-2', colorClasses[color])}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className="flex items-center mt-2 text-xs text-green-600 dark:text-green-400">
            <ArrowUpRight className="h-3 w-3 mr-1" />
            {trend}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Top Items List Component
interface TopItemsListProps {
  title: string;
  items: TopItem[];
  icon: React.ReactNode;
  emptyMessage?: string;
}

function TopItemsList({ title, items, icon, emptyMessage = 'Keine Daten verfügbar' }: TopItemsListProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          {icon}
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px]">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{emptyMessage}</p>
          ) : (
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0 shrink-0">
                      {idx + 1}
                    </Badge>
                    <span className="text-sm truncate" title={item.title || item._id}>
                      {item.title || item._id || 'Unknown'}
                    </span>
                  </div>
                  <Badge variant="secondary" className="ml-2 shrink-0">
                    {item.count}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Session Row Component
interface SessionRowProps {
  session: ActiveSession;
  index: number;
}

function SessionRow({ session, index }: SessionRowProps) {
  const getDeviceIcon = (device: string) => {
    const deviceLower = device?.toLowerCase() || '';
    if (deviceLower.includes('mobile')) return <Smartphone className="h-4 w-4" />;
    if (deviceLower.includes('tablet')) return <Tablet className="h-4 w-4" />;
    return <Laptop className="h-4 w-4" />;
  };

  const getDeviceLabel = () => {
    if (session.device_model && session.device_model !== 'Unknown') {
      return session.device_model;
    }
    if (session.device_type === 'mobile') return 'Mobile';
    if (session.device_type === 'tablet') return 'Tablet';
    return 'Desktop';
  };

  const getBrowserLabel = () => {
    if (session.browser_version) {
      return `${session.browser || 'Unknown Browser'} ${session.browser_version}`;
    }
    return session.browser || 'Unknown Browser';
  };

  const getOsLabel = () => {
    if (session.os_version) {
      return `${session.os || 'Unknown OS'} ${session.os_version}`;
    }
    return session.os || 'Unknown OS';
  };

  const getTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Gerade eben';
    if (minutes === 1) return 'Vor 1 Minute';
    if (minutes < 60) return `Vor ${minutes} Minuten`;
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return 'Vor 1 Stunde';
    return `Vor ${hours} Stunden`;
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Badge variant="outline" className="w-8 h-8 flex items-center justify-center p-0 shrink-0">
          {index + 1}
        </Badge>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {getDeviceIcon(session.device_type)}
            <span className="font-medium text-sm truncate">{session.current_page || '/'}</span>
          </div>
          <div className="text-xs text-muted-foreground mb-1 truncate">
            {getDeviceLabel()} • {getOsLabel()}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {session.country || 'Unknown'}
            </span>
            <Separator orientation="vertical" className="h-3" />
            <span>{getBrowserLabel()}</span>
            {session.platform && (
              <>
                <Separator orientation="vertical" className="h-3" />
                <span>{session.platform}</span>
              </>
            )}
            {session.source && (
              <>
                <Separator orientation="vertical" className="h-3" />
                <span>via {session.source}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground sm:ml-auto">
        <div className="flex items-center gap-1">
          <MousePointer className="h-3 w-3" />
          <span>{session.event_count} Events</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{getTimeAgo(session.last_activity)}</span>
        </div>
      </div>
    </div>
  );
}

// Event Row Component
interface EventRowProps {
  event: TrackingEvent;
}

function EventRow({ event }: EventRowProps) {
  const getTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 5) return 'Jetzt';
    if (seconds < 60) return `Vor ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes === 1) return 'Vor 1m';
    return `Vor ${minutes}m`;
  };

  const getEventColor = (eventName: string) => {
    switch (eventName) {
      case 'page_view': return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400';
      case 'click': return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400';
      case 'form_submit': return 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-md hover:bg-accent/50 transition-colors">
      <Circle className="h-2 w-2 fill-green-500 text-green-500 animate-pulse shrink-0" />
      <Badge className={cn('shrink-0', getEventColor(event.event_name))}>
        {event.event_name}
      </Badge>
      <span className="text-sm flex-1 truncate">{event.page_path || '/'}</span>
      <span className="text-xs text-muted-foreground shrink-0">
        {getTimeAgo(event.occurred_at)}
      </span>
    </div>
  );
}

export default function TrackingLive() {
  const [timeRange, setTimeRange] = useState(30);
  const [summary, setSummary] = useState<LiveTrackingSummary | null>(null);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [topPages, setTopPages] = useState<TopItem[]>([]);
  const [topReferrers, setTopReferrers] = useState<TopItem[]>([]);
  const [topBrowsers, setTopBrowsers] = useState<TopItem[]>([]);
  const [topDevices, setTopDevices] = useState<TopItem[]>([]);
  const [topCountries, setTopCountries] = useState<TopItem[]>([]);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [publicStats, setPublicStats] = useState<PublicLiveStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const heartbeatEvents = events.filter((event) => event.event_name === 'heartbeat').length;
  const clickEvents = events.filter((event) => event.event_name === 'click').length;
  const hasAdminStream = sessions.length > 0 || events.length > 0;
  const hasPublicStream = (publicStats?.active_visitors_last_5m || 0) > 0;
  const showPublicFallback = !hasAdminStream && hasPublicStream;

  const fetchData = useCallback(async () => {
    try {
      const [summaryData, sessionsData, eventsData, publicStatsData] = await Promise.all([
        liveTrackingApi.getSummary(timeRange),
        liveTrackingApi.getActiveSessions(timeRange),
        liveTrackingApi.getEvents(20, timeRange),
        liveTrackingApi.getPublicLiveStats(),
      ]);
      setSummary(summaryData);
      setSessions(sessionsData);
      setEvents(eventsData);
      setPublicStats(publicStatsData);
      setLastUpdate(new Date());
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch live tracking data:', error);
      setIsLoading(false);
    }
  }, [timeRange]);

  const fetchBreakdowns = useCallback(async () => {
    try {
      const [pages, referrers, browsers, devices, countries] = await Promise.all([
        liveTrackingApi.getTopPages(timeRange, 10),
        liveTrackingApi.getTopReferrers(timeRange, 10),
        liveTrackingApi.getTopBrowsers(timeRange, 10),
        liveTrackingApi.getTopDevices(timeRange, 10),
        liveTrackingApi.getTopCountries(timeRange, 10),
      ]);
      setTopPages(pages);
      setTopReferrers(referrers);
      setTopBrowsers(browsers);
      setTopDevices(devices);
      setTopCountries(countries);
    } catch (error) {
      console.error('Failed to fetch breakdowns:', error);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
    fetchBreakdowns();

    const dataInterval = setInterval(() => {
      fetchData();
      fetchBreakdowns();
    }, 10000); // Update every 10 seconds

    return () => clearInterval(dataInterval);
  }, [fetchData, fetchBreakdowns]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Activity className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Lade Live-Tracking-Daten...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Tracking</h1>
          <div className="flex items-center gap-2 mt-2">
            <Circle className="h-2 w-2 fill-green-500 text-green-500 animate-pulse" />
            <p className="text-sm text-muted-foreground">
              Aktualisiert: {lastUpdate.toLocaleTimeString('de-DE')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={timeRange === 5 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange(5)}
          >
            5 Min
          </Button>
          <Button
            variant={timeRange === 30 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange(30)}
          >
            30 Min
          </Button>
          <Button
            variant={timeRange === 60 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange(60)}
          >
            1 Std
          </Button>
        </div>
      </div>

      {showPublicFallback && (
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-blue-700 dark:text-blue-300">
                  Tracking ist aktiv, aber der Admin-Stream ist aktuell leer.
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  Fallback auf den öffentlichen Live-Stream der letzten 5 Minuten.
                </p>
              </div>
              <Badge variant="secondary" className="w-fit">
                {publicStats?.active_visitors_last_5m || 0} aktive Besucher (5m)
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Aktive Besucher"
          value={timeRange === 5 
            ? (summary?.active_visitors_5m || 0)
            : (summary?.active_visitors_30m || 0)
          }
          icon={<Users className="h-4 w-4" />}
          description={`In den letzten ${timeRange} Minuten`}
          color="blue"
        />
        <MetricCard
          title="Seitenaufrufe"
          value={summary?.page_views_5m || 0}
          icon={<Eye className="h-4 w-4" />}
          description="Letzte 5 Minuten"
          color="green"
        />
        <MetricCard
          title="Neue Sessions"
          value={summary?.new_sessions_30m || 0}
          icon={<TrendingUp className="h-4 w-4" />}
          description="Letzte 30 Minuten"
          color="purple"
        />
        <MetricCard
          title="Klick-Events"
          value={clickEvents}
          icon={<MousePointer className="h-4 w-4" />}
          description="Live Klick-Tracking"
          color="orange"
        />
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Heartbeat-Events"
          value={heartbeatEvents}
          icon={<Activity className="h-4 w-4" />}
          description="Automatische Aktivitäts-Pings"
          color="blue"
        />
        <MetricCard
          title="Gesamt-Events"
          value={events.length}
          icon={<TrendingUp className="h-4 w-4" />}
          description="Aktueller Live-Event-Stream"
          color="green"
        />
        <MetricCard
          title="Public Besucher (5m)"
          value={publicStats?.active_visitors_last_5m || 0}
          icon={<Users className="h-4 w-4" />}
          description="Fallback-Tracking-Quelle"
          color="purple"
        />
      </div>

      {/* Main Content */}
      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Sessions</span>
            <Badge variant="secondary" className="ml-1">{sessions.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Live Events</span>
          </TabsTrigger>
        </TabsList>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Aktive Sessions</CardTitle>
              <CardDescription>
                Echtzeit-Übersicht aller aktiven Besucher auf Ihrer Website
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                {sessions.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Keine aktiven Sessions</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Besucher werden hier angezeigt, sobald sie Ihre Website aufrufen
                    </p>
                    {showPublicFallback && publicStats && publicStats.top_pages.length > 0 && (
                      <div className="mt-6 text-left max-w-lg mx-auto rounded-lg border bg-card p-4">
                        <p className="text-sm font-medium mb-3">Öffentlicher Stream: Top Seiten (5m)</p>
                        <div className="space-y-2">
                          {publicStats.top_pages.slice(0, 5).map((page, idx) => (
                            <div key={`${page._id}-${idx}`} className="flex items-center justify-between text-sm">
                              <span className="truncate pr-2">{page._id || '/'}</span>
                              <Badge variant="secondary">{page.count}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((session, idx) => (
                      <SessionRow key={session._id} session={session} index={idx} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <TopItemsList
              title="Top Seiten"
              items={topPages}
              icon={<Eye className="h-4 w-4" />}
              emptyMessage="Keine Seitenaufrufe"
            />
            <TopItemsList
              title="Top Referrer"
              items={topReferrers}
              icon={<Globe className="h-4 w-4" />}
              emptyMessage="Keine Referrer-Daten"
            />
            <TopItemsList
              title="Top Browser"
              items={topBrowsers}
              icon={<Monitor className="h-4 w-4" />}
              emptyMessage="Keine Browser-Daten"
            />
            <TopItemsList
              title="Gerätetypen"
              items={topDevices}
              icon={<Smartphone className="h-4 w-4" />}
              emptyMessage="Keine Geräte-Daten"
            />
            <TopItemsList
              title="Top Länder"
              items={topCountries}
              icon={<Globe className="h-4 w-4" />}
              emptyMessage="Keine Länder-Daten"
            />
          </div>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Live Event Stream</CardTitle>
                  <CardDescription>
                    Alle Events werden in Echtzeit angezeigt
                  </CardDescription>
                </div>
                <Circle className="h-3 w-3 fill-green-500 text-green-500 animate-pulse" />
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                {events.length === 0 ? (
                  <div className="text-center py-12">
                    <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Keine Events</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Events werden hier in Echtzeit angezeigt
                    </p>
                    {showPublicFallback && (
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-3">
                        Hinweis: Public Stream ist aktiv, der Admin-Event-Stream liefert aktuell noch keine Einträge.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {events.map((event, idx) => (
                      <EventRow key={`${event._id}-${idx}`} event={event} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
