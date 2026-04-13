import { useState, useEffect, useMemo } from "react"
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/useToast"
import {
  Save, Eye, Plus, Edit, Trash2, Settings, Code, Wand2, Layers, Sparkles, Monitor, Tablet, Smartphone,
  Palette, Type, AlignLeft, AlignCenter, AlignRight, Copy, RotateCcw, ZoomIn, Image as ImageIcon, Layout, Zap,
  Maximize2, Grid, Columns, BarChart3, Clock, Timer
} from "lucide-react"
import {
  getHomepageSections,
  getContentBlockTemplates,
  getLayoutTemplates,
  saveHomepageSections,
  getABTests,
  getCurrentHomepageStructure,
  initializeCurrentHomepage,
  getDefaultHomepageSections,
  type HomepageSection,
  type ContentBlock,
  type LayoutTemplate,
  type ABTest
} from "@/api/homepage"
import HomepagePreview from "@/components/admin/HomepagePreview"
import "@/styles/HomepageManagement.css"

// Design Color Presets - McRepair Brand
const MCREPAIR_PRESETS = {
  colors: {
    primary: '#1a2a5e',
    primaryLight: '#2a3f7e',
    accent: '#f5b800',
    white: '#ffffff',
    gray: '#f8f9fc',
    darkGray: '#2d3748',
  },
  fonts: {
    main: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  }
}

// Section Design Presets
const DESIGN_PRESETS = [
  {
    name: 'Default Light',
    backgroundColor: '#ffffff',
    textColor: '#2d3748',
    padding: '60px 0',
  },
  {
    name: 'Dark Section',
    backgroundColor: '#1a2a5e',
    textColor: '#ffffff',
    padding: '60px 0',
  },
  {
    name: 'Accent Section',
    backgroundColor: '#f5b800',
    textColor: '#1a2a5e',
    padding: '60px 0',
  },
  {
    name: 'Light Gray',
    backgroundColor: '#f8f9fc',
    textColor: '#2d3748',
    padding: '40px 0',
  },
]

