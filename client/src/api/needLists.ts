import api from './api';

export interface NeedListItem {
  _id?: string;
  part: string;
  partNumber: string;
  partName: string;
  quantity: number;
  currentStock: number;
  notes?: string;
}

export interface NeedList {
  _id: string;
  name: string;
  description?: string;
  items: NeedListItem[];
  status: 'draft' | 'ready' | 'ordered' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  createdBy: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  convertedToOrder?: {
    _id: string;
    orderNumber: string;
    status: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface NeedListStatistics {
  total: number;
  byStatus: {
    draft?: number;
    ready?: number;
    ordered?: number;
    archived?: number;
  };
  byPriority: {
    low?: number;
    medium?: number;
    high?: number;
    urgent?: number;
  };
}

// Description: Get all need lists with optional filtering
// Endpoint: GET /api/need-lists
// Request: { status?: string, priority?: string, search?: string }
// Response: { needLists: Array<NeedList> }
export const getNeedLists = async (filters?: {
  status?: string;
  priority?: string;
  search?: string;
}): Promise<NeedList[]> => {
  try {
    console.log('Fetching need lists with filters:', filters);
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.search) params.append('search', filters.search);

    const response = await api.get(`/api/need-lists?${params.toString()}`);
    console.log('Need lists fetched:', response.data.needLists.length);
    return response.data.needLists;
  } catch (error: any) {
    console.error('Error fetching need lists:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get need list statistics
// Endpoint: GET /api/need-lists/statistics
// Request: {}
// Response: { statistics: NeedListStatistics }
export const getNeedListStatistics = async (): Promise<NeedListStatistics> => {
  try {
    console.log('Fetching need list statistics');
    const response = await api.get('/api/need-lists/statistics');
    console.log('Statistics fetched:', response.data.statistics);
    return response.data.statistics;
  } catch (error: any) {
    console.error('Error fetching statistics:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get a single need list by ID
// Endpoint: GET /api/need-lists/:id
// Request: {}
// Response: { needList: NeedList }
export const getNeedListById = async (id: string): Promise<NeedList> => {
  try {
    console.log('Fetching need list:', id);
    const response = await api.get(`/api/need-lists/${id}`);
    console.log('Need list fetched:', response.data.needList.name);
    return response.data.needList;
  } catch (error: any) {
    console.error('Error fetching need list:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create a new need list
// Endpoint: POST /api/need-lists
// Request: { name: string, description?: string, items: Array<{part: string, quantity: number, notes?: string}>, priority?: string, tags?: Array<string> }
// Response: { needList: NeedList }
export const createNeedList = async (data: {
  name: string;
  description?: string;
  items: Array<{ part: string; quantity: number; notes?: string }>;
  priority?: string;
  tags?: string[];
}): Promise<NeedList> => {
  try {
    console.log('Creating need list:', data.name);
    const response = await api.post('/api/need-lists', data);
    console.log('Need list created:', response.data.needList._id);
    return response.data.needList;
  } catch (error: any) {
    console.error('Error creating need list:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update an existing need list
// Endpoint: PUT /api/need-lists/:id
// Request: { name?: string, description?: string, items?: Array<{part: string, quantity: number, notes?: string}>, status?: string, priority?: string, tags?: Array<string> }
// Response: { needList: NeedList }
export const updateNeedList = async (
  id: string,
  data: Partial<{
    name: string;
    description: string;
    items: Array<{ part: string; quantity: number; notes?: string }>;
    status: string;
    priority: string;
    tags: string[];
  }>
): Promise<NeedList> => {
  try {
    console.log('Updating need list:', id);
    const response = await api.put(`/api/need-lists/${id}`, data);
    console.log('Need list updated successfully');
    return response.data.needList;
  } catch (error: any) {
    console.error('Error updating need list:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete a need list
// Endpoint: DELETE /api/need-lists/:id
// Request: {}
// Response: { message: string }
export const deleteNeedList = async (id: string): Promise<{ message: string }> => {
  try {
    console.log('Deleting need list:', id);
    const response = await api.delete(`/api/need-lists/${id}`);
    console.log('Need list deleted successfully');
    return response.data;
  } catch (error: any) {
    console.error('Error deleting need list:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Add item to need list
// Endpoint: POST /api/need-lists/:id/items
// Request: { part: string, quantity: number, notes?: string }
// Response: { needList: NeedList }
export const addItemToNeedList = async (
  id: string,
  item: { part: string; quantity: number; notes?: string }
): Promise<NeedList> => {
  try {
    console.log('Adding item to need list:', id);
    const response = await api.post(`/api/need-lists/${id}/items`, item);
    console.log('Item added successfully');
    return response.data.needList;
  } catch (error: any) {
    console.error('Error adding item:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Remove item from need list
// Endpoint: DELETE /api/need-lists/:id/items/:itemId
// Request: {}
// Response: { needList: NeedList }
export const removeItemFromNeedList = async (
  id: string,
  itemId: string
): Promise<NeedList> => {
  try {
    console.log('Removing item from need list:', id, itemId);
    const response = await api.delete(`/api/need-lists/${id}/items/${itemId}`);
    console.log('Item removed successfully');
    return response.data.needList;
  } catch (error: any) {
    console.error('Error removing item:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Convert need list to EPart order
// Endpoint: POST /api/need-lists/:id/convert-to-order
// Request: { supplier?: string, notes?: string }
// Response: { order: EPartOrder, needList: NeedList }
export const convertNeedListToOrder = async (
  id: string,
  data: { supplier?: string; notes?: string }
): Promise<{ order: any; needList: NeedList }> => {
  try {
    console.log('Converting need list to order:', id);
    const response = await api.post(`/api/need-lists/${id}/convert-to-order`, data);
    console.log('Need list converted to order:', response.data.order.orderNumber);
    return response.data;
  } catch (error: any) {
    console.error('Error converting need list:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
