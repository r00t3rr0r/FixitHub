import api from './api';

export interface FAQ {
  _id: string;
  question: string;
  answer: string;
  category: 'General' | 'Repairs' | 'Pricing' | 'Warranty' | 'Shipping' | 'Account' | 'Technical';
  order: number;
  isActive: boolean;
  tags: string[];
  views: number;
  helpful: number;
  notHelpful: number;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  updatedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface FAQCategory {
  name: string;
  count: number;
}

// Description: Get all FAQs with filtering
// Endpoint: GET /api/faqs
// Request: { category?: string, search?: string, isActive?: boolean, page?: number, limit?: number }
// Response: { faqs: FAQ[], groupedFAQs: Record<string, FAQ[]>, totalPages: number, currentPage: number, totalFAQs: number }
export const getFAQs = async (filters: any = {}) => {
  try {
    const response = await api.get('/api/faqs', { params: filters });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get single FAQ
// Endpoint: GET /api/faqs/:id
// Request: {}
// Response: { faq: FAQ }
export const getFAQ = async (id: string) => {
  try {
    const response = await api.get(`/api/faqs/${id}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create FAQ
// Endpoint: POST /api/faqs
// Request: { question: string, answer: string, category: string, order?: number, tags?: string[] }
// Response: { success: boolean, faq: FAQ }
export const createFAQ = async (faqData: Partial<FAQ>) => {
  try {
    const response = await api.post('/api/faqs', faqData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update FAQ
// Endpoint: PUT /api/faqs/:id
// Request: { question?: string, answer?: string, category?: string, order?: number, tags?: string[], isActive?: boolean }
// Response: { success: boolean, faq: FAQ }
export const updateFAQ = async (id: string, faqData: Partial<FAQ>) => {
  try {
    const response = await api.put(`/api/faqs/${id}`, faqData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete FAQ
// Endpoint: DELETE /api/faqs/:id
// Request: {}
// Response: { success: boolean, message: string }
export const deleteFAQ = async (id: string) => {
  try {
    const response = await api.delete(`/api/faqs/${id}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get FAQ categories
// Endpoint: GET /api/faqs/categories/list
// Request: {}
// Response: { categories: FAQCategory[] }
export const getFAQCategories = async () => {
  try {
    const response = await api.get('/api/faqs/categories/list');
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Mark FAQ as helpful/not helpful
// Endpoint: POST /api/faqs/:id/helpful
// Request: { isHelpful: boolean }
// Response: { success: boolean, helpful: number, notHelpful: number }
export const markFAQHelpful = async (id: string, isHelpful: boolean) => {
  try {
    const response = await api.post(`/api/faqs/${id}/helpful`, { isHelpful });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};