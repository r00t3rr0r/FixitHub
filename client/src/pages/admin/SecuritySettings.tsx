import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Shield, Users, Activity, AlertTriangle, UserX, Ban, RefreshCw, Eye } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import {
  getSecuritySettings,
  updateSecuritySettings,
  forceLogoutUser,
  blockIpAddress,
  getSecurityAuditLog,
  type SecuritySettings as SecuritySettingsType,
  type LoginAttempt,
  type ActiveSession,
  type SecurityEvent,
  type AuditLogEntry
} from '@/api/security';

export function SecuritySettings() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<SecuritySettingsType | null>(null);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blockIpDialog, setBlockIpDialog] = useState(false);
  const [selectedIp, setSelectedIp] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const fetchSecurityData = async () => {
    try {
      setLoading(true);
      const [settingsResponse, auditResponse] = await Promise.all([
        getSecuritySettings(),
        getSecurityAuditLog()
      ]);

      console.log('Security settings response:', settingsResponse);
      console.log('Audit response:', auditResponse);

      // Fix the data extraction - the response structure is nested
      const securityData = settingsResponse.data.settings;
      
      setSettings(securityData.settings);
      setLoginAttempts(securityData.loginAttempts);
      setActiveSessions(securityData.activeSessions);
      setSecurityEvents(securityData.securityEvents);
      setAuditLog(auditResponse.data.logs);
    } catch (error) {
      console.error('Error fetching security data:', error);
      toast({
        title: t('common.error'),
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      await updateSecuritySettings(settings);

      toast({
        title: t('common.success'),
        description: "Security settings updated successfully",
      });
    } catch (error) {
      console.error('Error updating security settings:', error);
      toast({
        title: t('common.error'),
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleForceLogout = async (userId: string) => {
    try {
      await forceLogoutUser(userId);
      toast({
        title: t('common.success'),
        description: t('securitySettings.forceLogoutSuccess'),
      });
      fetchSecurityData();
    } catch (error) {
      console.error('Error forcing logout:', error);
      toast({
        title: t('common.error'),
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleBlockIp = async () => {
    if (!selectedIp) return;

    try {
      await blockIpAddress(selectedIp, blockReason);
      toast({
        title: t('common.success'),
        description: t('securitySettings.ipBlockedSuccess'),
      });
      setBlockIpDialog(false);
      setSelectedIp('');
      setBlockReason('');
      fetchSecurityData();
    } catch (error) {
      console.error('Error blocking IP:', error);
      toast({
        title: t('common.error'),
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Add null check for settings
  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Failed to load security settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('securitySettings.title')}</h1>
        <p className="text-muted-foreground">
          {t('securitySettings.description')}
        </p>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="events">Security Events</TabsTrigger>
          <TabsTrigger value="audit">{t('securitySettings.auditLog')}</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('securitySettings.passwordPolicy')}
              </CardTitle>
              <CardDescription>
                Configure password requirements for user accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minLength">Minimum Length</Label>
                  <Input
                    id="minLength"
                    type="number"
                    value={settings?.passwordPolicy?.minLength || 8}
                    onChange={(e) => setSettings(prev => prev ? {
                      ...prev,
                      passwordPolicy: {
                        ...prev.passwordPolicy,
                        minLength: parseInt(e.target.value)
                      }
                    } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">{t('securitySettings.sessionTimeout')}</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    value={settings?.sessionTimeout || 3600}
                    onChange={(e) => setSettings(prev => prev ? {
                      ...prev,
                      sessionTimeout: parseInt(e.target.value)
                    } : null)}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="requireUppercase">Require Uppercase Letters</Label>
                  <Switch
                    id="requireUppercase"
                    checked={settings?.passwordPolicy?.requireUppercase || false}
                    onCheckedChange={(checked) => setSettings(prev => prev ? {
                      ...prev,
                      passwordPolicy: {
                        ...prev.passwordPolicy,
                        requireUppercase: checked
                      }
                    } : null)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="requireLowercase">Require Lowercase Letters</Label>
                  <Switch
                    id="requireLowercase"
                    checked={settings?.passwordPolicy?.requireLowercase || false}
                    onCheckedChange={(checked) => setSettings(prev => prev ? {
                      ...prev,
                      passwordPolicy: {
                        ...prev.passwordPolicy,
                        requireLowercase: checked
                      }
                    } : null)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="requireNumbers">Require Numbers</Label>
                  <Switch
                    id="requireNumbers"
                    checked={settings?.passwordPolicy?.requireNumbers || false}
                    onCheckedChange={(checked) => setSettings(prev => prev ? {
                      ...prev,
                      passwordPolicy: {
                        ...prev.passwordPolicy,
                        requireNumbers: checked
                      }
                    } : null)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="requireSpecialChars">Require Special Characters</Label>
                  <Switch
                    id="requireSpecialChars"
                    checked={settings?.passwordPolicy?.requireSpecialChars || false}
                    onCheckedChange={(checked) => setSettings(prev => prev ? {
                      ...prev,
                      passwordPolicy: {
                        ...prev.passwordPolicy,
                        requireSpecialChars: checked
                      }
                    } : null)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="enableTwoFactor">{t('securitySettings.twoFactorAuth')}</Label>
                  <Switch
                    id="enableTwoFactor"
                    checked={settings?.enableTwoFactor || false}
                    onCheckedChange={(checked) => setSettings(prev => prev ? {
                      ...prev,
                      enableTwoFactor: checked
                    } : null)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
                  <Input
                    id="maxLoginAttempts"
                    type="number"
                    value={settings?.maxLoginAttempts || 5}
                    onChange={(e) => setSettings(prev => prev ? {
                      ...prev,
                      maxLoginAttempts: parseInt(e.target.value)
                    } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lockoutDuration">Lockout Duration (seconds)</Label>
                  <Input
                    id="lockoutDuration"
                    type="number"
                    value={settings?.lockoutDuration || 900}
                    onChange={(e) => setSettings(prev => prev ? {
                      ...prev,
                      lockoutDuration: parseInt(e.target.value)
                    } : null)}
                  />
                </div>
              </div>

              <Button onClick={handleSaveSettings} disabled={saving}>
                {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                {t('common.save')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('securitySettings.activeSessions')} ({activeSessions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeSessions.map((session) => (
                    <div key={session._id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{session.email}</p>
                        <p className="text-sm text-muted-foreground">{session.ipAddress}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('securitySettings.lastActivity')}: {new Date(session.lastActivity).toLocaleString()}
                        </p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <UserX className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('securitySettings.forceLogout')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('securitySettings.confirmForceLogout')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleForceLogout(session._id)}>
                              {t('securitySettings.forceLogout')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  {t('securitySettings.loginAttempts')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {loginAttempts.map((attempt) => (
                    <div key={attempt._id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{attempt.email}</p>
                        <p className="text-sm text-muted-foreground">{attempt.ipAddress}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(attempt.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={attempt.success ? 'default' : 'destructive'}>
                          {attempt.success ? 'Success' : 'Failed'}
                        </Badge>
                        {!attempt.success && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedIp(attempt.ipAddress);
                              setBlockIpDialog(true);
                            }}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Security Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>{t('securitySettings.ipAddress')}</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>{t('securitySettings.timestamp')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {securityEvents.map((event) => (
                    <TableRow key={event._id}>
                      <TableCell className="font-medium">{event.type}</TableCell>
                      <TableCell>{event.description}</TableCell>
                      <TableCell>{event.ipAddress}</TableCell>
                      <TableCell>
                        <Badge variant={getSeverityColor(event.severity)}>
                          {event.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(event.timestamp).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {t('securitySettings.auditLog')}
              </CardTitle>
              <CardDescription>
                Track all security-related actions and changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('securitySettings.action')}</TableHead>
                    <TableHead>Performed By</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>{t('securitySettings.ipAddress')}</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>{t('securitySettings.timestamp')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLog.map((entry) => (
                    <TableRow key={entry._id}>
                      <TableCell className="font-medium">{entry.action}</TableCell>
                      <TableCell>{entry.performedBy}</TableCell>
                      <TableCell>{entry.targetUser || '-'}</TableCell>
                      <TableCell>{entry.ipAddress}</TableCell>
                      <TableCell>{entry.details}</TableCell>
                      <TableCell>{new Date(entry.timestamp).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Block IP Dialog */}
      <Dialog open={blockIpDialog} onOpenChange={setBlockIpDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('securitySettings.blockIP')}</DialogTitle>
            <DialogDescription>
              {t('securitySettings.confirmBlockIP')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="blockReason">Reason for blocking</Label>
              <Textarea
                id="blockReason"
                placeholder="Enter reason for blocking this IP address..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockIpDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleBlockIp} variant="destructive">
              {t('securitySettings.blockIP')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}