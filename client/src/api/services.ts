import api from './api';

export interface RepairService {
  _id: string;
  name: string;
  description: string;
  price: number;
  estimatedTime: string;
  category: string;
  deviceTypes: string[];
  manufacturer: string;
  model: string;
  popularity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddOnService {
  _id: string;
  name: string;
  description: string;
  price: number;
  estimatedTime: string;
  category: string;
  compatibility: {
    deviceType: string;
    brands: string[];
  }[];
  bundleDiscount: number;
  popularity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Description: Get all repair services
// Endpoint: GET /api/services
// Request: {}
// Response: { success: boolean, services: RepairService[] }
export const getRepairServices = async () => {
  console.log('getRepairServices called');
  try {
    const response = await api.get('/api/services');
    console.log('getRepairServices API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('getRepairServices API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create a new repair service
// Endpoint: POST /api/services
// Request: { name: string, description: string, price: number, estimatedTime: string, category: string, deviceTypes: string[] }
// Response: { success: boolean, service: RepairService, message: string }
export const createRepairService = async (serviceData: Partial<RepairService>) => {
  console.log('createRepairService called with data:', serviceData);
  try {
    const response = await api.post('/api/services', serviceData);
    console.log('createRepairService API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('createRepairService API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update a repair service
// Endpoint: PUT /api/services/:id
// Request: { name?: string, description?: string, price?: number, estimatedTime?: string, category?: string, deviceTypes?: string[] }
// Response: { success: boolean, service: RepairService, message: string }
export const updateRepairService = async (id: string, serviceData: Partial<RepairService>) => {
  console.log('updateRepairService called with ID:', id, 'and data:', serviceData);
  try {
    const response = await api.put(`/api/services/${id}`, serviceData);
    console.log('updateRepairService API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('updateRepairService API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete a repair service
// Endpoint: DELETE /api/services/:id
// Request: {}
// Response: { success: boolean, message: string }
export const deleteRepairService = async (id: string) => {
  console.log('deleteRepairService called with ID:', id);
  try {
    const response = await api.delete(`/api/services/${id}`);
    console.log('deleteRepairService API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('deleteRepairService API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get all add-on services
// Endpoint: GET /api/addons
// Request: {}
// Response: { success: boolean, addOns: AddOnService[] }
export const getAddOnServices = async () => {
  console.log('getAddOnServices called');
  try {
    const response = await api.get('/api/addons');
    console.log('getAddOnServices API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('getAddOnServices API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create a new add-on service
// Endpoint: POST /api/addons
// Request: { name: string, description: string, price: number, estimatedTime: string, category: string, compatibility: object[] }
// Response: { success: boolean, addOn: AddOnService, message: string }
export const createAddOnService = async (addOnData: Partial<AddOnService>) => {
  console.log('createAddOnService called with data:', addOnData);
  try {
    const response = await api.post('/api/addons', addOnData);
    console.log('createAddOnService API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('createAddOnService API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update an add-on service
// Endpoint: PUT /api/addons/:id
// Request: { name?: string, description?: string, price?: number, estimatedTime?: string, category?: string, compatibility?: object[] }
// Response: { success: boolean, addOn: AddOnService, message: string }
export const updateAddOnService = async (id: string, addOnData: Partial<AddOnService>) => {
  console.log('updateAddOnService called with ID:', id, 'and data:', addOnData);
  try {
    const response = await api.put(`/api/addons/${id}`, addOnData);
    console.log('updateAddOnService API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('updateAddOnService API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete an add-on service
// Endpoint: DELETE /api/addons/:id
// Request: {}
// Response: { success: boolean, message: string }
export const deleteAddOnService = async (id: string) => {
  console.log('deleteAddOnService called with ID:', id);
  try {
    const response = await api.delete(`/api/addons/${id}`);
    console.log('deleteAddOnService API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('deleteAddOnService API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get single repair service by ID
// Endpoint: GET /api/services/:id
// Request: {}
// Response: { success: boolean, service: RepairService }
export const getRepairServiceById = async (id: string) => {
  console.log('getRepairServiceById called with ID:', id);
  try {
    const response = await api.get(`/api/services/${id}`);
    console.log('getRepairServiceById API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('getRepairServiceById API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get single add-on service by ID
// Endpoint: GET /api/addons/:id
// Request: {}
// Response: { success: boolean, addOn: AddOnService }
export const getAddOnServiceById = async (id: string) => {
  console.log('getAddOnServiceById called with ID:', id);
  try {
    const response = await api.get(`/api/addons/${id}`);
    console.log('getAddOnServiceById API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('getAddOnServiceById API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};