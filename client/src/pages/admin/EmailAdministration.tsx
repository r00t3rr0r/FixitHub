import { useEffect, useState } from "react"
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
  const { toast } = useToast()

  const [stats, setStats] = useState<EmailStats | null>(null)
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
  const [composeEmailSubject, setComposeEmailSubject] = useState("FixitHub SMTP Test")
  const [composeEmailBody, setComposeEmailBody] = useState("Dies ist eine Test-E-Mail aus dem FixitHub SMTP-Konfigurationspanel.\n\nWenn Sie diese Nachricht erhalten, ist Ihre SMTP-Konfiguration korrekt eingerichtet.")
  const [composeEmailFrom, setComposeEmailFrom] = useState("")
  const [sendingComposedEmail, setSendingComposedEmail] = useState(false)

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
      }
    } catch (error) {
      console.error("Error loading stats:", error)
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Statistiken konnten nicht geladen werden",
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
        title: "Fehler",
        description: "Verlauf konnte nicht geladen werden",
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
        setTotalPages(data.pagination?.pages || 1)
      } else {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || data.message || "Erweitertes Protokoll konnte nicht geladen werden")
      }
    } catch (error) {
      console.error("Error loading delivery log:", error)
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Versandprotokoll konnte nicht geladen werden",
      })
    } finally {
      setLoadingLog(false)
    }
  }

  const handleTestEmail = async () => {
    if (!testEmailTo) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Bitte E-Mail-Adresse eingeben",
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
          title: "Erfolgreich",
          description: data.message || "SMTP-Test erfolgreich",
        })
        setTestEmailDialog(false)
      } else {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: data.message || "SMTP-Test fehlgeschlagen",
        })
      }
    } catch (error) {
      console.error("Error testing SMTP:", error)
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Verbindungsfehler beim Testen",
      })
    } finally {
      setSendingTest(false)
    }
  }

  const handleSendComposedEmail = async () => {
    if (!composeEmailTo.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Empfänger-Adresse ist erforderlich" })
      return
    }
    if (!composeEmailSubject.trim()) {
      toast({ variant: "destructive", title: "Fehler", description: "Betreff ist erforderlich" })
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
        toast({ title: "E-Mail gesendet", description: data.message || `Test-E-Mail erfolgreich an ${composeEmailTo} gesendet` })
        setComposeTestEmailDialog(false)
      } else {
        toast({ variant: "destructive", title: "Senden fehlgeschlagen", description: data.message || "Test-E-Mail konnte nicht gesendet werden" })
      }
    } catch (error) {
      console.error("Error sending test email:", error)
      toast({ variant: "destructive", title: "Verbindungsfehler", description: "E-Mail konnte nicht gesendet werden" })
    } finally {
      setSendingComposedEmail(false)
    }
  }

  const handleSaveSettings = async () => {
    // Validierung
    if (!emailSettings.smtpHost.trim()) {
      toast({
        variant: "destructive",
        title: "Validierungsfehler",
        description: "SMTP-Host ist erforderlich",
      })
      return
    }

    if (emailSettings.smtpPort < 1 || emailSettings.smtpPort > 65535) {
      toast({
        variant: "destructive",
        title: "Validierungsfehler",
        description: "SMTP-Port muss zwischen 1 und 65535 liegen",
      })
      return
    }

    if (emailSettings.requiresAuthentication) {
      if (!emailSettings.smtpUsername.trim()) {
        toast({
          variant: "destructive",
          title: "Validierungsfehler",
          description: "SMTP-Benutzername ist erforderlich wenn Authentifizierung aktiviert ist",
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
          title: "Erfolgreich",
          description: "SMTP-Konfiguration wurde gespeichert",
        })
      } else {
        toast({
          variant: "destructive",
          title: "Fehler",
          description:
            data.error || data.message || "Fehler beim Speichern der SMTP-Konfiguration",
        })
      }
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Verbindungsfehler beim Speichern der Konfiguration",
      })
    } finally {
      setSavingSettings(false)
    }
  }

  const handleRefresh = async () => {
    await Promise.all([loadStats(), loadDeliveryLog()])
    toast({
      title: "Erfolgreich",
      description: "Daten wurden aktualisiert",
    })
  }

  const handleDownloadLog = () => {
    const csv = [
      ["Zeitstempel", "Empfaenger", "Vorlage", "Status", "Versuche", "Dauer (ms)", "Fehler"].join(","),
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
    if (status === "sent") return <Badge variant="outline" className="bg-green-50 text-green-900">Versendet</Badge>
    if (status === "failed") return <Badge variant="outline" className="bg-red-50 text-red-900">Fehlgeschlagen</Badge>
    if (status === "queued") return <Badge variant="outline" className="bg-blue-50 text-blue-900">In Warteschlange</Badge>
    return <Badge>{status}</Badge>
  }

  if (loading) {
    return (
      <div className="email-admin-loading">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <p>Email-Verwaltung wird geladen...</p>
      </div>
    )
  }

  return (
    <div className="email-administration">
      <div className="email-admin-header">
        <div>
          <h1 className="text-3xl font-bold">Email-Verwaltung</h1>
          <p className="text-muted-foreground">SMTP Email-Integration Monitor und Konfiguration</p>
        </div>
        <Button onClick={handleRefresh} disabled={loadingStats} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />Aktualisieren
        </Button>
      </div>

      <Tabs defaultValue="statistics" className="email-admin-tabs">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="statistics"><BarChart3 className="h-4 w-4 mr-2" />Statistiken</TabsTrigger>
          <TabsTrigger value="history"><Clock className="h-4 w-4 mr-2" />Verlauf</TabsTrigger>
          <TabsTrigger value="logs"><Mail className="h-4 w-4 mr-2" />Protokoll</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-2" />Einstellungen</TabsTrigger>
        </TabsList>

        <TabsContent value="statistics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Gesamt</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats?.totalRecords || 0}</div><p className="text-xs text-muted-foreground mt-1">E-Mails im Speicher</p></CardContent></Card>
            <Card className="border-green-200"><CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-green-900 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Versendet</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-900">{stats?.sent || 0}</div></CardContent></Card>
            <Card className="border-red-200"><CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-red-900 flex items-center gap-2"><AlertCircle className="h-4 w-4" />Fehlgeschlagen</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-900">{stats?.failed || 0}</div></CardContent></Card>
            <Card className="border-blue-200"><CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-blue-900 flex items-center gap-2"><TrendingUp className="h-4 w-4" />Durchschnitt</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-900">{formatDuration(stats?.averageDuration || 0)}</div></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Empfaenger-Verlauf</CardTitle><CardDescription>Versandverlauf fuer eine spezifische E-Mail-Adresse</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input placeholder="E-Mail-Adresse eingeben..." value={selectedEmail} onChange={(e) => setSelectedEmail(e.target.value)} type="email" />
                <Button onClick={() => loadDeliveryHistory(selectedEmail)} disabled={loadingHistory || !selectedEmail}><Search className="h-4 w-4" /></Button>
              </div>
              {selectedEmail && (
                <div className="space-y-3">
                  {loadingHistory ? (
                    <div className="flex items-center justify-center py-8"><RefreshCw className="h-4 w-4 animate-spin mr-2" />Wird geladen...</div>
                  ) : deliveryHistory.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-8 text-center">Keine Versandaktualisierungen gefunden</p>
                  ) : (
                    deliveryHistory.map((record) => (
                      <div key={record.id} className="border rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1"><span className="font-medium text-sm">{record.templateName}</span>{getStatusBadge(record.status)}</div>
                        <p className="text-sm text-muted-foreground line-clamp-1">{record.subject}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground"><span>Versuche: {record.attempts}</span><span>Dauer: {formatDuration(record.duration)}</span><span>{formatDate(record.timestamp)}</span></div>
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
            <CardHeader><CardTitle>Email-Versandprotokoll</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Select value={logFilter} onValueChange={(value) => { setLogFilter(value as typeof logFilter); setLogPage(1) }}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="sent">Versendet</SelectItem>
                    <SelectItem value="failed">Fehlgeschlagen</SelectItem>
                    <SelectItem value="queued">In Warteschlange</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={smtpFilter} onValueChange={(value) => setSmtpFilter(value as typeof smtpFilter)}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="SMTP-Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">SMTP: Alle</SelectItem>
                    <SelectItem value="attempted">SMTP: Attempted</SelectItem>
                    <SelectItem value="verified">SMTP: Verified</SelectItem>
                    <SelectItem value="failed">SMTP: Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleDownloadLog} variant="outline"><Download className="h-4 w-4 mr-2" />CSV Exportieren</Button>
              </div>

              {loadingLog ? (
                <div className="flex items-center justify-center py-8"><RefreshCw className="h-4 w-4 animate-spin mr-2" />Wird geladen...</div>
              ) : deliveryLog.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">Keine Versandaktualisierungen vorhanden</p>
              ) : (
                <div className="space-y-3">
                  {deliveryLog.map((record) => (
                    <div key={record.id} className="border rounded-lg p-3">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div><p className="text-xs text-muted-foreground">Empfaenger</p><p className="font-medium text-sm truncate">{record.to}</p></div>
                        <div><p className="text-xs text-muted-foreground">Vorlage</p><p className="text-sm truncate">{record.templateName}</p></div>
                        <div><p className="text-xs text-muted-foreground">Status</p>{getStatusBadge(record.status)}</div>
                        <div><p className="text-xs text-muted-foreground">Dauer</p><p className="text-sm">{formatDuration(record.duration)}</p></div>
                        <div><p className="text-xs text-muted-foreground">Zeit</p><p className="text-sm whitespace-nowrap">{new Date(record.timestamp).toLocaleTimeString()}</p></div>
                      </div>
                      {record.error && <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">Fehler: {record.error}</div>}
                    </div>
                  ))}
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">Seite {logPage} von {totalPages}</div>
                  <div className="flex gap-2">
                    <Button onClick={() => setLogPage(Math.max(1, logPage - 1))} disabled={logPage === 1} variant="outline" size="sm">Zurueck</Button>
                    <Button onClick={() => setLogPage(Math.min(totalPages, logPage + 1))} disabled={logPage === totalPages} variant="outline" size="sm">Weiter</Button>
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <div>
                  <h4 className="font-medium">SMTP-Verbindungslog</h4>
                  <p className="text-sm text-muted-foreground">Erweitertes Protokoll der SMTP-Transporter- und Verbindungspruefung</p>
                </div>

                {smtpConnectionLog.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Keine SMTP-Verbindungseintraege vorhanden</p>
                ) : (
                  <div className="space-y-2">
                    {smtpConnectionLog.map((entry) => (
                      <div key={entry.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium">
                            {entry.host || "unknown"}{entry.port ? `:${entry.port}` : ""} ({entry.source})
                          </div>
                          {getStatusBadge(entry.status === "verified" ? "sent" : entry.status === "failed" ? "failed" : "queued")}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDate(entry.timestamp)} | TLS: {entry.requiresTLS ? "Ja" : "Nein"} | Secure: {entry.secure ? "Ja" : "Nein"} | Auth: {entry.hasAuth ? "Ja" : "Nein"}
                        </div>
                        {entry.message && <div className="mt-1 text-xs">{entry.message}</div>}
                        {entry.error && <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">Fehler: {entry.error}</div>}
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
            <CardHeader><CardTitle>SMTP-Konfiguration</CardTitle><CardDescription>SMTP Einstellungen fuer den E-Mail-Versand</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="smtp-host">SMTP-Server</Label><Input id="smtp-host" placeholder="smtp.gmail.com" value={emailSettings.smtpHost} onChange={(e) => setEmailSettings((prev) => ({ ...prev, smtpHost: e.target.value }))} /></div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-port">SMTP-Port</Label>
                  <Select value={String(emailSettings.smtpPort)} onValueChange={(value) => setEmailSettings((prev) => ({ ...prev, smtpPort: parseInt(value, 10) }))}>
                    <SelectTrigger id="smtp-port"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25 (Unverschluesselt)</SelectItem>
                      <SelectItem value="587">587 (TLS - Empfohlen)</SelectItem>
                      <SelectItem value="465">465 (SSL)</SelectItem>
                      <SelectItem value="2525">2525 (Alternative)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div><Label htmlFor="requires-auth">Authentifizierung erforderlich</Label></div>
                  <Switch id="requires-auth" checked={emailSettings.requiresAuthentication} onCheckedChange={(checked) => setEmailSettings((prev) => ({ ...prev, requiresAuthentication: checked }))} />
                </div>

                {emailSettings.requiresAuthentication && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="smtp-user">Benutzername/E-Mail</Label><Input id="smtp-user" placeholder="accounts@example.com" value={emailSettings.smtpUsername} onChange={(e) => setEmailSettings((prev) => ({ ...prev, smtpUsername: e.target.value }))} /></div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-pass">Passwort</Label>
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
                <div className="flex items-center justify-between"><div><Label htmlFor="requires-tls">TLS/SSL erforderlich</Label></div><Switch id="requires-tls" checked={emailSettings.requiresTLS} onCheckedChange={(checked) => setEmailSettings((prev) => ({ ...prev, requiresTLS: checked }))} /></div>
                <div className="flex items-center justify-between"><div><Label htmlFor="enable-notifications">Benachrichtigungen aktiviert</Label></div><Switch id="enable-notifications" checked={emailSettings.enableNotifications} onCheckedChange={(checked) => setEmailSettings((prev) => ({ ...prev, enableNotifications: checked }))} /></div>
              </div>

              <Separator />

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-blue-900">SMTP-Verbindung testen</h4>
                    <p className="text-sm text-blue-700 mt-1">Überprüfen Sie Ihre Konfiguration oder senden Sie eine echte Test-E-Mail</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Button onClick={() => setTestEmailDialog(true)} variant="outline" disabled={!emailSettings.smtpHost}><TestTube className="h-4 w-4 mr-2" />Verbindung testen</Button>
                      <Button onClick={() => { setComposeEmailFrom(emailSettings.smtpUsername); setComposeTestEmailDialog(true) }} variant="default" disabled={!emailSettings.smtpHost} className="bg-blue-600 hover:bg-blue-700 text-white"><Send className="h-4 w-4 mr-2" />Test-E-Mail senden</Button>
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
                    <><div className="h-4 w-4 mr-2 border-2 border-current border-r-transparent rounded-full animate-spin" />Speichern...</>
                  ) : (
                    <><Mail className="h-4 w-4 mr-2" />Einstellungen speichern</>
                  )}
                </Button>

                {hasUnsavedChanges && originalEmailSettings && (
                  <Button
                    onClick={() => {
                      setEmailSettings(originalEmailSettings)
                      toast({ title: "Zurueckgesetzt", description: "Aenderungen wurden verworfen" })
                    }}
                    variant="outline"
                    className="w-full md:w-auto"
                    disabled={savingSettings}
                  >
                    Zuruecksetzen
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
            <DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-blue-600" />Test-E-Mail senden</DialogTitle>
            <DialogDescription>Verfassen und senden Sie eine echte Test-E-Mail über Ihren konfigurierten SMTP-Server</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-gray-50 border rounded-lg p-3 text-sm space-y-1">
              <p><span className="font-medium">Server:</span> {emailSettings.smtpHost}:{emailSettings.smtpPort}</p>
              <p><span className="font-medium">Benutzer:</span> {emailSettings.smtpUsername || "–"}</p>
              <p><span className="font-medium">TLS:</span> {emailSettings.requiresTLS ? "Ja" : "Nein"} · <span className="font-medium">Auth:</span> {emailSettings.requiresAuthentication ? "Ja" : "Nein"}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="compose-from">Absender (From)</Label>
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
              <Label htmlFor="compose-to">Empfänger (An) *</Label>
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
              <Label htmlFor="compose-subject">Betreff *</Label>
              <Input
                id="compose-subject"
                type="text"
                placeholder="Betreff"
                value={composeEmailSubject}
                onChange={(e) => setComposeEmailSubject(e.target.value)}
                disabled={sendingComposedEmail}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="compose-body">Nachrichtentext</Label>
              <Textarea
                id="compose-body"
                rows={5}
                placeholder="Nachrichtentext..."
                value={composeEmailBody}
                onChange={(e) => setComposeEmailBody(e.target.value)}
                disabled={sendingComposedEmail}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeTestEmailDialog(false)} disabled={sendingComposedEmail}>Abbrechen</Button>
            <Button onClick={handleSendComposedEmail} disabled={sendingComposedEmail || !composeEmailTo.trim() || !composeEmailSubject.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
              {sendingComposedEmail ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Wird gesendet...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" />E-Mail senden</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={testEmailDialog} onOpenChange={setTestEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>SMTP-Verbindung testen</DialogTitle>
            <DialogDescription>Ueberpruefen Sie Ihre Konfiguration mit den aktuellen Einstellungen</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-email">Test-E-Mail-Adresse</Label>
              <Input id="test-email" type="email" placeholder="test@example.com" value={testEmailTo} onChange={(e) => setTestEmailTo(e.target.value)} disabled={sendingTest} />
            </div>
            <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
              <p><span className="font-medium">Server:</span> {emailSettings.smtpHost}:{emailSettings.smtpPort}</p>
              <p><span className="font-medium">Auth:</span> {emailSettings.requiresAuthentication ? "Ja" : "Nein"}</p>
              <p><span className="font-medium">TLS:</span> {emailSettings.requiresTLS ? "Ja" : "Nein"}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTestEmailDialog(false)}>Abbrechen</Button>
            <Button onClick={handleTestEmail} disabled={sendingTest || !testEmailTo}>
              {sendingTest ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Wird getestet...</>
              ) : (
                <><TestTube className="h-4 w-4 mr-2" />Verbindung testen</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
