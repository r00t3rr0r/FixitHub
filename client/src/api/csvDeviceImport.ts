import api from './api';

// Validate CSV data for device models
export const validateDeviceCSVImport = async (csvData: any[], columnMapping: Record<string, string>, options?: { skipDuplicates?: boolean }) => {
  try {
    const response = await api.post('/api/csv-device-import/validate', {
      csvData,
      columnMapping,
      options
    });
    return response.data;
  } catch (error) {
    console.error('Error validating device CSV import:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Import validated device models into the database
export const importDevicesFromCSV = async (devices: any[]) => {
  try {
    const response = await api.post('/api/csv-device-import/import', {
      devices
    });
    return response.data;
  } catch (error) {
    console.error('Error importing devices from CSV:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
