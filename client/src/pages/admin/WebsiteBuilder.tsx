import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  Layout,
  Palette,
  Type,
  Smartphone,
  Sparkles,
  Code,
  Share2,
  Save,
  Eye,
  Upload,
  Globe,
  Layers,
  Navigation,
  Menu as MenuIcon,
  Image as ImageIcon,
  FileText,
  CheckSquare,
  Video,
  MapPin,
  Plus,
  Trash2,
  Edit,
  GripVertical,
  Monitor,
  Tablet,
  Loader2,
  Wand2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/useToast';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  getWebsiteSettings,
  updateWebsiteSettings,
  updateGeneralSettings,
  updateSEOSettings,
  updatePageLayout,
  updateHeaderConfig,
  updateFooterConfig,
  updateColorScheme,
  updateTypography,
  updateAnimations,
  updateCustomCSS,
  updateCustomJS,
  updateIntegrations,
  publishWebsite,
  createBackup,
  exportSettings,
  addPage,
  updatePage,
  deletePage,
  reorderPages,
  WebsiteSettings,
  Page
} from '@/api/websiteSettings';
import { getPageTemplates, applyTemplate, type PageTemplate } from '@/api/pageTemplates';

export const WebsiteBuilder: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [settings, setSettings] = useState<WebsiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await getWebsiteSettings();
      setSettings(response.settings);
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load website settings'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSection = async (section: string, data: any) => {
    try {
      setSaving(true);
      let response;

      switch (section) {
        case 'general':
          response = await updateGeneralSettings(data);
          break;
        case 'seo':
          response = await updateSEOSettings(data);
          break;
        case 'pageLayout':
          response = await updatePageLayout(data);
          break;
        case 'header':
          response = await updateHeaderConfig(data);
          break;
        case 'footer':
          response = await updateFooterConfig(data);
          break;
        case 'colorScheme':
          response = await updateColorScheme(data);
          break;
        case 'typography':
          response = await updateTypography(data);
          break;
        case 'animations':
          response = await updateAnimations(data);
          break;
        case 'customCSS':
          response = await updateCustomCSS(data);
          break;
        case 'customJS':
          response = await updateCustomJS(data);
          break;
        case 'integrations':
          response = await updateIntegrations(data);
          break;
        default:
          response = await updateWebsiteSettings(data);
      }

      setSettings(response.settings);
      toast({
        title: 'Success',
        description: 'Settings saved successfully'
      });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save settings'
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    try {
      setSaving(true);
      await publishWebsite();
      await fetchSettings();
      toast({
        title: 'Success',
        description: 'Website published successfully!'
      });
    } catch (error: any) {
      console.error('Error publishing:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to publish website'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    try {
      setSaving(true);
      await createBackup();
      toast({
        title: 'Success',
        description: 'Backup created successfully'
      });
    } catch (error: any) {
      console.error('Error creating backup:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to create backup'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      setSaving(true);
      const result = await exportSettings('json');
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: result.mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `website-settings-${new Date().toISOString()}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast({
        title: 'Success',
        description: 'Settings exported successfully'
      });
    } catch (error: any) {
      console.error('Error exporting:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to export settings'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>Failed to load website settings</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Website Builder</h1>
          <p className="text-muted-foreground mt-1">
            Design, customize, and manage your entire website without coding
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleBackup} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            Backup
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={saving}>
            <Upload className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={handlePublish} disabled={saving}>
            <Globe className="h-4 w-4 mr-2" />
            Publish
          </Button>
        </div>
      </div>

      {/* Status Badge */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant={settings.publishing.status === 'published' ? 'default' : 'secondary'}>
                {settings.publishing.status === 'published' ? 'Published' : 'Draft'}
              </Badge>
              {settings.publishing.lastPublished && (
                <span className="text-sm text-muted-foreground">
                  Last published: {new Date(settings.publishing.lastPublished).toLocaleString()}
                </span>
              )}
              <span className="text-sm text-muted-foreground">
                Version: {settings.publishing.version}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant={previewDevice === 'desktop' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewDevice('desktop')}
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                variant={previewDevice === 'tablet' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewDevice('tablet')}
              >
                <Tablet className="h-4 w-4" />
              </Button>
              <Button
                variant={previewDevice === 'mobile' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewDevice('mobile')}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-8 lg:w-auto">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="layout" className="flex items-center gap-2">
            <Layout className="h-4 w-4" />
            <span className="hidden sm:inline">Layout</span>
          </TabsTrigger>
          <TabsTrigger value="design" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Design</span>
          </TabsTrigger>
          <TabsTrigger value="content" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Content</span>
          </TabsTrigger>
          <TabsTrigger value="responsive" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            <span className="hidden sm:inline">Responsive</span>
          </TabsTrigger>
          <TabsTrigger value="animations" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Effects</span>
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            <span className="hidden sm:inline">Advanced</span>
          </TabsTrigger>
          <TabsTrigger value="pages" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Pages</span>
          </TabsTrigger>
        </TabsList>

        {/* General Settings Tab */}
        <TabsContent value="general" className="space-y-4">
          <GeneralSettingsTab settings={settings} onSave={handleSaveSection} saving={saving} />
        </TabsContent>

        {/* Layout & Structure Tab */}
        <TabsContent value="layout" className="space-y-4">
          <LayoutSettingsTab settings={settings} onSave={handleSaveSection} saving={saving} />
        </TabsContent>

        {/* Visual Design Tab */}
        <TabsContent value="design" className="space-y-4">
          <DesignSettingsTab settings={settings} onSave={handleSaveSection} saving={saving} />
        </TabsContent>

        {/* Content Modules Tab */}
        <TabsContent value="content" className="space-y-4">
          <ContentModulesTab settings={settings} onSave={handleSaveSection} saving={saving} />
        </TabsContent>

        {/* Responsive Design Tab */}
        <TabsContent value="responsive" className="space-y-4">
          <ResponsiveSettingsTab settings={settings} onSave={handleSaveSection} saving={saving} />
        </TabsContent>

        {/* Animations & Effects Tab */}
        <TabsContent value="animations" className="space-y-4">
          <AnimationsTab settings={settings} onSave={handleSaveSection} saving={saving} />
        </TabsContent>

        {/* Advanced Customization Tab */}
        <TabsContent value="advanced" className="space-y-4">
          <AdvancedTab settings={settings} onSave={handleSaveSection} saving={saving} />
        </TabsContent>

        {/* Pages Management Tab */}
        <TabsContent value="pages" className="space-y-4">
          <PagesTab settings={settings} onRefresh={fetchSettings} navigate={navigate} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// General Settings Component
const GeneralSettingsTab: React.FC<{
  settings: WebsiteSettings;
  onSave: (section: string, data: any) => Promise<void>;
  saving: boolean;
}> = ({ settings, onSave, saving }) => {
  const [formData, setFormData] = useState({
    projectTitle: settings.projectTitle,
    subdomain: settings.subdomain,
    customDomain: settings.customDomain,
    defaultLanguage: settings.defaultLanguage,
    supportedLanguages: settings.supportedLanguages
  });

  const [seoData, setSeoData] = useState(settings.seo);

  const handleSaveGeneral = () => {
    onSave('general', formData);
  };

  const handleSaveSEO = () => {
    onSave('seo', seoData);
  };

  return (
    <div className="space-y-6">
      {/* Project Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Project Settings</CardTitle>
          <CardDescription>Configure your website's basic information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="projectTitle">Project Title</Label>
            <Input
              id="projectTitle"
              value={formData.projectTitle}
              onChange={(e) => setFormData({ ...formData, projectTitle: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subdomain">Subdomain</Label>
              <Input
                id="subdomain"
                value={formData.subdomain}
                onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
                placeholder="mysite"
              />
              <p className="text-xs text-muted-foreground">yoursite.fixithub.com</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customDomain">Custom Domain</Label>
              <Input
                id="customDomain"
                value={formData.customDomain}
                onChange={(e) => setFormData({ ...formData, customDomain: e.target.value })}
                placeholder="www.yoursite.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultLanguage">Default Language</Label>
            <Select value={formData.defaultLanguage} onValueChange={(value) => setFormData({ ...formData, defaultLanguage: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSaveGeneral} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save General Settings
          </Button>
        </CardContent>
      </Card>

      {/* SEO Settings */}
      <Card>
        <CardHeader>
          <CardTitle>SEO Settings</CardTitle>
          <CardDescription>Optimize your website for search engines</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="seoTitle">Meta Title</Label>
            <Input
              id="seoTitle"
              value={seoData.title}
              onChange={(e) => setSeoData({ ...seoData, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="seoDescription">Meta Description</Label>
            <Textarea
              id="seoDescription"
              value={seoData.description}
              onChange={(e) => setSeoData({ ...seoData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="keywords">Keywords (comma-separated)</Label>
            <Input
              id="keywords"
              value={seoData.keywords.join(', ')}
              onChange={(e) => setSeoData({ ...seoData, keywords: e.target.value.split(',').map(k => k.trim()) })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="favicon">Favicon URL</Label>
            <Input
              id="favicon"
              value={seoData.favicon}
              onChange={(e) => setSeoData({ ...seoData, favicon: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Search Engine Indexing</Label>
              <p className="text-xs text-muted-foreground">Allow search engines to index your site</p>
            </div>
            <Switch
              checked={seoData.enableIndexing}
              onCheckedChange={(checked) => setSeoData({ ...seoData, enableIndexing: checked })}
            />
          </div>

          <Button onClick={handleSaveSEO} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save SEO Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

// Layout Settings Component
const LayoutSettingsTab: React.FC<{
  settings: WebsiteSettings;
  onSave: (section: string, data: any) => Promise<void>;
  saving: boolean;
}> = ({ settings, onSave, saving }) => {
  const [pageLayout, setPageLayout] = useState(settings.pageLayout);
  const [header, setHeader] = useState(settings.header);
  const [footer, setFooter] = useState(settings.footer);

  return (
    <div className="space-y-6">
      {/* Page Layout */}
      <Card>
        <CardHeader>
          <CardTitle>Page Layout</CardTitle>
          <CardDescription>Configure page structure and layout presets</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Layout Preset</Label>
            <Select value={pageLayout.preset} onValueChange={(value: any) => setPageLayout({ ...pageLayout, preset: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one-column">One Column</SelectItem>
                <SelectItem value="two-column">Two Column</SelectItem>
                <SelectItem value="three-column">Three Column</SelectItem>
                <SelectItem value="grid">Grid</SelectItem>
                <SelectItem value="flex">Flex</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Maximum Width (px)</Label>
            <Input
              type="number"
              value={pageLayout.maxWidth}
              onChange={(e) => setPageLayout({ ...pageLayout, maxWidth: parseInt(e.target.value) })}
            />
          </div>

          <Button onClick={() => onSave('pageLayout', pageLayout)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Layout
          </Button>
        </CardContent>
      </Card>

      {/* Header Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Header Configuration</CardTitle>
          <CardDescription>Customize your website header</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Logo URL</Label>
            <Input
              value={header.logo}
              onChange={(e) => setHeader({ ...header, logo: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Header Height (px)</Label>
              <Input
                type="number"
                value={header.height}
                onChange={(e) => setHeader({ ...header, height: parseInt(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label>Position</Label>
              <Select value={header.position} onValueChange={(value: any) => setHeader({ ...header, position: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="static">Static</SelectItem>
                  <SelectItem value="sticky">Sticky</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Transparent Header</Label>
              <Switch
                checked={header.transparent}
                onCheckedChange={(checked) => setHeader({ ...header, transparent: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Show Search</Label>
              <Switch
                checked={header.showSearch}
                onCheckedChange={(checked) => setHeader({ ...header, showSearch: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Show Language Selector</Label>
              <Switch
                checked={header.showLanguageSelector}
                onCheckedChange={(checked) => setHeader({ ...header, showLanguageSelector: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Show Theme Toggle</Label>
              <Switch
                checked={header.showThemeToggle}
                onCheckedChange={(checked) => setHeader({ ...header, showThemeToggle: checked })}
              />
            </div>
          </div>

          <Button onClick={() => onSave('header', header)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Header
          </Button>
        </CardContent>
      </Card>

      {/* Footer Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Footer Configuration</CardTitle>
          <CardDescription>Customize your website footer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Copyright Text</Label>
            <Input
              value={footer.copyright}
              onChange={(e) => setFooter({ ...footer, copyright: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Show Social Icons</Label>
            <Switch
              checked={footer.showSocialIcons}
              onCheckedChange={(checked) => setFooter({ ...footer, showSocialIcons: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Show Newsletter Signup</Label>
            <Switch
              checked={footer.showNewsletter}
              onCheckedChange={(checked) => setFooter({ ...footer, showNewsletter: checked })}
            />
          </div>

          <Button onClick={() => onSave('footer', footer)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Footer
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

// Design Settings Component
const DesignSettingsTab: React.FC<{
  settings: WebsiteSettings;
  onSave: (section: string, data: any) => Promise<void>;
  saving: boolean;
}> = ({ settings, onSave, saving }) => {
  const [colorScheme, setColorScheme] = useState(settings.colorScheme);
  const [typography, setTypography] = useState(settings.typography);

  return (
    <div className="space-y-6">
      {/* Color Scheme */}
      <Card>
        <CardHeader>
          <CardTitle>Color Scheme</CardTitle>
          <CardDescription>Define your brand colors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(colorScheme).map(([key, value]) => (
              <div key={key} className="space-y-2">
                <Label className="capitalize">{key}</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={value}
                    onChange={(e) => setColorScheme({ ...colorScheme, [key]: e.target.value })}
                    className="w-16 h-10"
                  />
                  <Input
                    value={value}
                    onChange={(e) => setColorScheme({ ...colorScheme, [key]: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
            ))}
          </div>

          <Button onClick={() => onSave('colorScheme', colorScheme)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Colors
          </Button>
        </CardContent>
      </Card>

      {/* Typography */}
      <Card>
        <CardHeader>
          <CardTitle>Typography</CardTitle>
          <CardDescription>Configure fonts and text styling</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Font Family</Label>
            <Input
              value={typography.fontFamily}
              onChange={(e) => setTypography({ ...typography, fontFamily: e.target.value })}
              placeholder="Inter, system-ui, sans-serif"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Base Font Size (px)</Label>
              <Input
                type="number"
                value={typography.baseFontSize}
                onChange={(e) => setTypography({ ...typography, baseFontSize: parseInt(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label>Line Height</Label>
              <Input
                type="number"
                step="0.1"
                value={typography.lineHeight}
                onChange={(e) => setTypography({ ...typography, lineHeight: parseFloat(e.target.value) })}
              />
            </div>
          </div>

          <Button onClick={() => onSave('typography', typography)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Typography
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

// Content Modules Component
const ContentModulesTab: React.FC<{
  settings: WebsiteSettings;
  onSave: (section: string, data: any) => Promise<void>;
  saving: boolean;
}> = ({ settings, onSave, saving }) => {
  const [modules, setModules] = useState(settings.contentModules);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Content Module Configuration</CardTitle>
        <CardDescription>Configure default settings for content modules</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Text Blocks */}
        <div className="space-y-4">
          <h3 className="font-semibold">Text Blocks</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Default Alignment</Label>
              <Select
                value={modules.textBlocks.defaultAlignment}
                onValueChange={(value: any) => setModules({
                  ...modules,
                  textBlocks: { ...modules.textBlocks, defaultAlignment: value }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                  <SelectItem value="justify">Justify</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Default Font Size (px)</Label>
              <Input
                type="number"
                value={modules.textBlocks.defaultFontSize}
                onChange={(e) => setModules({
                  ...modules,
                  textBlocks: { ...modules.textBlocks, defaultFontSize: parseInt(e.target.value) }
                })}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Buttons */}
        <div className="space-y-4">
          <h3 className="font-semibold">Buttons</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Default Style</Label>
              <Select
                value={modules.buttons.defaultStyle}
                onValueChange={(value: any) => setModules({
                  ...modules,
                  buttons: { ...modules.buttons, defaultStyle: value }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Solid</SelectItem>
                  <SelectItem value="outline">Outline</SelectItem>
                  <SelectItem value="ghost">Ghost</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Default Shape</Label>
              <Select
                value={modules.buttons.defaultShape}
                onValueChange={(value: any) => setModules({
                  ...modules,
                  buttons: { ...modules.buttons, defaultShape: value }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rounded">Rounded</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="pill">Pill</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Default Size</Label>
              <Select
                value={modules.buttons.defaultSize}
                onValueChange={(value: any) => setModules({
                  ...modules,
                  buttons: { ...modules.buttons, defaultSize: value }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">Small</SelectItem>
                  <SelectItem value="md">Medium</SelectItem>
                  <SelectItem value="lg">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        {/* Images */}
        <div className="space-y-4">
          <h3 className="font-semibold">Images & Media</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Default Quality (%)</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={modules.images.defaultQuality}
                onChange={(e) => setModules({
                  ...modules,
                  images: { ...modules.images, defaultQuality: parseInt(e.target.value) }
                })}
              />
            </div>

            <div className="space-y-2">
              <Label>Default Aspect Ratio</Label>
              <Select
                value={modules.images.defaultAspectRatio}
                onValueChange={(value) => setModules({
                  ...modules,
                  images: { ...modules.images, defaultAspectRatio: value }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9</SelectItem>
                  <SelectItem value="4:3">4:3</SelectItem>
                  <SelectItem value="1:1">1:1</SelectItem>
                  <SelectItem value="21:9">21:9</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label>Enable Lazy Loading</Label>
            <Switch
              checked={modules.images.lazyLoad}
              onCheckedChange={(checked) => setModules({
                ...modules,
                images: { ...modules.images, lazyLoad: checked }
              })}
            />
          </div>
        </div>

        <Button onClick={() => onSave('contentModules', modules)} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Content Modules
        </Button>
      </CardContent>
    </Card>
  );
};

// Responsive Settings Component
const ResponsiveSettingsTab: React.FC<{
  settings: WebsiteSettings;
  onSave: (section: string, data: any) => Promise<void>;
  saving: boolean;
}> = ({ settings, onSave, saving }) => {
  const [breakpoints, setBreakpoints] = useState(settings.breakpoints);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Responsive Breakpoints</CardTitle>
        <CardDescription>Define breakpoints for different device sizes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Mobile (px)</Label>
            <Input
              type="number"
              value={breakpoints.mobile}
              onChange={(e) => setBreakpoints({ ...breakpoints, mobile: parseInt(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label>Tablet (px)</Label>
            <Input
              type="number"
              value={breakpoints.tablet}
              onChange={(e) => setBreakpoints({ ...breakpoints, tablet: parseInt(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label>Desktop (px)</Label>
            <Input
              type="number"
              value={breakpoints.desktop}
              onChange={(e) => setBreakpoints({ ...breakpoints, desktop: parseInt(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label>Wide (px)</Label>
            <Input
              type="number"
              value={breakpoints.wide}
              onChange={(e) => setBreakpoints({ ...breakpoints, wide: parseInt(e.target.value) })}
            />
          </div>
        </div>

        <Button onClick={() => onSave('breakpoints', breakpoints)} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Breakpoints
        </Button>
      </CardContent>
    </Card>
  );
};

// Animations Component
const AnimationsTab: React.FC<{
  settings: WebsiteSettings;
  onSave: (section: string, data: any) => Promise<void>;
  saving: boolean;
}> = ({ settings, onSave, saving }) => {
  const [animations, setAnimations] = useState(settings.animations);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Animations & Interactions</CardTitle>
        <CardDescription>Configure animation effects and transitions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Scroll Animations</Label>
              <p className="text-xs text-muted-foreground">Animate elements on scroll</p>
            </div>
            <Switch
              checked={animations.enableScrollAnimations}
              onCheckedChange={(checked) => setAnimations({ ...animations, enableScrollAnimations: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Hover Effects</Label>
              <p className="text-xs text-muted-foreground">Enable hover state effects</p>
            </div>
            <Switch
              checked={animations.enableHoverEffects}
              onCheckedChange={(checked) => setAnimations({ ...animations, enableHoverEffects: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Transitions</Label>
              <p className="text-xs text-muted-foreground">Smooth transitions between states</p>
            </div>
            <Switch
              checked={animations.enableTransitions}
              onCheckedChange={(checked) => setAnimations({ ...animations, enableTransitions: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Parallax Effect</Label>
              <p className="text-xs text-muted-foreground">Background parallax scrolling</p>
            </div>
            <Switch
              checked={animations.enableParallax}
              onCheckedChange={(checked) => setAnimations({ ...animations, enableParallax: checked })}
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>Scroll Animation Type</Label>
          <Select
            value={animations.scrollAnimationType}
            onValueChange={(value: any) => setAnimations({ ...animations, scrollAnimationType: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fade">Fade</SelectItem>
              <SelectItem value="slide">Slide</SelectItem>
              <SelectItem value="zoom">Zoom</SelectItem>
              <SelectItem value="bounce">Bounce</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Transition Duration (ms): {animations.transitionDuration}</Label>
          <Slider
            value={[animations.transitionDuration]}
            onValueChange={([value]) => setAnimations({ ...animations, transitionDuration: value })}
            min={0}
            max={1000}
            step={50}
          />
        </div>

        <Button onClick={() => onSave('animations', animations)} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Animations
        </Button>
      </CardContent>
    </Card>
  );
};

// Advanced Tab Component
const AdvancedTab: React.FC<{
  settings: WebsiteSettings;
  onSave: (section: string, data: any) => Promise<void>;
  saving: boolean;
}> = ({ settings, onSave, saving }) => {
  const [customCSS, setCustomCSS] = useState(settings.customCSS);
  const [customJS, setCustomJS] = useState(settings.customJS);
  const [integrations, setIntegrations] = useState(settings.integrations);

  return (
    <div className="space-y-6">
      {/* Custom CSS */}
      <Card>
        <CardHeader>
          <CardTitle>Custom CSS</CardTitle>
          <CardDescription>Add your own custom CSS styles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={customCSS}
            onChange={(e) => setCustomCSS(e.target.value)}
            rows={10}
            className="font-mono text-sm"
            placeholder="/* Your custom CSS here */"
          />
          <Button onClick={() => onSave('customCSS', customCSS)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save CSS
          </Button>
        </CardContent>
      </Card>

      {/* Custom JavaScript */}
      <Card>
        <CardHeader>
          <CardTitle>Custom JavaScript</CardTitle>
          <CardDescription>Add your own custom JavaScript code</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={customJS}
            onChange={(e) => setCustomJS(e.target.value)}
            rows={10}
            className="font-mono text-sm"
            placeholder="// Your custom JavaScript here"
          />
          <Button onClick={() => onSave('customJS', customJS)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save JavaScript
          </Button>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Connect third-party services</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Google Analytics ID</Label>
            <Input
              value={integrations.googleAnalytics}
              onChange={(e) => setIntegrations({ ...integrations, googleAnalytics: e.target.value })}
              placeholder="G-XXXXXXXXXX"
            />
          </div>

          <div className="space-y-2">
            <Label>Google Tag Manager ID</Label>
            <Input
              value={integrations.googleTagManager}
              onChange={(e) => setIntegrations({ ...integrations, googleTagManager: e.target.value })}
              placeholder="GTM-XXXXXXX"
            />
          </div>

          <div className="space-y-2">
            <Label>Facebook Pixel ID</Label>
            <Input
              value={integrations.facebookPixel}
              onChange={(e) => setIntegrations({ ...integrations, facebookPixel: e.target.value })}
              placeholder="XXXXXXXXXXXXXXX"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Label>Enable Cookie Banner</Label>
            <Switch
              checked={integrations.cookieBanner.enabled}
              onCheckedChange={(checked) => setIntegrations({
                ...integrations,
                cookieBanner: { ...integrations.cookieBanner, enabled: checked }
              })}
            />
          </div>

          <Button onClick={() => onSave('integrations', integrations)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Integrations
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

// Pages Management Component
const PagesTab: React.FC<{
  settings: WebsiteSettings;
  onRefresh: () => void;
  navigate: any;
}> = ({ settings, onRefresh, navigate }) => {
  const { toast } = useToast();
  const [pages, setPages] = useState(settings.pages || []);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageSlug, setNewPageSlug] = useState('');
  const [templates, setTemplates] = useState<PageTemplate[]>([]);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedPageForTemplate, setSelectedPageForTemplate] = useState<string | null>(null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await getPageTemplates();
        setTemplates(response.templates);
      } catch (error: any) {
        console.error('Error loading templates:', error);
      }
    };
    loadTemplates();
  }, []);

  const handleAddPage = async () => {
    if (!newPageTitle.trim() || !newPageSlug.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please provide both title and slug'
      });
      return;
    }

    try {
      await addPage({
        title: newPageTitle.trim(),
        slug: newPageSlug.trim(),
        isPublished: false,
        showInNavigation: true
      });
      setNewPageTitle('');
      setNewPageSlug('');
      onRefresh();
      toast({
        title: 'Success',
        description: 'Page added successfully'
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message
      });
    }
  };

  const handleDeletePage = async (pageId: string) => {
    try {
      await deletePage(pageId);
      onRefresh();
      toast({
        title: 'Success',
        description: 'Page deleted successfully'
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message
      });
    }
  };

  const handleTogglePublish = async (page: Page) => {
    try {
      await updatePage(page._id, { isPublished: !page.isPublished });
      onRefresh();
      toast({
        title: 'Success',
        description: `Page ${!page.isPublished ? 'published' : 'unpublished'} successfully`
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message
      });
    }
  };

  const handleApplyTemplate = async (templateId: string) => {
    if (!selectedPageForTemplate) return;

    try {
      setApplyingTemplate(true);
      await applyTemplate(selectedPageForTemplate, templateId);
      setShowTemplateDialog(false);
      setSelectedPageForTemplate(null);
      toast({
        title: 'Success',
        description: 'Template applied successfully! You can now edit the page visually.'
      });
      // Navigate to visual builder to see the applied template
      navigate(`/admin/visual-builder/${selectedPageForTemplate}`);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to apply template'
      });
    } finally {
      setApplyingTemplate(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add New Page */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Page</CardTitle>
          <CardDescription>Create a new page for your website</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Page Title</Label>
              <Input
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                placeholder="About Us"
              />
            </div>

            <div className="space-y-2">
              <Label>URL Slug</Label>
              <Input
                value={newPageSlug}
                onChange={(e) => setNewPageSlug(e.target.value)}
                placeholder="about-us"
              />
            </div>
          </div>

          <Button onClick={handleAddPage}>
            <Plus className="h-4 w-4 mr-2" />
            Add Page
          </Button>
        </CardContent>
      </Card>

      {/* Pages List */}
      <Card>
        <CardHeader>
          <CardTitle>Pages ({pages.length})</CardTitle>
          <CardDescription>Manage your website pages</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {pages.map((page) => (
                <div
                  key={page._id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent"
                >
                  <div className="flex items-center gap-4">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                    <div>
                      <p className="font-medium">{page.title}</p>
                      <p className="text-sm text-muted-foreground">/{page.slug}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {page.isPublished && <Badge variant="default">Published</Badge>}
                    {!page.isPublished && <Badge variant="secondary">Draft</Badge>}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTogglePublish(page)}
                    >
                      {page.isPublished ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedPageForTemplate(page._id);
                        setShowTemplateDialog(true);
                      }}
                    >
                      <Wand2 className="h-4 w-4 mr-1" />
                      Apply Template
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => navigate(`/admin/visual-builder/${page._id}`)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit Visually
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeletePage(page._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {pages.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No pages yet. Add your first page above.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Template Selection Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choose a Template</DialogTitle>
            <DialogDescription>
              Select a pre-designed template to apply to your page. This will replace any existing content.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer hover:border-primary transition-all"
                onClick={() => handleApplyTemplate(template.id)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <Badge variant="outline" className="w-fit">{template.category}</Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded p-4 flex items-center justify-center h-32">
                    <div className="text-center">
                      <FileText className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">{template.name}</p>
                    </div>
                  </div>
                  <Button className="w-full mt-4" size="sm" disabled={applyingTemplate}>
                    {applyingTemplate ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Apply Template
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {templates.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>No templates available</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WebsiteBuilder;
