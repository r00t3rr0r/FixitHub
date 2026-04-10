import { useEffect, useState } from "react"
import { useTranslation } from 'react-i18next'
import { useToast } from "@/hooks/useToast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Mail,
  Send,
  Settings,
  BarChart3,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  TestTube,
  Eye,
  EyeOff,
  Download,
  Search,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import "./EmailAdministration.css"

interface EmailStats {
  totalRecords: number
  sent: number
  failed: number
  queued: number
  averageDuration: number
  failureRate: number
}

interface SmtpStats {
  totalRecords: number
  attempted: number
  verified: number
  failed: number
}

interface DeliveryRecord {
  id: string
  timestamp: string
  to: string
  templateName: string
  subject: string
  status: "sent" | "failed" | "queued"
  attempts: number
  duration: number
  error?: string
  messageId?: string
  metadata?: Record<string, unknown>
}

interface SmtpConnectionRecord {
  id: string
  timestamp: string
  source: string
  host?: string
  port?: number
  secure: boolean
  requiresTLS: boolean
  hasAuth: boolean
  status: "attempted" | "verified" | "failed"
  message?: string
  error?: string | null
}

interface EmailSettings {
  smtpHost: string
  smtpPort: number
  smtpUsername: string
  smtpPassword: string
  enableNotifications: boolean
  requiresAuthentication: boolean
  requiresTLS: boolean
}

const API_BASE = "/api"
const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  smtpHost: "",
  smtpPort: 587,
  smtpUsername: "",
  smtpPassword: "",
  enableNotifications: true,
  requiresAuthentication: true,
  requiresTLS: true,
}

