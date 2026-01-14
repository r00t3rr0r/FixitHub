import api from './api';

// Type definitions for component styles
export interface ComponentStyle {
  // Layout & Positioning
  width?: string;
  height?: string;
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  position?: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  zIndex?: number;

  // Display & Flexbox
  display?: 'block' | 'inline-block' | 'flex' | 'inline-flex' | 'grid' | 'none';
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'baseline' | 'stretch';
  flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  gap?: string;

  // Background
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: 'auto' | 'cover' | 'contain';
  backgroundPosition?: string;
  backgroundRepeat?: 'repeat' | 'no-repeat' | 'repeat-x' | 'repeat-y';
  backgroundAttachment?: 'scroll' | 'fixed' | 'local';
  gradient?: string;

  // Border
  border?: string;
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
  borderRadius?: string;
  borderColor?: string;
  borderWidth?: string;
  borderStyle?: 'none' | 'solid' | 'dashed' | 'dotted' | 'double';

  // Typography
  fontSize?: string;
  fontWeight?: '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | 'normal' | 'bold';
  fontFamily?: string;
  lineHeight?: string;
  letterSpacing?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  textDecoration?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  color?: string;

  // Effects
  opacity?: number;
  boxShadow?: string;
  textShadow?: string;
  filter?: string;
  backdropFilter?: string;
  transform?: string;
  transition?: string;

  // Overflow
  overflow?: 'visible' | 'hidden' | 'scroll' | 'auto';
  overflowX?: 'visible' | 'hidden' | 'scroll' | 'auto';
  overflowY?: 'visible' | 'hidden' | 'scroll' | 'auto';

  // Custom CSS
  customCSS?: string;

  // Hover Effect
  hoverEffect?: string;
}

export interface ResponsiveStyles {
  mobile?: ComponentStyle;
  tablet?: ComponentStyle;
  desktop?: ComponentStyle;
}

export interface ComponentAnimation {
  type?: 'none' | 'fade' | 'slide' | 'zoom' | 'bounce' | 'rotate' | 'flip';
  duration?: number;
  delay?: number;
  easing?: string;
  trigger?: 'load' | 'scroll' | 'hover' | 'click';
  scrollOffset?: number;
  repeat?: boolean;
}

export interface ComponentStateStyles {
  hover?: ComponentStyle;
  active?: ComponentStyle;
  focus?: ComponentStyle;
}

export interface Component {
  id: string;
  type: 'text' | 'heading' | 'paragraph' | 'image' | 'gallery' | 'slideshow' |
    'button' | 'icon' | 'video' | 'form' | 'card' | 'list' | 'table' |
    'accordion' | 'tabs' | 'map' | 'html' | 'section' | 'container' |
    'column' | 'row' | 'divider' | 'spacer' | 'navbar' | 'footer';
  name?: string;
  content?: any;
  styles?: ComponentStyle;
  responsiveStyles?: ResponsiveStyles;
  stateStyles?: ComponentStateStyles;
  animation?: ComponentAnimation;
  visibility?: {
    desktop?: boolean;
    tablet?: boolean;
    mobile?: boolean;
  };
  parentId?: string | null;
  order?: number;
  children?: string[];
  locked?: boolean;
  hidden?: boolean;
  className?: string;
  customAttributes?: any;
}

export interface Section {
  id: string;
  name: string;
  type: 'hero' | 'features' | 'gallery' | 'cta' | 'contact' | 'footer' | 'custom';
  components: Component[];
  styles?: ComponentStyle;
  responsiveStyles?: ResponsiveStyles;
  backgroundVideo?: string;
  parallax?: boolean;
  order?: number;
  isFullWidth?: boolean;
  containerMaxWidth?: string;
}

export interface PageContent {
  _id?: string;
  pageId: string;
  pageTitle: string;
  pageSlug: string;
  sections: Section[];
  globalStyles?: {
    backgroundColor?: string;
    backgroundImage?: string;
    fontFamily?: string;
    colorScheme?: {
      primary?: string;
      secondary?: string;
      accent?: string;
      text?: string;
      background?: string;
    };
  };
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string[];
    ogImage?: string;
    ogTitle?: string;
    ogDescription?: string;
  };
  customCSS?: string;
  customJS?: string;
  customHeadHTML?: string;
  version?: number;
  isDraft?: boolean;
  publishedVersion?: number;
  lastPublished?: Date;
  history?: any[];
  createdAt?: Date;
  updatedAt?: Date;
}

