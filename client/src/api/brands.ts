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
  image?: string
  specifications?: Record<string, any>  // Legacy field for backward compatibility
  // Comprehensive specification sections
  images?: Array<{
    url?: string
    base64?: string
    caption?: string
  }>
  network?: {
    technology2G?: string
    bands2G?: string
    technology3G?: string
    bands3G?: string
    technology4G?: string
    bands4G?: string
    technology5G?: string
    bands5G?: string
    speed?: string
  }
  physical?: {
    dimensions?: string
    weight?: string
    build?: string
    simType?: string
    simCount?: string
  }
  display?: {
    type?: string
    size?: string
    resolution?: string
    protection?: string
    features?: string
  }
  platform?: {
    os?: string
    chipset?: string
    cpu?: string
    gpu?: string
  }
  memory?: {
    internal?: Array<{
      ram?: string
      storage?: string
    }>
    cardSlot?: string
  }
  rearCamera?: {
    modules?: string
    features?: string
    video?: string
  }
  frontCamera?: {
    modules?: string
    features?: string
    video?: string
  }
  audio?: {
    loudspeaker?: string
    jack3_5mm?: string
  }
  connectivity?: {
    wlan?: string
    bluetooth?: string
    positioning?: string
    nfc?: string
    radio?: string
    usb?: string
    infrared?: string
    other?: string
  }
  features?: {
    sensors?: string
    special?: string[]
  }
  battery?: {
    type?: string
    charging?: string
    standbyTime?: string
    talkTime?: string
    musicPlay?: string
  }
  other?: {
    models?: string[]
    sarValues?: {
      head?: string
      body?: string
    }
    price?: string
    releaseDate?: string
    colors?: string[]
  }
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

// Description: Update an existing device model
// Endpoint: PUT /api/devices/models/:id
// Request: { name?: string, brandId?: string, deviceType?: string, image?: string, specifications?: Record<string, string> }
// Response: { success: boolean, message: string, model: Model }
export const updateModel = async (modelId: string, modelData: Partial<Model>): Promise<Model> => {
  try {
    console.log('API: Making request to PUT /api/devices/models/' + modelId, modelData)
    const response = await api.put(`/api/devices/models/${modelId}`, modelData)
    console.log('API: Received response from PUT /api/devices/models:', response.data)
    return response.data.model
  } catch (error) {
    console.error('Error updating model:', error)
    throw new Error(error?.response?.data?.error || error.message || 'Failed to update model')
  }
}

// Description: Update an existing device brand
// Endpoint: PUT /api/devices/brands/:id
// Request: { name?: string, logo?: string }
// Response: { success: boolean, message: string, brand: Brand }
export const updateBrand = async (brandId: string, brandData: Partial<Brand>): Promise<Brand> => {
  try {
    console.log('API: Making request to PUT /api/devices/brands/' + brandId, brandData)
    const response = await api.put(`/api/devices/brands/${brandId}`, brandData)
    console.log('API: Received response from PUT /api/devices/brands:', response.data)
    return response.data.brand
  } catch (error) {
    console.error('Error updating brand:', error)
    throw new Error(error?.response?.data?.error || error.message || 'Failed to update brand')
  }
}