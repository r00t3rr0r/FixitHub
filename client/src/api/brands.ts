import { api } from './api'

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
    console.log('API: Making request to /api/brands')
    const response = await api.get('/api/brands')
    console.log('API: Received response from /api/brands:', response.data)
    return response.data.brands || []
  } catch (error) {
    console.error('Error fetching brands:', error)
    throw new Error(error?.response?.data?.error || error.message || 'Failed to fetch brands')
  }
}

export const getBrandById = async (id: string): Promise<Brand> => {
  try {
    console.log(`API: Making request to /api/brands/${id}`)
    const response = await api.get(`/api/brands/${id}`)
    console.log(`API: Received response from /api/brands/${id}:`, response.data)
    return response.data.brand
  } catch (error) {
    console.error(`Error fetching brand ${id}:`, error)
    throw new Error(error?.response?.data?.error || error.message || 'Failed to fetch brand')
  }
}

export const getModelsByBrand = async (brandId: string): Promise<Model[]> => {
  try {
    console.log(`API: Making request to /api/brands/${brandId}/models`)
    const response = await api.get(`/api/brands/${brandId}/models`)
    console.log(`API: Received response from /api/brands/${brandId}/models:`, response.data)
    return response.data.models || []
  } catch (error) {
    console.error(`Error fetching models for brand ${brandId}:`, error)
    throw new Error(error?.response?.data?.error || error.message || 'Failed to fetch models')
  }
}

export const getModelById = async (modelId: string): Promise<Model> => {
  try {
    console.log(`API: Making request to /api/models/${modelId}`)
    const response = await api.get(`/api/models/${modelId}`)
    console.log(`API: Received response from /api/models/${modelId}:`, response.data)
    return response.data.model
  } catch (error) {
    console.error(`Error fetching model ${modelId}:`, error)
    throw new Error(error?.response?.data?.error || error.message || 'Failed to fetch model')
  }
}