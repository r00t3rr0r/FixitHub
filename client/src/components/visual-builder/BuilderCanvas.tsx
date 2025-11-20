import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Trash2,
  Plus,
  GripVertical,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Settings,
  Image as ImageIcon
} from 'lucide-react';
import type { PageContent, Section, Component } from '@/api/pageContent';

interface BuilderCanvasProps {
  pageContent: PageContent;
  selectedElement: {
    type: 'section' | 'component';
    sectionId?: string;
    componentId?: string;
  } | null;
  onSelectElement: (element: {
    type: 'section' | 'component';
    sectionId?: string;
    componentId?: string;
  }) => void;
  onUpdateSection: (sectionId: string, updates: Partial<Section>) => void;
  onDeleteSection: (sectionId: string) => void;
  onAddComponent: (sectionId: string, componentType: Component['type']) => void;
  onUpdateComponent: (sectionId: string, componentId: string, updates: Partial<Component>) => void;
  onDeleteComponent: (sectionId: string, componentId: string) => void;
  previewDevice: 'desktop' | 'tablet' | 'mobile';
}

export const BuilderCanvas: React.FC<BuilderCanvasProps> = ({
  pageContent,
  selectedElement,
  onSelectElement,
  onUpdateSection,
  onDeleteSection,
  onAddComponent,
  onUpdateComponent,
  onDeleteComponent,
  previewDevice
}) => {
  const isSelected = (type: 'section' | 'component', sectionId?: string, componentId?: string) => {
    if (!selectedElement) return false;
    if (type === 'section') {
      return selectedElement.type === 'section' && selectedElement.sectionId === sectionId;
    }
    return (
      selectedElement.type === 'component' &&
      selectedElement.sectionId === sectionId &&
      selectedElement.componentId === componentId
    );
  };

  // Convert styles object to CSS string
  const stylesToCSS = (styles: any = {}) => {
    const cssObj: any = {};

    if (styles.backgroundColor) cssObj.backgroundColor = styles.backgroundColor;
    if (styles.backgroundImage) cssObj.backgroundImage = styles.backgroundImage;
    if (styles.color) cssObj.color = styles.color;
    if (styles.fontSize) cssObj.fontSize = typeof styles.fontSize === 'number' ? `${styles.fontSize}px` : styles.fontSize;
    if (styles.fontWeight) cssObj.fontWeight = styles.fontWeight;
    if (styles.textAlign) cssObj.textAlign = styles.textAlign;
    if (styles.marginBottom) cssObj.marginBottom = typeof styles.marginBottom === 'number' ? `${styles.marginBottom}px` : styles.marginBottom;
    if (styles.lineHeight) cssObj.lineHeight = styles.lineHeight;
    if (styles.minHeight) cssObj.minHeight = styles.minHeight;
    if (styles.maxWidth) cssObj.maxWidth = styles.maxWidth;
    if (styles.borderRadius) cssObj.borderRadius = typeof styles.borderRadius === 'number' ? `${styles.borderRadius}px` : styles.borderRadius;
    if (styles.boxShadow) cssObj.boxShadow = styles.boxShadow;
    if (styles.display) cssObj.display = styles.display;
    if (styles.flexDirection) cssObj.flexDirection = styles.flexDirection;
    if (styles.justifyContent) cssObj.justifyContent = styles.justifyContent;
    if (styles.alignItems) cssObj.alignItems = styles.alignItems;
    if (styles.gridTemplateColumns) cssObj.gridTemplateColumns = styles.gridTemplateColumns;
    if (styles.gap) cssObj.gap = typeof styles.gap === 'number' ? `${styles.gap}px` : styles.gap;

    if (styles.padding) {
      if (typeof styles.padding === 'object') {
        cssObj.padding = `${styles.padding.top || 0}px ${styles.padding.right || 0}px ${styles.padding.bottom || 0}px ${styles.padding.left || 0}px`;
      } else {
        cssObj.padding = styles.padding;
      }
    }

    if (styles.margin) {
      if (typeof styles.margin === 'object') {
        cssObj.margin = `${styles.margin.top || 0}px ${styles.margin.right || 0}px ${styles.margin.bottom || 0}px ${styles.margin.left || 0}px`;
      } else {
        cssObj.margin = styles.margin;
      }
    }

    return cssObj;
  };

  const renderComponent = (component: Component, sectionId: string) => {
    const selected = isSelected('component', sectionId, component.id);
    const componentStyles = stylesToCSS(component.styles);

    // Render component based on type
    let componentContent;
    switch (component.type) {
      case 'heading':
        const HeadingTag = (component.content?.level || 'h2') as keyof JSX.IntrinsicElements;
        componentContent = (
          <HeadingTag style={componentStyles}>
            {component.content?.text || 'Heading'}
          </HeadingTag>
        );
        break;

      case 'paragraph':
      case 'text':
        componentContent = (
          <p style={componentStyles}>
            {component.content?.text || 'Text content'}
          </p>
        );
        break;

      case 'button':
        componentContent = (
          <div className="flex" style={{ justifyContent: component.styles?.textAlign || 'flex-start' }}>
            <Button
              variant={component.content?.variant || 'default'}
              style={componentStyles}
            >
              {component.content?.text || 'Button'}
            </Button>
          </div>
        );
        break;

      case 'image':
        if (component.content?.src) {
          componentContent = (
            <div style={componentStyles}>
              <img
                src={component.content.src}
                alt={component.content?.alt || 'Image'}
                className="max-w-full h-auto"
                onError={(e) => {
                  // Fallback to SVG placeholder on error
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.parentElement!.innerHTML = `
                    <div class="bg-gray-100 border-2 border-dashed border-gray-300 rounded p-12 text-center flex flex-col items-center justify-center" style="min-height: 200px;">
                      <svg class="w-16 h-16 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p class="text-sm text-gray-500">Image failed to load</p>
                    </div>
                  `;
                }}
              />
            </div>
          );
        } else {
          componentContent = (
            <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded p-12 text-center" style={componentStyles}>
              <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Click to add image</p>
            </div>
          );
        }
        break;

      case 'video':
        componentContent = (
          <div className="bg-gray-900 aspect-video flex items-center justify-center text-white rounded" style={componentStyles}>
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">Video Player</p>
            </div>
          </div>
        );
        break;

      case 'divider':
        componentContent = <hr className="my-4 border-gray-300" style={componentStyles} />;
        break;

      case 'spacer':
        componentContent = <div style={{ height: componentStyles.height || '32px', ...componentStyles }} />;
        break;

      case 'container':
      case 'section':
        componentContent = (
          <div style={componentStyles}>
            {component.content?.text || (
              <div className="border-2 border-dashed border-gray-300 rounded p-8 text-center text-gray-500">
                {component.type.toUpperCase()} Container - Add components here
              </div>
            )}
          </div>
        );
        break;

      case 'form':
        componentContent = (
          <div className="border-2 border-dashed border-gray-300 rounded p-8" style={componentStyles}>
            <p className="text-gray-500 text-center mb-4">Contact Form</p>
            <div className="space-y-4 max-w-md mx-auto">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <div className="h-10 bg-gray-100 border rounded"></div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <div className="h-10 bg-gray-100 border rounded"></div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Message</label>
                <div className="h-24 bg-gray-100 border rounded"></div>
              </div>
              <div className="h-10 bg-blue-500 rounded text-center leading-10 text-white">Submit</div>
            </div>
          </div>
        );
        break;

      default:
        componentContent = (
          <div className="border-2 border-dashed border-gray-300 rounded p-4 text-center text-gray-400" style={componentStyles}>
            {component.type} component
          </div>
        );
    }

    return (
      <div
        key={component.id}
        className={`relative group ${selected ? 'ring-2 ring-primary' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelectElement({ type: 'component', sectionId, componentId: component.id });
        }}
        style={component.hidden ? { opacity: 0.5 } : {}}
      >
        {/* Component Toolbar */}
        <div className={`absolute top-0 right-0 -mt-8 flex gap-1 z-10 ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
          <Button
            size="sm"
            variant="secondary"
            className="h-6 px-2"
            onClick={(e) => {
              e.stopPropagation();
              onUpdateComponent(sectionId, component.id, { hidden: !component.hidden });
            }}
          >
            {component.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-6 px-2"
            onClick={(e) => {
              e.stopPropagation();
              onUpdateComponent(sectionId, component.id, { locked: !component.locked });
            }}
          >
            {component.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-6 px-2"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this component?')) {
                onDeleteComponent(sectionId, component.id);
              }
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {/* Component Label */}
        {selected && (
          <div className="absolute top-0 left-0 -mt-8 text-xs bg-primary text-white px-2 py-1 rounded z-10">
            {component.type}
          </div>
        )}

        {/* Component Content */}
        <div className="p-2">
          {componentContent}
        </div>
      </div>
    );
  };

  const renderSection = (section: Section) => {
    const selected = isSelected('section', section.id);
    const sectionStyles = stylesToCSS(section.styles);

    return (
      <div
        key={section.id}
        className={`relative group mb-4 ${selected ? 'ring-2 ring-primary ring-offset-2' : 'border border-gray-200'} rounded-lg transition-all overflow-hidden`}
        onClick={(e) => {
          e.stopPropagation();
          onSelectElement({ type: 'section', sectionId: section.id });
        }}
      >
        {/* Section Header */}
        <div className={`flex items-center justify-between p-2 border-b bg-gray-50 ${selected ? 'bg-primary/5' : ''}`}>
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
            <span className="text-sm font-medium">{section.name}</span>
            <span className="text-xs text-gray-500">({section.components.length} components)</span>
          </div>

          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={(e) => {
                e.stopPropagation();
                onAddComponent(section.id, 'text');
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Delete this section and all its components?')) {
                  onDeleteSection(section.id);
                }
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Section Content */}
        <div style={sectionStyles}>
          <div className={section.containerMaxWidth ? 'mx-auto' : ''} style={{ maxWidth: section.containerMaxWidth || 'none', width: '100%' }}>
            {section.components.length > 0 ? (
              <div className="space-y-4 p-4">
                {section.components
                  .sort((a, b) => (a.order || 0) - (b.order || 0))
                  .map((component) => renderComponent(component, section.id))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded text-gray-400 m-4">
                <div className="text-center">
                  <Plus className="h-6 w-6 mx-auto mb-2" />
                  <p className="text-sm">Click "Add" or drag components here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-full">
      {pageContent.sections.length > 0 ? (
        <div>
          {pageContent.sections
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map((section) => renderSection(section))}
        </div>
      ) : (
        <Card className="p-12 text-center m-4">
          <div className="text-gray-400 mb-4">
            <Plus className="h-16 w-16 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No sections yet</h3>
            <p className="text-sm">Add a section from the left panel to get started</p>
          </div>
        </Card>
      )}
    </div>
  );
};
