import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import { Loader2, Database, Server, Users, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { seedAllData, seedTestUsers, verifyTestUsers, checkDatabaseHealth, checkServerHealth } from "@/api/seed"
import { SEO } from "@/components/SEO"

interface HealthStatus {
  server?: any;
  database?: any;
  users?: any[];
}

export function DebugLogin() {
  const [isLoading, setIsLoading] = useState(false)
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({})
  const { toast } = useToast()

  const checkServerStatus = async () => {
    try {
      setIsLoading(true)
      console.log('Checking server health...')
      
      const serverHealth = await checkServerHealth()
      console.log('Server health response:', serverHealth)
      
      setHealthStatus(prev => ({ ...prev, server: serverHealth }))
      
      toast({
        title: "Server Check Complete",
        description: "Server is responding normally",
      })
    } catch (error: any) {
      console.error('Server health check failed:', error)
      toast({
        title: "Server Check Failed",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const checkDatabaseStatus = async () => {
    try {
      setIsLoading(true)
      console.log('Checking database health...')
      
      const dbHealth = await checkDatabaseHealth()
      console.log('Database health response:', dbHealth)
      
      setHealthStatus(prev => ({ ...prev, database: dbHealth }))
      
      toast({
        title: "Database Check Complete",
        description: `Database status: ${dbHealth.data?.database?.status || 'unknown'}`,
      })
    } catch (error: any) {
      console.error('Database health check failed:', error)
      toast({
        title: "Database Check Failed",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const seedTestData = async () => {
    try {
      setIsLoading(true)
      console.log('Seeding test users...')
      
      const result = await seedTestUsers()
      console.log('Seed test users response:', result)
      
      toast({
        title: "Test Users Seeded",
        description: `Created ${result.data?.length || 0} test users`,
      })
      
      // Verify the users after seeding
      await verifyCredentials()
    } catch (error: any) {
      console.error('Seeding test users failed:', error)
      toast({
        title: "Seeding Failed",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const seedAllTestData = async () => {
    try {
      setIsLoading(true)
      console.log('Seeding all test data...')
      
      const result = await seedAllData()
      console.log('Seed all data response:', result)
      
      toast({
        title: "All Data Seeded",
        description: `Created ${result.data?.totalItems || 0} items`,
      })
      
      // Verify the users after seeding
      await verifyCredentials()
    } catch (error: any) {
      console.error('Seeding all data failed:', error)
      toast({
        title: "Seeding Failed",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const verifyCredentials = async () => {
    try {
      setIsLoading(true)
      console.log('Verifying test user credentials...')
      
      const result = await verifyTestUsers()
      console.log('Verify users response:', result)
      
      setHealthStatus(prev => ({ ...prev, users: result.data }))
      
      const successCount = result.data?.filter((user: any) => user.status === 'success').length || 0
      const totalCount = result.data?.length || 0
      
      toast({
        title: "Credential Verification Complete",
        description: `${successCount}/${totalCount} test users can login successfully`,
        variant: successCount === totalCount ? "default" : "destructive"
      })
    } catch (error: any) {
      console.error('Verifying credentials failed:', error)
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const runFullDiagnostic = async () => {
    try {
      setIsLoading(true)
      console.log('Running full diagnostic...')
      
      // Check server
      await checkServerStatus()
      
      // Check database
      await checkDatabaseStatus()
      
      // Seed test users
      await seedTestData()
      
      toast({
        title: "Full Diagnostic Complete",
        description: "All checks and setup completed",
      })
    } catch (error: any) {
      console.error('Full diagnostic failed:', error)
      toast({
        title: "Diagnostic Failed",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
      case 'error':
      case 'disconnected':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  return (
    <>
      <SEO
        title="Deployment Debug"
        description="Interne Diagnose- und Debug-Seite fuer Deployment- und Login-Pruefungen."
        canonical="/debug"
        noindex
      />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            FixitHub Deployment Debug
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Use this page to diagnose and fix login issues in deployment
          </p>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>
              Run these actions to diagnose and fix common deployment issues
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={runFullDiagnostic}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Run Full Diagnostic
              </Button>
              
              <Button
                onClick={verifyCredentials}
                disabled={isLoading}
                variant="outline"
                className="w-full"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Verify Test Credentials
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                onClick={checkServerStatus}
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                <Server className="h-4 w-4 mr-2" />
                Check Server
              </Button>
              
              <Button
                onClick={checkDatabaseStatus}
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                <Database className="h-4 w-4 mr-2" />
                Check Database
              </Button>
              
              <Button
                onClick={seedTestData}
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                <Users className="h-4 w-4 mr-2" />
                Seed Test Users
              </Button>
            </div>
            
            <Button
              onClick={seedAllTestData}
              disabled={isLoading}
              variant="secondary"
              className="w-full"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Seed All Test Data
            </Button>
          </CardContent>
        </Card>

        {/* Status Display */}
        {(healthStatus.server || healthStatus.database || healthStatus.users) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Server Status */}
            {healthStatus.server && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Server className="h-4 w-4" />
                    Server Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Status:</span>
                    <Badge variant="outline" className="text-green-600">
                      Running
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Environment:</span>
                    <span className="text-sm font-mono">
                      {healthStatus.server.environment || 'unknown'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Last check: {new Date(healthStatus.server.timestamp).toLocaleTimeString()}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Database Status */}
            {healthStatus.database && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Database className="h-4 w-4" />
                    Database Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Connection:</span>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(healthStatus.database.data?.database?.status)}
                      <Badge variant="outline" className={
                        healthStatus.database.data?.database?.status === 'connected' 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }>
                        {healthStatus.database.data?.database?.status || 'unknown'}
                      </Badge>
                    </div>
                  </div>
                  {healthStatus.database.data?.stats && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Users:</span>
                      <span className="text-sm font-mono">
                        {healthStatus.database.data.stats.totalUsers}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* User Status */}
            {healthStatus.users && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4" />
                    Test Users
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {healthStatus.users.map((user: any, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm">{user.email.split('@')[0]}:</span>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(user.status)}
                        <Badge 
                          variant="outline" 
                          className={user.status === 'success' ? 'text-green-600' : 'text-red-600'}
                        >
                          {user.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Deployment Instructions</CardTitle>
            <CardDescription>
              Follow these steps to ensure login works in your deployment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>For deployment setup:</strong> Run "Full Diagnostic" to check all systems and create test users.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <h4 className="font-medium">Test Credentials:</h4>
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm font-mono space-y-1">
                <div>Admin: admin@example.com / admin123</div>
                <div>Staff: staff@example.com / password123</div>
                <div>Customer: customer@example.com / password123</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Manual API Endpoints:</h4>
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm font-mono space-y-1">
                <div>POST /api/seed/all - Seed all test data</div>
                <div>POST /api/seed/test-users - Seed test users only</div>
                <div>GET /api/seed/verify-test-users - Verify credentials</div>
                <div>GET /api/seed/health - Database health check</div>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </>
  )
}