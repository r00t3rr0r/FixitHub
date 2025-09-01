import api from './api';

export interface Brand {
  _id: string
  name: string
  logo?: string
  models: Model[]
  createdAt: string
  updatedAt: string
}

export interface Model {
  _id: string
  name: string
  brandId: string
  deviceType: string
  createdAt: string
  updatedAt: string
}

export const getBrands = async (): Promise<Brand[]> => {
  try {
    console.log('API: Making request to /api/devices/brands')
    const response = await api.get('/api/devices/brands')
    console.log('API: Full response object:', response)
    console.log('API: Response status:', response.status)
    console.log('API: Response headers:', response.headers)
    console.log('API: Response data:', response.data)
    console.log('API: Response data type:', typeof response.data)
    console.log('API: Response data keys:', Object.keys(response.data || {}))
    console.log('API: response.data.brands:', response.data.brands)
    console.log('API: response.data.brands type:', typeof response.data.brands)
    console.log('API: response.data.brands length:', response.data.brands?.length)
    
    const brands = response.data.brands || []
    console.log('API: Final brands array:', brands)
    console.log('API: Final brands array length:', brands.length)
    console.log('API: Final brands array type:', typeof brands)
    
    return brands
  } catch (error) {
    console.error('Error fetching brands:', error)
    console.error('Error response:', error?.response)
    console.error('Error response data:', error?.response?.data)
    throw new Error(error?.response?.data?.error || error.message || 'Failed to fetch brands')
  }
}

export const getBrandById = async (id: string): Promise<Brand> => {
  try {
    console.log(`API: Making request to /api/devices/brands/${id}`)
    const response = await api.get(`/api/devices/brands/${id}`)
    console.log(`API: Received response from /api/devices/brands/${id}:`, response.data)
    return response.data.brand
  } catch (error) {
    console.error(`Error fetching brand ${id}:`, error)
    throw new Error(error?.response?.data?.error || error.message || 'Failed to fetch brand')
  }
}

export const getModelsByBrand = async (brandId: string): Promise<Model[]> => {
  try {
    console.log(`API: Making request to /api/devices/brands/${brandId}/models`)
    const response = await api.get(`/api/devices/brands/${brandId}/models`)
    console.log(`API: Received response from /api/devices/brands/${brandId}/models:`, response.data)
    return response.data.models || []
  } catch (error) {
    console.error(`Error fetching models for brand ${brandId}:`, error)
    throw new Error(error?.response?.data?.error || error.message || 'Failed to fetch models')
  }
}

export const getModelById = async (modelId: string): Promise<Model> => {
  try {
    console.log(`API: Making request to /api/devices/models/${modelId}`)
    const response = await api.get(`/api/devices/models/${modelId}`)
    console.log(`API: Received response from /api/devices/models/${modelId}:`, response.data)
    return response.data.model
  } catch (error) {
    console.error(`Error fetching model ${modelId}:`, error)
    throw new Error(error?.response?.data?.error || error.message || 'Failed to fetch model')
  }
}

export const createBrand = async (brandData: { name: string; logo?: string }): Promise<Brand> => {
  try {
    console.log('API: Making request to POST /api/devices/brands', brandData)
    const response = await api.post('/api/devices/brands', brandData)
    console.log('API: Received response from POST /api/devices/brands:', response.data)
    console.log('API: Created brand response structure:', JSON.stringify(response.data, null, 2))
    return response.data.brand
  } catch (error) {
    console.error('Error creating brand:', error)
    throw new Error(error?.response?.data?.error || error.message || 'Failed to create brand')
  }
}

export const createModel = async (modelData: { name: string; brandId: string; deviceType: string; image?: string; specifications?: Record<string, string> }): Promise<Model> => {
  try {
    console.log('API: Making request to POST /api/devices/models', modelData)
    const response = await api.post('/api/devices/models', modelData)
    console.log('API: Received response from POST /api/devices/models:', response.data)
    return response.data.model
  } catch (error) {
    console.error('Error creating model:', error)
    throw new Error(error?.response?.data?.error || error.message || 'Failed to create model')
  }
}