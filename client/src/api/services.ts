import api from './api';

export interface RepairService {
  _id: string;
  name: string;
  description: string;
  price: number;
  estimatedTime: string;
  category: string;
  deviceTypes: string[];
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
// Response: { services: RepairService[] }
export const getRepairServices = () => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        services: [
          {
            _id: 'service1',
            name: 'Screen Replacement',
            description: 'Complete screen and digitizer replacement with warranty',
            price: 199,
            estimatedTime: '2-3 hours',
            category: 'Display',
            deviceTypes: ['iPhone', 'Samsung', 'Google Pixel'],
            popularity: 95
          },
          {
            _id: 'service2',
            name: 'Battery Replacement',
            description: 'High-quality battery replacement with 1-year warranty',
            price: 89,
            estimatedTime: '1-2 hours',
            category: 'Power',
            deviceTypes: ['iPhone', 'Samsung', 'Google Pixel'],
            popularity: 88
          },
          {
            _id: 'service3',
            name: 'Camera Repair',
            description: 'Camera module replacement and calibration',
            price: 149,
            estimatedTime: '2-4 hours',
            category: 'Camera',
            deviceTypes: ['iPhone', 'Samsung'],
            popularity: 72
          },
          {
            _id: 'service4',
            name: 'Water Damage Repair',
            description: 'Complete water damage assessment and repair',
            price: 299,
            estimatedTime: '1-3 days',
            category: 'Emergency',
            deviceTypes: ['iPhone', 'Samsung', 'Google Pixel'],
            popularity: 65
          }
        ]
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.get('/api/services');
  // } catch (error) {
  //   throw new Error(error?.response?.data?.message || error.message);
  // }
};

// Description: Get all device brands and models
// Endpoint: GET /api/devices
// Request: {}
// Response: { brands: DeviceBrand[] }
export const getDeviceBrands = () => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        brands: [
          {
            _id: 'brand1',
            name: 'Apple',
            logo: 'https://via.placeholder.com/100x100/000000/ffffff?text=Apple',
            models: [
              {
                _id: 'model1',
                name: 'iPhone 15 Pro Max',
                brand: 'Apple',
                image: 'https://via.placeholder.com/200x300/3b82f6/ffffff?text=iPhone+15+Pro+Max',
                supportedServices: ['service1', 'service2', 'service3']
              },
              {
                _id: 'model2',
                name: 'iPhone 15 Pro',
                brand: 'Apple',
                image: 'https://via.placeholder.com/200x300/1e40af/ffffff?text=iPhone+15+Pro',
                supportedServices: ['service1', 'service2', 'service3']
              },
              {
                _id: 'model3',
                name: 'iPhone 14 Pro',
                brand: 'Apple',
                image: 'https://via.placeholder.com/200x300/1e3a8a/ffffff?text=iPhone+14+Pro',
                supportedServices: ['service1', 'service2', 'service3']
              }
            ]
          },
          {
            _id: 'brand2',
            name: 'Samsung',
            logo: 'https://via.placeholder.com/100x100/1f2937/ffffff?text=Samsung',
            models: [
              {
                _id: 'model4',
                name: 'Galaxy S24 Ultra',
                brand: 'Samsung',
                image: 'https://via.placeholder.com/200x300/10b981/ffffff?text=Galaxy+S24+Ultra',
                supportedServices: ['service1', 'service2', 'service3']
              },
              {
                _id: 'model5',
                name: 'Galaxy S23',
                brand: 'Samsung',
                image: 'https://via.placeholder.com/200x300/059669/ffffff?text=Galaxy+S23',
                supportedServices: ['service1', 'service2', 'service3']
              }
            ]
          },
          {
            _id: 'brand3',
            name: 'Google',
            logo: 'https://via.placeholder.com/100x100/dc2626/ffffff?text=Google',
            models: [
              {
                _id: 'model6',
                name: 'Pixel 8 Pro',
                brand: 'Google',
                image: 'https://via.placeholder.com/200x300/8b5cf6/ffffff?text=Pixel+8+Pro',
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