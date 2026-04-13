import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Globe,
  Search,
  TrendingUp,
  Eye,
  Save,
  Plus,
  Edit,
  BarChart3
} from "lucide-react"

export function SEOManagement() {
  const { t } = useTranslation()
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
        <Button>
          <Save className="h-4 w-4 mr-2" />
          {t('common.save')}
        </Button>
      </div>

      {/* SEO Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('seoManagement.seoScore')}</CardTitle>
            <BarChart3 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">85/100</div>
            <p className="text-xs text-muted-foreground">Good optimization</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('seoManagement.organicTraffic')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12.4K</div>
            <p className="text-xs text-muted-foreground">+15% this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('seoManagement.keywordRankings')}</CardTitle>
            <Search className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">47</div>
            <p className="text-xs text-muted-foreground">Top 10 positions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('seoManagement.pageViews')}</CardTitle>
            <Eye className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89.2K</div>
            <p className="text-xs text-muted-foreground">+8% this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Global SEO Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('seoManagement.seoSettings')}
          </CardTitle>
          <CardDescription>{t('seoManagement.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="site-title">{t('seoManagement.pageTitle')}</Label>
            <Input
              id="site-title"
              defaultValue="FixitHub - Professional Device Repair Services"
              placeholder="Enter site title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site-description">{t('seoManagement.metaDescription')}</Label>
            <Textarea
              id="site-description"
              defaultValue="Professional device repair services for smartphones, tablets, and laptops. Fast, reliable, and affordable repairs with warranty."
              placeholder="Enter meta description"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site-keywords">{t('seoManagement.keywords')}</Label>
            <Input
              id="site-keywords"
              defaultValue="device repair, phone repair, screen replacement, battery replacement"
              placeholder="Enter keywords (comma separated)"
            />
          </div>
        </CardContent>
      </Card>

      {/* Page-Level SEO */}
      <Card>
        <CardHeader>
          <CardTitle>{t('seoManagement.pages')}</CardTitle>
          <CardDescription>{t('seoManagement.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { page: 'Homepage', status: 'Optimized', score: 92 },
              { page: 'Services', status: 'Needs Work', score: 67 },
              { page: 'About Us', status: 'Good', score: 78 },
              { page: 'Contact', status: 'Optimized', score: 89 }
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <span className="font-medium">{item.page}</span>
                  <Badge variant={
                    item.status === 'Optimized' ? 'default' :
                    item.status === 'Good' ? 'secondary' :
                    'destructive'
                  }>
                    {item.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">Score: {item.score}/100</span>
                </div>
                <Button variant="ghost" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Keywords Tracking */}
      <Card>
        <CardHeader>
          <CardTitle>{t('seoManagement.keywordRankings')}</CardTitle>
          <CardDescription>{t('seoManagement.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t('common.add')} {t('seoManagement.keywords')}
            </Button>
            <div className="space-y-2">
              {[
                { keyword: 'phone repair', position: 3, change: '+2' },
                { keyword: 'screen replacement', position: 7, change: '-1' },
                { keyword: 'device repair service', position: 12, change: '+5' }
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">{item.keyword}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Position: {item.position}</span>
                    <Badge variant={item.change.startsWith('+') ? 'default' : 'destructive'}>
                      {item.change}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}