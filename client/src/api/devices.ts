import api from './api';

export interface DeviceType {
  _id: string;
  name: string;
  count: number;
}

export interface Manufacturer {
  _id: string;
  name: string;
  deviceType: string;
  count: number;
}

export interface DeviceModel {
  _id: string;
  name: string;
  manufacturer: string;
  deviceType: string;
  count: number;
}

// Description: Get all device types from repair services
// Endpoint: GET /api/devices/types
// Request: {}
// Response: { deviceTypes: DeviceType[] }
export const getDeviceTypes = async () => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        deviceTypes: [
          { _id: 'smartphone', name: 'Smartphone', count: 15 },
          { _id: 'tablet', name: 'Tablet', count: 8 },
          { _id: 'laptop', name: 'Laptop', count: 12 },
          { _id: 'smartwatch', name: 'Smartwatch', count: 5 },
          { _id: 'gaming-console', name: 'Gaming Console', count: 6 }
        ]
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.get('/api/devices/types');
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Get manufacturers by device type
// Endpoint: GET /api/devices/manufacturers?deviceType=smartphone
// Request: { deviceType: string }
// Response: { manufacturers: Manufacturer[] }
export const getManufacturersByDeviceType = async (deviceType: string) => {
  console.log('API: Getting manufacturers for device type:', deviceType);
  
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      const manufacturersMap: Record<string, Manufacturer[]> = {
        smartphone: [
          { _id: 'apple', name: 'Apple', deviceType: 'smartphone', count: 8 },
          { _id: 'samsung', name: 'Samsung', deviceType: 'smartphone', count: 6 },
          { _id: 'google', name: 'Google', deviceType: 'smartphone', count: 4 },
          { _id: 'oneplus', name: 'OnePlus', deviceType: 'smartphone', count: 3 }
        ],
        tablet: [
          { _id: 'apple', name: 'Apple', deviceType: 'tablet', count: 5 },
          { _id: 'samsung', name: 'Samsung', deviceType: 'tablet', count: 4 },
          { _id: 'microsoft', name: 'Microsoft', deviceType: 'tablet', count: 2 }
        ],
        laptop: [
          { _id: 'apple', name: 'Apple', deviceType: 'laptop', count: 4 },
          { _id: 'dell', name: 'Dell', deviceType: 'laptop', count: 6 },
          { _id: 'hp', name: 'HP', deviceType: 'laptop', count: 5 },
          { _id: 'lenovo', name: 'Lenovo', deviceType: 'laptop', count: 4 }
        ],
        smartwatch: [
          { _id: 'apple', name: 'Apple', deviceType: 'smartwatch', count: 3 },
          { _id: 'samsung', name: 'Samsung', deviceType: 'smartwatch', count: 2 },
          { _id: 'garmin', name: 'Garmin', deviceType: 'smartwatch', count: 2 }
        ],
        'gaming-console': [
          { _id: 'sony', name: 'Sony', deviceType: 'gaming-console', count: 3 },
          { _id: 'microsoft', name: 'Microsoft', deviceType: 'gaming-console', count: 2 },
          { _id: 'nintendo', name: 'Nintendo', deviceType: 'gaming-console', count: 2 }
        ]
      };
      
      resolve({
        manufacturers: manufacturersMap[deviceType] || []
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.get(`/api/devices/manufacturers?deviceType=${deviceType}`);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Get models by device type and manufacturer
// Endpoint: GET /api/devices/models?deviceType=smartphone&manufacturer=apple
// Request: { deviceType: string, manufacturer: string }
// Response: { models: DeviceModel[] }
export const getModelsByTypeAndManufacturer = async (deviceType: string, manufacturer: string) => {
  console.log('=== API DEVICES DEBUG ===');
  console.log('API: Getting models for device type:', deviceType, 'and manufacturer:', manufacturer);

  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      const modelsMap: Record<string, Record<string, DeviceModel[]>> = {
        smartphone: {
          apple: [
            { _id: 'iphone-15-pro', name: 'iPhone 15 Pro', manufacturer: 'apple', deviceType: 'smartphone', count: 3 },
            { _id: 'iphone-15', name: 'iPhone 15', manufacturer: 'apple', deviceType: 'smartphone', count: 2 },
            { _id: 'iphone-14-pro', name: 'iPhone 14 Pro', manufacturer: 'apple', deviceType: 'smartphone', count: 2 },
            { _id: 'iphone-14', name: 'iPhone 14', manufacturer: 'apple', deviceType: 'smartphone', count: 1 }
          ],
          samsung: [
            { _id: 'galaxy-s24-ultra', name: 'Galaxy S24 Ultra', manufacturer: 'samsung', deviceType: 'smartphone', count: 2 },
            { _id: 'galaxy-s24', name: 'Galaxy S24', manufacturer: 'samsung', deviceType: 'smartphone', count: 2 },
            { _id: 'galaxy-s23-ultra', name: 'Galaxy S23 Ultra', manufacturer: 'samsung', deviceType: 'smartphone', count: 1 },
            { _id: 'galaxy-note-20', name: 'Galaxy Note 20', manufacturer: 'samsung', deviceType: 'smartphone', count: 1 }
          ],
          google: [
            { _id: 'pixel-8-pro', name: 'Pixel 8 Pro', manufacturer: 'google', deviceType: 'smartphone', count: 2 },
            { _id: 'pixel-8', name: 'Pixel 8', manufacturer: 'google', deviceType: 'smartphone', count: 1 },
            { _id: 'pixel-7-pro', name: 'Pixel 7 Pro', manufacturer: 'google', deviceType: 'smartphone', count: 1 }
          ],
          oneplus: [
            { _id: 'oneplus-12', name: 'OnePlus 12', manufacturer: 'oneplus', deviceType: 'smartphone', count: 1 },
            { _id: 'oneplus-11', name: 'OnePlus 11', manufacturer: 'oneplus', deviceType: 'smartphone', count: 1 },
            { _id: 'oneplus-10-pro', name: 'OnePlus 10 Pro', manufacturer: 'oneplus', deviceType: 'smartphone', count: 1 }
          ]
        },
        tablet: {
          apple: [
            { _id: 'ipad-pro-12.9', name: 'iPad Pro 12.9"', manufacturer: 'apple', deviceType: 'tablet', count: 2 },
            { _id: 'ipad-air', name: 'iPad Air', manufacturer: 'apple', deviceType: 'tablet', count: 2 },
            { _id: 'ipad', name: 'iPad', manufacturer: 'apple', deviceType: 'tablet', count: 1 }
          ],
          samsung: [
            { _id: 'galaxy-tab-s9-ultra', name: 'Galaxy Tab S9 Ultra', manufacturer: 'samsung', deviceType: 'tablet', count: 2 },
            { _id: 'galaxy-tab-s9', name: 'Galaxy Tab S9', manufacturer: 'samsung', deviceType: 'tablet', count: 1 },
            { _id: 'galaxy-tab-a8', name: 'Galaxy Tab A8', manufacturer: 'samsung', deviceType: 'tablet', count: 1 }
          ],
          microsoft: [
            { _id: 'surface-pro-9', name: 'Surface Pro 9', manufacturer: 'microsoft', deviceType: 'tablet', count: 1 },
            { _id: 'surface-go-3', name: 'Surface Go 3', manufacturer: 'microsoft', deviceType: 'tablet', count: 1 }
          ]
        }
      };

      console.log('=== MODELS MAP LOOKUP ===');
      console.log('Looking for deviceType:', deviceType, 'in modelsMap keys:', Object.keys(modelsMap));
      console.log('Found deviceType section:', !!modelsMap[deviceType]);
      
      if (modelsMap[deviceType]) {
        console.log('Looking for manufacturer:', manufacturer, 'in manufacturer keys:', Object.keys(modelsMap[deviceType]));
        console.log('Found manufacturer section:', !!modelsMap[deviceType][manufacturer]);
        
        if (modelsMap[deviceType][manufacturer]) {
          console.log('Found models:', modelsMap[deviceType][manufacturer]);
        }
      }

      const resultModels = modelsMap[deviceType]?.[manufacturer] || [];
      console.log('=== FINAL RESULT ===');
      console.log('Returning models:', resultModels);
      console.log('Models count:', resultModels.length);

      resolve({
        models: resultModels
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   return await api.get(`/api/devices/models?deviceType=${deviceType}&manufacturer=${manufacturer}`);
  // } catch (error) {
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};