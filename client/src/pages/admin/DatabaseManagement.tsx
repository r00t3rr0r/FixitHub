import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Database, Server, HardDrive, Activity, Download, Trash2, RefreshCw, Zap, Shield, Clock } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import {
  getDatabaseStats,
  getRecentOperations,
  createDatabaseBackup,
  getBackupHistory,
  optimizeDatabase,
  getDatabaseHealth,
  cleanupOldData,
  deleteAllBookingsAndOrders,
  type DatabaseStats,
  type DatabaseOperation,
  type DatabaseBackup,
  type DatabaseHealth
} from '@/api/database';

export function DatabaseManagement() {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [operations, setOperations] = useState<DatabaseOperation[]>([]);
  const [backups, setBackups] = useState<DatabaseBackup[]>([]);
  const [health, setHealth] = useState<DatabaseHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [optimizeLoading, setOptimizeLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(90);
  const [cleanupCollections, setCleanupCollections] = useState(['logs', 'sessions', 'notifications']);
  const { toast } = useToast();

  useEffect(() => {
    fetchDatabaseData();
  }, []);

  const fetchDatabaseData = async () => {
    try {
      setLoading(true);
      const [statsResponse, operationsResponse, backupsResponse, healthResponse] = await Promise.all([
        getDatabaseStats(),
        getRecentOperations(),
        getBackupHistory(),
        getDatabaseHealth()
      ]);

      setStats(statsResponse.data.stats);
      setOperations(operationsResponse.data.operations);
      setBackups(backupsResponse.data.backups);
      setHealth(healthResponse.data.health);
    } catch (error) {
      console.error('Error fetching database data:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setBackupLoading(true);
      const response = await createDatabaseBackup();
      
      toast({
        title: "Success",
        description: response.data.message,
      });
      
      fetchDatabaseData();
    } catch (error) {
      console.error('Error creating backup:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleOptimizeDatabase = async () => {
    try {
      setOptimizeLoading(true);
      const response = await optimizeDatabase();
      
      toast({
        title: "Success",
        description: response.data.message,
      });
      
      fetchDatabaseData();
    } catch (error) {
      console.error('Error optimizing database:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setOptimizeLoading(false);
    }
  };

  const handleCleanupData = async () => {
    try {
      setCleanupLoading(true);
      const response = await cleanupOldData({
        olderThanDays: cleanupDays,
        collections: cleanupCollections
      });

      toast({
        title: "Success",
        description: response.data.message,
      });

      fetchDatabaseData();
    } catch (error) {
      console.error('Error cleaning up data:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleDeleteBookingsAndOrders = async () => {
    try {
      setDeleteLoading(true);
      const response = await deleteAllBookingsAndOrders();

      toast({
        title: "Success",
        description: `Deleted ${response.data.results.orders.deleted} orders and ${response.data.results.bookings.deleted} bookings`,
      });

      fetchDatabaseData();
    } catch (error) {
      console.error('Error deleting bookings and orders:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getHealthStatus = (status: string) => {
    switch (status) {
      case 'healthy': return { color: 'bg-green-500', text: 'Healthy' };
      case 'unhealthy': return { color: 'bg-red-500', text: 'Unhealthy' };
      default: return { color: 'bg-yellow-500', text: 'Unknown' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Database Management</h1>
        <p className="text-muted-foreground">
          Monitor database performance, manage backups, and optimize storage
        </p>
      </div>

      {/* Health Status */}
      {health && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Database Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Status</p>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getHealthStatus(health.status).color}`} />
                  <span>{getHealthStatus(health.status).text}</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Uptime</p>
                <p className="text-2xl font-bold">{Math.floor(health.uptime / 3600)}h</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Connections</p>
                <p className="text-2xl font-bold">{health.connections.current}</p>
                <p className="text-xs text-muted-foreground">of {health.connections.available} available</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Memory Usage</p>
                <p className="text-2xl font-bold">{formatBytes(health.memory.resident * 1024 * 1024)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="backups">Backups</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Database Size</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatBytes(stats.database.dataSize)}</div>
                  <p className="text-xs text-muted-foreground">
                    Storage: {formatBytes(stats.database.storageSize)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Collections</CardTitle>
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.database.collections}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.database.objects.toLocaleString()} total objects
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Indexes</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.database.indexes}</div>
                  <p className="text-xs text-muted-foreground">
                    Size: {formatBytes(stats.database.indexSize)}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="collections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Collection Statistics</CardTitle>
              <CardDescription>
                Detailed information about each collection in the database
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Collection</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Avg Doc Size</TableHead>
                    <TableHead>Storage Size</TableHead>
                    <TableHead>Indexes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats?.collections.map((collection) => (
                    <TableRow key={collection.name}>
                      <TableCell className="font-medium">{collection.name}</TableCell>
                      <TableCell>{collection.count.toLocaleString()}</TableCell>
                      <TableCell>{formatBytes(collection.size)}</TableCell>
                      <TableCell>{formatBytes(collection.avgObjSize)}</TableCell>
                      <TableCell>{formatBytes(collection.storageSize)}</TableCell>
                      <TableCell>{collection.indexes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Operations
              </CardTitle>
              <CardDescription>
                Monitor recent database operations and their performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operation</TableHead>
                    <TableHead>Collection</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operations.map((operation) => (
                    <TableRow key={operation._id}>
                      <TableCell className="font-medium">{operation.operation}</TableCell>
                      <TableCell>{operation.collection}</TableCell>
                      <TableCell>{operation.duration}ms</TableCell>
                      <TableCell>
                        <Badge variant={operation.status === 'success' ? 'default' : 'destructive'}>
                          {operation.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(operation.timestamp).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Database Backups
              </CardTitle>
              <CardDescription>
                Create and manage database backups
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleCreateBackup} disabled={backupLoading}>
                {backupLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                Create Backup
              </Button>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Backup ID</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((backup) => (
                    <TableRow key={backup._id}>
                      <TableCell className="font-medium">{backup._id}</TableCell>
                      <TableCell>{backup.size}</TableCell>
                      <TableCell>
                        <Badge variant={backup.type === 'manual' ? 'default' : 'secondary'}>
                          {backup.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={backup.status === 'completed' ? 'default' : 'destructive'}>
                          {backup.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(backup.timestamp).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Database Optimization
                </CardTitle>
                <CardDescription>
                  Optimize database performance by rebuilding indexes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={optimizeLoading}>
                      {optimizeLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                      Optimize Database
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Optimize Database</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will rebuild all indexes and may take some time. The database will remain accessible during optimization.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleOptimizeDatabase}>
                        Optimize
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5" />
                  Data Cleanup
                </CardTitle>
                <CardDescription>
                  Remove old data to free up storage space
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cleanupDays">Delete data older than (days)</Label>
                  <Input
                    id="cleanupDays"
                    type="number"
                    value={cleanupDays}
                    onChange={(e) => setCleanupDays(parseInt(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Collections to clean</Label>
                  <div className="space-y-2">
                    {['logs', 'sessions', 'notifications'].map((collection) => (
                      <div key={collection} className="flex items-center space-x-2">
                        <Checkbox
                          id={collection}
                          checked={cleanupCollections.includes(collection)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setCleanupCollections([...cleanupCollections, collection]);
                            } else {
                              setCleanupCollections(cleanupCollections.filter(c => c !== collection));
                            }
                          }}
                        />
                        <Label htmlFor={collection}>{collection}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={cleanupLoading}>
                      {cleanupLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                      Cleanup Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cleanup Old Data</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete data older than {cleanupDays} days from selected collections. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCleanupData} className="bg-red-600 hover:bg-red-700">
                        Delete Data
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5" />
                  Delete Bookings & Orders
                </CardTitle>
                <CardDescription>
                  Permanently delete all bookings and orders from the database
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={deleteLoading}>
                      {deleteLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                      Delete All Bookings & Orders
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete All Bookings and Orders?</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-3 mt-4">
                        <p>
                          This will permanently delete ALL bookings and orders from the database. This action cannot be undone.
                        </p>
                        <p className="font-semibold text-red-600">
                          ⚠️ Warning: This is a destructive operation. Make sure you have a backup before proceeding.
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteBookingsAndOrders} className="bg-red-600 hover:bg-red-700">
                        Delete All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}