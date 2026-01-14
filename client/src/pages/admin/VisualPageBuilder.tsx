import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/useToast';
import {
  Save,
  Undo,
  Redo,
  Eye,
  Monitor,
  Tablet,
  Smartphone,
  Settings,
  Plus,
  Upload,
  Download,
  History
} from 'lucide-react';
import {
  getPageContent,
  updatePageContent,
  publishPage,
  createVersion,
  getVersionHistory,
  restoreVersion,
  type PageContent,
  type Section,
  type Component
} from '@/api/pageContent';
import { ComponentLibrary } from '@/components/visual-builder/ComponentLibrary';
import { BuilderCanvas } from '@/components/visual-builder/BuilderCanvas';
import { SettingsPanel } from '@/components/visual-builder/SettingsPanel';
import { HistoryPanel } from '@/components/visual-builder/HistoryPanel';

export const VisualPageBuilder: React.FC = () => {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [pageContent, setPageContent] = useState<PageContent | null>(null);
  const [selectedElement, setSelectedElement] = useState<{
    type: 'section' | 'component';
    sectionId?: string;
    componentId?: string;
  } | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [showHistory, setShowHistory] = useState(false);
  const [versionHistory, setVersionHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [undoStack, setUndoStack] = useState<PageContent[]>([]);
  const [redoStack, setRedoStack] = useState<PageContent[]>([]);

  // Load page content
  useEffect(() => {
    if (pageId) {
      loadPageContent();
      loadVersionHistory();
    }
  }, [pageId]);

  const loadPageContent = async () => {
    try {
      setLoading(true);
      const response = await getPageContent(pageId!);
      setPageContent(response.pageContent);
    } catch (error: any) {
      console.error('Error loading page content:', error.message);

      // If page content doesn't exist, initialize with empty content
      if (error.message?.includes('Page content not found') || error.message?.includes('404')) {
        console.log('Page content not found, initializing empty page');
        setPageContent({
          pageId: pageId!,
          pageTitle: 'New Page',
          pageSlug: pageId!,
          sections: [],
          globalStyles: {
            primaryColor: '#3b82f6',
            secondaryColor: '#10b981',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '16px',
            backgroundColor: '#ffffff',
            textColor: '#1f2937'
          },
          customCSS: '',
          customJS: '',
          isPublished: false,
          createdBy: null,
          updatedBy: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        toast({
          title: 'New Page',
          description: 'Starting with a blank page. Add sections to get started!'
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'Failed to load page content'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const loadVersionHistory = async () => {
    try {
      const history = await getVersionHistory(pageId!);
      setVersionHistory(history);
    } catch (error: any) {
      console.error('Error loading version history:', error.message);
      // Set empty version history for new pages
      setVersionHistory({ versions: [] });
    }
  };

  // Save page content
  const handleSave = async () => {
    if (!pageContent) return;

    try {
      setSaving(true);
      await updatePageContent(pageId!, {
        sections: pageContent.sections,
        globalStyles: pageContent.globalStyles,
        customCSS: pageContent.customCSS,
        customJS: pageContent.customJS
      });

      // Create version snapshot
      await createVersion(pageId!, 'manual_save');
      await loadVersionHistory();

      toast({
        title: 'Success',
        description: 'Page saved successfully'
      });
    } catch (error: any) {
      console.error('Error saving page:', error.message);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save page'
      });
    } finally {
      setSaving(false);
    }
  };

  // Publish page
  const handlePublish = async () => {
    if (!pageContent) return;

    try {
      await publishPage(pageId!);
      await loadPageContent();

      toast({
        title: 'Success',
        description: 'Page published successfully'
      });
    } catch (error: any) {
      console.error('Error publishing page:', error.message);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to publish page'
      });
    }
  };

  // Undo/Redo functionality
  const handleUndo = () => {
    if (undoStack.length === 0 || !pageContent) return;

    const previousState = undoStack[undoStack.length - 1];
    setRedoStack([...redoStack, pageContent]);
    setPageContent(previousState);
    setUndoStack(undoStack.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    if (pageContent) {
      setUndoStack([...undoStack, pageContent]);
    }
    setPageContent(nextState);
    setRedoStack(redoStack.slice(0, -1));
  };

  // Add section
  const handleAddSection = (sectionType: Section['type']) => {
    if (!pageContent) return;

    // Save current state to undo stack
    setUndoStack([...undoStack, pageContent]);
    setRedoStack([]);

    const newSection: Section = {
      id: `section_${Date.now()}`,
      name: `New ${sectionType} Section`,
      type: sectionType,
      components: [],
      styles: {},
      order: pageContent.sections.length
    };

    setPageContent({
      ...pageContent,
      sections: [...pageContent.sections, newSection]
    });
  };

  // Update section
  const handleUpdateSection = (sectionId: string, updates: Partial<Section>) => {
    if (!pageContent) return;

    setUndoStack([...undoStack, pageContent]);
    setRedoStack([]);

    const updatedSections = pageContent.sections.map(section =>
      section.id === sectionId ? { ...section, ...updates } : section
    );

    setPageContent({
      ...pageContent,
      sections: updatedSections
    });
  };

  // Delete section
  const handleDeleteSection = (sectionId: string) => {
    if (!pageContent) return;

    setUndoStack([...undoStack, pageContent]);
    setRedoStack([]);

    setPageContent({
      ...pageContent,
      sections: pageContent.sections.filter(s => s.id !== sectionId)
    });

    if (selectedElement?.sectionId === sectionId) {
      setSelectedElement(null);
    }
  };

  // Add component to section
  const handleAddComponent = (sectionId: string, componentType: Component['type']) => {
    if (!pageContent) return;

    setUndoStack([...undoStack, pageContent]);
    setRedoStack([]);

    const newComponent: Component = {
      id: `component_${Date.now()}`,
      type: componentType,
      name: componentType,
      content: getDefaultContent(componentType),
      styles: {},
      order: 0
    };

    const updatedSections = pageContent.sections.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          components: [...section.components, newComponent]
        };
      }
      return section;
    });

    setPageContent({
      ...pageContent,
      sections: updatedSections
    });
  };

  // Update component
  const handleUpdateComponent = (sectionId: string, componentId: string, updates: Partial<Component>) => {
    if (!pageContent) return;

    setUndoStack([...undoStack, pageContent]);
    setRedoStack([]);

    const updatedSections = pageContent.sections.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          components: section.components.map(comp =>
            comp.id === componentId ? { ...comp, ...updates } : comp
          )
        };
      }
      return section;
    });

    setPageContent({
      ...pageContent,
      sections: updatedSections
    });
  };

  // Delete component
  const handleDeleteComponent = (sectionId: string, componentId: string) => {
    if (!pageContent) return;

    setUndoStack([...undoStack, pageContent]);
    setRedoStack([]);

    const updatedSections = pageContent.sections.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          components: section.components.filter(c => c.id !== componentId)
        };
      }
      return section;
    });

    setPageContent({
      ...pageContent,
      sections: updatedSections
    });

    if (selectedElement?.componentId === componentId) {
      setSelectedElement(null);
    }
  };

  // Restore version
  const handleRestoreVersion = async (versionIndex: number) => {
    try {
      const response = await restoreVersion(pageId!, versionIndex);
      setPageContent(response.pageContent);
      await loadVersionHistory();
      setShowHistory(false);

      toast({
        title: 'Success',
        description: 'Version restored successfully'
      });
    } catch (error: any) {
      console.error('Error restoring version:', error.message);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to restore version'
      });
    }
  };

  // Get default content based on component type
  const getDefaultContent = (type: Component['type']): any => {
    switch (type) {
      case 'heading':
        return { text: 'Heading Text', level: 'h2' };
      case 'text':
      case 'paragraph':
        return { text: 'Enter your text here...' };
      case 'button':
        return { text: 'Click Me', url: '#', variant: 'default' };
      case 'image':
        return { src: '', alt: 'Image', width: '100%', height: 'auto' };
      case 'video':
        return { src: '', type: 'youtube', autoplay: false };
      case 'icon':
        return { name: 'star', size: 24 };
      default:
        return {};
    }
  };

  // Get device width for preview
  const getDeviceWidth = () => {
    switch (previewDevice) {
      case 'mobile':
        return '375px';
      case 'tablet':
        return '768px';
      default:
        return '100%';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading page builder...</p>
        </div>
      </div>
    );
  }

  if (!pageContent) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="p-6">
          <p>Page not found</p>
          <Button onClick={() => navigate('/admin/website-builder')} className="mt-4">
            Back to Pages
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Toolbar */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/website-builder')}
          >
            ← Back to Pages
          </Button>
          <div className="border-l pl-4 ml-2">
            <h2 className="font-semibold">{pageContent.pageTitle}</h2>
            <p className="text-sm text-gray-500">/{pageContent.pageSlug}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
          >
            <Redo className="h-4 w-4" />
          </Button>

          <div className="border-l pl-2 ml-2"></div>

          {/* Device Preview */}
          <div className="flex gap-1 bg-gray-100 rounded-md p-1">
            <Button
              variant={previewDevice === 'desktop' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPreviewDevice('desktop')}
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              variant={previewDevice === 'tablet' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPreviewDevice('tablet')}
            >
              <Tablet className="h-4 w-4" />
            </Button>
            <Button
              variant={previewDevice === 'mobile' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPreviewDevice('mobile')}
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>

          <div className="border-l pl-2 ml-2"></div>

          {/* Actions */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="h-4 w-4 mr-1" />
            History
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="h-4 w-4 mr-1" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button
            size="sm"
            onClick={handlePublish}
          >
            <Upload className="h-4 w-4 mr-1" />
            Publish
          </Button>
        </div>
      </div>

      {/* Main Builder Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Component Library */}
        <div className="w-64 bg-white border-r overflow-y-auto">
          <ComponentLibrary
            onAddSection={handleAddSection}
            onAddComponent={(type) => {
              // Add to first section or create one if none exist
              if (pageContent.sections.length === 0) {
                handleAddSection('custom');
                setTimeout(() => {
                  if (pageContent.sections.length > 0) {
                    handleAddComponent(pageContent.sections[0].id, type);
                  }
                }, 100);
              } else {
                const lastSection = pageContent.sections[pageContent.sections.length - 1];
                handleAddComponent(lastSection.id, type);
              }
            }}
          />
        </div>

        {/* Center Canvas */}
        <div className="flex-1 overflow-auto bg-gray-100 p-8">
          <div
            className="mx-auto bg-white shadow-lg transition-all duration-300"
            style={{ width: getDeviceWidth(), minHeight: '600px' }}
          >
            <BuilderCanvas
              pageContent={pageContent}
              selectedElement={selectedElement}
              onSelectElement={setSelectedElement}
              onUpdateSection={handleUpdateSection}
              onDeleteSection={handleDeleteSection}
              onAddComponent={handleAddComponent}
              onUpdateComponent={handleUpdateComponent}
              onDeleteComponent={handleDeleteComponent}
              previewDevice={previewDevice}
            />
          </div>
        </div>

        {/* Right Sidebar - Settings Panel */}
        <div className="w-80 bg-white border-l overflow-y-auto">
          <SettingsPanel
            pageContent={pageContent}
            selectedElement={selectedElement}
            onUpdateSection={handleUpdateSection}
            onUpdateComponent={handleUpdateComponent}
            onUpdateGlobalStyles={(styles) => {
              setPageContent({
                ...pageContent,
                globalStyles: { ...pageContent.globalStyles, ...styles }
              });
            }}
          />
        </div>
      </div>

      {/* History Panel (Overlay) */}
      {showHistory && versionHistory && (
        <HistoryPanel
          versionHistory={versionHistory}
          onClose={() => setShowHistory(false)}
          onRestoreVersion={handleRestoreVersion}
        />
      )}
    </div>
  );
};
