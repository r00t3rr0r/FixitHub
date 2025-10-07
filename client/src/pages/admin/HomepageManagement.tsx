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
          <div style={blockStyles} className="text-center py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <h1 className="text-4xl font-bold mb-4">
              {block.content?.heading || 'Hero Heading'}
            </h1>
            <p className="text-xl mb-8">
              {block.content?.subheading || 'Hero subheading text'}
            </p>
            <button className="bg-white text-blue-600 px-8 py-3 rounded-lg hover:bg-gray-100 mr-4">
              {block.content?.ctaText || 'Call to Action'}
            </button>
            {block.content?.secondaryCtaText && (
              <button className="border border-white text-white px-8 py-3 rounded-lg hover:bg-white/10">
                {block.content.secondaryCtaText}
              </button>
            )}
          </div>
        )

      case 'about':
        return (
          <div style={blockStyles} className="py-16">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">
                {block.content?.heading || 'About Us'}
              </h2>
              <p className="text-lg">
                {block.content?.description || 'Learn more about our company and services'}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {(block.content?.services || []).slice(0, 6).map((service: any, i: number) => (
                <div key={i} className="text-center p-6 border rounded-lg">
                  <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <Code className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{service.title}</h3>
                  <p>{service.description}</p>
                </div>
              ))}
            </div>
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
                  <div className="mt-4">
                    <span className="text-2xl font-bold text-green-600">$99</span>
                    <button className="w-full mt-2 bg-blue-600 text-white px-4 py-2 rounded">
                      {block.content?.ctaText || 'Get Quote'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      case 'blog':
        return (
          <div style={blockStyles} className="py-16">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">
                {block.content?.heading || 'Latest Articles'}
              </h2>
              <p className="text-lg">
                {block.content?.description || 'Read our latest blog posts'}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border rounded-lg overflow-hidden">
                  <div className="h-48 bg-gray-200"></div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-2">Blog Post {i}</h3>
                    <p className="text-gray-600 mb-4">Blog post excerpt goes here...</p>
                    <button className="text-blue-600 hover:underline">Read More</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      case 'shop':
        return (
          <div style={blockStyles} className="py-16 bg-gray-50">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">
                {block.content?.heading || 'Featured Products'}
              </h2>
              <p className="text-lg">
                {block.content?.description || 'Shop our featured products'}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white border rounded-lg overflow-hidden">
                  <div className="h-48 bg-gray-200"></div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-2">Product {i}</h3>
                    <p className="text-gray-600 mb-4">Product description goes here...</p>
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold text-green-600">$29.99</span>
                      <button className="bg-blue-600 text-white px-4 py-2 rounded">
                        {block.content?.ctaText || 'Add to Cart'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      case 'contact':
        return (
          <div style={blockStyles} className="py-16">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">
                {block.content?.heading || 'Contact Us'}
              </h2>
              <p className="text-lg">
                {block.content?.description || 'Get in touch with us'}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <input className="w-full p-3 border rounded" placeholder="Full Name" />
                <input className="w-full p-3 border rounded" placeholder="Email Address" />
                <textarea className="w-full p-3 border rounded h-32" placeholder="Message"></textarea>
                <button className="w-full bg-blue-600 text-white p-3 rounded">
                  {block.content?.ctaText || 'Send Message'}
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Code className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Phone</h3>
                    <p>+1 (555) 123-4567</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Code className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Email</h3>
                    <p>info@repairservice.com</p>
                  </div>
                </div>
              </div>
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
            <button className="bg-white text-blue-600 px-8 py-3 rounded-lg hover:bg-gray-100 mr-4">
              {block.content?.ctaText || 'Get Quote'}
            </button>
            {block.content?.secondaryCtaText && (
              <button className="border border-white text-white px-8 py-3 rounded-lg hover:bg-white/10">
                {block.content.secondaryCtaText}
              </button>
            )}
          </div>
        )

      case 'footer':
        return (
          <div style={blockStyles} className="py-12 bg-gray-900 text-white">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <h3 className="text-xl font-bold mb-4">{block.content?.companyName || 'RepairService'}</h3>
                <p className="text-gray-300">{block.content?.tagline || 'Professional repair services'}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Quick Links</h4>
                <ul className="space-y-2 text-gray-300">
                  <li>Home</li>
                  <li>Services</li>
                  <li>About</li>
                  <li>Contact</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Services</h4>
                <ul className="space-y-2 text-gray-300">
                  <li>Phone Repair</li>
                  <li>Computer Repair</li>
                  <li>Tablet Repair</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Newsletter</h4>
                <div className="flex gap-2">
                  <input className="flex-1 p-2 rounded bg-gray-800 text-white" placeholder="Email" />
                  <button className="bg-blue-600 text-white px-4 py-2 rounded">Subscribe</button>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-300">
              {block.content?.copyright || '© 2024 RepairService. All rights reserved.'}
            </div>
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
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full flex flex-col">
        <DialogHeader className="flex-shrink-0">
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

        <div className="flex-1 overflow-hidden bg-gray-100 p-4 rounded-lg">
          <div className="h-full overflow-y-auto">
            <div className={getPreviewStyles()}>
              <div className="bg-white shadow-lg rounded-lg overflow-hidden min-h-full">
                {sections.length === 0 ? (
                  <div className="text-center py-20">
                    <h2 className="text-2xl font-semibold mb-4">No sections to preview</h2>
                    <p className="text-gray-600">Add some sections to see the preview</p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {sections
                      .sort((a, b) => a.order - b.order)
                      .map(section => renderSection(section))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
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
            <div>
              <Label>CTA Link</Label>
              <Input
                value={editingBlock.content.ctaLink || ''}
                onChange={(e) => updateBlockContent('ctaLink', e.target.value)}
                placeholder="Enter CTA link (e.g., /register)"
              />
            </div>
            <div>
              <Label>Secondary CTA Text</Label>
              <Input
                value={editingBlock.content.secondaryCtaText || ''}
                onChange={(e) => updateBlockContent('secondaryCtaText', e.target.value)}
                placeholder="Enter secondary CTA text"
              />
            </div>
            <div>
              <Label>Secondary CTA Link</Label>
              <Input
                value={editingBlock.content.secondaryCtaLink || ''}
                onChange={(e) => updateBlockContent('secondaryCtaLink', e.target.value)}
                placeholder="Enter secondary CTA link"
              />
            </div>
          </div>
        )

      case 'about':
        return (
          <div className="space-y-4">
            <div>
              <Label>Heading</Label>
              <Input
                value={editingBlock.content.heading || ''}
                onChange={(e) => updateBlockContent('heading', e.target.value)}
                placeholder="Enter about heading"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={editingBlock.content.description || ''}
                onChange={(e) => updateBlockContent('description', e.target.value)}
                placeholder="Enter about description"
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
            <div>
              <Label>Display Type</Label>
              <Select
                value={editingBlock.content.displayType || 'dynamic'}
                onValueChange={(value) => updateBlockContent('displayType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dynamic">Dynamic (from API)</SelectItem>
                  <SelectItem value="static">Static (predefined)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Max Items to Display</Label>
              <Input
                type="number"
                value={editingBlock.content.maxItems || 6}
                onChange={(e) => updateBlockContent('maxItems', parseInt(e.target.value))}
                placeholder="6"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={editingBlock.content.showPricing || false}
                onCheckedChange={(checked) => updateBlockContent('showPricing', checked)}
              />
              <Label>Show Pricing</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={editingBlock.content.showRating || false}
                onCheckedChange={(checked) => updateBlockContent('showRating', checked)}
              />
              <Label>Show Rating</Label>
            </div>
          </div>
        )

      case 'blog':
        return (
          <div className="space-y-4">
            <div>
              <Label>Heading</Label>
              <Input
                value={editingBlock.content.heading || ''}
                onChange={(e) => updateBlockContent('heading', e.target.value)}
                placeholder="Enter blog section heading"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={editingBlock.content.description || ''}
                onChange={(e) => updateBlockContent('description', e.target.value)}
                placeholder="Enter blog section description"
              />
            </div>
            <div>
              <Label>Display Type</Label>
              <Select
                value={editingBlock.content.displayType || 'dynamic'}
                onValueChange={(value) => updateBlockContent('displayType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dynamic">Dynamic (from API)</SelectItem>
                  <SelectItem value="static">Static (predefined)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Max Items to Display</Label>
              <Input
                type="number"
                value={editingBlock.content.maxItems || 3}
                onChange={(e) => updateBlockContent('maxItems', parseInt(e.target.value))}
                placeholder="3"
              />
            </div>
          </div>
        )

      case 'shop':
        return (
          <div className="space-y-4">
            <div>
              <Label>Heading</Label>
              <Input
                value={editingBlock.content.heading || ''}
                onChange={(e) => updateBlockContent('heading', e.target.value)}
                placeholder="Enter shop section heading"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={editingBlock.content.description || ''}
                onChange={(e) => updateBlockContent('description', e.target.value)}
                placeholder="Enter shop section description"
              />
            </div>
            <div>
              <Label>Display Type</Label>
              <Select
                value={editingBlock.content.displayType || 'dynamic'}
                onValueChange={(value) => updateBlockContent('displayType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dynamic">Dynamic (from API)</SelectItem>
                  <SelectItem value="static">Static (predefined)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Max Items to Display</Label>
              <Input
                type="number"
                value={editingBlock.content.maxItems || 6}
                onChange={(e) => updateBlockContent('maxItems', parseInt(e.target.value))}
                placeholder="6"
              />
            </div>
          </div>
        )

      case 'contact':
        return (
          <div className="space-y-4">
            <div>
              <Label>Heading</Label>
              <Input
                value={editingBlock.content.heading || ''}
                onChange={(e) => updateBlockContent('heading', e.target.value)}
                placeholder="Enter contact heading"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={editingBlock.content.description || ''}
                onChange={(e) => updateBlockContent('description', e.target.value)}
                placeholder="Enter contact description"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={editingBlock.content.showContactForm || false}
                onCheckedChange={(checked) => updateBlockContent('showContactForm', checked)}
              />
              <Label>Show Contact Form</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={editingBlock.content.showContactInfo || false}
                onCheckedChange={(checked) => updateBlockContent('showContactInfo', checked)}
              />
              <Label>Show Contact Information</Label>
            </div>
          </div>
        )

      case 'footer':
        return (
          <div className="space-y-4">
            <div>
              <Label>Company Name</Label>
              <Input
                value={editingBlock.content.companyName || ''}
                onChange={(e) => updateBlockContent('companyName', e.target.value)}
                placeholder="Enter company name"
              />
            </div>
            <div>
              <Label>Tagline</Label>
              <Input
                value={editingBlock.content.tagline || ''}
                onChange={(e) => updateBlockContent('tagline', e.target.value)}
                placeholder="Enter company tagline"
              />
            </div>
            <div>
              <Label>Copyright Text</Label>
              <Input
                value={editingBlock.content.copyright || ''}
                onChange={(e) => updateBlockContent('copyright', e.target.value)}
                placeholder="© 2024 RepairService. All rights reserved."
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
                  value={editingBlock.settings.backgroundColor || '#ffffff'}
                  onChange={(e) => updateBlockSettings('backgroundColor', e.target.value)}
                />
              </div>
              <div>
                <Label>Text Color</Label>
                <Input
                  type="color"
                  value={editingBlock.settings.textColor || '#000000'}
                  onChange={(e) => updateBlockSettings('textColor', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Padding</Label>
                <Input
                  value={editingBlock.settings.padding || '20px 0'}
                  onChange={(e) => updateBlockSettings('padding', e.target.value)}
                  placeholder="e.g., 20px 0"
                />
              </div>
              <div>
                <Label>Margin</Label>
                <Input
                  value={editingBlock.settings.margin || '0px'}
                  onChange={(e) => updateBlockSettings('margin', e.target.value)}
                  placeholder="e.g., 10px 0"
                />
              </div>
            </div>

            <div>
              <Label>Text Alignment</Label>
              <Select
                value={editingBlock.settings.alignment || 'left'}
                onValueChange={(value) => updateBlockSettings('alignment', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <AdvancedSettings
              settings={editingBlock.settings}
              onUpdate={updateBlockSettings}
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

export function HomepageManagement() {
  const [sections, setSections] = useState<HomepageSection[]>([])
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([])
  const [layoutTemplates, setLayoutTemplates] = useState<LayoutTemplate[]>([])
  const [abTests, setAbTests] = useState<ABTest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBlock, setSelectedBlock] = useState<ContentBlock | null>(null)
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [sectionsRes, blocksRes, templatesRes, testsRes] = await Promise.all([
        getHomepageSections(),
        getContentBlockTemplates(),
        getLayoutTemplates(),
        getABTests()
      ])

      setSections(sectionsRes.sections || [])
      setContentBlocks(blocksRes.blocks || [])
      setLayoutTemplates(templatesRes.templates || [])
      setAbTests(testsRes.tests || [])
    } catch (error) {
      console.error('Error fetching homepage data:', error)
      toast({
        title: "Error",
        description: "Failed to load homepage data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveChanges = async () => {
    try {
      // Clean up sections before saving - remove temporary IDs and let MongoDB generate them
      const cleanedSections = sections.map(section => {
        const cleanedSection = { ...section }
        
        // Remove temporary section IDs that start with "section_"
        if (typeof cleanedSection._id === 'string' && cleanedSection._id.startsWith('section_')) {
          delete cleanedSection._id
        }
        
        // Clean up blocks in the section
        cleanedSection.blocks = section.blocks.map(block => {
          const cleanedBlock = { ...block }
          
          // Remove temporary block IDs that start with "block_"
          if (typeof cleanedBlock._id === 'string' && cleanedBlock._id.startsWith('block_')) {
            delete cleanedBlock._id
          }
          
          return cleanedBlock
        })
        
        return cleanedSection
      })

      await saveHomepageSections(cleanedSections)
      toast({
        title: "Success",
        description: "Homepage sections saved successfully"
      })
      
      // Refresh data to get the proper MongoDB IDs
      await fetchData()
    } catch (error) {
      console.error('Error saving homepage sections:', error)
      toast({
        title: "Error",
        description: "Failed to save homepage sections",
        variant: "destructive"
      })
    }
  }

  const addSection = () => {
    const newSection: HomepageSection = {
      _id: `section_${Date.now()}`,
      name: `Section ${sections.length + 1}`,
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

  const addBlockToSection = (sectionId: string, blockTemplateId: string) => {
    const template = contentBlocks.find(b => b._id === blockTemplateId)
    if (!template) return

    const newBlock: ContentBlock = {
      ...template,
      _id: `block_${Date.now()}`,
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
  }

  const updateBlock = (blockId: string, updates: Partial<ContentBlock>) => {
    setSections(sections.map(section => ({
      ...section,
      blocks: section.blocks.map(block =>
        block._id === blockId ? { ...block, ...updates } : block
      )
    })))
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

  const editBlock = (block: ContentBlock) => {
    setSelectedBlock(block)
    setIsBlockDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading homepage management...</p>
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
            Design and customize your homepage with drag-and-drop sections
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsPreviewOpen(true)}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={handleSaveChanges}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="sections" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sections">Page Sections</TabsTrigger>
          <TabsTrigger value="templates">Layout Templates</TabsTrigger>
          <TabsTrigger value="tests">A/B Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="sections" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Content Blocks Library */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Content Blocks
                </CardTitle>
                <CardDescription>
                  Drag and drop these blocks into your sections
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {contentBlocks.map((block) => (
                  <div
                    key={block._id}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => {
                      // For now, we'll add to the first section or create one
                      if (sections.length === 0) {
                        addSection()
                      }
                      const firstSection = sections[0] || { _id: `section_${Date.now()}` }
                      addBlockToSection(firstSection._id, block._id)
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                        <Code className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{block.title}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {block.type}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Homepage Sections */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Homepage Sections</h2>
                <Button onClick={addSection}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Section
                </Button>
              </div>

              {sections.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No sections yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first section to start building your homepage
                    </p>
                    <Button onClick={addSection}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Section
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {sections
                    .sort((a, b) => a.order - b.order)
                    .map((section) => (
                      <Card key={section._id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg">{section.name}</CardTitle>
                              <CardDescription>
                                {section.blocks.length} blocks • {section.layout} layout
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={section.isActive ? "default" : "secondary"}>
                                {section.isActive ? "Active" : "Inactive"}
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeSection(section._id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {section.blocks.length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                              <p className="text-muted-foreground">
                                No blocks in this section. Add blocks from the library.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {section.blocks
                                .sort((a, b) => a.order - b.order)
                                .map((block) => (
                                  <div
                                    key={block._id}
                                    className="flex items-center justify-between p-3 border rounded-lg"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                                        <Code className="h-4 w-4 text-primary" />
                                      </div>
                                      <div>
                                        <div className="font-medium">{block.title}</div>
                                        <div className="text-sm text-muted-foreground capitalize">
                                          {block.type}
                                        </div>
                                      </div>
                                      <Badge variant={block.isVisible ? "default" : "secondary"}>
                                        {block.isVisible ? "Visible" : "Hidden"}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => editBlock(block)}
                                      >
                                        <Settings className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => removeBlock(section._id, block._id)}
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
                    ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Layout Templates</CardTitle>
              <CardDescription>
                Pre-designed homepage layouts you can use as starting points
              </CardDescription>
            </CardHeader>
            <CardContent>
              {layoutTemplates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No layout templates available</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {layoutTemplates.map((template) => (
                    <Card key={template._id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="aspect-video bg-muted rounded mb-3 flex items-center justify-center">
                          <Layers className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold mb-1">{template.name}</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          {template.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <Badge variant={template.isDefault ? "default" : "outline"}>
                            {template.isDefault ? "Default" : "Template"}
                          </Badge>
                          <Button size="sm" variant="outline">
                            Use Template
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tests" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>A/B Tests</CardTitle>
              <CardDescription>
                Test different homepage variations to optimize conversions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {abTests.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No A/B tests configured</p>
                  <Button className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Create A/B Test
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {abTests.map((test) => (
                    <Card key={test._id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{test.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {test.description}
                            </p>
                          </div>
                          <Badge variant={
                            test.status === 'running' ? 'default' :
                            test.status === 'completed' ? 'secondary' : 'outline'
                          }>
                            {test.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PreviewDialog
        sections={sections}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />

      <BlockSettingsDialog
        block={selectedBlock}
        isOpen={isBlockDialogOpen}
        onClose={() => {
          setIsBlockDialogOpen(false)
          setSelectedBlock(null)
        }}
        onSave={updateBlock}
      />
    </div>
  )
}