import api from './api';

export interface RepairService {
  _id: string;
  name: string;
  description: string;
  price: number;
  estimatedTime: string;
  category: string;
  deviceTypes: string[];
  manufacturer?: string;
  model?: string;
  internalRepairInfo?: string;
  externalRepairInfo?: string;
  linkedKnowledgeBaseArticles?: Array<{
    articleId?: string;
    title: string;
    url: string;
  }>;
  popularity: number;
}

export interface DeviceBrand {
  _id: string;
  name: string;
  logo: string;
  models: DeviceModel[];
}

export interface DeviceModel {
  _id: string;
  name: string;
  brand: string;
  image: string;
  supportedServices: string[];
}

// Description: Get all available repair services
// Endpoint: GET /api/services
// Request: {}
// Response: { success: boolean, services: RepairService[] }
export const getRepairServices = async () => {
  try {
    console.log('API: Fetching repair services from backend...');
    const response = await api.get('/api/services');
    console.log('API: Successfully fetched repair services:', response.data);
    return response.data;
  } catch (error) {
    console.error('API: Error fetching repair services:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get single repair service by ID
// Endpoint: GET /api/services/:id
// Request: {}
// Response: { success: boolean, service: RepairService }
export const getRepairService = async (id: string) => {
  try {
    console.log('API: Fetching repair service with ID:', id);
    const response = await api.get(`/api/services/${id}`);
    console.log('API: Successfully fetched repair service:', response.data);
    return response.data;
  } catch (error) {
    console.error('API: Error fetching repair service:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create a new repair service (admin only)
// Endpoint: POST /api/services
// Request: { name: string, description: string, price: number, estimatedTime: string, category: string, deviceTypes: string[], manufacturer?: string, model?: string, internalRepairInfo?: string, externalRepairInfo?: string, linkedKnowledgeBaseArticles?: Array<{title: string, url: string}>, popularity?: number }
// Response: { success: boolean, message: string, service: RepairService }
export const createRepairService = async (serviceData: {
  name: string;
  description: string;
  price: number;
  estimatedTime: string;
  category: string;
  deviceTypes: string[];
  manufacturer?: string;
  model?: string;
  internalRepairInfo?: string;
  externalRepairInfo?: string;
  linkedKnowledgeBaseArticles?: Array<{title: string, url: string}>;
  popularity?: number;
}) => {
  try {
    console.log('API: Creating repair service:', serviceData);
    const response = await api.post('/api/services', serviceData);
    console.log('API: Successfully created repair service:', response.data);
    return response.data;
  } catch (error) {
    console.error('API: Error creating repair service:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update an existing repair service (admin only)
// Endpoint: PUT /api/services/:id
// Request: { name?: string, description?: string, price?: number, estimatedTime?: string, category?: string, deviceTypes?: string[], manufacturer?: string, model?: string, internalRepairInfo?: string, externalRepairInfo?: string, linkedKnowledgeBaseArticles?: Array<{title: string, url: string}>, popularity?: number }
// Response: { success: boolean, message: string, service: RepairService }
export const updateRepairService = async (id: string, serviceData: {
  name?: string;
  description?: string;
  price?: number;
  estimatedTime?: string;
  category?: string;
  deviceTypes?: string[];
  manufacturer?: string;
  model?: string;
  internalRepairInfo?: string;
  externalRepairInfo?: string;
  linkedKnowledgeBaseArticles?: Array<{title: string, url: string}>;
  popularity?: number;
}) => {
  try {
    console.log('API: Updating repair service with ID:', id, 'Data:', serviceData);
    const response = await api.put(`/api/services/${id}`, serviceData);
    console.log('API: Successfully updated repair service:', response.data);
    return response.data;
  } catch (error) {
    console.error('API: Error updating repair service:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete a repair service (admin only)
// Endpoint: DELETE /api/services/:id
// Request: {}
// Response: { success: boolean, message: string }
export const deleteRepairService = async (id: string) => {
  try {
    console.log('API: Deleting repair service with ID:', id);
    const response = await api.delete(`/api/services/${id}`);
    console.log('API: Successfully deleted repair service:', response.data);
    return response.data;
  } catch (error) {
    console.error('API: Error deleting repair service:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get all device brands and models
// Endpoint: GET /api/devices
// Request: {}
// Response: { brands: DeviceBrand[] }
export const getDeviceBrands = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        brands: [
          {
            _id: 'brand1',
            name: 'Apple',
            logo: 'https://picsum.photos/100/100?random=20',
            models: [
              {
                _id: 'model1',
                name: 'iPhone 15 Pro Max',
                brand: 'Apple',
                image: 'https://picsum.photos/200/300?random=21',
                supportedServices: ['service1', 'service2', 'service3']
              },
              {
                _id: 'model2',
                name: 'iPhone 15 Pro',
                brand: 'Apple',
                image: 'https://picsum.photos/200/300?random=22',
                supportedServices: ['service1', 'service2', 'service3']
              },
              {
                _id: 'model3',
                name: 'iPhone 14 Pro',
                brand: 'Apple',
                image: 'https://picsum.photos/200/300?random=23',
                supportedServices: ['service1', 'service2', 'service3']
              }
            ]
          },
          {
            _id: 'brand2',
            name: 'Samsung',
            logo: 'https://picsum.photos/100/100?random=24',
            models: [
              {
                _id: 'model4',
                name: 'Galaxy S24 Ultra',
                brand: 'Samsung',
                image: 'https://picsum.photos/200/300?random=25',
                supportedServices: ['service1', 'service2', 'service3']
              },
              {
                _id: 'model5',
                name: 'Galaxy S23',
                brand: 'Samsung',
                image: 'https://picsum.photos/200/300?random=26',
                supportedServices: ['service1', 'service2', 'service3']
              }
            ]
          },
          {
            _id: 'brand3',
            name: 'Google',
            logo: 'https://picsum.photos/100/100?random=27',
            models: [
              {
                _id: 'model6',
                name: 'Pixel 8 Pro',
                brand: 'Google',
                image: 'https://picsum.photos/200/300?random=28',
                supportedServices: ['service1', 'service2', 'service4']
              }
            ]
          }
        ]
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.get('/api/devices');
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};

// Description: Get available add-on services
// Endpoint: GET /api/services/addons
// Request: {}
// Response: { addOns: AddOnService[] }
export const getAddOnServices = () => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        addOns: [
          {
            _id: 'addon1',
            name: 'Screen Protector',
            description: 'Premium tempered glass protection',
            price: 25,
            estimatedTime: '5 minutes',
            category: 'Protection',
            compatibility: ['iPhone', 'Samsung', 'Google Pixel']
          },
          {
            _id: 'addon2',
            name: 'Phone Case',
            description: 'Protective case with drop protection',
            price: 35,
            estimatedTime: '2 minutes',
            category: 'Protection',
            compatibility: ['iPhone', 'Samsung', 'Google Pixel']
          },
          {
            _id: 'addon3',
            name: 'Data Backup',
            description: 'Complete data backup and transfer service',
            price: 50,
            estimatedTime: '30 minutes',
            category: 'Data',
            compatibility: ['iPhone', 'Samsung', 'Google Pixel']
          },
          {
            _id: 'addon4',
            name: 'Express Service',
            description: 'Priority repair with 24-hour turnaround',
            price: 75,
            estimatedTime: '0 minutes',
            category: 'Service',
            compatibility: ['iPhone', 'Samsung', 'Google Pixel']
          },
          {
            _id: 'addon5',
            name: 'Extended Warranty',
            description: '2-year extended warranty coverage',
            price: 99,
            estimatedTime: '0 minutes',
            category: 'Warranty',
            compatibility: ['iPhone', 'Samsung', 'Google Pixel']
          }
        ]
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.get('/api/services/addons');
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};