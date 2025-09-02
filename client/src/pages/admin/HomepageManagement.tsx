import { useState, useEffect } from "react"
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
import { Slider } from "@/components/ui/slider"
import { toast } from "@/hooks/useToast"
import {
  Save, Eye, Plus, Edit, Trash2, Settings, Code, Wand2, Layers, Sparkles, X, Monitor, Tablet, Smartphone
} from "lucide-react"
import {
  getHomepageSections,
  getContentBlockTemplates,
  getLayoutTemplates,
  saveHomepageSections,
  getABTests,
  type HomepageSection,
  type ContentBlock,
  type LayoutTemplate,
  type ABTest
} from "@/api/homepage"

const PreviewDialog = ({
  sections,
  isOpen,
  onClose
}: {
  sections: HomepageSection[]
  isOpen: boolean
  onClose: () => void
}) => {
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')

  const getPreviewStyles = () => {
    switch (previewMode) {
      case 'desktop':
        return 'w-full max-w-6xl mx-auto'
      case 'tablet':
        return 'w-full max-w-2xl mx-auto'
      case 'mobile':
        return 'w-full max-w-sm mx-auto'
      default:
        return 'w-full max-w-6xl mx-auto'
    }
  }

  const renderBlockContent = (block: ContentBlock) => {
    const blockStyles = {
      backgroundColor: block.settings?.backgroundColor || '#ffffff',
      color: block.settings?.textColor || '#000000',
      padding: block.settings?.padding || '20px',
      margin: block.settings?.margin || '0px',
      textAlign: block.settings?.alignment || 'left',
      opacity: block.settings?.opacity || 1,
      borderWidth: block.settings?.borderWidth || '0px',
      borderColor: block.settings?.borderColor || '#000000',
      borderStyle: block.settings?.borderStyle || 'none',
      borderRadius: block.settings?.borderRadius || '0px',
      boxShadow: block.settings?.boxShadow || 'none',
      transform: block.settings?.transform || 'none',
      filter: `blur(${block.settings?.visualEffects?.blur || 0}px) brightness(${block.settings?.visualEffects?.brightness || 1})`,
    } as React.CSSProperties

    switch (block.type) {
      case 'hero':
        return (
          <div style={blockStyles} className="text-center py-20">
            <h1 className="text-4xl font-bold mb-4">
              {block.content?.heading || 'Hero Heading'}
            </h1>
            <p className="text-xl mb-8">
              {block.content?.subheading || 'Hero subheading text'}
            </p>
            <button className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700">
              {block.content?.ctaText || 'Call to Action'}
            </button>
          </div>
        )

      case 'services':
        return (
          <div style={blockStyles} className="py-16">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">
                {block.content?.heading || 'Our Services'}
              </h2>
              <p className="text-lg">
                {block.content?.description || 'Professional services for all your needs'}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="text-center p-6 border rounded-lg">
                  <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <Code className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Service {i}</h3>
                  <p>Service description goes here</p>
                </div>
              ))}
            </div>
          </div>
        )

      case 'testimonials':
        return (
          <div style={blockStyles} className="py-16 bg-gray-50">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">
                {block.content?.heading || 'What Our Customers Say'}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow">
                  <p className="mb-4">"Great service and professional team!"</p>
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gray-300 rounded-full mr-3"></div>
                    <div>
                      <p className="font-semibold">Customer {i}</p>
                      <p className="text-sm text-gray-600">Verified Customer</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      case 'cta':
        return (
          <div style={blockStyles} className="text-center py-16 bg-blue-600 text-white">
            <h2 className="text-3xl font-bold mb-4">
              {block.content?.heading || 'Ready to Get Started?'}
            </h2>
            <p className="text-xl mb-8">
              {block.content?.description || 'Contact us today for professional services'}
            </p>
            <button className="bg-white text-blue-600 px-8 py-3 rounded-lg hover:bg-gray-100">
              {block.content?.ctaText || 'Get Quote'}
            </button>
          </div>
        )

      case 'html':
        return (
          <div
            style={blockStyles}
            dangerouslySetInnerHTML={{ __html: block.content?.html || '<p>Custom HTML content</p>' }}
          />
        )

      default:
        return (
          <div style={blockStyles} className="py-8">
            <h3 className="text-xl font-semibold mb-4">{block.title}</h3>
            <p>Content block of type: {block.type}</p>
          </div>
        )
    }
  }

  const renderSection = (section: HomepageSection) => {
    if (!section.isActive) return null

    const sectionStyles = {
      backgroundColor: section.settings?.backgroundColor || '#ffffff',
      padding: section.settings?.padding || '60px 0',
      margin: section.settings?.margin || '0px',
      opacity: section.settings?.opacity || 1,
      borderWidth: section.settings?.borderWidth || '0px',
      borderColor: section.settings?.borderColor || '#000000',
      borderStyle: section.settings?.borderStyle || 'none',
      borderRadius: section.settings?.borderRadius || '0px',
      boxShadow: section.settings?.boxShadow || 'none',
      filter: `blur(${section.settings?.visualEffects?.blur || 0}px) brightness(${section.settings?.visualEffects?.brightness || 1})`,
    } as React.CSSProperties

    return (
      <section key={section._id} style={sectionStyles}>
        <div className="container mx-auto px-4">
          {section.blocks
            .filter(block => block.isVisible)
            .map(block => (
              <div key={block._id}>
                {renderBlockContent(block)}
              </div>
            ))}
        </div>
      </section>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Homepage Preview</DialogTitle>
              <DialogDescription>
                Preview how your homepage will look on different devices
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={previewMode === 'desktop' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewMode('desktop')}
              >
                <Monitor className="h-4 w-4 mr-1" />
                Desktop
              </Button>
              <Button
                variant={previewMode === 'tablet' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewMode('tablet')}
              >
                <Tablet className="h-4 w-4 mr-1" />
                Tablet
              </Button>
              <Button
                variant={previewMode === 'mobile' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewMode('mobile')}
              >
                <Smartphone className="h-4 w-4 mr-1" />
                Mobile
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-gray-100 p-4 rounded-lg">
          <div className={getPreviewStyles()}>
            <div className="bg-white shadow-lg rounded-lg overflow-hidden">
              {sections.length === 0 ? (
                <div className="text-center py-20">
                  <h2 className="text-2xl font-semibold mb-4">No sections to preview</h2>
                  <p className="text-gray-600">Add some sections to see the preview</p>
                </div>
              ) : (
                sections
                  .sort((a, b) => a.order - b.order)
                  .map(section => renderSection(section))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close Preview
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const AdvancedSettings = ({
  settings,
  onUpdate,
  title = "Advanced Settings"
}: {
  settings: any,
  onUpdate: (field: string, value: any) => void,
  title?: string
}) => {
  const updateVisualEffect = (field: string, value: any) => {
    const visualEffects = settings.visualEffects || {}
    onUpdate('visualEffects', { ...visualEffects, [field]: value })
  }

  const updateHover = (field: string, value: any) => {
    const hover = settings.hover || {}
    onUpdate('hover', { ...hover, [field]: value })
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Wand2 className="h-5 w-5" />
        {title}
      </h3>

      <div>
        <Label className="flex items-center justify-between">
          Opacity
          <span className="text-sm text-muted-foreground">
            {Math.round((settings.opacity || 1) * 100)}%
          </span>
        </Label>
        <Slider
          value={[settings.opacity || 1]}
          onValueChange={([value]) => onUpdate('opacity', value)}
          min={0}
          max={1}
          step={0.01}
          className="mt-2"
        />
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Border</Label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Width</Label>
            <Input
              value={settings.borderWidth || '0px'}
              onChange={(e) => onUpdate('borderWidth', e.target.value)}
              placeholder="e.g., 2px"
            />
          </div>
          <div>
            <Label className="text-xs">Color</Label>
            <Input
              type="color"
              value={settings.borderColor || '#000000'}
              onChange={(e) => onUpdate('borderColor', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Visual Effects
        </Label>

        <div className="space-y-3">
          <div>
            <Label className="flex items-center justify-between text-xs">
              Blur
              <span>{settings.visualEffects?.blur || 0}px</span>
            </Label>
            <Slider
              value={[settings.visualEffects?.blur || 0]}
              onValueChange={([value]) => updateVisualEffect('blur', value)}
              min={0}
              max={20}
              step={0.1}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="flex items-center justify-between text-xs">
              Brightness
              <span>{Math.round((settings.visualEffects?.brightness || 1) * 100)}%</span>
            </Label>
            <Slider
              value={[settings.visualEffects?.brightness || 1]}
              onValueChange={([value]) => updateVisualEffect('brightness', value)}
              min={0}
              max={2}
              step={0.01}
              className="mt-1"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Hover Effects</Label>
        <div className="space-y-3 pl-4 border-l-2 border-muted">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Background Color</Label>
              <Input
                type="color"
                value={settings.hover?.backgroundColor || '#ffffff'}
                onChange={(e) => updateHover('backgroundColor', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Text Color</Label>
              <Input
                type="color"
                value={settings.hover?.textColor || '#000000'}
                onChange={(e) => updateHover('textColor', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const BlockSettingsDialog = ({
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
  }

  const updateBlockContent = (field: string, value: any) => {
    setEditingBlock(prev => ({
      ...prev!,
      content: {
        ...prev!.content,
        [field]: value
      }
    }))
  }

  const updateBlockSettings = (field: string, value: any) => {
    setEditingBlock(prev => ({
      ...prev!,
      settings: {
        ...prev!.settings,
        [field]: value
      }
    }))
  }

  const updateBlockField = (field: string, value: any) => {
    setEditingBlock(prev => ({
      ...prev!,
      [field]: value
    }))
  }

  const renderContentEditor = () => {
    switch (editingBlock.type) {
      case 'hero':
        return (
          <div className="space-y-4">
            <div>
              <Label>Heading</Label>
              <Input
                value={editingBlock.content.heading || ''}
                onChange={(e) => updateBlockContent('heading', e.target.value)}
                placeholder="Enter hero heading"
              />
            </div>
            <div>
              <Label>Subheading</Label>
              <Textarea
                value={editingBlock.content.subheading || ''}
                onChange={(e) => updateBlockContent('subheading', e.target.value)}
                placeholder="Enter hero subheading"
              />
            </div>
            <div>
              <Label>Call to Action Text</Label>
              <Input
                value={editingBlock.content.ctaText || ''}
                onChange={(e) => updateBlockContent('ctaText', e.target.value)}
                placeholder="Enter CTA button text"
              />
            </div>
          </div>
        )

      case 'services':
        return (
          <div className="space-y-4">
            <div>
              <Label>Heading</Label>
              <Input
                value={editingBlock.content.heading || ''}
                onChange={(e) => updateBlockContent('heading', e.target.value)}
                placeholder="Enter services heading"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={editingBlock.content.description || ''}
                onChange={(e) => updateBlockContent('description', e.target.value)}
                placeholder="Enter services description"
              />
            </div>
          </div>
        )

      case 'html':
        return (
          <div className="space-y-4">
            <div>
              <Label>HTML Content</Label>
              <Textarea
                value={editingBlock.content.html || ''}
                onChange={(e) => updateBlockContent('html', e.target.value)}
                placeholder="Enter your HTML content here..."
                className="min-h-[300px] font-mono text-sm"
              />
            </div>
          </div>
        )

      default:
        return (
          <div className="space-y-4">
            <div>
              <Label>Content (JSON)</Label>
              <Textarea
                value={JSON.stringify(editingBlock.content, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value)
                    setEditingBlock(prev => ({ ...prev!, content: parsed }))
                  } catch (error) {
                    // Invalid JSON, don't update
                  }
                }}
                placeholder="Enter content as JSON"
                className="min-h-[200px] font-mono text-sm"
              />
            </div>
          </div>
        )
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Block Content</DialogTitle>
          <DialogDescription>
            Customize the content and styling for this block.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="content" className="space-y-4">
          <TabsList>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="basic">Basic Style</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4">
            <div>
              <Label>Block Title</Label>
              <Input
                value={editingBlock.title}
                onChange={(e) => updateBlockField('title', e.target.value)}
                placeholder="Enter block title"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={editingBlock.isVisible}
                onCheckedChange={(checked) => updateBlockField('isVisible', checked)}
              />
              <Label>Visible</Label>
            </div>

            {renderContentEditor()}
          </TabsContent>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Background Color</Label>
                <Input
                  type="color"
                  value={editingBlock.settings?.backgroundColor || '#ffffff'}
                  onChange={(e) => updateBlockSettings('backgroundColor', e.target.value)}
                />
              </div>
              <div>
                <Label>Text Color</Label>
                <Input
                  type="color"
                  value={editingBlock.settings?.textColor || '#000000'}
                  onChange={(e) => updateBlockSettings('textColor', e.target.value)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <AdvancedSettings
              settings={editingBlock.settings || {}}
              onUpdate={updateBlockSettings}
              title="Block Advanced Settings"
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const SectionSettingsDialog = ({
  section,
  isOpen,
  onClose,
  onSave
}: {
  section: HomepageSection | null
  isOpen: boolean
  onClose: () => void
  onSave: (sectionId: string, updates: Partial<HomepageSection>) => void
}) => {
  const [editingSection, setEditingSection] = useState<HomepageSection | null>(null)

  useEffect(() => {
    if (section) {
      setEditingSection({
        ...section,
        settings: section.settings || {}
      })
    }
  }, [section])

  if (!editingSection) return null

  const handleSave = () => {
    onSave(editingSection._id, editingSection)
    onClose()
  }

  const updateSectionSettings = (field: string, value: any) => {
    setEditingSection(prev => ({
      ...prev!,
      settings: {
        ...prev!.settings,
        [field]: value
      }
    }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Section Settings</DialogTitle>
          <DialogDescription>
            Customize the settings and styling for this section.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="space-y-4">
          <TabsList>
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Background Color</Label>
                <Input
                  type="color"
                  value={editingSection.settings?.backgroundColor || '#ffffff'}
                  onChange={(e) => updateSectionSettings('backgroundColor', e.target.value)}
                />
              </div>
              <div>
                <Label>Padding</Label>
                <Input
                  value={editingSection.settings?.padding || '60px 0'}
                  onChange={(e) => updateSectionSettings('padding', e.target.value)}
                  placeholder="e.g., 60px 0"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <AdvancedSettings
              settings={editingSection.settings || {}}
              onUpdate={updateSectionSettings}
              title="Section Advanced Settings"
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const HomepageManagement = () => {
  const [sections, setSections] = useState<HomepageSection[]>([])
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([])
  const [templates, setTemplates] = useState<LayoutTemplate[]>([])
  const [abTests, setABTests] = useState<ABTest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSection, setSelectedSection] = useState<HomepageSection | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<ContentBlock | null>(null)
  const [showSectionSettings, setShowSectionSettings] = useState(false)
  const [showBlockSettings, setShowBlockSettings] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [sectionsData, blocksData, templatesData, testsData] = await Promise.all([
        getHomepageSections(),
        getContentBlockTemplates(),
        getLayoutTemplates(),
        getABTests()
      ])

      setSections(sectionsData.sections || [])
      setContentBlocks(blocksData.blocks || [])
      setTemplates(templatesData.templates || [])
      setABTests(testsData.tests || [])
    } catch (error) {
      console.error('Error loading homepage data:', error)
      toast({
        title: "Error",
        description: "Failed to load homepage data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const generateObjectId = () => {
    const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0')
    const randomBytes = Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join('').substring(0, 16)
    return timestamp + randomBytes
  }

  const addSection = () => {
    const sectionNumber = sections.length + 1
    const newSection: HomepageSection = {
      _id: generateObjectId(),
      name: 'Section ' + sectionNumber,
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

    setSections(sections.map(section =>
      section._id === sectionId
        ? { ...section, blocks: [...section.blocks, newBlock] }
        : section
    ))
  }

  const updateBlock = (blockId: string, updates: Partial<ContentBlock>) => {
    setSections(sections.map(section => ({
      ...section,
      blocks: section.blocks.map(block =>
        block._id === blockId ? { ...block, ...updates } : block
      )
    })))
  }

  const saveChanges = async () => {
    try {
      await saveHomepageSections(sections)
      toast({
        title: "Success",
        description: "Homepage sections saved successfully",
      })
    } catch (error) {
      console.error('Error saving homepage sections:', error)
      toast({
        title: "Error",
        description: "Failed to save homepage sections",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading homepage data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Homepage Management</h1>
          <p className="text-muted-foreground">
            Design and customize your homepage with advanced styling options.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={saveChanges}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="builder" className="space-y-6">
        <TabsList>
          <TabsTrigger value="builder">Section Builder</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    Content Blocks
                  </CardTitle>
                  <CardDescription>
                    Click blocks to add them to sections
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {contentBlocks.map((blockTemplate) => (
                    <div key={blockTemplate._id} className="flex items-center justify-between p-2 bg-muted rounded hover:bg-muted-foreground cursor-pointer"
                      onClick={() => {
                        if (selectedSection) {
                          addBlockToSection(selectedSection._id, blockTemplate)
                        }
                      }}>
                      <span>{blockTemplate.title || blockTemplate.type}</span>
                      <Badge variant="secondary">{blockTemplate.type}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-3 space-y-4">
              <div className="flex justify-between items-center mb-2">
                <Button onClick={addSection}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Section
                </Button>
              </div>
              {sections.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-16">
                    <h2 className="text-2xl font-semibold mb-4">No sections created</h2>
                    <p className="text-muted-foreground">Add a new section to start building your homepage.</p>
                  </CardContent>
                </Card>
              ) : (
                sections
                  .sort((a, b) => a.order - b.order)
                  .map(section => (
                    <Card key={section._id} className="mb-4">
                      <CardHeader className="flex flex-row justify-between items-center">
                        <div>
                          <CardTitle>
                            <span
                              className="cursor-pointer underline"
                              onClick={() => {
                                setSelectedSection(section)
                                setShowSectionSettings(true)
                              }}
                            >
                              {section.name}
                            </span>
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Layout: {section.layout}
                            {section.isActive ? (
                              <Badge variant="default" className="ml-2">Active</Badge>
                            ) : (
                              <Badge variant="secondary" className="ml-2">Inactive</Badge>
                            )}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setSelectedSection(section)
                              setShowSectionSettings(true)
                            }}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteSection(section._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {section.blocks.length === 0 ? (
                          <div className="text-muted-foreground text-sm py-8 text-center">
                            No blocks added to this section.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {section.blocks
                              .sort((a, b) => a.order - b.order)
                              .map(block => (
                                <div key={block._id} className="border rounded-lg p-4 flex items-center justify-between bg-muted">
                                  <div>
                                    <span className="font-semibold">{block.title || block.type}</span>
                                    <Badge variant="outline" className="mx-2">{block.type}</Badge>
                                    {block.isVisible ? (
                                      <Badge variant="default">Visible</Badge>
                                    ) : (
                                      <Badge variant="secondary">Hidden</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        setSelectedBlock(block)
                                        setShowBlockSettings(true)
                                      }}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        updateSection(section._id, {
                                          blocks: section.blocks.filter(b => b._id !== block._id)
                                        })
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Layout Templates</CardTitle>
              <CardDescription>
                Apply a template to your homepage layout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(template => (
                  <div key={template._id} className="border rounded-lg p-4 flex flex-col">
                    <div className="font-bold mb-2">{template.name}</div>
                    <div className="text-sm mb-2">{template.description}</div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSections(template.sections)
                        toast({
                          title: "Template Applied",
                          description: `Applied template: ${template.name}`,
                        })
                      }}
                    >
                      Apply Template
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Section Settings Dialog */}
      <SectionSettingsDialog
        section={selectedSection}
        isOpen={showSectionSettings}
        onClose={() => setShowSectionSettings(false)}
        onSave={updateSection}
      />

      {/* Block Settings Dialog */}
      <BlockSettingsDialog
        block={selectedBlock}
        isOpen={showBlockSettings}
        onClose={() => setShowBlockSettings(false)}
        onSave={updateBlock}
      />

      {/* Preview Dialog */}
      <PreviewDialog
        sections={sections}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
      />
    </div>
  )
}