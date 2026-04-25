import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import {
  Globe,
  Search,
  TrendingUp,
  Eye,
  Save,
  Plus,
  Edit,
  BarChart3,
  Trash2,
  FileText,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Settings,
  Info
} from "lucide-react"
import * as seoApi from '@/api/seo'
import type { SEOSettings } from '@/api/seo'

export function SEOManagement() {
  const { t } = useTranslation()
  const { toast } = useToast()
  
  // State
  const [seoSettings, setSeoSettings] = useState<SEOSettings[]>([])
  const [analytics, setAnalytics] = useState<any>(null)
  const [sitemap, setSitemap] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSettings, setEditingSettings] = useState<Partial<SEOSettings> | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalSettings, setTotalSettings] = useState(0)
  const [filters, setFilters] = useState({
    pageType: '',
    search: ''
  })

  // Load data
  useEffect(() => {
    loadData()
  }, [currentPage, filters])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load all SEO settings
      const settingsResponse = await seoApi.getAllSEOSettings({
        ...filters,
        page: currentPage,
        limit: 10
      })
      
      if (settingsResponse.success) {
        setSeoSettings(settingsResponse.settings || [])
        setTotalPages(settingsResponse.totalPages || 1)
        setTotalSettings(settingsResponse.totalSettings || 0)
      }
      
      // Load analytics (only on first page without filters)
      if (currentPage === 1 && !filters.pageType && !filters.search) {
        const analyticsResponse = await seoApi.getSEOAnalytics()
        if (analyticsResponse.success) {
          setAnalytics(analyticsResponse.analytics)
        }
        
        // Load sitemap
        const sitemapResponse = await seoApi.getSitemapData()
        if (sitemapResponse.success) {
          setSitemap(sitemapResponse.sitemap || [])
        }
      }
    } catch (error) {
      console.error('Error loading SEO data:', error)
      toast({
        title: t('common.error'),
        description: t('seoManagement.errorLoadingData'),
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!editingSettings) return

    try {
      const response = await seoApi.upsertSEOSettings(editingSettings as any)
      
      if (response.success) {
        toast({
          title: t('common.success'),
          description: t('seoManagement.settingsSaved')
        })
        setIsDialogOpen(false)
        setEditingSettings(null)
        loadData()
      }
    } catch (error: any) {
      console.error('Error saving SEO settings:', error)
      toast({
        title: t('common.error'),
        description: error.response?.data?.error || t('seoManagement.errorSaving'),
        variant: 'destructive'
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('seoManagement.confirmDelete'))) return

    try {
      const response = await seoApi.deleteSEOSettings(id)
      
      if (response.success) {
        toast({
          title: t('common.success'),
          description: t('seoManagement.settingsDeleted')
        })
        loadData()
      }
    } catch (error: any) {
      console.error('Error deleting SEO settings:', error)
      toast({
        title: t('common.error'),
        description: error.response?.data?.error || t('seoManagement.errorDeleting'),
        variant: 'destructive'
      })
    }
  }

  const openEditDialog = (settings?: SEOSettings) => {
    if (settings) {
      setEditingSettings(settings)
    } else {
      setEditingSettings({
        pageType: 'global',
        pageId: '',
        title: '',
        description: '',
        keywords: [],
        canonicalUrl: '',
        openGraph: {
          title: '',
          description: '',
          image: '',
          type: 'website',
          url: ''
        },
        twitterCard: {
          card: 'summary_large_image',
          title: '',
          description: '',
          image: ''
        },
        schemaMarkup: {},
        robots: {
          index: true,
          follow: true,
          noarchive: false,
          nosnippet: false
        },
        priority: 0.5,
        changeFreq: 'weekly',
        isActive: true
      })
    }
    setIsDialogOpen(true)
  }

  const updateField = (field: string, value: any) => {
    setEditingSettings(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const updateNestedField = (parent: string, field: string, value: any) => {
    setEditingSettings(prev => ({
      ...prev,
      [parent]: {
        ...(prev as any)?.[parent],
        [field]: value
      }
    }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Search className="h-8 w-8" />
            {t('seoManagement.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('seoManagement.description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => loadData()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('common.refresh')}
          </Button>
          <Button onClick={() => openEditDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            {t('seoManagement.addSettings')}
          </Button>
        </div>
      </div>

      {/* Analytics */}
      {analytics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('seoManagement.totalPages')}</CardTitle>
              <FileText className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalPages || 0}</div>
              <p className="text-xs text-muted-foreground">{t('seoManagement.totalPagesDesc')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('seoManagement.indexablePages')}</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.indexablePages || 0}</div>
              <p className="text-xs text-muted-foreground">{t('seoManagement.allowedByRobots')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('seoManagement.nonIndexablePages')}</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.nonIndexablePages || 0}</div>
              <p className="text-xs text-muted-foreground">{t('seoManagement.blockedByRobots')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('seoManagement.pageTypes')}</CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.pageTypeBreakdown?.length || 0}</div>
              <p className="text-xs text-muted-foreground">{t('seoManagement.differentTypes')}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">{t('seoManagement.seoSettings')}</TabsTrigger>
          <TabsTrigger value="sitemap">{t('seoManagement.sitemap')}</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('common.filters')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t('seoManagement.pageType')}</Label>
                  <div className="flex gap-2">
                    <Select 
                      value={filters.pageType || undefined} 
                      onValueChange={(value) => setFilters(prev => ({ ...prev, pageType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('common.all')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">{t('seoManagement.global')}</SelectItem>
                        <SelectItem value="homepage">{t('seoManagement.homepage')}</SelectItem>
                        <SelectItem value="blog_post">{t('seoManagement.blogPost')}</SelectItem>
                        <SelectItem value="product">{t('seoManagement.product')}</SelectItem>
                        <SelectItem value="service">{t('seoManagement.service')}</SelectItem>
                        <SelectItem value="page">{t('seoManagement.page')}</SelectItem>
                      </SelectContent>
                    </Select>
                    {filters.pageType && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilters(prev => ({ ...prev, pageType: '' }))}
                      >
                        ×
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('common.search')}</Label>
                  <Input
                    placeholder={t('seoManagement.searchPlaceholder')}
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SEO Settings Table */}
          <Card>
            <CardHeader>
              <CardTitle>{t('seoManagement.allSettings')} ({totalSettings})</CardTitle>
              <CardDescription>{t('seoManagement.manageAllSeoSettings')}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">{t('common.loading')}</div>
              ) : seoSettings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('seoManagement.noSettings')}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('seoManagement.pageType')}</TableHead>
                        <TableHead>{t('seoManagement.pageTitle')}</TableHead>
                        <TableHead>{t('seoManagement.metaDescription')}</TableHead>
                        <TableHead>{t('seoManagement.robots')}</TableHead>
                        <TableHead>{t('common.status')}</TableHead>
                        <TableHead className="text-right">{t('common.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {seoSettings.map((setting) => (
                        <TableRow key={setting._id}>
                          <TableCell>
                            <Badge variant="outline">{setting.pageType}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {setting.title}
                            {setting.pageId && (
                              <span className="text-xs text-muted-foreground block">
                                ID: {setting.pageId}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {setting.description}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {setting.robots.index ? (
                                <Badge variant="default" className="text-xs">Index</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">NoIndex</Badge>
                              )}
                              {setting.robots.follow ? (
                                <Badge variant="default" className="text-xs">Follow</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">NoFollow</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {setting.isActive ? (
                              <Badge variant="default">{t('common.active')}</Badge>
                            ) : (
                              <Badge variant="secondary">{t('common.inactive')}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(setting)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(setting._id!)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      {t('common.page')} {currentPage} {t('common.of')} {totalPages}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sitemap" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('seoManagement.sitemapData')}</CardTitle>
              <CardDescription>{t('seoManagement.sitemapDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              {sitemap.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('seoManagement.noSitemapData')}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('seoManagement.url')}</TableHead>
                      <TableHead>{t('seoManagement.lastModified')}</TableHead>
                      <TableHead>{t('seoManagement.changeFrequency')}</TableHead>
                      <TableHead>{t('seoManagement.priority')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sitemap.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm">{item.url}</TableCell>
                        <TableCell>{new Date(item.lastModified).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.changeFrequency}</Badge>
                        </TableCell>
                        <TableCell>{item.priority}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSettings?._id ? t('seoManagement.editSettings') : t('seoManagement.addSettings')}
            </DialogTitle>
            <DialogDescription>
              {editingSettings?._id ? t('seoManagement.editDescription') : t('seoManagement.addDescription')}
            </DialogDescription>
          </DialogHeader>

          {editingSettings && (
            <div className="space-y-6">
              {/* Basic Settings */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">{t('seoManagement.basicSettings')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{t('seoManagement.basicSettingsHelp')}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>{t('seoManagement.pageType')} *</Label>
                      <div className="group relative">
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-popover text-popover-foreground text-xs rounded-md shadow-md border z-10">
                          {t('seoManagement.pageTypeHelp')}
                        </div>
                      </div>
                    </div>
                    <Select 
                      value={editingSettings.pageType} 
                      onValueChange={(value) => updateField('pageType', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">{t('seoManagement.global')}</SelectItem>
                        <SelectItem value="homepage">{t('seoManagement.homepage')}</SelectItem>
                        <SelectItem value="blog_post">{t('seoManagement.blogPost')}</SelectItem>
                        <SelectItem value="product">{t('seoManagement.product')}</SelectItem>
                        <SelectItem value="service">{t('seoManagement.service')}</SelectItem>
                        <SelectItem value="page">{t('seoManagement.page')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>{t('seoManagement.pageId')}</Label>
                      <div className="group relative">
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-popover text-popover-foreground text-xs rounded-md shadow-md border z-10">
                          {t('seoManagement.pageIdHelp')}
                        </div>
                      </div>
                    </div>
                    <Input
                      value={editingSettings.pageId || ''}
                      onChange={(e) => updateField('pageId', e.target.value)}
                      placeholder={t('seoManagement.pageIdPlaceholder')}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t('seoManagement.pageTitle')} *</Label>
                    <div className="group relative">
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-popover text-popover-foreground text-xs rounded-md shadow-md border z-10">
                        {t('seoManagement.titleHelp')}
                      </div>
                    </div>
                  </div>
                  <Input
                    value={editingSettings.title || ''}
                    onChange={(e) => updateField('title', e.target.value)}
                    maxLength={60}
                    placeholder={t('seoManagement.titlePlaceholder')}
                  />
                  <p className="text-xs text-muted-foreground">
                    {editingSettings.title?.length || 0}/60
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t('seoManagement.metaDescription')} *</Label>
                    <div className="group relative">
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-popover text-popover-foreground text-xs rounded-md shadow-md border z-10">
                        {t('seoManagement.descriptionHelp')}
                      </div>
                    </div>
                  </div>
                  <Textarea
                    value={editingSettings.description || ''}
                    onChange={(e) => updateField('description', e.target.value)}
                    maxLength={160}
                    rows={3}
                    placeholder={t('seoManagement.descriptionPlaceholder')}
                  />
                  <p className="text-xs text-muted-foreground">
                    {editingSettings.description?.length || 0}/160
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t('seoManagement.keywords')}</Label>
                    <div className="group relative">
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-popover text-popover-foreground text-xs rounded-md shadow-md border z-10">
                        {t('seoManagement.keywordsHelp')}
                      </div>
                    </div>
                  </div>
                  <Input
                    value={editingSettings.keywords?.join(', ') || ''}
                    onChange={(e) => updateField('keywords', e.target.value.split(',').map(k => k.trim()).filter(Boolean))}
                    placeholder={t('seoManagement.keywordsPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t('seoManagement.canonicalUrl')}</Label>
                    <div className="group relative">
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-popover text-popover-foreground text-xs rounded-md shadow-md border z-10">
                        {t('seoManagement.canonicalUrlHelp')}
                      </div>
                    </div>
                  </div>
                  <Input
                    value={editingSettings.canonicalUrl || ''}
                    onChange={(e) => updateField('canonicalUrl', e.target.value)}
                    placeholder={t('seoManagement.canonicalUrlPlaceholder')}
                  />
                </div>
              </div>

              {/* Open Graph */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">{t('seoManagement.openGraph')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{t('seoManagement.openGraphHelp')}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('seoManagement.ogTitle')}</Label>
                  <Input
                    value={editingSettings.openGraph?.title || ''}
                    onChange={(e) => updateNestedField('openGraph', 'title', e.target.value)}
                    placeholder={t('seoManagement.ogTitlePlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('seoManagement.ogDescription')}</Label>
                  <Textarea
                    value={editingSettings.openGraph?.description || ''}
                    onChange={(e) => updateNestedField('openGraph', 'description', e.target.value)}
                    rows={2}
                    placeholder={t('seoManagement.ogDescriptionPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t('seoManagement.ogImage')}</Label>
                    <div className="group relative">
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-popover text-popover-foreground text-xs rounded-md shadow-md border z-10">
                        {t('seoManagement.ogImageHelp')}
                      </div>
                    </div>
                  </div>
                  <Input
                    value={editingSettings.openGraph?.image || ''}
                    onChange={(e) => updateNestedField('openGraph', 'image', e.target.value)}
                    placeholder={t('seoManagement.ogImagePlaceholder')}
                  />
                </div>
              </div>

              {/* Twitter Card */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">{t('seoManagement.twitterCard')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{t('seoManagement.twitterCardHelp')}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t('seoManagement.twitterCardType')}</Label>
                    <div className="group relative">
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-popover text-popover-foreground text-xs rounded-md shadow-md border z-10">
                        {t('seoManagement.twitterCardTypeHelp')}
                      </div>
                    </div>
                  </div>
                  <Select 
                    value={editingSettings.twitterCard?.card || 'summary_large_image'} 
                    onValueChange={(value) => updateNestedField('twitterCard', 'card', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="summary">{t('seoManagement.twitterCardTypes.summary')}</SelectItem>
                      <SelectItem value="summary_large_image">{t('seoManagement.twitterCardTypes.summaryLargeImage')}</SelectItem>
                      <SelectItem value="app">{t('seoManagement.twitterCardTypes.app')}</SelectItem>
                      <SelectItem value="player">{t('seoManagement.twitterCardTypes.player')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('seoManagement.twitterTitle')}</Label>
                  <Input
                    value={editingSettings.twitterCard?.title || ''}
                    onChange={(e) => updateNestedField('twitterCard', 'title', e.target.value)}
                    placeholder={t('seoManagement.twitterTitlePlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('seoManagement.twitterDescription')}</Label>
                  <Textarea
                    value={editingSettings.twitterCard?.description || ''}
                    onChange={(e) => updateNestedField('twitterCard', 'description', e.target.value)}
                    rows={2}
                    placeholder={t('seoManagement.twitterDescriptionPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t('seoManagement.twitterImage')}</Label>
                    <div className="group relative">
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-popover text-popover-foreground text-xs rounded-md shadow-md border z-10">
                        {t('seoManagement.twitterImageHelp')}
                      </div>
                    </div>
                  </div>
                  <Input
                    value={editingSettings.twitterCard?.image || ''}
                    onChange={(e) => updateNestedField('twitterCard', 'image', e.target.value)}
                    placeholder={t('seoManagement.twitterImagePlaceholder')}
                  />
                </div>
              </div>

              {/* Robots & Sitemap */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">{t('seoManagement.robotsAndSitemap')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{t('seoManagement.robotsHelp')}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-2">
                      <Label>{t('seoManagement.allowIndex')}</Label>
                      <div className="group relative">
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-popover text-popover-foreground text-xs rounded-md shadow-md border z-10">
                          {t('seoManagement.allowIndexHelp')}
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={editingSettings.robots?.index || false}
                      onCheckedChange={(checked) => updateNestedField('robots', 'index', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-2">
                      <Label>{t('seoManagement.allowFollow')}</Label>
                      <div className="group relative">
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-popover text-popover-foreground text-xs rounded-md shadow-md border z-10">
                          {t('seoManagement.allowFollowHelp')}
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={editingSettings.robots?.follow || false}
                      onCheckedChange={(checked) => updateNestedField('robots', 'follow', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-2">
                      <Label>{t('seoManagement.noArchive')}</Label>
                      <div className="group relative">
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-popover text-popover-foreground text-xs rounded-md shadow-md border z-10">
                          {t('seoManagement.noArchiveHelp')}
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={editingSettings.robots?.noarchive || false}
                      onCheckedChange={(checked) => updateNestedField('robots', 'noarchive', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-2">
                      <Label>{t('seoManagement.noSnippet')}</Label>
                      <div className="group relative">
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-popover text-popover-foreground text-xs rounded-md shadow-md border z-10">
                          {t('seoManagement.noSnippetHelp')}
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={editingSettings.robots?.nosnippet || false}
                      onCheckedChange={(checked) => updateNestedField('robots', 'nosnippet', checked)}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>{t('seoManagement.priority')}</Label>
                      <div className="group relative">
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-popover text-popover-foreground text-xs rounded-md shadow-md border z-10">
                          {t('seoManagement.priorityHelp')}
                        </div>
                      </div>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={editingSettings.priority || 0.5}
                      onChange={(e) => updateField('priority', parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>{t('seoManagement.changeFrequency')}</Label>
                      <div className="group relative">
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-80 p-2 bg-popover text-popover-foreground text-xs rounded-md shadow-md border z-10">
                          {t('seoManagement.changeFreqHelp')}
                        </div>
                      </div>
                    </div>
                    <Select 
                      value={editingSettings.changeFreq || 'weekly'} 
                      onValueChange={(value) => updateField('changeFreq', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="always">{t('seoManagement.changeFreq.always')}</SelectItem>
                        <SelectItem value="hourly">{t('seoManagement.changeFreq.hourly')}</SelectItem>
                        <SelectItem value="daily">{t('seoManagement.changeFreq.daily')}</SelectItem>
                        <SelectItem value="weekly">{t('seoManagement.changeFreq.weekly')}</SelectItem>
                        <SelectItem value="monthly">{t('seoManagement.changeFreq.monthly')}</SelectItem>
                        <SelectItem value="yearly">{t('seoManagement.changeFreq.yearly')}</SelectItem>
                        <SelectItem value="never">{t('seoManagement.changeFreq.never')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <Label>{t('common.active')}</Label>
                  <Switch
                    checked={editingSettings.isActive || false}
                    onCheckedChange={(checked) => updateField('isActive', checked)}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}