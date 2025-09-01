import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/useToast"
import {
  Globe,
  Layout,
  Image,
  Type,
  Save,
  Eye,
  Plus,
  Edit,
  Trash2,
  GripVertical,
  Monitor,
  Tablet,
  Smartphone,
  Palette,
  Settings,
  Code,
  TestTube,
  Copy,
  Star,
  X
} from "lucide-react"
import {
  getHomepageSections,
  getContentBlockTemplates,
  getLayoutTemplates,
  saveHomepageSections,
  getABTests,
  createABTest,
  createLayoutTemplate,
  updateLayoutTemplate,
  deleteLayoutTemplate,
  setDefaultTemplate,
  type HomepageSection,
  type ContentBlock,
  type LayoutTemplate,
  type ABTest
} from "@/api/homepage"

// Helper function to generate MongoDB-compatible ObjectId
const generateObjectId = () => {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0')
  const randomBytes = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join('').substring(0, 16)
  return timestamp + randomBytes
}

// Preview Component
const HomepagePreview = ({ sections, previewMode, onClose }: {
  sections: HomepageSection[],
  previewMode: 'desktop' | 'tablet' | 'mobile',
  onClose: () => void
}) => {
  const getPreviewContainerClass = () => {
    switch (previewMode) {
      case 'mobile': return 'max-w-sm mx-auto'
      case 'tablet': return 'max-w-2xl mx-auto'
      default: return 'w-full'
    }
  }

  const renderContentBlock = (block: ContentBlock) => {
    const blockStyle = {
      backgroundColor: block.settings.backgroundColor || '#ffffff',
      color: block.settings.textColor || '#000000',
      padding: block.settings.padding || '20px',
      margin: block.settings.margin || '0px',
      textAlign: block.settings.alignment || 'left' as any
    }

    switch (block.type) {
      case 'hero':
        return (
          <div style={blockStyle} className="hero-block">
            <div className="container mx-auto px-4">
              <h1 className="text-4xl font-bold mb-4">
                {block.content.heading || 'Your Heading Here'}
              </h1>
              <p className="text-xl mb-6">
                {block.content.subheading || 'Your subheading text'}
              </p>
              <button className="bg-blue-600 text-white px-6 py-3 rounded-lg">
                {block.content.ctaText || 'Call to Action'}
              </button>
            </div>
          </div>
        )

      case 'services':
        return (
          <div style={blockStyle} className="services-block">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl font-bold mb-4">
                {block.content.heading || 'Our Services'}
              </h2>
              <p className="text-lg mb-8">
                {block.content.description || 'Professional services for all your needs'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold mb-2">Service {i}</h3>
                    <p className="text-gray-600">Professional service description</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      case 'testimonials':
        return (
          <div style={blockStyle} className="testimonials-block">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl font-bold mb-8">
                {block.content.heading || 'What Our Customers Say'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white p-6 rounded-lg shadow-md">
                    <p className="text-gray-600 mb-4">"Great service and professional staff!"</p>
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-300 rounded-full mr-3"></div>
                      <div>
                        <h4 className="font-semibold">Customer {i}</h4>
                        <p className="text-sm text-gray-500">Verified Customer</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      case 'cta':
        return (
          <div style={blockStyle} className="cta-block">
            <div className="container mx-auto px-4 text-center">
              <h2 className="text-3xl font-bold mb-4">
                {block.content.heading || 'Ready to Get Started?'}
              </h2>
              <p className="text-lg mb-6">
                {block.content.description || 'Contact us today for professional services'}
              </p>
              <button className="bg-white text-green-600 px-8 py-3 rounded-lg font-semibold">
                {block.content.ctaText || 'Get Quote'}
              </button>
            </div>
          </div>
        )

      case 'html':
        return (
          <div
            style={blockStyle}
            className="html-block"
            dangerouslySetInnerHTML={{ __html: block.content.html || '<div>Custom HTML Content</div>' }}
          />
        )

      default:
        return (
          <div style={blockStyle} className="default-block">
            <div className="container mx-auto px-4">
              <h3 className="text-xl font-semibold">{block.title}</h3>
              <p className="text-gray-600">Content block preview</p>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full h-full max-w-7xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Homepage Preview</h2>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{previewMode}</Badge>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          <div className={getPreviewContainerClass()}>
            <div className="bg-white min-h-full shadow-lg">
              {sections
                .filter(section => section.isActive)
                .sort((a, b) => a.order - b.order)
                .map((section) => (
                  <div key={section._id} className="section">
                    {section.blocks
                      .filter(block => block.isVisible)
                      .sort((a, b) => a.order - b.order)
                      .map((block) => (
                        <div key={block._id}>
                          {renderContentBlock(block)}
                        </div>
                      ))}
                  </div>
                ))}

              {sections.length === 0 && (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center text-gray-500">
                    <Layout className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No sections to preview</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function HomepageManagement() {
  const [sections, setSections] = useState<HomepageSection[]>([])
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([])
  const [templates, setTemplates] = useState<LayoutTemplate[]>([])
  const [abTests, setABTests] = useState<ABTest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [showPreview, setShowPreview] = useState(false)
  const [selectedSection, setSelectedSection] = useState<HomepageSection | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<ContentBlock | null>(null)
  const [showBlockDialog, setShowBlockDialog] = useState(false)
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [showABTestDialog, setShowABTestDialog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<LayoutTemplate | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [sectionsResponse, blocksResponse, templatesResponse, testsResponse] = await Promise.all([
        getHomepageSections(),
        getContentBlockTemplates(),
        getLayoutTemplates(),
        getABTests()
      ])

      setSections(sectionsResponse.sections || [])
      setContentBlocks(blocksResponse.blocks || [])
      setTemplates(templatesResponse.templates || [])
      setABTests(testsResponse.tests || [])
    } catch (error) {
      console.error('Error fetching homepage data:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load homepage data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await saveHomepageSections(sections)
      toast({
        title: "Success",
        description: "Homepage sections saved successfully"
      })
    } catch (error) {
      console.error('Error saving sections:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save sections",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = () => {
    setShowPreview(true)
  }

  const addSection = () => {
    const newSection: HomepageSection = {
      _id: generateObjectId(),
      name: `New Section ${sections.length + 1}`,
      blocks: [],
      layout: 'single',
      order: sections.length,
      isActive: true
    }
    setSections([...sections, newSection])
  }

  const updateSection = (sectionId: string, updates: Partial<HomepageSection>) => {
    setSections(sections.map(section =>
      section._id === sectionId ? { ...section, ...updates } : section
    ))
  }

  const deleteSection = (sectionId: string) => {
    setSections(sections.filter(section => section._id !== sectionId))
  }

  const addBlockToSection = (sectionId: string, blockTemplate: ContentBlock) => {
    const newBlock: ContentBlock = {
      ...blockTemplate,
      _id: generateObjectId(),
      order: 0
    }

    setSections(sections.map(section => {
      if (section._id === sectionId) {
        return {
          ...section,
          blocks: [...section.blocks, newBlock]
        }
      }
      return section
    }))
    setShowBlockDialog(false)
  }

  const updateBlock = (sectionId: string, blockId: string, updates: Partial<ContentBlock>) => {
    setSections(sections.map(section => {
      if (section._id === sectionId) {
        return {
          ...section,
          blocks: section.blocks.map(block =>
            block._id === blockId ? { ...block, ...updates } : block
          )
        }
      }
      return section
    }))
  }

  const deleteBlock = (sectionId: string, blockId: string) => {
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

  const handleCreateTemplate = async (templateData: Partial<LayoutTemplate>) => {
    try {
      const response = await createLayoutTemplate({
        ...templateData,
        sections: sections
      })
      toast({
        title: "Success",
        description: "Template created successfully"
      })
      fetchData()
      setShowTemplateDialog(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create template",
        variant: "destructive"
      })
    }
  }

  const handleSetDefaultTemplate = async (templateId: string) => {
    try {
      await setDefaultTemplate(templateId)
      toast({
        title: "Success",
        description: "Default template updated successfully"
      })
      fetchData()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to set default template",
        variant: "destructive"
      })
    }
  }

  const getPreviewWidth = () => {
    switch (previewMode) {
      case 'tablet': return 'max-w-2xl'
      case 'mobile': return 'max-w-sm'
      default: return 'max-w-full'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading homepage data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Globe className="h-8 w-8" />
            Homepage Management
          </h1>
          <p className="text-muted-foreground">
            Design and customize your homepage with drag-and-drop sections
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded-lg p-1">
            <Button
              variant={previewMode === 'desktop' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPreviewMode('desktop')}
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              variant={previewMode === 'tablet' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPreviewMode('tablet')}
            >
              <Tablet className="h-4 w-4" />
            </Button>
            <Button
              variant={previewMode === 'mobile' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPreviewMode('mobile')}
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" onClick={handlePreview}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="sections" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sections">Section Builder</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="ab-tests">A/B Tests</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="sections" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-4">
            {/* Content Blocks Library */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layout className="h-5 w-5" />
                  Content Blocks
                </CardTitle>
                <CardDescription>Drag blocks to add them to sections</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {contentBlocks.map((block) => (
                  <div
                    key={block._id}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => {
                      setSelectedBlock(block)
                      setShowBlockDialog(true)
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-sm">{block.title}</div>
                        <Badge variant="outline" className="text-xs">
                          {block.type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Section Builder */}
            <div className="lg:col-span-3 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Homepage Sections</h3>
                <Button onClick={addSection}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Section
                </Button>
              </div>

              <div className={`mx-auto transition-all duration-300 ${getPreviewWidth()}`}>
                {sections.length === 0 ? (
                  <Card className="p-12 text-center">
                    <div className="text-muted-foreground">
                      <Layout className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">No sections yet</h3>
                      <p className="mb-4">Start building your homepage by adding sections</p>
                      <Button onClick={addSection}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Section
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {sections.map((section) => (
                      <Card key={section._id} className="border-2 border-dashed">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                              <Input
                                value={section.name}
                                onChange={(e) => updateSection(section._id, { name: e.target.value })}
                                className="font-medium border-none p-0 h-auto focus-visible:ring-0"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Select
                                value={section.layout}
                                onValueChange={(value) => updateSection(section._id, { layout: value as any })}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="single">Single</SelectItem>
                                  <SelectItem value="two-column">Two Column</SelectItem>
                                  <SelectItem value="three-column">Three Column</SelectItem>
                                  <SelectItem value="grid">Grid</SelectItem>
                                </SelectContent>
                              </Select>
                              <Switch
                                checked={section.isActive}
                                onCheckedChange={(checked) => updateSection(section._id, { isActive: checked })}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteSection(section._id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {section.blocks.length === 0 ? (
                            <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                              <Type className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-muted-foreground mb-4">No content blocks in this section</p>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setSelectedSection(section)
                                  setShowBlockDialog(true)
                                }}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Block
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {section.blocks.map((block) => (
                                <div
                                  key={block._id}
                                  className="border rounded-lg p-4 bg-background"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                                      <Badge variant="outline">{block.type}</Badge>
                                      <span className="font-medium">{block.title}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedBlock(block)
                                          setSelectedSection(section)
                                        }}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => deleteBlock(section._id, block._id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {block.type === 'hero' && block.content.heading && (
                                      <div>Hero: {block.content.heading}</div>
                                    )}
                                    {block.type === 'services' && block.content.heading && (
                                      <div>Services: {block.content.heading}</div>
                                    )}
                                    {block.type === 'html' && block.content.html && (
                                      <div>Custom HTML Block</div>
                                    )}
                                  </div>
                                </div>
                              ))}
                              <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => {
                                  setSelectedSection(section)
                                  setShowBlockDialog(true)
                                }}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Block
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Layout Templates</h3>
            <Button onClick={() => setShowTemplateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template._id} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {template.name}
                      {template.isDefault && (
                        <Badge variant="default">
                          <Star className="h-3 w-3 mr-1" />
                          Default
                        </Badge>
                      )}
                    </CardTitle>
                  </div>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                      <Layout className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="flex gap-2">
                      {!template.isDefault && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDefaultTemplate(template._id)}
                        >
                          Set Default
                        </Button>
                      )}
                      <Button variant="outline" size="sm">
                        <Copy className="h-4 w-4 mr-1" />
                        Clone
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ab-tests" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">A/B Tests</h3>
            <Button onClick={() => setShowABTestDialog(true)}>
              <TestTube className="h-4 w-4 mr-2" />
              Create A/B Test
            </Button>
          </div>

          <div className="grid gap-6">
            {abTests.map((test) => (
              <Card key={test._id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{test.name}</CardTitle>
                    <Badge variant={test.status === 'running' ? 'default' : 'secondary'}>
                      {test.status}
                    </Badge>
                  </div>
                  <CardDescription>{test.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {test.variants.map((variant) => (
                      <div key={variant._id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{variant.name}</h4>
                          <Badge variant="outline">{variant.trafficPercentage}%</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{variant.description}</p>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <div className="text-muted-foreground">Views</div>
                            <div className="font-medium">{variant.views}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Conversions</div>
                            <div className="font-medium">{variant.conversions}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Rate</div>
                            <div className="font-medium">{variant.conversionRate}%</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Global Settings
              </CardTitle>
              <CardDescription>Configure global homepage settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Color Scheme</Label>
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded bg-blue-500 border-2 border-primary"></div>
                  <div className="w-8 h-8 rounded bg-purple-500 border"></div>
                  <div className="w-8 h-8 rounded bg-green-500 border"></div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Typography</Label>
                <Select defaultValue="inter">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inter">Inter</SelectItem>
                    <SelectItem value="roboto">Roboto</SelectItem>
                    <SelectItem value="lato">Lato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      {showPreview && (
        <HomepagePreview
          sections={sections}
          previewMode={previewMode}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Block Dialog */}
      {showBlockDialog && (
        <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Content Block</DialogTitle>
              <DialogDescription>Select a block to add to this section.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {contentBlocks.map((block) => (
                <Button
                  key={block._id}
                  className="w-full flex justify-between"
                  onClick={() => {
                    if (selectedSection) {
                      addBlockToSection(selectedSection._id, block)
                    }
                  }}
                >
                  <span>{block.title}</span>
                  <Badge variant="outline">{block.type}</Badge>
                </Button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBlockDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Template Dialog */}
      {showTemplateDialog && (
        <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Template</DialogTitle>
              <DialogDescription>Save the current homepage layout as a template.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={e => {
                e.preventDefault()
                const form = e.target as typeof e.target & {
                  name: { value: string }
                  description: { value: string }
                }
                handleCreateTemplate({
                  name: form.name.value,
                  description: form.description.value
                })
              }}
              className="space-y-4"
            >
              <Label>
                Name
                <Input name="name" required />
              </Label>
              <Label>
                Description
                <Textarea name="description" />
              </Label>
              <DialogFooter>
                <Button type="submit">Create</Button>
                <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* AB Test Dialog */}
      {showABTestDialog && (
        <Dialog open={showABTestDialog} onOpenChange={setShowABTestDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create A/B Test</DialogTitle>
              <DialogDescription>
                Configure variants and start an A/B test for the homepage.
              </DialogDescription>
            </DialogHeader>
            {/* Basic AB Test Form Example */}
            <form
              onSubmit={e => {
                e.preventDefault()
                // Implement AB test creation logic here.
                setShowABTestDialog(false)
              }}
              className="space-y-4"
            >
              <Label>
                Test Name
                <Input name="testName" required />
              </Label>
              <Label>
                Description
                <Textarea name="testDescription" />
              </Label>
              {/* Variants and other controls here */}
              <DialogFooter>
                <Button type="submit">Create Test</Button>
                <Button variant="outline" onClick={() => setShowABTestDialog(false)}>
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}