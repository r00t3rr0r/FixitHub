import api from './api';

export interface ContentBlock {
  _id: string;
  type: 'hero' | 'services' | 'testimonials' | 'cta' | 'gallery' | 'banner' | 'features' | 'stats' | 'html';
  title: string;
  content: any;
  settings: {
    backgroundColor?: string;
    textColor?: string;
    padding?: string;
    margin?: string;
    alignment?: 'left' | 'center' | 'right';
    animation?: string;
    customCSS?: string;
  };
  order: number;
  isVisible: boolean;
}

export interface HomepageSection {
  _id: string;
  name: string;
  blocks: ContentBlock[];
  layout: 'single' | 'two-column' | 'three-column' | 'grid';
  order: number;
  isActive: boolean;
}

export interface LayoutTemplate {
  _id: string;
  name: string;
  description: string;
  preview: string;
  sections: HomepageSection[];
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    fontSize: string;
  };
  isDefault: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ABTestVariant {
  _id: string;
  name: string;
  description: string;
  template: LayoutTemplate;
  trafficPercentage: number;
  conversions: number;
  views: number;
  conversionRate: number;
  isActive: boolean;
}

export interface ABTest {
  _id: string;
  name: string;
  description: string;
  variants: ABTestVariant[];
  status: 'draft' | 'running' | 'paused' | 'completed';
  startDate: string;
  endDate?: string;
  goal: string;
  winner?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Description: Get homepage sections and content blocks
// Endpoint: GET /api/admin/homepage/sections
// Request: {}
// Response: { success: boolean, sections: HomepageSection[] }
export const getHomepageSections = async () => {
  try {
    const response = await api.get('/api/admin/homepage/sections');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get available content block templates
// Endpoint: GET /api/admin/homepage/content-blocks
// Request: {}
// Response: { success: boolean, blocks: ContentBlock[] }
export const getContentBlockTemplates = async () => {
  try {
    const response = await api.get('/api/admin/homepage/content-blocks');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get layout templates
// Endpoint: GET /api/admin/homepage/templates
// Request: {}
// Response: { success: boolean, templates: LayoutTemplate[] }
export const getLayoutTemplates = async () => {
  try {
    const response = await api.get('/api/admin/homepage/templates');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Save homepage sections
// Endpoint: PUT /api/admin/homepage/sections
// Request: { sections: HomepageSection[] }
// Response: { success: boolean, message: string }
export const saveHomepageSections = async (sections: HomepageSection[]) => {
  try {
    const response = await api.put('/api/admin/homepage/sections', { sections });
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get A/B tests
// Endpoint: GET /api/admin/homepage/ab-tests
// Request: {}
// Response: { success: boolean, tests: ABTest[] }
export const getABTests = async () => {
  try {
    const response = await api.get('/api/admin/homepage/ab-tests');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create A/B test
// Endpoint: POST /api/admin/homepage/ab-tests
// Request: Partial<ABTest>
// Response: { success: boolean, test: ABTest }
export const createABTest = async (testData: Partial<ABTest>) => {
  try {
    const response = await api.post('/api/admin/homepage/ab-tests', testData);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create layout template
// Endpoint: POST /api/admin/homepage/templates
// Request: Partial<LayoutTemplate>
// Response: { success: boolean, template: LayoutTemplate }
export const createLayoutTemplate = async (templateData: Partial<LayoutTemplate>) => {
  try {
    const response = await api.post('/api/admin/homepage/templates', templateData);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update layout template
// Endpoint: PUT /api/admin/homepage/templates/:id
// Request: Partial<LayoutTemplate>
// Response: { success: boolean, template: LayoutTemplate }
export const updateLayoutTemplate = async (templateId: string, templateData: Partial<LayoutTemplate>) => {
  try {
    const response = await api.put(`/api/admin/homepage/templates/${templateId}`, templateData);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete layout template
// Endpoint: DELETE /api/admin/homepage/templates/:id
// Request: {}
// Response: { success: boolean, message: string }
export const deleteLayoutTemplate = async (templateId: string) => {
  try {
    const response = await api.delete(`/api/admin/homepage/templates/${templateId}`);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Set default template
// Endpoint: POST /api/admin/homepage/templates/:id/set-default
// Request: {}
// Response: { success: boolean, template: LayoutTemplate }
export const setDefaultTemplate = async (templateId: string) => {
  try {
    const response = await api.post(`/api/admin/homepage/templates/${templateId}/set-default`);
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};