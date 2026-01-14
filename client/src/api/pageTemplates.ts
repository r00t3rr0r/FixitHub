import api from './api';

export interface PageTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  thumbnail: string;
  preview: string;
}

export interface TemplateData {
  pageTitle: string;
  pageSlug: string;
  sections: any[];
  globalStyles: any;
}

// Description: Get all available page templates
// Endpoint: GET /api/page-templates
// Request: {}
// Response: { success: boolean, templates: Array<PageTemplate> }
export const getPageTemplates = async (): Promise<{ templates: PageTemplate[] }> => {
  try {
    const response = await api.get('/api/page-templates');
    return response.data;
  } catch (error: any) {
    console.error('Error fetching page templates:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get template by ID
// Endpoint: GET /api/page-templates/:templateId
// Request: { templateId: string }
// Response: { success: boolean, template: TemplateData }
export const getPageTemplate = async (templateId: string): Promise<{ template: TemplateData }> => {
  try {
    const response = await api.get(`/api/page-templates/${templateId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching page template:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Apply template to page
// Endpoint: POST /api/page-templates/apply
// Request: { pageId: string, templateId: string }
// Response: { success: boolean, message: string }
export const applyTemplate = async (pageId: string, templateId: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await api.post('/api/page-templates/apply', {
      pageId,
      templateId
    });
    return response.data;
  } catch (error: any) {
    console.error('Error applying template:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
