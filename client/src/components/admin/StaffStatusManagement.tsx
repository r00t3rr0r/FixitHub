import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getAllStaffStatus, type StaffStatus } from '@/api/timeTracking';
import {
  Users,
  Search,
  RefreshCw,
  Clock,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';

const StaffStatusManagement: React.FC = () => {
  const { t } = useTranslation();

  const [staff, setStaff] = useState<StaffStatus[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<StaffStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchStaffStatus = async () => {
    try {
      setLoading(true);
      const response = await getAllStaffStatus();
      setStaff(response.staff);
      setFilteredStaff(response.staff);
    } catch (error) {
      console.error('Failed to fetch staff status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStaffStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let filtered = staff;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(s => s.currentStatus === statusFilter);
    }

    setFilteredStaff(filtered);
  }, [searchQuery, statusFilter, staff]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      offline: { label: t('timeTracking.offline') || 'Offline', variant: 'secondary' as const, color: 'bg-gray-500' },
      online: { label: t('timeTracking.online') || 'Online', variant: 'default' as const, color: 'bg-green-500' },
      working: { label: t('timeTracking.working') || 'Working', variant: 'default' as const, color: 'bg-blue-500' },
      on_break: { label: t('timeTracking.onBreak') || 'On Break', variant: 'outline' as const, color: 'bg-yellow-500' },
      pending: { label: t('timeTracking.pending') || 'Pending', variant: 'outline' as const, color: 'bg-orange-500' }
    };

    const config = statusConfig[status] || statusConfig.offline;
    return (
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${config.color}`} />
        <Badge variant={config.variant}>{config.label}</Badge>
      </div>
    );
  };

  const formatLastActivity = (date: Date | string | null | undefined) => {
    if (!date) return '-';
    const now = new Date();
    const activity = new Date(date);
    const diff = now.getTime() - activity.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return t('timeTracking.justNow') || 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Calculate summary statistics
  const statusCounts = {
    online: staff.filter(s => s.currentStatus === 'online').length,
    working: staff.filter(s => s.currentStatus === 'working').length,
    on_break: staff.filter(s => s.currentStatus === 'on_break').length,
    offline: staff.filter(s => s.currentStatus === 'offline').length
  };

  const totalHoursThisWeek = staff.reduce((sum, s) => sum + (s.hoursThisWeek || 0), 0);
  const averageHoursPerStaff = staff.length > 0 ? totalHoursThisWeek / staff.length : 0;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('timeTracking.staffStatus') || 'Staff Status Management'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('timeTracking.activeStaff') || 'Active Staff'}
                </p>
                <p className="text-2xl font-bold">
                  {statusCounts.online + statusCounts.working + statusCounts.on_break}
                </p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('timeTracking.working') || 'Working'}
                </p>
                <p className="text-2xl font-bold">{statusCounts.working}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('timeTracking.totalHoursThisWeek') || 'Hours This Week'}
                </p>
                <p className="text-2xl font-bold">{Math.round(totalHoursThisWeek)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('timeTracking.avgHoursPerStaff') || 'Avg Hours/Staff'}
                </p>
                <p className="text-2xl font-bold">{Math.round(averageHoursPerStaff * 10) / 10}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('timeTracking.staffStatus') || 'Staff Status'}
            </div>
            <Button
              onClick={fetchStaffStatus}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('common.refresh') || 'Refresh'}
            </Button>
          </CardTitle>
          <CardDescription>
            {t('timeTracking.staffStatusDescription') || 'Monitor staff activity and work hours in real-time'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('timeTracking.searchStaff') || 'Search staff...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                {t('common.all') || 'All'}
              </Button>
              <Button
                variant={statusFilter === 'online' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('online')}
              >
                {t('timeTracking.online') || 'Online'}
              </Button>
              <Button
                variant={statusFilter === 'working' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('working')}
              >
                {t('timeTracking.working') || 'Working'}
              </Button>
              <Button
                variant={statusFilter === 'on_break' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('on_break')}
              >
                {t('timeTracking.onBreak') || 'Break'}
              </Button>
              <Button
                variant={statusFilter === 'offline' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('offline')}
              >
                {t('timeTracking.offline') || 'Offline'}
              </Button>
            </div>
          </div>

          {/* Staff Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.staff') || 'Staff'}</TableHead>
                  <TableHead>{t('timeTracking.status') || 'Status'}</TableHead>
                  <TableHead>{t('timeTracking.currentOrder') || 'Current Order'}</TableHead>
                  <TableHead>{t('timeTracking.lastActivity') || 'Last Activity'}</TableHead>
                  <TableHead className="text-right">{t('timeTracking.hoursThisWeek') || 'Week Hours'}</TableHead>
                  <TableHead className="text-right">{t('timeTracking.hoursThisMonth') || 'Month Hours'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {t('timeTracking.noStaffFound') || 'No staff members found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStaff.map((member) => (
                    <TableRow key={member._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={member.avatar} />
                            <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{member.name}</div>
                            <div className="text-sm text-muted-foreground">{member.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(member.currentStatus)}</TableCell>
                      <TableCell>
                        {member.currentOrder ? (
                          <span className="font-mono text-sm">{member.currentOrder}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatLastActivity(member.lastActivity)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {member.hoursThisWeek ? `${Math.round(member.hoursThisWeek * 10) / 10}h` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {member.hoursThisMonth ? `${Math.round(member.hoursThisMonth * 10) / 10}h` : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffStatusManagement;
