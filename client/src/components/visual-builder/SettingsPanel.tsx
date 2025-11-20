import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Settings, Palette, Layout, Code, Eye } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import type { PageContent, Section, Component } from '@/api/pageContent';

interface SettingsPanelProps {
  pageContent: PageContent;
  selectedElement: {
    type: 'section' | 'component';
    sectionId?: string;
    componentId?: string;
  } | null;
  onUpdateSection: (sectionId: string, updates: Partial<Section>) => void;
  onUpdateComponent: (sectionId: string, componentId: string, updates: Partial<Component>) => void;
  onUpdateGlobalStyles: (styles: any) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  pageContent,
  selectedElement,
  onUpdateSection,
  onUpdateComponent,
  onUpdateGlobalStyles
}) => {
  const getSelectedSection = () => {
    if (!selectedElement?.sectionId) return null;
    return pageContent.sections.find(s => s.id === selectedElement.sectionId);
  };

  const getSelectedComponent = () => {
    if (!selectedElement?.sectionId || !selectedElement?.componentId) return null;
    const section = getSelectedSection();
    return section?.components.find(c => c.id === selectedElement.componentId);
  };

  const renderComponentSettings = () => {
    const component = getSelectedComponent();
    if (!component || !selectedElement) return null;

    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2">Component Settings</h3>
          <p className="text-sm text-gray-500 mb-4">Type: {component.type}</p>
        </div>

        {/* Common Settings */}
        <div>
          <Label>Component Name</Label>
          <Input
            value={component.name || ''}
            onChange={(e) =>
              onUpdateComponent(selectedElement.sectionId!, component.id, { name: e.target.value })
            }
            placeholder="Component name"
          />
        </div>

        {/* Type-specific settings */}
        {(component.type === 'heading' || component.type === 'paragraph' || component.type === 'text') && (
          <div>
            <Label>Text Content</Label>
            <Textarea
              value={component.content?.text || ''}
              onChange={(e) =>
                onUpdateComponent(selectedElement.sectionId!, component.id, {
                  content: { ...component.content, text: e.target.value }
                })
              }
              placeholder="Enter text"
              rows={3}
            />
          </div>
        )}

        {component.type === 'heading' && (
          <div>
            <Label>Heading Level</Label>
            <Select
              value={component.content?.level || 'h2'}
              onValueChange={(value) =>
                onUpdateComponent(selectedElement.sectionId!, component.id, {
                  content: { ...component.content, level: value }
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="h1">H1</SelectItem>
                <SelectItem value="h2">H2</SelectItem>
                <SelectItem value="h3">H3</SelectItem>
                <SelectItem value="h4">H4</SelectItem>
                <SelectItem value="h5">H5</SelectItem>
                <SelectItem value="h6">H6</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {component.type === 'button' && (
          <>
            <div>
              <Label>Button Text</Label>
              <Input
                value={component.content?.text || ''}
                onChange={(e) =>
                  onUpdateComponent(selectedElement.sectionId!, component.id, {
                    content: { ...component.content, text: e.target.value }
                  })
                }
                placeholder="Button text"
              />
            </div>
            <div>
              <Label>Button URL</Label>
              <Input
                value={component.content?.url || ''}
                onChange={(e) =>
                  onUpdateComponent(selectedElement.sectionId!, component.id, {
                    content: { ...component.content, url: e.target.value }
                  })
                }
                placeholder="https://"
              />
            </div>
            <div>
              <Label>Button Variant</Label>
              <Select
                value={component.content?.variant || 'default'}
                onValueChange={(value) =>
                  onUpdateComponent(selectedElement.sectionId!, component.id, {
                    content: { ...component.content, variant: value }
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="outline">Outline</SelectItem>
                  <SelectItem value="ghost">Ghost</SelectItem>
                  <SelectItem value="destructive">Destructive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {component.type === 'image' && (
          <>
            <div>
              <Label>Image URL</Label>
              <Input
                value={component.content?.src || ''}
                onChange={(e) =>
                  onUpdateComponent(selectedElement.sectionId!, component.id, {
                    content: { ...component.content, src: e.target.value }
                  })
                }
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div>
              <Label>Alt Text</Label>
              <Input
                value={component.content?.alt || ''}
                onChange={(e) =>
                  onUpdateComponent(selectedElement.sectionId!, component.id, {
                    content: { ...component.content, alt: e.target.value }
                  })
                }
                placeholder="Image description"
              />
            </div>
          </>
        )}

        {component.type === 'html' && (
          <HTMLEditor
            component={component}
            selectedElement={selectedElement}
            onUpdateComponent={onUpdateComponent}
          />
        )}

        {/* Style Settings */}
        <div className="pt-4 border-t">
          <h4 className="font-medium mb-3">Styling</h4>

          <div className="space-y-3">
            <div>
              <Label>Background Color</Label>
              <Input
                type="color"
                value={component.styles?.backgroundColor || '#ffffff'}
                onChange={(e) =>
                  onUpdateComponent(selectedElement.sectionId!, component.id, {
                    styles: { ...component.styles, backgroundColor: e.target.value }
                  })
                }
              />
            </div>

            <div>
              <Label>Text Color</Label>
              <Input
                type="color"
                value={component.styles?.color || '#000000'}
                onChange={(e) =>
                  onUpdateComponent(selectedElement.sectionId!, component.id, {
                    styles: { ...component.styles, color: e.target.value }
                  })
                }
              />
            </div>

            <div>
              <Label>Padding</Label>
              <Input
                value={component.styles?.padding?.top || 0}
                onChange={(e) =>
                  onUpdateComponent(selectedElement.sectionId!, component.id, {
                    styles: {
                      ...component.styles,
                      padding: {
                        top: parseInt(e.target.value) || 0,
                        right: parseInt(e.target.value) || 0,
                        bottom: parseInt(e.target.value) || 0,
                        left: parseInt(e.target.value) || 0
                      }
                    }
                  })
                }
                type="number"
                placeholder="Padding (px)"
              />
            </div>

            <div>
              <Label>Text Align</Label>
              <Select
                value={component.styles?.textAlign || 'left'}
                onValueChange={(value: any) =>
                  onUpdateComponent(selectedElement.sectionId!, component.id, {
                    styles: { ...component.styles, textAlign: value }
                  })
                }
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
          </div>
        </div>
      </div>
    );
  };

  const renderSectionSettings = () => {
    const section = getSelectedSection();
    if (!section || !selectedElement) return null;

    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2">Section Settings</h3>
          <p className="text-sm text-gray-500 mb-4">Type: {section.type}</p>
        </div>

        <div>
          <Label>Section Name</Label>
          <Input
            value={section.name || ''}
            onChange={(e) => onUpdateSection(section.id, { name: e.target.value })}
            placeholder="Section name"
          />
        </div>

        <div>
          <Label>Section Type</Label>
          <Select
            value={section.type}
            onValueChange={(value: any) => onUpdateSection(section.id, { type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hero">Hero</SelectItem>
              <SelectItem value="features">Features</SelectItem>
              <SelectItem value="gallery">Gallery</SelectItem>
              <SelectItem value="cta">Call to Action</SelectItem>
              <SelectItem value="contact">Contact</SelectItem>
              <SelectItem value="footer">Footer</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="pt-4 border-t">
          <h4 className="font-medium mb-3">Section Styling</h4>

          <div className="space-y-3">
            <div>
              <Label>Background Color</Label>
              <Input
                type="color"
                value={section.styles?.backgroundColor || '#ffffff'}
                onChange={(e) =>
                  onUpdateSection(section.id, {
                    styles: { ...section.styles, backgroundColor: e.target.value }
                  })
                }
              />
            </div>

            <div>
              <Label>Max Width (px)</Label>
              <Input
                value={section.containerMaxWidth || '1280'}
                onChange={(e) => onUpdateSection(section.id, { containerMaxWidth: e.target.value })}
                placeholder="1280"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={section.isFullWidth || false}
                onChange={(e) => onUpdateSection(section.id, { isFullWidth: e.target.checked })}
                className="rounded"
              />
              <Label>Full Width Section</Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={section.parallax || false}
                onChange={(e) => onUpdateSection(section.id, { parallax: e.target.checked })}
                className="rounded"
              />
              <Label>Parallax Effect</Label>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderGlobalSettings = () => {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2">Global Styles</h3>
          <p className="text-sm text-gray-500 mb-4">These styles apply to the entire page</p>
        </div>

        <div>
          <Label>Background Color</Label>
          <Input
            type="color"
            value={pageContent.globalStyles?.backgroundColor || '#ffffff'}
            onChange={(e) =>
              onUpdateGlobalStyles({ backgroundColor: e.target.value })
            }
          />
        </div>

        <div>
          <Label>Font Family</Label>
          <Select
            value={pageContent.globalStyles?.fontFamily || 'inherit'}
            onValueChange={(value) => onUpdateGlobalStyles({ fontFamily: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Default</SelectItem>
              <SelectItem value="Inter, sans-serif">Inter</SelectItem>
              <SelectItem value="Arial, sans-serif">Arial</SelectItem>
              <SelectItem value="'Times New Roman', serif">Times New Roman</SelectItem>
              <SelectItem value="'Courier New', monospace">Courier New</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="pt-4 border-t">
          <h4 className="font-medium mb-3">Color Scheme</h4>
          <div className="space-y-3">
            <div>
              <Label>Primary Color</Label>
              <Input
                type="color"
                value={pageContent.globalStyles?.colorScheme?.primary || '#3b82f6'}
                onChange={(e) =>
                  onUpdateGlobalStyles({
                    colorScheme: {
                      ...pageContent.globalStyles?.colorScheme,
                      primary: e.target.value
                    }
                  })
                }
              />
            </div>
            <div>
              <Label>Secondary Color</Label>
              <Input
                type="color"
                value={pageContent.globalStyles?.colorScheme?.secondary || '#8b5cf6'}
                onChange={(e) =>
                  onUpdateGlobalStyles({
                    colorScheme: {
                      ...pageContent.globalStyles?.colorScheme,
                      secondary: e.target.value
                    }
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Settings
        </h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {selectedElement ? (
            selectedElement.type === 'component' ? (
              renderComponentSettings()
            ) : (
              renderSectionSettings()
            )
          ) : (
            renderGlobalSettings()
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

// HTML Editor Component with Preview
interface HTMLEditorProps {
  component: Component;
  selectedElement: {
    type: 'section' | 'component';
    sectionId?: string;
    componentId?: string;
  };
  onUpdateComponent: (sectionId: string, componentId: string, updates: Partial<Component>) => void;
}

const HTMLEditor: React.FC<HTMLEditorProps> = ({ component, selectedElement, onUpdateComponent }) => {
  const [editorMode, setEditorMode] = useState<'wysiwyg' | 'code' | 'css'>('wysiwyg');
  const [showPreview, setShowPreview] = useState(false);
  const [htmlCode, setHtmlCode] = useState(component.content?.html || '');
  const [cssCode, setCssCode] = useState(component.content?.css || '');

  const handleEditorChange = (content: string) => {
    console.log('WYSIWYG editor content changed');
    setHtmlCode(content);
    onUpdateComponent(selectedElement.sectionId!, component.id, {
      content: { ...component.content, html: content }
    });
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    console.log('HTML code manually updated');
    setHtmlCode(newCode);
    onUpdateComponent(selectedElement.sectionId!, component.id, {
      content: { ...component.content, html: newCode }
    });
  };

  const handleCssChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCss = e.target.value;
    console.log('CSS code manually updated');
    setCssCode(newCss);
    onUpdateComponent(selectedElement.sectionId!, component.id, {
      content: { ...component.content, css: newCss }
    });
  };

  // Quill modules configuration
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'font': [] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'script': 'sub' }, { 'script': 'super' }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'indent': '-1' }, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['blockquote', 'code-block'],
      ['link', 'image', 'video'],
      ['clean']
    ],
  };

  // Quill formats configuration
  const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'script',
    'list', 'bullet', 'indent',
    'align',
    'blockquote', 'code-block',
    'link', 'image', 'video'
  ];

  useEffect(() => {
    console.log('HTMLEditor component mounted with React-Quill');
  }, []);

  useEffect(() => {
    console.log(`Editor mode changed to: ${editorMode}`);
  }, [editorMode]);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>HTML Content</Label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={showPreview ? 'default' : 'outline'}
              onClick={() => setShowPreview(!showPreview)}
              className="h-7 text-xs"
            >
              <Eye className="h-3 w-3 mr-1" />
              {showPreview ? 'Hide' : 'Show'} Preview
            </Button>
          </div>
        </div>

        <Tabs value={editorMode} onValueChange={(value: any) => setEditorMode(value)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="wysiwyg">Visual Editor</TabsTrigger>
            <TabsTrigger value="code">HTML Code</TabsTrigger>
            <TabsTrigger value="css">CSS Code</TabsTrigger>
          </TabsList>

          <TabsContent value="wysiwyg" className="mt-2">
            <div className="border rounded-md overflow-hidden min-h-[400px]">
              <ReactQuill
                theme="snow"
                value={htmlCode}
                onChange={handleEditorChange}
                modules={modules}
                formats={formats}
                className="bg-white"
                style={{ minHeight: '400px' }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Use the rich text editor to format your content with various styling options.
            </p>
          </TabsContent>

          <TabsContent value="code" className="mt-2">
            <Textarea
              value={htmlCode}
              onChange={handleCodeChange}
              placeholder="<div>Enter your HTML code here...</div>"
              className="font-mono text-sm min-h-[400px]"
              spellCheck={false}
            />
            <p className="text-xs text-gray-500 mt-2">
              Write or paste your HTML code directly. Changes are applied in real-time.
            </p>
          </TabsContent>

          <TabsContent value="css" className="mt-2">
            <Textarea
              value={cssCode}
              onChange={handleCssChange}
              placeholder=".my-class {&#10;  color: #333;&#10;  font-size: 16px;&#10;  margin: 10px;&#10;}"
              className="font-mono text-sm min-h-[400px]"
              spellCheck={false}
            />
            <p className="text-xs text-gray-500 mt-2">
              Write custom CSS styles for your HTML content. Use class names or element selectors.
            </p>
          </TabsContent>
        </Tabs>
      </div>

      {/* Real-time Preview */}
      {showPreview && (
        <div className="pt-4 border-t">
          <Label className="mb-2 block">Live Preview</Label>
          <Card className="p-4 bg-white dark:bg-gray-900 min-h-[200px]">
            {cssCode && (
              <style dangerouslySetInnerHTML={{ __html: cssCode }} />
            )}
            {htmlCode ? (
              <div
                dangerouslySetInnerHTML={{ __html: htmlCode }}
                className="prose prose-sm max-w-none dark:prose-invert"
              />
            ) : (
              <div className="text-center text-gray-400 py-8">
                <Code className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No HTML content to preview</p>
                <p className="text-xs mt-1">Start editing to see your content here</p>
              </div>
            )}
          </Card>
          <p className="text-xs text-gray-500 mt-2">
            This preview updates in real-time as you edit. Custom CSS styles are applied automatically.
          </p>
        </div>
      )}

      {/* Editor Tips */}
      <div className="pt-4 border-t">
        <Label className="mb-2 block text-xs text-gray-500 uppercase">Tips</Label>
        <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
          <li>Use the Visual Editor for easier formatting</li>
          <li>Switch to HTML Code for direct code editing</li>
          <li>Use CSS Code to add custom styles to your content</li>
          <li>Preview shows how your content will look with applied CSS</li>
          <li>All changes are saved automatically</li>
          <li>Supports standard HTML tags, inline styles, and custom CSS classes</li>
        </ul>
      </div>
    </div>
  );
};
