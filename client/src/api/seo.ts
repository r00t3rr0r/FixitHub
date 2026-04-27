import api from './api';

// SEO Settings Interface
export interface SEOSettings {
  _id?: string;
  pageType: 'global' | 'homepage' | 'blog_post' | 'product' | 'service' | 'page';
  pageId: string;
  title: string;
  description: string;
  keywords: string[];
  canonicalUrl: string;
  openGraph: {
    title: string;
    description: string;
    image: string;
    type: string;
    url: string;
  };
  twitterCard: {
    card: 'summary' | 'summary_large_image' | 'app' | 'player';
    title: string;
    description: string;
    image: string;
  };
  schemaMarkup: Record<string, any>;
  robots: {
    index: boolean;
    follow: boolean;
    noarchive: boolean;
    nosnippet: boolean;
  };
  priority: number;
  changeFreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  isActive: boolean;
  createdBy?: {
    _id: string;
    name: string;
    email: string;
  };
  updatedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

// Get SEO settings by page type and ID
// Description: Retrieve SEO settings for a specific page
// Endpoint: GET /api/seo/settings?pageType=...&pageId=...
// Response: { success: boolean, settings: SEOSettings }
export const getSEOSettings = async (pageType: string, pageId: string = '') => {
  try {
    const response = await api.get('/api/seo/settings', {
      params: { pageType, pageId }
    });
    return response.data;
  } catch (error) {
    console.error('Error getting SEO settings:', error);
    throw error;
  }
};

// Get all SEO settings with filtering
// Description: Retrieve all SEO settings with pagination and filtering
// Endpoint: GET /api/seo/all?pageType=...&search=...&page=...&limit=...
// Response: { success: boolean, settings: SEOSettings[], totalPages: number, currentPage: number, totalSettings: number }
export const getAllSEOSettings = async (filters: {
  pageType?: string;
  search?: string;
  page?: number;
  limit?: number;
} = {}) => {
  try {
    const response = await api.get('/api/seo/all', {
      params: filters
    });
    return response.data;
  } catch (error) {
    console.error('Error getting all SEO settings:', error);
    throw error;
  }
};

// Create or update SEO settings
// Description: Create or update SEO settings for a specific page
// Endpoint: POST /api/seo/settings
// Request: { pageType, pageId?, title, description, keywords?, canonicalUrl?, openGraph?, twitterCard?, schemaMarkup?, robots?, priority?, changeFreq?, isActive? }
// Response: { success: boolean, message: string, settings: SEOSettings }
export const upsertSEOSettings = async (data: Partial<SEOSettings> & { pageType: string }) => {
  try {
    const response = await api.post('/api/seo/settings', data);
    return response.data;
  } catch (error) {
    console.error('Error upserting SEO settings:', error);
    throw error;
  }
};

// Delete SEO settings
// Description: Delete SEO settings by ID
// Endpoint: DELETE /api/seo/settings/:id
// Response: { success: boolean, message: string }
export const deleteSEOSettings = async (id: string) => {
  try {
    const response = await api.delete(`/api/seo/settings/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting SEO settings:', error);
    throw error;
  }
};

// Get sitemap data
// Description: Retrieve sitemap data for all pages
// Endpoint: GET /api/seo/sitemap
// Response: { success: boolean, sitemap: Array<{ url: string, lastModified: Date, changeFrequency: string, priority: number }> }
export const getSitemapData = async () => {
  try {
    const response = await api.get('/api/seo/sitemap');
    return response.data;
  } catch (error) {
    console.error('Error getting sitemap data:', error);
    throw error;
  }
};

// Get SEO analytics
// Description: Retrieve SEO analytics and statistics
// Endpoint: GET /api/seo/analytics
// Response: { success: boolean, analytics: { totalPages, indexablePages, nonIndexablePages, pageTypeBreakdown, lastUpdated } }
export const getSEOAnalytics = async () => {
  try {
    const response = await api.get('/api/seo/analytics');
    return response.data;
  } catch (error) {
    console.error('Error getting SEO analytics:', error);
    throw error;
  }
};
