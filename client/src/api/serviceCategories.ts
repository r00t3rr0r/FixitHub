import api from './api';

export interface ServiceCategory {
  _id: string;
  name: string;
  description: string;
  type: 'repair' | 'addon';
  icon: string;
  color: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryStatistics {
  _id: string;
  name: string;
  type: 'repair' | 'addon';
  color: string;
  icon: string;
  serviceCount: number;
  isActive: boolean;
}

export interface CreateCategoryData {
  name: string;
  description?: string;
  type: 'repair' | 'addon';
  icon?: string;
  color?: string;
  order?: number;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  order?: number;
}

export interface CategoryFilters {
  type?: 'repair' | 'addon';
  isActive?: boolean;
  search?: string;
}

// Description: Get all service categories with optional filtering
// Endpoint: GET /api/service-categories
// Request: { type?: 'repair' | 'addon', isActive?: boolean, search?: string }
// Response: { success: boolean, categories: Array<ServiceCategory> }
export const getServiceCategories = async (filters?: CategoryFilters) => {
  try {
    const response = await api.get('/api/service-categories', { params: filters });
    return response.data;
  } catch (error: any) {
    console.error('Error fetching service categories:', error);
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Get category statistics
// Endpoint: GET /api/service-categories/statistics
// Request: {}
// Response: { success: boolean, statistics: Array<CategoryStatistics> }
export const getCategoryStatistics = async () => {
  try {
    const response = await api.get('/api/service-categories/statistics');
    return response.data;
  } catch (error: any) {
    console.error('Error fetching category statistics:', error);
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Get a single category by ID
// Endpoint: GET /api/service-categories/:id
// Request: {}
// Response: { success: boolean, category: ServiceCategory }
export const getCategoryById = async (categoryId: string) => {
  try {
    const response = await api.get(`/api/service-categories/${categoryId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching category:', error);
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Create a new service category
// Endpoint: POST /api/service-categories
// Request: { name: string, description?: string, type: 'repair' | 'addon', icon?: string, color?: string, order?: number }
// Response: { success: boolean, category: ServiceCategory, message: string }
export const createServiceCategory = async (data: CreateCategoryData) => {
  try {
    const response = await api.post('/api/service-categories', data);
    return response.data;
  } catch (error: any) {
    console.error('Error creating category:', error);
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Update a service category
// Endpoint: PUT /api/service-categories/:id
// Request: { name?: string, description?: string, icon?: string, color?: string, order?: number }
// Response: { success: boolean, category: ServiceCategory, message: string }
export const updateServiceCategory = async (categoryId: string, data: UpdateCategoryData) => {
  try {
    const response = await api.put(`/api/service-categories/${categoryId}`, data);
    return response.data;
  } catch (error: any) {
    console.error('Error updating category:', error);
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Delete a service category
// Endpoint: DELETE /api/service-categories/:id
// Request: {}
// Response: { success: boolean, message: string }
export const deleteServiceCategory = async (categoryId: string) => {
  try {
    const response = await api.delete(`/api/service-categories/${categoryId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error deleting category:', error);
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Delete ALL service categories (admin only, password-protected)
// Endpoint: DELETE /api/service-categories
// Request: { password: string }
// Response: { success: boolean, deletedCount: number, message: string }
export const deleteAllServiceCategories = async (password: string) => {
  try {
    const response = await api.delete('/api/service-categories', { data: { password } });
    if (response.status >= 400) {
      throw new Error(response.data?.message || `Request failed with status ${response.status}`);
    }
    return response.data;
  } catch (error: any) {
    console.error('Error deleting all categories:', error);
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Deactivate a service category
// Endpoint: PUT /api/service-categories/:id/deactivate
// Request: {}
// Response: { success: boolean, category: ServiceCategory, message: string }
export const deactivateCategory = async (categoryId: string) => {
  try {
    const response = await api.put(`/api/service-categories/${categoryId}/deactivate`);
    return response.data;
  } catch (error: any) {
    console.error('Error deactivating category:', error);
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Activate a service category
// Endpoint: PUT /api/service-categories/:id/activate
// Request: {}
// Response: { success: boolean, category: ServiceCategory, message: string }
export const activateCategory = async (categoryId: string) => {
  try {
    const response = await api.put(`/api/service-categories/${categoryId}/activate`);
    return response.data;
  } catch (error: any) {
    console.error('Error activating category:', error);
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Reorder service categories
// Endpoint: PUT /api/service-categories/reorder
// Request: { categoryOrders: Array<{ categoryId: string, order: number }> }
// Response: { success: boolean, categories: Array<ServiceCategory>, message: string }
export const reorderCategories = async (categoryOrders: Array<{ categoryId: string, order: number }>) => {
  try {
    const response = await api.put('/api/service-categories/reorder', { categoryOrders });
    return response.data;
  } catch (error: any) {
    console.error('Error reordering categories:', error);
    throw new Error(error?.response?.data?.message || error.message);
  }
};
