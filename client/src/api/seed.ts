import api from './api';

// Description: Seed all test data including users, services, and other sample data
// Endpoint: POST /api/seed/all
// Request: {}
// Response: { success: boolean, message: string, data: object }
export const seedAllData = async () => {
  try {
    const response = await api.post('/api/seed/all');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Seed test users only (admin, customer, staff)
// Endpoint: POST /api/seed/test-users
// Request: {}
// Response: { success: boolean, message: string, data: Array<{ userId: string, email: string, role: string }> }
export const seedTestUsers = async () => {
  try {
    const response = await api.post('/api/seed/test-users');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Verify test user credentials work correctly
// Endpoint: GET /api/seed/verify-test-users
// Request: {}
// Response: { success: boolean, message: string, data: Array<{ email: string, status: string, role?: string, error?: string }> }
export const verifyTestUsers = async () => {
  try {
    const response = await api.get('/api/seed/verify-test-users');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Check database health and connection status
// Endpoint: GET /api/seed/health
// Request: {}
// Response: { success: boolean, message: string, data: object }
export const checkDatabaseHealth = async () => {
  try {
    const response = await api.get('/api/seed/health');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// Description: Check server health
// Endpoint: GET /api/health
// Request: {}
// Response: { success: boolean, message: string, timestamp: string, environment: string }
export const checkServerHealth = async () => {
  try {
    const response = await api.get('/api/health');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || error.message);
  }
};

// —GERMAN_SEEDING_API (file `client/src/api/seed.ts`) —
// Description: Seed German language services, products, FAQs, blog posts, and homepage content
// Endpoint: POST /api/seed/german
// Request: {}
// Response: { success: boolean, message: string, data: { germanServices, germanAddOnServices, germanInventory, germanDevices, germanProducts, germanBlogData, germanFAQs, germanHomepageTemplate } }
export const seedGermanData = async () => {
  try {
    const response = await api.post('/api/seed/german');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || error.message);
  }
};
// —END_OF_GERMAN_SEEDING_API—