const DesignPresetsPanel = ({
  onSelect,
}: {
  onSelect: (preset: any) => void
}) => {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold flex items-center gap-2">
        <Palette className="h-4 w-4" />
        Design Presets
      </Label>
      <div className="grid grid-cols-2 gap-2">
        {DESIGN_PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => onSelect(preset)}
            className="p-3 rounded-lg border-2 border-transparent hover:border-primary transition-colors text-left group"
          >
            <div
              className="h-12 rounded mb-2 border"
              style={{ backgroundColor: preset.backgroundColor }}
            ></div>
            <div className="text-xs font-medium group-hover:text-primary">{preset.name}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

const BlockTypeIcon = ({ type }: { type: string }) => {
  const icons: { [key: string]: React.ReactNode } = {
    hero: <Layers className="h-4 w-4" />,
    about: <Type className="h-4 w-4" />,
    services: <Code className="h-4 w-4" />,
    blog: <Type className="h-4 w-4" />,
    shop: <Code className="h-4 w-4" />,
    contact: <Code className="h-4 w-4" />,
    footer: <Layers className="h-4 w-4" />,
    testimonials: <Type className="h-4 w-4" />,
    cta: <Sparkles className="h-4 w-4" />,
    gallery: <ImageIcon className="h-4 w-4" />,
    banner: <Layout className="h-4 w-4" />,
    features: <Zap className="h-4 w-4" />,
    stats: <Code className="h-4 w-4" />,
    html: <Code className="h-4 w-4" />,
    default: <Sparkles className="h-4 w-4" />,
  }
  return icons[type] || icons.default
}

const BlockEditorDialog = ({
  block,
  isOpen,
  onClose,
  onSave
}: {
  block: ContentBlock | null
  isOpen: boolean
  onClose: () => void
  onSave: (blockId: string, updates: Partial<ContentBlock>) => void
}) => {
  const [editingBlock, setEditingBlock] = useState<ContentBlock | null>(null)

  useEffect(() => {
    if (block) {
      setEditingBlock({ ...block })
    }
  }, [block])

  if (!editingBlock) return null

  const handleSave = () => {
    onSave(editingBlock._id, editingBlock)
    onClose()
    toast({
      title: "Success",
      description: "Block updated successfully"
    })
  }

  const updateContent = (field: string, value: any) => {
    setEditingBlock(prev => ({
      ...prev!,
      content: { ...prev!.content, [field]: value }
    }))
  }

  const updateSettings = (field: string, value: any) => {
    setEditingBlock(prev => ({
      ...prev!,
      settings: { ...prev!.settings, [field]: value }
    }))
  }

  const updateField = (field: string, value: any) => {
    setEditingBlock(prev => ({
      ...prev!,
      [field]: value
    }))
  }

  const normalizeCssInput = (value: string) => value

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Block: {editingBlock.title}
          </DialogTitle>
          <DialogDescription>
            Customize content, styling, and design for this block
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="content" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="design">Design</TabsTrigger>
            <TabsTrigger value="animation">Animation</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-4">
            <div>
              <Label>Block Title</Label>
              <Input
                value={editingBlock.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Block title"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={editingBlock.isVisible}
                onCheckedChange={(checked) => updateField('isVisible', checked)}
              />
              <Label>Visible on Homepage</Label>
            </div>

            {editingBlock.type === 'hero' && (
              <div className="space-y-4">
                <div>
                  <Label>Main Heading</Label>
                  <Input
                    value={editingBlock.content?.heading || ''}
                    onChange={(e) => updateContent('heading', e.target.value)}
                    placeholder="Enter hero heading"
                  />
                </div>
                <div>
                  <Label>Subheading</Label>
                  <Textarea
                    value={editingBlock.content?.subheading || ''}
                    onChange={(e) => updateContent('subheading', e.target.value)}
                    placeholder="Enter subheading"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Primary Button Text</Label>
                    <Input
                      value={editingBlock.content?.ctaText || ''}
                      onChange={(e) => updateContent('ctaText', e.target.value)}
                      placeholder="e.g., Get Started"
                    />
                  </div>
                  <div>
                    <Label>Button Link</Label>
                    <Input
                      value={editingBlock.content?.ctaLink || ''}
                      onChange={(e) => updateContent('ctaLink', e.target.value)}
                      placeholder="/register"
                    />
                  </div>
                </div>
              </div>
            )}

            {editingBlock.type === 'about' && (
              <div className="space-y-4">
                <div>
                  <Label>Heading</Label>
                  <Input
                    value={editingBlock.content?.heading || ''}
                    onChange={(e) => updateContent('heading', e.target.value)}
                    placeholder="About heading"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={editingBlock.content?.description || ''}
                    onChange={(e) => updateContent('description', e.target.value)}
                    placeholder="About section description"
                    rows={3}
                  />
                </div>
              </div>
            )}

            {editingBlock.type === 'services' && (
              <div className="space-y-4">
                <div>
                  <Label>Section Heading</Label>
                  <Input
                    value={editingBlock.content?.heading || ''}
                    onChange={(e) => updateContent('heading', e.target.value)}
                    placeholder="Services heading"
                  />
                </div>
                <div>
                  <Label>Section Description</Label>
                  <Textarea
                    value={editingBlock.content?.description || ''}
                    onChange={(e) => updateContent('description', e.target.value)}
                    placeholder="Services description"
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Display Type</Label>
                  <Select
                    value={editingBlock.content?.displayType || 'dynamic'}
                    onValueChange={(value) => updateContent('displayType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dynamic">Dynamic (from Database)</SelectItem>
                      <SelectItem value="static">Static (Predefined)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Number of Services to Show</Label>
                  <Input
                    type="number"
                    value={editingBlock.content?.maxItems || 6}
                    onChange={(e) => updateContent('maxItems', parseInt(e.target.value))}
                    min="1"
                    max="12"
                  />
                </div>
              </div>
            )}

            {editingBlock.type === 'blog' && (
              <div className="space-y-4">
                <div>
                  <Label>Section Heading</Label>
                  <Input
                    value={editingBlock.content?.heading || ''}
                    onChange={(e) => updateContent('heading', e.target.value)}
                    placeholder="Blog section heading"
                  />
                </div>
                <div>
                  <Label>Number of Posts to Show</Label>
                  <Input
                    type="number"
                    value={editingBlock.content?.maxItems || 3}
                    onChange={(e) => updateContent('maxItems', parseInt(e.target.value))}
                    min="1"
                    max="12"
                  />
                </div>
              </div>
            )}

            {editingBlock.type === 'shop' && (
              <div className="space-y-4">
                <div>
                  <Label>Section Heading</Label>
                  <Input
                    value={editingBlock.content?.heading || ''}
                    onChange={(e) => updateContent('heading', e.target.value)}
                    placeholder="Shop section heading"
                  />
                </div>
                <div>
                  <Label>Section Description</Label>
                  <Textarea
                    value={editingBlock.content?.description || ''}
                    onChange={(e) => updateContent('description', e.target.value)}
                    placeholder="Shop section description"
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Number of Products to Show</Label>
                  <Input
                    type="number"
                    value={editingBlock.content?.maxItems || 6}
                    onChange={(e) => updateContent('maxItems', parseInt(e.target.value))}
                    min="1"
                    max="20"
                  />
                </div>
                <div>
                  <Label>Product Category Filter</Label>
                  <Select
                    value={editingBlock.content?.category || 'all'}
                    onValueChange={(value) => updateContent('category', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Products</SelectItem>
                      <SelectItem value="featured">Featured</SelectItem>
                      <SelectItem value="new">New Arrivals</SelectItem>
                      <SelectItem value="sale">On Sale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {editingBlock.type === 'contact' && (
              <div className="space-y-4">
                <div>
                  <Label>Section Heading</Label>
                  <Input
                    value={editingBlock.content?.heading || ''}
                    onChange={(e) => updateContent('heading', e.target.value)}
                    placeholder="Contact section heading"
                  />
                </div>
                <div>
                  <Label>Section Description</Label>
                  <Textarea
                    value={editingBlock.content?.description || ''}
                    onChange={(e) => updateContent('description', e.target.value)}
                    placeholder="Contact section description"
                    rows={2}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={editingBlock.content?.showContactForm || true}
                    onCheckedChange={(checked) => updateContent('showContactForm', checked)}
                  />
                  <Label>Show Contact Form</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={editingBlock.content?.showContactInfo || true}
                    onCheckedChange={(checked) => updateContent('showContactInfo', checked)}
                  />
                  <Label>Show Contact Information</Label>
                </div>
              </div>
            )}

            {editingBlock.type === 'footer' && (
              <div className="space-y-4">
                <div>
                  <Label>Company Name</Label>
                  <Input
                    value={editingBlock.content?.companyName || ''}
                    onChange={(e) => updateContent('companyName', e.target.value)}
                    placeholder="Company name"
                  />
                </div>
                <div>
                  <Label>Tagline</Label>
                  <Input
                    value={editingBlock.content?.tagline || ''}
                    onChange={(e) => updateContent('tagline', e.target.value)}
                    placeholder="Company tagline"
                  />
                </div>
                <div>
                  <Label>Copyright Text</Label>
                  <Input
                    value={editingBlock.content?.copyright || ''}
                    onChange={(e) => updateContent('copyright', e.target.value)}
                    placeholder="© 2024 Company. All rights reserved."
                  />
                </div>
              </div>
            )}

            {editingBlock.type === 'testimonials' && (
              <div className="space-y-4">
                <div>
                  <Label>Section Heading</Label>
                  <Input
                    value={editingBlock.content?.heading || ''}
                    onChange={(e) => updateContent('heading', e.target.value)}
                    placeholder="Testimonials heading"
                  />
                </div>
                <div>
                  <Label>Section Description</Label>
                  <Textarea
                    value={editingBlock.content?.description || ''}
                    onChange={(e) => updateContent('description', e.target.value)}
                    placeholder="Testimonials description"
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Number of Testimonials to Show</Label>
                  <Input
                    type="number"
                    value={editingBlock.content?.maxItems || 4}
                    onChange={(e) => updateContent('maxItems', parseInt(e.target.value))}
                    min="1"
                    max="12"
                  />
                </div>
              </div>
            )}

            {editingBlock.type === 'cta' && (
              <div className="space-y-4">
                <div>
                  <Label>Heading</Label>
                  <Input
                    value={editingBlock.content?.heading || ''}
                    onChange={(e) => updateContent('heading', e.target.value)}
                    placeholder="Call-to-Action heading"
                  />
                </div>
                <div>
                  <Label>Description/Subtitle</Label>
                  <Textarea
                    value={editingBlock.content?.description || ''}
                    onChange={(e) => updateContent('description', e.target.value)}
                    placeholder="Additional description"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Button Text</Label>
                    <Input
                      value={editingBlock.content?.buttonText || ''}
                      onChange={(e) => updateContent('buttonText', e.target.value)}
                      placeholder="e.g., Get Started"
                    />
                  </div>
                  <div>
                    <Label>Button Link</Label>
                    <Input
                      value={editingBlock.content?.buttonLink || ''}
                      onChange={(e) => updateContent('buttonLink', e.target.value)}
                      placeholder="/register"
                    />
                  </div>
                </div>
              </div>
            )}

            {editingBlock.type === 'gallery' && (
              <div className="space-y-4">
                <div>
                  <Label>Gallery Title</Label>
                  <Input
                    value={editingBlock.content?.title || ''}
                    onChange={(e) => updateContent('title', e.target.value)}
                    placeholder="Gallery title"
                  />
                </div>
                <div>
                  <Label>Gallery Description</Label>
                  <Textarea
                    value={editingBlock.content?.description || ''}
                    onChange={(e) => updateContent('description', e.target.value)}
                    placeholder="Gallery description"
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Number of Items to Display</Label>
                  <Input
                    type="number"
                    value={editingBlock.content?.maxItems || 8}
                    onChange={(e) => updateContent('maxItems', parseInt(e.target.value))}
                    min="1"
                    max="20"
                  />
                </div>
                <div>
                  <Label>Layout Style</Label>
                  <Select
                    value={editingBlock.content?.layoutStyle || 'grid'}
                    onValueChange={(value) => updateContent('layoutStyle', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grid">Grid</SelectItem>
                      <SelectItem value="carousel">Carousel</SelectItem>
                      <SelectItem value="masonry">Masonry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {editingBlock.type === 'banner' && (
              <div className="space-y-4">
                <div>
                  <Label>Banner Content</Label>
                  <Input
                    value={editingBlock.content?.text || ''}
                    onChange={(e) => updateContent('text', e.target.value)}
                    placeholder="Banner text"
                  />
                </div>
                <div>
                  <Label>Banner Type</Label>
                  <Select
                    value={editingBlock.content?.bannerType || 'info'}
                    onValueChange={(value) => updateContent('bannerType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="promotion">Promotion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {editingBlock.type === 'features' && (
              <div className="space-y-4">
                <div>
                  <Label>Section Heading</Label>
                  <Input
                    value={editingBlock.content?.heading || ''}
                    onChange={(e) => updateContent('heading', e.target.value)}
                    placeholder="Features heading"
                  />
                </div>
                <div>
                  <Label>Section Description</Label>
                  <Textarea
                    value={editingBlock.content?.description || ''}
                    onChange={(e) => updateContent('description', e.target.value)}
                    placeholder="Features description"
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Number of Features</Label>
                  <Input
                    type="number"
                    value={editingBlock.content?.maxItems || 6}
                    onChange={(e) => updateContent('maxItems', parseInt(e.target.value))}
                    min="1"
                    max="12"
                  />
                </div>
                <div>
                  <Label>Display Style</Label>
                  <Select
                    value={editingBlock.content?.displayStyle || 'cards'}
                    onValueChange={(value) => updateContent('displayStyle', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cards">Cards</SelectItem>
                      <SelectItem value="list">List</SelectItem>
                      <SelectItem value="icons">Icons</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {editingBlock.type === 'stats' && (
              <div className="space-y-4">
                <div>
                  <Label>Section Heading</Label>
                  <Input
                    value={editingBlock.content?.heading || ''}
                    onChange={(e) => updateContent('heading', e.target.value)}
                    placeholder="Statistics heading"
                  />
                </div>
                <div>
                  <Label>Number of Stats to Display</Label>
                  <Input
                    type="number"
                    value={editingBlock.content?.maxItems || 4}
                    onChange={(e) => updateContent('maxItems', parseInt(e.target.value))}
                    min="1"
                    max="8"
                  />
                </div>
              </div>
            )}

            {editingBlock.type === 'html' && (
              <div className="space-y-4">
                <div>
                  <Label>Custom HTML</Label>
                  <Textarea
                    value={editingBlock.content?.html || ''}
                    onChange={(e) => updateContent('html', e.target.value)}
                    placeholder="Enter your HTML content here..."
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <Label>Custom CSS (for this block)</Label>
                  <Textarea
                    value={editingBlock.settings?.customCSS || ''}
                    onChange={(e) => updateSettings('customCSS', normalizeCssInput(e.target.value))}
                    placeholder={`& { padding: 24px; }\n& h2 { color: #1a2a5e; }\n& .cta { background: #f5b800; }`}
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Note: HTML is rendered directly. Use <span className="font-mono">&amp;</span> in CSS to target this block wrapper.
                </p>
              </div>
            )}

            {editingBlock.type !== 'html' && (
              <div className="space-y-4 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Code className="h-4 w-4" />
                  Optional HTML + CSS Override
                </div>
                <div>
                  <Label>Custom HTML Content</Label>
                  <Textarea
                    value={editingBlock.content?.html || ''}
                    onChange={(e) => updateContent('html', e.target.value)}
                    placeholder="Optional: Add custom HTML for this block"
                    rows={5}
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <Label>Custom CSS (for this block)</Label>
                  <Textarea
                    value={editingBlock.settings?.customCSS || ''}
                    onChange={(e) => updateSettings('customCSS', normalizeCssInput(e.target.value))}
                    placeholder={`& { padding: 24px; }\n& h3 { letter-spacing: .02em; }\n& .badge { border-radius: 999px; }`}
                    rows={5}
                    className="font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Tip: Leave empty to keep default block rendering. CSS supports scoped selectors using <span className="font-mono">&amp;</span>.
                </p>
              </div>
            )}

            {!['hero', 'services', 'testimonials', 'cta', 'gallery', 'banner', 'features', 'stats', 'html', 'about', 'blog', 'shop', 'contact', 'footer'].includes(editingBlock.type) && (
              <div className="space-y-4">
                <div>
                  <Label>Block Content (JSON)</Label>
                  <Textarea
                    value={JSON.stringify(editingBlock.content, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value)
                        setEditingBlock(prev => ({
                          ...prev!,
                          content: parsed
                        }))
                      } catch (error) {
                        // Invalid JSON
                      }
                    }}
                    placeholder="Enter content as JSON"
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            )}
          </TabsContent>

          {/* Design Tab */}
          <TabsContent value="design" className="space-y-4">
            <DesignPresetsPanel
              onSelect={(preset) => {
                updateSettings('backgroundColor', preset.backgroundColor)
                updateSettings('textColor', preset.textColor)
                updateSettings('padding', preset.padding)
                toast({
                  title: "Design Updated",
                  description: `Applied ${preset.name} preset`
                })
              }}
            />

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <Label>Background Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={editingBlock.settings?.backgroundColor || '#ffffff'}
                    onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                    className="h-10 w-20"
                  />
                  <Input
                    type="text"
                    value={editingBlock.settings?.backgroundColor || '#ffffff'}
                    onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <Label>Text Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={editingBlock.settings?.textColor || '#000000'}
                    onChange={(e) => updateSettings('textColor', e.target.value)}
                    className="h-10 w-20"
                  />
                  <Input
                    type="text"
                    value={editingBlock.settings?.textColor || '#000000'}
                    onChange={(e) => updateSettings('textColor', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label>Text Alignment</Label>
              <div className="flex gap-2">
                {[
                  { value: 'left', icon: AlignLeft },
                  { value: 'center', icon: AlignCenter },
                  { value: 'right', icon: AlignRight },
                ].map(({ value, icon: Icon }) => (
                  <Button
                    key={value}
                    variant={editingBlock.settings?.alignment === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateSettings('alignment', value)}
                    className="flex-1"
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Padding</Label>
                <Input
                  value={editingBlock.settings?.padding || '20px 0'}
                  onChange={(e) => updateSettings('padding', e.target.value)}
                  placeholder="e.g., 40px 0"
                />
              </div>
              <div>
                <Label>Margin</Label>
                <Input
                  value={editingBlock.settings?.margin || '0px'}
                  onChange={(e) => updateSettings('margin', e.target.value)}
                  placeholder="e.g., 0px"
                />
              </div>
            </div>
          </TabsContent>

          {/* Layout Tab */}
          <TabsContent value="layout" className="space-y-4">
            <div>
              <Label className="flex items-center gap-2">
                <Columns size={16} />
                Layout Mode
              </Label>
              <Select
                value={editingBlock.settings?.layout || 'single'}
                onValueChange={(value) => updateSettings('layout', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single Column</SelectItem>
                  <SelectItem value="two-column">Two Columns</SelectItem>
                  <SelectItem value="three-column">Three Columns</SelectItem>
                  <SelectItem value="grid">Grid Layout</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">Controls how content inside this block is arranged.</p>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Maximize2 size={16} />
                Max Width (px or %)
              </Label>
              <Input
                value={editingBlock.settings?.maxWidth || '100%'}
                onChange={(e) => updateSettings('maxWidth', e.target.value)}
                placeholder="e.g., 1200px, 100%"
              />
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <BarChart3 size={16} />
                Min Height (px or auto)
              </Label>
              <Input
                value={editingBlock.settings?.minHeight || 'auto'}
                onChange={(e) => updateSettings('minHeight', e.target.value)}
                placeholder="e.g., 400px, auto"
              />
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Grid size={16} />
                Gap Between Items
              </Label>
              <Input
                value={editingBlock.settings?.gap || '24px'}
                onChange={(e) => updateSettings('gap', e.target.value)}
                placeholder="e.g., 24px"
              />
            </div>
          </TabsContent>

          {/* Animation Tab */}
          <TabsContent value="animation" className="space-y-4">
            <div>
              <Label className="flex items-center gap-2">
                <Zap size={16} />
                Animation Effect
              </Label>
              <Select
                value={editingBlock.settings?.animation || 'none'}
                onValueChange={(value) => updateSettings('animation', value === 'none' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="fadeInUp">Fade In Up</SelectItem>
                  <SelectItem value="fadeIn">Fade In</SelectItem>
                  <SelectItem value="slideInLeft">Slide In Left</SelectItem>
                  <SelectItem value="slideInRight">Slide In Right</SelectItem>
                  <SelectItem value="scaleIn">Scale In</SelectItem>
                  <SelectItem value="pulse">Pulse</SelectItem>
                  <SelectItem value="bounce">Bounce</SelectItem>
                  <SelectItem value="wiggle">Wiggle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Clock size={16} />
                Duration (seconds)
              </Label>
              <Input
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={editingBlock.settings?.animationDuration || 1}
                onChange={(e) => updateSettings('animationDuration', parseFloat(e.target.value))}
                placeholder="Seconds (e.g., 1)"
              />
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Timer size={16} />
                Delay (seconds)
              </Label>
              <Input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={editingBlock.settings?.animationDelay || 0}
                onChange={(e) => updateSettings('animationDelay', parseFloat(e.target.value))}
                placeholder="Seconds (e.g., 0)"
              />
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Zap size={16} />
                Hover Effects
              </Label>
              <div className="space-y-2 rounded-lg border bg-muted/50 p-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={!!editingBlock.settings?.hover?.enabled}
                    onCheckedChange={(checked) =>
                      updateSettings('hover', {
                        ...editingBlock.settings?.hover,
                        enabled: checked,
                      })
                    }
                  />
                  <Label className="text-sm">Enable Hover Effects</Label>
                </div>

                {editingBlock.settings?.hover?.enabled && (
                  <>
                    <div>
                      <Label className="text-xs">Hover Transform</Label>
                      <Input
                        value={editingBlock.settings?.hover?.transform || 'scale(1.05)'}
                        onChange={(e) =>
                          updateSettings('hover', {
                            ...editingBlock.settings?.hover,
                            transform: e.target.value,
                          })
                        }
                        placeholder="e.g., scale(1.05), translateY(-5px)"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Hover Opacity</Label>
                      <Input
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={editingBlock.settings?.hover?.opacity || 1}
                        onChange={(e) =>
                          updateSettings('hover', {
                            ...editingBlock.settings?.hover,
                            opacity: parseFloat(e.target.value),
                          })
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Palette size={16} />
                Visual Effects
              </Label>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Blur Effect (px)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="20"
                    step="0.5"
                    value={editingBlock.settings?.visualEffects?.blur || 0}
                    onChange={(e) => updateSettings('visualEffects', { 
                      ...editingBlock.settings?.visualEffects,
                      blur: parseFloat(e.target.value)
                    })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Brightness (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="200"
                    step="10"
                    value={(editingBlock.settings?.visualEffects?.brightness || 1) * 100}
                    onChange={(e) => updateSettings('visualEffects', { 
                      ...editingBlock.settings?.visualEffects,
                      brightness: parseFloat(e.target.value) / 100
                    })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Saturation (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="200"
                    step="10"
                    value={(editingBlock.settings?.visualEffects?.saturate || 1) * 100}
                    onChange={(e) => updateSettings('visualEffects', { 
                      ...editingBlock.settings?.visualEffects,
                      saturate: parseFloat(e.target.value) / 100
                    })}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="space-y-4">
            <div>
              <Label>Border Radius</Label>
              <Input
                value={editingBlock.settings?.borderRadius || '0px'}
                onChange={(e) => updateSettings('borderRadius', e.target.value)}
                placeholder="e.g., 8px"
              />
            </div>
            <div>
              <Label>Border</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Width</Label>
                  <Input
                    value={editingBlock.settings?.borderWidth || '0px'}
                    onChange={(e) => updateSettings('borderWidth', e.target.value)}
                    placeholder="0px"
                  />
                </div>
                <div>
                  <Label className="text-xs">Color</Label>
                  <Input
                    type="color"
                    value={editingBlock.settings?.borderColor || '#000000'}
                    onChange={(e) => updateSettings('borderColor', e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div>
              <Label>Box Shadow</Label>
              <Select
                value={editingBlock.settings?.boxShadow || 'none'}
                onValueChange={(value) => updateSettings('boxShadow', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="0 1px 3px rgba(0,0,0,0.1)">Small</SelectItem>
                  <SelectItem value="0 4px 12px rgba(0,0,0,0.1)">Medium</SelectItem>
                  <SelectItem value="0 8px 30px rgba(0,0,0,0.12)">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Custom CSS (Advanced)</Label>
              <Textarea
                value={editingBlock.settings?.customCSS || ''}
                onChange={(e) => updateSettings('customCSS', normalizeCssInput(e.target.value))}
                placeholder={`& { border: 1px solid #d8dce6; }\n& p { font-size: 15px; }`}
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Scoped to this block. Use <span className="font-mono">&amp;</span> as the block root selector.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-[#1a2a5e] hover:bg-[#0f1d45]">
            <Save className="h-4 w-4 mr-2" />
            Save Block
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const PreviewDeviceModal = ({
  sections,
  title,
  editableSection,
  editableBlock,
  onUpdateSection,
  onUpdateBlock,
  onUpdateBlockInSection,
  isOpen,
  onClose
}: {
  sections: HomepageSection[]
  title?: string
  editableSection?: HomepageSection | null
  editableBlock?: ContentBlock | null
  onUpdateSection?: (updates: { customHTML?: string; customCSS?: string }) => void
  onUpdateBlock?: (blockId: string, updates: Partial<ContentBlock>) => void
  onUpdateBlockInSection?: (sectionId: string, blockId: string, updates: Partial<ContentBlock>) => void
  isOpen: boolean
  onClose: () => void
}) => {
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [selectedSectionBlockId, setSelectedSectionBlockId] = useState<string>('')
  const [liveSections, setLiveSections] = useState<HomepageSection[]>(sections)
  const [realtimeTarget, setRealtimeTarget] = useState<string>('')

  const escapeHtml = (value: any) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

  const buildDefaultBlockHtml = (block?: ContentBlock | null) => {
    if (!block) return ''
    if (typeof block.content?.html === 'string' && block.content.html.trim()) {
      return block.content.html
    }

    const heading = block.content?.heading ? `<h3>${escapeHtml(block.content.heading)}</h3>` : ''
    const subheading = block.content?.subheading ? `<p>${escapeHtml(block.content.subheading)}</p>` : ''
    const description = block.content?.description ? `<p>${escapeHtml(block.content.description)}</p>` : ''
    const text = block.content?.text ? `<p>${escapeHtml(block.content.text)}</p>` : ''
    const cta = block.content?.ctaText || block.content?.buttonText
    const ctaMarkup = cta ? `<button>${escapeHtml(cta)}</button>` : ''
    return `${heading}${subheading}${description}${text}${ctaMarkup}`
  }

  const toCssDeclarations = (settings: any = {}) => {
    const entries: Array<[string, any]> = [
      ['background-color', settings.backgroundColor],
      ['color', settings.textColor],
      ['padding', settings.padding],
      ['margin', settings.margin],
      ['text-align', settings.alignment],
      ['min-height', settings.minHeight],
      ['max-width', settings.maxWidth],
      ['gap', settings.gap],
      ['opacity', settings.opacity],
      ['border-radius', settings.borderRadius],
      ['border-width', settings.borderWidth],
      ['border-color', settings.borderColor],
      ['border-style', settings.borderStyle],
      ['box-shadow', settings.boxShadow],
      ['transform', settings.transform],
      ['transition', settings.transition],
      ['overflow', settings.overflow],
      ['filter', settings.filter],
      ['backdrop-filter', settings.backdropFilter],
    ]

    return entries
      .filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== 'none')
      .map(([key, value]) => `  ${key}: ${value};`)
      .join('\n')
  }

  const blockCandidates = editableSection?.blocks?.filter((block) => block.isVisible !== false) || []

  const realtimeBlocks = useMemo(() => {
    const result: Array<{ value: string; label: string; sectionId: string; blockId: string }> = []
    liveSections.forEach((section) => {
      section.blocks
        .filter((block) => block.isVisible !== false)
        .forEach((block) => {
          result.push({
            value: `${section._id}:${block._id}`,
            label: `${section.name} / ${block.title}`,
            sectionId: section._id,
            blockId: block._id
          })
        })
    })
    return result
  }, [liveSections])

  useEffect(() => {
    if (isOpen) {
      setLiveSections(sections)
    }
  }, [sections, isOpen])

  useEffect(() => {
    if (editableBlock?._id) {
      setSelectedSectionBlockId(editableBlock._id)
      return
    }

    if (!selectedSectionBlockId && blockCandidates.length > 0) {
      setSelectedSectionBlockId(blockCandidates[0]._id)
    }
  }, [editableBlock, editableSection?._id, blockCandidates, selectedSectionBlockId])

  useEffect(() => {
    if (!realtimeTarget && realtimeBlocks.length > 0) {
      setRealtimeTarget(realtimeBlocks[0].value)
    }
  }, [realtimeBlocks, realtimeTarget])

  const activeBlock = editableBlock || blockCandidates.find((block) => block._id === selectedSectionBlockId) || blockCandidates[0] || null

  const realtimeActiveBlock = useMemo(() => {
    if (!realtimeTarget) return null
    const [sectionId, blockId] = realtimeTarget.split(':')
    const section = liveSections.find((item) => item._id === sectionId)
    const block = section?.blocks.find((item) => item._id === blockId)
    if (!section || !block) return null
    return { section, block }
  }, [realtimeTarget, liveSections])

  const updateRealtimeHtml = (value: string) => {
    if (!realtimeTarget) return
    const [sectionId, blockId] = realtimeTarget.split(':')

    setLiveSections(prev => prev.map((section) => {
      if (section._id !== sectionId) return section
      return {
        ...section,
        blocks: section.blocks.map((block) =>
          block._id === blockId
            ? { ...block, content: { ...block.content, html: value } }
            : block
        )
      }
    }))

    onUpdateBlockInSection?.(sectionId, blockId, {
      content: {
        ...(realtimeActiveBlock?.block.content || {}),
        html: value
      }
    })
  }

  const sectionHtmlDefault = editableSection
    ? `<section class="section ${editableSection.layout || 'single'}">\n  <div class="section-inner">\n${editableSection.blocks
      .filter((block) => block.isVisible !== false)
      .map((block) => `    <div class="block block-${block.type}">\n      ${buildDefaultBlockHtml(block)}\n    </div>`)
      .join('\n')}\n  </div>\n</section>`
    : ''

  const sectionCssDefault = editableSection
    ? `.section {\n${toCssDeclarations(editableSection.settings)}\n}\n\n.section-inner {\n  display: grid;\n  gap: ${editableSection.settings?.gap || '16px'};\n}`
    : ''

  const blockCssDefault = activeBlock
    ? `.block {\n${toCssDeclarations(activeBlock.settings)}\n}`
    : ''

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="h-[96vh] w-[98vw] max-w-[98vw] p-0 overflow-hidden flex flex-col">
        <div className="bg-[#1a2a5e] text-white p-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-semibold text-lg">{title || 'Homepage Live Preview'}</h2>
            <p className="text-sm text-gray-200">See your homepage with real design and components</p>
          </div>
          <div className="flex gap-2">
            {[
              { label: 'Desktop', icon: Monitor, value: 'desktop' as const },
              { label: 'Tablet', icon: Tablet, value: 'tablet' as const },
              { label: 'Mobile', icon: Smartphone, value: 'mobile' as const },
            ].map(({ label, icon: Icon, value }) => (
              <Button
                key={value}
                variant={previewMode === value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPreviewMode(value)}
                className={previewMode === value ? 'bg-[#f5b800] text-[#1a2a5e]' : ''}
              >
                <Icon className="h-4 w-4 mr-2" />
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-6 lg:px-8">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,1fr)] gap-4 items-start">
            <div className="flex items-start justify-center">
              <HomepagePreview
                sections={liveSections}
                device={previewMode}
                highlightedBlockId={realtimeActiveBlock?.block._id}
              />
            </div>

            {(editableSection || editableBlock) && (
              <Card className="max-h-[78vh] overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Default Rendering Code
                  </CardTitle>
                  <CardDescription>
                    Bearbeite hier Section- und Block-Rendering direkt im Livevorschau-Dialog.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 overflow-y-auto max-h-[66vh]">
                  <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Zap className="h-4 w-4" />
                      Realtime HTML Editor
                    </div>

                    <div>
                      <Label>Aktueller Block</Label>
                      <Select value={realtimeTarget} onValueChange={setRealtimeTarget}>
                        <SelectTrigger>
                          <SelectValue placeholder="Block auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {realtimeBlocks.map((entry) => (
                            <SelectItem key={entry.value} value={entry.value}>{entry.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>HTML (live)</Label>
                      <Textarea
                        value={realtimeActiveBlock?.block.content?.html || buildDefaultBlockHtml(realtimeActiveBlock?.block)}
                        onChange={(e) => updateRealtimeHtml(e.target.value)}
                        rows={10}
                        className="font-mono text-xs"
                        placeholder="Bearbeite den aktuellen HTML-Inhalt. Die Vorschau wird direkt aktualisiert."
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Änderungen werden sofort in der Livevorschau gerendert.
                      </p>
                    </div>
                  </div>

                  <Tabs defaultValue="section" className="space-y-3">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="section">Section</TabsTrigger>
                      <TabsTrigger value="block">Block</TabsTrigger>
                    </TabsList>

                    <TabsContent value="section" className="space-y-3">
                      <div>
                        <Label>Section HTML</Label>
                        <Textarea
                          value={editableSection?.settings?.customHTML || sectionHtmlDefault}
                          onChange={(e) => onUpdateSection?.({ customHTML: e.target.value })}
                          rows={8}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div>
                        <Label>Section CSS</Label>
                        <Textarea
                          value={editableSection?.settings?.customCSS || sectionCssDefault}
                          onChange={(e) => onUpdateSection?.({ customCSS: e.target.value })}
                          rows={8}
                          className="font-mono text-xs"
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="block" className="space-y-3">
                      {!editableBlock && blockCandidates.length > 1 && (
                        <div>
                          <Label>Block auswählen</Label>
                          <Select value={selectedSectionBlockId} onValueChange={setSelectedSectionBlockId}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {blockCandidates.map((block) => (
                                <SelectItem key={block._id} value={block._id}>{block.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div>
                        <Label>Block HTML</Label>
                        <Textarea
                          value={activeBlock?.content?.html || buildDefaultBlockHtml(activeBlock)}
                          onChange={(e) => activeBlock && onUpdateBlock?.(activeBlock._id, {
                            content: { ...activeBlock.content, html: e.target.value }
                          })}
                          rows={8}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div>
                        <Label>Block CSS</Label>
                        <Textarea
                          value={activeBlock?.settings?.customCSS || blockCssDefault}
                          onChange={(e) => activeBlock && onUpdateBlock?.(activeBlock._id, {
                            settings: { ...activeBlock.settings, customCSS: e.target.value }
                          })}
                          rows={8}
                          className="font-mono text-xs"
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="bg-gray-100 border-t p-4 flex justify-end gap-2 flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Close Preview
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function HomepageManagement() {
  const { t } = useTranslation()
  const [sections, setSections] = useState<HomepageSection[]>([])
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBlock, setSelectedBlock] = useState<ContentBlock | null>(null)
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewSections, setPreviewSections] = useState<HomepageSection[]>([])
  const [previewTitle, setPreviewTitle] = useState('')
  const [previewSectionId, setPreviewSectionId] = useState<string | null>(null)
  const [previewBlockId, setPreviewBlockId] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [selectedEditorTarget, setSelectedEditorTarget] = useState<string>('')
  const [editorTab, setEditorTab] = useState<'html' | 'css'>('html')

  const safeCssClass = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_')

  const escapeHtml = (value: any) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

  const toCssDeclarations = (settings: any = {}) => {
    const entries: Array<[string, any]> = [
      ['background-color', settings.backgroundColor],
      ['color', settings.textColor],
      ['padding', settings.padding],
      ['margin', settings.margin],
      ['text-align', settings.alignment],
      ['min-height', settings.minHeight],
      ['max-width', settings.maxWidth],
      ['gap', settings.gap],
      ['opacity', settings.opacity],
      ['border-radius', settings.borderRadius],
      ['border-width', settings.borderWidth],
      ['border-color', settings.borderColor],
      ['border-style', settings.borderStyle],
      ['box-shadow', settings.boxShadow],
      ['transform', settings.transform],
      ['transition', settings.transition],
      ['overflow', settings.overflow],
      ['filter', settings.filter],
      ['backdrop-filter', settings.backdropFilter],
    ]

    return entries
      .filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== 'none')
      .map(([key, value]) => `  ${key}: ${value};`)
      .join('\n')
  }

  const buildBlockMarkup = (block: ContentBlock) => {
    if (typeof block.content?.html === 'string' && block.content.html.trim()) {
      return block.content.html
    }

    const heading = block.content?.heading ? `<h3>${escapeHtml(block.content.heading)}</h3>` : ''
    const subheading = block.content?.subheading ? `<p>${escapeHtml(block.content.subheading)}</p>` : ''
    const description = block.content?.description ? `<p>${escapeHtml(block.content.description)}</p>` : ''
    const text = block.content?.text ? `<p>${escapeHtml(block.content.text)}</p>` : ''
    const cta = block.content?.ctaText || block.content?.buttonText
    const ctaMarkup = cta ? `<button>${escapeHtml(cta)}</button>` : ''
    return `${heading}${subheading}${description}${text}${ctaMarkup}`
  }

  const homepageHtmlSnapshot = useMemo(() => {
    return sections
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((section) => {
        const sectionClass = `hp-section-${safeCssClass(String(section._id || section.name || 'section'))}`
        const visibleBlocks = section.blocks.filter((block) => block.isVisible !== false)
        const blocksMarkup = visibleBlocks
          .map((block) => {
            const blockClass = `hp-block-${safeCssClass(String(block._id || block.type || 'block'))}`
            return `  <div class="${blockClass}">\n    ${buildBlockMarkup(block)}\n  </div>`
          })
          .join('\n')

        return `<section class="${sectionClass}">\n${blocksMarkup}\n</section>`
      })
      .join('\n\n')
  }, [sections])

  const homepageCssSnapshot = useMemo(() => {
    return sections
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((section) => {
        const sectionClass = `.hp-section-${safeCssClass(String(section._id || section.name || 'section'))}`
        const sectionDeclarations = toCssDeclarations(section.settings)
        const sectionCustomCss = section.settings?.customCSS
          ? section.settings.customCSS.includes('&')
            ? section.settings.customCSS.replace(/&/g, sectionClass)
            : `${sectionClass} {\n${section.settings.customCSS}\n}`
          : ''

        const blockCss = section.blocks
          .filter((block) => block.isVisible !== false)
          .map((block) => {
            const blockClass = `.hp-block-${safeCssClass(String(block._id || block.type || 'block'))}`
            const blockDeclarations = toCssDeclarations(block.settings)
            const blockCustomCss = block.settings?.customCSS
              ? block.settings.customCSS.includes('&')
                ? block.settings.customCSS.replace(/&/g, blockClass)
                : `${blockClass} {\n${block.settings.customCSS}\n}`
              : ''

            return `${blockDeclarations ? `${blockClass} {\n${blockDeclarations}\n}` : ''}${blockCustomCss ? `\n${blockCustomCss}` : ''}`
          })
          .filter(Boolean)
          .join('\n\n')

        return `${sectionDeclarations ? `${sectionClass} {\n${sectionDeclarations}\n}` : ''}${sectionCustomCss ? `\n${sectionCustomCss}` : ''}${blockCss ? `\n\n${blockCss}` : ''}`
      })
      .filter(Boolean)
      .join('\n\n')
  }, [sections])

  const editorTargets = useMemo(() => {
    const targets: Array<{ value: string; label: string; type: 'section' | 'block' }> = []

    sections.forEach((section) => {
      targets.push({
        value: `section:${section._id}`,
        label: `Section: ${section.name}`,
        type: 'section'
      })

      section.blocks.forEach((block) => {
        targets.push({
          value: `block:${section._id}:${block._id}`,
          label: `Block: ${section.name} / ${block.title}`,
          type: 'block'
        })
      })
    })

    return targets
  }, [sections])

  useEffect(() => {
    if (!selectedEditorTarget && editorTargets.length > 0) {
      setSelectedEditorTarget(editorTargets[0].value)
    }
  }, [editorTargets, selectedEditorTarget])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Try to load current homepage structure first (actual layout from database)
      let currentSections: HomepageSection[] = []
      try {
        const currentRes = await getCurrentHomepageStructure()
        if (currentRes.sections && currentRes.sections.length > 0) {
          currentSections = currentRes.sections
        } else {
          // If no structure exists, initialize with defaults
          const defaultSections = getDefaultHomepageSections()
          const initRes = await initializeCurrentHomepage(defaultSections)
          currentSections = initRes.sections || defaultSections
        }
      } catch (error) {
        console.warn('Could not load current homepage structure, using defaults:', error)
        // Fallback to defaults if API fails
        const defaultSections = getDefaultHomepageSections()
        currentSections = defaultSections
      }
      
      // Load content block templates in parallel
      const blocksRes = await getContentBlockTemplates()
      
      setSections(currentSections)
      setContentBlocks(blocksRes.blocks || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      
      // Last resort fallback - use default sections
      setSections(getDefaultHomepageSections())
      
      toast({
        title: "Info",
        description: "Using default homepage structure. Server configuration will be saved automatically.",
        variant: "default"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveChanges = async () => {
    try {
      const cleanedSections = sections.map(section => {
        const cleanedSection = { ...section }
        if (typeof cleanedSection._id === 'string' && cleanedSection._id.startsWith('section_')) {
          delete cleanedSection._id
        }
        cleanedSection.blocks = section.blocks.map(block => {
          const cleanedBlock = { ...block }
          if (typeof cleanedBlock._id === 'string' && cleanedBlock._id.startsWith('block_')) {
            delete cleanedBlock._id
          }
          return cleanedBlock
        })
        return cleanedSection
      })

      await saveHomepageSections(cleanedSections)
      
      // Also update localStorage for preview
      localStorage.setItem('hp_sections', JSON.stringify(cleanedSections))
      toast({
        title: t('common.success'),
        description: t('homepageManagement.sectionUpdated')
      })
      await fetchData()
    } catch (error) {
      console.error('Error saving:', error)
      toast({
        title: t('common.error'),
        description: t('homepageManagement.failedToUpdateSection'),
        variant: "destructive"
      })
    }
  }

  const addSection = () => {
    const newSection: HomepageSection = {
      _id: `section_${Date.now()}`,
      name: `New Section ${sections.length + 1}`,
      blocks: [],
      layout: 'single',
      order: sections.length,
      isActive: true,
      settings: {
        backgroundColor: '#ffffff',
        padding: '60px 0',
        margin: '0px'
      }
    }
    setSections([...sections, newSection])
    toast({
      title: t('homepageManagement.sectionCreatedSuccess'),
      description: newSection.name
    })
  }

  const addBlockToSection = (sectionId: string, blockId: string) => {
    const template = contentBlocks.find(b => b._id === blockId)
    if (!template) return

    setSections(sections.map(section => {
      if (section._id === sectionId) {
        return {
          ...section,
          blocks: [...section.blocks, { ...template, _id: `block_${Date.now()}` }]
        }
      }
      return section
    }))
    toast({
      title: t('common.success'),
      description: template.title
    })
  }

  const updateBlock = (blockId: string, updates: Partial<ContentBlock>) => {
    setSections(sections.map(section => ({
      ...section,
      blocks: section.blocks.map(block =>
        block._id === blockId ? { ...block, ...updates } : block
      )
    })))
  }

  const updateSection = (sectionId: string, updates: Partial<HomepageSection>) => {
    setSections(prev => prev.map(section => (
      section._id === sectionId ? { ...section, ...updates } : section
    )))
  }

  const updateSectionSettings = (sectionId: string, updates: Partial<HomepageSection['settings']>) => {
    setSections(prev => prev.map(section => {
      if (section._id !== sectionId) return section
      return {
        ...section,
        settings: {
          ...(section.settings || {}),
          ...updates,
        }
      }
    }))
  }

  const removeBlock = (sectionId: string, blockId: string) => {
    setSections(sections.map(section => {
      if (section._id === sectionId) {
        return {
          ...section,
          blocks: section.blocks.filter(block => block._id !== blockId)
        }
      }
      return section
    }))
  }

  const removeSection = (sectionId: string) => {
    setSections(sections.filter(section => section._id !== sectionId))
  }

  const updateEditorHtml = (value: string) => {
    if (!selectedEditorTarget) return
    const [targetType, sectionId, blockId] = selectedEditorTarget.split(':')

    if (targetType === 'block' && sectionId && blockId) {
      setSections(prev => prev.map(section => {
        if (section._id !== sectionId) return section
        return {
          ...section,
          blocks: section.blocks.map(block =>
            block._id === blockId
              ? {
                  ...block,
                  content: { ...block.content, html: value }
                }
              : block
          )
        }
      }))
    }
  }

  const updateEditorCss = (value: string) => {
    if (!selectedEditorTarget) return
    const [targetType, sectionId, blockId] = selectedEditorTarget.split(':')

    if (targetType === 'section' && sectionId) {
      updateSectionSettings(sectionId, { customCSS: value })
      return
    }

    if (targetType === 'block' && sectionId && blockId) {
      setSections(prev => prev.map(section => {
        if (section._id !== sectionId) return section
        return {
          ...section,
          blocks: section.blocks.map(block =>
            block._id === blockId
              ? {
                  ...block,
                  settings: { ...block.settings, customCSS: value }
                }
              : block
          )
        }
      }))
    }
  }

  const selectedTarget = useMemo(() => {
    if (!selectedEditorTarget) return null
    const [targetType, sectionId, blockId] = selectedEditorTarget.split(':')

    if (targetType === 'section') {
      const section = sections.find(s => s._id === sectionId)
      if (!section) return null
      return {
        type: 'section' as const,
        section,
        html: section.blocks.filter(b => b.isVisible !== false).map(buildBlockMarkup).join('\n\n'),
        css: section.settings?.customCSS || ''
      }
    }

    if (targetType === 'block') {
      const section = sections.find(s => s._id === sectionId)
      const block = section?.blocks.find(b => b._id === blockId)
      if (!section || !block) return null
      return {
        type: 'block' as const,
        section,
        block,
        html: block.content?.html || '',
        css: block.settings?.customCSS || ''
      }
    }

    return null
  }, [selectedEditorTarget, sections])

  const duplicateSection = (sectionId: string) => {
    const section = sections.find(s => s._id === sectionId)
    if (!section) return

    const newSection: HomepageSection = {
      ...section,
      _id: `section_${Date.now()}`,
      name: `${section.name} (Copy)`,
      blocks: section.blocks.map(b => ({ ...b, _id: `block_${Date.now()}` }))
    }
    setSections([...sections, newSection])
  }

  const openFullPreview = () => {
    setPreviewSections(sections)
    setPreviewTitle(t('homepageManagement.livePreview'))
    setPreviewSectionId(null)
    setPreviewBlockId(null)
    setIsPreviewOpen(true)
  }

  const openSectionPreview = (section: HomepageSection) => {
    setPreviewSections([section])
    setPreviewTitle(`${t('homepageManagement.livePreview')}: ${section.name}`)
    setPreviewSectionId(section._id)
    setPreviewBlockId(null)
    setIsPreviewOpen(true)
  }

  const openBlockPreview = (section: HomepageSection, block: ContentBlock) => {
    const previewSection: HomepageSection = {
      _id: `preview_section_${section._id}_${block._id}`,
      name: `Block Preview ${block.title}`,
      blocks: [{ ...block }],
      layout: section.layout,
      order: 0,
      isActive: true,
      settings: {
        ...(section.settings || {}),
      }
    }

    setPreviewSections([previewSection])
    setPreviewTitle(`${t('homepageManagement.livePreview')}: ${block.title}`)
    setPreviewSectionId(section._id)
    setPreviewBlockId(block._id)
    setIsPreviewOpen(true)
  }

  const previewEditableSection = useMemo(() => {
    if (!previewSectionId) return null
    return sections.find((section) => section._id === previewSectionId) || null
  }, [previewSectionId, sections])

  const previewEditableBlock = useMemo(() => {
    if (!previewSectionId || !previewBlockId) return null
    const section = sections.find((s) => s._id === previewSectionId)
    return section?.blocks.find((b) => b._id === previewBlockId) || null
  }, [previewSectionId, previewBlockId, sections])

  const handlePreviewSectionUpdate = (updates: { customHTML?: string; customCSS?: string }) => {
    if (!previewSectionId) return
    updateSectionSettings(previewSectionId, updates)
    const updated = sections.find((section) => section._id === previewSectionId)
    if (updated) {
      setPreviewSections([{ ...updated, settings: { ...(updated.settings || {}), ...updates } }])
    }
  }

  const handlePreviewBlockUpdate = (blockId: string, updates: Partial<ContentBlock>) => {
    if (!previewSectionId) return

    setSections(prev => prev.map(section => {
      if (section._id !== previewSectionId) return section
      return {
        ...section,
        blocks: section.blocks.map(block =>
          block._id === blockId ? { ...block, ...updates } : block
        )
      }
    }))

    if (previewSectionId) {
      setPreviewSections(prev => prev.map(section => {
        if (section._id !== previewSectionId && !String(section._id).startsWith('preview_section_')) return section
        return {
          ...section,
          blocks: section.blocks.map(block =>
            block._id === blockId ? { ...block, ...updates } : block
          )
        }
      }))
    }
  }

  const handleRealtimeBlockUpdate = (sectionId: string, blockId: string, updates: Partial<ContentBlock>) => {
    setSections(prev => prev.map(section => {
      if (section._id !== sectionId) return section
      return {
        ...section,
        blocks: section.blocks.map(block =>
          block._id === blockId ? { ...block, ...updates } : block
        )
      }
    }))

    setPreviewSections(prev => prev.map(section => {
      if (section._id !== sectionId && !String(section._id).startsWith('preview_section_')) return section
      return {
        ...section,
        blocks: section.blocks.map(block =>
          block._id === blockId ? { ...block, ...updates } : block
        )
      }
    }))
  }

  if (loading) {
    return (
      <div className="hp-loading-container">
        <div className="hp-loading">
          <div className="hp-spinner"></div>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="hp-container">
      {/* Header */}
      <div className="hp-header">
        <div>
          <h1 className="hp-title">{t('homepageManagement.title')}</h1>
          <p className="hp-subtitle">
            {t('homepageManagement.description')}
          </p>
        </div>
        <div className="hp-header-actions">
          <Button
            variant="outline"
            onClick={openFullPreview}
            className="hp-btn-preview"
          >
            <Eye className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">{t('homepageManagement.preview')}</span>
          </Button>
          <Button
            onClick={handleSaveChanges}
            className="hp-btn-save"
          >
            <Save className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">{t('common.save')}</span>
          </Button>
        </div>
      </div>

      <div className="hp-content-grid">
        {/* Sidebar - Block Library */}
        <aside className="hp-sidebar">
          <div className="hp-sidebar-card">
            <div className="hp-sidebar-header">
              <Layers className="h-5 w-5" />
              <h2>{t('homepageManagement.contentBlocks')}</h2>
            </div>
            <p className="hp-sidebar-subtitle">
              Click to add blocks to sections
            </p>
            <div className="hp-block-library">
              {contentBlocks.map((block) => (
                <button
                  key={block._id}
                  className="hp-block-card"
                  onClick={() => {
                    if (sections.length === 0) addSection()
                    const section = sections[0] || { _id: `section_${Date.now()}` }
                    addBlockToSection(section._id, block._id)
                  }}
                >
                  <div className="hp-block-icon">
                    <BlockTypeIcon type={block.type} />
                  </div>
                  <div className="hp-block-info">
                    <div className="hp-block-title">{block.title}</div>
                    <div className="hp-block-type">{block.type}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content - Sections */}
        <main className="hp-main">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                HTML/CSS Content Editor
              </CardTitle>
              <CardDescription>
                Bearbeite den aktuellen Homepage-Content als HTML und CSS. Snapshot zeigt den aktuellen Stand, darunter bearbeitest du gezielt Sektionen und Blöcke.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <Label>Aktueller Homepage HTML Snapshot</Label>
                  <Textarea
                    value={homepageHtmlSnapshot}
                    readOnly
                    rows={10}
                    className="font-mono text-xs"
                  />
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await navigator.clipboard.writeText(homepageHtmlSnapshot)
                        toast({ title: 'Kopiert', description: 'Homepage HTML wurde in die Zwischenablage kopiert.' })
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      HTML kopieren
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Aktueller Homepage CSS Snapshot</Label>
                  <Textarea
                    value={homepageCssSnapshot}
                    readOnly
                    rows={10}
                    className="font-mono text-xs"
                  />
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await navigator.clipboard.writeText(homepageCssSnapshot)
                        toast({ title: 'Kopiert', description: 'Homepage CSS wurde in die Zwischenablage kopiert.' })
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      CSS kopieren
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2">
                  <Label>Ziel für Bearbeitung</Label>
                  <Select value={selectedEditorTarget} onValueChange={setSelectedEditorTarget}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ziel auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {editorTargets.map((target) => (
                        <SelectItem key={target.value} value={target.value}>{target.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={editorTab === 'html' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setEditorTab('html')}
                  >
                    HTML
                  </Button>
                  <Button
                    variant={editorTab === 'css' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setEditorTab('css')}
                  >
                    CSS
                  </Button>
                </div>
              </div>

              {selectedTarget && editorTab === 'html' && (
                <div>
                  <Label>
                    {selectedTarget.type === 'block'
                      ? `HTML für Block: ${selectedTarget.block.title}`
                      : `HTML-Vorschau für Sektion: ${selectedTarget.section.name}`}
                  </Label>
                  <Textarea
                    value={selectedTarget.html}
                    onChange={(e) => {
                      if (selectedTarget.type === 'block') {
                        updateEditorHtml(e.target.value)
                      }
                    }}
                    readOnly={selectedTarget.type !== 'block'}
                    rows={10}
                    className="font-mono text-sm"
                    placeholder={selectedTarget.type === 'block' ? 'Füge HTML für diesen Block ein' : ''}
                  />
                  {selectedTarget.type !== 'block' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Für direktes HTML-Editing bitte einen Block als Ziel auswählen.
                    </p>
                  )}
                </div>
              )}

              {selectedTarget && editorTab === 'css' && (
                <div>
                  <Label>
                    {selectedTarget.type === 'block'
                      ? `Custom CSS für Block: ${selectedTarget.block.title}`
                      : `Custom CSS für Sektion: ${selectedTarget.section.name}`}
                  </Label>
                  <Textarea
                    value={selectedTarget.css}
                    onChange={(e) => updateEditorCss(e.target.value)}
                    rows={10}
                    className="font-mono text-sm"
                    placeholder={`& { padding: 24px; }\n& h2 { color: #1a2a5e; }`}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Verwende <span className="font-mono">&amp;</span> als Root-Selector für den ausgewählten Bereich.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="hp-sections-header">
            <h2 className="hp-section-title">{t('homepageManagement.sections')}</h2>
            <Button
              onClick={addSection}
              className="hp-btn-add-section"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('homepageManagement.createNewSection')}
            </Button>
          </div>

          {sections.length === 0 ? (
            <Card className="hp-empty-state">
              <CardContent className="hp-empty-state-content">
                <Layers className="hp-empty-icon" />
                <h3>{t('homepageManagement.noSectionsFound')}</h3>
                <p>{t('homepageManagement.description')}</p>
                <Button onClick={addSection} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('homepageManagement.createNewSection')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="hp-sections-list">
              {sections
                .sort((a, b) => a.order - b.order)
                .map((section) => (
                  <Card key={section._id} className="hp-section-card">
                    <div
                      className="hp-section-header-bar"
                      onClick={() => setExpandedSection(
                        expandedSection === section._id ? null : section._id
                      )}
                      style={{
                        backgroundColor: section.settings?.backgroundColor || '#ffffff'
                      }}
                    >
                      <div className="hp-section-header-info">
                        <div className="hp-section-name">{section.name}</div>
                        <div className="hp-section-meta">
                          {section.blocks.length} Block{section.blocks.length !== 1 ? 's' : ''} • {section.layout}
                        </div>
                      </div>
                      <div className="hp-section-badges">
                        <Badge variant={section.isActive ? "default" : "secondary"}>
                          {section.isActive ? t('common.activate') : t('common.deactivate')}
                        </Badge>
                      </div>
                    </div>

                    {expandedSection === section._id && (
                      <CardContent className="hp-section-content">
                        <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 mb-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>{t('homepageManagement.sectionTitle')}</Label>
                              <Input
                                value={section.name}
                                onChange={(e) => updateSection(section._id, { name: e.target.value })}
                                placeholder="Section name"
                              />
                            </div>
                            <div>
                              <Label>Layout</Label>
                              <Select
                                value={section.layout}
                                onValueChange={(value) => updateSection(section._id, { layout: value as HomepageSection['layout'] })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="single">Single Column</SelectItem>
                                  <SelectItem value="two-column">Two Columns</SelectItem>
                                  <SelectItem value="three-column">Three Columns</SelectItem>
                                  <SelectItem value="grid">Grid</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label>Background</Label>
                              <Input
                                type="color"
                                value={section.settings?.backgroundColor || '#ffffff'}
                                onChange={(e) => updateSectionSettings(section._id, { backgroundColor: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>Text Color</Label>
                              <Input
                                type="color"
                                value={section.settings?.textColor || '#2d3748'}
                                onChange={(e) => updateSectionSettings(section._id, { textColor: e.target.value })}
                              />
                            </div>
                            <div className="flex items-end">
                              <div className="flex items-center space-x-2 pb-2">
                                <Switch
                                  checked={section.isActive}
                                  onCheckedChange={(checked) => updateSection(section._id, { isActive: checked })}
                                />
                                <Label>Section Active</Label>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label>Padding</Label>
                              <Input
                                value={section.settings?.padding || '60px 0'}
                                onChange={(e) => updateSectionSettings(section._id, { padding: e.target.value })}
                                placeholder="e.g., 60px 0"
                              />
                            </div>
                            <div>
                              <Label>Margin</Label>
                              <Input
                                value={section.settings?.margin || '0px'}
                                onChange={(e) => updateSectionSettings(section._id, { margin: e.target.value })}
                                placeholder="e.g., 0"
                              />
                            </div>
                            <div>
                              <Label>Gap</Label>
                              <Input
                                value={section.settings?.gap || '16px'}
                                onChange={(e) => updateSectionSettings(section._id, { gap: e.target.value })}
                                placeholder="e.g., 16px"
                              />
                            </div>
                          </div>

                          <div>
                            <Label>Custom Section CSS</Label>
                            <Textarea
                              value={section.settings?.customCSS || ''}
                              onChange={(e) => updateSectionSettings(section._id, { customCSS: e.target.value })}
                              placeholder={`& { border-top: 1px solid #d8dce6; }\n& .container { max-width: 1280px; }`}
                              rows={4}
                              className="font-mono text-sm"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Scoped CSS: use <span className="font-mono">&amp;</span> as the section selector root.
                            </p>
                          </div>
                        </div>

                        {section.blocks.length === 0 ? (
                          <div className="hp-empty-blocks">
                            <p>No blocks in this section</p>
                            <div className="hp-quick-add">
                              {contentBlocks.slice(0, 3).map((block) => (
                                <Button
                                  key={block._id}
                                  size="sm"
                                  variant="outline"
                                  onClick={() => addBlockToSection(section._id, block._id)}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  {block.title}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="hp-blocks-list">
                            {section.blocks.map((block) => (
                              <div key={block._id} className="hp-block-item">
                                <div className="hp-block-item-info">
                                  <div className="hp-block-item-icon">
                                    <BlockTypeIcon type={block.type} />
                                  </div>
                                  <div className="hp-block-item-details">
                                    <div className="hp-block-item-title">{block.title}</div>
                                    <div className="hp-block-item-type">{block.type}</div>
                                  </div>
                                  <Badge variant={block.isVisible ? "default" : "secondary"}>
                                    {block.isVisible ? "Visible" : "Hidden"}
                                  </Badge>
                                </div>
                                <div className="hp-block-item-actions">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openBlockPreview(section, block)}
                                    title="Livevorschau für diesen Block"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedBlock(block)
                                      setIsBlockDialogOpen(true)
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => removeBlock(section._id, block._id)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="hp-section-actions">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openSectionPreview(section)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {t('homepageManagement.livePreview')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => duplicateSection(section._id)}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeSection(section._id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('common.delete')}
                          </Button>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
            </div>
          )}
        </main>
      </div>

      {/* Dialogs */}
      <BlockEditorDialog
        block={selectedBlock}
        isOpen={isBlockDialogOpen}
        onClose={() => {
          setIsBlockDialogOpen(false)
          setSelectedBlock(null)
        }}
        onSave={updateBlock}
      />

      <PreviewDeviceModal
        sections={previewSections.length > 0 ? previewSections : sections}
        title={previewTitle}
        editableSection={previewEditableSection}
        editableBlock={previewEditableBlock}
        onUpdateSection={handlePreviewSectionUpdate}
        onUpdateBlock={handlePreviewBlockUpdate}
        onUpdateBlockInSection={handleRealtimeBlockUpdate}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  )
}