export function EmailAdministration() {
  const { t } = useTranslation()
  const { toast } = useToast()

  const [stats, setStats] = useState<EmailStats | null>(null)
  const [smtpStats, setSmtpStats] = useState<SmtpStats | null>(null)
  const [deliveryHistory, setDeliveryHistory] = useState<DeliveryRecord[]>([])
  const [deliveryLog, setDeliveryLog] = useState<DeliveryRecord[]>([])
  const [smtpConnectionLog, setSmtpConnectionLog] = useState<SmtpConnectionRecord[]>([])
  const [selectedEmail, setSelectedEmail] = useState("")
  const [logFilter, setLogFilter] = useState<"all" | "sent" | "failed" | "queued">("all")
  const [smtpFilter, setSmtpFilter] = useState<"all" | "attempted" | "verified" | "failed">("all")
  const [logPage, setLogPage] = useState(1)
  const [logLimit] = useState(25)
  const [totalPages, setTotalPages] = useState(1)

  const [emailSettings, setEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS)
  const [originalEmailSettings, setOriginalEmailSettings] = useState<EmailSettings | null>(DEFAULT_EMAIL_SETTINGS)

  const [loading, setLoading] = useState(true)
  const [loadingStats, setLoadingStats] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingLog, setLoadingLog] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [showPasswordSettings, setShowPasswordSettings] = useState(false)
  const [testEmailDialog, setTestEmailDialog] = useState(false)
  const [testEmailTo, setTestEmailTo] = useState("")
  const [sendingTest, setSendingTest] = useState(false)

  const [composeTestEmailDialog, setComposeTestEmailDialog] = useState(false)
  const [composeEmailTo, setComposeEmailTo] = useState("")
  const [composeEmailSubject, setComposeEmailSubject] = useState(t('emailAdmin.defaultTestSubject'))
  const [composeEmailBody, setComposeEmailBody] = useState(t('emailAdmin.defaultTestBody'))
  const [composeEmailFrom, setComposeEmailFrom] = useState("")
  const [sendingComposedEmail, setSendingComposedEmail] = useState(false)
  const [selectedDeliveryRecord, setSelectedDeliveryRecord] = useState<DeliveryRecord | null>(null)
  const [selectedSmtpRecord, setSelectedSmtpRecord] = useState<SmtpConnectionRecord | null>(null)

  const hasUnsavedChanges =
    originalEmailSettings === null ||
    JSON.stringify(emailSettings) !== JSON.stringify(originalEmailSettings)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      loadStats()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (loading) return
    loadDeliveryLog()
  }, [logFilter, smtpFilter, logPage, logLimit])

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([loadStats(), loadDeliveryLog()])

      try {
        const response = await fetch(`${API_BASE}/system-config`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          if (data.config?.emailSettings) {
            const loadedSettings: EmailSettings = {
              smtpHost: data.config.emailSettings.smtpHost || "",
              smtpPort: Number(data.config.emailSettings.smtpPort) || 587,
              smtpUsername: data.config.emailSettings.smtpUsername || "",
              smtpPassword: "",
              enableNotifications:
                data.config.emailSettings.enableNotifications !== undefined
                  ? Boolean(data.config.emailSettings.enableNotifications)
                  : true,
              requiresAuthentication:
                data.config.emailSettings.requiresAuthentication !== undefined
                  ? Boolean(data.config.emailSettings.requiresAuthentication)
                  : true,
              requiresTLS:
                data.config.emailSettings.requiresTLS !== undefined
                  ? Boolean(data.config.emailSettings.requiresTLS)
                  : true,
            }

            setEmailSettings(loadedSettings)
            setOriginalEmailSettings(loadedSettings)
          } else {
            setOriginalEmailSettings(DEFAULT_EMAIL_SETTINGS)
          }
        } else {
          setOriginalEmailSettings(DEFAULT_EMAIL_SETTINGS)
        }
      } catch (error) {
        console.error("Error loading email settings:", error)
        setOriginalEmailSettings(DEFAULT_EMAIL_SETTINGS)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    setLoadingStats(true)
    try {
      const response = await fetch(`${API_BASE}/system-config/email/delivery-stats`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
        setSmtpStats(data.smtpStats || null)
      }
    } catch (error) {
      console.error("Error loading stats:", error)
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: t('emailAdmin.failedToLoadStats'),
      })
    } finally {
      setLoadingStats(false)
    }
  }

  const loadDeliveryHistory = async (email: string) => {
    if (!email) return

    setLoadingHistory(true)
    try {
      const response = await fetch(
        `${API_BASE}/system-config/email/delivery-history/${encodeURIComponent(email)}?limit=20`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setDeliveryHistory(data.history || [])
      }
    } catch (error) {
      console.error("Error loading delivery history:", error)
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: t('emailAdmin.failedToLoadHistory'),
      })
    } finally {
      setLoadingHistory(false)
    }
  }

  const loadDeliveryLog = async () => {
    setLoadingLog(true)
    try {
      const response = await fetch(
        `${API_BASE}/system-config/email/advanced-log?filter=${logFilter}&smtpStatus=${smtpFilter}&page=${logPage}&limit=${logLimit}&smtpLimit=50`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setDeliveryLog(data.deliveryLogs || [])
        setSmtpConnectionLog(data.smtpConnectionLog || [])
        setSmtpStats(data.smtpStats || smtpStats)
        setTotalPages(data.pagination?.pages || 1)
      } else {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || data.message || t('emailAdmin.failedToLoadAdvancedLog'))
      }
    } catch (error) {
      console.error("Error loading delivery log:", error)
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: t('emailAdmin.failedToLoadDeliveryLog'),
      })
    } finally {
      setLoadingLog(false)
    }
  }

  const handleClearDeliveryLog = async () => {
    const confirmed = window.confirm(t('emailAdmin.confirmClearDeliveryLog'))
    if (!confirmed) return

    try {
      const response = await fetch(`${API_BASE}/system-config/email/delivery-log?status=all`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || t('emailAdmin.failedToClearDeliveryLog'))
      }

      await Promise.all([loadStats(), loadDeliveryLog()])
      toast({ title: t('common.success'), description: t('emailAdmin.deliveryLogCleared', { count: data.clearedCount || 0 }) })
    } catch (error: any) {
      toast({ variant: 'destructive', title: t('common.error'), description: error.message || t('emailAdmin.failedToClearDeliveryLog') })
    }
  }

  const handleClearSmtpLog = async () => {
    const confirmed = window.confirm(t('emailAdmin.confirmClearSmtpLog'))
    if (!confirmed) return

    try {
      const response = await fetch(`${API_BASE}/system-config/email/smtp-log?status=all`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || t('emailAdmin.failedToClearSmtpLog'))
      }

      await Promise.all([loadStats(), loadDeliveryLog()])
      toast({ title: t('common.success'), description: t('emailAdmin.smtpLogCleared', { count: data.clearedCount || 0 }) })
    } catch (error: any) {
      toast({ variant: 'destructive', title: t('common.error'), description: error.message || t('emailAdmin.failedToClearSmtpLog') })
    }
  }

  const handleTestEmail = async () => {
    if (!testEmailTo) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: t('emailAdmin.enterEmailAddress'),
      })
      return
    }

    setSendingTest(true)
    try {
      const response = await fetch(`${API_BASE}/system-config/email/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({
          to: testEmailTo,
          smtpHost: emailSettings.smtpHost,
          smtpPort: emailSettings.smtpPort,
          smtpUsername: emailSettings.smtpUsername,
          smtpPassword: emailSettings.smtpPassword,
          requiresAuthentication: emailSettings.requiresAuthentication,
          requiresTLS: emailSettings.requiresTLS,
        }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        toast({
          title: t('common.success'),
          description: data.message || t('emailAdmin.smtpTestSuccess'),
        })
        setTestEmailDialog(false)
      } else {
        toast({
          variant: "destructive",
          title: t('common.error'),
          description: data.message || t('emailAdmin.smtpTestFailed'),
        })
      }
    } catch (error) {
      console.error("Error testing SMTP:", error)
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: t('emailAdmin.connectionErrorTesting'),
      })
    } finally {
      setSendingTest(false)
    }
  }

  const handleSendComposedEmail = async () => {
    if (!composeEmailTo.trim()) {
      toast({ variant: "destructive", title: t('common.error'), description: t('emailAdmin.recipientRequired') })
      return
    }
    if (!composeEmailSubject.trim()) {
      toast({ variant: "destructive", title: t('common.error'), description: t('emailAdmin.subjectRequired') })
      return
    }
    setSendingComposedEmail(true)
    try {
      const response = await fetch(`${API_BASE}/system-config/email/send-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({
          to: composeEmailTo.trim(),
          subject: composeEmailSubject.trim(),
          body: composeEmailBody,
          from: composeEmailFrom.trim() || emailSettings.smtpUsername,
          smtpHost: emailSettings.smtpHost,
          smtpPort: emailSettings.smtpPort,
          smtpUsername: emailSettings.smtpUsername,
          smtpPassword: emailSettings.smtpPassword,
          requiresAuthentication: emailSettings.requiresAuthentication,
          requiresTLS: emailSettings.requiresTLS,
        }),
      })
      const data = await response.json()
      if (response.ok && data.success) {
        toast({ title: t('emailAdmin.emailSent'), description: data.message || t('emailAdmin.testEmailSentSuccess', { email: composeEmailTo }) })
        setComposeTestEmailDialog(false)
      } else {
        toast({ variant: "destructive", title: t('emailAdmin.sendFailed'), description: data.message || t('emailAdmin.failedToSendTestEmail') })
      }
    } catch (error) {
      console.error("Error sending test email:", error)
      toast({ variant: "destructive", title: t('emailAdmin.connectionError'), description: t('emailAdmin.failedToSendEmail') })
    } finally {
      setSendingComposedEmail(false)
    }
  }

  const handleSaveSettings = async () => {
    // Validierung
    if (!emailSettings.smtpHost.trim()) {
      toast({
        variant: "destructive",
        title: t('emailAdmin.validationError'),
        description: t('emailAdmin.smtpHostRequired'),
      })
      return
    }

    if (emailSettings.smtpPort < 1 || emailSettings.smtpPort > 65535) {
      toast({
        variant: "destructive",
        title: t('emailAdmin.validationError'),
        description: t('emailAdmin.smtpPortRange'),
      })
      return
    }

    if (emailSettings.requiresAuthentication) {
      if (!emailSettings.smtpUsername.trim()) {
        toast({
          variant: "destructive",
          title: t('emailAdmin.validationError'),
          description: t('emailAdmin.smtpUsernameRequired'),
        })
        return
      }
    }

    setSavingSettings(true)
    try {
      const settingsToSave = {
        ...emailSettings,
        smtpPort: parseInt(String(emailSettings.smtpPort), 10),
      }

      if (!emailSettings.smtpPassword || emailSettings.smtpPassword === "") {
        delete (settingsToSave as any).smtpPassword
      }

      const response = await fetch(`${API_BASE}/system-config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({
          emailSettings: settingsToSave,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok && data.success) {
        const savedSettings = {
          ...emailSettings,
          smtpPassword: "",
        }
        setOriginalEmailSettings(savedSettings)
        setEmailSettings(savedSettings)

        toast({
          title: t('common.success'),
          description: t('emailAdmin.smtpConfigSaved'),
        })
      } else {
        toast({
          variant: "destructive",
          title: t('common.error'),
          description:
            data.error || data.message || t('emailAdmin.failedToSaveSmtpConfig'),
        })
      }
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: t('emailAdmin.connectionErrorSaving'),
      })
    } finally {
      setSavingSettings(false)
    }
  }

  const handleRefresh = async () => {
    await Promise.all([loadStats(), loadDeliveryLog()])
    toast({
      title: t('common.success'),
      description: t('emailAdmin.dataRefreshed'),
    })
  }

  const handleDownloadLog = () => {
    const csv = [
      [t('emailAdmin.csvTimestamp'), t('emailAdmin.csvRecipient'), t('emailAdmin.csvTemplate'), t('emailAdmin.csvStatus'), t('emailAdmin.csvAttempts'), t('emailAdmin.csvDuration'), t('emailAdmin.csvError')].join(","),
      ...deliveryLog.map((record) =>
        [
          record.timestamp,
          record.to,
          record.templateName,
          record.status,
          record.attempts,
          record.duration,
          record.error || "",
        ].join(",")
      ),
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `email-delivery-log-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })

  const formatDuration = (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`)

  const getStatusBadge = (status: string) => {
    if (status === "sent") return <Badge variant="outline" className="bg-green-50 text-green-900">{t('emailAdmin.statusSent')}</Badge>
    if (status === "failed") return <Badge variant="outline" className="bg-red-50 text-red-900">{t('emailAdmin.statusFailed')}</Badge>
    if (status === "queued") return <Badge variant="outline" className="bg-blue-50 text-blue-900">{t('emailAdmin.statusQueued')}</Badge>
    return <Badge>{status}</Badge>
  }

  if (loading) {
    return (
      <div className="email-admin-loading">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <p>{t('emailAdmin.loadingPage')}</p>
      </div>
    )
  }

  return (
    <div className="email-administration">
      <div className="email-admin-header">
        <div>
          <h1 className="text-3xl font-bold">{t('emailAdmin.title')}</h1>
          <p className="text-muted-foreground">{t('emailAdmin.description')}</p>
        </div>
        <Button onClick={handleRefresh} disabled={loadingStats} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />{t('common.refresh')}
        </Button>
      </div>

      <Tabs defaultValue="statistics" className="email-admin-tabs">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="statistics"><BarChart3 className="h-4 w-4 mr-2" />{t('emailAdmin.statistics')}</TabsTrigger>
          <TabsTrigger value="history"><Clock className="h-4 w-4 mr-2" />{t('emailAdmin.history')}</TabsTrigger>
          <TabsTrigger value="logs"><Mail className="h-4 w-4 mr-2" />{t('emailAdmin.logs')}</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-2" />{t('emailAdmin.settings')}</TabsTrigger>
        </TabsList>

        <TabsContent value="statistics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">{t('emailAdmin.total')}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats?.totalRecords || 0}</div><p className="text-xs text-muted-foreground mt-1">{t('emailAdmin.emailsInStorage')}</p></CardContent></Card>
            <Card className="border-green-200"><CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-green-900 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{t('emailAdmin.statusSent')}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-900">{stats?.sent || 0}</div></CardContent></Card>
            <Card className="border-red-200"><CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-red-900 flex items-center gap-2"><AlertCircle className="h-4 w-4" />{t('emailAdmin.statusFailed')}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-900">{stats?.failed || 0}</div></CardContent></Card>
            <Card className="border-blue-200"><CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-blue-900 flex items-center gap-2"><TrendingUp className="h-4 w-4" />{t('emailAdmin.average')}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-900">{formatDuration(stats?.averageDuration || 0)}</div></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{t('emailAdmin.recipientHistory')}</CardTitle><CardDescription>{t('emailAdmin.recipientHistoryDesc')}</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input placeholder={t('emailAdmin.enterEmailPlaceholder')} value={selectedEmail} onChange={(e) => setSelectedEmail(e.target.value)} type="email" />
                <Button onClick={() => loadDeliveryHistory(selectedEmail)} disabled={loadingHistory || !selectedEmail}><Search className="h-4 w-4" /></Button>
              </div>
              {selectedEmail && (
                <div className="space-y-3">
                  {loadingHistory ? (
                    <div className="flex items-center justify-center py-8"><RefreshCw className="h-4 w-4 animate-spin mr-2" />{t('common.loading')}</div>
                  ) : deliveryHistory.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-8 text-center">{t('emailAdmin.noDeliveryRecords')}</p>
                  ) : (
                    deliveryHistory.map((record) => (
                      <div key={record.id} className="border rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1"><span className="font-medium text-sm">{record.templateName}</span>{getStatusBadge(record.status)}</div>
                        <p className="text-sm text-muted-foreground line-clamp-1">{record.subject}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground"><span>{t('emailAdmin.attempts')}: {record.attempts}</span><span>{t('emailAdmin.duration')}: {formatDuration(record.duration)}</span><span>{formatDate(record.timestamp)}</span></div>
                        {record.error && <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">{record.error}</div>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{t('emailAdmin.deliveryLog')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('emailAdmin.smtpTotal')}</p>
                  <p className="text-xl font-semibold">{smtpStats?.totalRecords || 0}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('emailAdmin.smtpVerified')}</p>
                  <p className="text-xl font-semibold text-green-700">{smtpStats?.verified || 0}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('emailAdmin.smtpAttempted')}</p>
                  <p className="text-xl font-semibold text-blue-700">{smtpStats?.attempted || 0}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('emailAdmin.smtpFailed')}</p>
                  <p className="text-xl font-semibold text-red-700">{smtpStats?.failed || 0}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Select value={logFilter} onValueChange={(value) => { setLogFilter(value as typeof logFilter); setLogPage(1) }}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.all')}</SelectItem>
                    <SelectItem value="sent">{t('emailAdmin.statusSent')}</SelectItem>
                    <SelectItem value="failed">{t('emailAdmin.statusFailed')}</SelectItem>
                    <SelectItem value="queued">{t('emailAdmin.statusQueued')}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={smtpFilter} onValueChange={(value) => setSmtpFilter(value as typeof smtpFilter)}>
                  <SelectTrigger className="w-48"><SelectValue placeholder={t('emailAdmin.smtpStatusPlaceholder')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('emailAdmin.smtpAll')}</SelectItem>
                    <SelectItem value="attempted">{t('emailAdmin.smtpAttemptedFilter')}</SelectItem>
                    <SelectItem value="verified">{t('emailAdmin.smtpVerifiedFilter')}</SelectItem>
                    <SelectItem value="failed">{t('emailAdmin.smtpFailedFilter')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleDownloadLog} variant="outline"><Download className="h-4 w-4 mr-2" />{t('emailAdmin.exportCsv')}</Button>
                <Button onClick={handleClearDeliveryLog} variant="outline">{t('emailAdmin.clearDeliveryLog')}</Button>
                <Button onClick={handleClearSmtpLog} variant="outline">{t('emailAdmin.clearSmtpLog')}</Button>
              </div>

              {loadingLog ? (
                <div className="flex items-center justify-center py-8"><RefreshCw className="h-4 w-4 animate-spin mr-2" />{t('common.loading')}</div>
              ) : deliveryLog.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">{t('emailAdmin.noDeliveryLogs')}</p>
              ) : (
                <div className="space-y-3">
                  {deliveryLog.map((record) => (
                    <div key={record.id} className="border rounded-lg p-3">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div><p className="text-xs text-muted-foreground">{t('emailAdmin.recipient')}</p><p className="font-medium text-sm truncate">{record.to}</p></div>
                        <div><p className="text-xs text-muted-foreground">{t('emailAdmin.template')}</p><p className="text-sm truncate">{record.templateName}</p></div>
                        <div><p className="text-xs text-muted-foreground">{t('common.status')}</p>{getStatusBadge(record.status)}</div>
                        <div><p className="text-xs text-muted-foreground">{t('emailAdmin.duration')}</p><p className="text-sm">{formatDuration(record.duration)}</p></div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t('emailAdmin.time')}</p>
                          <p className="text-sm whitespace-nowrap">{new Date(record.timestamp).toLocaleTimeString()}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 h-7 px-2"
                            onClick={() => setSelectedDeliveryRecord(record)}
                          >
                            {t('emailAdmin.details')}
                          </Button>
                        </div>
                      </div>
                      {record.error && <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">{t('common.error')}: {record.error}</div>}
                    </div>
                  ))}
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">{t('emailAdmin.pageOfPages', { page: logPage, total: totalPages })}</div>
                  <div className="flex gap-2">
                    <Button onClick={() => setLogPage(Math.max(1, logPage - 1))} disabled={logPage === 1} variant="outline" size="sm">{t('common.previous')}</Button>
                    <Button onClick={() => setLogPage(Math.min(totalPages, logPage + 1))} disabled={logPage === totalPages} variant="outline" size="sm">{t('common.next')}</Button>
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <div>
                  <h4 className="font-medium">{t('emailAdmin.smtpConnectionLog')}</h4>
                  <p className="text-sm text-muted-foreground">{t('emailAdmin.smtpConnectionLogDesc')}</p>
                </div>

                {smtpConnectionLog.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t('emailAdmin.noSmtpEntries')}</p>
                ) : (
                  <div className="space-y-2">
                    {smtpConnectionLog.map((entry) => (
                      <div key={entry.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium">
                            {entry.host || "unknown"}{entry.port ? `:${entry.port}` : ""} ({entry.source})
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(entry.status === "verified" ? "sent" : entry.status === "failed" ? "failed" : "queued")}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => setSelectedSmtpRecord(entry)}
                            >
                              {t('emailAdmin.details')}
                            </Button>
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDate(entry.timestamp)} | TLS: {entry.requiresTLS ? t('common.yes') : t('common.no')} | Secure: {entry.secure ? t('common.yes') : t('common.no')} | Auth: {entry.hasAuth ? t('common.yes') : t('common.no')}
                        </div>
                        {entry.message && <div className="mt-1 text-xs">{entry.message}</div>}
                        {entry.error && <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">{t('common.error')}: {entry.error}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{t('emailAdmin.smtpConfig')}</CardTitle><CardDescription>{t('emailAdmin.smtpConfigDesc')}</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="smtp-host">{t('emailAdmin.smtpServer')}</Label><Input id="smtp-host" placeholder="smtp.gmail.com" value={emailSettings.smtpHost} onChange={(e) => setEmailSettings((prev) => ({ ...prev, smtpHost: e.target.value }))} /></div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-port">{t('emailAdmin.smtpPort')}</Label>
                  <Select value={String(emailSettings.smtpPort)} onValueChange={(value) => setEmailSettings((prev) => ({ ...prev, smtpPort: parseInt(value, 10) }))}>
                    <SelectTrigger id="smtp-port"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">{t('emailAdmin.portUnencrypted')}</SelectItem>
                      <SelectItem value="587">{t('emailAdmin.portTlsRecommended')}</SelectItem>
                      <SelectItem value="465">{t('emailAdmin.portSsl')}</SelectItem>
                      <SelectItem value="2525">{t('emailAdmin.portAlternative')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div><Label htmlFor="requires-auth">{t('emailAdmin.authRequired')}</Label></div>
                  <Switch id="requires-auth" checked={emailSettings.requiresAuthentication} onCheckedChange={(checked) => setEmailSettings((prev) => ({ ...prev, requiresAuthentication: checked }))} />
                </div>

                {emailSettings.requiresAuthentication && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="smtp-user">{t('emailAdmin.usernameEmail')}</Label><Input id="smtp-user" placeholder="accounts@example.com" value={emailSettings.smtpUsername} onChange={(e) => setEmailSettings((prev) => ({ ...prev, smtpUsername: e.target.value }))} /></div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-pass">{t('emailAdmin.password')}</Label>
                      <div className="relative">
                        <Input id="smtp-pass" type={showPasswordSettings ? "text" : "password"} placeholder="........" value={emailSettings.smtpPassword} onChange={(e) => setEmailSettings((prev) => ({ ...prev, smtpPassword: e.target.value }))} />
                        <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0" onClick={() => setShowPasswordSettings(!showPasswordSettings)}>
                          {showPasswordSettings ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between"><div><Label htmlFor="requires-tls">{t('emailAdmin.tlsRequired')}</Label></div><Switch id="requires-tls" checked={emailSettings.requiresTLS} onCheckedChange={(checked) => setEmailSettings((prev) => ({ ...prev, requiresTLS: checked }))} /></div>
                <div className="flex items-center justify-between"><div><Label htmlFor="enable-notifications">{t('emailAdmin.notificationsEnabled')}</Label></div><Switch id="enable-notifications" checked={emailSettings.enableNotifications} onCheckedChange={(checked) => setEmailSettings((prev) => ({ ...prev, enableNotifications: checked }))} /></div>
              </div>

              <Separator />

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-blue-900">{t('emailAdmin.testSmtpConnection')}</h4>
                    <p className="text-sm text-blue-700 mt-1">{t('emailAdmin.testSmtpConnectionDesc')}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Button onClick={() => setTestEmailDialog(true)} variant="outline" disabled={!emailSettings.smtpHost}><TestTube className="h-4 w-4 mr-2" />{t('emailAdmin.testConnection')}</Button>
                      <Button onClick={() => { setComposeEmailFrom(emailSettings.smtpUsername); setComposeTestEmailDialog(true) }} variant="default" disabled={!emailSettings.smtpHost} className="bg-blue-600 hover:bg-blue-700 text-white"><Send className="h-4 w-4 mr-2" />{t('emailAdmin.sendTestEmail')}</Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 flex-col md:flex-row">
                <Button
                  onClick={handleSaveSettings}
                  className="w-full md:w-auto"
                  disabled={savingSettings || !emailSettings.smtpHost.trim() || !hasUnsavedChanges}
                >
                  {savingSettings ? (
                    <><div className="h-4 w-4 mr-2 border-2 border-current border-r-transparent rounded-full animate-spin" />{t('emailAdmin.saving')}</>
                  ) : (
                    <><Mail className="h-4 w-4 mr-2" />{t('emailAdmin.saveSettings')}</>
                  )}
                </Button>

                {hasUnsavedChanges && originalEmailSettings && (
                  <Button
                    onClick={() => {
                      setEmailSettings(originalEmailSettings)
                      toast({ title: t('emailAdmin.resetComplete'), description: t('emailAdmin.changesDiscarded') })
                    }}
                    variant="outline"
                    className="w-full md:w-auto"
                    disabled={savingSettings}
                  >
                    {t('common.reset')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={composeTestEmailDialog} onOpenChange={setComposeTestEmailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-blue-600" />{t('emailAdmin.sendTestEmail')}</DialogTitle>
            <DialogDescription>{t('emailAdmin.composeTestEmailDesc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-gray-50 border rounded-lg p-3 text-sm space-y-1">
              <p><span className="font-medium">{t('emailAdmin.serverLabel')}:</span> {emailSettings.smtpHost}:{emailSettings.smtpPort}</p>
              <p><span className="font-medium">{t('emailAdmin.userLabel')}:</span> {emailSettings.smtpUsername || "–"}</p>
              <p><span className="font-medium">TLS:</span> {emailSettings.requiresTLS ? t('common.yes') : t('common.no')} · <span className="font-medium">Auth:</span> {emailSettings.requiresAuthentication ? t('common.yes') : t('common.no')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="compose-from">{t('emailAdmin.senderFrom')}</Label>
              <Input
                id="compose-from"
                type="email"
                placeholder={emailSettings.smtpUsername || "absender@example.com"}
                value={composeEmailFrom}
                onChange={(e) => setComposeEmailFrom(e.target.value)}
                disabled={sendingComposedEmail}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="compose-to">{t('emailAdmin.recipientTo')}</Label>
              <Input
                id="compose-to"
                type="email"
                placeholder="empfaenger@example.com"
                value={composeEmailTo}
                onChange={(e) => setComposeEmailTo(e.target.value)}
                disabled={sendingComposedEmail}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="compose-subject">{t('emailAdmin.subject')} *</Label>
              <Input
                id="compose-subject"
                type="text"
                placeholder={t('emailAdmin.subject')}
                value={composeEmailSubject}
                onChange={(e) => setComposeEmailSubject(e.target.value)}
                disabled={sendingComposedEmail}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="compose-body">{t('emailAdmin.messageBody')}</Label>
              <Textarea
                id="compose-body"
                rows={5}
                placeholder={t('emailAdmin.messageBody')}
                value={composeEmailBody}
                onChange={(e) => setComposeEmailBody(e.target.value)}
                disabled={sendingComposedEmail}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeTestEmailDialog(false)} disabled={sendingComposedEmail}>{t('common.cancel')}</Button>
            <Button onClick={handleSendComposedEmail} disabled={sendingComposedEmail || !composeEmailTo.trim() || !composeEmailSubject.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
              {sendingComposedEmail ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{t('emailAdmin.sending')}</>
              ) : (
                <><Send className="h-4 w-4 mr-2" />{t('emailAdmin.sendEmail')}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={testEmailDialog} onOpenChange={setTestEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('emailAdmin.testSmtpConnection')}</DialogTitle>
            <DialogDescription>{t('emailAdmin.testSmtpDesc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-email">{t('emailAdmin.testEmailAddress')}</Label>
              <Input id="test-email" type="email" placeholder="test@example.com" value={testEmailTo} onChange={(e) => setTestEmailTo(e.target.value)} disabled={sendingTest} />
            </div>
            <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
              <p><span className="font-medium">Server:</span> {emailSettings.smtpHost}:{emailSettings.smtpPort}</p>
              <p><span className="font-medium">Auth:</span> {emailSettings.requiresAuthentication ? t('common.yes') : t('common.no')}</p>
              <p><span className="font-medium">TLS:</span> {emailSettings.requiresTLS ? t('common.yes') : t('common.no')}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTestEmailDialog(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleTestEmail} disabled={sendingTest || !testEmailTo}>
              {sendingTest ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{t('emailAdmin.testing')}</>
              ) : (
                <><TestTube className="h-4 w-4 mr-2" />{t('emailAdmin.testConnection')}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedDeliveryRecord)} onOpenChange={(open) => !open && setSelectedDeliveryRecord(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('emailAdmin.deliveryLogDetails')}</DialogTitle>
            <DialogDescription>{t('emailAdmin.deliveryLogDetailsDesc')}</DialogDescription>
          </DialogHeader>

          {selectedDeliveryRecord && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded border p-3"><p className="text-xs text-muted-foreground">{t('emailAdmin.recipient')}</p><p className="font-medium break-all">{selectedDeliveryRecord.to}</p></div>
                <div className="rounded border p-3"><p className="text-xs text-muted-foreground">{t('common.status')}</p><div className="mt-1">{getStatusBadge(selectedDeliveryRecord.status)}</div></div>
                <div className="rounded border p-3"><p className="text-xs text-muted-foreground">{t('emailAdmin.template')}</p><p className="font-medium">{selectedDeliveryRecord.templateName || 'N/A'}</p></div>
                <div className="rounded border p-3"><p className="text-xs text-muted-foreground">{t('emailAdmin.timestamp')}</p><p className="font-medium">{formatDate(selectedDeliveryRecord.timestamp)}</p></div>
                <div className="rounded border p-3"><p className="text-xs text-muted-foreground">{t('emailAdmin.attempts')}</p><p className="font-medium">{selectedDeliveryRecord.attempts}</p></div>
                <div className="rounded border p-3"><p className="text-xs text-muted-foreground">{t('emailAdmin.duration')}</p><p className="font-medium">{formatDuration(selectedDeliveryRecord.duration || 0)}</p></div>
              </div>

              <div className="rounded border p-3 text-sm">
                <p className="text-xs text-muted-foreground mb-1">{t('emailAdmin.subject')}</p>
                <p className="font-medium break-words">{selectedDeliveryRecord.subject || 'N/A'}</p>
              </div>

              <div className="rounded border p-3 text-sm">
                <p className="text-xs text-muted-foreground mb-1">{t('emailAdmin.messageId')}</p>
                <p className="font-medium break-all">{selectedDeliveryRecord.messageId || 'N/A'}</p>
              </div>

              {selectedDeliveryRecord.error && (
                <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <p className="text-xs mb-1">{t('common.error')}</p>
                </div>
              )}

              <div className="rounded border p-3 text-sm">
                <p className="text-xs text-muted-foreground mb-1">{t('emailAdmin.metadata')}</p>
                <pre className="whitespace-pre-wrap break-words text-xs bg-slate-50 p-2 rounded max-h-52 overflow-auto">
                  {JSON.stringify(selectedDeliveryRecord.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDeliveryRecord(null)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedSmtpRecord)} onOpenChange={(open) => !open && setSelectedSmtpRecord(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('emailAdmin.smtpConnectionDetails')}</DialogTitle>
            <DialogDescription>{t('emailAdmin.smtpConnectionDetailsDesc')}</DialogDescription>
          </DialogHeader>

          {selectedSmtpRecord && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">{t('emailAdmin.timestamp')}</p><p className="font-medium">{formatDate(selectedSmtpRecord.timestamp)}</p></div>
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">{t('common.status')}</p><div className="mt-1">{getStatusBadge(selectedSmtpRecord.status === 'verified' ? 'sent' : selectedSmtpRecord.status === 'failed' ? 'failed' : 'queued')}</div></div>
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">{t('emailAdmin.source')}</p><p className="font-medium">{selectedSmtpRecord.source}</p></div>
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">{t('emailAdmin.hostPort')}</p><p className="font-medium">{selectedSmtpRecord.host || 'unknown'}{selectedSmtpRecord.port ? `:${selectedSmtpRecord.port}` : ''}</p></div>
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">{t('emailAdmin.tlsRequired')}</p><p className="font-medium">{selectedSmtpRecord.requiresTLS ? t('common.yes') : t('common.no')}</p></div>
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">{t('emailAdmin.secureSSL')}</p><p className="font-medium">{selectedSmtpRecord.secure ? t('common.yes') : t('common.no')}</p></div>
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">{t('emailAdmin.authentication')}</p><p className="font-medium">{selectedSmtpRecord.hasAuth ? t('common.yes') : t('common.no')}</p></div>
              <div className="rounded border p-3"><p className="text-xs text-muted-foreground">{t('emailAdmin.message')}</p><p className="font-medium break-words">{selectedSmtpRecord.message || 'N/A'}</p></div>

              {selectedSmtpRecord.error && (
                <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 md:col-span-2">
                  <p className="text-xs mb-1">{t('common.error')}</p>
                  <p className="break-words">{selectedSmtpRecord.error}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSmtpRecord(null)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
