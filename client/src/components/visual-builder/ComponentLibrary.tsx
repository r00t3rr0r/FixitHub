import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Type,
  Image,
  Video,
  Square,
  List,
  Table,
  Columns,
  Grid,
  Layout,
  AlignLeft,
  MousePointer,
  Star,
  Map,
  Code,
  Minus,
  Space,
  Menu,
  FileText,
  ChevronDown,
  Plus
} from 'lucide-react';
import type { Section, Component } from '@/api/pageContent';

interface ComponentLibraryProps {
  onAddSection: (type: Section['type']) => void;
  onAddComponent: (type: Component['type']) => void;
}

export const ComponentLibrary: React.FC<ComponentLibraryProps> = ({
  onAddSection,
  onAddComponent
}) => {
  const [activeTab, setActiveTab] = useState('components');

  const sections = [
    { type: 'hero' as const, label: 'Hero', icon: Layout, description: 'Header section with hero content' },
    { type: 'features' as const, label: 'Features', icon: Grid, description: 'Feature showcase section' },
    { type: 'gallery' as const, label: 'Gallery', icon: Image, description: 'Image gallery section' },
    { type: 'cta' as const, label: 'Call to Action', icon: MousePointer, description: 'CTA section' },
    { type: 'contact' as const, label: 'Contact', icon: FileText, description: 'Contact form section' },
    { type: 'footer' as const, label: 'Footer', icon: Menu, description: 'Footer section' },
    { type: 'custom' as const, label: 'Custom', icon: Square, description: 'Blank custom section' }
  ];

  const basicComponents = [
    { type: 'heading' as const, label: 'Heading', icon: Type, description: 'H1-H6 headings' },
    { type: 'paragraph' as const, label: 'Paragraph', icon: AlignLeft, description: 'Text paragraph' },
    { type: 'text' as const, label: 'Text', icon: Type, description: 'Simple text' },
    { type: 'button' as const, label: 'Button', icon: MousePointer, description: 'Clickable button' },
    { type: 'image' as const, label: 'Image', icon: Image, description: 'Image element' },
    { type: 'icon' as const, label: 'Icon', icon: Star, description: 'Icon element' }
  ];

  const mediaComponents = [
    { type: 'video' as const, label: 'Video', icon: Video, description: 'Video player' },
    { type: 'gallery' as const, label: 'Gallery', icon: Grid, description: 'Image gallery' },
    { type: 'slideshow' as const, label: 'Slideshow', icon: Image, description: 'Image slideshow' }
  ];

  const layoutComponents = [
    { type: 'container' as const, label: 'Container', icon: Square, description: 'Container wrapper' },
    { type: 'section' as const, label: 'Section', icon: Layout, description: 'Section wrapper' },
    { type: 'row' as const, label: 'Row', icon: Columns, description: 'Horizontal row' },
    { type: 'column' as const, label: 'Column', icon: Columns, description: 'Column layout' },
    { type: 'divider' as const, label: 'Divider', icon: Minus, description: 'Horizontal divider' },
    { type: 'spacer' as const, label: 'Spacer', icon: Space, description: 'Empty space' }
  ];

  const advancedComponents = [
    { type: 'form' as const, label: 'Form', icon: FileText, description: 'Form with fields' },
    { type: 'card' as const, label: 'Card', icon: Square, description: 'Card container' },
    { type: 'list' as const, label: 'List', icon: List, description: 'List of items' },
    { type: 'table' as const, label: 'Table', icon: Table, description: 'Data table' },
    { type: 'accordion' as const, label: 'Accordion', icon: ChevronDown, description: 'Collapsible accordion' },
    { type: 'tabs' as const, label: 'Tabs', icon: Menu, description: 'Tabbed content' },
    { type: 'map' as const, label: 'Map', icon: Map, description: 'Google Maps' },
    { type: 'html' as const, label: 'HTML', icon: Code, description: 'Custom HTML' }
  ];

  const DraggableItem = ({ item, onClick }: { item: any; onClick: () => void }) => {
    const Icon = item.icon;
    return (
      <Card
        className="p-3 mb-2 cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all group"
        onClick={onClick}
      >
        <div className="flex items-start gap-2">
          <div className="p-2 bg-primary/10 rounded-md group-hover:bg-primary/20 transition-colors">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">{item.label}</div>
            <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-lg">Components</h3>
        <p className="text-sm text-gray-500 mt-1">Drag or click to add</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full grid grid-cols-2 mx-4 mt-2">
          <TabsTrigger value="components">Elements</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 px-4 py-4">
          <TabsContent value="components" className="mt-0 space-y-4">
            {/* Basic Components */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Basic</h4>
              {basicComponents.map((component) => (
                <DraggableItem
                  key={component.type}
                  item={component}
                  onClick={() => onAddComponent(component.type)}
                />
              ))}
            </div>

            {/* Media Components */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Media</h4>
              {mediaComponents.map((component) => (
                <DraggableItem
                  key={component.type}
                  item={component}
                  onClick={() => onAddComponent(component.type)}
                />
              ))}
            </div>

            {/* Layout Components */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Layout</h4>
              {layoutComponents.map((component) => (
                <DraggableItem
                  key={component.type}
                  item={component}
                  onClick={() => onAddComponent(component.type)}
                />
              ))}
            </div>

            {/* Advanced Components */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Advanced</h4>
              {advancedComponents.map((component) => (
                <DraggableItem
                  key={component.type}
                  item={component}
                  onClick={() => onAddComponent(component.type)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="sections" className="mt-0">
            <div className="space-y-2">
              {sections.map((section) => (
                <Card
                  key={section.type}
                  className="p-3 cursor-pointer hover:bg-gray-50 hover:shadow-md transition-all group"
                  onClick={() => onAddSection(section.type)}
                >
                  <div className="flex items-start gap-2">
                    <div className="p-2 bg-primary/10 rounded-md group-hover:bg-primary/20 transition-colors">
                      <section.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{section.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{section.description}</div>
                    </div>
                    <Plus className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
};