// Description: Get all pages list
// Endpoint: GET /api/page-content
// Request: {}
// Response: { pages: Array<PageContent> }
export const getAllPages = async () => {
  try {
    const response = await api.get('/api/page-content');
    return response.data;
  } catch (error: any) {
    console.error('Error fetching pages:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get page content by page ID
// Endpoint: GET /api/page-content/:pageId
// Request: {}
// Response: { pageContent: PageContent }
export const getPageContent = async (pageId: string) => {
  try {
    const response = await api.get(`/api/page-content/${pageId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching page content:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create new page content
// Endpoint: POST /api/page-content
// Request: { pageId, pageTitle, pageSlug, sections?, globalStyles?, seo?, customCSS?, customJS? }
// Response: { pageContent: PageContent }
export const createPageContent = async (data: Partial<PageContent>) => {
  try {
    const response = await api.post('/api/page-content', data);
    return response.data;
  } catch (error: any) {
    console.error('Error creating page content:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update page content
// Endpoint: PUT /api/page-content/:pageId
// Request: { sections?, globalStyles?, seo?, customCSS?, customJS?, ... }
// Response: { pageContent: PageContent }
export const updatePageContent = async (pageId: string, data: Partial<PageContent>) => {
  try {
    const response = await api.put(`/api/page-content/${pageId}`, data);
    return response.data;
  } catch (error: any) {
    console.error('Error updating page content:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete page content
// Endpoint: DELETE /api/page-content/:pageId
// Request: {}
// Response: { success: boolean, message: string }
export const deletePageContent = async (pageId: string) => {
  try {
    const response = await api.delete(`/api/page-content/${pageId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error deleting page content:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Duplicate page
// Endpoint: POST /api/page-content/:pageId/duplicate
// Request: { pageId, pageTitle, pageSlug }
// Response: { pageContent: PageContent }
export const duplicatePageContent = async (pageId: string, data: { pageId: string; pageTitle: string; pageSlug: string }) => {
  try {
    const response = await api.post(`/api/page-content/${pageId}/duplicate`, data);
    return response.data;
  } catch (error: any) {
    console.error('Error duplicating page:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Publish page
// Endpoint: POST /api/page-content/:pageId/publish
// Request: {}
// Response: { pageContent: PageContent, message: string }
export const publishPage = async (pageId: string) => {
  try {
    const response = await api.post(`/api/page-content/${pageId}/publish`);
    return response.data;
  } catch (error: any) {
    console.error('Error publishing page:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Add section to page
// Endpoint: POST /api/page-content/:pageId/sections
// Request: { id?, name, type, components?, styles? }
// Response: { pageContent: PageContent }
export const addSection = async (pageId: string, data: Partial<Section>) => {
  try {
    const response = await api.post(`/api/page-content/${pageId}/sections`, data);
    return response.data;
  } catch (error: any) {
    console.error('Error adding section:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update section
// Endpoint: PUT /api/page-content/:pageId/sections/:sectionId
// Request: { name?, type?, components?, styles?, ... }
// Response: { pageContent: PageContent }
export const updateSection = async (pageId: string, sectionId: string, data: Partial<Section>) => {
  try {
    const response = await api.put(`/api/page-content/${pageId}/sections/${sectionId}`, data);
    return response.data;
  } catch (error: any) {
    console.error('Error updating section:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete section
// Endpoint: DELETE /api/page-content/:pageId/sections/:sectionId
// Request: {}
// Response: { pageContent: PageContent }
export const deleteSection = async (pageId: string, sectionId: string) => {
  try {
    const response = await api.delete(`/api/page-content/${pageId}/sections/${sectionId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error deleting section:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Reorder sections
// Endpoint: POST /api/page-content/:pageId/sections/reorder
// Request: { sectionIds: Array<string> }
// Response: { pageContent: PageContent }
export const reorderSections = async (pageId: string, sectionIds: string[]) => {
  try {
    const response = await api.post(`/api/page-content/${pageId}/sections/reorder`, { sectionIds });
    return response.data;
  } catch (error: any) {
    console.error('Error reordering sections:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Add component to section
// Endpoint: POST /api/page-content/:pageId/sections/:sectionId/components
// Request: { id?, type, name?, content?, styles?, parentId? }
// Response: { pageContent: PageContent }
export const addComponent = async (pageId: string, sectionId: string, data: Partial<Component>) => {
  try {
    const response = await api.post(`/api/page-content/${pageId}/sections/${sectionId}/components`, data);
    return response.data;
  } catch (error: any) {
    console.error('Error adding component:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update component
// Endpoint: PUT /api/page-content/:pageId/sections/:sectionId/components/:componentId
// Request: { type?, name?, content?, styles?, ... }
// Response: { pageContent: PageContent }
export const updateComponent = async (pageId: string, sectionId: string, componentId: string, data: Partial<Component>) => {
  try {
    const response = await api.put(`/api/page-content/${pageId}/sections/${sectionId}/components/${componentId}`, data);
    return response.data;
  } catch (error: any) {
    console.error('Error updating component:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete component
// Endpoint: DELETE /api/page-content/:pageId/sections/:sectionId/components/:componentId
// Request: {}
// Response: { pageContent: PageContent }
export const deleteComponent = async (pageId: string, sectionId: string, componentId: string) => {
  try {
    const response = await api.delete(`/api/page-content/${pageId}/sections/${sectionId}/components/${componentId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error deleting component:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Reorder components
// Endpoint: POST /api/page-content/:pageId/sections/:sectionId/components/reorder
// Request: { componentIds: Array<string> }
// Response: { pageContent: PageContent }
export const reorderComponents = async (pageId: string, sectionId: string, componentIds: string[]) => {
  try {
    const response = await api.post(`/api/page-content/${pageId}/sections/${sectionId}/components/reorder`, { componentIds });
    return response.data;
  } catch (error: any) {
    console.error('Error reordering components:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create version snapshot
// Endpoint: POST /api/page-content/:pageId/versions
// Request: { action?: string }
// Response: { pageContent: PageContent }
export const createVersion = async (pageId: string, action?: string) => {
  try {
    const response = await api.post(`/api/page-content/${pageId}/versions`, { action });
    return response.data;
  } catch (error: any) {
    console.error('Error creating version:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get version history
// Endpoint: GET /api/page-content/:pageId/versions
// Request: {}
// Response: { currentVersion: number, history: Array<Version> }
export const getVersionHistory = async (pageId: string) => {
  try {
    const response = await api.get(`/api/page-content/${pageId}/versions`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching version history:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Restore from version
// Endpoint: POST /api/page-content/:pageId/versions/:versionIndex/restore
// Request: {}
// Response: { pageContent: PageContent, message: string }
export const restoreVersion = async (pageId: string, versionIndex: number) => {
  try {
    const response = await api.post(`/api/page-content/${pageId}/versions/${versionIndex}/restore`);
    return response.data;
  } catch (error: any) {
    console.error('Error restoring version:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
